/**
 * Utility functions for the convert-apps-to-homebrew application
 */

import { COLORS, REGEX_PATTERNS } from './constants.ts';
import type { Logger } from './types.ts';

/**
 * Normalize an application name for Homebrew package lookup
 * Converts to lowercase and replaces spaces with hyphens
 */
export function normalizeAppName(appName: string): string {
  return appName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract the application name from a .app bundle path
 */
export function extractAppName(appPath: string): string {
  const basename = appPath.split('/').pop() || '';
  return basename.replace(/\.app$/i, '');
}

/**
 * Validate if a string is a valid Homebrew package name
 */
export function isValidBrewPackageName(name: string): boolean {
  return REGEX_PATTERNS.BREW_PACKAGE_NAME.test(name);
}

/**
 * Validate if a string is a valid application name
 */
export function isValidAppName(name: string): boolean {
  return REGEX_PATTERNS.APP_NAME.test(name) && name.trim().length > 0;
}

/**
 * Add color to console output
 */
export function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.RESET}`;
}

/**
 * Format a list of items for display
 */
export function formatList(items: string[], indent: string = '  '): string {
  return items.map(item => `${indent}• ${item}`).join('\n');
}

/**
 * Create a simple console logger
 */
export function createLogger(verbose: boolean = false): Logger {
  return {
    info: (message: string): void => {
      console.log(colorize(`ℹ ${message}`, 'BLUE'));
    },
    warn: (message: string): void => {
      console.warn(colorize(`⚠ ${message}`, 'YELLOW'));
    },
    error: (message: string): void => {
      console.error(colorize(`✗ ${message}`, 'RED'));
    },
    debug: (message: string): void => {
      if (verbose) {
        console.log(colorize(`🐛 ${message}`, 'MAGENTA'));
      }
    },
    verbose: (message: string): void => {
      if (verbose) {
        console.log(colorize(`📝 ${message}`, 'DIM'));
      }
    }
  };
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape shell arguments to prevent injection
 */
export function escapeShellArg(arg: string): string {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Parse command output into an array of lines, filtering out empty lines
 */
export function parseCommandOutput(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Check if a string is empty or only whitespace
 */
export function isEmpty(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number, suffix: string = 's'): string {
  return count === 1 ? word : word + suffix;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Create a progress bar string
 */
export function createProgressBar(current: number, total: number, width: number = 20): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.floor(percentage * 100);

  return `[${bar}] ${percent}% (${current}/${total})`;
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Group an array of items by a key function
 */
export function groupBy<T, K extends string | number | symbol>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

/**
 * Remove duplicates from an array based on a key function
 */
export function uniqueBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
