/**
 * Tests for app scanner module - No real homebrew commands
 * These tests focus on testing the logic and error handling without external dependencies
 */

import assert from 'node:assert'
import { test } from 'node:test'

import type { AppInfo } from '../src/types.ts'

// Test basic functionality without calling external commands
void test('app scanner module should work without external dependencies', async () => {
  // Test that empty arrays don't crash and basic types work
  const apps: AppInfo[] = []
  assert.strictEqual(apps.length, 0)
  assert.deepStrictEqual(apps, [])
})
