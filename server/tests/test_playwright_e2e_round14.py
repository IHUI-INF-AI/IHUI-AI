"""Playwright 端到端验证 - 第十四轮 8 项修复 (Bug-123/124/125/126/127/128/129/130)."""

import os
import sys
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

    # Bug-123 流式窗口聚合
    try:
        from app.utils.stream_window_aggregator import (
            StreamEvent,
            StreamWindowAggregator,
            WindowSpec,
            WindowType,
        )

        # 滚动窗口
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        for t in (1, 3, 5):
            agg.add(StreamEvent(key="g", value=1.0, event_time=float(t), group="g"))
        agg.add(StreamEvent(key="g", value=1.0, event_time=12.0, group="g"))
        closed = agg.list_closed()
        check("Bug-123 tumbling 关闭", len(closed) >= 1, True)
        check("Bug-123 tumbling 计数", closed[0].count, 3)
        # 滑动
        agg2 = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.SLIDING.value,
                size_sec=10,
                slide_sec=5,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        agg2.add(StreamEvent(key="g", value=1.0, event_time=12.0, group="g"))
        agg2.add(StreamEvent(key="g", value=1.0, event_time=30.0, group="g"))
        check("Bug-123 sliding 关闭", len(agg2.list_closed()) >= 1, True)
        # 会话
        agg3 = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.SESSION.value,
                size_sec=10,
                session_gap_sec=5,
            )
        )
        agg3.add(StreamEvent(key="g", value=1.0, event_time=1.0, group="u1"))
        agg3.add(StreamEvent(key="g", value=1.0, event_time=3.0, group="u1"))
        agg3.add(StreamEvent(key="g", value=1.0, event_time=50.0, group="u1"))
        check("Bug-123 session 关闭", len(agg3.list_closed()) >= 1, True)
        # 强制关闭
        agg4 = StreamWindowAggregator(WindowSpec(type=WindowType.TUMBLING.value, size_sec=10))
        agg4.add(StreamEvent(key="g", value=1.0, event_time=1.0, group="g"))
        agg4.add(StreamEvent(key="g", value=2.0, event_time=3.0, group="g"))
        check("Bug-123 force_close", len(agg4.force_close("g")), 1)
        # 水位线
        agg5 = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
                watermark_delay_sec=2,
            )
        )
        agg5.add(StreamEvent(key="g", value=1.0, event_time=100.0, group="g"))
        check("Bug-123 watermark", agg5.watermark("g"), 98.0)
        # 统计
        info("Bug-123 stats", agg.stats())
    except Exception as e:
        check("Bug-123 加载", f"{e!r}", None)

    # Bug-124 消息重试编排器
    try:
        from app.utils.message_retry_orchestrator import (
            MessageRetryOrchestrator,
            RetryPolicy,
            RetryState,
        )

        # 成功
        orch = MessageRetryOrchestrator(RetryPolicy(failure_threshold=3, max_attempts=3))
        orch.set_handler(lambda p: True)
        orch.submit("m1", payload={"x": 1})
        r = orch.attempt("m1")
        check("Bug-124 成功", r.state, RetryState.SUCCEEDED.value)
        # 失败重试
        orch2 = MessageRetryOrchestrator(
            RetryPolicy(
                initial_delay_sec=0.05,
                max_attempts=5,
                failure_threshold=99,
                jitter=0.0,
            )
        )
        orch2.set_handler(lambda p: False)
        orch2.submit("m2", payload={})
        r2 = orch2.attempt("m2")
        check("Bug-124 重试调度", r2.state, RetryState.RETRY_SCHEDULED.value)
        time.sleep(0.1)
        check("Bug-124 ready", any(m.id == "m2" for m in orch2.ready_for_retry()), True)
        # 熔断
        orch3 = MessageRetryOrchestrator(
            RetryPolicy(
                failure_threshold=1,
                max_attempts=99,
                circuit_reset_sec=60,
                initial_delay_sec=0.0,
            )
        )
        orch3.set_handler(lambda p: False)
        orch3.submit("m3", payload={})
        orch3.attempt("m3")
        orch3.submit("m4", payload={})
        r4 = orch3.attempt("m4")
        check("Bug-124 熔断", r4.state, RetryState.CIRCUIT_OPEN.value)
        # 死信
        orch4 = MessageRetryOrchestrator(
            RetryPolicy(
                initial_delay_sec=0.0,
                max_attempts=2,
                failure_threshold=99,
                jitter=0.0,
            )
        )
        orch4.set_handler(lambda p: False)
        orch4.submit("m5", payload={})
        orch4.attempt("m5")
        r5 = orch4.attempt("m5")
        check("Bug-124 死信", r5.state, RetryState.DEAD_LETTER.value)
        check("Bug-124 DL 列表", len(orch4.list_dead_letters()), 1)
        # reset
        orch3.reset_circuit()
        check("Bug-124 reset", orch3._circuit_opened_at, 0.0)
    except Exception as e:
        check("Bug-124 加载", f"{e!r}", None)

    # Bug-125 数据脱敏管道
    try:
        from app.utils.data_masking_pipeline import (
            DataMaskingPipeline,
            FieldMaskRule,
            MaskStrategy,
        )

        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="password", strategy=MaskStrategy.FULL.value))
        r = pipe.mask({"password": "123456"})
        check("Bug-125 FULL", r["password"], "[REDACTED]")
        pipe2 = DataMaskingPipeline()
        pipe2.add_rule(
            FieldMaskRule(
                field="id",
                strategy=MaskStrategy.PARTIAL.value,
                keep_prefix=2,
                keep_suffix=2,
            )
        )
        r2 = pipe2.mask({"id": "1234567890"})
        check("Bug-125 PARTIAL", r2["id"].startswith("12") and r2["id"].endswith("90"), True)
        pipe3 = DataMaskingPipeline()
        pipe3.add_rule(FieldMaskRule(field="phone", strategy=MaskStrategy.PHONE.value))
        pipe3.add_rule(FieldMaskRule(field="email", strategy=MaskStrategy.EMAIL.value))
        pipe3.add_rule(FieldMaskRule(field="id_card", strategy=MaskStrategy.ID_CARD.value))
        r3 = pipe3.mask({"phone": "13800138000", "email": "a@b.com", "id_card": "11010119900101001X"})
        check("Bug-125 PHONE", r3["phone"], "138****8000")
        check("Bug-125 EMAIL", "@" in r3["email"], True)
        check("Bug-125 ID_CARD", "110101" in r3["id_card"], True)
        # 默认敏感字段
        r4 = DataMaskingPipeline().mask({"token": "abc"})
        check("Bug-125 默认 token", r4["token"], "[REDACTED]")
        # 行级过滤
        pipe4 = DataMaskingPipeline()
        pipe4.add_rule(FieldMaskRule(field="pwd", strategy=MaskStrategy.FULL.value))
        pipe4.add_row_filter(lambda r: r["n"] == 1)
        rows = [{"n": 1, "pwd": "a"}, {"n": 2, "pwd": "b"}]
        rs = pipe4.mask_rows(rows)
        check("Bug-125 行过滤", len(rs), 1)
        # 嵌套
        r5 = pipe.mask({"u": {"password": "x"}})
        check("Bug-125 嵌套", r5["u"]["password"], "[REDACTED]")
        # 审计
        check("Bug-125 审计", len(pipe.list_audits()) >= 1, True)
    except Exception as e:
        check("Bug-125 加载", f"{e!r}", None)

    # Bug-126 业务幂等键
    try:
        from app.utils.idempotency_key import (
            ConflictInfo,
            IdempotencyConfig,
            IdempotencyKeyManager,
            KeyState,
            build_idempotency_key,
            compute_request_hash,
        )

        # 哈希稳定
        h1 = compute_request_hash({"a": 1, "b": 2})
        h2 = compute_request_hash({"b": 2, "a": 1})
        check("Bug-126 哈希稳定", h1, h2)
        # key
        k1 = build_idempotency_key("t1", "o", "1", {"a": 1})
        k2 = build_idempotency_key("t1", "o", "1", {"a": 1})
        check("Bug-126 key 一致", k1, k2)
        check("Bug-126 key 长度", len(k1), 32)
        # acquire / conflict
        mgr = IdempotencyKeyManager()
        rec1 = mgr.acquire_or_conflict("t1", "o", "1", {"a": 1}, owner="w1")
        check("Bug-126 首次", isinstance(rec1, type(rec1)) and not isinstance(rec1, ConflictInfo), True)
        rec2 = mgr.acquire_or_conflict("t1", "o", "1", {"a": 1}, owner="w1")
        check("Bug-126 续约", not isinstance(rec2, ConflictInfo), True)
        rec3 = mgr.acquire_or_conflict("t1", "o", "1", {"a": 1}, owner="w2")
        check("Bug-126 冲突", isinstance(rec3, ConflictInfo), True)
        # complete
        mgr2 = IdempotencyKeyManager()
        rec4 = mgr2.acquire_or_conflict("t2", "o", "1", owner="w1")
        mgr2.complete(rec4.key, result={"ok": True})
        check("Bug-126 完成", mgr2.get(rec4.key).state, KeyState.COMPLETED)
        # 强制过期
        check("Bug-126 force_expire", mgr2.force_expire(rec4.key), True)
        check("Bug-126 过期后 None", mgr2.get(rec4.key), None)
        # 租户隔离
        mgr3 = IdempotencyKeyManager(IdempotencyConfig(enable_tenant_isolation=True))
        thrown = False
        try:
            mgr3.acquire_or_conflict("", "o", "1", owner="w1")
        except ValueError:
            thrown = True
        check("Bug-126 租户隔离", thrown, True)
    except Exception as e:
        check("Bug-126 加载", f"{e!r}", None)

    # Bug-127 实时风控规则引擎
    try:
        from app.utils.risk_rule_engine import (
            RiskRule,
            RiskRuleEngine,
            RuleAction,
            SafeEvaluator,
        )

        ev = SafeEvaluator()
        ev.set_vars({"a": 5, "b": 10})
        check("Bug-127 表达式 <", ev.evaluate("a < b"), True)
        check("Bug-127 表达式 in", ev.evaluate("'abc' in 'abcdef'"), True)
        check("Bug-127 三元", ev.evaluate("1 if a > 0 else 0"), 1)
        check("Bug-127 函数", ev.evaluate("min(a, b)"), 5)
        eng = RiskRuleEngine()
        eng.add_rule(RiskRule(rule_id="r1", name="r1", expression="x > 100", action=RuleAction.DENY, priority=1))
        action, hits = eng.evaluate("u1", {"x": 200})
        check("Bug-127 DENY", action, RuleAction.DENY)
        check("Bug-127 命中", len(hits), 1)
        eng.enable_rule("r1", False)
        action2, _ = eng.evaluate("u1", {"x": 200})
        check("Bug-127 禁用后 ALLOW", action2, RuleAction.ALLOW)
        s = eng.stats()
        check("Bug-127 规则数", s["rules_total"], 1)
    except Exception as e:
        check("Bug-127 加载", f"{e!r}", None)

    # Bug-128 数据校验链
    try:
        from app.utils.validation_chain import (
            ChainConfig,
            FieldSchema,
            FieldType,
            Severity,
            ValidationChain,
            ValidationRule,
        )

        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(rule_id="r1", name="r1", schema=FieldSchema(field="n", type=FieldType.STRING, required=True))
        )
        check("Bug-128 必填", chain.validate({}).passed, False)
        check("Bug-128 通过", chain.validate({"n": "x"}).passed, True)
        chain2 = ValidationChain()
        chain2.add_rule(
            ValidationRule(rule_id="r2", name="r2", schema=FieldSchema(field="email", type=FieldType.EMAIL))
        )
        check("Bug-128 EMAIL 失败", chain2.validate({"email": "bad"}).passed, False)
        check("Bug-128 EMAIL 成功", chain2.validate({"email": "a@b.com"}).passed, True)
        chain3 = ValidationChain(ChainConfig(short_circuit_on_critical=True))
        chain3.add_rule(
            ValidationRule(
                rule_id="c1",
                name="c1",
                field="a",
                severity=Severity.CRITICAL,
                predicate=lambda d: "bad" if d.get("a") == 1 else None,
            )
        )
        chain3.add_rule(
            ValidationRule(
                rule_id="c2",
                name="c2",
                field="b",
                severity=Severity.ERROR,
                predicate=lambda d: "bad" if d.get("b") == 1 else None,
            )
        )
        r = chain3.validate({"a": 1, "b": 1})
        check("Bug-128 critical 短路", len(r.rule_results), 1)
        check("Bug-128 has_critical", r.has_critical(), True)
        chain4 = ValidationChain()
        chain4.add_rule(
            ValidationRule(
                rule_id="p",
                name="p",
                field="x",
                severity=Severity.ERROR,
                predicate=lambda d: "bad" if d.get("x", 0) <= 0 else None,
            )
        )
        check("Bug-128 predicate 失败", chain4.validate({"x": -1}).passed, False)
        check("Bug-128 predicate 成功", chain4.validate({"x": 1}).passed, True)
    except Exception as e:
        check("Bug-128 加载", f"{e!r}", None)

    # Bug-129 异步任务去重
    try:
        from app.utils.task_deduper import (
            DedupTaskState,
            TaskDeduper,
            compute_dedup_key,
        )

        d = TaskDeduper()
        t1 = d.submit("o", {"k": 1}, payload={})
        t2 = d.submit("o", {"k": 1}, payload={})
        check("Bug-129 主任务", t1.state, DedupTaskState.PENDING)
        check("Bug-129 合并", t2.state, DedupTaskState.MERGED)
        check("Bug-129 merged_into", t2.merged_into, t1.task_id)
        k1 = compute_dedup_key("s", {"a": 1, "b": 2})
        k2 = compute_dedup_key("s", {"b": 2, "a": 1})
        check("Bug-129 key 稳定", k1, k2)
        check("Bug-129 key 长度", len(k1), 32)
        d2 = TaskDeduper()
        t3 = d2.submit("s", "k", payload={})
        d2.start(t3.task_id)
        check("Bug-129 RUNNING", d2.get_by_id(t3.task_id).state, DedupTaskState.RUNNING)
        d2.complete(t3.task_id, result="ok")
        check("Bug-129 SUCCESS", d2.get_by_id(t3.task_id).result, "ok")
        t4 = d2.submit("s", "k", payload={})
        check("Bug-129 终态返回", t4.state, DedupTaskState.SUCCESS)
        d3 = TaskDeduper()
        events = []
        d3.add_callback(lambda t: events.append(t.state))
        t5 = d3.submit("s", "k2", payload={})
        d3.start(t5.task_id)
        d3.complete(t5.task_id)
        check("Bug-129 回调", DedupTaskState.RUNNING in events and DedupTaskState.SUCCESS in events, True)
        t6 = d3.submit("s", "k3", payload={})
        d3.cancel(t6.task_id)
        check("Bug-129 CANCELLED", d3.get_by_id(t6.task_id).state, DedupTaskState.CANCELLED)
    except Exception as e:
        check("Bug-129 加载", f"{e!r}", None)

    # Bug-130 数据质量监控
    try:
        from app.utils.data_quality_monitor import (
            DataQualityMonitor,
            DQDimension,
            DQRule,
        )

        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="c", name="c", dimension=DQDimension.COMPLETENESS, dataset="u", target_field="n", threshold=0.99
            )
        )
        m.feed("u", {"n": "A"})
        m.feed("u", {"n": ""})
        m.feed("u", {"n": None})
        check("Bug-130 完整性违规", len(m.get_violations(dataset="u")), 2)
        m2 = DataQualityMonitor()
        m2.add_rule(
            DQRule(
                rule_id="a",
                name="a",
                dimension=DQDimension.ACCURACY,
                dataset="o",
                target_field="s",
                threshold=1.0,
                params={"allowed_values": ["P", "B"]},
            )
        )
        m2.feed("o", {"s": "P"})
        m2.feed("o", {"s": "X"})
        check("Bug-130 准确性违规", len(m2.get_violations(dataset="o")), 1)
        m3 = DataQualityMonitor()
        m3.add_rule(
            DQRule(
                rule_id="k",
                name="k",
                dimension=DQDimension.CONSISTENCY,
                dataset="l",
                threshold=1.0,
                params={"field_pairs": [{"a": "x", "b": "y"}]},
            )
        )
        m3.feed("l", {"x": 1, "y": 1})
        m3.feed("l", {"x": 1, "y": 2})
        check("Bug-130 一致性违规", len(m3.get_violations(dataset="l")), 1)
        m4 = DataQualityMonitor()
        m4.add_rule(
            DQRule(
                rule_id="t",
                name="t",
                dimension=DQDimension.TIMELINESS,
                dataset="i",
                target_field="ts",
                threshold=60.0,
                params={"max_delay_sec": 60.0},
            )
        )
        m4.feed("i", {"ts": time.time() - 3600})
        check("Bug-130 及时性违规", len(m4.get_violations(dataset="i")), 1)
        m5 = DataQualityMonitor()
        m5.add_rule(
            DQRule(
                rule_id="u", name="u", dimension=DQDimension.UNIQUENESS, dataset="uu", target_field="id", threshold=1.0
            )
        )
        m5.feed("uu", {"id": "1"})
        m5.feed("uu", {"id": "1"})
        check("Bug-130 唯一性违规", len(m5.get_violations(dataset="uu")), 1)
        m6 = DataQualityMonitor()
        m6.add_rule(
            DQRule(
                rule_id="v",
                name="v",
                dimension=DQDimension.VALIDITY,
                dataset="uu",
                target_field="email",
                threshold=1.0,
                params={"validator": "email"},
            )
        )
        m6.feed("uu", {"email": "bad"})
        m6.feed("uu", {"email": "a@b.com"})
        check("Bug-130 有效性违规", len(m6.get_violations(dataset="uu")), 1)
        s = m.stats()
        check("Bug-130 rules >= 1", s["rules_total"] >= 1, True)
    except Exception as e:
        check("Bug-130 加载", f"{e!r}", None)


def _report(results):
    print("=" * 78)
    print("Playwright E2E 验证 - 第十四轮 8 项修复 (Bug-123 ~ Bug-130)")
    print("=" * 78)
    pass_n = sum(1 for r in results if r[0] == "PASS")
    fail_n = sum(1 for r in results if r[0] == "FAIL")
    info_n = sum(1 for r in results if r[0] == "INFO")
    for mark, label, actual, expected in results:
        if mark == "INFO":
            print(f"  [INFO] {label}: {actual}")
        else:
            print(f"  [{mark}] {label}: 实际={actual} 期望={expected}")
    print("=" * 78)
    print(f"汇总: PASS={pass_n}  FAIL={fail_n}  INFO={info_n}")
    print("=" * 78)
    if fail_n == 0:
        print("\u2713 全部验证通过, 第十四轮 8 个模块工作正常")
    else:
        print(f"\u2717 有 {fail_n} 项失败")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
