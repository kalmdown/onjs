// src\api\client.js
const axios = require('axios');
const logger = require('../utils/logger');
const RestClient = require('./rest-client');
const DocumentsApi = require('./endpoints/documents');
const config = require('../../config'); // Fix the config import path

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
    // Use configuration values from the config object, no direct env var access
    this.baseUrl = options.baseUrl || config.onshape.baseUrl;
    this.apiUrl = options.apiUrl || config.onshape.apiUrl;
    this.authManager = options.authManager;
    this.debug = options.debug || false;
    
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
      throw new Error('API URL is required');
    }
  }
  
  /**
   * Perform a GET request to the Onshape API
   * @param {string} path - API path
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} - API response
   */
  async get(path, options = {}) {
    try {
      // Support direct header pass-through for compatibility with curl commands
      const useDirectHeaders = options.headers && options.headers.Authorization;
      
      // Create config for axios
      const config = {
        method: 'get',
        url: this._buildUrl(path),
        params: options.params || {},
        paramsSerializer: this._serializeParams,
        ...options
      };
      
      // Only set headers from auth manager if not using direct headers
      if (!useDirectHeaders) {
        config.headers = {
          ...await this.authManager.getAuthHeaders(),
          ...(options.headers || {})
        };
      }
      
      if (this.debug) {
        logger.debug(`Making GET request to: ${config.url}`);
        logger.debug(`With params: ${JSON.stringify(config.params || {})}`);
        
        // Mask the auth token for logging
        const sanitizedHeaders = { ...config.headers };
        if (sanitizedHeaders.Authorization) {
          sanitizedHeaders.Authorization = sanitizedHeaders.Authorization.split(' ')[0] + ' ***';
        }
        logger.debug(`With headers: ${JSON.stringify(sanitizedHeaders || {})}`);
      }
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
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

  /**
   * Handle API errors - implementation was missing causing client tests to fail
   * @param {Error} error - Error object from Axios
   * @private
   */
  _handleError(error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // outside the range of 2xx
      const statusCode = error.response.status;
      const statusText = error.response.statusText;
      const data = error.response.data;
      
      logger.error(`API Response Error: ${statusCode} for ${error.config?.method?.toUpperCase() || 'unknown'} ${error.config?.url || 'unknown'}`, {
        statusCode,
        statusText,
        data
      });
    } else if (error.request) {
      // The request was made but no response was received
      logger.error(`API Request Error: No response received for ${error.config?.method?.toUpperCase() || 'unknown'} ${error.config?.url || 'unknown'}`);
    } else {
      // Something happened in setting up the request
      logger.error(`API Error: ${error.message}`);
    }
  }

  /**
   * Build a complete URL from the API URL and path
   * @param {string} path - API path
   * @returns {string} - Complete URL
   * @private
   */
  _buildUrl(path) {
    // Ensure path has leading slash
    const formattedPath = path.startsWith('/') ? path : '/' + path;
    
    // If path already contains /api/, assume it's a full path relative to baseUrl
    if (formattedPath.includes('/api/')) {
      return `${this.baseUrl}${formattedPath}`;
    }
    
    // Otherwise, use the apiUrl and append the path
    return `${this.apiUrl}${formattedPath}`;
  }

  /**
   * Serialize parameters for URL
   * @param {Object} params - Parameters to serialize
   * @returns {string} - Serialized parameters
   * @private
   */
  _serializeParams(params) {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    
    return Object.entries(params)
      .map(([key, value]) => {
        if (value === undefined || value === null) {
          return null;
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .filter(Boolean)
      .join('&');
  }
}

module.exports = OnshapeClient;