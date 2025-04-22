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
    
    // Add image upload button and functionality
    addImageUploadButton();
    
    // Initialize format selection
    initializeFormatSelection();
    
    // Initialize camera device selection
    initializeCameraSelection();
});

function addImageUploadButton() {
    const barcodeScanner = document.getElementById('barcodeScanner');
    if (!barcodeScanner) {
        console.error("Element with ID 'barcodeScanner' not found");
        return;
    }
    
    // Create upload button container
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'form-group';
    uploadContainer.style.marginTop = '10px';
    uploadContainer.style.textAlign = 'center';
    
    // Create the actual file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'imageUpload';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none'; // Hide the actual file input
    
    // Create a nice-looking button that triggers the file input
    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.id = 'uploadButton';
    uploadButton.className = 'btn btn-outline-secondary';
    uploadButton.innerHTML = '📁 Upload Image';
    uploadButton.style.width = '100%';
    uploadButton.style.padding = '10px';
    uploadButton.style.marginBottom = '10px';
    
    // When the button is clicked, trigger the file input
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    // When a file is selected, process it
    fileInput.addEventListener('change', handleImageUpload);
    
    // Add elements to container
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(uploadButton);
    
    // Add the upload button right after the scan button
    const scanButton = document.getElementById('scanButton');
    if (scanButton && scanButton.parentNode) {
        scanButton.parentNode.insertBefore(uploadContainer, scanButton.nextSibling);
    } else {
        // If scan button not found, add at the beginning of barcode scanner div
        barcodeScanner.insertBefore(uploadContainer, barcodeScanner.firstChild);
    }
}

async function handleImageUpload(event) {
    // Make sure we're not actively scanning
    await ensureFullStop();
    
    const file = event.target.files[0];
    if (!file) return;
    
    // Clear previous results and errors
    const resultElement = document.getElementById('scanResult');
    if (resultElement) resultElement.textContent = '';
    
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) errorDisplay.textContent = '';
    
    // Hide scan result container initially
    const scanResultContainer = document.getElementById('scanResultContainer');
    if (scanResultContainer) scanResultContainer.style.display = 'none';
    
    try {
        // Show loading state
        const uploadButton = document.getElementById('uploadButton');
        if (uploadButton) {
            uploadButton.innerHTML = '⏳ Processing...';
            uploadButton.disabled = true;
        }
        
        // Create an image element to load the file
        const img = new Image();
        
        // Create a promise to handle image loading
        const imageLoaded = new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
        });
        
        // Set the image source to the uploaded file
        img.src = URL.createObjectURL(file);
        
        // Wait for the image to load
        await imageLoaded;
        
        // Get the canvas and draw the image on it
        const qrCanvas = document.getElementById('qrCanvas');
        const canvasContext = qrCanvas.getContext('2d');
        
        // Set canvas dimensions to match image size
        qrCanvas.width = img.width;
        qrCanvas.height = img.height;
        
        // Draw image to canvas
        canvasContext.drawImage(img, 0, 0, img.width, img.height);
        
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

        // Decode the barcode
        const result = await codeReader.decodeFromImage(img, hints);

        // Handle the successful scan result
        if (result) {
            handleZXingCode(result);
        } else {
            // This shouldn't happen as an exception would be thrown instead, but just in case
            throw new Error('No barcode found in image');
        }
    } catch (error) {
        console.error('Error processing image:', error);
        
        // Check if it's a "not found" error, which is common and expected
        if (error instanceof ZXing.NotFoundException) {
            if (errorDisplay) {
                errorDisplay.textContent = 'No barcode or QR code found in the image.';
                errorDisplay.style.display = 'block';
            }
        } else {
            // For other errors
            if (errorDisplay) {
                errorDisplay.textContent = `Error processing image: ${error.message}`;
                errorDisplay.style.display = 'block';
            }
        }
    } finally {
        // Reset the file input to allow selecting the same file again
        event.target.value = '';
        
        // Reset upload button state
        const uploadButton = document.getElementById('uploadButton');
        if (uploadButton) {
            uploadButton.innerHTML = '📁 Upload Image';
            uploadButton.disabled = false;
        }
    }
}

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

