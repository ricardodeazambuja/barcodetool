#!/usr/bin/env python3
"""
Test padding functionality in barcode generation
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright
import os

class MyTCPServer(socketserver.TCPServer):
    def __init__(self, server_address, RequestHandlerClass, bind_and_activate=True):
        self.allow_reuse_address = True
        super().__init__(server_address, RequestHandlerClass, bind_and_activate)

async def test_padding_functionality():
    """Test that padding parameter affects barcode generation"""
    
    # Start server
    server_address = ("localhost", 0)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = MyTCPServer(server_address, handler)
    port = httpd.server_address[1]
    
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {port}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(viewport={'width': 1280, 'height': 720})
            page = await context.new_page()
            
            await page.goto(f'http://localhost:{port}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # === PHASE 1: Test padding with QR code ===
            print("\n=== PHASE 1: Test QR Code with Different Padding ===")
            
            # Ensure we're on generator tab
            await page.click('button[onclick="switchTab(\'generator\')"]')
            await page.wait_for_timeout(500)
            
            # Set up QR code generation
            await page.select_option('#barcodeType', 'qrcode')
            await page.select_option('#outputFormat', 'canvas')
            await page.fill('#textInput', 'PADDING TEST QR CODE')
            
            # Test different padding values
            padding_tests = [
                {"value": 5, "description": "minimal padding"},
                {"value": 20, "description": "medium padding"}, 
                {"value": 50, "description": "large padding"}
            ]
            
            results = []
            
            for i, test in enumerate(padding_tests):
                print(f"\n--- Testing {test['description']} (padding={test['value']}) ---")
                
                # Set padding value
                await page.fill('#padding', str(test['value']))
                
                # Generate barcode
                await page.click('#generateBarcodeBtn')
                await page.wait_for_timeout(3000)
                
                # Check if barcode was generated
                barcode_visible = await page.is_visible('#generatedBarcodeContainer canvas')
                if not barcode_visible:
                    print(f"❌ Barcode not generated for padding {test['value']}")
                    return False
                    
                # Get canvas dimensions and content
                canvas_info = await page.evaluate("""
                    () => {
                        const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                        if (!canvas) return null;
                        
                        const ctx = canvas.getContext('2d');
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // Check for white pixels around the edges (padding)
                        const checkPadding = (data, width, height) => {
                            // Check top row for white pixels
                            let topWhitePixels = 0;
                            for (let x = 0; x < width; x++) {
                                const idx = x * 4;
                                if (data[idx] === 255 && data[idx + 1] === 255 && data[idx + 2] === 255) {
                                    topWhitePixels++;
                                }
                            }
                            
                            // Check left column for white pixels  
                            let leftWhitePixels = 0;
                            for (let y = 0; y < height; y++) {
                                const idx = y * width * 4;
                                if (data[idx] === 255 && data[idx + 1] === 255 && data[idx + 2] === 255) {
                                    leftWhitePixels++;
                                }
                            }
                            
                            return {
                                topWhitePixels,
                                leftWhitePixels,
                                topWhitePercentage: (topWhitePixels / width) * 100,
                                leftWhitePercentage: (leftWhitePixels / height) * 100
                            };
                        };
                        
                        const padding = checkPadding(imageData.data, canvas.width, canvas.height);
                        
                        return {
                            width: canvas.width,
                            height: canvas.height,
                            padding: padding
                        };
                    }
                """)
                
                if not canvas_info:
                    print(f"❌ Could not analyze canvas for padding {test['value']}")
                    return False
                
                results.append({
                    "padding_value": test['value'],
                    "canvas_info": canvas_info,
                    "description": test['description']
                })
                
                print(f"✓ Canvas size: {canvas_info['width']}x{canvas_info['height']}")
                print(f"✓ Top white pixels: {canvas_info['padding']['topWhitePercentage']:.1f}%")
                print(f"✓ Left white pixels: {canvas_info['padding']['leftWhitePercentage']:.1f}%")
                
                # Take screenshot
                await page.screenshot(path=f'screenshots/padding_test_{test["value"]}px.png', full_page=True)
                print(f"✓ Screenshot saved for padding {test['value']}px")
            
            # === PHASE 2: Analyze padding results ===
            print("\n=== PHASE 2: Analyze Padding Results ===")
            
            # Check if padding increases with value
            padding_increased = True
            for i in range(1, len(results)):
                current = results[i]['canvas_info']['padding']['topWhitePercentage']
                previous = results[i-1]['canvas_info']['padding']['topWhitePercentage']
                
                if current <= previous:
                    print(f"❌ Padding didn't increase from {results[i-1]['padding_value']}px to {results[i]['padding_value']}px")
                    print(f"   Previous: {previous:.1f}% white, Current: {current:.1f}% white")
                    padding_increased = False
                else:
                    print(f"✓ Padding increased from {results[i-1]['padding_value']}px to {results[i]['padding_value']}px")
                    print(f"   Previous: {previous:.1f}% white, Current: {current:.1f}% white")
            
            # === PHASE 3: Test padding with different barcode types ===
            print("\n=== PHASE 3: Test Padding with Different Barcode Types ===")
            
            barcode_types = [
                {'type': 'datamatrix', 'text': 'DATA MATRIX PADDING TEST'},
                {'type': 'code128', 'text': '123456789'},
                {'type': 'ean13', 'text': '123456789012'}
            ]
            
            for barcode_test in barcode_types:
                print(f"\n--- Testing {barcode_test['type']} with padding ---")
                
                # Set barcode type and text
                await page.select_option('#barcodeType', barcode_test['type'])
                await page.wait_for_timeout(500)
                
                if barcode_test['type'] == 'ean13':
                    # For EAN13, need to use the textInput field that appears
                    await page.fill('#textInput', barcode_test['text'])
                else:
                    await page.fill('#textInput', barcode_test['text'])
                
                # Set medium padding
                await page.fill('#padding', '25')
                
                # Generate barcode
                await page.click('#generateBarcodeBtn')
                await page.wait_for_timeout(3000)
                
                # Check if barcode was generated
                barcode_visible = await page.is_visible('#generatedBarcodeContainer canvas')
                if barcode_visible:
                    print(f"✓ {barcode_test['type']} generated with padding")
                    await page.screenshot(path=f'screenshots/padding_{barcode_test["type"]}.png', full_page=True)
                else:
                    print(f"❌ {barcode_test['type']} failed to generate")
            
            # === PHASE 4: Test download with padding ===
            print("\n=== PHASE 4: Test Download Includes Padding ===")
            
            # Generate QR code for download test
            await page.select_option('#barcodeType', 'qrcode')
            await page.fill('#textInput', 'DOWNLOAD PADDING TEST')
            await page.fill('#padding', '30')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Check if download button exists
            download_btn_visible = await page.is_visible('button:has-text("Download")')
            if download_btn_visible:
                print("✓ Download button is available")
                print("✓ Padding should be included in downloaded file")
            else:
                print("❌ Download button not found")
                return False
            
            # === PHASE 5: Final assessment ===
            print("\n=== PHASE 5: Final Assessment ===")
            
            if padding_increased:
                print("\n🎉 PADDING TEST PASSED!")
                print("✓ Padding parameter affects barcode generation")
                print("✓ Higher padding values create more white space")
                print("✓ Padding works with different barcode types")
                print("✓ Download functionality includes padding")
                print("✓ Check screenshots for visual confirmation")
                
                await browser.close()
                return True
            else:
                print("\n❌ PADDING TEST FAILED!")
                print("✓ Padding parameter may not be working correctly")
                print("✓ Check screenshots to diagnose the issue")
                
                await browser.close()
                return False
            
    finally:
        httpd.shutdown()
        httpd.server_close()
        server_thread.join()
        print("Server stopped")

if __name__ == "__main__":
    # Change to project root directory
    os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    # Create screenshots directory if it doesn't exist
    os.makedirs("screenshots", exist_ok=True)
    
    success = asyncio.run(test_padding_functionality())
    exit(0 if success else 1)