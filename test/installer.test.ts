/**
 * Test file for installer.ts
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import type { AppInfo, InstallationResult, PackageInstallResult } from '../src/types.ts'

import { getInstallationSummary } from '../src/installer.ts'

void describe('getInstallationSummary', () => {
  void test('should create dry run summary with no apps', () => {
    const result: InstallationResult = {
      alreadyInstalled: [],
      dryRun: true,
      failed: [],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const summary = getInstallationSummary(result)
    assert.ok(summary.includes('DRY RUN SUMMARY'))
    assert.ok(summary.includes('═'.repeat(50)))
  })

  void test('should create installation summary with successful installs', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    assert.ok(summary.includes('Successfully installed: 1'))
    assert.ok(summary.includes('Test App'))
    assert.ok(summary.includes('test-app'))
  })

  void test('should create installation summary with failed installs', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    assert.ok(summary.includes('Failed to install: 1'))
    assert.ok(summary.includes('Failed App'))
    assert.ok(summary.includes('Installation failed'))
  })

  void test('should create summary with both successful and failed installs', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    assert.ok(summary.includes('Successfully installed: 1'))
    assert.ok(summary.includes('Failed to install: 1'))
    assert.ok(summary.includes('Success App'))
    assert.ok(summary.includes('Failed App'))
  })

  void test('should handle failed install without error message', () => {
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
    assert.ok(summary.includes('Failed to install: 1'))
    assert.ok(summary.includes('Failed App'))
    assert.ok(summary.includes('Unknown error'))
  })

  void test('should handle already installed apps', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    // Currently getInstallationSummary doesn't handle alreadyInstalled,
    // so it should show "No packages were processed"
    assert.ok(summary.includes('No packages were processed'))
  })

  void test('should handle ignored apps', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    // Currently getInstallationSummary doesn't handle ignored,
    // so it should show "No packages were processed"
    assert.ok(summary.includes('No packages were processed'))
  })

  void test('should handle unavailable apps', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    // Currently getInstallationSummary doesn't handle unavailable,
    // so it should show "No packages were processed"
    assert.ok(summary.includes('No packages were processed'))
  })

  void test('should handle comprehensive summary with all types', () => {
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
    assert.ok(summary.includes('INSTALLATION SUMMARY'))
    assert.ok(summary.includes('Successfully installed: 1'))
    assert.ok(summary.includes('Failed to install: 1'))
    assert.ok(summary.includes('Installed App'))
    assert.ok(summary.includes('Failed App'))
    // Currently getInstallationSummary doesn't include alreadyInstalled, ignored, unavailable
    // but since we have installed and failed, it won't show "No packages were processed"
    assert.ok(!summary.includes('No packages were processed'))
  })
})
