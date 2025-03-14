// public/js/auth.js
// Store token values
let _authToken = null;
let _refreshToken = null;
let _isAuthenticated = false;

/**
 * Initialize authentication
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
 */
function isAuthenticated() {
  return _isAuthenticated;
}

/**
 * Get authentication token
 */
function getToken() {
  return _authToken;
}

/**
 * Alternative name for getToken for backward compatibility
 */
function getAuthToken() {
  return _authToken;
}

/**
 * Direct access to the token (for backward compatibility)
 */
const authToken = _authToken;

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
  window.location = '/oauth/logout';
}

/**
 * Update UI based on authentication state
 */
function updateAuthUI(isAuthenticated) {
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const userPanel = document.getElementById('user-panel');
  
  if (loginButton && logoutButton && userPanel) {
    if (isAuthenticated) {
      loginButton.style.display = 'none';
      logoutButton.style.display = 'inline-block';
      userPanel.style.display = 'block';
      
      // Check auth status for more info
      fetch('/api/auth/status')
        .then(response => response.json())
        .then(data => {
          console.log("Auth status:", data);
          if (data.method) {
            const methodDisplay = document.getElementById('auth-method');
            if (methodDisplay) {
              methodDisplay.textContent = data.method;
            }
          }
        })
        .catch(error => console.error("Error fetching auth status:", error));
    } else {
      loginButton.style.display = 'inline-block';
      logoutButton.style.display = 'none';
      userPanel.style.display = 'none';
    }
  }
}

/**
 * Show authentication error
 */
function showAuthError(error) {
  const errorContainer = document.getElementById('auth-error');
  if (errorContainer) {
    errorContainer.style.display = 'block';
    errorContainer.textContent = `Authentication failed: ${error}`;
  }
}

// Initialize auth when the page loads
document.addEventListener('DOMContentLoaded', function() {
  init();
  
  // Set up logout button handler
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // Set up login button handler
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', function(e) {
      e.preventDefault();
      window.location = '/oauth/login';
    });
  }
});

// Export everything that might be needed
export { 
  init, 
  isAuthenticated, 
  getToken, 
  getAuthToken,
  authenticate,
  logout,
  authToken      // This needs to be updated to a function
};

// For scripts that need direct access to the token
export function getCurrentToken() {
  return _authToken;
}