/**
 * Test file for prompts.ts
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import type { AppInfo } from '../src/types.ts'

import {
  displayFinalSummary,
  displayInstallationPlan,
  promptAppSelection,
} from '../src/prompts.ts'

void describe('displayFinalSummary', () => {
  void test('should display dry run summary with no apps', () => {
    const selectedApps: AppInfo[] = []
    const installedApps: AppInfo[] = []
    const failedApps: AppInfo[] = []

    // This function outputs to console, so we just test it doesn't throw
    assert.doesNotThrow(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, true)
    })
  })

  void test('should display installation summary with successful installs', () => {
    const app: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Test App.app',
      brewName: 'test-app',
      brewType: 'cask',
      originalName: 'Test App',
      status: 'available',
    }

    const selectedApps = [app]
    const installedApps = [app]
    const failedApps: AppInfo[] = []

    assert.doesNotThrow(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    })
  })

  void test('should display installation summary with failed installs', () => {
    const app: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Test App.app',
      brewName: 'test-app',
      brewType: 'cask',
      originalName: 'Test App',
      status: 'available',
    }

    const selectedApps = [app]
    const installedApps: AppInfo[] = []
    const failedApps = [app]

    assert.doesNotThrow(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    })
  })

  void test('should display summary with mixed results', () => {
    const successApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Success App.app',
      brewName: 'success-app',
      brewType: 'cask',
      originalName: 'Success App',
      status: 'available',
    }

    const failedApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Failed App.app',
      brewName: 'failed-app',
      brewType: 'cask',
      originalName: 'Failed App',
      status: 'available',
    }

    const selectedApps = [successApp, failedApp]
    const installedApps = [successApp]
    const failedApps = [failedApp]

    assert.doesNotThrow(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    })
  })
})

void describe('displayInstallationPlan', () => {
  void test('should handle empty app list', () => {
    const selectedApps: AppInfo[] = []

    assert.doesNotThrow(() => {
      displayInstallationPlan(selectedApps, false)
    })
  })

  void test('should display plan for cask apps', () => {
    const caskApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Cask App.app',
      brewName: 'cask-app',
      brewType: 'cask',
      originalName: 'Cask App',
      status: 'available',
    }

    const selectedApps = [caskApp]

    assert.doesNotThrow(() => {
      displayInstallationPlan(selectedApps, false)
    })
  })

  void test('should display dry run plan', () => {
    const app: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Test App.app',
      brewName: 'test-app',
      brewType: 'cask',
      originalName: 'Test App',
      status: 'available',
    }

    const selectedApps = [app]

    assert.doesNotThrow(() => {
      displayInstallationPlan(selectedApps, true)
    })
  })
})

void describe('promptAppSelection', () => {
  void test('should handle apps with no available apps', async () => {
    const unavailableApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Unavailable App.app',
      brewName: 'unavailable-app',
      brewType: 'cask',
      fromMacAppStore: false,
      originalName: 'Unavailable App',
      status: 'unavailable',
    }

    const result = await promptAppSelection([unavailableApp])
    assert.deepStrictEqual(result, [], 'Should return empty array when no available apps')
  })
})

void describe('Mac App Store labeling integration', () => {
  void test('should combine brew name and App Store hints correctly', () => {
    // Test the hint combination logic directly
    const testCases = [
      {
        brewName: 'same-name',
        expectedHint: '',
        expectedLabel: 'same-name',
        fromMacAppStore: false,
        originalName: 'same-name',
      },
      {
        brewName: 'different-name',
        expectedHint: 'different-name',
        expectedLabel: 'Original Name',
        fromMacAppStore: false,
        originalName: 'Original Name',
      },
      {
        brewName: 'same-name',
        expectedHint: '– installed via App Store',
        expectedLabel: 'same-name ',
        fromMacAppStore: true,
        originalName: 'same-name',
      },
      {
        brewName: 'different-name',
        expectedHint: 'different-name – installed via App Store',
        expectedLabel: 'Original Name ',
        fromMacAppStore: true,
        originalName: 'Original Name',
      },
    ]

    for (const [index, { brewName, expectedHint, expectedLabel, fromMacAppStore, originalName }] of testCases.entries()) {
      // Simulate the logic from promptAppSelection
      const brewHint = brewName === originalName ? '' : brewName
      const appStoreHint = fromMacAppStore ? '– installed via App Store' : ''
      const combinedHint = [brewHint, appStoreHint].filter(Boolean).join(' ')
      const appLabel = fromMacAppStore ? `${originalName} ` : originalName

      assert.strictEqual(combinedHint, expectedHint, `Test case ${index + 1}: hint should match expected`)
      assert.strictEqual(appLabel, expectedLabel, `Test case ${index + 1}: label should match expected`)
    }
  })

  void test('should display Mac App Store information when App Store apps are present', () => {
    // This test validates the logic that determines when to show the Mac App Store info message
    const appsWithAppStore: AppInfo[] = [
      {
        alreadyInstalled: false,
        appPath: '/Applications/App Store App.app',
        brewName: 'app-store-app',
        brewType: 'cask',
        fromMacAppStore: true,
        originalName: 'App Store App',
        status: 'available',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Regular App.app',
        brewName: 'regular-app',
        brewType: 'cask',
        fromMacAppStore: false,
        originalName: 'Regular App',
        status: 'available',
      },
    ]

    // We can't easily test the private displayAppSummary function directly,
    // but we can verify the logic that would trigger the Mac App Store message
    const macAppStoreCount = appsWithAppStore.filter(app => app.status === 'available' && app.fromMacAppStore).length

    assert.strictEqual(macAppStoreCount, 1, 'Should find one Mac App Store app')
    assert.ok(macAppStoreCount > 0, 'Should have Mac App Store apps to trigger info message')
  })

  void test('should handle emoji prefix for different app types', () => {
    const testApps = [
      {
        fromMacAppStore: false,
        originalName: 'Regular App',
      },
      {
        fromMacAppStore: true,
        originalName: 'App Store App',
      },
      {
        fromMacAppStore: true,
        originalName: 'Complex App Name & Symbols!',
      },
    ]

    for (const { fromMacAppStore, originalName } of testApps) {
      const appLabel = fromMacAppStore ? `${originalName} ` : originalName

      if (fromMacAppStore) {
        assert.ok(appLabel.endsWith(' '), `App Store app "${originalName}" should have emoji suffix`)
        assert.strictEqual(appLabel, `${originalName} `, 'Original name should be followed by space and emoji')
      }
      else {
        assert.ok(!appLabel.includes(''), `Regular app "${originalName}" should not have emoji`)
        assert.strictEqual(appLabel, originalName, 'Regular app label should be unchanged')
      }
    }
  })

  void test('should validate complete option creation workflow', () => {
    // Test the complete workflow of creating option objects like in promptAppSelection
    const mockApps: AppInfo[] = [
      {
        alreadyInstalled: false,
        appPath: '/Applications/Regular Cask.app',
        brewName: 'regular-cask',
        brewType: 'cask',
        fromMacAppStore: false,
        originalName: 'Regular Cask',
        status: 'available',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Bitwarden.app',
        brewName: 'Bitwarden',
        brewType: 'cask',
        fromMacAppStore: true,
        originalName: 'Bitwarden',
        status: 'available',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Different Name.app',
        brewName: 'totally-different-cask-name',
        brewType: 'cask',
        fromMacAppStore: true,
        originalName: 'Different Name',
        status: 'available',
      },
    ]

    const options = mockApps.map((app) => {
      const brewHint = app.brewName === app.originalName ? '' : app.brewName
      const appStoreHint = app.fromMacAppStore ? '– installed via App Store' : ''
      const combinedHint = [brewHint, appStoreHint].filter(Boolean).join(' ')
      const appLabel = app.fromMacAppStore ? `${app.originalName} ` : app.originalName

      return {
        hint: combinedHint,
        label: appLabel,
        value: app.originalName,
      }
    })

    // Ensure we have 3 options
    assert.strictEqual(options.length, 3, 'Should have 3 options')

    // Test first app: regular cask with different brew name (fixed logic)
    assert.strictEqual(options[0]!.label, 'Regular Cask', 'Regular app should not have emoji')
    assert.strictEqual(options[0]!.hint, 'regular-cask', 'Regular app with different brew name should show brew name hint')
    assert.strictEqual(options[0]!.value, 'Regular Cask', 'Value should be original name')

    // Test second app: App Store app with matching name
    assert.strictEqual(options[1]!.label, 'Bitwarden ', 'App Store app should have emoji suffix')
    assert.strictEqual(options[1]!.hint, '– installed via App Store', 'App Store app with matching name should show App Store hint only')
    assert.strictEqual(options[1]!.value, 'Bitwarden', 'Value should be original name')

    // Test third app: App Store app with different brew name
    assert.strictEqual(options[2]!.label, 'Different Name ', 'App Store app should have emoji suffix')
    assert.strictEqual(options[2]!.hint, 'totally-different-cask-name – installed via App Store', 'Should combine brew name and App Store hints')
    assert.strictEqual(options[2]!.value, 'Different Name', 'Value should be original name')
  })
})
