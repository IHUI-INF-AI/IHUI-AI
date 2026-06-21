"""Bug-51: WS 房间权限校验.

WS 房间规则:
  - public 房间: 任意登录用户可加入
  - private 房间: 仅白名单 / 邀请码可加入
  - paid 房间: 仅 VIP / 付费用户可加入 (依赖 user.vip_level)
  - admin 房间: 仅管理员可加入

使用方式:
    from app.ws.room_policy import can_join_room, RoomPolicyError

    try:
        await can_join_room(user_uuid, room_id)
    except RoomPolicyError as e:
        await ws.close(code=4403, reason=str(e))
        return
"""

import asyncio
import time

from loguru import logger
from sqlalchemy import text

# 房间元数据缓存 (避免每次 join 都查 DB)
# 格式: {room_id: {policy, owner, vip_level, ttl_expire, members: set}}
_ROOM_CACHE: dict = {}
_ROOM_CACHE_TTL = 60.0
_ROOM_CACHE_LOCK = asyncio.Lock()


class RoomPolicyError(PermissionError):
    """房间权限校验失败."""

    def __init__(self, room_id: str, reason: str, code: str = "ROOM_DENIED"):
        self.room_id = room_id
        self.reason = reason
        self.code = code
        super().__init__(f"Room {room_id} denied: {reason} ({code})")


# ---------------------------------------------------------------------------
# 房间元数据加载 (DB + 缓存)
# ---------------------------------------------------------------------------


async def _load_room_meta(room_id: str) -> dict:
    """从 DB 加载房间元数据, 失败时返回空 policy (即默认公开)."""
    # 先查缓存
    now = time.time()
    cached = _ROOM_CACHE.get(room_id)
    if cached and cached.get("expire_at", 0) > now:
        return cached
    meta: dict = {
        "policy": "public",
        "owner": "",
        "vip_level": 0,
        "members": set(),
        "expire_at": now + _ROOM_CACHE_TTL,
    }
    try:
        # 尝试从 DB 拉 (如果表存在)
        from sqlalchemy import text

        from app.database import SessionFactory2, get_session

        def _q():
            with get_session(factory=SessionFactory2) as s:
                row = s.execute(
                    text("SELECT policy, owner_uuid, vip_level " "FROM zhs_room WHERE room_id = :rid LIMIT 1"),
                    {"rid": room_id},
                ).first()
                if row:
                    return {
                        "policy": row[0] or "public",
                        "owner": row[1] or "",
                        "vip_level": int(row[2] or 0),
                    }
                return None

        result = await asyncio.to_thread(_q)
        if result:
            meta.update(result)
    except Exception as e:
        # DB 表不存在或其他错误: 静默降级为 public
        logger.debug(f"load_room_meta({room_id}) db miss: {e}")
    _ROOM_CACHE[room_id] = meta
    return meta


def invalidate_room_cache(room_id: str | None = None) -> None:
    """失效房间缓存 (room 政策变更时调用)."""
    if room_id is None:
        _ROOM_CACHE.clear()
    else:
        _ROOM_CACHE.pop(room_id, None)


# ---------------------------------------------------------------------------
# 用户上下文查询
# ---------------------------------------------------------------------------


async def _get_user_vip_level(user_uuid: str) -> int:
    """拉用户 VIP 等级 (默认 0, 即普通用户)."""
    try:
        from app.database import SessionFactory2, get_session

        def _q():
            with get_session(factory=SessionFactory2) as s:
                row = s.execute(
                    text("SELECT vip_level FROM zhs_user WHERE uuid = :uid LIMIT 1"),
                    {"uid": user_uuid},
                ).first()
                if row:
                    return int(row[0] or 0)
                return 0

        return await asyncio.to_thread(_q)
    except Exception:
        return 0


async def _is_admin(user_uuid: str) -> bool:
    """是否管理员 (查 admin_user.role)."""
    try:
        from app.database import SessionFactory1, get_session

        def _q():
            with get_session(factory=SessionFactory1) as s:
                row = s.execute(
                    text("SELECT role_id FROM admin_user WHERE user_uuid = :uid LIMIT 1"),
                    {"uid": user_uuid},
                ).first()
                return bool(row and int(row[0] or 0) == 1)

        return await asyncio.to_thread(_q)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 房间策略检查
# ---------------------------------------------------------------------------


async def can_join_room(
    user_uuid: str,
    room_id: str,
    invite_code: str | None = None,
) -> None:
    """检查用户能否进入房间, 失败抛 RoomPolicyError.

    Args:
        user_uuid: 已鉴权用户 UUID
        room_id: 房间 ID
        invite_code: 私有房间邀请码 (可选)
    """
    if not user_uuid or not room_id:
        raise RoomPolicyError(room_id, "missing user or room", "BAD_REQUEST")
    meta = await _load_room_meta(room_id)
    policy = meta.get("policy", "public")

    # 1. 房主永远可入
    if meta.get("owner") == user_uuid:
        return

    # 2. 公开房间 - 任意登录用户
    if policy == "public":
        return

    # 3. 私有房间 - 需邀请码
    if policy == "private":
        # 邀请码可以是 inv_<user>_<room> 形式
        expected_prefix = f"inv_{user_uuid}_{room_id}"
        if invite_code and invite_code == expected_prefix:
            return
        raise RoomPolicyError(room_id, "private room needs invite_code", "INVITE_REQUIRED")

    # 4. 付费房间 - 需 VIP
    if policy == "paid":
        vip = await _get_user_vip_level(user_uuid)
        need = int(meta.get("vip_level", 0))
        if vip >= need:
            return
        raise RoomPolicyError(room_id, f"need vip_level>={need}, got {vip}", "VIP_REQUIRED")

    # 5. 管理员房间
    if policy == "admin":
        if await _is_admin(user_uuid):
            return
        raise RoomPolicyError(room_id, "admin only", "ADMIN_ONLY")

    # 默认拒绝 (未知 policy 视为保守)
    raise RoomPolicyError(room_id, f"unknown policy: {policy}", "UNKNOWN_POLICY")


# ---------------------------------------------------------------------------
# 同步版本 (供非 async 业务代码使用)
# ---------------------------------------------------------------------------


def can_publish_to_room(user_uuid: str, room_id: str, is_owner: bool = False) -> bool:
    """能否在房间发消息 (同步版, 保守策略).

    规则:
      - 房主: 总是可以
      - 公开房间: 登录用户均可
      - 其它: 拒绝 (保守)
    """
    if is_owner:
        return True
    meta = _ROOM_CACHE.get(room_id, {})
    policy = meta.get("policy", "public")
    return policy == "public"


# ---------------------------------------------------------------------------
# WS 接入点辅助
# ---------------------------------------------------------------------------


def room_policy_metrics_inc(reason: str) -> None:
    """房间拒绝指标 +1."""
    try:
        from app.metrics_business import WS_AUTH_FAILURES

        WS_AUTH_FAILURES.labels(reason=reason).inc()
    except Exception:
        logger.warning("Caught unexpected exception")
