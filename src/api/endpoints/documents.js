// src\api\endpoints\documents.js
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
    this.client = client;
    this.api = client.api;
    this.logger = logger.scope('DocumentsApi');
  }
  
  /**
   * Get all documents
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=20] - Maximum results to return
   * @param {number} [options.offset=0] - Result offset for pagination
   * @param {string} [options.filter] - Filter criteria
   * @param {string} [options.sortColumn] - Column to sort by
   * @param {string} [options.sortOrder] - Sort order (asc, desc)
   * @returns {Promise<Array<Document>>} List of documents
   */
  async getDocuments(options = {}) {
    try {
      const queryParams = {
        limit: options.limit || 20,
        offset: options.offset || 0
      };
      
      // Add optional filters
      if (options.filter) queryParams.filter = options.filter;
      if (options.sortColumn) queryParams.sortColumn = options.sortColumn;
      if (options.sortOrder) queryParams.sortOrder = options.sortOrder;
      
      const response = await this.api.get('/documents', queryParams);
      
      // Handle different response formats (items array or direct array)
      const documents = response.items || response;
      
      this.logger.debug(`Retrieved ${documents.length} documents`);
      
      // Convert to Document models
      return documents.map(doc => new Document(doc, this.client));
    } catch (error) {
      this.logger.error('Failed to get documents:', error.message);
      throw error;
    }
  }
  
  /**
   * Get a document by ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Document>} Document model
   */
  async getDocument(documentId) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }
    
    try {
      const document = await this.api.get(`/documents/${documentId}`);
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
   * @param {Object} options - Document options
   * @param {string} options.name - Document name
   * @param {string} [options.description] - Document description
   * @param {boolean} [options.isPublic=false] - Whether document is public
   * @param {string} [options.ownerType='USER'] - Owner type (USER, COMPANY, etc.)
   * @returns {Promise<Document>} Created document
   */
  async createDocument(options) {
    const data = typeof options === 'string' 
      ? { name: options }
      : options;
      
    if (!data.name) {
      throw new ValidationError('Document name is required');
    }
    
    try {
      const document = await this.api.post('/documents', data);
      this.logger.info(`Created document: ${document.name} (${document.id})`);
      return new Document(document, this.client);
    } catch (error) {
      this.logger.error('Failed to create document:', error.message);
      throw error;
    }
  }
  
  /**
   * Delete a document
   * @param {string} documentId - Document ID
   * @param {boolean} [forever=false] - Permanently delete (true) or move to trash (false)
   * @returns {Promise<boolean>} Success status
   */
  async deleteDocument(documentId, forever = false) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }
    
    try {
      const queryParams = forever ? { forever: true } : {};
      await this.api.delete(`/documents/${documentId}`, queryParams);
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
   * @param {string} documentId - Document ID
   * @returns {Promise<Array>} List of workspaces
   */
  async getWorkspaces(documentId) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }
    
    try {
      const workspaces = await this.api.get(`/documents/${documentId}/workspaces`);
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
}

/**
 * Create a public document (works with Free accounts)
 * @param {String} name - Document name
 * @returns {Promise<Document>} Created document
 */
async createPublicDocument(name) {
    if (!name) {
      throw new ValidationError('Document name is required');
    }
    
    try {
      const document = await this.api.post('/documents', {
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
   * @param {String} query - Search query
   * @param {Object} [options] - Search options
   * @param {Number} [options.limit=20] - Maximum results to return
   * @returns {Promise<Array<Document>>} Matching documents
   */
  async findPublicDocuments(query, options = {}) {
    try {
      const queryParams = {
        q: query,
        filter: 'public',
        limit: options.limit || 20
      };
      
      const response = await this.api.get('/documents', queryParams);
      
      this.logger.debug(`Found ${response.items?.length || 0} public documents for query: ${query}`);
      
      // Convert to Document models
      return (response.items || []).map(doc => new Document(doc, this.client));
    } catch (error) {
      this.logger.error(`Failed to find public documents for query ${query}:`, error.message);
      throw error;
    }
  }
  
module.exports = DocumentsApi;