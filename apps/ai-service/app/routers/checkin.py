# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手 REST API(Phase1b,2026-10-03 立)。

前缀 /api/checkin,鉴权跟随 agents.py 惯例:
Depends(require_request_user_id)(端点级身份依赖,JWT 中间件注入
request.state.user_id,解析不到且全局鉴权未启用时回落 dev 身份)。

端点:
- POST   /accounts              录入账号(jwt 校验可解析 + 过期即拒)
- GET    /accounts              列表(jwt 永不出库,附 jwt_exp 与当前冷却 cooldown_until)
- PATCH  /accounts/{id}/jwt     更换 jwt(可解析 + 未过期校验后重加密落库)
- DELETE /accounts/{id}         删除(级联 records / error_counts)
- PATCH  /accounts/{id}/enabled 启用/停用
- PATCH  /accounts/{id}/name    重命名展示名
- POST   /accounts/{id}/checkin 手动签到(无视冷却,结果照写 records)
- GET    /records               签到记录倒序分页
- GET    /credits/history       积分流水(从 records 聚合 credits_delta)
- GET    /scheduler/status      调度器运行状态(enabled / started / next_run / next_run_qoder)

Phase1c(2026-10-08)增:jwt 更换 / 列表 jwt_exp + cooldown_until / scheduler status。
Phase1d(2026-10-08)增:账号分组(创建带 group / PATCH /accounts/{id}/group / 列表回吐 group)。
WP-B(2026-10-09)增:POST /accounts/{id}/query_credits(查余额并落当日快照)、
GET /credits/daily(每日快照三线序列:total/gained/consumed)。
WP-E(2026-10-10)增:PATCH /accounts/{id}/device_map(手动更新设备态,
属主校验走 get_decrypted_jwt,序列化后 ≤16KB)。
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.jwt_auth import require_request_user_id
from app.services import checkin_credits, checkin_minimax, checkin_qoder, checkin_store, checkin_workbuddy
from app.services import checkin_scheduler as checkin_scheduler_mod
from app.services.checkin_engine import extract_user_id, get_jwt_exp
from app.services.checkin_outbound import OutboundPaused, checkin_outbound_gate

router = APIRouter(prefix="/api/checkin", tags=["checkin"])

# 支持的账号平台(2026-10-10 平台化;2026-10-12 增 workbuddy):
# trae = 存量默认;qoder = 阿里 AI IDE;workbuddy = 腾讯 WorkBuddy(Buddy 加油站)。
_ACCOUNT_PLATFORMS = ("trae", "workbuddy", "qoder", "minimax")

_RECORDS_LIMIT_DEFAULT = 50
_RECORDS_LIMIT_MAX = 200

_DAILY_DAYS_DEFAULT = 30
_DAILY_DAYS_MAX = 365

# 每日快照的日界与调度器同一时区(08:05 签到 / 08:10 快照均为 Asia/Shanghai)
_CN_TZ = ZoneInfo("Asia/Shanghai")


class CreateAccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    jwt: str = Field(min_length=1)
    device_map: dict[str, Any] = Field(default_factory=dict)
    group: str = Field(default="", max_length=50)
    platform: str = Field(default="trae")


class SetEnabledIn(BaseModel):
    enabled: bool


class UpdateJwtIn(BaseModel):
    jwt: str = Field(min_length=1)


class UpdateGroupIn(BaseModel):
    """分组允许空串 = 移出分组;上限与列宽一致(50)。"""

    group: str = Field(max_length=50)


class UpdateNameIn(BaseModel):
    """展示名重命名;上限与 CreateAccountIn.name 一致(100)。"""

    name: str = Field(min_length=1, max_length=100)


class UpdateDeviceMapIn(BaseModel):
    """设备态整体替换(Qoder refresh_token / Cosy-* 设备头、TRAE 设备态)。"""

    device_map: dict[str, Any]


_DEVICE_MAP_MAX_BYTES = 16384


