/**
 * Planes API route handler
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('PlanesRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;
  
  // Add diagnostics to verify router registration and mounting
  log.info('Initializing planes API routes');
  
  // Add diagnostic middleware to log all incoming requests with full URL
  router.use((req, res, next) => {
    log.debug(`Planes router received: ${req.method} ${req.baseUrl}${req.path}`);
    log.debug(`Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    next();
  });
  
  // Add a root route to verify the router is working
  router.get('/', (req, res) => {
    log.info('Root planes route accessed');
    return res.json({ message: 'Planes API endpoint working' });
  });

  /**
   * @route GET /api/documents/:documentId/elements/:elementId/planes
   * @description Get planes for a part studio (document/element format)
   * @access Private
   */
  router.get('/documents/:documentId/elements/:elementId/planes', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, elementId } = req.params;
      const workspaceId = req.query.workspaceId;
      const includeCustomPlanes = req.query.includeCustomPlanes === 'true';
      
      if (!workspaceId) {
        return res.status(400).json({
          error: 'Missing workspaceId parameter',
          message: 'The workspaceId parameter is required'
        });
      }
      
      // Forward to the main handler
      return handlePlanesRequest(req, res, next, documentId, workspaceId, elementId, includeCustomPlanes);
    } catch (error) {
      log.error(`Error in document/element format handler: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/planes/:documentId/w/:workspaceId/e/:elementId
   * @description Get planes for a part studio (direct path format)
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const includeCustomPlanes = req.query.includeCustomPlanes === 'true';
      
      // Log the request for debugging
      log.info(`Direct path request for planes: ${req.baseUrl}${req.path}`);
      log.debug(`Parameters: documentId=${documentId}, workspaceId=${workspaceId}, elementId=${elementId}`);
      log.debug(`includeCustomPlanes=${includeCustomPlanes}`);
      
      // Forward to the main handler
      return handlePlanesRequest(req, res, next, documentId, workspaceId, elementId, includeCustomPlanes);
    } catch (error) {
      log.error(`Error in direct path handler: ${error.message}`);
      next(error);
    }
  });

  /**
   * Handle planes request with common logic
   */
  async function handlePlanesRequest(req, res, next, documentId, workspaceId, elementId, includeCustomPlanes) {
    try {
      log.info(`Fetching planes for element ${elementId} with includeCustomPlanes=${includeCustomPlanes}`);
      
      // First, get standard planes from the planes API
      const apiPath = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/planes`;
      
      // We'll fetch standard planes regardless of includeCustomPlanes setting
      log.debug(`Making API request to get standard planes: ${apiPath}`);
      
      // Check if Onshape client is properly attached
      if (!req.onshapeClient) {
        log.error('Onshape client not attached to request');
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Onshape client not available'
        });
      }
      
      let standardPlanes = [];
      
      // Get standard planes first
      try {
        const response = await req.onshapeClient.get(apiPath);
        
        if (response && response.status === 200) {
          // Process the API response to extract the planes
          try {
            const planesData = response.data;
            
            if (Array.isArray(planesData)) {
              standardPlanes = planesData;
            } else if (planesData && planesData.planes) {
              standardPlanes = planesData.planes;
            } else if (planesData && planesData.referencePlanes) {
              standardPlanes = planesData.referencePlanes;
            }
            
            // Filter to only keep standard planes
            standardPlanes = standardPlanes.filter(p => p.type === 'STANDARD' || !p.type);
            
            log.debug(`API returned ${standardPlanes.length} standard planes`);
          } catch (processError) {
            log.warn(`Could not process standard planes: ${processError.message}`);
            // Default standard planes as fallback
            standardPlanes = getDefaultStandardPlanes(elementId);
          }
        } else {
          log.error(`Failed to get standard planes: ${response?.status} ${response?.statusText}`);
          // Default standard planes as fallback
          standardPlanes = getDefaultStandardPlanes(elementId);
        }
      } catch (standardError) {
        log.error(`Error getting standard planes: ${standardError.message}`);
        // Default standard planes as fallback
        standardPlanes = getDefaultStandardPlanes(elementId);
      }
      
      // If custom planes are requested, get them from features endpoint
      let customPlanes = [];

      if (includeCustomPlanes) {
        log.info('Getting custom planes from features endpoint');
        
        try {
          // Check if we need to use a different version of the API for features
          // Try the latest version first (v10)
          let featuresPath = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
          let featuresResponse = null;
          
          try {
            log.debug(`Fetching features from latest API: ${featuresPath}`);
            featuresResponse = await req.onshapeClient.get(featuresPath);
          } catch (latestApiError) {
            // If latest API fails, try an alternate endpoint that might work with older versions
            log.warn(`Latest API features endpoint failed, trying alternate: ${latestApiError.message}`);
            
            const alternateFeaturePath = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/featurelist`;
            log.debug(`Trying alternate features endpoint: ${alternateFeaturePath}`);
            try {
              featuresResponse = await req.onshapeClient.get(alternateFeaturePath);
            } catch (alternateError) {
              // Both endpoints failed, log and continue
              log.error(`Alternate features endpoint also failed: ${alternateError.message}`);
            }
          }
          
          if (featuresResponse && featuresResponse.status === 200) {
            // Capture and log complete response data for debugging
            const responseData = featuresResponse.data;
            log.debug(`Features response received with status ${featuresResponse.status}`);
            
            // Since the structure might vary, let's try to be flexible in how we extract features
            let features = [];
            
            if (responseData.features && Array.isArray(responseData.features)) {
              features = responseData.features;
              log.debug(`Found ${features.length} features in 'features' array`);
            } else if (Array.isArray(responseData)) {
              features = responseData;
              log.debug(`Found ${features.length} features in root array`);
            } else {
              // Try to find any array property that might contain features
              const arrayProps = Object.keys(responseData).filter(
                key => Array.isArray(responseData[key]) && responseData[key].length > 0
              );
              
              if (arrayProps.length > 0) {
                const firstArrayProp = arrayProps[0];
                features = responseData[firstArrayProp];
                log.debug(`Found ${features.length} potential features in '${firstArrayProp}' property`);
              }
            }
            
            if (features.length === 0) {
              log.warn('No features found in response');
              log.debug(`Response keys: ${Object.keys(responseData).join(', ')}`);
              
              // If we have a large object, don't log the whole thing
              const responseDataString = JSON.stringify(responseData).substring(0, 500);
              log.debug(`Response preview: ${responseDataString}${responseDataString.length >= 500 ? '...' : ''}`);
            } else {
              // List all feature types for debugging
              const featureTypes = [...new Set(features.map(f => f.featureType || f.type || 'unknown'))];
              log.debug(`Available feature types: ${JSON.stringify(featureTypes)}`);
              
              // Get all feature property keys to better understand the structure
              const sampleFeature = features[0];
              log.debug(`Sample feature keys: ${Object.keys(sampleFeature).join(', ')}`);
              
              // Enhanced filter for plane features using more flexible criteria
              const planeFeatures = features.filter(f => {
                // Look for plane indicators in different possible properties
                const featureType = (f.featureType || f.type || '').toLowerCase();
                const name = (f.name || '').toLowerCase();
                const message = (f.message || '').toLowerCase();
                const featureId = f.id || f.featureId;
                
                // Check if any property has "plane" in it
                const hasPlaneInProps = Object.keys(f).some(key => {
                  const value = f[key];
                  return typeof value === 'string' && value.toLowerCase().includes('plane');
                });
                
                return (
                  // Check feature type
                  featureType.includes('plane') || 
                  featureType === 'importedplanarsurface' || 
                  featureType === 'offsetdatumplane' || 
                  featureType === 'datum' ||
                  
                  // Check name
                  name.includes('plane') || 
                  name.includes('datum') ||
                  name.includes('surface') ||
                  
                  // Check message
                  message.includes('plane') ||
                  
                  // Check if it looks like a plane feature ID
                  (featureId && /plane|datum|surface/i.test(featureId)) ||
                  
                  // Any property with "plane" in it
                  hasPlaneInProps
                );
              });
              
              log.debug(`Found ${planeFeatures.length} potential plane features`);
              
              // Log details of the first few found planes
              if (planeFeatures.length > 0) {
                planeFeatures.slice(0, Math.min(3, planeFeatures.length)).forEach((feature, index) => {
                  const featureType = feature.featureType || feature.type || 'unknown';
                  const featureName = feature.name || `Feature ${feature.id || feature.featureId || index}`;
                  const featureId = feature.id || feature.featureId || 'unknown';
                  
                  log.debug(`Plane feature ${index}: type=${featureType}, name=${featureName}, id=${featureId}`);
                  
                  // Log more details about the feature structure
                  const featureKeys = Object.keys(feature);
                  log.debug(`Feature ${index} properties: ${featureKeys.join(', ')}`);
                });
              }
              
              // Extract plane data from features with better property access
              customPlanes = planeFeatures.map(f => {
                const featureId = f.id || f.featureId || `unknown_${Math.random().toString(36).substring(2, 10)}`;
                const featureType = f.featureType || f.type || 'unknown';
                
                // Generate a unique, stable ID for the plane
                const planeId = `${elementId}_custom_${featureId}`;
                
                // Create a descriptive name based on available information
                let planeName = f.name;
                if (!planeName) {
                  // Try to construct a meaningful name if none exists
                  if (featureType.toLowerCase().includes('plane')) {
                    planeName = `${featureType.charAt(0).toUpperCase() + featureType.slice(1)} ${featureId.substring(0, 8)}`;
                  } else {
                    planeName = `Custom Plane ${featureId.substring(0, 8)}`;
                  }
                }
                
                // Add feature type indicator if not already in the name
                const featureTypeLabel = getFeatureTypeLabel(featureType);
                if (featureTypeLabel && !planeName.includes(featureTypeLabel)) {
                  planeName = `${planeName} (${featureTypeLabel})`;
                }
                
                // Basic plane object structure expected by the client
                const planeObject = {
                  id: planeId,
                  name: planeName,
                  type: 'CUSTOM',
                  transientId: featureId,
                  featureType: featureType
                };
                
                // Add additional properties if available to help with visualization
                if (f.normal) {
                  planeObject.normal = f.normal;
                }
                
                if (f.origin) {
                  planeObject.origin = f.origin;
                }
                
                // Extract position/orientation data if available
                ['position', 'orientation', 'parameters', 'transform'].forEach(prop => {
                  if (f[prop]) {
                    planeObject[prop] = f[prop];
                  }
                });
                
                return planeObject;
              });
              
              log.debug(`Extracted ${customPlanes.length} custom planes from features`);
            }
          } else if (featuresResponse) {
            log.warn(`Failed to get features: ${featuresResponse.status} ${featuresResponse.statusText}`);
            if (featuresResponse.data) {
              log.debug(`Features response error: ${JSON.stringify(featuresResponse.data)}`);
            }
          } else {
            log.warn('No valid features response received');
          }
        } catch (featuresError) {
          log.error(`Failed to get custom planes from features endpoint: ${featuresError.message}`);
          if (featuresError.response) {
            log.error(`Features API error details: ${JSON.stringify(featuresError.response.data)}`);
          } else if (featuresError.stack) {
            log.debug(`Features error stack: ${featuresError.stack}`);
          }
        }
      }
      
      // Combine standard and custom planes
      const combinedPlanes = [...standardPlanes, ...customPlanes];
      
      log.info(`Returning ${standardPlanes.length} standard planes and ${customPlanes.length} custom planes`);
      return res.json(combinedPlanes);
      
    } catch (error) {
      log.error(`Error fetching planes: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get default standard planes
   * @param {string} elementId - Element ID to use for plane IDs
   * @returns {Array} Standard planes
   */
  function getDefaultStandardPlanes(elementId) {
    return [
      { id: `${elementId}_JHD`, name: "TOP", type: "STANDARD", transientId: "TOP" },
      { id: `${elementId}_JFD`, name: "FRONT", type: "STANDARD", transientId: "FRONT" },
      { id: `${elementId}_JGD`, name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
    ];
  }

  // Helper function to get a user-friendly label for feature types
  function getFeatureTypeLabel(featureType) {
    if (!featureType) return 'Custom';
    
    switch (featureType.toLowerCase()) {
      case 'plane':
        return 'Datum Plane';
      case 'importedplanarsurface':
        return 'Imported Plane';
      case 'offsetdatumplane':
        return 'Offset Plane';
      default:
        return featureType.charAt(0).toUpperCase() + featureType.slice(1);
    }
  }

  // Add a catch-all route for unmatched requests with detailed logging
  router.all('*', (req, res) => {
    log.warn(`Unmatched planes route: ${req.method} ${req.originalUrl}`);
    log.warn(`Path: ${req.path}, Params: ${JSON.stringify(req.params)}`);
    res.status(404).json({
      error: 'Route not found',
      message: 'The requested planes endpoint does not exist',
      requestedUrl: req.originalUrl,
      availableRoutes: [
        '/api/planes/',
        '/api/planes/:documentId/w/:workspaceId/e/:elementId'
      ]
    });
  });

  // Log the registered routes for debugging
  log.debug('Planes router routes:');
  router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
      log.debug(`Route ${i}: ${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
    }
  });

  return router;
}