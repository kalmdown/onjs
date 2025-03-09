// src\index.js
/**
 * Onshape JavaScript Client - Main module
 */

const RestApi = require('./api/rest-api');
const EndpointContainer = require('./api/endpoints');
const { createWorkspaceVersion } = require('./api/schema');
const { UnitSystem, findByNameOrId } = require('./utils/misc');
const { OnshapeParameterError } = require('./utils/errors');
const { DefaultPlane, DefaultPlaneOrientation } = require('./features/planes');

/**
 * Main Onshape client class
 */
class OnshapeClient {
  /**
   * @param {Object} config Client configuration
   */
  constructor(config) {
    this.config = config;
    
    // Initialize the REST API
    this.api = new RestApi(config);
    
    // Initialize the endpoints container with the API
    this.endpoints = new EndpointContainer(this.api);
    
    // For debugging
    console.log('OnshapeClient initialized with:', {
      hasApi: !!this.api,
      hasEndpoints: !!this.endpoints,
      apiMethods: this.api ? Object.keys(this.api).filter(k => typeof this.api[k] === 'function') : []
    });
  }

  /**
   * List all available documents
   * 
   * @returns {Promise<Array<Object>>} List of documents
   */
  async listDocuments() {
    const documents = await this.endpoints.documents();
    return documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      createdAt: doc.createdAt,
      owner: doc.owner?.name || 'Unknown',
      defaultWorkspace: doc.defaultWorkspace
    }));
  }

  /**
   * Get a document by name or ID
   * 
   * @param {Object} options Options for fetching the document
   * @param {string} [options.documentId] Document ID
   * @param {string} [options.name] Document name
   * @returns {Promise<Object>} Document object
   */
  async getDocument({ documentId, name }) {
    if (!documentId && !name) {
      throw new OnshapeParameterError('Either documentId or name must be provided');
    }

    const documents = await this.listDocuments();
    const document = findByNameOrId(documentId, name, documents);
    
    if (!document) {
      throw new OnshapeParameterError(
        `Document not found: ${documentId ? `id=${documentId}` : `name=${name}`}`
      );
    }
    
    return document;
  }

  /**
   * Create a new document
   * 
   * @param {string} name Document name
   * @param {string} [description] Document description
   * @returns {Promise<Object>} Created document
   */
  async createDocument(name, description) {
    const document = await this.endpoints.documentCreate(name, description);
    return {
      id: document.id,
      name: document.name,
      createdAt: document.createdAt,
      owner: document.owner?.name || 'Unknown',
      defaultWorkspace: document.defaultWorkspace
    };
  }

  /**
   * Create a document
   * 
   * @param {string} name Document name
   * @returns {Promise<Object>} Created document
   */
  async createDocument(name) {
    const result = await this.api.post('documents', { name });
    return {
      id: result.id,
      name: result.name,
      defaultWorkspace: result.defaultWorkspaceId
    };
  }

  /**
   * Get a document by ID
   * 
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @returns {Promise<Object>} Document
   */
  async getDocument({ documentId }) {
    const result = await this.api.get(`documents/d/${documentId}`);
    return {
      id: result.id,
      name: result.name,
      defaultWorkspace: result.defaultWorkspaceId
    };
  }

  /**
   * Delete a document
   * 
   * @param {string} documentId Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(documentId) {
    await this.endpoints.documentDelete(documentId);
  }

  /**
   * Get a part studio from a document
   * 
   * @param {Object} options Options for getting the part studio
   * @param {Object} options.document Document object
   * @param {string} [options.elementId] Element ID
   * @param {string} [options.name] Element name
   * @param {boolean} [options.wipe=false] Whether to wipe existing features
   * @returns {Promise<Object>} Part studio object
   */
  async getPartStudio({ document, elementId, name, wipe = false }) {
    const elements = await this.endpoints.documentElements(
      document.id, 
      createWorkspaceVersion(document.defaultWorkspace.id)
    );
    
    // Filter to only part studios
    const partStudios = elements.filter(e => e.elementType === 'PARTSTUDIO');
    
    let partStudio;
    
    if (elementId) {
      partStudio = partStudios.find(e => e.id === elementId);
    } else if (name) {
      partStudio = partStudios.find(e => e.name === name);
    } else if (partStudios.length > 0) {
      // Default to first part studio if no ID or name provided
      partStudio = partStudios[0];
    }
    
    if (!partStudio) {
      throw new OnshapeParameterError(
        `Part studio not found: ${elementId ? `id=${elementId}` : name ? `name=${name}` : ''}`
      );
    }
    
    // Create part studio object with methods
    const studioObj = {
      document,
      id: partStudio.id,
      name: partStudio.name,
      _api: this.api,
      _client: this,
      _features: [],
      
      /**
       * Add default planes to features list
       * @private
       */
      _initDefaultPlanes() {
        this._features = this._features.concat([
          new DefaultPlane(this, DefaultPlaneOrientation.TOP),
          new DefaultPlane(this, DefaultPlaneOrientation.FRONT),
          new DefaultPlane(this, DefaultPlaneOrientation.RIGHT)
        ]);
      },
      
      /**
       * Get features accessible as properties
       */
      get features() {
        return {
          topPlane: this._features.find(f => f.name === 'Top Plane'),
          frontPlane: this._features.find(f => f.name === 'Front Plane'),
          rightPlane: this._features.find(f => f.name === 'Right Plane')
        };
      },
      
      /**
       * Wipe all features from the part studio
       * 
       * @returns {Promise<void>}
       */
      async wipe() {
        // First create a version to preserve the current state
        // (This would require implementation)
        
        // Get all features
        const features = await this.endpoints.listFeatures(
          document.id,
          createWorkspaceVersion(document.defaultWorkspace.id),
          this.id
        );
        
        // Delete features in reverse order (newest first)
        for (const feature of [...features].reverse()) {
          if (feature.featureId) {
            await this.endpoints.deleteFeature(
              document.id,
              document.defaultWorkspace.id,
              this.id,
              feature.featureId
            );
          }
        }
        
        // Re-initialize default planes
        this._initDefaultPlanes();
      },
      
      /**
       * List all parts in the part studio
       * 
       * @returns {Promise<Array<Object>>} List of parts
       */
      async listParts() {
        const parts = await this.endpoints.listParts(
          document.id,
          createWorkspaceVersion(document.defaultWorkspace.id),
          this.id
        );
        
        // Convert to part objects
        // (This would require importing the Part class)
        return parts;
      }
    };
    
    // Initialize default planes
    studioObj._initDefaultPlanes();
    
    // Wipe features if requested
    if (wipe) {
      await studioObj.wipe();
    }
    
    return studioObj;
  }

  /**
   * Get workspaces for a document
   * 
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @returns {Promise<Array>} Workspaces
   */
  async getWorkspaces({ documentId }) {
    try {
      const result = await this.api.get(`documents/d/${documentId}/workspaces`);
      return result;
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }
  }

  /**
   * Get elements in a document
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @returns {Promise<Array>} List of elements
   */
  async getElements({ documentId }) {
    // First get the workspaces
    const workspaces = await this.getWorkspaces({ documentId });
    if (!workspaces || !workspaces.length) {
      throw new Error("No workspaces found for document");
    }
    
    // Use the first workspace (usually the default one)
    const workspaceId = workspaces[0].id;
    
    // Now get elements with the correct URL format
    const response = await this.api.get(`documents/d/${documentId}/w/${workspaceId}/elements`);
    return response;
  }

  /**
   * Create a new element
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @param {string} options.workspaceId Workspace ID
   * @param {string} options.name Element name
   * @param {string} options.elementType Element type (e.g., 'PARTSTUDIO')
   * @returns {Promise<Object>} Created element
   */
  async createElement({ documentId, workspaceId, name, elementType }) {
    console.log(`Creating element: ${name}, type: ${elementType}`);
    
    // For part studios, use the partstudio-specific endpoint
    if (elementType === 'PARTSTUDIO') {
      try {
        const response = await this.api.post(
          `partstudios/d/${documentId}/w/${workspaceId}`,
          { name }
        );
        
        console.log('Element creation response:', response);
        return response;
      } catch (error) {
        console.error('Error creating part studio:', error);
        throw error;
      }
    } else {
      // For other element types (assemblies, drawings, etc.)
      throw new Error(`Creation of element type ${elementType} not yet implemented`);
    }
  }

  /**
   * Create a feature
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @param {string} options.workspaceId Workspace ID
   * @param {string} options.elementId Element ID
   * @param {Object} options.feature Feature definition
   * @returns {Promise<Object>} Created feature
   */
  async createFeature({ documentId, workspaceId, elementId, feature }) {
    console.log('Creating feature:', feature);
    
    const response = await this.api.post(
      `partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
      { feature }
    );
    
    return response;
  }

  /**
   * Add an entity to a sketch
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @param {string} options.workspaceId Workspace ID
   * @param {string} options.elementId Element ID
   * @param {string} options.sketchId Sketch ID
   * @param {Object} options.entity Entity definition
   * @returns {Promise<Object>} Created entity
   */
  async addSketchEntity({ documentId, workspaceId, elementId, sketchId, entity }) {
    const response = await this.api.post(
      `partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}/entities`,
      entity
    );
    return response;
  }

  /**
   * Close a sketch
   * @param {Object} options
   * @param {string} options.documentId Document ID
   * @param {string} options.workspaceId Workspace ID
   * @param {string} options.elementId Element ID
   * @param {string} options.sketchId Sketch ID
   * @returns {Promise<Object>} Response
   */
  async closeSketch({ documentId, workspaceId, elementId, sketchId }) {
    const response = await this.api.post(
      `partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}`,
      { action: 'close' }
    );
    return response;
  }
}

module.exports = OnshapeClient;