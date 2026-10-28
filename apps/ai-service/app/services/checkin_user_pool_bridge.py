# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手 → 个人号池反向同步(2026-10-23 立)。

用户在自己的签到助手里录入/换 token/启停/删除账号时,把同一归属的账号回填到
apps/api 的个人号池(ai_relay_account_pool.owner_user_id = 平台用户 id)。
与 O64 正向同步(号池 → 签到助手)合起来构成「同一归属内双向同步」:

- 正向: 号池导入/覆盖 → pool-sync → 签到侧 create_account 合并 → device_map.pool_account_id
- 反向: 用户录入/更新 → 本模块 POST /api/internal/relay/user-pool/upsert
        → importAccounts(ownerUserId) → 自动推回签到侧 → 双方拿到同一个 poolAccountId

失败绝不阻塞用户操作:失败摘要落 device_map.pool_bridge_pending,下次账号变更重试;
号池侧每 5 分钟对账收敛器也会按 poolAccountId 补齐差集(单向兜底)。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings
from app.core.internal_ticket import internal_service_headers
from app.core.logging import get_logger
from app.services.api_tools_bridge import api_base_url
from app.services.checkin_store import (
    POOL_SYNC_OWNER,
    derive_account_identity,
)

logger = get_logger(__name__)

UPSERT_PATH = "/api/internal/relay/user-pool/upsert"
DELETE_PATH = "/api/internal/relay/user-pool/delete"

# 有号池适配器的平台(与 apps/api internal-relay-user-pool 的同名白名单对齐);
# minimax 只有签到引擎、没有 relay 适配器 ⇒ 不建个人池行。
BRIDGE_PLATFORMS = frozenset({"trae", "workbuddy", "qoder"})

_BRIDGE_TIMEOUT = 8.0
_PENDING_KEY = "pool_bridge_pending"


def _identity_of(platform: str, jwt: str, device_map: dict[str, Any]) -> str:
    """个人池 uid 权威:与签到侧 identity_key 同源(derive_account_identity)。"""
    identity = derive_account_identity(platform, jwt, device_map)
    if identity:
        return identity
    uid = device_map.get("uid")
    return uid.strip() if isinstance(uid, str) and uid.strip() else ""


def _auth_headers(secret: str, owner_user_id: str) -> dict[str, str]:
    """反向同步请求鉴权头(经 internal_ticket 唯一出口构造,不再手拼常驻密钥头)。

    dual 兼容窗:X-Internal-Service-Token 旧头照发(legacy_token = ai_callback_secret,
    与既有机器凭据验真出口同源),x-internal-service-ticket 短期票同带 —— 主体绑定
    payload 里的 ownerUserId(两个端点 upsert/delete 都带,是真实的 apps/api 用户 id)。
    X-Internal-Secret 是本端点的机机凭据,与内部票两回事,经 extra 原样带上。
    scope 取封闭集里"ai-service 回调写入 apps/api"那一档(ai-callback);若后续 api 侧
    为 relay user-pool 端点声明更细的用途,须两侧同笔换档。
    """
    return internal_service_headers(
        owner_user_id,
        "ai-callback",
        legacy_token=secret,
        extra={"Content-Type": "application/json", "X-Internal-Secret": secret},
    )


async def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    secret = settings.ai_callback_secret
    if not secret:
        raise RuntimeError("ai_callback_secret 未配置,无法反向同步个人号池")
    url = f"{api_base_url().rstrip('/')}{path}"
    owner_user_id = str(payload.get("ownerUserId") or "").strip()
    async with httpx.AsyncClient(timeout=_BRIDGE_TIMEOUT) as client:
        resp = await client.post(
            url,
            json=payload,
            headers=_auth_headers(secret, owner_user_id),
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"个人号池 HTTP {resp.status_code}: {resp.text[:200]}")
    body = resp.json()
    data = body.get("data") if isinstance(body, dict) else None
    return data if isinstance(data, dict) else {}


async def sync_upsert(
    *,
    owner_user_id: str,
    account_id: int,
    platform: str,
    name: str,
    jwt: str,
    device_map: dict[str, Any],
    enabled: bool,
) -> tuple[bool, dict[str, Any]]:
    """把用户账号 upsert 到其个人号池。返回 (device_map 是否变化, device_map)。

    运营池系统账号、平台无号池适配器、身份解析不出 —— 一律零操作返回。
    """
    dm = dict(device_map or {})
    if owner_user_id == POOL_SYNC_OWNER or platform not in BRIDGE_PLATFORMS:
        return False, dm
    identity = _identity_of(platform, jwt, dm)
    if not identity:
        return False, dm
    payload: dict[str, Any] = {
        "ownerUserId": owner_user_id,
        "platform": platform,
        "checkinAccountId": account_id,
        "identityKey": identity,
        "name": name,
        "token": jwt,
        "enabled": enabled,
        "deviceMap": dm,
    }
    refresh_token = dm.get("refresh_token")
    if isinstance(refresh_token, str) and refresh_token:
        payload["refreshToken"] = refresh_token
    try:
        data = await _post(UPSERT_PATH, payload)
    except Exception as e:  # noqa: BLE001 — 反向同步是旁路,失败只留待重试
        dm[_PENDING_KEY] = {
            "at": datetime.now(UTC).isoformat(),
            "error": (str(e) or "未知错误")[:200],
        }
        logger.warning(
            "[checkin_user_pool_bridge] 个人号池同步失败,留待重试: account=%s err=%s",
            account_id,
            (str(e) or "未知错误")[:200],
        )
        return True, dm
    pool_account_id = data.get("poolAccountId")
    if isinstance(pool_account_id, str) and pool_account_id:
        dm["pool_account_id"] = pool_account_id
        dm["pool_uid"] = identity
        dm["pool_synced_at"] = datetime.now(UTC).isoformat()
        dm.pop(_PENDING_KEY, None)
        return True, dm
    # unsupported 等契约外响应:不假装成功,也不落 pending(永久失败重试无意义)
    dm.pop(_PENDING_KEY, None)
    logger.info(
        "[checkin_user_pool_bridge] 个人号池未接受该平台: account=%s platform=%s status=%s",
        account_id,
        platform,
        data.get("status"),
    )
    return True, dm


async def sync_delete(*, owner_user_id: str, pool_account_id: str) -> None:
    """签到账号删除时清掉对应个人池行。失败只记日志(号池对账器会按差集兜底)。"""
    if owner_user_id == POOL_SYNC_OWNER or not pool_account_id:
        return
    try:
        await _post(
            DELETE_PATH,
            {"ownerUserId": owner_user_id, "poolAccountId": pool_account_id},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "[checkin_user_pool_bridge] 个人号池删除同步失败: pool=%s err=%s",
            pool_account_id,
            (str(e) or "未知错误")[:200],
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
