/**
 * Centralized State Management for Barcode Tool
 * 
 * This module provides a single source of truth for all application state,
 * replacing scattered global variables across the codebase.
 */

// Create the centralized application state object
export const appState = {
  // Generator state
  generator: {
    selectedLogo: null,
    inputValues: {},
  },

  // Scanner state
  scanner: {
    isScanning: false,
    scanningTimeout: null,
    codeReader: null,
    drawingInterval: null,
    scanHistory: [],
    resetInProgress: false,
    selectedDeviceId: null,
  },

  // Storage state
  storage: {
    storageKey: 'barcode-tool-saved-data',
  },

  // UI state
  ui: {
    currentTab: 'generator',
    errorMessage: null,
    notifications: [],
  },
};

/**
 * State management utilities
 */
export const stateManager = {
  /**
   * Get a value from the state by path (e.g., 'scanner.isScanning')
   * @param {string} path - Dot-separated path to the state value
   * @returns {any} The state value
   */
  get(path) {
    const keys = path.split('.');
    let current = appState;
    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  },

  /**
   * Set a value in the state by path
   * @param {string} path - Dot-separated path to the state value
   * @param {any} value - The value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = appState;
    
    for (const key of keys) {
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  },

  /**
   * Update scanner history by adding a new scan
   * @param {object} scanData - The scan data to add
   */
  addToScanHistory(scanData) {
    const history = this.get('scanner.scanHistory');
    history.unshift(scanData);
    
    // Keep only the last 10 scans
    if (history.length > 10) {
      history.splice(10);
    }
  },

  /**
   * Clear all scanner history
   */
  clearScanHistory() {
    this.set('scanner.scanHistory', []);
  },

  /**
   * Reset scanner state
   */
  resetScannerState() {
    this.set('scanner.isScanning', false);
    this.set('scanner.scanningTimeout', null);
    this.set('scanner.codeReader', null);
    this.set('scanner.drawingInterval', null);
    this.set('scanner.resetInProgress', false);
  },

  /**
   * Reset generator state
   */
  resetGeneratorState() {
    this.set('generator.selectedLogo', null);
    this.set('generator.inputValues', {});
  },

  /**
   * Set the current active tab
   * @param {string} tabId - The tab ID ('generator', 'scanner', 'savedData')
   */
  setCurrentTab(tabId) {
    this.set('ui.currentTab', tabId);
  },

  /**
   * Add a notification to the queue
   * @param {string} message - The notification message
   * @param {string} type - The notification type ('success', 'error', 'info')
   */
  addNotification(message, type = 'info') {
    const notifications = this.get('ui.notifications');
    notifications.push({
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Remove a notification by ID
   * @param {number} id - The notification ID
   */
  removeNotification(id) {
    const notifications = this.get('ui.notifications');
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications.splice(index, 1);
    }
  },

  /**
   * Clear all notifications
   */
  clearNotifications() {
    this.set('ui.notifications', []);
  },
};

// Make state accessible globally for debugging (development only)
if (typeof window !== 'undefined') {
  window.appState = appState;
  window.stateManager = stateManager;
}