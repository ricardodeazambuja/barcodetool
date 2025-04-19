// Global variables for scanner
let videoStream;
let isScanning = false;
let scanningTimeout;
let codeReader;
let drawingInterval;
let scanHistory = [];
let resetInProgress = false;
let selectedDeviceId;

// Initialize scanner event listeners
document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    scanButton.addEventListener('click', () => {
        if (!isScanning) {
            document.getElementById('barcodeScanner').style.display = 'block';
            startScan();
        } else {
            stopScan();
            document.getElementById('barcodeScanner').style.display = 'none';
        }
    });
    
    // Initialize format selection
    initializeFormatSelection();
    
    // Initialize camera device selection
    initializeCameraSelection();
});

function initializeFormatSelection() {
    const formatSelector = document.getElementById('formatSelector');
    
    // Add event listener for the "Select All" checkbox
    document.getElementById('selectAllFormats').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

function initializeCameraSelection() {
    // First, check if barcodeScanner exists
    const scannerDiv = document.getElementById('barcodeScanner');
    if (!scannerDiv) {
        console.error("Element with ID 'barcodeScanner' not found in the DOM");
        return; // Exit if no scanner div found
    }
    
    // Check if panel already exists
    if (!document.getElementById('cameraSelectPanel')) {
        console.log("Creating camera selection panel...");
        
        const cameraSelectPanel = document.createElement('div');
        cameraSelectPanel.id = 'cameraSelectPanel';
        cameraSelectPanel.classList.add('form-group');
        
        const cameraLabel = document.createElement('label');
        cameraLabel.htmlFor = 'cameraSelect';
        cameraLabel.textContent = '📷 Select Camera:';
        
        const cameraSelect = document.createElement('select');
        cameraSelect.id = 'cameraSelect';
        cameraSelect.classList.add('form-control');
        cameraSelect.style.width = '100%';
        
        cameraSelectPanel.appendChild(cameraLabel);
        cameraSelectPanel.appendChild(cameraSelect);
        
        // Insert at the beginning of the scanner div
        scannerDiv.insertBefore(cameraSelectPanel, scannerDiv.firstChild);
        console.log("Camera selection panel created and inserted");
        
        // Create a container for scan results that will appear after the video
        const scanResultContainer = document.createElement('div');
        scanResultContainer.id = 'scanResultContainer';
        scanResultContainer.style.marginTop = '10px';
        scanResultContainer.style.padding = '10px';
        scanResultContainer.style.backgroundColor = '#f0f0f0';
        scanResultContainer.style.border = '1px solid #ddd';
        scanResultContainer.style.borderRadius = '4px';
        scanResultContainer.style.display = 'none';
        
        // Add the scan result element to this container instead
        const scanResultElement = document.getElementById('scanResult');
        if (scanResultElement) {
            // If it exists, move it
            scanResultElement.style.position = 'static'; // Remove absolute positioning
            scanResultContainer.appendChild(scanResultElement);
        } else {
            // If it doesn't exist, create it
            const newScanResult = document.createElement('div');
            newScanResult.id = 'scanResult';
            newScanResult.style.fontWeight = 'bold';
            scanResultContainer.appendChild(newScanResult);
        }
        
        // Add it after the canvas
        const qrCanvas = document.getElementById('qrCanvas');
        if (qrCanvas && qrCanvas.parentNode) {
            qrCanvas.parentNode.insertBefore(scanResultContainer, qrCanvas.nextSibling);
        } else {
            // If canvas doesn't exist yet, add it to the scanner div
            scannerDiv.appendChild(scanResultContainer);
        }
    } else {
        console.log("Camera selection panel already exists");
    }
    
    // Always populate camera devices
    populateCameraDevices();
}

async function populateCameraDevices() {
    try {
        if (!codeReader) {
            codeReader = new ZXing.BrowserMultiFormatReader();
        }
        
        const videoInputDevices = await codeReader.listVideoInputDevices();
        const cameraSelect = document.getElementById('cameraSelect');
        const cameraSelectPanel = document.getElementById('cameraSelectPanel');
        
        // Clear any existing options
        while (cameraSelect.firstChild) {
            cameraSelect.removeChild(cameraSelect.firstChild);
        }
        
        if (videoInputDevices && videoInputDevices.length > 0) {
            // Set the default device
            selectedDeviceId = videoInputDevices[0].deviceId;
            
            // Add all devices to the select dropdown
            videoInputDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${cameraSelect.options.length + 1}`;
                cameraSelect.appendChild(option);
            });
            
            // Show the selection panel regardless of number of cameras
            cameraSelectPanel.style.display = 'block';
            console.log(`Found ${videoInputDevices.length} cameras, showing selection panel`);
            
            // Add change event listener to update selectedDeviceId
            cameraSelect.addEventListener('change', () => {
                selectedDeviceId = cameraSelect.value;
                console.log(`Selected camera changed to: ${selectedDeviceId}`);
                
                // If currently scanning, restart with new device
                if (isScanning) {
                    stopScan(() => startScan());
                }
            });
        } else {
            console.warn("No video input devices found");
            // Don't hide the panel, show a message instead
            cameraSelect.innerHTML = '<option disabled selected>No cameras detected</option>';
        }
    } catch (err) {
        console.error("Error enumerating video devices:", err);
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) {
            errorDisplay.textContent = "Error detecting cameras: " + err.message;
            errorDisplay.style.position = 'static'; // Make sure error is not overlapping
            errorDisplay.style.backgroundColor = '#ffeeee';
            errorDisplay.style.padding = '10px';
            errorDisplay.style.marginTop = '10px';
            errorDisplay.style.border = '1px solid #ffcccc';
            errorDisplay.style.borderRadius = '4px';
        }
    }
}

function getSelectedFormats() {
    const checkboxes = document.querySelectorAll('#formatOptions input[type="checkbox"]:checked');
    const formats = [];
    
    checkboxes.forEach(checkbox => {
        switch(checkbox.value) {
            case 'qrcode':
                formats.push(ZXing.BarcodeFormat.QR_CODE);
                break;
            case 'datamatrix':
                formats.push(ZXing.BarcodeFormat.DATA_MATRIX);
                break;
            case 'pdf417':
                formats.push(ZXing.BarcodeFormat.PDF_417);
                break;
            case 'aztec':
                formats.push(ZXing.BarcodeFormat.AZTEC);
                break;
            case 'upca':
                formats.push(ZXing.BarcodeFormat.UPC_A);
                break;
            case 'upce':
                formats.push(ZXing.BarcodeFormat.UPC_E);
                break;
            case 'ean8':
                formats.push(ZXing.BarcodeFormat.EAN_8);
                break;
            case 'ean13':
                formats.push(ZXing.BarcodeFormat.EAN_13);
                break;
            case 'code128':
                formats.push(ZXing.BarcodeFormat.CODE_128);
                break;
            case 'code39':
                formats.push(ZXing.BarcodeFormat.CODE_39);
                break;
            case 'code93':
                formats.push(ZXing.BarcodeFormat.CODE_93);
                break;
            case 'codabar':
                formats.push(ZXing.BarcodeFormat.CODABAR);
                break;
        }
    });
    
    // If no formats selected, return at least QR_CODE as default
    if (formats.length === 0) {
        formats.push(ZXing.BarcodeFormat.QR_CODE);
    }
    
    return formats;
}

async function startScan() {
    // Ensure any previous scanning session is fully stopped
    await ensureFullStop();
    
    isScanning = true;
    document.getElementById('scanButton').textContent = '⏹️ Stop Scan';
    
    // Clear previous results and errors
    const resultElement = document.getElementById('scanResult');
    if (resultElement) resultElement.textContent = '';
    
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) errorDisplay.textContent = '';
    
    // Hide scan result container if it exists
    const scanResultContainer = document.getElementById('scanResultContainer');
    if (scanResultContainer) scanResultContainer.style.display = 'none';

    try {
        // Initialize camera selection before scanning
        await populateCameraDevices();
        
        // Make sure camera selection panel is visible
        const cameraSelectPanel = document.getElementById('cameraSelectPanel');
        if (cameraSelectPanel) {
            cameraSelectPanel.style.display = 'block';
        }
        
        // Get selected formats
        const selectedFormats = getSelectedFormats();
        
        // Configure the code reader with format hints
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, selectedFormats);
        
        // Reset any existing code reader
        if (codeReader) {
            codeReader.reset();
        }
        
        // Create a new code reader with the desired hints
        codeReader = new ZXing.BrowserMultiFormatReader(hints);
        
        const videoElement = document.getElementById('video');
        const qrCanvas = document.getElementById('qrCanvas');
        
        // Start continuous drawing of video to canvas
        videoElement.onloadedmetadata = () => {
            qrCanvas.width = videoElement.videoWidth;
            qrCanvas.height = videoElement.videoHeight;
            
            // Start drawing video frames continuously
            drawingInterval = setInterval(() => {
                if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                    qrCanvas.width = videoElement.videoWidth;
                    qrCanvas.height = videoElement.videoHeight;
                    const canvasContext = qrCanvas.getContext('2d');
                    canvasContext.drawImage(videoElement, 0, 0, qrCanvas.width, qrCanvas.height);
                }
            }, 20); // Update every 20ms (approximately 50 fps)
        };
        
        // Set up callback for decoding
        codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
            if (result) {
                // Get the video stream for later use
                if (videoElement.srcObject) {
                    videoStream = videoElement.srcObject;
                }
                
                // Draw the red rectangle around the barcode
                handleZXingCode(result);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error("Error decoding barcode:", err);
                if (errorDisplay) {
                    errorDisplay.textContent = `Error decoding barcode: ${err.message}`;
                    errorDisplay.style.display = 'block';
                }
                stopScan();
            }
        }).catch(err => {
            console.error("Error starting video stream:", err);
            if (errorDisplay) {
                errorDisplay.textContent = `Error starting video stream: ${err.message}`;
                errorDisplay.style.display = 'block';
            }
            stopScan();
        });
    } catch (err) {
        console.error("Error setting up scanner:", err);
        if (errorDisplay) {
            errorDisplay.textContent = "Error setting up scanner: " + err.message;
            errorDisplay.style.display = 'block';
        }
        isScanning = false;
        document.getElementById('scanButton').textContent = '📱 Start Scan';
    }
}

function handleZXingCode(result) {
    const qrCanvas = document.getElementById('qrCanvas');
    const canvasContext = qrCanvas.getContext('2d');
    canvasContext.strokeStyle = 'red';
    canvasContext.lineWidth = 3;

    if (result.resultPoints && result.resultPoints.length > 0) {
        const points = result.resultPoints;
        const start = points[0];
        let minX = start.x;
        let minY = start.y;
        let maxX = start.x;
        let maxY = start.y;

        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
        const width = maxX - minX;
        const height = maxY - minY;
        canvasContext.strokeRect(minX, minY, width, height);
    }

    const scanText = result.text;
    const scanFormat = result.getBarcodeFormat ? result.getBarcodeFormat() : result.format;
    const scanTime = new Date().toLocaleTimeString();
    
    // Add to history
    addToScanHistory(scanText, scanFormat, scanTime);
    
    // Update the scan result
    const scanResult = document.getElementById('scanResult');
    if (scanResult) {
        scanResult.textContent = `Result: ${scanText} (Format: ${scanFormat})`;
    }
    
    // Show the scan result container
    const scanResultContainer = document.getElementById('scanResultContainer');
    if (scanResultContainer) {
        scanResultContainer.style.display = 'block';
    }
    
    stopScan();
}

function addToScanHistory(text, format, time) {
    // Add to memory
    scanHistory.unshift({ text, format, time });
    if (scanHistory.length > 10) scanHistory.pop(); // Keep last 10
    
    // Update UI
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    scanHistory.forEach((scan, index) => {
        const item = document.createElement('div');
        item.className = 'form-group';
        item.style.padding = '8px';
        item.style.marginBottom = '8px';
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '5px';
        
        const title = document.createElement('strong');
        title.textContent = `Scan #${index + 1} (${scan.format})`;
        
        const timestamp = document.createElement('span');
        timestamp.textContent = scan.time;
        timestamp.style.color = '#777';
        
        header.appendChild(title);
        header.appendChild(timestamp);
        
        const content = document.createElement('div');
        content.textContent = scan.text;
        content.style.wordBreak = 'break-all';
        
        item.appendChild(header);
        item.appendChild(content);
        historyList.appendChild(item);
    });
}

async function ensureFullStop() {
    // If already stopping, wait for it to complete
    if (resetInProgress) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!resetInProgress) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    // If still scanning, stop it
    if (isScanning) {
        await new Promise(resolve => {
            stopScan(resolve);
        });
    }
}

function stopScan(callback = null) {
    resetInProgress = true;
    isScanning = false;
    document.getElementById('scanButton').textContent = '📱 Start Scan';
    
    clearInterval(drawingInterval);

    if (scanningTimeout) {
        cancelAnimationFrame(scanningTimeout);
        scanningTimeout = null;
    }
    
    // Reset ZXing reader if it exists
    if (codeReader) {
        try {
            codeReader.reset();
            // Give a small delay before considering the reset complete
            setTimeout(() => {
                resetInProgress = false;
                if (callback) callback();
            }, 300);
        } catch (error) {
            console.error("Error resetting code reader:", error);
            resetInProgress = false;
            if (callback) callback();
        }
    } else {
        resetInProgress = false;
        if (callback) callback();
    }
}