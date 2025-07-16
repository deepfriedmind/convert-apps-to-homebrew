/**
 * Mac App Store integration using mas CLI tool
 */

import { consola } from 'consola'

import type { MasAppInfo, MasIntegrationResult } from './types.ts'

import { executeCommand } from './utils.ts'

/**
 * Mac App Store CLI commands
 */
const MAS_COMMANDS = {
  /** List installed Mac App Store apps */
  LIST: 'mas list',
  /** Check if mas is installed */
  VERSION: 'mas version',
} as const

/**
 * Get list of apps installed via Mac App Store
 */
export async function getMacAppStoreApps(): Promise<MasIntegrationResult> {
  try {
    // First check if mas is installed
    const masInstalled = await isMasInstalled()

    if (!masInstalled) {
      return {
        apps: [],
        masInstalled: false,
        success: false,
      }
    }

    consola.debug('mas CLI detected, fetching Mac App Store apps...')

    const result = await executeCommand(MAS_COMMANDS.LIST)

    if (!result.success) {
      consola.warn('Failed to get Mac App Store apps list')

      return {
        apps: [],
        masInstalled: true,
        success: false,
      }
    }

    const apps = parseMasOutput(result.stdout)

    consola.debug(`Found ${apps.length} Mac App Store apps`)

    return {
      apps,
      masInstalled: true,
      success: true,
    }
  } catch (error) {
    consola.warn(
      `Error getting Mac App Store apps: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )

    return {
      apps: [],
      masInstalled: false,
      success: false,
    }
  }
}

/**
 * Check if an app name matches any Mac App Store app
 */
export function isAppFromMacAppStore(
  appName: string,
  masApps: MasAppInfo[],
): boolean {
  if (masApps.length === 0) {
    return false
  }

  const normalizedAppName = appName.toLowerCase().replace(/\.app$/, '')

  return masApps.some((masApp) => {
    const normalizedMasName = masApp.name.toLowerCase()

    // Exact match
    if (normalizedMasName === normalizedAppName) {
      return true
    }

    // Check if app name is contained in mas name or vice versa
    // This handles cases like "App Name" vs "App Name Pro"
    const hasNameMatch =
      normalizedMasName.includes(normalizedAppName) ||
      normalizedAppName.includes(normalizedMasName)

    return Boolean(hasNameMatch)
  })
}

/**
 * Check if mas CLI tool is installed and accessible
 */
async function isMasInstalled(): Promise<boolean> {
  try {
    const result = await executeCommand(MAS_COMMANDS.VERSION)

    return result.success
  } catch {
    return false
  }
}

/**
 * Parse mas list output format: <app-id> <app-name> (<version>)
 * Example: "497799835 Xcode (15.4)"
 */
function parseMasOutput(output: string): MasAppInfo[] {
  const lines = output
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
  const apps: MasAppInfo[] = []

  for (const line of lines) {
    try {
      // Find the first space to separate app ID
      const firstSpaceIndex = line.indexOf(' ')

      if (firstSpaceIndex === -1) continue

      const appId = line.slice(0, firstSpaceIndex).trim()
      const remainder = line.slice(firstSpaceIndex + 1).trim()

      // Find the last occurrence of " (" to separate name and version
      const lastParenIndex = remainder.lastIndexOf(' (')

      if (lastParenIndex === -1) continue

      const appName = remainder.slice(0, lastParenIndex).trim()
      const versionPart = remainder.slice(lastParenIndex + 2) // Skip " ("

      // Remove trailing ")"
      const version = versionPart.replace(/\)$/, '').trim()

      if (appId.length > 0 && appName.length > 0 && version.length > 0) {
        apps.push({
          appId,
          name: appName,
          version,
        })
      } else {
        consola.debug(`Could not parse mas line: ${line}`)
      }
    } catch (error) {
      consola.debug(
        `Error parsing mas line "${line}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  return apps
}
