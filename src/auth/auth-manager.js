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
   * Get authentication headers for an API request
   * @param {string} method HTTP method (GET, POST, etc.)
   * @param {string} path API path
   * @param {Object} queryParams Query parameters
   * @param {string} [bodyString=''] Request body as string
   * @returns {Object} Authentication headers
   */
  getAuthHeaders(method, path, queryParams, bodyString = '') {
    const authMethod = this.getMethod();
    
    if (authMethod === 'oauth') {
      if (!this.accessToken) {
        throw new OnshapeApiError('OAuth authentication requires an access token');
      }
      
      return {
        'Authorization': `Bearer ${this.accessToken}`
      };
    } 
    else if (authMethod === 'apikey') {
      if (!this.accessKey || !this.secretKey) {
        throw new OnshapeApiError('API key authentication requires accessKey and secretKey');
      }
      
      // Generate API key authentication headers
      // Make sure path doesn't have the base URL in it
      const cleanPath = path.startsWith('http') ? new URL(path).pathname : path;
      
      // Convert query params object to string
      let queryString = '';
      if (queryParams && Object.keys(queryParams).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          searchParams.append(key, value);
        });
        queryString = searchParams.toString();
      }
      
      const date = new Date().toUTCString();
      const contentType = bodyString ? 'application/json' : '';
      
      // Build the string to sign
      const stringToSign = [
        method,
        date,
        contentType,
        queryString,
        cleanPath,
        bodyString || ''
      ].join('\n');
      
      // Generate HMAC signature
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(stringToSign);
      const signature = hmac.digest('base64');
      
      return {
        'Date': date,
        'Content-Type': contentType || undefined,
        'Authorization': `On ${this.accessKey}:HmacSHA256:${signature}`
      };
    } 
    else {
      throw new OnshapeApiError(`Unknown auth method: ${authMethod}`);
    }
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
 * Refresh the OAuth token if it's expired or about to expire
 * @returns {Promise<boolean>} True if token was refreshed
 */
async refreshTokenIfNeeded() {
  // Skip if not using OAuth or no refresh token
  if (this.getMethod() !== 'oauth' || !this.refreshToken) {
    return false;
  }
  
  try {
    logger.debug('Attempting to refresh OAuth token...');
    
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
    
    logger.debug('Sending refresh token request...');
    
    const response = await axios.post(tokenUrl, params.toString(), { headers });
    
    if (!response.data || !response.data.access_token) {
      logger.error('Token refresh response missing access_token');
      return false;
    }
    
    logger.debug('Received new token from refresh');
    
    // Update tokens
    this.accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      this.refreshToken = response.data.refresh_token;
    }
    
    logger.info('OAuth token refreshed successfully');
    return true;
  } catch (error) {
    logger.error('Failed to refresh token:', error.message);
    if (error.response) {
      logger.error('Refresh token response:', error.response.data);
    }
    return false;
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
