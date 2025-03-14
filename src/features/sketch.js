// src\features\sketch.js
/**
 * Interface to the Sketch Feature
 */

const { generateId, createSketch, createCircle, createLine } = require('../api/schema');
const { FeatureError, OnshapeParameterError } = require('../utils/errors');
const { Point2D, UnitSystem, inchesToMeters } = require('../utils/misc');
const logger = require('../utils/logger');

// Create a scoped logger for the Sketch class
const log = logger.scope('Sketch');

/**
 * Represents a sketch in Onshape
 */
class Sketch {
  /**
   * @param {Object} options Sketch properties
   * @param {Object} options.partStudio The part studio that owns the sketch
   * @param {Object} options.plane The plane to base the sketch on
   * @param {string} [options.name="New Sketch"] Name of the sketch
   */
  constructor({ partStudio, plane, name = "New Sketch" }) {
    this.partStudio = partStudio;
    this.plane = plane;
    this.name = name;
    this.featureId = null;
    this.items = new Set();
    
    // Access APIs via part studio
    this._api = partStudio._api;
    this._client = partStudio._client;
    
    if (!this._api) {
      throw new Error('API access not available via partStudio');
    }
  }

  /**
   * Create a new sketch with proper async initialization
   * 
   * @param {Object} options Sketch properties
   * @param {Object} options.partStudio The part studio that owns the sketch
   * @param {Object} options.plane The plane to base the sketch on
   * @param {string} [options.name="New Sketch"] Name of the sketch
   * @returns {Promise<Sketch>} The initialized sketch
   */
  static async create(options) {
    const sketch = new Sketch(options);
    await sketch._uploadFeature();
    options.partStudio._features.push(sketch);
    return sketch;
  }
  
  /**
   * Get the IDs of the plane to sketch on
   * @private
   */
  async _getPlaneIds() {
    if (!this.plane) {
      throw new OnshapeParameterError("No plane provided for sketch");
    }

    // If plane already has a transientId, use it directly
    if (this.plane.transientId) {
      return [this.plane.transientId];
    }
    
    // Otherwise get transient IDs from plane object
    if (typeof this.plane.getTransientIds === 'function') {
      return await this.plane.getTransientIds();
    }
    
    throw new OnshapeParameterError("Invalid plane object - must have transientId or getTransientIds() method");
  }
  
  /**
   * Upload the sketch feature to Onshape
   * @private
   */
  async _uploadFeature() {
    try {
      const planeIds = await this._getPlaneIds();
      const sketchModel = createSketch({
        name: this.name,
        featureId: this.featureId,
        entities: Array.from(this.items).map(item => item.toModel())
      });
      
      // Add sketch plane parameter
      sketchModel.parameters.push({
        btType: "BTMParameterQueryList-148",
        queries: [
          {
            btType: "BTMIndividualQuery-138",
            deterministicIds: planeIds
          }
        ],
        parameterId: "sketchPlane"
      });
      
      const response = await this._api.endpoints.addFeature(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        sketchModel
      );
      
      // Process response and extract feature ID
      this._loadResponse(response);
      
      log.info(`Successfully uploaded sketch '${this.name}'`);
      
      return response;
    } catch (error) {
      log.error("Error creating sketch:", error);
      throw new FeatureError("Failed to create sketch", error);
    }
  }
  
  /**
   * Process API response and extract feature information
   * @private
   * @param {Object} response The API response
   */
  _loadResponse(response) {
    if (!response || !response.feature) {
      throw new FeatureError("Invalid API response - missing feature data");
    }
    
    this.featureId = response.feature.featureId;
    
    // Store additional feature information if needed
    this.featureType = response.feature.featureType;
    this.featureState = response.feature.featureStatus;
    
    if (!this.featureId) {
      throw new FeatureError("Failed to get valid feature ID from response");
    }
    
    return this.featureId;
  }

