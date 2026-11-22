# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO JIT 建号/签发失败路径(DBG-14 / DBG-15 / DBG-19)。

全离线:身份库切进程内后端(2026-11-19 起数据层只允许 PostgreSQL,测试隔离不再落
sqlite 文件);回调走 mock provider,不访问真实 IdP。
"""

from __future__ import annotations

import uuid

import jwt as pyjwt
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.routers import sso as sso_router
from app.services import sso_identity_store as store

_SECRET = "unit-test-sso-secret-0123456789abcdef"


@pytest.fixture(autouse=True)
def _isolate_sso_db(tmp_path):
    """每个用例独立身份库,不写 data/sso_identities.db。"""
    store.set_db_path(tmp_path / "sso_identities.db")
    yield tmp_path / "sso_identities.db"
    store.close()
    store.set_db_path(store.DEFAULT_DB_PATH)


def _callback_request(query: str) -> Request:
    """AIS-043:GET 回调强制校验 state —— 即时铸造一枚合法一次性 state 拼进 query。"""
    state = sso_router.new_state()
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/sso/callback",
            "query_string": f"{query}&state={state}".encode(),
            "headers": [],
        }
    )


def _decode(token: str) -> dict:
    return pyjwt.decode(
        token,
        _SECRET,
        algorithms=["HS256"],
        audience=sso_router.JWT_AUDIENCE,
        issuer=sso_router.settings.jwt_issuer,
    )


def _plant_identity(provider: str, subject: str, user_uuid: str) -> None:
    """模拟"别的进程已经把这个 (provider, subject) 建号并提交":直接写进当前后端。

    旧实现在 sqlite 上靠钩住 `BEGIN` 之前插一行;后端化之后不需要钩子 ——
    写进后端本身就是"已提交的既有行",语义等价且不依赖引擎细节。
    """
    assert store._get_backend().insert(
        provider, subject, "old@example.com", "Old", user_uuid, "t0"
    ) is True


# ---------------- 身份库 ----------------


def test_first_login_creates_and_second_reuses_same_uuid():
    first = store.find_or_create_identity("oidc", "sub", "a@x.io", "A")
    second = store.find_or_create_identity("oidc", "sub", "b@x.io", "B")
    assert first["created"] is True
    assert second["created"] is False
    assert first["user_uuid"] == second["user_uuid"]
    assert second["email"] == "b@x.io"
    assert second["name"] == "B"


def test_concurrent_unique_rereads_existing_identity():
    """DBG-15:首登唯一冲突后重读已有行,刷 email/name,不抛错。"""
    existing = "11111111-1111-1111-1111-111111111111"
    _plant_identity("oidc", "sub-race", existing)
    got = store.find_or_create_identity("oidc", "sub-race", "new@example.com", "New")
    assert got["created"] is False
    assert got["user_uuid"] == existing
    assert got["email"] == "new@example.com"
    assert got["name"] == "New"
    # 副作用落库:后端里那一行确实被刷成新值(不是只看返回值)
    backend = store._get_backend()
    row = backend.select("oidc", "sub-race")
    assert row is not None and row["user_uuid"] == existing


def test_unrelated_unique_conflict_still_raises(monkeypatch):
    """撞上的不是 (provider, subject) 时仍抛,不伪装成复用。"""
    fixed = uuid.UUID("22222222-2222-2222-2222-222222222222")
    monkeypatch.setattr(store.uuid, "uuid4", lambda: fixed)
    created = store.find_or_create_identity("oidc", "sub-a", "a@x.io", "A")
    assert created["user_uuid"] == str(fixed)
    with pytest.raises(store.IdentityConflict, match="user_uuid"):
        store.find_or_create_identity("oidc", "sub-b", "b@x.io", "B")


@pytest.mark.parametrize(
    ("method", "prepare"),
    [("insert", False), ("touch", True)],
    ids=["insert", "update"],
)
def test_backend_error_propagates_unchanged(monkeypatch, method, prepare):
    """后端抛出的错误必须原样冒到调用方:不被吞、不被改写成别的类型。

    (取代 DBG-19 的 sqlite 形态:那两条量的是"COMMIT 之后再 ROLLBACK 不得盖住真错",
      而显式 ROLLBACK 在 PostgreSQL 桥里已经不存在 —— 判据换成"错误不被吞"。)
    """
    if prepare:
        store.find_or_create_identity("oidc", "sub", "a@x.io", "A")

    backend = store._get_backend()

    def boom(*args, **kwargs):
        raise RuntimeError("后端真实错误")

    monkeypatch.setattr(backend, method, boom)
    with pytest.raises(RuntimeError, match="后端真实错误"):
        store.find_or_create_identity("oidc", "sub", "b@x.io", "B")


# ---------------- OIDC 回调 ----------------


async def test_oidc_callback_issues_access_token(monkeypatch):
    monkeypatch.setattr(sso_router.settings, "jwt_secret", _SECRET)
    body = await sso_router.callback_get(_callback_request("provider=mock&code=c1"))
    assert body["code"] == 0
    token = body["data"]["access_token"]
    assert isinstance(token, str) and token
    payload = _decode(token)
    assert payload["sub"] == body["data"]["user"]["id"]
    assert payload["type"] == "access"
    assert body["data"]["user"]["created"] is True
    assert body["data"]["provisioned"] is True


async def test_oidc_callback_jit_failure_is_not_success(monkeypatch):
    """DBG-14:建号异常不得再以 code 0、且没有 access_token 的成功包返回。"""
    monkeypatch.setattr(sso_router.settings, "jwt_secret", _SECRET)

    def _boom(*_args, **_kwargs):
        raise RuntimeError("jit down")

    monkeypatch.setattr(sso_router, "find_or_create_identity", _boom)
    with pytest.raises(HTTPException) as exc:
        await sso_router.callback_get(_callback_request("provider=mock&code=c1"))
    assert exc.value.status_code == 500
    assert exc.value.detail == "JIT 建号/JWT 签发失败"


async def test_oidc_callback_sign_failure_is_not_success(monkeypatch):
    """DBG-14:签发异常同样必须失败,不能降级成成功身份包。"""
    monkeypatch.setattr(sso_router.settings, "jwt_secret", _SECRET)

    def _boom(*_args, **_kwargs):
        raise RuntimeError("sign down")

    monkeypatch.setattr(sso_router.pyjwt, "encode", _boom)
    with pytest.raises(HTTPException) as exc:
        await sso_router.callback_get(_callback_request("provider=mock&code=c1"))
    assert exc.value.status_code == 500
    assert exc.value.detail == "JIT 建号/JWT 签发失败"


async def test_oidc_callback_unique_conflict_still_issues_token(monkeypatch):
    """DBG-15 叠在回调上:冲突后重读已有身份,并继续签发 access_token。"""
    monkeypatch.setattr(sso_router.settings, "jwt_secret", _SECRET)
    existing = "33333333-3333-3333-3333-333333333333"
    _plant_identity("mock", "mock-user-1", existing)
    body = await sso_router.callback_get(_callback_request("provider=mock&code=c1"))
    assert body["code"] == 0
    assert body["data"]["user"]["id"] == existing
    assert body["data"]["user"]["created"] is False
    assert body["data"]["provisioned"] is True
    assert _decode(body["data"]["access_token"])["sub"] == existing


async def test_missing_jwt_secret_stays_identity_only(monkeypatch):
    """未配置密钥仍是显式降级,不建号、不签发,也不是 500。"""
    monkeypatch.setattr(sso_router.settings, "jwt_secret", "")
    body = await sso_router.callback_get(_callback_request("provider=mock&code=c1"))
    assert body["code"] == 0
    assert body["data"]["provisioned"] is False
    assert "access_token" not in body["data"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
