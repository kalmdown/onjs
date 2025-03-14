// src/models/feature.js
const { FeatureError } = require('../utils/errors');

/**
 * Feature model representing an Onshape feature
 */
class Feature {
  /**
   * Create a Feature instance from API response
   * @param {Object} data - Raw feature data from API
   * @param {string} documentId - Parent document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Parent element ID
   * @param {Object} client - Onshape client instance
   */
  constructor(data, documentId, workspaceId, elementId, client) {
    // Essential properties
    this.id = data.featureId || data.id;
    this.name = data.name;
    this.type = data.featureType || data.type;
    this.featureType = data.featureType || data.type;
    this.suppressed = data.suppressed || false;
    this.status = data.featureStatus || data.status;
    this.documentId = documentId;
    this.workspaceId = workspaceId;
    this.elementId = elementId;
    
    // Parameters depend on feature type
    this.parameters = data.parameters || [];
    
    // Store original data for reference
    this._data = data;
    
    // Store client reference
    this._client = client;
  }
  
  /**
   * Get the sketch entities (for sketch features)
   * @returns {Promise<Array>} List of sketch entities
   */
  async getEntities() {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'sketch' && this.featureType !== 'newSketch') {
      throw new Error('Entities are only available for sketch features');
    }
    
    // This requires a custom FeatureScript evaluation that returns all entities in a sketch
    // This would be implemented in a more comprehensive client
    throw new Error('Not implemented: getEntities');
  }
  
  /**
   * Add an entity to this sketch
   * @param {Object} entity - Entity definition
   * @returns {Promise<Object>} Added entity
   */
  async addEntity(entity) {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'sketch' && this.featureType !== 'newSketch') {
      throw new FeatureError('Entities can only be added to sketch features');
    }
    
    return await this._client.features.addSketchEntity({
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      elementId: this.elementId,
      sketchId: this.id,
      entity
    });
  }
  
  /**
   * Close this sketch
   * @returns {Promise<Object>} Result of closing sketch
   */
  async close() {
    if (!this._client) {
      throw new Error('Client not available');
    }
    
    if (this.type !== 'sketch' && this.featureType !== 'newSketch') {
      throw new FeatureError('Only sketch features can be closed');
    }
    
    return await this._client.features.closeSketch({
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      elementId: this.elementId,
      sketchId: this.id
    });
  }
  
  /**
   * Static method to create a Feature from API data
   * @param {Object} data - Raw feature data
   * @param {string} documentId - Parent document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Parent element ID
   * @param {Object} client - Onshape client instance
   * @returns {Feature} New Feature instance
   */
  static create(data, documentId, workspaceId, elementId, client) {
    return new Feature(data, documentId, workspaceId, elementId, client);
  }
  
  /**
   * Static factory method for different feature types
   * @param {string} type - Feature type
   * @param {Object} options - Feature options
   * @returns {Object} Feature definition
   */
  static createDefinition(type, options = {}) {
    switch (type.toLowerCase()) {
      case 'sketch':
        return {
          type: 'sketch',
          name: options.name || 'New Sketch',
          parameters: {
            plane: options.plane
          }
        };
        
      case 'extrude':
        return {
          type: 'extrude',
          name: options.name || 'Extrusion',
          parameters: {
            entities: { sketchId: options.sketchId },
            direction: { type: options.direction || 'positive', distance: options.depth },
            operationType: options.operationType || 'NEW'
          }
        };
        
      default:
        throw new FeatureError(`Unsupported feature type: ${type}`);
    }
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
      featureType: this.featureType,
      suppressed: this.suppressed,
      status: this.status,
      documentId: this.documentId,
      workspaceId: this.workspaceId,
      elementId: this.elementId
    };
  }
}

module.exports = Feature;