/**
 * API routes for SVG to Onshape app
 * Handles API endpoints including planes fetching and SVG conversion
 */
import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs'; // <-- Added import for fs module

// Import services
import OnshapeApiService from '../services/onshape-api.js';
import ConversionService from '../services/svg/conversion-service.js';
import { debugLog } from '../utils/debug.js';

// Import webhook service as singleton
import webhookService from '../services/webhook-service.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create router
const router = express.Router();

// Initialize services
const onshapeApi = new OnshapeApiService(process.env.API_URL);
const conversionService = new ConversionService(onshapeApi);

// Add middleware for file uploads
router.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (5MB maximum)',
    useTempFiles: true,
    tempFileDir: path.join(__dirname, '../tmp')
}));

// Health check endpoint for API verification
router.get('/health', (req, res) => {
    // Use local variables for services instead of req.app.get
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        apiAvailable: !!onshapeApi,
        apiMethods: {
            fetchPlanes: typeof onshapeApi?.fetchPlanes === 'function',
            createSketchFromSvg: typeof onshapeApi?.createSketchFromSvg === 'function'
        },
        conversionServiceAvailable: !!conversionService,
        conversionMethods: {
            createSketch: typeof conversionService?.createSketch === 'function'
        },
        environment: {
            node: process.version,
            comprehensiveSearch: process.env.COMPREHENSIVE_PLANE_SEARCH === 'true'
        }
    });
});

// Route to fetch planes
router.get('/planes', async (req, res) => {
    try {
        const { documentId, workspaceId, elementId } = req.query;
        
        // Validate required parameters
        if (!documentId || !workspaceId || !elementId) {
            return res.status(400).json({ 
                error: 'Missing required parameters' 
            });
        }

        // Validate authentication
        if (!req.user?.accessToken) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }

        debugLog('api', `Fetching planes for element: ${elementId}`);
        
        try {
            const planes = await onshapeApi.fetchPlanes(
                req.user.accessToken,
                documentId,
                workspaceId,
                elementId
            );
            res.json(planes);
        } catch (apiError) {
            debugLog('error', 'Error fetching custom planes:', apiError);
            // Fallback to default planes if API call fails
            const defaultPlanes = [
                { id: 'XY', name: 'Front (XY)', type: 'default' },
                { id: 'YZ', name: 'Right (YZ)', type: 'default' },
                { id: 'XZ', name: 'Top (XZ)', type: 'default' }
            ];
            debugLog('api', 'Returning default planes as fallback');
            res.json(defaultPlanes);
        }
    } catch (error) {
        debugLog('error', 'Error in /planes endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to handle SVG conversion
router.post('/convert', async (req, res) => {
    try {
        const { svgContent, documentId, workspaceId, planeId } = req.body;
        
        if (!svgContent || !documentId || !workspaceId || !planeId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Call conversion service or Onshape API with the parameters including planeId.
        // For example, assuming conversionService.createSketch has been updated:
        const conversionService = req.app.get('conversionService');
        const result = await conversionService.createSketch({
            svgContent,
            documentId,
            workspaceId,
            elementId: req.body.elementId, // if provided
            planeId,
            options: req.body.options // sketchName, namespace, etc.
        });
        
        res.json({ success: true, ...result });
    } catch (error) {
        debugLog('error', 'Conversion endpoint failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Update webhook route to use service
router.post('/webhook', (req, res) => webhookService.handleWebhook(req, res));

// Debug endpoint
router.get('/debug/status', (req, res) => {
    try {
        res.json({
            status: 'operational',
            services: {
                onshapeApi: !!onshapeApi,
                conversionService: !!conversionService,
                webhookService: !!webhookService
            },
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;