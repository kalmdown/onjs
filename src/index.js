// src\index.js
/**
 * Onshape JavaScript Client - Main module
 */

const RestApi = require('./api/rest-api');
const EndpointContainer = require('./api/endpoints');
const { createWorkspaceVersion } = require('./api/schema');
const { UnitSystem, findByNameOrId } = require('./utils/misc');
const { OnshapeParameterError } = require('../utils/errors');
const { DefaultPlane, DefaultPlaneOrientation } = require('../features/plane');

/**
 * Main Onshape client class
 */
class OnshapeClient {
  /**
   * @param {Object} options Client options
   * @param {Function} options.getAuthHeaders Function that returns authentication headers
   * @param {string} [options.unitSystem='inch'] Unit system to use ('inch' or 'metric')
   * @param {string} [options.baseUrl='https://cad.onshape.com/api/v6'] Base URL for the API
   */
  constructor({ 
    getAuthHeaders, 
    unitSystem = UnitSystem.INCH, 
    baseUrl = 'https://cad.onshape.com/api/v6' 
  }) {
    this.unitSystem = unitSystem;
    this._api = new RestApi({ getAuthHeaders, baseUrl });
    this._api.endpoints = new EndpointContainer(this._api);
  }

  /**
   * List all available documents
   * 
   * @returns {Promise<Array<Object>>} List of documents
   */
  async listDocuments() {
    const documents = await this._api.endpoints.documents();
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
    const document = await this._api.endpoints.documentCreate(name, description);
    return {
      id: document.id,
      name: document.name,
      createdAt: document.createdAt,
      owner: document.owner?.name || 'Unknown',
      defaultWorkspace: document.defaultWorkspace
    };
  }

  /**
   * Delete a document
   * 
   * @param {string} documentId Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(documentId) {
    await this._api.endpoints.documentDelete(documentId);
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
    const elements = await this._api.endpoints.documentElements(
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
      _api: this._api,
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
        const features = await this._api.endpoints.listFeatures(
          document.id,
          createWorkspaceVersion(document.defaultWorkspace.id),
          this.id
        );
        
        // Delete features in reverse order (newest first)
        for (const feature of [...features].reverse()) {
          if (feature.featureId) {
            await this._api.endpoints.deleteFeature(
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
        const parts = await this._api.endpoints.listParts(
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
}

module.exports = OnshapeClient;