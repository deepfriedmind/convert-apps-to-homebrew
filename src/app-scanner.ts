/**
 * App scanner module for discovering macOS applications and checking Homebrew availability
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import { AppMatcher } from './app-matcher.ts'
import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  FILE_PATTERNS,
} from './constants.ts'
import { fetchHomebrewCasks } from './homebrew-api.ts'
import { getMacAppStoreApps, isAppFromMacAppStore } from './mas-integration.ts'
import type {
  AppInfo,
  HomebrewCask,
  MasAppInfo,
  ScannerConfig,
} from './types.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import {
  executeCommand,
  extractAppName,
  normalizeAppName,
  parseCommandOutput,
  shouldIgnoreApp,
} from './utils.ts'

/**
 * Main function to discover and analyze applications
 */
export async function discoverApps(config: ScannerConfig): Promise<AppInfo[]> {
  await validateHomebrewInstallation()

  const masApps = await initializeMacAppStoreIntegration()
  const appPaths = await getApplicationPaths(config.applicationsDir)
  const installedCaskSet = await getInstalledCaskSet()

  const apps = createInitialAppInfoList(
    appPaths,
    config,
    masApps,
    installedCaskSet,
  )
  await processUnresolvedApps(apps, config, installedCaskSet)

  consola.ready(`Discovery complete: ${apps.length} apps processed`)
  return apps
}

/**
 * Validate that Homebrew is installed and accessible
 */
async function validateHomebrewInstallation(): Promise<void> {
  const homebrewInstalled = await checkHomebrewInstalled()

  if (!homebrewInstalled) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED,
    )
  }

  consola.debug('Homebrew installation verified')
}

/**
 * Initialize Mac App Store integration and return available apps
 */
async function initializeMacAppStoreIntegration(): Promise<MasAppInfo[]> {
  const masResult = await getMacAppStoreApps()
  const masApps = masResult.success ? masResult.apps : []

  if (masResult.masInstalled) {
    consola.debug(
      `Mac App Store integration enabled: found ${masApps.length} installed apps`,
    )
  } else {
    consola.debug(
      'Mac App Store integration not available (mas CLI not installed)',
    )
  }

  return masApps
}

/**
 * Get application paths from the Applications directory
 */
async function getApplicationPaths(
  applicationsDir?: string,
): Promise<string[]> {
  const appPaths = await scanApplicationsDirectory(applicationsDir)

  if (appPaths.length === 0) {
    consola.warn('No applications found in the Applications directory')
    return []
  }

  consola.debug(`Found ${appPaths.length} applications`)
  return appPaths
}

/**
 * Get set of already installed Homebrew casks
 */
async function getInstalledCaskSet(): Promise<Set<string>> {
  consola.debug('Getting list of already installed Homebrew casks...')
  const installedCasks = await getInstalledCasks()
  return new Set(installedCasks)
}

/**
 * Create initial app info objects for all discovered applications
 */
function createInitialAppInfoList(
  appPaths: string[],
  config: ScannerConfig,
  masApps: MasAppInfo[],
  installedCaskSet: Set<string>,
): AppInfo[] {
  const apps: AppInfo[] = []

  for (const appPath of appPaths) {
    const appInfo = createAppInfo(appPath, config, masApps, installedCaskSet)
    apps.push(appInfo)
  }

  return apps
}

/**
 * Create app info object for a single application
 */
function createAppInfo(
  appPath: string,
  config: ScannerConfig,
  masApps: MasAppInfo[],
  installedCaskSet: Set<string>,
): AppInfo {
  const originalName = extractAppName(appPath)
  const brewName = normalizeAppName(originalName)
  const fromMacAppStore = isAppFromMacAppStore(originalName, masApps)

  const baseAppInfo = {
    appPath,
    brewName,
    fromMacAppStore,
    originalName,
  }

  // Check if app should be ignored
  if (shouldIgnoreApp(originalName, brewName, config.ignoredApps)) {
    return {
      ...baseAppInfo,
      alreadyInstalled: false,
      brewType: 'unavailable' as const,
      status: 'ignored' as const,
    }
  }

  // Check if Mac App Store app should be ignored
  if (config.ignoreAppStore && fromMacAppStore) {
    return {
      ...baseAppInfo,
      alreadyInstalled: false,
      brewType: 'unavailable' as const,
      status: 'ignored' as const,
    }
  }

  // Check if already installed
  if (installedCaskSet.has(brewName)) {
    return {
      ...baseAppInfo,
      alreadyInstalled: true,
      brewType: 'cask' as const,
      status: 'already-installed' as const,
    }
  }

  // Default: needs to be processed
  return {
    ...baseAppInfo,
    alreadyInstalled: false,
    brewType: 'unavailable' as const,
    status: 'unavailable' as const,
  }
}

/**
 * Process apps that need Homebrew availability checking
 */
async function processUnresolvedApps(
  apps: AppInfo[],
  config: ScannerConfig,
  installedCaskSet: Set<string>,
): Promise<void> {
  const appsToCheck = apps.filter((app) => app.status === 'unavailable')

  if (appsToCheck.length === 0) {
    return
  }

  consola.debug(
    `Batch checking Homebrew availability for ${appsToCheck.length} apps...`,
  )

  if (config.fallbackToCli) {
    consola.debug('Using individual brew commands as requested')
    await procesAppsIndividually(appsToCheck)
  } else {
    await processBatchMatching(appsToCheck, config, installedCaskSet)
  }
}

