/**
 * Integration tests designed to work with Free Onshape accounts
 */
require('dotenv').config();
const AuthManager = require('../src/auth/auth-manager');
const SimpleRestApi = require('../src/api/simple-rest-api');
const logger = require('../src/utils/logger');

// Increase timeout for API operations
jest.setTimeout(30000);

// Get auth type from environment
const authType = process.env.ONSHAPE_AUTH_TYPE || 'api_key';

describe('Onshape API with Free Account', () => {
  let auth;
  let api;
  let documentId;
  
  beforeAll(() => {
    // Initialize authentication manager
    auth = new AuthManager({
      authType: authType,
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY,
      oauthToken: process.env.ONSHAPE_OAUTH_TOKEN
    });
    
    // Create API client
    api = new SimpleRestApi({
      authManager: auth,
      baseUrl: process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api'
    });
    
    console.log('Authentication successful');
  });
  
  afterAll(async () => {
    // Clean up - delete test document if it was created
    if (documentId) {
      try {
        await api.delete(`/documents/${documentId}`);
        console.log(`Deleted test document: ${documentId}`);
      } catch (error) {
        console.error(`Failed to delete document: ${error.message}`);
      }
    }
  });
  
  it('can find public documents', async () => {
    const response = await api.get('/documents', { 
      q: 'cube', 
      filter: 'isPublic' 
    });
    
    expect(response).toBeDefined();
    expect(Array.isArray(response.items)).toBe(true);
  });
  
  it('can create and delete public document', async () => {
    const docName = `Test Document ${Date.now()}`;
    const docData = { name: docName, isPublic: true };
    
    const response = await api.post('/documents', docData);
    
    expect(response).toBeDefined();
    expect(response.name).toBe(docName);
    expect(response.id).toBeDefined();
    
    documentId = response.id;
    
    // Delete document
    const deleteResponse = await api.delete(`/documents/${documentId}`);
    expect(deleteResponse).toBeDefined();
    
    // Clear document ID since we deleted it
    documentId = null;
  });
});