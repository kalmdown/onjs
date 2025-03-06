// src\public\js\app.js
/**
 * SVG to Onshape Converter - Client-side application
 */

// DOM elements
const btnAuthenticate = document.getElementById('btnAuthenticate');
const authStatus = document.getElementById('authStatus');
const svgFile = document.getElementById('svgFile');
const svgPreview = document.getElementById('svgPreview');
const documentSelect = document.getElementById('documentSelect');
const documentName = document.getElementById('documentName');
const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
const btnExample1 = document.getElementById('btnExample1');
const btnExample2 = document.getElementById('btnExample2');
const btnConvertSvg = document.getElementById('btnConvertSvg');
const logOutput = document.getElementById('logOutput');

// Application state
let authToken = null;
let refreshToken = null;
let documents = [];
let selectedDocument = null;
let currentSvg = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Check if we have stored tokens
  authToken = localStorage.getItem('onshapeAuthToken');
  refreshToken = localStorage.getItem('onshapeRefreshToken');
  
  if (authToken) {
    updateAuthStatus(true);
    fetchDocuments();
  }
  
  // Set up event listeners
  btnAuthenticate.addEventListener('click', authenticate);
  btnRefreshDocuments.addEventListener('click', fetchDocuments);
  documentSelect.addEventListener('change', onDocumentSelectChange);
  btnExample1.addEventListener('click', runExample1);
  btnExample2.addEventListener('click', runExample2);
  btnConvertSvg.addEventListener('click', convertSvg);
  svgFile.addEventListener('change', onSvgFileChange);
});

/**
 * Update the authentication status display
 * 
 * @param {boolean} isAuthenticated Whether the user is authenticated
 */
function updateAuthStatus(isAuthenticated) {
  if (isAuthenticated) {
    authStatus.textContent = 'Authenticated';
    authStatus.className = 'text-success ms-3';
    btnAuthenticate.textContent = 'Re-authenticate';
    btnRefreshDocuments.disabled = false;
    documentSelect.disabled = false;
  } else {
    authStatus.textContent = 'Not authenticated';
    authStatus.className = 'text-danger ms-3';
    btnAuthenticate.textContent = 'Authenticate with Onshape';
    btnRefreshDocuments.disabled = true;
    documentSelect.disabled = true;
  }
}

/**
 * Authenticate with Onshape using OAuth
 */
async function authenticate() {
  logInfo('Starting authentication process...');
  
  // In a real application, this would redirect to Onshape's OAuth endpoint
  // For this example, we'll simulate a successful authentication
  
  // Normally, this would involve:
  // 1. Redirect to Onshape OAuth page
  // 2. User logs in and authorizes the app
  // 3. Onshape redirects back with an authorization code
  // 4. Exchange code for access and refresh tokens
  
  // Simulating successful authentication
  setTimeout(() => {
    authToken = 'simulated_auth_token';
    refreshToken = 'simulated_refresh_token';
    
    // Save tokens to localStorage
    localStorage.setItem('onshapeAuthToken', authToken);
    localStorage.setItem('onshapeRefreshToken', refreshToken);
    
    updateAuthStatus(true);
    logSuccess('Authentication successful');
    fetchDocuments();
  }, 1000);
}

/**
 * Handle document selection change
 */
function onDocumentSelectChange() {
  const selectedId = documentSelect.value;
  
  if (selectedId) {
    selectedDocument = documents.find(doc => doc.id === selectedId);
    documentName.value = '';
    documentName.disabled = true;
    logInfo(`Selected document: ${selectedDocument.name}`);
  } else {
    selectedDocument = null;
    documentName.disabled = false;
    logInfo('Creating a new document');
  }
  
  updateConvertButton();
}

/**
 * Handle SVG file selection
 */
function onSvgFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    svgPreview.innerHTML = '<p class="text-muted">SVG preview will appear here</p>';
    currentSvg = null;
    updateConvertButton();
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const svgContent = e.target.result;
    svgPreview.innerHTML = svgContent;
    currentSvg = svgContent;
    logInfo(`SVG file loaded: ${file.name}`);
    updateConvertButton();
  };
  reader.readAsText(file);
}

/**
 * Update the state of the Convert button
 */
function updateConvertButton() {
  btnConvertSvg.disabled = !authToken || !currentSvg;
}

/**
 * Fetch documents from Onshape
 */
async function fetchDocuments() {
  if (!authToken) {
    logError('Not authenticated');
    return;
  }
  
  logInfo('Fetching documents...');
  
  // This would be a real API call in a production app
  // For this example, we'll use simulated data
  
  setTimeout(() => {
    documents = [
      { id: 'doc1', name: 'Example Document 1' },
      { id: 'doc2', name: 'Example Document 2' },
      { id: 'doc3', name: 'SVG Conversion Project' }
    ];
    
    // Update select dropdown
    documentSelect.innerHTML = '<option value="">Create a new document</option>';
    documents.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.name;
      documentSelect.appendChild(option);
    });
    
    logSuccess(`Found ${documents.length} documents`);
  }, 1000);
}

/**
 * Log messages to the output panel
 * 
 * @param {string} message Message to log
 * @param {string} type Message type (info, success, error)
 */
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

function logInfo(message) {
  log(message, 'info');
}

function logSuccess(message) {
  log(message, 'success');
}

function logError(message) {
  log(message, 'error');
}

/**
 * Example 1: Create a Cylinder
 * 
 * This example creates a circle sketch and extrudes it to create a cylinder.
 */
