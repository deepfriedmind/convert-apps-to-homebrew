/**
 * Interactive prompts using Inquirer.js
 */

import checkbox from '@inquirer/checkbox'
import { consola } from 'consola'

import type { AppChoice, AppInfo } from './types.ts'

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
  consola.box(`🎉 ${dryRun ? 'Dry Run' : 'Installation'} Complete`)

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
      consola.warn(' No apps were processed.')
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
  // Display summary of discovered apps
  displayAppSummary(apps)

  const availableApps = apps.filter(app => app.status === 'available')

  if (availableApps.length === 0) {
    consola.info('No apps available for selection.')

    return []
  }

  // Create choices for the checkbox prompt
  const choices = createAppChoices(availableApps)

  try {
    const selectedApps = await checkbox({
      choices,
      loop: false,
      message: 'Choose apps to install:',
      pageSize: 15,
      required: false,
    })

    if (selectedApps.length === 0) {
      consola.warn('No applications selected for installation.')

      return []
    }

    return selectedApps
  }
  catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      consola.warn('Selection cancelled by user.')

      return []
    }
    throw error
  }
}

/**
 * Create choices for the checkbox prompt from available apps
 */
function createAppChoices(apps: AppInfo[]): AppChoice[] {
  return apps
    .filter(app => app.status === 'available')
    .map(app => ({
      checked: true,
      disabled: false,
      name: app.originalName,
      value: app,
    }))
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
    consola.success(`Available for installation (${available.length}):`)
    consola.debug(formatList(available.map(app => app.originalName)))
  }

  if (alreadyInstalled.length > 0) {
    consola.info(`🍺 Already installed via Homebrew (${alreadyInstalled.length}):`)
    consola.debug(formatList(alreadyInstalled.map(app => app.originalName)))
  }

  if (ignored.length > 0) {
    consola.warn(`🚫 Ignored (${ignored.length}):`)
    consola.debug(formatList(ignored.map(app => app.originalName)))
  }

  if (unavailable.length > 0) {
    consola.info(`❌ Not available in Homebrew (${unavailable.length}):`)
    consola.debug(formatList(unavailable.map(app => app.originalName)))
    consola.debug(`If any of these apps actually exist in Homebrew, please file an issue at: ${packageJson.bugs.url}/new/`)
  }

  if (available.length === 0) {
    consola.warn(' No applications available for installation.')

    if (alreadyInstalled.length > 0) {
      consola.log('All discoverable apps are already installed via Homebrew.')
    }
    else if (unavailable.length > 0) {
      consola.log('No discoverable apps are available as Homebrew packages.')
    }

    return
  }

  consola.box('💡 Note:\n\nCask installations will overwrite the original .app files using Homebrew\'s --force flag')
}
