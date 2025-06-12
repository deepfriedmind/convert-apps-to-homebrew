/**
 * Homebrew cask API client with caching capabilities
 */

import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'

import type {
  CaskCacheEntry,
  HomebrewApiResult,
  HomebrewCask,
  Logger,
} from './types.ts'

import { ConvertAppsError, ErrorType } from './types.ts'
import { createLogger } from './utils.ts'

const gunzipAsync = promisify(gunzip)
const gzipAsync = promisify(gzip)

/**
 * Homebrew cask API endpoints
 */
const HOMEBREW_API = {
  /** Individual cask endpoint template */
  CASK: (token: string) => `https://formulae.brew.sh/api/cask/${token}.json`,
  /** All casks JSON endpoint */
  CASKS: 'https://formulae.brew.sh/api/cask.json',
} as const

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  /** Cache directory name */
  DIR_NAME: '.cache/convert-apps-to-homebrew',
  /** Cache file name */
  FILE_NAME: 'casks.json.gz',
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 30_000,
  /** Cache TTL in milliseconds (24 hours) */
  TTL: 24 * 60 * 60 * 1000,
  /** Cache version for invalidation */
  VERSION: '1.0.0',
} as const

/**
 * Homebrew API client with intelligent caching
 */
export class HomebrewApiClient {
  private readonly cachePath: string
  private readonly logger: Logger

  constructor(verbose = false) {
    this.logger = createLogger(verbose)
    this.cachePath = this.getCachePath()
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cachePath)
      this.logger.verbose('Cache cleared successfully')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new ConvertAppsError(
          'Failed to clear cache',
          ErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error : undefined,
        )
      }
    }
  }

  /**
   * Fetch all Homebrew casks with caching
   */
  async fetchAllCasks(forceRefresh = false): Promise<HomebrewApiResult<HomebrewCask[]>> {
    try {
      // Try to load from cache first unless force refresh
      if (!forceRefresh) {
        const cached = await this.loadFromCache()

        if (cached.success && cached.data) {
          this.logger.verbose('Using cached cask data')

          return { ...cached, fromCache: true }
        }
      }

      this.logger.verbose('Fetching cask data from Homebrew API...')

      // Fetch from API
      const result = await this.fetchFromApi()

      if (result.success && result.data) {
        // Save to cache
        await this.saveToCache(result.data)
        this.logger.verbose('Cask data cached successfully')
      }

      return result
    }
    catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error fetching casks',
          ...(error instanceof Error && { originalError: error }),
        },
        success: false,
      }
    }
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<{
    exists: boolean
    isValid?: boolean
    lastModified?: Date
    size?: number
  }> {
    try {
      const stats = await fs.stat(this.cachePath)
      const cacheEntry = await this.loadCacheEntry()

      return {
        exists: true,
        isValid: cacheEntry !== null,
        lastModified: stats.mtime,
        size: stats.size,
      }
    }
    catch {
      return { exists: false }
    }
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    const cacheDirectory = path.dirname(this.cachePath)
    await fs.mkdir(cacheDirectory, { recursive: true })
  }

  /**
   * Fetch cask data from Homebrew API
   */
  private async fetchFromApi(): Promise<HomebrewApiResult<HomebrewCask[]>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CACHE_CONFIG.REQUEST_TIMEOUT)

    try {
      const response = await fetch(HOMEBREW_API.CASKS, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'convert-apps-to-homebrew',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          error: {
            code: response.status.toString(),
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
          success: false,
        }
      }

      const casks = await response.json() as HomebrewCask[]

      this.logger.verbose(`Fetched ${casks.length} casks from Homebrew API`)

      return { data: casks, success: true }
    }
    catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          error: {
            code: 'TIMEOUT',
            message: 'Request timeout',
            ...(error instanceof Error && { originalError: error }),
          },
          success: false,
        }
      }

      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
          ...(error instanceof Error && { originalError: error }),
        },
        success: false,
      }
    }
  }

  /**
   * Get the cache file path
   */
  private getCachePath(): string {
    const homeDirectory = os.homedir()
    const cacheDirectory = path.join(homeDirectory, CACHE_CONFIG.DIR_NAME)

    return path.join(cacheDirectory, CACHE_CONFIG.FILE_NAME)
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(cacheEntry: CaskCacheEntry): boolean {
    // Check version
    if (cacheEntry.version !== CACHE_CONFIG.VERSION) {
      return false
    }

    // Check TTL
    const now = Date.now()
    const age = now - cacheEntry.timestamp

    if (age > CACHE_CONFIG.TTL) {
      return false
    }

    // Check data structure
    if (!Array.isArray(cacheEntry.data) || cacheEntry.data.length === 0) {
      return false
    }

    return true
  }

  /**
   * Load and validate cache entry
   */
  private async loadCacheEntry(): Promise<CaskCacheEntry | null> {
    try {
      const compressedData = await fs.readFile(this.cachePath)
      const jsonData = await gunzipAsync(compressedData)
      const cacheEntry = JSON.parse(jsonData.toString()) as CaskCacheEntry

      // Validate cache entry
      if (!this.isCacheValid(cacheEntry)) {
        return null
      }

      return cacheEntry
    }
    catch {
      return null
    }
  }

  /**
   * Load data from cache if valid
   */
  private async loadFromCache(): Promise<HomebrewApiResult<HomebrewCask[]>> {
    try {
      const cacheEntry = await this.loadCacheEntry()

      if (!cacheEntry) {
        return { error: { message: 'No valid cache found' }, success: false }
      }

      this.logger.verbose(`Loaded ${cacheEntry.data.length} casks from cache`)

      return { data: cacheEntry.data, success: true }
    }
    catch (error) {
      this.logger.verbose('Failed to load cache, will fetch from API')

      return {
        error: {
          message: 'Cache load failed',
          ...(error instanceof Error && { originalError: error }),
        },
        success: false,
      }
    }
  }

  /**
   * Save cask data to cache
   */
  private async saveToCache(casks: HomebrewCask[]): Promise<void> {
    try {
      await this.ensureCacheDir()

      const cacheEntry: CaskCacheEntry = {
        data: casks,
        timestamp: Date.now(),
        version: CACHE_CONFIG.VERSION,
      }

      const jsonData = JSON.stringify(cacheEntry)
      const compressedData = await gzipAsync(Buffer.from(jsonData))

      await fs.writeFile(this.cachePath, compressedData)

      this.logger.verbose(`Cached ${casks.length} casks (${Math.round(compressedData.length / 1024)}KB compressed)`)
    }
    catch (error) {
      // Don't throw on cache save failures, just log
      this.logger.warn(`Failed to save cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Convenience function to create an API client and fetch casks
 */
export async function fetchHomebrewCasks(
  verbose = false,
  forceRefresh = false,
): Promise<HomebrewApiResult<HomebrewCask[]>> {
  const client = new HomebrewApiClient(verbose)

  return client.fetchAllCasks(forceRefresh)
}
