const fs = require('fs');
const path = require('path');

try {
  const key = fs.readFileSync(path.join(__dirname, 'certificates', 'private.key'));
  const cert = fs.readFileSync(path.join(__dirname, 'certificates', 'certificate.pem'));
  console.log('Certificates loaded successfully');
} catch (error) {
  console.error('Error loading certificates:', error);
}