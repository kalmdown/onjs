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
  try {
    // Check environment variable first
    const preferredMethod = process.env.ONSHAPE_AUTH_METHOD?.toLowerCase();
    
    // Log available auth options for debugging
    this.logger.debug('Auth initialization', {
      preferredMethod: preferredMethod || 'not set',
      hasAccessKey: !!this.accessKey,
      hasSecretKey: !!this.secretKey,
      accessKeyLength: this.accessKey ? this.accessKey.length : 0,
      hasOAuthToken: !!this.accessToken,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret
    });

    // Validate API key format if present
    if (this.accessKey && this.secretKey) {
      if (typeof this.accessKey !== 'string' || typeof this.secretKey !== 'string') {
        this.logger.warn('API key credentials are not strings');
      } else if (this.accessKey.length < 20 || this.secretKey.length < 20) {
        this.logger.warn('API key credentials appear to be too short', {
          accessKeyLength: this.accessKey.length,
          secretKeyLength: this.secretKey.length
        });
      }
      
      // Check for common issues like whitespace
      if (this.accessKey.trim() !== this.accessKey || this.secretKey.trim() !== this.secretKey) {
        this.logger.warn('API key credentials contain leading/trailing whitespace');
        // Auto-fix whitespace issues
        this.accessKey = this.accessKey.trim();
        this.secretKey = this.secretKey.trim();
      }
    }
    
    // If API key is explicitly requested and credentials exist
    if ((preferredMethod === 'apikey' || preferredMethod === 'api_key') && 
        this.accessKey && this.secretKey) {
      this.setMethod('apikey');
      this.logger.info('Using API key authentication (explicit setting)');
      return;
    }
    
    // If OAuth tokens are already available, use OAuth
    if (this.accessToken) {
      this.setMethod('oauth');
      this.logger.info('Using OAuth authentication (token provided)');
      return;
    }
    
    // If OAuth credentials are available, prefer OAuth
    if (this.clientId && this.clientSecret) {
      this.setMethod('oauth');
      this.logger.info('Using OAuth authentication (credentials available)');
      return;
    }
    
    // Fallback to API key if available
    if (this.accessKey && this.secretKey) {
      this.setMethod('apikey');
      this.logger.info('Using API key authentication (fallback)');
      return;
    }
    
    this.logger.warn('No valid authentication credentials available');
  } catch (error) {
    this.logger.error(`Error initializing auth method: ${error.message}`);
    // Don't throw - allow the application to continue without auth
    // The auth checks in individual requests will handle auth requirements
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
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    } 
    else if (authMethod === 'apikey') {
      // Validate API key credentials are present
      if (!this.accessKey || !this.secretKey) {
        throw new AuthenticationError('API key authentication requires accessKey and secretKey');
      }
      
      // Validate API key format - should be a non-empty string
      if (typeof this.accessKey !== 'string' || typeof this.secretKey !== 'string') {
        throw new AuthenticationError('API key and secret must be strings');
      }
      
      // Additional format validation - Onshape API keys are typically longer than 20 chars
      if (this.accessKey.length < 20 || this.secretKey.length < 20) {
        this.logger.warn('API key or secret appears to be too short', {
          accessKeyLength: this.accessKey.length,
          secretKeyLength: this.secretKey.length
        });
      }
      
      // Log API key info for debugging (hide sensitive parts)
      this.logger.debug('Using API key authentication', {
        accessKeyLength: this.accessKey.length,
        secretKeyLength: this.secretKey.length,
        accessKeyStart: this.accessKey.substring(0, 4) + '...',
        accessKeyEnd: '...' + this.accessKey.substring(this.accessKey.length - 4)
      });
      
      // Use Basic Auth instead of HMAC signature (simpler and more reliable)
      const credentials = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
      
      return {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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

  /**
   * Build authentication headers for API key authentication
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - API path with leading slash
   * @param {Object} queryParams - Query parameters
   * @param {string} bodyString - Request body as string
   * @returns {Object} Authentication headers
   */
  buildApiKeyHeaders(method, path, queryParams = {}, bodyString = '') {
    const crypto = require('crypto');
    
    // Check for required credentials
    if (!this.accessKey || !this.secretKey) {
      throw new Error('API key authentication requires accessKey and secretKey');
    }
    
    // Prepare the date header (in HTTP format)
    const now = new Date();
    const dateString = now.toUTCString();
    
    // Build the query string
    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';
    
    // Compute the content string for signing
    const contentString = bodyString || '';
    
    // String to sign: METHOD\nDATE\nPATH+QUERY\nCONTENT_STRING\nCONTENT_TYPE
    const stringToSign = [
      method.toUpperCase(),
      dateString,
      path + queryString,
      contentString,
      contentString ? 'application/json' : ''
    ].join('\n');
    
    this.logger.debug('API key signature data', {
      method: method.toUpperCase(),
      path: path + queryString,
      dateString,
      contentStringLength: contentString ? contentString.length : 0
    });
    
    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(stringToSign);
    const signature = Buffer.from(hmac.digest()).toString('base64');
    
    // Authorization format: On {accessKey}:HmacSHA256:{signature}
    const authorization = `On ${this.accessKey}:HmacSHA256:${signature}`;
    
    // Return headers
    return {
      'Date': dateString,
      'Authorization': authorization,
      'Content-Type': contentString ? 'application/json' : undefined
    };
  }

  /**
   * Get authentication headers for API_KEY authentication method
   * @private
   * @returns {Object} Authentication headers
   */
  _getApiKeyAuthHeaders() {
    try {
      const accessKey = process.env.ONSHAPE_ACCESS_KEY;
      const secretKey = process.env.ONSHAPE_SECRET_KEY;
      
      if (!accessKey || !secretKey) {
        throw new Error('API key credentials not found in environment variables');
      }
      
      // Create the Basic Auth header exactly as in working direct approach
      const authStr = `${accessKey}:${secretKey}`;
      const base64Auth = Buffer.from(authStr).toString('base64');
      const authHeader = `Basic ${base64Auth}`;
      
      // Use lowercase 'accept' to match working direct approach
      return {
        'Authorization': authHeader,
        'accept': 'application/json;charset=UTF-8; qs=0.09',
        'Content-Type': 'application/json'
      };
    } catch (error) {
      this.logger.error(`Error creating API key auth headers: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthManager;