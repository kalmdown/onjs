// src\auth\auth-manager.js
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const OAuthClient = require('./oauth-client');
const logger = require('../utils/logger');
const { OnshapeApiError } = require('../utils/errors');

/**
 * Manages authentication with the Onshape API
 */
class AuthManager {
  /**
   * Create an AuthManager instance
   * @param {Object} options - Configuration options
   * @param {string} [options.baseUrl='https://cad.onshape.com/api/v6'] - The API base URL
   * @param {string} [options.accessKey] - The API access key
   * @param {string} [options.secretKey] - The API secret key
   * @param {string} [options.accessToken] - The OAuth access token
   * @param {string} [options.refreshToken] - The OAuth refresh token
   * @param {string} [options.clientId] - The OAuth client ID
   * @param {string} [options.clientSecret] - The OAuth client secret
   * @param {string} [options.redirectUri] - The OAuth redirect URI
   * @param {string} [options.defaultMethod] - The default authentication method ('apikey' or 'oauth')
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api/v6';
    
    // API key credentials
    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    
    // OAuth credentials
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    
    // Authentication method
    this.currentMethod = null;
    
    // Set default method if specified and credentials are available
    if (options.defaultMethod) {
      this.setMethod(options.defaultMethod);
    }
  }
  
  /**
   * Get the current authentication method
   * @returns {string|null} - The current method ('apikey', 'oauth') or null if not set
   */
  getMethod() {
    return this.currentMethod;
  }
  
  /**
   * Set the authentication method to use
   * @param {string} method - The authentication method ('apikey' or 'oauth')
   * @returns {boolean} - Whether the method was successfully set
   */
  setMethod(method) {
    // Lowercase for case-insensitive comparison
    method = method.toLowerCase();
    
    // Check if apikey method can be used
    if (method === 'apikey') {
      if (this.accessKey && this.secretKey) {
        this.currentMethod = 'apikey';
        return true;
      }
      return false;
    }
    
    // Check if oauth method can be used
    if (method === 'oauth') {
      if (this.accessToken) {
        this.currentMethod = 'oauth';
        return true;
      }
      return false;
    }
    
    // Invalid method
    return false;
  }
  
  /**
   * Get authentication headers for a request
   * @param {string} method - The HTTP method (GET, POST, etc.)
   * @param {string} path - The API endpoint path
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Object} - Headers object with authentication headers
   */
  getAuthHeaders(method, path, queryParams = {}) {
    if (!this.currentMethod) {
      throw new OnshapeApiError('No authentication method selected', 401);
    }
    
    // Common headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Generate auth headers based on the selected method
    if (this.currentMethod === 'apikey') {
      // Generate API key authentication headers
      const date = new Date().toUTCString();
      const nonce = crypto.randomBytes(16).toString('hex');
      
      // Build the normalized path with query parameters
      let pathWithQuery = path;
      const queryString = querystring.stringify(queryParams);
      if (queryString) {
        pathWithQuery += '?' + queryString;
      }
      
      // Create the authorization string
      const authString = [
        method,
        nonce,
        date,
        'application/json',
        pathWithQuery
      ].join('\n').toLowerCase();
      
      // Create the signature
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(authString);
      const signature = hmac.digest('base64');
      
      // Add the API key authentication headers
      headers['Date'] = date;
      headers['Authorization'] = 
        `On ${this.accessKey}:HmacSHA256:${signature}`;
      
      return headers;
    } else if (this.currentMethod === 'oauth') {
      // OAuth authentication headers
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      return headers;
    }
    
    throw new OnshapeApiError('Invalid authentication method', 401);
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
   * Refresh the OAuth token
   * @returns {Promise<void>}
   */
  async refreshOAuthToken() {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new OnshapeApiError('Missing OAuth refresh credentials', 401);
    }
    
    try {
      const tokenUrl = 'https://oauth.onshape.com/oauth/token';
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', this.refreshToken);
      
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // Add basic auth header for client credentials
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      
      const tokenResponse = await axios.post(tokenUrl, params, { headers });
      
      // Update access token
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
   * @param {string} [options.scope='OAuth2ReadPII OAuth2Read OAuth2Write'] - OAuth scopes
   * @returns {OAuthClient} - Initialized OAuth client
   */
  createOAuthClient(options) {
    const clientOptions = {
      clientId: options.clientId || this.clientId,
      clientSecret: options.clientSecret || this.clientSecret,
      redirectUri: options.redirectUri || this.redirectUri,
      scope: options.scope || 'OAuth2ReadPII OAuth2Read OAuth2Write'
    };
    
    if (!clientOptions.clientId || clientOptions.clientSecret || clientOptions.redirectUri) {
      throw new OnshapeApiError('OAuth client requires clientId, clientSecret, and redirectUri');
    }
    
    const oauthClient = new OAuthClient(clientOptions);
    return oauthClient;
  }
}

module.exports = AuthManager;