/**
 * BarcodeGenerator class - Handles all barcode generation functionality
 */
import { displayError, clearError, ErrorHandler } from './ui.js';
import { stateManager } from './state.js';

export class BarcodeGenerator {
  constructor() {
    this.initializeEventListeners();
    this.initializeUI();
  }

  /**
   * Initialize event listeners for the generator
   */
  initializeEventListeners() {
    // Barcode type change
    document.getElementById('barcodeType').addEventListener('change', () => {
      this.updateBarcodeOptionsVisibility();
    });

    // Content type change
    document.getElementById('contentType').addEventListener('change', () => {
      this.updateForm();
    });

    // Logo upload
    document.getElementById('logoUpload').addEventListener('change', (e) => {
      this.handleLogoUpload(e);
    });

    // Generate button click
    document.getElementById('generateBarcodeBtn').addEventListener('click', () => {
      this.generateBarcode();
    });

    // Remove logo button click
    document.getElementById('removeLogoBtn').addEventListener('click', () => {
      this.removeLogo();
    });
  }

  /**
   * Initialize UI elements
   */
  initializeUI() {
    // Set initial form state
    this.updateBarcodeOptionsVisibility();
    this.updateForm();
  }

  /**
   * Update barcode options visibility based on selected type
   */
  updateBarcodeOptionsVisibility() {
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
    const is1DBarcode = [
      'ean13',
      'ean8',
      'upca',
      'upce',
      'code39',
      'code128',
      'interleaved2of5',
      'codabar',
    ].includes(barcodeType);

    // Show options based on selected type
    if (barcodeType === 'qrcode') {
      qrOptionsGroup.classList.remove('hidden');
      logoGroup.classList.remove('hidden');

      // Set higher error correction level if logo is present
      if (stateManager.get('generator.selectedLogo')) {
        const eclevelSelect = document.getElementById('eclevel');
        // If current value is L or M, change to H
        if (eclevelSelect.value === 'L' || eclevelSelect.value === 'M') {
          eclevelSelect.value = 'H';
        }
      }

      // Enable all content types for QR code
      this.enableAllContentTypes(contentTypeSelect);
    } else if (barcodeType === 'pdf417') {
      pdf417OptionsGroup.classList.remove('hidden');
      // Enable all content types for PDF417
      this.enableAllContentTypes(contentTypeSelect);
    } else if (is1DBarcode) {
      // Show 1D specific options for 1D barcodes
      oneDOptionsGroup.classList.remove('hidden');
      // For 1D barcodes, restrict to text only
      this.restrictToTextOnly(contentTypeSelect);
    } else {
      // For other 2D barcodes like datamatrix, azteccode
      this.enableAllContentTypes(contentTypeSelect);
    }

    // Update human-readable text option availability
    this.updateHumanReadableTextOption(barcodeType);

    // Also update the dynamic form based on content type
    this.updateForm();
  }

  /**
   * Update human-readable text option availability based on barcode type
   */
  updateHumanReadableTextOption(barcodeType) {
    const includeTextSelect = document.getElementById('includetext');
    const includeTextLabel = document.querySelector('label[for="includetext"]');
    const includeTextGroup = includeTextSelect.closest('.form-group');
    const infoMessage = includeTextGroup.querySelector('.info-message');

    // Define which barcode types support human-readable text
    const supportsHumanReadableText = [
      'ean13',
      'ean8', 
      'upca',
      'upce',
      'code39',
      'code128',
      'interleaved2of5',
      'codabar'
    ];

    const isSupported = supportsHumanReadableText.includes(barcodeType);

    // Enable/disable the option
    includeTextSelect.disabled = !isSupported;
    
    // Add/remove disabled class for styling
    if (isSupported) {
      includeTextGroup.classList.remove('disabled-option');
      // Update info message for supported formats
      infoMessage.textContent = 'Shows the encoded text below the barcode for manual verification.';
    } else {
      includeTextGroup.classList.add('disabled-option');
      // Reset to "No" when disabled
      includeTextSelect.value = 'false';
      // Update info message for unsupported formats
      const formatName = this.getBarcodeTypeName(barcodeType);
      infoMessage.textContent = `${formatName} encodes text within the pattern itself - human-readable text is not applicable.`;
    }
  }

