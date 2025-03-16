// public/js/api.js

// Import the functions that return auth information
import { getToken, getAuthMethod } from './clientAuth.js';
import { logError, logSuccess, logInfo, logDebug } from './utils/logging.js';

// State
let documents = [];
let apiCalls = []; // Array to store API calls
let lastRequest = null;
let lastResponse = null;
let requestLog = [];

/**
 * Make an API call to the backend server
 */
export async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const startTime = performance.now();
    
    // Build the options for the fetch request
    const options = { 
      method, 
      headers: {
        'Content-Type': 'application/json'
      },
      // Include credentials to ensure cookies are sent with the request
      // This is important for API key auth which relies on session
      credentials: 'same-origin'
    };
    
    // Get the current auth method and token
    const authMethod = getAuthMethod();
    const token = getToken();
    
    // Add auth header only for OAuth authentication
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      logDebug(`Adding OAuth token to request headers`);
    } else if (authMethod === 'apikey') {
      // For API key auth, we don't need to add a token
      // The server will use the API key from the AuthManager
      logDebug('Using API key authentication for this request');
      
      // Add a custom header to help with debugging
      options.headers['X-Auth-Method'] = 'apikey';
    } else {
      logDebug('No authentication available for this request');
    }
    
    // Add body data for POST/PUT requests
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
      logInfo(`Making ${method} request to /api/${endpoint} with payload`);
    } else {
      logInfo(`Making ${method} request to /api/${endpoint}`);
    }
    
    // Store API call details for debug and export
    const apiCallDetails = {
      url: `/api/${endpoint}`,
      method,
      headers: {...options.headers},
      body,
      timestamp: new Date().toISOString()
    };
    
    apiCalls.push(apiCallDetails);
    lastRequest = apiCallDetails;
    
    // Log the full request details
    logDebug('API Request details:', {
      url: `/api/${endpoint}`,
      method: method,
      headers: options.headers,
      authMethod,
      hasToken: !!token
    });
    
    // Make the request
    const response = await fetch(`/api/${endpoint}`, options);
    
    // Record response time
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Process and log response
    try {
      // Try to parse as JSON first
      const responseData = await response.json();
      
      // Store response details
      lastResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        data: responseData,
        timestamp: new Date().toISOString(),
        duration
      };
      
      // Add to request log (keep last 10)
      requestLog.unshift({request: lastRequest, response: lastResponse});
      if (requestLog.length > 10) requestLog.pop();
      
      // Log response summary
      logDebug(`API Response (${response.status}, ${duration.toFixed(0)}ms): `, 
               response.ok ? 'Success' : 'Error');
      
      // Handle non-success responses
      if (!response.ok) {
        if (response.status === 401) {
          logError('Authentication error: ' + (responseData.error || 'Unauthorized'));
          
          // Different handling based on auth method
          if (authMethod === 'apikey') {
            logError('API key authentication failed. Check server API key configuration.');
          } else {
            logError('OAuth token invalid or expired. Redirecting to login...');
            
            // For serious auth issues with OAuth, redirect to login
            if (authMethod === 'oauth') {
              setTimeout(() => {
                window.location.href = '/oauth/login';
              }, 1000);
            }
          }
        }
        
        throw new Error(responseData.error || `API error: ${response.status}`);
      }
      
      return responseData;
    } catch (parseError) {
      // If JSON parsing fails, handle text response
      const textResponse = await response.text().catch(() => 'No response body');
      
      // Store response details
      lastResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        data: { text: textResponse },
        timestamp: new Date().toISOString(),
        duration,
        parseError: parseError.message
      };
      
      // Add to request log
      requestLog.unshift({request: lastRequest, response: lastResponse});
      if (requestLog.length > 10) requestLog.pop();
      
      // Log error
      logError(`API Response parsing error: ${parseError.message}`);
      
      // For successful responses with parsing errors, return the text
      if (response.ok) {
        return { text: textResponse, parseError: true };
      } else {
        throw new Error(`API error: ${response.status} - ${textResponse}`);
      }
    }
  } catch (error) {
    logError(`API call failed: ${error.message}`);
    
    // Add error to response log
    const errorResponse = {
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    if (lastRequest) {
      requestLog.unshift({
        request: lastRequest, 
        response: errorResponse
      });
      if (requestLog.length > 10) requestLog.pop();
    }
    
    // Rethrow the error for the caller to handle
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
 * Fetch all elements for a document
 * 
 * @param {string} documentId Document ID
 * @returns {Promise<Array>} Array of elements
 */
export async function fetchElementsForDocument(documentId) {
  if (!documentId) {
    throw new Error('Document ID is required');
  }
  
  try {
    const workspaces = await getWorkspaces(documentId);
    const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
    
    if (!defaultWorkspace) {
      throw new Error('No workspace found for document');
    }
    
    const response = await apiCall(`documents/${documentId}/w/${defaultWorkspace.id}/elements`);
    return response.elements || response;
  } catch (error) {
    logError(`Failed to fetch elements: ${error.message}`);
    return [];
  }
}

/**
 * Fetch planes for a part studio
 * 
 * @param {string} documentId Document ID
 * @param {string} partStudioId Part studio ID
 * @param {boolean} includeCustomPlanes Whether to include custom planes
 * @returns {Promise<Array>} Array of planes
 */
export async function fetchPlanesForPartStudio(documentId, partStudioId, includeCustomPlanes = true) {
  if (!documentId || !partStudioId) {
    throw new Error('Document ID and Part Studio ID are required');
  }
  
  try {
    logDebug(`API Call: Fetching planes with includeCustomPlanes=${includeCustomPlanes}`);
    
    const workspaces = await getWorkspaces(documentId);
    const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
    
    if (!defaultWorkspace) {
      throw new Error('No workspace found for document');
    }
    
    // Make API request to get planes through our server API
    const endpoint = `documents/${documentId}/w/${defaultWorkspace.id}/e/${partStudioId}/planes?includeCustomPlanes=${includeCustomPlanes}`;
    const data = await apiCall(endpoint);
    
    logDebug('Planes response:', data);
    
    return data.planes || [];
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