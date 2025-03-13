/**
 * Jest configuration for integration tests
 */
module.exports = {
  // Run tests matching these patterns
  testMatch: [
    "**/*.integration.test.js"
  ],
  
  // Skip tests in node_modules
  testPathIgnorePatterns: [
    "/node_modules/"
  ],
  
  // Increase timeout for long-running tests (e.g., Python environment setup)
  testTimeout: 30000,
  
  // Show test output details
  verbose: false,
  
  // Allow test files to be detected properly
  rootDir: ".",
  
  // Use Node.js as test environment
  testEnvironment: "node",
  
  // Configure coverage collection (optional)
  collectCoverageFrom: [
    "src/**/*.js",
    "!**/node_modules/**"
  ],
  
  // Run setup files before tests
  setupFilesAfterEnv: ["./tests/setup-integration.js"],
  
  // Allow console output during tests (helpful for debugging)
  silent: false
};