# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_engine 单元测试（httpx.MockTransport，不打真实网络）。

覆盖: 正常签到成功 / 已签过跳过 / token 失效分类 / 限流分类 /
网络超时分类 / 重试路径 / 设备指纹头构造正确性 / 设备标识确定性。
"""

from __future__ import annotations

import base64
import json
import time
import uuid

import httpx
import pytest

from app.services.checkin_engine import (
    DEVICE_GEN,
    SIGNIN_URL,
    STATUS_URL,
    _build_headers,
    checkin_account,
    classify_error,
    extract_user_id,
    gen_market_uuid,
    get_device_for,
    rand_digits,
    rand_hex,
    signin,
    signin_with_retry,
    status_check,
)

USER_ID = "1234567890123456"


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


def _b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_jwt(user_id: str = USER_ID, exp_offset: float = 3600.0) -> str:
    """构造未签名的测试 JWT（payload.data.id = user_id）。"""
    payload = {"data": {"id": user_id}, "exp": int(time.time() + exp_offset)}
    return f"{_b64({'alg': 'none'})}.{_b64(payload)}.sig"


def make_client(handler) -> httpx.AsyncClient:
    """基于 MockTransport 构造注入用 AsyncClient。"""
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


@pytest.fixture
def jwt() -> str:
    return make_jwt()


@pytest.fixture
def device_map() -> dict:
    return {}


# ---------------------------------------------------------------------------
# 设备标识与指纹头
# ---------------------------------------------------------------------------


class TestDeviceFingerprint:
    def test_get_device_for_generates_full_record(self, device_map):
        dev = get_device_for(USER_ID, device_map)
        assert dev["gen"] == DEVICE_GEN
        assert len(dev["device_id"]) == 15 and dev["device_id"].isdigit()
        assert len(dev["session_id"]) == 64
        assert uuid.UUID(dev["market_user_id"]).version == 4
        assert "created" in dev

    def test_get_device_for_deterministic_across_maps(self):
        """同一 user_id 在 device_map 缺失时跨 map 复现相同 ID。"""
        a = get_device_for(USER_ID, {})
        b = get_device_for(USER_ID, {})
        assert a["device_id"] == b["device_id"]
        assert a["market_user_id"] == b["market_user_id"]
        assert a["session_id"] == b["session_id"]

    def test_get_device_for_reuses_existing(self, device_map):
        device_map[USER_ID] = {"device_id": "999", "gen": DEVICE_GEN, "session_id": "s", "market_user_id": "m"}
        dev = get_device_for(USER_ID, device_map)
        assert dev["device_id"] == "999"  # 未被重建

    def test_seeded_helpers_deterministic(self):
        assert rand_digits(15, seed=USER_ID) == rand_digits(15, seed=USER_ID)
        assert rand_hex(64, seed=USER_ID) == rand_hex(64, seed=USER_ID)
        assert gen_market_uuid(USER_ID) == gen_market_uuid(USER_ID)

    def test_build_headers_fingerprint_fields(self, jwt):
        dev = get_device_for(USER_ID, {})
        h = _build_headers(jwt, dev)
        assert h["authorization"] == f"Cloud-IDE-JWT {jwt}"
        assert h["x-device-id"] == dev["device_id"]
        assert h["x-market-user-id"] == dev["market_user_id"]
        assert h["vscode-sessionid"] == dev["session_id"]
        assert h["user-agent"] == "VSCode 1.107.1 (TRAE SOLO CN)"
        assert h["x-user-region"] == "CN"
        assert h["x-request-id"]  # 每次请求唯一 uuid
        assert h["x-tt-trace-id"].startswith("00-")

    def test_build_headers_authorization_no_double_prefix(self):
        raw = "Cloud-IDE-JWT abc.def.ghi"
        h = _build_headers(raw, get_device_for(USER_ID, {}))
        assert h["authorization"] == raw

    def test_extract_user_id_roundtrip(self, jwt):
        assert extract_user_id(jwt) == USER_ID


# ---------------------------------------------------------------------------
# classify_error
# ---------------------------------------------------------------------------


class TestClassifyError:
    def test_session_dead_401(self):
        assert classify_error(401, "unauthorized", None) == ("SessionDead", -1)

    def test_soft_rate_429(self):
        assert classify_error(429, "too many requests", None) == ("SoftRate", 60)

    def test_plan_limit_1005(self):
        assert classify_error(200, "limit", 1005) == ("PlanLimit", 43200)

    def test_server_5xx(self):
        assert classify_error(502, "bad gateway", None) == ("Server", 600)

    def test_unknown_network(self):
        assert classify_error(0, "网络异常", None) == ("Unknown", 0)


# ---------------------------------------------------------------------------
# 签到流程
# ---------------------------------------------------------------------------


class TestSigninFlow:
    async def test_signin_success(self, jwt, device_map):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url == httpx.URL(SIGNIN_URL)
            return httpx.Response(200, json={"code": 0, "message": "签到成功"})

        async with make_client(handler) as client:
            ok, msg, code, status = await signin("u1", jwt, device_map, client=client)
        assert ok is True
        assert code == 0
        assert status == 200
        assert msg == "签到成功"

    async def test_status_check_roundtrip(self, jwt, device_map):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url == httpx.URL(STATUS_URL)
            return httpx.Response(200, json={"code": 0, "checked_in": False, "credits": 20, "message": ""})

        async with make_client(handler) as client:
            ok, checked_in, credits, code, msg = await status_check("u1", jwt, device_map, client=client)
        assert ok is True and checked_in is False and credits == 20 and code == 0

    async def test_checkin_account_success(self, jwt, device_map):
        """正常签到成功: status 未签 → claim 成功，credits/delta 对齐 emit 语义。"""
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request.url.path)
            if "status" in str(request.url):
                return httpx.Response(200, json={"code": 0, "checked_in": False, "credits": 20, "message": ""})
            return httpx.Response(200, json={"code": 0, "message": "签到成功"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", jwt, device_map, client=client)
        assert result["ok"] is True
        assert result["status"] == "success"
        assert result["action"] == "claim_ok"
        assert result["credits"] == 20
        assert result["credits_delta"] == 20
        assert result["http_status"] == 200
        assert result["classified_error"] is None
        assert result["user_id"] == USER_ID
        # 持久化剥离: 引擎不落盘，但 device_map 被原位补齐供调用方写回
        assert device_map[USER_ID]["gen"] == DEVICE_GEN

    async def test_checkin_account_already_checked_in(self, jwt, device_map):
        """已签过: 跳过 claim，status=already。"""
        claim_called = []

        def handler(request: httpx.Request) -> httpx.Response:
            if "status" in str(request.url):
                return httpx.Response(200, json={"code": 0, "checked_in": True, "credits": 15, "message": ""})
            claim_called.append(True)
            return httpx.Response(200, json={"code": 0, "message": "签到成功"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", jwt, device_map, client=client)
        assert result["ok"] is True
        assert result["status"] == "already"
        assert result["action"] == "skip_already"
        assert result["credits"] == 15
        assert claim_called == []  # 未触发 claim

    async def test_checkin_account_token_invalid_401(self, jwt, device_map):
        """token 失效: 401 → SessionDead 永久冷却分类。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"code": 401, "message": "unauthorized"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", jwt, device_map, client=client)
        assert result["ok"] is False
        assert result["status"] == "fail"
        assert result["http_status"] == 401
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}

    async def test_checkin_account_rate_limited_429(self, jwt, device_map):
        """限流: 429 → SoftRate 冷却 60s。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(429, json={"code": 429, "message": "too many requests"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", jwt, device_map, client=client)
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SoftRate", "cooldown_seconds": 60}

    async def test_network_timeout_classified(self, jwt, device_map):
        """网络超时: httpx.TimeoutException → http_status=0，分类 Unknown（不落冷却）。"""

        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("timed out", request=request)

        async with make_client(handler) as client:
            ok, msg, code, status = await signin("u1", jwt, device_map, client=client)
            assert ok is False and code is None and status == 0
            result = await checkin_account("u1", jwt, device_map, client=client)
        assert result["http_status"] == 0
        assert result["classified_error"] is None  # Unknown 不写冷却分类

    async def test_retry_on_network_error_then_success(self, jwt, device_map):
        """重试路径: 首次网络异常 → 重试后成功；仅网络层异常重试。"""
        attempts = {"claim": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            if "status" in str(request.url):
                return httpx.Response(200, json={"code": 0, "checked_in": False, "credits": 10, "message": ""})
            attempts["claim"] += 1
            if attempts["claim"] == 1:
                raise httpx.ConnectTimeout("timed out", request=request)
            return httpx.Response(200, json={"code": 0, "message": "签到成功"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", jwt, device_map, retry=1, retry_delay=0, client=client)
        assert attempts["claim"] == 2
        assert result["ok"] is True
        assert result["action"] == "claim_ok"

    async def test_retry_exhausted_returns_last_failure(self, jwt, device_map):
        async with make_client(lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("t", request=r))) as client:
            ok, msg, code, status = await signin_with_retry("u1", jwt, device_map, retry=2, retry_delay=0, client=client)
        assert ok is False and code is None and status == 0

    async def test_business_failure_not_retried(self, jwt, device_map):
        """业务失败（code 非 None）不触发重试。"""
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(1)
            return httpx.Response(200, json={"code": 1005, "message": "plan limit"})

        async with make_client(handler) as client:
            ok, msg, code, status = await signin_with_retry("u1", jwt, device_map, retry=3, retry_delay=0, client=client)
        assert len(calls) == 1  # 未重试
        assert ok is False and code == 1005
        assert classify_error(status, msg, code) == ("PlanLimit", 43200)

    async def test_invalid_jwt_short_circuits(self, device_map):
        async with make_client(lambda r: httpx.Response(200, json={})) as client:
            result = await checkin_account("u1", "not-a-jwt", device_map, client=client)
            assert result["ok"] is False
            assert result["message"] == "无法从 JWT 解析 user id"
            ok, msg, code, status = await signin("u1", "not-a-jwt", device_map, client=client)
            assert ok is False and msg == "无法从 JWT 解析 user id"

    async def test_missing_jwt_short_circuits(self, device_map):
        async with make_client(lambda r: httpx.Response(200, json={})) as client:
            result = await checkin_account("u1", "", device_map, client=client)
        assert result["ok"] is False and result["message"] == "未配置 jwt"

    async def test_expired_jwt_warning(self, device_map):
        """JWT 已过期: 流程继续但附 warning 字段。"""
        expired = make_jwt(exp_offset=-3600.0)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"code": 0, "message": "签到成功"})

        async with make_client(handler) as client:
            result = await checkin_account("u1", expired, device_map, client=client)
        assert result["warning"] and "已过期" in result["warning"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
