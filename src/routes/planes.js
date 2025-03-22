// src/routes/planes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('PlanesRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  
  log.info('Initializing planes API routes');

  /**
   * @route GET /api/planes/:documentId/w/:workspaceId/e/:elementId
   * @description Get planes for a part studio
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const includeCustomPlanes = req.query.includeCustomPlanes !== 'false';
      
      log.debug(`Fetching planes for document=${documentId}, workspace=${workspaceId}, element=${elementId}`, {
        includeCustomPlanes
      });
      
      if (!req.onshapeClient) {
        return res.status(500).json({ error: 'API client not available' });
      }

      // First prepare standard planes as a fallback in case the API call fails
      const standardPlanes = [
        { id: "JHD", name: "TOP", type: "STANDARD", transientId: "TOP" },
        { id: "JFD", name: "FRONT", type: "STANDARD", transientId: "FRONT" },
        { id: "JGF", name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      try {
        // Try the direct API path for fetching planes
        // Using the proper API path format: /api/partstudios/d/{did}/w/{wid}/e/{eid}/planes
        const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/referencefeatures`;
        const queryParams = { includeCustomPlanes };
        
        log.debug(`Making API request to: ${path}`);
        const planesResponse = await req.onshapeClient.get(path, { params: queryParams });
        
        if (!planesResponse) {
          log.warn('No planes returned from API, using standard planes');
          return res.json(standardPlanes);
        }
        
        // Handle different response formats from the API
        let planes;
        
        if (Array.isArray(planesResponse)) {
          // Direct array of planes
          planes = planesResponse;
        } else if (planesResponse.referencePlanes) {
          // Reference planes in an object
          planes = planesResponse.referencePlanes;
        } else if (planesResponse.features) {
          // Features list - extract plane features
          const planeFeatures = planesResponse.features.filter(feature => {
            return feature.message?.planeName || 
                 feature.message?.name?.toLowerCase().includes('plane') ||
                 feature.name?.toLowerCase().includes('plane');
          });
          
          planes = planeFeatures.map(feature => ({
            id: feature.featureId,
            name: feature.message?.planeName || feature.message?.name || feature.name,
            type: 'CUSTOM',
            transientId: feature.featureId
          }));
          
          // Add standard planes
          planes = [...standardPlanes, ...planes];
        } else {
          // If response format is unrecognized, fall back to standard planes
          log.warn('Unknown planes response format, using standard planes');
          planes = standardPlanes;
        }
        
        log.debug(`Returning ${planes.length} planes`);
        return res.json(planes);
      } catch (error) {
        log.error(`Failed to get planes from API: ${error.message}`);
        
        // Fall back to standard planes on error
        return res.json(standardPlanes);
      }
    } catch (error) {
      log.error(`Error in planes route: ${error.message}`);
      next(error);
    }
  });

  return router;
};