import registry from '/app/registry.js';
import appState from '/js/state.js';
import appConfig from '/js/appConfig.js';
import { debugLog } from '/js/utils/debug.js';

/**
 * SketchConverter component
 * Handles conversion of SVG content to Onshape sketches
 */
export class SketchConverter {
    constructor() {
        this.initialized = false;
        this.converting = false;
        
        // Get configuration from appConfig
        const config = appConfig.components?.sketchConverter || {};
        this.buttonId = config.buttonId || 'convertToSketch';
        this.statusContainerId = config.statusContainerId || 'conversionStatus';
        
        // Debug settings
        this._debug = appConfig.debug?.components?.sketchConverter || false;
    }

    init() {
        if (this.initialized) return;
        
        this.convertButton = document.getElementById(this.buttonId);
        if (!this.convertButton) {
            throw new Error(`Convert button not found with ID: ${this.buttonId}`);
        }

        this._initEventListeners();
        this.initialized = true;
        debugLog('SketchConverter', 'Initialized');
    }

    _initEventListeners() {
        this.convertButton.addEventListener('click', () => this.handleConversion());
        appState.subscribe(() => this.updateButtonState());
    }

    async handleConversion() {
        if (this.converting) return;

        try {
            this.converting = true;
            this.setButtonLoading(true);

            const state = appState.state;
            const params = state.params || {};
            
            // Validate state before conversion
            const validationErrors = [];
            if (!state.selectedPlane?.id) validationErrors.push('No plane selected');
            if (!state.svgContent) validationErrors.push('No SVG content available');
            if (!params.documentId) validationErrors.push('No document ID');
            if (!params.workspaceId) validationErrors.push('No workspace ID');

            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            debugLog('SketchConverter', 'Starting conversion', {
                planeId: state.selectedPlane.id,
                documentId: params.documentId,
                workspaceId: params.workspaceId,
                hasSVG: !!state.svgContent
            });

            const appClient = registry.getComponent('appClient');
            const result = await appClient.convertToSketch({
                planeId: state.selectedPlane.id,
                svgContent: state.svgContent,
                documentId: params.documentId,
                workspaceId: params.workspaceId
            });

            this._handleSuccess(result);

        } catch (error) {
            console.error('Conversion error:', error);
            debugLog('error', 'Conversion failed', { 
                error: error.message,
                code: error.code,
                context: error.requestContext 
            });
            this._handleError(error);
            throw error;
        } finally {
            this.converting = false;
            this.setButtonLoading(false);
        }
    }

    _handleSuccess(result) {
        // Update UI for success
        const status = document.getElementById(this.statusContainerId);
        if (status) {
            status.textContent = 'Conversion successful';
            status.className = 'success';
        }
    }

    _handleError(error) {
        // Update UI for error with more context
        const status = document.getElementById(this.statusContainerId);
        if (status) {
            let message = error.message;
            if (error.code === 'INVALID_SVG') {
                message = 'The SVG file is not valid. Please check the file content.';
            } else if (error.code === 'CONVERSION_FAILED') {
                message = 'Failed to convert SVG to sketch. Please try again.';
            }
            status.textContent = `Error: ${message}`;
            status.className = 'error';
        }
    }

    /**
     * Update the state of the convert button
     */
    updateButtonState() {
        if (!this.convertButton) return;
        
        const state = appState?.state;
        if (!state) return;
        
        const canConvert = state.svgContent && state.selectedPlane;
        
        this.convertButton.disabled = !canConvert;
        this.convertButton.classList.toggle('disabled', !canConvert);
        this.convertButton.classList.toggle('btn-primary', canConvert);
    }
    
    /**
     * Set loading state for the convert button
     * @param {boolean} isLoading - Whether the button is in loading state
     */
    setButtonLoading(isLoading) {
        if (!this.convertButton) return;
        
        if (isLoading) {
            this.convertButton.disabled = true;
            this.convertButton.originalText = this.convertButton.textContent;
            this.convertButton.textContent = 'Converting...';
            this.convertButton.classList.add('loading');
        } else {
            this.updateButtonState();
            this.convertButton.textContent = this.convertButton.originalText || 'Convert to Sketch';
            this.convertButton.classList.remove('loading');
        }
    }
}

// Create and register instance
const sketchConverter = new SketchConverter();
registry.register('sketchConverter', sketchConverter, ['appState', 'appClient']);

export default sketchConverter;