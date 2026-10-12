# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_workbuddy 单元测试(httpx.MockTransport,不打真实网络)。

覆盖: uid 解析 / 过期解析(秒/毫秒/ISO)/ 错误分类 / 签到成功(credit+streak)/
已签幂等 10001 / 业务失败码 / 401/403 SessionDead / 429 / 5xx / 网络异常 /
非 JSON 响应 / 空 token / uid 缺失 / 余额查询(含字段缺失如实报错)。
"""

from __future__ import annotations

import base64
import json
import time

import httpx
import pytest

from app.services.checkin_workbuddy import (
    PATH_CHECKIN_STATUS,
    PATH_DAILY_CHECKIN,
    workbuddy_checkin_account,
    workbuddy_classify_error,
    workbuddy_device_map_uid,
    workbuddy_extract_uid,
    workbuddy_jwt_exp,
    workbuddy_query_credits,
    workbuddy_session_expiry,
)

UID = "14f939c3-889b-4ea2-88b7-ca4582f3b435"


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


def _b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_wb_jwt(uid: str = UID, exp_offset: float = 3600.0 * 24 * 30) -> str:
    """构造未签名的 WorkBuddy 测试 JWT(payload.sub = uid;exp 远期)。"""
    payload = {"sub": uid, "exp": int(time.time() + exp_offset)}
    return f"{_b64({'alg': 'RS256'})}.{_b64(payload)}.sig"


def make_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


@pytest.fixture
def jwt() -> str:
    return make_wb_jwt()


def _wb_response(code: int, msg: str = "", data: dict | None = None) -> dict:
    body: dict = {"code": code}
    if msg:
        body["msg"] = msg
    if data is not None:
        body["data"] = data
    return body


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


class TestUidParsing:
    def test_extract_uid_sub(self):
        assert workbuddy_extract_uid(make_wb_jwt()) == UID

    def test_extract_uid_fallback_keys(self):
        tok = f"x.{_b64({'uid': 'u-1'})}.sig"
        assert workbuddy_extract_uid(tok) == "u-1"

    def test_extract_uid_invalid(self):
        assert workbuddy_extract_uid("not-a-jwt") is None
        assert workbuddy_extract_uid("") is None

    def test_jwt_exp_future(self):
        exp_dt, remaining = workbuddy_jwt_exp(make_wb_jwt(exp_offset=3600))
        assert exp_dt is not None and remaining is not None
        assert 0 < remaining <= 1.1

    def test_jwt_exp_missing(self):
        assert workbuddy_jwt_exp(f"x.{_b64({'sub': 'u'})}.sig") == (None, None)

    def test_device_map_uid_priority(self):
        assert workbuddy_device_map_uid({"uid": "dm-1"}) == "dm-1"
        assert workbuddy_device_map_uid({"user_id": 42}) == "42"
        assert workbuddy_device_map_uid({"uid": "  "}) is None
        assert workbuddy_device_map_uid({}) is None


class TestExpiry:
    def test_epoch_seconds_form(self):
        future = time.time() + 3600
        exp_dt, remaining = workbuddy_session_expiry({"expires_at": future})
        assert exp_dt is not None and 0 < remaining <= 1.1

    def test_epoch_milliseconds_form(self):
        """auth.expiresAt 是 epoch 毫秒(2026-10-12 真机实证 1794225169853)。"""
        future_ms = int(time.time() * 1000) + 3600 * 1000
        exp_dt, remaining = workbuddy_session_expiry({"expiresAt": future_ms})
        assert exp_dt is not None and 0 < remaining <= 1.1

    def test_past_milliseconds_expired(self):
        past_ms = int(time.time() * 1000) - 3600 * 1000
        exp_dt, remaining = workbuddy_session_expiry({"expires_at": past_ms})
        assert exp_dt is not None and remaining < 0

    def test_iso_form(self):
        exp_dt, remaining = workbuddy_session_expiry(
            {"expires_at": "2099-01-01T00:00:00Z"}
        )
        assert exp_dt is not None and remaining > 0

    def test_missing_and_bad(self):
        assert workbuddy_session_expiry({}) == (None, None)
        assert workbuddy_session_expiry({"expires_at": "garbage"}) == (None, None)
        assert workbuddy_session_expiry({"expires_at": 0}) == (None, None)
        assert workbuddy_session_expiry({"expires_at": True}) == (None, None)


class TestClassify:
    def test_contract(self):
        assert workbuddy_classify_error(None) == ("Unknown", 0)
        assert workbuddy_classify_error(401) == ("SessionDead", -1)
        assert workbuddy_classify_error(403) == ("SessionDead", -1)
        assert workbuddy_classify_error(429) == ("SoftRate", 60)
        assert workbuddy_classify_error(500) == ("Server", 600)
        assert workbuddy_classify_error(400) == ("Client", 600)
        assert workbuddy_classify_error(200) == ("Unknown", 0)


# ---------------------------------------------------------------------------
# 签到流程
# ---------------------------------------------------------------------------


def _handler_ok():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "copilot.tencent.com"
        assert request.url.path == PATH_DAILY_CHECKIN
        assert request.headers["authorization"].startswith("Bearer ")
        assert json.loads(request.content) == {}
        return httpx.Response(200, json=_wb_response(0, data={"credit": 100, "streak_days": 5}))

    return handler


class TestCheckinFlow:
    @pytest.mark.asyncio
    async def test_claim_success(self, jwt):
        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(_handler_ok())
        )
        assert result["ok"] is True
        assert result["status"] == "ok"
        assert result["credits"] == 100
        assert result["credits_delta"] == 100
        assert result["code"] == 0
        assert "credit=100" in result["message"] and "streak_days=5" in result["message"]
        assert result["user_id"] == UID

    @pytest.mark.asyncio
    async def test_already_claimed_idempotent(self, jwt):
        """code=10001 幂等成功(上游 issue:先查状态再领不可靠,幂等兜底在此)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_wb_response(10001))

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is True
        assert result["status"] == "already"
        assert result["action"] == "skip_already"
        assert result["credits"] is None

    @pytest.mark.asyncio
    async def test_business_fail_code(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_wb_response(10002, msg="活动未开始"))

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["code"] == 10002
        assert "10002" in result["message"] and "活动未开始" in result["message"]
        assert result["classified_error"] is None

    @pytest.mark.asyncio
    async def test_401_session_dead(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"requestId": "401401401-uuid"})

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}

    @pytest.mark.asyncio
    async def test_403_session_dead(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, json={})

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["classified_error"]["type"] == "SessionDead"

    @pytest.mark.asyncio
    async def test_5xx_server_cooldown(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={})

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "Server", "cooldown_seconds": 600}

    @pytest.mark.asyncio
    async def test_network_error(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("boom")

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["message"] == "网络异常: ConnectError: boom"
        assert result["http_status"] is None

    @pytest.mark.asyncio
    async def test_non_json_response(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="<html>gateway</html>")

        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID}, client=make_client(handler)
        )
        assert result["ok"] is False
        assert "非 JSON" in result["message"]

    @pytest.mark.asyncio
    async def test_blank_token(self):
        result = await workbuddy_checkin_account("wb-1", "  ", {}, client=make_client(_handler_ok()))
        assert result["ok"] is False
        assert result["message"] == "未配置 token"

    @pytest.mark.asyncio
    async def test_uid_missing_rejected(self):
        """device_map.uid 缺失且 token 非 JWT → 明确报错(与 Qoder 引擎同语义)。"""
        result = await workbuddy_checkin_account(
            "wb-1", "opaque-token-123", {}, client=make_client(_handler_ok())
        )
        assert result["ok"] is False
        assert "无法解析账号 uid" in result["message"]

    @pytest.mark.asyncio
    async def test_expired_token_warning_not_blocking(self, jwt):
        """过期只告警不阻断:服务端幂等兜底,预检给人可读原因。"""
        expired = make_wb_jwt(exp_offset=-3600)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_wb_response(0, data={"credit": 100}))

        result = await workbuddy_checkin_account(
            "wb-1", expired, {"uid": UID}, client=make_client(handler)
        )
        assert result["warning"] is not None and "已过期" in result["warning"]

    @pytest.mark.asyncio
    async def test_device_map_expiry_warning(self, jwt):
        past_ms = int(time.time() * 1000) - 1000
        result = await workbuddy_checkin_account(
            "wb-1", jwt, {"uid": UID, "expires_at": past_ms}, client=make_client(_handler_ok())
        )
        assert result["warning"] is not None and "已过期" in result["warning"]


