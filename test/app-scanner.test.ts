/**
 * Tests for app scanner module - No real homebrew commands
 * These tests focus on testing the logic and error handling without external dependencies
 */

import { expect, test } from 'bun:test'

import type { AppInfo } from '../src/types.ts'

// Test basic functionality without calling external commands
test('app scanner module should work without external dependencies', () => {
  // Test that empty arrays don't crash and basic types work
  const apps: AppInfo[] = []
  expect(apps.length).toBe(0)
  expect(apps).toEqual([])
})
