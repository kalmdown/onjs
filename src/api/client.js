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
  
  /**
   * Make a request to the Onshape API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object|null} data - Request body data
   * @param {Object} [queryParams={}] - URL query parameters
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null, queryParams = {}) {
    const axios = require('axios');
    const { ApiError } = require('../utils/errors');
    
    try {
      // Make sure path has a leading slash
      const pathWithSlash = path.startsWith('/') ? path : '/' + path;
      
      // Ensure API version prefix if needed
      let apiPath = pathWithSlash;
      if (!pathWithSlash.includes('/api/v')) {
        apiPath = '/api/v6' + pathWithSlash;
        this.logger.debug(`Adjusted API path to include version: ${apiPath}`);
      }
      
      // Get authentication headers
      let headers = {};
      try {
        headers = this.authManager.getAuthHeaders(
          method,
          apiPath,
          queryParams
        );
      } catch (authError) {
        this.logger.error(`Auth header generation failed: ${authError.message}`);
        throw new ApiError(`Authentication header generation failed: ${authError.message}`, 401);
      }
      
      // Add standard headers if not already present
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json,application/vnd.onshape.v6+json',
        ...headers
      };
      
      // Debug logging
      this.logger.debug(`${method} ${apiPath}`, {
        baseUrl: this.baseUrl,
        fullUrl: `${this.baseUrl}${apiPath}`,
        authType: headers.Authorization ? headers.Authorization.split(' ')[0] : 'none'
      });
      
      // Make the request
      const response = await axios({
        method,
        url: `${this.baseUrl}${apiPath}`,
        headers: requestHeaders,
        data,
        params: queryParams
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`API request failed: ${error.message}`);
      
      // Enhanced error info
      if (error.response) {
        this.logger.error(`Status: ${error.response.status}, Message: ${error.response.data?.message || 'Unknown'}`);
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