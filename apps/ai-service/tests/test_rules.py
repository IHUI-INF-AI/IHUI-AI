"""rules 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:monkeypatch 掉 `app.routers.rules.rules_engine` 单例,
直接调用各端点函数,覆盖成功 / 404 / 500 降级 / 请求体校验。
不依赖文件系统 / Redis / LLM。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.rules import (
    AutoGenerateBody,
    LearnFeedbackBody,
    PredictEffectBody,
    ResolveConflictsBody,
    RuleCreateBody,
    RuleMatchBody,
    RuleTestBody,
    RuleUpdateBody,
    auto_generate_rules,
    build_knowledge_graph,
    create_rule,
    delete_rule,
    get_rule,
    learn_feedback,
    list_rules,
    match_rules,
    predict_effect,
    resolve_conflicts,
    test_rule as endpoint_test_rule,  # 别名,避免被 pytest 当作 fixture 参数收集
    update_rule,
)
from app.services.rules_engine import Rule


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


class _FakeEngine:
    """可编程 fake rules_engine,记录调用参数。"""

    def __init__(self) -> None:
        self.list_result = []
        self.create_result: Rule | None = None
        self.get_result: Rule | None = None
        self.update_result: Rule | None = None
        self.delete_result = True
        self.test_result = {"matched": True}
        self.apply_result = {"rules": [], "suffix": ""}
        self.calls: list[tuple] = []

    # 同步方法
    def list_rules(self):
        self.calls.append(("list_rules",))
        return self.list_result

    def create(self, data):
        self.calls.append(("create", data))
        return self.create_result

    def get(self, rule_id):
        self.calls.append(("get", rule_id))
        return self.get_result

    def update(self, rule_id, data):
        self.calls.append(("update", rule_id, data))
        return self.update_result

    def delete(self, rule_id):
        self.calls.append(("delete", rule_id))
        return self.delete_result

    def test(self, rule_id, message):
        self.calls.append(("test", rule_id, message))
        return self.test_result

    def apply(self, message, scope):
        self.calls.append(("apply", message, scope))
        return self.apply_result

    # 异步方法
    async def auto_generate_rules(self, user_id):
        self.calls.append(("auto_generate_rules", user_id))
        return [{"id": f"draft-{user_id}", "name": "草稿"}]

    async def _auto_resolve_conflicts(self, conflicts):
        self.calls.append(("_auto_resolve_conflicts", conflicts))
        return [{"kept": conflicts[0]}]

    async def _build_knowledge_graph(self, scope):
        self.calls.append(("_build_knowledge_graph", scope))
        return {"nodes": [], "edges": []}

    async def predict_effect(self, rule_id, message):
        self.calls.append(("predict_effect", rule_id, message))
        return {"predicted": "impact"}

    async def record_learn_feedback(self, rule_id, feedback, accepted):
        self.calls.append(("record_learn_feedback", rule_id, feedback, accepted))
        return True


@pytest.fixture
def engine(monkeypatch):
    fake = _FakeEngine()
    monkeypatch.setattr("app.routers.rules.rules_engine", fake)
    return fake


def _rule(rule_id: str = "r1") -> Rule:
    return Rule(id=rule_id, name=f"规则-{rule_id}", content="禁止 xx")


# ---------------------------------------------------------------------------
# GET /rules
# ---------------------------------------------------------------------------


async def test_list_rules_success(engine):
    engine.list_result = [_rule("r1"), _rule("r2")]
    resp = await list_rules()
    assert resp["code"] == 0
    assert resp["data"]["total"] == 2
    assert [r["id"] for r in resp["data"]["rules"]] == ["r1", "r2"]
    assert engine.calls == [("list_rules",)]


async def test_list_rules_empty(engine):
    resp = await list_rules()
    assert resp["code"] == 0
    assert resp["data"]["rules"] == []
    assert resp["data"]["total"] == 0


# ---------------------------------------------------------------------------
# POST /rules
# ---------------------------------------------------------------------------


async def test_create_rule_success(engine):
    engine.create_result = _rule("r-new")
    body = RuleCreateBody(name="新规则", content="c", priority=80)
    resp = await create_rule(body)
    assert resp["code"] == 0
    assert resp["data"]["id"] == "r-new"
    # model_dump 全量字段传给 engine.create
    _, data = engine.calls[0]
    assert data["name"] == "新规则"
    assert data["priority"] == 80
    assert data["enabled"] is True
    assert data["matchType"] == "always"


def test_rule_create_body_validation():
    with pytest.raises(ValidationError):
        RuleCreateBody(name="", content="c")  # name min_length=1
    with pytest.raises(ValidationError):
        RuleCreateBody(name="x", content="")  # content min_length=1
    with pytest.raises(ValidationError):
        RuleCreateBody(name="x", content="c", priority=-1)  # ge=0
    with pytest.raises(ValidationError):
        RuleCreateBody(name="x", content="c", priority=101)  # le=100


# ---------------------------------------------------------------------------
# POST /rules/auto-generate / resolve-conflicts / GET knowledge-graph
# ---------------------------------------------------------------------------


async def test_auto_generate_success(engine):
    resp = await auto_generate_rules(AutoGenerateBody(user_id="u1"))
    assert resp["code"] == 0
    assert resp["data"][0]["id"] == "draft-u1"


async def test_auto_generate_error(engine, monkeypatch):
    async def boom(user_id):
        raise RuntimeError("llm down")

    monkeypatch.setattr(engine, "auto_generate_rules", boom)
    resp = await auto_generate_rules(AutoGenerateBody(user_id="u1"))
    assert resp["code"] == 500
    assert "llm down" in resp["message"]
    assert resp["data"] is None


async def test_resolve_conflicts_success(engine):
    conflicts = [{"id": "a", "priority": 10}]
    resp = await resolve_conflicts(ResolveConflictsBody(conflicts=conflicts))
    assert resp["code"] == 0
    assert resp["data"] == [{"kept": {"id": "a", "priority": 10}}]


async def test_resolve_conflicts_error(engine, monkeypatch):
    async def boom(conflicts):
        raise ValueError("bad conflicts")

    monkeypatch.setattr(engine, "_auto_resolve_conflicts", boom)
    resp = await resolve_conflicts(ResolveConflictsBody(conflicts=[{}]))
    assert resp["code"] == 500
    assert "bad conflicts" in resp["message"]


async def test_build_knowledge_graph_success(engine):
    resp = await build_knowledge_graph("global")
    assert resp["code"] == 0
    assert resp["data"] == {"nodes": [], "edges": []}
    assert engine.calls[-1] == ("_build_knowledge_graph", "global")


async def test_build_knowledge_graph_default_scope(engine):
    resp = await build_knowledge_graph()
    assert resp["code"] == 0
    assert engine.calls[-1] == ("_build_knowledge_graph", None)


async def test_build_knowledge_graph_error(engine, monkeypatch):
    async def boom(scope):
        raise Exception("embedding fail")

    monkeypatch.setattr(engine, "_build_knowledge_graph", boom)
    resp = await build_knowledge_graph()
    assert resp["code"] == 500
    assert "embedding fail" in resp["message"]


# ---------------------------------------------------------------------------
# GET /rules/:id
# ---------------------------------------------------------------------------


async def test_get_rule_success(engine):
    engine.get_result = _rule("r1")
    resp = await get_rule("r1")
    assert resp["code"] == 0
    assert resp["data"]["id"] == "r1"


async def test_get_rule_404(engine):
    engine.get_result = None
    with pytest.raises(HTTPException) as exc:
        await get_rule("missing")
    assert exc.value.status_code == 404
    assert "missing" in exc.value.detail


# ---------------------------------------------------------------------------
# PATCH /rules/:id
# ---------------------------------------------------------------------------


async def test_update_rule_success(engine):
    engine.update_result = _rule("r1")
    body = RuleUpdateBody(name="改名", scope=None, priority=90)
    resp = await update_rule("r1", body)
    assert resp["code"] == 0
    assert resp["data"]["id"] == "r1"
    # exclude_none=True: scope=None 被剔除
    _, rule_id, data = engine.calls[0]
    assert rule_id == "r1"
    assert data == {"name": "改名", "priority": 90}


async def test_update_rule_404(engine):
    engine.update_result = None
    with pytest.raises(HTTPException) as exc:
        await update_rule("missing", RuleUpdateBody(name="x"))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /rules/:id
# ---------------------------------------------------------------------------


async def test_delete_rule_success(engine):
    resp = await delete_rule("r1")
    assert resp["code"] == 0
    assert resp["data"] == {"id": "r1", "deleted": True}


async def test_delete_rule_404(engine):
    engine.delete_result = False
    with pytest.raises(HTTPException) as exc:
        await delete_rule("missing")
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# POST /rules/:id/test
# ---------------------------------------------------------------------------


async def test_test_rule_success(engine):
    resp = await endpoint_test_rule("r1", RuleTestBody(message="hello"))
    assert resp["code"] == 0
    assert resp["data"] == {"matched": True}
    assert engine.calls[-1] == ("test", "r1", "hello")


def test_rule_test_body_validation():
    with pytest.raises(ValidationError):
        RuleTestBody(message="")


# ---------------------------------------------------------------------------
# POST /rules/:id/predict-effect / learn-feedback
# ---------------------------------------------------------------------------


async def test_predict_effect_success(engine):
    resp = await predict_effect("r1", PredictEffectBody(dry_run_message="m"))
    assert resp["code"] == 0
    assert resp["data"] == {"predicted": "impact"}


async def test_predict_effect_error(engine, monkeypatch):
    async def boom(rule_id, message):
        raise RuntimeError("no data")

    monkeypatch.setattr(engine, "predict_effect", boom)
    resp = await predict_effect("r1", PredictEffectBody())
    assert resp["code"] == 500
    assert "no data" in resp["message"]


async def test_learn_feedback_success(engine):
    resp = await learn_feedback("r1", LearnFeedbackBody(feedback="好", accepted=True))
    assert resp["code"] == 0
    assert resp["data"] == {"ok": True}
    assert engine.calls[-1] == ("record_learn_feedback", "r1", "好", True)


async def test_learn_feedback_error(engine, monkeypatch):
    async def boom(rule_id, feedback, accepted):
        raise Exception("store fail")

    monkeypatch.setattr(engine, "record_learn_feedback", boom)
    resp = await learn_feedback("r1", LearnFeedbackBody(feedback="f", accepted=False))
    assert resp["code"] == 500
    assert "store fail" in resp["message"]


# ---------------------------------------------------------------------------
# POST /rules/match
# ---------------------------------------------------------------------------


async def test_match_rules_success(engine):
    engine.apply_result = {"rules": [{"id": "r1"}], "suffix": "xx"}
    resp = await match_rules(RuleMatchBody(message="msg", scope="agent"))
    assert resp["code"] == 0
    assert resp["data"] == {"rules": [{"id": "r1"}], "suffix": "xx"}
    assert engine.calls[-1] == ("apply", "msg", "agent")


async def test_match_rules_default_scope(engine):
    await match_rules(RuleMatchBody(message="msg"))
    assert engine.calls[-1] == ("apply", "msg", None)


def test_rule_match_body_validation():
    with pytest.raises(ValidationError):
        RuleMatchBody(message="")
