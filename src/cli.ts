/**
 * CLI argument parsing using Commander.js
 */

import { Command } from 'commander'
import { consola } from 'consola'

import type { CommandOptions } from './types.ts'

import packageJson from '../package.json' with { type: 'json' }
import { MESSAGES } from './constants.ts'

/**
 * Create and configure the Commander.js program
 */
export function createProgram(): Command {
  const program = new Command()

  program
    .name('convert-apps-to-homebrew')
    .description('Convert macOS applications to Homebrew installations with interactive selection')
    .version(getPackageVersion(), '-v, --version', 'display version number')
    .helpOption('-h, --help', 'display help for command')

  program
    .option(
      '-i, --ignore <apps...>',
      'ignore specific applications (can be used multiple times)',
      [],
    )
    .option(
      '-d, --dry-run',
      'show what would be done without making any changes',
      false,
    )
    .option(
      '--verbose',
      'enable verbose output for debugging',
      false,
    )
    .option(
      '--applications-dir <path>',
      'specify custom Applications directory path',
      '/Applications',
    )
    .option(
      '--force-refresh-cache',
      'force refresh of Homebrew cask database cache',
      false,
    )
    .option(
      '--fallback-to-cli',
      'use individual brew commands instead of batch API (slower)',
      false,
    )
    .option(
      '--matching-threshold <threshold>',
      'confidence threshold for fuzzy matching (0.0-1.0)',
      (value) => {
        const threshold = Number.parseFloat(value)

        if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
          throw new Error('Matching threshold must be between 0.0 and 1.0')
        }

        return threshold
      },
      0.6,
    )
    .option(
      '--ignore-app-store',
      'ignore apps installed via Mac App Store (requires mas)',
      false,
    )

  program.addHelpText('after', `
Examples:
  $ npx convert-apps-to-homebrew
  $ npx convert-apps-to-homebrew --dry-run
  $ npx convert-apps-to-homebrew --ignore "Adobe Photoshop" "Microsoft Word"
  $ npx convert-apps-to-homebrew --verbose --dry-run
  $ npx convert-apps-to-homebrew --applications-dir "custom/path/to/Applications"
  $ npx convert-apps-to-homebrew --force-refresh-cache
  $ npx convert-apps-to-homebrew --matching-threshold 0.8
  $ npx convert-apps-to-homebrew --fallback-to-cli
  $ npx convert-apps-to-homebrew --ignore-app-store

Notes:
  • The tool will scan your Applications directory for .app bundles
  • It fetches the Homebrew cask database for fast batch matching
  • You can interactively select which apps to install via Homebrew
  • Original .app files are overwritten using Homebrew's --force flag
  • Use --dry-run to preview changes without making them
  • Use --ignore to skip specific applications by name
  • Use --ignore-app-store to skip Mac App Store applications
  • Use --force-refresh-cache to update the cask database
  • Use --fallback-to-cli to use individual brew commands (slower)
  • Use --matching-threshold to adjust fuzzy matching sensitivity

Requirements:
  • Mac App Store detection requires 'mas' CLI tool: https://github.com/mas-cli/mas
  • Install with: brew install mas
`)

  return program
}

/**
 * Display help information for common issues
 */
export function displayTroubleshooting(): void {
  consola.box('🔧 Troubleshooting')

  consola.info(`Common Issues:

1. Homebrew not installed:
   Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Permission denied:
   Make sure you have read access to the Applications directory
   Make sure you have write access to the Applications directory

3. App not found in Homebrew:
   Not all applications are available as Homebrew casks
   You can search manually: brew search <app-name>

4. Network issues:
   Homebrew requires internet access to check package availability
   Check your network connection and try again

For more help:
   • Visit: https://brew.sh/
   • Report issues: https://github.com/deepfriedmind/convert-apps-to-homebrew/issues`)
}

/**
 * Display welcome message with current configuration
 */
