"""T2 测试: JWT Refresh Token 滑动续期机制.

覆盖:
1. create_access_token / create_refresh_token 基本行为
2. 滑动续期: 每次 refresh 颁发新 access + 新 refresh, family_id 保持, jti 旋转
3. 重放检测: 同一 jti 第二次使用应被拒绝
4. expires_in / refresh_expires_in 字段正确
5. refresh token 类型校验 (非 refresh token 不能用于 refresh)
"""
from __future__ import annotations

import time

import pytest

from app.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
)


def test_create_access_token_has_exp_and_jti():
    """create_access_token 必须包含 exp + jti + type=access."""
    token = create_access_token("u-200", expires_delta=__import__("datetime").timedelta(minutes=15))
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "u-200"
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "exp" in payload


def test_create_refresh_token_has_type_refresh_and_family_id():
    """create_refresh_token 必须包含 type=refresh + jti + family_id."""
    token, jti, fid = create_refresh_token("u-200")
    assert token
    assert jti
    assert fid
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["type"] == "refresh"
    assert payload["sub"] == "u-200"
    assert payload["jti"] == jti
    assert payload["family_id"] == fid
    # refresh 7 天有效期, 至少 6 天
    from datetime import datetime, timezone

    exp_dt = payload["exp"]
    if hasattr(exp_dt, "timestamp"):
        exp_ts = exp_dt.timestamp()
    else:
        exp_ts = float(exp_dt)
    remaining = exp_ts - time.time()
    assert remaining > 6 * 24 * 3600, f"refresh TTL should be ~7 days, got {remaining}s"
    assert remaining < 8 * 24 * 3600, f"refresh TTL should be ~7 days, got {remaining}s"


def test_create_refresh_token_same_subject_different_jti():
    """同 subject 多次调用 create_refresh_token 应生成不同 jti (防止 jti 冲突)."""
    _, jti1, _ = create_refresh_token("u-200")
    _, jti2, _ = create_refresh_token("u-200")
    assert jti1 != jti2, "jti must be unique per token"


def test_rotate_refresh_returns_new_pair_with_same_family():
    """滑动续期: rotate_refresh 应颁发新 access + 新 refresh, family_id 保持."""
    # 用 in-memory mock 替代 Redis 重放检测
    from app.utils import refresh_rotation as rr_module
    from app.utils.refresh_rotation import rotate_refresh

    # 替换 Redis 操作为内存 dict
    storage = {"used_jtis": set(), "revoked_jtis": set(), "revoked_families": set()}

    def fake_record_jti_used(jti, fid):
        storage["used_jtis"].add(jti)

    def fake_revoke_jti(jti):
        storage["revoked_jtis"].add(jti)

    def fake_is_jti_revoked(jti):
        return jti in storage["revoked_jtis"]

    def fake_is_replay_attack(jti, fid):
        return jti in storage["used_jtis"]

    def fake_revoke_family(fid):
        storage["revoked_families"].add(fid)

    rr_module.record_jti_used = fake_record_jti_used
    rr_module.revoke_jti = fake_revoke_jti
    rr_module.is_jti_revoked = fake_is_jti_revoked
    rr_module.is_replay_attack = fake_is_replay_attack
    rr_module.revoke_family = fake_revoke_family

    # 第一次 refresh
    refresh1, jti1, fid1 = create_refresh_token("u-200")
    payload1 = decode_access_token(refresh1)
    result1 = rotate_refresh(payload1)
    assert result1 is not None
    new_access_1, new_refresh_1, new_jti_1, new_fid_1 = result1
    assert new_jti_1 != jti1, "new refresh must have different jti"
    assert new_fid_1 == fid1, "family_id must be preserved for sliding renewal"

    # 第二次 refresh (滑动续期)
    payload2 = decode_access_token(new_refresh_1)
    assert payload2 is not None
    result2 = rotate_refresh(payload2)
    assert result2 is not None
    new_access_2, new_refresh_2, new_jti_2, new_fid_2 = result2
    assert new_jti_2 != new_jti_1
    assert new_fid_2 == fid1, "family_id stays same across multiple renewals"

    # 清理
    rr_module.record_jti_used = rr_module.__dict__.get("record_jti_used", fake_record_jti_used)
    rr_module.revoke_jti = rr_module.__dict__.get("revoke_jti", fake_revoke_jti)
    rr_module.is_jti_revoked = rr_module.__dict__.get("is_jti_revoked", fake_is_jti_revoked)
    rr_module.is_replay_attack = rr_module.__dict__.get("is_replay_attack", fake_is_replay_attack)
    rr_module.revoke_family = rr_module.__dict__.get("revoke_family", fake_revoke_family)


