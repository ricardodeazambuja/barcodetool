/**
 * StorageManager class - Handles all data persistence functionality
 */
import { showNotification, addLinkStyles, ErrorHandler } from './ui.js';
import { detectURLs, textWithLinks, addCopyButtonsToLinks } from './utils.js';
import { stateManager } from './state.js';

export class StorageManager {
  constructor() {
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Save latest scan button
    const saveLatestBtn = document.getElementById('saveLatestScan');
    if (saveLatestBtn) {
      saveLatestBtn.addEventListener('click', () => {
        this.saveLatestScan();
      });
    }

    // Save all scans button
    const saveAllBtn = document.getElementById('saveAllScans');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        this.saveAllScans();
      });
    }

    // Clear saved data button
    const clearBtn = document.getElementById('clearSavedData');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearSavedData();
      });
    }
  }

  /**
   * Save a single scan to local storage
   */
  saveScan(scanData) {
    return ErrorHandler.wrapAsync(async () => {
      // Get existing saved data or initialize an empty array
      const savedData = this.getSavedData();

      // Add timestamp if not present
      if (!scanData.timestamp) {
        scanData.timestamp = new Date().toISOString();
      }

      // Add unique ID if not present
      if (!scanData.id) {
        scanData.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      }

      // Add to saved data
      savedData.push(scanData);

      // Save to localStorage
      const storageKey = stateManager.get('storage.storageKey');
      localStorage.setItem(storageKey, JSON.stringify(savedData));

      return true;
    }, 'StorageManager.saveScan', 'Failed to save scan data');
  }

  /**
   * Get all saved data from local storage
   */
  getSavedData() {
    try {
      const storageKey = stateManager.get('storage.storageKey');
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading saved data:', error);
      return [];
    }
  }

  /**
   * Delete all saved data
   */
  deleteAllSavedData() {
    try {
      const storageKey = stateManager.get('storage.storageKey');
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error('Error deleting saved data:', error);
      return false;
    }
  }

  /**
   * Delete a specific saved item by ID
   */
  deleteSavedItem(itemId) {
    try {
      const savedData = this.getSavedData();
      const filteredData = savedData.filter(item => item.id !== itemId);
      
      const storageKey = stateManager.get('storage.storageKey');
      localStorage.setItem(storageKey, JSON.stringify(filteredData));
      
      return true;
    } catch (error) {
      console.error('Error deleting saved item:', error);
      return false;
    }
  }

  /**
   * Copy saved item text to clipboard
   */
  async copySavedItem(text) {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Text copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showNotification('Failed to copy text', 'error');
    }
  }

  /**
   * Save the latest scan from scan history
   */
  async saveLatestScan() {
    return await ErrorHandler.wrapAsync(async () => {
      ErrorHandler.showProgress('Saving latest scan...');
      
      const scanHistory = stateManager.get('scanner.scanHistory');
      
      if (!scanHistory || scanHistory.length === 0) {
        ErrorHandler.showUserError('No scans to save');
        return;
      }

      const latestScan = scanHistory[0]; // Most recent scan is first
      const success = await this.saveScan(latestScan);
      
      if (success) {
        ErrorHandler.showSuccess('Latest scan saved successfully!');
        this.displaySavedData(); // Refresh the saved data display
      } else {
        ErrorHandler.showUserError('Failed to save scan');
      }
    }, 'StorageManager.saveLatestScan', 'Failed to save latest scan');
  }

  /**
   * Save all scans from scan history
   */
  async saveAllScans() {
    return await ErrorHandler.wrapAsync(async () => {
      ErrorHandler.showProgress('Saving all scans...');
      
      const scanHistory = stateManager.get('scanner.scanHistory');
      
      if (!scanHistory || scanHistory.length === 0) {
        ErrorHandler.showUserError('No scans to save');
        return;
      }

      let savedCount = 0;
      
      for (const scan of scanHistory) {
        try {
          if (await this.saveScan(scan)) {
            savedCount++;
          }
        } catch (error) {
          console.error('Error saving scan:', error);
        }
      }

      if (savedCount === scanHistory.length) {
        ErrorHandler.showSuccess(`All ${savedCount} scans saved successfully!`);
      } else if (savedCount > 0) {
        ErrorHandler.showUserError(`${savedCount} of ${scanHistory.length} scans saved`);
      } else {
        ErrorHandler.showUserError('Failed to save scans');
      }

      this.displaySavedData(); // Refresh the saved data display
    }, 'StorageManager.saveAllScans', 'Failed to save all scans');
  }

  /**
   * Clear all saved data with confirmation
   */
  async clearSavedData() {
    return await ErrorHandler.wrapAsync(async () => {
      const savedData = this.getSavedData();
      
      if (savedData.length === 0) {
        ErrorHandler.showUserError('No saved data to clear');
        return;
      }

      // Show confirmation dialog
      const confirmed = confirm(`Are you sure you want to delete all ${savedData.length} saved items? This cannot be undone.`);
      
      if (confirmed) {
        ErrorHandler.showProgress('Clearing saved data...');
        
        const success = this.deleteAllSavedData();
        
        if (success) {
          ErrorHandler.showSuccess('All saved data cleared successfully!');
          this.displaySavedData(); // Refresh the display
        } else {
          ErrorHandler.showUserError('Failed to clear saved data');
        }
      }
    }, 'StorageManager.clearSavedData', 'Failed to clear saved data');
  }

  /**
   * Display all saved data in the UI
   */
  displaySavedData() {
    // Ensure link styles are available
    addLinkStyles();
    
    const savedDataList = document.getElementById('savedDataList');
    const savedData = this.getSavedData();

    if (savedData.length === 0) {
      savedDataList.innerHTML = '<div class="info-message">No saved data yet. Save some scanned codes first.</div>';
      return;
    }

    savedDataList.innerHTML = '';

    // Sort by timestamp (newest first)
    const sortedData = savedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedData.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'saved-item';

      // Create header with format, timestamp, and delete button
      const header = document.createElement('div');
      header.className = 'saved-item-header';
      
      const formatSpan = document.createElement('span');
      formatSpan.className = 'saved-item-format';
      formatSpan.textContent = item.format || 'Unknown Format';
      
      const timestampSpan = document.createElement('span');
      timestampSpan.className = 'saved-item-timestamp';
      const date = new Date(item.timestamp);
      timestampSpan.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete this item';
      deleteBtn.addEventListener('click', () => {
        this.deleteSavedItem(item.id);
        this.displaySavedData(); // Refresh display
        showNotification('Item deleted', 'success');
      });

      header.appendChild(formatSpan);
      header.appendChild(timestampSpan);
      header.appendChild(deleteBtn);

      // Create content area
      const content = document.createElement('div');
      content.className = 'saved-item-content';

      // Check if scan text contains linkable content
      const hasLinkableContent = detectURLs(item.text);
      if (hasLinkableContent) {
        content.innerHTML = textWithLinks(item.text);
        addCopyButtonsToLinks(content);
      } else {
        content.textContent = item.text;
      }

      // Create actions area
      const actions = document.createElement('div');
      actions.className = 'saved-item-actions';
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '📋 Copy';
      copyBtn.addEventListener('click', () => {
        this.copySavedItem(item.text);
      });

      actions.appendChild(copyBtn);

      // Assemble the item
      itemDiv.appendChild(header);
      itemDiv.appendChild(content);
      itemDiv.appendChild(actions);

      savedDataList.appendChild(itemDiv);
    });
  }

  /**
   * Update save buttons visibility based on scan history
   */
  updateSaveButtonsVisibility() {
    const scanHistory = stateManager.get('scanner.scanHistory');
    const saveButtons = document.getElementById('saveButtons');
    
    if (saveButtons) {
      if (scanHistory && scanHistory.length > 0) {
        saveButtons.style.display = 'block';
      } else {
        saveButtons.style.display = 'none';
      }
    }
  }

  /**
   * Export saved data as JSON
   */
  exportSavedData() {
    try {
      const savedData = this.getSavedData();
      
      if (savedData.length === 0) {
        showNotification('No data to export', 'info');
        return;
      }

      const dataStr = JSON.stringify(savedData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      showNotification('Failed to export data', 'error');
    }
  }

  /**
   * Import saved data from JSON file
   */
  async importSavedData(file) {
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      if (!Array.isArray(importedData)) {
        throw new Error('Invalid data format');
      }

      // Validate imported data structure
      const validData = importedData.filter(item => 
        item && typeof item.text === 'string' && typeof item.format === 'string'
      );

      if (validData.length === 0) {
        showNotification('No valid data found in file', 'error');
        return;
      }

      // Add IDs and timestamps to imported data if missing
      validData.forEach(item => {
        if (!item.id) {
          item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        }
        if (!item.timestamp) {
          item.timestamp = new Date().toISOString();
        }
      });

      // Merge with existing data
      const existingData = this.getSavedData();
      const mergedData = [...existingData, ...validData];
      
      const storageKey = stateManager.get('storage.storageKey');
      localStorage.setItem(storageKey, JSON.stringify(mergedData));
      
      this.displaySavedData(); // Refresh display
      showNotification(`Imported ${validData.length} items successfully!`, 'success');
      
    } catch (error) {
      console.error('Error importing data:', error);
      showNotification('Failed to import data: ' + error.message, 'error');
    }
  }

  /**
   * Get statistics about saved data
   */
  getDataStatistics() {
    const savedData = this.getSavedData();
    
    const stats = {
      totalItems: savedData.length,
      formats: {},
      oldestDate: null,
      newestDate: null,
    };

    if (savedData.length > 0) {
      // Count formats
      savedData.forEach(item => {
        const format = item.format || 'Unknown';
        stats.formats[format] = (stats.formats[format] || 0) + 1;
      });

      // Find date range
      const dates = savedData.map(item => new Date(item.timestamp)).filter(date => !isNaN(date));
      if (dates.length > 0) {
        stats.oldestDate = new Date(Math.min(...dates));
        stats.newestDate = new Date(Math.max(...dates));
      }
    }

    return stats;
  }
}