# ---------------------------------------------------------------------------
# 余额/状态查询
# ---------------------------------------------------------------------------


class TestQueryCredits:
    @pytest.mark.asyncio
    async def test_status_with_balance(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == PATH_CHECKIN_STATUS
            return httpx.Response(200, json={"code": 0, "data": {"remaining": 3200, "today_checked_in": True}})

        result = await workbuddy_query_credits(jwt, {"uid": UID}, client=make_client(handler))
        assert result == {"remaining": 3200, "error": None}

    @pytest.mark.asyncio
    async def test_status_without_balance_honest_error(self, jwt):
        """实测 status 可能只回 today_checked_in ⇒ 如实报错,不编造数值。"""
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"code": 0, "data": {"today_checked_in": True}})

        result = await workbuddy_query_credits(jwt, {"uid": UID}, client=make_client(handler))
        assert result["remaining"] is None
        assert result["error"] is not None and "余额" in result["error"]

    @pytest.mark.asyncio
    async def test_status_401(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={})

        result = await workbuddy_query_credits(jwt, {"uid": UID}, client=make_client(handler))
        assert result["remaining"] is None and "401" in result["error"]

    @pytest.mark.asyncio
    async def test_status_expired_session_shortcircuit(self, jwt):
        past_ms = int(time.time() * 1000) - 1000
        result = await workbuddy_query_credits(jwt, {"uid": UID, "expires_at": past_ms},
                                               client=make_client(_handler_ok()))
        assert result["remaining"] is None and "已过期" in result["error"]

    @pytest.mark.asyncio
    async def test_status_blank_token(self):
        result = await workbuddy_query_credits("", {}, client=make_client(_handler_ok()))
        assert result["remaining"] is None and result["error"] == "未配置 token"


