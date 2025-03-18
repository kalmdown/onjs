// src/api/endpoints/documents.js
const logger = require('../../utils/logger');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { Document } = require('../../models');

/**
 * API endpoints for Onshape documents
 */
class DocumentsApi {
  /**
   * Create a new DocumentsApi
   * @param {OnshapeClient} client - The Onshape client instance
   */
  constructor(client) {
    if (!client) {
      throw new Error('Onshape client is required');
    }
    this.client = client;
    this.logger = logger.scope('DocumentsApi');
    
    // Log client capabilities for debugging
    this.logger.debug('DocumentsApi initialized', {
      clientType: this.client.constructor.name,
      hasGetMethod: typeof this.client.get === 'function',
      hasPostMethod: typeof this.client.post === 'function'
    });
  }

  /**
   * Get documents with optional filters
   */
  async getDocuments(options = {}) {
    try {
      this.logger.debug('Fetching documents with options:', options);
      
      if (!this.client) {
        throw new Error('Onshape client not initialized');
      }
      
      if (typeof this.client.get !== 'function') {
        this.logger.error('Client does not have get method', {
          clientType: this.client.constructor.name,
          clientMethods: Object.keys(this.client).filter(k => typeof this.client[k] === 'function')
        });
        throw new Error('Client does not have get method');
      }
      
      // Use the correct API path (without /api prefix)
      const response = await this.client.get('/documents', { 
        params: {
          limit: options.limit || 20,
          offset: options.offset || 0,
          sortColumn: options.sortColumn || 'modifiedAt',
          sortOrder: options.sortOrder || 'desc'
        }
      });
      
      this.logger.debug(`Retrieved ${response.items ? response.items.length : 0} documents`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get documents: ${error.message}`, error);
      throw new Error(`Failed to get documents: ${error.message}`);
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    try {
      // Use this.client (not this.api)
      const document = await this.client.get(`/documents/${documentId}`);
      this.logger.debug(`Retrieved document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Document', documentId);
      }
      this.logger.error(`Failed to get document ${documentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a new document
   */
  async createDocument(options) {
    // Validation
    if (!options.name) {
      throw new ValidationError('Document name is required');
    }

    // Prepare request data
    const data = {
      name: options.name,
      description: options.description || '',
      isPublic: options.isPublic !== undefined ? options.isPublic : false,
      ownerType: options.ownerType !== undefined ? options.ownerType : 0 // Default to personal (0)
    };

    try {
      // Use this.client (not this.api)
      const document = await this.client.post('/documents', data);
      this.logger.debug(`Created document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      this.logger.error(`Failed to create document: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId, forever = false) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    const queryParams = {};
    if (forever) {
      queryParams.forever = true;
    }

    try {
      // Use this.client (not this.api)
      await this.client.delete(`/documents/${documentId}`, { params: queryParams });
      this.logger.debug(`Deleted document: ${documentId} (forever: ${forever})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get document workspaces
   */
  async getWorkspaces(documentId) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    try {
      // Use this.client (not this.api)
      const workspaces = await this.client.get(`/documents/${documentId}/workspaces`);
      this.logger.debug(`Retrieved ${workspaces.length} workspaces for document ${documentId}`);
      return workspaces;
    } catch (error) {
      this.logger.error(`Failed to get workspaces for document ${documentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a public document (works with Free accounts)
   */
  async createPublicDocument(name) {
    if (!name) {
      throw new ValidationError('Document name is required');
    }

    try {
      // Use this.client (not this.api)
      const document = await this.client.post('/documents', {
        name,
        description: 'Created by onJS',
        isPublic: true,
        ownerType: 0  // Personal (works with free accounts)
      });
      this.logger.debug(`Created public document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      this.logger.error(`Failed to create public document: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find public documents by search query (works with Free accounts)
   */
  async findPublicDocuments(query, options = {}) {
    try {
      const queryParams = {
        q: query,
        filter: 'public',
        limit: options.limit || 20
      };

      // Change this.api.get to this.client.get
      const response = await this.client.get('/documents', queryParams);

      this.logger.debug(`Found ${response.items?.length || 0} public documents for query: ${query}`);

      // Convert to Document models
      return (response.items || []).map(doc => new Document(doc, this.client));
    } catch (error) {
      this.logger.error(`Failed to find public documents for query ${query}:`, error.message);
      throw error;
    }
  }
}

module.exports = DocumentsApi;