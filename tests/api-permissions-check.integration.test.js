require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

describe('Onshape API Permissions Check', () => {
  const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY;
  const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY;
  const BASE_URL = process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v6';
  
  function generateAuthHeaders(method, path) {
    const date = new Date().toUTCString();
    const nonce = crypto.randomBytes(16).toString('base64');
    const contentType = 'application/json';

    // String to sign
    const stringToSign = [
      method.toUpperCase(),
      '',  // empty contentMd5
      contentType,
      date,
      nonce,
      path
    ].join('\n');

    // Generate signature
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    return {
      'Content-Type': contentType,
      'Accept': 'application/json',
      'Date': date,
      'On-Nonce': nonce,
      'Authorization': `On ${ACCESS_KEY}:${signature}`
    };
  }
  
  test('API key should have OAuth2Read permission', async () => {
    const headers = generateAuthHeaders('GET', '/users/sessioninfo');
    
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/users/sessioninfo`,
      headers
    });
    
    expect(response.status).toBe(200);
    console.log('User info successfully retrieved');
    
    // Check for OAuth scopes in response
    if (response.data.oauth2Scopes) {
      const scopes = Array.isArray(response.data.oauth2Scopes) 
        ? response.data.oauth2Scopes.join(' ')
        : response.data.oauth2Scopes.toString();
        
      console.log('API Key Scopes:', scopes);
      
      const hasReadScope = scopes.includes('OAuth2Read');
      const hasWriteScope = scopes.includes('OAuth2Write');
      
      console.log('Has OAuth2Read:', hasReadScope);
      console.log('Has OAuth2Write:', hasWriteScope);
      
      if (!hasReadScope || !hasWriteScope) {
        console.error('⚠️ Missing required scopes. Please update your API key in the Onshape Developer Portal');
      }
    }
  });
});