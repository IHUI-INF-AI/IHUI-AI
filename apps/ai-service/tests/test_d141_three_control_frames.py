# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D141 控制帧补齐票 —— `reload_plugins` / `refresh_memory` / `mcp_clear_auth` 三帧服务端判定。

这三帧在 D141 正本里的定性口径统一为「**宿主显式调用 + 必须回报结果**」——
即判据不是「后台会不会自动做」,而是「调用方拿不拿得到这次动作的结果」。据此本文件
对三帧各自钉死四件事,顺序不能换:

**reload_plugins**
1. 回包必须带**重载后的完整命令列表**(竞品 `replaceLatestCommands(e.commands)` 的等价物)
   —— 只回「已重载」等于把静默失败包装成成功态;
2. 强制位 `force` 必须**真的透传**到 `skill_registry.reload`(用户手改 SKILL.md 后 mtime
   可能不变,退化为增量就会把「改了没生效」报成「没有变化」);
3. 技能差额(added/removed/changed)必须原样透出;
4. 任何异常内部降级为 `{"reloaded": False, "error": ...}`,挂在帧处理器上**绝不向上抛**。

**refresh_memory**
5. 成功态必须把**差额**算出来(added/removed/changed/unchanged + 刷新前后总数);
6. **读失败 ≠ 空**(G-748 同型口径):重扫失败时保留原内存态 + 带 error + loadState,
   绝不把「读不到」报成「没有记忆」;
7. 显式刷新必须**绕过**懒加载短路与退避窗口,否则调用方在退避期内会拿到「没刷新」的假象;
8. 异常内部降级,不炸引擎。

**mcp_clear_auth**
9. 按 serverName **逐个点名**清除(没有"全清"出口);
10. 越权 ⇒ 403 且**副作用为零** —— 只断言状态码会放过「先清再报 403」这种实现;
11. 不存在 ⇒ 404(与外部 server 族同形,不是伪装成别的);
12. 边界如实点名:`no_oauth`(这台压根没走 OAuth 通道,不是错误)与
    `external_oauth_client`(外部注入的 client 只清内存,持久化文件不归本 client 管)。
