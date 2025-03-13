/**
 * Test script specifically designed for free Onshape accounts
 * Focuses on using public document features that are more accessible
 */
// Load environment variables with absolute path
const path = require('path');
const childProcess = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const OnshapeAuth = require('../src/auth/onshape-auth');
const AuthManager = require('../src/auth/auth-manager');
const SimpleRestApi = require('../src/api/simple-rest-api');
const logger = require('../src/utils/logger');

// Set log level
logger.logLevel = 'debug';

/**
 * Clear the terminal in a cross-platform way
 */
function clearTerminal() {
  try {
    // For Windows
    if (process.platform === 'win32') {
      childProcess.execSync('cls', { stdio: 'inherit' });
    } 
    // For Unix-based systems (Linux, macOS)
    else {
      childProcess.execSync('clear', { stdio: 'inherit' });
    }
  } catch (error) {
    // If clearing fails, just print a separator line
    process.stdout.write('\n\n' + '='.repeat(80) + '\n\n');
  }
}

// Helper function to format the log output
function formatLog(testName, method, fullUrl, queryParams = null, payload = null) {
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  let log = `[${timestamp}] TEST: ${testName}\n`;
  log += `  ${method} ${fullUrl}\n`;
  if (queryParams) {
    log += `  QUERY PARAMS: ${JSON.stringify(queryParams, null, 2)}\n`;
  }
  if (payload) {
    log += `  PAYLOAD: ${JSON.stringify(payload, null, 2)}\n`;
  }
  log += '--------------------------------------------------------------------------------\n';
  return log;
}

// Helper function to analyze OAuth2 scope bitwise value
function analyzeOAuth2Scopes(scopeValue) {
  // Common OAuth2 scope bit values
  const scopeBits = {
    OAuth2Read: 1,        // 2^0 = 1
    OAuth2Write: 2,       // 2^1 = 2
    OAuth2Delete: 4,      // 2^2 = 4
    OAuth2ReadPII: 8      // 2^3 = 8
    // There are more scopes but these are the common ones
  };

  const results = {};
  for (const [scopeName, bitValue] of Object.entries(scopeBits)) {
    results[scopeName] = Boolean(scopeValue & bitValue);
  }
  return results;
}

