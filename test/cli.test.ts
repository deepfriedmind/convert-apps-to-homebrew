/**
 * Test file for cli.ts
 */

import { describe, expect, test } from 'bun:test'

import { createProgram, parseArguments } from '../src/cli.ts'

describe('CLI', () => {
  describe('createProgram', () => {
    test('should create a commander program with correct configuration', () => {
      const program = createProgram()

      expect(program.name()).toBe('convert-apps-to-homebrew')
    })

    test('should have all required options configured', () => {
      const program = createProgram()
      const { options } = program

      const optionNames = new Set(options.map(opt => opt.long))
      expect(optionNames.has('--ignore')).toBe(true)
      expect(optionNames.has('--dry-run')).toBe(true)
      expect(optionNames.has('--verbose')).toBe(true)
      expect(optionNames.has('--applications-dir')).toBe(true)
      expect(optionNames.has('--ignore-app-store')).toBe(true)
    })

    test('should have version information', () => {
      const program = createProgram()
      const version = program.version()
      expect(typeof version).toBe('string')
    })
  })

  describe('parseArguments', () => {
    test('should parse basic arguments with defaults', () => {
      const argv = ['node', 'script.js']
      const result = parseArguments(argv)

      expect(typeof result).toBe('object')
      expect(result.dryRun).toBe(false)
      expect(result.verbose).toBe(false)
      expect(Array.isArray(result.ignore)).toBe(true)
      expect(result.ignore).toHaveLength(0)
      expect(result.applicationsDir).toBe('/Applications')
      expect(result.ignoreAppStore).toBe(false)
    })

    test('should parse ignore option correctly', () => {
      const argv = ['node', 'script.js', '--ignore', 'Chrome', 'Firefox']
      const result = parseArguments(argv)

      expect(Array.isArray(result.ignore)).toBe(true)
      expect(result.ignore).toEqual(['Chrome', 'Firefox'])
    })

    test('should parse short ignore option correctly', () => {
      const argv = ['node', 'script.js', '-i', 'Safari', 'TextEdit']
      const result = parseArguments(argv)

      expect(Array.isArray(result.ignore)).toBe(true)
      expect(result.ignore).toEqual(['Safari', 'TextEdit'])
    })

    test('should parse dry-run option correctly', () => {
      const argv = ['node', 'script.js', '--dry-run']
      const result = parseArguments(argv)

      expect(result.dryRun).toBe(true)
    })

    test('should parse short dry-run option correctly', () => {
      const argv = ['node', 'script.js', '-d']
      const result = parseArguments(argv)

      expect(result.dryRun).toBe(true)
    })

    test('should parse verbose option correctly', () => {
      const argv = ['node', 'script.js', '--verbose']
      const result = parseArguments(argv)

      expect(result.verbose).toBe(true)
    })

    test('should parse ignore-app-store option correctly', () => {
      const argv = ['node', 'script.js', '--ignore-app-store']
      const result = parseArguments(argv)

      expect(result.ignoreAppStore).toBe(true)
    })

    test('should parse custom applications directory', () => {
      const customDirectory = '/System/Applications'
      const argv = ['node', 'script.js', '--applications-dir', customDirectory]
      const result = parseArguments(argv)

      expect(result.applicationsDir).toBe(customDirectory)
    })

    test('should handle multiple options together', () => {
      const argv = [
        'node',
        'script.js',
        '--dry-run',
        '--verbose',
        '--ignore',
        'Adobe Photoshop',
        'Microsoft Word',
        '--applications-dir',
        '/custom/path',
      ]
      const result = parseArguments(argv)

      expect(result.verbose).toBe(true)
      expect(result.dryRun).toBe(true)
      expect(result.ignore).toEqual(['Adobe Photoshop', 'Microsoft Word'])
      expect(result.applicationsDir).toBe('/custom/path')
    })

    test('should validate command options structure', () => {
      const argv = ['node', 'script.js']
      const result = parseArguments(argv)

      const requiredProperties = [
        'dryRun',
        'verbose',
        'ignore',
        'applicationsDir',
        'ignoreAppStore',
      ]

      for (const property of requiredProperties) {
        expect(property in result).toBe(true)
      }
    })
  })

  describe('program configuration', () => {
    test('should have examples in help text', () => {
      const program = createProgram()
      const helpText = program.helpInformation()

      expect(typeof helpText).toBe('string')
      expect(helpText.length).toBeGreaterThan(0)
    })

    test('should have proper command name and description', () => {
      const program = createProgram()

      expect(program.name()).toBe('convert-apps-to-homebrew')
      expect(typeof program.description()).toBe('string')
    })

    test('should configure ignore option correctly', () => {
      const program = createProgram()
      const ignoreOption = program.options.find(opt => opt.long === '--ignore')

      expect(ignoreOption).toBeDefined()
      expect(ignoreOption?.flags).toBe('-i, --ignore <apps...>')
    })

    test('should configure dry-run option correctly', () => {
      const program = createProgram()
      const dryRunOption = program.options.find(opt => opt.long === '--dry-run')

      expect(dryRunOption).toBeDefined()
      expect(dryRunOption?.flags).toBe('-d, --dry-run')
    })

    test('should configure verbose option correctly', () => {
      const program = createProgram()
      const verboseOption = program.options.find(opt => opt.long === '--verbose')

      expect(verboseOption).toBeDefined()
      expect(verboseOption?.flags).toBe('--verbose')
    })

    test('should configure applications-dir option correctly', () => {
      const program = createProgram()
      const appsDirectoryOption = program.options.find(opt => opt.long === '--applications-dir')

      expect(appsDirectoryOption).toBeDefined()
      expect(appsDirectoryOption?.flags).toBe('--applications-dir <path>')
    })

    test('should configure ignore-app-store option correctly', () => {
      const program = createProgram()
      const ignoreAppStoreOption = program.options.find(opt => opt.long === '--ignore-app-store')

      expect(ignoreAppStoreOption).toBeDefined()
      expect(ignoreAppStoreOption?.flags).toBe('--ignore-app-store')
    })
  })
})
