# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话格式迁移链 v0→v4 单测。"""
from __future__ import annotations

import pytest

from app.core.session_format_migration import (
    SessionFormatError,
    SessionFormatUnsupportedMigrationError,
    migrate_session,
)


def _ev(seq: int, etype: str, data: dict, *, time: int | None = None, **extra):
    return {"type": etype, "seq": seq, "time": time if time is not None else seq * 10, "data": data, **extra}


def _header(version: int, **extra):
    return {"version": version, "id": "s1", "createdAt": 1, "isSeeded": False, "delegationDepth": 0, **extra}


def test_v0_to_v1_normalizes_legacy_shapes():
    header = _header(0)
    events = [
        _ev(0, "turn/start", {"turn": 1, "trigger": {"kind": "user"}}),
        _ev(1, "steering/message", {"turn": 1, "content": [{"type": "text", "text": "hi"}], "source": {"kind": "user"}}),
        _ev(2, "compact/start", {"turn": 1}),
        _ev(3, "user/message", {"role": "user", "id": "u1", "content": [{"type": "text", "text": "c"}], "source": {"kind": "plugin", "plugin": "compact"}}),
        _ev(4, "compact/end", {"turn": 1}),
        _ev(5, "assistant/message", {"turn": 1, "step": 1, "content": [{"type": "text", "text": "a"}], "provenance": {"provider": "p"}}),
        _ev(6, "tool/result", {"turn": 1, "step": 1, "callId": "c1", "content": [{"type": "text", "text": "r"}], "isError": False}),
        _ev(7, "request/header", {"header": {"system": "sys", "messagePrefix": [{"id": "x"}]}, "reason": "initial"}),
        _ev(8, "turn/end", {"turn": 1, "reason": {"kind": "disposed"}}),
    ]
    migrated_header, migrated = migrate_session(header, events, target_version=1)
    assert migrated_header["version"] == 1
    assert [e["seq"] for e in migrated] == list(range(9))
    assert "trigger" not in migrated[0]["data"]
    assert migrated[1]["type"] == "user/message" and migrated[1]["data"]["id"].startswith("legacy-message:s1:")
    assert migrated[2]["type"] == "compaction/start" and migrated[2]["data"]["compactionId"]
    assert migrated[3]["data"]["source"]["compactionId"] == migrated[2]["data"]["compactionId"]
    assert migrated[4]["type"] == "compaction/end" and migrated[4]["data"]["compactionId"]
    assert migrated[5]["data"]["message"]["content"][0]["text"] == "a"
    assert migrated[6]["data"]["message"]["source"] == {"kind": "tool", "callId": "c1"}
    assert "messagePrefix" not in migrated[7]["data"]["header"]
    assert migrated[8]["data"]["reason"] == {"kind": "aborted", "reason": {"kind": "disposed"}}


def test_v1_to_v2_embeds_claimed_chunks_and_keeps_unclaimed_attempt():
    header = _header(1)
    events = [
        _ev(0, "user/message", {"role": "user", "id": "u1", "content": [], "source": {"kind": "user"}}),
        _ev(1, "assistant/chunk", {"turn": 1, "step": 1, "chunk": {"type": "text-delta", "text": "a"}}),
        _ev(2, "assistant/chunk", {"turn": 1, "step": 1, "chunk": {"type": "text-delta", "text": "b"}}),
        _ev(3, "assistant/message", {"turn": 1, "step": 1, "message": {"id": "m1", "role": "assistant", "content": []}}),
        _ev(4, "assistant/chunk", {"turn": 1, "step": 2, "chunk": {"type": "text-delta", "text": "lost"}}),
    ]
    _, migrated = migrate_session(header, events, target_version=2)
    assert all(e["type"] != "assistant/chunk" for e in migrated)
    message = next(e for e in migrated if e["type"] == "assistant/message")
    assert [c["chunk"]["text"] for c in message["data"]["stream"]] == ["a", "b"]
    attempt = next(e for e in migrated if e["type"] == "assistant/attempt")
    assert attempt["data"]["turn"] == 1 and attempt["data"]["step"] == 2
    assert attempt["data"]["stream"][0]["chunk"]["text"] == "lost"


