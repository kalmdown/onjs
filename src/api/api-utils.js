// src/api/api-utils.js
const logger = require('../utils/logger');
const log = logger.scope('APIUtils');

/**
 * Get the base URL for API calls
 * @returns {string} The base URL for API calls
 */
function getApiBaseUrl() {
  // In a Node.js context, use the server's base URL
  if (typeof window === 'undefined') {
    return process.env.API_BASE_URL || '';
  }
  
  // In a browser context, use the current origin
  return window.location.origin;
}

/**
 * Get the active document ID
 * @returns {string|null} The active document ID or null if not available
 */
function getActiveDocumentId() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Try to get document ID from URL or other sources
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('documentId') || localStorage.getItem('activeDocumentId');
}

/**
 * Get the active workspace ID
 * @returns {string|null} The active workspace ID or null if not available
 */
function getActiveWorkspaceId() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Try to get workspace ID from URL or other sources
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('workspaceId') || localStorage.getItem('activeWorkspaceId');
}

/**
 * Get the active element ID
 * @returns {string|null} The active element ID or null if not available
 */
function getActiveElementId() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Try to get element ID from URL or other sources
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('elementId') || localStorage.getItem('activeElementId');
}

/**
 * Make an API call
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} API response
 */
async function apiCall(method, endpoint, params = {}) {
  try {
    const url = `${getApiBaseUrl()}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (method !== 'GET' && params) {
      options.body = JSON.stringify(params);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error || errorData.message || errorText}`);
      } catch (e) {
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    log.error(`API call error: ${error.message}`, error);
    throw error;
  }
}

module.exports = {
  getApiBaseUrl,
  getActiveDocumentId,
  getActiveWorkspaceId,
  getActiveElementId,
  apiCall
};// src/api/api-utils.js
