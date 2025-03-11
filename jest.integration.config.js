/**
 * Jest configuration for integration tests
 */
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,  // Inherit from base config
  setupFilesAfterEnv: [
    ...(baseConfig.setupFilesAfterEnv || []),
    '<rootDir>/tests/setup-integration.js'
  ],
  testTimeout: 45000, // Longer timeout for API operations
  testMatch: ['**/*.integration.test.js'], // Only run files with .integration.test.js
};