# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部会话导入解析器测试(D28,B1,2026-09-20 立)。

覆盖四个来源的真实导出形态(JSONL / JSON 数组 / state.vscdb SQLite / aider Markdown)、
IR 收口(角色白名单、密钥脱敏、ANSI 剥离、体积截断、时间戳归一)与入口契约
(非法 source / 空文件抛 ValueError)。
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

import pytest

from app.services.importers import SOURCES, parse_conversation_file
from app.services.importers.ir import (
    MAX_CONVERSATIONS,
    MAX_MESSAGES_PER_CONVERSATION,
    Conversation,
    Message,
    ParseResult,
    finalize,
    to_iso,
)

# epoch 1_756_800_000 秒 == 2025-09-02T08:00:00Z(同一时刻的四种量级写法)
_EPOCH_ISO = "2025-09-02T08:00:00Z"


def _jsonl(records: list[dict[str, Any]]) -> bytes:
    return "\n".join(json.dumps(r, ensure_ascii=False) for r in records).encode("utf-8")


# ---------------------------------------------------------------------------
# Claude Code
# ---------------------------------------------------------------------------


def test_claude_code_jsonl_ai_title_and_tool_folding() -> None:
    """真机实证:标题来自 ai-title(非 summary),tool_use 折进正文,tool_result 只计数。"""
    blob = _jsonl(
        [
            {
                "type": "user",
                "sessionId": "s1",
                "uuid": "u1",
                "timestamp": "2026-09-01T08:00:00.000Z",
                "message": {"role": "user", "content": "帮我看下这个函数"},
            },
            {
                "type": "assistant",
                "sessionId": "s1",
                "uuid": "u2",
                "timestamp": "2026-09-01T08:00:05.000Z",
                "message": {
                    "role": "assistant",
                    "model": "claude-sonnet-4-5",
                    "content": [
                        {"type": "thinking", "thinking": "内部推理不该进会话"},
                        {"type": "tool_use", "name": "Read", "id": "t1",
                         "input": {"file_path": "src/a.py", "limit": 50, "verbose": True}},
                        {"type": "text", "text": "这个函数有个边界问题。"},
                    ],
                },
            },
            {
                # 纯 tool_result 的 user 记录:正文不落地,只计入告警
                "type": "user",
                "sessionId": "s1",
                "uuid": "u3",
                "message": {
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": "t1", "content": "整个文件内容"}],
                },
            },
            {
                "type": "user",
                "sessionId": "s1",
                "uuid": "u4",
                "isSidechain": True,
                "message": {"role": "user", "content": "子 agent 分支不该出现"},
            },
            {"type": "ai-title", "sessionId": "s1", "aiTitle": "旧标题"},
            {"type": "ai-title", "sessionId": "s1", "aiTitle": "函数边界问题排查"},
        ]
    )
    parsed, warnings, truncated = parse_conversation_file("claude_code", "s1.jsonl", blob)
    assert truncated is False
    convs = parsed["conversations"]
    assert len(convs) == 1
    assert convs[0]["title"] == "函数边界问题排查"  # 后者覆盖前者
    assert convs[0]["model"] == "claude-sonnet-4-5"
    assert convs[0]["sourceCreatedAt"] == "2026-09-01T08:00:00Z"
    assert convs[0]["sourceUpdatedAt"] == "2026-09-01T08:00:05Z"
    assert [m["content"] for m in convs[0]["messages"]] == [
        "帮我看下这个函数",
        "[工具调用] Read(file_path=src/a.py, limit=50)\n这个函数有个边界问题。",
    ]
    assert any("工具输出正文未纳入" in w for w in warnings)


def test_claude_code_pure_sidechain_file_still_imports() -> None:
    """agent-<id>.jsonl 整份都是子 agent 转写:必须按主线导入,不能返回空。"""
    blob = _jsonl(
        [
            {
                "type": "user",
                "sessionId": "sub1",
                "isSidechain": True,
                "message": {"role": "user", "content": "子任务开始"},
            },
            {
                "type": "assistant",
                "sessionId": "sub1",
                "isSidechain": True,
                "message": {"role": "assistant", "content": "子任务完成"},
            },
        ]
    )
    parsed, _w, _t = parse_conversation_file("claude_code", "agent-a1b2c3.jsonl", blob)
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == [
        "子任务开始",
        "子任务完成",
    ]


