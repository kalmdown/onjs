/**
 * Jest configuration for integration tests
 */
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.js'],
  testTimeout: 45000, // Longer timeout for API operations
  testMatch: ['**/*.integration.test.js'], // Only run files with .integration.test.js
};