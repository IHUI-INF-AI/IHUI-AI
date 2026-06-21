"""Playwright 端到端验证 - 第八轮 8 项修复 (Bug-75/76/77/78/79/80/81/82).

第八轮为基础设施类修复, 主要在 app/utils/ 下新增 8 个模块.
E2E 验证维度:
  1. 后端服务可启动, /healthz 200
  2. 8 个 utils 模块能被业务运行时正确 import
  3. /openapi.json 仍可生成 (证明 main.py 加载未因新模块出错)
  4. /metrics 仍可访问
  5. 调用 main 应用对 utils 引用, 验证功能在运行时正常
"""

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
        check("Bug-75-82 服务存活 /healthz", r.status, 200)

        # ----- OpenAPI 仍可生成 -----
        r = page.request.get("http://127.0.0.1:18085/openapi.json")
        check("Bug-75-82 /openapi.json 可生成", r.status, 200)
        spec = r.json() if r.status == 200 else {}
        paths = spec.get("paths", {}) if isinstance(spec, dict) else {}
        check("Bug-75-82 openapi 包含 paths", len(paths) > 0, True)

        # ----- /metrics 仍可访问 -----
        r = page.request.get("http://127.0.0.1:18085/metrics")
        reachable("Bug-75-82 /metrics 端点不 5xx", r.status)

        # ----- 验证一个常规业务端点能跑通 -----
        r = page.request.get("http://127.0.0.1:18085/api/v1/system/health")
        reachable("Bug-75-82 业务路由可访问", r.status)

        # ----- 运行时调用 8 个模块的核心接口 -----
        try:
            from app.utils.db_warmup import db_warmup

            # register(name, engine): 用 None 占位 (e2e 阶段不做真预热)
            db_warmup.register("e2e_75_node", engine=None)
            s = db_warmup.stats()
            check("Bug-75 db_warmup 注册后 stats 含节点", "e2e_75_node" in s.get("nodes", {}), True)
            info(
                "Bug-75 db_warmup stats",
                json.dumps({"warmup_size": s.get("warmup_size"), "nodes_count": len(s.get("nodes", {}))}, default=str),
            )
        except Exception as e:
            check("Bug-75 db_warmup 加载", f"{e!r}", None)

        try:
            from app.utils.sse_resume import sse_resume

            sid = "e2e_76_stream"
            sse_resume.start_stream(sid)
            seq = sse_resume.append(sid, data="hello e2e", event="msg")
            check("Bug-76 sse_resume append 返回 seq > 0", seq > 0, True)
            chunk = sse_resume.resume(sid, last_seq=seq - 1)
            check("Bug-76 sse_resume resume 拿到 chunk", len(chunk) >= 1, True)
            sse_resume.finish(sid)
        except Exception as e:
            check("Bug-76 sse_resume 加载", f"{e!r}", None)

        try:
            from app.utils.ratelimit_auto_scope import scope_resolver

            class _FakeReq:
                headers = {"X-Tenant-Id": "e2e_77"}
                client = type("C", (), {"host": "1.2.3.4"})()

            # resolve 返回带 scope 前缀, e.g. "tenant:e2e_77"
            t = scope_resolver.resolve(_FakeReq(), scope="tenant")
            check("Bug-77 scope_resolve 包含 tenant 前缀", "e2e_77" in t and t.startswith("tenant:"), True)
            info("Bug-77 scope_resolver stats", json.dumps(scope_resolver.stats(), default=str))
        except Exception as e:
            check("Bug-77 scope_resolver 加载", f"{e!r}", None)

        try:
            from app.utils.cb_adaptive import adaptive_circuit_breaker

            cb = adaptive_circuit_breaker("e2e_78", failure_threshold=2)
            check("Bug-78 adaptive_circuit_breaker 创建", cb is not None, True)
            info("Bug-78 cb state", cb.stats.state.value)
        except Exception as e:
            check("Bug-78 adaptive_cb 加载", f"{e!r}", None)

        try:
            from app.utils.rollout_sampling import rollout_sampler

            rollout_sampler.set_sample_rate("e2e_79", rate=1.0)
            hit = rollout_sampler.record_hit("e2e_79", bucket="b1", version="v1", hit=True)
            check("Bug-79 rollout_sampler 全量采样命中", hit, True)
            info("Bug-79 rollout_sampler stats", json.dumps(rollout_sampler.get_stats("e2e_79"), default=str))
            rollout_sampler.reset("e2e_79")
        except Exception as e:
            check("Bug-79 rollout_sampler 加载", f"{e!r}", None)

        try:
            import os
            import tempfile

            from app.utils.audit_archive import audit_archiver

            tmp = tempfile.mkdtemp(prefix="e2e_80_")
            audit_archiver._archive_dir = tmp
            info_obj = audit_archiver.archive_range(
                entries=[{"seq": 1, "ts": 1.0, "hash": "h1", "prev_hash": "0" * 64}],
                start_seq=1,
                end_seq=1,
                reason="e2e_80",
            )
            check("Bug-80 audit_archiver 归档非空", info_obj.entry_count, 1)
            try:
                os.remove(info_obj.path)
            except OSError:
                pass
        except Exception as e:
            check("Bug-80 audit_archive 加载", f"{e!r}", None)

        try:
            from app.utils.deadcode_ci import ci_runner

            r = ci_runner.run(paths=[str(ROOT / "app" / "utils")], threshold=10000)
            check("Bug-81 ci_runner run 返回对象", r is not None, True)
            info("Bug-81 ci_runner scanned_files", r.scanned_files)
        except Exception as e:
            check("Bug-81 deadcode_ci 加载", f"{e!r}", None)

        try:
            from app.utils.ws_tenant_limit import ws_conn_limiter

            ws_conn_limiter.set_limits(max_per_tenant=10, max_per_user=5, max_per_ip=10, max_global=100)
            ok = ws_conn_limiter.acquire(tenant_id="e2e_82", user_id="u1", client_ip="9.9.9.9")
            check("Bug-82 ws_conn_limiter acquire", ok, True)
            ws_conn_limiter.release(tenant_id="e2e_82", user_id="u1", client_ip="9.9.9.9")
        except Exception as e:
            check("Bug-82 ws_tenant_limit 加载", f"{e!r}", None)

        browser.close()
        return _report(results)


