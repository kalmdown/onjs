// Load environment variables with absolute path
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
// Replace direct import with unified interface
const { createAuth } = require('../../src/auth');
const SimpleRestApi = require('../../src/api/simple-rest-api');

describe('Authentication Debugging', () => {
  let api;
  let debugLogPath;
  
  // Debug environment variables first
  beforeAll(() => {
    console.log('DEBUG: Environment variables check');
    console.log('ACCESS_KEY available:', !!process.env.ONSHAPE_ACCESS_KEY);
    console.log('SECRET_KEY available:', !!process.env.ONSHAPE_SECRET_KEY);
    console.log('AUTH_METHOD:', process.env.ONSHAPE_AUTH_METHOD);
    
    // Check if .env file exists and is readable
    const envPath = path.resolve(__dirname, '..', '.env');
    console.log('.env file exists:', fs.existsSync(envPath));
    if (fs.existsSync(envPath)) {
      console.log('.env file content (first few lines):');
      const envContent = fs.readFileSync(envPath, 'utf8').split('\n').slice(0, 5).join('\n');
      console.log(envContent);
    }
    
    debugLogPath = path.join(__dirname, '..', 'logs', 'auth-debug.log');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Clear previous debug log
    if (fs.existsSync(debugLogPath)) {
      fs.writeFileSync(debugLogPath, '');
    }
    
    // Use hardcoded credentials for test if environment variables not available
    const accessKey = process.env.ONSHAPE_ACCESS_KEY || 'vHVlHgBD3cXYlZUbNsOK1Yzy';
    const secretKey = process.env.ONSHAPE_SECRET_KEY || 'YGq5H4POIX0KZVmrRp5CLsyeFODW95nqS4xfjjwWitfPfJGC';
    
    console.log('Using access key:', accessKey.substring(0, 5) + '...');
    
    api = new SimpleRestApi({
      authType: 'api_key',
      accessKey: accessKey,
      secretKey: secretKey,
      baseUrl: process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6',
      debug: true
    });
  });
  
  test('simple GET request with detailed logging', async () => {
    try {
      // Make a simple request that should work
      const result = await api.request('get', '/users/sessioninfo');
      console.log('Success!', result);
      expect(result).toBeDefined();
    } catch (err) {
      console.error('Request failed', err.message);
      
      // Update auth headers generation
      const auth = createAuth({
        authType: 'api_key',
        accessKey: process.env.ONSHAPE_ACCESS_KEY || 'vHVlHgBD3cXYlZUbNsOK1Yzy',
        secretKey: process.env.ONSHAPE_SECRET_KEY || 'YGq5H4POIX0KZVmrRp5CLsyeFODW95nqS4xfjjwWitfPfJGC'
      });
      
      const authHeaders = auth.getAuthHeaders(
        'GET', 
        '/users/sessioninfo',
        {}
      );
      console.log('Auth Headers:', JSON.stringify(authHeaders, null, 2));
      throw err;
    }
  });
});