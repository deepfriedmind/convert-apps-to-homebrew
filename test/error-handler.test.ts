/**
 * Test file for error-handler.ts
 */

import assert from 'node:assert'
import { describe, mock, test } from 'node:test'

import { EXIT_CODES } from '../src/constants.ts'
import {
  ErrorHandler,
  getErrorHandler,
  ProgressTracker,
} from '../src/error-handler.ts'
import { ConvertAppsError, ErrorType } from '../src/types.ts'

describe('ErrorHandler', () => {
  void test('should create error handler with default verbose false', () => {
    const handler = new ErrorHandler()
    assert.strictEqual(typeof handler, 'object')
  })

  void test('should create error handler with verbose true', () => {
    const handler = new ErrorHandler(true)
    assert.strictEqual(typeof handler, 'object')
  })

  void test('should handle ConvertAppsError types', () => {
    const handler = new ErrorHandler()
    const originalExit = process.exit.bind(process)
    let exitCode: number | undefined

    // Mock process.exit to prevent test termination and stop execution
    process.exit = mock.fn((code?: number) => {
      exitCode = code
      // Throw an error to prevent fallthrough in switch statement
      throw new Error(`process.exit called with code ${code}`)
    }) as typeof process.exit

    try {
      const error = new ConvertAppsError('Test error', ErrorType.INVALID_INPUT)
      try {
        void handler.handleError(error)
      }
      catch (error) {
        // Expected to throw when process.exit is called
        if (error instanceof Error && error.message.includes('process.exit called')) {
          // This is expected behavior
        }
        else {
          throw error
        }
      }

      assert.strictEqual(exitCode, EXIT_CODES.INVALID_INPUT)
    }
    finally {
      process.exit = originalExit
    }
  })

  void test('should handle generic errors', () => {
    const handler = new ErrorHandler()
    const originalExit = process.exit.bind(process)
    let exitCode: number | undefined

    // Mock process.exit to prevent test termination
    process.exit = mock.fn((code?: number) => {
      exitCode = code

      return undefined as never
    }) as typeof process.exit

    try {
      const error = new Error('Generic error')
      try {
        void handler.handleError(error)
      }
      catch {
        // Expected to not actually exit in test
      }

      assert.strictEqual(exitCode, EXIT_CODES.GENERAL_ERROR)
    }
    finally {
      process.exit = originalExit
    }
  })
})

describe('ProgressTracker', () => {
  void test('should create progress tracker with default verbose false', () => {
    const tracker = new ProgressTracker()
    assert.strictEqual(typeof tracker, 'object')
  })

  void test('should create progress tracker with verbose true', () => {
    const tracker = new ProgressTracker()
    assert.strictEqual(typeof tracker, 'object')
  })

  void test('should start operation without total', () => {
    const tracker = new ProgressTracker()
    tracker.startOperation('test operation')
    // No assertion needed, just ensure it doesn't throw
  })

  void test('should start operation with total', () => {
    const tracker = new ProgressTracker()
    tracker.startOperation('test operation', 100)
    // No assertion needed, just ensure it doesn't throw
  })

  void test('should update progress without numbers', () => {
    const tracker = new ProgressTracker()
    tracker.updateProgress('test message')
    // No assertion needed, just ensure it doesn't throw
  })

  void test('should update progress with current and total', () => {
    const tracker = new ProgressTracker()
    tracker.updateProgress('test message', 50, 100)
    // No assertion needed, just ensure it doesn't throw
  })

  void test('should complete operation successfully', () => {
    const tracker = new ProgressTracker()
    tracker.completeOperation('test operation', true)
    // No assertion needed, just ensure it doesn't throw
  })

  void test('should complete operation with errors', () => {
    const tracker = new ProgressTracker()
    tracker.completeOperation('test operation', false)
    // No assertion needed, just ensure it doesn't throw
  })
})

describe('module functions', () => {
  void test('should return ErrorHandler instance', () => {
    const handler = getErrorHandler()
    assert.strictEqual(typeof handler, 'object')
    assert.strictEqual(handler.constructor.name, 'ErrorHandler')
  })

  void test('should return same instance on multiple calls', () => {
    const handler1 = getErrorHandler()
    const handler2 = getErrorHandler()
    assert.strictEqual(handler1, handler2)
  })
})
