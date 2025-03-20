/**
 * Onshape Client Authentication Test
 * 
 * This test compares direct axios authentication with OnshapeClient authentication
 * to identify why the client might be failing when direct requests succeed.
 */

// Load environment variables from project root
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const axios = require('axios');

// Setup environment
const projectRoot = path.resolve(__dirname, '../../');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
  
  if (process.env.ONSHAPE_AUTH_METHOD && process.env.ONSHAPE_AUTH_METHOD.toLowerCase() === 'apikey') {
    process.env.ONSHAPE_AUTH_METHOD = 'API_KEY';
  }
} else {
  console.error(`Cannot find .env file at: ${envPath}`);
}

// Override environment loader to prevent errors
const envLoaderPath = require.resolve('../../src/utils/load-env');
if (require.cache[envLoaderPath]) {
  require.cache[envLoaderPath].exports.initialized = true;
  require.cache[envLoaderPath].exports.loadEnv = () => true;
  require.cache[envLoaderPath].exports.validateEnv = () => ({ isValid: true, errors: [] });
} else {
  require.cache[envLoaderPath] = {
    id: envLoaderPath,
    filename: envLoaderPath,
    loaded: true,
    exports: {
      loadEnv: () => true,
      validateEnv: () => ({ isValid: true, errors: [] }),
      initialized: true
    }
  };
}

// Import required modules
const AuthManager = require('../../src/auth/auth-manager');
const OnshapeClient = require('../../src/api/client');
const logger = require('../../src/utils/logger').scope('auth-test');
const { inspect } = require('util');

// Document information
const documentId = process.env.ONSHAPE_TEST_DOCUMENT_ID || 'cb1e9acdd17540e4f4a4d45b';
const workspaceId = process.env.ONSHAPE_TEST_WORKSPACE_ID || '425a72a0620d341664869beb';
const elementId = 'e3e5ef7c62cd21704be0c100';

// Test configuration
const endpoints = [
  {
    name: 'Document Info',
    path: `/api/v10/documents/d/${documentId}`,
    queryParams: {}
  },
  {
    name: 'Features', 
    path: `/api/v10/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
    queryParams: {
      rollbackBarIndex: -1,
      includeGeometryIds: true,
      noSketchGeometry: false
    }
  }
];

/**
 * Create direct authentication headers the way they appear in the working curl command
 */
function createDirectAuthHeaders() {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;
  
  if (!accessKey || !secretKey) {
    throw new Error('API key credentials not found in environment variables');
  }
  
  const authStr = `${accessKey}:${secretKey}`;
  const base64Auth = Buffer.from(authStr).toString('base64');
  
  return {
    'accept': 'application/json;charset=UTF-8; qs=0.09',
    'Authorization': `Basic ${base64Auth}`
  };
}

/**
 * Make a direct API call using axios with the known working approach
 */
async function makeDirectApiCall(endpoint) {
  try {
    logger.info(`[Direct] Testing endpoint: ${endpoint.name}`);
    
    // Create headers using the approach from the working test
    const headers = createDirectAuthHeaders();
    
    // Build query string
    const queryString = Object.entries(endpoint.queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    // Build full URL
    const fullPath = endpoint.path + (queryString ? `?${queryString}` : '');
    const fullUrl = `https://cad.onshape.com${fullPath}`;
    
    logger.info(`[Direct] Full URL: ${fullUrl}`);
    logger.info(`[Direct] Headers: ${inspect({
      accept: headers.accept,
      Authorization: 'Basic ***' // Mask for security
    })}`);
    
    // Make the request
    const response = await axios.get(fullUrl, { headers });
    
    logger.info(`[Direct] Success! Status: ${response.status}`);
    return {
      success: true,
      status: response.status,
      dataSize: JSON.stringify(response.data).length,
      method: 'direct'
    };
  } catch (error) {
    logger.error(`[Direct] Failed: ${error.message}`);
    if (error.response) {
      logger.error(`[Direct] Status: ${error.response.status}`);
      logger.error(`[Direct] Response data: ${JSON.stringify(error.response.data || {})}`);
    }
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      method: 'direct'
    };
  }
}

/**
 * Make an API call using OnshapeClient
 */
