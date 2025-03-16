// src\api\rest-client.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');
const config = require('../../config');

/**
 * REST API client for Onshape
 */
class RestClient {
  /**
   * Create a new REST client
   * @param {Object} options - Client options
   * @param {Object} options.authManager - Authentication manager instance
   * @param {string} [options.baseUrl] - API base URL
   * @param {boolean} [options.debug=false] - Enable debug mode
   */
  constructor(options = {}) {
    this.authManager = options.authManager;
    
    if (!this.authManager) {
      throw new Error('Authentication manager is required');
    }
    
    this.baseUrl = options.baseUrl || config.onshape.baseUrl;
    this.debug = options.debug || process.env.API_DEBUG === 'true';
    this.logger = logger.scope('RestClient');
    
    // Remove trailing slash from base URL if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    this.logger.info(`Initialized with base URL: ${this.baseUrl}`);
  }
  
  /**
   * Make a request to the Onshape API
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - API path
   * @param {Object|null} data - Request body data
   * @param {Object} queryParams - Query parameters
   * @param {Object} options - Additional axios request options
   * @returns {Promise<Object>} API response
   */
  async request(method, path, data = null, queryParams = {}, options = {}) {
    try {
      // Make sure path has a leading slash
      const pathWithSlash = path.startsWith('/') ? path : '/' + path;
      
      // Ensure API version prefix if needed
      // Onshape API requires paths to be in format: /api/v5/resource
      let cleanPath = pathWithSlash;
      if (!pathWithSlash.includes('/api/v')) {
        // If path doesn't already contain an API version, add the default version (v5)
        cleanPath = cleanPath.startsWith('/api/') ? 
          cleanPath : 
          '/api/v5' + (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath);
        
        this.logger.debug(`Adjusted API path to include version: ${cleanPath}`);
      }

      // Format data for consistency
      let bodyString = '';
      if (data !== null && data !== undefined) {
        bodyString = typeof data === 'string' ? data : JSON.stringify(data);
      }

      // Get authentication headers
      const headers = await this.authManager.getAuthHeaders(
        method, 
        cleanPath, 
        queryParams, 
        bodyString
      );
      
      // Add additional headers that may help
      headers['Accept'] = 'application/json,application/vnd.onshape.v5+json';
      
      // Debugging info
      if (this.debug) {
        this.logger.debug(`${method} ${cleanPath}`, {
          hasBody: !!bodyString,
          bodySize: bodyString ? bodyString.length : 0,
          queryParams: Object.keys(queryParams),
          headers: this._sanitizeHeadersForLogging(headers)
        });
      } else {
        this.logger.debug(`${method} ${cleanPath}`);
      }

      // Make the request
      const response = await axios({
        method,
        url: `${this.baseUrl}${cleanPath}`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json,application/vnd.onshape.v5+json',
          ...headers
        },
        data: bodyString || undefined,
        params: queryParams,
        ...options
      });

      return response.data;
    } catch (error) {
      // Handle auth token expiration - try to refresh once
      if (error.response?.status === 401 && 
          this.authManager.getMethod() === 'oauth' && 
          this.authManager.refreshToken) {
        // Existing token refresh logic...
      }

      // Log detailed error information
      if (error.response) {
        this.logger.error(`API Response Error: ${error.response.status} for ${method} ${path}`, {
          statusCode: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          method,
          path
        });
      } else if (error.request) {
        this.logger.error(`API Request Error: No response received for ${method} ${path}`, {
          method,
          path
        });
      } else {
        this.logger.error(`API Error during request setup: ${error.message}`, {
          method,
          path
        });
      }

      throw new ApiError(
        error.message || 'API request failed',
        error.response?.status || 500,
        error
      );
    }
  }

  /**
   * Sanitize headers for logging (hide sensitive information)
   * @private
   */
  _sanitizeHeadersForLogging(headers) {
    const sanitized = {...headers};
    if (sanitized.Authorization) {
      // Mask most of the auth token
      const authParts = sanitized.Authorization.split(' ');
      if (authParts.length > 1) {
        const prefix = authParts[0];
        const token = authParts[1];
        sanitized.Authorization = `${prefix} ${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
      } else {
        sanitized.Authorization = 'Bearer ***masked***';
      }
    }
    return sanitized;
  }

  /**
   * Make a GET request
   * @param {string} path - API endpoint
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Promise<Object>} - Response data
   */
  async get(path, queryParams = {}) {
    return this.request('GET', path, null, queryParams);
  }

  /**
   * Make a POST request
   * @param {string} path - API endpoint
   * @param {Object} data - Request body
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Promise<Object>} - Response data
   */
  async post(path, data, queryParams = {}) {
    return this.request('POST', path, data, queryParams);
  }

  /**
   * Make a PUT request
   * @param {string} path - API endpoint
   * @param {Object} data - Request body
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Promise<Object>} - Response data
   */
  async put(path, data, queryParams = {}) {
    return this.request('PUT', path, data, queryParams);
  }

  /**
   * Make a DELETE request
   * @param {string} path - API endpoint
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Promise<Object>} - Response data
   */
  async delete(path, queryParams = {}) {
    return this.request('DELETE', path, null, queryParams);
  }
}

module.exports = RestClient;