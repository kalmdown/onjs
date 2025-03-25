// public/js/app.js
/**
 * SVG to Onshape Converter - Client-side application
 * Main entry point
 */

// Import modules
import { initAuth } from './clientAuth.js';
import { fetchDocuments } from './api.js';
import { setupUI, registerEventHandlers } from './ui.js';
import { initLogger, logInfo, logError } from './utils/logging.js';
import './partStudioSelector.js';
import './planeSelector.js';

// Define a function to initialize the application with dependencies
async function initializeApp(dependencies) {
  try {
    // Initialize logging
    dependencies.initLogger();
    
    // Set up UI elements
    dependencies.setupUI();
    
    // Register event handlers
    dependencies.registerEventHandlers();
    
    // Initialize authentication
    const isAuthenticated = await dependencies.initAuth();
    
    // If authenticated, fetch documents
    if (isAuthenticated) {
      dependencies.logInfo('Authentication successful, fetching documents...', "Documents");
      await dependencies.fetchDocuments();
    } else {
      dependencies.logInfo('Not authenticated. Please click "Authenticate with Onshape" to begin.');
    }
  } catch (error) {
    dependencies.logError(`Error initializing application: ${error.message}`);
    console.error('Initialization error:', error);
  }
}

// Create a dependencies object
const dependencies = {
  initAuth: initAuth,
  fetchDocuments: fetchDocuments,
  setupUI: setupUI,
  registerEventHandlers: registerEventHandlers,
  initLogger: initLogger,
  logInfo: logInfo,
  logError: logError
};

// Initialize the application with dependencies
document.addEventListener('DOMContentLoaded', () => {
  initializeApp(dependencies)
    .catch(error => {
      console.error('Application initialization error:', error);
      // Show a friendly error message to the user
      const logOutput = document.getElementById('logOutput');
      if (logOutput) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'log-error';
        errorDiv.textContent = `Application error: ${error.message}`;
        logOutput.appendChild(errorDiv);
      }
    });
});