def _run_runtime_only():
    """无服务时, 直接 import 应用, 验证 8 个 utils 不破坏应用加载."""
    results = []

    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-75
    try:
        from app.utils.db_warmup import db_warmup

        db_warmup.register("e2e_75_node", engine=None)
        s = db_warmup.stats()
        check("Bug-75 db_warmup 注册后 stats 含节点", "e2e_75_node" in s.get("nodes", {}), True)
        info(
            "Bug-75 db_warmup stats",
            json.dumps({"warmup_size": s.get("warmup_size"), "nodes_count": len(s.get("nodes", {}))}, default=str),
        )
    except Exception as e:
        check("Bug-75 db_warmup 加载", f"{e!r}", None)

    # Bug-76
    try:
        from app.utils.sse_resume import sse_resume

        sid = "e2e_76_stream_" + str(int(time.time() * 1000))
        sse_resume.start_stream(sid)
        seq = sse_resume.append(sid, data="hello e2e", event="msg")
        check("Bug-76 sse_resume append 返回 seq > 0", seq > 0, True)
        chunk = sse_resume.resume(sid, last_seq=seq - 1)
        check("Bug-76 sse_resume resume 拿到 chunk", len(chunk) >= 1, True)
        sse_resume.finish(sid)
    except Exception as e:
        check("Bug-76 sse_resume 加载", f"{e!r}", None)

    # Bug-77
    try:
        from app.utils.ratelimit_auto_scope import scope_resolver

        class _FakeReq:
            headers = {"X-Tenant-Id": "e2e_77"}
            client = type("C", (), {"host": "1.2.3.4"})()

        t = scope_resolver.resolve(_FakeReq(), scope="tenant")
        check("Bug-77 scope_resolve 包含 tenant 前缀", "e2e_77" in t and t.startswith("tenant:"), True)
        info("Bug-77 scope_resolver stats", json.dumps(scope_resolver.stats(), default=str))
    except Exception as e:
        check("Bug-77 scope_resolver 加载", f"{e!r}", None)

    # Bug-78
    try:
        from app.utils.cb_adaptive import adaptive_circuit_breaker

        cb = adaptive_circuit_breaker("e2e_78", failure_threshold=2)
        check("Bug-78 adaptive_circuit_breaker 创建", cb is not None, True)
        info("Bug-78 cb state", cb.stats.state.value)
    except Exception as e:
        check("Bug-78 adaptive_cb 加载", f"{e!r}", None)

    # Bug-79
    try:
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.set_sample_rate("e2e_79", rate=1.0)
        hit = rollout_sampler.record_hit("e2e_79", bucket="b1", version="v1", hit=True)
        check("Bug-79 rollout_sampler 全量采样命中", hit, True)
        info("Bug-79 rollout_sampler stats", json.dumps(rollout_sampler.get_stats("e2e_79"), default=str))
        rollout_sampler.reset("e2e_79")
    except Exception as e:
        check("Bug-79 rollout_sampler 加载", f"{e!r}", None)

    # Bug-80
    try:
        import os
        import tempfile

        from app.utils.audit_archive import audit_archiver

        tmp = tempfile.mkdtemp(prefix="e2e_80_")
        audit_archiver._archive_dir = tmp
        info_obj = audit_archiver.archive_range(
            entries=[{"seq": 1, "ts": 1.0, "hash": "h1", "prev_hash": "0" * 64}],
            start_seq=1,
            end_seq=1,
            reason="e2e_80",
        )
        check("Bug-80 audit_archiver 归档非空", info_obj.entry_count, 1)
        try:
            os.remove(info_obj.path)
        except OSError:
            pass
    except Exception as e:
        check("Bug-80 audit_archive 加载", f"{e!r}", None)

    # Bug-81
    try:
        from app.utils.deadcode_ci import ci_runner

        r = ci_runner.run(paths=[str(ROOT / "app" / "utils")], threshold=10000)
        check("Bug-81 ci_runner run 返回对象", r is not None, True)
        info("Bug-81 ci_runner scanned_files", r.scanned_files)
    except Exception as e:
        check("Bug-81 deadcode_ci 加载", f"{e!r}", None)

    # Bug-82
    try:
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=10, max_per_user=5, max_per_ip=10, max_global=100)
        ok = ws_conn_limiter.acquire(tenant_id="e2e_82", user_id="u1", client_ip="9.9.9.9")
        check("Bug-82 ws_conn_limiter acquire", ok, True)
        ws_conn_limiter.release(tenant_id="e2e_82", user_id="u1", client_ip="9.9.9.9")
    except Exception as e:
        check("Bug-82 ws_tenant_limit 加载", f"{e!r}", None)

    return _report(results)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第八轮端到端验证报告")
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
