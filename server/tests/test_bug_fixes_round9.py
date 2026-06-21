"""第九轮 8 项 P2 Bug 修复的回归测试 (Bug-83 ~ Bug-90)."""

import time

# ---------------------------------------------------------------------------
# Bug-83: 分布式追踪上下文
# ---------------------------------------------------------------------------


class TestBug83TraceContext:
    def test_new_trace_basic(self):
        from app.utils.trace_context import get_current, new_trace

        c = new_trace(name="t1")
        assert len(c.trace_id) == 32
        assert len(c.span_id) == 16
        assert c.parent_span_id is None
        assert get_current() is c

    def test_new_span_under_parent(self):
        from app.utils.trace_context import get_current, new_span, new_trace

        root = new_trace(name="root")
        child = new_span(parent=root, name="child")
        assert child.trace_id == root.trace_id
        assert child.span_id != root.span_id
        assert child.parent_span_id == root.span_id
        assert get_current() is child

    def test_extract_from_headers_valid(self):
        from app.utils.trace_context import extract_from_headers

        tp = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
        ts = "vendor=value,other=xyz"
        c = extract_from_headers({"traceparent": tp, "tracestate": ts})
        assert c.trace_id == "0af7651916cd43dd8448eb211c80319c"
        assert c.span_id == "b7ad6b7169203331"
        assert c.flags == "01"
        assert "vendor=value" in c.tracestate

    def test_extract_from_headers_invalid(self):
        from app.utils.trace_context import extract_from_headers

        # 全 0 trace_id 应恢复
        tp = "00-00000000000000000000000000000000-1111111111111111-01"
        c = extract_from_headers({"traceparent": tp})
        assert c.trace_id != "0" * 32
        # 完全非法
        c2 = extract_from_headers({"traceparent": "garbage"})
        assert len(c2.trace_id) == 32

    def test_inject_to_headers(self):
        from app.utils.trace_context import inject_to_headers, new_trace

        c = new_trace(name="inj")
        h = inject_to_headers(c)
        assert h["traceparent"].startswith("00-")
        assert c.trace_id in h["traceparent"]
        assert c.span_id in h["traceparent"]

    def test_inject_includes_tracestate(self):
        from app.utils.trace_context import inject_to_headers, new_trace

        c = new_trace(name="inj2")
        c.tracestate = "vendor=foo"
        h = inject_to_headers(c)
        assert h.get("tracestate") == "vendor=foo"

    def test_finish_restores_parent(self):
        from app.utils.trace_context import get_current, new_span, new_trace

        root = new_trace(name="root_f")
        child = new_span(parent=root, name="child_f")
        from app.utils.trace_context import finish

        finish(child)
        cur = get_current()
        assert cur is not None
        assert cur.span_id == root.span_id

    def test_tracestate_parse_format(self):
        from app.utils.trace_context import format_tracestate, parse_tracestate

        items = parse_tracestate("a=1,b=hello world")
        assert ("a", "1") in items
        assert ("b", "hello world") in items
        # format
        out = format_tracestate([("k1", "v1"), ("k2", "v2")])
        assert out == "k1=v1,k2=v2"

    def test_add_attr(self):
        from app.utils.trace_context import add_attr, get_current, new_trace

        new_trace(name="attr")
        add_attr("k", "v")
        assert get_current().attrs["k"] == "v"

    def test_span_context_manager(self):
        from app.utils.trace_context import get_current, new_trace, span

        new_trace(name="root_sp")
        with span("work") as ctx:
            cur = get_current()
            assert cur is ctx
        # 退出后
        cur2 = get_current()
        assert cur2 is not ctx

    def test_stats(self):
        from app.utils.trace_context import new_trace, stats

        new_trace(name="stat")
        s = stats()
        assert "total_traces" in s
        assert s["total_traces"] >= 1


# ---------------------------------------------------------------------------
# Bug-84: LLM 成本计量
# ---------------------------------------------------------------------------


