/**
 * Installation logic for Homebrew packages with dry-run support
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { ConvertAppsError, ErrorType } from './types.ts';
import type {
  AppInfo,
  InstallationResult,
  PackageInstallResult,
  InstallerConfig,
  BrewCommandResult,
  Logger
} from './types.ts';
import { BREW_COMMANDS, DEFAULT_CONFIG } from './constants.ts';
import { createLogger, groupBy, escapeShellArg } from './utils.ts';

const execAsync = promisify(exec);

/**
 * Execute a shell command with optional dry-run mode
 */
async function executeCommand(
  command: string,
  dryRun: boolean = false,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT
): Promise<BrewCommandResult> {
  if (dryRun) {
    return {
      exitCode: 0,
      stdout: `[DRY RUN] Would execute: ${command}`,
      stderr: '',
      success: true
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message || '',
      success: false
    };
  }
}

/**
 * Execute sudo command with password
 */
async function executeSudoCommand(
  command: string,
  password: string,
  dryRun: boolean = false,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT
): Promise<BrewCommandResult> {
  if (dryRun) {
    return {
      exitCode: 0,
      stdout: `[DRY RUN] Would execute with sudo: ${command}`,
      stderr: '',
      success: true
    };
  }

  try {
    // Use echo to pipe password to sudo
    const sudoCommand = `echo ${escapeShellArg(password)} | sudo -S ${command}`;
    const { stdout, stderr } = await execAsync(sudoCommand, { timeout });
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message || '',
      success: false
    };
  }
}

/**
 * Install Homebrew casks in batch
 */
async function installCasks(
  casks: AppInfo[],
  config: InstallerConfig,
  logger: Logger
): Promise<PackageInstallResult[]> {
  if (casks.length === 0) {
    return [];
  }

  const caskNames = casks.map(app => app.brewName);
  const command = BREW_COMMANDS.INSTALL_CASK(caskNames);

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Installing ${casks.length} cask(s): ${caskNames.join(', ')}`);
  logger.verbose(`Command: ${command}`);

  const result = await executeCommand(command, config.dryRun);

  if (result.success) {
    logger.info(`Successfully installed ${casks.length} cask(s)`);
    return casks.map(app => ({
      packageName: app.brewName,
      appName: app.originalName,
      success: true,
      dryRun: config.dryRun
    }));
  } else {
    logger.error(`Failed to install casks: ${result.stderr}`);
    // In case of batch failure, mark all as failed
    // In a more sophisticated implementation, we could try individual installations
    return casks.map(app => ({
      packageName: app.brewName,
      appName: app.originalName,
      success: false,
      error: result.stderr,
      dryRun: config.dryRun
    }));
  }
}

/**
 * Install Homebrew formulas in batch
 */
async function installFormulas(
  formulas: AppInfo[],
  config: InstallerConfig,
  logger: Logger
): Promise<PackageInstallResult[]> {
  if (formulas.length === 0) {
    return [];
  }

  const formulaNames = formulas.map(app => app.brewName);
  const command = BREW_COMMANDS.INSTALL_FORMULA(formulaNames);

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Installing ${formulas.length} formula(s): ${formulaNames.join(', ')}`);
  logger.verbose(`Command: ${command}`);

  const result = await executeCommand(command, config.dryRun);

  if (result.success) {
    logger.info(`Successfully installed ${formulas.length} formula(s)`);
    return formulas.map(app => ({
      packageName: app.brewName,
      appName: app.originalName,
      success: true,
      dryRun: config.dryRun
    }));
  } else {
    logger.error(`Failed to install formulas: ${result.stderr}`);
    return formulas.map(app => ({
      packageName: app.brewName,
      appName: app.originalName,
      success: false,
      error: result.stderr,
      dryRun: config.dryRun
    }));
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
  logger: Logger
): Promise<void> {
  const successfulCasks = installedCasks.filter(result => result.success);

  if (successfulCasks.length === 0) {
    logger.verbose('No successful cask installations to clean up');
    return;
  }

  logger.info(`${config.dryRun ? '[DRY RUN] ' : ''}Deleting ${successfulCasks.length} original .app file(s)`);

  for (const result of successfulCasks) {
    const app = caskApps.find(a => a.brewName === result.packageName);
    if (!app) {
      logger.warn(`Could not find app info for ${result.packageName}`);
      continue;
    }

    try {
      if (config.dryRun) {
        logger.verbose(`[DRY RUN] Would delete: ${app.appPath}`);
        continue;
      }

      // Check if the app file still exists
      try {
        await fs.access(app.appPath);
      } catch {
        logger.verbose(`App file already removed: ${app.appPath}`);
        continue;
      }

      // Delete the .app directory
      const deleteCommand = `rm -rf ${escapeShellArg(app.appPath)}`;
      const deleteResult = await executeSudoCommand(deleteCommand, sudoPassword, config.dryRun);

      if (deleteResult.success) {
        logger.verbose(`Deleted: ${app.appPath}`);
      } else {
        logger.warn(`Failed to delete ${app.appPath}: ${deleteResult.stderr}`);
      }
    } catch (error: any) {
      logger.warn(`Error deleting ${app.appPath}: ${error.message}`);
    }
  }
}

