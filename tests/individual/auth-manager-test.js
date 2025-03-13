const AuthManager = require('../../src/auth/auth-manager');
const { OnshapeApiError } = require('../../src/utils/errors');
require('dotenv').config();

// Get API key authentication credentials
const accessKey = process.env.ONSHAPE_ACCESS_KEY;
const secretKey = process.env.ONSHAPE_SECRET_KEY;
const baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';

// Get OAuth authentication credentials
const accessToken = process.env.ONSHAPE_ACCESS_TOKEN;
const refreshToken = process.env.ONSHAPE_REFRESH_TOKEN;
const oauthClientId = process.env.OAUTH_CLIENT_ID;
const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;

// Debug environment variables
console.log('=============================================');
console.log('ENVIRONMENT VARIABLES');
console.log('=============================================');
console.log('API URL:', baseUrl);
console.log('API Key Authentication:');
console.log('- Access Key available:', Boolean(accessKey));
console.log('- Secret Key available:', Boolean(secretKey));
console.log('OAuth Authentication:');
console.log('- Access Token available:', Boolean(accessToken));
console.log('- OAuth Client ID available:', Boolean(oauthClientId));
console.log('- OAuth Client Secret available:', Boolean(oauthClientSecret));

console.log('\n=============================================');
console.log('AUTH MANAGER TEST');
console.log('=============================================');

/**
 * Test the AuthManager with API Key authentication
 */
async function testApiKeyAuth() {
  console.log('\n---------- TEST 1: API KEY AUTHENTICATION ----------');
  
  if (!accessKey || !secretKey) {
    console.log('Skipping API Key test - No API credentials available');
    return false;
  }
  
  // Initialize with API keys and use correct API URL from .env
  const authManager = new AuthManager({
    baseUrl: baseUrl,
    accessKey: accessKey,
    secretKey: secretKey
  });
  
  try {
    // Test setting method
    const methodSet = authManager.setMethod('apikey');
    console.log('Method set successfully:', methodSet);
    console.log('Current method:', authManager.getMethod());
    
    // Test API request - ensure the path starts with '/'
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
    console.error('Error details:', error);
    return false;
  }
}

/**
 * Test the AuthManager with OAuth authentication
 */
async function testOAuthAuth() {
  console.log('\n---------- TEST 2: OAUTH AUTHENTICATION ----------');
  
  if (!accessToken || !oauthClientId || !oauthClientSecret) {
    console.log('Skipping OAuth test - No OAuth credentials available');
    return false;
  }
  
  // Initialize with OAuth credentials
  const authManager = new AuthManager({
    baseUrl: baseUrl,
    accessToken: accessToken,
    refreshToken: refreshToken,
    clientId: oauthClientId,
    clientSecret: oauthClientSecret
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
    console.error('Error details:', error);
    return false;
  }
}

/**
 * Test the AuthManager's error handling with a non-existent endpoint
 */
async function testErrorHandling() {
  console.log('\n---------- TEST 3: ERROR HANDLING ----------');
  
  if (!accessKey || !secretKey) {
    console.log('Skipping Error Handling test - No API credentials available');
    return false;
  }
  
  try {
    // Use real credentials but an invalid endpoint to test error handling
    const authManager = new AuthManager({
      baseUrl: baseUrl,
      accessKey: accessKey,
      secretKey: secretKey
    });
    
    authManager.setMethod('apikey');
    
    // Try to access a non-existent endpoint to trigger a 404 error
    console.log('Making API request to a non-existent endpoint...');
    await authManager.request('GET', '/non/existent/endpoint');
    
    console.error('Expected error was not thrown!');
    return false;
  } catch (error) {
    // This error is expected since we're accessing a non-existent endpoint
    console.log('Expected error caught correctly:', error.message);
    return true;
  }
}

/**
 * Test the AuthManager's OAuth client creation
 */
function testOAuthClientCreation() {
  console.log('\n---------- TEST 4: OAUTH CLIENT CREATION ----------');
  
  if (!oauthClientId || !oauthClientSecret) {
    console.log('Skipping OAuth client creation test - No OAuth client credentials available');
    return false;
  }
  
  try {
    // Initialize auth manager with OAuth credentials
    const authManager = new AuthManager({
      baseUrl: baseUrl,
      clientId: oauthClientId,
      clientSecret: oauthClientSecret
    });
    
    // Create OAuth client
    const redirectUri = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/oauthRedirect';
    const scope = process.env.ONSHAPE_OAUTH_SCOPE || 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete';
    
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
    console.error('Error details:', error);
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

// Run the tests when directly executed
if (require.main === module) {
  runTests().catch(error => {
    console.error('Unexpected error during tests:', error);
    process.exit(1);
  });
}

// Export for potential reuse
module.exports = {
  testApiKeyAuth,
  testOAuthAuth,
  testErrorHandling,
  testOAuthClientCreation,
  runTests
};