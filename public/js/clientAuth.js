// public/js/clientAuth.js
// Store token values
let _authToken = null;
let _refreshToken = null;
let _isAuthenticated = false;

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
  
  console.log("Checking authentication state");
  
  // Handle authentication errors
  if (error) {
    console.error("Authentication error:", error);
    showAuthError(error);
    return false;
  }
  
  // Check for tokens in URL
  if (token) {
    console.log("Token received in URL params");
    _authToken = token;
    _refreshToken = refreshToken || null;
    _isAuthenticated = true;
    
    // Save tokens
    localStorage.setItem('authToken', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    
    // Clean URL by removing query parameters without refreshing page
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Update UI
    updateAuthUI(true);
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
      
      // Update UI
      updateAuthUI(true);
      return true;
    } else {
      console.warn("URL params check: No token");
      console.warn("URL params check: No refresh token");
      
      // Update UI for unauthenticated state
      updateAuthUI(false);
      return false;
    }
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean} Whether user is authenticated
 */
function isAuthenticated() {
  return _isAuthenticated;
}

/**
 * Get authentication token
 * @returns {string|null} Authentication token
 */
function getToken() {
  return _authToken;
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
  
  // Display a logging message in the UI with orange color
  const logOutput = document.getElementById('logOutput');
  if (logOutput) {
    const entry = document.createElement('div');
    entry.className = 'log-auth';  // Use auth-specific class for orange color
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] Checking server authentication method...`;
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
 */
function updateAuthUI(isAuthenticated) {
  const loginButton = document.getElementById('btnAuthenticate');
  const authStatus = document.getElementById('authStatus');
  
  if (loginButton && authStatus) {
    if (isAuthenticated) {
      loginButton.textContent = 'Logout';
      loginButton.removeEventListener('click', authenticate);
      loginButton.addEventListener('click', logout);
      authStatus.textContent = 'Authenticated';
      authStatus.className = 'ms-3 text-success';
      
      // Enable features that require authentication
      const btnConvertSvg = document.getElementById('btnConvertSvg');
      if (btnConvertSvg) {
        btnConvertSvg.disabled = false;
      }
    } else {
      loginButton.textContent = 'Authenticate with Onshape';
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

// Initialize auth when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing auth");
  init();
  
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
});

// Export everything that might be needed
export { 
  init as initAuth, 
  isAuthenticated, 
  getToken, 
  getAuthToken,
  authenticate,
  logout
};