// Modify the populateCameraDevices function
async function populateCameraDevices() {
    try {
        // Reset any existing code reader
        if (codeReader) {
            await codeReader.reset();
        }
        
        // Create a new code reader
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        const videoInputDevices = await codeReader.listVideoInputDevices();
        const cameraSelect = document.getElementById('cameraSelect');
        const cameraSelectPanel = document.getElementById('cameraSelectPanel');
        
        // Clear any existing options
        while (cameraSelect.firstChild) {
            cameraSelect.removeChild(cameraSelect.firstChild);
        }
        
        if (videoInputDevices && videoInputDevices.length > 0) {
            // Check if we have a saved device ID in localStorage
            let savedDeviceId = localStorage.getItem('preferredCameraId');
            
            // Check if the saved device still exists in available devices
            let deviceExists = false;
            if (savedDeviceId) {
                deviceExists = videoInputDevices.some(device => device.deviceId === savedDeviceId);
            }
            
            // Use saved device if it exists, otherwise use the back camera if possible
            if (deviceExists) {
                selectedDeviceId = savedDeviceId;
            } else {
                // Try to find back camera (usually containing "back" or "environment")
                const backCamera = videoInputDevices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('environment'));
                
                if (backCamera) {
                    selectedDeviceId = backCamera.deviceId;
                } else {
                    // Otherwise use the first device
                    selectedDeviceId = videoInputDevices[0].deviceId;
                }
            }
            
            // Add all devices to the select dropdown
            videoInputDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${cameraSelect.options.length + 1}`;
                cameraSelect.appendChild(option);
                
                // Set selected option
                if (device.deviceId === selectedDeviceId) {
                    option.selected = true;
                }
            });
            
            // Show the selection panel regardless of number of cameras
            cameraSelectPanel.style.display = 'block';
            console.log(`Found ${videoInputDevices.length} cameras, showing selection panel`);
            
            // Add change event listener to update selectedDeviceId
            cameraSelect.addEventListener('change', () => {
                selectedDeviceId = cameraSelect.value;
                // Save the selection to localStorage
                localStorage.setItem('preferredCameraId', selectedDeviceId);
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
        displayError("Error detecting cameras: " + err.message);
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
    clearResults();

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
        displayError("Error setting up scanner: " + err.message);
        isScanning = false;
        document.getElementById('scanButton').textContent = '📱 Start Scan';
    }
}

// Enhanced URL detection function
function detectURLs(text) {
    // Common web protocols
    const webProtocolsPattern = /(?:https?|ftp|data|file|smb|ldap|mailto|tel|maps|sip|xmpp|skype|spotify|steam):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+/gi;
    
    // MS Office and other application protocols
    const appProtocolsPattern = /(?:ms-(?:word|excel|powerpoint|visio|access|publisher|outlook|onenote|project)|teams|slack|zoom|msteams|zoommtg|zoomus):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+/gi;
    
    // Windows UNC paths (\\server\share\folder)
    const uncPathPattern = /\\\\[^\s"'<>\\]+(?:\\[^\s"'<>\\]+)+/gi;
    
    // Windows drive paths (C:\folder\file.txt)
    const drivePathPattern = /[A-Za-z]:\\[^\s"'<>:]+(?:\\[^\s"'<>:]+)+/gi;
    
    // Intranet sites with special TLDs
    const intranetPattern = /(?:[A-Za-z0-9][-A-Za-z0-9.]*\.[A-Za-z0-9][-A-Za-z0-9.]*(\.(?:local|corp|internal|lan|intranet|test|dev|staging|prod))(?:\/[^\s"'<>]*)?)/gi;
    
    // IP addresses (optional port)
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?\b(?:\/[^\s"'<>]*)?/gi;
    
    // Combine all patterns into results
    const results = [
        ...(text.match(webProtocolsPattern) || []),
        ...(text.match(appProtocolsPattern) || []),
        ...(text.match(uncPathPattern) || []),
        ...(text.match(drivePathPattern) || []),
        ...(text.match(intranetPattern) || []),
        ...(text.match(ipPattern) || [])
    ];
    
    return results.length > 0 ? results : null;
}

// Convert text to HTML with clickable links
function textWithLinks(text) {
    // Make a copy of the original text
    let linkedText = text;
    
    // Standard web protocols (http, https, ftp, etc.)
    linkedText = linkedText.replace(/((?:https?|ftp|data|ldap|mailto|tel|maps|sip|xmpp|skype|spotify|steam):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+)/gi, 
        url => `<a href="${url}" target="_blank" class="detected-link">${url}</a>`);
    
    // Application protocols (ms-word:, teams:, etc.)
    linkedText = linkedText.replace(/((?:ms-(?:word|excel|powerpoint|visio|access|publisher|outlook|onenote|project)|teams|slack|zoom|msteams|zoommtg|zoomus):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+)/gi, 
        url => `<a href="${url}" class="detected-link app-protocol">${url}</a>`);
    
    // Windows UNC paths
    linkedText = linkedText.replace(/(\\\\[^\s"'<>\\]+(?:\\[^\s"'<>\\]+)+)/gi, 
        path => {
            // Convert backslashes to forward slashes for file: URI
            const uriPath = path.replace(/\\/g, '/');
            return `<a href="file:${uriPath}" class="detected-link file-path" title="Network path">${path}</a>`;
        });
    
    // Windows drive paths
    linkedText = linkedText.replace(/([A-Za-z]:\\[^\s"'<>:]+(?:\\[^\s"'<>:]+)+)/gi, 
        path => {
            // Convert backslashes to forward slashes for file: URI
            const uriPath = path.replace(/\\/g, '/');
            return `<a href="file:///${uriPath}" class="detected-link file-path" title="File path">${path}</a>`;
        });
    
    // Intranet sites with special TLDs
    linkedText = linkedText.replace(/([A-Za-z0-9][-A-Za-z0-9.]*\.[A-Za-z0-9][-A-Za-z0-9.]*(\.(?:local|corp|internal|lan|intranet|test|dev|staging|prod))(?:\/[^\s"'<>]*)?)/gi, 
        url => {
            // Add https if protocol is missing
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            return `<a href="${fullUrl}" target="_blank" class="detected-link intranet-link" title="Intranet link">${url}</a>`;
        });
    
    // IP addresses (with optional port)
    linkedText = linkedText.replace(/\b((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?)(\b(?:\/[^\s"'<>]*)?)/gi, 
        (match, ip, path) => {
            const fullUrl = `http://${match}`;
            return `<a href="${fullUrl}" target="_blank" class="detected-link ip-link" title="IP address link">${match}</a>`;
        });
    
    return linkedText;
}

