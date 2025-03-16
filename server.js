// server.js - Main application entry point

require('./load-env'); // Add this at the top

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const config = require('./config/index');
const AuthManager = require('./src/auth/auth-manager');
const authMiddleware = require('./src/middleware/authMiddleware');
const logger = require('./src/utils/logger');
const { configureOAuth } = require('./src/middleware/authMiddleware');
const errorMiddleware = require('./src/middleware/error');

// Import route modules
const authRoutes = require('./src/routes/authRoutes');
const documentRoutes = require('./src/routes/documents');
const elementRoutes = require('./src/routes/elements');
const featureRoutes = require('./src/routes/features');
const exampleRoutes = require('./src/routes/examples');

// Configure logger based on environment
if (process.env.NODE_ENV === 'production') {
  logger.logLevel = 'info';
} else {
  logger.logLevel = 'debug';
}

// Create a global logger instance
const log = logger.scope('Server');

// Create and configure the AuthManager
const authManager = new AuthManager({
  baseUrl: config.onshape.baseUrl,
  accessKey: process.env.ONSHAPE_ACCESS_KEY,
  secretKey: process.env.ONSHAPE_SECRET_KEY,
  clientId: config.onshape.clientId,
  clientSecret: config.onshape.clientSecret,
  redirectUri: config.onshape.callbackUrl
});

log.info('Auth manager initialized with:', {
  method: authManager.getMethod(),
  hasOAuthCredentials: !!(config.onshape.clientId && config.onshape.clientSecret),
  hasApiKeys: !!(authManager.accessKey && authManager.secretKey),
  callbackUrl: config.onshape.callbackUrl
});

// Test auth config loading
log.info('OAuth configuration loaded from env:', {
  clientId: config.onshape.clientId ? 'Set (masked)' : 'Not set',
  clientSecret: config.onshape.clientSecret ? 'Set (masked)' : 'Not set',
  callbackUrl: config.onshape.callbackUrl,
  authUrl: config.onshape.authorizationURL,
  tokenUrl: config.onshape.tokenURL
});

// Configure fallback authentication if needed
if (!authManager.getMethod()) {
  // Use API key as fallback if available
  if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
    authManager.accessKey = process.env.ONSHAPE_ACCESS_KEY;
    authManager.secretKey = process.env.ONSHAPE_SECRET_KEY;
    authManager.setMethod('apikey');
    log.info('Using API key authentication as fallback');
  }
}

// Initialize Express app
const app = express();

// Store authManager in app context for middleware access
app.set('authManager', authManager);

