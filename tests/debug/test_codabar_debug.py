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

async def test_codabar_generation():
    # Start HTTP server
    port = 41236
    handler = HTTPRequestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    
    # Start server in background thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Serving on http://localhost:{port}")
    
    async with async_playwright() as p:
        # Launch browser with console logging
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Collect console messages
        console_messages = []
        
        def handle_console(msg):
            console_messages.append({
                'type': msg.type,
                'text': msg.text,
                'location': msg.location
            })
            print(f"CONSOLE [{msg.type}]: {msg.text}")
        
        page.on('console', handle_console)
        
        # Also capture JavaScript errors
        page.on('pageerror', lambda exc: print(f"PAGE ERROR: {exc}"))
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            
            # Wait for the application to load
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            print("✓ Application loaded successfully")
            
            # Take initial screenshot
            await page.screenshot(path='screenshots/codabar_test_01_initial.png', full_page=True)
            print("✓ Initial screenshot saved")
            
            # Test CODABAR generation
            print("\n=== Testing CODABAR Generation ===")
            
            # Step 1: Select CODABAR barcode type
            await page.select_option('#barcodeType', 'codabar')
            await page.wait_for_timeout(1000)  # Wait for UI to update
            print("✓ Selected CODABAR barcode type")
            
            # Take screenshot after selecting CODABAR
            await page.screenshot(path='screenshots/codabar_test_02_selected.png', full_page=True)
            print("✓ Screenshot after CODABAR selection saved")
            
            # Step 2: Enter valid CODABAR data
            # CODABAR format: Start with A/B/C/D, end with A/B/C/D, digits and special chars in between
            valid_codabar = "A123456789B"
            
            # Find the text input field
            text_input = await page.query_selector('#textInput')
            if text_input:
                await text_input.fill(valid_codabar)
                print(f"✓ Entered valid CODABAR data: {valid_codabar}")
            else:
                print("✗ Could not find text input field")
                return
            
            # Take screenshot after entering data
            await page.screenshot(path='screenshots/codabar_test_03_data_entered.png', full_page=True)
            print("✓ Screenshot after data entry saved")
            
            # Step 3: Try to generate barcode
            print("\n--- Attempting to generate CODABAR barcode ---")
            
            # Clear console messages before generation
            console_messages.clear()
            
            await page.click('#generateBarcodeBtn')
            print("✓ Clicked generate button")
            
            # Wait for processing and capture any errors
            await page.wait_for_timeout(5000)
            
            # Take screenshot after generation attempt
            await page.screenshot(path='screenshots/codabar_test_04_after_generation.png', full_page=True)
            print("✓ Screenshot after generation attempt saved")
            
            # Check for error messages in the main UI
            main_message = await page.query_selector('#mainMessageArea')
            if main_message:
                is_visible = await main_message.is_visible()
                if is_visible:
                    message_text = await main_message.inner_text()
                    message_style = await main_message.get_attribute('style')
                    print(f"📍 Main message area text: '{message_text}'")
                    print(f"📍 Main message area style: {message_style}")
                else:
                    print("📍 Main message area exists but is not visible")
            else:
                print("📍 No main message area found")
            
            # Check for generated barcode
            generated_container = await page.query_selector('#generatedBarcodeContainer')
            if generated_container:
                is_visible = await generated_container.is_visible()
                children = await generated_container.query_selector_all('*')
                print(f"📍 Generated barcode container visible: {is_visible}")
                print(f"📍 Generated barcode container children: {len(children)}")
                
                if children:
                    for i, child in enumerate(children):
                        tag_name = await child.evaluate('el => el.tagName')
                        print(f"  Child {i}: {tag_name}")
            else:
                print("📍 No generated barcode container found")
            
            # Test with invalid CODABAR data to see validation
            print("\n--- Testing CODABAR validation ---")
            invalid_codabar = "123456789"  # No start/end characters
            
            if text_input:
                await text_input.fill(invalid_codabar)
                print(f"✓ Entered invalid CODABAR data: {invalid_codabar}")
                
                # Clear console messages
                console_messages.clear()
                
                await page.click('#generateBarcodeBtn')
                await page.wait_for_timeout(2000)
                
                # Take screenshot of validation error
                await page.screenshot(path='screenshots/codabar_test_05_validation_error.png', full_page=True)
                print("✓ Screenshot of validation error saved")
                
                # Check validation message
                main_message = await page.query_selector('#mainMessageArea')
                if main_message:
                    is_visible = await main_message.is_visible()
                    if is_visible:
                        message_text = await main_message.inner_text()
                        print(f"📍 Validation error message: '{message_text}'")
            
            # Print all console messages captured during the test
            print("\n=== Console Messages Summary ===")
            for i, msg in enumerate(console_messages):
                print(f"{i+1}. [{msg['type']}] {msg['text']}")
                if msg['location']:
                    print(f"   Location: {msg['location']}")
            
            # Try to get more detailed error information
            print("\n=== Checking for JavaScript errors ===")
            
            # Execute JavaScript to check for any global error states
            js_check = await page.evaluate("""
                () => {
                    const errors = [];
                    
                    // Check if BWIP-JS is loaded
                    if (typeof bwipjs === 'undefined') {
                        errors.push('BWIP-JS library not loaded');
                    } else {
                        errors.push('BWIP-JS library is loaded');
                    }
                    
                    // Check application state
                    if (typeof window.barcodeApp !== 'undefined') {
                        errors.push('Barcode app is initialized');
                        if (window.barcodeApp.generator) {
                            errors.push('Generator module is available');
                        } else {
                            errors.push('Generator module is NOT available');
                        }
                    } else {
                        errors.push('Barcode app is NOT initialized');
                    }
                    
                    return errors;
                }
            """)
            
            for error in js_check:
                print(f"📍 JS Check: {error}")
                
        except Exception as e:
            print(f"Error during test: {e}")
            await page.screenshot(path='screenshots/codabar_test_error.png', full_page=True)
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_codabar_generation())