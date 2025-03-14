import { fetchDocuments, getDocumentById } from './api.js';
import { logInfo, logError } from './utils/logging.js';
import { runExample1 } from './examples/cylinder.js';
import { runExample2 } from './examples/lamp.js';
import { runExample3 } from './examples/cup.js';
import { convertSvg } from './svg-converter.js';
import { authenticate, getToken } from './clientAuth.js';
import { exportApiCalls } from './api.js'; // Import the exportApiCalls function
import partStudioSelector from './partStudioSelector.js';
import planeSelector from './planeSelector.js';

// Application state
let selectedDocument = null;
let currentSvg = null;

// DOM elements
let btnAuthenticate, authStatus, svgFile, svgPreview, 
    documentSelect, documentName, btnRefreshDocuments,
    btnExample1, btnExample2, btnExample3, btnConvertSvg, logOutput, btnExportApiCalls;

export function setupUI() {
  // Initialize DOM elements
  btnAuthenticate = document.getElementById('btnAuthenticate');
  authStatus = document.getElementById('authStatus');
  svgFile = document.getElementById('svgFile');
  svgPreview = document.getElementById('svgPreview');
  documentSelect = document.getElementById('documentSelect');
  documentName = document.getElementById('documentName');
  btnRefreshDocuments = document.getElementById('btnRefreshDocuments');
  btnExample1 = document.getElementById('btnExample1');
  btnExample2 = document.getElementById('btnExample2');
  btnExample3 = document.getElementById('btnExample3');
  btnConvertSvg = document.getElementById('btnConvertSvg');
  logOutput = document.getElementById('logOutput');
  btnExportApiCalls = document.getElementById('btnExportApiCalls'); // Initialize btnExportApiCalls
}

export function registerEventHandlers() {
  // Set up event listeners
  btnAuthenticate.addEventListener('click', authenticate);
  btnRefreshDocuments.addEventListener('click', fetchDocuments);
  documentSelect.addEventListener('change', onDocumentSelectChange);
  btnExample1.addEventListener('click', runExample1);
  btnExample2.addEventListener('click', runExample2);
  btnExample3.addEventListener('click', runExample3);
  btnConvertSvg.addEventListener('click', convertSvg);
  svgFile.addEventListener('change', onSvgFileChange);
  btnExportApiCalls.addEventListener('click', exportApiCalls); // Add event listener for btnExportApiCalls
  
  // Register studio and plane change handlers
  partStudioSelector.onSelect(onPartStudioSelect);
}

/**
 * Handle document selection change
 */
function onDocumentSelectChange() {
  const selectedId = documentSelect.value;
  
  if (selectedId) {
    selectedDocument = getDocumentById(selectedId);
    documentName.value = '';
    documentName.disabled = true;
    logInfo(`Selected document: ${selectedDocument.name}`);
    
    // Load part studios for this document
    partStudioSelector.loadPartStudios(selectedId);
  } else {
    selectedDocument = null;
    documentName.disabled = false;
    // Reset selectors
    partStudioSelector.reset();
    planeSelector.reset();
    logInfo('Creating a new document');
  }
  
  updateConvertButton();
}

/**
 * Handle part studio selection change
 */
function onPartStudioSelect(partStudio) {
  if (partStudio && partStudio.id) {
    logInfo(`Selected part studio: ${partStudio.name}`);
    
    // Load planes for this part studio
    planeSelector.loadPlanes(partStudio.documentId, partStudio.id);
  }
}

/**
 * Handle SVG file selection
 */
function onSvgFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    svgPreview.innerHTML = '<p class="text-muted">SVG preview will appear here</p>';
    currentSvg = null;
    updateConvertButton();
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const svgContent = e.target.result;
    svgPreview.innerHTML = svgContent;
    currentSvg = svgContent;
    logInfo(`SVG file loaded: ${file.name}`);
    updateConvertButton();
  };
  reader.readAsText(file);
}

/**
 * Update the state of the Convert button
 */
function updateConvertButton() {
  btnConvertSvg.disabled = !getToken() || !currentSvg;
}

/**
 * Get the currently selected document
 */
export function getSelectedDocument() {
  return selectedDocument;
}

/**
 * Get the document name input value
 */
export function getDocumentName() {
  return documentName.value;
}

/**
 * Get the current SVG content
 */
export function getCurrentSvg() {
  return currentSvg;
}

/**
 * Get the selected part studio
 */
export function getSelectedPartStudio() {
  return partStudioSelector.getSelectedItem();
}

/**
 * Get the selected sketch plane
 */
export function getSelectedPlane() {
  return planeSelector.getSelectedItem();
}