/**
 * Utility to provide consistent API headers across the application
 */
const logger = require('./logger');

const log = logger.scope('ApiHeaders');

/**
 * Generate consistent Onshape API headers
 * @param {Object} options - Optional header customizations
 * @returns {Object} - Headers object for Onshape API requests
 */
function getOnshapeHeaders(options = {}) {
  const headers = {
    'accept': 'application/json;charset=UTF-8; qs=0.09',
    'Content-Type': 'application/json'
  };
  
  // Add any custom headers
  if (options && options.additionalHeaders) {
    Object.assign(headers, options.additionalHeaders);
  }
  
  return headers;
}

module.exports = {
  getOnshapeHeaders
};