# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""fast_apply.py 单元测试:三档策略 + 唯一锚点判据 + 写后校验回滚 + 纠错回路。

覆盖(对应用户要求的六个必测点,另加边界):
- 唯一锚点成功(exact)
- 多处命中拒绝(exact / fuzzy,含自重叠目标 —— `str.count` 语义陷阱)
- 零命中拒绝(且不静默写盘)
- 应用后校验失败回滚(CRLF + BOM 文件,回滚后逐字节一致)
- 整文件兜底生效 / 未给内容时拒绝
- 失败后文件内容与之前逐字节一致(锚点失败、纠错两次失败两种路径)
- 模糊锚定缩进漂移成功、纯删除语义
- 纠错回路:重试一次成功 / 重试后仍失败即停 / 回调放弃
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.ai_code_attribution_verdict import AI_GENERATED_TOOLS
from app.services import fast_apply, file_editor
from app.services.fast_apply import (
    ATTRIBUTION_TOOL,
    MAX_APPLY_ATTEMPTS,
    FastApplyErrorCode,
    FastApplyFailure,
    apply_edit,
    apply_edit_with_fix,
)

BOM = b"\xef\xbb\xbf"


@pytest.fixture(autouse=True)
def _isolate_workspace(monkeypatch, tmp_path):
    """把工作区白名单收窄到 tmp_path;归属记账打桩,避免测试污染归属账。"""
    monkeypatch.setattr(file_editor, "_workspace_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(fast_apply, "record_attribution", lambda *a, **kw: None)


def _write(path: Path, content: str | bytes) -> None:
    """按字节落盘。

    刻意不用 `write_text`:它在 Windows 上会把 "\n" 翻译成 os.linesep("\r\n"),
    测试想钉住的「逐字节一致」就会被这层隐式翻译改掉取证对象。
    """
    data = content.encode("utf-8") if isinstance(content, str) else content
    path.write_bytes(data)


# =============================================================================
# 第一档:精确唯一命中
# =============================================================================


def test_exact_unique_anchor_applied(tmp_path):
    f = tmp_path / "code.py"
    _write(f, "def foo():\n    return 1\n")

    out = apply_edit(str(f), "return 1", "return 42")

    assert out.ok is True
    assert out.strategy == "exact"
    assert out.match_tier == "exact"
    assert out.start_line == 2
    assert out.end_line == 2
    assert f.read_text(encoding="utf-8") == "def foo():\n    return 42\n"
    assert "return 42" in out.diff


def test_exact_multiple_matches_rejected(tmp_path):
    f = tmp_path / "code.py"
    before = "def a():\n    return 1\n\ndef b():\n    return 1\n"
    _write(f, before)

    out = apply_edit(str(f), "return 1", "return 2", strategy="exact")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES.value
    assert out.candidates == (2, 5)
    assert "2 处" in out.message
    assert f.read_text(encoding="utf-8") == before


def test_exact_overlapping_occurrences_are_multiple(tmp_path):
    """目标片段自重叠时,`str.count` 会少报;唯一性判据必须做重叠扫描。"""
    f = tmp_path / "note.txt"
    before = "aaa"
    _write(f, before)

    out = apply_edit(str(f), "aa", "b", strategy="exact")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES.value
    assert f.read_text(encoding="utf-8") == before


def test_zero_match_rejected_without_write(tmp_path):
    f = tmp_path / "code.py"
    before = "def foo():\n    return 1\n"
    _write(f, before)

    out = apply_edit(str(f), "return 999", "return 2")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.ANCHOR_NOT_FOUND.value
    assert "整文件兜底" in out.message
    assert f.read_text(encoding="utf-8") == before


# =============================================================================
# 第二档:带上下文的模糊锚定
# =============================================================================


def test_fuzzy_indentation_drift_applied(tmp_path):
    f = tmp_path / "code.py"
    _write(f, "def foo():\n    if x:\n        return 1\n")

    out = apply_edit(
        str(f),
        "  if x:\n    return 1",  # 缩进与仓库现状不一致:靠模糊锚定
        "  if x:\n      return 2",
        strategy="fuzzy",
    )

    assert out.ok is True
    assert out.strategy == "fuzzy"
    assert out.match_tier == "strip"
    assert out.start_line == 2
    assert f.read_text(encoding="utf-8") == "def foo():\n  if x:\n      return 2\n"


def test_fuzzy_multiple_matches_rejected(tmp_path):
    f = tmp_path / "code.py"
    before = "a = 1\nb = 2\na = 1\nb = 2\n"
    _write(f, before)

    out = apply_edit(str(f), "a = 1\nb = 2", "a = 9\nb = 9", strategy="fuzzy")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES.value
    assert out.candidates == (1, 3)
    assert "补充上下文行" in out.message
    assert f.read_text(encoding="utf-8") == before


def test_fuzzy_empty_replacement_deletes_line(tmp_path):
    f = tmp_path / "note.txt"
    _write(f, "keep\ndrop\nkeep2\n")

    out = apply_edit(str(f), "drop", "", strategy="fuzzy")

    assert out.ok is True
    assert f.read_text(encoding="utf-8") == "keep\nkeep2\n"


# =============================================================================
# 第三档:整文件兜底
# =============================================================================


def test_whole_file_fallback_applied(tmp_path):
    f = tmp_path / "code.py"
    _write(f, "def foo():\n    return 1\n")

    out = apply_edit(
        str(f),
        "completely-absent-anchor",
        "ignored",
        whole_file_content="def foo():\n    return 7\n",
    )

    assert out.ok is True
    assert out.strategy == "whole_file"
    assert f.read_text(encoding="utf-8") == "def foo():\n    return 7\n"


def test_whole_file_strategy_requires_content(tmp_path):
    f = tmp_path / "code.py"
    before = "def foo():\n    return 1\n"
    _write(f, before)

    out = apply_edit(str(f), "return 1", "return 2", strategy="whole_file")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.WHOLE_FILE_REQUIRED.value
    assert f.read_text(encoding="utf-8") == before


def test_auto_does_not_guess_whole_file_without_content(tmp_path):
    """auto 的整文件兜底只在调用方显式给内容时启用,绝不推断。"""
    f = tmp_path / "code.py"
    before = "def foo():\n    return 1\n"
    _write(f, before)

    out = apply_edit(str(f), "nope", "whatever")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.ANCHOR_NOT_FOUND.value
    assert f.read_text(encoding="utf-8") == before


# =============================================================================
# 写后校验失败 → 回滚(逐字节一致)
# =============================================================================


def test_post_validate_syntax_failure_rolls_back_byte_identical(tmp_path):
    """CRLF + BOM 文件:写后语法校验失败必须回滚,且回读字节与写前完全一致。"""
    f = tmp_path / "code.py"
    before = BOM + b"def foo():\r\n    return 1\r\n"
    _write(f, before)

    out = apply_edit(str(f), "return 1", "return (")  # 括号不闭合 → 语法失败

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.POST_VALIDATE_FAILED.value
    assert out.rollback_performed is True
    assert "已回滚" in out.message
    assert f.read_bytes() == before


def test_success_preserves_bom_and_crlf_bytes(tmp_path):
    f = tmp_path / "code.py"
    _write(f, BOM + b"def foo():\r\n    return 1\r\n")

    out = apply_edit(str(f), "return 1", "return 42")

    assert out.ok is True
    assert f.read_bytes() == BOM + b"def foo():\r\n    return 42\r\n"


def test_failure_leaves_file_byte_identical(tmp_path):
    f = tmp_path / "note.txt"
    before = "alpha\nbeta\ngamma\n"
    _write(f, before)

    out = apply_edit(str(f), "beta", "beta-beta", strategy="whole_file")

    assert out.ok is False
    assert f.read_bytes() == before.encode("utf-8")


# =============================================================================
# 路径安全
# =============================================================================


def test_path_outside_workspace_rejected(tmp_path):
    outside = tmp_path.parent / "outside_fast_apply.txt"
    _write(outside, "x\n")
    try:
        out = apply_edit(str(outside), "x", "y")
        assert out.ok is False
        assert out.error_code == FastApplyErrorCode.PATH_NOT_IN_WORKSPACE.value
    finally:
        outside.unlink(missing_ok=True)


def test_sensitive_dir_rejected(tmp_path):
    sensitive = tmp_path / "node_modules" / "pkg.js"
    sensitive.parent.mkdir(parents=True)
    _write(sensitive, "const a = 1;\n")

    out = apply_edit(str(sensitive), "a = 1", "a = 2")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.PATH_NOT_IN_WORKSPACE.value
    assert sensitive.read_text(encoding="utf-8") == "const a = 1;\n"


# =============================================================================
# 纠错回路:只在首次失败后重试一次
# =============================================================================


def test_fix_retry_succeeds_once(tmp_path):
    f = tmp_path / "code.py"
    _write(f, "def a():\n    return 1\n\ndef b():\n    return 1\n")
    seen: list[FastApplyFailure] = []

    def fixer(failure: FastApplyFailure) -> tuple[str, str]:
        seen.append(failure)
        # 拿到候选行号后补上下文,把锚点收窄到唯一
        return ("def a():\n    return 1", "def a():\n    return 2")

    out = apply_edit_with_fix(str(f), "return 1", "return 2", fixer=fixer, strategy="exact")

    assert out.ok is True
    assert out.attempts == 2
    assert out.fix_attempted is True
    assert seen[0].error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES.value
    assert seen[0].candidates == (2, 5)
    assert f.read_text(encoding="utf-8") == "def a():\n    return 2\n\ndef b():\n    return 1\n"


def test_fix_retry_stops_after_second_failure(tmp_path):
    f = tmp_path / "code.py"
    before = "def a():\n    return 1\n\ndef b():\n    return 1\n"
    _write(f, before)
    calls: list[int] = []

    def fixer(failure: FastApplyFailure) -> tuple[str, str]:
        calls.append(failure.attempt)
        return ("still-ambiguous", "nope")

    out = apply_edit_with_fix(str(f), "return 1", "return 2", fixer=fixer, strategy="exact")

    assert out.ok is False
    assert out.attempts == 2
    assert out.fix_attempted is True
    assert len(calls) == 1  # 纠错只发生一次,不无限重试
    assert "首次失败" in out.message
    assert "纠错后仍失败" in out.message
    assert f.read_text(encoding="utf-8") == before


def test_fixer_can_decline(tmp_path):
    f = tmp_path / "code.py"
    before = "def a():\n    return 1\n\ndef b():\n    return 1\n"
    _write(f, before)

    out = apply_edit_with_fix(
        str(f), "return 1", "return 2", fixer=lambda failure: None, strategy="exact"
    )

    assert out.ok is False
    assert out.attempts == 1
    assert out.fix_attempted is True
    assert "未给出新片段" in out.message
    assert f.read_text(encoding="utf-8") == before


def test_attempt_cap_is_hardcoded_to_two():
    assert MAX_APPLY_ATTEMPTS == 2


# =============================================================================
# 契约细节
# =============================================================================


def test_empty_target_rejected(tmp_path):
    f = tmp_path / "note.txt"
    _write(f, "abc\n")

    out = apply_edit(str(f), "", "x")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.EMPTY_TARGET.value
    assert f.read_text(encoding="utf-8") == "abc\n"


def test_unknown_strategy_rejected(tmp_path):
    f = tmp_path / "note.txt"
    _write(f, "abc\n")

    out = apply_edit(str(f), "abc", "x", strategy="guess")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.INVALID_ARGUMENT.value


def test_missing_file_rejected(tmp_path):
    out = apply_edit(str(tmp_path / "absent.py"), "a", "b")

    assert out.ok is False
    assert out.error_code == FastApplyErrorCode.FILE_NOT_FOUND.value


def test_result_to_dict_schema_is_stable(tmp_path):
    f = tmp_path / "note.txt"
    _write(f, "abc\n")

    ok_keys = set(apply_edit(str(f), "abc", "x").to_dict())
    fail_keys = set(apply_edit(str(f), "nope", "x").to_dict())

    assert ok_keys == fail_keys


def test_attribution_tool_is_registered():
    """归属账工具名必须在判据唯一真源里登记,否则改会被判成 unknown。"""
    assert ATTRIBUTION_TOOL in AI_GENERATED_TOOLS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
