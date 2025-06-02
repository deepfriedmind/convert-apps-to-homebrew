/**
 * Utility functions for the convert-apps-to-homebrew application
 */

import { COLORS, REGEX_PATTERNS } from './constants.ts'
import type { Logger } from './types.ts'

/**
 * Capitalize the first letter of a string
 */
export function capitalize(string_: string): string {
  return string_.charAt(0).toUpperCase() + string_.slice(1)
}

/**
 * Add color to console output
 */
export function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.RESET}`
}

/**
 * Create a simple console logger
 */
export function createLogger(verbose = false): Logger {
  return {
    debug: (message: string): void => {
      if (verbose) {
        console.log(colorize(`🐛 ${message}`, 'MAGENTA'))
      }
    },
    error: (message: string): void => {
      console.error(colorize(`✗ ${message}`, 'RED'))
    },
    info: (message: string): void => {
      console.log(colorize(`ℹ ${message}`, 'BLUE'))
    },
    verbose: (message: string): void => {
      if (verbose) {
        console.log(colorize(`📝 ${message}`, 'DIM'))
      }
    },
    warn: (message: string): void => {
      console.warn(colorize(`⚠ ${message}`, 'YELLOW'))
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
