#!/usr/bin/env node

/**
 * Main entry point for convert-apps-to-homebrew
 * Orchestrates the entire application flow
 */

import {
  parseArguments,
  displayWelcome,
  displayTroubleshooting,
  setupSignalHandlers,
  validateEnvironment
} from './cli';
import { discoverApps } from './app-scanner';
import {
  promptAppSelection,
  promptSudoPassword,
  displayInstallationPlan,
  promptConfirmation,
  displayFinalSummary
} from './prompts';
import { installApps, validateInstallationPrerequisites, getInstallationSummary } from './installer';
import {
  CommandOptions,
  ScannerConfig,
  InstallerConfig,
  ConvertAppsError,
  ErrorType,
  OperationSummary
} from './types';
import { EXIT_CODES, MESSAGES } from './constants';
import { createLogger } from './utils';
import {
  ProgressTracker,
  setupGlobalErrorHandlers
} from './error-handler';

/**
 * Create scanner configuration from command options
 */
function createScannerConfig(options: CommandOptions): ScannerConfig {
  return {
    applicationsDir: options.applicationsDir || '/Applications',
    ignoredApps: options.ignore || [],
    verbose: options.verbose || false
  };
}

/**
 * Create installer configuration from command options and sudo password
 */
function createInstallerConfig(options: CommandOptions, sudoPassword?: string): InstallerConfig {
  const config: InstallerConfig = {
    dryRun: options.dryRun || false,
    verbose: options.verbose || false
  };

  if (sudoPassword !== undefined) {
    config.sudoPassword = sudoPassword;
  }

  return config;
}

/**
 * Generate operation summary statistics
 */
function generateOperationSummary(
  allApps: any[],
  selectedApps: any[],
  installationResult: any,
  dryRun: boolean
): OperationSummary {
  const available = allApps.filter(app => app.status === 'available');
  const alreadyInstalled = allApps.filter(app => app.status === 'already-installed');
  const ignored = allApps.filter(app => app.status === 'ignored');
  const unavailable = allApps.filter(app => app.status === 'unavailable');

  return {
    totalApps: allApps.length,
    availableApps: available.length,
    alreadyInstalled: alreadyInstalled.length,
    ignored: ignored.length,
    unavailable: unavailable.length,
    selected: selectedApps.length,
    installed: installationResult.installed.length,
    failed: installationResult.failed.length,
    dryRun
  };
}

/**
 * Handle application errors with appropriate exit codes
 */
