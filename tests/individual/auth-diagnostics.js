#!/usr/bin/env node
/**
 * Onshape API Authentication Diagnostic Script
 * 
 * This script tests different authentication methods and provides detailed
 * debugging information to help identify authentication issues.
 * 
 * Usage:
 *   node auth-diagnostic.js [api_key|oauth]
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import OAuth strategy so that Passport is properly configured
require('../src/auth/oauth-strategy');
const passport = require('passport');

// Configuration
const AUTH_TYPE = (process.argv[2] || process.env.ONSHAPE_AUTH_TYPE || 'api_key').toLowerCase();
const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
const OAUTH_TOKEN = process.env.ONSHAPE_OAUTH_TOKEN;
const BASE_URL = 'https://cad.onshape.com/api';

// Create output directory
const outputDir = path.join(__dirname, 'auth-diagnostic-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Save diagnostic information to file
 */
function saveToFile(filename, data) {
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(
    filePath,
    typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  );
  console.log(`Saved diagnostic info to ${filename}`);
  return filePath;
}

/**
 * Log section header
 */
function logSection(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(70)}`);
}

/**
 * Log the registered OAuth strategy details (if available)
 */
function logOAuthStrategyInfo() {
  const strategy = passport._strategy('onshape-oauth');
  if (strategy) {
    console.log('\nRegistered OAuth Strategy Info:');
    console.log('Name:', strategy.name);
    console.log('Client ID:', strategy._oauth2._clientId);
    console.log('Callback URL:', strategy._callbackURL);
    console.log('Scope:', strategy._scope ? strategy._scope.join(' ') : 'None');
    // Save strategy info for diagnosis
    saveToFile('oauth-strategy-info.json', {
      name: strategy.name,
      clientId: strategy._oauth2._clientId,
      callbackURL: strategy._callbackURL,
      scope: strategy._scope
    });
  } else {
    console.warn('No OAuth strategy registered under "onshape-oauth"');
  }
}

/**
 * Run system checks
 */
async function runSystemChecks() {
  logSection('SYSTEM INFO');
  
  // Node version
  console.log('Node.js version:', process.version);
  
  // OS info
  console.log('Operating System:', process.platform, process.arch);
  
  // Environment variables
  console.log('Auth Type:', AUTH_TYPE);
  console.log('Access Key Present:', !!ACCESS_KEY);
  console.log('Secret Key Present:', !!SECRET_KEY);
  console.log('OAuth Token Present:', !!OAUTH_TOKEN);
  
  // Run npm ls to check package versions
  try {
    console.log('\nInstalled packages:');
    const npmLs = execSync('npm ls --depth=0').toString().trim();
    console.log(npmLs);
    saveToFile('npm-packages.txt', npmLs);
  } catch (error) {
    console.error('Error checking npm packages:', error.message);
  }
  
  // Check for required credentials
  if (AUTH_TYPE === 'api_key' && (!ACCESS_KEY || !SECRET_KEY)) {
    console.error('ERROR: API Key authentication requires ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
    process.exit(1);
  }
  
  if (AUTH_TYPE === 'oauth' && !OAUTH_TOKEN) {
    console.error('ERROR: OAuth authentication requires ONSHAPE_OAUTH_TOKEN environment variable');
    process.exit(1);
  }
  
  // Log OAuth strategy details (if OAuth)
  if (AUTH_TYPE === 'oauth') {
    logOAuthStrategyInfo();
  }
}

/**
 * Test API Key authentication
 */
async function testApiKeyAuth() {
  logSection('API KEY AUTHENTICATION TEST');
  
  // Date in RFC format - critical for authentication
  const date = new Date().toUTCString();
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Test endpoint
  const method = 'GET';
  const path = '/users/sessioninfo';
  
  // Create the string to sign
  const stringToSign = `${method.toLowerCase()}\n${path}\n${date.toLowerCase()}`;
  
  console.log('String to sign:');
  console.log(stringToSign);
  saveToFile('string-to-sign.txt', stringToSign);
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Create request headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': date,
    'On-Nonce': nonce,
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
  
  saveToFile('request-headers.json', headers);
  
  // Make the request
  try {
    console.log('Making API request...');
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    
    console.log('✅ SUCCESS! Status:', response.status);
    console.log('User Info:', {
      name: response.data.name,
      email: response.data.email,
      plan: response.data.plan
    });
    
    saveToFile('api-key-response.json', response.data);
    return true;
  } catch (error) {
    console.error('❌ FAILED! Status:', error.response?.status || 'Unknown');
    console.error('Error message:', error.response?.data?.message || error.message);
    
    if (error.response) {
      saveToFile('api-key-error.json', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    return false;
  }
}

/**
 * Test OAuth authentication
 */
async function testOAuthAuth() {
  logSection('OAUTH AUTHENTICATION TEST');
  
  // Test endpoint
  const path = '/users/sessioninfo';
  
  // Create request headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OAUTH_TOKEN}`
  };
  
  saveToFile('oauth-headers.json', headers);
  
  // Make the request
  try {
    console.log('Making API request...');
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    
    console.log('✅ SUCCESS! Status:', response.status);
    console.log('User Info:', {
      name: response.data.name,
      email: response.data.email,
      plan: response.data.plan
    });
    
    saveToFile('oauth-response.json', response.data);
    return true;
  } catch (error) {
    console.error('❌ FAILED! Status:', error.response?.status || 'Unknown');
    console.error('Error message:', error.response?.data?.message || error.message);
    
    if (error.response) {
      saveToFile('oauth-error.json', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    return false;
  }
}

/**
 * Test authentication compatible with onpy library
 */
async function testOnpyCompatibleAuth() {
  logSection('ONPY COMPATIBLE AUTHENTICATION TEST');
  
  // Date in RFC format - critical for authentication
  const date = new Date().toUTCString();
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Test endpoint
  const method = 'GET';
  const path = '/users/sessioninfo';
  
  // Create the string to sign - using the format from onpy
  const stringToSign = [
    method.toLowerCase(),
    path,
    date,
    nonce,
    '0',  // Content length
    ''    // Empty body
  ].join('\n');
  
  console.log('Onpy-style string to sign:');
  console.log(stringToSign);
  saveToFile('onpy-string-to-sign.txt', stringToSign);
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  
  // Create request headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Date': date,
    'On-Nonce': nonce,
    'Content-Length': '0',
    'Authorization': `On ${ACCESS_KEY}:${signature}`
  };
  
  saveToFile('onpy-compatible-headers.json', headers);
  
  // Make the request
  try {
    console.log('Making API request...');
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    
    console.log('✅ SUCCESS! Status:', response.status);
    console.log('User Info:', {
      name: response.data.name,
      email: response.data.email,
      plan: response.data.plan
    });
    
    saveToFile('onpy-compatible-response.json', response.data);
    return true;
  } catch (error) {
    console.error('❌ FAILED! Status:', error.response?.status || 'Unknown');
    console.error('Error message:', error.response?.data?.message || error.message);
    
    if (error.response) {
      saveToFile('onpy-compatible-error.json', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Onshape API Authentication Diagnostic');
  console.log(`Authentication type: ${AUTH_TYPE}`);
  
  // Run system checks
  await runSystemChecks();
  
  // Run appropriate authentication test
  let success = false;
  
  if (AUTH_TYPE === 'api_key') {
    // Test standard API key auth
    success = await testApiKeyAuth();
    
    // If standard fails, try onpy compatible auth
    if (!success) {
      console.log('\nStandard API key authentication failed, trying onpy-compatible method...');
      success = await testOnpyCompatibleAuth();
    }
  } else if (AUTH_TYPE === 'oauth') {
    success = await testOAuthAuth();
  } else {
    console.error(`Unsupported authentication type: ${AUTH_TYPE}`);
    process.exit(1);
  }
  
  // Final results
  logSection('DIAGNOSTIC RESULTS');
  console.log(`Authentication ${success ? 'SUCCESSFUL' : 'FAILED'}`);
  console.log(`Authentication type: ${AUTH_TYPE}`);
  
  if (!success) {
    console.log('\nTroubleshooting tips:');
    console.log('1. Verify your API keys or OAuth token are correct and not expired');
    console.log('2. Check if your API keys have the necessary permissions');
    console.log('3. For Free accounts, some operations may be restricted');
    console.log('4. Check your OnShape plan restrictions');
    console.log('5. Try updating to the latest version of the client library');
    console.log('\nDiagnostic information has been saved to:');
    console.log(outputDir);
  }
  
  process.exit(success ? 0 : 1);
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});