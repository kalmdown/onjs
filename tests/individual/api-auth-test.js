/**
 * Test script for Onshape API authentication
 */
require('dotenv').config();
const RestApi = require('../src/api/rest-api');

// Check if credentials are available
if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
  console.error('ERROR: Missing API credentials');
  console.error('Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY in .env file');
  process.exit(1);
}

console.log('Testing Onshape API authentication...');

// Initialize API client
const api = new RestApi({
  accessKey: process.env.ONSHAPE_ACCESS_KEY,
  secretKey: process.env.ONSHAPE_SECRET_KEY
});

console.log('API client initialized');
console.log(`Using access key: ${process.env.ONSHAPE_ACCESS_KEY.substring(0, 4)}...`);

// Test authentication with a simple API call
async function testAuthentication() {
  try {
    console.log('Making API request to get user info...');
    const response = await api.get('/users/sessioninfo');
    
    console.log('✅ Authentication successful!');
    console.log('Full response:');
    console.log(JSON.stringify(response, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    if (error.originalError && error.originalError.response) {
      console.error('Status:', error.originalError.response.status);
      console.error('Response:', error.originalError.response.data);
    }
    return false;
  }
}

// Test document creation
async function testDocumentCreation() {
  try {
    console.log('\nTesting document creation...');
    const response = await api.post('/documents', {
      name: 'API Test Document',
      isPublic: false
    });
    
    console.log('✅ Document created successfully!');
    console.log('Document ID:', response.id);
    console.log('Document name:', response.name);
    
    return response.id;
  } catch (error) {
    console.error('❌ Document creation failed:', error.message);
    return null;
  }
}

// Test document deletion
async function testDocumentDeletion(documentId) {
  if (!documentId) return;
  
  try {
    console.log('\nCleaning up test document...');
    await api.delete(`/documents/${documentId}`);
    console.log('✅ Document deleted successfully!');
  } catch (error) {
    console.error('❌ Document deletion failed:', error.message);
  }
}

// Run tests
async function runTests() {
  const authSuccess = await testAuthentication();
  
  if (authSuccess) {
    const documentId = await testDocumentCreation();
    await testDocumentDeletion(documentId);
  } else {
    console.log('\nDebugging tips:');
    console.log('1. Check your API keys for typos');
    console.log('2. Make sure your API keys are active and have proper permissions');
    console.log('3. Check network connectivity to Onshape API');
    console.log('4. Try regenerating your API keys in the Onshape developer portal');
  }
}

runTests();