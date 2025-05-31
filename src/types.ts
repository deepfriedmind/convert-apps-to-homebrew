/**
 * TypeScript interfaces and types for convert-apps-to-homebrew
 */

/**
 * Choice item for Inquirer.js checkbox
 */
export interface AppChoice {
  /** Whether the choice is checked by default */
  checked: boolean
  /** Whether the choice is disabled */
  disabled?: boolean | string
  /** Display name for the choice */
  name: string
  /** Value to return when selected */
  value: AppInfo
}

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
  /** Original application name (e.g., "Google Chrome") */
  originalName: string
  /** Current status of the app */
  status: AppStatus
}

/**
 * Status of an application in relation to Homebrew
 */
export type AppStatus = 'already-installed' | 'available' | 'ignored' | 'unavailable'

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
 * Type of Homebrew package
 */
export type BrewPackageType = 'cask' | 'formula' | 'unavailable'

/**
 * Command line options parsed by Commander.js
 */
export interface CommandOptions {
  /** Custom Applications directory path */
  applicationsDir?: string
  /** Whether to run in dry-run mode (show what would happen without executing) */
  dryRun?: boolean
  /** List of app names to ignore */
  ignore?: string[]
  /** Verbose output */
  verbose?: boolean
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
  /** Sudo password for deleting original apps */
  sudoPassword?: string
  /** Whether to include verbose output */
  verbose: boolean
}

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
  /** Apps to ignore during scanning */
  ignoredApps: string[]
  /** Whether to include verbose output */
  verbose: boolean
}

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

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

/**
 * Logger interface for consistent logging
 */
export interface Logger {
  debug: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  verbose: (message: string) => void
  warn: (message: string) => void
}

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

/**
 * Custom error class for application-specific errors
 */
export class ConvertAppsError extends Error {
  public readonly originalError?: Error
  public readonly type: ErrorType

  constructor(
    message: string,
    type: ErrorType,
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
