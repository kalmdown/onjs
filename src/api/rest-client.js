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
          queryParamCount: Object.keys(queryParams).length,
          bodySize: bodyString ? bodyString.length : 0,
          authMethod: this.authManager.getMethod()
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

      // Enhanced API key authentication error handling
      if (error.response?.status === 401 && this.authManager.getMethod() === 'apikey') {
        // Check for common API key issues
        this.logger.error('API Key authentication failed', {
          statusCode: error.response.status,
          statusText: error.response.statusText,
          method,
          path: cleanPath,
          responseData: error.response.data
        });
        
        // Check API key format and presence
        const accessKey = this.authManager.accessKey;
        if (!accessKey) {
          this.logger.error('API Key is missing');
        } else if (accessKey.length < 24) {
          this.logger.error('API Key appears to be too short', { length: accessKey.length });
        } else if (accessKey.indexOf(' ') >= 0 || accessKey.indexOf('\n') >= 0) {
          this.logger.error('API Key contains invalid whitespace characters');
        }
        
        // Log any specific error message from Onshape
        if (error.response.data && error.response.data.message) {
          this.logger.error(`Onshape API error: ${error.response.data.message}`);
        }
      }

      // Enhanced error logging based on error type
      if (error.response) {
        // The server responded with a status code outside of 2xx range
        this.logger.error(`API Response Error: ${error.response.status} for ${method} ${cleanPath}`, {
          statusCode: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          method,
          path: cleanPath,
          authMethod: this.authManager.getMethod()
        });

        // Log specific error responses for known error types
        if (error.response.status === 403) {
          this.logger.warn(`Permission denied: Check that your API key or OAuth token has the required permissions for ${method} ${cleanPath}`);
        } else if (error.response.status === 404) {
          this.logger.warn(`Resource not found: ${cleanPath}`);
        } else if (error.response.status === 429) {
          this.logger.warn(`Rate limit exceeded for ${method} ${cleanPath}. Consider implementing retry logic.`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        this.logger.error(`API Request Error: No response received for ${method} ${cleanPath}`, {
          method,
          path: cleanPath,
          requestSize: bodyString?.length || 0,
          authMethod: this.authManager.getMethod()
        });
      } else {
        // Something happened in setting up the request
        this.logger.error(`API Error during request setup: ${error.message}`, {
          method,
          path: cleanPath,
          authMethod: this.authManager.getMethod()
        });
      }

      // Add request details to help with debugging
      if (this.debug && bodyString) {
        this.logger.debug(`Failed request body (truncated): ${bodyString.substring(0, 200)}${bodyString.length > 200 ? '...' : ''}`);
      }

      // Throw enhanced error
      this.logger.error(`API request failed for ${method} ${path}`, {
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        authMethod: this.authManager.getMethod()
      });
      
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