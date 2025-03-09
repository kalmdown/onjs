import registry from './registry.js';
import appState from './state.js';
import { debugLog } from './utils/debug.js';
import planeSelector from './planeSelector.js';
import fileUploader from './fileUploader.js';
import appClient from './appClient.js';  // Import the singleton instance

class App {
    constructor() {
        debugLog('app', 'Initializing application...', {
            timestamp: new Date().toISOString(),
            registryState: {
                components: Array.from(registry.components.keys()),
                initialized: Array.from(registry.initialized)
            }
        });
        
        // Initialize components first
        this._initComponents();
        
        // Then check parameters, but don't throw
        this._checkUrlParameters();
    }

    _initComponents() {
        try {
            // Verify registry components first
            const registeredComponents = {
                planeSelector: registry.getComponent('planeSelector'),
                fileUploader: registry.getComponent('fileUploader'),
                appClient: registry.getComponent('appClient'),
                ui: registry.getComponent('ui'),           // Add UI component
                context: registry.getComponent('context')  // Add context component
            };

            // Log component availability
            debugLog('app', 'Component registry status:', {
                planeSelector: !!registeredComponents.planeSelector,
                fileUploader: !!registeredComponents.fileUploader,
                appClient: !!registeredComponents.appClient,
                ui: !!registeredComponents.ui,              // Log UI availability
                context: !!registeredComponents.context     // Log context availability
            });

            // Initialize components without parameter dependency
            this.planeSelector = planeSelector;
            this.fileUploader = fileUploader;
            this.appClient = appClient;
            
            // Initialize UI and context components
            this.ui = registry.getComponent('ui') || this._createFallbackUI();
            this.context = registry.getComponent('context') || this._createFallbackContext();

            // Setup UI elements
            this._setupConvertButton();

            debugLog('app', 'Base components initialized successfully');
        } catch (error) {
            debugLog('error', 'Component initialization failed:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // Update the convert button click handler with proper error checking
    _setupConvertButton() {
        const convertButton = document.getElementById('convertToSketch');
        if (!convertButton) {
            debugLog('error', 'Convert button not found');
            return;
        }

        convertButton.addEventListener('click', async () => {
            try {
                // Get file from fileUploader with defensive checks
                if (!this.fileUploader) {
                    throw new Error('File uploader component not available');
                }
                
                const file = this.fileUploader.getSelectedFile();
                if (!file) {
                    throw new Error('No file selected');
                }
                
                // Enhanced plane selection logic with debug information
                let planeId = null;
                
                // Try multiple ways to get the selected plane
                try {
                    if (this.planeSelector) {
                        debugLog('app', 'PlaneSelector component found', {
                            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.planeSelector)),
                            properties: Object.keys(this.planeSelector)
                        });
                        
                        // Method 1: Try the standard getSelectedPlaneId method
                        if (typeof this.planeSelector.getSelectedPlaneId === 'function') {
                            planeId = this.planeSelector.getSelectedPlaneId();
                            debugLog('app', 'Got planeId from getSelectedPlaneId()', { planeId });
                        }
                        
                        // Method 2: Try getSelectedPlane method
                        if (!planeId && typeof this.planeSelector.getSelectedPlane === 'function') {
                            const plane = this.planeSelector.getSelectedPlane();
                            debugLog('app', 'Got plane from getSelectedPlane()', { plane });
                            planeId = plane?.id;
                        }
                        
                        // Method 3: Try accessing a value property
                        if (!planeId && this.planeSelector.value) {
                            planeId = this.planeSelector.value;
                            debugLog('app', 'Got planeId from planeSelector.value', { planeId });
                        }
                        
                        // Method 4: Try accessing a selectedPlane property
                        if (!planeId && this.planeSelector.selectedPlane) {
                            planeId = this.planeSelector.selectedPlane.id;
                            debugLog('app', 'Got planeId from selectedPlane property', { planeId });
                        }
                        
                        // Method 5: Try accessing a selectedPlaneId property
                        if (!planeId && this.planeSelector.selectedPlaneId) {
                            planeId = this.planeSelector.selectedPlaneId;
                            debugLog('app', 'Got planeId from selectedPlaneId property', { planeId });
                        }
                    }
                    
                    // Method 6: Try accessing DOM
                    if (!planeId) {
                        const planeSelector = document.getElementById('plane-selector');
                        if (planeSelector) {
                            planeId = planeSelector.value;
                            debugLog('app', 'Got planeId from DOM', { planeId });
                        }
                    }
                    
                    // Method 7: Try registry
                    if (!planeId && registry && registry.getState) {
                        const state = registry.getState();
                        planeId = state?.selectedPlaneId;
                        debugLog('app', 'Got planeId from registry state', { planeId, state });
                    }
                    
                    // Log all planes for debugging
                    if (this.planeSelector && typeof this.planeSelector.getPlanes === 'function') {
                        const planes = await this.planeSelector.getPlanes();
                        debugLog('app', 'Available planes', { planes });
                    }
                } catch (planeError) {
                    debugLog('error', 'Error getting plane ID', planeError);
                }
                
                if (!planeId) {
                    // Last resort - default to XY plane if nothing else found
                    const planeList = document.querySelectorAll('#plane-selector option');
                    if (planeList && planeList.length > 0) {
                        // Take the first plane if available
                        planeId = planeList[0].value;
                        debugLog('app', 'Using first plane from selector as fallback', { planeId });
                    } else {
                        // Use XY plane as absolute last resort
                        planeId = 'XY';
                        debugLog('warning', 'Using XY plane as default fallback');
                    }
                }
                
                debugLog('app', 'Final selected plane', { planeId });
                
                // Show loading state
                this.ui?.showLoading('Converting SVG...');
                
                // Get document context with defensive checks
                if (!this.context) {
                    throw new Error('Document context not available');
                }
                
                const documentId = this.context.getDocumentId();
                const workspaceId = this.context.getWorkspaceId();
                const elementId = this.context.getElementId();
                
                if (!documentId || !workspaceId || !elementId) {
                    throw new Error('Missing required Onshape context parameters');
                }
                
                // Log conversion attempt
                debugLog('app', 'Starting SVG to sketch conversion', {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    planeId,
                    documentId,
                    workspaceId,
                    elementId
                });
                
                // Create form data
                const formData = new FormData();
                formData.append('file', file);
                formData.append('documentId', documentId);
                formData.append('workspaceId', workspaceId);
                formData.append('elementId', elementId);
                formData.append('planeId', planeId);
                
                // Check FormData contents for debugging
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
                
                debugLog('app', 'FormData contents:', { entries: formDataEntries });
                
                // Convert SVG to sketch with defensive check
                if (!this.appClient) {
                    throw new Error('API client not available');
                }
                
                const result = await this.appClient.convertSvgToSketch(formData);
                
                // Process successful result
                this.ui?.hideLoading();
                this.ui?.showSuccess('SVG converted successfully!');
                
                // Log success
                debugLog('app', 'Conversion successful', result);
            } catch (error) {
                // Handle error
                this.ui?.hideLoading();
                this.ui?.showError(`Conversion error: ${error.message}`);
                
                // Log error
                debugLog('error', 'Conversion error:', error);
            }
        });
        
        // More robust button state update function
        const updateButtonState = () => {
            try {
                const hasFile = this.fileUploader?.hasFileSelected() || false;
                const hasPlane = this.planeSelector?.hasPlaneSelected() || false;
                const isEnabled = hasFile && hasPlane;
                
                // Add explicit state change notification
                debugLog('app', 'Convert button state update:', { hasFile, hasPlane, isEnabled });
                
                // Force DOM update
                setTimeout(() => {
                    convertButton.disabled = !isEnabled;
                }, 0);
            } catch (error) {
                console.error('Error updating button state:', error);
            }
        };

        // Add direct listeners for both components
        this.fileUploader.onFileSelect(() => {
            debugLog('app', 'File select callback triggered');
            updateButtonState();
        });
        
        this.planeSelector.onPlaneSelect(() => {
            debugLog('app', 'Plane select callback triggered');
            updateButtonState();
        });
        
        // Initialize button state
        updateButtonState();
    }

    _checkUrlParameters() {
        const params = {
            documentId: appState.state.documentId,
            workspaceId: appState.state.workspaceId,
            elementId: appState.state.elementId
        };

        const missingParams = Object.entries(params)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingParams.length > 0) {
            debugLog('warning', 'Missing Onshape parameters', { 
                missing: missingParams,
                current: params 
            });
            // Don't throw, just log warning
            return false;
        }

        // Load planes only if we have all parameters
        this.planeSelector.loadPlanes(params);
        return true;
    }

