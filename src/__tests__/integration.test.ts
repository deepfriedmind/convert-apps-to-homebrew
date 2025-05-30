/**
 * Integration tests for the complete application flow
 */

import { main } from '../index';
import * as cli from '../cli';
import * as appScanner from '../app-scanner';
import * as prompts from '../prompts';
import * as installer from '../installer';
import { AppInfo, InstallationResult } from '../types';

// Mock all modules for integration testing
jest.mock('../cli');
jest.mock('../app-scanner');
jest.mock('../prompts');
jest.mock('../installer');

const mockCli = cli as jest.Mocked<typeof cli>;
const mockAppScanner = appScanner as jest.Mocked<typeof appScanner>;
const mockPrompts = prompts as jest.Mocked<typeof prompts>;
const mockInstaller = installer as jest.Mocked<typeof installer>;

describe('Integration Tests', () => {
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

    // Set up default mocks for successful flow
    mockCli.setupSignalHandlers.mockImplementation(() => { });
    mockCli.validateEnvironment.mockImplementation(() => { });
    mockCli.displayWelcome.mockImplementation(() => { });
    mockCli.parseArguments.mockReturnValue({
      ignore: [],
      dryRun: false,
      verbose: false,
      applicationsDir: '/Applications'
    });

    mockInstaller.validateInstallationPrerequisites.mockResolvedValue(undefined);
    mockInstaller.getInstallationSummary.mockReturnValue('Installation Summary');

    mockPrompts.displayInstallationPlan.mockImplementation(() => { });
    mockPrompts.displayFinalSummary.mockImplementation(() => { });
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

  describe('Complete Application Flow', () => {
    it('should complete full workflow with successful installation', async () => {
      // Setup test data
      const discoveredApps = [
        createMockApp('Google Chrome', 'cask'),
        createMockApp('Node.js', 'formula'),
        createMockApp('Visual Studio Code', 'cask')
      ];

      const selectedApps = [discoveredApps[0]!, discoveredApps[2]!]; // Chrome and VS Code

      const installationResult: InstallationResult = {
        installed: [
          {
            packageName: 'google-chrome',
            appName: 'Google Chrome',
            success: true,
            dryRun: false
          },
          {
            packageName: 'visual-studio-code',
            appName: 'Visual Studio Code',
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

      // Setup mocks
      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue('test-password');
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      // Execute
      await expect(main()).rejects.toThrow('process.exit called');

      // Verify the complete flow
      expect(mockCli.setupSignalHandlers).toHaveBeenCalled();
      expect(mockCli.validateEnvironment).toHaveBeenCalled();
      expect(mockCli.parseArguments).toHaveBeenCalled();
      expect(mockCli.displayWelcome).toHaveBeenCalled();
      expect(mockInstaller.validateInstallationPrerequisites).toHaveBeenCalled();
      expect(mockAppScanner.discoverApps).toHaveBeenCalledWith({
        applicationsDir: '/Applications',
        ignoredApps: [],
        verbose: false
      });
      expect(mockPrompts.promptAppSelection).toHaveBeenCalledWith(discoveredApps, expect.any(Object));
      expect(mockPrompts.promptSudoPassword).toHaveBeenCalledWith(selectedApps);
      expect(mockPrompts.displayInstallationPlan).toHaveBeenCalledWith(selectedApps, 'test-password', false);
      expect(mockPrompts.promptConfirmation).toHaveBeenCalledWith(false);
      expect(mockInstaller.installApps).toHaveBeenCalledWith(selectedApps, {
        dryRun: false,
        verbose: false,
        sudoPassword: 'test-password'
      });
      expect(mockPrompts.displayFinalSummary).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle dry-run workflow correctly', async () => {
      // Setup for dry-run mode
      mockCli.parseArguments.mockReturnValue({
        ignore: ['Adobe Photoshop'],
        dryRun: true,
        verbose: true,
        applicationsDir: '/Applications'
      });

      const discoveredApps = [createMockApp('Google Chrome', 'cask')];
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

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue(undefined); // No password needed for dry-run
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      // Verify dry-run specific behavior
      expect(mockAppScanner.discoverApps).toHaveBeenCalledWith({
        applicationsDir: '/Applications',
        ignoredApps: ['Adobe Photoshop'],
        verbose: true
      });
      expect(mockPrompts.displayInstallationPlan).toHaveBeenCalledWith(selectedApps, undefined, true);
      expect(mockPrompts.promptConfirmation).toHaveBeenCalledWith(true);
      expect(mockInstaller.installApps).toHaveBeenCalledWith(selectedApps, {
        dryRun: true,
        verbose: true
      });
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle workflow with mixed success and failures', async () => {
      const discoveredApps = [
        createMockApp('Google Chrome', 'cask'),
        createMockApp('Nonexistent App', 'cask')
      ];

      const selectedApps = discoveredApps;

      const installationResult: InstallationResult = {
        installed: [{
          packageName: 'google-chrome',
          appName: 'Google Chrome',
          success: true,
          dryRun: false
        }],
        failed: [{
          packageName: 'nonexistent-app',
          appName: 'Nonexistent App',
          success: false,
          error: 'Package not found',
          dryRun: false
        }],
        alreadyInstalled: [],
        ignored: [],
        unavailable: [],
        dryRun: false
      };

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue('test-password');
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      // Should exit with error code due to failures
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle workflow with no apps discovered', async () => {
      mockAppScanner.discoverApps.mockResolvedValue([]);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockAppScanner.discoverApps).toHaveBeenCalled();
      expect(mockPrompts.promptAppSelection).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle workflow with user cancellation at selection', async () => {
      const discoveredApps = [createMockApp('Google Chrome', 'cask')];

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue([]); // User selects nothing

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptAppSelection).toHaveBeenCalled();
      expect(mockPrompts.promptSudoPassword).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle workflow with user cancellation at confirmation', async () => {
      const discoveredApps = [createMockApp('Google Chrome', 'cask')];
      const selectedApps = [discoveredApps[0]!];

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue('test-password');
      mockPrompts.promptConfirmation.mockResolvedValue(false); // User cancels

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptConfirmation).toHaveBeenCalled();
      expect(mockInstaller.installApps).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle workflow with formula-only installations', async () => {
      const discoveredApps = [
        createMockApp('Node.js', 'formula'),
        createMockApp('Git', 'formula')
      ];

      const selectedApps = discoveredApps;

      const installationResult: InstallationResult = {
        installed: [
          {
            packageName: 'node.js',
            appName: 'Node.js',
            success: true,
            dryRun: false
          },
          {
            packageName: 'git',
            appName: 'Git',
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

      mockAppScanner.discoverApps.mockResolvedValue(discoveredApps);
      mockPrompts.promptAppSelection.mockResolvedValue(selectedApps);
      mockPrompts.promptSudoPassword.mockResolvedValue(undefined); // No sudo needed for formulas
      mockPrompts.promptConfirmation.mockResolvedValue(true);
      mockInstaller.installApps.mockResolvedValue(installationResult);

      await expect(main()).rejects.toThrow('process.exit called');

      expect(mockPrompts.promptSudoPassword).toHaveBeenCalledWith(selectedApps);
      expect(mockPrompts.displayInstallationPlan).toHaveBeenCalledWith(selectedApps, undefined, false);
      expect(mockInstaller.installApps).toHaveBeenCalledWith(selectedApps, {
        dryRun: false,
        verbose: false
      });
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle ExitPromptError gracefully', async () => {
      const error = new Error('User cancelled');
      error.name = 'ExitPromptError';

      mockAppScanner.discoverApps.mockResolvedValue([createMockApp('Google Chrome')]);
      mockPrompts.promptAppSelection.mockRejectedValue(error);

      await expect(main()).rejects.toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected error');
      mockAppScanner.discoverApps.mockRejectedValue(error);

      await expect(main()).rejects.toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
