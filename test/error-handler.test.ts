/**
 * Test file for error-handler.ts
 */

import { describe, expect, test } from 'bun:test'

const TEST_TOTAL = 100
const TEST_CURRENT = 50

import { EXIT_CODES } from '../src/constants.ts'
import {
  ErrorHandler,
  getErrorHandler,
  ProgressTracker,
} from '../src/error-handler.ts'
import { ConvertAppsError, ErrorType } from '../src/types.ts'

describe('ErrorHandler', () => {
  test('should create error handler with default verbose false', () => {
    const handler = new ErrorHandler()
    expect(typeof handler).toBe('object')
  })

  test('should create error handler with verbose true', () => {
    const handler = new ErrorHandler(true)
    expect(typeof handler).toBe('object')
  })

  test('should handle ConvertAppsError types', () => {
    const handler = new ErrorHandler()
    const error = new ConvertAppsError('Test error', ErrorType.INVALID_INPUT)

    // Mock process.exit to prevent test termination
    const originalExit = process.exit.bind(process)
    let exitCode: number | undefined

    const mockExit = (code?: number): never => {
      exitCode = code
      throw new Error(`process.exit called with code ${code}`)
    }

    process.exit = mockExit as typeof process.exit

    try {
      handler.handleError(error)
    } catch {
      // Expected to throw in test environment
    } finally {
      process.exit = originalExit
    }

    expect(exitCode).toBe(EXIT_CODES.INVALID_INPUT)
  })

  test('should handle generic errors', () => {
    const handler = new ErrorHandler()
    const error = new Error('Generic error')

    // Mock process.exit to prevent test termination
    const originalExit = process.exit.bind(process)
    let exitCode: number | undefined

    const mockExit = (code?: number): never => {
      exitCode = code
      throw new Error(`process.exit called with code ${code}`)
    }

    process.exit = mockExit as typeof process.exit

    try {
      handler.handleError(error)
    } catch {
      // Expected to throw in test environment
    } finally {
      process.exit = originalExit
    }

    expect(exitCode).toBe(EXIT_CODES.GENERAL_ERROR)
  })
})

describe('ProgressTracker', () => {
  test('should create progress tracker', () => {
    const tracker = new ProgressTracker()
    expect(typeof tracker).toBe('object')
  })

  test('should start operation without total', () => {
    const tracker = new ProgressTracker()
    expect(() => tracker.startOperation('test operation')).not.toThrow()
  })

  test('should start operation with total', () => {
    const tracker = new ProgressTracker()
    expect(() =>
      tracker.startOperation('test operation', TEST_TOTAL),
    ).not.toThrow()
  })

  test('should update progress without numbers', () => {
    const tracker = new ProgressTracker()
    expect(() => tracker.updateProgress('test message')).not.toThrow()
  })

  test('should update progress with current and total', () => {
    const tracker = new ProgressTracker()
    expect(() =>
      tracker.updateProgress('test message', TEST_CURRENT, TEST_TOTAL),
    ).not.toThrow()
  })

  test('should complete operation successfully', () => {
    const tracker = new ProgressTracker()
    expect(() =>
      tracker.completeOperation('test operation', true),
    ).not.toThrow()
  })

  test('should complete operation with errors', () => {
    const tracker = new ProgressTracker()
    expect(() =>
      tracker.completeOperation('test operation', false),
    ).not.toThrow()
  })
})

describe('module functions', () => {
  test('should return ErrorHandler instance', () => {
    const handler = getErrorHandler()
    expect(typeof handler).toBe('object')
    expect(handler.constructor.name).toBe('ErrorHandler')
  })

  test('should return same instance on multiple calls', () => {
    const handler1 = getErrorHandler()
    const handler2 = getErrorHandler()
    expect(handler1).toBe(handler2)
  })
})
