// public/js/examples/cup.js
import { apiCall } from '../api.js';
import { isAuthenticated } from '../clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from '../ui.js';
import { logInfo, logError, logDebug, logToTerminal } from '../utils/logging.js';
import { getWorkspaces, fetchElementsForDocument } from '../api.js';

/**
 * Example 3: Create a Cup
 * 
 * This example creates a cup by:
 * 1. Creating a circle sketch and extruding it to create a cylinder
 * 2. Creating a second circle sketch on the top face of the cylinder
 * 3. Cutting into the cylinder to create the cup hollow
 */
export async function runExample2() {
  // Add detailed debug logging when example is clicked
  logDebug('Cup example clicked - starting execution');
  logToTerminal('cup.js', 'Example 2: Create a Cup - execution started', 'info');
  
  // Additional log data for API tracking
  const requestId = Math.random().toString(36).substring(2, 8);
  
  // Replace token check with more robust authentication check
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    logToTerminal('cup.js', 'Authentication check failed - user not authenticated', 'error');
    return;
  }

  logInfo('Running Example 3: Create a Cup');
  
  try {
    // Log the beginning of document selection/creation
    logToTerminal('cup.js', `Starting document selection/creation (requestId: ${requestId})`, 'debug');
    
    // Step 1: Get or create a document
    let onshapeDocument;
    const selectedDocument = getSelectedDocument();
    if (selectedDocument) {
      onshapeDocument = selectedDocument;
      logInfo(`Using existing document: ${onshapeDocument.name}`);
    } else {
      const newName = getDocumentName() || 'Cup Example';
      onshapeDocument = await apiCall('documents', 'POST', { name: newName });
      logInfo(`Created new document: ${newName}`);
    }
    
    // Step 2: Get workspaces
    logInfo('Accessing part studio...');
    try {
      const workspaces = await getWorkspaces(onshapeDocument.id);
      const defaultWorkspace = workspaces[0];
      
      if (!defaultWorkspace) {
        throw new Error('No workspaces found for document');
      }
      
      // Step 3: Get or create a part studio element
      let partStudioId;
      const selectedPartStudio = getSelectedPartStudio();
      
      if (selectedPartStudio && selectedPartStudio.documentId === onshapeDocument.id) {
        partStudioId = selectedPartStudio.id;
        logInfo(`Using selected part studio: ${selectedPartStudio.name}`);
      } else {
        const elements = await fetchElementsForDocument(onshapeDocument.id);
        partStudioId = elements.find(el => el.type === 'PARTSTUDIO')?.id;
        
        if (!partStudioId) {
          logInfo('Creating new part studio...');
          const newElement = await apiCall(
            `documents/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements`, 
            'POST', 
            { name: 'Part Studio', elementType: 'PARTSTUDIO' }
          );
          partStudioId = newElement.id;
        }
      }
    } catch (error) {
      logError(`Error accessing workspaces: ${error.message}`);
      logToTerminal('cup.js', `Error in cup example: ${error.message}`, 'error', { 
        stack: error.stack,
        requestId
      });
      console.error('Full error:', error);
      return;
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
    
    // Step 5: Create a sketch on the selected plane for the cup base
    logInfo(`Creating base sketch on ${sketchPlane.name} plane...`);

    let baseSketchFeature;

    if (sketchPlane.type === "STANDARD") {
      // For standard planes, use BTMParameterEnum-145 approach
      baseSketchFeature = {
        feature: {
          name: 'Base Sketch',
          featureType: 'newSketch',
          suppressed: false,
          parameters: [
            {
              btType: 'BTMParameterEnum-145',
              value: sketchPlane.name,
              parameterId: 'sketchPlane',
              enumName: 'SketchPlane'
            },
            {
              btType: 'BTMParameterBoolean-144',
              value: true,
              parameterId: 'disableImprinting'
            }
          ],
          btType: 'BTMSketch-151',
          constraints: [],
          entities: []
        }
      };
    } else {
      // For faces and custom planes, use the query approach
      baseSketchFeature = {
        feature: {
          name: 'Base Sketch',
          featureType: 'newSketch',
          suppressed: false,
          parameters: [
            {
              btType: 'BTMParameterQueryList-148',
              queries: [{
                btType: 'BTMIndividualQuery-138',
                queryType: sketchPlane.type === "FACE" ? "FACE" : "PLANE",
                deterministic: true,
                deterministicIds: [sketchPlane.id]
              }],
              parameterId: 'sketchPlane'
            },
            {
              btType: 'BTMParameterBoolean-144',
              value: true,
              parameterId: 'disableImprinting'
            }
          ],
          btType: 'BTMSketch-151',
          constraints: [],
          entities: []
        }
      };
    }
    
    const baseSketchResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: baseSketchFeature }
    );
    
    const baseSketchId = baseSketchResponse.feature.featureId;
    logInfo(`Created base sketch with ID: ${baseSketchId}`);
    
    // Step 6: Draw the outer circle in the sketch with radius 2 inches
    logInfo('Drawing outer circle with radius 2 inches at origin...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${baseSketchId}/entities`,
      'POST',
      {
        type: 'BTMSketchCircle-73',
        radius: 2.0,
        xCenter: 0,
        yCenter: 0
      }
    );
    
    // Step 7: Close the sketch
    logInfo('Finalizing base sketch...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${baseSketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Step 8: Extrude the sketch to create the cup outer wall
    logInfo('Extruding circle to create cup outer wall with height 4 inches...');
    const extrudeFeature = {
      btType: 'BTMFeature-134',
      name: 'Cup Outer Wall',
      featureType: 'extrude',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualSketchRegionQuery-140',
            featureId: baseSketchId
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
          expression: '4 in',
          parameterId: 'depth'
        }
      ]
    };
    
    logInfo(`Extrude feature payload: ${JSON.stringify(extrudeFeature)}`);
    
    const extrudeResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: extrudeFeature }
    );
    
    // Get the ID of the created part (needed for the next step)
    const cupPartId = extrudeResponse.feature.featureId;
    logInfo(`Created cup outer wall with feature ID: ${cupPartId}`);
    
    // Step 9: Get the top face of the cup for the next sketch
    logInfo('Getting the top face of the cup...');
    
    // Query the face on top of the cup (z = 4)
    const facesQuery = {
      deterministic: true,
      queries: [
        {
          queryType: "FACE",
          filter: {
            geometryType: "PLANE",
            surfaceType: "PLANE",
            operand1: {
              comparison: "GREATER_THAN",
              geometryType: "PLANE",
              value: 3.9, // slightly below expected 4 to handle precision
              property: "Z_MIN"
            }
          }
        }
      ]
    };
    
    const facesResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/faces`,
      'POST',
      facesQuery
    );
    
    if (!facesResponse.bodies || !facesResponse.bodies[0]?.faces || facesResponse.bodies[0].faces.length === 0) {
      throw new Error('Could not find top face of cup');
    }
    
    const topFaceId = facesResponse.bodies[0].faces[0].id;
    logInfo(`Found top face with ID: ${topFaceId}`);
    
    // Step 10: Create a sketch on the top face for the inner cut
    logInfo('Creating cut profile sketch on top face...');
    const cutSketchFeature = {
      btType: 'BTMSketch-151',
      featureType: 'newSketch',
      name: 'Cut Profile',
      parameters: [{
        btType: 'BTMParameterQueryList-148',
        queries: [{
          btType: 'BTMIndividualQuery-138',
          queryType: "FACE", // Change to FACE since we're using a face
          deterministic: true,
          deterministicIds: [topFaceId]
        }],
        parameterId: 'sketchPlane'
      }]
    };
    
    const cutSketchResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: cutSketchFeature }
    );
    
    const cutSketchId = cutSketchResponse.feature.featureId;
    logInfo(`Created cut profile sketch with ID: ${cutSketchId}`);
    
    // Step 11: Draw the inner circle in the sketch with radius 1.9 inches (slightly smaller than outer)
    logInfo('Drawing inner circle with radius 1.9 inches at origin...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${cutSketchId}/entities`,
      'POST',
      {
        type: 'BTMSketchCircle-73',
        radius: 1.9,
        xCenter: 0,
        yCenter: 0
      }
    );
    
    // Step 12: Close the sketch
    logInfo('Finalizing cut profile sketch...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${cutSketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Step 13: Extrude-cut the inner circle to hollow out the cup
    logInfo('Cutting into the cup with depth 3.9 inches...');
    const cutExtrudeFeature = {
      btType: 'BTMFeature-134',
      name: 'Cup Inner Cut',
      featureType: 'extrude',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualSketchRegionQuery-140',
            featureId: cutSketchId
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
          value: 'REMOVE', // Use REMOVE to cut out material
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
          expression: '-3.9 in', // Negative to cut into the part
          parameterId: 'depth'
        }
      ]
    };
    
    console.log('Feature payload:', JSON.stringify(cutExtrudeFeature, null, 2));
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: cutExtrudeFeature }
    );
    
    logInfo('Successfully created cup in Onshape!');
    
    const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    logToTerminal('cup.js', `Error in cup example: ${error.message}`, 'error', { 
      stack: error.stack,
      requestId
    });
    console.error('Full error:', error);
  }
}

async function testPlaneIds(documentId, workspaceId, elementId) {
  const planeNames = ['TOP', 'FRONT', 'RIGHT'];
  const version = { wvm: 'w', wvmid: workspaceId };
  
  logInfo('Verifying plane IDs:');
  
  for (const name of planeNames) {
    try {
      const response = await apiCall(
        `featurescript/verifyPlane/${documentId}/${version.wvm}/${version.wvmid}/e/${elementId}`,
        'POST',
        { planeName: name }
      );
      
      logInfo(`${name} Plane: ${response.planeId}`);
    } catch (error) {
      logError(`Failed to verify ${name} plane: ${error.message}`);
    }
  }
}