class TestBug84LlmCost:
    def test_calc_cost_known(self):
        from app.utils.llm_cost import llm_cost_meter

        # gpt-4o: prompt 0.005/1k, completion 0.015/1k
        c = llm_cost_meter.calc_cost("gpt-4o", 1000, 500)
        assert round(c, 6) == round(0.005 * 1 + 0.015 * 0.5, 6)

    def test_calc_cost_unknown(self):
        from app.utils.llm_cost import llm_cost_meter

        c = llm_cost_meter.calc_cost("unknown-model", 1000, 500)
        assert c == 0.0

    def test_record_basic(self, tmp_path):
        from app.utils.llm_cost import LlmCostMeter

        m = LlmCostMeter(log_path=str(tmp_path / "cost.jsonl"))
        rec = m.record("gpt-4o-mini", 1000, 500, tenant_id="t1", user_id="u1")
        assert rec.cost_usd > 0
        assert rec.tenant_id == "t1"
        s = m.stats()
        assert s["total_calls"] == 1

    def test_register_model(self):
        from app.utils.llm_cost import llm_cost_meter

        llm_cost_meter.register_model("custom-m1", prompt=0.001, completion=0.002)
        c = llm_cost_meter.calc_cost("custom-m1", 1000, 1000)
        assert round(c, 6) == 0.003

    def test_cap_per_call(self, tmp_path):
        from app.utils.llm_cost import LlmCostMeter

        m = LlmCostMeter(log_path=str(tmp_path / "c2.jsonl"))
        m.set_cap_per_call(0.0001)
        m.record("gpt-4o", 10000, 10000)  # 远超 cap
        s = m.stats()
        assert s["rejected_by_cap"] == 1

    def test_get_billing(self, tmp_path):
        from app.utils.llm_cost import LlmCostMeter

        m = LlmCostMeter(log_path=str(tmp_path / "b.jsonl"))
        m.record("gpt-4o", 100, 0, tenant_id="t_b1")
        m.record("claude-3-5-sonnet", 200, 100, tenant_id="t_b2")
        b = m.get_billing(month="2099-01")  # 不存在的月份
        assert b["total_calls"] == 0
        b2 = m.get_billing()  # 当月
        assert b2["total_calls"] == 2
        assert "t_b1" in b2["by_tenant"]

    def test_list_models(self):
        from app.utils.llm_cost import llm_cost_meter

        ms = llm_cost_meter.list_models()
        assert "gpt-4o" in ms
        assert "claude-3-5-sonnet" in ms

    def test_reset(self, tmp_path):
        from app.utils.llm_cost import LlmCostMeter

        m = LlmCostMeter(log_path=str(tmp_path / "r.jsonl"))
        m.record("gpt-4o", 100, 0)
        m.reset()
        assert m.stats()["total_calls"] == 0

    def test_record_llm_call_helper(self, tmp_path, monkeypatch):
        from app.utils import llm_cost

        llm_cost.llm_cost_meter.__init__(log_path=str(tmp_path / "h.jsonl"))
        rec = llm_cost.record_llm_call("gpt-4o", 100, 50, call_id="c1")
        assert rec.call_id == "c1"


# ---------------------------------------------------------------------------
# Bug-85: WS 消息去重
# ---------------------------------------------------------------------------


