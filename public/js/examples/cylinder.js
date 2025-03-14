import { apiCall } from '../api.js';
import { getToken as getAuthToken } from '../clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from '../ui.js';
import { logInfo, logSuccess, logError } from '../utils/logging.js';

/**
 * Example 1: Create a Cylinder
 * 
 * This example creates a circle sketch and extrudes it to create a cylinder.
 */
export async function runExample1() {
  if (!getAuthToken()) {
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
      logSuccess(`Created new document: ${newName}`);
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
    let sketchPlane = 'TOP'; // Default
    const selectedPlane = getSelectedPlane();
    
    if (selectedPlane) {
      sketchPlane = selectedPlane.id;
      logInfo(`Using selected sketch plane: ${selectedPlane.name}`);
    } else {
      logInfo('Using default TOP plane');
    }
    
    // Step 5: Create a sketch on the selected plane
    logInfo(`Creating sketch on ${sketchPlane} plane...`);
    const sketchFeature = {
      btType: 'BTMSketch-151',
      featureType: 'newSketch',
      name: 'Base Circle',
      parameters: [{
        btType: 'BTMParameterQueryList-148',
        queries: [{
          btType: 'BTMIndividualQuery-138',
          deterministicIds: [sketchPlane]
        }],
        parameterId: 'sketchPlane'
      }]
    };
    
    logInfo(`Sketch feature payload: ${JSON.stringify(sketchFeature)}`);
    
    const sketchFeatureResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: sketchFeature }  // Wrap in the proper "feature" property
    );
    
    const sketchId = sketchFeatureResponse.feature.featureId;
    logInfo(`Created sketch with ID: ${sketchId}`);
    
    // Step 6: Draw a circle in the sketch
    logInfo('Drawing circle with radius 0.5 inches at origin...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${sketchId}/entities`,
      'POST',
      {
        type: 'BTMSketchCircle-73',
        radius: 0.5,
        xCenter: 0,
        yCenter: 0
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
      btType: 'BTMFeature-134',
      name: 'Cylinder Extrude',
      featureType: 'extrude',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualSketchRegionQuery-140',
            featureId: sketchId
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
          expression: '1 in',
          parameterId: 'depth'
        }
      ]
    };
    
    logInfo(`Extrude feature payload: ${JSON.stringify(extrudeFeature)}`);
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      { feature: extrudeFeature }  // Wrap in the proper "feature" property
    );
    
    logSuccess('Successfully created cylinder in Onshape!');
    
    const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}