// Add copy button next to links
function createCopyButton(textToCopy) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-link-btn';
    button.title = 'Copy to clipboard';
    button.innerHTML = '📋'; // Clipboard icon
    button.style.marginLeft = '5px';
    button.style.fontSize = '0.8em';
    button.style.padding = '2px 5px';
    button.style.background = '#f0f0f0';
    button.style.border = '1px solid #ddd';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                // Change button text temporarily
                const originalHTML = button.innerHTML;
                button.innerHTML = '✓';
                button.style.background = '#d4edda';
                button.style.borderColor = '#c3e6cb';
                
                // Reset after 1.5 seconds
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.background = '#f0f0f0';
                    button.style.borderColor = '#ddd';
                }, 1500);
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                button.innerHTML = '❌';
                button.style.background = '#f8d7da';
                button.style.borderColor = '#f5c6cb';
                
                setTimeout(() => {
                    button.innerHTML = '📋';
                    button.style.background = '#f0f0f0';
                    button.style.borderColor = '#ddd';
                }, 1500);
            });
    });
    
    return button;
}

// Process HTML content to add copy buttons after links
function addCopyButtonsToLinks(containerElement) {
    // Find all links in the container
    const links = containerElement.querySelectorAll('a.detected-link');
    
    links.forEach(link => {
        // Avoid adding multiple copy buttons
        if (!link.nextSibling || !link.nextSibling.classList || !link.nextSibling.classList.contains('copy-link-btn')) {
            const copyButton = createCopyButton(link.getAttribute('href'));
            link.parentNode.insertBefore(copyButton, link.nextSibling);
        }
    });
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

    // Convert format number to a readable name
    const formatNumber = result.getBarcodeFormat ? result.getBarcodeFormat() : result.format;
    const scanFormat = getBarcodeFormatName(formatNumber);
    const scanTime = new Date().toLocaleTimeString();
    
    // Add to history
    addToScanHistory(scanText, scanFormat, scanTime);
    
    // Update the scan result
    const scanResult = document.getElementById('scanResult');
    if (scanResult) {
        // Check if the scanned text contains a URL or path
        const hasLinkableContent = detectURLs(scanText);
        
        if (hasLinkableContent) {
            // Create a container to hold both the text and potential copy buttons
            scanResult.innerHTML = `<div class="result-text">Result: ${textWithLinks(scanText)} (Format: ${scanFormat})</div>`;
            
            // Add copy buttons to all detected links
            addCopyButtonsToLinks(scanResult);
            
            // Add CSS for detected links
            addLinkStyles();
        } else {
            // Otherwise, show as plain text
            scanResult.textContent = `Result: ${scanText} (Format: ${scanFormat})`;
        }
    }
    
    // Show the scan result container
    const scanResultContainer = document.getElementById('scanResultContainer');
    if (scanResultContainer) {
        scanResultContainer.style.display = 'block';
    }
    
    stopScan();
}