/**
 * Process apps using batch matching with Homebrew API
 */
async function processBatchMatching(
  appsToCheck: AppInfo[],
  config: ScannerConfig,
  installedCaskSet: Set<string>,
): Promise<void> {
  try {
    const caskResult = await fetchHomebrewCasks(config.forceRefreshCache, true)

    if (caskResult.success && caskResult.data) {
      performBatchMatching(
        appsToCheck,
        config,
        caskResult.data,
        installedCaskSet,
      )
    } else {
      consola.warn(
        'Failed to fetch Homebrew cask database, falling back to individual commands',
      )
      await procesAppsIndividually(appsToCheck)
    }
  } catch (error) {
    consola.warn(
      `Error during batch processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    consola.warn('Falling back to individual brew commands')
    await procesAppsIndividually(appsToCheck)
  }
}

/**
 * Perform batch matching using AppMatcher
 */
function performBatchMatching(
  appsToCheck: AppInfo[],
  config: ScannerConfig,
  caskData: HomebrewCask[],
  installedCaskSet: Set<string>,
): void {
  const matchingConfig = {
    enableBundleIdLookup: true,
    enableFuzzyMatching: true,
    maxMatches: 5,
    minConfidence: config.matchingThreshold ?? 0.6,
  }

  const matcher = new AppMatcher(matchingConfig)
  const index = matcher.buildIndex(caskData)
  const matchResults = matcher.matchApps(appsToCheck, index)

  for (const matchResult of matchResults) {
    updateAppWithMatchResult(matchResult, installedCaskSet)
  }
}

/**
 * Update app info based on match result
 */
function updateAppWithMatchResult(
  matchResult: {
    appInfo: AppInfo
    bestMatch?: { cask: { token: string; desc: string; homepage: string } }
  },
  installedCaskSet: Set<string>,
): void {
  const app = matchResult.appInfo

  if (matchResult.bestMatch) {
    const matchedCaskName = matchResult.bestMatch.cask.token
    const matchedCaskDescription = matchResult.bestMatch.cask.desc
    const matchedCaskHomepage = matchResult.bestMatch.cask.homepage

    if (installedCaskSet.has(matchedCaskName)) {
      app.alreadyInstalled = true
      app.brewType = 'cask'
      app.status = 'already-installed'
      app.brewName = matchedCaskName
      app.description = matchedCaskDescription
      app.homepage = matchedCaskHomepage
    } else {
      app.alreadyInstalled = false
      app.brewType = 'cask'
      app.status = 'available'
      app.brewName = matchedCaskName
      app.description = matchedCaskDescription
      app.homepage = matchedCaskHomepage
    }
  } else {
    app.brewType = 'unavailable'
    app.status = 'unavailable'
  }
}

/**
 * Check if Homebrew is installed and accessible
 */
async function checkHomebrewInstalled(): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.VERSION)

  return result.success
}

/**
 * Determine the Homebrew package type and availability for an app
 */
async function determinePackageInfo(
  _appName: string,
  brewName: string,
): Promise<{
  alreadyInstalled: boolean
  brewType: 'cask' | 'unavailable'
}> {
  const isCask = await isCaskAvailable(brewName)

  if (isCask) {
    return { alreadyInstalled: false, brewType: 'cask' }
  }

  return { alreadyInstalled: false, brewType: 'unavailable' }
}

/**
 * Get list of installed Homebrew casks
 */
async function getInstalledCasks(): Promise<string[]> {
  const result = await executeCommand(BREW_COMMANDS.LIST_CASKS)

  if (!result.success) {
    return []
  }

  return parseCommandOutput(result.stdout)
}

/**
 * Check if a package is available as a Homebrew cask
 */
async function isCaskAvailable(packageName: string): Promise<boolean> {
  const result = await executeCommand(BREW_COMMANDS.INFO_CASK(packageName))

  return result.success
}

/**
 * Fallback function to process apps individually using brew commands
 */
async function procesAppsIndividually(apps: AppInfo[]): Promise<void> {
  await Promise.all(
    apps.map(async (app) => {
      consola.debug(`Checking Homebrew availability for: ${app.originalName}`)

      try {
        const packageInfo = await determinePackageInfo(
          app.originalName,
          app.brewName,
        )

        app.alreadyInstalled = packageInfo.alreadyInstalled
        app.brewType = packageInfo.brewType
        app.status =
          packageInfo.brewType === 'unavailable' ? 'unavailable' : 'available'
      } catch (error) {
        consola.warn(
          `Failed to check Homebrew availability for ${app.originalName}: ${String(error)}`,
        )
        app.alreadyInstalled = false
        app.brewType = 'unavailable'
        app.status = 'unavailable'
      }
    }),
  )
}

/**
 * Scan the Applications directory for .app bundles
 */
async function scanApplicationsDirectory(
  applicationsDirectory: string = DEFAULT_APPLICATIONS_DIR,
): Promise<string[]> {
  try {
    const entries = await fs.readdir(applicationsDirectory, {
      withFileTypes: true,
    })

    return entries
      .filter(
        (entry) =>
          entry.isDirectory() && FILE_PATTERNS.APP_PATTERN.test(entry.name),
      )
      .map((entry) => path.join(applicationsDirectory, entry.name))
  } catch (error: unknown) {
    const typedError = error as { code?: string; message?: string }

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
