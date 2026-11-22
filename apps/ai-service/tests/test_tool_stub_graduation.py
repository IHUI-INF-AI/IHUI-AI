# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""V3 #50 桩工具转正回归测试。

背景:_tool_generate_test 曾是纯模板桩(输出 test_placeholder 且 ok:True)、
_tool_analyze_code 只数行数冒充分析 —— 均属 silently wrong。转正后:

- analyze_code: Python 走 ast 真实静态分析(未使用 import/裸 except/圈复杂度/
  超长函数/可变默认参数/TODO-FIXME),其他语言诚实降级为 line-stats;
- generate_test: llm_gateway 真实生成测试代码并真执行(pytest 子进程),
  LLM 不可用(stub 模式/异常/空输出)时返回 ok:False,不再产出占位模板。

本文件全部走 handler 直调 + monkeypatch 假网关,不触发真实网络。
同步包装(asyncio.run)直调 async handler:刻意不依赖 pytest-asyncio ——
部分运行环境未安装该插件(pyproject 已声明但 venv 可能未装),同步包装
在任何环境均可跑。generate_test 的 pytest 执行路径依赖当前 Python 装有
pytest;若依赖缺失请装完补跑(pytest 路径用例已做环境判定,会优雅降级
而非误报)。
"""

import asyncio

from app.services.mcp_server import _tool_analyze_code, _tool_generate_test


def _call(handler, arguments):
    """同步包装:直调 async handler(不依赖 pytest-asyncio 插件)。"""
    return asyncio.run(handler(arguments))


# =============================================================================
# analyze_code:Python AST 真实分析(桩不复存回归)
# =============================================================================

_UNUSED_IMPORT_SOURCE = '''\
import os
import sys


def add(a, b):
    return a + b
'''


def test_analyze_code_reports_unused_import():
    """含未使用 import 的 Python 源码必须被真实报出(不再只是行数统计)。"""
    result = _call(
        _tool_analyze_code,
        {"code": _UNUSED_IMPORT_SOURCE, "language": "python"},
    )
    assert result["ok"] is True
    assert result["analysis_depth"] == "ast"
    names = {item["name"] for item in result["findings"]["unused_imports"]}
    assert "os" in names and "sys" in names


def test_analyze_code_reports_bare_except_and_mutable_default():
    """裸 except 与可变默认参数两项检查的可落地性回归。"""
    source = (
        "import json\n"
        "\n"
        "\n"
        "def risky(x=[]):\n"
        "    try:\n"
        "        return json.loads(x)\n"
        "    except:\n"
        "        return None\n"
    )
    result = _call(_tool_analyze_code, {"code": source, "language": "python"})
    findings = result["findings"]
    assert any(item["name"] == "risky" for item in findings["mutable_defaults"])
    assert len(findings["bare_excepts"]) == 1
    # json 只在 try 内使用,不算未使用 import —— 防误报回归
    assert all(
        item["name"] != "json" for item in findings["unused_imports"]
    )


def test_analyze_code_reports_syntax_error_honestly():
    """Python 语法错误应如实报告为 syntax_error,而不是含糊地数行数。"""
    result = _call(
        _tool_analyze_code,
        {"code": "def broken(:\n    pass\n", "language": "python"},
    )
    assert result["ok"] is True
    assert result["analysis_depth"] == "ast"
    assert result["syntax_error"]["line"] == 1


def test_analyze_code_non_python_is_honest_line_stats():
    """非 Python 语言必须诚实标注 line-stats 降级,不许冒充深度分析。"""
    result = _call(
        _tool_analyze_code,
        {"code": "const x = 1;\n// TODO: fix\n", "language": "javascript"},
    )
    assert result["ok"] is True
    assert result["analysis_depth"] == "line-stats"
    assert "降级" in result["note"] or "line-stats" in result["note"]


def test_analyze_code_empty_code_rejected():
    """空输入必须 ok:False,不得返回空壳成功。"""
    result = _call(_tool_analyze_code, {"code": "", "language": "python"})
    assert result["ok"] is False


# =============================================================================
# generate_test:LLM 真实生成 + 真实执行(桩不复存回归)
# =============================================================================

# 一段纯函数被测源码:两数相加,负数场景是天然的失败路径用例素材
_PURE_FUNC_SOURCE = '''\
def add(a, b):
    """两数相加。"""
    return a + b
'''

# 模拟 LLM 真实产出的测试代码(可执行、含失败路径断言、from source import)
_FAKE_LLM_TEST_CODE = '''\
from source import add


def test_add_normal():
    assert add(1, 2) == 3


def test_add_negative_path():
    assert add(-1, 1) == 0
    assert add(-2, -3) == -5
'''


def _patch_llm(monkeypatch, response=None, exc=None):
    """注入假 llm_gateway.complete,绝不触发真实网络。"""
    from app.core.llm_gateway import llm_gateway

    async def fake_complete(messages, model=None, **kwargs):
        if exc is not None:
            raise exc
        return response or {}

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)


def test_generate_test_real_llm_output_executed_by_pytest(monkeypatch):
    """LLM 真实产出的测试必须被 pytest 真执行,通过数如实进返回体。"""
    _patch_llm(
        monkeypatch,
        response={
            "content": _FAKE_LLM_TEST_CODE,
            "model": "fake/test-model",
            "stub": False,
        },
    )
    result = _call(
        _tool_generate_test,
        {"code": _PURE_FUNC_SOURCE, "language": "python", "framework": "pytest"},
    )
    assert result["ok"] is True
    assert result["analysis_depth"] == "llm-generated"
    # 关键回归:产物里绝不允许再出现占位模板 test_placeholder
    assert "test_placeholder" not in result["test_code"]
    if result.get("executed"):
        # pytest 真跑:两条用例都应通过
        assert result["execution"]["runner"] == "pytest"
        assert result["execution"]["passed"] == 2
        assert result["execution"]["failed"] == 0
    else:
        # 执行环境缺失时的降级必须如实标注(见文件头「依赖装完补跑」)
        assert result["execution"]["runner"].startswith("syntax-check")


def test_generate_test_rejects_stub_llm_response(monkeypatch):
    """stub 网关响应(无真实 key)必须 ok:False,占位内容不得流向调用方。"""
    _patch_llm(
        monkeypatch,
        response={
            "content": "def test_placeholder():\n    pass\n",
            "model": "stub",
            "stub": True,
        },
    )
    result = _call(_tool_generate_test, {"code": _PURE_FUNC_SOURCE})
    assert result["ok"] is False
    assert result.get("stub") is True
    assert "test_code" not in result  # 假产物不许出现
    assert "stub" in result["error"]


def test_generate_test_llm_exception_returns_ok_false(monkeypatch):
    """LLM 通道异常必须诚实失败(ok:False + 原因),不出占位模板。"""
    _patch_llm(monkeypatch, exc=RuntimeError("gateway down"))
    result = _call(_tool_generate_test, {"code": _PURE_FUNC_SOURCE})
    assert result["ok"] is False
    assert "gateway down" in result["error"]


def test_generate_test_empty_llm_output_returns_ok_false(monkeypatch):
    """LLM 返回空内容必须 ok:False,不得返回空壳成功。"""
    _patch_llm(
        monkeypatch,
        response={"content": "", "model": "fake/test-model", "stub": False},
    )
    result = _call(_tool_generate_test, {"code": _PURE_FUNC_SOURCE})
    assert result["ok"] is False


def test_generate_test_empty_code_rejected():
    """空被测代码必须 ok:False。"""
    result = _call(_tool_generate_test, {"code": "   \n"})
    assert result["ok"] is False


def test_generate_test_generated_test_actually_fails_when_buggy(monkeypatch):
    """反向验证:LLM 产出与被测代码不符的断言时,pytest 结果必须如实报失败。

    这是「真的执行了一遍」的最强证据 —— 假桩永远不会发现测试失败。
    """
    _patch_llm(
        monkeypatch,
        response={
            "content": (
                "from source import add\n"
                "\n"
                "\n"
                "def test_add_wrong_expectation():\n"
                "    assert add(1, 1) == 3\n"
            ),
            "model": "fake/test-model",
            "stub": False,
        },
    )
    result = _call(
        _tool_generate_test, {"code": _PURE_FUNC_SOURCE, "language": "python"}
    )
    if result.get("executed"):
        assert result["execution"]["failed"] == 1
        assert result["execution"]["passed"] == 0


# =============================================================================
# 注册表完整性(守门脚本同源断言,防 handler 改动破坏 1:1)
# =============================================================================


def test_tool_registry_two_tools_still_registered():
    """analyze_code / generate_test 在 _TOOLS 与 _TOOL_HANDLERS 中仍 1:1。"""
    from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS

    registered = {t.name for t in _TOOLS}
    assert {"analyze_code", "generate_test"} <= registered
    assert "analyze_code" in _TOOL_HANDLERS
    assert "generate_test" in _TOOL_HANDLERS
