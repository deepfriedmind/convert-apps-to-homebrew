/**
 * Enhanced error handling and progress tracking
 */

import { EXIT_CODES, MESSAGES } from './constants.ts'
import type { Logger, ProgressCallback } from './types.ts'
import { ConvertAppsError, ErrorType } from './types.ts'
import { colorize, createLogger } from './utils.ts'

/**
 * Enhanced error handler with context and recovery suggestions
 */
export class ErrorHandler {
  private logger: Logger
  private verbose: boolean

  constructor(verbose = false) {
    this.logger = createLogger(verbose)
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
    switch (error.type) {
      case ErrorType.COMMAND_FAILED: {
        this.logger.error(`Command execution failed${context}: ${error.message}`)
        this.showCommandFailureHelp()
        process.exit(EXIT_CODES.GENERAL_ERROR)
        break
      }

      case ErrorType.FILE_NOT_FOUND: {
        this.logger.error(`File not found${context}: ${error.message}`)
        this.showFileNotFoundHelp()
        process.exit(EXIT_CODES.GENERAL_ERROR)
        break
      }

      case ErrorType.HOMEBREW_NOT_INSTALLED: {
        this.logger.error(`${MESSAGES.HOMEBREW_NOT_INSTALLED}${context}`)
        this.showHomebrewInstallationHelp()
        process.exit(EXIT_CODES.HOMEBREW_NOT_INSTALLED)
        break
      }

      case ErrorType.INVALID_INPUT: {
        this.logger.error(`Invalid input${context}: ${error.message}`)
        this.showInputValidationHelp()
        process.exit(EXIT_CODES.INVALID_INPUT)
        break
      }

      case ErrorType.NETWORK_ERROR: {
        this.logger.error(`Network error occurred${context}. Please check your internet connection.`)
        this.showNetworkHelp()
        process.exit(EXIT_CODES.NETWORK_ERROR)
        break
      }

      case ErrorType.PERMISSION_DENIED: {
        this.logger.error(`${MESSAGES.PERMISSION_DENIED}${context}`)
        this.showPermissionHelp()
        process.exit(EXIT_CODES.PERMISSION_DENIED)
        break
      }

      case ErrorType.UNKNOWN_ERROR: {
        this.logger.error(`Unknown error${context}: ${error.message}`)

        if (error.originalError !== undefined && this.verbose) {
          this.logger.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
        break
      }

      default: {
        this.logger.error(`Application error${context}: ${error.message}`)

        if (error.originalError !== undefined && this.verbose) {
          this.logger.debug(`Original error: ${error.originalError.message}`)
        }

        process.exit(EXIT_CODES.GENERAL_ERROR)
        break
      }
    }
  }

  private handleGenericError(error: Error, context: string): never {
    this.logger.error(`Unexpected error${context}: ${error.message}`)

    // Check for common error patterns
    if (error.message.includes('ENOENT')) {
      this.showFileNotFoundHelp()
    }
    else if (error.message.includes('EACCES')) {
      this.showPermissionHelp()
    }
    else if (error.message.includes('ENOTDIR')) {
      this.logger.info('💡 The specified path is not a directory. Check your --applications-dir setting.')
    }
    else if (error.message.includes('spawn') && error.message.includes('ENOENT')) {
      this.logger.info('💡 Command not found. Make sure Homebrew is installed and in your PATH.')
    }

    if (this.verbose) {
      this.logger.debug(`Stack trace: ${error.stack}`)
    }

    process.exit(EXIT_CODES.GENERAL_ERROR)
  }

  private showCommandFailureHelp(): void {
    console.log(colorize('\n⚙️  Command Failure Help:', 'CYAN'))
    console.log('1. Check if Homebrew is working: brew doctor')
    console.log('2. Update Homebrew: brew update')
    console.log('3. Check available disk space')
    console.log('4. Try running with --verbose for more details')
  }

  private showFileNotFoundHelp(): void {
    console.log(colorize('\n📁 File Not Found Help:', 'CYAN'))
    console.log('1. Check if /Applications directory exists')
    console.log('2. Verify the specified applications directory path')
    console.log('3. Make sure you have read permissions')
    console.log('4. Try using --applications-dir to specify a different path')
  }

  private showHomebrewInstallationHelp(): void {
    console.log(colorize('\n🍺 Homebrew Installation Help:', 'CYAN'))
    console.log('1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
    console.log('2. Add Homebrew to your PATH (follow the installation instructions)')
    console.log('3. Verify installation: brew --version')
    console.log('4. Run this tool again')
    console.log('\nFor more information: https://brew.sh/')
  }

  private showInputValidationHelp(): void {
    console.log(colorize('\n📝 Input Validation Help:', 'CYAN'))
    console.log('1. Check your command line arguments')
    console.log('2. App names in --ignore should not be empty or whitespace')
    console.log('3. Use quotes for app names with spaces: --ignore "Adobe Photoshop"')
    console.log('4. Use --help to see all available options')
  }

  private showNetworkHelp(): void {
    console.log(colorize('\n🌐 Network Help:', 'CYAN'))
    console.log('1. Check your internet connection')
    console.log('2. Verify DNS resolution: nslookup github.com')
    console.log('3. Check if you\'re behind a corporate firewall')
    console.log('4. Try again in a few minutes')
  }

  private showPermissionHelp(): void {
    console.log(colorize('\n🔐 Permission Help:', 'CYAN'))
    console.log('1. Make sure you have read access to /Applications directory')
    console.log('2. For cask installations, you need admin privileges to delete original apps')
    console.log('3. Try running: sudo chown -R $(whoami) /usr/local/Homebrew')
    console.log('4. Or run this tool with appropriate permissions')
  }
}

/**
 * Progress tracker for long-running operations
 */
export class ProgressTracker {
  private lastUpdate: number
  private logger: Logger
  private startTime: number

  constructor(verbose = false) {
    this.logger = createLogger(verbose)
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
      this.logger.info(`✅ ${operation} completed in ${elapsedSeconds}s`)
    }
    else {
      this.logger.warn(`⚠️  ${operation} completed with errors in ${elapsedSeconds}s`)
    }
  }

  /**
   * Start a new operation with progress tracking
   */
  startOperation(operation: string, total?: number): void {
    this.startTime = Date.now()
    this.lastUpdate = this.startTime

    if (total === undefined) {
      this.logger.info(`🚀 Starting ${operation}...`)
    }
    else {
      this.logger.info(`🚀 Starting ${operation} (${total} items)...`)
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

    this.logger.info(progressMessage)
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
    console.error(colorize('\n💥 Uncaught Exception:', 'RED'))
    errorHandler.handleError(error, 'uncaught exception')
  })

  process.on('unhandledRejection', (reason: unknown) => {
    console.error(colorize('\n💥 Unhandled Promise Rejection:', 'RED'))
    const error = reason instanceof Error ? reason : new Error(String(reason))
    errorHandler.handleError(error, 'unhandled rejection')
  })
}
