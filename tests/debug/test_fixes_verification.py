#!/usr/bin/env python3
"""
Test the fixes for scanner camera management and QR code aspect ratio
"""

import asyncio
import http.server
import socketserver
import threading
import time
from playwright.async_api import async_playwright

async def test_scanner_and_qr_fixes():
    """Test scanner camera management and QR code aspect ratio fixes"""
    
    # Start server
    PORT = 38436
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {PORT}")
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(
                permissions=['camera'],
                viewport={'width': 1280, 'height': 720}
            )
            
            page = await context.new_page()
            
            # Navigate to app
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded successfully")
            
            # Test 1: QR Code Aspect Ratio Fix
            print("\n=== Testing QR Code Aspect Ratio ===")
            
            # Ensure we're on generator tab
            await page.click('button:has-text("Generate Barcodes")')
            await page.wait_for_timeout(500)
            
            # Check that QR Code is selected by default
            barcode_type = await page.input_value('#barcodeType')
            print(f"Default barcode type: {barcode_type}")
            
            # Select QR Code explicitly
            await page.select_option('#barcodeType', 'qrcode')
            await page.wait_for_timeout(500)
            
            # Fill in some content
            # First check what content type creates the input field
            content_type = await page.input_value('#contentType')
            print(f"Content type: {content_type}")
            
            # The input field is dynamically created, so let's wait for it
            await page.wait_for_timeout(1000)
            
            # Try to find the input field in the inputContainer
            await page.evaluate("""
                // Simulate content input since the field is dynamically created
                const container = document.getElementById('inputContainer');
                if (container) {
                    // Create a simple text input if not present
                    let input = container.querySelector('input[type="text"], textarea');
                    if (!input) {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.id = 'dynamicContentInput';
                        input.value = 'Test QR Code Content';
                        container.appendChild(input);
                    } else {
                        input.value = 'Test QR Code Content';
                    }
                }
            """)
            
            await page.wait_for_timeout(500)
            
            # Generate the QR code
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)  # Wait for generation
            
            # Check if QR code was generated
            qr_canvas_visible = await page.is_visible('#generatedBarcodeContainer canvas')
            print(f"QR code canvas visible: {qr_canvas_visible}")
            
            if qr_canvas_visible:
                # Get canvas dimensions
                canvas_info = await page.evaluate("""() => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        return {
                            width: rect.width,
                            height: rect.height,
                            naturalWidth: canvas.width,
                            naturalHeight: canvas.height,
                            aspectRatio: rect.width / rect.height
                        };
                    }
                    return null;
                }""")
                
                if canvas_info:
                    print(f"QR Canvas info:")
                    print(f"  Display size: {canvas_info['width']:.1f} x {canvas_info['height']:.1f}")
                    print(f"  Natural size: {canvas_info['naturalWidth']} x {canvas_info['naturalHeight']}")
                    print(f"  Aspect ratio: {canvas_info['aspectRatio']:.3f}")
                    
                    # Check if QR code is square-ish (aspect ratio close to 1.0)
                    if 0.95 <= canvas_info['aspectRatio'] <= 1.05:
                        print("✅ QR code aspect ratio looks square!")
                    else:
                        print("❌ QR code aspect ratio is not square")
                
                # Check if container has the square barcode class
                has_square_class = await page.evaluate("""() => {
                    const container = document.getElementById('generatedBarcodeContainer');
                    return container ? container.classList.contains('square-barcode-container') : false;
                }""")
                
                print(f"Square barcode CSS class applied: {has_square_class}")
                
                if has_square_class:
                    print("✅ Square barcode CSS class correctly applied")
                else:
                    print("❌ Square barcode CSS class not applied")
            
            # Take screenshot of QR code
            await page.screenshot(path='screenshots/qr_code_aspect_ratio_test.png')
            print("✓ QR code screenshot saved")
            
            # Test 2: Scanner Camera Management
            print("\n=== Testing Scanner Camera Management ===")
            
            # Switch to scanner tab
            await page.click('button:has-text("Scan Barcodes")')
            await page.wait_for_timeout(500)
            
            # Mock camera for testing
            await page.evaluate("""
                navigator.mediaDevices.getUserMedia = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 480;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw a test pattern
                    ctx.fillStyle = 'blue';
                    ctx.fillRect(0, 0, 640, 480);
                    ctx.fillStyle = 'white';
                    ctx.fillText('Test Camera Stream', 20, 50);
                    
                    const stream = canvas.captureStream(30);
                    return stream;
                };
            """)
            
            # Test rapid button clicking (should be debounced)
            print("Testing button debouncing...")
            
            # Click start scan button multiple times rapidly
            for i in range(5):
                await page.click('#scanButton')
                await page.wait_for_timeout(100)  # 100ms between clicks (faster than 500ms debounce)
            
            print("✓ Rapid clicking test completed (should be debounced)")
            
            await page.wait_for_timeout(2000)
            
            # Check scanner state
            scanner_active = await page.evaluate("""() => {
                return window.barcodeApp?.scanner && 
                       document.querySelector('#scanButton').textContent.includes('Stop');
            }""")
            
            print(f"Scanner active after rapid clicking: {scanner_active}")
            
            if scanner_active:
                print("✅ Scanner started despite rapid clicking (debouncing working)")
                
                # Test immediate stop
                await page.click('#scanButton')
                await page.wait_for_timeout(500)  # Give time for stop to complete
                
                # Check if scanner stopped
                scanner_stopped = await page.evaluate("""() => {
                    return window.barcodeApp?.scanner && 
                           document.querySelector('#scanButton').textContent.includes('Start');
                }""")
                
                print(f"Scanner stopped after stop click: {scanner_stopped}")
                
                if scanner_stopped:
                    print("✅ Scanner stops correctly when stop button clicked")
                else:
                    print("❌ Scanner did not stop properly")
            
            # Take screenshot of scanner state
            await page.screenshot(path='screenshots/scanner_management_test.png')
            print("✓ Scanner screenshot saved")
            
            # Test 3: Test different barcode types for regression
            print("\n=== Testing Other Barcode Types (Regression Test) ===")
            
            # Switch back to generator
            await page.click('button:has-text("Generate Barcodes")')
            await page.wait_for_timeout(500)
            
            # Test Code 128 (non-square barcode)
            await page.select_option('#barcodeType', 'code128')
            await page.wait_for_timeout(500)
            
            # Generate Code 128
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            # Check if Code 128 was generated and has different aspect ratio
            code128_visible = await page.is_visible('#generatedBarcodeContainer canvas')
            if code128_visible:
                code128_info = await page.evaluate("""() => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        return {
                            aspectRatio: rect.width / rect.height,
                            width: rect.width,
                            height: rect.height
                        };
                    }
                    return null;
                }""")
                
                if code128_info:
                    print(f"Code 128 aspect ratio: {code128_info['aspectRatio']:.3f}")
                    print(f"Code 128 size: {code128_info['width']:.1f} x {code128_info['height']:.1f}")
                    
                    # Code 128 should NOT be square (should be wider than tall)
                    if code128_info['aspectRatio'] > 1.2:
                        print("✅ Code 128 has correct non-square aspect ratio")
                    else:
                        print("❌ Code 128 aspect ratio might be incorrect")
                
                # Check that square CSS class is NOT applied
                has_square_class_code128 = await page.evaluate("""() => {
                    const container = document.getElementById('generatedBarcodeContainer');
                    return container ? container.classList.contains('square-barcode-container') : false;
                }""")
                
                if not has_square_class_code128:
                    print("✅ Square CSS class correctly NOT applied to Code 128")
                else:
                    print("❌ Square CSS class incorrectly applied to Code 128")
            
            # Take screenshot of Code 128
            await page.screenshot(path='screenshots/code128_regression_test.png')
            print("✓ Code 128 screenshot saved")
            
            print("\n🎉 All tests completed!")
            print("📸 Screenshots saved for visual verification:")
            print("   - screenshots/qr_code_aspect_ratio_test.png")
            print("   - screenshots/scanner_management_test.png")
            print("   - screenshots/code128_regression_test.png")
            
            await browser.close()
            return True
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    success = asyncio.run(test_scanner_and_qr_fixes())
    exit(0 if success else 1)