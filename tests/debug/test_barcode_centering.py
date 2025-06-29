#!/usr/bin/env python3
"""
Test barcode centering for different barcode types
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

async def test_barcode_centering():
    """Test that barcodes are properly centered in their containers"""
    
    # Start server
    PORT = 38443
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
                {
                    'type': 'qrcode',
                    'content': 'QR Code Test Content',
                    'name': 'QR Code (Square)',
                    'expected_square': True
                },
                {
                    'type': 'datamatrix', 
                    'content': 'DataMatrix Test',
                    'name': 'DataMatrix (Square)',
                    'expected_square': True
                },
                {
                    'type': 'code128',
                    'content': 'Code 128 Test',
                    'name': 'Code 128 (Linear)',
                    'expected_square': False
                },
                {
                    'type': 'ean13',
                    'content': '123456789012',
                    'name': 'EAN-13 (Linear)',
                    'expected_square': False
                }
            ]
            
            for i, test_case in enumerate(test_cases):
                print(f"\n=== Testing {test_case['name']} ===")
                
                # Select barcode type
                await page.select_option('#barcodeType', test_case['type'])
                await page.wait_for_timeout(500)
                
                # Add content
                await page.evaluate(f"""() => {{
                    const container = document.getElementById('inputContainer');
                    if (container) {{
                        let input = container.querySelector('input, textarea');
                        if (!input) {{
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = '{test_case['content']}';
                            container.appendChild(input);
                        }} else {{
                            input.value = '{test_case['content']}';
                        }}
                    }}
                }}""")
                
                # Generate barcode
                await page.click('#generateBarcodeBtn')
                await page.wait_for_timeout(3000)
                
                # Check centering
                centering_info = await page.evaluate(f"""() => {{
                    const container = document.getElementById('generatedBarcodeContainer');
                    const barcodeOutput = document.getElementById('barcodeOutput');
                    const canvas = container.querySelector('canvas');
                    
                    if (!canvas || !container || !barcodeOutput) {{
                        return null;
                    }}
                    
                    const containerRect = container.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    const outputRect = barcodeOutput.getBoundingClientRect();
                    
                    // Calculate if canvas is centered within its container
                    const containerCenter = containerRect.left + (containerRect.width / 2);
                    const canvasCenter = canvasRect.left + (canvasRect.width / 2);
                    const centerDifference = Math.abs(containerCenter - canvasCenter);
                    
                    // Calculate if canvas is centered within the output area
                    const outputCenter = outputRect.left + (outputRect.width / 2);
                    const outputCenterDifference = Math.abs(outputCenter - canvasCenter);
                    
                    return {{
                        type: '{test_case['type']}',
                        hasSquareClass: container.classList.contains('square-barcode-container'),
                        containerWidth: containerRect.width,
                        canvasWidth: canvasRect.width,
                        canvasHeight: canvasRect.height,
                        aspectRatio: canvasRect.width / canvasRect.height,
                        centerDifference: centerDifference,
                        outputCenterDifference: outputCenterDifference,
                        containerStyles: window.getComputedStyle(container),
                        canvasLeft: canvasRect.left,
                        canvasRight: canvasRect.right,
                        containerLeft: containerRect.left,
                        containerRight: containerRect.right,
                        outputLeft: outputRect.left,
                        outputRight: outputRect.right
                    }};
                }}""")
                
                if centering_info:
                    print(f"Barcode type: {centering_info['type']}")
                    print(f"Square container class: {centering_info['hasSquareClass']}")
                    print(f"Expected square: {test_case['expected_square']}")
                    print(f"Canvas size: {centering_info['canvasWidth']:.1f} x {centering_info['canvasHeight']:.1f}")
                    print(f"Aspect ratio: {centering_info['aspectRatio']:.3f}")
                    print(f"Center difference (container): {centering_info['centerDifference']:.1f}px")
                    print(f"Center difference (output): {centering_info['outputCenterDifference']:.1f}px")
                    
                    # Check if square class is correctly applied
                    square_class_correct = (centering_info['hasSquareClass'] == test_case['expected_square'])
                    if square_class_correct:
                        print("✅ Square container class correctly applied")
                    else:
                        print("❌ Square container class incorrectly applied")
                    
                    # Check centering (tolerance of 5px)
                    is_centered = centering_info['outputCenterDifference'] <= 5
                    if is_centered:
                        print("✅ Barcode is properly centered")
                    else:
                        print(f"❌ Barcode is not centered (off by {centering_info['outputCenterDifference']:.1f}px)")
                    
                    # Take screenshot for this barcode type
                    await page.screenshot(path=f'screenshots/centering_test_{test_case["type"]}.png')
                    print(f"✓ Screenshot saved: centering_test_{test_case['type']}.png")
                else:
                    print("❌ Could not get centering information")
                
                await page.wait_for_timeout(1000)
            
            # Take a final screenshot showing the last barcode
            await page.screenshot(path='screenshots/centering_test_final.png')
            print("✓ Final screenshot saved")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    asyncio.run(test_barcode_centering())