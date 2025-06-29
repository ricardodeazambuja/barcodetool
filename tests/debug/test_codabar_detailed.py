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

async def test_codabar_detailed():
    # Start HTTP server
    port = 41237
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
        
        # Collect ALL console messages
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
        page.on('requestfailed', lambda req: print(f"REQUEST FAILED: {req.url} - {req.failure}"))
        
        try:
            # Navigate to the application
            await page.goto(f"http://localhost:{port}")
            
            # Wait for the application to load
            await page.wait_for_selector('#generateBarcodeBtn', timeout=10000)
            print("✓ Application loaded successfully")
            
            # Test CODABAR generation step by step
            print("\n=== Step-by-step CODABAR Generation Test ===")
            
            # Step 1: Select CODABAR
            await page.select_option('#barcodeType', 'codabar')
            await page.wait_for_timeout(1000)
            print("✓ Step 1: Selected CODABAR")
            
            # Step 2: Enter valid CODABAR data
            await page.fill('#textInput', 'A123456789B')
            print("✓ Step 2: Entered CODABAR data")
            
            # Step 3: Monitor the generation process with detailed logging
            print("✓ Step 3: Starting generation with detailed monitoring...")
            
            # Inject monitoring script
            await page.evaluate("""
                () => {
                    // Override console methods to track all messages
                    const originalLog = console.log;
                    const originalError = console.error;
                    const originalWarn = console.warn;
                    
                    window.generationLogs = [];
                    
                    console.log = function(...args) {
                        window.generationLogs.push({type: 'log', message: args.join(' ')});
                        return originalLog.apply(console, args);
                    };
                    
                    console.error = function(...args) {
                        window.generationLogs.push({type: 'error', message: args.join(' ')});
                        return originalError.apply(console, args);
                    };
                    
                    console.warn = function(...args) {
                        window.generationLogs.push({type: 'warn', message: args.join(' ')});
                        return originalWarn.apply(console, args);
                    };
                    
                    // Track the exact state before generation
                    window.preGenerationState = {
                        barcodeType: document.getElementById('barcodeType').value,
                        textInput: document.getElementById('textInput').value,
                        outputFormat: document.getElementById('outputFormat').value,
                        includetext: document.getElementById('includetext').value,
                        appState: window.barcodeApp ? 'initialized' : 'not initialized',
                        generatorState: window.barcodeApp && window.barcodeApp.generator ? 'available' : 'not available',
                        bwipjsLoaded: typeof bwipjs !== 'undefined'
                    };
                }
            """)
            
            # Clear console messages before generation
            console_messages.clear()
            
            # Click generate button
            await page.click('#generateBarcodeBtn')
            print("✓ Step 4: Clicked generate button")
            
            # Wait for processing with longer timeout
            await page.wait_for_timeout(8000)
            
            # Get detailed state after generation
            generation_result = await page.evaluate("""
                () => {
                    const result = {
                        logs: window.generationLogs || [],
                        preState: window.preGenerationState || {},
                        postState: {
                            mainMessageVisible: false,
                            mainMessageText: '',
                            generatedContainerVisible: false,
                            generatedContainerChildren: 0,
                            barcodeOutputContent: ''
                        }
                    };
                    
                    // Check main message area
                    const mainMessage = document.getElementById('mainMessageArea');
                    if (mainMessage) {
                        result.postState.mainMessageVisible = mainMessage.style.display !== 'none';
                        result.postState.mainMessageText = mainMessage.textContent;
                    }
                    
                    // Check generated barcode container
                    const container = document.getElementById('generatedBarcodeContainer');
                    if (container) {
                        result.postState.generatedContainerVisible = container.style.display !== 'none';
                        result.postState.generatedContainerChildren = container.children.length;
                        if (container.children.length > 0) {
                            result.postState.firstChildType = container.children[0].tagName;
                        }
                    }
                    
                    // Check barcode output area
                    const output = document.getElementById('barcodeOutput');
                    if (output) {
                        result.postState.barcodeOutputContent = output.textContent;
                    }
                    
                    return result;
                }
            """)
            
            # Take final screenshot
            await page.screenshot(path='screenshots/codabar_detailed_result.png', full_page=True)
            print("✓ Screenshot saved: screenshots/codabar_detailed_result.png")
            
            # Print detailed analysis
            print("\n=== DETAILED GENERATION ANALYSIS ===")
            print("Pre-generation state:")
            for key, value in generation_result['preState'].items():
                print(f"  {key}: {value}")
            
            print("\nPost-generation state:")
            for key, value in generation_result['postState'].items():
                print(f"  {key}: {value}")
            
            print("\nGeneration logs captured:")
            for i, log in enumerate(generation_result['logs']):
                print(f"  {i+1}. [{log['type']}] {log['message']}")
            
            print("\nConsole messages during generation:")
            for i, msg in enumerate(console_messages):
                print(f"  {i+1}. [{msg['type']}] {msg['text']}")
            
            # Test if the bcid mapping is working
            bcid_test = await page.evaluate("""
                () => {
                    if (window.barcodeApp && window.barcodeApp.generator) {
                        const generator = window.barcodeApp.generator;
                        const options = generator.getBwipOptions('codabar', 'A123456789B');
                        return {
                            originalType: 'codabar',
                            mappedBcid: options.bcid,
                            fullOptions: options
                        };
                    }
                    return { error: 'Generator not available' };
                }
            """)
            
            print(f"\nBCID Mapping Test: {bcid_test}")
                
        except Exception as e:
            print(f"Error during test: {e}")
            await page.screenshot(path='screenshots/codabar_detailed_error.png', full_page=True)
        
        finally:
            await browser.close()
    
    httpd.shutdown()
    print("Server and browser closed.")

if __name__ == "__main__":
    asyncio.run(test_codabar_detailed())