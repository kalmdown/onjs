/**
 * Direct API integration test - bypasses the regular client structure
 */
require('dotenv').config();
const SimpleRestApi = require('../src/api/simple-rest-api');

async function runDirectTest() {
  console.log('Starting direct API test...');
  
  // Check for credentials
  if (!process.env.ONSHAPE_ACCESS_KEY || !process.env.ONSHAPE_SECRET_KEY) {
    console.error('Missing credentials in .env file');
    return;
  }
  
  // Create API client
  const api = new SimpleRestApi({
    accessKey: process.env.ONSHAPE_ACCESS_KEY,
    secretKey: process.env.ONSHAPE_SECRET_KEY
  });
  
  try {
    // Test authentication
    console.log('Testing user info...');
    const userInfo = await api.get('/users/sessioninfo');
    console.log('✅ User info retrieved successfully');
    console.log(userInfo);
    
    // Create document
    console.log('\nCreating test document...');
    const doc = await api.post('/documents', { name: 'Direct API Test Document' });
    console.log('✅ Document created successfully');
    console.log('Document ID:', doc.id);
    console.log('Document name:', doc.name);
    
    // Clean up
    console.log('\nDeleting test document...');
    await api.delete(`/documents/${doc.id}`);
    console.log('✅ Document deleted successfully');
    
    console.log('\nAll tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runDirectTest();