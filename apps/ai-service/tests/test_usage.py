"""usage 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:直接调用端点 async 函数,monkeypatch app.routers.usage.usage_service
为假对象,验证参数校验分支(缺 user_id / provider / model / 负数 token)与成功路径。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import usage as usage_router


# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------


def _req(user_id: str | None = "u1") -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id))


@pytest.fixture
def fake_service(monkeypatch):
    """替换 usage 模块全局 usage_service。"""
    svc = MagicMock()
    svc.get_user_stats.return_value = {"total_tokens": 100}
    svc.get_global_stats.return_value = {"total_tokens": 1000}
    svc.get_quota_info.return_value = {"used_tokens": 1}
    svc.record_usage.return_value = SimpleNamespace(
        id="rec-1", estimated_cost=0.001
    )
    monkeypatch.setattr(usage_router, "usage_service", svc)
    return svc


# ---------------------------------------------------------------------------
# get_usage_stats
# ---------------------------------------------------------------------------


class TestGetUsageStats:
    async def test_missing_uid_400(self, fake_service):
        """user_id 参数与 request.state.user_id 都缺 → 400。"""
        req = SimpleNamespace(state=SimpleNamespace(user_id=None))
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_usage_stats(req, days=7, user_id=None)
        assert ei.value.status_code == 400
        assert "user_id" in ei.value.detail

    async def test_uid_from_query(self, fake_service):
        """user_id 显式传入(query 参数)。"""
        resp = await usage_router.get_usage_stats(_req(user_id="other"), days=7, user_id="admin")
        assert resp["code"] == 0
        fake_service.get_user_stats.assert_called_once_with("admin", days=7)

    async def test_uid_from_request_state(self, fake_service):
        """user_id 缺省时从 JWT 状态取。"""
        resp = await usage_router.get_usage_stats(_req(user_id="u1"), days=30, user_id=None)
        assert resp["code"] == 0
        fake_service.get_user_stats.assert_called_once_with("u1", days=30)


# ---------------------------------------------------------------------------
# get_global_stats
# ---------------------------------------------------------------------------


class TestGetGlobalStats:
    async def test_success(self, fake_service):
        resp = await usage_router.get_global_stats(days=14)
        assert resp["code"] == 0
        assert resp["data"] == {"total_tokens": 1000}
        fake_service.get_global_stats.assert_called_once_with(days=14)


# ---------------------------------------------------------------------------
# get_quota_info
# ---------------------------------------------------------------------------


class TestGetQuotaInfo:
    async def test_missing_uid_400(self, fake_service):
        req = SimpleNamespace(state=SimpleNamespace(user_id=None))
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_quota_info(req, user_id=None)
        assert ei.value.status_code == 400

    async def test_uid_from_query(self, fake_service):
        resp = await usage_router.get_quota_info(_req(), user_id="admin")
        assert resp["code"] == 0
        fake_service.get_quota_info.assert_called_once_with("admin")

    async def test_uid_from_request_state(self, fake_service):
        resp = await usage_router.get_quota_info(_req(user_id="u1"), user_id=None)
        assert resp["code"] == 0
        fake_service.get_quota_info.assert_called_once_with("u1")


# ---------------------------------------------------------------------------
# record_usage
# ---------------------------------------------------------------------------


class TestRecordUsage:
    def _body(self, **overrides: Any) -> dict[str, Any]:
        base: dict[str, Any] = {
            "provider": "stepfun",
            "model": "step-3.7-flash",
            "user_id": "u1",
            "input_tokens": 100,
            "output_tokens": 50,
            "session_id": "s1",
        }
        base.update(overrides)
        return base

    async def test_missing_provider_400(self, fake_service):
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(_req(), self._body(provider=""))
        assert ei.value.status_code == 400
        assert "provider" in ei.value.detail

    async def test_missing_model_400(self, fake_service):
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(_req(), self._body(model=""))
        assert ei.value.status_code == 400
        assert "model" in ei.value.detail

    async def test_missing_user_id_400(self, fake_service):
        """body 与 request.state 都无 user_id → 400。"""
        req = SimpleNamespace(state=SimpleNamespace(user_id=None))
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(req, self._body(user_id=None))
        assert ei.value.status_code == 400
        assert "user_id" in ei.value.detail

    async def test_negative_tokens_400(self, fake_service):
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(_req(), self._body(input_tokens=-1))
        assert ei.value.status_code == 400
        assert "token" in ei.value.detail

    async def test_negative_output_tokens_400(self, fake_service):
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(_req(), self._body(output_tokens=-5))
        assert ei.value.status_code == 400

    async def test_success(self, fake_service):
        resp = await usage_router.record_usage(_req(user_id="u1"), self._body())
        assert resp["code"] == 0
        assert resp["data"]["id"] == "rec-1"
        assert resp["data"]["estimated_cost"] == 0.001
        fake_service.record_usage.assert_called_once_with(
            provider="stepfun",
            model="step-3.7-flash",
            user_id="u1",
            input_tokens=100,
            output_tokens=50,
            session_id="s1",
        )

    async def test_success_user_id_from_request_state(self, fake_service):
        """body 无 user_id → 从 JWT 状态取。"""
        body = self._body(user_id=None)
        body.pop("user_id", None)
        resp = await usage_router.record_usage(_req(user_id="jwt-u1"), body)
        assert resp["code"] == 0
        assert fake_service.record_usage.call_args.kwargs["user_id"] == "jwt-u1"

    async def test_token_string_coerced(self, fake_service):
        """input_tokens 传字符串会被 int() 转换。"""
        await usage_router.record_usage(_req(), self._body(input_tokens="10", output_tokens="5"))
        kwargs = fake_service.record_usage.call_args.kwargs
        assert kwargs["input_tokens"] == 10
        assert kwargs["output_tokens"] == 5
