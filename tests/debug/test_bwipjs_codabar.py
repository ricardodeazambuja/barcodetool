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

async def test_bwipjs_codabar():
    # Start HTTP server
    port = 41238
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
        page.on('pageerror', lambda exc: print(f"PAGE ERROR: {exc}"))
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            
            # Wait for the application to load
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            await page.wait_for_timeout(2000)  # Additional wait for full initialization
            
            # Test direct BWIP-JS calls
            print("\n=== Testing Direct BWIP-JS Calls ===")
            
            bwipjs_test = await page.evaluate("""
                async () => {
                    const results = [];
                    
                    // Test 1: Check if bwipjs is loaded
                    results.push({
                        test: 'BWIP-JS loaded',
                        result: typeof bwipjs !== 'undefined',
                        type: typeof bwipjs
                    });
                    
                    if (typeof bwipjs === 'undefined') {
                        return results;
                    }
                    
                    // Test 2: Try different CODABAR encoder names
                    const testEncoders = [
                        'codabar',
                        'rationalizedCodabar', 
                        'rationalized-codabar',
                        'rationalizedcodabar',
                        'codabar-rationalized'
                    ];
                    
                    const testData = 'A123456789B';
                    
                    for (const encoder of testEncoders) {
                        try {
                            // Create a test canvas
                            const canvas = document.createElement('canvas');
                            canvas.width = 300;
                            canvas.height = 100;
                            
                            const options = {
                                bcid: encoder,
                                text: testData,
                                scale: 3,
                                height: 10,
                                includetext: false
                            };
                            
                            // Try to generate synchronously by catching the error
                            let success = false;
                            let errorMsg = '';
                            
                            bwipjs.toCanvas(canvas, options, (err) => {
                                if (err) {
                                    errorMsg = err.message || err.toString();
                                } else {
                                    success = true;
                                }
                            });
                            
                            // Small delay to allow callback to execute
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            if (success) {
                                results.push({
                                    test: `CODABAR with bcid: ${encoder}`,
                                    result: 'SUCCESS',
                                    canvasSize: `${canvas.width}x${canvas.height}`
                                });
                            } else {
                                results.push({
                                    test: `CODABAR with bcid: ${encoder}`,
                                    result: 'FAILED',
                                    error: errorMsg
                                });
                            }
                            
                        } catch (error) {
                            results.push({
                                test: `CODABAR with bcid: ${encoder}`,
                                result: 'FAILED',
                                error: error.message
                            });
                        }
                    }
                    
                    // Test 3: Try SVG generation with successful encoder
                    const successfulEncoders = results.filter(r => r.result === 'SUCCESS').map(r => r.test.split(': ')[1]);
                    
                    if (successfulEncoders.length > 0) {
                        const encoder = successfulEncoders[0];
                        try {
                            const options = {
                                bcid: encoder,
                                text: testData,
                                scale: 3,
                                height: 10,
                                includetext: false
                            };
                            
                            const svg = await new Promise((resolve, reject) => {
                                bwipjs.toSVG(options, (err, svg) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(svg);
                                    }
                                });
                            });
                            
                            results.push({
                                test: `SVG generation with ${encoder}`,
                                result: 'SUCCESS',
                                svgLength: svg.length
                            });
                            
                        } catch (error) {
                            results.push({
                                test: `SVG generation with ${encoder}`,
                                result: 'FAILED',
                                error: error.message
                            });
                        }
                    }
                    
                    return results;
                }
            """)
            
            print("\nBWIP-JS Direct Test Results:")
            for i, result in enumerate(bwipjs_test):
                print(f"{i+1}. {result['test']}: {result['result']}")
                if 'error' in result:
                    print(f"   Error: {result['error']}")
                if 'canvasSize' in result:
                    print(f"   Canvas: {result['canvasSize']}")
                if 'svgLength' in result:
                    print(f"   SVG Length: {result['svgLength']}")
            
            # Test 4: Check what encoders are actually available
            available_encoders = await page.evaluate("""
                () => {
                    if (typeof bwipjs === 'undefined') {
                        return { error: 'bwipjs not loaded' };
                    }
                    
                    // Try to get list of available encoders
                    // Some versions expose this information
                    const info = {
                        bwipjsKeys: Object.keys(bwipjs),
                        methods: []
                    };
                    
                    // Check for common methods
                    const methods = ['toCanvas', 'toSVG', 'loadFont', 'version'];
                    for (const method of methods) {
                        if (typeof bwipjs[method] === 'function') {
                            info.methods.push(method);
                        }
                    }
                    
                    return info;
                }
            """)
            
            print(f"\nBWIP-JS Object Analysis:")
            print(f"Available keys: {available_encoders.get('bwipjsKeys', 'N/A')}")
            print(f"Available methods: {available_encoders.get('methods', 'N/A')}")
            
        except Exception as e:
            print(f"Error during test: {e}")
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_bwipjs_codabar())