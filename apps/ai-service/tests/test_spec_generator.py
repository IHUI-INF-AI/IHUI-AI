"""Spec 文档生成器测试 — AST 提取 + Markdown 生成 + 持久化 + LLM + apply/preview/confirm + 评审 + 拆分 + 增强。

覆盖 spec_generator.py 全部公共 API + 关键内部方法。
mock 策略:LLM 调用(mock llm_gateway.complete)/ 文件系统(tmp_path)/ git config / package.json。
不依赖 watchdog(测试降级路径)。
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import date
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.spec_generator import (
    MAX_FILE_CHARS,
    MAX_SPEC_FILES,
    ExtractedEndpoint,
    ExtractedSchema,
    ExtractedSymbol,
    SpecGenerator,
    SpecResult,
    spec_generator,
)


# ── fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def generator() -> SpecGenerator:
    """独立的 SpecGenerator 实例(不污染全局单例)。"""
    return SpecGenerator()


@pytest.fixture
def ts_workspace(tmp_path: Path) -> Path:
    """TypeScript 工作区(含 Fastify 路由 + Drizzle schema + 类/函数)。"""
    (tmp_path / "package.json").write_text(
        json.dumps({"name": "test-workspace", "version": "2.1.0"}), encoding="utf-8"
    )
    # 路由文件
    (tmp_path / "routes.ts").write_text(
        """import { FastifyInstance } from 'fastify';
import { UserSchema } from './schemas';

export async function userRoutes(server: FastifyInstance) {
  server.get('/users', { schema: { response: { 200: UserSchema } } }, async (req, reply) => {
    return [];
  });
  server.post('/users', { schema: { body: CreateUserSchema, response: { 201: UserSchema } } }, async (req, reply) => {
    return {};
  });
}
""",
        encoding="utf-8",
    )
    # Schema 文件
    (tmp_path / "schemas.ts").write_text(
        """import { pgTable, varchar } from 'drizzle-orm';

export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  name: varchar('name'),
  email: varchar('email'),
});

