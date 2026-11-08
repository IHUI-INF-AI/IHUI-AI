# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""stdio 工具清单接线取证(2026-11-02 立)。

`mcp_stdio_bridge.get_stdio_server_tools` / `is_stdio_server_registered` 自 2026-09-02
造好后零调用方(add / remove / shutdown 三条腿都接了,唯独"看得见"这一半没接)。后果:

- 商店安装/启用走的 `add_stdio_server_tool` 在同名 server 已在册时**按幂等返回 0**,
  端点把这个 0 当"工具数"写进持久化记录并回给前端 ⇒ 装了 3 个工具的 server 显示 0 个;
- 列表只有一个持久化 `enabled` 位,分不清"此刻真在册(子进程活着)"与"记录说启用但
  进程重启后并没挂上"。

本文件把两处都钉住:① 真值来自 stdio 池(用**真的** StdioServerHandle 入池,不 mock
读出口,免得测试与生产各判一套);② 未在册时回落持久化记录(不抹掉历史计数);
③ 在册判定确实经 `is_stdio_server_registered`、清单确实经 `get_stdio_server_tools`
(间谍断言"接上后真的被调到");④ 不新增端点 —— 全部断言打在既有出口上。

隔离:不起子进程(add/remove 被 mock)、mcp_store 落 tmp_path、_STDIO_SERVERS 测后还原。
"""

from __future__ import annotations

import stat
import sys
from contextlib import AsyncExitStack
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp as mcp_router
from app.services import mcp_server, mcp_stdio_bridge, mcp_store

_LIVE_TOOLS = ["git__add", "git__commit", "git__diff"]


@pytest.fixture
def fake_npx_on_path(tmp_path, monkeypatch):
    """PATH 收窄到临时目录并自造 npx 入口(商店安装会显式解析裸名命令)。"""
    bin_dir = tmp_path / "fakebin"
    bin_dir.mkdir()
    name = "npx.cmd" if sys.platform == "win32" else "npx"
    entry = bin_dir / name
    entry.write_text("", encoding="utf-8")
    entry.chmod(entry.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setenv("PATH", str(bin_dir))
    if sys.platform == "win32":
        monkeypatch.setenv("PATHEXT", ".COM;.EXE;.BAT;.CMD")
    return str(entry)


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def live_pool(monkeypatch):
    """把 add/remove 换成"操作真的 StdioServerHandle 池"的替身(不起子进程)。

    add 走真实幂等语义:已在册 ⇒ 返回 0 且不重复登记(这正是旧端点写出那个 0 的场景)。
    """
    calls: dict[str, list[Any]] = {"add": [], "remove": []}

    def _handle(name: str) -> mcp_stdio_bridge.StdioServerHandle:
        return mcp_stdio_bridge.StdioServerHandle(
            name=name,
            command="npx",
            args=["-y", "@modelcontextprotocol/server-git"],
            env={},
            stack=AsyncExitStack(),
            session=None,
            tools=[],
            registered_tools=list(_LIVE_TOOLS),
        )

    async def fake_add(name, command, args=None, env=None, description=""):
        calls["add"].append({"name": name, "command": command})
        if name in mcp_stdio_bridge._STDIO_SERVERS:
            return 0  # 幂等跳过:旧端点把这里返回的 0 当成了"工具数"
        mcp_stdio_bridge._STDIO_SERVERS[name] = _handle(name)
        return len(_LIVE_TOOLS)

    async def fake_remove(name):
        calls["remove"].append(name)
        handle = mcp_stdio_bridge._STDIO_SERVERS.pop(name, None)
        return list(handle.registered_tools) if handle else []

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


@pytest.fixture
def clean_pool():
    before = dict(mcp_stdio_bridge._STDIO_SERVERS)
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tools = {t.name for t in mcp_server._TOOLS}
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tools]
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before)


@pytest.fixture
def api_client(store_path):
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


def _install(api_client: TestClient, key: str = "git") -> dict[str, Any]:
    resp = api_client.post(
        "/api/mcp/store/install", json={"key": key, "confirm_risk": True}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _entry(api_client: TestClient, key: str = "git") -> dict[str, Any]:
    body = api_client.get("/api/mcp/store").json()
    return next(s for s in body["servers"] if s["key"] == key)


# ---------------------------------------------------------------------------
# ① 安装:在册时落真值,而不是 add 幂等返回的那个 0
# ---------------------------------------------------------------------------


def test_install_persists_live_tool_count_not_zero(
    api_client, store_path, live_pool, clean_pool, fake_npx_on_path
):
    """首轮安装写入真值;同名已在册的第二轮安装(add 返回 0)不得将计数抹成 0。"""
    body = _install(api_client)
    assert body["tool_count"] == len(_LIVE_TOOLS)
    assert body["running"] is True
    assert body["tools"] == _LIVE_TOOLS
    assert mcp_store.get_installed("git")["tool_count"] == len(_LIVE_TOOLS)

    # 模拟"进程里已在册但记录丢了"(重启后未落库 / 记录被清)⇒ 再装一次
    mcp_store.remove_installed("git")
    assert mcp_store.get_installed("git") is None
    assert "git" in mcp_stdio_bridge._STDIO_SERVERS
    second = _install(api_client)
    assert len(live_pool["add"]) == 2, "两轮都应真的问到 add"
    assert second["running"] is True
    assert second["tool_count"] == len(_LIVE_TOOLS), (
        "add 幂等返回 0 时,持久化/响应必须改读 stdio 池的真值"
    )
    assert mcp_store.get_installed("git")["tool_count"] == len(_LIVE_TOOLS)


# ---------------------------------------------------------------------------
# ② GET /api/mcp/store:running 与 tool_count 反映 stdio 池真值
# ---------------------------------------------------------------------------


def test_store_list_reports_live_registration(
    api_client, store_path, live_pool, clean_pool, fake_npx_on_path
):
    _install(api_client)
    entry = _entry(api_client)
    assert entry["running"] is True
    assert entry["tools"] == _LIVE_TOOLS
    assert entry["tool_count"] == len(_LIVE_TOOLS)

    # 停用 ⇒ 池里没这条了,但记录仍在:running 翻 False,计数回落持久化值(不抹成 0)
    assert api_client.post("/api/mcp/store/git/disable").status_code == 200
    assert "git" not in mcp_stdio_bridge._STDIO_SERVERS
    entry2 = _entry(api_client)
    assert entry2["running"] is False
    assert entry2["tools"] == []
    assert entry2["tool_count"] == len(_LIVE_TOOLS)
    assert entry2["enabled"] is False, "持久化 enabled 位仍由记录说了算(与 running 分档)"


def test_store_list_running_false_for_never_installed(api_client, clean_pool):
    """未安装条目:running=False、tools=[]、tool_count=0(与旧行为逐零差异)。"""
    entry = _entry(api_client, "filesystem")
    assert entry["running"] is False
    assert entry["tools"] == []
    assert entry["tool_count"] == 0


# ---------------------------------------------------------------------------
# ③ 启用出口:已启用态下也要读真值
# ---------------------------------------------------------------------------


def test_enable_already_enabled_returns_live_count(
    api_client, store_path, live_pool, clean_pool, fake_npx_on_path
):
    _install(api_client)
    # 记录说 enabled=True 且真的在册 ⇒ 幂等启用不得再热挂载,但必须回真值
    body = api_client.post("/api/mcp/store/git/enable").json()
    assert len(live_pool["add"]) == 1, "已启用且在册时不该重复热挂载"
    assert body["running"] is True
    assert body["tool_count"] == len(_LIVE_TOOLS)
    assert body["tools"] == _LIVE_TOOLS


# ---------------------------------------------------------------------------
# ④ 接线本身被调到(间谍断言:判在册用 is_stdio_server_registered,
#    取清单用 get_stdio_server_tools —— 端点里不许再写第三套判定)
# ---------------------------------------------------------------------------


def test_store_list_calls_the_bridge_read_outlets(api_client, monkeypatch):
    seen_registered: list[str] = []
    seen_tools: list[str] = []

    def spy_registered(name: str) -> bool:
        seen_registered.append(name)
        return name == "git"

    def spy_tools(name: str) -> list[str]:
        seen_tools.append(name)
        return ["git__only"] if name == "git" else []

    monkeypatch.setattr(mcp_stdio_bridge, "is_stdio_server_registered", spy_registered)
    monkeypatch.setattr(mcp_stdio_bridge, "get_stdio_server_tools", spy_tools)

    entry = _entry(api_client, "git")
    assert "git" in seen_registered, "在册判定必须经 is_stdio_server_registered"
    assert "git" in seen_tools, "工具清单必须经 get_stdio_server_tools"
    assert entry["running"] is True
    assert entry["tools"] == ["git__only"]
    assert entry["tool_count"] == 1


def test_no_new_endpoint_added(api_client, clean_pool):
    """接线只落在既有出口:路由表里不许冒出 /mcp/store/*/tools 这类新端点。"""
    paths = {getattr(r, "path", "") for r in mcp_router.router.routes}
    assert "/mcp/store" in paths
    assert not any(p.startswith("/mcp/store/") and p.endswith("/tools") for p in paths), (
        sorted(paths)
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
