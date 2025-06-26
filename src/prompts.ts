/**
 * Interactive prompts using consola
 */
import { consola } from 'consola'

import type { AppInfo } from './types.ts'

import packageJson from '../package.json' with { type: 'json' }
import { formatList, pluralize } from './utils.ts'

/**
 * Display final summary after installation
 */
export function displayFinalSummary(
  selectedApps: AppInfo[],
  installedApps: AppInfo[],
  failedApps: AppInfo[],
  dryRun = false,
): void {
  consola.box(`🎉 ${dryRun ? 'Dry run' : 'Installation'} complete`)

  if (dryRun) {
    consola.info(`📊 Would have processed ${selectedApps.length} ${pluralize('app', selectedApps.length)}:`)

    if (selectedApps.length > 0) {
      consola.log(`   📦 ${selectedApps.length} ${pluralize('cask', selectedApps.length)}`)
    }
  }
  else {
    if (installedApps.length > 0) {
      consola.success(`Successfully installed (${installedApps.length}):`)
      consola.log(formatList(installedApps.map(app => app.originalName)))
    }

    if (failedApps.length > 0) {
      consola.error(`❌ Failed to install (${failedApps.length}):`)
      consola.log(formatList(failedApps.map(app => app.originalName)))
    }

    if (installedApps.length === 0 && failedApps.length === 0) {
      consola.warn('No apps were processed.')
    }
  }
}

/**
 * Display installation plan before execution
 */
export function displayInstallationPlan(
  selectedApps: AppInfo[],
  dryRun = false,
): void {
  if (selectedApps.length === 0) {
    return
  }

  if (dryRun) {
    consola.warn('This is a dry run - no actual changes will be made.')
  }
}

/**
 * Prompt user to select apps for installation
 */
export async function promptAppSelection(
  apps: AppInfo[],
): Promise<AppInfo[]> {
  displayAppSummary(apps)

  const availableApps = apps.filter(app => app.status === 'available')

  if (availableApps.length === 0) {
    consola.info('No apps available for selection.')

    return []
  }

  try {
    consola.info('↑/↓ - Navigate  |  Space - Toggle selection  |  a - Select/deselect all  |  Enter - Confirm  |  Esc - Cancel')

    const options = availableApps.map(app => ({
      hint: app.brewName === app.originalName ? '' : app.brewName,
      label: app.originalName,
      value: app.originalName,
    }))

    const selectedValues = await consola.prompt('Choose apps to convert to Homebrew:', {
      cancel: 'symbol',
      initial: availableApps.map(app => app.originalName),
      options,
      required: false,
      type: 'multiselect',
    }) as string[] | symbol

    if (typeof selectedValues === 'symbol') {
      consola.warn('Selection cancelled by user.')

      return []
    }

    if (selectedValues === undefined || !Array.isArray(selectedValues) || selectedValues.length === 0) {
      consola.warn('No applications selected for installation.')

      return []
    }

    // Map selected values back to AppInfo objects
    const selectedApps = availableApps.filter(app =>
      selectedValues.includes(app.originalName),
    )

    return selectedApps
  }
  catch (error) {
    consola.error('Error during app selection:', error)

    return []
  }
}

/**
 * Display summary of discovered apps before selection
 */
function displayAppSummary(apps: AppInfo[]): void {
  const available = apps.filter(app => app.status === 'available')
  const alreadyInstalled = apps.filter(app => app.status === 'already-installed')
  const ignored = apps.filter(app => app.status === 'ignored')
  const unavailable = apps.filter(app => app.status === 'unavailable')

  if (available.length > 0) {
    consola.info(`👍 ${available.length} available for installation`)
    consola.debug(formatList(available.map(app => app.originalName)))
  }

  if (alreadyInstalled.length > 0) {
    consola.info(`🍺 ${alreadyInstalled.length} already installed via Homebrew`)
    consola.debug(formatList(alreadyInstalled.map(app => app.originalName)))
  }

  if (ignored.length > 0) {
    consola.warn(`🚫 ${ignored.length} ignored`)
    consola.debug(formatList(ignored.map(app => app.originalName)))
  }

  if (unavailable.length > 0) {
    consola.info(`❌ ${unavailable.length} not available in Homebrew`)
    consola.debug(formatList(unavailable.map(app => app.originalName)))
    consola.debug(`If any of these apps actually exist in Homebrew, please file an issue at: ${packageJson.bugs.url}/new/`)
  }

  if (available.length === 0) {
    consola.warn('No applications available for installation.')

    if (alreadyInstalled.length > 0) {
      consola.log('All discoverable apps are already installed via Homebrew.')
    }
    else if (unavailable.length > 0) {
      consola.log('No discoverable apps are available as Homebrew packages.')
    }

    return
  }

  consola.box('💡 Note:\nThe original .app files will be replaced by Homebrew\'s force install')
}
