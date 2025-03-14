// src\entities\entities.js
/**
 * Interface to Onshape Parts
 */

const { FeatureError } = require('../utils/errors');

/**
 * Represents a part in an Onshape part studio
 */
class Part {
  /**
   * @param {Object} partStudio The part studio that owns the part
   * @param {Object} model The part model from the API
   */
  constructor(partStudio, model) {
    this.partStudio = partStudio;
    this._model = model;
    this._api = partStudio._api;
    this._client = partStudio._client;
  }
  
  /**
   * Get the part ID
   * @returns {string} Part ID
   */
  get id() {
    return this._model.partId;
  }
  
  /**
   * Get the part name
   * @returns {string} Part name
   */
  get name() {
    return this._model.name;
  }
  
  /**
   * Get entities of a specific type that are owned by this part
   * 
   * @param {string} entityType Type of entity ('VERTEX', 'EDGE', 'FACE', 'BODY')
   * @returns {Promise<Array<string>>} Array of transient IDs of the entities
   * @private
   */
  async _getEntitiesByType(entityType) {
    const script = `
      function(context is Context, queries) {
        var part = { "queryType" : QueryType.TRANSIENT, "transientId" : "${this.id}" } as Query;
        var part_entities = qOwnedByBody(part, EntityType.${entityType.toUpperCase()});
        return transientQueriesToStrings(evaluateQuery(context, part_entities));
      }
    `;
    
    try {
      const response = await this._api.endpoints.evalFeaturescript(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        script
      );
      
      if (!response.result || !response.result.value) {
        return [];
      }
      
      return response.result.value.map(item => item.value);
    } catch (error) {
      console.error(`Error getting ${entityType} entities:`, error);
      throw new OnshapeFeatureError(`Failed to get ${entityType} entities`, error);
    }
  }
  
  /**
   * Get all vertex entities owned by this part
   * 
   * @returns {Promise<Array<string>>} Array of vertex entity IDs
   */
  async getVertexIds() {
    return await this._getEntitiesByType('VERTEX');
  }
  
  /**
   * Get all edge entities owned by this part
   * 
   * @returns {Promise<Array<string>>} Array of edge entity IDs
   */
  async getEdgeIds() {
    return await this._getEntitiesByType('EDGE');
  }
  
    /**
     * Get all face entities owned by this part
     * 
     * @returns {Promise<Array<string>>} Array of face entity IDs
     */
    async getFaceIds() {
      return await this._getEntitiesByType('FACE');
    }
  }