# ---------------------------------------------------------------------------
# Web Cookie 模式(2026-10-12「网页登录自动添加」)
# ---------------------------------------------------------------------------


class TestWebMode:
    """device_map.login_type=="web":jwt 字段存 Cookie 串 → www.workbuddy.cn /v2 网关。"""

    COOKIE = "session_id=abc123; wb_uid=u-9"
    WEB_MAP = {"uid": UID, "login_type": "web"}

    @pytest.mark.asyncio
    async def test_web_checkin_uses_cookie_not_bearer(self):
        """web 模式必须带 Cookie 头打本域 /v2 端点,且不带 Authorization。"""
        seen: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["url"] = str(request.url)
            seen["cookie"] = request.headers.get("cookie")
            seen["auth"] = request.headers.get("authorization")
            return httpx.Response(200, json=_wb_response(0, data={"credit": 5, "streak_days": 3}))

        result = await workbuddy_checkin_account(
            "wb-web", self.COOKIE, dict(self.WEB_MAP), client=make_client(handler)
        )
        assert result["ok"] is True and result["status"] == "ok"
        assert result["credits_delta"] == 5
        assert seen["url"].startswith("https://www.workbuddy.cn/v2/billing/meter/daily-checkin")
        assert seen["cookie"] == self.COOKIE
        assert seen["auth"] is None

    @pytest.mark.asyncio
    async def test_web_already_10001_idempotent(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_wb_response(10001))

        result = await workbuddy_checkin_account(
            "wb-web", self.COOKIE, dict(self.WEB_MAP), client=make_client(handler)
        )
        assert result["ok"] is True and result["status"] == "already"

    @pytest.mark.asyncio
    async def test_web_401_session_dead_with_relogin_hint(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={})

        result = await workbuddy_checkin_account(
            "wb-web", self.COOKIE, dict(self.WEB_MAP), client=make_client(handler)
        )
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}
        assert "网页登录" in result["message"] and "401" in result["message"]

    @pytest.mark.asyncio
    async def test_web_uid_from_device_map_only(self):
        """web 模式 uid 只认 device_map(cookie 不是 JWT,解析不出 uid)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_wb_response(0, data={"credit": 1}))

        result = await workbuddy_checkin_account(
            "wb-web", self.COOKIE, {"login_type": "web"}, client=make_client(handler)
        )
        assert result["ok"] is False and "uid" in result["message"]

    @pytest.mark.asyncio
    async def test_web_query_credits(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200, json={"code": 0, "data": {"today_checked_in": True, "credit": 42}}
            )

        result = await workbuddy_query_credits(self.COOKIE, dict(self.WEB_MAP), client=make_client(handler))
        assert result == {"remaining": 42, "error": None}

    @pytest.mark.asyncio
    async def test_web_query_credits_401(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={})

        result = await workbuddy_query_credits(self.COOKIE, dict(self.WEB_MAP), client=make_client(handler))
        assert result["remaining"] is None and "网页登录" in result["error"]

    @pytest.mark.asyncio
    async def test_web_blank_cookie_message(self):
        result = await workbuddy_query_credits("", dict(self.WEB_MAP), client=make_client(_handler_ok()))
        assert result["remaining"] is None and "网页登录" in result["error"]

    def test_is_web_mode_case_insensitive(self):
        from app.services.checkin_workbuddy import workbuddy_is_web_mode

        assert workbuddy_is_web_mode({"login_type": "Web"}) is True
        assert workbuddy_is_web_mode({"login_type": "token"}) is False
        assert workbuddy_is_web_mode({}) is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
