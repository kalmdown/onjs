import { authToken } from './auth.js';
import { logError, logSuccess, logInfo, logDebug } from './utils/logging.js';

// State
let documents = [];
let apiCalls = []; // Array to store API calls

/**
 * Make an API call to the backend server
 */
export async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    // Build the options for the fetch request
    const options = { 
      method, 
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add auth token if available
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Add body data for POST/PUT requests
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
      logInfo(`Making ${method} request to /api/${endpoint} with payload: ${JSON.stringify(body)}`);
    } else {
      logInfo(`Making ${method} request to /api/${endpoint}`);
    }
    
    // Store the API call
    apiCalls.push({
      url: `/api/${endpoint}`,
      method: method,
      headers: options.headers,
      body: body
    });

    // Make the request
    const response = await fetch(`/api/${endpoint}`, options);
    
    // Handle non-success responses
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('API error details:', errorData);
      } catch (jsonError) {
        errorData = { error: `API error: ${response.status} - Failed to parse JSON response` };
      }
      
      // Check for authentication errors
      if (response.status === 401) {
        // Redirect to login for authentication errors
        logError('Authentication required. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/oauth/login';
        }, 1000);
      }
      
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Full API call error:', error);
    logError(`API call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch documents from Onshape
 */
export async function fetchDocuments() {
  if (!authToken) {
    logError('Not authenticated');
    return [];
  }
  
  logInfo('Fetching documents...');
  
  try {
    // Call the real Onshape API through your server
    const response = await apiCall('documents');
    documents = response.items || response;
    
    // Update select dropdown
    const documentSelect = document.getElementById('documentSelect');
    documentSelect.innerHTML = '<option value="">Create a new document</option>';
    documents.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.name;
      documentSelect.appendChild(option);
    });
    
    logSuccess(`Found ${documents.length} documents`);
    return documents;
  } catch (error) {
    logError(`Error fetching documents: ${error.message}`);
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