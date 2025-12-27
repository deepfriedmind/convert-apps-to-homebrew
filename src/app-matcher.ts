/**
 * App matching logic for finding Homebrew casks that correspond to local applications
 */

import { consola } from 'consola'
import { FILE_PATTERNS } from './constants.ts'
import type {
  AddBrewNameMatchesOptions,
  AppInfo,
  AppMatchResult,
  CaskIndex,
  CaskMatch,
  FindCaskNameMatchesOptions,
  HomebrewCask,
  MatchingConfig,
  MatchingStrategy,
} from './types.ts'
import { normalizeAppName, normalizeBundleIdentifier } from './utils.ts'

/**
 * Default matching configuration
 */
const DEFAULT_MIN_CONFIDENCE = 0.6
const CONSOLA_DEBUG_LEVEL = 4
const BUNDLE_ID_CONFIDENCE = 0.99
const APP_BUNDLE_CONFIDENCE = 0.98
const NAME_EXACT_CONFIDENCE = 0.9
const NAME_NO_HYPHENS_CONFIDENCE = 0.88
const BREW_NAME_CONFIDENCE = 0.85
const BREW_NAME_NO_HYPHENS_CONFIDENCE = 0.83

const BUNDLE_ID_SUFFIXES = ['.plist', '.binarycookies', '.sqlite', '.sqlite3']
const BUNDLE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]+$/

const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  maxMatches: 5,
  minConfidence: DEFAULT_MIN_CONFIDENCE,
}

/**
 * App matcher class for finding cask matches
 */
export class AppMatcher {
  private caskIndex?: CaskIndex
  private readonly config: MatchingConfig

  constructor(config: Partial<MatchingConfig> = {}) {
    this.config = { ...DEFAULT_MATCHING_CONFIG, ...config }
  }

  /**
   * Build search indexes from cask data
   */
  buildIndex(casks: HomebrewCask[]): CaskIndex {
    consola.debug(`Building search index for ${casks.length} casks...`)

    const index: CaskIndex = {
      byAppBundle: new Map(),
      byBundleId: new Map(),
      byNormalizedName: new Map(),
      byToken: new Map(),
    }

    for (const cask of casks) {
      this.indexCask(cask, index)
    }

    this.caskIndex = index
    consola.debug('Search index built successfully')
    return index
  }

  /**
   * Index a single cask into all relevant indexes
   */
  private indexCask(cask: HomebrewCask, index: CaskIndex): void {
    if (this.shouldSkipCask(cask)) {
      return
    }

    // Index by token
    index.byToken.set(cask.token, cask)

    // Index by normalized names
    this.indexCaskNames(cask, index)

    // Index by artifacts (app bundles and bundle IDs)
    this.indexCaskArtifacts(cask, index)
  }

  private shouldSkipCask(cask: HomebrewCask): boolean {
    return cask.disabled === true || cask.deprecated === true
  }

  private indexCaskNames(cask: HomebrewCask, index: CaskIndex): void {
    for (const name of cask.name) {
      const normalized = normalizeAppName(name)
      this.addToMap(index.byNormalizedName, normalized, cask)
    }
  }

  private indexCaskArtifacts(cask: HomebrewCask, index: CaskIndex): void {
    for (const artifact of cask.artifacts) {
      this.indexAppBundles(artifact, cask, index)
      this.indexBundleIds(artifact, cask, index)
      this.indexBundleIdsFromZap(artifact, cask, index)
    }
  }

  private indexAppBundles(
    artifact: { app?: unknown[] },
    cask: HomebrewCask,
    index: CaskIndex,
  ): void {
    if (!artifact.app) {
      return
    }

    for (const appName of artifact.app) {
      const appNameString = this.extractAppNameString(appName, cask.token)
      if (appNameString) {
        const normalized = normalizeAppName(
          appNameString.replace(FILE_PATTERNS.APP_PATTERN, ''),
        )
        this.addToMap(index.byAppBundle, normalized, cask)
      }
    }
  }