def test_claude_code_splits_sessions_and_skips_meta() -> None:
    blob = _jsonl(
        [
            {"type": "user", "sessionId": "a", "message": {"role": "user", "content": "第一个"}},
            {
                "type": "user",
                "sessionId": "b",
                "isMeta": True,
                "message": {"role": "user", "content": "本地命令回显"},
            },
            {"type": "user", "sessionId": "b", "message": {"role": "user", "content": "第二个"}},
        ]
    )
    parsed, _w, _t = parse_conversation_file("claude_code", "export.jsonl", blob)
    assert [c["messages"][0]["content"] for c in parsed["conversations"]] == ["第一个", "第二个"]


def test_claude_code_json_array_and_corrupt_line() -> None:
    blob = json.dumps([{"type": "user", "message": {"role": "user", "content": "hi"}}]).encode()
    blob += b"\n{not-json\n"
    parsed, warnings, _t = parse_conversation_file("claude_code", "export.json", blob)
    assert len(parsed["conversations"]) == 1
    assert any("无法解析" in w for w in warnings)


# ---------------------------------------------------------------------------
# Codex
# ---------------------------------------------------------------------------


def test_codex_prefers_response_items_without_duplicates() -> None:
    blob = _jsonl(
        [
            {"type": "session_meta", "timestamp": "2026-09-02T10:00:00Z", "payload": {"id": "r1"}},
            {"type": "turn_context", "payload": {"model": "gpt-5-codex"}},
            {
                "type": "response_item",
                "timestamp": "2026-09-02T10:00:01Z",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "<environment_context>…"}],
                },
            },
            {
                "type": "response_item",
                "timestamp": "2026-09-02T10:00:02Z",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "修一下这个测试"}],
                },
            },
            {
                "type": "response_item",
                "timestamp": "2026-09-02T10:00:03Z",
                "payload": {"type": "reasoning", "summary": ["不该落地"]},
            },
            {
                "type": "response_item",
                "timestamp": "2026-09-02T10:00:04Z",
                "payload": {
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": "已修复。"}],
                },
            },
            {"type": "event_msg", "payload": {"type": "user_message", "message": "修一下这个测试"}},
            {"type": "event_msg", "payload": {"type": "agent_message", "message": "已修复。"}},
        ]
    )
    parsed, _w, truncated = parse_conversation_file("codex", "rollout-1.jsonl", blob)
    assert truncated is False
    conv = parsed["conversations"][0]
    assert conv["model"] == "gpt-5-codex"
    assert conv["sourceCreatedAt"] == "2026-09-02T10:00:00Z"
    assert [(m["role"], m["content"]) for m in conv["messages"]] == [
        ("user", "修一下这个测试"),
        ("assistant", "已修复。"),
    ]


def test_codex_falls_back_to_events_and_never_splits_on_meta() -> None:
    """上游实证:文件中途再出现的 session_meta 是 fork 父线程历史,不得另起会话。"""
    blob = _jsonl(
        [
            {"type": "session_meta", "payload": {"id": "r2", "timestamp": "2026-09-03T00:00:00Z"}},
            {"type": "event_msg", "payload": {"type": "user_message", "message": "第一轮"}},
            {"type": "event_msg", "payload": {"type": "agent_message", "message": "回答一"}},
            {"type": "session_meta", "payload": {"id": "r1-fork-parent"}},
            {"type": "event_msg", "payload": {"type": "user_message", "message": "第二轮"}},
        ]
    )
    parsed, _w, _t = parse_conversation_file("codex", "rollout-2.jsonl", blob)
    convs = parsed["conversations"]
    assert len(convs) == 1  # 一个文件一条会话
    assert convs[0]["sourceCreatedAt"] == "2026-09-03T00:00:00Z"  # 首条 meta 为准
    assert [m["content"] for m in convs[0]["messages"]] == ["第一轮", "回答一", "第二轮"]


