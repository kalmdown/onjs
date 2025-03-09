import registry from './registry.js';
import appState from './state.js';  // Change from './appClient.js' to './state.js'
import appConfig from './appConfig.js';
import { debugLog } from './utils/debug.js';

let instance = null;

export class PlaneSelector {
    constructor(config = {}) {
        if (instance) {
            debugLog('planeSelector', 'Instance already exists');
            return instance;
        }
        
        this.config = {
            containerId: 'plane-selector',
            hiddenInputId: 'planeId',
            defaultText: 'Select a plane',
            ...config
        };

        this.planeChangeCallbacks = new Set();
        this.initialized = false;
        this.selectedPlane = null;
        
        // Initialize debugging properties with safe access
        this._debug = appConfig.debug?.components?.planeSelector || false;
        this.useGroupedDisplay = appConfig.features?.groupedPlanes || false;
        
        instance = this;
        this.init(); // Call init immediately
        return instance;
    }

    init() {
        if (this.initialized) return;
        
        try {
            // Get or create required elements
            this.container = document.getElementById(this.config.containerId);
            this.hiddenInput = document.getElementById(this.config.hiddenInputId);

            if (!this.container) {
                throw new Error(`Container not found: ${this.config.containerId}`);
            }

            // Clear existing content
            this.container.innerHTML = '';

            // Create dropdown button with proper styling
            this.button = document.createElement('button');
            this.button.className = 'plane-selector-button';
            this.button.innerHTML = `
                <span class="plane-button-text">${this.config.defaultText}</span>
                <span class="plane-button-icon">▼</span>
            `;

            // Create dropdown content with proper styling
            this.dropdownContent = document.createElement('div');
            this.dropdownContent.className = 'plane-dropdown-content';

            // Add container styling
            this.container.className = 'plane-selector';

            // Add to container
            this.container.appendChild(this.button);
            this.container.appendChild(this.dropdownContent);

            // Set up event listeners
            this._initEventListeners();
            this._initKeyboardNavigation();
            
            this.initialized = true;
            debugLog('planeSelector', 'UI initialized successfully');
        } catch (error) {
            debugLog('error', 'Failed to initialize plane selector UI:', error);
            throw error;
        }
    }

    async loadPlanes(params) {
        try {
            const appClient = registry.getComponent('appClient');
            if (!appClient) {
                throw new Error('AppClient not available');
            }

            const planes = await appClient.getPlanes(params);
            this.renderPlanes(planes);
        } catch (error) {
            console.error('Failed to load planes:', error);
            debugLog('error', 'Failed to load planes', { error });
        }
    }

    renderPlanes(planes) {
        if (!this.container || !planes) return;

        // Group planes by studio if feature flag is enabled
        if (this.useGroupedDisplay) {
            const groups = this._groupPlanesByStudio(planes);
            this._renderGroupedPlanes(groups);
        } else {
            this._renderFlatPlanes(planes);
        }
    }

    _groupPlanesByStudio(planes) {
        const groups = new Map();
        
        planes.forEach(plane => {
            const studioName = plane.partStudioName || 'Default Studio';
            if (!groups.has(studioName)) {
                groups.set(studioName, {
                    studioName,
                    planes: []
                });
            }
            groups.get(studioName).planes.push(plane);
        });

        // Convert to array and sort by studio name
        return Array.from(groups.values())
            .sort((a, b) => a.studioName.localeCompare(b.studioName));
    }

    _handlePlaneSelected(plane) {
        this.selectedPlane = plane;
        
        // Update button text with proper styling
        const buttonText = this.button.querySelector('.plane-button-text');
        if (buttonText) {
            buttonText.textContent = plane.name;
        }
        
        if (this.hiddenInput) {
            this.hiddenInput.value = plane.id;
        }
        
        this._closeDropdown();
        
        // Notify callbacks
        this.planeChangeCallbacks.forEach(callback => callback(plane));
        debugLog('planeSelector', `Selected plane: ${plane.name}`);
    }

    _initEventListeners() {
        // Button click handler
        this.button.addEventListener('click', (event) => {
            event.stopPropagation();
            this._toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (this.dropdownContent && !this.container.contains(event.target)) {
                this._closeDropdown();
            }
        });
    }

