require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('../src/utils/logger');
const { loadEnv, initialized } = require('../src/utils/load-env');

const log = logger.scope('Config');

if (!initialized) {
  log.error('Environment not properly initialized');
  process.exit(1);
}

// Check for .env file
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: .env file not found at: ' + envPath);
  console.warn('\x1b[33m%s\x1b[0m', 'Please create an .env file with required configuration.');
  console.warn('\x1b[33m%s\x1b[0m', 'See .env.example for required variables.');
}

// Define environment variables with validation
function env(key, required = false) {
  const value = process.env[key];
  
  if (required && value === undefined) {
    const errorMsg = `Required environment variable ${key} is missing`;
    console.error('\x1b[31m%s\x1b[0m', errorMsg);
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    }
  }
  
  return value;
}

// Check auth-specific required variables based on selected auth method
const authMethod = (env('ONSHAPE_AUTH_METHOD') || 'oauth').toLowerCase();
if (authMethod === 'oauth') {
  env('OAUTH_CLIENT_ID', true);
  env('OAUTH_CLIENT_SECRET', true);
} else if (authMethod === 'apikey' || authMethod === 'api_key') {
  env('ONSHAPE_ACCESS_KEY', true);
  env('ONSHAPE_SECRET_KEY', true);
}

// In production, always require session secret
if (process.env.NODE_ENV === 'production') {
  env('SESSION_SECRET', true);
}

/**
 * @typedef {Object} Config
 * @property {Object} onshape - Onshape configuration
 * @property {Object} session - Session configuration
 * @property {Object} server - Server configuration
 */

/** @type {Config} */
const config = {
  onshape: {
    baseUrl: process.env.ONSHAPE_BASE_URL,
    apiUrl: process.env.ONSHAPE_API_URL || process.env.ONSHAPE_BASE_URL,
    authMethod: process.env.ONSHAPE_AUTH_METHOD?.toLowerCase(),
    oauth: {
      url: process.env.OAUTH_URL,
      callbackUrl: process.env.OAUTH_CALLBACK_URL,
      scope: 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete'
    },
    apiKey: {
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    }
  },
  session: {
    name: process.env.SESSION_NAME || 'onshape-session',
    secret: process.env.SESSION_SECRET,
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    webhookCallbackRoot: process.env.WEBHOOK_CALLBACK_ROOT_URL
  },
  logging: {
    enabled: process.env.LOG_SERVER !== 'false'
  }
};

module.exports = config;