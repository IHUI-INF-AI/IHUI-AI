# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​‌​‌​‌​‌‍‍​‌​‌​​‌‌‍‍‌​‌​‌​‌​‌‍‍​‌​‌‌​‌‍‍‌​‌​‌‌​‌‍‍​‌​‌‌​‌‌‍‍‌​‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌‌​‌‌‍‍​‌​‌​​‌‌‍‍​‌​​‌​‌​‌‍‍​‌​​‌‌​‌‍‍​‌​‌‌​‌​‌​‍‍​‌​‌​‌​‌​‌‍‍​‌​​‌​‌‍‍​‌​‌​‌​‌​‌‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌‌​‌​‌​‍‍​‌​‌​​‌‌‍‍​‌​‌​‌​‍‍​‌​​‌‌​‌‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‍‍​‌​​‌‌​‌‍‍‌‌​​‌​‌​‌‍‍​‌​‌​‌​‍‍​‌​‌​‌​‌​‍‍​‌​‌​‌​‌‍‍‌‌​​‌​‌​‌‍‍​‌​​‌​‌​‍‍​‌​​‌​​‌​‌‍‍​‌​‌‌‌​‌⁠

"""lsp.py HTTP API 层测试(app/api/v1/lsp.py,0-4 LSP 四核心前端接线配套)。

覆盖 4 端点(前缀 /api/v1/lsp):
1. POST /definition   — 转到定义
2. POST /references   — 查找引用
3. POST /diagnostics  — 文件诊断
4. POST /hover        — 符号 hover

设计:
- mock LspClient.get 返回 AsyncMock 客户端,不启动真实 typescript-language-server 子进程。
- monkeypatch shutil.which 让 _check_lsp_available 通过;tmp_path 提供真实文件满足 _resolve_file。
- 另覆盖:单元级 _format_location/_format_diagnostic end 坐标(含缺失回退)、
  LSP 未安装 503、运行时失败 503 降级 body、文件不存在 404、请求参数 422。
- 覆盖 conftest 中 broken 的 _isolate_vector_memory fixture(同 test_debug_api.py)。
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest


# =============================================================================
# 覆盖 conftest.py 中 broken 的 _isolate_vector_memory fixture + 关闭 JWT 认证
# (参考 test_debug_api.py 的做法)
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture(引用了已移除的 _store / _next_id)。
    同时清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# Mock 基础设施
# =============================================================================


def _lsp_uri(path: Path) -> str:
    """绝对路径 → file:// URI(测试环境跨平台)。"""
    return "file:///" + str(path).replace("\\", "/").lstrip("/")


def _make_mock_client(
    definition: list | None = None,
    references: list | None = None,
    diagnostics: list | None = None,
    hover: dict | None = None,
) -> MagicMock:
    """构造 Mock LspClient:核心方法 AsyncMock,返回预置 LSP 原始结构(0-based)。"""
    c = MagicMock()
    c._ensure_started = AsyncMock()
    c.goto_definition = AsyncMock(
        return_value=definition
        if definition is not None
        else [
            {
                "uri": _lsp_uri(Path("WS") / "src" / "a.ts"),
                "range": {"start": {"line": 4, "character": 9}, "end": {"line": 4, "character": 13}},
            }
        ]
    )
    c.find_references = AsyncMock(
        return_value=references
        if references is not None
        else [
            {
                "uri": _lsp_uri(Path("WS") / "src" / "b.ts"),
                "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 6}},
            }
        ]
    )
    c.get_diagnostics = AsyncMock(
        return_value=diagnostics
        if diagnostics is not None
        else [
            {
                "range": {"start": {"line": 2, "character": 3}, "end": {"line": 2, "character": 8}},
                "severity": 1,
                "source": "ts",
                "code": 2322,
                "message": "Type 'string' is not assignable to type 'number'.",
            }
        ]
    )
    c.hover = AsyncMock(
        return_value=hover
        if hover is not None
        else {"contents": {"kind": "markdown", "value": "`foo(): number`"}}
    )
    return c


@pytest.fixture
def ws(tmp_path: Path) -> Path:
    """真实临时工作区 + 源文件(_resolve_file 校验存在)。"""
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.ts").write_text("export const foo = (): number => 1\n", encoding="utf-8")
    (src / "b.ts").write_text("import { foo } from './a'\n", encoding="utf-8")
    return tmp_path