  /**
   * Get user-friendly barcode type name
   */
  getBarcodeTypeName(barcodeType) {
    const typeNames = {
      'qrcode': 'QR Code',
      'datamatrix': 'Data Matrix',
      'pdf417': 'PDF417',
      'azteccode': 'Aztec Code',
      'ean13': 'EAN-13',
      'ean8': 'EAN-8',
      'upca': 'UPC-A',
      'upce': 'UPC-E',
      'code39': 'CODE 39',
      'code128': 'CODE 128',
      'interleaved2of5': 'ITF',
      'codabar': 'CODABAR'
    };
    return typeNames[barcodeType] || barcodeType.toUpperCase();
  }

  /**
   * Enable all content types
   */
  enableAllContentTypes(selectElement) {
    const options = selectElement.options;
    for (let i = 0; i < options.length; i++) {
      options[i].disabled = false;
    }
  }

  /**
   * Restrict to text-only content type
   */
  restrictToTextOnly(selectElement) {
    // First, set to "text" if it's not already
    if (selectElement.value !== 'text') {
      selectElement.value = 'text';
      // Store this as the current input value
      const currentInputValues = stateManager.get('generator.inputValues') || {};
      currentInputValues['contentType'] = 'text';
      stateManager.set('generator.inputValues', currentInputValues);
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

  /**
   * Update the dynamic form based on content type
   */
  updateForm() {
    const type = document.getElementById('contentType').value;
    const container = document.getElementById('inputContainer');
    container.innerHTML = ''; // Clear previous fields

    let fields = [];
    if (type === 'wifi') {
      fields = [
        { label: 'SSID:', id: 'wifiSsid', type: 'text' },
        { label: 'Password:', id: 'wifiPass', type: 'text' },
        {
          label: 'Encryption:',
          id: 'wifiEnc',
          type: 'select',
          options: [
            { value: 'WPA', text: 'WPA/WPA2' },
            { value: 'WEP', text: 'WEP' },
            { value: 'nopass', text: 'None' },
          ],
        },
      ];
    } else if (type === 'vcard') {
      fields = [
        { label: 'First Name:', id: 'vcFirst', type: 'text' },
        { label: 'Last Name:', id: 'vcLast', type: 'text' },
        { label: 'Phone:', id: 'vcTel', type: 'tel' },
        { label: 'Email:', id: 'vcEmail', type: 'email' },
        { label: 'Organization:', id: 'vcOrg', type: 'text' },
      ];
    } else if (type === 'email') {
      fields = [
        { label: 'To:', id: 'emailTo', type: 'email' },
        { label: 'Subject:', id: 'emailSubject', type: 'text' },
        { label: 'Body:', id: 'emailBody', type: 'textarea' },
      ];
    } else if (type === 'geo') {
      fields = [
        { label: 'Latitude:', id: 'geoLat', type: 'text' },
        { label: 'Longitude:', id: 'geoLng', type: 'text' },
      ];
    } else {
      // Default to text/url
      const barcodeType = document.getElementById('barcodeType').value;

      let inputType = 'text';
      let placeholder = 'Enter text to encode';
      let pattern = '';
      let title = '';

      // Add specific input requirements for 1D barcodes
      if (barcodeType === 'ean13') {
        inputType = 'text';
        placeholder = 'Enter 12 digits (13th digit calculated automatically)';
        pattern = '[0-9]{12}';
        title = 'EAN-13 requires exactly 12 digits';
      } else if (barcodeType === 'ean8') {
        inputType = 'text';
        placeholder = 'Enter 7 digits (8th digit calculated automatically)';
        pattern = '[0-9]{7}';
        title = 'EAN-8 requires exactly 7 digits';
      } else if (barcodeType === 'upca') {
        inputType = 'text';
        placeholder = 'Enter 11 digits (12th digit calculated automatically)';
        pattern = '[0-9]{11}';
        title = 'UPC-A requires exactly 11 digits';
      } else if (barcodeType === 'upce') {
        inputType = 'text';
        placeholder = 'Enter 6 digits';
        pattern = '[0-9]{6}';
        title = 'UPC-E requires exactly 6 digits';
      } else if (barcodeType === 'codabar') {
        inputType = 'text';
        placeholder = 'Start with A/B/C/D, end with A/B/C/D, digits and -$:/.+ in between';
        pattern = '[ABCD][0-9\\-$:/.+]*[ABCD]';
        title = 'CODABAR must start and end with A, B, C, or D';
      }

      fields = [
        {
          label: 'Text/URL:',
          id: 'textInput',
          type: inputType,
          placeholder: placeholder,
          pattern: pattern,
          title: title,
        },
      ];
    }

    // Create form fields
    fields.forEach((field) => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = field.label;
      label.setAttribute('for', field.id);
      fieldDiv.appendChild(label);

      let input;
      if (field.type === 'select') {
        input = document.createElement('select');
        field.options.forEach((option) => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.text;
          input.appendChild(optionEl);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = field.type;
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.pattern) input.pattern = field.pattern;
        if (field.title) input.title = field.title;
      }

      input.id = field.id;
      input.name = field.id;

      // Restore previous value if available
      const currentInputValues = stateManager.get('generator.inputValues') || {};
      input.value = currentInputValues[field.id] || '';

      // Save input values as user types
      input.addEventListener('input', (e) => {
        const currentInputValues = stateManager.get('generator.inputValues') || {};
        currentInputValues[e.target.id] = e.target.value;
        stateManager.set('generator.inputValues', currentInputValues);
      });

      fieldDiv.appendChild(input);
      container.appendChild(fieldDiv);
    });
  }

  /**
   * Handle logo upload
   */
  handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      ErrorHandler.showUserError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      ErrorHandler.showUserError('Logo file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const logoImage = new Image();
        logoImage.src = e.target.result;
        stateManager.set('generator.selectedLogo', logoImage);

        // Update UI
        const logoPreview = document.getElementById('logoPreview');
        const removeLogoBtn = document.getElementById('removeLogoBtn');

        logoPreview.src = e.target.result;
        logoPreview.style.display = 'inline-block';
        removeLogoBtn.style.display = 'inline-block';

        // Update barcode options if QR code is selected
        this.updateBarcodeOptionsVisibility();
        clearError();
      } catch (error) {
        ErrorHandler.showUserError('Error loading logo: ' + error.message, error, 'BarcodeGenerator.handleLogoUpload');
      }
    };

