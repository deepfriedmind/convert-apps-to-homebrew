/**
 * Installation logic for Homebrew packages with dry-run support
 */

import { promises as fs } from 'node:fs'

import type {
  AppInfo,
  InstallationResult,
  InstallerConfig,
  Logger,
  PackageInstallResult,
} from './types.ts'

import { BREW_COMMANDS, DEFAULT_CONFIG } from './constants.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import { createLogger, escapeShellArgument, executeCommand, pluralize } from './utils.ts'

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

  logger.info(`Starting installation: ${selectedApps.length} ${pluralize('cask', selectedApps.length)}`)

  const allResults: PackageInstallResult[] = []

  try {
    // Install casks
    const caskResults = await installCasks(selectedApps, config, logger)
    allResults.push(...caskResults)

    // Delete original .app files for successful cask installations
    if (config.sudoPassword !== undefined && !config.dryRun) {
      await deleteOriginalApps(caskResults, selectedApps, config.sudoPassword, config, logger)
    }
    else if (config.sudoPassword === undefined && !config.dryRun) {
      logger.warn('No sudo password provided - original .app files will not be deleted')
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
  const brewCheck = await executeCommand(BREW_COMMANDS.VERSION, 5000)

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
    const app = caskApps.find(appInfo => appInfo.brewName === result.packageName)

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
      const deleteResult = await executeCommand(deleteCommand, DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, config.dryRun, sudoPassword)

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

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Installing ${casks.length} ${pluralize('cask', casks.length)}: ${caskNames.join(', ')}`)
  logger.verbose(`Command: ${command}`)

  const result = await executeCommand(command, DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, config.dryRun)

  if (result.success) {
    logger.info(`Successfully installed ${casks.length} ${pluralize('cask', casks.length)}`)

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
    return casks.map(app => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      error: result.stderr,
      packageName: app.brewName,
      success: false,
    }))
  }
}
