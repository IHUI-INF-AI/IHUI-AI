# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #58(2026-09-26 立):主对话流工具审批门 —— 判定函数单元测试。

只测 llm.py 中的纯函数判定层(_normalize_permission_mode / _resolve_tool_approval),
不拉起 FastAPI 应用(导入 llm.py 全模块会连带 llm_gateway 等重依赖,
纯函数经 importlib 直接加载源码片段,零外部依赖)。
"""

import importlib.util
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 轻量加载:llm.py 是重依赖路由模块(链路 llm_gateway/mcp 等),直接 import 会
# 拖起整棵依赖树。此处按 ast 抽出模块头的审批判定区(常量 + 两个纯函数)单独 exec,
# 与被测代码同源,不存在复制漂移。
# ---------------------------------------------------------------------------
import ast

_LLM_PATH = Path(__file__).resolve().parent.parent / "app" / "routers" / "llm.py"
_TARGET_NAMES = {
    "_TOOL_DANGER_LEVELS",
    "_normalize_permission_mode",
    "_resolve_tool_approval",
}


def _load_approval_funcs():
    """从 llm.py 源码抽取审批判定区并执行,返回命名空间。"""
    tree = ast.parse(_LLM_PATH.read_text(encoding="utf-8"))
    picked = []
    for node in tree.body:
        names: set[str] = set()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names = {node.name}
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    names.add(t.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            # 带类型注解的模块级赋值(如 _TOOL_DANGER_LEVELS: dict[str, str] = {...})
            names.add(node.target.id)
        if names & _TARGET_NAMES:
            picked.append(node)
    assert picked, "未在 llm.py 中找到审批判定区(常量/函数名可能被重命名,需同步本测试)"
    ns: dict = {"__builtins__": __builtins__}
    exec(compile(ast.Module(body=picked, type_ignores=[]), str(_LLM_PATH), "exec"), ns)
    return ns


_ns = _load_approval_funcs()
_normalize_permission_mode = _ns["_normalize_permission_mode"]
_resolve_tool_approval = _ns["_resolve_tool_approval"]


# ---------------------------------------------------------------------------
# _normalize_permission_mode:档位归一
# ---------------------------------------------------------------------------
def test_normalize_none_and_unknown_default():
    """None/未知值一律归 default(保守:高危工具需审批)。"""
    assert _normalize_permission_mode(None) == "default"
    assert _normalize_permission_mode("") == "default"
    assert _normalize_permission_mode("  ") == "default"
    assert _normalize_permission_mode("weird-mode") == "default"


def test_normalize_bypass_aliases():
    """bypass 双写法(camel/kebab)都收 —— 前端 kebab,agent 侧 camel。"""
    assert _normalize_permission_mode("bypassPermissions") == "bypass-permissions"
    assert _normalize_permission_mode("bypass-permissions") == "bypass-permissions"
    assert _normalize_permission_mode(" bypass-permissions ") == "bypass-permissions"


def test_normalize_accept_edits_aliases():
    assert _normalize_permission_mode("acceptEdits") == "accept-edits"
    assert _normalize_permission_mode("accept-edits") == "accept-edits"


def test_normalize_plan_passthrough():
    assert _normalize_permission_mode("plan") == "plan"


# ---------------------------------------------------------------------------
# _resolve_tool_approval:模式 × 危险级 判定
# ---------------------------------------------------------------------------
def test_unknown_tool_never_blocks():
    """未收录工具不拦截 —— 主聊天工具面大,默认全拦会打断日常使用。"""
    need, danger = _resolve_tool_approval("default", "read_file")
    assert need is False
    assert danger == ""


def test_bypass_never_blocks():
    """bypass-permissions 档不拦截(既有档位语义,用户已显式选完全访问)。"""
    for tool in ("run_command", "delete_file", "write_file"):
        need, danger = _resolve_tool_approval("bypass-permissions", tool)
        assert need is False
        assert danger != ""  # 危险级仍返回,便于日志/审计


def test_default_blocks_high_and_medium():
    """default 档:high 与 medium 都需审批。"""
    for tool in ("run_command", "delete_file", "move_file", "git_operations", "write_file", "file_edit"):
        need, danger = _resolve_tool_approval("default", tool)
        assert need is True, tool
        assert danger in ("high", "medium"), tool


def test_accept_edits_passes_medium_only():
    """accept-edits 档:文件编辑类(medium)放行,命令/删除类(high)仍需审批。"""
    for tool in ("write_file", "create_file", "file_edit", "apply_patch"):
        need, danger = _resolve_tool_approval("accept-edits", tool)
        assert need is False, tool
        assert danger == "medium", tool
    for tool in ("run_command", "delete_file", "move_file", "git_operations"):
        need, danger = _resolve_tool_approval("accept-edits", tool)
        assert need is True, tool
        assert danger == "high", tool


def test_plan_falls_back_to_default():
    """plan 档兜底同 default:主对话流 plan 靠 prompt 约束,此处只拦高危不额外拒绝。"""
    need, danger = _resolve_tool_approval("plan", "run_command")
    assert need is True
    assert danger == "high"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
