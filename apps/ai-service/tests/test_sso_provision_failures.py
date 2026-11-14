# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO JIT 建号/签发失败路径(DBG-14 / DBG-15 / DBG-19)。

全离线:身份库注入临时 sqlite;回调走 mock provider,不访问真实 IdP。
"""

from __future__ import annotations

import sqlite3
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
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/sso/callback",
            "query_string": query.encode(),
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


class _ExecuteProxy:
    """包住 Connection.execute。sqlite3.Connection 是不可变 C 类型,方法不能 monkeypatch。"""

    def __init__(self, inner: sqlite3.Connection, hook) -> None:
        object.__setattr__(self, "_inner", inner)
        object.__setattr__(self, "_hook", hook)

    def execute(self, sql, parameters=(), /):
        return self._hook(self._inner, sql, parameters)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def __setattr__(self, name, value):
        setattr(self._inner, name, value)


def _wrap_new_connections(monkeypatch: pytest.MonkeyPatch, hook) -> None:
    """store 之后新打开的连接,execute 改走 hook(inner, sql, parameters)。"""
    real_connect = store.sqlite3.connect

    def connect(database, *args, **kwargs):
        return _ExecuteProxy(real_connect(database, *args, **kwargs), hook)

    monkeypatch.setattr(store.sqlite3, "connect", connect)


def _plant_identity_before_first_begin(
    monkeypatch: pytest.MonkeyPatch, provider: str, subject: str, user_uuid: str
) -> None:
    """在首次 BEGIN 之前插入已提交行,模拟 SELECT 之后、INSERT 之前的并发建号。"""
    planted = {"done": False}

    def hook(inner, sql, parameters):
        if (
            not planted["done"]
            and isinstance(sql, str)
            and sql.lstrip().upper().startswith("BEGIN")
        ):
            planted["done"] = True
            # isolation_level=None:这条 INSERT 立即提交,随后的 BEGIN/INSERT 撞 UNIQUE。
            inner.execute(
                "INSERT INTO sso_identities "
                "(provider, subject, email, name, user_uuid, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?)",
                (provider, subject, "old@example.com", "Old", user_uuid, "t0", "t0"),
            )
        return inner.execute(sql, parameters)

    _wrap_new_connections(monkeypatch, hook)


# ---------------- 身份库 ----------------


def test_first_login_creates_and_second_reuses_same_uuid():
    first = store.find_or_create_identity("oidc", "sub", "a@x.io", "A")
    second = store.find_or_create_identity("oidc", "sub", "b@x.io", "B")
    assert first["created"] is True
    assert second["created"] is False
    assert first["user_uuid"] == second["user_uuid"]
    assert second["email"] == "b@x.io"
    assert second["name"] == "B"


def test_concurrent_unique_rereads_existing_identity(tmp_path, monkeypatch):
    """DBG-15:首登 UNIQUE 冲突后重读已有行,刷 email/name,不抛错。"""
    existing = "11111111-1111-1111-1111-111111111111"
    _plant_identity_before_first_begin(monkeypatch, "oidc", "sub-race", existing)
    got = store.find_or_create_identity("oidc", "sub-race", "new@example.com", "New")
    assert got["created"] is False
    assert got["user_uuid"] == existing
    assert got["email"] == "new@example.com"
    assert got["name"] == "New"
    raw = sqlite3.connect(tmp_path / "sso_identities.db")
    try:
        rows = raw.execute(
            "SELECT user_uuid, email, name FROM sso_identities ORDER BY id"
        ).fetchall()
    finally:
        raw.close()
    assert rows == [(existing, "new@example.com", "New")]


def test_unrelated_unique_conflict_still_raises(monkeypatch):
    """撞上的不是 (provider, subject) 时仍抛 IntegrityError,不伪装成复用。"""
    fixed = uuid.UUID("22222222-2222-2222-2222-222222222222")
    monkeypatch.setattr(store.uuid, "uuid4", lambda: fixed)
    created = store.find_or_create_identity("oidc", "sub-a", "a@x.io", "A")
    assert created["user_uuid"] == str(fixed)
    with pytest.raises(sqlite3.IntegrityError, match="user_uuid"):
        store.find_or_create_identity("oidc", "sub-b", "b@x.io", "B")


@pytest.mark.parametrize("prepare", [False, True], ids=["insert", "update"])
def test_error_after_commit_is_not_masked(monkeypatch, prepare):
    """DBG-19:COMMIT 已经结束后再 ROLLBACK,不得盖住真实错误。"""
    if prepare:
        store.find_or_create_identity("oidc", "sub", "a@x.io", "A")
        store.close()

    def hook(inner, sql, parameters):
        result = inner.execute(sql, parameters)
        if isinstance(sql, str) and sql.strip().upper() == "COMMIT":
            raise RuntimeError("提交已完成之后的真实错误")
        return result

    _wrap_new_connections(monkeypatch, hook)
    with pytest.raises(RuntimeError, match="提交已完成之后的真实错误"):
        store.find_or_create_identity("oidc", "sub", "b@x.io", "B")


@pytest.mark.parametrize(
    ("sql_prefix", "prepare"),
    [("INSERT INTO sso_identities", False), ("UPDATE sso_identities", True)],
    ids=["insert", "update"],
)
def test_error_after_rollback_is_not_masked(monkeypatch, sql_prefix, prepare):
    """DBG-19:事务已经回滚后再 ROLLBACK,不得盖住真实错误。"""
    if prepare:
        store.find_or_create_identity("oidc", "sub", "a@x.io", "A")
        store.close()
    prefix = sql_prefix.upper()

    def hook(inner, sql, parameters):
        if isinstance(sql, str) and sql.lstrip().upper().startswith(prefix):
            if inner.in_transaction:
                inner.execute("ROLLBACK")
            raise RuntimeError("事务已结束后的真实错误")
        return inner.execute(sql, parameters)

    _wrap_new_connections(monkeypatch, hook)
    with pytest.raises(RuntimeError, match="事务已结束后的真实错误"):
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
    _plant_identity_before_first_begin(monkeypatch, "mock", "mock-user-1", existing)
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