  /**
   * Add a circle to the sketch
   * 
   * @param {Array|Point2D} centerPoint Center of circle
   * @param {number} radius Radius of circle
   * @param {string} [unitSystem=UnitSystem.METER] Unit system for dimensions
   * @returns {Promise<Object>} The created circle
   */
  async addCircle(centerPoint, radius, unitSystem = UnitSystem.METER) {
    // Convert array to Point2D if needed
    const center = Array.isArray(centerPoint) 
      ? new Point2D(centerPoint[0], centerPoint[1]) 
      : centerPoint;
    
    // Convert radius to meters if using inches
    const radiusMeters = unitSystem === UnitSystem.INCH 
      ? inchesToMeters(radius) 
      : radius;
    
    // Create circle entity
    const entityId = generateId();
    const circle = {
      type: 'circle',
      entityId,
      center,
      radius: radiusMeters,
      toModel: function() {
        return createCircle({
          id: this.entityId,
          center: this.center,
          radius: this.radius
        });
      }
    };
    
    // Add to sketch items
    this.items.add(circle);
    
    // Update sketch in Onshape
    await this._uploadFeature();
    
    return circle;
  }
  
  /**
   * Add a line to the sketch
   * 
   * @param {Array|Point2D} startPoint Start point of line
   * @param {Array|Point2D} endPoint End point of line
   * @returns {Promise<Object>} The created line
   */
  async addLine(startPoint, endPoint) {
    // Convert arrays to Point2D if needed
    const start = Array.isArray(startPoint)
      ? new Point2D(startPoint[0], startPoint[1])
      : startPoint;
    
    const end = Array.isArray(endPoint)
      ? new Point2D(endPoint[0], endPoint[1])
      : endPoint;
    
    // Create line entity
    const entityId = generateId();
    const line = {
      type: 'line',
      entityId,
      start,
      end,
      toModel: function() {
        return createLine({
          id: this.entityId,
          start: this.start,
          end: this.end
        });
      }
    };
    
    // Add to sketch items
    this.items.add(line);
    
    // Update sketch in Onshape
    await this._uploadFeature();
    
    return line;
  }
  
  /**
   * Trace a series of points with connected lines
   * 
   * @param {Array<Array<number>>} points Array of points [x,y]
   * @param {boolean} [closePath=true] Whether to connect last point to first
   * @returns {Promise<Array>} The created lines
   */
  async tracePoints(points, closePath = true) {
    const lines = [];
    
    // Create lines between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      const line = await this.addLine(points[i], points[i + 1]);
      lines.push(line);
    }
    
    // Close the path if requested
    if (closePath && points.length > 2) {
      const closingLine = await this.addLine(points[points.length - 1], points[0]);
      lines.push(closingLine);
    }
    
    return lines;
  }
  
  /**
   * Add a rectangle defined by two corner points
   * 
   * @param {Array|Point2D} corner1 First corner point
   * @param {Array|Point2D} corner2 Opposite corner point
   * @returns {Promise<Array>} The lines making up the rectangle
   */
  async addCornerRectangle(corner1, corner2) {
    const x1 = Array.isArray(corner1) ? corner1[0] : corner1.x;
    const y1 = Array.isArray(corner1) ? corner1[1] : corner1.y;
    const x2 = Array.isArray(corner2) ? corner2[0] : corner2.x;
    const y2 = Array.isArray(corner2) ? corner2[1] : corner2.y;
    
    // Create points for all 4 corners of the rectangle
    const points = [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2]
    ];
    
    // Use tracePoints to create the rectangle (automatically closes the path)
    return await this.tracePoints(points);
  }
  
  /**
   * Get entities created by this sketch
   * @returns {Promise<Object>} Object containing face, edge, and vertex IDs
   */
  async getEntities() {
    if (!this.featureId) {
      throw new FeatureError("Sketch has no feature ID - did you call create()?");
    }
    
    const script = `
      function(context is Context, queries) {
        var feature_id = makeId("${this.featureId}");
        var faces = evaluateQuery(context, qCreatedBy(feature_id));
        return transientQueriesToStrings(faces);
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
        return { faces: [], edges: [], vertices: [] };
      }
      
      const transientIds = response.result.value.map(item => item.value);
      
      // We would normally categorize these by type (face, edge, vertex)
      // but for simplicity we'll just return the face IDs which are needed for extrusion
      return { 
        faceIds: transientIds,
        // Optionally categorize other entity types in the future
        // edges: [], // Uncomment and implement if needed
        // vertices: [] // Uncomment and implement if needed
      };
    } catch (error) {
      log.error("Error getting sketch entities:", error);
      throw new FeatureError("Failed to get sketch entities", error);
    }
  }
}

module.exports = Sketch;