"""积分体系 - 积分账户/规则/流水/商品兑换"""

from datetime import date, datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.point_models import (
    PointAccount,
    PointExchange,
    PointGoods,
    PointLog,
    PointRule,
)
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _get_or_create_account(db, user_id: str, user_name: str = "匿名用户") -> PointAccount:
    """获取或创建积分账户"""
    acc = db.query(PointAccount).filter(PointAccount.user_id == user_id).first()
    if not acc:
        acc = PointAccount(
            user_id=user_id,
            user_name=user_name,
            total_point=0,
            available_point=0,
            frozen_point=0,
            used_point=0,
            level=1,
        )
        db.add(acc)
        db.flush()
    return acc


def _add_point(db, user_id: str, action: str, description: str = "", ref_id: str | None = None, ref_type: str | None = None) -> dict:
    """根据行为增加积分"""
    rule = db.query(PointRule).filter(PointRule.code == action, PointRule.status == 1).first()
    if not rule or not rule.point:
        return {"ok": False, "reason": "rule_not_found"}
    if rule.type != "add":
        return {"ok": False, "reason": "not_add_rule"}
    if rule.max_per_day and rule.max_per_day > 0:
        today = date.today()
        start = datetime(today.year, today.month, today.day)
        used = (
            db.query(PointLog)
            .filter(
                PointLog.user_id == user_id,
                PointLog.action == action,
                PointLog.create_time >= start,
            )
            .count()
        )
        if used >= rule.max_per_day:
            return {"ok": False, "reason": "daily_limit"}
    acc = _get_or_create_account(db, user_id)
    p = rule.point
    acc.total_point = (acc.total_point or 0) + p
    acc.available_point = (acc.available_point or 0) + p
    log = PointLog(
        user_id=user_id,
        user_name=acc.user_name,
        type="add",
        action=action,
        point=p,
        balance=acc.available_point,
        description=description or rule.name,
        ref_id=ref_id,
        ref_type=ref_type,
    )
    db.add(log)
    db.flush()
    return {"ok": True, "point": p, "balance": acc.available_point, "log_id": log.id}


def _reduce_point(db, user_id: str, point: int, action: str, description: str = "", ref_id: str | None = None) -> dict:
    """消耗积分"""
    if point <= 0:
        return {"ok": False, "reason": "invalid_point"}
    acc = _get_or_create_account(db, user_id)
    if (acc.available_point or 0) < point:
        return {"ok": False, "reason": "insufficient_point"}
    acc.available_point -= point
    acc.used_point = (acc.used_point or 0) + point
    log = PointLog(
        user_id=user_id,
        user_name=acc.user_name,
        type="reduce",
        action=action,
        point=-point,
        balance=acc.available_point,
        description=description,
        ref_id=ref_id,
    )
    db.add(log)
    return {"ok": True, "point": -point, "balance": acc.available_point}


# ============ 账户 ============


@router.get("/account", summary="我的积分账户")
def my_account():
    with get_session() as db:
        try:
            uid = _uid()
            acc = _get_or_create_account(db, uid)
            return success(
                {
                    "user_id": acc.user_id,
                    "user_name": acc.user_name,
                    "total_point": acc.total_point,
                    "available_point": acc.available_point,
                    "frozen_point": acc.frozen_point,
                    "used_point": acc.used_point,
                    "level": acc.level,
                }
            )
        except Exception as e:
            logger.error(f"point account error: {e}")
            return error(str(e))


@router.get("/account/{user_id}", summary="指定用户积分账户")
def user_account(user_id: str):
    with get_session() as db:
        try:
            acc = db.query(PointAccount).filter(PointAccount.user_id == user_id).first()
            if not acc:
                return success({"user_id": user_id, "total_point": 0, "available_point": 0})
            return success(
                {
                    "user_id": acc.user_id,
                    "user_name": acc.user_name,
                    "total_point": acc.total_point,
                    "available_point": acc.available_point,
                    "frozen_point": acc.frozen_point,
                    "used_point": acc.used_point,
                    "level": acc.level,
                }
            )
        except Exception as e:
            logger.error(f"point user account error: {e}")
            return error(str(e))


# ============ 流水 ============


@router.get("/log/list", summary="积分流水")
def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    action: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(PointLog).filter(PointLog.user_id == _uid())
            if type:
                q = q.filter(PointLog.type == type)
            if action:
                q = q.filter(PointLog.action == action)
            total = q.count()
            items = q.order_by(PointLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "type": l.type,
                        "action": l.action,
                        "point": l.point,
                        "balance": l.balance,
                        "description": l.description,
                        "ref_id": l.ref_id,
                        "ref_type": l.ref_type,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"point log error: {e}")
            return error(str(e))


