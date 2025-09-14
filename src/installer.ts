/**
 * Installation logic for Homebrew packages with dry-run support
 */

import { consola } from 'consola'
import { BREW_COMMANDS, DEFAULT_CONFIG } from './constants.ts'
import type {
  AppInfo,
  InstallationResult,
  InstallerConfig,
  PackageInstallResult,
} from './types.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import { executeCommand, pluralize } from './utils.ts'

/**
 * Summary separator length
 */
const SUMMARY_SEPARATOR_LENGTH = 50

/**
 * Get installation summary for display
 */
export function getInstallationSummary(result: InstallationResult): string {
  const lines: string[] = []

  if (result.dryRun) {
    lines.push('DRY RUN SUMMARY', '═'.repeat(SUMMARY_SEPARATOR_LENGTH))
  } else {
    lines.push('INSTALLATION SUMMARY', '═'.repeat(SUMMARY_SEPARATOR_LENGTH))
  }

  if (result.installed.length > 0) {
    lines.push(`Successfully installed: ${result.installed.length}`)

    for (const app of result.installed) {
      lines.push(`   • ${app.appName} (${app.packageName})`)
    }
  }

  if (result.failed.length > 0) {
    lines.push(`Failed to install: ${result.failed.length}`)

    for (const app of result.failed) {
      lines.push(
        `   • ${app.appName} (${app.packageName}): ${app.error ?? 'Unknown error'}`,
      )
    }
  }

  if (result.installed.length === 0 && result.failed.length === 0) {
    lines.push(' No packages were processed')
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
  if (selectedApps.length === 0) {
    consola.info('No apps selected for installation')

    return {
      alreadyInstalled: [],
      dryRun: config.dryRun,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [],
    }
  }

  const allResults: PackageInstallResult[] = []

  try {
    const caskResults = await installCasks(selectedApps, config)
    allResults.push(...caskResults)

    const installed = allResults.filter((result) => result.success)
    const failed = allResults.filter((result) => !result.success)

    return {
      alreadyInstalled: [],
      dryRun: config.dryRun,
      failed,
      ignored: [],
      installed,
      unavailable: [],
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    consola.error(`Installation failed: ${errorMessage}`)

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
  const brewCheck = await executeCommand(
    BREW_COMMANDS.VERSION,
    DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
  )

  if (!brewCheck.success) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED,
    )
  }
}

/**
 * Install Homebrew casks in batch
 */
async function installCasks(
  casks: AppInfo[],
  config: InstallerConfig,
): Promise<PackageInstallResult[]> {
  if (casks.length === 0) {
    return []
  }

  const caskNames = casks.map((app) => app.brewName)
  const command = BREW_COMMANDS.INSTALL_CASK(caskNames)

  consola.debug(
    `${config.dryRun ? '[DRY RUN] ' : ''}Installing ${casks.length} ${pluralize('cask', casks.length)}: ${caskNames.join(', ')}`,
  )

  consola.debug(`Command: ${command}`)

  // Use streamOutput=true to show real-time output during installation
  const result = await executeCommand(
    command,
    DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
    config.dryRun,
    true,
  )

  if (result.success) {
    return casks.map((app) => ({
      appName: app.originalName,
      dryRun: config.dryRun,
      packageName: app.brewName,
      success: true,
    }))
  }

  consola.error(`Failed to install casks: ${result.stderr}`)

  // In case of batch failure, mark all as failed
  return casks.map((app) => ({
    appName: app.originalName,
    dryRun: config.dryRun,
    error: result.stderr,
    packageName: app.brewName,
    success: false,
  }))
}
