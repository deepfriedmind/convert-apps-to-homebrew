#!/usr/bin/env node

/**
 * Main entry point for convert-apps-to-homebrew
 * Orchestrates the entire application flow
 */

import type {
  AppInfo,
  CommandOptions,
  InstallationResult,
  InstallerConfig,
  Logger,
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
import { getInstallationSummary, installApps, validateInstallationPrerequisites } from './installer.ts'
import {
  displayFinalSummary,
  displayInstallationPlan,
  promptAppSelection,
  promptConfirmation,
  promptSudoPassword,
} from './prompts.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import { createLogger } from './utils.ts'

/**
 * Create installer configuration from command options and sudo password
 */
function createInstallerConfig(options: CommandOptions, sudoPassword?: string): InstallerConfig {
  const config: InstallerConfig = {
    dryRun: options.dryRun || false,
    verbose: options.verbose || false,
  }

  if (sudoPassword !== undefined) {
    config.sudoPassword = sudoPassword
  }

  return config
}

/**
 * Create scanner configuration from command options
 */
function createScannerConfig(options: CommandOptions): ScannerConfig {
  return {
    applicationsDir: options.applicationsDir ?? '/Applications',
    ...(options.fallbackToCli !== undefined && { fallbackToCli: options.fallbackToCli }),
    ...(options.forceRefreshCache !== undefined && { forceRefreshCache: options.forceRefreshCache }),
    ignoredApps: options.ignore ?? [],
    ...(options.matchingThreshold !== undefined && { matchingThreshold: options.matchingThreshold }),
    verbose: options.verbose ?? false,
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
function handleError(error: Error, logger: Logger): never {
  if (error instanceof ConvertAppsError) {
    /* eslint-disable no-fallthrough */
    switch (error.type) {
      case ErrorType.COMMAND_FAILED: {
        logger.error(`Command execution failed: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.FILE_NOT_FOUND: {
        logger.error(`File not found: ${error.message}`)
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.HOMEBREW_NOT_INSTALLED: {
        logger.error(MESSAGES.HOMEBREW_NOT_INSTALLED)
        logger.info('Install Homebrew: https://brew.sh/')
        process.exit(EXIT_CODES.HOMEBREW_NOT_INSTALLED)
      }

      case ErrorType.INVALID_INPUT: {
        logger.error(`Invalid input: ${error.message}`)
        process.exit(EXIT_CODES.INVALID_INPUT)
      }

      case ErrorType.NETWORK_ERROR: {
        logger.error('Network error occurred. Please check your internet connection.')
        process.exit(EXIT_CODES.NETWORK_ERROR)
      }

      case ErrorType.PERMISSION_DENIED: {
        logger.error(MESSAGES.PERMISSION_DENIED)
        logger.info('Try running with appropriate permissions or check file access.')
        process.exit(EXIT_CODES.PERMISSION_DENIED)
      }

      case ErrorType.UNKNOWN_ERROR: {
        logger.error(`Unknown error: ${error.message}`)

        if (error.originalError !== undefined) {
          logger.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      default: {
        logger.error(`Application error: ${error.message}`)

        if (error.originalError !== undefined) {
          logger.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
      }
    }
    /* eslint-enable no-fallthrough */
  }

  logger.error(`Unexpected error: ${error.message}`)

  if (error.stack !== undefined) {
    logger.debug(error.stack)
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
    const logger = createLogger(options.verbose ?? false)

    // Set up enhanced error handling
    setupGlobalErrorHandlers(options.verbose ?? false)
    const progressTracker = new ProgressTracker(options.verbose ?? false)

    // Display welcome message
    displayWelcome(options)

    // Validate prerequisites
    progressTracker.startOperation('Validating prerequisites')
    await validateInstallationPrerequisites()
    progressTracker.completeOperation('Prerequisites validation')

    // Discover applications
    if (options.verbose) {
      progressTracker.startOperation('Scanning applications')
      logger.info(MESSAGES.SCANNING_APPS)
    }

    const scannerConfig = createScannerConfig(options)
    const discoveredApps = await discoverApps(scannerConfig)

    if (options.verbose) {
      progressTracker.completeOperation('Application scanning')
    }

    if (discoveredApps.length === 0) {
      logger.warn(MESSAGES.NO_APPS_FOUND)
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Interactive app selection
    const selectedApps = await promptAppSelection(discoveredApps, options)

    if (selectedApps.length === 0) {
      logger.info(MESSAGES.NO_APPS_SELECTED)
      logger.info('Run the command again to select different apps.')
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Get sudo password if needed
    const sudoPassword = await promptSudoPassword(selectedApps)

    // Display installation plan
    displayInstallationPlan(selectedApps, sudoPassword, options.dryRun)

    // Confirm before proceeding
    const confirmed = await promptConfirmation(options.dryRun)

    if (!confirmed) {
      logger.info(MESSAGES.OPERATION_CANCELLED)
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Perform installation
    const operationType = options.dryRun ? 'dry run' : 'installation'
    progressTracker.startOperation(`Package ${operationType}`, selectedApps.length)
    logger.info(options.dryRun ? 'Starting dry run...' : MESSAGES.INSTALLING_PACKAGES)
    const installerConfig = createInstallerConfig(options, sudoPassword)
    const installationResult = await installApps(selectedApps, installerConfig)
    progressTracker.completeOperation(`Package ${operationType}`, installationResult.failed.length === 0)

    // Display results
    console.log(`\n${getInstallationSummary(installationResult)}`)

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

    logger.verbose(`Operation summary: ${JSON.stringify(summary, null, 2)}`)

    // Exit with appropriate code
    if (installationResult.failed.length > 0) {
      logger.warn(`${installationResult.failed.length} installations failed.`)
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
    else {
      logger.info(MESSAGES.OPERATION_COMPLETE)
      process.exit(EXIT_CODES.SUCCESS)
    }
  }
  catch (error: unknown) {
    const logger = createLogger(false)

    // Handle user cancellation gracefully
    if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.info('\nOperation cancelled by user.')
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Handle other errors
    const errorToHandle = error instanceof Error ? error : new Error(String(error))
    handleError(errorToHandle, logger)
  }
}

/**
 * Entry point with error handling
 */
// Check if this module is being run directly (ES module equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const logger = createLogger(false)
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Fatal error: ${errorMessage}`)

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