// Add CSS styles for detected links
function addLinkStyles() {
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

function addToScanHistory(text, format, time) {
    // Add to memory
    scanHistory.unshift({ text, format, time });
    if (scanHistory.length > 10) scanHistory.pop(); // Keep last 10
    
    // Update UI
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    scanHistory.forEach((scan, index) => {
        const item = document.createElement('div');
        item.className = 'form-group scan-history-item';
        item.style.padding = '8px';
        item.style.marginBottom = '8px';
        item.style.borderBottom = index < scanHistory.length - 1 ? '1px solid #eee' : 'none';
        
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
        content.className = 'scan-content';
        content.style.wordBreak = 'break-all';
        
        // Check if scan text contains a URL or file path
        const hasLinkableContent = detectURLs(scan.text);
        if (hasLinkableContent) {
            // Use innerHTML to render the links
            content.innerHTML = textWithLinks(scan.text);
            
            // Add copy buttons to links
            addCopyButtonsToLinks(content);
        } else {
            content.textContent = scan.text;
        }
        
        item.appendChild(header);
        item.appendChild(content);
        historyList.appendChild(item);
    });
    
    // Add link styles if needed
    addLinkStyles();
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

// Add this new function to convert format numbers to readable names
function getBarcodeFormatName(formatNumber) {
    const formatNames = {
        0: "AZTEC",
        1: "CODABAR",
        2: "CODE_39",
        3: "CODE_93",
        4: "CODE_128",
        5: "DATA_MATRIX",
        6: "EAN_8",
        7: "EAN_13",
        8: "ITF",
        9: "MAXICODE",
        10: "PDF_417",
        11: "QR_CODE",
        12: "RSS_14",
        13: "RSS_EXPANDED",
        14: "UPC_A",
        15: "UPC_E",
        16: "UPC_EAN_EXTENSION"
    };
    
    return formatNames[formatNumber] || `Unknown (${formatNumber})`;
}

// Add helper function to display errors in the UI
function displayError(message) {
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        errorDisplay.style.backgroundColor = '#ffeeee';
        errorDisplay.style.padding = '10px';
        errorDisplay.style.marginTop = '10px';
        errorDisplay.style.border = '1px solid #ffcccc';
        errorDisplay.style.borderRadius = '4px';
    }
}

// Add helper function to clear results and errors
function clearResults() {
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