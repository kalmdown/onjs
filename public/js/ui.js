import { fetchDocuments, getDocumentById } from './api.js';
import { logInfo } from './utils/logging.js';
import { runExample1 } from './examples/cylinder.js';
import { runExample2 } from './examples/lamp.js';
import { convertSvg } from './svg-converter.js';
import { authenticate } from './auth.js';

// Application state
let selectedDocument = null;
let currentSvg = null;

// DOM elements
let btnAuthenticate, authStatus, svgFile, svgPreview, 
    documentSelect, documentName, btnRefreshDocuments,
    btnExample1, btnExample2, btnConvertSvg, logOutput;

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
  btnConvertSvg = document.getElementById('btnConvertSvg');
  logOutput = document.getElementById('logOutput');
}

export function registerEventHandlers() {
  // Set up event listeners
  btnAuthenticate.addEventListener('click', authenticate);
  btnRefreshDocuments.addEventListener('click', fetchDocuments);
  documentSelect.addEventListener('change', onDocumentSelectChange);
  btnExample1.addEventListener('click', runExample1);
  btnExample2.addEventListener('click', runExample2);
  btnConvertSvg.addEventListener('click', convertSvg);
  svgFile.addEventListener('change', onSvgFileChange);
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
  } else {
    selectedDocument = null;
    documentName.disabled = false;
    logInfo('Creating a new document');
  }
  
  updateConvertButton();
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
  btnConvertSvg.disabled = !getAuthToken() || !currentSvg;
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

// Import from other modules
import { getAuthToken } from './auth.js';