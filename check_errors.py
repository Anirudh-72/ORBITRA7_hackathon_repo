from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
        
        print("Navigating to localhost:8001...")
        try:
            page.goto("http://localhost:8001", timeout=10000)
            page.wait_for_timeout(3000)
            print("Loaded successfully")
        except Exception as e:
            print(f"Navigation error: {e}")
        
        browser.close()

if __name__ == "__main__":
    run()
