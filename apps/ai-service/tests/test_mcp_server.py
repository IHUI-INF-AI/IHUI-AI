"""mcp_server.py 单元测试:11 个工具 + 3 个资源 + 3 个提示词 + MCPServer。

测试覆盖:
- 数据模型: MCPTool/MCPResource/MCPPrompt 字段
- 11 个工具实现(桩): 成功路径 + 边界 + 错误参数
- MCPServer: list_tools/call_tool(已知/未知/异常)/list_resources/read_resource(3 个已知 + 未知)/list_prompts/invoke_prompt
- _parse_ddg_lite_html: HTML 解析(含 uddg redirect/相对 URL/空结果)
- _render_prompt: 3 个提示词模板渲染
"""

from __future__ import annotations

import pytest

from app.services.mcp_server import (
    MCPTool,
    MCPResource,
    MCPPrompt,
    MCPServer,
    mcp_server,
    _TOOLS,
    _TOOL_HANDLERS,
    _RESOURCES,
    _PROMPTS,
    _parse_ddg_lite_html,
    _render_prompt,
    _tool_search_codebase,
    _tool_read_file,
    _tool_write_file,
    _tool_run_command,
    _tool_web_search,
    _tool_search_web,
    _tool_analyze_code,
    _tool_generate_test,
    _tool_file_search,
    _tool_git_operations,
    _tool_db_query,
)


# =============================================================================
# 数据模型
# =============================================================================

def test_mcp_tool_dataclass_fields():
    """MCPTool 数据类包含 name/description/input_schema 三个字段。"""
    t = MCPTool(name="x", description="d", input_schema={"type": "object"})
    assert t.name == "x"
    assert t.description == "d"
    assert t.input_schema == {"type": "object"}


def test_mcp_resource_dataclass_fields():
    """MCPResource 数据类字段 + 默认 mime_type。"""
    r = MCPResource(uri="u", name="n", description="d")
    assert r.uri == "u"
    assert r.name == "n"
    assert r.description == "d"
    assert r.mime_type == "application/json"  # 默认值


def test_mcp_prompt_dataclass_fields():
    """MCPPrompt 数据类字段。"""
    p = MCPPrompt(name="x", description="d", arguments=[])
    assert p.name == "x"
    assert p.description == "d"
    assert p.arguments == []


# =============================================================================
# 工具注册表
# =============================================================================

def test_tools_count_is_11():
    """预置 11 个工具。"""
    assert len(_TOOLS) == 11
    assert len(_TOOL_HANDLERS) == 11


@pytest.mark.parametrize(
    "name",
    ["search_codebase", "read_file", "write_file", "run_command", "web_search",
     "search_web", "analyze_code", "generate_test", "file_search",
     "git_operations", "db_query"],
)
def test_tool_registered(name):
    """每个工具在 _TOOLS 和 _TOOL_HANDLERS 中均存在。"""
    tool_names = {t.name for t in _TOOLS}
    assert name in tool_names
    assert name in _TOOL_HANDLERS


def test_tool_input_schema_has_type_object():
    """每个工具的 input_schema 含 type=object。"""
    for t in _TOOLS:
        assert t.input_schema.get("type") == "object", f"{t.name} schema 无 type=object"
        assert "properties" in t.input_schema, f"{t.name} schema 无 properties"


def test_tool_has_description():
    """每个工具有非空 description。"""
    for t in _TOOLS:
        assert t.description, f"{t.name} 无 description"


# =============================================================================
# 工具实现: search_codebase (真实文件系统代码符号搜索)
# =============================================================================

async def test_tool_search_codebase_empty_query():
    """空查询返回 ok=False。"""
    out = await _tool_search_codebase({"query": ""})
    assert out["tool"] == "search_codebase"
    assert out["ok"] is False
    assert "空" in out["message"]
    assert out["matches"] == []


async def test_tool_search_codebase_nonexistent_path():
    """路径不存在返回 ok=False。"""
    out = await _tool_search_codebase({"query": "foo", "path": "/nonexistent/xyz/abc"})
    assert out["ok"] is False
    assert "路径不存在" in out["message"]


async def test_tool_search_codebase_path_is_file(tmp_path):
    """路径是文件而非目录时返回 ok=False。"""
    f = tmp_path / "f.py"
    f.write_text("x = 1", encoding="utf-8")
    out = await _tool_search_codebase({"query": "foo", "path": str(f)})
    assert out["ok"] is False
    assert "路径不是目录" in out["message"]


