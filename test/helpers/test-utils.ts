/**
 * Test utility functions and helpers
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * Clean up a temporary directory
 */
export async function cleanupTemporaryDirectory(directoryPath: string): Promise<void> {
  try {
    await rm(directoryPath, { force: true, recursive: true })
  }
  catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a temporary directory for testing
 */
export async function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'convert-apps-test-'))
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  const logs: string[] = []
  const errors: string[] = []
  const warnings: string[] = []

  console.log = (...arguments_: unknown[]) => {
    logs.push(arguments_.map(String).join(' '))
  }

  console.error = (...arguments_: unknown[]) => {
    errors.push(arguments_.map(String).join(' '))
  }

  console.warn = (...arguments_: unknown[]) => {
    warnings.push(arguments_.map(String).join(' '))
  }

  return {
    errors,
    logs,
    restore: () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    },
    warnings,
  }
}

/**
 * Simple sleep utility for tests
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Strip ANSI color codes from text
 */
export function stripAnsiColors(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replaceAll(/\u001B\[[0-9;]*m/g, '')
}