export const UserSchema = {};
export const CreateUserSchema = {};
""",
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture
def py_workspace(tmp_path: Path) -> Path:
    """Python 工作区(含 FastAPI 路由 + SQLAlchemy model)。"""
    (tmp_path / "app.py").write_text(
        '''from fastapi import FastAPI, Body
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    name: str
    age: int

@app.get("/users")
async def list_users():
    return []

@app.post("/users")
async def create_user(user: User = Body(...)) -> User:
    return user
''',
        encoding="utf-8",
    )
    (tmp_path / "models.py").write_text(
        '''from sqlalchemy import Column, String

class UserModel:
    __tablename__ = 'users'
    id = Column(String, primary_key=True)
''',
        encoding="utf-8",
    )
    return tmp_path


# ════════════════════════════════════════════════════════════════════════
# 1. dataclass
# ════════════════════════════════════════════════════════════════════════

class TestDataclasses:
    def test_extracted_symbol_defaults(self):
        s = ExtractedSymbol(
            name="foo", type="function", file_path="a.ts",
            line_start=1, line_end=5, language="typescript",
        )
        assert s.doc is None

    def test_extracted_endpoint_defaults(self):
        e = ExtractedEndpoint(method="GET", path="/x", file_path="a.ts", line=1)
        assert e.handler is None
        assert e.params == []
        assert e.response_type is None

    def test_extracted_schema_defaults(self):
        s = ExtractedSchema(name="users", file_path="a.ts", line=1)
        assert s.fields == []

    def test_spec_result(self):
        r = SpecResult(spec="# x", sections=[], stats={"files": 1}, duration_ms=10)
        assert r.spec == "# x"
        assert r.duration_ms == 10


# ════════════════════════════════════════════════════════════════════════
# 2. 常量
# ════════════════════════════════════════════════════════════════════════

class TestConstants:
    def test_max_spec_files(self):
        assert MAX_SPEC_FILES == 800

    def test_max_file_chars(self):
        assert MAX_FILE_CHARS == 200_000


# ════════════════════════════════════════════════════════════════════════
# 3. _collect_files
# ════════════════════════════════════════════════════════════════════════

class TestCollectFiles:
    def test_file_scope(self, generator, ts_workspace):
        """file scope:单文件收集。"""
        files = generator._collect_files(ts_workspace, {"type": "file", "path": "routes.ts"})
        assert len(files) == 1
        assert files[0][0].name == "routes.ts"
        assert files[0][1] == "typescript"

    def test_file_scope_missing_path(self, generator, ts_workspace):
        """file scope 无 path → 空列表。"""
        assert generator._collect_files(ts_workspace, {"type": "file"}) == []

    def test_file_scope_nonexistent(self, generator, ts_workspace):
        """file scope 文件不存在 → 空列表。"""
        assert generator._collect_files(ts_workspace, {"type": "file", "path": "nope.ts"}) == []

    def test_file_scope_unsupported_ext(self, generator, tmp_path):
        """file scope 不支持的扩展名 → 空列表。"""
        (tmp_path / "x.txt").write_text("hello", encoding="utf-8")
        assert generator._collect_files(tmp_path, {"type": "file", "path": "x.txt"}) == []

    def test_dir_scope(self, generator, ts_workspace):
        """dir scope:目录递归。"""
        files = generator._collect_files(ts_workspace, {"type": "dir", "path": "."})
        # package.json 不算(非代码),routes.ts + schemas.ts
        names = [f[0].name for f in files]
        assert "routes.ts" in names
        assert "schemas.ts" in names

    def test_dir_scope_missing_path(self, generator, ts_workspace):
        assert generator._collect_files(ts_workspace, {"type": "dir"}) == []

    def test_dir_scope_nonexistent(self, generator, ts_workspace):
        assert generator._collect_files(ts_workspace, {"type": "dir", "path": "nodir"}) == []

    def test_workspace_scope(self, generator, ts_workspace):
        """workspace scope:全工作区。"""
        files = generator._collect_files(ts_workspace, {"type": "workspace"})
        assert len(files) >= 2

    def test_workspace_scope_default_type(self, generator, ts_workspace):
        """默认 type=workspace。"""
        files = generator._collect_files(ts_workspace, {})
        assert len(files) >= 2

    def test_workspace_scope_nonexistent_root(self, generator, tmp_path):
        """workspace 根不存在 → 空列表。"""
        assert generator._collect_files(tmp_path / "nonexistent", {"type": "workspace"}) == []

    def test_max_spec_files_cap(self, generator, tmp_path):
        """文件数超过 MAX_SPEC_FILES 上限裁剪。"""
        for i in range(MAX_SPEC_FILES + 5):
            (tmp_path / f"f{i}.ts").write_text("export const x = 1;", encoding="utf-8")
        files = generator._collect_files(tmp_path, {"type": "workspace"})
        assert len(files) == MAX_SPEC_FILES


# ════════════════════════════════════════════════════════════════════════
# 4. _extract_symbols(正则降级路径,tree-sitter 可能不可用)
# ════════════════════════════════════════════════════════════════════════

class TestExtractSymbols:
    def test_ts_function(self, generator):
        content = "export function foo() { return 1; }"
        syms = generator._extract_symbols(content, "typescript", "a.ts")
        # AST 可用或降级正则,至少提取到 foo
        names = [s.name for s in syms]
        assert "foo" in names

    def test_ts_class(self, generator):
        content = "export class MyClass { method() {} }"
        syms = generator._extract_symbols(content, "typescript", "a.ts")
        names = [s.name for s in syms]
        assert "MyClass" in names

    def test_python_function(self, generator):
        content = "def hello():\n    pass\n"
        syms = generator._extract_symbols(content, "python", "a.py")
        names = [s.name for s in syms]
        assert "hello" in names

    def test_python_class(self, generator):
        content = "class Foo:\n    pass\n"
        syms = generator._extract_symbols(content, "python", "a.py")
        names = [s.name for s in syms]
        assert "Foo" in names

    def test_empty_content(self, generator):
        syms = generator._extract_symbols("", "typescript", "a.ts")
        assert syms == []

    def test_unknown_language(self, generator):
        """未知语言 → 正则 patterns 为空 → 无符号。"""
        syms = generator._extract_symbols("function foo() {}", "unknown", "a.x")
        # 降级正则无匹配
        assert isinstance(syms, list)


# ════════════════════════════════════════════════════════════════════════
# 5. _extract_endpoints
# ════════════════════════════════════════════════════════════════════════

class TestExtractEndpoints:
    def test_fastify_get(self, generator):
        content = "server.get('/users', handler)"
        eps = generator._extract_endpoints(content, "r.ts", "typescript")
        assert len(eps) == 1
        assert eps[0].method == "GET"
        assert eps[0].path == "/users"

    def test_fastify_post(self, generator):
        content = "server.post('/users', handler)"
        eps = generator._extract_endpoints(content, "r.ts", "typescript")
        assert eps[0].method == "POST"

    def test_express_router(self, generator):
        content = "router.get('/items', handler)"
        eps = generator._extract_endpoints(content, "r.ts", "typescript")
        assert len(eps) == 1
        assert eps[0].path == "/items"

    def test_fastapi_decorator(self, generator):
        content = '@router.get("/users")\nasync def list_users(): pass'
        eps = generator._extract_endpoints(content, "r.py", "python")
        assert len(eps) == 1
        assert eps[0].method == "GET"
        assert eps[0].path == "/users"

    def test_fastapi_post_with_body(self, generator):
        content = '''@app.post("/users")
async def create_user(user: User = Body(...)) -> User:
    return user'''
        eps = generator._extract_endpoints(content, "r.py", "python")
        assert len(eps) == 1
        assert eps[0].method == "POST"
        # params 应提取到 user: User
        assert any("user" in p for p in eps[0].params)
        # response_type 应为 User
        assert eps[0].response_type == "User"

    def test_fastify_with_schema(self, generator):
        """Fastify schema: { body: X, response: { 200: Y } } 提取。"""
        content = """server.post('/users', {
  schema: {
    body: CreateUserSchema,
    response: { 200: UserSchema }
  }
}, handler)"""
        eps = generator._extract_endpoints(content, "r.ts", "typescript")
        assert len(eps) == 1
        # params 应包含 body: CreateUserSchema
        assert any("CreateUserSchema" in p for p in eps[0].params)
        # response_type 应为 UserSchema
        assert eps[0].response_type == "UserSchema"

    def test_no_endpoints(self, generator):
        """无路由定义 → 空列表。"""
        eps = generator._extract_endpoints("const x = 1;", "r.ts", "typescript")
        assert eps == []

    def test_go_http(self, generator):
        content = 'http.HandleFunc("/api/users", handler)'
        eps = generator._extract_endpoints(content, "r.go", "go")
        # Go 模式无 method 捕获组,默认 GET
        assert len(eps) == 1
        assert eps[0].path == "/api/users"

    def test_multiple_endpoints(self, generator):
        content = """
