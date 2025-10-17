/**
 * CLI argument parsing using Commander.js
 */

import { Command } from 'commander'
import { consola } from 'consola'
import { box, colors } from 'consola/utils'
import terminalLink from 'terminal-link'
import packageJson from '../package.json' with { type: 'json' }
import { MESSAGES } from './constants.ts'
import type { CommandOptions } from './types.ts'
import { generateLogo, inlineCode } from './utils.ts'

/**
 * Regular expressions used in this module
 */
const VERSION_REGEX = /(\d+)/

/**
 * Default matching threshold for fuzzy matching
 */
const DEFAULT_MATCHING_THRESHOLD = 0.6

/**
 * Standard exit codes
 */
const EXIT_CODE_SIGINT = 130
const EXIT_CODE_SIGTERM = 143

/**
 * Create and configure the Commander.js program
 */
export function createProgram(): Command {
  const program = new Command()

  program
    .name(packageJson.name)
    .description(packageJson.description)
    .version(getPackageVersion(), '-v, --version', 'display version number')
    .helpOption('-h, --help', 'show this help message')

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
    .option('-V, --verbose', 'enable verbose output', false)
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
      'use individual brew commands instead of the Homebrew API (much slower)',
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
      DEFAULT_MATCHING_THRESHOLD,
    )
    .option(
      '--ignore-app-store',
      'ignore apps installed via Mac App Store (requires mas)',
      false,
    )

  program.addHelpText(
    'after',
    `
Examples:
  $ npx ${packageJson.name}@latest
  $ npx ${packageJson.name}@latest --dry-run
  $ npx ${packageJson.name}@latest --verbose --dry-run
  $ npx ${packageJson.name}@latest --ignore "Adobe Photoshop" "Microsoft Word" google-chrome
  $ npx ${packageJson.name}@latest --ignore-app-store
  $ npx ${packageJson.name}@latest --applications-dir "custom/path/to/Applications"
  $ npx ${packageJson.name}@latest --force-refresh-cache
  $ npx ${packageJson.name}@latest --matching-threshold 0.8
  $ npx ${packageJson.name}@latest --fallback-to-cli

Notes:
  • The tool will scan your Applications directory for .app bundles
  • It fetches the Homebrew cask database for fast batch matching
  • You can interactively select which apps to install via Homebrew
  • Original .app files are taken over by Homebrew's ${inlineCode('--adopt')} flag

Requirements:
  • Mac App Store detection requires 'mas' CLI tool: ${terminalLink(colors.blue('https://github.com/mas-cli/mas'), 'https://github.com/mas-cli/mas')}
  • Install with: brew install mas
`,
  )

  return program
}

/**
 * Display help information for common issues
 */
export function displayTroubleshooting(): void {
  consola.log(
    box(
      `Common Issues:

1. Homebrew not installed:
  Install Homebrew first:
  ${inlineCode('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')}

2. Permission denied:
  Make sure you have read access to the Applications directory
  Make sure you have write access to the Applications directory

3. App not found in Homebrew:
  Not all applications are available as Homebrew casks
  You can search manually: ${inlineCode('brew search <app-name>')}

4. Network issues:
  Homebrew requires internet access to check package availability
  Check your network connection and try again

For more help:
  • Visit: ${terminalLink(colors.blue('https://brew.sh'), 'https://brew.sh')}
  ${packageJson.bugs?.url && `• Report issues: ${terminalLink(colors.blue(packageJson.bugs.url), packageJson.bugs.url)}`}`,
      { style: { borderColor: 'yellow' }, title: '🔧 Troubleshooting' },
    ),
  )
}

/**
 * Display welcome message
 */
export async function displayWelcome(options: CommandOptions) {
  consola.log(
    box(await generateLogo(packageJson.displayName), {
      style: { borderColor: 'yellowBright' },
      title: '🍺',
    }),
  )

  if (options.dryRun) {
    consola.warn(`${MESSAGES.DRY_RUN_MODE}`)
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

    validateApplicationsDirectory(options)
    const ignore = processIgnoreList(options)
    const parsedOptions = buildCommandOptions(options, ignore)

    return parsedOptions
  } catch (error: unknown) {
    handleParsingError(error)
  }
}