async function makeClientApiCall(endpoint, config = {}) {
  const testName = config.testName || 'Default';
  
  try {
    logger.info(`[Client-${testName}] Testing endpoint: ${endpoint.name}`);
    
    // Create the client with optional configurations
    const baseUrl = config.baseUrl || 'https://cad.onshape.com';
    logger.info(`[Client-${testName}] Using baseUrl: ${baseUrl}`);
    
    const authManager = new AuthManager({
      baseUrl: baseUrl
    });
    
    // Debug auth manager configuration
    logger.info(`[Client-${testName}] Auth method: ${authManager.getMethod()}`);
    
    const client = new OnshapeClient({
      baseUrl: baseUrl,
      authManager: authManager,
      debug: true // Enable debug logging
    });
    
    // Check if we should modify the path
    let path = endpoint.path;
    if (config.removeApiPrefix && path.startsWith('/api/')) {
      path = path.substring(5); // Remove '/api/' prefix
      logger.info(`[Client-${testName}] Modified path: ${path}`);
    }
    
    // Build the request options
    const options = {
      params: endpoint.queryParams
    };
    
    // Add custom headers if specified
    if (config.useCustomHeaders) {
      const directHeaders = createDirectAuthHeaders();
      options.headers = {
        'accept': directHeaders.accept
      };
      logger.info(`[Client-${testName}] Using custom headers: ${inspect(options.headers)}`);
    }
    
    logger.info(`[Client-${testName}] Path: ${path}`);
    logger.info(`[Client-${testName}] Query params: ${inspect(options.params)}`);
    
    // Make the request
    const response = await client.get(path, options);
    
    logger.info(`[Client-${testName}] Success! Status: ${response?.status || 'unknown'}`);
    return {
      success: true,
      status: response?.status,
      dataSize: JSON.stringify(response).length,
      method: `client-${testName}`
    };
  } catch (error) {
    logger.error(`[Client-${testName}] Failed: ${error.message}`);
    
    // Add detailed error information
    if (error.response) {
      logger.error(`[Client-${testName}] Status: ${error.response.status}`);
      logger.error(`[Client-${testName}] Response data: ${JSON.stringify(error.response.data || {})}`);
      
      // Log the request headers for debugging
      if (error.config && error.config.headers) {
        logger.error(`[Client-${testName}] Request headers: ${JSON.stringify({
          ...error.config.headers,
          Authorization: error.config.headers.Authorization ? 'Basic ***' : undefined
        })}`);
      }
    }
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      method: `client-${testName}`
    };
  }
}

/**
 * Add more detailed diagnostic logging to pinpoint exact differences between
 * direct auth headers and those generated by AuthManager
 */
function inspectHeaderDifferences() {
  try {
    // Create direct headers (known to work)
    const directHeaders = createDirectAuthHeaders();
    
    // Get headers from auth manager
    const authManager = new AuthManager({ baseUrl: 'https://cad.onshape.com' });
    
    // Get auth headers synchronously (not returning a Promise)
    const authManagerHeaders = authManager.getAuthHeaders();
    
    logger.info('=== HEADER COMPARISON ===');
    logger.info('Direct headers (working):');
    Object.keys(directHeaders).forEach(key => {
      const value = key.toLowerCase() === 'authorization' 
        ? directHeaders[key].split(' ')[0] + ' ***' 
        : directHeaders[key];
      logger.info(`  ${key}: ${value}`);
    });
    
    logger.info('Auth manager headers:');
    Object.keys(authManagerHeaders).forEach(key => {
      const value = key.toLowerCase() === 'authorization' 
        ? authManagerHeaders[key].split(' ')[0] + ' ***' 
        : authManagerHeaders[key];
      logger.info(`  ${key}: ${value}`);
    });
    
    // Compare the Authorization headers more deeply
    if (directHeaders.Authorization && authManagerHeaders.Authorization) {
      const directAuth = directHeaders.Authorization;
      const managerAuth = authManagerHeaders.Authorization;
      
      if (directAuth !== managerAuth) {
        logger.info('Authorization headers differ:');
        // Compare parts (Basic, token)
        const [directType, directToken] = directAuth.split(' ');
        const [managerType, managerToken] = managerAuth.split(' ');
        
        logger.info(`  Type: "${directType}" vs "${managerType}"`);
        logger.info(`  Token length: ${directToken.length} vs ${managerToken.length}`);
        // Check if encoding is different but values are the same
        if (directToken.length === managerToken.length) {
          logger.info('  Token lengths match but values differ - possible encoding issue');
        }
      }
    }
    
    // Check for case differences in header names
    const directHeaderKeys = Object.keys(directHeaders);
    const managerHeaderKeys = Object.keys(authManagerHeaders);
    
    directHeaderKeys.forEach(directKey => {
      const matchingKey = managerHeaderKeys.find(
        managerKey => managerKey.toLowerCase() === directKey.toLowerCase()
      );
      
      if (matchingKey && matchingKey !== directKey) {
        logger.info(`Header case differs: "${directKey}" vs "${matchingKey}"`);
      }
    });
  } catch (error) {
    logger.error(`Error comparing headers: ${error.message}`);
  }
}

/**
 * Run tests with different configurations
 */