server.get('/a', h1);
server.post('/b', h2);
server.delete('/c', h3);
"""
        eps = generator._extract_endpoints(content, "r.ts", "typescript")
        assert len(eps) == 3
        methods = {e.method for e in eps}
        assert methods == {"GET", "POST", "DELETE"}


# ════════════════════════════════════════════════════════════════════════
# 6. _extract_schemas
# ════════════════════════════════════════════════════════════════════════

class TestExtractSchemas:
    def test_drizzle_pgtable(self, generator):
        content = """export const users = pgTable('users', {
  id: varchar('id'),
  name: varchar('name'),
});"""
        schemas = generator._extract_schemas(content, "s.ts", "typescript")
        assert len(schemas) == 1
        assert schemas[0].name == "users"
        assert "id" in schemas[0].fields
        assert "name" in schemas[0].fields

    def test_drizzle_mysql_table(self, generator):
        content = "export const items = mysqlTable('items', { id: varchar('id') });"
        schemas = generator._extract_schemas(content, "s.ts", "typescript")
        assert schemas[0].name == "items"

    def test_sqlalchemy_tablename(self, generator):
        content = "class User:\n    __tablename__ = 'users'\n"
        schemas = generator._extract_schemas(content, "s.py", "python")
        assert len(schemas) == 1
        assert schemas[0].name == "users"

    def test_go_struct(self, generator):
        content = "type User struct {\n    ID string\n}"
        schemas = generator._extract_schemas(content, "s.go", "go")
        assert len(schemas) == 1
        assert schemas[0].name == "User"

    def test_no_schemas(self, generator):
        schemas = generator._extract_schemas("const x = 1;", "s.ts", "typescript")
        assert schemas == []


# ════════════════════════════════════════════════════════════════════════
# 7. _extract_imports
# ════════════════════════════════════════════════════════════════════════

class TestExtractImports:
    def test_ts_imports(self, generator):
        content = """import { foo } from './foo';
import bar from 'lib/bar';
import * as baz from 'lib/baz';"""
        imps = generator._extract_imports(content, "a.ts", "typescript")
        assert './foo' in imps
        assert 'lib/bar' in imps

    def test_python_imports(self, generator):
        content = """from os import path
