# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""能力版本 payload 门(遵循统一工程规范)行为钉子。

钉语义化版本比较 + 按对端版本剥离 payload 字段 + fail-safe(未知能力保守剥离)
三轴,逐项反向变异:改版本必须翻转 kept/stripped。
"""

from __future__ import annotations

import pytest

from app.core.capability_payload_gate import (
    CapabilityRegistry,
    build_default_registry,
    parse_version,
    version_at_least,
)

# ---- 1. 语义化版本比较 ----


def test_version_at_least_basic():
    assert version_at_least("1.2.3", "1.2.3") is True
    assert version_at_least("1.2.4", "1.2.3") is True
    assert version_at_least("1.2.2", "1.2.3") is False
    assert version_at_least("2.0.0", "1.9.9") is True


def test_prerelease_lower_than_release():
    # 预发布低于同号正式:1.2.3-alpha.1 < 1.2.3
    assert version_at_least("1.2.3-alpha.1", "1.2.3") is False
    assert version_at_least("1.2.3", "1.2.3-alpha.1") is True


def test_prerelease_internal_order():
    assert version_at_least("1.2.3-alpha.2", "1.2.3-alpha.1") is True
    assert version_at_least("1.2.3-alpha.1", "1.2.3-alpha.2") is False


def test_parse_version_short_form():
    # 不足 3 位补 0;pre_rank 正式版=(1,0)
    assert parse_version("1.2") == (1, 2, 0, 1, 0)
    assert parse_version("1.2.3") == (1, 2, 3, 1, 0)


# ---- 2. 按对端版本剥离 payload ----


def _registry():
    reg = CapabilityRegistry()
    reg.register("asyncCompaction", "0.163.0-alpha.11", ["async_compaction"])
    reg.register("threadMemorySummary", "0.165.0-alpha.1", ["memory_phase_two_prompt"])
    return reg


def test_field_kept_when_peer_supports_capability():
    reg = _registry()
    payload = {"async_compaction": True, "stable_field": "x"}
    res = reg.sanitize(payload, peer_version="0.164.0-alpha.1")
    assert res.payload.get("async_compaction") is True
    assert res.payload.get("stable_field") == "x"
    assert res.stripped == []


def test_field_stripped_when_peer_lacks_capability():
    reg = _registry()
    payload = {"async_compaction": True, "stable_field": "x"}
    res = reg.sanitize(payload, peer_version="0.162.0-alpha.1")
    assert "async_compaction" not in res.payload  # 剥离
    assert res.payload.get("stable_field") == "x"  # 稳定字段保留
    assert [d.payload_key for d in res.stripped] == ["async_compaction"]


def test_boundary_version_exact_is_kept():
    reg = _registry()
    payload = {"async_compaction": True}
    res = reg.sanitize(payload, peer_version="0.163.0-alpha.11")
    assert res.payload.get("async_compaction") is True


def test_multiple_gates_strip_independently():
    reg = _registry()
    payload = {"async_compaction": True, "memory_phase_two_prompt": "m"}
    res = reg.sanitize(payload, peer_version="0.160.0-alpha.0")
    assert set(res.stripped_keys()) == {"async_compaction", "memory_phase_two_prompt"}
    assert res.payload == {}


def test_stripped_keys_helper():
    reg = _registry()
    res = reg.sanitize({"async_compaction": 1, "memory_phase_two_prompt": 2}, "0.150.0-alpha.0")
    assert res.stripped_keys() == ["async_compaction", "memory_phase_two_prompt"]


# ---- 3. fail-safe:未知能力保守剥离 ----


def test_unknown_stable_key_passes_through():
    # 取证真相:gate 是白名单,只门控登记的演进字段;未登记键原样透传(不被误剥)。
    reg = _registry()
    payload = {"brand_new_capability": {"x": 1}}
    res = reg.sanitize(payload, peer_version="0.1.0")
    assert res.payload == {"brand_new_capability": {"x": 1}}
    assert res.stripped == []


def test_known_stable_field_not_stripped():
    reg = _registry()
    payload = {"messages": [1, 2, 3]}
    res = reg.sanitize(payload, peer_version="0.1.0")
    assert res.payload == {"messages": [1, 2, 3]}
    assert res.stripped == []


# ---- 4. 反向变异:默认注册表门可枚举 ----


def test_default_registry_enumerates_capabilities():
    reg = build_default_registry()
    caps = reg.capabilities()
    assert len(caps) >= 5
    names = {c.name for c in caps}
    assert "asyncCompaction" in names
    assert "threadMemorySummary" in names


def test_default_registry_gates_payload():
    reg = build_default_registry()
    payload = {
        "async_compaction": True,
        "token_budget_history_notes": "n",
        "messages": [],
    }
    res = reg.sanitize(payload, peer_version="0.140.0-alpha.0")
    assert "async_compaction" not in res.payload
    assert "token_budget_history_notes" not in res.payload
    assert res.payload == {"messages": []}


# ---- 5. 边界与契约 ----


def test_non_dict_payload_raises():
    reg = _registry()
    with pytest.raises(TypeError):
        reg.sanitize(["not", "a", "dict"], peer_version="1.0.0")


def test_decisions_record_why():
    reg = _registry()
    res = reg.sanitize({"async_compaction": True}, peer_version="0.162.0-alpha.1")
    d = res.decisions[0]
    assert d.capability == "asyncCompaction"
    assert d.kept is False
    assert "0.162.0-alpha.1" in d.reason
    assert "0.163.0-alpha.11" in d.reason


def test_as_dict_shape():
    reg = _registry()
    res = reg.sanitize({"async_compaction": True}, peer_version="0.162.0-alpha.1")
    d = res.as_dict()
    assert d["peerVersion"] == "0.162.0-alpha.1"
    assert d["strippedKeys"] == ["async_compaction"]
    assert isinstance(d["decisions"], list)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
