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
   * Get authentication headers for a request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} queryParams - Query parameters
   * @param {string} body - Request body
   * @returns {Object} Headers object with authentication
   */
  getAuthHeaders(method, path, queryParams = {}, body = '') {
    if (this.authType === 'oauth') {
      return this._getOAuthHeaders();
    } else {
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
    const pathname = path.startsWith('/') ? path : `/${path}`;
    const date = new Date().toUTCString();
    const nonce = crypto.randomBytes(32).toString('base64');
    const contentType = 'application/json';

    let queryString = '';
    if (Object.keys(queryParams).length > 0) {
      queryString = '?' + Object.keys(queryParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    }
    const fullPath = pathname + queryString;

    let contentMd5 = '';
    if (body) {
      contentMd5 = crypto.createHash('md5').update(body).digest('base64');
    }

    // Use uppercase HTTP method for the HMAC string
    let hmacString = `${method.toUpperCase()}\n${fullPath}\n${contentType}\n${date}\n${nonce}`;
    if (contentMd5) {
      hmacString += `\n${contentMd5}`;
    }

    const signature = crypto.createHmac('sha256', this.secretKey)
      .update(hmacString)
      .digest('base64');

    const headers = {
      'Content-Type': contentType,
      'Accept': 'application/json',
      'Date': date,
      'On-Nonce': nonce,
      'Authorization': `On ${this.accessKey}:${signature}`,
    };

    if (contentMd5) {
      headers['Content-MD5'] = contentMd5;
    }

    this.logger.debug('Generated auth signature with HMAC string components', {
      method: method.toUpperCase(),
      path: fullPath,
      contentType,
      date,
      nonce: nonce.substring(0, 8) + '...',
      contentMd5: contentMd5 ? contentMd5.substring(0, 8) + '...' : null,
      hmacString,
    });

    return headers;
  }
}

module.exports = AuthManager;
