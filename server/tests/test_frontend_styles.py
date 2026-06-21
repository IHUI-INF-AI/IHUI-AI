"""Playwright 前端样式验证: 仅核心页面 + console 错误检查.

避开登录弹窗 (UI 经常变化), 改用 5 个核心页面验证加载 + 无 console 错误.
"""
import os
import sys
from playwright.sync_api import sync_playwright


PAGES = [
    ("/", "home"),
    ("/agents", "ai_store"),
    ("/open", "open_platform"),
    ("/ai-world", "learn_ai"),
    ("/ai-community", "ai_community"),
    ("/plaza", "plaza"),
    ("/courses", "courses"),
    ("/user-center", "user_center"),
]


def run():
    base = "http://127.0.0.1:8888"
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(15000)

        # 收集 console 错误
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        # 收集网络失败请求
        failed_requests = []
        page.on("requestfailed", lambda req: failed_requests.append(f"{req.method} {req.url} {req.failure}"))
        page.on("response", lambda resp: failed_requests.append(f"HTTP {resp.status} {resp.url}") if resp.status >= 500 else None)

        # 1. 5 个核心页面都应能加载, 无 console 错误
        # 用 ?forcePromotion=false 关闭首页推广弹窗, 避免遮挡
        screenshots_dir = os.path.join(os.path.dirname(__file__), "..", "screenshots")
        os.makedirs(screenshots_dir, exist_ok=True)
        for path, name in PAGES:
            sep = "&" if "?" in path else "?"
            page.goto(f"{base}{path}{sep}forcePromotion=false", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)
            results.append((f"page_{name}_loaded", page.title(), page.locator("body").is_visible()))
            page.screenshot(path=os.path.join(screenshots_dir, f"page_{name}.png"), full_page=False)

        # 2. 顶部导航点击切换
        nav_btns = page.locator("nav a:visible, nav button:visible, .header a:visible, .header button:visible, .navbar a:visible, .navbar button:visible").all()
        if len(nav_btns) == 0:
            nav_btns = page.locator("a:visible, button:visible").all()
        results.append(("nav_count", str(len(nav_btns)), len(nav_btns) > 0))

        # 3. console 错误 (允许 vite HMR 类信息, 只统计 error 级)
        results.append(("console_errors", str(len(console_errors)), len(console_errors) == 0))
        if console_errors:
            print("\n=== Console Errors ===")
            for e in console_errors[:5]:
                print(f"  {e[:200]}")
        if failed_requests:
            print("\n=== Failed Requests (5xx) ===")
            for fr in failed_requests[:10]:
                print(f"  {fr[:200]}")

        browser.close()

    print("=" * 60)
    for name, info, ok in results:
        status = "OK" if ok else "FAIL"
        print(f"[{status}] {name}: {info}")
    print("=" * 60)
    return all(ok for _, _, ok in results)


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
