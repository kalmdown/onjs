// src\api\endpoints\features.js
const logger = require('../../utils/logger');
const { NotFoundError, ValidationError, FeatureError } = require('../../utils/errors');

/**
 * API endpoints for Onshape features
 */
class FeaturesApi {
  /**
   * Create a new FeaturesApi
   * @param {OnshapeClient} client - The Onshape client instance
   */
  constructor(client) {
    this.client = client;
    this.api = client.api;
    this.logger = logger.scope('FeaturesApi');
  }
  
  /**
   * Get features in a part studio
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Element ID (part studio)
   * @returns {Promise<Array>} List of features
   */
  async getFeatures(documentId, workspaceId, elementId) {
    if (!documentId || !workspaceId || !elementId) {
      throw new ValidationError('Document ID, workspace ID, and element ID are required');
    }
    
    try {
      const response = await this.api.get(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`
      );
      
      const features = response.features || [];
      this.logger.debug(`Retrieved ${features.length} features for element ${elementId}`);
      return features;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Part studio', elementId);
      }
      this.logger.error(`Failed to get features for element ${elementId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create a new feature
   * @param {Object} options - Feature options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.elementId - Element ID
   * @param {Object} options.feature - Feature definition object
   * @returns {Promise<Object>} Created feature
   */
  async createFeature(options) {
    const { documentId, workspaceId, elementId, feature } = options;
    
    if (!documentId || !workspaceId || !elementId || !feature) {
      throw new ValidationError('Document ID, workspace ID, element ID, and feature definition are required');
    }
    
    try {
      const result = await this.api.post(
        `/documents/${documentId}/w/${workspaceId}/elements/${elementId}/features`,
        { feature }
      );
      
      if (!result || !result.feature) {
        throw new FeatureError('Invalid response from feature creation');
      }
      
      this.logger.info(`Created feature: ${feature.name || 'unnamed'} (${result.feature.featureId})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create feature:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create a sketch feature
   * @param {Object} options - Sketch options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.elementId - Element ID
   * @param {string} options.name - Sketch name
   * @param {string|Object} options.plane - Sketch plane ID or object
   * @returns {Promise<Object>} Created sketch feature
   */
  async createSketch(options) {
    const { documentId, workspaceId, elementId, name, plane } = options;
    
    if (!documentId || !workspaceId || !elementId || !plane) {
      throw new ValidationError('Document ID, workspace ID, element ID, and plane are required');
    }
    
    try {
      // Prepare sketch feature definition
      let sketchFeature = {
        type: 'sketch',
        name: name || 'New Sketch'
      };
      
      // Handle different plane specification formats
      if (typeof plane === 'string') {
        // Simple plane name (TOP, FRONT, RIGHT)
        sketchFeature.parameters = {
          plane: { type: 'standard', name: plane }
        };
      } else if (plane.type === 'standard') {
        // Standard plane object
        sketchFeature.parameters = {
          plane: { type: 'standard', name: plane.name }
        };
      } else if (plane.id || plane.transientId) {
        // Custom plane with ID
        const planeId = plane.transientId || plane.id;
        sketchFeature = {
          btType: 'BTMSketch-151',
          featureType: 'newSketch',
          name: name || 'New Sketch',
          parameters: [{
            btType: 'BTMParameterQueryList-148',
            queries: [{
              btType: 'BTMIndividualQuery-138',
              queryType: plane.type === "FACE" ? "FACE" : "PLANE",
              deterministic: true,
              deterministicIds: [planeId]
            }],
            parameterId: 'sketchPlane'
          }]
        };
      } else {
        throw new ValidationError('Invalid plane specification');
      }
      
      // Create the sketch feature
      const result = await this.createFeature({
        documentId,
        workspaceId,
        elementId,
        feature: sketchFeature
      });
      
      this.logger.info(`Created sketch: ${name || 'New Sketch'} (${result.feature.featureId})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create sketch:`, error.message);
      throw error;
    }
  }
  
  /**
   * Add entity to a sketch
   * @param {Object} options - Entity options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.elementId - Element ID
   * @param {string} options.sketchId - Sketch ID
   * @param {Object} options.entity - Entity definition
   * @returns {Promise<Object>} Created entity
   */
  async addSketchEntity(options) {
    const { documentId, workspaceId, elementId, sketchId, entity } = options;
    
    if (!documentId || !workspaceId || !elementId || !sketchId || !entity) {
      throw new ValidationError('Document ID, workspace ID, element ID, sketch ID, and entity are required');
    }
    
    try {
      const result = await this.api.post(
        `/documents/${documentId}/w/${workspaceId}/elements/${elementId}/sketches/${sketchId}/entities`,
        entity
      );
      
      this.logger.debug(`Added ${entity.type} to sketch ${sketchId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to add entity to sketch ${sketchId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Close a sketch
   * @param {Object} options - Sketch options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.elementId - Element ID
   * @param {string} options.sketchId - Sketch ID
   * @returns {Promise<Object>} Closed sketch result
   */
  async closeSketch(options) {
    const { documentId, workspaceId, elementId, sketchId } = options;
    
    if (!documentId || !workspaceId || !elementId || !sketchId) {
      throw new ValidationError('Document ID, workspace ID, element ID, and sketch ID are required');
    }
    
    try {
      const result = await this.api.post(
        `/documents/${documentId}/w/${workspaceId}/elements/${elementId}/sketches/${sketchId}`,
        { action: 'close' }
      );
      
      this.logger.debug(`Closed sketch ${sketchId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to close sketch ${sketchId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create an extrude feature
   * @param {Object} options - Extrusion options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.elementId - Element ID
   * @param {string} options.name - Extrude name
   * @param {string|Array} options.sketchId - Sketch ID or array of face IDs
   * @param {number} options.depth - Extrusion depth
   * @param {string} [options.direction='positive'] - Direction (positive, negative, symmetric)
   * @param {string} [options.operationType='NEW'] - Operation type (NEW, ADD, REMOVE)
   * @returns {Promise<Object>} Created extrude feature
   */
  async createExtrude(options) {
    const { 
      documentId, workspaceId, elementId, name, 
      sketchId, depth, direction = 'positive', operationType = 'NEW' 
    } = options;
    
    if (!documentId || !workspaceId || !elementId || !sketchId || depth === undefined) {
      throw new ValidationError('Document ID, workspace ID, element ID, sketchId, and depth are required');
    }
    
    try {
      // Create extrude feature definition
      const extrudeFeature = {
        type: 'extrude',
        name: name || 'Extrusion',
        parameters: {
          entities: { sketchId: sketchId },
          direction: { type: direction, distance: depth },
          operationType: operationType
        }
      };
      
      // Create the feature
      const result = await this.createFeature({
        documentId,
        workspaceId,
        elementId,
        feature: extrudeFeature
      });
      
      this.logger.info(`Created extrusion: ${name || 'Extrusion'} (${result.feature.featureId})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create extrusion:`, error.message);
      throw error;
    }
  }
}

module.exports = FeaturesApi;