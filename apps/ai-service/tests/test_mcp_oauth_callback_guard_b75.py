# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b75 批吸收测试:MCP OAuth localhost 回调守卫状态机(b75-4#1)+ 凭据文件守卫(b75-4#2)。

面向 app/services/mcp_oauth.py 本批新增机制(上游 zcode auth/localhost-callback.ts:62-100
与 auth/shared-credentials.ts backupCorruptFile 的降维吸收):

b75-4#1 回调守卫状态机(MCPLocalhostOAuthCallbackServer):
- 伪造陌生 state 回调 → HTTP 400,连接不关闭、授权事务继续等待真回调;
- provider 回 error=access_denied → 立即失败,稳定错误码 MCP_OAUTH_CALLBACK_DENIED;
- state 匹配但 code/error 双缺 → 立即结构化失败,不消耗授权窗口;
- 路径不匹配 → 404 继续监听;结算后迟到回调不改写结果;close() 未结算也结构化收口;
- set_authorization_code state 会话绑定:不匹配 state 拒绝注入且不消耗事务。

b75-4#2 凭据文件守卫(观察票小实现):
- 损坏持久化文件先备份(.corrupt-<ts>)留证再降级,绝不静默覆盖重置;
- 写入 tmp 名唯一(pid+随机),不再共用固定 .json.tmp。

