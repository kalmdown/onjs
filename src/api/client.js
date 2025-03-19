// src\api\client.js
const axios = require('axios');
const logger = require('../utils/logger');
const RestClient = require('./rest-client');
const DocumentsApi = require('./endpoints/documents');

/**
 * Client for making authenticated requests to the Onshape API
 */
class OnshapeClient {
  /**
   * Create a new OnshapeClient
   * @param {Object} options - Client options
   * @param {string} options.baseUrl - The Onshape API base URL
   * @param {Object} options.authManager - The authentication manager instance
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options) {
    const logger = require('../utils/logger');
    
    // Validate required options
    if (!options) {
      throw new Error('OnshapeClient options are required');
    }
    
    if (!options.baseUrl) {
      throw new Error('baseUrl is required for OnshapeClient');
    }
    
    if (!options.authManager) {
      throw new Error('authManager is required for OnshapeClient');
    }
    
    // Initialize properties
    this.baseUrl = options.baseUrl;
    this.authManager = options.authManager;
    this.debug = !!options.debug;
    this.logger = logger.scope('OnshapeClient');
    
    // Ensure baseUrl doesn't end with a trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    this.logger.debug(`OnshapeClient initialized with baseUrl: ${this.baseUrl}`);
  }
  
  /**
   * Make a GET request
   * @param {string} path - API path
   * @param {Object} [options={}] - Request options
   * @param {Object} [options.params={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(path, options = {}) {
    return this.request('GET', path, null, options.params || {});
  }
  
  /**
   * Make a POST request
   * @param {string} path - API path
   * @param {Object} data - Request body data
   * @param {Object} [options={}] - Request options
   * @param {Object} [options.params={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async post(path, data, options = {}) {
    return this.request('POST', path, data, options.params || {});
  }
  
  /**
   * Make a PUT request
   * @param {string} path - API path
   * @param {Object} data - Request body data
   * @param {Object} [options={}] - Request options
   * @param {Object} [options.params={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async put(path, data, options = {}) {
    return this.request('PUT', path, data, options.params || {});
  }
  
  /**
   * Make a DELETE request
   * @param {string} path - API path
   * @param {Object} [options={}] - Request options
   * @param {Object} [options.params={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async delete(path, options = {}) {
    return this.request('DELETE', path, null, options.params || {});
  }
  
  /**
   * Make a PATCH request
   * @param {string} path - API path
   * @param {Object} data - Request body data
   * @param {Object} [options={}] - Request options
   * @param {Object} [options.params={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async patch(path, data, options = {}) {
    return this.request('PATCH', path, data, options.params || {});
  }
  
  // Update the request method to use the API version from config

  /**
   * Make a request to the Onshape API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object|null} data - Request body data
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null, options = {}) {
    const axios = require('axios');
    const { ApiError } = require('../utils/errors');
    const config = require('../../config'); // Updated path to the correct location
    
    try {
      // Make sure path has a leading slash
      const pathWithSlash = path.startsWith('/') ? path : '/' + path;
      
      // Extract query parameters from options
      const queryParams = options.params || {};
      
      // Use the API base URL from configuration
      const baseApiUrl = config.onshape.apiUrl || this.baseUrl;
      
      // Build the full URL - don't try to parse or modify the API URL
      const fullUrl = baseApiUrl.endsWith('/') 
        ? `${baseApiUrl.slice(0, -1)}${pathWithSlash}` 
        : `${baseApiUrl}${pathWithSlash}`;
      
      // Format request body
      let bodyString = '';
      if (data !== null && data !== undefined) {
        bodyString = typeof data === 'string' ? data : JSON.stringify(data);
      }
      
      // Get authentication headers - need to use the full path for auth
      let headers;
      try {
        headers = this.authManager.getAuthHeaders(
          method,
          pathWithSlash,
          queryParams,
          bodyString
        );
      } catch (authError) {
        this.logger.error(`Failed to generate auth headers: ${authError.message}`);
        throw new ApiError(`Authentication error: ${authError.message}`, 401);
      }
      
      // Add standard headers if not already present
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      };
      
      // Debug logging with sanitized headers
      this.logger.debug(`${method} ${pathWithSlash}`, {
        baseUrl: baseApiUrl,
        fullUrl: fullUrl,
        queryParamsCount: Object.keys(queryParams).length,
        hasAuth: !!requestHeaders.Authorization
      });
      
      // Make the request using the full URL directly
      const response = await axios({
        method,
        url: fullUrl,
        headers: requestHeaders,
        data: data,
        params: queryParams,
        timeout: 30000 // 30 second timeout
      });
      
      return response.data;
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        this.logger.error(`API Response Error: ${error.response.status} for ${method} ${path}`, {
          statusCode: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        this.logger.error(`API Request Error: No response received for ${method} ${path}`);
      } else {
        this.logger.error(`API Error during request setup: ${error.message}`);
      }
      
      throw new ApiError(
        error.message || 'API request failed',
        error.response?.status || 500,
        error
      );
    }
  }
  
  /**
   * Helper method to sanitize headers for logging (hide sensitive values)
   * @private
   */
  _sanitizeHeadersForLogging(headers) {
    const result = {};
    for (const key in headers) {
      if (key.toLowerCase() === 'authorization') {
        // Show auth type but hide the actual token
        const value = headers[key] || '';
        const parts = value.split(' ');
        if (parts.length > 1) {
          result[key] = `${parts[0]} ...`;
        } else {
          result[key] = '...';
        }
      } else {
        result[key] = headers[key];
      }
    }
    return result;
  }
}

module.exports = OnshapeClient;