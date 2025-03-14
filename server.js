// src\server.js
/**
 * SVG to Onshape Converter - Server
 *
 * Express server that handles API requests and communicates with Onshape
 */
require('dotenv').config();

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const { Strategy: OAuth2Strategy } = require("passport-oauth2");
const onjs = require("./src");
const AuthManager = require('./src/auth/auth-manager');
const fs = require('fs');
const https = require('https');
const logger = require('./src/utils/logger');
const axios = require('axios');

// Configuration - would be loaded from environment variables in production
const config = {
  port: process.env.PORT || 3000,
  onshape: {
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackUrl:
      process.env.OAUTH_CALLBACK_URL || "http://localhost:3000/oauthRedirect",
    authorizationUrl: `${process.env.OAUTH_URL}/oauth/authorize`,
    tokenUrl: `${process.env.OAUTH_URL}/oauth/token`,
    baseUrl: `${process.env.API_URL}`,
  },
  session: {
    secret: process.env.SESSION_SECRET || "development_secret_do_not_use_in_production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.SESSION_SECURE === "true",
      maxAge: process.env.SESSION_MAX_AGE
        ? parseInt(process.env.SESSION_MAX_AGE)
        : 24 * 60 * 60 * 1000, // Default to 24 hours
    },
  },
  webhook: {
    callbackRootUrl: process.env.WEBHOOK_CALLBACK_ROOT_URL,
  },
};

// Create a single AuthManager instance for the application
const authManager = new AuthManager({
  baseUrl: config.onshape.baseUrl,
  accessKey: process.env.ONSHAPE_ACCESS_KEY,
  secretKey: process.env.ONSHAPE_SECRET_KEY,
  clientId: config.onshape.clientId,
  clientSecret: config.onshape.clientSecret,
  redirectUri: config.onshape.callbackUrl
});

// Determine the best authentication method based on available credentials
if (process.env.ONSHAPE_AUTH_METHOD === 'OAUTH' || 
    (config.onshape.clientId && config.onshape.clientSecret)) {
  // Prefer OAuth if explicitly configured or if OAuth credentials are available
  authManager.setMethod('oauth');
  logger.info('AuthManager initialized with OAuth authentication');
} else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
  // Fall back to API key if available
  authManager.setMethod('apikey');
  logger.info('AuthManager initialized with API key authentication');
} else {
  logger.warn('No valid authentication credentials available. Users will need to authenticate via OAuth.');
}

// Log auth credentials state (without actual values) for debugging
logger.debug('Auth credentials state:', {
  hasApiKey: !!process.env.ONSHAPE_ACCESS_KEY,
  hasApiSecret: !!process.env.ONSHAPE_SECRET_KEY,
  hasApiKeyLength: process.env.ONSHAPE_ACCESS_KEY?.length || 0,
  hasSecretKeyLength: process.env.ONSHAPE_SECRET_KEY?.length || 0,
  hasOAuthClientId: !!config.onshape.clientId,
  hasOAuthClientSecret: !!config.onshape.clientSecret,
  authMethod: authManager.getMethod() || 'NONE'
});

// Configure logger based on environment
if (process.env.NODE_ENV === 'production') {
  logger.logLevel = 'info';
  // Uncomment to enable file logging in production
  // logger.logToFile = true;
}

if (process.env.NODE_ENV === 'development') {
  logger.logLevel = 'debug';  // More verbose in development
}

// Initialize Express app
const app = express();

// Store authManager in app context for middleware access
app.set('authManager', authManager);

// Add this just after initializing the app
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Configure middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(config.session));
app.use(passport.initialize());
app.use(passport.session());

// Configure OAuth2 strategy for Onshape
passport.use(
  new OAuth2Strategy(
    {
      authorizationURL: config.onshape.authorizationUrl,
      tokenURL: config.onshape.tokenUrl,
      clientID: config.onshape.clientId,
      clientSecret: config.onshape.clientSecret,
      callbackURL: config.onshape.callbackUrl,
      scope: 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete'
    },
    function (accessToken, refreshToken, profile, done) {
      logger.debug('OAuth tokens received:', !!accessToken, !!refreshToken);
      logger.debug('Token length:', accessToken ? accessToken.length : 0);
 
      // Store tokens with the user profile
      return done(null, {
        accessToken,
        refreshToken,
      });
    }
  )
);