  /**
   * Extract app name string from various formats
   */
  private extractAppNameString(
    appName: unknown,
    caskToken: string,
  ): string | null {
    if (typeof appName === 'string') {
      return appName
    }

    if (
      typeof appName === 'object' &&
      appName !== null &&
      'target' in appName &&
      typeof (appName as { target: unknown }).target === 'string'
    ) {
      return (appName as { target: string }).target
    }

    consola.debug(
      `Skipping unexpected app name format in cask ${caskToken}: ${typeof appName}`,
    )
    return null
  }

  private indexBundleIds(
    artifact: { uninstall?: unknown[] },
    cask: HomebrewCask,
    index: CaskIndex,
  ): void {
    if (!artifact.uninstall) {
      return
    }

    for (const uninstallStep of artifact.uninstall) {
      if (
        typeof uninstallStep === 'object' &&
        uninstallStep !== null &&
        ('quit' in uninstallStep || 'launchctl' in uninstallStep)
      ) {
        this.indexUninstallStep(
          uninstallStep as { quit?: string; launchctl?: string },
          cask,
          index,
        )
      }
    }
  }

  private indexBundleIdsFromZap(
    artifact: { zap?: Array<{ trash?: string[]; delete?: string[] }> },
    cask: HomebrewCask,
    index: CaskIndex,
  ): void {
    if (!artifact.zap) {
      return
    }

    for (const zapEntry of artifact.zap) {
      const paths = [...(zapEntry.trash ?? []), ...(zapEntry.delete ?? [])]

      for (const pathEntry of paths) {
        const bundleId = this.extractBundleIdentifierFromPath(pathEntry)
        if (bundleId) {
          this.addToMap(index.byBundleId, bundleId, cask)
        }
      }
    }
  }

  private extractBundleIdentifierFromPath(pathEntry: string): string | null {
    const trimmedPath = pathEntry.trim()
    if (trimmedPath === '') {
      return null
    }

    const lastSegment = trimmedPath.split('/').at(-1)
    if (!lastSegment) {
      return null
    }

    const candidate = this.stripBundleIdSuffix(lastSegment)
    if (!candidate.includes('.')) {
      return null
    }

    if (!BUNDLE_IDENTIFIER_PATTERN.test(candidate)) {
      return null
    }

    const normalized = normalizeBundleIdentifier(candidate)
    return normalized === '' ? null : normalized
  }

  private stripBundleIdSuffix(value: string): string {
    const lowerValue = value.toLowerCase()

    for (const suffix of BUNDLE_ID_SUFFIXES) {
      if (lowerValue.endsWith(suffix)) {
        return value.slice(0, -suffix.length)
      }
    }

    return value
  }

  private indexUninstallStep(
    uninstallStep: { quit?: string; launchctl?: string },
    cask: HomebrewCask,
    index: CaskIndex,
  ): void {
    if (typeof uninstallStep.quit === 'string') {
      const normalized = normalizeBundleIdentifier(uninstallStep.quit)
      if (normalized !== '') {
        this.addToMap(index.byBundleId, normalized, cask)
      }
    }

    if (typeof uninstallStep.launchctl === 'string') {
      const normalized = normalizeBundleIdentifier(uninstallStep.launchctl)
      if (normalized !== '') {
        this.addToMap(index.byBundleId, normalized, cask)
      }
    }
  }

  matchApp(appInfo: AppInfo, caskIndex?: CaskIndex): AppMatchResult {
    const index = caskIndex ?? this.caskIndex

    if (!index) {
      throw new Error('No cask index available. Call buildIndex() first.')
    }

    const allMatches: CaskMatch[] = []

    // Direct app bundle matching
    const bundleMatches = this.findAppBundleMatches(appInfo, index)
    allMatches.push(...bundleMatches)

    // Remove duplicates and sort by confidence
    const uniqueMatches = this.deduplicateMatches(allMatches)
    const filteredMatches = uniqueMatches
      .filter((match) => match.confidence >= this.config.minConfidence)
      .sort((matchA, matchB) => matchB.confidence - matchA.confidence)
      .slice(0, this.config.maxMatches)

    // Determine primary strategy used
    const strategy = this.determineStrategy(filteredMatches)

    return {
      appInfo,
      matches: filteredMatches,
      ...(filteredMatches[0] && { bestMatch: filteredMatches[0] }),
      strategy,
    }
  }

