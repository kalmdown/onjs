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
    
    // Handle errors
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
      logInfo('SVG conversion successful! Creating sketch in Onshape...');
      
      // Automatically proceed with creating features in Onshape without asking
      await createFeaturesInOnshape(result.conversionId, documentId, partStudio?.id);
      
      // Show conversion results after feature creation attempt
      showConversionResults(result.result);
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
 * @param {string} conversionId - The ID of the conversion on the server
 * @param {string} documentId - Document ID
 * @param {string} [elementId] - Element ID (part studio)
 */
async function createFeaturesInOnshape(conversionId, documentId, elementId) {
  try {
    logInfo('Creating sketches in Onshape document...');
    
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
    
    logInfo(`Using document: ${documentId}, workspace: ${workspaceId}, element: ${elementId}`);
    
    // Send only the conversionId reference to the server
    try {
      const response = await fetch('/api/svg/createFeatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          workspaceId,
          elementId,
          conversionId
        }),
        credentials: 'same-origin'
      });
      
      // Better error handling for network or server errors
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || `Server error (${response.status})`);
        } else {
          const errorText = await response.text();
          throw new Error(errorText || `Server error (${response.status})`);
        }
      }
      
      const createResult = await response.json();
      
      if (createResult.success) {
        logInfo(`✅ Success! Created ${createResult.features?.length || 0} sketches in Onshape!`);
        
        // If the server provides a link, use it
        if (createResult.link) {
          const linkContainer = document.createElement('div');
          linkContainer.className = 'mt-3';
          linkContainer.innerHTML = `<a href="${createResult.link}" target="_blank" class="btn btn-primary">Open in Onshape</a>`;
          document.getElementById('logOutput').appendChild(linkContainer);
        } else {
          showOnshapeLink(documentId, workspaceId, elementId);
        }
        return true;
      } else {
        throw new Error(createResult.message || createResult.error || 'Failed to create sketches');
      }
    } catch (apiError) {
      throw new Error(`API Error: ${apiError.message}`);
    }
  } catch (error) {
    logError(`❌ Error creating sketches: ${error.message}`);
    logWarn('Sketch creation in Onshape failed. Opening document link anyway:');
    showOnshapeLink(documentId);
    return false;
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
  logInfo(`Converted into ${result.features?.sketches || 0} sketches`);
  
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