// src\api\client.js
const RestClient = require('./rest-client');
const AuthManager = require('../auth/auth-manager');
const DocumentsApi = require('./endpoints/documents');
const ElementsApi = require('./endpoints/elements');
const FeaturesApi = require('./endpoints/features');
const logger = require('../utils/logger');
const config = require('../../config');

/**
 * Main Onshape API client
 */
class OnshapeClient {
  /**
   * Create a new Onshape API client
   * @param {Object} options - Client options
   * @param {AuthManager} [options.authManager] - Authentication manager instance
   * @param {string} [options.baseUrl] - API base URL
   * @param {string} [options.unitSystem='meter'] - Default unit system
   * @param {boolean} [options.debug=false] - Enable debug mode
   */
  constructor(options = {}) {
    this.logger = logger.scope('OnshapeClient');
    
    // Use provided auth manager or create a new one
    if (options.authManager) {
      this.auth = options.authManager;
      this.logger.debug('Using provided AuthManager');
    } else {
      this.auth = new AuthManager({
        baseUrl: options.baseUrl || config.onshape.baseUrl,
        accessKey: options.accessKey || process.env.ONSHAPE_ACCESS_KEY,
        secretKey: options.secretKey || process.env.ONSHAPE_SECRET_KEY,
        accessToken: options.accessToken,
        refreshToken: options.refreshToken
      });
      this.logger.debug('Created new AuthManager instance');
    }
    
    // Create REST client
    this.api = new RestClient({
      authManager: this.auth,
      baseUrl: options.baseUrl || config.onshape.baseUrl,
      debug: options.debug
    });
    
    // Set unit system
    this.unitSystem = options.unitSystem || config.auth.unitSystem || 'meter';
    
    // Initialize API endpoints
    this.documents = new DocumentsApi(this);
    this.elements = new ElementsApi(this);
    this.features = new FeaturesApi(this);
    
    this.logger.info(`Initialized with ${this.auth.getMethod() || 'unknown'} authentication`);
  }
  
  /**
   * Get user information
   * @returns {Promise<Object>} User information
   */
  async getUserInfo() {
    try {
      return await this.api.get('/users/sessioninfo');
    } catch (error) {
      this.logger.error('Failed to get user info:', error.message);
      throw error;
    }
  }
  
  /**
   * Check if the client is authenticated
   * @returns {Promise<boolean>} Whether client is authenticated
   */
  async isAuthenticated() {
    try {
      await this.getUserInfo();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Refresh OAuth token if needed
   * @returns {Promise<boolean>} Whether token was refreshed
   */
  async refreshTokenIfNeeded() {
    if (this.auth.getMethod() !== 'oauth' || !this.auth.refreshToken) {
      return false;
    }
    
    return await this.auth.refreshTokenIfNeeded();
  }
}

/**
 * Create a new Onshape client
 * @param {Object} options - Client options
 * @returns {OnshapeClient} New client instance
 */
function createClient(options = {}) {
    return new OnshapeClient(options);
  }
  
  module.exports = {
    OnshapeClient,
    createClient
  };