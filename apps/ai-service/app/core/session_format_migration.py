# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话格式迁移链 v0 → v1 → v2 → v3 → v4(有界实现)。

对照 DSH 四个已发布迁移包的可观察语义:
- v0→v1:版本号、``steering/message→user/message``、``compact/*→compaction/*``、
  移除 ``turn/start.trigger``、停用 ``turn/end`` reason 归一、消息包装层、
  确定性 id、移除 ``request/header.header.messagePrefix``;
- v1→v2:顶层 ``assistant/chunk`` 嵌入匹配的 ``assistant/message``;未认领的
  attempt 变成 ``assistant/attempt``;密集重映射序号引用;
- v2→v3:``agentPreset`` 的 ``code→ptc``、首个 step 后插入空 ``system/message``、
  ``request/header.data.header.system`` 提升为 system 消息、PTC 事件改名、
  信封 ``{op:'replace',start,end}→{op:'replace',startSeq,endSeq}``;
- v3→v4:``tool/result`` 的 user 角色 wrapper 提升为 ``role:'tool'``;插件来源
  按 DSH 表转换成 ``kind``;未知内容标签加 ``plugin:`` 前缀;未知 ignorable
  事件名加 ``plugin:`` 前缀。

**边界(明确声明,不假装全量)**:本模块复刻上述**具名转换**与序号重映射,
不复制 DSH 的完整关系校验器/内容允许清单/父子目录证据收集。未知必需事件一律
拒绝;无法保留信息的输入抛 ``SessionFormatUnsupportedMigrationError``。
"""
from __future__ import annotations

import copy
import hashlib
from collections.abc import Iterable, Sequence
from typing import Any

__all__ = [
    "SessionFormatError",
    "SessionFormatUnsupportedMigrationError",
    "migrate_session",
    "migrate_session_events",
    "VERSIONS",
]

VERSIONS = (0, 1, 2, 3, 4)


class SessionFormatError(ValueError):
    """源/目标格式错误。"""


class SessionFormatUnsupportedMigrationError(SessionFormatError):
    """输入合法但本实现无法无损迁移(必须拒绝,不得静默丢字段)。"""


# 已发布 v0 事件清单(来自 dsh-session-format-v0-to-v1/src/dispositions.ts)。
_V0_EVENT_TYPES = frozenset(
    {
        "agent-preset/selected",
        "agent/inbox/spliced",
        "approval/asked",
        "approval/decided",
        "approval/policy",
        "assistant/chunk",
        "assistant/message",
        "command/done",
        "command/run",
        "compaction/end",
        "compaction/prune",
        "compaction/start",
        "compaction/summary",
        "feedback/record",
        "goal/change",
        "hook/invoked",
        "hook/result",
        "llm/retry",
        "llm/retry-started",
        "model/selection",
        "permission/preset",
        "plan/mode",
        "request/context",
        "request/header",
        "sandbox/mode",
        "schedule/change",
        "session-log-deepseek/delivery-accepted",
        "session/end-seed",
        "session/title",
        "session/title-llm-request",
        "step/end",
        "step/start",
        "subagent/descriptor",
        "subagent/model-selection-policy",
        "team/member",
        "team/message/delivered",
        "team/message/queued",
        "team/task",
        "todo/write",
        "tool-workflow/agent-end",
        "tool-workflow/agent-start",
        "tool-workflow/run-end",
        "tool-workflow/run-start",
        "tool/call",
        "tool/code-dispatch",
        "tool/code-dispatch-start",
        "tool/result",
        "turn/end",
        "turn/start",
        "user/message",
        "web/deepseek-search-llm-request",
    }
) | {"steering/message", "compact/start", "compact/summary", "compact/end", "compact/prune"}

_V1_EVENT_TYPES = (_V0_EVENT_TYPES - {"steering/message", "compact/start", "compact/summary", "compact/end", "compact/prune"}) | {
    "compaction/start",
    "compaction/summary",
    "compaction/end",
    "compaction/prune",
}
_V2_EVENT_TYPES = (_V1_EVENT_TYPES - {"assistant/chunk"}) | {"assistant/attempt"}
_V3_EVENT_TYPES = (
    _V2_EVENT_TYPES
    | {"system/message", "developer/message"}
    - {"tool/code-dispatch", "tool/code-dispatch-start"}
) | {"tool/ptc-dispatch", "tool/ptc-dispatch-start"}
_V4_EVENT_TYPES = _V3_EVENT_TYPES

_CONTENT_TYPES_V3 = frozenset({"text", "reasoning", "image", "file", "tool-call", "tool-result"})

_PLUGIN_KIND_MAP = {
    "compact": "compact-checkpoint",
    "tools-code-mode": "ptc-mode",
    "tools-ptc": "ptc-mode",
    "dsh-compaction-basic": "compact-basic",
    "@deepseek-ai/dsh-system-prompt": "system-prompt",
}

_FIRST_PARTY_PLUGINS = frozenset(
    {
        "agent-instructions",
        "session-reference",
        "team-message",
        "goal",
        "skill-invocation",
        "skill-catalog",
        "coordinator",
        "subagent-report",
        "subagent-settled",
        "webhook",
        "agent-message",
        "model-selection",
        "plan-mode",
        "time-context",
        "tmux-context",
        "user-approval",
        "repeat-tool-reminder",
        "tool-cordis",
        "cordis-host-runner",
        "tool-goal",
        "tool-jobs",
        "hooks-codex",
        "hooks-claude-code",
        "schedule",
        "dsh-session-title-llm",
    }
)


def _header_version(header: Any) -> int:
    if not isinstance(header, dict):
        raise SessionFormatError("会话 header 必须是对象")
    version = header.get("version")
    if not isinstance(version, int) or version not in VERSIONS:
        raise SessionFormatError(f"非法会话格式版本: {version!r}")
    if not isinstance(header.get("id"), str) or not header["id"]:
        raise SessionFormatError("会话 header.id 必须是非空字符串")
    return version


def _event_list(events: Any) -> list[dict[str, Any]]:
    if not isinstance(events, (list, tuple)):
        raise SessionFormatError("events 必须是数组")
    rows: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise SessionFormatError(f"events[{index}] 不是对象")
        for key in ("type", "seq", "time", "data"):
            if key not in event:
                raise SessionFormatError(f"events[{index}] 缺少必需字段 {key}")
        if not isinstance(event["type"], str) or not event["type"]:
            raise SessionFormatError(f"events[{index}].type 非法")
        if event["seq"] != index:
            raise SessionFormatError(
                f"源事件序号必须从 0 连续排列:events[{index}].seq={event['seq']!r}"
            )
        if not isinstance(event["time"], int) or event["time"] < 0:
            raise SessionFormatError(f"events[{index}].time 必须是非负整数")
        if not isinstance(event["data"], dict):
            raise SessionFormatError(f"events[{index}].data 必须是对象")
        rows.append(event)
    return rows


def _assert_types(
    events: Iterable[dict[str, Any]],
    allowed: frozenset[str],
    version: int,
    *,
    allow_ignorable: bool = False,
) -> None:
    for event in events:
        if event["type"] not in allowed:
            if allow_ignorable and event.get("ignorable") is True:
                continue
            raise SessionFormatUnsupportedMigrationError(
                f"v{version} 未知事件类型(拒绝迁移): {event['type']!r} @seq {event['seq']}"
            )


def _clone(value: Any) -> Any:
    return copy.deepcopy(value)


def _require_str(data: dict[str, Any], key: str, where: str) -> str:
    value = data.get(key)
    if not isinstance(value, str):
        raise SessionFormatError(f"{where}.{key} 必须是字符串")
    return value


def _hash_id(prefix: str, parts: Sequence[Any]) -> str:
    payload = "\x1f".join(str(part) for part in parts)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"{prefix}{digest}"


def _legacy_message_id(session_id: str, seq: int) -> str:
    return f"legacy-message:{session_id}:{seq}"


def _normalize_v0_turn_end(event: dict[str, Any]) -> dict[str, Any]:
    data = event["data"]
    reason = data.get("reason")
    if not isinstance(reason, dict) or not isinstance(reason.get("kind"), str):
        raise SessionFormatError(f"turn/end @seq {event['seq']} reason 非法")
    kind = reason["kind"]
    if kind in ("completed", "blocked", "max-tokens", "interrupted"):
        return event
    if kind == "aborted" and "reason" not in reason:
        data["reason"] = {"kind": "aborted", "reason": {"kind": "legacy"}}
        return event
    if kind == "disposed":
        data["reason"] = {"kind": "aborted", "reason": {"kind": "disposed"}}
        return event
    if kind == "error" and "error" not in reason:
        failure = reason.get("failure")
        if isinstance(failure, dict):
            message = failure.get("message")
            code = failure.get("code")
            if not isinstance(message, str) or not isinstance(code, str):
                raise SessionFormatError(f"turn/end @seq {event['seq']} failure 非法")
            data["reason"] = {"kind": "error", "error": failure}
            return event
        message = reason.get("message")
        if not isinstance(message, str):
            raise SessionFormatError(f"turn/end @seq {event['seq']} error reason 非法")
        data["reason"] = {
            "kind": "error",
            "error": {"message": message, "code": reason.get("code") or "UNKNOWN"},
        }
    return event


def _normalize_v0_message(event: dict[str, Any], session_id: str) -> dict[str, Any]:
    data = event["data"]
    etype = event["type"]
    if etype == "user/message":
        if "id" in data or "role" in data or "message" in data:
            return event
        if "content" not in data or "source" not in data:
            return event
        data["id"] = _legacy_message_id(session_id, event["seq"])
        data["role"] = "user"
        return event
    if etype == "assistant/message":
        if "message" in data or "content" not in data:
            return event
        source = data.get("provenance")
        if not isinstance(source, dict):
            return event
        content = _clone(data["content"])
        event_data = {key: _clone(value) for key, value in data.items() if key not in ("content", "provenance")}
        data.clear()
        data.update(event_data)
        data["message"] = {
            "id": _legacy_message_id(session_id, event["seq"]),
            "role": "assistant",
            "content": content,
            "source": {**source, "kind": "model"},
        }
        return event
    if etype == "tool/result":
        if "message" in data or not all(k in data for k in ("callId", "content", "isError")):
            return event
        call_id = data.pop("callId")
        content = data.pop("content")
        is_error = data.pop("isError")
        if not isinstance(call_id, str) or not isinstance(is_error, bool):
            raise SessionFormatError(f"tool/result @seq {event['seq']} callId/isError 非法")
        data["message"] = {
            "id": _legacy_message_id(session_id, event["seq"]),
            "role": "user",
            "content": [{"type": "tool-result", "toolCallId": call_id, "content": content, "isError": is_error}],
            "source": {"kind": "tool", "callId": call_id},
        }
    return event


def _normalize_v0_event(event: dict[str, Any], session_id: str, state: dict[str, Any]) -> dict[str, Any]:
    etype = event["type"]
    if etype in ("request/header-delta", "mode/set"):
        raise SessionFormatUnsupportedMigrationError(
            f"v0 停用事件 {etype!r} @seq {event['seq']} 无法无损迁移"
        )
    if etype == "request/header" and event["data"].get("reason") == "fallback":
        raise SessionFormatUnsupportedMigrationError(
            f"v0 request/header reason=fallback @seq {event['seq']} 无法无损迁移"
        )
    if etype == "compact/start":
        event["type"] = "compaction/start"
    elif etype == "compact/summary":
        event["type"] = "compaction/summary"
    elif etype == "compact/end":
        event["type"] = "compaction/end"
    elif etype == "compact/prune":
        event["type"] = "compaction/prune"

    etype = event["type"]
    if etype == "steering/message":
        data = event["data"]
        if "message" in data:
            event["type"] = "user/message"
            event["data"] = _clone(data["message"])
            return event
        message = {k: _clone(v) for k, v in data.items() if k != "turn"}
        message["id"] = _legacy_message_id(session_id, event["seq"])
        message["role"] = "user"
        event["type"] = "user/message"
        event["data"] = message
        return event
    if etype == "turn/start":
        event["data"].pop("trigger", None)
        return event
    if etype == "turn/end":
        return _normalize_v0_turn_end(event)
    if etype == "request/header":
        header = event["data"].get("header")
        if isinstance(header, dict) and "messagePrefix" in header:
            if not isinstance(header["messagePrefix"], list):
                raise SessionFormatError(f"request/header @seq {event['seq']} messagePrefix 非法")
            header.pop("messagePrefix", None)
        return event
    if etype == "compaction/start":
        data = event["data"]
        if "compactionId" not in data:
            data["compactionId"] = f"legacy-compaction:{session_id}:{event['seq']}"
        state["compaction_id"] = data["compactionId"]
        return event
    if etype in ("compaction/summary", "compaction/end"):
        data = event["data"]
        if "compactionId" not in data and state.get("compaction_id"):
            data["compactionId"] = state["compaction_id"]
        if etype == "compaction/end":
            state.pop("compaction_id", None)
        return event
    if etype == "user/message":
        source = event["data"].get("source")
        if (
            state.get("compaction_id")
            and isinstance(source, dict)
            and source.get("kind") == "plugin"
            and source.get("plugin") == "compact"
            and "compactionId" not in source
        ):
            source["compactionId"] = state["compaction_id"]
        return _normalize_v0_message(event, session_id)
    if etype == "assistant/message":
        return _normalize_v0_message(event, session_id)
    if etype == "tool/result":
        return _normalize_v0_message(event, session_id)
    if etype == "llm/retry":
        data = event["data"]
        if "retryId" not in data:
            data["retryId"] = f"legacy-retry:{session_id}:{event['seq']}"
        return event
    return event


def _rebuild(items: list[tuple[int | None, dict[str, Any]]]) -> tuple[list[dict[str, Any]], dict[int, int | None]]:
    """把 ``(源序号,事件)`` 列表重排成连续 seq,返回源→目标映射。"""
    output: list[dict[str, Any]] = []
    mapping: dict[int, int | None] = {}
    for source_seq, event in items:
        new_seq = len(output)
        event["seq"] = new_seq
        output.append(event)
        if source_seq is not None:
            mapping[source_seq] = new_seq
    return output, mapping


def _remap_value(value: Any, mapping: dict[int, int | None], where: str) -> Any:
    if not isinstance(value, int) or isinstance(value, bool):
        raise SessionFormatError(f"{where} 必须是整数序号")
    if value not in mapping:
        raise SessionFormatError(f"{where} 引用未知源序号 {value}")
    target = mapping[value]
    if target is None:
        raise SessionFormatUnsupportedMigrationError(f"{where} 引用被消费的源事件 {value}")
    return target


def _remap_references(event: dict[str, Any], mapping: dict[int, int | None]) -> None:
    event_type = event["type"]
    if "sourceEventSeqs" in event:
        refs = event["sourceEventSeqs"]
        if not isinstance(refs, list):
            raise SessionFormatError(f"{event_type} sourceEventSeqs 必须是数组")
        event["sourceEventSeqs"] = [
            _remap_value(ref, mapping, f"{event_type} sourceEventSeqs[{index}]")
            for index, ref in enumerate(refs)
        ]
    surface = event.get("surfaceOp")
    if isinstance(surface, dict) and surface.get("op") == "replace":
        for old_key, new_key in (("start", "startSeq"), ("end", "endSeq"), ("startSeq", "startSeq"), ("endSeq", "endSeq")):
            if old_key in surface:
                surface[new_key] = _remap_value(surface.pop(old_key), mapping, f"{event_type} surfaceOp.{old_key}")
        for key in ("startSeq", "endSeq"):
            if key in surface:
                surface[key] = _remap_value(surface[key], mapping, f"{event_type} surfaceOp.{key}")
    data = event["data"]
    if isinstance(data.get("sourceEventSeq"), int):
        data["sourceEventSeq"] = _remap_value(data["sourceEventSeq"], mapping, f"{event_type} data.sourceEventSeq")
    range_obj = data.get("shadowedRange")
    if isinstance(range_obj, dict):
        for key in ("start", "end"):
            if key in range_obj:
                range_obj[key] = _remap_value(range_obj[key], mapping, f"{event_type} shadowedRange.{key}")
    for key in ("shadowedSeqs", "messageSeqs"):
        refs = data.get(key)
        if isinstance(refs, list):
            data[key] = [_remap_value(ref, mapping, f"{event_type} data.{key}") for ref in refs]


def _migrate_v0_to_v1(header: dict[str, Any], events: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    _assert_types(events, _V0_EVENT_TYPES, 0)
    session_id = header["id"]
    state: dict[str, Any] = {}
    items: list[tuple[int | None, dict[str, Any]]] = []
    for event in events:
        normalized = _normalize_v0_event(_clone(event), session_id, state)
        items.append((event["seq"], normalized))
    output, mapping = _rebuild(items)
    for event in output:
        _remap_references(event, mapping)
    _assert_types(output, _V1_EVENT_TYPES, 1)
    return {**header, "version": 1}, output


def _chunk_data(event: dict[str, Any]) -> dict[str, Any]:
    data = event["data"]
    if not all(isinstance(data.get(k), int) for k in ("turn", "step")):
        raise SessionFormatError(f"assistant/chunk @seq {event['seq']} 缺少 turn/step")
    if "chunk" not in data:
        raise SessionFormatError(f"assistant/chunk @seq {event['seq']} 缺少 chunk")
    return {"time": event["time"], "chunk": _clone(data["chunk"])}


def _migrate_v1_to_v2(header: dict[str, Any], events: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    _assert_types(events, _V1_EVENT_TYPES, 1)
    chunks: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for event in events:
        if event["type"] == "assistant/chunk":
            data = event["data"]
            key = (int(data["turn"]), int(data["step"]))
            chunks.setdefault(key, []).append(event)

    claimed: dict[int, list[dict[str, Any]]] = {}
    for event in events:
        if event["type"] != "assistant/message":
            continue
        key = (int(event["data"].get("turn", 0)), int(event["data"].get("step", 0)))
        candidates = [c for c in chunks.get(key, []) if c["seq"] < event["seq"] and c["seq"] not in claimed]
        if candidates:
            claimed[event["seq"]] = [_chunk_data(c) for c in candidates]
            for chunk in candidates:
                claimed[chunk["seq"]] = []

    # 未被认领的 chunk 按 key 归组,在最后一个 chunk 位置生成 assistant/attempt。
    unclaimed_by_key: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for event in events:
        if event["type"] == "assistant/chunk" and event["seq"] not in claimed:
            unclaimed_by_key.setdefault((int(event["data"]["turn"]), int(event["data"]["step"])), []).append(event)

    items: list[tuple[int | None, dict[str, Any]]] = []
    emitted_attempt: set[tuple[int, int]] = set()
    for event in events:
        if event["type"] == "assistant/chunk":
            key = (int(event["data"]["turn"]), int(event["data"]["step"]))
            members = unclaimed_by_key.get(key, [])
            if key not in emitted_attempt and members and event["seq"] == members[-1]["seq"]:
                attempt = _clone(event)
                attempt["type"] = "assistant/attempt"
                attempt["data"] = {
                    "turn": key[0],
                    "step": key[1],
                    "stream": [_chunk_data(c) for c in members],
                }
                items.append((event["seq"], attempt))
                emitted_attempt.add(key)
            continue
        copied = _clone(event)
        if copied["type"] == "assistant/message" and copied["seq"] in claimed:
            stream = claimed[copied["seq"]]
            if isinstance(stream, list) and stream:
                copied["data"]["stream"] = stream
                copied["data"].pop("chunkRef", None)
        items.append((event["seq"], copied))
    output, mapping = _rebuild(items)
    for event in output:
        _remap_references(event, mapping)
    _assert_types(output, _V2_EVENT_TYPES, 2)
    if any(event["type"] == "assistant/chunk" for event in output):
        raise SessionFormatUnsupportedMigrationError("v1→v2 后仍有未消费的 assistant/chunk")
    return {**header, "version": 2}, output


def _convert_preset_identifier(value: Any) -> Any:
    return "ptc" if value == "code" else value


def _rename_ptc_plugin(source: Any) -> None:
    if isinstance(source, dict) and source.get("kind") == "plugin" and source.get("plugin") == "tools-code-mode":
        source["plugin"] = "tools-ptc"


def _lift_header_system(event: dict[str, Any]) -> str | None:
    header = event["data"].get("header")
    if not isinstance(header, dict):
        raise SessionFormatError(f"request/header @seq {event['seq']} 缺少 header")
    had_system = "system" in header
    value = header.pop("system", None)
    if value is None and had_system:
        return ""
    if value is None:
        return None
    if not isinstance(value, str):
        raise SessionFormatError(f"request/header @seq {event['seq']} header.system 必须是字符串")
    return value


def _system_message(anchor: dict[str, Any], prompt: str, session_id: str) -> dict[str, Any]:
    data = anchor["data"]
    turn = data.get("turn")
    step = data.get("step")
    if not isinstance(turn, int) or not isinstance(step, int):
        raise SessionFormatUnsupportedMigrationError("系统头节点没有开放的 step 可归属")
    msg_id = _hash_id("v2-to-v3-system-", ["session-format-v2-to-v3", session_id, anchor["seq"], anchor["type"]])
    content = [] if prompt == "" else [{"type": "text", "text": prompt}]
    return {
        "type": "system/message",
        "seq": -1,
        "time": anchor["time"],
        "data": {
            "turn": turn,
            "step": step,
            "message": {
                "id": msg_id,
                "role": "system",
                "content": content,
                "source": {"kind": "plugin", "plugin": "@deepseek-ai/dsh-system-prompt"},
            },
        },
    }


def _normalize_v3_envelope(event: dict[str, Any]) -> None:
    surface = event.get("surfaceOp")
    if isinstance(surface, dict) and surface.get("op") == "replace":
        if "start" in surface or "end" in surface:
            surface["startSeq"] = surface.pop("start")
            surface["endSeq"] = surface.pop("end")


def _migrate_v2_to_v3(header: dict[str, Any], events: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    _assert_types(events, _V2_EVENT_TYPES, 2)
    session_id = header["id"]
    items: list[tuple[int | None, dict[str, Any]]] = []
    head_position: int | None = None
    open_step: dict[str, Any] | None = None
    first_step_seen = False
    current_prompt = ""
    for event in events:
        copied = _clone(event)
        if copied["type"] == "agent-preset/selected":
            copied["data"]["agentPreset"] = _convert_preset_identifier(copied["data"].get("agentPreset"))
        if copied["type"] == "step/start":
            open_step = copied
            if not first_step_seen:
                first_step_seen = True
                head = _system_message(copied, "", session_id)
                items.append((None, head))
                head_position = len(items) - 1
        elif copied["type"] == "step/end":
            open_step = None
        elif copied["type"] == "request/header":
            prompt = _lift_header_system(copied)
            header_payload = copied["data"].get("header")
            if isinstance(header_payload, dict):
                if header_payload.get("tools") == []:
                    header_payload.pop("tools", None)
                if header_payload.get("adapterDefaults") == {}:
                    header_payload.pop("adapterDefaults", None)
            if prompt is not None and prompt != current_prompt:
                anchor = open_step or copied
                if not isinstance(anchor["data"].get("turn"), int) or not isinstance(anchor["data"].get("step"), int):
                    raise SessionFormatUnsupportedMigrationError(
                        f"request/header @seq {copied['seq']} 改系统提示词时没有开放 step"
                    )
                if head_position is not None and items[head_position][1]["data"]["message"]["content"] == []:
                    items.pop(head_position)
                    head_position = None
                items.append((None, _system_message(anchor, prompt, session_id)))
                current_prompt = prompt
        if copied["type"] == "tool/code-dispatch-start":
            copied["type"] = "tool/ptc-dispatch-start"
        elif copied["type"] == "tool/code-dispatch":
            copied["type"] = "tool/ptc-dispatch"
        data = copied["data"]
        _rename_ptc_plugin(data.get("source"))
        if copied["type"] == "user/message":
            _rename_ptc_plugin(data.get("source"))
        for message in _message_positions(data):
            _rename_ptc_plugin(message.get("source"))
        _normalize_v3_envelope(copied)
        items.append((event["seq"], copied))
    if isinstance(header.get("agentPreset"), str):
        header = {**header, "agentPreset": _convert_preset_identifier(header["agentPreset"])}
    output, mapping = _rebuild(items)
    for event in output:
        _remap_references(event, mapping)
    _assert_types(output, _V3_EVENT_TYPES, 3)
    return {**header, "version": 3}, output


def _message_positions(data: dict[str, Any]) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    message = data.get("message")
    if isinstance(message, dict):
        messages.append(message)
    inserted = data.get("inserted")
    if isinstance(inserted, list):
        messages.extend(item for item in inserted if isinstance(item, dict))
    listed = data.get("messages")
    if isinstance(listed, list):
        messages.extend(item for item in listed if isinstance(item, dict))
    return messages


def _convert_content_tags(content: Any) -> None:
    if not isinstance(content, list):
        return
    for block in content:
        if not isinstance(block, dict):
            continue
        kind = block.get("type")
        if isinstance(kind, str) and kind not in _CONTENT_TYPES_V3:
            block["type"] = f"plugin:{kind}"


def _convert_source(source: Any, role: Any) -> None:
    if not isinstance(source, dict):
        return
    if source.get("kind") != "plugin":
        return
    plugin = source.get("plugin")
    if not isinstance(plugin, str):
        return
    source.pop("plugin", None)
    if plugin == "@deepseek-ai/dsh-system-prompt":
        source["kind"] = "system-prompt" if role == "system" else "runtime-context"
    elif plugin in _PLUGIN_KIND_MAP:
        source["kind"] = _PLUGIN_KIND_MAP[plugin]
    elif plugin in _FIRST_PARTY_PLUGINS:
        source["kind"] = plugin
    else:
        source["kind"] = f"plugin:{plugin}"


def _lift_tool_result(message: dict[str, Any], where: str) -> dict[str, Any]:
    if message.get("role") != "user":
        return message
    source = message.get("source")
    content = message.get("content")
    if not isinstance(source, dict) or source.get("kind") != "tool":
        return message
    call_id = source.get("callId")
    if not isinstance(call_id, str) or not call_id:
        raise SessionFormatError(f"{where} source.callId 非法")
    if not isinstance(content, list) or len(content) != 1:
        raise SessionFormatUnsupportedMigrationError(f"{where} 不是恰好一个 tool-result wrapper")
    wrapper = content[0]
    if not isinstance(wrapper, dict) or wrapper.get("type") != "tool-result":
        raise SessionFormatUnsupportedMigrationError(f"{where} 不是 canonical tool-result wrapper")
    if wrapper.get("toolCallId") != call_id:
        raise SessionFormatError(f"{where} toolCallId 与 source.callId 不一致")
    if not isinstance(wrapper.get("content"), list):
        raise SessionFormatError(f"{where} tool-result content 必须是数组")
    lifted: dict[str, Any] = {
        "id": message.get("id"),
        "role": "tool",
        "source": _clone(source),
        "toolCallId": call_id,
        "content": _clone(wrapper["content"]),
    }
    if "isError" in wrapper:
        if not isinstance(wrapper["isError"], bool):
            raise SessionFormatError(f"{where} isError 必须是布尔")
        lifted["isError"] = wrapper["isError"]
    for key, value in wrapper.items():
        if key not in ("type", "toolCallId", "content", "isError"):
            lifted[f"plugin:result:{key}"] = _clone(value)
    for key, value in message.items():
        if key not in ("id", "role", "source", "content"):
            lifted[f"plugin:message:{key}"] = _clone(value)
    return lifted


def _migrate_v3_to_v4(header: dict[str, Any], events: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    _assert_types(events, _V3_EVENT_TYPES, 3, allow_ignorable=True)
    items: list[tuple[int | None, dict[str, Any]]] = []
    for event in events:
        copied = _clone(event)
        etype = copied["type"]
        if etype == "tool/result":
            message = copied["data"].get("message")
            if isinstance(message, dict):
                copied["data"]["message"] = _lift_tool_result(message, f"tool/result @seq {copied['seq']}")
        if etype in ("user/message", "system/message", "developer/message", "assistant/message", "tool/result"):
            data = copied["data"]
            if etype == "user/message":
                _convert_source(data.get("source"), data.get("role"))
                _convert_content_tags(data.get("content"))
            else:
                message = data.get("message")
                if isinstance(message, dict):
                    _convert_source(message.get("source"), message.get("role"))
                    _convert_content_tags(message.get("content"))
        if etype == "agent/inbox/spliced":
            for message in copied["data"].get("inserted", []) if isinstance(copied["data"].get("inserted"), list) else []:
                if isinstance(message, dict):
                    _convert_source(message.get("source"), message.get("role"))
                    _convert_content_tags(message.get("content"))
        if etype == "session/title-llm-request":
            for message in copied["data"].get("messages", []) if isinstance(copied["data"].get("messages"), list) else []:
                if isinstance(message, dict):
                    _convert_source(message.get("source"), message.get("role"))
                    _convert_content_tags(message.get("content"))
        stream = copied["data"].get("stream")
        if isinstance(stream, list):
            for record in stream:
                chunk = record.get("chunk") if isinstance(record, dict) else None
                if not isinstance(chunk, dict):
                    continue
                if chunk.get("type") == "block-start" and isinstance(chunk.get("blockType"), str):
                    if chunk["blockType"] not in _CONTENT_TYPES_V3:
                        chunk["blockType"] = f"plugin:{chunk['blockType']}"
                block = chunk.get("block")
                if isinstance(block, dict):
                    _convert_content_tags([block])
        if etype == "request/header":
            header_payload = copied["data"].get("header")
            if isinstance(header_payload, dict):
                tools = header_payload.get("tools")
                if isinstance(tools, list):
                    for tool in tools:
                        if isinstance(tool, dict) and "deferLoading" in tool:
                            raise SessionFormatUnsupportedMigrationError(
                                f"request/header @seq {copied['seq']} 的 deferLoading 在 V3 无历史含义"
                            )
        if etype not in _V4_EVENT_TYPES:
            if copied.get("ignorable") is True:
                copied["type"] = f"plugin:{etype}"
            else:
                raise SessionFormatUnsupportedMigrationError(f"v3→v4 未知必需事件: {etype!r}")
        items.append((event["seq"], copied))
    output, mapping = _rebuild(items)
    for event in output:
        _remap_references(event, mapping)
    return {**header, "version": 4}, output


_EDGES = {
    1: _migrate_v0_to_v1,
    2: _migrate_v1_to_v2,
    3: _migrate_v2_to_v3,
    4: _migrate_v3_to_v4,
}


def migrate_session(
    header: dict[str, Any],
    events: Sequence[dict[str, Any]],
    *,
    target_version: int = 4,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """把会话从 header.version 迁到 ``target_version``(含逐边拒绝)。"""
    if target_version not in VERSIONS:
        raise SessionFormatUnsupportedMigrationError(f"未知目标格式版本: {target_version}")
    current_header = _clone(header)
    source_version = _header_version(current_header)
    if target_version < source_version:
        raise SessionFormatUnsupportedMigrationError("不支持降级迁移")
    current_events = _clone(_event_list(events))
    for version in range(source_version + 1, target_version + 1):
        edge = _EDGES[version]
        current_header, current_events = edge(current_header, current_events)
        current_header = {**current_header, "version": version}
    return current_header, current_events


def migrate_session_events(
    header: dict[str, Any],
    events: Sequence[dict[str, Any]],
    *,
    target_version: int = 4,
) -> list[dict[str, Any]]:
    """便捷出口:只返回迁移后的事件数组。"""
    return migrate_session(header, events, target_version=target_version)[1]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
