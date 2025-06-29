#!/usr/bin/env python3

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright
import os

class HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"{self.address_string()} - - [{self.log_date_time_string()}] {format % args}")

async def test_mapping_debug():
    port = 41242
    handler = HTTPRequestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Serving on http://localhost:{port}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Capture console messages
        def handle_console(msg):
            print(f"CONSOLE [{msg.type}]: {msg.text}")
        
        page.on('console', handle_console)
        page.on('pageerror', lambda exc: print(f"PAGE ERROR: {exc}"))
        
        try:
            await page.goto(f"http://localhost:{port}")
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            await page.wait_for_timeout(2000)
            
            print("\n=== Testing BCID Mapping ===")
            
            # Test the mapping function directly
            mapping_test = await page.evaluate("""
                () => {
                    if (!window.barcodeApp || !window.barcodeApp.generator) {
                        return { error: 'Generator not available' };
                    }
                    
                    const generator = window.barcodeApp.generator;
                    
                    // Test the getBwipOptions method directly
                    const testResults = [];
                    
                    // Test CODABAR specifically
                    try {
                        const options = generator.getBwipOptions('codabar', 'A123456789B');
                        testResults.push({
                            input: 'codabar',
                            output: options.bcid,
                            fullOptions: options
                        });
                    } catch (error) {
                        testResults.push({
                            input: 'codabar',
                            error: error.message
                        });
                    }
                    
                    // Test other barcode types for comparison
                    const testTypes = ['qrcode', 'code128', 'ean13'];
                    for (const type of testTypes) {
                        try {
                            const options = generator.getBwipOptions(type, 'test');
                            testResults.push({
                                input: type,
                                output: options.bcid,
                                mapped: type !== options.bcid
                            });
                        } catch (error) {
                            testResults.push({
                                input: type,
                                error: error.message
                            });
                        }
                    }
                    
                    return testResults;
                }
            """)
            
            print("BCID Mapping Test Results:")
            for result in mapping_test:
                if 'error' in result:
                    print(f"  ❌ {result['input']} -> ERROR: {result['error']}")
                else:
                    mapped_indicator = " (MAPPED)" if result.get('mapped', False) else ""
                    print(f"  ✅ {result['input']} -> {result['output']}{mapped_indicator}")
            
            # Now test actual generation to see what gets passed to BWIP-JS
            print("\n=== Testing Actual Generation ===")
            
            # Select CODABAR and enter data
            await page.select_option('#barcodeType', 'codabar')
            await page.fill('#textInput', 'A123456789B')
            
            # Inject a hook to intercept BWIP-JS calls
            await page.evaluate("""
                () => {
                    // Store original BWIP-JS functions
                    window.originalToCanvas = bwipjs.toCanvas;
                    window.bwipjsCalls = [];
                    
                    // Hook toCanvas to see what options are passed
                    bwipjs.toCanvas = function(canvas, options, callback) {
                        console.log('BWIP-JS toCanvas called with options:', JSON.stringify(options));
                        window.bwipjsCalls.push({
                            type: 'toCanvas',
                            options: JSON.parse(JSON.stringify(options)),
                            timestamp: Date.now()
                        });
                        
                        // Call original function
                        return window.originalToCanvas.call(this, canvas, options, callback);
                    };
                }
            """)
            
            # Generate barcode
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Check what was actually passed to BWIP-JS
            bwipjs_calls = await page.evaluate("() => window.bwipjsCalls || []")
            
            print("BWIP-JS Calls Intercepted:")
            for i, call in enumerate(bwipjs_calls):
                print(f"  Call {i+1}: {call['type']}")
                print(f"    Options: {call['options']}")
                print(f"    BCID passed: {call['options'].get('bcid', 'NOT_FOUND')}")
            
            # Take screenshot of final state
            await page.screenshot(path='screenshots/mapping_debug.png', full_page=True)
            print("Screenshot saved: screenshots/mapping_debug.png")
            
        except Exception as e:
            print(f"Error during test: {e}")
            await page.screenshot(path='screenshots/mapping_debug_error.png', full_page=True)
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    # Change to project root directory (two levels up from debug folder)
    os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    asyncio.run(test_mapping_debug())