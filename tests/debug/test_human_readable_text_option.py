#!/usr/bin/env python3
"""
Test human-readable text option enable/disable functionality
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

async def test_human_readable_text_option():
    """Test that human-readable text option is correctly enabled/disabled based on barcode type"""
    
    # Start server
    PORT = 38447
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {PORT}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(viewport={'width': 1280, 'height': 720})
            page = await context.new_page()
            
            # Listen to console messages
            page.on("console", lambda msg: print(f"Browser: {msg.text}"))
            
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # Test cases for different barcode types
            test_cases = [
                # Linear barcodes (should support human-readable text)
                {
                    'type': 'ean13',
                    'name': 'EAN-13',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'ean8',
                    'name': 'EAN-8', 
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'upca',
                    'name': 'UPC-A',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'upce',
                    'name': 'UPC-E',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'code39',
                    'name': 'CODE 39',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'code128',
                    'name': 'CODE 128',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'interleaved2of5',
                    'name': 'ITF',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                {
                    'type': 'codabar',
                    'name': 'CODABAR',
                    'should_support': True,
                    'expected_message': 'Shows the encoded text below the barcode for manual verification.'
                },
                # 2D barcodes (should NOT support human-readable text)
                {
                    'type': 'qrcode',
                    'name': 'QR Code',
                    'should_support': False,
                    'expected_message': 'QR Code encodes text within the pattern itself - human-readable text is not applicable.'
                },
                {
                    'type': 'datamatrix',
                    'name': 'Data Matrix',
                    'should_support': False,
                    'expected_message': 'Data Matrix encodes text within the pattern itself - human-readable text is not applicable.'
                },
                {
                    'type': 'pdf417',
                    'name': 'PDF417',
                    'should_support': False,
                    'expected_message': 'PDF417 encodes text within the pattern itself - human-readable text is not applicable.'
                },
                {
                    'type': 'azteccode',
                    'name': 'Aztec Code',
                    'should_support': False,
                    'expected_message': 'Aztec Code encodes text within the pattern itself - human-readable text is not applicable.'
                }
            ]
            
            for i, test_case in enumerate(test_cases):
                print(f"\n=== Testing {test_case['name']} ({test_case['type']}) ===")
                
                # Select barcode type
                await page.select_option('#barcodeType', test_case['type'])
                await page.wait_for_timeout(500)  # Allow time for UI updates
                
                # Check human-readable text option state
                option_info = await page.evaluate("""() => {
                    const includeTextSelect = document.getElementById('includetext');
                    const includeTextGroup = includeTextSelect.closest('.form-group');
                    const infoMessage = includeTextGroup.querySelector('.info-message');
                    
                    return {
                        disabled: includeTextSelect.disabled,
                        value: includeTextSelect.value,
                        hasDisabledClass: includeTextGroup.classList.contains('disabled-option'),
                        infoMessageText: infoMessage ? infoMessage.textContent : null,
                        selectStyle: window.getComputedStyle(includeTextSelect),
                        groupOpacity: window.getComputedStyle(includeTextGroup).opacity
                    };
                }""")
                
                # Verify enabled/disabled state
                is_disabled = option_info['disabled']
                should_be_disabled = not test_case['should_support']
                
                print(f"Expected support: {test_case['should_support']}")
                print(f"Should be disabled: {should_be_disabled}")
                print(f"Actually disabled: {is_disabled}")
                print(f"Has disabled class: {option_info['hasDisabledClass']}")
                print(f"Select value: {option_info['value']}")
                print(f"Group opacity: {option_info['groupOpacity']}")
                
                # Check if disabled state is correct
                if is_disabled == should_be_disabled:
                    print("✅ Disabled state is correct")
                else:
                    print("❌ Disabled state is incorrect")
                
                # Check if disabled class is applied correctly
                should_have_disabled_class = not test_case['should_support']
                has_disabled_class = option_info['hasDisabledClass']
                
                if has_disabled_class == should_have_disabled_class:
                    print("✅ Disabled CSS class is correct")
                else:
                    print("❌ Disabled CSS class is incorrect")
                
                # Check info message
                actual_message = option_info['infoMessageText']
                expected_message = test_case['expected_message']
                
                print(f"Expected message: '{expected_message}'")
                print(f"Actual message: '{actual_message}'")
                
                if actual_message == expected_message:
                    print("✅ Info message is correct")
                else:
                    print("❌ Info message is incorrect")
                
                # For disabled options, verify value is reset to 'false'
                if not test_case['should_support']:
                    if option_info['value'] == 'false':
                        print("✅ Value correctly reset to 'false' for disabled option")
                    else:
                        print("❌ Value not reset for disabled option")
                
                # Visual styling check for disabled options
                if not test_case['should_support']:
                    opacity = float(option_info['groupOpacity'])
                    if 0.5 <= opacity <= 0.7:  # Should be around 0.6
                        print("✅ Visual opacity styling applied correctly")
                    else:
                        print(f"❌ Visual opacity styling incorrect: {opacity}")
                
                await page.wait_for_timeout(500)
            
            # Take final screenshot
            await page.screenshot(path='screenshots/human_readable_text_option_test.png')
            print("✓ Screenshot saved")
            
            print("\n🎉 Human-readable text option testing completed!")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    asyncio.run(test_human_readable_text_option())