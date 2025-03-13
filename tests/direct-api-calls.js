/**
 * Direct Onshape API Test
 * 
 * This file contains direct API calls to Onshape without using any wrapper libraries.
 * All calls are hardcoded for clarity and debugging purposes.
 */
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Hardcoded API access credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;

// Store global values between API calls
const globals = {
  existingDocumentCount: 0,
  testDocumentId: null
};

/**
 * Simple assertion function
 */
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ Assertion passed: ${message}`);
}

/**
 * Format and print request details
 */
function printRequestDetails(method, url, headers, queryParams = null, data = null) {
  console.log('\n📤 REQUEST DETAILS:');
  console.log(`${method} ${url}`);
  
  console.log('\n📋 Headers:');
  for (const [key, value] of Object.entries(headers)) {
    // Mask Authorization header to protect credentials
    if (key === 'Authorization') {
      console.log(`${key}: ${value.substring(0, 15)}...`);
    } else {
      console.log(`${key}: ${value}`);
    }
  }
  
  if (queryParams && Object.keys(queryParams).length > 0) {
    console.log('\n🔍 Query Parameters:');
    console.log(JSON.stringify(queryParams, null, 2));
  }
  
  if (data) {
    console.log('\n📦 Request Body:');
    console.log(JSON.stringify(data, null, 2));
  }
  
  console.log('\n' + '-'.repeat(80));
}

/**
 * Format and print response details
 */
function printResponseDetails(response) {
  console.log('\n📥 RESPONSE DETAILS:');
  console.log(`Status: ${response.status} ${response.statusText}`);
  
  console.log('\n📋 Response Headers:');
  for (const [key, value] of Object.entries(response.headers)) {
    console.log(`${key}: ${value}`);
  }
  
  console.log('\n📦 Response Body:');
  if (response.status === 204) {
    console.log('No content (empty response body)');
  } else if (response.data) {
    console.log(JSON.stringify(response.data, null, 2));
  } else {
    console.log('Empty or undefined response body');
  }
  
  console.log('\n' + '-'.repeat(80));
}

/**
 * Generate the authentication headers for API key-based requests
 */
function generateAuthHeaders(method, urlPath, queryParams = {}, bodyContent = null) {
  const date = new Date().toUTCString();
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Convert query params to string
  const queryString = Object.keys(queryParams).length > 0 
    ? querystring.stringify(queryParams) 
    : '';
  
  // Content-Type is needed for requests with a body
  const contentType = bodyContent ? 'application/json' : '';
  
  // Build the string to sign
  const stringToSign = [
    method,                        // HTTP method
    urlPath,                       // URL path
    queryString,                   // Query string
    contentType,                   // Content-Type
    date,                          // Date
    nonce,                         // Nonce
    bodyContent ? JSON.stringify(bodyContent) : '' // Request body (JSON string)
  ].join('\n').toLowerCase();
  
  // Create the signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign, 'utf8');
  const signature = hmac.digest('base64');
  
  // Build the Authorization header
  const authHeader = `On ${ACCESS_KEY}:HmacSHA256:${signature}`;
  
  // Return all the headers needed for the request
  return {
    'Date': date,
    'On-Nonce': nonce,
    'Content-Type': contentType || 'application/json',
    'Authorization': authHeader
  };
}

/**
 * Helper function to interpret OAuth scopes from response
 * Handles both numeric and space-separated string formats
 */
function interpretOAuthScopes(scopeValue) {
  // If the scope is a number, interpret it as bitwise flags
  if (typeof scopeValue === 'number') {
    const scopes = [];
    const mappings = {
      1: 'OAuth2Read',
      2: 'OAuth2Write',
      4: 'OAuth2Delete',
      8: 'OAuth2ReadPII'
      // Additional scope values can be added here
    };
    
    Object.entries(mappings).forEach(([bitValue, scopeName]) => {
      if (scopeValue & parseInt(bitValue)) {
        scopes.push(scopeName);
      }
    });
    
    return {
      rawValue: scopeValue,
      binaryValue: scopeValue.toString(2),
      interpretedScopes: scopes,
      formatted: scopes.join(' ')
    };
  } 
  // If the scope is a string, split it into array
  else if (typeof scopeValue === 'string') {
    const scopes = scopeValue.split(' ').filter(s => s);
    return {
      rawValue: scopeValue,
      interpretedScopes: scopes,
      formatted: scopeValue
    };
  }
  // If the scope is an array, just return it
  else if (Array.isArray(scopeValue)) {
    return {
      rawValue: scopeValue,
      interpretedScopes: scopeValue,
      formatted: scopeValue.join(' ')
    };
  }
  
  return {
    rawValue: scopeValue,
    interpretedScopes: [],
    formatted: 'Unknown format'
  };
}

/**
 * Common authentication error handler
 * Provides consistent handling of auth errors across all API calls
 */
function handleAuthError(error, operation) {
  console.error(`❌ Error ${operation}:`, error.message);
  
  if (error.response) {
    console.error(`Status: ${error.response.status}`);
    
    if (error.response.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Handle specific status codes
    if (error.response.status === 401) {
      console.log('\n🔒 Authentication Error:');
      console.log('👉 API key authentication failed');
      console.log('   - Check your ACCESS_KEY and SECRET_KEY values');
      console.log('   - Verify the API key is still active in Onshape');
      console.log('   - Confirm the API key has the required scopes (OAuth2ReadPII OAuth2Read OAuth2Write)');
      
      // Try to extract auth error details if available in the response
      if (error.response.data && error.response.data.message) {
        console.log(`\nServer message: ${error.response.data.message}`);
      }
      
      // Add operation-specific guidance
      switch (operation) {
        case 'retrieving documents':
          console.log('\n📝 For document access:');
          console.log('   - Ensure your API key has at least OAuth2Read scope');
          console.log('   - Check if you have access to the requested documents');
          break;
        case 'creating document':
          console.log('\n📝 For document creation:');
          console.log('   - Ensure your API key has OAuth2Write scope');
          break;
        case 'deleting document':
          console.log('\n📝 For document deletion:');
          console.log('   - Ensure your API key has OAuth2Delete scope');
          console.log('   - Verify you are the owner of the document or have admin privileges');
          break;
      }
    } else if (error.response.status === 403) {
      console.log('\n🔒 Authorization Error:');
      console.log('👉 Insufficient permissions for this operation');
      console.log('   - Your API key lacks the required OAuth scopes');
      console.log('   - Required scopes: OAuth2ReadPII OAuth2Read OAuth2Write');
      console.log('   - Edit your API key in the Onshape Developer Portal to add missing scopes');
      
      // Add operation-specific guidance for 403 errors
      switch (operation) {
        case 'retrieving documents':
          console.log('   - For document access, your key needs OAuth2Read scope');
          break;
        case 'creating document':
          console.log('   - For document creation, your key needs OAuth2Write scope');
          break;
        case 'deleting document':
          console.log('   - For document deletion, your key needs OAuth2Delete scope');
          break;
      }
    } else if (error.response.status === 429) {
      console.log('\n⏱️ Rate Limit Error:');
      console.log('👉 Too many requests in a short period');
      console.log('   - Implement request throttling');
      
      // Extract rate limit details from headers if available
      const resetTime = error.response.headers['x-ratelimit-reset'];
      const limit = error.response.headers['x-ratelimit-limit'];
      
      if (resetTime) {
        const resetDate = new Date(parseInt(resetTime) * 1000);
        console.log(`   - Rate limit will reset at: ${resetDate.toLocaleString()}`);
      }
      
      if (limit) {
        console.log(`   - Rate limit: ${limit} requests`);
      }
    }
  } else if (error.request) {
    console.error('⚠️ No response received from server');
    console.log('👉 Likely causes:');
    console.log('   - Network issue or timeout');
    console.log('   - Incorrect API endpoint');
    console.log('   - Server unavailable');
  } else {
    console.error('⚠️ Error setting up the request:', error.message);
  }
}

/**
 * Test 0: Explicitly test authentication
 */
async function testAuthentication() {
  console.log('\n📋 Test 0: Authenticate with Onshape API');
  
  const method = 'GET';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = '/api/v10/users/sessioninfo';
  const fullUrl = `${baseUrl}${urlPath}`;
  
  console.log(`📡 Making authentication test call: ${method} ${fullUrl}`);
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath);
    
    // Print request details with special focus on auth headers
    console.log('\n🔐 AUTHENTICATION REQUEST:');
    console.log(`${method} ${fullUrl}`);
    
    console.log('\n📋 Authentication Headers:');
    for (const [key, value] of Object.entries(headers)) {
      if (key === 'Authorization') {
        // Show more details of the auth header but still mask sensitive parts
        const parts = value.split(':');
        console.log(`${key}: ${parts[0]}:${parts[1]}:****`);
        console.log(`  - Auth Method: ${parts[0]}`);
        console.log(`  - Access Key: ${ACCESS_KEY.substring(0, 5)}...${ACCESS_KEY.substring(ACCESS_KEY.length - 5)}`);
        console.log(`  - Signature Method: ${parts[1]}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    
    console.log('\n' + '-'.repeat(80));
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers
    });
    
    // Print response details
    console.log('\n🔐 AUTHENTICATION RESPONSE:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    console.log('\n📋 Response Headers:');
    for (const [key, value] of Object.entries(response.headers)) {
      console.log(`${key}: ${value}`);
    }
    
    console.log('\n📦 Authentication Response Body:');
    if (response.status === 204) {
      console.log('No content (empty response body)');
    } else if (response.data) {
      console.log(JSON.stringify(response.data, null, 2));
      
      // Extract and interpret OAuth scopes
      if (response.data.oauth2Scopes !== undefined) {
        const scopeInfo = interpretOAuthScopes(response.data.oauth2Scopes);
            
        console.log('\n🔑 OAuth Scope Analysis:');
        console.log(`Raw scope value: ${scopeInfo.rawValue}`);
        if (typeof response.data.oauth2Scopes === 'number') {
          console.log(`Binary representation: ${scopeInfo.binaryValue}`);
        }
        console.log(`Interpreted scopes: ${JSON.stringify(scopeInfo.interpretedScopes)}`);
        console.log(`Formatted scope string: ${scopeInfo.formatted}`);
        
        // Check for common permissions
        const hasRead = scopeInfo.interpretedScopes.some(s => s.includes('Read'));
        const hasWrite = scopeInfo.interpretedScopes.some(s => s.includes('Write'));
        const hasReadPII = scopeInfo.interpretedScopes.some(s => s.includes('ReadPII'));
        const hasDelete = scopeInfo.interpretedScopes.some(s => s.includes('Delete'));
        
        console.log('\n🔒 Permission Summary:');
        console.log(`Read access: ${hasRead ? '✓' : '✗'}`);
        console.log(`Write access: ${hasWrite ? '✓' : '✗'}`);
        console.log(`PII access: ${hasReadPII ? '✓' : '✗'}`);
        console.log(`Delete access: ${hasDelete ? '✓' : '✗'}`);
      }
    } else {
      console.log('Empty or undefined response body');
    }
    
    console.log('\n' + '-'.repeat(80));
    
    console.log('✅ Authentication test successful');
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
     
    return response.data || {};
  } catch (error) {
    handleAuthError(error, 'authenticating');
    throw error;
  }
}

