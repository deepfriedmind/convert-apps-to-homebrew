/**
 * Tests for app matcher module
 */

import { expect, test } from 'bun:test'
import { describe } from 'node:test'
import { AppMatcher } from '../src/app-matcher.ts'
import type { AppInfo, HomebrewCask } from '../src/types.ts'

const MIN_CONFIDENCE_THRESHOLD = 0.8
const HIGH_CONFIDENCE_THRESHOLD = 0.98
const NO_HYPHENS_CONFIDENCE_THRESHOLD = 0.88

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
    artifacts: [{ uninstall: [{ quit: 'com.yubico.ykman' }] }],
    desc: 'Application for configuring any YubiKey',
    full_token: 'homebrew/cask/yubico-yubikey-manager',
    homepage: 'https://developers.yubico.com/yubikey-manager-qt/',
    name: ['Yubikey Manager'], // Note: Space here
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'yubico-yubikey-manager',
  },
  {
    artifacts: [{ app: ['Diashapes.app'] }],
    desc: 'Additional shapes for Dia',
    full_token: 'homebrew/cask/diashapes',
    homepage: 'http://dia-installer.de/shapes/index.html',
    name: ['Dia'],
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'diashapes',
  },
  {
    artifacts: [{ app: ['Dia.app'] }],
    desc: 'Web browser',
    full_token: 'homebrew/cask/thebrowsercompany-dia',
    homepage: 'https://www.diabrowser.com/',
    name: ['Dia'],
    old_tokens: [],
    tap: 'homebrew/cask',
    token: 'thebrowsercompany-dia',
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

describe('AppMatcher', () => {
  test('should initialize correctly', () => {
    const matcher = new AppMatcher({})
    expect(matcher).toBeInstanceOf(AppMatcher)
  })

  test('should build index from casks', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    expect(index.byToken.has('visual-studio-code')).toBe(true)
    expect(index.byToken.has('google-chrome')).toBe(true)
    expect(index.byToken.size).toBe(mockCasks.length)
  })

  test('should match apps by exact bundle name', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const matchResult = matcher.matchApp(mockApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('visual-studio-code')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThan(
      MIN_CONFIDENCE_THRESHOLD,
    )
  })

  test('should match "YubiKey Manager" using normalized cask name match', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const yubiKeyApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/YubiKey Manager.app',
      brewName: 'yubikey-manager',
      brewType: 'unavailable',
      originalName: 'YubiKey Manager',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(yubiKeyApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('yubico-yubikey-manager')
    expect(matchResult.bestMatch?.matchType).toBe('name-exact')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThanOrEqual(
      NO_HYPHENS_CONFIDENCE_THRESHOLD,
    )
  })

  test('should match "Quit All" using hyphen-less normalized cask name match', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const quitAllApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Quit All.app',
      brewName: 'quit-all',
      brewType: 'unavailable',
      originalName: 'Quit All',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(quitAllApp, index)
    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('quit-all')
    expect(matchResult.bestMatch?.matchType).toBe('name-exact')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThanOrEqual(
      NO_HYPHENS_CONFIDENCE_THRESHOLD,
    )
  })

  test('should prefer app bundle match when names are ambiguous', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const diaApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Dia.app',
      brewName: 'dia',
      brewType: 'unavailable',
      originalName: 'Dia',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(diaApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('thebrowsercompany-dia')
    expect(matchResult.bestMatch?.matchType).toBe('exact-app-bundle')
    expect(matchResult.bestMatch?.confidence).toBeGreaterThanOrEqual(
      HIGH_CONFIDENCE_THRESHOLD,
    )
  })

  test('should return no matches when only ambiguous names exist', () => {
    const matcher = new AppMatcher({})
    const ambiguousCasks: HomebrewCask[] = [
      {
        artifacts: [{ app: ['Diashapes.app'] }],
        desc: 'Additional shapes for Dia',
        full_token: 'homebrew/cask/diashapes',
        homepage: 'http://dia-installer.de/shapes/index.html',
        name: ['Dia'],
        old_tokens: [],
        tap: 'homebrew/cask',
        token: 'diashapes',
      },
      {
        artifacts: [{ app: ['Dia Browser.app'] }],
        desc: 'Web browser',
        full_token: 'homebrew/cask/thebrowsercompany-dia',
        homepage: 'https://www.diabrowser.com/',
        name: ['Dia'],
        old_tokens: [],
        tap: 'homebrew/cask',
        token: 'thebrowsercompany-dia',
      },
    ]

    const index = matcher.buildIndex(ambiguousCasks)

    const diaApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Dia.app',
      brewName: 'dia',
      brewType: 'unavailable',
      originalName: 'Dia',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(diaApp, index)

    expect(matchResult.bestMatch).toBeUndefined()
    expect(matchResult.matches).toHaveLength(0)
  })

  test('should match using bundle identifier when available', () => {
    const matcher = new AppMatcher({})
    const index = matcher.buildIndex(mockCasks)

    const chromeApp: AppInfo = {
      alreadyInstalled: false,
      appPath: '/Applications/Chrome.app',
      brewName: 'chrome',
      brewType: 'unavailable',
      bundleId: 'com.google.Chrome',
      originalName: 'Chrome',
      status: 'unavailable',
    }

    const matchResult = matcher.matchApp(chromeApp, index)

    expect(matchResult.bestMatch).toBeDefined()
    expect(matchResult.bestMatch?.cask.token).toBe('google-chrome')
    expect(matchResult.bestMatch?.matchType).toBe('bundle-id')
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
