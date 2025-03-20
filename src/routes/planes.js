/**
 * Planes API route handler
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('PlanesRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  const onshapeClient = app.get('onshapeClient');
  
  // Add diagnostics to verify router registration and mounting
  log.info('Initializing planes API routes');

  router.get('/', (req, res) => {
    res.json({ message: 'Planes API endpoint working' });
  });

  /**
   * Get planes for a part studio
   * Fetches both standard and custom planes
   */
  router.get('/documents/:documentId/elements/:elementId/planes', isAuthenticated, async (req, res) => {
    try {
      const { documentId, elementId } = req.params;
      // Default to 'w' for workspace if not provided
      const workspaceId = req.query.workspaceId || 'w';
      
      log.debug(`Getting planes for document: ${documentId}, workspace: ${workspaceId}, element: ${elementId}`);
      
      // Create standard planes based on known IDs
      // Standard planes have permanent IDs in every part studio
      const standardPlanes = [
        { id: "JHD", name: "TOP", type: "STANDARD", transientId: "TOP" },
        { id: "JHC", name: "FRONT", type: "STANDARD", transientId: "FRONT" },
        { id: "JHF", name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      log.info(`Using ${standardPlanes.length} standard planes with known IDs`);
      
      // Get custom planes from features endpoint
      log.info('Getting custom planes from features endpoint');
      let customPlanes = [];
      
      try {
        log.debug(`Fetching features from API: /partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`);
        
        // Include the same query parameters used in the successful test
        const featuresResponse = await onshapeClient.get(
          `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`, 
          {
            params: {
              rollbackBarIndex: -1,
              includeGeometryIds: true,
              noSketchGeometry: false
            },
            headers: {
              'accept': 'application/json;charset=UTF-8; qs=0.09'
            }
          }
        );
        
        // Extract features from response
        const features = featuresResponse.features || [];
        
        // Filter features for planes
        customPlanes = features.filter(feature => {
          const featureType = (feature.featureType || '').toLowerCase();
          const name = (feature.name || '').toLowerCase();
          
          return featureType.includes('plane') || 
                 featureType === 'cplane' ||
                 name.includes('plane');
        }).map(feature => ({
          id: feature.featureId || `plane_${feature.name?.replace(/\s+/g, '_')?.toLowerCase()}`,
          name: feature.name || 'Unnamed Plane',
          type: 'CUSTOM',
          featureId: feature.featureId,
          featureType: feature.featureType
        }));
        
        log.info(`Found ${customPlanes.length} custom planes in features`);
      } catch (featuresError) {
        log.warn(`Failed to get features: ${featuresError.message}`);
      }
      
      // Combine planes
      const allPlanes = [...standardPlanes, ...customPlanes];
      log.info(`Returning ${standardPlanes.length} standard planes and ${customPlanes.length} custom planes`);
      
      res.json({ planes: allPlanes });
    } catch (error) {
      log.error(`Error getting planes: ${error.message}`);
      res.status(500).json({ error: 'Failed to get planes' });
    }
  });

  // Alternative route with different parameter format
  router.get('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      // Set parameters for the main endpoint handler
      req.params.documentId = documentId;
      req.params.elementId = elementId;
      req.query.workspaceId = workspaceId;
      
      // Forward to the main handler
      return router.handle(req, res, router.stack[2].handle);
    } catch (error) {
      log.error(`Error in alternative planes route: ${error.message}`);
      res.status(500).json({ error: 'Failed to get planes' });
    }
  });

  // Catch-all route
  router.all('*', (req, res) => {
    log.warn(`Unknown planes route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Planes endpoint not found' });
  });

  // Log the registered routes for debugging
  log.debug('Planes router routes:');
  router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
      log.debug(`Route ${i + 1}: ${Object.keys(r.route.methods).join(' ')} ${r.route.path}`);
    }
  });

  return router;
};