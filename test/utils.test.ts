/**
 * Tests for utility functions
 */

import { describe, expect, test } from 'bun:test'

import {
  escapeShellArgument,
  executeCommand,
  extractAppName,
  formatList,
  normalizeAppName,
  parseCommandOutput,
  pluralize,
  shouldIgnoreApp,
} from '../src/utils.ts'

describe('utils', () => {
  describe('escapeShellArgument', () => {
    test('should wrap simple text in quotes', () => {
      expect(escapeShellArgument('hello')).toBe('"hello"')
    })

    test('should escape internal quotes', () => {
      expect(escapeShellArgument('say "hello"')).toBe(
        String.raw`"say \"hello\""`,
      )
    })

    test('should handle empty string', () => {
      expect(escapeShellArgument('')).toBe('""')
    })

    test('should handle special characters', () => {
      const result = escapeShellArgument('hello & world')
      expect(result).toBe('"hello & world"')
    })
  })

  describe('extractAppName', () => {
    test('should extract app name from .app path', () => {
      expect(extractAppName('/Applications/Google Chrome.app')).toBe(
        'Google Chrome',
      )
    })

    test('should handle nested paths', () => {
      expect(extractAppName('/Users/test/Applications/Firefox.app')).toBe(
        'Firefox',
      )
    })

    test('should handle case insensitive .app extension', () => {
      expect(extractAppName('/Applications/Test.APP')).toBe('Test')
    })

    test('should return empty string for invalid path', () => {
      expect(extractAppName('')).toBe('')
    })

    test('should handle path without .app extension', () => {
      expect(extractAppName('/Applications/SomeFile')).toBe('SomeFile')
    })
  })

  describe('formatList', () => {
    test('should format list with default indent', () => {
      const result = formatList(['item1', 'item2', 'item3'])
      expect(result.includes('• item1')).toBe(true)
      expect(result.includes('• item2')).toBe(true)
      expect(result.includes('• item3')).toBe(true)
    })

    test('should format list with custom indent', () => {
      const result = formatList(['item1'], '    ')
      expect(result.includes('    • item1')).toBe(true)
    })

    test('should handle empty list', () => {
      expect(formatList([])).toBe('')
    })

    test('should handle single item', () => {
      const result = formatList(['single'])
      expect(result).toBe('  • single')
    })
  })

  describe('normalizeAppName', () => {
    test('should convert to lowercase', () => {
      expect(normalizeAppName('Google Chrome')).toBe('google-chrome')
    })

    test('should replace spaces with hyphens', () => {
      expect(normalizeAppName('Visual Studio Code')).toBe('visual-studio-code')
    })

    test('should remove special characters', () => {
      expect(normalizeAppName('App@#$Name')).toBe('appname')
    })

    test('should handle multiple consecutive spaces', () => {
      expect(normalizeAppName('App    Name')).toBe('app-name')
    })

    test('should remove leading and trailing hyphens', () => {
      expect(normalizeAppName('  App Name  ')).toBe('app-name')
    })

    test('should preserve dots and underscores', () => {
      expect(normalizeAppName('App.Name_Test')).toBe('app.name_test')
    })
  })

  describe('parseCommandOutput', () => {
    test('should split output into lines', () => {
      const output = 'line1\nline2\nline3'
      const result = parseCommandOutput(output)
      expect(result).toEqual(['line1', 'line2', 'line3'])
    })

    test('should filter out empty lines', () => {
      const output = 'line1\n\nline2\n\nline3'
      const result = parseCommandOutput(output)
      expect(result).toEqual(['line1', 'line2', 'line3'])
    })

    test('should trim whitespace from lines', () => {
      const output = '  line1  \n  line2  '
      const result = parseCommandOutput(output)
      expect(result).toEqual(['line1', 'line2'])
    })

    test('should handle empty output', () => {
      const result = parseCommandOutput('')
      expect(result).toEqual([])
    })
  })

  describe('pluralize', () => {
    test('should return singular for count of 1', () => {
      expect(pluralize('app', 1)).toBe('app')
    })

    test('should return plural for count > 1', () => {
      expect(pluralize('app', 2)).toBe('apps')
    })

    test('should return plural for count of 0', () => {
      expect(pluralize('app', 0)).toBe('apps')
    })

    test('should use custom suffix', () => {
      expect(pluralize('child', 2, 'ren')).toBe('children')
    })

    test('should handle negative counts as plural', () => {
      expect(pluralize('app', -1)).toBe('apps')
    })
  })

  describe('executeCommand', () => {
    test('should execute simple command successfully', async () => {
      const result = await executeCommand('echo "Hello World"')

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('Hello World')
      expect(result.stderr).toBe('')
    })

    test('should handle command with output to stderr', async () => {
      const result = await executeCommand('echo "Error message" >&2')

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('Error message')
    })

    test('should handle failing command', async () => {
      const result = await executeCommand('exit 1')

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
    })

    test('should handle command not found', async () => {
      const result = await executeCommand('nonexistentcommand123456')

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(127)
    })

    test('should handle timeout', async () => {
      const result = await executeCommand('sleep 2', 500) // 500ms timeout for 2s sleep

      expect(result.success).toBe(false)
      // Timeout should result in failure - exact error message may vary
      expect(result.exitCode !== 0 || result.stderr.length > 0).toBe(true)
    })

    test('should return dry run message when dryRun is true', async () => {
      const result = await executeCommand(
        'echo "Should not execute"',
        5000,
        true,
      )

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(
        '[DRY RUN] Would execute: echo "Should not execute"',
      )
      expect(result.stderr).toBe('')
    })

    test('should use default timeout when not specified', async () => {
      const result = await executeCommand('echo "default timeout test"')

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('default timeout test')
    })

    test('should trim stdout and stderr output', async () => {
      const result = await executeCommand('echo "  spaces  "')

      expect(result.success).toBe(true)
      // The trim() function removes leading/trailing whitespace including newlines
      expect(result.stdout).toBe('spaces')
    })

    test('should handle complex command with pipes', async () => {
      const result = await executeCommand('echo "hello world" | tr a-z A-Z')

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('HELLO WORLD')
    })

    test('should handle command with multiple arguments', async () => {
      const result = await executeCommand(
        String.raw`printf "%s %s\n" "Hello" "World"`,
      )

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('Hello World')
    })

    test('should return consistent result structure on success', async () => {
      const result = await executeCommand('echo test')

      expect(typeof result.success).toBe('boolean')
      expect(typeof result.exitCode).toBe('number')
      expect(typeof result.stdout).toBe('string')
      expect(typeof result.stderr).toBe('string')
      expect('success' in result).toBe(true)
      expect('exitCode' in result).toBe(true)
      expect('stdout' in result).toBe(true)
      expect('stderr' in result).toBe(true)
    })

    test('should return consistent result structure on failure', async () => {
      const result = await executeCommand('exit 42')

      expect(typeof result.success).toBe('boolean')
      expect(typeof result.exitCode).toBe('number')
      expect(typeof result.stdout).toBe('string')
      expect(typeof result.stderr).toBe('string')
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(42)
    })

    test('should throw error for empty command', () => {
      expect(executeCommand('')).rejects.toThrow('Command cannot be empty')
    })

    test('should throw error for whitespace-only command', () => {
      expect(executeCommand('   \t  \n  ')).rejects.toThrow(
        'Command cannot be empty',
      )
    })

    test('should handle very short timeout', async () => {
      const result = await executeCommand('echo "quick"', 1) // 1ms timeout

      // This might succeed or fail depending on system speed,
      // but should not crash and should return proper structure
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.exitCode).toBe('number')
    })
  })

  describe('shouldIgnoreApp', () => {
    test('should return false when ignore list is empty', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [])
      expect(result).toBe(false)
    })

    test('should ignore app by original name', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'Bartender 5',
      ])
      expect(result).toBe(true)
    })

    test('should ignore app by brew name', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'bartender',
      ])
      expect(result).toBe(true)
    })

    test('should ignore app case insensitively', () => {
      const result1 = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'BARTENDER 5',
      ])
      const result2 = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'BARTENDER',
      ])
      expect(result1).toBe(true)
      expect(result2).toBe(true)
    })

    test('should handle multiple ignore patterns', () => {
      const ignoreList = ['chrome', 'Visual Studio Code', 'bartender']

      expect(
        shouldIgnoreApp('Google Chrome', 'google-chrome', ignoreList),
      ).toBe(false)
      expect(shouldIgnoreApp('Chrome', 'chrome', ignoreList)).toBe(true)
      expect(
        shouldIgnoreApp('Visual Studio Code', 'visual-studio-code', ignoreList),
      ).toBe(true)
      expect(shouldIgnoreApp('Bartender 5', 'bartender-5', ignoreList)).toBe(
        true,
      )
    })

    test('should not ignore when no match found', () => {
      const result = shouldIgnoreApp('Firefox', 'firefox', ['chrome', 'safari'])
      expect(result).toBe(false)
    })

    test('should handle whitespace in ignore patterns', () => {
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        ' bartender ',
      ])
      expect(result).toBe(true)
    })

    test('should handle special characters', () => {
      const result = shouldIgnoreApp('App with (parens)', 'app-with-parens', [
        'app with (parens)',
      ])
      expect(result).toBe(true)
    })

    test('should match exact normalized names only', () => {
      // "bartender" should match "bartender-5" (prefix matching)
      const result1 = shouldIgnoreApp('Bartender', 'bartender', ['bartender-5'])
      const result2 = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'bartender',
      ])

      expect(result1).toBe(false) // "bartender" != "bartender-5"
      expect(result2).toBe(true) // "bartender" matches "bartender-5" via prefix
    })

    test('should handle prefix matching for versioned apps', () => {
      // Test the key use case: --ignore bartender should ignore "Bartender 5"
      const result1 = shouldIgnoreApp('Bartender 5', 'bartender-5', [
        'bartender',
      ])
      const result2 = shouldIgnoreApp('Chrome 110', 'chrome-110', ['chrome'])
      const result3 = shouldIgnoreApp('App 2.0', 'app-2.0', ['app'])

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
    })

    test('should not match unrelated prefixes', () => {
      // "bart" should not match "bartender-5"
      const result = shouldIgnoreApp('Bartender 5', 'bartender-5', ['bart'])
      expect(result).toBe(false)
    })
  })
})
