// public/js/api.js

// Import the functions that return auth information
import { getToken, getAuthMethod } from './clientAuth.js';
import { logError, logInfo, logDebug, logWarn } from './utils/logging.js';

// State
let documents = [];
let apiCalls = []; // Array to store API calls
let lastRequest = null;
let lastResponse = null;
let requestLog = [];
let isDocumentFetchInProgress = false; // Add a flag to track document fetching to avoid duplicates

/**
 * Make an authenticated API call with enhanced logging
 * @param {string} endpoint - API endpoint path
 * @param {string} [method='GET'] - HTTP method
 * @param {object} [data=null] - Request body data
 * @param {object} [options={}] - Additional options
 * @returns {Promise<any>} API response
 */
export async function apiCall(endpoint, method = 'GET', data = null, options = {}) {
  const defaultOptions = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  // Add request body if provided
  if (data) {
    defaultOptions.body = JSON.stringify(data);
  }

  const requestOptions = { ...defaultOptions, ...options };
  
  // Use Onshape URL patterns directly
  const url = endpoint.startsWith('/') ? 
    `/api${endpoint}` : 
    endpoint.includes('/api/') ?
    endpoint :
    `/api/${endpoint}`;
    
  // Generate a unique ID for this request to correlate logs
  const requestId = Math.random().toString(36).substring(2, 8);

  // Log the Onshape equivalent URL for reference
  const onshapeApiUrl = 'https://cad.onshape.com/api/v10';
  const onshapeEquivalent = `${onshapeApiUrl}/${endpoint}`;
  logDebug(`[${requestId}] API Request: ${requestOptions.method} ${url}`);
  logDebug(`[${requestId}] Onshape Equivalent: ${onshapeEquivalent}`);
  
  // Track request for debugging
  lastRequest = {
    endpoint,
    url,
    onshapeEquivalent,
    method: requestOptions.method,
    headers: requestOptions.headers,
    body: data,
    timestamp: new Date().toISOString()
  };
  
  requestLog.push({
    request: lastRequest
  });
  
  logDebug(`[${requestId}] API Request: ${requestOptions.method} ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, requestOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Track response for debugging
    lastResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries([...response.headers.entries()]),
      duration,
      timestamp: new Date().toISOString()
    };
    
    // Update the most recent request log with response info
    if (requestLog.length > 0) {
      requestLog[requestLog.length - 1].response = lastResponse;
    }
    
    logDebug(`[${requestId}] API Response: ${response.status} (${duration}ms)`);
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "Could not read error response";
      }
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      // Enhanced error logging with detailed request information
      logError(`[${requestId}] API Error: ${response.status} ${response.statusText}`, errorData);
      logError(`[${requestId}] Failed Request Details:
        URL: ${method} ${url}
        Endpoint: ${endpoint}
        Onshape Equivalent: ${onshapeEquivalent}
        Payload: ${JSON.stringify(data, null, 2)}`);
      
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.message || errorText}`);
    }
    
    // Check if response is empty
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      logDebug(`[${requestId}] API Success: ${typeof data === 'object' ? 'Object/Array returned' : 'Non-object returned'}`);
      
      // Track API call for export
      apiCalls.push({
        url,
        method: requestOptions.method,
        headers: requestOptions.headers,
        body: data,
        response: {
          status: response.status,
          data
        }
      });
      
      return data;
    } else {
      const text = await response.text();
      logDebug(`[${requestId}] API Success: Text response (${text.length} bytes)`);
      return text;
    }
  } catch (error) {
    // Enhanced exception logging with request details
    logError(`[${requestId}] API Exception: ${error.message}`);
    logError(`[${requestId}] Request That Caused Exception:
      URL: ${method} ${url}
      Endpoint: ${endpoint}
      Onshape Equivalent: ${onshapeEquivalent}
      Payload: ${data ? JSON.stringify(data, null, 2) : 'none'}`);
    
    throw error;
  }
}

/**
 * Fetch documents from Onshape
 * @param {boolean} [showLoadingIndicator=true] Whether to show loading indicator in the UI
 * @returns {Promise<Array>} Array of documents
 */