// Serialize and deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Helper to check if user is authenticated
function isAuthenticated(req, res, next) {
  // Get the central auth manager
  const authManager = req.app.get('authManager');
  
  // Check auth method and credentials
  const authMethod = authManager.getMethod();
  
  // Handle different authentication scenarios
  if (authMethod === 'oauth') {
    if (req.user && req.user.accessToken) {
      // Update auth manager with user's OAuth token if needed
      if (authManager.accessToken !== req.user.accessToken) {
        authManager.accessToken = req.user.accessToken;
        authManager.refreshToken = req.user.refreshToken || null;
        authManager.setMethod('oauth');
        logger.debug('Updated auth manager with user OAuth tokens from req.user');
      }
      return next();
    } else if (req.session && req.session.oauthToken) {
      // Alternative: check for token in session
      if (authManager.accessToken !== req.session.oauthToken) {
        authManager.accessToken = req.session.oauthToken;
        authManager.refreshToken = req.session.refreshToken || null;
        authManager.setMethod('oauth');
        logger.debug('Updated auth manager with OAuth tokens from session');
      }
      return next();
    }
  } else if (authMethod === 'apikey' && 
             process.env.ONSHAPE_ACCESS_KEY && 
             process.env.ONSHAPE_SECRET_KEY) {
    // Verify that API key credentials are actually present
    if (authManager.accessKey !== process.env.ONSHAPE_ACCESS_KEY) {
      authManager.accessKey = process.env.ONSHAPE_ACCESS_KEY;
      authManager.secretKey = process.env.ONSHAPE_SECRET_KEY;
      logger.debug('Updated auth manager with latest API key credentials');
    }
    return next();
  }
  
  // If we reach here, redirect to OAuth login
  logger.info('User not authenticated, redirecting to OAuth login');
  res.redirect('/oauth/login');
}

// Create Onshape client for a user
function createOnshapeClient(req) {
  // Get application's authManager
  const authManager = req.app.get('authManager');
  
  // Determine and set the authentication method based on available credentials
  // Priority: 1. req.user OAuth credentials, 2. Session OAuth credentials, 3. API key

  if (req.user && req.user.accessToken) {
    // Use OAuth token from req.user
    authManager.accessToken = req.user.accessToken;
    authManager.refreshToken = req.user.refreshToken || null;
    authManager.setMethod('oauth');
    logger.debug('Using OAuth token from req.user');
  } else if (req.session && req.session.oauthToken) {
    // Use token from session
    authManager.accessToken = req.session.oauthToken;
    authManager.refreshToken = req.session.refreshToken || null;
    authManager.setMethod('oauth');
    logger.debug('Using OAuth token from session');
  } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
    // Only fall back to API key if we have valid credentials and no OAuth tokens
    authManager.accessKey = process.env.ONSHAPE_ACCESS_KEY;
    authManager.secretKey = process.env.ONSHAPE_SECRET_KEY;
    authManager.setMethod('apikey');
    logger.debug('Using API key authentication as fallback');
  } else {
    // Log warning if no valid authentication method is available
    logger.warn('No valid authentication credentials available');
  }
  
  logger.debug(`Auth manager method after update: ${authManager.getMethod()}`);
  
  // Create client with the application's auth manager instance
  return onjs.createClient({
    authManager: authManager,
    unitSystem: "inch",
    baseUrl: process.env.API_URL || 'https://cad.onshape.com/api/v6',
  });
}

// OAuth routes
// OAuth routes
app.get("/oauth/login", passport.authenticate("oauth2"));

app.get('/oauthRedirect', function(req, res, next) {
  console.log('OAuth callback received, code present:', !!req.query.code);
  console.log('Query parameters:', req.query);
  next();
}, passport.authenticate('oauth2', { failureRedirect: '/?error=auth_failed' }), function(req, res) {
  console.log('OAuth successful, user:', !!req.user);
  
  // Log more details about the token for debugging
  if (req.user && req.user.accessToken) {
    console.log('Token length:', req.user.accessToken.length);
    console.log('Token prefix:', req.user.accessToken.substring(0, 10) + '...');
    
    // Store tokens in session for non-passport requests
    req.session.oauthToken = req.user.accessToken;
    req.session.refreshToken = req.user.refreshToken || null;
    
    // Important: Update the auth manager with tokens
    const authManager = req.app.get('authManager');
    authManager.accessToken = req.user.accessToken;
    authManager.refreshToken = req.user.refreshToken || null;
    authManager.setMethod('oauth');
    logger.info('Updated global auth manager with OAuth tokens');
    
    // Pass tokens back to client
    res.redirect(`/?token=${encodeURIComponent(req.user.accessToken)}&refresh=${encodeURIComponent(req.user.refreshToken || '')}`);
  } else {
    console.error('Missing tokens in user object:', req.user);
    res.redirect('/?error=missing_tokens');
  }
});

