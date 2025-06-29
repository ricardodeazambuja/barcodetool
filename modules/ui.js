/**
 * Enhanced error handling system
 */
const ErrorHandler = {
  /**
   * Log error details for debugging
   * @param {Error|string} error - The error to log
   * @param {string} context - Additional context about where the error occurred
   */
  logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : '';
    
    console.group(`🚨 Error ${timestamp}`);
    console.error('Message:', errorMessage);
    if (context) console.error('Context:', context);
    if (stack) console.error('Stack:', stack);
    console.groupEnd();
  },

  /**
   * Display user-friendly error in the main UI message area
   * @param {string} message - User-friendly error message
   * @param {Error|string} originalError - Original error for logging
   * @param {string} context - Context about where error occurred
   */
  showUserError(message, originalError = null, context = '') {
    // Log the technical error details
    if (originalError) {
      this.logError(originalError, context);
    }

    // Show user-friendly message with context awareness
    this.displayContextualMessage(message, 'error');
  },

  /**
   * Display message in the main UI message area (where "generating..." appears)
   * @param {string} message - The message to display
   * @param {string} type - Message type: 'error', 'success', 'info', 'warning'
   */
  displayInMainArea(message, type = 'info') {
    // Find or create main message area
    let messageArea = document.getElementById('mainMessageArea');
    if (!messageArea) {
      // Create main message area if it doesn't exist
      messageArea = document.createElement('div');
      messageArea.id = 'mainMessageArea';
      messageArea.style.cssText = `
        margin: 10px 0;
        padding: 12px;
        border-radius: 6px;
        font-weight: 500;
        text-align: center;
        display: none;
        transition: all 0.3s ease;
      `;
      
      // Insert after the tabs but before content
      const tabs = document.querySelector('.tabs');
      if (tabs && tabs.nextSibling) {
        tabs.parentNode.insertBefore(messageArea, tabs.nextSibling);
      } else {
        document.body.appendChild(messageArea);
      }
    }

    // Set message content and styling based on type
    messageArea.textContent = message;
    messageArea.style.display = 'block';
    
    // Reset classes and add type-specific styling
    messageArea.className = `main-message main-message-${type}`;
    
    switch (type) {
      case 'error':
        messageArea.style.backgroundColor = '#fee';
        messageArea.style.borderLeft = '4px solid #e74c3c';
        messageArea.style.color = '#c0392b';
        break;
      case 'success':
        messageArea.style.backgroundColor = '#efe';
        messageArea.style.borderLeft = '4px solid #27ae60';
        messageArea.style.color = '#229954';
        break;
      case 'warning':
        messageArea.style.backgroundColor = '#fef5e7';
        messageArea.style.borderLeft = '4px solid #f39c12';
        messageArea.style.color = '#d68910';
        break;
      default: // info
        messageArea.style.backgroundColor = '#e8f4f8';
        messageArea.style.borderLeft = '4px solid #3498db';
        messageArea.style.color = '#2471a3';
    }

    // Auto-hide after delay (except for errors)
    if (type !== 'error') {
      // Clear any existing hide timeout for this message area
      if (messageArea._hideTimeout) {
        clearTimeout(messageArea._hideTimeout);
      }
      
      messageArea._hideTimeout = setTimeout(() => {
        if (messageArea && messageArea.style.display === 'block') {
          messageArea.style.display = 'none';
        }
        messageArea._hideTimeout = null;
      }, type === 'success' ? 3000 : 5000);
    }

    // Scroll to make visible with proper timing
    requestAnimationFrame(() => {
      if (messageArea && messageArea.scrollIntoView) {
        try {
          messageArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
          // Fallback for older browsers
          messageArea.scrollIntoView();
        }
      }
    });
  },

  /**
   * Legacy error display function for backward compatibility
   * @param {string} message - The error message to display
   */
  displayInErrorArea(message) {
    console.error(message);

    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
      errorDisplay.textContent = message;
      errorDisplay.style.display = 'block';
      errorDisplay.style.position = 'static';
      errorDisplay.style.backgroundColor = '#ffeeee';
      errorDisplay.style.padding = '10px';
      errorDisplay.style.marginTop = '10px';
      errorDisplay.style.border = '1px solid #ffcccc';
      errorDisplay.style.borderRadius = '4px';
      errorDisplay.style.fontWeight = 'bold';
      errorDisplay.style.color = '#cc0000';
    }
  },

  /**
   * Clear all error displays
   */
  clearAllErrors() {
    // Clear main message area
    const messageArea = document.getElementById('mainMessageArea');
    if (messageArea) {
      // Clear any pending hide timeout
      if (messageArea._hideTimeout) {
        clearTimeout(messageArea._hideTimeout);
        messageArea._hideTimeout = null;
      }
      messageArea.style.display = 'none';
    }

    // Clear error display
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
      errorDisplay.style.display = 'none';
      errorDisplay.textContent = '';
    }

    // Clear context-specific message containers
    this.clearContextualMessages();
  },

  /**
   * Show progress message in main area
   * @param {string} message - Progress message to show
   */
  showProgress(message) {
    this.displayContextualMessage(message, 'progress');
  },

  /**
   * Show success message in main area
   * @param {string} message - Success message to show
   */
  showSuccess(message) {
    this.displayContextualMessage(message, 'success');
  },

  /**
   * Wrap async functions with error handling
   * @param {Function} asyncFn - Async function to wrap
   * @param {string} context - Context for error reporting
   * @param {string} userMessage - User-friendly error message
   */
  async wrapAsync(asyncFn, context = '', userMessage = 'An error occurred') {
    try {
      return await asyncFn();
    } catch (error) {
      this.showUserError(userMessage, error, context);
      throw error; // Re-throw for calling code to handle if needed
    }
  },

  /**
   * Get contextual message container based on current tab
   * @returns {string|null} - CSS selector for context-specific container
   */
  getContextualContainer() {
    // Import stateManager dynamically to avoid circular dependency
    try {
      const currentTab = document.querySelector('.tab.active')?.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
      
      const containers = {
        'generator': '#generatorMessages',
        'scanner': '#scannerMessages',
        'savedData': '#storageMessages'
      };
      
      return containers[currentTab] || null;
    } catch (error) {
      console.warn('Could not determine current tab context:', error);
      return null;
    }
  },

  /**
   * Display message in context-specific container
   * @param {string} containerSelector - CSS selector for container
   * @param {string} message - Message to display
   * @param {string} type - Message type
   */
  displayInContainer(containerSelector, message, type = 'info') {
    const container = document.querySelector(containerSelector);
    if (!container) {
      return false; // Container not found
    }

    // Clear existing content and set new message
    container.innerHTML = message;
    container.className = `action-message-container ${type}`;
    container.style.display = 'block';

    // Set up auto-hide for non-error messages
    if (type !== 'error') {
      // Clear any existing timeout
      if (container._hideTimeout) {
        clearTimeout(container._hideTimeout);
      }
      
      // Set new timeout
      const hideDelay = type === 'success' ? 3000 : 5000;
      container._hideTimeout = setTimeout(() => {
        container.style.display = 'none';
        container._hideTimeout = null;
      }, hideDelay);
    }

    return true; // Successfully displayed
  },

  /**
   * Display message with context awareness
   * @param {string} message - Message to display
   * @param {string} type - Message type
   * @param {boolean} forceGlobal - Force display in global area
   */
  displayContextualMessage(message, type = 'info', forceGlobal = false) {
    let displayed = false;

    // Try context-specific container first (unless forced global)
    if (!forceGlobal) {
      const contextContainer = this.getContextualContainer();
      if (contextContainer) {
        displayed = this.displayInContainer(contextContainer, message, type);
      }
    }

    // If context display failed or was forced global, use main area
    if (!displayed) {
      this.displayInMainArea(message, type);
    }

    // Also maintain backward compatibility with legacy containers
    if (type === 'error') {
      this.displayInErrorArea(message);
    }
  },

  /**
   * Clear context-specific message containers
   */
  clearContextualMessages() {
    const containers = ['#generatorMessages', '#scannerMessages', '#scannerStorageMessages', '#storageMessages'];
    
    containers.forEach(selector => {
      const container = document.querySelector(selector);
      if (container) {
        // Clear any pending timeout
        if (container._hideTimeout) {
          clearTimeout(container._hideTimeout);
          container._hideTimeout = null;
        }
        container.style.display = 'none';
        container.innerHTML = '';
        container.className = 'action-message-container';
      }
    });
  }
};

