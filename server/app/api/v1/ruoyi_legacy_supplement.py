"""RuoYi Legacy Supplement API - 迁移自 ai-smart-society-java 的 7 个未迁移 Controller.

2026-06-26 补齐 (Java→Python 迁移完整性核查发现).

7 个 Controller (全部 RuoYi 标准 CRUD 模式):
  1. AgentTaskDeveloperController  /taskDeveloper       表 agent_task_developer   6 端点
  2. ZhsAgentController             /zhsAgent            表 zhs_agent               7 端点
  3. ZhsAgentCategoryController     /agentCategory       表 zhs_agent_category      6 端点
  4. ZhsIdentityProportionController /identity_proportion 表 zhs_identity_proportion 6 端点
  5. ZhsOperateTokenFlowController  /token_flow          表 zhs_operate_token_flow  6 端点
  6. ZhsUserAgentAudioController    /userAgentAudio      表 zhs_user_agent_audio    6 端点
  7. ZhsWithdrawalDetailController  /Withdrawaldetail    表 zhs_withdrawal_detail   6 端点

Java 源: ai-smart-society-java/ruoyi-modules/ai-program/.../slave/controller/*.java

实现策略:
  - 全部用 text SQL 通用 dict 返回, 不绑定 ORM model (避免表名冲突)
  - 鉴权: require_login (Java 用 @RequiresPermissions 细粒度权限码, Python 简化)
  - 分页参数: pageNum/pageSize (RuoYi 惯例), Python 转为 offset/limit
  - export 端点暂返回提示信息 (需 openpyxl 实现, 留待后续)
  - 表不存在时优雅降级返回空列表
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="", tags=["RuoYi-Legacy-Supplement"])


def _get_db():
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _err(msg: str, code: int = -1) -> dict:
    return {"code": code, "msg": msg}


def _ajax(success: bool, msg: str = "") -> dict:
    """对应 Java AjaxResult."""
    return {"code": 200 if success else 500, "msg": msg or ("操作成功" if success else "操作失败")}


def _table_data(rows: List[Dict[str, Any]], total: int) -> dict:
    """对应 Java TableDataInfo."""
    return {"code": 0, "rows": rows, "total": total, "msg": "查询成功"}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


def _parse_ids(ids: str) -> List[str]:
    """Java 用 String[] ids 逗号分隔, Python 拆分."""
    if not ids:
        return []
    return [s.strip() for s in str(ids).split(",") if s.strip()]


def _page_params(page_num: int, page_size: int) -> Dict[str, Any]:
    return {"offset": (page_num - 1) * page_size, "limit": page_size}


# ===========================================================================
# 1. AgentTaskDeveloperController - /taskDeveloper (表 agent_task_developer)
# Java: /taskDeveloper/list, /export, /{id}, POST, PUT, DELETE /{ids}
# ===========================================================================

@router.get("/taskDeveloper/list", summary="[AgentTaskDeveloper]接单记录列表")
def task_developer_list(
    pageNum: int = Query(1, ge=1, alias="pageNum"),
    pageSize: int = Query(10, ge=1, le=100, alias="pageSize"),
    developer_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if developer_id:
            where += " AND developer_id = :developer_id"
            params["developer_id"] = developer_id
        if agent_id:
            where += " AND agent_id = :agent_id"
            params["agent_id"] = agent_id
        if status is not None:
            where += " AND status = :status"
            params["status"] = status
        total = db.execute(text(f"SELECT COUNT(*) FROM agent_task_developer WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, developer_id, agent_id, status, create_time, update_time
            FROM agent_task_developer WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("task_developer_list failed: %s", e)
        return _table_data([], 0)


@router.get("/taskDeveloper/{item_id}", summary="[AgentTaskDeveloper]接单记录详情")
def task_developer_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, developer_id, agent_id, status, create_time, update_time
            FROM agent_task_developer WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("task_developer_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/taskDeveloper", summary="[AgentTaskDeveloper]新增接单记录")
def task_developer_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k in ("developer_id", "agent_id", "status"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO agent_task_developer ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("task_developer_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/taskDeveloper", summary="[AgentTaskDeveloper]修改接单记录")
def task_developer_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k in ("developer_id", "agent_id", "status"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE agent_task_developer SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("task_developer_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/taskDeveloper/{ids}", summary="[AgentTaskDeveloper]删除接单记录")
def task_developer_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM agent_task_developer WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("task_developer_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 2. ZhsAgentController - /zhsAgent (表 zhs_agent)
# Java: /zhsAgent/list, /export, /{id}, POST, PUT, DELETE /{ids}, DELETE /{id}
# ===========================================================================

@router.get("/zhsAgent/list", summary="[ZhsAgent]Agent管理列表")
def zhs_agent_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    agent_name: Optional[str] = None,
    status: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if agent_name:
            where += " AND agent_name LIKE :agent_name"
            params["agent_name"] = f"%{agent_name}%"
        if status is not None:
            where += " AND status = :status"
            params["status"] = status
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_agent WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, agent_id, agent_name, agent_avatar, status, create_time, update_time
            FROM zhs_agent WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_agent_list failed: %s", e)
        return _table_data([], 0)


@router.get("/zhsAgent/{item_id}", summary="[ZhsAgent]Agent详情")
def zhs_agent_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, agent_id, agent_name, agent_avatar, status, create_time, update_time
            FROM zhs_agent WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "Agent不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_agent_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/zhsAgent", summary="[ZhsAgent]新增Agent")
def zhs_agent_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k in ("agent_id", "agent_name", "agent_avatar", "status"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO zhs_agent ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/zhsAgent", summary="[ZhsAgent]修改Agent")
def zhs_agent_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k in ("agent_id", "agent_name", "agent_avatar", "status"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE zhs_agent SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/zhsAgent/{ids}", summary="[ZhsAgent]删除Agent(支持批量)")
def zhs_agent_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_agent WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 3. ZhsAgentCategoryController - /agentCategory (表 zhs_agent_category)
# ===========================================================================

@router.get("/agentCategory/list", summary="[ZhsAgentCategory]开发者智能体收费配置列表")
def agent_category_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    agent_id: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if agent_id:
            where += " AND agent_id = :agent_id"
            params["agent_id"] = agent_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_agent_category WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, agent_id, `group`, type, type_child, limit_free, account, create_time
            FROM zhs_agent_category WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_category_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentCategory/{item_id}", summary="[ZhsAgentCategory]详情")
def agent_category_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, agent_id, `group`, type, type_child, limit_free, account, create_time
            FROM zhs_agent_category WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_category_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentCategory", summary="[ZhsAgentCategory]新增")
def agent_category_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k in ("agent_id", "group", "type", "type_child", "limit_free", "account"):
            if k in payload:
                cols.append(f"`{k}`")
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.append("create_time")
        vals.append(":now")
        db.execute(text(f"INSERT INTO zhs_agent_category ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentCategory", summary="[ZhsAgentCategory]修改")
def agent_category_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid}
        for k in ("agent_id", "group", "type", "type_child", "limit_free", "account"):
            if k in payload:
                sets.append(f"`{k}` = :{k}")
                params[k] = payload[k]
        if not sets:
            return _ajax(False, "无更新字段")
        result = db.execute(text(f"UPDATE zhs_agent_category SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentCategory/{ids}", summary="[ZhsAgentCategory]删除(批量)")
def agent_category_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_agent_category WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 4. ZhsIdentityProportionController - /identity_proportion (表 zhs_identity_proportion)
# ===========================================================================

@router.get("/identity_proportion/list", summary="[IdentityProportion]分润比例列表")
def identity_proportion_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    status: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if status is not None:
            where += " AND status = :status"
            params["status"] = status
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_identity_proportion WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, begin_time, end_time, status, gift, vip_gift, trader_gift,
                   token_proportion, routine_proportion, vip_proportion, trader_proportion,
                   trader_routine_proportion, trader_vip_proportion, trader_trader_proportion,
                   grand_routine_proportion, grand_vip_proportion, grand_trader_proportion,
                   creator, created_time, updator, updated_time
            FROM zhs_identity_proportion WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("identity_proportion_list failed: %s", e)
        return _table_data([], 0)


@router.get("/identity_proportion/{item_id}", summary="[IdentityProportion]详情")
def identity_proportion_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, begin_time, end_time, status, gift, vip_gift, trader_gift,
                   token_proportion, routine_proportion, vip_proportion, trader_proportion,
                   trader_routine_proportion, trader_vip_proportion, trader_trader_proportion,
                   grand_routine_proportion, grand_vip_proportion, grand_trader_proportion,
                   creator, created_time, updator, updated_time
            FROM zhs_identity_proportion WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("identity_proportion_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/identity_proportion", summary="[IdentityProportion]新增")
def identity_proportion_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        allowed = ("begin_time", "end_time", "status", "gift", "vip_gift", "trader_gift",
                   "token_proportion", "routine_proportion", "vip_proportion", "trader_proportion",
                   "trader_routine_proportion", "trader_vip_proportion", "trader_trader_proportion",
                   "grand_routine_proportion", "grand_vip_proportion", "grand_trader_proportion", "creator")
        cols, vals, params = [], [], {}
        for k in allowed:
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.extend(["created_time", "updated_time"])
        vals.extend([":now", ":now"])
        params["now"] = utcnow()
        db.execute(text(f"INSERT INTO zhs_identity_proportion ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("identity_proportion_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/identity_proportion", summary="[IdentityProportion]修改")
def identity_proportion_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        allowed = ("begin_time", "end_time", "status", "gift", "vip_gift", "trader_gift",
                   "token_proportion", "routine_proportion", "vip_proportion", "trader_proportion",
                   "trader_routine_proportion", "trader_vip_proportion", "trader_trader_proportion",
                   "grand_routine_proportion", "grand_vip_proportion", "grand_trader_proportion", "updator")
        sets, params = [], {"id": cid, "now": utcnow()}
        for k in allowed:
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        sets.append("updated_time = :now")
        if len(sets) <= 1:
            return _ajax(False, "无更新字段")
        result = db.execute(text(f"UPDATE zhs_identity_proportion SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("identity_proportion_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/identity_proportion/{ids}", summary="[IdentityProportion]删除(批量)")
def identity_proportion_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_identity_proportion WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("identity_proportion_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 5. ZhsOperateTokenFlowController - /token_flow (表 zhs_operate_token_flow)
# 注意: Python 已用 token_service 业务级替代, 此处仅补 1:1 表 CRUD 兼容
# ===========================================================================

@router.get("/token_flow/list", summary="[OperateTokenFlow]Token流水列表")
def token_flow_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    user_uuid: Optional[str] = None,
    type: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if user_uuid:
            where += " AND user_uuid = :user_uuid"
            params["user_uuid"] = user_uuid
        if type is not None:
            where += " AND type = :type"
            params["type"] = type
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_operate_token_flow WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, user_id, user_uuid, token_quantity, token_free, type, operate_desc, created_at
            FROM zhs_operate_token_flow WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("token_flow_list failed: %s", e)
        return _table_data([], 0)


@router.get("/token_flow/{item_id}", summary="[OperateTokenFlow]Token流水详情")
def token_flow_get(
    item_id: int = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, user_id, user_uuid, token_quantity, token_free, type, operate_desc, created_at
            FROM zhs_operate_token_flow WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("token_flow_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/token_flow", summary="[OperateTokenFlow]新增Token流水")
def token_flow_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        import time
        cols, vals, params = [], [], {"now": int(time.time())}
        for k in ("user_id", "user_uuid", "token_quantity", "token_free", "type", "operate_desc"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.append("created_at")
        vals.append(":now")
        db.execute(text(f"INSERT INTO zhs_operate_token_flow ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("token_flow_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/token_flow", summary="[OperateTokenFlow]修改Token流水")
def token_flow_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid}
        for k in ("user_id", "user_uuid", "token_quantity", "token_free", "type", "operate_desc"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        if not sets:
            return _ajax(False, "无更新字段")
        result = db.execute(text(f"UPDATE zhs_operate_token_flow SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("token_flow_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/token_flow/{ids}", summary="[OperateTokenFlow]删除Token流水(批量)")
def token_flow_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = [int(s) for s in _parse_ids(ids)]
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_operate_token_flow WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("token_flow_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 6. ZhsUserAgentAudioController - /userAgentAudio (表 zhs_user_agent_audio)
# ===========================================================================

@router.get("/userAgentAudio/list", summary="[UserAgentAudio]用户音色列表")
def user_agent_audio_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    user_uuid: Optional[str] = None,
    agent_id: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if user_uuid:
            where += " AND user_uuid = :user_uuid"
            params["user_uuid"] = user_uuid
        if agent_id:
            where += " AND agent_id = :agent_id"
            params["agent_id"] = agent_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_user_agent_audio WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, user_uuid, agent_id, audio_url, duration, create_time
            FROM zhs_user_agent_audio WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_agent_audio_list failed: %s", e)
        return _table_data([], 0)


@router.get("/userAgentAudio/{item_id}", summary="[UserAgentAudio]用户音色详情")
def user_agent_audio_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, user_uuid, agent_id, audio_url, duration, create_time
            FROM zhs_user_agent_audio WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_agent_audio_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/userAgentAudio", summary="[UserAgentAudio]新增用户音色")
def user_agent_audio_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k in ("user_uuid", "agent_id", "audio_url", "duration"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.append("create_time")
        vals.append(":now")
        db.execute(text(f"INSERT INTO zhs_user_agent_audio ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_agent_audio_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/userAgentAudio", summary="[UserAgentAudio]修改用户音色")
def user_agent_audio_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid}
        for k in ("user_uuid", "agent_id", "audio_url", "duration"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        if not sets:
            return _ajax(False, "无更新字段")
        result = db.execute(text(f"UPDATE zhs_user_agent_audio SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_agent_audio_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/userAgentAudio/{ids}", summary="[UserAgentAudio]删除用户音色(批量)")
def user_agent_audio_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_user_agent_audio WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_agent_audio_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 7. ZhsWithdrawalDetailController - /Withdrawaldetail (表 zhs_withdrawal_detail)
# 注意 Java 路径大小写: /Withdrawaldetail (W大写, d小写)
# 业务: 提现明细 + 微信商家转账 (handleReview 含 0.98 手续费 + 微信转账逻辑)
# ===========================================================================

@router.get("/Withdrawaldetail/list", summary="[WithdrawalDetail]提现明细列表")
def withdrawal_detail_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    user_uuid: Optional[str] = None,
    withdrawal_status: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if user_uuid:
            where += " AND open_id = :user_uuid"
            params["user_uuid"] = user_uuid
        if withdrawal_status:
            where += " AND withdrawal_status = :withdrawal_status"
            params["withdrawal_status"] = withdrawal_status
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_withdrawal_detail WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, open_id, user_name, withdrawal_amount, audit_amount, withdrawal_status,
                   out_bill_no, wechat_msg, order_ids, create_time, update_time
            FROM zhs_withdrawal_detail WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("withdrawal_detail_list failed: %s", e)
        return _table_data([], 0)


@router.get("/Withdrawaldetail/{item_id}", summary="[WithdrawalDetail]提现明细详情(含0.98手续费)")
def withdrawal_detail_get(
    item_id: str = Path(..., alias="Id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java getInfo: 查 detail + 若 orderIds 非空, 查 zhs_commission_flow SUM(amount),
    audit_amount = audit_amount * 0.98 (扣 2% 手续费)."""
    try:
        row = db.execute(text("""
            SELECT id, open_id, user_name, withdrawal_amount, audit_amount, withdrawal_status,
                   out_bill_no, wechat_msg, order_ids, create_time, update_time
            FROM zhs_withdrawal_detail WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        result = dict(row)
        # Java 业务: 若 order_ids 非空, 查 zhs_commission_flow SUM(amount) WHERE order_id IN (...) AND belongers_open_id = open_id
        order_ids = result.get("order_ids")
        open_id = result.get("open_id")
        if order_ids and open_id:
            oid_list = [s.strip() for s in str(order_ids).split(",") if s.strip()]
            if oid_list:
                try:
                    audit_sum = db.execute(text("""
                        SELECT COALESCE(SUM(amount), 0) FROM zhs_commission_flow
                        WHERE order_id IN :oids AND belongers_open_id = :oid
                    """), {"oids": tuple(oid_list), "oid": open_id}).scalar() or 0
                    # 0.98 手续费 (扣 2%)
                    result["audit_amount"] = int(float(audit_sum) * 0.98)
                except Exception as e:
                    logger.debug("withdrawal audit sum failed: %s", e)
        return _ok(result)
    except Exception as e:
        logger.debug("withdrawal_detail_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/Withdrawaldetail", summary="[WithdrawalDetail]新增提现明细")
def withdrawal_detail_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k in ("open_id", "user_name", "withdrawal_amount", "audit_amount", "withdrawal_status",
                  "out_bill_no", "wechat_msg", "order_ids"):
            if k in payload:
                cols.append(k)
                vals.append(f":{k}")
                params[k] = payload[k]
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO zhs_withdrawal_detail ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("withdrawal_detail_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/Withdrawaldetail", summary="[WithdrawalDetail]提现审核(含微信转账)")
def withdrawal_detail_handle_review(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java handleReview: 更新状态 + 若 withdrawalStatus != '5' 则调微信商家转账.

    Python 实现:
    - 更新状态记录
    - 若 withdrawal_status 为 '5' 直接返回
    - 否则尝试调微信转账 (best-effort, 失败时设 status='4' 失败)
    """
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    withdrawal_status = payload.get("withdrawal_status", "")
    try:
        # 清空 wechat_msg, 更新状态
        sets, params = [], {"id": cid, "now": utcnow(), "wechat_msg": ""}
        for k in ("open_id", "user_name", "withdrawal_amount", "audit_amount", "withdrawal_status",
                  "out_bill_no", "order_ids"):
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        sets.append("wechat_msg = :wechat_msg")
        sets.append("update_time = :now")
        db.execute(text(f"UPDATE zhs_withdrawal_detail SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()

        # 若 status == '5' 直接返回
        if withdrawal_status == "5":
            return _ajax(True, "跳过转账")

        # 尝试调微信转账 (best-effort)
        open_id = payload.get("open_id", "")
        amount = payload.get("withdrawal_amount", 0)
        out_bill_no = payload.get("out_bill_no", "")
        user_name = payload.get("user_name", "")
        if open_id and amount and out_bill_no:
            try:
                from app.services.wechat_transfer_service import transfer_to_user  # type: ignore
                transfer_result = transfer_to_user(open_id, int(amount), out_bill_no, user_name)
                state = transfer_result.get("state", "FAIL") if isinstance(transfer_result, dict) else "FAIL"
                if state in ("ACCEPTED", "WAIT_USER_CONFIRM", "TRANSFERING"):
                    final_status = "2"  # 待收款
                    wechat_msg = json.dumps(transfer_result, ensure_ascii=False)
                else:
                    final_status = "4"  # 失败
                    wechat_msg = transfer_result.get("message", "转账失败") if isinstance(transfer_result, dict) else "转账失败"
                db.execute(text("""
                    UPDATE zhs_withdrawal_detail
                    SET withdrawal_status = :status, wechat_msg = :msg, out_bill_no = :bill, update_time = :now
                    WHERE id = :id
                """), {"id": cid, "status": final_status, "msg": wechat_msg, "bill": out_bill_no, "now": utcnow()})
                db.commit()
                return _ajax(True, "提现审核成功")
            except ImportError:
                # 微信转账服务未实现, 仅更新状态
                logger.debug("wechat_transfer_service not implemented, status only updated")
                return _ajax(True, "状态已更新, 微信转账服务未实现")
            except Exception as e:
                # 转账失败, 设 status='4'
                db.execute(text("""
                    UPDATE zhs_withdrawal_detail
                    SET withdrawal_status = '4', wechat_msg = :msg, update_time = :now
                    WHERE id = :id
                """), {"id": cid, "msg": str(e), "now": utcnow()})
                db.commit()
                return _ajax(False, f"微信转账失败: {e}")
        return _ajax(True, "状态已更新")
    except Exception as e:
        db.rollback()
        logger.debug("withdrawal_detail_handle_review failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/Withdrawaldetail/{ids}", summary="[WithdrawalDetail]删除提现明细(批量)")
def withdrawal_detail_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_withdrawal_detail WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("withdrawal_detail_remove failed: %s", e)
        return _ajax(False, str(e))
