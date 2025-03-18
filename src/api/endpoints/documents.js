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
  }

  /**
   * Get documents with optional filters
   */
  async getDocuments(options = {}) {
    try {
      if (!this.client) {
        throw new Error('Onshape client not initialized');
      }

      const response = await this.client.get('/documents', { // Remove '/api/' prefix
        params: {
          limit: options.limit || 20,
          offset: options.offset || 0,
          sortColumn: options.sortColumn || 'modifiedAt',
          sortOrder: options.sortOrder || 'desc'
        }
      });

      return response.data;
    } catch (error) {
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
      // Change this.api.get to this.client.get for consistency
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
    const data = typeof options === 'string' 
      ? { name: options }
      : options;

    if (!data.name) {
      throw new ValidationError('Document name is required');
    }

    try {
      // Change this.api.post to this.client.post
      const document = await this.client.post('/documents', data);
      this.logger.info(`Created document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      this.logger.error('Failed to create document:', error.message);
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

    try {
      const queryParams = forever ? { forever: true } : {};
      // Change this.api.delete to this.client.delete  
      await this.client.delete(`/documents/${documentId}`, queryParams);
      this.logger.info(`Deleted document: ${documentId}`);
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Document', documentId);
      }
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
      // Change this.api.get to this.client.get
      const workspaces = await this.client.get(`/documents/${documentId}/workspaces`);
      this.logger.debug(`Retrieved ${workspaces.length} workspaces for document ${documentId}`);
      return workspaces;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Document', documentId);
      }
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
      // Change this.api.post to this.client.post
      const document = await this.client.post('/documents', {
        name,
        isPublic: true // Required for Free accounts
      });

      this.logger.info(`Created public document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      this.logger.error('Failed to create public document:', error.message);
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