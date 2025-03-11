/**
 * Setup file for integration tests
 */
require('dotenv').config();
const logger = require('../src/utils/logger');

// Log information about current test environment
console.log('Integration test environment setup');

// Check for API key credentials
const hasApiKeys = process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY;
if (hasApiKeys) {
  console.log('Onshape API credentials found');
  
  // Set default auth type if not specified
  if (!process.env.ONSHAPE_AUTH_TYPE) {
    process.env.ONSHAPE_AUTH_TYPE = 'api_key';
    console.log('Using API key authentication');
  } else {
    console.log(`Using ${process.env.ONSHAPE_AUTH_TYPE} authentication`);
  }
} else {
  console.error('Onshape API credentials missing - some tests may be skipped');
}