#!/usr/bin/env python3
"""
Test visual verification of image upload - before and after fix
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

async def test_image_upload_visual_verification():
    """Test that image upload shows the image with detection box - VISUAL VERIFICATION"""
    
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
            
            # Generate QR code
            await page.click('button[onclick="switchTab(\'generator\')"]')
            await page.wait_for_timeout(500)
            await page.select_option('#barcodeType', 'qrcode')
            await page.fill('#textInput', 'VISUAL TEST QR CODE - This should be visible with detection box')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Get canvas data
            canvas_data = await page.evaluate("""
                () => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    return canvas ? canvas.toDataURL('image/png') : null;
                }
            """)
            
            if not canvas_data:
                print("❌ Could not generate test QR code")
                return False
            print("✓ Test QR Code generated")
            
            # === PHASE 2: Go to scanner and capture BEFORE state ===
            print("\n=== PHASE 2: Capture Scanner State BEFORE Upload ===")
            
            await page.click('button[onclick="switchTab(\'scanner\')"]')
            await page.wait_for_timeout(1000)
            
            # Capture initial canvas state
            canvas_state_before = await page.evaluate("""
                () => {
                    const canvas = document.getElementById('qrCanvas');
                    const style = window.getComputedStyle(canvas);
                    const context = canvas.getContext('2d');
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    return {
                        display: style.display,
                        width: canvas.width,
                        height: canvas.height,
                        hasContent: imageData.data.some(x => x !== 0),
                        canvasVisible: style.display !== 'none'
                    };
                }
            """)
            
            print(f"Canvas state BEFORE upload: {canvas_state_before}")
            
            # Take screenshot BEFORE upload
            await page.screenshot(path='screenshots/scanner_BEFORE_upload.png', full_page=True)
            print("✓ Screenshot taken BEFORE upload")
            
            # === PHASE 3: Upload image and capture AFTER state ===
            print("\n=== PHASE 3: Upload Image and Capture AFTER State ===")
            
            # Upload image
            upload_successful = await page.evaluate(f"""
                async () => {{
                    try {{
                        const base64Data = '{canvas_data}';
                        const response = await fetch(base64Data);
                        const blob = await response.blob();
                        const file = new File([blob], 'test_qr.png', {{ type: 'image/png' }});
                        
                        const fileInput = document.getElementById('imageUpload');
                        if (!fileInput) return false;
                        
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        
                        fileInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }} catch (error) {{
                        console.error('Upload error:', error);
                        return false;
                    }}
                }}
            """)
            
            if not upload_successful:
                print("❌ Failed to upload image")
                return False
            print("✓ Image upload initiated")
            
            # Wait for processing
            await page.wait_for_timeout(5000)
            
            # Capture canvas state AFTER upload
            canvas_state_after = await page.evaluate("""
                () => {
                    const canvas = document.getElementById('qrCanvas');
                    const style = window.getComputedStyle(canvas);
                    const context = canvas.getContext('2d');
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    return {
                        display: style.display,
                        width: canvas.width,
                        height: canvas.height,
                        hasContent: imageData.data.some(x => x !== 0),
                        canvasVisible: style.display !== 'none',
                        actualPixels: imageData.data.length
                    };
                }
            """)
            
            print(f"Canvas state AFTER upload: {canvas_state_after}")
            
            # Take screenshot AFTER upload
            await page.screenshot(path='screenshots/scanner_AFTER_upload.png', full_page=True)
            print("✓ Screenshot taken AFTER upload")
            
            # Check scan result
            scan_result_visible = await page.is_visible('#scanResult')
            if scan_result_visible:
                result_text = await page.text_content('#scanResult')
                print(f"✓ Scan result: {result_text}")
            else:
                print("❌ No scan result visible")
            
            # === PHASE 4: Analysis ===
            print("\n=== PHASE 4: Visual Analysis ===")
            
            # Check if canvas became visible
            canvas_became_visible = canvas_state_after['canvasVisible'] and not canvas_state_before['canvasVisible']
            print(f"Canvas became visible: {canvas_became_visible}")
            
            # Check if canvas has content
            canvas_has_content = canvas_state_after['hasContent']
            print(f"Canvas has content: {canvas_has_content}")
            
            # Check if canvas size changed (indicating image was loaded)
            canvas_size_changed = (canvas_state_after['width'] != canvas_state_before['width'] or 
                                 canvas_state_after['height'] != canvas_state_before['height'])
            print(f"Canvas size changed: {canvas_size_changed}")
            
            # Overall assessment
            if canvas_became_visible and canvas_has_content and scan_result_visible:
                print("\n🎉 VISUAL TEST PASSED!")
                print("✓ Canvas became visible")
                print("✓ Canvas has image content") 
                print("✓ Scan result displayed")
                print("✓ Check screenshots for visual confirmation")
                
                await browser.close()
                return True
            else:
                print("\n❌ VISUAL TEST FAILED!")
                print(f"  Canvas visible: {canvas_state_after['canvasVisible']}")
                print(f"  Canvas content: {canvas_has_content}")
                print(f"  Scan result: {scan_result_visible}")
                print("✓ Check screenshots to see what's missing")
                
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
    
    success = asyncio.run(test_image_upload_visual_verification())
    exit(0 if success else 1)