import { fetchDocuments, getDocumentById, getNetworkLogs } from './api.js';
import { logInfo, logError } from './utils/logging.js';
import { runExample1 } from './examples/cylinder.js';
import { runExample2 } from './examples/cup.js';
import { runExample3 } from './examples/lamp.js';
import { convertSvg } from './svg-converter.js';
import { authenticate, getToken, debugAuthState } from './clientAuth.js';
import { exportApiCalls } from './api.js';
import partStudioSelector from './partStudioSelector.js';
import planeSelector from './planeSelector.js';

// Application state
let selectedDocument = null;
let currentSvg = null;
let debugPanelActive = false;

// DOM elements
let btnAuthenticate, authStatus, svgFile, svgPreview, 
    documentSelect, documentName, btnRefreshDocuments,
    btnExample1, btnExample2, btnExample3, btnConvertSvg, logOutput, btnExportApiCalls;

export function setupUI() {
  // Initialize DOM elements
  btnAuthenticate = document.getElementById('btnAuthenticate');
  authStatus = document.getElementById('authStatus');
  svgFile = document.getElementById('svgFile');
  svgPreview = document.getElementById('svgPreview');
  documentSelect = document.getElementById('documentSelect');
  documentName = document.getElementById('documentName');
  btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
  btnExample1 = document.getElementById('btnExample1');
  btnExample2 = document.getElementById('btnExample2');
  btnExample3 = document.getElementById('btnExample3');
  btnConvertSvg = document.getElementById('btnConvertSvg');
  logOutput = document.getElementById('logOutput');
  btnExportApiCalls = document.getElementById('btnExportApiCalls');
  
  // Add debug button
  addDebugButton();
  
  console.log('[DEBUG] UI.js loaded, partStudioSelector instance:', partStudioSelector);
}

export function registerEventHandlers() {
  // Set up event listeners
  btnAuthenticate.addEventListener('click', authenticate);
  btnRefreshDocuments.addEventListener('click', fetchDocuments);
  documentSelect.addEventListener('change', onDocumentSelectChange);
  btnExample1.addEventListener('click', runExample1);
  btnExample2.addEventListener('click', runExample2);
  btnExample3.addEventListener('click', runExample3);
  btnConvertSvg.addEventListener('click', convertSvg);
  svgFile.addEventListener('change', onSvgFileChange);
  btnExportApiCalls.addEventListener('click', exportApiCalls);
  
  // Register studio and plane change handlers
  partStudioSelector.onSelect(onPartStudioSelect);
}

/**
 * Add debug button to the UI
 */
function addDebugButton() {
  const authContainer = document.querySelector('.auth-container');
  if (authContainer) {
    const debugBtn = document.createElement('button');
    debugBtn.id = 'btnDebug';
    debugBtn.className = 'btn btn-outline-secondary ms-2';
    debugBtn.textContent = 'Debug';
    debugBtn.addEventListener('click', toggleDebugPanel);
    authContainer.appendChild(debugBtn);
  } else {
    // Fallback to adding after the authenticate button
    const authBtn = document.getElementById('btnAuthenticate');
    if (authBtn && authBtn.parentNode) {
      const debugBtn = document.createElement('button');
      debugBtn.id = 'btnDebug';
      debugBtn.className = 'btn btn-outline-secondary ms-2';
      debugBtn.textContent = 'Debug';
      debugBtn.addEventListener('click', toggleDebugPanel);
      authBtn.parentNode.appendChild(debugBtn);
    }
  }
}

/**
 * Toggle the debug panel visibility
 */
function toggleDebugPanel() {
  const existingPanel = document.getElementById('debug-panel');
  
  if (existingPanel) {
    existingPanel.remove();
    debugPanelActive = false;
    return;
  }
  
  debugPanelActive = true;
  showDebugPanel();
}

/**
 * Show the debug panel with authentication and network information
 */
