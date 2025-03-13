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
   * Create a new authentication manager
   * @param {Object} options - Auth options
   * @param {string} options.authType - Authentication type ('api_key' or 'oauth')
   * @param {string} options.accessKey - API access key (for api_key auth)
   * @param {string} options.secretKey - API secret key (for api_key auth)
   * @param {string} options.oauthToken - OAuth token (for oauth auth)
   */
  constructor(options) {
    // Use environment variables as fallback if options not provided
    this.authType = (options.authType || process.env.ONSHAPE_AUTH_TYPE || 'api_key').toLowerCase();
    this.accessKey = options.accessKey || process.env.ONSHAPE_ACCESS_KEY;
    this.secretKey = options.secretKey || process.env.ONSHAPE_SECRET_KEY;
    this.oauthToken = options.oauthToken || process.env.ONSHAPE_OAUTH_TOKEN;
    this.logger = logger.scope('AuthManager');
    
    // Validate based on auth type
    if (this.authType === 'api_key' && (!this.accessKey || !this.secretKey)) {
      throw new Error('API key authentication requires both accessKey and secretKey');
    }
    
    if (this.authType === 'oauth' && !this.oauthToken) {
      throw new Error('OAuth authentication requires an oauthToken');
    }
    
    this.logger.info(`Authentication manager initialized with ${this.authType} authentication`);
  }
  
  /**
   * Generate a cryptographically secure random nonce
   * @private
   * @returns {string} Base64-encoded nonce
   */
  _generateNonce() {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Build a sorted, encoded query string from parameters
   * @private
   * @param {Object} params - Query parameters
   * @returns {string} Encoded query string
   */
  _buildQueryString(params = {}) {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    
    // Debug logging for query params
    this.logger.debug('[AuthManager] Building query string from params:', JSON.stringify(params, null, 2));
    
    // Convert all parameters to strings and handle special cases
    const stringParams = {};
    Object.keys(params).forEach(key => {
      // Convert null/undefined to empty string, boolean to actual string 'true'/'false'
      if (params[key] === null || params[key] === undefined) {
        stringParams[key] = '';
      } else if (typeof params[key] === 'boolean') {
        stringParams[key] = params[key].toString();
      } else {
        stringParams[key] = String(params[key]);
      }
    });
    
    // Sort parameters by key (required by Onshape)
    return Object.keys(stringParams)
      .sort()
      .map(key => {
        return `${encodeURIComponent(key)}=${encodeURIComponent(stringParams[key])}`;
      })
      .join('&');
  }

  /**
   * Get authentication headers for a request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} queryParams - Query parameters
   * @param {string} body - Request body
   * @returns {Object} Headers object with authentication
   */
  getAuthHeaders(method, path, queryParams = {}, body = null) {
    if (this.authType === 'oauth') {
      // OAuth authentication - just return the token
      return {
        'Authorization': `Bearer ${this.oauthToken}`
      };
    } else {
      // API key authentication - use the official format
      return this._getApiKeyHeaders(method, path, queryParams, body);
    }
  }

  /**
   * Get OAuth authentication headers
   * @returns {Object} OAuth headers
   * @private
   */
  _getOAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.oauthToken}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Get API key authentication headers
   * Following format from official Onshape JavaScript client
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} queryParams - Query parameters
   * @param {string} body - Request body
   * @returns {Object} API key headers
   * @private
   */
  _getApiKeyHeaders(method, path, queryParams = {}, body = '') {
    // Ensure path starts with /
    const pathname = path.startsWith('/') ? path : `/${path}`;
    
    // Current date in RFC format
    const date = new Date().toUTCString();
    
    // Generate nonce
    const nonce = this._generateNonce();
    
    // Content type - always application/json for our API
    const contentType = 'application/json';

    // Build query string - must be sorted alphabetically
    const queryString = this._buildQueryString(queryParams);

    // Complete path with query string
    const fullPath = pathname + (queryString ? `?${queryString}` : '');

    // Calculate MD5 hash for body if present
    let contentMd5 = '';
    if (body && body.length > 0) {
      contentMd5 = crypto.createHash('md5').update(body).digest('base64');
    }

    // String to sign precisely as specified by Onshape API docs
    // This is the critical fix: format must be exact
    const hmacString = [
      method.toUpperCase(),
      contentMd5,
      contentType,
      date,
      nonce,
      fullPath
    ].join('\n');

    // Generate HMAC signature
    const signature = crypto.createHmac('sha256', this.secretKey)
      .update(hmacString)
      .digest('base64');

    // Build headers object
    const headers = {
      'Content-Type': contentType,
      'Accept': 'application/json',
      'Date': date,
      'On-Nonce': nonce,
      'Authorization': `On ${this.accessKey}:${signature}`
    };

    // Add MD5 hash if body is present
    if (contentMd5) {
      headers['Content-MD5'] = contentMd5;
    }

    return headers;
  }
}

module.exports = AuthManager;