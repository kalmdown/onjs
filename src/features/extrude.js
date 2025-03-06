// src\features\extrude.js
/**
 * Interface to the Extrude Feature
 */

const { createExtrude } = require('../api/schema');
const { OnshapeFeatureError } = require('../utils/errors');

/**
 * Represents an extrusion feature in Onshape
 */
class Extrude {
  /**
   * @param {Object} options Extrude properties
   * @param {Object} options.partStudio The part studio that owns the extrude
   * @param {Object} options.faces The faces to extrude (usually from a sketch)
   * @param {number} options.distance The distance to extrude
   * @param {string} [options.name="Extrusion"] Name of the extrude
   * @param {Object} [options.mergeWith=null] Optional body to merge with
   * @param {Object} [options.subtractFrom=null] Optional body to subtract from
   */
  constructor({ 
    partStudio, 
    faces, 
    distance, 
    name = "Extrusion", 
    mergeWith = null, 
    subtractFrom = null 
  }) {
    this.partStudio = partStudio;
    this.faces = faces;
    this.distance = distance;
    this.name = name;
    this.mergeWith = mergeWith;
    this.subtractFrom = subtractFrom;
    this.featureId = null;
    
    // Access APIs via part studio
    this._api = partStudio._api;
    this._client = partStudio._client;
    
    // Create the extrude in Onshape
    this._uploadFeature();
  }

  /**
   * Upload the extrude feature to Onshape
   * @private
   */
  async _uploadFeature() {
    try {
      // Get face IDs
      let faceIds;
      if (Array.isArray(this.faces)) {
        faceIds = this.faces; // Already array of IDs
      } else if (this.faces.getEntities) {
        const entities = await this.faces.getEntities();
        faceIds = entities.faceIds;
      } else if (this.faces.faceIds) {
        faceIds = this.faces.faceIds;
      } else {
        throw new OnshapeFeatureError("Invalid faces provided for extrusion");
      }
      
      // Determine operation type
      let operationType = "NEW";
      let booleanScope = [];
      
      if (this.subtractFrom) {
        operationType = "REMOVE";
        booleanScope = await this._getBodyIds(this.subtractFrom);
      } else if (this.mergeWith) {
        operationType = "ADD";
        booleanScope = await this._getBodyIds(this.mergeWith);
      }
      
      // Create the extrude model
      const extrudeModel = createExtrude({
        name: this.name,
        facesIds: faceIds,
        distance: this.distance,
        operationType,
        booleanScope
      });
      
      // Upload to Onshape
      const response = await this._api.endpoints.addFeature(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        extrudeModel
      );
      
      this.featureId = response.feature.featureId;
      console.log(`Successfully uploaded extrude '${this.name}'`);
      
      // Add this extrude to the part studio's features
      this.partStudio._features.push(this);
      
      return response;
    } catch (error) {
      console.error("Error creating extrude:", error);
      throw new OnshapeFeatureError("Failed to create extrude", error);
    }
  }

  /**
   * Get body IDs from a body or part
   * 
   * @param {Object} body The body or part to get IDs from
   * @returns {Promise<Array<string>>} Array of body IDs
   * @private
   */
  async _getBodyIds(body) {
    if (Array.isArray(body)) {
      return body; // Already array of IDs
    } else if (body.getBodyIds) {
      return await body.getBodyIds();
    } else if (body.id) {
      return [body.id];
    } else {
      throw new OnshapeFeatureError("Invalid body provided for boolean operation");
    }
  }

  /**
   * Get the parts created by this extrude
   * 
   * @returns {Promise<Array<Object>>} Array of created parts
   */
  async getCreatedParts() {
    if (!this.featureId) {
      throw new OnshapeFeatureError("Cannot get parts for extrude without a feature ID");
    }
    
    const script = `
      function(context is Context, queries) {
        var query = qCreatedBy(makeId("${this.featureId}"), EntityType.BODY);
        return transientQueriesToStrings(evaluateQuery(context, query));
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
      
      const partIds = response.result.value.map(item => item.value);
      
      // Fetch actual part data
      const parts = await this._api.endpoints.listParts(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id
      );
      
      // Filter parts that match our created IDs
      return parts.filter(part => partIds.includes(part.partId));
    } catch (error) {
      console.error("Error getting created parts:", error);
      throw new OnshapeFeatureError("Failed to get created parts", error);
    }
  }
}

module.exports = Extrude;