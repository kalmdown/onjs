import registry from './registry.js';10
import appState from '/js/state.js';
import { debugLog } from '/js/utils/debug.js';

/**
 * Handles SVG file uploads
 */
export class FileUploader {
    constructor(config = {}) {
        this.config = {
            inputId: 'fileInput',
            buttonId: 'uploadButton',
            previewId: 'svgPreview',
            statusId: 'uploadStatus',
            ...config
        };

        this.fileChangeCallbacks = new Set();
        this.initialized = false;
        this.init();
    }

    // Consolidate initialization methods
    _initUI() {
        // Get required elements
        this.fileInput = document.getElementById(this.config.inputId);
        this.uploadButton = document.getElementById(this.config.buttonId);
        this.previewContainer = document.getElementById(this.config.previewId);
        this.statusElement = document.getElementById(this.config.statusId);

        if (!this.fileInput || !this.uploadButton) {
            throw new Error('Required file upload elements not found');
        }

        this.processingFile = false;
        this.isUploading = false;
        this.uploadInProgress = false;

        // Set up event listeners - simplified to avoid conflicts
        this.uploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (!this.processingFile && !this.isUploading) {
                this.fileInput.click();
            }
        });

        this.fileInput.addEventListener('change', (event) => this._handleFileSelect(event));

        debugLog('fileUploader', 'File uploader initialized');
    }

    // Simplify file selection handler to ensure consistent state updates
    _handleFileSelect(event) {
        const file = event.target?.files?.[0];
        if (!file) {
            debugLog('fileUploader', 'No file selected');
            return;
        }

        this.processingFile = true;

        try {
            debugLog('fileUploader', 'File selected:', {
                name: file.name,
                type: file.type,
                size: file.size
            });

            // Update preview
            this._updatePreview(file);

            // Update app state - ensure we're using the right method
            appState.setFile(file);

            // Explicitly notify callbacks about file selection
            this.fileChangeCallbacks.forEach(callback => {
                try {
                    callback(file);
                } catch (error) {
                    debugLog('error', 'Error in file change callback:', error);
                }
            });
        } catch (error) {
            debugLog('error', 'Error handling file selection:', error);
        } finally {
            this.processingFile = false;
        }
    }

    init() {
        if (this.initialized) return;
        this._initUI();
        this.initialized = true;
        return this;
    }

    _updatePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.previewContainer) {
                this.previewContainer.innerHTML = e.target.result;
                this.previewContainer.classList.remove('hidden');
            }
            this.statusElement.textContent = `Selected: ${file.name}`;
        };
        reader.readAsText(file);
    }

    /**
     * Gets the currently selected file
     * @returns {File|null} Selected file or null if no file selected
     */
    getSelectedFile() {
        try {
            if (!this.fileInput || !this.fileInput.files || !this.fileInput.files.length) {
                debugLog('fileUploader', 'No file selected in input element');
                return null;
            }
            
            const file = this.fileInput.files[0];
            if (!file) {
                debugLog('fileUploader', 'File reference is empty');
                return null;
            }
            
            // Verify this is a valid File object with proper properties
            if (!(file instanceof File) || !file.name) {
                debugLog('fileUploader', 'Invalid file object', file);
                return null;
            }
            
            debugLog('fileUploader', 'Retrieved selected file', {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: new Date(file.lastModified).toISOString()
            });
            
            return file;
        } catch (error) {
            debugLog('error', 'Error getting selected file', { error });
            return null;
        }
    }

    hasFileSelected() {
        const hasFile = !!(this.fileInput?.files?.[0]);
        debugLog('fileUploader', `File selection check: ${hasFile ? 'file selected' : 'no file'}`);
        return hasFile;
    }

    getState() {
        return {
            hasFile: this.hasFileSelected(),
            fileName: this.fileInput?.files?.[0]?.name,
            isUploading: this.isUploading,
            processingFile: this.processingFile
        };
    }

    /**
     * Register callback for file selection
     * @param {Function} callback - Callback to be called when a file is selected
     */
    onFileSelect(callback) {
        if (typeof callback !== 'function') {
            debugLog('error', 'Invalid callback provided to onFileSelect');
            return;
        }
        this.fileChangeCallbacks.add(callback);
        
        // If file is already selected, trigger callback immediately
        if (this.hasFileSelected()) {
            const file = this.getSelectedFile();
            if (file) {
                try {
                    callback(file);
                } catch (error) {
                    debugLog('error', 'Error in immediate file callback:', error);
                }
            }
        }
    }

    /**
     * Initialize event listeners for file upload
     * @private
     */
    _initEventListeners() {
        if (!this.uploadButton || !this.fileInput) {
            console.error('FileUploader: Required elements not found', {
                uploadButton: this.uploadButtonId,
                fileInput: this.fileInputId
            });
            return;
        }
        
        console.log('FileUploader: Setting up event listeners', {
            uploadButton: this.uploadButtonId,
            fileInput: this.fileInputId
        });
        
        // Use click handler on button to trigger file input
        this.uploadButton.addEventListener('click', (event) => {
            // Prevent default action and stop event propagation
            event.preventDefault();
            event.stopPropagation();
            
            // Prevent triggering multiple file dialogs
            if (this.isUploading || this.processingFile) {
                debugLog('FileUploader', 'Upload already in progress, ignoring click');
                return;
            }
            
            debugLog('FileUploader', 'Upload button clicked');
            
            // Explicitly trigger the file input click
            this.fileInput.click();
        });
        
        // Handle file selection with debouncing to prevent multiple triggers
        this.fileInput.addEventListener('change', async (event) => {
            // Prevent handling the same event multiple times
            if (this.processingFile) {
                debugLog('FileUploader', 'Already processing a file, ignoring change event');
                return;
            }
            
            this.processingFile = true;
            
            try {
                // Get selected file
                const file = event.target.files[0];
                if (!file) {
                    debugLog('FileUploader', 'No file selected');
                    return;
                }
                
                console.log('FileUploader: File selected', {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
                
                // Call file selected callback if provided
                if (typeof this.options.onFileSelected === 'function') {
                    await this._safeCallback(() => this.options.onFileSelected(file));
                }
                
                // Store the selected file in app state for reference by other components
                appState.setState({ currentFile: file });
                const svgHandler = registry.getComponent('svgHandler');
                if (svgHandler) {
                    await svgHandler.handleFileSelect(event);
                }
            } catch (error) {
                console.error('Error handling file selection:', error);
                debugLog('error', 'File selection error', { error: error.message });
                if (typeof this.options.onError === 'function') {
                    this.options.onError(error);
                }
            } finally {
                // Reset the file input to allow selecting the same file again
                // But do it after a short delay to prevent the dialog from reopening
                setTimeout(() => {
                    this.fileInput.value = '';
                    this.processingFile = false;
                }, 300);
            }
        });
        
        debugLog('FileUploader', 'Event listeners initialized');
    }
    
    /**
     * Safely execute a callback function with error handling
     * @private
     * @param {Function} callback - Function to execute
     * @returns {Promise<any>} Result of the callback function
     */
    async _safeCallback(callback) {
        try {
            return await callback();
        } catch (error) {
            console.error('Error in callback:', error);
            throw error;
        }
    }
    
    /**
     * Upload file to server
     * @param {File} file - File to upload
     * @param {Object} params - Upload parameters
     * @returns {Promise<Object>} Upload result
     */
    async uploadFile(file, additionalParams = {}) {
        try {
            // Verify required parameters are in app state
            const requiredParams = ['documentId', 'workspaceId', 'elementId'];
            const missingParams = requiredParams.filter(param => !appState.state[param]);
            
            if (missingParams.length > 0) {
                throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
            }

            if (this.uploadInProgress) {
                debugLog('FileUploader', 'Upload already in progress');
                throw new Error('Upload already in progress');
            }
            
            this.uploadInProgress = true;
            this.isUploading = true;
            
            // Verify we have a file to upload
            if (!file) {
                throw new Error('No file selected for upload');
            }
            
            // Validate file type
            if (!file.name.toLowerCase().endsWith('.svg')) {
                throw new Error('Only SVG files are supported');
            }
            
            debugLog('FileUploader', `Uploading file: ${file.name}`);
            
            // Call upload start callback if provided
            if (typeof this.options.onUploadStart === 'function') {
                await this._safeCallback(() => this.options.onUploadStart(file));
            }
            
            // Get required parameters from app state
            const stateParams = appState.state.params || {};
            const params = {
                ...stateParams,
                ...additionalParams
            };

            // Create form data for file upload
            const formData = new FormData();
            formData.append('file', file);
            
            // Add parameters to form data
            for (const key in params) {
                if (params[key] !== undefined && params[key] !== null) {
                    formData.append(key, params[key]);
                }
            }
            
            // Upload file
            const response = await fetch('/api/convert', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to upload file: ${response.status}`);
            }
            
            const result = await response.json();
            
            debugLog('FileUploader', 'Upload complete', result);
            
            // Call upload complete callback if provided
            if (typeof this.options.onUploadComplete === 'function') {
                await this._safeCallback(() => this.options.onUploadComplete(result));
            }
            
            // Dispatch success event for other components to react
            document.dispatchEvent(new CustomEvent('svgUploadComplete', {
                detail: { 
                    result, 
                    file
                }
            }));
            
            return result;
        } catch (error) {
            debugLog('error', 'Upload failed', {
                error: error.message,
                state: appState.state
            });
            
            // Call error callback if provided
            if (typeof this.options.onError === 'function') {
                await this._safeCallback(() => this.options.onError(error));
            }
            
            // Dispatch error event for other components to react
            document.dispatchEvent(new CustomEvent('svgUploadError', {
                detail: { 
                    error: error.message || 'Unknown upload error',
                    originalError: error,
                    file
                }
            }));
            
            throw error;
        } finally {
            // Reset flags
            setTimeout(() => {
                this.uploadInProgress = false;
                this.isUploading = false;
            }, 300); // Short delay to prevent rapid repeated clicks
        }
    }
}

// Create and register instance
const fileUploader = new FileUploader();
registry.register('fileUploader', fileUploader, ['appState', 'svgHandler']);

export default fileUploader;