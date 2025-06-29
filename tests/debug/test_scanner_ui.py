#!/usr/bin/env python3
"""
Test scanner UI behavior to verify frame capture works correctly
"""

import asyncio
import http.server
import socketserver
import threading
import time
from playwright.async_api import async_playwright

async def test_scanner_ui():
    """Test that scanner shows captured frame with bounding box after detection"""
    
    # Start server
    PORT = 38425
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Server started on port {PORT}")
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(
                permissions=['camera'],
                viewport={'width': 1280, 'height': 720}
            )
            
            page = await context.new_page()
            
            # Listen to console messages for debugging
            page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
            
            # Navigate to app
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_load_state('networkidle')
            
            print("✓ App loaded successfully")
            
            # Switch to scanner tab
            await page.click('button:has-text("Scan Barcodes")')
            await page.wait_for_timeout(1000)
            
            print("✓ Scanner tab opened")
            
            # Mock camera stream (simulate camera being available)
            await page.evaluate("""
                // Mock getUserMedia to provide a fake video stream
                navigator.mediaDevices.getUserMedia = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 480;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw a fake QR code pattern
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, 640, 480);
                    ctx.fillStyle = 'black';
                    
                    // Simple QR-like pattern
                    for (let i = 0; i < 20; i++) {
                        for (let j = 0; j < 20; j++) {
                            if ((i + j) % 2 === 0) {
                                ctx.fillRect(i * 20 + 200, j * 20 + 100, 15, 15);
                            }
                        }
                    }
                    
                    const stream = canvas.captureStream(30);
                    return stream;
                };
            """)
            
            # Check initial canvas state
            canvas_visible_before = await page.is_visible('#qrCanvas')
            print(f"Canvas visible before scan: {canvas_visible_before}")
            
            # Start scanning
            await page.click('#scanButton')
            await page.wait_for_timeout(2000)
            
            print("✓ Scan started")
            
            # Check if video and canvas are visible during scanning
            await page.wait_for_timeout(1000)  # Wait for canvas drawing to start
            
            video_visible_during = await page.is_visible('#video')
            canvas_visible_during = await page.is_visible('#qrCanvas')
            
            print(f"Video visible during scan: {video_visible_during}")
            print(f"Canvas visible during scan: {canvas_visible_during}")
            
            # Simulate successful barcode detection
            await page.evaluate("""
                // Simulate a successful barcode detection
                const scanner = window.barcodeApp?.scanner || window.appModules?.scanner;
                console.log('Scanner object:', scanner);
                console.log('window.barcodeApp:', window.barcodeApp);
                console.log('window.appModules:', window.appModules);
                if (scanner) {
                    // Create a mock ZXing result
                    const mockResult = {
                        getText: () => 'https://example.com',
                        getBarcodeFormat: () => 1, // QR_CODE format
                        getResultPoints: () => [
                            { getX: () => 250, getY: () => 150 },
                            { getX: () => 350, getY: () => 150 },
                            { getX: () => 350, getY: () => 250 },
                            { getX: () => 250, getY: () => 250 }
                        ]
                    };
                    
                    console.log('About to call handleZXingCode with:', mockResult);
                    
                    // Check video visibility before
                    const videoBefore = document.getElementById('video');
                    console.log('Video display before handleZXingCode:', videoBefore.style.display);
                    
                    // Trigger the scan result handler
                    scanner.handleZXingCode(mockResult);
                    
                    // Check video visibility after
                    const videoAfter = document.getElementById('video');
                    console.log('Video display after handleZXingCode:', videoAfter.style.display);
                } else {
                    console.log('Scanner not found');
                }
            """)
            
            await page.wait_for_timeout(5000)  # Wait longer for auto-stop timeout
            
            print("✓ Simulated successful scan")
            
            # Check state after successful scan
            video_visible_after = await page.is_visible('#video')
            canvas_visible_after = await page.is_visible('#qrCanvas')
            scan_result_visible = await page.is_visible('#scanResult')
            
            print(f"Video visible after scan: {video_visible_after}")
            print(f"Canvas visible after scan: {canvas_visible_after}")
            print(f"Scan result visible: {scan_result_visible}")
            
            # Check for scan result content
            if scan_result_visible:
                result_text = await page.text_content('#scanResult')
                print(f"Scan result text: {result_text}")
            
            # Take screenshot
            await page.screenshot(path='screenshots/scanner_ui_test.png')
            print("✓ Screenshot saved")
            
            # Verify expected behavior:
            # 1. Canvas should be visible after successful scan (showing captured frame)
            # 2. Video stream should be hidden
            # 3. Scan result should be displayed
            
            success = True
            issues = []
            
            if not canvas_visible_after:
                issues.append("❌ Canvas should remain visible after successful scan to show captured frame")
                success = False
            else:
                print("✓ Canvas remains visible after successful scan (showing captured frame)")
            
            if video_visible_after:
                issues.append("❌ Video stream should be hidden after successful scan")
                success = False
            else:
                print("✓ Video stream properly hidden after successful scan")
                
            if video_visible_during:
                issues.append("❌ Video stream should be hidden during scanning (canvas should display video feed)")
                success = False
            else:
                print("✓ Video stream properly hidden during scanning")
            
            if not scan_result_visible:
                issues.append("❌ Scan result should be visible")
                success = False
            else:
                print("✓ Scan result properly displayed")
            
            if success:
                print("\n🎉 All scanner UI tests passed! Frame capture behavior is working correctly.")
            else:
                print("\n⚠️ Scanner UI issues found:")
                for issue in issues:
                    print(f"  {issue}")
            
            await browser.close()
            return success
            
    finally:
        httpd.shutdown()
        print("Server stopped")

if __name__ == "__main__":
    success = asyncio.run(test_scanner_ui())
    exit(0 if success else 1)