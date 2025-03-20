/**
 * Features API route handler
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const FeaturesApi = require('../api/endpoints/features');

const log = logger.scope('FeaturesRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  
  log.info('Initializing features API routes');
  
  // This route will return API status for requests without parameters
  // or fetch features when proper parameters are provided
  router.get('/', isAuthenticated, async (req, res) => {
    try {
      // Check if this is a status check (no parameters) or a features request
      const { documentId, elementId, workspaceId } = req.query;
      
      if (!documentId || !elementId) {
        // Route accessed without required parameters - return status
        return res.json({ message: 'Features API endpoint working' });
      }
      
      // First check if client is attached to request object (by auth middleware)
      const onshapeClient = req.onshapeClient || app.get('onshapeClient');
      
      // Verify onshapeClient is available
      if (!onshapeClient) {
        log.error('onshapeClient is not available - cannot make API call');
        log.debug('Available app keys: ' + Object.keys(app).join(', '));
        log.debug('Available request keys: ' + Object.keys(req).join(', '));
        
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'API client is not properly configured'
        });
      }
      
      // Check if the client has the required get method
      if (typeof onshapeClient.get !== 'function') {
        log.error(`onshapeClient is available but missing get method. Client: ${JSON.stringify(Object.keys(onshapeClient))}`);
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'API client is missing required methods'
        });
      }
      
      // Default to 'w' for main workspace if not specified
      const wsId = workspaceId || 'w';
      
      log.debug(`Getting features for document: ${documentId}, workspace: ${wsId}, element: ${elementId}`);
      
      try {
        // Align implementation with successful test file approach
        log.debug(`Attempting to get features from Onshape API`);
        
        // Fix the URL format - remove duplicate w/ and e/ segments
        // Correct format: /api/partstudios/d/{did}/w/{wid}/e/{eid}/features
        const apiPath = `partstudios/d/${documentId}/w/${wsId}/e/${elementId}/features`;
        
        log.debug(`Making API request to: ${apiPath}`);
        
        // Use the exact same parameters as the working test
        const features = await onshapeClient.get(
          apiPath, 
          {
            params: {
              includeMateFeatures: true,           // Include mate features
              includeSuppressionState: true,       // Include suppression state
              includePropertyFeatures: true,       // Include property features
              featureId: 'all'                     // Get all features
            },
            headers: {
              'Accept': 'application/vnd.onshape.v1.0+json;charset=UTF-8;qs=0.1',
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Log detailed response information for debugging
        log.debug(`API Response received successfully`);
        
        // Check if features are returned in expected format
        if (features && Array.isArray(features.features)) {
          const featureCount = features.features.length;
          log.debug(`Retrieved ${featureCount} features from Onshape API`);
          
          // Log feature types to identify potential plane features
          const featureTypes = features.features
            .map(f => f.featureType || f.type)
            .filter((v, i, a) => a.indexOf(v) === i); // Unique values
          
          if (featureTypes.length > 0) {
            log.debug(`Feature types found: ${featureTypes.join(', ')}`);
          }
          
          // Look for plane features specifically
          const planeFeatures = features.features.filter(feature => {
            const featureType = (feature.featureType || '').toLowerCase();
            const name = (feature.name || '').toLowerCase();
            return featureType.includes('plane') || 
                   featureType === 'cplane' ||
                   name.includes('plane');
          });
          
          log.debug(`Found ${planeFeatures.length} potential plane features`);
          if (planeFeatures.length > 0) {
            log.debug(`Plane feature names: ${planeFeatures.map(p => p.name).join(', ')}`);
          }
        } else {
          log.warn(`No features array in response or unexpected format`);
          log.debug(`Response keys: ${Object.keys(features || {}).join(', ')}`);
        }
        
        res.json(features);
      } catch (apiError) {
        log.error(`Onshape API error: ${apiError.message}`);
        
        // Add detailed error diagnostics
        if (apiError.response) {
          log.debug(`API Response Status: ${apiError.response.status}`);
          log.debug(`API Response Data: ${JSON.stringify(apiError.response.data || {})}`);
        }
        
        // Add detailed error information
        const statusCode = apiError.response?.status || 500;
        const errorData = apiError.response?.data || {};
        
        res.status(statusCode).json({
          error: 'Onshape API error',
          message: errorData.message || apiError.message,
          details: errorData
        });
      }
    } catch (error) {
      log.error(`Error getting features: ${error.message}`, error);
      res.status(500).json({ error: 'Failed to get features', message: error.message });
    }
  });

  // Update the debug endpoint to check both locations
  router.get('/debug', (req, res) => {
    const requestClient = req.onshapeClient;
    const appClient = app.get('onshapeClient');
    
    res.json({
      message: 'Features API router debug information',
      clientOnRequest: {
        available: !!requestClient,
        type: requestClient ? typeof requestClient : null,
        hasGetMethod: requestClient ? typeof requestClient.get === 'function' : false,
        keys: requestClient ? Object.keys(requestClient) : []
      },
      clientOnApp: {
        available: !!appClient,
        type: appClient ? typeof appClient : null,
        hasGetMethod: appClient ? typeof appClient.get === 'function' : false,
        keys: appClient ? Object.keys(appClient) : []
      },
      requestKeys: Object.keys(req)
    });
  });

  return router;
};