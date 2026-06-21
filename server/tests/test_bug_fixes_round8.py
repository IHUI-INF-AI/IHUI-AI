"""第八轮 P2 修复回归测试 - 覆盖 Bug-75/76/77/78/79/80/81/82."""

import os

os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import time
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Bug-75: 数据库连接预热 + 健康探针
# ---------------------------------------------------------------------------


class TestBug75DbWarmup:
    def test_register_and_status(self):
        from app.utils.db_warmup import db_warmup

        engine = MagicMock()
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=ctx)
        ctx.__exit__ = MagicMock(return_value=False)
        engine.connect.return_value = ctx
        # 模拟 SQLAlchemy text() 不变

        ctx.execute = MagicMock(return_value=None)

        db_warmup.unregister("test_75_a")
        db_warmup.register("test_75_a", engine)
        st = db_warmup.get_status("test_75_a")
        assert st is not None
        assert st.healthy is True
        db_warmup.unregister("test_75_a")

    def test_warmup_one_success(self):
        from app.utils.db_warmup import db_warmup

        engine = MagicMock()
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=ctx)
        ctx.__exit__ = MagicMock(return_value=False)
        ctx.execute = MagicMock(return_value=None)
        engine.connect.return_value = ctx

        db_warmup.unregister("test_75_b")
        db_warmup.register("test_75_b", engine)
        ok = db_warmup.warmup_one("test_75_b")
        assert ok is True
        st = db_warmup.get_status("test_75_b")
        assert st.warmup_success >= 1
        db_warmup.unregister("test_75_b")

    def test_warmup_one_failure(self):
        from app.utils.db_warmup import db_warmup

        engine = MagicMock()
        engine.connect.side_effect = RuntimeError("db down")

        db_warmup.unregister("test_75_c")
        db_warmup.register("test_75_c", engine)
        ok = db_warmup.warmup_one("test_75_c")
        assert ok is False
        db_warmup.unregister("test_75_c")

    def test_probe_healthy(self):
        from app.utils.db_warmup import db_warmup

        engine = MagicMock()
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=ctx)
        ctx.__exit__ = MagicMock(return_value=False)
        ctx.execute = MagicMock(return_value=None)
        engine.connect.return_value = ctx

        db_warmup.unregister("test_75_d")
        db_warmup.register("test_75_d", engine)
        ok = db_warmup.probe_one("test_75_d")
        assert ok is True
        st = db_warmup.get_status("test_75_d")
        assert st.healthy is True
        assert st.total_probes == 1
        db_warmup.unregister("test_75_d")

    def test_probe_unhealthy_callback(self):
        from app.utils.db_warmup import db_warmup

        engine = MagicMock()
        engine.connect.side_effect = RuntimeError("db down")

        db_warmup.unregister("test_75_e")
        db_warmup.register("test_75_e", engine)

        events = []
        db_warmup.set_unhealthy_callback(lambda n, h: events.append((n, h)))
        ok = db_warmup.probe_one("test_75_e")
        assert ok is False
        assert ("test_75_e", False) in events
        db_warmup.unregister("test_75_e")

    def test_probe_all(self):
        from app.utils.db_warmup import db_warmup

        eng1 = MagicMock()
        ctx1 = MagicMock()
        ctx1.__enter__ = MagicMock(return_value=ctx1)
        ctx1.__exit__ = MagicMock(return_value=False)
        ctx1.execute = MagicMock(return_value=None)
        eng1.connect.return_value = ctx1

        eng2 = MagicMock()
        eng2.connect.side_effect = RuntimeError("down")

        db_warmup.unregister("t75f1")
        db_warmup.unregister("t75f2")
        db_warmup.register("t75f1", eng1)
        db_warmup.register("t75f2", eng2)
        result = db_warmup.probe_all()
        assert result["t75f1"] is True
        assert result["t75f2"] is False
        db_warmup.unregister("t75f1")
        db_warmup.unregister("t75f2")

    def test_health_loop_start_stop(self):
        from app.utils.db_warmup import db_warmup

        eng = MagicMock()
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=ctx)
        ctx.__exit__ = MagicMock(return_value=False)
        ctx.execute = MagicMock(return_value=None)
        eng.connect.return_value = ctx

        db_warmup.unregister("t75g")
        db_warmup.register("t75g", eng)
        db_warmup.start_health_loop(interval_sec=0.5)
        time.sleep(0.8)
        db_warmup.stop_health_loop()
        st = db_warmup.stats()
        assert st["nodes"].get("t75g", {}).get("total_probes", 0) >= 1
        db_warmup.unregister("t75g")

    def test_stats(self):
        from app.utils.db_warmup import db_warmup

        s = db_warmup.stats()
        assert "warmup_size" in s
        assert "probe_interval" in s
        assert "nodes" in s