def test_codex_modern_event_msg_item_completed_and_developer_warning() -> None:
    """真机新版 rollout:event_msg 走 item_completed + `Text` 块;developer 单独计数告警。"""
    blob = _jsonl(
        [
            {"type": "session_meta", "timestamp": "2026-09-06T10:00:00Z", "payload": {"id": "r9"}},
            {
                "type": "event_msg",
                "payload": {
                    "type": "item_completed",
                    "item": {
                        "type": "UserMessage",
                        "content": [{"type": "Text", "text": "新版提问"}],
                    },
                },
            },
            {
                "type": "event_msg",
                "payload": {
                    "type": "item_completed",
                    "item": {
                        "type": "AgentMessage",
                        "content": [{"type": "Text", "text": "新版回答"}],
                    },
                },
            },
            {"type": "event_msg", "payload": {"type": "token_count", "info": {"total": 1}}},
            {
                "type": "event_msg",
                "payload": {"type": "task_complete", "last_agent_message": "收尾播报"},
            },
            {
                "type": "response_item",
                "payload": {"type": "message", "role": "developer", "content": [{"type": "input_text", "text": "注入指令"}]},
            },
            {
                "type": "compacted",
                "payload": {"message": "前文摘要:已讨论过 A 与 B"},
            },
        ]
    )
    parsed, warnings, truncated = parse_conversation_file("codex", "rollout-new.jsonl", blob)
    assert truncated is False
    conv = parsed["conversations"][0]  # 无 response_item.message → 回退 event 通道
    assert [(m["role"], m["content"]) for m in conv["messages"]] == [
        ("user", "新版提问"),
        ("assistant", "新版回答"),
        ("assistant", "收尾播报"),
        ("system", "前文摘要:已讨论过 A 与 B"),
    ]
    assert any("developer 注入指令" in w for w in warnings)


# ---------------------------------------------------------------------------
# Cursor
# ---------------------------------------------------------------------------


def _composer() -> dict[str, Any]:
    return {
        "_id": "c1",
        "name": "Cursor 会话",
        "createdAt": 1_756_800_000_000,
        "allMessages": [{"text": "帮我加个按钮"}, {"text": "已经加好了"}],
    }


def _vscdb(kv_rows: list[tuple[str, str]], item_rows: list[tuple[str, str]] | None = None) -> bytes:
    """构造真实形态的 state.vscdb:cursorDiskKV 存正文,ItemTable 存索引。"""
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
    conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
    conn.executemany("INSERT INTO cursorDiskKV VALUES (?, ?)", [(k, v.encode()) for k, v in kv_rows])
    conn.executemany("INSERT INTO ItemTable VALUES (?, ?)", [(k, v.encode()) for k, v in item_rows or []])
    blob = conn.serialize()
    conn.close()
    return blob


MODERN_COMPOSER = json.dumps(
    {
        "_v": 3,
        "composerId": "c1",
        "name": "重构支付模块",
        "createdAt": 1_756_800_000_000,
        "lastUpdatedAt": 1_756_800_300_000,
        "modelConfig": {"modelModel": "gpt-5.1"},
        "fullConversationHeadersOnly": [
            {"bubbleId": "b1", "type": 1},
            {"bubbleId": "b2", "type": 2},
            {"bubbleId": "b3", "type": 2},
            {"bubbleId": "b4", "type": 2},
        ],
    }
)
BUBBLES = [
    ('{"_v":3,"bubbleId":"b1","type":1,"text":"帮我重构支付模块","createdAt":"2025-09-02T08:00:05Z"}'),
    '{"_v":3,"bubbleId":"b2","type":2,"text":"已完成重构","modelInfo":{"modelName":"gpt-5.1-codex"}}',
    '{"_v":3,"bubbleId":"b3","type":2,"capabilityType":15,"toolFormerData":{"name":"EditFile"}}',
    '{"_v":3,"bubbleId":"b4","type":2,"text":"占位不该出现","capabilityType":30}',
]


def test_cursor_vscdb_modern_bubble_indirection() -> None:
    """上游实证:composerData 只有索引,正文在 bubbleId 行,角色是数字 type。"""
    kv = [("composerData:c1", MODERN_COMPOSER)] + [
        (f"bubbleId:c1:b{i}", body) for i, body in enumerate(BUBBLES, start=1)
    ]
    parsed, warnings, truncated = parse_conversation_file("cursor", "state.vscdb", _vscdb(kv))
    assert truncated is False and warnings == []
    conv = parsed["conversations"][0]
    assert conv["title"] == "重构支付模块"
    assert conv["model"] == "gpt-5.1"  # composer 级 modelConfig 优先
    assert conv["sourceCreatedAt"] == _EPOCH_ISO
    assert conv["sourceUpdatedAt"] == "2025-09-02T08:05:00Z"
    assert [(m["role"], m["content"]) for m in conv["messages"]] == [
        ("user", "帮我重构支付模块"),
        ("assistant", "已完成重构"),
        ("assistant", "[工具调用] EditFile"),
    ]
    assert conv["messages"][0]["createdAt"] == "2025-09-02T08:00:05Z"


