/**
 * Comprehensive Onshape API debugging tool
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('ERROR: Missing API credentials in .env file');
  process.exit(1);
}

// Save debug info to file for comparison
function saveDebugInfo(filename, data) {
  const debugDir = path.join(__dirname, 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir);
  }
  
  fs.writeFileSync(
    path.join(debugDir, filename), 
    typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  );
  console.log(`Saved debug info to ${filename}`);
}

/**
 * Make an authenticated request using the original method
 */
async function originalRequest(method, path, options = {}) {
  const { query = {}, body = null } = options;
  
  // Current date
  const date = new Date();
  const dateString = date.toUTCString();
  
  // Build query string
  const queryString = Object.keys(query)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');
  
  // Clean path
  let cleanPath = path;
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Format path with query
  const encodedPath = queryString ? `${cleanPath}?${queryString}` : cleanPath;
  
  // Original string to sign with newlines
  const stringToSign = method.toLowerCase() + '\n' + 
                     encodedPath.toLowerCase() + '\n' + 
                     dateString.toLowerCase();
  
  console.log('\nORIGINAL METHOD');
  console.log('String to sign:');
  console.log('-----------------------------------');
  console.log(stringToSign);
  console.log('-----------------------------------');
  
  saveDebugInfo(`original-${method}-${path.replace(/\//g, '-')}.txt`, stringToSign);
  
  // Generate signature
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
  
  saveDebugInfo(`original-headers-${method}-${path.replace(/\//g, '-')}.json`, headers);
  
  try {
    // Construct full URL
    const url = `${BASE_URL}${encodedPath}`;
    
    console.log(`Making ${method} request to: ${url}`);
    
    // Make request
    const response = await axios({
      method,
      url,
      headers,
      data: body
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return { 
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'unknown'}`);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return { 
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Make an authenticated request using a different method
 */
async function alternativeRequest(method, path, options = {}) {
  const { query = {}, body = null } = options;
  
  // Ensure method is uppercase for the request but lowercase for signing
  const upperMethod = method.toUpperCase();
  const lowerMethod = method.toLowerCase();
  
  // Current date for the request
  const date = new Date();
  const dateString = date.toUTCString();
  
  // Prepare path - must start with /
  let cleanPath = path;
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Prepare query string - must be sorted alphabetically
  let queryString = '';
  if (Object.keys(query).length > 0) {
    queryString = Object.keys(query)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join('&');
  }
  
  // Build URL path with query string
  const urlPath = queryString ? `${cleanPath}?${queryString}` : cleanPath;
  
  // Alternative string to sign - explicit array join instead of newlines
  const stringToSign = [
    lowerMethod,
    urlPath.toLowerCase(),
    dateString.toLowerCase()
  ].join('\n');
  
  console.log('\nALTERNATIVE METHOD');
  console.log('String to sign:');
  console.log('-----------------------------------');
  console.log(stringToSign);
  console.log('-----------------------------------');
  
  saveDebugInfo(`alternative-${method}-${path.replace(/\//g, '-')}.txt`, stringToSign);
  
  // Generate signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Create request headers 
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': dateString,
    'On-Nonce': crypto.randomBytes(16).toString('base64'),
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
  
  saveDebugInfo(`alternative-headers-${method}-${path.replace(/\//g, '-')}.json`, headers);
  
  try {
    // Full URL with base path
    const url = `${BASE_URL}${urlPath}`;
    
    console.log(`Making ${upperMethod} request to: ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    // Make HTTP request
    const response = await axios({
      method: upperMethod,
      url,
      headers,
      data: body
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return { 
      success: true, 
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'unknown'}`);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return { 
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Test specific endpoints with both methods
 */
async function testEndpoints() {
  console.log('==================================================');
  console.log('ONSHAPE API DEBUG TESTS');
  console.log('==================================================');
  console.log(`Access Key: ${ACCESS_KEY}`);
  
  // Test /users/sessioninfo endpoint (which works)
  console.log('\n----------- SESSION INFO -----------');
  console.log('\nTesting GET /users/sessioninfo');
  
  const sessionInfoOriginal = await originalRequest('GET', '/users/sessioninfo');
  const sessionInfoAlternative = await alternativeRequest('GET', '/users/sessioninfo');
  
  // Test /documents endpoint (which fails)
  console.log('\n----------- DOCUMENTS -----------');
  console.log('\nTesting GET /documents');
  
  const documentsOriginal = await originalRequest('GET', '/documents');
  const documentsAlternative = await alternativeRequest('GET', '/documents');
  
  // Show results
  console.log('\n==================================================');
  console.log('RESULTS SUMMARY');
  console.log('==================================================');
  console.log('SESSION INFO (Original):', sessionInfoOriginal.success ? '✅' : '❌');
  console.log('SESSION INFO (Alternative):', sessionInfoAlternative.success ? '✅' : '❌');
  console.log('DOCUMENTS (Original):', documentsOriginal.success ? '✅' : '❌');
  console.log('DOCUMENTS (Alternative):', documentsAlternative.success ? '✅' : '❌');
  
  // Check if this is an API key permissions issue
  if (sessionInfoOriginal.success && !documentsOriginal.success &&
      sessionInfoAlternative.success && !documentsAlternative.success) {
    console.log('\n⚠️ PROBABLE API KEY PERMISSION ISSUE ⚠️');
    console.log('Your API key can access /users/sessioninfo but not /documents');
    console.log('This suggests your API key does not have sufficient permissions.');
    console.log('\nPlease verify in the Onshape Developer Portal that your API key:');
    console.log('1. Has the OAuth2Read scope');
    console.log('2. Has the OAuth2Write scope for document creation');
    console.log('3. Is still active and not expired');
    console.log('4. Try generating a new API key with all required scopes');
  }
}

// Run the tests
testEndpoints();