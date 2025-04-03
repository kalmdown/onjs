// src/routes/logs.js

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('ClientLogs');

/**
 * Route for receiving client-side logs and outputting them to the server console
 */
router.post('/', (req, res) => {
  const { timestamp, source, message, level, data } = req.body;
  
  // Log to the server console based on level
  switch(level) {
    case 'error':
      log.error(`[Browser] ${message}`, { source, ...(data || {}) });
      break;
    case 'warn':
      log.warn(`[Browser] ${message}`, { source, ...(data || {}) });
      break;
    case 'info':
      log.info(`[Browser] ${message}`, { source, ...(data || {}) });
      break;
    default:
      log.debug(`[Browser] ${message}`, { source, ...(data || {}) });
  }
  
  // Send success response
  res.status(200).json({ success: true });
});

module.exports = router;// src/routes/logs.js
