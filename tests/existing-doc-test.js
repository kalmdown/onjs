/**
 * Test accessing an existing Onshape document
 * This helps diagnose if it's a permissions issue or authentication issue
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

// You need to provide an existing document ID
// This is a document you've already created in the Onshape UI
// Find it in the URL when viewing your document: https://cad.onshape.com/documents/YOUR_DOC_ID/...
const EXISTING_DOCUMENT_ID = process.env.ONSHAPE_TEST_DOCUMENT_ID || 'YOUR_DOCUMENT_ID';

/**
 * Build auth headers for Onshape API
 */
function buildHeaders(method, path, queryParams = {}) {
  // Date in RFC format
  const date = new Date().toUTCString();
  
  // Build query string
  const query = Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');
  
  // Path with query string if present
  const urlPath = query ? `${path}?${query}` : path;
  
  // String to sign
  const stringToSign = `${method.toLowerCase()}\n${urlPath.toLowerCase()}\n${date.toLowerCase()}`;
  
  // Generate signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': date,
    'On-Nonce': crypto.randomBytes(16).toString('base64'),
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
}

/**
 * Make an API request
 */
async function makeRequest(method, path, queryParams = {}, data = null) {
  try {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Build URL
    const url = `${BASE_URL}${path}`;
    
    console.log(`\nMaking ${method} request to ${url}`);
    console.log('Query params:', queryParams);
    
    // Get auth headers
    const headers = buildHeaders(method, path, queryParams);
    
    // Make request
    const response = await axios({
      method,
      url,
      params: queryParams,
      headers,
      data
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'unknown'}`);
    console.error('Error message:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Run tests against existing document
 */
async function testExistingDocument() {
  // Verify document ID is set
  if (EXISTING_DOCUMENT_ID === 'YOUR_DOCUMENT_ID') {
    console.error('ERROR: Please set EXISTING_DOCUMENT_ID in the script or as ONSHAPE_TEST_DOCUMENT_ID in .env');
    return;
  }
  
  console.log('==============================================');
  console.log('TESTING WITH EXISTING DOCUMENT');
  console.log('==============================================');
  console.log(`Document ID: ${EXISTING_DOCUMENT_ID}`);
  
  // Test 1: Session info (should work)
  console.log('\n--- TEST 1: Session Info ---');
  await makeRequest('GET', '/users/sessioninfo');
  
  // Test 2: Get document info
  console.log('\n--- TEST 2: Document Info ---');
  const docInfo = await makeRequest('GET', `/documents/${EXISTING_DOCUMENT_ID}`);
  
  // Test 3: Get document workspaces
  console.log('\n--- TEST 3: Document Workspaces ---');
  if (docInfo) {
    await makeRequest('GET', `/documents/d/${EXISTING_DOCUMENT_ID}/workspaces`);
  }
  
  // Test 4: Get document elements
  console.log('\n--- TEST 4: Document Elements ---');
  if (docInfo) {
    const workspaceId = docInfo.defaultWorkspace?.id;
    if (workspaceId) {
      await makeRequest('GET', `/documents/d/${EXISTING_DOCUMENT_ID}/w/${workspaceId}/elements`);
    } else {
      console.error('Could not find workspace ID in document info');
    }
  }
}

testExistingDocument();