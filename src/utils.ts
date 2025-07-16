/**
 * Utility functions for the convert-apps-to-homebrew application
 */

import type { Buffer } from 'node:buffer'

import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { DEFAULT_CONFIG } from './constants.ts'
import type { BrewCommandResult } from './types.ts'

const execAsync = promisify(exec)

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
 * @param streamOutput - If true, stream command output to console in real-time
 * @returns Promise that resolves to a BrewCommandResult with execution details
 * @throws {Error} When command is empty or contains only whitespace
 */
export async function executeCommand(
  command: string,
  timeout: number = DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT,
  dryRun = false,
  streamOutput = false,
): Promise<BrewCommandResult> {
  if (command.trim() === '') {
    throw new Error('Command cannot be empty')
  }

  if (dryRun) {
    return {
      exitCode: 0,
      stderr: '',
      stdout: `[DRY RUN] Would execute: ${command}`,
      success: true,
    }
  }

  if (streamOutput) {
    // Use spawn instead of exec to get real-time output
    return new Promise((resolve) => {
      let stdoutData = ''
      let stderrData = ''

      // Use shell: true to support piping and redirection
      const childProcess = spawn(command, [], { shell: true, timeout })

      childProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        stdoutData += output
        process.stdout.write(output)
      })

      childProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString()
        stderrData += output
        process.stderr.write(output)
      })

      childProcess.on('close', (code: number) => {
        resolve({
          exitCode: code ?? 0,
          stderr: stderrData.trim(),
          stdout: stdoutData.trim(),
          success: code === 0,
        })
      })

      childProcess.on('error', (error: Error) => {
        resolve({
          exitCode: 1,
          stderr: error.message,
          stdout: stdoutData.trim(),
          success: false,
        })
      })
    })
  }

  try {
    const { stderr, stdout } = await execAsync(command, { timeout })

    return {
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      success: true,
    }
  } catch (error: unknown) {
    const typedError = error as {
      code?: number
      message?: string
      stderr?: string
      stdout?: string
    }

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
 * Format a list of items for display
 */
export function formatList(items: string[], indent = '  '): string {
  return items.map((item) => `${indent}• ${item}`).join('\n')
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number, suffix = 's'): string {
  return count === 1 ? word : word + suffix
}

/**
 * Check if an app should be ignored based on ignore patterns
 * Supports matching against both original app name and brew package name
 */
export function shouldIgnoreApp(
  originalName: string,
  brewName: string,
  ignoredApps: string[],
): boolean {
  if (ignoredApps.length === 0) {
    return false
  }

  const normalizedOriginalName = normalizeAppName(originalName)
  const normalizedBrewName = normalizeAppName(brewName)

  for (const ignoredApp of ignoredApps) {
    const normalizedIgnoredApp = normalizeAppName(ignoredApp.trim())

    // Exact match against original name or brew name
    if (
      normalizedIgnoredApp === normalizedOriginalName ||
      normalizedIgnoredApp === normalizedBrewName
    ) {
      return true
    }

    // Handle partial brew name matching (e.g., "bartender" should match "bartender-5")
    // This allows users to specify the base package name without version suffixes
    if (
      normalizedBrewName.startsWith(`${normalizedIgnoredApp}-`) ||
      normalizedOriginalName.startsWith(`${normalizedIgnoredApp}-`)
    ) {
      return true
    }
  }

  return false
}

/* Removed unused utility functions */