function showDebugPanel() {
  // Run auth debug function
  debugAuthState();
  
  // Create debug panel
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debug-panel';
  debugPanel.className = 'card mt-4 debug-panel';
  debugPanel.innerHTML = `
    <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Debug Information</h5>
      <div>
        <button id="refreshDebug" class="btn btn-sm btn-primary me-2">Refresh</button>
        <button id="closeDebug" class="btn btn-sm btn-light">Close</button>
      </div>
    </div>
    <div class="card-body">
      <h6>Authentication</h6>
      <pre id="authDebug" class="bg-light p-2 small">Loading authentication data...</pre>
      
      <h6 class="mt-3">Authentication Tests</h6>
      <div class="d-flex gap-2 mb-3">
        <button id="testApiKey" class="btn btn-sm btn-outline-primary">Test API Key</button>
        <button id="testOAuth" class="btn btn-sm btn-outline-primary">Test OAuth</button>
        <button id="testEndpoint" class="btn btn-sm btn-outline-secondary">Test Auth Endpoint</button>
      </div>
      <pre id="authTestResult" class="bg-light p-2 small">Run a test to see results</pre>
      
      <h6 class="mt-3">Network Activity</h6>
      <pre id="networkDebug" class="bg-light p-2 small">Loading network data...</pre>
      
      <h6 class="mt-3">Server Authentication Status</h6>
      <pre id="serverAuthDebug" class="bg-light p-2 small">Fetching server authentication data...</pre>
    </div>
  `;
  
  // Add to page (find main container or fallback to body)
  const container = document.querySelector('.container') || document.body;
  container.appendChild(debugPanel);
  
  // Event listeners
  document.getElementById('refreshDebug').addEventListener('click', updateDebugInfo);
  document.getElementById('closeDebug').addEventListener('click', () => {
    debugPanel.remove();
    debugPanelActive = false;
  });
  
  // Auth test buttons
  document.getElementById('testApiKey').addEventListener('click', () => testAuth('apikey'));
  document.getElementById('testOAuth').addEventListener('click', () => testAuth('oauth'));
  document.getElementById('testEndpoint').addEventListener('click', () => testAuthEndpoint());
  
  // Update info
  updateDebugInfo();
  
  // Fetch server auth info using the new comprehensive endpoint
  fetch('/api/debug/auth')
    .then(res => {
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      const serverAuthDebug = document.getElementById('serverAuthDebug');
      if (serverAuthDebug) {
        serverAuthDebug.textContent = JSON.stringify(data, null, 2);
      }
    })
    .catch(err => {
      console.error('Error fetching auth debug:', err);
      const serverAuthDebug = document.getElementById('serverAuthDebug');
      if (serverAuthDebug) {
        serverAuthDebug.textContent = `Error fetching server auth data: ${err.message}`;
      }
    });
}

/**
 * Update debug information in the panel
 */
function updateDebugInfo() {
  // Client auth state
  const authDebug = document.getElementById('authDebug');
  if (authDebug) {
    // Import these functions if they're not already available
    // Make sure we're getting everything from clientAuth.js that we need
    const { getToken, getAuthMethod } = window.clientAuth || {};
    
    const token = getToken ? getToken() : (localStorage.getItem('authToken') || null);
    const authMethod = getAuthMethod ? getAuthMethod() : 'unknown';
    
    authDebug.textContent = JSON.stringify({
      isAuthenticated: !!token || authMethod === 'apikey',
      authMethod: authMethod,
      hasAuthToken: !!token,
      tokenLength: token ? token.length : 0,
      hasLocalStorageToken: !!localStorage.getItem('authToken'),
      hasLocalStorageRefreshToken: !!localStorage.getItem('refreshToken')
    }, null, 2);
  }
  
  // Network logs
  const networkDebug = document.getElementById('networkDebug');
  if (networkDebug) {
    const networkLogs = getNetworkLogs();
    networkDebug.textContent = JSON.stringify({
      lastRequest: networkLogs.lastRequest ? {
        url: networkLogs.lastRequest.url,
        method: networkLogs.lastRequest.method,
        hasAuthHeader: networkLogs.lastRequest.headers?.Authorization ? true : false,
        timestamp: networkLogs.lastRequest.timestamp
      } : null,
      lastResponse: networkLogs.lastResponse ? {
        status: networkLogs.lastResponse.status,
        statusText: networkLogs.lastResponse.statusText,
        duration: networkLogs.lastResponse.duration ? `${networkLogs.lastResponse.duration.toFixed(2)}ms` : null,
        timestamp: networkLogs.lastResponse.timestamp
      } : null,
      recentRequests: networkLogs.summary || []
    }, null, 2);
  }
  
  // Update server auth info
  fetch('/api/debug/auth')
    .then(res => {
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      const serverAuthDebug = document.getElementById('serverAuthDebug');
      if (serverAuthDebug) {
        serverAuthDebug.textContent = JSON.stringify(data, null, 2);
      }
    })
    .catch(err => {
      console.error('Error refreshing auth debug:', err);
      // Don't update if there's an error to preserve existing data
    });
}

/**
 * Test authentication with specific method
 * @param {string} method - Auth method to test ('apikey' or 'oauth')
 */
function testAuth(method) {
  const resultElement = document.getElementById('authTestResult');
  if (!resultElement) return;
  
  resultElement.textContent = `Testing ${method} authentication...`;
  resultElement.className = 'bg-light p-2 small';
  
  // Test endpoint
  fetch('/api/auth/test')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      resultElement.textContent = JSON.stringify(data, null, 2);
      
      // Add success/error class based on result
      if (data.success) {
        resultElement.className = 'bg-success text-white p-2 small';
      } else {
        resultElement.className = 'bg-danger text-white p-2 small';
      }
      
      // Update debug info to reflect any changes
      updateDebugInfo();
    })
    .catch(error => {
      resultElement.textContent = `Error testing ${method} authentication: ${error.message}`;
      resultElement.className = 'bg-danger text-white p-2 small';
    });
}

