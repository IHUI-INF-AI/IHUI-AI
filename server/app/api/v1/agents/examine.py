"""Agent examine/audit routes.

字段名 (按 app.models.activity_models.AgentExamine):
  - status (BigInteger): 0=pending, 1=examining, 2=approved,
                         3=rejected(coze), 4=rejected(platform), 5=delisted
  - desc (Text): 审核备注/通过拒绝原因 (注意: 不是 examine_remark)
  - created_at (来自 TimestampMixin): 创建时间 (注意: 不是 create_time)
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic 请求模型 (替换早期 dict 接收, 提供自动校验 + OpenAPI 文档)
# ---------------------------------------------------------------------------


class AgentExamineSubmitRequest(BaseModel):
    """提交审核请求体。所有字段可选, 兼容旧的无 body 调用。"""

    agent_name: str | None = None
    agent_avatar: str | None = None
    prologue: str | None = None
    category_id: str | None = None
    status: int = 1  # 默认审核中
    start_user: str | None = None
    start_phone: str | None = None
    start_name: str | None = None
    desc: str | None = None
    follow: str | None = None


class AgentExamineBatchSyncAvatarRequest(BaseModel):
    """批量头像同步请求体。agent_ids 缺省时走自动模式。"""

    agent_ids: list[str] | None = None


class AgentExamineUpdateRequest(BaseModel):
    """审核记录更新请求体。所有字段可选, 仅允许白名单字段。"""

    agent_name: str | None = None
    agent_avatar: str | None = None
    prologue: str | None = None
    category_id: str | None = None
    status: int | None = None
    examine_user: str | None = None
    examine_user_id: str | None = None
    desc: str | None = None
    follow: str | None = None


def _serialize_examine(ex) -> dict:
    """统一序列化 AgentExamine 记录 (字段名: status / desc / created_at)."""
    return {
        "id": ex.id,
        "agent_id": ex.agent_id,
        "agent_name": ex.agent_name,
        "agent_avatar": ex.agent_avatar,
        "prologue": ex.prologue,
        "category_id": ex.category_id,
        "status": ex.status,
        "start_time": str(ex.start_time) if ex.start_time else None,
        "start_user": ex.start_user,
        "start_phone": ex.start_phone,
        "start_name": ex.start_name,
        "examine_user": ex.examine_user,
        "examine_user_id": ex.examine_user_id,
        "examine_time": str(ex.examine_time) if ex.examine_time else None,
        "desc": ex.desc,
        "follow": ex.follow,
        "created_at": str(ex.created_at) if ex.created_at else None,
    }


# ---------------------------------------------------------------------------
# 1. GET /examine/list - 列表 (增强: 多筛选 + status=2 时 JOIN category 表)
# Round 22: 路由前缀重构 /list → /examine/list, 避免与 buy.py /list 冲突
# ---------------------------------------------------------------------------
@router.get("/examine/list", summary="List agent examinations")
async def list_examine(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    agent_id: str | None = Query(None, description="按智能体ID筛选"),
    agent_name: str | None = Query(None, description="智能体名称模糊搜索"),
    category_id: str | None = Query(None, description="按收费配置ID筛选"),
    status: int | None = Query(
        None,
        description="审核状态: 0=待提交,1=审核中,2=通过,3=拒绝(coze),4=退回,5=下架",
    ),
    status_list: str | None = Query(None, description="多状态筛选,逗号分隔,如: 0,1,2"),
    start_user: str | None = Query(None, description="发起用户UUID筛选"),
    start_name: str | None = Query(None, description="发起用户名称模糊搜索"),
    examine_user_id: str | None = Query(None, description="审核人ID筛选"),
    examine_user: str | None = Query(None, description="审核人名称模糊搜索"),
    start_date: datetime | None = Query(None, description="发起开始时间"),
    end_date: datetime | None = Query(None, description="发起结束时间"),
    examine_start_date: datetime | None = Query(None, description="审核开始时间"),
    examine_end_date: datetime | None = Query(None, description="审核结束时间"),
    keyword: str | None = Query(None, description="关键词搜索(名称/描述/发起名/审核人)"),
    sort_by: str = Query(
        "start_time", description="排序字段: start_time,examine_time,status,agent_name"
    ),
    sort_order: str = Query("desc", description="排序方向: asc/desc"),
    user_uuid: str = Depends(require_login),
):
    """获取审核记录列表。status=2 时 LEFT JOIN AgentCategory 表带回 category_info。"""
    from sqlalchemy import asc, desc, or_

    with get_session() as db:
        from app.models.activity_models import AgentCategory, AgentExamine

        need_join = status == 2
        if need_join:
            q = db.query(AgentExamine, AgentCategory).outerjoin(
                AgentCategory, AgentExamine.agent_id == AgentCategory.agent_id
            )
        else:
            q = db.query(AgentExamine)

        if agent_id:
            q = q.filter(AgentExamine.agent_id == agent_id)
        if agent_name:
            q = q.filter(AgentExamine.agent_name.like(f"%{agent_name}%"))
        if category_id:
            q = q.filter(AgentExamine.category_id == category_id)
        if status is not None:
            q = q.filter(AgentExamine.status == status)
        if status_list:
            try:
                vals = [int(s.strip()) for s in status_list.split(",") if s.strip().isdigit()]
                if vals:
                    q = q.filter(AgentExamine.status.in_(vals))
            except ValueError:
                pass
        if start_user:
            q = q.filter(AgentExamine.start_user == start_user)
        if start_name:
            q = q.filter(AgentExamine.start_name.like(f"%{start_name}%"))
        if examine_user_id:
            q = q.filter(AgentExamine.examine_user_id == examine_user_id)
        if examine_user:
            q = q.filter(AgentExamine.examine_user.like(f"%{examine_user}%"))
        if start_date:
            q = q.filter(AgentExamine.start_time >= start_date)
        if end_date:
            q = q.filter(AgentExamine.start_time <= end_date)
        if examine_start_date:
            q = q.filter(AgentExamine.examine_time >= examine_start_date)
        if examine_end_date:
            q = q.filter(AgentExamine.examine_time <= examine_end_date)
        if keyword:
            kw = f"%{keyword}%"
            q = q.filter(
                or_(
                    AgentExamine.agent_name.like(kw),
                    AgentExamine.desc.like(kw),
                    AgentExamine.start_name.like(kw),
                    AgentExamine.examine_user.like(kw),
                )
            )

        total = q.count()

        if hasattr(AgentExamine, sort_by):
            col = getattr(AgentExamine, sort_by)
            q = q.order_by(desc(col) if sort_order.lower() == "desc" else asc(col))
        else:
            q = q.order_by(desc(AgentExamine.start_time))

        rows = q.offset((page - 1) * limit).limit(limit).all()

        data = []
        for row in rows:
            if need_join:
                ex, cat = row
            else:
                ex, cat = row, None
            item = _serialize_examine(ex)
            if cat:
                item["category_info"] = {
                    "id": cat.id,
                    "agent_id": cat.agent_id,
                    "group": cat.group,
                    "type": cat.type,
                    "type_child": cat.type_child,
                    "limit_free": cat.limit_free,
                    "account": cat.account,
                    "create_time": str(cat.create_time) if cat.create_time else None,
                }
            data.append(item)

        return success(data, total=total)


# ---------------------------------------------------------------------------
# 2. GET /examine/stats/summary - 统计 (增强: 状态分布 + 近7天 + 审核效率)
# Round 22: 路由前缀重构 /stats/summary → /examine/stats/summary
# ---------------------------------------------------------------------------
@router.get("/examine/stats/summary", summary="Examination statistics")
async def examine_stats(
    start_date: datetime | None = Query(None, description="统计开始时间"),
    end_date: datetime | None = Query(None, description="统计结束时间"),
    user_uuid: str = Depends(require_login),
):
    """审核统计: 状态分布 + 近7天提交数 + 审核效率(平均审批时长, 小时)。"""
    with get_session() as db:
        from app.models.activity_models import AgentExamine

        q = db.query(AgentExamine)
        if start_date:
            q = q.filter(AgentExamine.start_time >= start_date)
        if end_date:
            q = q.filter(AgentExamine.start_time <= end_date)

        total = q.count()

        # 状态分布 (group_by status)
        status_names = {
            0: "pending",
            1: "examining",
            2: "approved",
            3: "rejected",
            4: "returned",
            5: "delisted",
        }
        rows = (
            db.query(AgentExamine.status, func.count(AgentExamine.id))
            .group_by(AgentExamine.status)
            .all()
        )
        distribution = {name: {"count": 0, "percentage": 0.0} for name in status_names.values()}
        for status_val, cnt in rows:
            if status_val is None:
                continue
            name = status_names.get(int(status_val))
            if name:
                distribution[name]["count"] = cnt
        if total > 0:
            for name in distribution:
                distribution[name]["percentage"] = round(
                    distribution[name]["count"] / total * 100, 2
                )

        # 近7天提交数
        seven_days_ago = datetime.now() - timedelta(days=7)
        recent_q = db.query(AgentExamine).filter(AgentExamine.start_time >= seven_days_ago)
        recent_total = recent_q.count()
        recent_approved = recent_q.filter(AgentExamine.status == 2).count()
        recent_rejected = recent_q.filter(AgentExamine.status.in_([3, 4])).count()
        recent_approval_rate = (
            round(recent_approved / recent_total * 100, 2) if recent_total > 0 else 0.0
        )

        # 审核效率: 平均审批时长 (examine_time - start_time) -> 小时
        avg_hours = None
        approved_rows = (
            db.query(AgentExamine)
            .filter(
                AgentExamine.status == 2,
                AgentExamine.examine_time.isnot(None),
                AgentExamine.start_time.isnot(None),
            )
            .all()
        )
        if approved_rows:
            seconds_list = []
            for r in approved_rows:
                if r.examine_time and r.start_time:
                    seconds_list.append((r.examine_time - r.start_time).total_seconds())
            if seconds_list:
                avg_hours = round(sum(seconds_list) / len(seconds_list) / 3600, 2)

        total_approved = distribution["approved"]["count"]
        total_rejected = distribution["rejected"]["count"] + distribution["returned"]["count"]

        stats = {
            "total_records": total,
            "status_distribution": distribution,
            "recent_7_days": {
                "total": recent_total,
                "approved": recent_approved,
                "rejected": recent_rejected,
                "approval_rate": recent_approval_rate,
            },
            "efficiency": {
                "avg_approval_time_hours": avg_hours,
                "total_approved": total_approved,
                "total_rejected": total_rejected,
                "overall_approval_rate": (
                    round(total_approved / total * 100, 2) if total > 0 else 0.0
                ),
            },
            "query_info": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "generated_at": datetime.now().isoformat(),
            },
        }
        return success(stats)


# ---------------------------------------------------------------------------
# 3. POST /examine/submit - 提交审核 (增强: 接收完整字段, 兼容旧调用)
# Round 22: 路由前缀重构 /submit → /examine/submit
# ---------------------------------------------------------------------------
@router.post("/examine/submit", summary="Submit agent for examination")
async def submit_examine(
    agent_id: str = Query(..., description="智能体ID"),
    body: AgentExamineSubmitRequest | None = Body(default=None),
    user_uuid: str = Depends(require_login),
):
    """提交审核。

    兼容旧调用: POST /submit?agent_id=xxx (无 body)。
    增强: body 可传 agent_name/avatar/prologue/category_id/status/
          start_user/phone/name/desc/follow 等完整字段。
    若未提供 agent_name/avatar/prologue, 尝试从 agents 表读取补全。
    """
    body = body or AgentExamineSubmitRequest()
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            agent_name = body.agent_name
            agent_avatar = body.agent_avatar
            prologue = body.prologue
            category_id = body.category_id
            status_val = int(body.status)  # 默认审核中
            start_user = body.start_user or user_uuid
            start_phone = body.start_phone
            start_name = body.start_name
            desc_val = body.desc
            follow = body.follow

            # 未提供字段尝试从 agents 表补全
            if agent_name is None or agent_avatar is None or prologue is None:
                try:
                    from app.models.agent_models import Agent

                    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
                    if agent:
                        if agent_name is None:
                            agent_name = agent.agent_name
                        if agent_avatar is None:
                            agent_avatar = agent.agent_avatar
                        if prologue is None:
                            prologue = agent.prologue
                except ImportError:
                    logger.warning("Agent model not available, skip auto-fill")

            ex = AgentExamine(
                agent_id=agent_id,
                agent_name=agent_name,
                agent_avatar=agent_avatar,
                prologue=prologue,
                category_id=category_id,
                status=status_val,
                start_time=datetime.now(),
                start_user=start_user,
                start_phone=start_phone,
                start_name=start_name,
                desc=desc_val,
                follow=follow,
            )
            db.add(ex)
            db.commit()
            db.refresh(ex)
            return success(_serialize_examine(ex), msg="Submitted for review")
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 4. POST /examine/batch-sync-avatar - 批量头像同步
# ---------------------------------------------------------------------------
@router.post("/examine/batch-sync-avatar", summary="Batch sync agent avatars")
async def batch_sync_agent_avatars(
    body: AgentExamineBatchSyncAvatarRequest | None = Body(default=None),
    user_uuid: str = Depends(require_login),
):
    """批量同步头像。

    body: {"agent_ids": ["id1","id2",...]}
    若未提供 agent_ids, 自动找出 agent_avatar 为空的审核记录循环同步。
    """
    body = body or AgentExamineBatchSyncAvatarRequest()
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            try:
                from app.models.agent_models import Agent
            except ImportError:
                return error("Agent model not available", code="400000")

            agent_ids = body.agent_ids or []
            auto_mode = not agent_ids

            if auto_mode:
                # 找出 agent_avatar 为空的审核记录, 收集 agent_id
                missing_records = (
                    db.query(AgentExamine)
                    .filter(AgentExamine.agent_avatar.is_(None))
                    .all()
                )
                agent_ids = list({r.agent_id for r in missing_records if r.agent_id})

            if not agent_ids:
                return success(
                    {
                        "total": 0,
                        "success_count": 0,
                        "error_count": 0,
                        "results": [],
                    },
                    msg="No agents to sync",
                )

            agents = db.query(Agent).filter(Agent.agent_id.in_(agent_ids)).all()
            agent_map = {a.agent_id: a for a in agents}

            now = datetime.now()
            success_count = 0
            error_count = 0
            results = []

            for aid in agent_ids:
                agent = agent_map.get(aid)
                if not agent:
                    results.append(
                        {"agent_id": aid, "success": False, "msg": "Agent not found"}
                    )
                    error_count += 1
                    continue
                if not agent.agent_avatar:
                    results.append(
                        {"agent_id": aid, "success": False, "msg": "Agent avatar empty"}
                    )
                    error_count += 1
                    continue

                recs = (
                    db.query(AgentExamine)
                    .filter(AgentExamine.agent_id == aid)
                    .all()
                )
                if not recs:
                    results.append(
                        {"agent_id": aid, "success": False, "msg": "No examine records"}
                    )
                    error_count += 1
                    continue

                upd = 0
                for r in recs:
                    r.agent_avatar = agent.agent_avatar
                    follow_update = f"[{now}] batch sync avatar: -> {agent.agent_avatar}"
                    r.follow = f"{r.follow}\n{follow_update}" if r.follow else follow_update
                    upd += 1

                results.append(
                    {
                        "agent_id": aid,
                        "success": True,
                        "msg": f"Synced {upd} records",
                        "updated_count": upd,
                        "agent_avatar": agent.agent_avatar,
                    }
                )
                success_count += 1

            db.commit()
            return success(
                {
                    "total": len(agent_ids),
                    "success_count": success_count,
                    "error_count": error_count,
                    "auto_mode": auto_mode,
                    "results": results,
                },
                msg=f"Batch done: success={success_count}, error={error_count}",
            )
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 5. POST /examine/sync-avatar/{agent_id} - 单智能体头像同步
# ---------------------------------------------------------------------------
@router.post("/examine/sync-avatar/{agent_id}", summary="Sync single agent avatar")
async def sync_agent_avatar(
    agent_id: str,
    user_uuid: str = Depends(require_login),
):
    """从 agents 表读 avatar 更新到 AgentExamine.agent_avatar (单智能体)。"""
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            try:
                from app.models.agent_models import Agent
            except ImportError:
                return error("Agent model not available", code="400000")

            agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
            if not agent:
                return error(f"Agent not found: {agent_id}", code="404000")
            if not agent.agent_avatar:
                return error(f"Agent avatar is empty: {agent_id}", code="400000")

            records = (
                db.query(AgentExamine)
                .filter(AgentExamine.agent_id == agent_id)
                .all()
            )
            if not records:
                return error(f"No examine records for agent: {agent_id}", code="404000")

            now = datetime.now()
            updated = 0
            for r in records:
                old = r.agent_avatar
                r.agent_avatar = agent.agent_avatar
                follow_update = f"[{now}] sync avatar: {old} -> {agent.agent_avatar}"
                r.follow = f"{r.follow}\n{follow_update}" if r.follow else follow_update
                updated += 1

            db.commit()
            return success(
                {
                    "agent_id": agent_id,
                    "agent_name": agent.agent_name,
                    "agent_avatar": agent.agent_avatar,
                    "updated_count": updated,
                },
                msg=f"Synced {updated} records",
            )
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 6. PUT /examine/{record_id} - 通用更新 (全字段, 状态变更触发 examine_time)
# ---------------------------------------------------------------------------
@router.put("/examine/{record_id}", summary="Update examination record")
async def update_agent_examine(
    record_id: int,
    body: AgentExamineUpdateRequest | None = Body(default=None),
    user_uuid: str = Depends(require_login),
):
    """通用更新审核记录。

    允许字段: agent_name/agent_avatar/prologue/category_id/status/
            examine_user/examine_user_id/desc/follow。
    状态变更 (2/3/4) 自动触发 examine_time。
    """
    body = body or AgentExamineUpdateRequest()
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404000")

            # Pydantic 模型字段即白名单, exclude_unset 只更新显式传入字段
            update_data = body.model_dump(exclude_unset=True)
            updated = {}
            for k, v in update_data.items():
                setattr(ex, k, v)
                updated[k] = v

            # 状态变更触发审核时间
            if "status" in updated and updated["status"] in (2, 3, 4):
                ex.examine_time = datetime.now()

            db.commit()
            db.refresh(ex)
            return success(_serialize_examine(ex), msg="Updated")
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 7. DELETE /examine/{record_id} - 删除审核记录
# ---------------------------------------------------------------------------
@router.delete("/examine/{record_id}", summary="Delete examination record")
async def delete_agent_examine(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404000")
            db.delete(ex)
            db.commit()
            return success({"id": record_id}, msg="Deleted")
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 8. GET /examine/{record_id} - 详情
# Round 22: 路由前缀重构 /{record_id} → /examine/{record_id}, 避免与 buy.py /{record_id} 冲突
# ---------------------------------------------------------------------------
@router.get("/examine/{record_id}", summary="Get examination detail")
async def get_examine_detail(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.activity_models import AgentExamine

        ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
        if not ex:
            return error("Examination record not found", code="404000")
        return success(_serialize_examine(ex))


# ---------------------------------------------------------------------------
# 9. PUT /examine/{record_id}/approve - 审核通过 (status=2)
# Round 22: 路由前缀重构 /{record_id}/approve → /examine/{record_id}/approve
# ---------------------------------------------------------------------------
@router.put("/examine/{record_id}/approve", summary="Approve agent examination")
async def approve_examine(
    record_id: int,
    remark: str = Body(None, embed=True),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine
            from app.models.agent_models import Agent

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404000")
            if ex.status == 2:
                return error("Already approved", code="400000")

            # 字段名修复: examine_status -> status, examine_remark -> desc
            # 状态值修复: 通过 = 2 (历史误用 1=审核中)
            ex.status = 2
            ex.examine_user = user_uuid
            ex.examine_time = datetime.now()
            ex.desc = remark

            # 同步 agent 发布状态
            agent = db.query(Agent).filter(Agent.agent_id == ex.agent_id).first()
            if agent:
                agent.publish_status = 1
                agent.publish_time = datetime.now()

            # 流转记录
            follow_record = f"[{datetime.now()}] {user_uuid} approved"
            ex.follow = f"{ex.follow}\n{follow_record}" if ex.follow else follow_record

            db.commit()
            return success(msg="Approved")
        except Exception as e:
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# 10. PUT /examine/{record_id}/reject - 审核拒绝 (status=3)
# Round 22: 路由前缀重构 /{record_id}/reject → /examine/{record_id}/reject
# ---------------------------------------------------------------------------
@router.put("/examine/{record_id}/reject", summary="Reject agent examination")
async def reject_examine(
    record_id: int,
    reject_reason: str = Body(..., embed=True),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404000")
            if ex.status == 3:
                return error("Already rejected", code="400000")

            # 字段名修复: examine_status -> status, examine_remark -> desc
            # 状态值修复: 拒绝 = 3 (历史误用 2=通过)
            ex.status = 3
            ex.examine_user = user_uuid
            ex.examine_time = datetime.now()
            ex.desc = reject_reason

            follow_record = f"[{datetime.now()}] {user_uuid} rejected: {reject_reason}"
            ex.follow = f"{ex.follow}\n{follow_record}" if ex.follow else follow_record

            db.commit()
            return success(msg="Rejected")
        except Exception as e:
            db.rollback()
            return error(str(e))
