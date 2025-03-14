// src/auth/auth-manager.js
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/errors');
const config = require('../../config');

/**
 * Manages authentication with the Onshape API
 */
class AuthManager {
  /**
   * Create an AuthManager instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || config.onshape.baseUrl;
    
    // API key credentials
    this.accessKey = options.accessKey || process.env.ONSHAPE_ACCESS_KEY;
    this.secretKey = options.secretKey || process.env.ONSHAPE_SECRET_KEY;
    
    // OAuth credentials
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId || config.onshape.clientId;
    this.clientSecret = options.clientSecret || config.onshape.clientSecret;
    this.redirectUri = options.redirectUri || config.onshape.callbackUrl;
    
    // Authentication method
    this.currentMethod = null;
    
    // Logger
    this.logger = logger.scope('AuthManager');
    
    // Initialize method if credentials are available
    this._initMethod();
  }

  /**
   * Initialize authentication method based on available credentials
   * @private
   */
  _initMethod() {
    if (process.env.ONSHAPE_AUTH_METHOD === 'apikey' && this.accessKey && this.secretKey) {
      this.setMethod('apikey');
      this.logger.info('Initialized with API key authentication');
    } else if (this.accessToken) {
      this.setMethod('oauth');
      this.logger.info('Initialized with OAuth authentication (token provided)');
    } else if (this.clientId && this.clientSecret) {
      this.setMethod('oauth');
      this.logger.info('Initialized with OAuth authentication (credentials provided)');
    } else {
      this.logger.warn('No valid authentication credentials available');
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
      if (this.accessToken || (this.clientId && this.clientSecret)) {
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
  getAuthHeaders(method, path, queryParams = {}, bodyString = '') {
    const authMethod = this.getMethod();
    
    if (authMethod === 'oauth') {
      if (!this.accessToken) {
        throw new AuthenticationError('OAuth authentication requires an access token');
      }
      
      return {
        'Authorization': `Bearer ${this.accessToken}`
      };
    } 
    else if (authMethod === 'apikey') {
      if (!this.accessKey || !this.secretKey) {
        throw new AuthenticationError('API key authentication requires accessKey and secretKey');
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
        method.toUpperCase(),
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
      
      this.logger.debug('Generated API key signature for request');
      
      return {
        'Date': date,
        'Content-Type': contentType || undefined,
        'Authorization': `On ${this.accessKey}:HmacSHA256:${signature}`
      };
    } 
    else {
      throw new AuthenticationError(`Unknown auth method: ${authMethod}`);
    }
  }
  
  /**
   * Refresh the OAuth token
   * @returns {Promise<boolean>} True if token was refreshed successfully
   */
  async refreshOAuthToken() {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new AuthenticationError('Missing OAuth refresh credentials');
    }
    
    try {
      const tokenUrl = config.onshape.tokenUrl || 'https://oauth.onshape.com/oauth/token';
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', this.refreshToken);
      
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // Add basic auth header for client credentials
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      
      this.logger.debug('Attempting to refresh OAuth token...');
      
      const response = await axios.post(tokenUrl, params, { headers });
      
      // Validate the response
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response - missing access_token');
      }
      
      // Update tokens
      this.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }
      
      this.logger.info('OAuth token refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh OAuth token:', error.message);
      if (error.response) {
        this.logger.error('Token refresh response:', error.response.data);
      }
      throw new AuthenticationError('Failed to refresh OAuth token');
    }
  }
  
  /**
   * Refresh the OAuth token if needed
   * @returns {Promise<boolean>} True if token was refreshed
   */
  async refreshTokenIfNeeded() {
    // Skip if not using OAuth or no refresh token
    if (this.getMethod() !== 'oauth' || !this.refreshToken) {
      return false;
    }
    
    try {
      return await this.refreshOAuthToken();
    } catch (error) {
      this.logger.warn('Error refreshing token:', error.message);
      return false;
    }
  }

  /**
   * Get OAuth authorization URL
   * @param {Object} options - Authorization options
   * @returns {string} - URL for OAuth authorization
   */
  getAuthorizationUrl(options = {}) {
    if (!this.clientId) {
      throw new AuthenticationError('OAuth client ID is required');
    }
    
    const baseUrl = config.onshape.authorizationUrl || 'https://oauth.onshape.com/oauth/authorize';
    const scope = options.scope || 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete';
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri || config.onshape.callbackUrl,
      scope
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} - Token response object
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new AuthenticationError('OAuth client ID and secret are required');
    }
    
    try {
      const tokenUrl = config.onshape.tokenUrl || 'https://oauth.onshape.com/oauth/token';
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', this.redirectUri || config.onshape.callbackUrl);
      
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // Add basic auth header for client credentials
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      
      this.logger.debug('Exchanging authorization code for token...');
      
      const response = await axios.post(tokenUrl, params, { headers });
      
      // Validate the response
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response - missing access_token');
      }
      
      // Store tokens
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token || null;
      this.setMethod('oauth');
      
      this.logger.info('Successfully exchanged code for OAuth token');
      
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };
    } catch (error) {
      this.logger.error('Failed to exchange code for token:', error.message);
      if (error.response) {
        this.logger.error('Code exchange response:', error.response.data);
      }
      throw new AuthenticationError('Failed to exchange authorization code for token');
    }
  }
}

module.exports = AuthManager;