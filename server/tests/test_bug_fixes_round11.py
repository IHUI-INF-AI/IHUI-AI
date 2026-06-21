"""第十一轮 8 项 P2 Bug 修复的回归测试 (Bug-99 ~ Bug-106)."""

import asyncio
import hashlib
import os
import threading
import time

# ---------------------------------------------------------------------------
# Bug-99: DDL 审计链
# ---------------------------------------------------------------------------


class TestBug99DdlAudit:
    def test_record_basic(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        e = ddl_audit.record("CREATE", "TABLE", "users", "alice", "CREATE TABLE users(...)")
        assert e.op == "CREATE"
        assert e.obj_name == "users"
        assert e.hash != ""

    def test_hash_chain(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        e1 = ddl_audit.record("CREATE", "TABLE", "t1", "u", "sql1")
        e2 = ddl_audit.record("ALTER", "TABLE", "t1", "u", "sql2")
        assert e2.prev_hash == e1.hash

    def test_verify_ok(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        for i in range(5):
            ddl_audit.record("CREATE", "TABLE", f"t{i}", "u", f"sql{i}")
        v = ddl_audit.verify()
        assert v["ok"] is True
        assert v["total"] == 5

    def test_verify_tamper(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        e1 = ddl_audit.record("CREATE", "TABLE", "t1", "u", "sql1")
        e2 = ddl_audit.record("ALTER", "TABLE", "t1", "u", "sql2")
        # 篡改 e2
        e2.sql = "evil"
        v = ddl_audit.verify()
        assert v["ok"] is False
        assert v["broken_at"] == 1
        # 还原
        e2.sql = "sql2"

    def test_query(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        ddl_audit.record("CREATE", "TABLE", "t1", "alice", "s1")
        ddl_audit.record("ALTER", "TABLE", "t1", "bob", "s2")
        ddl_audit.record("DROP", "TABLE", "t2", "alice", "s3")
        results = ddl_audit.query(actor="alice")
        assert len(results) == 2
        results2 = ddl_audit.query(op="ALTER")
        assert len(results2) == 1
        assert results2[0].obj_name == "t1"

    def test_list_recent(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        for i in range(20):
            ddl_audit.record("CREATE", "TABLE", f"t{i}", "u", f"s{i}")
        recent = ddl_audit.list_recent(n=5)
        assert len(recent) == 5
        assert recent[-1].obj_name == "t19"

    def test_persistence(self, tmp_path):
        from app.utils.audit_ddl_trail import DdlAuditTrail

        p = str(tmp_path / "trail.jsonl")
        t1 = DdlAuditTrail(log_path=p)
        t1.record("CREATE", "TABLE", "x", "u", "sql")
        t1.record("ALTER", "TABLE", "x", "u", "sql2")
        # 重新加载
        t2 = DdlAuditTrail(log_path=p)
        assert t2.stats()["total"] == 2
        assert t2.verify()["ok"] is True

    def test_stats(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.clear()
        ddl_audit.record("CREATE", "TABLE", "t1", "u", "s")
        ddl_audit.record("DROP", "TABLE", "t2", "u", "s")
        s = ddl_audit.stats()
        assert s["total"] == 2
        assert s["by_op"]["CREATE"] == 1
        assert s["by_op"]["DROP"] == 1

    def test_clear(self):
        from app.utils.audit_ddl_trail import ddl_audit

        ddl_audit.record("CREATE", "TABLE", "t", "u", "s")
        ddl_audit.clear()
        assert ddl_audit.stats()["total"] == 0
        assert ddl_audit.verify()["ok"] is True

    def test_set_log_path(self, tmp_path):
        from app.utils.audit_ddl_trail import ddl_audit

        p = str(tmp_path / "t.jsonl")
        ddl_audit.set_log_path(p)
        ddl_audit.clear()
        ddl_audit.record("CREATE", "TABLE", "t", "u", "s")
        assert os.path.exists(p)


# ---------------------------------------------------------------------------
# Bug-100: 冷启动预热
# ---------------------------------------------------------------------------


class TestBug100ColdWarmup:
    def test_register_and_run(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("t1", lambda: "ok", priority=10)
        w.register("t2", lambda: 42, priority=5)
        r = w.run_all()
        assert w.is_ready("t1")
        assert w.is_ready("t2")
        assert r["failed"] == []

    def test_dependency_order(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        order = []

        def make_t(name, deps=None):
            def loader():
                order.append(name)
                return name

            return w.register(name, loader, deps=deps or [], priority=10)

        make_t("b", deps=["a"])
        make_t("a")
        w.run_all()
        # a 必须在 b 之前
        assert order.index("a") < order.index("b")

    def test_dep_failure_skip(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()

        def fail():
            raise RuntimeError("boom")

        w.register("a", fail, required=True)
        w.register("b", lambda: 1, deps=["a"])
        r = w.run_all()
        assert "a" in r["failed"]
        assert w.get_task("b").status.value == "skipped"

    def test_priority(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        order = []
        w.register("p1", lambda: order.append("p1"), priority=1)
        w.register("p2", lambda: order.append("p2"), priority=10)
        w.register("p3", lambda: order.append("p3"), priority=5)
        w.run_all()
        # p2 (10) > p3 (5) > p1 (1)
        assert order == ["p2", "p3", "p1"]

    def test_optional_failure(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("opt", lambda: (_ for _ in ()).throw(RuntimeError("e")), required=False)
        r = w.run_all()
        # optional 失败不阻塞其它任务
        assert w.get_task("opt").status.value == "failed"
        assert w.get_task("opt").error != ""

    def test_rerun(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        state = {"x": 0}

        def loader():
            state["x"] += 1
            return state["x"]

        w.register("t", loader)
        w.run_all()
        assert state["x"] == 1
        w.rerun("t")
        assert state["x"] == 2

    def test_circular_dep(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("a", lambda: 1, deps=["b"])
        w.register("b", lambda: 1, deps=["a"])
        try:
            w.run_all()
            assert False, "应抛循环依赖异常"
        except ValueError as e:
            assert "循环依赖" in str(e) or "circular" in str(e).lower()

    def test_list_tasks(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("a", lambda: 1)
        w.register("b", lambda: 2)
        tasks = w.list_tasks()
        assert {t.name for t in tasks} == {"a", "b"}

    def test_unregister(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("a", lambda: 1)
        assert w.unregister("a") is True
        assert w.unregister("a") is False

    def test_stats(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("a", lambda: 1)
        w.run_all()
        s = w.stats()
        assert s["task_count"] == 1
        assert s["by_status"].get("ready", 0) == 1
        assert "a" in s["ready"]

    def test_clear(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()
        w.register("a", lambda: 1)
        w.clear()
        assert w.stats()["task_count"] == 0

    def test_async_loader(self):
        from app.utils.cold_start_warmup import ColdStartWarmup

        w = ColdStartWarmup()

        async def aload():
            await asyncio.sleep(0.01)
            return 99

        w.register("a", aload)
        r = asyncio.run(w.run_all_async())
        assert w.is_ready("a")
        assert r["elapsed"] >= 0.01


# ---------------------------------------------------------------------------
# Bug-101: 异步执行器
# ---------------------------------------------------------------------------


class TestBug101AsyncioExecutor:
    def test_submit_and_result(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="t1", max_workers=2, max_queue=10)
        fut = ex.submit_future(lambda x: x * 2, 5)
        assert fut.result(timeout=5) == 10
        s = ex.stats()
        assert s["submitted"] == 1
        assert s["completed"] == 1
        ex.shutdown()

    def test_overflow_drop(self):
        from app.utils.asyncio_executor import IsolatedExecutor, OverflowPolicy

        ex = IsolatedExecutor(name="t2", max_workers=1, max_queue=1, overflow=OverflowPolicy.DROP)
        block = threading.Event()

        def slow():
            block.wait(timeout=1.0)
            return 1

        ex.submit_future(slow)
        time.sleep(0.05)  # 等 worker 取出 slow 任务
        # worker 已占用, 队列 0/1. 填到满再触发 DROP
        for i in range(5):
            ex.submit(lambda: i, timeout=0.2)
        s = ex.stats()
        assert s["rejected"] >= 1, f"expected rejected>=1, got {s}"
        block.set()
        ex.shutdown(wait=False)

    def test_overflow_degrade(self):
        from app.utils.asyncio_executor import IsolatedExecutor, OverflowPolicy

        primary = IsolatedExecutor(name="p", max_workers=1, max_queue=1, overflow=OverflowPolicy.DEGRADE)
        fallback = IsolatedExecutor(name="f", max_workers=2, max_queue=10)
        primary._default = fallback
        block = threading.Event()

        def slow():
            block.wait(timeout=1.0)
            return "primary"

        primary.submit_future(slow)
        time.sleep(0.05)  # 等 worker 取出 slow
        # 触发降级
        fut = primary.submit_future(lambda: "fallback", timeout=0.2)
        # 此时应降级到 fallback
        fut2 = primary.submit_future(lambda: "fb2", timeout=0.2)
        block.set()
        ex_stats = primary.stats()
        assert ex_stats["degraded"] >= 1, f"expected degraded>=1, got {ex_stats}"
        primary.shutdown(wait=False)
        fallback.shutdown(wait=False)

    def test_map(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="m", max_workers=2, max_queue=10)
        out = ex.map(lambda x: x + 1, [1, 2, 3, 4], timeout=5)
        assert sorted(out) == [2, 3, 4, 5]
        ex.shutdown()

    def test_exception_capture(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="e", max_workers=1, max_queue=10)

        def boom():
            raise ValueError("bad")

        fut = ex.submit_future(boom)
        try:
            fut.result(timeout=5)
            assert False
        except ValueError:
            pass
        assert ex.stats()["failed"] == 1
        ex.shutdown()

    def test_active_count(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="a", max_workers=2, max_queue=10)
        block = threading.Event()

        def slow():
            block.wait(timeout=1.0)
            return 1

        ex.submit_future(slow)
        ex.submit_future(slow)
        time.sleep(0.1)
        s = ex.stats()
        assert s["active"] >= 1
        block.set()
        ex.shutdown(wait=False)

    def test_qsize(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="q", max_workers=1, max_queue=10)
        block = threading.Event()

        def slow():
            block.wait(timeout=1.0)
            return 1

        ex.submit_future(slow)
        time.sleep(0.1)
        assert ex.qsize() == 0  # 已取出执行
        block.set()
        ex.shutdown(wait=False)

    def test_bundle(self):
        from app.utils.asyncio_executor import AsyncioExecutorBundle

        b = AsyncioExecutorBundle(biz_workers=2, io_workers=4)
        fut = b.submit_io_future(lambda x: x + 1, 1)
        assert fut.result(timeout=5) == 2
        fut2 = b.submit_biz_future(lambda x: x * 10, 3)
        assert fut2.result(timeout=5) == 30
        s = b.stats()
        assert "io" in s and "biz" in s
        b.shutdown()

    def test_shutdown_drain(self):
        from app.utils.asyncio_executor import IsolatedExecutor

        ex = IsolatedExecutor(name="sd", max_workers=2, max_queue=10)
        ex.submit_future(lambda: 1)
        ex.submit_future(lambda: 2)
        ex.shutdown(wait=True, timeout=5)
        assert ex.stats()["completed"] == 2

    def test_overflow_raise(self):
        import queue as q_mod

        from app.utils.asyncio_executor import IsolatedExecutor, OverflowPolicy

        ex = IsolatedExecutor(name="r", max_workers=1, max_queue=1, overflow=OverflowPolicy.RAISE)
        block = threading.Event()

        def slow():
            block.wait(timeout=1.0)
            return 1

        ex.submit_future(slow)
        time.sleep(0.05)  # 等 worker 取出 slow
        # 连续多次 submit 触发队列满
        raised = False
        for _ in range(5):
            try:
                ex.submit_future(lambda: 1, timeout=0.2)
            except q_mod.Full:
                raised = True
                break
        assert raised, "应至少抛一次 queue.Full"
        block.set()
        ex.shutdown(wait=False)


# ---------------------------------------------------------------------------
# Bug-102: 熔断器指标
# ---------------------------------------------------------------------------


class TestBug102CbMetrics:
    def test_closed_state(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t1")
        assert cb.get_state() == "closed"
        assert cb.allow() is True

    def test_open_after_error_rate(self):
        from app.utils.cb_metrics import CbConfig, CbMetrics

        cb = CbMetrics("t2", config=CbConfig(window_size=5, min_calls=3, error_rate_threshold=0.5))
        for _ in range(5):
            cb.record(success=False, duration_sec=0.1)
        assert cb.get_state() == "open"
        assert cb.allow() is False

    def test_half_open_recovery(self):
        from app.utils.cb_metrics import CbConfig, CbMetrics

        cb = CbMetrics(
            "t3",
            config=CbConfig(
                window_size=5, min_calls=3, error_rate_threshold=0.5, open_duration_sec=0.05, half_open_max_calls=2
            ),
        )
        for _ in range(5):
            cb.record(success=False, duration_sec=0.1)
        assert cb.get_state() == "open"
        time.sleep(0.1)
        # open_duration 过后, 第一次 allow 应转入 half_open
        assert cb.allow() is True
        cb.record(success=True, duration_sec=0.01)
        cb.record(success=True, duration_sec=0.01)
        assert cb.get_state() == "closed"

    def test_half_open_to_open(self):
        from app.utils.cb_metrics import CbConfig, CbMetrics

        cb = CbMetrics(
            "t4",
            config=CbConfig(
                window_size=5, min_calls=3, error_rate_threshold=0.5, open_duration_sec=0.05, half_open_max_calls=3
            ),
        )
        for _ in range(5):
            cb.record(success=False, duration_sec=0.1)
        time.sleep(0.1)
        cb.allow()  # 转 half_open
        cb.record(success=False, duration_sec=0.1)
        assert cb.get_state() == "open"

    def test_force_open(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t5")
        cb.force_open()
        assert cb.get_state() == "open"
        assert cb.allow() is False

    def test_force_close(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t6")
        cb.force_open()
        cb.force_close()
        assert cb.get_state() == "closed"

    def test_history(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t7")
        cb.force_open("manual")
        cb.force_close("reset")
        h = cb.get_history()
        assert len(h) >= 2
        assert h[-1].to in {"closed"}

    def test_window_stats(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t8")
        cb.record(True, 0.01)
        cb.record(True, 0.02)
        cb.record(False, 0.5)
        s = cb.get_window_stats()
        assert s["count"] == 3
        assert abs(s["err_rate"] - 1 / 3) < 0.01

    def test_stats_shape(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t9")
        cb.record(True, 0.01)
        s = cb.stats()
        for k in ("name", "state", "total_calls", "total_success", "total_failed", "window"):
            assert k in s

    def test_set_threshold(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t10")
        cb.set_threshold(err_rate=0.8, slow_sec=3.0)
        assert cb._cfg.error_rate_threshold == 0.8
        assert cb._cfg.slow_threshold_sec == 3.0

    def test_reset(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t11")
        cb.force_open()
        cb.record(False, 0.1)
        cb.reset()
        assert cb.get_state() == "closed"
        assert cb.stats()["total_calls"] == 0

    def test_prometheus_output(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("t12")
        cb.record(True, 0.01)
        out = cb.prometheus_metrics()
        assert "cb_state" in out
        assert "cb_calls_total" in out

    def test_registry(self):
        from app.utils.cb_metrics import CbRegistry

        reg = CbRegistry()
        cb1 = reg.get_or_create("x")
        cb2 = reg.get_or_create("x")
        assert cb1 is cb2
        assert "x" in reg.list_all()
        assert reg.remove("x") is True

    def test_slow_counter(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("slow", config=None)
        # 默认 slow_threshold_sec = 2.0
        cb.record(True, 3.0)
        assert cb.stats()["total_slow"] == 1

    def test_open_duration(self):
        from app.utils.cb_metrics import CbMetrics

        cb = CbMetrics("od")
        cb.set_open_duration(0.05)
        assert cb._cfg.open_duration_sec == 0.05


# ---------------------------------------------------------------------------
# Bug-103: 租户配额动态生效
# ---------------------------------------------------------------------------


class TestBug103TenantQuota:
    def test_upsert_new(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        # qps=100 与默认值相同, 不会触发变化; concurrency/monthly/tier 不同, 3 个变化
        changes = quota_watcher.upsert("t1", qps=100, concurrency=10, monthly=10000, tier="pro")
        assert len(changes) == 3
        assert quota_watcher.get("t1").qps == 100

    def test_upsert_partial(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.upsert("t2", qps=200)  # 创建
        # 只更新 concurrency (传入非默认值 30)
        changes = quota_watcher.upsert("t2", concurrency=30)
        assert len(changes) == 1
        assert changes[0].field_name == "concurrency"
        assert quota_watcher.get("t2").qps == 200  # 不变
        assert quota_watcher.get("t2").concurrency == 30

    def test_version_increments(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.upsert("t3", qps=100)
        v1 = quota_watcher.get("t3").version
        quota_watcher.upsert("t3", qps=200)
        v2 = quota_watcher.get("t3").version
        assert v2 > v1

    def test_callback(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        received = []
        quota_watcher.upsert("t4", qps=100)
        quota_watcher.on_change("t4", lambda rec: received.append(rec))
        quota_watcher.upsert("t4", qps=200)
        assert len(received) == 1
        assert received[0].new_value == 200

    def test_audit(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        # 第一次创建 qps=100 (= 默认值, 不算变化)
        quota_watcher.upsert("t5", qps=100)
        quota_watcher.upsert("t5", qps=20)
        quota_watcher.upsert("t5", concurrency=5)
        audit = quota_watcher.get_audit("t5")
        assert len(audit) == 2
        assert audit[0].field_name == "qps"
        assert audit[1].field_name == "concurrency"

    def test_remove(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.upsert("t6", qps=10)
        assert quota_watcher.remove("t6") is True
        assert quota_watcher.get("t6") is None

    def test_list_all(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.upsert("a", qps=10)
        quota_watcher.upsert("b", qps=20)
        assert len(quota_watcher.list_all()) == 2

    def test_sync_from(self):
        from app.utils.tenant_quota_watcher import TenantQuotaWatcher

        w1 = TenantQuotaWatcher()
        w2 = TenantQuotaWatcher()
        w1.upsert("x", qps=100)
        w1.upsert("y", qps=200)
        n = w2.sync_from(w1, source="sync", actor="cluster")
        assert n == 2
        assert w2.get("x").qps == 100

    def test_drift_report(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.report_drift("t7", "qps", 100, 80)
        assert quota_watcher.stats()["drift_warnings"] == 1

    def test_stats(self):
        from app.utils.tenant_quota_watcher import quota_watcher

        quota_watcher.clear()
        quota_watcher.upsert("a", qps=10)
        s = quota_watcher.stats()
        assert s["tenant_count"] == 1
        assert s["audit_count"] == 1


# ---------------------------------------------------------------------------
# Bug-104: 大文件分片上传
# ---------------------------------------------------------------------------


class TestBug104ChunkedUpload:
    def test_init_session(self):
        from app.utils.chunked_upload import chunked_upload

        chunked_upload._sessions.clear()
        chunked_upload._chunks_data.clear()
        s = chunked_upload.init_session("f1", "a.txt", 1000, 100)
        assert s.status.value == "uploading"
        assert s.total_chunks() == 10

    def test_upload_chunks(self):
        from app.utils.chunked_upload import chunked_upload

        chunked_upload._sessions.clear()
        chunked_upload._chunks_data.clear()
        chunked_upload.init_session("f2", "b.bin", 100, 50)
        r1 = chunked_upload.upload_chunk("f2", 0, b"a" * 50)
        r2 = chunked_upload.upload_chunk("f2", 1, b"b" * 50)
        assert r1["ok"] and r2["ok"]
        assert r1["received"] == 1
        assert r2["received"] == 2

    def test_md5_mismatch(self):
        from app.utils.chunked_upload import chunked_upload

        chunked_upload._sessions.clear()
        chunked_upload._chunks_data.clear()
        chunked_upload.init_session("f3", "c.bin", 50, 50)
        r = chunked_upload.upload_chunk("f3", 0, b"hello", expected_md5="wrong")
        assert r["ok"] is False
        assert r["error"] == "md5_mismatch"

    def test_resume_info(self):
        from app.utils.chunked_upload import chunked_upload

        chunked_upload._sessions.clear()
        chunked_upload._chunks_data.clear()
        chunked_upload.init_session("f4", "d.bin", 200, 100)
        chunked_upload.upload_chunk("f4", 0, b"x" * 100)
        info = chunked_upload.get_resume_info("f4")
        assert info["exists"] is True
        assert info["received"] == [0]
        assert info["missing"] == [1]

    def test_merge(self, tmp_path):
        from app.utils.chunked_upload import ChunkedUploadManager

        mgr = ChunkedUploadManager(storage_dir=str(tmp_path))
        mgr.init_session("f5", "e.bin", 10, 5)
        mgr.upload_chunk("f5", 0, b"abcde")
        mgr.upload_chunk("f5", 1, b"fghij")
        r = mgr.merge("f5")
        assert r["ok"] is True
        assert os.path.exists(r["path"])
        with open(r["path"], "rb") as f:
            data = f.read()
        assert data == b"abcdefghij"
        assert r["sha256"] == hashlib.sha256(b"abcdefghij").hexdigest()

    def test_merge_missing_chunk(self, tmp_path):
        from app.utils.chunked_upload import ChunkedUploadManager

        mgr = ChunkedUploadManager(storage_dir=str(tmp_path))
        mgr.init_session("f6", "f.bin", 100, 50)
        mgr.upload_chunk("f6", 0, b"x" * 50)
        # 缺第 1 个分片
        r = mgr.merge("f6")
        assert r["ok"] is False
        assert r["error"] == "missing_chunks"

    def test_merge_sha256_match(self, tmp_path):
        from app.utils.chunked_upload import ChunkedUploadManager

        mgr = ChunkedUploadManager(storage_dir=str(tmp_path))
        data = b"hello world"
        sha = hashlib.sha256(data).hexdigest()
        mgr.init_session("f7", "g.bin", len(data), 5, expected_sha256=sha)
        mgr.upload_chunk("f7", 0, b"hello")
        mgr.upload_chunk("f7", 1, b" worl")
        mgr.upload_chunk("f7", 2, b"d")
        r = mgr.merge("f7")
        assert r["ok"] is True
        assert r["sha256"] == sha

    def test_merge_sha256_mismatch(self, tmp_path):
        from app.utils.chunked_upload import ChunkedUploadManager

        mgr = ChunkedUploadManager(storage_dir=str(tmp_path))
        mgr.init_session("f8", "h.bin", 5, 5, expected_sha256="0" * 64)
        mgr.upload_chunk("f8", 0, b"hello")
        r = mgr.merge("f8")
        assert r["ok"] is False
        assert r["error"] == "final_sha256_mismatch"

    def test_cleanup(self, tmp_path):
        from app.utils.chunked_upload import ChunkedUploadManager

        mgr = ChunkedUploadManager(storage_dir=str(tmp_path))
        mgr.init_session("f9", "i.bin", 10, 5)
        mgr.upload_chunk("f9", 0, b"abcde")
        mgr.upload_chunk("f9", 1, b"fghij")
        mgr.merge("f9")
        assert mgr.cleanup("f9") is True
        assert mgr.get_session("f9") is None

    def test_session_not_found(self):
        from app.utils.chunked_upload import chunked_upload

        r = chunked_upload.upload_chunk("nonexistent", 0, b"x")
        assert r["ok"] is False
        assert r["error"] == "session_not_found"

    def test_stats(self):
        from app.utils.chunked_upload import chunked_upload

        chunked_upload._sessions.clear()
        chunked_upload._chunks_data.clear()
        chunked_upload.init_session("a", "a", 10, 5)
        chunked_upload.init_session("b", "b", 10, 5)
        s = chunked_upload.stats()
        assert s["session_count"] == 2


# ---------------------------------------------------------------------------
# Bug-105: WS 鉴权
# ---------------------------------------------------------------------------


class TestBug105WsToken:
    def test_issue_and_handshake(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        r = ws_token_mgr.handshake("c1", "alice", "t1", token)
        assert r.value == "ok"
        assert ws_token_mgr.get_session("c1") is not None

    def test_handshake_expired(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("bob", ttl=0.1)
        time.sleep(0.2)
        r = ws_token_mgr.handshake("c2", "bob", "t1", token)
        assert r.value == "token_expired"

    def test_handshake_invalid_sig(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        bad = "alice.9999999999.deadbeef"
        r = ws_token_mgr.handshake("c3", "alice", "t1", bad)
        assert r.value == "token_invalid"

    def test_handshake_user_mismatch(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        r = ws_token_mgr.handshake("c4", "bob", "t1", token)
        assert r.value == "token_invalid"

    def test_renew(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token1 = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c5", "alice", "t1", token1)
        token2 = ws_token_mgr.issue_token("alice", ttl=120.0)
        r = ws_token_mgr.renew("c5", token2)
        assert r.value == "ok"
        assert ws_token_mgr.get_session("c5").renew_count == 1

    def test_renew_unknown(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        r = ws_token_mgr.renew("c_no", token)
        assert r.value == "unknown_conn"

    def test_renew_rate_limit(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token1 = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c6", "alice", "t1", token1)
        token2 = ws_token_mgr.issue_token("alice", ttl=120.0)
        r1 = ws_token_mgr.renew("c6", token2)
        r2 = ws_token_mgr.renew("c6", token2)
        assert r1.value == "ok"
        assert r2.value == "rate_limit"

    def test_tenant_mismatch(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c7", "alice", "t1", token)
        r = ws_token_mgr.verify_tenant("c7", "t2")
        assert r.value == "tenant_mismatch"

    def test_revoke(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c8", "alice", "t1", token)
        assert ws_token_mgr.revoke("c8") is True
        assert ws_token_mgr.get_session("c8").revoked is True
        # 重新 handshake 同 token 应被拒
        r = ws_token_mgr.handshake("c8b", "alice", "t1", token)
        assert r.value == "revoked"

    def test_message_rate(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c9", "alice", "t1", token)
        # 短时间内连续消息
        results = [ws_token_mgr.on_message("c9") for _ in range(ws_token_mgr._msg_limit + 5)]
        ok_count = sum(1 for r in results if r.value == "ok")
        assert ok_count >= 1
        # 应至少有 1 次 rate_limit
        assert any(r.value == "rate_limit" for r in results)

    def test_disconnect(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c10", "alice", "t1", token)
        assert ws_token_mgr.disconnect("c10") is True
        assert ws_token_mgr.get_session("c10") is None

    def test_audit(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c11", "alice", "t1", token)
        ws_token_mgr.disconnect("c11")
        audit = ws_token_mgr.get_audit("c11")
        actions = [a.action for a in audit]
        assert "handshake" in actions
        assert "disconnect" in actions

    def test_stats(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        token = ws_token_mgr.issue_token("alice", ttl=60.0)
        ws_token_mgr.handshake("c12", "alice", "t1", token)
        s = ws_token_mgr.stats()
        assert s["active_sessions"] == 1

    def test_gc_expired(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        # 手工创建一个已过期的 session, 跳过 issue_token 的 int 截断问题
        from app.utils.ws_token_refresh import WsSession

        sess = WsSession(
            conn_id="c13",
            user_id="alice",
            tenant_id="t1",
            token_hash="abc",
            issued_at=time.time() - 100,
            expires_at=time.time() - 50,  # 已过期 50 秒
            last_active_at=time.time() - 50,
        )
        with ws_token_mgr._lock:
            ws_token_mgr._sessions["c13"] = sess
        n = ws_token_mgr.gc_expired()
        assert n >= 1, f"expected gc>=1, got {n}"

    def test_set_msg_limit(self):
        from app.utils.ws_token_refresh import ws_token_mgr

        ws_token_mgr.clear()
        ws_token_mgr.set_msg_limit(50)
        assert ws_token_mgr._msg_limit == 50


# ---------------------------------------------------------------------------
# Bug-106: 灰度规则快照
# ---------------------------------------------------------------------------


class TestBug106CanaryRule:
    def test_upsert_and_get(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("r1", "tag=blue", ratio=0.1, allowlist=["alice"], blocklist=["bob"])
        r = canary_store.get("r1")
        assert r is not None
        assert r.ratio == 0.1
        assert "alice" in r.allowlist
        assert "bob" in r.blocklist

    def test_version(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("v1", "k=v")
        v1 = canary_store.get("v1").version
        canary_store.upsert("v1", "k=v", ratio=0.5)
        v2 = canary_store.get("v1").version
        assert v2 > v1

    def test_remove(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("rm", "k=v")
        assert canary_store.remove("rm") is True
        assert canary_store.get("rm") is None

    def test_list_all(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("a", "k=v")
        canary_store.upsert("b", "k=v")
        assert {r.name for r in canary_store.list_all()} == {"a", "b"}

    def test_match(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("m1", "tag=blue", phase="canary")
        r = canary_store.match("tag", "blue")
        assert r is not None and r.name == "m1"
        r2 = canary_store.match("tag", "red")
        assert r2 is None

    def test_match_allowlist(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("m2", "tag=blue", allowlist=["vip"])
        r = canary_store.match("tag", "vip")
        assert r is not None

    def test_match_blocklist(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("m3", "tag=blue", blocklist=["bad"])
        # blocklist 优先
        r = canary_store.match("tag", "bad")
        assert r is None

    def test_off_phase_skip(self):
        from app.utils.canary_rule_snapshot import CanaryPhase, canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("m4", "tag=x", phase=CanaryPhase.OFF.value)
        r = canary_store.match("tag", "x")
        assert r is None

    def test_set_ratio(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("sr", "k=v", ratio=0.0)
        assert canary_store.set_ratio("sr", 0.5) is True
        assert canary_store.get("sr").ratio == 0.5
        # 越界截断
        canary_store.set_ratio("sr", 1.5)
        assert canary_store.get("sr").ratio == 1.0
        canary_store.set_ratio("sr", -0.5)
        assert canary_store.get("sr").ratio == 0.0

    def test_set_phase(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("sp", "k=v")
        assert canary_store.set_phase("sp", "full") is True
        assert canary_store.get("sp").phase == "full"

    def test_snapshot_persist_load(self, tmp_path):
        from app.utils.canary_rule_snapshot import CanaryRuleStore

        sd = str(tmp_path / "snap")
        os.makedirs(sd, exist_ok=True)
        st1 = CanaryRuleStore(snapshot_dir=sd)
        st1.upsert("p1", "k=v", ratio=0.3)
        st1.upsert("p2", "k=w", ratio=0.5)
        rec = st1.snapshot(archive=False)
        assert rec is not None
        # 重新加载
        st2 = CanaryRuleStore(snapshot_dir=sd)
        assert st2.get("p1") is not None
        assert st2.get("p2") is not None
        assert st2.get("p1").ratio == 0.3

    def test_snapshot_verify(self, tmp_path):
        from app.utils.canary_rule_snapshot import CanaryRuleStore

        sd = str(tmp_path / "snap2")
        os.makedirs(sd, exist_ok=True)
        st = CanaryRuleStore(snapshot_dir=sd)
        st.upsert("v1", "k=v")
        st.snapshot(archive=False)
        v = st.verify()
        assert v["ok"] is True

    def test_snapshot_corrupt(self, tmp_path):
        import json

        from app.utils.canary_rule_snapshot import CanaryRuleStore

        sd = str(tmp_path / "snap3")
        os.makedirs(sd, exist_ok=True)
        st = CanaryRuleStore(snapshot_dir=sd)
        st.upsert("v1", "k=v")
        st.snapshot(archive=False)
        # 篡改快照
        p = os.path.join(sd, "canary_rules_latest.json")
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        data["rules"][0]["match_expr"] = "evil"
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f)
        v = st.verify()
        assert v["ok"] is False

    def test_history(self, tmp_path):
        from app.utils.canary_rule_snapshot import CanaryRuleStore

        sd = str(tmp_path / "snap4")
        os.makedirs(sd, exist_ok=True)
        st = CanaryRuleStore(snapshot_dir=sd)
        st.upsert("h1", "k=v")
        st.snapshot(archive=True)
        st.upsert("h2", "k=v")
        st.snapshot(archive=True)
        h = st.get_history()
        assert len(h) >= 2

    def test_stats(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.clear()
        canary_store._snapshot_dir = ""
        canary_store.upsert("s1", "k=v", phase="canary")
        canary_store.upsert("s2", "k=v", phase="full")
        s = canary_store.stats()
        assert s["rule_count"] == 2
        assert s["by_phase"]["canary"] == 1
        assert s["by_phase"]["full"] == 1

    def test_clear(self):
        from app.utils.canary_rule_snapshot import canary_store

        canary_store.upsert("cl", "k=v")
        canary_store.clear()
        assert canary_store.stats()["rule_count"] == 0
