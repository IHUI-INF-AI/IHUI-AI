# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""决策链蒸馏 + 推理保留率自证 + 压缩链路接线测试(P1-②,2026-09-18 立)。

覆盖:
- extract_head_messages:配对组对齐切分 / 无 head 场景
- distill_decision_chain:推理提取(think 标签 / content blocks / reasoning 字段)、
  动作成败判定(JSON error / success=false / 非零 exit_code)、截断、超限丢最旧
- 块渲染 / 剥离 / 接续的幂等round-trip
- inject_decision_chain:注入摘要消息 / 不适用场景原样返回 / 入参零修改 / 尾部消息对象身份保持
- apply_decision_chain:开关关闭 → 逐零差异;异常 → 降级为不注入
- assess_reasoning_retention:无轮次 → 1.0 / 注入后显著提升 / 丢弃样本上限
- 指标:决策链条数 + 推理保留率进入压缩指标报告
"""

import json
from typing import Any

import pytest

from app.services import compaction_metrics as cm
from app.services import decision_chain as dc
from app.services.compaction_quality import assess_reasoning_retention


@pytest.fixture(autouse=True)
def _reset_metrics():
    """测试隔离:每个用例前后清空压缩指标进程内存储(报告断言不受污染)。"""
    cm.reset_compaction_metrics()
    yield
    cm.reset_compaction_metrics()


def _call(cid: str, name: str) -> dict[str, Any]:
    return {
        "id": cid,
        "type": "function",
        "function": {"name": name, "arguments": "{}"},
    }


def _history() -> list[dict[str, Any]]:
    """system + 3 个带工具调用的 assistant 轮次 + 尾部保留段(共 11 条)。"""
    return [
        {"role": "system", "content": "你是代码助手"},
        {"role": "user", "content": "把 A 文件改掉"},
        {
            "role": "assistant",
            "content": "先读 A 文件确认现有内容,再决定改法",
            "tool_calls": [_call("c1", "read_file")],
        },
        {"role": "tool", "tool_call_id": "c1", "content": '{"ok": true}'},
        {
            "role": "assistant",
            "content": "写入被拒(权限不足),改用申请流程",
            "tool_calls": [_call("c2", "write_file"), _call("c3", "run_command")],
        },
        {
            "role": "tool",
            "tool_call_id": "c2",
            "content": '{"error": "EACCES: permission denied"}',
        },
        {"role": "tool", "tool_call_id": "c3", "content": '{"exit_code": 1}'},
        {"role": "user", "content": "继续"},
        {
            "role": "assistant",
            "content": "申请已提交",
            "tool_calls": [_call("c4", "http_request")],
        },
        {"role": "tool", "tool_call_id": "c4", "content": '{"success": false, "message": "网关 502"}'},
        {"role": "assistant", "content": "结束"},
    ]


def _compressed(summary_body: str = "- user: 把 A 文件改掉") -> list[dict[str, Any]]:
    """模拟压缩产物:system + 摘要消息 + 尾部保留(与真实产物同构)。"""
    msgs = _history()
    return [
        msgs[0],
        {"role": "user", "content": f"[上下文摘要 — 之前 6 条消息已压缩]\n{summary_body}"},
        *msgs[7:],
    ]


# ---------------------------------------------------------------------------
# head 段切分
# ---------------------------------------------------------------------------


def test_extract_head_keeps_system_and_tail_groups():
    """head = 除 system 与尾部 keep_recent 配对组外的全部消息。"""
    head = dc.extract_head_messages(_history(), keep_recent=4)
    assert head is not None
    # 尾部 4 条(group: user继续 / assistant+tool / assistant结束)= msgs[7:]
    assert [m["content"] for m in head] == [
        "把 A 文件改掉",
        "先读 A 文件确认现有内容,再决定改法",
        '{"ok": true}',
        "写入被拒(权限不足),改用申请流程",
        '{"error": "EACCES: permission denied"}',
        '{"exit_code": 1}',
    ]


def test_extract_head_returns_none_when_all_in_tail():
    msgs = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]
    assert dc.extract_head_messages(msgs, keep_recent=6) is None


def test_extract_head_returns_none_when_too_few_messages():
    assert dc.extract_head_messages([{"role": "user", "content": "u"}], keep_recent=6) is None


# ---------------------------------------------------------------------------
# 蒸馏
# ---------------------------------------------------------------------------


def test_distill_extracts_reasoning_and_action_outcomes():
    lines = dc.distill_decision_chain(dc.extract_head_messages(_history(), 4) or [])
    assert lines == [
        "- 推理:先读 A 文件确认现有内容,再决定改法 | 动作:read_file(ok)",
        "- 推理:写入被拒(权限不足),改用申请流程 | "
        "动作:write_file(error: EACCES: permission denied), run_command(error: exit_code=1)",
    ]


def test_distill_flags_success_false_as_error():
    msgs = [
        {"role": "assistant", "content": "试网关", "tool_calls": [_call("x", "http_request")]},
        {
            "role": "tool",
            "tool_call_id": "x",
            "content": '{"success": false, "message": "网关 502"}',
        },
    ]
    lines = dc.distill_decision_chain(msgs)
    assert lines == ["- 推理:试网关 | 动作:http_request(error: 网关 502)"]


def test_distill_non_error_json_is_ok():
    """只认确定性失败信号:普通 JSON 结果(含 "error" 之外的字段)不得误判为失败。"""
    msgs = [
        {"role": "assistant", "content": "查一下", "tool_calls": [_call("x", "search")]},
        {"role": "tool", "tool_call_id": "x", "content": '{"total": 3, "error_rate": 0.0}'},
    ]
    assert dc.distill_decision_chain(msgs) == ["- 推理:查一下 | 动作:search(ok)"]


def test_distill_skips_non_dict_tool_calls_and_unknown_ids():
    msgs = [
        {
            "role": "assistant",
            "content": "调多个",
            "tool_calls": ["not-a-dict", _call("known", "a"), {"id": "unknown"}],
        },
        {"role": "tool", "tool_call_id": "known", "content": "ok"},
    ]
    lines = dc.distill_decision_chain(msgs)
    assert lines == ["- 推理:调多个 | 动作:?(ok), a(ok), ?(ok)"]


def test_distill_missing_reasoning_uses_placeholder():
    msgs = [
        {"role": "assistant", "content": "", "tool_calls": [_call("x", "ls")]},
        {"role": "tool", "tool_call_id": "x", "content": "ok"},
    ]
    assert dc.distill_decision_chain(msgs) == [f"- 推理:{dc.MISSING_REASONING} | 动作:ls(ok)"]


def test_distill_strips_thinking_tags_and_keeps_inner_text():
    msgs = [
        {
            "role": "assistant",
            "content": "<thinking>先确认</thinking>再动手",
            "tool_calls": [_call("x", "ls")],
        }
    ]
    assert dc.distill_decision_chain(msgs) == ["- 推理:先确认再动手 | 动作:ls(ok)"]


def test_distill_prefers_explicit_reasoning_field():
    msgs = [
        {
            "role": "assistant",
            "content": "正文",
            "reasoning": "显式推理字段优先",
            "tool_calls": [_call("x", "ls")],
        }
    ]
    assert dc.distill_decision_chain(msgs) == ["- 推理:显式推理字段优先 | 动作:ls(ok)"]


def test_distill_supports_content_blocks_and_truncates():
    msgs = [
        {
            "role": "assistant",
            "content": [{"type": "text", "text": "推理" * 200}],
            "tool_calls": [_call("x", "ls")],
        }
    ]
    line = dc.distill_decision_chain(msgs, reasoning_chars=20)[0]
    reasoning = line.split(" | ")[0].removeprefix("- 推理:")
    assert reasoning.endswith("…")
    assert len(reasoning) == 20


def test_distill_reasoning_chars_zero_drops_reasoning_text():
    msgs = [
        {"role": "assistant", "content": "有推理", "tool_calls": [_call("x", "ls")]},
    ]
    assert dc.distill_decision_chain(msgs, reasoning_chars=0) == [
        f"- 推理:{dc.MISSING_REASONING} | 动作:ls(ok)"
    ]


def test_distill_keeps_newest_entries_on_overflow():
    msgs: list[dict[str, Any]] = []
    for i in range(5):
        msgs.append(
            {
                "role": "assistant",
                "content": f"第{i}轮推理",
                "tool_calls": [_call(f"c{i}", "ls")],
            }
        )
    lines = dc.distill_decision_chain(msgs, max_entries=2)
    assert len(lines) == 2
    assert "第3轮推理" in lines[0]
    assert "第4轮推理" in lines[1]


def test_distill_ignores_plain_assistant_without_tool_calls():
    msgs = [{"role": "assistant", "content": "纯文本回答"}]
    assert dc.distill_decision_chain(msgs) == []


def test_distill_tolerates_non_dict_messages():
    assert dc.distill_decision_chain([None, "x", 1]) == []  # type: ignore[list-item]


# ---------------------------------------------------------------------------
# 块渲染 / 剥离 / 接续
# ---------------------------------------------------------------------------


def test_render_and_strip_round_trip():
    lines = ["- 推理:甲 | 动作:ls(ok)"]
    block = dc.render_decision_chain(lines)
    assert block.startswith(dc.BLOCK_START)
    assert block.endswith(dc.BLOCK_END)
    assert dc.extract_chain_lines(f"摘要正文\n{block}") == lines
    assert dc.strip_decision_chain(f"摘要正文\n{block}") == "摘要正文"


def test_render_empty_returns_empty_string():
    assert dc.render_decision_chain([]) == ""


def test_strip_is_noop_without_block():
    assert dc.strip_decision_chain("没有块的普通摘要") == "没有块的普通摘要"


def test_strip_tolerates_truncated_block():
    assert dc.strip_decision_chain(f"摘要{dc.BLOCK_START}\n- 推理:半截") == "摘要"


# ---------------------------------------------------------------------------
# 注入
# ---------------------------------------------------------------------------


def test_inject_adds_block_to_summary_message():
    compressed = _compressed()
    out, meta = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    assert meta["injected"] is True
    assert meta["entries"] == 2
    assert meta["fresh"] == 2
    assert meta["carried"] == 0
    summary = out[1]["content"]
    assert summary.startswith("[上下文摘要")
    assert dc.BLOCK_START in summary
    assert "read_file(ok)" in summary
    assert meta["reasoning_retention"]["retention_ratio"] == 1.0


def test_inject_does_not_mutate_inputs():
    compressed = _compressed()
    before = compressed[1]["content"]
    snapshot = [dict(m) for m in compressed]
    out, _ = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    assert compressed[1]["content"] == before
    assert [dict(m) for m in compressed] == snapshot
    assert out is not compressed


def test_inject_preserves_tail_message_identity():
    """尾部消息对象身份必须保持(快照回捞按 is 比对判定"被移除消息")。"""
    compressed = _compressed()
    out, _ = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    assert out[0] is compressed[0]
    assert out[2] is compressed[2]
    assert out[-1] is compressed[-1]


def test_inject_is_idempotent_and_carries_old_entries():
    """二次注入:旧块被剥离、旧条目原样接续,且与本次蒸馏结果逐行去重(不重复膨胀)。"""
    compressed = _compressed()
    once, meta1 = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    twice, meta2 = dc.inject_decision_chain(once, _history(), keep_recent=4)
    assert meta1["entries"] == 2
    assert meta2["carried"] == 2
    assert meta2["fresh"] == 0  # 同一份 head 再蒸馏 → 全部与接续条目重复,被去重
    assert meta2["entries"] == 2
    assert twice[1]["content"].count(dc.BLOCK_START) == 1
    assert twice[1]["content"].count("read_file(ok)") == 1


def test_inject_caps_total_entries_keeping_newest():
    """接续 + 新增超上限 → 丢最旧(接续条目先被丢),计数与新内容一致。"""
    compressed = _compressed()
    once, _ = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    # 第二次压缩的源消息:原历史 + 两条全新的决策轮次(落在尾部保留段)
    newer = _history() + [
        {"role": "assistant", "content": "新决策一", "tool_calls": [_call("n1", "grep")]},
        {"role": "tool", "tool_call_id": "n1", "content": "ok"},
        {"role": "assistant", "content": "新决策二", "tool_calls": [_call("n2", "ls")]},
        {"role": "tool", "tool_call_id": "n2", "content": "ok"},
    ]
    twice, meta = dc.inject_decision_chain(once, newer, keep_recent=4, max_entries=2)
    # 合并后 3 条(read_file / write_file / http_request),上限 2 → 丢最旧的 read_file
    assert meta["entries"] == 2
    assert meta["carried"] == 1
    assert meta["fresh"] == 1
    assert "read_file(ok)" not in twice[1]["content"]
    assert "http_request(error: 网关 502)" in twice[1]["content"]


def test_inject_without_summary_message_is_noop():
    compressed = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]
    out, meta = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    assert out is compressed
    assert meta["injected"] is False
    assert meta["reason"] == "no_summary_message"


def test_inject_without_head_is_noop():
    compressed = _compressed()
    out, meta = dc.inject_decision_chain(compressed, compressed, keep_recent=6)
    assert out is compressed
    assert meta["reason"] in ("no_head", "no_decisions")


def test_inject_without_decisions_is_noop():
    """head 段没有带工具调用的轮次(纯问答历史)→ 不注入,保持零差异。"""
    plain = [
        {"role": "system", "content": "s"},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "u2"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "u3"},
        {"role": "assistant", "content": "a3"},
    ]
    compressed = [plain[0], {"role": "user", "content": "[上下文摘要 — 之前 4 条消息已压缩]"}, *plain[5:]]
    out, meta = dc.inject_decision_chain(compressed, plain, keep_recent=2)
    assert out is compressed
    assert meta["reason"] == "no_decisions"


# ---------------------------------------------------------------------------
# apply_decision_chain(开关 + 降级)
# ---------------------------------------------------------------------------


def test_apply_disabled_is_zero_diff(monkeypatch):
    monkeypatch.setattr(dc, "AGENT_DECISION_CHAIN_ENABLED", False)
    compressed = _compressed()
    out, meta = dc.apply_decision_chain(compressed, _history(), keep_recent=4)
    assert out is compressed
    assert meta == {"enabled": False, "injected": False, "reason": "disabled"}
    assert dc.BLOCK_START not in out[1]["content"]


def test_apply_enabled_injects(monkeypatch):
    monkeypatch.setattr(dc, "AGENT_DECISION_CHAIN_ENABLED", True)
    compressed = _compressed()
    out, meta = dc.apply_decision_chain(compressed, _history(), keep_recent=4)
    assert meta["injected"] is True
    assert dc.BLOCK_START in out[1]["content"]


def test_apply_degrades_on_exception(monkeypatch):
    monkeypatch.setattr(dc, "AGENT_DECISION_CHAIN_ENABLED", True)

    def _boom(*args, **kwargs):
        raise RuntimeError("distiller down")

    monkeypatch.setattr(dc, "inject_decision_chain", _boom)
    compressed = _compressed()
    out, meta = dc.apply_decision_chain(compressed, _history(), keep_recent=4)
    assert out is compressed
    assert meta["injected"] is False
    assert meta["reason"].startswith("error: ")


def test_apply_reads_tunables_at_call_time(monkeypatch):
    """条数上限在调用时从 tunables 读取(支持运行时调参,不走 def 默认值)。"""
    monkeypatch.setattr(dc, "AGENT_DECISION_CHAIN_ENABLED", True)
    monkeypatch.setattr(dc, "AGENT_DECISION_CHAIN_MAX_ENTRIES", 1)
    _, meta = dc.apply_decision_chain(_compressed(), _history(), keep_recent=4)
    assert meta["entries"] == 1


# ---------------------------------------------------------------------------
# 推理保留率自证
# ---------------------------------------------------------------------------


def test_reasoning_retention_no_turns_is_full():
    report = assess_reasoning_retention(
        [{"role": "user", "content": "hi"}], [{"role": "user", "content": "hi"}]
    )
    assert report == {
        "turns_total": 0,
        "turns_retained": 0,
        "retention_ratio": 1.0,
        "threshold": dc.REASONING_COVERAGE_THRESHOLD,
        "dropped": [],
    }


def test_reasoning_retention_drops_without_chain():
    """未注入决策链:被压缩掉的轮次推理在产物中找不到 → 保留率显著低于 1。"""
    compressed = _compressed(summary_body="- user: 把 A 文件改掉")
    report = assess_reasoning_retention(_history(), compressed)
    assert report["turns_total"] == 3
    assert report["turns_retained"] == 1  # 仅尾部保留段的"申请已提交"存活
    assert report["retention_ratio"] < 1.0
    assert {d["turn"] for d in report["dropped"]} == {1, 2}


def test_reasoning_retention_recovers_after_injection():
    """同一份输入,注入决策链后推理保留率从低位拉满 —— 接线效果的直接证据。"""
    compressed = _compressed()
    before = assess_reasoning_retention(_history(), compressed)["retention_ratio"]
    injected, _ = dc.inject_decision_chain(compressed, _history(), keep_recent=4)
    after = assess_reasoning_retention(_history(), injected)["retention_ratio"]
    assert before < 1.0
    assert after == 1.0
    assert after > before


def test_reasoning_retention_caps_dropped_samples():
    history = [
        {"role": "system", "content": "s"},
        *[
            {
                "role": "assistant",
                "content": f"第{i}轮独特推理内容{i}",
                "tool_calls": [_call(f"c{i}", "ls")],
            }
            for i in range(8)
        ],
    ]
    report = assess_reasoning_retention(history, [{"role": "user", "content": "无关摘要"}])
    assert report["turns_total"] == 8
    assert len(report["dropped"]) == dc.DROPPED_SAMPLE_LIMIT


# ---------------------------------------------------------------------------
# 指标接线
# ---------------------------------------------------------------------------


def test_metrics_report_includes_chain_and_retention():
    info = {
        "compressed": True,
        "original_tokens": 10000,
        "compressed_tokens": 6000,
        "removed_count": 8,
        "trigger": "ratio",
        "decision_chain": {"entries": 5, "fresh": 3, "carried": 2},
        "reasoning_retention": {"retention_ratio": 1.0, "turns_total": 3},
    }
    metric = cm.record_compaction_event(session_id="s1", info=info)
    assert metric["decision_chain_entries"] == 5
    assert metric["reasoning_retention_ratio"] == 1.0
    report = cm.get_compaction_metrics_report()
    assert report["chain_injected_events"] == 1
    assert report["avg_reasoning_retention_ratio"] == 1.0
    assert report["avg_decision_chain_entries"] == 5


def test_metrics_report_defaults_when_chain_absent():
    """未接线/未注入的压缩事件:两个新字段不虚报(保持 None/0),报告汇总不参与。"""
    metric = cm.record_compaction_event(
        session_id="s2",
        info={
            "compressed": True,
            "original_tokens": 100,
            "compressed_tokens": 60,
            "trigger": "ratio",
        },
    )
    assert metric["decision_chain_entries"] == 0
    assert metric["reasoning_retention_ratio"] is None
    report = cm.get_compaction_metrics_report()
    assert report["chain_injected_events"] == 0
    assert report["avg_reasoning_retention_ratio"] == 0.0


def test_content_tokens_is_language_agnostic():
    tokens = dc.content_tokens("读取 read_file 共 12 处")
    assert "read_file" in tokens
    assert "读取" in tokens
    assert "12" in tokens


def test_messages_blob_includes_tool_names_and_content_blocks():
    blob = dc.messages_blob(
        [
            {"role": "assistant", "content": [{"type": "text", "text": "块文本"}]},
            {"role": "assistant", "content": "", "tool_calls": [_call("x", "grep")]},
            {"role": "tool", "tool_call_id": "x", "content": json.dumps({"ok": True})},
        ]
    )
    assert "块文本" in blob
    assert "grep" in blob
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
