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
const planesRoutes = require('./src/routes/planes');

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

// Add before routes are registered

// Add route debugging middleware in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.includes('/api/')) {
      const log = require('./src/utils/logger').scope('RouteDebug');
      log.debug(`${req.method} ${req.path}`, {
        params: req.params,
        query: req.query,
        body: req.body && typeof req.body === 'object' ? Object.keys(req.body).length : 0
      });
    }
    next();
  });
}

// Add before your existing routes
app.use((req, res, next) => {
  if (req.path.includes('/api/documents')) {
    log.debug('API documents request headers:', {
      auth: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'missing',
      contentType: req.headers['content-type'],
      accept: req.headers.accept
    });
  }
  next();
});

// Add this middleware before the routes are registered
// (after the existing document request middleware)

// Debug middleware for plane requests
app.use((req, res, next) => {
  if (req.path.includes('/planes')) {
    const log = require('./src/utils/logger').scope('PlanesDebug');
    log.debug(`Planes request: ${req.method} ${req.path}`, {
      params: req.params,
      query: req.query,
      headers: {
        auth: req.headers.authorization ? `${req.headers.authorization.split(' ')[0]} ...` : 'missing',
        contentType: req.headers['content-type'],
        accept: req.headers.accept
      }
    });
  }
  next();
});

// Mount routes with auth middleware
app.use('/api/auth', require('./src/routes/apiAuthRoutes')(app, auth));
app.use('/api/documents', require('./src/routes/documents')(app, auth));
app.use('/api/elements', require('./src/routes/elements')(app, auth));
app.use('/api/features', require('./src/routes/features')(app, auth));
app.use('/api/examples', require('./src/routes/examples')(app, auth));
app.use('/api/planes', require('./src/routes/planes')(app, auth));

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

// Add this before the existing error handler or replace it

// More detailed error handler
app.use((err, req, res, next) => {
  const logger = require('./src/utils/logger');
  const log = logger.scope('ErrorMiddleware');
  
  // Log error details
  log.error(`API Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
  
  // Handle API errors specifically
  if (err.name === 'ApiError') {
    return res.status(err.statusCode || 500).json({
      error: err.message,
      details: err.details || undefined
    });
  }
  
  // General error response
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Find the server initialization code section

// Before starting the server, ensure port is properly accessed
const serverPort = config?.server?.port || parseInt(process.env.PORT, 10) || 3000;
app.set('port', serverPort);

// Add after all routes are registered, before starting the server
console.log('\n=== REGISTERED ROUTES ===');
const getFileInfo = () => {
  const stack = new Error().stack;
  const stackLines = stack.split('\n');
  // Look for the first line that isn't in server.js
  for (let i = 3; i < stackLines.length; i++) {
    const line = stackLines[i].trim();
    if (line.includes('(') && line.includes(')') && !line.includes('server.js')) {
      const fileInfo = line.substring(line.indexOf('(') + 1, line.indexOf(')'));
      return fileInfo;
    }
  }
  return 'unknown source';
};

// Create a map to store route registration sources
const routeSources = new Map();

// Function to collect route sources
const collectRouteSources = () => {
  const routes = [];
  
  app._router.stack.forEach(function(middleware){
    if (middleware.route) {
      // This is a direct route on the app
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      
      // Fix: Check for source property explicitly and use a string fallback
      let source = 'server.js';
      if (middleware.route.source && typeof middleware.route.source === 'string') {
        source = middleware.route.source;
      }
      
      routes.push(`[APP] ${methods} ${path}`);
      routeSources.set(`[APP] ${methods} ${path}`, source);
    } else if (middleware.name === 'router') {
      // This is a router middleware
      middleware.handle.stack.forEach(function(handler){
        if (handler.route) {
          const path = handler.route.path;
          const mount = middleware.regexp.toString().replace('/^\\', '').replace('\\/?(?=\\/|$)/i', '');
          const mountPath = mount === '(?:/(?=\\/|$))?' ? '' : mount.replace(/\\/g, '');
          const fullPath = `${mountPath}${path}`;
          const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
          
          // Try to determine the source
          let source = 'unknown';
          if (middleware.handle.source && typeof middleware.handle.source === 'string') {
            source = middleware.handle.source;
          } else if (handler.route.source && typeof handler.route.source === 'string') {
            source = handler.route.source;
          } else {
            // Look at the registration pattern to guess the source
            const mountPathClean = mountPath.replace(/\//g, '');
            if (mountPathClean.startsWith('api')) {
              // Extract the API route name
              const routeName = mountPathClean.replace('api', '');
              if (routeName) {
                source = `src/routes/${routeName}.js`;
              }
            }
          }
          
          routes.push(`[ROUTE] ${methods} ${fullPath}`);
          routeSources.set(`[ROUTE] ${methods} ${fullPath}`, source);
        }
      });
    }
  });
  
  return routes;
};

// Add after all routes are registered, before the collectRouteSources function

// Define colors for HTTP methods
const colors = {
  GET: '\x1b[38;2;97;175;254m',    // #61affe (blue)
  POST: '\x1b[38;2;73;204;144m',   // #49cc90 (green)
  DELETE: '\x1b[38;2;249;62;62m',  // #f93e3e (red)
  reset: '\x1b[0m',                // Reset to default color
  dim: '\x1b[2m'                   // Dim text (reduce brightness)
};

// Function to colorize HTTP method
const colorizeMethod = (method) => {
  const methodColor = colors[method] || '\x1b[0m';
  return `${methodColor}${method}${colors.reset}`;
};

// Function to dim source paths (reduce brightness)
const dimText = (text) => {
  return `${colors.dim}${text}${colors.reset}`;
};

// Only display routes if ROUTE_LOGGING is enabled
const routeLoggingEnabled = process.env.ROUTE_LOGGING === 'true';

if (routeLoggingEnabled) {
  console.log('\n=== REGISTERED ROUTES ===');
  
  // Collect and display all routes
  const routes = collectRouteSources();
  routes.sort().forEach(route => {
    // Extract method from route string
    const methodMatch = route.match(/\[(APP|ROUTE)\] ([A-Z,]+) /);
    if (methodMatch) {
      const routeType = methodMatch[1];
      const methods = methodMatch[2].split(',');
      
      // Colorize each method
      const colorizedMethods = methods.map(method => colorizeMethod(method)).join(',');
      
      // Replace original methods with colorized ones
      const colorizedRoute = route.replace(methodMatch[2], colorizedMethods);
      
      // Get and dim the source path
      const source = routeSources.get(route);
      const dimmedSource = dimText(source);
      
      console.log(`${colorizedRoute} - ${dimmedSource}`);
    } else {
      // Fallback for routes that don't match the expected pattern
      const source = routeSources.get(route);
      console.log(`${route} - ${dimText(source)}`);
    }
  });
  console.log('=========================\n');
} else {
  console.log('Route logging disabled. Enable by setting ROUTE_LOGGING=true in .env');
}

// When starting the server
app.listen(serverPort, () => {
  logger.info(`[Server] Server running at http://localhost:${serverPort}`);
  // Other startup logs...
});