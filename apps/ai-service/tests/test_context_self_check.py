# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-7 回合前上下文自检的判据测试(2026-11-27)。

钉住四件事:

  1. **只判工具消息**:`user` 消息短是正常的,判它"空"会制造大量假红;
  2. **三态与优先级**:`anchor_missing`(完全没内容) > `re_read_required`(内容不全) > `ok`;
  3. **标记互相认得**:环写的"中间丢弃 N 字符"与 `truncated=True` 两型都要被认出来;
  4. **自检自身不抛**:入参畸形一律当"干净",自检失败不得把主循环打断。
"""

from __future__ import annotations

import inspect

import pytest

from app.core.context_self_check import (
    STATUS_ANCHOR_MISSING,
    STATUS_OK,
    STATUS_RE_READ_REQUIRED,
    check_context,
    merge_status,
)


def test_empty_or_none_messages_are_clean() -> None:
    assert check_context([]).status == STATUS_OK
    assert check_context(None).status == STATUS_OK


def test_malformed_input_never_raises() -> None:
    assert check_context('not-a-list').status == STATUS_OK  # type: ignore[arg-type]
    assert check_context([None, 42, 'x']).status == STATUS_OK  # type: ignore[list-item]


def test_user_message_short_is_not_flagged() -> None:
    report = check_context([{'role': 'user', 'content': '好'}])
    assert report.status == STATUS_OK


def test_short_tool_message_is_missing() -> None:
    report = check_context([{'role': 'tool', 'content': ''}])
    assert report.status == STATUS_ANCHOR_MISSING
    assert report.missing_indices() == (0,)


@pytest.mark.parametrize('blank', ['', '   ', '\n\n', '·'])
def test_effective_empty_tool_message_is_missing(blank: str) -> None:
    assert check_context([{'role': 'tool', 'content': blank}]).status == STATUS_ANCHOR_MISSING


def test_function_role_counts_as_tool_message() -> None:
    report = check_context([{'role': 'function', 'content': ''}])
    assert report.status == STATUS_ANCHOR_MISSING


def test_dropped_marker_requires_reread() -> None:
    report = check_context(
        [{'role': 'tool', 'content': 'start\n...[中间丢弃 12 字符]...\nend'}]
    )
    assert report.status == STATUS_RE_READ_REQUIRED
    assert report.reread_indices() == (0,)


def test_truncated_flag_requires_reread() -> None:
    report = check_context(
        [{'role': 'tool', 'content': 'partial output here', 'truncated': True, 'dropped_bytes': 99}]
    )
    assert report.status == STATUS_RE_READ_REQUIRED
    assert '丢 99 字节' in report.findings[0].reason


def test_truncated_without_bytes_still_requires_reread() -> None:
    report = check_context(
        [{'role': 'tool', 'content': 'partial output here', 'truncated': True}]
    )
    assert report.status == STATUS_RE_READ_REQUIRED


def test_missing_wins_over_reread() -> None:
    report = check_context(
        [
            {'role': 'tool', 'content': 'gone', 'truncated': True},
            {'role': 'tool', 'content': ''},
        ]
    )
    assert report.status == STATUS_ANCHOR_MISSING
    assert report.findings[0].status == STATUS_RE_READ_REQUIRED
    assert report.findings[1].status == STATUS_ANCHOR_MISSING
    assert set(report.missing_indices()) == {1}
    assert set(report.reread_indices()) == {0}


def test_clean_tool_message_with_content() -> None:
    report = check_context([{'role': 'tool', 'content': 'normal tool output, long enough'}])
    assert report.status == STATUS_OK
    assert report.is_clean() is True


def test_to_dict_shape() -> None:
    report = check_context([{'role': 'tool', 'content': ''}])
    d = report.to_dict()
    assert d['status'] == STATUS_ANCHOR_MISSING
    assert d['findings'][0]['index'] == 0
    assert 'reason' in d['findings'][0]


@pytest.mark.parametrize(
    ('a', 'b', 'expected'),
    [
        (STATUS_OK, STATUS_OK, STATUS_OK),
        (STATUS_OK, STATUS_RE_READ_REQUIRED, STATUS_RE_READ_REQUIRED),
        (STATUS_RE_READ_REQUIRED, STATUS_ANCHOR_MISSING, STATUS_ANCHOR_MISSING),
        (STATUS_ANCHOR_MISSING, STATUS_OK, STATUS_ANCHOR_MISSING),
    ],
)
def test_merge_status(a: str, b: str, expected: str) -> None:
    assert merge_status(a, b) == expected


def test_agent_loop_calls_self_check_each_turn() -> None:
    from app.services import agent_loop_v2

    src = inspect.getsource(agent_loop_v2)
    assert 'context_self_check' in src
    # 必须是"每轮调用"而不是只 import:调用点要带 messages 实参。
    assert '_context_self_check(messages)' in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