export async function fetchDocuments(showLoadingIndicator = true) {
  // Prevent duplicate fetches
  if (isDocumentFetchInProgress) {
    logDebug("Document fetch already in progress, skipping duplicate request", "Documents");
    return documents;
  }
  
  isDocumentFetchInProgress = true;
  
  // Check for authentication using the proper method instead of just token
  const authMethod = getAuthMethod();
  const isAuth = authMethod === 'apikey' || !!getToken();
  
  if (!isAuth) {
    logError('Not authenticated. Please authenticate to view documents.');
    isDocumentFetchInProgress = false; // Reset flag on error
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
  
  logInfo(`Fetching documents using ${authMethod} authentication...`, "Documents");
  
  // Add a timeout for the document fetch to prevent UI from being stuck
  const fetchTimeout = setTimeout(() => {
    if (isDocumentFetchInProgress) {
      logError("Document fetch timed out after 30 seconds", "Documents");
      isDocumentFetchInProgress = false;
      
      // Reset UI in case of timeout
      const documentSelect = document.getElementById('documentSelect');
      if (documentSelect) {
        documentSelect.innerHTML = '<option value="">Fetch timed out - try again</option>';
        documentSelect.disabled = false;
      }
      
      const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
      if (btnRefreshDocuments) {
        btnRefreshDocuments.disabled = false;
        btnRefreshDocuments.textContent = 'Retry';
      }
    }
  }, 30000); // 30 second timeout
  
  try {
    // Detailed logging of the documents API call
    logInfo(`Making API call to 'documents' endpoint...`, "Documents");
    
    // Call the API to get documents - use direct URL for clarity
    const documentsEndpoint = 'documents';
    const onshapeApiUrl = 'https://cad.onshape.com/api/v10';
    logInfo(`Full API URL: ${onshapeApiUrl}/${documentsEndpoint}`, "Documents");
    
    // Make the actual call
    const response = await apiCall(documentsEndpoint);
    
    // Log raw response for debugging
    logDebug(`Documents API raw response: ${JSON.stringify(response)}`, "Documents");
    
    // Clear timeout since we got a response
    clearTimeout(fetchTimeout);
    
    // Check for proper response format
    if (!response) {
      throw new Error('Empty response from documents API');
    }
    
    if (!response.items && !Array.isArray(response)) {
      logError(`Invalid documents response format: ${JSON.stringify(response)}`, "Documents");
      throw new Error('Invalid response format from documents API');
    }
    
    // Store documents in the correct format
    documents = response.items || response;
    logInfo(`Processed ${documents.length} documents from response`, "Documents");
    
    // Update select dropdown
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.innerHTML = '<option value="">Create a new document</option>';
      
      if (documents.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.disabled = true;
        emptyOption.textContent = '-- No documents found --';
        documentSelect.appendChild(emptyOption);
      } else {
        documents.forEach(doc => {
          const option = document.createElement('option');
          option.value = doc.id;
          option.textContent = doc.name;
          documentSelect.appendChild(option);
        });
      }
      
      documentSelect.disabled = false;
    }
    
    // Update refresh button state
    const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
    if (btnRefreshDocuments) {
      btnRefreshDocuments.disabled = false;
      btnRefreshDocuments.textContent = 'Refresh';
    }
    
    logInfo(`Found ${documents.length} documents`, "Documents");
    
    // Update document info in UI
    const docCountElement = document.getElementById('documentCount');
    if (docCountElement) {
      docCountElement.textContent = documents.length;
    }
    
    return documents;
  } catch (error) {
    // Clear timeout since we got an error
    clearTimeout(fetchTimeout);
    
    // Enhanced error logging
    logError(`Error fetching documents: ${error.message}`, "Documents");
    logError(`Stack trace: ${error.stack}`, "Documents");
    
    if (error.response) {
      logError(`Response error data: ${JSON.stringify(error.response)}`, "Documents");
    }
    
    // Reset UI with more descriptive error
    const documentSelect = document.getElementById('documentSelect');
    if (documentSelect) {
      documentSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
      documentSelect.disabled = false;
    }
    
    const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
    if (btnRefreshDocuments) {
      btnRefreshDocuments.disabled = false;
      btnRefreshDocuments.textContent = 'Retry';
    }
    
    return [];
  } finally {
    // Always reset the flag when done
    isDocumentFetchInProgress = false;
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
    // Add debug logs to trace the request
    logInfo(`Fetching workspaces for document ID: ${documentId}`, "Workspaces");
    
    // Make sure we're using the correct URL pattern
    const endpoint = `documents/d/${documentId}/workspaces`;
    logDebug(`Using endpoint: ${endpoint}`, "Workspaces");
    
    // Make the API call
    const response = await apiCall(endpoint);
    
    logInfo(`Successfully fetched ${Array.isArray(response) ? response.length : 
      (response.items ? response.items.length : 'unknown')} workspaces`, "Workspaces");
    
    return response;
  } catch (error) {
    logError(`Failed to fetch workspaces: ${error.message}`, "Workspaces");
    return [];
  }
}

