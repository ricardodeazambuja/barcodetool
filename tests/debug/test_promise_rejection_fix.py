#!/usr/bin/env python3
"""
Test the unhandled promise rejection fix in scanner
"""

import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

async def test_promise_rejection_fix():
    """Test that scanner unhandled promise rejection is fixed"""
    
    # Start server
    PORT = 38440
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {PORT}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(viewport={'width': 1280, 'height': 720})
            page = await context.new_page()
            
            # Collect console messages and unhandled rejections
            console_messages = []
            page.on("console", lambda msg: console_messages.append(msg.text))
            
            # Listen for unhandled promise rejections
            unhandled_rejections = []
            page.on("pageerror", lambda error: unhandled_rejections.append(str(error)))
            
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded")
            
            # Switch to scanner tab
            await page.click("button[onclick=\"switchTab('scanner')\"]")
            await page.wait_for_timeout(500)
            
            print("✓ Switched to scanner tab")
            
            # Start scanning (this used to trigger unhandled promise rejection)
            await page.click('#scanButton')
            await page.wait_for_timeout(1000)  # Wait for scan to start
            
            print("✓ Started scanning")
            
            # Stop scanning immediately (this would cause the promise rejection)
            await page.click('#scanButton')
            await page.wait_for_timeout(1000)  # Wait for scan to stop
            
            print("✓ Stopped scanning")
            
            # Check for unhandled promise rejections
            if unhandled_rejections:
                print(f"❌ Found {len(unhandled_rejections)} unhandled promise rejections:")
                for rejection in unhandled_rejections:
                    print(f"  - {rejection}")
            else:
                print("✅ No unhandled promise rejections detected")
            
            # Look for the specific error message in console
            zxing_error_found = False
            for msg in console_messages:
                if "Video stream has ended before any code could be detected" in msg:
                    if "Unhandled promise rejection" in msg:
                        print("❌ Unhandled promise rejection still occurs")
                        zxing_error_found = True
                    else:
                        print("✅ ZXing error is handled properly (no 'Unhandled promise rejection')")
                        zxing_error_found = True
            
            if not zxing_error_found:
                print("✅ No ZXing stream ending errors detected")
            
            await page.screenshot(path='screenshots/promise_rejection_fix_test.png')
            print("✓ Screenshot saved")
            
            await browser.close()
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    asyncio.run(test_promise_rejection_fix())