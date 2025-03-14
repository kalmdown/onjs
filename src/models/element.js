// src\models\element.js
const { NotFoundError } = require('../utils/errors');

/**
 * Element model representing an Onshape element (Part Studio, Assembly, etc.)
 */
class Element {
  /**
   * Create an Element instance from API response
   * @param {Object} data - Raw element data from API
   * @param {string} documentId - Parent document ID
   * @param {string} workspaceId - Workspace ID
   * @param {Object} client - Onshape client instance
   */
  constructor(data, documentId, workspaceId, client) {
    // Essential properties
    this.id = data.id;
    this.name = data.name;
    this.type = data.type || data.elementType;
    this.elementType = data.elementType || data.type;
    this.documentId = documentId;
    this.workspaceId = workspaceId;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : null;
    this.modifiedAt = data.modifiedAt ? new Date(data.modifiedAt) : null;
    this.thumbnailHref = data.thumbnailHref || null;
    
    // Store original data for reference
    this._data = data;
    
    // Store client reference
    this._client = client;
  }
  
  /**
   * Get features in this element (for part studios)
   * @returns {Promise<Array>} List of features
   */
  async getFeatures() {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'PARTSTUDIO') {
      throw new Error('Features are only available for part studios');
    }
    
    return await this._client.features.getFeatures(
      this.documentId,
      this.workspaceId,
      this.id
    );
  }
  
  /**
   * Create a sketch in this element (for part studios)
   * @param {Object} options - Sketch options
   * @param {string} options.name - Sketch name
   * @param {string|Object} options.plane - Sketch plane
   * @returns {Promise<Object>} Created sketch feature
   */
  async createSketch(options) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'PARTSTUDIO') {
      throw new Error('Sketches can only be created in part studios');
    }
    
    return await this._client.features.createSketch({
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      elementId: this.id,
      name: options.name,
      plane: options.plane
    });
  }
  
  /**
   * Create an extrude feature in this element (for part studios)
   * @param {Object} options - Extrude options
   * @param {string} options.name - Extrude name
   * @param {string} options.sketchId - Sketch ID
   * @param {number} options.depth - Extrusion depth
   * @param {string} [options.direction='positive'] - Direction (positive, negative, symmetric)
   * @param {string} [options.operationType='NEW'] - Operation type (NEW, ADD, REMOVE)
   * @returns {Promise<Object>} Created extrude feature
   */
  async createExtrude(options) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'PARTSTUDIO') {
      throw new Error('Extrudes can only be created in part studios');
    }
    
    return await this._client.features.createExtrude({
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      elementId: this.id,
      name: options.name,
      sketchId: options.sketchId,
      depth: options.depth,
      direction: options.direction || 'positive',
      operationType: options.operationType || 'NEW'
    });
  }
  
  /**
   * Get planes available in this element (for part studios)
   * @param {boolean} [includeCustomPlanes=true] - Whether to include custom planes
   * @returns {Promise<Array>} List of planes
   */
  async getPlanes(includeCustomPlanes = true) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'PARTSTUDIO') {
      throw new Error('Planes are only available for part studios');
    }
    
    return await this._client.elements.getPlanes(
      this.documentId,
      this.workspaceId,
      this.id,
      includeCustomPlanes
    );
  }
  
  /**
   * Delete this element
   * @returns {Promise<boolean>} Success status
   */
  async delete() {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    return await this._client.elements.deleteElement(
      this.documentId,
      this.workspaceId,
      this.id
    );
  }
  
  /**
   * Get a URL to open the element in Onshape
   * @returns {string} URL to element
   */
  getUrl() {
    return `https://cad.onshape.com/documents/${this.documentId}/w/${this.workspaceId}/e/${this.id}`;
  }
  
  /**
   * Static method to create an Element from API data
   * @param {Object} data - Raw element data
   * @param {string} documentId - Parent document ID
   * @param {string} workspaceId - Workspace ID
   * @param {Object} client - Onshape client instance
   * @returns {Element} New Element instance
   */
  static create(data, documentId, workspaceId, client) {
    return new Element(data, documentId, workspaceId, client);
  }
  
  /**
   * Convert to plain object for JSON responses
   * @returns {Object} Plain JavaScript object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      elementType: this.elementType,
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      thumbnailHref: this.thumbnailHref,
      url: this.getUrl()
    };
  }
}

module.exports = Element;