@pytest.fixture
def mock_client(monkeypatch: pytest.MonkeyPatch, ws: Path) -> MagicMock:
    """注入 mock LspClient + 让 _check_lsp_available 通过。"""
    c = _make_mock_client()
    monkeypatch.setattr("app.api.v1.lsp.LspClient.get", classmethod(lambda cls, p: c))
    monkeypatch.setattr("app.api.v1.lsp.shutil.which", lambda b: "/usr/bin/fake-tsls" if b == "typescript-language-server" else None)
    return c


# =============================================================================
# 单元级:_format_location / _format_diagnostic end 坐标
# =============================================================================


def test_format_location_with_end_range() -> None:
    """range 含 end 时输出 1-based start + end 坐标。"""
    from app.api.v1.lsp import _format_location

    loc = {
        "uri": _lsp_uri(Path("WS") / "src" / "a.ts"),
        "range": {"start": {"line": 4, "character": 9}, "end": {"line": 4, "character": 13}},
    }
    out = _format_location(loc, "WS")
    assert out["file"].endswith("src/a.ts")
    assert out["line"] == 5
    assert out["column"] == 10
    assert out["endLine"] == 5
    assert out["endColumn"] == 14


def test_format_location_missing_end_falls_back_to_start() -> None:
    """range 缺 end 时 endLine/endColumn 回退 start(零宽 range 兜底)。"""
    from app.api.v1.lsp import _format_location

    loc = {
        "uri": _lsp_uri(Path("WS") / "src" / "a.ts"),
        "range": {"start": {"line": 1, "character": 2}},
    }
    out = _format_location(loc, "WS")
    assert out["line"] == 2
    assert out["column"] == 3
    assert out["endLine"] == 2
    assert out["endColumn"] == 3


def test_format_diagnostic_with_end_range() -> None:
    """diagnostic range 含 end 时输出 severity + 1-based start/end 坐标。"""
    from app.api.v1.lsp import _format_diagnostic

    d = {
        "range": {"start": {"line": 2, "character": 3}, "end": {"line": 2, "character": 8}},
        "severity": 1,
        "source": "ts",
        "code": 2322,
        "message": "err",
    }
    out = _format_diagnostic(d)
    assert out["severity"] == "Error"
    assert out["line"] == 3
    assert out["column"] == 4
    assert out["endLine"] == 3
    assert out["endColumn"] == 9
    assert out["source"] == "ts"


def test_format_diagnostic_missing_end_falls_back_to_start() -> None:
    """diagnostic range 缺 end 时 endLine/endColumn 回退 start。"""
    from app.api.v1.lsp import _format_diagnostic

    d = {"range": {"start": {"line": 0, "character": 0}}, "severity": 2, "message": "w"}
    out = _format_diagnostic(d)
    assert out["severity"] == "Warning"
    assert out["line"] == 1
    assert out["column"] == 1
    assert out["endLine"] == 1
    assert out["endColumn"] == 1


# =============================================================================
# 1. POST /api/v1/lsp/definition
# =============================================================================


async def test_definition_ok(client, mock_client, ws: Path) -> None:
    """转到定义:200 + count/locations,坐标 1-based 且含 end。"""
    resp = await client.post(
        "/api/v1/lsp/definition",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 1, "column": 13},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    locs = body["data"]["locations"]
    assert body["data"]["count"] == len(locs) == 1
    assert locs[0]["file"].endswith("src/a.ts")
    assert locs[0]["line"] == 5
    assert locs[0]["column"] == 10
    assert locs[0]["endLine"] == 5
    assert locs[0]["endColumn"] == 14
    mock_client.goto_definition.assert_awaited_once()


async def test_definition_missing_params_returns_422(client, mock_client, ws: Path) -> None:
    """缺少 line/column 返回 422。"""
    resp = await client.post(
        "/api/v1/lsp/definition",
        json={"workspacePath": str(ws), "file": "src/a.ts"},
    )
    assert resp.status_code == 422


# =============================================================================
# 2. POST /api/v1/lsp/references
# =============================================================================


