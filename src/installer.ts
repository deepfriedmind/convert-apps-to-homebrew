/**
 * Installation logic for Homebrew packages with dry-run support
 */

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { promisify } from 'node:util'

import type {
  AppInfo,
  BrewCommandResult,
  InstallationResult,
  InstallerConfig,
  Logger,
  PackageInstallResult,
} from './types.ts'

import { BREW_COMMANDS, DEFAULT_CONFIG } from './constants.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import { createLogger, escapeShellArgument, groupBy } from './utils.ts'

const execAsync = promisify(exec)

/**
 * Get installation summary for display
 */
export function getInstallationSummary(result: InstallationResult): string {
  const lines: string[] = []

  if (result.dryRun) {
    lines.push('🔍 DRY RUN SUMMARY', '═'.repeat(50))
  }
  else {
    lines.push('📊 INSTALLATION SUMMARY', '═'.repeat(50))
  }

  if (result.installed.length > 0) {
    lines.push(`✅ Successfully installed: ${result.installed.length}`)

    for (const app of result.installed) {
      lines.push(`   • ${app.appName} (${app.packageName})`)
    }
  }

  if (result.failed.length > 0) {
    lines.push(`❌ Failed to install: ${result.failed.length}`)

    for (const app of result.failed) {
      lines.push(`   • ${app.appName} (${app.packageName}): ${app.error ?? 'Unknown error'}`)
    }
  }

  if (result.installed.length === 0 && result.failed.length === 0) {
    lines.push('⚠️  No packages were processed')
  }

  return lines.join('\n')
}

/**
 * Main installation function
 */
export async function installApps(
  selectedApps: AppInfo[],
  config: InstallerConfig,
): Promise<InstallationResult> {
  const logger = createLogger(config.verbose)

  if (selectedApps.length === 0) {
    logger.info('No apps selected for installation')

    return {
      alreadyInstalled: [],
      dryRun: config.dryRun,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [],
    }
  }

  // Group apps by type
  const appsByType = groupBy(selectedApps, app => app.brewType)
  const casks = appsByType.cask ?? []
  const formulas = appsByType.formula ?? []

  logger.info(`Starting installation: ${casks.length} cask(s), ${formulas.length} formula(s)`)

  const allResults: PackageInstallResult[] = []

  try {
    // Install casks first
    if (casks.length > 0) {
      const caskResults = await installCasks(casks, config, logger)
      allResults.push(...caskResults)

      // Delete original .app files for successful cask installations
      if (config.sudoPassword !== undefined && !config.dryRun) {
        await deleteOriginalApps(caskResults, casks, config.sudoPassword, config, logger)
      }
      else if (casks.length > 0 && config.sudoPassword === undefined && !config.dryRun) {
        logger.warn('No sudo password provided - original .app files will not be deleted')
      }
    }

    // Install formulas
    if (formulas.length > 0) {
      const formulaResults = await installFormulas(formulas, config, logger)
      allResults.push(...formulaResults)
    }

    // Categorize results
    const installed = allResults.filter(result => result.success)
    const failed = allResults.filter(result => !result.success)

    logger.info(`Installation complete: ${installed.length} successful, ${failed.length} failed`)

    return {
      alreadyInstalled: [],
      dryRun: config.dryRun,
      failed,
      ignored: [],
      installed,
      unavailable: [],
    }
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Installation failed: ${errorMessage}`)

    throw new ConvertAppsError(
      `Installation process failed: ${errorMessage}`,
      ErrorType.COMMAND_FAILED,
      error instanceof Error ? error : undefined,
    )
  }
}

/**
 * Validate installation prerequisites
 */
export async function validateInstallationPrerequisites(): Promise<void> {
  // Check if Homebrew is available
  const brewCheck = await executeCommand(BREW_COMMANDS.VERSION, false, 5000)

  if (!brewCheck.success) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED,
    )
  }
}

/**
 * Delete original .app files for successfully installed casks
 */
async function deleteOriginalApps(
  installedCasks: PackageInstallResult[],
  caskApps: AppInfo[],
  sudoPassword: string,
  config: InstallerConfig,
  logger: Logger,
): Promise<void> {
  const successfulCasks = installedCasks.filter(result => result.success)

  if (successfulCasks.length === 0) {
    logger.verbose('No successful cask installations to clean up')

    return
  }

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Deleting ${successfulCasks.length} original .app file(s)`)

  for (const result of successfulCasks) {
    const app = caskApps.find(a => a.brewName === result.packageName)

    if (!app) {
      logger.warn(`Could not find app info for ${result.packageName}`)
      continue
    }

    try {
      if (config.dryRun) {
        logger.verbose(`[DRY RUN] Would delete: ${app.appPath}`)
        continue
      }

      // Check if the app file still exists
      try {
        await fs.access(app.appPath)
      }
      catch {
        logger.verbose(`App file already removed: ${app.appPath}`)
        continue
      }

      // Delete the .app directory
      const deleteCommand = `rm -rf ${escapeShellArgument(app.appPath)}`
      const deleteResult = await executeSudoCommand(deleteCommand, sudoPassword, config.dryRun)

      if (deleteResult.success) {
        logger.verbose(`Deleted: ${app.appPath}`)
      }
      else {
        logger.warn(`Failed to delete ${app.appPath}: ${deleteResult.stderr}`)
      }
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn(`Error deleting ${app.appPath}: ${errorMessage}`)
    }
  }
}

