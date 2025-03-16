// public/js/clientAuth.js
// Store token values
let _authToken = null;
let _refreshToken = null;
let _isAuthenticated = false;
let _authMethod = 'none'; // Add this line near the other state variables

/**
 * Initialize authentication
 * @returns {Promise<boolean>} Promise resolving to whether authentication was successful
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
    return Promise.resolve(false);
  }
  
  // Check for API key auth success response from redirect
  if (apiKeyAuth) {
    console.log("API key authentication detected");
    _isAuthenticated = true;
    _authMethod = 'apikey'; // Store the auth method
    
    // Update UI to show API key auth state
    updateAuthUI(true, 'apikey');
    return Promise.resolve(true);
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
    return Promise.resolve(true);
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
      return Promise.resolve(true);
    }
  }
  
  // If we reach here, check the server's auth method
  // This allows us to handle API key authentication scenarios
  return checkServerAuthMethod()
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
 * Check the server's authentication status in detail
 * @returns {Promise<Object>} Promise resolving to detailed auth status
 */
function checkAuthStatus() {
  return fetch('/api/debug/auth')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      // Update client state based on server response
      if (data.authManager && data.authManager.method) {
        _authMethod = data.authManager.method;
        
        // If server is using API key auth and we're not authenticated yet, update state
        if (_authMethod === 'apikey' && !_isAuthenticated) {
          _isAuthenticated = true;
          updateAuthUI(true, 'apikey');
        }
      }
      
      return data;
    })
    .catch(error => {
      console.error("Error checking auth status:", error);
      return {
        error: error.message,
        isAuthenticated: _isAuthenticated,
        clientState: {
          authMethod: _authMethod,
          hasToken: !!_authToken
        }
      };
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
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
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
        
        // Check API key validity with a test endpoint
        fetch('/api/auth/test')
          .then(response => response.json())
          .then(testData => {
            if (testData.success) {
              if (logOutput) {
                const entry = document.createElement('div');
                entry.className = 'log-success';
                const timestamp = new Date().toLocaleTimeString();
                entry.textContent = `[${timestamp}] API key authentication verified successfully`;
                logOutput.appendChild(entry);
                logOutput.scrollTop = logOutput.scrollHeight;
              }
              
              // Update UI state and reload after delay
              _isAuthenticated = true;
              _authMethod = 'apikey';
              updateAuthUI(true, 'apikey');
              
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            } else {
              // API key test failed
              if (logOutput) {
                const entry = document.createElement('div');
                entry.className = 'log-error';
                const timestamp = new Date().toLocaleTimeString();
                entry.textContent = `[${timestamp}] API key validation failed: ${testData.error || 'Unknown error'}`;
                logOutput.appendChild(entry);
                logOutput.scrollTop = logOutput.scrollHeight;
              }
            }
          })
          .catch(error => {
            console.error('API key test failed:', error);
            if (logOutput) {
              const entry = document.createElement('div');
              entry.className = 'log-error';
              const timestamp = new Date().toLocaleTimeString();
              entry.textContent = `[${timestamp}] API key test error: ${error.message}`;
              logOutput.appendChild(entry);
              logOutput.scrollTop = logOutput.scrollHeight;
            }
          });
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
      if (logOutput) {
        const entry = document.createElement('div');
        entry.className = 'log-error';
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] Auth check failed: ${error.message}. Falling back to OAuth...`;
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
      }
      
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
    entry.textContent = `[${timestamp}] Debugging auth state - Method: ${_authMethod}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  
  // Use the comprehensive debug endpoint
  checkAuthStatus()
    .then(data => {
      console.log("%c[AUTH DEBUG] Server auth state:", "color: #9c27b0", data);
      
      // Add to UI log if available
      if (logOutput) {
        const entry = document.createElement('div');
        entry.className = 'log-debug';
        const timestamp = new Date().toLocaleTimeString();
        
        if (data.authManager) {
          entry.textContent = `[${timestamp}] Server auth: ${data.authManager.method} (${data.isAuthenticated ? 'Authenticated' : 'Not authenticated'})`;
        } else if (data.error) {
          entry.textContent = `[${timestamp}] Auth debug error: ${data.error}`;
          entry.className = 'log-error';
        }
        
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
      }
      
      // Test authentication with a simple API call
      return fetch('/api/auth/test')
        .then(response => {
          console.log("%c[AUTH DEBUG] Auth test response status:", "color: #9c27b0", response.status);
          if (!response.ok) {
            throw new Error(`Test endpoint returned ${response.status}`);
          }
          return response.json();
        })
        .then(testData => {
          console.log("%c[AUTH DEBUG] Auth test result:", "color: #9c27b0", testData);
          
          // Add to UI log if available
          if (logOutput) {
            const entry = document.createElement('div');
            entry.className = testData.success ? 'log-success' : 'log-warning';
            const timestamp = new Date().toLocaleTimeString();
            entry.textContent = `[${timestamp}] Auth test: ${testData.success ? 'Success' : 'Failed'} (${testData.method || 'unknown'})`;
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
    });
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
  debugAuthState,
  checkAuthStatus
};