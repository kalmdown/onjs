// src\api\simple-rest-api.js
/**
 * Simplified Onshape REST API client - verified working version
 */
const axios = require('axios');
const AuthManager = require('../auth/auth-manager');
const logger = require('../utils/logger');

class SimpleRestApi {
  /**
   * Create a SimpleRestApi client
   * @param {Object} options - API client options
   * @param {AuthManager} options.authManager - Auth manager instance
   * @param {string} options.authType - Auth type (api_key or oauth)
   * @param {string} options.accessKey - API key access key
   * @param {string} options.secretKey - API key secret key
   * @param {string} options.oauthToken - OAuth token
   * @param {string} options.baseUrl - API base URL
   */
  constructor(options) {
    // Support direct auth keys or auth manager
    if (options.authManager) {
      this.auth = options.authManager;
    } else {
      this.auth = new AuthManager({
        authType: options.authType || 'api_key',
        accessKey: options.accessKey,
        secretKey: options.secretKey,
        oauthToken: options.oauthToken
      });
    }
    
    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api';
    
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    // Set debug mode
    this.debug = options.debug || false;
    
    // Initialize logger
    this.logger = logger.scope('SimpleRestApi');
    this.logger.info(`SimpleRestApi initialized with ${this.auth.authType} authentication`);
  }

  /**
   * Make API request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object|string|null} data - Request body
   * @param {Object} queryParams - Query parameters
   * @returns {Promise<Object>} API response
   */
  async request(method, path, data = null, queryParams = {}) {
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
    
    // Get authentication headers from auth manager
    const headers = this.auth.getAuthHeaders(method, cleanPath, queryParams, bodyString);
    
    try {
      if (this.debug) {
        this.logger.debug(`${method} request to ${cleanPath}`, { 
          headers: { ...headers, Authorization: headers.Authorization.substr(0, 20) + '...' },
          hasBody: !!bodyString,
          queryParams
        });
      } else {
        this.logger.debug(`${method} request to ${cleanPath}`, { hasBody: !!bodyString });
      }
      
      const response = await axios({
        method,
        url: `${this.baseUrl}${cleanPath}`,
        headers,
        data: bodyString || undefined,
        params: queryParams
      });
      
      return response.data;
    } catch (error) {
      // Log error details
      const errorResponse = error.response?.data || {};
      const statusCode = error.response?.status;
      
      this.logger.error(`API Error (${statusCode}):`, errorResponse);
      console.error(`API Error (${statusCode}):`, errorResponse);
      
      if (this.debug && error.request) {
        // Log request details for debugging
        this.logger.debug('Failed request details', {
          url: `${this.baseUrl}${cleanPath}`,
          headers: { ...headers, Authorization: '...[redacted]...' },
          method,
          statusCode,
          errorMessage: error.message
        });
      }
      
      // Re-throw with more context
      throw new Error(`API request failed: ${error.message}`);
    }
  }
  
  // Helper methods for HTTP verbs with support for query parameters
  async get(path, queryParams = {}) {
    return this.request('GET', path, null, queryParams);
  }
  
  async post(path, data, queryParams = {}) {
    return this.request('POST', path, data, queryParams);
  }
  
  async put(path, data, queryParams = {}) {
    return this.request('PUT', path, data, queryParams);
  }
  
  async delete(path, queryParams = {}) {
    return this.request('DELETE', path, null, queryParams);
  }
}

module.exports = SimpleRestApi;
