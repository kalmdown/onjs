// src/api/schema.js
/**
 * Schema definitions for Onshape API requests
 */

/**
 * Generate a random ID
 * 
 * @returns {string} Random ID
 */
function generateId() {
  return 'id_' + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a workspace version object
 * 
 * @param {string} workspaceId Workspace ID
 * @returns {Object} Version object
 */
function createWorkspaceVersion(workspaceId) {
  return {
    wvm: 'w',
    wvmid: workspaceId
  };
}

/**
 * Create a sketch feature definition
 * 
 * @param {Object} options Sketch options
 * @param {string} options.name Sketch name
 * @param {string} [options.featureId=null] Optional feature ID for updates
 * @param {Array} [options.entities=[]] Sketch entities
 * @returns {Object} Sketch feature definition
 */
function createSketch({ name, featureId = null, entities = [] }) {
  return {
    btType: "BTMFeature-134",
    featureType: "sketch",
    featureId: featureId || generateId(),
    name: name,
    suppressed: false,
    parameters: [
      {
        btType: "BTMParameterFeatureList-1469",
        parameterId: "entities",
        features: entities
      }
    ]
  };
}

/**
 * Create a circle entity definition
 * 
 * @param {Object} options Circle options
 * @param {number} options.radius Circle radius
 * @param {number} options.xCenter X coordinate of center
 * @param {number} options.yCenter Y coordinate of center
 * @param {string} [options.entityId=null] Optional entity ID
 * @returns {Object} Circle entity definition
 */
function createCircle({ radius, xCenter, yCenter, entityId = null }) {
  return {
    btType: "BTMSketchCurveCircle-144",
    radius: radius,
    xCenter: xCenter,
    yCenter: yCenter,
    xDirCenter: 0,
    yDirCenter: 0,
    xAxis: 1,
    yAxis: 0,
    clockwise: false,
    entityId: entityId || generateId()
  };
}

/**
 * Create a line entity definition
 * 
 * @param {Object} options Line options
 * @param {number} options.x1 X coordinate of start point
 * @param {number} options.y1 Y coordinate of start point
 * @param {number} options.x2 X coordinate of end point
 * @param {number} options.y2 Y coordinate of end point
 * @param {string} [options.entityId=null] Optional entity ID
 * @returns {Object} Line entity definition
 */
function createLine({ x1, y1, x2, y2, entityId = null }) {
  return {
    btType: "BTMSketchCurveSegment-155",
    startPointId: generateId(),
    endPointId: generateId(),
    startParam: 0,
    endParam: 1,
    parameters: [
      {
        btType: "BTMParameterPoint-25",
        parameterId: "start",
        expression: `point(${x1}, ${y1}, 0)`
      },
      {
        btType: "BTMParameterPoint-25",
        parameterId: "end",
        expression: `point(${x2}, ${y2}, 0)`
      }
    ],
    centerId: generateId(),
    entityId: entityId || generateId()
  };
}

/**
 * Create an extrude feature definition
 * 
 * @param {Object} options Extrude options
 * @param {string} options.name Extrude name
 * @param {Array<string>} options.facesIds IDs of faces to extrude
 * @param {number} options.distance Extrusion distance
 * @param {string} [options.operationType="NEW"] Operation type (NEW, ADD, REMOVE, etc.)
 * @param {Array<string>} [options.booleanScope=[]] IDs of bodies for boolean operations
 * @returns {Object} Extrude feature definition
 */
function createExtrude({ name, facesIds, distance, operationType = "NEW", booleanScope = [] }) {
  const feature = {
    btType: "BTMFeature-134",
    featureType: "extrude",
    name: name,
    suppressed: false,
    parameters: [
      {
        btType: "BTMParameterQueryList-148",
        queries: facesIds.map(id => ({
          btType: "BTMIndividualQuery-138",
          deterministicIds: [id]
        })),
        parameterId: "entities"
      },
      {
        btType: "BTMParameterEnum-145",
        namespace: "",
        enumName: "ExtrudeOperationType",
        value: operationType,
        parameterId: "operationType"
      },
      {
        btType: "BTMParameterQuantity-147",
        isInteger: false,
        value: distance,
        expression: `${distance} in`,
        parameterId: "depth"
      },
      {
        btType: "BTMParameterEnum-145",
        namespace: "",
        enumName: "ExtrudeEndType",
        value: "Blind",
        parameterId: "endType"
      }
    ]
  };
  
  // Add boolean scope if provided
  if (booleanScope.length > 0 && operationType !== "NEW") {
    feature.parameters.push({
      btType: "BTMParameterQueryList-148",
      queries: booleanScope.map(id => ({
        btType: "BTMIndividualQuery-138",
        deterministicIds: [id]
      })),
      parameterId: "booleanScope"
    });
  }
  
  return feature;
}

module.exports = {
  generateId,
  createWorkspaceVersion,
  createSketch,
  createCircle,
  createLine,
  createExtrude
};