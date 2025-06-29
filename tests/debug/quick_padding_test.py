#!/usr/bin/env python3
"""
Quick test to debug padding issue
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright
import os

class MyTCPServer(socketserver.TCPServer):
    def __init__(self, server_address, RequestHandlerClass, bind_and_activate=True):
        self.allow_reuse_address = True
        super().__init__(server_address, RequestHandlerClass, bind_and_activate)

async def quick_test():
    # Start server
    server_address = ("localhost", 0)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = MyTCPServer(server_address, handler)
    port = httpd.server_address[1]
    
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(viewport={'width': 1280, 'height': 720})
            page = await context.new_page()
            
            # Listen for console errors
            page.on("console", lambda msg: print(f"Console: {msg.text}") if msg.type == "error" else None)
            
            await page.goto(f'http://localhost:{port}')
            await page.wait_for_load_state('networkidle')
            
            # Generate simple QR code
            await page.click('button[onclick="switchTab(\'generator\')"]')
            await page.select_option('#barcodeType', 'qrcode')
            await page.fill('#textInput', 'PADDING TEST')
            await page.fill('#padding', '20')
            await page.click('#generateBarcodeBtn')
            await page.wait_for_timeout(3000)
            
            # Take screenshot and check if barcode exists
            await page.screenshot(path='screenshots/quick_padding_debug.png', full_page=True)
            
            # Check error messages
            error_visible = await page.is_visible('#mainMessageArea')
            if error_visible:
                error_text = await page.text_content('#mainMessageArea')
                print(f"Error message: {error_text}")
            
            # Check if canvas exists and has content
            has_canvas = await page.evaluate("""
                () => {
                    const canvas = document.querySelector('#generatedBarcodeContainer canvas');
                    if (!canvas) return 'No canvas found';
                    
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Count non-white pixels
                    let nonWhitePixels = 0;
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        const r = imageData.data[i];
                        const g = imageData.data[i + 1];
                        const b = imageData.data[i + 2];
                        if (r !== 255 || g !== 255 || b !== 255) {
                            nonWhitePixels++;
                        }
                    }
                    
                    return {
                        canvasSize: `${canvas.width}x${canvas.height}`,
                        totalPixels: imageData.data.length / 4,
                        nonWhitePixels: nonWhitePixels,
                        hasContent: nonWhitePixels > 0
                    };
                }
            """)
            
            print(f"Canvas analysis: {has_canvas}")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        httpd.server_close()
        server_thread.join()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    os.makedirs("screenshots", exist_ok=True)
    asyncio.run(quick_test())