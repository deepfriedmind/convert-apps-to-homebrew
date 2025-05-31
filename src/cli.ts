/**
 * CLI argument parsing using Commander.js
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CommandOptions } from './types.ts';
import { colorize, createLogger } from './utils.ts';
import { MESSAGES } from './constants.ts';

/**
 * Get package version from package.json
 */
function getPackageVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Create and configure the Commander.js program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('convert-apps-to-homebrew')
    .description('Convert macOS applications to Homebrew installations with interactive selection')
    .version(getPackageVersion(), '-v, --version', 'display version number')
    .helpOption('-h, --help', 'display help for command');

  // Configure options
  program
    .option(
      '-i, --ignore <apps...>',
      'ignore specific applications (can be used multiple times)',
      []
    )
    .option(
      '-d, --dry-run',
      'show what would be done without making any changes',
      false
    )
    .option(
      '--verbose',
      'enable verbose output for debugging',
      false
    )
    .option(
      '--applications-dir <path>',
      'specify custom Applications directory path',
      '/Applications'
    );

  // Add examples to help
  program.addHelpText('after', `
Examples:
  $ npx convert-apps-to-homebrew
  $ npx convert-apps-to-homebrew --dry-run
  $ npx convert-apps-to-homebrew --ignore "Adobe Photoshop" "Microsoft Word"
  $ npx convert-apps-to-homebrew --verbose --dry-run
  $ npx convert-apps-to-homebrew --applications-dir "/Applications"

Notes:
  • The tool will scan your Applications directory for .app bundles
  • It checks Homebrew for available casks and formulas
  • You can interactively select which apps to install via Homebrew
  • Original .app files are deleted only for cask installations (requires sudo)
  • Use --dry-run to preview changes without making them
  • Use --ignore to skip specific applications by name
`);

  return program;
}

/**
 * Parse command line arguments and return options
 */
export function parseArguments(argv: string[] = process.argv): CommandOptions {
  const program = createProgram();

  try {
    program.parse(argv);
    const options = program.opts();

    // Validate applications directory
    if (options['applicationsDir'] && typeof options['applicationsDir'] !== 'string') {
      throw new Error('Applications directory must be a valid path');
    }

    // Ensure ignore is always an array
    const ignore = Array.isArray(options['ignore']) ? options['ignore'] :
      typeof options['ignore'] === 'string' ? [options['ignore']] : [];

    // Validate ignore list
    for (const app of ignore) {
      if (typeof app !== 'string' || app.trim().length === 0) {
        throw new Error(`Invalid app name in ignore list: "${app}"`);
      }
    }

    const parsedOptions: CommandOptions = {
      ignore: ignore.map((app: string) => app.trim()),
      dryRun: Boolean(options['dryRun']),
      verbose: Boolean(options['verbose']),
      applicationsDir: options['applicationsDir'] || '/Applications'
    };

    return parsedOptions;
  } catch (error: any) {
    const logger = createLogger(false);

    if (error.code === 'commander.helpDisplayed') {
      // Help was displayed, exit gracefully
      process.exit(0);
    }

    if (error.code === 'commander.version') {
      // Version was displayed, exit gracefully
      process.exit(0);
    }

    // Handle parsing errors
    logger.error(`Command line parsing error: ${error.message}`);
    logger.info('Use --help for usage information');
    process.exit(1);
  }
}

/**
 * Display welcome message with current configuration
 */
export function displayWelcome(options: CommandOptions): void {
  const logger = createLogger(options.verbose);

  console.log(colorize('\n🍺 Convert Apps to Homebrew', 'BRIGHT'));
  console.log(colorize('═'.repeat(50), 'DIM'));

  if (options.dryRun) {
    console.log(colorize(`\n${MESSAGES.DRY_RUN_MODE}`, 'YELLOW'));
  }

  logger.info(`Scanning directory: ${options.applicationsDir}`);

  if (options.ignore && options.ignore.length > 0) {
    logger.info(`Ignoring apps: ${options.ignore.join(', ')}`);
  }

  if (options.verbose) {
    logger.verbose('Verbose mode enabled');
  }

  console.log(); // Empty line for spacing
}

/**
 * Display help information for common issues
 */
export function displayTroubleshooting(): void {
  console.log(colorize('\n🔧 Troubleshooting', 'BRIGHT'));
  console.log(colorize('═'.repeat(50), 'DIM'));
  console.log(`
${colorize('Common Issues:', 'YELLOW')}

${colorize('1. Homebrew not installed:', 'CYAN')}
   Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

${colorize('2. Permission denied:', 'CYAN')}
   Make sure you have read access to the Applications directory
   Some apps may require administrator privileges to delete

${colorize('3. App not found in Homebrew:', 'CYAN')}
   Not all applications are available as Homebrew casks or formulas
   You can search manually: brew search <app-name>

${colorize('4. Network issues:', 'CYAN')}
   Homebrew requires internet access to check package availability
   Check your network connection and try again

${colorize('For more help:', 'GREEN')}
   • Visit: https://brew.sh/
   • Report issues: https://github.com/deepfriedmind/convert-apps-to-homebrew/issues
`);
}

/**
 * Handle process signals for graceful shutdown
 */
export function setupSignalHandlers(): void {
  const logger = createLogger(false);

  process.on('SIGINT', () => {
    logger.warn('\n\nOperation cancelled by user (Ctrl+C)');
    process.exit(130); // Standard exit code for SIGINT
  });

  process.on('SIGTERM', () => {
    logger.warn('\n\nOperation terminated');
    process.exit(143); // Standard exit code for SIGTERM
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    if (process.env['NODE_ENV'] === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
  });
}

/**
 * Validate runtime environment
 */
export function validateEnvironment(): void {
  const logger = createLogger(false);

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10);

  if (majorVersion < 22) {
    logger.error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 22 or later.`);
    process.exit(1);
  }

  // Check if running on macOS
  if (process.platform !== 'darwin') {
    logger.error('This tool is designed for macOS only.');
    process.exit(1);
  }

  logger.verbose(`Runtime environment validated: Node.js ${nodeVersion} on ${process.platform}`);
}
