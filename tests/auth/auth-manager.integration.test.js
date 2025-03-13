const { createAuth } = require('../../src/auth');
const AuthManager = require('../../src/auth/auth-manager');
require('dotenv').config();

// Don't mock axios for true integration tests

// Check for required credentials
const hasApiKeyCredentials = process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY;
const hasOAuthCredentials = process.env.ONSHAPE_ACCESS_TOKEN;
const baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';

describe('AuthManager Integration Tests', () => {
  // Set longer timeout for API calls
  jest.setTimeout(30000);
  
  beforeAll(() => {
    console.log('Integration test environment setup');
    console.log('Environment variables loaded successfully');
    console.log('ACCESS_KEY available:', Boolean(process.env.ONSHAPE_ACCESS_KEY));
    console.log('SECRET_KEY available:', Boolean(process.env.ONSHAPE_SECRET_KEY));
    console.log('OAUTH_TOKEN available:', Boolean(process.env.ONSHAPE_ACCESS_TOKEN));
  });

  // Only run if API key credentials are available
  (hasApiKeyCredentials ? describe : describe.skip)('API Key Authentication', () => {
    let authManager;
    
    beforeEach(() => {
      authManager = new AuthManager({
        baseUrl,
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY
      });
    });
    
    test('should authenticate with API key', async () => {
      // Set the authentication method
      const result = authManager.setMethod('apikey');
      expect(result).toBeTruthy();
      expect(authManager.getMethod()).toBe('apikey');
      
      // Get user info using real API call
      const userInfo = await authManager.request('GET', '/users/sessioninfo');
      
      // Verify response structure without asserting specific values
      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBeDefined();
      expect(userInfo.id).toBeDefined();
    });
    
    test('should generate valid auth headers', () => {
      // Set the authentication method
      authManager.setMethod('apikey');
      
      // Generate auth headers
      const headers = authManager.getAuthHeaders('GET', '/users/sessioninfo');
      
      // Verify header structure
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toContain('On ');
      expect(headers).toHaveProperty('Date');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });
  });
  
  // Only run if OAuth credentials are available
  (hasOAuthCredentials ? describe : describe.skip)('OAuth Authentication', () => {
    let authManager;
    
    beforeEach(() => {
      authManager = new AuthManager({
        baseUrl,
        accessToken: process.env.ONSHAPE_ACCESS_TOKEN,
        refreshToken: process.env.ONSHAPE_REFRESH_TOKEN,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET
      });
    });
    
    test('should authenticate with OAuth token', async () => {
      // Set the authentication method
      const result = authManager.setMethod('oauth');
      expect(result).toBeTruthy();
      expect(authManager.getMethod()).toBe('oauth');
      
      // Get user info using real API call
      const userInfo = await authManager.request('GET', '/users/sessioninfo');
      
      // Verify response structure without asserting specific values
      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBeDefined();
      expect(userInfo.id).toBeDefined();
    });
    
    test('should generate valid OAuth headers', () => {
      // Set the authentication method
      authManager.setMethod('oauth');
      
      // Generate auth headers
      const headers = authManager.getAuthHeaders('GET', '/users/sessioninfo');
      
      // Verify header structure
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toContain('Bearer ');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });
  });
  
  describe('Unified Auth Interface', () => {
    // Only run if API key credentials are available
    (hasApiKeyCredentials ? test : test.skip)('should create auth manager with API key via factory function', async () => {
      // Use createAuth factory function
      const auth = createAuth({
        baseUrl,
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY
      });
      
      // Verify it's properly configured
      expect(auth).toBeInstanceOf(AuthManager);
      expect(auth.getMethod()).toBe('apikey');
      
      // Make a real API call
      const userInfo = await auth.request('GET', '/users/sessioninfo');
      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBeDefined();
    });
    
    // Only run if OAuth credentials are available
    (hasOAuthCredentials ? test : test.skip)('should create auth manager with OAuth via factory function', async () => {
      // Use createAuth factory function
      const auth = createAuth({
        baseUrl,
        accessToken: process.env.ONSHAPE_ACCESS_TOKEN
      });
      
      // Verify it's properly configured
      expect(auth).toBeInstanceOf(AuthManager);
      expect(auth.getMethod()).toBe('oauth');
      
      // Make a real API call
      const userInfo = await auth.request('GET', '/users/sessioninfo');
      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    // Test error handling with invalid endpoint
    test('should handle 404 errors correctly', async () => {
      // Only run if API keys are available
      if (!hasApiKeyCredentials) {
        return;
      }
      
      const auth = createAuth({
        baseUrl,
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY
      });
      
      // Try accessing a non-existent endpoint
      await expect(auth.request('GET', '/non/existent/endpoint'))
        .rejects.toThrow();
    });
  });
});

// Keep the manual test section for running outside of Jest
// This will run all the manual tests without mocks
if (require.main === module) {
  const AuthManager = require('../../src/auth/auth-manager');
  
  /**
   * Test the AuthManager with API Key authentication
   */
  async function testApiKeyAuth() {
    console.log('\n---------- TEST 1: API KEY AUTHENTICATION ----------');
    
    if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
      console.log('Skipping API Key test - No API credentials available');
      return false;
    }
    
    // Initialize with API keys
    const authManager = new AuthManager({
      baseUrl,
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
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
   * Test error handling with a non-existent endpoint
   */
  async function testErrorHandling() {
    console.log('\n---------- TEST 3: ERROR HANDLING ----------');
    
    if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
      console.log('Skipping Error Handling test - No API credentials available');
      return false;
    }
    
    // Use real credentials but an invalid endpoint
    const authManager = new AuthManager({
      baseUrl,
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    });
    
    try {
      authManager.setMethod('apikey');
      
      // Try to access a non-existent endpoint to trigger a 404 error
      console.log('Making API request to a non-existent endpoint...');
      await authManager.request('GET', '/non/existent/endpoint');
      
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
    
    if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
      console.log('Skipping OAuth client creation test - No OAuth client credentials available');
      return false;
    }
    
    try {
      // Initialize auth manager with real credentials
      const authManager = new AuthManager({
        baseUrl,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET
      });
      
      // Create OAuth client
      const redirectUri = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/oauthRedirect';
      const scope = process.env.ONSHAPE_OAUTH_SCOPE || 'OAuth2ReadPII OAuth2Read OAuth2Write';
      
      console.log('Creating OAuth client with:');
      console.log('- Redirect URI:', redirectUri);
      console.log('- Scope:', scope);
      
      const oauthClient = authManager.createOAuthClient({
        redirectUri: redirectUri,
        scope: scope
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
  
  (async () => {
    await runTests();
  })();
}