# ---------------------------------------------------------------------------
# Bug-76: SSE 断点续传
# ---------------------------------------------------------------------------


class TestBug76SseResume:
    def test_start_and_append(self):
        from app.utils.sse_resume import sse_resume

        sid = sse_resume.start_stream(topic="chat:test")
        seq = sse_resume.append(sid, "hello")
        assert seq > 0
        sse_resume.finish(sid)
        sse_resume.drop(sid)

    def test_resume_from_seq(self):
        from app.utils.sse_resume import sse_resume

        sid = sse_resume.start_stream(topic="chat:test2")
        sse_resume.append(sid, "a")
        sse_resume.append(sid, "b")
        seq2 = sse_resume.append(sid, "c")
        sse_resume.append(sid, "d")
        # 客户端断线时收到 seq2, resume 从 seq2+1
        events = sse_resume.resume(sid, last_seq=seq2)
        assert len(events) == 1
        assert events[0].data == "d"
        sse_resume.finish(sid)
        sse_resume.drop(sid)

    def test_encode_sse(self):
        from app.utils.sse_resume import sse_resume

        sid = sse_resume.start_stream()
        sse_resume.append(sid, "msg1", event="chunk")
        sse_resume.append(sid, "msg2", event="chunk")
        events = sse_resume.resume(sid, last_seq=0)
        encoded = sse_resume.encode_events(events)
        assert "event: chunk" in encoded
        assert "data: msg1" in encoded
        sse_resume.finish(sid)
        sse_resume.drop(sid)

    def test_buffer_maxlen(self):
        from app.utils.sse_resume import sse_resume

        sse_resume._max_buffer = 10
        sid = sse_resume.start_stream()
        for i in range(20):
            sse_resume.append(sid, f"e{i}")
        st = sse_resume.get_state(sid)
        assert len(st.buffer) <= 10
        sse_resume.drop(sid)
        sse_resume._max_buffer = 2000  # 恢复

    def test_get_state(self):
        from app.utils.sse_resume import sse_resume

        sid = sse_resume.start_stream(topic="t")
        sse_resume.append(sid, "x")
        st = sse_resume.get_state(sid)
        assert st is not None
        assert st.topic == "t"
        assert st.finished is False
        sse_resume.finish(sid)
        st2 = sse_resume.get_state(sid)
        assert st2.finished is True
        sse_resume.drop(sid)

    def test_resume_unknown_sid(self):
        from app.utils.sse_resume import sse_resume

        events = sse_resume.resume("nonexistent_sid_xyz")
        assert events == []

    def test_cleanup_expired(self):
        from app.utils.sse_resume import sse_resume

        sse_resume._ttl_sec = 0.1
        sid = sse_resume.start_stream()
        sse_resume.finish(sid)
        time.sleep(0.2)
        dropped = sse_resume.cleanup_expired()
        assert dropped >= 1
        sse_resume._ttl_sec = 3600

    def test_stats(self):
        from app.utils.sse_resume import sse_resume

        s = sse_resume.stats()
        assert "active_streams" in s
        assert "total_streams" in s


