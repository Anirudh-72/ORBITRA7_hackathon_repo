from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        print("Navigating to localhost:8001...")
        try:
            page.goto("http://localhost:8001", timeout=10000)
            page.wait_for_timeout(2000)
            print("Clicking Enter Command Center...")
            page.click("text=Enter Command Center")
            page.wait_for_timeout(4000)
            print("Taking screenshot...")
            page.screenshot(path="screenshot_app.png")
            print("Loaded successfully")
        except Exception as e:
            print(f"Error: {e}")
        
        browser.close()

if __name__ == "__main__":
    run()