def test_cursor_vscdb_buffers_prefix_and_index_only_row() -> None:
    """`buffers:` 前缀与 ItemTable 索引行都要能吃下。"""
    kv = [("composerData:c2", "buffers:" + json.dumps({
        "composerId": "c2",
        "name": "带前缀的会话",
        "conversation": [{"bubbleId": "x1", "type": 1, "text": "老版内联正文"},
                          {"bubbleId": "x2", "type": 2, "text": "老版回复"}],
    }))]
    item = [("composer.composerHeaders", json.dumps({"allComposers": [{"composerId": "c2"}]}))]
    parsed, _w, _t = parse_conversation_file("cursor", "state.vscdb", _vscdb(kv, item))
    conv = parsed["conversations"][0]
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant"]
    assert conv["messages"][1]["content"] == "老版回复"


def test_cursor_legacy_aichat_chatdata_fallback() -> None:
    payload = json.dumps({"tabs": [{"bubbles": [
        {"type": "user", "rawText": "老版提问"},
        {"type": "ai", "text": "老版回答"},
    ]}]})
    parsed, _w, _t = parse_conversation_file(
        "cursor", "state.vscdb", _vscdb([], [("workbench.panel.aichat.view.aichat.chatdata", payload)])
    )
    conv = parsed["conversations"][0]
    assert [(m["role"], m["content"]) for m in conv["messages"]] == [
        ("user", "老版提问"),
        ("assistant", "老版回答"),
    ]


def test_cursor_orphan_bubbles_require_timestamps() -> None:
    """无索引数组时按 createdAt 排序兜底;缺时间戳则顺序不可靠,不硬给错序。"""
    with_stamps = [
        ("composerData:c3", '{"composerId":"c3","name":"孤儿气泡"}'),
        ("bubbleId:c3:b2", '{"bubbleId":"b2","type":2,"text":"答","createdAt":"2026-01-02T00:00:01Z"}'),
        ("bubbleId:c3:b1", '{"bubbleId":"b1","type":1,"text":"问","createdAt":"2026-01-02T00:00:00Z"}'),
    ]
    parsed, _w, _t = parse_conversation_file("cursor", "state.vscdb", _vscdb(with_stamps))
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == ["问", "答"]

    _empty, warnings, _t2 = parse_conversation_file(
        "cursor",
        "state.vscdb",
        _vscdb([
            ("composerData:c4", '{"composerId":"c4"}'),
            ("bubbleId:c4:b1", '{"type":1,"text":"没有时间戳"}'),
        ]),
    )
    assert any("未能组装出消息" in w for w in warnings)


def test_cursor_agent_transcript_ndjson() -> None:
    """cursor-agent 走另一套格式:~/.cursor/projects/<cwd>/agent-transcripts/<id>.jsonl。"""
    lines = [
        '{"role":"user","message":{"content":[{"type":"text","text":"agent 提问"}]}}',
        '{"type":"turn_ended","status":"success"}',
        '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"shell"},'
        '{"type":"text","text":"agent 回答"}]}}',
    ]
    parsed, _w, _t = parse_conversation_file(
        "cursor", "0f0f0f0f.jsonl", "\n".join(lines).encode("utf-8")
    )
    assert [m["content"] for m in parsed["conversations"][0]["messages"]] == ["agent 提问", "agent 回答"]


def test_cursor_corrupt_db_degrades_to_warning() -> None:
    parsed, warnings, _t = parse_conversation_file("cursor", "state.vscdb", b"not a sqlite file")
    assert parsed["conversations"] == []
    assert any("会话库无法读取" in w for w in warnings)


def test_cursor_distinguishes_empty_db_from_unrecognized_shape() -> None:
    """三种空态必须给不同诊断,不能一律报"没找到 composer"。"""
    _empty, warnings_a, _t = parse_conversation_file(
        "cursor", "state.vscdb", _vscdb([("workbench.layout", '{"a":1}')])
    )
    assert any("没有 composer 记录" in w for w in warnings_a)

    _empty2, warnings_b, _t2 = parse_conversation_file(
        "cursor",
        "state.vscdb",
        _vscdb([("composerData:c9", '{"composerId":"c9","fullConversationHeadersOnly":[]}')]),
    )
    assert any("未能组装出消息" in w for w in warnings_b)