// Example route handler for documents API
app.get('/api/documents', isAuthenticated, async (req, res, next) => {
  try {
    // Get the central auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }
    
    // Log the current auth state for debugging
    logger.debug(`Auth state: method=${authManager.getMethod()}, hasToken=${!!authManager.accessToken}, hasApiKey=${!!authManager.accessKey}`);
    
    // Create client using the central auth manager
    const client = createOnshapeClient(req);
    
    // Make API request
    const documents = await client.api.get('/documents');
    
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

// API routes
app.get("/api/auth/status", (req, res) => {
  res.json({ authenticated: req.isAuthenticated() });
});

app.post('/api/webhooks', (req, res) => {
  console.log('Webhook received:', req.body);
  // Process webhook data
  res.status(200).end();
});

app.post("/api/documents", isAuthenticated, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Document name is required" });
    }

    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const document = await client.createDocument(name, description);
    res.json(document);
  } catch (error) {
    next(error);
  }
});

app.post("/api/examples/cylinder", isAuthenticated, async (req, res, next) => {
  try {
    const { documentId } = req.body;

    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);

    // Get or create document
    let onshapeDocument;  // Changed from 'document' to 'onshapeDocument'
    if (documentId) {
      onshapeDocument = await client.getDocument({ documentId });
    } else {
      onshapeDocument = await client.createDocument("Cylinder Example");
    }

    // Get part studio
    const partStudio = await client.getPartStudio({
      document: onshapeDocument,  // Update this parameter name too
      wipe: true,
    });

    // Create a sketch on the top plane
    const sketch = await Sketch.create({
      partStudio,
      plane: partStudio.features.topPlane,
      name: "Base Sketch",
    });

    // Add a circle to the sketch
    await sketch.addCircle([0, 0], 0.5);

    // Extrude the sketch
    const extrude = await Extrude.create({
      partStudio,
      faces: await sketch.getEntities(),
      distance: 1,
      name: "Cylinder Extrude",
    });

    res.json({
      success: true,
      document: onshapeDocument,  // Update this property too
      link: `https://cad.onshape.com/documents/${onshapeDocument.id}`,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/examples/lamp", isAuthenticated, async (req, res, next) => {
  try {
    const { documentId } = req.body;

    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);

    // Get or create document
    let onshapeDocument;
    if (documentId) {
      onshapeDocument = await client.getDocument({ documentId });
    } else {
      onshapeDocument = await client.createDocument("Lamp Example");
    }

    // Get part studio
    const partStudio = await client.getPartStudio({
      document: onshapeDocument,
      wipe: true,
    });

    // Implementation would follow the lamp example pattern
    // For brevity, we'll just return success

    res.json({
      success: true,
      document: onshapeDocument,
      link: `https://cad.onshape.com/documents/${onshapeDocument.id}`,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/convert-svg", isAuthenticated, async (req, res, next) => {
  try {
    const { svgContent, documentId } = req.body;

    if (!svgContent) {
      return res.status(400).json({ error: "SVG content is required" });
    }

    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);

    // Get or create document
    let onshapeDocument;  // Changed from 'document' to 'onshapeDocument'
    if (documentId) {
      onshapeDocument = await client.getDocument({ documentId });
    } else {
      onshapeDocument = await client.createDocument("SVG Conversion");
    }

    // Get part studio
    const partStudio = await client.getPartStudio({
      document: onshapeDocument,  // Update parameter name
      wipe: true,
    });

    // Implementation would involve SVG parsing and conversion
    // For brevity, we'll just return success

    res.json({
      success: true,
      document: onshapeDocument,  // Update property name
      link: `https://cad.onshape.com/documents/${onshapeDocument.id}`,
    });
  } catch (error) {
    next(error);
  }
});

// Add these routes before your app.listen() call

// Get document workspaces
app.get('/api/documents/:documentId/workspaces', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const documentId = req.params.documentId;
    
    const workspaces = await client.getWorkspaces({ documentId });
    res.json(workspaces);
  } catch (error) {
    next(error);
  }
});

// Get document elements
app.get('/api/documents/:documentId/elements', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const documentId = req.params.documentId;
    
    const elements = await client.getElements({ documentId });
    res.json(elements);
  } catch (error) {
    next(error);
  }
});

// Get document elements with workspace
app.get('/api/documents/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const { documentId, workspaceId } = req.params;
    
    // For now, reuse the existing elements endpoint
    const elements = await client.getElements({ documentId });
    res.json({ elements: elements });
  } catch (error) {
    next(error);
  }
});

