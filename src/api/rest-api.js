// src\api\rest-api.js
const axios = require('axios');
const { createAuth } = require('../auth/x_index');
const logger = require('../utils/x_logger');

class RestApi {
  /**
   * Create a RestApi client
   * @param {object} options - API client options
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
      this.authSource = 'provided';
    } else {
      this.auth = createAuth({
        authType: options.authType || process.env.ONSHAPE_AUTH_TYPE || 'api_key',
        accessKey: options.accessKey || process.env.ONSHAPE_ACCESS_KEY,
        secretKey: options.secretKey || process.env.ONSHAPE_SECRET_KEY,
        oauthToken: options.oauthToken || process.env.ONSHAPE_OAUTH_TOKEN,
      });
      this.authSource = 'created';
    }

    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api/v10';

    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    // Set debug mode
    this.debug = options.debug || false;

    // Initialize logger
    this.logger = logger.scope('RestApi');
    
    // Use getMethod() if available, otherwise try to access authType directly
    const authMethod = typeof this.auth.getMethod === 'function' 
      ? this.auth.getMethod() 
      : (this.auth.authType || 'unknown');
    
    this.logger.info(`RestApi initialized with ${authMethod} authentication (${this.authSource})`);
  }

  /**
   * Make API request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {object|string|null} data - Request body
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>} API response
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
    let headers;
    try {
      // Use getAuthHeaders with correct parameters
      headers = await this.auth.getAuthHeaders(method, cleanPath, queryParams, bodyString);
      
      // Debug log the authentication headers (without showing full credentials)
      if (this.debug && headers) {
        const authHeader = headers.Authorization || '';
        const maskedAuth = authHeader.substring(0, 15) + '...' + (authHeader.length > 30 ? authHeader.substring(authHeader.length - 10) : '');
        this.logger.debug('Using auth headers:', { Authorization: maskedAuth });
      }
    } catch (authError) {
      this.logger.error('Failed to get auth headers:', authError.message);
      throw new Error(`Authentication error: ${authError.message}`);
    }
    
    // Verify we have authentication headers
    if (!headers || !headers.Authorization) {
      this.logger.error('Missing authentication headers');
      throw new Error('Authentication headers could not be generated - check API credentials');
    }

    try {
      if (this.debug) {
        this.logger.debug(`${method} request to ${cleanPath}`, {
          hasBody: !!bodyString,
          queryParams,
        });
      } else {
        this.logger.debug(`${method} request to ${cleanPath}`, { hasBody: !!bodyString });
      }

      const response = await axios({
        method,
        url: `${this.baseUrl}${cleanPath}`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        },
        data: bodyString || undefined,
        params: queryParams
      });

      return response.data;
    } catch (error) {
      // Log error details
      const errorResponse = error.response?.data || {};
      const statusCode = error.response?.status;

      this.logger.error(`API Error (${statusCode}):`, errorResponse);
      
      if (statusCode === 401) {
        this.logger.error('Authentication failed. Check API credentials and permissions.');
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

module.exports = RestApi;