/**
 * Run all tests in sequence
 */
async function runAllTests() {
  console.log('🧪 Running Direct Onshape API Tests');
  
  // Check credentials
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.warn('⚠️ Missing API credentials. Tests will be skipped.');
    return;
  }
  
  try {
    await testAuthentication();  // Run authentication test first
    await getSessionInfo();
    await getMyDocuments();
    await createPublicDocument();
    await deleteCreatedDocument();
    await verifyDocumentDeleted();
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Test 1: Get session info
 */
async function getSessionInfo() {
  console.log('\n📋 Test 1: Get session info with hardcoded call');
  
  const method = 'GET';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = '/api/v10/users/sessioninfo';
  const fullUrl = `${baseUrl}${urlPath}`;
  
  console.log(`📡 Making direct API call: ${method} ${fullUrl}`);
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath);
    
    // Print request details
    printRequestDetails(method, fullUrl, headers);
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers
    });
    
    // Print response details
    printResponseDetails(response);
    
    // Handle different successful status codes
    if (response.status === 204) {
      console.log('✅ Session info retrieved (no content)');
    } else {
      console.log('✅ Session info retrieved');
      // Use optional chaining and nullish coalescing for safety
      console.log(`User: ${response.data?.name || 'Name not available'}`);
      console.log(`Email: ${response.data?.email || 'Email not available'}`);
      console.log(`OAuth2 Scopes: ${response.data?.oauth2Scopes || 'None specified'}`);
    }
    
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
    if (response.status === 200) {
      assert(response.data !== undefined, 'Response data should be defined for 200 status');
    }
    
    return response.data || {};
  } catch (error) {
    handleAuthError(error, 'retrieving session info');
    throw error;
  }
}

