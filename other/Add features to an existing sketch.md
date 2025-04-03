Add features to an existing sketch in Onshape's API rather than replacing it

To add features to an existing sketch instead of replacing it, you need to use a different approach. Let me explain how to do this with an Express.js implementation.

First, to add geometry to an existing sketch, you need to:

1. Get the current sketch features using a GET request
2. Modify the response by adding your new geometry to the existing entities
3. Update the sketch with a POST request that includes both the existing and new entities

Here's how I would implement this in an Express.js application:

const express = require('express');
const axios = require('axios');
const logger = require('./logger'); // Use existing logging system
const router = express.Router();

// Base configuration for Onshape API
const onshapeApiConfig = {
  baseURL: 'https://cad.onshape.com/api',
  headers: {
    'Content-Type': 'application/json;charset=UTF-8; qs=0.09',
    'Accept': 'application/json;charset=UTF-8; qs=0.09'
  }
};

// Add authentication to Onshape API requests
const getAuthenticatedClient = (req) => {
  const client = axios.create({
    ...onshapeApiConfig,
    headers: {
      ...onshapeApiConfig.headers,
      'Authorization': req.headers.authorization,
      'X-XSRF-TOKEN': req.headers['x-xsrf-token']
    }
  });
  
  // Add logging for all requests
  client.interceptors.request.use(request => {
    logger.info(`Outgoing Onshape API request: ${request.method} ${request.url}`);
    return request;
  });

  client.interceptors.response.use(
    response => {
      logger.info(`Onshape API response: ${response.status}`);
      return response;
    },
    error => {
      logger.error(`Onshape API error: ${error.message}`);
      return Promise.reject(error);
    }
  );

  return client;
};

// Route to add features to existing sketch
router.post('/kd_addToSketch', async (req, res) => {
  try {
    const { 
      documentId, 
      workspaceId, 
      elementId, 
      featureId, 
      newEntities 
    } = req.body;

    if (!documentId || !workspaceId || !elementId || !featureId || !newEntities) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const client = getAuthenticatedClient(req);
    
    // 1. GET the current sketch to retrieve existing entities
    const getUrl = `/v10/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features/featureid/${featureId}`;
    const currentSketch = await client.get(getUrl);
    
    if (!currentSketch.data || !currentSketch.data.feature) {
      return res.status(404).json({ error: 'Sketch not found or invalid response' });
    }
    
    // 2. Modify the sketch data by adding new entities
    const updatedSketch = { ...currentSketch.data };
    
    // If the sketch has no entities, initialize the array
    if (!updatedSketch.feature.entities) {
      updatedSketch.feature.entities = [];
    }
    
    // Add new entities to the existing array
    updatedSketch.feature.entities = [
      ...updatedSketch.feature.entities,
      ...newEntities
    ];
    
    // 3. Update the sketch with the combined entities
    const updateUrl = `/v10/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features/featureid/${featureId}`;
    const updateResponse = await client.post(updateUrl, updatedSketch);
    
    res.json(updateResponse.data);
  } catch (error) {
    logger.error(`Error adding to sketch: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Unknown error'
    });
  }
});

// Example route to add a circle to an existing sketch
router.post('/kd_addCircleToSketch', async (req, res) => {
  try {
    const { 
      documentId, 
      workspaceId, 
      elementId, 
      featureId,
      xCenter,
      yCenter,
      radius 
    } = req.body;

    if (!documentId || !workspaceId || !elementId || !featureId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Generate a unique ID for the new circle
    const circleId = `circle_${Date.now()}`;
    
    // Create a new circle entity
    const newCircle = {
      "btType": "BTMSketchCurve-4",
      "entityId": circleId,
      "isConstruction": false,
      "centerId": `${circleId}.center`,
      "geometry": {
        "btType": "BTCurveGeometryCircle-115",
        "radius": radius || 1.0,
        "xCenter": xCenter || 0.0,
        "yCenter": yCenter || 0.0,
        "xDir": 1.0,
        "yDir": 0.0,
        "clockwise": false
      }
    };
    
    // Add the circle to the sketch
    const addToSketchBody = {
      documentId,
      workspaceId,
      elementId,
      featureId,
      newEntities: [newCircle]
    };
    
    // Reuse the kd_addToSketch endpoint
    req.body = addToSketchBody;
    return await router.handle(req, res, router.stack.find(layer => layer.route.path === '/kd_addToSketch'));
  } catch (error) {
    logger.error(`Error adding circle to sketch: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Unknown error'
    });
  }
});