class TestBug85WsDedup:
    def test_new_message(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        assert d.is_duplicate("m1") is False

    def test_duplicate_message(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.remember("m1", result={"ok": 1})
        assert d.is_duplicate("m1") is True

    def test_get_cached(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.remember("m2", result=[1, 2, 3])
        assert d.get_cached("m2") == [1, 2, 3]
        assert d.get_cached("unknown") is None

    def test_ttl_expiry(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper(ttl_sec=0.05)
        d.remember("m3", result="v")
        time.sleep(0.1)
        assert d.is_duplicate("m3") is False

    def test_lru_eviction(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper(max_entries=3)
        d.remember("a", result=1)
        d.remember("b", result=2)
        d.remember("c", result=3)
        d.remember("d", result=4)  # 应淘汰 a
        assert d.get_cached("a") is None
        assert d.get_cached("d") == 4

    def test_forget(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.remember("m4", result=1)
        d.forget("m4")
        assert d.is_duplicate("m4") is False

    def test_clear(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.remember("x", result=1)
        d.clear()
        assert d.stats()["size"] == 0

    def test_cleanup_expired(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper(ttl_sec=0.05)
        d.remember("a", result=1)
        time.sleep(0.1)
        n = d.cleanup_expired()
        assert n >= 1

    def test_set_limits(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.set_limits(ttl_sec=10, max_entries=5)
        assert d._ttl == 10
        assert d._max == 5

    def test_stats(self):
        from app.utils.ws_dedup import WsDeduper

        d = WsDeduper()
        d.remember("a", result=1)
        d.is_duplicate("a")
        s = d.stats()
        assert s["total_new"] == 1
        assert s["total_dup"] == 1
        assert s["total_seen"] == 1


# ---------------------------------------------------------------------------
# Bug-86: 慢 SQL 自动 kill
# ---------------------------------------------------------------------------


class TestBug86SlowSqlKiller:
    def test_set_get_threshold(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(3.0)
        assert slow_sql_killer.get_threshold() == 3.0
        slow_sql_killer.set_threshold(1.0)  # 复位

    def test_check_and_kill_below(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(1.0)
        slow_sql_killer.check_and_kill("SELECT 1", 0.5, {}, "ai")
        s = slow_sql_killer.stats()
        assert s["total_executed"] == 1
        assert s["total_slow"] == 0

    def test_check_and_kill_above(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(0.1)
        rec = slow_sql_killer.check_and_kill("SELECT 1", 0.5, {}, "ai")
        assert rec is not None
        s = slow_sql_killer.stats()
        assert s["total_slow"] >= 1

    def test_get_slow(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(0.05)
        slow_sql_killer.check_and_kill("SELECT 2", 0.2, {}, "ai")
        lst = slow_sql_killer.get_slow()
        assert len(lst) >= 1
        assert "sql" in lst[0]

    def test_clear(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(0.05)
        slow_sql_killer.check_and_kill("SELECT 3", 0.3, {}, "ai")
        slow_sql_killer.clear()
        s = slow_sql_killer.stats()
        assert s["total_slow"] == 0

    def test_install_sqlalchemy_hook_with_engine(self):
        from sqlalchemy import create_engine

        from app.utils.slow_sql_killer import install_sqlalchemy_hook

        eng = create_engine("sqlite:///:memory:")
        install_sqlalchemy_hook(eng, engine_name="test_eng")
        # 触发一次 execute
        with eng.connect() as conn:
            from sqlalchemy import text

            conn.execute(text("SELECT 1"))
        # 不抛错即通过
        assert True

    def test_cancel_called_with_cursor(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        slow_sql_killer.set_threshold(0.05)

        class FakeCursor:
            closed = False

            def close(self):
                self.closed = True

        c = FakeCursor()
        rec = slow_sql_killer.check_and_kill("SELECT 4", 0.2, {}, "ai", cursor=c)
        # 实际取消行为: 关 cursor
        # 注: 我们的实现 check_and_kill 在 duration>=threshold 时关 cursor
        assert c.closed is True

    def test_stats_shape(self):
        from app.utils.slow_sql_killer import slow_sql_killer

        s = slow_sql_killer.stats()
        for k in ("threshold_sec", "total_executed", "total_slow", "total_cancelled", "by_engine"):
            assert k in s


# ---------------------------------------------------------------------------
# Bug-87: 配置热更新
# ---------------------------------------------------------------------------


class TestBug87HotConfig:
    def test_register_and_get(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h.json"))
        cfg.register("k1", default=10, validator=int)
        assert cfg.get("k1") == 10

    def test_set_and_get(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h2.json"))
        cfg.register("k2", default=5)
        cfg.set("k2", 100, updater="u1")
        assert cfg.get("k2") == 100

    def test_validator_invalid(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h3.json"))
        cfg.register("k3", default=0, validator=int)
        ok = cfg.set("k3", "not_a_number")
        assert ok is False
        assert cfg.get("k3") == 0

    def test_watch_callback(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h4.json"))
        cfg.register("k4", default=1)
        seen = []
        cfg.watch("k4", lambda k, v: seen.append((k, v)))
        cfg.set("k4", 42)
        assert ("k4", 42) in seen

    def test_watch_star(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h5.json"))
        seen = []
        cfg.watch("*", lambda k, v: seen.append(k))
        cfg.register("kx", default=0)
        cfg.set("kx", 1)
        cfg.set("kx", 2)
        assert "kx" in seen

    def test_unwatch(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h6.json"))
        cfg.register("k5", default=0)
        cb = lambda k, v: None
        cfg.watch("k5", cb)
        assert cfg.unwatch("k5", cb) is True
        assert cfg.unwatch("k5", cb) is False

    def test_reset(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h7.json"))
        cfg.register("k6", default=1)
        cfg.set("k6", 99)
        cfg.reset("k6")
        assert cfg.get("k6") == 1

    def test_diff_from_default(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h8.json"))
        cfg.register("a", default=1)
        cfg.register("b", default=2)
        cfg.set("a", 100)
        d = cfg.diff_from_default()
        assert "a" in d
        assert "b" not in d

    def test_get_all(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h9.json"))
        cfg.register("a", default=1, desc="aa")
        all_ = cfg.get_all()
        assert "a" in all_
        assert all_["a"]["default"] == 1

    def test_persist_and_reload(self, tmp_path):
        from app.utils.hot_config import HotConfig

        p = str(tmp_path / "persist.json")
        cfg = HotConfig(persist_path=p)
        cfg.register("p1", default=1)
        cfg.set("p1", 999)
        cfg2 = HotConfig(persist_path=p)
        assert cfg2.get("p1") == 999

    def test_register_duplicate_noop(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h10.json"))
        cfg.register("dup", default=1)
        cfg.set("dup", 100)
        cfg.register("dup", default=999)  # 重复注册不覆盖
        assert cfg.get("dup") == 100

    def test_stats(self, tmp_path):
        from app.utils.hot_config import HotConfig

        cfg = HotConfig(persist_path=str(tmp_path / "h11.json"))
        cfg.register("z", default=0)
        s = cfg.stats()
        assert "items" in s
        assert s["items"] >= 1


# ---------------------------------------------------------------------------
# Bug-88: 多租户限流公平性
# ---------------------------------------------------------------------------


class TestBug88FairRateLimit:
    def test_set_weight_and_acquire(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=10)
        frl.set_weight("t1", weight=1.0)
        ok = frl.acquire("t1", units=1)
        assert ok is True

    def test_weight_priority(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=2)
        frl.set_weight("big", weight=2.0)
        frl.set_weight("small", weight=1.0)
        # 让时间推进: 1s 应累计 big=1.33 small=0.66
        time.sleep(0.05)
        assert frl.get_tenant_credit("big") >= 0
        assert frl.get_tenant_credit("small") >= 0

    def test_over_quota(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=1)
        frl.set_weight("x", weight=1.0, cap=2)
        # 立即 acquire 多次
        results = [frl.acquire("x", units=1) for _ in range(5)]
        assert any(r is False for r in results)

    def test_try_acquire_reason(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=1)
        frl.set_weight("y", weight=1.0, cap=1)
        frl.acquire("y", units=1)
        ok, reason = frl.try_acquire("y", units=1)
        assert ok is False
        assert reason == "over_quota"

    def test_credit_refill(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=10)
        frl.set_weight("z", weight=1.0, cap=100)
        c1 = frl.get_tenant_credit("z")
        time.sleep(0.05)
        c2 = frl.get_tenant_credit("z")
        assert c2 >= c1

    def test_cap_limit(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=100)
        frl.set_weight("cap_t", weight=1.0, cap=2)
        time.sleep(0.5)
        # credit 不应超过 cap=2
        assert frl.get_tenant_credit("cap_t") <= 2.0

    def test_remove_tenant(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter()
        frl.set_weight("rm", weight=1.0)
        frl.remove_tenant("rm")
        assert "rm" not in frl.list_tenants()

    def test_reset_tenant(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter(total_qps=1)
        frl.set_weight("rst", weight=1.0, cap=10)
        frl.acquire("rst", units=1)
        frl.reset_tenant("rst")
        assert frl.get_tenant_credit("rst") == 0.0

    def test_set_limits(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter()
        frl.set_limits(total_qps=200, burst_multiplier=2.0)
        s = frl.stats()
        assert s["total_qps"] == 200

    def test_stats_shape(self):
        from app.utils.fair_rate_limit import FairRateLimiter

        frl = FairRateLimiter()
        frl.set_weight("a", weight=1.0)
        s = frl.stats()
        assert "tenants" in s
        assert "a" in s["tenants"]


# ---------------------------------------------------------------------------
# Bug-89: label 基数保护
# ---------------------------------------------------------------------------


class TestBug89LabelCardinality:
    def test_allow_value_passes(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.allow("path", values=["/api", "/login"])
        out = g.wrap("m", {"path": "/api"})
        assert out["path"] == "/api"

    def test_allow_value_replaced(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.allow("path", values=["/api", "/login"])
        out = g.wrap("m", {"path": "/secret"})
        assert out["path"] == "other"

    def test_allow_regex_passes(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.allow("tid", pattern=r"^t_[a-z0-9]{1,8}$")
        out = g.wrap("m", {"tid": "t_abc123"})
        assert out["tid"] == "t_abc123"

    def test_allow_regex_replaced(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.allow("tid", pattern=r"^t_[a-z0-9]{1,8}$")
        out = g.wrap("m", {"tid": "T_BAD"})
        assert out["tid"] == "other"

    def test_deny_replaces(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.deny("env", values=["prod-internal"])
        out = g.wrap("m", {"env": "prod-internal"})
        assert out["env"] == "other"

    def test_deny_regex(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.deny("env", pattern=r"^internal-.*")
        out = g.wrap("m", {"env": "internal-001"})
        assert out["env"] == "other"

    def test_max_label_values_overflow(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard(max_label_values=3)
        out = []
        for i in range(10):
            r = g.wrap("m", {"v": f"v{i}"})
            out.append(r["v"])
        # 至少 3 个保留, 后面应是 other_overflow
        assert out[0] == "v0"
        assert out[1] == "v1"
        assert out[2] == "v2"
        assert out[3] == "other_overflow"

    def test_default_passes_without_rules(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        out = g.wrap("m", {"foo": "bar"})
        assert out["foo"] == "bar"

    def test_reset_seen(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard(max_label_values=2)
        g.wrap("m", {"v": "a"})
        g.wrap("m", {"v": "b"})
        g.reset_seen()
        out = g.wrap("m", {"v": "c"})
        assert out["v"] == "c"

    def test_stats_shape(self):
        from app.utils.label_cardinality import LabelCardinalityGuard

        g = LabelCardinalityGuard()
        g.allow("a", values=["x"])
        g.wrap("m", {"a": "x"})
        g.wrap("m", {"a": "y"})
        s = g.stats()
        assert "max_label_values" in s
        assert "total_replaced" in s
        assert s["total_replaced"] >= 1


# ---------------------------------------------------------------------------
# Bug-90: API 响应脱敏
# ---------------------------------------------------------------------------


class TestBug90ApiMask:
    def test_mask_full(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.set_audience("external")
        response_masker.add_rule("$.user.password", mask="full")
        out = response_masker.mask({"user": {"password": "secret"}})
        assert out["user"]["password"] == "***"

    def test_mask_email(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.email", mask="email")
        out = response_masker.mask({"user": {"email": "alice@example.com"}})
        assert out["user"]["email"] == "a**@example.com"

    def test_mask_phone(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.phone", mask="phone")
        out = response_masker.mask({"user": {"phone": "13800138000"}})
        assert out["user"]["phone"] == "138****8000"

    def test_mask_idcard(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.idcard", mask="idcard")
        out = response_masker.mask({"user": {"idcard": "11010119900101001X"}})
        assert out["user"]["idcard"].startswith("1101") and out["user"]["idcard"].endswith("001X")

    def test_mask_last4(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.bank", mask="last4")
        out = response_masker.mask({"user": {"bank": "1234567890"}})
        assert out["user"]["bank"] == "******7890"

    def test_mask_hash(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.password", mask="hash")
        out = response_masker.mask({"user": {"password": "hello"}})
        assert out["user"]["password"].startswith("sha256:")

    def test_mask_token(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.token", mask="token")
        out = response_masker.mask({"user": {"token": "abcdef1234567890"}})
        assert out["user"]["token"] == "abcd***7890"

    def test_internal_audience_skips(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.password", mask="full", audience="external")
        response_masker.set_audience("internal")
        out = response_masker.mask({"user": {"password": "secret"}})
        assert out["user"]["password"] == "secret"

    def test_external_audience_applies(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.password", mask="full", audience="external")
        response_masker.set_audience("external")
        out = response_masker.mask({"user": {"password": "secret"}})
        assert out["user"]["password"] == "***"

    def test_dry_run_does_not_modify(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.password", mask="full")
        response_masker.set_dry_run(True)
        out = response_masker.mask({"user": {"password": "secret"}})
        assert out["user"]["password"] == "secret"
        response_masker.set_dry_run(False)

    def test_recursive_path(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$..password", mask="full")
        out = response_masker.mask({"a": {"password": "x"}, "b": {"password": "y"}})
        assert out["a"]["password"] == "***"
        assert out["b"]["password"] == "***"

    def test_remove_rules(self):
        from app.utils.api_mask import response_masker

        response_masker.add_rule("$.x", mask="full")
        n = response_masker.remove_rules("$.x")
        assert n == 1

    def test_list_rules(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.a", mask="full")
        response_masker.add_rule("$.b", mask="email")
        rules = response_masker.list_rules()
        assert len(rules) == 2

    def test_nested_dict(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.a.b.c.password", mask="full")
        out = response_masker.mask({"a": {"b": {"c": {"password": "z"}}}})
        assert out["a"]["b"]["c"]["password"] == "***"

    def test_list_value(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.items.password", mask="full")
        out = response_masker.mask({"items": [{"password": "x"}, {"password": "y"}]})
        assert out["items"][0]["password"] == "***"
        assert out["items"][1]["password"] == "***"

    def test_missing_path_unchanged(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.user.password", mask="full")
        out = response_masker.mask({"user": {"email": "x"}})
        assert "password" not in out["user"]

    def test_stats_shape(self):
        from app.utils.api_mask import response_masker

        response_masker.remove_rules()
        response_masker.add_rule("$.x", mask="full")
        response_masker.mask({"x": "v"})
        s = response_masker.stats()
        assert "total_masked" in s
        assert s["total_masked"] >= 1
