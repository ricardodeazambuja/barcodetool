// Global variables for generator
let selectedLogo = null;
let inputValues = {};

function updateBarcodeOptionsVisibility() {
    const barcodeType = document.getElementById('barcodeType').value;
    const qrOptionsGroup = document.getElementById('qrOptionsGroup');
    const pdf417OptionsGroup = document.getElementById('pdf417OptionsGroup');
    const logoGroup = document.getElementById('logoGroup');
    const oneDOptionsGroup = document.getElementById('oneDOptionsGroup');
    const contentTypeSelect = document.getElementById('contentType');

    // Hide all specific option groups initially
    qrOptionsGroup.classList.add('hidden');
    pdf417OptionsGroup.classList.add('hidden');
    logoGroup.classList.add('hidden');
    oneDOptionsGroup.classList.add('hidden');

    // Check if selected barcode type is a 1D barcode
    const is1DBarcode = ['ean13', 'ean8', 'upca', 'upce', 'code39', 'code128', 
                        'interleaved2of5', 'codabar'].includes(barcodeType);

    // Show options based on selected type
    if (barcodeType === 'qrcode') {
        qrOptionsGroup.classList.remove('hidden');
        logoGroup.classList.remove('hidden');
        
        // Set higher error correction level if logo is present
        if (selectedLogo) {
            const eclevelSelect = document.getElementById('eclevel');
            // If current value is L or M, change to H
            if (eclevelSelect.value === 'L' || eclevelSelect.value === 'M') {
                eclevelSelect.value = 'H';
            }
        }

        // Enable all content types for QR code
        enableAllContentTypes(contentTypeSelect);
    } else if (barcodeType === 'pdf417') {
        pdf417OptionsGroup.classList.remove('hidden');
        // Enable all content types for PDF417
        enableAllContentTypes(contentTypeSelect);
    } else if (is1DBarcode) {
        // Show 1D specific options for 1D barcodes
        oneDOptionsGroup.classList.remove('hidden');
        // For 1D barcodes, restrict to text only
        restrictToTextOnly(contentTypeSelect);
    } else {
        // For other 2D barcodes like datamatrix, azteccode
        enableAllContentTypes(contentTypeSelect);
    }
    
    // Also update the dynamic form based on content type
    updateForm();
}

// Helper function to enable all content types
function enableAllContentTypes(selectElement) {
    // Make sure all options are available
    const options = selectElement.options;
    for (let i = 0; i < options.length; i++) {
        options[i].disabled = false;
    }
}

// Helper function to restrict to text-only content type
function restrictToTextOnly(selectElement) {
    // First, set to "text" if it's not already
    if (selectElement.value !== 'text') {
        selectElement.value = 'text';
        // Store this as the current input value
        inputValues['contentType'] = 'text';
    }
    
    // Then disable all non-text options
    const options = selectElement.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value !== 'text') {
            options[i].disabled = true;
        } else {
            options[i].disabled = false;
        }
    }
}

