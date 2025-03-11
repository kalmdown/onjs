/**
 * Test file to check specific API permissions
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// API credentials
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const BASE_URL = 'https://cad.onshape.com/api';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('Missing API credentials in .env file');
  process.exit(1);
}

/**
 * Generate authentication headers
 */
function generateAuthHeaders(method, path, queryParams = {}) {
  const date = new Date();
  const dateString = date.toUTCString();
  
  // Build query string
  const queryString = Object.entries(queryParams)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  // Format path with query
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  // String to sign - critical part for authentication
  const stringToSign = `${method.toLowerCase()}\n${fullPath.toLowerCase()}\n${dateString.toLowerCase()}`;
  
  console.log('String to sign:', stringToSign);
  
  // Create signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  return {
    'Date': dateString,
    'On-Nonce': crypto.randomBytes(16).toString('base64'),
    'Authorization': `On ${ACCESS_KEY}:${signature}`,
    'Content-Type': 'application/json'
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
    const headers = generateAuthHeaders(method, path, queryParams);
    console.log('Auth headers generated');
    
    const url = `${BASE_URL}${path}`;
    console.log('Full URL:', url);
    
    const response = await axios({
      method,
      url,
      headers,
      params: queryParams,
      data
    });
    
    console.log(`✅ Success! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed! Status: ${error.response?.status || 'Unknown'}`);
    console.error('Error message:', error.response?.data?.message || error.message);
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
  console.log(`Using API key: ${ACCESS_KEY.substring(0, 4)}...`);
  
  // Test 1: Get user info (Read access)
  console.log('\n---------- TEST 1: READ USER INFO ----------');
  const userInfo = await makeRequest('GET', '/users/sessioninfo');
  if (userInfo) {
    console.log('User info retrieved successfully');
    console.log('Name:', userInfo.name);
    console.log('Email:', userInfo.email);
    console.log('Plan:', userInfo.plan);
  }
  
  // Test 2: List documents (Read access)
  console.log('\n---------- TEST 2: LIST DOCUMENTS ----------');
  const documents = await makeRequest('GET', '/documents');
  if (documents) {
    console.log(`Found ${documents.length} documents`);
    if (documents.length > 0) {
      console.log('First document:', documents[0].name);
    }
  }
  
  // Test 3: Create document (Write access)
  console.log('\n---------- TEST 3: CREATE DOCUMENT ----------');
  const newDoc = await makeRequest('POST', '/documents', {
    name: 'API Permission Test',
    isPublic: false
  });
  
  // If document creation succeeded, clean up
  if (newDoc && newDoc.id) {
    console.log('Document created successfully:', newDoc.name);
    
    // Test 4: Delete document (Write access)
    console.log('\n---------- TEST 4: DELETE DOCUMENT ----------');
    const deleted = await makeRequest('DELETE', `/documents/${newDoc.id}`);
    if (deleted !== null) {
      console.log('Document deleted successfully');
    }
  }
  
  // Summary
  console.log('\n=============================================');
  console.log('PERMISSIONS SUMMARY');
  console.log('=============================================');
  console.log(`User info access: ${userInfo ? '✅ Yes' : '❌ No'}`);
  console.log(`List documents: ${documents ? '✅ Yes' : '❌ No'}`);
  console.log(`Create documents: ${newDoc ? '✅ Yes' : '❌ No'}`);
  console.log('\nIf any permissions are missing, please update your API key permissions in the Onshape Developer Portal.');
}

checkPermissions();