export function displayWelcome(options: CommandOptions): void {
  consola.box('🍺 Convert Apps to Homebrew')

  if (options.dryRun) {
    consola.warn(`${MESSAGES.DRY_RUN_MODE}`)
  }

  if (options.verbose) {
    consola.debug('Verbose mode enabled')
  }

  if (options.ignore.length > 0) {
    consola.debug(`Ignoring apps: ${options.ignore.join(', ')}`)
  }
}

/**
 * Parse command line arguments and return options
 */
export function parseArguments(argv: string[] = process.argv): CommandOptions {
  const program = createProgram()

  try {
    program.parse(argv)
    const options = program.opts()

    // Validate applications directory
    if (options['applicationsDir'] !== undefined && typeof options['applicationsDir'] !== 'string') {
      throw new Error('Applications directory must be a valid path')
    }

    // Ensure ignore is always an array
    const ignore: string[] = Array.isArray(options['ignore']) ?
        (options['ignore'] as unknown[]).filter((item): item is string => typeof item === 'string')
      : (typeof options['ignore'] === 'string' ? [options['ignore']] : [])

    // Validate ignore list
    for (const app of ignore) {
      if (typeof app !== 'string' || app.trim().length === 0) {
        throw new Error(`Invalid app name in ignore list: "${app}"`)
      }
    }

    const parsedOptions: CommandOptions = {
      applicationsDir: typeof options['applicationsDir'] === 'string' ? options['applicationsDir'] : '/Applications',
      dryRun: Boolean(options['dryRun']),
      fallbackToCli: Boolean(options['fallbackToCli']),
      forceRefreshCache: Boolean(options['forceRefreshCache']),
      ignore: ignore.map((app: string) => app.trim()),
      ignoreAppStore: Boolean(options['ignoreAppStore']),
      verbose: Boolean(options['verbose']),
    }

    // Add optional properties only if they exist
    if (typeof options['matchingThreshold'] === 'number') {
      parsedOptions.matchingThreshold = options['matchingThreshold']
    }

    return parsedOptions
  }
  catch (error: unknown) {
    const typedError = error as { code?: string, message?: string }

    if (typedError.code === 'commander.helpDisplayed') {
      // Help was displayed, exit gracefully
      process.exit(0)
    }

    if (typedError.code === 'commander.version') {
      // Version was displayed, exit gracefully
      process.exit(0)
    }

    // Handle parsing errors
    const errorMessage = typedError.message ?? 'Unknown error'
    consola.error(`Command line parsing error: ${errorMessage}`)
    consola.info('Use --help for usage information')
    process.exit(1)
  }
}

/**
 * Handle process signals for graceful shutdown
 */
export function setupSignalHandlers(): void {
  process.on('SIGINT', () => {
    consola.warn('Operation cancelled by user (Ctrl+C)')
    process.exit(130) // Standard exit code for SIGINT
  })

  process.on('SIGTERM', () => {
    consola.warn('Operation terminated')
    process.exit(143) // Standard exit code for SIGTERM
  })

  process.on('uncaughtException', (error) => {
    consola.error(`Uncaught exception: ${error.message}`)

    if (process.env['NODE_ENV'] === 'development') {
      consola.error(error.stack)
    }

    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    consola.error(`Unhandled rejection at: ${String(promise)}, reason: ${String(reason)}`)
    process.exit(1)
  })
}

/**
 * Validate runtime environment
 */
export function validateEnvironment(): void {
  // Check Node.js version
  const nodeVersion = process.version
  const [versionPart] = nodeVersion.slice(1).split('.')
  const majorVersion = Number.parseInt(versionPart ?? '0', 10)

  if (majorVersion < 22) {
    consola.error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 22 or later.`)
    process.exit(1)
  }

  // Check if running on macOS
  if (process.platform !== 'darwin') {
    consola.error('This tool is designed for macOS only.')
    process.exit(1)
  }

  consola.debug(`Runtime environment validated: Node.js ${nodeVersion} on ${process.platform}`)
}

/**
 * Get package version from package.json
 */
function getPackageVersion(): string {
  try {
    return packageJson.version
  }
  catch {
    return '1.0.0'
  }
}
