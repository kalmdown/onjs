// src/api/client_1.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');
const config = require('../../config');

/**
 * Client for making authenticated requests to the Onshape API
 */
class OnshapeClient {
  /**
   * Constructor for OnshapeClient
   * @param {Object} options - Client options
   * @param {string} options.baseUrl - Base URL for Onshape
   * @param {string} options.apiUrl - API URL including version
   * @param {AuthManager} options.authManager - Authentication manager
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || config.onshape.baseUrl;
    this.apiUrl = options.apiUrl || config.onshape.apiUrl;
    this.authManager = options.authManager;
    this.debug = options.debug || false;
    this.logger = logger.scope('OnshapeClient');
    
    if (!this.authManager) {
      throw new Error('AuthManager is required');
    }
    
    // Remove trailing slash from URLs if present
    this.baseUrl = this.baseUrl?.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    this.apiUrl = this.apiUrl?.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    
    // Validate configuration
    if (!this.baseUrl) {
      throw new Error('Base URL is required');
    }
    
    if (!this.apiUrl) {
      // Use default API URL based on base URL
      this.apiUrl = `${this.baseUrl}/api/v5`;
      this.logger.info(`Using default API URL: ${this.apiUrl}`);
    }
    
    this.logger.debug('Client initialized', {
      baseUrl: this.baseUrl,
      apiUrl: this.apiUrl,
      authMethod: this.authManager.getMethod()
    });
  }
  
  /**
   * Perform a GET request to the Onshape API
   * @param {string} path - API path
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} - API response
   */
  async get(path, options = {}) {
    return this.request('GET', path, null, options);
  }
  
  /**
   * Make a POST request
   * @param {string} path - API path
   * @param {Object} data - Request body data
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async post(path, data, options = {}) {
    return this.request('POST', path, data, options);
  }
  
  /**
   * Make a PUT request
   * @param {string} path - API path
   * @param {Object} data - Request body data
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async put(path, data, options = {}) {
    return this.request('PUT', path, data, options);
  }
  
  /**
   * Make a DELETE request
   * @param {string} path - API path
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async delete(path, options = {}) {
    return this.request('DELETE', path, null, options);
  }
  
  /**
   * Make a request to the Onshape API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object|null} data - Request body data
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null, options = {}) {
    try {
      // Make sure path has a leading slash
      const pathWithSlash = path.startsWith('/') ? path : '/' + path;
      
      // Extract query parameters from options
      const queryParams = options.params || {};
      
      // Prepare request body
      let bodyString = '';
      if (data !== null && data !== undefined) {
        bodyString = typeof data === 'string' ? data : JSON.stringify(data);
      }
      
      // Get authentication headers
      const headers = this.authManager.getAuthHeaders(
        method,
        pathWithSlash,
        queryParams,
        bodyString
      );
      
      // Add standard headers
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
      
      // Use the API base URL from configuration
      let fullUrl;
      
      // Handle different path formats
      if (path.includes('/api/')) {
        // Path already includes /api/, assume it's relative to baseUrl
        fullUrl = `${this.baseUrl}${pathWithSlash}`;
      } else if (path.startsWith('/partstudios/') || 
                 path.startsWith('/documents/') ||
                 path.startsWith('/assemblies/') ||
                 path.startsWith('/users/')) {
        // Path looks like an API path that just needs the /api prefix
        fullUrl = `${this.baseUrl}/api${pathWithSlash}`;
      } else {
        // Regular path, use apiUrl
        fullUrl = `${this.apiUrl}${pathWithSlash}`;
      }
      
      if (this.debug) {
        this.logger.debug(`API request: ${method} ${fullUrl}`, {
          headers: this._sanitizeHeadersForLogging(headers),
          queryParams,
          dataLength: bodyString ? bodyString.length : 0
        });
      }
      
      // Make the request
      const response = await axios({
        method,
        url: fullUrl,
        headers,
        data: data,
        params: queryParams,
        timeout: 30000 // 30 second timeout
      });
      
      if (this.debug) {
        this.logger.debug(`API response: ${response.status} from ${method} ${fullUrl}`, {
          dataType: typeof response.data,
          isArray: Array.isArray(response.data)
        });
      }
      
      return response.data;
    } catch (error) {
      this._handleError(error, method, path);
      
      throw new ApiError(
        error.message || 'API request failed',
        error.response?.status || 500,
        error
      );
    }
  }
  
  /**
   * Handle API errors
   * @param {Error} error - Error object from Axios
   * @param {string} method - HTTP method of the request
   * @param {string} path - API path of the request
   * @private
   */
  _handleError(error, method, path) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // outside the range of 2xx
      const statusCode = error.response.status;
      const statusText = error.response.statusText;
      const data = error.response.data;
      
      this.logger.error(`API Response Error: ${statusCode} for ${method} ${path}`, {
        statusCode,
        statusText,
        data
      });
    } else if (error.request) {
      // The request was made but no response was received
      this.logger.error(`API Request Error: No response received for ${method} ${path}`);
    } else {
      // Something happened in setting up the request
      this.logger.error(`API Error: ${error.message}`);
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