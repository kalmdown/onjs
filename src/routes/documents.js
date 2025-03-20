// src\routes\documents.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const DocumentsApi = require('../api/endpoints/documents');
const ElementsApi = require('../api/endpoints/elements');
const { getOnshapeHeaders } = require('../utils/api-headers');

// Create a scoped logger
const log = logger.scope('DocumentRoutes');

// Export router configuration function
module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  log.info('Initializing documents API routes');

  /**
   * @route GET /api/documents
   * @description Get all documents
   * @access Private
   */
  router.get('/', isAuthenticated, async (req, res, next) => {
    const log = logger.scope('DocumentRoutes');
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      sortColumn: req.query.sortColumn || 'modifiedAt',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    log.info(`Fetching documents: limit=${options.limit}, offset=${options.offset}, sort=${options.sortColumn}:${options.sortOrder}`);
    
    try {
      if (!req.onshapeClient) {
        log.error('No Onshape client available');
        return res.status(500).json({ error: 'API client not available' });
      }
      
      // Debug client capabilities
      log.debug('Client info:', {
        type: req.onshapeClient.constructor.name,
        hasGetMethod: typeof req.onshapeClient.get === 'function',
        methods: Object.keys(req.onshapeClient).filter(k => typeof req.onshapeClient[k] === 'function')
      });
      
      // Initialize API endpoint
      const documentsApi = new DocumentsApi(req.onshapeClient);
      
      const documents = await documentsApi.getDocuments(options);
      log.debug(`Retrieved ${documents.items?.length || 0} documents`);
      
      res.json(documents);
    } catch (error) {
      log.error(`Error fetching documents: ${error.message}`, error);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId
   * @description Get a specific document
   * @access Private
   */
  router.get('/:documentId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const documentsApi = new DocumentsApi(req.onshapeClient);
      const document = await documentsApi.getDocument(documentId);
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/w/:workspaceId/elements
   * @description Get elements in a specific document and workspace
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId } = req.params;
      
      if (!documentId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId and workspaceId are required'
        });
      }
      
      log.debug(`Fetching elements for document ${documentId} workspace ${workspaceId}`);

      const elementsApi = new ElementsApi(req.onshapeClient);
      const elements = await elementsApi.getElements(documentId, workspaceId);
      
      res.json(elements);
    } catch (error) {
      log.error(`Error fetching elements: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/w/:workspaceId/e/:elementId/features
   * @description Get features in a specific part studio
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId/features', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      if (!documentId || !workspaceId || !elementId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, and elementId are required'
        });
      }
      
      log.debug(`Fetching features for document ${documentId}, workspace ${workspaceId}, element ${elementId}`);

      const FeaturesApi = require('../api/endpoints/features');
      const featuresApi = new FeaturesApi(req.onshapeClient);
      const features = await featuresApi.getFeatures(documentId, workspaceId, elementId);
      
      res.json(features);
    } catch (error) {
      log.error(`Error fetching features: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/documents
   * @description Create a new document
   * @access Private
   */
  router.post('/', isAuthenticated, async (req, res, next) => {
    try {
      const { name, description, isPublic } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Document name is required" });
      }

      const documentsApi = new DocumentsApi(req.onshapeClient);
      const document = await documentsApi.createDocument({
        name,
        description: description || "Created with Onshape JavaScript client",
        isPublic: isPublic || false
      });

      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route DELETE /api/documents/:documentId
   * @description Delete a document
   * @access Private
   */
  router.delete('/:documentId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const forever = req.query.forever === 'true';
      const documentsApi = new DocumentsApi(req.onshapeClient);
      
      await documentsApi.deleteDocument(documentId, forever);
      res.json({
        success: true,
        message: `Document ${documentId} deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/workspaces
   * @description Get workspaces for a document
   * @access Private
   */
  router.get('/:documentId/workspaces', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const documentsApi = new DocumentsApi(req.onshapeClient);
      const workspaces = await documentsApi.getWorkspaces(documentId);
      res.json(workspaces);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/w/:workspaceId/e/:elementId/planes
   * @description Get planes in a specific part studio
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId/planes', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const includeCustomPlanes = req.query.includeCustomPlanes === 'true';
      
      if (!documentId || !workspaceId || !elementId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, and elementId are required'
        });
      }
      
      log.debug(`Fetching planes for document ${documentId}, workspace ${workspaceId}, element ${elementId}`, {
        includeCustomPlanes
      });

      const FeaturesApi = require('../api/endpoints/features');
      const featuresApi = new FeaturesApi(req.onshapeClient);
      
      const wvm = { wvm: 'w', wvmid: workspaceId };
      const options = { includeCustomPlanes };
      
      try {
        // Try to get planes
        const planes = await featuresApi.getPlanes(documentId, wvm, elementId, options);
        
        // Check if we got a valid response
        if (!planes) {
          log.warn(`No planes returned for element ${elementId}`);
          return res.json([]); // Return empty array instead of null
        }
        
        // Handle different response formats
        if (Array.isArray(planes)) {
          log.debug(`Retrieved ${planes.length} planes`);
          return res.json(planes);
        } else if (planes.referencePlanes) {
          // Some API versions return planes in a nested structure
          log.debug(`Retrieved ${planes.referencePlanes.length} reference planes`);
          return res.json(planes.referencePlanes);
        } else {
          // If we can't determine the format, just return what we got
          log.debug(`Retrieved planes in unknown format`);
          return res.json(planes);
        }
      } catch (error) {
        // Handle specific error cases
        if (error.statusCode === 404) {
          log.error(`Element ${elementId} not found or is not a part studio`);
          return res.status(404).json({
            error: 'Element not found or is not a part studio',
            message: error.message
          });
        } else if (error.statusCode === 400) {
          log.error(`Bad request for planes: ${error.message}`);
          return res.status(400).json({
            error: 'Invalid request for planes',
            message: error.message,
            elementId: elementId
          });
        } else if (error.message && error.message.includes('not a part studio')) {
          log.error(error.message);
          return res.status(400).json({
            error: 'Invalid element type',
            message: error.message
          });
        }
        
        // Re-throw for general error handler
        throw error;
      }
    } catch (error) {
      log.error(`Error fetching planes: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/w/:workspaceId/e/:elementId/test-api
   * @description Test API connectivity for debugging
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/e/:elementId/test-api', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      log.debug(`Testing API connectivity for document ${documentId}, workspace ${workspaceId}, element ${elementId}`);
      
      // Test onshapeClient directly
      if (!req.onshapeClient) {
        return res.status(500).json({ error: 'Client not available' });
      }
      
      // First try a simple API call that should always work
      const sessionPath = '/users/sessioninfo';
      log.debug(`Making test API call to ${sessionPath}`);
      
      try {
        const sessionInfo = await req.onshapeClient.get(sessionPath);
        
        // Now try the planes endpoint
        const planesPath = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/planes`;
        log.debug(`Making test API call to ${planesPath}`);
        
        try {
          const planes = await req.onshapeClient.get(planesPath);
          
          res.json({
            success: true,
            sessionInfo: {
              id: sessionInfo.id,
              name: sessionInfo.name
            },
            planes: {
              success: true,
              count: Array.isArray(planes) ? planes.length : 'unknown'
            }
          });
        } catch (planesError) {
          res.json({
            success: true,
            sessionInfo: {
              id: sessionInfo.id,
              name: sessionInfo.name
            },
            planes: {
              success: false,
              error: planesError.message,
              statusCode: planesError.response?.status
            }
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          statusCode: error.response?.status
        });
      }
    } catch (error) {
      log.error(`Error in test endpoint: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/elements
   * @description Get elements in a specific document
   * @access Private
   */
  router.get('/:documentId/elements', isAuthenticated, async (req, res) => {
    try {
      const { documentId } = req.params;
      
      log.debug(`Getting elements for document: ${documentId}`);
      
      const onshapeClient = req.onshapeClient || app.get('onshapeClient');
      if (!onshapeClient) {
        log.error('Onshape client not available on request');
        return res.status(500).json({ error: 'API client not available' });
      }
      
      // Get default workspace for the document
      log.debug(`Getting default workspace for document: ${documentId}`);
      
      // First, get the document info to find the default workspace
      const docPath = `documents/${documentId}`;
      
      log.debug(`Fetching document info from: ${docPath}`);
      
      const docResponse = await onshapeClient.get(
        docPath, 
        {
          headers: getOnshapeHeaders()
        }
      );
      
      if (!docResponse || !docResponse.defaultWorkspace || !docResponse.defaultWorkspace.id) {
        log.error('Failed to get default workspace for document');
        return res.status(500).json({
          error: 'Document error',
          message: 'Could not determine default workspace for document'
        });
      }
      
      const workspaceId = docResponse.defaultWorkspace.id;
      log.debug(`Using default workspace: ${workspaceId}`);
      
      // Now get the elements using the workspace ID
      const elementsPath = `documents/d/${documentId}/w/${workspaceId}/elements`;
      
      log.debug(`Fetching elements from: ${elementsPath}`);
      
      const elementsResponse = await onshapeClient.get(
        elementsPath, 
        {
          headers: getOnshapeHeaders()
        }
      );
      
      log.debug(`Retrieved ${elementsResponse?.length || 0} elements from API`);
      
      res.json(elementsResponse);
    } catch (error) {
      log.error(`Error getting elements: ${error.message}`);
      res.status(500).json({ error: 'Failed to get elements', message: error.message });
    }
  });

  return router;
};