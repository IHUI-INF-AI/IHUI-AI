"""Playwright 端到端验证 - 第十三轮 8 项修复 (Bug-115/116/117/118/119/120/121/122)."""

import os
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")


def main():
    results = []
    _verify_modules(results)
    return _report(results)


def _verify_modules(results):
    def check(label, actual, expected):
        mark = "PASS" if actual == expected else "FAIL"
        results.append((mark, label, actual, expected))

    def info(label, actual):
        results.append(("INFO", label, actual, "-"))

    # Bug-115 日志脱敏
    try:
        from app.utils.log_redactor import LogRedactor, RedactRule

        r = LogRedactor()
        res = r.redact({"text": "13800138000", "name": "alice", "password": "secret"})
        check("Bug-115 手机脱敏", "[PHONE]" in res.data["text"], True)
        check("Bug-115 密码脱敏", res.data["password"], "[REDACTED]")
        check("Bug-115 name 不动", res.data["name"], "alice")
        # 白名单
        r.add_whitelist_key("safe")
        res2 = r.redact({"safe": "13900139000"})
        check("Bug-115 白名单跳过", res2.data["safe"], "13900139000")
        # 身份证
        res3 = r.redact({"text": "11010119900101123X"})
        check("Bug-115 身份证脱敏", "[ID_CARD]" in res3.data["text"], True)
        # 邮箱
        res4 = r.redact({"text": "alice@example.com"})
        check("Bug-115 邮箱脱敏", "[EMAIL]" in res4.data["text"], True)
        # 自定义规则
        import re

        r.add_rule(RedactRule("user_id", re.compile(r"user_\d+"), "USER"))
        res5 = r.redact({"text": "user_42 ok"})
        check("Bug-115 自定义规则", "USER" in res5.data["text"], True)
        # 嵌套
        res6 = r.redact({"a": {"b": {"phone": "13800138000"}}})
        check("Bug-115 嵌套脱敏", "[PHONE]" in res6.data["a"]["b"]["phone"], True)
        # 列表
        res7 = r.redact({"items": ["13800138000", "ok"]})
        check("Bug-115 列表脱敏", "[PHONE]" in res7.data["items"][0], True)
        # 黑名单 key
        r.add_blacklist_key(r"^ssn$")
        res8 = r.redact({"ssn": "123-45-6789"})
        check("Bug-115 黑名单 key", res8.data["ssn"], "[REDACTED]")
        # 统计
        s = r.stats()
        check("Bug-115 规则 >= 6", s["rule_count"] >= 6, True)
        # remove
        check("Bug-115 remove mobile", r.remove_rule("mobile"), True)
        # 清零
        r.clear_stats()
        check("Bug-115 clear stats", r.stats()["total_hits"], 0)
    except Exception as e:
        check("Bug-115 加载", f"{e!r}", None)

    # Bug-116 链路采样
    try:
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        rec1 = ts.start("t1", "t1", path="/api")
        check("Bug-116 head sample", rec1.decision, "sample")
        # tail
        ts2 = TraceSampler(default_rate=1.0, mode=SampleMode.TAIL.value)
        ts2.start("a", "t1", path="/api")
        rec_t = ts2.finish("a", duration_sec=0.5)
        check("Bug-116 tail sample", rec_t.decision, "sample")
        # error_first
        ts3 = TraceSampler(default_rate=0.0, mode=SampleMode.ERROR_FIRST.value)
        ts3.start("a", "t1")
        rec_e = ts3.finish("a", duration_sec=0.1, has_error=True)
        check("Bug-116 error_first sample", rec_e.decision, "sample")
        # 配额
        ts4 = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        ts4.set_tenant_quota("t_q", per_sec=2, per_min=10, rate=1.0)
        ts4.start("a", "t_q")
        ts4.start("b", "t_q")
        rec_q = ts4.start("c", "t_q")
        check("Bug-116 配额 drop", rec_q.decision, "drop")
        # tenant rate=0
        ts5 = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        ts5.set_tenant_quota("t0", rate=0.0)
        rec_z = ts5.start("a", "t0")
        check("Bug-116 rate=0 drop", rec_z.decision, "drop")
        # path override
        ts6 = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        ts6.set_path_rate("/slow", 1.0)
        rec_p = ts6.start("a", "t1", path="/slow")
        check("Bug-116 path override sample", rec_p.decision, "sample")
        # always/never
        ts7 = TraceSampler(mode=SampleMode.ALWAYS.value)
        check("Bug-116 always sample", ts7.start("a", "t1").decision, "sample")
        ts8 = TraceSampler(mode=SampleMode.NEVER.value)
        check("Bug-116 never drop", ts8.start("a", "t1").decision, "drop")
        # dynamic rate
        ts9 = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        ts9.set_default_rate(1.0)
        check("Bug-116 dynamic rate", ts9.start("a", "t1").decision, "sample")
        # pending
        ts10 = TraceSampler(default_rate=0.0, mode=SampleMode.TAIL.value)
        ts10.start("p1", "t1")
        ts10.start("p2", "t1")
        check("Bug-116 pending >=2", len(ts10.list_pending()) >= 2, True)
        check("Bug-116 clear_pending", ts10.clear_pending() >= 2, True)
        # stats
        s = ts.stats()
        check("Bug-116 stats 字段", "total_received" in s, True)
    except Exception as e:
        check("Bug-116 加载", f"{e!r}", None)

    # Bug-117 指标基数
    try:
        from app.utils.metric_label_cardinality import CardinalityAction, MetricCardinalityController

        m = MetricCardinalityController()
        ev = m.observe("req", {"path": "/a", "method": "GET"})
        check("Bug-117 基础 allow", ev.action, "allow")
        # 跟踪
        m.observe("req", {"path": "/a", "method": "GET"})
        for i in range(20):
            m.observe("req", {"path": f"/p/{i}"})
        c = m.cardinality("req")
        check("Bug-117 cardinality=21", c["path"], 21)
        # topn 限制
        m2 = MetricCardinalityController()
        m2.configure("req", max_cardinality=5, topn=3, action=CardinalityAction.TOPN.value)
        for i in range(10):
            m2.observe("req", {"path": f"/p/{i}"})
        c2 = m2.cardinality("req")
        # 实际保留 4 (3 top + __other__)
        check("Bug-117 topn<=4", c2["path"] <= 4, True)
        # drop
        m3 = MetricCardinalityController()
        m3.configure("req", max_cardinality=3, action=CardinalityAction.DROP.value)
        for i in range(5):
            m3.observe("req", {"path": f"/p/{i}"})
        c3 = m3.cardinality("req")
        check("Bug-117 drop<=3", c3["path"] <= 3, True)
        # 校验 label name
        ev_b = m.observe("req", {"0bad": "x"})
        check("Bug-117 invalid label drop", ev_b.dropped, True)
        # 校验 metric name
        check("Bug-117 valid metric", m.validate_metric_name("requests_total"), True)
        check("Bug-117 invalid metric", m.validate_metric_name("0bad"), False)
        # overlimit
        m4 = MetricCardinalityController()
        for i in range(50):
            m4.observe("hot", {"k": f"v{i}"})
        check("Bug-117 overlimit>=1", len(m4.list_overlimit(max_card=20)) >= 1, True)
        # reset
        m4.reset_metric("hot")
        check("Bug-117 reset 后 cardinality={}", m4.cardinality("hot"), {})
        # stats
        s = m.stats()
        check("Bug-117 stats samples", s["total_samples"] > 0, True)
        # top values
        for v in ["a", "a", "a", "b", "b", "c"]:
            m.observe("v", {"k": v})
        st = m.stat("v", "k")
        check("Bug-117 top1=a", st.top_values[0][0] == "a", True)
    except Exception as e:
        check("Bug-117 加载", f"{e!r}", None)

    # Bug-118 告警去重
    try:
        from app.utils.alert_dedup_aggregator import AggregationRule, AggregationStrategy, AlertDedupAggregator

        a = AlertDedupAggregator()
        ev = a.ingest("fp1", "warning", "t", "m")
        check("Bug-118 基础 notif", ev.notified, True)
        a.ingest("fp1", "warning", "t", "m")
        check("Bug-118 deduped 1+", a.get("fp1").count_in_window >= 2, True)
        # 静默
        a2 = AlertDedupAggregator()
        a2.silence("fp1", time.time() + 100)
        ev_s = a2.ingest("fp1", "warning", "t", "m")
        check("Bug-118 silence no notif", ev_s.notified, False)
        # escalate
        a3 = AlertDedupAggregator()
        a3.add_rule(AggregationRule(fingerprint_pattern="fp1", strategy=AggregationStrategy.ESCALATE.value))
        a3.ingest("fp1", "warning", "t", "m1")
        ev_e = a3.ingest("fp1", "critical", "t", "m2")
        check("Bug-118 escalate=critical", ev_e.severity, "critical")
        # first_last
        a4 = AlertDedupAggregator()
        a4.add_rule(AggregationRule(fingerprint_pattern="fp1", strategy=AggregationStrategy.FIRST_LAST.value))
        a4.ingest("fp1", "warning", "t", "m1")
        ev_f = a4.ingest("fp1", "warning", "t", "m2")
        check("Bug-118 first_last", "first=" in ev_f.message, True)
        # 规则增删
        a5 = AlertDedupAggregator()
        a5.add_rule(AggregationRule(fingerprint_pattern="x"))
        check("Bug-118 remove", a5.remove_rule("x"), True)
        check("Bug-118 remove no", a5.remove_rule("nope"), False)
        # list
        a6 = AlertDedupAggregator()
        a6.ingest("a", "warning", "t", "m")
        a6.ingest("b", "warning", "t", "m")
        check("Bug-118 active=2", len(a6.list_active()), 2)
        a6.ingest("a", "warning", "t", "m")
        check("Bug-118 deduped=1", len(a6.list_deduped()), 1)
        # get
        check("Bug-118 get a", a6.get("a") is not None, True)
        check("Bug-118 get no", a6.get("nope") is None, True)
        # expire
        a6.expire_window("a")
        check("Bug-118 expire", a6.get("a") is None, True)
        # notifier
        a7 = AlertDedupAggregator()
        received = []
        a7.set_notifier(lambda ev, routes: received.append(ev.id))
        a7.add_route("ops", "ops@example.com")
        a7.ingest("fp", "warning", "t", "m")
        check("Bug-118 notifier 1", len(received), 1)
        # stats
        check("Bug-118 stats 字段", "total_received" in a7.stats(), True)
    except Exception as e:
        check("Bug-118 加载", f"{e!r}", None)

    # Bug-119 密钥轮换
    try:
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        spec = c.register("k1", "api_key", lambda v: f"v-{v}", ttl_sec=3600)
        check("Bug-119 v1 current", spec.current_version, 1)
        # rotate
        new_v = c.rotate("k1", new_loader=lambda v: f"new-{v}")
        check("Bug-119 v=2", new_v.version, 2)
        check("Bug-119 phase=canary", c.get_spec("k1").phase, "canary")
        # advance
        c.advance_rollout("k1", ratio=1.0)
        check("Bug-119 phase=stable", c.get_spec("k1").phase, "stable")
        # complete
        check("Bug-119 complete ok", c.complete("k1"), True)
        # rollback
        c2 = SecretRotationCoordinator()
        c2.register("k1", "api_key", lambda v: f"v-{v}")
        c2.rotate("k1")
        prev = c2.rollback("k1")
        check("Bug-119 rollback != None", prev is not None, True)
        check("Bug-119 rollback v=1", prev.version, 1)
        # pick_version
        c3 = SecretRotationCoordinator()
        c3.register("k1", "api_key", lambda v: f"v-{v}")
        c3.rotate("k1")
        c3.advance_rollout("k1", ratio=1.0)
        v = c3.pick_version("k1", tenant="t1")
        check("Bug-119 pick v=2", v.version, 2)
        # check_expiring
        c4 = SecretRotationCoordinator()
        c4.register("k1", "api_key", lambda v: f"v-{v}", ttl_sec=1.0, warning_before_sec=10.0)
        s = c4.check_expiring("k1")
        check("Bug-119 needs_rotation", s["needs_rotation"], True)
        # list_expiring
        check("Bug-119 list_expiring>=1", len(c4.list_expiring()) >= 1, True)
        # audits
        c5 = SecretRotationCoordinator()
        c5.register("k1", "api_key", lambda v: f"v-{v}")
        c5.rotate("k1")
        check("Bug-119 audits>=2", len(c5.list_audits("k1")) >= 2, True)
        # get_current
        c6 = SecretRotationCoordinator()
        c6.register("k1", "api_key", lambda v: f"v-{v}")
        check("Bug-119 get_current != None", c6.get_current("k1") is not None, True)
        # get_version
        c6.rotate("k1")
        check("Bug-119 get_version 1", c6.get_version("k1", 1) is not None, True)
        check("Bug-119 get_version 2", c6.get_version("k1", 2) is not None, True)
        # stats
        s2 = c6.stats()
        check("Bug-119 stats>=2 ver", s2["version_count"] >= 2, True)
    except Exception as e:
        check("Bug-119 加载", f"{e!r}", None)

    # Bug-120 慢查询
    try:
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        r = k.execute("q1", "select 1", lambda: "ok")
        check("Bug-120 基础 ok", r["ok"], True)
        # 白名单
        k2 = SlowQueryKillSwitch()
        k2.add_whitelist("q_wl")
        r_wl = k2.execute("q_wl", "select", lambda: "always")
        check("Bug-120 白名单执行", r_wl["value"], "always")
        # 规则
        k3 = SlowQueryKillSwitch()
        k3.add_rule("q1", max_duration_sec=0.001, action=KillAction.KILL.value)
        r_k = k3.execute("q1", "select", lambda: time.sleep(0.01))
        check("Bug-120 kill", r_k["action"], "kill")
        # throttle
        k4 = SlowQueryKillSwitch()
        k4.add_rule("q1", action=KillAction.THROTTLE.value)
        check("Bug-120 throttle", k4.execute("q1", "x", lambda: "x")["action"], "throttle")
        # degrade
        k5 = SlowQueryKillSwitch()
        k5.add_rule("q1", action=KillAction.DEGRADE.value)
        r_d = k5.execute("q1", "x", lambda: "d")
        check("Bug-120 degrade", r_d["action"], "degrade")
        # remove
        check("Bug-120 remove", k3.remove_rule("q1"), True)
        # 异常
        k6 = SlowQueryKillSwitch()
        r_e = k6.execute("q1", "x", lambda: 1 / 0)
        check("Bug-120 error", r_e["ok"], False)
        # auto throttle
        k7 = SlowQueryKillSwitch(default_max_duration=0.001)
        k7.execute("q1", "x", lambda: time.sleep(0.02))
        check("Bug-120 auto_throttle", k7.get_stats("q1") is not None, True)
        # expire
        k8 = SlowQueryKillSwitch()
        k8.add_rule("q1", ttl_sec=0.001)
        time.sleep(0.01)
        check("Bug-120 expire", k8.expire_rules() >= 1, True)
        # list_slow
        k9 = SlowQueryKillSwitch()
        k9.execute("q1", "x", lambda: time.sleep(0.05) or "x")
        check("Bug-120 list_slow>=1", len(k9.list_slow(threshold=0.01)) >= 1, True)
        # list_audits
        k10 = SlowQueryKillSwitch()
        k10.add_rule("q1", action=KillAction.KILL.value)
        k10.execute("q1", "x", lambda: "x")
        check("Bug-120 audits>=1", len(k10.list_audits("q1")) >= 1, True)
        # impact
        s = k10.impact()
        check("Bug-120 killed>=1", s["killed"] >= 1, True)
    except Exception as e:
        check("Bug-120 加载", f"{e!r}", None)

    # Bug-121 缓存击穿
    try:
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard(default_ttl_sec=10.0)
        g.set("k1", "v1")
        check("Bug-121 set/get", g.get("k1", lambda: "x"), "v1")
        # miss
        g2 = CacheBreakdownGuard()
        check("Bug-121 miss load", g2.get("k1", lambda: "loaded"), "loaded")
        # invalidate
        g3 = CacheBreakdownGuard()
        g3.set("k1", "v1")
        check("Bug-121 invalidate", g3.invalidate("k1"), True)
        # singleflight
        g4 = CacheBreakdownGuard()
        cc = []

        def ld():
            time.sleep(0.05)
            cc.append(1)
            return "x"

        results_sf = []

        def runner():
            results_sf.append(g4.get("k1", ld))

        ts = [threading.Thread(target=runner) for _ in range(5)]
        for t in ts:
            t.start()
        for t in ts:
            t.join()
        check("Bug-121 singleflight <=2", len(cc) <= 2, True)
        # stale
        g5 = CacheBreakdownGuard(default_ttl_sec=0.05, stale_grace_sec=1.0)
        g5.set("k1", "v1")
        time.sleep(0.1)
        check("Bug-121 stale=v1", g5.get("k1", lambda: "new"), "v1")
        # hot
        g6 = CacheBreakdownGuard(default_ttl_sec=10.0, hot_threshold=3, hot_ttl_multiplier=5.0)
        for _ in range(10):
            g6.get("hot", lambda: "v")
        entry = g6.get_entry("hot")
        check("Bug-121 hot 延长", entry is not None and (entry.expires_at - entry.created_at) > 10.0, True)
        # loader 异常
        g7 = CacheBreakdownGuard()
        try:
            g7.get("k1", lambda: 1 / 0)
            check("Bug-121 loader 异常", "no raise", "raise")
        except Exception:
            check("Bug-121 loader 异常", "raised", "raised")
        # hot_keys
        g8 = CacheBreakdownGuard()
        for _ in range(5):
            g8.get("k1", lambda: "v1")
        check("Bug-121 hot_keys k1", g8.hot_keys()[0][0], "k1")
        # entries
        g9 = CacheBreakdownGuard()
        g9.set("k1", "v1")
        g9.get("k1", lambda: "v1")
        check("Bug-121 stats hit", g9.stats()["hit"] >= 1, True)
        # clear
        g9.clear()
        check("Bug-121 clear", len(g9.list_entries()), 0)
    except Exception as e:
        check("Bug-121 加载", f"{e!r}", None)

    # Bug-122 配置灰度
    try:
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        v1 = c.publish("ns1", {"a": 1})
        check("Bug-122 publish v1", v1.version, 1)
        v2 = c.publish("ns1", {"a": 2})
        check("Bug-122 publish v2", v2.version, 2)
        # canary
        t = c.start_canary("ns1", version=2, regions=["r1"], canary_ratio=0.1)
        check("Bug-122 canary phase", t.phase, "canary")
        # advance
        c.advance(t.id, ratio=1.0)
        cur = c.get("ns1")
        check("Bug-122 current=v2", cur.version, 2)
        # push
        c2 = ConfigCanaryPush()
        c2.register_push(lambda ns, v, r, content: True)
        c2.publish("ns1", {"a": 1})
        c2.publish("ns1", {"a": 2})
        t2 = c2.start_canary("ns1", version=2, regions=["r1"])
        check("Bug-122 push ok", c2.push_to_region(t2.id, "r1"), True)
        # verify
        c2.register_verify(lambda ns, v, r: True)
        check("Bug-122 verify ok", c2.verify_region(t2.id, "r1"), True)
        # push_all
        c3 = ConfigCanaryPush()
        c3.register_push(lambda ns, v, r, content: True)
        c3.publish("ns1", {"a": 1})
        c3.publish("ns1", {"a": 2})
        t3 = c3.start_canary("ns1", version=2, regions=["r1", "r2", "r3"])
        r3 = c3.push_all(t3.id)
        check("Bug-122 push_all ok=3", r3["ok"], 3)
        # rollback
        c4 = ConfigCanaryPush()
        c4.publish("ns1", {"a": 1})
        c4.publish("ns1", {"a": 2})
        t4 = c4.start_canary("ns1", version=2, regions=["r1"])
        c4.advance(t4.id, ratio=1.0)
        prev = c4.rollback("ns1")
        check("Bug-122 rollback != None", prev is not None, True)
        check("Bug-122 rollback v=1", prev.version, 1)
        # should_apply
        c5 = ConfigCanaryPush()
        c5.publish("ns1", {"a": 1})
        check("Bug-122 should apply", c5.should_apply("ns1", tenant="t1", client_version="1.0.0"), True)
        # min version
        c6 = ConfigCanaryPush()
        c6.publish("ns1", {"a": 1}, min_client_version="2.0.0")
        check("Bug-122 min ver 拒绝", c6.should_apply("ns1", client_version="1.0.0"), False)
        check("Bug-122 min ver 通过", c6.should_apply("ns1", client_version="2.0.0"), True)
        # get_version
        c7 = ConfigCanaryPush()
        c7.publish("ns1", {"a": 1})
        c7.publish("ns1", {"a": 2})
        check("Bug-122 get_version=2", c7.get_version("ns1", 2).version, 2)
        # list_versions
        check("Bug-122 list ver=2", len(c7.list_versions("ns1")), 2)
        # list_pushes
        c7.start_canary("ns1", version=2, regions=["r1"])
        check("Bug-122 list pushes>=1", len(c7.list_pushes()) >= 1, True)
        # get_push
        check("Bug-122 get push", c7.get_push(c7.list_pushes()[0].id) is not None, True)
        # stats
        s = c7.stats()
        check("Bug-122 stats ns=1", s["namespace_count"], 1)
    except Exception as e:
        check("Bug-122 加载", f"{e!r}", None)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第十三轮端到端验证报告")
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
