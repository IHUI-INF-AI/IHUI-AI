"""Playwright 端到端验证 - 第九轮 8 项修复 (Bug-83/84/85/86/87/88/89/90)."""

import json
import socket
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _port_in_use(host="127.0.0.1", port=18085):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.close()
        return True
    except OSError:
        return False


def main():
    if not _port_in_use():
        print("SKIP: 18085 端口未启动, 仅跑模块 import + 运行时验证")
        return _run_runtime_only()

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        results = []

        def check(label, actual, expected):
            mark = "PASS" if actual == expected else "FAIL"
            results.append((mark, label, actual, expected))

        def reachable(label, status):
            mark = "PASS" if status < 500 else "FAIL"
            results.append((mark, label, status, "<500"))

        def info(label, actual):
            results.append(("INFO", label, actual, "-"))

        # ----- 服务存活 -----
        r = page.request.get("http://127.0.0.1:18085/healthz")
        check("Bug-83-90 服务存活 /healthz", r.status, 200)

        # ----- OpenAPI 仍可生成 -----
        r = page.request.get("http://127.0.0.1:18085/openapi.json")
        check("Bug-83-90 /openapi.json 可生成", r.status, 200)

        # ----- /metrics 仍可访问 -----
        r = page.request.get("http://127.0.0.1:18085/metrics")
        reachable("Bug-83-90 /metrics 端点不 5xx", r.status)

        # ----- 验证 traceparent 可被服务消费 -----
        try:
            from app.utils.trace_context import extract_from_headers, inject_to_headers, new_trace

            c = extract_from_headers({"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"})
            check("Bug-83 traceparent 解析", c.trace_id, "0af7651916cd43dd8448eb211c80319c")
            new_trace(name="e2e_83")
            out = inject_to_headers()
            check("Bug-83 inject 包含 traceparent", "traceparent" in out, True)
        except Exception as e:
            check("Bug-83 trace_context 加载", f"{e!r}", None)

        # ----- 验证 llm_cost -----
        try:
            from app.utils.llm_cost import llm_cost_meter, record_llm_call

            rec = record_llm_call("gpt-4o", 100, 50, call_id="e2e_84")
            check("Bug-84 llm_cost record 返回 record", rec.cost_usd > 0, True)
            info("Bug-84 llm_cost stats", json.dumps(llm_cost_meter.stats(), default=str))
        except Exception as e:
            check("Bug-84 llm_cost 加载", f"{e!r}", None)

        # ----- 验证 ws_dedup -----
        try:
            from app.utils.ws_dedup import ws_deduper

            sid = f"e2e_85_{int(time.time() * 1000)}"
            assert ws_deduper.is_duplicate(sid) is False
            ws_deduper.remember(sid, result={"ok": True})
            check("Bug-85 ws_dedup 第二次识别为重复", ws_deduper.is_duplicate(sid), True)
        except Exception as e:
            check("Bug-85 ws_dedup 加载", f"{e!r}", None)

        # ----- 验证 slow_sql_killer -----
        try:
            from app.utils.slow_sql_killer import slow_sql_killer

            slow_sql_killer.set_threshold(0.05)
            slow_sql_killer.check_and_kill("SELECT 1", 0.2, {}, "e2e_86")
            s = slow_sql_killer.stats()
            check("Bug-86 slow_sql_killer 记录触发", s["total_slow"] >= 1, True)
            slow_sql_killer.set_threshold(1.0)
        except Exception as e:
            check("Bug-86 slow_sql_killer 加载", f"{e!r}", None)

        # ----- 验证 hot_config -----
        try:
            from app.utils.hot_config import hot_config, hot_get, hot_set

            hot_config.register("e2e_87_k", default=1, validator=int)
            hot_set("e2e_87_k", 99)
            check("Bug-87 hot_config set/get 生效", hot_get("e2e_87_k"), 99)
        except Exception as e:
            check("Bug-87 hot_config 加载", f"{e!r}", None)

        # ----- 验证 fair_rate_limit -----
        try:
            from app.utils.fair_rate_limit import fair_rate_limiter

            fair_rate_limiter.set_weight("e2e_88_t", weight=1.0)
            check("Bug-88 fair_rate_limiter 至少 1 次成功", fair_rate_limiter.acquire("e2e_88_t"), True)
            info(
                "Bug-88 fair stats",
                json.dumps(
                    {
                        "tenants": list(fair_rate_limiter.list_tenants()),
                        "total_qps": fair_rate_limiter.stats()["total_qps"],
                    },
                    default=str,
                ),
            )
        except Exception as e:
            check("Bug-88 fair_rate_limit 加载", f"{e!r}", None)

        # ----- 验证 label_cardinality -----
        try:
            from app.utils.label_cardinality import label_guard

            label_guard.allow("e2e_89_path", values=["/ok"])
            out = label_guard.wrap("m", {"e2e_89_path": "/ok"})
            check("Bug-89 label_guard 白名单通过", out["e2e_89_path"], "/ok")
            out2 = label_guard.wrap("m", {"e2e_89_path": "/bad"})
            check("Bug-89 label_guard 非白名单被替换", out2["e2e_89_path"], "other")
        except Exception as e:
            check("Bug-89 label_cardinality 加载", f"{e!r}", None)

        # ----- 验证 api_mask -----
        try:
            from app.utils.api_mask import response_masker

            response_masker.remove_rules()
            response_masker.set_audience("external")
            response_masker.add_rule("$.user.password", mask="full")
            out = response_masker.mask({"user": {"password": "secret"}})
            check("Bug-90 api_mask 替换 password", out["user"]["password"], "***")
        except Exception as e:
            check("Bug-90 api_mask 加载", f"{e!r}", None)

        browser.close()
        return _report(results)


