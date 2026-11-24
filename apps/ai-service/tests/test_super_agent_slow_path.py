# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RP-42 超工慢路径判定端点测试(POST /api/super-agent/slow-path/judge)。

覆盖:200 判定回路(prompt 组装含请求者/启用规则/上下文、出参完整 Assessment + 模型身份)、
批量上限 422、403 主体不在 requesters、502 上游失败、502 响应形状不符
(长度/集合/词表/置信度区间/规则条目/direction/字段类型)、504 超时(含超时配置夹取)、
预算硬停 429、stub 503、record_usage 记账;纯判据 build/parse 直测。

隔离(AGENTS §5):独立 app 只挂本 router、llm_gateway.complete 与预算器全 monkeypatch,
零真实模型/零生产库;参照 test_recap_handoff 的同型纪律。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import require_request_user_id
from app.routers import super_agent_slow as slow_router

# asyncio_mode=auto(pyproject):async 用例自动接管,无需逐条标记


def _app(user_id: str | None = "user-1") -> FastAPI:
    app = FastAPI()
    app.include_router(slow_router.router, prefix="/api")
    if user_id is not None:
        app.dependency_overrides[require_request_user_id] = lambda: user_id
    return app


async def _client(app: FastAPI):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _result(
    content: str,
    *,
    model: str = "gpt-4o-mini",
    stub: bool = False,
    error: str | None = None,
    usage: dict[str, int] | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "content": content,
        "model": model,
        "usage": usage if usage is not None else {"prompt_tokens": 100, "completion_tokens": 20},
        "stub": stub,
    }
    if error:
        out["error"] = error
    return out


