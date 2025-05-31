/**
 * Tests for CLI argument parsing
 */

import { createProgram, parseArguments, validateEnvironment } from '../cli.ts';

// Mock fs for package.json reading
jest.mock('fs', () => ({
  readFileSync: jest.fn()
}));

const mockReadFileSync = require('fs').readFileSync as jest.MockedFunction<typeof import('fs').readFileSync>;

describe('CLI Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock package.json reading
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
  });

  describe('createProgram', () => {
    it('should create a Commander program with correct configuration', () => {
      const program = createProgram();

      expect(program.name()).toBe('convert-apps-to-homebrew');
      expect(program.description()).toContain('Convert macOS applications to Homebrew');
      expect(program.version()).toBe('1.0.0');
    });

    it('should have all required options configured', () => {
      const program = createProgram();
      const options = program.options;

      const optionFlags = options.map(opt => opt.flags);
      expect(optionFlags).toContain('-i, --ignore <apps...>');
      expect(optionFlags).toContain('-d, --dry-run');
      expect(optionFlags).toContain('--verbose');
      expect(optionFlags).toContain('--applications-dir <path>');
    });
  });

  describe('parseArguments', () => {
    it('should parse basic arguments correctly', () => {
      const argv = ['node', 'script.js'];
      const options = parseArguments(argv);

      expect(options).toEqual({
        ignore: [],
        dryRun: false,
        verbose: false,
        applicationsDir: '/Applications'
      });
    });

    it('should parse dry-run flag', () => {
      const argv = ['node', 'script.js', '--dry-run'];
      const options = parseArguments(argv);

      expect(options.dryRun).toBe(true);
    });

    it('should parse verbose flag', () => {
      const argv = ['node', 'script.js', '--verbose'];
      const options = parseArguments(argv);

      expect(options.verbose).toBe(true);
    });

    it('should parse single ignore app', () => {
      const argv = ['node', 'script.js', '--ignore', 'Adobe Photoshop'];
      const options = parseArguments(argv);

      expect(options.ignore).toEqual(['Adobe Photoshop']);
    });

    it('should parse multiple ignore apps', () => {
      const argv = ['node', 'script.js', '--ignore', 'Adobe Photoshop', 'Microsoft Word', 'Slack'];
      const options = parseArguments(argv);

      expect(options.ignore).toEqual(['Adobe Photoshop', 'Microsoft Word', 'Slack']);
    });

    it('should parse custom applications directory', () => {
      const argv = ['node', 'script.js', '--applications-dir', '/Custom/Applications'];
      const options = parseArguments(argv);

      expect(options.applicationsDir).toBe('/Custom/Applications');
    });

    it('should parse combined options', () => {
      const argv = [
        'node', 'script.js',
        '--dry-run',
        '--verbose',
        '--ignore', 'App1', 'App2',
        '--applications-dir', '/Custom/Apps'
      ];
      const options = parseArguments(argv);

      expect(options).toEqual({
        ignore: ['App1', 'App2'],
        dryRun: true,
        verbose: true,
        applicationsDir: '/Custom/Apps'
      });
    });

    it('should handle short flags', () => {
      const argv = ['node', 'script.js', '-d', '-i', 'App1'];
      const options = parseArguments(argv);

      expect(options.dryRun).toBe(true);
      expect(options.ignore).toEqual(['App1']);
    });

    it('should trim whitespace from ignore list', () => {
      const argv = ['node', 'script.js', '--ignore', '  App1  ', '  App2  '];
      const options = parseArguments(argv);

      expect(options.ignore).toEqual(['App1', 'App2']);
    });

    it('should handle ignore flag without arguments', () => {
      const argv = ['node', 'script.js'];
      const options = parseArguments(argv);

      expect(options.ignore).toEqual([]);
    });
  });

  describe('validateEnvironment', () => {
    const originalPlatform = process.platform;
    const originalVersion = process.version;

    afterEach(() => {
      // Restore original values
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true
      });
    });

    it('should pass validation on macOS with Node.js 22+', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });
      Object.defineProperty(process, 'version', {
        value: 'v22.0.0',
        writable: true
      });

      // Should not throw
      expect(() => validateEnvironment()).not.toThrow();
    });

    it('should handle Node.js version validation', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true
      });

      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => validateEnvironment()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle non-macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      Object.defineProperty(process, 'version', {
        value: 'v22.0.0',
        writable: true
      });

      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => validateEnvironment()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle missing package.json gracefully', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const program = createProgram();
      expect(program.version()).toBe('1.0.0'); // Should fallback to default
    });

    it('should handle invalid package.json gracefully', () => {
      mockReadFileSync.mockReturnValue('invalid json');

      const program = createProgram();
      expect(program.version()).toBe('1.0.0'); // Should fallback to default
    });
  });

  describe('option validation', () => {
    it('should handle whitespace-only ignore apps', () => {
      const argv = ['node', 'script.js', '--ignore', '   '];

      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => parseArguments(argv)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});
