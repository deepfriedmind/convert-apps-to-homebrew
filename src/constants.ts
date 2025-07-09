/**
 * Constants used throughout the application
 */

/**
 * Default directory where macOS applications are installed
 */
export const DEFAULT_APPLICATIONS_DIR = '/Applications'

/**
 * Homebrew commands
 */
export const BREW_COMMANDS = {
  /** Check if a cask exists */
  INFO_CASK: (name: string): string => `brew info --cask "${name}"`,
  /** Install casks with force flag to overwrite existing applications */
  INSTALL_CASK: (names: string[]): string => `brew install --cask --force ${names.map(name => `"${name}"`).join(' ')}`,
  /** List installed casks (one per line) */
  LIST_CASKS: 'brew ls -1 --cask',
  /** Check if Homebrew is installed */
  VERSION: 'brew --version',
} as const

/**
 * File extensions and patterns
 */
export const FILE_PATTERNS = {
  /** macOS application bundle extension */
  APP_EXTENSION: '.app',
  /** Pattern to match .app directories */
  APP_PATTERN: /\.app$/i,
} as const

/**
 * Exit codes
 */
export const EXIT_CODES = {
  GENERAL_ERROR: 1,
  HOMEBREW_NOT_INSTALLED: 2,
  INVALID_INPUT: 4,
  NETWORK_ERROR: 5,
  PERMISSION_DENIED: 3,
  SUCCESS: 0,
} as const

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Timeout for brew commands in milliseconds */
  BREW_COMMAND_TIMEOUT: 30_000,
  /** Whether to run in dry-run mode by default */
  DRY_RUN: false,
  /** Maximum number of concurrent operations */
  MAX_CONCURRENT_OPERATIONS: 5,
  /** Whether to show verbose output by default */
  VERBOSE: false,
} as const

/**
 * Minimum required Node.js major version
 */
export const MIN_NODE_VERSION = 24

/**
 * Messages and text constants
 */
export const MESSAGES = {
  CHECKING_HOMEBREW: 'Checking Homebrew availability...',
  DELETING_APPS: 'Deleting original applications...',
  DRY_RUN_MODE: 'Running in dry-run mode. No actual changes will be made.',
  HOMEBREW_NOT_INSTALLED: 'Homebrew is not installed. Please install it before continuing.',
  INSTALLING_PACKAGES: 'Installing packages...',
  NO_APPS_FOUND: 'No applications found in the Applications directory.',
  NO_APPS_SELECTED: 'No applications selected for installation.',
  OPERATION_CANCELLED: 'Operation cancelled by user.',
  OPERATION_COMPLETE: 'Operation completed successfully.',
  PERMISSION_DENIED: 'Permission denied. You may need to run with appropriate permissions.',
  SCANNING_APPS: 'Scanning applications...',
} as const
