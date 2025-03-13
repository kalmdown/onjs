// Load environment variables with absolute path
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
// Replace direct import with unified interface
const { createAuth } = require('../../src/auth');

describe('Authentication Logic (OnPy Compatible & Fixed Auth)', () => {
  let auth;
  
  beforeAll(() => {
    // Debug environment variables
    console.log('Environment check for auth-logic test:');
    console.log('- ACCESS_KEY available:', !!process.env.ONSHAPE_ACCESS_KEY);
    console.log('- SECRET_KEY available:', !!process.env.ONSHAPE_SECRET_KEY);
    console.log('- AUTH_METHOD:', process.env.ONSHAPE_AUTH_METHOD);
    
    // Use createAuth instead of direct AuthManager instantiation
    auth = createAuth({
      authType: 'api_key',
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY,
      accessToken: process.env.OAUTH_CLIENT_SECRET, // Note: This seems to be a mistake in original code
    });
  });

  describe('GET request (no body)', () => {
    it('should return headers with required properties and no Content-MD5', () => {
      const headers = auth.getAuthHeaders('GET', '/api/documents', { limit: 20 });
      
      // Check returned headers
      expect(headers).toBeDefined();
      expect(headers.Date).toBeDefined();
      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization).toMatch(/^On .*$/);
      expect(headers['Content-MD5']).toBeUndefined();
    });
  });

  describe('POST request with a body', () => {
    it('should return headers with Content-MD5 along with other required properties', () => {
      const body = JSON.stringify({ name: 'Test Document' });
      const headers = auth.getAuthHeaders('POST', '/api/documents', {}, body);
      
      // Check returned headers
      expect(headers).toBeDefined();
      expect(headers.Date).toBeDefined();
      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization).toMatch(/^On .*$/);
      expect(headers['Content-MD5']).toBeDefined();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});