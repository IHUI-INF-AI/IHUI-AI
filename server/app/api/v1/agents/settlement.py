"""Agent 结算路由.

包含结算记录的列表/详情/汇总/状态更新, 以及与 AgentBuy 的同步、过期缓存监听、
收入概览统计等管理能力. 历史来源: coze_zhs_py/api/agent_settlement.py.
"""

import uuid as uuid_module
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# 内存级结算过期监听缓存 (module-level dict, 不引入 Redis)
# 与 agents/cache.py 的 _category_cache 风格保持一致.
# ---------------------------------------------------------------------------

_settlement_cache: dict[str, Any] = {
    "records": {},            # {record_id: {id, expiration_date, settlement, uuid, order_no}}
    "last_check_at": None,    # ISO timestamp 上次 force-check
    "last_refresh_at": None,  # ISO timestamp 上次 force-refresh
    "version": 0,             # 每次刷新自增
    "expired_count": 0,       # 上次检查发现的过期记录数
}


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _format_account_type(type_child: Optional[str], account: Optional[int]) -> str:
    """根据 type_child (1=月, 2=年, 3=永久) 和 account (分) 拼接 accountType 字段."""
    if not type_child or not account:
        return ""
    amount_yuan = account / 100
    if type_child == "1":
        return f"{amount_yuan} 元/月"
    if type_child == "2":
        return f"{amount_yuan} 元/年"
    if type_child == "3":
        return f"{amount_yuan} 元/永久"
    return f"{amount_yuan} 元"


def _format_discount_month(discount_month: Optional[str]) -> str:
    """转换 discount_month 字段为描述文字."""
    if not discount_month:
        return ""
    return {
        "1": "6个月后八折",
        "2": "9个月后7折",
        "3": "1年后5折",
    }.get(discount_month, "")


def _serialize_settlement(s) -> dict:
    """序列化 AgentSettlement 行为字典."""
    return {
        "id": s.id,
        "uuid": s.uuid,
        "order_no": s.order_no,
        "create_time": s.create_time.isoformat() if s.create_time else None,
        "buy_uuid": s.buy_uuid,
        "agent_id": s.agent_id,
        "agent_name": s.agent_name,
        "prologue": s.prologue,
        "agent_avatar": s.agent_avatar,
        "expiration_date": s.expiration_date.isoformat() if s.expiration_date else None,
        "settlement": s.settlement,
        "withdrawal": s.withdrawal,
        "withdrawal_id": s.withdrawal_id,
        "issue_no": s.issue_no,
    }


