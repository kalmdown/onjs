/**
 * Server-side debug logging utility
 * Controls console output based on environment variables
 */

/**
 * Conditional debug logger for server environment
 * @param {string} type - Type of debug message
 * @param {string} message - Debug message
 * @param {...any} args - Additional arguments to log
 */
function debugLog(type, message, ...args) {
    // Only log if the corresponding debug flag is enabled
    try {
        switch(type) {
            case 'api':
                if (process.env.DEBUG_API_CALLS === 'true') {
                    console.log('[API]', message, ...args);
                }
                break;
            case 'planes':
                if (process.env.DEBUG_CUSTOM_PLANES === 'true') {
                    console.log('[PLANES]', message, ...args);
                }
                break;
            case 'env':
                if (process.env.DEBUG_ENVIRONMENT === 'true') {
                    console.log('[ENV]', message, ...args);
                }
                break;
            case 'error':
                // Always log errors
                console.error('[ERROR]', message, ...args);
                break;
            default:
                // For any other type, check general debug flag
                if (process.env.DEBUG === 'true') {
                    console.log(`[${type.toUpperCase()}]`, message, ...args);
                }
        }
    } catch (error) {
        // If anything goes wrong with logging, don't crash the app
        console.error('Error in debugLog:', error);
    }
}

module.exports = { debugLog };