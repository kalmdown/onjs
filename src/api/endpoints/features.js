// src/api/endpoints/features.js
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
      throw new Error('OnshapeClient is required for FeaturesApi');
    }
    
    this.client = client;
    
    // Ensure logger is available
    this.logger = require('../../utils/logger').scope('Features');
    
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
      
      // Use correct path format without /api/v10 prefix (client adds this)
      const path = `partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      this.logger.debug(`Making API request to: ${path}`);
      
      // Use the exact query parameters that work from the test
      const response = await this.client.get(path, {
        params: {
          rollbackBarIndex: -1,
          includeGeometryIds: true,
          noSketchGeometry: false
        },
        headers: {
          'accept': 'application/json;charset=UTF-8; qs=0.09'
        }
      });
      
      this.logger.debug(`Retrieved features data from API`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get features: ${error.message}`, error);
      throw new Error(`Failed to get features: ${error.message}`);
    }
  }

  /**
   * Add a feature to a part studio
   * @param {string} documentId Document ID
   * @param {object} wvm Workspace/version/microversion object
   * @param {string} elementId Element ID
   * @param {object} featureData Feature data
   * @returns {Promise<object>} Feature creation response
   */
  async addFeature(documentId, wvm, elementId, featureData) {
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }
    
    if (!wvm || !wvm.wvm || !wvm.wvmid) {
      throw new ValidationError('Workspace/version/microversion is required');
    }
    
    if (!elementId) {
      throw new ValidationError('Element ID is required');
    }
    
    if (!featureData) {
      throw new ValidationError('Feature data is required');
    }
    
    const wvmType = wvm.wvm;
    const wvmId = wvm.wvmid;
    
    try {
      // Build the API path for the feature endpoint
      const path = `/partstudios/d/${documentId}/${wvmType}/${wvmId}/e/${elementId}/features`;
      
      // Ensure feature data is correctly formatted
      // Onshape expects a specific structure with a feature property
      const requestData = featureData.feature ? featureData : { feature: featureData };
      
      this.logger.debug(`Adding feature to ${path}`, { 
        documentId, 
        wvmType, 
        wvmId, 
        elementId, 
        featureType: requestData.feature.featureType || 'unknown' 
      });
      
      // Verify client has post method before calling
      if (typeof this.client.post !== 'function') {
        throw new Error('Client does not support POST method');
      }
      
      // Make the API call
      const response = await this.client.post(path, requestData);
      
      this.logger.debug('Feature added successfully');
      return response;
    } catch (error) {
      // Enhanced error handling
      const errorDetails = {
        message: error.message || 'Unknown error',
        hasResponse: !!error.response,
        statusCode: error.response?.status || 'N/A',
        responseData: error.response?.data || null,
        stack: error.stack
      };
      
      this.logger.error(`Failed to add feature: ${errorDetails.message}`, errorDetails);
      
      // Rethrow with more context
      const enhancedError = new Error(`Failed to add feature: ${errorDetails.message}`);
      enhancedError.details = errorDetails;
      enhancedError.originalError = error;
      enhancedError.statusCode = errorDetails.statusCode !== 'N/A' ? errorDetails.statusCode : 500;
      
      throw enhancedError;
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