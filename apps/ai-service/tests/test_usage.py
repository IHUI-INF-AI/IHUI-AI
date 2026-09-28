# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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

from app.core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL
from app.routers import usage as usage_router

# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------


def _req(user_id: str | None = "u1", role_id: int = 0) -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id, role_id=role_id))


def _enforce_auth(monkeypatch: Any, enforced: bool = True) -> None:
    """把"是否全局强制鉴权"钉成显式取值。

    为什么必须显式钉:`require_request_user_id` 在未强制时回落 `DEV_ANONYMOUS_PRINCIPAL`
    (为的是 ASGI in-process 的既有测试不整片 401),于是"缺身份该 401 还是走降级"
    取决于**环境** —— 不钉就会在 CI 与本机给出不同结论,而这两种行为都是契约的一部分。
    """
    monkeypatch.setattr("app.core.jwt_auth.auth_globally_enforced", lambda: enforced)


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
    async def test_no_identity_401_when_auth_enforced(self, fake_service, monkeypatch):
        """强制鉴权下没有令牌主体 → 401(旧契约的"缺 user_id 参数 400"已随收紧作废)。"""
        _enforce_auth(monkeypatch, True)
        req = SimpleNamespace(state=SimpleNamespace(user_id=None, role_id=0))
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_usage_stats(req, days=7, user_id=None)
        assert ei.value.status_code == 401

    async def test_no_identity_dev_downgrade_uses_single_principal(self, fake_service, monkeypatch):
        """未强制鉴权(ASGI in-process / 本机 dev)→ 回落单一身份,不是匿名全量。"""
        _enforce_auth(monkeypatch, False)
        req = SimpleNamespace(state=SimpleNamespace(user_id=None, role_id=0))
        resp = await usage_router.get_usage_stats(req, days=7, user_id=None)
        assert resp["code"] == 0
        fake_service.get_user_stats.assert_called_once_with(DEV_ANONYMOUS_PRINCIPAL, days=7)

    async def test_cross_user_query_is_403_for_non_admin(self, fake_service, monkeypatch):
        """收紧点本身:自报 user_id 不得覆盖令牌主体,非管理员代查一律 403。"""
        _enforce_auth(monkeypatch, True)
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_usage_stats(_req(user_id="other"), days=7, user_id="admin")
        assert ei.value.status_code == 403

    async def test_admin_may_scope_to_other(self, fake_service, monkeypatch):
        """管理员(roleId ≥ 1)仍可代查他人 —— 收紧没把合法管理面打死。"""
        _enforce_auth(monkeypatch, True)
        resp = await usage_router.get_usage_stats(
            _req(user_id="other", role_id=1), days=7, user_id="admin"
        )
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
    async def test_no_identity_401_when_auth_enforced(self, fake_service, monkeypatch):
        _enforce_auth(monkeypatch, True)
        req = SimpleNamespace(state=SimpleNamespace(user_id=None, role_id=0))
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_quota_info(req, user_id=None)
        assert ei.value.status_code == 401

    async def test_cross_user_query_is_403_for_non_admin(self, fake_service, monkeypatch):
        _enforce_auth(monkeypatch, True)
        with pytest.raises(HTTPException) as ei:
            await usage_router.get_quota_info(_req(user_id="other"), user_id="admin")
        assert ei.value.status_code == 403

    async def test_admin_may_scope_to_other(self, fake_service, monkeypatch):
        _enforce_auth(monkeypatch, True)
        resp = await usage_router.get_quota_info(_req(user_id="other", role_id=1), user_id="admin")
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

    async def test_missing_identity_401_when_auth_enforced(self, fake_service, monkeypatch):
        """自报 body.user_id 不再是身份来源;缺令牌主体在强制鉴权下是 401(旧契约的 400 作废)。"""
        _enforce_auth(monkeypatch, True)
        req = SimpleNamespace(state=SimpleNamespace(user_id=None, role_id=0))
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(req, self._body(user_id=None))
        assert ei.value.status_code == 401

    async def test_body_cannot_impersonate_other_user(self, fake_service, monkeypatch):
        """收紧点:body 里写别人的 user_id 不再是"静默采纳",而是 403(比"忽略并覆盖"更明确)。"""
        _enforce_auth(monkeypatch, True)
        with pytest.raises(HTTPException) as ei:
            await usage_router.record_usage(_req(user_id="u1"), self._body(user_id="someone-else"))
        assert ei.value.status_code == 403
        fake_service.record_usage.assert_not_called()

    async def test_body_user_id_equal_to_subject_still_records(self, fake_service, monkeypatch):
        """正向对照(上一条不是恒红):body 写自己的 id 照常记账,落在令牌主体上。"""
        _enforce_auth(monkeypatch, True)
        resp = await usage_router.record_usage(_req(user_id="u1"), self._body(user_id="u1"))
        assert resp["code"] == 0
        assert fake_service.record_usage.call_args.kwargs["user_id"] == "u1"

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
