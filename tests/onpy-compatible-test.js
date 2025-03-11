/**
 * Onshape API client based on the working onpy implementation
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const querystring = require('querystring');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

/**
 * Build Onshape auth headers in the same way as onpy
 */
function buildHeaders(method, path, queryObj = {}, body = null) {
  // Current date in RFC format
  const date = new Date().toUTCString();
  
  // Convert query object to string, ensuring correct sorting
  const query = Object.keys(queryObj)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryObj[key])}`)
    .join('&');
  
  // Build the path with query string if present
  const urlPath = query ? `${path}?${query}` : path;
  
  // Create the string to sign exactly as in onpy
  const stringToSign = `${method.toLowerCase()}\n${urlPath.toLowerCase()}\n${date.toLowerCase()}`;
  
  console.log('\nString to sign:');
  console.log(stringToSign);
  
  // Create signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Create request headers
  const authHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': date,
    'On-Nonce': crypto.randomBytes(16).toString('base64'),
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
  
  return authHeaders;
}

/**
 * Make an API request using the onpy-compatible headers
 */
async function apiRequest(method, path, queryParams = {}, body = null) {
  try {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Build URL with base and query params
    let url = `${BASE_URL}${path}`;
    const query = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    
    if (query) {
      url += `?${query}`;
    }
    
    // Get authentication headers
    const headers = buildHeaders(method, path, queryParams, body);
    
    console.log(`Making ${method} request to: ${url}`);
    
    // Make the request
    const response = await axios({
      method: method,
      url: url,
      headers: headers,
      data: body
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Run tests against the API
 */
async function runTests() {
  console.log('========================================');
  console.log('ONSHAPE API TESTS (ONPY COMPATIBLE)');
  console.log('========================================');
  
  // Test user info
  console.log('\nGetting user session info...');
  const userInfo = await apiRequest('GET', '/users/sessioninfo');
  
  // Test listing documents
  console.log('\nListing documents...');
  const documents = await apiRequest('GET', '/documents');
  
  // Test creating document
  if (documents.success) {
    console.log('\nCreating test document...');
    const newDoc = await apiRequest('POST', '/documents', {}, {
      name: 'API Test Document',
      isPublic: false
    });
    
    // Test deleting document
    if (newDoc.success && newDoc.data?.id) {
      console.log('\nDeleting test document...');
      await apiRequest('DELETE', `/documents/${newDoc.data.id}`);
    }
  }
  
  // Test with document ID from onpy tests
  console.log('\n========================================');
  console.log('RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Session Info: ${userInfo.success ? '✅ Working' : '❌ Failed'}`);
  console.log(`List Documents: ${documents.success ? '✅ Working' : '❌ Failed'}`);
}

runTests();