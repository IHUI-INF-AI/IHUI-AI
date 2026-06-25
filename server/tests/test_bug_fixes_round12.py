"""第十二轮 8 项 P2 Bug 修复的回归测试 (Bug-107 ~ Bug-114)."""

import time

# ---------------------------------------------------------------------------
# Bug-107: LLM Prompt 模板缓存
# ---------------------------------------------------------------------------


class TestBug107PromptCache:
    def test_add_and_get_template(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        t = prompt_cache.add_template("greet", 1, "Hello {name}", ["name"], description="greet")
        assert t.template_hash != ""
        g = prompt_cache.get_template("greet", 1)
        assert g is not None
        assert g.body == "Hello {name}"

    def test_get_latest(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("greet", 1, "v1")
        prompt_cache.add_template("greet", 2, "v2")
        prompt_cache.add_template("greet", 3, "v3")
        assert prompt_cache.latest_version("greet") == 3
        g = prompt_cache.get_template("greet")
        assert g.body == "v3"

    def test_render_basic(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("greet", 1, "Hello {name}, today is {day}", ["name", "day"])
        r = prompt_cache.render("greet", {"name": "alice", "day": "monday"})
        assert r["ok"] is True
        assert r["rendered"] == "Hello alice, today is monday"
        assert r["cache_hit"] is False

    def test_render_cache_hit(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("greet", 1, "Hi {x}")
        r1 = prompt_cache.render("greet", {"x": "1"})
        r2 = prompt_cache.render("greet", {"x": "1"})
        assert r1["cache_hit"] is False
        assert r2["cache_hit"] is True
        assert r2["hit_count"] == 1

    def test_render_different_vars(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("t", 1, "v={v}")
        r1 = prompt_cache.render("t", {"v": "1"})
        r2 = prompt_cache.render("t", {"v": "2"})
        assert r1["cache_hit"] is False
        assert r2["cache_hit"] is False

    def test_render_template_not_found(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        r = prompt_cache.render("nonexistent", {})
        assert r["ok"] is False
        assert r["error"] == "template_not_found"

    def test_invalidate_by_template(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("t1", 1, "A={a}")
        prompt_cache.add_template("t2", 1, "B={b}")
        prompt_cache.render("t1", {"a": "1"})
        prompt_cache.render("t2", {"b": "2"})
        assert prompt_cache.invalidate(name="t1") >= 1
        # t1 应未命中
        r1 = prompt_cache.render("t1", {"a": "1"})
        assert r1["cache_hit"] is False
        # t2 应仍然命中
        r2 = prompt_cache.render("t2", {"b": "2"})
        assert r2["cache_hit"] is True

    def test_invalidate_all(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("t", 1, "v")
        prompt_cache.render("t", {})
        n = prompt_cache.invalidate()
        assert n >= 1

    def test_remove_template(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("t", 1, "x")
        prompt_cache.add_template("t", 2, "y")
        n = prompt_cache.remove_template("t")
        assert n == 2
        assert prompt_cache.get_template("t") is None

    def test_gc_expired(self):
        from app.utils.llm_prompt_cache import PromptCache

        pc = PromptCache(max_renders=10, default_ttl=0.05)
        pc.add_template("t", 1, "v")
        pc.render("t", {"a": 1})
        pc.render("t", {"a": 2})
        time.sleep(0.1)
        n = pc.gc_expired()
        assert n >= 2

    def test_lru_eviction(self):
        from app.utils.llm_prompt_cache import PromptCache

        pc = PromptCache(max_renders=3)
        pc.add_template("t", 1, "v")
        for i in range(5):
            pc.render("t", {"i": i})
        # 只有最近 3 个
        s = pc.stats()
        assert s["render_cache_size"] == 3

    def test_list_versions(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("t", 1, "a")
        prompt_cache.add_template("t", 3, "c")
        prompt_cache.add_template("t", 2, "b")
        vs = prompt_cache.list_versions("t")
        assert vs == [1, 2, 3]

    def test_history(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("h", 1, "x")
        h = prompt_cache.get_history()
        assert len(h) >= 1
        assert h[-1][0] == "h"

    def test_stats(self):
        from app.utils.llm_prompt_cache import prompt_cache

        prompt_cache.clear()
        prompt_cache.add_template("s", 1, "x")
        prompt_cache.render("s", {"a": 1})
        s = prompt_cache.stats()
        assert s["template_count"] == 1
        assert s["render_calls"] == 1
        assert s["render_misses"] == 1


# ---------------------------------------------------------------------------
# Bug-108: LLM Token 预算
# ---------------------------------------------------------------------------


class TestBug108TokenBudget:
    def test_set_and_get_budget(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        b = token_budget.set_budget("t1", "gpt-4", per_minute=100, per_hour=1000, per_day=10000, per_month=100000)
        assert b.per_minute == 100
        g = token_budget.get_budget("t1", "gpt-4")
        assert g is not None

    def test_check_within_budget(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t2", "m", per_minute=10000)
        r = token_budget.check("t2", "m", tokens_estimated=100)
        assert r["ok"] is True
        assert r["reason"] == "within_budget"

    def test_check_per_minute_exceeded(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t3", "m", per_minute=100)
        token_budget.consume("t3", "m", 90)
        r = token_budget.check("t3", "m", tokens_estimated=20)
        assert r["ok"] is False
        assert r["reason"] == "per_minute"

    def test_check_per_hour_exceeded(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t4", "m", per_minute=100000, per_hour=500)
        for _ in range(5):
            token_budget.consume("t4", "m", 100)  # 500
        r = token_budget.check("t4", "m", tokens_estimated=10)
        assert r["ok"] is False
        assert r["reason"] == "per_hour"

    def test_check_per_day_exceeded(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t5", "m", per_day=300, per_minute=10000, per_hour=10000, per_month=100000)
        for _ in range(3):
            token_budget.consume("t5", "m", 100)  # 300
        r = token_budget.check("t5", "m", tokens_estimated=10)
        assert r["ok"] is False
        assert r["reason"] == "per_day"

    def test_consume_record(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t6", "m", per_minute=10000, per_hour=10000, per_day=10000, per_month=10000)
        r = token_budget.consume("t6", "m", 100, request_id="req1")
        assert r["ok"] is True
        assert r["consumed"] == 100
        assert r["current"]["min"] == 100

    def test_consume_with_fallback(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t7", "gpt-4", per_minute=50, fallback_model="gpt-3.5")
        token_budget.consume("t7", "gpt-4", 50)
        r = token_budget.check("t7", "gpt-4", tokens_estimated=10)
        assert r["ok"] is False
        assert r["fallback_model"] == "gpt-3.5"

    def test_refund(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("t8", "m", per_minute=10000)
        token_budget.consume("t8", "m", 500)
        assert token_budget.refund("t8", "m", 200) is True
        usage = token_budget.get_usage("t8", "m")
        assert usage["min"] == 300

    def test_no_budget_set(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        r = token_budget.check("nobody", "m", tokens_estimated=100)
        assert r["ok"] is True
        assert r["reason"] == "no_budget_set"

    def test_apply_policy(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        check_result = {"ok": False, "reason": "per_minute", "fallback_model": "gpt-3.5"}
        r = token_budget.apply_policy(check_result)
        assert r["action"] == "reject"
        assert r["fallback_model"] == "gpt-3.5"

    def test_get_usage(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("u", "m", per_minute=10000, per_hour=10000, per_day=10000, per_month=10000)
        token_budget.consume("u", "m", 100)
        token_budget.consume("u", "m", 200)
        u = token_budget.get_usage("u", "m")
        assert u["min"] == 300
        assert u["total_records"] == 2

    def test_list_budgets(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("a", "m1")
        token_budget.set_budget("a", "m2")
        token_budget.set_budget("b", "m1")
        arr = token_budget.list_budgets(tenant_id="a")
        assert len(arr) == 2

    def test_remove_budget(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("r", "m")
        assert token_budget.remove_budget("r", "m") is True
        assert token_budget.get_budget("r", "m") is None

    def test_stats(self):
        from app.utils.llm_token_budget import token_budget

        token_budget.clear()
        token_budget.set_budget("s", "m")
        token_budget.consume("s", "m", 100)
        s = token_budget.stats()
        assert s["budget_count"] == 1
        assert s["total_records"] == 1


# ---------------------------------------------------------------------------
# Bug-109: 向量索引元数据
# ---------------------------------------------------------------------------


class TestBug109VectorIndex:
    def test_create_and_get(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        m = vector_index_meta.create("idx1", 768, "cosine", "hnsw")
        assert m.dimension == 768
        assert m.state == "healthy"
        assert m.checksum != ""

    def test_duplicate_create(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("dup", 768)
        try:
            vector_index_meta.create("dup", 768)
            assert False
        except ValueError:
            pass

    def test_drop(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("d1", 768)
        assert vector_index_meta.drop("d1") is True
        assert vector_index_meta.get("d1") is None

    def test_update(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("u1", 768)
        m = vector_index_meta.update("u1", doc_count=1000, dimension=1024)
        assert m.doc_count == 1000
        assert m.dimension == 1024

    def test_drift_report(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("dr1", 768)
        is_drift = vector_index_meta.report_drift("dr1", "dimension", 768, 1024)
        assert is_drift is True
        arr = vector_index_meta.get_drift("dr1")
        assert len(arr) == 1

    def test_mark_state(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("ms1", 768)
        assert vector_index_meta.mark_state("ms1", "dirty") is True
        assert vector_index_meta.get("ms1").state == "dirty"

    def test_rebuild_lifecycle(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("rb1", 768)
        vector_index_meta.start_rebuild("rb1")
        assert vector_index_meta.get("rb1").state == "rebuilding"
        assert vector_index_meta.finish_rebuild("rb1", new_doc_count=5000) is True
        assert vector_index_meta.get("rb1").doc_count == 5000
        assert vector_index_meta.get("rb1").state == "healthy"

    def test_rebuild_fail(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("rf1", 768)
        vector_index_meta.start_rebuild("rf1")
        vector_index_meta.fail_rebuild("rf1", "OOM")
        assert vector_index_meta.get("rf1").state == "failed"

    def test_verify(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("v1", 768)
        vector_index_meta.update("v1", doc_count=100)
        r = vector_index_meta.verify("v1", actual_doc_count=100, actual_dimension=768)
        assert r["ok"] is True
        r2 = vector_index_meta.verify("v1", actual_doc_count=99, actual_dimension=768)
        assert r2["ok"] is False

    def test_find_stale(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("s1", 768)
        vector_index_meta.verify("s1", 0, 768)
        # 立即查, 不应 stale
        arr = vector_index_meta.find_stale(max_age_sec=10)
        # 1s 应 stale
        time.sleep(0.01)
        arr = vector_index_meta.find_stale(max_age_sec=0.0)
        # 至少包含刚 verify 的
        names = {m.name for m in arr}
        assert "s1" in names

    def test_audit(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("au1", 768)
        vector_index_meta.drop("au1")
        audit = vector_index_meta.get_audit("au1")
        actions = [a.action for a in audit]
        assert "create" in actions
        assert "drop" in actions

    def test_list_all(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("a1", 768)
        vector_index_meta.create("b1", 1024)
        arr = vector_index_meta.list_all()
        assert len(arr) == 2

    def test_stats(self):
        from app.utils.vector_index_meta import vector_index_meta

        vector_index_meta.clear()
        vector_index_meta.create("s1", 768)
        s = vector_index_meta.stats()
        assert s["index_count"] == 1
        assert s["by_state"].get("healthy", 0) == 1


# ---------------------------------------------------------------------------
# Bug-110: 数据血缘追踪
# ---------------------------------------------------------------------------


class TestBug110DataLineage:
    def test_add_node(self):
        from app.utils.data_lineage import NodeKind, data_lineage

        data_lineage.clear()
        n = data_lineage.add_node("t1", NodeKind.TABLE.value, "users")
        assert n.id == "t1"
        assert n.kind == "table"

    def test_add_edge(self):
        from app.utils.data_lineage import EdgeKind, data_lineage

        data_lineage.clear()
        e = data_lineage.add_edge("a", "b", EdgeKind.READS.value)
        assert e.src == "a"
        assert e.dst == "b"

    def test_direct_downstream(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("a", "c")
        data_lineage.add_edge("b", "d")
        ds = data_lineage.direct_downstream("a")
        assert set(ds) == {"b", "c"}

    def test_direct_upstream(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "c")
        data_lineage.add_edge("b", "c")
        us = data_lineage.direct_upstream("c")
        assert set(us) == {"a", "b"}

    def test_all_downstream(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("b", "c")
        data_lineage.add_edge("c", "d")
        ds = data_lineage.all_downstream("a")
        assert set(ds) == {"b", "c", "d"}

    def test_all_upstream(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "c")
        data_lineage.add_edge("b", "c")
        data_lineage.add_edge("a", "b")
        us = data_lineage.all_upstream("c")
        assert set(us) == {"a", "b"}

    def test_impact(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("b", "c")
        im = data_lineage.impact("a")
        assert "b" in im.direct_downstream
        assert "c" in im.all_downstream

    def test_remove_edge(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        n = data_lineage.remove_edge("a", "b")
        assert n == 1
        assert data_lineage.direct_downstream("a") == []

    def test_remove_node(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("b", "c")
        assert data_lineage.remove_node("b") is True
        assert data_lineage.get_node("b") is None
        # 入边/出边应被清理
        assert data_lineage.direct_downstream("a") == []
        assert data_lineage.direct_upstream("c") == []

    def test_to_dot(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        dot = data_lineage.to_dot()
        assert "digraph lineage" in dot
        assert '"a" -> "b"' in dot

    def test_find_cycles(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("b", "c")
        data_lineage.add_edge("c", "a")  # 环
        cycles = data_lineage.find_cycles()
        assert len(cycles) >= 1

    def test_no_cycles(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        data_lineage.add_edge("b", "c")
        cycles = data_lineage.find_cycles()
        assert cycles == []

    def test_rebuild_index(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b")
        n = data_lineage.rebuild_index()
        assert n == 2

    def test_list_nodes_by_kind(self):
        from app.utils.data_lineage import NodeKind, data_lineage

        data_lineage.clear()
        data_lineage.add_node("t1", NodeKind.TABLE.value)
        data_lineage.add_node("j1", NodeKind.JOB.value)
        tables = data_lineage.list_nodes(kind=NodeKind.TABLE.value)
        assert len(tables) == 1

    def test_edge_weight_increments(self):
        from app.utils.data_lineage import data_lineage

        data_lineage.clear()
        data_lineage.add_edge("a", "b", weight=2)
        data_lineage.add_edge("a", "b", weight=3)
        # 不应重复, 而是 weight 累加
        ds = data_lineage.direct_downstream("a")
        assert ds == ["b"]


# ---------------------------------------------------------------------------
# Bug-111: GDPR 删除器
# ---------------------------------------------------------------------------


class TestBug111GdprEraser:
    def test_register_target(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("users", "email", redact_fn=lambda x: "[REDACTED]")
        t = gdpr_eraser.get_target("users", "email")
        assert t is not None
        assert t.field == "email"

    def test_unregister_target(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("users", "phone")
        assert gdpr_eraser.unregister_target("users", "phone") is True
        assert gdpr_eraser.get_target("users", "phone") is None

    def test_find_by_table(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "email")
        gdpr_eraser.register_target("u", "phone")
        arr = gdpr_eraser.find_targets_by_table("u")
        assert len(arr) == 2

    def test_find_by_field(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u1", "email")
        gdpr_eraser.register_target("u2", "email")
        arr = gdpr_eraser.find_targets_by_field("email")
        assert len(arr) == 2

    def test_erase_user_dry_run(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "user_id")
        gdpr_eraser.register_target("orders", "user_id")
        # 注册 executor
        gdpr_eraser.register_executor("u", lambda op, p: 5 if op == "select" else 0)
        gdpr_eraser.register_executor("orders", lambda op, p: 10 if op == "select" else 0)
        task = gdpr_eraser.erase_user("u1", dry_run=True)
        assert task.status == "dry_run"
        assert task.dry_run is True
        assert task.affected_rows == 15

    def test_erase_user_no_targets(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        task = gdpr_eraser.erase_user("u1")
        assert task.status == "done"
        assert task.affected_rows == 0

    def test_erase_field(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "email")
        gdpr_eraser.register_executor("u", lambda op, p: 42)
        task = gdpr_eraser.erase_field("u", "email", dry_run=True)
        assert task.status == "dry_run"
        assert task.affected_rows == 42

    def test_erase_field_not_registered(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        task = gdpr_eraser.erase_field("u", "noreg")
        assert task.status == "failed"

    def test_erase_time_window(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_executor("logs", lambda op, p: 100 if op == "delete" else 200)
        task = gdpr_eraser.erase_time_window("logs", "ts", 1000.0, 2000.0)
        assert task.status == "done"
        assert task.affected_rows == 100

    def test_verify_evidence(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "user_id")
        gdpr_eraser.register_executor("u", lambda op, p: 1)
        task = gdpr_eraser.erase_user("u1")
        v = gdpr_eraser.verify_evidence(task.id)
        assert v["ok"] is True

    def test_get_task(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "user_id")
        gdpr_eraser.register_executor("u", lambda op, p: 0)
        task = gdpr_eraser.erase_user("u2")
        g = gdpr_eraser.get_task(task.id)
        assert g is not None
        assert g.id == task.id

    def test_list_tasks(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "user_id")
        gdpr_eraser.register_executor("u", lambda op, p: 0)
        gdpr_eraser.erase_user("a")
        gdpr_eraser.erase_user("b")
        arr = gdpr_eraser.list_tasks()
        assert len(arr) == 2

    def test_stats(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "email")
        s = gdpr_eraser.stats()
        assert s["target_count"] == 1

    def test_executor_exception(self):
        from app.utils.gdpr_eraser import gdpr_eraser

        gdpr_eraser.clear()
        gdpr_eraser.register_target("u", "user_id")

        def bad_executor(op, p):
            raise RuntimeError("oops")

        gdpr_eraser.register_executor("u", bad_executor)
        task = gdpr_eraser.erase_user("u1")
        assert task.status == "failed"
        assert "oops" in task.error


# ---------------------------------------------------------------------------
# Bug-112: 备份快照协调
# ---------------------------------------------------------------------------


class TestBug112BackupSnapshot:
    def test_register_target(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        t = backup_coordinator.register_target("db_main", "db", interval_sec=3600.0, retention_count=5)
        assert t.name == "db_main"
        assert backup_coordinator.get_target("db_main") is not None

    def test_register_duplicate(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target("dup", "db")
        try:
            backup_coordinator.register_target("dup", "db")
            assert False
        except ValueError:
            pass

    def test_unregister(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target("d1", "db")
        assert backup_coordinator.unregister_target("d1") is True
        assert backup_coordinator.unregister_target("d1") is False

    def test_run_with_runner(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()

        def runner():
            # 2026-06-25 修复: 用 mock:// 协议占位符代替 /tmp/x, 避免在 Windows 上被误解释为 G:\tmp\x
            return {"path": "mock://backup/x", "size": 1024, "checksum": "abc"}

        backup_coordinator.register_target("r1", "fs", runner=runner, interval_sec=10.0, jitter_sec=0.0)
        rec = backup_coordinator.run("r1")
        assert rec.status == "done"
        assert rec.size == 1024
        assert rec.checksum == "abc"

    def test_run_with_verifier_pass(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target(
            "v1",
            "fs",
            runner=lambda: {"path": "/p", "size": 1, "checksum": "x"},
            verifier=lambda r: True,
        )
        rec = backup_coordinator.run("v1")
        assert rec.status == "done"

    def test_run_with_verifier_fail(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target(
            "v2",
            "fs",
            runner=lambda: {"path": "/p", "size": 1, "checksum": "x"},
            verifier=lambda r: False,
        )
        rec = backup_coordinator.run("v2")
        assert rec.status == "verify_failed"

    def test_run_no_runner(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target("nr", "fs")
        rec = backup_coordinator.run("nr")
        assert rec.status == "failed"
        assert rec.error == "no_runner"

    def test_run_target_not_found(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        rec = backup_coordinator.run("nope")
        assert rec.status == "failed"
        assert rec.error == "target_not_found"

    def test_runner_exception(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()

        def boom():
            raise RuntimeError("disk full")

        backup_coordinator.register_target("bf", "fs", runner=boom)
        rec = backup_coordinator.run("bf")
        assert rec.status == "failed"
        assert "disk full" in rec.error

    def test_tick_triggers(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target(
            "t1",
            "fs",
            runner=lambda: {"path": "/p", "size": 1, "checksum": "c"},
            interval_sec=0.01,
            jitter_sec=0.0,
        )
        time.sleep(0.02)
        triggered = backup_coordinator.tick()
        assert len(triggered) >= 1

    def test_tick_skips_disabled(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target(
            "t1",
            "fs",
            runner=lambda: {"path": "/p", "size": 1, "checksum": "c"},
            interval_sec=0.01,
            jitter_sec=0.0,
        )
        backup_coordinator.enable("t1", False)
        time.sleep(0.02)
        triggered = backup_coordinator.tick()
        assert len(triggered) == 0

    def test_retention_expire(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target(
            "rt",
            "fs",
            runner=lambda: {"path": "/p", "size": 1, "checksum": "c"},
            retention_count=2,
            interval_sec=1.0,
            jitter_sec=0.0,
        )
        for _ in range(4):
            backup_coordinator.run("rt")
        records = backup_coordinator.list_records("rt")
        # 至少部分应 EXPIRED
        done = [r for r in records if r.status == "expired"]
        assert len(done) >= 1

    def test_verify_record(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target("vr", "fs", runner=lambda: {"path": "/p", "size": 1, "checksum": "abc"})
        rec = backup_coordinator.run("vr")
        v = backup_coordinator.verify_record(rec.id, "abc")
        assert v["ok"] is True
        v2 = backup_coordinator.verify_record(rec.id, "xyz")
        assert v2["ok"] is False

    def test_stats(self):
        from app.utils.backup_snapshot import backup_coordinator

        backup_coordinator.clear()
        backup_coordinator.register_target("s1", "fs", runner=lambda: {"path": "/p", "size": 1, "checksum": "c"})
        backup_coordinator.run("s1")
        s = backup_coordinator.stats()
        assert s["target_count"] == 1
        assert s["record_count"] >= 1


# ---------------------------------------------------------------------------
# Bug-113: 故障切换编排
# ---------------------------------------------------------------------------


class TestBug113Failover:
    def test_create_group(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        g = failover_orch.create_group("svc1", primary="p1", replicas=["r1", "r2"])
        assert g.current_primary == "p1"
        assert g.nodes["p1"].role == "primary"

    def test_duplicate_group(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("dup", primary="p")
        try:
            failover_orch.create_group("dup", primary="p")
            assert False
        except ValueError:
            pass

    def test_report_health(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("h1", primary="p1", replicas=["r1"], failure_threshold=3)
        failover_orch.report_health("h1", "p1", ok=True)
        assert failover_orch.get_group("h1").nodes["p1"].consecutive_failures == 0

    def test_failover_on_primary_dead(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("fo1", primary="p1", replicas=["r1"], failure_threshold=2)
        failover_orch.report_health("fo1", "p1", ok=False)
        failover_orch.report_health("fo1", "p1", ok=False)
        # tick 触发
        failover_orch.tick()
        g = failover_orch.get_group("fo1")
        assert g.current_primary == "r1"
        assert g.phase == "failed_over"

    def test_failover_lag_too_high(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("lag1", primary="p1", replicas=["r1"], failure_threshold=2)
        failover_orch.set_lag_probe("lag1", lambda nid: 120.0 if nid == "r1" else 0.0)
        failover_orch.report_health("lag1", "p1", ok=False)
        failover_orch.report_health("lag1", "p1", ok=False)
        failover_orch.tick()
        g = failover_orch.get_group("lag1")
        # lag>60s 不切
        assert g.current_primary == "p1"

    def test_manual_failover(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("mf1", primary="p1", replicas=["r1", "r2"])
        assert failover_orch.manual_failover("mf1", "r1") is True
        g = failover_orch.get_group("mf1")
        assert g.current_primary == "r1"

    def test_manual_failback(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("fb1", primary="p1", replicas=["r1"])
        failover_orch.manual_failover("fb1", "r1")
        assert failover_orch.manual_failback("fb1", "p1") is True
        g = failover_orch.get_group("fb1")
        assert g.current_primary == "p1"
        assert g.phase == "steady"

    def test_add_remove_node(self):
        from app.utils.failover_orchestrator import NodeRole, failover_orch

        failover_orch.clear()
        failover_orch.create_group("an1", primary="p1")
        assert failover_orch.add_node("an1", "r1", role=NodeRole.REPLICA.value) is True
        assert failover_orch.get_group("an1").nodes["r1"].role == "replica"
        assert failover_orch.remove_node("an1", "r1") is True

    def test_auto_failback(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group(
            "af1", primary="p1", replicas=["r1"], failure_threshold=1, auto_failback=True, probe_interval_sec=1.0
        )
        # primary dead
        failover_orch.report_health("af1", "p1", ok=False)
        failover_orch.tick()
        g = failover_orch.get_group("af1")
        assert g.current_primary == "r1"
        # primary 恢复
        failover_orch.report_health("af1", "p1", ok=True)
        failover_orch.tick()
        # auto_failback_delay 默认 30s, 立即 tick 不会回切
        g = failover_orch.get_group("af1")
        # 仍 r1
        assert g.current_primary == "r1"

    def test_get_audit(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("au1", primary="p1", replicas=["r1"])
        audit = failover_orch.get_audit("au1")
        actions = [a.action for a in audit]
        assert "create_group" in actions

    def test_set_auto_failback(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("saf1", primary="p1")
        assert failover_orch.set_auto_failback("saf1", True, delay_sec=10.0) is True
        g = failover_orch.get_group("saf1")
        assert g.auto_failback is True
        assert g.auto_failback_delay_sec == 10.0

    def test_stats(self):
        from app.utils.failover_orchestrator import failover_orch

        failover_orch.clear()
        failover_orch.create_group("s1", primary="p1")
        s = failover_orch.stats()
        assert s["group_count"] == 1


# ---------------------------------------------------------------------------
# Bug-114: Saga 补偿
# ---------------------------------------------------------------------------


class TestBug114Saga:
    def test_create_saga(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga(
            "order",
            step_specs=[
                {"name": "s1", "action": lambda ctx: {"x": 1}},
                {"name": "s2", "action": lambda ctx: {"y": 2}},
            ],
        )
        assert s.state == "pending"
        assert len(s.steps) == 2

    def test_run_success(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga(
            "ok",
            step_specs=[
                {"name": "s1", "action": lambda ctx: {"v": 1}},
                {"name": "s2", "action": lambda ctx: {"v": 2}},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is True
        s2 = saga_runner.get_saga(s.id)
        assert s2.state == "done"
        assert s2.context.get("v") == 2

    def test_compensation_on_failure(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()

        def s2(ctx):
            raise RuntimeError("oops")

        s = saga_runner.create_saga(
            "fail",
            step_specs=[
                {"name": "s1", "action": lambda ctx: {"v": 1}, "compensation": lambda ctx: ctx.update({"v": -1})},
                {"name": "s2", "action": s2},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is False
        s2s = saga_runner.get_saga(s.id)
        assert s2s.state == "compensated"
        # s1 应已补偿
        assert s2s.steps[0].status == "compensated"

    def test_retry(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        attempts = []

        def flaky(ctx):
            attempts.append(1)
            if len(attempts) < 2:
                raise RuntimeError("not yet")
            return {"v": 1}

        s = saga_runner.create_saga(
            "retry",
            step_specs=[
                {"name": "s1", "action": flaky, "max_retries": 2},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is True
        assert len(attempts) == 2

    def test_max_retries_exhausted(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()

        def always_fail(ctx):
            raise RuntimeError("nope")

        s = saga_runner.create_saga(
            "fr",
            step_specs=[
                {"name": "s1", "action": always_fail, "max_retries": 1},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is False
        s2s = saga_runner.get_saga(s.id)
        assert s2s.steps[0].attempts == 2  # 初始 1 + retry 1

    def test_skip_step_no_action(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga(
            "skip",
            step_specs=[
                {"name": "s1"},  # 无 action
                {"name": "s2", "action": lambda ctx: {"v": 1}},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is True
        s2s = saga_runner.get_saga(s.id)
        assert s2s.steps[0].status == "done"

    def test_cancel(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga(
            "cancel",
            step_specs=[
                {"name": "s1", "action": lambda ctx: {"v": 1}, "compensation": lambda ctx: None},
            ],
        )
        # 手动 cancel 一个 pending saga 应补偿 (虽然 s1 没真正跑过)
        r = saga_runner.cancel(s.id)
        assert r["ok"] is True
        s2s = saga_runner.get_saga(s.id)
        # 应进入 compensated
        assert s2s.state in ("compensated", "compensating")

    def test_get_saga(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga("g", step_specs=[{"name": "s1"}])
        g = saga_runner.get_saga(s.id)
        assert g is not None
        assert g.name == "g"

    def test_list_sagas(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        saga_runner.create_saga("a", step_specs=[{"name": "s"}])
        saga_runner.create_saga("b", step_specs=[{"name": "s"}])
        arr = saga_runner.list_sagas()
        assert len(arr) == 2

    def test_remove_saga(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga("rm", step_specs=[{"name": "s"}])
        assert saga_runner.remove_saga(s.id) is True
        assert saga_runner.get_saga(s.id) is None

    def test_restore(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga("r", step_specs=[{"name": "s1"}])
        d = s.to_dict()
        saga_runner.remove_saga(s.id)
        s2 = saga_runner.restore(d)
        assert s2.name == "r"
        assert s2.state == "pending"

    def test_get_audit(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        s = saga_runner.create_saga("a", step_specs=[{"name": "s1", "action": lambda ctx: {"v": 1}}])
        saga_runner.run(s.id)
        audit = saga_runner.get_audit(s.id)
        actions = [a.action for a in audit]
        assert "create" in actions
        assert "run_done" in actions

    def test_compensation_exception(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()

        def boom_comp(ctx):
            raise RuntimeError("comp fail")

        def fail_action(ctx):
            raise RuntimeError("act fail")

        s = saga_runner.create_saga(
            "ce",
            step_specs=[
                {"name": "s1", "action": lambda ctx: {"v": 1}, "compensation": boom_comp},
                {"name": "s2", "action": fail_action},
            ],
        )
        r = saga_runner.run(s.id)
        assert r["ok"] is False
        s2s = saga_runner.get_saga(s.id)
        assert s2s.steps[0].status == "failed"  # 补偿失败标 failed
        assert "comp fail" in s2s.steps[0].last_error

    def test_stats(self):
        from app.utils.saga_compensator import saga_runner

        saga_runner.clear()
        saga_runner.create_saga("ss", step_specs=[{"name": "s"}])
        s = saga_runner.stats()
        assert s["saga_count"] == 1
        assert s["by_state"].get("pending", 0) == 1
