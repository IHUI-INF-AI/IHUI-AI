# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_qoder 单元测试（httpx.MockTransport，不打真实网络）。

覆盖: uid 解析 / Cosy 头构造 / 可领判据 / 领取成功 / 已领取 / 未下发 /
401 自刷新重试 / 双 401 SessionDead / 网络异常 / 余额解析 / refresh 契约。
"""

from __future__ import annotations

import base64
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
