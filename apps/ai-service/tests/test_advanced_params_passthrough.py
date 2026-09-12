# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P1-7 高级参数透传回归测试(2026-09-13 立)。

背景:前端「高级参数」面板(web sampling-params-panel.tsx)按会话下发
temperature / top_p / top_k / max_tokens 与自定义 system_prompt,
期望链路:
  前端 streamChat → apps/api chatStreamSchema → ai-service LLMCompleteRequest
  → llm_gateway(astream / complete)→ 上游 provider

修复前缺口(本次修复):
1. complete_stream 的 generic 路径只把 tools/tool_choice 传给 llm_gateway.astream,
   temperature / max_tokens **完全没有下发** → Web 流式对话里用户在面板调的采样参数被静默忽略;
2. LLMCompleteRequest 只有 temperature / max_tokens,没有 top_p / top_k / system_prompt;
3. 自定义 system prompt 无注入点(无法与工作区记忆叠加)。

覆盖:
- 流式路径:四项采样参数进入 astream 调用参数;
- 流式路径:未传参数时不注入任何 key(回归保护,不改变上游默认行为);
- 流式路径:system_prompt 注入 system 消息最顶部(有/无既有 system 消息两种);
- 非流式路径(/api/llm/complete):top_p / top_k 进入 kwargs,system_prompt 同样注入;
- 纯函数单测:_inject_custom_system_prompt 空值/合并语义。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _force_stub_mode(monkeypatch, *, stub: bool) -> None:
    """钉住 _is_stub_mode,避免本机 .env 残留 key 导致 stub 判定随环境翻转。"""
    from app.routers import llm as llm_router

    monkeypatch.setattr(llm_router.llm_gateway, "_is_stub_mode", lambda: stub)


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                try:
                    data = json.loads(line[5:].strip())
                except (json.JSONDecodeError, ValueError):
                    data = line[5:].strip()
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


# =============================================================================
# 1. 纯函数:_inject_custom_system_prompt
# =============================================================================

def test_inject_custom_system_prompt_empty_returns_input():
    """空 prefix:原样返回(不插入空 system 消息)。"""
    from app.routers.llm import _inject_custom_system_prompt

    messages = [{"role": "user", "content": "hi"}]
    assert _inject_custom_system_prompt(messages, None) is messages
    assert _inject_custom_system_prompt(messages, "") is messages


def test_inject_custom_system_prompt_promotes_to_top():
    """有既有 system 消息:自定义 prompt 置于最顶部,原内容保留在后。"""
    from app.routers.llm import _inject_custom_system_prompt

    messages = [
        {"role": "system", "content": "工作区记忆"},
        {"role": "user", "content": "hi"},
    ]
    out = _inject_custom_system_prompt(messages, "始终用中文回答")
    assert len(out) == 2
    assert out[0]["role"] == "system"
    assert out[0]["content"] == "始终用中文回答\n\n工作区记忆"
    # 不可变更新:原列表未被修改
    assert messages[0]["content"] == "工作区记忆"


def test_inject_custom_system_prompt_inserts_when_absent():
    """无 system 消息:在开头插入新 system 消息。"""
    from app.routers.llm import _inject_custom_system_prompt

    out = _inject_custom_system_prompt([{"role": "user", "content": "hi"}], "规则A")
    assert out[0] == {"role": "system", "content": "规则A"}
    assert out[1] == {"role": "user", "content": "hi"}


# =============================================================================
# 2. 流式路径 /api/llm/complete/stream
# =============================================================================

async def test_stream_forwards_advanced_sampling_params(client: AsyncClient, monkeypatch):
    """四项采样参数进入 llm_gateway.astream 调用参数(修复前 temperature/max_tokens 被丢弃)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured.update(kwargs)
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "test-model",
            "temperature": 0.3,
            "top_p": 0.9,
            "top_k": 40,
            "max_tokens": 2048,
        },
    )
    assert resp.status_code == 200, resp.text[:500]

    assert captured.get("temperature") == 0.3
    assert captured.get("top_p") == 0.9
    assert captured.get("top_k") == 40
    assert captured.get("max_tokens") == 2048


async def test_stream_omits_absent_params(client: AsyncClient, monkeypatch):
    """未传参数:astream 不收到任何采样参数 key(保持上游默认,回归保护)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured.update(kwargs)
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "你好"}], "model": "test-model"},
    )
    assert resp.status_code == 200
    for key in ("temperature", "top_p", "top_k", "max_tokens"):
        assert key not in captured, f"{key} 不应出现在 astream 参数中"


async def test_stream_injects_custom_system_prompt(client: AsyncClient, monkeypatch):
    """system_prompt 注入到 system 消息最顶部(与既有 system 内容叠加)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured["messages"] = messages
        captured.update(kwargs)
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [
                {"role": "system", "content": "既有系统提示"},
                {"role": "user", "content": "你好"},
            ],
            "model": "test-model",
            "system_prompt": "始终用简体中文回答",
        },
    )
    assert resp.status_code == 200, resp.text[:500]

    msgs = captured["messages"]
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"].startswith("始终用简体中文回答")
    assert "既有系统提示" in msgs[0]["content"]
    # 用户消息未被改动
    assert msgs[-1]["content"] == "你好"


async def test_stream_system_prompt_absent_leaves_messages(client: AsyncClient, monkeypatch):
    """未传 system_prompt:不注入空 system 消息(消息条数与首条 role 不变)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured["messages"] = messages
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "你好"}], "model": "test-model"},
    )
    assert resp.status_code == 200
    msgs = captured["messages"]
    assert len(msgs) == 1
    assert msgs[0]["role"] == "user"


# =============================================================================
# 3. 非流式路径 /api/llm/complete
# =============================================================================

async def test_complete_forwards_top_p_top_k_and_system_prompt(client: AsyncClient, monkeypatch):
    """非流式:top_p/top_k 进入 kwargs,system_prompt 注入 messages。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        captured["messages"] = messages
        captured.update(kwargs)
        return {"content": "ok", "model": model, "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "test-model",
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 20,
            "max_tokens": 512,
            "system_prompt": "先给结论",
        },
    )
    assert resp.status_code == 200, resp.text[:500]

    assert captured.get("temperature") == 0.2
    assert captured.get("top_p") == 0.8
    assert captured.get("top_k") == 20
    assert captured.get("max_tokens") == 512
    msgs = captured["messages"]
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"].startswith("先给结论")


async def test_complete_omits_absent_top_p_top_k(client: AsyncClient, monkeypatch):
    """非流式:未传 top_p/top_k 时不注入(回归保护)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        captured.update(kwargs)
        return {"content": "ok", "model": model, "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    _force_stub_mode(monkeypatch, stub=True)

    resp = await client.post(
        "/api/llm/complete",
        json={"messages": [{"role": "user", "content": "你好"}], "model": "test-model"},
    )
    assert resp.status_code == 200
    assert "top_p" not in captured
    assert "top_k" not in captured
