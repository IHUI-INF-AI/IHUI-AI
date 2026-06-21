"""Playwright 验证 - 全部四轮修复的端到端检查."""


from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        results = []

        def check(label, status, expected):
            ok = status == expected
            mark = "PASS" if ok else "FAIL"
            results.append((mark, label, status, expected))

        # 1. /healthz 健康检查
        r = page.request.get("http://127.0.0.1:18085/healthz")
        check("/healthz", r.status, 200)
        body = r.json()
        assert body.get("status") == "ok", f"healthz body={body}"
        results.append(("PASS", "/healthz body 含 status=ok", body, "ok"))

        # 2. /health
        r = page.request.get("http://127.0.0.1:18085/health")
        check("/health", r.status, 200)

        # 3. 静态资源 HTML 别名
        r = page.request.get("http://127.0.0.1:18085/oauth_app_management")
        check("/oauth_app_management", r.status, 200)

        r = page.request.get("http://127.0.0.1:18085/agent_management")
        check("/agent_management", r.status, 200)

        r = page.request.get("http://127.0.0.1:18085/config_page")
        check("/config_page", r.status, 200)

        r = page.request.get("http://127.0.0.1:18085/sms_login")
        check("/sms_login", r.status, 200)

        # 4. /static/ 路径
        r = page.request.get("http://127.0.0.1:18085/static/oauth_app_management.html")
        check("/static/oauth_app_management.html", r.status, 200)

        # 5. 业务路径无 token 返回 401 (Bug-11 修复)
        r = page.request.get("http://127.0.0.1:18085/api/v1/users/me")
        check("/api/v1/users/me 无 token", r.status, 401)

        # 6. Google OAuth config 端点
        r = page.request.get("http://127.0.0.1:18085/api/v1/auth/google/config")
        check("/api/v1/auth/google/config", r.status, 200)

        # 7. 根路径 → /healthz
        r = page.request.get("http://127.0.0.1:18085/", max_redirects=0)
        check("/", r.status, 307)

        # 8. docs 文档页
        r = page.request.get("http://127.0.0.1:18085/docs")
        check("/docs", r.status, 200)

        # 9. openapi.json
        r = page.request.get("http://127.0.0.1:18085/openapi.json")
        check("/openapi.json", r.status, 200)
        spec = r.json()
        assert "openapi" in spec and "paths" in spec, f"openapi 格式错: {list(spec.keys())}"
        results.append(("PASS", "/openapi.json 包含 openapi/paths", list(spec.keys())[:3], "ok"))

        # 10. /metrics Prometheus 端点 (Bug-13 修复验证)
        r = page.request.get("http://127.0.0.1:18085/metrics")
        check("/metrics", r.status, 200)
        body = r.text()
        if "zhs_biz_ws_pubsub_reconnects_total" in body:
            results.append(("PASS", "/metrics 暴露 WS_PUBSUB_RECONNECTS 指标", True, True))
        else:
            results.append(("FAIL", "/metrics 应暴露 WS_PUBSUB_RECONNECTS 指标", False, True))

        # 11. /api/v1/auth/login 公开路径
        r = page.request.get("http://127.0.0.1:18085/api/v1/auth/captcha")
        if r.status != 401:
            results.append(("PASS", "/api/v1/auth/captcha 公开放行 (无 401)", r.status, "≠401"))
        else:
            results.append(("FAIL", "/api/v1/auth/captcha 不应 401", r.status, "≠401"))

        # 12. 支付通知路径公开
        r = page.request.post("http://127.0.0.1:18085/api/v1/payments/alipay/notify")
        if r.status != 401:
            results.append(("PASS", "支付通知公开放行", r.status, "≠401"))
        else:
            results.append(("FAIL", "支付通知不应 401", r.status, "≠401"))

        # 13. 第四轮: 静态资源缓存 (Bug-41 验证)
        r = page.request.get("http://127.0.0.1:18085/static/oauth_app_management.html")
        cache = r.headers.get("cache-control", "")
        results.append(("INFO", "HTML 不缓存 (no-store)", cache, "ok"))

        # 14. /openapi.json 包含新加的工具路由
        spec = r if False else page.request.get("http://127.0.0.1:18085/openapi.json").json()
        paths = spec.get("paths", {})
        if any("/google/" in p for p in paths):
            results.append(("PASS", "openapi 包含 google 路由", True, True))
        else:
            results.append(("FAIL", "openapi 应包含 google 路由", list(paths.keys())[:5], "ok"))

        browser.close()

        # 输出结果
        print("\n" + "=" * 60)
        print("Playwright 端到端验证报告")
        print("=" * 60)
        pass_n = 0
        fail_n = 0
        for mark, label, actual, expected in results:
            print(f"[{mark}] {label} | 实际: {actual} | 期望: {expected}")
            if mark == "PASS":
                pass_n += 1
            else:
                fail_n += 1
        print("=" * 60)
        print(f"汇总: {pass_n} PASS / {fail_n} FAIL / {len(results)} TOTAL")
        return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
