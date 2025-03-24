// public/js/utils/svg-utils.js
/**
 * Client-side SVG utilities for handling SVG file metadata extraction
 * and server-side processing requests
 */

// Create client-side logger
function createLogger(scope) {
  return {
    debug: (msg) => console.debug(`[${scope}]`, msg),
    info: (msg) => console.info(`[${scope}]`, msg),
    warn: (msg) => console.warn(`[${scope}]`, msg),
    error: (msg, err) => console.error(`[${scope}]`, msg, err)
  };
}

const log = createLogger('SVGUtils');

/**
 * Extract metadata from an SVG file for UI purposes only
 * No conversion happens client-side
 * @param {File} svgFile - The SVG file object
 * @returns {Promise<Object>} - SVG metadata for UI configuration
 */
function extractSvgMetadata(svgFile) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const svgContent = e.target.result;
        
        // Simple DOM parsing to extract UI-relevant information
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
        
        // Check for parsing errors
        const parserError = svgDoc.querySelector('parsererror');
        if (parserError) {
          reject(new Error('Invalid SVG file: ' + parserError.textContent));
          return;
        }
        
        // Extract group names
        const groups = Array.from(svgDoc.querySelectorAll('g[id]'))
          .map(g => ({ 
            id: g.id, 
            name: g.getAttribute('name') || g.id,
            hasAttributes: g.attributes.length > 2 // More than just id and name
          }));
        
        // Check for text elements
        const hasText = svgDoc.querySelectorAll('text').length > 0;
        
        // Check for paths that might be text on a curve
        const paths = svgDoc.querySelectorAll('path');
        const potentialTextOnCurve = Array.from(paths)
          .some(p => p.getAttribute('data-text-path') || 
                    p.id?.includes('text') || 
                    p.hasAttribute('text-anchor'));
        
        // Extract viewBox information
        let viewBox = { x: 0, y: 0, width: 100, height: 100 };
        const svgElement = svgDoc.documentElement;
        if (svgElement.hasAttribute('viewBox')) {
          const viewBoxAttr = svgElement.getAttribute('viewBox');
          const [x, y, width, height] = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
          viewBox = { x, y, width, height };
        }
        
        // Extract units information
        let units = 'px';
        if (svgElement.hasAttribute('width')) {
          const widthAttr = svgElement.getAttribute('width');
          const unitMatch = widthAttr.match(/([0-9.]+)([a-z%]+)?/i);
          if (unitMatch && unitMatch[2]) {
            units = unitMatch[2].toLowerCase();
          }
        }
        
        log.debug(`Extracted SVG metadata: ${groups.length} groups, hasText: ${hasText}`);
        
        // Return extracted metadata
        resolve({
          groups,
          hasText,
          potentialTextOnCurve,
          viewBox,
          units,
          fileSize: svgFile.size,
          fileName: svgFile.name
        });
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read SVG file'));
      };
      
      reader.readAsText(svgFile);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload and process an SVG file on the server
 * All conversion happens server-side
 * @param {File} svgFile - The SVG file to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result with conversionId
 */
function uploadAndProcessSvg(svgFile, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      log.debug(`Uploading SVG file for server processing: ${svgFile.name} (${svgFile.size} bytes)`);
      
      // Create form data with file and options
      const formData = new FormData();
      formData.append('svgFile', svgFile);
      formData.append('options', JSON.stringify(options));
      
      // Upload to server for processing
      fetch('/api/svg/process', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin' // Include cookies for auth
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(`SVG processing failed: ${errorData.error}`);
          });
        }
        return response.json();
      })
      .then(result => {
        log.debug('SVG processing successful, received conversion ID');
        resolve(result); // Contains conversionId
      })
      .catch(error => {
        log.error(`SVG upload error: ${error.message}`, error);
        reject(error);
      });
    } catch (error) {
      log.error(`SVG upload preparation error: ${error.message}`, error);
      reject(error);
    }
  });
}

/**
 * Create features in Onshape using a previously processed SVG
 * @param {string} conversionId - ID of the previously processed SVG
 * @param {Object} options - Creation options including documentId, elementId
 * @returns {Promise<Object>} - Creation result
 */
function createFeaturesFromProcessedSvg(conversionId, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      log.debug(`Creating features from processed SVG: ${conversionId}`);
      
      if (!options.documentId) {
        reject(new Error('Missing documentId'));
        return;
      }
      
      if (!options.elementId) {
        reject(new Error('Missing elementId'));
        return;
      }
      
      // Get workspace ID if not provided
      const getWorkspaceId = options.workspaceId 
        ? Promise.resolve(options.workspaceId) 
        : fetch(`/api/onshape/documents/${options.documentId}/workspaces`)
            .then(response => response.json())
            .then(workspaces => workspaces[0]?.id);
      
      getWorkspaceId
        .then(workspaceId => {
          if (!workspaceId) {
            throw new Error('Could not determine workspace ID');
          }
          
          // Create request with just the reference ID
          return fetch('/api/svg/createFeatures', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              documentId: options.documentId,
              workspaceId: workspaceId,
              elementId: options.elementId,
              conversionId: conversionId // Only send the reference ID, not the features
            }),
            credentials: 'same-origin'
          });
        })
        .then(response => {
          if (!response.ok) {
            return response.json().then(errorData => {
              throw new Error(`Feature creation failed: ${errorData.error}`);
            });
          }
          return response.json();
        })
        .then(result => {
          log.debug('Feature creation successful');
          resolve(result);
        })
        .catch(error => {
          log.error(`Feature creation error: ${error.message}`, error);
          reject(error);
        });
    } catch (error) {
      log.error(`Feature creation preparation error: ${error.message}`, error);
      reject(error);
    }
  });
}

// Export for browser use
window.svgUtils = {
  extractSvgMetadata,
  uploadAndProcessSvg,
  createFeaturesFromProcessedSvg
};