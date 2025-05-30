/**
 * Tests for app scanner module
 */

import { promises as fs } from 'fs';
import { scanApplicationsDirectory, checkAlreadyInstalled } from '../app-scanner';
import { ConvertAppsError, ErrorType, AppInfo } from '../types';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('App Scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scanApplicationsDirectory', () => {
    it('should return list of .app directories', async () => {
      const mockDirents = [
        { name: 'Google Chrome.app', isDirectory: () => true },
        { name: 'Firefox.app', isDirectory: () => true },
        { name: 'TextEdit.app', isDirectory: () => true },
        { name: 'README.txt', isDirectory: () => false },
        { name: 'SomeFolder', isDirectory: () => true }
      ];

      mockFs.readdir.mockResolvedValue(mockDirents as any);

      const result = await scanApplicationsDirectory('/Applications');
      expect(result).toEqual([
        '/Applications/Google Chrome.app',
        '/Applications/Firefox.app',
        '/Applications/TextEdit.app'
      ]);
    });

    it('should throw ConvertAppsError for non-existent directory', async () => {
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      mockFs.readdir.mockRejectedValue(error);

      await expect(scanApplicationsDirectory('/NonExistent'))
        .rejects
        .toThrow(ConvertAppsError);

      try {
        await scanApplicationsDirectory('/NonExistent');
      } catch (err) {
        expect(err).toBeInstanceOf(ConvertAppsError);
        expect((err as ConvertAppsError).type).toBe(ErrorType.FILE_NOT_FOUND);
      }
    });

    it('should throw ConvertAppsError for permission denied', async () => {
      const error = new Error('EACCES') as any;
      error.code = 'EACCES';
      mockFs.readdir.mockRejectedValue(error);

      await expect(scanApplicationsDirectory('/Applications'))
        .rejects
        .toThrow(ConvertAppsError);

      try {
        await scanApplicationsDirectory('/Applications');
      } catch (err) {
        expect(err).toBeInstanceOf(ConvertAppsError);
        expect((err as ConvertAppsError).type).toBe(ErrorType.PERMISSION_DENIED);
      }
    });
  });

  describe('checkAlreadyInstalled', () => {
    it('should work with empty apps array', async () => {
      const apps: AppInfo[] = [];
      const result = await checkAlreadyInstalled(apps);
      expect(result).toEqual([]);
    });
  });
});