/**
 * Test 2: Get my documents
 */
async function getMyDocuments() {
  console.log('\n📋 Test 2: Get my documents with hardcoded call');
  
  const method = 'GET';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = '/api/v10/documents';
  const queryParams = {
    filter: 0,
    ownerType: 1,
    sortColumn: 'createdAt',
    sortOrder: 'desc', 
    offset: 0,
    limit: 20
  };
  const fullUrl = `${baseUrl}${urlPath}`;
  
  console.log(`📡 Making direct API call: ${method} ${fullUrl}`);
  console.log('Query parameters:', JSON.stringify(queryParams, null, 2));
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath, queryParams);
    
    // Print request details
    printRequestDetails(method, fullUrl, headers, queryParams);
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers,
      params: queryParams
    });
    
    // Print response details
    printResponseDetails(response);
    
    // Handle different successful status codes and add permission diagnostics
    if (response.status === 204) {
      console.log('✅ Documents retrieved (no content)');
      globals.existingDocumentCount = 0;
    } else {
      console.log('✅ Documents retrieved');
      console.log(`Total documents: ${response.data?.items?.length || 0}`);
      
      if (response.data?.items && response.data.items.length > 0) {
        console.log('\nFirst document:');
        console.log(`Name: ${response.data.items[0].name}`);
        console.log(`ID: ${response.data.items[0].id}`);
      } else if (response.data?.items && response.data.items.length === 0) {
        console.log('\n⚠️ No documents found. This could indicate:');
        console.log('   - Your account has no documents');
        console.log('   - Your API key doesn\'t have sufficient permissions');
        console.log('   - The filter parameters excluded all documents');
      }
      
      // Store document count for later tests
      globals.existingDocumentCount = response.data?.items?.length || 0;
    }
    
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
    if (response.status === 200) {
      assert(response.data !== undefined, 'Response data should be defined for 200 status');
    }
    
    return response.data || {};
  } catch (error) {
    handleAuthError(error, 'retrieving documents');
    throw error;
  }
}

