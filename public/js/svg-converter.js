// public/js/svg-converter.js
import { apiCall } from './api.js';
import { isAuthenticated } from './clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from './ui.js';
import { logInfo, logError, logWarn } from './utils/logging.js';

/**
 * Handles SVG file conversion to Onshape features
 */
export async function convertSvg() {
  console.log('[DEBUG] Convert SVG function called');
  
  // Check authentication before proceeding
  if (!isAuthenticated()) {
    console.log('[DEBUG] Authentication check failed');
    logError('Please authenticate with Onshape first');
    return;
  }

  // Get the file input element
  const svgFile = document.getElementById('svgFile');
  if (!svgFile || !svgFile.files || svgFile.files.length === 0) {
    logError('Please select an SVG file first');
    return;
  }

  const file = svgFile.files[0];
  logInfo(`Processing SVG file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
  
  try {
    // Get document info
    let documentId;
    const selectedDoc = getSelectedDocument();
    if (selectedDoc) {
      documentId = selectedDoc.id;
      logInfo(`Using existing document: ${selectedDoc.name}`);
    } else {
      // Create new document if none selected
      const docName = getDocumentName() || `SVG Conversion - ${file.name}`;
      const newDoc = await apiCall('documents', 'POST', { name: docName });
      documentId = newDoc.id;
      logInfo(`Created new document: ${docName}`);
    }

    // Get part studio and plane information
    const partStudio = getSelectedPartStudio();
    const plane = getSelectedPlane();
    
    logInfo('Uploading SVG for conversion...');
    logInfo(`Converting SVG file to Onshape features`);
    
    // Create FormData to send the file
    const formData = new FormData();
    formData.append('svgFile', file);
    formData.append('documentId', documentId);
    
    // Add part studio if selected
    if (partStudio) {
      formData.append('elementId', partStudio.id);
      logInfo(`Using part studio: ${partStudio.name}`);
    }
    
    // Add plane if selected
    if (plane) {
      formData.append('planeId', plane.id);
      logInfo(`Using sketch plane: ${plane.name}`);
    }
    
    // Add conversion options
    formData.append('scale', 1.0);
    formData.append('units', 'mm');
    formData.append('create3D', 'true');
    formData.append('extrudeDepth', 10);
    
    // Custom fetch call for the file upload
    const response = await fetch('/api/svg/convert', {
      method: 'POST',
      body: formData
    });
    
    // Replace the current error handling with this:
    if (!response.ok) {
      const errorStatus = response.status;
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `Server error (${errorStatus})`);
      } catch (e) {
        if (e instanceof SyntaxError) {
          // If JSON parsing failed, try text instead
          const errorText = await response.text();
          throw new Error(errorText || `Server error (${errorStatus})`);
        }
        // Re-throw if it was already a handled error
        throw e;
      }
    }
    
    const result = await response.json();
    
    if (result.success) {
      logInfo('SVG conversion successful!');
      
      // Ask if user wants to create features in Onshape
      if (confirm('SVG converted successfully. Would you like to create the features in Onshape?')) {
        return createFeaturesInOnshape(result.result.data, documentId, partStudio?.id);
      } else {
        showConversionResults(result.result);
        showOnshapeLink(documentId);
      }
    } else {
      logError(`Conversion failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    logError(`Error processing SVG: ${error.message}`);
    console.error('SVG conversion error:', error);
  }
}

/**
 * Create Onshape features from conversion results
 * @param {Object} features - Features to create
 * @param {string} documentId - Document ID
 * @param {string} [elementId] - Element ID (part studio)
 */
async function createFeaturesInOnshape(features, documentId, elementId) {
  try {
    logInfo('Creating features in Onshape document...');
    
    // If no element ID is provided, we need to get or create one
    if (!elementId) {
      // Try to get the default workspace first
      const workspaces = await apiCall(`documents/${documentId}/workspaces`);
      const workspaceId = workspaces[0].id;
      
      // Create a new part studio
      logInfo('Creating a new part studio...');
      const newElement = await apiCall(
        `documents/${documentId}/w/${workspaceId}/elements`, 
        'POST', 
        { 
          name: 'SVG Conversion', 
          elementType: 'PARTSTUDIO' 
        }
      );
      elementId = newElement.id;
    }
    
    // Get workspace ID
    const workspaces = await apiCall(`documents/${documentId}/workspaces`);
    const workspaceId = workspaces[0].id;
    
    // Send the features to the server
    const createResult = await apiCall(
      'svg/createFeatures',
      'POST',
      {
        documentId,
        workspaceId,
        elementId,
        features
      }
    );
    
    if (createResult.success) {
      logInfo(`Created ${createResult.features.length} features in Onshape!`);
      showOnshapeLink(documentId, workspaceId, elementId);
    } else {
      throw new Error(createResult.message || 'Failed to create features');
    }
  } catch (error) {
    logError(`Error creating features: ${error.message}`);
    showOnshapeLink(documentId);
  }
}

/**
 * Show a link to the Onshape document
 */
function showOnshapeLink(documentId, workspaceId, elementId) {
  let url = `https://cad.onshape.com/documents/${documentId}`;
  
  if (workspaceId) {
    url += `/w/${workspaceId}`;
    
    if (elementId) {
      url += `/e/${elementId}`;
    }
  }
  
  const linkDiv = document.createElement('div');
  linkDiv.innerHTML = `<a href="${url}" target="_blank" class="btn btn-sm btn-primary mt-2">Open in Onshape</a>`;
  document.getElementById('logOutput').appendChild(linkDiv);
}

/**
 * Show conversion results in the UI
 */
function showConversionResults(result) {
  // Log statistics about the conversion
  logInfo(`Processed ${result.svgInfo?.elements.paths || 0} paths, ${result.svgInfo?.elements.circles || 0} circles, etc.`);
  logInfo(`Created ${result.features?.sketches || 0} sketches and ${result.features?.features3D || 0} 3D features`);
  
  // You could add more detailed visualization of the conversion results here
}

// Remove this event listener as it's already handled in ui.js
// document.addEventListener('DOMContentLoaded', () => {
//   const btnConvertSvg = document.getElementById('btnConvertSvg');
//   if (btnConvertSvg) {
//     btnConvertSvg.addEventListener('click', convertSvg);
//   } else {
//     console.error("Convert SVG button not found in DOM");
//   }
// });