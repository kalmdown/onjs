const AuthManager = require('../../src/auth/auth-manager');
const { OnshapeApiError } = require('../../src/utils/errors');
const axios = require('axios');
require('dotenv').config();

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn()
}));

// Mock OAuthClient correctly at the module level
jest.mock('../../src/auth/oauth-client', () => {
  return jest.fn().mockImplementation(() => ({
    getAuthorizationUrl: jest.fn(() => 'https://oauth.onshape.com/oauth/authorize?mock=true')
  }));
});

// Get credentials from environment variables
const accessKey = process.env.ONSHAPE_ACCESS_KEY;
const secretKey = process.env.ONSHAPE_SECRET_KEY;
const baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';

// Optional OAuth credentials
const accessToken = process.env.ONSHAPE_ACCESS_TOKEN;
const refreshToken = process.env.ONSHAPE_REFRESH_TOKEN;
const clientId = process.env.ONSHAPE_CLIENT_ID;
const clientSecret = process.env.ONSHAPE_CLIENT_SECRET;

console.log('=============================================');
console.log('AUTH MANAGER TEST');
console.log('=============================================');

/**
 * Test the AuthManager with API Key authentication
 */
async function testApiKeyAuth() {
  console.log('\n---------- TEST 1: API KEY AUTHENTICATION ----------');
  
  // Initialize with API keys
  const authManager = new AuthManager({
    baseUrl,
    accessKey,
    secretKey
  });
  
  try {
    // Test setting method
    const methodSet = authManager.setMethod('apikey');
    console.log('Method set successfully:', methodSet);
    console.log('Current method:', authManager.getMethod());
    
    // Test API request
    console.log('Making API request to /users/sessioninfo...');
    const userInfo = await authManager.request('GET', '/users/sessioninfo');
    
    console.log('Request successful!');
    console.log('User name:', userInfo.name);
    console.log('Account type:', userInfo.plan);
    
    // Display OAuth scopes if available
    if (userInfo.oauth2Scopes) {
      console.log('OAuth scopes:', Array.isArray(userInfo.oauth2Scopes) ? 
        userInfo.oauth2Scopes.join(' ') : userInfo.oauth2Scopes);
    }
    
    return true;
  } catch (error) {
    console.error('API Key Authentication Test Failed:', error.message);
    return false;
  }
}

/**
 * Test the AuthManager with OAuth authentication
 */
async function testOAuthAuth() {
  console.log('\n---------- TEST 2: OAUTH AUTHENTICATION ----------');
  
  if (!accessToken) {
    console.log('Skipping OAuth test - No access token available');
    return false;
  }
  
  // Initialize with OAuth credentials
  const authManager = new AuthManager({
    baseUrl,
    accessToken,
    refreshToken,
    clientId,
    clientSecret
  });
  
  try {
    // Test setting method
    const methodSet = authManager.setMethod('oauth');
    console.log('Method set successfully:', methodSet);
    console.log('Current method:', authManager.getMethod());
    
    // Test API request
    console.log('Making API request to /users/sessioninfo...');
    const userInfo = await authManager.request('GET', '/users/sessioninfo');
    
    console.log('Request successful!');
    console.log('User name:', userInfo.name);
    console.log('Account type:', userInfo.plan);
    
    return true;
  } catch (error) {
    console.error('OAuth Authentication Test Failed:', error.message);
    return false;
  }
}

/**
 * Test the AuthManager's error handling
 */
async function testErrorHandling() {
  console.log('\n---------- TEST 3: ERROR HANDLING ----------');
  
  try {
    // Test with invalid credentials
    const invalidAuthManager = new AuthManager({
      baseUrl,
      accessKey: 'invalid',
      secretKey: 'invalid'
    });
    
    invalidAuthManager.setMethod('apikey');
    
    console.log('Making API request with invalid credentials...');
    await invalidAuthManager.request('GET', '/users/sessioninfo');
    
    console.error('Expected error was not thrown!');
    return false;
  } catch (error) {
    console.log('Expected error caught correctly:', error.message);
    return true;
  }
}

/**
 * Test the AuthManager's OAuth client creation
 */
function testOAuthClientCreation() {
  console.log('\n---------- TEST 4: OAUTH CLIENT CREATION ----------');
  
  if (!clientId || !clientSecret) {
    console.log('Skipping OAuth client creation test - No client credentials available');
    return false;
  }
  
  try {
    // Initialize auth manager
    const authManager = new AuthManager({
      baseUrl,
      clientId,
      clientSecret
    });
    
    // Create OAuth client
    const oauthClient = authManager.createOAuthClient({
      redirectUri: 'http://localhost:3000/callback',
      scope: 'OAuth2ReadPII OAuth2Read OAuth2Write'
    });
    
    console.log('OAuth client created successfully');
    console.log('Authorization URL:', oauthClient.getAuthorizationUrl());
    
    return true;
  } catch (error) {
    console.error('OAuth Client Creation Test Failed:', error.message);
    return false;
  }
}

/**
 * Run all tests and display summary
 */