/**
 * Test 3: Create a public document
 */
async function createPublicDocument() {
  console.log('\n📋 Test 3: Create a public document with hardcoded call');
  
  const method = 'POST';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = '/api/v10/documents';
  const fullUrl = `${baseUrl}${urlPath}`;
  
  // Hardcoded document creation payload
  const documentData = {
    name: `Test Document ${new Date().toISOString()}`,
    description: "Created via direct API test",
    isPublic: true,
    ownerType: 1,  // 0=ANONYMOUS, 1=USER, 2=COMPANY, 3=TEAM, 4=APPLICATION
    betaCapabilityIds: []  // Optional beta capabilities
  };
  
  console.log(`📡 Making direct API call: ${method} ${fullUrl}`);
  console.log('Document data:', JSON.stringify(documentData, null, 2));
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath, {}, documentData);
    
    // Print request details
    printRequestDetails(method, fullUrl, headers, null, documentData);
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers,
      data: documentData
    });
    
    // Print response details
    printResponseDetails(response);
    
    // Handle different successful status codes
    if (response.status === 204) {
      console.log('✅ Document created (no content returned)');
      console.log('⚠️ Unable to retrieve document ID from response. Document deletion may fail.');
    } else {
      console.log('✅ Document created');
      console.log(`Name: ${response.data?.name || 'Name not available'}`);
      console.log(`ID: ${response.data?.id || 'ID not available'}`);
      console.log(`URL: ${response.data?.href || 'URL not available'}`);
      
      // Store document ID for deletion in next test
      globals.testDocumentId = response.data?.id;
      
      // Log permission details
      if (response.headers['location']) {
        console.log(`Document location: ${response.headers['location']}`);
      }
    }
    
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
    if (response.status === 200) {
      assert(response.data?.id !== undefined, 'Document ID should be defined for 200 status');
    }
    
    return response.data || {};
  } catch (error) {
    // Special handling for document creation errors
    if (error.response && error.response.status === 403) {
      console.error('❌ Error creating document: Insufficient permissions');
      console.log('\n🔒 Document Creation Requires:');
      console.log('   - OAuth2Write scope in your API key permissions');
      console.log('   - An active Onshape subscription or plan that allows document creation');
      console.log('   - You may have reached your plan\'s document limit');
    } else {
      handleAuthError(error, 'creating document');
    }
    throw error;
  }
}

