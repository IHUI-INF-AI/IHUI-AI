# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""O64 签到刷新凭证回写号池(2026-10-23 立,设计 docs/engineering/account-pool-checkin-sync-design.md)。

checkin_one 末尾调用:device_map 的 refresh_token/expires_at 发生变化(或上次回写
失败留了 pool_pending_cred)∧ 账号带 pool_account_id(号池同步来的账号)→ POST
apps/api /api/internal/relay/account-pool/credential,CAS 回写
(baseVersion = device_map.pool_cred_version,即签到侧记录的号池凭证版本)。

为什么必须回写:Qoder 自刷新产生的新 refresh_token 只活在签到侧 device_map,号池
仍是旧的 ⇒ 号池调度器刷新时拿旧 refresh_token 打官方,白白消耗轮换次数甚至撞
「refresh_token 一次性使用」语义而失败。回写后号池凭证与签到侧同代。

失败不阻塞签到主流程:device_map 落 pool_pending_cred,下次 checkin_one 重试;
conflict(号池已有更新)= 以号池为准丢弃本次回写,并按响应当前版本校正基准;
not_found(号池行已删)= 清 pending 不再重试,账号停用由对账收敛器负责。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings
from app.core.internal_ticket import internal_service_headers
from app.core.logging import get_logger
from app.services.api_tools_bridge import api_base_url
from app.services.checkin_store import _pool_cred_version_of

logger = get_logger(__name__)

WRITEBACK_PATH = "/api/internal/relay/account-pool/credential"

# device_map 内的待回写标记(上次回写失败时落,下次 checkin_one 带重试)
_PENDING_KEY = "pool_pending_cred"

_WRITEBACK_TIMEOUT = 10.0

# 回写票的用途档:封闭枚举(app.core.internal_ticket.INTERNAL_TICKET_SCOPES)里
# 没有"号池凭证"专用档,沿用本桥既有契约档 ai-callback。专用档须发票侧与
# apps/api 验票侧同一笔加枚举值(本席未做,见交付报告的未收格)。
_WRITEBACK_SCOPE = "ai-callback"


def ticket_subject_of(owner_user_id: Any) -> str:
    """把调用方给的 owner 归一成可签进票的主体;不能签时返回 ""(只发旧头)。

    绝不编造、绝不兜底。空串进 ``internal_service_headers`` 即为"不签票、
    不带 x-user-id",与改动前同形。

    "可签"的判据是对侧表结构给的硬事实,不是本文另立的规矩:票主体最终要当
    apps/api 的 ``users.id`` 用,而该列是 uuid(packages/database/src/schema/users.ts),
    验票侧按它做"存在 + 活跃"校验。checkin_accounts 的 owner 值域里同时存在
    ``system:relay-pool``(运营池)与 ``dev-anonymous``(开发占位)这类非 uuid 属主
    —— 它们不是可验主体,签进票只会得到一枚必被拒的坏票,故一律视同"拿不到主体"。

    与兄弟模块 checkin_user_pool_bridge 的差异是有意的:那条是"用户录入 → 个人池",
    owner 只可能是真用户 uuid;本条还要承接运营池 pool-run(system:relay-pool),
    故必须在这里挡形态,而不是在下游靠"恰好没有占位值"。
    """
    if not isinstance(owner_user_id, str):
        return ""
    uid = owner_user_id.strip()
    if not uid:
        return ""
    try:
        uuid.UUID(uid)
    except (ValueError, AttributeError, TypeError):
        return ""
    return uid


def cred_fingerprint(device_map: dict[str, Any]) -> tuple[str, str]:
    """凭证指纹:refresh_token + expires_at 的稳定 repr。

    expires_at 两种形态(qoder 刷新写 float epoch 秒 / 号池推送写 ISO 串)都只是
    同一次刷新的前后态,repr 直比即可;None 与空串有意区分(无 vs 空)。
    """
    return (
        repr(device_map.get("refresh_token")),
        repr(device_map.get("expires_at")),
    )


def _auth_headers(secret: str, owner_user_id: Any = None) -> dict[str, str]:
    """回写请求鉴权头(经 internal_ticket 唯一出口构造,不再手拼常驻密钥头)。

    X-Internal-Secret 是本端点(/api/internal/relay/account-pool/credential)自己的
    机机凭据,与内部票是两回事,经 extra 原样带上。

    ``owner_user_id`` 由调用方按自己手上真实存在的值传入(checkin_scheduler 的
    run_checkin_now 已把它的入参 owner 带进 account 往下传)。拿不到时传 None:
    internal_service_headers 按其自身口径不签票、只发旧头 —— 不伪造主体
    (验票侧会对主体做存在+活跃校验)。批量调度路径的 account 行不含 owner
    (checkin_store.list_enabled_accounts 不 SELECT 该列)⇒ 同样落在只发旧头这一档。
    """
    return internal_service_headers(
        ticket_subject_of(owner_user_id),
        _WRITEBACK_SCOPE,
        legacy_token=secret,
        extra={"Content-Type": "application/json", "X-Internal-Secret": secret},
    )


