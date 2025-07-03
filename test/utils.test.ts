/**
 * Tests for utility functions
 */

import assert from 'node:assert'
import { describe, test } from 'node:test'

import {
  capitalize,
  escapeShellArgument,
  executeCommand,
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
  shouldIgnoreApp,
  sleep,
  truncate,
  uniqueBy,
} from '../src/utils.ts'
import { assertNoDuplicates } from './helpers/assertions.ts'

void describe('utils', () => {
  void describe('capitalize', () => {
    void test('should capitalize first letter of lowercase string', () => {
      assert.strictEqual(capitalize('hello'), 'Hello')
    })

    void test('should handle already capitalized string', () => {
      assert.strictEqual(capitalize('Hello'), 'Hello')
    })

    void test('should handle single character', () => {
      assert.strictEqual(capitalize('a'), 'A')
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

  void describe('executeCommand', () => {
    void test('should execute simple command successfully', async () => {
      const result = await executeCommand('echo "Hello World"')

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.exitCode, 0)
      assert.strictEqual(result.stdout, 'Hello World')
      assert.strictEqual(result.stderr, '')
    })

    void test('should handle command with output to stderr', async () => {
      const result = await executeCommand('echo "Error message" >&2')

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.exitCode, 0)
      assert.strictEqual(result.stdout, '')
      assert.strictEqual(result.stderr, 'Error message')
    })

    void test('should handle failing command', async () => {
      const result = await executeCommand('exit 1')

      assert.strictEqual(result.success, false)
      assert.strictEqual(result.exitCode, 1)
      assert.strictEqual(result.stdout, '')
    })

    void test('should handle command not found', async () => {
      const result = await executeCommand('nonexistentcommand123456')

      assert.strictEqual(result.success, false)
      assert.strictEqual(result.exitCode, 127)
    })

    void test('should handle timeout', async () => {
      const result = await executeCommand('sleep 2', 500) // 500ms timeout for 2s sleep

      assert.strictEqual(result.success, false)
      // Timeout should result in failure - exact error message may vary
      assert.ok(result.exitCode !== 0 || result.stderr.length > 0)
    })

    void test('should return dry run message when dryRun is true', async () => {
      const result = await executeCommand('echo "Should not execute"', 5000, true)

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.exitCode, 0)
      assert.strictEqual(result.stdout, '[DRY RUN] Would execute: echo "Should not execute"')
      assert.strictEqual(result.stderr, '')
    })

    void test('should use default timeout when not specified', async () => {
      const result = await executeCommand('echo "default timeout test"')

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.stdout, 'default timeout test')
    })

    void test('should trim stdout and stderr output', async () => {
      const result = await executeCommand('echo "  spaces  "')

      assert.strictEqual(result.success, true)
      // The trim() function removes leading/trailing whitespace including newlines
      assert.strictEqual(result.stdout, 'spaces')
    })

    void test('should handle complex command with pipes', async () => {
      const result = await executeCommand('echo "hello world" | tr a-z A-Z')

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.stdout, 'HELLO WORLD')
    })

    void test('should handle command with multiple arguments', async () => {
      const result = await executeCommand(String.raw`printf "%s %s\n" "Hello" "World"`)

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.stdout, 'Hello World')
    })

    void test('should return consistent result structure on success', async () => {
      const result = await executeCommand('echo test')

      assert.ok(typeof result.success === 'boolean')
      assert.ok(typeof result.exitCode === 'number')
      assert.ok(typeof result.stdout === 'string')
      assert.ok(typeof result.stderr === 'string')
      assert.ok('success' in result)
      assert.ok('exitCode' in result)
      assert.ok('stdout' in result)
      assert.ok('stderr' in result)
    })

    void test('should return consistent result structure on failure', async () => {
      const result = await executeCommand('exit 42')

      assert.ok(typeof result.success === 'boolean')
      assert.ok(typeof result.exitCode === 'number')
      assert.ok(typeof result.stdout === 'string')
      assert.ok(typeof result.stderr === 'string')
      assert.strictEqual(result.success, false)
      assert.strictEqual(result.exitCode, 42)
    })

    void test('should handle empty command', async () => {
      await assert.rejects(
        async () => executeCommand(''),
        {
          message: 'Command cannot be empty',
          name: 'Error',
        },
      )
    })

    void test('should handle whitespace-only command', async () => {
      await assert.rejects(
        async () => executeCommand('   \t  \n  '),
        {
          message: 'Command cannot be empty',
          name: 'Error',
        },
      )
    })

    void test('should handle very short timeout', async () => {
      const result = await executeCommand('echo "quick"', 1) // 1ms timeout

      // This might succeed or fail depending on system speed,
      // but should not crash and should return proper structure
      assert.ok(typeof result.success === 'boolean')
      assert.ok(typeof result.exitCode === 'number')
    })
  })

  void describe('shouldIgnoreApp', () => {
    void test('should return false when ignore list is empty', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [])
      assert.strictEqual(result, false)
    })

    void test('should ignore app by original name', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', ['Bartender 5'])
      assert.strictEqual(result, true)
    })

    void test('should ignore app by brew name', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', ['bartender'])
      assert.strictEqual(result, true)
    })

    void test('should ignore app case insensitively', () => {
      const result1 = shouldIgnoreApp('Bartender 5', 'bartender-5', ['BARTENDER 5'])
      const result2 = shouldIgnoreApp('Bartender 5', 'bartender-5', ['BARTENDER'])
      assert.strictEqual(result1, true)
      assert.strictEqual(result2, true)
    })

    void test('should handle multiple ignore patterns', () => {
      const ignoreList = ['chrome', 'Visual Studio Code', 'bartender']

      assert.strictEqual(shouldIgnoreApp('Google Chrome', 'google-chrome', ignoreList), false)
      assert.strictEqual(shouldIgnoreApp('Chrome', 'chrome', ignoreList), true)
      assert.strictEqual(shouldIgnoreApp('Visual Studio Code', 'visual-studio-code', ignoreList), true)
      assert.strictEqual(shouldIgnoreApp('Bartender 5', 'bartender-5', ignoreList), true)
    })

    void test('should not ignore when no match found', () => {
      const result = shouldIgnoreApp('Firefox', 'firefox', ['chrome', 'safari'])
      assert.strictEqual(result, false)
    })

    void test('should handle whitespace in ignore patterns', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [' bartender '])
      assert.strictEqual(result, true)
    })

    void test('should handle special characters', () => {
      const result = shouldIgnoreApp('App with (parens)', 'app-with-parens', ['app with (parens)'])
      assert.strictEqual(result, true)
    })

    void test('should match exact normalized names only', () => {
      // "bartender" should match "bartender-5" (prefix matching)
      const result1 = shouldIgnoreApp('Bartender', 'bartender', ['bartender-5'])
      const result2 = shouldIgnoreApp('Bartender 5', 'bartender-5', ['bartender'])

      assert.strictEqual(result1, false) // "bartender" != "bartender-5"
      assert.strictEqual(result2, true) // "bartender" matches "bartender-5" via prefix
    })

    void test('should handle prefix matching for versioned apps', () => {
      // Test the key use case: --ignore bartender should ignore "Bartender 5"
      const result1 = shouldIgnoreApp('Bartender 5', 'bartender-5', ['bartender'])
      const result2 = shouldIgnoreApp('Chrome 110', 'chrome-110', ['chrome'])
      const result3 = shouldIgnoreApp('App 2.0', 'app-2.0', ['app'])

      assert.strictEqual(result1, true)
      assert.strictEqual(result2, true)
      assert.strictEqual(result3, true)
    })

    void test('should not match unrelated prefixes', () => {
      // "bart" should not match "bartender-5"
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', ['bart'])
      assert.strictEqual(result, false)
    })
  })
})