/**
 * Validate applications directory option
 */
function validateApplicationsDirectory(options: Record<string, unknown>): void {
  if (
    options['applicationsDir'] !== undefined &&
    typeof options['applicationsDir'] !== 'string'
  ) {
    throw new Error('Applications directory must be a valid path')
  }
}

/**
 * Process and validate ignore list
 */
function processIgnoreList(options: Record<string, unknown>): string[] {
  let ignore: string[] = []

  if (Array.isArray(options['ignore'])) {
    ignore = (options['ignore'] as unknown[]).filter(
      (item): item is string => typeof item === 'string',
    )
  } else if (typeof options['ignore'] === 'string') {
    ignore = [options['ignore']]
  }

  // Validate ignore list
  for (const app of ignore) {
    if (typeof app !== 'string' || app.trim().length === 0) {
      throw new Error(`Invalid app name in ignore list: "${app}"`)
    }
  }

  return ignore.map((app: string) => app.trim())
}

/**
 * Build CommandOptions object from parsed options
 */
function buildCommandOptions(
  options: Record<string, unknown>,
  ignore: string[],
): CommandOptions {
  const parsedOptions: CommandOptions = {
    applicationsDir:
      typeof options['applicationsDir'] === 'string'
        ? options['applicationsDir']
        : '/Applications',
    dryRun: Boolean(options['dryRun']),
    fallbackToCli: Boolean(options['fallbackToCli']),
    forceRefreshCache: Boolean(options['forceRefreshCache']),
    ignore,
    ignoreAppStore: Boolean(options['ignoreAppStore']),
    verbose: Boolean(options['verbose']),
  }

  // Add optional properties only if they exist
  if (typeof options['matchingThreshold'] === 'number') {
    parsedOptions.matchingThreshold = options['matchingThreshold']
  }

  return parsedOptions
}

/**
 * Handle parsing errors and exit appropriately
 */
function handleParsingError(error: unknown): never {
  const typedError = error as { code?: string; message?: string }

  if (typedError.code === 'commander.helpDisplayed') {
    process.exit(0)
  }

  if (typedError.code === 'commander.version') {
    process.exit(0)
  }

  // Handle parsing errors
  const errorMessage = typedError.message ?? 'Unknown error'
  consola.error(`Command line parsing error: ${errorMessage}`)
  consola.info('Use --help for usage information')
  process.exit(1)
}

/**
 * Handle process signals for graceful shutdown
 */
export function setupSignalHandlers(): void {
  process.on('SIGINT', () => {
    consola.warn('Operation cancelled by user (Ctrl+C)')
    process.exit(EXIT_CODE_SIGINT)
  })

  process.on('SIGTERM', () => {
    consola.warn('Operation terminated')
    process.exit(EXIT_CODE_SIGTERM)
  })

  process.on('uncaughtException', (error) => {
    consola.error(`Uncaught exception: ${error.message}`)

    if (process.env.NODE_ENV === 'development') {
      consola.error(error.stack)
    }

    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    consola.error(
      `Unhandled rejection at: ${String(promise)}, reason: ${String(reason)}`,
    )
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

  // Parse minimum Node.js version from package.json engines
  const engines = packageJson.engines?.node

  if (engines) {
    const versionMatch = engines.match(VERSION_REGEX)
    const versionString = versionMatch?.[1]

    if (versionString !== undefined && versionString.trim() !== '') {
      const minimumNodeVersion = Number.parseInt(versionString, 10)

      if (majorVersion < minimumNodeVersion) {
        consola.error(
          `Node.js version ${nodeVersion} is not supported. Please use Node.js ${minimumNodeVersion} or later.`,
        )
        process.exit(1)
      }
    }
  }

  // Check if running on macOS
  if (process.platform !== 'darwin') {
    consola.error('This tool is designed for macOS only.')
    process.exit(1)
  }

  consola.debug(
    `Runtime environment validated: Node.js ${nodeVersion} on ${process.platform}`,
  )
}

/**
 * Get package version from package.json
 */
function getPackageVersion(): string {
  try {
    return packageJson.version
  } catch {
    return '1.0.0'
  }
}
