# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_qoder 单元测试（httpx.MockTransport，不打真实网络）。

覆盖: uid 解析 / Cosy 头构造 / 可领判据 / 领取成功 / 已领取 / 未下发 /
401 自刷新重试 / 双 401 SessionDead / 网络异常 / 余额解析 / refresh 契约。
"""

from __future__ import annotations

import base64
import datetime
import json
import time

import httpx
import pytest

from app.services.checkin_qoder import (
    CLIENT_TYPE_DEFAULT,
    PATH_CAMPAIGNS,
    PATH_CLAIM,
    PATH_QUOTA,
    PATH_REFRESH,
    QODER_BASES,
    _claimable_campaigns,
    build_cosy_headers,
    qoder_checkin_account,
    qoder_classify_error,
    qoder_extract_uid,
    qoder_jwt_exp,
    qoder_query_credits,
    qoder_refresh_token,
    qoder_session_expiry,
)

UID = "990011"


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


def _b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_qoder_jwt(uid: str = UID, exp_offset: float = 3600.0 * 24 * 30) -> str:
    """构造未签名的 Qoder 测试 JWT(payload.sub = uid;exp 远期避免触发自刷新)。"""
    payload = {"sub": uid, "exp": int(time.time() + exp_offset)}
    return f"{_b64({'alg': 'none'})}.{_b64(payload)}.sig"


def make_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


@pytest.fixture
def jwt() -> str:
    return make_qoder_jwt()


def _campaign(cid: str, status: str, amount: int = 100, start=-3600, end=3600) -> dict:
    return {
        "campaignId": cid,
        "campaignKey": "daily-100",
        "actionType": "CLAIM_BENEFIT",
        "claimStatus": status,
        "startAt": time.time() + start,
        "endAt": time.time() + end,
        "benefit": {"kind": "CREDITS", "amount": amount},
    }


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


class TestJwtParsing:
    def test_extract_uid_sub(self):
        assert qoder_extract_uid(make_qoder_jwt()) == UID

    def test_extract_uid_fallback_keys(self):
        payload = {"uid": 42}
        token = f"x.{_b64(payload)}.y"
        assert qoder_extract_uid(token) == "42"

    def test_extract_uid_invalid(self):
        assert qoder_extract_uid("not-a-jwt") is None
        assert qoder_extract_uid("") is None

    def test_jwt_exp_future(self):
        exp_dt, remaining = qoder_jwt_exp(make_qoder_jwt(exp_offset=7200))
        assert exp_dt is not None and remaining is not None and remaining > 1.5

    def test_jwt_exp_missing(self):
        token = f"x.{_b64({'sub': UID})}.y"
        assert qoder_jwt_exp(token) == (None, None)


# ---------------------------------------------------------------------------
# 会话 expiresAt 过期预检(真机实证 2026-10-11:auth.v1.dat 含 ISO 8601 expiresAt)
# ---------------------------------------------------------------------------


def _iso_utc(hours: float) -> str:
    """now(UTC)+hours → auth.v1.dat 同款 ISO 8601 字符串(Z 后缀,真 UTC 时刻)。"""
    dt = datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=hours)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class TestSessionExpiry:
    def test_future_iso(self):
        """未来 expiresAt(ISO 8601)→ remaining > 0,数值与偏移吻合。"""
        dm = {"expires_at": _iso_utc(48)}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert 47.0 < remaining < 49.0

    def test_past_iso(self):
        """过去 expiresAt → remaining < 0(过期)。"""
        dm = {"expires_at": _iso_utc(-24)}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert remaining < 0

    def test_missing(self):
        """缺失(含桌面端现状 expires_at=0)→ (None, None),绝不误判过期。"""
        assert qoder_session_expiry({}) == (None, None)
        assert qoder_session_expiry({"expires_at": 0}) == (None, None)
        assert qoder_session_expiry({"expires_at": None}) == (None, None)

    def test_bad_format(self):
        """坏格式 → (None, None),不抛栈。"""
        assert qoder_session_expiry({"expires_at": "not-a-date"}) == (None, None)
        assert qoder_session_expiry({"expires_at": "2026-13-99T99:99:99Z"}) == (None, None)
        assert qoder_session_expiry({"expires_at": True}) == (None, None)
        assert qoder_session_expiry({"expires_at": ["x"]}) == (None, None)

    def test_epoch_seconds_form(self):
        """刷新链路写回的 epoch 秒数形态 → 与 qoder_jwt_exp 同语义。"""
        dm = {"expires_at": time.time() + 3600.0}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert 0.5 < remaining < 1.5

    def test_session_key_alias_and_negative_epoch(self):
        """auth.v1.dat 原文键 expiresAt 也可解析;epoch 负值视为缺失。"""
        dm = {"expiresAt": _iso_utc(10)}
        _, remaining = qoder_session_expiry(dm)
        assert remaining is not None and 9.0 < remaining < 11.0
        assert qoder_session_expiry({"expires_at": -5}) == (None, None)

    def test_refresh_token_expiry_fallback(self):
        """expiresAt 缺失时回落 refreshTokenExpiresAt(snake/camel 两形态)。"""
        future = _iso_utc(72)
        _, remaining = qoder_session_expiry({"refresh_token_expires_at": future})
        assert remaining is not None and remaining > 70.0
        _, remaining = qoder_session_expiry({"refreshTokenExpiresAt": future})
        assert remaining is not None and remaining > 70.0

    def test_session_expiry_preferred_over_refresh(self):
        """两者都在时优先更紧迫的会话 expiresAt。"""
        dm = {
            "expires_at": _iso_utc(5),
            "refresh_token_expires_at": _iso_utc(720),
        }
        _, remaining = qoder_session_expiry(dm)
        assert remaining is not None and 4.0 < remaining < 6.0

    def test_aware_offset_iso(self):
        """带时区偏移的 ISO 8601(+08:00)→ 转本地后语义一致。"""
        dm = {"expires_at": "2026-10-31T12:56:16+08:00"}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert exp_dt.tzinfo is None  # 与 qoder_jwt_exp 同为 naive 本地语义


class TestCosyHeaders:
    def test_full_mapping(self):
        dm = {
            "cosy": {
                "client_type": "10",
                "machine_id": "mid-1",
                "machine_token": "mtok",
                "machine_code": "mcode",
                "machine_type": "PC",
                "machine_hostname": "host-1",
                "machine_os": "x86_64_windows",
                "version": "1.2.3",
            }
        }
        h = build_cosy_headers(dm)
        assert h["Cosy-ClientType"] == "10"
        assert h["Cosy-MachineId"] == "mid-1"
        assert h["Cosy-MachineToken"] == "mtok"
        assert h["Cosy-MachineCode"] == "mcode"
        assert h["Cosy-MachineType"] == "PC"
        assert h["Cosy-MachineHostname"] == "host-1"
        assert h["Cosy-MachineOS"] == "x86_64_windows"
        assert h["Cosy-Version"] == "1.2.3"

    def test_defaults_fill_client_type_and_os(self):
        h = build_cosy_headers({})
        assert h["Cosy-ClientType"] == CLIENT_TYPE_DEFAULT
        assert "_windows" in h["Cosy-MachineOS"] or "_macos" in h["Cosy-MachineOS"] or "_linux" in h["Cosy-MachineOS"]

    def test_empty_values_skipped(self):
        h = build_cosy_headers({"cosy": {"machine_id": "  ", "machine_token": ""}})
        assert "Cosy-MachineId" not in h
        assert "Cosy-MachineToken" not in h


class TestClaimable:
    def test_claimable_extracted(self):
        camps = [_campaign("c1", "CLAIMABLE"), {"actionType": "OTHER", "claimStatus": "CLAIMABLE"}]
        claimable, already = _claimable_campaigns(camps, time.time())
        assert len(claimable) == 1 and claimable[0]["campaignId"] == "c1"
        assert already is False

    def test_already_claimed_in_window(self):
        camps = [_campaign("c1", "CLAIMED", start=-60, end=60)]
        claimable, already = _claimable_campaigns(camps, time.time())
        assert claimable == [] and already is True

    def test_claimed_outside_window_not_already(self):
        camps = [_campaign("c1", "CLAIMED", start=-7200, end=-3600)]
        claimable, already = _claimable_campaigns(camps, time.time())
        assert claimable == [] and already is False


class TestClassify:
    def test_contract(self):
        assert qoder_classify_error(401, None) == ("SessionDead", -1)
        assert qoder_classify_error(429, None) == ("SoftRate", 60)
        assert qoder_classify_error(503, None) == ("Server", 600)
        assert qoder_classify_error(400, None) == ("Client", 600)
        assert qoder_classify_error(None, "x") == ("Unknown", 0)


# ---------------------------------------------------------------------------
# 编排流程(MockTransport)
# ---------------------------------------------------------------------------


class TestCheckinFlow:
    @pytest.mark.asyncio
    async def test_claim_success(self, jwt):
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append((request.method, request.url.path, dict(request.headers)))
            if request.url.path == PATH_CAMPAIGNS:
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMABLE")]})
            if request.url.path == PATH_CLAIM.replace("{cid}", "c-1"):
                return httpx.Response(
                    200,
                    json={"data": {"status": "CLAIMED", "replayed": False,
                                   "benefit": {"kind": "CREDITS", "amount": 100}}},
                )
            return httpx.Response(404)

        dm = {"cosy": {"machine_id": "mid"}}
        result = await qoder_checkin_account("acc1", jwt, dm, client=make_client(handler))
        assert result["ok"] is True
        assert result["status"] == "success"
        assert result["action"] == "claim_ok"
        assert result["credits"] == 100 and result["credits_delta"] == 100
        # 风控头逐条确认(Cosy-MachineId 落库值必须进请求头)
        camp_headers = next(h for m, p, h in calls if p == PATH_CAMPAIGNS)
        assert camp_headers["cosy-machineid"] == "mid"  # httpx 头名小写
        assert camp_headers["authorization"].startswith("Bearer ")
        assert camp_headers["cosy-clienttype"] == CLIENT_TYPE_DEFAULT

    @pytest.mark.asyncio
    async def test_already_claimed(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_CAMPAIGNS:
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMED")]})
            return httpx.Response(404)

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is True
        assert result["status"] == "already"
        assert result["action"] == "skip_already"

    @pytest.mark.asyncio
    async def test_pending_no_benefits(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"campaigns": []})

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] is None  # 业务语义不落冷却
        assert "未下发" in result["message"]

    @pytest.mark.asyncio
    async def test_401_refresh_then_retry(self, jwt):
        state = {"campaigns_calls": 0, "refreshed_token": make_qoder_jwt()}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                body = json.loads(request.content.decode())
                assert body["refresh_token"] == "rt-1"
                return httpx.Response(
                    200, json={"token": state["refreshed_token"], "refreshToken": "rt-2"}
                )
            if request.url.path == PATH_CAMPAIGNS:
                state["campaigns_calls"] += 1
                if state["campaigns_calls"] == 1:
                    return httpx.Response(401)  # 首次 401 → 触发强制刷新重试
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMABLE")]})
            if request.url.path == PATH_CLAIM.replace("{cid}", "c-1"):
                return httpx.Response(200, json={"data": {"status": "CLAIMED",
                                                          "benefit": {"amount": 100}}})
            return httpx.Response(404)

        dm = {"refresh_token": "rt-1"}
        result = await qoder_checkin_account("acc1", jwt, dm, client=make_client(handler))
        assert result["ok"] is True and result["status"] == "success"
        assert state["campaigns_calls"] == 2
        # 新 token / 新 refreshToken 写回 device_map(调用方 save_device_map 落库)
        assert dm["refresh_token"] == "rt-2"
        assert dm["expires_at"] is not None
        assert result["warning"] is None

    @pytest.mark.asyncio
    async def test_double_401_session_dead(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(200, json={"token": make_qoder_jwt(), "refreshToken": "rt-2"})
            return httpx.Response(401)

        result = await qoder_checkin_account("acc1", jwt, {"refresh_token": "rt-1"},
                                             client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}

    @pytest.mark.asyncio
    async def test_network_error(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("boom")

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is False
        assert "网络异常" in result["message"]

    @pytest.mark.asyncio
    async def test_endpoint_fallback_on_404(self, jwt):
        seen_hosts = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen_hosts.append(str(request.url.host))
            if str(request.url.host) == "openapi.qoder.com.cn":
                return httpx.Response(404)
            return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMED")]})

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["status"] == "already"
        assert seen_hosts == ["openapi.qoder.com.cn", "openapi.qoder.sh"]

    @pytest.mark.asyncio
    async def test_unparseable_token(self):
        result = await qoder_checkin_account("acc1", "garbage", {})
        assert result["ok"] is False
        assert "无法从 token 解析 uid" in result["message"]


# ---------------------------------------------------------------------------
# 刷新与余额
# ---------------------------------------------------------------------------


class TestRefreshAndQuota:
    @pytest.mark.asyncio
    async def test_refresh_contract(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(
                    200, json={"token": make_qoder_jwt(), "refreshToken": "rt-new"}
                )
            return httpx.Response(404)

        out = await qoder_refresh_token("rt-old", {}, client=make_client(handler))
        assert out is not None
        assert out["refresh_token"] == "rt-new"
        assert out["expires_at"] is not None

    @pytest.mark.asyncio
    async def test_refresh_empty_token(self):
        assert await qoder_refresh_token("", {}) is None

    @pytest.mark.asyncio
    async def test_quota_add_on_top_level(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == PATH_QUOTA
            return httpx.Response(200, json={"addOnQuota": {"remaining": 500}})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out == {"remaining": 500, "packs": [], "error": None}

    @pytest.mark.asyncio
    async def test_quota_nested_data(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": {"addOnQuota": {"remaining": 300}}})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] == 300

    @pytest.mark.asyncio
    async def test_quota_parse_failure(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"unexpected": True})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None
        assert "异常" in out["error"]

    @pytest.mark.asyncio
    async def test_quota_http_error(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"detail": "x"})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None and out["error"] is not None

    @pytest.mark.asyncio
    async def test_quota_401_refresh_then_retry(self, jwt):
        """401 → refresh 换新 token 重试一次;新 refresh_token/expires_at 写回 device_map。"""
        quota_tokens: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(
                    200,
                    json={
                        # exp 偏移不同 ⇒ token 字符串与原 token 必不相同
                        "token": make_qoder_jwt(exp_offset=3600.0 * 24 * 60),
                        "refreshToken": "rt-2",
                    },
                )
            assert request.url.path == PATH_QUOTA
            quota_tokens.append(request.headers.get("authorization") or "")
            if len(quota_tokens) == 1:
                return httpx.Response(401)
            return httpx.Response(200, json={"addOnQuota": {"remaining": 777}})

        device_map: dict = {"refresh_token": "rt-1"}
        out = await qoder_query_credits(jwt, device_map, client=make_client(handler))
        assert out == {"remaining": 777, "packs": [], "error": None}
        assert len(quota_tokens) == 2
        assert quota_tokens[0].endswith(jwt)
        assert quota_tokens[1] != quota_tokens[0]
        assert device_map["refresh_token"] == "rt-2"
        assert "expires_at" in device_map

    @pytest.mark.asyncio
    async def test_quota_401_refresh_failure(self, jwt):
        """401 且 refresh 也失败(如 refresh_token 空)→ 返回错误,不无限重试。"""
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request.url.path)
            return httpx.Response(401)

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None
        assert "HTTP 401" in out["error"]
        assert calls.count(PATH_QUOTA) == 1  # 无 refresh_token ⇒ 不重试
        assert PATH_REFRESH not in calls


# ---------------------------------------------------------------------------
# 端点契约(常量钉住,防漂移)
# ---------------------------------------------------------------------------


class TestConstants:
    def test_bases_order_cn_first(self):
        assert QODER_BASES == ("https://openapi.qoder.com.cn", "https://openapi.qoder.sh")

    def test_paths(self):
        assert PATH_CAMPAIGNS == "/sash/api/v1/me/campaigns"
        assert PATH_CLAIM == "/sash/api/v1/me/campaigns/{cid}/claim"
        assert PATH_REFRESH == "/api/v1/deviceToken/refresh"
        assert PATH_QUOTA == "/api/v2/quota/usage"
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