def _parse_datetime(value: Any) -> Optional[datetime]:
    """从 str/datetime 解析为 datetime."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


# ==================== 现有 endpoint (增强) ====================


@router.get("/list", summary="Agent 结算列表")
async def list_settlements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    settlement_status: str = Query(None, description="0=未结算 1=已结算"),
    withdrawal_status: str = Query(None, description="0=未提现 1=已提现"),
    order_no: str = Query(None, description="订单号筛选"),
    agent_id: str = Query(None, description="智能体ID筛选"),
    agent_name: str = Query(None, description="智能体名称模糊搜索"),
    user_uuid: str = Depends(require_login),
):
    """获取结算记录列表 (含合并逻辑、groupAccount 计算、关联 category/buy 表)."""
    with get_session() as db:
        from app.models.activity_models import AgentBuy, AgentCategory
        from app.models.agent_settlement import AgentSettlement

        q = db.query(AgentSettlement).filter(AgentSettlement.uuid == user_uuid)
        if settlement_status is not None:
            q = q.filter(AgentSettlement.settlement == settlement_status)
        if withdrawal_status is not None:
            q = q.filter(AgentSettlement.withdrawal == withdrawal_status)
        if order_no:
            q = q.filter(AgentSettlement.order_no == order_no)
        if agent_id:
            q = q.filter(AgentSettlement.agent_id == agent_id)
        if agent_name:
            q = q.filter(AgentSettlement.agent_name.like(f"%{agent_name}%"))

        all_records = (
            q.order_by(
                AgentSettlement.create_time.desc(),
                AgentSettlement.issue_no.asc(),
            ).all()
        )

        # ── 合并逻辑: 除 id 和 expiration_date 外其他字段相同的记录合并 ──
        merged: dict[tuple, dict] = {}
        for record in all_records:
            merge_key = (
                record.uuid,
                record.order_no,
                record.buy_uuid,
                record.agent_id,
                record.agent_name,
                record.prologue,
                record.agent_avatar,
                record.settlement,
                record.withdrawal,
            )
            if merge_key in merged:
                merged[merge_key]["total"] += 1
                if record.create_time and (
                    not merged[merge_key]["create_time"]
                    or record.create_time > merged[merge_key]["create_time"]
                ):
                    merged[merge_key]["create_time"] = record.create_time
                merged[merge_key]["ids"].append(record.id)
                if record.expiration_date:
                    merged[merge_key]["expiration_dates"].append(record.expiration_date)
            else:
                merged[merge_key] = {
                    "record": record,
                    "total": 1,
                    "create_time": record.create_time,
                    "ids": [record.id],
                    "expiration_dates": [record.expiration_date] if record.expiration_date else [],
                }

        # ── 关联查询 category/buy, 计算 accountType/discount ──
        order_total_sum: dict[str, int] = {}
        order_count_cache: dict[str, int] = {}
        agent_account_cache: dict[str, int] = {}

        merged_records: list[dict] = []
        for data in merged.values():
            record = data["record"]

            # 关联 AgentCategory
            category_info = (
                db.query(AgentCategory)
                .filter(AgentCategory.agent_id == record.agent_id)
                .first()
            )
            account_type = ""
            discount_month_desc = ""
            account = 0
            if category_info:
                account_type = _format_account_type(category_info.type_child, category_info.account)
                discount_month_desc = _format_discount_month(getattr(category_info, "discount_month", None))
                account = category_info.account or 0

            # 关联 AgentBuy
            buy_info = (
                db.query(AgentBuy)
                .filter(AgentBuy.order_no == record.order_no)
                .first()
            )
            discount = buy_info.discount if buy_info else None
            count = buy_info.count if buy_info and buy_info.count else 0

            total = data["total"]
            order_no_val = record.order_no or ""

            # 累计每个 order_no 的 totalSum
            if order_no_val:
                order_total_sum[order_no_val] = order_total_sum.get(order_no_val, 0) + total

            # 缓存 account/count
            if record.agent_id and record.agent_id not in agent_account_cache:
                agent_account_cache[record.agent_id] = account
            if order_no_val and order_no_val not in order_count_cache:
                order_count_cache[order_no_val] = count

            merged_records.append({
                "id": record.id,
                "uuid": record.uuid,
                "order_no": record.order_no,
                "create_time": data["create_time"].isoformat() if data["create_time"] else None,
                "buy_uuid": record.buy_uuid,
                "agent_id": record.agent_id,
                "agent_name": record.agent_name,
                "prologue": record.prologue,
                "agent_avatar": record.agent_avatar,
                "expiration_date": record.expiration_date.isoformat() if record.expiration_date else None,
                "issue_no": record.issue_no,
                "settlement": record.settlement,
                "withdrawal": record.withdrawal,
                "total": total,
                "accountType": account_type,
                "discount_month_desc": discount_month_desc,
                "discount": discount,
                "_order_no": order_no_val,
                "_agent_id": record.agent_id,
                "_total": total,
            })

        # ── 计算 groupAccount ──
        for rec in merged_records:
            order_no_val = rec["_order_no"]
            agent_id_val = rec["_agent_id"]
            total = rec["_total"]
            cnt = order_count_cache.get(order_no_val, 0)
            acct = agent_account_cache.get(agent_id_val, 0)
            total_account = acct * cnt
            total_sum = order_total_sum.get(order_no_val, 0)
            atom_account = (total_account / total_sum) if total_sum > 0 else 0
            group_account = total * atom_account
            rec["groupAccount"] = round(group_account, 2)
            del rec["_order_no"]
            del rec["_agent_id"]
            del rec["_total"]

        # ── 分页 ──
        total_merged = len(merged_records)
        offset = (page - 1) * limit
        paginated = merged_records[offset:offset + limit]
        return success(paginated, total=total_merged)


@router.get("/summary", summary="结算汇总")
async def settlement_summary(user_uuid: str = Depends(require_login)):
    """返回: 总数/已结算/未结算/已提现/待提现/结算率/提现率."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        total = (
            db.query(func.count(AgentSettlement.id))
            .filter(AgentSettlement.uuid == user_uuid)
            .scalar()
        ) or 0
        settled = (
            db.query(func.count(AgentSettlement.id))
            .filter(AgentSettlement.uuid == user_uuid, AgentSettlement.settlement == "1")
            .scalar()
        ) or 0
        withdrawn = (
            db.query(func.count(AgentSettlement.id))
            .filter(AgentSettlement.uuid == user_uuid, AgentSettlement.withdrawal == "1")
            .scalar()
        ) or 0
        pending_withdrawal = (
            db.query(func.count(AgentSettlement.id))
            .filter(
                AgentSettlement.uuid == user_uuid,
                AgentSettlement.settlement == "1",
                AgentSettlement.withdrawal == "0",
            )
            .scalar()
        ) or 0

        unsettled = total - settled
        settlement_rate = round(settled / total * 100, 2) if total > 0 else 0.0
        withdrawal_rate = round(withdrawn / total * 100, 2) if total > 0 else 0.0

        return success({
            "total_settlements": total,
            "settled_count": settled,
            "unsettled_count": unsettled,
            "withdrawn_count": withdrawn,
            "pending_withdrawal_count": pending_withdrawal,
            "settlement_rate": settlement_rate,
            "withdrawal_rate": withdrawal_rate,
        })


