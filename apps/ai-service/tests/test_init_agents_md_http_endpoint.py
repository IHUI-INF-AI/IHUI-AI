# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D118 落点②:POST /api/tools/init-agents-md 端点契约。

web「空 AGENTS.md 工作区」的一键生成入口经此端点取草稿(不直连 MCP 协议):
  - 只回传 draft,绝不落盘(断言工作区里没有多出 AGENTS.md)
  - workspace_root 复用 MCP 面白名单守卫(越界 ⇒ PERMISSION_DENIED)
  - 请求模型 extra=forbid:传 output_path 直接 422,堵死"顺手写盘"的后门
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from app.routers import tools as tools_router
from app.services import mcp_server


def _make_client() -> httpx.AsyncClient:
    app = FastAPI()
    app.include_router(tools_router.router)
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


async def test_endpoint_returns_draft_and_never_writes_file(tmp_path, monkeypatch):
    ws = tmp_path / "repo"
    ws.mkdir()
    (ws / "package.json").write_text('{"scripts":{"build":"tsc -b"}}', encoding="utf-8")
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(ws)])

    async with _make_client() as client:
        resp = await client.post(
            "/tools/init-agents-md", json={"workspace_root": str(ws)}
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True, body
    assert "npm run build" in body["draft"]
    # 只回草稿:端点没有写盘路径
    assert not (ws / "AGENTS.md").exists()


async def test_endpoint_rejects_root_outside_whitelist(tmp_path, monkeypatch):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(allowed)])

    async with _make_client() as client:
        resp = await client.post(
            "/tools/init-agents-md", json={"workspace_root": str(outside)}
        )

    body = resp.json()
    assert body["ok"] is False
    assert body["errorCode"] == "PERMISSION_DENIED"
    assert not (outside / "AGENTS.md").exists()


async def test_output_path_is_rejected_at_schema_level(tmp_path, monkeypatch):
    ws = tmp_path / "repo"
    ws.mkdir()
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(ws)])

    async with _make_client() as client:
        resp = await client.post(
            "/tools/init-agents-md",
            json={"workspace_root": str(ws), "output_path": str(ws / "AGENTS.md")},
        )

    assert resp.status_code == 422
    assert not (ws / "AGENTS.md").exists()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
