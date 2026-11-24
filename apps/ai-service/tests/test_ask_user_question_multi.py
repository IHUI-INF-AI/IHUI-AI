# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AskUserQuestion 多题批契约(2026-11-18 立)。

真实模型(agnes / gpt 系)在 function calling 里按 Claude-Code 风格发
`questions[]`(每项 question/header/options/multiSelect),并且常把整个数组
序列化成一个字符串;选项也常常只给 label/description 不给 id。
本测试钉住四条容错,任一退化都会让"真机提问"重新变成 invalid:

① label-only 选项由服务端派生稳定 id;
② `questions` 字符串形态可被解析;
③ 多题批照样下发 `questions` 帧,且 prompt/options 是第一题镜像;
④ 答复走 `answers[]` 逐题校验,回灌里原样带 answers。
"""

from __future__ import annotations

import json

from app.services import ask_user_question as aq

_SESSION = "sess-multi-1"
_USER = "user-multi-1"


def _batch() -> list[dict[str, object]]:
    return [
        {
            "question": "今晚先复习数学还是英语?",
            "header": "今晚复习",
            "options": [
                {"label": "数学", "description": "先刷错题"},
                {"label": "英语", "description": "先背单词"},
            ],
            "multiSelect": False,
        },
        {
            "question": "明早要不要提前 20 分钟到校?",
            "header": "早到校",
            "options": [
                {"label": "提前到校", "description": "早上记忆好"},
                {"label": "正常到校", "description": "多睡 20 分钟"},
            ],
        },
    ]


def test_label_only_options_derive_ids() -> None:
    item = aq.create_question(
        session_id=_SESSION,
        user_id=_USER,
        prompt="请选择一项",
        options=[{"label": "数学"}, {"label": "英语"}],
    )
    assert not isinstance(item, dict), item
    frame = item.to_dict()
    assert [opt["id"] for opt in frame["options"]] == ["o1", "o2"]


def test_questions_as_json_string_is_parsed() -> None:
    payload = json.dumps(_batch(), ensure_ascii=False)
    item = aq.create_question(
        session_id=_SESSION, user_id=_USER, prompt="", options=None, questions=payload
    )
    assert not isinstance(item, dict), item
    assert len(item.questions) == 2


def test_multi_question_frame_shape() -> None:
    item = aq.create_question(
        session_id=_SESSION, user_id=_USER, prompt="", options=None, questions=_batch()
    )
    assert not isinstance(item, dict), item
    frame = item.to_dict()
    assert frame["prompt"] == "今晚先复习数学还是英语?"
    subs = frame["questions"]
    assert [sub["id"] for sub in subs] == ["s1", "s2"]
    assert subs[1]["header"] == "早到校"
    assert [opt["id"] for opt in subs[0]["options"]] == ["o1", "o2"]


def test_multi_answers_resolve_and_feed_back() -> None:
    item = aq.create_question(
        session_id=_SESSION, user_id=_USER, prompt="", options=None, questions=_batch()
    )
    assert not isinstance(item, dict), item
    status, resolved = aq.resolve_question(
        item.question_id,
        session_id=_SESSION,
        user_id=_USER,
        answers=[
            {"selectedOptionIds": ["o1"], "customText": ""},
            {"selectedOptionIds": ["o2"], "customText": ""},
        ],
    )
    assert status == aq.STATUS_ANSWERED
    assert resolved is not None
    payload = aq.tool_result_payload(resolved, status)
    assert payload["ok"] is True
    assert [a["selectedOptionIds"] for a in payload["answers"]] == [["o1"], ["o2"]]
    assert resolved.resolved_payload()["answers"][1]["selectedOptionIds"] == ["o2"]


def test_multi_answers_wrong_order_is_invalid() -> None:
    item = aq.create_question(
        session_id=_SESSION, user_id=_USER, prompt="", options=None, questions=_batch()
    )
    assert not isinstance(item, dict), item
    status, _ = aq.resolve_question(
        item.question_id,
        session_id=_SESSION,
        user_id=_USER,
        answers=[{"selectedOptionIds": ["o1"]}],
    )
    assert status == aq.STATUS_INVALID
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
