#!/usr/bin/env python3
"""
Quick test for Code 128 regression fix
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

async def test_code128_regression():
    """Test that Code 128 doesn't get square treatment"""
    
    # Start server
    PORT = 38439
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
            
            # Generate QR code first
            await page.select_option('#barcodeType', 'qrcode')
            await page.wait_for_timeout(500)
            
            # Create content for QR code
            await page.evaluate("""() => {
                const container = document.getElementById('inputContainer');
                if (container) {
                    let input = container.querySelector('input, textarea');
                    if (!input) {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.value = 'QR Test';
                        container.appendChild(input);
                    } else {
                        input.value = 'QR Test';
                    }
                }
            }""")
            
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            # Check QR code is square
            qr_info = await page.evaluate("""() => {
                const container = document.getElementById('generatedBarcodeContainer');
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    return {
                        hasSquareClass: container.classList.contains('square-barcode-container'),
                        aspectRatio: rect.width / rect.height,
                        type: 'QR'
                    };
                }
                return null;
            }""")
            
            if qr_info:
                print(f"QR Code: Square class={qr_info['hasSquareClass']}, Aspect ratio={qr_info['aspectRatio']:.3f}")
            
            # Now switch to Code 128
            await page.select_option('#barcodeType', 'code128')
            await page.wait_for_timeout(500)
            
            # Add content for Code 128
            await page.evaluate("""() => {
                const container = document.getElementById('inputContainer');
                if (container) {
                    let input = container.querySelector('input, textarea');
                    if (!input) {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.value = 'Code 128 Test';
                        container.appendChild(input);
                    } else {
                        input.value = 'Code 128 Test';
                    }
                }
            }""")
            
            # Generate Code 128
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            # Check Code 128 is NOT square
            code128_info = await page.evaluate("""() => {
                const container = document.getElementById('generatedBarcodeContainer');
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    return {
                        hasSquareClass: container.classList.contains('square-barcode-container'),
                        aspectRatio: rect.width / rect.height,
                        width: rect.width,
                        height: rect.height,
                        type: 'Code128'
                    };
                }
                return null;
            }""")
            
            if code128_info:
                print(f"Code 128: Square class={code128_info['hasSquareClass']}, Aspect ratio={code128_info['aspectRatio']:.3f}")
                print(f"Code 128 size: {code128_info['width']:.1f} x {code128_info['height']:.1f}")
                
                if not code128_info['hasSquareClass']:
                    print("✅ Code 128 does NOT have square CSS class")
                else:
                    print("❌ Code 128 incorrectly has square CSS class")
                
                if code128_info['aspectRatio'] > 1.2:
                    print("✅ Code 128 has wide aspect ratio (not square)")
                else:
                    print("❌ Code 128 aspect ratio is too square")
            
            await page.screenshot(path='screenshots/code128_regression_fix_test.png')
            print("✓ Screenshot saved")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    asyncio.run(test_code128_regression())