// Endpoint for planes in a part studio
app.get('/api/documents/:documentId/w/:workspaceId/e/:elementId/planes', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    
    // Debug the client structure
    console.log('Client has api:', !!client.api);
    console.log('Client has endpoints:', !!client.endpoints);
    
    const { documentId, workspaceId, elementId } = req.params;
    const includeCustomPlanes = req.query.includeCustomPlanes === 'true';
    
    console.log(`Planes request: doc=${documentId}, workspace=${workspaceId}, element=${elementId}, includeCustom=${includeCustomPlanes}`);
    
    // Always include default planes
    const planes = [
      { id: `${elementId}_TOP`, name: 'Top Plane', transientId: 'TOP', type: 'default' },
      { id: `${elementId}_FRONT`, name: 'Front Plane', transientId: 'FRONT', type: 'default' },
      { id: `${elementId}_RIGHT`, name: 'Right Plane', transientId: 'RIGHT', type: 'default' }
    ];
    
    // Add actual custom planes from Onshape
    if (includeCustomPlanes) {
      try {
        console.log('Fetching actual custom planes from Onshape...');
        
        // Use the correct API access
        const url = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
        console.log(`Making features API call: ${url}`);
        
        // Use client.api directly (it's defined in the constructor)
        const featuresResponse = await client.api.get(url);
        console.log(`Got features response with ${featuresResponse?.features?.length || 0} features`);
        
        // Filter for custom planes and transforms
        if (featuresResponse && featuresResponse.features) {
          const customPlaneFeatures = featuresResponse.features.filter(feature => {
            return (
              // Look for custom datum planes
              (feature.featureType === "cPlane" || feature.featureType === "datumPlane") ||
              // Also look for named plane features
              (feature.message && 
               feature.message.name && 
               /plane|datum/i.test(feature.message.name))
            );
          });
          
          console.log(`Found ${customPlaneFeatures.length} potential custom plane features`);
          
          // Convert features to plane objects
          customPlaneFeatures.forEach(feature => {
            const featureId = feature.featureId || feature.id;
            const name = feature.message?.name || 
                         feature.name || 
                         `Custom Plane ${featureId.substring(0, 6)}`;
            
            planes.push({
              id: `${elementId}_${featureId}`,
              name: name,
              transientId: featureId,
              type: 'custom',
              featureType: feature.featureType || 'unknown'
            });
          });
        }
      } catch (planeError) {
        console.error('Error fetching custom planes:', planeError);
      }
    }
    
    // Return the planes
    res.json({ planes });
    
  } catch (error) {
    next(error);
  }
});

// Create element
app.post('/api/documents/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const { documentId, workspaceId } = req.params;
    const { name, elementType } = req.body;
    
    const element = await client.createElement({ documentId, workspaceId, name, elementType });
    res.json(element);
  } catch (error) {
    next(error);
  }
});

// Fix the feature creation route in server.js - update to match the client endpoint format

// Find this route:
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/features', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const { documentId, workspaceId, elementId } = req.params;
    const feature = req.body; // This needs to be the feature object directly
    
    const result = await client.createFeature({ documentId, workspaceId, elementId, feature });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Add entities to sketch
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/sketches/:sketchId/entities', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const { documentId, workspaceId, elementId, sketchId } = req.params;
    
    const entity = await client.addSketchEntity({
      documentId, 
      workspaceId, 
      elementId, 
      sketchId,
      entity: req.body
    });
    res.json(entity);
  } catch (error) {
    next(error);
  }
});

// Close sketch
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/sketches/:sketchId', isAuthenticated, async (req, res, next) => {
  try {
    // Get the auth manager
    const authManager = req.app.get('authManager');
    
    // Refresh token if needed and using OAuth
    if (authManager.getMethod() === 'oauth' && authManager.refreshToken) {
      await authManager.refreshTokenIfNeeded();
    }

    const client = createOnshapeClient(req);
    const { documentId, workspaceId, elementId, sketchId } = req.params;
    const { action } = req.body;
    
    if (action === 'close') {
      const result = await client.closeSketch({
        documentId, 
        workspaceId, 
        elementId, 
        sketchId
      });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error) {
    next(error);
  }
});

// Add this to make sure '/' returns index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* // Start server
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.pem'))
}; */

// API error handling middleware - add this before app.listen()
app.use((err, req, res, next) => {
  // Extract useful information from the error
  const statusCode = err.statusCode || err.response?.status || 500;
  const message = err.message || 'Internal server error';
  const errorDetails = {
    message,
    status: statusCode,
    path: req.path
  };
  
  // Add more details for debugging (only in development)
  if (process.env.NODE_ENV !== 'production') {
    errorDetails.stack = err.stack;
    errorDetails.originalError = err.originalError || null;
    if (err.response?.data) {
      errorDetails.responseData = err.response.data;
    }
  }
  
  // Log the error
  logger.error(`API Error (${statusCode}): ${message}`, err);
  
  // Handle authentication errors
  if (statusCode === 401) {
    // Clear any invalid tokens from session
    if (req.session) {
      delete req.session.oauthToken;
      delete req.session.refreshToken;
    }
    
    // For API requests, return JSON error
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Your session has expired or is invalid. Please log in again.'
      });
    }
    
    // For browser requests, redirect to login
    return res.redirect('/oauth/login');
  }
  
  // Handle other errors
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Server error' : 'Request error',
    message,
    details: process.env.NODE_ENV !== 'production' ? errorDetails : undefined
  });
});

app.listen(config.port, () => {
  console.log(`HTTP Server running on port ${config.port}`);
});