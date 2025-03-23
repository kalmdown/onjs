// src/utils/load-env.js
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Define valid log levels and their hierarchy
const LOG_LEVELS = {
    'off': -1,
    'false': -1, // Treat 'false' as 'off'
    'debug': 0,
    'info': 1,
    'warn': 2,
    'error': 3
};

// Store logging configuration
const loggingConfig = {
    GLOBAL: {
        level: 'info'  // Default level
    }
};

// Modify the initialLog object to respect log levels
const initialLog = {
    error: (msg, data) => console.error(msg, data || ''),
    warn: (msg, data) => {
        if (shouldLogLevel('GLOBAL', 'warn')) {
            console.warn(msg, data || '');
        }
    },
    info: (msg, data) => {
        if (shouldLogLevel('GLOBAL', 'info')) {
            console.info(msg, data || '');
        }
    },
    debug: (msg, data) => {
        if (shouldLogLevel('GLOBAL', 'debug')) {
            console.debug(msg, data || '');
        }
    }
};

// This will be set to the real logger later
let log = initialLog;

/**
 * Get the log level for a specific scope
 * @param {string} scope - The scope to check
 * @returns {string} - The log level for this scope
 */
function getScopeLogLevel(scope) {
    // Check for environment variables in format: SCOPE_LOGGING=level
    const envKey = `${scope}_LOGGING`.toUpperCase();
    
    if (process.env[envKey]) {
        const level = process.env[envKey].toLowerCase();
        if (LOG_LEVELS.hasOwnProperty(level)) {
            return level;
        }
    }
    
    // If this is the global scope, check GLOBAL_LOGGING directly
    if (scope === 'GLOBAL' && process.env.GLOBAL_LOGGING) {
        const level = process.env.GLOBAL_LOGGING.toLowerCase();
        if (LOG_LEVELS.hasOwnProperty(level)) {
            return level;
        }
    }
    
    // Return the configured level or the global level as fallback
    return (loggingConfig[scope] && loggingConfig[scope].level) || loggingConfig.GLOBAL.level;
}

/**
 * Set the log level for a specific scope
 * @param {string} scope - The scope to configure
 * @param {string} level - Log level (off, debug, info, warn, error)
 * @returns {boolean} - Success or failure
 */
function setScopeLogLevel(scope, level) {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
        return false;
    }
    
    // Initialize if not exists
    if (!loggingConfig[scope]) {
        loggingConfig[scope] = {
            enabled: true,
            level: level
        };
    } else {
        loggingConfig[scope].level = level;
        
        // If setting to 'off', also set enabled to false
        if (level === 'off') {
            loggingConfig[scope].enabled = false;
        } else {
            loggingConfig[scope].enabled = true;
        }
    }
    
    return true;
}

/**
 * Check if logging is enabled for a specific scope
 * @param {string} scope - The logging scope to check
 * @returns {boolean} - Whether logging is enabled for the scope
 */
function isLoggingEnabled(scope) {
  // Try exact match first
  if (loggingConfig[scope]) {
    // If level is 'off', it's disabled regardless of enabled flag
    if (loggingConfig[scope].level === 'off') {
      return false;
    }
    return loggingConfig[scope].enabled;
  }
  
  // Try case-insensitive match
  const upperScope = scope.toUpperCase();
  if (loggingConfig[upperScope]) {
    // If level is 'off', it's disabled regardless of enabled flag
    if (loggingConfig[upperScope].level === 'off') {
      return false;
    }
    return loggingConfig[upperScope].enabled;
  }
  
  // Fall back to global
  if (loggingConfig.GLOBAL.level === 'off') {
    return false;
  }
  return loggingConfig.GLOBAL.enabled;
}

/**
 * Check if a specific log level should be logged for a scope
 * @param {string} scope - The scope to check
 * @param {string} level - The log level to check
 * @returns {boolean} - Whether this level should be logged
 */
function shouldLogLevel(scope, level) {
    const scopeLevel = getScopeLogLevel(scope);
    return LOG_LEVELS[level] >= LOG_LEVELS[scopeLevel];
}

/**
 * Extract logging configuration from environment variables
 */
