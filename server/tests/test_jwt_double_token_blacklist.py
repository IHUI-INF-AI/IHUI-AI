"""JWT 双 token + 黑名单回归测试.

覆盖:
- create_access_token / create_refresh_token 正常生成
- decode_access_token 验证
- 黑名单: revoke_token 后 is_jwt_revoked 返回 True
- 黑名单: 未吊销的 token 不在黑名单
- refresh token 类型正确 (type=refresh)
- 篡改 token 后解码失败
"""
import time

import pytest


def test_access_token_creation():
    from app.security import create_access_token, decode_access_token

    token = create_access_token("user-uuid-123", expires_delta=__import__("datetime").timedelta(minutes=5))
    assert token, "未生成 access token"
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "user-uuid-123"
    assert payload.get("type") == "access"
    assert "jti" in payload
    assert "exp" in payload


def test_refresh_token_creation():
    from app.security import create_refresh_token, decode_access_token

    token, jti, fid = create_refresh_token("user-uuid-456")
    assert token, "未生成 refresh token"
    assert jti, "未返回 jti"
    assert fid, "未返回 family_id"
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "user-uuid-456"
    assert payload.get("type") == "refresh"
    assert payload.get("jti") == jti
    assert payload.get("family_id") == fid


def test_token_tampering_fails():
    from app.security import create_access_token, decode_access_token

    token = create_access_token("user-uuid-789")
    # 篡改最后一位
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    payload = decode_access_token(tampered)
    assert payload is None, "篡改的 token 不应通过验证"


def test_jwt_blacklist_revoke_and_check():
    from app.core.jwt_blacklist import is_jwt_revoked, revoke_token
    from app.security import create_access_token

    token = create_access_token("user-uuid-blacklist", expires_delta=__import__("datetime").timedelta(minutes=5))

    # 初始: 不在黑名单
    assert is_jwt_revoked(token) is False, "新签发的 token 不应在黑名单"

    # 吊销
    ok = revoke_token(token, ttl_seconds=60)
    assert ok, "revoke_token 应成功"

    # 立即检查: 在黑名单
    assert is_jwt_revoked(token) is True, "吊销后应在黑名单"


def test_jwt_blacklist_independent_tokens():
    from app.core.jwt_blacklist import is_jwt_revoked, revoke_token
    from app.security import create_access_token

    t1 = create_access_token("user-1")
    t2 = create_access_token("user-2")

    revoke_token(t1, ttl_seconds=60)

    assert is_jwt_revoked(t1) is True
    assert is_jwt_revoked(t2) is False, "t2 不应受 t1 吊销影响"


def test_token_expiration():
    """过期 token 应解码失败."""
    from app.security import create_access_token, decode_access_token

    # 极短过期 (1 秒)
    import datetime as dt

    token = create_access_token("user-exp", expires_delta=dt.timedelta(seconds=-10))
    # 负 delta = 已过期
    payload = decode_access_token(token)
    assert payload is None, "过期 token 不应通过验证"


def test_extra_claims_in_token():
    from app.security import create_access_token, decode_access_token

    token = create_access_token("user-extra", extra_claims={"role": "admin", "tenant_id": 1})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("role") == "admin"
    assert payload.get("tenant_id") == 1
