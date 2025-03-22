// public/js/api.js

// Import the functions that return auth information
import { getToken, getAuthMethod } from './clientAuth.js';
import { logError, logSuccess, logInfo, logDebug } from './utils/logging.js';
import { createApiHeaders } from './utils/api-headers.js'; // Add this import

// State
let documents = [];
let apiCalls = []; // Array to store API calls
let lastRequest = null;
let lastResponse = null;
let requestLog = [];

/**
 * Make an authenticated API call with enhanced logging
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method
 * @param {object} data - Request payload
 * @param {object} customOptions - Custom fetch options
 * @returns {Promise<any>} API response
 */
export async function apiCall(endpoint, method = 'GET', data = null, customOptions = {}) {
  // Get headers from the centralized utility
  const headers = createApiHeaders();
  
  const defaultOptions = {
    method: method,
    headers: headers
  };

  // Add body for non-GET requests that have data
  if (method !== 'GET' && data !== null) {
    defaultOptions.body = JSON.stringify(data);
  }

  const requestOptions = { ...defaultOptions, ...customOptions };
  
  // Handle different endpoint formats to ensure proper URL construction
  // If it starts with http, it's a full URL
  // If it starts with /, it's a path from the root
  // Otherwise, it's a relative path that needs /api/ prefix
  let url;
  if (endpoint.startsWith('http')) {
    url = endpoint;
  } else if (endpoint.startsWith('/')) {
    url = `/api${endpoint}`;
  } else {
    url = `/api/${endpoint}`;
  }
  
  // Generate a unique ID for this request to correlate logs
  const requestId = Math.random().toString(36).substring(2, 8);
  
  logDebug(`[${requestId}] API Request: ${requestOptions.method} ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, requestOptions);
    const endTime = Date.now();
    
    logDebug(`[${requestId}] API Response: ${response.status} (${endTime - startTime}ms)`);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      logError(`[${requestId}] API Error: ${response.status} ${response.statusText} for ${url}`, errorData);
      
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.message || errorText}`);
    }
    
    // Check if response is empty
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      logDebug(`[${requestId}] API Success: ${typeof data === 'object' ? 'Object/Array returned' : 'Non-object returned'}`);
      return data;
    } else {
      const text = await response.text();
      logDebug(`[${requestId}] API Success: Text response (${text.length} bytes)`);
      return text;
    }
  } catch (error) {
    logError(`[${requestId}] API Exception: ${error.message} for ${url}`);
    throw error;
  }
}

/**
 * Fetch documents from Onshape
 * @param {boolean} [showLoadingIndicator=true] Whether to show loading indicator in the UI
 * @returns {Promise<Array>} Array of documents
 */
export async function fetchDocuments(showLoadingIndicator = true) {
  // Check for authentication using the proper method instead of just token
  const authMethod = getAuthMethod();
  const isAuth = authMethod === 'apikey' || !!getToken();
  
  if (!isAuth) {
    logError('Not authenticated. Please authenticate to view documents.');
    return [];
  }
  
  // Update UI to show loading state if requested
  if (showLoadingIndicator) {
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.innerHTML = '<option value="">Loading documents...</option>';
      documentSelect.disabled = true;
    }
    
    const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
    if (btnRefreshDocuments) {
      btnRefreshDocuments.disabled = true;
      btnRefreshDocuments.textContent = 'Loading...';
    }
  }
  
  logInfo(`Fetching documents using ${authMethod} authentication...`);
  
  try {
    // Call the real Onshape API through your server
    const response = await apiCall('documents');
    documents = response.items || response;
    
    // Update select dropdown
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.innerHTML = '<option value="">Create a new document</option>';
      documents.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.name;
        documentSelect.appendChild(option);
      });
      documentSelect.disabled = false;
    }
    
    // Update refresh button state
    const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
    if (btnRefreshDocuments) {
      btnRefreshDocuments.disabled = false;
      btnRefreshDocuments.textContent = 'Refresh';
    }
    
    logSuccess(`Found ${documents.length} documents`);
    
    // Update document info in UI
    const docCountElement = document.getElementById('documentCount');
    if (docCountElement) {
      docCountElement.textContent = documents.length;
    }
    
    return documents;
  } catch (error) {
    logError(`Error fetching documents: ${error.message}`);
    
    // Reset UI in case of error
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.innerHTML = '<option value="">Failed to load documents</option>';
      documentSelect.disabled = false;
    }
    
    const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
    if (btnRefreshDocuments) {
      btnRefreshDocuments.disabled = false;
      btnRefreshDocuments.textContent = 'Retry';
    }
    
    return [];
  }
}

/**
 * Get document by ID
 */
export function getDocumentById(id) {
  return documents.find(doc => doc.id === id);
}

/**
 * Get all documents
 */
export function getDocuments() {
  return documents;
}

/**
 * Get workspaces for a document
 */
export async function getWorkspaces(documentId) {
  try {
    return await apiCall(`documents/${documentId}/workspaces`);
  } catch (error) {
    logError(`Failed to fetch workspaces: ${error.message}`);
    return [];
  }
}

