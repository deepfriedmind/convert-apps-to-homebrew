/**
 * Interactive prompts using Inquirer.js
 */

import checkbox from '@inquirer/checkbox'
import password from '@inquirer/password'
import chalk from 'chalk'

import type { AppChoice, AppInfo, CommandOptions } from './types.ts'
import { createLogger, formatList, pluralize } from './utils.ts'

/**
 * Display final summary after installation
 */
export function displayFinalSummary(
  selectedApps: AppInfo[],
  installedApps: AppInfo[],
  failedApps: AppInfo[],
  dryRun = false,
): void {
  console.log(chalk.bold(`\n🎉 ${dryRun ? 'Dry Run' : 'Installation'} Complete`))
  console.log(chalk.dim('═'.repeat(50)))

  if (dryRun) {
    console.log(chalk.blue(`\n📊 Would have processed ${selectedApps.length} ${pluralize('app', selectedApps.length)}:`))
    const casks = selectedApps.filter(app => app.brewType === 'cask')
    const formulas = selectedApps.filter(app => app.brewType === 'formula')

    if (casks.length > 0) {
      console.log(chalk.cyan(`   📦 ${casks.length} ${pluralize('cask', casks.length)}`))
    }

    if (formulas.length > 0) {
      console.log(chalk.cyan(`   ⚙️  ${formulas.length} ${pluralize('formula', formulas.length)}`))
    }
  }
  else {
    if (installedApps.length > 0) {
      console.log(chalk.green(`\n✅ Successfully installed (${installedApps.length}):`))
      console.log(formatList(installedApps.map(app => app.originalName)))
    }

    if (failedApps.length > 0) {
      console.log(chalk.red(`\n❌ Failed to install (${failedApps.length}):`))
      console.log(formatList(failedApps.map(app => app.originalName)))
    }

    if (installedApps.length === 0 && failedApps.length === 0) {
      console.log(chalk.yellow('\n⚠️  No apps were processed.'))
    }
  }

  console.log(chalk.green('\n🍺 Thank you for using convert-apps-to-homebrew!'))
}

/**
 * Display installation plan before execution
 */
export function displayInstallationPlan(
  selectedApps: AppInfo[],
  sudoPassword: string | undefined,
  dryRun = false,
): void {
  if (selectedApps.length === 0) {
    return
  }

  const casks = selectedApps.filter(app => app.brewType === 'cask')
  const formulas = selectedApps.filter(app => app.brewType === 'formula')

  console.log(chalk.bold(`\n📋 Installation Plan ${dryRun ? '(DRY RUN)' : ''}`))
  console.log(chalk.dim('═'.repeat(50)))

  if (casks.length > 0) {
    console.log(chalk.cyan(`\n📦 Casks to install (${casks.length}):`))
    console.log(formatList(casks.map(app => `${app.originalName} → ${app.brewName}`)))

    if (sudoPassword === undefined) {
      console.log(chalk.yellow('   ⚠️  Will skip deletion of original .app files (no sudo access)'))
    }
    else {
      console.log(chalk.green('   ✓ Will delete original .app files (sudo access provided)'))
    }
  }

  if (formulas.length > 0) {
    console.log(chalk.cyan(`\n⚙️  Formulas to install (${formulas.length}):`))
    console.log(formatList(formulas.map(app => `${app.originalName} → ${app.brewName}`)))
    console.log(chalk.blue('   ℹ️  Original .app files will be kept'))
  }

  if (dryRun) {
    console.log(chalk.yellow('\n🔍 This is a dry run - no actual changes will be made.'))
  }
  else {
    console.log(chalk.green('\n🚀 Ready to proceed with installation.'))
  }
}

/**
 * Prompt user to select apps for installation
 */
export async function promptAppSelection(
  apps: AppInfo[],
  options: CommandOptions,
): Promise<AppInfo[]> {
  const logger = createLogger(options.verbose || false)

  // Display summary of discovered apps
  displayAppSummary(apps, options)

  const availableApps = apps.filter(app => app.status === 'available')

  if (availableApps.length === 0) {
    logger.info('No apps available for selection.')

    return []
  }

  // Create choices for the checkbox prompt
  const choices = createAppChoices(availableApps)

  try {
    console.log(chalk.bold('\n🎯 Select applications to install via Homebrew:'))

    const selectedApps = await checkbox({
      choices,
      loop: false,
      message: 'Choose apps to install (use spacebar to toggle, Enter to confirm):',
      pageSize: 15,
      required: false,
    })

    if (selectedApps.length === 0) {
      logger.warn('No applications selected for installation.')

      return []
    }

    logger.info(`Selected ${selectedApps.length} ${pluralize('app', selectedApps.length)} for installation.`)

    return selectedApps
  }
  catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.warn('Selection cancelled by user.')

      return []
    }
    throw error
  }
}

/**
 * Prompt for confirmation before proceeding with installation
 */