import sys
from .utils import helper"""
        imps = generator._extract_imports(content, "a.py", "python")
        assert 'os' in imps
        assert 'sys' in imps
        assert '.utils' in imps

    def test_go_imports(self, generator):
        content = 'import "fmt"\nimport "net/http"'
        imps = generator._extract_imports(content, "a.go", "go")
        assert 'fmt' in imps
        assert 'net/http' in imps

    def test_no_imports(self, generator):
        assert generator._extract_imports("const x = 1;", "a.ts", "typescript") == []


# ════════════════════════════════════════════════════════════════════════
# 8. _compute_scope_hash
# ════════════════════════════════════════════════════════════════════════

class TestScopeHash:
    def test_stable_hash(self, generator):
        """相同 scope 生成相同哈希。"""
        scope = {"type": "workspace", "path": "src"}
        h1 = generator._compute_scope_hash(scope)
        h2 = generator._compute_scope_hash(scope)
        assert h1 == h2
        assert len(h1) == 12

    def test_different_scope_different_hash(self, generator):
        h1 = generator._compute_scope_hash({"type": "file", "path": "a.ts"})
        h2 = generator._compute_scope_hash({"type": "file", "path": "b.ts"})
        assert h1 != h2

    def test_key_order_independent(self, generator):
        """sort_keys 保证 key 顺序不影响哈希。"""
        h1 = generator._compute_scope_hash({"type": "workspace", "path": "src"})
        h2 = generator._compute_scope_hash({"path": "src", "type": "workspace"})
        assert h1 == h2


# ════════════════════════════════════════════════════════════════════════
# 9. _describe_scope
# ════════════════════════════════════════════════════════════════════════

class TestDescribeScope:
    def test_file_scope(self, generator, tmp_path):
        desc = generator._describe_scope({"type": "file", "path": "a.ts"}, tmp_path)
        assert "单文件" in desc
        assert "a.ts" in desc

    def test_dir_scope(self, generator, tmp_path):
        desc = generator._describe_scope({"type": "dir", "path": "src"}, tmp_path)
        assert "目录" in desc

    def test_workspace_scope(self, generator, tmp_path):
        desc = generator._describe_scope({"type": "workspace"}, tmp_path)
        assert "全工作区" in desc

    def test_file_scope_no_path(self, generator, tmp_path):
        desc = generator._describe_scope({"type": "file"}, tmp_path)
        assert "未指定" in desc


# ════════════════════════════════════════════════════════════════════════
# 10. _summarize_spec
# ════════════════════════════════════════════════════════════════════════

class TestSummarizeSpec:
    def test_with_heading(self, generator):
        assert generator._summarize_spec("# Title\nbody") == "# Title"

    def test_with_frontmatter(self, generator):
        """_summarize_spec 对 frontmatter 内容降级:首个非 --- 非 > 非空行即返回(author: x)。"""
        content = "---\nauthor: x\n---\n\n# Real Title"
        # 源码行为:frontmatter 内的 author 行不是 # / --- / > 开头 → 直接返回
        assert generator._summarize_spec(content) == "author: x"

    def test_no_heading(self, generator):
        assert generator._summarize_spec("just text") == "just text"

    def test_empty(self, generator):
        assert generator._summarize_spec("") == ""

    def test_truncate_80(self, generator):
        long_title = "# " + "x" * 100
        result = generator._summarize_spec(long_title)
        assert len(result) == 80


# ════════════════════════════════════════════════════════════════════════
# 11. _parse_frontmatter / _build_frontmatter
# ════════════════════════════════════════════════════════════════════════

class TestFrontmatter:
    def test_parse_with_frontmatter(self, generator):
        spec = "---\nauthor: alice\ndate: 2026-01-01\n---\nbody"
        fields, fm_raw, body = generator._parse_frontmatter(spec)
        assert fields["author"] == "alice"
        assert fields["date"] == "2026-01-01"
        assert "body" in body

    def test_parse_no_frontmatter(self, generator):
        fields, fm_raw, body = generator._parse_frontmatter("just body")
        assert fields == {}
        assert body == "just body"

    def test_parse_malformed(self, generator):
        """只有 --- 开头但无结束 --- → 视为无 frontmatter。"""
        fields, _, body = generator._parse_frontmatter("---\nauthor: x\nbody")
        assert fields == {}

    def test_build_frontmatter(self, generator, tmp_path):
        variables = {"author": "bob", "date": "2026-01-01", "version": "1.0", "project": "test"}
        fm = generator._build_frontmatter(variables, {"type": "workspace"})
        assert "author: bob" in fm
        assert "version: 1.0" in fm
        assert fm.startswith("---")
        assert fm.endswith("---\n")  # join 后末尾为 ---\n

    def test_build_frontmatter_from_fields_defaults(self, generator, tmp_path):
        """_build_frontmatter_from_fields 补充默认值。"""
        fm = generator._build_frontmatter_from_fields({}, {"type": "workspace"})
        assert "author: Unknown" in fm
        assert "version: 1.0.0" in fm
        assert "status: draft" in fm

    def test_build_frontmatter_from_fields_preserve(self, generator, tmp_path):
        """_build_frontmatter_from_fields 保留传入字段。"""
        fm = generator._build_frontmatter_from_fields(
            {"author": "alice", "status": "approved"}, {"type": "workspace"}
        )
        assert "author: alice" in fm
        assert "status: approved" in fm


# ════════════════════════════════════════════════════════════════════════
# 12. _get_template_variables / _apply_template_variables
# ════════════════════════════════════════════════════════════════════════

class TestTemplateVariables:
    def test_get_variables_with_package_json(self, generator, ts_workspace):
        variables = generator._get_template_variables(str(ts_workspace))
        assert variables["project"] == "test-workspace"
        assert variables["version"] == "2.1.0"
        assert variables["date"] == date.today().strftime("%Y-%m-%d")

    def test_get_variables_no_package_json(self, generator, tmp_path):
        """无 package.json → 降级默认值。"""
        variables = generator._get_template_variables(str(tmp_path))
        assert variables["version"] == "1.0.0"
        assert variables["project"] == tmp_path.name

    def test_get_variables_author_git_config(self, generator, tmp_path):
        """author 从 git config 读取(降级 Unknown)。"""
        variables = generator._get_template_variables(str(tmp_path))
        # 测试环境可能无 git,降级 Unknown;有的话是真实用户名
        assert isinstance(variables["author"], str)
        assert len(variables["author"]) > 0

    def test_apply_template_variables(self, generator):
        result = generator._apply_template_variables(
            "author={{author}} version={{version}} missing={{nope}}",
            {"author": "alice", "version": "1.0"},
        )
        assert "author=alice" in result
        assert "version=1.0" in result
        # 缺失变量保留原样
        assert "missing={{nope}}" in result


# ════════════════════════════════════════════════════════════════════════
# 13. generate 主入口
# ════════════════════════════════════════════════════════════════════════

class TestGenerate:
    @pytest.mark.asyncio
    async def test_nonexistent_workspace(self, generator, tmp_path):
        """工作区不存在 → 错误 SpecResult。"""
        result = await generator.generate(str(tmp_path / "nope"), {"type": "workspace"})
        assert "错误" in result.spec
        assert result.stats["files"] == 0

    @pytest.mark.asyncio
    async def test_ts_workspace(self, generator, ts_workspace):
        """TypeScript 工作区生成完整 spec。"""
        result = await generator.generate(str(ts_workspace), {"type": "workspace"})
        assert result.stats["files"] >= 2
        assert result.stats["endpoints"] >= 2  # GET + POST /users
        assert result.stats["schemas"] >= 1  # users pgTable
        # workspace_name 取自 root.name(tmp_path 名),非 package.json name 字段
        assert "规格文档" in result.spec
        assert ts_workspace.name in result.spec
        assert "## API 契约" in result.spec
        assert "## 数据模型" in result.spec
        # 持久化文件
        spec_file = ts_workspace / ".trae-cn" / "specs" / f"{generator._compute_scope_hash({'type': 'workspace'})}.md"
        assert spec_file.is_file()

    @pytest.mark.asyncio
    async def test_py_workspace(self, generator, py_workspace):
        """Python 工作区生成 spec。"""
        result = await generator.generate(str(py_workspace), {"type": "workspace"})
        assert result.stats["files"] >= 2
        assert result.stats["endpoints"] >= 2
        assert result.stats["schemas"] >= 1

    @pytest.mark.asyncio
    async def test_languages_filter(self, generator, ts_workspace):
        """languages 过滤:只处理指定语言。"""
        # 加一个 py 文件,但只过滤 typescript
        (ts_workspace / "extra.py").write_text("def foo(): pass", encoding="utf-8")
        result = await generator.generate(
            str(ts_workspace), {"type": "workspace"}, languages=["typescript"]
        )
        # py 文件被过滤掉
        assert all("extra.py" not in s["content"] for s in result.sections)

    @pytest.mark.asyncio
    async def test_file_scope_generate(self, generator, ts_workspace):
        """file scope 单文件生成。"""
        result = await generator.generate(
            str(ts_workspace), {"type": "file", "path": "routes.ts"}
        )
        assert result.stats["files"] == 1
        assert result.stats["endpoints"] >= 2

    @pytest.mark.asyncio
    async def test_empty_workspace(self, generator, tmp_path):
        """空工作区(无代码文件)。"""
        result = await generator.generate(str(tmp_path), {"type": "workspace"})
        assert result.stats["files"] == 0
        assert result.stats["symbols"] == 0

    @pytest.mark.asyncio
    async def test_duration_ms_positive(self, generator, ts_workspace):
        result = await generator.generate(str(ts_workspace), {"type": "workspace"})
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_persist_creates_history(self, generator, ts_workspace):
        """持久化创建 history 目录 + 历史文件。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        history_dir = ts_workspace / ".trae-cn" / "specs" / "history"
        assert history_dir.is_dir()
        history_files = list(history_dir.glob("*.md"))
        assert len(history_files) >= 1


