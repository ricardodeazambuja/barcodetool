// Local storage key for saved barcode data
const STORAGE_KEY = 'barcode-tool-saved-data';

// Function to save a single scan to local storage
function saveScan(scanData) {
    // Get existing saved data or initialize an empty array
    const savedData = getSavedData();
    
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
    
    // Save back to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
    
    // Show notification
    showNotification('Scan saved successfully!');
    
    // Refresh saved data display if visible
    if (document.getElementById('savedData').classList.contains('active')) {
        displaySavedData();
    }
}

// Function to get all saved data from local storage
function getSavedData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Function to clear all saved data
function clearSavedData() {
    if (confirm('Are you sure you want to delete all saved barcode data? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        displaySavedData(); // Refresh the display
        showNotification('All saved data cleared');
    }
}

// Function to delete a single saved item
function deleteSavedItem(id) {
    const savedData = getSavedData();
    const updatedData = savedData.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    displaySavedData(); // Refresh the display
    showNotification('Item deleted');
}

// Function to copy a saved item to clipboard
function copySavedItem(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showNotification('Copied to clipboard!');
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showNotification('Failed to copy', 'error');
        });
}

// Function to save the latest scan to local storage
function saveLatestScan() {
    if (scanHistory.length === 0) {
        showNotification('No scans to save', 'error');
        return;
    }
    
    const latestScan = scanHistory[0];
    saveScan({
        text: latestScan.text,
        format: latestScan.format,
        scanTime: latestScan.time
    });
}

// Function to save all scans to local storage
function saveAllScans() {
    if (scanHistory.length === 0) {
        showNotification('No scans to save', 'error');
        return;
    }
    
    let savedCount = 0;
    scanHistory.forEach(scan => {
        saveScan({
            text: scan.text,
            format: scan.format,
            scanTime: scan.time
        });
        savedCount++;
    });
    
    showNotification(`Saved ${savedCount} scans successfully!`);
}

// Function to display saved data in the UI
function displaySavedData() {
    const savedDataList = document.getElementById('savedDataList');
    const savedData = getSavedData();
    
    if (savedData.length === 0) {
        savedDataList.innerHTML = '<div class="info-message">No saved data yet. Save some scanned codes first.</div>';
        return;
    }
    
    // Clear the list
    savedDataList.innerHTML = '';
    
    // Add each saved item
    savedData.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'saved-item';
        
        // Format date for display
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const displayDate = item.timestamp ? 
            new Date(item.timestamp).toLocaleDateString(undefined, dateOptions) : 
            item.scanTime || 'Unknown date';
        
        // Create header with metadata
        const header = document.createElement('div');
        header.className = 'saved-item-header';
        header.innerHTML = `
            <strong>${index + 1}. ${item.format || 'Unknown format'}</strong>
            <span class="saved-item-date">${displayDate}</span>
        `;
        
        // Create content with the actual data
        const content = document.createElement('div');
        content.className = 'saved-item-content';
        
        // Check if scan text contains a URL or file path
        const hasLinkableContent = detectURLs ? detectURLs(item.text) : false;
        if (hasLinkableContent) {
            // Use innerHTML to render the links
            content.innerHTML = textWithLinks ? textWithLinks(item.text) : item.text;
            
            // Add copy buttons to links if the function exists
            if (typeof addCopyButtonsToLinks === 'function') {
                addCopyButtonsToLinks(content);
            }
        } else {
            content.textContent = item.text;
        }
        
        // Create actions for this saved item
        const actions = document.createElement('div');
        actions.className = 'saved-item-actions';
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'mini-button';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.addEventListener('click', () => copySavedItem(item.text));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'mini-button delete-button';
        deleteBtn.innerHTML = '🗑️ Delete';
        deleteBtn.addEventListener('click', () => deleteSavedItem(item.id));
        
        // Add buttons to actions
        actions.appendChild(copyBtn);
        actions.appendChild(deleteBtn);
        
        // Add all sections to the item
        itemElement.appendChild(header);
        itemElement.appendChild(content);
        itemElement.appendChild(actions);
        
        // Add the item to the list
        savedDataList.appendChild(itemElement);
    });
}

// Function to show save buttons when scans are available
function updateSaveButtonsVisibility() {
    const saveButtons = document.getElementById('saveButtons');
    if (scanHistory && scanHistory.length > 0) {
        saveButtons.style.display = 'block';
    } else {
        saveButtons.style.display = 'none';
    }
}

// Helper function to show notifications
function showNotification(message, type = 'success') {
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

// Update scanner.js to call updateSaveButtonsVisibility after adding to scan history
const originalAddToScanHistory = addToScanHistory;
addToScanHistory = function(text, format, time) {
    originalAddToScanHistory(text, format, time);
    updateSaveButtonsVisibility();
};