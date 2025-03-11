/**
 * Alternative authentication format test
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

/**
 * Build API URL with query parameters
 */
function buildApiUrl(baseUrl, path, query = {}) {
  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Full URL
  let url = `${baseUrl}${path}`;
  
  // Add query string if present
  if (Object.keys(query).length > 0) {
    const queryStr = querystring.stringify(query);
    url += `?${queryStr}`;
  }
  
  return url;
}

/**
 * Generate authorization headers
 */
function buildAuthHeaders(method, path, query = {}, date = new Date()) {
  // Format date as UTC string
  const dateString = date.toUTCString();
  
  // Build query string
  const queryKeys = Object.keys(query).sort();
  const queryParts = queryKeys.map(key => 
    `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
  );
  const queryString = queryParts.join('&');
  
  // Path with query string
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  // Method must be lowercase for the signature
  const lowerMethod = method.toLowerCase();
  
  // Format the string that will be used for signing
  // IMPORTANT: Format matters! Each part must be on its own line
  const stringToSign = `${lowerMethod}\n${fullPath.toLowerCase()}\n${dateString.toLowerCase()}`;
  
  // Create HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Random nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Auth headers
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': dateString,
    'On-Nonce': nonce,
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
}

/**
 * Make API request with alternative auth format
 */
async function makeRequest(method, path, query = {}, data = null) {
  try {
    console.log(`\n-------- ${method} ${path} --------`);
    
    // Build URL
    const url = buildApiUrl(BASE_URL, path, query);
    console.log('URL:', url);
    
    // Get auth headers
    const headers = buildAuthHeaders(method, path, query);
    console.log('Auth Headers:', JSON.stringify(headers, null, 2));
    
    // Add content length for POST requests
    if (data && (method === 'POST' || method === 'PUT')) {
      const contentBody = JSON.stringify(data);
      headers['Content-Length'] = Buffer.byteLength(contentBody);
      console.log('Content Length:', headers['Content-Length']);
    }
    
    // Log request details
    console.log('Method:', method);
    console.log('Data:', data);
    
    // Make request
    const response = await axios({
      method,
      url,
      headers,
      data
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status || error.message}`);
    console.error('Message:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test different API endpoints
 */
async function testEndpoints() {
  // Test user info
  console.log('Testing session info (should work)');
  const userInfo = await makeRequest('GET', '/users/sessioninfo');
  
  // Test document creation with public flag
  console.log('\nTesting document creation with public flag');
  const newDoc = await makeRequest('POST', '/documents', {}, {
    name: 'Public Test Document',
    isPublic: true // Required for free accounts
  });
  
  // Summary
  console.log('\n-------- RESULTS --------');
  console.log('Session info:', userInfo ? 'Success' : 'Failed');
  console.log('Document creation:', newDoc ? 'Success' : 'Failed');
  
  // If document creation worked, clean up
  if (newDoc && newDoc.id) {
    console.log(`\nCleaning up document: ${newDoc.id}`);
    await makeRequest('DELETE', `/documents/${newDoc.id}`);
  }
}

// Run the tests
testEndpoints();