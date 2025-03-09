import registry from './registry.js';
import appState from './state.js';
import appConfig, { api } from './appConfig.js';
import { debugLog } from './utils/debug.js';

let instance = null;

/**
 * Client for API interactions with the server
 * Handles all HTTP communication with backend APIs
 */
export class AppClient {
    constructor() {
        if (instance) {
            debugLog('appClient', 'Instance already exists');
            return instance;
        }

        debugLog('appClient', 'Initializing AppClient');
        this.initialized = false;
        this.baseUrl = window.location.origin;
        
        // Debug settings from config
        this._debug = appConfig.debug?.components?.appClient || appConfig.DEBUG_API_CALLS || false;
        
        // Cache for commonly requested resources
        this._cache = new Map();
        
        // Request retry configuration
        this._retryConfig = {
            maxRetries: appConfig.api?.maxRetries || 2,
            retryDelay: appConfig.api?.retryDelay || 1000
        };

        instance = this;
        this.init();
        return instance;
    }

    init() {
        if (this.initialized) return;
        
        try {
            // Initialize any required properties
            this.initialized = true;
            debugLog('appClient', 'AppClient initialized successfully');
        } catch (error) {
            debugLog('error', 'Failed to initialize AppClient:', error);
            throw error;
        }
    }

    /**
     * Get planes from API
     * @param {Object} params - URL parameters
     * @param {boolean} [useCache=true] - Whether to use cached results if available
     * @returns {Promise<Array>} List of planes
     */
    async getPlanes({ documentId, workspaceId, elementId, useCache = true }) {
        try {
            if (!this.initialized) {
                throw new Error('AppClient not initialized');
            }

            // Check cache first
            const cacheKey = `planes-${documentId}-${workspaceId}-${elementId}`;
            if (useCache && this._cache.has(cacheKey)) {
                debugLog('appClient', 'Returning cached planes');
                return this._cache.get(cacheKey);
            }

            const response = await fetch(
                `${api.planes}?documentId=${documentId}&workspaceId=${workspaceId}&elementId=${elementId}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const planes = await response.json();
            
            // Cache the result
            if (useCache) {
                this._cache.set(cacheKey, planes);
                // Set cache expiry (5 minutes)
                setTimeout(() => this._cache.delete(cacheKey), 5 * 60 * 1000);
            }

            debugLog('appClient', `Fetched ${planes.length} planes`);
            return planes;
        } catch (error) {
            debugLog('error', 'Failed to fetch planes:', error);
            throw error;
        }
    }

    /**
     * Convert SVG to Onshape sketch
     * @param {Object} options - Conversion options
     * @param {string} options.planeId - Target plane ID
     * @param {string} options.svgContent - SVG content to convert
     * @param {string} options.documentId - Onshape document ID
     * @param {string} options.workspaceId - Onshape workspace ID
     * @returns {Promise<Object>} Conversion result
     */
    async convertToSketch({ planeId, svgContent, documentId, workspaceId }) {
        const validationErrors = [];
        if (!planeId) validationErrors.push('planeId is required');
        if (!documentId) validationErrors.push('documentId is required');
        if (!workspaceId) validationErrors.push('workspaceId is required');
        if (!svgContent) validationErrors.push('SVG content is required');

        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        // Get state for form data
        const state = appState.state;
        const formData = state.uploadFormData;

        if (!formData) {
            throw new Error('No file data available');
        }

        try {
            debugLog('AppClient', 'Converting to sketch', {
                planeId, 
                documentId, 
                workspaceId,
                contentLength: svgContent?.length
            });
            
            const response = await this._fetch('/api/convert', {
                method: 'POST',
                body: formData // Send FormData instead of JSON
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Conversion failed');
            }
            
            debugLog('AppClient', 'Conversion successful', {
                featureId: result.featureId
            });
            
            return result;
        } catch (error) {
            const enhancedError = new Error(
                `Conversion request failed: ${error.message}`
            );
            enhancedError.code = error.code || 'REQUEST_FAILED';
            enhancedError.requestContext = {
                planeId,
                documentId,
                workspaceId,
                hasContent: !!svgContent
            };
            
            debugLog('error', 'Conversion failed', {
                error: enhancedError.message,
                code: enhancedError.code,
                context: enhancedError.requestContext
            });
            
            throw enhancedError;
        }
    }

    /**
     * Convert SVG file to Onshape sketch
     * @param {FormData} formData - Form data containing SVG file and parameters
     * @returns {Promise<Object>} Conversion result
     */
    async convertSvgToSketch(formData) {
        try {
            // Log the form data for debugging
            const formDataEntries = [];
            for (const [key, value] of formData.entries()) {
                if (value instanceof File) {
                    formDataEntries.push([key, {
                        name: value.name,
                        size: value.size,
                        type: value.type
                    }]);
                } else {
                    formDataEntries.push([key, value]);
                }
            }
            debugLog('appClient', 'Sending FormData:', { entries: formDataEntries });

            // Defensive check: ensure the FormData contains a file under the "file" key
            if (!formData.has('file')) {
                throw new Error('FormData is missing the "file" field with SVG data');
            }

            // Perform the fetch request without setting explicit headers
            const response = await this._fetch('/api/convert', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // Improved error handling
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use the status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Attempt to parse the JSON response
            let result;
            try {
                result = await response.json();
            } catch (e) {
                throw new Error(`Failed to parse JSON response: ${e.message}`);
            }

            // Check for a successful result
            if (!result) {
                throw new Error('Empty response from server');
            }

            return result;
        } catch (error) {
            debugLog('error', 'SVG conversion failed', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Wrapper for fetch API with error handling and retry capability
     * @private
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @param {number} [retryCount=0] - Current retry attempt
     * @returns {Promise<Response>} Fetch response
     */
    async _fetch(endpoint, options = {}, retryCount = 0) {
        const url = new URL(endpoint, this.baseUrl);
        
        // Handle query parameters
        if (options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value);
                }
            });
        }

        try {
            // Add default headers
            const headers = {
                'Accept': 'application/json',
                ...options.headers
            };

            if (this._debug) {
                debugLog('api', `${options.method || 'GET'} ${url.toString()}`);
            }

            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include' // Include cookies for auth
            });

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                // Try to parse error response
                try {
                    const errorData = await response.json();
                    if (errorData.error || errorData.message) {
                        errorMessage = errorData.error || errorData.message;
                    }
                } catch (parseError) {
                    // Fallback to text if JSON parsing fails
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage = errorText;
                    }
                }

                const error = new Error(errorMessage);
                error.status = response.status;
                error.statusText = response.statusText;
                
                // Handle authentication errors (401/403) specially
                if (response.status === 401 || response.status === 403) {
                    error.code = 'AUTH_ERROR';
                    throw error;
                }
                
                // Implement retry for server errors (5xx) or specific retriable status codes
                const isServerError = response.status >= 500 && response.status < 600;
                const isRetriableError = [408, 429].includes(response.status) || isServerError;
                
                if (isRetriableError && retryCount < this._retryConfig.maxRetries) {
                    debugLog('api', `Retrying request (${retryCount + 1}/${this._retryConfig.maxRetries})`, { 
                        endpoint, status: response.status 
                    });
                    
                    // Exponential backoff
                    const delay = this._retryConfig.retryDelay * Math.pow(2, retryCount);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    return this._fetch(endpoint, options, retryCount + 1);
                }
                
                throw error;
            }

            return response;
        } catch (error) {
            // Log detailed error information
            debugLog('error', 'Request failed', {
                endpoint,
                error: error.message,
                status: error.status,
                statusText: error.statusText,
                retryCount
            });
            
            // Retry network errors
            if (error.name === 'TypeError' && retryCount < this._retryConfig.maxRetries) {
                debugLog('api', `Retrying request after network error (${retryCount + 1}/${this._retryConfig.maxRetries})`, { 
                    endpoint 
                });
                
                const delay = this._retryConfig.retryDelay * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return this._fetch(endpoint, options, retryCount + 1);
            }
            
            throw error;
        }
    }
    
    /**
     * Clear cached data
     * @param {string} [cacheKey] - Specific cache key to clear, or all if omitted
     */
    clearCache(cacheKey) {
        if (cacheKey) {
            this._cache.delete(cacheKey);
            debugLog('AppClient', `Cleared cache for ${cacheKey}`);
        } else {
            this._cache.clear();
            debugLog('AppClient', 'Cleared all cache data');
        }
    }
}

// Create singleton instance
const appClient = new AppClient();

// Register with component registry with error handling
try {
    const registrationResult = registry.register('appClient', appClient, ['appState']);
    if (!registrationResult) {
        debugLog('error', 'Failed to register appClient with registry');
    }
} catch (error) {
    debugLog('error', 'Error registering appClient with registry', { error: error.message });
}

// Export singleton instance
export default appClient;