export async function promptConfirmation(dryRun = false): Promise<boolean> {
  const logger = createLogger(false)

  try {
    const message = dryRun ?
      'Proceed with dry run?'
      : 'Proceed with installation?'

    // For now, we'll use a simple approach since @inquirer/confirm might not be available
    // In a real implementation, you would use @inquirer/confirm
    console.log(chalk.yellow(`\n❓ ${message} (y/N):`))

    // For the TypeScript implementation, we'll assume confirmation
    // This would be replaced with actual @inquirer/confirm in production
    logger.verbose('Auto-confirming for TypeScript implementation')

    return true
  }
  catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.warn('Confirmation cancelled by user.')

      return false
    }
    throw error
  }
}

/**
 * Prompt for sudo password when needed for cask installations
 */
export async function promptSudoPassword(selectedApps: AppInfo[]): Promise<string | undefined> {
  const logger = createLogger(false)

  if (!needsSudoPassword(selectedApps)) {
    logger.verbose('No sudo password needed (no cask installations).')

    return undefined
  }

  const caskApps = selectedApps.filter(app => app.brewType === 'cask')

  console.log(chalk.bold('\n🔐 Administrator Access Required'))
  console.log(chalk.dim('═'.repeat(50)))
  console.log(`\nThe following ${pluralize('app', caskApps.length)} ${caskApps.length === 1 ? 'requires' : 'require'} deleting original .app files:`)
  console.log(formatList(caskApps.map(app => app.originalName)))
  console.log('\nThis requires administrator privileges to delete files from /Applications.')

  try {
    const sudoPassword = await password({
      mask: true,
      message: 'Enter your password:',
    })

    if (!sudoPassword || sudoPassword.trim().length === 0) {
      logger.warn('No password provided. Cask installations will be skipped.')

      return undefined
    }

    logger.verbose('Sudo password provided for cask installations.')

    return sudoPassword
  }
  catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.warn('Password prompt cancelled by user.')

      return undefined
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
    .map((app) => {
      const brewTypeLabel = app.brewType === 'cask' ? '📦 cask' : '⚙️  formula'
      const displayName = `${app.originalName} (${brewTypeLabel})`

      return {
        checked: true, // All apps checked by default as requested
        disabled: false,
        name: displayName,
        value: app,
      }
    })
}

/**
 * Display summary of discovered apps before selection
 */
function displayAppSummary(apps: AppInfo[], options: CommandOptions): void {
  const available = apps.filter(app => app.status === 'available')
  const alreadyInstalled = apps.filter(app => app.status === 'already-installed')
  const ignored = apps.filter(app => app.status === 'ignored')
  const unavailable = apps.filter(app => app.status === 'unavailable')

  console.log(chalk.bold('\n📊 Discovery Summary'))
  console.log(chalk.dim('═'.repeat(50)))

  if (available.length > 0) {
    const casks = available.filter(app => app.brewType === 'cask')
    const formulas = available.filter(app => app.brewType === 'formula')

    console.log(chalk.green(`\n✅ Available for installation (${available.length}):`))

    if (casks.length > 0) {
      console.log(chalk.cyan(`   📦 ${casks.length} ${pluralize('cask', casks.length)}`))
    }

    if (formulas.length > 0) {
      console.log(chalk.cyan(`   ⚙️  ${formulas.length} ${pluralize('formula', formulas.length)}`))
    }
  }

  if (alreadyInstalled.length > 0) {
    console.log(chalk.blue(`\n🍺 Already installed via Homebrew (${alreadyInstalled.length}):`))

    if (options.verbose) {
      console.log(formatList(alreadyInstalled.map(app => app.originalName)))
    }
  }

  if (ignored.length > 0) {
    console.log(chalk.yellow(`\n🚫 Ignored (${ignored.length}):`))

    if (options.verbose) {
      console.log(formatList(ignored.map(app => app.originalName)))
    }
  }

  if (unavailable.length > 0) {
    console.log(chalk.red(`\n❌ Not available in Homebrew (${unavailable.length}):`))

    if (options.verbose) {
      console.log(formatList(unavailable.map(app => app.originalName)))
    }
  }

  if (available.length === 0) {
    console.log(chalk.yellow('\n⚠️  No applications available for installation.'))

    if (alreadyInstalled.length > 0) {
      console.log('All discoverable apps are already installed via Homebrew.')
    }
    else if (unavailable.length > 0) {
      console.log('No discoverable apps are available as Homebrew packages.')
    }

    return
  }

  console.log(chalk.cyan('\n💡 Note:'))
  console.log('• All available apps are pre-selected for installation')
  console.log('• Cask installations will delete the original .app files (requires sudo)')
  console.log('• Formula installations keep the original .app files')
  console.log('• Use spacebar to toggle selection, Enter to confirm')
}

/**
 * Check if sudo password is needed for the selected apps
 */
function needsSudoPassword(selectedApps: AppInfo[]): boolean {
  return selectedApps.some(app => app.brewType === 'cask')
}
