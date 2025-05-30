/**
 * Tests for installation logic
 */

import {
  installApps,
  validateInstallationPrerequisites,
  getInstallationSummary
} from '../installer';
import { AppInfo, InstallerConfig, InstallationResult } from '../types';

// Mock the entire installer module's internal functions
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    access: jest.fn()
  }
}));

// Mock util.promisify to return our mock function
jest.mock('util', () => ({
  promisify: jest.fn((_fn) => {
    return jest.fn().mockImplementation(async (_command: string) => {
      // Default successful response
      return { stdout: 'Success', stderr: '' };
    });
  })
}));

describe('Installer Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockApp = (
    name: string,
    brewType: 'cask' | 'formula' = 'cask'
  ): AppInfo => ({
    originalName: name,
    brewName: name.toLowerCase().replace(/\s+/g, '-'),
    appPath: `/Applications/${name}.app`,
    brewType,
    status: 'available',
    alreadyInstalled: false
  });

  const mockConfig: InstallerConfig = {
    dryRun: false,
    verbose: false,
    sudoPassword: 'test-password'
  };

  describe('installApps', () => {
    it('should handle empty app list', async () => {
      const result = await installApps([], mockConfig);

      expect(result.installed).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.dryRun).toBe(false);
    });

    it('should work in dry-run mode', async () => {
      const apps = [
        createMockApp('Google Chrome', 'cask')
      ];

      const dryRunConfig: InstallerConfig = {
        ...mockConfig,
        dryRun: true
      };

      const result = await installApps(apps, dryRunConfig);

      expect(result.installed).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(result.dryRun).toBe(true);
      expect(result.installed[0]!.dryRun).toBe(true);
    });
  });

  describe('validateInstallationPrerequisites', () => {
    it('should be a function', () => {
      expect(typeof validateInstallationPrerequisites).toBe('function');
    });
  });

  describe('getInstallationSummary', () => {
    it('should generate summary for successful installations', () => {
      const result: InstallationResult = {
        installed: [
          {
            packageName: 'google-chrome',
            appName: 'Google Chrome',
            success: true,
            dryRun: false
          }
        ],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      const summary = getInstallationSummary(result);

      expect(summary).toContain('📊 INSTALLATION SUMMARY');
      expect(summary).toContain('✅ Successfully installed: 1');
      expect(summary).toContain('Google Chrome (google-chrome)');
    });

    it('should generate summary for failed installations', () => {
      const result: InstallationResult = {
        installed: [],
        failed: [
          {
            packageName: 'nonexistent-app',
            appName: 'Nonexistent App',
            success: false,
            error: 'Package not found',
            dryRun: false
          }
        ],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      const summary = getInstallationSummary(result);

      expect(summary).toContain('❌ Failed to install: 1');
      expect(summary).toContain('Nonexistent App (nonexistent-app): Package not found');
    });

    it('should generate dry-run summary', () => {
      const result: InstallationResult = {
        installed: [
          {
            packageName: 'google-chrome',
            appName: 'Google Chrome',
            success: true,
            dryRun: true
          }
        ],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: true
      };

      const summary = getInstallationSummary(result);

      expect(summary).toContain('🔍 DRY RUN SUMMARY');
      expect(summary).toContain('✅ Successfully installed: 1');
    });

    it('should handle empty results', () => {
      const result: InstallationResult = {
        installed: [],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      const summary = getInstallationSummary(result);

      expect(summary).toContain('⚠️  No packages were processed');
    });
  });
});