def test_v2_to_v3_lifts_system_prompt_and_preset_and_envelope():
    header = _header(2, agentPreset="code")
    events = [
        _ev(0, "agent-preset/selected", {"agentPreset": "code"}),
        _ev(1, "step/start", {"turn": 1, "step": 1}),
        _ev(2, "request/header", {"header": {"system": "sys", "tools": [], "adapterDefaults": {}}, "reason": "initial"}),
        _ev(3, "tool/code-dispatch-start", {"rootCallId": "r", "parentCallId": None, "subCallId": "c", "name": "run", "arguments": {}}),
        _ev(4, "tool/code-dispatch", {"rootCallId": "r", "parentCallId": None, "subCallId": "c", "name": "run", "arguments": {}, "isError": False, "content": []}),
        _ev(5, "user/message", {"role": "user", "id": "u1", "content": [], "source": {"kind": "plugin", "plugin": "tools-code-mode"}}, surfaceOp={"op": "replace", "start": 0, "end": 0}),
        _ev(6, "step/end", {"turn": 1, "step": 1}),
    ]
    migrated_header, migrated = migrate_session(header, events, target_version=3)
    assert migrated_header["version"] == 3 and migrated_header["agentPreset"] == "ptc"
    assert migrated[0]["data"]["agentPreset"] == "ptc"
    assert migrated[1]["type"] == "step/start"
    assert migrated[2]["type"] == "system/message"
    system_events = [e for e in migrated if e["type"] == "system/message"]
    assert len(system_events) == 1
    assert system_events[0]["data"]["message"]["content"] == [{"type": "text", "text": "sys"}]
    header_event = next(e for e in migrated if e["type"] == "request/header")
    assert "system" not in header_event["data"]["header"]
    assert "tools" not in header_event["data"]["header"] and "adapterDefaults" not in header_event["data"]["header"]
    assert [e["type"] for e in migrated if e["type"].startswith("tool/")] == ["tool/ptc-dispatch-start", "tool/ptc-dispatch"]
    user = next(e for e in migrated if e["type"] == "user/message")
    assert user["data"]["source"]["plugin"] == "tools-ptc"
    assert user["surfaceOp"] == {"op": "replace", "startSeq": 0, "endSeq": 0}


def test_v3_to_v4_lifts_tool_role_and_plugin_sources():
    header = _header(3)
    events = [
        _ev(0, "user/message", {"role": "user", "id": "u1", "content": [{"type": "text", "text": "x"}], "source": {"kind": "plugin", "plugin": "compact"}}),
        _ev(1, "user/message", {"role": "user", "id": "u2", "content": [{"type": "mystery", "value": 1}], "source": {"kind": "user"}}),
        _ev(2, "tool/result", {"turn": 1, "step": 1, "message": {"id": "m1", "role": "user", "source": {"kind": "tool", "callId": "c1"}, "content": [{"type": "tool-result", "toolCallId": "c1", "content": [{"type": "text", "text": "r"}], "isError": True}]}}),
        _ev(3, "system/message", {"turn": 1, "step": 1, "message": {"id": "s", "role": "system", "content": [{"type": "text", "text": "S"}], "source": {"kind": "plugin", "plugin": "@deepseek-ai/dsh-system-prompt"}}}),
        _ev(4, "plugin/unknown", {"x": 1}, ignorable=True),
    ]
    _, migrated = migrate_session(header, events, target_version=4)
    user = migrated[0]
    assert user["data"]["source"]["kind"] == "compact-checkpoint"
    assert migrated[1]["data"]["content"][0]["type"] == "plugin:mystery"
    result = migrated[2]["data"]["message"]
    assert result["role"] == "tool" and result["toolCallId"] == "c1" and result["isError"] is True
    assert result["content"] == [{"type": "text", "text": "r"}]
    system = migrated[3]["data"]["message"]
    assert system["source"]["kind"] == "system-prompt"
    assert migrated[4]["type"] == "plugin:plugin/unknown"


def test_full_chain_v0_to_v4_is_dense_and_preserves_content():
    header = _header(0)
    events = [
        _ev(0, "turn/start", {"turn": 1, "trigger": {"kind": "user"}}),
        _ev(1, "step/start", {"turn": 1, "step": 1}),
        _ev(2, "steering/message", {"turn": 1, "content": [{"type": "text", "text": "hi"}], "source": {"kind": "user"}}),
        _ev(3, "assistant/chunk", {"turn": 1, "step": 1, "chunk": {"type": "text-delta", "text": "a"}}),
        _ev(4, "assistant/message", {"turn": 1, "step": 1, "content": [{"type": "text", "text": "a"}], "provenance": {"provider": "p"}}),
        _ev(5, "tool/result", {"turn": 1, "step": 1, "callId": "c1", "content": [{"type": "text", "text": "r"}], "isError": False}),
        _ev(6, "request/header", {"header": {"system": "sys"}, "reason": "initial"}),
        _ev(7, "step/end", {"turn": 1, "step": 1}),
        _ev(8, "turn/end", {"turn": 1, "reason": {"kind": "completed"}}),
    ]
    migrated_header, migrated = migrate_session(header, events, target_version=4)
    assert migrated_header["version"] == 4
    assert [e["seq"] for e in migrated] == list(range(len(migrated)))
    assert all(e["type"] != "assistant/chunk" for e in migrated)
    tool = next(e for e in migrated if e["type"] == "tool/result")
    assert tool["data"]["message"]["role"] == "tool"
    assert any(e["type"] == "system/message" for e in migrated)
    user = next(e for e in migrated if e["type"] == "user/message")
    assert user["data"]["content"][0]["text"] == "hi"


def test_unknown_and_unsupported_are_rejected():
    with pytest.raises(SessionFormatUnsupportedMigrationError):
        migrate_session(_header(0), [_ev(0, "request/header-delta", {})], target_version=1)
    with pytest.raises(SessionFormatUnsupportedMigrationError):
        migrate_session(_header(0), [_ev(0, "mystery/event", {})], target_version=1)
    with pytest.raises(SessionFormatError):
        migrate_session(_header(1), [_ev(1, "turn/start", {"turn": 1})], target_version=2)


def test_downgrade_is_refused():
    with pytest.raises(SessionFormatUnsupportedMigrationError, match="降级"):
        migrate_session(_header(4), [], target_version=2)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
