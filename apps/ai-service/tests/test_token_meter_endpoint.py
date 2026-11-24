# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""token-usage 路由接线(第十五批):checkpoint 消息走 token_meter,不再 len//4。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.routers import agents as agents_router


@pytest.mark.asyncio
async def test_agent_token_usage_uses_token_meter_breakdown(monkeypatch) -> None:
    cp = SimpleNamespace(
        iteration=1,
        messages=[
            {"role": "system", "content": "s" * 8},
            {"role": "user", "content": "u" * 4},
            {
                "role": "assistant",
                "content": "a" * 4,
                "tool_calls": [{"function": {"name": "read", "arguments": '{"path":"a"}'}}],
            },
        ],
    )

    class _Manager:
        async def list_checkpoints(self, session_id: str) -> list[SimpleNamespace]:
            assert session_id == "agent-1"
            return [cp]

    monkeypatch.setattr(
        "app.services.agent_checkpoint.get_agent_checkpoint_manager",
        lambda: _Manager(),
    )
    monkeypatch.setattr(agents_router, "_assert_session_access", lambda *_: None)

    result = await agents_router.get_agent_token_usage("agent-1", current_user="user-1")
    items = result["data"]["tokenUsage"]
    assert len(items) == 1
    item = items[0]
    assert item["sessionLabel"] == "I1"
    assert item["prompt"] > 0
    assert item["completion"] > 0
    assert item["totalTokens"] == item["prompt"] + item["completion"]
    assert item["contextBreakdown"]["systemTokens"] > 0
    assert (
        item["contextBreakdown"]["messageTokens"]
        == item["prompt"] + item["completion"] - item["contextBreakdown"]["systemTokens"]
    )
    assert item["baseline"] == "estimated"


@pytest.mark.asyncio
async def test_agent_token_usage_prefers_saved_provider_meter(monkeypatch) -> None:
    """checkpoint 里已落的 tokenMeter 优先，provider 四桶与基线原样复用。"""
    cp = SimpleNamespace(
        iteration=7,
        messages=[{"role": "user", "content": "ignored"}],
        metadata={
            "tokenMeter": {
                "totalTokens": 999,
                "surfaceTokens": 30,
                "contextBreakdown": {
                    "systemTokens": 5,
                    "toolsTokens": 3,
                    "messageTokens": 22,
                },
                "baseline": "provider_usage",
                "envelopeKey": "abc",
                "tokenUsage": {
                    "promptTokens": 100,
                    "outputTokens": 50,
                    "totalTokens": 150,
                },
            }
        },
    )

    class _Manager:
        async def list_checkpoints(self, session_id: str) -> list[SimpleNamespace]:
            assert session_id == "agent-2"
            return [cp]

    monkeypatch.setattr(
        "app.services.agent_checkpoint.get_agent_checkpoint_manager",
        lambda: _Manager(),
    )
    monkeypatch.setattr(agents_router, "_assert_session_access", lambda *_: None)

    result = await agents_router.get_agent_token_usage("agent-2", current_user="user-1")
    item = result["data"]["tokenUsage"][0]
    assert item["sessionLabel"] == "I7"
    assert item["prompt"] == 100
    assert item["completion"] == 50
    assert item["totalTokens"] == 150
    assert item["baseline"] == "provider_usage"
    assert item["tokenUsage"]["totalTokens"] == 150
    assert item["envelopeKey"] == "abc"


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