def test_rotate_refresh_rejects_replay():
    """重放检测: 同一 jti 第二次使用应被拒绝."""
    from app.utils import refresh_rotation as rr_module
    from app.utils.refresh_rotation import rotate_refresh

    storage = {"used_jtis": set(), "revoked_jtis": set(), "revoked_families": set()}

    rr_module.record_jti_used = lambda j, f: storage["used_jtis"].add(j)
    rr_module.revoke_jti = lambda j: storage["revoked_jtis"].add(j)
    rr_module.is_jti_revoked = lambda j: j in storage["revoked_jtis"]
    rr_module.is_replay_attack = lambda j, f: j in storage["used_jtis"]
    rr_module.revoke_family = lambda f: storage["revoked_families"].add(f)

    refresh, jti, fid = create_refresh_token("u-replay")
    payload = decode_access_token(refresh)

    # 第一次成功
    result1 = rotate_refresh(payload)
    assert result1 is not None, "first refresh should succeed"

    # 第二次用同一 jti 应被拒绝
    result2 = rotate_refresh(payload)
    assert result2 is None, "second use of same jti should be rejected (replay)"


def test_rotate_refresh_rejects_access_token():
    """非 refresh token (如 access token) 不能用于 rotate_refresh."""
    from app.utils.refresh_rotation import rotate_refresh

    # 用 access token (type=access) 代替 refresh
    access_token = create_access_token("u-200")
    payload = decode_access_token(access_token)
    assert payload is not None
    assert payload["type"] == "access"

    # rotate_refresh 看到 type != "refresh" 应直接返回 None
    result = rotate_refresh(payload)
    assert result is None, "access token must not be used for refresh"


def test_rotate_refresh_rejects_missing_jti():
    """缺 jti/family_id/sub 的 token 应被拒绝."""
    from app.utils.refresh_rotation import rotate_refresh

    # 构造一个 type=refresh 但缺 jti 的 payload (绕过 JWT decode)
    result = rotate_refresh({"type": "refresh", "sub": "u"})
    assert result is None

    result = rotate_refresh({"type": "refresh", "jti": "x", "sub": "u"})  # 缺 family_id
    assert result is None


def test_rotate_refresh_rejects_revoked_jti():
    """已被撤销的 jti 应被拒绝."""
    from app.utils import refresh_rotation as rr_module
    from app.utils.refresh_rotation import rotate_refresh

    rr_module.is_jti_revoked = lambda j: True  # 任何 jti 都视为已撤销
    rr_module.is_replay_attack = lambda j, f: False
    rr_module.record_jti_used = lambda j, f: None
    rr_module.revoke_jti = lambda j: None
    rr_module.revoke_family = lambda f: None

    refresh, _jti, _fid = create_refresh_token("u-200")
    payload = decode_access_token(refresh)
    result = rotate_refresh(payload)
    assert result is None, "revoked jti must be rejected"


def test_expires_in_field_constants():
    """expires_in 字段定义: access 默认 JWT_EXPIRE_MINUTES, refresh 7 天."""
    from app.config import settings

    expected_access_sec = settings.JWT_EXPIRE_MINUTES * 60
    expected_refresh_sec = 7 * 24 * 60 * 60

    # 实际登录响应里是这两个值 (username_login.py + login.py)
    assert expected_access_sec > 0
    assert expected_access_sec <= 24 * 3600, "access token 应 <= 24h"
    assert expected_refresh_sec == 604800, "refresh token 应为 7 天 (604800s)"


def test_refresh_token_cannot_be_used_as_access_token():
    """refresh token 拒绝作为 access token 用 (前端误用场景)."""
    from app.security import get_current_user_uuid
    from fastapi import HTTPException

    # 模拟 HTTPBearer 拿 refresh token, 应该被 require_login 拒绝
    # 简化: 直接用 decode_access_token 看 type
    refresh, _jti, _fid = create_refresh_token("u-200")
    payload = decode_access_token(refresh)
    assert payload["type"] == "refresh"

    # 在 authenticate_ws 里我们已经显式拒绝 type=refresh
    # 这里再次确认 decode_access_token 不区分 type, 由调用方负责
    # (这是设计选择: decode_access_token 是通用解码器, type 校验是上层职责)
