// load-env.js
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Check if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from: ${envPath}`);
  const result = dotenv.config();
  
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Environment variables loaded successfully');
    console.log('OAuth credentials present:', 
      !!process.env.ONSHAPE_CLIENT_ID && !!process.env.ONSHAPE_CLIENT_SECRET);
  }
} else {
  console.warn('.env file not found at:', envPath);
}