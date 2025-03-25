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
   * Helper function to extract plane information from feature
   * @param {Object} feature - Feature object
   * @returns {Object|null} - Plane object or null if not a plane
   */
  function extractPlaneFromFeature(feature) {
    // Skip if feature is not defined
    if (!feature) return null;
    
    // Skip features that are actual sketches
    if (feature.featureType === 'newSketch' || 
        feature.typeName === 'BTMSketch') {
      return null;
    }
    
    // We need to check if this is a default plane
    const isDefaultPlane = feature.featureType === 'defaultPlane';
    
    // Check if it's a BTMFeature with a cPlane in message
    if (feature.type === 134 && feature.typeName === "BTMFeature" && feature.message) {
      if (feature.message.featureType === 'cPlane') {
        return {
          id: feature.message.featureId,
          name: feature.message.name || 'Custom Plane',
          type: 'CUSTOM',
          transientId: feature.message.featureId,
          featureType: feature.message.featureType
        };
      }
    }

    // Check if it's a plane feature based on direct message properties
    if (feature.message && feature.message.featureType === 'cPlane') {
      return {
        id: feature.message.featureId || feature.featureId,
        name: feature.message.name || 'Custom Plane',
        type: 'CUSTOM',
        transientId: feature.message.featureId || feature.featureId,
        featureType: feature.message.featureType
      };
    }

    // Check based on feature properties
    const featureType = (feature.featureType || '').toLowerCase();
    
    // Include actual plane features
    if (featureType === 'cplane' || featureType === 'datumplane' || 
        (feature.message && feature.message.featureType === 'cPlane')) {
      return {
        id: feature.featureId || feature.message?.featureId || `plane_${Math.random().toString(36).substring(2, 10)}`,
        name: feature.name || feature.message?.name || 'Custom Plane',
        type: 'CUSTOM',
        transientId: feature.featureId || feature.message?.featureId,
        featureType: feature.featureType || feature.message?.featureType
      };
    }

    return null;
  }

  /**
   * @route GET /api/planes/:documentId/w/:workspaceId/e/:elementId
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

      // Initialize planes array with standard planes
      let planes = [...standardPlanes];
      
      try {
        // Use actual workspace ID in the API path
        const path = `/partstudios/d/${documentId}/w/${actualWorkspaceId}/e/${elementId}/features`;
        
        log.debug(`Making API request to: ${path}`);
        const featuresResponse = await req.onshapeClient.get(path);
        
        // Add custom planes from features
        if (includeCustomPlanes) {
          let customPlanes = [];
          
          // First check default features
          if (featuresResponse.defaultFeatures && Array.isArray(featuresResponse.defaultFeatures)) {
            log.debug(`Checking ${featuresResponse.defaultFeatures.length} default features for planes`);
            
            // Skip these when looking for custom planes, they're already covered by standard planes
            const defaultFeaturesToSkip = ["Top", "Front", "Right", "Origin"];
            
            featuresResponse.defaultFeatures.forEach(feature => {
              // Skip standard default planes that we already include
              if (feature.name && defaultFeaturesToSkip.includes(feature.name)) {
                return;
              }
              
              const plane = extractPlaneFromFeature(feature);
              if (plane) {
                customPlanes.push(plane);
                log.debug(`Found custom plane in default features: ${plane.name}`);
              }
            });
          }
          
          // Then check regular features
          if (featuresResponse.features && Array.isArray(featuresResponse.features)) {
            log.debug(`Checking ${featuresResponse.features.length} features for planes`);
            
            featuresResponse.features.forEach(feature => {
              const plane = extractPlaneFromFeature(feature);
              if (plane) {
                customPlanes.push(plane);
                log.debug(`Found custom plane in features: ${plane.name}`);
              }

            });
          }
          
          // Final fallback: recursively search through the response for any objects that might be planes
          // This finds planes that are deeply nested in the response structure
          function findPlanesInObject(obj, path = '') {
            if (!obj || typeof obj !== 'object') return;
            
            // Check if this object might be a plane feature
            if (obj.featureType === 'cPlane') {
              // Skip objects that are actual sketches (not just containing the word sketch)
              if (obj.featureType === 'newSketch') {
                return;
              }
              
              // Avoid duplicates - only add if we don't already have a plane with this ID
              const isDuplicate = customPlanes.some(p => 
                (obj.featureId && p.id === obj.featureId)
              );
              
              if (!isDuplicate && obj.featureId && obj.name) {
                log.debug(`Found custom plane at ${path}: ${obj.name} (${obj.featureId})`);
                
                customPlanes.push({
                  id: obj.featureId,
                  name: obj.name,
                  type: 'CUSTOM',
                  transientId: obj.featureId,
                  featureType: obj.featureType || 'unknown'
                });
              }
            }
            
            // Recursively search nested objects
            for (const key in obj) {
              if (obj[key] && typeof obj[key] === 'object') {
                findPlanesInObject(obj[key], `${path}.${key}`);
              }
            }
          }
          
          // Apply the deep search on the features response
          log.debug('Performing deep search for plane features');
          findPlanesInObject(featuresResponse, 'root');
          
          // Log all found planes for debugging
          if (customPlanes.length > 0) {
            log.debug(`Found ${customPlanes.length} total custom planes:`);
            customPlanes.forEach(plane => {
              log.debug(`- ${plane.name} (ID: ${plane.id}, Type: ${plane.featureType || 'unknown'})`);
            });
          } else {
            log.debug('No custom planes found in the response');
          }
          
          // Filter and deduplicate custom planes
          if (customPlanes.length > 0) {
            // Deduplicate by ID (keep first occurrence)
            const uniqueIds = new Set();
            const uniqueCustomPlanes = customPlanes.filter(plane => {
              if (!plane.id || uniqueIds.has(plane.id)) return false;
              uniqueIds.add(plane.id);
              return true;
            });
            
            log.debug(`Adding ${uniqueCustomPlanes.length} custom planes to result after filtering`);
            
            // Group planes into default and custom
            const response = {
              defaultPlanes: standardPlanes,
              customPlanes: uniqueCustomPlanes
            };
            
            log.debug(`Returning grouped response with ${standardPlanes.length} default planes and ${uniqueCustomPlanes.length} custom planes`);
            return res.json(response);
          } else {
            // No custom planes, just return standard planes
            const response = {
              defaultPlanes: standardPlanes
            };
            
            log.debug(`Returning only default planes (${standardPlanes.length})`);
            return res.json(response);
          }
        }
      } catch (error) {
        log.error(`Failed to get planes from API: ${error.message}`, error);
        // On error, just use standard planes (already in the planes array)
      }
      
      log.debug(`Returning ${planes.length} planes (${standardPlanes.length} standard, ${planes.length - standardPlanes.length} custom)`);
      return res.json(planes);
      
    } catch (error) {
      log.error(`Error in planes route: ${error.message}`);
      next(error);
    }
  });

  // Make source available for debugging
  router.source = __filename;

  return router;
};