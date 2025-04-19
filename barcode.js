let selectedLogo = null; // Variable to store the selected logo file data

function updateBarcodeOptionsVisibility() {
    const barcodeType = document.getElementById('barcodeType').value;
    const qrOptionsGroup = document.getElementById('qrOptionsGroup');
    const pdf417OptionsGroup = document.getElementById('pdf417OptionsGroup');

    // Hide all specific option groups initially
    qrOptionsGroup.classList.add('hidden');
    pdf417OptionsGroup.classList.add('hidden');

    // Show options based on selected type
    if (barcodeType === 'qrcode') {
        qrOptionsGroup.classList.remove('hidden');
    } else if (barcodeType === 'pdf417') {
        pdf417OptionsGroup.classList.remove('hidden');
    }
     // Reset logo if barcode type changes away from QR
    if (barcodeType !== 'qrcode') {
        resetLogo();
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
      container.appendChild(input);
      container.appendChild(document.createElement('br')); // Add space
  });
}

function generateContentString() {
  const type = document.getElementById('contentType').value;
  try {
      if (type === 'wifi') {
        const ssid = document.getElementById('wifiSsid').value;
        const pass = document.getElementById('wifiPass').value;
        const enc = document.getElementById('wifiEnc').value;
        // Basic escaping for special characters in WIFI string
        const escape = (s) => s.replace(/([\\;,"'])/g, '\\$1');
        return `WIFI:S:${escape(ssid)};T:${escape(enc)};P:${escape(pass)};;`;
      } else if (type === 'vcard') {
        const first = document.getElementById('vcFirst').value;
        const last = document.getElementById('vcLast');
        const tel = document.getElementById('vcTel');
        const email = document.getElementById('vcEmail');
        const org = document.getElementById('vcOrg');
        return `BEGIN:VCARD\nVERSION:3.0\nN:${last};${first}\nFN:${first} ${last}\nORG:${org}\nTEL:${tel}\nEMAIL:${email}\nEND:VCARD`;
      } else if (type === 'email') {
        const to = document.getElementById('emailTo');
        const subject = encodeURIComponent(document.getElementById('emailSubject').value);
        const body = encodeURIComponent(document.getElementById('emailBody').value);
        return `mailto:${to}?subject=${subject}&body=${body}`;
      } else if (type === 'geo') {
        const lat = document.getElementById('geoLat');
        const lng = document.getElementById('geoLng');
        return `geo:${lat},${lng}`;
      } else {
        return document.getElementById('plainText').value;
      }
  } catch (e) {
      console.error("Error generating content string:", e);
      displayError("Could not generate content. Check input fields.");
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

 function resetLogo() {
    selectedLogo = null;
    const logoInput = document.getElementById('qrLogo');
    if(logoInput) {
        logoInput.value = ''; // Clear the file input
    }
    const preview = document.getElementById('qrLogoPreview');
     if(preview) {
        preview.style.display = 'none';
        preview.src = '#';
     }
}

// Handle Logo File Selection
const logoInput = document.getElementById('qrLogo');
if (logoInput) {
    logoInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('qrLogoPreview');
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                selectedLogo = e.target.result; // Store the Data URL
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else {
            // Reset if invalid file or selection cancelled
            resetLogo();
        }
    });
}

async function generateBarcode() {
  const bcid = document.getElementById('barcodeType').value;
  const text = generateContentString();
  const format = document.getElementById('outputFormat').value;
  const scale = parseInt(document.getElementById('scale').value);
  const padding = parseInt(document.getElementById('padding').value);
  const includetext = document.getElementById('includetext').value === 'true';
  const eclevel = document.getElementById('eclevel').value;
  const securitylevel = parseInt(document.getElementById('securitylevel').value);

  const outputDiv = document.getElementById('barcodeOutput');
  outputDiv.innerHTML = '<p>Generating...</p>'; // Initial feedback

  const options = { bcid, text, scale, padding };
  if (includetext) options.alttext = text;
  if (bcid === 'qrcode') options.eclevel = eclevel;
  if (bcid === 'pdf417') options.eclevel = securitylevel;

  if (format === 'canvas') {
    const canvas = document.createElement('canvas');
    outputDiv.appendChild(canvas); // Append to DOM immediately

    bwipjs.toCanvas(canvas, options, err => {
      if (err) {
        console.error('Canvas Error:', err);
        displayError(`Error generating barcode: ${err}`);
        return;
      }

      const hasLogo = bcid === 'qrcode' && selectedLogo;
      const ctx = canvas.getContext('2d');

      const renderWithDownload = () => {
        outputDiv.innerHTML = '';
        outputDiv.appendChild(canvas);
        const downloadLink = document.createElement('a');
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = `${bcid}_barcode.png`;
        downloadLink.textContent = 'Download PNG Image';
        outputDiv.appendChild(document.createElement('br'));
        outputDiv.appendChild(downloadLink);
      };

      if (hasLogo && ctx) {
        const logoImg = new Image();
        logoImg.onload = () => {
          console.log("Logo image loaded."); // Debugging log
          const qrSize = canvas.width;
          const logoMaxDim = Math.max(40, qrSize * 0.25);

          let logoW = logoImg.width;
          let logoH = logoImg.height;

          if (logoW > logoMaxDim || logoH > logoMaxDim) {
            const ratio = Math.min(logoMaxDim / logoW, logoMaxDim / logoH);
            logoW *= ratio;
            logoH *= ratio;
          }

          const x = (canvas.width - logoW) / 2;
          const y = (canvas.height - logoH) / 2;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x - 4, y - 4, logoW + 8, logoH + 8);
          ctx.drawImage(logoImg, x, y, logoW, logoH);

          renderWithDownload(); // Call render with download after drawing logo
        };
        logoImg.onerror = () => {
          console.error("Error loading logo image for drawing.");
          displayError("Error loading logo image. Please try another image.");
          renderWithDownload(); // Still render with download even if logo fails
        };
        console.log("Setting logo image source:", selectedLogo); // Debugging log
        logoImg.src = selectedLogo;
      } else {
        renderWithDownload(); // Call render with download if no logo
      }
    });
  } else { // SVG Output
    try {
      const svg = bwipjs.toSVG(options);
      outputDiv.innerHTML = svg;
    } catch (err) {
      console.error('SVG Error:', err);
      displayError(`Error generating SVG: ${err}`);
    }
  }
}

document.addEventListener('DOMContentLoaded', updateForm);
document.addEventListener('DOMContentLoaded', updateBarcodeOptionsVisibility);