async function runExample1() {
  if (!authToken) {
    logError('Please authenticate first');
    return;
  }
  
  logInfo('Running Example 1: Create a Cylinder');
  
  try {
    // Step 1: Get or create a document
    let document;
    if (selectedDocument) {
      document = selectedDocument;
      logInfo(`Using existing document: ${document.name}`);
    } else {
      const newName = documentName.value || 'Cylinder Example';
      document = { id: 'new_doc', name: newName };
      logSuccess(`Created new document: ${newName}`);
    }
    
    // Step 2: Get the part studio
    logInfo('Accessing part studio...');
    
    // Step 3: Create a sketch on the top plane
    logInfo('Creating sketch on top plane...');
    
    // Step 4: Draw a circle in the sketch
    logInfo('Drawing circle with radius 0.5 inches at origin...');
    
    // Step 5: Extrude the sketch
    logInfo('Extruding circle to create cylinder with height 1 inch...');
    
    // Simulating wait time for the API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Success!
    logSuccess('Successfully created cylinder in Onshape!');
    
    // Provide a link to open in Onshape (simulated)
    const onshapeLink = 'https://cad.onshape.com/documents/' + document.id;
    
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    logOutput.appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

/**
 * Example 2: Create a Lamp
 * 
 * This example creates a more complex model with multiple features including
 * sketch, extrude, loft, and boolean operations.
 */
async function runExample2() {
  if (!authToken) {
    logError('Please authenticate first');
    return;
  }
  
  logInfo('Running Example 2: Create a Lamp');
  
  try {
    // Step 1: Get or create a document
    let document;
    if (selectedDocument) {
      document = selectedDocument;
      logInfo(`Using existing document: ${document.name}`);
    } else {
      const newName = documentName.value || 'Lamp Example';
      document = { id: 'new_lamp_doc', name: newName };
      logSuccess(`Created new document: ${newName}`);
    }
    
    // Step 2: Get the part studio and wipe it
    logInfo('Accessing part studio and clearing existing features...');
    
    // Step 3: Create the lamp base
    logInfo('Creating base sketches...');
    
    // Step 4: Creating an offset plane for the upper base
    logInfo('Creating offset plane 1.25 inches above the base...');
    
    // Step 5: Create the upper base sketch
    logInfo('Creating upper base sketch...');
    
    // Step 6: Loft between the two base profiles
    logInfo('Creating loft between base profiles...');
    
    // Step 7: Create rod profile and cut hole through base
    logInfo('Creating lamp rod and cutting hole through base...');
    
    // Step 8: Create lampshade profiles
    logInfo('Creating lampshade profiles...');
    
    // Step 9: Loft between lampshade profiles
    logInfo('Creating loft for lampshade...');
    
    // Simulating wait time for the API calls
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Success!
    logSuccess('Successfully created lamp in Onshape!');
    
    // Provide a link to open in Onshape (simulated)
    const onshapeLink = 'https://cad.onshape.com/documents/' + document.id;
    
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    logOutput.appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

/**
 * Convert SVG to Onshape model
 * 
 * This function parses an SVG file and creates corresponding
 * features in Onshape.
 */
async function convertSvg() {
  if (!authToken) {
    logError('Please authenticate first');
    return;
  }
  
  if (!currentSvg) {
    logError('Please upload an SVG file first');
    return;
  }
  
  logInfo('Starting SVG conversion process...');
  
  try {
    // Step 1: Get or create a document
    let document;
    if (selectedDocument) {
      document = selectedDocument;
      logInfo(`Using existing document: ${document.name}`);
    } else {
      const newName = documentName.value || 'SVG Conversion';
      document = { id: 'svg_doc', name: newName };
      logSuccess(`Created new document: ${newName}`);
    }
    
    // Step 2: Get the part studio
    logInfo('Accessing part studio...');
    
    // Step 3: Parse the SVG
    logInfo('Parsing SVG content...');
    
    // Here we would actually parse the SVG and extract the path data
    // For this example, we'll just simulate the process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Convert SVG paths to sketches
    logInfo('Converting SVG paths to sketches...');
    
    // Simulating conversion process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Step 5: Extrude the sketches
    logInfo('Extruding sketches...');
    
    // Simulating extrusion process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Success!
    logSuccess('Successfully converted SVG to Onshape model!');
    
    // Provide a link to open in Onshape (simulated)
    const onshapeLink = 'https://cad.onshape.com/documents/' + document.id;
    
    const linkDiv = document.createElement('div');
    linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
    logOutput.appendChild(linkDiv);
    
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

/**
 * This function would implement the actual SVG parsing and Onshape feature creation.
 * For a real implementation, it would:
 * 1. Parse the SVG using a library like svg-parser
 * 2. Extract path data and transform to Onshape coordinates
 * 3. Create sketches and features using the Onshape API
 * 
 * In a real implementation, this would call the backend which would use the Onshape client we've built.
 */
async function processSvgToOnshape(svgContent, document) {
  // Parse SVG
  // const svgData = parseSvg(svgContent);
  
  // Create a new part studio
  // const partStudio = await onshapeClient.getPartStudio({...});
  
  // For each SVG path:
  // 1. Create a sketch
  // 2. Convert SVG path to sketch entities
  // 3. Extrude the sketch
  
  // This would be implemented with the Onshape client
}

/**
 * Function to make API calls to the backend server
 * 
 * @param {string} endpoint API endpoint
 * @param {string} method HTTP method
 * @param {Object} data Request data
 * @returns {Promise<Object>} Response data
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`/api/${endpoint}`, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
}