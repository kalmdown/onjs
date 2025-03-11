/**
 * Detailed authentication debugging script
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

/**
 * Make a raw API request with detailed logging
 */
async function makeRawRequest(method, path, data = null) {
  console.log(`\n----------- ${method} ${path} -----------`);
  
  try {
    // Current date in RFC format
    const date = new Date().toUTCString();
    console.log('Date:', date);
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // The string to sign with exact format
    const stringToSign = [
      method.toLowerCase(),
      path.toLowerCase(),
      date.toLowerCase()
    ].join('\n');
    
    console.log('\nString to sign (JSON escaped):');
    console.log(JSON.stringify(stringToSign));
    
    console.log('\nString to sign (raw):');
    console.log(stringToSign);
    
    // Generate signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');
    console.log('\nSignature:', signature);
    
    // Random nonce
    const nonce = crypto.randomBytes(16).toString('base64');
    console.log('Nonce:', nonce);
    
    // Create headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Date': date,
      'On-Nonce': nonce,
      'Authorization': `On ${ACCESS_KEY}:${signature}`
    };
    
    console.log('\nFull headers:');
    console.log(headers);
    
    // Full URL
    const url = `${BASE_URL}${path}`;
    console.log('\nFull URL:', url);
    
    // Make request with detailed logging
    console.log('\nMaking request...');
    const response = await axios({
      method,
      url,
      headers,
      data
    });
    
    console.log(`\n✅ Success! Status: ${response.status}`);
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`\n❌ Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    } else {
      console.error('Full error:', error);
    }
    return null;
  }
}

/**
 * Compare authentication for working and non-working endpoints
 */
async function compareEndpoints() {
  console.log('======= COMPARING ENDPOINTS =======');
  
  // Test session info (works)
  const sessionInfo = await makeRawRequest('GET', '/users/sessioninfo');
  
  // Test document creation (fails)
  const docCreation = await makeRawRequest('POST', '/documents', {
    name: 'Test Document',
    isPublic: true
  });
  
  // Compare results
  console.log('\n======= COMPARISON SUMMARY =======');
  console.log('Session info successful:', !!sessionInfo);
  console.log('Document creation successful:', !!docCreation);
}

// Run the test
compareEndpoints();