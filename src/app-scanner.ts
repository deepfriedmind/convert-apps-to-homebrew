/**
 * App scanner module for discovering macOS applications and checking Homebrew availability
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type {
  AppInfo,
  ScannerConfig,
} from './types.ts'

import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  FILE_PATTERNS,
} from './constants.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import {
  createLogger,
  executeCommand,
  extractAppName,
  normalizeAppName,
  parseCommandOutput,
} from './utils.ts'

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
  logger.verbose('Getting list of already installed Homebrew packages...')

  const [installedCasks, installedFormulas] = await Promise.all([
    getInstalledCasks(),
    getInstalledFormulas(),
  ])
  const installedCaskSet = new Set(installedCasks)
  const installedFormulaSet = new Set(installedFormulas)

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

    // Check if already installed first to avoid unnecessary API calls
    const isAlreadyInstalledCask = installedCaskSet.has(brewName)
    const isAlreadyInstalledFormula = installedFormulaSet.has(brewName)

    if (isAlreadyInstalledCask) {
      apps.push({
        alreadyInstalled: true,
        appPath,
        brewName,
        brewType: 'cask',
        originalName,
        status: 'already-installed',
      })
      continue
    }

    if (isAlreadyInstalledFormula) {
      apps.push({
        alreadyInstalled: true,
        appPath,
        brewName,
        brewType: 'formula',
        originalName,
        status: 'already-installed',
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
      logger.warn(`Failed to check Homebrew availability for ${originalName}: ${String(error)}`)
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

  logger.info(`Discovery complete: ${apps.length} apps processed`)

  return apps
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
export async function scanApplicationsDirectory(applicationsDirectory: string = DEFAULT_APPLICATIONS_DIR): Promise<string[]> {
  try {
    const entries = await fs.readdir(applicationsDirectory, { withFileTypes: true })

    return entries
      .filter(entry => entry.isDirectory() && FILE_PATTERNS.APP_PATTERN.test(entry.name))
      .map(entry => path.join(applicationsDirectory, entry.name))
  }
  catch (error: unknown) {
    const typedError = error as { code?: string, message?: string }

    if (typedError.code === 'ENOENT') {
      throw new ConvertAppsError(
        `Applications directory not found: ${applicationsDirectory}`,
        ErrorType.FILE_NOT_FOUND,
        error instanceof Error ? error : undefined,
      )
    }

    if (typedError.code === 'EACCES') {
      throw new ConvertAppsError(
        `Permission denied accessing: ${applicationsDirectory}`,
        ErrorType.PERMISSION_DENIED,
        error instanceof Error ? error : undefined,
      )
    }
    throw new ConvertAppsError(
      `Failed to scan applications directory: ${typedError.message ?? 'Unknown error'}`,
      ErrorType.UNKNOWN_ERROR,
      error instanceof Error ? error : undefined,
    )
  }
}