/**
 * Fetch all elements for a document with improved error handling
 * 
 * @param {string} documentId Document ID
 * @returns {Promise<Array>} Array of elements
 */
export async function fetchElementsForDocument(documentId) {
  if (!documentId) {
    throw new Error('Document ID is required');
  }
  
  try {
    logDebug(`Fetching elements for document ${documentId}`);
    
    // Try to get workspaces first
    let workspaces;
    try {
      workspaces = await getWorkspaces(documentId);
    } catch (wsError) {
      logError(`Failed to fetch workspaces: ${wsError.message}`);
      // Generate a default workspace as fallback
      workspaces = [{ id: 'default', isDefault: true }];
    }
    
    const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
    
    if (!defaultWorkspace) {
      throw new Error('No workspace found for document');
    }
    
    // Now get elements
    try {
      const response = await apiCall(`documents/d/${documentId}/w/${defaultWorkspace.id}/elements`);
      const elements = response.elements || response;
      logDebug(`Retrieved ${elements.length} elements for document ${documentId}`);
      return elements;
    } catch (elemError) {
      logError(`Failed to fetch elements: ${elemError.message}`);
      throw elemError;
    }
  } catch (error) {
    logError(`Failed to fetch elements for document ${documentId}: ${error.message}`);
    return [];
  }
}

/**
 * Fetch planes for a part studio with improved error handling
 * 
 * @param {string} documentId Document ID
 * @param {string} workspaceId Workspace ID
 * @param {string} elementId Element ID (part studio)
 * @param {Object} options Additional options
 * @returns {Promise<Array>} Array of planes
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
    
    // Use the proper route format for planes
    // IMPORTANT: The router is mounted at /api/planes, so the correct URL format is:
    // planes/d/:documentId/w/:workspaceId/e/:elementId
    const endpoint = `planes/d/${documentId}/w/${workspaceId}/e/${elementId}`;
    
    // Construct query string separately for better clarity and debugging
    const queryParams = new URLSearchParams();
    queryParams.append('includeCustomPlanes', String(includeCustomPlanes));
    
    const fullEndpoint = `${endpoint}?${queryParams.toString()}`;
    logDebug(`Constructed planes endpoint: ${fullEndpoint}`);
    
    try {
      const response = await apiCall(fullEndpoint);
      
      if (response.defaultPlanes || Array.isArray(response)) {
        const result = Array.isArray(response) ? response : response;
        logDebug(`Received planes data: ${JSON.stringify(result)}`);
        return result;
      }
      
      return response;
    } catch (apiError) {
      logError(`API call to planes endpoint failed: ${apiError.message}`);
      
      // If the server is unreachable, use fallback planes
      if (apiError.message && (apiError.message.includes('Network Error') || 
          apiError.message.includes('CONNECTION_REFUSED'))) {
        logWarn('Server connection issue, using fallback planes');
        
        // Return standard planes as fallback
        const fallbackPlanes = [
          { id: `${elementId}_JHD`, name: "TOP", type: "STANDARD", transientId: "TOP" },
          { id: `${elementId}_JFD`, name: "FRONT", type: "STANDARD", transientId: "FRONT" },
          { id: `${elementId}_JGD`, name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
        ];
        
        return fallbackPlanes;
      }
      
      throw apiError;
    }
  } catch (error) {
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
  // Flag to track if we've already auto-fetched
  let didAutoFetch = false;
  
  // Listen for authentication state changes
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a short time to ensure authentication check has completed
    setTimeout(() => {
      const authMethod = getAuthMethod();
      const isAuth = authMethod === 'apikey' || !!getToken();
      
      if (isAuth && !didAutoFetch) {
        logInfo(`Detected ${authMethod} authentication, auto-fetching documents`, "Documents");
        didAutoFetch = true;
        fetchDocuments();
      } else if (!isAuth) {
        logInfo('Not authenticated, skipping auto document fetch', "Documents");
      }
    }, 500);
  });
  
  return { ready: true };
}

// Initialize the API module
const apiModule = initApi();