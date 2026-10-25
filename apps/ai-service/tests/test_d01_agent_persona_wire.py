# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D01(G-228)对话内 Agent 选择器:请求 agentId ⇒ 系统说明与工具白名单真并入。

判据全部落在**发给模型的上游载荷**上(与 D09 同口径),而不是只看纯函数返回值 ——
"函数能算对"和"链路真接上了"是两件事。
每格都成对:正例证明选中专家后确有变化;反例证明没选/选错时逐字节不变。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import llm as llm_router
from app.services.persona_registry import PERSONAS_CONTRACTS

STREAM_PATH = "/api/llm/complete/stream"


def build_app() -> FastAPI:
    """只挂 llm 路由的最小 app。

    刻意不 import ``app.main``:那里会级联加载全部路由与后台任务,任一相邻模块在
    并发改动期缺失都会让本组用例与 D01 无关地整片 ERROR。这里只测本路由的并入行为。
    """
    minimal = FastAPI()
    minimal.include_router(llm_router.router, prefix="/api")
    return minimal


@pytest.fixture
async def client():
    transport = ASGITransport(app=build_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def _stub_mode_env(monkeypatch):
    """把 LLMGateway 钉在 stub 档,跳过 stream pre-flight 的 api_key 校验。

    与 conftest 的 `_isolate_llm_env` 同一判据(清 vendor key + 清 settings.llm_providers),
    在这里自带一份是为了本文件能用 ``--noconftest`` 单独跑通 —— conftest 目前会因
    相邻模块缺失(非本票范围)在收集期整片 ERROR,那与本文件的断言无关。
    """
    from app.core.config import settings
    from app.core.llm_gateway import VENDOR_ENV_KEYS

    for key in VENDOR_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(settings, "llm_providers", "")


async def _capture(monkeypatch, payload: dict[str, Any]) -> dict[str, Any]:
    """发一轮流式请求,截获上游 astream 的 messages 与 tools 载荷。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def fake_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured.setdefault("messages", messages)
        if kwargs.get("tools") is not None:
            captured.setdefault("tools", kwargs["tools"])
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)
    transport = ASGITransport(app=build_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(STREAM_PATH, json=payload)
    assert resp.status_code == 200
    return captured


def _system_text(messages: list[dict[str, Any]]) -> str:
    return "\n".join(
        str(m.get("content") or "")
        for m in messages
        if m.get("role") == "system"
    )


def _tool_names(captured: dict[str, Any]) -> list[str]:
    return [tool["function"]["name"] for tool in captured.get("tools") or []]


class TestPersonaToolsOnWire:
    async def test_selected_persona_tools_merged_into_wire(self, monkeypatch, client):
        # 正例:选 coder ⇒ coder 白名单里的 file_edit 真的进了上游 tools。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "帮我改这个函数"}],
                "agent_tools": ["read_file"],
                "agentId": "coder",
            },
        )
        names = _tool_names(captured)
        assert "read_file" in names  # 调用方原有工具保留
        assert "file_edit" in names  # persona 白名单并入
        assert len(names) == len(set(names))

    async def test_persona_is_union_not_replacement(self, monkeypatch, client):
        # 反例对照:调用方给的 web_search 不能被选择器"改写"掉。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agent_tools": ["web_search"],
                "agentId": "researcher",
            },
        )
        assert "web_search" in _tool_names(captured)

    async def test_unknown_agent_id_changes_nothing(self, monkeypatch, client):
        # 反例:拼错/已下线的 id ⇒ 工具清单逐字原样,不因未知 id 而 422 或乱加工具。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agent_tools": ["read_file"],
                "agentId": "nonexistent_persona_xyz",
            },
        )
        assert _tool_names(captured) == ["read_file"]

    async def test_no_agent_id_keeps_legacy_payload(self, monkeypatch, client):
        # 反例(默认档):不传 agentId = 接线前逐字节一致(工具只有调用方给的那一个)。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agent_tools": ["read_file"],
            },
        )
        assert _tool_names(captured) == ["read_file"]

    async def test_persona_cannot_bypass_plan_mode_readonly(self, monkeypatch, client):
        # 顺序锁:persona 白名单在 chat_mode 收窄之前并入,plan 档下写类工具仍被摘掉。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agent_tools": ["read_file"],
                "mode": "plan",
                "agentId": "coder",
            },
        )
        names = _tool_names(captured)
        assert "read_file" in names
        assert "file_edit" not in names
        assert "write_file" not in names


class TestPersonaSystemHintOnWire:
    async def test_selected_persona_hint_reaches_system_message(self, monkeypatch, client):
        # 正例:系统提示里点名 persona,并带契约 required 与工具摘要。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agentId": "coder",
            },
        )
        system = _system_text(captured["messages"])
        assert "Persona active: coder" in system
        assert "affectedFiles" in system
        assert "file_edit" in system

    async def test_no_agent_id_adds_no_persona_hint(self, monkeypatch, client):
        # 反例:未选专家 ⇒ 系统提示里不出现 Persona active(零注入)。
        captured = await _capture(
            monkeypatch,
            {"messages": [{"role": "user", "content": "hi"}]},
        )
        assert "Persona active:" not in _system_text(captured["messages"])

    async def test_unknown_agent_id_adds_no_persona_hint(self, monkeypatch, client):
        # 反例:未知 id 也不注入(不能因为有个字符串就当专家)。
        captured = await _capture(
            monkeypatch,
            {
                "messages": [{"role": "user", "content": "hi"}],
                "agentId": "ghost",
            },
        )
        assert "Persona active:" not in _system_text(captured["messages"])


def test_registry_is_the_only_source_for_wire_whitelist():
    """防回归:上游并入读的就是 PERSONAS_CONTRACTS —— 改注册表即改行为,无第二份映射。"""
    for name, contract in PERSONAS_CONTRACTS.items():
        assert contract.tools, f"{name} 缺工具白名单"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
