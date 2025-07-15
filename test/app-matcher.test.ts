/**
 * Tests for app matcher module
 */

import { expect, test } from 'bun:test'

import type { AppInfo, HomebrewCask } from '../src/types.ts'

import { AppMatcher } from '../src/app-matcher.ts'

// Mock data for testing
const mockCasks: HomebrewCask[] = [
  {
    artifacts: [
      {
        app: ['Visual Studio Code.app'],
        uninstall: [
          {
            quit: 'com.microsoft.VSCode',
          },
        ],
      },
    ],
    desc: 'Open-source code editor',
    full_token: 'homebrew/cask/visual-studio-code',
    homepage: 'https://code.visualstudio.com/',
    name: ['Microsoft Visual Studio Code', 'VS Code'],
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'visual-studio-code',
  },
  {
    artifacts: [
      {
        app: ['Google Chrome.app'],
        uninstall: [
          {
            quit: 'com.google.Chrome',
          },
        ],
      },
    ],
    desc: 'Web browser',
    full_token: 'homebrew/cask/google-chrome',
    homepage: 'https://www.google.com/chrome/',
    name: ['Google Chrome'],
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'google-chrome',
  },
  {
    artifacts: [{ app: ['QuitAll.app'] }],
    desc: 'Quickly quit one, some, or all apps',
    full_token: 'homebrew/cask/quit-all',
    homepage: 'https://amicoapps.com/app/quit-all/',
    name: ['QuitAll'], // Note: No space here in the actual cask data
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'quit-all',
  },
  {
    artifacts: [
      { uninstall: [{ quit: 'com.yubico.ykman' }] },
    ],
    desc: 'Application for configuring any YubiKey',
    full_token: 'homebrew/cask/yubico-yubikey-manager',
    homepage: 'https://developers.yubico.com/yubikey-manager-qt/',
    name: ['Yubikey Manager'], // Note: Space here
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'yubico-yubikey-manager',
  },
]

const mockApp: AppInfo = {
  alreadyInstalled: false,
  appPath: '/Applications/Visual Studio Code.app',
  brewName: 'visual-studio-code',
  brewType: 'unavailable',
  originalName: 'Visual Studio Code',
  status: 'unavailable',
}

test('AppMatcher', () => {
  test('should initialize correctly', () => {
    const matcher = new AppMatcher({})
    expect(matcher).toBeInstanceOf(AppMatcher)
  })

  test('should build index from casks', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    expect(index.byToken.has('visual-studio-code')).toBe(true)
    expect(index.byToken.has('google-chrome')).toBe(true)
    expect(index.byToken.size).toBe(4)
  })

  test('should match apps by exact bundle name', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const matchResult = matcher.matchApp(mockApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('visual-studio-code')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThan(0.8)
  })

  test('should match "YubiKey Manager" using normalized cask name match', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const yubiKeyApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/YubiKey Manager.app',
      brewName: 'yubikey-manager', // or what it would be detected as
      brewType: 'unavailable',
      originalName: 'YubiKey Manager', // Input with space
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(yubiKeyApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('yubico-yubikey-manager')
    expect(matchResult.bestMatch?.matchType).toBe('name-exact')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThanOrEqual(0.98)
  })

  test('should match "Quit All" using hyphen-less normalized cask name match', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const quitAllApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Quit All.app', // Input with space
      brewName: 'quit-all', // or what it would be detected as
      brewType: 'unavailable',
      originalName: 'Quit All', // Input with space
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(quitAllApp, index)
    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('quit-all')
    expect(matchResult.bestMatch?.matchType).toBe('name-exact')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThanOrEqual(0.98)
  })

  test('should handle apps with no matches', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const unmatchableApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/NonExistent App.app',
      brewName: 'nonexistent-app',
      brewType: 'unavailable',
      originalName: 'NonExistent App',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(unmatchableApp, index)

    expect(matchResult.bestMatch).toBeUndefined()
    expect(matchResult.matches).toHaveLength(0)
  })

  test('should match multiple apps in batch', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const apps: AppInfo[] = [
      mockApp,
      {
        alreadyInstalled: false,
        appPath: '/Applications/Google Chrome.app',
        brewName: 'google-chrome',
        brewType: 'unavailable',
        originalName: 'Google Chrome',
        status: 'unavailable',
      },
    ]

    const results = matcher.matchApps(apps, index)

    expect(results).toHaveLength(2)
    expect(results[0]?.bestMatch).toBeDefined()
    expect(results[1]?.bestMatch).toBeDefined()
  })

  test('should respect confidence threshold', () => {
    const matcher = new AppMatcher({ minConfidence: 0.95 })
    const index = matcher.buildIndex(mockCasks)

    // This should have lower confidence and be filtered out
    const lowConfidenceApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/VS.app',
      brewName: 'vs',
      brewType: 'unavailable',
      originalName: 'VS',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(lowConfidenceApp, index)

    // Should have fewer or no matches due to high confidence threshold
    expect(matchResult.matches.length).toBeLessThanOrEqual(1)
  })
})
