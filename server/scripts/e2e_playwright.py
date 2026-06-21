"""Playwright 前端 E2E 测试.

覆盖核心页面:
  - /static/sms_login.html    短信登录
  - /static/ruoyi/login.html  RuoYi 登录
  - /static/index.html        首页
  - /static/agent_management.html  智能体管理
  - /docs                     Swagger UI
  - /health/live              健康检查
  - /api/mock/status          Mock 状态

用法:
  python scripts/e2e_playwright.py
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8000"

PAGES = [
    # (path, expected_element, name)
    ("/static/sms_login.html", "body", "SMS 登录页"),
    ("/static/ruoyi/login.html", "body", "RuoYi 登录页"),
    ("/static/ruoyi/index.html", "body", "RuoYi 首页"),
    ("/static/agent_management.html", "body", "智能体管理"),
    ("/static/oauth_app_management.html", "body", "OAuth 应用管理"),
    ("/docs", ".swagger-ui", "Swagger UI"),
    ("/health/live", "body", "健康检查"),
    ("/api/mock/status", "body", "Mock 状态"),
]


def test_pages():
    """核心页面加载测试."""
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        for path, selector, name in PAGES:
            url = BASE + path
            try:
                t0 = time.time()
                resp = page.goto(url, wait_until="domcontentloaded", timeout=15000)
                elapsed = time.time() - t0
                status = resp.status if resp else 0

                # 检查元素
                elem = page.query_selector(selector)
                has_elem = elem is not None

                # 检查 console error
                console_errors = []

                def _on_console(msg):
                    if msg.type == "error":
                        console_errors.append(msg.text)

                page.on("console", _on_console)
                time.sleep(0.5)

                ok = 200 <= status < 400 and has_elem and len(console_errors) == 0
                results.append(
                    {
                        "name": name,
                        "url": url,
                        "status": status,
                        "elapsed_ms": int(elapsed * 1000),
                        "has_elem": has_elem,
                        "console_errors": len(console_errors),
                        "ok": ok,
                    }
                )
            except Exception as e:
                results.append(
                    {
                        "name": name,
                        "url": url,
                        "status": 0,
                        "elapsed_ms": 0,
                        "has_elem": False,
                        "console_errors": -1,
                        "ok": False,
                        "error": str(e)[:100],
                    }
                )

        browser.close()

    # 打印结果
    print(f"\n{'=' * 80}")
    print(f"Playwright E2E 测试报告")
    print(f"{'=' * 80}")
    passed = 0
    for r in results:
        status = "OK" if r["ok"] else "FAIL"
        if r["ok"]:
            passed += 1
        print(
            f"[{status}] {r['name']:<20s} {r['url']:<50s} "
            f"status={r['status']} {r['elapsed_ms']}ms"
        )
        if not r["ok"]:
            if r.get("error"):
                print(f"       error: {r['error']}")
            else:
                print(
                    f"       has_elem={r.get('has_elem')} "
                    f"console_errors={r.get('console_errors')}"
                )
    print(f"{'=' * 80}")
    print(f"通过: {passed}/{len(results)} = {passed * 100 // len(results)}%")
    print(f"{'=' * 80}\n")
    return passed == len(results)


if __name__ == "__main__":
    success = test_pages()
    sys.exit(0 if success else 1)