// Pass-through route for direct Onshape API calls (following Onshape's API structure)
router.all('/v:version/*', async (req, res) => {
  try {
    const client = getAuthenticatedClient(req);
    const url = req.originalUrl;
    const method = req.method.toLowerCase();
    
    const response = await client({
      method,
      url,
      data: method !== 'get' ? req.body : undefined,
      params: req.query
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error(`Error in Onshape API passthrough: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Unknown error'
    });
  }
});

module.exports = router;


Now, let me provide a specific example of how you would use this implementation to add features to an existing sketch. Here's a code snippet that shows how to make the API request:

const axios = require('axios');

// Your Express backend URL
const backendUrl = 'http://your-express-server/api';

// Your Onshape document details
const documentId = '398a82c2e197a5efee277cf7';
const workspaceId = 'a71572336b87355a5929aba6';
const elementId = 'f0c841cca00dfe25a0308421';
const featureId = 'FRo1AwdmXbxn1ph_0';

// Create auth headers (from your existing curl command)
const headers = {
  'Authorization': 'Basic cDZOc21JM1ppcVFlMWZvYUJ1WWxxUE41OmxjSXpyVDQ5ZE01Zjc2d0xaazFHaVRKdUVETTBXV2x0eVNkb2dSSUpYQXVURVhrYg==',
  'X-XSRF-TOKEN': 'dNxWS1HjuIUpsJbzyo9UPA==',
  'Content-Type': 'application/json'
};

// Example 1: Using the kd_addCircleToSketch endpoint to add a single circle
async function addSingleCircle() {
  try {
    const response = await axios.post(`${backendUrl}/kd_addCircleToSketch`, {
      documentId,
      workspaceId,
      elementId,
      featureId,
      xCenter: 1.5,   // X-coordinate for the new circle
      yCenter: 2.0,   // Y-coordinate for the new circle
      radius: 0.75    // Radius of the new circle
    }, { headers });
    
    console.log('Circle added successfully:', response.data);
  } catch (error) {
    console.error('Error adding circle:', error.response?.data || error.message);
  }
}

// Example 2: Adding multiple entities at once (a circle and a line)
async function addMultipleEntities() {
  // Create entities to add
  const newEntities = [
    // A new circle
    {
      "btType": "BTMSketchCurve-4",
      "entityId": `circle_${Date.now()}`,
      "isConstruction": false,
      "centerId": `circle_${Date.now()}.center`,
      "geometry": {
        "btType": "BTCurveGeometryCircle-115",
        "radius": 1.25,
        "xCenter": 3.0,
        "yCenter": -1.5,
        "xDir": 1.0,
        "yDir": 0.0,
        "clockwise": false
      }
    },
    // A new line
    {
      "btType": "BTMSketchCurve-4",
      "entityId": `line_${Date.now()}`,
      "isConstruction": false,
      "startPointId": `line_${Date.now()}.start`,
      "endPointId": `line_${Date.now()}.end`,
      "geometry": {
        "btType": "BTCurveGeometryLine-117",
        "startPoint": [0.0, 0.0],
        "endPoint": [5.0, 5.0],
        "startParam": 0.0,
        "endParam": 1.0
      }
    }
  ];

  try {
    const response = await axios.post(`${backendUrl}/kd_addToSketch`, {
      documentId,
      workspaceId,
      elementId,
      featureId,
      newEntities
    }, { headers });
    
    console.log('Multiple entities added successfully:', response.data);
  } catch (error) {
    console.error('Error adding entities:', error.response?.data || error.message);
  }
}

// Example 3: Adding an arc
async function addArc() {
  const arcEntity = {
    "btType": "BTMSketchCurve-4",
    "entityId": `arc_${Date.now()}`,
    "isConstruction": false,
    "startPointId": `arc_${Date.now()}.start`,
    "endPointId": `arc_${Date.now()}.end`,
    "centerId": `arc_${Date.now()}.center`,
    "geometry": {
      "btType": "BTCurveGeometryArc-115",
      "radius": 2.0,
      "xCenter": -1.0,
      "yCenter": 1.0,
      "xDir": 1.0,
      "yDir": 0.0,
      "startAngle": 0,
      "endAngle": 3.14159, // ~180 degrees in radians
      "clockwise": false
    }
  };

  try {
    const response = await axios.post(`${backendUrl}/kd_addToSketch`, {
      documentId,
      workspaceId,
      elementId,
      featureId,
      newEntities: [arcEntity]
    }, { headers });
    
    console.log('Arc added successfully:', response.data);
  } catch (error) {
    console.error('Error adding arc:', error.response?.data || error.message);
  }
}

// Run examples
addSingleCircle();
// addMultipleEntities();
// addArc();

The key difference between your original approach and my solution is that instead of creating a new sketch that replaces the existing one, we're:

1. First retrieving the current sketch data with a GET request
2. Adding new entities to the existing entities array
3. Submitting the combined data back to Onshape

This preserves all existing geometry while adding new features.

To integrate this into your Express.js application:

1. Add the router code from the first artifact to your Express app
2. Use the second artifact as a reference for making client requests

Here's a simple app.js to complete the implementation:

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston');
const onshapeRouter = require('./routes/onshape'); // Import the router we created

// Set up logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Export logger for use in other modules
module.exports.logger = logger;

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Mount the Onshape router
app.use('/api', onshapeRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

To summarize the approach:

1. The key issue with your original curl command is that it's creating a new sketch rather than modifying an existing one. This is why it "blows away" existing geometry.

2. To add features to an existing sketch, we need to:
   - GET the current sketch data first
   - Add our new entities to the existing entities array
   - POST the combined data back to Onshape

3. I've created a clean Express.js implementation that:
   - Follows best practices for Express apps
   - Uses proper routing that matches Onshape's API structure
   - Includes prefixing internal routes with "kd_" as requested
   - Incorporates proper error handling and logging
   - Provides helper methods for common operations

This approach allows you to add any type of sketch entity (circles, lines, arcs, etc.) to existing sketches without losing current geometry. The implementation is minimal but complete, focused on solving your specific problem while being extendable for other Onshape API interactions.

Would you like me to explain any specific part of the implementation in more detail?