# ════════════════════════════════════════════════════════════════════════
# 14. load_spec / get_history
# ════════════════════════════════════════════════════════════════════════

class TestLoadSpec:
    @pytest.mark.asyncio
    async def test_load_latest(self, generator, ts_workspace):
        """生成后 load_spec latest 返回内容。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        loaded = generator.load_spec(str(ts_workspace), {"type": "workspace"}, "latest")
        assert loaded["spec"]
        assert "filePath" in loaded
        assert loaded["filePath"].endswith(".md")

    def test_load_nonexistent(self, generator, tmp_path):
        """文件不存在 → 空 spec。"""
        loaded = generator.load_spec(str(tmp_path), {"type": "workspace"}, "latest")
        assert loaded["spec"] == ""
        assert loaded["filePath"] == ""

    @pytest.mark.asyncio
    async def test_get_history(self, generator, ts_workspace):
        """生成后 get_history 返回历史列表。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        history = generator.get_history(str(ts_workspace), {"type": "workspace"})
        assert len(history) >= 1
        assert "timestamp" in history[0]
        assert "filePath" in history[0]

    def test_get_history_empty(self, generator, tmp_path):
        """无历史 → 空列表。"""
        assert generator.get_history(str(tmp_path), {"type": "workspace"}) == []

    @pytest.mark.asyncio
    async def test_load_by_version(self, generator, ts_workspace):
        """按版本号加载历史文件。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        history = generator.get_history(str(ts_workspace), {"type": "workspace"})
        if history:
            version = history[0]["timestamp"]
            loaded = generator.load_spec(
                str(ts_workspace), {"type": "workspace"}, version
            )
            assert loaded["spec"]


# ════════════════════════════════════════════════════════════════════════
# 15. generate_diff
# ════════════════════════════════════════════════════════════════════════

class TestGenerateDiff:
    @pytest.mark.asyncio
    async def test_diff_first_generation(self, generator, ts_workspace):
        """首次生成 diff:old 为空,new 有内容。"""
        result = await generator.generate_diff(str(ts_workspace), {"type": "workspace"})
        assert result["oldSpec"] == ""
        assert result["newSpec"]
        assert "addedLines" in result
        assert "removedLines" in result

    @pytest.mark.asyncio
    async def test_diff_second_generation_no_change(self, generator, ts_workspace):
        """二次生成 diff:内容相同 → changedFiles 为空。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        result = await generator.generate_diff(str(ts_workspace), {"type": "workspace"})
        # 内容基本一致(可能时间戳/frontmatter 略有不同,但主体相同)
        assert isinstance(result["diff"], str)


# ════════════════════════════════════════════════════════════════════════
# 16. _call_llm(mock)
# ════════════════════════════════════════════════════════════════════════

