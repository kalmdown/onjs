// src/utils/api-headers.js
/**
 * Utility to provide consistent API headers across the application (Server-side)
 */
const config = require('../../config');
const logger = require('./logger');

const log = logger.scope('Apis');

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
  
  // Add API key authentication if configured
  if (config.onshape.apiKey && config.onshape.secretKey) {
    // Note: Real implementation would use HMAC authentication with timestamp and nonce
    // This is just a placeholder - actual implementation depends on Onshape API requirements
    log.debug('Using API key authentication for server-side requests');
  }
  
  // Add any custom headers
  if (options && options.additionalHeaders) {
    Object.assign(headers, options.additionalHeaders);
  }
  
  return headers;
}

/**
 * Add OAuth token to headers if available
 * @param {Object} headers - Existing headers object
 * @param {String} accessToken - OAuth access token
 * @returns {Object} - Updated headers with authorization
 */
function addAuthToHeaders(headers, accessToken) {
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Creates headers for authenticated API calls
 * Used by server-side endpoints that need to call Onshape
 * @param {Object} options - Options including accessToken if available
 * @returns {Object} Headers ready for Onshape API requests
 */
function createApiHeaders(options = {}) {
  const headers = getOnshapeHeaders();
  
  if (options && options.accessToken) {
    addAuthToHeaders(headers, options.accessToken);
  }
  
  return headers;
}

module.exports = {
  getOnshapeHeaders,
  addAuthToHeaders,
  createApiHeaders
};