describe('Free Onshape Account API Integration', () => {
  // Check for required credentials before tests
  let hasCredentials = true;
  let auth;
  let authType;
  let baseUrl = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v10';
  
  beforeAll(() => {
    // Clear terminal at the beginning of the test run
    clearTerminal();
    
    // Check credentials
    if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
      console.warn('⚠️ WARNING: Missing API credentials. Tests will be skipped.');
      hasCredentials = false;
      return;
    }
    
    // Parse authentication type from environment
    authType = process.env.ONSHAPE_AUTH_METHOD || 'api_key';
    
    if (!['api_key', 'oauth'].includes(authType.toLowerCase())) {
      console.warn('⚠️ WARNING: Invalid auth type. Tests will be skipped.');
      hasCredentials = false;
      return;
    }
    
    console.log(`Using authentication type: ${authType}`);
    
    // Initialize auth client
    if (authType.toLowerCase() === 'api_key') {
      auth = new OnshapeAuth({
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY,
        baseUrl: baseUrl
      });
    } else {
      auth = new OnshapeAuth({
        oauthToken: process.env.ONSHAPE_OAUTH_TOKEN,
        baseUrl: baseUrl
      });
    }
  });
  
  describe('Direct OnshapeAuth Tests', () => {
    test('should retrieve user session info', async () => {
      if (!hasCredentials) return;
      const path = `/users/sessioninfo`;
      const fullUrl = `${baseUrl}${path}`;
      const testName = 'should retrieve user session info';
      console.log(formatLog(testName, 'GET', fullUrl));
      try {
        const userInfo = await auth.get(path);
        console.log('✅ Success! User info retrieved');
        
        // Display relevant user information
        console.log('\n===== User Profile Information =====');
        console.log('User Name:', userInfo.name || 'Not provided');
        console.log('User ID:', userInfo.id || 'Not provided');
        console.log('User Type:', userInfo.type || 'Not provided');
        console.log('Email:', userInfo.email || 'Not provided');
        console.log('Plan Name:', userInfo.planGroup || userInfo.plan?.name || 'Not provided');
        
        // Display OAuth scopes
        console.log('\n===== OAuth Scopes =====');
        if (typeof userInfo.oauth2Scopes === 'number') {
          console.log('OAuth2 Scope Value (bitwise):', userInfo.oauth2Scopes);
          const scopeAnalysis = analyzeOAuth2Scopes(userInfo.oauth2Scopes);
          for (const [scope, enabled] of Object.entries(scopeAnalysis)) {
            console.log(`- ${scope}: ${enabled ? 'Enabled' : 'Disabled'}`);
          }
        } else if (Array.isArray(userInfo.oauth2Scopes) && userInfo.oauth2Scopes.length > 0) {
          userInfo.oauth2Scopes.forEach(scope => {
            console.log(`- ${scope}`);
          });
        } else {
          console.log('No OAuth scopes found or scope format is unexpected');
        }
        
        // Display roles if available
        if (userInfo.roles && userInfo.roles.length > 0) {
          console.log('\n===== User Roles =====');
          userInfo.roles.forEach(role => {
            console.log(`- ${role}`);
          });
        }
        
        // Display complete user object for debugging
        console.log('\n===== Complete User Object =====');
        console.log(JSON.stringify(userInfo, null, 2));
        
        expect(userInfo).toBeDefined();
      } catch (error) {
        console.error('❌ Error retrieving user info:', error.message);
        throw error;
      }
    });

    test('should check API permissions', async () => {
      if (!hasCredentials) return;
      const path = `/users/sessioninfo`;
      const fullUrl = `${baseUrl}${path}`;
      const testName = 'should check API permissions';
      console.log(formatLog(testName, 'GET', fullUrl));
      try {
        const userInfo = await auth.get(path);
        
        console.log('\n===== API Key Permissions Analysis =====');
        
        // Check if user has a name - might indicate a properly configured user account
        if (userInfo.name) {
          console.log('✅ API key is associated with a named user account:', userInfo.name);
        } else {
          console.log('⚠️ API key may not be associated with a fully configured user account');
        }
        
        // Check for document access permissions
        let hasReadAccess = false;
        let hasWriteAccess = false;
        
        if (typeof userInfo.oauth2Scopes === 'number') {
          const scopeAnalysis = analyzeOAuth2Scopes(userInfo.oauth2Scopes);
          hasReadAccess = scopeAnalysis.OAuth2Read;
          hasWriteAccess = scopeAnalysis.OAuth2Write;
          
          console.log('OAuth2 Scope Value:', userInfo.oauth2Scopes);
        } else if (Array.isArray(userInfo.oauth2Scopes) && userInfo.oauth2Scopes.length > 0) {
          hasReadAccess = userInfo.oauth2Scopes.some(scope => 
            scope.includes('OAuth2Read') || scope.includes('read'));
          hasWriteAccess = userInfo.oauth2Scopes.some(scope => 
            scope.includes('OAuth2Write') || scope.includes('write'));
        }
        
        console.log(`✅ Read access: ${hasReadAccess ? 'YES' : 'NO'}`);
        console.log(`✅ Write access: ${hasWriteAccess ? 'YES' : 'NO'}`);
        
        if (!hasReadAccess) {
          console.log('⚠️ This API key does not have document read permissions');
          console.log('   Add "OAuth2Read" scope to enable document access');
        }
        
        // Check user roles
        if (userInfo.roles && userInfo.roles.length > 0) {
          console.log('\n✅ User Roles:');
          userInfo.roles.forEach(role => {
            console.log(`   - ${role}`);
          });
          
          const isDeveloper = userInfo.roles.includes('DEVELOPER');
          console.log(`✅ Developer role: ${isDeveloper ? 'YES' : 'NO'}`);
        }
        
        // Check plan limitations
        if (userInfo.planGroup) {
          console.log(`✅ Account plan: ${userInfo.planGroup}`);
        } else if (userInfo.plan) {
          console.log(`✅ Account plan: ${userInfo.plan.name}`);
          console.log(`✅ Plan level: ${userInfo.plan.level || 'Not specified'}`);
        }
        
        // Check if this is an enterprise account
        if (userInfo.enterpriseInfo) {
          console.log('✅ This is an Enterprise account');
        } else {
          console.log('ℹ️ This is not an Enterprise account');
        }
        
        expect(userInfo).toBeDefined();
      } catch (error) {
        console.error('❌ Error checking API permissions:', error.message);
        throw error;
      }
    });
    
    test('should find my documents', async () => {
      if (!hasCredentials) return;
      const path = `/documents`;
      const queryParams = { filter: 0, ownerType: 1, sortColumn: 'createdAt', sortOrder: 'desc', offset: 0, limit: 20 };
      const fullUrl = `${baseUrl}${path}?${new URLSearchParams(queryParams).toString()}`;
      const testName = 'should find my documents';
      console.log(formatLog(testName, 'GET', fullUrl, queryParams));
      try {
        const publicDocs = await auth.get(path, queryParams);
        console.log(`✅ Success! Found ${publicDocs.items?.length || 0} documents`);
        
        // Display document info if found
        if (publicDocs.items && publicDocs.items.length > 0) {
          console.log('\n===== Document List =====');
          publicDocs.items.forEach((doc, index) => {
            console.log(`\nDocument ${index + 1}:`);
            console.log(`- Name: ${doc.name}`);
            console.log(`- ID: ${doc.id}`);
            console.log(`- Created: ${new Date(doc.createdAt).toLocaleString()}`);
            console.log(`- Modified: ${new Date(doc.modifiedAt).toLocaleString()}`);
          });
        } else {
          console.log('No documents found. This could be normal for a new account.');
        }
        
        expect(publicDocs).toBeDefined();
        expect(Array.isArray(publicDocs.items)).toBe(true);
      } catch (error) {
        console.error('❌ Error finding documents:', error.message);
        
        // Enhanced error handling
        if (error.response) {
          console.log(`Status code: ${error.response.status}`);
          
          if (error.response.status === 401) {
            console.log('⚠️ Permission issue detected: 401 Unauthorized');
            console.log('   This API key may not have document read permissions');
            console.log('   For an API key, check that it was created with OAuth2Read scope');
            console.log('   For OAuth tokens, check that the token has correct permissions');
            
            // Try to get session info to check scopes
            try {
              const userInfo = await auth.get('/users/sessioninfo');
              if (typeof userInfo.oauth2Scopes === 'number') {
                const scopeAnalysis = analyzeOAuth2Scopes(userInfo.oauth2Scopes);
                console.log('\nScope analysis:');
                for (const [scope, enabled] of Object.entries(scopeAnalysis)) {
                  console.log(`- ${scope}: ${enabled ? 'Enabled' : 'Disabled'}`);
                }
                
                if (!scopeAnalysis.OAuth2Read) {
                  console.log('\n⚠️ OAuth2Read scope is missing. This is required for document access.');
                }
              }
            } catch (sessionError) {
              console.log('Could not retrieve session info for scope analysis.');
            }
          }
        }
        
        throw error;
      }
    });
  });
  
  describe('SimpleRestApi Tests', () => {
    let api;
    
    beforeAll(() => {
      if (!hasCredentials) return;
      api = new SimpleRestApi({
        authType: authType,
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY,
        oauthToken: process.env.ONSHAPE_OAUTH_TOKEN,
        baseUrl: baseUrl
      });
    });
    
    test('should get user profile info', async () => {
      if (!hasCredentials) return;
      const path = `/users/sessioninfo`;
      const fullUrl = `${baseUrl}${path}`;
      const testName = 'should get user profile info';
      console.log(formatLog(testName, 'GET', fullUrl));
      try {
        const userInfo = await api.request('get', path);
        console.log('✅ Success! User profile info retrieved');
        console.log('User Name:', userInfo.name || 'Not provided');
        expect(userInfo).toBeDefined();
      } catch (error) {
        console.error('❌ Error getting user profile info:', error.message);
        throw error;
      }
    });
    
    test('should search for my documents', async () => {
      if (!hasCredentials) return;
      const path = `/documents`;
      const queryParams = { filter: 0, ownerType: 1, sortColumn: 'createdAt', sortOrder: 'desc', offset: 0, limit: 20 };
      const fullUrl = `${baseUrl}${path}?${new URLSearchParams(queryParams).toString()}`;
      const testName = 'should search for my documents';
      console.log(formatLog(testName, 'GET', fullUrl, queryParams));
      try {
        const searchResults = await api.request('get', path, queryParams);
        console.log(`✅ Success! Found ${searchResults.items?.length || 0} documents`);
        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults.items)).toBe(true);
      } catch (error) {
        console.error('❌ Error searching for documents:', error.message);
        throw error;
      }
    });
  });
});