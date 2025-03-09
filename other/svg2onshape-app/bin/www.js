#!/usr/bin/env node

// Import dotenv for environment variables
import dotenv from 'dotenv';
dotenv.config();
console.log('Callback URL:', process.env.OAUTH_CALLBACK_URL);

// Import core modules
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import application modules
import app from '../app.js';
import { port, httpsOptions } from '../config.js';

// Import debug utility
import { debugLog } from '../utils/debug.js';

// Set up HTTPS options - either from config or from local files
const options = httpsOptions || {
  key: fs.readFileSync(path.join(__dirname, '..', 'certificates', 'private.key')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certificates', 'certificate.pem'))
};

// Use port from config or default to 3000
const serverPort = port || 3000;

// Create HTTPS server
const server = https.createServer(options, app)
  .listen(serverPort, () => {
    debugLog('env', 'Starting server');
    console.log(`Server running on https://localhost:${serverPort}`);
  });

// Add graceful shutdown handler
process.on('SIGTERM', () => {
  debugLog('env', 'SIGTERM signal received: closing HTTP server');
  server.close(() => {
    debugLog('env', 'HTTP server closed');
    process.exit(0);
  });
});
