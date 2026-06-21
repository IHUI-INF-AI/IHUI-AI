"""Playwright 端到端验证 - 第十一轮 8 项修复 (Bug-99/100/101/102/103/104/105/106)."""

import os
import socket
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")


def _port_in_use(host="127.0.0.1", port=18086):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.close()
        return True
    except OSError:
        return False


def main():
    use_browser = _port_in_use()
    if use_browser:
        return _with_browser()
    return _runtime_only()


def _with_browser():
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

        r = page.request.get("http://127.0.0.1:18086/healthz")
        check("Bug-99-106 服务存活 /healthz", r.status, 200)
        r = page.request.get("http://127.0.0.1:18086/openapi.json")
        check("Bug-99-106 /openapi.json 可生成", r.status, 200)

        _verify_modules(results)
        browser.close()
        return _report(results)


def _runtime_only():
    results = []
    _verify_modules(results)
    return _report(results)


def _verify_modules(results):
    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-99 DDL 审计
    try:
        from app.utils.audit_ddl_trail import DdlAuditTrail, ddl_audit

        ddl_audit.clear()
        ddl_audit.record("CREATE", "TABLE", "e2e_99_t1", "alice", "CREATE TABLE e2e_99_t1(id INT)")
        ddl_audit.record("ALTER", "TABLE", "e2e_99_t1", "alice", "ALTER TABLE e2e_99_t1 ADD COLUMN x INT")
        v = ddl_audit.verify()
        check("Bug-99 哈希链校验通过", v["ok"], True)
        check("Bug-99 总条数 2", v["total"], 2)
        s = ddl_audit.stats()
        check(
            "Bug-99 by_op 含 CREATE/ALTER", s["by_op"].get("CREATE", 0) >= 1 and s["by_op"].get("ALTER", 0) >= 1, True
        )
        # 持久化
        with tempfile.TemporaryDirectory() as td:
            p = str(Path(td) / "e2e_99.jsonl")
            t = DdlAuditTrail(log_path=p)
            t.record("DROP", "TABLE", "e2e_99_t2", "bob", "DROP TABLE e2e_99_t2")
            t2 = DdlAuditTrail(log_path=p)
            check("Bug-99 持久化加载条数", t2.stats()["total"], 1)
    except Exception as e:
        check("Bug-99 ddl_audit 加载", f"{e!r}", None)

    # Bug-100 冷启动预热
    try:
        from app.utils.cold_start_warmup import ColdStartWarmup, cold_warmup

        cold_warmup.clear()
        cold_warmup.register("e2e_100_cfg", lambda: "config_loaded", priority=100)
        cold_warmup.register("e2e_100_db", lambda: 42, priority=80, deps=["e2e_100_cfg"])
        r = cold_warmup.run_all()
        check("Bug-100 全部 ready", r["failed"], [])
        check("Bug-100 cfg 在 ready 列表", "e2e_100_cfg" in r["ready"], True)
        check("Bug-100 db 在 ready 列表", "e2e_100_db" in r["ready"], True)
        # 循环依赖
        w = ColdStartWarmup()
        w.register("x", lambda: 1, deps=["y"])
        w.register("y", lambda: 1, deps=["x"])
        try:
            w.run_all()
            check("Bug-100 循环依赖应抛异常", "no_raise", "raise")
        except ValueError:
            check("Bug-100 循环依赖抛 ValueError", "raised", "raised")
    except Exception as e:
        check("Bug-100 cold_warmup 加载", f"{e!r}", None)

    # Bug-101 异步执行器
    try:
        from app.utils.asyncio_executor import executor_bundle

        fut = executor_bundle.submit_io_future(lambda x: x + 10, 5)
        check("Bug-101 IO 池 5+10=15", fut.result(timeout=5), 15)
        fut2 = executor_bundle.submit_biz_future(lambda x: x * 3, 4)
        check("Bug-101 业务池 4*3=12", fut2.result(timeout=5), 12)
        s = executor_bundle.stats()
        check("Bug-101 业务池 submitted>=1", s["biz"]["submitted"] >= 1, True)
        check("Bug-101 IO 池 submitted>=1", s["io"]["submitted"] >= 1, True)
    except Exception as e:
        check("Bug-101 executor_bundle 加载", f"{e!r}", None)

    # Bug-102 熔断器
    try:
        from app.utils.cb_metrics import CbConfig, cb_registry

        cb = cb_registry.get_or_create("e2e_102", config=CbConfig(window_size=5, min_calls=3, error_rate_threshold=0.5))
        for _ in range(5):
            cb.record(success=False, duration_sec=0.1)
        check("Bug-102 错误率触发 OPEN", cb.get_state(), "open")
        check("Bug-102 allow 拒绝", cb.allow(), False)
        cb.force_close()
        check("Bug-102 强制恢复 CLOSED", cb.get_state(), "closed")
        # prometheus
        out = cb.prometheus_metrics()
        check("Bug-102 prometheus 输出含 cb_state", "cb_state" in out, True)
    except Exception as e:
        check("Bug-102 cb_metrics 加载", f"{e!r}", None)

    # Bug-103 租户配额
    try:
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        changes = quota_watcher.upsert("e2e_103_t1", qps=500, concurrency=20, monthly=1_000_000, tier="pro")
        check("Bug-103 upsert 返回变化列表", isinstance(changes, list) and len(changes) >= 3, True)
        q = quota_watcher.get("e2e_103_t1")
        check("Bug-103 配额持久化 qps=500", q.qps, 500)
        # 回调
        received = []
        quota_watcher.on_change("e2e_103_t1", lambda rec: received.append(rec))
        quota_watcher.upsert("e2e_103_t1", qps=1000)
        check("Bug-103 变更回调触发", len(received) >= 1, True)
        # 漂移
        quota_watcher.report_drift("e2e_103_t1", "qps", 500, 80)
        check("Bug-103 漂移报告", quota_watcher.stats()["drift_warnings"] >= 1, True)
    except Exception as e:
        check("Bug-103 quota_watcher 加载", f"{e!r}", None)

    # Bug-104 分片上传
    try:
        from app.utils.chunked_upload import ChunkedUploadManager

        with tempfile.TemporaryDirectory() as td:
            mgr = ChunkedUploadManager(storage_dir=td, session_ttl_sec=60.0)
            data = b"hello world this is a test"
            mgr.init_session("e2e_104_f1", "test.bin", len(data), 5)
            for i, off in enumerate(range(0, len(data), 5)):
                chunk = data[off : off + 5]
                r = mgr.upload_chunk("e2e_104_f1", i, chunk)
                check(f"Bug-104 上传分片 {i}", r["ok"], True)
            m = mgr.merge("e2e_104_f1")
            check("Bug-104 合并成功", m["ok"], True)
            check("Bug-104 SHA256 正确", m["sha256"] == __import__("hashlib").sha256(data).hexdigest(), True)
            # 断点续传
            info_chunks = mgr.get_resume_info("e2e_104_f1")
            check("Bug-104 合并后无需 resume", info_chunks["status"], "completed")
            mgr.cleanup("e2e_104_f1")
    except Exception as e:
        check("Bug-104 chunked_upload 加载", f"{e!r}", None)

    # Bug-105 WS 鉴权
    try:
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("e2e_105_alice", ttl=60.0)
        r = ws_token_mgr.handshake("e2e_105_c1", "e2e_105_alice", "t1", token)
        check("Bug-105 握手成功", r.value, "ok")
        r2 = ws_token_mgr.handshake("e2e_105_c1b", "e2e_105_alice", "t2", token)
        check("Bug-105 同 token 不同 conn 可登录", r2.value, "ok")
        # 黑名单
        ws_token_mgr.revoke("e2e_105_c1", reason="test")
        r3 = ws_token_mgr.handshake("e2e_105_c1c", "e2e_105_alice", "t1", token)
        check("Bug-105 黑名单后拒绝", r3.value, "revoked")
        # tenant mismatch
        token2 = ws_token_mgr.issue_token("e2e_105_bob", ttl=60.0)
        ws_token_mgr.handshake("e2e_105_c2", "e2e_105_bob", "t1", token2)
        rt = ws_token_mgr.verify_tenant("e2e_105_c2", "t9")
        check("Bug-105 tenant mismatch 拒绝", rt.value, "tenant_mismatch")
        # 审计
        audit = ws_token_mgr.get_audit(limit=20)
        check("Bug-105 审计有记录", len(audit) >= 3, True)
    except Exception as e:
        check("Bug-105 ws_token_mgr 加载", f"{e!r}", None)

    # Bug-106 灰度规则快照
    try:
        from app.utils.canary_rule_snapshot import CanaryPhase, CanaryRuleStore

        with tempfile.TemporaryDirectory() as td:
            sd = str(Path(td) / "snap")
            os.makedirs(sd, exist_ok=True)
            st1 = CanaryRuleStore(snapshot_dir=sd)
            st1.upsert("e2e_106_r1", "tag=blue", ratio=0.1, phase=CanaryPhase.OFF.value, updated_by="e2e")
            st1.upsert("e2e_106_r2", "tag=green", ratio=0.5, allowlist=["vip"], phase=CanaryPhase.OFF.value)
            check("Bug-106 OFF 时不匹配", st1.match("tag", "blue") is None, True)
            st1.set_phase("e2e_106_r1", "canary")
            r = st1.match("tag", "blue")
            check("Bug-106 改 phase 后可匹配", r is not None and r.name == "e2e_106_r1", True)
            rec = st1.snapshot(archive=True)
            check("Bug-106 snapshot 返回 record", rec is not None, True)
            st2 = CanaryRuleStore(snapshot_dir=sd)
            check("Bug-106 重启后规则恢复", st2.get("e2e_106_r1") is not None, True)
            v = st2.verify()
            check("Bug-106 快照校验通过", v["ok"], True)
    except Exception as e:
        check("Bug-106 canary_store 加载", f"{e!r}", None)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第十一轮端到端验证报告")
    print("=" * 60)
    pass_n = 0
    fail_n = 0
    info_n = 0
    for mark, label, actual, expected in results:
        line = f"[{mark}] {label} | 实际: {actual} | 期望: {expected}"
        if len(line) > 200:
            line = line[:200] + "..."
        print(line)
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
