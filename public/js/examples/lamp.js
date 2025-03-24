// public/js/examples/lamp.js
import { apiCall } from '../api.js';
import { isAuthenticated } from '../clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from '../ui.js';
import { logInfo, logError } from '../utils/logging.js';

/**
 * Example 2: Create a Lamp
 * 
 * This example creates a more complex model with multiple features including
 * sketch, extrude, loft, and boolean operations.
 */
export async function runExample3() {
  // Replace token check with more robust authentication check
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    return;
  }

  logInfo('Running Example 2: Create a Lamp');
  
  try {
    // Step 1: Get or create a document
    let onshapeDocument;
    const selectedDocument = getSelectedDocument();
    if (selectedDocument) {
      onshapeDocument = selectedDocument;
      logInfo(`Using existing document: ${onshapeDocument.name}`);
    } else {
      const newName = getDocumentName() || 'Lamp Example';
      onshapeDocument = await apiCall('documents', 'POST', { name: newName });
      logInfo(`Created new document: ${newName}`);
    }
    
    // Step 2: Get workspaces
    logInfo('Accessing part studio...');
    const workspaces = await apiCall(`documents/${onshapeDocument.id}/workspaces`);
    const defaultWorkspace = workspaces[0];
    
    // Step 3: Get or create a part studio element
    let partStudioId;
    const selectedPartStudio = getSelectedPartStudio();
    
    if (selectedPartStudio && selectedPartStudio.documentId === onshapeDocument.id) {
      partStudioId = selectedPartStudio.id;
      logInfo(`Using selected part studio: ${selectedPartStudio.name}`);
    } else {
      const elements = await apiCall(`documents/${onshapeDocument.id}/elements`);
      partStudioId = elements.find(el => el.type === 'PARTSTUDIO')?.id;
      
      if (!partStudioId) {
        logInfo('Creating new part studio...');
        const newElement = await apiCall(
          `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements`, 
          'POST', 
          { name: 'Lamp', elementType: 'PARTSTUDIO' }
        );
        partStudioId = newElement.id;
      }
    }
    
    // Step 4: Determine which plane to use
    let sketchPlane = {
      id: "JHD", // Default to TOP plane
      name: "TOP",
      type: "STANDARD"
    };
    
    const selectedPlane = getSelectedPlane();
    if (selectedPlane) {
      // First check if this is a standard plane with a special name format
      if (selectedPlane.id && selectedPlane.id.includes('_TOP')) {
        sketchPlane = { id: "JHD", name: "TOP", type: "STANDARD" };
      } else if (selectedPlane.id && selectedPlane.id.includes('_FRONT')) {
        sketchPlane = { id: "JFD", name: "FRONT", type: "STANDARD" };
      } else if (selectedPlane.id && selectedPlane.id.includes('_RIGHT')) {
        sketchPlane = { id: "JGD", name: "RIGHT", type: "STANDARD" };
      }
      // Then check by name as a fallback
      else if (selectedPlane.name === "TOP" || selectedPlane.name.toLowerCase().includes("top plane")) {
        sketchPlane = { id: "JHD", name: "TOP", type: "STANDARD" };
      } else if (selectedPlane.name === "FRONT" || selectedPlane.name.toLowerCase().includes("front plane")) {
        sketchPlane = { id: "JFD", name: "FRONT", type: "STANDARD" };
      } else if (selectedPlane.name === "RIGHT" || selectedPlane.name.toLowerCase().includes("right plane")) {
        sketchPlane = { id: "JGD", name: "RIGHT", type: "STANDARD" };
      } else if (selectedPlane.id && selectedPlane.id.includes('_')) {
        // Looks like a face ID
        sketchPlane = { 
          id: selectedPlane.id, 
          name: selectedPlane.name || "Custom Face", 
          type: "FACE" 
        };
      } else {
        // Probably a reference plane
        sketchPlane = { 
          id: selectedPlane.id, 
          name: selectedPlane.name || "Custom Plane", 
          type: "PLANE" 
        };
      }
      
      logInfo(`Using selected sketch plane: ${sketchPlane.name} (ID: ${sketchPlane.id}, Type: ${sketchPlane.type})`);
    } else {
      logInfo('Using default TOP plane');
    }
    
    // Step 5: Create the base of the lamp
    logInfo('Creating lamp base...');
    
    // Create a sketch for the base using the selected plane
    let baseSketchFeature = {
      feature: {
        name: 'Base Sketch',
        featureType: 'newSketch',
        parameters: [
          {
            parameterId: 'sketchPlane',
            queries: [
              {
                queryType: 8,
                deterministicIds: ["TOP"]
              }
            ]
          }
        ]
      }
    };

    const baseSketchResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      baseSketchFeature
    );
    
    const baseSketchId = baseSketchResponse.feature.featureId;
    logInfo(`Created base sketch with ID: ${baseSketchId}`);
    
    // Draw the circle in the sketch
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${baseSketchId}/entities`,
      'POST',
      {
        type: 'BTMSketchCircle-73',
        radius: 2.5,
        xCenter: 0,
        yCenter: 0
      }
    );
    
    // Close the sketch
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${baseSketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Extrude the base
    const baseExtrudeFeature = {
      feature: {
        name: 'Base Extrude',
        featureType: 'extrude',
        parameters: [
          {
            parameterId: 'entities',
            queries: [{
              featureId: baseSketchId,
              queryType: 138 // BTMIndividualSketchRegionQuery
            }]
          },
          {
            parameterId: 'bodyType',
            value: 'SOLID'
          },
          {
            parameterId: 'operationType',
            value: 'NEW'
          },
          {
            parameterId: 'endBound',
            value: 'BLIND'
          },
          {
            parameterId: 'depth',
            expression: '0.5 in'
          }
        ]
      }
    };
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: baseExtrudeFeature }
    );
    
    // Step 6: Create the stem of the lamp
    logInfo('Creating lamp stem...');
    
    // Create a sketch for the stem
    const stemSketchFeature = {
      feature: {
        name: 'Stem Sketch',
        featureType: 'newSketch',
        parameters: [
          {
            parameterId: 'sketchPlane',
            queries: [
              {
                queryType: 8,
                deterministicIds: ["TOP"]
              }
            ]
          }
        ]
      }
    };
    
    const stemSketchResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: stemSketchFeature }
    );
    
    const stemSketchId = stemSketchResponse.feature.featureId;
    
    // Draw the stem circle
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${stemSketchId}/entities`,
      'POST',
      {
        type: 'BTMSketchCircle-73',
        radius: 0.3,
        xCenter: 0,
        yCenter: 0
      }
    );
    
    // Close the sketch
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${stemSketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Extrude the stem
    const stemExtrudeFeature = {
      btType: 'BTMFeature-134',
      name: 'Stem Extrude',
      featureType: 'extrude',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualSketchRegionQuery-140',
            featureId: stemSketchId
          }],
          parameterId: 'entities'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'ExtendedToolBodyType',
          value: 'SOLID',
          parameterId: 'bodyType'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'NewBodyOperationType',
          value: 'NEW',
          parameterId: 'operationType'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'BoundingType',
          value: 'BLIND',
          parameterId: 'endBound'
        },
        {
          btType: 'BTMParameterQuantity-147',
          isInteger: false,
          expression: '8.0 in',
          parameterId: 'depth'
        },
        {
          btType: 'BTMParameterQuantity-147',
          isInteger: false,
          expression: '0.5 in', // Start from the base height
          parameterId: 'offsetDistance'
        }
      ]
    };
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: stemExtrudeFeature }
    );
    
    // Step 7: Create the lampshade
    logInfo('Creating lamp shade...');
    
    // Create a sketch for the lampshade
    const shadeSketchFeature = {
      feature: {
        name: 'Shade Sketch',
        featureType: 'newSketch',
        parameters: [
          {
            parameterId: 'sketchPlane',
            queries: [
              {
                queryType: 8,
                deterministicIds: ["TOP"]
              }
            ]
          }
        ]
      }
    };
    
    const shadeSketchResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: shadeSketchFeature }
    );
    
    const shadeSketchId = shadeSketchResponse.feature.featureId;
    
    // Draw the shade profile lines
    const linesToAdd = [
      {
        type: 'BTMSketchLineSegment-155',
        startPoint: [0, 8.0, 0],
        endPoint: [2.0, 8.5, 0]
      },
      {
        type: 'BTMSketchLineSegment-155',
        startPoint: [2.0, 8.5, 0],
        endPoint: [2.5, 10.0, 0]
      },
      {
        type: 'BTMSketchLineSegment-155',
        startPoint: [2.5, 10.0, 0],
        endPoint: [0, 10.0, 0]
      },
      {
        type: 'BTMSketchLineSegment-155',
        startPoint: [0, 10.0, 0],
        endPoint: [0, 8.0, 0]
      }
    ];
    
    for (const line of linesToAdd) {
      await apiCall(
        `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${shadeSketchId}/entities`,
        'POST',
        line
      );
    }
    
    // Close the sketch
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${shadeSketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Revolve the lampshade
    const revolveFeature = {
      btType: 'BTMFeature-134',
      name: 'Shade Revolve',
      featureType: 'revolve',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualSketchRegionQuery-140',
            featureId: shadeSketchId
          }],
          parameterId: 'entities'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'RevolveSurfaceType',
          value: 'SOLID',
          parameterId: 'bodyType'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'OperationType',
          value: 'NEW',
          parameterId: 'operationType'
        },
        {
          btType: 'BTMParameterQuantity-147',
          isInteger: false,
          expression: '360 deg',
          parameterId: 'revolveAngle'
        }
      ]
    };
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: revolveFeature }
    );
    
    logInfo('Successfully created lamp in Onshape!');
    
    const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    console.error('Full error:', error);
  }
}