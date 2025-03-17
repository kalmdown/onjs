// server.js - Main application entry point

// Load and validate environment variables first
const loadEnv = require('./src/utils/load-env');

// Validate environment before proceeding
if (!loadEnv.initialized) {
    console.error('Environment initialization failed');
    process.exit(1);
}

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const crypto = require('crypto'); // Add this for generating request IDs
const config = require('./config/index');
const AuthManager = require('./src/auth/auth-manager');
const authMiddleware = require('./src/middleware/authMiddleware');
const logger = require('./src/utils/logger');
const errorMiddleware = require('./src/middleware/error');
const validateEnvironment = require('./src/utils/validate-envs');
const log = require('./src/utils/logger').scope('Server');
const axios = require('axios');

// Run environment validation before initializing the app
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  log.warn('Application started with missing environment variables');
}

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

// Initialize the AuthManager with preferred method if available
if (app && envValidation.preferredMethod) {
  const authManager = app.get('authManager');
  if (authManager) {
    log.info(`Setting preferred authentication method from environment: ${envValidation.preferredMethod}`);
    authManager.setMethod(envValidation.preferredMethod);
    
    // If API key format has issues but we're still using it, add a warning
    if (envValidation.preferredMethod === 'apikey' && !envValidation.validation.apiKeyFormat) {
      log.warn('Using API key authentication but the key format has potential issues');
      log.warn('Check for whitespace or incorrect formatting in your API key variables');
    }
  }
}

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

// Remove any duplicate auth middleware initialization
// Initialize authentication middleware once
const auth = authMiddleware(app);

// Configure OAuth
auth.configureOAuth(authManager);

// Mount routes with auth middleware
app.use('/api/auth', require('./src/routes/apiAuthRoutes')(app, auth));
app.use('/api/documents', require('./src/routes/documents')(app, auth));
app.use('/api/elements', require('./src/routes/elements')(app, auth));
app.use('/api/features', require('./src/routes/features')(app, auth));
app.use('/api/examples', require('./src/routes/examples')(app, auth));

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

// Add this debug endpoint after your other API routes
// before the catch-all handler for SPA support

// Authentication debug endpoint to help diagnose auth issues
app.get('/api/debug/auth', (req, res) => {
  const authManager = req.app.get('authManager');
  const log = logger.scope('AuthDebug');
  
  log.info('Auth debug endpoint accessed');
  
  // Get auth status by checking multiple sources
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated() || 
                         !!(authManager && authManager.getMethod());
  
  // Gather detailed auth information without exposing secrets
  const authDebugInfo = {
    isAuthenticated,
    authManager: authManager ? {
      method: authManager.getMethod(),
      hasOAuthCredentials: !!(authManager.clientId && authManager.clientSecret),
      hasApiKeys: !!(authManager.accessKey && authManager.secretKey),
      hasAccessToken: !!authManager.accessToken,
      accessKeyLength: authManager.accessKey ? authManager.accessKey.length : 0,
      secretKeyLength: authManager.secretKey ? authManager.secretKey.length : 0,
      accessTokenLength: authManager.accessToken ? authManager.accessToken.length : 0,
      accessKeyMasked: authManager.accessKey ? 
        `${authManager.accessKey.substring(0, 4)}...${authManager.accessKey.substring(authManager.accessKey.length - 4)}` : null,
      clientIdMasked: authManager.clientId ? 
        `${authManager.clientId.substring(0, 4)}...` : null
    } : null,
    session: req.session ? {
      hasOAuthToken: !!req.session.oauthToken,
      hasRefreshToken: !!req.session.refreshToken,
      oauthTokenLength: req.session.oauthToken ? req.session.oauthToken.length : 0,
      tokenExpiry: req.session.tokenExpiry || null
    } : null,
    user: req.user ? {
      hasAccessToken: !!req.user.accessToken,
      accessTokenLength: req.user.accessToken ? req.user.accessToken.length : 0,
      hasRefreshToken: !!req.user.refreshToken
    } : null,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      oauthConfigured: !!(process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET),
      apiKeyConfigured: !!(process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY),
      preferredAuthMethod: process.env.ONSHAPE_AUTH_METHOD || 'oauth',
      baseUrl: config.onshape.baseUrl
    },
    request: {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasAuthHeader: !!req.get('Authorization'),
      cookies: Object.keys(req.cookies || {})
    }
  };
  
  // Log auth details for server-side debugging
  log.debug('Auth debug information', {
    method: authDebugInfo.authManager?.method,
    isAuthenticated: authDebugInfo.isAuthenticated
  });
  
  // Return detailed info to client
  return res.json(authDebugInfo);
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

// Find the server initialization code section

// Before starting the server, ensure port is properly accessed
const serverPort = config?.server?.port || parseInt(process.env.PORT, 10) || 3000;
app.set('port', serverPort);

// When starting the server
app.listen(serverPort, () => {
  logger.info(`[Server] Server running at http://localhost:${serverPort}`);
  // Other startup logs...
});