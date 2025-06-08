/**
 * Test file for prompts.ts
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import type { AppInfo } from '../src/types.ts'

import {
  displayFinalSummary,
  displayInstallationPlan,
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
      brewType: 'formula',
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
      displayInstallationPlan(selectedApps, undefined, false)
    })
  })

  void test('should display plan for cask apps with sudo', () => {
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
      displayInstallationPlan(selectedApps, 'sudo-password', false)
    })
  })

  void test('should display plan for cask apps without sudo', () => {
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
      displayInstallationPlan(selectedApps, undefined, false)
    })
  })

  void test('should display plan for formula apps', () => {
    const formulaApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Formula App.app',
      brewName: 'formula-app',
      brewType: 'formula',
      originalName: 'Formula App',
      status: 'available',
    }

    const selectedApps = [formulaApp]

    assert.doesNotThrow(() => {
      displayInstallationPlan(selectedApps, undefined, false)
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
      displayInstallationPlan(selectedApps, undefined, true)
    })
  })

  void test('should display mixed casks and formulas', () => {
    const caskApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Cask App.app',
      brewName: 'cask-app',
      brewType: 'cask',
      originalName: 'Cask App',
      status: 'available',
    }

    const formulaApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Formula App.app',
      brewName: 'formula-app',
      brewType: 'formula',
      originalName: 'Formula App',
      status: 'available',
    }

    const selectedApps = [caskApp, formulaApp]

    assert.doesNotThrow(() => {
      displayInstallationPlan(selectedApps, 'sudo-password', false)
    })
  })
})

// NOTE: promptConfirmation and promptSudoPassword tests are skipped because they require
// interactive user input which causes test timeouts. These functions are tested manually
// during integration testing.
