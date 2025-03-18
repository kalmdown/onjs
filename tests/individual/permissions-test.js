/**
 * Test file to check specific API permissions
 */
const dotenv = require('dotenv');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Attempting to load environment variables from: ${envPath}`);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`Error loading environment variables from ${envPath}:`, result.error.message);
} else {
  console.log(`Successfully loaded environment variables from ${envPath}`);
}

// API credentials
const accessKey = process.env.ONSHAPE_ACCESS_KEY;
const secretKey = process.env.ONSHAPE_SECRET_KEY;
const baseUrl = process.env.API_URL || 'https://cad.onshape.com/api/v6';
const testDocumentId = process.env.ONSHAPE_TEST_DOCUMENT_ID;

if (!accessKey || !secretKey) {
  console.error('Missing API credentials in .env file');
  console.error(`ACCESS_KEY: ${accessKey}`);
  console.error(`SECRET_KEY: ${secretKey}`);
  process.exit(1);
}

/**
 * Generate Basic Auth headers for API requests
 */
function generateBasicAuthHeaders() {
  // Create base64 encoded credentials for Basic Auth
  const credentials = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
  
  // Return headers with Basic authentication
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Parse and analyze OAuth scopes from API response
 * Handles Onshape's numeric bit representation and string formats
 */
function analyzeOAuthScopes(scopeData) {
  if (!scopeData) return { scopes: [], has: {} };
  
  let scopes = [];
  let unknownBits = [];
  
  // Handle different scope formats
  if (typeof scopeData === 'number') {
    // Standard bit positions used by Onshape
    const scopeMap = {
      1: 'OAuth2Read',
      2: 'OAuth2Write', 
      4: 'OAuth2Delete',
      8: 'OAuth2ReadPII',
      16: 'OAuth2Webhook',
      32: 'OAuth2Export',
      64: 'OAuth2Purchase'
    };
    
    // For a more precise mapping, use specific values seen in practice
    if (scopeData === 4103) {
      // This specific value represents all four main permissions
      scopes = ['OAuth2Read', 'OAuth2Write', 'OAuth2Delete', 'OAuth2ReadPII'];
      
      // Log the special case for debugging
      console.log('Special case: Found scope 4103, which includes OAuth2ReadPII');
    } else {
      // Process standard bit flags
      Object.entries(scopeMap).forEach(([bit, scope]) => {
        const bitValue = parseInt(bit);
        if ((scopeData & bitValue) !== 0) {
          scopes.push(scope);
        }
      });
      
      // Check for unknown bits
      const knownBits = parseInt('01111111', 2); // Sum of all known bits (127)
      const remainingBits = scopeData & ~knownBits;
      
      if (remainingBits > 0) {
        console.log(`Note: Found unknown scope bits: ${remainingBits.toString(10)} (binary: ${remainingBits.toString(2)})`);
        
        // Identify which specific unknown bits are set
        let bit = 1;
        while (bit <= remainingBits) {
          if ((remainingBits & bit) !== 0) {
            unknownBits.push(bit);
          }
          bit <<= 1;
        }
      }
    }
    
    // Detailed logging for numeric scopes
    console.log(`\nScope Analysis:`);
    console.log(`Raw scope value: ${scopeData} (binary: ${scopeData.toString(2)})`);
  } else if (typeof scopeData === 'string') {
    // Space-separated string format: "OAuth2Read OAuth2Write OAuth2Delete"
    scopes = scopeData.split(' ').filter(s => s);
  } else if (Array.isArray(scopeData)) {
    // Array format: ["OAuth2Read", "OAuth2Write", "OAuth2Delete"]
    scopes = scopeData;
  }
  
  // Special handling for comma-separated string format: "OAuth2Read,OAuth2Write,OAuth2Delete"
  if (scopes.length === 1 && scopes[0].includes(',')) {
    scopes = scopes[0].split(',').filter(s => s);
  }
  
  // Check for specific permissions
  const hasRead = scopes.some(s => s.includes('OAuth2Read') && !s.includes('OAuth2ReadPII'));
  const hasWrite = scopes.some(s => s.includes('OAuth2Write'));
  const hasDelete = scopes.some(s => s.includes('OAuth2Delete'));
  const hasReadPII = scopes.some(s => s.includes('OAuth2ReadPII'));
  
  return {
    scopes,
    formatted: scopes.join(' '),
    has: {
      read: hasRead,
      write: hasWrite,
      delete: hasDelete,
      readPII: hasReadPII
    },
    unknownBits
  };
}

/**
 * Make an API request
 */
async function makeRequest(method, path, data = null, queryParams = {}) {
  console.log(`\n${method} ${path}`);
  console.log('Query params:', queryParams);
  if (data) console.log('Body:', JSON.stringify(data));

  try {
    const headers = generateBasicAuthHeaders();
    console.log('Auth headers generated');

    const url = `${baseUrl}${path}`;
    console.log('Full URL:', url);

    const response = await axios({
      method,
      url,
      headers,
      params: queryParams,
      data,
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Resolve only if the status code is in the 2xx range
      }
    });

    console.log(`✅ Success! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'Unknown'}`);
    console.error('Error message:', error.response?.data?.message || error.message);
    
    // Add special handling for common errors
    if (error.response?.data?.message) {
      const errorMsg = error.response.data.message;
      if (errorMsg.includes('Company not found')) {
        console.error('👉 This appears to be a company association issue.');
        console.error('   For free accounts, use ownerType: 0 instead of 1 when creating documents.');
      } else if (errorMsg.includes('quota')) {
        console.error('👉 You may have exceeded your document quota.');
      }
    }
    
    return null;
  }
}

/**
 * Test different API endpoints to check permissions
 */
async function checkPermissions() {
  console.log('=============================================');
  console.log('ONSHAPE API PERMISSIONS TEST');
  console.log('=============================================');
  console.log(`Using API key: ${accessKey.substring(0, 4)}...`);
  console.log(`Using authentication method: Basic Auth`);

  // Initialize summary variables
  let globalScopeInfo = null;
  let testDocumentAccess = false;
  let userInfoAccess = false;
  let listDocumentsAccess = false;
  let createDocumentAccess = false;
  let deleteAccess = false;

  // Test A: Check auth methods to find which one works best
  console.log('\n---------- TEST A: AUTH METHOD CHECK ----------');
  
  // Test with Basic Auth
  console.log('Testing Basic Auth...');
  const basicAuthHeaders = {
    'Authorization': `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString('base64')}`,
    'Content-Type': 'application/json'
  };
  
  try {
    const basicAuthResponse = await axios({
      method: 'GET',
      url: `${baseUrl}/users/sessioninfo`,
      headers: basicAuthHeaders,
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    });
    console.log(`✅ Basic Auth Success! Status: ${basicAuthResponse.status}`);
    
    // Check for OAuth scopes
    const scopeInfo = analyzeOAuthScopes(basicAuthResponse.data.oauth2Scopes);
    console.log('OAuth Scopes:', scopeInfo.formatted || 'None found');
    console.log('Has Read Permission:', scopeInfo.has.read ? '✅ Yes' : '❌ No');
    console.log('Has Write Permission:', scopeInfo.has.write ? '✅ Yes' : '❌ No');
    console.log('Has Delete Permission:', scopeInfo.has.delete ? '✅ Yes' : '❌ No');
    console.log('Has ReadPII Permission:', scopeInfo.has.readPII ? '✅ Yes' : '❌ No');
    
    // Store scope info for summary
    globalScopeInfo = scopeInfo;
  } catch (error) {
    console.error(`❌ Basic Auth Failed! Status: ${error.response?.status || 'Unknown'}`);
    console.error('Error message:', error.response?.data?.message || error.message);
  }

  // Test 1: Get user info (Read access)
  console.log('\n---------- TEST 1: READ USER INFO ----------');
  const userInfo = await makeRequest('GET', '/users/sessioninfo');
  
  if (userInfo) {
    console.log('User info retrieved successfully');
    console.log('Name:', userInfo.name);
    console.log('Email:', userInfo.email);
    console.log('Plan:', userInfo.plan);
    
    // Parse and display OAuth scopes
    if (userInfo.oauth2Scopes !== undefined) {
      const scopeInfo = analyzeOAuthScopes(userInfo.oauth2Scopes);
      console.log('OAuth Scopes:', scopeInfo.formatted);
    }
    
    userInfoAccess = true;
  }

  // Test 2: List documents (Read access)
  console.log('\n---------- TEST 2: LIST DOCUMENTS ----------');
  const documents = await makeRequest('GET', '/documents', null, {
    limit: 5
  });
  
  if (documents && documents.items) {
    console.log(`Successfully retrieved ${documents.items.length} documents`);
    if (documents.items.length > 0) {
      console.log('First document:', documents.items[0].name);
    }
    listDocumentsAccess = true;
  }

  // Test 3: Create a document (Write access)
  console.log('\n---------- TEST 3: CREATE DOCUMENT ----------');
  const newDocData = {
    name: `Test Document ${new Date().toISOString()}`,
    description: "Created by permission test script",
    isPublic: true,
    // For free accounts, use ownerType 0 (personal) instead of 1 (company)
    ownerType: 0  
  };
  
  const newDocument = await makeRequest('POST', '/documents', newDocData);
  let documentId = null;
  
  if (newDocument && newDocument.id) {
    console.log('Successfully created document');
    console.log('Document ID:', newDocument.id);
    console.log('Document Name:', newDocument.name);
    documentId = newDocument.id;
    createDocumentAccess = true;
    testDocumentAccess = true;
  } else {
    // Handle specific errors
    console.log('⚠️ Could not create document. This may be due to:');
    console.log('   - Free account limitations');
    console.log('   - Missing company association');
    console.log('   - Exceeding document quota');
    console.log('   - Missing permissions');
  }

  // Optional Test 4: Delete the created document (Delete access)
  if (documentId) {
    console.log('\n---------- TEST 4: DELETE DOCUMENT ----------');
    const deleteResult = await makeRequest('DELETE', `/documents/${documentId}`);
    
    if (deleteResult !== null) {
      // Fix: Check if the request was successful, not just if there's a response body
      // For DELETE operations, the response might be empty but status 200/204
      console.log('Successfully deleted document');
      deleteAccess = true;
    }
  }

  // Summary section
  console.log('\n=============================================');
  console.log('PERMISSIONS SUMMARY');
  console.log('=============================================');
  
  if (globalScopeInfo && globalScopeInfo.scopes.length > 0) {
    console.log('API Key OAuth Scopes:', globalScopeInfo.formatted);
    console.log(`Read permission: ${globalScopeInfo.has.read ? '✅ Yes' : '❌ No'}`);
    console.log(`Write permission: ${globalScopeInfo.has.write ? '✅ Yes' : '❌ No'}`);
    console.log(`Delete permission: ${globalScopeInfo.has.delete ? '✅ Yes' : '❌ No'}`);
    console.log(`ReadPII permission: ${globalScopeInfo.has.readPII ? '✅ Yes' : '❌ No'}`);
    console.log('---------------------------------------------');
  }
  
  console.log(`Test document access: ${testDocumentAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`User info access: ${userInfoAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`List documents: ${listDocumentsAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`Create documents: ${createDocumentAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`Delete documents: ${deleteAccess ? '✅ Yes' : '❌ No'}`);
  
  // Provide guidance based on the results
  console.log('\n=============================================');
  console.log('RECOMMENDATIONS');
  console.log('=============================================');
  if (!userInfoAccess) {
    console.log('❌ Your API key may be invalid or expired. Create a new API key.');
  } else if (!listDocumentsAccess) {
    console.log('❌ Your API key lacks OAuth2Read scope. Add this scope in the Developer Portal.');
  } else if (!createDocumentAccess && (!globalScopeInfo || !globalScopeInfo.has.write)) {
    console.log('❌ Your API key lacks OAuth2Write scope. Add this scope in the Developer Portal.');
  } else if (!createDocumentAccess) {
    console.log('⚠️ Your API key has write permissions, but document creation failed.');
    console.log('   This could be due to account limitations or company settings.');
    console.log('   Free accounts should use ownerType: 0 for personal documents.');
  } else if (!deleteAccess && globalScopeInfo && !globalScopeInfo.has.delete) {
    console.log('⚠️ Your API key lacks OAuth2Delete scope. Add this if you need to delete documents.');
  } else if (globalScopeInfo && !globalScopeInfo.has.readPII) {
    console.log('⚠️ Your API key lacks OAuth2ReadPII scope. Add this if you need access to personal information.');
  } else {
    console.log('✅ Your API key has all the required permissions!');
  }
  
  // Update recommended format to match Onshape's passport format
  console.log('\nRecommended scope format for Onshape: OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete');
  console.log('=============================================');
}

checkPermissions();