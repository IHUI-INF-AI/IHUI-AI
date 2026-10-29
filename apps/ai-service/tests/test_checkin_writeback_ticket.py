# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-242 残余 A 格:checkin_pool_writeback 真带内部票(2026-10-27,内部票席 C)。

改前:回写请求的票主体恒为空串 ⇒ 永远只发旧常驻密钥头。
改后:调用方手上真实存在的 owner_user_id 可往下传,能签则签真票;拿不到则维持
旧行为(只发旧头),**绝不编造主体**。

三问成对:
① 有 owner ⇒ 头里有 x-internal-service-ticket,同一把 JWT_SECRET 解得 sub=该 uid、
   scope=ai-callback(既有档,未新增枚举)、aud/type/exp 全对;旧头同发(dual 默认档)。
② 无 owner(未传 / None / 空串 / 非 str / 开发占位 dev-anonymous)⇒ 只发旧头,
   不发空票、不发坏票、不带 x-user-id。
③ 零副作用:httpx 与 DB 访问全为假件,不连生产 PG(8810)/Redis(8811)、不真外呼。

另钉调用链:run_checkin_now 把入参 owner 补进 account;checkin_one 把 account 上的
owner 原样交给 maybe_writeback(批量调度路径不带该键 ⇒ None ⇒ 旧行为)。
"""

from __future__ import annotations

import types
from typing import Any

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_HEADER,
    INTERNAL_TICKET_SCOPES,
    INTERNAL_TICKET_TYPE,
    INTERNAL_TOKEN_HEADER,
    MAX_TICKET_TTL_SECONDS,
    USER_ID_HEADER,
)
from app.services import checkin_pool_writeback as wb

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict[str, Any] | None = None) -> None:
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = ""

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeClient:
    """记录每次 post 的 url/json/headers;响应按队列供。"""

    calls: list[dict[str, Any]] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> FakeClient:
        return self

    async def __aexit__(self, *args: Any) -> bool:
        return False

    async def post(self, url: str, json: Any = None, headers: Any = None) -> FakeResponse:
        FakeClient.calls.append({"url": url, "json": json, "headers": headers})
        return FakeResponse(200, {"status": "applied", "credVersion": 8})


@pytest.fixture(autouse=True)
def _patch_env(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeClient.calls = []
    monkeypatch.setattr(wb, "httpx", types.SimpleNamespace(AsyncClient=FakeClient))
    monkeypatch.setattr(wb, "api_base_url", lambda: "http://api.test:8802")
    monkeypatch.setattr(settings, "ai_callback_secret", LEGACY, raising=False)
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def _dm() -> dict[str, Any]:
    return {
        "pool_account_id": "pool-1",
        "pool_cred_version": 7,
        "refresh_token": "ref-old",
        "expires_at": 100.0,
    }


async def _write_once(owner_user_id: Any = None) -> dict[str, str]:
    dm = _dm()
    before = wb.cred_fingerprint(dict(dm))
    dm["refresh_token"] = "ref-new"
    dm["expires_at"] = 200.5
    assert await wb.maybe_writeback(dm, before, owner_user_id=owner_user_id) is True
    assert len(FakeClient.calls) == 1
    headers = FakeClient.calls[0]["headers"]
    assert isinstance(headers, dict)
    return headers


def _decode(token: str) -> dict[str, Any]:
    """按验票侧同一套判据解票:同一把密钥 + 同一 aud。"""
    return pyjwt.decode(token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE)


# =============================================================================
# ① 能拿到主体 ⇒ 真票
# =============================================================================


class TestWithSubject:
    @pytest.mark.asyncio
    async def test_ticket_has_correct_sub_and_verifies(self) -> None:
        headers = await _write_once(UID)
        assert INTERNAL_TICKET_HEADER in headers
        payload = _decode(headers[INTERNAL_TICKET_HEADER])
        assert payload["sub"] == UID  # 主体 = 调用方给的 owner,不是编的
        assert payload["aud"] == INTERNAL_TICKET_AUDIENCE
        assert payload["type"] == INTERNAL_TICKET_TYPE
        assert payload["jti"]
        ttl = payload["exp"] - payload["iat"]
        assert 0 < ttl <= MAX_TICKET_TTL_SECONDS  # 短期票,不是另一种常驻密钥

    @pytest.mark.asyncio
    async def test_scope_is_existing_tier_not_new_enum(self) -> None:
        payload = _decode((await _write_once(UID))[INTERNAL_TICKET_HEADER])
        assert payload["scope"] == "ai-callback"  # 沿用既有契约档
        assert payload["scope"] in INTERNAL_TICKET_SCOPES

    @pytest.mark.asyncio
    async def test_dual_default_keeps_legacy_headers(self) -> None:
        headers = await _write_once(UID)
        assert headers[INTERNAL_TOKEN_HEADER] == LEGACY  # 旧头照发(兼容窗口)
        assert headers["X-Internal-Secret"] == LEGACY  # 端点自己的机机凭据
        assert headers["Content-Type"] == "application/json"
        assert headers[USER_ID_HEADER] == UID  # 票主体与声明头一致,验票侧不会判 subject mismatch


# =============================================================================
# ② 拿不到主体 ⇒ 只发旧头,不伪造
# =============================================================================


class TestWithoutSubject:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "owner",
        [None, "", "   ", 0, 123, {"id": UID}, ["dev-anonymous"], "not-a-uuid", "user@example.com"],
    )
    async def test_no_ticket_and_no_user_id_header(self, owner: Any) -> None:
        headers = await _write_once(owner)
        assert INTERNAL_TICKET_HEADER not in headers  # 不发空票/坏票
        assert USER_ID_HEADER not in headers  # 不声明未证实的主体
        assert headers[INTERNAL_TOKEN_HEADER] == LEGACY  # 维持现行为:旧头在
        assert headers["X-Internal-Secret"] == LEGACY

    @pytest.mark.asyncio
    @pytest.mark.parametrize("owner", ["dev-anonymous", "system:relay-pool", "probe-user"])
    async def test_placeholder_owners_are_not_subjects(self, owner: str) -> None:
        """占位属主不是可验主体(api 侧 injectVerifiedUser 会按 not found 拒)。

        值域来源:checkin_accounts 的 owner 既有真用户 uuid,也有运营池
        system:relay-pool 与开发占位 dev-anonymous。
        """
        headers = await _write_once(owner)
        assert INTERNAL_TICKET_HEADER not in headers
        assert USER_ID_HEADER not in headers

    @pytest.mark.asyncio
    async def test_whitespace_padded_uid_is_normalized(self) -> None:
        """空白态只是传输噪声,不改变主体身份 —— 归一后仍是同一 uid。"""
        headers = await _write_once(f"  {UID}  ")
        assert _decode(headers[INTERNAL_TICKET_HEADER])["sub"] == UID
        assert headers[USER_ID_HEADER] == UID

    @pytest.mark.asyncio
    async def test_jwt_secret_missing_means_legacy_only(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
        headers = await _write_once(UID)
        assert INTERNAL_TICKET_HEADER not in headers  # 签不出就不发,不发半坏票
        assert headers[INTERNAL_TOKEN_HEADER] == LEGACY


# =============================================================================
# ③ 零副作用 + 归一函数边界
# =============================================================================


class TestSideEffectFree:
    @pytest.mark.asyncio
    async def test_same_input_same_headers(self) -> None:
        first = wb._auth_headers(LEGACY, UID)
        second = wb._auth_headers(LEGACY, UID)
        assert first.keys() == second.keys()
        assert _decode(first[INTERNAL_TICKET_HEADER])["sub"] == UID
        assert _decode(second[INTERNAL_TICKET_HEADER])["sub"] == UID
        # jti 必须一次一密(同主体两次调用不得复用重放键)
        assert first[INTERNAL_TICKET_HEADER] != second[INTERNAL_TICKET_HEADER]

    def test_ticket_subject_of_normalizes(self) -> None:
        assert wb.ticket_subject_of(UID) == UID
        assert wb.ticket_subject_of(f" {UID} ") == UID
        for bad in (None, "", "   ", 0, 123, b"bytes", ["x"], {"x": 1}):
            assert wb.ticket_subject_of(bad) == ""
        # 非 uuid 属主(占位值 / 邮箱 / 任意串)= 不可验证主体
        for placeholder in ("dev-anonymous", "system:relay-pool", "probe-user", "user@example.com"):
            assert wb.ticket_subject_of(placeholder) == ""

    @pytest.mark.asyncio
    async def test_http_client_is_the_only_io(self) -> None:
        """唯一外部动作 = 一次 post;响应假件 ⇒ 无真实网络 / DB。"""
        await _write_once(UID)
        assert len(FakeClient.calls) == 1
        assert FakeClient.calls[0]["url"].endswith(wb.WRITEBACK_PATH)


# =============================================================================
# 调用链:owner 从哪来、怎么往下传
# =============================================================================


class TestCallChain:
    @pytest.mark.asyncio
    async def test_checkin_one_passes_owner_from_account(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.services import checkin_scheduler as sched_mod

        captured: dict[str, Any] = {}

        async def fake_wb(dm: dict[str, Any], before: Any, *, owner_user_id: Any = None) -> bool:
            captured["owner"] = owner_user_id
            return False

        async def fake_engine(*args: Any, **kwargs: Any) -> dict[str, Any]:
            return {"ok": True}

        async def fake_save(*args: Any, **kwargs: Any) -> None:
            return None

        monkeypatch.setattr(wb, "maybe_writeback", fake_wb)
        monkeypatch.setattr(sched_mod, "checkin_account", fake_engine)
        monkeypatch.setattr(sched_mod, "client_for", lambda dm: (object(), False))
        monkeypatch.setattr(sched_mod.checkin_store, "save_device_map", fake_save)

        await sched_mod.checkin_scheduler.checkin_one(
            {
                "id": 1,
                "name": "acct",
                "jwt": "jwt",
                "platform": "trae",
                "device_map": {"refresh_token": "r"},
                "owner_user_id": UID,
            }
        )
        assert captured["owner"] == UID

    @pytest.mark.asyncio
    async def test_checkin_one_without_owner_passes_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """批量调度路径的 account 行不含 owner_user_id ⇒ 明确传 None,不猜。"""
        from app.services import checkin_scheduler as sched_mod

        captured: dict[str, Any] = {}

        async def fake_wb(dm: dict[str, Any], before: Any, *, owner_user_id: Any = None) -> bool:
            captured["owner"] = owner_user_id
            return False

        async def fake_engine(*args: Any, **kwargs: Any) -> dict[str, Any]:
            return {"ok": True}

        async def fake_save(*args: Any, **kwargs: Any) -> None:
            return None

        monkeypatch.setattr(wb, "maybe_writeback", fake_wb)
        monkeypatch.setattr(sched_mod, "checkin_account", fake_engine)
        monkeypatch.setattr(sched_mod, "client_for", lambda dm: (object(), False))
        monkeypatch.setattr(sched_mod.checkin_store, "save_device_map", fake_save)

        await sched_mod.checkin_scheduler.checkin_one(
            {
                "id": 2,
                "name": "acct2",
                "jwt": "jwt",
                "platform": "trae",
                "device_map": {"refresh_token": "r"},
            }
        )
        assert captured["owner"] is None

    @pytest.mark.asyncio
    async def test_run_checkin_now_injects_owner_into_account(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """get_decrypted_jwt 的 SELECT 不含 owner 列 ⇒ 由本方法的入参补齐往下传。"""
        from app.services import checkin_scheduler as sched_mod

        captured: dict[str, Any] = {}

        async def fake_get_jwt(account_id: int, owner: str) -> dict[str, Any]:
            return {"id": account_id, "name": "a", "jwt": "j", "platform": "trae"}

        async def fake_checkin_one(self: Any, account: dict[str, Any]) -> dict[str, Any]:
            captured["account"] = account
            return {"ok": True}

        async def fake_record(
            self: Any, account_id: int, result: dict[str, Any]
        ) -> dict[str, Any]:
            return {"id": account_id}

        async def fake_cooldowns() -> dict[str, Any]:
            return {}

        monkeypatch.setattr(sched_mod.checkin_store, "get_decrypted_jwt", fake_get_jwt)
        monkeypatch.setattr(sched_mod.checkin_store, "get_active_cooldowns", fake_cooldowns)
        monkeypatch.setattr(sched_mod.checkin_outbound_gate, "paused_remaining", lambda: 0)
        monkeypatch.setattr(sched_mod.CheckinScheduler, "checkin_one", fake_checkin_one)
        monkeypatch.setattr(sched_mod.CheckinScheduler, "record_result", fake_record)

        await sched_mod.checkin_scheduler.run_checkin_now(7, UID)
        assert captured["account"]["owner_user_id"] == UID

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