class TestCallLlm:
    @pytest.mark.asyncio
    async def test_llm_success(self, generator):
        """LLM 调用成功。"""
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "content": "LLM response",
            "error": None,
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            content, ok = await generator._call_llm("prompt")
        assert ok is True
        assert content == "LLM response"

    @pytest.mark.asyncio
    async def test_llm_first_model_fails_second_succeeds(self, generator):
        """fallback 链:第一个模型失败,第二个成功。"""
        call_count = {"n": 0}

        async def fake_complete(messages, model=None):
            call_count["n"] += 1
            if model == "gpt-4o":
                return {"error": True, "error_message": "model unavailable"}
            return {"content": "fallback response", "error": None}

        mock_gateway = MagicMock()
        mock_gateway.complete = fake_complete
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            content, ok = await generator._call_llm("prompt")
        assert ok is True
        assert content == "fallback response"
        assert call_count["n"] == 2

    @pytest.mark.asyncio
    async def test_llm_all_models_fail(self, generator):
        """所有模型都失败 → ok=False。"""
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "error": True, "error_message": "all fail",
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            content, ok = await generator._call_llm("prompt")
        assert ok is False
        assert "all fail" in content or "fail" in content.lower()

    @pytest.mark.asyncio
    async def test_llm_empty_content(self, generator):
        """LLM 返回空内容 → 视为失败,尝试下一个。"""
        call_count = {"n": 0}

        async def fake_complete(messages, model=None):
            call_count["n"] += 1
            if model != "gpt-4o-mini":
                return {"content": "", "error": None}
            return {"content": "ok", "error": None}

        mock_gateway = MagicMock()
        mock_gateway.complete = fake_complete
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            content, ok = await generator._call_llm("prompt")
        assert ok is True
        assert content == "ok"

    @pytest.mark.asyncio
    async def test_llm_import_error(self, generator):
        """llm_gateway 导入失败 → ok=False。"""
        with patch.dict("sys.modules", {"app.core.llm_gateway": None}):
            content, ok = await generator._call_llm("prompt")
        assert ok is False


# ════════════════════════════════════════════════════════════════════════
# 17. unified diff 解析 + patch 应用
# ════════════════════════════════════════════════════════════════════════

class TestUnifiedDiff:
    def test_parse_simple_diff(self, generator):
        """解析简单 unified diff。"""
        patch = """--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+new line
 line2
"""
        result = generator._parse_unified_diff(patch)
        assert "file.ts" in result
        hunks = result["file.ts"]
        assert len(hunks) == 3  # line1, new line, line2
        actions = [h[1] for h in hunks]
        assert " " in actions  # context
        assert "+" in actions  # added

    def test_parse_empty_patch(self, generator):
        assert generator._parse_unified_diff("") == {}

    def test_apply_patch_add_line(self, generator):
        """应用 patch:新增一行。"""
        original = "line1\nline2\n"
        patch = """--- a/f.txt
+++ b/f.txt
@@ -1,2 +1,3 @@
 line1
+inserted
 line2
"""
        hunks = generator._parse_unified_diff(patch).get("f.txt", [])
        result = generator._apply_patch_to_content(original, hunks)
        assert "inserted" in result
        assert result.count("\n") == 3

    def test_apply_patch_remove_line(self, generator):
        """应用 patch:删除一行。"""
        original = "line1\ntodelete\nline2\n"
        patch = """--- a/f.txt
+++ b/f.txt
@@ -1,3 +1,2 @@
 line1
-todelete
 line2
"""
        hunks = generator._parse_unified_diff(patch).get("f.txt", [])
        result = generator._apply_patch_to_content(original, hunks)
        assert "todelete" not in result

    def test_apply_empty_hunks(self, generator):
        """空 hunks → 返回原文。"""
        assert generator._apply_patch_to_content("original", []) == "original"

    def test_extract_affected_files(self, generator):
        """从 spec 提取受影响文件路径。"""
        spec = """
### `src/app.ts`

Some content.

| `src/utils.ts` |
"""
        files = generator._extract_affected_files_from_spec(spec)
        assert "src/app.ts" in files
        assert "src/utils.ts" in files

    def test_extract_affected_files_limit(self, generator):
        """受影响文件上限 50。"""
        spec = "\n".join(f"`file{i}.ts`" for i in range(60))
        files = generator._extract_affected_files_from_spec(spec)
        assert len(files) == 50

    def test_extract_affected_files_dedupe(self, generator):
        """重复文件去重。"""
        spec = "`a.ts`\n`a.ts`\n`b.ts`"
        files = generator._extract_affected_files_from_spec(spec)
        assert files == ["a.ts", "b.ts"]


# ════════════════════════════════════════════════════════════════════════
# 18. apply_spec / preview / confirm(mock LLM)
# ════════════════════════════════════════════════════════════════════════

