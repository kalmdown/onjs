/**
 * Client-side application configuration
 * Manages feature flags, debug settings, and component configuration
 * 
 * @version 1.1.0
 * @module appConfig
 * 
 * Usage:
 * import appConfig, { features, components } from '/js/appConfig.js';
 * 
 * // Access full config
 * console.log(appConfig.components.planeSelector);
 * 
 * // Or use named exports for specific sections
 * console.log(features.groupedPlanes);
 * console.log(components.svgHandler);
 */

const APP_CONFIG = {
    // Feature flags
    features: {
        groupedPlanes: true,
        svgValidation: true,
        keyboardNavigation: true
    },

    // Component configuration
    components: {
        planeSelector: {
            containerId: 'plane-selector',
            defaultText: 'Select a plane',
            groupingEnabled: true
        },
        svgHandler: {
            maxFileSize: 1024 * 1024, // 1MB
            allowedTypes: ['image/svg+xml'],
            previewContainerId: 'svgPreview'
        },
        sketchConverter: {
            buttonId: 'convertToSketch',
            statusContainerId: 'conversionStatus'
        },
        fileUploader: {
            uploadButtonId: 'uploadButton',
            fileInputId: 'fileInput'
        }
    },

    // API endpoints (relative paths)
    api: {
        convert: '/api/convert',
        planes: '/api/planes',
        health: '/api/health'
    },

    // Debug configuration
    debug: {
        enabled: false,
        DEBUG: false,
        DEBUG_API_CALLS: false,
        DEBUG_PLANES: false,
        DEBUG_UI: false,
        components: {
            planeSelector: false,
            svgHandler: false,
            sketchConverter: false,
            fileUploader: false,
            appClient: false
        },
        // Add tracking configuration
        tracking: {
            enabled: false,
            instances: new Map(),
            loads: 0,
            planeSelectors: {
                loads: 0,
                instances: 0
            }
        }
    }
};

/**
 * Helper function to safely access configuration values
 * @param {string} path - Dot notation path to config value
 * @param {any} defaultValue - Default value if path not found
 * @returns {any} Config value or default
 */
export function getConfig(path, defaultValue) {
    try {
        const parts = path.split('.');
        let current = APP_CONFIG;
        
        for (const part of parts) {
            if (current === undefined || current === null) return defaultValue;
            current = current[part];
        }
        
        return current !== undefined ? current : defaultValue;
    } catch (e) {
        console.warn(`Error accessing config path: ${path}`, e);
        return defaultValue;
    }
}

// Freeze configuration to prevent runtime modifications
Object.freeze(APP_CONFIG);

// Export the configuration object
export default APP_CONFIG;

// Named exports for specific config sections
export const features = APP_CONFIG.features;
export const components = APP_CONFIG.components;
export const api = APP_CONFIG.api;
export const debug = APP_CONFIG.debug;

// Configuration version
export const VERSION = '1.1.0';