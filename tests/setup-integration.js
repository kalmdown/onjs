/**
 * Setup file for integration tests
 */
require('dotenv').config();

// Log information about current test environment
console.log('Integration test environment setup');

// Check if API credentials are available
if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
  console.warn('WARNING: Missing Onshape API credentials. Integration tests will be skipped.');
  console.warn('Create a .env file with ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY.');
} else {
  console.log('Onshape API credentials found');
}