async def test_references_ok(client, mock_client, ws: Path) -> None:
    """查找引用:200 + locations + includeDeclaration 默认 true。"""
    resp = await client.post(
        "/api/v1/lsp/references",
        json={"workspacePath": str(ws), "file": "src/b.ts", "line": 1, "column": 10},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    locs = body["data"]["locations"]
    assert len(locs) == 1
    assert locs[0]["file"].endswith("src/b.ts")
    assert locs[0]["endColumn"] == 7
    assert body["data"]["includeDeclaration"] is True
    # context.includeDeclaration=True 传给 LSP
    mock_client.find_references.assert_awaited_once()


async def test_references_include_declaration_false(client, mock_client, ws: Path) -> None:
    """includeDeclaration=false 正确透传。"""
    resp = await client.post(
        "/api/v1/lsp/references",
        json={
            "workspacePath": str(ws),
            "file": "src/b.ts",
            "line": 1,
            "column": 10,
            "includeDeclaration": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["includeDeclaration"] is False


# =============================================================================
# 3. POST /api/v1/lsp/diagnostics
# =============================================================================


async def test_diagnostics_ok(client, mock_client, ws: Path) -> None:
    """文件诊断:200 + errors/warnings 统计 + diagnostics 含 end 坐标。"""
    resp = await client.post(
        "/api/v1/lsp/diagnostics",
        json={"workspacePath": str(ws), "file": "src/a.ts"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["count"] == 1
    assert data["errors"] == 1
    assert data["warnings"] == 0
    diag = data["diagnostics"][0]
    assert diag["severity"] == "Error"
    assert diag["line"] == 3
    assert diag["column"] == 4
    assert diag["endLine"] == 3
    assert diag["endColumn"] == 9


async def test_diagnostics_empty(client, mock_client, ws: Path) -> None:
    """无诊断时 count/errors/warnings 全 0。"""
    mock_client.get_diagnostics = AsyncMock(return_value=[])
    resp = await client.post(
        "/api/v1/lsp/diagnostics",
        json={"workspacePath": str(ws), "file": "src/a.ts"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["count"] == 0
    assert data["errors"] == 0
    assert data["warnings"] == 0
    assert data["diagnostics"] == []


# =============================================================================
# 4. POST /api/v1/lsp/hover
# =============================================================================


async def test_hover_ok(client, mock_client, ws: Path) -> None:
    """hover:200 + formatHover 提取 contents.value + raw 原文。"""
    resp = await client.post(
        "/api/v1/lsp/hover",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 1, "column": 13},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["hover"] == "`foo(): number`"
    assert body["data"]["raw"] == {"contents": {"kind": "markdown", "value": "`foo(): number`"}}


async def test_hover_none_result(client, mock_client, ws: Path) -> None:
    """hover 无结果时返回占位文案(非 503)。"""
    mock_client.hover = AsyncMock(return_value=None)
    resp = await client.post(
        "/api/v1/lsp/hover",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 1, "column": 1},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["hover"] == "(无 hover 信息)"


# =============================================================================
# 5. 降级与错误路径
# =============================================================================


async def test_lsp_not_installed_returns_503(client, monkeypatch: pytest.MonkeyPatch, ws: Path) -> None:
    """typescript-language-server 未安装时 _check_lsp_available 抛 HTTP 503。"""
    monkeypatch.setattr("app.api.v1.lsp.shutil.which", lambda b: None)
    resp = await client.post(
        "/api/v1/lsp/definition",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 1, "column": 1},
    )
    assert resp.status_code == 503


async def test_runtime_failure_returns_lsp_unavailable_body(
    client, mock_client, ws: Path
) -> None:
    """运行时失败(如超时)→ 200 + code 503 + errorType lsp-unavailable 降级提示。"""
    mock_client._ensure_started.side_effect = RuntimeError("LSP request initialize 超时")
    resp = await client.post(
        "/api/v1/lsp/definition",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 1, "column": 1},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 503
    assert body["data"]["errorType"] == "lsp-unavailable"
    assert "codegraph" in body["data"]["hint"]


async def test_file_not_found_returns_404(client, mock_client, ws: Path) -> None:
    """文件不存在返回 404。"""
    resp = await client.post(
        "/api/v1/lsp/diagnostics",
        json={"workspacePath": str(ws), "file": "src/ghost.ts"},
    )
    assert resp.status_code == 404


async def test_definition_zero_line_returns_422(client, mock_client, ws: Path) -> None:
    """line=0(0-based 误传)返回 422(ge=1 校验)。"""
    resp = await client.post(
        "/api/v1/lsp/definition",
        json={"workspacePath": str(ws), "file": "src/a.ts", "line": 0, "column": 1},
    )
    assert resp.status_code == 422