def _validate_qoder_token(token: str, device_map: dict[str, Any]) -> None:
    """Qoder device token(opaque 串)校验:非空 + 会话未过期。

    **真机实证 2026-10-12**:auth.v1.dat 解密后的 token 是 27 字符 opaque
    单段串(非 JWT,无点号),uid 真源是客户端会话 user.id —— 桌面端捕获时
    随 device_map.uid 落库,服务端无从从 token 解析。旧实现对 Qoder 也走
    TRAE 的 extract_user_id(data.id) ⇒ 导入 100% 400「无法解析出 user id」。
    过期判据复用 checkin_qoder.qoder_session_expiry(ISO 8601 / epoch 双形态,
    取值键 expires_at/expiresAt → refresh_token_expires_at/refreshTokenExpiresAt)。
    """
    tok = (token or "").strip()
    if len(tok) < 8:
        raise HTTPException(status_code=400, detail="Qoder token 为空或过短,请重新抓取")
    exp_dt, _remaining = checkin_qoder.qoder_session_expiry(device_map)
    if exp_dt is not None and exp_dt <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail=f"Qoder 会话已过期({exp_dt:%Y-%m-%d %H:%M}),请在 Qoder 客户端重新登录后重新抓取",
        )


def _validate_workbuddy_token(token: str, device_map: dict[str, Any]) -> None:
    """WorkBuddy token 校验:非空 + 会话未过期(device_map.expiresAt 声明时)。

    WorkBuddy token 本体是标准 JWT(sub=uid、exp),但桌面端 5.8+ 把登录态
    包进 {$wbEncrypted} 信封(密钥只活在客户端进程内),抓取可能拿不到 token
    本体 ⇒ token 只做非空硬校验,uid 以 device_map.uid 为真源(捕获落库)。
    过期判据复用 checkin_workbuddy.workbuddy_session_expiry
    (epoch 秒/毫秒/ISO 三形态;auth.expiresAt 真机实证为毫秒)。

    Web 模式(2026-10-12 立「网页登录自动添加」):device_map.login_type=="web"
    时 jwt 字段存的是**网页登录 Cookie 串**(桌面端 WebView cookie jar 全量,
    含 HttpOnly,加密落库)——只做非空校验,无 expiresAt 声明(网页 Cookie
    服务端滚动刷新,过期由签到 401 → SessionDead 承载)。
    """
    tok = (token or "").strip()
    if len(tok) < 8:
        if checkin_workbuddy.workbuddy_is_web_mode(device_map or {}):
            raise HTTPException(
                status_code=400,
                detail="WorkBuddy 网页登录 Cookie 为空或过短,请重新网页登录获取",
            )
        raise HTTPException(status_code=400, detail="WorkBuddy token 为空或过短,请重新提取")
    exp_dt, _remaining = checkin_workbuddy.workbuddy_session_expiry(device_map or {})
    if exp_dt is not None and exp_dt <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail=f"WorkBuddy 会话已过期({exp_dt:%Y-%m-%d %H:%M}),请打开 WorkBuddy 桌面端刷新登录态后重新提取",
        )


def _validate_minimax_token(jwt: str, device_map: dict[str, Any]) -> None:
    """MiniMax Code:token = OAuth accessToken(mmoat_ 前缀 opaque,非 JWT),
    只校验非空 + device_map.uid 必填(服务端 query 缺 user_id 恒 401) +
    会话过期时间(device_map.expires_at,epoch 秒;capture 自 auth.json)。"""
    tok = (jwt or "").strip()
    if len(tok) < 8:
        raise HTTPException(status_code=400, detail="MiniMax token 为空或过短,请重新本机捕获")
    uid = checkin_minimax.minimax_device_map_uid(device_map or {})
    if not uid:
        raise HTTPException(status_code=400, detail="device_map 缺 uid(user_id 必填),请重新本机捕获")
    raw = (device_map or {}).get("expires_at")
    try:
        exp = float(raw) if raw is not None else 0.0
    except (TypeError, ValueError):
        exp = 0.0
    if exp > 1e12:
        exp = exp / 1000.0
    if exp > 0 and exp <= time.time():
        raise HTTPException(
            status_code=400,
            detail="MiniMax 会话已过期,请打开 MiniMax Code 桌面端刷新登录态后重新捕获",
        )


