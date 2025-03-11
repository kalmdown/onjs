// src\api\endpoints.js
/**
 * Different endpoints exposed to the RestApi object.
 * 
 * This module wraps the many Onshape endpoints in JavaScript functions.
 */

const axios = require('axios');
const OnshapeAuth = require('../auth/onshape-auth');

const auth = new OnshapeAuth({
    accessKey: process.env.ONSHAPE_ACCESS_KEY,
    secretKey: process.env.ONSHAPE_SECRET_KEY
});

function createAPI() {
  const api = axios.create({
    baseURL: 'https://cad.onshape.com/api'
  });

  // Attach authentication headers with proper signature
  api.interceptors.request.use((config) => {
    let body = '';
    if (config.data) {
      // For JSON requests, ensure payload is a string
      if (config.headers['Content-Type'] === 'application/json' && typeof config.data !== 'string') {
        body = JSON.stringify(config.data);
        config.data = body;
      } else {
        body = config.data;
      }
    }
    
    const signing = auth.signRequest(config.method, config.url, body);
    config.headers['Date'] = signing.date;
    config.headers['On-Nonce'] = signing.nonce;
    config.headers['Content-Length'] = signing.contentLength;
    config.headers['Authorization'] = `On ${process.env.ONSHAPE_ACCESS_KEY}:${signing.signature}`;

    return config;
  }, error => Promise.reject(error));

  return {
    getUserInfo: () => api.get('/users/sessioninfo'),
    createDocument: (documentData) =>
      api.post('/documents', documentData, {
        headers: { 'Content-Type': 'application/json' }
      }),
    // ...other endpoints...
  };
}

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
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID
     * @param {string} featureId Feature ID to update
     * @param {Object} feature Feature definition with ID
     * @returns {Promise<Object>} Updated feature response
     */
    async updateFeature(documentId, version, elementId, featureId, feature) {
      if (!featureId) {
        throw new Error('Feature ID is required for updating a feature');
      }
      
      return await this.api.post(
        `/partstudios/d/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}/features/featureid/${featureId}`,
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

    /**
     * Verify and get the transient ID for a named plane
     * 
     * @param {string} documentId Document ID
     * @param {Object} version Version info
     * @param {string} version.wvm Type ('w', 'v', or 'm')
     * @param {string} version.wvmid ID of workspace, version, or microversion
     * @param {string} elementId Element ID (part studio)
     * @param {string} planeName Name of the plane (e.g., "TOP", "FRONT", "RIGHT")
     * @returns {Promise<string>} The transient ID of the plane
     */
    async verifyPlaneId(documentId, version, elementId, planeName) {
      // FeatureScript to query the transient ID of standard planes
      const script = `
        function(context is Context, queries) {
          // The standard plane IDs in Onshape
          const planeIds = {
            "TOP": "JHD",
            "FRONT": "JFD", 
            "RIGHT": "JGD"
          };
          
          if (planeIds[${JSON.stringify(planeName)}] != undefined) {
            return planeIds[${JSON.stringify(planeName)}];
          }
          
          // For custom planes, we would need to add more logic here
          return "Not found";
        }
      `;
      
      const response = await this.evalFeaturescript(documentId, version, elementId, script);
      
      if (!response.result || response.result === "Not found") {
        throw new Error(`Could not verify plane ID for: ${planeName}`);
      }
      
      return response.result;
    }
  }
  
  module.exports = EndpointContainer;

/**
 * Define API endpoints
 * @param {RestApi} api The REST API instance
 * @returns {Object} Object containing all API endpoint functions
 */
function endpoints(api) {
  return {
    // User endpoints
    getUserInfo: async () => {
      return api.get('/users/sessioninfo');
    },
    
    // Document endpoints
    createDocument: async (options) => {
      return api.post('/documents', options);
    },
    
    getDocument: async (documentId) => {
      return api.get(`/documents/${documentId}`);
    },
    
    listDocuments: async (queryParams = {}) => {
      return api.get('/documents', { queryParams });
    },
    
    deleteDocument: async (documentId) => {
      return api.delete(`/documents/${documentId}`);
    },
    
    // Element endpoints
    getElements: async (documentId, params) => {
      return api.get(`/documents/d/${documentId}/${params.wvm}/${params.wvmid}/elements`);
    },
    
    // Feature endpoints
    addFeature: async (documentId, params, elementId, feature) => {
      return api.post(
        `/partstudios/d/${documentId}/${params.wvm}/${params.wvmid}/e/${elementId}/features`,
        feature
      );
    },
    
    updateFeature: async (documentId, params, elementId, featureId, feature) => {
      if (!featureId) {
        throw new Error('Feature ID is required for updating a feature');
      }
      
      return api.post(
        `/partstudios/d/${documentId}/${params.wvm}/${params.wvmid}/e/${elementId}/features/featureid/${featureId}`,
        feature
      );
    },
    
    deleteFeature: async (documentId, workspaceId, elementId, featureId) => {
      await api.delete(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features/featureid/${featureId}`
      );
    },
    
    // FeatureScript endpoints
    evalFeaturescript: async (documentId, params, elementId, script) => {
      return api.post(
        `/partstudios/d/${documentId}/${params.wvm}/${params.wvmid}/e/${elementId}/featurescript`,
        { script }
      );
    },
    
    // Part endpoints
    listParts: async (documentId, params, elementId) => {
      return api.get(
        `/parts/d/${documentId}/${params.wvm}/${params.wvmid}/e/${elementId}`
      );
    },
    
    // Plane endpoints
    getPlanes: async (documentId, params, elementId) => {
      // This might need implementation based on your API needs
      // Currently using a FeatureScript approach to get planes
      const script = `
        function(context is Context, queries) {
          var planes = {};
          
          // Standard planes
          var xyPlane = qCreatedBy(makeId("JHD"));
          var yzPlane = qCreatedBy(makeId("JFD"));
          var xzPlane = qCreatedBy(makeId("JGD"));
          
          planes["XY"] = evaluateQuery(context, xyPlane);
          planes["YZ"] = evaluateQuery(context, yzPlane);
          planes["XZ"] = evaluateQuery(context, xzPlane);
          
          return planes;
        }
      `;
      
      const result = await api.post(
        `/partstudios/d/${documentId}/${params.wvm}/${params.wvmid}/e/${elementId}/featurescript`,
        { script }
      );
      
      // Process the result into a usable format
      const planes = [];
      if (result && result.planes) {
        for (const [name, data] of Object.entries(result.planes)) {
          planes.push({
            name,
            transientId: data.id,
            normal: data.normal
          });
        }
      }
      
      return planes;
    }
  };
}

module.exports = endpoints;
module.exports = createAPI;