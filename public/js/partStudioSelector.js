/**
 * Part studio selector component for selecting a part studio in a document
 */

import { Selector } from './utils/selector.js';
import { logInfo, logError, logDebug, logWarn } from './utils/logging.js';
import { fetchElementsForDocument } from './api.js';

// Add immediate self-executing code to verify the script is loading and running
(function() {
  console.log('[DEBUG] partStudioSelector.js module immediate execution');
  
  // Add direct DOM verification
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM loaded, checking for part studio container');
    const container = document.getElementById('partStudioContainer');
    console.log('[DEBUG] partStudioContainer exists:', !!container);
  });
})();

export class PartStudioSelector extends Selector {
  constructor() {
    super({
      containerId: 'partStudioContainer',
      label: 'Select Part Studio'
    });
    
    this.documentId = null;
    this.isLoading = false;
    
    // Add construction logging
    console.log('[DEBUG] PartStudioSelector constructor called');
    console.log('[DEBUG] PartStudioSelector containerId:', this.containerId);
    
    // Add method call tracking
    this._addMethodCallTracker();
  }
  
  /**
   * Add method call tracking for debugging
   * @private
   */
  _addMethodCallTracker() {
    // Get all method names that aren't private
    const methodNames = Object.getOwnPropertyNames(PartStudioSelector.prototype)
      .filter(name => typeof this[name] === 'function' && !name.startsWith('_'));
      
    // Wrap each method with logging
    methodNames.forEach(methodName => {
      const originalMethod = this[methodName];
      this[methodName] = function(...args) {
        console.log(`[DEBUG] PartStudioSelector.${methodName} called with args:`, 
          args.map(arg => typeof arg === 'object' ? '[object]' : arg).join(', '));
        return originalMethod.apply(this, args);
      };
    });
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
          loadingElem.textContent = 'Loading part studios...';
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
   * Load part studios for a document with improved error handling
   * 
   * @param {string} documentId The document ID
   * @returns {Promise<Array>} The loaded part studios
   */
  async loadPartStudios(documentId) {
    // Direct console logs for debugging
    console.log(`[DEBUG] loadPartStudios called with documentId: ${documentId}`);
    
    if (!documentId) {
      logError('Document ID is required to load part studios');
      console.error('Document ID is required to load part studios');
      return [];
    }
    
    try {
      this.isLoading = true;
      this.updateUI(); // Now this should work
      
      // Store parameter for potential retry
      this.documentId = documentId;
      
      // Verify the API call function exists and is callable
      if (typeof fetchElementsForDocument !== 'function') {
        console.error('[DEBUG] fetchElementsForDocument is not a function!');
        throw new Error('API function not available');
      }
      
      console.log(`[DEBUG] About to call fetchElementsForDocument with ${documentId}`);
      
      // Load elements from the API with more robust error handling
      let elements;
      try {
        elements = await fetchElementsForDocument(documentId);
        console.log(`[DEBUG] API returned ${elements ? elements.length : 0} elements`);
        
        // Dump first few elements for inspection
        if (elements && elements.length > 0) {
          console.log(`[DEBUG] First element:`, JSON.stringify(elements[0]).substring(0, 500));
        }
      } catch (apiError) {
        console.error(`[DEBUG] API call failed:`, apiError);
        throw apiError;
      }
      
      // Check if elements is empty or undefined
      if (!elements || elements.length === 0) {
        console.warn(`[DEBUG] No elements returned for document ${documentId}`);
        this.setItems([]);
        return [];
      }
      
      // Count types of elements for debugging
      const typeCounter = {};
      elements.forEach(elem => {
        if (!elem) return;
        
        // Log all possible type properties
        const type = (elem.elementType || elem.type || elem.nodeType || 'unknown').toString();
        typeCounter[type] = (typeCounter[type] || 0) + 1;
      });
      console.log(`[DEBUG] Element types found:`, typeCounter);
      
      // Filter for part studios with even more permissive matching
      const partStudios = elements.filter(element => {
        if (!element) return false;
        
        // Check if any property might indicate this is a part studio
        for (const key in element) {
          const value = element[key];
          if (value && typeof value === 'string' && 
              value.toString().toUpperCase().includes('PARTSTUDIO')) {
            console.log(`[DEBUG] Found part studio by property ${key}:`, element);
            return true;
          }
        }
        
        // Check specific fields we expect
        const elementType = element.elementType || element.type;
        if (elementType) {
          const typeStr = elementType.toString().toUpperCase();
          if (typeStr.includes('PARTSTUDIO') || typeStr === 'PS') {
            console.log(`[DEBUG] Found part studio by type:`, element);
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`[DEBUG] Found ${partStudios.length} part studios after filtering`);
      
      if (partStudios.length) {
        // Transform data for selector
        const items = partStudios.map(ps => {
          const name = ps.name || ps.elementName || ps.elementId || ps.id || 'Unnamed Part Studio';
          console.log(`[DEBUG] Processing part studio: ${name} (${ps.id})`);
          
          return {
            id: ps.id,
            name: name,
            elementId: ps.id,
            documentId: documentId
          };
        });
        
        console.log(`[DEBUG] Setting ${items.length} items in selector`);
        
        // Set items in the UI
        this.setItems(items);
        
        // Select the first item if available
        if (items.length > 0) {
          console.log(`[DEBUG] Auto-selecting first part studio: ${items[0].name}`);
          this.selectItem(items[0]);
        }
        
        return items;
      } else {
        console.warn(`[DEBUG] No part studios found in document ${documentId}`);
        this.setItems([]);
        return [];
      }
    } catch (error) {
      console.error(`[DEBUG] loadPartStudios error:`, error);
      
      // Reset items
      this.setItems([]);
      return [];
    } finally {
      this.isLoading = false;
      this.updateUI(); // Now this should work
      console.log(`[DEBUG] loadPartStudios finished, isLoading set to ${this.isLoading}`);
    }
  }
  
  /**
   * Reset the selector to initial state
   */
  reset() {
    this.documentId = null;
    this.selectedItem = null;
    
    // Make sure we have a select button before accessing it
    if (this.selectButton) {
      const textElem = this.selectButton.querySelector('.selector-text');
      if (textElem) {
        textElem.textContent = 'Select Part Studio';
      }
    }
    
    this.setItems([]);
  }
}

// Create singleton instance
const partStudioSelector = new PartStudioSelector();
console.log('[DEBUG] partStudioSelector singleton instance created');

// Add global access for debugging
window.partStudioSelector = partStudioSelector;
console.log('[DEBUG] partStudioSelector exposed as window.partStudioSelector for debugging');

// Force exposure to window for debugging
window.__debugModules = window.__debugModules || {};
window.__debugModules.partStudioSelector = {
  module: 'loaded',
  instance: partStudioSelector,
  constructor: PartStudioSelector
};

export default partStudioSelector;