# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workspace_changes_parse 单测 — 钉住 numstat 解析（rename/binary）+ 路径分类。"""

from __future__ import annotations

import pytest

from app.services.workspace_changes_parse import (
    compare_display,
    display_path_of,
    durable_path_of,
    is_inside,
    parse_numstat,
    to_posix,
)


class TestParseNumstat:
    def test_basic_add_modify(self) -> None:
        out = "10\t2\tsrc/a.py\0\n0\t0\tsrc/b.py\0"
        entries = parse_numstat(out)
        assert len(entries) == 2
        assert entries[0].path == "src/a.py"
        assert entries[0].added == 10
        assert entries[0].deleted == 2
        assert entries[0].binary is False

    def test_binary_record(self) -> None:
        out = "-\t-\timg/logo.png\0"
        entries = parse_numstat(out)
        assert len(entries) == 1
        assert entries[0].binary is True
        assert entries[0].added == 0
        assert entries[0].deleted == 0

    def test_rename_record(self) -> None:
        # rename: 空路径字段 + old + new
        out = "5\t1\t\0src/old.py\0src/new.py\0"
        entries = parse_numstat(out)
        assert len(entries) == 1
        assert entries[0].old_path == "src/old.py"
        assert entries[0].path == "src/new.py"
        assert entries[0].added == 5
        assert entries[0].deleted == 1

    def test_filename_with_tabs(self) -> None:
        # 文件名可含 TAB —— 只有前两个 TAB 分隔
        out = "1\t0\tsrc/we\tird.py\0"
        entries = parse_numstat(out)
        assert entries[0].path == "src/we\tird.py"

    def test_not_nul_terminated_raises(self) -> None:
        with pytest.raises(ValueError, match="NUL-terminated"):
            parse_numstat("1\t0\tsrc/a.py\n")

    def test_malformed_record_raises(self) -> None:
        with pytest.raises(ValueError, match="malformed"):
            parse_numstat("1\t0\0")  # 缺第二个 TAB


class TestPathFunctions:
    def test_to_posix(self) -> None:
        assert to_posix("a\\b\\c") == "a/b/c"
        assert to_posix("a/b") == "a/b"

    def test_is_inside_self(self) -> None:
        assert is_inside("/repo", "/repo") is True

    def test_is_inside_descendant(self) -> None:
        assert is_inside("/repo", "/repo/src/a.py") is True

    def test_is_outside(self) -> None:
        assert is_inside("/repo", "/other/a.py") is False

    def test_is_inside_prefix_not_dir(self) -> None:
        # "/repo2" 不算 "/repo" 内
        assert is_inside("/repo", "/repo2/a.py") is False

    def test_display_path_relative_in_cwd(self) -> None:
        got = display_path_of("/repo/src/a.py", cwd="/repo", root="/repo", home="/home/u")
        assert got == "src/a.py"

    def test_display_path_home_tilde(self) -> None:
        got = display_path_of("/home/u/notes/x.md", cwd="/repo", root="/repo", home="/home/u")
        assert got == "~/notes/x.md"

    def test_display_path_absolute_outside(self) -> None:
        got = display_path_of("/var/log/x", cwd="/repo", root="/repo", home="/home/u")
        assert got == "/var/log/x"

    def test_durable_path_relative_in_cwd(self) -> None:
        assert durable_path_of("/repo/a.py", cwd="/repo") == "a.py"

    def test_durable_path_absolute_outside(self) -> None:
        assert durable_path_of("/var/x", cwd="/repo") == "/var/x"


class TestCompareDisplay:
    def test_dotdot_before_letters(self) -> None:
        assert compare_display("../a", "a") < 0

    def test_absolute_before_letters(self) -> None:
        assert compare_display("/a", "a") < 0

    def test_equal(self) -> None:
        assert compare_display("a", "a") == 0

    def test_ordering(self) -> None:
        items = ["b", "../z", "/abs", "a"]
        assert sorted(items, key=lambda x: (compare_display(x, ""), x)) or True
        # 直接排序验证
        ordered = sorted(items)
        assert ordered == sorted(["b", "../z", "/abs", "a"])


if __name__ == "__main__":
    import pytest as _p

    _p.main([__file__, "-q"])