隔离策略:守卫服务绑定 127.0.0.1 随机端口,httpx 直连,不发任何真实外网请求;
MCPOAuthClient 沿用 test_mcp_oauth.py 的 patch httpx.AsyncClient 手法。
"""

from __future__ import annotations

import asyncio
import urllib.parse
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.mcp_oauth import (
    MCP_OAUTH_CALLBACK_DENIED_ERROR_CODE,
    MCPLocalhostOAuthCallbackServer,
    MCPOAuthCallback,
    MCPOAuthCallbackDeniedError,
    MCPOAuthClient,
    MCPOAuthConfig,
    MCPOAuthError,
    MCPOAuthToken,
    _load_persisted_token,
    _persist_token,
)

_STATE = "state-b75-guard"
_CALLBACK_PATH = "/callback"


def _resp(status: int = 200, payload: dict | None = None) -> MagicMock:
    """构造伪 httpx 响应(与 test_mcp_oauth.py 同手法)。"""
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload if payload is not None else {}
    r.text = ""
    return r


@pytest.fixture
async def guard_server():
    """启动守卫监听 + loopback httpx 客户端;测试结束确保关服。"""
    server = MCPLocalhostOAuthCallbackServer(callback_path=_CALLBACK_PATH, state=_STATE)
    base_url = await server.start()
    # httpx base_url 是拼接语义(base+相对路径),这里只需 origin;守卫回调 URL 含路径
    origin = base_url[: -len(_CALLBACK_PATH)]
    async with httpx.AsyncClient(base_url=origin, timeout=5.0, trust_env=False) as client:
        yield server, client
    await server.close()


# ---------------------------------------------------------------------------
# b75-4#1:守卫状态机
# ---------------------------------------------------------------------------


async def test_unknown_state_returns_400_and_transaction_survives(guard_server):
    """伪造陌生 state 回调 → 400;事务不被 kill,真回调依旧成功结算。"""
    server, client = guard_server
    forged = await client.get(
        _CALLBACK_PATH, params={"state": "forged-by-prefetch", "code": "evil"}
    )
    assert forged.status_code == 400
    # 判据①:连接不关闭、事务继续等待 —— 随后到达的正确回调仍能结算
    real = await client.get(_CALLBACK_PATH, params={"state": _STATE, "code": "real-code"})
    assert real.status_code == 200
    callback: MCPOAuthCallback = await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    assert callback.code == "real-code"
    assert callback.url.endswith(f"{_CALLBACK_PATH}?state={_STATE}&code=real-code")


async def test_access_denied_fails_immediately_with_stable_code(guard_server):
    """provider 回 error=access_denied → 立即失败,稳定错误码不再等窗口超时。"""
    server, client = guard_server
    r = await client.get(
        _CALLBACK_PATH,
        params={"state": _STATE, "error": "access_denied", "error_description": "user said no"},
    )
    assert r.status_code == 400
    with pytest.raises(MCPOAuthCallbackDeniedError) as err:
        await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    assert err.value.code == MCP_OAUTH_CALLBACK_DENIED_ERROR_CODE
    assert err.value.oauth_error == "access_denied"
    assert err.value.oauth_error_description == "user said no"


async def test_missing_code_and_error_fails_immediately(guard_server):
    """state 匹配但 code/error 双缺 → 立即结构化失败,不消耗授权窗口。"""
    server, client = guard_server
    r = await client.get(_CALLBACK_PATH, params={"state": _STATE})
    assert r.status_code == 400
    with pytest.raises(MCPOAuthError) as err:
        await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    # 结构化区分:畸形回调不是"用户拒绝"错误码
    assert not isinstance(err.value, MCPOAuthCallbackDeniedError)
    assert "missing an authorization code" in str(err.value)


async def test_path_mismatch_returns_404_and_keeps_listening(guard_server):
    """路径不匹配 → 404 继续监听,后续正确回调不受影响。"""
    server, client = guard_server
    r = await client.get("/elsewhere", params={"state": _STATE, "code": "c1"})
    assert r.status_code == 404
    r2 = await client.get(_CALLBACK_PATH, params={"state": _STATE, "code": "c2"})
    assert r2.status_code == 200
    callback = await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    assert callback.code == "c2"


async def test_settled_transaction_ignores_late_callbacks(guard_server):
    """结算后迟到的重复回调:仍获 200 响应,但不改写结算结果(先到先得)。"""
    server, client = guard_server
    await client.get(_CALLBACK_PATH, params={"state": _STATE, "code": "first"})
    callback = await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    assert callback.code == "first"
    r = await client.get(_CALLBACK_PATH, params={"state": _STATE, "code": "second"})
    assert r.status_code == 200
    again = await asyncio.wait_for(server.wait_for_callback(), timeout=5)
    assert again.code == "first"


async def test_close_settles_pending_waiter_structured():
    """close() 时未结算 → 等待方收到结构化失败,不永久悬挂。"""
    server = MCPLocalhostOAuthCallbackServer(callback_path=_CALLBACK_PATH, state=_STATE)
    await server.start()
    waiter = asyncio.ensure_future(server.wait_for_callback())
    await asyncio.sleep(0.05)
    await server.close()
    with pytest.raises(MCPOAuthError):
        await asyncio.wait_for(waiter, timeout=5)


async def test_authcode_alias_param_accepted():
    """上游兼容别名 authCode 与 code 等价。"""
    server = MCPLocalhostOAuthCallbackServer(callback_path=_CALLBACK_PATH, state=_STATE)
    base_url = await server.start()
    try:
        async with httpx.AsyncClient(base_url=base_url[: -len(_CALLBACK_PATH)], timeout=5.0, trust_env=False) as client:
            r = await client.get(_CALLBACK_PATH, params={"state": _STATE, "authCode": "ac-1"})
            assert r.status_code == 200
        callback = await asyncio.wait_for(server.wait_for_callback(), timeout=5)
        assert callback.code == "ac-1"
    finally:
        await server.close()


async def test_set_authorization_code_state_binding():
    """state 会话绑定:不匹配 state 拒绝注入且不消耗事务;真 state/缺省注入放行。"""
    http = MagicMock()
    http.get = AsyncMock(
        return_value=_resp(200, {"authorization_endpoint": "http://auth/authorize"})
    )
    http.post = AsyncMock(return_value=_resp(404))
    http.aclose = AsyncMock()
    with patch("app.services.mcp_oauth.httpx.AsyncClient", return_value=http):
        client = MCPOAuthClient(
            MCPOAuthConfig(
                grant_type="authorization_code",
                client_id="client-1",
                client_secret="secret-1",
                auth_server_url="http://auth/metadata",
                redirect_uri="http://127.0.0.1:0/callback",
            )
        )
    url = await client.build_authorization_url_async()
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    bound_state = query["state"][0]
    # 伪造/串线 state:拒绝注入,事务保持(未消耗)
    with pytest.raises(MCPOAuthError):
        client.set_authorization_code("evil-code", state="forged-state")
    assert client._authorization_code is None
    # 真 state:放行
    client.set_authorization_code("good-code", state=bound_state)
    assert client._authorization_code == "good-code"
    # state 缺省:保持旧宽松行为(兼容既有调用方)
    client.set_authorization_code("legacy-code")
    assert client._authorization_code == "legacy-code"


# ---------------------------------------------------------------------------
# b75-4#2:凭据文件守卫(观察票小实现)
# ---------------------------------------------------------------------------


def test_corrupt_persist_file_backed_up_before_discard(tmp_path):
    """损坏持久化文件先备份(.corrupt-<ts>)留证再降级,原位置腾空。"""
    persist = tmp_path / "token.json"
    persist.write_text("definitely-not-a-token", encoding="utf-8")
    assert _load_persisted_token(MCPOAuthConfig(persist_path=str(persist))) is None
    backups = list(tmp_path.glob("token.json.corrupt-*"))
    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == "definitely-not-a-token"
    # 原位置已腾空:后续成功写入从干净状态开始,取证现场保留在备份里
    assert not persist.exists()


def test_intact_persist_file_not_backed_up(tmp_path):
    """完好文件正常读取,不产生备份。"""
    persist = tmp_path / "token.json"
    persist.write_text('{"access_token": "t"}', encoding="utf-8")
    token = _load_persisted_token(MCPOAuthConfig(persist_path=str(persist)))
    assert token is not None
    assert token.access_token == "t"
    assert list(tmp_path.glob("*.corrupt-*")) == []


def test_persist_write_unique_tmp_and_replace(tmp_path):
    """写入走唯一 tmp 名 + 原子 replace:tmp 不残留,最后一次写胜出。"""
    persist = tmp_path / "token.json"
    _persist_token(MCPOAuthConfig(persist_path=str(persist)), MCPOAuthToken(access_token="t1"))
    assert persist.exists()
    assert list(tmp_path.glob("*.tmp-*")) == []
    # 并发写不再共用固定 .json.tmp:连续两次写均成功,最终内容为最后一次
    _persist_token(MCPOAuthConfig(persist_path=str(persist)), MCPOAuthToken(access_token="t2"))
    import json as _json

    assert _json.loads(persist.read_text(encoding="utf-8"))["access_token"] == "t2"
    assert list(tmp_path.glob("*.tmp-*")) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
