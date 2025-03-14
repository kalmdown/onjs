// server.js - Main application entry point
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const config = require('./config');
const AuthManager = require('./src/auth/auth-manager');
const logger = require('./src/utils/logger');
const { configureOAuth } = require('./src/middleware/auth');
const errorMiddleware = require('./src/middleware/error');

// Import route modules
const authRoutes = require('./src/routes/auth');
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

// Initialize Express app
const app = express();

// Store authManager in app context for middleware access
app.set('authManager', authManager);

// Basic request logger
app.use((req, res, next) => {
  log.debug(`${req.method} ${req.url}`);
  next();
});

// Configure middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(config.session));
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
  res.json({ 
    authenticated: req.isAuthenticated() || (req.session && !!req.session.oauthToken),
    method: authManager.getMethod() || 'none'
  });
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