// src\routes\elements.js
// src/routes/elements.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, createClientFromRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');

// Create a scoped logger
const log = logger.scope('ElementRoutes');

/**
 * @route GET /api/elements/:documentId
 * @description Get all elements in a document
 * @access Private
 */
router.get('/:documentId', isAuthenticated, async (req, res, next) => {
  try {
    const documentId = req.params.documentId;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get elements
    const elements = await client.elements.getElements(documentId);
    
    res.json(elements);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/elements/:documentId/w/:workspaceId
 * @description Get elements in a specific workspace
 * @access Private
 */
router.get('/:documentId/w/:workspaceId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId } = req.params;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get elements for workspace
    const elements = await client.elements.getWorkspaceElements(documentId, workspaceId);
    
    res.json({ elements });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/elements/:documentId/w/:workspaceId
 * @description Create a new element
 * @access Private
 */
router.post('/:documentId/w/:workspaceId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId } = req.params;
    const { name, elementType } = req.body;
    
    if (!name || !elementType) {
      return res.status(400).json({ error: "Name and elementType are required" });
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Create element
    const element = await client.elements.createElement({
      documentId,
      workspaceId,
      name,
      elementType
    });
    
    res.json(element);
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/elements/:documentId/w/:workspaceId/e/:elementId
 * @description Delete an element
 * @access Private
 */
router.delete('/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Delete element
    await client.elements.deleteElement(documentId, workspaceId, elementId);
    
    res.json({ 
      success: true,
      message: `Element ${elementId} deleted successfully` 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/elements/:documentId/w/:workspaceId/e/:elementId/planes
 * @description Get planes for a part studio
 * @access Private
 */
router.get('/:documentId/w/:workspaceId/e/:elementId/planes', isAuthenticated, async (req, res, next) => {
  try {
    const { documentId, workspaceId, elementId } = req.params;
    const includeCustomPlanes = req.query.includeCustomPlanes !== 'false'; // Default to true
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get planes
    const planes = await client.elements.getPlanes(
      documentId,
      workspaceId,
      elementId,
      includeCustomPlanes
    );
    
    res.json({ planes });
  } catch (error) {
    next(error);
  }
});

module.exports = router;