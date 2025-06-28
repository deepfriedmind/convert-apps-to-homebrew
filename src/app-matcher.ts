/**
 * App matching logic for finding Homebrew casks that correspond to local applications
 */

import { consola } from 'consola'

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
      // Index by token
      index.byToken.set(cask.token, cask)

      // Index by normalized names
      for (const name of cask.name) {
        const normalized = normalizeAppName(name)
        this.addToMap(index.byNormalizedName, normalized, cask)
      }

      // Index by app bundles and bundle IDs from artifacts
      for (const artifact of cask.artifacts) {
        // Index app bundles
        if (artifact.app) {
          for (const appName of artifact.app) {
            let appNameString: string

            // Handle both string and object formats
            if (typeof appName === 'string') {
              appNameString = appName
            }
            else if (typeof appName === 'object' && appName !== null && 'target' in appName) {
              // Extract the target path from object format
              appNameString = appName.target
            }
            else {
              // Log warning for unexpected formats but continue processing
              consola.debug(`Skipping unexpected app name format in cask ${cask.token}: ${typeof appName}`)
              continue
            }

            const normalized = normalizeAppName(appNameString.replace(/\.app$/, ''))
            this.addToMap(index.byAppBundle, normalized, cask)
          }
        }

        // Index bundle IDs from uninstall instructions
        if (artifact.uninstall) {
          for (const uninstallStep of artifact.uninstall) {
            if (uninstallStep.quit !== undefined && uninstallStep.quit !== '') {
              this.addToMap(index.byBundleId, uninstallStep.quit, cask)
            }

            if (uninstallStep.launchctl !== undefined && uninstallStep.launchctl !== '') {
              this.addToMap(index.byBundleId, uninstallStep.launchctl, cask)
            }
          }
        }
      }
    }

    this.caskIndex = index

    consola.debug('Search index built successfully')

    return index
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
      .filter(match => match.confidence >= this.config.minConfidence)
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

    const results = apps.map(app => this.matchApp(app, index))

    const matchSummary = results.map((result) => {
      const { appInfo, matches } = result
      const bestMatch = matches[0] || null

      return {
        /* eslint-disable perfectionist/sort-objects */
        appName: appInfo.originalName,
        matchFound: matches.length > 0 ? '✅' : '❌',
        caskToken: bestMatch ? bestMatch.cask.token : '-',
        confidence: bestMatch ? bestMatch.confidence.toFixed(2) : '-',
        matchType: bestMatch ? bestMatch.matchType : '-',
        /* eslint-enable perfectionist/sort-objects */
      }
    })

    const matchesFound = results.filter(result => result.bestMatch).length
    const noMatches = results.filter(result => result.matches.length === 0).length

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

    consola.debug(`Matching complete: ${matchesFound}/${apps.length} matches found`)

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
    }
    else {
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
    if (matches.length === 0)
      return 'hybrid'

    const [topMatch] = matches

    if (!topMatch)
      return 'hybrid'

    switch (topMatch.matchType) {
      case 'bundle-id-derived':
      case 'bundle-id-exact': {
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

  /**
   * Find matches by app bundle name
   */
  private findAppBundleMatches(appInfo: AppInfo, index: CaskIndex): CaskMatch[] {
    const matches: CaskMatch[] = []
    const originalAppNameNormalized = normalizeAppName(appInfo.originalName)
    // Also create a version of the normalized app name with hyphens removed, for cases like "QuitAll" vs "Quit All"
    const originalAppNameNormalizedNoHyphens = originalAppNameNormalized.replaceAll('-', '')

    // Strategy 1: Exact match on cask name array
    for (const cask of index.byToken.values()) {
      for (const nameInCask of cask.name) {
        const caskNameNormalized = normalizeAppName(nameInCask)

        if (caskNameNormalized === originalAppNameNormalized) {
          matches.push({
            cask,
            confidence: 1, // Highest confidence for exact normalized name match
            matchDetails: {
              matchedValue: appInfo.originalName, // Keep original name for reference
              source: 'cask-name-normalized-exact',
            },
            matchType: 'name-exact',
          })
          break // Found a match for this cask via its name array, move to next cask
        }

        // Try matching without hyphens
        const caskNameNormalizedNoHyphens = caskNameNormalized.replaceAll('-', '')

        if (caskNameNormalizedNoHyphens === originalAppNameNormalizedNoHyphens) {
          matches.push({
            cask,
            confidence: 0.98, // Slightly lower confidence than direct normalized match
            matchDetails: {
              matchedValue: appInfo.originalName,
              source: 'cask-name-normalized-no-hyphens',
            },
            matchType: 'name-exact',
          })
          break
        }
      }
    }

    // Strategy 2: Exact normalized match on app bundle (existing logic)
    const exactBundleMatches = index.byAppBundle.get(originalAppNameNormalized) ?? []
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

    // Try with the brew name as well
    if (appInfo.brewName !== originalAppNameNormalized) {
      const brewNameNormalized = normalizeAppName(appInfo.brewName) // Ensure brewName is also normalized
      const brewMatches = index.byAppBundle.get(brewNameNormalized) ?? []
      for (const cask of brewMatches) {
        matches.push({
          cask,
          confidence: 0.9,
          matchDetails: {
            matchedValue: appInfo.brewName,
            source: 'brew-name',
          },
          matchType: 'normalized-app-bundle',
        })
      }

      // Also try brew name without hyphens
      const brewNameNormalizedNoHyphens = brewNameNormalized.replaceAll('-', '')
      const brewMatchesNoHyphens = index.byAppBundle.get(brewNameNormalizedNoHyphens) ?? []
      for (const cask of brewMatchesNoHyphens) {
        matches.push({
          cask,
          confidence: 0.88,
          matchDetails: {
            matchedValue: appInfo.brewName,
            source: 'brew-name-no-hyphens',
          },
          matchType: 'normalized-app-bundle',
        })
      }
    }

    return matches
  }
}
