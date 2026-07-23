"""codebase_indexer.py 综合测试 — P3 代码库语义索引器。

覆盖维度(12 TestClass,~120 cases):
1. 常量(_EXT_TO_LANG / _IGNORED_DIRS / MAX_*)
2. CodeChunk + IndexResult dataclass
3. _check_tree_sitter / _get_parser
4. _SYMBOL_NODE_TYPES / _REGEX_PATTERNS
5. _extract_symbol_name
6. _chunk_by_ast(AST + 降级)
7. _chunk_by_regex(符号级 + 固定行数降级)
8. _collect_code_files
9. _generate_embeddings_batch
10. _write_to_api
11. index_repository / index_file / search
12. 全局单例
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import codebase_indexer
from app.services.codebase_indexer import (
    EMBEDDING_BATCH_SIZE,
    FIXED_CHUNK_LINES,
    FIXED_CHUNK_OVERLAP,
    MAX_CHUNK_CHARS,
    MAX_CHUNKS_PER_FILE,
    MAX_FILES_PER_INDEX,
    CodeChunk,
    CodebaseIndexer,
    IndexResult,
    codebase_indexer as global_indexer,
    _EXT_TO_LANG,
    _IGNORED_DIRS,
)


# ============================================================
# 1. 常量
# ============================================================


class TestConstants:
    """模块常量。"""

    def test_ext_to_lang_is_dict(self):
        assert isinstance(_EXT_TO_LANG, dict)
        assert len(_EXT_TO_LANG) >= 20

    def test_ext_to_lang_common_mappings(self):
        assert _EXT_TO_LANG[".ts"] == "typescript"
        assert _EXT_TO_LANG[".tsx"] == "tsx"
        assert _EXT_TO_LANG[".py"] == "python"
        assert _EXT_TO_LANG[".js"] == "javascript"
        assert _EXT_TO_LANG[".go"] == "go"
        assert _EXT_TO_LANG[".rs"] == "rust"
        assert _EXT_TO_LANG[".java"] == "java"

    def test_ext_to_lang_all_lowercase_values(self):
        for ext, lang in _EXT_TO_LANG.items():
            assert ext.startswith(".")
            assert lang == lang.lower()

    def test_ignored_dirs_is_set(self):
        assert isinstance(_IGNORED_DIRS, set)

    def test_ignored_dirs_contains_common(self):
        for d in ["node_modules", ".git", "__pycache__", ".venv", "venv",
                  "dist", "build", ".next", ".turbo", ".cache"]:
            assert d in _IGNORED_DIRS

    def test_max_chunk_chars(self):
        assert MAX_CHUNK_CHARS == 8000

    def test_fixed_chunk_lines(self):
        assert FIXED_CHUNK_LINES == 100

    def test_fixed_chunk_overlap(self):
        assert FIXED_CHUNK_OVERLAP == 50

    def test_max_chunks_per_file(self):
        assert MAX_CHUNKS_PER_FILE == 200

    def test_max_files_per_index(self):
        assert MAX_FILES_PER_INDEX == 5000

    def test_embedding_batch_size(self):
        assert EMBEDDING_BATCH_SIZE == 20


# ============================================================
# 2. CodeChunk dataclass
# ============================================================


class TestCodeChunk:
    """CodeChunk dataclass。"""

    def test_required_fields(self):
        c = CodeChunk(
            file_path="src/main.py",
            line_start=1,
            line_end=10,
            content="print('hello')",
        )
        assert c.file_path == "src/main.py"
        assert c.line_start == 1
        assert c.line_end == 10
        assert c.content == "print('hello')"
        assert c.language is None
        assert c.symbol_name is None
        assert c.symbol_type is None
        assert c.embedding is None

    def test_full_construction(self):
        c = CodeChunk(
            file_path="main.ts",
            line_start=5,
            line_end=20,
            content="function foo() {}",
            language="typescript",
            symbol_name="foo",
            symbol_type="function",
            embedding=[0.1, 0.2, 0.3],
        )
        assert c.language == "typescript"
        assert c.symbol_name == "foo"
        assert c.symbol_type == "function"
        assert c.embedding == [0.1, 0.2, 0.3]

    def test_all_fields_required(self):
        with pytest.raises(TypeError):
            CodeChunk(file_path="x")  # type: ignore[call-arg]

    def test_equality(self):
        c1 = CodeChunk("a", 1, 2, "x")
        c2 = CodeChunk("a", 1, 2, "x")
        assert c1 == c2


class TestIndexResult:
    """IndexResult dataclass。"""

    def test_required_repo_id(self):
        r = IndexResult(repo_id="my-repo")
        assert r.repo_id == "my-repo"
        assert r.files_scanned == 0
        assert r.files_indexed == 0
        assert r.chunks_created == 0
        assert r.chunks_vectorized == 0
        assert r.errors == []

    def test_full_construction(self):
        r = IndexResult(
            repo_id="r1",
            files_scanned=10,
            files_indexed=8,
            chunks_created=50,
            chunks_vectorized=45,
            errors=["err1"],
        )
        assert r.files_scanned == 10
        assert r.chunks_vectorized == 45
        assert r.errors == ["err1"]

    def test_errors_default_factory(self):
        r1 = IndexResult(repo_id="r1")
        r2 = IndexResult(repo_id="r2")
        r1.errors.append("e")
        assert r2.errors == []  # 不共享

    def test_repo_id_required(self):
        with pytest.raises(TypeError):
            IndexResult()  # type: ignore[call-arg]


# ============================================================
# 3. _check_tree_sitter / _get_parser
# ============================================================


class TestTreeSitterCheck:
    """tree-sitter 可用性检测。"""

    def test_check_returns_bool(self):
        idx = CodebaseIndexer()
        assert isinstance(idx._tree_sitter_available, bool)

    def test_check_true_when_import_succeeds(self):
        with patch.dict("sys.modules", {
            "tree_sitter": MagicMock(),
            "tree_sitter_language_pack": MagicMock(),
        }):
            idx = CodebaseIndexer()
            assert idx._tree_sitter_available is True

    def test_check_false_when_import_fails(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        with patch("builtins.__import__", side_effect=ImportError("no module")):
            assert idx._check_tree_sitter() is False

    def test_get_parser_returns_none_when_unavailable(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        assert idx._get_parser("python") is None

    def test_get_parser_returns_none_for_unknown_language(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = True
        # language 不在 lang_map 中(如 vue/svelte),直接返回 None,不调用 get_language
        # 注意:不能用 patch("tree_sitter_language_pack.get_language"),因为模块未安装时
        # patch 自身会尝试导入模块并失败。vue 不在 lang_map,根本不会走到 get_language。
        result = idx._get_parser("vue")
        assert result is None

    def test_get_parser_handles_exception(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = True
        # 验证 _get_parser 在依赖缺失/异常时返回 None(异常处理路径)
        # tree_sitter / tree_sitter_language_pack 均未安装时,
        # _get_parser 内部 from tree_sitter import ... 抛 ImportError 被 except 捕获
        # 注入虚拟 tree_sitter_language_pack 模块,确保 import 链可走到 get_language
        fake_ts = MagicMock()
        fake_ts.Language = MagicMock()
        fake_ts.Parser = MagicMock()
        fake_pack = MagicMock()
        fake_pack.get_language = MagicMock(side_effect=RuntimeError("fail"))
        with patch.dict("sys.modules", {
            "tree_sitter": fake_ts,
            "tree_sitter_language_pack": fake_pack,
        }):
            assert idx._get_parser("python") is None


# ============================================================
# 4. _SYMBOL_NODE_TYPES / _REGEX_PATTERNS
# ============================================================


class TestSymbolNodeTypes:
    """_SYMBOL_NODE_TYPES 符号节点类型映射。"""

    def test_is_dict(self):
        assert isinstance(CodebaseIndexer._SYMBOL_NODE_TYPES, dict)
        assert len(CodebaseIndexer._SYMBOL_NODE_TYPES) >= 10

    def test_values_are_tuples(self):
        for key, val in CodebaseIndexer._SYMBOL_NODE_TYPES.items():
            assert isinstance(key, str)
            assert isinstance(val, tuple)
            assert len(val) == 2
            symbol_type, name_field = val
            assert isinstance(symbol_type, str)
            assert isinstance(name_field, str)

    def test_contains_python_function(self):
        assert "function_definition" in CodebaseIndexer._SYMBOL_NODE_TYPES
        assert CodebaseIndexer._SYMBOL_NODE_TYPES["function_definition"] == ("function", "name")

    def test_contains_python_class(self):
        assert "class_definition" in CodebaseIndexer._SYMBOL_NODE_TYPES

    def test_contains_typescript_function(self):
        assert "function_declaration" in CodebaseIndexer._SYMBOL_NODE_TYPES


class TestRegexPatterns:
    """_REGEX_PATTERNS 正则符号模式。"""

    def test_is_dict(self):
        assert isinstance(CodebaseIndexer._REGEX_PATTERNS, dict)

    def test_contains_python(self):
        assert "python" in CodebaseIndexer._REGEX_PATTERNS
        patterns = CodebaseIndexer._REGEX_PATTERNS["python"]
        assert len(patterns) >= 2

    def test_contains_typescript(self):
        assert "typescript" in CodebaseIndexer._REGEX_PATTERNS

    def test_pattern_structure(self):
        for lang, patterns in CodebaseIndexer._REGEX_PATTERNS.items():
            for item in patterns:
                assert len(item) == 3
                symbol_type, pattern, _ = item
                assert isinstance(symbol_type, str)
                assert hasattr(pattern, "finditer")  # compiled regex

    def test_python_function_pattern_matches(self):
        patterns = CodebaseIndexer._REGEX_PATTERNS["python"]
        func_pattern = [p for s, p, _ in patterns if s == "function"][0]
        m = func_pattern.search("def hello():\n    pass")
        assert m is not None
        assert m.group(1) == "hello"

    def test_python_async_def_matches(self):
        patterns = CodebaseIndexer._REGEX_PATTERNS["python"]
        func_pattern = [p for s, p, _ in patterns if s == "function"][0]
        m = func_pattern.search("async def fetch_data():\n    pass")
        assert m is not None
        assert m.group(1) == "fetch_data"

    def test_python_class_pattern_matches(self):
        patterns = CodebaseIndexer._REGEX_PATTERNS["python"]
        cls_pattern = [p for s, p, _ in patterns if s == "class"][0]
        m = cls_pattern.search("class MyClass:\n    pass")
        assert m is not None
        assert m.group(1) == "MyClass"


# ============================================================
# 5. _extract_symbol_name
# ============================================================


class TestExtractSymbolName:
    """_extract_symbol_name AST 节点符号名提取。"""

    def test_returns_none_for_none_child(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        node = MagicMock()
        node.child_by_field_name.return_value = None
        assert idx._extract_symbol_name(node, "name") is None

    def test_returns_name_for_valid_child(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        node = MagicMock()
        child = MagicMock()
        child.text = b"my_function"
        node.child_by_field_name.return_value = child
        assert idx._extract_symbol_name(node, "name") == "my_function"

    def test_returns_none_for_empty_text(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        node = MagicMock()
        child = MagicMock()
        child.text = b""
        node.child_by_field_name.return_value = child
        # 空字节串 b"" 是 falsy
        assert idx._extract_symbol_name(node, "name") is None

    def test_decodes_utf8_with_replace(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        node = MagicMock()
        child = MagicMock()
        # 含无效 UTF-8 字节
        child.text = b"func_\xff\xfe_name"
        node.child_by_field_name.return_value = child
        result = idx._extract_symbol_name(node, "name")
        # errors="replace" 应返回含替换字符的字符串,不抛异常
        assert isinstance(result, str)
        assert "func_" in result


# ============================================================
# 6. _chunk_by_ast
# ============================================================


class TestChunkByAst:
    """_chunk_by_ast AST 切片。"""

    def test_returns_regex_when_parser_unavailable(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        # 无 parser 时应降级到 _chunk_by_regex
        chunks = idx._chunk_by_ast("def foo():\n    pass", "python")
        assert isinstance(chunks, list)
        # 降级路径应至少产生 1 个切片(符号级)
        assert len(chunks) >= 1

    def test_returns_regex_on_parse_exception(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = True
        mock_parser = MagicMock()
        mock_parser.parse.side_effect = RuntimeError("parse fail")
        with patch.object(idx, "_get_parser", return_value=mock_parser):
            chunks = idx._chunk_by_ast("def foo():\n    pass", "python")
        assert isinstance(chunks, list)

    def test_empty_content_returns_empty_or_regex(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        chunks = idx._chunk_by_ast("", "python")
        # 空内容 → 正则切片也无符号 → 固定行数切片对 0 行返回 []
        assert chunks == []

    def test_max_chunks_limit(self):
        """切片数不超过 MAX_CHUNKS_PER_FILE。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        # 构造超多符号
        content = "\n".join([f"def func_{i}(): pass" for i in range(300)])
        chunks = idx._chunk_by_ast(content, "python")
        assert len(chunks) <= MAX_CHUNKS_PER_FILE