  matchApps(apps: AppInfo[], caskIndex?: CaskIndex): AppMatchResult[] {
    const index = caskIndex ?? this.caskIndex

    if (!index) {
      throw new Error('No cask index available. Call buildIndex() first.')
    }

    consola.debug(`Matching ${apps.length} apps against cask database...`)

    const results = apps.map((app) => this.matchApp(app, index))

    const matchSummary = results.map((result) => {
      const { appInfo, matches } = result
      const bestMatch = matches[0] || null

      const summaryRow: Record<string, string> = {
        appName: appInfo.originalName,
        matchFound: matches.length > 0 ? '✅' : '❌',
      }

      // Only add appStore property if the app is from Mac App Store
      if (appInfo.fromMacAppStore) {
        summaryRow['appStore'] = '✅'
      }

      // Only add match-related properties if there's a match
      if (bestMatch) {
        summaryRow['caskToken'] = bestMatch.cask.token
        summaryRow['confidence'] = bestMatch.confidence.toFixed(2)
        summaryRow['matchType'] = bestMatch.matchType
      }

      return summaryRow
    })

    const matchesFound = results.filter((result) => result.bestMatch).length
    const noMatches = results.filter(
      (result) => result.matches.length === 0,
    ).length

    if (consola.level >= CONSOLA_DEBUG_LEVEL) {
      consola.debug('Match Results Summary:')
      console.table(matchSummary)

      consola.debug('Match Statistics:')
      console.table({
        'Matches Found': matchesFound,
        'No Matches': noMatches,
        'Total Apps': apps.length,
      })
    }

    consola.debug(
      `Matching complete: ${matchesFound}/${apps.length} matches found`,
    )

    return results
  }

  private addToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const existing = map.get(key)

