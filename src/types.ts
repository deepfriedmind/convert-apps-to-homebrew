/**
 * TypeScript interfaces and types for convert-apps-to-homebrew
 */

/**
 * Information about a macOS application
 */
export interface AppInfo {
  /** Whether the app is already installed via Homebrew */
  alreadyInstalled: boolean
  /** Full path to the .app file */
  appPath: string
  /** Normalized name for Homebrew (e.g., "google-chrome") */
  brewName: string
  /** Type of Homebrew package */
  brewType: BrewPackageType
  /** Whether this app was installed via Mac App Store */
  fromMacAppStore?: boolean
  /** Original application name (e.g., "Google Chrome") */
  originalName: string
  /** Current status of the app */
  status: AppStatus
}

/**
 * Result of matching a local app to Homebrew casks
 */
export interface AppMatchResult {
  /** The local app being matched */
  appInfo: AppInfo
  /** Best match (highest confidence) */
  bestMatch?: CaskMatch
  /** Matched casks (sorted by confidence) */
  matches: CaskMatch[]
  /** Overall matching strategy used */
  strategy: MatchingStrategy
}

/**
 * Result of a Homebrew command execution
 */
export interface BrewCommandResult {
  /** Exit code of the command */
  exitCode: number
  /** Standard error */
  stderr: string
  /** Standard output */
  stdout: string
  /** Whether the command was successful */
  success: boolean
}

/**
 * Cache entry for Homebrew cask data
 */
export interface CaskCacheEntry {
  /** Cached cask data */
  data: HomebrewCask[]
  /** HTTP ETag for conditional requests */
  etag?: string
  /** When the cache was created */
  timestamp: number
  /** Cache format version */
  version: string
}

/**
 * Indexed lookup structures for efficient matching
 */
export interface CaskIndex {
  /** Map from app bundle name to casks */
  byAppBundle: Map<string, HomebrewCask[]>
  /** Map from bundle ID to casks */
  byBundleId: Map<string, HomebrewCask[]>
  /** Map from normalized name to casks */
  byNormalizedName: Map<string, HomebrewCask[]>
  /** Map from token to cask */
  byToken: Map<string, HomebrewCask>
}

/**
 * Individual cask match with confidence score
 */
export interface CaskMatch {
  /** The matched cask */
  cask: HomebrewCask
  /** Confidence score (0-1) */
  confidence: number
  /** Specific matching details */
  matchDetails: {
    /** What was matched against */
    matchedValue: string
    /** Original source of the match */
    source: string
  }
  /** How this match was found */
  matchType: MatchType
}

/**
 * Command line options parsed by Commander.js
 */
export interface CommandOptions {
  /** Custom Applications directory path */
  applicationsDir: string
  /** Whether to run in dry-run mode (show what would happen without executing) */
  dryRun: boolean
  /** Whether to use individual brew commands instead of batch API */
  fallbackToCli?: boolean
  /** Whether to force refresh of cask database cache */
  forceRefreshCache?: boolean
  /** List of app names to ignore */
  ignore: string[]
  /** Whether to ignore Mac App Store apps */
  ignoreAppStore?: boolean
  /** Confidence threshold for matching (0.0-1.0) */
  matchingThreshold?: number
  /** Verbose output */
  verbose: boolean
}

/**
 * Result of Homebrew API operations
 */
export interface HomebrewApiResult<T> {
  /** Result data if successful */
  data?: T
  /** Error information if failed */
  error?: {
    code?: string
    message: string
    originalError?: Error
  }
  /** Whether data came from cache */
  fromCache?: boolean
  /** Whether the operation was successful */
  success: boolean
}

/**
 * Complete Homebrew cask data structure from API
 */
export interface HomebrewCask {
  /** Installation artifacts and configuration */
  artifacts: HomebrewCaskArtifact[]
  /** Auto-update configuration */
  auto_updates?: boolean
  /** Additional cask metadata */
  caveats?: string
  /** Conflicts with other software */
  conflicts_with?: {
    cask?: string[]
    formula?: string[]
  }
  /** Dependencies */
  depends_on?: {
    cask?: string[]
    formula?: string[]
    macos?: Record<string, string[]>
  }
  /** Brief description */
  desc: string
  /** Full token with tap prefix */
  full_token: string
  /** Homepage URL */
  homepage: string
  /** Display names for the application */
  name: string[]
  /** Previous token names */
  old_tokens: string[]
  /** Homebrew tap that provides this cask */
  tap: string
  /** Unique cask identifier */
  token: string
  /** Version information */
  version?: string
}

/**
 * Overall installation results
 */
export interface InstallationResult {
  /** Apps that were already installed via Homebrew */
  alreadyInstalled: AppInfo[]
  /** Whether this was a dry run */
  dryRun: boolean
  /** Apps that failed to install */
  failed: PackageInstallResult[]
  /** Apps that were ignored */
  ignored: AppInfo[]
  /** Apps that were successfully installed */
  installed: PackageInstallResult[]
  /** Apps that are unavailable in Homebrew */
  unavailable: AppInfo[]
}

