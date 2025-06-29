/**
 * Enhanced URL detection function
 * @param {string} text
 * @return {Array<string>|null}
 */
export function detectURLs(text) {
  // Common web protocols
  const webProtocolsPattern =
    /(?:https?|ftp|data|file|smb|ldap|mailto|tel|maps|sip|xmpp|skype|spotify|steam):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+/gi;

  // MS Office and other application protocols
  const appProtocolsPattern =
    /(?:ms-(?:word|excel|powerpoint|visio|access|publisher|outlook|onenote|project)|teams|slack|zoom|msteams|zoommtg|zoomus):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+/gi;

  // Windows UNC paths (\\server\share\folder)
  const uncPathPattern = /\\\\[^\s"'<>]+\\(?:\\\\[^\s"'<>]+\\)+/gi;

  // Windows drive paths (C:\folder\file.txt)
  const drivePathPattern = /[A-Za-z]:\\\\[^\s"'<>:]+\\(?:\\\\[^\s"'<>:]+\\)+/gi;

  // Intranet sites with special TLDs
  const intranetPattern =
    /(?:[A-Za-z0-9][-A-Za-z0-9.]*\.[A-Za-z0-9][-A-Za-z0-9.]*(\.(?:local|corp|internal|lan|intranet|test|dev|staging|prod))(?:\[^\s"'<>]*)?)/gi;

  // IP addresses (optional port)
  const ipPattern =
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?\b(?:\/[^\s"'<>]*)?/gi;

  // Combine all patterns into results
  const results = [
    ...(text.match(webProtocolsPattern) || []),
    ...(text.match(appProtocolsPattern) || []),
    ...(text.match(uncPathPattern) || []),
    ...(text.match(drivePathPattern) || []),
    ...(text.match(intranetPattern) || []),
    ...(text.match(ipPattern) || []),
  ];

  return results.length > 0 ? results : null;
}

/**
 * Convert text to HTML with clickable links
 * @param {string} text
 * @return {string}
 */
export function textWithLinks(text) {
  // Make a copy of the original text
  let linkedText = text;

  // Standard web protocols (http, https, ftp, etc.)
  linkedText = linkedText.replace(
    /((?:https?|ftp|data|ldap|mailto|tel|maps|sip|xmpp|skype|spotify|steam):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+)/gi,
    (url) => `<a href="${url}" target="_blank" class="detected-link">${url}</a>`
  );

  // Application protocols (ms-word:, teams:, etc.)
  linkedText = linkedText.replace(
    /((?:ms-(?:word|excel|powerpoint|visio|access|publisher|outlook|onenote|project)|teams|slack|zoom|msteams|zoommtg|zoomus):(?:[^\s"'<>]|%[0-9A-Fa-f]{2})+)/gi,
    (url) => `<a href="${url}" class="detected-link app-protocol">${url}</a>`
  );

  // Windows UNC paths
  linkedText = linkedText.replace(/(\\\\[^\s"'<>]+\\(?:\\\\[^\s"'<>]+\\)+)/gi, (path) => {
    // Convert backslashes to forward slashes for file: URI
    const uriPath = path.replace(/\\/g, '/');
    return `<a href="file:${uriPath}" class="detected-link file-path" title="Network path">${path}</a>`;
  });

  // Windows drive paths
  linkedText = linkedText.replace(
    /([A-Za-z]:\\\\[^\s"'<>:]+\\(?:\\\\[^\s"'<>:]+\\)+)/gi,
    (path) => {
      // Convert backslashes to forward slashes for file: URI
      const uriPath = path.replace(/\\/g, '/');
      return `<a href="file:///${uriPath}" class="detected-link file-path" title="File path">${path}</a>`;
    }
  );

  // Intranet sites with special TLDs
  linkedText = linkedText.replace(
    /([A-Za-z0-9][-A-Za-z0-9.]*\.[A-Za-z0-9][-A-Za-z0-9.]*(\.(?:local|corp|internal|lan|intranet|test|dev|staging|prod))(?:\[^\s"'<>]*)?)/gi,
    (url) => {
      // Add https if protocol is missing
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      return `<a href="${fullUrl}" target="_blank" class="detected-link intranet-link" title="Intranet link">${url}</a>`;
    }
  );

  // IP addresses (with optional port)
  linkedText = linkedText.replace(
    /\b((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d{1,5})?)(\b(?:\/[^\s"'<>]*)?)/gi,
    (match, ip, path) => {
      const fullUrl = `http://${match}`;
      return `<a href="${fullUrl}" target="_blank" class="detected-link ip-link" title="IP address link">${match}</a>`;
    }
  );

  return linkedText;
}

/**
 * Creates a copy button for a given text.
 * @param {string} textToCopy
 * @return {HTMLButtonElement}
 */
export function createCopyButton(textToCopy) {
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

    navigator.clipboard
      .writeText(textToCopy)
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
      .catch((err) => {
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

/**
 * Process HTML content to add copy buttons after links
 * @param {HTMLElement} containerElement
 */
export function addCopyButtonsToLinks(containerElement) {
  // Find all links in the container
  const links = containerElement.querySelectorAll('a.detected-link');

  links.forEach((link) => {
    // Avoid adding multiple copy buttons
    if (
      !link.nextSibling ||
      !link.nextSibling.classList ||
      !link.nextSibling.classList.contains('copy-link-btn')
    ) {
      const copyButton = createCopyButton(link.getAttribute('href'));
      link.parentNode.insertBefore(copyButton, link.nextSibling);
    }
  });
}

/**
 * Converts ZXing BarcodeFormat number to a readable name.
 * @param {number} formatNumber
 * @return {string}
 */
export function getBarcodeFormatName(formatNumber) {
  const formatNames = {
    0: 'AZTEC',
    1: 'CODABAR',
    2: 'CODE_39',
    3: 'CODE_93',
    4: 'CODE_128',
    5: 'DATA_MATRIX',
    6: 'EAN_8',
    7: 'EAN_13',
    8: 'ITF',
    9: 'MAXICODE',
    10: 'PDF_417',
    11: 'QR_CODE',
    12: 'RSS_14',
    13: 'RSS_EXPANDED',
    14: 'UPC_A',
    15: 'UPC_E',
    16: 'UPC_EAN_EXTENSION',
  };

  return formatNames[formatNumber] || `Unknown (${formatNumber})`;
}
