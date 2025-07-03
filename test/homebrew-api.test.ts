/**
 * Tests for Homebrew API client
 */

import assert from 'node:assert'
import { test } from 'node:test'

import type { HomebrewCask } from '../src/types.ts'

import { clearHomebrewCache, getHomebrewCacheInfo } from '../src/homebrew-api.ts'

void test('Homebrew API Functions', async (testContext) => {
  await testContext.test('should handle cache operations', async () => {
    // Clear any existing cache first
    await clearHomebrewCache()

    // Test cache info for non-existent cache
    const cacheInfo = await getHomebrewCacheInfo()
    assert.strictEqual(cacheInfo.exists, false)
  })

  await testContext.test('should clear cache without errors', async () => {
    // Should not throw even if cache doesn't exist
    await clearHomebrewCache()
  })
})

void test('mock cask data structure', () => {
  const mockCask: HomebrewCask = {
    artifacts: [
      {
        app: ['Test App.app'],
        uninstall: [
          {
            quit: 'com.example.testapp',
          },
        ],
      },
    ],
    desc: 'A test application',
    full_token: 'homebrew/cask/test-app',
    homepage: 'https://example.com',
    name: ['Test App'],
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'test-app',
  }

  assert.strictEqual(mockCask.token, 'test-app')
  assert.strictEqual(mockCask.name[0], 'Test App')
  assert.strictEqual(mockCask.artifacts[0]?.app?.[0], 'Test App.app')
  assert.strictEqual(mockCask.artifacts[0]?.uninstall?.[0]?.quit, 'com.example.testapp')
})
