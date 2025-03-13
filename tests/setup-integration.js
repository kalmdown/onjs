/**
 * Setup file for integration tests
 * Overrides console methods to avoid Jest prefixes
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Store original console methods
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

// Override console.log to use process.stdout directly
console.log = (...args) => {
  process.stdout.write(args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') + '\n');
};

// Override console.info to use process.stdout directly
console.info = (...args) => {
  process.stdout.write('ℹ️ ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') + '\n');
};

// Override console.warn to use process.stderr directly
console.warn = (...args) => {
  process.stderr.write('⚠️ ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') + '\n');
};

// Override console.error to use process.stderr directly
console.error = (...args) => {
  process.stderr.write('❌ ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') + '\n');
};

console.log('Integration test environment setup');

// Load env vars with explicit path
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`);
  } else {
    console.log('Environment variables loaded successfully');
    if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
      console.log('ACCESS_KEY available:', !!process.env.ONSHAPE_ACCESS_KEY);
      console.log('SECRET_KEY available:', !!process.env.ONSHAPE_SECRET_KEY);
    } else {
      console.error('Required environment variables missing. Please check your .env file includes:');
      console.error('- ONSHAPE_ACCESS_KEY');
      console.error('- ONSHAPE_SECRET_KEY');
      console.error('Tests will likely fail without these credentials.');
    }
    
    // Ensure critical environment variables are set for all test files
    if (!process.env.ONSHAPE_AUTH_METHOD) {
      process.env.ONSHAPE_AUTH_METHOD = 'api_key';
      console.log('Setting default ONSHAPE_AUTH_METHOD to: api_key');
    }
    
    if (!process.env.ONSHAPE_API_URL) {
      process.env.ONSHAPE_API_URL = 'https://cad.onshape.com/api/v6';
      console.log('Setting default ONSHAPE_API_URL to: https://cad.onshape.com/api/v6');
    }
  }
} else {
  console.error('Onshape API credentials missing - .env file not found');
  console.error('Integration tests will fail. Please create a .env file in the project root.');
}

// Add global Jest timeout for API operations
jest.setTimeout(45000);

// Make Jest fail fast on missing credentials
beforeAll(() => {
  if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
    throw new Error(
      'Integration tests require Onshape API credentials.\n' +
      'Please set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY in your .env file.'
    );
  }
});

// Restore original methods when tests are done
afterAll(() => {
  console.log = originalLog;
  console.info = originalInfo;
  console.warn = originalWarn;
  console.error = originalError;
});