/**
 * Test the auth endpoint directly
 */
function testAuthEndpoint() {
  const resultElement = document.getElementById('authTestResult');
  if (!resultElement) return;
  
  resultElement.textContent = 'Testing authentication endpoint...';
  resultElement.className = 'bg-light p-2 small';
  
  // Make a simple API call to verify authentication
  fetch('/api/documents?limit=1')
    .then(response => {
      const status = response.status;
      const isOk = response.ok;
      
      return response.text().then(text => {
        let parsed = null;
        try {
          // Try to parse as JSON if possible
          parsed = JSON.parse(text);
        } catch (e) {
          // Leave as text if it's not valid JSON
          parsed = text.length > 500 ? text.substring(0, 500) + '...' : text;
        }
        
        return {
          status,
          isOk,
          body: parsed
        };
      });
    })
    .then(data => {
      resultElement.textContent = JSON.stringify(data, null, 2);
      
      // Add success/error class based on status
      if (data.isOk) {
        resultElement.className = 'bg-success text-white p-2 small';
      } else {
        resultElement.className = 'bg-warning text-dark p-2 small';
      }
    })
    .catch(error => {
      resultElement.textContent = `Error testing endpoint: ${error.message}`;
      resultElement.className = 'bg-danger text-white p-2 small';
    });
}

/**
 * Handle document selection change
 */
function onDocumentSelectChange() {
  const selectedId = documentSelect.value;
  
  console.log('[DEBUG] Document selection changed to:', selectedId);
  
  try {
    if (selectedId) {
      selectedDocument = getDocumentById(selectedId);
      
      if (!selectedDocument) {
        logError(`Could not find document with ID: ${selectedId}`);
        return;
      }
      
      documentName.value = '';
      documentName.disabled = true;
      logInfo(`Selected document: ${selectedDocument.name}`);
      
      // Debug the part studio selector instance
      console.log('[DEBUG] About to load part studios, selector:', partStudioSelector);
      
      // Check if the method exists
      if (typeof partStudioSelector.loadPartStudios !== 'function') {
        console.error('[DEBUG] loadPartStudios is not a function on the partStudioSelector instance!');
      } else {
        // Load part studios for this document
        try {
          console.log('[DEBUG] Calling partStudioSelector.loadPartStudios with:', selectedId);
          partStudioSelector.loadPartStudios(selectedId)
            .then(partStudios => {
              console.log('[DEBUG] Part studios loaded:', partStudios);
            })
            .catch(err => {
              logError(`Error loading part studios: ${err.message}`);
              console.error('[DEBUG] Error loading part studios:', err);
            });
        } catch (partStudioError) {
          logError(`Error initializing part studio load: ${partStudioError.message}`);
          console.error('[DEBUG] Part studio loading error:', partStudioError);
        }
      }
    } else {
      selectedDocument = null;
      documentName.disabled = false;
      // Reset selectors
      console.log('[DEBUG] Resetting part studio selector');
      partStudioSelector.reset();
      planeSelector.reset();
      logInfo('Creating a new document');
    }
    
    updateConvertButton();
  } catch (error) {
    logError(`Error handling document selection: ${error.message}`);
    console.error('[DEBUG] Document selection error:', error);
  }
}

/**
 * Handle part studio selection change
 */
function onPartStudioSelect(partStudio) {
  try {
    if (partStudio && partStudio.id && partStudio.documentId) {
      logInfo(`Selected part studio: ${partStudio.name}`);
      
      // Load planes for this part studio
      try {
        planeSelector.loadPlanes(partStudio.documentId, partStudio.id)
          .catch(err => {
            logError(`Error loading planes: ${err.message}`);
            // Don't throw here - we want to continue even if planes fail to load
          });
      } catch (planeError) {
        logError(`Error initializing plane load: ${planeError.message}`);
      }
    } else {
      logInfo('No part studio selected or invalid selection');
      planeSelector.reset();
    }
  } catch (error) {
    logError(`Error handling part studio selection: ${error.message}`);
    planeSelector.reset();
  }
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
  btnConvertSvg.disabled = !getToken() || !currentSvg;
}

/**
 * Get the currently selected document
 */
export function getSelectedDocument() {
  return selectedDocument;
}

/**
 * Get the document name input value
 */
export function getDocumentName() {
  return documentName.value;
}

/**
 * Get the current SVG content
 */
export function getCurrentSvg() {
  return currentSvg;
}

/**
 * Get the selected part studio
 */
export function getSelectedPartStudio() {
  return partStudioSelector.getSelectedItem();
}

/**
 * Get the selected sketch plane
 */
export function getSelectedPlane() {
  return planeSelector.getSelectedItem();
}