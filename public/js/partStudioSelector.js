/**
 * Part studio selector component for selecting a part studio in a document
 */

import { Selector } from './utils/selector.js';
import { logInfo, logError } from './utils/logging.js';
import { fetchElementsForDocument } from './api.js';

export class PartStudioSelector extends Selector {
  constructor() {
    super({
      containerId: 'partStudioContainer',
      label: 'Select Part Studio'
    });
    
    this.documentId = null;
  }
  
  /**
   * Load part studios for a document
   * 
   * @param {string} documentId The document ID
   */
  async loadPartStudios(documentId) {
    if (!documentId) {
      logError('No document ID provided for loading part studios');
      return;
    }
    
    try {
      this.documentId = documentId;
      logInfo(`Loading part studios for document ${documentId}`);
      
      const response = await fetchElementsForDocument(documentId);
      
      // Handle both array format and object with elements property
      const elements = response.elements || response;
      
      // Filter for part studios, handling slightly different API formats
      const partStudios = elements.filter(element => 
        element.elementType === 'PARTSTUDIO' || element.type === 'PARTSTUDIO'
      );
      
      logInfo(`Found ${partStudios.length} part studios`);
      
      // Transform data for selector
      const items = partStudios.map(ps => ({
        id: ps.id,
        name: ps.name || ps.elementName || ps.elementId || 'Unnamed Part Studio',
        elementId: ps.id,
        documentId: documentId
      }));
      
      this.setItems(items);
      
      if (items.length > 0) {
        this.selectItem(items[0]);
      }
    } catch (error) {
      logError(`Failed to load part studios: ${error.message}`);
      this.setItems([]);
    }
  }
  
  /**
   * Reset the selector to initial state
   */
  reset() {
    this.documentId = null;
    this.selectedItem = null;
    this.selectButton.querySelector('.selector-text').textContent = 'Select Part Studio';
    this.setItems([]);
  }
}

// Create singleton instance
const partStudioSelector = new PartStudioSelector();
export default partStudioSelector;