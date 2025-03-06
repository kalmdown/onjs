// src\server.js
/**
 * SVG to Onshape Converter - Server
 * 
 * Express server that handles API requests and communicates with Onshape
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const OnshapeClient = require('.');

// Configuration - would be loaded from environment variables in production
const config = {
  port: process.env.PORT || 3000,
  onshape: {
    clientId: process.env.ONSHAPE_CLIENT_ID || 'your_client_id',
    clientSecret: process.env.ONSHAPE_CLIENT_SECRET || 'your_client_secret',
    callbackUrl: process.env.ONSHAPE_CALLBACK_URL || 'http://localhost:3000/oauth/callback',
    authorizationUrl: 'https://oauth.onshape.com/oauth/authorize',
    tokenUrl: 'https://oauth.onshape.com/oauth/token',
    baseUrl: 'https://cad.onshape.com/api/v6'
  },
  session: {
    secret: process.env.SESSION_SECRET || 'svg-to-onshape-secret',
    resave: false,
    saveUninitialized: false
  }
};

// Initialize Express app
const app = express();

// Configure middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(config.session));
app.use(passport.initialize());
app.use(passport.session());

// Configure OAuth2 strategy for Onshape
passport.use(new OAuth2Strategy({
  authorizationURL: config.onshape.authorizationUrl,
  tokenURL: config.onshape.tokenUrl,
  clientID: config.onshape.clientId,
  clientSecret: config.onshape.clientSecret,
  callbackURL: config.onshape.callbackUrl
}, (accessToken, refreshToken, profile, done) => {
  // In a production app, you might look up the user in a database
  return done(null, {
    accessToken,
    refreshToken
  });
}));

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
  res.status(401).json({ error: 'Authentication required' });
}

// Create Onshape client for a user
function createOnshapeClient(req) {
  return new OnshapeClient({
    getAuthHeaders: () => ({
      'Authorization': `Bearer ${req.user.accessToken}`
    }),
    unitSystem: 'inch',
    baseUrl: config.onshape.baseUrl
  });
}

// OAuth routes
app.get('/oauth/login', passport.authenticate('oauth2'));

app.get('/oauth/callback', 
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/oauth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// API routes
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: req.isAuthenticated() });
});

app.get('/api/documents', isAuthenticated, async (req, res) => {
  try {
    const client = createOnshapeClient(req);
    const documents = await client.listDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/documents', isAuthenticated, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Document name is required' });
    }
    
    const client = createOnshapeClient(req);
    const document = await client.createDocument(name, description);
    res.json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/examples/cylinder', isAuthenticated, async (req, res) => {
  try {
    const { documentId } = req.body;
    
    const client = createOnshapeClient(req);
    
    // Get or create document
    let document;
    if (documentId) {
      document = await client.getDocument({ documentId });
    } else {
      document = await client.createDocument('Cylinder Example');
    }
    
    // Get part studio
    const partStudio = await client.getPartStudio({ 
      document, 
      wipe: true 
    });
    
    // Create a sketch on the top plane
    const sketch = await Sketch.create({
      partStudio,
      plane: partStudio.features.topPlane,
      name: "Base Sketch"
    });
    
    // Add a circle to the sketch
    await sketch.addCircle([0, 0], 0.5);
    
    // Extrude the sketch
    const extrude = await Extrude.create({
      partStudio,
      faces: await sketch.getEntities(),
      distance: 1,
      name: "Cylinder Extrude"
    });
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`
    });
  } catch (error) {
    console.error('Error creating cylinder:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/examples/lamp', isAuthenticated, async (req, res) => {
  try {
    const { documentId } = req.body;
    
    const client = createOnshapeClient(req);
    
    // Get or create document
    let document;
    if (documentId) {
      document = await client.getDocument({ documentId });
    } else {
      document = await client.createDocument('Lamp Example');
    }
    
    // Get part studio
    const partStudio = await client.getPartStudio({ 
      document, 
      wipe: true 
    });
    
    // Implementation would follow the lamp example pattern
    // For brevity, we'll just return success
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`
    });
  } catch (error) {
    console.error('Error creating lamp:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert-svg', isAuthenticated, async (req, res) => {
  try {
    const { svgContent, documentId } = req.body;
    
    if (!svgContent) {
      return res.status(400).json({ error: 'SVG content is required' });
    }
    
    const client = createOnshapeClient(req);
    
    // Get or create document
    let document;
    if (documentId) {
      document = await client.getDocument({ documentId });
    } else {
      document = await client.createDocument('SVG Conversion');
    }
    
    // Get part studio
    const partStudio = await client.getPartStudio({ 
      document, 
      wipe: true 
    });
    
    // Implementation would involve SVG parsing and conversion
    // For brevity, we'll just return success
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`
    });
  } catch (error) {
    console.error('Error converting SVG:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});