async function runTests() {
  logger.info('Starting Onshape API client authentication tests');
  
  // Examine header differences to understand authentication issues
  logger.info('Inspecting authentication header differences...');
  inspectHeaderDifferences();
  
  const results = [];
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    logger.info(`===== Testing endpoint: ${endpoint.name} =====`);
    
    try {
      // Test 1: Direct API call (known working approach)
      const directResult = await makeDirectApiCall(endpoint);
      results.push(directResult);
      
      // Only proceed with client tests if direct test succeeded
      if (directResult.success) {
        logger.info(`Direct test succeeded, proceeding with client tests for: ${endpoint.name}`);
        
        // Add a test that exactly matches the direct API call parameters
        const exactMatchTest = {
          testName: 'ExactMatch',
          useDirectApproach: true
        };
        
        try {
          // Use axios directly with the same parameters as the successful direct call
          const headers = createDirectAuthHeaders();
          const queryString = Object.entries(endpoint.queryParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
          
          const fullPath = endpoint.path + (queryString ? `?${queryString}` : '');
          
          logger.info(`[Client-ExactMatch] Using OnshapeClient with exact same parameters as direct call`);
          logger.info(`[Client-ExactMatch] Path: ${fullPath}`);
          
          const client = new OnshapeClient({
            baseUrl: 'https://cad.onshape.com',
            authManager: new AuthManager({ baseUrl: 'https://cad.onshape.com' }),
            debug: true
          });
          
          // Override the headers to exactly match the direct call
          const response = await client.get(fullPath, { 
            headers: headers 
          });
          
          logger.info(`[Client-ExactMatch] Success! Status: ${response?.status || 'unknown'}`);
          results.push({
            success: true,
            status: response?.status,
            method: 'client-ExactMatch'
          });
        } catch (exactMatchError) {
          logger.error(`[Client-ExactMatch] Failed: ${exactMatchError.message}`);
          results.push({
            success: false,
            error: exactMatchError.message,
            status: exactMatchError.response?.status,
            method: 'client-ExactMatch'
          });
        }
        
        // Continue with standard client tests
        results.push(await makeClientApiCall(endpoint, {
          testName: 'Default'
        }));
        
        results.push(await makeClientApiCall(endpoint, {
          testName: 'NoApiPrefix',
          removeApiPrefix: true
        }));
        
        results.push(await makeClientApiCall(endpoint, {
          testName: 'CustomHeaders',
          useCustomHeaders: true
        }));
        
        results.push(await makeClientApiCall(endpoint, {
          testName: 'Combined',
          removeApiPrefix: true,
          useCustomHeaders: true
        }));
        
        // Test with direct header pass-through
        try {
          logger.info(`[Client-DirectHeaders] Using direct headers in OnshapeClient`);
          
          const headers = createDirectAuthHeaders();
          const fullUrl = `https://cad.onshape.com${endpoint.path}`;
          
          logger.info(`[Client-DirectHeaders] URL: ${fullUrl}`);
          logger.info(`[Client-DirectHeaders] Headers: ${inspect({
            accept: headers.accept,
            Authorization: 'Basic ***' // Mask for security
          })}`);
          
          // Create client with defaults
          const client = new OnshapeClient({
            baseUrl: 'https://cad.onshape.com',
            authManager: new AuthManager({ baseUrl: 'https://cad.onshape.com' }),
            debug: true
          });
          
          // Make sure to include the query parameters as params, not in the URL
          const response = await client.get(endpoint.path, {
            headers: headers,
            params: endpoint.queryParams
          });
          
          logger.info(`[Client-DirectHeaders] Success! Status: 200`);
          results.push({
            success: true,
            status: 200,
            method: 'client-DirectHeaders'
          });
        } catch (directHeadersError) {
          logger.error(`[Client-DirectHeaders] Failed: ${directHeadersError.message}`);
          results.push({
            success: false,
            error: directHeadersError.message,
            status: directHeadersError.response?.status,
            method: 'client-DirectHeaders'
          });
        }
      } else {
        logger.warn(`Skipping client tests for ${endpoint.name} because direct test failed`);
      }
    } catch (error) {
      logger.error(`Error during test execution: ${error.message}`);
      logger.error(error.stack);
    }
  }
  
  // Summary
  logger.info('===== TEST RESULTS SUMMARY =====');
  results.forEach(result => {
    logger.info(`${result.method}: ${result.success ? 'SUCCESS' : 'FAILURE'} ${result.status ? `(Status: ${result.status})` : ''}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  logger.info(`${successCount}/${results.length} tests passed`);
  
  // Add specific diagnostics for successful direct calls but failed client calls
  const successfulDirectCalls = results.filter(r => r.method === 'direct' && r.success);
  for (const directResult of successfulDirectCalls) {
    const endpointName = endpoints.find((_, index) => 
      results[index * (results.length / endpoints.length)] === directResult
    )?.name;
    
    if (endpointName) {
      const clientResults = results.filter(r => 
        r.method.startsWith('client-') && 
        r.status === directResult.status
      );
      
      if (clientResults.length === 0) {
        logger.warn(`Direct call to ${endpointName} succeeded, but all client calls failed`);
        logger.warn('This suggests an issue with the OnshapeClient configuration or headers');
      }
    }
  }
}

// Run the tests
runTests()
  .then(() => {
    logger.info('Authentication test completed');
    process.exit(0);
  })
  .catch(err => {
    logger.error(`Test failed with error: ${err.message}`);
    process.exit(1);
  });

