/**
 * App matching logic for finding Homebrew casks that correspond to local applications
 */

import { consola } from 'consola'
import { FILE_PATTERNS } from './constants.ts'
import type {
  AppInfo,
  AppMatchResult,
  CaskIndex,
  CaskMatch,
  HomebrewCask,
  MatchingConfig,
  MatchingStrategy,
} from './types.ts'
import { normalizeAppName } from './utils.ts'

/**
 * Default matching configuration
 */
const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  maxMatches: 5,
  minConfidence: 0.6,
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
    // Index by token
    index.byToken.set(cask.token, cask)

    // Index by normalized names
    this.indexCaskNames(cask, index)

    // Index by artifacts (app bundles and bundle IDs)
    this.indexCaskArtifacts(cask, index)
  }

  /**
   * Index cask names into the normalized name index
   */
  private indexCaskNames(cask: HomebrewCask, index: CaskIndex): void {
    for (const name of cask.name) {
      const normalized = normalizeAppName(name)
      this.addToMap(index.byNormalizedName, normalized, cask)
    }
  }

  /**
   * Index cask artifacts (app bundles and bundle IDs)
   */
  private indexCaskArtifacts(cask: HomebrewCask, index: CaskIndex): void {
    for (const artifact of cask.artifacts) {
      this.indexAppBundles(artifact, cask, index)
      this.indexBundleIds(artifact, cask, index)
    }
  }

  /**
   * Index app bundles from an artifact
   */
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

  /**
   * Index bundle IDs from uninstall instructions
   */
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

  /**
   * Index bundle IDs from a single uninstall step
   */
  private indexUninstallStep(
    uninstallStep: { quit?: string; launchctl?: string },
    cask: HomebrewCask,
    index: CaskIndex,
  ): void {
    if (uninstallStep.quit !== undefined && uninstallStep.quit !== '') {
      this.addToMap(index.byBundleId, uninstallStep.quit, cask)
    }

    if (
      uninstallStep.launchctl !== undefined &&
      uninstallStep.launchctl !== ''
    ) {
      this.addToMap(index.byBundleId, uninstallStep.launchctl, cask)
    }
  }

  /**
   * Match a single app against the cask database
   */
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

  /**
   * Match multiple apps in batch
   */
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

    if (consola.level >= 4) {
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

  /**
   * Helper method to add items to a map with arrays as values
   */
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

  /**
   * Remove duplicate matches (same cask token)
   */
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

  /**
   * Determine the primary matching strategy used
   */
  private determineStrategy(matches: CaskMatch[]): MatchingStrategy {
    if (matches.length === 0) return 'hybrid'

    const [topMatch] = matches

    if (!topMatch) return 'hybrid'

    switch (topMatch.matchType) {
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

  /**
   * Find matches by app bundle name
   */
  private findAppBundleMatches(
    appInfo: AppInfo,
    index: CaskIndex,
  ): CaskMatch[] {
    const matches: CaskMatch[] = []
    const originalAppNameNormalized = normalizeAppName(appInfo.originalName)
    const originalAppNameNormalizedNoHyphens =
      originalAppNameNormalized.replaceAll('-', '')

    // Strategy 1: Exact match on cask name array
    this.findCaskNameMatches(
      appInfo,
      index,
      originalAppNameNormalized,
      originalAppNameNormalizedNoHyphens,
      matches,
    )

    // Strategy 2: Exact normalized match on app bundle
    this.findAppBundleExactMatches(originalAppNameNormalized, index, matches)

    // Strategy 3: Try with brew name variations
    this.findBrewNameMatches(appInfo, originalAppNameNormalized, index, matches)

    return matches
  }

  /**
   * Find matches by exact cask name
   */
  private findCaskNameMatches(
    appInfo: AppInfo,
    index: CaskIndex,
    originalAppNameNormalized: string,
    originalAppNameNormalizedNoHyphens: string,
    matches: CaskMatch[],
  ): void {
    for (const cask of index.byToken.values()) {
      const nameMatch = this.findCaskNameMatch(
        cask,
        appInfo.originalName,
        originalAppNameNormalized,
        originalAppNameNormalizedNoHyphens,
      )

      if (nameMatch) {
        matches.push(nameMatch)
        break // Found a match for this cask, move to next cask
      }
    }
  }

  /**
   * Find a single cask name match
   */
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
          confidence: 1,
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
          confidence: 0.98,
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

  /**
   * Find exact app bundle matches
   */
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
        confidence: 0.95,
        matchDetails: {
          matchedValue: originalAppNameNormalized,
          source: 'app-bundle',
        },
        matchType: 'exact-app-bundle',
      })
    }
  }

  /**
   * Find matches using brew name variations
   */
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
    this.addBrewNameMatches(
      index.byAppBundle.get(brewNameNormalized) ?? [],
      appInfo.brewName,
      'brew-name',
      0.9,
      matches,
    )

    // Try brew name without hyphens
    const brewNameNormalizedNoHyphens = brewNameNormalized.replaceAll('-', '')
    this.addBrewNameMatches(
      index.byAppBundle.get(brewNameNormalizedNoHyphens) ?? [],
      appInfo.brewName,
      'brew-name-no-hyphens',
      0.88,
      matches,
    )
  }

  /**
   * Add brew name matches to the matches array
   */
  private addBrewNameMatches(
    casks: HomebrewCask[],
    brewName: string,
    source: string,
    confidence: number,
    matches: CaskMatch[],
  ): void {
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
