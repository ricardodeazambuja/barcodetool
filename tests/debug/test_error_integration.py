#!/usr/bin/env python3

import asyncio
import http.server
import socketserver
import threading
import time
from playwright.async_api import async_playwright
import os

class HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"{self.address_string()} - - [{self.log_date_time_string()}] {format % args}")

async def test_error_integration():
    # Start HTTP server
    port = 41235
    handler = HTTPRequestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    
    # Start server in background thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Serving on http://localhost:{port}")
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            
            # Wait for the application to load
            await page.wait_for_selector('#generateBarcodeBtn', timeout=5000)
            
            # Test 1: Try to generate barcode without any input (should show error in main area)
            print("Testing error message integration...")
            
            # Clear any existing messages
            await page.evaluate("document.getElementById('mainMessageArea')?.remove()")
            
            # Click generate without input
            await page.click('#generateBarcodeBtn')
            
            # Wait for error message to appear
            await page.wait_for_timeout(1000)
            
            # Check if main message area was created and shows error
            main_message = await page.query_selector('#mainMessageArea')
            if main_message:
                message_text = await main_message.inner_text()
                message_style = await main_message.get_attribute('style')
                print(f"✓ Main message area created with text: '{message_text}'")
                print(f"✓ Message styling: {message_style}")
                
                # Take screenshot of error state
                await page.screenshot(path='screenshots/error_message_test.png', full_page=True)
                print("✓ Screenshot saved: screenshots/error_message_test.png")
            else:
                print("✗ Main message area not found")
            
            # Test 2: Generate valid barcode to see success message
            print("\nTesting success message integration...")
            
            # Add some text input
            await page.fill('#textInput', 'Test QR Code')
            
            # Click generate
            await page.click('#generateBarcodeBtn')
            
            # Wait for processing
            await page.wait_for_timeout(3000)
            
            # Check for success message
            main_message = await page.query_selector('#mainMessageArea')
            if main_message:
                message_text = await main_message.inner_text()
                print(f"✓ Success message: '{message_text}'")
                
                # Take screenshot of success state
                await page.screenshot(path='screenshots/success_message_test.png', full_page=True)
                print("✓ Screenshot saved: screenshots/success_message_test.png")
            
            # Test 3: Test EAN-13 validation error
            print("\nTesting validation error integration...")
            
            # Switch to EAN-13
            await page.select_option('#barcodeType', 'ean13')
            await page.wait_for_timeout(500)
            
            # Try with invalid input (too many digits)
            text_input = await page.query_selector('#textInput')
            if text_input:
                await text_input.fill('123456789012345')  # Too many digits
                
                # Click generate
                await page.click('#generateBarcodeBtn')
                
                # Wait for error message
                await page.wait_for_timeout(1000)
                
                main_message = await page.query_selector('#mainMessageArea')
                if main_message:
                    message_text = await main_message.inner_text()
                    print(f"✓ Validation error message: '{message_text}'")
                    
                    # Take screenshot of validation error
                    await page.screenshot(path='screenshots/validation_error_test.png', full_page=True)
                    print("✓ Screenshot saved: screenshots/validation_error_test.png")
            
        except Exception as e:
            print(f"Error during test: {e}")
            await page.screenshot(path='screenshots/test_error.png', full_page=True)
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_error_integration())