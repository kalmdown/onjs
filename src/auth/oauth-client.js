// src\auth\oauth-client.js
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * OAuth client for Onshape API
 */
class OAuthClient {
  constructor(config) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('OAuthClient requires clientId and clientSecret');
    }
    
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.token = null;
    this.tokenExpiry = null;
    
    // Standard Onshape OAuth scopes
    this.scope = config.scope || 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete';
    
    logger.info('OAuth client initialized');
  }

  /**
   * Get authorization URL for OAuth flow
   * @returns {string} - URL to redirect user for authentication
   */
  getAuthorizationUrl() {
    const baseUrl = 'https://oauth.onshape.com/oauth/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth redirect
   * @returns {Promise<string>} - Access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://oauth.onshape.com/oauth/token',
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        }).toString()
      });
      
      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      logger.debug('OAuth token obtained');
      
      return this.token;
    } catch (error) {
      logger.error(`Failed to exchange code for token: ${error.message}`);
      throw new Error(`OAuth token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get current token or refresh if expired
   * @returns {Promise<string>} - Valid access token
   */
  async getToken() {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      throw new Error('No valid token available. User must authenticate first.');
    }
    
    return this.token;
  }
}

module.exports = OAuthClient;
