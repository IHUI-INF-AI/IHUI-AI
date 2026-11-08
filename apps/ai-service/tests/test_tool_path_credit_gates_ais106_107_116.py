# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-106 / AIS-107 / AIS-116 夹具(同批:三个都是"工具面少了调用前闸")。

AIS-106 `file_search`:path 无白名单校验 ⇒ role=0 可 `path=/` 枚举整机目录,
再用 query 回读文件内容(与 read_file 的路径闸同源缺口),且无单文件大小上限。
AIS-107 `investigate_codebase`:直接把模型给的 path 当仓根 ⇒ 任意目录探测
(文件面/大小/命名/结构一次性外泄),且被扫描的内容会回灌给模型。
AIS-116 `image_edit`:付费改图未过 `gate_image_spend` ⇒ 宿主盖章余额为 0 时
仍会调用上游产生费用(image_generation 早已有闸,edits 漏了)。

改前实测:106=2 红(path 根外仍枚举/大文件仍读)、107=1 红、116=1 红。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from app.services import mcp_server as ms


async def test_file_search_rejects_root_outside_workspace(monkeypatch, tmp_path):
    """AIS-106:根外目录一律 PATH_NOT_ALLOWED,且零枚举(旧码会真扫)。"""
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "leak.py").write_text("SECRET_TOKEN_106 = 1\n", encoding="utf-8")
    out = await ms._tool_file_search({"path": str(outside), "query": "SECRET_TOKEN_106"})
    assert out["ok"] is False and out.get("errorCode") == "PATH_NOT_ALLOWED", out
    assert out["matches"] == [], out


async def test_file_search_rejects_traversal_root(monkeypatch, tmp_path):
    """AIS-106:相对穿越解析到根外同样拒(用小目录,避免旧码真扫整盘)。"""
    import os

    outside = tmp_path / "outside2"
    outside.mkdir()
    (outside / "leak.py").write_text("SECRET_TOKEN_106B = 1\n", encoding="utf-8")
    rel = os.path.relpath(outside, os.getcwd())
    out = await ms._tool_file_search({"path": rel, "query": "SECRET_TOKEN_106B"})
    assert out["ok"] is False and out.get("errorCode") == "PATH_NOT_ALLOWED", out
    assert out["matches"] == [], out


async def test_file_search_skips_oversized_files(monkeypatch):
    """AIS-106:单文件超上限必须跳过(否则一个超大文件就能把上下文撑爆)。"""
    monkeypatch.setattr(ms, "_MAX_SEARCH_FILE_BYTES", 0, raising=False)
    out = await ms._tool_file_search(
        {"path": ".", "pattern": "*.py", "query": "def _validate_path_in_workspace"}
    )
    assert out["ok"] is True, out
    assert out["matches"] == [], out


async def test_file_search_still_works_inside_workspace(monkeypatch):
    """AIS-106 正向:工作区内搜索照常(闸不得误伤正常检索)。"""
    out = await ms._tool_file_search({"path": ".", "pattern": "*.py", "max_results": 5})
    assert out["ok"] is True, out
    assert out["matches"]


async def test_investigate_codebase_rejects_root_outside_workspace(monkeypatch, tmp_path):
    """AIS-107:模型给的 path 不得直接当仓根;根外 ⇒ 不调 investigator。"""
    called: list[dict[str, Any]] = []

    async def _spy(args: dict[str, Any]) -> dict[str, Any]:
        called.append(dict(args))
        return {"ok": True, "tool": "investigate_codebase", "findings": []}

    monkeypatch.setattr(
        "app.services.codebase_investigator.investigate_codebase", _spy
    )
    out = await ms._tool_investigate_codebase(
        {"path": str(tmp_path), "query": "有无密钥"}
    )
    assert out["ok"] is False and out.get("errorCode") == "PATH_NOT_ALLOWED", out
    assert called == []


async def test_investigate_codebase_passes_normalized_workspace_path(monkeypatch):
    """AIS-107 正向:工作区内路径放行,且下传的是**校验后的**路径而非模型原文。"""
    seen: list[dict[str, Any]] = []

    async def _spy(args: dict[str, Any]) -> dict[str, Any]:
        seen.append(dict(args))
        return {"ok": True, "tool": "investigate_codebase", "findings": []}

    monkeypatch.setattr(
        "app.services.codebase_investigator.investigate_codebase", _spy
    )
    out = await ms._tool_investigate_codebase({"path": "app", "query": "目录结构"})
    assert out["ok"] is True, out
    assert seen and Path(seen[0]["path"]).is_absolute(), seen


async def test_image_edit_blocked_by_credit_gate_before_upstream(monkeypatch):
    """AIS-116:余额 0 且无批准 ⇒ 上游前拦截(改前会直接调付费改图)。"""
    instances: list[Any] = []

    class _NoClient:
        def __init__(self, *a, **k):
            instances.append(1)
            raise AssertionError("计费闸没拦住:已经创建了上游 HTTP 客户端")

    monkeypatch.setattr("httpx.AsyncClient", _NoClient)
    out = await ms._tool_image_edit(
        {"image": "http://example.test/a.png", "prompt": "把背景改成蓝色",
         "__credit_balance": 0}
    )
    assert out["ok"] is False and out.get("errorCode") == "CREDIT_APPROVAL_REQUIRED", out
    assert out["tool"] == "image_edit", out
    assert out.get("saved_path") is None, out
    assert instances == []


async def test_image_edit_proceeds_when_gate_allows(monkeypatch):
    """AIS-116 正向:没盖章余额 / 已批准 ⇒ 不被计费闸拦(仍走原链路)。"""
    out = await ms._tool_image_edit(
        {"image": "http://example.test/a.png", "prompt": "把背景改成蓝色"}
    )
    assert out.get("errorCode") != "CREDIT_APPROVAL_REQUIRED", out

    approved = await ms._tool_image_edit(
        {"image": "http://example.test/a.png", "prompt": "把背景改成蓝色",
         "__credit_balance": 0, "__credit_approval": "granted"}
    )
    assert approved.get("errorCode") != "CREDIT_APPROVAL_REQUIRED", approved


async def test_rejection_is_observable(caplog, tmp_path):
    """闸拒绝必须可检索(不静默)。"""
    caplog.set_level(logging.WARNING)
    await ms._tool_image_edit(
        {"image": "http://example.test/a.png", "prompt": "x", "__credit_balance": 0}
    )
    messages = [r.getMessage() for r in caplog.records]
    assert any("CREDIT_APPROVAL_REQUIRED" in m or "计费" in m for m in messages), messages
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
