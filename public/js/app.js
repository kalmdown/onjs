/**
 * SVG to Onshape Converter - Client-side application
 * Main entry point
 */

// Import modules
import { initAuth } from './auth.js';
import { fetchDocuments } from './api.js';
import { setupUI, registerEventHandlers } from './ui.js';
import { initLogger, logInfo } from './utils/logging.js';
// Import selectors - these need to be loaded even if not used directly
import './partStudioSelector.js';
import './planeSelector.js';

// Define a function to initialize the application with dependencies
async function initializeApp(dependencies) {
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
    dependencies.fetchDocuments(dependencies.logInfo); // Pass logInfo to fetchDocuments
  }
}

// Create a dependencies object
const dependencies = {
  initAuth: initAuth,
  fetchDocuments: fetchDocuments,
  setupUI: setupUI,
  registerEventHandlers: registerEventHandlers,
  initLogger: initLogger,
  logInfo: logInfo // Add logInfo to dependencies
};

// Initialize the application with dependencies
document.addEventListener('DOMContentLoaded', () => {
  initializeApp(dependencies);
});