/**
 * Fetch all elements in a document
 * @param {string} documentId - The document ID
 * @returns {Promise<Array>} - The elements in the document
 */
export async function fetchElementsForDocument(documentId) {
  logDebug(`API call: fetchElementsForDocument(${documentId})`);
  
  if (!documentId) {
    logError('Missing documentId in fetchElementsForDocument');
    throw new Error('Document ID is required');
  }
  
  try {
    // Use the apiCall helper for consistency with other API calls
    const data = await apiCall(`documents/${documentId}/elements`);
    logDebug(`fetchElementsForDocument returned ${data?.length || 0} elements`);
    return data;
  } catch (error) {
    logError(`Error in fetchElementsForDocument: ${error.message}`);
    throw error;
  }
}

/**
 * Fetches planes for a part studio
 * @param {string} documentId - Document ID
 * @param {string} workspaceId - Workspace ID (optional, will fetch default if not provided)
 * @param {string} elementId - Element ID (part studio)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeCustomPlanes=true] - Whether to include custom planes
 * @returns {Promise<Array>} List of planes
 */
export async function fetchPlanesForPartStudio(documentId, workspaceId, elementId, options = {}) {
  // Parameter validation
  if (!documentId) {
    throw new Error('Document ID is required');
  }
  
  if (!elementId) {
    throw new Error('Element ID (part studio) is required');
  }
  
  try {
    const includeCustomPlanes = options?.includeCustomPlanes !== false;
    
    // If no workspace ID provided, fetch the default workspace
    if (!workspaceId) {
      logDebug('No workspace ID provided, fetching default workspace');
      try {
        const workspaces = await getWorkspaces(documentId);
        const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
        
        if (!defaultWorkspace) {
          throw new Error('No workspace found for document');
        }
        
        workspaceId = defaultWorkspace.id;
        logDebug(`Using default workspace: ${workspaceId}`);
      } catch (wsError) {
        logError(`Failed to get workspaces: ${wsError.message}`);
        throw new Error(`Could not determine workspace for document: ${wsError.message}`);
      }
    }

    // Explicit debugging of the request
    logDebug(`Fetching planes for document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
    
    // IMPORTANT: The router is mounted at /api/planes, so the correct URL format is:
    // planes/:documentId/w/:workspaceId/e/:elementId
    const endpoint = `planes/${documentId}/w/${workspaceId}/e/${elementId}`;
    
    // Construct query string separately for better clarity and debugging
    const queryParams = new URLSearchParams();
    queryParams.append('includeCustomPlanes', String(includeCustomPlanes));
    
    const fullEndpoint = `${endpoint}?${queryParams.toString()}`;
    logDebug(`Constructed planes endpoint: ${fullEndpoint}`);
    
    // Make the API call and return the result directly - no fallback
    const response = await apiCall(fullEndpoint);
    
    if (Array.isArray(response)) {
      const standardCount = response.filter(p => p.type === 'STANDARD').length;
      const customCount = response.filter(p => p.type === 'CUSTOM').length;
      logDebug(`Received ${response.length} planes (${standardCount} standard, ${customCount} custom)`);
    }
    
    return response;
  } catch (error) {
    // No fallback - propagate the error so it can be properly handled
    logError(`API error fetching planes: ${error.message}`);
    throw error;
  }
}

/**
 * Export API calls to a Postman collection
 */
export function exportApiCalls() {
  const postmanCollection = {
    info: {
      name: 'Onshape API Calls',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: apiCalls.map(call => ({
      name: call.url,
      request: {
        url: `{{baseUrl}}${call.url}`,
        method: call.method,
        header: Object.keys(call.headers).map(key => ({
          key: key,
          value: call.headers[key]
        })),
        body: call.body ? {
          mode: 'raw',
          raw: JSON.stringify(call.body, null, 2),
          options: {
            raw: {
              language: 'json'
            }
          }
        } : null
      },
      response: []
    }))
  };

  const json = JSON.stringify(postmanCollection, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'onshape-api-calls.postman_collection.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get the network logs for debugging
 * @returns {Object} Debug information about API requests and responses
 */
export function getNetworkLogs() {
  return {
    lastRequest,
    lastResponse,
    requestLog,
    summary: requestLog.map(item => ({
      url: item.request?.url,
      method: item.request?.method,
      status: item.response?.status,
      duration: item.response?.duration?.toFixed(2) + 'ms',
      timestamp: item.request?.timestamp
    }))
  };
}

/**
 * Initialize API module - adds auto-fetch of documents when authenticated
 */
export function initApi() {
  // Listen for authentication state changes
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a short time to ensure authentication check has completed
    setTimeout(() => {
      const authMethod = getAuthMethod();
      const isAuth = authMethod === 'apikey' || !!getToken();
      
      if (isAuth) {
        logInfo(`Detected ${authMethod} authentication, auto-fetching documents`);
        fetchDocuments();
      } else {
        logInfo('Not authenticated, skipping auto document fetch');
      }
    }, 500);
  });
  
  return { ready: true };
}

// Initialize the API module
const apiModule = initApi();