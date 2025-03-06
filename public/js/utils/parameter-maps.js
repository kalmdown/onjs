/**
 * Parameter types for Onshape API
 */
export const ParameterTypes = {
  Enum: 'BTMParameterEnum-145',
  Quantity: 'BTMParameterQuantity-147',
  QueryList: 'BTMParameterQueryList-148',
  Boolean: 'BTMParameterBoolean-144',
  String: 'BTMParameterString-149'
};

/**
 * Feature types for Onshape API
 */
export const FeatureTypes = {
  Sketch: 'BTMSketch149',
  Feature: 'BTMFeature-134'
};

/**
 * Standard planes for sketches
 */
export const StandardPlanes = {
  TOP: 'TOP',
  FRONT: 'FRONT',
  RIGHT: 'RIGHT'
};

/**
 * Enum values for extrude end types
 */
export const ExtrudeEndTypes = {
  Blind: 'Blind', 
  Symmetric: 'Symmetric',
  ThroughAll: 'ThroughAll'
};

/**
 * Operation types for Boolean operations
 */
export const OperationTypes = {
  New: 'NEW',
  Add: 'ADD',
  Remove: 'REMOVE',
  Intersect: 'INTERSECT'
};

/**
 * Parameter type mappings
 */
export const parameterEnumMap = {
  sketchPlane: {
    TOP: "TOP",
    FRONT: "FRONT",
    RIGHT: "RIGHT"
  }
};