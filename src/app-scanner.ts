/**
 * App scanner module for discovering macOS applications and checking Homebrew availability
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import {
  AppInfo,
  BrewCommandResult,
  ScannerConfig,
  ConvertAppsError,
  ErrorType
} from './types';
import {
  DEFAULT_APPLICATIONS_DIR,
  BREW_COMMANDS,
  FILE_PATTERNS,
  DEFAULT_CONFIG
} from './constants';
import {
  normalizeAppName,
  extractAppName,
  parseCommandOutput,
  createLogger
} from './utils';

const execAsync = promisify(exec);

/**
 * Execute a shell command and return structured result
 */
async function executeCommand(command: string, timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT): Promise<BrewCommandResult> {
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
 * Check if Homebrew is installed and accessible
 */
export async function checkHomebrewInstalled(): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.VERSION);
  return result.success;
}

/**
 * Get list of installed Homebrew casks
 */
export async function getInstalledCasks(): Promise<string[]> {
  const result = await executeCommand(BREW_COMMANDS.LIST_CASKS);
  if (!result.success) {
    return [];
  }
  return parseCommandOutput(result.stdout);
}

/**
 * Get list of installed Homebrew formulas (leaves only)
 */
export async function getInstalledFormulas(): Promise<string[]> {
  const result = await executeCommand(BREW_COMMANDS.LIST_FORMULAS);
  if (!result.success) {
    return [];
  }
  return parseCommandOutput(result.stdout);
}

/**
 * Check if a package is available as a Homebrew cask
 */
export async function isCaskAvailable(packageName: string): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.INFO_CASK(packageName));
  return result.success;
}

/**
 * Check if a package is available as a Homebrew formula
 */
export async function isFormulaAvailable(packageName: string): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.INFO_FORMULA(packageName));
  return result.success;
}

/**
 * Scan the Applications directory for .app bundles
 */
export async function scanApplicationsDirectory(applicationsDir: string = DEFAULT_APPLICATIONS_DIR): Promise<string[]> {
  try {
    const entries = await fs.readdir(applicationsDir, { withFileTypes: true });

    return entries
      .filter(entry => entry.isDirectory() && FILE_PATTERNS.APP_PATTERN.test(entry.name))
      .map(entry => join(applicationsDir, entry.name));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new ConvertAppsError(
        `Applications directory not found: ${applicationsDir}`,
        ErrorType.FILE_NOT_FOUND,
        error
      );
    }
    if (error.code === 'EACCES') {
      throw new ConvertAppsError(
        `Permission denied accessing: ${applicationsDir}`,
        ErrorType.PERMISSION_DENIED,
        error
      );
    }
    throw new ConvertAppsError(
      `Failed to scan applications directory: ${error.message}`,
      ErrorType.UNKNOWN_ERROR,
      error
    );
  }
}

/**
 * Determine the Homebrew package type and availability for an app
 */
export async function determinePackageInfo(_appName: string, brewName: string): Promise<{
  brewType: 'cask' | 'formula' | 'unavailable';
  alreadyInstalled: boolean;
}> {
  // Check if it's available as a cask first (most common for GUI apps)
  const isCask = await isCaskAvailable(brewName);
  if (isCask) {
    return { brewType: 'cask', alreadyInstalled: false };
  }

  // Check if it's available as a formula
  const isFormula = await isFormulaAvailable(brewName);
  if (isFormula) {
    return { brewType: 'formula', alreadyInstalled: false };
  }

  return { brewType: 'unavailable', alreadyInstalled: false };
}

/**
 * Check if apps are already installed via Homebrew
 */
export async function checkAlreadyInstalled(apps: AppInfo[]): Promise<AppInfo[]> {
  const [installedCasks, installedFormulas] = await Promise.all([
    getInstalledCasks(),
    getInstalledFormulas()
  ]);

  const installedCaskSet = new Set(installedCasks);
  const installedFormulaSet = new Set(installedFormulas);

  return apps.map(app => ({
    ...app,
    alreadyInstalled: (
      (app.brewType === 'cask' && installedCaskSet.has(app.brewName)) ||
      (app.brewType === 'formula' && installedFormulaSet.has(app.brewName))
    ),
    status: (
      (app.brewType === 'cask' && installedCaskSet.has(app.brewName)) ||
      (app.brewType === 'formula' && installedFormulaSet.has(app.brewName))
    ) ? 'already-installed' : app.status
  }));
}

/**
 * Main function to discover and analyze applications
 */
export async function discoverApps(config: ScannerConfig): Promise<AppInfo[]> {
  const logger = createLogger(config.verbose);

  logger.verbose('Starting app discovery...');

  // Check if Homebrew is installed
  const homebrewInstalled = await checkHomebrewInstalled();
  if (!homebrewInstalled) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED
    );
  }

  logger.verbose('Homebrew installation verified');

  // Scan applications directory
  logger.verbose(`Scanning ${config.applicationsDir}...`);
  const appPaths = await scanApplicationsDirectory(config.applicationsDir);

  if (appPaths.length === 0) {
    logger.warn('No applications found in the Applications directory');
    return [];
  }

  logger.verbose(`Found ${appPaths.length} applications`);

  // Process each application
  const apps: AppInfo[] = [];
  const ignoredSet = new Set(config.ignoredApps.map(name => normalizeAppName(name)));

  for (const appPath of appPaths) {
    const originalName = extractAppName(appPath);
    const brewName = normalizeAppName(originalName);

    // Skip ignored apps
    if (ignoredSet.has(brewName)) {
      apps.push({
        originalName,
        brewName,
        appPath,
        brewType: 'unavailable',
        status: 'ignored',
        alreadyInstalled: false
      });
      continue;
    }

    logger.verbose(`Checking Homebrew availability for: ${originalName}`);

    try {
      const packageInfo = await determinePackageInfo(originalName, brewName);

      apps.push({
        originalName,
        brewName,
        appPath,
        brewType: packageInfo.brewType,
        status: packageInfo.brewType === 'unavailable' ? 'unavailable' : 'available',
        alreadyInstalled: packageInfo.alreadyInstalled
      });
    } catch (error) {
      logger.warn(`Failed to check Homebrew availability for ${originalName}: ${error}`);
      apps.push({
        originalName,
        brewName,
        appPath,
        brewType: 'unavailable',
        status: 'unavailable',
        alreadyInstalled: false
      });
    }
  }

  // Check which apps are already installed via Homebrew
  logger.verbose('Checking for already installed packages...');
  const appsWithInstallStatus = await checkAlreadyInstalled(apps);

  logger.info(`Discovery complete: ${appsWithInstallStatus.length} apps processed`);

  return appsWithInstallStatus;
}
