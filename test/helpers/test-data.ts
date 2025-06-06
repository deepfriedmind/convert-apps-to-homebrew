/**
 * Test data and fixtures for testing
 */

import type { AppChoice, AppInfo, BrewCommandResult, OperationSummary } from '../../src/types.ts'

/**
 * Sample application information for testing
 */
export const sampleAppInfo: AppInfo = {
  alreadyInstalled: false,
  appPath: '/Applications/Sample App.app',
  brewName: 'sample-app',
  brewType: 'cask',
  originalName: 'Sample App',
  status: 'available',
}

/**
 * Sample app choice for testing prompts
 */
export const sampleAppChoice: AppChoice = {
  checked: false,
  name: 'Sample App (Cask)',
  value: sampleAppInfo,
}

/**
 * Sample Homebrew command result for successful operation
 */
export const successfulBrewResult: BrewCommandResult = {
  exitCode: 0,
  stderr: '',
  stdout: 'sample-app: Sample App description',
  success: true,
}

/**
 * Sample Homebrew command result for failed operation
 */
export const failedBrewResult: BrewCommandResult = {
  exitCode: 1,
  stderr: 'Error: No such cask exists',
  stdout: '',
  success: false,
}

/**
 * Sample operation summary
 */
export const sampleOperationSummary: OperationSummary = {
  alreadyInstalled: 0,
  availableApps: 3,
  dryRun: true,
  failed: 0,
  ignored: 0,
  installed: 0,
  selected: 2,
  totalApps: 5,
  unavailable: 2,
}

/**
 * Mock application directory structure
 */
export const mockApplications = [
  'Google Chrome.app',
  'Firefox.app',
  'Visual Studio Code.app',
  'Spotify.app',
  'Slack.app',
]

/**
 * Mock Homebrew package names that exist
 */
export const existingBrewPackages = [
  'google-chrome',
  'firefox',
  'visual-studio-code',
  'spotify',
]

/**
 * Mock Homebrew package names that don't exist
 */
export const nonExistentBrewPackages = [
  'non-existent-app',
  'fake-application',
]

/**
 * Sample directory paths for testing
 */
export const testPaths = {
  applications: '/tmp/test-applications',
  nonExistent: '/tmp/non-existent-directory',
  restricted: '/private/var/root',
}