@router.post("/settle", summary="触发结算/更新结算状态")
async def trigger_settle(
    settlement_id: str = Query(...),
    settlement: str = Query(None, description="可选: 更新结算状态 0/1, 默认置1"),
    withdrawal: str = Query(None, description="可选: 更新提现状态 0/1"),
    user_uuid: str = Depends(require_login),
):
    """触发结算 (settlement=1) 或更新 withdrawal 状态 (通用更新)."""
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentSettlement

            record = (
                db.query(AgentSettlement)
                .filter(
                    AgentSettlement.id == settlement_id,
                    AgentSettlement.uuid == user_uuid,
                )
                .first()
            )
            if not record:
                return error("结算记录不存在", code="404000")

            updated: dict[str, str] = {}
            if settlement is not None:
                if settlement not in ("0", "1"):
                    return error("settlement 参数无效, 仅允许 0/1", code="400000")
                record.settlement = settlement
                updated["settlement"] = settlement
            elif withdrawal is None:
                # 向后兼容: 仅传 id 时默认置 settlement=1
                if record.settlement == "1":
                    return error("已结算,无需重复操作", code="400000")
                record.settlement = "1"
                updated["settlement"] = "1"

            if withdrawal is not None:
                if withdrawal not in ("0", "1"):
                    return error("withdrawal 参数无效, 仅允许 0/1", code="400000")
                record.withdrawal = withdrawal
                updated["withdrawal"] = withdrawal

            db.commit()
            return success({"id": settlement_id, **updated})
        except Exception as e:
            logger.error(f"Settle error: {e}")
            return error(str(e))


@router.get("/unsettled", summary="查询未结算记录")
async def list_unsettled(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        items = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.uuid == user_uuid,
                AgentSettlement.settlement == "0",
            )
            .order_by(AgentSettlement.expiration_date.asc())
            .all()
        )
        data = [
            {
                "id": s.id,
                "order_no": s.order_no,
                "agent_id": s.agent_id,
                "agent_name": s.agent_name,
                "expiration_date": s.expiration_date.isoformat() if s.expiration_date else None,
            }
            for s in items
        ]
        return success(data, total=len(data))


# ==================== 新增 endpoint ====================
# 注意: 静态路径需定义在 /settlement/{record_id} 之前以避免路径冲突.


