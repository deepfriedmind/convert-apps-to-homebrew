/**
 * Homebrew cask API client with caching capabilities
 */

import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'
import { spinner } from '@clack/prompts'
import { consola } from 'consola'
import packageJson from '../package.json' with { type: 'json' }
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
 * Time conversion constants
 */
const MS_TO_SECONDS = 1000
const MS_TO_HOURS = 60 * MS_TO_SECONDS
const BYTES_TO_KB = 1024
const BYTES_TO_KB_ALT = 100

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  /** Cache directory name */
  DIR_NAME: `.cache/${packageJson.name}`,
  /** Cache file name */
  FILE_NAME: 'casks.json.gz',
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 30_000,
  /** Cache TTL in milliseconds (24 hours) */
  TTL: 24 * MS_TO_HOURS,
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
    } catch (error) {
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
  async fetchAllCasks(
    forceRefresh = false,
    showSpinner = true,
  ): Promise<HomebrewApiResult<HomebrewCask[]>> {
    try {
      // Try to load from cache first unless force refresh
      if (!forceRefresh) {
        const cached = await this.tryLoadFromCache()
        if (cached) {
          return cached
        }
      }

      // Fetch from API with spinner
      return await this.fetchWithSpinner(forceRefresh, showSpinner)
    } catch (error) {
      return this.createErrorResult(error)
    }
  }

  /**
   * Try to load data from cache
   */
  private async tryLoadFromCache(): Promise<HomebrewApiResult<
    HomebrewCask[]
  > | null> {
    const cached = await this.loadFromCache()

    if (cached.success && cached.data) {
      consola.debug('Using cached cask data')
      return { ...cached, fromCache: true }
    }

    consola.debug('Cache not found or invalid, fetching from API...')
    return null
  }

  /**
   * Fetch from API with spinner management
   */
  private async fetchWithSpinner(
    forceRefresh: boolean,
    showSpinner: boolean,
  ): Promise<HomebrewApiResult<HomebrewCask[]>> {
    const spinnerIndicator = this.createSpinner(forceRefresh, showSpinner)

    consola.debug('Fetching cask data from Homebrew API...')

    const result = await this.fetchFromApi(spinnerIndicator)

    if (result.success && result.data) {
      await this.handleSuccessfulFetch(result.data, spinnerIndicator)
    } else {
      this.handleFailedFetch(spinnerIndicator)
    }

    return result
  }

  /**
   * Create and start spinner if needed
   */
  private createSpinner(forceRefresh: boolean, showSpinner: boolean) {
    if (!showSpinner) {
      return null
    }

    const spinnerIndicator = spinner()
    const message = forceRefresh
      ? 'Refreshing Homebrew cask database from API...'
      : 'Fetching Homebrew cask database from API...'

    spinnerIndicator.start(message)
    return spinnerIndicator
  }

  /**
   * Handle successful API fetch
   */
  private async handleSuccessfulFetch(
    data: HomebrewCask[],
    spinnerIndicator: ReturnType<typeof spinner> | null,
  ): Promise<void> {
    if (spinnerIndicator) {
      spinnerIndicator.message('Caching cask database...')
    }

    await this.saveToCache(data)
    consola.debug('Cask data cached successfully')

    if (spinnerIndicator) {
      spinnerIndicator.stop(`Loaded ${data.length} casks from Homebrew API`)
    }
  }

  /**
   * Handle failed API fetch
   */
  private handleFailedFetch(
    spinnerIndicator: ReturnType<typeof spinner> | null,
  ): void {
    if (spinnerIndicator) {
      spinnerIndicator.stop('Failed to fetch cask database from API', 1)
    }
  }

  /**
   * Create error result object
   */
  private createErrorResult(error: unknown): HomebrewApiResult<HomebrewCask[]> {
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error fetching casks',
        ...(error instanceof Error && { originalError: error }),
      },
      success: false,
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
    } catch {
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
  private async fetchFromApi(
    spinnerIndicator?: null | ReturnType<typeof spinner>,
  ): Promise<HomebrewApiResult<HomebrewCask[]>> {
    const { controller, timeoutId } = this.setupRequestTimeout(spinnerIndicator)

    try {
      const response = await this.makeApiRequest(controller, spinnerIndicator)
      clearTimeout(timeoutId)

      if (!response.ok) {
        return this.handleHttpError(response, spinnerIndicator)
      }

      return await this.processSuccessfulResponse(response, spinnerIndicator)
    } catch (error) {
      clearTimeout(timeoutId)
      return this.handleRequestError(error)
    }
  }

  /**
   * Setup request timeout and abort controller
   */
  private setupRequestTimeout(
    spinnerIndicator?: null | ReturnType<typeof spinner>,
  ) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()

      if (spinnerIndicator) {
        spinnerIndicator.stop(
          `Request timed out after ${CACHE_CONFIG.REQUEST_TIMEOUT / MS_TO_SECONDS} seconds`,
          1,
        )
      }
    }, CACHE_CONFIG.REQUEST_TIMEOUT)

    return { controller, timeoutId }
  }

  /**
   * Make the actual API request
   */
  private async makeApiRequest(
    controller: AbortController,
    spinnerIndicator?: null | ReturnType<typeof spinner>,
  ): Promise<Response> {
    if (spinnerIndicator) {
      spinnerIndicator.message('Connecting to Homebrew API...')
    }

    return await fetch(HOMEBREW_API.CASKS, {
      headers: {
        Accept: 'application/json',
        'User-Agent': packageJson.name,
      },
      signal: controller.signal,
    })
  }

  /**
   * Handle HTTP error responses
   */
  private handleHttpError(
    response: Response,
    spinnerIndicator?: null | ReturnType<typeof spinner>,
  ): HomebrewApiResult<HomebrewCask[]> {
    if (spinnerIndicator) {
      spinnerIndicator.stop(
        `HTTP ${response.status}: ${response.statusText}`,
        1,
      )
    }

    return {
      error: {
        code: response.status.toString(),
        message: `HTTP ${response.status}: ${response.statusText}`,
      },
      success: false,
    }
  }

  /**
   * Process successful API response
   */
  private async processSuccessfulResponse(
    response: Response,
    spinnerIndicator?: null | ReturnType<typeof spinner>,
  ): Promise<HomebrewApiResult<HomebrewCask[]>> {
    const sizeText = this.getResponseSizeText(response)

    if (spinnerIndicator) {
      spinnerIndicator.message(`Downloading cask database${sizeText}...`)
    }

    const casks = (await response.json()) as HomebrewCask[]
    consola.debug(`Fetched ${casks.length} casks from Homebrew API`)

    return { data: casks, success: true }
  }

  /**
   * Get response size text for display
   */
  private getResponseSizeText(response: Response): string {
    const contentLength = response.headers.get('content-length')
    const totalBytes =
      contentLength !== null && contentLength !== ''
        ? Number.parseInt(contentLength, 10)
        : 0

    return totalBytes > 0
      ? ` (${Math.round(totalBytes / BYTES_TO_KB_ALT)} kB)`
      : ''
  }

  /**
   * Handle request errors (timeout, network, etc.)
   */
  private handleRequestError(
    error: unknown,
  ): HomebrewApiResult<HomebrewCask[]> {
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
    } catch {
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
    } catch (error) {
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

      consola.debug(
        `Cached ${casks.length} casks (${Math.round(compressedData.length / BYTES_TO_KB)}KB compressed)`,
      )
    } catch (error) {
      // Don't throw on cache save failures, just log
      consola.warn(
        `Failed to save cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
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

  return await client.fetchAllCasks(forceRefresh, showSpinner)
}
