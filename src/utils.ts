/**
 * Utility functions for the convert-apps-to-homebrew application
 */

import chalk from 'chalk'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import type { BrewCommandResult, Logger } from './types.ts'

import { DEFAULT_CONFIG, REGEX_PATTERNS } from './constants.ts'

const execAsync = promisify(exec)

/**
 * Capitalize the first letter of a string
 */
export function capitalize(string_: string): string {
  return string_.charAt(0).toUpperCase() + string_.slice(1)
}

/**
 * Create a simple console logger
 */
export function createLogger(verbose = false): Logger {
  return {
    debug: (message: string): void => {
      if (verbose) {
        console.log(chalk.magenta(`🐛 ${message}`))
      }
    },
    error: (message: string): void => {
      console.error(chalk.red(`✗ ${message}`))
    },
    info: (message: string): void => {
      console.log(chalk.blue(`ℹ ${message}`))
    },
    verbose: (message: string): void => {
      if (verbose) {
        console.log(chalk.dim(`📝 ${message}`))
      }
    },
    warn: (message: string): void => {
      console.warn(chalk.yellow(`⚠ ${message}`))
    },
  }
}

/**
 * Create a progress bar string
 */
export function createProgressBar(current: number, total: number, width = 20): string {
  const percentage = Math.min(current / total, 1)
  const filled = Math.floor(percentage * width)
  const empty = width - filled

  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const percent = Math.floor(percentage * 100)

  return `[${bar}] ${percent}% (${current}/${total})`
}

/**
 * Escape shell arguments to prevent injection
 */
export function escapeShellArgument(argument: string): string {
  return `"${argument.replaceAll('"', String.raw`\"`)}"`
}

/**
 * Execute a shell command asynchronously and return a structured result
 *
 * This function wraps Node.js child_process.exec with error handling and timeout support.
 * It always returns a BrewCommandResult object regardless of success or failure.
 *
 * @param command - The shell command to execute
 * @param timeout - Maximum execution time in milliseconds (defaults to BREW_COMMAND_TIMEOUT)
 * @param dryRun - If true, don't actually execute the command, just return a dry-run message
 * @param sudoPassword - Optional password for sudo operations
 * @returns Promise that resolves to a BrewCommandResult with execution details
 * @throws {Error} When command is empty or contains only whitespace
 *
 * @example
 * ```typescript
 * const result = await executeCommand('brew list --cask');
 * if (result.success) {
 *   console.log('Output:', result.stdout);
 * } else {
 *   console.error('Error:', result.stderr);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom timeout
 * const result = await executeCommand('brew install package', 30000);
 * ```
 *
 * @example
 * ```typescript
 * // Dry run mode
 * const result = await executeCommand('brew install package', DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, true);
 * ```
 *
 * @example
 * ```typescript
 * // With sudo
 * const result = await executeCommand('rm -rf /path', DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, false, 'password');
 * ```
 */
export async function executeCommand(
  command: string,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
  dryRun = false,
  sudoPassword?: string,
): Promise<BrewCommandResult> {
  if (command.trim() === '') {
    throw new Error('Command cannot be empty')
  }

  // Build the final command (with sudo if needed)
  const finalCommand = sudoPassword === undefined ?
    command
    : `echo ${escapeShellArgument(sudoPassword)} | sudo -S ${command}`

  if (dryRun) {
    const dryRunPrefix = sudoPassword === undefined ? '[DRY RUN] Would execute:' : '[DRY RUN] Would execute with sudo:'

    return {
      exitCode: 0,
      stderr: '',
      stdout: `${dryRunPrefix} ${command}`,
      success: true,
    }
  }

  try {
    const { stderr, stdout } = await execAsync(finalCommand, { timeout })

    return {
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      success: true,
    }
  }
  catch (error: unknown) {
    const typedError = error as { code?: number, message?: string, stderr?: string, stdout?: string }

    return {
      exitCode: typedError.code ?? 1,
      stderr: typedError.stderr?.trim() ?? typedError.message ?? '',
      stdout: typedError.stdout?.trim() ?? '',
      success: false,
    }
  }
}

/**
 * Extract the application name from a .app bundle path
 */
export function extractAppName(appPath: string): string {
  const basename = appPath.split('/').pop()

  if (basename === undefined) {
    return ''
  }

  return basename.replace(/\.app$/i, '')
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = Math.floor(ms / 1000)

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Format a list of items for display
 */
export function formatList(items: string[], indent = '  '): string {
  return items.map(item => `${indent}• ${item}`).join('\n')
}

/**
 * Group an array of items by a key function
 */
export function groupBy<T, K extends number | string | symbol>(
  items: T[],
  keyFunction: (item: T) => K,
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>

  for (const item of items) {
    const key = keyFunction(item)

    if (!(key in groups)) {
      groups[key] = []
    }

    groups[key].push(item)
  }

  return groups
}

/**
 * Check if a string is empty or only whitespace
 */
export function isEmpty(string_: null | string | undefined): boolean {
  return string_ == null || string_.trim().length === 0
}

/**
 * Validate if a string is a valid application name
 */
export function isValidAppName(name: string): boolean {
  return REGEX_PATTERNS.APP_NAME.test(name) && name.trim().length > 0
}

/**
 * Validate if a string is a valid Homebrew package name
 */
export function isValidBrewPackageName(name: string): boolean {
  return REGEX_PATTERNS.BREW_PACKAGE_NAME.test(name)
}

/**
 * Normalize an application name for Homebrew package lookup
 * Converts to lowercase and replaces spaces with hyphens
 */
export function normalizeAppName(appName: string): string {
  return appName
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9\-_.]/g, '')
    .replaceAll(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
    .replaceAll(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Parse command output into an array of lines, filtering out empty lines
 */
export function parseCommandOutput(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number, suffix = 's'): string {
  return count === 1 ? word : word + suffix
}

/**
 * Sleep for a specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(string_: string, maxLength: number): string {
  if (string_.length <= maxLength) {
    return string_
  }

  return `${string_.slice(0, maxLength - 3)}...`
}

/**
 * Remove duplicates from an array based on a key function
 */
export function uniqueBy<T, K>(items: T[], keyFunction: (item: T) => K): T[] {
  const seen = new Set<K>()

  return items.filter((item) => {
    const key = keyFunction(item)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}
