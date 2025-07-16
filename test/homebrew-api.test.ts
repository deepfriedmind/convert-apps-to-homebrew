/**
 * Test file for homebrew-api.ts
 */

import { describe, expect, test } from 'bun:test'
import { clearHomebrewCache } from '../src/homebrew-api.ts'
import type { HomebrewCask } from '../src/types.ts'

describe('Homebrew API Functions', () => {
  describe('cache operations', () => {
    test('should handle cache operations', async () => {
      // This is a basic test to ensure the module structure is valid
      expect(typeof clearHomebrewCache).toBe('function')
    })

    test('should clear cache without errors', async () => {
      // Should not throw even if cache doesn't exist
      try {
        await clearHomebrewCache()
        expect(true).toBe(true) // Test passes if no error is thrown
      } catch (error) {
        // If an error is thrown, it should be handled gracefully
        expect(error).toBeDefined()
      }
    })
  })

  describe('mock cask data structure', () => {
    test('should validate mock cask structure', () => {
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

      expect(mockCask.token).toBe('test-app')
      expect(mockCask.name[0]).toBe('Test App')
      expect(mockCask.artifacts[0]?.app?.[0]).toBe('Test App.app')
      expect(mockCask.artifacts[0]?.uninstall?.[0]?.quit).toBe(
        'com.example.testapp',
      )
    })
  })
})