async def test_tool_search_codebase_python_def(tmp_path):
    """搜索 Python def 定义。"""
    (tmp_path / "a.py").write_text(
        "def foo():\n    return 1\n\ndef bar():\n    return 2\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({"query": "foo", "path": str(tmp_path)})
    assert out["tool"] == "search_codebase"
    assert out["ok"] is True
    assert out["total"] >= 1
    # 应找到 def foo 的定义
    sym_matches = [m for m in out["matches"] if m["symbol_type"] == "def"]
    assert len(sym_matches) >= 1
    assert sym_matches[0]["file"] == "a.py"
    assert sym_matches[0]["line"] == 1
    assert "foo" in sym_matches[0]["code"]


async def test_tool_search_codebase_python_class(tmp_path):
    """搜索 Python class 定义。"""
    (tmp_path / "a.py").write_text(
        "class FooBar:\n    pass\n\nclass Baz:\n    pass\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({"query": "FooBar", "path": str(tmp_path)})
    assert out["ok"] is True
    class_matches = [m for m in out["matches"] if m["symbol_type"] == "class"]
    assert len(class_matches) >= 1
    assert "FooBar" in class_matches[0]["code"]


async def test_tool_search_codebase_symbol_type_filter(tmp_path):
    """symbol_type 过滤只返回指定类型。"""
    (tmp_path / "a.py").write_text(
        "def foo():\n    pass\n\nclass foo:\n    pass\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({
        "query": "foo", "path": str(tmp_path), "symbol_type": "def",
    })
    assert out["ok"] is True
    # 应只返回 def 类型
    sym_types = {m["symbol_type"] for m in out["matches"]}
    assert "def" in sym_types
    assert "class" not in sym_types


async def test_tool_search_codebase_reference_match(tmp_path):
    """搜索符号引用(非定义)。"""
    (tmp_path / "a.py").write_text(
        "def foo():\n    return 1\n\nresult = foo()\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({"query": "foo", "path": str(tmp_path)})
    assert out["ok"] is True
    # 应同时找到定义(line 1)和引用(line 4)
    lines = {m["line"] for m in out["matches"]}
    assert 1 in lines
    assert 4 in lines


async def test_tool_search_codebase_javascript_function(tmp_path):
    """搜索 JS function 定义。"""
    (tmp_path / "a.js").write_text(
        "function hello() {\n  return 1;\n}\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({"query": "hello", "path": str(tmp_path)})
    assert out["ok"] is True
    func_matches = [m for m in out["matches"] if m["symbol_type"] == "function"]
    assert len(func_matches) >= 1


async def test_tool_search_codebase_typescript_interface(tmp_path):
    """搜索 TS interface 定义。"""
    (tmp_path / "a.ts").write_text(
        "interface User {\n  name: string;\n}\n",
        encoding="utf-8",
    )
    out = await _tool_search_codebase({"query": "User", "path": str(tmp_path)})
    assert out["ok"] is True
    iface_matches = [m for m in out["matches"] if m["symbol_type"] == "interface"]
    assert len(iface_matches) >= 1


async def test_tool_search_codebase_ignores_dirs(tmp_path):
    """忽略 node_modules/.git 等目录。"""
    (tmp_path / "node_modules" / "pkg").mkdir(parents=True)
    (tmp_path / "node_modules" / "pkg" / "index.js").write_text(
        "function foo() { return 1; }\n", encoding="utf-8",
    )
    (tmp_path / "main.py").write_text("def foo():\n    pass\n", encoding="utf-8")
    out = await _tool_search_codebase({"query": "foo", "path": str(tmp_path)})
    # 只匹配 main.py,不匹配 node_modules
    paths = {m["path"] for m in out["matches"]}
    assert all("node_modules" not in p for p in paths)
    assert any("main.py" in p for p in paths)


async def test_tool_search_codebase_pattern_filter(tmp_path):
    """pattern 过滤只搜索指定文件。"""
    (tmp_path / "a.py").write_text("def foo():\n    pass\n", encoding="utf-8")
    (tmp_path / "b.js").write_text("function foo() { return 1; }\n", encoding="utf-8")
    out = await _tool_search_codebase({
        "query": "foo", "path": str(tmp_path), "pattern": "*.py",
    })
    assert out["ok"] is True
    files = {m["file"] for m in out["matches"]}
    assert "a.py" in files
    assert "b.js" not in files


async def test_tool_search_codebase_max_results(tmp_path):
    """max_results 限制返回数量。"""
    for i in range(20):
        (tmp_path / f"f{i}.py").write_text(
            f"def foo{i}():\n    pass\nfoo{i}()\n", encoding="utf-8",
        )
    out = await _tool_search_codebase({
        "query": "foo", "path": str(tmp_path), "max_results": 3,
    })
    assert out["ok"] is True
    assert out["total"] <= 3
    assert out["truncated"] is True


async def test_tool_search_codebase_no_match(tmp_path):
    """无匹配返回 0。"""
    (tmp_path / "a.py").write_text("def bar():\n    pass\n", encoding="utf-8")
    out = await _tool_search_codebase({"query": "nonexistent_xyz", "path": str(tmp_path)})
    assert out["ok"] is True
    assert out["total"] == 0
    assert out["matches"] == []


async def test_tool_search_codebase_match_contains_preview(tmp_path):
    """匹配项含 path/file/line/symbol_type/code/preview 字段。"""
    (tmp_path / "a.py").write_text("def foo():\n    return 1\n", encoding="utf-8")
    out = await _tool_search_codebase({"query": "foo", "path": str(tmp_path)})
    assert out["ok"] is True
    if out["matches"]:
        m = out["matches"][0]
        assert "path" in m
        assert "file" in m
        assert "line" in m
        assert "symbol_type" in m
        assert "code" in m
        assert "preview" in m


# =============================================================================
# 工具实现: read_file / write_file (真实 IO,用 tmp_path)
# =============================================================================

async def test_tool_read_file_success(tmp_path):
    f = tmp_path / "sample.txt"
    f.write_text("hello world", encoding="utf-8")
    out = await _tool_read_file({"path": str(f)})
    assert out["ok"] is True
    assert out["content"] == "hello world"
    assert out["path"] == str(f)


async def test_tool_read_file_not_found():
    out = await _tool_read_file({"path": "/nonexistent/path/xyz.txt"})
    assert out["ok"] is False
    assert "content" in out
    assert "error" in out


async def test_tool_write_file_success(tmp_path):
    f = tmp_path / "out.txt"
    out = await _tool_write_file({"path": str(f), "content": "data"})
    assert out["ok"] is True
    assert out["bytes_written"] == 4
    assert f.read_text(encoding="utf-8") == "data"


async def test_tool_write_file_failure():
    out = await _tool_write_file({"path": "/root/forbidden/xyz.txt", "content": "x"})
    assert out["ok"] is False
    assert "error" in out


# =============================================================================
# 工具实现: run_command (真实 subprocess,白名单 + 超时)
# =============================================================================

async def test_tool_run_command_empty_command():
    """空命令返回 ok=False。"""
    out = await _tool_run_command({"command": ""})
    assert out["tool"] == "run_command"
    assert out["ok"] is False
    assert "命令为空" in out["message"]


async def test_tool_run_command_disallowed_command():
    """不在白名单的命令返回 ok=False。"""
    out = await _tool_run_command({"command": "rm -rf /"})
    assert out["ok"] is False
    # rm 既匹配危险模式又在白名单外,任一拦截即可
    assert "禁止" in out["message"] or "白名单" in out["message"]


async def test_tool_run_command_dangerous_rm():
    """rm 命令被危险模式拦截。"""
    out = await _tool_run_command({"command": "rm file.txt"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_dangerous_redirect():
    """输出重定向被拦截。"""
    out = await _tool_run_command({"command": "ls > file.txt"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_dangerous_pipe():
    """管道被拦截。"""
    out = await _tool_run_command({"command": "ls | grep foo"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_dangerous_chain():
    """命令链(;)被拦截。"""
    out = await _tool_run_command({"command": "ls; rm file"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_dangerous_curl():
    """curl 被拦截。"""
    out = await _tool_run_command({"command": "curl http://example.com"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_dangerous_command_substitution():
    """命令替换 $(...) 被拦截。"""
    out = await _tool_run_command({"command": "echo $(whoami)"})
    assert out["ok"] is False
    assert "禁止" in out["message"]


async def test_tool_run_command_echo():
    """echo 命令(白名单内)真实执行成功。"""
    out = await _tool_run_command({"command": "echo hello"})
    assert out["tool"] == "run_command"
    assert out["ok"] is True
    assert out["exit_code"] == 0
    assert "hello" in out["stdout"]


async def test_tool_run_command_python_version(tmp_path):
    """python --version 真实执行(白名单内)。"""
    out = await _tool_run_command({"command": "python --version"})
    assert out["tool"] == "run_command"
    # python 命令在白名单内,执行成功或失败取决于环境
    assert "exit_code" in out
    # stdout 或 stderr 应包含 Python 版本信息
    combined = (out.get("stdout", "") + out.get("stderr", "")).lower()
    assert "python" in combined or out["exit_code"] != 0


async def test_tool_run_command_echo_with_cwd(tmp_path):
    """cwd 参数指定工作目录。"""
    out = await _tool_run_command({
        "command": "echo test",
        "cwd": str(tmp_path),
    })
    assert out["ok"] is True
    assert "test" in out["stdout"]


async def test_tool_run_command_git_status_on_real_repo():
    """在 IHUI-AI 仓库执行 git status(白名单内真实命令)。"""
    out = await _tool_run_command({
        "command": "git status",
        "cwd": "g:/IHUI-AI",
    })
    assert out["tool"] == "run_command"
    assert out["ok"] is True
    assert out["exit_code"] == 0
    # git status 输出应包含 branch 信息或文件状态
    assert len(out["stdout"]) > 0


async def test_tool_run_command_nonexistent_command():
    """白名单内但不存在的命令返回 ok=False。"""
    # pytest 在 ai-service 环境应存在,但用一个绝对不存在的路径测试
    out = await _tool_run_command({"command": "ls /nonexistent/path/xyz/abc"})
    # ls 命令存在,但路径不存在,退出码非 0
    assert out["tool"] == "run_command"
    assert out["exit_code"] != 0 or out["ok"] is False


# =============================================================================
# 工具实现: web_search (复用 search_web 的 DuckDuckGo 逻辑)
# =============================================================================

async def test_tool_web_search_empty_query():
    """空查询返回 ok + 空结果。"""
    out = await _tool_web_search({"query": ""})
    assert out["tool"] == "web_search"
    assert out["query"] == ""
    assert out["results"] == []
    assert "空" in out["message"]


async def test_tool_web_search_default_max_results():
    """默认 max_results=5。"""
    out = await _tool_web_search({"query": "test"})
    assert out["tool"] == "web_search"
    assert out["max_results"] == 5
    # 应透传 search_web 的结果(可能成功也可能因无网络失败,但字段齐全)
    assert "results" in out
    assert "total" in out
    assert "message" in out


async def test_tool_web_search_custom_max_results():
    """自定义 max_results。"""
    out = await _tool_web_search({"query": "test", "max_results": 3})
    assert out["max_results"] == 3


async def test_tool_web_search_returns_list_results():
    """results 字段为 list 类型。"""
    out = await _tool_web_search({"query": "python"})
    assert isinstance(out["results"], list)


# =============================================================================
# 工具实现: search_web (真实 HTTP,测试边界 + 空查询,不发网络)
# =============================================================================

async def test_tool_search_web_empty_query():
    out = await _tool_search_web({"query": ""})
    assert out["tool"] == "search_web"
    assert out["results"] == []
    assert "空" in out["message"]


async def test_tool_search_web_default_max_results():
    """未传 max_results 时默认 5。"""
    # 不实际发请求,仅验证默认值透传(会尝试网络调用,可能失败但字段齐全)
    out = await _tool_search_web({"query": "test"})
    assert out["tool"] == "search_web"
    assert out["max_results"] == 5


# =============================================================================
# 工具实现: analyze_code
# =============================================================================

async def test_tool_analyze_code_basic():
    code = "print('hello')\n# comment\n\nx = 1"
    out = await _tool_analyze_code({"code": code, "language": "python"})
    assert out["tool"] == "analyze_code"
    assert out["language"] == "python"
    assert out["metrics"]["lines"] == 4
    assert out["metrics"]["chars"] == len(code)
    assert out["metrics"]["blank_lines"] == 1
    assert out["metrics"]["comment_lines"] == 1


async def test_tool_analyze_code_default_language():
    out = await _tool_analyze_code({"code": "x"})
    assert out["language"] == "text"


async def test_tool_analyze_code_empty():
    out = await _tool_analyze_code({"code": ""})
    assert out["metrics"]["lines"] == 0
    assert out["metrics"]["chars"] == 0


async def test_tool_analyze_code_comment_styles():
    """多种注释风格: # // -- /* *"""
    code = "# hash\n// slash\n-- sql\n/* block start\n* continuation\n"
    out = await _tool_analyze_code({"code": code, "language": "mixed"})
    assert out["metrics"]["comment_lines"] == 5


# =============================================================================
# 工具实现: generate_test
# =============================================================================

async def test_tool_generate_test_template():
    out = await _tool_generate_test({"code": "def f():\n    return 1", "language": "python"})
    assert out["tool"] == "generate_test"
    assert out["language"] == "python"
    assert out["framework"] == "pytest"
    assert "def test_placeholder" in out["test_code"]
    assert "def f()" in out["test_code"]


async def test_tool_generate_test_custom_framework():
    out = await _tool_generate_test({"code": "x", "framework": "unittest"})
    assert out["framework"] == "unittest"
    assert "unittest" in out["test_code"]


# =============================================================================
# 工具实现: file_search (真实文件系统搜索)
# =============================================================================

async def test_tool_file_search_filename_only(tmp_path):
    """无 query 时按文件名 pattern 匹配,返回文件信息。"""
    (tmp_path / "a.py").write_text("x = 1", encoding="utf-8")
    (tmp_path / "b.txt").write_text("hello", encoding="utf-8")
    (tmp_path / "c.py").write_text("y = 2", encoding="utf-8")
    out = await _tool_file_search({"path": str(tmp_path), "pattern": "*.py"})
    assert out["tool"] == "file_search"
    assert out["ok"] is True
    assert out["total"] == 2
    files = {m["file"] for m in out["matches"]}
    assert files == {"a.py", "c.py"}
    # 每个 match 含 path/file/size
    assert all("path" in m and "file" in m and "size" in m for m in out["matches"])


async def test_tool_file_search_with_content_query(tmp_path):
    """有 query 时按文件内容匹配,返回行号 + 预览。"""
    (tmp_path / "a.py").write_text("def foo():\n    return 1\n# foo here", encoding="utf-8")
    (tmp_path / "b.py").write_text("def bar():\n    return 2", encoding="utf-8")
    out = await _tool_file_search({"query": "foo", "path": str(tmp_path), "pattern": "*.py"})
    assert out["ok"] is True
    assert out["total"] == 1
    m = out["matches"][0]
    assert m["file"] == "a.py"
    assert 1 in m["line_numbers"]
    assert 3 in m["line_numbers"]
    assert "foo" in m["preview"]


async def test_tool_file_search_nonexistent_path():
    """路径不存在时返回 ok=False。"""
    out = await _tool_file_search({"path": "/nonexistent/xyz/abc"})
    assert out["ok"] is False
    assert "路径不存在" in out["message"]


async def test_tool_file_search_path_is_file(tmp_path):
    """路径是文件而非目录时返回 ok=False。"""
    f = tmp_path / "file.txt"
    f.write_text("x", encoding="utf-8")
    out = await _tool_file_search({"path": str(f)})
    assert out["ok"] is False
    assert "不是目录" in out["message"]


async def test_tool_file_search_max_results(tmp_path):
    """max_results 限制返回数量。"""
    for i in range(10):
        (tmp_path / f"f{i}.txt").write_text("x", encoding="utf-8")
    out = await _tool_file_search({"path": str(tmp_path), "pattern": "*.txt", "max_results": 3})
    assert out["ok"] is True
    assert out["total"] == 3
    assert out["truncated"] is True


async def test_tool_file_search_ignores_binary_files(tmp_path):
    """忽略二进制文件扩展名。"""
    (tmp_path / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (tmp_path / "b.txt").write_text("hello", encoding="utf-8")
    out = await _tool_file_search({"path": str(tmp_path)})
    files = {m["file"] for m in out["matches"]}
    assert "b.txt" in files
    assert "a.png" not in files


async def test_tool_file_search_ignores_dirs(tmp_path):
    """忽略 node_modules/.git 等目录。"""
    (tmp_path / "node_modules" / "pkg").mkdir(parents=True)
    (tmp_path / "node_modules" / "pkg" / "index.js").write_text("x", encoding="utf-8")
    (tmp_path / "main.py").write_text("y = 1", encoding="utf-8")
    out = await _tool_file_search({"path": str(tmp_path), "pattern": "*.py"})
    files = {m["file"] for m in out["matches"]}
    assert "main.py" in files
    # node_modules 下的文件不应出现
    assert all("node_modules" not in m["path"] for m in out["matches"])


async def test_tool_file_search_empty_dir(tmp_path):
    """空目录返回 0 匹配。"""
    out = await _tool_file_search({"path": str(tmp_path)})
    assert out["ok"] is True
    assert out["total"] == 0
    assert out["matches"] == []


async def test_tool_file_search_no_pattern_match(tmp_path):
    """pattern 不匹配任何文件时返回 0。"""
    (tmp_path / "a.txt").write_text("x", encoding="utf-8")
    out = await _tool_file_search({"path": str(tmp_path), "pattern": "*.nonexistent"})
    assert out["ok"] is True
    assert out["total"] == 0


# =============================================================================
# 工具实现: git_operations (真实 git 命令)
# =============================================================================

async def test_tool_git_operations_status_on_real_repo():
    """在 IHUI-AI 仓库执行 git status(真实 git 命令)。"""
    out = await _tool_git_operations({"action": "status", "repo": "g:/IHUI-AI"})
    assert out["tool"] == "git_operations"
    assert out["action"] == "status"
    assert out["repo"] == "g:/IHUI-AI"
    # git 命令应成功(IHUI-AI 是 git 仓库)
    assert out["ok"] is True
    assert out["exit_code"] == 0
    assert isinstance(out["output"], str)


async def test_tool_git_operations_log_on_real_repo():
    """在 IHUI-AI 仓库执行 git log。"""
    out = await _tool_git_operations({"action": "log", "repo": "g:/IHUI-AI"})
    assert out["ok"] is True
    # log 输出应包含 commit 信息
    assert len(out["output"]) > 0


async def test_tool_git_operations_branch_on_real_repo():
    """在 IHUI-AI 仓库执行 git branch。"""
    out = await _tool_git_operations({"action": "branch", "repo": "g:/IHUI-AI"})
    assert out["ok"] is True


async def test_tool_git_operations_disallowed_action():
    """不允许的 action(push/reset 等)返回 ok=False。"""
    out = await _tool_git_operations({"action": "push", "repo": "g:/IHUI-AI"})
    assert out["ok"] is False
    assert "不允许" in out["message"]
    assert "status" in out["message"]  # 列出允许的操作


async def test_tool_git_operations_nonexistent_repo():
    """仓库路径不存在时返回 ok=False。"""
    out = await _tool_git_operations({"action": "status", "repo": "/nonexistent/repo/xyz"})
    assert out["ok"] is False
    assert "不存在" in out["message"]


async def test_tool_git_operations_default_action():
    """不传 action 时默认 status。"""
    out = await _tool_git_operations({"repo": "g:/IHUI-AI"})
    assert out["action"] == "status"
    assert out["ok"] is True


async def test_tool_git_operations_show_with_ref():
    """show 操作使用 ref 参数。"""
    out = await _tool_git_operations({"action": "show", "repo": "g:/IHUI-AI", "ref": "HEAD"})
    assert out["action"] == "show"
    # show HEAD 应成功
    assert out["ok"] is True


# =============================================================================
# 工具实现: db_query (真实 postgres,安全加固测试)
# =============================================================================

async def test_tool_db_query_no_database_url(monkeypatch):
    """DATABASE_URL 未配置时返回 ok=False。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "")
    out = await _tool_db_query({"sql": "SELECT 1"})
    assert out["tool"] == "db_query"
    assert out["ok"] is False
    assert "DATABASE_URL 未配置" in out["message"]
    assert out["rows"] == []


async def test_tool_db_query_select_allowed(monkeypatch):
    """SELECT 查询通过安全校验(但无数据库连接会失败)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    out = await _tool_db_query({"sql": "SELECT 1"})
    # 通过安全校验,但连接失败
    assert out["ok"] is False
    assert "查询失败" in out["message"]
    # 不应返回"仅允许 SELECT"错误
    assert "仅允许" not in out["message"]


async def test_tool_db_query_with_allowed(monkeypatch):
    """WITH (CTE) 查询通过安全校验。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    out = await _tool_db_query({"sql": "WITH t AS (SELECT 1) SELECT * FROM t"})
    assert out["ok"] is False
    assert "仅允许" not in out["message"]


async def test_tool_db_query_insert_blocked():
    """INSERT 被阻止。"""
    out = await _tool_db_query({"sql": "INSERT INTO users VALUES (1)"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_update_blocked():
    """UPDATE 被阻止(非 SELECT 开头或含禁止关键词)。"""
    out = await _tool_db_query({"sql": "UPDATE users SET name='x'"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_delete_blocked():
    """DELETE 被阻止。"""
    out = await _tool_db_query({"sql": "DELETE FROM users"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_drop_blocked():
    """DROP 被阻止。"""
    out = await _tool_db_query({"sql": "DROP TABLE users"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_alter_blocked():
    """ALTER 被阻止。"""
    out = await _tool_db_query({"sql": "ALTER TABLE users ADD COLUMN x int"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_create_blocked():
    """CREATE 被阻止。"""
    out = await _tool_db_query({"sql": "CREATE TABLE hack (id int)"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_truncate_blocked():
    """TRUNCATE 被阻止。"""
    out = await _tool_db_query({"sql": "TRUNCATE TABLE users"})
    assert out["ok"] is False
    assert "仅允许" in out["message"] or "禁止关键词" in out["message"]


async def test_tool_db_query_select_with_leading_comment(monkeypatch):
    """带前导注释的 SELECT 通过安全校验。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    out = await _tool_db_query({"sql": "-- comment\nSELECT 1"})
    assert "仅允许" not in out["message"]


async def test_tool_db_query_select_with_block_comment(monkeypatch):
    """带块注释的 SELECT 通过安全校验。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    out = await _tool_db_query({"sql": "/* block */ SELECT 1"})
    assert "仅允许" not in out["message"]


async def test_tool_db_query_select_with_semicolon(monkeypatch):
    """SELECT 带分号结尾通过安全校验。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    out = await _tool_db_query({"sql": "SELECT 1;"})
    assert "仅允许" not in out["message"]


async def test_tool_db_query_empty_sql():
    """空 SQL 被阻止。"""
    out = await _tool_db_query({"sql": ""})
    assert out["ok"] is False
    assert "仅允许" in out["message"]


async def test_tool_db_query_default_max_rows(monkeypatch):
    """默认 max_rows=100,上限 1000。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "database_url", "postgres://nonexistent:5432/db")
    # max_rows=5000 会被截断为 1000
    out = await _tool_db_query({"sql": "SELECT 1", "max_rows": 5000})
    # 连接失败,但安全校验通过
    assert out["ok"] is False
    assert "仅允许" not in out["message"]


async def test_tool_db_query_dangerous_keyword_in_subquery():
    """SELECT 子查询含 UPDATE 关键词被阻止。"""
    out = await _tool_db_query({"sql": "SELECT * FROM (UPDATE users SET x=1) t"})
    assert out["ok"] is False
    assert "禁止关键词" in out["message"]


# =============================================================================
# _parse_ddg_lite_html (纯函数,无网络)
# =============================================================================

def test_parse_ddg_empty_html():
    assert _parse_ddg_lite_html("", 5) == []


def test_parse_ddg_no_results():
    html = "<html><body>no results</body></html>"
    assert _parse_ddg_lite_html(html, 5) == []


def test_parse_ddg_basic_result():
    html = """
    <a class="result-link" href="https://example.com/page">Example Title</a>
    <td class="result-snippet">This is a snippet</td>
    """
    results = _parse_ddg_lite_html(html, 5)
    assert len(results) == 1
    assert results[0]["title"] == "Example Title"
    assert results[0]["url"] == "https://example.com/page"
    assert results[0]["snippet"] == "This is a snippet"


def test_parse_ddg_uddg_redirect():
    """DuckDuckGo redirect URL 提取真实 URL。"""
    html = """
    <a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freal.com%2Fpath&rut=abc">Real</a>
    <td class="result-snippet">snip</td>
    """
    results = _parse_ddg_lite_html(html, 5)
    assert len(results) == 1
    assert results[0]["url"] == "https://real.com/path"


def test_parse_ddg_relative_protocol_url():
    """// 开头的相对 URL 补 https:。"""
    html = '<a class="result-link" href="//example.com/x">T</a><td class="result-snippet">s</td>'
    results = _parse_ddg_lite_html(html, 5)
    assert results[0]["url"] == "https://example.com/x"


def test_parse_ddg_max_results_limit():
    html = ""
    for i in range(10):
        html += f'<a class="result-link" href="https://x.com/{i}">T{i}</a><td class="result-snippet">s{i}</td>'
    results = _parse_ddg_lite_html(html, 3)
    assert len(results) == 3
    assert results[0]["title"] == "T0"
    assert results[2]["title"] == "T2"


def test_parse_ddg_snippet_truncated_to_300():
    long_snippet = "x" * 500
    html = f'<a class="result-link" href="https://x.com">T</a><td class="result-snippet">{long_snippet}</td>'
    results = _parse_ddg_lite_html(html, 5)
    assert len(results[0]["snippet"]) == 300


def test_parse_ddg_html_tags_stripped_from_title():
    html = '<a class="result-link" href="https://x.com"><b>Bold</b> Title</a><td class="result-snippet">s</td>'
    results = _parse_ddg_lite_html(html, 5)
    assert results[0]["title"] == "Bold Title"


# =============================================================================
# _render_prompt (纯函数)
# =============================================================================

def test_render_prompt_code_review():
    out = _render_prompt("code_review", {"code": "print(1)", "language": "python"})
    assert "审查" in out
    assert "python" in out
    assert "print(1)" in out


def test_render_prompt_bug_fix():
    out = _render_prompt("bug_fix", {"error": "NameError", "code": "x", "language": "py"})
    assert "修复" in out
    assert "NameError" in out
    assert "根因" in out


def test_render_prompt_feature_plan():
    out = _render_prompt("feature_plan", {"feature": "登录", "requirements": "手机号"})
    assert "规划" in out
    assert "登录" in out
    assert "手机号" in out


def test_render_prompt_unknown():
    out = _render_prompt("nonexistent", {})
    assert "未知提示词" in out


def test_render_prompt_default_language():
    out = _render_prompt("code_review", {"code": "x"})
    assert "未指定" in out


# =============================================================================
# 资源注册表
# =============================================================================

def test_resources_count_is_3():
    assert len(_RESOURCES) == 3


@pytest.mark.parametrize("uri", ["memory://current", "skills://available", "config://agent"])
def test_resource_present(uri):
    assert any(r.uri == uri for r in _RESOURCES)


# =============================================================================
# 提示词注册表
# =============================================================================

def test_prompts_count_is_3():
    assert len(_PROMPTS) == 3


@pytest.mark.parametrize("name", ["code_review", "bug_fix", "feature_plan"])
def test_prompt_present(name):
    assert any(p.name == name for p in _PROMPTS)


# =============================================================================
# MCPServer: list_tools / call_tool
# =============================================================================

def test_server_list_tools_returns_11():
    tools = mcp_server.list_tools()
    assert len(tools) == 11
    assert all(isinstance(t, MCPTool) for t in tools)


def test_server_list_tools_returns_copy():
    lst = mcp_server.list_tools()
    lst.clear()
    assert len(mcp_server.list_tools()) == 11


async def test_server_call_tool_known():
    out = await mcp_server.call_tool("analyze_code", {"code": "x"})
    assert out["tool"] == "analyze_code"
    assert out["metrics"]["lines"] == 1


async def test_server_call_tool_unknown():
    out = await mcp_server.call_tool("nonexistent", {})
    assert out["ok"] is False
    assert "未知工具" in out["error"]
    assert "analyze_code" in out["error"]  # 列出可用工具


async def test_server_call_tool_none_arguments():
    """call_tool 传 None 参数时用空 dict。"""
    out = await mcp_server.call_tool("web_search", None)
    assert out["tool"] == "web_search"
    assert out["query"] == ""


async def test_server_call_tool_handler_exception_caught():
    """工具 handler 抛异常时被 call_tool 捕获,返回 ok=False。"""
    # 用 monkeypatch 替换 handler 为抛异常的函数
    original = _TOOL_HANDLERS["web_search"]

    async def boom(args):
        raise RuntimeError("boom")

    _TOOL_HANDLERS["web_search"] = boom
    try:
        out = await mcp_server.call_tool("web_search", {"query": "x"})
        assert out["ok"] is False
        assert "boom" in out["error"]
    finally:
        _TOOL_HANDLERS["web_search"] = original


# =============================================================================
# MCPServer: list_resources / read_resource
# =============================================================================

def test_server_list_resources_returns_3():
    res = mcp_server.list_resources()
    assert len(res) == 3
    assert all(isinstance(r, MCPResource) for r in res)


async def test_server_read_resource_memory():
    out = await mcp_server.read_resource("memory://current")
    assert out["ok"] is True
    assert out["uri"] == "memory://current"
    assert "sessions" in out["content"]


async def test_server_read_resource_skills():
    out = await mcp_server.read_resource("skills://available")
    assert out["ok"] is True
    assert isinstance(out["content"], list)
    assert len(out["content"]) == 6  # 6 个预置 skill
    assert all("name" in s and "description" in s for s in out["content"])


async def test_server_read_resource_config():
    out = await mcp_server.read_resource("config://agent")
    assert out["ok"] is True
    cfg = out["content"]
    assert "app_name" in cfg
    assert "litellm_model" in cfg
    assert "max_agent_iterations" in cfg
    assert "debug" in cfg


async def test_server_read_resource_unknown():
    out = await mcp_server.read_resource("unknown://x")
    assert out["ok"] is False
    assert "未知资源" in out["error"]


# =============================================================================
# MCPServer: list_prompts / invoke_prompt
# =============================================================================

def test_server_list_prompts_returns_3():
    prompts = mcp_server.list_prompts()
    assert len(prompts) == 3
    assert all(isinstance(p, MCPPrompt) for p in prompts)


def test_server_invoke_prompt_known():
    out = mcp_server.invoke_prompt("code_review", {"code": "x", "language": "py"})
    assert out["ok"] is True
    assert out["name"] == "code_review"
    assert "审查" in out["prompt"]


def test_server_invoke_prompt_unknown():
    out = mcp_server.invoke_prompt("nonexistent", {})
    assert out["ok"] is False
    assert "未知提示词" in out["error"]


def test_server_invoke_prompt_none_arguments():
    out = mcp_server.invoke_prompt("code_review", None)
    assert out["ok"] is True
    assert "未指定" in out["prompt"]  # 默认 language


# =============================================================================
# MCPServer 独立实例
# =============================================================================

def test_server_independent_instance():
    s = MCPServer()
    assert len(s.list_tools()) == 11
    assert len(s.list_resources()) == 3
    assert len(s.list_prompts()) == 3
