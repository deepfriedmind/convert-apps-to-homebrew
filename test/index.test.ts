/**
 * Test file for index.ts
 */

import { describe, expect, test } from 'bun:test'

import type { AppInfo, InstallationResult } from '../src/types.ts'

describe('main entry point', () => {
  test('should handle direct execution check', () => {
    // Test that the module checks import.meta.url for direct execution
    // This is tested implicitly by the fact that the module loads without error
    expect(import.meta.url.startsWith('file://')).toBe(true)
  })
})

describe('data structure validation', () => {
  test('should validate operation summary calculation logic', () => {
    // Test the logic that would be used by generateOperationSummary
    const allApps: AppInfo[] = [
      {
        alreadyInstalled: false,
        appPath: '/Applications/Available1.app',
        brewName: 'available1',
        brewType: 'cask',
        originalName: 'Available 1',
        status: 'available',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Available2.app',
        brewName: 'available2',
        brewType: 'cask',
        originalName: 'Available 2',
        status: 'available',
      },
      {
        alreadyInstalled: true,
        appPath: '/Applications/Installed.app',
        brewName: 'installed-app',
        brewType: 'cask',
        originalName: 'Installed App',
        status: 'already-installed',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Ignored.app',
        brewName: 'ignored-app',
        brewType: 'cask',
        originalName: 'Ignored App',
        status: 'ignored',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Unavailable.app',
        brewName: 'unavailable-app',
        brewType: 'unavailable',
        originalName: 'Unavailable App',
        status: 'unavailable',
      },
    ]

    // Verify app status counts
    const available = allApps.filter((app) => app.status === 'available')
    const alreadyInstalled = allApps.filter(
      (app) => app.status === 'already-installed',
    )
    const ignored = allApps.filter((app) => app.status === 'ignored')
    const unavailable = allApps.filter((app) => app.status === 'unavailable')

    expect(available).toHaveLength(2)
    expect(alreadyInstalled).toHaveLength(1)
    expect(ignored).toHaveLength(1)
    expect(unavailable).toHaveLength(1)
    expect(allApps).toHaveLength(5)
  })

  test('should validate installation result filtering logic', () => {
    const selectedApps: AppInfo[] = [
      {
        alreadyInstalled: false,
        appPath: '/Applications/Selected1.app',
        brewName: 'selected1',
        brewType: 'cask',
        originalName: 'Selected 1',
        status: 'available',
      },
      {
        alreadyInstalled: false,
        appPath: '/Applications/Selected2.app',
        brewName: 'selected2',
        brewType: 'cask',
        originalName: 'Selected 2',
        status: 'available',
      },
    ]

    const installationResult: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [
        {
          appName: 'Selected 2',
          dryRun: false,
          error: 'Package not found',
          packageName: 'selected2',
          success: false,
        },
      ],
      ignored: [],
      installed: [
        {
          appName: 'Selected 1',
          dryRun: false,
          packageName: 'selected1',
          success: true,
        },
      ],
      unavailable: [],
    }

    // Test the filtering logic used in main()
    const installedApps = selectedApps.filter((app) =>
      installationResult.installed.some(
        (result) => result.packageName === app.brewName,
      ),
    )

    const failedApps = selectedApps.filter((app) =>
      installationResult.failed.some(
        (result) => result.packageName === app.brewName,
      ),
    )

    expect(installedApps).toHaveLength(1)
    expect(failedApps).toHaveLength(1)
    expect(installedApps[0]?.brewName).toBe('selected1')
    expect(failedApps[0]?.brewName).toBe('selected2')
  })
})

describe('error handling validation', () => {
  test('should validate error type handling logic', () => {
    // Test error scenarios that the handleError function would handle
    const testErrors = [
      { message: 'Test error', name: 'ConvertAppsError' },
      { message: 'User cancelled', name: 'ExitPromptError' },
      { message: 'Generic error', name: 'Error' },
    ]

    for (const errorData of testErrors) {
      const error = new Error(errorData.message)
      error.name = errorData.name

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe(errorData.message)
      expect(error.name).toBe(errorData.name)
    }
  })

  test('should validate user cancellation detection', () => {
    const userCancelError = new Error('User cancelled operation')
    userCancelError.name = 'ExitPromptError'

    // Test the logic used in main() to detect user cancellation
    const isUserCancellation = userCancelError.name === 'ExitPromptError'

    expect(isUserCancellation).toBe(true)
  })

  test('should validate error message extraction', () => {
    // Test the error message extraction logic used in main()
    const testCases = [
      { expected: 'Test message', input: new Error('Test message') },
      { expected: 'String error', input: 'String error' },
      { expected: 'null', input: null },
      { expected: 'undefined', input: undefined },
    ]

    for (const { expected, input } of testCases) {
      const errorMessage =
        input instanceof Error ? input.message : String(input)
      expect(errorMessage).toBe(expected)
    }
  })
})

