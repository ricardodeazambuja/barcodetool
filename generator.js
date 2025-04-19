// Global variables for generator
let selectedLogo = null;
let inputValues = {};

function updateBarcodeOptionsVisibility() {
    const barcodeType = document.getElementById('barcodeType').value;
    const qrOptionsGroup = document.getElementById('qrOptionsGroup');
    const pdf417OptionsGroup = document.getElementById('pdf417OptionsGroup');
    const logoGroup = document.getElementById('logoGroup');

    // Hide all specific option groups initially
    qrOptionsGroup.classList.add('hidden');
    pdf417OptionsGroup.classList.add('hidden');
    logoGroup.classList.add('hidden');

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
    } else if (barcodeType === 'pdf417') {
        pdf417OptionsGroup.classList.remove('hidden');
    }
    
    // Also update the dynamic form based on content type
    updateForm();
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
        fields = [
            { label: 'Text or URL:', id: 'plainText', type: 'text' }
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
    const bcid = document.getElementById('barcodeType').value;
    const text = generateContentString();
    if (!text) return; // Stop if content string generation failed
    const format = document.getElementById('outputFormat').value;
    const scale = parseInt(document.getElementById('scale').value);
    const padding = parseInt(document.getElementById('padding').value);
    const includetext = document.getElementById('includetext').value === 'true';
    const eclevel = document.getElementById('eclevel').value;
    const securitylevel = parseInt(document.getElementById('securitylevel').value);

    const outputDiv = document.getElementById('barcodeOutput');
    outputDiv.innerHTML = '<p>Generating...</p>'; // Initial feedback
    clearError(); // Clear any previous error message

    const options = { bcid, text, scale, padding };
    if (includetext) options.alttext = text;
    if (bcid === 'qrcode') options.eclevel = eclevel;
    if (bcid === 'pdf417') options.eclevel = securitylevel;

    try {
        if (format === 'canvas') {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.marginLeft = 'auto';
            canvas.style.marginRight = 'auto';
           
            // Generate barcode on canvas
            try {
                await bwipjs.toCanvas(canvas, options);
            } catch (canvasErr) {
                console.error('Canvas generation error:', canvasErr);
                displayError(`Canvas generation error: ${canvasErr.message}`);
                return;
            }
            
            // If we have a logo and this is a QR code, overlay it
            if (selectedLogo && bcid === 'qrcode') {
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
            outputDiv.appendChild(canvas);
            
            // Add download link
            const downloadLink = document.createElement('a');
            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = `${bcid}_barcode.png`;
            downloadLink.textContent = 'Download PNG Image';
            downloadLink.style.display = 'block';
            downloadLink.style.marginTop = '10px';
            outputDiv.appendChild(downloadLink);
            
        } else { // SVG Output
            try {
                let svg = bwipjs.toSVG(options);
                
                // If we have a logo, we need to handle it specially for SVG
                if (selectedLogo && bcid === 'qrcode') {
                    try {
                        svg = await addLogoToSvg(svg);
                    } catch (logoErr) {
                        console.error('SVG logo processing error:', logoErr);
                        displayError(`Error overlaying logo: ${logoErr.message}`);
                        return;
                    }
                }
                
                outputDiv.innerHTML = ''; // Clear previous content
                outputDiv.innerHTML = svg;
                
                // Provide download option for SVG
                const svgBlob = new Blob([svg], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(svgBlob);
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `${bcid}_barcode.svg`;
                downloadLink.textContent = 'Download SVG Image';
                downloadLink.style.display = 'block';
                downloadLink.style.marginTop = '10px';
                outputDiv.appendChild(downloadLink);
            } catch (err) {
                console.error('SVG Error:', err);
                displayError(`Error generating SVG: ${err}`);
            }
        }
    } catch (err) {
        console.error('Generation Error:', err);
        displayError(`Error generating barcode: ${err.message}`);
    }
}

// Fix for the overlayLogo function
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

// Fix for the addLogoToSvg function
async function addLogoToSvg(svgString) {
    if (!selectedLogo) return svgString;
    
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
                const logoSize = 100; // Fixed size for logo in SVG
                
                canvas.width = logoSize;
                canvas.height = logoSize;
                
                // Draw the logo on canvas
                ctx.drawImage(selectedLogo, 0, 0, logoSize, logoSize);
                
                // Get data URL
                const logoDataUrl = canvas.toDataURL('image/png');
                
                // Parse the original SVG
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
                let defs = svgDoc.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    svgElement.prepend(defs);
                }
                
                // Add clipPath
                const clipPathId = 'logoClip' + Date.now(); // Ensure unique ID
                const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                clipPath.setAttribute('id', clipPathId);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', logoSize / 2);
                circle.setAttribute('cy', logoSize / 2);
                circle.setAttribute('r', logoSize / 2);
                
                clipPath.appendChild(circle);
                defs.appendChild(clipPath);
                
                // Create group for logo elements
                const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                logoGroup.setAttribute('transform', `translate(${logoX}, ${logoY})`);
                
                // Add white background circle
                const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                bgCircle.setAttribute('cx', logoSize / 2);
                bgCircle.setAttribute('cy', logoSize / 2);
                bgCircle.setAttribute('r', logoSize / 2);
                bgCircle.setAttribute('fill', 'white');
                
                // Create image element for logo
                const logoImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
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
                const modifiedSvgString = serializer.serializeToString(svgDoc);
                
                resolve(modifiedSvgString);
            } catch (err) {
                console.error('SVG logo processing error:', err);
                reject(err);
            }
        }
    });
}