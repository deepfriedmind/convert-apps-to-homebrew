/**
 * App scanner module for discovering macOS applications and checking Homebrew availability
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type {
  AppInfo,
  Logger,
  ScannerConfig,
} from './types.ts'

import { AppMatcher } from './app-matcher.ts'
import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  FILE_PATTERNS,
} from './constants.ts'
import { fetchHomebrewCasks } from './homebrew-api.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import {
  createLogger,
  executeCommand,
  extractAppName,
  normalizeAppName,
  parseCommandOutput,
} from './utils.ts'

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

  // Get list of already installed Homebrew casks
  logger.verbose('Getting list of already installed Homebrew casks...')
  const installedCasks = await getInstalledCasks()
  const installedCaskSet = new Set(installedCasks)

  // Create initial app info objects
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

    // Check if already installed first
    const isAlreadyInstalledCask = installedCaskSet.has(brewName)

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

    // Add to list for batch processing
    apps.push({
      alreadyInstalled: false,
      appPath,
      brewName,
      brewType: 'unavailable', // Will be updated after matching
      originalName,
      status: 'unavailable', // Will be updated after matching
    })
  }

  // Batch process apps that aren't already installed or ignored
  const appsToCheck = apps.filter(app => app.status === 'unavailable')

  if (appsToCheck.length > 0) {
    logger.verbose(`Batch checking Homebrew availability for ${appsToCheck.length} apps...`)

    // Use fallback to CLI if requested
    if (config.fallbackToCli === true) {
      logger.verbose('Using individual brew commands as requested')
      await procesAppsIndividually(appsToCheck, logger)
    }
    else {
      try {
        // Fetch Homebrew cask database
        const caskResult = await fetchHomebrewCasks(config.verbose, config.forceRefreshCache)

        if (caskResult.success && caskResult.data) {
          // Use the new matching system
          const matchingConfig = {
            enableBundleIdLookup: true,
            enableFuzzyMatching: true,
            maxMatches: 5,
            minConfidence: config.matchingThreshold ?? 0.6,
          }
          const matcher = new AppMatcher(matchingConfig, config.verbose)
          const index = matcher.buildIndex(caskResult.data)

          logger.verbose(`Built search index for ${caskResult.data.length} casks`)

          // Match apps against cask database
          for (const app of appsToCheck) {
            const matchResult = matcher.matchApp(app, index)

            if (matchResult.bestMatch) {
              const matchedCaskName = matchResult.bestMatch.cask.token

              // Check if the matched cask is already installed
              if (installedCaskSet.has(matchedCaskName)) {
                app.alreadyInstalled = true
                app.brewType = 'cask'
                app.status = 'already-installed'
                app.brewName = matchedCaskName

                logger.verbose(`Matched ${app.originalName} -> ${matchedCaskName} (already installed)`)
              }
              else {
                // Found a match and not already installed
                app.alreadyInstalled = false
                app.brewType = 'cask'
                app.status = 'available'
                app.brewName = matchedCaskName

                logger.verbose(`Matched ${app.originalName} -> ${matchedCaskName} (confidence: ${matchResult.bestMatch.confidence.toFixed(2)})`)
              }
            }
            else {
              // No match found
              app.brewType = 'unavailable'
              app.status = 'unavailable'

              logger.verbose(`No match found for ${app.originalName}`)
            }
          }

          logger.info(`Batch matching complete: ${appsToCheck.filter(app => app.status === 'available').length}/${appsToCheck.length} apps available`)
        }
        else {
          // Fallback to individual brew commands
          logger.warn('Failed to fetch Homebrew cask database, falling back to individual commands')
          await procesAppsIndividually(appsToCheck, logger)
        }
      }
      catch (error) {
        logger.warn(`Error during batch processing: ${error instanceof Error ? error.message : 'Unknown error'}`)
        logger.warn('Falling back to individual brew commands')
        await procesAppsIndividually(appsToCheck, logger)
      }
    }
  }

  logger.info(`Discovery complete: ${apps.length} apps processed`)

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
async function determinePackageInfo(_appName: string, brewName: string): Promise<{
  alreadyInstalled: boolean
  brewType: 'cask' | 'unavailable'
}> {
  // Check if it's available as a cask (most GUI apps are casks)
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
async function procesAppsIndividually(apps: AppInfo[], logger: Logger): Promise<void> {
  for (const app of apps) {
    logger.verbose(`Checking Homebrew availability for: ${app.originalName}`)

    try {
      const packageInfo = await determinePackageInfo(app.originalName, app.brewName)

      app.alreadyInstalled = packageInfo.alreadyInstalled
      app.brewType = packageInfo.brewType
      app.status = packageInfo.brewType === 'unavailable' ? 'unavailable' : 'available'
    }
    catch (error) {
      logger.warn(`Failed to check Homebrew availability for ${app.originalName}: ${String(error)}`)
      app.alreadyInstalled = false
      app.brewType = 'unavailable'
      app.status = 'unavailable'
    }
  }
}

/**
 * Scan the Applications directory for .app bundles
 */
async function scanApplicationsDirectory(applicationsDirectory: string = DEFAULT_APPLICATIONS_DIR): Promise<string[]> {
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
