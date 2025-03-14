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

  if (urlToken) {
    console.log('Setting auth token from URL');
    authToken = urlToken;
    refreshToken = urlRefresh || null;
    localStorage.setItem('onshapeAuthToken', authToken);
    if (refreshToken) {
      localStorage.setItem('onshapeRefreshToken', refreshToken);
    }
    updateAuthStatus(true);
    // Clean URL
    window.history.replaceState({}, document.title, '/');
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
      
      // Validate the token by making a request to the auth status endpoint
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
          updateAuthStatus(true);
          return true;
        } else {
          // Token is invalid
          logError('Stored token is invalid, please re-authenticate');
          clearAuthTokens();
          return false;
        }
      } catch (error) {
        // Token validation request failed
        logError('Failed to validate token, please re-authenticate');
        clearAuthTokens();
        return false;
      }
    } else {
      updateAuthStatus(false);
      return false;
    }
  }
}

/**
 * Clear authentication tokens
 */
function clearAuthTokens() {
  authToken = null;
  refreshToken = null;
  localStorage.removeItem('onshapeAuthToken');
  localStorage.removeItem('onshapeRefreshToken');
  updateAuthStatus(false);
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
export function authenticate() {
  logInfo('Starting authentication process...');
  
  // Proper OAuth flow: redirect to server endpoint that handles OAuth
  window.location.href = '/oauth/login';
}

/**
 * Get the current auth token
 */
export function getAuthToken() {
  return authToken;
}

// Import from other modules
import { logInfo, logError } from './utils/logging.js';