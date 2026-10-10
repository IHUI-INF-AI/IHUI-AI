# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器会话的属主过滤(2026-09-27 批 65 / G-258 B 组第一票)。

病灶实测口径来自 ast 普查(`scripts/audit_principal_consumed.py`):`browser_hub` 十个
HTTP 端点 + 一条 WS 全部 `Depends(get_current_user_id)` 拿到身份却**一次都没用它**,
而 `BrowserHub._sessions` 只按 `session_id` 键、`BrowserSession` 根本没有 owner 字段 ——
于是任何持有效令牌的人可以:读别人的 cookies(`:167`)、拿别人的页面截图(`:191`)、
关掉别人的会话,以及经 WS `execute_js` 在别人**已登录**的页面里执行任意脚本。

刻意不起真 Chromium(那属端到端一票):这里全部按**内存里的会话表**判行为,
再加两条源码级反向锁 —— 「payload→主体的抽取规则只许有一份」与「幂等复用必须同属主」。
"""

from __future__ import annotations

import inspect
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.core.jwt_auth import principal_from_payload
from app.services.browser_hub import BrowserHub, BrowserSession, _same_owner

AI_SERVICE = Path(__file__).resolve().parents[1]


def _session(session_id: str, owner: str | None) -> BrowserSession:
    """构造一个**不触碰 Playwright** 的会话对象(__init__ 只存字段)。"""
    return BrowserSession(
        session_id=session_id,
        context=None,  # type: ignore[arg-type]
        page=None,  # type: ignore[arg-type]
        executor=None,  # type: ignore[arg-type]
        main_loop=None,  # type: ignore[arg-type]
        owner_user_id=owner,
    )


# ---------------------------------------------------------------------------
# 1. 归属谓词的三态(判序不是 `==`,与 session_store.owner_scoped_allows 同形)
# ---------------------------------------------------------------------------


def test_same_owner_three_arms() -> None:
    # caller 为 None = 系统级调用(内部链路无令牌主体)⇒ 不设过滤
    assert _same_owner("u1", None) is True
    assert _same_owner(None, None) is True
    # 已登录调用方**看不见**没盖章的会话 —— 否则任何一次内部创建都等于向全站开放
    assert _same_owner(None, "u1") is False
    # 有值时逐字等值才算同一人
    assert _same_owner("u1", "u1") is True
    assert _same_owner("u1", "u2") is False


def test_principal_from_payload_arms() -> None:
    assert principal_from_payload({"sub": "u1", "userId": "legacy"}) == "u1"
    assert principal_from_payload({"userId": "legacy"}) == "legacy"
    assert principal_from_payload(None) is None
    assert principal_from_payload({}) is None
    # 非字符串主体(数字 sub)也要能当身份用,不能因类型就变 None
    assert principal_from_payload({"sub": 42}) == "42"


def test_middleware_shares_the_single_extraction() -> None:
    """「两处算同一件事必漂移」的锁:中间件不得再自己抄一份 sub/userId 规则。"""
    from app.core import jwt_auth

    src = inspect.getsource(jwt_auth.JWTAuthMiddleware)
    assert "principal_from_payload(payload)" in src, src
    assert 'payload.get("sub")' not in src, "中间件里又出现第二份抽取规则"


# ---------------------------------------------------------------------------
# 2. 读取面按属主过滤:别人的会话与"不存在"同形
# ---------------------------------------------------------------------------


def test_get_and_list_are_owner_scoped() -> None:
    hub = BrowserHub()
    hub._sessions = {"s1": _session("s1", "alice"), "s2": _session("s2", "bob"), "s3": _session("s3", None)}

    assert hub.get_session("s1", "alice") is not None
    assert hub.get_session("s1", "bob") is None, "跨属主读取必须与不存在同形"
    assert hub.get_session("s3", "alice") is None, "未盖章会话对已登录用户不可见"
    assert hub.get_session("s3", None) is not None, "系统级调用不设过滤"

    assert hub.list_sessions("alice") == ["s1"]
    assert sorted(hub.list_sessions()) == ["s1", "s2", "s3"]
    # 计数与列表同一个谓词(旧写法 list 全量、count 也全量 ⇒ 探测他人会话存在性)
    assert hub.session_count_for("alice") == 1
    assert hub.session_count == 3


@pytest.mark.asyncio
async def test_close_and_recreate_refuse_foreign_sessions() -> None:
    hub = BrowserHub()
    hub._sessions = {"s1": _session("s1", "alice")}
    hub._close_session_internal = AsyncMock(return_value=True)  # type: ignore[method-assign]

    assert await hub.close_session("s1", "bob") is False
    hub._close_session_internal.assert_not_called()
    assert await hub.close_session("s1", "alice") is True
    # recreate 的属主判据走同一条:跨属主 ⇒ None(不返回他人新会话)
    assert await hub.recreate_session("s1", "bob") is None


# ---------------------------------------------------------------------------
# 3. 幂等去重不得跨属主复用(反向锁:这条判据必须真在 create_session 里)
# ---------------------------------------------------------------------------


def test_dedup_window_is_owner_guarded() -> None:
    """不起真 Chromium,故判**结构**:复用分支必须先过 `_same_owner` 才 return。

    为什么只能这么判:`create_session` 第一步就 `await self.start()` 拉 Chromium,
    在单测里起真浏览器属另一票。而这一格的故障形态是"两个人同时打开同一个平台
    登录页 ⇒ 第二个人拿到第一个人的 context(cookies + 登录态)",
    所以判据的存在性本身就是回归面。
    """
    src = inspect.getsource(BrowserHub.create_session)
    assert "if _same_owner(candidate.owner_user_id, owner_user_id):" in src, src
    assert "return self._sessions[sid]" not in src, "无条件复用 = 跨属主串会话"


def test_router_endpoints_pass_the_principal() -> None:
    """十个 HTTP 端点 + WS 的出口形状锁:每个 handler 都要把身份喂进归属过滤。"""
    src = (AI_SERVICE / "app" / "routers" / "browser_hub.py").read_text(encoding="utf-8")
    assert src.count("hub.get_session(session_id, user_id)") == 7, src.count(
        "hub.get_session(session_id, user_id)"
    )
    assert "hub.get_session(session_id, ws_user_id)" in src
    assert "ws_user_id = principal_from_payload(payload)" in src
    assert "owner_user_id=user_id," in src, "create_session 未盖章"
    assert "hub.list_sessions(user_id)" in src and "hub.session_count_for(user_id)" in src
    # 未过滤的旧调用形态一律不得残留
    assert "hub.get_session(session_id)" not in src
    assert "hub.list_sessions()" not in src


def test_scan_login_sessions_are_owner_stamped() -> None:
    """外部 Chrome 带的是**用户自己 profile 的登录态副本**,更得盖章。"""
    svc = (AI_SERVICE / "app" / "services" / "scan_login.py").read_text(encoding="utf-8")
    rtr = (AI_SERVICE / "app" / "routers" / "scan_login.py").read_text(encoding="utf-8")
    assert "hub.get_session(session_id, user_id)" in svc
    assert "hub.launch_external_chrome(\n            config[\"login_url\"], owner_user_id=caller_user_id" in rtr
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
