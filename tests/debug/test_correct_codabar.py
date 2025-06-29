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

async def test_correct_codabar():
    port = 41243
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
        
        def handle_console(msg):
            print(f"CONSOLE [{msg.type}]: {msg.text}")
        
        page.on('console', handle_console)
        
        try:
            await page.goto(f"http://localhost:{port}")
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            await page.wait_for_timeout(2000)
            
            print("\n=== Testing Likely CODABAR Names ===")
            
            # Test the most likely CODABAR encoder names based on BWIPP documentation
            test_results = await page.evaluate("""
                async () => {
                    const results = [];
                    
                    // Most likely CODABAR encoder names based on BWIPP standards
                    const likelyNames = [
                        // Standard BWIPP naming (all lowercase)
                        'rationalizedcodabar',
                        'nw7',
                        'monarch',
                        'code2of7',
                        'codabar',
                        
                        // Underscore versions
                        'rationalized_codabar',
                        'code_2_of_7',
                        'nw_7',
                        
                        // Other common names
                        'usd4',
                        'ames',
                        'abc_codabar',
                        'ansi_codabar',
                        'uss_codabar'
                    ];
                    
                    const testData = 'A123456789B';
                    
                    for (const name of likelyNames) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 200;
                            canvas.height = 80;
                            
                            const options = {
                                bcid: name,
                                text: testData,
                                scale: 2,
                                height: 8,
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
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            results.push({
                                name: name,
                                success: success,
                                error: errorMsg
                            });
                            
                        } catch (error) {
                            results.push({
                                name: name,
                                success: false,
                                error: 'Sync error: ' + error.message
                            });
                        }
                    }
                    
                    return results;
                }
            """)
            
            print("CODABAR Encoder Name Test Results:")
            print("=" * 50)
            
            working_names = []
            
            for result in test_results:
                if result['success']:
                    print(f"✅ SUCCESS    | {result['name']}")
                    working_names.append(result['name'])
                else:
                    error_type = "unknown encoder" if "unknown encoder" in result['error'] else "other error"
                    print(f"❌ FAILED     | {result['name']} ({error_type})")
            
            print("=" * 50)
            
            if working_names:
                print(f"\\n🎉 FOUND WORKING CODABAR ENCODERS: {len(working_names)}")
                for name in working_names:
                    print(f"   ✅ {name}")
                
                # Test the first working encoder with a full generation
                print(f"\\n=== Testing Full Generation with '{working_names[0]}' ===")
                
                test_generation = await page.evaluate(f"""
                    async () => {{
                        const canvas = document.createElement('canvas');
                        canvas.width = 300;
                        canvas.height = 100;
                        
                        const options = {{
                            bcid: '{working_names[0]}',
                            text: 'A123456789B',
                            scale: 3,
                            height: 10,
                            includetext: true
                        }};
                        
                        return new Promise((resolve) => {{
                            bwipjs.toCanvas(canvas, options, (err) => {{
                                if (err) {{
                                    resolve({{
                                        success: false,
                                        error: err.message || err.toString()
                                    }});
                                }} else {{
                                    // Convert canvas to data URL for verification
                                    const dataUrl = canvas.toDataURL();
                                    resolve({{
                                        success: true,
                                        canvasSize: `${{canvas.width}}x${{canvas.height}}`,
                                        dataUrlLength: dataUrl.length,
                                        hasData: dataUrl.length > 1000
                                    }});
                                }}
                            }});
                        }});
                    }}
                """)
                
                print(f"Full generation test: {test_generation}")
                
            else:
                print("\\n❌ NO WORKING CODABAR ENCODERS FOUND")
                print("\\nThis suggests that CODABAR may not be supported in this BWIP-JS version,")
                print("or it uses a completely different naming convention.")
            
        except Exception as e:
            print(f"Error during test: {e}")
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_correct_codabar())