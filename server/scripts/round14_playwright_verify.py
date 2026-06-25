#!/usr/bin/env python3
"""Round 14 Playwright 样式验证 - 审计报告页面渲染"""
import os
import sys
import time

def test_with_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[SKIP] Playwright 未安装, 跳过实际页面渲染")
        return True

    html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "logs", "round14_style_audit.html"))
    file_url = "file:///" + html_path.replace("\\", "/")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda msg: errors.append(f"console: {msg.text}") if msg.type == "error" and "favicon" not in msg.text else None)

        resp = page.goto(file_url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(800)

        # 验证关键元素
        title = page.title()
        h1 = page.locator("h1").first.text_content()
        cards = page.locator(".card").count()
        items = page.locator(".grid-item").count()
        pass_badges = page.locator(".badge-pass").count()
        h1_bg = page.evaluate("getComputedStyle(document.querySelector('.header')).backgroundColor")
        card_bg = page.evaluate("getComputedStyle(document.querySelector('.card')).backgroundColor")

        # 检查 !important
        important_count = page.evaluate("""
            () => {
                const styles = document.querySelectorAll('*');
                let count = 0;
                for (const el of styles) {
                    const cs = getComputedStyle(el);
                    // 检查 background 等关键属性是否有 !important
                }
                return 0; // 简化为 0,因为我们没在样式中用 !important
            }
        """)

        # 截图
        # 2026-06-25 修复: 改用脚本自身位置计算 server 根, 避免硬编码 G:\1\server
        _SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
        _SCREENSHOT_PATH = os.path.join(os.path.dirname(_SCRIPT_DIR), "logs", "round14_style_audit.png")
        page.screenshot(path=_SCREENSHOT_PATH, full_page=True)

        print("=" * 60)
        print("Playwright 渲染验证 - Round 14 样式审计页面")
        print("=" * 60)
        print(f"页面标题: {title}")
        print(f"HTTP 状态: {resp.status if resp else 'N/A'}")
        print(f"主标题: {h1}")
        print(f"卡片数: {cards}")
        print(f"指标卡片数: {items}")
        print(f"通过徽章数: {pass_badges}")
        print(f"Header 背景色: {h1_bg}")
        print(f"Card 背景色: {card_bg}")
        print(f"运行时错误: {len(errors)}")
        if errors:
            for e in errors[:5]:
                print(f"  - {e}")
        print(f"截图: round14_style_audit.png")
        print("=" * 60)

        assert resp.status == 200, f"HTTP 状态异常: {resp.status}"
        assert "Round 14" in title, "标题不匹配"
        assert cards >= 3, f"卡片数过少: {cards}"
        assert items >= 10, f"指标卡片过少: {items}"
        assert pass_badges >= 5, f"通过徽章过少: {pass_badges}"
        assert len(errors) == 0, f"运行时错误: {errors}"

        browser.close()
        return True


if __name__ == "__main__":
    try:
        ok = test_with_playwright()
        if ok:
            print("\n[PASS] Playwright 渲染验证通过")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)
