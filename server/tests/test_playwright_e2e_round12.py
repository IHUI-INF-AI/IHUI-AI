"""Playwright 端到端验证 - 第十二轮 8 项修复 (Bug-107/108/109/110/111/112/113/114)."""

import os
import socket
import sys
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

        def reachable(label, status):
            mark = "PASS" if status < 500 else "FAIL"
            results.append((mark, label, status, "<500"))

        r = page.request.get("http://127.0.0.1:18086/healthz")
        reachable("Bug-107-114 服务存活 /healthz", r.status)
        r = page.request.get("http://127.0.0.1:18086/openapi.json")
        reachable("Bug-107-114 /openapi.json 可生成", r.status)

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

    # Bug-107 LLM Prompt 模板缓存
    try:
        from app.utils.llm_prompt_cache import PromptCache

        pc = PromptCache(max_templates=10, max_renders=20, default_ttl=60.0)
        pc.add_template("e2e_107_greet", 1, "Hello, {name}!")
        pc.add_template("e2e_107_sum", 1, "Sum: {a} + {b}")
        check("Bug-107 模板数 2", pc.stats()["template_count"], 2)
        r1 = pc.render("e2e_107_greet", {"name": "Alice"}, version=1)
        check("Bug-107 第一次 miss", r1["cache_hit"], False)
        check("Bug-107 渲染结果", r1["rendered"], "Hello, Alice!")
        r2 = pc.render("e2e_107_greet", {"name": "Alice"}, version=1)
        check("Bug-107 第二次 hit", r2["cache_hit"], True)
        r3 = pc.render("e2e_107_greet", {"name": "Bob"}, version=1)
        check("Bug-107 不同变量 miss", r3["cache_hit"], False)
        check("Bug-107 Bob 渲染", r3["rendered"], "Hello, Bob!")
        n = pc.invalidate("e2e_107_greet", 1)
        check("Bug-107 失效 >=1 条", n >= 1, True)
        r4 = pc.render("e2e_107_greet", {"name": "Alice"}, version=1)
        check("Bug-107 失效后 miss", r4["cache_hit"], False)
        s = pc.stats()
        check("Bug-107 模板数 2", s["template_count"], 2)
        check("Bug-107 命中率 > 0", s["hit_rate"] > 0, True)
    except Exception as e:
        check("Bug-107 prompt_cache 加载", f"{e!r}", None)

    # Bug-108 LLM Token 预算
    try:
        from app.utils.llm_token_budget import BudgetPolicy, TokenBudgetController

        tbc = TokenBudgetController()
        tbc.set_budget("e2e_108_t1", "gpt-4o-mini", per_minute=100, per_hour=1000, per_day=10000, per_month=100000)
        d1 = tbc.consume("e2e_108_t1", "gpt-4o-mini", 50, request_id="r1")
        check("Bug-108 50 token ok", d1["ok"], True)
        d2 = tbc.consume("e2e_108_t1", "gpt-4o-mini", 80, request_id="r2")
        check("Bug-108 130/100 超限 ok=False", d2["ok"], False)
        # 用 check 拿 per_minute reason
        d_check = tbc.check("e2e_108_t1", "gpt-4o-mini", 200)
        check("Bug-108 限流 reason=per_minute", d_check["reason"], "per_minute")
        tbc.refund("e2e_108_t1", "gpt-4o-mini", 30)
        usage = tbc.get_usage("e2e_108_t1", "gpt-4o-mini")
        check("Bug-108 usage >=4 窗口", len(usage) >= 4, True)
        check("Bug-108 per_minute>0", usage["min"] > 0, True)
        tbc.set_budget("e2e_108_t2", "gpt-4", per_minute=10, per_day=100, policy=BudgetPolicy.QUEUE.value)
        d3 = tbc.check("e2e_108_t2", "gpt-4", 11)
        check("Bug-108 11/10 触发 per_minute 限流", d3["reason"], "per_minute")
        d4 = tbc.apply_policy(d3, tenant_id="e2e_108_t2", model="gpt-4")
        check("Bug-108 队列策略 action=queue", d4["action"], "queue")
    except Exception as e:
        check("Bug-108 token_budget 加载", f"{e!r}", None)

    # Bug-109 向量索引元数据
    try:
        from app.utils.vector_index_meta import VectorIndexMeta

        vim = VectorIndexMeta()
        vim.create("e2e_109_idx1", dimension=768, metric="cosine", index_type="hnsw")
        check("Bug-109 索引存在", vim.get("e2e_109_idx1") is not None, True)
        check("Bug-109 维度", vim.get("e2e_109_idx1").dimension, 768)
        vim.update("e2e_109_idx1", doc_count=1000)
        check("Bug-109 doc_count 1000", vim.get("e2e_109_idx1").doc_count, 1000)
        vim.report_drift("e2e_109_idx1", "doc_count", expected=1000, actual=800)
        vim.mark_state("e2e_109_idx1", "dirty")
        check("Bug-109 漂移后 dirty", vim.get("e2e_109_idx1").state, "dirty")
        vim.start_rebuild("e2e_109_idx1")
        check("Bug-109 重建中", vim.get("e2e_109_idx1").state, "rebuilding")
        vim.finish_rebuild("e2e_109_idx1", new_doc_count=1500)
        check("Bug-109 重建后 healthy", vim.get("e2e_109_idx1").state, "healthy")
        check("Bug-109 重建后 doc_count", vim.get("e2e_109_idx1").doc_count, 1500)
        v = vim.verify("e2e_109_idx1", actual_doc_count=1500, actual_dimension=768)
        check("Bug-109 校验通过", v["ok"], True)
        a = vim.get_audit("e2e_109_idx1")
        check("Bug-109 审计 >=3", len(a) >= 3, True)
    except Exception as e:
        check("Bug-109 vector_index 加载", f"{e!r}", None)

    # Bug-110 数据血缘
    try:
        from app.utils.data_lineage import DataLineage, EdgeKind, NodeKind

        dl = DataLineage()
        dl.add_node("users", NodeKind.TABLE.value)
        dl.add_node("orders", NodeKind.TABLE.value)
        dl.add_node("user_metrics", NodeKind.METRIC.value)
        dl.add_edge("orders", "user_metrics", kind=EdgeKind.DERIVES.value, weight=1)
        dl.add_edge("users", "user_metrics", kind=EdgeKind.DERIVES.value, weight=1)
        check("Bug-110 节点数 3", len(dl.list_nodes()), 3)
        ups = dl.all_upstream("user_metrics")
        check("Bug-110 upstream 含 orders/users", sorted(ups), ["orders", "users"])
        downs = dl.all_downstream("users")
        check("Bug-110 downstream 含 user_metrics", downs, ["user_metrics"])
        impact = dl.impact("users")
        check("Bug-110 impact.all_downstream>=1", len(impact.all_downstream) >= 1, True)
        dl.add_node("a", NodeKind.TABLE.value)
        dl.add_node("b", NodeKind.TABLE.value)
        dl.add_edge("a", "b")
        dl.add_edge("b", "a")
        cycles = dl.find_cycles()
        check("Bug-110 检测到环", len(cycles) > 0, True)
        dot = dl.to_dot()
        check("Bug-110 dot 含 digraph", "digraph" in dot, True)
        check("Bug-110 dot 含 user_metrics", "user_metrics" in dot, True)
    except Exception as e:
        check("Bug-110 data_lineage 加载", f"{e!r}", None)

    # Bug-111 GDPR 删除器
    try:
        from app.utils.gdpr_eraser import GdprEraser

        ge = GdprEraser()
        ge.register_target("users", "user_id", redact_fn=lambda v: "[REDACTED]")
        ge.register_target("user_profiles", "user_id")
        ge.register_executor("users", lambda op, p: 5 if op == "delete" else 0)
        ge.register_executor("user_profiles", lambda op, p: 3 if op == "delete" else 0)
        t1 = ge.erase_user("e2e_111_u1", dry_run=True)
        check("Bug-111 dry_run 状态", t1.status, "dry_run")
        check("Bug-111 dry_run 影响行数", t1.affected_rows, 0)
        t2 = ge.erase_user("e2e_111_u1", dry_run=False)
        check("Bug-111 erase 状态", t2.status, "done")
        check("Bug-111 erase 影响 5+3=8", t2.affected_rows, 8)
        check("Bug-111 erase 表数 2", len(t2.affected_tables), 2)
        v = ge.verify_evidence(t2.id)
        check("Bug-111 evidence verify ok", v["ok"], True)
        ge.register_target("audit_log", "email", redact_fn=lambda v: "***@***")
        t3 = ge.erase_field("audit_log", "email", dry_run=True)
        check("Bug-111 字段级 dry_run", t3.status, "dry_run")
        t4 = ge.erase_time_window("audit_log", "ts_field", 0, 100, dry_run=True)
        check("Bug-111 时间窗 scope", t4.scope, "time_window")
        s = ge.stats()
        check("Bug-111 任务数 4", s["task_count"], 4)
    except Exception as e:
        check("Bug-111 gdpr_eraser 加载", f"{e!r}", None)

    # Bug-112 备份快照
    try:
        from app.utils.backup_snapshot import BackupCoordinator

        bc = BackupCoordinator()
        bc.register_target(
            "e2e_112_db",
            "postgresql",
            runner=lambda: {"path": "snap.db", "size": 1024, "checksum": "h1"},
            verifier=lambda r: True,
            interval_sec=60,
            retention_count=3,
        )
        check("Bug-112 注册成功", bc.get_target("e2e_112_db") is not None, True)
        r1 = bc.run("e2e_112_db", trigger="manual")
        check("Bug-112 手动成功", r1.status, "done")
        check("Bug-112 checksum", r1.checksum, "h1")
        bc2 = BackupCoordinator()
        bc2.register_target(
            "e2e_112_db2",
            "postgresql",
            runner=lambda: {"path": "x.db", "size": 100, "checksum": "h2"},
            verifier=lambda r: False,
            interval_sec=60,
        )
        r2 = bc2.run("e2e_112_db2", trigger="manual")
        check("Bug-112 验证失败", r2.status, "verify_failed")
        bc3 = BackupCoordinator()
        bc3.register_target(
            "e2e_112_db3",
            "postgresql",
            runner=lambda: {"path": "y.db", "size": 10, "checksum": "h3"},
            verifier=lambda r: True,
            interval_sec=0,
            retention_count=2,
            jitter_sec=0,
        )
        bc3.tick()
        recs = bc3.list_records(target="e2e_112_db3")
        check("Bug-112 tick 触发记录", len(recs) >= 1, True)
        for _ in range(4):
            bc3.run("e2e_112_db3", trigger="manual")
        bc3._expire_old("e2e_112_db3")
        recs2 = bc3.list_records(target="e2e_112_db3")
        done_count = sum(1 for r in recs2 if r.status == "done")
        check("Bug-112 老化保留 <=2 条", done_count <= 2, True)
    except Exception as e:
        check("Bug-112 backup_snapshot 加载", f"{e!r}", None)

    # Bug-113 故障切换
    try:
        from app.utils.failover_orchestrator import FailoverOrchestrator

        fo = FailoverOrchestrator()
        fo.create_group("e2e_113_g1", primary="p1", replicas=["r1", "r2"], failure_threshold=2)
        g = fo.get_group("e2e_113_g1")
        check("Bug-113 current=p1", g.current_primary, "p1")
        check("Bug-113 phase=steady", g.phase, "steady")
        fo.report_health("e2e_113_g1", "p1", ok=False)
        fo.report_health("e2e_113_g1", "p1", ok=False)
        fo.tick()
        g2 = fo.get_group("e2e_113_g1")
        check("Bug-113 切流后 primary in [r1,r2]", g2.current_primary in ("r1", "r2"), True)
        check("Bug-113 phase=failed_over", g2.phase, "failed_over")
        fo.manual_failback("e2e_113_g1", "p1")
        g3 = fo.get_group("e2e_113_g1")
        check("Bug-113 手动 failback", g3.current_primary, "p1")
        check("Bug-113 phase=steady", g3.phase, "steady")
        a = fo.get_audit("e2e_113_g1")
        check("Bug-113 审计 >= 3", len(a) >= 3, True)
        actions = {x.action for x in a}
        check("Bug-113 含 failover 审计", "failover" in actions, True)
        check("Bug-113 含 manual_failback 审计", "manual_failback" in actions, True)
    except Exception as e:
        check("Bug-113 failover 加载", f"{e!r}", None)

    # Bug-114 Saga 补偿
    try:
        from app.utils.saga_compensator import SagaRunner

        sr = SagaRunner()

        def step1(ctx):
            ctx["v1"] = 1
            return ctx

        def step2(ctx):
            ctx["v2"] = 2
            return ctx

        saga = sr.create_saga(
            "e2e_114_s1",
            [
                {"name": "s1", "action": step1},
                {"name": "s2", "action": step2},
            ],
        )
        check("Bug-114 创建", saga.state, "pending")
        r = sr.run(saga.id)
        check("Bug-114 成功", r["state"], "done")
        compensated = []

        def step_ok(ctx):
            ctx["a"] = 10
            return ctx

        def step_fail(ctx):
            raise ValueError("biz error")

        def step_comp(ctx):
            compensated.append(ctx)
            return ctx

        saga2 = sr.create_saga(
            "e2e_114_s2",
            [
                {"name": "ok", "action": step_ok, "compensation": step_comp},
                {"name": "fail", "action": step_fail, "compensation": step_comp},
            ],
        )
        r2 = sr.run(saga2.id)
        check("Bug-114 失败后状态", r2["state"], "compensated")
        check("Bug-114 补偿执行 1 次", len(compensated), 1)
        attempts = []

        def flaky(ctx):
            attempts.append(1)
            if len(attempts) < 3:
                raise RuntimeError("transient")
            ctx["ok"] = True
            return ctx

        saga3 = sr.create_saga(
            "e2e_114_s3",
            [
                {"name": "flaky", "action": flaky, "max_retries": 3},
            ],
        )
        r3 = sr.run(saga3.id)
        check("Bug-114 重试后成功", r3["state"], "done")
        check("Bug-114 尝试 3 次", len(attempts), 3)
        saga4 = sr.create_saga("e2e_114_s4", [{"name": "noop"}])
        d = saga4.to_dict()
        check("Bug-114 序列化含 steps", "steps" in d and len(d["steps"]) == 1, True)
        s2 = sr.restore(d)
        check("Bug-114 恢复后 id 一致", s2.id, saga4.id)
        check("Bug-114 恢复后步骤数", len(s2.steps), 1)
    except Exception as e:
        check("Bug-114 saga 加载", f"{e!r}", None)


def _report(results):
    print("\n" + "=" * 60)
    print("Playwright 第十二轮端到端验证报告")
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
