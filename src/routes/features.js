// src\routes\features.js
// src/routes/features.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, createClientFromRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');

// Create a scoped logger
const log = logger.scope('FeatureRoutes');

/**
 * @route GET /api/features/:documentId/w/:workspaceId/e/:elementId
 * @description Get all features in a part studio
 * @access Private
 */
router.get('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get features
    const features = await client.features.getFeatures(documentId, workspaceId, elementId);
    
    res.json({ features });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId
 * @description Create a new feature
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    const feature = req.body.feature || req.body; // Support both { feature } and direct feature object
    
    if (!feature) {
      return res.status(400).json({ error: "Feature definition is required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Create feature
    const result = await client.features.createFeature({
      documentId,
      workspaceId,
      elementId,
      feature
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/sketches
 * @description Create a new sketch feature
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/e/:elementId/sketches', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    const { name, plane } = req.body;
    
    if (!plane) {
      return res.status(400).json({ error: "Sketch plane is required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Create sketch
    const result = await client.features.createSketch({
      documentId,
      workspaceId,
      elementId,
      name: name || 'New Sketch',
      plane
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId/entities
 * @description Add entity to a sketch
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId/entities', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId, sketchId } = req.params;
    const entity = req.body;
    
    if (!entity || !entity.type) {
      return res.status(400).json({ error: "Entity definition with type is required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Add sketch entity
    const result = await client.features.addSketchEntity({
      documentId,
      workspaceId,
      elementId,
      sketchId,
      entity
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId
 * @description Close a sketch
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId, sketchId } = req.params;
    const { action } = req.body;
    
    if (action !== 'close') {
      return res.status(400).json({ error: "Unsupported action" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Close sketch
    const result = await client.features.closeSketch({
      documentId,
      workspaceId,
      elementId,
      sketchId
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/extrude
 * @description Create an extrusion feature
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/e/:elementId/extrude', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    const { name, sketchId, depth, direction, operationType } = req.body;
    
    if (!sketchId || depth === undefined) {
      return res.status(400).json({ error: "sketchId and depth are required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Create extrusion
    const result = await client.features.createExtrude({
      documentId,
      workspaceId,
      elementId,
      name: name || 'Extrusion',
      sketchId,
      depth,
      direction: direction || 'positive',
      operationType: operationType || 'NEW'
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;