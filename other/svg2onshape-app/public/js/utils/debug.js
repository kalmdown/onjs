/**
 * Client-side debug logging utility
 * Controls console output based on configuration
 * 
 * @version 1.0.0
 * @module debug
 */
import appConfig from '/js/appConfig.js';

// Module constants
const VERSION = '1.0.0';
const ENVIRONMENT = 'client';

/**
 * Get debug configuration from appConfig
 * @returns {Object} Debug configuration
 */
function getDebugConfig() {
    return appConfig?.debug || {
        enabled: false,
        DEBUG: false,
        DEBUG_API_CALLS: false,
        DEBUG_PLANES: false,
        DEBUG_UI: false
    };
}

/**
 * Client-side debug logger
 * @param {string} component - Component name or type ('api', 'planes', 'error', etc.)
 * @param {string} message - Debug message
 * @param {...any} args - Additional arguments to log
 */
export function debugLog(component, message, ...args) {
    try {
        const debugConfig = getDebugConfig();
        
        // Determine if we should log based on component type
        let shouldLog = false;
        
        switch(component.toLowerCase()) {
            case 'api':
                shouldLog = debugConfig.DEBUG_API_CALLS || debugConfig.enabled;
                break;
            case 'planes':
                shouldLog = debugConfig.DEBUG_PLANES || debugConfig.enabled;
                break;
            case 'error':
                // Always log errors
                shouldLog = true;
                break;
            default:
                // For any other type, check general debug flag
                shouldLog = debugConfig.enabled || debugConfig.DEBUG;
                break;
        }
        
        if (shouldLog) {
            const timestamp = new Date().toISOString();
            const debugMessage = args.length > 0 ? 
                `[${timestamp}] [${component}] ${message}` : 
                `[${timestamp}] [${component}] ${message}`;

            if (component.toLowerCase() === 'error') {
                console.error(debugMessage, ...args);
            } else {
                console.log(debugMessage, ...args);
            }
        }
    } catch (error) {
        // If logging fails, log the error but don't interrupt the app
        console.error('[DEBUG:ERROR]', 'Error in debug logger:', error);
    }
}

// Add version and environment info for debugging
debugLog.version = VERSION;
debugLog.environment = ENVIRONMENT;

export default debugLog;