def test_cursor_json_export_still_supported() -> None:
    blob = json.dumps({"conversations": [_composer()]}).encode()
    parsed, _w, _t = parse_conversation_file("cursor", "export.json", blob)
    conv = parsed["conversations"][0]
    assert conv["title"] == "Cursor 会话"
    assert conv["sourceCreatedAt"] == _EPOCH_ISO
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant"]
    assert "createdAt" not in conv["messages"][0]  # composer 单条无时间戳,不硬造


# ---------------------------------------------------------------------------
# Aider
# ---------------------------------------------------------------------------

# 用行数组构造:aider 的 markdown 硬换行是行尾两个空格,写成字面量会撞上 ruff W291
AIDER_MD = (
    "\n".join(
        [
            "# aider chat started at 2026-09-04 09:30:00",
            "",
            "> Aider v0.69.0  ",
            "> Main model: claude-3-5-sonnet-20241022 with architect edit format  ",
            "> Editor model: gpt-4o with editor-diff edit format  ",
            "> Error: Read-only file .ai/tools.md does not exist  ",
            "> Repo-map: using 1024 tokens  ",
            "",
            "#### /add main.py",
            "#### 帮我改一下 main.py  ",
            "",
            "我先看下 main.py。",
            "",
            "```python",
            "> 这行在围栏里,不是用户输入",
            "```",
            "",
            "#### 第二个提问",
            "",
            "改动已经完成。",
            "",
            "# aider chat started at 2026-09-05 10:00:00",
            "",
            "#### 第二段会话的第一句",
        ]
    )
    + "\n"
)


def test_aider_markdown_user_is_hash_hash_and_echoes_dropped() -> None:
    """上游实证:#### 才是用户输入,`> ` 是 aider 回显(模型横幅也在其上)。"""
    parsed, warnings, _t = parse_conversation_file(
        "aider", ".aider.chat.history.md", AIDER_MD.encode()
    )
    convs = parsed["conversations"]
    assert len(convs) == 2
    first = convs[0]
    assert first["model"] == "claude-3-5-sonnet-20241022"  # 认 Main model,不取 Editor model
    assert first["sourceCreatedAt"] == "2026-09-04T09:30:00Z"
    assert [m["role"] for m in first["messages"]] == ["user", "assistant", "user", "assistant"]
    assert first["messages"][0]["content"] == "/add main.py\n帮我改一下 main.py"
    assert "> 这行在围栏里,不是用户输入" in first["messages"][1]["content"]
    assert first["messages"][2]["content"] == "第二个提问"
    assert first["messages"][3]["content"] == "改动已经完成。"
    assert "Read-only file" not in str(convs)  # aider 的报错横幅绝不能变成会话内容
    assert not any(ln.endswith("  ") for m in first["messages"] for ln in m["content"].split("\n"))
    assert any("aider 自身回显" in w for w in warnings)
    assert convs[1]["messages"][0]["content"] == "第二段会话的第一句"


def test_aider_record_json() -> None:
    blob = json.dumps({"messages": [{"role": "user", "content": "hello aider"}]}).encode()
    parsed, _w, _t = parse_conversation_file("aider", ".aider.chat.record.json", blob)
    assert parsed["conversations"][0]["messages"][0]["content"] == "hello aider"


# ---------------------------------------------------------------------------
# 收口与入口契约
# ---------------------------------------------------------------------------


def test_finalize_drops_unknown_roles_and_redacts_secrets() -> None:
    result = ParseResult(
        conversations=[
            Conversation(
                messages=[
                    Message("user", "我的 key 是 sk-ant-abcdefghijklmnopqrstuvwxyz"),
                    Message("tool", "非法角色应被丢弃"),
                    Message("assistant", "   "),
                ]
            )
        ]
    )
    parsed, warnings, truncated = finalize(result, source="codex")
    messages = parsed["conversations"][0]["messages"]
    assert [m["role"] for m in messages] == ["user"]
    assert "[REDACTED_SECRET]" in messages[0]["content"]
    assert truncated is False
    assert any("角色" in w for w in warnings)
    assert any("空内容" in w for w in warnings)


