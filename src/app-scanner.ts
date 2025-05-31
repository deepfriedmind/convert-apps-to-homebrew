/**
 * App scanner module for discovering macOS applications and checking Homebrew availability
 */

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  DEFAULT_CONFIG,
  FILE_PATTERNS,
} from './constants.ts'
import type {
  AppInfo,
  BrewCommandResult,
  ScannerConfig,
} from './types.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import {
  createLogger,
  extractAppName,
  normalizeAppName,
  parseCommandOutput,
} from './utils.ts'

const execAsync = promisify(exec)

/**
 * Check if apps are already installed via Homebrew
 */
export async function checkAlreadyInstalled(apps: AppInfo[]): Promise<AppInfo[]> {
  const [installedCasks, installedFormulas] = await Promise.all([
    getInstalledCasks(),
    getInstalledFormulas(),
  ])

  const installedCaskSet = new Set(installedCasks)
  const installedFormulaSet = new Set(installedFormulas)

  return apps.map(app => ({
    ...app,
    alreadyInstalled: (
      (app.brewType === 'cask' && installedCaskSet.has(app.brewName))
      || (app.brewType === 'formula' && installedFormulaSet.has(app.brewName))
    ),
    status: (
      (app.brewType === 'cask' && installedCaskSet.has(app.brewName))
      || (app.brewType === 'formula' && installedFormulaSet.has(app.brewName))
    ) ?
      'already-installed'
      : app.status,
  }))
}

/**
 * Check if Homebrew is installed and accessible
 */
export async function checkHomebrewInstalled(): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.VERSION)

  return result.success
}

/**
 * Determine the Homebrew package type and availability for an app
 */
export async function determinePackageInfo(_appName: string, brewName: string): Promise<{
  alreadyInstalled: boolean
  brewType: 'cask' | 'formula' | 'unavailable'
}> {
  // Check if it's available as a cask first (most common for GUI apps)
  const isCask = await isCaskAvailable(brewName)

  if (isCask) {
    return { alreadyInstalled: false, brewType: 'cask' }
  }

  // Check if it's available as a formula
  const isFormula = await isFormulaAvailable(brewName)

  if (isFormula) {
    return { alreadyInstalled: false, brewType: 'formula' }
  }

  return { alreadyInstalled: false, brewType: 'unavailable' }
}

/**
 * Main function to discover and analyze applications
 */
export async function discoverApps(config: ScannerConfig): Promise<AppInfo[]> {
  const logger = createLogger(config.verbose)

  logger.verbose('Starting app discovery...')

  // Check if Homebrew is installed
  const homebrewInstalled = await checkHomebrewInstalled()

  if (!homebrewInstalled) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED,
    )
  }

  logger.verbose('Homebrew installation verified')

  // Scan applications directory
  logger.verbose(`Scanning ${config.applicationsDir}...`)
  const appPaths = await scanApplicationsDirectory(config.applicationsDir)

  if (appPaths.length === 0) {
    logger.warn('No applications found in the Applications directory')

    return []
  }

  logger.verbose(`Found ${appPaths.length} applications`)

  // Process each application
  const apps: AppInfo[] = []
  const ignoredSet = new Set(config.ignoredApps.map(name => normalizeAppName(name)))

  for (const appPath of appPaths) {
    const originalName = extractAppName(appPath)
    const brewName = normalizeAppName(originalName)

    // Skip ignored apps
    if (ignoredSet.has(brewName)) {
      apps.push({
        alreadyInstalled: false,
        appPath,
        brewName,
        brewType: 'unavailable',
        originalName,
        status: 'ignored',
      })
      continue
    }

    logger.verbose(`Checking Homebrew availability for: ${originalName}`)

    try {
      const packageInfo = await determinePackageInfo(originalName, brewName)

      apps.push({
        alreadyInstalled: packageInfo.alreadyInstalled,
        appPath,
        brewName,
        brewType: packageInfo.brewType,
        originalName,
        status: packageInfo.brewType === 'unavailable' ? 'unavailable' : 'available',
      })
    }
    catch (error) {
      logger.warn(`Failed to check Homebrew availability for ${originalName}: ${error}`)
      apps.push({
        alreadyInstalled: false,
        appPath,
        brewName,
        brewType: 'unavailable',
        originalName,
        status: 'unavailable',
      })
    }
  }

  // Check which apps are already installed via Homebrew
  logger.verbose('Checking for already installed packages...')
  const appsWithInstallStatus = await checkAlreadyInstalled(apps)

  logger.info(`Discovery complete: ${appsWithInstallStatus.length} apps processed`)

  return appsWithInstallStatus
}

/**
 * Get list of installed Homebrew casks
 */
export async function getInstalledCasks(): Promise<string[]> {
  const result = await executeCommand(BREW_COMMANDS.LIST_CASKS)

  if (!result.success) {
    return []
  }

  return parseCommandOutput(result.stdout)
}

/**
 * Get list of installed Homebrew formulas (leaves only)
 */
export async function getInstalledFormulas(): Promise<string[]> {
  const result = await executeCommand(BREW_COMMANDS.LIST_FORMULAS)

  if (!result.success) {
    return []
  }

  return parseCommandOutput(result.stdout)
}

/**
 * Check if a package is available as a Homebrew cask
 */
export async function isCaskAvailable(packageName: string): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.INFO_CASK(packageName))

  return result.success
}

/**
 * Check if a package is available as a Homebrew formula
 */
export async function isFormulaAvailable(packageName: string): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.INFO_FORMULA(packageName))

  return result.success
}

/**
 * Scan the Applications directory for .app bundles
 */
export async function scanApplicationsDirectory(applicationsDir: string = DEFAULT_APPLICATIONS_DIR): Promise<string[]> {
  try {
    const entries = await fs.readdir(applicationsDir, { withFileTypes: true })

    return entries
      .filter(entry => entry.isDirectory() && FILE_PATTERNS.APP_PATTERN.test(entry.name))
      .map(entry => join(applicationsDir, entry.name))
  }
  catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new ConvertAppsError(
        `Applications directory not found: ${applicationsDir}`,
        ErrorType.FILE_NOT_FOUND,
        error,
      )
    }

    if (error.code === 'EACCES') {
      throw new ConvertAppsError(
        `Permission denied accessing: ${applicationsDir}`,
        ErrorType.PERMISSION_DENIED,
        error,
      )
    }
    throw new ConvertAppsError(
      `Failed to scan applications directory: ${error.message}`,
      ErrorType.UNKNOWN_ERROR,
      error,
    )
  }
}

/**
 * Execute a shell command and return structured result
 */
async function executeCommand(command: string, timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT): Promise<BrewCommandResult> {
  try {
    const { stderr, stdout } = await execAsync(command, { timeout })

    return {
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      success: true,
    }
  }
  catch (error: any) {
    return {
      exitCode: error.code || 1,
      stderr: error.stderr?.trim() || error.message || '',
      stdout: error.stdout?.trim() || '',
      success: false,
    }
  }
}
