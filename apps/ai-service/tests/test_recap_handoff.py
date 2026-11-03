# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D176 任务回顾→移交新任务:交接文档生成端点 POST /api/agent/recap/handoff 测试。

覆盖(2026-09-30 残余③收口):200 生成回路(summary/next_action 出参 + prompt 组装)、
404 线程不存在、502 LLM 上游失败、504 生成超时、无身份 401。

隔离(AGENTS §5 测试隔离铁律):不连生产 PG(8810)/ Redis(8811)、不调真实 LLM ——
session store 与 litellm.acompletion 全部经 monkeypatch 替换为进程内假件;每测新建
独立 FastAPI app 只挂本 router,身份用 dependency_overrides 覆盖 get_current_user_id
(未覆盖的那条专测 401,复用 test_issue_search_api.py 的既有形态)。

patch 落点说明:recap.py 用 `from app.routers.sessions import get_session_store`
绑定式导入,端点实际调用的是 recap 模块命名空间里的名字 —— 故 patch
`app.routers.recap.get_session_store`(patch sessions 侧对端点无效,与
conftest 对 model_sync 的同型纪律一致)。
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import litellm
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import recap as recap_router
from app.services.session_store import LLMMessage, ThreadNotFoundError


def _fake_store(messages: list[LLMMessage] | None = None, *, resume_error: Exception | None = None):
    """假 session store:resume 为同步方法(与 SessionStore.resume 签名同形),全程无 SQLite。"""
    store = MagicMock()
    if resume_error is not None:
        store.resume = MagicMock(side_effect=resume_error)
    else:
        store.resume = MagicMock(return_value=messages or [])
    return store


def _fake_llm_response(content: str) -> MagicMock:
    """OpenAI 风格响应假件:resp.choices[0].message.content(端点唯一消费面)。"""
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    return resp


@pytest.fixture
def api(monkeypatch):
    """App with injectable store + mutable current-user uid. Returns (app, state)."""
    app = FastAPI()
    app.include_router(recap_router.router, prefix="/api")
    state = {"uid": "alice", "store": None}

    async def _fake_current_user_id() -> str:
        return state["uid"]

    app.dependency_overrides[get_current_user_id] = _fake_current_user_id

    def _fake_get_session_store():
        return state["store"]

    monkeypatch.setattr(recap_router, "get_session_store", _fake_get_session_store)
    return app, state


@pytest.fixture
async def client(api):
    app, _state = api
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_handoff_returns_summary_and_next_action(api, client, monkeypatch):
    """200:历史 + purpose 组装进 prompt,LLM JSON 出参解析为 summary/next_action。"""
    _app, state = api
    state["store"] = _fake_store(
        [
            LLMMessage(role="user", content="把登录页改成暗色"),
            LLMMessage(role="assistant", content="已改完并跑过验证"),
        ]
    )
    captured: dict = {}

    async def _fake_acompletion(**kwargs):
        captured.update(kwargs)
        return _fake_llm_response('{"summary": "S", "next_action": "N"}')

    monkeypatch.setattr(litellm, "acompletion", _fake_acompletion)
    res = await client.post(
        "/api/agent/recap/handoff",
        json={"thread_id": "t-1", "purpose": "带上下文继续"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["summary"] == "S"
    assert body["data"]["next_action"] == "N"
    # prompt 组装语义在 recap.py(不重写第二份):历史行 + 对话历史标签 + 交接目的
    prompt = captured["messages"][0]["content"]
    assert "对话历史:" in prompt
    assert "user: 把登录页改成暗色" in prompt
    assert "assistant: 已改完并跑过验证" in prompt
    assert "交接目的:带上下文继续" in prompt


@pytest.mark.asyncio
async def test_unknown_thread_returns_404(api, client):
    """resume 抛 ThreadNotFoundError → 404(线程不存在),不进 LLM 通道。"""
    _app, state = api
    state["store"] = _fake_store(resume_error=ThreadNotFoundError("t-missing"))
    res = await client.post("/api/agent/recap/handoff", json={"thread_id": "t-missing"})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_llm_failure_returns_502(api, client, monkeypatch):
    """acompletion 抛任意异常 → 502(litellm 异常族不稳定,统一按上游失败兜底)。"""
    _app, state = api
    state["store"] = _fake_store([LLMMessage(role="user", content="q")])

    async def _boom(**_kwargs):
        raise RuntimeError("upstream exploded")

    monkeypatch.setattr(litellm, "acompletion", _boom)
    res = await client.post("/api/agent/recap/handoff", json={"thread_id": "t-1"})
    assert res.status_code == 502


@pytest.mark.asyncio
async def test_llm_timeout_returns_504(api, client, monkeypatch):
    """超常量收紧 + 慢协程 → asyncio.wait_for 超时 → 504。"""
    _app, state = api
    state["store"] = _fake_store([LLMMessage(role="user", content="q")])
    monkeypatch.setattr(recap_router, "_RECAP_TIMEOUT_S", 0.01)

    async def _slow(**_kwargs):
        await asyncio.sleep(1.0)
        return _fake_llm_response("{}")

    monkeypatch.setattr(litellm, "acompletion", _slow)
    res = await client.post("/api/agent/recap/handoff", json={"thread_id": "t-1"})
    assert res.status_code == 504


@pytest.mark.asyncio
async def test_unauthenticated_rejected():
    """未覆盖身份依赖(无 JWT 中间件)→ 401,身份只从承载层进来(§5b 纪律)。"""
    bare = FastAPI()
    bare.include_router(recap_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=bare), base_url="http://test") as c:
        res = await c.post("/api/agent/recap/handoff", json={"thread_id": "t-1"})
    assert res.status_code == 401
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
