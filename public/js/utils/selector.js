/**
 * Utility component for UI selectors in the application
 */

/**
 * Base class for dropdown selectors
 */
export class Selector {
  constructor(options = {}) {
    this.container = document.getElementById(options.containerId);
    this.label = options.label || 'Select';
    this.items = [];
    this.selectedItem = null;
    this.callbacks = new Set();
    
    if (!this.container) {
      console.error(`Container not found: ${options.containerId}`);
      return;
    }
    
    this._createUI();
  }
  
  _createUI() {
    // Create base UI structure
    this.container.innerHTML = '';
    this.container.className = 'selector-container';
    
    // Create dropdown elements
    this.selectButton = document.createElement('button');
    this.selectButton.className = 'selector-button form-select';
    this.selectButton.innerHTML = `<span class="selector-text">${this.label}</span>`;
    
    this.dropdownContent = document.createElement('div');
    this.dropdownContent.className = 'selector-dropdown';
    
    // Add to container
    this.container.appendChild(this.selectButton);
    this.container.appendChild(this.dropdownContent);
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  _setupEventListeners() {
    // Toggle dropdown on button click
    this.selectButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }
  
  toggleDropdown() {
    this.dropdownContent.classList.toggle('show');
  }
  
  closeDropdown() {
    this.dropdownContent.classList.remove('show');
  }
  
  setItems(items) {
    this.items = items;
    this.renderItems();
  }
  
  renderItems() {
    this.dropdownContent.innerHTML = '';
    
    if (!this.items || this.items.length === 0) {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'selector-empty';
      emptyElement.textContent = 'No items available';
      this.dropdownContent.appendChild(emptyElement);
      return;
    }
    
    this.items.forEach(item => {
      const element = document.createElement('div');
      element.className = 'selector-item';
      element.textContent = item.name;
      element.dataset.id = item.id;
      
      element.addEventListener('click', () => {
        this.selectItem(item);
      });
      
      this.dropdownContent.appendChild(element);
    });
  }
  
  selectItem(item) {
    this.selectedItem = item;
    this.selectButton.querySelector('.selector-text').textContent = item.name;
    this.closeDropdown();
    
    // Notify listeners
    this.callbacks.forEach(callback => callback(item));
  }
  
  getSelectedItem() {
    return this.selectedItem;
  }
  
  onSelect(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
    return this;
  }
}