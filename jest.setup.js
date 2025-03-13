require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize logger properly
if (!logger.logDir) {
  logger.logDir = logsDir;
}

// Ensure buffer is initialized
if (!logger.buffer) {
  logger.buffer = [];
}

// Flush logs after all tests complete
afterAll(() => {
  logger.flush({
    toConsole: true,
    toFile: true,
    filename: 'integration-test-logs.log'
  });
}, 500); // Higher priority to ensure it runs last