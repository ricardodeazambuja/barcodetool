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

async def test_supported_encoders():
    # Start HTTP server
    port = 41240
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
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            await page.wait_for_timeout(2000)
            
            print("\n=== Testing Common Barcode Encoders ===")
            
            test_results = await page.evaluate("""
                async () => {
                    const results = [];
                    
                    if (typeof bwipjs === 'undefined') {
                        return [{test: 'BWIP-JS not loaded', result: 'ERROR'}];
                    }
                    
                    // Test common barcode types that should be supported
                    const commonEncoders = [
                        // 2D Codes
                        'qrcode',
                        'datamatrix',
                        'pdf417',
                        'azteccode',
                        
                        // 1D Codes
                        'code128',
                        'code39',
                        'code93',
                        'ean13',
                        'ean8',
                        'upca',
                        'upce',
                        'interleaved2of5',
                        
                        // Other 1D variations
                        'code25',
                        'code11',
                        'code32',
                        'code16k',
                        'code49',
                        'msi',
                        'plessey',
                        'telepen',
                        'pharmacode',
                        'planet',
                        'postnet',
                        'royal',
                        'auspost',
                        'gs1_128',
                        'databar',
                        'databarlimited',
                        'databaromni',
                        'databarexpanded',
                        
                        // Postal codes
                        'japanpost',
                        'kix',
                        'daft',
                        
                        // 2D variations
                        'maxicode',
                        'dotcode',
                        'hanxin',
                        'gridmatrix',
                        'codeone',
                        'compact_pdf417',
                        'micropdf417',
                        'microqr',
                        
                        // Industrial codes
                        'code39ext',
                        'code93ext',
                        'codablockf',
                        'channelcode'
                    ];
                    
                    for (const encoder of commonEncoders) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 200;
                            canvas.height = 80;
                            
                            // Use appropriate test data for different barcode types
                            let testData = '123456789012';  // Default for numeric codes
                            
                            if (['qrcode', 'datamatrix', 'pdf417', 'azteccode', 'maxicode'].includes(encoder)) {
                                testData = 'Test QR Code';
                            } else if (encoder === 'ean13') {
                                testData = '123456789012';  // 12 digits for EAN-13
                            } else if (encoder === 'ean8') {
                                testData = '1234567';  // 7 digits for EAN-8
                            } else if (encoder === 'upca') {
                                testData = '12345678901';  // 11 digits for UPC-A
                            } else if (encoder === 'upce') {
                                testData = '123456';  // 6 digits for UPC-E
                            } else if (['code39', 'code39ext'].includes(encoder)) {
                                testData = 'TEST123';
                            } else if (['code128', 'code93', 'code93ext'].includes(encoder)) {
                                testData = 'Test123';
                            }
                            
                            const options = {
                                bcid: encoder,
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
                            await new Promise(resolve => setTimeout(resolve, 30));
                            
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
            
            print("\nBarcode Encoder Support Test Results:")
            print("=" * 60)
            
            successful_encoders = []
            failed_encoders = []
            
            for result in test_results:
                status = "✅ SUPPORTED" if result['success'] else "❌ NOT SUPPORTED"
                print(f"{status:<15} | {result['encoder']:<20}")
                
                if result['success']:
                    successful_encoders.append(result['encoder'])
                else:
                    failed_encoders.append((result['encoder'], result['error']))
            
            print("=" * 60)
            print(f"\nSUMMARY:")
            print(f"✅ SUPPORTED ENCODERS: {len(successful_encoders)}")
            print(f"❌ NOT SUPPORTED: {len(failed_encoders)}")
            
            print(f"\n✅ WORKING ENCODERS ({len(successful_encoders)}):")
            for encoder in successful_encoders:
                print(f"   • {encoder}")
            
            print(f"\n❌ FAILED ENCODERS ({len(failed_encoders)}):")
            for encoder, error in failed_encoders:
                if 'unknown encoder' in error:
                    print(f"   • {encoder} (not supported)")
                else:
                    print(f"   • {encoder} (error: {error})")
            
        except Exception as e:
            print(f"Error during test: {e}")
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("\\nServer and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_supported_encoders())