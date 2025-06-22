/**
 * Custom assertions for testing
 */

import assert from 'node:assert'

import type { AppInfo, BrewCommandResult } from '../../src/types.ts'

/**
 * Assert that an AppInfo object has the expected structure
 */
export function assertAppInfo(actual: AppInfo, expected: Partial<AppInfo>): void {
  assert.strictEqual(typeof actual.alreadyInstalled, 'boolean', 'alreadyInstalled should be boolean')
  assert.strictEqual(typeof actual.appPath, 'string', 'appPath should be string')
  assert.strictEqual(typeof actual.brewName, 'string', 'brewName should be string')
  assert.strictEqual(typeof actual.originalName, 'string', 'originalName should be string')
  assert.ok(['cask', 'unavailable'].includes(actual.brewType), 'brewType should be valid')
  assert.ok(['already-installed', 'available', 'ignored', 'unavailable'].includes(actual.status), 'status should be valid')

  if (expected.alreadyInstalled !== undefined) {
    assert.strictEqual(actual.alreadyInstalled, expected.alreadyInstalled)
  }

  if (expected.appPath !== undefined) {
    assert.strictEqual(actual.appPath, expected.appPath)
  }

  if (expected.brewName !== undefined) {
    assert.strictEqual(actual.brewName, expected.brewName)
  }

  if (expected.brewType !== undefined) {
    assert.strictEqual(actual.brewType, expected.brewType)
  }

  if (expected.originalName !== undefined) {
    assert.strictEqual(actual.originalName, expected.originalName)
  }

  if (expected.status !== undefined) {
    assert.strictEqual(actual.status, expected.status)
  }
}

/**
 * Assert that a BrewCommandResult has the expected structure
 */
export function assertBrewCommandResult(actual: BrewCommandResult, expected: Partial<BrewCommandResult>): void {
  assert.strictEqual(typeof actual.exitCode, 'number', 'exitCode should be number')
  assert.strictEqual(typeof actual.stderr, 'string', 'stderr should be string')
  assert.strictEqual(typeof actual.stdout, 'string', 'stdout should be string')
  assert.strictEqual(typeof actual.success, 'boolean', 'success should be boolean')

  if (expected.exitCode !== undefined) {
    assert.strictEqual(actual.exitCode, expected.exitCode)
  }

  if (expected.stderr !== undefined) {
    assert.strictEqual(actual.stderr, expected.stderr)
  }

  if (expected.stdout !== undefined) {
    assert.strictEqual(actual.stdout, expected.stdout)
  }

  if (expected.success !== undefined) {
    assert.strictEqual(actual.success, expected.success)
  }
}

/**
 * Assert that a string contains ANSI color codes
 */
export function assertHasAnsiColors(text: string): void {
  assert.ok(/\u001B\[[0-9;]*m/.test(text), 'Text should contain ANSI color codes')
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(value: number, min: number, max: number): void {
  assert.ok(value >= min && value <= max, `Value ${value} should be between ${min} and ${max}`)
}

/**
 * Assert that a string does not contain ANSI color codes
 */
export function assertNoAnsiColors(text: string): void {
  assert.ok(!/\u001B\[[0-9;]*m/.test(text), 'Text should not contain ANSI color codes')
}

/**
 * Assert that an array contains no duplicates
 */
export function assertNoDuplicates<T>(array: T[]): void {
  const set = new Set(array)
  assert.strictEqual(array.length, set.size, 'Array should not contain duplicates')
}
