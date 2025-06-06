/**
 * Tests for types module
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import type { AppChoice, AppInfo, AppStatus, BrewCommandResult, BrewPackageType, CommandOptions, ErrorTypeValue, InstallationResult, InstallerConfig, Logger, OperationSummary, PackageInstallResult, ProgressCallback, ScannerConfig } from '../src/types.js'
import {

  ConvertAppsError,
  ErrorType,

} from '../src/types.js'

// Helper function for testing ProgressCallback
const testCallback: ProgressCallback = (message: string, current: number, total: number) => {
  // Validate parameters
  assert.strictEqual(typeof message, 'string')
  assert.strictEqual(typeof current, 'number')
  assert.strictEqual(typeof total, 'number')
}

void describe('types', () => {
  void describe('ErrorType constant', () => {
    void test('should have all required error types', () => {
      assert.strictEqual(typeof ErrorType.COMMAND_FAILED, 'string')
      assert.strictEqual(typeof ErrorType.FILE_NOT_FOUND, 'string')
      assert.strictEqual(typeof ErrorType.HOMEBREW_NOT_INSTALLED, 'string')
      assert.strictEqual(typeof ErrorType.INVALID_INPUT, 'string')
      assert.strictEqual(typeof ErrorType.NETWORK_ERROR, 'string')
      assert.strictEqual(typeof ErrorType.PERMISSION_DENIED, 'string')
      assert.strictEqual(typeof ErrorType.UNKNOWN_ERROR, 'string')
    })

    void test('should have correct error type values', () => {
      assert.strictEqual(ErrorType.COMMAND_FAILED, 'COMMAND_FAILED')
      assert.strictEqual(ErrorType.FILE_NOT_FOUND, 'FILE_NOT_FOUND')
      assert.strictEqual(ErrorType.HOMEBREW_NOT_INSTALLED, 'HOMEBREW_NOT_INSTALLED')
      assert.strictEqual(ErrorType.INVALID_INPUT, 'INVALID_INPUT')
      assert.strictEqual(ErrorType.NETWORK_ERROR, 'NETWORK_ERROR')
      assert.strictEqual(ErrorType.PERMISSION_DENIED, 'PERMISSION_DENIED')
      assert.strictEqual(ErrorType.UNKNOWN_ERROR, 'UNKNOWN_ERROR')
    })

    void test('should have unique error type values', () => {
      const values = Object.values(ErrorType)
      const uniqueValues = [...new Set(values)]
      assert.strictEqual(values.length, uniqueValues.length)
    })
  })

  void describe('ConvertAppsError class', () => {
    void test('should create error with message and type', () => {
      const error = new ConvertAppsError('Test error', ErrorType.COMMAND_FAILED)

      assert.strictEqual(error.message, 'Test error')
      assert.strictEqual(error.type, ErrorType.COMMAND_FAILED)
      assert.strictEqual(error.name, 'ConvertAppsError')
      assert.strictEqual(error.originalError, undefined)
    })

    void test('should create error with original error', () => {
      const originalError = new Error('Original error')
      const error = new ConvertAppsError('Wrapped error', ErrorType.NETWORK_ERROR, originalError)

      assert.strictEqual(error.message, 'Wrapped error')
      assert.strictEqual(error.type, ErrorType.NETWORK_ERROR)
      assert.strictEqual(error.originalError, originalError)
    })

    void test('should extend Error class', () => {
      const error = new ConvertAppsError('Test', ErrorType.UNKNOWN_ERROR)
      assert.ok(error instanceof Error)
      assert.ok(error instanceof ConvertAppsError)
    })

    void test('should have proper stack trace', () => {
      const error = new ConvertAppsError('Test', ErrorType.INVALID_INPUT)
      assert.ok(error.stack !== undefined && error.stack !== null)
      assert.ok(error.stack.includes('ConvertAppsError'))
    })
  })

  void describe('type validation', () => {
    void describe('AppStatus type', () => {
      void test('should accept valid app statuses', () => {
        const validStatuses: AppStatus[] = [
          'already-installed',
          'available',
          'ignored',
          'unavailable',
        ]

        // This test verifies TypeScript compilation - if invalid values were assigned,
        // TypeScript would catch them at compile time
        assert.strictEqual(validStatuses.length, 4)
      })
    })

    void describe('BrewPackageType type', () => {
      void test('should accept valid package types', () => {
        const validTypes: BrewPackageType[] = [
          'cask',
          'formula',
          'unavailable',
        ]

        assert.strictEqual(validTypes.length, 3)
      })
    })

    void describe('ErrorTypeValue type', () => {
      void test('should match ErrorType values', () => {
        const errorTypeValue: ErrorTypeValue = ErrorType.COMMAND_FAILED
        assert.strictEqual(errorTypeValue, 'COMMAND_FAILED')
      })
    })

    void describe('ProgressCallback type', () => {
      void test('should accept valid callback function', () => {
        // Test the callback
        testCallback('Test message', 1, 10)
      })
    })
  })

  void describe('interface validation', () => {
    void describe('AppChoice interface', () => {
      void test('should create valid AppChoice object', () => {
        const appInfo: AppInfo = {
          alreadyInstalled: false,
          appPath: '/Applications/TestApp.app',
          brewName: 'test-app',
          brewType: 'cask',
          originalName: 'TestApp',
          status: 'available',
        }

        const choice: AppChoice = {
          checked: false,
          name: 'TestApp',
          value: appInfo,
        }

        assert.strictEqual(choice.checked, false)
        assert.strictEqual(choice.name, 'TestApp')
        assert.strictEqual(choice.value, appInfo)
        assert.strictEqual(choice.disabled, undefined)
      })

      void test('should create AppChoice with disabled property', () => {
        const appInfo: AppInfo = {
          alreadyInstalled: true,
          appPath: '/Applications/TestApp.app',
          brewName: 'test-app',
          brewType: 'cask',
          originalName: 'TestApp',
          status: 'already-installed',
        }

        const choice: AppChoice = {
          checked: false,
          disabled: 'Already installed',
          name: 'TestApp (already installed)',
          value: appInfo,
        }

        assert.strictEqual(choice.disabled, 'Already installed')
      })
    })

    void describe('AppInfo interface', () => {
      void test('should create valid AppInfo object', () => {
        const appInfo: AppInfo = {
          alreadyInstalled: false,
          appPath: '/Applications/TestApp.app',
          brewName: 'test-app',
          brewType: 'cask',
          originalName: 'TestApp',
          status: 'available',
        }

        assert.strictEqual(appInfo.alreadyInstalled, false)
        assert.strictEqual(appInfo.appPath, '/Applications/TestApp.app')
        assert.strictEqual(appInfo.brewName, 'test-app')
        assert.strictEqual(appInfo.brewType, 'cask')
        assert.strictEqual(appInfo.originalName, 'TestApp')
        assert.strictEqual(appInfo.status, 'available')
      })
    })

    void describe('BrewCommandResult interface', () => {
      void test('should create valid BrewCommandResult object', () => {
        const result: BrewCommandResult = {
          exitCode: 0,
          stderr: '',
          stdout: 'Package installed successfully',
          success: true,
        }

        assert.strictEqual(result.exitCode, 0)
        assert.strictEqual(result.stderr, '')
        assert.strictEqual(result.stdout, 'Package installed successfully')
        assert.strictEqual(result.success, true)
      })

      void test('should create failed BrewCommandResult object', () => {
        const result: BrewCommandResult = {
          exitCode: 1,
          stderr: 'Package not found',
          stdout: '',
          success: false,
        }

        assert.strictEqual(result.exitCode, 1)
        assert.strictEqual(result.stderr, 'Package not found')
        assert.strictEqual(result.stdout, '')
        assert.strictEqual(result.success, false)
      })
    })

    void describe('CommandOptions interface', () => {
      void test('should create valid CommandOptions object', () => {
        const options: CommandOptions = {
          applicationsDir: '/Custom/Applications',
          dryRun: true,
          ignore: ['app1', 'app2'],
          verbose: true,
        }

        assert.strictEqual(options.applicationsDir, '/Custom/Applications')
        assert.strictEqual(options.dryRun, true)
        assert.deepStrictEqual(options.ignore, ['app1', 'app2'])
        assert.strictEqual(options.verbose, true)
      })

      void test('should create CommandOptions with optional properties', () => {
        const options: CommandOptions = {}

        assert.strictEqual(options.applicationsDir, undefined)
        assert.strictEqual(options.dryRun, undefined)
        assert.strictEqual(options.ignore, undefined)
        assert.strictEqual(options.verbose, undefined)
      })
    })

    void describe('InstallationResult interface', () => {
      void test('should create valid InstallationResult object', () => {
        const appInfo: AppInfo = {
          alreadyInstalled: false,
          appPath: '/Applications/TestApp.app',
          brewName: 'test-app',
          brewType: 'cask',
          originalName: 'TestApp',
          status: 'available',
        }

        const installResult: PackageInstallResult = {
          appName: 'TestApp',
          dryRun: false,
          packageName: 'test-app',
          success: true,
        }

        const result: InstallationResult = {
          alreadyInstalled: [],
          dryRun: false,
          failed: [],
          ignored: [appInfo],
          installed: [installResult],
          unavailable: [],
        }

        assert.deepStrictEqual(result.alreadyInstalled, [])
        assert.strictEqual(result.dryRun, false)
        assert.deepStrictEqual(result.failed, [])
        assert.deepStrictEqual(result.ignored, [appInfo])
        assert.deepStrictEqual(result.installed, [installResult])
        assert.deepStrictEqual(result.unavailable, [])
      })
    })

    void describe('InstallerConfig interface', () => {
      void test('should create valid InstallerConfig object', () => {
        const config: InstallerConfig = {
          dryRun: false,
          sudoPassword: 'secret',
          verbose: true,
        }

        assert.strictEqual(config.dryRun, false)
        assert.strictEqual(config.sudoPassword, 'secret')
        assert.strictEqual(config.verbose, true)
      })

      void test('should create InstallerConfig without sudo password', () => {
        const config: InstallerConfig = {
          dryRun: true,
          verbose: false,
        }

        assert.strictEqual(config.dryRun, true)
        assert.strictEqual(config.sudoPassword, undefined)
        assert.strictEqual(config.verbose, false)
      })
    })

    void describe('PackageInstallResult interface', () => {
      void test('should create successful PackageInstallResult object', () => {
        const result: PackageInstallResult = {
          appName: 'TestApp',
          dryRun: false,
          packageName: 'test-app',
          success: true,
        }

        assert.strictEqual(result.appName, 'TestApp')
        assert.strictEqual(result.dryRun, false)
        assert.strictEqual(result.error, undefined)
        assert.strictEqual(result.packageName, 'test-app')
        assert.strictEqual(result.success, true)
      })

      void test('should create failed PackageInstallResult object', () => {
        const result: PackageInstallResult = {
          appName: 'TestApp',
          dryRun: false,
          error: 'Installation failed',
          packageName: 'test-app',
          success: false,
        }

        assert.strictEqual(result.appName, 'TestApp')
        assert.strictEqual(result.dryRun, false)
        assert.strictEqual(result.error, 'Installation failed')
        assert.strictEqual(result.packageName, 'test-app')
        assert.strictEqual(result.success, false)
      })
    })

    void describe('ScannerConfig interface', () => {
      void test('should create valid ScannerConfig object', () => {
        const config: ScannerConfig = {
          applicationsDir: '/Applications',
          ignoredApps: ['System Preferences', 'Calculator'],
          verbose: true,
        }

        assert.strictEqual(config.applicationsDir, '/Applications')
        assert.deepStrictEqual(config.ignoredApps, ['System Preferences', 'Calculator'])
        assert.strictEqual(config.verbose, true)
      })

      void test('should create ScannerConfig with empty ignored apps', () => {
        const config: ScannerConfig = {
          applicationsDir: '/Custom/Apps',
          ignoredApps: [],
          verbose: false,
        }

        assert.strictEqual(config.applicationsDir, '/Custom/Apps')
        assert.deepStrictEqual(config.ignoredApps, [])
        assert.strictEqual(config.verbose, false)
      })
    })

    void describe('Logger interface', () => {
      void test('should create valid Logger object', () => {
        const messages: string[] = []

        const logger: Logger = {
          debug: (message: string) => messages.push(`DEBUG: ${message}`),
          error: (message: string) => messages.push(`ERROR: ${message}`),
          info: (message: string) => messages.push(`INFO: ${message}`),
          verbose: (message: string) => messages.push(`VERBOSE: ${message}`),
          warn: (message: string) => messages.push(`WARN: ${message}`),
        }

        logger.info('Test info')
        logger.error('Test error')
        logger.debug('Test debug')
        logger.verbose('Test verbose')
        logger.warn('Test warning')

        assert.deepStrictEqual(messages, [
          'INFO: Test info',
          'ERROR: Test error',
          'DEBUG: Test debug',
          'VERBOSE: Test verbose',
          'WARN: Test warning',
        ])
      })
    })

    void describe('OperationSummary interface', () => {
      void test('should create valid OperationSummary object', () => {
        const summary: OperationSummary = {
          alreadyInstalled: 2,
          availableApps: 5,
          dryRun: false,
          failed: 1,
          ignored: 1,
          installed: 3,
          selected: 4,
          totalApps: 10,
          unavailable: 2,
        }

        assert.strictEqual(summary.alreadyInstalled, 2)
        assert.strictEqual(summary.availableApps, 5)
        assert.strictEqual(summary.dryRun, false)
        assert.strictEqual(summary.failed, 1)
        assert.strictEqual(summary.ignored, 1)
        assert.strictEqual(summary.installed, 3)
        assert.strictEqual(summary.selected, 4)
        assert.strictEqual(summary.totalApps, 10)
        assert.strictEqual(summary.unavailable, 2)
      })

      void test('should validate operation summary totals', () => {
        const summary: OperationSummary = {
          alreadyInstalled: 1,
          availableApps: 3,
          dryRun: true,
          failed: 0,
          ignored: 1,
          installed: 0, // 0 because it's a dry run
          selected: 2,
          totalApps: 6, // alreadyInstalled + availableApps + unavailable + ignored
          unavailable: 1,
        }

        // Verify that totals make sense
        const accountedApps = summary.alreadyInstalled + summary.availableApps + summary.unavailable + summary.ignored
        assert.strictEqual(accountedApps, summary.totalApps)
      })
    })
  })

  void describe('type consistency checks', () => {
    void test('AppStatus values should be consistent with usage', () => {
      // Verify that status values make logical sense
      const statuses: AppStatus[] = ['already-installed', 'available', 'ignored', 'unavailable']

      for (const status of statuses) {
        assert.strictEqual(typeof status, 'string')
        assert.ok(status.length > 0)
      }
    })

    void test('BrewPackageType values should be consistent', () => {
      const types: BrewPackageType[] = ['cask', 'formula', 'unavailable']

      for (const type of types) {
        assert.strictEqual(typeof type, 'string')
        assert.ok(type.length > 0)
      }
    })

    void test('ErrorType should have uppercase naming convention', () => {
      for (const key of Object.keys(ErrorType)) {
        assert.ok(key === key.toUpperCase(), `Error type key '${key}' should be uppercase`)
        assert.ok(key.includes('_') || key.length <= 8, `Error type key '${key}' should use snake_case for multi-word names`)
      }
    })
  })
})
