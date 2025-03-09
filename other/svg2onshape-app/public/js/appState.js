class AppState {
    constructor() {
        this.state = {
            currentFile: null,
            selectedPlane: null,
            documentParams: {},
            isConverting: false,
            svgContent: null
        };
        
        this.listeners = new Set();
    }

    init() {
        // Initialize with URL parameters
        this.state.documentParams = this._getDocumentParams();
        window.debug('AppState', 'Initialized with params', this.state.documentParams);
    }

    _getDocumentParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            documentId: params.get('documentId'),
            workspaceId: params.get('workspaceId'),
            elementId: params.get('elementId')
        };
    }

    setState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Notify listeners of state change
        this._notifyListeners(oldState, this.state);
    }

    _notifyListeners(oldState, newState) {
        this.listeners.forEach(listener => {
            try {
                listener(newState, oldState);
            } catch (error) {
                console.error('Error in state change listener:', error);
            }
        });

        // Dispatch global event for legacy support
        document.dispatchEvent(new CustomEvent('app:state:changed', {
            detail: { oldState, newState }
        }));
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getDocumentParams() {
        return this.state.documentParams;
    }
}

// Register with component registry
window.addEventListener('DOMContentLoaded', () => {
    if (window.appRegistry) {
        const appState = new AppState();
        window.appRegistry.register('appState', appState);
    }
});