@router.get("/settlement/cache/info", summary="结算缓存信息")
async def get_cache_info(user_uuid: str = Depends(require_login)):
    """返回内存缓存大小/最后检查时间/版本."""
    return success({
        "size": len(_settlement_cache["records"]),
        "last_check_at": _settlement_cache["last_check_at"],
        "last_refresh_at": _settlement_cache["last_refresh_at"],
        "version": _settlement_cache["version"],
        "expired_count": _settlement_cache["expired_count"],
    })


@router.post("/settlement/cache/force-check", summary="强制检查缓存过期记录")
async def force_check_cache(user_uuid: str = Depends(require_login)):
    """遍历内存缓存, 统计已过期记录数."""
    now = datetime.now()
    expired_ids: list[str] = []
    for rid, rec in _settlement_cache["records"].items():
        exp_date = rec.get("expiration_date")
        if exp_date and isinstance(exp_date, datetime) and exp_date <= now:
            expired_ids.append(rid)
    _settlement_cache["last_check_at"] = now.isoformat()
    _settlement_cache["expired_count"] = len(expired_ids)
    _settlement_cache["version"] += 1
    return success({
        "checked_at": _settlement_cache["last_check_at"],
        "expired_count": len(expired_ids),
        "expired_ids": expired_ids,
        "total_cached": len(_settlement_cache["records"]),
    })