def _validate_jwt(
    jwt: str,
    platform: str = "trae",
    device_map: dict[str, Any] | None = None,
) -> datetime | None:
    """jwt/token 必须可通过对应平台判据,且已声明 exp 时不得已过期;
    返回 TRAE 平台声明的 exp(未声明为 None),供 PATCH /jwt 直接回显。

    按平台分流(2026-10-12 平台化修正):
    - trae:extract_user_id(data.id/auth_id/sub)必须命中,get_jwt_exp 判过期;
    - qoder:token 是 opaque 非 JWT(真机实证),只校验非空 + device_map 会话
      过期时间(见 _validate_qoder_token)—— 绝不再要求从 token 解析 uid;
    - workbuddy:token 本体是 JWT 但 5.8+ 登录态加密可能取不到 ⇒ 只校验非空 +
      device_map 会话过期时间(见 _validate_workbuddy_token)。
    """
    if platform == "qoder":
        _validate_qoder_token(jwt, device_map or {})
        return None
    if platform == "workbuddy":
        _validate_workbuddy_token(jwt, device_map or {})
        return None
    if platform == "minimax":
        _validate_minimax_token(jwt, device_map or {})
        return None
    user_id = extract_user_id(jwt)
    if not user_id:
        raise HTTPException(status_code=400, detail="jwt 无法解析出 user id,请重新抓取")
    exp_dt: datetime | None
    remaining: float | None
    exp_dt, remaining = get_jwt_exp(jwt)
    if exp_dt is not None and remaining is not None and remaining <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"jwt 已过期({exp_dt:%Y-%m-%d %H:%M}),请重新抓取",
        )
    return exp_dt


