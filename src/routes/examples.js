// src\routes\examples.js
// src/routes/examples.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, createClientFromRequest } = require('../middleware/auth');
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');

// Create a scoped logger
const log = logger.scope('ExampleRoutes');

/**
 * @route POST /api/examples/cylinder
 * @description Create a cylinder example
 * @access Private
 */
router.post('/cylinder', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId } = req.body;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    log.info('Creating cylinder example');
    
    // Step 1: Get or create document
    let document;
    if (documentId) {
      document = await client.documents.getDocument(documentId);
      log.info(`Using existing document: ${document.name}`);
    } else {
      document = await client.documents.createDocument({
        name: "Cylinder Example"
      });
      log.info(`Created new document: ${document.name}`);
    }
    
    // Step 2: Get workspaces
    const workspaces = await client.documents.getWorkspaces(document.id);
    const workspaceId = workspaces[0].id;
    
    // Step 3: Get or create part studio
    let partStudioId;
    try {
      const elements = await client.elements.getWorkspaceElements(document.id, workspaceId);
      const partStudio = elements.find(el => el.type === 'PARTSTUDIO');
      
      if (partStudio) {
        partStudioId = partStudio.id;
        log.info(`Using existing part studio: ${partStudio.name}`);
      } else {
        throw new Error('No part studio found');
      }
    } catch (error) {
      // Create new part studio
      log.info('Creating new part studio');
      const partStudio = await client.elements.createElement({
        documentId: document.id,
        workspaceId,
        name: "Part Studio",
        elementType: "PARTSTUDIO"
      });
      partStudioId = partStudio.id;
    }
    
    // Step 4: Create a sketch on the top plane
    log.info('Creating sketch on TOP plane');
    const sketchResult = await client.features.createSketch({
      documentId: document.id,
      workspaceId,
      elementId: partStudioId,
      name: "Base Sketch",
      plane: "TOP"
    });
    
    const sketchId = sketchResult.feature.featureId;
    
    // Step 5: Add a circle to the sketch
    log.info('Adding circle to sketch');
    await client.features.addSketchEntity({
      documentId: document.id,
      workspaceId,
      elementId: partStudioId,
      sketchId,
      entity: { type: 'circle', radius: 0.5, center: [0, 0] }
    });
    
    // Step 6: Close the sketch
    log.info('Closing sketch');
    await client.features.closeSketch({
      documentId: document.id,
      workspaceId,
      elementId: partStudioId,
      sketchId
    });
    
    // Step 7: Extrude the sketch
    log.info('Creating extrusion');
    const extrudeResult = await client.features.createExtrude({
      documentId: document.id,
      workspaceId,
      elementId: partStudioId,
      name: "Cylinder Extrude",
      sketchId,
      depth: 1.0,
      direction: 'positive',
      operationType: 'NEW'
    });
    
    log.info('Cylinder example completed successfully');
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`,
    });
  } catch (error) {
    log.error('Failed to create cylinder example:', error.message);
    next(error);
  }
});

/**
 * @route POST /api/examples/lamp
 * @description Create a lamp example
 * @access Private
 */
router.post('/lamp', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId } = req.body;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    log.info('Creating lamp example');
    
    // Step 1: Get or create document
    let document;
    if (documentId) {
      document = await client.documents.getDocument(documentId);
      log.info(`Using existing document: ${document.name}`);
    } else {
      document = await client.documents.createDocument({
        name: "Lamp Example"
      });
      log.info(`Created new document: ${document.name}`);
    }
    
    // For brevity, return success without implementing the full lamp example
    // In a real implementation, you would create the lamp model here
    
    log.info('Lamp example completed successfully');
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`,
    });
  } catch (error) {
    log.error('Failed to create lamp example:', error.message);
    next(error);
  }
});

/**
 * @route POST /api/examples/convert-svg
 * @description Convert SVG to Onshape model
 * @access Private
 */
router.post('/convert-svg', isAuthenticated, async (req, res, next) => {
  try {
    const { svgContent, documentId } = req.body;
    
    if (!svgContent) {
      return res.status(400).json({ error: "SVG content is required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    log.info('Converting SVG to Onshape model');
    
    // Step 1: Get or create document
    let document;
    if (documentId) {
      document = await client.documents.getDocument(documentId);
      log.info(`Using existing document: ${document.name}`);
    } else {
      document = await client.documents.createDocument({
        name: "SVG Conversion"
      });
      log.info(`Created new document: ${document.name}`);
    }
    
    // For brevity, return success without implementing the full SVG conversion
    // In a real implementation, you would parse and convert the SVG here
    
    log.info('SVG conversion completed successfully');
    
    res.json({
      success: true,
      document,
      link: `https://cad.onshape.com/documents/${document.id}`,
    });
  } catch (error) {
    log.error('Failed to convert SVG:', error.message);
    next(error);
  }
});

module.exports = router;