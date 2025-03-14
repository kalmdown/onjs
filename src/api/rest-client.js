// src\api\rest-client.js
// src/api/rest-client.js
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
   * Make an HTTP request to the Onshape API
   * 
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - API endpoint path
   * @param {Object|null} [data=null] - Request body
   * @param {Object} [queryParams={}] - Query parameters
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} - The response data
   */
  async request(method, path, data = null, queryParams = {}, options = {}) {
    try {
      // Make sure path has a leading slash
      let cleanPath = path;
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
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
      
      // Debugging info
      if (this.debug) {
        this.logger.debug(`${method} ${cleanPath}`, {
          hasBody: !!bodyString,
          bodySize: bodyString ? bodyString.length : 0,
          queryParams: Object.keys(queryParams)
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
          'Accept': 'application/json',
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
        try {
          this.logger.info('Auth token expired, attempting refresh');
          
          // Refresh token and try again
          const refreshed = await this.authManager.refreshOAuthToken();
          
          if (refreshed) {
            this.logger.info('Token refreshed, retrying request');
            
            // Retry the original request with refreshed token
            return this.request(method, path, data, queryParams, options);
          }
        } catch (refreshError) {
          this.logger.error('Token refresh failed:', refreshError.message);
          throw new ApiError(
            'Authentication failed and token refresh failed',
            401,
            refreshError
          );
        }
      }

      // Log error details
      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      
      if (statusCode) {
        this.logger.error(`API Error ${statusCode}: ${error.message}`);
        
        if (errorData && this.debug) {
          this.logger.debug('Error response data:', errorData);
        }
      } else {
        this.logger.error(`API Request Error: ${error.message}`);
      }

      // Throw enhanced error
      throw new ApiError(
        error.message || 'API request failed',
        statusCode || 500,
        error
      );
    }
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