/**
 * Configuration for the installer
 */
export interface InstallerConfig {
  /** Whether to run in dry-run mode */
  dryRun: boolean
  /** Whether to include verbose output */
  verbose: boolean
}

/**
 * Information about a Mac App Store app from mas CLI
 */
export interface MasAppInfo {
  /** App Store app ID */
  appId: string
  /** App name as reported by mas */
  name: string
  /** App version */
  version: string
}

/**
 * Result of Mac App Store integration
 */
export interface MasIntegrationResult {
  /** List of Mac App Store apps */
  apps: MasAppInfo[]
  /** Whether mas CLI tool is installed */
  masInstalled: boolean
  /** Whether the operation was successful */
  success: boolean
}

/**
 * Configuration for app matching
 */
export interface MatchingConfig {
  /** Maximum number of matches to return per app */
  maxMatches: number
  /** Minimum confidence threshold for matches */
  minConfidence: number
}

/**
 * Types of matching strategies
 */
export type MatchingStrategy = 'app-bundle' | 'bundle-id' | 'hybrid'

/**
 * Result of installing a single package
 */
export interface PackageInstallResult {
  /** Original app name */
  appName: string
  /** Whether this was a dry run */
  dryRun: boolean
  /** Error message if installation failed */
  error?: string
  /** Name of the package */
  packageName: string
  /** Whether installation was successful */
  success: boolean
}

/**
 * Configuration for the application scanner
 */
export interface ScannerConfig {
  /** Directory to scan for applications */
  applicationsDir: string
  /** Whether to use individual brew commands instead of batch API */
  fallbackToCli?: boolean
  /** Whether to force refresh of cask database cache */
  forceRefreshCache?: boolean
  /** Whether to ignore Mac App Store apps */
  ignoreAppStore?: boolean
  /** Apps to ignore during scanning */
  ignoredApps: string[]
  /** Confidence threshold for matching (0.0-1.0) */
  matchingThreshold?: number
  /** Whether to include verbose output */
  verbose: boolean
}

/**
 * Status of an application in relation to Homebrew
 */
type AppStatus = 'already-installed' | 'available' | 'ignored' | 'unavailable'

/**
 * Type of Homebrew package
 */
type BrewPackageType = 'cask' | 'unavailable'

/**
 * Homebrew cask artifact types from the API
 */
interface HomebrewCaskArtifact {
  /** App bundles installed by this cask */
  app?: (string | { target: string })[]
  /** Binary executables */
  binary?: (string | { target: string })[]
  /** Installer package */
  pkg?: string[]
  /** Post-install actions */
  postflight?: unknown
  /** Pre-install actions */
  preflight?: unknown
  /** Suite of applications */
  suite?: string[]
  /** Uninstall configuration */
  uninstall?: Array<{
    /** Additional delete items */
    delete?: string[]
    /** Launch control service to stop */
    launchctl?: string
    /** Bundle ID to quit during uninstall */
    quit?: string
  }>
  /** Files and directories to remove completely */
  zap?: Array<{
    delete?: string[]
    trash?: string[]
  }>
}

/**
 * Specific match types within strategies
 */
type MatchType
  = | 'exact-app-bundle'
    | 'name-exact'
    | 'normalized-app-bundle'
    | 'token-match'

/**
 * Error types that can occur during execution
 */
export const ErrorType = {
  COMMAND_FAILED: 'COMMAND_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  HOMEBREW_NOT_INSTALLED: 'HOMEBREW_NOT_INSTALLED',
  INVALID_INPUT: 'INVALID_INPUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

/**
 * Summary statistics for the operation
 */
export interface OperationSummary {
  /** Number of apps already installed via Homebrew */
  alreadyInstalled: number
  /** Number of apps available for installation */
  availableApps: number
  /** Whether this was a dry run */
  dryRun: boolean
  /** Number of apps that failed to install */
  failed: number
  /** Number of apps ignored */
  ignored: number
  /** Number of apps successfully installed */
  installed: number
  /** Number of apps selected for installation */
  selected: number
  /** Total number of apps found */
  totalApps: number
  /** Number of apps unavailable in Homebrew */
  unavailable: number
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (message: string, current: number, total: number) => void

type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType]

/**
 * Custom error class for application-specific errors
 */
export class ConvertAppsError extends Error {
  public readonly originalError?: Error
  public readonly type: ErrorTypeValue

  constructor(
    message: string,
    type: ErrorTypeValue,
    originalError?: Error,
  ) {
    super(message)
    this.name = 'ConvertAppsError'
    this.type = type

    if (originalError !== undefined) {
      this.originalError = originalError
    }
  }
}
