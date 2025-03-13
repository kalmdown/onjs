// src\auth\auth-manager.js
const crypto = require('crypto');
const axios = require('axios');
const { OnshapeApiError } = require('../utils/errors');
const OnshapeAuth = require('./onshape-auth');
const OAuthClient = require('./oauth-client');
const logger = require('../utils/logger');

/**
 * Authentication manager to handle different Onshape authentication methods
 */
class AuthManager {
  /**
   * Create a new AuthManager
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - The base URL for Onshape API
   * @param {string} [options.accessKey] - The access key for API Key authentication
   * @param {string} [options.secretKey] - The secret key for API Key authentication
   * @param {string} [options.accessToken] - The access token for OAuth authentication
   * @param {string} [options.refreshToken] - The refresh token for OAuth authentication
   * @param {string} [options.clientId] - The OAuth client ID
   * @param {string} [options.clientSecret] - The OAuth client secret
   * @param {string} [options.redirectUri] - The OAuth redirect URI
   * @param {string} [options.defaultMethod='apikey'] - The default authentication method ('apikey', 'oauth')
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api/v6';
    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    
    // OAuth credentials
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    
    // Current authentication method
    this.currentMethod = null;
    
    // Initialize with default method if provided
    if (options.defaultMethod) {
      this.setMethod(options.defaultMethod);
    }
  }
  
  /**
   * Set the current authentication method
   * @param {string} method - The authentication method ('apikey', 'oauth')
   * @returns {boolean} - True if method was set successfully
   */
  setMethod(method) {
    method = method.toLowerCase();
    
    if (method === 'apikey' || method === 'basic') {
      if (!this.accessKey || !this.secretKey) {
        logger.error('API key authentication requires accessKey and secretKey');
        return false;
      }
      
      this.currentMethod = 'apikey';
      return true;
    } 
    else if (method === 'oauth' || method === 'oauth2') {
      if (!this.accessToken) {
        logger.error('OAuth authentication requires accessToken');
        return false;
      }
      
      this.currentMethod = 'oauth';
      return true;
    }
    
    logger.error(`Unknown authentication method: ${method}`);
    return false;
  }
  
  /**
   * Get the current authentication method
   * @returns {string} - The current authentication method
   */
  getMethod() {
    return this.currentMethod;
  }
  
  /**
   * Generate authentication headers based on the current method
   * @param {string} method - The HTTP method (GET, POST, etc.)
   * @param {string} path - The API endpoint path
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Object} - Headers object
   */
  getAuthHeaders(method, path, queryParams = {}) {
    if (!this.currentMethod) {
      throw new OnshapeApiError('No authentication method selected');
    }
    
    if (this.currentMethod === 'apikey') {
      return this.getApiKeyHeaders(method, path, queryParams);
    } else if (this.currentMethod === 'oauth') {
      return this.getOAuthHeaders();
    }
    
    throw new OnshapeApiError(`Unknown authentication method: ${this.currentMethod}`);
  }
  
  /**
   * Generate API key authentication headers
   * @param {string} method - The HTTP method (GET, POST, etc.)
   * @param {string} path - The API endpoint path
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Object} - Headers object
   * @private
   */
  getApiKeyHeaders(method, path, queryParams = {}) {
    // Create base64 encoded credentials for Basic Auth
    const credentials = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
    
    // Return headers with Basic authentication
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  
  /**
   * Generate OAuth authentication headers
   * @returns {Object} - Headers object
   * @private
   */
  getOAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  
  /**
   * Make an authenticated request to the Onshape API
   * @param {string} method - The HTTP method (GET, POST, etc.)
   * @param {string} path - The API endpoint path
   * @param {Object} [data=null] - Request body
   * @param {Object} [queryParams={}] - Query parameters
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} - The response data
   */
  async request(method, path, data = null, queryParams = {}, options = {}) {
    try {
      const headers = this.getAuthHeaders(method, path, queryParams);
      const url = `${this.baseUrl}${path}`;
      
      logger.debug(`${method} ${url}`);
      if (data) logger.debug('Request data:', data);
      
      const response = await axios({
        method,
        url,
        headers,
        params: queryParams,
        data,
        validateStatus: status => status >= 200 && status < 300,
        ...options
      });
      
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      logger.error(`API request failed: ${statusCode} - ${message}`);
      
      // Handle auth-specific errors
      if (statusCode === 401) {
        if (this.currentMethod === 'oauth' && this.refreshToken) {
          // Try to refresh token
          try {
            await this.refreshOAuthToken();
            // Retry the original request
            return this.request(method, path, data, queryParams, options);
          } catch (refreshError) {
            throw new OnshapeApiError('Authentication failed and token refresh failed', 401);
          }
        }
        throw new OnshapeApiError('Authentication failed', 401);
      }
      
      throw new OnshapeApiError(`API error: ${message}`, statusCode || 500);
    }
  }
  
  /**
   * Refresh the OAuth access token using the refresh token
   * @returns {Promise<void>}
   * @private
   */
  async refreshOAuthToken() {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new OnshapeApiError('Cannot refresh token: missing refresh token, client ID, or client secret');
    }
    
    try {
      const tokenResponse = await axios({
        method: 'POST',
        url: 'https://oauth.onshape.com/oauth/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        data: new URLSearchParams({
          'grant_type': 'refresh_token',
          'refresh_token': this.refreshToken
        }).toString()
      });
      
      this.accessToken = tokenResponse.data.access_token;
      
      // Update refresh token if provided
      if (tokenResponse.data.refresh_token) {
        this.refreshToken = tokenResponse.data.refresh_token;
      }
      
      logger.debug('OAuth token refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh OAuth token:', error.message);
      throw new OnshapeApiError('Failed to refresh OAuth token', 401);
    }
  }
  
  /**
   * Create and initialize OAuth client for web authentication flow
   * @param {Object} options - OAuth client options
   * @param {string} options.clientId - The OAuth client ID
   * @param {string} options.clientSecret - The OAuth client secret
   * @param {string} options.redirectUri - The OAuth redirect URI
   * @param {string} [options.scope='OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete'] - OAuth scopes
   * @returns {OAuthClient} - Initialized OAuth client
   */
  createOAuthClient(options) {
    const clientOptions = {
      clientId: options.clientId || this.clientId,
      clientSecret: options.clientSecret || this.clientSecret,
      redirectUri: options.redirectUri || this.redirectUri,
      scope: options.scope || 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete'
    };
    
    if (!clientOptions.clientId || !clientOptions.clientSecret || !clientOptions.redirectUri) {
      throw new OnshapeApiError('OAuth client requires clientId, clientSecret, and redirectUri');
    }
    
    const oauthClient = new OAuthClient(clientOptions);
    return oauthClient;
  }
}

module.exports = AuthManager;