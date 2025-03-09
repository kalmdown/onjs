/**
 * Plane selector component for selecting a sketch plane
 */

import { Selector } from './utils/selector.js';
import { logInfo, logError, logDebug } from './utils/logging.js';
import { fetchPlanesForPartStudio } from './api.js';

export class PlaneSelector extends Selector {
  constructor() {
    super({
      containerId: 'planeContainer',
      label: 'Select Sketch Plane'
    });
    
    this.documentId = null;
    this.partStudioId = null;
    this.lastIncludeCustomPlanes = true; // Track last setting
  }
  
  /**
   * Load planes for a part studio
   * 
   * @param {string} documentId The document ID
   * @param {string} partStudioId The part studio ID
   * @param {boolean} includeCustomPlanes Whether to include custom planes (default: true)
   */
  async loadPlanes(documentId, partStudioId, includeCustomPlanes = true) {
    if (!documentId || !partStudioId) {
      logError('Document ID and Part Studio ID are required to load planes');
      return;
    }
    
    try {
      logInfo(`DEBUGGING: Starting plane load for ${partStudioId} with includeCustomPlanes=${includeCustomPlanes}`);
      
      // Store parameters for potential retry
      this.documentId = documentId;
      this.partStudioId = partStudioId;
      this.lastIncludeCustomPlanes = includeCustomPlanes;
      
      // Clear existing planes while loading
      this.setItems([]);
      
      // Get workspaces for better debugging
      const workspaces = await window.fetch(`/api/documents/${documentId}/workspaces`).then(r => r.json());
      const workspaceId = workspaces.find(w => w.isDefault)?.id || workspaces[0]?.id;
      logInfo(`Using workspace: ${workspaceId}`);
      
      // Explicitly passing includeCustomPlanes to ensure it's not lost
      try {
        const planes = await fetchPlanesForPartStudio(
          documentId, 
          partStudioId, 
          includeCustomPlanes
        );
        
        logInfo(`DEBUGGING: Raw planes response: ${JSON.stringify(planes)}`);
        
        if (!planes || !Array.isArray(planes)) {
          throw new Error('Invalid response format: expected array of planes');
        }
        
        logInfo(`Found ${planes.length} planes`);
        
        // Count plane types for debugging
        const planeTypes = {};
        planes.forEach(p => {
          const type = p.type || 'unknown';
          planeTypes[type] = (planeTypes[type] || 0) + 1;
        });
        
        // Log summary of plane types
        Object.entries(planeTypes).forEach(([type, count]) => {
          logInfo(`Found ${count} planes of type: ${type}`);
        });
        
        // Check if custom planes were requested but none found
        if (includeCustomPlanes && !planeTypes.custom) {
          logInfo('Note: No custom planes were found');
        }
        
        // Set the planes in the selector
        this.setItems(planes);
        
        // Select the first item if available
        if (planes.length > 0) {
          this.selectItem(planes[0]);
          return planes;
        } else {
          logInfo('No planes available for selection');
          return [];
        }
      } catch (fetchError) {
        logError(`Fetch error: ${fetchError.message}`);
        console.error('Full fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      logError(`Failed to load planes: ${error.message}`);
      this.setItems([]);
      throw error;
    }
  }
  
  /**
   * Retry loading planes with the last used parameters
   * Useful after connection errors or timeouts
   */
  async retryLoadPlanes() {
    if (this.documentId && this.partStudioId) {
      logInfo('Retrying plane load...');
      return this.loadPlanes(
        this.documentId,
        this.partStudioId,
        this.lastIncludeCustomPlanes
      );
    } else {
      logError('Cannot retry - no previous load parameters');
      return Promise.reject(new Error('No previous load parameters'));
    }
  }
  
  /**
   * Reset the selector to initial state
   */
  reset() {
    this.documentId = null;
    this.partStudioId = null;
    this.selectedItem = null;
    this.selectButton.querySelector('.selector-text').textContent = 'Select Sketch Plane';
    this.setItems([]);
  }
}

// Create singleton instance
const planeSelector = new PlaneSelector();
export default planeSelector;