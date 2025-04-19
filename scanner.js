// Global variables for scanner
let videoStream;
let isScanning = false;
let scanningTimeout;
let codeReader;
let drawingInterval;
let scanHistory = [];
let resetInProgress = false;

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
    document.getElementById('scanResult').textContent = '';
    document.getElementById('errorDisplay').textContent = '';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        videoStream = stream;
        const videoElement = document.getElementById('video');
        
        // Make sure the video element is ready for a new stream
        videoElement.srcObject = null;
        videoElement.load();
        
        // Set up new stream
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', true);
        
        // Use a promise to ensure video is loaded before proceeding
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
        
        try {
            await videoElement.play();
            const qrCanvas = document.getElementById('qrCanvas');
            qrCanvas.width = videoElement.videoWidth;
            qrCanvas.height = videoElement.videoHeight;
            showVideoOnCanvas();
            startDecoding();
        } catch (playError) {
            console.error("Error playing video:", playError);
            document.getElementById('errorDisplay').textContent = "Error playing video: " + playError.message;
            stopScan();
        }
    } catch (err) {
        console.error("Error accessing the camera:", err);
        document.getElementById('errorDisplay').textContent = "Error accessing camera: " + err.message;
        isScanning = false;
        document.getElementById('scanButton').textContent = '📱 Start Scan';
    }
}

function showVideoOnCanvas() {
    const qrCanvas = document.getElementById('qrCanvas');
    const canvasContext = qrCanvas.getContext('2d');
    const videoElement = document.getElementById('video');
    
    clearInterval(drawingInterval);
    drawingInterval = setInterval(() => {
        if (!isScanning) {
            clearInterval(drawingInterval);
            return;
        }
        if (videoElement.readyState >= 2) {
            try {
                canvasContext.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
                canvasContext.drawImage(videoElement, 0, 0, qrCanvas.width, qrCanvas.height);
            } catch (error) {
                console.error("Error drawing video to canvas:", error);
                document.getElementById('errorDisplay').textContent = "Error drawing video to canvas. Please refresh the page and try again.";
                stopScan();
                clearInterval(drawingInterval);
                return;
            }
        }
    }, 100);
}

function startDecoding() {
    if (!isScanning) return;
    
    try {
        // Get selected formats
        const selectedFormats = getSelectedFormats();
        
        // Always recreate codeReader with updated format hints
        if (codeReader) {
            codeReader.reset();
        }
        
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, selectedFormats);
        codeReader = new ZXing.BrowserMultiFormatReader(hints);

        // Add a small delay before starting decoding
        setTimeout(() => {
            if (!isScanning) return;
            
            const videoElement = document.getElementById('video');
            codeReader.decodeFromVideoElement(videoElement)
                .then(result => {
                    if (result) {
                        handleZXingCode(result);
                    }
                })
                .catch(err => {
                    if (err instanceof ZXing.NotFoundException) {
                        // Barcode not found, continue scanning
                        scanningTimeout = requestAnimationFrame(startDecoding);
                    } else {
                        console.error("Error decoding barcode:", err);
                        document.getElementById('errorDisplay').textContent = `Error decoding barcode: ${err.message}`;
                        stopScan();
                    }
                });
        }, 300);
    } catch (error) {
        console.error("Error during decoding:", error);
        document.getElementById('errorDisplay').textContent = "Error during decoding: " + error.message;
        stopScan();
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
    
    document.getElementById('scanResult').textContent = `Result: ${scanText} (Format: ${scanFormat})`;
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
    
    // Clean up video element properly
    const videoElement = document.getElementById('video');
    if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
    }
    
    // Stop all media tracks
    if (videoStream) {
        videoStream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
                track.stop();
            }
        });
        videoStream = null;
    }
    
    // Reset ZXing reader if it exists
    if (codeReader) {
        try {
            codeReader.reset();
            // Give a small delay before considering the reset complete
            setTimeout(() => {
                codeReader = null;
                resetInProgress = false;
                if (callback) callback();
            }, 300);
        } catch (error) {
            console.error("Error resetting code reader:", error);
            codeReader = null;
            resetInProgress = false;
            if (callback) callback();
        }
    } else {
        resetInProgress = false;
        if (callback) callback();
    }
}