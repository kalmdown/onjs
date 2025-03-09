// Import dependencies
import fetch from 'node-fetch';

// Import the debug utility
// IMPORTANT: Remove any local debugLog declarations
import { debugLog } from '../utils/debug.js';

export default class OnshapeApiService {
    /**
     * Create an OnshapeApiService instance.
     * @param {string} apiUrl - The Onshape API URL.
     */
    constructor(apiUrl) {
        if (!apiUrl) {
            throw new Error('API URL is required');
        }
        this.apiUrl = apiUrl;
        // Do not rely on an undefined logger; use debugLog below.
    }

    /**
     * Fetch all planes available in a document, grouped by part studio
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @param {string} elementId - Element ID of the active element (optional, for context)
     * @param {boolean} [grouped=false] - Whether to return planes grouped by part studio
     * @returns {Promise<Object|Array>} - Resolves with planes data (grouped object or flat array)
     */
    async fetchPlanes(accessToken, documentId, workspaceId, elementId, grouped = false) {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }

            // Enable grouping based on parameter or environment variable
            const shouldGroupPlanes = grouped || process.env.GROUP_PLANES_BY_STUDIO === 'true';
            
            // Log the request details for debugging
            debugLog('planes', `Fetching planes for document: ${documentId}, workspace: ${workspaceId}, grouped: ${shouldGroupPlanes}`);
            
            // Feature flag for gathering planes from multiple part studios
            const fetchFromAllPartStudios = process.env.FETCH_ALL_PART_STUDIO_PLANES === 'true';
            
            // Collection for all discovered planes (flat array)
            let allPlanes = [];
            
            // Collection for grouped planes (by part studio)
            const groupedPlanes = {};
            
