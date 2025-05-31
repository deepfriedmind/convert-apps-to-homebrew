/**
 * Tests for main entry point
 */

import { main } from '../index.ts';
import * as cli from '../cli.ts';
import * as appScanner from '../app-scanner.ts';
import * as prompts from '../prompts.ts';
import * as installer from '../installer.ts';
import type { AppInfo, CommandOptions, InstallationResult } from '../types.ts';

// Mock all modules
jest.mock('../cli');
jest.mock('../app-scanner');
jest.mock('../prompts');
jest.mock('../installer');

const mockCli = cli as jest.Mocked<typeof cli>;
const mockAppScanner = appScanner as jest.Mocked<typeof appScanner>;
const mockPrompts = prompts as jest.Mocked<typeof prompts>;
const mockInstaller = installer as jest.Mocked<typeof installer>;

describe('Main Entry Point', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock process.exit to prevent actual exit
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Set up default mocks
    mockCli.setupSignalHandlers.mockImplementation(() => {});
    mockCli.validateEnvironment.mockImplementation(() => {});
    mockCli.displayWelcome.mockImplementation(() => {});
    mockCli.parseArguments.mockReturnValue({
      ignore: [],
      dryRun: false,
      verbose: false,
      applicationsDir: '/Applications'
    });

    mockInstaller.validateInstallationPrerequisites.mockResolvedValue(undefined);
    mockAppScanner.discoverApps.mockResolvedValue([]);
    mockPrompts.promptAppSelection.mockResolvedValue([]);
    mockPrompts.promptSudoPassword.mockResolvedValue(undefined);
    mockPrompts.displayInstallationPlan.mockImplementation(() => {});
    mockPrompts.promptConfirmation.mockResolvedValue(true);
    mockPrompts.displayFinalSummary.mockImplementation(() => {});

    mockInstaller.installApps.mockResolvedValue({
      installed: [],
      failed: [],
      alreadyInstalled: [],
      ignored: [],
      unavailable: [],
      dryRun: false
    });
    mockInstaller.getInstallationSummary.mockReturnValue('Summary');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockApp = (name: string, brewType: 'cask' | 'formula' = 'cask'): AppInfo => ({
    originalName: name,
    brewName: name.toLowerCase().replace(/\s+/g, '-'),
    appPath: `/Applications/${name}.app`,
    brewType,
    status: 'available',
    alreadyInstalled: false
  });

  describe('main function', () => {
    it('should complete successfully with no apps found', async () => {
      mockAppScanner.discoverApps.mockResolvedValue([]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockCli.setupSignalHandlers).toHaveBeenCalled();
      expect(mockCli.validateEnvironment).toHaveBeenCalled();
      expect(mockCli.parseArguments).toHaveBeenCalled();
      expect(mockCli.displayWelcome).toHaveBeenCalled();
      expect(mockInstaller.validateInstallationPrerequisites).toHaveBeenCalled();
      expect(mockAppScanner.discoverApps).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should complete successfully with no apps selected', async () => {
      const discoveredApps = [createMockApp('Google Chrome')];
      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue([]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptAppSelection).toHaveBeenCalledWith(discoveredApps, expect.any(Object));
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should complete full installation flow', async () => {
      const discoveredApps = [createMockApp('Google Chrome')];
      const selectedApps = [discoveredApps[0]!];
      const installationResult: InstallationResult = {
        installed: [{
          packageName: 'google-chrome',
          appName: 'Google Chrome',
          success: true,
          dryRun: false
        }],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue('password');
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptAppSelection).toHaveBeenCalledWith(discoveredApps, expect.any(Object));
      expect(mockPrompts.promptSudoPassword).toHaveBeenCalledWith(selectedApps);
      expect(mockPrompts.displayInstallationPlan).toHaveBeenCalledWith(selectedApps, 'password', false);
      expect(mockPrompts.promptConfirmation).toHaveBeenCalledWith(false);
      expect(mockInstaller.installApps).toHaveBeenCalledWith(selectedApps, expect.objectContaining({
        dryRun: false,
        verbose: false,
        sudoPassword: 'password'
      }));
      expect(mockPrompts.displayFinalSummary).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle dry-run mode', async () => {
      const options: CommandOptions = {
        ignore: [],
        dryRun: true,
        verbose: false,
        applicationsDir: '/Applications'
      };

      const discoveredApps = [createMockApp('Google Chrome')];
      const selectedApps = [discoveredApps[0]!];
      const installationResult: InstallationResult = {
        installed: [{
          packageName: 'google-chrome',
          appName: 'Google Chrome',
          success: true,
          dryRun: true
        }],
        failed: [],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: true
      };

      mockCli.parseArguments.mockReturnValue(options);
      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.displayInstallationPlan).toHaveBeenCalledWith(selectedApps, undefined, true);
      expect(mockPrompts.promptConfirmation).toHaveBeenCalledWith(true);
      expect(mockInstaller.installApps).toHaveBeenCalledWith(selectedApps, expect.objectContaining({
        dryRun: true
      }));
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle user cancellation at confirmation', async () => {
      const discoveredApps = [createMockApp('Google Chrome')];
      const selectedApps = [discoveredApps[0]!];

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptConfirmation.mockResolvedValue(false);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptConfirmation).toHaveBeenCalled();
      expect(mockInstaller.installApps).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle installation failures', async () => {
      const discoveredApps = [createMockApp('Google Chrome')];
      const selectedApps = [discoveredApps[0]!];
      const installationResult: InstallationResult = {
        installed: [],
        failed: [{
          packageName: 'google-chrome',
          appName: 'Google Chrome',
          success: false,
          error: 'Installation failed',
          dryRun: false
        }],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(process.exit).toHaveBeenCalledWith(1); // General error exit code
    });

    it('should handle user cancellation with ExitPromptError', async () => {
      const error = new Error('User cancelled');
      error.name = 'ExitPromptError';

      mockPrompts.promptAppSelection.mockRejectedValue(error);
      mockAppScanner.discoverApps.mockResolvedValue([createMockApp('Google Chrome')]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle verbose mode', async () => {
      const options: CommandOptions = {
        ignore: [],
        dryRun: false,
        verbose: true,
        applicationsDir: '/Applications'
      };

      mockCli.parseArguments.mockReturnValue(options);
      mockAppScanner.discoverApps.mockResolvedValue([]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockCli.displayWelcome).toHaveBeenCalledWith(options);
      expect(mockAppScanner.discoverApps).toHaveBeenCalledWith(expect.objectContaining({
        verbose: true
      }));
    });

    it('should handle ignored apps', async () => {
      const options: CommandOptions = {
        ignore: ['Adobe Photoshop', 'Microsoft Word'],
        dryRun: false,
        verbose: false,
        applicationsDir: '/Applications'
      };

      mockCli.parseArguments.mockReturnValue(options);
      mockAppScanner.discoverApps.mockResolvedValue([]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockAppScanner.discoverApps).toHaveBeenCalledWith(expect.objectContaining({
        ignoredApps: ['Adobe Photoshop', 'Microsoft Word']
      }));
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected error');
      mockAppScanner.discoverApps.mockRejectedValue(error);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
