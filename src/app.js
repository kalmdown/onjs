// src/app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const logger = require('./utils/logger');
const AuthManager = require('./auth/auth-manager');
const config = require('../config');
const errorMiddleware = require('./middleware/error');

// Create Express app
const app = express();
const log = logger.scope('App');

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  name: config.session.name,
  secret: config.session.secret || 'onshape-app-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.session.secure,
    maxAge: config.session.maxAge
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialize authentication manager
const authManager = new AuthManager({
  baseUrl: config.onshape.baseUrl,
  accessKey: config.onshape.apiKey.accessKey,
  secretKey: config.onshape.apiKey.secretKey
});

// Make auth manager available to routes
app.set('authManager', authManager);
app.set('config', config);

// Create auth middleware
const auth = require('./middleware/authMiddleware')(app);

// Mount OAuth routes at /oauth path
app.use('/oauth', require('./routes/authRoutes'));

// Debug endpoint
app.get('/kd_debug', (req, res) => {
  res.json({
    auth: {
      method: authManager.getMethod(),
      isConfigured: authManager.getMethod() !== null
    },
    config: {
      onshape: {
        baseUrl: config.onshape.baseUrl,
        authMethod: config.onshape.authMethod
      },
      server: {
        port: config.server.port,
        env: config.server.env
      }
    }
  });
});

// Default route for SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Add global error handling middleware
app.use(errorMiddleware);

// Make auth middleware available for server.js to use
app.auth = auth;

// Export app for server.js to use
module.exports = app;