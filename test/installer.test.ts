/**
 * Test file for installer.ts
 */

import { describe, expect, test } from 'bun:test'
import { getInstallationSummary } from '../src/installer.ts'
import type {
  AppInfo,
  InstallationResult,
  PackageInstallResult,
} from '../src/types.ts'

describe('getInstallationSummary', () => {
  test('should create dry run summary with no apps', () => {
    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: true,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('DRY RUN SUMMARY')
    expect(summary).toContain('═'.repeat(50))
  })

  test('should create installation summary with successful installs', () => {
    const installedApp: PackageInstallResult = {
      appName: 'Test App',
      dryRun: false,
      packageName: 'test-app',
      success: true,
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [],
      ignored: [],
      installed: [installedApp],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    expect(summary).toContain('Successfully installed: 1')
    expect(summary).toContain('Test App')
    expect(summary).toContain('test-app')
  })

  test('should create installation summary with failed installs', () => {
    const failedApp: PackageInstallResult = {
      appName: 'Failed App',
      dryRun: false,
      error: 'Installation failed',
      packageName: 'failed-app',
      success: false,
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [failedApp],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    expect(summary).toContain('Failed to install: 1')
    expect(summary).toContain('Failed App')
    expect(summary).toContain('Installation failed')
  })

  test('should create summary with both successful and failed installs', () => {
    const installedApp: PackageInstallResult = {
      appName: 'Success App',
      dryRun: false,
      packageName: 'success-app',
      success: true,
    }

    const failedApp: PackageInstallResult = {
      appName: 'Failed App',
      dryRun: false,
      error: 'Installation failed',
      packageName: 'failed-app',
      success: false,
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [failedApp],
      ignored: [],
      installed: [installedApp],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    expect(summary).toContain('Successfully installed: 1')
    expect(summary).toContain('Failed to install: 1')
    expect(summary).toContain('Success App')
    expect(summary).toContain('Failed App')
  })

  test('should handle failed install without error message', () => {
    const failedApp: PackageInstallResult = {
      appName: 'Failed App',
      dryRun: false,
      packageName: 'failed-app',
      success: false,
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [failedApp],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('Failed to install: 1')
    expect(summary).toContain('Failed App')
    expect(summary).toContain('Unknown error')
  })

  test('should handle already installed apps', () => {
    const alreadyInstalledApp: AppInfo = {
      alreadyInstalled: true,
      appPath: '/Applications/Test App.app',
      brewName: 'test-app',
      brewType: 'cask',
      originalName: 'Test App',
      status: 'already-installed',
    }

    const result: InstallationResult = {
      alreadyInstalled: [alreadyInstalledApp],
      dryRun: false,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    // Currently getInstallationSummary doesn't handle alreadyInstalled,
    // so it should show "No packages were processed"
    expect(summary).toContain('No packages were processed')
  })

  test('should handle ignored apps', () => {
    const ignoredApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Ignored App.app',
      brewName: 'ignored-app',
      brewType: 'cask',
      originalName: 'Ignored App',
      status: 'ignored',
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [],
      ignored: [ignoredApp],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    // Currently getInstallationSummary doesn't handle ignored,
    // so it should show "No packages were processed"
    expect(summary).toContain('No packages were processed')
  })

  test('should handle unavailable apps', () => {
    const unavailableApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Unavailable App.app',
      brewName: 'unavailable-app',
      brewType: 'unavailable',
      originalName: 'Unavailable App',
      status: 'unavailable',
    }

    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [unavailableApp],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    // Currently getInstallationSummary doesn't handle unavailable,
    // so it should show "No packages were processed"
    expect(summary).toContain('No packages were processed')
  })

  test('should handle comprehensive summary with all types', () => {
    const installedApp: PackageInstallResult = {
      appName: 'Installed App',
      dryRun: false,
      packageName: 'installed-app',
      success: true,
    }

    const failedApp: PackageInstallResult = {
      appName: 'Failed App',
      dryRun: false,
      error: 'Installation failed',
      packageName: 'failed-app',
      success: false,
    }

    const alreadyInstalledApp: AppInfo = {
      alreadyInstalled: true,
      appPath: '/Applications/Already App.app',
      brewName: 'already-app',
      brewType: 'cask',
      originalName: 'Already App',
      status: 'already-installed',
    }

    const ignoredApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Ignored App.app',
      brewName: 'ignored-app',
      brewType: 'cask',
      originalName: 'Ignored App',
      status: 'ignored',
    }

    const unavailableApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Unavailable App.app',
      brewName: 'unavailable-app',
      brewType: 'unavailable',
      originalName: 'Unavailable App',
      status: 'unavailable',
    }

    const result: InstallationResult = {
      alreadyInstalled: [alreadyInstalledApp],
      dryRun: false,
      failed: [failedApp],
      ignored: [ignoredApp],
      installed: [installedApp],
      unavailable: [unavailableApp],
    }

    const summary = getInstallationSummary(result)
    expect(summary).toContain('INSTALLATION SUMMARY')
    expect(summary).toContain('Successfully installed: 1')
    expect(summary).toContain('Failed to install: 1')
    expect(summary).toContain('Installed App')
    expect(summary).toContain('Failed App')
    // Currently getInstallationSummary doesn't include alreadyInstalled, ignored, unavailable
    // but since we have installed and failed, it won't show "No packages were processed"
    expect(summary).not.toContain('No packages were processed')
  })
})
