import registry from '/app/registry.js';
import appState from '/js/state.js';
import appConfig from '/js/appConfig.js';
import { debugLog } from '/js/utils/debug.js';

/**
 * SVG Handler - Manages SVG file loading and preview functionality
 */
export class SVGHandler {
    constructor() {
        this.initialized = false;
        this.fileInput = null;
        this.previewContainer = null;
        
        // Get configuration settings from appConfig
        const svgConfig = appConfig.components?.svgHandler || {};
        this.maxFileSize = svgConfig.maxFileSize || 1024 * 1024; // Default 1MB
        this.allowedTypes = svgConfig.allowedTypes || ['image/svg+xml'];
        this.previewContainerId = svgConfig.previewContainerId || 'svgPreview';
        
        // Debug settings
        this._debug = appConfig.debug?.components?.svgHandler || false;
    }
    
    /**
     * Initialize the SVG handler
     */
    init() {
        if (this.initialized) return;

        this.fileInput = document.querySelector('input[type="file"]');
        if (!this.fileInput) {
            throw new Error('File input not found');
        }

        this.previewContainer = document.getElementById(this.previewContainerId);
        if (!this.previewContainer) {
            throw new Error(`SVG preview container not found: ${this.previewContainerId}`);
        }

        this._initEventListeners();
        this.initialized = true;
        debugLog('SVGHandler', 'Initialized');
    }

    _initEventListeners() {
        this.fileInput.addEventListener('change', (event) => this.handleFileSelect(event));
    }
    
    /**
     * Handle file selection
     * @param {Event} event - File input change event
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            throw new Error('No file selected');
        }
        
        // Check file type
        if (!this.allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type. Please select an SVG file. Got: ${file.type}`);
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            throw new Error(`File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`);
        }

        try {
            const svgContent = await this.readFileAsText(file);
            const cleanContent = this.prepareSVGForConversion(svgContent);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('content', svgContent);
            
            await this.previewSVG(cleanContent);
            appState.setState({ 
                currentFile: file,
                svgContent: cleanContent,
                uploadFormData: formData
            });

            debugLog('SVGHandler', 'SVG loaded and validated', {
                fileName: file.name,
                contentLength: cleanContent.length
            });

        } catch (error) {
            console.error('SVG handling error:', error);
            debugLog('error', 'File handling error', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Preview an SVG file
     * @param {string} svgContent - SVG content to preview
     */
    async previewSVG(svgContent) {
        try {
            this.svgContent = svgContent;
            
            // Update preview
            if (this.previewContainer) {
                this.previewContainer.innerHTML = svgContent;
                debugLog('SVGHandler', 'SVG preview updated');
            } else {
                throw new Error('Preview container not available');
            }
            
            return svgContent;
        } catch (error) {
            console.error('SVGHandler: Preview error', error);
            debugLog('error', 'Failed to preview SVG', { error: error.message });
            throw new Error('Failed to preview SVG: ' + error.message);
        }
    }
    
    /**
     * Read file content as text
     * @param {File} file - File to read
     * @returns {Promise<string>} - File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => {
                debugLog('error', 'File read error', { error: e });
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Clear the preview
     */
    clearPreview() {
        if (this.previewContainer) {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">SVG preview will appear here</div>';
            debugLog('SVGHandler', 'Preview cleared');
        }
        this.svgContent = null;
    }
    
    /**
     * Get the current SVG content
     * @returns {string|null} - SVG content
     */
    getSVGContent() {
        return this.svgContent;
    }

    /**
     * Validate SVG content
     * @param {string} svgContent - SVG content to validate
     * @returns {Object} Validation result
     * @throws {Error} If validation fails
     */
    validateSVG(svgContent) {
        if (!svgContent) {
            throw new Error('SVG content is required');
        }

        const cleanContent = svgContent.trim();
        const svgRegex = /<svg[^>]*>[\s\S]*<\/svg>/i;
        
        if (!svgRegex.test(cleanContent)) {
            const error = new Error('Invalid SVG content format');
            error.code = 'INVALID_SVG';
            error.details = 'SVG content must be a valid SVG document';
            throw error;
        }

        return {
            content: cleanContent,
            length: cleanContent.length,
            valid: true
        };
    }

    /**
     * Clean and prepare SVG for conversion
     * @param {string} svgContent - Raw SVG content
     * @returns {string} Cleaned SVG content
     */
    prepareSVGForConversion(svgContent) {
        if (!svgContent || typeof svgContent !== 'string') {
            throw new Error('Invalid SVG content');
        }

        const cleanContent = svgContent.trim();
        const svgRegex = /<svg[^>]*>[\s\S]*<\/svg>/i;
        
        if (!svgRegex.test(cleanContent)) {
            const error = new Error('Invalid SVG format');
            error.code = 'INVALID_SVG';
            throw error;
        }

        return cleanContent;
    }
}

// Create and register instance
const svgHandler = new SVGHandler();
registry.register('svgHandler', svgHandler, ['appState']);

export default svgHandler;