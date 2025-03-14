// src\features\planes.js
/**
 * Interface to Onshape Planes
 */

const { OnshapeFeatureError } = require('../utils/x_errors');

/**
 * Default plane orientations
 */
const DefaultPlaneOrientation = {
  TOP: 'Top',
  FRONT: 'Front',
  RIGHT: 'Right'
};

/**
 * Base class for all planes
 */
class Plane {
  /**
   * @param {Object} partStudio The part studio that owns the plane
   */
  constructor(partStudio) {
    this.partStudio = partStudio;
    this._api = partStudio._api;
    this._client = partStudio._client;
  }
  
  /**
   * Get transient IDs for this plane
   * This must be implemented by derived classes
   * 
   * @returns {Promise<Array<string>>} Array of transient IDs
   */
  async getTransientIds() {
    throw new Error('getTransientIds must be implemented by derived classes');
  }
}

/**
 * Represents one of the default planes in Onshape
 */
class DefaultPlane extends Plane {
  /**
   * @param {Object} partStudio The part studio that owns the plane
   * @param {string} orientation Plane orientation (TOP, FRONT, RIGHT)
   */
  constructor(partStudio, orientation) {
    super(partStudio);
    
    if (!Object.values(DefaultPlaneOrientation).includes(orientation)) {
      throw new Error(`Invalid default plane orientation: ${orientation}`);
    }
    
    this.orientation = orientation;
  }
  
  /**
   * Get the name of the plane
   * 
   * @returns {string} Plane name (e.g., "Top Plane")
   */
  get name() {
    return `${this.orientation} Plane`;
  }
  
  /**
   * Get the transient ID of the plane
   * 
   * @returns {Promise<Array<string>>} Array with the plane's transient ID
   */
  async getTransientIds() {
    // For the default planes, we'll first try to just return the direct orientation name
    // since that matches what our frontend is expecting (TOP, FRONT, RIGHT)
    console.log(`Getting transientIds for default plane: ${this.orientation}`);
    return [this.orientation];
    
    /*
    // Old implementation that uses FeatureScript to get the IDs
    const script = `
      function(context is Context, queries) {
        return transientQueriesToStrings(evaluateQuery(context, qCreatedBy(makeId("${this.orientation}"), EntityType.FACE)));
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
        throw new OnshapeFeatureError(`Could not find default plane: ${this.orientation}`);
      }
      
      return [response.result.value[0].value];
    } catch (error) {
      console.error(`Error getting ${this.orientation} plane ID:`, error);
      throw new OnshapeFeatureError(`Failed to get ${this.orientation} plane ID`, error);
    }
    */
  }
  
  /**
   * Get a single transient ID (convenience method)
   * 
   * @returns {Promise<string>} Plane's transient ID
   */
  async getTransientId() {
    const ids = await this.getTransientIds();
    return ids[0];
  }
}

/**
 * Represents an offset plane in Onshape
 */
class OffsetPlane extends Plane {
  /**
   * @param {Object} options Offset plane properties
   * @param {Object} options.partStudio The part studio that owns the plane
   * @param {Object} options.ownerPlane The plane to offset from
   * @param {number} options.distance The offset distance
   * @param {string} [options.name="Offset Plane"] Name of the offset plane
   */
  constructor({ partStudio, ownerPlane, distance, name = "Offset Plane" }) {
    super(partStudio);
    this.ownerPlane = ownerPlane;
    this.distance = distance;
    this.name = name;
    this.featureId = null;
    
    // Create the offset plane in Onshape
    this._uploadFeature();
  }
  
  /**
   * Upload the offset plane feature to Onshape
   * @private
   */
  async _uploadFeature() {
    try {
      // Get the owner plane's IDs
      const ownerIds = await this.ownerPlane.getTransientIds();
      
      // Create the offset plane model
      const planeModel = {
        btType: "BTMFeature-134",
        featureType: "cPlane",
        name: this.name,
        suppressed: false,
        parameters: [
          {
            btType: "BTMParameterQueryList-148",
            queries: [
              {
                btType: "BTMIndividualQuery-138",
                deterministicIds: ownerIds
              }
            ],
            parameterId: "entities"
          },
          {
            btType: "BTMParameterEnum-145",
            namespace: "",
            enumName: "CPlaneType",
            value: "OFFSET",
            parameterId: "cplaneType"
          },
          {
            btType: "BTMParameterQuantity-147",
            isInteger: false,
            value: 0,
            units: "",
            expression: `${Math.abs(this.distance)} ${this._client.unitSystem === 'inch' ? 'in' : 'm'}`,
            parameterId: "offset"
          },
          {
            btType: "BTMParameterBoolean-144",
            value: this.distance < 0,
            parameterId: "oppositeDirection"
          }
        ]
      };
      
      // Upload to Onshape
      const response = await this._api.endpoints.addFeature(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        planeModel
      );
      
      this.featureId = response.feature.featureId;
      console.log(`Successfully created offset plane '${this.name}'`);
      
      // Add this plane to the part studio's features
      this.partStudio._features.push(this);
      
      return response;
    } catch (error) {
      console.error("Error creating offset plane:", error);
      throw new OnshapeFeatureError("Failed to create offset plane", error);
    }
  }
  
  /**
   * Get the transient ID of the plane
   * 
   * @returns {Promise<Array<string>>} Array with the plane's transient ID
   */
  async getTransientIds() {
    if (!this.featureId) {
      throw new OnshapeFeatureError("Cannot get transient ID for plane without a feature ID");
    }
    
    const script = `
      function(context is Context, queries) {
        var feature_id = makeId("${this.featureId}");
        var face = evaluateQuery(context, qCreatedBy(feature_id, EntityType.FACE))[0];
        return transientQueriesToStrings(face);
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
        throw new OnshapeFeatureError("Failed to get transient ID for offset plane");
      }
      
      return [response.result.value];
    } catch (error) {
      console.error("Error getting offset plane ID:", error);
      throw new OnshapeFeatureError("Failed to get offset plane ID", error);
    }
  }
  
  /**
   * Get a single transient ID (convenience method)
   * 
   * @returns {Promise<string>} Plane's transient ID
   */
  async getTransientId() {
    const ids = await this.getTransientIds();
    return ids[0];
  }
}

module.exports = {
  Plane,
  DefaultPlane,
  OffsetPlane,
  DefaultPlaneOrientation
};