    _initKeyboardNavigation() {
        this.container.addEventListener('keydown', (event) => {
            if (!this.dropdownContent.classList.contains('show')) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this._toggleDropdown();
                }
                return;
            }

            const items = Array.from(this.dropdownContent.querySelectorAll('.plane-item'));
            const currentIndex = items.findIndex(item => item === document.activeElement);

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    if (currentIndex < items.length - 1) {
                        items[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (currentIndex > 0) {
                        items[currentIndex - 1].focus();
                    }
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (document.activeElement.classList.contains('plane-item')) {
                        document.activeElement.click();
                    }
                    break;
                case 'Escape':
                    this._closeDropdown();
                    break;
            }
        });
    }

    _renderGroupedPlanes(groups) {
        if (!groups || !groups.length) {
            this.dropdownContent.innerHTML = '<div class="plane-empty">No planes available</div>';
            return;
        }
        
        // Clear existing content
        this.dropdownContent.innerHTML = '';
        
        // Create container for groups with proper styling
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'plane-groups dropdown-menu'; // Added dropdown-menu class
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'plane-group dropdown-group'; // Added dropdown-group class
            
            // Create group header with proper styling
            const header = document.createElement('div');
            header.className = 'plane-group-header dropdown-header'; // Added dropdown-header class
            header.textContent = group.studioName;
            groupElement.appendChild(header);
            
            // Create planes list with proper styling
            const planesList = document.createElement('div');
            planesList.className = 'plane-group-planes dropdown-items'; // Added dropdown-items class
            
            group.planes.forEach(plane => {
                const planeElement = document.createElement('div');
                planeElement.className = 'plane-item dropdown-item'; // Added dropdown-item class
                
                // Only add the plane name (no studio label since it's in the group header)
                const displayName = document.createElement('span');
                displayName.className = 'plane-name item-label'; // Added item-label class
                displayName.textContent = plane.name;
                planeElement.appendChild(displayName);
                
                // Set data attributes and type-specific classes
                planeElement.dataset.planeId = plane.id;
                planeElement.dataset.studioName = group.studioName;
                
                if (plane.type === 'default') {
                    planeElement.classList.add('plane-default', 'default-item');
                } else {
                    planeElement.classList.add('plane-custom', 'custom-item');
                }
                
                planeElement.addEventListener('click', () => this._handlePlaneSelected(plane));
                planesList.appendChild(planeElement);
            });
            
            groupElement.appendChild(planesList);
            groupsContainer.appendChild(groupElement);
        });
        
        this.dropdownContent.appendChild(groupsContainer);
        
        // Ensure dropdown has proper base styling
        this.dropdownContent.classList.add('dropdown-content', 'plane-dropdown-content');
        this.button.classList.add('dropdown-toggle', 'plane-dropdown-btn');

        // Add tabindex and role for keyboard navigation
        this.dropdownContent.querySelectorAll('.plane-item').forEach(item => {
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'option');
        });
    }

    _renderFlatPlanes(planes) {
        if (!planes || !planes.length) {
            this.dropdownContent.innerHTML = '<div class="plane-item plane-empty">No planes available</div>';
            return;
        }
        
        this.dropdownContent.innerHTML = '';
        const planesList = document.createElement('div');
        planesList.className = 'plane-list';
        
        planes.forEach(plane => {
            const item = document.createElement('div');
            item.className = 'plane-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'plane-name';
            nameSpan.textContent = plane.name;
            item.appendChild(nameSpan);
            
            if (plane.partStudioName) {
                const studioSpan = document.createElement('span');
                studioSpan.className = 'plane-studio-label';
                studioSpan.textContent = plane.partStudioName;
                item.appendChild(studioSpan);
            }
            
            // Add plane type class
            if (plane.type === 'default') {
                item.classList.add('plane-default');
            } else {
                item.classList.add('plane-custom');
            }
            
            item.addEventListener('click', () => this._handlePlaneSelected(plane));
            planesList.appendChild(item);
        });
        
        this.dropdownContent.appendChild(planesList);
    }

    _toggleDropdown() {
        if (this.dropdownContent) {
            const isExpanded = this.dropdownContent.classList.toggle('show');
            this.button.setAttribute('aria-expanded', isExpanded.toString());
            debugLog('planeSelector', `Dropdown ${isExpanded ? 'opened' : 'closed'}`);
        }
    }

    _closeDropdown() {
        this.dropdownContent.classList.remove('show');
        this.button.setAttribute('aria-expanded', 'false');
        debugLog('PlaneSelector', 'Dropdown closed');
    }

    _findPlaneById(id) {
        const allItems = this.dropdownContent.querySelectorAll('.plane-item');
        for (const item of allItems) {
            if (item.dataset.planeId === id) {
                return {
                    id,
                    name: item.querySelector('.plane-name').textContent,
                    partStudioName: item.dataset.studioName || 
                                  item.querySelector('.plane-studio-label')?.textContent || 
                                  'Default Studio'
                };
            }
        }
        return null;
    }

    updatePlanes(planes) {
        if (!this.initialized || !this.dropdownContent) {
            debugLog('error', 'Cannot update planes: component not initialized');
            return;
        }

        try {
            this.dropdownContent.innerHTML = '';
            
            // Group planes by part studio
            const planesByStudio = planes.reduce((groups, plane) => {
                const studioName = plane.partStudioName || 'Default Studio';
                if (!groups[studioName]) {
                    groups[studioName] = [];
                }
                groups[studioName].push(plane);
                return groups;
            }, {});

            // Create groups
            Object.entries(planesByStudio).forEach(([studioName, studioPlanes]) => {
                const group = document.createElement('div');
                group.className = 'plane-group';

                // Add group header
                const header = document.createElement('div');
                header.className = 'plane-group-header';
                header.textContent = studioName;
                group.appendChild(header);

                // Add planes
                studioPlanes.forEach(plane => {
                    const item = document.createElement('div');
                    item.className = 'plane-item';
                    item.setAttribute('tabindex', '0');
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'plane-name';
                    nameSpan.textContent = plane.name;
                    item.appendChild(nameSpan);
                    
                    item.dataset.planeId = plane.id;
                    item.dataset.studioName = plane.partStudioName || 'Default Studio';
                    
                    if (plane.type === 'default') {
                        item.classList.add('plane-default');
                    }
                    
                    item.addEventListener('click', () => {
                        this._selectPlane(plane);
                        this._closeDropdown();
                    });
                    
                    group.appendChild(item);
                });

                this.dropdownContent.appendChild(group);
            });

            debugLog('planeSelector', `Updated with ${planes.length} planes`);
        } catch (error) {
            debugLog('error', 'Failed to update planes:', error);
        }
    }

    _selectPlane(plane) {
        this.selectedPlane = plane;
        if (this.button) {
            const buttonText = this.button.querySelector('.plane-button-text');
            if (buttonText) {
                const displayText = plane.partStudioName ? 
                    `${plane.partStudioName} - ${plane.name}` : 
                    plane.name;
                buttonText.textContent = displayText;
            }
            if (this.hiddenInput) {
                this.hiddenInput.value = plane.id;
            }
            this.planeChangeCallbacks.forEach(callback => callback(plane));
            debugLog('planeSelector', `Selected plane: ${plane.name}`);
        }
    }

    /**
     * Get the currently selected plane
     * @returns {Object|null} Selected plane object or null
     */
    getSelectedPlane() {
        try {
            const select = document.getElementById('plane-selector');
            if (!select) {
                debugLog('error', 'Plane selector element not found');
                return null;
            }
            
            const planeId = select.value;
            if (!planeId) {
                debugLog('warning', 'No plane selected');
                return null;
            }
            
            const selectedPlane = this.planes.find(plane => plane.id === planeId);
            if (!selectedPlane) {
                debugLog('warning', `Selected plane ${planeId} not found in available planes`);
                return null;
            }
            
            debugLog('planeSelector', 'Selected plane', selectedPlane);
            return selectedPlane;
        } catch (error) {
            debugLog('error', 'Error getting selected plane', error);
            return null;
        }
    }

    hasPlaneSelected() {
        const hasPlane = !!this.selectedPlane;
        debugLog('planeSelector', 'Checking plane selection:', {
            hasPlane,
            selectedPlane: this.selectedPlane
        });
        return hasPlane;
    }

    selectPlane(planeId) {
        this.selectedPlane = planeId;
        const selectedPlane = this.dropdownContent.querySelector(`[data-plane-id="${planeId}"]`);
        
        if (selectedPlane) {
            this.button.querySelector('.plane-button-text').textContent = selectedPlane.textContent;
        }
        
        this.closeDropdown();
        
        // Notify callbacks
        this.planeChangeCallbacks.forEach(callback => {
            try {
                callback(planeId);
            } catch (error) {
                debugLog('error', 'Error in plane change callback:', error);
            }
        });
        
        // Update app state
        appState.setPlane(planeId);
        
        debugLog('planeSelector', 'Plane selected:', { 
            planeId,
            callbackCount: this.planeChangeCallbacks.size 
        });
    }

    onPlaneSelect(callback) {
        if (typeof callback === 'function') {
            this.planeChangeCallbacks.add(callback);
        }
    }
}

// Create singleton instance
const planeSelector = new PlaneSelector();

// Register with component registry
try {
    const registered = registry.register('planeSelector', planeSelector);
    debugLog('planeSelector', `Registration ${registered ? 'successful' : 'failed'}`);
} catch (error) {
    debugLog('error', 'Failed to register PlaneSelector:', error);
}

export default planeSelector;
