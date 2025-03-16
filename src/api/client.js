// src\api\client.js
const axios = require('axios');
const logger = require('../utils/logger');
const RestClient = require('./rest-client');
const DocumentsApi = require('./endpoints/documents');

/**
 * Client for interacting with the Onshape API
 */
class OnshapeClient {
  /**
   * Create a new Onshape client
   */
  constructor(options = {}) {
    if (!options.baseurl) {
      throw new Error('Base URL is required');
    }
    if (!options.authManager) {
      throw new Error('Auth manager is required');
    }

    this.logger = logger.scope('OnshapeClient');
    this.baseUrl = options.baseurl;
    this.authManager = options.authManager;
    this.debug = options.debug || false;

    // Initialize REST client
    this.api = new RestClient({
      baseUrl: this.baseUrl,
      authManager: this.authManager,
      logger: this.logger,
      debug: this.debug
    });

    // Initialize API endpoints
    this.documents = new DocumentsApi(this.api);
    this.logger.info('Initialized');
  }
}

module.exports = OnshapeClient;