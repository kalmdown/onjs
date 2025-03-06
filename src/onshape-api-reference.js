/**
 * Onshape API Reference - Examples and Documentation
 * 
 * This file contains examples of correctly formatted API calls to the Onshape API.
 * Use these examples as references when implementing new features.
 */

const OnshapeApiExamples = {
  // Element Operations
  elements: {
    createPartStudio: {
      endpoint: `documents/:documentId/w/:workspaceId/elements`,
      method: 'POST',
      payload: { 
        name: 'Part Studio', 
        elementType: 'PARTSTUDIO' 
      },
      notes: 'Creates a new part studio element in the specified document and workspace'
    }
  },

  // Sketch Operations
  sketches: {
    createOnStandardPlane: {
      endpoint: `partstudios/d/:documentId/w/:workspaceId/e/:elementId/features`,
      method: 'POST',
      payload: {
        type: 'BTMSketch149',
        name: 'Standard Plane Sketch',
        parameters: [{
          btType: 'BTMParameterEnum-145',
          enumName: 'SketchPlane',
          value: 'TOP',  // Could also be 'FRONT' or 'RIGHT'
          parameterId: 'sketchPlane'
        }]
      },
      notes: 'Creates a sketch on one of the standard planes (TOP, FRONT, RIGHT)'
    },
    
    createOnCustomPlane: {
      endpoint: `partstudios/d/:documentId/w/:workspaceId/e/:elementId/features`,
      method: 'POST',
      payload: {
        type: 'BTMSketch149',
        name: 'Custom Plane Sketch',
        parameters: [{
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualQuery-138',
            featureId: 'JHD',  // ID of the custom plane feature
            deterministicIds: []
          }],
          parameterId: 'sketchPlane'
        }]
      },
      notes: 'Creates a sketch on a custom plane (using its feature ID)'
    },
    
    addCircle: {
      endpoint: `partstudios/d/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId/entities`,
      method: 'POST',
      payload: {
        type: 'BTMSketchCircle-73',
        radius: 1.0,
        xCenter: 0,
        yCenter: 0
      },
      notes: 'Adds a circle to an existing sketch'
    }
  },
  
  // Feature Operations
  features: {
    extrude: {
      endpoint: `partstudios/d/:documentId/w/:workspaceId/e/:elementId/features`,
      method: 'POST',
      payload: {
        type: 'BTMFeature-134',
        name: 'Simple Extrude',
        featureType: 'extrude',
        parameters: [
          {
            btType: 'BTMParameterQueryList-148',
            queries: [{
              btType: 'BTMIndividualQuery-138',
              featureId: 'JHD',  // ID of the sketch to extrude
              deterministicIds: []
            }],
            parameterId: 'entities'
          },
          {
            btType: 'BTMParameterEnum-145',
            enumName: 'ExtrudeOperationType',
            value: 'NEW',  // NEW, ADD, REMOVE, INTERSECT
            parameterId: 'operationType'
          },
          {
            btType: 'BTMParameterQuantity-147',
            value: 1.0,
            expression: '1 in',  // Always include units
            parameterId: 'depth'
          },
          {
            btType: 'BTMParameterEnum-145',
            enumName: 'ExtrudeEndType',
            value: 'Blind',  // Blind, Symmetric, ThroughAll
            parameterId: 'endType'
          }
        ]
      },
      notes: 'Creates a simple extrusion from a sketch'
    },

    createPlane: {
      endpoint: `partstudios/d/:documentId/w/:workspaceId/e/:elementId/features`,
      method: 'POST',
      payload: {
        type: 'BTMFeature-134',
        name: 'Offset Plane',
        featureType: 'plane',
        parameters: [
          {
            btType: 'BTMParameterEnum-145',
            enumName: 'PlaneType',
            value: 'OFFSET',
            parameterId: 'planeType'
          },
          {
            btType: 'BTMParameterQueryList-148',
            queries: [{
              btType: 'BTMIndividualQuery-138',
              name: 'Top',
              deterministicIds: ['TOP']
            }],
            parameterId: 'offsetEntity'
          },
          {
            btType: 'BTMParameterQuantity-147',
            value: 1.0,
            expression: '1 in',
            parameterId: 'offset'
          }
        ]
      },
      notes: 'Creates an offset plane from a standard plane'
    }
  }
};

// Common parameter types for reference
const ParameterTypes = {
  Enum: 'BTMParameterEnum-145',
  Quantity: 'BTMParameterQuantity-147',
  QueryList: 'BTMParameterQueryList-148',
  Boolean: 'BTMParameterBoolean-144',
  String: 'BTMParameterString-149'
};

// Common feature types
const FeatureTypes = {
  Sketch: 'BTMSketch149',
  Feature: 'BTMFeature-134'
};

// Standard plane references
const StandardPlanes = {
  TOP: 'TOP',
  FRONT: 'FRONT',
  RIGHT: 'RIGHT'
};

module.exports = {
  OnshapeApiExamples,
  ParameterTypes,
  FeatureTypes,
  StandardPlanes
};// src\onshape-api-reference.js
