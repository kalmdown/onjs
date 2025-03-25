// src/routes/svg-routes.js
const express = require('express');
const multer = require('multer');
const SVGParser = require('../process-svg/svg-parser');
const PathProcessor = require('../process-svg/path-processor');
const FeatureBuilder = require('../process-svg/feature-builder');
const { createFeaturesInOnshape } = require('../process-svg/svg-converter');
const logger = require('../utils/logger');
const log = logger.scope('SVGRoutes');

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

// Export a function that returns a router (consistent with other route files)
module.exports = function(app, auth) {
  const router = express.Router();

  // Configure multer for memory storage
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit for SVG files
    }
  });

  // Route for processing SVG files - checking if auth middleware exists
  const authMiddleware = auth && typeof auth.authenticate === 'function' 
    ? auth.authenticate 
    : (req, res, next) => next(); // Fallback middleware if auth not available

  router.post('/svg/process', authMiddleware, upload.single('svgFile'), async (req, res) => {
    try {
      log.debug('Received SVG file upload request');
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No SVG file provided'
        });
      }
      
      // Get the uploaded SVG file
      const svgContent = req.file.buffer.toString('utf8');
      
      // Get processing options from request
      const options = JSON.parse(req.body.options || '{}');
      log.debug(`Processing with options: ${JSON.stringify(options)}`);
      
      // Process SVG on the server
      const svgParser = new SVGParser(options);
      const parsedData = svgParser.parse(svgContent);
      
      const pathProcessor = new PathProcessor(options);
      const processedPaths = pathProcessor.process(parsedData);
      
      const featureBuilder = new FeatureBuilder(options);
      const features = featureBuilder.build(processedPaths);
      
      // Generate a unique conversion ID
      const conversionId = `svg-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Store the processed data in server memory
      svgProcessedData.set(conversionId, {
        features,
        options,
        timestamp: Date.now()
      });
      
      log.debug(`SVG processing complete, stored with ID: ${conversionId}`);
      
      // Only return the conversion ID to the client, not the full feature data
      res.json({
        success: true,
        conversionId
      });
    } catch (error) {
      log.error(`SVG processing error: ${error.message}`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // New endpoint to create features using a conversion ID
  router.post('/svg/createFeatures', authMiddleware, async (req, res) => {
    try {
      const { documentId, workspaceId, elementId, conversionId } = req.body;
      
      if (!conversionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing conversion ID'
        });
      }
      
      if (!svgProcessedData.has(conversionId)) {
        return res.status(404).json({
          success: false,
          error: 'Conversion not found or expired'
        });
      }
      
      // Retrieve the processed data
      const { features, options } = svgProcessedData.get(conversionId);
      
      // Merge options with the incoming parameters
      const mergedOptions = {
        ...options,
        documentId,
        workspaceId,
        elementId
      };
      
      // Create features in Onshape
      const result = await createFeaturesInOnshape(features, mergedOptions);
      
      // Clean up the stored data
      svgProcessedData.delete(conversionId);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      log.error(`Feature creation error: ${error.message}`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
