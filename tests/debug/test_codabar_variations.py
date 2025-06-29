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

async def test_codabar_variations():
    # Start HTTP server
    port = 41239
    handler = HTTPRequestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    
    # Start server in background thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Serving on http://localhost:{port}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        def handle_console(msg):
            print(f"CONSOLE [{msg.type}]: {msg.text}")
        
        page.on('console', handle_console)
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            await page.wait_for_timeout(2000)
            
            # Test many possible CODABAR variations
            print("\n=== Testing CODABAR Encoder Variations ===")
            
            test_results = await page.evaluate("""
                async () => {
                    const results = [];
                    
                    if (typeof bwipjs === 'undefined') {
                        return [{test: 'BWIP-JS not loaded', result: 'ERROR'}];
                    }
                    
                    // Comprehensive list of possible CODABAR variations
                    const testEncoders = [
                        // Standard variations
                        'codabar',
                        'rationalizedCodabar',
                        'rationalized_codabar',
                        
                        // Common aliases based on CODABAR specifications
                        'nw7',
                        'nw-7',
                        'monarch',
                        'code2of7',
                        'code_2_of_7',
                        'abc_codabar',
                        'usd4',
                        'usd-4',
                        'ames',
                        'amescode',
                        
                        // BWIPP style names (lowercase, underscores)
                        'codabar_rationalized',
                        'rationalizedcodabar',
                        'code_2_7',
                        'code27',
                        
                        // Other possible variations
                        'cbar',
                        'codebar',
                        'cod39',
                        'rationalised_codabar',
                        'uniform_symbology_codabar',
                        'ansi_codabar',
                        'aim_codabar'
                    ];
                    
                    const testData = 'A123456789B';
                    
                    for (const encoder of testEncoders) {
                        try {
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
                            
                            let success = false;
                            let errorMsg = '';
                            
                            bwipjs.toCanvas(canvas, options, (err) => {
                                if (err) {
                                    errorMsg = err.message || err.toString();
                                } else {
                                    success = true;
                                }
                            });
                            
                            // Wait for callback
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            results.push({
                                encoder: encoder,
                                success: success,
                                error: errorMsg
                            });
                            
                        } catch (error) {
                            results.push({
                                encoder: encoder,
                                success: false,
                                error: error.message
                            });
                        }
                    }
                    
                    return results;
                }
            """)
            
            print("\nCODABAR Encoder Test Results:")
            print("=" * 50)
            
            successful_encoders = []
            
            for result in test_results:
                status = "✅ SUCCESS" if result['success'] else "❌ FAILED"
                print(f"{status:<12} | {result['encoder']:<25}")
                
                if not result['success'] and result['error']:
                    # Only show errors that aren't "unknown encoder"
                    if 'unknown encoder' not in result['error']:
                        print(f"             | Error: {result['error']}")
                
                if result['success']:
                    successful_encoders.append(result['encoder'])
            
            print("=" * 50)
            print(f"\nSUCCESSFUL ENCODERS: {len(successful_encoders)}")
            for encoder in successful_encoders:
                print(f"  ✅ {encoder}")
            
            if not successful_encoders:
                print("  ❌ No working CODABAR encoders found!")
                
                # Try to get the complete list of available encoders
                print("\n=== Attempting to discover available encoders ===")
                
                available_info = await page.evaluate("""
                    () => {
                        if (typeof bwipjs === 'undefined') {
                            return { error: 'BWIP-JS not loaded' };
                        }
                        
                        // Try to access internal encoder list
                        const info = {
                            bwipjsVersion: bwipjs.BWIPJS_VERSION || 'unknown',
                            bwippVersion: bwipjs.BWIPP_VERSION || 'unknown',
                            availableKeys: Object.keys(bwipjs),
                            hasEncoders: false,
                            encoderMethods: []
                        };
                        
                        // Check if there are any encoder-like properties
                        for (const key of Object.keys(bwipjs)) {
                            if (typeof bwipjs[key] === 'function' && 
                                key !== 'toCanvas' && 
                                key !== 'toSVG' && 
                                key !== 'render' &&
                                key !== 'loadFont') {
                                info.encoderMethods.push(key);
                                info.hasEncoders = true;
                            }
                        }
                        
                        return info;
                    }
                """)
                
                print(f"BWIP-JS Version: {available_info.get('bwipjsVersion')}")
                print(f"BWIPP Version: {available_info.get('bwippVersion')}")
                print(f"Available Keys: {available_info.get('availableKeys')}")
                print(f"Encoder Methods: {available_info.get('encoderMethods')}")
            
        except Exception as e:
            print(f"Error during test: {e}")
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_codabar_variations())