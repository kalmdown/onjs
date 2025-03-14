// src/models/document.js
const { NotFoundError } = require('../utils/errors');

/**
 * Document model representing an Onshape document
 */
class Document {
  /**
   * Create a Document instance from API response
   * @param {Object} data - Raw document data from API
   * @param {Object} client - Onshape client instance
   */
  constructor(data, client) {
    // Essential properties
    this.id = data.id;
    this.name = data.name;
    this.owner = data.owner;
    this.ownerType = data.ownerType;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : null;
    this.modifiedAt = data.modifiedAt ? new Date(data.modifiedAt) : null;
    this.description = data.description || '';
    this.isPublic = data.isPublic || false;
    
    // References
    this.defaultWorkspace = data.defaultWorkspace || { 
      id: data.defaultWorkspaceId || (data.workspaces && data.workspaces[0] ? data.workspaces[0].id : null) 
    };
    
    // Store original data for reference
    this._data = data;
    
    // Store client reference
    this._client = client;
  }
  
  /**
   * Get all workspaces for this document
   * @returns {Promise<Array>} List of workspaces
   */
  async getWorkspaces() {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    return await this._client.documents.getWorkspaces(this.id);
  }
  
  /**
   * Get all elements for this document
   * @param {string} [workspaceId] - Optional workspace ID (defaults to default workspace)
   * @returns {Promise<Array>} List of elements
   */
  async getElements(workspaceId) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    const wsId = workspaceId || this.defaultWorkspace.id;
    
    if (!wsId) {
      throw new NotFoundError('No workspace available for document');
    }
    
    return await this._client.elements.getWorkspaceElements(this.id, wsId);
  }
  
  /**
   * Create a new element in this document
   * @param {Object} options - Element options
   * @param {string} options.name - Element name
   * @param {string} options.elementType - Element type (PARTSTUDIO, ASSEMBLY, etc.)
   * @param {string} [options.workspaceId] - Optional workspace ID (defaults to default workspace)
   * @returns {Promise<Object>} Created element
   */
  async createElement(options) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    const workspaceId = options.workspaceId || this.defaultWorkspace.id;
    
    if (!workspaceId) {
      throw new NotFoundError('No workspace available for document');
    }
    
    return await this._client.elements.createElement({
      documentId: this.id,
      workspaceId,
      name: options.name,
      elementType: options.elementType
    });
  }
  
  /**
   * Delete this document
   * @param {boolean} [forever=false] - Permanently delete (true) or move to trash (false)
   * @returns {Promise<boolean>} Success status
   */
  async delete(forever = false) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    return await this._client.documents.deleteDocument(this.id, forever);
  }
  
  /**
   * Get a URL to open the document in Onshape
   * @returns {string} URL to document
   */
  getUrl() {
    return `https://cad.onshape.com/documents/${this.id}`;
  }
  
  /**
   * Static method to create a Document from API data
   * @param {Object} data - Raw document data
   * @param {Object} client - Onshape client instance
   * @returns {Document} New Document instance
   */
  static create(data, client) {
    return new Document(data, client);
  }
  
  /**
   * Convert to plain object for JSON responses
   * @returns {Object} Plain JavaScript object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      owner: this.owner,
      ownerType: this.ownerType,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      description: this.description,
      isPublic: this.isPublic,
      defaultWorkspace: this.defaultWorkspace,
      url: this.getUrl()
    };
  }
}

module.exports = Document;