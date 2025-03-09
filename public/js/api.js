import { authToken } from './auth.js';
import { logError, logSuccess, logInfo } from './utils/logging.js';

// State
let documents = [];
let apiCalls = []; // Array to store API calls

/**
 * Make an API call to the backend server
 */
export async function apiCall(endpoint, method = 'GET', body = null) {
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };
  
  const options = { method, headers };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
    logInfo(`Making ${method} request to /api/${endpoint} with payload: ${JSON.stringify(body)}`); // Log the payload
  }
  
  logInfo(`Making ${method} request to /api/${endpoint}`); // Log the endpoint
  
  // Store the API call
  apiCalls.push({
    url: `/api/${endpoint}`,
    method: method,
    headers: headers,
    body: body
  });

  try {
    const response = await fetch(`/api/${endpoint}`, options);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        errorData = { error: `API error: ${response.status} - Failed to parse JSON response` };
      }
      
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    logError(`API call failed: ${error.message}`);  // Log the error
    throw error;  // Re-throw the error so the calling function can handle it
  }
}

/**
 * Fetch documents from Onshape
 */
export async function fetchDocuments(logInfo) { // Accept logInfo as an argument
  if (!authToken) {
    logError('Not authenticated');
    return;
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

// Add other API-related functions from app.js

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