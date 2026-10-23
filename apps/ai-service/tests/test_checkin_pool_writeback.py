# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""O64 签到刷新凭证回写号池单测(2026-10-23 立)。

覆盖:指纹语义 / 非号池账号零开销 / 无变化不打扰 / applied-conflict-not_found
三态 / HTTP 失败落 pending 与 attempts 累积 / secret 缺失降级。
httpx.AsyncClient 与 api_base_url/settings 全 monkeypatch,不连真网。
"""

from __future__ import annotations

import types
from typing import Any

import pytest

from app.services import checkin_pool_writeback as wb


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict[str, Any] | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeClient:
    """记录最近一次 post 调用;按队列供响应。"""

    last: FakeClient | None = None
    calls: list[dict[str, Any]] = []
    responses: list[FakeResponse] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        FakeClient.last = self

    async def __aenter__(self) -> FakeClient:
        return self

    async def __aexit__(self, *args: Any) -> bool:
        return False

    async def post(self, url: str, json: Any = None, headers: Any = None) -> FakeResponse:
        FakeClient.calls.append({"url": url, "json": json, "headers": headers})
        return FakeClient.responses.pop(0)


@pytest.fixture(autouse=True)
def _patch_env(monkeypatch: pytest.MonkeyPatch):
    FakeClient.calls = []
    FakeClient.responses = []
    FakeClient.last = None
    monkeypatch.setattr(wb, "httpx", types.SimpleNamespace(AsyncClient=FakeClient))
    monkeypatch.setattr(wb, "api_base_url", lambda: "http://api.test:8802")
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-internal-secret")


def _dm(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "pool_account_id": "pool-1",
        "pool_cred_version": 7,
        "refresh_token": "ref-old",
        "expires_at": 100.0,
    }
    base.update(over)
    return base


# =============================================================================
# cred_fingerprint
# =============================================================================


class TestCredFingerprint:
    def test_distinguishes_none_empty_and_values(self):
        assert wb.cred_fingerprint({"refresh_token": None}) != wb.cred_fingerprint({"refresh_token": ""})
        assert wb.cred_fingerprint({"refresh_token": "a"}) != wb.cred_fingerprint({"refresh_token": "b"})

    def test_same_value_same_fingerprint(self):
        assert wb.cred_fingerprint(_dm()) == wb.cred_fingerprint(_dm())

    def test_expires_at_float_vs_iso_are_different_states(self):
        # 号池推送写 ISO 串、qoder 刷新写 float —— 不同事件理应视为变化
        assert wb.cred_fingerprint({"expires_at": 100.0}) != wb.cred_fingerprint(
            {"expires_at": "2026-10-23T00:00:00Z"}
        )


# =============================================================================
# maybe_writeback
# =============================================================================


class TestMaybeWriteback:
    @pytest.mark.asyncio
    async def test_non_pool_account_is_noop(self):
        dm: dict[str, Any] = {"refresh_token": "x"}  # 无 pool_account_id(用户自建账号)
        assert await wb.maybe_writeback(dm, wb.cred_fingerprint(dict(dm))) is False
        assert FakeClient.calls == []

    @pytest.mark.asyncio
    async def test_no_change_and_no_pending_is_noop(self):
        dm = _dm()
        before = wb.cred_fingerprint(dict(dm))
        assert await wb.maybe_writeback(dm, before) is False
        assert FakeClient.calls == []

    @pytest.mark.asyncio
    async def test_cred_change_posts_and_applied(self):
        dm = _dm()
        before = wb.cred_fingerprint(dict(dm))
        dm["refresh_token"] = "ref-new"
        dm["expires_at"] = 200.5
        FakeClient.responses.append(FakeResponse(200, {"status": "applied", "credVersion": 8}))
        dirty = await wb.maybe_writeback(dm, before)
        assert dirty is True
        call = FakeClient.calls[0]
        assert call["url"] == "http://api.test:8802/api/internal/relay/account-pool/credential"
        assert call["headers"]["X-Internal-Secret"] == "test-internal-secret"
        assert call["json"] == {
            "poolAccountId": "pool-1",
            "baseVersion": 7,
            "source": "checkin-refresh",
            "refreshToken": "ref-new",
            "expiresAt": "200.5",
        }
        # applied:清 pending 且按响应校正号池版本基准
        assert "pool_pending_cred" not in dm
        assert dm["pool_cred_version"] == 8

    @pytest.mark.asyncio
    async def test_http_failure_marks_pending_attempts_1(self):
        dm = _dm()
        before = wb.cred_fingerprint(dict(dm))
        dm["refresh_token"] = "ref-new"
        FakeClient.responses.append(FakeResponse(502, text="bad gateway"))
        dirty = await wb.maybe_writeback(dm, before)
        assert dirty is True
        pending = dm["pool_pending_cred"]
        assert pending["attempts"] == 1
        assert "502" in pending["error"]
        assert pending["at"]

    @pytest.mark.asyncio
    async def test_pending_retry_on_no_change_and_attempts_accumulate(self):
        dm = _dm(
            pool_pending_cred={"at": "t0", "error": "old", "attempts": 2},
        )
        before = wb.cred_fingerprint(dict(dm))  # 无变化,但 pending 在 → 重试
        FakeClient.responses.append(FakeResponse(500, text="boom"))
        dirty = await wb.maybe_writeback(dm, before)
        assert dirty is True
        assert FakeClient.calls, "pending 存在时应重试(即便凭证无变化)"
        assert dm["pool_pending_cred"]["attempts"] == 3

    @pytest.mark.asyncio
    async def test_pending_retry_success_clears(self):
        dm = _dm(pool_pending_cred={"at": "t0", "error": "old", "attempts": 2})
        before = wb.cred_fingerprint(dict(dm))
        FakeClient.responses.append(FakeResponse(200, {"status": "applied", "credVersion": 8}))
        assert await wb.maybe_writeback(dm, before) is True
        assert "pool_pending_cred" not in dm
        assert dm["pool_cred_version"] == 8

    @pytest.mark.asyncio
    async def test_conflict_drops_writeback_and_corrects_base(self):
        dm = _dm()
        before = wb.cred_fingerprint(dict(dm))
        dm["refresh_token"] = "ref-new"
        FakeClient.responses.append(
            FakeResponse(200, {"status": "conflict", "currentVersion": 12})
        )
        assert await wb.maybe_writeback(dm, before) is True
        # 以号池为准:丢弃本次回写(凭证留在签到侧),基准校正到号池当前版本
        assert "pool_pending_cred" not in dm
        assert dm["pool_cred_version"] == 12
        assert dm["refresh_token"] == "ref-new"  # 不清签到侧凭证(号池覆盖由下次推送)

    @pytest.mark.asyncio
    async def test_not_found_clears_pending_without_retry(self):
        dm = _dm(pool_pending_cred={"at": "t0", "error": "old", "attempts": 5})
        before = wb.cred_fingerprint(dict(dm))
        FakeClient.responses.append(FakeResponse(200, {"status": "not_found"}))
        assert await wb.maybe_writeback(dm, before) is True
        assert "pool_pending_cred" not in dm

    @pytest.mark.asyncio
    async def test_secret_missing_marks_pending(self, monkeypatch: pytest.MonkeyPatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "ai_callback_secret", "")
        dm = _dm()
        before = wb.cred_fingerprint(dict(dm))
        dm["refresh_token"] = "ref-new"
        assert await wb.maybe_writeback(dm, before) is True
        assert FakeClient.calls == []
        assert "未配置" in dm["pool_pending_cred"]["error"]

    @pytest.mark.asyncio
    async def test_non_string_expires_at_omitted_from_payload(self):
        dm = _dm(expires_at={"bad": "shape"})
        before = wb.cred_fingerprint(dict(dm))
        dm["refresh_token"] = "ref-new"
        FakeClient.responses.append(FakeResponse(200, {"status": "applied", "credVersion": 8}))
        await wb.maybe_writeback(dm, before)
        body = FakeClient.calls[0]["json"]
        assert "expiresAt" not in body
        assert body["refreshToken"] == "ref-new"
