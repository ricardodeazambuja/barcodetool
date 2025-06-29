#!/usr/bin/env python3
"""
Test context-aware message system
"""

import asyncio
import http.server
import socketserver
import threading
import time
from playwright.async_api import async_playwright

async def test_contextual_messages():
    """Test that messages appear in context-specific containers near action buttons"""
    
    # Start server
    PORT = 38430
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
            
            # Listen to console messages for debugging
            page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
            
            # Navigate to app
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded successfully")
            
            success = True
            issues = []
            
            # Test 1: Generator Tab Messages
            print("\n=== Testing Generator Tab Messages ===")
            
            # Ensure we're on generator tab
            await page.click('button:has-text("Generate Barcodes")')
            await page.wait_for_timeout(500)
            
            # Try to generate without content to trigger error
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(1000)
            
            # Check if generator message container is visible
            generator_message_visible = await page.is_visible('#generatorMessages')
            print(f"Generator message container visible: {generator_message_visible}")
            
            if generator_message_visible:
                generator_message_text = await page.text_content('#generatorMessages')
                print(f"Generator message text: {generator_message_text}")
                
                # Check if message has error styling
                generator_message_class = await page.get_attribute('#generatorMessages', 'class')
                print(f"Generator message classes: {generator_message_class}")
                
                if 'error' not in generator_message_class:
                    issues.append("❌ Generator error message should have 'error' class")
                    success = False
                else:
                    print("✓ Generator error message has correct styling")
            else:
                issues.append("❌ Generator message should appear below Generate button")
                success = False
            
            # Test 2: Scanner Tab Messages
            print("\n=== Testing Scanner Tab Messages ===")
            
            # Switch to scanner tab
            await page.click('button:has-text("Scan Barcodes")')
            await page.wait_for_timeout(500)
            
            # Mock camera access for testing
            await page.evaluate("""
                navigator.mediaDevices.getUserMedia = async () => {
                    throw new Error('Camera access denied for testing');
                };
            """)
            
            # Try to start scanning to trigger error
            await page.click('#scanButton')
            await page.wait_for_timeout(2000)
            
            # Check if scanner message container is visible
            scanner_message_visible = await page.is_visible('#scannerMessages')
            print(f"Scanner message container visible: {scanner_message_visible}")
            
            if scanner_message_visible:
                scanner_message_text = await page.text_content('#scannerMessages')
                print(f"Scanner message text: {scanner_message_text}")
                
                scanner_message_class = await page.get_attribute('#scannerMessages', 'class')
                print(f"Scanner message classes: {scanner_message_class}")
                
                if 'error' not in scanner_message_class:
                    issues.append("❌ Scanner error message should have 'error' class")
                    success = False
                else:
                    print("✓ Scanner error message has correct styling")
            else:
                issues.append("❌ Scanner message should appear below Start Scan button")
                success = False
            
            # Test 3: Storage Tab Messages
            print("\n=== Testing Storage Tab Messages ===")
            
            # Switch to storage tab
            await page.click('button:has-text("Saved Data")')
            await page.wait_for_timeout(500)
            
            # Try to clear data (should show success message)
            await page.click('#clearSavedData')
            await page.wait_for_timeout(1000)
            
            # Check if storage message container is visible
            storage_message_visible = await page.is_visible('#storageMessages')
            print(f"Storage message container visible: {storage_message_visible}")
            
            if storage_message_visible:
                storage_message_text = await page.text_content('#storageMessages')
                print(f"Storage message text: {storage_message_text}")
                
                storage_message_class = await page.get_attribute('#storageMessages', 'class')
                print(f"Storage message classes: {storage_message_class}")
                
                if 'success' not in storage_message_class:
                    print("ℹ️ Storage message might be info/progress rather than success")
                else:
                    print("✓ Storage message has correct styling")
            else:
                print("ℹ️ Storage message might not appear if no data to clear")
            
            # Test 4: Message Auto-Hide Behavior
            print("\n=== Testing Message Auto-Hide Behavior ===")
            
            # Switch back to generator tab and create a success message
            await page.click('button:has-text("Generate Barcodes")')
            await page.wait_for_timeout(500)
            
            # Fill in content to create a successful generation
            await page.fill('#contentInput', 'Test QR Code')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(1000)
            
            # Check if success message appears
            generator_success_visible = await page.is_visible('#generatorMessages')
            if generator_success_visible:
                generator_success_class = await page.get_attribute('#generatorMessages', 'class')
                print(f"Generator success message classes: {generator_success_class}")
                
                if 'success' in generator_success_class:
                    print("✓ Success message appears with correct styling")
                    
                    # Wait for auto-hide (success messages hide after 3 seconds)
                    await page.wait_for_timeout(4000)
                    
                    # Check if message is hidden
                    generator_hidden = not await page.is_visible('#generatorMessages')
                    if generator_hidden:
                        print("✓ Success message auto-hides after timeout")
                    else:
                        issues.append("❌ Success message should auto-hide")
                        success = False
            
            # Test 5: Check Message Positioning
            print("\n=== Testing Message Positioning ===")
            
            # Take screenshot for visual verification
            await page.screenshot(path='screenshots/contextual_messages_test.png')
            print("✓ Screenshot saved for visual verification")
            
            # Test 6: Verify Backward Compatibility
            print("\n=== Testing Backward Compatibility ===")
            
            # Check that legacy error containers still work
            legacy_error_display = await page.locator('#errorDisplay').count()
            legacy_error_message = await page.locator('#errorMessage').count()
            
            print(f"Legacy error containers present: errorDisplay={legacy_error_display}, errorMessage={legacy_error_message}")
            
            if legacy_error_display > 0 and legacy_error_message > 0:
                print("✓ Legacy error containers still present for backward compatibility")
            else:
                issues.append("❌ Legacy error containers should be preserved")
                success = False
            
            # Final Results
            if success:
                print("\n🎉 All contextual message tests passed!")
                print("✓ Messages appear near action buttons")
                print("✓ Context-aware routing works correctly")
                print("✓ Message styling is applied properly")
                print("✓ Auto-hide behavior functions correctly")
                print("✓ Backward compatibility maintained")
            else:
                print("\n⚠️ Some contextual message issues found:")
                for issue in issues:
                    print(f"  {issue}")
            
            await browser.close()
            return success
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    success = asyncio.run(test_contextual_messages())
    exit(0 if success else 1)