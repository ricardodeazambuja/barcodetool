#!/usr/bin/env python3
"""
Test the complete generator->scanner image upload workflow
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

async def test_generator_to_scanner_workflow():
    """Test generating a barcode, then uploading to scanner"""
    
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
            
            # Listen to console messages
            page.on("console", lambda msg: print(f"Browser: {msg.text}"))
            
            await page.goto(f'http://localhost:{port}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # === PHASE 1: Generate a test QR code ===
            print("\n=== PHASE 1: Generate QR Code ===")
            
            # Ensure we're on generator tab
            await page.click('button[onclick="switchTab(\'generator\')"]')
            await page.wait_for_timeout(500)
            
            # Set up QR code generation
            await page.select_option('#barcodeType', 'qrcode')
            await page.select_option('#outputFormat', 'canvas')  # For PNG
            
            # Add test content
            await page.fill('#textInput', 'Test QR Code for Upload - https://example.com/test')
            
            # Generate the QR code
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Check if barcode was generated
            qr_generated = await page.is_visible('#generatedBarcodeContainer canvas')
            if not qr_generated:
                print("❌ QR code was not generated")
                return False
            print("✓ QR Code generated successfully")
            
            # Get the canvas as base64 image data for testing
            canvas_data = await page.evaluate("""
                () => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    if (canvas) {
                        return canvas.toDataURL('image/png');
                    }
                    return null;
                }
            """)
            if not canvas_data:
                print("❌ Could not extract canvas data")
                return False
            print("✓ QR Code canvas data extracted")
            
            # === PHASE 2: Switch to scanner and test upload ===
            print("\n=== PHASE 2: Test Image Upload in Scanner ===")
            
            # Switch to scanner tab
            await page.click('button[onclick="switchTab(\'scanner\')"]')
            await page.wait_for_timeout(1000)
            
            # Check if upload button exists and is enabled
            upload_btn_visible = await page.is_visible('#imageUploadBtn')
            if not upload_btn_visible:
                print("❌ Image upload button not found - feature not implemented")
                return False
            print("✓ Image upload button is visible")
            
            upload_btn_enabled = await page.evaluate("!document.getElementById('imageUploadBtn').disabled")
            if not upload_btn_enabled:
                print("❌ Upload button should be enabled initially")
                return False
            print("✓ Image upload button is enabled")
            
            # === PHASE 3: Test disable/enable during camera scan ===
            print("\n=== PHASE 3: Test Button State During Camera Scan ===")
            
            # Mock camera for testing
            await page.evaluate("""
                navigator.mediaDevices.getUserMedia = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 480;
                    const stream = canvas.captureStream(30);
                    return stream;
                };
            """)
            
            # Start camera scan (should disable upload)
            await page.click('#scanButton')
            await page.wait_for_timeout(2000)
            
            upload_btn_disabled_during_scan = await page.evaluate("document.getElementById('imageUploadBtn').disabled")
            if not upload_btn_disabled_during_scan:
                print("❌ Upload button should be disabled during camera scan")
                return False
            print("✓ Upload button correctly disabled during camera scan")
            
            # Stop camera scan (should re-enable upload)
            await page.click('#scanButton')  # Stop scan
            await page.wait_for_timeout(1000)
            
            upload_btn_enabled_after_scan = await page.evaluate("!document.getElementById('imageUploadBtn').disabled")
            if not upload_btn_enabled_after_scan:
                print("❌ Upload button should be re-enabled after stopping scan")
                return False
            print("✓ Upload button correctly re-enabled after stopping scan")
            
            # === PHASE 4: Test actual image upload ===
            print("\n=== PHASE 4: Test Actual Image Upload ===")
            
            # Convert base64 to blob and simulate file upload
            test_successful = await page.evaluate(f"""
                async () => {{
                    try {{
                        // Convert base64 to blob
                        const base64Data = '{canvas_data}';
                        const response = await fetch(base64Data);
                        const blob = await response.blob();
                        
                        // Create a File object
                        const file = new File([blob], 'test_qr.png', {{ type: 'image/png' }});
                        
                        // Get the file input and simulate file selection
                        const fileInput = document.getElementById('imageUpload');
                        if (!fileInput) return false;
                        
                        // Create a FileList-like object
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        
                        // Trigger the change event
                        fileInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        
                        return true;
                    }} catch (error) {{
                        console.error('Upload simulation error:', error);
                        return false;
                    }}
                }}
            """)
            
            if not test_successful:
                print("❌ Failed to simulate image upload")
                return False
            print("✓ Image upload simulated successfully")
            
            # Wait for processing
            await page.wait_for_timeout(5000)
            
            # Check for scan result
            scan_result_visible = await page.is_visible('#scanResult')
            if scan_result_visible:
                result_text = await page.text_content('#scanResult')
                print(f"✓ Scan result displayed: {result_text}")
                
                # Verify the scanned content matches what we generated
                expected_content = 'Test QR Code for Upload - https://example.com/test'
                if expected_content in result_text:
                    print("✓ Scanned content matches generated content")
                    
                    print("\n🎉 FULL WORKFLOW TEST PASSED!")
                    print("✓ Generator creates QR code")
                    print("✓ Scanner UI shows upload button") 
                    print("✓ Upload button disables during camera scan")
                    print("✓ Upload button re-enables after camera stop")
                    print("✓ Image upload processes successfully")
                    print("✓ Scanned content matches generated content")
                    
                    # Take final screenshot
                    await page.screenshot(path='screenshots/image_upload_workflow_success.png')
                    print("✓ Success screenshot saved")
                    
                    await browser.close()
                    return True
                else:
                    print(f"❌ Scanned content doesn't match. Expected: {expected_content}, Got: {result_text}")
                    return False
            else:
                print("❌ Scan result not displayed - upload processing may have failed")
                
                # Take failure screenshot for debugging
                await page.screenshot(path='screenshots/image_upload_workflow_failure.png')
                print("✓ Failure screenshot saved for debugging")
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
    
    success = asyncio.run(test_generator_to_scanner_workflow())
    exit(0 if success else 1)