    // Add fallback methods for UI and context
    _createFallbackUI() {
        debugLog('warning', 'Using fallback UI implementation');
        return {
            showLoading: (message) => {
                debugLog('ui', 'Loading:', message);
                const loadingElement = document.getElementById('loading-indicator');
                if (loadingElement) {
                    loadingElement.textContent = message || 'Loading...';
                    loadingElement.style.display = 'block';
                }
            },
            hideLoading: () => {
                const loadingElement = document.getElementById('loading-indicator');
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
            },
            showError: (message) => {
                debugLog('ui', 'Error:', message);
                alert(`Error: ${message}`);
            },
            showSuccess: (message) => {
                debugLog('ui', 'Success:', message);
                const statusElement = document.getElementById('status-message');
                if (statusElement) {
                    statusElement.textContent = message;
                    statusElement.className = 'success-message';
                    statusElement.style.display = 'block';
                    setTimeout(() => {
                        statusElement.style.display = 'none';
                    }, 5000);
                } else {
                    alert(`Success: ${message}`);
                }
            }
        };
    }

    _createFallbackContext() {
        debugLog('warning', 'Using fallback context implementation');
        return {
            getDocumentId: () => appState.state.documentId,
            getWorkspaceId: () => appState.state.workspaceId,
            getElementId: () => appState.state.elementId
        };
    }

    // Add a fallback method to get plane ID if needed
    _getSelectedPlaneId() {
        try {
            // Try different methods to get the selected plane ID
            if (this.planeSelector) {
                // Check if the getSelectedPlaneId method exists
                if (typeof this.planeSelector.getSelectedPlaneId === 'function') {
                    return this.planeSelector.getSelectedPlaneId();
                }
                
                // Try alternative method names
                if (typeof this.planeSelector.getSelectedPlane === 'function') {
                    const plane = this.planeSelector.getSelectedPlane();
                    if (plane && plane.id) {
                        return plane.id;
                    }
                }
                
                // Try accessing a selectedPlane property
                if (this.planeSelector.selectedPlane && this.planeSelector.selectedPlane.id) {
                    return this.planeSelector.selectedPlane.id;
                }
            }
            
            // Last resort: try to get value from DOM
            const planeSelect = document.getElementById('plane-selector');
            return planeSelect?.value;
        } catch (error) {
            debugLog('error', 'Error getting selected plane ID:', error);
            return null;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Validate registry before app initialization
        registry.validateComponents();
        
        const app = new App();
        // For debugging purposes only
        window.__debug_app = app;
        
        debugLog('app', 'Application initialized successfully');
    } catch (error) {
        debugLog('error', 'Failed to initialize application:', {
            error: error.message,
            stack: error.stack
        });
    }
});

export default App;