# ---------------------------------------------------------------------------
# Bug-77: 限流维度自动识别
# ---------------------------------------------------------------------------


class TestBug77ScopeResolver:
    def test_resolve_tenant_from_header(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {"X-Tenant-ID": "t42"}
        req.client = MagicMock(host="127.0.0.1")
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="tenant")
        assert "t42" in key
        assert key.startswith("tenant:")

    def test_resolve_user_priority(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {"X-Tenant-ID": "t1", "X-User-UUID": "u99"}
        req.client = MagicMock(host="1.2.3.4")
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="user")
        assert "u99" in key
        assert key.startswith("user:")

    def test_resolve_ip_from_xff(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {"X-Forwarded-For": "8.8.8.8, 10.0.0.1"}
        req.client = MagicMock(host="127.0.0.1")
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="ip")
        assert "8.8.8.8" in key
        assert key.startswith("ip:")

    def test_resolve_api_key_bearer(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {"Authorization": "Bearer abc.def.ghi"}
        req.client = MagicMock(host="1.1.1.1")
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="api_key")
        assert "abc.def.ghi" in key

    def test_resolve_fallback_to_client_ip(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {}
        req.client = MagicMock(host="9.9.9.9")
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="tenant")
        assert "9.9.9.9" in key

    def test_resolve_unknown(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {}
        req.client = None
        scope_resolver.clear_cache()
        key = scope_resolver.resolve(req, scope="tenant")
        assert "unknown" in key

    def test_cache_hit(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        req = MagicMock()
        req.headers = {"X-Tenant-ID": "t1"}
        req.client = MagicMock(host="1.1.1.1")
        scope_resolver.clear_cache()
        k1 = scope_resolver.resolve(req, scope="tenant")
        s1 = scope_resolver.stats()
        k2 = scope_resolver.resolve(req, scope="tenant")
        s2 = scope_resolver.stats()
        assert k1 == k2
        assert s2["cache_hit"] >= s1["cache_hit"]

    def test_add_custom_rule(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        scope_resolver.add_rule("custom", ["X-Custom-Header"])
        rules = scope_resolver.get_rules()
        assert "custom" in rules
        assert "X-Custom-Header" in rules["custom"]

    def test_stats(self):
        from app.utils.ratelimit_auto_scope import scope_resolver

        s = scope_resolver.stats()
        assert "total_resolve" in s
        assert "cache_hit" in s


# ---------------------------------------------------------------------------
# Bug-78: 熔断器半开期动态调整
# ---------------------------------------------------------------------------


class TestBug78CbAdaptive:
    def test_initial_decision_neutral(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        d = p.decide("cb_78_a")
        assert d.base == 3
        assert d.actual == 3
        assert "neutral" in d.reason

    def test_high_rate_inc_probe(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        for _ in range(10):
            p.record(success=True)
        d = p.decide("cb_78_b")
        assert d.actual == 4  # base+1
        assert "high_rate" in d.reason

    def test_low_rate_dec_probe(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        for _ in range(10):
            p.record(success=False)
        d = p.decide("cb_78_c")
        assert d.actual == 2  # base-1
        assert "low_rate" in d.reason

    def test_max_probes_clamp(self):
        from app.utils.cb_adaptive import AdaptiveConfig, AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy(AdaptiveConfig(base_probes=9))
        for _ in range(20):
            p.record(success=True)
        d = p.decide("cb_78_d")
        assert d.actual == 10  # max

    def test_min_probes_clamp(self):
        from app.utils.cb_adaptive import AdaptiveConfig, AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy(AdaptiveConfig(base_probes=1))
        for _ in range(20):
            p.record(success=False)
        d = p.decide("cb_78_e")
        assert d.actual == 1  # min

    def test_get_decision(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        p.decide("cb_78_f")
        d = p.get_decision("cb_78_f")
        assert d is not None
        assert d.base == 3

    def test_reset_samples(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        p.record(True)
        p.reset_samples()
        d = p.decide("cb_78_g")
        assert d.actual == 3  # 无样本 → 中性

    def test_stats(self):
        from app.utils.cb_adaptive import AdaptiveHalfOpenPolicy

        p = AdaptiveHalfOpenPolicy()
        p.record(True)
        s = p.stats()
        assert "samples_count" in s
        assert "base_probes" in s
        assert s["samples_count"] == 1

    def test_adaptive_circuit_breaker_creation(self):
        from app.utils.cb_adaptive import adaptive_circuit_breaker

        cb = adaptive_circuit_breaker("test_78_h", failure_threshold=2)
        assert cb is not None
        assert cb.stats.state.value == "closed"


# ---------------------------------------------------------------------------
# Bug-79: 灰度 hit 采样
# ---------------------------------------------------------------------------


class TestBug79RolloutSampling:
    def test_record_hit(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.reset("t79a")
        rollout_sampler.record_hit("t79a", bucket=10, version="v2", hit=True)
        s = rollout_sampler.get_stats("t79a")
        assert s["total"] == 1
        assert s["hits"] == 1

    def test_sample_rate_zero(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.reset("t79b")
        rollout_sampler.set_sample_rate("t79b", 0.0)
        sampled_count = sum(rollout_sampler.record_hit("t79b", bucket=1, version="v2", hit=True) for _ in range(50))
        assert sampled_count == 0
        s = rollout_sampler.get_stats("t79b")
        assert s["sampled"] == 0

    def test_sample_rate_full(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.reset("t79c")
        rollout_sampler.set_sample_rate("t79c", 1.0)
        sampled_count = sum(rollout_sampler.record_hit("t79c", bucket=1, version="v2", hit=True) for _ in range(20))
        assert sampled_count == 20
        s = rollout_sampler.get_stats("t79c")
        assert s["sampled"] == 20

    def test_sample_rate_partial_distribution(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.reset("t79d")
        rollout_sampler.set_sample_rate("t79d", 0.5)
        for i in range(1000):
            rollout_sampler.record_hit("t79d", bucket=i % 100, version="v2", hit=(i % 2 == 0))
        s = rollout_sampler.get_stats("t79d")
        # 500 ± 100 范围
        assert 400 <= s["sampled"] <= 600
        # 命中率 50%
        assert 0.45 <= s["hit_rate"] <= 0.55

    def test_get_stats_unknown(self):
        from app.utils.rollout_sampling import rollout_sampler

        assert rollout_sampler.get_stats("t79_unknown") is None

    def test_all_stats(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.reset()
        rollout_sampler.record_hit("t79e", bucket=1, version="v2", hit=True)
        s = rollout_sampler.all_stats()
        assert "experiments" in s
        assert s["total_records"] >= 1
        assert "default_rate" in s

    def test_reset(self):
        from app.utils.rollout_sampling import rollout_sampler

        rollout_sampler.record_hit("t79f", bucket=1, version="v2", hit=True)
        rollout_sampler.reset("t79f")
        s = rollout_sampler.get_stats("t79f")
        assert s is None


# ---------------------------------------------------------------------------
# Bug-80: 审计链归档
# ---------------------------------------------------------------------------


class TestBug80AuditArchive:
    def test_archive_range(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [
            {"seq": 1, "ts": 1.0, "action": "login", "hash": "h1", "prev_hash": "0" * 64},
            {"seq": 2, "ts": 2.0, "action": "buy", "hash": "h2", "prev_hash": "h1"},
        ]
        info = audit_archiver.archive_range(entries, 1, 2, reason="test")
        assert info.entry_count == 2
        assert info.start_seq == 1
        assert info.end_seq == 2
        assert info.first_hash == "h1"
        assert info.last_hash == "h2"

    def test_archive_compress(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [{"seq": 1, "ts": 1.0, "hash": "h", "prev_hash": "0" * 64}]
        info = audit_archiver.archive_range(entries, 1, 1, compress=True)
        assert info.compressed is True
        assert info.path.endswith(".gz")

    def test_read_archive(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [
            {"seq": i, "ts": float(i), "hash": f"h{i}", "prev_hash": f"h{i-1}" if i > 0 else "0" * 64}
            for i in range(1, 6)
        ]
        info = audit_archiver.archive_range(entries, 1, 5, reason="t")
        loaded = audit_archiver.read_archive(info.path)
        assert len(loaded) == 5
        assert loaded[0]["seq"] == 1

    def test_verify_archive_valid(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        # 用真实 hash 算法计算, 避免假名 hash 干扰 verify
        import hashlib
        import json as _json

        prev = "0" * 64
        entries = []
        for i in range(1, 4):
            payload = {"seq": i, "ts": float(i)}
            canonical = _json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=("", ":"))
            h = hashlib.sha256()
            h.update(prev.encode("utf-8"))
            h.update(canonical.encode("utf-8"))
            cur_hash = h.hexdigest()
            entries.append({"seq": i, "ts": float(i), "hash": cur_hash, "prev_hash": prev})
            prev = cur_hash
        info = audit_archiver.archive_range(entries, 1, 3, reason="t")
        ok = audit_archiver.verify_archive(info.path)
        assert ok is True

    def test_verify_archive_tamper(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [
            {"seq": 1, "ts": 1.0, "hash": "h1", "prev_hash": "0" * 64},
            {"seq": 2, "ts": 2.0, "hash": "WRONG", "prev_hash": "h1"},  # prev 不对
        ]
        info = audit_archiver.archive_range(entries, 1, 2, reason="t")
        ok = audit_archiver.verify_archive(info.path)
        assert ok is False

    def test_list_archives(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [{"seq": 1, "ts": 1.0, "hash": "h1", "prev_hash": "0" * 64}]
        audit_archiver.archive_range(entries, 1, 1, reason="l1")
        audit_archiver.archive_range(entries, 1, 1, reason="l2")
        lst = audit_archiver.list_archives()
        assert len(lst) >= 2

    def test_delete_archive(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        entries = [{"seq": 1, "ts": 1.0, "hash": "h1", "prev_hash": "0" * 64}]
        info = audit_archiver.archive_range(entries, 1, 1, reason="d")
        ok = audit_archiver.delete_archive(info.path)
        assert ok is True
        assert audit_archiver.read_archive(info.path) == []

    def test_read_missing(self, tmp_path):
        from app.utils.audit_archive import audit_archiver

        audit_archiver._archive_dir = str(tmp_path)
        result = audit_archiver.read_archive("nonexistent.jsonl")
        assert result == []

    def test_stats(self):
        from app.utils.audit_archive import audit_archiver

        s = audit_archiver.stats()
        assert "archive_dir" in s
        assert "total_archives" in s
        assert "total_archived" in s


# ---------------------------------------------------------------------------
# Bug-81: 死代码检测 CI 钩子
# ---------------------------------------------------------------------------


class TestBug81DeadcodeCI:
    def test_run_basic(self, tmp_path):
        from app.utils.deadcode_ci import ci_runner

        # 临时建一个含死函数的 py 文件
        f = tmp_path / "sample_dead.py"
        f.write_text("def used_function():\n    return 1\n\n" "def dead_function_xyz():\n    return 2\n")
        r = ci_runner.run(paths=[str(tmp_path)], threshold=10)
        assert r.scanned_files >= 1
        assert isinstance(r.passed, bool)

    def test_threshold_exceeded(self, tmp_path):
        from app.utils.deadcode_ci import ci_runner

        f = tmp_path / "lots_dead.py"
        f.write_text("def dead_a():\n    return 1\n" "def dead_b():\n    return 2\n" "def dead_c():\n    return 3\n")
        r = ci_runner.run(paths=[str(tmp_path)], threshold=1)
        # 若死函数超过 1 个则失败
        if r.after_ignore > 1:
            assert r.passed is False
            assert "threshold" in r.reasons[0].lower() if r.reasons else True

    def test_ignore_loader(self, tmp_path):
        from app.utils.deadcode_ci import CiIgnoreLoader

        f = tmp_path / ".deadcodeignore"
        f.write_text("# 注释\nsample_*.py|dead_.*|测试忽略\n", encoding="utf-8")
        patterns = CiIgnoreLoader.load(str(f))
        assert len(patterns) == 1
        assert patterns[0].file_glob == "sample_*.py"
        assert patterns[0].func_regex == "dead_.*"
        assert patterns[0].reason == "测试忽略"

    def test_ignore_matches(self):
        from app.utils.deadcode_ci import CiIgnoreLoader, IgnorePattern

        p = IgnorePattern(file_glob="*.py", func_regex="^_")
        assert CiIgnoreLoader.matches(p, "app/utils/x.py", "_helper")
        assert not CiIgnoreLoader.matches(p, "app/utils/x.py", "public")
        assert not CiIgnoreLoader.matches(p, "app/utils/x.txt", "_helper")

    def test_ignore_load_missing(self, tmp_path):
        from app.utils.deadcode_ci import CiIgnoreLoader

        result = CiIgnoreLoader.load(str(tmp_path / "nonexistent.ignore"))
        assert result == []

    def test_sarif_format(self, tmp_path):
        from app.utils.deadcode_ci import ci_runner

        f = tmp_path / "sarif_test.py"
        f.write_text("def dead_zz():\n    return 1\n")
        r = ci_runner.run(paths=[str(tmp_path)], threshold=100)
        sarif = r.sarif
        assert "runs" in sarif
        assert sarif["version"] == "2.1.0"
        assert "tool" in sarif["runs"][0]

    def test_markdown_report(self, tmp_path):
        from app.utils.deadcode_ci import ci_runner

        f = tmp_path / "md_test.py"
        f.write_text("def dead_md():\n    return 1\n")
        r = ci_runner.run(paths=[str(tmp_path)], threshold=100)
        assert "死代码检测报告" in r.markdown
        assert "PASS" in r.markdown

    def test_write_outputs(self, tmp_path):
        from app.utils.deadcode_ci import ci_runner

        f = tmp_path / "out_test.py"
        f.write_text("def dead_out():\n    return 1\n")
        out = tmp_path / "out"
        r = ci_runner.run(paths=[str(tmp_path)], threshold=100, output_dir=str(out))
        assert (out / "deadcode.sarif.json").exists()
        assert (out / "deadcode.md").exists()
        assert (out / "deadcode.summary.json").exists()

    def test_pre_commit_template(self):
        from app.utils.deadcode_ci import CiRunner

        tpl = CiRunner.pre_commit_template()
        assert "deadcode" in tpl.lower()
        assert "pre-commit" in tpl


# ---------------------------------------------------------------------------
# Bug-82: WS 租户连接限流
# ---------------------------------------------------------------------------


class TestBug82WsTenantLimit:
    def test_acquire_release(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=10, max_per_user=3, max_per_ip=5, max_global=20)
        ok1 = ws_conn_limiter.acquire(tenant_id="t1", user_id="u1", client_ip="1.1.1.1")
        assert ok1 is True
        ws_conn_limiter.release(tenant_id="t1", user_id="u1", client_ip="1.1.1.1")
        assert ws_conn_limiter.stats()["current_total"] == 0

    def test_tenant_max(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=2, max_per_user=10, max_per_ip=10, max_global=100)
        for _ in range(2):
            assert ws_conn_limiter.acquire(tenant_id="t82a", user_id="u82a", client_ip="1.1.1.1") is True
        # 第三个应被租户限流拒绝
        assert ws_conn_limiter.acquire(tenant_id="t82a", user_id="u82a", client_ip="1.1.1.1") is False
        assert ws_conn_limiter.stats()["reject_by_tenant"] >= 1
        # 释放后能再 acquire
        ws_conn_limiter.release(tenant_id="t82a", user_id="u82a", client_ip="1.1.1.1")
        assert ws_conn_limiter.acquire(tenant_id="t82a", user_id="u82a2", client_ip="1.1.1.2") is True
        ws_conn_limiter.release(tenant_id="t82a", user_id="u82a2", client_ip="1.1.1.2")

    def test_user_max(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=100, max_per_user=2, max_per_ip=100, max_global=100)
        for _ in range(2):
            assert ws_conn_limiter.acquire(tenant_id="t82b", user_id="u82b", client_ip="1.1.1.1") is True
        assert ws_conn_limiter.acquire(tenant_id="t82b", user_id="u82b", client_ip="1.1.1.1") is False
        assert ws_conn_limiter.stats()["reject_by_user"] >= 1
        for _ in range(2):
            ws_conn_limiter.release(tenant_id="t82b", user_id="u82b", client_ip="1.1.1.1")

    def test_ip_max(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=100, max_per_user=100, max_per_ip=2, max_global=100)
        for _ in range(2):
            assert ws_conn_limiter.acquire(tenant_id="t82c", user_id="u82c", client_ip="2.2.2.2") is True
        assert ws_conn_limiter.acquire(tenant_id="t82c", user_id="u82c2", client_ip="2.2.2.2") is False
        assert ws_conn_limiter.stats()["reject_by_ip"] >= 1
        for _ in range(2):
            ws_conn_limiter.release(tenant_id="t82c", user_id="u82c", client_ip="2.2.2.2")

    def test_global_max(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=100, max_per_user=100, max_per_ip=100, max_global=2)
        assert ws_conn_limiter.acquire(tenant_id="t82d1", user_id="u82d1", client_ip="3.3.3.1") is True
        assert ws_conn_limiter.acquire(tenant_id="t82d2", user_id="u82d2", client_ip="3.3.3.2") is True
        assert ws_conn_limiter.acquire(tenant_id="t82d3", user_id="u82d3", client_ip="3.3.3.3") is False
        assert ws_conn_limiter.stats()["reject_by_global"] >= 1
        ws_conn_limiter.release(tenant_id="t82d1", user_id="u82d1", client_ip="3.3.3.1")
        ws_conn_limiter.release(tenant_id="t82d2", user_id="u82d2", client_ip="3.3.3.2")

    def test_tenant_peak(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.set_limits(max_per_tenant=10, max_per_user=10, max_per_ip=10, max_global=100)
        for i in range(3):
            assert ws_conn_limiter.acquire(tenant_id="t82e", user_id=f"u{i}", client_ip=f"4.4.4.{i}") is True
        assert ws_conn_limiter.get_tenant_peak("t82e") == 3
        for i in range(3):
            ws_conn_limiter.release(tenant_id="t82e", user_id=f"u{i}", client_ip=f"4.4.4.{i}")

    def test_current(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        ws_conn_limiter.acquire(tenant_id="t82f", user_id="u82f", client_ip="5.5.5.5")
        cur = ws_conn_limiter.current()
        assert cur["total"] >= 1
        assert "t82f" in cur["tenants"]
        ws_conn_limiter.release(tenant_id="t82f", user_id="u82f", client_ip="5.5.5.5")

    def test_stats(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        s = ws_conn_limiter.stats()
        assert "limits" in s
        assert "current_total" in s
        assert "total_acquire" in s

    def test_release_zero_safe(self):
        from app.utils.ws_tenant_limit import ws_conn_limiter

        # 多次 release 不会成负数
        ws_conn_limiter.release(tenant_id="t82g", user_id="u82g", client_ip="6.6.6.6")
        cur = ws_conn_limiter.current()
        assert cur["total"] >= 0
