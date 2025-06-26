#!/usr/bin/env node

import { consola } from 'consola'

import type {
  AppInfo,
  CommandOptions,
  InstallationResult,
  InstallerConfig,
  OperationSummary,
  ScannerConfig,
} from './types.ts'

import { discoverApps } from './app-scanner.ts'
import {
  displayTroubleshooting,
  displayWelcome,
  parseArguments,
  setupSignalHandlers,
  validateEnvironment,
} from './cli.ts'
import { EXIT_CODES, MESSAGES } from './constants.ts'
import {
  ProgressTracker,
  setupGlobalErrorHandlers,
} from './error-handler.ts'
import { installApps, validateInstallationPrerequisites } from './installer.ts'
import {
  displayFinalSummary,
  displayInstallationPlan,
  promptAppSelection,
} from './prompts.ts'
import { ConvertAppsError, ErrorType } from './types.ts'

/**
 * Create installer configuration from command options
 */
function createInstallerConfig(options: CommandOptions): InstallerConfig {
  return {
    dryRun: options.dryRun,
    verbose: options.verbose,
  }
}

/**
 * Create scanner configuration from command options
 */
function createScannerConfig(options: CommandOptions): ScannerConfig {
  return {
    applicationsDir: options.applicationsDir,
    ...(options.fallbackToCli !== undefined && { fallbackToCli: options.fallbackToCli }),
    ...(options.forceRefreshCache !== undefined && { forceRefreshCache: options.forceRefreshCache }),
    ignoredApps: options.ignore,
    ...(options.matchingThreshold !== undefined && { matchingThreshold: options.matchingThreshold }),
    verbose: options.verbose,
  }
}

/**
 * Generate operation summary statistics
 */
function generateOperationSummary(
  allApps: AppInfo[],
  selectedApps: AppInfo[],
  installationResult: InstallationResult,
  dryRun: boolean,
): OperationSummary {
  const available = allApps.filter(app => app.status === 'available')
  const alreadyInstalled = allApps.filter(app => app.status === 'already-installed')
  const ignored = allApps.filter(app => app.status === 'ignored')
  const unavailable = allApps.filter(app => app.status === 'unavailable')

  return {
    alreadyInstalled: alreadyInstalled.length,
    availableApps: available.length,
    dryRun,
    failed: installationResult.failed.length,
    ignored: ignored.length,
    installed: installationResult.installed.length,
    selected: selectedApps.length,
    totalApps: allApps.length,
    unavailable: unavailable.length,
  }
}

/**
 * Handle application errors with appropriate exit codes
 */
function handleError(error: Error): never {
  if (error instanceof ConvertAppsError) {
    /* eslint-disable no-fallthrough */
    switch (error.type) {
      case ErrorType.COMMAND_FAILED: {
        consola.error(`Command execution failed: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.FILE_NOT_FOUND: {
        consola.error(`File not found: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.HOMEBREW_NOT_INSTALLED: {
        consola.error(MESSAGES.HOMEBREW_NOT_INSTALLED)
        displayTroubleshooting()
        process.exit(EXIT_CODES.HOMEBREW_NOT_INSTALLED)
      }

      case ErrorType.INVALID_INPUT: {
        consola.error(`Invalid input: ${error.message}`)
        process.exit(EXIT_CODES.INVALID_INPUT)
      }

      case ErrorType.NETWORK_ERROR: {
        consola.error(`Network error: ${error.message}`)
        process.exit(EXIT_CODES.NETWORK_ERROR)
      }

      case ErrorType.PERMISSION_DENIED: {
        consola.error(MESSAGES.PERMISSION_DENIED)
        consola.error(error.message)
        displayTroubleshooting()
        process.exit(EXIT_CODES.PERMISSION_DENIED)
      }

      case ErrorType.UNKNOWN_ERROR: {
        consola.error(`Unknown error: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      default: {
        consola.error(`Error: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }
    }
    /* eslint-enable no-fallthrough */
  }

  consola.error(`Unexpected error: ${error.message}`)

  if (error.stack !== undefined) {
    consola.debug(error.stack)
  }

  process.exit(EXIT_CODES.GENERAL_ERROR)
}

/**
 * Main application function
 */
async function main(): Promise<void> {
  try {
    // Set up signal handlers for graceful shutdown
    setupSignalHandlers()

    // Validate runtime environment
    validateEnvironment()

    // Parse command line arguments
    const options = parseArguments()

    // Configure consola log level based on verbose flag
    consola.level = options.verbose ? 4 : 3

    // Set up enhanced error handling
    setupGlobalErrorHandlers(options.verbose)
    const progressTracker = new ProgressTracker()

    // Display welcome message
    displayWelcome(options)

    // Validate prerequisites
    progressTracker.startOperation('validating prerequisites')
    await validateInstallationPrerequisites()
    progressTracker.completeOperation('Prerequisites validation')

    // Discover applications
    const scannerConfig = createScannerConfig(options)
    const discoveredApps = await discoverApps(scannerConfig)
    progressTracker.completeOperation('Application scanning')

    if (discoveredApps.length === 0) {
      consola.warn(MESSAGES.NO_APPS_FOUND)
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Interactive app selection
    const selectedApps = await promptAppSelection(discoveredApps)

    if (selectedApps.length === 0) {
      consola.info(MESSAGES.NO_APPS_SELECTED)
      consola.info('Run the command again to select different apps.')
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Display installation plan
    displayInstallationPlan(selectedApps, options.dryRun)

    // Perform installation
    const operationType = options.dryRun ? 'dry run' : 'installation'
    progressTracker.startOperation(`package ${operationType}`, selectedApps.length)
    const installerConfig = createInstallerConfig(options)
    const installationResult = await installApps(selectedApps, installerConfig)
    progressTracker.completeOperation(`Package ${operationType}`, installationResult.failed.length === 0)

    // Display final summary
    const installedApps = selectedApps.filter(app =>
      installationResult.installed.some(result => result.packageName === app.brewName),
    )

    const failedApps = selectedApps.filter(app =>
      installationResult.failed.some(result => result.packageName === app.brewName),
    )

    displayFinalSummary(selectedApps, installedApps, failedApps, options.dryRun)

    // Generate operation summary
    const summary = generateOperationSummary(
      discoveredApps,
      selectedApps,
      installationResult,
      options.dryRun ?? false,
    )

    consola.debug(`Operation summary: ${JSON.stringify(summary, null, 2)}`)

    // Exit with appropriate code
    if (installationResult.failed.length > 0) {
      consola.warn(`${installationResult.failed.length} installations failed.`)
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
    else {
      process.exit(EXIT_CODES.SUCCESS)
    }
  }
  catch (error: unknown) {
    // Handle user cancellation gracefully
    if (error instanceof Error && error.name === 'ExitPromptError') {
      consola.info('\nOperation cancelled by user.')
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Handle other errors
    const errorToHandle = error instanceof Error ? error : new Error(String(error))
    handleError(errorToHandle)
  }
}

/**
 * Entry point with error handling
 */
// Check if this module is being run directly (ES module equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    consola.error(`Fatal error: ${errorMessage}`)

    // Show troubleshooting info for common issues
    if (errorMessage.includes('Homebrew')
      || errorMessage.includes('permission')
      || errorMessage.includes('ENOENT')) {
      displayTroubleshooting()
    }

    process.exit(EXIT_CODES.GENERAL_ERROR)
  })
}

// Export main function for testing
export { main }
