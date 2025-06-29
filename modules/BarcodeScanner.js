/**
 * BarcodeScanner class - Handles all barcode scanning functionality
 */
import { displayError, clearResults, addLinkStyles, ErrorHandler } from './ui.js';
import { detectURLs, textWithLinks, addCopyButtonsToLinks, getBarcodeFormatName } from './utils.js';
import { stateManager } from './state.js';

export class BarcodeScanner {
  constructor() {
    this.lastClickTime = 0;
    this.clickDebounceMs = 500; // Prevent rapid clicking
    this.initializeUI();
    this.initializeEventListeners();
    this.initializeFormatSelection();
  }

  /**
   * Initialize UI elements
   */
  initializeUI() {
    document.getElementById('barcodeScanner').style.display = 'block';
    document.getElementById('qrCanvas').style.display = 'none';
    addLinkStyles();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Scan button click with debouncing
    const scanButton = document.getElementById('scanButton');
    scanButton.addEventListener('click', () => {
      const now = Date.now();
      
      // Prevent rapid clicking that can cause race conditions
      if (now - this.lastClickTime < this.clickDebounceMs) {
        console.log('Button click ignored due to debouncing');
        return;
      }
      
      this.lastClickTime = now;
      
      if (!stateManager.get('scanner.isScanning')) {
        this.startScan();
      } else {
        this.stopScan();
      }
    });

    // Image upload for scanning
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
      imageUpload.addEventListener('change', (e) => {
        this.handleImageUpload(e);
      });
    }
  }

  /**
   * Initialize format selection checkboxes
   */
  initializeFormatSelection() {
    // Add event listener for the "Select All" checkbox
    document.getElementById('selectAllFormats').addEventListener('change', (event) => {
      const checkboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });
    });

    // Add event listeners to individual format checkboxes
    const formatCheckboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]:not(#selectAllFormats)');
    formatCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const allCheckboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]:not(#selectAllFormats)');
        const checkedCount = document.querySelectorAll('#formatOptions input[type="checkbox"]:not(#selectAllFormats):checked').length;
        
        // Update "Select All" checkbox state
        const selectAllCheckbox = document.getElementById('selectAllFormats');
        selectAllCheckbox.checked = checkedCount === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
      });
    });
  }

  /**
   * Get selected barcode formats for scanning
   */
  getSelectedFormats() {
    const formatMapping = {
      qrcode: ZXing.BarcodeFormat.QR_CODE,
      datamatrix: ZXing.BarcodeFormat.DATA_MATRIX,
      pdf417: ZXing.BarcodeFormat.PDF_417,
      aztec: ZXing.BarcodeFormat.AZTEC,
      upca: ZXing.BarcodeFormat.UPC_A,
      upce: ZXing.BarcodeFormat.UPC_E,
      ean13: ZXing.BarcodeFormat.EAN_13,
      ean8: ZXing.BarcodeFormat.EAN_8,
      code128: ZXing.BarcodeFormat.CODE_128,
      code39: ZXing.BarcodeFormat.CODE_39,
      code93: ZXing.BarcodeFormat.CODE_93,
      codabar: ZXing.BarcodeFormat.CODABAR,
      itf: ZXing.BarcodeFormat.ITF,
    };

    const selectedFormats = [];
    const checkboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]:checked:not(#selectAllFormats)');
    
    checkboxes.forEach((checkbox) => {
      const format = formatMapping[checkbox.value];
      if (format !== undefined) {
        selectedFormats.push(format);
      }
    });

    return selectedFormats.length > 0 ? selectedFormats : Object.values(formatMapping);
  }

  /**
   * Start barcode scanning
   */
  async startScan() {
    return await ErrorHandler.wrapAsync(async () => {
      ErrorHandler.clearAllErrors();
      ErrorHandler.showProgress('Starting camera...');
      
      clearResults();
      stateManager.set('scanner.isScanning', true);
      stateManager.set('scanner.resetInProgress', false);
      
      // Clear previous successful scan state (for conditional canvas hiding)
      stateManager.set('scanner.lastScanSuccessful', false);

      // Update button text
      const scanButton = document.getElementById('scanButton');
      scanButton.textContent = '⏹️ Stop Scan';

      // Create a new code reader
      const codeReader = new ZXing.BrowserMultiFormatReader();
      stateManager.set('scanner.codeReader', codeReader);

      const videoInputDevices = await codeReader.listVideoInputDevices();
      const cameraSelect = document.getElementById('cameraSelect');

      // Clear any existing options
      while (cameraSelect.firstChild) {
        cameraSelect.removeChild(cameraSelect.firstChild);
      }

      if (videoInputDevices && videoInputDevices.length > 0) {
        // Check if we have a saved device ID in localStorage
        const savedDeviceId = localStorage.getItem('preferredCameraId');

        // Check if the saved device still exists in available devices
        let deviceExists = false;
        if (savedDeviceId) {
          deviceExists = videoInputDevices.some((device) => device.deviceId === savedDeviceId);
        }

        // If we have a saved device that still exists, use it
        let selectedDeviceId = null;
        if (deviceExists) {
          selectedDeviceId = savedDeviceId;
        } else {
          // Otherwise, use the first available device
          selectedDeviceId = videoInputDevices[0].deviceId;
        }

        stateManager.set('scanner.selectedDeviceId', selectedDeviceId);

        // Populate camera select dropdown if multiple cameras
        if (videoInputDevices.length > 1) {
          videoInputDevices.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${cameraSelect.children.length + 1}`;
            if (device.deviceId === selectedDeviceId) {
              option.selected = true;
            }
            cameraSelect.appendChild(option);
          });

          // Add change event listener to save preference
          cameraSelect.addEventListener('change', (e) => {
            const newDeviceId = e.target.value;
            stateManager.set('scanner.selectedDeviceId', newDeviceId);
            localStorage.setItem('preferredCameraId', newDeviceId);
            
            // Restart scanning with new camera
            this.stopScan().then(() => {
              this.startScan();
            });
          });

          cameraSelect.style.display = 'block';
        } else {
          cameraSelect.style.display = 'none';
        }

        // Set up video element and canvas
        const video = document.getElementById('video');
        const qrCanvas = document.getElementById('qrCanvas');

        // iOS-specific video settings
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.autoplay = true;
        
        // Ensure proper video element setup for iOS
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          video.setAttribute('webkit-playsinline', 'true');
          video.muted = true;
        }

        // Initially show video to establish stream, canvas will overlay
        video.style.display = 'block';
        qrCanvas.style.display = 'none'; // Start hidden, will show when drawing starts

        // Set up continuous video-to-canvas drawing (like main branch)
        const setupCanvasDrawing = () => {
          if (video.readyState >= video.HAVE_ENOUGH_DATA) {
            qrCanvas.width = video.videoWidth;
            qrCanvas.height = video.videoHeight;
            
            // Show canvas and hide video (canvas displays the video feed)
            qrCanvas.style.display = 'block';
            video.style.display = 'none';
            
            // Start continuous drawing of video frames to canvas
            const canvasDrawingInterval = setInterval(() => {
              if (video.readyState === video.HAVE_ENOUGH_DATA && stateManager.get('scanner.isScanning')) {
                const canvasContext = qrCanvas.getContext('2d');
                canvasContext.drawImage(video, 0, 0, qrCanvas.width, qrCanvas.height);
              }
            }, 20); // Update every 20ms (approximately 50 fps)
            
            stateManager.set('scanner.canvasDrawingInterval', canvasDrawingInterval);
          }
        };
        
        // Set up canvas drawing when video metadata is loaded
        video.addEventListener('loadedmetadata', setupCanvasDrawing);
        
        // If metadata is already loaded, set up immediately
        if (video.readyState >= video.HAVE_METADATA) {
          setupCanvasDrawing();
        }

        // Get selected formats
        const selectedFormats = this.getSelectedFormats();

        // Start decoding with selected device and formats
        try {
          const result = await codeReader.decodeOnceFromVideoDevice(selectedDeviceId, 'video', selectedFormats);
          
          if (result) {
            this.handleZXingCode(result);
          }
        } catch (err) {
          // Ignore initial decode errors (stream ended, no code detected, etc.)
          // These are normal when scanner is stopped quickly or no barcode is present
          console.log('Initial decode completed (no barcode found or stream ended)');
        }

        // Set up continuous scanning with interval
        const drawingInterval = setInterval(async () => {
          if (!stateManager.get('scanner.isScanning') || stateManager.get('scanner.resetInProgress')) {
            clearInterval(drawingInterval);
            return;
          }

          try {
            const result = await codeReader.decodeOnceFromVideoDevice(selectedDeviceId, 'video', selectedFormats);
            if (result) {
              this.handleZXingCode(result);
            }
          } catch (err) {
            // Ignore errors during continuous scanning
          }
        }, 100);

        stateManager.set('scanner.drawingInterval', drawingInterval);

      } else {
        ErrorHandler.showUserError('No camera devices found. Please check camera permissions.');
        this.stopScan();
      }
    }, 'BarcodeScanner.startScan', 'Failed to start camera');
  }

  /**
   * Stop barcode scanning
   */
  async stopScan() {
    return new Promise((resolve) => {
      try {
        stateManager.set('scanner.resetInProgress', true);
        stateManager.set('scanner.isScanning', false);

        // Clear any existing UI cleanup timeout
        const existingTimeout = stateManager.get('scanner.scanningTimeout');
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          stateManager.set('scanner.scanningTimeout', null);
        }

        // Clear drawing interval
        const drawingInterval = stateManager.get('scanner.drawingInterval');
        if (drawingInterval) {
          clearInterval(drawingInterval);
          stateManager.set('scanner.drawingInterval', null);
        }

        // Clear canvas drawing interval
        const canvasDrawingInterval = stateManager.get('scanner.canvasDrawingInterval');
        if (canvasDrawingInterval) {
          clearInterval(canvasDrawingInterval);
          stateManager.set('scanner.canvasDrawingInterval', null);
        }

        // Auto-stop timeout removed - now using immediate stop on detection

        // Stop code reader
        const codeReader = stateManager.get('scanner.codeReader');
        if (codeReader) {
          try {
            codeReader.reset();
          } catch (err) {
            console.warn('Error resetting code reader:', err);
          }
          stateManager.set('scanner.codeReader', null);
        }

        // Update UI
        const scanButton = document.getElementById('scanButton');
        scanButton.textContent = '📱 Start Scan';

        const video = document.getElementById('video');
        const qrCanvas = document.getElementById('qrCanvas');
        
        // Always hide video stream
        video.style.display = 'none';
        
        // Only hide canvas if this was NOT a successful scan (manual stop)
        const wasSuccessfulScan = stateManager.get('scanner.lastScanSuccessful');
        if (!wasSuccessfulScan) {
          qrCanvas.style.display = 'none';
        }

        // Immediately stop camera and clean up resources
        this.ensureFullStop();
        
        // Small timeout only for UI cleanup to prevent visual glitches
        const uiCleanupTimeout = setTimeout(() => {
          stateManager.set('scanner.resetInProgress', false);
          resolve();
        }, 100);
        
        stateManager.set('scanner.scanningTimeout', uiCleanupTimeout);

      } catch (err) {
        console.error('Error stopping scan:', err);
        stateManager.set('scanner.resetInProgress', false);
        resolve();
      }
    });
  }

  /**
   * Ensure scanning is fully stopped
   */
  ensureFullStop() {
    try {
      // Stop all video tracks
      const video = document.getElementById('video');
      if (video && video.srcObject) {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
        video.srcObject = null;
      }

      // Clear any remaining intervals or timeouts
      const drawingInterval = stateManager.get('scanner.drawingInterval');
      if (drawingInterval) {
        clearInterval(drawingInterval);
        stateManager.set('scanner.drawingInterval', null);
      }

      const canvasDrawingInterval = stateManager.get('scanner.canvasDrawingInterval');
      if (canvasDrawingInterval) {
        clearInterval(canvasDrawingInterval);
        stateManager.set('scanner.canvasDrawingInterval', null);
      }

      // Auto-stop timeout removed - now using immediate stop on detection

      // Reset code reader
      const codeReader = stateManager.get('scanner.codeReader');
      if (codeReader) {
        try {
          codeReader.reset();
        } catch (err) {
          console.warn('Error in final code reader reset:', err);
        }
        stateManager.set('scanner.codeReader', null);
      }
    } catch (err) {
      console.error('Error in ensureFullStop:', err);
    }
  }

  /**
   * Handle successful barcode scan
   */
  handleZXingCode(result) {
    try {
      const qrCanvas = document.getElementById('qrCanvas');
      const canvasContext = qrCanvas.getContext('2d');
      canvasContext.strokeStyle = 'red';
      canvasContext.lineWidth = 4;

      // Draw detection box
      const resultPoints = result.getResultPoints();
      if (resultPoints && resultPoints.length >= 2) {
        canvasContext.beginPath();
        canvasContext.moveTo(resultPoints[0].getX(), resultPoints[0].getY());
        for (let i = 1; i < resultPoints.length; i++) {
          canvasContext.lineTo(resultPoints[i].getX(), resultPoints[i].getY());
        }
        canvasContext.closePath();
        canvasContext.stroke();
      }

      // Get scan data
      const text = result.getText();
      const format = getBarcodeFormatName(result.getBarcodeFormat());
      const time = new Date().toLocaleString();

      // Mark that we had a successful scan (for conditional canvas hiding)
      stateManager.set('scanner.lastScanSuccessful', true);

      // IMMEDIATELY stop all scanning processes to preserve the detection frame
      stateManager.set('scanner.isScanning', false);
      
      // Stop canvas drawing interval to preserve the current frame
      const canvasDrawingInterval = stateManager.get('scanner.canvasDrawingInterval');
      if (canvasDrawingInterval) {
        clearInterval(canvasDrawingInterval);
        stateManager.set('scanner.canvasDrawingInterval', null);
      }

      // Stop continuous scanning interval
      const drawingInterval = stateManager.get('scanner.drawingInterval');
      if (drawingInterval) {
        clearInterval(drawingInterval);
        stateManager.set('scanner.drawingInterval', null);
      }

      // Video is already hidden, canvas stays visible showing the detection frame

      // Add to scan history
      this.addToScanHistory(text, format, time);

      // Display result
      this.displayScanResult(text, format, time);

      // Update save buttons visibility
      this.updateSaveButtonsVisibility();
      
      // Show success message
      ErrorHandler.showSuccess('Barcode scanned successfully!');

      // Immediately stop scanning and clean up camera resources
      // (Detection frame is already preserved by stopping intervals above)
      this.stopScan();

    } catch (err) {
      console.error('Error handling scan result:', err);
      ErrorHandler.showUserError('Error processing scan result: ' + err.message, err, 'BarcodeScanner.handleZXingCode');
    }
  }

  /**
   * Handle image upload for scanning
   */
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    return await ErrorHandler.wrapAsync(async () => {
      ErrorHandler.clearAllErrors();
      ErrorHandler.showProgress('Scanning uploaded image...');
      
      clearResults();

      if (!file.type.startsWith('image/')) {
        ErrorHandler.showUserError('Please select a valid image file.');
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = async () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Get image data for ZXing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Create code reader and decode
          const codeReader = new ZXing.BrowserMultiFormatReader();
          const selectedFormats = this.getSelectedFormats();
          
          const result = await codeReader.decodeFromImageData(imageData, selectedFormats);
          
          if (result) {
            const text = result.getText();
            const format = getBarcodeFormatName(result.getBarcodeFormat());
            const time = new Date().toLocaleString();

            // Add to scan history
            this.addToScanHistory(text, format, time);

            // Display result
            this.displayScanResult(text, format, time);

            // Update save buttons visibility
            this.updateSaveButtonsVisibility();
            
            // Show success message
            ErrorHandler.showSuccess('Image scanned successfully!');
          } else {
            ErrorHandler.showUserError('No barcode found in the uploaded image.');
          }
        } catch (err) {
          throw new Error('Error scanning image: ' + err.message);
        }
      };

      img.onerror = () => {
        throw new Error('Error loading image file.');
      };

      // Read the uploaded file
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);

    }, 'BarcodeScanner.handleImageUpload', 'Failed to process uploaded image');
  }

  /**
   * Add scan to history
   */
  addToScanHistory(text, format, time) {
    const scanData = { text, format, time };
    stateManager.addToScanHistory(scanData);
    this.updateHistoryDisplay();
  }

  /**
   * Update the scan history display
   */
  updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    const scanHistory = stateManager.get('scanner.scanHistory');
    
    if (!scanHistory || scanHistory.length === 0) {
      historyList.innerHTML = '<p class="info-message">No scans yet. Scan a barcode to start.</p>';
      return;
    }

    historyList.innerHTML = '';

    scanHistory.forEach((scan, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';

      const header = document.createElement('div');
      header.className = 'history-header';
      header.innerHTML = `
        <strong>${scan.format}</strong>
        <span class="history-time">${scan.time}</span>
      `;

      const content = document.createElement('div');
      content.className = 'history-content';

      // Check if scan text contains linkable content
      const hasLinkableContent = detectURLs(scan.text);
      if (hasLinkableContent) {
        content.innerHTML = textWithLinks(scan.text);
        addCopyButtonsToLinks(content);
      } else {
        content.textContent = scan.text;
      }

      historyItem.appendChild(header);
      historyItem.appendChild(content);
      historyList.appendChild(historyItem);
    });
  }

  /**
   * Display scan result
   */
  displayScanResult(text, format, time) {
    const scanResult = document.getElementById('scanResult');
    const scanResultContainer = document.getElementById('scanResultContainer');

    if (scanResult) {
      // Check if scan text contains linkable content
      const hasLinkableContent = detectURLs(text);
      if (hasLinkableContent) {
        scanResult.innerHTML = textWithLinks(text);
        addCopyButtonsToLinks(scanResult);
      } else {
        scanResult.textContent = text;
      }

      if (scanResultContainer) {
        scanResultContainer.style.display = 'block';
      }
    }
  }

  /**
   * Update save buttons visibility
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
   * Get scan history
   */
  getScanHistory() {
    return stateManager.get('scanner.scanHistory') || [];
  }

  /**
   * Clear scan history
   */
  clearScanHistory() {
    stateManager.clearScanHistory();
    this.updateHistoryDisplay();
    this.updateSaveButtonsVisibility();
  }
}