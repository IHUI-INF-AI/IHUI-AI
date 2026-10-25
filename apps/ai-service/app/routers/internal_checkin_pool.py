# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O64 号池↔签到助手同步 internal API(2026-10-23 立)。

内网端点(api -> ai-service),鉴权 = X-Internal-Secret 匹配 ai_callback_secret
(与 api 侧 AI_CALLBACK_SECRET 约定一致;input_sanitizer 对该头已有放行)。
**不走用户 JWT**:签到账号落固定系统 owner(checkin_store.POOL_SYNC_OWNER),
用户态 API 按 owner 过滤 ⇒ 用户 UI 零感知。

端点:
- POST /internal/checkin/pool-sync   账号 upsert(幂等:pool_cred_version 防降级)
- POST /internal/checkin/pool-state  状态联动(enabled / disabled / pool_deleted)
- GET  /internal/checkin/pool-status 单账号状态(admin 点查)
- GET  /internal/checkin/pool-accounts 系统 owner 全量摘要(对账收敛器拉签到侧)
- POST /internal/checkin/pool-cred-flush 指定账号立即重试凭证回写(对账收敛器补写象限)
- POST /internal/checkin/pool-run 指定账号立即签到(admin 手动触发,尊重冷却/限流)

设计:docs/engineering/account-pool-checkin-sync-design.md
平台映射单一真相源在 api 侧(D5):本模块只认 platform 白名单,零映射逻辑 ——
codearts 等无签到引擎的平台由 api 侧在映射表就标 skipped,到这里只做白名单兜底。
"""

from __future__ import annotations

import secrets as _secrets
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services import checkin_store
from app.services.checkin_store import POOL_SYNC_OWNER

router = APIRouter(prefix="/internal/checkin", tags=["checkin-internal"])

# 平台白名单与用户态 /api/checkin 同源(_ACCOUNT_PLATFORMS 的签到面):
# trae / workbuddy / qoder / minimax。映射在 api 侧,这里零映射逻辑。
_POOL_PLATFORMS = ("trae", "workbuddy", "qoder", "minimax")


def _require_internal(request: Request) -> None:
    """内网密钥校验:未配置 503(不裸奔),不匹配 401。compare_digest 防时序侧信道。"""
    secret = settings.ai_callback_secret
    if not secret:
        raise HTTPException(status_code=503, detail="内部密钥未配置(ai_callback_secret)")
    provided = request.headers.get("X-Internal-Secret") or ""
    if not _secrets.compare_digest(provided, secret):
        raise HTTPException(status_code=401, detail="内部密钥不匹配")


# ---------------------------------------------------------------------------
# 载荷模型(字段宽松对齐号池导入面;凭证字段仅内网传输,响应绝不回吐)
# ---------------------------------------------------------------------------


class PoolAccountIn(BaseModel):
    """号池侧单账号投影(api 映射 platform 后送达)。"""

    poolAccountId: str = Field(min_length=1, max_length=64)
    """池归属:null/缺省 = 运营池(落 system:relay-pool);非 null = 该平台用户的个人池"""
    ownerUserId: str | None = Field(default=None, max_length=64)
    uid: str = Field(min_length=1, max_length=128)
    name: str = Field(default="", max_length=128)
    token: str = Field(min_length=1, max_length=8192)
    refreshToken: str | None = Field(default=None, max_length=8192)
    credVersion: int = Field(ge=0)
    enabled: bool = True
    proxyUrl: str | None = Field(default=None, max_length=512)
    deviceId: str | None = Field(default=None, max_length=128)
    machineId: str | None = Field(default=None, max_length=128)
    cosy: dict[str, str] | None = None
    expiresAt: str | None = Field(default=None, max_length=64)
    deviceKeyPem: str | None = Field(default=None, max_length=4096)
    devicePubPem: str | None = Field(default=None, max_length=4096)


class PoolSyncIn(BaseModel):
    platform: str = Field(min_length=1, max_length=32)
    accounts: list[PoolAccountIn] = Field(min_length=1, max_length=500)


class PoolStateItem(BaseModel):
    """寻址优先 poolAccountId(跨 owner 稳定);uid/ownerUserId 仅老调用兜底。"""

    poolAccountId: str | None = Field(default=None, max_length=64)
    ownerUserId: str | None = Field(default=None, max_length=64)
    uid: str = Field(min_length=1, max_length=128)
    state: Literal["enabled", "disabled", "pool_deleted"]


class PoolStateIn(BaseModel):
    platform: str = Field(min_length=1, max_length=32)
    items: list[PoolStateItem] = Field(min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# device_map 构造(号池投影 → 签到引擎消费契约,设计 §4.2)
# ---------------------------------------------------------------------------


def _build_device_map(acc: PoolAccountIn) -> dict[str, Any]:
    """按平台无关骨架构造 device_map;引擎缺的键由其原位补齐(get_device_for 等)。

    键位契约(与各引擎现读消费面对齐):
    - pool_uid: 身份权威(derive_account_identity 第一优先)
    - uid: qoder/workbuddy/minimax 引擎的设备态 uid 读取键
    - refresh_token / expires_at: qoder 引擎的续期消费键(刷新也写回这两个键)
    - cosy: qoder Cosy-* 请求头族(蛇形键,号池 extraMetadata 同构)
    - proxy: client_for 的账号级出口代理键(同账号同 IP,降风控)
    """
    dm: dict[str, Any] = {
        "pool_account_id": acc.poolAccountId,
        "pool_uid": acc.uid,
        "pool_cred_version": acc.credVersion,
        "pool_synced_at": datetime.now(UTC).isoformat(),
        "pool_enabled": acc.enabled,
        "uid": acc.uid,
    }
    if acc.name:
        dm["pool_name"] = acc.name
    if acc.refreshToken:
        dm["refresh_token"] = acc.refreshToken
    if acc.expiresAt:
        dm["expires_at"] = acc.expiresAt
    if acc.proxyUrl:
        dm["proxy"] = acc.proxyUrl
    if acc.cosy:
        dm["cosy"] = dict(acc.cosy)
    if acc.deviceId:
        dm["pool_device_id"] = acc.deviceId
    if acc.machineId:
        dm["pool_machine_id"] = acc.machineId
    # Trae 设备证明密钥对(2026-10-26 补链):桌面渠道签发的票只能由签发它的设备身份续;
    # 不过桥 ⇒ 号池里的 Trae 号永远刷不动(10101)。反向 bridge 回灌时按同两键读回。
    if acc.deviceKeyPem:
        dm["pool_device_key_pem"] = acc.deviceKeyPem
    if acc.devicePubPem:
        dm["pool_device_pub_pem"] = acc.devicePubPem
    return dm


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/pool-sync")
async def pool_sync(body: PoolSyncIn, request: Request) -> dict[str, Any]:
    """账号 upsert:逐条 create_account(身份合并 + 版本防降级),结果逐条回状态。"""
    _require_internal(request)
    if body.platform not in _POOL_PLATFORMS:
        # 白名单外平台(如 codearts):逐条 skipped,不假装同步成功
        return {
            "results": [
                {
                    "poolAccountId": a.poolAccountId,
                    "status": "skipped",
                    "checkinAccountId": None,
                    "reason": f"平台 {body.platform} 无签到引擎",
                }
                for a in body.accounts
            ]
        }
    results: list[dict[str, Any]] = []
    for acc in body.accounts:
        # 同一归属内同步:运营池(NULL)→ 系统 owner;个人池 → 该平台用户自己的 owner
        owner = acc.ownerUserId or POOL_SYNC_OWNER
        try:
            row = await checkin_store.create_account(
                owner,
                acc.name or acc.uid,
                acc.token,
                _build_device_map(acc),
                account_group="pool",
                platform=body.platform,
            )
            # create_account 恒建 enabled=true;disabled 载荷建后立即置位
            # (版本防降级跳过更新的路径同样要置位 —— 启用态永远以号池为准)
            if not acc.enabled:
                await checkin_store.set_enabled(row["id"], owner, False)
            results.append(
                {
                    "poolAccountId": acc.poolAccountId,
                    "status": "synced",
                    "checkinAccountId": row["id"],
                    "reason": None,
                }
            )
        except Exception as e:  # noqa: BLE001 — 单条失败不拖垮整批
            results.append(
                {
                    "poolAccountId": acc.poolAccountId,
                    "status": "failed",
                    "checkinAccountId": None,
                    "reason": (str(e) or "未知错误")[:200],
                }
            )
    return {"results": results}


@router.post("/pool-state")
async def pool_state(body: PoolStateIn, request: Request) -> dict[str, Any]:
    """状态联动:enabled / disabled / pool_deleted(停用保历史,不物理删)。"""
    _require_internal(request)
    results: list[dict[str, Any]] = []
    for item in body.items:
        try:
            r = await checkin_store.apply_pool_state(
                body.platform,
                item.uid,
                item.state,
                pool_account_id=item.poolAccountId,
                owner_user_id=item.ownerUserId,
            )
            results.append(
                {
                    "uid": item.uid,
                    "found": r["found"],
                    "accountId": r["accountId"],
                }
            )
        except Exception as e:  # noqa: BLE001 — 单条失败不拖垮整批
            results.append(
                {
                    "uid": item.uid,
                    "found": False,
                    "accountId": None,
                    "reason": (str(e) or "未知错误")[:200],
                }
            )
    return {"results": results}


@router.get("/pool-status")
async def pool_status_endpoint(
    request: Request,
    platform: str,
    uid: str,
    poolAccountId: str | None = None,
    ownerUserId: str | None = None,
) -> dict[str, Any]:
    """单账号签到状态(admin/个人池点查):记录/冷却/同步态/pending 回写标记。"""
    _require_internal(request)
    return await checkin_store.pool_status(
        platform,
        uid,
        pool_account_id=poolAccountId,
        owner_user_id=ownerUserId,
    )


class PoolCredFlushIn(BaseModel):
    """对账收敛器的补回写请求:按 checkin accountId 精确点名(≤ 上限防打爆)。"""

    accountIds: list[int] = Field(min_length=1, max_length=200)


class PoolRunIn(BaseModel):
    """手动签到请求:poolAccountId 优先,uid/ownerUserId 兜底(与端点 4 同一寻址口径)。"""

    platform: str = Field(min_length=1, max_length=32)
    poolAccountId: str | None = Field(default=None, max_length=64)
    ownerUserId: str | None = Field(default=None, max_length=64)
    uid: str = Field(min_length=1, max_length=128)


@router.get("/pool-accounts")
async def pool_accounts_endpoint(request: Request) -> dict[str, Any]:
    """系统 owner 全量摘要(对账收敛器用):poolAccountId / poolCredVersion /
    enabled / poolPendingCred;jwt 明文不出库。"""
    _require_internal(request)
    return {"accounts": await checkin_store.list_pool_accounts()}


@router.post("/pool-cred-flush")
async def pool_cred_flush(body: PoolCredFlushIn, request: Request) -> dict[str, Any]:
    """对指定签到账号立即重试凭证回写(对账收敛器 §8 第四象限)。

    复用 checkin_pool_writeback.maybe_writeback:device_map 现载 refresh_token /
    expires_at 即回写载荷,与 checkin_one 末尾同一条代码路径;上次失败留的
    pool_pending_cred 在此自然重试。单账号失败不拖垮整批。
    """
    _require_internal(request)
    # 延迟 import:该模块 import 链更重(httpx/api_tools_bridge),仅 flush 路径需要
    from app.services.checkin_pool_writeback import cred_fingerprint, maybe_writeback

    results: list[dict[str, Any]] = []
    for account_id in body.accountIds:
        try:
            dm = await checkin_store.load_device_map(account_id)
            if dm is None:
                results.append({"accountId": account_id, "status": "not_found"})
                continue
            if not isinstance(dm.get("pool_account_id"), str) or not dm["pool_account_id"].strip():
                results.append({"accountId": account_id, "status": "skipped", "reason": "非号池账号"})
                continue
            before = cred_fingerprint(dm)
            changed = await maybe_writeback(dm, before)
            if changed:
                await checkin_store.save_device_map(account_id, dm)
            results.append(
                {
                    "accountId": account_id,
                    "status": "flushed" if changed else "noop",
                }
            )
        except Exception as e:  # noqa: BLE001 — 单条失败不拖垮整批
            results.append(
                {
                    "accountId": account_id,
                    "status": "failed",
                    "reason": (str(e) or "未知错误")[:200],
                }
            )
    return {"results": results}


@router.post("/pool-run")
async def pool_run(body: PoolRunIn, request: Request) -> dict[str, Any]:
    """对系统 owner 账号立即签到(admin 手动触发,设计 §11「立即签到」)。

    复用 run_checkin_now(与用户态 manual_checkin 同一条代码路径):尊重出站
    全局闸门与账号冷却(命中 429,绝不提供绕过冷却的后门);结果照写 records,
    积分/冷却语义与自动调度完全一致。
    """
    _require_internal(request)
    # 延迟 import:scheduler 模块重(引擎/风控),仅 pool-run 路径需要
    from app.services import checkin_scheduler as checkin_scheduler_mod

    account_id = await checkin_store.pool_account_id_of(
        body.platform,
        body.uid,
        pool_account_id=body.poolAccountId,
        owner_user_id=body.ownerUserId,
    )
    if account_id is None:
        raise HTTPException(
            status_code=404,
            detail=f"签到账号不存在: {body.platform}/{body.uid}",
        )
    try:
        # 用账号真实 owner(运营池 = system:relay-pool,个人池 = 平台用户 id)
        owner = await checkin_store.owner_of_account(account_id)
        record = await checkin_scheduler_mod.checkin_scheduler.run_checkin_now(
            account_id, owner
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (
        checkin_scheduler_mod.RateLimitedError,
        checkin_scheduler_mod.CooldownActiveError,
    ) as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return record
