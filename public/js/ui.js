import { fetchDocuments, getDocumentById, getNetworkLogs } from './api.js';
import { logInfo, logError } from './utils/logging.js';
import { runExample1 } from './examples/cylinder.js';
import { runExample2 } from './examples/lamp.js';
import { runExample3 } from './examples/cup.js';
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
  
  // Update info
  updateDebugInfo();
  
  // Fetch server auth info
  fetch('/api/auth/token-debug')
    .then(res => res.json())
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
    const token = getToken();
    authDebug.textContent = JSON.stringify({
      isAuthenticated: !!token,
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
}

/**
 * Handle document selection change
 */
function onDocumentSelectChange() {
  const selectedId = documentSelect.value;
  
  if (selectedId) {
    selectedDocument = getDocumentById(selectedId);
    documentName.value = '';
    documentName.disabled = true;
    logInfo(`Selected document: ${selectedDocument.name}`);
    
    // Load part studios for this document
    partStudioSelector.loadPartStudios(selectedId);
  } else {
    selectedDocument = null;
    documentName.disabled = false;
    // Reset selectors
    partStudioSelector.reset();
    planeSelector.reset();
    logInfo('Creating a new document');
  }
  
  updateConvertButton();
}

/**
 * Handle part studio selection change
 */
function onPartStudioSelect(partStudio) {
  if (partStudio && partStudio.id) {
    logInfo(`Selected part studio: ${partStudio.name}`);
    
    // Load planes for this part studio
    planeSelector.loadPlanes(partStudio.documentId, partStudio.id);
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