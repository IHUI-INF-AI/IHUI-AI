# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-17(2026-11-28):运营内容工具(公告/轮播)注册面与审批面钉住测试。

钉四件事(改任何一处都必须有意识地过这四条):
1. 六枚工具经 setup_ops_content_tools 注册进 mcp_server(幂等:二次 setup 返回 0);
2. 每枚工具 schema 都是 type=object + properties(test_mcp_server 的全量断言同样覆盖);
3. 写类 4 枚在 llm.py::_TOOL_DANGER_LEVELS 判 high(审批卡的前置),只读 2 枚不在表内;
4. llm.py::_ADMIN_DELEGATE_TOOLS 与本模块 OPS_CONTENT_TOOLS 逐字一致,且六枚都在
   mcp_server::_ADMIN_ONLY_TOOLS —— 委托集与角色矩阵任何一个漂了,纯聊天发公告要么
   走到本地兜底报错、要么被非 admin 调到,都是静默失效。
"""

import ast
import asyncio
import importlib
from pathlib import Path

import pytest

from app.services import mcp_server
from app.services.mcp_server import mcp_server as _registry
from app.services.ops_content_tools import (
    OPS_CONTENT_TOOLS,
    OPS_CONTENT_WRITE_TOOLS,
    setup_ops_content_tools,
)

_LLM_PATH = Path(__file__).resolve().parent.parent / "app" / "routers" / "llm.py"
_MCP_PATH = Path(__file__).resolve().parent.parent / "app" / "services" / "mcp_server.py"


def _load_module_set(source: str, var_name: str) -> set[str]:
    """从源码 ast 抽出模块级 set 字面量(与守门取材口径一致,不裸 grep)。"""
    tree = ast.parse(source)
    for node in tree.body:
        targets = []
        if isinstance(node, ast.Assign):
            targets = [t for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            targets = [node.target]
        for t in targets:
            if t.id == var_name and isinstance(node.value, (ast.Set, ast.List, ast.Tuple)):
                return {ast.literal_eval(el) for el in node.value.elts}
    pytest.fail(f"未在源码中找到 {var_name}(可能被重命名,需同步本测试)")


def _load_llm_dict_keys(var_name: str) -> dict[str, str]:
    tree = ast.parse(_LLM_PATH.read_text(encoding="utf-8"))
    for node in tree.body:
        targets = []
        if isinstance(node, ast.Assign):
            targets = [t for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            targets = [node.target]
        for t in targets:
            if t.id == var_name and isinstance(node.value, ast.Dict):
                return {
                    ast.literal_eval(k): ast.literal_eval(v)
                    for k, v in zip(node.value.keys, node.value.values)
                }
    pytest.fail(f"未在 llm.py 中找到 {var_name}")


@pytest.fixture(scope="module", autouse=True)
def _register_tools():
    """模块级装载一次;注册幂等失败(0/6)时显式失败,不留静默降级。"""
    count = setup_ops_content_tools()
    assert count == len(OPS_CONTENT_TOOLS), f"首次注册应 6/6,实得 {count}"


def test_all_six_tools_registered():
    names = {t.name for t in _registry.list_tools()}
    assert set(OPS_CONTENT_TOOLS) <= names


def test_second_setup_is_idempotent():
    assert setup_ops_content_tools() == 0


@pytest.mark.parametrize("name", list(OPS_CONTENT_TOOLS))
def test_tool_schema_shape(name):
    tool = next(t for t in _registry.list_tools() if t.name == name)
    assert tool.input_schema.get("type") == "object"
    assert isinstance(tool.input_schema.get("properties"), dict)
    assert tool.description


def test_write_tools_require_approval_high():
    danger = _load_llm_dict_keys("_TOOL_DANGER_LEVELS")
    for name in OPS_CONTENT_WRITE_TOOLS:
        assert danger.get(name) == "high", f"{name} 必须判 high(执行前弹审批卡)"


def test_read_tools_not_in_danger_table():
    danger = _load_llm_dict_keys("_TOOL_DANGER_LEVELS")
    reads = set(OPS_CONTENT_TOOLS) - set(OPS_CONTENT_WRITE_TOOLS)
    for name in reads:
        assert name not in danger, f"{name} 是只读工具,不应进审批表(角色闸在 api 侧)"


def test_admin_delegate_set_matches_module():
    llm_ns = {}
    tree = ast.parse(_LLM_PATH.read_text(encoding="utf-8"))
    for node in tree.body:
        targets = []
        if isinstance(node, ast.Assign):
            targets = [t for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            targets = [node.target]
        for t in targets:
            if t.id == "_ADMIN_DELEGATE_TOOLS":
                exec(compile(ast.Module(body=[node], type_ignores=[]), "<llm>", "exec"), llm_ns)
    assert llm_ns["_ADMIN_DELEGATE_TOOLS"] == set(OPS_CONTENT_TOOLS)


def test_admin_only_matrix_covers_all_six():
    matrix = _load_module_set(_MCP_PATH.read_text(encoding="utf-8"), "_ADMIN_ONLY_TOOLS")
    missing = set(OPS_CONTENT_TOOLS) - matrix
    assert not missing, f"角色矩阵缺运营内容工具: {sorted(missing)}"


def test_local_handler_fails_closed_with_delegate_required():
    """本地兜底 handler 必须拒绝执行(agent 引擎直调路径),给出可判定错误码。"""
    from app.services.ops_content_tools import ANNOUNCE_CREATE_TOOL

    tool = next(t for t in _registry.list_tools() if t.name == ANNOUNCE_CREATE_TOOL)
    handler = mcp_server._TOOL_HANDLERS[ANNOUNCE_CREATE_TOOL]
    result = asyncio.run(handler({"title": "x", "content": "y"}))
    assert result["ok"] is False
    assert result["errorCode"] == "DELEGATE_REQUIRED"
    assert tool.input_schema["required"] == ["title", "content"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
