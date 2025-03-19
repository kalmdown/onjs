/**
 * Plane selector component for selecting a reference plane in a part studio
 */

import { Selector } from './utils/selector.js';
import { logInfo, logError, logDebug, logWarn } from './utils/logging.js';
import { fetchPlanesForPartStudio } from './api.js';

export class PlaneSelector extends Selector {
  constructor() {
    super({
      containerId: 'planeContainer',
      label: 'Select Plane'
    });
    
    this.planes = [];
    this.documentId = null;
    this.workspaceId = null;
    this.elementId = null;
    this.isLoading = false;
    
    // Add construction logging
    console.log('[DEBUG] PlaneSelector constructor called');
  }
  
  /**
   * Update the UI to reflect the current state
   * This method ensures compatibility with selector.js expectations
   */
  updateUI() {
    // Update loading state in UI
    if (this.container) {
      if (this.isLoading) {
        this.container.classList.add('loading');
        const loadingText = this.container.querySelector('.selector-loading');
        if (loadingText) {
          loadingText.style.display = 'block';
        } else {
          const loadingElem = document.createElement('div');
          loadingElem.className = 'selector-loading';
          loadingElem.textContent = 'Loading planes...';
          this.container.appendChild(loadingElem);
        }
      } else {
        this.container.classList.remove('loading');
        const loadingText = this.container.querySelector('.selector-loading');
        if (loadingText) {
          loadingText.style.display = 'none';
        }
      }
    }
  }

  /**
   * Process planes data from API to handle different formats
   * @param {Object|Array} data - The data returned from the API
   * @returns {Array} Normalized planes array
   */
  processPlaneData(data) {
    // Log the incoming data
    console.log('[DEBUG] Processing plane data:', data);
    
    let planes = [];
    
    // If the data is an array, use it directly
    if (Array.isArray(data)) {
      console.log(`[DEBUG] Data is an array with ${data.length} planes`);
      planes = data;
    }
    // If data has a planes property that's an array, use that
    else if (data && data.planes && Array.isArray(data.planes)) {
      console.log(`[DEBUG] Data has planes property with ${data.planes.length} planes`);
      planes = data.planes;
    }
    // If data has a referencePlanes property that's an array, use that
    else if (data && data.referencePlanes && Array.isArray(data.referencePlanes)) {
      console.log(`[DEBUG] Data has referencePlanes property with ${data.referencePlanes.length} planes`);
      planes = data.referencePlanes;
    }
    // Default to empty array if we can't figure out the format
    else {
      console.warn('[DEBUG] Unknown planes data format:', data);
      return [];
    }
    
    // Count types of planes for debugging
    const standardPlanes = planes.filter(p => p.type === 'STANDARD' || !p.type).length;
    const customPlanes = planes.filter(p => p.type === 'CUSTOM').length;
    console.log(`[DEBUG] Planes breakdown: ${standardPlanes} standard, ${customPlanes} custom`);
    
    // Add display names to make plane types clearer in UI
    return planes.map(plane => ({
      ...plane,
      name: plane.name + (plane.type === 'CUSTOM' ? ' (Custom)' : '')
    }));
  }

