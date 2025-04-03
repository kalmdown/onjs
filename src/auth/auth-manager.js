// src/auth/auth-manager.js
const crypto = require('crypto');
const axios = require('axios');
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
    this.accessKey = (options.accessKey || process.env.ONSHAPE_ACCESS_KEY)?.trim();
    this.secretKey = (options.secretKey || process.env.ONSHAPE_SECRET_KEY)?.trim();
    
    // OAuth credentials
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.clientId = options.clientId || process.env.OAUTH_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.OAUTH_CLIENT_SECRET;
    this.redirectUri = options.redirectUri || process.env.OAUTH_CALLBACK_URL;
    
    // Authentication method
    this.currentMethod = null;
    
    // Logger
    this.logger = logger.scope('Auth');
    
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
        const log = logger.scope('Auth');
        if (typeof this.accessKey !== 'string' || typeof this.secretKey !== 'string') {
          log.error('API key credentials are not strings');
        } else if (this.accessKey.length < 20 || this.secretKey.length < 20) {
          log.error('API key credentials appear to be too short', {
            accessKeyLength: this.accessKey.length,
            secretKeyLength: this.secretKey.length
          });
        }
        
        // Check for common issues like whitespace
        if (this.accessKey.trim() !== this.accessKey || this.secretKey.trim() !== this.secretKey) {
          const log = logger.scope('Auth');
          log.warn('API key credentials contain leading/trailing whitespace');
          // Auto-fix whitespace issues
          this.accessKey = this.accessKey.trim();
          this.secretKey = this.secretKey.trim();
        }
      }
      
      // If API key is explicitly requested and credentials exist
      if ((preferredMethod === 'apikey' || preferredMethod === 'api_key') && 
          this.accessKey && this.secretKey) {
        this.setMethod('apikey');
        const log = logger.scope('Auth');
        log.info('Using API key authentication (explicit setting)');
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
      
      // Use Basic Auth for API key authentication
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
}

module.exports = AuthManager;