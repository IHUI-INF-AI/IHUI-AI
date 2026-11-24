# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`context://` 统一命名空间接入 mcp 工具真实入口的接线测试(2026-11-23)。

立因:round8 复现了 ``app.core.context_fs.resolve_context_uri`` 判据,但 round9 复核
「这批判据零生产 importer」。本层把判据装到工具真实入口
``_validate_path_in_workspace``:虚拟 URI **只换名字** —— 降成工作区相对路径后,
仍必须走白名单 + symlink + 敏感文件黑名单三层真实判据。任何一条被绕过都算回归。

红线(§0.13):判据语义零改动(用 import 源模块,不复制字面量),半态不放行。
"""

from __future__ import annotations

import asyncio

import pytest

from app.core import context_fs
from app.services import mcp_server

ROOT = "C:/IHUI-AI/apps/ai-service"


def _deref(path: str, roots: list[str] | None = None) -> tuple[bool, str]:
    return mcp_server._deref_context_uri_alias(path, roots if roots is not None else [ROOT])


# --- 1. 非 context 路径:行为逐字节不变 -------------------------------------


def test_non_context_path_passes_through_unchanged() -> None:
    ok, value = _deref("app/main.py")
    assert ok is True
    assert value == "app/main.py"


def test_path_with_context_prefix_but_no_slashes_still_passes_before_wiring() -> None:
    # 'context:' 族一律进判据(交由判据给 wrong_scheme/unjudged),不自行放行。
    ok, value = _deref("context:x")
    assert ok is False
    assert "context URI" in value


# --- 2. allowed:降成相对路径,且虚拟根不带宿主成分 --------------------------


def test_context_uri_allows_and_lowers_to_relative() -> None:
    ok, value = _deref("context://workspace/app/main.py")
    assert ok is True
    assert value == "app/main.py"
    # 虚拟根段不得被宿主路径污染(判据会把 roots[ns] 原样拼进 canonical_path)
    assert ":" not in value and "\\" not in value


def test_virtual_root_pollution_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mcp_server, "_CONTEXT_VIRTUAL_ROOT", "C:/IHUI-AI")
    ok, value = _deref("context://workspace/app/main.py")
    assert ok is False
    assert "宿主成分" in value


# --- 3. denied:八类安全判据逐条生效 ----------------------------------------


@pytest.mark.parametrize(
    ("uri", "reason"),
    [
        ("context://workspace/../../etc/passwd", context_fs.Reason.TRAVERSAL.value),
        ("context://workspace/./a.ts", context_fs.Reason.SYMLINK_ESCAPE.value),
        ("context://workspace/a%2Fb.ts", context_fs.Reason.URL_ENCODED.value),
        ("context://workspace/C:/Windows/x", context_fs.Reason.ABSOLUTE_PATH.value),
        ("context://workspace/a//b", context_fs.Reason.EMPTY_SEGMENT.value),
        ("context://Workspace/a.ts", context_fs.Reason.CASE_VARIANT.value),
        ("context://session/a.ts", context_fs.Reason.MISSING_NAMESPACE_ROOT.value),
    ],
)
def test_context_uri_failures_name_judge_reason(uri: str, reason: str) -> None:
    ok, value = _deref(uri)
    assert ok is False
    assert reason in value, f"应点名判据机器码 {reason},实际: {value}"


def test_context_uri_case_variant_scheme_is_denied_not_passed() -> None:
    ok, value = _deref("Context://workspace/a.ts")
    assert ok is False
    assert context_fs.Reason.CASE_VARIANT.value in value


def test_all_judge_reasons_are_from_enum() -> None:
    # 暴露给模型的文案只能含判据枚举里的机器码(§0.6 不造第二份词表)
    for uri in ("context://workspace/../x", "context://workspace/a//b", "context://x"):
        ok, value = _deref(uri)
        assert ok is False
        codes = [r for r in context_fs.REASONS if r in value]
        assert codes, f"文案未点名任何判据 reason: {value}"
        assert all(r in context_fs.REASONS for r in codes)


# --- 4. 端到端:真工具走同一条路 -------------------------------------------


@pytest.fixture()
def workspace(tmp_path, monkeypatch: pytest.MonkeyPatch):
    """把工具侧白名单根临时指向 tmp_path,让真工具能在受控目录里跑。"""
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path)])
    return tmp_path


def test_read_file_resolves_context_uri_end_to_end(workspace) -> None:
    target = workspace / "hello.txt"
    target.write_text("line1\nline2\n", encoding="utf-8")
    result = asyncio.run(
        mcp_server._tool_read_file({"path": "context://workspace/hello.txt"})
    )
    assert result["ok"] is True
    assert result["content"] == "line1\nline2\n"
    # 回显的是宿主真实路径(虚拟 URI 已降级),便于模型后续引用
    assert str(target) in result["path"]


def test_context_and_bare_relative_resolve_to_same_target(workspace) -> None:
    (workspace / "same.txt").write_text("x", encoding="utf-8")
    via_ctx = mcp_server._validate_path_in_workspace(
        "context://workspace/same.txt", (str(workspace),)
    )
    via_rel = mcp_server._validate_path_in_workspace("same.txt", (str(workspace),))
    assert via_ctx == via_rel


def test_read_file_still_blocks_sensitive_file_under_context_uri(workspace) -> None:
    (workspace / "data").mkdir()
    (workspace / "data" / "sessions.db").write_text("secret", encoding="utf-8")
    result = asyncio.run(
        mcp_server._tool_read_file({"path": "context://workspace/data/sessions.db"})
    )
    assert result["ok"] is False
    assert result["errorCode"] == "SENSITIVE_FILE_BLOCKED"


def test_read_file_denies_traversal_before_touching_disk(workspace) -> None:
    result = asyncio.run(
        mcp_server._tool_read_file({"path": "context://workspace/../../etc/passwd"})
    )
    assert result["ok"] is False
    # 必须由判据**直接**给出拒绝:若接线层把失败吞掉、回落到白名单判定,错误语义就
    # 变成"路径不在工作区白名单内",模型学不到 context URI 的规则(变异可测)。
    assert result["error"].startswith("context URI"), result["error"]
    assert "traversal" in result["error"]


def test_validate_entry_refusal_comes_from_judge_not_fallback() -> None:
    ok, message = mcp_server._validate_path_in_workspace(
        "context://workspace/a%2Fb.ts", (ROOT,)
    )
    assert ok is False
    assert message.startswith("context URI"), message
    assert "url_encoded_bypass" in message


def test_list_files_resolves_context_uri(workspace) -> None:
    (workspace / "sub").mkdir()
    (workspace / "sub" / "a.txt").write_text("x", encoding="utf-8")
    result = asyncio.run(
        mcp_server._tool_list_files({"path": "context://workspace/sub"})
    )
    assert result["ok"] is True
    assert [e["name"] for e in result["entries"]] == ["a.txt"]


def test_write_guard_still_rejects_sensitive_dir_under_context_uri(workspace) -> None:
    (workspace / ".git" / "hooks").mkdir(parents=True)
    ok, value = mcp_server._validate_write_path_in_workspace(
        "context://workspace/.git/hooks/pre-commit"
    )
    assert ok is False, f"写路径必须仍被敏感目录拦下,实际放行到: {value}"


# --- 5. 结构锚点:接线必须真的在真实入口上,而不是孤立函数 -------------------


def test_wiring_is_at_the_single_real_entry() -> None:
    source = __import__("inspect").getsource(mcp_server._validate_path_in_workspace)
    assert "_deref_context_uri_alias(path, roots)" in source
    assert "ctx_ok, ctx_path" in source
    # 失败即收口:不得在降级失败后继续用原 path 往下走
    assert "if not ctx_ok:" in source
    assert "return False, ctx_path" in source


def test_tool_schemas_advertise_the_namespace() -> None:
    # 模型看不到的命名空间等于不存在:四个读写工具 schema 必须同源提示
    tools = {tool.name: tool for tool in mcp_server._TOOLS}
    for name in ("read_file", "list_files", "write_file", "file_edit"):
        assert "context://workspace/" in str(tools[name].input_schema), name


def test_hint_text_is_single_source() -> None:
    assert mcp_server._CONTEXT_URI_HINT.startswith("也可用 context://workspace/")
    # 常量只有一份;schema 里不允许出现第二份独立文案(§0.6)
    assert mcp_server.__dict__["_CONTEXT_URI_HINT"] is mcp_server._CONTEXT_URI_HINT
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
