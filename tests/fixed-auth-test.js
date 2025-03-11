/**
 * Onshape API test with fixed authentication
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

/**
 * Make an authenticated request to Onshape API
 */
async function onshapeRequest(method, path, options = {}) {
  const { query = {}, body = null } = options;
  
  // Current date - crucial for authentication
  const date = new Date();
  const dateString = date.toUTCString();
  
  // Build query string EXACTLY to Onshape specs
  const queryKeys = Object.keys(query).sort();
  const queryString = queryKeys.length > 0 
    ? queryKeys
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
        .join('&')
    : '';
    
  // Important: Path must NOT start with the baseUrl
  // It should be just the API path starting with /
  let cleanPath = path;
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Format the path and query for the string to sign
  const encodedPath = queryString ? `${cleanPath}?${queryString}` : cleanPath;
  
  // Build the string to sign - precisely formatted as Onshape expects
  const stringToSign = [
    method.toLowerCase(),
    encodedPath.toLowerCase(),
    dateString.toLowerCase()
  ].join('\n');
  
  console.log('\nString to sign:');
  console.log('-----------------------------------');
  console.log(stringToSign);
  console.log('-----------------------------------');
  
  // Generate the signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Create headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': dateString,
    'On-Nonce': crypto.randomBytes(16).toString('base64'),
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
  
  try {
    // Construct the full URL
    const url = `${BASE_URL}${cleanPath}${queryString ? '?' + queryString : ''}`;
    console.log(`Making ${method} request to: ${url}`);
    
    // Make the request
    const response = await axios({
      method,
      url,
      headers,
      data: body
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'unknown'}`);
    console.error('Error message:', error.response?.data?.message || error.message);
    throw error;
  }
}

/**
 * Run tests against different API endpoints
 */
async function runTests() {
  try {
    console.log('1. Testing GET /users/sessioninfo');
    const userInfo = await onshapeRequest('GET', '/users/sessioninfo');
    console.log('User info response:', userInfo);
    
    console.log('\n2. Testing GET /documents');
    const documents = await onshapeRequest('GET', '/documents');
    console.log(`Found ${documents.items?.length || 0} documents`);
    
    console.log('\n3. Testing POST /documents');
    const newDoc = await onshapeRequest('POST', '/documents', {
      body: { name: 'Fixed Auth Test Document' }
    });
    console.log('Document created:', newDoc.name, newDoc.id);
    
    if (newDoc.id) {
      console.log('\n4. Testing DELETE /documents');
      await onshapeRequest('DELETE', `/documents/${newDoc.id}`);
      console.log('Document deleted successfully');
    }
    
    console.log('\nAll tests passed!');
  } catch (error) {
    console.error('Tests failed:', error.message);
  }
}

runTests();