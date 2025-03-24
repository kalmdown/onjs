// src/routes/index.js

const env = require('../utils/load-env');

// In your route handler
app.get('/', (req, res) => {
  // Existing code...
  
  // Get logging configuration
  const loggingConfig = env.getLoggingConfig();
  
  // Prepare configuration for client
  const clientLoggingConfig = {
    globalLevel: loggingConfig.GLOBAL.level,
    scopeLevels: {}
  };
  
  // Copy scope levels (excluding GLOBAL which is handled separately)
  Object.entries(loggingConfig).forEach(([scope, config]) => {
    if (scope !== 'GLOBAL' && config.level) {
      clientLoggingConfig.scopeLevels[scope] = config.level;
    }
  });
  
  res.render('index', {
    // Other template variables...
    loggingConfig: JSON.stringify(clientLoggingConfig)
  });
});// src/routes/index.js
