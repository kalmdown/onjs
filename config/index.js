// config/index.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');

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

// Export configuration object that purely reflects environment variables
module.exports = {
  // Allow dynamic configuration access via environment variables
  env,
  
  // Basic app configuration
  port: parseInt(env('PORT') || '3000'),
  
  // Onshape API configuration
  onshape: {
    baseUrl: env('BASE_URL') || 'https://cad.onshape.com/',
    apiUrl: env('API_URL') || 'https://cad.onshape.com/api/v10',
    oauthUrl: env('OAUTH_URL') || 'https://oauth.onshape.com',
    clientId: env('OAUTH_CLIENT_ID'),
    clientSecret: env('OAUTH_CLIENT_SECRET'),
    callbackUrl: env('OAUTH_CALLBACK_URL'),
    scope: env('ONSHAPE_OAUTH_SCOPE'),
    
    // OAuth endpoints
    get authorizationURL() {
      return `${this.oauthUrl}/oauth/authorize`;
    },
    get tokenURL() {
      return `${this.oauthUrl}/oauth/token`;
    },
    
    // Camel case variants for compatibility
    get authorizationUrl() {
      return this.authorizationURL;
    },
    get tokenUrl() {
      return this.tokenURL;
    }
  },
  
  // Top-level OAuth URLs for middleware compatibility
  get authorizationURL() {
    return this.onshape.authorizationURL;
  },
  get tokenURL() {
    return this.onshape.tokenURL;
  },
  
  // Session configuration
  session: {
    name: env('SESSION_NAME') || 'onshape-session',
    secret: env('SESSION_SECRET') || (process.env.NODE_ENV !== 'production' ? 'dev-secret-do-not-use-in-production' : undefined),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: (env('SESSION_SECURE') === 'true') || process.env.NODE_ENV === 'production',
      maxAge: parseInt(env('SESSION_MAX_AGE') || (24 * 60 * 60 * 1000).toString()),
    },
  },
  
  // Webhook configuration
  webhook: {
    callbackRootUrl: env('WEBHOOK_CALLBACK_ROOT_URL'),
  },
  
  // Auth configuration
  auth: {
    defaultMethod: authMethod,
    unitSystem: env('ONSHAPE_UNIT_SYSTEM') || 'inch',
  }
};