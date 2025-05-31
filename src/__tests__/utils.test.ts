/**
 * Tests for utility functions
 */

import {
  normalizeAppName,
  extractAppName,
  isValidBrewPackageName,
  isValidAppName,
  colorize,
  formatList,
  parseCommandOutput,
  isEmpty,
  capitalize,
  pluralize,
  formatDuration,
  createProgressBar,
  truncate,
  groupBy,
  uniqueBy
} from '../utils.ts';
import { COLORS } from '../constants.ts';

describe('Utility Functions', () => {
  describe('normalizeAppName', () => {
    it('should convert to lowercase and replace spaces with hyphens', () => {
      expect(normalizeAppName('Google Chrome')).toBe('google-chrome');
      expect(normalizeAppName('Visual Studio Code')).toBe('visual-studio-code');
      expect(normalizeAppName('1Password 7')).toBe('1password-7');
    });

    it('should remove invalid characters', () => {
      expect(normalizeAppName('App (Beta)')).toBe('app-beta');
      expect(normalizeAppName('App & Tool')).toBe('app-tool');
      expect(normalizeAppName('App@Home')).toBe('apphome');
    });

    it('should handle edge cases', () => {
      expect(normalizeAppName('')).toBe('');
      expect(normalizeAppName('   ')).toBe('');
      expect(normalizeAppName('---App---')).toBe('app');
    });
  });

  describe('extractAppName', () => {
    it('should extract app name from .app bundle path', () => {
      expect(extractAppName('/Applications/Google Chrome.app')).toBe('Google Chrome');
      expect(extractAppName('/Applications/Utilities/Terminal.app')).toBe('Terminal');
      expect(extractAppName('Xcode.app')).toBe('Xcode');
    });

    it('should handle paths without .app extension', () => {
      expect(extractAppName('/Applications/SomeFolder')).toBe('SomeFolder');
      expect(extractAppName('')).toBe('');
    });
  });

  describe('isValidBrewPackageName', () => {
    it('should validate correct package names', () => {
      expect(isValidBrewPackageName('google-chrome')).toBe(true);
      expect(isValidBrewPackageName('visual-studio-code')).toBe(true);
      expect(isValidBrewPackageName('node')).toBe(true);
      expect(isValidBrewPackageName('1password')).toBe(true);
    });

    it('should reject invalid package names', () => {
      expect(isValidBrewPackageName('')).toBe(false);
      expect(isValidBrewPackageName('invalid name')).toBe(false);
      expect(isValidBrewPackageName('invalid@name')).toBe(false);
      expect(isValidBrewPackageName('-invalid')).toBe(false);
    });
  });

  describe('isValidAppName', () => {
    it('should validate correct app names', () => {
      expect(isValidAppName('Google Chrome')).toBe(true);
      expect(isValidAppName('Xcode')).toBe(true);
      expect(isValidAppName('1Password 7')).toBe(true);
    });

    it('should reject invalid app names', () => {
      expect(isValidAppName('')).toBe(false);
      expect(isValidAppName('   ')).toBe(false);
      expect(isValidAppName('app/with/slash')).toBe(false);
    });
  });

  describe('colorize', () => {
    it('should add color codes to text', () => {
      const result = colorize('test', 'RED');
      expect(result).toBe(`${COLORS.RED}test${COLORS.RESET}`);
    });

    it('should work with different colors', () => {
      expect(colorize('info', 'BLUE')).toContain(COLORS.BLUE);
      expect(colorize('warning', 'YELLOW')).toContain(COLORS.YELLOW);
      expect(colorize('error', 'RED')).toContain(COLORS.RED);
    });
  });

  describe('formatList', () => {
    it('should format array as bulleted list', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = formatList(items);
      expect(result).toBe('  • item1\n  • item2\n  • item3');
    });

    it('should use custom indent', () => {
      const items = ['item1'];
      const result = formatList(items, '    ');
      expect(result).toBe('    • item1');
    });

    it('should handle empty array', () => {
      expect(formatList([])).toBe('');
    });
  });

  describe('parseCommandOutput', () => {
    it('should split output into lines and filter empty ones', () => {
      const output = 'line1\nline2\n\nline3\n';
      const result = parseCommandOutput(output);
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should trim whitespace', () => {
      const output = '  line1  \n  line2  \n';
      const result = parseCommandOutput(output);
      expect(result).toEqual(['line1', 'line2']);
    });
  });

  describe('isEmpty', () => {
    it('should detect empty or whitespace strings', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should detect non-empty strings', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty(' text ')).toBe(false);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('HELLO');
      expect(capitalize('')).toBe('');
    });
  });

  describe('pluralize', () => {
    it('should pluralize based on count', () => {
      expect(pluralize('app', 1)).toBe('app');
      expect(pluralize('app', 2)).toBe('apps');
      expect(pluralize('app', 0)).toBe('apps');
    });

    it('should use custom suffix', () => {
      expect(pluralize('child', 2, 'ren')).toBe('children');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1s');
      expect(formatDuration(65000)).toBe('1m 5s');
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar', () => {
      const bar = createProgressBar(5, 10, 10);
      expect(bar).toContain('[');
      expect(bar).toContain(']');
      expect(bar).toContain('50%');
      expect(bar).toContain('(5/10)');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('short', 10)).toBe('short');
    });
  });

  describe('groupBy', () => {
    it('should group items by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];
      const grouped = groupBy(items, item => item.type);
      expect(grouped['a']).toHaveLength(2);
      expect(grouped['b']).toHaveLength(1);
    });
  });

  describe('uniqueBy', () => {
    it('should remove duplicates by key function', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' }
      ];
      const unique = uniqueBy(items, item => item.id);
      expect(unique).toHaveLength(2);
      expect(unique[0]!.name).toBe('a');
      expect(unique[1]!.name).toBe('b');
    });
  });
});
