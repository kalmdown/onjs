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
  router.post('/convert', isAuthenticated, upload.single('svgFile'), async (req, res, next) => {
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
      
      // Return the result
      res.json({
        success: true,
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
          },
          data: features
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
  router.post('/createFeatures', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId, features } = req.body;
      
      if (!documentId || !workspaceId || !elementId || !features) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, elementId, and features are required'
        });
      }
      
      log.info(`Creating features in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      log.debug(`Creating ${features.sketches?.length || 0} sketches and ${features.features3D?.length || 0} 3D features`);
      
      const createdFeatures = [];
      
      // 1. Create sketches first
      if (features.sketches && features.sketches.length > 0) {
        for (const sketch of features.sketches) {
          // Get the sketch plane (default to TOP if not specified)
          const plane = sketch.plane || 'TOP';
          
          // Create the sketch feature
          const sketchFeature = {
            feature: {
              name: sketch.name || 'SVG Sketch',
              featureType: 'newSketch',
              parameters: [
                {
                  parameterId: 'sketchPlane',
                  queries: [
                    {
                      deterministicIds: [plane],
                      queryType: 8
                    }
                  ]
                }
              ]
            }
          };
          
          // Create the sketch
          const sketchResponse = await req.onshapeClient.post(
            `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
            sketchFeature
          );
          
          log.debug(`Created sketch: ${sketchResponse.feature.name} (${sketchResponse.feature.featureId})`);
          
          // Add sketch entities if available
          if (sketch.entities && sketch.entities.length > 0) {
            const sketchId = sketchResponse.feature.featureId;
            
            // Convert entities to Onshape format
            const mappedEntities = sketch.entities.map(entity => {
              switch (entity.type) {
                case 'line':
                  return {
                    type: 1, // Line
                    parameters: {
                      start: [entity.startPoint.x, entity.startPoint.y],
                      end: [entity.endPoint.x, entity.endPoint.y],
                      isConstruction: entity.isConstruction
                    }
                  };
                case 'circle':
                  return {
                    type: 3, // Circle
                    parameters: {
                      center: [entity.center.x, entity.center.y],
                      radius: entity.radius,
                      isConstruction: entity.isConstruction
                    }
                  };
                // Add other entity types as needed
                default:
                  return null;
              }
            }).filter(e => e !== null);
            
            // Add entities to the sketch
            if (mappedEntities.length > 0) {
              const entitiesResponse = await req.onshapeClient.post(
                `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}/entities`,
                { entities: mappedEntities }
              );
              
              log.debug(`Added ${mappedEntities.length} entities to sketch ${sketchId}`);
            }
            
            // Close the sketch
            await req.onshapeClient.post(
              `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}`,
              { action: 'close' }
            );
            
            log.debug(`Closed sketch ${sketchId}`);
          }
          
          createdFeatures.push({
            type: 'sketch',
            id: sketchResponse.feature.featureId,
            name: sketchResponse.feature.name
          });
        }
      }
      
      // 2. Create 3D features (extrudes, etc.)
      if (features.features3D && features.features3D.length > 0) {
        for (const feature3D of features.features3D) {
          if (feature3D.feature === 'extrude') {
            // Find the sketch ID by name
            const sketchName = feature3D.sketchName;
            const sketchFeature = createdFeatures.find(f => f.type === 'sketch' && f.name === sketchName);
            
            if (!sketchFeature) {
              log.warn(`Could not find sketch "${sketchName}" for extrusion`);
              continue;
            }
            
            // Create extrude feature
            const extrudeFeature = {
              feature: {
                name: feature3D.name || 'SVG Extrude',
                featureType: 'extrude',
                parameters: [
                  {
                    parameterId: 'entities',
                    featureIds: [sketchFeature.id]
                  },
                  {
                    parameterId: 'depth',
                    value: feature3D.depth || 10
                  },
                  {
                    parameterId: 'endCondition',
                    value: 'BlindDepth'
                  },
                  {
                    parameterId: 'direction',
                    value: 'Positive'
                  }
                ]
              }
            };
            
            // Create the extrusion
            const extrudeResponse = await req.onshapeClient.post(
              `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
              extrudeFeature
            );
            
            log.debug(`Created extrusion: ${extrudeResponse.feature.name} (${extrudeResponse.feature.featureId})`);
            
            createdFeatures.push({
              type: 'extrude',
              id: extrudeResponse.feature.featureId,
              name: extrudeResponse.feature.name
            });
          }
        }
      }
      
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