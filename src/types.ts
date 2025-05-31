/**
 * TypeScript interfaces and types for convert-apps-to-homebrew
 */

/**
 * Type of Homebrew package
 */
export type BrewPackageType = 'cask' | 'formula' | 'unavailable';

/**
 * Status of an application in relation to Homebrew
 */
export type AppStatus = 'available' | 'already-installed' | 'unavailable' | 'ignored';

/**
 * Information about a macOS application
 */
export interface AppInfo {
  /** Original application name (e.g., "Google Chrome") */
  originalName: string;
  /** Normalized name for Homebrew (e.g., "google-chrome") */
  brewName: string;
  /** Full path to the .app file */
  appPath: string;
  /** Type of Homebrew package */
  brewType: BrewPackageType;
  /** Current status of the app */
  status: AppStatus;
  /** Whether the app is already installed via Homebrew */
  alreadyInstalled: boolean;
}

/**
 * Command line options parsed by Commander.js
 */
export interface CommandOptions {
  /** List of app names to ignore */
  ignore?: string[];
  /** Whether to run in dry-run mode (show what would happen without executing) */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Custom Applications directory path */
  applicationsDir?: string;
}

/**
 * Result of a Homebrew command execution
 */
export interface BrewCommandResult {
  /** Exit code of the command */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Whether the command was successful */
  success: boolean;
}

/**
 * Result of installing a single package
 */
export interface PackageInstallResult {
  /** Name of the package */
  packageName: string;
  /** Original app name */
  appName: string;
  /** Whether installation was successful */
  success: boolean;
  /** Error message if installation failed */
  error?: string;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Overall installation results
 */
export interface InstallationResult {
  /** Apps that were successfully installed */
  installed: PackageInstallResult[];
  /** Apps that failed to install */
  failed: PackageInstallResult[];
  /** Apps that were already installed via Homebrew */
  alreadyInstalled: AppInfo[];
  /** Apps that were ignored */
  ignored: AppInfo[];
  /** Apps that are unavailable in Homebrew */
  unavailable: AppInfo[];
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Configuration for the application scanner
 */
export interface ScannerConfig {
  /** Directory to scan for applications */
  applicationsDir: string;
  /** Apps to ignore during scanning */
  ignoredApps: string[];
  /** Whether to include verbose output */
  verbose: boolean;
}

/**
 * Configuration for the installer
 */
export interface InstallerConfig {
  /** Whether to run in dry-run mode */
  dryRun: boolean;
  /** Whether to include verbose output */
  verbose: boolean;
  /** Sudo password for deleting original apps */
  sudoPassword?: string;
}

/**
 * Choice item for Inquirer.js checkbox
 */
export interface AppChoice {
  /** Display name for the choice */
  name: string;
  /** Value to return when selected */
  value: AppInfo;
  /** Whether the choice is checked by default */
  checked: boolean;
  /** Whether the choice is disabled */
  disabled?: boolean | string;
}

/**
 * Error types that can occur during execution
 */
export const ErrorType = {
  HOMEBREW_NOT_INSTALLED: 'HOMEBREW_NOT_INSTALLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  COMMAND_FAILED: 'COMMAND_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

/**
 * Custom error class for application-specific errors
 */
export class ConvertAppsError extends Error {
  public readonly type: ErrorType;
  public readonly originalError?: Error;

  constructor(
    message: string,
    type: ErrorType,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ConvertAppsError';
    this.type = type;
    if (originalError !== undefined) {
      this.originalError = originalError;
    }
  }
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (message: string, current: number, total: number) => void;

/**
 * Logger interface for consistent logging
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
}

/**
 * Summary statistics for the operation
 */
export interface OperationSummary {
  /** Total number of apps found */
  totalApps: number;
  /** Number of apps available for installation */
  availableApps: number;
  /** Number of apps already installed via Homebrew */
  alreadyInstalled: number;
  /** Number of apps ignored */
  ignored: number;
  /** Number of apps unavailable in Homebrew */
  unavailable: number;
  /** Number of apps selected for installation */
  selected: number;
  /** Number of apps successfully installed */
  installed: number;
  /** Number of apps that failed to install */
  failed: number;
  /** Whether this was a dry run */
  dryRun: boolean;
}
