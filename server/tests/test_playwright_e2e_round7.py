"""Playwright 端到端验证 - 第七轮 8 项修复 (Bug-67/68/69/70/71/72/73/74).

第七轮为基础设施类修复, 无独立 HTTP 端点.
E2E 验证维度:
  1. 后端服务可启动, /healthz 200
  2. 7 个 utils 模块能被业务运行时正确 import
  3. /openapi.json 仍可生成 (证明 main.py 加载未因新模块出错)
  4. /metrics 仍可访问
  5. 调用 main 应用对 utils 引用, 验证功能在运行时正常
"""

import socket
import sys
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
        check("Bug-67-74 服务存活 /healthz", r.status, 200)

        # ----- OpenAPI 仍可生成 (证明 main 加载未因新模块失败) -----
        r = page.request.get("http://127.0.0.1:18085/openapi.json")
        check("Bug-67-74 /openapi.json 可生成", r.status, 200)
        spec = r.json() if r.status == 200 else {}
        paths = spec.get("paths", {}) if isinstance(spec, dict) else {}
        check("Bug-67-74 openapi 包含 paths", len(paths) > 0, True)

        # ----- /metrics 仍可访问 -----
        r = page.request.get("http://127.0.0.1:18085/metrics")
        reachable("Bug-67-74 /metrics 端点不 5xx", r.status)

        # ----- 验证一个常规业务端点能跑通 (404 算正常, 5xx 算异常) -----
        r = page.request.get("http://127.0.0.1:18085/api/v1/system/health")
        reachable("Bug-67-74 业务路由可访问", r.status)

        browser.close()
        return _report(results)


def _run_runtime_only():
    """无服务时, 直接 import 应用, 验证 7 个 utils 不破坏应用加载."""
    results = []

    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-67
    try:
        from app.utils.db_router import db_router

        db_router.register("e2e_67", master_url="postgresql://m", slave_urls=["postgresql://s1"])
        m = db_router.pick_for_write("e2e_67")
        check("Bug-67 db_router 可用", m is not None, True)
        db_router.unregister("e2e_67")
    except Exception as e:
        check("Bug-67 db_router 加载", f"{e!r}", None)

    # Bug-68
    try:
        from app.utils.rate_limit_dist import RateLimitRule, rate_limiter

        rate_limiter.add_rule(RateLimitRule(name="e2e_68", limit=10, window_sec=60))
        r = rate_limiter.check("e2e_68", request=None)
        check("Bug-68 rate_limiter check 正常", r.get("allowed") is True, True)
        rate_limiter.remove_rule("e2e_68")
    except Exception as e:
        check("Bug-68 rate_limiter 加载", f"{e!r}", None)

    # Bug-69
    try:
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("e2e_69", failure_threshold=2)
        check("Bug-69 circuit_breaker CLOSED 初态", cb.stats.state, CircuitState.CLOSED)
    except Exception as e:
        check("Bug-69 circuit_breaker 加载", f"{e!r}", None)

    # Bug-70
    try:
        from app.utils.sdk_generator import generate_py, generate_ts

        ts = generate_ts({"openapi": "3.0.0", "info": {"title": "t", "version": "1"}, "paths": {}})
        py = generate_py({"openapi": "3.0.0", "info": {"title": "p", "version": "1"}, "paths": {}})
        check("Bug-70 sdk_generator TS 生成", "ApiClient" in ts, True)
        check("Bug-70 sdk_generator PY 生成", "ApiClient" in py, True)
    except Exception as e:
        check("Bug-70 sdk_generator 加载", f"{e!r}", None)

    # Bug-71
    try:
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("e2e_71", version="v2", buckets=range(50, 100))
        v = rollout.is_in_version("e2e_71", "user-1")
        check("Bug-71 gradual_rollout 返回 v1 或 v2", v in ("v1", "v2"), True)
        rollout.remove_experiment("e2e_71")
    except Exception as e:
        check("Bug-71 gradual_rollout 加载", f"{e!r}", None)

    # Bug-72
    try:
        from app.utils.audit_chain import audit_chain

        e = audit_chain.append(action="e2e_test", user="u1", payload={"k": 1})
        ok = audit_chain.verify_chain()
        check("Bug-72 audit_chain append+verify", ok, True)
        info("Bug-72 audit_chain seq", e.seq)
    except Exception as e:
        check("Bug-72 audit_chain 加载", f"{e!r}", None)

    # Bug-73
    try:
        from app.utils.dead_code_detector import dead_code_scanner

        report = dead_code_scanner.scan([str(ROOT / "app" / "utils")])
        s = report.summary()
        check("Bug-73 dead_code 扫描完成", isinstance(s, dict), True)
        info("Bug-73 dead_code 总数", s.get("total_dead", 0))
    except Exception as e:
        check("Bug-73 dead_code 加载", f"{e!r}", None)

    # Bug-74
    try:
        from app.utils.ws_heartbeat import ReconnectBackoff, get_state

        bo = ReconnectBackoff(initial=1, max_wait=10)
        w = bo.next_wait()
        check("Bug-74 ReconnectBackoff 计算", w > 0, True)
        st = get_state("ws://e2e/test")
        check("Bug-74 get_state 拿到 WsConnectionState", st is not None, True)
    except Exception as e:
        check("Bug-74 ws_heartbeat 加载", f"{e!r}", None)

    return _report(results)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第七轮端到端验证报告")
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
