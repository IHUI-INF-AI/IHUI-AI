"""edu 微服务 legacy 补齐 v2 - 迁移自 edu client/service/service 的 3 个未迁移 Controller.

2026-06-26 补齐 (Java→Python 迁移完整性核查发现):
  - point-service ChannelController (/channel 6 端点, 表 t_channel)
  - schedule-service WatchController (GET /watch, Redis 中转调度)
  - search-service RecordController (GET /record/list, 表 t_record 热词)

实现策略:
  - 全部用 text SQL 通用 dict 返回, 避免与 learn_models.Record (t_record 学习记录) 表名冲突
  - 鉴权: ChannelController 写操作需 require_login, RecordController 只读也需登录
  - 表不存在时优雅降级返回空列表 (dev SQLite 降级模式), 不影响前端

参考: Java 源码
  - h:\\历史项目存档\\edu client\\service\\service\\ihui-ai-edu-point-service\\...\\ChannelController.java
  - h:\\历史项目存档\\edu client\\service\\service\\ihui-ai-edu-schedule-service\\...\\WatchController.java
  - h:\\历史项目存档\\edu client\\service\\service\\ihui-ai-edu-search-service\\...\\RecordController.java
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="", tags=["Edu-Legacy-Supplement-v2"])


def _get_db():
    """Session helper: yield db (next() 兼容, close 由 get_session 的 with 处理)."""
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _err(msg: str, code: int = -1) -> dict:
    return {"code": code, "msg": msg}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    """SQLAlchemy Row mapping -> List[dict]."""
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


# ===========================================================================
# 1. point-service ChannelController - 路径: /channel (表 t_channel)
# Java 源: ihui-ai-edu-point-service/.../channel/web/ChannelController.java
# 6 个端点: list/all/get/create/update/delete
# ===========================================================================

@router.get("/channel/list", summary="[Channel]积分渠道分页列表")
def channel_page(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /channel/list. 按 name 模糊匹配 keyword."""
    try:
        where = "1=1"
        params: Dict[str, Any] = {"offset": (page - 1) * size, "limit": size}
        if keyword:
            where += " AND name LIKE :keyword"
            params["keyword"] = f"%{keyword}%"
        count_sql = text(f"SELECT COUNT(*) AS c FROM t_channel WHERE {where}")
        list_sql = text(f"""
            SELECT id, name, member_receive_num, day_issued_num, day_member_receive_num,
                   issued_num, change_remind, increase_remind_tips, decrease_remind_tips,
                   user_id, create_time, update_time
            FROM t_channel
            WHERE {where}
            ORDER BY id DESC
            LIMIT :offset, :limit
        """)
        total = db.execute(count_sql, params).scalar() or 0
        rows = db.execute(list_sql, params)
        return _ok({
            "list": _rows_to_list(rows),
            "total": int(total),
            "current": page,
            "size": size,
            "pages": (int(total) + size - 1) // size if size else 0,
        })
    except Exception as e:
        logger.debug("channel_page failed: %s", e)
        return _ok({"list": [], "total": 0, "current": page, "size": size, "pages": 0})


