/**
 * Tests for TypeScript types and interfaces
 */

import { ConvertAppsError, ErrorType } from '../types.ts';
import type {
  AppInfo,
  AppStatus,
  BrewPackageType,
  CommandOptions,
  InstallationResult,
  OperationSummary
} from '../types.ts';

describe('Types and Interfaces', () => {
  describe('AppInfo interface', () => {
    it('should create a valid AppInfo object', () => {
      const appInfo: AppInfo = {
        originalName: 'Google Chrome',
        brewName: 'google-chrome',
        appPath: '/Applications/Google Chrome.app',
        brewType: 'cask',
        status: 'available',
        alreadyInstalled: false
      };

      expect(appInfo.originalName).toBe('Google Chrome');
      expect(appInfo.brewName).toBe('google-chrome');
      expect(appInfo.brewType).toBe('cask');
      expect(appInfo.status).toBe('available');
      expect(appInfo.alreadyInstalled).toBe(false);
    });
  });

  describe('CommandOptions interface', () => {
    it('should create valid CommandOptions', () => {
      const options: CommandOptions = {
        ignore: ['app1', 'app2'],
        dryRun: true,
        verbose: false
      };

      expect(options.ignore).toEqual(['app1', 'app2']);
      expect(options.dryRun).toBe(true);
      expect(options.verbose).toBe(false);
    });

    it('should allow optional properties', () => {
      const options: CommandOptions = {};
      expect(options.ignore).toBeUndefined();
      expect(options.dryRun).toBeUndefined();
      expect(options.verbose).toBeUndefined();
    });
  });

  describe('ConvertAppsError class', () => {
    it('should create a custom error with type', () => {
      const error = new ConvertAppsError(
        'Homebrew not found',
        ErrorType.HOMEBREW_NOT_INSTALLED
      );

      expect(error.message).toBe('Homebrew not found');
      expect(error.type).toBe(ErrorType.HOMEBREW_NOT_INSTALLED);
      expect(error.name).toBe('ConvertAppsError');
      expect(error instanceof Error).toBe(true);
    });

    it('should include original error if provided', () => {
      const originalError = new Error('Original error');
      const error = new ConvertAppsError(
        'Wrapped error',
        ErrorType.COMMAND_FAILED,
        originalError
      );

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Type unions', () => {
    it('should accept valid BrewPackageType values', () => {
      const cask: BrewPackageType = 'cask';
      const formula: BrewPackageType = 'formula';
      const unavailable: BrewPackageType = 'unavailable';

      expect(cask).toBe('cask');
      expect(formula).toBe('formula');
      expect(unavailable).toBe('unavailable');
    });

    it('should accept valid AppStatus values', () => {
      const available: AppStatus = 'available';
      const alreadyInstalled: AppStatus = 'already-installed';
      const unavailable: AppStatus = 'unavailable';
      const ignored: AppStatus = 'ignored';

      expect(available).toBe('available');
      expect(alreadyInstalled).toBe('already-installed');
      expect(unavailable).toBe('unavailable');
      expect(ignored).toBe('ignored');
    });
  });

  describe('InstallationResult interface', () => {
    it('should create a valid InstallationResult', () => {
      const result: InstallationResult = {
        installed: [],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      expect(Array.isArray(result.installed)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      expect(Array.isArray(result.alreadyInstalled)).toBe(true);
      expect(Array.isArray(result.ignored)).toBe(true);
      expect(Array.isArray(result.unavailable)).toBe(true);
      expect(result.dryRun).toBe(false);
    });
  });

  describe('OperationSummary interface', () => {
    it('should create a valid OperationSummary', () => {
      const summary: OperationSummary = {
        totalApps: 10,
        availableApps: 8,
        alreadyInstalled: 1,
        ignored: 1,
        unavailable: 2,
        selected: 5,
        installed: 4,
        failed: 1,
        dryRun: false
      };

      expect(summary.totalApps).toBe(10);
      expect(summary.availableApps).toBe(8);
      expect(summary.selected).toBe(5);
      expect(summary.installed).toBe(4);
      expect(summary.failed).toBe(1);
    });
  });
});
