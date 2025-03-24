// public/js/examples/cylinder.js
import { apiCall } from '../api.js';
import { isAuthenticated } from '../clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from '../ui.js';
import { logInfo, logError } from '../utils/logging.js';

/**
 * Example 1: Create a Cylinder
 * 
 * This example creates a circle sketch and extrudes it to create a cylinder.
 */
export async function runExample1() {
  // Replace token check with more robust authentication check
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    return;
  }
  
  logInfo('Running Example 1: Create a Cylinder');
  
  try {
    // Step 1: Get or create a document
    let onshapeDocument;
    const selectedDocument = getSelectedDocument();
    if (selectedDocument) {
      onshapeDocument = selectedDocument;
      logInfo(`Using existing document: ${onshapeDocument.name}`);
    } else {
      const newName = getDocumentName() || 'Cylinder Example';
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
          { name: 'Part Studio', elementType: 'PARTSTUDIO' }
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
      } else {
        // Custom plane
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
    
    // Step 5: Create a sketch on the selected plane
    logInfo(`Creating sketch on ${sketchPlane.name} plane...`);
    
    // Create a sketch feature with proper format for Onshape API
    const sketchFeature = {
      feature: {
        name: 'Base Circle',
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
    
    // Use the correct endpoint format for creating features
    const sketchFeatureResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`, 
      'POST',
      { feature: sketchFeature }
    );
    
    const sketchId = sketchFeatureResponse.feature.featureId;
    logInfo(`Created sketch with ID: ${sketchId}`);
    
    // Step 6: Draw a circle in the sketch
    logInfo('Drawing circle with radius 0.5 inches at origin...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${sketchId}/entities`,
      'POST',
      {
        entities: [
          {
            type: 3, // Circle
            parameters: {
              radius: 0.5,
              center: [0, 0]
            }
          }
        ]
      }
    );
    
    // Step 7: Close the sketch
    logInfo('Finalizing sketch...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${sketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Step 8: Extrude the sketch to create the cylinder
    logInfo('Extruding circle to create cylinder with height 1 inch...');
    const extrudeFeature = {
      feature: {
        name: 'Cylinder Extrude',
        featureType: 'extrude',
        parameters: [
          {
            parameterId: 'entities',
            queries: [{
              featureId: sketchId,
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
            expression: '1 in'
          }
        ]
      }
    };
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: extrudeFeature }
    );
    
    logInfo('Successfully created cylinder in Onshape!');
    
    const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    console.error('Full error:', error);
  }
}