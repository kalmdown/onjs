// src/utils/route-tracker.js
/**
 * Simple utility to track route initialization to prevent duplicates
 */
const logger = require('./logger');
const log = logger.scope('RouteTracker');

// Track which routes have been initialized
const initializedRoutes = new Set();

/**
 * Check if a route has been initialized
 * @param {string} routeName - Unique name for the route
 * @returns {boolean} - Whether the route has already been initialized
 */
function isRouteInitialized(routeName) {
  return initializedRoutes.has(routeName);
}

/**
 * Mark a route as initialized
 * @param {string} routeName - Unique name for the route
 * @param {string} [source] - Source file that initialized the route
 */
function markRouteInitialized(routeName, source = getCallerInfo()) {
  initializedRoutes.add(routeName);
  log.debug(`Route "${routeName}" marked as initialized by ${source}`);
}

/**
 * Initialize a route only if it hasn't been initialized before
 * @param {string} routeName - Unique name for the route 
 * @param {Function} initFunction - Function to call to initialize the route
 * @param {string} [source] - Source of the initialization
 * @returns {boolean} - Whether the route was initialized in this call
 */
function initializeRouteOnce(routeName, initFunction, source = getCallerInfo()) {
  if (isRouteInitialized(routeName)) {
    log.debug(`Route "${routeName}" already initialized, skipping initialization from ${source}`);
    return false;
  }
  
  initFunction();
  markRouteInitialized(routeName, source);
  return true;
}

/**
 * Get information about the caller of a function
 * @returns {string} - File and line number info of the caller
 */
function getCallerInfo() {
  const stackLines = new Error().stack.split('\n');
  
  // Skip the first two lines (Error and getCallerInfo function call)
  // and look for the first line that contains a file path
  for (let i = 2; i < stackLines.length; i++) {
    const line = stackLines[i].trim();
    if (line.includes('(')) {
      const match = line.match(/\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [_, filePath, lineNum] = match;
        const shortPath = filePath.split('\\').slice(-3).join('\\');
        return `${shortPath}:${lineNum}`;
      }
    }
  }
  
  return 'unknown source';
}

/**
 * Get all initialized routes (for debugging)
 * @returns {Object} Map of initialized routes
 */
function _getInitializedRoutes() {
  return Array.from(initializedRoutes).reduce((acc, route) => {
    acc[route] = true;
    return acc;
  }, {});
}

module.exports = {
  isRouteInitialized,
  markRouteInitialized,
  initializeRouteOnce,
  _getInitializedRoutes
};