// src\entities\parts.js
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
      throw new FeatureError(`Failed to get ${entityType} entities`, error);
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

  /**
   * Get the body ID of this part
   * 
   * @returns {Promise<Array<string>>} Array with the body ID
   */
  async getBodyIds() {
    return [this.id];
  }

  /**
   * Find the face closest to a point
   * 
   * @param {Array<number>} point [x, y, z] coordinates
   * @returns {Promise<string>} ID of the closest face
   */
  async findClosestFace(point) {
    const script = `
      function(context is Context, queries) {
        var part = { "queryType" : QueryType.TRANSIENT, "transientId" : "${this.id}" } as Query;
        var faces = qOwnedByBody(part, EntityType.FACE);
        var closestFace = qClosestTo(faces, vector([${point[0]}, ${point[1]}, ${point[2]}]) * ${
          this._client.unitSystem === 'inch' ? 'inch' : 'meter'
        });
        return transientQueriesToStrings(evaluateQuery(context, closestFace));
      }
    `;
    
    try {
      const response = await this._api.endpoints.evalFeaturescript(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        script
      );
      
      if (!response.result || 
          !response.result.value || 
          !response.result.value[0] ||
          !response.result.value[0].value) {
        throw new FeatureError("Could not find closest face");
      }
      
      return response.result.value[0].value;
    } catch (error) {
      console.error("Error finding closest face:", error);
      throw new FeatureError("Failed to find closest face", error);
    }
  }
}

/**
 * Collection of parts for easier management
 */
class PartList {
  /**
   * @param {Array<Part>} parts Array of parts
   */
  constructor(parts) {
    this.parts = parts || [];
  }
  
  /**
   * Get a part by index
   * 
   * @param {number} index Index of the part
   * @returns {Part} The part at the given index
   */
  getByIndex(index) {
    if (index < 0 || index >= this.parts.length) {
      throw new Error(`Part index out of range: ${index}`);
    }
    return this.parts[index];
  }
  
  /**
   * Get a part by name
   * 
   * @param {string} name Name of the part
   * @returns {Part} The part with the given name
   */
  getByName(name) {
    const part = this.parts.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (!part) {
      throw new Error(`No part named '${name}'`);
    }
    
    return part;
  }
  
  /**
   * Get a part by ID
   * 
   * @param {string} id ID of the part
   * @returns {Part} The part with the given ID
   */
  getById(id) {
    const part = this.parts.find(p => p.id === id);
    
    if (!part) {
      throw new Error(`No part with id '${id}'`);
    }
    
    return part;
  }
  
  /**
   * Get all part IDs
   * 
   * @returns {Array<string>} Array of part IDs
   */
  getIds() {
    return this.parts.map(p => p.id);
  }
  
  /**
   * Get all part names
   * 
   * @returns {Array<string>} Array of part names
   */
  getNames() {
    return this.parts.map(p => p.name);
  }
  
  /**
   * Get the number of parts
   * 
   * @returns {number} Number of parts
   */
  get length() {
    return this.parts.length;
  }
}

module.exports = {
  Part,
  PartList
};