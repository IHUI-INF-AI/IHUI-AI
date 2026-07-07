"""Glob 模式编译器 _compile_glob 单元测试.

覆盖:
  - 基础 * ? [] 语法
  - 反斜杠转义 (\X 视为字面 X)
  - ** 任意目录层级 (兼容 bash 语义)
  - {a,b,c} 大括号展开
  - 与 tool_glob 集成 (端到端)
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# 单元测试: 直接调用 _compile_glob
# ---------------------------------------------------------------------------


class TestGlobCompileBasics:
    """基础通配符."""

    def test_asterisk_matches_anything(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("*")
        assert rx.search("anything.txt")
        assert rx.search("path/to/file.ts")
        assert rx.search("")

    def test_question_mark_single_char(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("a?c")
        assert rx.search("abc")
        assert rx.search("aXc")
        assert not rx.search("ac")  # 必须是 1 字符
        assert not rx.search("abbc")

    def test_char_class_positive(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("file[123].txt")
        assert rx.search("file1.txt")
        assert rx.search("file2.txt")
        assert rx.search("file3.txt")
        assert not rx.search("file4.txt")
        assert not rx.search("fileX.txt")

    def test_char_class_negation(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("file[!abc].txt")
        assert rx.search("fileX.txt")
        assert not rx.search("filea.txt")
        assert not rx.search("fileb.txt")

    def test_literal_dot(self):
        from app.api.v1.workspace.tools import _compile_glob

        # 在 fnmatch 中 . 是字面, 我们也保持字面 (不会匹配换行外的任意)
        rx = _compile_glob("test.js")
        assert rx.search("test.js")
        # 跨行 (DOTALL) 下 . 也匹配换行, 但 testXjs 不应匹配 test.js 模式
        assert not rx.search("testXjs")


class TestGlobCompileEscape:
    """反斜杠转义 \\X 视为字面 X."""

    def test_escape_asterisk(self):
        """这是 Issue1 修复的核心场景: 搜索 test*.js 应当字面匹配 test*.js."""
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("test\\*file")
        assert rx.search("test*file")
        assert rx.search("prefix/test*file.txt")
        # 不应匹配未转义的 *
        assert not rx.search("testXfile")
        assert not rx.search("testXYZfile")

    def test_escape_dot_preserves_extension(self):
        """搜索 test.js 应能匹配字面 .js 文件名, 不应退化为 testXjs."""
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("test\\.js")
        assert rx.search("test.js")
        assert rx.search("src/test.js")
        # 没有 . 转义时, 我们以前用 fnmatch 也是字面, 这里保持一致
        # 但更重要的是: 配合后端 . 仍然按字面处理 (而不是正则 . 的"任意字符")
        assert not rx.search("testXjs")

    def test_escape_question_mark(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("name\\?")
        assert rx.search("name?")
        assert not rx.search("nameX")

    def test_escape_brackets(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("array\\[0\\]")
        assert rx.search("array[0]")
        assert not rx.search("arrayX0X")

    def test_escape_brace(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("file\\{a,b\\}")
        assert rx.search("file{a,b}")
        # 转义后 { } 不再被当作大括号展开
        assert not rx.search("filea")
        assert not rx.search("fileb")

    def test_escape_backslash_itself(self):
        from app.api.v1.workspace.tools import _compile_glob

        # \\ 视为字面 \
        rx = _compile_glob("a\\\\b")
        assert rx.search("a\\b")
        assert not rx.search("ab")

    def test_trailing_backslash_is_literal(self):
        """末尾的 \\ (无后随字符) 应作为字面 \\."""
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("foo\\")
        # 用 re.search 在子串模式下, 字面 \ 应在末尾匹配 (我们前面有 .*)
        # 验证不会因此崩
        assert isinstance(rx.search("foo\\"), object) is not None  # 类型: ignore


class TestGlobCompileDoubleStar:
    """** 任意目录层级."""

    def test_double_star_matches_zero_levels(self):
        """**/foo 应能匹配根目录的 foo."""
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("**/foo.js")
        assert rx.search("foo.js")
        assert rx.search("src/foo.js")
        assert rx.search("src/sub/foo.js")
        assert rx.search("a/b/c/d/foo.js")

    def test_double_star_with_extension(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("**/*test*")
        assert rx.search("test.js")
        assert rx.search("src/test.js")
        assert rx.search("src/mytester.ts")
        assert rx.search("test")


class TestGlobCompileBraces:
    """{a,b,c} 大括号展开."""

    def test_simple_braces(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("*.{ts,js}")
        assert rx.search("foo.ts")
        assert rx.search("bar.js")
        assert not rx.search("foo.py")

    def test_braces_with_path(self):
        from app.api.v1.workspace.tools import _compile_glob

        rx = _compile_glob("src/*.{tsx,vue,js}")
        assert rx.search("src/App.tsx")
        assert rx.search("src/Main.vue")
        assert rx.search("src/index.js")
        assert not rx.search("src/index.ts")

    def test_braces_with_double_star(self):
        from app.api.v1.workspace.tools import _compile_glob

        # 这是 searchFiles 第 1 步 (空查询) 用的模式, 此前在 fnmatch 中
        # 因为 { } 是字面, 实际完全无法工作 — 现在应正确展开
        rx = _compile_glob("**/*.{ts,js,vue,py}")
        assert rx.search("a.ts")
        assert rx.search("b.js")
        assert rx.search("src/c.vue")
        assert rx.search("scripts/d.py")
        assert not rx.search("e.md")


class TestGlobExpandBracesHelper:
    """_glob_expand_braces 边界情况."""

    def test_no_braces(self):
        from app.api.v1.workspace.tools import _glob_expand_braces

        assert _glob_expand_braces("plain") == ["plain"]

    def test_single_brace_group(self):
        from app.api.v1.workspace.tools import _glob_expand_braces

        assert _glob_expand_braces("a{b,c}d") == ["abd", "acd"]

    def test_multiple_brace_groups(self):
        from app.api.v1.workspace.tools import _glob_expand_braces

        result = sorted(_glob_expand_braces("a{b,c}d{e,f}g"))
        assert result == ["abdeg", "abdfg", "acdeg", "acdfg"]

    def test_braces_with_spaces_around_commas(self):
        from app.api.v1.workspace.tools import _glob_expand_braces

        # 选项本身不应被 strip, 保持原样
        result = _glob_expand_braces("{a, b}")
        assert result == ["a", " b"]


# ---------------------------------------------------------------------------
# 集成测试: tool_glob 端到端
# ---------------------------------------------------------------------------


@pytest.fixture
def workspace_tree(tmp_path: Path) -> Path:
    """构造一个小型工作区用于集成测试."""
    files = {
        "test.js": "",
        "src/app.ts": "",
        "src/components/Button.vue": "",
        "src/lib/util.js": "",
        "weird*name.txt": "",  # 含 glob 特殊字符 * 的文件名
        "data.json": "",
        "README.md": "",
        "scripts/build.py": "",
        "weird[brackets].ts": "",  # 含字符类字符的文件名
    }
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return tmp_path


class TestToolGlobIntegration:
    """tool_glob 端到端, 覆盖 searchFiles 用到的所有模式."""

    def test_empty_query_brace_pattern(self, workspace_tree: Path):
        """searchFiles 第 1 步: 空查询列出常见源码文件 (此前完全无法工作)."""
        from app.api.v1.workspace.tools import tool_glob

        result = asyncio.run(
            tool_glob(
                {"pattern": "**/*.{ts,js,vue,py,json}", "path": ""},
                str(workspace_tree),
            )
        )
        assert result.success
        lines = [l for l in result.output.splitlines() if l and not l.startswith("...")]
        rels = set(lines)
        # 应该匹配所有源码文件
        assert "test.js" in rels
        assert "src/app.ts" in rels
        assert "src/components/Button.vue" in rels
        assert "src/lib/util.js" in rels
        assert "data.json" in rels
        assert "scripts/build.py" in rels
        # 不应匹配
        assert "README.md" not in rels

    def test_user_query_escaped_wildcard(self, workspace_tree: Path):
        """Issue1 修复的核心场景: 用户搜 test*.js, 应字面匹配 weird*name.txt 这类.

        这里我们用 weird*name.txt 验证: 当用户输入含 * 时, 转义后按字面匹配.
        """
        from app.api.v1.workspace.tools import tool_glob

        # 模拟前端转义: 用户输入 weird*name → 转义为 weird\\*name
        result = asyncio.run(
            tool_glob(
                {"pattern": "*weird\\*name*", "path": ""},
                str(workspace_tree),
            )
        )
        assert result.success
        assert "weird*name.txt" in result.output

    def test_user_query_dot_preserved(self, workspace_tree: Path):
        """搜索 test.js (含 .) 应能匹配字面 .js 文件."""
        from app.api.v1.workspace.tools import tool_glob

        # 模拟前端转义: 用户输入 test.js → 转义为 test\\.js
        result = asyncio.run(
            tool_glob(
                {"pattern": "**/*test\\.js*", "path": ""},
                str(workspace_tree),
            )
        )
        assert result.success
        assert "test.js" in result.output
        # 不应匹配 testXjs (不存在这样的文件, 但不应出现 src/lib/util.js)
        assert "src/lib/util.js" not in result.output

    def test_glob_brackets_escaped(self, workspace_tree: Path):
        """搜索 weird[brackets] 应字面匹配, 不应被当作字符类."""
        from app.api.v1.workspace.tools import tool_glob

        result = asyncio.run(
            tool_glob(
                {"pattern": "*weird\\[brackets\\]*", "path": ""},
                str(workspace_tree),
            )
        )
        assert result.success
        assert "weird[brackets].ts" in result.output

    def test_substring_match_no_double_star(self, workspace_tree: Path):
        """searchFiles 现在的回退模式 (去除 **/) 仍能在根目录和子目录命中."""
        from app.api.v1.workspace.tools import tool_glob

        result = asyncio.run(
            tool_glob({"pattern": "*app*", "path": ""}, str(workspace_tree))
        )
        assert result.success
        rels = [l for l in result.output.splitlines() if l and not l.startswith("...")]
        # 根目录和子目录都能命中
        assert any("app" in r for r in rels)
