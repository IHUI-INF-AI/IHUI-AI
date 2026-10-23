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


class PoolSyncIn(BaseModel):
    platform: str = Field(min_length=1, max_length=32)
    accounts: list[PoolAccountIn] = Field(min_length=1, max_length=500)


class PoolStateItem(BaseModel):
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
        try:
            row = await checkin_store.create_account(
                POOL_SYNC_OWNER,
                acc.name or acc.uid,
                acc.token,
                _build_device_map(acc),
                account_group="pool",
                platform=body.platform,
            )
            # create_account 恒建 enabled=true;disabled 载荷建后立即置位
            # (版本防降级跳过更新的路径同样要置位 —— 启用态永远以号池为准)
            if not acc.enabled:
                await checkin_store.set_enabled(row["id"], POOL_SYNC_OWNER, False)
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
            r = await checkin_store.apply_pool_state(body.platform, item.uid, item.state)
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
async def pool_status_endpoint(request: Request, platform: str, uid: str) -> dict[str, Any]:
    """单账号签到状态(admin 点查):记录/冷却/同步态/pending 回写标记。"""
    _require_internal(request)
    return await checkin_store.pool_status(platform, uid)
