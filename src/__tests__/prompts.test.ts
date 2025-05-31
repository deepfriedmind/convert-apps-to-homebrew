/**
 * Tests for interactive prompts
 */

import {
  promptAppSelection,
  promptSudoPassword,
  displayInstallationPlan,
  promptConfirmation,
  displayFinalSummary
} from '../prompts.ts';
import type { AppInfo, CommandOptions } from '../types.ts';

// Mock the inquirer modules
jest.mock('@inquirer/checkbox', () => jest.fn());
jest.mock('@inquirer/password', () => jest.fn());

const mockCheckbox = require('@inquirer/checkbox') as jest.MockedFunction<any>;
const mockPassword = require('@inquirer/password') as jest.MockedFunction<any>;

describe('Prompts Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockApp = (
    name: string,
    brewType: 'cask' | 'formula' | 'unavailable' = 'cask',
    status: 'available' | 'already-installed' | 'ignored' | 'unavailable' = 'available'
  ): AppInfo => ({
    originalName: name,
    brewName: name.toLowerCase().replace(/\s+/g, '-'),
    appPath: `/Applications/${name}.app`,
    brewType,
    status,
    alreadyInstalled: status === 'already-installed'
  });

  const mockOptions: CommandOptions = {
    ignore: [],
    dryRun: false,
    verbose: false,
    applicationsDir: '/Applications'
  };

  describe('promptAppSelection', () => {
    it('should return selected apps from checkbox prompt', async () => {
      const apps = [
        createMockApp('Google Chrome', 'cask', 'available'),
        createMockApp('Firefox', 'cask', 'available'),
        createMockApp('Node.js', 'formula', 'available')
      ];

      const selectedApps = [apps[0]!, apps[2]!]; // Select Chrome and Node.js
      mockCheckbox.mockResolvedValue(selectedApps);

      const result = await promptAppSelection(apps, mockOptions);

      expect(result).toEqual(selectedApps);
      expect(mockCheckbox).toHaveBeenCalledWith({
        message: 'Choose apps to install (use spacebar to toggle, Enter to confirm):',
        choices: expect.arrayContaining([
          expect.objectContaining({
            name: 'Google Chrome (📦 cask)',
            value: apps[0],
            checked: true
          }),
          expect.objectContaining({
            name: 'Firefox (📦 cask)',
            value: apps[1],
            checked: true
          }),
          expect.objectContaining({
            name: 'Node.js (⚙️  formula)',
            value: apps[2],
            checked: true
          })
        ]),
        pageSize: 15,
        loop: false,
        required: false
      });
    });

    it('should return empty array when no apps are available', async () => {
      const apps = [
        createMockApp('Already Installed', 'cask', 'already-installed'),
        createMockApp('Ignored App', 'cask', 'ignored'),
        createMockApp('Unavailable App', 'unavailable', 'unavailable')
      ];

      const result = await promptAppSelection(apps, mockOptions);

      expect(result).toEqual([]);
      expect(mockCheckbox).not.toHaveBeenCalled();
    });

    it('should return empty array when user selects no apps', async () => {
      const apps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      mockCheckbox.mockResolvedValue([]);

      const result = await promptAppSelection(apps, mockOptions);

      expect(result).toEqual([]);
    });

    it('should handle user cancellation', async () => {
      const apps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      const error = new Error('User cancelled');
      error.name = 'ExitPromptError';
      mockCheckbox.mockRejectedValue(error);

      const result = await promptAppSelection(apps, mockOptions);

      expect(result).toEqual([]);
    });

    it('should filter only available apps for selection', async () => {
      const apps = [
        createMockApp('Available App', 'cask', 'available'),
        createMockApp('Already Installed', 'cask', 'already-installed'),
        createMockApp('Ignored App', 'cask', 'ignored'),
        createMockApp('Unavailable App', 'unavailable', 'unavailable')
      ];

      mockCheckbox.mockResolvedValue([apps[0]!]);

      await promptAppSelection(apps, mockOptions);

      expect(mockCheckbox).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: [
            expect.objectContaining({
              name: 'Available App (📦 cask)',
              value: apps[0],
              checked: true
            })
          ]
        })
      );
    });
  });

  describe('promptSudoPassword', () => {
    it('should prompt for password when casks are selected', async () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available'),
        createMockApp('Node.js', 'formula', 'available')
      ];

      mockPassword.mockResolvedValue('test-password');

      const result = await promptSudoPassword(selectedApps);

      expect(result).toBe('test-password');
      expect(mockPassword).toHaveBeenCalledWith({
        message: 'Enter your password:',
        mask: true
      });
    });

    it('should return undefined when no casks are selected', async () => {
      const selectedApps = [
        createMockApp('Node.js', 'formula', 'available')
      ];

      const result = await promptSudoPassword(selectedApps);

      expect(result).toBeUndefined();
      expect(mockPassword).not.toHaveBeenCalled();
    });

    it('should return undefined when empty password is provided', async () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      mockPassword.mockResolvedValue('');

      const result = await promptSudoPassword(selectedApps);

      expect(result).toBeUndefined();
    });

    it('should return undefined when password prompt is cancelled', async () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      const error = new Error('User cancelled');
      error.name = 'ExitPromptError';
      mockPassword.mockRejectedValue(error);

      const result = await promptSudoPassword(selectedApps);

      expect(result).toBeUndefined();
    });
  });

  describe('displayInstallationPlan', () => {
    it('should display plan for mixed casks and formulas', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available'),
        createMockApp('Node.js', 'formula', 'available')
      ];

      displayInstallationPlan(selectedApps, 'test-password', false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 Installation Plan')
      );
    });

    it('should display dry run indicator', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      displayInstallationPlan(selectedApps, 'test-password', true);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('(DRY RUN)')
      );
    });

    it('should handle empty app list', () => {
      displayInstallationPlan([], undefined, false);

      // Should not display anything for empty list
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('📋 Installation Plan')
      );
    });

    it('should show sudo warning when no password provided for casks', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];

      displayInstallationPlan(selectedApps, undefined, false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('no sudo access')
      );
    });
  });

  describe('promptConfirmation', () => {
    it('should return true for confirmation', async () => {
      const result = await promptConfirmation(false);
      expect(result).toBe(true);
    });

    it('should return true for dry run confirmation', async () => {
      const result = await promptConfirmation(true);
      expect(result).toBe(true);
    });
  });

  describe('displayFinalSummary', () => {
    it('should display successful installation summary', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available'),
        createMockApp('Node.js', 'formula', 'available')
      ];
      const installedApps = selectedApps;
      const failedApps: AppInfo[] = [];

      displayFinalSummary(selectedApps, installedApps, failedApps, false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🎉 Installation Complete')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully installed')
      );
    });

    it('should display dry run summary', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available'),
        createMockApp('Node.js', 'formula', 'available')
      ];

      displayFinalSummary(selectedApps, [], [], true);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🎉 Dry Run Complete')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Would have processed')
      );
    });

    it('should display failed installations', () => {
      const selectedApps = [
        createMockApp('Google Chrome', 'cask', 'available')
      ];
      const installedApps: AppInfo[] = [];
      const failedApps = selectedApps;

      displayFinalSummary(selectedApps, installedApps, failedApps, false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to install')
      );
    });

    it('should handle no processed apps', () => {
      displayFinalSummary([], [], [], false);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No apps were processed')
      );
    });
  });
});