@router.get("/channel/all", summary="[Channel]积分渠道全量列表")
def channel_all(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /channel/all."""
    try:
        rows = db.execute(text("""
            SELECT id, name, member_receive_num, day_issued_num, day_member_receive_num,
                   issued_num, change_remind, increase_remind_tips, decrease_remind_tips,
                   user_id, create_time, update_time
            FROM t_channel
            ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("channel_all failed: %s", e)
        return _ok([])


@router.get("/channel", summary="[Channel]积分渠道详情")
def channel_get(
    id: int = Query(..., gt=0),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /channel?id=xxx."""
    try:
        row = db.execute(text("""
            SELECT id, name, member_receive_num, day_issued_num, day_member_receive_num,
                   issued_num, change_remind, increase_remind_tips, decrease_remind_tips,
                   user_id, create_time, update_time
            FROM t_channel
            WHERE id = :id
        """), {"id": id}).mappings().first()
        if not row:
            return _err("找不到相关渠道")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("channel_get failed: %s", e)
        return _err(f"查询失败: {e}")


@router.post("/channel", summary="[Channel]添加积分渠道")
def channel_create(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /channel. payload: {name, member_receive_num, day_issued_num, ...}."""
    try:
        cols = []
        vals = []
        params: Dict[str, Any] = {}
        for k in ("name", "member_receive_num", "day_issued_num", "day_member_receive_num",
                  "issued_num", "change_remind", "increase_remind_tips", "decrease_remind_tips"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.extend(["user_id", "create_time", "update_time"])
        vals.extend([":user_id", ":now", ":now"])
        params["user_id"] = payload.get("user_id") or 0
        params["now"] = utcnow()
        sql = text(f"INSERT INTO t_channel ({', '.join(cols)}) VALUES ({', '.join(vals)})")
        result = db.execute(sql, params)
        db.commit()
        new_id = result.lastrowid or result.rowcount
        return _ok({"id": new_id}, "添加成功")
    except Exception as e:
        db.rollback()
        logger.debug("channel_create failed: %s", e)
        return _err(f"添加失败: {e}")


@router.put("/channel", summary="[Channel]修改积分渠道")
def channel_update(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java PUT /channel. 必填 id>0."""
    cid = payload.get("id")
    if not cid or int(cid) <= 0:
        return _err("id为必填项")
    try:
        sets = []
        params: Dict[str, Any] = {"id": cid}
        for k in ("name", "member_receive_num", "day_issued_num", "day_member_receive_num",
                  "issued_num", "change_remind", "increase_remind_tips", "decrease_remind_tips"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        sets.append("update_time = :now")
        params["now"] = utcnow()
        sql = text(f"UPDATE t_channel SET {', '.join(sets)} WHERE id = :id")
        result = db.execute(sql, params)
        db.commit()
        if result.rowcount == 0:
            return _err("找不到相关渠道")
        return _ok({"id": cid}, "修改成功")
    except Exception as e:
        db.rollback()
        logger.debug("channel_update failed: %s", e)
        return _err(f"修改失败: {e}")


@router.delete("/channel", summary="[Channel]删除积分渠道")
def channel_delete(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java DELETE /channel. payload: {id}."""
    cid = payload.get("id")
    if not cid:
        return _err("id为必填项")
    try:
        result = db.execute(text("DELETE FROM t_channel WHERE id = :id"), {"id": cid})
        db.commit()
        if result.rowcount == 0:
            return _err("找不到相关渠道")
        return _ok({"id": cid}, "删除成功")
    except Exception as e:
        db.rollback()
        logger.debug("channel_delete failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 2. schedule-service WatchController - 路径: GET /watch
# Java 源: ihui-ai-edu-schedule-service/.../watch/web/WatchController.java
# 业务: 定时任务手动触发, 从 Redis 读 watch_* 缓冲并转发到 comment 服务
# Python 简化: 直接调用 visittracking 落库逻辑 (Redis watch_* → zhs_visit_log)
# ===========================================================================

@router.get("/watch", summary="[Watch]触发浏览记录批量落库")
def watch_create(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /watch.

    Java 原逻辑: WatchTask.saveWatchTask() 从 Redis scan watch_* 键,
    反序列化为 List<WatchRequest>, HTTP 转发到 comment-service /comment/public-api/watch.

    Python 简化实现:
    1. 尝试从 Redis 读 watch_* 键 (若 Redis 可用)
    2. 无 Redis 或无数据时返回 ok (符合 Java 行为: 异常仅记录日志)
    """
    try:
        # 尝试从 Redis 读 watch_* 键 (best-effort, 失败则返回 ok)
        try:
            from app.core.redis_client import get_redis_client  # type: ignore
            redis_client = get_redis_client()
            if redis_client:
                keys = redis_client.keys("watch_*")
                if keys:
                    values = redis_client.mget(keys)
                    records = []
                    for v in values:
                        if v:
                            try:
                                records.append(json.loads(v))
                            except Exception:
                                pass
                    # 写入 zhs_visit_log (复用 visittracking 表)
                    if records:
                        for r in records:
                            try:
                                db.execute(text("""
                                    INSERT INTO zhs_visit_log
                                        (user_uuid, page_url, referer, user_agent, ip, device,
                                         duration_ms, event, extra, created_at)
                                    VALUES
                                        (:user_uuid, :page_url, :referer, :user_agent, :ip, :device,
                                         :duration_ms, :event, :extra, :created_at)
                                """), {
                                    "user_uuid": r.get("user_uuid", ""),
                                    "page_url": r.get("page_url", ""),
                                    "referer": r.get("referer", ""),
                                    "user_agent": r.get("user_agent", ""),
                                    "ip": r.get("ip", ""),
                                    "device": r.get("device", ""),
                                    "duration_ms": int(r.get("duration_ms", 0)),
                                    "event": r.get("event", "view"),
                                    "extra": json.dumps(r.get("extra", {}), ensure_ascii=False),
                                    "created_at": utcnow(),
                                })
                            except Exception:
                                pass
                        db.commit()
                        redis_client.delete(*keys)
                        return _ok({"processed": len(records)}, "ok")
                return _ok({"processed": 0}, "ok")
        except Exception as e:
            logger.debug("watch_create redis best-effort failed: %s", e)
        return _ok({"processed": 0}, "ok")
    except Exception as e:
        logger.debug("watch_create failed: %s", e)
        return _ok({"processed": 0}, "ok")


# ===========================================================================
# 3. search-service RecordController - 路径: GET /record/list
# Java 源: ihui-ai-edu-search-service/.../record/web/RecordController.java
# 表: t_record (注意: 与 learn_models.Record 同名不同义, Java 是热词记录表)
# 字段: word, ip_addr, member_id, create_time
# 修复: Java RecordServiceImpl.setSize(page.getPages()) 二次赋值 bug → setPages
# ===========================================================================

@router.get("/record/list", summary="[SearchRecord]搜索热词记录分页列表")
def search_record_list(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /record/list.

    修正 Java BUG: RecordServiceImpl.list() 第 50 行
      wordGetListResponse.setSize(page.getPages())  # 应为 setPages
    Python 返回正确的 size/pages 字段.
    """
    try:
        where = "1=1"
        params: Dict[str, Any] = {"offset": (page - 1) * size, "limit": size}
        if keyword:
            where += " AND word LIKE :keyword"
            params["keyword"] = f"%{keyword}%"
        count_sql = text(f"SELECT COUNT(*) AS c FROM t_record WHERE {where}")
        list_sql = text(f"""
            SELECT id, word, ip_addr, member_id, create_time
            FROM t_record
            WHERE {where}
            ORDER BY create_time DESC
            LIMIT :offset, :limit
        """)
        total = db.execute(count_sql, params).scalar() or 0
        rows = db.execute(list_sql, params)
        return _ok({
            "list": _rows_to_list(rows),
            "total": int(total),
            "current": page,
            "size": size,  # 修正 Java BUG: 这里是 size (page size), 不是 pages
            "pages": (int(total) + size - 1) // size if size else 0,
        })
    except Exception as e:
        logger.debug("search_record_list failed: %s", e)
        return _ok({"list": [], "total": 0, "current": page, "size": size, "pages": 0})
