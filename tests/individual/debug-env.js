/**
 * Debug script to verify .env file loading
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('Debug .env file loading:');

// Check if .env file exists
const envPath = path.resolve(__dirname, '../.env');
console.log('Looking for .env file at:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

// Try to read .env file contents (length only for security)
try {
  const envFileContent = fs.readFileSync(envPath, 'utf8');
  console.log('.env file size:', envFileContent.length, 'bytes');
  console.log('.env file first line:', envFileContent.split('\n')[0].substring(0, 20) + '...');
} catch (err) {
  console.log('Error reading .env file:', err.message);
}

// Try to load with dotenv
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.log('Error loading with dotenv:', result.error.message);
} else {
  console.log('dotenv loaded successfully');
}

// Check environment variables
console.log('ONSHAPE_ACCESS_KEY exists:', !!process.env.ONSHAPE_ACCESS_KEY);
console.log('ONSHAPE_SECRET_KEY exists:', !!process.env.ONSHAPE_SECRET_KEY);