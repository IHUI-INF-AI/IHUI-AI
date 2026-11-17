# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AskUserQuestion 契约单源锁(2026-11-17 立)。

本轮深度开发把"帧与工具结果形状"收敛到 ask_user_question.py 一处,本测试钉住三件事:
① header 是可选帧键:设了就下发,空标题不吐键(旧客户端零影响);
② question-resolved 的 continued 附加键只在定时继续出现,且与 timeout 结算共存;
③ 工具结果与结局解释只有一份定义 —— llm.py / agent_loop_v2.py 里**不得**再出现
   各写一份的 errorCode 字面量(出现即回归,判据与"单一真相源"同口径)。
"""

from __future__ import annotations

from pathlib import Path

from app.services import ask_user_question as aq

_SESSION = "sess-contract-1"
_USER = "user-contract-1"

_APP = Path(__file__).resolve().parents[1] / "app"


def _make(**overrides):
    kwargs = {
        "session_id": _SESSION,
        "user_id": _USER,
        "prompt": "请选择一项",
        "options": [
            {"id": "a", "label": "选项 A"},
            {"id": "b", "label": "选项 B", "description": "补充说明"},
        ],
        "allow_custom": True,
        "allow_multiple": False,
    }
    kwargs.update(overrides)
    item = aq.create_question(**kwargs)
    assert not isinstance(item, dict), item
    return item


def test_frame_carries_header_when_set() -> None:
    item = _make(header="复习节奏")
    payload = item.to_dict()
    assert payload["header"] == "复习节奏"
    # 既有键一个不少(旧客户端按未知键忽略,不是替换)
    assert payload["options"][1]["description"] == "补充说明"
    assert payload["questionId"].startswith("q_")


def test_frame_omits_header_when_empty() -> None:
    """空标题不得吐空串键 —— "未设置"与"空标题"不能混成一种形态。"""
    item = _make()
    assert "header" not in item.to_dict()
    item2 = _make(header="   ")
    assert "header" not in item2.to_dict()


def test_resolved_payload_continued_flag() -> None:
    item = _make()
    aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )
    plain = item.resolved_payload()
    assert "continued" not in plain
    assert plain["selectedOptionIds"] == ["a"]

    continued = item.resolved_payload("timeout", continued=True)
    assert continued["status"] == "timeout"
    assert continued["continued"] is True


def test_tool_result_payload_answered_shape() -> None:
    item = _make(header="复习节奏")
    aq.resolve_question(
        item.question_id,
        session_id=_SESSION,
        user_id=_USER,
        selected_ids=["a"],
        custom_text="补一句",
    )
    result = aq.tool_result_payload(item, aq.STATUS_ANSWERED, call_id="call-1")
    assert result["ok"] is True
    assert result["status"] == "answered"
    assert result["selectedOptionIds"] == ["a"]
    assert result["labels"] == ["选项 A"]
    assert result["customText"] == "补一句"


def test_tool_result_payload_continued_is_pending_not_answer() -> None:
    """continued 是"挂起回执":ok=True 但必须带 pending 与"不要把挂起当许可"的说明。"""
    item = _make(timeout_s=30)
    result = aq.tool_result_payload(item, aq.STATUS_CONTINUED, call_id="call-9")
    assert result["ok"] is True
    assert result["pending"] is True
    assert result["status"] == aq.STATUS_CONTINUED
    assert result["callId"] == "call-9"
    assert "不要把挂起当作许可" in result["message"]


def test_tool_result_payload_terminal_shapes() -> None:
    item = _make(timeout_s=30)
    withdrawn = aq.tool_result_payload(item, aq.STATUS_WITHDRAWN)
    assert withdrawn["ok"] is False
    assert withdrawn["errorCode"] == "question_withdrawn"
    assert "不要重试同一问题" in withdrawn["message"]

    interrupted = aq.tool_result_payload(item, aq.STATUS_INTERRUPTED)
    assert interrupted["ok"] is False
    assert interrupted["errorCode"] == "question_interrupted"

    timeout = aq.tool_result_payload(item, aq.STATUS_TIMEOUT)
    assert timeout["ok"] is False
    assert timeout["errorCode"] == "question_timeout"
    assert timeout["error"] == "用户未在 30s 内答复"
    assert "按未答继续" in timeout["message"]


def test_tool_result_outcome_agrees_with_payload() -> None:
    """ok 只从 outcome 出口取 —— 两个执行面不再各自判一次。"""
    for status in (
        aq.STATUS_ANSWERED,
        aq.STATUS_CONTINUED,
        aq.STATUS_WITHDRAWN,
        aq.STATUS_INTERRUPTED,
        aq.STATUS_TIMEOUT,
    ):
        item = _make()
        ok, error, error_type, explanation = aq.tool_result_outcome(status)
        payload = aq.tool_result_payload(item, status)
        assert payload["ok"] is ok
        assert explanation
        assert error_type == (payload.get("errorCode") if not ok else None)
        assert error is None if ok else str(error)


def test_outcome_single_source_no_inline_errorcodes() -> None:
    """单一真相源锁:errorCode 字面量只许住在 ask_user_question.py。

    llm.py / agent_loop_v2.py 一旦重新内联这些字面量,就是又长出第二份定义
    (此前正是两份各自演进,导致 message/形状漂移)。
    """
    markers = ("question_withdrawn", "question_interrupted", "question_timeout")
    for rel in ("routers/llm.py", "services/agent_loop_v2.py"):
        text = (_APP / rel).read_text(encoding="utf-8")
        for marker in markers:
            assert marker not in text, f"{rel} 内联了 {marker}(应走 ask_user_question 出口)"


def test_workbench_timed_wiring() -> None:
    """工作台拦截位必须走 timed 三件套:归一、转入 continued、迟到答复注入。"""
    text = (_APP / "services/agent_loop_v2.py").read_text(encoding="utf-8")
    assert "normalize_timeout_s(" in text
    assert "mark_continued(" in text
    assert "drain_continued_answers(" in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
