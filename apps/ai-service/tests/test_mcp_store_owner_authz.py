# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 应用商店安装记录的属主隔离测试(2026-09-29,G-371 格②当场收口)。

为什么这一面必须收:商店的三个变更端点在收口前**一个身份参数都不收** —— 任何已登录用户都能
停用/卸载别人的安装,而"停用"会把它注入的工具从别人的会话里抽走;`install` 撞到一条同名的
disabled 记录还会 `save_installed` **整条覆盖别人的 env/args**(即拿别人的凭据换掉别人的配置)。

三条判据各钉一格:
1. 别人的记录 ⇒ 403,且**副作用没发生**(记录逐字段未变、bridge 一次都没被调);
2. 自己的记录 ⇒ 照旧可改(正向对照,否则本票只是把功能改坏了);
3. 存量无属主记录 ⇒ **维持改动前行为**(任何登录主体可改)—— 这是机主拍过的"写侧补属主 +
   回填再收紧"的中间态,不是"无主即可被任何人改"的结论;收紧它得先有人逐条认领。

两个主体共用同一个 store 文件(只 monkeypatch 一次路径):否则"B 改不动"只是因为换了文件。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jwt_auth import require_request_user_id
from app.routers import mcp as mcp_router
from app.services import mcp_server, mcp_stdio_bridge, mcp_store
from app.services.mcp_store import OWNER_FIELD

USER_A = "user-a"
USER_B = "user-b"


@pytest.fixture
def store_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def bridge_spy(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[str]]:
    """记录 bridge 调用,不真起子进程。"""
    calls: dict[str, list[str]] = {"add": [], "remove": []}

    async def fake_add(name, command, args=None, env=None, description=""):
        calls["add"].append(name)
        return 2

    async def fake_remove(name):
        calls["remove"].append(name)
        return [f"{name}__tool1"]

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


@pytest.fixture
def clean_registry():
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tools = {t.name for t in mcp_server._TOOLS}
    before_external = set(mcp_server._EXTERNAL_TOOL_NAMES)
    before_servers = dict(mcp_stdio_bridge._STDIO_SERVERS)
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tools]
    mcp_server._EXTERNAL_TOOL_NAMES.clear()
    mcp_server._EXTERNAL_TOOL_NAMES.update(before_external)
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before_servers)


def _client(owner: str) -> TestClient:
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: owner
    return TestClient(app)


def _install(owner: str, key: str = "git") -> TestClient:
    cli = _client(owner)
    r = cli.post("/api/mcp/store/install", json={"key": key, "confirm_risk": True})
    assert r.status_code == 200, r.text
    return cli


def _records() -> list[dict[str, object]]:
    return mcp_store.list_installed()


def test_install_stamps_the_transport_layer_principal(store_path: Path, bridge_spy) -> None:
    _install(USER_A)
    recs = _records()
    assert len(recs) == 1
    assert recs[0][OWNER_FIELD] == USER_A
    # 请求体自报属主一律不采信:塞一个别的值,落盘的仍是承载层那个
    cli = _client(USER_A)
    r = cli.post(
        "/api/mcp/store/install",
        json={"key": "filesystem", "owner_user_id": USER_B},
    )
    assert r.status_code in (200, 409), r.text
    fresh = [x for x in _records() if x["key"] == "filesystem"]
    if fresh:
        assert fresh[0][OWNER_FIELD] == USER_A


def test_foreign_user_cannot_stop_or_uninstall_and_nothing_moves(store_path: Path, bridge_spy) -> None:
    _install(USER_A)
    before = json.dumps(_records(), sort_keys=True)

    b = _client(USER_B)
    dis = b.post("/api/mcp/store/git/disable")
    un = b.post("/api/mcp/store/git/uninstall")
    en = b.post("/api/mcp/store/git/enable")

    assert dis.status_code == 403, dis.text
    assert un.status_code == 403, un.text
    assert en.status_code == 403, en.text
    # 副作用没发生:记录逐字段未变、bridge 一次都没被叫
    assert json.dumps(_records(), sort_keys=True) == before
    assert bridge_spy["remove"] == []
    assert bridge_spy["add"] == ["git"]  # 只有 A 安装那一次


def test_owner_can_still_toggle(store_path: Path, bridge_spy) -> None:
    """正向对照:同主体启停照旧可用,否则本票只是把功能改坏了。"""
    _install(USER_A)
    bridge_spy["add"].clear()
    a = _client(USER_A)
    assert a.post("/api/mcp/store/git/disable").status_code == 200
    assert a.post("/api/mcp/store/git/enable").status_code == 200
    assert [r["enabled"] for r in _records()] == [True]
    assert bridge_spy["remove"] == ["git"]


def test_disabled_record_of_another_user_cannot_be_overwritten(
    store_path: Path, bridge_spy
) -> None:
    """install 撞到别人那条 disabled 记录 ⇒ 403,不得把别人的 env/args 整条换掉。"""
    _install(USER_A)
    a = _client(USER_A)
    assert a.post("/api/mcp/store/git/disable").status_code == 200
    before = json.dumps(_records(), sort_keys=True)

    b = _client(USER_B)
    r = b.post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})

    assert r.status_code == 403, r.text
    assert json.dumps(_records(), sort_keys=True) == before


def test_ownerless_record_keeps_pre_change_behavior(store_path: Path, bridge_spy) -> None:
    """存量无属主记录 = 回退档(维持改动前行为),这条断言防它被悄悄当"已收紧"。"""
    mcp_store.save_installed(
        {
            "name": "legacy",
            "key": "legacy",
            "transport": "stdio",
            "command": "echo",
            "args": [],
            "env": {},
            "installed": True,
            "enabled": True,
            "installed_at": mcp_store.now_iso(),
            "tool_count": 0,
            "last_error": "",
        }
    )
    assert mcp_store.owner_of("legacy") == ""
    assert mcp_store.can_mutate("legacy", USER_B) is True
    assert mcp_store.can_mutate("no-such-server", USER_B) is False

    b = _client(USER_B)
    assert b.post("/api/mcp/store/legacy/disable").status_code == 200


def test_two_users_each_see_their_own_owner_value(store_path: Path, bridge_spy) -> None:
    """同名 key 在两个主体下不能互相覆盖(安装面按 name 唯一 ⇒ 第二人只能 403/409)。"""
    _install(USER_A)
    b = _client(USER_B)
    r = b.post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})
    assert r.status_code == 403, r.text
    recs = _records()
    assert len(recs) == 1
    assert recs[0][OWNER_FIELD] == USER_A
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