@router.post("/accounts")
async def create_account(
    body: CreateAccountIn, current_user: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """录入签到账号。jwt 加密落库,响应不含任何 jwt 字段。"""
    if body.platform not in _ACCOUNT_PLATFORMS:
        raise HTTPException(
            status_code=400, detail=f"不支持的平台: {body.platform}(可选: {'/'.join(_ACCOUNT_PLATFORMS)})"
        )
    _validate_jwt(body.jwt, body.platform, body.device_map)
    try:
        account = await checkin_store.create_account(
            current_user,
            body.name,
            body.jwt,
            body.device_map,
            account_group=body.group,
            platform=body.platform,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return account


@router.get("/accounts")
async def list_accounts(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """账号列表(脱敏:无 jwt / jwt_enc 字段;附 jwt_exp 与当前生效冷却)。"""
    accounts = await checkin_store.list_accounts(current_user)
    # 冷却一次查全表后按 account_id 合并进各行(store 已滤过期),不逐账号回库;
    # jwt_exp 由 store._account_row 逐行解密解析,单账号异常不影响整表。
    cooldowns = await checkin_store.get_active_cooldowns()
    for acc in accounts:
        cd = cooldowns.get(acc["id"])
        acc["cooldown_until"] = cd.isoformat() if cd is not None else None
    return {"accounts": accounts, "count": len(accounts)}


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int, current_user: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """删除账号(属主校验,记录级联删除)。"""
    deleted = await checkin_store.delete_account(account_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return {"ok": True, "id": account_id}


@router.patch("/accounts/{account_id}/enabled")
async def set_enabled(
    account_id: int,
    body: SetEnabledIn,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """启用/停用账号(停用后每日调度跳过,手动签到仍可用)。"""
    updated = await checkin_store.set_enabled(account_id, current_user, body.enabled)
    if not updated:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return {"ok": True, "id": account_id, "enabled": body.enabled}


@router.patch("/accounts/{account_id}/jwt")
async def update_account_jwt(
    account_id: int,
    body: UpdateJwtIn,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """更换账号 jwt:先按账号平台校验(可解析/未过期,400),属主命中后重加密落库,未命中 404。"""
    # 平台分流(2026-10-12):Qoder token 是 opaque 非 JWT,不能走 TRAE 判据;
    # 路由只收 jwt,先查账号平台再校验。查不到 = 不存在/非属主,直接 404。
    platform = await checkin_store.get_account_platform(account_id, current_user)
    if platform is None:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    exp_dt = _validate_jwt(body.jwt, platform)
    updated = await checkin_store.update_jwt(account_id, current_user, body.jwt)
    if not updated:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return {
        "ok": True,
        "id": account_id,
        "jwt_exp": exp_dt.isoformat() if exp_dt is not None else None,
    }


@router.patch("/accounts/{account_id}/group")
async def update_account_group(
    account_id: int,
    body: UpdateGroupIn,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """更新账号分组(空串 = 移出分组);属主命中后落库,未命中 404。"""
    updated = await checkin_store.update_group(account_id, current_user, body.group)
    if not updated:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return {"ok": True, "id": account_id, "group": body.group}


@router.patch("/accounts/{account_id}/name")
async def update_account_name(
    account_id: int,
    body: UpdateNameIn,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """更新账号展示名(重命名;旧版捕获把 UUID 编码存进 name 的存量由用户就地改名)。

    属主命中后落库,未命中 404。
    """
    updated = await checkin_store.update_account_name(account_id, current_user, body.name)
    if not updated:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    return {"ok": True, "id": account_id, "name": body.name}


@router.post("/accounts/{account_id}/checkin")
async def manual_checkin(
    account_id: int, current_user: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """手动触发签到:尊重冷却与全局限流(命中返回 429),结果照写 records。"""
    try:
        record = await checkin_scheduler_mod.checkin_scheduler.run_checkin_now(
            account_id, current_user
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (
        checkin_scheduler_mod.RateLimitedError,
        checkin_scheduler_mod.CooldownActiveError,
    ) as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return record


@router.get("/records")
async def list_records(
    account_id: int | None = None,
    limit: int = Query(default=_RECORDS_LIMIT_DEFAULT, ge=1, le=_RECORDS_LIMIT_MAX),
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """签到记录倒序分页(可选按账号过滤)。"""
    records = await checkin_store.list_records(current_user, account_id=account_id, limit=limit)
    return {"records": records, "count": len(records)}


@router.get("/credits/history")
async def credits_history(
    account_id: int | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """积分流水(从 records 聚合 credits_delta 非空的签到,倒序)。"""
    history = await checkin_store.credits_history(
        current_user, account_id=account_id, limit=limit
    )
    total = sum(int(h["credits_delta"]) for h in history if h["credits_delta"] is not None)
    return {"history": history, "count": len(history), "total_credits_delta": total}


@router.get("/scheduler/status")
async def scheduler_status(
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """调度器运行状态(经 CheckinScheduler.status() 公开方法,路由不摸私有属性)。"""
    return checkin_scheduler_mod.checkin_scheduler.status()


@router.post("/accounts/{account_id}/query_credits")
async def query_credits(
    account_id: int, current_user: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """手动查询账号积分余额:按平台分发(Trae ide_user_ent_usage / Qoder quota
    usage / WorkBuddy checkin-status),成功则 upsert 当日快照。

    属主校验走 get_decrypted_jwt(owner 并入 WHERE,不命中 404);
    查询失败不抛栈,返回 {"ok": false, "error": 明确描述} 且不落快照。
    """
    account = await checkin_store.get_decrypted_jwt(account_id, current_user)
    if account is None:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    # 出站闸门限流预检:暂停中统一 429 快速失败(Trae 路径底层会把暂停转成
    # error dict,不预检就返回 200+error,前端无法按限流中止批量刷新)
    gate_remaining = checkin_outbound_gate.paused_remaining()
    if gate_remaining > 0:
        raise HTTPException(
            status_code=429,
            detail=f"签到出站限流冷却中({gate_remaining:.0f}s)",
        )
    # 账号冷却预检(第五件套,2026-10-16):冷却中账号(如 401 死号 10 年 /
    # 挑战页 30min)不再查余额——天天拿死 token 打平台鉴权点是封号前兆。
    # 与积分快照跳冷却(get_active_cooldowns)同口径;读冷却失败按无冷却放行
    # (fail-open,不阻塞正常查询)。
    try:
        cooldowns = await checkin_store.get_active_cooldowns()
    except Exception:
        cooldowns = {}
    cd_end = cooldowns.get(account_id)
    if cd_end is not None and cd_end > datetime.now(UTC):
        raise HTTPException(
            status_code=429,
            detail=f"账号处于冷却期, {cd_end.isoformat()} 后解冻",
        )
    platform = account.get("platform")
    try:
        if platform == "qoder":
            device_map = dict(account.get("device_map") or {})
            result = await checkin_qoder.qoder_query_credits(account["jwt"], device_map)
            # 401→refresh 会写回 device_map(新 token),落库持久化
            try:
                await checkin_store.save_device_map(account_id, device_map)
            except Exception:
                pass
        elif platform == "workbuddy":
            wb_device_map = dict(account.get("device_map") or {})
            result = await checkin_workbuddy.workbuddy_query_credits(account["jwt"], wb_device_map)
        elif platform == "minimax":
            mm_device_map = dict(account.get("device_map") or {})
            result = await checkin_minimax.minimax_query_credits(account["jwt"], mm_device_map)
        else:
            result = await checkin_credits.query_remaining_credits(account["jwt"])
    except OutboundPaused as e:
        # 出站闸门限流暂停:快速失败,不发真实请求(前端按 429 提示)
        raise HTTPException(status_code=429, detail=str(e)) from e
    error = result.get("error")
    if error is not None:
        # 第五件套配套(2026-10-16):查询路径的分类结果(SessionDead/Challenge)
        # 一并透传,调用方与前端可观测「为什么失败」,不再只有一句 error 文案
        return {"ok": False, "error": str(error), "classified_error": result.get("classified_error")}
    remaining = result.get("remaining")
    if not isinstance(remaining, int):
        return {"ok": False, "error": "积分余额解析结果异常"}
    day = datetime.now(_CN_TZ).date().isoformat()
    gained = await checkin_store.sum_credits_delta_for_day(account_id, current_user, day)
    await checkin_store.upsert_credits_daily(account_id, current_user, day, remaining, gained)
    return {"ok": True, "remaining": remaining}


@router.patch("/accounts/{account_id}/device_map")
async def update_account_device_map(
    account_id: int,
    body: UpdateDeviceMapIn,
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """手动更新账号 device_map(整体替换落库,免桌面端重新捕获)。

    属主校验走 get_decrypted_jwt(owner 并入 WHERE,不命中 404);
    序列化后超 16KB 拒收(422),防设备态膨胀打爆 jsonb 行。
    """
    payload = json.dumps(body.device_map, ensure_ascii=False)
    if len(payload) > _DEVICE_MAP_MAX_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"device_map 序列化后超上限(≤{_DEVICE_MAP_MAX_BYTES},实际 {len(payload)})",
        )
    account = await checkin_store.get_decrypted_jwt(account_id, current_user)
    if account is None:
        raise HTTPException(status_code=404, detail=f"账号不存在: {account_id}")
    await checkin_store.save_device_map(account_id, body.device_map)
    return {
        "ok": True,
        "device_map_keys": len(body.device_map),
        "platform": account.get("platform"),
    }


@router.get("/credits/daily")
async def credits_daily(
    days: int = Query(default=_DAILY_DAYS_DEFAULT, ge=1, le=_DAILY_DAYS_MAX),
    current_user: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """积分每日快照三线序列(最近 days 天,Asia/Shanghai 日界,按日升序)。

    consumed 按参考项目公式 |total[i] − gained[i] − total[i−1]|:
    首日有快照时 consumed=0;某日无快照则该日 total/consumed 置 null(前端断线);
    gained 缺失视为 0(当日无签到 delta)。
    """
    rows = await checkin_store.get_credits_daily_range(current_user, days)
    by_day = {r["day"]: r for r in rows}
    today = datetime.now(_CN_TZ).date()
    day_list = [(today - timedelta(days=days - 1 - i)).isoformat() for i in range(days)]

    totals: list[int | None] = []
    gains: list[int] = []
    consumed: list[int | None] = []
    prev_total: int | None = None
    for i, day in enumerate(day_list):
        row = by_day.get(day)
        total = row["total"] if row else None
        gained = row["gained"] if row else None
        totals.append(total)
        gains.append(gained if gained is not None else 0)
        if total is None:
            consumed.append(None)
        elif i == 0:
            consumed.append(0)
        elif prev_total is None:
            consumed.append(None)  # 前一日 total 缺失,公式无意义
        else:
            consumed.append(abs(total - gains[i] - prev_total))
        prev_total = total
    return {"days": day_list, "series": {"total": totals, "gained": gains, "consumed": consumed}}

# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
