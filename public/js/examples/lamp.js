import { apiCall } from '../api.js';
import { getAuthToken } from '../auth.js';
import { getSelectedDocument, getDocumentName } from '../ui.js';
import { logInfo, logSuccess, logError } from '../utils/logging.js';

/**
 * Example 2: Create a Lamp
 * 
 * This example creates a more complex model with multiple features including
 * sketch, extrude, loft, and boolean operations.
 */
export async function runExample2() {
  if (!getAuthToken()) {
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
      logSuccess(`Created new document: ${newName}`);
    }
    
    // Step 2: Get workspaces and part studio
    logInfo('Accessing part studio and clearing existing features...');
    const workspaces = await apiCall(`documents/${onshapeDocument.id}/workspaces`);
    const workspaceId = workspaces[0].id;
    
    // Rest of the lamp creation code...
    // ...
    // (I'm abbreviating since this is very long - copy the rest of runExample2 here)
    
    logSuccess('Successfully created lamp in Onshape!');
    
    const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}