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

async def test_bwipjs_debug():
    # Start HTTP server
    port = 41241
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
        
        # Capture all console and network activity
        console_messages = []
        network_requests = []
        
        def handle_console(msg):
            console_messages.append({
                'type': msg.type,
                'text': msg.text,
                'location': msg.location
            })
            print(f"CONSOLE [{msg.type}]: {msg.text}")
        
        def handle_request(request):
            network_requests.append({
                'url': request.url,
                'method': request.method,
                'headers': dict(request.headers)
            })
            print(f"REQUEST: {request.method} {request.url}")
        
        def handle_response(response):
            print(f"RESPONSE: {response.status} {response.url}")
        
        page.on('console', handle_console)
        page.on('request', handle_request)
        page.on('response', handle_response)
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            await page.wait_for_timeout(5000)  # Wait for all resources to load
            
            print("\n=== BWIP-JS Library Debug Analysis ===")
            
            debug_info = await page.evaluate("""
                () => {
                    const info = {
                        bwipjsExists: typeof bwipjs !== 'undefined',
                        bwipjsType: typeof bwipjs,
                        windowKeys: Object.keys(window).filter(k => k.includes('bwip') || k.includes('BWIP')),
                        errors: []
                    };
                    
                    if (typeof bwipjs !== 'undefined') {
                        try {
                            info.bwipjsVersion = bwipjs.BWIPJS_VERSION;
                            info.bwippVersion = bwipjs.BWIPP_VERSION;
                            info.bwipjsKeys = Object.keys(bwipjs);
                            info.toCanvasType = typeof bwipjs.toCanvas;
                            info.toSVGType = typeof bwipjs.toSVG;
                            
                            // Try a simple QR code test
                            info.simpleTest = 'attempting';
                            
                            const canvas = document.createElement('canvas');
                            canvas.width = 100;
                            canvas.height = 100;
                            
                            bwipjs.toCanvas(canvas, {
                                bcid: 'qrcode',
                                text: 'TEST',
                                scale: 1,
                                height: 10
                            }, (err) => {
                                if (err) {
                                    info.simpleTestError = err.message || err.toString();
                                    info.simpleTest = 'failed';
                                } else {
                                    info.simpleTest = 'success';
                                }
                            });
                            
                            // Wait a moment for the callback
                            setTimeout(() => {
                                if (info.simpleTest === 'attempting') {
                                    info.simpleTest = 'timeout';
                                }
                            }, 1000);
                            
                        } catch (error) {
                            info.errors.push('Error accessing bwipjs properties: ' + error.message);
                        }
                    }
                    
                    return info;
                }
            """)
            
            # Wait for the simple test to complete
            await page.wait_for_timeout(2000)
            
            # Get updated test results
            test_results = await page.evaluate("""
                () => {
                    return {
                        simpleTest: window.info ? window.info.simpleTest : 'unknown',
                        simpleTestError: window.info ? window.info.simpleTestError : 'unknown'
                    };
                }
            """)
            
            print(f"\\nBWIP-JS Library Analysis:")
            print(f"Exists: {debug_info['bwipjsExists']}")
            print(f"Type: {debug_info['bwipjsType']}")
            print(f"Window keys with 'bwip': {debug_info['windowKeys']}")
            
            if debug_info['bwipjsExists']:
                print(f"BWIP-JS Version: {debug_info.get('bwipjsVersion', 'unknown')}")
                print(f"BWIPP Version: {debug_info.get('bwippVersion', 'unknown')}")
                print(f"Available methods: {debug_info.get('bwipjsKeys', [])}")
                print(f"toCanvas type: {debug_info.get('toCanvasType', 'unknown')}")
                print(f"toSVG type: {debug_info.get('toSVGType', 'unknown')}")
                print(f"Simple test result: {debug_info.get('simpleTest', 'unknown')}")
                if 'simpleTestError' in debug_info:
                    print(f"Simple test error: {debug_info['simpleTestError']}")
                
                if debug_info.get('errors'):
                    print(f"Errors: {debug_info['errors']}")
            
            print(f"\\nNetwork Requests:")
            bwip_requests = [req for req in network_requests if 'bwip' in req['url']]
            for req in bwip_requests:
                print(f"  {req['method']} {req['url']}")
            
            print(f"\\nConsole Messages:")
            for i, msg in enumerate(console_messages):
                if i < 10:  # Show first 10 messages
                    print(f"  [{msg['type']}] {msg['text']}")
            
            # Test direct generation attempt with proper error handling
            print(f"\\n=== Direct Generation Test ===")
            
            direct_test = await page.evaluate("""
                async () => {
                    if (typeof bwipjs === 'undefined') {
                        return {error: 'BWIP-JS not loaded'};
                    }
                    
                    return new Promise((resolve) => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 200;
                            canvas.height = 100;
                            
                            const options = {
                                bcid: 'qrcode',
                                text: 'Hello World',
                                scale: 3,
                                height: 10,
                                includetext: true
                            };
                            
                            console.log('Starting BWIP-JS generation with options:', options);
                            
                            bwipjs.toCanvas(canvas, options, (err) => {
                                if (err) {
                                    console.error('BWIP-JS generation error:', err);
                                    resolve({
                                        success: false,
                                        error: err.message || err.toString(),
                                        errorType: typeof err,
                                        canvasSize: `${canvas.width}x${canvas.height}`
                                    });
                                } else {
                                    console.log('BWIP-JS generation successful');
                                    resolve({
                                        success: true,
                                        canvasSize: `${canvas.width}x${canvas.height}`,
                                        canvasData: canvas.toDataURL().substring(0, 100) + '...'
                                    });
                                }
                            });
                            
                        } catch (syncError) {
                            console.error('Synchronous error in BWIP-JS test:', syncError);
                            resolve({
                                success: false,
                                error: 'Synchronous error: ' + syncError.message,
                                errorType: 'sync'
                            });
                        }
                    });
                }
            """)
            
            print(f"Direct test result: {direct_test}")
            
        except Exception as e:
            print(f"Error during test: {e}")
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("\\nServer and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_bwipjs_debug())