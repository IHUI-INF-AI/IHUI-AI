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
- POST   /accounts/{id}/checkin 手动签到(无视冷却,结果照写 records)
- GET    /records               签到记录倒序分页
- GET    /credits/history       积分流水(从 records 聚合 credits_delta)
- GET    /scheduler/status      调度器运行状态(enabled / started / next_run)

Phase1c(2026-10-08)增:jwt 更换 / 列表 jwt_exp + cooldown_until / scheduler status。
Phase1d(2026-10-08)增:账号分组(创建带 group / PATCH /accounts/{id}/group / 列表回吐 group)。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.jwt_auth import require_request_user_id
from app.services import checkin_scheduler as checkin_scheduler_mod
from app.services import checkin_store
from app.services.checkin_engine import extract_user_id, get_jwt_exp

router = APIRouter(prefix="/api/checkin", tags=["checkin"])

_RECORDS_LIMIT_DEFAULT = 50
_RECORDS_LIMIT_MAX = 200


class CreateAccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    jwt: str = Field(min_length=1)
    device_map: dict[str, Any] = Field(default_factory=dict)
    group: str = Field(default="", max_length=50)


class SetEnabledIn(BaseModel):
    enabled: bool


class UpdateJwtIn(BaseModel):
    jwt: str = Field(min_length=1)


class UpdateGroupIn(BaseModel):
    """分组允许空串 = 移出分组;上限与列宽一致(50)。"""

    group: str = Field(max_length=50)


def _validate_jwt(jwt: str) -> datetime | None:
    """jwt 必须可解析出 user id,且已声明 exp 时不得已过期;返回声明的 exp(未声明为 None)。

    返回值供 PATCH /jwt 直接回显 jwt_exp(解析过的不再解析第二遍)。
    """
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
    _validate_jwt(body.jwt)
    try:
        account = await checkin_store.create_account(
            current_user, body.name, body.jwt, body.device_map, account_group=body.group
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
    """更换账号 jwt:先校验可解析 + 未过期(400),属主命中后重加密落库,未命中 404。"""
    exp_dt = _validate_jwt(body.jwt)
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


@router.post("/accounts/{account_id}/checkin")
async def manual_checkin(
    account_id: int, current_user: str = Depends(require_request_user_id)
) -> dict[str, Any]:
    """手动触发签到:无视冷却,结果照写 records。"""
    try:
        record = await checkin_scheduler_mod.checkin_scheduler.run_checkin_now(
            account_id, current_user
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
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

# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
