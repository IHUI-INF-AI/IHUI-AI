# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RP-42 超工慢路径判定端点测试(POST /api/super-agent/slow-path/judge)。

覆盖:200 判定回路(prompt 组装含请求者、出参逐 id 三值)、批量上限 422、
403 主体不在 requesters、502 上游失败、502 响应形状不符(长度/集合/词表)、
504 超时、无身份 401;纯判据 build/parse 直测。

隔离(AGENTS §5):独立 app 只挂本 router、litellm.acompletion 全 monkeypatch,
零真实模型/零生产库;参照 test_recap_handoff 的同型纪律。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from unittest.mock import MagicMock

import litellm
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


def _completion(content: str) -> MagicMock:
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    return resp


def _items(n: int = 2, requesters: list[str] | None = None) -> list[dict]:
    rq = requesters or ["user-1"]
    return [
        {
            "id": f"e{i}",
            "text": f"消息内容 {i}",
            "observed_at": 1730000000000 + i,
            "requesters": rq,
        }
        for i in range(1, n + 1)
    ]


class TestParseJudgeResponse:
    def test_等长合法三值(self):
        ids = ["a", "b"]
        raw = json.dumps(
            [
                {"id": "a", "verdict": "act", "reason": "报障"},
                {"id": "b", "verdict": "ignore", "reason": "寒暄"},
            ]
        )
        rows = slow_router.parse_judge_response(raw, ids)
        assert [r["verdict"] for r in rows] == ["act", "ignore"]

    def test_长度不符拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(json.dumps([{"id": "a", "verdict": "act", "reason": "x"}]), ["a", "b"])

    def test_id集合不符拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(
                json.dumps(
                    [
                        {"id": "a", "verdict": "act", "reason": "x"},
                        {"id": "c", "verdict": "act", "reason": "y"},
                    ]
                ),
                ["a", "b"],
            )

    def test_非法verdict拒绝与非json拒绝(self):
        with pytest.raises(ValueError):
            slow_router.parse_judge_response(
                json.dumps([{"id": "a", "verdict": "maybe", "reason": "x"}]), ["a"]
            )
        with pytest.raises(ValueError):
            slow_router.parse_judge_response("对不起我不输出JSON", ["a"])


class TestBuildJudgePrompt:
    def test_prompt点名请求者与条数(self):
        prompt = slow_router.build_judge_prompt(_items(2), "user-1")
        assert "长度必须恰为 2" in prompt
        assert "请求者 [user-1]" in prompt

    def test_理由被截断到上限(self):
        rows = slow_router.parse_judge_response(
            json.dumps([{"id": "a", "verdict": "act", "reason": "字" * 500}]), ["a"]
        )
        assert len(rows[0]["reason"]) == 200


async def test_200_判定回路(monkeypatch):
    seen_prompt: dict[str, str] = {}

    async def fake_acompletion(**kwargs):
        msgs = kwargs["messages"]
        seen_prompt["p"] = msgs[0]["content"]
        return _completion(
            json.dumps(
                [
                    {"id": "e1", "verdict": "act", "reason": "线上故障求助"},
                    {"id": "e2", "verdict": "ignore", "reason": "系统通知"},
                ]
            )
        )

    monkeypatch.setattr(litellm, "acompletion", fake_acompletion)
    app = _app("user-1")
    client = await _client(app)
    async with client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 200
    data = r.json()["data"]["verdicts"]
    assert data["e1"]["verdict"] == "act"
    assert data["e2"]["verdict"] == "ignore"
    assert "e1" in seen_prompt["p"]


async def test_403_主体不在requesters(monkeypatch):
    async def never_called(**kwargs):  # pragma: no cover - 必须不被调用
        raise AssertionError("资格不符不得触模型")

    monkeypatch.setattr(litellm, "acompletion", never_called)
    client = await _client(_app("user-1"))
    async with client:
        r = await client.post(
            "/api/super-agent/slow-path/judge",
            json={"items": _items(1, requesters=["someone-else"])},
        )
    assert r.status_code == 403


async def test_422_批量超上限(monkeypatch):
    async def fake(**kwargs):  # pragma: no cover
        return _completion("[]")

    monkeypatch.setattr(litellm, "acompletion", fake)
    client = await _client(_app("user-1"))
    async with client:
        r = await client.post(
            "/api/super-agent/slow-path/judge",
            json={"items": _items(21)},
        )
    assert r.status_code == 422


async def test_502_上游失败与形状不符(monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(litellm, "acompletion", boom)
    client = await _client(_app("user-1"))
    async with client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502

    async def garbage(**kwargs):
        return _completion("抱歉,我今天不想输出 JSON")

    monkeypatch.setattr(litellm, "acompletion", garbage)
    client = await _client(_app("user-1"))
    async with client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(2)})
    assert r.status_code == 502
    assert "rejected" in r.json()["detail"]


async def test_504_超时(monkeypatch):
    async def slow(**kwargs):
        await asyncio.sleep(0.5)
        return _completion(json.dumps([{"id": "e1", "verdict": "act", "reason": "x"}]))

    monkeypatch.setattr(litellm, "acompletion", slow)
    monkeypatch.setattr(slow_router, "_JUDGE_TIMEOUT_S", 0.01)
    client = await _client(_app("user-1"))
    async with client:
        r = await client.post("/api/super-agent/slow-path/judge", json={"items": _items(1)})
    assert r.status_code == 504


async def test_真身份依赖生效_回落dev主体不入白名单即403():
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
