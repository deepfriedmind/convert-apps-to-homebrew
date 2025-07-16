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
import type { AppInfo, ScannerConfig } from './types.ts'
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
  const homebrewInstalled = await checkHomebrewInstalled()

  if (!homebrewInstalled) {
    throw new ConvertAppsError(
      'Homebrew is not installed or not accessible',
      ErrorType.HOMEBREW_NOT_INSTALLED,
    )
  }

  consola.debug('Homebrew installation verified')

  // Get Mac App Store apps if mas is available
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

  const appPaths = await scanApplicationsDirectory(config.applicationsDir)

  if (appPaths.length === 0) {
    consola.warn('No applications found in the Applications directory')

    return []
  }

  consola.debug(`Found ${appPaths.length} applications`)

  consola.debug('Getting list of already installed Homebrew casks...')

  const installedCasks = await getInstalledCasks()
  const installedCaskSet = new Set(installedCasks)

  // Create initial app info objects
  const apps: AppInfo[] = []

  for (const appPath of appPaths) {
    const originalName = extractAppName(appPath)
    const brewName = normalizeAppName(originalName)

    // Check if this app is from Mac App Store
    const fromMacAppStore = isAppFromMacAppStore(originalName, masApps)

    // Skip Mac App Store apps if --ignore-app-store flag is set
    if (config.ignoreAppStore && fromMacAppStore) {
      apps.push({
        alreadyInstalled: false,
        appPath,
        brewName,
        brewType: 'unavailable',
        fromMacAppStore,
        originalName,
        status: 'ignored',
      })
      continue
    }

    // Skip ignored apps - check against both original name and brew name
    if (shouldIgnoreApp(originalName, brewName, config.ignoredApps)) {
      apps.push({
        alreadyInstalled: false,
        appPath,
        brewName,
        brewType: 'unavailable',
        fromMacAppStore,
        originalName,
        status: 'ignored',
      })
      continue
    }

    const isAlreadyInstalledCask = installedCaskSet.has(brewName)

    if (isAlreadyInstalledCask) {
      apps.push({
        alreadyInstalled: true,
        appPath,
        brewName,
        brewType: 'cask',
        fromMacAppStore,
        originalName,
        status: 'already-installed',
      })
      continue
    }

    // Add to list for batch processing
    apps.push({
      alreadyInstalled: false,
      appPath,
      brewName,
      brewType: 'unavailable', // Will be updated after matching
      fromMacAppStore,
      originalName,
      status: 'unavailable', // Will be updated after matching
    })
  }

  // Batch process apps that aren't already installed or ignored
  const appsToCheck = apps.filter((app) => app.status === 'unavailable')

  if (appsToCheck.length > 0) {
    consola.debug(
      `Batch checking Homebrew availability for ${appsToCheck.length} apps...`,
    )

    // Use fallback to CLI if requested
    if (config.fallbackToCli) {
      consola.debug('Using individual brew commands as requested')

      await procesAppsIndividually(appsToCheck)
    } else {
      try {
        // Fetch Homebrew cask database
        const caskResult = await fetchHomebrewCasks(
          config.forceRefreshCache,
          true,
        )

        if (caskResult.success && caskResult.data) {
          const matchingConfig = {
            enableBundleIdLookup: true,
            enableFuzzyMatching: true,
            maxMatches: 5,
            minConfidence: config.matchingThreshold ?? 0.6,
          }
          const matcher = new AppMatcher(matchingConfig)
          const index = matcher.buildIndex(caskResult.data)

          const matchResults = matcher.matchApps(appsToCheck, index)

          for (const matchResult of matchResults) {
            const app = matchResult.appInfo

            if (matchResult.bestMatch) {
              const matchedCaskName = matchResult.bestMatch.cask.token

              // Check if the matched cask is already installed
              if (installedCaskSet.has(matchedCaskName)) {
                app.alreadyInstalled = true
                app.brewType = 'cask'
                app.status = 'already-installed'
                app.brewName = matchedCaskName
              } else {
                // Found a match and not already installed
                app.alreadyInstalled = false
                app.brewType = 'cask'
                app.status = 'available'
                app.brewName = matchedCaskName
              }
            } else {
              // No match found
              app.brewType = 'unavailable'
              app.status = 'unavailable'
            }
          }
        } else {
          // Fallback to individual brew commands
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
  }

  consola.ready(`Discovery complete: ${apps.length} apps processed`)

  return apps
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
  for (const app of apps) {
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
  }
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
