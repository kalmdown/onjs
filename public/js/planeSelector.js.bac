/**
 * Plane selector component for selecting a reference plane in a part studio
 */

import { Selector } from './utils/selector.js';
import { logInfo, logError, logDebug, logWarn } from './utils/logging.js';

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
    // If data has a referencePlanes property that's an array, use that
    else if (data && data.referencePlanes && Array.isArray(data.referencePlanes)) {
      console.log(`[DEBUG] Data has referencePlanes property with ${data.referencePlanes.length} planes`);
      planes = data.referencePlanes;
    }
    // If data has features property that's an array, filter for plane features
    else if (data && data.features && Array.isArray(data.features)) {
      console.log(`[DEBUG] Data has features property - extracting planes`);
      planes = this.extractPlanesFromFeatures(data.features);
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
   * Extract plane features from a list of features
   * @param {Array} features - Features to search
   * @returns {Array} - Extracted planes
   */
  extractPlanesFromFeatures(features) {
    console.log(`[DEBUG] Extracting planes from ${features?.length || 0} features`);
    
    if (!features || !features.length) {
      console.log(`[DEBUG] No features to extract planes from`);
      return [];
    }
    
    // Look for plane features using multiple criteria
    const planeFeatures = features.filter(feature => {
      // Skip features without required properties
      if (!feature) return false;
      
      const featureType = (feature.featureType || '').toLowerCase();
      const name = (feature.name || '').toLowerCase();
      const typeName = (feature.typeName || '').toLowerCase();
      
      // Return true for any feature that looks like a plane
      return featureType.includes('plane') || 
             typeName.includes('plane') ||
             name.includes('plane') || 
             featureType === 'cplane';
    });
    
    console.log(`[DEBUG] Found ${planeFeatures.length} potential plane features`);
    if (planeFeatures.length > 0) {
      console.log(`[DEBUG] Plane feature names: ${planeFeatures.map(p => p.name).join(', ')}`);
    }
    
    // Map plane features to the format expected by the UI
    return planeFeatures.map(feature => ({
      id: feature.featureId || `plane_${feature.name?.replace(/\s+/g, '_')?.toLowerCase()}`,
      name: feature.name || 'Unnamed Plane',
      type: 'CUSTOM',
      featureId: feature.featureId,
      featureType: feature.featureType,
      typeName: feature.typeName
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
      
      // Use 'w' as default workspace if null or undefined
      const wsId = workspaceId || 'w';
      
      // Create standard planes based on known Onshape plane IDs
      // Standard planes have permanent IDs:
      // "JHD" for Top plane
      // "JHC" for Front plane
      // "JHF" for Right plane
      const standardPlanes = [
        { id: "JHD", name: "TOP", type: "STANDARD", transientId: "TOP" },
        { id: "JHC", name: "FRONT", type: "STANDARD", transientId: "FRONT" },
        { id: "JHF", name: "RIGHT", type: "STANDARD", transientId: "RIGHT" }
      ];
      
      console.log(`[DEBUG] Using ${standardPlanes.length} standard planes with known IDs`);
      
      // Get custom planes from features endpoint
      const featuresUrl = `/api/features?documentId=${documentId}&elementId=${elementId}&workspaceId=${wsId}`;
      console.log(`[DEBUG] Fetching features for custom planes from: ${featuresUrl}`);
      
      let customPlanes = [];
      try {
        const featuresResponse = await fetch(featuresUrl);
        
        if (featuresResponse.ok) {
          const featuresData = await featuresResponse.json();
          console.log(`[DEBUG] Retrieved ${featuresData.features?.length || 0} features`);
          
          // Extract custom planes from features
          customPlanes = this.extractPlanesFromFeatures(featuresData.features || []);
          console.log(`[DEBUG] Extracted ${customPlanes.length} custom planes from features`);
        } else {
          console.warn(`[DEBUG] Features endpoint returned ${featuresResponse.status}`);
        }
      } catch (featuresError) {
        console.error('[DEBUG] Error fetching features:', featuresError);
      }
      
      // Combine standard and custom planes
      this.planes = [...standardPlanes, ...customPlanes];
      
      console.log(`[DEBUG] Combined ${this.planes.length} total planes (${standardPlanes.length} standard, ${customPlanes.length} custom)`);
      
      if (this.planes.length) {
        console.log(`[DEBUG] Setting ${this.planes.length} planes in selector`);
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
      this.setItems([]);
      return [];
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