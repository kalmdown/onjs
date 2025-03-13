// src\auth\index.js
const AuthManager = require('./auth-manager');

/**
 * Create an authenticated client for Onshape API
 * @param {Object} options - Authentication options
 * @param {string} [options.baseUrl='https://cad.onshape.com/api/v6'] - The API base URL
 * @param {string} [options.accessKey] - The API access key
 * @param {string} [options.secretKey] - The API secret key
 * @param {string} [options.accessToken] - The OAuth access token
 * @param {string} [options.refreshToken] - The OAuth refresh token
 * @param {string} [options.clientId] - The OAuth client ID
 * @param {string} [options.clientSecret] - The OAuth client secret
 * @param {string} [options.redirectUri] - The OAuth redirect URI
 * @param {string} [options.defaultMethod] - The default authentication method ('apikey' or 'oauth')
 * @returns {AuthManager} Configured auth manager
 */
function createAuth(options = {}) {
  const authManager = new AuthManager(options);
  
  // Auto-select authentication method based on provided credentials
  if (!authManager.getMethod()) {
    if (options.accessKey && options.secretKey) {
      authManager.setMethod('apikey');
    } else if (options.accessToken) {
      authManager.setMethod('oauth');
    }
  }
  
  return authManager;
}

/**
 * Format OAuth scopes to Onshape's standard format
 * @param {string|Array|number} scopes - Scopes as string, array, or numeric bit value
 * @returns {Object} Formatted scope information
 */
function formatOAuthScopes(scopes) {
  const result = {
    formatted: '',
    interpretedScopes: [],
    has: {
      read: false,
      write: false,
      readPII: false,
      delete: false
    }
  };
  
  // Handle different scope formats
  if (Array.isArray(scopes)) {
    result.formatted = scopes.join(' ');
    result.interpretedScopes = scopes;
  } else if (typeof scopes === 'number') {
    // Handle numeric bit representation
    const scopeMap = {
      1: 'OAuth2ReadPII',
      2: 'OAuth2Write',
      4: 'OAuth2Read',
      8: 'OAuth2Delete'
    };
    
    result.interpretedScopes = Object.entries(scopeMap)
      .filter(([bit]) => (scopes & parseInt(bit)) !== 0)
      .map(([_, scopeName]) => scopeName);
      
    result.formatted = result.interpretedScopes.join(' ');
  } else if (typeof scopes === 'string') {
    result.formatted = scopes;
    result.interpretedScopes = scopes.split(' ').filter(Boolean);
  }
  
  // Check for common permissions
  result.has.readPII = result.interpretedScopes.some(s => s.includes('ReadPII'));
  result.has.read = result.interpretedScopes.some(s => s.includes('Read'));
  result.has.write = result.interpretedScopes.some(s => s.includes('Write'));
  result.has.delete = result.interpretedScopes.some(s => s.includes('Delete'));
  
  // If empty, set default scopes
  if (!result.formatted) {
    result.formatted = 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete';
    result.interpretedScopes = ['OAuth2ReadPII', 'OAuth2Read', 'OAuth2Write', 'OAuth2Delete'];
    result.has.readPII = true;
    result.has.read = true;
    result.has.write = true;
  }
  return result;
}

/**
 * Get common headers required for all Onshape API requests
 * @returns {Object} Common headers
 */
function getCommonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

module.exports = {
  createAuth,
  formatOAuthScopes,
  getCommonHeaders,
  AuthManager
};