            // First try to get all elements to discover part studios if multi-part studio feature is enabled
            if (fetchFromAllPartStudios) {
                try {
                    debugLog('planes', 'Fetching all elements to discover part studios...');
                    const elements = await this.fetchAllElementsInDocument(accessToken, documentId, workspaceId);
                    const partStudios = elements.filter(elem => elem.elementType === 'PARTSTUDIO');
                    
                    debugLog('planes', `Found ${partStudios.length} part studios in document`);
                    
                    // Process each part studio to find planes
                    for (const studio of partStudios) {
                        try {
                            // Part studio name may include version info in parentheses, remove it for cleaner UI
                            const studioName = (studio.name || `Part Studio ${studio.id}`).replace(/\s*\([^)]*\)$/, '');
                            
                            // Create default planes specific to this part studio
                            const studioDefaultPlanes = [
                                { id: `${studio.id}_XY`, name: `Front (XY)`, type: 'default', partStudioId: studio.id, partStudioName: studioName },
                                { id: `${studio.id}_YZ`, name: `Right (YZ)`, type: 'default', partStudioId: studio.id, partStudioName: studioName },
                                { id: `${studio.id}_XZ`, name: `Top (XZ)`, type: 'default', partStudioId: studio.id, partStudioName: studioName }
                            ];
                            
                            // Fetch features for this part studio
                            const endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${studio.id}/features`;
                            const featuresResponse = await this._callApi(endpoint, accessToken);
                            
                            // Extract planes, including part studio name
                            const customPlanes = this._extractPlanesFromFeatures(
                                featuresResponse, 
                                studioName,
                                studio.id
                            );
                            
                            // Initialize the group for this part studio with its default planes
                            if (!groupedPlanes[studioName]) {
                                groupedPlanes[studioName] = [...studioDefaultPlanes];
                            }
                            
                            // Add custom planes if any
                            if (customPlanes.length > 0) {
                                // Replace detailed logging with simpler output
                                debugLog('planes', `Found ${customPlanes.length} custom planes in "${studioName}"`);
                                
                                // Add to the grouped structure
                                groupedPlanes[studioName] = groupedPlanes[studioName].concat(customPlanes);
                            }
                            
                            // Add to flat array
                            allPlanes = allPlanes.concat(studioDefaultPlanes, customPlanes);
                        } catch (studioError) {
                            debugLog('error', `Could not fetch planes from part studio ${studio.id} (${studio.name}):`, studioError.message);
                            // Continue with other part studios
                        }
                    }
                } catch (elementsError) {
                    debugLog('error', 'Error fetching all elements:', elementsError.message);
                    // Fall through to single element approach
                }
            }
            
            // If we didn't find planes from all part studios or the feature is disabled,
            // fall back to checking just the current element
            if (elementId && (Object.keys(groupedPlanes).length === 0)) {
                try {
                    // Get information about the current element
                    const elementEndpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements/${elementId}`;
                    const elementInfo = await this._callApi(elementEndpoint, accessToken);
                    debugLog('planes', `Current element type: ${elementInfo.elementType}`);
                    
                    // If it's a part studio or assembly, try to get planes from it
                    if (elementInfo.elementType === 'PARTSTUDIO' || elementInfo.elementType === 'ASSEMBLY') {
                        let endpoint;
                        
                        // Get a clean version of the studio name
                        const studioName = (elementInfo.name || 'Current Element').replace(/\s*\([^)]*\)$/, '');
                        
                        // Create default planes specific to this part studio
                        const studioDefaultPlanes = [
                            { id: `${elementId}_XY`, name: `Front (XY)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                            { id: `${elementId}_YZ`, name: `Right (YZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName },
                            { id: `${elementId}_XZ`, name: `Top (XZ)`, type: 'default', partStudioId: elementId, partStudioName: studioName }
                        ];
                        
                        if (elementInfo.elementType === 'PARTSTUDIO') {
                            endpoint = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                        } else if (elementInfo.elementType === 'ASSEMBLY') {
                            endpoint = `/api/assemblies/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
                        }
                        
                        if (endpoint) {
                            // Fetch the features
                            const featuresResponse = await this._callApi(endpoint, accessToken);
                            
                            // Extract planes from features
                            const customPlanes = this._extractPlanesFromFeatures(
                                featuresResponse, 
                                studioName,
                                elementId
                            );
                            
                            // Initialize group for this part studio
                            if (!groupedPlanes[studioName]) {
                                groupedPlanes[studioName] = [...studioDefaultPlanes];
                            }
                            
                            // Add custom planes if any
                            if (customPlanes.length > 0) {
                                groupedPlanes[studioName] = groupedPlanes[studioName].concat(customPlanes);
                            }
                            
                            // Add to flat array
                            allPlanes = allPlanes.concat(studioDefaultPlanes, customPlanes);
                        }
                    }
                } catch (elementError) {
                    console.warn('Error fetching current element info:', elementError.message);
                    // Continue with default planes
                }
            }
            
            // If still no planes found, add a generic default set
            if (Object.keys(groupedPlanes).length === 0) {
                const defaultStudioName = 'Default Planes';
                const genericDefaultPlanes = [
                    { id: 'XY', name: `Front (XY)`, type: 'default', partStudioName: defaultStudioName },
                    { id: 'YZ', name: `Right (YZ)`, type: 'default', partStudioName: defaultStudioName },
                    { id: 'XZ', name: `Top (XZ)`, type: 'default', partStudioName: defaultStudioName }
                ];
                
                groupedPlanes[defaultStudioName] = genericDefaultPlanes;
                allPlanes = allPlanes.concat(genericDefaultPlanes);
            }
            
            // Format response based on the "grouped" parameter
            if (shouldGroupPlanes) {
                // Convert to array format for easier frontend handling
                const result = Object.entries(groupedPlanes).map(([studioName, planes]) => ({
                    studioName,
                    planes
                })).filter(group => group.planes.length > 0);
                
                // Add metadata for UI display
                return {
                    grouped: true,
                    groups: result,
                    // Include flat list for backward compatibility
                    allPlanes
                };
            } else {
                // Return flat array for backward compatibility
                return allPlanes;
            }
        } catch (error) {
            debugLog('error', 'Error in fetchPlanes:', error);
            // Return default planes on error, respecting the requested format
            const defaultStudioName = 'Default Planes';
            const genericDefaultPlanes = [
                { id: 'XY', name: `Front (XY)`, type: 'default', partStudioName: defaultStudioName },
                { id: 'YZ', name: `Right (YZ)`, type: 'default', partStudioName: defaultStudioName },
                { id: 'XZ', name: `Top (XZ)`, type: 'default', partStudioName: defaultStudioName }
            ];
            
            if (grouped || process.env.GROUP_PLANES_BY_STUDIO === 'true') {
                return {
                    grouped: true,
                    groups: [{
                        studioName: defaultStudioName,
                        planes: genericDefaultPlanes
                    }],
                    allPlanes: genericDefaultPlanes
                };
            } else {
                return genericDefaultPlanes;
            }
        }
    }

    /**
     * Fetch all elements in a document
     * @param {string} accessToken - OAuth2 access token
     * @param {string} documentId - Document ID
     * @param {string} workspaceId - Workspace ID
     * @returns {Promise<Array>} - Resolves with an array of elements
     */
    async fetchAllElementsInDocument(accessToken, documentId, workspaceId) {
        try {
            const endpoint = `/api/documents/d/${documentId}/w/${workspaceId}/elements`;
            const response = await this._callApi(endpoint, accessToken);
            return response;
        } catch (error) {
            debugLog('error', 'Error fetching document elements:', error);
            throw error;
        }
    }

    /**
     * Extract plane information from features response
     * @private
     * @param {Object} data - API response data
     * @param {string} partStudioName - Name of the part studio containing these planes
     * @param {string} partStudioId - ID of the part studio containing these planes
     * @returns {Array} Array of plane objects
     */
    _extractPlanesFromFeatures(data, partStudioName = 'Unknown', partStudioId = null) {
        const planes = [];
        
        if (!data || !Array.isArray(data.features)) {
            return planes;
        }

        // Look for datum plane features
        data.features.forEach(feature => {
            // Datum plane feature types (may vary based on Onshape API)
            // 148 is the most common datum plane type
            const datumPlaneTypes = [148, 149, 150]; // Expanded list of potential plane types
            
            // Also check feature name as a backup method
            const isPlaneName = feature.message?.name && 
                /plane|datum/i.test(feature.message.name.toLowerCase());
            
            if (datumPlaneTypes.includes(feature.type) || isPlaneName) {
                planes.push({
                    id: feature.id,
                    name: feature.message?.name || `Plane ${planes.length + 1}`,
                    type: 'custom',
                    partStudioName: partStudioName,
                    partStudioId: partStudioId,
                    featureId: feature.id
                });
            }
        });

        return planes;
    }

    /**
     * Make an API call to Onshape
     * @private
     * @param {string} endpoint - API endpoint
     * @param {string} accessToken - OAuth2 access token
     * @param {Object} [options] - Additional fetch options
     * @returns {Promise<Object>} API response
     */
    async _callApi(endpoint, accessToken, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        debugLog('api', `Making API request to: ${url}`);
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        
        const fetchOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, fetchOptions);
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed - please log in again');
            }
            
            const contentType = response.headers.get('content-type');
            
            // Handle non-JSON responses
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                debugLog('error', 'API Error Details:', {
                    url,
                    statusCode: response.status,
                    statusText: response.statusText,
                    contentType,
                    responseText: text.substring(0, 200) // Log first 200 chars only
                });
                throw new Error(`Invalid response type: ${response.status} ${response.statusText}`);
            }
            
            // Handle unsuccessful responses with JSON
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                debugLog('error', 'API Error Details:', {
                    url,
                    statusCode: response.status,
                    statusText: response.statusText,
                    errorData
                });
                throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            debugLog('error', 'API call failed:', error);
            throw error;
        }
    }

    /**
     * Create a sketch from SVG content in a part studio.
     * @param {Object} params - Request parameters.
     * @param {string} params.documentId - Onshape document ID.
     * @param {string} params.workspaceId - Onshape workspace ID.
     * @param {string} params.elementId - Onshape element ID (Part Studio).
     * @param {string} params.planeId - Target plane ID.
     * @param {string} params.svgContent - SVG content as string.
     * @param {Object} [params.options] - Optional parameters.
     * @returns {Promise<Object>} - Sketch creation result.
     */
    async createSketchFromSvg(params) {
        try {
            const response = await fetch(`${this.apiUrl}/sketches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            // Check Content-Type before parsing to JSON.
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                // If the response appears to be HTML, indicate a possible authentication or endpoint issue
                if (/^<!doctype/i.test(text.trim())) {
                    debugLog('error', 'onshapeApi', {
                        error: `Unexpected HTML response received. This may indicate an authentication issue or that the endpoint is returning an error page. Verify that your access token is valid and has the proper scopes: OAuth2ReadPII OAuth2Read OAuth2Write. Response: ${text.substring(0, 200)}`
                    });
                    throw new Error(`Failed to create sketch: received HTML response instead of JSON from ${this.apiUrl}/sketches. Verify credentials and endpoint.`);
                } else {
                    debugLog('error', 'onshapeApi', {
                        error: `Invalid response type. Expected JSON but received: ${text.substring(0, 200)}`
                    });
                    throw new Error(`Failed to create sketch: invalid json response body at ${this.apiUrl}/sketches reason: ${text.substring(0, 200)}`);
                }
            }

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            debugLog('onshapeApi', 'Sketch created successfully', {
                sketchId: result.id,
                ...result
            });
            return result;
        } catch (error) {
            debugLog('error', 'onshapeApi', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to create sketch: ${error.message}`);
        }
    }
}