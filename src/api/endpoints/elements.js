// src\api\endpoints\elements.js
const logger = require('../../utils/logger');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { getOnshapeHeaders } = require('../../utils/api-headers');

/**
 * API endpoints for Onshape elements
 */
class ElementsApi {
  /**
   * Create a new ElementsApi
   * @param {OnshapeClient} client - The Onshape client instance
   */
  constructor(client) {
    if (!client) {
      throw new Error('Onshape client is required');
    }
    this.client = client;
    this.logger = logger.scope('ElementsApi');
    
    // Log client capabilities for debugging
    this.logger.debug('ElementsApi initialized', {
      clientType: this.client.constructor.name,
      hasGetMethod: typeof this.client.get === 'function'
    });
  }
  
  /**
   * Get elements in a document
   * @param {string} documentId - Document ID
   * @param {string} [workspaceId] - Workspace ID (default: main workspace)
   * @returns {Promise<Array<Element>>} List of element models
   */
  async getElements(documentId, workspaceId) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }
    
    if (!workspaceId) {
      throw new ValidationError('Workspace ID is required');
    }

    try {
      this.logger.debug(`Fetching elements for document ${documentId} workspace ${workspaceId}`);
      
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
      
      // Use the same path format that's working in planes.js
      const path = `documents/d/${documentId}/w/${workspaceId}/elements`;
      
      this.logger.debug(`Making API request to: ${path}`);
      
      const response = await this.client.get(path, {
        headers: getOnshapeHeaders()
      });
      
      this.logger.debug(`Retrieved ${response.length || 0} elements`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get elements: ${error.message}`, error);
      throw new Error(`Failed to get elements: ${error.message}`);
    }
  }
  
  /**
   * Get elements in a specific workspace
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<Array<Element>>} List of element models
   */
  async getWorkspaceElements(documentId, workspaceId) {
    if (!documentId || !workspaceId) {
      throw new ValidationError('Document ID and workspace ID are required');
    }
    
    try {
      const elements = await this.api.get(`/documents/${documentId}/w/${workspaceId}/elements`);
      this.logger.debug(`Retrieved ${elements.length} elements for workspace ${workspaceId}`);
      
      // Convert to Element models
      return elements.map(elem => new Element(elem, documentId, workspaceId, this.client));
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Document or workspace', `${documentId}/${workspaceId}`);
      }
      this.logger.error(`Failed to get elements for workspace ${workspaceId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create a new element
   * @param {Object} options - Element options
   * @param {string} options.documentId - Document ID
   * @param {string} options.workspaceId - Workspace ID
   * @param {string} options.name - Element name
   * @param {string} options.elementType - Element type (PARTSTUDIO, ASSEMBLY, etc.)
   * @returns {Promise<Element>} Created element model
   */
  async createElement(options) {
    const { documentId, workspaceId, name, elementType } = options;
    
    if (!documentId || !workspaceId || !name || !elementType) {
      throw new ValidationError('Document ID, workspace ID, name, and elementType are required');
    }
    
    try {
      const element = await this.api.post(
        `/documents/${documentId}/w/${workspaceId}/elements`,
        { name, elementType }
      );
      this.logger.info(`Created ${elementType} element: ${name} (${element.id})`);
      
      // Return as Element model
      return new Element(element, documentId, workspaceId, this.client);
    } catch (error) {
      this.logger.error(`Failed to create element in document ${documentId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Delete an element
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Element ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteElement(documentId, workspaceId, elementId) {
    if (!documentId || !workspaceId || !elementId) {
      throw new ValidationError('Document ID, workspace ID, and element ID are required');
    }
    
    try {
      await this.api.delete(`/documents/${documentId}/w/${workspaceId}/elements/${elementId}`);
      this.logger.info(`Deleted element ${elementId}`);
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Element', elementId);
      }
      this.logger.error(`Failed to delete element ${elementId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get available planes for sketching in an element
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Element ID
   * @param {boolean} [includeCustomPlanes=true] - Whether to include custom planes
   * @returns {Promise<Array>} List of planes
   */
  async getPlanes(documentId, workspaceId, elementId, includeCustomPlanes = true) {
    if (!documentId || !workspaceId || !elementId) {
      throw new ValidationError('Document ID, workspace ID, and element ID are required');
    }
    
    try {
      // Always include standard planes
      const planes = [
        { id: `${elementId}_TOP`, name: 'Top Plane', transientId: 'TOP', type: 'default' },
        { id: `${elementId}_FRONT`, name: 'Front Plane', transientId: 'FRONT', type: 'default' },
        { id: `${elementId}_RIGHT`, name: 'Right Plane', transientId: 'RIGHT', type: 'default' }
      ];
      
      // If custom planes are requested, fetch them
      if (includeCustomPlanes) {
        try {
          // Get features to find custom planes
          const url = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
          const featuresResponse = await this.api.get(url);
          
          if (featuresResponse && featuresResponse.features) {
            // Filter for plane features
            const customPlaneFeatures = featuresResponse.features.filter(feature => {
              return (
                // Look for custom datum planes
                (feature.featureType === "cPlane" || feature.featureType === "datumPlane") ||
                // Also look for named plane features
                (feature.message && 
                 feature.message.name && 
                 /plane|datum/i.test(feature.message.name))
              );
            });
            
            this.logger.debug(`Found ${customPlaneFeatures.length} custom plane features`);
            
            // Add custom planes to the list
            customPlaneFeatures.forEach(feature => {
              const featureId = feature.featureId || feature.id;
              const name = feature.message?.name || 
                           feature.name || 
                           `Custom Plane ${featureId.substring(0, 6)}`;
              
              planes.push({
                id: `${elementId}_${featureId}`,
                name: name,
                transientId: featureId,
                type: 'custom',
                featureType: feature.featureType || 'unknown'
              });
            });
          }
        } catch (planeError) {
          this.logger.error('Error fetching custom planes:', planeError.message);
          // Continue with standard planes
        }
      }
      
      return planes;
    } catch (error) {
      this.logger.error(`Failed to get planes for element ${elementId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a specific element by ID
   * 
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Element ID
   * @returns {Promise<Object>} - Element details
   */
  async getElement(documentId, workspaceId, elementId) {
    if (!documentId || !workspaceId || !elementId) {
      throw new ValidationError('Document ID, workspace ID, and element ID are required');
    }

    try {
      const path = `/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
      const element = await this.client.get(path);
      
      this.logger.debug(`Retrieved element ${elementId}`);
      return element;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError('Element', elementId);
      }
      this.logger.error(`Failed to get element ${elementId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ElementsApi;