/**
 * Test 4: Delete the created document
 */
async function deleteCreatedDocument() {
  console.log('\n📋 Test 4: Delete the created document with hardcoded call');
  
  // Skip if no document was created
  if (!globals.testDocumentId) {
    console.log('⏭️ Skipping document deletion as no document was created');
    return;
  }
  
  const method = 'DELETE';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = `/api/v10/documents/${globals.testDocumentId}`;
  const fullUrl = `${baseUrl}${urlPath}`;
  
  console.log(`📡 Making direct API call: ${method} ${fullUrl}`);
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath);
    
    // Print request details
    printRequestDetails(method, fullUrl, headers);
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers
    });
     
    // Print response details
    printResponseDetails(response);
    
    // Handle different successful status codes
    console.log('✅ Document deleted');
    
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
    
    return response.data || {};
  } catch (error) {
    handleAuthError(error, 'deleting document');
    throw error;
  }
}

/**
 * Test 5: Verify document was deleted
 */
async function verifyDocumentDeleted() {
  console.log('\n📋 Test 5: Verify document was deleted');
  
  const method = 'GET';
  const baseUrl = 'https://cad.onshape.com';
  const urlPath = '/api/v10/documents';
  const queryParams = {
    filter: 0,
    ownerType: 1,
    sortColumn: 'createdAt',
    sortOrder: 'desc',
    offset: 0,
    limit: 20
  };
  const fullUrl = `${baseUrl}${urlPath}`;
  
  console.log(`📡 Making direct API call: ${method} ${fullUrl}`);
  
  try {
    // Generate authentication headers
    const headers = generateAuthHeaders(method, urlPath, queryParams);
    
    // Print request details
    printRequestDetails(method, fullUrl, headers, queryParams);
    
    // Make the API call with axios
    const response = await axios({
      method: method,
      url: fullUrl,
      headers: headers,
      params: queryParams
    });
    
    // Print response details
    printResponseDetails(response);
    
    // Handle different successful status codes
    if (response.status === 204) {
      console.log('✅ Documents retrieved for verification (no content)');
      console.log('Document count before:', globals.existingDocumentCount);
      console.log('Document count after: 0 (no content)');
        
      // If there was no content, we can't verify document count
      console.log('⚠️ Cannot verify document deletion due to 204 response');
    } else {
      console.log('✅ Documents retrieved for verification');
      
      const newDocumentCount = response.data?.items?.length || 0;
      console.log(`Document count before: ${globals.existingDocumentCount}`);
      console.log(`Document count after: ${newDocumentCount}`);
         
      // The counts should match if the document was successfully deleted
      assert(newDocumentCount === globals.existingDocumentCount, 
        `Document count should match (${globals.existingDocumentCount})`);
    }
    
    assert(response.status === 200 || response.status === 204, 'Status code should be 200 or 204');
    
    return response.data || {};
  } catch (error) {
    handleAuthError(error, 'verifying document deletion');
    throw error;
  }
}

// Execute all tests when run directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Error in test execution:', error);
    process.exit(1);
  });
}

// Export functions for use in other scripts
module.exports = {
  testAuthentication,
  getSessionInfo,
  getMyDocuments,
  createPublicDocument,
  deleteCreatedDocument,
  verifyDocumentDeleted,
  runAllTests
};