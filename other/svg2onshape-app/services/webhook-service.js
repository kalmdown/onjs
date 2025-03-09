import fetch from 'node-fetch';
import { debugLog } from '../utils/debug.js';
import { onshapeApiUrl, webhookCallbackUrl } from '../config.js';

class WebhookService {
    constructor() {
        this.handlers = new Map();
    }

    /**
     * Handle incoming webhook event
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleWebhook(req, res) {
        try {
            const { event, payload } = req.body;
            
            debugLog('webhook', `Processing webhook event: ${event}`, {
                eventType: event,
                payloadSize: JSON.stringify(payload).length
            });

            const handler = this.handlers.get(event);
            if (handler) {
                await handler(payload);
            } else {
                debugLog('webhook', `No handler registered for event: ${event}`);
            }

            res.status(200).json({ 
                received: true,
                event,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            debugLog('error', 'Webhook handling error:', error);
            res.status(500).json({ 
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Register a handler for a specific webhook event
     * @param {string} eventType - Type of webhook event
     * @param {Function} handler - Handler function
     */
    registerHandler(eventType, handler) {
        this.handlers.set(eventType, handler);
        debugLog('webhook', `Registered handler for event: ${eventType}`);
    }

    /**
     * Register a new webhook to listen for translation completion.
     * 
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * @param {string} userID The ID of the current user.
     * @param {string} documentId The ID of the current document.
     * 
     * @returns {Promise<string>} Resolves with the webhook ID, or rejects with error message.
     */
    async registerWebhook(userAccessToken, userID, documentId) {
        // Validate required parameters
        if (!userAccessToken) {
            throw new Error('Access token is required for webhook registration');
        }
        if (!userID) {
            throw new Error('User ID is required for webhook registration');
        }
        if (!documentId) {
            throw new Error('Document ID is required for webhook registration');
        }

        try {
            debugLog('webhook', `Registering webhook for document: ${documentId}`, { userID });
            
            // Ensure webhook callback URL is properly formatted
            const callbackUrl = webhookCallbackUrl.endsWith('/')
                ? `${webhookCallbackUrl}api/event`
                : `${webhookCallbackUrl}/api/event`;
                
            const resp = await fetch(`${onshapeApiUrl}/webhooks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.onshape.v1+json'
                },
                body: JSON.stringify({
                    events: [ 'onshape.model.translation.complete' ],
                    filter: `{$UserId} = '${userID}' && {$DocumentId} = '${documentId}'`,
                    options: { collapseEvents: false },
                    url: callbackUrl
                })
            });
            
            const respJson = await resp.json();
            
            if (resp.ok) {
                debugLog('webhook', `Successfully registered webhook with ID: ${respJson.id}`);
                return respJson.id;
            } else {
                const errorMsg = `Failed to create webhook: ${resp.status} ${resp.statusText}`;
                debugLog('error', errorMsg, respJson);
                throw new Error(errorMsg);
            }
        } catch (err) {
            debugLog('error', 'Webhook registration failed:', err);
            throw new Error(`Webhook registration failed: ${err.message}`);
        }
    }
    
    /**
     * Unregister the given webhook.
     * 
     * @param {string} webhookID The ID of the webhook to unregister.
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * 
     * @returns {Promise<Response>} resolves with the response, or rejects with error text.
     */
    async unregisterWebhook(webhookID, userAccessToken) {
        if (!webhookID || !userAccessToken) {
            throw new Error('Webhook ID and access token are required');
        }
        
        try {
            const resp = await fetch(`${onshapeApiUrl}/webhooks/${webhookID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userAccessToken}` }
            });
            
            if (resp.ok) {
                debugLog('webhook', `Successfully unregistered webhook: ${webhookID}`);
                return resp;
            } else {
                const errorText = await resp.text();
                throw new Error(`Failed to unregister webhook: ${resp.status} ${resp.statusText} - ${errorText}`);
            }
        } catch (err) {
            debugLog('error', 'Webhook unregistration failed:', err);
            throw err;
        }
    }
}

// Create singleton instance
const webhookService = new WebhookService();

// Export the singleton instance as both a named export and default export
export { webhookService };
export default webhookService;
