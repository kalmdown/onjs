// public/js/utils/api-headers.js
/**
 * Client-side utility to create API headers
 */
import { getToken, getAuthMethod } from '../clientAuth.js';
import { logDebug } from './logging.js';

/**
 * Creates API headers with appropriate authentication
 * 
 * @param {Object} [options] - Options for header creation
 * @param {boolean} [options.includeAuth=true] - Whether to include authentication headers
 * @param {boolean} [options.includeContentType=true] - Whether to include Content-Type header
 * @returns {Object} Headers object for fetch API
 */
export function createApiHeaders(options = {}) {
  const includeAuth = options.includeAuth !== false;
  const includeContentType = options.includeContentType !== false;
  
  const headers = {};
  
  // Add Content-Type by default
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add authentication headers if needed
  if (includeAuth) {
    const authMethod = getAuthMethod();
    const token = getToken();
    
    if (token) {
      if (authMethod === 'oauth') {
        headers['Authorization'] = `Bearer ${token}`;
        logDebug('Added OAuth token to request headers');
      } else if (authMethod === 'apikey') {
        // API key authentication would typically use different headers
        // This depends on your specific implementation
        logDebug('Using API key authentication method');
      }
    }
  }
  
  return headers;
}

/**
 * Creates headers specifically for Onshape API calls
 * @param {Object} [options] - Additional options
 * @returns {Object} Headers for Onshape API
 */
export function createOnshapeHeaders(options = {}) {
  const headers = createApiHeaders(options);
  
  // Add Onshape-specific headers
  headers['accept'] = 'application/json;charset=UTF-8; qs=0.09';
  
  return headers;
}