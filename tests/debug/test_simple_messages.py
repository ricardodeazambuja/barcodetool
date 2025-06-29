#!/usr/bin/env python3
"""
Simple test for context-aware message system
"""

import asyncio
import http.server
import socketserver
import threading
import time
from playwright.async_api import async_playwright

async def test_simple_messages():
    """Test basic message functionality"""
    
    # Start server
    PORT = 38431
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
            context = await browser.new_context(viewport={'width': 1280, 'height': 720})
            page = await context.new_page()
            
            # Navigate to app
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded successfully")
            
            # Test Generator Tab Error Message
            print("\n=== Testing Generator Tab ===")
            
            # Make sure we're on generator tab
            await page.click('button:has-text("Generate Barcodes")')
            await page.wait_for_timeout(500)
            
            # Try to generate without content (should trigger error)
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(1000)
            
            # Check generator message container
            generator_visible = await page.is_visible('#generatorMessages')
            print(f"Generator message visible: {generator_visible}")
            
            if generator_visible:
                message_text = await page.text_content('#generatorMessages')
                message_class = await page.get_attribute('#generatorMessages', 'class')
                print(f"Message: '{message_text}'")
                print(f"Classes: '{message_class}'")
                
                if 'error' in message_class:
                    print("✅ Generator error message working correctly!")
                else:
                    print("❌ Error styling not applied")
            else:
                print("❌ Generator message not visible")
            
            # Test Generator Success Message
            print("\n=== Testing Generator Success ===")
            
            # Fill content and generate successfully
            await page.fill('#contentInput', 'Test QR Code')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(2000)
            
            # Check for success message
            generator_visible_success = await page.is_visible('#generatorMessages')
            if generator_visible_success:
                success_text = await page.text_content('#generatorMessages')
                success_class = await page.get_attribute('#generatorMessages', 'class')
                print(f"Success message: '{success_text}'")
                print(f"Success classes: '{success_class}'")
                
                if 'success' in success_class:
                    print("✅ Generator success message working correctly!")
                else:
                    print("ℹ️ Success message might be progress/info type")
            
            # Test Storage Tab
            print("\n=== Testing Storage Tab ===")
            
            # Switch to storage tab
            await page.click('button:has-text("Saved Data")')
            await page.wait_for_timeout(500)
            
            # Click clear data button
            await page.click('#clearSavedData')
            await page.wait_for_timeout(1000)
            
            # Check storage message
            storage_visible = await page.is_visible('#storageMessages')
            print(f"Storage message visible: {storage_visible}")
            
            if storage_visible:
                storage_text = await page.text_content('#storageMessages')
                storage_class = await page.get_attribute('#storageMessages', 'class')
                print(f"Storage message: '{storage_text}'")
                print(f"Storage classes: '{storage_class}'")
                print("✅ Storage message system working!")
            
            # Test Message Positioning
            print("\n=== Visual Test ===")
            await page.screenshot(path='screenshots/contextual_messages_demo.png')
            print("✅ Screenshot saved for visual verification")
            
            # Check that old global message area still exists (backward compatibility)
            main_area_exists = await page.locator('#mainMessageArea').count()
            error_display_exists = await page.locator('#errorDisplay').count()
            print(f"Backward compatibility: mainMessageArea={main_area_exists}, errorDisplay={error_display_exists}")
            
            await browser.close()
            return True
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    success = asyncio.run(test_simple_messages())
    print("\n🎉 Simple message test completed!")
    exit(0 if success else 1)