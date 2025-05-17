// public/js/cylinder.js
import { getWorkspaces, fetchElementsForDocument } from './api.js';

// Add these helper functions at the top level of your file
function cleanDocumentId(id) {
  return id ? id.replace(/^d\/|^\/d\//, '') : id;
}

function cleanWorkspaceId(id) {
  return id ? id.replace(/^w\/|^\/w\//, '') : id;
}

function cleanElementId(id) {
  return id ? id.replace(/^e\/|^\/e\//, '') : id;
}

// Replace direct fetch calls to document endpoints with API utility functions
async function loadDocument(documentId) {
  try {
    // Clean the document ID
    const cleanDocId = cleanDocumentId(documentId);
    
    // Use the API utility instead of direct fetch
    const workspaces = await getWorkspaces(cleanDocId);
    
    // Find default workspace
    const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
    
    if (!defaultWorkspace) {
      throw new Error("No workspaces found for document");
    }
    
    // Clean workspace ID
    const workspaceId = cleanWorkspaceId(defaultWorkspace.id);
    
    // Use the API utility for elements or proper URL pattern
    const elementsResponse = await fetchElementsForDocument(cleanDocId);
    
    // ...existing processing code...
    
  } catch (error) {
    console.error("Error accessing document:", error);
    document.getElementById('error-message').textContent = `Failed to access Onshape document: ${error.message}`;
    document.getElementById('error-container').style.display = 'block';
  }
}

// Then later in code:
const workspaces = await getWorkspaces(cleanDocId);
