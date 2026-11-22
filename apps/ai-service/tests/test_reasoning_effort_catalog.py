# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D137:上游真实推理档位枚举的采集/归一/落库单测。"""

from __future__ import annotations

import json

import pytest

from app.services import reasoning_effort_catalog as cat


def test_normalize_maps_none_to_minimal_and_filters_unknown():
    raw = ["max", "xhigh", "high", "medium", "low", "NONE", "nonsense", 3, " high "]
    assert cat.normalize_efforts(raw) == ["max", "xhigh", "high", "medium", "low", "minimal"]


def test_normalize_keeps_contract_order_from_upstream_and_dedupes():
    assert cat.normalize_efforts(["low", "low", "minimal"]) == ["low", "minimal"]


def test_build_index_three_states():
    payload = {
        "data": [
            {
                "id": "openai/gpt-5.6-luna-pro",
                "reasoning": {"supported_efforts": ["max", "xhigh", "high", "medium", "low", "none"]},
                "supported_parameters": ["reasoning_effort", "tools"],
            },
            {
                "id": "vendor/plain-chat",
                "reasoning": None,
                "supported_parameters": ["tools"],
            },
            {
                "id": "vendor/effort-no-enum",
                "supported_parameters": ["reasoning_effort"],
            },
        ]
    }
    index = cat.build_openrouter_index(payload)
    assert index["openai/gpt-5.6-luna-pro"] == [
        "max",
        "xhigh",
        "high",
        "medium",
        "low",
        "minimal",
    ]
    assert index["gpt-5.6-luna-pro"] == index["openai/gpt-5.6-luna-pro"]
    assert index["vendor/plain-chat"] == []
    assert index["plain-chat"] == []
    assert "vendor/effort-no-enum" not in index


def test_resolve_prefers_full_id_then_tail_then_none():
    index = {"openai/gpt-5.6-luna": ["high"], "gpt-5-mini": ["low"]}
    assert cat.resolve_efforts(index, "openai/gpt-5.6-luna") == ["high"]
    assert cat.resolve_efforts(index, "gpt-5-mini") == ["low"]
    assert cat.resolve_efforts(index, "unknown-model") is None


class _FakeConn:
    """只覆盖 sync 用到的两个动作:fetch 给行、execute 收 UPDATE。"""

    def __init__(self, rows):
        self.rows = rows
        self.executed: list[tuple] = []

    async def fetch(self, sql, *args):
        return self.rows

    async def execute(self, sql, *args):
        self.executed.append(args)


@pytest.mark.asyncio
async def test_sync_writes_declaration_skips_undeclared_and_unchanged(monkeypatch):
    payload = {
        "data": [
            {
                "id": "openai/gpt-5.6",
                "reasoning": {"supported_efforts": ["high", "low", "none"]},
                "supported_parameters": ["reasoning_effort"],
            },
            {"id": "vendor/no-effort", "supported_parameters": []},
        ]
    }

    async def fake_payload(client=None):
        return payload

    monkeypatch.setattr(cat, "fetch_openrouter_payload", fake_payload)
    monkeypatch.setattr(cat, "write_cache", lambda index: None)
    rows = [
        {"id": 1, "model_id": "gpt-5.6", "metadata": {}},
        {"id": 2, "model_id": "vendor/no-effort", "metadata": {"priceSource": {"tier": "x"}}},
        {"id": 3, "model_id": "mystery-model", "metadata": {}},
        {"id": 4, "model_id": "gpt-5.6", "metadata": {"reasoning_efforts": ["high", "low", "minimal"]}},
    ]
    conn = _FakeConn(rows)
    stats = await cat.sync_openrouter_reasoning_efforts(conn)
    assert stats["rows"] == 4
    assert stats["undeclared"] == 1
    assert stats["unchanged"] == 1
    assert stats["written"] == 2
    patches = {args[0]: json.loads(args[1]) for args in conn.executed}
    assert patches[1]["reasoning_efforts"] == ["high", "low", "minimal"]
    assert patches[1]["reasoning_efforts_source"] == cat.SOURCE_TAG
    assert patches[2]["reasoning_efforts"] == []
    assert 3 not in patches
    assert 4 not in patches


def test_cache_roundtrip_and_missing_file(monkeypatch, tmp_path):
    """镜像必须能跨进程存续(池同步会清 metadata);缺失时回落空索引不猜。"""
    target = tmp_path / "efforts.json"
    monkeypatch.setattr(cat, "cache_path", lambda: target)
    monkeypatch.setattr(cat, "_cache_state", {"mtime": None, "index": {}})
    assert cat.load_cache_index() == {}
    cat.write_cache({"gpt-5.6": ["high", "low", "minimal"], "no-effort": []})
    index = cat.load_cache_index()
    assert index["gpt-5.6"] == ["high", "low", "minimal"]
    assert index["no-effort"] == []
    # 尾名匹配仍可命中(本地裸 id 场景)
    assert cat.resolve_efforts(index, "openrouter/gpt-5.6") == ["high", "low", "minimal"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
