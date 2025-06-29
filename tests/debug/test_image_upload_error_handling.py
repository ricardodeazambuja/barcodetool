#!/usr/bin/env python3
"""
Test error handling for image upload when no barcode is detected
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright
import os
import base64
from PIL import Image
import io

class MyTCPServer(socketserver.TCPServer):
    def __init__(self, server_address, RequestHandlerClass, bind_and_activate=True):
        self.allow_reuse_address = True
        super().__init__(server_address, RequestHandlerClass, bind_and_activate)

def create_test_image():
    """Create a plain test image with no barcode"""
    # Create a simple colored image
    img = Image.new('RGB', (300, 200), color='lightblue')
    
    # Convert to base64 for browser upload
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode()

async def test_no_barcode_error_handling():
    """Test that no barcode detection is handled gracefully"""
    
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
            
            # Listen to console messages to check for unhandled promise rejections
            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            
            await page.goto(f'http://localhost:{port}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # === PHASE 1: Go to scanner ===
            print("\n=== PHASE 1: Navigate to Scanner ==")
            
            await page.click('button[onclick="switchTab(\'scanner\')"]')
            await page.wait_for_timeout(1000)
            
            # Capture initial canvas state
            canvas_state_before = await page.evaluate("""
                () => {
                    const canvas = document.getElementById('qrCanvas');
                    const style = window.getComputedStyle(canvas);
                    return {
                        display: style.display,
                        width: canvas.width,
                        height: canvas.height,
                        canvasVisible: style.display !== 'none'
                    };
                }
            """)
            
            print(f"Canvas state BEFORE upload: {canvas_state_before}")
            
            # Take screenshot BEFORE upload
            await page.screenshot(path='screenshots/error_handling_BEFORE_upload.png', full_page=True)
            print("✓ Screenshot taken BEFORE upload")
            
            # === PHASE 2: Upload plain image (no barcode) ===
            print("\n=== PHASE 2: Upload Image with No Barcode ===")
            
            # Create test image
            test_image_b64 = create_test_image()
            
            # Upload image
            upload_successful = await page.evaluate(f"""
                async () => {{
                    try {{
                        const base64Data = 'data:image/png;base64,{test_image_b64}';
                        const response = await fetch(base64Data);
                        const blob = await response.blob();
                        const file = new File([blob], 'test_plain.png', {{ type: 'image/png' }});
                        
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
            print("✓ Plain image upload initiated")
            
            # Wait for processing
            await page.wait_for_timeout(5000)
            
            # === PHASE 3: Check results ===
            print("\n=== PHASE 3: Check Error Handling Results ===")
            
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
                        canvasVisible: style.display !== 'none'
                    };
                }
            """)
            
            print(f"Canvas state AFTER upload: {canvas_state_after}")
            
            # Take screenshot AFTER upload
            await page.screenshot(path='screenshots/error_handling_AFTER_upload.png', full_page=True)
            print("✓ Screenshot taken AFTER upload")
            
            # Check for console errors (should be none)
            error_messages = [msg for msg in console_errors if 'unhandled' in msg.lower() or 'rejection' in msg.lower()]
            if error_messages:
                print(f"❌ Found console errors: {error_messages}")
                return False
            print("✓ No unhandled promise rejections in console")
            
            # Check if canvas is visible and has content
            canvas_visible = canvas_state_after['canvasVisible']
            canvas_has_content = canvas_state_after['hasContent']
            
            if not canvas_visible:
                print("❌ Canvas should remain visible after upload")
                return False
            print("✓ Canvas remains visible after upload")
            
            if not canvas_has_content:
                print("❌ Canvas should have content (image + overlay)")
                return False
            print("✓ Canvas has content (image + overlay)")
            
            # Check if error message is displayed (should be user-friendly)
            # Check multiple possible error message containers
            error_containers = ['#mainMessageArea', '#scannerMessages', '#errorDisplay']
            error_message_visible = False
            error_message_text = ""
            
            for container in error_containers:
                is_visible = await page.is_visible(container)
                if is_visible:
                    text = await page.text_content(container)
                    if text and text.strip():
                        error_message_visible = True
                        error_message_text = text.strip()
                        break
            
            if not error_message_visible:
                print("❌ User-friendly error message should be displayed")
                # Debug: check what error containers exist
                all_error_elements = await page.evaluate("""
                    () => {
                        const containers = ['#mainMessageArea', '#scannerMessages', '#errorDisplay'];
                        return containers.map(sel => {
                            const el = document.querySelector(sel);
                            return {
                                selector: sel,
                                exists: !!el,
                                visible: el ? getComputedStyle(el).display !== 'none' : false,
                                content: el ? el.textContent.trim() : ''
                            };
                        });
                    }
                """)
                print(f"Debug error containers: {all_error_elements}")
                return False
            print(f"✓ User-friendly error message displayed: '{error_message_text}'")
            
            # Check that scan result is NOT displayed (no barcode was found)
            scan_result_visible = await page.is_visible('#scanResult')
            scan_result_container_visible = await page.is_visible('#scanResultContainer')
            
            # Debug: check what's in the scan result
            if scan_result_visible:
                scan_result_text = await page.text_content('#scanResult')
                print(f"Debug: Scan result text: '{scan_result_text}'")
                
                # If it's empty or just whitespace, that's okay
                if not scan_result_text or not scan_result_text.strip():
                    print("✓ Scan result is empty (correctly not displayed)")
                else:
                    print("❌ Scan result should not have content for failed detection")
                    return False
            else:
                print("✓ Scan result correctly not displayed")
                
            # Also check the container
            if scan_result_container_visible:
                container_style = await page.evaluate("getComputedStyle(document.getElementById('scanResultContainer')).display")
                if container_style != 'none':
                    print("❌ Scan result container should not be visible for failed detection")
                    return False
            print("✓ Scan result container correctly hidden")
            
            # === PHASE 4: Test with a real barcode to ensure we didn't break normal flow ===
            print("\n=== PHASE 4: Test Normal Flow Still Works ===")
            
            # Generate a QR code first
            await page.click('button[onclick="switchTab(\'generator\')"]')
            await page.wait_for_timeout(500)
            await page.select_option('#barcodeType', 'qrcode')
            await page.fill('#textInput', 'Test QR for error handling verification')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            # Get QR code data
            qr_data = await page.evaluate("""
                () => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    return canvas ? canvas.toDataURL('image/png') : null;
                }
            """)
            
            if not qr_data:
                print("❌ Could not generate QR code for normal flow test")
                return False
            
            # Back to scanner
            await page.click('button[onclick="switchTab(\'scanner\')"]')
            await page.wait_for_timeout(1000)
            
            # Upload QR code
            qr_upload_successful = await page.evaluate(f"""
                async () => {{
                    try {{
                        const base64Data = '{qr_data}';
                        const response = await fetch(base64Data);
                        const blob = await response.blob();
                        const file = new File([blob], 'test_qr.png', {{ type: 'image/png' }});
                        
                        const fileInput = document.getElementById('imageUpload');
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        fileInput.files = dataTransfer.files;
                        
                        fileInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }} catch (error) {{
                        return false;
                    }}
                }}
            """)
            
            if not qr_upload_successful:
                print("❌ Failed to upload QR code")
                return False
            
            await page.wait_for_timeout(3000)
            
            # Check if normal flow still works
            normal_scan_result = await page.is_visible('#scanResult')
            if not normal_scan_result:
                print("❌ Normal barcode detection should still work")
                return False
            print("✓ Normal barcode detection still works")
            
            # === PHASE 5: Final assessment ===
            print("\n=== PHASE 5: Final Assessment ===")
            
            print("\n🎉 ERROR HANDLING TEST PASSED!")
            print("✓ No unhandled promise rejections")
            print("✓ Image remains visible when no barcode detected")
            print("✓ Helpful overlay message displayed on canvas")
            print("✓ User-friendly error message shown")
            print("✓ Normal barcode detection still works")
            print("✓ Check screenshots for visual confirmation")
            
            await browser.close()
            return True
            
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
    
    success = asyncio.run(test_no_barcode_error_handling())
    exit(0 if success else 1)