    if (existing) {
      if (!existing.includes(value)) {
        existing.push(value)
      }
    } else {
      map.set(key, [value])
    }
  }

  private deduplicateMatches(matches: CaskMatch[]): CaskMatch[] {
    const seen = new Set<string>()
    const unique: CaskMatch[] = []

    for (const match of matches) {
      if (!seen.has(match.cask.token)) {
        seen.add(match.cask.token)
        unique.push(match)
      }
    }

    return unique
  }

  private determineStrategy(matches: CaskMatch[]): MatchingStrategy {
    if (matches.length === 0) return 'hybrid'

    const [topMatch] = matches

    if (!topMatch) return 'hybrid'

    switch (topMatch.matchType) {
      case 'bundle-id': {
        return 'bundle-id'
      }
      case 'exact-app-bundle':
      case 'name-exact':
      case 'normalized-app-bundle':
      case 'token-match': {
        return 'app-bundle'
      }
      default: {
        return 'hybrid'
      }
    }
  }

  private findAppBundleMatches(
    appInfo: AppInfo,
    index: CaskIndex,
  ): CaskMatch[] {
    const matches: CaskMatch[] = []
    const originalAppNameNormalized = normalizeAppName(appInfo.originalName)
    const originalAppNameNormalizedNoHyphens =
      originalAppNameNormalized.replaceAll('-', '')

    const bundleIdMatches = this.findBundleIdMatches(appInfo, index)
    matches.push(...bundleIdMatches)

    this.findAppBundleExactMatches(originalAppNameNormalized, index, matches)

    this.findBrewNameMatches(appInfo, originalAppNameNormalized, index, matches)

    const nameMatches = this.findCaskNameMatches({
      appInfo,
      index,
      originalAppNameNormalized,
      originalAppNameNormalizedNoHyphens,
    })

    if (nameMatches.length === 1) {
      matches.push(...nameMatches)
    }

    return matches
  }

  private findCaskNameMatches(
    options: FindCaskNameMatchesOptions,
  ): CaskMatch[] {
    const {
      appInfo,
      index,
      originalAppNameNormalized,
      originalAppNameNormalizedNoHyphens,
    } = options

    const matches: CaskMatch[] = []

    for (const cask of index.byToken.values()) {
      const nameMatch = this.findCaskNameMatch(
        cask,
        appInfo.originalName,
        originalAppNameNormalized,
        originalAppNameNormalizedNoHyphens,
      )

      if (nameMatch) {
        matches.push(nameMatch)
      }
    }

    return matches
  }

  private findCaskNameMatch(
    cask: HomebrewCask,
    originalName: string,
    originalAppNameNormalized: string,
    originalAppNameNormalizedNoHyphens: string,
  ): CaskMatch | null {
    for (const nameInCask of cask.name) {
      const caskNameNormalized = normalizeAppName(nameInCask)

      if (caskNameNormalized === originalAppNameNormalized) {
        return {
          cask,
          confidence: NAME_EXACT_CONFIDENCE,
          matchDetails: {
            matchedValue: originalName,
            source: 'cask-name-normalized-exact',
          },
          matchType: 'name-exact',
        }
      }

      // Try matching without hyphens
      const caskNameNormalizedNoHyphens = caskNameNormalized.replaceAll('-', '')
      if (caskNameNormalizedNoHyphens === originalAppNameNormalizedNoHyphens) {
        return {
          cask,
          confidence: NAME_NO_HYPHENS_CONFIDENCE,
          matchDetails: {
            matchedValue: originalName,
            source: 'cask-name-normalized-no-hyphens',
          },
          matchType: 'name-exact',
        }
      }
    }

    return null
  }

  private findAppBundleExactMatches(
    originalAppNameNormalized: string,
    index: CaskIndex,
    matches: CaskMatch[],
  ): void {
    const exactBundleMatches =
      index.byAppBundle.get(originalAppNameNormalized) ?? []

    for (const cask of exactBundleMatches) {
      matches.push({
        cask,
        confidence: APP_BUNDLE_CONFIDENCE,
        matchDetails: {
          matchedValue: originalAppNameNormalized,
          source: 'app-bundle',
        },
        matchType: 'exact-app-bundle',
      })
    }
  }

  private findBundleIdMatches(appInfo: AppInfo, index: CaskIndex): CaskMatch[] {
    const bundleIdValue = appInfo.bundleId
    if (typeof bundleIdValue !== 'string') {
      return []
    }

    const bundleId = bundleIdValue.trim()
    if (bundleId === '') {
      return []
    }

    const normalizedBundleId = normalizeBundleIdentifier(bundleId)
    if (normalizedBundleId === '') {
      return []
    }

    const bundleIdMatches = index.byBundleId.get(normalizedBundleId) ?? []
    const matches: CaskMatch[] = []

    for (const cask of bundleIdMatches) {
      matches.push({
        cask,
        confidence: BUNDLE_ID_CONFIDENCE,
        matchDetails: {
          matchedValue: bundleId,
          source: 'bundle-id',
        },
        matchType: 'bundle-id',
      })
    }

    return matches
  }

  private findBrewNameMatches(
    appInfo: AppInfo,
    originalAppNameNormalized: string,
    index: CaskIndex,
    matches: CaskMatch[],
  ): void {
    if (appInfo.brewName === originalAppNameNormalized) {
      return
    }

    const brewNameNormalized = normalizeAppName(appInfo.brewName)

    // Try exact brew name match
    this.addBrewNameMatches({
      brewName: appInfo.brewName,
      casks: index.byAppBundle.get(brewNameNormalized) ?? [],
      confidence: BREW_NAME_CONFIDENCE,
      matches,
      source: 'brew-name',
    })

    // Try brew name without hyphens
    const brewNameNormalizedNoHyphens = brewNameNormalized.replaceAll('-', '')
    this.addBrewNameMatches({
      brewName: appInfo.brewName,
      casks: index.byAppBundle.get(brewNameNormalizedNoHyphens) ?? [],
      confidence: BREW_NAME_NO_HYPHENS_CONFIDENCE,
      matches,
      source: 'brew-name-no-hyphens',
    })
  }

  private addBrewNameMatches(options: AddBrewNameMatchesOptions): void {
    const { casks, brewName, source, confidence, matches } = options

    for (const cask of casks) {
      matches.push({
        cask,
        confidence,
        matchDetails: {
          matchedValue: brewName,
          source,
        },
        matchType: 'normalized-app-bundle',
      })
    }
  }
}
