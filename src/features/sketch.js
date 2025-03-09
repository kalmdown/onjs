// src\features\sketch.js
/**
 * Interface to the Sketch Feature
 */

const { generateId, createSketch, createCircle, createLine } = require('../api/schema');
const { OnshapeFeatureError, OnshapeParameterError } = require('../utils/errors');
const { Point2D, UnitSystem, inchesToMeters } = require('../utils/misc');

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
    return sketch;
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
      
      this.featureId = response.feature.featureId;
      console.log(`Successfully uploaded sketch '${this.name}'`);
      
      // Add this sketch to the part studio's features
      this.partStudio._features.push(this);
      
      return response;
    } catch (error) {
      console.error("Error creating sketch:", error);
      throw new OnshapeFeatureError("Failed to create sketch", error);
    }
  }

  /**
   * Update the sketch feature in Onshape
   * @private
   */
  async _updateFeature() {
    if (!this.featureId) {
      throw new OnshapeFeatureError("Cannot update sketch without a feature ID");
    }
    
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
      
      const response = await this._api.endpoints.updateFeature(
        this.partStudio.document.id,
        { wvm: 'w', wvmid: this.partStudio.document.defaultWorkspace.id },
        this.partStudio.id,
        this.featureId,
        sketchModel
      );
      
      console.log(`Successfully updated sketch '${this.name}'`);
      return response;
    } catch (error) {
      console.error("Error updating sketch:", error);
      throw new OnshapeFeatureError("Failed to update sketch", error);
    }
  }

  /**
   * Get the IDs of the plane for this sketch
   * @private
   * @returns {Promise<Array<string>>} Array of plane IDs
   */
  async _getPlaneIds() {
    if (this.plane.getTransientIds) {
      return await this.plane.getTransientIds();
    } else if (this.plane.transientId) {
      return [this.plane.transientId];
    } else {
      throw new OnshapeParameterError("Invalid plane specified for sketch");
    }
  }

  /**
   * Add a circle to the sketch
   * 
   * @param {Array<number>|Object} center Center point [x, y] or {x, y}
   * @param {number} radius Radius of the circle
   * @param {string} [units=null] Optional unit system to use
   * @returns {Object} The created circle entity
   */
  async addCircle(center, radius, units = null) {
    const centerPoint = center.x !== undefined 
      ? new Point2D(center.x, center.y) 
      : Point2D.fromPair(center);
    
    // Default to client's unit system if not specified
    const unitSystem = units || this._client.unitSystem;
    
    // Convert to meters if using inches
    let scaledRadius = radius;
    let scaledCenter = centerPoint;
    
    if (unitSystem === UnitSystem.INCH) {
      scaledRadius = inchesToMeters(radius);
      scaledCenter = new Point2D(
        inchesToMeters(centerPoint.x),
        inchesToMeters(centerPoint.y)
      );
    }
    
    const entityId = generateId();
    const circle = {
      type: 'circle',
      radius: scaledRadius,
      center: scaledCenter,
      entityId,
      toModel: () => createCircle({
        radius: scaledRadius,
        xCenter: scaledCenter.x,
        yCenter: scaledCenter.y,
        entityId
      })
    };
    
    this.items.add(circle);
    console.log(`Added circle to sketch: radius=${radius}, center=(${centerPoint.x}, ${centerPoint.y})`);
    
    await this._updateFeature();
    return circle;
  }

  /**
   * Add a line to the sketch
   * 
   * @param {Array<number>|Object} start Start point [x, y] or {x, y}
   * @param {Array<number>|Object} end End point [x, y] or {x, y}
   * @returns {Object} The created line entity
   */
  async addLine(start, end) {
    const startPoint = start.x !== undefined 
      ? new Point2D(start.x, start.y) 
      : Point2D.fromPair(start);
    
    const endPoint = end.x !== undefined 
      ? new Point2D(end.x, end.y) 
      : Point2D.fromPair(end);
    
    // Convert to meters if using inches
    let scaledStart = startPoint;
    let scaledEnd = endPoint;
    
    if (this._client.unitSystem === UnitSystem.INCH) {
      scaledStart = new Point2D(
        inchesToMeters(startPoint.x),
        inchesToMeters(startPoint.y)
      );
      scaledEnd = new Point2D(
        inchesToMeters(endPoint.x),
        inchesToMeters(endPoint.y)
      );
    }
    
    const entityId = generateId();
    const line = {
      type: 'line',
      start: scaledStart,
      end: scaledEnd,
      entityId,
      toModel: () => createLine({
        x1: scaledStart.x,
        y1: scaledStart.y,
        x2: scaledEnd.x,
        y2: scaledEnd.y,
        entityId
      })
    };
    
    this.items.add(line);
    console.log(`Added line to sketch: (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`);
    
    await this._updateFeature();
    return line;
  }

  /**
   * Trace a series of points with lines
   * 
   * @param {Array<Array<number>>} points Array of points [x, y]
   * @param {boolean} [endConnect=true] Whether to connect the last point to the first
   * @returns {Promise<Array>} Array of created line entities
   */
  async tracePoints(points, endConnect = true) {
    const lines = [];
    
    // Create lines between consecutive points
    for (let i = 1; i < points.length; i++) {
      const line = await this.addLine(points[i-1], points[i]);
      lines.push(line);
    }
    
    // Optionally connect the last point to the first
    if (endConnect && points.length > 2) {
      const line = await this.addLine(points[points.length - 1], points[0]);
      lines.push(line);
    }
    
    return lines;
  }

  /**
   * Add a rectangle by defining two corners
   * 
   * @param {Array<number>|Object} corner1 First corner [x, y] or {x, y}
   * @param {Array<number>|Object} corner2 Opposite corner [x, y] or {x, y}
   * @returns {Promise<Array>} Array of created line entities
   */
  async addCornerRectangle(corner1, corner2) {
    const c1 = corner1.x !== undefined ? corner1 : { x: corner1[0], y: corner1[1] };
    const c2 = corner2.x !== undefined ? corner2 : { x: corner2[0], y: corner2[1] };
    
    const points = [
      [c1.x, c1.y],
      [c2.x, c1.y],
      [c2.x, c2.y],
      [c1.x, c2.y]
    ];
    
    return await this.tracePoints(points, true);
  }

  /**
   * Get the entities associated with this sketch
   * 
   * @returns {Promise<Object>} Object with entity collections
   */
  async getEntities() {
    if (!this.featureId) {
      throw new OnshapeFeatureError("Cannot get entities for sketch without a feature ID");
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
        // Add more entity types as needed
      };
    } catch (error) {
      console.error("Error getting sketch entities:", error);
      throw new OnshapeFeatureError("Failed to get sketch entities", error);
    }
  }
}

module.exports = Sketch;