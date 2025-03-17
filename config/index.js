require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Use try-catch to handle potential import errors
let logger;
let loadEnv;
let initialized = false;

try {
  logger = require('../src/utils/logger');
} catch (error) {
  console.error('Failed to import logger, using console as fallback:', error.message);
  // Create console fallback
  logger = {
    scope: () => ({
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    })
  };
}

try {
  const loadEnvModule = require('../src/utils/load-env');
  loadEnv = loadEnvModule.loadEnv;
  initialized = loadEnvModule.initialized;
} catch (error) {
  console.error('Failed to import load-env module:', error.message);
}

const log = logger.scope('Config');

if (!initialized) {
  log.warn('Environment not initialized via load-env, using direct validation');
}

// Check for .env file
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  log.warn('Warning: .env file not found at: ' + envPath);
  log.warn('Please create an .env file with required configuration.');
  log.warn('See .env.example for required variables.');
}

// Define environment variables with validation
function env(key, required = false, defaultVal) {
  const value = process.env[key];
  
  if (value === undefined) {
    if (required) {
      const errorMsg = `Required environment variable ${key} is missing`;
      log.error(errorMsg);
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(errorMsg);
      }
    }
    
    if (defaultVal !== undefined) {
      // Set the environment variable to the default value
      // so it's available for other parts of the application
      process.env[key] = defaultVal;
      return defaultVal;
    }
  }
  
  return value;
}

// Set defaults for non-critical values
env('SESSION_NAME', false, 'onshape-session');
env('NODE_ENV', false, 'development');
env('PORT', false, '3000');
env('ONSHAPE_OAUTH_SCOPE', false, 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete');

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
      scope: process.env.ONSHAPE_OAUTH_SCOPE
    },
    apiKey: {
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    }
  },
  session: {
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000')
  },
  server: {
    port: parseInt(process.env.PORT),
    env: process.env.NODE_ENV,
    webhookCallbackRoot: process.env.WEBHOOK_CALLBACK_ROOT_URL
  },
  logging: {
    enabled: process.env.LOG_SERVER !== 'false'
  }
};

module.exports = config;