def _run_runtime_only():
    results = []

    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-83
    try:
        from app.utils.trace_context import extract_from_headers, get_current, inject_to_headers, new_trace, span

        c = extract_from_headers({"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"})
        check("Bug-83 traceparent 解析", c.trace_id, "0af7651916cd43dd8448eb211c80319c")
        new_trace(name="e2e_83")
        out = inject_to_headers()
        check("Bug-83 inject 包含 traceparent", "traceparent" in out, True)
        # span context manager
        with span("e2e_83_work") as ctx:
            check("Bug-83 span 内 current 是 ctx", get_current() is ctx, True)
        cur = get_current()
        check("Bug-83 span 外 current 还原", cur is None or cur is not ctx, True)
    except Exception as e:
        check("Bug-83 trace_context 加载", f"{e!r}", None)

    # Bug-84
    try:
        from app.utils.llm_cost import llm_cost_meter, record_llm_call

        rec = record_llm_call("gpt-4o", 100, 50, call_id="e2e_84")
        check("Bug-84 llm_cost record 返回 record", rec.cost_usd > 0, True)
        info("Bug-84 llm_cost stats", json.dumps(llm_cost_meter.stats(), default=str))
    except Exception as e:
        check("Bug-84 llm_cost 加载", f"{e!r}", None)

    # Bug-85
    try:
        from app.utils.ws_dedup import ws_deduper

        sid = f"e2e_85_{int(time.time() * 1000)}"
        assert ws_deduper.is_duplicate(sid) is False
        ws_deduper.remember(sid, result={"ok": True})
        check("Bug-85 ws_dedup 第二次识别为重复", ws_deduper.is_duplicate(sid), True)
    except Exception as e:
        check("Bug-85 ws_dedup 加载", f"{e!r}", None)

    # Bug-86
    try:
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(0.05)
        slow_sql_killer.check_and_kill("SELECT 1", 0.2, {}, "e2e_86")
        s = slow_sql_killer.stats()
        check("Bug-86 slow_sql_killer 记录触发", s["total_slow"] >= 1, True)
        slow_sql_killer.set_threshold(1.0)
    except Exception as e:
        check("Bug-86 slow_sql_killer 加载", f"{e!r}", None)

    # Bug-87
    try:
        from app.utils.hot_config import hot_config, hot_get, hot_set

        hot_config.register("e2e_87_k", default=1, validator=int)
        hot_set("e2e_87_k", 99)
        check("Bug-87 hot_config set/get 生效", hot_get("e2e_87_k"), 99)
    except Exception as e:
        check("Bug-87 hot_config 加载", f"{e!r}", None)

    # Bug-88
    try:
        from app.utils.fair_rate_limit import fair_rate_limiter

        fair_rate_limiter.set_weight("e2e_88_t", weight=1.0)
        check("Bug-88 fair_rate_limiter 至少 1 次成功", fair_rate_limiter.acquire("e2e_88_t"), True)
        info(
            "Bug-88 fair stats",
            json.dumps(
                {
                    "tenants": list(fair_rate_limiter.list_tenants()),
                    "total_qps": fair_rate_limiter.stats()["total_qps"],
                },
                default=str,
            ),
        )
    except Exception as e:
        check("Bug-88 fair_rate_limit 加载", f"{e!r}", None)

    # Bug-89
    try:
        from app.utils.label_cardinality import label_guard

        label_guard.allow("e2e_89_path", values=["/ok"])
        out = label_guard.wrap("m", {"e2e_89_path": "/ok"})
        check("Bug-89 label_guard 白名单通过", out["e2e_89_path"], "/ok")
        out2 = label_guard.wrap("m", {"e2e_89_path": "/bad"})
        check("Bug-89 label_guard 非白名单被替换", out2["e2e_89_path"], "other")
    except Exception as e:
        check("Bug-89 label_cardinality 加载", f"{e!r}", None)

    # Bug-90
    try:
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.set_audience("external")
        response_masker.add_rule("$.user.password", mask="full")
        out = response_masker.mask({"user": {"password": "secret"}})
        check("Bug-90 api_mask 替换 password", out["user"]["password"], "***")
    except Exception as e:
        check("Bug-90 api_mask 加载", f"{e!r}", None)

    return _report(results)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第九轮端到端验证报告")
    print("=" * 60)
    pass_n = 0
    fail_n = 0
    info_n = 0
    for mark, label, actual, expected in results:
        print(f"[{mark}] {label} | 实际: {actual} | 期望: {expected}")
        if mark == "PASS":
            pass_n += 1
        elif mark == "FAIL":
            fail_n += 1
        else:
            info_n += 1
    print("=" * 60)
    print(f"汇总: {pass_n} PASS / {fail_n} FAIL / {info_n} INFO / {len(results)} TOTAL")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
