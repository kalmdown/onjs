// src\client.js
/**
 * Main client for Onshape API interactions
 * Provides a simplified interface for accessing Onshape API functionality
 */
const RestApi = require('./api/rest-api');
const endpoints = require('./api/endpoints');
const { OnshapeApiError } = require('./utils/errors');
const logger = require('./utils/logger');

// Get feature classes
const PartStudio = require('./features/partStudio');

// Create scoped logger
const log = logger.scope('OnshapeClient');

/**
 * Main client for interacting with the Onshape API
 */
class OnshapeClient {
  /**
   * Create a new Onshape API client
   * 
   * @param {Object} options - Client options
   * @param {string} [options.authType='api_key'] - Authentication type ('api_key' or 'oauth')
   * @param {string} [options.accessKey] - Onshape API access key (for api_key auth)
   * @param {string} [options.secretKey] - Onshape API secret key (for api_key auth)
   * @param {string} [options.oauthToken] - OAuth token (for oauth auth)
   * @param {string} [options.baseUrl='https://cad.onshape.com/api'] - API base URL
   * @param {string} [options.unitSystem='meter'] - Default unit system to use
   */
  constructor(options = {}) {
    // Determine authentication type - prioritize options, then env var, default to api_key
    const authType = options.authType || process.env.ONSHAPE_AUTH_TYPE || 'api_key';
    
    // Validate credentials based on auth type
    if (authType === 'api_key') {
      const accessKey = options.accessKey || process.env.ONSHAPE_ACCESS_KEY;
      const secretKey = options.secretKey || process.env.ONSHAPE_SECRET_KEY;
      
      if (!accessKey || !secretKey) {
        throw new Error('accessKey and secretKey are required for API key authentication');
      }
    } else if (authType === 'oauth') {
      const oauthToken = options.oauthToken || process.env.ONSHAPE_OAUTH_TOKEN;
      
      if (!oauthToken) {
        throw new Error('oauthToken is required for OAuth authentication');
      }
    } else {
      throw new Error(`Invalid authType: ${authType}. Must be 'api_key' or 'oauth'`);
    }
    
    // Initialize REST API client
    this.api = new RestApi({
      authType: authType,
      accessKey: options.accessKey || process.env.ONSHAPE_ACCESS_KEY,
      secretKey: options.secretKey || process.env.ONSHAPE_SECRET_KEY,
      oauthToken: options.oauthToken || process.env.ONSHAPE_OAUTH_TOKEN,
      baseUrl: options.baseUrl || 'https://cad.onshape.com/api'
    });
    
    // Initialize API endpoints
    this.api.endpoints = endpoints(this.api);
    
    // Set default unit system
    this.unitSystem = options.unitSystem || 'meter';
    
    log.info(`Onshape client initialized with ${authType} authentication`);
  }
  
  /**
   * Get information about the current user
   * @returns {Promise<Object>} User info
   */
  async getUserInfo() {
    try {
      return await this.api.endpoints.getUserInfo();
    } catch (error) {
      throw new OnshapeApiError('Failed to get user info', error);
    }
  }
  
  /**
   * Create a new document
   * @param {string|object} options - Document name or options object
   * @param {string} options.name - Document name
   * @param {string} [options.description] - Document description
   * @param {boolean} [options.isPublic=false] - Whether the document is public
   * @returns {Promise<Document>} The created document
   */
  async createDocument(options) {
    const documentOptions = typeof options === 'string' 
      ? { name: options } 
      : options;
      
    if (!documentOptions.name) {
      throw new Error('Document name is required');
    }
    
    try {
      const response = await this.api.endpoints.createDocument(documentOptions);
      
      // Handle response with appropriate error checking
      if (!response || !response.id) {
        throw new Error('Invalid response from create document endpoint');
      }
      
      log.info(`Created document: ${response.name} (${response.id})`);
      
      // Return document object
      return this._createDocumentObject(response);
    } catch (error) {
      throw new OnshapeApiError('Failed to create document', error);
    }
  }
  
  /**
   * Get a document by ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Document>} The document
   */
  async getDocument(documentId) {
    if (!documentId) {
      throw new Error('Document ID is required');
    }
    
    try {
      const response = await this.api.endpoints.getDocument(documentId);
      log.info(`Retrieved document: ${response.name} (${response.id})`);
      
      // Return document object
      return this._createDocumentObject(response);
    } catch (error) {
      throw new OnshapeApiError(`Failed to get document: ${documentId}`, error);
    }
  }
  
  /**
   * List documents visible to the user
   * @param {Object} [options] - Filter options
   * @param {number} [options.limit=20] - Maximum number of results
   * @param {number} [options.offset=0] - Result offset for pagination
   * @returns {Promise<Array<Document>>} Array of documents
   */
  async listDocuments(options = {}) {
    const queryParams = {
      limit: options.limit || 20,
      offset: options.offset || 0
    };
    
    try {
      const response = await this.api.endpoints.listDocuments(queryParams);
      log.info(`Listed ${response.items?.length || 0} documents`);
      
      // Return array of document objects
      return (response.items || []).map(doc => this._createDocumentObject(doc));
    } catch (error) {
      throw new OnshapeApiError('Failed to list documents', error);
    }
  }
  
  /**
   * Create document object from API response
   * @private
   */
  _createDocumentObject(responseData) {
    // Return document representation with fallbacks for different response formats
    return {
      id: responseData.id,
      name: responseData.name,
      // Handle different response formats for workspace
      defaultWorkspace: responseData.defaultWorkspace || { 
        id: responseData.defaultWorkspaceId || responseData.workspaces?.[0]?.id 
      },
      
      // Add methods to document object
      async getDefaultPartStudio() {
        // Get elements from document
        const elements = await this.getElements();
        
        // Find first part studio
        const partStudioElement = elements.find(el => el.type === 'PARTSTUDIO');
        
        if (!partStudioElement) {
          throw new Error('No part studio found in document');
        }
        
        // Create part studio object
        return this.getPartStudio(partStudioElement.id);
      },
      
      async getElements() {
        const response = await this.api.endpoints.getElements(this.id, {
          wvm: 'w',
          wvmid: this.defaultWorkspace.id
        });
        
        return response || [];
      },
      
      async getPartStudio(elementId) {
        if (!elementId) {
          throw new Error('Element ID is required');
        }
        
        return new PartStudio({
          id: elementId,
          document: this,
          _api: this.api,
          _client: this
        });
      },
      
      async delete() {
        await this.api.endpoints.deleteDocument(this.id);
        log.info(`Deleted document: ${this.name} (${this.id})`);
        return true;
      },
      
      // Link back to API and client
      _api: this.api,
      _client: this
    };
  }
}

module.exports = OnshapeClient;