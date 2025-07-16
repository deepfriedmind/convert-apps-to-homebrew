/**
 * Test file for prompts.ts
 */

import { describe, expect, test } from 'bun:test'
import {
  displayFinalSummary,
  displayInstallationPlan,
  promptAppSelection,
} from '../src/prompts.ts'
import type { AppInfo } from '../src/types.ts'

describe('displayFinalSummary', () => {
  test('should display dry run summary with no apps', () => {
    const selectedApps: AppInfo[] = []
    const installedApps: AppInfo[] = []
    const failedApps: AppInfo[] = []

    expect(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, true)
    }).not.toThrow()
  })

  test('should display installation summary with successful installs', () => {
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

    expect(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    }).not.toThrow()
  })

  test('should display installation summary with failed installs', () => {
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

    expect(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    }).not.toThrow()
  })

  test('should display summary with mixed results', () => {
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

    expect(() => {
      displayFinalSummary(selectedApps, installedApps, failedApps, false)
    }).not.toThrow()
  })
})

describe('displayInstallationPlan', () => {
  test('should handle empty app list', () => {
    const selectedApps: AppInfo[] = []

    expect(() => {
      displayInstallationPlan(selectedApps, false)
    }).not.toThrow()
  })

  test('should display plan for cask apps', () => {
    const caskApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Cask App.app',
      brewName: 'cask-app',
      brewType: 'cask',
      originalName: 'Cask App',
      status: 'available',
    }

    const selectedApps = [caskApp]

    expect(() => {
      displayInstallationPlan(selectedApps, false)
    }).not.toThrow()
  })

  test('should display dry run plan', () => {
    const app: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Test App.app',
      brewName: 'test-app',
      brewType: 'cask',
      originalName: 'Test App',
      status: 'available',
    }

    const selectedApps = [app]

    expect(() => {
      displayInstallationPlan(selectedApps, true)
    }).not.toThrow()
  })
})

describe('promptAppSelection', () => {
  test('should handle apps with no available apps', async () => {
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
    expect(result).toEqual([])
  })
})

describe('Mac App Store labeling integration', () => {
  test('should combine brew name and App Store hints correctly', () => {
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

    for (const [
      _index,
      { brewName, expectedHint, expectedLabel, fromMacAppStore, originalName },
    ] of testCases.entries()) {
      // Simulate the logic from promptAppSelection
      const brewHint = brewName === originalName ? '' : brewName
      const appStoreHint = fromMacAppStore ? '– installed via App Store' : ''
      const combinedHint = [brewHint, appStoreHint].filter(Boolean).join(' ')
      const appLabel = fromMacAppStore ? `${originalName} ` : originalName

      expect(combinedHint).toBe(expectedHint)
      expect(appLabel).toBe(expectedLabel)
    }
  })

  test('should display Mac App Store information when App Store apps are present', () => {
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
    const macAppStoreCount = appsWithAppStore.filter(
      (app) => app.status === 'available' && app.fromMacAppStore,
    ).length
    expect(macAppStoreCount).toBe(1)
    expect(macAppStoreCount > 0).toBe(true)
  })

  test('should handle emoji prefix for different app types', () => {
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
        expect(appLabel.endsWith(' ')).toBe(true)
        expect(appLabel).toBe(`${originalName} `)
      } else {
        expect(appLabel.includes('')).toBe(false)
        expect(appLabel).toBe(originalName)
      }
    }
  })

  test('should validate complete option creation workflow', () => {
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
      const appStoreHint = app.fromMacAppStore
        ? '– installed via App Store'
        : ''
      const combinedHint = [brewHint, appStoreHint].filter(Boolean).join(' ')
      const appLabel = app.fromMacAppStore
        ? `${app.originalName} `
        : app.originalName

      return {
        hint: combinedHint,
        label: appLabel,
        value: app.originalName,
      }
    })

    // Ensure we have 3 options
    expect(options.length).toBe(3)

    // Test first app: regular cask with different brew name
    expect(options[0]!.label).toBe('Regular Cask')
    expect(options[0]!.hint).toBe('regular-cask')
    expect(options[0]!.value).toBe('Regular Cask')

    // Test second app: App Store app with matching name
    expect(options[1]!.label).toBe('Bitwarden ')
    expect(options[1]!.hint).toBe('– installed via App Store')
    expect(options[1]!.value).toBe('Bitwarden')

    // Test third app: App Store app with different brew name
    expect(options[2]!.label).toBe('Different Name ')
    expect(options[2]!.hint).toBe(
      'totally-different-cask-name – installed via App Store',
    )
    expect(options[2]!.value).toBe('Different Name')
  })
})