function updateForm() {
    const type = document.getElementById('contentType').value;
    const container = document.getElementById('inputContainer');
    container.innerHTML = ''; // Clear previous fields

    let fields = [];
    if (type === 'wifi') {
        fields = [
            { label: 'SSID:', id: 'wifiSsid', type: 'text' },
            { label: 'Password:', id: 'wifiPass', type: 'text' },
            { label: 'Encryption:', id: 'wifiEnc', type: 'select', options: [
                { value: 'WPA', text: 'WPA/WPA2'},
                { value: 'WEP', text: 'WEP'},
                { value: 'nopass', text: 'None'}
            ]}
        ];
    } else if (type === 'vcard') {
        fields = [
            { label: 'First Name:', id: 'vcFirst', type: 'text' },
            { label: 'Last Name:', id: 'vcLast', type: 'text' },
            { label: 'Phone:', id: 'vcTel', type: 'tel' },
            { label: 'Email:', id: 'vcEmail', type: 'email' },
            { label: 'Organization:', id: 'vcOrg', type: 'text' }
        ];
    } else if (type === 'email') {
        fields = [
            { label: 'To:', id: 'emailTo', type: 'email' },
            { label: 'Subject:', id: 'emailSubject', type: 'text' },
            { label: 'Body:', id: 'emailBody', type: 'textarea' }
        ];
    } else if (type === 'geo') {
        fields = [
            { label: 'Latitude:', id: 'geoLat', type: 'text' },
            { label: 'Longitude:', id: 'geoLng', type: 'text' }
        ];
    } else { // Default to text/url
        // Get the barcode type to determine what kind of input is needed
        const barcodeType = document.getElementById('barcodeType').value;
        
        // Add specific input requirements for 1D barcodes
        let inputType = 'text';
        let placeholder = '';
        let pattern = '';
        
        if (['ean13', 'ean8', 'upca', 'upce', 'interleaved2of5'].includes(barcodeType)) {
            inputType = 'number';
            
            // Set specific placeholder based on barcode type
            if (barcodeType === 'ean13') {
                placeholder = 'Enter exactly 12 digits';
                pattern = '[0-9]{12}';
            } else if (barcodeType === 'ean8') {
                placeholder = 'Enter exactly 7 digits';
                pattern = '[0-9]{7}';
            } else if (barcodeType === 'upca') {
                placeholder = 'Enter exactly 11 digits';
                pattern = '[0-9]{11}';
            } else if (barcodeType === 'upce') {
                placeholder = 'Enter exactly 6 digits';
                pattern = '[0-9]{6}';
            } else if (barcodeType === 'interleaved2of5') {
                placeholder = 'Enter even number of digits';
                pattern = '[0-9]*[02468]$'; // Ensures even number of digits
            }
        }
        
        fields = [
            { 
                label: 'Text or URL:', 
                id: 'plainText', 
                type: inputType,
                placeholder: placeholder,
                pattern: pattern
            }
        ];
    }

    fields.forEach(field => {
        const label = document.createElement('label');
        label.htmlFor = field.id;
        label.textContent = field.label;
        container.appendChild(label);

        let input;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
        } else if (field.type === 'select') {
            input = document.createElement('select');
            field.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type;
            if (field.placeholder) {
                input.placeholder = field.placeholder;
            }
            if (field.pattern) {
                input.pattern = field.pattern;
            }
        }
        input.id = field.id;
        input.value = inputValues[field.id] || ''; // Retain value
        input.addEventListener('change', (e) => {
            inputValues[e.target.id] = e.target.value; // Store value on change
        });
        container.appendChild(input);
        container.appendChild(document.createElement('br')); // Add space
    });
}

