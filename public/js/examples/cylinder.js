import { apiCall } from '../api.js';
import { getAuthToken } from '../auth.js';
import { getSelectedDocument, getDocumentName } from '../ui.js';
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
    const elements = await apiCall(`documents/${onshapeDocument.id}/elements`);
    let partStudioId = elements.find(el => el.type === 'PARTSTUDIO')?.id;
    
    if (!partStudioId) {
      logInfo('Creating new part studio...');
      const newElement = await apiCall(
        `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements`, 
        'POST', 
        { name: 'Part Studio', elementType: 'PARTSTUDIO' }
      );
      partStudioId = newElement.id;
    }
    
    // Step 4: Create a sketch on the top plane
    logInfo('Creating sketch on top plane...');
    const sketchFeature = {
      type: 'BTMSketch149',
      name: 'Base Circle',
      featureType: 'sketch',
      parameters: [{
        btType: 'BTMParameterEnum-145',
        enumName: 'SketchPlane',
        value: 'TOP',
        parameterId: 'sketchPlane'
      }]
    };
    
    const sketchFeatureResponse = await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      sketchFeature
    );
    
    const sketchId = sketchFeatureResponse.feature.featureId;
    logInfo(`Created sketch with ID: ${sketchId}`);
    
    // Step 5: Draw a circle in the sketch
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
    
    // Step 6: Close the sketch
    logInfo('Finalizing sketch...');
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/sketches/${sketchId}`,
      'POST',
      { action: 'close' }
    );
    
    // Step 7: Extrude the sketch to create the cylinder
    logInfo('Extruding circle to create cylinder with height 1 inch...');
    const extrudeFeature = {
      type: 'BTMFeature-134',
      name: 'Cylinder Extrude',
      featureType: 'extrude',
      parameters: [
        {
          btType: 'BTMParameterQueryList-148',
          queries: [{
            btType: 'BTMIndividualQuery-138',
            featureId: sketchId,
            entityId: '',
            deterministicIds: []
          }],
          parameterId: 'entities'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'ExtrudeOperationType',
          value: 'NEW',
          parameterId: 'operationType'
        },
        {
          btType: 'BTMParameterQuantity-147',
          isInteger: false,
          value: 1.0,
          expression: '1 in',
          parameterId: 'depth'
        },
        {
          btType: 'BTMParameterEnum-145',
          namespace: '',
          enumName: 'ExtrudeEndType',
          value: 'Blind',
          parameterId: 'endType'
        }
      ]
    };
    
    logInfo(`POST /api/documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features with payload: ${JSON.stringify(extrudeFeature)}`); // Log the POST statement
    
    await apiCall(
      `documents/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements/${partStudioId}/features`,
      'POST',
      extrudeFeature
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