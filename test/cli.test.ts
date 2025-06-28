/**
 * @fileoverview Test suite for CLI module
 * Tests command-line interface functionality
 */

import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, test } from 'node:test'

import type { CommandOptions } from '../src/types.ts'

import { createProgram, parseArguments, validateEnvironment } from '../src/cli.ts'
import { mockConsole } from './helpers/test-utils.ts'

void describe('cli', () => {
  let consoleMock: { errors: string[], logs: string[], restore: () => void, warnings: string[] }

  beforeEach(() => {
    consoleMock = mockConsole()
  })

  afterEach(() => {
    consoleMock.restore()
  })

  void describe('createProgram', () => {
    void test('should create a commander program with correct configuration', () => {
      const program = createProgram()

      assert.strictEqual(program.name(), 'convert-apps-to-homebrew')
      assert.strictEqual(typeof program.description(), 'string')
      assert.strictEqual(program.description().includes('Convert macOS applications'), true)
    })

    void test('should have all required options configured', () => {
      const program = createProgram()
      const { options } = program

      const optionNames = new Set(options.map(opt => opt.long))
      assert.strictEqual(optionNames.has('--ignore'), true)
      assert.strictEqual(optionNames.has('--dry-run'), true)
      assert.strictEqual(optionNames.has('--verbose'), true)
      assert.strictEqual(optionNames.has('--applications-dir'), true)
    })

    void test('should have version information', () => {
      const program = createProgram()
      const version = program.version()
      assert.strictEqual(typeof version, 'string')
      assert.strictEqual(version !== undefined && version.length > 0, true)
    })
  })

  void describe('parseArguments', () => {
    void test('should parse basic arguments with defaults', () => {
      const argv = ['node', 'script.js']
      const result = parseArguments(argv)

      assert.strictEqual(typeof result, 'object')
      assert.strictEqual(Array.isArray(result.ignore), true)
      assert.strictEqual(result.dryRun, false)
      assert.strictEqual(result.verbose, false)
      assert.strictEqual(result.applicationsDir, '/Applications')
    })

    void test('should parse ignore option correctly', () => {
      const argv = ['node', 'script.js', '--ignore', 'Chrome', 'Firefox']
      const result = parseArguments(argv)

      assert.strictEqual(Array.isArray(result.ignore), true)
      assert.strictEqual(result.ignore?.includes('Chrome'), true)
      assert.strictEqual(result.ignore?.includes('Firefox'), true)
    })

    void test('should parse short ignore option correctly', () => {
      const argv = ['node', 'script.js', '-i', 'Safari', 'TextEdit']
      const result = parseArguments(argv)

      assert.strictEqual(Array.isArray(result.ignore), true)
      assert.strictEqual(result.ignore?.includes('Safari'), true)
      assert.strictEqual(result.ignore?.includes('TextEdit'), true)
    })

    void test('should parse dry-run option correctly', () => {
      const argv = ['node', 'script.js', '--dry-run']
      const result = parseArguments(argv)

      assert.strictEqual(result.dryRun, true)
    })

    void test('should parse short dry-run option correctly', () => {
      const argv = ['node', 'script.js', '-d']
      const result = parseArguments(argv)

      assert.strictEqual(result.dryRun, true)
    })

    void test('should parse verbose option correctly', () => {
      const argv = ['node', 'script.js', '--verbose']
      const result = parseArguments(argv)

      assert.strictEqual(result.verbose, true)
    })

    void test('should parse custom applications directory', () => {
      const customDirectory = '/System/Applications'
      const argv = ['node', 'script.js', '--applications-dir', customDirectory]
      const result = parseArguments(argv)

      assert.strictEqual(result.applicationsDir, customDirectory)
    })

    void test('should handle multiple options together', () => {
      const argv = [
        'node',
        'script.js',
        '--verbose',
        '--dry-run',
        '--ignore',
        'Chrome',
        'Firefox',
        '--applications-dir',
        '/custom/path',
      ]
      const result = parseArguments(argv)

      assert.strictEqual(result.verbose, true)
      assert.strictEqual(result.dryRun, true)
      assert.strictEqual(result.ignore?.includes('Chrome'), true)
      assert.strictEqual(result.ignore?.includes('Firefox'), true)
      assert.strictEqual(result.applicationsDir, '/custom/path')
    })

    void test('should validate command options structure', () => {
      const argv = ['node', 'script.js', '--verbose', '--dry-run']
      const result = parseArguments(argv)

      // Verify all required CommandOptions properties exist
      const requiredProperties: (keyof CommandOptions)[] = [
        'ignore',
        'dryRun',
        'verbose',
        'applicationsDir',
      ]

      for (const property of requiredProperties) {
        assert.strictEqual(property in result, true, `Missing property: ${property}`)
      }
    })
  })

  void describe('validateEnvironment', () => {
    void test('should validate Node.js version on macOS', () => {
      // Store original values
      const originalPlatform = process.platform
      const originalVersion = process.version

      Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' })
      Object.defineProperty(process, 'version', { configurable: true, value: 'v24.0.0' })

      assert.doesNotThrow(() => {
        validateEnvironment()
      })

      // Restore original values
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
      Object.defineProperty(process, 'version', { configurable: true, value: originalVersion })
    })
  })

  void describe('program configuration', () => {
    void test('should have examples in help text', () => {
      const program = createProgram()
      const helpText = program.helpInformation()

      assert.strictEqual(typeof helpText, 'string')
      assert.strictEqual(helpText.includes('interactive selection'), true)
    })

    void test('should have proper command name and description', () => {
      const program = createProgram()

      assert.strictEqual(program.name(), 'convert-apps-to-homebrew')
      assert.strictEqual(program.description().includes('Convert macOS applications'), true)
      assert.strictEqual(program.description().includes('Homebrew'), true)
      assert.strictEqual(program.description().includes('interactive'), true)
    })

    void test('should configure ignore option correctly', () => {
      const program = createProgram()
      const ignoreOption = program.options.find(opt => opt.long === '--ignore')

      assert.strictEqual(ignoreOption !== undefined, true)
      assert.strictEqual(ignoreOption?.short, '-i')
      assert.strictEqual(ignoreOption?.description.includes('ignore specific applications'), true)
    })

    void test('should configure dry-run option correctly', () => {
      const program = createProgram()
      const dryRunOption = program.options.find(opt => opt.long === '--dry-run')

      assert.strictEqual(dryRunOption !== undefined, true)
      assert.strictEqual(dryRunOption?.short, '-d')
      assert.strictEqual(dryRunOption?.description.includes('show what would be done'), true)
    })

    void test('should configure verbose option correctly', () => {
      const program = createProgram()
      const verboseOption = program.options.find(opt => opt.long === '--verbose')

      assert.strictEqual(verboseOption !== undefined, true)
      assert.strictEqual(verboseOption?.description.includes('verbose output'), true)
    })

    void test('should configure applications-dir option correctly', () => {
      const program = createProgram()
      const appsDirectoryOption = program.options.find(opt => opt.long === '--applications-dir')

      assert.strictEqual(appsDirectoryOption !== undefined, true)
      assert.strictEqual(appsDirectoryOption?.description.includes('Applications directory'), true)
    })
  })
})
