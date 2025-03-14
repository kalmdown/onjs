// src\features\partStudio.js
/**
 * Represents an Onshape Part Studio
 */
const { OnshapeFeatureError } = require('../utils/x_errors');
const logger = require('../utils/x_logger');

// Create scoped logger
const log = logger.scope('PartStudio');

class PartStudio {
  /**
   * Create a new part studio instance
   * 
   * @param {Object} options - Part studio options
   * @param {string} options.id - Element ID of the part studio
   * @param {Object} options.document - Document containing this part studio
   * @param {Object} [options._api] - Direct API reference (optional if document has _api)
   * @param {Object} [options._client] - Client reference (optional if document has _client)
   */
  constructor({ id, document, _api, _client }) {
    this.id = id;
    this.document = document;
    
    // Support both direct injection and access via document
    this._api = _api || document._api;
    this._client = _client || document._client;
    
    if (!this._api) {
      throw new Error('API access not provided to PartStudio');
    }
    
    // Track features in this part studio
    this._features = [];
    
    log.debug(`Initialized PartStudio: ${id}`);
  }
  
  /**
   * Get reference planes in this part studio
   * @returns {Promise<Array>} - List of planes
   */
  async getPlanes() {
    try {
      const response = await this._api.endpoints.getPlanes(
        this.document.id,
        { wvm: 'w', wvmid: this.document.defaultWorkspace.id },
        this.id
      );
      
      log.debug(`Retrieved ${response.length} planes from part studio ${this.id}`);
      return response;
    } catch (error) {
      throw new OnshapeFeatureError('Failed to get planes', error);
    }
  }
  
  /**
   * Create an extrusion feature
   * 
   * @param {Object} options - Extrusion options
   * @param {string} options.sketchId - ID of the sketch to extrude
   * @param {number} options.depth - Extrusion depth
   * @param {string} [options.direction='positive'] - Direction ('positive', 'negative', or 'symmetric')
   * @returns {Promise<Object>} - Created feature
   */
  async createExtrude({ sketchId, depth, direction = 'positive' }) {
    if (!sketchId) {
      throw new Error('sketchId is required for extrusion');
    }
    
    if (typeof depth !== 'number' || depth <= 0) {
      throw new Error('Depth must be a positive number');
    }
    
    if (!['positive', 'negative', 'symmetric'].includes(direction)) {
      direction = 'positive'; // Default to positive direction
    }
    
    try {
      // Create extrusion feature definition
      const extrudeFeature = {
        type: 'extrude',
        name: 'Extrusion',
        parameters: {
          entities: {
            sketchId: sketchId
          },
          direction: {
            type: direction,
            distance: depth
          }
        }
      };
      
      // Call the Onshape API to create the extrusion feature
      const response = await this._api.endpoints.addFeature(
        this.document.id,
        { wvm: 'w', wvmid: this.document.defaultWorkspace.id },
        this.id,
        extrudeFeature
      );
      
      // Process response
      if (!response.feature) {
        throw new OnshapeFeatureError('Invalid response when creating extrusion feature');
      }
      
      log.info(`Created extrusion feature: ${response.feature.featureId}`);
      
      return {
        featureId: response.feature.featureId,
        featureType: 'extrude',
        status: response.feature.featureStatus
      };
    } catch (error) {
      throw new OnshapeFeatureError('Failed to create extrusion feature', error);
    }
  }
  
  // Add other methods as needed...
}

module.exports = PartStudio;