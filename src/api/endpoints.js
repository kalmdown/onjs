// src\api\endpoints.js
/**
 * Different endpoints exposed to the RestApi object.
 * 
 * This module wraps the many Onshape endpoints in JavaScript functions.
 */

class EndpointContainer {
    /**
     * @param {import('./rest-api')} restApi The RestApi instance
     */
    constructor(restApi) {
      this.api = restApi;
    }
  
    /**
     * Fetch a list of documents that belong to the current user
     * 
     * @returns {Promise<Array>} List of documents
     */
    async documents() {
      const response = await this.api.get('/documents');
      return response.items || [];
    }
  
    /**
     * Create a new document
     * 
     * @param {string} name Document name
     * @param {string} [description=null] Document description
     * @returns {Promise<Object>} Created document
     */
    async documentCreate(name, description = null) {
      return await this.api.post('/documents', {
        name,
        description: description || "Created with Onshape JavaScript client"
      });
    }
  
    /**
     * Delete a document
     * 
     * @param {string} documentId Document ID to delete
     * @returns {Promise<void>}
     */
    async documentDelete(documentId) {
      await this.api.delete(`/documents/${documentId}`);
    }
  
    /**
     * Fetch all elements in the specified document
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info 
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @returns {Promise<Array>} List of elements
     */
    async documentElements(documentId, version) {
      return await this.api.get(`/documents/d/${documentId}/${version.wvm}/${version.wvmid}/elements`);
    }
  
    /**
     * Evaluate a snippet of FeatureScript
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID
     * @param {string} script FeatureScript code to execute
     * @returns {Promise<Object>} Result of the FeatureScript evaluation
     */
    async evalFeaturescript(documentId, version, elementId, script) {
      return await this.api.post(
        `/partstudios/d/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}/featurescript`,
        { script }
      );
    }
  
    /**
     * List all features in a partstudio
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID
     * @returns {Promise<Array>} List of features
     */
    async listFeatures(documentId, version, elementId) {
      const response = await this.api.get(
        `/partstudios/d/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}/features`,
        { 
          rollbackBarIndex: -1, 
          includeGeometryIds: true, 
          noSketchGeometry: false 
        }
      );
      
      return response.features || [];
    }
  
    /**
     * Add a feature to the partstudio
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID
     * @param {Object} feature Feature definition
     * @returns {Promise<Object>} Added feature response
     */
    async addFeature(documentId, version, elementId, feature) {
      return await this.api.post(
        `/partstudios/d/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}/features`,
        { feature }
      );
    }
  
    /**
     * Update an existing feature
     * 
     * @param {string} documentId Document ID
     * @param {string} workspaceId Workspace ID
     * @param {string} elementId Element ID
     * @param {Object} feature Feature definition with ID
     * @returns {Promise<Object>} Updated feature response
     */
    async updateFeature(documentId, workspaceId, elementId, feature) {
      if (!feature.featureId) {
        throw new Error('Feature ID is required for updating a feature');
      }
      
      return await this.api.post(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features/featureid/${feature.featureId}`,
        { feature }
      );
    }
  
    /**
     * Delete a feature
     * 
     * @param {string} documentId Document ID
     * @param {string} workspaceId Workspace ID
     * @param {string} elementId Element ID
     * @param {string} featureId Feature ID to delete
     * @returns {Promise<void>}
     */
    async deleteFeature(documentId, workspaceId, elementId, featureId) {
      await this.api.delete(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features/featureid/${featureId}`
      );
    }
    
    /**
     * List the parts in an element
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID
     * @returns {Promise<Array>} List of parts
     */
    async listParts(documentId, version, elementId) {
      return await this.api.get(
        `/parts/d/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}`
      );
    }
  }
  
  module.exports = EndpointContainer;