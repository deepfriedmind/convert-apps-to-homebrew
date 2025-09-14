/**
 * Tests for constants module
 */

import { describe, expect, test } from 'bun:test'

const EXIT_CODE_PERMISSION_DENIED = 3
const EXIT_CODE_INVALID_INPUT = 4
const EXIT_CODE_NETWORK_ERROR = 5
const DEFAULT_BREW_COMMAND_TIMEOUT = 30_000
const DEFAULT_MAX_CONCURRENT_OPERATIONS = 5
const MAX_BREW_COMMAND_TIMEOUT = 60_000
const MAX_CONCURRENT_OPERATIONS_LIMIT = 20

import {
  BREW_COMMANDS,
  DEFAULT_APPLICATIONS_DIR,
  DEFAULT_CONFIG,
  EXIT_CODES,
  FILE_PATTERNS,
  MESSAGES,
} from '../src/constants.ts'

describe('constants', () => {
  describe('DEFAULT_APPLICATIONS_DIR', () => {
    test('should be the standard macOS Applications directory', () => {
      expect(DEFAULT_APPLICATIONS_DIR).toBe('/Applications')
    })
  })

  describe('BREW_COMMANDS', () => {
    test('INFO_CASK should generate correct command', () => {
      const result = BREW_COMMANDS.INFO_CASK('test-app')
      expect(result).toBe('brew info --cask "test-app"')
    })

    test('INFO_CASK should handle names with spaces', () => {
      const result = BREW_COMMANDS.INFO_CASK('Test App')
      expect(result).toBe('brew info --cask "Test App"')
    })

    test('INSTALL_CASK should generate correct command for single cask', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['test-app'])
      expect(result).toBe('brew install --cask --adopt "test-app"')
    })

    test('INSTALL_CASK should generate correct command for multiple casks', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['app1', 'app2', 'app3'])
      expect(result).toBe('brew install --cask --adopt "app1" "app2" "app3"')
    })

    test('INSTALL_CASK should handle empty array', () => {
      const result = BREW_COMMANDS.INSTALL_CASK([])
      expect(result).toBe('brew install --cask --adopt ')
    })

    test('INSTALL_CASK should quote names with spaces', () => {
      const result = BREW_COMMANDS.INSTALL_CASK(['Test App', 'another-app'])
      expect(result).toBe(
        'brew install --cask --adopt "Test App" "another-app"',
      )
    })

    test('LIST_CASKS should be correct command', () => {
      expect(BREW_COMMANDS.LIST_CASKS).toBe('brew ls -1 --cask')
    })

    test('VERSION should be correct command', () => {
      expect(BREW_COMMANDS.VERSION).toBe('brew --version')
    })
  })

  describe('FILE_PATTERNS', () => {
    test('should have correct app extension', () => {
      expect(FILE_PATTERNS.APP_EXTENSION).toBe('.app')
    })

    test('should have correct app pattern regex', () => {
      expect(FILE_PATTERNS.APP_PATTERN).toBeInstanceOf(RegExp)
      expect(FILE_PATTERNS.APP_PATTERN.source).toBe(String.raw`\.app$`)
      expect(FILE_PATTERNS.APP_PATTERN.flags).toBe('i')
    })

    test('APP_PATTERN should match .app files', () => {
      expect(FILE_PATTERNS.APP_PATTERN.test('TestApp.app')).toBe(true)
      expect(FILE_PATTERNS.APP_PATTERN.test('test.APP')).toBe(true)
      expect(FILE_PATTERNS.APP_PATTERN.test('my-app.App')).toBe(true)
    })

    test('APP_PATTERN should not match non-.app files', () => {
      expect(FILE_PATTERNS.APP_PATTERN.test('test.dmg')).toBe(false)
      expect(FILE_PATTERNS.APP_PATTERN.test('app.txt')).toBe(false)
      expect(FILE_PATTERNS.APP_PATTERN.test('test')).toBe(false)
    })
  })

  describe('EXIT_CODES', () => {
    test('should have all required exit codes', () => {
      expect(typeof EXIT_CODES.SUCCESS).toBe('number')
      expect(typeof EXIT_CODES.GENERAL_ERROR).toBe('number')
      expect(typeof EXIT_CODES.HOMEBREW_NOT_INSTALLED).toBe('number')
      expect(typeof EXIT_CODES.PERMISSION_DENIED).toBe('number')
      expect(typeof EXIT_CODES.INVALID_INPUT).toBe('number')
      expect(typeof EXIT_CODES.NETWORK_ERROR).toBe('number')
    })

    test('should have correct exit code values', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0)
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1)
      expect(EXIT_CODES.HOMEBREW_NOT_INSTALLED).toBe(2)
      expect(EXIT_CODES.PERMISSION_DENIED).toBe(EXIT_CODE_PERMISSION_DENIED)
      expect(EXIT_CODES.INVALID_INPUT).toBe(EXIT_CODE_INVALID_INPUT)
      expect(EXIT_CODES.NETWORK_ERROR).toBe(EXIT_CODE_NETWORK_ERROR)
    })

    test('should have unique exit code values', () => {
      const values = Object.values(EXIT_CODES)
      const uniqueValues = [...new Set(values)]
      expect(values.length).toBe(uniqueValues.length)
    })
  })

  describe('DEFAULT_CONFIG', () => {
    test('should have all required configuration properties', () => {
      expect(typeof DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT).toBe('number')
      expect(typeof DEFAULT_CONFIG.DRY_RUN).toBe('boolean')
      expect(typeof DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS).toBe('number')
      expect(typeof DEFAULT_CONFIG.VERBOSE).toBe('boolean')
    })

    test('should have correct default values', () => {
      expect(DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT).toBe(
        DEFAULT_BREW_COMMAND_TIMEOUT,
      )
      expect(DEFAULT_CONFIG.DRY_RUN).toBe(false)
      expect(DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS).toBe(
        DEFAULT_MAX_CONCURRENT_OPERATIONS,
      )
      expect(DEFAULT_CONFIG.VERBOSE).toBe(false)
    })

    test('timeout should be reasonable', () => {
      expect(DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT > 0).toBe(true)
      expect(
        DEFAULT_CONFIG.BREW_COMMAND_TIMEOUT <= MAX_BREW_COMMAND_TIMEOUT,
      ).toBe(true) // Max 1 minute
    })

    test('max concurrent operations should be reasonable', () => {
      expect(DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS > 0).toBe(true)
      expect(
        DEFAULT_CONFIG.MAX_CONCURRENT_OPERATIONS <=
          MAX_CONCURRENT_OPERATIONS_LIMIT,
      ).toBe(true) // Reasonable max
    })
  })

  describe('MESSAGES', () => {
    test('should have all required message strings', () => {
      expect(typeof MESSAGES.CHECKING_HOMEBREW).toBe('string')
      expect(typeof MESSAGES.DELETING_APPS).toBe('string')
      expect(typeof MESSAGES.DRY_RUN_MODE).toBe('string')
      expect(typeof MESSAGES.HOMEBREW_NOT_INSTALLED).toBe('string')
      expect(typeof MESSAGES.INSTALLING_PACKAGES).toBe('string')
      expect(typeof MESSAGES.NO_APPS_FOUND).toBe('string')
      expect(typeof MESSAGES.NO_APPS_SELECTED).toBe('string')
      expect(typeof MESSAGES.OPERATION_CANCELLED).toBe('string')
      expect(typeof MESSAGES.OPERATION_COMPLETE).toBe('string')
      expect(typeof MESSAGES.PERMISSION_DENIED).toBe('string')
      expect(typeof MESSAGES.SCANNING_APPS).toBe('string')
    })

    test('messages should not be empty', () => {
      for (const message of Object.values(MESSAGES)) {
        expect(message.length > 0).toBe(true)
      }
    })

    test('should have specific expected messages', () => {
      expect(MESSAGES.CHECKING_HOMEBREW).toBe(
        'Checking Homebrew availability...',
      )
      expect(MESSAGES.DELETING_APPS).toBe('Deleting original applications...')
      expect(MESSAGES.DRY_RUN_MODE).toBe(
        'Running in dry-run mode. No actual changes will be made.',
      )
      expect(MESSAGES.HOMEBREW_NOT_INSTALLED).toBe(
        'Homebrew is not installed. Please install it before continuing.',
      )
      expect(MESSAGES.INSTALLING_PACKAGES).toBe('Installing packages...')
      expect(MESSAGES.NO_APPS_FOUND).toBe(
        'No applications found in the Applications directory.',
      )
      expect(MESSAGES.NO_APPS_SELECTED).toBe(
        'No applications selected for installation.',
      )
      expect(MESSAGES.OPERATION_CANCELLED).toBe('Operation cancelled by user.')
      expect(MESSAGES.OPERATION_COMPLETE).toBe(
        'Operation completed successfully.',
      )
      expect(MESSAGES.PERMISSION_DENIED).toBe(
        'Permission denied. You may need to run with appropriate permissions.',
      )
      expect(MESSAGES.SCANNING_APPS).toBe('Scanning applications...')
    })
  })
})