async function runTests() {
  console.log('Running tests...');
  
  const results = {
    apiKeyAuth: await testApiKeyAuth(),
    oauthAuth: await testOAuthAuth(),
    errorHandling: await testErrorHandling(),
    oauthClientCreation: testOAuthClientCreation()
  };
  
  console.log('\n=============================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('=============================================');
  console.log('API Key Authentication:', results.apiKeyAuth ? '✅ PASS' : '❌ FAIL');
  console.log('OAuth Authentication:', results.oauthAuth ? '✅ PASS' : '❌ FAIL');
  console.log('Error Handling:', results.errorHandling ? '✅ PASS' : '❌ FAIL');
  console.log('OAuth Client Creation:', results.oauthClientCreation ? '✅ PASS' : '❌ FAIL');
  
  const passCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\nOverall: ${passCount}/${totalCount} tests passed`);
}

// Run the tests
runTests().catch(error => {
  console.error('Unexpected error during tests:', error);
  process.exit(1);
});

describe('AuthManager', () => {
  let baseUrl;
  
  beforeEach(() => {
    jest.clearAllMocks();
    baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const authManager = new AuthManager();
      expect(authManager.baseUrl).toBe('https://cad.onshape.com/api/v6');
      expect(authManager.currentMethod).toBeNull();
    });

    test('should initialize with provided options', () => {
      const authManager = new AuthManager({
        baseUrl: 'https://custom.onshape.com/api',
        accessKey: 'test-key',
        secretKey: 'test-secret',
        defaultMethod: 'apikey'
      });
      
      expect(authManager.baseUrl).toBe('https://custom.onshape.com/api');
      expect(authManager.accessKey).toBe('test-key');
      expect(authManager.secretKey).toBe('test-secret');
      expect(authManager.currentMethod).toBe('apikey');
    });
  });

  describe('setMethod', () => {
    test('should set apikey method when credentials are available', () => {
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret'
      });
      
      expect(authManager.setMethod('apikey')).toBe(true);
      expect(authManager.currentMethod).toBe('apikey');
    });

    test('should set oauth method when token is available', () => {
      const authManager = new AuthManager({
        accessToken: 'test-token'
      });
      
      expect(authManager.setMethod('oauth')).toBe(true);
      expect(authManager.currentMethod).toBe('oauth');
    });

    test('should return false for apikey method without credentials', () => {
      const authManager = new AuthManager();
      
      expect(authManager.setMethod('apikey')).toBe(false);
      expect(authManager.currentMethod).toBeNull();
    });

    test('should return false for oauth method without token', () => {
      const authManager = new AuthManager();
      
      expect(authManager.setMethod('oauth')).toBe(false);
      expect(authManager.currentMethod).toBeNull();
    });

    test('should return false for unknown method', () => {
      const authManager = new AuthManager();
      
      expect(authManager.setMethod('unknown')).toBe(false);
      expect(authManager.currentMethod).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    test('should throw error when no method is selected', () => {
      const authManager = new AuthManager();
      
      expect(() => authManager.getAuthHeaders('GET', '/path')).toThrow(OnshapeApiError);
    });

    test('should generate Basic Auth headers for apikey method', () => {
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret',
        defaultMethod: 'apikey'
      });
      
      const headers = authManager.getAuthHeaders('GET', '/path');
      
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Basic /);
      expect(headers['Content-Type']).toBe('application/json');
    });

    test('should generate Bearer token headers for oauth method', () => {
      const authManager = new AuthManager({
        accessToken: 'test-token',
        defaultMethod: 'oauth'
      });
      
      const headers = authManager.getAuthHeaders('GET', '/path');
      
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe('Bearer test-token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('request', () => {
    test('should make successful API request', async () => {
      // Mock successful response
      axios.mockResolvedValueOnce({
        status: 200,
        data: { name: 'Test User' }
      });
      
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret',
        defaultMethod: 'apikey'
      });
      
      const result = await authManager.request('GET', '/users/sessioninfo');
      
      expect(result).toEqual({ name: 'Test User' });
      expect(axios).toHaveBeenCalledTimes(1);
    });

    test('should handle authentication errors', async () => {
      // Mock 401 error
      axios.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });
      
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret',
        defaultMethod: 'apikey'
      });
      
      await expect(authManager.request('GET', '/users/sessioninfo'))
        .rejects.toThrow('Authentication failed');
    });

    test('should attempt to refresh token on 401 with OAuth', async () => {
      // Mock 401 error followed by successful refresh and successful retry
      axios.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Token expired' }
        }
      });
      
      // Mock successful token refresh
      axios.mockResolvedValueOnce({
        status: 200,
        data: { 
          access_token: 'new-test-token',
          refresh_token: 'new-refresh-token'
        }
      });
      
      // Mock successful retry with new token
      axios.mockResolvedValueOnce({
        status: 200,
        data: { name: 'Test User' }
      });
      
      const authManager = new AuthManager({
        accessToken: 'old-test-token',
        refreshToken: 'old-refresh-token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        defaultMethod: 'oauth'
      });
      
      const result = await authManager.request('GET', '/users/sessioninfo');
      
      expect(result).toEqual({ name: 'Test User' });
      expect(axios).toHaveBeenCalledTimes(3);
      expect(authManager.accessToken).toBe('new-test-token');
      expect(authManager.refreshToken).toBe('new-refresh-token');
    });
  });
  
  describe('createOAuthClient', () => {
    test('should create OAuth client with provided options', () => {
      const OAuthClient = require('../../src/auth/oauth-client');
      
      const authManager = new AuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback'
      });
      
      const oauthClient = authManager.createOAuthClient({
        scope: 'OAuth2ReadPII OAuth2Read OAuth2Write'
      });
      
      expect(oauthClient).toBeDefined();
      expect(OAuthClient).toHaveBeenCalledWith({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
        scope: 'OAuth2ReadPII OAuth2Read OAuth2Write'
      });
    });
    
    test('should throw error when missing required OAuth parameters', () => {
      const authManager = new AuthManager();
      
      expect(() => authManager.createOAuthClient({
        scope: 'OAuth2ReadPII OAuth2Read OAuth2Write'
      })).toThrow(OnshapeApiError);
    });
  });
});