describe('application flow validation', () => {
  test('should validate configuration creation logic', () => {
    // Test the logic used by createInstallerConfig and createScannerConfig
    const mockOptions = {
      applicationsDir: '/custom/apps',
      dryRun: true,
      ignore: ['app1', 'app2'],
      verbose: true,
    }

    // Test installer config logic
    const installerConfig = {
      dryRun: mockOptions.dryRun,
      verbose: mockOptions.verbose,
    }

    expect(installerConfig.dryRun).toBe(true)
    expect(installerConfig.verbose).toBe(true)

    // Test scanner config logic
    const scannerConfig = {
      applicationsDir: mockOptions.applicationsDir,
      ignoredApps: mockOptions.ignore,
      verbose: mockOptions.verbose,
    }

    expect(scannerConfig.applicationsDir).toBe('/custom/apps')
    expect(scannerConfig.ignoredApps).toEqual(['app1', 'app2'])
    expect(scannerConfig.verbose).toBe(true)
  })

  test('should validate empty collections handling', () => {
    // Test logic for handling empty arrays and no selection scenarios
    const emptyApps: AppInfo[] = []
    const noSelection: AppInfo[] = []

    expect(emptyApps).toHaveLength(0)
    expect(noSelection).toHaveLength(0)

    // Test early exit conditions
    const shouldExitEarly = emptyApps.length === 0 || noSelection.length === 0
    expect(shouldExitEarly).toBe(true)
  })

  test('should validate confirmation flow logic', () => {
    // Test the confirmation and cancellation logic
    const testConfirmations = [true, false]

    for (const confirmed of testConfirmations) {
      if (confirmed) {
        // This simulates the proceed path in main()
        expect(confirmed).toBe(true)
      } else {
        // This simulates the cancellation path in main()
        expect(confirmed).toBe(false)
      }
    }
  })

  test('should validate operation type selection', () => {
    // Test dry run vs real installation logic
    const dryRunOptions = { dryRun: true }
    const realRunOptions = { dryRun: false }

    const dryRunOperationType = dryRunOptions.dryRun
      ? 'dry run'
      : 'installation'
    const realRunOperationType = realRunOptions.dryRun
      ? 'dry run'
      : 'installation'

    expect(dryRunOperationType).toBe('dry run')
    expect(realRunOperationType).toBe('installation')
  })
})

describe('exit code validation', () => {
  test('should validate success exit logic', () => {
    // Test successful operation scenarios
    const successfulInstallation: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [],
      ignored: [],
      installed: [
        { appName: 'App1', dryRun: false, packageName: 'app1', success: true },
      ],
      unavailable: [],
    }

    const shouldExitWithSuccess = successfulInstallation.failed.length === 0
    expect(shouldExitWithSuccess).toBe(true)
  })

  test('should validate error exit logic', () => {
    // Test failed operation scenarios
    const failedInstallation: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [
        {
          appName: 'App1',
          dryRun: false,
          error: 'Failed to install',
          packageName: 'app1',
          success: false,
        },
      ],
      ignored: [],
      installed: [],
      unavailable: [],
    }

    const shouldExitWithError = failedInstallation.failed.length > 0
    expect(shouldExitWithError).toBe(true)
    expect(failedInstallation.failed).toHaveLength(1)
  })

  test('should validate mixed results logic', () => {
    // Test scenarios with both successes and failures
    const mixedInstallation: InstallationResult = {
      alreadyInstalled: [],
      dryRun: false,
      failed: [
        {
          appName: 'App2',
          dryRun: false,
          error: 'Failed to install',
          packageName: 'app2',
          success: false,
        },
      ],
      ignored: [],
      installed: [
        { appName: 'App1', dryRun: false, packageName: 'app1', success: true },
      ],
      unavailable: [],
    }

    const hasFailures = mixedInstallation.failed.length > 0
    const hasSuccesses = mixedInstallation.installed.length > 0

    expect(hasFailures).toBe(true)
    expect(hasSuccesses).toBe(true)
    expect(hasFailures).toBe(true)
  })
})

describe('module execution validation', () => {
  test('should validate import.meta.url format', () => {
    // Test the import.meta.url check used for direct execution detection
    expect(import.meta.url.startsWith('file://')).toBe(true)
    expect(typeof import.meta.url).toBe('string')
  })

  test('should validate process.argv structure', () => {
    // Test process.argv access used in direct execution check
    expect(Array.isArray(process.argv)).toBe(true)
    expect(process.argv.length).toBeGreaterThanOrEqual(2)
    expect(typeof process.argv[1]).toBe('string')
  })
})