# ============ 规则 ============


@router.get("/rule/list", summary="积分规则列表")
def rule_list(type: str | None = None):
    with get_session() as db:
        try:
            q = db.query(PointRule).filter(PointRule.status == 1)
            if type:
                q = q.filter(PointRule.type == type)
            items = q.all()
            return success(
                [
                    {
                        "id": r.id,
                        "code": r.code,
                        "name": r.name,
                        "type": r.type,
                        "action": r.action,
                        "point": r.point,
                        "max_per_day": r.max_per_day,
                        "description": r.description,
                    }
                    for r in items
                ]
            )
        except Exception as e:
            logger.error(f"point rule list error: {e}")
            return error(str(e))


@router.post("/rule", summary="新增规则")
def create_rule(
    code: str = Query(...),
    name: str = Query(...),
    type: str = "add",
    action: str = Query(...),
    point: int = Query(0),
    max_per_day: int = 0,
    description: str | None = None,
):
    with get_session() as db:
        try:
            r = PointRule(
                code=code,
                name=name,
                type=type,
                action=action,
                point=point,
                max_per_day=max_per_day,
                description=description,
                status=1,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"point rule create error: {e}")
            return error(str(e))


@router.put("/rule/{rid}", summary="修改规则")
def update_rule(
    rid: int,
    name: str | None = None,
    point: int | None = None,
    max_per_day: int | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            r = db.query(PointRule).filter(PointRule.id == rid).first()
            if not r:
                return error("规则不存在", "404")
            if name:
                r.name = name
            if point is not None:
                r.point = point
            if max_per_day is not None:
                r.max_per_day = max_per_day
            if status is not None:
                r.status = status
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"point rule update error: {e}")
            return error(str(e))


@router.delete("/rule/{rid}", summary="删除规则")
def delete_rule(rid: int):
    with get_session() as db:
        try:
            r = db.query(PointRule).filter(PointRule.id == rid).first()
            if not r:
                return error("规则不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"point rule delete error: {e}")
            return error(str(e))


# ============ 触发行为 ============


@router.post("/trigger", summary="触发积分行为")
def trigger(
    action: str = Query(..., description="行为code"),
    description: str | None = None,
    ref_id: str | None = None,
    ref_type: str | None = None,
    user_id: str | None = None,
):
    with get_session() as db:
        try:
            uid = user_id or _uid()
            res = _add_point(db, uid, action, description or "", ref_id, ref_type)
            if not res.get("ok"):
                return error(res.get("reason", "failed"), "400")
            return success(res)
        except Exception as e:
            logger.error(f"point trigger error: {e}")
            return error(str(e))


# ============ 签到 ============


@router.post("/signin", summary="每日签到")
def signin():
    with get_session() as db:
        try:
            uid = _uid()
            res = _add_point(db, uid, "signin", "每日签到")
            if not res.get("ok"):
                return error(res.get("reason", "failed"), "400")
            return success(res)
        except Exception as e:
            logger.error(f"point signin error: {e}")
            return error(str(e))


# ============ 商城 ============


@router.get("/goods/list", summary="积分商品列表")
def goods_list(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), keyword: str | None = None):
    with get_session() as db:
        try:
            q = db.query(PointGoods).filter(PointGoods.status == 1)
            if keyword:
                q = q.filter(PointGoods.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(PointGoods.sort_order.asc(), PointGoods.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": g.id,
                        "name": g.name,
                        "description": g.description,
                        "image": g.image,
                        "point_cost": g.point_cost,
                        "stock": g.stock,
                        "sold_num": g.sold_num,
                        "limit_per_user": g.limit_per_user,
                        "type": g.type,
                        "sort_order": g.sort_order,
                    }
                    for g in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"point goods list error: {e}")
            return error(str(e))


@router.get("/goods/{gid}", summary="积分商品详情")
def get_goods(gid: int):
    with get_session() as db:
        try:
            g = db.query(PointGoods).filter(PointGoods.id == gid).first()
            if not g:
                return error("商品不存在", "404")
            return success(
                {
                    "id": g.id,
                    "name": g.name,
                    "description": g.description,
                    "image": g.image,
                    "point_cost": g.point_cost,
                    "stock": g.stock,
                    "sold_num": g.sold_num,
                    "limit_per_user": g.limit_per_user,
                    "type": g.type,
                    "sort_order": g.sort_order,
                }
            )
        except Exception as e:
            logger.error(f"point goods get error: {e}")
            return error(str(e))