/**
 * Displays an error message in the UI (backward compatibility)
 * @param {string} message - The error message to display.
 */
export function displayError(message) {
  ErrorHandler.showUserError(message);
}

/**
 * Export the ErrorHandler for use in other modules
 */
export { ErrorHandler };

/**
 * Clears the error message from the UI.
 */
export function clearError() {
  document.getElementById('errorMessage').textContent = '';
}

/**
 * Adds CSS styles for detected links.
 */
export function addLinkStyles() {
  if (!document.getElementById('link-detection-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'link-detection-styles';
    styleElement.textContent = `
            .detected-link {
                color: #0066cc;
                text-decoration: underline;
                word-break: break-all;
            }
            .detected-link:hover {
                color: #004080;
            }
            .app-protocol {
                background-color: #e6f7ff;
                border-radius: 3px;
                padding: 1px 3px;
            }
            .file-path {
                background-color: #e6ffe6;
                border-radius: 3px;
                padding: 1px 3px;
            }
            .intranet-link {
                background-color: #fff0e6;
                border-radius: 3px;
                padding: 1px 3px;
            }
            .ip-link {
                background-color: #f0e6ff;
                border-radius: 3px;
                padding: 1px 3px;
            }
            .copy-link-btn:hover {
                background-color: #e9ecef !important;
            }
        `;
    document.head.appendChild(styleElement);
  }
}

/**
 * Shows a notification message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of notification (e.g., 'success', 'error').
 */
export function showNotification(message, type = 'success') {
  // Check if notification element exists, create if not
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    document.body.appendChild(notification);
  }

  // Set notification content and style
  notification.textContent = message;
  notification.className = 'notification ' + type;

  // Show notification
  notification.style.display = 'block';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

/**
 * Clears scan results and error messages from the UI.
 */
export function clearResults() {
  const resultElement = document.getElementById('scanResult');
  if (resultElement) resultElement.textContent = '';

  const errorDisplay = document.getElementById('errorDisplay');
  if (errorDisplay) {
    errorDisplay.textContent = '';
    errorDisplay.style.display = 'none';
  }

  // Hide scan result container if it exists
  const scanResultContainer = document.getElementById('scanResultContainer');
  if (scanResultContainer) scanResultContainer.style.display = 'none';
}
