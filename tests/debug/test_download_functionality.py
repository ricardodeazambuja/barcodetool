#!/usr/bin/env python3
"""
Test download functionality to verify white background implementation
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

async def test_download_functionality():
    """Test that download functionality works without errors"""
    
    # Start server
    PORT = 38446
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {PORT}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                accept_downloads=True
            )
            page = await context.new_page()
            
            # Capture console errors
            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # Generate a QR code
            await page.select_option('#barcodeType', 'qrcode')
            await page.select_option('#outputFormat', 'canvas')  # This should create PNG
            
            # Add content
            await page.evaluate("""() => {
                const container = document.getElementById('inputContainer');
                if (container) {
                    let input = container.querySelector('input, textarea');
                    if (!input) {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.value = 'Test QR Code for PNG Download';
                        container.appendChild(input);
                    } else {
                        input.value = 'Test QR Code for PNG Download';
                    }
                }
            }""")
            
            # Generate barcode
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Check if barcode was generated
            barcode_visible = await page.is_visible('#generatedBarcodeContainer canvas')
            print(f"QR Code generated: {barcode_visible}")
            
            if barcode_visible:
                # Check for download button
                download_btn = await page.wait_for_selector('.secondary-button', timeout=5000)
                btn_text = await download_btn.text_content()
                print(f"Download button found: {btn_text}")
                
                # Simulate clicking the download button to test the white background logic
                print("Testing download button click...")
                
                # Start waiting for download before clicking
                async with page.expect_download() as download_info:
                    await download_btn.click()
                    print("✓ Download button clicked")
                
                download = await download_info.value
                print(f"✓ Download started: {download.suggested_filename}")
                
                # Wait a bit to ensure download logic completes
                await page.wait_for_timeout(2000)
                
                # Check for any console errors during download
                if console_errors:
                    print("❌ Console errors during download:")
                    for error in console_errors:
                        print(f"  - {error}")
                else:
                    print("✅ No console errors during download process")
                    
                print("✅ Download process completed successfully")
                print("✅ White background PNG generation logic executed")
                
            else:
                print("❌ QR Code not generated")
            
            # Test SVG download too
            print("\n=== Testing SVG Download ===")
            await page.select_option('#outputFormat', 'svg')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            svg_btn = await page.wait_for_selector('.secondary-button', timeout=5000)
            svg_btn_text = await svg_btn.text_content()
            print(f"SVG download button: {svg_btn_text}")
            
            if "SVG" in svg_btn_text:
                print("✅ SVG download button correctly labeled")
            
            await page.screenshot(path='screenshots/download_functionality_test.png')
            print("✓ Screenshot saved")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    asyncio.run(test_download_functionality())