@router.post("/goods", summary="新增积分商品")
def create_goods(
    name: str = Query(..., min_length=1, max_length=200),
    description: str | None = None,
    image: str | None = None,
    point_cost: int = Query(0, ge=0),
    stock: int = Query(0, ge=0),
    limit_per_user: int = 1,
    type: str = "virtual",
    sort_order: int = 0,
):
    with get_session() as db:
        try:
            g = PointGoods(
                name=name,
                description=description,
                image=image,
                point_cost=point_cost,
                stock=stock,
                limit_per_user=limit_per_user,
                type=type,
                sort_order=sort_order,
                status=1,
            )
            db.add(g)
            db.flush()
            return success({"id": g.id})
        except Exception as e:
            logger.error(f"point goods create error: {e}")
            return error(str(e))


@router.put("/goods/{gid}", summary="修改商品")
def update_goods(
    gid: int,
    name: str | None = None,
    description: str | None = None,
    point_cost: int | None = None,
    stock: int | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            g = db.query(PointGoods).filter(PointGoods.id == gid).first()
            if not g:
                return error("商品不存在", "404")
            if name:
                g.name = name
            if description is not None:
                g.description = description
            if point_cost is not None:
                g.point_cost = point_cost
            if stock is not None:
                g.stock = stock
            if status is not None:
                g.status = status
            return success({"id": g.id})
        except Exception as e:
            logger.error(f"point goods update error: {e}")
            return error(str(e))


@router.delete("/goods/{gid}", summary="删除商品")
def delete_goods(gid: int):
    with get_session() as db:
        try:
            g = db.query(PointGoods).filter(PointGoods.id == gid).first()
            if not g:
                return error("商品不存在", "404")
            db.delete(g)
            return success()
        except Exception as e:
            logger.error(f"point goods delete error: {e}")
            return error(str(e))


# ============ 兑换 ============


@router.post("/exchange", summary="兑换商品")
def exchange(
    goods_id: int = Query(...),
    quantity: int = Query(1, ge=1),
    address: str | None = None,
    contact: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            g = db.query(PointGoods).filter(PointGoods.id == goods_id).first()
            if not g or g.status != 1:
                return error("商品不存在或已下架", "404")
            if g.stock < quantity:
                return error("库存不足", "400")
            if g.limit_per_user > 0:
                exchanged = (
                    db.query(PointExchange)
                    .filter(PointExchange.user_id == uid, PointExchange.goods_id == goods_id)
                    .count()
                )
                if exchanged >= g.limit_per_user:
                    return error("已达兑换上限", "400")
            total = g.point_cost * quantity
            res = _reduce_point(db, uid, total, "exchange", f"兑换商品:{g.name}", str(goods_id))
            if not res.get("ok"):
                return error(res.get("reason", "insufficient"), "400")
            g.stock = (g.stock or 0) - quantity
            g.sold_num = (g.sold_num or 0) + quantity
            ex = PointExchange(
                user_id=uid,
                user_name="匿名用户",
                goods_id=goods_id,
                goods_name=g.name,
                point_cost=g.point_cost,
                quantity=quantity,
                total_point=total,
                status=0,
                address=address,
                contact=contact,
            )
            db.add(ex)
            db.flush()
            return success({"id": ex.id, "point_cost": total, "balance": res["balance"]})
        except Exception as e:
            logger.error(f"point exchange error: {e}")
            return error(str(e))


@router.get("/exchange/list", summary="兑换记录")
def exchange_list(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), status: int | None = None):
    with get_session() as db:
        try:
            q = db.query(PointExchange).filter(PointExchange.user_id == _uid())
            if status is not None:
                q = q.filter(PointExchange.status == status)
            total = q.count()
            items = q.order_by(PointExchange.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": e.id,
                        "goods_id": e.goods_id,
                        "goods_name": e.goods_name,
                        "point_cost": e.point_cost,
                        "quantity": e.quantity,
                        "total_point": e.total_point,
                        "status": e.status,
                        "address": e.address,
                        "contact": e.contact,
                        "express_no": e.express_no,
                        "create_time": e.created_at.isoformat() if e.created_at else None,
                    }
                    for e in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"point exchange list error: {e}")
            return error(str(e))
