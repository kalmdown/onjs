// Update the import path to use relative path since utils is in same directory
import { debugLog } from './utils/debug.js';

/**
 * Component Registry - Manages application component lifecycle
 */
class ComponentRegistry {
    constructor() {
        this.components = new Map();
        this.initialized = new Set();
        this.dependencies = new Map();
        // Debug setting is now controlled through appConfig
        this._debug = true; // Enable debugging by default for troubleshooting
    }
    
    register(name, component, dependencies = []) {
        if (!name || typeof name !== 'string') {
            throw new Error('Component name is required and must be a string');
        }

        if (!component) {
            throw new Error(`Cannot register null/undefined component: ${name}`);
        }

        debugLog('registry', `Registering component: ${name}`, {
            componentType: component.constructor.name,
            hasDependencies: dependencies.length > 0,
            dependencies
        });

        if (this.components.has(name)) {
            debugLog('registry', `Component ${name} already registered`, {
                existing: this.components.get(name).constructor.name
            });
            return false;
        }

        this.components.set(name, component);
        this.dependencies.set(name, dependencies);
        
        debugLog('registry', `Component ${name} registered successfully`);
        return true;
    }
    
    initialize(name) {
        debugLog('registry', `Initializing component: ${name}`, {
            hasComponent: this.components.has(name),
            isInitialized: this.initialized.has(name),
            dependencies: this.dependencies.get(name)
        });
        
        if (this.initialized.has(name)) {
            debugLog('registry', `Component already initialized: ${name}`);
            return this.components.get(name);
        }
        
        const deps = this.dependencies.get(name) || [];
        for (const dep of deps) {
            if (!this.isInitialized(dep)) {
                try {
                    this.initialize(dep);
                } catch (error) {
                    debugLog('error', `Failed to initialize dependency '${dep}' for component '${name}'`, {
                        error: error.message,
                        stack: error.stack
                    });
                    throw error;
                }
            }
        }
        
        const component = this.components.get(name);
        if (!component) {
            const error = new Error(`Component ${name} not found.`);
            debugLog('error', error.message);
            throw error;
        }
        
        try {
            if (typeof component.init === 'function') {
                component.init();
            }
            
            this.initialized.add(name);
            debugLog('registry', `Component ${name} initialized successfully`);
            return component;
        } catch (error) {
            debugLog('error', `Failed to initialize component ${name}`, {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    getComponent(name) {
        const component = this.components.get(name);
        debugLog('registry', `Getting component: ${name}`, {
            exists: !!component,
            initialized: this.initialized.has(name),
            type: component?.constructor.name
        });
        return component;
    }
    
    isInitialized(name) {
        return this.initialized.has(name);
    }

    _log(message, level = 'debug') {
        // Always use debugLog for better tracing
        debugLog('registry', message);
    }
    
    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebug(enabled) {
        this._debug = !!enabled;
    }
}

// Create singleton instance
const registry = new ComponentRegistry();

// Add initialization status check method
registry.validateComponents = () => {
    debugLog('registry', 'Validating component registry state', {
        registeredComponents: Array.from(registry.components.keys()),
        initializedComponents: Array.from(registry.initialized),
        dependencyMap: Object.fromEntries(registry.dependencies)
    });
};

export default registry;