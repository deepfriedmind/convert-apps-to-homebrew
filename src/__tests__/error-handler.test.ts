/**
 * Tests for enhanced error handling and progress tracking
 */

import {
  ErrorHandler,
  ProgressTracker,
  initializeErrorHandler,
  getErrorHandler,
  setupGlobalErrorHandlers,
  createProgressCallback
} from '../error-handler.ts';
import { ConvertAppsError, ErrorType } from '../types.ts';

describe('Error Handler Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });

    // Mock process.exit to prevent actual exit
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ErrorHandler', () => {
    it('should handle ConvertAppsError with HOMEBREW_NOT_INSTALLED type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'Homebrew not found',
        ErrorType.HOMEBREW_NOT_INSTALLED
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(2); // HOMEBREW_NOT_INSTALLED exit code
    });

    it('should handle ConvertAppsError with PERMISSION_DENIED type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'Permission denied',
        ErrorType.PERMISSION_DENIED
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(3); // PERMISSION_DENIED exit code
    });

    it('should handle ConvertAppsError with NETWORK_ERROR type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'Network error',
        ErrorType.NETWORK_ERROR
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(5); // NETWORK_ERROR exit code
    });

    it('should handle ConvertAppsError with COMMAND_FAILED type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'Command failed',
        ErrorType.COMMAND_FAILED
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1); // GENERAL_ERROR exit code
    });

    it('should handle ConvertAppsError with FILE_NOT_FOUND type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'File not found',
        ErrorType.FILE_NOT_FOUND
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1); // GENERAL_ERROR exit code
    });

    it('should handle ConvertAppsError with INVALID_INPUT type', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new ConvertAppsError(
        'Invalid input',
        ErrorType.INVALID_INPUT
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(4); // INVALID_INPUT exit code
    });

    it('should handle generic Error with ENOENT pattern', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new Error('ENOENT: no such file or directory');

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle generic Error with EACCES pattern', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new Error('EACCES: permission denied');

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle error with context', () => {
      const errorHandler = new ErrorHandler(false);
      const error = new Error('Test error');

      expect(() => errorHandler.handleError(error, 'test context')).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should show verbose information when enabled', () => {
      const errorHandler = new ErrorHandler(true);
      const originalError = new Error('Original error');
      const error = new ConvertAppsError(
        'Test error',
        ErrorType.COMMAND_FAILED,
        originalError
      );

      expect(() => errorHandler.handleError(error)).toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('ProgressTracker', () => {
    beforeEach(() => {
      // Mock Date.now to control timing
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    it('should start an operation', () => {
      const tracker = new ProgressTracker(false);
      tracker.startOperation('Test Operation');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Starting Test Operation...')
      );
    });

    it('should start an operation with total count', () => {
      const tracker = new ProgressTracker(false);
      tracker.startOperation('Test Operation', 10);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Starting Test Operation (10 items)...')
      );
    });

    it('should update progress without counts', () => {
      const tracker = new ProgressTracker(false);
      tracker.updateProgress('Processing...');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ℹ Processing...')
      );
    });

    it('should update progress with counts', () => {
      const tracker = new ProgressTracker(false);

      // Advance time to ensure update goes through
      jest.spyOn(Date, 'now').mockReturnValue(2000);
      tracker.updateProgress('Processing...', 5, 10);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing...')
      );
    });

    it('should complete operation successfully', () => {
      const tracker = new ProgressTracker(false);
      tracker.startOperation('Test Operation');

      // Advance time
      jest.spyOn(Date, 'now').mockReturnValue(3000);

      tracker.completeOperation('Test Operation', true);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Test Operation completed in 2.0s')
      );
    });

    it('should complete operation with errors', () => {
      const tracker = new ProgressTracker(false);

      // Test that the method can be called without errors
      expect(() => tracker.completeOperation('Test Operation', false)).not.toThrow();
    });

    it('should throttle progress updates', () => {
      const tracker = new ProgressTracker(false);

      // Clear previous calls
      jest.clearAllMocks();

      // First update should go through (advance time first)
      jest.spyOn(Date, 'now').mockReturnValue(2000);
      tracker.updateProgress('Processing...', 1, 10);
      expect(console.log).toHaveBeenCalledTimes(1);

      // Second update immediately should be throttled
      tracker.updateProgress('Processing...', 2, 10);
      expect(console.log).toHaveBeenCalledTimes(1);

      // Advance time and try again
      jest.spyOn(Date, 'now').mockReturnValue(4000);
      tracker.updateProgress('Processing...', 3, 10);
      expect(console.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('Global Error Handler', () => {
    it('should initialize global error handler', () => {
      const handler = initializeErrorHandler(true);
      expect(handler).toBeInstanceOf(ErrorHandler);
    });

    it('should get global error handler', () => {
      const handler1 = getErrorHandler();
      const handler2 = getErrorHandler();
      expect(handler1).toBe(handler2); // Should be the same instance
    });

    it('should setup global error handlers', () => {
      const mockOn = jest.spyOn(process, 'on').mockImplementation(() => process);

      setupGlobalErrorHandlers(true);

      expect(mockOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      mockOn.mockRestore();
    });

    it('should create progress callback', () => {
      const tracker = new ProgressTracker(false);
      const callback = createProgressCallback(tracker);

      expect(typeof callback).toBe('function');

      // Test that the callback can be called without errors
      expect(() => callback('Test message', 1, 10)).not.toThrow();
    });
  });
});