    reader.onerror = () => {
      ErrorHandler.showUserError('Error reading logo file.');
    };

    reader.readAsDataURL(file);
  }

  /**
   * Remove logo
   */
  removeLogo() {
    stateManager.set('generator.selectedLogo', null);

    // Update UI
    const logoPreview = document.getElementById('logoPreview');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    const logoUpload = document.getElementById('logoUpload');

    logoPreview.style.display = 'none';
    removeLogoBtn.style.display = 'none';
    logoUpload.value = '';

    // Update barcode options
    this.updateBarcodeOptionsVisibility();
    clearError();
  }

  /**
   * Generate barcode
   */
  async generateBarcode() {
    return await ErrorHandler.wrapAsync(async () => {
      ErrorHandler.clearAllErrors();

      const barcodeType = document.getElementById('barcodeType').value;
      const format = document.getElementById('outputFormat').value;

      // Get barcode text based on content type
      const text = this.getBarcodeText();
      if (!text) {
        ErrorHandler.showUserError('Please enter content to generate a barcode.');
        return;
      }

      // Validate specific barcode requirements
      if (!this.validateBarcodeInput(barcodeType, text)) {
        return; // Error already displayed in validation function
      }

      // Show generating message
      ErrorHandler.showProgress('Generating barcode...');
      
      const resultContainer = document.getElementById('generatedBarcodeContainer');
      resultContainer.innerHTML = '';
      resultContainer.style.display = 'block';
      
      // Add CSS class for square barcodes to help maintain aspect ratio
      const squareBarcodes = ['qrcode', 'datamatrix', 'azteccode'];
      
      // Always remove the class first, then add if needed
      resultContainer.classList.remove('square-barcode-container');
      if (squareBarcodes.includes(barcodeType)) {
        resultContainer.classList.add('square-barcode-container');
      }

      // Generate barcode based on format
      let canvas;
      if (format === 'svg') {
        canvas = await this.generateSVGBarcode(barcodeType, text);
      } else {
        canvas = await this.generateCanvasBarcode(barcodeType, text);
      }

      if (canvas) {
        // Display the generated barcode
        resultContainer.appendChild(canvas);

        // Add download button
        this.addDownloadButton(resultContainer, canvas, barcodeType, text, format);
        
        // Show success message
        ErrorHandler.showSuccess('Barcode generated successfully!');
      }
    }, 'BarcodeGenerator.generateBarcode', 'Failed to generate barcode');
  }

  /**
   * Get barcode text based on content type
   */
  getBarcodeText() {
    const type = document.getElementById('contentType').value;
    let result = '';

    if (type === 'wifi') {
      const ssid = document.getElementById('wifiSsid').value;
      const pass = document.getElementById('wifiPass').value;
      const enc = document.getElementById('wifiEnc').value;
      // Basic escaping for special characters in WIFI string
      const escape = (s) => s.replace(/([;,"'])/g, '\\$1');
      result = `WIFI:S:${escape(ssid)};T:${escape(enc)};P:${escape(pass)};;`;
    } else if (type === 'vcard') {
      const first = document.getElementById('vcFirst').value;
      const last = document.getElementById('vcLast').value;
      const tel = document.getElementById('vcTel').value;
      const email = document.getElementById('vcEmail').value;
      const org = document.getElementById('vcOrg').value;

      result = `BEGIN:VCARD\nVERSION:3.0\nFN:${first} ${last}\nTEL:${tel}\nEMAIL:${email}\nORG:${org}\nEND:VCARD`;
    } else if (type === 'email') {
      const to = document.getElementById('emailTo').value;
      const subject = document.getElementById('emailSubject').value;
      const body = document.getElementById('emailBody').value;
      result = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else if (type === 'geo') {
      const lat = document.getElementById('geoLat').value;
      const lng = document.getElementById('geoLng').value;
      result = `geo:${lat},${lng}`;
    } else {
      result = document.getElementById('textInput').value;
    }

    return result.trim();
  }

  /**
   * Validate barcode input based on type
   */
  validateBarcodeInput(barcodeType, text) {
    // Validation logic for different barcode types
    if (barcodeType === 'ean13') {
      if (!/^[0-9]{12}$/.test(text)) {
        ErrorHandler.showUserError('EAN-13 requires exactly 12 digits');
        return false;
      }
    } else if (barcodeType === 'ean8') {
      if (!/^[0-9]{7}$/.test(text)) {
        ErrorHandler.showUserError('EAN-8 requires exactly 7 digits');
        return false;
      }
    } else if (barcodeType === 'upca') {
      if (!/^[0-9]{11}$/.test(text)) {
        ErrorHandler.showUserError('UPC-A requires exactly 11 digits');
        return false;
      }
    } else if (barcodeType === 'upce') {
      if (!/^[0-9]{6}$/.test(text)) {
        ErrorHandler.showUserError('UPC-E requires exactly 6 digits');
        return false;
      }
    } else if (barcodeType === 'codabar') {
      if (!/^[ABCD][0-9\-$:/.+]*[ABCD]$/.test(text)) {
        ErrorHandler.showUserError('CODABAR must start and end with A, B, C, or D and contain only valid characters');
        return false;
      }
    }

    return true;
  }

  /**
   * Generate canvas-based barcode
   */
  async generateCanvasBarcode(barcodeType, text) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const options = this.getBwipOptions(barcodeType, text);

        try {
          bwipjs.toCanvas(canvas, options);
          // If we reach here, generation was successful

          // Handle logo overlay for QR codes
          if (barcodeType === 'qrcode' && stateManager.get('generator.selectedLogo')) {
            this.overlayLogo(canvas)
              .then(() => {
                this.resizeCanvasToFitContainer(canvas, document.getElementById('generatedBarcodeContainer'), barcodeType);
                resolve(canvas);
              })
              .catch(reject);
          } else {
            this.resizeCanvasToFitContainer(canvas, document.getElementById('generatedBarcodeContainer'), barcodeType);
            resolve(canvas);
          }
        } catch (bwipError) {
          reject(new Error(`BWIP-JS Error: ${bwipError.message || bwipError}`));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate SVG-based barcode
   */
  async generateSVGBarcode(barcodeType, text) {
    return new Promise((resolve, reject) => {
      try {
        const options = this.getBwipOptions(barcodeType, text);

        try {
          const svg = bwipjs.toSVG(options);
          // If we reach here, generation was successful

          const container = document.createElement('div');
          container.innerHTML = svg;

          const svgElement = container.querySelector('svg');
          if (!svgElement) {
            reject(new Error('Failed to generate SVG'));
            return;
          }

          // Handle logo for QR codes
          if (barcodeType === 'qrcode' && stateManager.get('generator.selectedLogo')) {
            this.addLogoToSvg(svgElement)
              .then(() => resolve(svgElement))
              .catch(reject);
          } else {
            resolve(svgElement);
          }
        } catch (bwipError) {
          reject(new Error(`BWIP-JS Error: ${bwipError.message || bwipError}`));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Get BWIP-JS options for barcode generation
   */
  getBwipOptions(barcodeType, text, backgroundColor = null) {
    // Map our barcode type names to BWIP-JS bcid values
    const bcidMapping = {
      'codabar': 'rationalizedCodabar',
      'qrcode': 'qrcode',
      'datamatrix': 'datamatrix',
      'pdf417': 'pdf417',
      'azteccode': 'azteccode',
      'ean13': 'ean13',
      'ean8': 'ean8',
      'upca': 'upca',
      'upce': 'upce',
      'code39': 'code39',
      'code128': 'code128',
      'interleaved2of5': 'interleaved2of5'
    };

    const bcid = bcidMapping[barcodeType] || barcodeType;

    const options = {
      bcid: bcid,
      text: text,
      scale: 3,
      includetext: document.getElementById('includetext').value === 'true',
      padding: parseInt(document.getElementById('padding').value) || 10,
    };

    // Add background color if specified (for PNG downloads)
    if (backgroundColor) {
      options.backgroundcolor = backgroundColor;
    }

    // Don't set height for square barcodes (QR, DataMatrix, Aztec) 
    // to preserve their natural 1:1 aspect ratio
    const squareBarcodes = ['qrcode', 'datamatrix', 'azteccode'];
    if (!squareBarcodes.includes(barcodeType)) {
      options.height = 10;
    }

    // Add specific options for different barcode types
    if (barcodeType === 'qrcode') {
      options.eclevel = document.getElementById('eclevel').value;
    } else if (barcodeType === 'pdf417') {
      options.securitylevel = parseInt(document.getElementById('securitylevel').value);
    }

    return options;
  }

  /**
   * Overlay logo on canvas (for QR codes)
   */
  async overlayLogo(canvas) {
    return new Promise((resolve, reject) => {
      try {
        const selectedLogo = stateManager.get('generator.selectedLogo');
        if (!selectedLogo) {
          resolve();
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        selectedLogo.onload = () => {
          try {
            const logoSize = Math.min(canvas.width, canvas.height) * 0.2;
            const x = (canvas.width - logoSize) / 2;
            const y = (canvas.height - logoSize) / 2;

            // Add white background behind logo
            ctx.fillStyle = 'white';
            ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);

            // Draw logo
            ctx.drawImage(selectedLogo, x, y, logoSize, logoSize);
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        selectedLogo.onerror = () => {
          reject(new Error('Error loading logo image'));
        };

        // Trigger onload if image is already loaded
        if (selectedLogo.complete) {
          selectedLogo.onload();
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Add logo to SVG (for QR codes)
   */
  async addLogoToSvg(svgElement) {
    return new Promise((resolve, reject) => {
      try {
        const selectedLogo = stateManager.get('generator.selectedLogo');
        if (!selectedLogo) {
          resolve();
          return;
        }

        const svgRect = svgElement.getBBox();
        const logoSize = Math.min(svgRect.width, svgRect.height) * 0.2;
        const x = svgRect.x + (svgRect.width - logoSize) / 2;
        const y = svgRect.y + (svgRect.height - logoSize) / 2;

        // Create white background
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', x - 5);
        bgRect.setAttribute('y', y - 5);
        bgRect.setAttribute('width', logoSize + 10);
        bgRect.setAttribute('height', logoSize + 10);
        bgRect.setAttribute('fill', 'white');

        // Create image element
        const imgElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgElement.setAttribute('x', x);
        imgElement.setAttribute('y', y);
        imgElement.setAttribute('width', logoSize);
        imgElement.setAttribute('height', logoSize);
        imgElement.setAttribute('href', selectedLogo.src);

        svgElement.appendChild(bgRect);
        svgElement.appendChild(imgElement);

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate canvas specifically for PNG download with white background
   */
  async generatePngCanvas(barcodeType, text) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const options = this.getBwipOptions(barcodeType, text, 'ffffff'); // White background

        try {
          bwipjs.toCanvas(canvas, options);
          
          // Handle logo overlay for QR codes
          if (barcodeType === 'qrcode' && stateManager.get('generator.selectedLogo')) {
            this.overlayLogo(canvas)
              .then(() => {
                resolve(canvas);
              })
              .catch(reject);
          } else {
            resolve(canvas);
          }
        } catch (bwipError) {
          reject(new Error(`BWIP-JS Error: ${bwipError.message || bwipError}`));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Add download button for generated barcode
   */
  addDownloadButton(container, canvas, barcodeType, text, format) {
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = `📥 Download ${format.toUpperCase()}`;
    downloadBtn.className = 'secondary-button';
    downloadBtn.style.marginTop = '10px';

    downloadBtn.addEventListener('click', async () => {
      const filename = `barcode_${barcodeType}_${Date.now()}.${format === 'svg' ? 'svg' : 'png'}`;

      try {
        if (format === 'svg') {
          // Download SVG (keep transparent background for flexibility)
          const svgData = new XMLSerializer().serializeToString(canvas);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          this.downloadFile(blob, filename);
        } else {
          // Download PNG with white background
          const pngCanvas = await this.generatePngCanvas(barcodeType, text);
          pngCanvas.toBlob((blob) => {
            this.downloadFile(blob, filename);
          });
        }
      } catch (error) {
        console.error('Error generating download:', error);
        ErrorHandler.showUserError('Error generating download: ' + error.message);
      }
    });

    container.appendChild(downloadBtn);
  }

  /**
   * Download file helper
   */
  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Resize canvas to fit container while maintaining aspect ratio
   */
  resizeCanvasToFitContainer(canvas, container, barcodeType = null) {
    try {
      // Get container dimensions with fallback
      const containerRect = container.getBoundingClientRect();
      const containerClientWidth = Math.max(containerRect.width, container.clientWidth);
      
      if (containerClientWidth <= 0) {
        console.warn('Container width is zero or negative, skipping resize');
        return;
      }

      const originalWidth = canvas.width;
      const originalHeight = canvas.height;

      if (originalWidth <= 0 || originalHeight <= 0) {
        console.warn('Canvas dimensions are invalid, skipping resize');
        return;
      }

      // Don't resize if already the right size
      if (Math.abs(canvas.width - containerClientWidth) < 2) {
        return;
      }

      // Special handling for square barcodes (QR, DataMatrix, Aztec)
      const squareBarcodes = ['qrcode', 'datamatrix', 'azteccode'];
      const isSquareBarcode = squareBarcodes.includes(barcodeType);
      
      let minWidth, minHeight;
      
      if (isSquareBarcode) {
        // For square barcodes, maintain 1:1 aspect ratio
        // Use the smaller of container width or a reasonable max size
        const maxSquareSize = 400; // Prevent oversized QR codes
        const squareSize = Math.min(containerClientWidth, maxSquareSize);
        const minSquareSize = Math.max(squareSize, 100); // Minimum 100px
        
        minWidth = minSquareSize;
        minHeight = minSquareSize;
      } else {
        // For non-square barcodes, use original aspect ratio logic
        const aspectRatio = originalHeight / originalWidth;
        const newHeight = Math.floor(containerClientWidth * aspectRatio);
        
        minWidth = Math.max(containerClientWidth, 100);
        minHeight = Math.max(newHeight, 50);
      }

      // Create temporary canvas to store original image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.error('Failed to get temporary canvas context');
        return;
      }

      // Get canvas context before trying to read image data
      const mainCtx = canvas.getContext('2d');
      if (!mainCtx) {
        console.error('Failed to get main canvas context');
        return;
      }

      // Store original image data
      const originalImageData = mainCtx.getImageData(0, 0, originalWidth, originalHeight);
      tempCtx.putImageData(originalImageData, 0, 0);

      // Resize main canvas
      canvas.width = minWidth;
      canvas.height = minHeight;

      // Get new context after resize (context is lost after changing canvas size)
      const newCtx = canvas.getContext('2d');
      if (!newCtx) {
        console.error('Failed to get new canvas context after resize');
        return;
      }

      // Configure context for better image quality
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';

      // Draw scaled content while preserving aspect ratio and padding
      // Calculate scaling to fit within the new canvas size while maintaining aspect ratio
      const scaleX = minWidth / originalWidth;
      const scaleY = minHeight / originalHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledWidth = originalWidth * scale;
      const scaledHeight = originalHeight * scale;
      
      // Center the scaled image in the new canvas
      const offsetX = (minWidth - scaledWidth) / 2;
      const offsetY = (minHeight - scaledHeight) / 2;
      
      // Fill background with white to preserve padding appearance
      newCtx.fillStyle = 'white';
      newCtx.fillRect(0, 0, minWidth, minHeight);
      
      newCtx.drawImage(tempCanvas, 0, 0, originalWidth, originalHeight, offsetX, offsetY, scaledWidth, scaledHeight);
      
    } catch (error) {
      console.error('Error resizing canvas:', error);
      ErrorHandler.showUserError('Error resizing barcode display', error, 'BarcodeGenerator.resizeCanvasToFitContainer');
    }
  }
}