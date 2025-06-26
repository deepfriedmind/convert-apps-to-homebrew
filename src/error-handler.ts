/**
 * Enhanced error handling and progress tracking
 */

import { consola } from 'consola'

import type { ProgressCallback } from './types.ts'

import { EXIT_CODES, MESSAGES } from './constants.ts'
import { ConvertAppsError, ErrorType } from './types.ts'

/**
 * Enhanced error handler with context and recovery suggestions
 */
export class ErrorHandler {
  private verbose: boolean

  constructor(verbose = false) {
    this.verbose = verbose
  }

  /**
   * Handle different types of errors with specific recovery suggestions
   */
  handleError(error: Error, context?: string): never {
    const contextMessage = context === undefined ? '' : ` (${context})`

    if (error instanceof ConvertAppsError) {
      this.handleConvertAppsError(error, contextMessage)
    }
    else {
      this.handleGenericError(error, contextMessage)
    }
  }

  private handleConvertAppsError(error: ConvertAppsError, context: string): never {
    /* eslint-disable no-fallthrough */
    switch (error.type) {
      case ErrorType.COMMAND_FAILED: {
        consola.error(`Command execution failed${context}: ${error.message}`)
        this.showCommandFailureHelp()
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.FILE_NOT_FOUND: {
        consola.error(`File not found${context}: ${error.message}`)
        this.showFileNotFoundHelp()
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      case ErrorType.HOMEBREW_NOT_INSTALLED: {
        consola.error(`${MESSAGES.HOMEBREW_NOT_INSTALLED}${context}`)
        this.showHomebrewInstallationHelp()
        process.exit(EXIT_CODES.HOMEBREW_NOT_INSTALLED)
      }

      case ErrorType.INVALID_INPUT: {
        consola.error(`Invalid input${context}: ${error.message}`)
        this.showInputValidationHelp()
        process.exit(EXIT_CODES.INVALID_INPUT)
      }

      case ErrorType.NETWORK_ERROR: {
        consola.error(`Network error occurred${context}. Please check your internet connection.`)
        this.showNetworkHelp()
        process.exit(EXIT_CODES.NETWORK_ERROR)
      }

      case ErrorType.PERMISSION_DENIED: {
        consola.error(`${MESSAGES.PERMISSION_DENIED}${context}`)
        this.showPermissionHelp()
        process.exit(EXIT_CODES.PERMISSION_DENIED)
      }

      case ErrorType.UNKNOWN_ERROR: {
        consola.error(`Unknown error${context}: ${error.message}`)

        if (error.originalError !== undefined && this.verbose) {
          consola.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
      }

      default: {
        consola.error(`Application error${context}: ${error.message}`)

        if (error.originalError !== undefined && this.verbose) {
          consola.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
      }
    }
    /* eslint-enable no-fallthrough */
  }

  private handleGenericError(error: Error, context: string): never {
    consola.error(`Unexpected error${context}: ${error.message}`)

    // Check for common error patterns
    if (error.message.includes('ENOENT')) {
      this.showFileNotFoundHelp()
    }
    else if (error.message.includes('EACCES')) {
      this.showPermissionHelp()
    }
    else if (error.message.includes('ENOTDIR')) {
      consola.info('💡 The specified path is not a directory. Check your --applications-dir setting.')
    }
    else if (error.message.includes('spawn') && error.message.includes('ENOENT')) {
      consola.info('💡 Command not found. Make sure Homebrew is installed and in your PATH.')
    }

    if (this.verbose) {
      consola.debug(`Stack trace: ${error.stack}`)
    }

    process.exit(EXIT_CODES.GENERAL_ERROR)
  }

  private showCommandFailureHelp(): void {
    consola.info('⚙️  Command Failure Help:')
    consola.info('1. Check if Homebrew is working: brew doctor')
    consola.info('2. Update Homebrew: brew update')
    consola.info('3. Check available disk space')
    consola.info('4. Try running with --verbose for more details')
  }

  private showFileNotFoundHelp(): void {
    consola.info('📁 File Not Found Help:')
    consola.info('1. Check if /Applications directory exists')
    consola.info('2. Verify the specified applications directory path')
    consola.info('3. Make sure you have read permissions')
    consola.info('4. Try using --applications-dir to specify a different path')
  }

  private showHomebrewInstallationHelp(): void {
    consola.info('🍺 Homebrew Installation Help:')
    consola.info('1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
    consola.info('2. Add Homebrew to your PATH (follow the installation instructions)')
    consola.info('3. Verify installation: brew --version')
    consola.info('4. Run this tool again')
    consola.info('\nFor more information: https://brew.sh/')
  }

  private showInputValidationHelp(): void {
    consola.info('📝 Input Validation Help:')
    consola.info('1. Check your command line arguments')
    consola.info('2. App names in --ignore should not be empty or whitespace')
    consola.info('3. Use quotes for app names with spaces: --ignore "Adobe Photoshop"')
    consola.info('4. Use --help to see all available options')
  }

  private showNetworkHelp(): void {
    consola.info('🌐 Network Help:')
    consola.info('1. Check your internet connection')
    consola.info('2. Verify DNS resolution: nslookup github.com')
    consola.info('3. Check if you\'re behind a corporate firewall')
    consola.info('4. Try again in a few minutes')
  }

  private showPermissionHelp(): void {
    consola.info('🔐 Permission Help:')
    consola.info('1. Make sure you have read access to /Applications directory')
    consola.info('2. Make sure you have write access to Homebrew directories')
    consola.info('3. Try running: chown -R $(whoami) /usr/local/Homebrew')
    consola.info('4. Or run this tool with appropriate permissions')
  }
}

/**
 * Progress tracker for long-running operations
 */
export class ProgressTracker {
  private lastUpdate: number
  private startTime: number

  constructor() {
    this.startTime = Date.now()
    this.lastUpdate = this.startTime
  }

  /**
   * Complete the current operation
   */
  completeOperation(operation: string, success = true): void {
    const elapsed = Date.now() - this.startTime
    const elapsedSeconds = (elapsed / 1000).toFixed(1)

    if (success) {
      consola.success(`${operation} completed in ${elapsedSeconds}s`)
    }
    else {
      consola.warn(`${operation} completed with errors in ${elapsedSeconds}s`)
    }
  }

  /**
   * Start a new operation with progress tracking
   */
  startOperation(operation: string, total?: number): void {
    this.startTime = Date.now()
    this.lastUpdate = this.startTime

    if (total === undefined) {
      consola.start(`Starting ${operation}...`)
    }
    else {
      consola.start(`Starting ${operation} (${total} items)...`)
    }
  }

  /**
   * Update progress for current operation
   */
  updateProgress(message: string, current?: number, total?: number): void {
    const now = Date.now()
    const elapsed = now - this.startTime
    const sinceLastUpdate = now - this.lastUpdate

    // Only show updates if enough time has passed (avoid spam)
    if (sinceLastUpdate < 1000 && current !== total) {
      return
    }

    this.lastUpdate = now

    let progressMessage = message

    if (current !== undefined && total !== undefined) {
      const percentage = Math.round((current / total) * 100)
      const progressBar = this.createProgressBar(current, total)
      progressMessage = `${message} ${progressBar} ${current}/${total} (${percentage}%)`
    }

    if (elapsed > 5000) { // Show elapsed time for long operations
      const elapsedSeconds = Math.round(elapsed / 1000)
      progressMessage += ` [${elapsedSeconds}s]`
    }

    consola.info(progressMessage)
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(current: number, total: number, width = 20): string {
    const percentage = current / total
    const filled = Math.round(width * percentage)
    const empty = width - filled

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null

/**
 * Create a progress callback function
 */
export function createProgressCallback(tracker: ProgressTracker): ProgressCallback {
  return (message: string, current: number, total: number) => {
    tracker.updateProgress(message, current, total)
  }
}

/**
 * Get the global error handler instance
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler()
  }

  return globalErrorHandler
}

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(verbose = false): ErrorHandler {
  globalErrorHandler = new ErrorHandler(verbose)

  return globalErrorHandler
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
export function setupGlobalErrorHandlers(verbose = false): void {
  const errorHandler = initializeErrorHandler(verbose)

  process.on('uncaughtException', (error: Error) => {
    consola.error('💥 Uncaught Exception:')
    errorHandler.handleError(error, 'uncaught exception')
  })

  process.on('unhandledRejection', (reason: unknown) => {
    consola.error('💥 Unhandled Promise Rejection:')
    const error = reason instanceof Error ? reason : new Error(String(reason))
    errorHandler.handleError(error, 'unhandled rejection')
  })
}
