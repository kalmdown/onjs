// public/js/clientAuth.js
// Store token values
let _authToken = null;
let _refreshToken = null;
let _isAuthenticated = false;
let _authMethod = 'none'; // Add this line near the other state variables

/**
 * Initialize authentication
 * @returns {boolean} Whether authentication was successful
 */
function init() {
  console.log("Initializing auth module");
  
  // Check URL parameters for tokens
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const refreshToken = urlParams.get('refresh');
  const error = urlParams.get('error');
  const apiKeyAuth = urlParams.get('auth') === 'apikey';
  
  console.log("Checking authentication state");
  
  // Handle authentication errors
  if (error) {
    console.error("Authentication error:", error);
    handleAuthError(error);
    return false;
  }
  
  // Check for API key auth success response from redirect
  if (apiKeyAuth) {
    console.log("API key authentication detected");
    _isAuthenticated = true;
    _authMethod = 'apikey'; // Store the auth method
    
    // Update UI to show API key auth state
    updateAuthUI(true, 'apikey');
    return true;
  }
  
  // Check for tokens in URL
  if (token) {
    console.log("Token received in URL params");
    _authToken = token;
    _refreshToken = refreshToken || null;
    _isAuthenticated = true;
    _authMethod = 'oauth'; // Store the auth method
    
    // Save tokens
    try {
      localStorage.setItem('authToken', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    } catch (e) {
      console.warn("Could not save token to localStorage:", e);
    }
    
    // Clean URL by removing query parameters without refreshing page
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Update UI
    updateAuthUI(true, 'oauth');
    return true;
  } else {
    // Check for stored token in localStorage
    const storedToken = localStorage.getItem('authToken');
    const storedRefresh = localStorage.getItem('refreshToken');
    
    if (storedToken) {
      console.log("Using stored authentication token");
      _authToken = storedToken;
      _refreshToken = storedRefresh;
      _isAuthenticated = true;
      _authMethod = 'oauth'; // Store the auth method
      
      // Update UI
      updateAuthUI(true, 'oauth');
      return true;
    }
  }
  
  // If we reach here, check the server's auth method
  // This allows us to handle API key authentication scenarios
  checkServerAuthMethod()
    .then(method => {
      if (method === 'apikey') {
        console.log("Server is using API key authentication");
        _isAuthenticated = true;
        _authMethod = 'apikey'; // Store the auth method
        updateAuthUI(true, 'apikey');
        return true;
      } else {
        // If we reach here, not authenticated
        console.warn("No valid authentication found");
        updateAuthUI(false);
        return false;
      }
    })
    .catch(err => {
      console.error("Error checking server auth method:", err);
      updateAuthUI(false);
      return false;
    });
}

/**
 * Check the server's authentication method
 * @returns {Promise<string>} Promise resolving to the auth method
 */
function checkServerAuthMethod() {
  return fetch('/api/auth/method')
    .then(response => response.json())
    .then(data => {
      console.log("Server auth method:", data.method);
      return data.method;
    });
}

/**
 * Check if user is authenticated
 * @returns {boolean} Whether user is authenticated
 */
function isAuthenticated() {
  // We're authenticated if we either have an OAuth token or are using API key auth
  return !!_authToken || (_isAuthenticated && _authMethod === 'apikey');
}

/**
 * Get authentication token
 * @returns {string|null} The authentication token or null if not authenticated
 */
function getToken() {
  // For OAuth authentication, return the stored token
  if (_authToken) {
    return _authToken;
  }
  
  // For API key auth, we don't have a token to return but we're still authenticated
  // The server will use the API key stored in the AuthManager
  if (_isAuthenticated && _authMethod === 'apikey') {
    return null; // No token needed for API key auth
  }
  
  // Not authenticated
  return null;
}

/**
 * Get the current authentication method
 * @returns {string} The current auth method ('oauth', 'apikey', or 'none')
 */
function getAuthMethod() {
  return _authMethod || 'none';
}

/**
 * Alternative name for getToken for backward compatibility
 * @returns {string|null} Authentication token
 */
function getAuthToken() {
  return _authToken;
}

/**
 * Initiate authentication process
 * This redirects to the Onshape OAuth page
 */
function authenticate() {
  console.log("%c[AUTH] User clicked Authenticate button", "color: #FF8C00; font-weight: bold;");
  
  // Display a logging message in the UI
  const logOutput = document.getElementById('logOutput');
  if (logOutput) {
    const entry = document.createElement('div');
    entry.className = 'log-auth';
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] Initializing authentication...`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  
  // First check what authentication method the server is using
  fetch('/api/auth/method')
    .then(response => response.json())
    .then(data => {
      if (data.method === 'oauth') {
        // Display a logging message in the UI with orange color
        if (logOutput) {
          const entry = document.createElement('div');
          entry.className = 'log-auth';  
          const timestamp = new Date().toLocaleTimeString();
          entry.textContent = `[${timestamp}] Redirecting to Onshape for authentication...`;
          logOutput.appendChild(entry);
          logOutput.scrollTop = logOutput.scrollHeight;
        }
        
        // Use OAuth flow
        window.location.href = '/oauth/login';
      } else if (data.method === 'apikey') {
        // Display that we're using API key auth
        if (logOutput) {
          const entry = document.createElement('div');
          entry.className = 'log-auth';
          const timestamp = new Date().toLocaleTimeString();
          entry.textContent = `[${timestamp}] Using API key authentication (already configured)`;
          logOutput.appendChild(entry);
          logOutput.scrollTop = logOutput.scrollHeight;
        }
        
        // Refresh the page or indicate successful auth
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Unknown auth method
        if (logOutput) {
          const entry = document.createElement('div');
          entry.className = 'log-error';
          const timestamp = new Date().toLocaleTimeString();
          entry.textContent = `[${timestamp}] Unknown authentication method: ${data.method}`;
          logOutput.appendChild(entry);
          logOutput.scrollTop = logOutput.scrollHeight;
        }
      }
    })
    .catch(error => {
      console.error('Error checking auth method:', error);
      // Fall back to OAuth attempt
      window.location.href = '/oauth/login';
    });
}

/**
 * Log out user
 */
function logout() {
  _isAuthenticated = false;
  _authToken = null;
  _refreshToken = null;
  
  // Clear stored tokens
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  
  // Redirect to logout endpoint
  window.location.href = '/oauth/logout';
}

/**
 * Update UI based on authentication state
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @param {string} [authMethod] - The authentication method being used
 */
function updateAuthUI(isAuthenticated, authMethod) {
  const loginButton = document.getElementById('btnAuthenticate');
  const authStatus = document.getElementById('authStatus');
  
  if (loginButton && authStatus) {
    if (isAuthenticated) {
      if (authMethod === 'apikey') {
        // Special case for API key authentication
        loginButton.textContent = 'Using API Key Auth';
        loginButton.disabled = true; // Disable the button as logout isn't needed
        loginButton.classList.add('btn-secondary');
        loginButton.classList.remove('btn-primary');
        authStatus.textContent = 'API Key Auth';
      } else {
        // OAuth or other token-based auth
        loginButton.textContent = 'Logout';
        loginButton.disabled = false;
        loginButton.classList.add('btn-primary');
        loginButton.classList.remove('btn-secondary');
        loginButton.removeEventListener('click', authenticate);
        loginButton.addEventListener('click', logout);
        authStatus.textContent = 'Authenticated';
      }
      
      authStatus.className = 'ms-3 text-success';
      
      // Enable features that require authentication
      const btnConvertSvg = document.getElementById('btnConvertSvg');
      if (btnConvertSvg) {
        btnConvertSvg.disabled = false;
      }
    } else {
      loginButton.textContent = 'Authenticate with Onshape';
      loginButton.disabled = false;
      loginButton.classList.add('btn-primary');
      loginButton.classList.remove('btn-secondary');
      loginButton.removeEventListener('click', logout);
      loginButton.addEventListener('click', authenticate);
      authStatus.textContent = 'Not authenticated';
      authStatus.className = 'ms-3 text-secondary';
      
      // Disable features that require authentication
      const btnConvertSvg = document.getElementById('btnConvertSvg');
      if (btnConvertSvg) {
        btnConvertSvg.disabled = true;
      }
    }
  }
}

/**
 * Handle authentication errors
 * @param {string} error - Error message
 */
function handleAuthError(error) {
  console.error("Authentication error:", error);
  
  // Try to show in dedicated auth-error element if it exists
  const errorContainer = document.getElementById('auth-error');
  if (errorContainer) {
    errorContainer.style.display = 'block';
    errorContainer.textContent = `Authentication failed: ${error}`;
  }
  
  // Also log to the activity log if it exists
  const logOutput = document.getElementById('logOutput');
  if (logOutput) {
    const entry = document.createElement('div');
    entry.className = 'log-error';
    entry.textContent = `Authentication error: ${error}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }
}