"""

from __future__ import annotations

import time
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import require_request_user_id
from app.routers import mcp as mcp_router
from app.services import skills as skills_module
from app.services.mcp_client import MCPClient, MCPClientConfig, MCPClientManager
from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig, MCPOAuthToken
from app.services.memory_facade import memory_refresh
from app.services.meta_learner import meta_learner
from app.services.slash_commands import slash_command_registry

USER_A = "user-a"
USER_B = "user-b"


# =============================================================================
# reload_plugins —— 服务端
# =============================================================================


def test_reload_returns_full_command_list_for_host_to_replace():
    """回包必须含重载后的完整命令列表 —— 竞品 `replaceLatestCommands` 的等价物。

    判据:调用方拿到 `commands` 就能整表替换宿主的命令集。少了这段,这帧就退化成
    「点了没反应,但服务端说成功了」。
    """
    result = slash_command_registry.reload(force=True)

    assert result["reloaded"] is True
    commands = result["commands"]
    assert isinstance(commands, list) and commands, "命令列表不能为空"
    for c in commands:
        assert set(c) >= {"name", "description"}, f"命令项字段不全: {c}"
        assert c["name"] and isinstance(c["name"], str)
        assert isinstance(c["description"], str)
    # commandCount 必须与列表真长一致(手写数字是一次两次就漂的典型)
    assert result["commandCount"] == len(commands)
    assert result["forced"] is True


def test_reload_force_flag_reaches_the_scan_source(monkeypatch: pytest.MonkeyPatch):
    """强制位必须真的透传到 `skill_registry.reload` —— 否则 force 只是回包里的装饰品。"""
    calls: list[bool] = []

    diff = {
        "total": 3,
        "auto": 2,
        "added": ["a"],
        "removed": [],
        "changed": ["b"],
        "unchanged": 1,
        "lastReload": "now",
        "forced": True,
        "sourceDirs": [],
    }

    def _spy(*, force: bool = False) -> dict[str, Any]:
        calls.append(force)
        return dict(diff, forced=force)

    monkeypatch.setattr(skills_module.skill_registry, "reload", _spy)

    forced = slash_command_registry.reload(force=True)
    assert calls == [True]
    assert forced["forced"] is True

    monkeypatch.setattr(skills_module.skill_registry, "reload", _spy)
    incremental = slash_command_registry.reload(force=False)
    assert calls == [True, False]
    assert incremental["forced"] is False


def test_reload_passthroughs_skill_diff(monkeypatch: pytest.MonkeyPatch):
    """技能差额必须原样透出 —— 「插件变了什么」要可见。"""
    diff = {
        "total": 5,
        "auto": 4,
        "added": ["new-skill"],
        "removed": ["gone-skill"],
        "changed": ["tweaked-skill"],
        "unchanged": 1,
        "lastReload": "2026-10-28T00:00:00",
        "forced": True,
        "sourceDirs": ["skills/"],
    }
    monkeypatch.setattr(skills_module.skill_registry, "reload", lambda *, force=False: diff)

    result = slash_command_registry.reload(force=True)
    assert result["added"] == ["new-skill"]
    assert result["removed"] == ["gone-skill"]
    assert result["changed"] == ["tweaked-skill"]
    assert result["lastReload"] == "2026-10-28T00:00:00"
    assert result["skills"] == len(result["skillNames"])
    assert result["skillNames"] == sorted(result["skillNames"])


def test_reload_never_raises(monkeypatch: pytest.MonkeyPatch):
    """重载炸了必须内部降级 —— 帧挂在宿主调用链上,向上抛会整条链崩。"""

    def _boom(*, force: bool = False) -> dict[str, Any]:
        raise RuntimeError("SKILL.md 目录权限炸了")

    monkeypatch.setattr(skills_module.skill_registry, "reload", _boom)

    result = slash_command_registry.reload(force=True)
    assert result["reloaded"] is False
    assert "SKILL.md" in result["error"]


@pytest.mark.asyncio
async def test_reload_endpoint_reports_commands():
    """端点层:POST /mcp/slash-commands/reload 必须回得到同一份完整命令列表。"""
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as cli:
        res = await cli.post("/api/mcp/slash-commands/reload", json={"force": True})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["reloaded"] is True
        assert body["commandCount"] == len(body["commands"])
        assert body["forced"] is True

        # 不传 body(宿主持平发起的裸帧也要能进)⇒ 默认 force=true
        bare = await cli.post("/api/mcp/slash-commands/reload")
        assert bare.status_code == 200, bare.text
        assert bare.json()["forced"] is True


# =============================================================================
# refresh_memory —— 服务端
# =============================================================================


@pytest.fixture
def memory_state():
    """隔离 meta_learner 单例的内存态 —— 它是全局共享的,不还原会污染后面所有用例。"""
    saved_lessons = dict(meta_learner._lessons)
    saved_index = dict(meta_learner._title_index)
    saved_loaded = meta_learner._loaded
    saved_failures = meta_learner._load_failures
    saved_next = meta_learner._load_next_attempt_s
    saved_give_up = meta_learner._load_give_up_logged
    yield
    meta_learner._lessons = saved_lessons
    meta_learner._title_index = saved_index
    meta_learner._loaded = saved_loaded
    meta_learner._load_failures = saved_failures
    meta_learner._load_next_attempt_s = saved_next
    meta_learner._load_give_up_logged = saved_give_up


def _seed(*lessons: tuple[str, str, str]) -> None:
    """写入 lesson:(id, title, updatedAt)。"""
    meta_learner._lessons = {
        lid: {"id": lid, "title": title, "updatedAt": updated}
        for lid, title, updated in lessons
    }


@pytest.mark.asyncio
async def test_refresh_computes_full_diff(memory_state, monkeypatch: pytest.MonkeyPatch):
    """成功刷新必须把差额算出来 —— 「刷新过了」不等于「告诉你动了什么」。"""
    _seed(("l1", "标题一", "t1"), ("l2", "标题二", "t2"))

    async def _fake_load(limit: int = 500) -> tuple[bool, int]:
        # 模拟持久化源在这段时间里:l1 被改标题、l2 被删掉、l3 新增
        _seed(("l1", "标题一改", "t1-new"), ("l3", "标题三", "t3"))
        return True, len(meta_learner._lessons)

    monkeypatch.setattr(meta_learner, "_try_load_all_lessons", _fake_load)

    result = await memory_refresh()

    assert result["refreshed"] is True
    assert result["before"] == 2
    assert result["totalLessons"] == 2
    assert result["added"] == ["l3"]
    assert result["removed"] == ["l2"]
    assert result["changed"] == ["l1"]
    assert result["unchanged"] == 0
    assert result["loadState"] == "loaded"


@pytest.mark.asyncio
async def test_refresh_read_failure_is_not_empty(memory_state, monkeypatch: pytest.MonkeyPatch):
    """读失败 ≠ 空(G-748 同型口径,不得改回)。

    断言两件事同时成立:① 明确报 refreshed:false + error;② **原内存态没被冲掉**
    —— 一次瞬时 DB 故障把已缓存的记忆清成空,比不刷新还糟。
    """
    _seed(("l1", "标题一", "t1"), ("l2", "标题二", "t2"))

    async def _fail(limit: int = 500) -> tuple[bool, int]:
        return False, 0

    monkeypatch.setattr(meta_learner, "_try_load_all_lessons", _fail)

    result = await memory_refresh()

    assert result["refreshed"] is False
    assert result["error"], "失败必须带可见原因,不许静默吞掉"
    assert result["totalLessons"] == 2, "读失败绝不能被报成「没有记忆」"
    assert result["before"] == 2
    assert len(meta_learner._lessons) == 2, "原内存态必须保留"
    assert result["loadState"] == "retry_backoff"


@pytest.mark.asyncio
async def test_refresh_bypasses_backoff_window(memory_state, monkeypatch: pytest.MonkeyPatch):
    """显式刷新必须绕过退避窗口 —— 否则用户在退避期内点刷新,拿到的是「没刷新」的假象。"""
    _seed(("l1", "标题一", "t1"))
    # 制造"已加载 + 正处在退避窗口内"的自动路径状态
    meta_learner._loaded = True
    meta_learner._load_next_attempt_s = time.monotonic() + 3600

    called = 0

    async def _spy(limit: int = 500) -> tuple[bool, int]:
        nonlocal called
        called += 1
        return True, len(meta_learner._lessons)

    monkeypatch.setattr(meta_learner, "_try_load_all_lessons", _spy)

    result = await memory_refresh()

    assert called == 1, "退避窗口内的显式刷新也必须真的再打一次持久化源"
    assert result["refreshed"] is True
    assert result["loadState"] == "loaded"


@pytest.mark.asyncio
async def test_refresh_never_raises(memory_state, monkeypatch: pytest.MonkeyPatch):
    """重扫炸了必须内部降级 —— 本函数挂在 RPC 帧处理器上。"""
    _seed(("l1", "标题一", "t1"))

    async def _boom(limit: int = 500) -> tuple[bool, int]:
        raise RuntimeError("DB 连接池炸了")

    monkeypatch.setattr(meta_learner, "_try_load_all_lessons", _boom)

    result = await memory_refresh()
    assert result["refreshed"] is False
    assert "DB" in result["error"]


# =============================================================================
# mcp_clear_auth —— 服务端(逐台点名 + 越权零副作用)
# =============================================================================


def _cfg(name: str, *, oauth: Any = None) -> MCPClientConfig:
    return MCPClientConfig(name=name, transport="stdio", command="echo", oauth=oauth)


class _FakeOAuth:
    """替身:只记录它有没有被调用,返回固定结果。"""

    def __init__(self, result: dict[str, Any] | None = None) -> None:
        self.calls = 0
        self.result = result or {
            "cleared": True,
            "hadToken": True,
            "persistFileRemoved": True,
            "error": None,
        }

    def clear_auth(self) -> dict[str, Any]:
        self.calls += 1
        return dict(self.result)


def _app_for(manager: MCPClientManager, owner: str) -> FastAPI:
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    mcp_router.get_mcp_client_manager = lambda: manager  # type: ignore[method-assign]
    app.dependency_overrides[require_request_user_id] = lambda: owner
    return app


@pytest.fixture
def manager() -> MCPClientManager:
    return MCPClientManager()


@pytest.mark.asyncio
async def test_owner_can_clear_auth_of_own_server(manager: MCPClientManager):
    """正向对照:自己的 server 点名清除 ⇒ 真清了,且回包带 server 名以便调用方确认对象。"""
    fake = _FakeOAuth()
    client = MCPClient(_cfg("svr1"))
    client._oauth_client = fake  # type: ignore[assignment]
    client._oauth_client_owned = True
    manager._clients["svr1"] = client
    manager._owners["svr1"] = USER_A

    async with AsyncClient(
        transport=ASGITransport(app=_app_for(manager, USER_A)), base_url="http://test"
    ) as cli:
        res = await cli.post("/api/mcp/external/servers/svr1/clear-auth")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["server"] == "svr1"
        assert body["ok"] is True
        assert body["cleared"] is True
        assert body["hadToken"] is True
        assert fake.calls == 1


@pytest.mark.asyncio
async def test_cross_owner_clear_auth_is_403_with_zero_side_effect(manager: MCPClientManager):
    """越权必须 403 且**副作用为零** —— 只断言状态码会放过「先清了再报 403」的实现。"""
    fake = _FakeOAuth()
    client = MCPClient(_cfg("svr1"))
    client._oauth_client = fake  # type: ignore[assignment]
    client._oauth_client_owned = True
    manager._clients["svr1"] = client
    manager._owners["svr1"] = USER_A

    async with AsyncClient(
        transport=ASGITransport(app=_app_for(manager, USER_B)), base_url="http://test"
    ) as cli:
        res = await cli.post("/api/mcp/external/servers/svr1/clear-auth")
        assert res.status_code == 403, res.text

    assert fake.calls == 0, "越权调用一次都没碰到底层凭据"
    assert manager.get_client("svr1") is not None, "越权清除没有把注册记录冲掉"


@pytest.mark.asyncio
async def test_deployment_level_server_clear_auth_is_403_with_zero_side_effect(
    manager: MCPClientManager,
):
    """部署级(owner 为空串):谁都看得见,谁都撤不了它的凭据。"""
    fake = _FakeOAuth()
    client = MCPClient(_cfg("platform-svr"))
    client._oauth_client = fake  # type: ignore[assignment]
    client._oauth_client_owned = True
    manager._clients["platform-svr"] = client
    manager._owners["platform-svr"] = ""

    async with AsyncClient(
        transport=ASGITransport(app=_app_for(manager, USER_A)), base_url="http://test"
    ) as cli:
        res = await cli.post("/api/mcp/external/servers/platform-svr/clear-auth")
        assert res.status_code == 403, res.text

    assert fake.calls == 0


@pytest.mark.asyncio
async def test_missing_server_is_404_not_anything_else(manager: MCPClientManager):
    """不存在的 server ⇒ 404(与外部 server 族同形)。"""
    async with AsyncClient(
        transport=ASGITransport(app=_app_for(manager, USER_A)), base_url="http://test"
    ) as cli:
        res = await cli.post("/api/mcp/external/servers/nope/clear-auth")
        assert res.status_code == 404, res.text
        assert "nope" in res.json()["error"]


def test_client_without_oauth_reports_no_oauth_not_error():
    """没走 OAuth 通道的 server ⇒ cleared:false + reason `no_oauth`(不是错误)。"""
    client = MCPClient(_cfg("plain"))
    client._oauth_client = None

    result = client.clear_oauth_auth()
    assert result["cleared"] is False
    assert result["reason"] == "no_oauth"
    assert result["hadToken"] is False
    assert result["error"] is None


def test_externally_owned_oauth_client_only_clears_memory():
    """外部注入的 OAuth client ⇒ 只清内存,且**如实点名**持久化文件没被删。

    谎报 `persistFileRemoved:true` 会让调用方以为磁盘上那份也没了 —— 那份文件可能还
    在被它的持有者使用。
    """
    fake = _FakeOAuth({"cleared": True, "hadToken": True, "persistFileRemoved": True, "error": None})
    client = MCPClient(_cfg("svr-ext"))
    client._oauth_client = fake  # type: ignore[assignment]
    client._oauth_client_owned = False

    result = client.clear_oauth_auth()
    assert result["cleared"] is True
    assert result["persistFileRemoved"] is False
    assert result["reason"] == "external_oauth_client"
    assert fake.calls == 1


def test_oauth_clear_auth_wipes_memory_and_persist_file(tmp_path):
    """真实 MCPOAuthClient:内存 token + 一次性授权凭据 + 持久化文件都要清掉。"""
    persist = tmp_path / "token.json"
    persist.write_text("{}", encoding="utf-8")

    oc = MCPOAuthClient(MCPOAuthConfig(client_id="cid", token_url="http://local/token",
                                       persist_path=str(persist)))
    oc._token = MCPOAuthToken(access_token="at", refresh_token="rt")
    oc._authorization_code = "code-1"
    oc._code_verifier = "verifier-1"
    oc._state = "st"

    result = oc.clear_auth()

    assert result["cleared"] is True
    assert result["hadToken"] is True
    assert result["persistFileRemoved"] is True
    assert result["error"] is None
    # 清完即「未授权」:后续 get_token() 必须走一次新的授权流程,不许拿旧 token 复活
    assert oc._token is None
    assert oc._authorization_code is None
    assert oc._code_verifier is None
    assert oc._state == ""
    assert not persist.exists()
    # 不碰 client_secret / client_id —— 那些东西的持有者是 OAuth 服务端
    assert oc._config.client_id == "cid"
    assert oc._config.client_secret == ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