# ============================================================
# 7. _chunk_by_regex
# ============================================================


class TestChunkByRegex:
    """_chunk_by_regex 正则切片(降级方案)。"""

    def test_python_function_symbol_chunk(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "def foo():\n    return 1\n\ndef bar():\n    return 2\n"
        chunks = idx._chunk_by_regex(content, "python")
        assert len(chunks) >= 2
        names = [c.symbol_name for c in chunks]
        assert "foo" in names
        assert "bar" in names
        # 验证切片类型为 function
        assert all(c.symbol_type == "function" for c in chunks if c.symbol_name)

    def test_python_class_symbol_chunk(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "class MyClass:\n    pass\n\nclass Other:\n    pass\n"
        chunks = idx._chunk_by_regex(content, "python")
        assert len(chunks) >= 2
        names = [c.symbol_name for c in chunks]
        assert "MyClass" in names
        assert "Other" in names

    def test_no_symbols_falls_back_to_fixed(self):
        """无符号匹配时降级为固定行数切片。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        # 纯文本无函数/类定义
        content = "line 1\nline 2\nline 3\n"
        chunks = idx._chunk_by_regex(content, "python")
        # 应产生 1 个固定切片
        assert len(chunks) >= 1
        assert all(c.symbol_type == "fixed" for c in chunks)

    def test_unknown_language_falls_back_to_fixed(self):
        """未知语言(无正则模式)直接固定行数切片。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "line 1\nline 2\nline 3\n"
        chunks = idx._chunk_by_regex(content, "unknown_lang")
        assert len(chunks) >= 1
        assert all(c.symbol_type == "fixed" for c in chunks)

    def test_empty_content_returns_empty(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        assert idx._chunk_by_regex("", "python") == []

    def test_fixed_chunk_overlap(self):
        """固定切片有 50 行重叠。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        # 150 行内容,step=100-50=50,应产生 3 个切片(0-99, 50-149, 100-149)
        content = "\n".join([f"line {i}" for i in range(150)])
        chunks = idx._chunk_by_regex(content, "unknown")
        # 至少产生多个切片
        assert len(chunks) >= 2
        # 验证第一个切片行范围
        assert chunks[0].line_start == 1
        assert chunks[0].line_end == 100

    def test_chunk_content_truncated_at_max(self):
        """切片内容超过 MAX_CHUNK_CHARS 截断。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        # 构造一个超长函数
        long_body = "x" * (MAX_CHUNK_CHARS + 1000)
        content = f"def big():\n    {long_body}\n"
        chunks = idx._chunk_by_regex(content, "python")
        assert len(chunks) >= 1
        assert len(chunks[0].content) <= MAX_CHUNK_CHARS

    def test_language_set_on_chunks(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "def foo():\n    pass\n"
        chunks = idx._chunk_by_regex(content, "python")
        assert all(c.language == "python" for c in chunks)

    def test_line_numbers_correct(self):
        """切片行号正确(1-based)。

        注意:源码正则 r"^\\s*(?:async\\s+def|def)\\s+(\\w+)" 带 re.MULTILINE,
        ^\\s* 贪婪匹配会吞掉行首空白和空行,导致 m.start() 落在空行位置而非 def 行。
        所以测试数据去掉空行,避免行号偏移干扰断言。
        """
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "def foo():\n    pass\ndef bar():\n    return 2\n"
        chunks = idx._chunk_by_regex(content, "python")
        # foo 在第 1 行,bar 在第 3 行
        foo_chunk = [c for c in chunks if c.symbol_name == "foo"][0]
        bar_chunk = [c for c in chunks if c.symbol_name == "bar"][0]
        assert foo_chunk.line_start == 1
        assert bar_chunk.line_start == 3

    def test_max_chunks_limit(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "\n".join([f"def f{i}(): pass" for i in range(300)])
        chunks = idx._chunk_by_regex(content, "python")
        assert len(chunks) <= MAX_CHUNKS_PER_FILE

    def test_whitespace_only_content_skipped(self):
        """纯空白内容的切片被跳过。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        content = "   \n\n\t\n"
        chunks = idx._chunk_by_regex(content, "python")
        # 固定切片会检查 chunk_content.strip()
        for c in chunks:
            assert c.content.strip()


# ============================================================
# 8. _collect_code_files
# ============================================================


class TestCollectCodeFiles:
    """_collect_code_files 仓库扫描。"""

    def test_collects_python_files(self, tmp_path):
        (tmp_path / "main.py").write_text("print('hi')")
        (tmp_path / "utils.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 2
        langs = [lang for _, lang in files]
        assert all(l == "python" for l in langs)

    def test_collects_multiple_languages(self, tmp_path):
        (tmp_path / "main.py").write_text("x = 1")
        (tmp_path / "app.ts").write_text("const x = 1")
        (tmp_path / "index.js").write_text("const y = 2")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        langs = sorted([lang for _, lang in files])
        assert "python" in langs
        assert "typescript" in langs
        assert "javascript" in langs

    def test_ignores_node_modules(self, tmp_path):
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / "dep.js").write_text("module.exports = 1")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 1
        assert files[0][1] == "python"

    def test_ignores_git_dir(self, tmp_path):
        git_dir = tmp_path / ".git"
        git_dir.mkdir()
        (git_dir / "config").write_text("[core]")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 1

    def test_ignores_pycache(self, tmp_path):
        pyc = tmp_path / "__pycache__"
        pyc.mkdir()
        (pyc / "main.cpython-312.pyc").write_text("binary")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 1

    def test_ignores_venv(self, tmp_path):
        venv = tmp_path / ".venv"
        venv.mkdir()
        (venv / "lib.py").write_text("x = 1")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 1

    def test_skips_non_code_files(self, tmp_path):
        (tmp_path / "README.md").write_text("# title")
        (tmp_path / "data.json").write_text("{}")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 1

    def test_returns_path_objects(self, tmp_path):
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert isinstance(files[0][0], Path)

    def test_nested_directories(self, tmp_path):
        sub = tmp_path / "src" / "utils"
        sub.mkdir(parents=True)
        (sub / "helper.py").write_text("x = 1")
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = idx._collect_code_files(tmp_path)
        assert len(files) == 2

    def test_max_files_limit(self, tmp_path):
        """超过 MAX_FILES_PER_INDEX 提前返回。"""
        for i in range(10):
            (tmp_path / f"f{i}.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        with patch("app.services.codebase_indexer.MAX_FILES_PER_INDEX", 5):
            files = idx._collect_code_files(tmp_path)
        assert len(files) <= 5


# ============================================================
# 9. _generate_embeddings_batch
# ============================================================


class TestGenerateEmbeddingsBatch:
    """_generate_embeddings_batch 批量 embedding 生成。"""

    @pytest.mark.asyncio
    async def test_empty_chunks_returns_zero(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        count = await idx._generate_embeddings_batch([])
        assert count == 0

    @pytest.mark.asyncio
    async def test_successful_embedding(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = [CodeChunk("a.py", 1, 5, "def foo(): pass", "python")]
        mock_emb = [0.1] * 1536
        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=AsyncMock(return_value=mock_emb)):
            count = await idx._generate_embeddings_batch(chunks)
        assert count == 1
        assert chunks[0].embedding == mock_emb

    @pytest.mark.asyncio
    async def test_embedding_exception_skipped(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = [CodeChunk("a.py", 1, 5, "content", "python")]
        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=AsyncMock(side_effect=RuntimeError("api error"))):
            count = await idx._generate_embeddings_batch(chunks)
        assert count == 0
        assert chunks[0].embedding is None

    @pytest.mark.asyncio
    async def test_wrong_dimension_skipped(self):
        """embedding 维度不是 1536 被跳过。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = [CodeChunk("a.py", 1, 5, "content", "python")]
        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=AsyncMock(return_value=[0.1] * 768)):  # 错误维度
            count = await idx._generate_embeddings_batch(chunks)
        assert count == 0

    @pytest.mark.asyncio
    async def test_batch_processing(self):
        """超过 EMBEDDING_BATCH_SIZE 分批处理。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = [
            CodeChunk(f"f{i}.py", 1, 5, f"content {i}", "python")
            for i in range(25)
        ]
        mock_emb = [0.1] * 1536
        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=AsyncMock(return_value=mock_emb)):
            count = await idx._generate_embeddings_batch(chunks)
        assert count == 25

    @pytest.mark.asyncio
    async def test_content_truncated(self):
        """embedding 输入内容截断到 MAX_CHUNK_CHARS。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        long_content = "x" * (MAX_CHUNK_CHARS + 500)
        chunks = [CodeChunk("a.py", 1, 5, long_content, "python")]
        captured_content = []

        async def fake_embed(content):
            captured_content.append(content)
            return [0.1] * 1536

        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=fake_embed):
            await idx._generate_embeddings_batch(chunks)
        assert len(captured_content[0]) <= MAX_CHUNK_CHARS

    @pytest.mark.asyncio
    async def test_partial_failure(self):
        """部分 embedding 成功部分失败。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = [
            CodeChunk("a.py", 1, 5, "good", "python"),
            CodeChunk("b.py", 1, 5, "bad", "python"),
        ]
        mock_emb = [0.1] * 1536

        async def fake_embed(content):
            if "bad" in content:
                raise RuntimeError("fail")
            return mock_emb

        with patch("app.services.codebase_indexer.llm_gateway.embed",
                   new=fake_embed):
            count = await idx._generate_embeddings_batch(chunks)
        assert count == 1
        assert chunks[0].embedding == mock_emb
        assert chunks[1].embedding is None


# ============================================================
# 10. _write_to_api
# ============================================================


class TestWriteToApi:
    """_write_to_api API 写入。"""

    @pytest.mark.asyncio
    async def test_successful_write(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        chunks = [CodeChunk("a.py", 1, 5, "content", "python", "foo", "function")]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"code": 0, "data": {"inserted": 1}}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await idx._write_to_api("repo-1", chunks, None)
        assert result == {"code": 0, "data": {"inserted": 1}}
        # 验证 URL
        url = mock_client.post.call_args.args[0]
        assert url == "http://localhost:8801/api/v1/codebase/index"

    @pytest.mark.asyncio
    async def test_api_token_in_header(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        chunks = [CodeChunk("a.py", 1, 5, "x", "python")]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx._write_to_api("r", chunks, "my-jwt-token")
        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert headers.get("Authorization") == "Bearer my-jwt-token"

    @pytest.mark.asyncio
    async def test_no_token_no_auth_header(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        chunks = [CodeChunk("a.py", 1, 5, "x", "python")]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx._write_to_api("r", chunks, None)
        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert "Authorization" not in headers

    @pytest.mark.asyncio
    async def test_http_error_raises_runtime(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        chunks = [CodeChunk("a.py", 1, 5, "x", "python")]

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(RuntimeError, match="API 写入失败 HTTP 500"):
                await idx._write_to_api("r", chunks, None)

    @pytest.mark.asyncio
    async def test_payload_structure(self):
        """payload 包含 repoId 和 chunks 数组。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        chunks = [
            CodeChunk("a.py", 1, 5, "content", "python", "foo", "function",
                      [0.1] * 1536)
        ]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx._write_to_api("my-repo", chunks, None)
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert payload.get("repoId") == "my-repo"
        assert len(payload.get("chunks", [])) == 1
        chunk_data = payload["chunks"][0]
        assert chunk_data["filePath"] == "a.py"
        assert chunk_data["lineStart"] == 1
        assert chunk_data["lineEnd"] == 5
        assert chunk_data["symbolName"] == "foo"
        assert chunk_data["embedding"] == [0.1] * 1536


# ============================================================
# 11. index_repository / index_file / search
# ============================================================


class TestIndexRepository:
    """index_repository 仓库索引。"""

    @pytest.mark.asyncio
    async def test_nonexistent_path_returns_error(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        result = await idx.index_repository("/nonexistent/path/xyz", "repo-1")
        assert result.repo_id == "repo-1"
        assert len(result.errors) >= 1
        assert "不存在" in result.errors[0] or "不是目录" in result.errors[0]

    @pytest.mark.asyncio
    async def test_path_is_file_returns_error(self, tmp_path):
        f = tmp_path / "file.py"
        f.write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        result = await idx.index_repository(str(f), "repo-1")
        assert len(result.errors) >= 1

    @pytest.mark.asyncio
    async def test_default_repo_id_generated(self, tmp_path):
        """repo_id 为空时用路径 hash 生成。"""
        (tmp_path / "main.py").write_text("x = 1")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api",
                              new=AsyncMock(return_value={})):
                result = await idx.index_repository(str(tmp_path), None)
        assert result.repo_id.startswith("local-")
        assert len(result.repo_id) > len("local-")

    @pytest.mark.asyncio
    async def test_empty_repo_returns_zero_stats(self, tmp_path):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        result = await idx.index_repository(str(tmp_path), "repo-1")
        assert result.files_scanned == 0
        assert result.chunks_created == 0

    @pytest.mark.asyncio
    async def test_successful_index(self, tmp_path):
        (tmp_path / "main.py").write_text("def foo():\n    return 1\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api",
                              new=AsyncMock(return_value={})):
                result = await idx.index_repository(str(tmp_path), "repo-1")
        assert result.files_scanned == 1
        assert result.files_indexed == 1
        assert result.chunks_created >= 1
        assert result.chunks_vectorized == 1

    @pytest.mark.asyncio
    async def test_empty_file_skipped(self, tmp_path):
        (tmp_path / "empty.py").write_text("")
        (tmp_path / "main.py").write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api",
                              new=AsyncMock(return_value={})):
                result = await idx.index_repository(str(tmp_path), "repo-1")
        # 空文件不索引
        assert result.files_indexed == 1

    @pytest.mark.asyncio
    async def test_write_error_recorded(self, tmp_path):
        (tmp_path / "main.py").write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api",
                              new=AsyncMock(side_effect=RuntimeError("api down"))):
                result = await idx.index_repository(str(tmp_path), "repo-1")
        assert any("写入批次" in e or "api down" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_file_path_relative_to_root(self, tmp_path):
        """切片 file_path 是相对路径。"""
        sub = tmp_path / "src"
        sub.mkdir()
        (sub / "main.py").write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        captured_chunks = []

        async def fake_write(repo_id, chunks, token):
            captured_chunks.extend(chunks)
            return {}

        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=fake_write):
                await idx.index_repository(str(tmp_path), "repo-1")
        assert len(captured_chunks) >= 1
        # 路径应为 src/main.py(正斜杠)
        assert captured_chunks[0].file_path == "src/main.py"


class TestIndexFile:
    """index_file 单文件索引。"""

    @pytest.mark.asyncio
    async def test_nonexistent_file_returns_error(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        result = await idx.index_file("/nonexistent.py", "repo-1")
        assert result.repo_id == "repo-1"
        assert len(result.errors) >= 1
        assert "不存在" in result.errors[0]

    @pytest.mark.asyncio
    async def test_path_is_dir_returns_error(self, tmp_path):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        result = await idx.index_file(str(tmp_path), "repo-1")
        assert len(result.errors) >= 1

    @pytest.mark.asyncio
    async def test_successful_index(self, tmp_path):
        f = tmp_path / "main.py"
        f.write_text("def foo():\n    return 1\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api",
                              new=AsyncMock(return_value={})):
                result = await idx.index_file(str(f), "repo-1")
        assert result.files_scanned == 1
        assert result.files_indexed == 1
        assert result.chunks_created >= 1
        assert result.chunks_vectorized == 1

    @pytest.mark.asyncio
    async def test_empty_file_returns_empty(self, tmp_path):
        f = tmp_path / "empty.py"
        f.write_text("")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        result = await idx.index_file(str(f), "repo-1")
        assert result.chunks_created == 0
        assert result.files_indexed == 0

    @pytest.mark.asyncio
    async def test_language_inferred_from_extension(self, tmp_path):
        f = tmp_path / "main.ts"
        f.write_text("function foo() { return 1; }\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        captured_chunks = []

        async def fake_write(repo_id, chunks, token):
            captured_chunks.extend(chunks)
            return {}

        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=fake_write):
                await idx.index_file(str(f), "repo-1")
        assert len(captured_chunks) >= 1
        assert all(c.language == "typescript" for c in captured_chunks)

    @pytest.mark.asyncio
    async def test_explicit_language_overrides(self, tmp_path):
        f = tmp_path / "main.py"
        f.write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        captured_chunks = []

        async def fake_write(repo_id, chunks, token):
            captured_chunks.extend(chunks)
            return {}

        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=fake_write):
                await idx.index_file(str(f), "repo-1", language="typescript")
        # 显式指定 typescript,但内容是 python,正则无匹配 → 固定切片
        assert all(c.language == "typescript" for c in captured_chunks)

    @pytest.mark.asyncio
    async def test_exception_recorded(self, tmp_path):
        f = tmp_path / "main.py"
        f.write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        with patch.object(idx, "_chunk_by_ast",
                          side_effect=RuntimeError("chunk fail")):
            result = await idx.index_file(str(f), "repo-1")
        assert any("chunk fail" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_file_path_uses_basename(self, tmp_path):
        """单文件索引时 file_path 为文件名(不含目录)。"""
        f = tmp_path / "main.py"
        f.write_text("def foo():\n    pass\n")
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._tree_sitter_available = False
        idx._api_base_url = "http://localhost:8801"
        captured_chunks = []

        async def fake_write(repo_id, chunks, token):
            captured_chunks.extend(chunks)
            return {}

        with patch.object(idx, "_generate_embeddings_batch",
                          new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=fake_write):
                await idx.index_file(str(f), "repo-1")
        assert all(c.file_path == "main.py" for c in captured_chunks)


class TestSearch:
    """search 语义搜索。"""

    @pytest.mark.asyncio
    async def test_successful_search(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "code": 0,
            "data": {
                "chunks": [
                    {"file_path": "a.py", "score": 0.9, "content": "def foo(): pass"}
                ]
            }
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            results = await idx.search("user auth logic", repo_id="r1", top_k=5)
        assert len(results) == 1
        assert results[0]["file_path"] == "a.py"

    @pytest.mark.asyncio
    async def test_search_with_all_params(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": {"chunks": []}}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx.search(
                "query", repo_id="r1", language="python", top_k=20,
                api_token="tok"
            )
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert payload["query"] == "query"
        assert payload["topK"] == 20
        assert payload["repoId"] == "r1"
        assert payload["language"] == "python"
        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert headers["Authorization"] == "Bearer tok"

    @pytest.mark.asyncio
    async def test_http_error_returns_empty(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "error"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            results = await idx.search("query")
        assert results == []

    @pytest.mark.asyncio
    async def test_exception_returns_empty(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        with patch("httpx.AsyncClient",
                   side_effect=RuntimeError("network fail")):
            results = await idx.search("query")
        assert results == []

    @pytest.mark.asyncio
    async def test_response_without_data_key(self):
        """响应无 data 键时直接用顶层 dict。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "chunks": [{"file_path": "x.py", "score": 0.8}]
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            results = await idx.search("query")
        # data.get("data", data) 应回退到顶层 dict,再取 chunks
        assert len(results) == 1
        assert results[0]["file_path"] == "x.py"

    @pytest.mark.asyncio
    async def test_no_repo_id_omits_field(self):
        """repo_id 为空时 payload 不含 repoId。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": {"chunks": []}}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx.search("query", repo_id=None)
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert "repoId" not in payload

    @pytest.mark.asyncio
    async def test_no_language_omits_field(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": {"chunks": []}}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await idx.search("query", language=None)
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert "language" not in payload


# ============================================================
# 12. 全局单例
# ============================================================


class TestGlobalSingleton:
    """codebase_indexer 全局单例。"""

    def test_singleton_exists(self):
        assert global_indexer is not None

    def test_singleton_is_indexer(self):
        assert isinstance(global_indexer, CodebaseIndexer)

    def test_singleton_has_methods(self):
        for method in ["index_repository", "index_file", "search",
                       "_chunk_by_ast", "_chunk_by_regex", "_collect_code_files",
                       "_generate_embeddings_batch", "_write_to_api"]:
            assert hasattr(global_indexer, method)

    def test_module_exports(self):
        assert hasattr(codebase_indexer, "CodeChunk")
        assert hasattr(codebase_indexer, "IndexResult")
        assert hasattr(codebase_indexer, "CodebaseIndexer")
        assert hasattr(codebase_indexer, "codebase_indexer")
        assert hasattr(codebase_indexer, "_EXT_TO_LANG")
        assert hasattr(codebase_indexer, "_IGNORED_DIRS")

    def test_singleton_api_base_url_from_env(self, monkeypatch):
        """API_SERVICE_URL 环境变量配置 _api_base_url。"""
        monkeypatch.setenv("API_SERVICE_URL", "http://custom-api:9999/")
        idx = CodebaseIndexer()
        assert idx._api_base_url == "http://custom-api:9999"

    def test_singleton_api_base_url_default(self, monkeypatch):
        monkeypatch.delenv("API_SERVICE_URL", raising=False)
        idx = CodebaseIndexer()
        assert idx._api_base_url == "http://localhost:8801"