/**
 * Main installation function
 */
export async function installApps(
  selectedApps: AppInfo[],
  config: InstallerConfig
): Promise<InstallationResult> {
  const logger = createLogger(config.verbose);

  if (selectedApps.length === 0) {
    logger.info('No apps selected for installation');
    return {
      installed: [],
      failed: [],
      alreadyInstalled: [],
      ignored: [],
      unavailable: [],
      dryRun: config.dryRun
    };
  }

  // Group apps by type
  const appsByType = groupBy(selectedApps, app => app.brewType);
  const casks = appsByType['cask'] || [];
  const formulas = appsByType['formula'] || [];

  logger.info(`Starting installation: ${casks.length} cask(s), ${formulas.length} formula(s)`);

  const allResults: PackageInstallResult[] = [];

  try {
    // Install casks first
    if (casks.length > 0) {
      const caskResults = await installCasks(casks, config, logger);
      allResults.push(...caskResults);

      // Delete original .app files for successful cask installations
      if (config.sudoPassword && !config.dryRun) {
        await deleteOriginalApps(caskResults, casks, config.sudoPassword, config, logger);
      } else if (casks.length > 0 && !config.sudoPassword && !config.dryRun) {
        logger.warn('No sudo password provided - original .app files will not be deleted');
      }
    }

    // Install formulas
    if (formulas.length > 0) {
      const formulaResults = await installFormulas(formulas, config, logger);
      allResults.push(...formulaResults);
    }

    // Categorize results
    const installed = allResults.filter(result => result.success);
    const failed = allResults.filter(result => !result.success);

    logger.info(`Installation complete: ${installed.length} successful, ${failed.length} failed`);

    return {
      installed,
      failed,
      alreadyInstalled: [],
      ignored: [],
      unavailable: [],
      dryRun: config.dryRun
    };

  } catch (error: any) {
    logger.error(`Installation failed: ${error.message}`);

    throw new ConvertAppsError(
      `Installation process failed: ${error.message}`,
      ErrorType.COMMAND_FAILED,
      error
    );
  }
}

/**
 * Validate installation prerequisites
 */
export async function validateInstallationPrerequisites(): Promise<void> {
  // Check if Homebrew is available
  const brewCheck = await executeCommand(BREW_COMMANDS.VERSION, false, 5000);

  if (!brewCheck.success) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED
    );
  }
}

/**
 * Get installation summary for display
 */
export function getInstallationSummary(result: InstallationResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push('🔍 DRY RUN SUMMARY');
    lines.push('═'.repeat(50));
  } else {
    lines.push('📊 INSTALLATION SUMMARY');
    lines.push('═'.repeat(50));
  }

  if (result.installed.length > 0) {
    lines.push(`✅ Successfully installed: ${result.installed.length}`);
    result.installed.forEach(app => {
      lines.push(`   • ${app.appName} (${app.packageName})`);
    });
  }

  if (result.failed.length > 0) {
    lines.push(`❌ Failed to install: ${result.failed.length}`);
    result.failed.forEach(app => {
      lines.push(`   • ${app.appName} (${app.packageName}): ${app.error || 'Unknown error'}`);
    });
  }

  if (result.installed.length === 0 && result.failed.length === 0) {
    lines.push('⚠️  No packages were processed');
  }

  return lines.join('\n');
}
