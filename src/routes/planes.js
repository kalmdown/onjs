// src/routes/planes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('Planes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  
  // Delay logging until after configuration is loaded
  process.nextTick(() => {
    log.info('Initializing planes API routes');
  });
  
  /**
   * @route GET /api/planes/d/:documentId/w/:workspaceId/e/:elementId
   * @description Get planes for a part studio
   * @access Private
   */
  router.get('/d/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const includeCustomPlanes = req.query.includeCustomPlanes !== 'false';
      
      // Make sure we have a valid workspace ID (not just 'w')
      let actualWorkspaceId = workspaceId;
      if (!actualWorkspaceId || actualWorkspaceId === 'w') {
        try {
          // Fetch workspaces to get the default workspace ID
          log.debug(`Fetching workspaces for document ${documentId} to get actual workspace ID`);
          const workspacesPath = `/documents/${documentId}/workspaces`;
          const workspaces = await req.onshapeClient.get(workspacesPath);
          
          if (workspaces && workspaces.length > 0) {
            // Find default workspace or use the first one
            const defaultWorkspace = workspaces.find(w => w.isDefault) || workspaces[0];
            actualWorkspaceId = defaultWorkspace.id;
            log.debug(`Using actual workspace ID: ${actualWorkspaceId}`);
          } else {
            log.warn(`No workspaces found for document ${documentId}`);
          }
        } catch (wsError) {
          log.error(`Failed to get workspaces: ${wsError.message}`);
          // Continue with default 'w' - will likely fail but we'll return standard planes
        }
      }
      
      log.debug(`Fetching planes for document=${documentId}, workspace=${actualWorkspaceId}, element=${elementId}`, {
        includeCustomPlanes
      });
      
      if (!req.onshapeClient) {
        return res.status(500).json({ error: 'API client not available' });
      }

      // Define standard planes
      const standardPlanes = [
        { id: "JHD", name: "Top", type: "STANDARD", transientId: "TOP" },
        { id: "JFC", name: "Front", type: "STANDARD", transientId: "FRONT" },
        { id: "JGF", name: "Right", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      try {
        // Use actual workspace ID in the API path
        const path = `/partstudios/d/${documentId}/w/${actualWorkspaceId}/e/${elementId}/features`;
        
        log.debug(`Making API request to: ${path}`);
        const featuresResponse = await req.onshapeClient.get(path);
        
        // Add custom planes from features
        if (includeCustomPlanes) {
          let customPlanes = [];
          
          // Process features to find planes
          if (featuresResponse.features && Array.isArray(featuresResponse.features)) {
            log.debug(`Checking ${featuresResponse.features.length} features for planes`);
            
            featuresResponse.features.forEach(feature => {
              // Check if feature is a plane based on feature type
              if (feature.featureType === 'cPlane' || 
                  feature.featureType === 'datumPlane' ||
                  (feature.message && feature.message.featureType === 'cPlane')) {
                
                const planeId = feature.featureId || feature.message?.featureId;
                const planeName = feature.name || feature.message?.name || 'Custom Plane';
                
                if (planeId) {
                  customPlanes.push({
                    id: planeId,
                    name: planeName,
                    type: 'CUSTOM',
                    transientId: planeId,
                    featureType: feature.featureType || feature.message?.featureType || 'unknown'
                  });
                  
                  log.debug(`Found custom plane: ${planeName} (${planeId})`);
                }
              }
            });
          }
          
          // Group planes into default and custom
          const response = {
            defaultPlanes: standardPlanes,
            customPlanes: customPlanes
          };
          
          log.debug(`Returning grouped response with ${standardPlanes.length} default planes and ${customPlanes.length} custom planes`);
          return res.json(response);
        } else {
          // If not including custom planes, just return standard planes
          return res.json({ defaultPlanes: standardPlanes, customPlanes: [] });
        }
      } catch (error) {
        log.error(`Failed to get planes from API: ${error.message}`, error);
        // On error, just use standard planes
        return res.json({ defaultPlanes: standardPlanes, customPlanes: [] });
      }
    } catch (error) {
      log.error(`Error in planes route: ${error.message}`);
      next(error);
    }
  });
  
  // Make source available for debugging
  router.source = __filename;

  return router;
};