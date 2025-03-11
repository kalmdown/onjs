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
const OnshapeClient = require("./src");
const fs = require('fs');
const https = require('https');
const logger = require('./src/utils/logger');

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
    baseUrl: `${process.env.API_URL}/api/v6`,
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
    },
    function (accessToken, refreshToken, profile, done) {
      console.log('OAuth tokens received:', !!accessToken, !!refreshToken);
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
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

// Create Onshape client for a user
function createOnshapeClient(req) {
  if (!req.user || !req.user.accessToken) {
    throw new Error('User not authenticated or missing access token');
  }
  
  const client = new OnshapeClient({
    getAuthHeaders: () => ({
      Authorization: `Bearer ${req.user.accessToken}`,
    }),
    unitSystem: "inch",
    baseUrl: config.onshape.baseUrl,
  });
  
  // Add debugging here
  console.log('OnshapeClient created with:');
  console.log('- API defined:', !!client.api);
  console.log('- Endpoints defined:', !!client.endpoints);
  
  return client;
}

// OAuth routes
app.get("/oauth/login", passport.authenticate("oauth2"));

app.get('/oauthRedirect', function(req, res, next) {
  console.log('OAuth callback received, code present:', !!req.query.code);
  console.log('Query parameters:', req.query);
  next();
}, passport.authenticate('oauth2', { failureRedirect: '/?error=auth_failed' }), function(req, res) {
  console.log('OAuth successful, user:', !!req.user);
  
  // Make sure req.user contains the tokens
  if (req.user && req.user.accessToken) {
    // Pass tokens back to client
    res.redirect(`/?token=${req.user.accessToken}&refresh=${req.user.refreshToken || ''}`);
  } else {
    console.error('Missing tokens in user object:', req.user);
    res.redirect('/?error=missing_tokens');
  }
});

app.get("/oauth/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// Document listing API
app.get('/api/documents', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const documents = await client.listDocuments();
    res.json(documents);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
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

app.post("/api/documents", isAuthenticated, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Document name is required" });
    }

    const client = createOnshapeClient(req);
    const document = await client.createDocument(name, description);
    res.json(document);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/examples/cylinder", isAuthenticated, async (req, res) => {
  try {
    const { documentId } = req.body;

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
    console.error("Error creating cylinder:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/examples/lamp", isAuthenticated, async (req, res) => {
  try {
    const { documentId } = req.body;

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
    console.error("Error creating lamp:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/convert-svg", isAuthenticated, async (req, res) => {
  try {
    const { svgContent, documentId } = req.body;

    if (!svgContent) {
      return res.status(400).json({ error: "SVG content is required" });
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
    console.error("Error converting SVG:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add these routes before your app.listen() call

// Get document workspaces
app.get('/api/documents/:documentId/workspaces', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const documentId = req.params.documentId;
    
    const workspaces = await client.getWorkspaces({ documentId });
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document elements
app.get('/api/documents/:documentId/elements', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const documentId = req.params.documentId;
    
    const elements = await client.getElements({ documentId });
    res.json(elements);
  } catch (error) {
    console.error('Error fetching elements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document elements with workspace
app.get('/api/documents/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const { documentId, workspaceId } = req.params;
    
    // For now, reuse the existing elements endpoint
    const elements = await client.getElements({ documentId });
    res.json({ elements: elements });
  } catch (error) {
    console.error('Error fetching elements with workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for planes in a part studio
app.get('/api/documents/:documentId/w/:workspaceId/e/:elementId/planes', isAuthenticated, async (req, res) => {
  try {
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
    console.error('Error fetching planes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create element
app.post('/api/documents/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const { documentId, workspaceId } = req.params;
    const { name, elementType } = req.body;
    
    const element = await client.createElement({ documentId, workspaceId, name, elementType });
    res.json(element);
  } catch (error) {
    console.error('Error creating element:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fix the feature creation route in server.js - update to match the client endpoint format

// Find this route:
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/features', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const { documentId, workspaceId, elementId } = req.params;
    const feature = req.body; // This needs to be the feature object directly
    
    const result = await client.createFeature({ documentId, workspaceId, elementId, feature });
    res.json(result);
  } catch (error) {
    console.error('Error creating feature:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add entities to sketch
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/sketches/:sketchId/entities', isAuthenticated, async (req, res) => {
  try {
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
    console.error('Error adding sketch entity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close sketch
app.post('/api/documents/:documentId/w/:workspaceId/elements/:elementId/sketches/:sketchId', isAuthenticated, async (req, res) => {
  try {
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
    console.error('Error closing sketch:', error);
    res.status(500).json({ error: error.message });
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

app.listen(config.port, () => {
  console.log(`HTTP Server running on port ${config.port}`);
});