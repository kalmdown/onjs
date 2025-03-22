/**
 * Planes API route handler
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getOnshapeHeaders } = require('../utils/api-headers');

const log = logger.scope('PlanesRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  
  log.info('Initializing planes API routes');

  /**
   * @route GET /:documentId/w/:workspaceId/e/:elementId
   * @description Get planes for a part studio
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      log.debug(`Getting planes for document: ${documentId}, workspace: ${workspaceId}, element: ${elementId}`);
      
      const onshapeClient = req.onshapeClient || app.get('onshapeClient');
      if (!onshapeClient) {
        log.error('Onshape client not available on request');
        return res.status(500).json({ error: 'API client not available' });
      }
      
      // Create standard planes based on known IDs
      const standardPlanes = [
        { id: "JHD", name: "TOP", type: "STANDARD", transientId: "TOP" },
        { id: "JHC", name: "FRONT", type: "STANDARD", transientId: "FRONT" },
        { id: "JHF", name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      // Always fetch custom planes
      let customPlanes = [];
      try {
        // The client is not automatically applying the API base URL
        // Use the correct endpoint format for features without duplicating "/api/v10"
        const featuresPath = `partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
        
        log.debug(`Fetching features from: ${featuresPath}`);
        
        // Use the exact query parameters that work in the test file
        const featuresResponse = await onshapeClient.get(
          featuresPath, 
          {
            params: {
              rollbackBarIndex: -1,
              includeGeometryIds: true,
              noSketchGeometry: false,
              featureId: 'all'  // Add this parameter to ensure all features are returned
            },
            headers: getOnshapeHeaders()
          }
        );
        
        // Extract features from response
        const features = featuresResponse.features || [];
        
        log.debug(`Retrieved ${features.length} features from API`);
        
        // Filter for plane features
        customPlanes = features.filter(feature => {
          // Check in various properties
          const featureType = (feature.featureType || feature.type || '').toLowerCase();
          const name = (feature.name || '').toLowerCase();
          
          return featureType.includes('plane') || 
                 featureType === 'cplane' ||
                 name.includes('plane') || 
                 name.includes('planar');
        }).map(feature => ({
          id: feature.featureId || `plane_${feature.name?.replace(/\s+/g, '_')?.toLowerCase()}`,
          name: feature.name || 'Unnamed Plane',
          type: 'CUSTOM',
          featureId: feature.featureId,
          featureType: feature.featureType
        }));
        
        log.info(`Found ${customPlanes.length} custom planes in features`);
      } catch (featuresError) {
        log.error(`Failed to get features: ${featuresError.message}`);
        // Continue with standard planes even if custom planes fail
      }
      
      // Combine planes
      const allPlanes = [...standardPlanes, ...customPlanes];
      
      log.info(`Returning ${allPlanes.length} planes (${standardPlanes.length} standard, ${customPlanes.length} custom)`);
      
      res.json(allPlanes);
    } catch (error) {
      log.error(`Error getting planes: ${error.message}`);
      res.status(500).json({ error: 'Failed to get planes', message: error.message });
    }
  });

  // Add this before returning the router
  router.source = __filename;

  return router;
};