def _budget(allowed: bool = True, reason: str = "", degrade: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(allowed=allowed, reason=reason, degrade_to_model=degrade)


def _items(n: int = 2, requesters: list[str] | None = None) -> list[dict]:
    rq = requesters or ["user-1"]
    return [
        {
            "id": f"e{i}",
            "text": f"消息内容 {i}",
            "observed_at": 1730000000000 + i,
            "requesters": rq,
            "enabled_rules": ["bug-fix", "feature-request"],
            "companions": [],
            "related_tickets": [],
            "thread_window": [],
        }
        for i in range(1, n + 1)
    ]


@pytest.fixture(autouse=True)
def _allow_budget(monkeypatch):
    """默认预算放行；个别用例再覆盖成拒绝/异常。"""

    async def ok(pillar: str, tokens: int):
        return _budget()

    monkeypatch.setattr(slow_router.llm_budget_governor, "check_budget", ok)


def _rule_assessments(*, hit: str = "bug-fix") -> list[dict[str, Any]]:
    """与 _items 的 enabled_rules 一一对应：每条规则恰一项。"""
    return [
        {"rule_id": "bug-fix", "matched": hit == "bug-fix", "reason": "线上报障"},
        {"rule_id": "feature-request", "matched": hit == "feature-request", "reason": "不是新功能"},
    ]


def _assessment(id: str, decision: str = "accept", **over: Any) -> dict[str, Any]:
    """完整 Assessment 的合法样例；按需覆写造坏形状。"""
    base: dict[str, Any] = {
        "id": id,
        "decision": decision,
        "confidence": 0.9,
        "rule_assessments": _rule_assessments(hit="bug-fix" if decision == "accept" else ""),
        "direction": {
            "implementation_requested": True,
            "target_basis": "specified",
            "requires_design_decision": False,
            "evidence": "明确要求修登录页",
        },
        "intent_evidence": "谁管一下 = 请求接单" if decision == "accept" else "",
        "title": "修复登录页" if decision == "accept" else "",
        "scope": "登录页 500" if decision == "accept" else "",
        "worktree_name": None,
        "reason": "理由",
    }
    base.update(over)
    return base


class TestParseJudgeResponse:
    def test_等长合法Assessment含完整字段(self):
        ids = ["a", "b"]
        raw = json.dumps([_assessment("a", "accept"), _assessment("b", "ignore")])
        rows = slow_router.parse_judge_response(raw, ids)
        assert [r["decision"] for r in rows] == ["accept", "ignore"]
        assert [r["confidence"] for r in rows] == [0.9, 0.9]
        assert rows[0]["rule_assessments"] == [
            {"rule_id": "bug-fix", "matched": True, "reason": "线上报障"},
            {"rule_id": "feature-request", "matched": False, "reason": "不是新功能"},
        ]
        assert rows[0]["direction"] == {
            "implementation_requested": True,
            "target_basis": "specified",
            "requires_design_decision": False,
            "evidence": "明确要求修登录页",
        }
        assert rows[0]["intent_evidence"] == "谁管一下 = 请求接单"
        assert rows[0]["title"] == "修复登录页"
        assert rows[0]["scope"] == "登录页 500"
        assert rows[0]["worktree_name"] is None

    def test_长度不符拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(json.dumps([_assessment("a")]), ["a", "b"])

    def test_id集合不符拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(
                json.dumps([_assessment("a"), _assessment("c")]), ["a", "b"]
            )

    def test_非法decision拒绝与非json拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(json.dumps([_assessment("a", "maybe")]), ["a"])
        with pytest.raises(ValueError):
            slow_router.parse_judge_response("对不起我不输出JSON", ["a"])

    def test_置信度必须存在且在区间内(self):
        # 缺 confidence 不补默认值 ⇒ fail-closed
        row = _assessment("a")
        del row["confidence"]
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(json.dumps([row]), ["a"])
        for bad in (-0.1, 1.1, "0.9", None, True):
            with pytest.raises(ValueError):
                slow_router.parse_judge_response(
                    json.dumps([_assessment("a", confidence=bad)]), ["a"]
                )

    def test_规则条目形状必须合法(self):
        # 非数组 / 条目非对象 / rule_id 非串 / matched 非布尔 / reason 非串 ⇒ 全拒
        for bad in (
            "nope",
            [{"matched": True, "reason": "x"}],
            [{"rule_id": 1, "matched": True, "reason": "x"}],
            [{"rule_id": "bug-fix", "matched": "yes", "reason": "x"}],
            [{"rule_id": "bug-fix", "matched": True, "reason": 2}],
        ):
            with pytest.raises(ValueError):
                slow_router.parse_judge_response(
                    json.dumps([_assessment("a", rule_assessments=bad)]), ["a"]
                )

    def test_direction形状必须合法(self):
        # 缺字段 / 非对象 / 词表越界 / evidence 非串 ⇒ 全拒
        for bad in (
            None,
            "nope",
            {
                "implementation_requested": True,
                "target_basis": "guess",
                "requires_design_decision": False,
                "evidence": "x",
            },
            {
                "implementation_requested": "yes",
                "target_basis": "specified",
                "requires_design_decision": False,
                "evidence": "x",
            },
            {
                "implementation_requested": True,
                "target_basis": "specified",
                "requires_design_decision": False,
                "evidence": 1,
            },
        ):
            with pytest.raises(ValueError):
                slow_router.parse_judge_response(
                    json.dumps([_assessment("a", direction=bad)]), ["a"]
                )

    def test_文本字段类型非法拒绝(self):
        for key in ("intent_evidence", "title", "scope"):
            with pytest.raises(ValueError):
                slow_router.parse_judge_response(
                    json.dumps([_assessment("a", **{key: 123})]), ["a"]
                )
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(
                json.dumps([_assessment("a", worktree_name=123)]), ["a"]
            )


class TestBuildJudgePrompt:
    def test_prompt点名请求者启用规则与条数(self):
        items = _items(2)
        items[0]["companions"] = [{"id": "c1", "text": "顺带把注册也修了"}]
        items[0]["related_tickets"] = [
            {
                "id": "tk-1",
                "title": "登录页修复",
                "scope": "登录页 500",
                "strength": "record",
                "stage": "worker",
            }
        ]
        items[0]["thread_window"] = [
            {"actor_id": "user-1", "from_bot": False, "addressed": True, "text": "登录页 500 了"}
        ]
        prompt = slow_router.build_judge_prompt(items, "user-1")
        assert "长度必须恰为 2" in prompt
        assert "请求者 [user-1]" in prompt
        assert "启用规则 [bug-fix、feature-request]" in prompt
        assert "confidence" in prompt
        assert "rule_assessments" in prompt
        assert "target_basis" in prompt
        # 上下文三件套进 prompt
        assert "批内同伴: c1=顺带把注册也修了" in prompt
        assert "相关工单: tk-1[worker/record]=登录页修复" in prompt
        assert "线程窗口: user-1: 登录页 500 了" in prompt

    def test_理由被截断到上限(self):
        rows = slow_router.parse_judge_response(
            json.dumps([_assessment("a", reason="字" * 500)]), ["a"]
        )
        assert len(rows[0]["reason"]) == 200


def test_超时配置按30到600夹取(monkeypatch):
    monkeypatch.setenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S", "5")
    assert slow_router._judge_timeout_seconds() == 30.0
    monkeypatch.setenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S", "900")
    assert slow_router._judge_timeout_seconds() == 600.0
    monkeypatch.setenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S", "120")
    assert slow_router._judge_timeout_seconds() == 120.0
    monkeypatch.setenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S", "not-a-number")
    assert slow_router._judge_timeout_seconds() == 120.0
    monkeypatch.delenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S")
    assert slow_router._judge_timeout_seconds() == 120.0


def _patch_complete(monkeypatch, fn):
    """判定通道统一走 llm_gateway.complete（复用统一调度面，不新造 HTTP 客户端）。"""
    monkeypatch.setattr(slow_router.llm_gateway, "complete", fn)


async def test_200_判定回路(monkeypatch):
    seen: dict[str, Any] = {}

    async def fake_complete(**kwargs):
        seen["prompt"] = kwargs["messages"][0]["content"]
        seen["model"] = kwargs["model"]
        seen["max_tokens"] = kwargs["max_tokens"]
        return _result(
            json.dumps(
                [
                    _assessment("e1", "accept", reason="线上故障求助"),
                    _assessment("e2", "ignore", reason="系统通知"),
                ]
            )
        )

    _patch_complete(monkeypatch, fake_complete)
    recorded: list[tuple[str, str, int, int, str]] = []

    async def record(**kwargs):
        recorded.append(
            (
                kwargs["pillar"],
                kwargs["model"],
                kwargs["input_tokens"],
                kwargs["output_tokens"],
                kwargs["action"],
            )
        )

    monkeypatch.setattr(slow_router.llm_budget_governor, "record_usage", record)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 200
    payload = r.json()["data"]
    assert payload["model"] == "gpt-4o-mini"
    e1 = payload["verdicts"]["e1"]
    assert e1["decision"] == "accept"
    assert e1["confidence"] == 0.9
    assert e1["rule_assessments"][0] == {
        "rule_id": "bug-fix",
        "matched": True,
        "reason": "线上报障",
    }
    assert e1["direction"]["target_basis"] == "specified"
    assert e1["intent_evidence"] == "谁管一下 = 请求接单"
    assert e1["title"] == "修复登录页"
    assert e1["scope"] == "登录页 500"
    assert e1["worktree_name"] is None
    assert payload["verdicts"]["e2"]["decision"] == "ignore"
    assert "e1" in seen["prompt"]
    assert seen["max_tokens"] == slow_router._MAX_OUTPUT_TOKENS
    assert recorded == [("subagent", "gpt-4o-mini", 100, 20, "super_agent_slow_path")]


async def test_403_主体不在requesters(monkeypatch):
    async def never_called(**kwargs):  # pragma: no cover - 必须不被调用
        raise AssertionError("资格不符不得触模型")

    _patch_complete(monkeypatch, never_called)
    async with await _client(_app("user-1")) as client:
        r = await client.post(
            "/api/super-agent/slow-path/judge",
            json={"items": _items(1, requesters=["someone-else"])},
        )
    assert r.status_code == 403


async def test_422_批量超上限(monkeypatch):
    async def fake(**kwargs):  # pragma: no cover - 必须不被调用
        raise AssertionError("超上限不得触模型")

    _patch_complete(monkeypatch, fake)
    async with await _client(_app("user-1")) as client:
        r = await client.post(
            "/api/super-agent/slow-path/judge",
            json={"items": _items(21)},
        )
    assert r.status_code == 422


async def test_502_上游失败与形状不符(monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("provider down")

    _patch_complete(monkeypatch, boom)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502

    async def garbage(**kwargs):
        return _result("抱歉,我今天不想输出 JSON")

    _patch_complete(monkeypatch, garbage)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502
    assert "rejected" in r.json()["detail"]


async def test_502_置信度缺失不补默认(monkeypatch):
    async def missing_conf(**kwargs):
        rows = [_assessment("e1"), _assessment("e2", "ignore")]
        del rows[0]["confidence"]
        return _result(json.dumps(rows))

    _patch_complete(monkeypatch, missing_conf)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502
    assert "confidence" in r.json()["detail"]


async def test_502_规则条目或direction缺失不补默认(monkeypatch):
    async def missing_rules(**kwargs):
        rows = [_assessment("e1"), _assessment("e2", "ignore")]
        del rows[0]["rule_assessments"]
        return _result(json.dumps(rows))

    _patch_complete(monkeypatch, missing_rules)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502
    assert "rule_assessments" in r.json()["detail"]

    async def missing_direction(**kwargs):
        rows = [_assessment("e1"), _assessment("e2", "ignore")]
        del rows[0]["direction"]
        return _result(json.dumps(rows))

    _patch_complete(monkeypatch, missing_direction)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502
    assert "direction" in r.json()["detail"]


async def test_504_超时(monkeypatch):
    async def slow(**kwargs):
        await asyncio.sleep(0.5)
        return _result(json.dumps([_assessment("e1")]))

    _patch_complete(monkeypatch, slow)
    monkeypatch.setattr(slow_router, "_judge_timeout_seconds", lambda: 0.01)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 504


async def test_429_预算硬停不触模型(monkeypatch):
    async def denied(pillar: str, tokens: int):
        return _budget(allowed=False, reason="daily cap")

    monkeypatch.setattr(slow_router.llm_budget_governor, "check_budget", denied)

    async def never_called(**kwargs):  # pragma: no cover - 必须不被调用
        raise AssertionError("预算拒绝不得触模型")

    _patch_complete(monkeypatch, never_called)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 429
    assert "budget" in r.json()["detail"]


async def test_预算估算取偏大值含输出上限(monkeypatch):
    """预算估 token 必须覆盖输出上限，宁可少调也不打穿日额度。"""
    seen: dict[str, int] = {}

    async def capture(pillar: str, tokens: int):
        seen["tokens"] = tokens
        return _budget()

    monkeypatch.setattr(slow_router.llm_budget_governor, "check_budget", capture)

    async def fake_complete(**kwargs):
        return _result(json.dumps([_assessment("e1")]))

    _patch_complete(monkeypatch, fake_complete)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 200
    assert seen["tokens"] >= slow_router._MAX_OUTPUT_TOKENS + 200


async def test_503_stub判定通道按不可用fail_closed(monkeypatch):
    async def stubbed(**kwargs):
        return _result("[]", stub=True)

    _patch_complete(monkeypatch, stubbed)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 503
    assert "stub" in r.json()["detail"]


async def test_502_模型身份缺失fail_closed(monkeypatch):
    async def no_model(**kwargs):
        return _result(json.dumps([_assessment("e1")]), model="")

    _patch_complete(monkeypatch, no_model)
    async with await _client(_app("user-1")) as client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 502
    assert "identity" in r.json()["detail"]


async def test_403_真身份依赖生效_回落dev主体不入白名单即403():
    """不覆盖身份依赖:真 require_request_user_id 跑起来。conftest 开发放行下
    回落单一 dev 身份 ⇒ 它不在 requesters 名单 ⇒ 必须 403,而不是静默放行
    (证明资格判定吃的真是承载层身份,不是请求体自报)。"""
    bare = FastAPI()
    bare.include_router(slow_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=bare), base_url="http://test") as client:
        r = await client.post(
            "/api/super-agent/slow-path/judge",
            json={"items": _items(1, requesters=[uuid.uuid4().hex])},
        )
    assert r.status_code == 403
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
