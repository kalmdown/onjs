// src\api\x_simple-rest-api.js
/**
 * Simplified Onshape REST API client - verified working version
 */
const axios = require('axios');
const AuthManager = require('../auth/x_auth-manager');
const logger = require('../utils/x_logger');

class SimpleRestApi {
  /**
   * Constructor for SimpleRestApi
   * @param {Object} options - Configuration options
   * @param {string} options.authType - Authentication type ('oauth' or 'api_key')
   * @param {string} options.accessKey - API access key (for API key auth)
   * @param {string} options.secretKey - API secret key (for API key auth)
   * @param {string} options.oauthToken - OAuth token (for OAuth auth)
   * @param {string} options.baseUrl - Base URL for the API
   * @param {boolean} options.debug - Enable debug mode
   * @param {AuthManager} options.authManager - Auth manager instance
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v10';
    this.debug = options.debug || false;
    this.logger = options.logger || require('../utils/x_logger').scope('SimpleRestApi');
    
    // Initialize auth manager
    if (options.authManager) {
      // Use provided auth manager
      this.authManager = options.authManager;
      this.logger.info('Using provided auth manager instance');
    } else {
      // Create new auth manager with options
      const AuthManager = require('../auth/x_auth-manager');
      try {
        this.authManager = new AuthManager({
          authType: options.authType || process.env.ONSHAPE_AUTH_METHOD || 'api_key',
          accessKey: options.accessKey || process.env.ONSHAPE_ACCESS_KEY,
          secretKey: options.secretKey || process.env.ONSHAPE_SECRET_KEY,
          oauthToken: options.oauthToken || process.env.ONSHAPE_OAUTH_TOKEN,
          logger: this.logger
        });
        this.logger.warn('Created new auth manager instead of using application instance');
      } catch (error) {
        this.logger.error('Failed to initialize auth manager:', error.message);
        console.error('Auth initialization error:', error.message);
      }
    }
  
    this.logger.info(`SimpleRestApi initialized with ${this.authManager ? this.authManager.getMethod() : 'unknown'} authentication`);
  }

  /**
   * Make API request with defensive auth check
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} queryParams - Query parameters
   * @param {Object|string|null} body - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async request(method, path, queryParams = {}, body = null, options = {}) {
    try {
      // Verify auth manager is available
      if (!this.authManager) {
        throw new Error('Authentication manager not initialized properly. Check credentials.');
      }

      // Add detailed request logging
      const requestData = {
        method: method.toUpperCase(),
        path,
        queryParams,
        bodySize: body ? JSON.stringify(body).length : 0,
        options
      };
      
      this.logger.debug('[REQUEST DETAILS]', JSON.stringify(requestData, null, 2));
      
      // Make sure path has a leading slash
      let cleanPath = path;
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
      }
      
      // Format data for consistency
      let bodyString = '';
      if (body !== null && body !== undefined) {
        bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // Build URL with query parameters
      let fullUrl = `${this.baseUrl}${cleanPath}`;
      
      // Get authentication headers
      const authHeaders = this.authManager.getAuthHeaders(
        method.toUpperCase(),
        cleanPath,
        queryParams,
        bodyString
      );
      
      // Complete headers
      const headersObj = {
        ...authHeaders,
        'Accept': 'application/json',
      };
      
      if (bodyString) {
        headersObj['Content-Type'] = 'application/json';
      }
      
      // Log complete request details before sending
      const sensitiveHeadersLog = {...headersObj};
      if (sensitiveHeadersLog.Authorization) {
        sensitiveHeadersLog.Authorization = sensitiveHeadersLog.Authorization.substring(0, 20) + '...';
      }
      
      this.logger.debug('[COMPLETE REQUEST]', {
        url: fullUrl,
        method: method.toUpperCase(),
        headers: sensitiveHeadersLog,
        queryParams: queryParams,
        bodyPreview: bodyString ? (bodyString.length > 100 ? bodyString.substring(0, 100) + '...' : bodyString) : null
      });
      
      // Axios request configuration
      const config = {
        url: fullUrl,
        method: method.toUpperCase(),
        headers: headersObj,
        params: queryParams,
        paramsSerializer: params => {
          return Object.keys(params)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        }
      };
      
      // Add data if present
      if (bodyString) {
        config.data = bodyString;
      }
      
      this.logger.debug(`${method.toLowerCase()} request to ${cleanPath}`, { hasBody: !!bodyString });
      
      const response = await axios(config);
      
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
          headers: { ...headersObj, Authorization: '...[redacted]...' },
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
    return this.request('GET', path, queryParams);
  }
  
  async post(path, data, queryParams = {}) {
    return this.request('POST', path, queryParams, data);
  }
  
  async put(path, data, queryParams = {}) {
    return this.request('PUT', path, queryParams, data);
  }
  
  async delete(path, queryParams = {}) {
    return this.request('DELETE', path, queryParams);
  }
}

module.exports = SimpleRestApi;
