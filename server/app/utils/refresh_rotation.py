"""Bug-53: JWT Refresh Token 轮转 (Rotation).

设计:
  - 每次 refresh 颁发新 access + 新 refresh
  - 旧 refresh 的 jti 进入黑名单 (Redis), 7 天内禁止再用
  - 检测 token 重放: 同 family_id 的 refresh 被使用两次 → 整个 family 失效 (用户必须重新登录)

存储:
  - Redis ZSET: zhs:refresh:family:<fid> 记录所有已使用 jti (score=ts)
  - Redis SET:  zhs:refresh:revoked:<jti> 单个 jti 黑名单
"""

import time

from loguru import logger

REVOKED_TTL = 7 * 24 * 3600  # 7 天
FAMILY_TTL = 30 * 24 * 3600  # 30 天


def _get_redis():
    try:
        from app.utils.redis_client import get_redis

        return get_redis()
    except Exception as e:
        logger.debug(f"refresh redis unavailable: {e}")
        return None


def _family_key(fid: str) -> str:
    return f"zhs:refresh:family:{fid}"


def _revoked_key(jti: str) -> str:
    return f"zhs:refresh:revoked:{jti}"


def record_jti_used(jti: str, family_id: str) -> None:
    """记录 jti 在某个 family 下被用过 (score=ts)."""
    r = _get_redis()
    if r is None:
        return
    try:
        # 1) family 集合
        r.zadd(_family_key(family_id), {jti: time.time()})
        r.expire(_family_key(family_id), FAMILY_TTL)
    except Exception as e:
        logger.debug(f"record_jti_used err: {e}")


def is_jti_revoked(jti: str) -> bool:
    r = _get_redis()
    if r is None:
        return False
    try:
        return bool(r.exists(_revoked_key(jti)))
    except Exception:
        return False


def is_replay_attack(jti: str, family_id: str) -> bool:
    """jti 在同一 family 已经被用过 → 重放攻击.

    Returns:
        True: 拒绝 (整 family 失效)
    """
    r = _get_redis()
    if r is None:
        return False
    try:
        # 是否 family 集合里已经有这个 jti (说明之前 refresh 时用过, 现在又来了)
        score = r.zscore(_family_key(family_id), jti)
        return score is not None
    except Exception:
        return False


def revoke_jti(jti: str) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.set(_revoked_key(jti), "1", ex=REVOKED_TTL)
    except Exception:
        logger.warning("Caught unexpected exception")


def revoke_family(family_id: str) -> int:
    """把 family 全部 jti 拉黑, 返回拉黑数量."""
    r = _get_redis()
    if r is None:
        return 0
    try:
        jtis = r.zrange(_family_key(family_id), 0, -1)
        n = 0
        pipe = r.pipeline()
        for j in jtis:
            pipe.set(_revoked_key(j), "1", ex=REVOKED_TTL)
            n += 1
        pipe.execute()
        return n
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# 轮转主入口
# ---------------------------------------------------------------------------


def rotate_refresh(
    refresh_token_payload: dict,
) -> tuple[str, str, str, str] | None:
    """处理 refresh 请求, 颁发新 access + 新 refresh.

    Args:
        refresh_token_payload: 解码后的 refresh token claims

    Returns:
        (new_access, new_refresh, new_jti, new_family_id)
        或 None 表示拒绝 (重放攻击 / 类型错 / 已被撤销)
    """
    jti = refresh_token_payload.get("jti")
    family_id = refresh_token_payload.get("family_id")
    sub = refresh_token_payload.get("sub")
    typ = refresh_token_payload.get("type")

    # 类型校验
    if typ != "refresh":
        return None
    if not (jti and family_id and sub):
        return None
    # 已撤销
    if is_jti_revoked(jti):
        return None
    # 重放检测: 同一 jti 第二次使用
    if is_replay_attack(jti, family_id):
        # 整 family 失效
        revoke_family(family_id)
        try:
            from app.utils.alert_router import alert_critical

            alert_critical(
                f"refresh_replay_attack:{family_id}",
                f"Refresh token replay detected for family {family_id}, sub {sub}",
            )
        except Exception:
            logger.warning("Caught unexpected exception")
        return None

    # 标记当前 jti 已用 + 拉黑
    record_jti_used(jti, family_id)
    revoke_jti(jti)

    # 颁发新一对
    from app.security import create_access_token, create_refresh_token

    new_access = create_access_token(sub)
    new_refresh, new_jti, new_fid = create_refresh_token(sub, family_id)
    return new_access, new_refresh, new_jti, new_fid