  /**
   * Load planes for the selected part studio
   * @param {string} documentId - Document ID
   * @param {string} elementId - Element ID (part studio ID)
   * @param {string} [workspaceId] - Optional workspace ID
   * @returns {Promise<Array>} - The loaded planes
   */
  async loadPlanes(documentId, elementId, workspaceId = null) {
    console.log(`[DEBUG] PlaneSelector.loadPlanes called with documentId=${documentId}, elementId=${elementId}, workspaceId=${workspaceId}`);
    
    if (!documentId || !elementId) {
      console.error('[DEBUG] Document ID and Element ID are required to load planes');
      logError('Document ID and Element ID are required to load planes');
      return [];
    }
    
    try {
      this.isLoading = true;
      this.updateUI();
      
      console.log(`[DEBUG] Loading planes for document ${documentId}, element ${elementId}`);
      
      // Store parameters for potential retry
      this.documentId = documentId;
      this.workspaceId = workspaceId;
      this.elementId = elementId;
      
      // Use the API utility with the updated endpoint
      console.log(`[DEBUG] Calling fetchPlanesForPartStudio API`);
      let planesData;
      
      try {
        planesData = await fetchPlanesForPartStudio(
          documentId, 
          workspaceId, 
          elementId,
          { includeCustomPlanes: true }
        );
        console.log(`[DEBUG] API returned planes data:`, planesData);
      } catch (apiError) {
        console.error('[DEBUG] API call failed:', apiError);
        throw apiError;
      }
      
      // Check for undefined/null result
      if (!planesData) {
        console.warn('[DEBUG] API returned undefined/null result');
        planesData = [];
      }
      
      // Process the data to handle different formats
      console.log('[DEBUG] Processing planes data');
      this.planes = this.processPlaneData(planesData);
      
      console.log(`[DEBUG] Processed ${this.planes.length} planes`);
      
      if (this.planes.length) {
        console.log(`[DEBUG] Setting ${this.planes.length} planes in selector`);
        
        // Set the items in the selector UI
        this.setItems(this.planes);
        
        // Select the first item if available
        if (this.planes.length > 0) {
          console.log(`[DEBUG] Auto-selecting first plane: ${this.planes[0].name}`);
          this.selectItem(this.planes[0]);
        }
      } else {
        console.warn(`[DEBUG] No planes returned for element ${elementId}`);
        this.setItems([]);
      }
      
      return this.planes;
    } catch (error) {
      console.error(`[DEBUG] Failed to load planes:`, error);
      logError(`Failed to load planes: ${error.message}`);
      
      // Create default fallback planes
      const defaultPlanes = [
        { id: `${elementId}_JHD`, name: "TOP", type: "STANDARD", transientId: "TOP" },
        { id: `${elementId}_JFD`, name: "FRONT", type: "STANDARD", transientId: "FRONT" },
        { id: `${elementId}_JGD`, name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      console.log('[DEBUG] Using default planes as fallback', defaultPlanes);
      
      this.planes = defaultPlanes;
      this.setItems(defaultPlanes);
      
      if (defaultPlanes.length > 0) {
        this.selectItem(defaultPlanes[0]);
      }
      
      return defaultPlanes;
    } finally {
      this.isLoading = false;
      this.updateUI();
      console.log(`[DEBUG] loadPlanes finished, isLoading set to ${this.isLoading}`);
    }
  }

  /**
   * Retry loading planes with the last used parameters
   * Useful after connection errors or timeouts
   */
  retryLoadPlanes() {
    if (this.documentId && this.elementId) {
      logInfo('Retrying plane load...');
      console.log('[DEBUG] Retrying plane load...');
      return this.loadPlanes(
        this.documentId,
        this.elementId,
        this.workspaceId
      );
    } else {
      logError('Cannot retry - no previous load parameters');
      console.error('[DEBUG] Cannot retry - no previous load parameters');
      return Promise.reject(new Error('No previous load parameters'));
    }
  }
  
  /**
   * Reset the selector to initial state
   */
  reset() {
    this.documentId = null;
    this.workspaceId = null;
    this.elementId = null;
    this.planes = [];
    this.selectedItem = null;
    
    // Make sure we have a select button before accessing it
    if (this.selectButton) {
      const textElem = this.selectButton.querySelector('.selector-text');
      if (textElem) {
        textElem.textContent = 'Select Plane';
      }
    }
    
    this.setItems([]);
  }
}

// Create singleton instance
const planeSelector = new PlaneSelector();
console.log('[DEBUG] planeSelector singleton instance created');

// Add global access for debugging
window.planeSelector = planeSelector;
console.log('[DEBUG] planeSelector exposed as window.planeSelector for debugging');

export default planeSelector;