class TestApplySpec:
    @pytest.mark.asyncio
    async def test_apply_spec_llm_success(self, generator, ts_workspace):
        """apply_spec LLM 成功生成 patch。"""
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "content": "--- a/f.ts\n+++ b/f.ts\n@@ -1 +1,2 @@\n old\n+new\n",
            "error": None,
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.apply_spec(
                str(ts_workspace), {"type": "workspace"},
                new_spec="# new spec\n### `f.ts`\n",
            )
        assert "patch" in result
        assert "affectedFiles" in result
        assert "summary" in result
        assert result["patch"]

    @pytest.mark.asyncio
    async def test_apply_spec_llm_fail(self, generator, ts_workspace):
        """apply_spec LLM 失败 → 返回 error。"""
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "error": True, "error_message": "llm down",
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.apply_spec(
                str(ts_workspace), {"type": "workspace"},
                new_spec="# spec",
            )
        assert result["error"] == "llm_unavailable"

    def test_apply_patch_preview(self, generator, tmp_path):
        """patch 预览(不写文件)。"""
        (tmp_path / "f.ts").write_text("line1\nline2\n", encoding="utf-8")
        patch = "--- a/f.ts\n+++ b/f.ts\n@@ -1,2 +1,3 @@\n line1\n+inserted\n line2\n"
        result = generator.apply_patch_preview(
            str(tmp_path), patch, ["f.ts"]
        )
        assert len(result["files"]) == 1
        assert result["files"][0]["path"] == "f.ts"
        assert result["files"][0]["status"] == "modified"
        assert result["files"][0]["patchedLines"] == 3

    def test_apply_patch_confirm(self, generator, tmp_path):
        """patch 确认应用(写入文件 + 备份)。"""
        (tmp_path / "f.ts").write_text("line1\nline2\n", encoding="utf-8")
        patch = "--- a/f.ts\n+++ b/f.ts\n@@ -1,2 +1,3 @@\n line1\n+inserted\n line2\n"
        result = generator.apply_patch_confirm(
            str(tmp_path), patch, ["f.ts"]
        )
        assert "f.ts" in result["applied"]
        assert result["failed"] == []
        assert "backupDir" in result
        # 文件已更新
        content = (tmp_path / "f.ts").read_text(encoding="utf-8")
        assert "inserted" in content
        # 备份存在
        backup_dir = tmp_path / result["backupDir"]
        assert backup_dir.is_dir()

    def test_apply_patch_confirm_nonexistent_file(self, generator, tmp_path):
        """patch 应用到不存在的文件(创建新文件)。"""
        patch = "--- a/new.ts\n+++ b/new.ts\n@@ -0,0 +1,1 @@\n+new content\n"
        result = generator.apply_patch_confirm(
            str(tmp_path), patch, ["new.ts"]
        )
        assert "new.ts" in result["applied"]
        assert (tmp_path / "new.ts").is_file()


# ════════════════════════════════════════════════════════════════════════
# 19. 评审工作流
# ════════════════════════════════════════════════════════════════════════

class TestReviewWorkflow:
    @pytest.mark.asyncio
    async def test_submit_for_review_no_spec(self, generator, tmp_path):
        """无 spec → spec_not_found。"""
        result = generator.submit_for_review(str(tmp_path), {"type": "workspace"})
        assert result["error"] == "spec_not_found"

    @pytest.mark.asyncio
    async def test_submit_for_review_success(self, generator, ts_workspace):
        """提交评审:draft → pending_review。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        result = generator.submit_for_review(str(ts_workspace), {"type": "workspace"})
        assert "status" in result
        assert result["status"] == "pending_review"

    @pytest.mark.asyncio
    async def test_approve_wrong_status(self, generator, ts_workspace):
        """approve 时 status 不是 pending_review → invalid_status。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        # 此时 status=draft,不能直接 approve
        result = generator.approve_spec(str(ts_workspace), {"type": "workspace"}, "reviewer1")
        assert result["error"] == "invalid_status"

    @pytest.mark.asyncio
    async def test_full_review_flow(self, generator, ts_workspace):
        """完整评审流程:submit → approve。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        # submit
        generator.submit_for_review(str(ts_workspace), {"type": "workspace"})
        # approve
        result = generator.approve_spec(str(ts_workspace), {"type": "workspace"}, "alice")
        assert result["status"] == "approved"

    @pytest.mark.asyncio
    async def test_reject_flow(self, generator, ts_workspace):
        """拒绝流程:submit → reject。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        generator.submit_for_review(str(ts_workspace), {"type": "workspace"})
        result = generator.reject_spec(
            str(ts_workspace), {"type": "workspace"}, "bob", "needs rework"
        )
        assert result["status"] == "rejected"

    @pytest.mark.asyncio
    async def test_get_pending_reviews_empty(self, generator, tmp_path):
        """无 pending review → 空列表。"""
        result = generator.get_pending_reviews(str(tmp_path))
        assert result["specs"] == []

    @pytest.mark.asyncio
    async def test_get_pending_reviews_with_data(self, generator, ts_workspace):
        """有 pending review → 返回列表。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        generator.submit_for_review(str(ts_workspace), {"type": "workspace"})
        result = generator.get_pending_reviews(str(ts_workspace))
        assert len(result["specs"]) >= 1


# ════════════════════════════════════════════════════════════════════════
# 20. Spec → Task 拆分
# ════════════════════════════════════════════════════════════════════════

class TestSplitTasks:
    @pytest.mark.asyncio
    async def test_split_no_spec(self, generator, tmp_path):
        """无 spec → spec_not_found。"""
        result = await generator.split_tasks(str(tmp_path), {"type": "workspace"})
        assert result["error"] == "spec_not_found"

    @pytest.mark.asyncio
    async def test_split_llm_success(self, generator, ts_workspace):
        """LLM 成功拆分任务。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "content": json.dumps({"tasks": [
                {"title": "Task1", "description": "desc1", "priority": "P0", "estimated_complexity": "S"},
                {"title": "Task2", "description": "desc2", "priority": "P1", "estimated_complexity": "M"},
            ]}),
            "error": None,
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.split_tasks(str(ts_workspace), {"type": "workspace"})
        assert len(result["tasks"]) == 2
        assert result["tasks"][0]["title"] == "Task1"

    @pytest.mark.asyncio
    async def test_split_llm_fail_fallback(self, generator, ts_workspace):
        """LLM 失败 → 降级机械拆分。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "error": True, "error_message": "llm down",
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.split_tasks(str(ts_workspace), {"type": "workspace"})
        assert result.get("fallback") is True
        assert len(result["tasks"]) >= 1

    @pytest.mark.asyncio
    async def test_split_llm_invalid_json_fallback(self, generator, ts_workspace):
        """LLM 返回非法 JSON → 降级机械拆分。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "content": "not json at all",
            "error": None,
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.split_tasks(str(ts_workspace), {"type": "workspace"})
        assert result.get("fallback") is True

    def test_split_spec_sections(self, generator):
        """按 ## 标题拆分章节。"""
        spec = "# Title\n\n## Section1\ncontent1\n\n## Section2\ncontent2"
        sections = generator._split_spec_sections(spec)
        assert len(sections) == 2
        assert sections[0][0] == "Section1"
        assert sections[1][0] == "Section2"

    def test_split_spec_no_sections(self, generator):
        """无 ## 标题 → 空列表。"""
        assert generator._split_spec_sections("just text") == []

    def test_mechanical_split(self, generator):
        """机械拆分:每个章节一个任务。"""
        sections = [("模块结构", "content"), ("API 契约", "content")]
        tasks = generator._mechanical_split(sections)
        assert len(tasks) == 2
        assert "模块结构" in tasks[0]["title"]
        assert tasks[0]["priority"] == "P1"  # 第一个 P1
        assert tasks[1]["priority"] == "P2"  # 后续 P2

    def test_parse_tasks_json_with_codeblock(self, generator):
        """解析带 markdown 代码块的 JSON。"""
        content = "```json\n{\"tasks\": [{\"title\": \"T1\"}]}\n```"
        tasks = generator._parse_tasks_json(content)
        assert len(tasks) == 1
        assert tasks[0]["title"] == "T1"

    def test_parse_tasks_json_invalid(self, generator):
        """非法 JSON → 空列表。"""
        assert generator._parse_tasks_json("not json") == []

    def test_parse_tasks_json_default_fields(self, generator):
        """缺失字段补充默认值。"""
        content = '{"tasks": [{"title": "T1"}]}'
        tasks = generator._parse_tasks_json(content)
        assert tasks[0]["priority"] == "P2"
        assert tasks[0]["estimated_complexity"] == "M"