function handleError(error: Error, logger: any): never {
  if (error instanceof ConvertAppsError) {
    switch (error.type) {
      case ErrorType.HOMEBREW_NOT_INSTALLED:
        logger.error(MESSAGES.HOMEBREW_NOT_INSTALLED);
        logger.info('Install Homebrew: https://brew.sh/');
        process.exit(EXIT_CODES.HOMEBREW_NOT_INSTALLED);

      case ErrorType.PERMISSION_DENIED:
        logger.error(MESSAGES.PERMISSION_DENIED);
        logger.info('Try running with appropriate permissions or check file access.');
        process.exit(EXIT_CODES.PERMISSION_DENIED);

      case ErrorType.NETWORK_ERROR:
        logger.error('Network error occurred. Please check your internet connection.');
        process.exit(EXIT_CODES.NETWORK_ERROR);

      case ErrorType.INVALID_INPUT:
        logger.error(`Invalid input: ${error.message}`);
        process.exit(EXIT_CODES.INVALID_INPUT);

      default:
        logger.error(`Application error: ${error.message}`);
        if (error.originalError && logger.verbose) {
          logger.debug(`Original error: ${error.originalError.message}`);
        }
        process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  } else {
    logger.error(`Unexpected error: ${error.message}`);
    if (logger.verbose) {
      logger.debug(error.stack);
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

/**
 * Main application function
 */
async function main(): Promise<void> {
  try {
    // Set up signal handlers for graceful shutdown
    setupSignalHandlers();

    // Validate runtime environment
    validateEnvironment();

    // Parse command line arguments
    const options = parseArguments();
    const logger = createLogger(options.verbose || false);

    // Set up enhanced error handling
    setupGlobalErrorHandlers(options.verbose || false);
    const progressTracker = new ProgressTracker(options.verbose || false);

    // Display welcome message
    displayWelcome(options);

    // Validate prerequisites
    progressTracker.startOperation('Validating prerequisites');
    await validateInstallationPrerequisites();
    progressTracker.completeOperation('Prerequisites validation');

    // Discover applications
    progressTracker.startOperation('Scanning applications');
    logger.info(MESSAGES.SCANNING_APPS);
    const scannerConfig = createScannerConfig(options);
    const discoveredApps = await discoverApps(scannerConfig);
    progressTracker.completeOperation('Application scanning');

    if (discoveredApps.length === 0) {
      logger.warn(MESSAGES.NO_APPS_FOUND);
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Interactive app selection
    const selectedApps = await promptAppSelection(discoveredApps, options);

    if (selectedApps.length === 0) {
      logger.info(MESSAGES.NO_APPS_SELECTED);
      logger.info('Run the command again to select different apps.');
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Get sudo password if needed
    const sudoPassword = await promptSudoPassword(selectedApps);

    // Display installation plan
    displayInstallationPlan(selectedApps, sudoPassword, options.dryRun);

    // Confirm before proceeding
    const confirmed = await promptConfirmation(options.dryRun);
    if (!confirmed) {
      logger.info(MESSAGES.OPERATION_CANCELLED);
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Perform installation
    const operationType = options.dryRun ? 'dry run' : 'installation';
    progressTracker.startOperation(`Package ${operationType}`, selectedApps.length);
    logger.info(options.dryRun ? 'Starting dry run...' : MESSAGES.INSTALLING_PACKAGES);
    const installerConfig = createInstallerConfig(options, sudoPassword);
    const installationResult = await installApps(selectedApps, installerConfig);
    progressTracker.completeOperation(`Package ${operationType}`, installationResult.failed.length === 0);

    // Display results
    console.log('\n' + getInstallationSummary(installationResult));

    // Display final summary
    const installedApps = selectedApps.filter(app =>
      installationResult.installed.some(result => result.packageName === app.brewName)
    );
    const failedApps = selectedApps.filter(app =>
      installationResult.failed.some(result => result.packageName === app.brewName)
    );

    displayFinalSummary(selectedApps, installedApps, failedApps, options.dryRun);

    // Generate operation summary
    const summary = generateOperationSummary(
      discoveredApps,
      selectedApps,
      installationResult,
      options.dryRun || false
    );

    logger.verbose(`Operation summary: ${JSON.stringify(summary, null, 2)}`);

    // Exit with appropriate code
    if (installationResult.failed.length > 0) {
      logger.warn(`${installationResult.failed.length} installations failed.`);
      process.exit(EXIT_CODES.GENERAL_ERROR);
    } else {
      logger.info(MESSAGES.OPERATION_COMPLETE);
      process.exit(EXIT_CODES.SUCCESS);
    }

  } catch (error: any) {
    const logger = createLogger(false);

    // Handle user cancellation gracefully
    if (error.name === 'ExitPromptError') {
      logger.info('\nOperation cancelled by user.');
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Handle other errors
    handleError(error, logger);
  }
}

/**
 * Entry point with error handling
 */
if (require.main === module) {
  main().catch((error: Error) => {
    const logger = createLogger(false);
    logger.error(`Fatal error: ${error.message}`);

    // Show troubleshooting info for common issues
    if (error.message.includes('Homebrew') ||
      error.message.includes('permission') ||
      error.message.includes('ENOENT')) {
      displayTroubleshooting();
    }

    process.exit(EXIT_CODES.GENERAL_ERROR);
  });
}

// Export main function for testing
export { main };
