// src/routes/svg-converter.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const logger = require('../utils/logger');
const SVGParser = require('../process-svg/svg-parser');
const PathProcessor = require('../process-svg/path-processor');
const FeatureBuilder = require('../process-svg/feature-builder');
const { ValidationError } = require('../utils/errors');

// Create scoped logger
const log = logger.scope('SVGConverter');

// Server-side storage for processed SVG data
const svgProcessedData = new Map();

// Cleanup old processed data every hour
setInterval(() => {
  const now = Date.now();
  let count = 0;
  
  svgProcessedData.forEach((data, id) => {
    // Remove entries older than 1 hour
    if (now - data.timestamp > 3600000) {
      svgProcessedData.delete(id);
      count++;
    }
  });
  
  if (count > 0) {
    log.debug(`Cleaned up ${count} expired SVG conversions`);
  }
}, 3600000);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only SVG files
    if (file.mimetype === 'image/svg+xml' || 
        file.originalname.toLowerCase().endsWith('.svg')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only SVG files are accepted'), false);
    }
  }
});

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  /**
   * @route POST /api/svg/convert
   * @description Convert an SVG file to Onshape features
   * @access Private
   */
  router.post('/svg/convert', isAuthenticated, upload.single('svgFile'), async (req, res, next) => {
    try {
      let svgContent = '';
      
      // Get SVG content from either file upload or JSON body
      if (req.file) {
        svgContent = req.file.buffer.toString('utf8');
        log.info(`Processing uploaded SVG file: ${req.file.originalname} (${req.file.size} bytes)`);
      } else if (req.body.svgContent) {
        svgContent = req.body.svgContent;
        log.info(`Processing SVG content from request body (${svgContent.length} bytes)`);
      } else {
        return res.status(400).json({
          error: 'Missing SVG content',
          message: 'Please upload an SVG file or provide SVG content in the request body'
        });
      }
      
      // Get conversion options from request
      const options = {
        scale: parseFloat(req.body.scale) || 1.0,
        units: req.body.units || 'mm',
        create3D: req.body.create3D !== 'false',
        extrudeDepth: parseFloat(req.body.extrudeDepth) || 10,
        simplifyPaths: req.body.simplifyPaths !== 'false',
        includeConstructionGeometry: req.body.includeConstructionGeometry !== 'false',
        normalizeOrigin: req.body.normalizeOrigin !== 'false'
      };
      
      log.debug('Conversion options:', options);
      
      // Step 1: Parse SVG using SVGParser
      log.debug('Parsing SVG...');
      const parser = new SVGParser({
        targetUnits: options.units,
        scale: options.scale,
        normalizeOrigin: options.normalizeOrigin
      });
      
      const parsedSvg = parser.parse(svgContent);
      log.debug(`Parsed SVG with ${Object.values(parsedSvg.elements).flat().length} total elements`);
      
      // Step 2: Process paths using PathProcessor
      log.debug('Processing SVG paths...');
      const pathProcessor = new PathProcessor({
        targetUnits: options.units,
        simplifyPaths: options.simplifyPaths,
        autoClosePaths: true,
        processDashedLines: true
      });
      
      const processedPaths = pathProcessor.process(parsedSvg);
      log.debug(`Processed ${processedPaths.paths.length} paths`);
      
      // Step 3: Build Onshape features using FeatureBuilder
      log.debug('Building Onshape features...');
      const featureBuilder = new FeatureBuilder({
        units: options.units,
        create3D: options.create3D,
        defaultExtrusion: options.extrudeDepth,
        preserveConstruction: options.includeConstructionGeometry
      });
      
      const features = featureBuilder.build(processedPaths);
      log.info(`Built ${features.sketches.length} sketches and ${features.features3D.length} 3D features`);
      
      // Generate a unique conversion ID
      const conversionId = `svg-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Store the processed data in server memory
      svgProcessedData.set(conversionId, {
        features,
        options,
        timestamp: Date.now(),
        svgInfo: {
          viewBox: parsedSvg.viewBox,
          elements: {
            paths: parsedSvg.elements.paths?.length || 0,
            circles: parsedSvg.elements.circles?.length || 0,
            ellipses: parsedSvg.elements.ellipses?.length || 0,
            lines: parsedSvg.elements.lines?.length || 0,
            polylines: parsedSvg.elements.polylines?.length || 0,
            polygons: parsedSvg.elements.polygons?.length || 0,
            rects: parsedSvg.elements.rects?.length || 0
          }
        },
        processedPaths: {
          count: processedPaths.paths.length,
          closed: processedPaths.paths.filter(p => p.closed).length,
          open: processedPaths.paths.filter(p => !p.closed).length,
          construction: processedPaths.paths.filter(p => p.isConstruction).length
        }
      });
      
      log.debug(`SVG processing complete, stored with ID: ${conversionId}`);
      
      // Return the conversion info and ID but not the full feature data
      res.json({
        success: true,
        conversionId,
        result: {
          svgInfo: {
            viewBox: parsedSvg.viewBox,
            elements: {
              paths: parsedSvg.elements.paths?.length || 0,
              circles: parsedSvg.elements.circles?.length || 0,
              ellipses: parsedSvg.elements.ellipses?.length || 0,
              lines: parsedSvg.elements.lines?.length || 0,
              polylines: parsedSvg.elements.polylines?.length || 0,
              polygons: parsedSvg.elements.polygons?.length || 0,
              rects: parsedSvg.elements.rects?.length || 0
            }
          },
          processedPaths: {
            count: processedPaths.paths.length,
            closed: processedPaths.paths.filter(p => p.closed).length,
            open: processedPaths.paths.filter(p => !p.closed).length,
            construction: processedPaths.paths.filter(p => p.isConstruction).length
          },
          features: {
            sketches: features.sketches.length,
            features3D: features.features3D.length
          }
        }
      });
    } catch (error) {
      log.error(`SVG conversion error: ${error.message}`, error);
      next(error);
    }
  });

  /**
   * @route POST /api/svg/createFeatures
   * @description Create Onshape features from SVG in a document
   * @access Private
   */
  router.post('/svg/createFeatures', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId, conversionId } = req.body;
      
      if (!documentId || !workspaceId || !elementId) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, elementId are required'
        });
      }

      // Check if we have a conversionId and if it exists in our store
      if (!conversionId) {
        return res.status(400).json({
          error: 'Missing conversion ID',
          message: 'conversionId is required'
        });
      }
      
      if (!svgProcessedData.has(conversionId)) {
        return res.status(404).json({
          error: 'Conversion not found or expired',
          message: 'The specified conversion ID was not found or has expired'
        });
      }
      
      // Retrieve the processed data
      const { features, options } = svgProcessedData.get(conversionId);
      
      log.info(`Creating features in document=${documentId}, workspace=${workspaceId}, element=${elementId} from conversion ${conversionId}`);
      log.debug(`Creating ${features.sketches?.length || 0} sketches only (no extrusions)`);
      
      const createdFeatures = [];
      
      // Create sketches only - no extrusion
      if (features.sketches && features.sketches.length > 0) {
        for (const sketch of features.sketches) {
          try {
            // Get the sketch plane (default to TOP if not specified)
            const plane = sketch.plane || 'TOP';
            
            // Create the sketch feature with proper format for Onshape API
            const sketchFeature = {
              type: 0,
              typeName: "BTMFeature",
              message: {
                featureType: "newSketch",
                name: sketch.name || 'SVG Sketch',
                parameters: [
                  {
                    type: 0,
                    typeName: "BTMParameterFeature",
                    message: {
                      parameterId: "sketchPlane",
                      queries: [
                        {
                          type: 0,
                          typeName: "BTMIndividualQuery",
                          message: {
                            queryType: 8,
                            deterministic: true,
                            featureId: "TOP"
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            };
            
            log.debug(`Creating sketch with payload: ${JSON.stringify(sketchFeature)}`);
            
            // Create the sketch using the Onshape client
            const sketchResponse = await req.onshapeClient.post(
              `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
              sketchFeature
            );
            
            log.debug(`Created sketch: ${sketchResponse.feature.name} (${sketchResponse.feature.featureId})`);
            
            // Add sketch entities if available
            if (sketch.entities && sketch.entities.length > 0) {
              const sketchId = sketchResponse.feature.featureId;
              
              // Break entities into smaller chunks to avoid payload size issues
              const chunkSize = 20;
              const entityChunks = [];
              
              for (let i = 0; i < sketch.entities.length; i += chunkSize) {
                entityChunks.push(sketch.entities.slice(i, i + chunkSize));
              }
              
              log.debug(`Adding ${sketch.entities.length} entities in ${entityChunks.length} chunks`);
              
              // Process each chunk of entities
              for (let chunkIndex = 0; chunkIndex < entityChunks.length; chunkIndex++) {
                const chunk = entityChunks[chunkIndex];
                
                // Convert entities to Onshape format
                const mappedEntities = chunk.map(entity => {
                  switch (entity.type) {
                    case 'line':
                      return {
                        type: 1, // Line
                        parameters: {
                          start: [entity.startPoint.x, entity.startPoint.y],
                          end: [entity.endPoint.x, entity.endPoint.y],
                          isConstruction: !!entity.isConstruction
                        }
                      };
                    case 'circle':
                      return {
                        type: 3, // Circle
                        parameters: {
                          center: [entity.center.x, entity.center.y],
                          radius: entity.radius,
                          isConstruction: !!entity.isConstruction
                        }
                      };
                    case 'arc':
                      return {
                        type: 2, // Arc
                        parameters: {
                          start: [entity.startPoint.x, entity.startPoint.y],
                          mid: [entity.midPoint.x, entity.midPoint.y],
                          end: [entity.endPoint.x, entity.endPoint.y],
                          isConstruction: !!entity.isConstruction
                        }
                      };
                    case 'spline':
                      return {
                        type: 4, // Spline
                        parameters: {
                          controlPoints: entity.controlPoints.map(pt => [pt.x, pt.y]),
                          isConstruction: !!entity.isConstruction
                        }
                      };
                    default:
                      log.warn(`Unsupported entity type: ${entity.type}`);
                      return null;
                  }
                }).filter(e => e !== null);
                
                if (mappedEntities.length === 0) {
                  continue;
                }
                
                // Add entities to the sketch
                log.debug(`Adding chunk ${chunkIndex + 1}/${entityChunks.length} with ${mappedEntities.length} entities`);
                
                try {
                  const entitiesPayload = { entities: mappedEntities };
                  
                  const entitiesResponse = await req.onshapeClient.post(
                    `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}/entities`,
                    entitiesPayload
                  );
                  
                  log.debug(`Added ${mappedEntities.length} entities to sketch ${sketchId}`);
                } catch (entityError) {
                  log.error(`Error adding entities to sketch: ${entityError.message}`, entityError);
                  // Continue with other chunks even if one fails
                }
              }
              
              // Close the sketch
              try {
                await req.onshapeClient.post(
                  `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}`,
                  { action: 'close' }
                );
                
                log.debug(`Closed sketch ${sketchId}`);
              } catch (closeError) {
                log.error(`Error closing sketch: ${closeError.message}`, closeError);
                // Continue with other sketches even if closing one fails
              }
            }
            
            createdFeatures.push({
              type: 'sketch',
              id: sketchResponse.feature.featureId,
              name: sketchResponse.feature.name
            });
          } catch (sketchError) {
            log.error(`Error creating sketch: ${sketchError.message}`, sketchError);
            // Continue with other sketches even if one fails
          }
        }
      }
      
      // Clean up the stored data
      svgProcessedData.delete(conversionId);
      
      // Return the created features
      res.json({
        success: true,
        documentId,
        workspaceId,
        elementId,
        features: createdFeatures,
        link: `https://cad.onshape.com/documents/${documentId}/w/${workspaceId}/e/${elementId}`
      });
    } catch (error) {
      log.error(`Error creating features: ${error.message}`, error);
      next(error);
    }
  });

  router.source = __filename;
  
  return router;
};