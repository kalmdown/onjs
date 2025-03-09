import registry from './registry.js';
import { debugLog } from '/js/utils/debug.js';

/**
 * Central state management for the application
 */
export class AppState {
    constructor() {
        // Initialize Set before using it
        this._subscribers = new Set();
        
        this.state = {
            documentId: null,
            workspaceId: null,
            elementId: null,
            currentFile: null,
            selectedPlane: null,
            svgContent: null,
            isConverting: false,
            lastUploadedFile: null,
            lastUploadTime: 0,
            statusMessages: {
                plane: null,
                file: null,
                convert: null
            }
        };

        // Listen for plane selection events
        document.addEventListener('planeSelected', (event) => {
            try {
                this.setPlane(event.detail.plane);
            } catch (error) {
                debugLog('error', 'Error handling plane selection', { error });
            }
        });

        // Initialize URL parameters last
        this._initFromUrlParams();
    }

    _initFromUrlParams() {
        const params = this._getUrlParams();
        if (params) {
            this.setState(params);
            debugLog('state', 'Initialized from URL parameters', params);
        }
    }

    _getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const documentId = params.get('documentId');
        const workspaceId = params.get('workspaceId');
        const elementId = params.get('elementId');
        
        debugLog('state', 'URL parameters:', { documentId, workspaceId, elementId });
        
        if (documentId && workspaceId && elementId) {
            return { documentId, workspaceId, elementId };
        }
        return null;
    }

    setState(updates) {
        if (!updates) return;

        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        debugLog('state', 'State updated', {
            previous: oldState,
            current: this.state,
            changes: updates
        });

        if (this._subscribers) {
            this._notifySubscribers();
        }
    }

    _notifySubscribers() {
        if (!this._subscribers) return;
        
        this._subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                debugLog('error', 'Error in state subscriber callback', { error });
            }
        });
    }

    getDocumentParams() {
        return {
            documentId: this.state.documentId,
            workspaceId: this.state.workspaceId,
            elementId: this.state.elementId
        };
    }

    hasRequiredParams() {
        const params = this.getDocumentParams();
        return Object.values(params).every(value => !!value);
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this._subscribers.add(callback);
        }
    }

    unsubscribe(callback) {
        if (this._subscribers) {
            this._subscribers.delete(callback);
        }
    }

    /**
     * Update status message for a specific component
     * @param {string} component - Component name (plane, file, convert)
     * @param {string} message - Status message
     * @private
     */
    _updateStatus(component, message) {
        this.setState({
            statusMessages: {
                ...this.state.statusMessages,
                [component]: message
            }
        });
    }

    /**
     * Update selected plane with status handling
     * @param {Object|string} plane - Plane object or ID
     */
    setPlane(plane) {
        const planeId = plane?.id || plane;
        const planeName = plane?.name || planeId;

        this.setState({ 
            selectedPlane: planeId,
            statusMessages: {
                ...this.state.statusMessages,
                plane: planeName ? `Selected plane: ${planeName}` : null
            }
        });

        debugLog('state', `Plane selected:`, {
            planeId,
            planeName,
            hasFile: !!this.state.currentFile
        });
    }

    /**
     * Update current file with status handling
     * @param {File} file - Selected file
     */
    setFile(file) {
        this.setState({ 
            currentFile: file,
            lastUploadedFile: file,
            lastUploadTime: Date.now(),
            statusMessages: {
                ...this.state.statusMessages,
                file: file ? `Selected file: ${file.name}` : null
            }
        });

        debugLog('state', `File selected:`, {
            fileName: file?.name,
            hasPlane: !!this.state.selectedPlane
        });
    }

    // Add method to check if conversion is possible
    hasRequiredState() {
        return (
            this.state.currentFile != null &&
            this.state.selectedPlane != null &&
            this.hasRequiredParams()
        );
    }
}

// Create singleton instance and make globally available
const appState = new AppState();
window.AppState = AppState; // Make constructor available globally
window.appState = appState; // Make instance available globally

// Register with registry
registry.register('appState', appState);

export default appState;