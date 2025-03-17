const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Initialize logger with fallback
let log;
try {
    const logger = require('./logger');
    log = logger.scope('EnvLoader');
} catch (error) {
    // Fallback to console if logger fails to load
    log = {
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };
    log.error('Failed to initialize logger:', error.message);
}

/**
 * Validate environment configuration
 */
function validateEnv() {
    const authMethod = (process.env.ONSHAPE_AUTH_METHOD || 'oauth').toLowerCase();
    const errors = [];

    // Common required variables
    const commonVars = [
        'ONSHAPE_BASE_URL',
        'SESSION_SECRET'
    ];

    // Auth-specific required variables
    const authVars = authMethod === 'apikey' 
        ? ['ONSHAPE_ACCESS_KEY', 'ONSHAPE_SECRET_KEY']
        : ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_CALLBACK_URL'];

    // Check common variables
    commonVars.forEach(varName => {
        if (!process.env[varName]) {
            errors.push(`Missing required variable: ${varName}`);
        }
    });

    // Check auth-specific variables
    authVars.forEach(varName => {
        if (!process.env[varName]) {
            errors.push(`Missing ${authMethod} auth variable: ${varName}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Show configuration example
 */
function showConfigExample() {
    log.info('Example .env configuration:');
    log.info('------------------------');
    log.info('# Authentication Method (oauth or apikey)');
    log.info('ONSHAPE_AUTH_METHOD=apikey');
    log.info('');
    log.info('# API Key Authentication');
    log.info('ONSHAPE_ACCESS_KEY=your_access_key');
    log.info('ONSHAPE_SECRET_KEY=your_secret_key');
    log.info('');
    log.info('# OAuth Authentication');
    log.info('OAUTH_CLIENT_ID=your_client_id');
    log.info('OAUTH_CLIENT_SECRET=your_client_secret');
    log.info('OAUTH_CALLBACK_URL=http://localhost:3000/oauth/callback');
    log.info('');
    log.info('# Common Configuration');
    log.info('ONSHAPE_BASE_URL=https://cad.onshape.com');
    log.info('SESSION_SECRET=your_session_secret');
    log.info('------------------------');
}

/**
 * Load and validate environment configuration
 */
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
        log.error(`No .env file found at: ${envPath}`);
        log.error('Please create a .env file with your configuration.');
        showConfigExample();
        throw new Error('Missing .env file');
    }

    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
        log.error('Error loading .env file:', result.error);
        throw result.error;
    }

    log.info('Environment variables loaded successfully');

    // Validate configuration
    const { isValid, errors } = validateEnv();
    
    if (!isValid) {
        errors.forEach(error => log.error(error));
        showConfigExample();
        throw new Error('Invalid environment configuration');
    }

    const authMethod = process.env.ONSHAPE_AUTH_METHOD || 'oauth';
    log.info(`Using ${authMethod} authentication`);
    
    return true;
}

// Initialize environment
let initialized = false;
try {
    initialized = loadEnv();
} catch (error) {
    log.error('Failed to initialize environment:', error.message);
    process.exit(1);
}

module.exports = {
    loadEnv,
    validateEnv,
    initialized
};