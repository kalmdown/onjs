// src\api\endpoints\features.js
const logger = require('../../utils/logger');
const { NotFoundError, ValidationError } = require('../../utils/errors');

/**
 * API endpoints for Onshape features
 */
class FeaturesApi {
  /**
   * Create a new FeaturesApi
   * @param {OnshapeClient} client - The Onshape client instance
   */
  constructor(client) {
    if (!client) {
      throw new Error('Onshape client is required');
    }
    this.client = client;
    this.logger = logger.scope('FeaturesApi');
    
    // Log client capabilities for debugging
    this.logger.debug('FeaturesApi initialized', {
      clientType: this.client.constructor.name,
      hasGetMethod: typeof this.client.get === 'function'
    });
  }

  /**
   * Get features in a part studio
   * 
   * @param {string} documentId - Document ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} elementId - Element ID (part studio)
   * @returns {Promise<Array>} - List of features
   */
  async getFeatures(documentId, workspaceId, elementId) {
    if (!documentId || !workspaceId || !elementId) {
      throw new ValidationError('Document ID, workspace ID, and element ID are required');
    }

    try {
      this.logger.debug(`Fetching features for part studio ${elementId}`);
      
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
      
      // Use correct path format for Onshape API
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      this.logger.debug(`Making API request to: ${path}`);
      
      const response = await this.client.get(path);
      
      this.logger.debug(`Retrieved ${response.features?.length || 0} features from API`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get features: ${error.message}`, error);
      throw new Error(`Failed to get features: ${error.message}`);
    }
  }

  /**
   * Add a feature to a part studio
   * 
   * @param {string} documentId - Document ID
   * @param {Object} wvm - Workspace/version/microversion identifier
   * @param {string} elementId - Element ID (part studio)
   * @param {Object} feature - Feature definition
   * @returns {Promise<Object>} - Added feature result
   */
  async addFeature(documentId, wvm, elementId, feature) {
    if (!documentId || !wvm || !elementId) {
      throw new ValidationError('Document ID, workspace/version/microversion, and element ID are required');
    }

    if (!feature) {
      throw new ValidationError('Feature definition is required');
    }

    try {
      // Construct WVM path segment
      const wvmType = wvm.wvm || 'w';
      const wvmId = wvm.wvmid || wvm.workspaceId || wvm.versionId || wvm.microversionId;
      
      if (!wvmId) {
        throw new ValidationError('Invalid WVM identifier: missing ID');
      }
      
      const path = `/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/features`;
      
      this.logger.debug(`Adding feature to part studio ${elementId}`);
      const response = await this.client.post(path, feature);
      
      this.logger.debug(`Added feature: ${response.feature?.featureId || 'unknown'}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to add feature: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Evaluate FeatureScript in a part studio
   * 
   * @param {string} documentId - Document ID
   * @param {Object} wvm - Workspace/version/microversion identifier
   * @param {string} elementId - Element ID (part studio)
   * @param {string} script - FeatureScript code to evaluate
   * @returns {Promise<Object>} - Evaluation result
   */
  async evalFeaturescript(documentId, wvm, elementId, script) {
    if (!documentId || !wvm || !elementId) {
      throw new ValidationError('Document ID, workspace/version/microversion, and element ID are required');
    }

    if (!script) {
      throw new ValidationError('FeatureScript code is required');
    }

    try {
      // Construct WVM path segment
      const wvmType = wvm.wvm || 'w';
      const wvmId = wvm.wvmid || wvm.workspaceId || wvm.versionId || wvm.microversionId;
      
      if (!wvmId) {
        throw new ValidationError('Invalid WVM identifier: missing ID');
      }
      
      const path = `/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/featurescript`;
      
      // Prepare the request body
      const requestBody = {
        script,
        serializationVersion: "1.0.0",
        documentMicroversion: wvm.microversionId || ""
      };
      
      this.logger.debug(`Evaluating FeatureScript in part studio ${elementId}`);
      const response = await this.client.post(path, requestBody);
      
      return response;
    } catch (error) {
      this.logger.error(`Failed to evaluate FeatureScript: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get planes in a part studio
   * 
   * @param {string} documentId - Document ID
   * @param {Object} wvm - Workspace/version/microversion identifier
   * @param {string} elementId - Element ID (part studio)
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.includeCustomPlanes=false] - Whether to include custom planes
   * @returns {Promise<Array>} - List of planes
   */
  async getPlanes(documentId, wvm, elementId, options = {}) {
    if (!documentId || !wvm || !elementId) {
      throw new ValidationError('Document ID, workspace/version/microversion, and element ID are required');
    }

    try {
      this.logger.debug(`Fetching planes for element ${elementId}`);
      
      // Construct WVM path segment
      const wvmType = wvm.wvm || 'w';
      const wvmId = wvm.wvmid || wvm.workspaceId || wvm.versionId || wvm.microversionId;
      
      if (!wvmId) {
        throw new ValidationError('Invalid WVM identifier: missing ID');
      }

      // Build query parameters
      const queryParams = {};
      if (options.includeCustomPlanes) {
        queryParams.includeCustomPlanes = true;
      }
      
      // Try different API path patterns used in different API versions
      // Start with the most likely to work based on API version
      const possiblePaths = [
        `/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/referencefeatures`,
        `/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/planes`,
        `/api/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/planes`
      ];
      
      let lastError = null;
      let responseData = null;
      
      // Try each path until one succeeds
      for (const path of possiblePaths) {
        try {
          this.logger.debug(`Trying API path: ${path}`);
          responseData = await this.client.get(path, { params: queryParams });
          this.logger.debug(`Successfully retrieved planes using path: ${path}`);
          
          // If we got a valid response, break the loop
          if (responseData) {
            break;
          }
        } catch (error) {
          lastError = error;
          this.logger.debug(`Path ${path} failed with error: ${error.message}`);
          
          // Don't continue if error is not 404
          if (error.statusCode !== 404) {
            throw error;
          }
        }
      }
      
      // If we have response data, return it
      if (responseData) {
        return responseData;
      }
      
      // If all paths failed, throw the last error
      throw lastError || new Error('Failed to retrieve planes from all attempted paths');
    } catch (error) {
      this.logger.error(`Failed to get planes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify that an element is a part studio
   * 
   * @param {string} documentId - Document ID
   * @param {string} wvmType - WVM type (w, v, or m)
   * @param {string} wvmId - WVM ID
   * @param {string} elementId - Element ID
   * @returns {Promise<boolean>} - True if element is a part studio
   */
  async verifyPartStudio(documentId, wvmType, wvmId, elementId) {
    try {
      // Get element details
      const path = `/documents/d/${documentId}/${wvmType}/${wvmId}/elements/${elementId}`;
      const element = await this.client.get(path);
      
      // Check element type
      if (element && element.elementType === 'PARTSTUDIO') {
        return true;
      }
      
      throw new ValidationError(`Element ${elementId} is not a part studio (type: ${element.elementType})`);
    } catch (error) {
      this.logger.error(`Failed to verify part studio: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FeaturesApi;