function extractLoggingConfig() {
    // Process global level settings first
    const globalLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    
    // Validate the level and strip any comments
    let validGlobalLevel = globalLevel.split('#')[0].trim().toLowerCase();
    if (!LOG_LEVELS.hasOwnProperty(validGlobalLevel)) {
        validGlobalLevel = 'info'; // Default to info if invalid
    }
    
    // Set global settings
    loggingConfig.GLOBAL = {
        enabled: process.env.GLOBAL_LOGGING !== 'false',
        level: validGlobalLevel
    };
    
    // Track counts for summary
    let scopeCount = 0;
    const levelCounts = {};
    
    // Process SCOPE_LOGGING=true/false settings (legacy support)
    const LOGGING_SUFFIX = '_LOGGING';
    
    // Iterate through all environment variables
    Object.keys(process.env).forEach(key => {
        if (key.endsWith(LOGGING_SUFFIX)) {
            const scope = key.slice(0, -LOGGING_SUFFIX.length);
            if (scope === 'GLOBAL') return; // Skip global, already handled
            
            const value = process.env[key].split('#')[0].trim(); // Strip comments
            
            // Initialize scope config if needed
            if (!loggingConfig[scope]) {
                loggingConfig[scope] = {
                    enabled: true,
                    level: loggingConfig.GLOBAL.level // Inherit global level initially
                };
            }
            
            // Parse the logging value - critically important to get right
            if (LOG_LEVELS.hasOwnProperty(value.toLowerCase())) {
                // Set the level if it's a valid log level string
                loggingConfig[scope].level = value.toLowerCase();
                levelCounts[value.toLowerCase()] = (levelCounts[value.toLowerCase()] || 0) + 1;
                
                // If level is 'off', also disable the scope
                loggingConfig[scope].enabled = value.toLowerCase() !== 'off';
            } else if (['false', '0', 'no', 'off'].includes(String(value).toLowerCase())) {
                // If it's a falsy value, disable the scope and set level to 'off'
                loggingConfig[scope].enabled = false;
                loggingConfig[scope].level = 'off';
                levelCounts['off'] = (levelCounts['off'] || 0) + 1;
            } else {
                // For any other value, treat as enabled but keep existing level
                loggingConfig[scope].enabled = true;
            }
            
            scopeCount++;
        }
    });

    // Only output debug information if we're in debug mode
    if (validGlobalLevel === 'debug' || process.env.DEBUG_LOGGING === 'true') {
        initialLog.debug('Final logging configuration:');
        for (const [scope, config] of Object.entries(loggingConfig)) {
            initialLog.debug(`  Scope: ${scope}, Level: ${config.level}, Enabled: ${config.enabled}`);
        }
    }

    return loggingConfig;
}

/**
 * Get all logging configuration
 * @returns {Object} - The current logging configuration
 */
function getLoggingConfig() {
    return JSON.parse(JSON.stringify(loggingConfig)); // Deep clone
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
    log.info('');
    log.info('# Logging Configuration');
    log.info('# Global log level. Options: off, debug, info, warn, error');
    log.info('LOG_LEVEL=info');
    log.info('');
    log.info('# Scope-specific log levels (override global)');
    log.info('Server_LOGGING=warn    # Set level to "warn" for Server scope');
    log.info('Auth_LOGGING=debug     # Set level to "debug" for Auth scope');
    log.info('Database_LOGGING=off   # Disable logging for Database scope');
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

    // Initialize logging configuration
    extractLoggingConfig();
    
    // Only log initialization summary at appropriate levels
    const globalLevel = process.env.GLOBAL_LOGGING?.toLowerCase() || 'info';
    if (['debug', 'info'].includes(globalLevel) || process.env.DEBUG_LOGGING === 'true') {
        log.info(`Logging configuration initialized with ${Object.keys(loggingConfig).length} scopes`);
    }

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

/**
 * Set the logger instance (called from logger.js after it's initialized)
 */
function setLogger(logger) {
    log = logger;
}

// Initialize environment
let initialized = false;
try {
    initialized = loadEnv();
} catch (error) {
    initialLog.error('Failed to initialize environment:', error.message);
    process.exit(1);
}

module.exports = {
    loadEnv,
    validateEnv,
    initialized,
    isLoggingEnabled,
    getScopeLogLevel,
    setScopeLogLevel,
    shouldLogLevel,
    getLoggingConfig,
    setLogger,
    LOG_LEVELS
};