/**
 * Execute a shell command with optional dry-run mode
 */
async function executeCommand(
  command: string,
  dryRun = false,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
): Promise<BrewCommandResult> {
  if (dryRun) {
    return {
      exitCode: 0,
      stderr: '',
      stdout: `[DRY RUN] Would execute: ${command}`,
      success: true,
    }
  }

  try {
    const { stderr, stdout } = await execAsync(command, { timeout })

    return {
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      success: true,
    }
  }
  catch (error: unknown) {
    const typedError = error as { code?: number, message?: string, stderr?: string, stdout?: string }

    return {
      exitCode: typedError.code ?? 1,
      stderr: typedError.stderr?.trim() ?? typedError.message ?? '',
      stdout: typedError.stdout?.trim() ?? '',
      success: false,
    }
  }
}

/**
 * Execute sudo command with password
 */
async function executeSudoCommand(
  command: string,
  password: string,
  dryRun = false,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
): Promise<BrewCommandResult> {
  if (dryRun) {
    return {
      exitCode: 0,
      stderr: '',
      stdout: `[DRY RUN] Would execute with sudo: ${command}`,
      success: true,
    }
  }

  try {
    // Use echo to pipe password to sudo
    const sudoCommand = `echo ${escapeShellArgument(password)} | sudo -S ${command}`
    const { stderr, stdout } = await execAsync(sudoCommand, { timeout })

    return {
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      success: true,
    }
  }
  catch (error: unknown) {
    const typedError = error as { code?: number, message?: string, stderr?: string, stdout?: string }

    return {
      exitCode: typedError.code ?? 1,
      stderr: typedError.stderr?.trim() ?? typedError.message ?? '',
      stdout: typedError.stdout?.trim() ?? '',
      success: false,
    }
  }
}

/**
 * Install Homebrew casks in batch
 */
async function installCasks(
  casks: AppInfo[],
  config: InstallerConfig,
  logger: Logger,
): Promise<PackageInstallResult[]> {
  if (casks.length === 0) {
    return []
  }

  const caskNames = casks.map(app => app.brewName)
  const command = BREW_COMMANDS.INSTALL_CASK(caskNames)

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Installing ${casks.length} cask(s): ${caskNames.join(', ')}`)
  logger.verbose(`Command: ${command}`)

  const result = await executeCommand(command, config.dryRun)

  if (result.success) {
    logger.info(`Successfully installed ${casks.length} cask(s)`)

    return casks.map(app => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      packageName: app.brewName,
      success: true,
    }))
  }
  else {
    logger.error(`Failed to install casks: ${result.stderr}`)

    // In case of batch failure, mark all as failed
    // In a more sophisticated implementation, we could try individual installations
    return casks.map(app => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      error: result.stderr,
      packageName: app.brewName,
      success: false,
    }))
  }
}

/**
 * Install Homebrew formulas in batch
 */
async function installFormulas(
  formulas: AppInfo[],
  config: InstallerConfig,
  logger: Logger,
): Promise<PackageInstallResult[]> {
  if (formulas.length === 0) {
    return []
  }

  const formulaNames = formulas.map(app => app.brewName)
  const command = BREW_COMMANDS.INSTALL_FORMULA(formulaNames)

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Installing ${formulas.length} formula(s): ${formulaNames.join(', ')}`)
  logger.verbose(`Command: ${command}`)

  const result = await executeCommand(command, config.dryRun)

  if (result.success) {
    logger.info(`Successfully installed ${formulas.length} formula(s)`)

    return formulas.map(app => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      packageName: app.brewName,
      success: true,
    }))
  }
  else {
    logger.error(`Failed to install formulas: ${result.stderr}`)

    return formulas.map(app => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      error: result.stderr,
      packageName: app.brewName,
      success: false,
    }))
  }
}
