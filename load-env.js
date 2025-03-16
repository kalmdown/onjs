// load-env.js
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Check if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
// In load-env.js, add a more comprehensive check:
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from: ${envPath}`);
  const result = dotenv.config();
  
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Environment variables loaded successfully');
    
    // Check for the authentication method preference
    const authMethod = process.env.ONSHAPE_AUTH_METHOD || 'oauth';
    
    if (authMethod.toLowerCase() === 'api_key' || authMethod.toLowerCase() === 'apikey') {
      // Check for API key credentials
      if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
        console.log('API key credentials present and properly configured');
      } else {
        console.warn('API key authentication selected, but credentials missing. Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY in .env file');
      }
    } else {
      // Default to checking OAuth credentials
      if ((process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET) || 
          (process.env.ONSHAPE_CLIENT_ID && process.env.ONSHAPE_CLIENT_SECRET)) {
        console.log('OAuth credentials present and properly configured');
      } else {
        console.warn('OAuth credentials missing. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET in .env file');
      }
    }
  }
} else {
  console.warn('.env file not found at:', envPath);
}