/**
 * Debug authentication state and token validity
 * Logs state to console and performs test API call
 */
function debugAuthState() {
  console.log("%c[AUTH DEBUG] Current auth state:", "color: #9c27b0; font-weight: bold", {
    isAuthenticated: _isAuthenticated,
    hasAuthToken: !!_authToken,
    authTokenLength: _authToken ? _authToken.length : 0,
    hasRefreshToken: !!_refreshToken,
    localStorageToken: localStorage.getItem('authToken') ? 'Present' : 'None',
    localStorageRefreshToken: localStorage.getItem('refreshToken') ? 'Present' : 'None'
  });
  
  // Log to UI if log output exists
  const logOutput = document.getElementById('logOutput');
  if (logOutput) {
    const entry = document.createElement('div');
    entry.className = 'log-debug';
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] Debugging auth state - Token ${_authToken ? 'present' : 'missing'}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  
  // First check token state from server
  fetch('/api/auth/token-debug')
    .then(response => {
      console.log("%c[AUTH DEBUG] Server token state response status:", "color: #9c27b0", response.status);
      return response.json();
    })
    .then(data => {
      console.log("%c[AUTH DEBUG] Server token state:", "color: #9c27b0", data);
      
      // Log any token discrepancies
      if (_authToken && !data.hasManagerToken) {
        console.warn("%c[AUTH DEBUG] Warning: Client has token but server auth manager doesn't", "color: #ff9800; font-weight: bold");
      }
      
      if (data.hasManagerToken && !_authToken) {
        console.warn("%c[AUTH DEBUG] Warning: Server has token but client doesn't", "color: #ff9800; font-weight: bold");
      }
      
      // Add to UI log if available
      if (logOutput) {
        const entry = document.createElement('div');
        entry.className = 'log-debug';
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] Server auth: ${data.authMethod} (${data.authenticated ? 'Authenticated' : 'Not authenticated'})`;
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    })
    .catch(error => {
      console.error("%c[AUTH DEBUG] Error checking server token state:", "color: #f44336", error);
    });
  
  // Then check token validity by making a test API call
  if (_authToken) {
    console.log("%c[AUTH DEBUG] Testing auth token with API call...", "color: #9c27b0");
    fetch('/api/auth/status', {
      headers: {
        'Authorization': `Bearer ${_authToken}`
      }
    })
    .then(response => {
      console.log("%c[AUTH DEBUG] Auth test response status:", "color: #9c27b0", response.status);
      return response.json();
    })
    .then(data => {
      console.log("%c[AUTH DEBUG] Auth test response data:", "color: #9c27b0", data);
      
      // Add to UI log if available
      if (logOutput) {
        const entry = document.createElement('div');
        entry.className = data.authenticated ? 'log-success' : 'log-warning';
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] Auth test: ${data.authenticated ? 'Token valid' : 'Token invalid'}`;
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    })
    .catch(error => {
      console.error("%c[AUTH DEBUG] Auth test failed:", "color: #f44336", error);
      
      // Add to UI log if available
      if (logOutput) {
        const entry = document.createElement('div');
        entry.className = 'log-error';
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] Auth test failed: ${error.message}`;
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    });
  }
}

// Modify the existing DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing auth");
  init();
  
  // Debug auth state after init with slight delay to allow other processes to complete
  setTimeout(debugAuthState, 500);
  
  // Add direct event listener for authentication button
  const btnAuthenticate = document.getElementById('btnAuthenticate');
  if (btnAuthenticate) {
    console.log("Directly attaching event to auth button");
    btnAuthenticate.addEventListener('click', function(e) {
      console.log("Auth button clicked (direct listener)");
      e.preventDefault(); // Prevent default form submission
      authenticate();
    });
  } else {
    console.error("Auth button not found in DOMContentLoaded");
  }
  
  // Add a debug button to the UI next to auth status
  const authStatus = document.getElementById('authStatus');
  if (authStatus && authStatus.parentNode) {
    const debugBtn = document.createElement('button');
    debugBtn.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'ms-2');
    debugBtn.textContent = 'Debug Auth';
    debugBtn.addEventListener('click', debugAuthState);
    authStatus.parentNode.appendChild(debugBtn);
  }
});

// Export everything that might be needed
export { 
  init as initAuth, 
  isAuthenticated, 
  getToken, 
  getAuthToken,
  getAuthMethod,
  authenticate,
  logout,
  debugAuthState
};