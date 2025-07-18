/**
 * Homebrew cask API client with caching capabilities
 */

import { spinner } from '@clack/prompts'
import { consola } from 'consola'
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
} from './types.ts'

import { ConvertAppsError, ErrorType } from './types.ts'

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
 * @internal
 */
class HomebrewApiClient {
  private readonly cachePath: string

  constructor() {
    this.cachePath = this.getCachePath()
  }

  /**
   * Clear the cache
   */
  async clearCache() {
    try {
      await fs.unlink(this.cachePath)

      consola.debug('Cache cleared successfully')
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
  async fetchAllCasks(forceRefresh = false, showSpinner = true): Promise<HomebrewApiResult<HomebrewCask[]>> {
    try {
      // Try to load from cache first unless force refresh
      if (!forceRefresh) {
        const cached = await this.loadFromCache()

        if (cached.success && cached.data) {
          consola.debug('Using cached cask data')

          return { ...cached, fromCache: true }
        }

        consola.debug('Cache not found or invalid, fetching from API...')
      }

      // Only show spinner when actually fetching from API
      const spinnerIndicator = showSpinner ? spinner() : null

      if (spinnerIndicator) {
        if (forceRefresh) {
          spinnerIndicator.start('Refreshing Homebrew cask database from API...')
        }
        else {
          spinnerIndicator.start('Fetching Homebrew cask database from API...')
        }
      }

      consola.debug('Fetching cask data from Homebrew API...')

      // Fetch from API
      const result = await this.fetchFromApi(spinnerIndicator)

      if (result.success && result.data) {
        // Save to cache
        if (spinnerIndicator) {
          spinnerIndicator.message('Caching cask database...')
        }

        await this.saveToCache(result.data)

        consola.debug('Cask data cached successfully')

        if (spinnerIndicator) {
          spinnerIndicator.stop(`Successfully loaded ${result.data.length} casks from Homebrew API`)
        }
      }
      else if (spinnerIndicator) {
        spinnerIndicator.stop('Failed to fetch cask database from API', 1)
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
  private async fetchFromApi(spinnerIndicator?: null | ReturnType<typeof spinner>): Promise<HomebrewApiResult<HomebrewCask[]>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()

      if (spinnerIndicator) {
        spinnerIndicator.stop(`Request timed out after ${CACHE_CONFIG.REQUEST_TIMEOUT / 1000} seconds`, 1)
      }
    }, CACHE_CONFIG.REQUEST_TIMEOUT)

    try {
      if (spinnerIndicator) {
        spinnerIndicator.message('Connecting to Homebrew API...')
      }

      const response = await fetch(HOMEBREW_API.CASKS, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'convert-apps-to-homebrew',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (spinnerIndicator) {
          spinnerIndicator.stop(`HTTP ${response.status}: ${response.statusText}`, 1)
        }

        return {
          error: {
            code: response.status.toString(),
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
          success: false,
        }
      }

      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength !== null && contentLength !== '' ? Number.parseInt(contentLength, 10) : 0
      const sizeText = totalBytes > 0 ? ` (${Math.round(totalBytes / 1000)} kB)` : ''

      if (spinnerIndicator) {
        spinnerIndicator.message(`Downloading cask database${sizeText}...`)
      }

      // The actual download happens here, awaiting the full response
      const casks = await response.json() as HomebrewCask[]

      consola.debug(`Fetched ${casks.length} casks from Homebrew API`)

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

      consola.debug(`Loaded ${cacheEntry.data.length} casks from cache`)

      return { data: cacheEntry.data, success: true }
    }
    catch (error) {
      consola.debug('Failed to load cache, will fetch from API')

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

      consola.debug(`Cached ${casks.length} casks (${Math.round(compressedData.length / 1024)}KB compressed)`)
    }
    catch (error) {
      // Don't throw on cache save failures, just log
      consola.warn(`Failed to save cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Clear the Homebrew cask cache
 */
export async function clearHomebrewCache(): Promise<void> {
  const client = new HomebrewApiClient()
  await client.clearCache()
}

/**
 * Fetch all Homebrew casks with caching
 */
export async function fetchHomebrewCasks(
  forceRefresh = false,
  showSpinner = true,
): Promise<HomebrewApiResult<HomebrewCask[]>> {
  const client = new HomebrewApiClient()

  return client.fetchAllCasks(forceRefresh, showSpinner)
}
