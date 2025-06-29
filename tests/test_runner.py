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

async def main():
    # Use port 0 to let the OS pick a free port
    server_address = ("localhost", 0)
    handler = http.server.SimpleHTTPRequestHandler
    
    httpd = MyTCPServer(server_address, handler)
    port = httpd.server_address[1]
    
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"Serving on http://localhost:{port}")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # Wait for the page to load completely before interacting
            await page.goto(f"http://localhost:{port}", wait_until="networkidle")
            
            await page.screenshot(path="screenshots/01_generator_page.png")

            await page.click('button[onclick="switchTab(\'scanner\')"]')
            await page.wait_for_selector("#scanner", state="visible")
            await page.screenshot(path="screenshots/02_scanner_page.png")

            await page.click('button[onclick="switchTab(\'savedData\')"]')
            await page.wait_for_selector("#savedData", state="visible")
            await page.screenshot(path="screenshots/03_saved_data_page.png")

            await browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()
        server_thread.join()
        print("Server and browser closed.")

if __name__ == "__main__":
    # Change to project root directory
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Create screenshots directory if it doesn't exist
    os.makedirs("screenshots", exist_ok=True)
    
    asyncio.run(main())