function generateContentString() {
    const type = document.getElementById('contentType').value;
    try {
        let result = '';
        if (type === 'wifi') {
            const ssid = document.getElementById('wifiSsid').value;
            const pass = document.getElementById('wifiPass').value;
            const enc = document.getElementById('wifiEnc').value;
            // Basic escaping for special characters in WIFI string
            const escape = (s) => s.replace(/([\\;,"'])/g, '\\$1');
            result = `WIFI:S:${escape(ssid)};T:${escape(enc)};P:${escape(pass)};;`;
        } else if (type === 'vcard') {
            const first = document.getElementById('vcFirst').value;
            const last = document.getElementById('vcLast').value;
            const tel = document.getElementById('vcTel').value;
            const email = document.getElementById('vcEmail').value;
            const org = document.getElementById('vcOrg').value;
            result = `BEGIN:VCARD\nVERSION:3.0\nN:${last};${first}\nFN:${first} ${last}\nORG:${org}\nTEL:${tel}\nEMAIL:${email}\nEND:VCARD`;
        } else if (type === 'email') {
            const to = document.getElementById('emailTo').value;
            const subject = encodeURIComponent(document.getElementById('emailSubject').value);
            const body = encodeURIComponent(document.getElementById('emailBody').value);
            result = `mailto:${to}?subject=${subject}&body=${body}`;
        } else if (type === 'geo') {
            const lat = document.getElementById('geoLat').value;
            const lng = document.getElementById('geoLng').value;
            result = `geo:${lat},${lng}`;
        } else {
            result = document.getElementById('plainText').value;
            
            // Validate input for specific barcode types
            const barcodeType = document.getElementById('barcodeType').value;
            if (barcodeType === 'ean13' && !/^\d{12}$/.test(result)) {
                throw new Error("EAN-13 requires exactly 12 digits");
            } else if (barcodeType === 'ean8' && !/^\d{7}$/.test(result)) {
                throw new Error("EAN-8 requires exactly 7 digits");
            } else if (barcodeType === 'upca' && !/^\d{11}$/.test(result)) {
                throw new Error("UPC-A requires exactly 11 digits");
            } else if (barcodeType === 'upce' && !/^\d{6}$/.test(result)) {
                throw new Error("UPC-E requires exactly 6 digits");
            } else if (barcodeType === 'interleaved2of5' && result.length % 2 !== 0) {
                throw new Error("ITF requires an even number of digits");
            }
        }
        if (!result) {
            throw new Error("Input is required");
        }
        return result;
    } catch (e) {
        console.error("Error generating content string:", e);
        displayError(`Could not generate content. Check input fields. Error: ${e.message}`);
        return null; // Indicate failure
    }
}

function displayError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    // Clear output
    const outputDiv = document.getElementById('barcodeOutput');
    outputDiv.innerHTML = '<p>Generation failed.</p>';
}

function clearError() {
    document.getElementById('errorMessage').textContent = '';
}

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Update the preview
        const logoPreview = document.getElementById('logoPreview');
        logoPreview.src = e.target.result;
        logoPreview.style.display = 'block';
        
        // Store the logo data
        selectedLogo = new Image();
        selectedLogo.src = e.target.result;
        
        // Show remove button
        document.getElementById('removeLogo').style.display = 'block';
        
        // Recommend high error correction
        if (document.getElementById('barcodeType').value === 'qrcode') {
            document.getElementById('eclevel').value = 'H';
        }
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    // Clear the preview and data
    const logoPreview = document.getElementById('logoPreview');
    logoPreview.src = '#';
    logoPreview.style.display = 'none';
    selectedLogo = null;
    
    // Hide remove button
    document.getElementById('removeLogo').style.display = 'none';
    
    // Reset the file input
    document.getElementById('logoUpload').value = '';
}

async function generateBarcode() {
    const format = document.getElementById('barcodeType').value;
    const text = generateContentString();
    if (!text) return; // Stop if content string generation failed
    
    const outputFormat = document.getElementById('outputFormat').value;
    const padding = parseInt(document.getElementById('padding').value);
    const includeText = document.getElementById('includetext').value === 'true';
    
    let errorCorrectionLevel = null;
    if (format === 'qrcode') {
        errorCorrectionLevel = document.getElementById('eclevel').value;
        console.log("errorCorrectionLevel: ",errorCorrectionLevel);
    } else if (format === 'pdf417') {
        errorCorrectionLevel = parseInt(document.getElementById('securitylevel').value);
    }

    const outputDiv = document.getElementById('barcodeOutput');
    outputDiv.innerHTML = '<p>Generating...</p>'; // Initial feedback
    clearError(); // Clear any previous error message

    try {
        // Configure options for bwip-js
        const options = {
            bcid: format,         // Barcode type
            text: text,           // Text to encode
            textxalign: 'center', // Align text
            backgroundcolor: 'FFFFFF'
        };

        if (includeText) options.alttext = text;

        // Add barcode-specific options
        if (format === 'qrcode') {
            options.eclevel = errorCorrectionLevel;
        } else if (format === 'pdf417') {
            options.columns = 6;  // Default number of columns
            options.eclevel = errorCorrectionLevel;
        }
        
        // Add padding option
        options.paddingwidth = padding;
        options.paddingheight = padding;
        
        if (outputFormat === 'canvas') {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            
            // Use bwip-js to render the barcode to the canvas
            try {
                bwipjs.toCanvas(canvas, options);
                
                // Resize canvas if needed
                if (canvas.width !== outputDiv.clientWidth) {
                    // Resize the canvas and preserve content
                    resizeCanvasToFitContainer(canvas, outputDiv);
                }
                
                // If we have a logo and this is a QR code, overlay it
                if (selectedLogo && format === 'qrcode') {
                    try {
                        await overlayLogo(canvas);
                    } catch (logoErr) {
                        console.error('Logo overlay error:', logoErr);
                        displayError(`Error overlaying logo: ${logoErr.message}`);
                        return;
                    }
                }
                
                // Display the result
                outputDiv.innerHTML = ''; // Clear the "Generating..." message
                canvas.style.display = 'block';
                canvas.style.marginLeft = 'auto';
                canvas.style.marginRight = 'auto';
                outputDiv.appendChild(canvas);
                
                // Add download link
                const downloadLink = document.createElement('a');
                downloadLink.href = canvas.toDataURL('image/png');
                downloadLink.download = `${format}_barcode.png`;
                downloadLink.textContent = 'Download PNG Image';
                downloadLink.style.display = 'block';
                downloadLink.style.marginTop = '10px';
                outputDiv.appendChild(downloadLink);
            } catch (err) {
                console.error('BWIP-JS Canvas Error:', err);
                displayError(`Error generating barcode: ${err.message}`);
            }
        } else { // SVG Output
            try {
                // Get SVG from bwip-js
                let svgString = bwipjs.toSVG(options);
                                
                // If we have a logo and this is a QR code, add it to SVG
                if (selectedLogo && format === 'qrcode') {
                    try {
                        svgString = await addLogoToSvg(svgString);
                    } catch (logoErr) {
                        console.error('SVG logo processing error:', logoErr);
                        displayError(`Error overlaying logo: ${logoErr.message}`);
                        return;
                    }
                }
                
                outputDiv.innerHTML = ''; // Clear previous content
                outputDiv.innerHTML = svgString;
                
                // Provide download option for SVG
                const svgBlob = new Blob([svgString], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(svgBlob);
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `${format}_barcode.svg`;
                downloadLink.textContent = 'Download SVG Image';
                downloadLink.style.display = 'block';
                downloadLink.style.marginTop = '10px';
                outputDiv.appendChild(downloadLink);
            } catch (err) {
                console.error('SVG Error:', err);
                displayError(`Error generating SVG: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Generation Error:', err);
        displayError(`Error generating barcode: ${err.message}`);
    }
}

// Function to overlay logo on canvas QR code
async function overlayLogo(canvas) {
    if (!selectedLogo) return;
    
    return new Promise((resolve, reject) => {
        // Make sure the logo is loaded fully
        if (!selectedLogo.complete) {
            selectedLogo.onload = () => {
                try {
                    applyLogoOverlay();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            selectedLogo.onerror = () => reject(new Error("Failed to load logo image"));
        } else {
            try {
                applyLogoOverlay();
                resolve();
            } catch (err) {
                reject(err);
            }
        }
        
        function applyLogoOverlay() {
            const ctx = canvas.getContext('2d');
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            // Calculate size for logo (25% of QR code size)
            const logoSize = Math.min(canvasWidth, canvasHeight) * 0.25;
            
            // Calculate position (center)
            const logoX = (canvasWidth - logoSize) / 2;
            const logoY = (canvasHeight - logoSize) / 2;
            
            // Create a circle clipping path for the logo
            ctx.save();
            ctx.beginPath();
            const centerX = logoX + logoSize / 2;
            const centerY = logoY + logoSize / 2;
            ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            
            // Draw white background behind logo for better visibility
            ctx.fillStyle = 'white';
            ctx.fillRect(logoX, logoY, logoSize, logoSize);
            
            // Draw the logo - ensure it's fully loaded
            ctx.drawImage(selectedLogo, logoX, logoY, logoSize, logoSize);
            
            // Restore the context
            ctx.restore();
        }
    });
}

// Function to add logo to SVG QR code
async function addLogoToSvg(svgString) {
    
    return new Promise((resolve, reject) => {
        // Make sure the logo is fully loaded
        if (!selectedLogo.complete) {
            selectedLogo.onload = () => processLogoForSvg();
            selectedLogo.onerror = () => reject(new Error("Failed to load logo image"));
        } else {
            processLogoForSvg();
        }
        
        function processLogoForSvg() {
            try {
                // Create a temporary canvas to get logo as data URL
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                
                // Calculate size for logo (25% of QR code size)
                const logoSize = Math.min(canvasWidth, canvasHeight) * 0.25;
                
                
                canvas.width = logoSize;
                canvas.height = logoSize;
                
                // Draw the logo on canvas
                ctx.drawImage(selectedLogo, 0, 0, logoSize, logoSize);
                
                // Get data URL
                const logoDataUrl = canvas.toDataURL('image/png');

                // Parse the SVG string to a DOM
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;
                
                // Get SVG dimensions
                const viewBox = svgElement.getAttribute('viewBox')?.split(' ') || [];
                const svgWidth = svgElement.getAttribute('width') || (viewBox[2] || 200);
                const svgHeight = svgElement.getAttribute('height') || (viewBox[3] || 200);                

                // Calculate position for logo (center)
                const logoX = (parseInt(svgWidth) - logoSize) / 2;
                const logoY = (parseInt(svgHeight) - logoSize) / 2;
                
                // Create defs element if not exists
                const svgNS = "http://www.w3.org/2000/svg";
                let defs = svgElement.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS(svgNS, 'defs');
                    svgElement.prepend(defs);
                }
                
                // Add clipPath
                const clipPathId = 'logoClip' + Date.now(); // Ensure unique ID
                const clipPath = document.createElementNS(svgNS, 'clipPath');
                clipPath.setAttribute('id', clipPathId);
                
                const circle = document.createElementNS(svgNS, 'circle');
                circle.setAttribute('cx', logoSize / 2);
                circle.setAttribute('cy', logoSize / 2);
                circle.setAttribute('r', logoSize / 2);
                
                clipPath.appendChild(circle);
                defs.appendChild(clipPath);
                
                // Create group for logo elements
                const logoGroup = document.createElementNS(svgNS, 'g');
                logoGroup.setAttribute('transform', `translate(${logoX}, ${logoY})`);
                
                // Add white background circle
                const bgCircle = document.createElementNS(svgNS, 'circle');
                bgCircle.setAttribute('cx', logoSize / 2);
                bgCircle.setAttribute('cy', logoSize / 2);
                bgCircle.setAttribute('r', logoSize / 2);
                bgCircle.setAttribute('fill', 'white');
                
                // Create image element for logo
                const logoImage = document.createElementNS(svgNS, 'image');
                logoImage.setAttribute('x', 0);
                logoImage.setAttribute('y', 0);
                logoImage.setAttribute('width', logoSize);
                logoImage.setAttribute('height', logoSize);
                logoImage.setAttribute('href', logoDataUrl);
                logoImage.setAttribute('clip-path', `url(#${clipPathId})`);
                
                // Add to group then to SVG
                logoGroup.appendChild(bgCircle);
                logoGroup.appendChild(logoImage);
                svgElement.appendChild(logoGroup);

                // Serialize back to string
                const serializer = new XMLSerializer();
                const modifiedSvgString = serializer.serializeToString(svgElement);
                resolve(modifiedSvgString);
            } catch (err) {
                console.error('SVG logo processing error:', err);
                reject(err);
            }
        }
    });
}


function convertSvgToCanvas(svg, canvas) {
    return new Promise((resolve, reject) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Could not get canvas context.'));
            return;
        }

        const svgString = typeof svg === 'string' ? svg : new XMLSerializer().serializeToString(svg);
        const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(svgString);

        const img = new Image();

        img.onload = function() {
            // Set canvas dimensions to match the SVG or desired size
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the SVG image onto the canvas
            ctx.drawImage(img, 0, 0);
            resolve();
        };

        img.onerror = function(error) {
            reject(new Error('Error loading SVG image: ' + error));
        };

        img.src = svgDataUrl;
    });
}


/**
 * Resizes a canvas to fit its container's clientWidth while maintaining aspect ratio,
 * preserving and scaling the original canvas content.
 * @param {HTMLCanvasElement} canvas - The target canvas element with existing content.
 * @param {HTMLElement} container - The container element (e.g., a div).
 */
function resizeCanvasToFitContainer(canvas, container) {
    // Get the original dimensions of the canvas from its attributes
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    // If canvas has no dimensions set, use client dimensions as original
    // This might not preserve aspect ratio accurately if CSS is distorting it
    const initialWidth = originalWidth > 0 ? originalWidth : canvas.clientWidth;
    const initialHeight = originalHeight > 0 ? originalHeight : canvas.clientHeight;


    // Calculate the original aspect ratio
    const aspectRatio = initialWidth / initialHeight;

    // Get the client width of the container
    const containerClientWidth = container.clientWidth;

    // Calculate the new height based on the container's width and the original aspect ratio
    const newHeight = containerClientWidth / aspectRatio;

    // Get the current image data from the canvas BEFORE resizing
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context.');
        return;
    }
    const originalImageData = ctx.getImageData(0, 0, originalWidth, originalHeight);


    // Set the canvas's width and height attributes to the new dimensions
    canvas.width = containerClientWidth;
    canvas.height = newHeight;

    // Get the new drawing context for the resized canvas
    const newCtx = canvas.getContext('2d');
     if (!newCtx) {
        console.error('Could not get new canvas context.');
        return;
    }

    // Create a temporary canvas to hold the original image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    const tempCtx = tempCanvas.getContext('2d');
     if (!tempCtx) {
        console.error('Could not get temporary canvas context.');
        return;
    }


    // Put the original image data onto the temporary canvas
    tempCtx.putImageData(originalImageData, 0, 0);

    // Draw the content of the temporary canvas onto the resized main canvas, scaling it
    newCtx.drawImage(tempCanvas, 0, 0, originalWidth, originalHeight, 0, 0, containerClientWidth, newHeight);

    // The temporary canvas is no longer needed and will be garbage collected
}