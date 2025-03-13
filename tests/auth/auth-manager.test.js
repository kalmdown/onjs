const AuthManager = require('../../src/auth/auth-manager');
const { createAuth } = require('../../src/auth'); // Add this line
const { OnshapeApiError } = require('../../src/utils/errors');
const axios = require('axios');
require('dotenv').config();


// Get credentials from environment
const accessKey = process.env.ONSHAPE_ACCESS_KEY;
const secretKey = process.env.ONSHAPE_SECRET_KEY;
const baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';

// Setup mock responses before tests
beforeAll(() => {
  // Setup successful mock response for API Key auth test
  axios.mockImplementation((config) => {
    if (config.url.includes('/users/sessioninfo') && 
        config.headers.Authorization && 
        config.headers.Authorization.startsWith('Basic')) {
      return Promise.resolve({
        status: 200,
        data: {
          name: 'Test User',
          plan: 'Free',
          oauth2Scopes: 'OAuth2Read OAuth2Write'
        }
      });
    }
    
    // Return error for invalid credentials
    if (config.url.includes('/users/sessioninfo') && 
        config.headers.Authorization && 
        config.headers.Authorization.includes('invalid')) {
      return Promise.reject({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });
    }
    
    // Default response for other calls
    return Promise.resolve({
      status: 200,
      data: {}
    });
  });
});

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
    
    // Mock the successful response for this specific call
    axios.mockImplementationOnce(() => {
      return Promise.resolve({
        status: 200,
        data: {
          name: 'Test User',
          plan: 'Free'
        }
      });
    });
    
    const userInfo = await authManager.request('GET', '/users/sessioninfo');
    
    console.log('Request successful!');
    console.log('User name:', userInfo.name);
    console.log('Account type:', userInfo.plan);
    
    return true;
  } catch (error) {
    console.error('API Key Authentication Test Failed:', error.message);
    return false;
  }
}

/**
 * Test OAuth authentication
 */
async function testOAuthAuth() {
  console.log('\n---------- TEST 2: OAUTH AUTHENTICATION ----------');
  
  // Skip test if no OAuth token available
  if (!process.env.ONSHAPE_ACCESS_TOKEN) {
    console.log('Skipping OAuth test - No OAuth token available');
    return false;
  }
  
  // Initialize with OAuth token
  const authManager = new AuthManager({
    baseUrl,
    accessToken: process.env.ONSHAPE_ACCESS_TOKEN,
    refreshToken: process.env.ONSHAPE_REFRESH_TOKEN,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET
  });
  
  try {
    // Test setting method
    const methodSet = authManager.setMethod('oauth');
    console.log('Method set successfully:', methodSet);
    console.log('Current method:', authManager.getMethod());
    
    // Mock the successful response for this specific call
    axios.mockImplementationOnce(() => {
      return Promise.resolve({
        status: 200,
        data: {
          name: 'Test OAuth User',
          plan: 'Free'
        }
      });
    });
    
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
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n---------- TEST 3: ERROR HANDLING ----------');
  
  // Initialize with API keys
  const authManager = new AuthManager({
    baseUrl,
    accessKey: 'invalid-key',
    secretKey: 'invalid-secret'
  });
  
  try {
    // Set method
    authManager.setMethod('apikey');
    
    // Mock error response
    axios.mockImplementationOnce(() => {
      return Promise.reject({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });
    });
    
    // Test API request that should fail
    console.log('Making API request with invalid credentials...');
    await authManager.request('GET', '/users/sessioninfo');
    
    console.error('Error handling failed - request should have thrown an error!');
    return false;
  } catch (error) {
    console.log('Successfully caught error:', error.message);
    return true;
  }
}

/**
 * Test OAuth client creation
 */
function testOAuthClientCreation() {
  console.log('\n---------- TEST 4: OAUTH CLIENT CREATION ----------');
  
  try {
    const authManager = new AuthManager({
      baseUrl,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    });
    
    const oauthClient = authManager.createOAuthClient({
      redirectUri: 'http://localhost:3000/oauth/callback',
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

// Rest of the test functions remain the same

// Proper Jest test blocks
describe('AuthManager', () => {
  let baseUrl;
  
  beforeEach(() => {
    jest.clearAllMocks();
    baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';
    
    // Setup default mock responses for each test
    axios.mockImplementation((config) => {
      // Default successful response
      return Promise.resolve({
        status: 200,
        data: { success: true }
      });
    });
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
    test('should set API key authentication method', () => {
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret'
      });
      
      const result = authManager.setMethod('apikey');
      
      expect(result).toBeTruthy();
      expect(authManager.currentMethod).toBe('apikey');
    });
    
    test('should set OAuth authentication method', () => {
      const authManager = new AuthManager({
        accessToken: 'test-token'
      });
      
      const result = authManager.setMethod('oauth');
      
      expect(result).toBeTruthy();
      expect(authManager.currentMethod).toBe('oauth');
    });
    
    test('should fail with invalid authentication method', () => {
      const authManager = new AuthManager();
      
      const result = authManager.setMethod('invalid');
      
      expect(result).toBeFalsy();
      expect(authManager.currentMethod).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    test('should return API key headers', () => {
      const authManager = new AuthManager({
        accessKey: 'test-key',
        secretKey: 'test-secret',
        defaultMethod: 'apikey'
      });
      
      const headers = authManager.getAuthHeaders('GET', '/users/sessioninfo');
      
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toContain('Basic');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });
    
    test('should return OAuth headers', () => {
      const authManager = new AuthManager({
        accessToken: 'test-token',
        defaultMethod: 'oauth'
      });
      
      const headers = authManager.getAuthHeaders('GET', '/users/sessioninfo');
      
      expect(headers).toHaveProperty('Authorization', 'Bearer test-token');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });
    
    test('should throw error if no method selected', () => {
      const authManager = new AuthManager();
      
      expect(() => {
        authManager.getAuthHeaders('GET', '/users/sessioninfo');
      }).toThrow('No authentication method selected');
    });
  });

  describe('request', () => {
    test('should make successful API request', async () => {
      // Mock successful response for this test
      axios.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: { name: 'Test User' }
        });
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
      axios.mockImplementationOnce(() => {
        return Promise.reject({
          response: {
            status: 401,
            data: { message: 'Unauthorized' }
          }
        });
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
      // Mock 401 error for the first call
      axios.mockImplementationOnce(() => {
        return Promise.reject({
          response: {
            status: 401,
            data: { message: 'Token expired' }
          }
        });
      });
      
      // Mock successful token refresh
      axios.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: { 
            access_token: 'new-test-token',
            refresh_token: 'new-refresh-token'
          }
        });
      });
      
      // Mock successful retry with new token
      axios.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: { name: 'Test User' }
        });
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
  
  // Rest of the test blocks remain the same
});

// For manually running the tests
if (require.main === module) {
  (async () => {
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
  })();
}

describe('AuthManager Integration', () => {
  describe('createAuth', () => {
    test('should create AuthManager with API key authentication', () => {
      const auth = createAuth({
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY
      });
      
      expect(auth).toBeInstanceOf(AuthManager);
      expect(auth.getMethod()).toBe('apikey');
    });
    
    test('should create AuthManager with OAuth authentication', () => {
      // Skip test if no access token available
      if (!process.env.ONSHAPE_ACCESS_TOKEN) {
        return;
      }
      
      const auth = createAuth({
        accessToken: process.env.ONSHAPE_ACCESS_TOKEN
      });
      
      expect(auth).toBeInstanceOf(AuthManager);
      expect(auth.getMethod()).toBe('oauth');
    });
  });
  
  // Keep other existing tests
});