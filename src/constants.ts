/**
 * Constants used throughout the application
 */

/**
 * Default directory where macOS applications are installed
 */
export const DEFAULT_APPLICATIONS_DIR = '/Applications';

/**
 * Homebrew commands
 */
export const BREW_COMMANDS = {
  /** List installed casks (one per line) */
  LIST_CASKS: 'brew ls -1 --cask',
  /** List installed formulas (leaves only) */
  LIST_FORMULAS: 'brew leaves',
  /** Check if a cask exists */
  INFO_CASK: (name: string): string => `brew info --cask "${name}"`,
  /** Check if a formula exists */
  INFO_FORMULA: (name: string): string => `brew info "${name}"`,
  /** Install casks */
  INSTALL_CASK: (names: string[]): string => `brew install --cask ${names.map(n => `"${n}"`).join(' ')}`,
  /** Install formulas */
  INSTALL_FORMULA: (names: string[]): string => `brew install ${names.map(n => `"${n}"`).join(' ')}`,
  /** Check if Homebrew is installed */
  VERSION: 'brew --version'
} as const;

/**
 * File extensions and patterns
 */
export const FILE_PATTERNS = {
  /** macOS application bundle extension */
  APP_EXTENSION: '.app',
  /** Pattern to match .app directories */
  APP_PATTERN: /\.app$/i
} as const;

/**
 * Exit codes
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  HOMEBREW_NOT_INSTALLED: 2,
  PERMISSION_DENIED: 3,
  INVALID_INPUT: 4,
  NETWORK_ERROR: 5
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Maximum number of concurrent operations */
  MAX_CONCURRENT_OPERATIONS: 5,
  /** Timeout for brew commands in milliseconds */
  BREW_COMMAND_TIMEOUT: 30000,
  /** Whether to show verbose output by default */
  VERBOSE: false,
  /** Whether to run in dry-run mode by default */
  DRY_RUN: false
} as const;

/**
 * Color codes for console output
 */
export const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m'
} as const;

/**
 * Messages and text constants
 */
export const MESSAGES = {
  HOMEBREW_NOT_INSTALLED: 'Homebrew is not installed. Please install it before continuing.',
  PERMISSION_DENIED: 'Permission denied. You may need to run with appropriate permissions.',
  NO_APPS_FOUND: 'No applications found in the Applications directory.',
  NO_APPS_SELECTED: 'No applications selected for installation.',
  DRY_RUN_MODE: 'Running in dry-run mode. No actual changes will be made.',
  OPERATION_CANCELLED: 'Operation cancelled by user.',
  SCANNING_APPS: 'Scanning applications...',
  CHECKING_HOMEBREW: 'Checking Homebrew availability...',
  INSTALLING_PACKAGES: 'Installing packages...',
  DELETING_APPS: 'Deleting original applications...',
  OPERATION_COMPLETE: 'Operation completed successfully.'
} as const;

/**
 * Regular expressions for validation
 */
export const REGEX_PATTERNS = {
  /** Valid Homebrew package name */
  BREW_PACKAGE_NAME: /^[a-z0-9][a-z0-9\-_.]*$/i,
  /** macOS application name */
  APP_NAME: /^[^\/\0]+$/,
  /** Version string */
  VERSION: /^\d+\.\d+\.\d+/
} as const;
