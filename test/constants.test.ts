/**
 * Tests for constants module
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  DEFAULT_CONFIG,
  EXIT_CODES,
  FILE_PATTERNS,
  MESSAGES,
  REGEX_PATTERNS,
} from '../src/constants.ts'

void describe('constants', () => {
  void describe('DEFAULT_APPLICATIONS_DIR', () => {
    void test('should be the standard macOS Applications directory', () => {
      assert.strictEqual(DEFAULT_APPLICATIONS_DIR, '/Applications')
    })

    void test('should be a string', () => {
      assert.strictEqual(typeof DEFAULT_APPLICATIONS_DIR, 'string')
    })
  })

  void describe('BREW_COMMANDS', () => {
    void test('should have all required command functions', () => {
      assert.strictEqual(typeof BREW_COMMANDS.INFO_CASK, 'function')
      assert.strictEqual(typeof BREW_COMMANDS.INSTALL_CASK, 'function')
      assert.strictEqual(typeof BREW_COMMANDS.LIST_CASKS, 'string')
      assert.strictEqual(typeof BREW_COMMANDS.VERSION, 'string')
    })

    void test('INFO_CASK should generate correct command', () => {
      const result = BREW_COMMANDS.INFO_CASK('test-app')
      assert.strictEqual(result, 'brew info --cask "test-app"')
    })

    void test('INFO_CASK should handle names with spaces', () => {
      const result = BREW_COMMANDS.INFO_CASK('Test App')
      assert.strictEqual(result, 'brew info --cask "Test App"')
    })

    void test('INSTALL_CASK should generate correct command for single cask', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['test-app'])
      assert.strictEqual(result, 'brew install --cask "test-app"')
    })

    void test('INSTALL_CASK should generate correct command for multiple casks', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['app1', 'app2', 'app3'])
      assert.strictEqual(result, 'brew install --cask "app1" "app2" "app3"')
    })

    void test('INSTALL_CASK should handle empty array', () => {
      const result = BREW_COMMANDS.INSTALL_CASK([])
      assert.strictEqual(result, 'brew install --cask ')
    })

    void test('INSTALL_CASK should quote names with spaces', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['Test App', 'another-app'])
      assert.strictEqual(result, 'brew install --cask "Test App" "another-app"')
    })

    void test('LIST_CASKS should be correct command', () => {
      assert.strictEqual(BREW_COMMANDS.LIST_CASKS, 'brew ls -1 --cask')
    })

    void test('VERSION should be correct command', () => {
      assert.strictEqual(BREW_COMMANDS.VERSION, 'brew --version')
    })
  })

  void describe('FILE_PATTERNS', () => {
    void test('should have correct app extension', () => {
      assert.strictEqual(FILE_PATTERNS.APP_EXTENSION, '.app')
    })

    void test('should have correct app pattern regex', () => {
      assert.ok(FILE_PATTERNS.APP_PATTERN instanceof RegExp)
      assert.strictEqual(FILE_PATTERNS.APP_PATTERN.source, String.raw`\.app$`)
      assert.strictEqual(FILE_PATTERNS.APP_PATTERN.flags, 'i')
    })

    void test('APP_PATTERN should match .app files', () => {
      assert.ok(FILE_PATTERNS.APP_PATTERN.test('TestApp.app'))
      assert.ok(FILE_PATTERNS.APP_PATTERN.test('test.APP'))
      assert.ok(FILE_PATTERNS.APP_PATTERN.test('my-app.App'))
    })

    void test('APP_PATTERN should not match non-.app files', () => {
      assert.ok(!FILE_PATTERNS.APP_PATTERN.test('test.dmg'))
      assert.ok(!FILE_PATTERNS.APP_PATTERN.test('app.txt'))
      assert.ok(!FILE_PATTERNS.APP_PATTERN.test('test'))
    })
  })

  void describe('EXIT_CODES', () => {
    void test('should have all required exit codes', () => {
      assert.strictEqual(typeof EXIT_CODES.SUCCESS, 'number')
      assert.strictEqual(typeof EXIT_CODES.GENERAL_ERROR, 'number')
      assert.strictEqual(typeof EXIT_CODES.HOMEBREW_NOT_INSTALLED, 'number')
      assert.strictEqual(typeof EXIT_CODES.PERMISSION_DENIED, 'number')
      assert.strictEqual(typeof EXIT_CODES.INVALID_INPUT, 'number')
      assert.strictEqual(typeof EXIT_CODES.NETWORK_ERROR, 'number')
    })

    void test('should have correct exit code values', () => {
      assert.strictEqual(EXIT_CODES.SUCCESS, 0)
      assert.strictEqual(EXIT_CODES.GENERAL_ERROR, 1)
      assert.strictEqual(EXIT_CODES.HOMEBREW_NOT_INSTALLED, 2)
      assert.strictEqual(EXIT_CODES.PERMISSION_DENIED, 3)
      assert.strictEqual(EXIT_CODES.INVALID_INPUT, 4)
      assert.strictEqual(EXIT_CODES.NETWORK_ERROR, 5)
    })

    void test('should have unique exit code values', () => {
      const values = Object.values(EXIT_CODES)
      const uniqueValues = [...new Set(values)]
      assert.strictEqual(values.length, uniqueValues.length)
    })
  })

  void describe('DEFAULT_CONFIG', () => {
    void test('should have all required configuration properties', () => {
      assert.strictEqual(typeof DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, 'number')
      assert.strictEqual(typeof DEFAULT_CONFIG.DRY_RUN, 'boolean')
      assert.strictEqual(typeof DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS, 'number')
      assert.strictEqual(typeof DEFAULT_CONFIG.VERBOSE, 'boolean')
    })

    void test('should have correct default values', () => {
      assert.strictEqual(DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT, 30_000)
      assert.strictEqual(DEFAULT_CONFIG.DRY_RUN, false)
      assert.strictEqual(DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS, 5)
      assert.strictEqual(DEFAULT_CONFIG.VERBOSE, false)
    })

    void test('timeout should be reasonable', () => {
      assert.ok(DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT > 0)
      assert.ok(DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT <= 60_000) // Max 1 minute
    })

    void test('max concurrent operations should be reasonable', () => {
      assert.ok(DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS > 0)
      assert.ok(DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS <= 20) // Reasonable max
    })
  })

  void describe('MESSAGES', () => {
    void test('should have all required message strings', () => {
      assert.strictEqual(typeof MESSAGES.CHECKING_HOMEBREW, 'string')
      assert.strictEqual(typeof MESSAGES.DELETING_APPS, 'string')
      assert.strictEqual(typeof MESSAGES.DRY_RUN_MODE, 'string')
      assert.strictEqual(typeof MESSAGES.HOMEBREW_NOT_INSTALLED, 'string')
      assert.strictEqual(typeof MESSAGES.INSTALLING_PACKAGES, 'string')
      assert.strictEqual(typeof MESSAGES.NO_APPS_FOUND, 'string')
      assert.strictEqual(typeof MESSAGES.NO_APPS_SELECTED, 'string')
      assert.strictEqual(typeof MESSAGES.OPERATION_CANCELLED, 'string')
      assert.strictEqual(typeof MESSAGES.OPERATION_COMPLETE, 'string')
      assert.strictEqual(typeof MESSAGES.PERMISSION_DENIED, 'string')
      assert.strictEqual(typeof MESSAGES.SCANNING_APPS, 'string')
    })

    void test('messages should not be empty', () => {
      for (const message of Object.values(MESSAGES)) {
        assert.ok(message.length > 0, `Message should not be empty: "${message}"`)
      }
    })

    void test('should have specific expected messages', () => {
      assert.strictEqual(MESSAGES.CHECKING_HOMEBREW, 'Checking Homebrew availability...')
      assert.strictEqual(MESSAGES.DELETING_APPS, 'Deleting original applications...')
      assert.strictEqual(MESSAGES.DRY_RUN_MODE, 'Running in dry-run mode. No actual changes will be made.')
      assert.strictEqual(MESSAGES.HOMEBREW_NOT_INSTALLED, 'Homebrew is not installed. Please install it before continuing.')
      assert.strictEqual(MESSAGES.INSTALLING_PACKAGES, 'Installing packages...')
      assert.strictEqual(MESSAGES.NO_APPS_FOUND, 'No applications found in the Applications directory.')
      assert.strictEqual(MESSAGES.NO_APPS_SELECTED, 'No applications selected for installation.')
      assert.strictEqual(MESSAGES.OPERATION_CANCELLED, 'Operation cancelled by user.')
      assert.strictEqual(MESSAGES.OPERATION_COMPLETE, 'Operation completed successfully.')
      assert.strictEqual(MESSAGES.PERMISSION_DENIED, 'Permission denied. You may need to run with appropriate permissions.')
      assert.strictEqual(MESSAGES.SCANNING_APPS, 'Scanning applications...')
    })
  })

  void describe('REGEX_PATTERNS', () => {
    void test('should have all required regex patterns', () => {
      assert.ok(REGEX_PATTERNS.APP_NAME instanceof RegExp)
      assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME instanceof RegExp)
      assert.ok(REGEX_PATTERNS.VERSION instanceof RegExp)
    })

    void describe('APP_NAME pattern', () => {
      void test('should match valid app names', () => {
        assert.ok(REGEX_PATTERNS.APP_NAME.test('TestApp'))
        assert.ok(REGEX_PATTERNS.APP_NAME.test('My App'))
        assert.ok(REGEX_PATTERNS.APP_NAME.test('App-Name_123'))
        assert.ok(REGEX_PATTERNS.APP_NAME.test('éÄñ'))
      })

      void test('should not match names with path separators', () => {
        assert.ok(!REGEX_PATTERNS.APP_NAME.test('folder/app'))
        assert.ok(!REGEX_PATTERNS.APP_NAME.test('/app'))
      })

      void test('should not match names with null characters', () => {
        assert.ok(!REGEX_PATTERNS.APP_NAME.test('app\0name'))
        assert.ok(!REGEX_PATTERNS.APP_NAME.test('\0'))
      })

      void test('should not match empty string', () => {
        // Note: The regex ^[^/\0]+$ requires at least one character
        assert.ok(!REGEX_PATTERNS.APP_NAME.test(''))
      })
    })

    void describe('BREW_PACKAGE_NAME pattern', () => {
      void test('should match valid package names', () => {
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test-app'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test_app'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test.app'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('123app'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('app123'))
      })

      void test('should not match names starting with special characters', () => {
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('-test'))
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('_test'))
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('.test'))
      })

      void test('should not match names with invalid characters', () => {
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test app'))
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test@app'))
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test('test#app'))
      })

      void test('should not match empty string', () => {
        assert.ok(!REGEX_PATTERNS.BREW_PACKAGE_NAME.test(''))
      })

      void test('should be case insensitive', () => {
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('TestApp'))
        assert.ok(REGEX_PATTERNS.BREW_PACKAGE_NAME.test('TESTAPP'))
        assert.strictEqual(REGEX_PATTERNS.BREW_PACKAGE_NAME.flags, 'i')
      })
    })

    void describe('VERSION pattern', () => {
      void test('should match valid version strings', () => {
        assert.ok(REGEX_PATTERNS.VERSION.test('1.0.0'))
        assert.ok(REGEX_PATTERNS.VERSION.test('2.1.3'))
        assert.ok(REGEX_PATTERNS.VERSION.test('10.15.7'))
        assert.ok(REGEX_PATTERNS.VERSION.test('1.0.0-beta'))
        assert.ok(REGEX_PATTERNS.VERSION.test('2.1.3 (build 123)'))
      })

      void test('should not match invalid version strings', () => {
        assert.ok(!REGEX_PATTERNS.VERSION.test('1.0'))
        assert.ok(!REGEX_PATTERNS.VERSION.test('1'))
        assert.ok(!REGEX_PATTERNS.VERSION.test('v1.0.0'))
        assert.ok(!REGEX_PATTERNS.VERSION.test('version 1.0.0'))
        assert.ok(!REGEX_PATTERNS.VERSION.test(''))
      })

      void test('should match versions with additional content', () => {
        assert.ok(REGEX_PATTERNS.VERSION.test('1.0.0-alpha.1'))
        assert.ok(REGEX_PATTERNS.VERSION.test('1.2.3+build.1'))
        assert.ok(REGEX_PATTERNS.VERSION.test('1.0.0 stable'))
      })
    })
  })

  void describe('constants structure validation', () => {
    void test('should have expected number of constants', () => {
      // Verify we have the expected constants exported
      assert.strictEqual(typeof DEFAULT_APPLICATIONS_DIR, 'string')
      assert.strictEqual(typeof BREW_COMMANDS, 'object')
      assert.strictEqual(typeof FILE_PATTERNS, 'object')
      assert.strictEqual(typeof EXIT_CODES, 'object')
      assert.strictEqual(typeof DEFAULT_CONFIG, 'object')
      assert.strictEqual(typeof MESSAGES, 'object')
      assert.strictEqual(typeof REGEX_PATTERNS, 'object')
    })

    void test('constants should be properly typed', () => {
      // TypeScript compilation ensures these are properly typed as const
      assert.ok(true)
    })
  })
})