@router.post("/settlement/cache/force-refresh", summary="强制刷新缓存")
async def force_refresh_cache(user_uuid: str = Depends(require_login)):
    """从 DB 重新加载未来 72 小时内将过期的未结算记录到内存缓存."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        now = datetime.now()
        future = now + timedelta(hours=72)
        records = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.expiration_date.between(now, future),
                AgentSettlement.settlement == "0",
            )
            .all()
        )
        _settlement_cache["records"] = {
            r.id: {
                "id": r.id,
                "expiration_date": r.expiration_date,
                "settlement": r.settlement,
                "uuid": r.uuid,
                "order_no": r.order_no,
            }
            for r in records
        }
        _settlement_cache["last_refresh_at"] = now.isoformat()
        _settlement_cache["version"] += 1
        return success({
            "total_cached": len(_settlement_cache["records"]),
            "refreshed_at": _settlement_cache["last_refresh_at"],
            "version": _settlement_cache["version"],
        })


@router.post("/settlement/create", summary="创建结算记录")
async def create_settlement(
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """手动创建结算记录 (Body 接收全字段)."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        order_no = payload.get("order_no")
        if not order_no:
            return error("order_no is required", code="400000")

        existing = (
            db.query(AgentSettlement)
            .filter(AgentSettlement.order_no == order_no)
            .first()
        )
        if existing:
            return error("订单号已存在", code="409000")

        new_record = AgentSettlement(
            id=str(uuid_module.uuid4()),
            uuid=payload.get("uuid") or user_uuid,
            order_no=order_no,
            buy_uuid=payload.get("buy_uuid"),
            agent_id=payload.get("agent_id"),
            agent_name=payload.get("agent_name"),
            prologue=payload.get("prologue"),
            agent_avatar=payload.get("agent_avatar"),
            expiration_date=_parse_datetime(payload.get("expiration_date")),
            settlement=payload.get("settlement", "0"),
            withdrawal=payload.get("withdrawal", "0"),
            create_time=datetime.now(),
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return success(_serialize_settlement(new_record))


@router.post("/settlement/sync-existing", summary="批量同步购买记录到结算表")
async def sync_existing_records(
    limit: int = Query(100, ge=1, le=1000),
    user_uuid: str = Depends(require_login),
):
    """遍历 AgentBuy, 按 order_no 检查 AgentSettlement 是否存在, 不存在则创建."""
    with get_session() as db:
        from app.models.activity_models import AgentBuy
        from app.models.agent_settlement import AgentSettlement

        buys = db.query(AgentBuy).limit(limit).all()
        synced = 0
        skipped = 0
        for buy in buys:
            existing = (
                db.query(AgentSettlement)
                .filter(AgentSettlement.order_no == buy.order_no)
                .first()
            )
            if existing:
                skipped += 1
                continue

            new_record = AgentSettlement(
                id=str(uuid_module.uuid4()),
                uuid=buy.agent_order_uuid,
                order_no=buy.order_no,
                buy_uuid=buy.bug_uuid,
                agent_id=buy.agent_id,
                agent_name=buy.agent_name,
                prologue=buy.prologue,
                agent_avatar=None,
                expiration_date=buy.expiration_date,
                settlement="0",
                withdrawal="0",
                create_time=datetime.now(),
            )
            db.add(new_record)
            synced += 1
        db.commit()
        return success({
            "synced_count": synced,
            "skipped_count": skipped,
            "total_processed": len(buys),
        })


@router.post("/settlement/sync-single/{buy_record_id}", summary="同步单条购买记录")
async def sync_single_record(
    buy_record_id: str,
    user_uuid: str = Depends(require_login),
):
    """同步单条 AgentBuy 记录到 AgentSettlement 表."""
    with get_session() as db:
        from app.models.activity_models import AgentBuy
        from app.models.agent_settlement import AgentSettlement

        # AgentBuy.id 为 Integer, path 参数为 str, 尝试转换
        try:
            query_id: Any = int(buy_record_id)
        except (ValueError, TypeError):
            query_id = buy_record_id

        buy = db.query(AgentBuy).filter(AgentBuy.id == query_id).first()
        if not buy:
            return error("购买记录不存在", code="404000")

        existing = (
            db.query(AgentSettlement)
            .filter(AgentSettlement.order_no == buy.order_no)
            .first()
        )
        if existing:
            return success({
                "buy_record_id": buy_record_id,
                "order_no": buy.order_no,
                "already_synced": True,
                "settlement_id": existing.id,
            })

        new_record = AgentSettlement(
            id=str(uuid_module.uuid4()),
            uuid=buy.agent_order_uuid,
            order_no=buy.order_no,
            buy_uuid=buy.bug_uuid,
            agent_id=buy.agent_id,
            agent_name=buy.agent_name,
            prologue=buy.prologue,
            agent_avatar=None,
            expiration_date=buy.expiration_date,
            settlement="0",
            withdrawal="0",
            create_time=datetime.now(),
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return success({
            "buy_record_id": buy_record_id,
            "order_no": buy.order_no,
            "settlement_id": new_record.id,
        })


@router.post("/settlement/batch-delete", summary="批量删除结算记录")
async def batch_delete_settlements(
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """批量删除 (Body 接收 id_list)."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        id_list = payload.get("id_list", [])
        if not id_list or not isinstance(id_list, list):
            return error("id_list is required and must be a list", code="400000")

        records = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.id.in_(id_list),
                AgentSettlement.uuid == user_uuid,
            )
            .all()
        )
        if not records:
            return error("没有找到要删除的记录", code="404000")

        deleted_count = len(records)
        order_nos = [r.order_no for r in records]
        for record in records:
            db.delete(record)
        db.commit()
        return success({
            "deleted_count": deleted_count,
            "order_nos": order_nos,
        })


@router.get("/settlement/order/{order_no}/summary", summary="订单结算汇总")
async def get_order_settlement_summary(
    order_no: str,
    user_uuid: str = Depends(require_login),
):
    """按 order_no 关联 AgentBuy + AgentSettlement, 返回结算汇总."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        settlements = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.order_no == order_no,
                AgentSettlement.uuid == user_uuid,
            )
            .all()
        )
        if not settlements:
            return error("订单结算记录不存在", code="404000")

        total = len(settlements)
        settled = sum(1 for s in settlements if s.settlement == "1")
        withdrawn = sum(1 for s in settlements if s.withdrawal == "1")
        settlement_rate = round(settled / total * 100, 2) if total > 0 else 0.0
        withdrawal_rate = round(withdrawn / total * 100, 2) if total > 0 else 0.0

        return success({
            "order_no": order_no,
            "total_periods": total,
            "settled_periods": settled,
            "unsettled_periods": total - settled,
            "withdrawn_periods": withdrawn,
            "pending_withdrawal_periods": settled - withdrawn,
            "settlement_rate": settlement_rate,
            "withdrawal_rate": withdrawal_rate,
        })


@router.get("/settlement/stats/income-overview", summary="用户收入概览")
async def get_income_overview(user_uuid: str = Depends(require_login)):
    """返回: 今日收入/待结算/可提现/已提现/累计收入 (金额单位: 元, 保留2位小数)."""
    with get_session() as db:
        from app.models.activity_models import AgentBuy
        from app.models.agent_settlement import AgentSettlement, AgentWithdrawalDetail

        uuid = user_uuid
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)

        # 1. 今日收入: SUM(real_price) where bug_time today AND 属于该用户
        today_income = (
            db.query(func.coalesce(func.sum(AgentBuy.real_price), 0))
            .filter(
                AgentBuy.agent_order_uuid == uuid,
                AgentBuy.bug_time >= today_start,
                AgentBuy.bug_time < tomorrow_start,
            )
            .scalar()
        ) or 0

        # 2. 待结算: SUM(real_price) for orders with settlement=0
        pending_order_nos = (
            db.query(AgentSettlement.order_no)
            .filter(
                AgentSettlement.uuid == uuid,
                AgentSettlement.settlement == "0",
            )
            .distinct()
        )
        pending_settlement = (
            db.query(func.coalesce(func.sum(AgentBuy.real_price), 0))
            .filter(AgentBuy.order_no.in_(pending_order_nos))
            .scalar()
        ) or 0

        # 3. 可提现: SUM(real_price) for orders with settlement=1 AND withdrawal=0
        withdrawable_order_nos = (
            db.query(AgentSettlement.order_no)
            .filter(
                AgentSettlement.uuid == uuid,
                AgentSettlement.settlement == "1",
                AgentSettlement.withdrawal == "0",
            )
            .distinct()
        )
        withdrawable_amount = (
            db.query(func.coalesce(func.sum(AgentBuy.real_price), 0))
            .filter(AgentBuy.order_no.in_(withdrawable_order_nos))
            .scalar()
        ) or 0

        # 4. 已提现: SUM(amount) from AgentWithdrawalDetail where status=2 (完成)
        withdrawn_amount = (
            db.query(func.coalesce(func.sum(AgentWithdrawalDetail.amount), 0))
            .filter(
                AgentWithdrawalDetail.user_id == uuid,
                AgentWithdrawalDetail.status == 2,
            )
            .scalar()
        ) or 0

        # 5. 累计收入: SUM(real_price) all
        accumulated_income = (
            db.query(func.coalesce(func.sum(AgentBuy.real_price), 0))
            .filter(AgentBuy.agent_order_uuid == uuid)
            .scalar()
        ) or 0

        return success({
            "uuid": uuid,
            "todayAccount": round(float(today_income) / 100, 2),
            "PendingSettlement": round(float(pending_settlement) / 100, 2),
            "WithdrawableAmount": round(float(withdrawable_amount) / 100, 2),
            "WithdrawnAmount": round(float(withdrawn_amount) / 100, 2),
            "AccumulatedIncome": round(float(accumulated_income) / 100, 2),
            "statistics_time": now.isoformat(),
        })


# ---- 动态路径 endpoint 放在最后, 避免与上述静态路径冲突 ----


@router.get("/settlement/{record_id}", summary="结算记录详情")
async def get_settlement_detail(
    record_id: str,
    user_uuid: str = Depends(require_login),
):
    """获取结算记录详情."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        record = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.id == record_id,
                AgentSettlement.uuid == user_uuid,
            )
            .first()
        )
        if not record:
            return error("结算记录不存在", code="404000")
        return success(_serialize_settlement(record))


@router.delete("/settlement/{record_id}", summary="删除结算记录")
async def delete_settlement(
    record_id: str,
    user_uuid: str = Depends(require_login),
):
    """删除结算记录."""
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        record = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.id == record_id,
                AgentSettlement.uuid == user_uuid,
            )
            .first()
        )
        if not record:
            return error("结算记录不存在", code="404000")

        order_no = record.order_no
        db.delete(record)
        db.commit()
        return success({"id": record_id, "order_no": order_no})
