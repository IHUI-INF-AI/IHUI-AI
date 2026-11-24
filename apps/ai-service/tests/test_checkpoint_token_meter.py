# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkpoint tokenMeter 生成:provider 基线、无 usage 降级、坏数据不抛异常。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.agent_loop_v2 import AgentLoopV2


@pytest.mark.asyncio
async def test_save_checkpoint_carries_compact_token_meter() -> None:
    """真实 _save_checkpoint_safe 把 tokenMeter 合进 metadata，且不带 nodes。"""
    saved: dict[str, Any] = {}

    class _Manager:
        async def save_checkpoint(self, **kwargs: Any) -> str:
            saved.update(kwargs)
            return "cp-1"

    loop = AgentLoopV2(
        llm_complete_fn=lambda *_a, **_k: None,
        tools=[],
        enable_checkpoint=True,
        session_id="s-1",
        checkpoint_manager=_Manager(),
    )
    loop._last_provider_usage_raw = {"prompt_tokens": 1000, "completion_tokens": 200}
    cid = await loop._save_checkpoint_safe(
        1,
        [
            {"role": "system", "content": "sys"},
            {"role": "assistant", "content": "answer"},
        ],
        "running",
        metadata={"caller": "kept"},
    )

    assert cid == "cp-1"
    assert saved["metadata"]["caller"] == "kept"
    meter = saved["metadata"]["tokenMeter"]
    assert meter["baseline"] == "provider_usage"
    assert "nodes" not in meter
    assert saved["session_id"] == "s-1"


def _loop() -> AgentLoopV2:
    return AgentLoopV2(
        llm_complete_fn=lambda *_a, **_k: None,
        tools=[],
        enable_checkpoint=False,
    )


def test_checkpoint_meter_reuses_provider_usage() -> None:
    loop = _loop()
    loop._last_provider_usage_raw = {
        "prompt_tokens": 1000,
        "completion_tokens": 200,
        "total_tokens": 1200,
    }
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hello" * 10},
        {"role": "assistant", "content": "world" * 20},
    ]

    payload = loop._checkpoint_token_meter(messages)

    assert payload is not None
    assert payload["baseline"] == "provider_usage"
    assert payload["tokenUsage"]["promptTokens"] == 1000
    assert payload["tokenUsage"]["outputTokens"] == 200
    assert payload["tokenUsage"]["totalTokens"] == 1200
    assert "nodes" not in payload


def test_checkpoint_meter_without_usage_stays_estimated() -> None:
    loop = _loop()
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "assistant", "content": "answer"},
    ]

    payload = loop._checkpoint_token_meter(messages)

    assert payload is not None
    assert payload["baseline"] == "estimated"
    assert "tokenUsage" not in payload


def test_checkpoint_meter_bad_usage_degrades_without_raising() -> None:
    loop = _loop()
    loop._last_provider_usage_raw = {"prompt_tokens": True, "completion_tokens": -1}

    payload = loop._checkpoint_token_meter([{"role": "assistant", "content": "x"}])

    assert payload is not None
    assert payload["baseline"] == "estimated"


def test_checkpoint_meter_no_assistant_has_no_anchor() -> None:
    loop = _loop()
    loop._last_provider_usage_raw = {"prompt_tokens": 1000, "completion_tokens": 200}

    payload = loop._checkpoint_token_meter([{"role": "user", "content": "only user"}])

    assert payload is not None
    assert payload["baseline"] == "estimated"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