def test_finalize_caps_messages_and_marks_truncated() -> None:
    msgs = [Message("user", f"第 {i} 条") for i in range(MAX_MESSAGES_PER_CONVERSATION + 5)]
    parsed, _w, truncated = finalize(
        ParseResult([Conversation(messages=msgs)]), source="aider"
    )
    assert len(parsed["conversations"][0]["messages"]) == MAX_MESSAGES_PER_CONVERSATION
    assert truncated is True


def test_finalize_caps_conversation_count() -> None:
    convs = [
        Conversation(messages=[Message("user", f"会话 {i}")])
        for i in range(MAX_CONVERSATIONS + 3)
    ]
    parsed, _w, truncated = finalize(ParseResult(convs), source="claude_code")
    assert len(parsed["conversations"]) == MAX_CONVERSATIONS
    assert truncated is True


def test_finalize_truncates_oversized_content() -> None:
    result = ParseResult([Conversation(messages=[Message("user", "x" * 300_000)])])
    parsed, warnings, _t = finalize(result, source="cursor")
    content = parsed["conversations"][0]["messages"][0]["content"]
    assert len(content) < 300_000
    assert content.endswith("已截断]")
    assert any("已截断" in w for w in warnings)


def test_finalize_falls_back_to_first_user_message_as_title() -> None:
    msgs = [Message("assistant", "答"), Message("user", "问题标题")]
    parsed, _w, _t = finalize(ParseResult([Conversation(messages=msgs)]), source="codex")
    assert parsed["conversations"][0]["title"] == "问题标题"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (1_756_800_000, _EPOCH_ISO),  # epoch 秒
        (1_756_800_000_000, _EPOCH_ISO),  # epoch 毫秒
        (1_756_800_000_000_000, _EPOCH_ISO),  # epoch 微秒
        (1_756_800_000_000_000_000, _EPOCH_ISO),  # epoch 纳秒
        ("2026-09-01T08:00:00Z", "2026-09-01T08:00:00Z"),
        ("2026-09-01 08:00:00", "2026-09-01T08:00:00Z"),  # 无时区按 UTC
        ("2026-09-01T16:00:00+08:00", "2026-09-01T08:00:00Z"),  # 带时区换算 UTC
        ("1756800000000", _EPOCH_ISO),  # 数字字符串
        (0, "1970-01-01T00:00:00Z"),
    ],
)
def test_to_iso_normalizes(raw: Any, expected: str) -> None:
    assert to_iso(raw) == expected


@pytest.mark.parametrize(
    "raw", [None, "", "   ", "不是时间", "2026-99-99T00:00:00Z", True, [], {}, 1e30]
)
def test_to_iso_rejects_garbage(raw: Any) -> None:
    assert to_iso(raw) is None


def test_entry_rejects_unknown_source() -> None:
    assert set(SOURCES) == {"claude_code", "codex", "cursor", "aider"}
    with pytest.raises(ValueError, match="不支持的数据源"):
        parse_conversation_file("warp", "x.jsonl", b"{}")


def test_entry_rejects_empty_payload() -> None:
    with pytest.raises(ValueError, match="为空"):
        parse_conversation_file("codex", "rollout.jsonl", b"  \n ")


def test_entry_shape_matches_route_contract() -> None:
    """/parse 响应与 web 预览、api commitSchema 消费的字段名一致。"""
    blob = _jsonl([{"type": "user", "message": {"role": "user", "content": "hi"}}])
    parsed, warnings, truncated = parse_conversation_file("claude_code", "s.jsonl", blob)
    assert isinstance(warnings, list) and isinstance(truncated, bool)
    assert set(parsed) == {"conversations"}
    conv = parsed["conversations"][0]
    assert set(conv) == {"source", "messages", "title"}
    assert set(conv["messages"][0]) == {"role", "content"}


async def test_route_resolves_real_importers(client) -> None:
    """端到端:路由惰性导入的是真实包(而非 test_session_import_route 的假模块)。"""
    blob = _jsonl(
        [
            {"type": "user", "message": {"role": "user", "content": "真实链路"}},
            {"type": "assistant", "message": {"role": "assistant", "content": "已接通"}},
        ]
    )
    resp = await client.post(
        "/api/session-import/parse",
        files={"file": ("export.jsonl", blob, "application/octet-stream")},
        data={"source": "claude_code"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["truncated"] is False
    assert body["warnings"] == []
    assert [m["content"] for m in body["conversations"][0]["messages"]] == ["真实链路", "已接通"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
