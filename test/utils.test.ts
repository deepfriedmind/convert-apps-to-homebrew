/**
 * Tests for utility functions
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import {
  capitalize,
  createLogger,
  createProgressBar,
  escapeShellArgument,
  extractAppName,
  formatDuration,
  formatList,
  groupBy,
  isEmpty,
  isValidAppName,
  isValidBrewPackageName,
  normalizeAppName,
  parseCommandOutput,
  pluralize,
  sleep,
  truncate,
  uniqueBy,
} from '../src/utils.ts'

import { assertHasAnsiColors, assertLogger, assertNoDuplicates } from './helpers/assertions.js'
import { mockConsole } from './helpers/test-utils.js'

void describe('utils', () => {
  void describe('capitalize', () => {
    void test('should capitalize first letter of lowercase string', () => {
      assert.strictEqual(capitalize('hello'), 'Hello')
    })

    void test('should handle already capitalized string', () => {
      assert.strictEqual(capitalize('Hello'), 'Hello')
    })

    void test('should handle empty string', () => {
      assert.strictEqual(capitalize(''), '')
    })

    void test('should handle single character', () => {
      assert.strictEqual(capitalize('a'), 'A')
    })

    void test('should handle uppercase string', () => {
      assert.strictEqual(capitalize('HELLO'), 'HELLO')
    })
  })

  void describe('createLogger', () => {
    void test('should create logger with all required methods', () => {
      const logger = createLogger()
      assertLogger(logger)
    })

    void test('should create verbose logger', () => {
      const logger = createLogger(true)
      assertLogger(logger)
    })

    void test('should log info messages with colors', () => {
      const console = mockConsole()
      const logger = createLogger()

      logger.info('test message')

      assert.strictEqual(console.logs.length, 1)
      assertHasAnsiColors(console.logs[0]!)
      assert.ok(console.logs[0]!.includes('test message'))

      console.restore()
    })

    void test('should log error messages', () => {
      const console = mockConsole()
      const logger = createLogger()

      logger.error('error message')

      assert.strictEqual(console.errors.length, 1)
      assertHasAnsiColors(console.errors[0]!)
      assert.ok(console.errors[0]!.includes('error message'))

      console.restore()
    })

    void test('should only log debug messages in verbose mode', () => {
      const console = mockConsole()

      // Non-verbose logger
      const logger = createLogger(false)
      logger.debug('debug message')
      assert.strictEqual(console.logs.length, 0)

      // Verbose logger
      const verboseLogger = createLogger(true)
      verboseLogger.debug('debug message')
      assert.strictEqual(console.logs.length, 1)

      console.restore()
    })
  })

  void describe('createProgressBar', () => {
    void test('should create progress bar for partial completion', () => {
      const result = createProgressBar(3, 10)
      assert.ok(result.includes('['))
      assert.ok(result.includes(']'))
      assert.ok(result.includes('30%'))
      assert.ok(result.includes('(3/10)'))
    })

    void test('should create progress bar for 0% completion', () => {
      const result = createProgressBar(0, 10)
      assert.ok(result.includes('0%'))
      assert.ok(result.includes('(0/10)'))
    })

    void test('should create progress bar for 100% completion', () => {
      const result = createProgressBar(10, 10)
      assert.ok(result.includes('100%'))
      assert.ok(result.includes('(10/10)'))
    })

    void test('should handle custom width', () => {
      const result = createProgressBar(5, 10, 10)
      assert.ok(result.includes('50%'))
    })

    void test('should cap at 100% even if current > total', () => {
      const result = createProgressBar(15, 10)
      assert.ok(result.includes('100%'))
    })
  })

  void describe('escapeShellArgument', () => {
    void test('should wrap simple text in quotes', () => {
      assert.strictEqual(escapeShellArgument('hello'), '"hello"')
    })

    void test('should escape internal quotes', () => {
      assert.strictEqual(escapeShellArgument('say "hello"'), String.raw`"say \"hello\""`)
    })

    void test('should handle empty string', () => {
      assert.strictEqual(escapeShellArgument(''), '""')
    })

    void test('should handle special characters', () => {
      const result = escapeShellArgument('hello & world')
      assert.strictEqual(result, '"hello & world"')
    })
  })

  void describe('extractAppName', () => {
    void test('should extract app name from .app path', () => {
      assert.strictEqual(extractAppName('/Applications/Google Chrome.app'), 'Google Chrome')
    })

    void test('should handle nested paths', () => {
      assert.strictEqual(extractAppName('/Users/test/Applications/Firefox.app'), 'Firefox')
    })

    void test('should handle case insensitive .app extension', () => {
      assert.strictEqual(extractAppName('/Applications/Test.APP'), 'Test')
    })

    void test('should return empty string for invalid path', () => {
      assert.strictEqual(extractAppName(''), '')
    })

    void test('should handle path without .app extension', () => {
      assert.strictEqual(extractAppName('/Applications/SomeFile'), 'SomeFile')
    })
  })

  void describe('formatDuration', () => {
    void test('should format milliseconds', () => {
      assert.strictEqual(formatDuration(500), '500ms')
    })

    void test('should format seconds', () => {
      assert.strictEqual(formatDuration(5000), '5s')
    })

    void test('should format minutes and seconds', () => {
      assert.strictEqual(formatDuration(125_000), '2m 5s')
    })

    void test('should handle exact minutes', () => {
      assert.strictEqual(formatDuration(120_000), '2m 0s')
    })

    void test('should handle zero', () => {
      assert.strictEqual(formatDuration(0), '0ms')
    })
  })

  void describe('formatList', () => {
    void test('should format list with default indent', () => {
      const result = formatList(['item1', 'item2', 'item3'])
      assert.ok(result.includes('• item1'))
      assert.ok(result.includes('• item2'))
      assert.ok(result.includes('• item3'))
    })

    void test('should format list with custom indent', () => {
      const result = formatList(['item1'], '    ')
      assert.ok(result.includes('    • item1'))
    })

    void test('should handle empty list', () => {
      assert.strictEqual(formatList([]), '')
    })

    void test('should handle single item', () => {
      const result = formatList(['single'])
      assert.strictEqual(result, '  • single')
    })
  })

  void describe('groupBy', () => {
    void test('should group items by key function', () => {
      const items = ['apple', 'banana', 'apricot', 'blueberry']
      const result = groupBy(items, item => item[0]!)

      assert.deepStrictEqual(result['a'], ['apple', 'apricot'])
      assert.deepStrictEqual(result['b'], ['banana', 'blueberry'])
    })

    void test('should handle empty array', () => {
      const result = groupBy([], (item: string) => item[0]!)
      assert.deepStrictEqual(result, {})
    })

    void test('should handle numeric keys', () => {
      const items = [1, 2, 3, 4, 5]
      const result = groupBy(items, item => item % 2)

      assert.deepStrictEqual(result[0], [2, 4])
      assert.deepStrictEqual(result[1], [1, 3, 5])
    })
  })

  void describe('isEmpty', () => {
    void test('should return true for null', () => {
      assert.strictEqual(isEmpty(null), true)
    })

    void test('should return true for undefined', () => {
      assert.strictEqual(isEmpty(undefined), true)
    })

    void test('should return true for empty string', () => {
      assert.strictEqual(isEmpty(''), true)
    })

    void test('should return true for whitespace-only string', () => {
      assert.strictEqual(isEmpty('   '), true)
    })

    void test('should return false for non-empty string', () => {
      assert.strictEqual(isEmpty('hello'), false)
    })

    void test('should return false for string with content and whitespace', () => {
      assert.strictEqual(isEmpty('  hello  '), false)
    })
  })

  void describe('isValidAppName', () => {
    void test('should validate normal app names', () => {
      assert.strictEqual(isValidAppName('Google Chrome'), true)
    })

    void test('should validate app names with numbers', () => {
      assert.strictEqual(isValidAppName('App123'), true)
    })

    void test('should reject empty string', () => {
      assert.strictEqual(isValidAppName(''), false)
    })

    void test('should reject whitespace-only string', () => {
      assert.strictEqual(isValidAppName('   '), false)
    })

    void test('should reject names with path separators', () => {
      assert.strictEqual(isValidAppName('App/Name'), false)
    })

    void test('should reject names with null characters', () => {
      assert.strictEqual(isValidAppName('App\0Name'), false)
    })
  })

  void describe('isValidBrewPackageName', () => {
    void test('should validate simple package names', () => {
      assert.strictEqual(isValidBrewPackageName('google-chrome'), true)
    })

    void test('should validate package names with dots', () => {
      assert.strictEqual(isValidBrewPackageName('app.name'), true)
    })

    void test('should validate package names with underscores', () => {
      assert.strictEqual(isValidBrewPackageName('app_name'), true)
    })

    void test('should reject empty string', () => {
      assert.strictEqual(isValidBrewPackageName(''), false)
    })

    void test('should reject names starting with special characters', () => {
      assert.strictEqual(isValidBrewPackageName('-app'), false)
    })

    void test('should reject names with spaces', () => {
      assert.strictEqual(isValidBrewPackageName('app name'), false)
    })
  })

  void describe('normalizeAppName', () => {
    void test('should convert to lowercase', () => {
      assert.strictEqual(normalizeAppName('Google Chrome'), 'google-chrome')
    })

    void test('should replace spaces with hyphens', () => {
      assert.strictEqual(normalizeAppName('Visual Studio Code'), 'visual-studio-code')
    })

    void test('should remove special characters', () => {
      assert.strictEqual(normalizeAppName('App@#$Name'), 'appname')
    })

    void test('should handle multiple consecutive spaces', () => {
      assert.strictEqual(normalizeAppName('App    Name'), 'app-name')
    })

    void test('should remove leading and trailing hyphens', () => {
      assert.strictEqual(normalizeAppName('  App Name  '), 'app-name')
    })

    void test('should preserve dots and underscores', () => {
      assert.strictEqual(normalizeAppName('App.Name_Test'), 'app.name_test')
    })
  })

  void describe('parseCommandOutput', () => {
    void test('should split output into lines', () => {
      const output = 'line1\nline2\nline3'
      const result = parseCommandOutput(output)
      assert.deepStrictEqual(result, ['line1', 'line2', 'line3'])
    })

    void test('should filter out empty lines', () => {
      const output = 'line1\n\nline2\n\nline3'
      const result = parseCommandOutput(output)
      assert.deepStrictEqual(result, ['line1', 'line2', 'line3'])
    })

    void test('should trim whitespace from lines', () => {
      const output = '  line1  \n  line2  '
      const result = parseCommandOutput(output)
      assert.deepStrictEqual(result, ['line1', 'line2'])
    })

    void test('should handle empty output', () => {
      const result = parseCommandOutput('')
      assert.deepStrictEqual(result, [])
    })
  })

  void describe('pluralize', () => {
    void test('should return singular for count of 1', () => {
      assert.strictEqual(pluralize('app', 1), 'app')
    })

    void test('should return plural for count > 1', () => {
      assert.strictEqual(pluralize('app', 2), 'apps')
    })

    void test('should return plural for count of 0', () => {
      assert.strictEqual(pluralize('app', 0), 'apps')
    })

    void test('should use custom suffix', () => {
      assert.strictEqual(pluralize('child', 2, 'ren'), 'children')
    })

    void test('should handle negative counts as plural', () => {
      assert.strictEqual(pluralize('app', -1), 'apps')
    })
  })

  void describe('sleep', async () => {
    void test('should resolve after specified time', async () => {
      const start = Date.now()
      await sleep(10)
      const end = Date.now()
      assert.ok(end - start >= 9) // Allow for small timing variations
    })

    void test('should resolve with zero delay', async () => {
      const start = Date.now()
      await sleep(0)
      const end = Date.now()
      assert.ok(end - start < 10) // Should be very fast
    })
  })

  void describe('truncate', () => {
    void test('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10)
      assert.strictEqual(result, 'This is...')
    })

    void test('should not truncate short strings', () => {
      const result = truncate('Short', 10)
      assert.strictEqual(result, 'Short')
    })

    void test('should handle exact length strings', () => {
      const result = truncate('Exact', 5)
      assert.strictEqual(result, 'Exact')
    })

    void test('should handle very short max length', () => {
      const result = truncate('Test', 3)
      assert.strictEqual(result, '...')
    })
  })

  void describe('uniqueBy', () => {
    void test('should remove duplicates by key function', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ]
      const result = uniqueBy(items, item => item.id)

      assert.strictEqual(result.length, 2)
      assert.strictEqual(result[0]!.name, 'a')
      assert.strictEqual(result[1]!.name, 'b')
    })

    void test('should handle empty array', () => {
      const result = uniqueBy([], (item: string) => item)
      assert.deepStrictEqual(result, [])
    })

    void test('should handle array with no duplicates', () => {
      const items = ['a', 'b', 'c']
      const result = uniqueBy(items, item => item)
      assertNoDuplicates(result)
      assert.deepStrictEqual(result, items)
    })

    void test('should preserve first occurrence', () => {
      const items = ['first', 'second', 'first', 'third']
      const result = uniqueBy(items, item => item)
      assert.deepStrictEqual(result, ['first', 'second', 'third'])
    })
  })
})
