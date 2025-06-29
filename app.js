/**
 * Main Application Entry Point
 * 
 * This file orchestrates the initialization of the Barcode Tool application,
 * setting up all modules and managing the overall application lifecycle.
 */

import { BarcodeGenerator } from './modules/BarcodeGenerator.js';
import { BarcodeScanner } from './modules/BarcodeScanner.js';
import { StorageManager } from './modules/StorageManager.js';
import { stateManager } from './modules/state.js';

class BarcodeToolApp {
  constructor() {
    this.generator = null;
    this.scanner = null;
    this.storage = null;
    this.currentTab = 'generator';
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      console.log('Initializing Barcode Tool Application...');

      // Initialize state
      this.initializeState();

      // Initialize modules
      await this.initializeModules();

      // Set up global event listeners
      this.setupGlobalEventListeners();

      // Initialize PWA features
      this.initializePWA();

      // Set initial tab
      this.switchTab('generator');

      console.log('Barcode Tool Application initialized successfully');

    } catch (error) {
      console.error('Error initializing application:', error);
      this.showError('Failed to initialize application: ' + error.message);
    }
  }

  /**
   * Initialize application state
   */
  initializeState() {
    // Set default tab
    stateManager.setCurrentTab('generator');

    // Initialize scanner state
    stateManager.set('scanner.isScanning', false);
    stateManager.set('scanner.scanHistory', []);

    // Initialize generator state
    stateManager.set('generator.selectedLogo', null);
    stateManager.set('generator.inputValues', {});
  }

  /**
   * Initialize all application modules
   */
  async initializeModules() {
    // Initialize modules in dependency order
    this.storage = new StorageManager();
    this.generator = new BarcodeGenerator();
    this.scanner = new BarcodeScanner();

    // Make modules globally accessible for debugging
    if (typeof window !== 'undefined') {
      window.appModules = {
        generator: this.generator,
        scanner: this.scanner,
        storage: this.storage,
      };
    }
  }

  /**
   * Set up global event listeners
   */
  setupGlobalEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = e.target.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
        if (tabId) {
          this.switchTab(tabId);
        }
      });
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && stateManager.get('scanner.isScanning')) {
        // Stop scanning when page becomes hidden
        this.scanner.stopScan();
      }
    });

    // Handle beforeunload to clean up resources
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle errors globally
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.showError('An unexpected error occurred. Please refresh the page.');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.showError('An unexpected error occurred. Please refresh the page.');
    });
  }

  /**
   * Initialize Progressive Web App features
   */
  initializePWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Handle app install prompt
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      deferredPrompt = e;
      
      // Show install button if desired
      this.showInstallPrompt(deferredPrompt);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      deferredPrompt = null;
    });
  }

  /**
   * Show PWA install prompt
   */
  showInstallPrompt(deferredPrompt) {
    // This could be implemented to show a custom install button
    // For now, we'll just log that the app can be installed
    console.log('App can be installed as PWA');
  }

  /**
   * Switch between application tabs
   */
  switchTab(tabId) {
    try {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach((tab) => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab').forEach((tab) => {
        tab.classList.remove('active');
      });

      // Show selected tab
      const targetTab = document.getElementById(tabId);
      const targetButton = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
      
      if (targetTab) {
        targetTab.classList.add('active');
      }
      if (targetButton) {
        targetButton.classList.add('active');
      }

      // Handle tab-specific logic
      if (tabId !== 'scanner' && stateManager.get('scanner.isScanning')) {
        // Stop scanning when switching away from scanner tab
        this.scanner.stopScan();
      }

      if (tabId === 'savedData') {
        // Refresh saved data display when switching to saved data tab
        this.storage.displaySavedData();
      }

      // Update state
      stateManager.setCurrentTab(tabId);
      this.currentTab = tabId;

    } catch (error) {
      console.error('Error switching tabs:', error);
      this.showError('Error switching tabs: ' + error.message);
    }
  }

  /**
   * Show error message to user
   */
  showError(message) {
    // Import ErrorHandler dynamically to avoid circular dependency
    import('./ui.js').then(({ ErrorHandler }) => {
      ErrorHandler.showUserError(message);
    }).catch(() => {
      // Fallback error display
      console.error(message);
      const errorDisplay = document.getElementById('errorDisplay');
      if (errorDisplay) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        errorDisplay.style.backgroundColor = '#ffeeee';
        errorDisplay.style.padding = '10px';
        errorDisplay.style.marginTop = '10px';
        errorDisplay.style.border = '1px solid #ffcccc';
        errorDisplay.style.borderRadius = '4px';
        errorDisplay.style.fontWeight = 'bold';
        errorDisplay.style.color = '#cc0000';
      }
    });
  }

  /**
   * Cleanup resources before app shutdown
   */
  cleanup() {
    try {
      // Stop any active scanning
      if (stateManager.get('scanner.isScanning')) {
        this.scanner.stopScan();
      }

      // Clear any timeouts or intervals
      const scanningTimeout = stateManager.get('scanner.scanningTimeout');
      if (scanningTimeout) {
        clearTimeout(scanningTimeout);
      }

      const drawingInterval = stateManager.get('scanner.drawingInterval');
      if (drawingInterval) {
        clearInterval(drawingInterval);
      }

      console.log('Application cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      currentTab: this.currentTab,
      isScanning: stateManager.get('scanner.isScanning'),
      scanHistoryCount: stateManager.get('scanner.scanHistory')?.length || 0,
      savedDataCount: this.storage?.getSavedData()?.length || 0,
      hasLogo: !!stateManager.get('generator.selectedLogo'),
    };
  }
}

// Initialize the application when DOM is loaded
let app;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    app = new BarcodeToolApp();
    await app.init();

    // Make app globally accessible
    window.barcodeApp = app;

    // Make individual functions available for HTML event handlers
    window.switchTab = (tabId) => app.switchTab(tabId);
    window.updateBarcodeOptionsVisibility = () => app.generator?.updateBarcodeOptionsVisibility();
    window.updateForm = () => app.generator?.updateForm();
    window.handleLogoUpload = (e) => app.generator?.handleLogoUpload(e);
    window.removeLogo = () => app.generator?.removeLogo();
    window.generateBarcode = () => app.generator?.generateBarcode();
    window.saveLatestScan = () => app.storage?.saveLatestScan();
    window.saveAllScans = () => app.storage?.saveAllScans();
    window.clearSavedData = () => app.storage?.clearSavedData();
    window.displaySavedData = () => app.storage?.displaySavedData();
    window.updateSaveButtonsVisibility = () => app.storage?.updateSaveButtonsVisibility();
    
    // Scanner functions with null checks
    window.isScanning = stateManager.get('scanner.isScanning');
    window.stopScan = () => app.scanner?.stopScan();

  } catch (error) {
    console.error('Failed to initialize Barcode Tool Application:', error);
    
    // Show fallback error message
    const body = document.body;
    if (body) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #ffeeee;
        border: 2px solid #ff0000;
        padding: 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        z-index: 9999;
      `;
      errorDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #cc0000;">Application Failed to Start</h3>
        <p style="margin: 0;">Please refresh the page to try again.</p>
        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #666;">
          Error: ${error.message}
        </p>
      `;
      body.appendChild(errorDiv);
    }
  }
});

// Export for testing purposes
export { BarcodeToolApp };