async def _post_writeback(
    pool_account_id: str,
    base_version: int,
    refresh_token: Any,
    expires_at: Any,
    owner_user_id: Any = None,
) -> dict[str, Any]:
    """POST 回写请求;非 2xx 抛 RuntimeError(由 maybe_writeback 转 pending)。"""
    secret = settings.ai_callback_secret
    if not secret:
        raise RuntimeError("ai_callback_secret 未配置,无法回写号池凭证")
    url = f"{api_base_url().rstrip('/')}{WRITEBACK_PATH}"
    payload: dict[str, Any] = {
        "poolAccountId": pool_account_id,
        "baseVersion": base_version,
        "source": "checkin-refresh",
    }
    if isinstance(refresh_token, str) and refresh_token:
        payload["refreshToken"] = refresh_token
    if isinstance(expires_at, (str, int, float)) and str(expires_at).strip():
        payload["expiresAt"] = str(expires_at)
    async with httpx.AsyncClient(timeout=_WRITEBACK_TIMEOUT) as client:
        resp = await client.post(
            url,
            json=payload,
            headers=_auth_headers(secret, owner_user_id),
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"回写 HTTP {resp.status_code}: {resp.text[:200]}")
    body = resp.json()
    return body if isinstance(body, dict) else {}


def _drop_pending(device_map: dict[str, Any]) -> None:
    device_map.pop(_PENDING_KEY, None)


async def maybe_writeback(
    device_map: dict[str, Any],
    before_fp: tuple[str, str],
    *,
    owner_user_id: Any = None,
) -> bool:
    """凭证变化(或有pending待重试)时回写号池。返回 True = device_map 被改,调用方需再持久化。

    ``owner_user_id`` 是内部票的主体(调用方手上真实存在的 apps/api 用户 id)。
    不传 = 只发旧头(与改动前同行为),绝不在此编造主体。

    绝不抛异常:任何失败都转化为 device_map.pool_pending_cred(下次重试)或丢弃+清标记。
    """
    pool_account_id = device_map.get("pool_account_id")
    if not isinstance(pool_account_id, str) or not pool_account_id.strip():
        return False  # 非号池账号(用户自建),零开销
    pending = device_map.get(_PENDING_KEY)
    after_fp = cred_fingerprint(device_map)
    if after_fp == before_fp and not isinstance(pending, dict):
        return False  # 凭证无变化且无待重试(代理分配/设备补齐等不改凭证)
    base_version = _pool_cred_version_of(device_map)
    if base_version is None:
        base_version = 0
    try:
        outcome = await _post_writeback(
            pool_account_id,
            base_version,
            device_map.get("refresh_token"),
            device_map.get("expires_at"),
            owner_user_id,
        )
    except Exception as e:  # noqa: BLE001 — 回写是旁路,失败转 pending 不拖垮签到
        prev = pending.get("attempts") if isinstance(pending, dict) else 0
        attempts = prev if isinstance(prev, int) and prev >= 0 else 0
        device_map[_PENDING_KEY] = {
            "at": datetime.now(UTC).isoformat(),
            "error": (str(e) or "未知错误")[:200],
            "attempts": attempts + 1,
        }
        logger.warning(
            "[checkin_pool_writeback] 凭证回写失败,留待重试: account=%s err=%s",
            pool_account_id,
            (str(e) or "未知错误")[:200],
        )
        return True
    status = outcome.get("status")
    if status == "applied":
        _drop_pending(device_map)
        new_ver = outcome.get("credVersion")
        if isinstance(new_ver, int) and new_ver >= 0:
            device_map["pool_cred_version"] = new_ver  # 号池已 +1,校正基准
        return True
    if status == "conflict":
        # 号池侧在签到刷新后又有更新(导入覆盖等):以号池为准丢弃本次回写,
        # 按响应当前版本校正基准 —— 下次凭证真变化才回写,杜绝旧凭证覆盖新凭证。
        _drop_pending(device_map)
        cur = outcome.get("currentVersion")
        if isinstance(cur, int) and cur >= 0:
            device_map["pool_cred_version"] = cur
        logger.info(
            "[checkin_pool_writeback] 号池已有更新,丢弃回写: account=%s currentVersion=%s",
            pool_account_id,
            cur,
        )
        return True
    # not_found / 未知 status:号池行已删或契约外响应 —— 清 pending 不再重试
    # (账号停用由 O64 对账收敛器负责,这里只保证不无限重试)
    _drop_pending(device_map)
    logger.warning(
        "[checkin_pool_writeback] 回写未生效(status=%s),清待重试: account=%s",
        status,
        pool_account_id,
    )
    return True