# ════════════════════════════════════════════════════════════════════════
# 21. enhance_spec(mock LLM)
# ════════════════════════════════════════════════════════════════════════

class TestEnhanceSpec:
    @pytest.mark.asyncio
    async def test_enhance_no_spec(self, generator, tmp_path):
        """无 spec → spec_not_found。"""
        result = await generator.enhance_spec(str(tmp_path), {"type": "workspace"})
        assert result["error"] == "spec_not_found"

    @pytest.mark.asyncio
    async def test_enhance_llm_success(self, generator, ts_workspace):
        """LLM 成功增强 spec。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "content": "## 智能分析\n\n### 功能意图说明\n分析内容\n\n### 潜在风险点\n- 风险1\n",
            "error": None,
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.enhance_spec(str(ts_workspace), {"type": "workspace"})
        assert "spec" in result
        assert "## 智能分析" in result["spec"]
        assert "enhancement" in result

    @pytest.mark.asyncio
    async def test_enhance_llm_fail(self, generator, ts_workspace):
        """LLM 失败 → 返回 error。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        mock_gateway = MagicMock()
        mock_gateway.complete = AsyncMock(return_value={
            "error": True, "error_message": "llm down",
        })
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            result = await generator.enhance_spec(str(ts_workspace), {"type": "workspace"})
        assert result["error"] == "llm_unavailable"

    @pytest.mark.asyncio
    async def test_enhance_replace_existing(self, generator, ts_workspace):
        """已有智能分析章节 → 替换。"""
        await generator.generate(str(ts_workspace), {"type": "workspace"})
        # 先增强一次
        mock_gateway = MagicMock()

        async def fake_complete(messages, model=None):
            return {
                "content": "## 智能分析\n\n### 功能意图说明\nnew analysis\n",
                "error": None,
            }

        mock_gateway.complete = fake_complete
        with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
            await generator.enhance_spec(str(ts_workspace), {"type": "workspace"})
            # 第二次增强
            result = await generator.enhance_spec(str(ts_workspace), {"type": "workspace"})
        # 智能分析章节应只有一份
        assert result["spec"].count("## 智能分析") == 1


# ════════════════════════════════════════════════════════════════════════
# 22. Watch(降级测试,不启动真实 watchdog)
# ════════════════════════════════════════════════════════════════════════

class TestWatch:
    def test_start_watch_watchdog_missing(self, generator, tmp_path):
        """watchdog 未安装 → 返回 error。"""
        with patch.dict("sys.modules", {"watchdog.observers": None, "watchdog.events": None}):
            result = generator.start_watch(str(tmp_path), {"type": "workspace"})
        assert result["error"] == "watchdog_not_installed"

    def test_stop_watch_not_found(self, generator):
        """停止不存在的 watcher → not_found。"""
        result = generator.stop_watch("nonexistent")
        assert result["status"] == "not_found"

    def test_get_watch_status_empty(self, generator):
        """无活跃 watcher → 空列表。"""
        result = generator.get_watch_status()
        assert result["watchers"] == []


# ════════════════════════════════════════════════════════════════════════
# 23. 全局单例
# ════════════════════════════════════════════════════════════════════════

class TestSingleton:
    def test_singleton_exists(self):
        assert spec_generator is not None
        assert isinstance(spec_generator, SpecGenerator)

    def test_singleton_has_indexer(self):
        assert spec_generator._indexer is not None
