import { apiCall } from './api.js';
import { getToken, isAuthenticated } from './clientAuth.js'; // Added isAuthenticated
import { getSelectedDocument, getDocumentName, getCurrentSvg } from './ui.js';
import { logInfo, logSuccess, logError } from './utils/logging.js';

/**
 * Handles SVG file conversion to Onshape format
 */
export async function convertSvg() {
  const fileInput = document.getElementById('svg-file-input');
  const file = fileInput?.files[0];
  
  if (!file) {
    logInfo('No SVG file selected');
    return;
  }
  
  logInfo(`SVG file loaded: ${file.name}`);
  
  // Check authentication before proceeding
  if (!isAuthenticated()) { // Using isAuthenticated instead of getToken
    logError('Please authenticate first');
    showAuthRequiredMessage();
    return;
  }
  
  // Proceed with conversion since user is authenticated
  const reader = new FileReader();
  reader.onload = async (e) => {
    const svgContent = e.target.result;
    try {
      const result = await sendSvgForConversion(svgContent);
      handleConversionSuccess(result);
    } catch (error) {
      logError(`Error converting SVG: ${error.message}`);
    }
  };
  
  reader.readAsText(file);
}

/**
 * Shows authentication required message to the user
 */
function showAuthRequiredMessage() {
  const messageContainer = document.getElementById('auth-message-container') || createAuthMessageContainer();
  messageContainer.innerHTML = '<div class="auth-message">Authentication required to convert SVG files.</div>';
  
  // Add sign-in button if not already present
  if (!document.getElementById('auth-sign-in-button')) {
    const authButton = document.createElement('button');
    authButton.id = 'auth-sign-in-button';
    authButton.className = 'btn btn-primary auth-button';
    authButton.textContent = 'Sign in with Onshape';
    authButton.addEventListener('click', initiateLogin);
    messageContainer.appendChild(authButton);
  }
}

/**
 * Initiates the login process
 */
function initiateLogin() {
  // Redirect to login page
  const redirectUri = encodeURIComponent(window.location.origin + '/oauthRedirect');
  const scopes = encodeURIComponent('OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete');
  
  window.location.href = `/api/oauth/login?redirectUri=${redirectUri}&scope=${scopes}`;
}

/**
 * Creates container for auth messages if it doesn't exist
 */
function createAuthMessageContainer() {
  const container = document.createElement('div');
  container.id = 'auth-message-container';
  container.className = 'auth-message-container';
  
  const convertButton = document.getElementById('convert-svg-button');
  if (convertButton) {
    convertButton.parentNode.insertBefore(container, convertButton.nextSibling);
  } else {
    document.querySelector('.svg-converter').appendChild(container);
  }
  
  return container;
}

/**
 * Sends SVG content to the server for conversion
 */
async function sendSvgForConversion(svgContent) {
  try {
    // Step 1: Get or create a document
    let onshapeDocument;
    const selectedDocument = getSelectedDocument();
    if (selectedDocument) {
      onshapeDocument = selectedDocument;
      logInfo(`Using existing document: ${onshapeDocument.name}`);
    } else {
      const newName = getDocumentName() || 'SVG Conversion';
      onshapeDocument = await apiCall('documents', 'POST', { name: newName });
      logSuccess(`Created new document: ${newName}`);
    }
    
    // Step 2: Get workspaces
    logInfo('Accessing workspaces...');
    const workspaces = await apiCall(`documents/${onshapeDocument.id}/workspaces`);
    const workspaceId = workspaces[0].id;
    
    // Step 3: Create a new part studio
    logInfo('Creating part studio...');
    const elements = await apiCall(`documents/${onshapeDocument.id}/workspaces/${workspaceId}/elements`, 'POST', {
      elementType: 'partstudio',
      name: 'SVG Conversion',
      isPublic: true
    });
    const elementId = elements.id;
    
    // Step 4: Create a sketch based on the SVG
    logInfo('Processing SVG data...');
    const svgData = parseSvgContent(svgContent);
    
    // Create a sketch for the SVG paths
    const sketch = await apiCall(`documents/${onshapeDocument.id}/workspaces/${workspaceId}/elements/${elementId}/sketches`, 'POST', {
      entities: createSketchEntitiesFromSvg(svgData),
      version: 0
    });
    
    // Step 5: Extrude the sketch
    logInfo('Extruding SVG profile...');
    await apiCall(`documents/${onshapeDocument.id}/workspaces/${workspaceId}/elements/${elementId}/features`, 'POST', {
      feature: {
        type: 'extrude',
        name: 'SVG Extrusion',
        parameters: {
          entities: [{ type: 'sketch', id: sketch.id }],
          direction: { type: 'normal', flipped: false },
          endBound: { type: 'blind', value: 0.25 } // Default extrusion depth
        }
      },
      version: 1
    });
    
    return {
      success: true,
      documentId: onshapeDocument.id,
      workspaceId: workspaceId,
      elementId: elementId
    };
    
  } catch (error) {
    logError(`Error in SVG conversion: ${error.message}`);
    throw error;
  }
}

/**
 * Parse SVG content into usable data
 * This is a simplified version - a real implementation would use a proper SVG parser
 */
function parseSvgContent(svgContent) {
  // This is a placeholder for actual SVG parsing logic
  // In a real implementation, you would use a library like svg-parser to parse the SVG
  
  // For demonstration, we'll return a simple rectangle
  return {
    paths: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 50,
        height: 30
      }
    ]
  };
}

/**
 * Convert SVG data to Onshape sketch entities
 */
function createSketchEntitiesFromSvg(svgData) {
  // This is a simplified conversion - a real implementation would handle all SVG element types
  
  const entities = {
    lines: []
  };
  
  // Process each path in the SVG
  svgData.paths.forEach(path => {
    if (path.type === 'rect') {
      // Create a rectangle using lines
      const x = path.x;
      const y = path.y;
      const width = path.width;
      const height = path.height;
      
      // Bottom line
      entities.lines.push({
        type: 'line',
        parameters: {
          start: [x, y],
          end: [x + width, y]
        }
      });
      
      // Right line
      entities.lines.push({
        type: 'line',
        parameters: {
          start: [x + width, y],
          end: [x + width, y + height]
        }
      });
      
      // Top line
      entities.lines.push({
        type: 'line',
        parameters: {
          start: [x + width, y + height],
          end: [x, y + height]
        }
      });
      
      // Left line
      entities.lines.push({
        type: 'line',
        parameters: {
          start: [x, y + height],
          end: [x, y]
        }
      });
    }
    // Additional path types would be handled here
  });
  
  return entities;
}

/**
 * Handles successful conversion of SVG
 */
function handleConversionSuccess(result) {
  logSuccess('SVG conversion successful');
  // Display the result or download link based on your application's requirements
  if (result.documentId) {
    const onshapeLink = `https://cad.onshape.com/documents/${result.documentId}`;
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    document.getElementById('logOutput').appendChild(linkDiv);
  }
}

// Make sure the event listener is attached
document.addEventListener('DOMContentLoaded', () => {
  const convertSvgButton = document.getElementById('convert-svg-button');
  if (convertSvgButton) {
    convertSvgButton.addEventListener('click', convertSvg);
  }
});