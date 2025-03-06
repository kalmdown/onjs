// Authentication state
export let authToken = null;
let refreshToken = null;

/**
 * Initialize authentication
 * Checks URL parameters and localStorage for existing tokens
 */
export async function initAuth() {
  // Check for authentication tokens in URL (from OAuth redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  const urlRefresh = urlParams.get('refresh');
  const urlError = urlParams.get('error');

  console.log('URL params check:', 
    urlToken ? 'Token present' : 'No token', 
    urlRefresh ? 'Refresh present' : 'No refresh token');

  if (urlToken && urlRefresh) {
    console.log('Setting auth token from URL');
    authToken = urlToken;
    refreshToken = urlRefresh;
    localStorage.setItem('onshapeAuthToken', authToken);
    localStorage.setItem('onshapeRefreshToken', refreshToken);
    updateAuthStatus(true);
    // Clean URL
    window.history.replaceState({}, document.title, '/');
    // Fetch documents
    return true;
  } else if (urlError) {
    logError(`Authentication error: ${urlError}`);
    window.history.replaceState({}, document.title, '/');
    return false;
  } else {
    // Check for stored tokens
    authToken = localStorage.getItem('onshapeAuthToken');
    refreshToken = localStorage.getItem('onshapeRefreshToken');
    if (authToken) {
      console.log('Found stored auth token');
      
      // Validate the token by making a request to a protected endpoint
      try {
        await apiCall('documents');
        updateAuthStatus(true);
        return true;
      } catch (error) {
        // Token is invalid
        logError('Stored token is invalid, please re-authenticate');
        authToken = null;
        refreshToken = null;
        localStorage.removeItem('onshapeAuthToken');
        localStorage.removeItem('onshapeRefreshToken');
        updateAuthStatus(false);
        return false;
      }
    } else {
      updateAuthStatus(false);
      return false;
    }
  }
}

/**
 * Update the authentication status display
 * 
 * @param {boolean} isAuthenticated Whether the user is authenticated
 */
export function updateAuthStatus(isAuthenticated) {
  const authStatus = document.getElementById('authStatus');
  const btnAuthenticate = document.getElementById('btnAuthenticate');
  const btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
  const documentSelect = document.getElementById('documentSelect');
  
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
export async function authenticate() {
  logInfo('Starting authentication process...');
  
  try {
    // Use the Passport OAuth route
    window.location.href = '/oauth/login';
  } catch (error) {
    logError(`Authentication error: ${error.message}`);
  }
}

/**
 * Get the current auth token
 */
export function getAuthToken() {
  return authToken;
}

// Import from other modules
import { apiCall } from './api.js';
import { logInfo, logError } from './utils/logging.js';