// Basic request logger with origin information for CORS debugging
app.use((req, res, next) => {
  log.debug(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// Configure middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// In server.js, update session configuration
app.use(session({
  secret: config.session.secret || 'onshape-app-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure OAuth
configureOAuth(authManager);

// Mount routes
app.use('/oauth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/elements', elementRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/examples', exampleRoutes);

// Basic routes
app.get('/api/auth/status', (req, res) => {
  // Get the auth manager
  const authManager = req.app.get('authManager');
  const authMethod = authManager.getMethod();
  
  // For API key auth, check if we have the keys
  const apiKeyAuthenticated = 
    authMethod === 'apikey' && 
    Boolean(authManager?.accessKey) && 
    Boolean(authManager?.secretKey);
    
  // Consider authenticated if either using OAuth with valid token
  // or using API key with valid credentials
  const isAuthenticated = 
    (req.isAuthenticated && req.isAuthenticated()) || 
    (req.session && !!req.session.oauthToken) ||
    (authMethod === 'apikey' && apiKeyAuthenticated);
  
  res.json({ 
    authenticated: Boolean(isAuthenticated),
    method: authMethod || 'none'
  });
});

// In server.js, after mounting your auth routes
app.get('/api/auth/method', (req, res) => {
  const authManager = req.app.get('authManager');
  res.json({
    method: authManager.getMethod(),
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false
  });
});

// Add this with the other API routes (after the /api/auth/method endpoint)

// Debug endpoint to verify token state across different sources
app.get('/api/auth/token-debug', (req, res) => {
  // Check session
  const sessionToken = req.session?.oauthToken;
  // Check passport user
  const passportToken = req.user?.accessToken;
  // Check auth manager
  const authManager = req.app.get('authManager');
  const managerToken = authManager?.accessToken;
  const authMethod = authManager?.getMethod();
  
  // For API key auth, we're authenticated if the manager has an API key
  const apiKeyAuthenticated = 
    authMethod === 'apikey' && 
    Boolean(authManager?.accessKey) && 
    Boolean(authManager?.secretKey);
  
  // Consider authenticated if either:
  // 1. Using OAuth and have a valid token
  // 2. Using API key and have valid API key credentials
  const isAuthenticated = 
    (req.isAuthenticated && req.isAuthenticated()) || 
    (authMethod === 'apikey' && apiKeyAuthenticated);
  
  res.json({
    authenticated: Boolean(isAuthenticated),
    authMethod: authMethod || 'none',
    hasSessionToken: !!sessionToken,
    sessionTokenLength: sessionToken ? sessionToken.length : 0,
    hasPassportToken: !!passportToken,
    passportTokenLength: passportToken ? passportToken.length : 0,
    hasManagerToken: !!managerToken,
    managerTokenLength: managerToken ? managerToken.length : 0,
    // API key specific info (only showing presence, not the actual keys)
    hasApiKey: authMethod === 'apikey' && !!authManager?.accessKey,
    apiKeyAuthenticated: Boolean(apiKeyAuthenticated),
    // Only show token fragments for security
    tokenFirstChars: managerToken ? managerToken.substring(0, 5) + '...' : null,
    tokenLastChars: managerToken ? '...' + managerToken.substring(managerToken.length - 5) : null,
  });
});

// Endpoint to receive client-side logs
app.post('/api/logs', (req, res) => {
  const { level, message, source, stack } = req.body;
  
  // Map client log levels to server log levels
  switch (level) {
    case 'error':
      log.error(`[Browser] ${message}`, { source, stack });
      break;
    case 'warn':
      log.warn(`[Browser] ${message}`, { source });
      break;
    case 'info':
      log.info(`[Browser] ${message}`, { source });
      break;
    case 'debug':
    default:
      log.debug(`[Browser] ${message}`, { source });
      break;
  }
  
  res.status(200).end();
});

// Webhooks endpoint
app.post('/api/webhooks', (req, res) => {
  log.info('Webhook received:', req.body);
  res.status(200).end();
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/oauth/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug authentication status on every request
app.use((req, res, next) => {
  if (req.path === '/oauth/login') {
    const authManager = req.app.get('authManager');
    log.debug(`Auth request via ${req.path}, method: ${authManager.getMethod()}`);
    log.debug(`Auth credentials: OAuth=${!!config.onshape.clientId}, APIKey=${!!process.env.ONSHAPE_ACCESS_KEY}`);
  }
  next();
});

// Add this diagnostic route after your other API routes
// Test route to verify API key authentication
app.get('/api/auth/test', async (req, res) => {
  const log = logger.scope('AuthTest');
  
  try {
    // Get auth manager
    const authManager = req.app.get('authManager');
    if (!authManager) {
      return res.status(500).json({ 
        success: false, 
        error: 'Auth manager not found in app context' 
      });
    }
    
    // Get auth method and client
    const authMethod = authManager.getMethod();
    log.info(`Testing authentication with method: ${authMethod}`);
    
    // Create client using authMiddleware helper
    const { createClientFromRequest } = require('./src/middleware/authMiddleware');
    const { OnshapeClient } = require('./src/api/client');
    
    const client = createClientFromRequest(req, OnshapeClient);
    if (!client) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create Onshape client' 
      });
    }
    
    // Test auth by making a simple API call
    log.info('Making test API call to Onshape');
    const result = await client.api.get('/users/sessioninfo');
    
    // If we get here, the authentication worked
    log.info('Authentication test successful');
    
    return res.json({
      success: true,
      method: authMethod,
      response: result
    });
  } catch (error) {
    // Log detailed error information
    log.error(`Authentication test failed: ${error.message}`);
    
    // Get as much error information as possible
    const errorDetails = {
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : undefined
    };
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: errorDetails
    });
  }
});

// Add a request and response logger middleware before your existing error handlers
// This will help identify what's happening with API requests
app.use((req, res, next) => {
  // Only log API requests
  if (req.path.startsWith('/api/')) {
    const authManager = req.app.get('authManager');
    const authMethod = authManager ? authManager.getMethod() : 'none';
    const requestId = crypto.randomBytes(4).toString('hex');
    
    // Log the request
    logger.debug(`[${requestId}] ${req.method} ${req.path}`, {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      authMethod,
      contentType: req.get('Content-Type'),
      userAgent: req.get('User-Agent')
    });
    
    // Track response time
    const startTime = Date.now();
    
    // Capture and log the response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log based on status code
      const logMethod = res.statusCode >= 400 ? 'error' : 'debug';
      logger[logMethod](`[${requestId}] ${res.statusCode} ${req.method} ${req.path} (${responseTime}ms)`, {
        statusCode: res.statusCode,
        responseTime,
        authMethod
      });
      
      // Call the original end method
      return originalEnd.apply(this, arguments);
    };
  }
  
  next();
});

// Error handling middleware
app.use(errorMiddleware);

// Start server
const port = config.port;
app.listen(port, () => {
  log.info(`Server running at http://localhost:${port}`);
  
  // Log auth state
  const authMethod = authManager.getMethod();
  if (authMethod) {
    log.info(`Authentication method: ${authMethod}`);
  } else {
    log.warn('No authentication method configured');
  }
});