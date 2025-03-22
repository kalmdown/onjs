// public/js/planeSelector.js
import { Selector } from './utils/selector.js';
import { logInfo, logError, logDebug, logWarn } from './utils/logging.js';

export class PlaneSelector extends Selector {
  constructor() {
    super({
      containerId: 'planeContainer',
      label: 'Select Plane'
    });
    
    this.planes = {
      defaultPlanes: [],
      customPlanes: []
    };
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
   * Create the dropdown content with sections for default and custom planes
   * Overrides the parent class method
   */
  renderItems() {
    if (!this.container) return;
    
    this.dropdownContent.innerHTML = '';
    
    // Helper to create a section header
    const createSectionHeader = (title) => {
      const header = document.createElement('div');
      header.className = 'plane-section-header';
      header.style.fontWeight = 'bold';
      header.style.backgroundColor = '#f5f5f5';
      header.style.padding = '5px';
      header.textContent = title;
      return header;
    };
    
    // Default planes section
    if (this.planes.defaultPlanes && this.planes.defaultPlanes.length > 0) {
      this.dropdownContent.appendChild(createSectionHeader('Default Planes'));
      
      // Create a container for default plane items
      const defaultPlanesContainer = document.createElement('div');
      defaultPlanesContainer.className = 'plane-items-container';
      
      this.planes.defaultPlanes.forEach(plane => {
        const element = document.createElement('div');
        element.className = 'selector-item';
        element.textContent = plane.name;
        element.dataset.id = plane.id;
        
        element.addEventListener('click', () => {
          this.selectItem(plane);
        });
        
        defaultPlanesContainer.appendChild(element);
      });
      
      this.dropdownContent.appendChild(defaultPlanesContainer);
    }
    
    // Custom planes section
    if (this.planes.customPlanes && this.planes.customPlanes.length > 0) {
      this.dropdownContent.appendChild(createSectionHeader('Custom Planes'));
      
      // Create a container for custom plane items
      const customPlanesContainer = document.createElement('div');
      customPlanesContainer.className = 'plane-items-container';
      
      this.planes.customPlanes.forEach(plane => {
        const element = document.createElement('div');
        element.className = 'selector-item';
        element.textContent = plane.name;
        element.dataset.id = plane.id;
        
        element.addEventListener('click', () => {
          this.selectItem(plane);
        });
        
        customPlanesContainer.appendChild(element);
      });
      
      this.dropdownContent.appendChild(customPlanesContainer);
    }
    
    // Empty state
    if ((!this.planes.defaultPlanes || this.planes.defaultPlanes.length === 0) && 
        (!this.planes.customPlanes || this.planes.customPlanes.length === 0)) {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'selector-empty';
      emptyElement.textContent = 'No planes available';
      this.dropdownContent.appendChild(emptyElement);
    }
  }

  /**
   * Override setItems to handle the new format
   * @param {Object} planes - Object with defaultPlanes and customPlanes arrays
   */
  setItems(planes) {
    this.planes = planes;
    this.renderItems();
  }

  /**
   * Load planes for the selected part studio
   * @param {string} documentId - Document ID
   * @param {string} elementId - Element ID (part studio ID)
   * @param {string} [workspaceId] - Optional workspace ID
   * @returns {Promise<Object>} - The loaded planes
   */
  async loadPlanes(documentId, elementId, workspaceId = null) {
    console.log(`[DEBUG] PlaneSelector.loadPlanes called with documentId=${documentId}, elementId=${elementId}, workspaceId=${workspaceId}`);
    
    if (!documentId || !elementId) {
      console.error('[DEBUG] Document ID and Element ID are required to load planes');
      logError('Document ID and Element ID are required to load planes');
      return { defaultPlanes: [], customPlanes: [] };
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
      
      // Fetch planes from the updated API endpoint
      try {
        const planesUrl = `planes/${documentId}/w/${wsId}/e/${elementId}`;
        console.log(`[DEBUG] Fetching planes from: ${planesUrl}`);
        
        const response = await fetch(`/api/${planesUrl}`);
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const planesData = await response.json();
        
        // Check if the response has the expected format
        if (!planesData.defaultPlanes) {
          // If response is just an array, convert to expected format
          if (Array.isArray(planesData)) {
            // Identify standard planes vs custom planes
            const standardPlaneIds = ["JHD", "JFC", "JGF"];
            const defaultPlanes = planesData.filter(p => standardPlaneIds.includes(p.id) || p.type === 'STANDARD');
            const customPlanes = planesData.filter(p => !standardPlaneIds.includes(p.id) && p.type === 'CUSTOM');
            
            this.planes = {
              defaultPlanes,
              customPlanes
            };
          } else {
            throw new Error('Unexpected response format from planes API');
          }
        } else {
          // Use the response as is
          this.planes = planesData;
        }
        
        console.log(`[DEBUG] Received planes data: ${JSON.stringify(this.planes)}`);
        
        // Update UI
        this.renderItems();
        
        // Auto-select first default plane if available
        if (this.planes.defaultPlanes && this.planes.defaultPlanes.length > 0) {
          this.selectItem(this.planes.defaultPlanes[0]);
        }
        
        return this.planes;
      } catch (error) {
        console.error(`[DEBUG] Error fetching planes: ${error.message}`);
        logError(`Failed to fetch planes: ${error.message}`);
        
        // Return empty arrays as fallback
        this.planes = {
          defaultPlanes: [],
          customPlanes: []
        };
        this.renderItems();
        return this.planes;
      }
    } catch (error) {
      console.error(`[DEBUG] Failed to load planes: ${error.message}`);
      logError(`Failed to load planes: ${error.message}`);
      
      // Return empty arrays on error
      return { defaultPlanes: [], customPlanes: [] };
    } finally {
      this.isLoading = false;
      this.updateUI();
    }
  }

  /**
   * Retry loading planes with the last used parameters
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
    this.planes = {
      defaultPlanes: [],
      customPlanes: []
    };
    this.selectedItem = null;
    
    // Make sure we have a select button before accessing it
    if (this.selectButton) {
      const textElem = this.selectButton.querySelector('.selector-text');
      if (textElem) {
        textElem.textContent = 'Select Plane';
      }
    }
    
    this.renderItems();
  }
}

// Create singleton instance
const planeSelector = new PlaneSelector();
console.log('[DEBUG] planeSelector singleton instance created');

// Add global access for debugging
window.planeSelector = planeSelector;
console.log('[DEBUG] planeSelector exposed as window.planeSelector for debugging');

// Add some CSS for the plane selector
const style = document.createElement('style');
style.textContent = `
  .plane-section-header {
    font-weight: bold;
    background-color: #f5f5f5;
    padding: 5px 8px;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .plane-items-container {
    padding: 0;
    margin: 0;
  }
  
  .selector-item {
    padding: 6px 12px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .selector-item:hover {
    background-color: #f0f0f0;
  }
`;
document.head.appendChild(style);

export default planeSelector;