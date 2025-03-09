let logOutput;

export function initLogger() {
  logOutput = document.getElementById('logOutput');
}

/**
 * Log messages to the output panel
 * 
 * @param {string} message Message to log
 * @param {string} type Message type (info, success, error)
 */
export function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

export function logInfo(message) {
  log(message, 'info');
}

export function logSuccess(message) {
  log(message, 'success');
}

export function logError(message) {
  log(message, 'error');
}

/**
 * Log debug message to console
 * @param {string} message The message to log
 * @param {any} [data] Optional data to include
 */
export function logDebug(message, data) {
  if (data !== undefined) {
    console.debug(`[DEBUG] ${message}`, data);
  } else {
    console.debug(`[DEBUG] ${message}`);
  }
}