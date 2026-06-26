"""RuoYi Legacy CRUD Batch - 批量迁移自 ai-smart-society-java 的缺失 Controller.

2026-06-26 补齐 (阶段 2b: RuoYi 后台 CRUD 六件套统一模式批量).

本文件为 RuoYi 标准 CRUD 六件套的批量生成版本:
  - 每个 Controller 生成 6 个端点: list/export/{id}/POST/PUT/DELETE/{ids}
  - 全部用 text SQL + dict 返回, 不绑定 ORM model
  - 表不存在时优雅降级返回空列表
  - 鉴权: require_login (Java 用 @RequiresPermissions 细粒度权限码, Python 简化)
  - 分页参数: pageNum/pageSize (RuoYi 惯例)

Java 源: ai-smart-society-java/ruoyi-modules/ai-program/.../slave|course|auth/controller/*.java
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="", tags=["RuoYi-Legacy-CRUD-Batch"])


def _get_db():
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _ajax(success: bool, msg: str = "") -> dict:
    return {"code": 200 if success else 500, "msg": msg or ("操作成功" if success else "操作失败")}


def _table_data(rows: List[Dict[str, Any]], total: int) -> dict:
    return {"code": 0, "rows": rows, "total": total, "msg": "查询成功"}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


def _parse_ids(ids: str) -> List[str]:
    if not ids:
        return []
    return [s.strip() for s in str(ids).split(",") if s.strip()]



# ===========================================================================
# FundAliPayController - /fund/ali/pay (表 fund_ali_pay)
# ===========================================================================

@router.get("/fund/ali/pay/list", summary="[FundAliPay]列表")
def fund_ali_pay_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `fund_ali_pay`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `fund_ali_pay` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("fund_ali_pay_list failed: %s", e)
        return _table_data([], 0)


@router.get("/fund/ali/pay/export", summary="[FundAliPay]导出", include_in_schema=False)
def fund_ali_pay_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/fund/ali/pay/{item_id}", summary="[FundAliPay]详情")
def fund_ali_pay_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `fund_ali_pay` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("fund_ali_pay_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/fund/ali/pay", summary="[FundAliPay]新增")
def fund_ali_pay_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `fund_ali_pay` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("fund_ali_pay_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/fund/ali/pay", summary="[FundAliPay]修改")
def fund_ali_pay_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `fund_ali_pay` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("fund_ali_pay_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/fund/ali/pay/{ids}", summary="[FundAliPay]删除(支持批量)")
def fund_ali_pay_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `fund_ali_pay` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("fund_ali_pay_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# RemoteThirdController - /remote/third (表 remote_third)
# ===========================================================================

@router.get("/remote/third/list", summary="[RemoteThird]列表")
def remote_third_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `remote_third`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `remote_third` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("remote_third_list failed: %s", e)
        return _table_data([], 0)


@router.get("/remote/third/export", summary="[RemoteThird]导出", include_in_schema=False)
def remote_third_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/remote/third/{item_id}", summary="[RemoteThird]详情")
def remote_third_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `remote_third` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("remote_third_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/remote/third", summary="[RemoteThird]新增")
def remote_third_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `remote_third` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("remote_third_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/remote/third", summary="[RemoteThird]修改")
def remote_third_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `remote_third` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("remote_third_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/remote/third/{ids}", summary="[RemoteThird]删除(支持批量)")
def remote_third_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `remote_third` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("remote_third_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# SysJobLogController - /job/log (表 sys_job_log)
# ===========================================================================

@router.get("/job/log/list", summary="[SysJobLog]列表")
def sys_job_log_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `sys_job_log`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `sys_job_log` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("sys_job_log_list failed: %s", e)
        return _table_data([], 0)


@router.get("/job/log/export", summary="[SysJobLog]导出", include_in_schema=False)
def sys_job_log_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/job/log/{item_id}", summary="[SysJobLog]详情")
def sys_job_log_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `sys_job_log` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("sys_job_log_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/job/log", summary="[SysJobLog]新增")
def sys_job_log_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `sys_job_log` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_log_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/job/log", summary="[SysJobLog]修改")
def sys_job_log_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `sys_job_log` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_log_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/job/log/{ids}", summary="[SysJobLog]删除(支持批量)")
def sys_job_log_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `sys_job_log` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_log_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AliLoginController - /login/ali (表 ali_login)
# ===========================================================================

@router.get("/login/ali/list", summary="[AliLogin]列表")
def ali_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ali_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ali_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ali_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/ali/export", summary="[AliLogin]导出", include_in_schema=False)
def ali_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/ali/{item_id}", summary="[AliLogin]详情")
def ali_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ali_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ali_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/ali", summary="[AliLogin]新增")
def ali_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ali_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ali_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/ali", summary="[AliLogin]修改")
def ali_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ali_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ali_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/ali/{ids}", summary="[AliLogin]删除(支持批量)")
def ali_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ali_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ali_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# FeishuLoginController - /login/feishu (表 feishu_login)
# ===========================================================================

@router.get("/login/feishu/list", summary="[FeishuLogin]列表")
def feishu_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `feishu_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `feishu_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("feishu_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/feishu/export", summary="[FeishuLogin]导出", include_in_schema=False)
def feishu_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/feishu/{item_id}", summary="[FeishuLogin]详情")
def feishu_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `feishu_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("feishu_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/feishu", summary="[FeishuLogin]新增")
def feishu_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `feishu_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("feishu_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/feishu", summary="[FeishuLogin]修改")
def feishu_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `feishu_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("feishu_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/feishu/{ids}", summary="[FeishuLogin]删除(支持批量)")
def feishu_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `feishu_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("feishu_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# PwdLoginController - /login/pwd (表 pwd_login)
# ===========================================================================

@router.get("/login/pwd/list", summary="[PwdLogin]列表")
def pwd_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `pwd_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `pwd_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("pwd_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/pwd/export", summary="[PwdLogin]导出", include_in_schema=False)
def pwd_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/pwd/{item_id}", summary="[PwdLogin]详情")
def pwd_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `pwd_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("pwd_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/pwd", summary="[PwdLogin]新增")
def pwd_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `pwd_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("pwd_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/pwd", summary="[PwdLogin]修改")
def pwd_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `pwd_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("pwd_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/pwd/{ids}", summary="[PwdLogin]删除(支持批量)")
def pwd_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `pwd_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("pwd_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# WechatLoginController - /login/wechat (表 wechat_login)
# ===========================================================================

@router.get("/login/wechat/list", summary="[WechatLogin]列表")
def wechat_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `wechat_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `wechat_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("wechat_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/wechat/export", summary="[WechatLogin]导出", include_in_schema=False)
def wechat_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/wechat/{item_id}", summary="[WechatLogin]详情")
def wechat_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `wechat_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("wechat_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/wechat", summary="[WechatLogin]新增")
def wechat_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `wechat_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("wechat_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/wechat", summary="[WechatLogin]修改")
def wechat_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `wechat_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("wechat_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/wechat/{ids}", summary="[WechatLogin]删除(支持批量)")
def wechat_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `wechat_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("wechat_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# GoogleLoginController - /login/google (表 google_login)
# ===========================================================================

@router.get("/login/google/list", summary="[GoogleLogin]列表")
def google_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `google_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `google_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("google_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/google/export", summary="[GoogleLogin]导出", include_in_schema=False)
def google_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/google/{item_id}", summary="[GoogleLogin]详情")
def google_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `google_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("google_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/google", summary="[GoogleLogin]新增")
def google_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `google_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("google_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/google", summary="[GoogleLogin]修改")
def google_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `google_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("google_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/google/{ids}", summary="[GoogleLogin]删除(支持批量)")
def google_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `google_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("google_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# EnterpriseWeChatLoginController - /login/enterprise (表 enterprise_wechat_login)
# ===========================================================================

@router.get("/login/enterprise/list", summary="[EnterpriseWeChatLogin]列表")
def enterprise_we_chat_login_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `enterprise_wechat_login`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `enterprise_wechat_login` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("enterprise_we_chat_login_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login/enterprise/export", summary="[EnterpriseWeChatLogin]导出", include_in_schema=False)
def enterprise_we_chat_login_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login/enterprise/{item_id}", summary="[EnterpriseWeChatLogin]详情")
def enterprise_we_chat_login_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `enterprise_wechat_login` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("enterprise_we_chat_login_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login/enterprise", summary="[EnterpriseWeChatLogin]新增")
def enterprise_we_chat_login_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `enterprise_wechat_login` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("enterprise_we_chat_login_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login/enterprise", summary="[EnterpriseWeChatLogin]修改")
def enterprise_we_chat_login_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `enterprise_wechat_login` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("enterprise_we_chat_login_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login/enterprise/{ids}", summary="[EnterpriseWeChatLogin]删除(支持批量)")
def enterprise_we_chat_login_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `enterprise_wechat_login` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("enterprise_we_chat_login_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AiFileStorageController - /official/storage (表 ai_file_storage)
# ===========================================================================

@router.get("/official/storage/list", summary="[AiFileStorage]列表")
def ai_file_storage_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ai_file_storage`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ai_file_storage` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ai_file_storage_list failed: %s", e)
        return _table_data([], 0)


@router.get("/official/storage/export", summary="[AiFileStorage]导出", include_in_schema=False)
def ai_file_storage_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/official/storage/{item_id}", summary="[AiFileStorage]详情")
def ai_file_storage_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ai_file_storage` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ai_file_storage_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/official/storage", summary="[AiFileStorage]新增")
def ai_file_storage_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ai_file_storage` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ai_file_storage_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/official/storage", summary="[AiFileStorage]修改")
def ai_file_storage_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ai_file_storage` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_file_storage_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/official/storage/{ids}", summary="[AiFileStorage]删除(支持批量)")
def ai_file_storage_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ai_file_storage` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_file_storage_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# CozeChatController - /coze/chat (表 coze_chat)
# ===========================================================================

@router.get("/coze/chat/list", summary="[CozeChat]列表")
def coze_chat_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `coze_chat`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `coze_chat` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("coze_chat_list failed: %s", e)
        return _table_data([], 0)


@router.get("/coze/chat/export", summary="[CozeChat]导出", include_in_schema=False)
def coze_chat_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/coze/chat/{item_id}", summary="[CozeChat]详情")
def coze_chat_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `coze_chat` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("coze_chat_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/coze/chat", summary="[CozeChat]新增")
def coze_chat_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `coze_chat` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("coze_chat_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/coze/chat", summary="[CozeChat]修改")
def coze_chat_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `coze_chat` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("coze_chat_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/coze/chat/{ids}", summary="[CozeChat]删除(支持批量)")
def coze_chat_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `coze_chat` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("coze_chat_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# CozeBotController - /coze/bot (表 coze_bot)
# ===========================================================================

@router.get("/coze/bot/list", summary="[CozeBot]列表")
def coze_bot_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `coze_bot`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `coze_bot` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("coze_bot_list failed: %s", e)
        return _table_data([], 0)


@router.get("/coze/bot/export", summary="[CozeBot]导出", include_in_schema=False)
def coze_bot_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/coze/bot/{item_id}", summary="[CozeBot]详情")
def coze_bot_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `coze_bot` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("coze_bot_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/coze/bot", summary="[CozeBot]新增")
def coze_bot_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `coze_bot` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("coze_bot_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/coze/bot", summary="[CozeBot]修改")
def coze_bot_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `coze_bot` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("coze_bot_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/coze/bot/{ids}", summary="[CozeBot]删除(支持批量)")
def coze_bot_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `coze_bot` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("coze_bot_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentCategoryController - /category (表 agent_category)
# ===========================================================================

@router.get("/category/list", summary="[AgentCategory]列表")
def agent_category_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agent_category`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agent_category` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_category_list failed: %s", e)
        return _table_data([], 0)


@router.get("/category/export", summary="[AgentCategory]导出", include_in_schema=False)
def agent_category_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/category/{item_id}", summary="[AgentCategory]详情")
def agent_category_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agent_category` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_category_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/category", summary="[AgentCategory]新增")
def agent_category_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agent_category` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/category", summary="[AgentCategory]修改")
def agent_category_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agent_category` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/category/{ids}", summary="[AgentCategory]删除(支持批量)")
def agent_category_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agent_category` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentCategoryLinkController - /category_link (表 agent_category_link)
# ===========================================================================

@router.get("/category_link/list", summary="[AgentCategoryLink]列表")
def agent_category_link_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agent_category_link`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agent_category_link` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_category_link_list failed: %s", e)
        return _table_data([], 0)


@router.get("/category_link/export", summary="[AgentCategoryLink]导出", include_in_schema=False)
def agent_category_link_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/category_link/{item_id}", summary="[AgentCategoryLink]详情")
def agent_category_link_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agent_category_link` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_category_link_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/category_link", summary="[AgentCategoryLink]新增")
def agent_category_link_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agent_category_link` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_link_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/category_link", summary="[AgentCategoryLink]修改")
def agent_category_link_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agent_category_link` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_link_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/category_link/{ids}", summary="[AgentCategoryLink]删除(支持批量)")
def agent_category_link_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agent_category_link` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_category_link_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentNeedTaskController - /agentTask (表 agent_need_task)
# ===========================================================================

@router.get("/agentTask/list", summary="[AgentNeedTask]列表")
def agent_need_task_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agent_need_task`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agent_need_task` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_need_task_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentTask/export", summary="[AgentNeedTask]导出", include_in_schema=False)
def agent_need_task_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentTask/{item_id}", summary="[AgentNeedTask]详情")
def agent_need_task_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agent_need_task` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_need_task_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentTask", summary="[AgentNeedTask]新增")
def agent_need_task_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agent_need_task` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_need_task_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentTask", summary="[AgentNeedTask]修改")
def agent_need_task_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agent_need_task` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_need_task_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentTask/{ids}", summary="[AgentNeedTask]删除(支持批量)")
def agent_need_task_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agent_need_task` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_need_task_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentRuleController - /agentRule (表 agent_rule)
# ===========================================================================

@router.get("/agentRule/list", summary="[AgentRule]列表")
def agent_rule_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agent_rule`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agent_rule` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_rule_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentRule/export", summary="[AgentRule]导出", include_in_schema=False)
def agent_rule_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentRule/{item_id}", summary="[AgentRule]详情")
def agent_rule_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agent_rule` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_rule_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentRule", summary="[AgentRule]新增")
def agent_rule_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agent_rule` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentRule", summary="[AgentRule]修改")
def agent_rule_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agent_rule` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentRule/{ids}", summary="[AgentRule]删除(支持批量)")
def agent_rule_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agent_rule` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentRuleParamController - /agentRuleParam (表 agent_rule_param)
# ===========================================================================

@router.get("/agentRuleParam/list", summary="[AgentRuleParam]列表")
def agent_rule_param_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agent_rule_param`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agent_rule_param` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agent_rule_param_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentRuleParam/export", summary="[AgentRuleParam]导出", include_in_schema=False)
def agent_rule_param_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentRuleParam/{item_id}", summary="[AgentRuleParam]详情")
def agent_rule_param_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agent_rule_param` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agent_rule_param_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentRuleParam", summary="[AgentRuleParam]新增")
def agent_rule_param_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agent_rule_param` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_param_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentRuleParam", summary="[AgentRuleParam]修改")
def agent_rule_param_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agent_rule_param` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_param_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentRuleParam/{ids}", summary="[AgentRuleParam]删除(支持批量)")
def agent_rule_param_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agent_rule_param` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agent_rule_param_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AgentsController - /agents (表 agents)
# ===========================================================================

@router.get("/agents/list", summary="[Agents]列表")
def agents_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `agents`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `agents` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("agents_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agents/export", summary="[Agents]导出", include_in_schema=False)
def agents_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agents/{item_id}", summary="[Agents]详情")
def agents_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `agents` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("agents_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agents", summary="[Agents]新增")
def agents_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `agents` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("agents_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agents", summary="[Agents]修改")
def agents_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `agents` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agents_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agents/{ids}", summary="[Agents]删除(支持批量)")
def agents_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `agents` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("agents_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# PowerPurchaseRuleController - /powerPurchaseRule (表 power_purchase_rule)
# ===========================================================================

@router.get("/powerPurchaseRule/list", summary="[PowerPurchaseRule]列表")
def power_purchase_rule_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `power_purchase_rule`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `power_purchase_rule` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("power_purchase_rule_list failed: %s", e)
        return _table_data([], 0)


@router.get("/powerPurchaseRule/export", summary="[PowerPurchaseRule]导出", include_in_schema=False)
def power_purchase_rule_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/powerPurchaseRule/{item_id}", summary="[PowerPurchaseRule]详情")
def power_purchase_rule_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `power_purchase_rule` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("power_purchase_rule_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/powerPurchaseRule", summary="[PowerPurchaseRule]新增")
def power_purchase_rule_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `power_purchase_rule` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("power_purchase_rule_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/powerPurchaseRule", summary="[PowerPurchaseRule]修改")
def power_purchase_rule_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `power_purchase_rule` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("power_purchase_rule_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/powerPurchaseRule/{ids}", summary="[PowerPurchaseRule]删除(支持批量)")
def power_purchase_rule_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `power_purchase_rule` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("power_purchase_rule_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsAdvertiseController - /advertise (表 zhs_advertise)
# ===========================================================================

@router.get("/advertise/list", summary="[ZhsAdvertise]列表")
def zhs_advertise_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_advertise`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_advertise` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_advertise_list failed: %s", e)
        return _table_data([], 0)


@router.get("/advertise/export", summary="[ZhsAdvertise]导出", include_in_schema=False)
def zhs_advertise_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/advertise/{item_id}", summary="[ZhsAdvertise]详情")
def zhs_advertise_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_advertise` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_advertise_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/advertise", summary="[ZhsAdvertise]新增")
def zhs_advertise_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_advertise` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_advertise_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/advertise", summary="[ZhsAdvertise]修改")
def zhs_advertise_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_advertise` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_advertise_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/advertise/{ids}", summary="[ZhsAdvertise]删除(支持批量)")
def zhs_advertise_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_advertise` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_advertise_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsAgentBuyController - /agentBuy (表 zhs_agent_buy)
# ===========================================================================

@router.get("/agentBuy/list", summary="[ZhsAgentBuy]列表")
def zhs_agent_buy_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_agent_buy`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_agent_buy` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_agent_buy_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentBuy/export", summary="[ZhsAgentBuy]导出", include_in_schema=False)
def zhs_agent_buy_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentBuy/{item_id}", summary="[ZhsAgentBuy]详情")
def zhs_agent_buy_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_agent_buy` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_agent_buy_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentBuy", summary="[ZhsAgentBuy]新增")
def zhs_agent_buy_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_agent_buy` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentBuy", summary="[ZhsAgentBuy]修改")
def zhs_agent_buy_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_agent_buy` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentBuy/{ids}", summary="[ZhsAgentBuy]删除(支持批量)")
def zhs_agent_buy_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_agent_buy` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsAgentSettlementController - /agentSettlement (表 zhs_agent_settlement)
# ===========================================================================

@router.get("/agentSettlement/list", summary="[ZhsAgentSettlement]列表")
def zhs_agent_settlement_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_agent_settlement`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_agent_settlement` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_agent_settlement_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentSettlement/export", summary="[ZhsAgentSettlement]导出", include_in_schema=False)
def zhs_agent_settlement_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentSettlement/{item_id}", summary="[ZhsAgentSettlement]详情")
def zhs_agent_settlement_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_agent_settlement` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_agent_settlement_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentSettlement", summary="[ZhsAgentSettlement]新增")
def zhs_agent_settlement_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_agent_settlement` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_settlement_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentSettlement", summary="[ZhsAgentSettlement]修改")
def zhs_agent_settlement_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_agent_settlement` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_settlement_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentSettlement/{ids}", summary="[ZhsAgentSettlement]删除(支持批量)")
def zhs_agent_settlement_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_agent_settlement` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_settlement_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsAgentUsedetailController - /agentUseDetail (表 zhs_agent_use_detail)
# ===========================================================================

@router.get("/agentUseDetail/list", summary="[ZhsAgentUsedetail]列表")
def zhs_agent_usedetail_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_agent_use_detail`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_agent_use_detail` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_agent_usedetail_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentUseDetail/export", summary="[ZhsAgentUsedetail]导出", include_in_schema=False)
def zhs_agent_usedetail_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentUseDetail/{item_id}", summary="[ZhsAgentUsedetail]详情")
def zhs_agent_usedetail_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_agent_use_detail` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_agent_usedetail_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentUseDetail", summary="[ZhsAgentUsedetail]新增")
def zhs_agent_usedetail_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_agent_use_detail` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_usedetail_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentUseDetail", summary="[ZhsAgentUsedetail]修改")
def zhs_agent_usedetail_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_agent_use_detail` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_usedetail_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentUseDetail/{ids}", summary="[ZhsAgentUsedetail]删除(支持批量)")
def zhs_agent_usedetail_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_agent_use_detail` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_usedetail_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsAgentWithdrawalDetailController - /agentWithdrawalDetail (表 zhs_agent_withdrawal_detail)
# ===========================================================================

@router.get("/agentWithdrawalDetail/list", summary="[ZhsAgentWithdrawalDetail]列表")
def zhs_agent_withdrawal_detail_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_agent_withdrawal_detail`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_agent_withdrawal_detail` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_agent_withdrawal_detail_list failed: %s", e)
        return _table_data([], 0)


@router.get("/agentWithdrawalDetail/export", summary="[ZhsAgentWithdrawalDetail]导出", include_in_schema=False)
def zhs_agent_withdrawal_detail_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/agentWithdrawalDetail/{item_id}", summary="[ZhsAgentWithdrawalDetail]详情")
def zhs_agent_withdrawal_detail_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_agent_withdrawal_detail` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_agent_withdrawal_detail_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/agentWithdrawalDetail", summary="[ZhsAgentWithdrawalDetail]新增")
def zhs_agent_withdrawal_detail_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_agent_withdrawal_detail` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_withdrawal_detail_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/agentWithdrawalDetail", summary="[ZhsAgentWithdrawalDetail]修改")
def zhs_agent_withdrawal_detail_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_agent_withdrawal_detail` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_withdrawal_detail_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/agentWithdrawalDetail/{ids}", summary="[ZhsAgentWithdrawalDetail]删除(支持批量)")
def zhs_agent_withdrawal_detail_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_agent_withdrawal_detail` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_withdrawal_detail_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsBannerCarouselController - /carousel (表 zhs_banner_carousel)
# ===========================================================================

@router.get("/carousel/list", summary="[ZhsBannerCarousel]列表")
def zhs_banner_carousel_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_banner_carousel`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_banner_carousel` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_banner_carousel_list failed: %s", e)
        return _table_data([], 0)


@router.get("/carousel/export", summary="[ZhsBannerCarousel]导出", include_in_schema=False)
def zhs_banner_carousel_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/carousel/{item_id}", summary="[ZhsBannerCarousel]详情")
def zhs_banner_carousel_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_banner_carousel` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_banner_carousel_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/carousel", summary="[ZhsBannerCarousel]新增")
def zhs_banner_carousel_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_banner_carousel` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_banner_carousel_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/carousel", summary="[ZhsBannerCarousel]修改")
def zhs_banner_carousel_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_banner_carousel` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_banner_carousel_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/carousel/{ids}", summary="[ZhsBannerCarousel]删除(支持批量)")
def zhs_banner_carousel_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_banner_carousel` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_banner_carousel_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsDeveloperController - /developer (表 zhs_developer)
# ===========================================================================

@router.get("/developer/list", summary="[ZhsDeveloper]列表")
def zhs_developer_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_developer`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_developer` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_developer_list failed: %s", e)
        return _table_data([], 0)


@router.get("/developer/export", summary="[ZhsDeveloper]导出", include_in_schema=False)
def zhs_developer_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/developer/{item_id}", summary="[ZhsDeveloper]详情")
def zhs_developer_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_developer` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_developer_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/developer", summary="[ZhsDeveloper]新增")
def zhs_developer_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_developer` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/developer", summary="[ZhsDeveloper]修改")
def zhs_developer_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_developer` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/developer/{ids}", summary="[ZhsDeveloper]删除(支持批量)")
def zhs_developer_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_developer` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsDeveloperFundLogsController - /developerFundLogs (表 zhs_developer_fund_logs)
# ===========================================================================

@router.get("/developerFundLogs/list", summary="[ZhsDeveloperFundLogs]列表")
def zhs_developer_fund_logs_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_developer_fund_logs`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_developer_fund_logs` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_developer_fund_logs_list failed: %s", e)
        return _table_data([], 0)


@router.get("/developerFundLogs/export", summary="[ZhsDeveloperFundLogs]导出", include_in_schema=False)
def zhs_developer_fund_logs_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/developerFundLogs/{item_id}", summary="[ZhsDeveloperFundLogs]详情")
def zhs_developer_fund_logs_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_developer_fund_logs` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_developer_fund_logs_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/developerFundLogs", summary="[ZhsDeveloperFundLogs]新增")
def zhs_developer_fund_logs_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_developer_fund_logs` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_fund_logs_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/developerFundLogs", summary="[ZhsDeveloperFundLogs]修改")
def zhs_developer_fund_logs_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_developer_fund_logs` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_fund_logs_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/developerFundLogs/{ids}", summary="[ZhsDeveloperFundLogs]删除(支持批量)")
def zhs_developer_fund_logs_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_developer_fund_logs` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_fund_logs_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsDeveloperLinkController - /developerLink (表 zhs_developer_link)
# ===========================================================================

@router.get("/developerLink/list", summary="[ZhsDeveloperLink]列表")
def zhs_developer_link_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_developer_link`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_developer_link` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_developer_link_list failed: %s", e)
        return _table_data([], 0)


@router.get("/developerLink/export", summary="[ZhsDeveloperLink]导出", include_in_schema=False)
def zhs_developer_link_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/developerLink/{item_id}", summary="[ZhsDeveloperLink]详情")
def zhs_developer_link_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_developer_link` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_developer_link_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/developerLink", summary="[ZhsDeveloperLink]新增")
def zhs_developer_link_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_developer_link` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_link_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/developerLink", summary="[ZhsDeveloperLink]修改")
def zhs_developer_link_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_developer_link` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_link_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/developerLink/{ids}", summary="[ZhsDeveloperLink]删除(支持批量)")
def zhs_developer_link_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_developer_link` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_developer_link_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsDictionaryController - /dictionary (表 zhs_dictionary)
# ===========================================================================

@router.get("/dictionary/list", summary="[ZhsDictionary]列表")
def zhs_dictionary_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_dictionary`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_dictionary` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_dictionary_list failed: %s", e)
        return _table_data([], 0)


@router.get("/dictionary/export", summary="[ZhsDictionary]导出", include_in_schema=False)
def zhs_dictionary_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/dictionary/{item_id}", summary="[ZhsDictionary]详情")
def zhs_dictionary_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_dictionary` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_dictionary_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/dictionary", summary="[ZhsDictionary]新增")
def zhs_dictionary_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_dictionary` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_dictionary_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/dictionary", summary="[ZhsDictionary]修改")
def zhs_dictionary_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_dictionary` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_dictionary_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/dictionary/{ids}", summary="[ZhsDictionary]删除(支持批量)")
def zhs_dictionary_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_dictionary` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_dictionary_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsPopularCoursesController - /courses (表 zhs_popular_courses)
# ===========================================================================

@router.get("/courses/list", summary="[ZhsPopularCourses]列表")
def zhs_popular_courses_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_popular_courses`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_popular_courses` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_popular_courses_list failed: %s", e)
        return _table_data([], 0)


@router.get("/courses/export", summary="[ZhsPopularCourses]导出", include_in_schema=False)
def zhs_popular_courses_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/courses/{item_id}", summary="[ZhsPopularCourses]详情")
def zhs_popular_courses_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_popular_courses` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_popular_courses_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/courses", summary="[ZhsPopularCourses]新增")
def zhs_popular_courses_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_popular_courses` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_popular_courses_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/courses", summary="[ZhsPopularCourses]修改")
def zhs_popular_courses_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_popular_courses` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_popular_courses_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/courses/{ids}", summary="[ZhsPopularCourses]删除(支持批量)")
def zhs_popular_courses_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_popular_courses` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_popular_courses_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsOrderController - /order (表 zhs_order)
# ===========================================================================

@router.get("/order/list", summary="[ZhsOrder]列表")
def zhs_order_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_order`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_order` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_order_list failed: %s", e)
        return _table_data([], 0)


@router.get("/order/export", summary="[ZhsOrder]导出", include_in_schema=False)
def zhs_order_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/order/{item_id}", summary="[ZhsOrder]详情")
def zhs_order_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_order` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_order_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/order", summary="[ZhsOrder]新增")
def zhs_order_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_order` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_order_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/order", summary="[ZhsOrder]修改")
def zhs_order_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_order` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_order_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/order/{ids}", summary="[ZhsOrder]删除(支持批量)")
def zhs_order_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_order` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_order_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsProductController - /zhs_product (表 zhs_product)
# ===========================================================================

@router.get("/zhs_product/list", summary="[ZhsProduct]列表")
def zhs_product_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_product`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_product` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_product_list failed: %s", e)
        return _table_data([], 0)


@router.get("/zhs_product/export", summary="[ZhsProduct]导出", include_in_schema=False)
def zhs_product_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/zhs_product/{item_id}", summary="[ZhsProduct]详情")
def zhs_product_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_product` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_product_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/zhs_product", summary="[ZhsProduct]新增")
def zhs_product_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_product` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_product_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/zhs_product", summary="[ZhsProduct]修改")
def zhs_product_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_product` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_product_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/zhs_product/{ids}", summary="[ZhsProduct]删除(支持批量)")
def zhs_product_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_product` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_product_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsUserAgentContextController - /userAgentContext (表 zhs_user_agent_context)
# ===========================================================================

@router.get("/userAgentContext/list", summary="[ZhsUserAgentContext]列表")
def zhs_user_agent_context_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_user_agent_context`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_user_agent_context` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_user_agent_context_list failed: %s", e)
        return _table_data([], 0)


@router.get("/userAgentContext/export", summary="[ZhsUserAgentContext]导出", include_in_schema=False)
def zhs_user_agent_context_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/userAgentContext/{item_id}", summary="[ZhsUserAgentContext]详情")
def zhs_user_agent_context_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_user_agent_context` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_user_agent_context_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/userAgentContext", summary="[ZhsUserAgentContext]新增")
def zhs_user_agent_context_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_user_agent_context` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_context_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/userAgentContext", summary="[ZhsUserAgentContext]修改")
def zhs_user_agent_context_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_user_agent_context` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_context_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/userAgentContext/{ids}", summary="[ZhsUserAgentContext]删除(支持批量)")
def zhs_user_agent_context_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_user_agent_context` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_context_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsUserAgentImageController - /userAgentImage (表 zhs_user_agent_image)
# ===========================================================================

@router.get("/userAgentImage/list", summary="[ZhsUserAgentImage]列表")
def zhs_user_agent_image_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_user_agent_image`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_user_agent_image` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_user_agent_image_list failed: %s", e)
        return _table_data([], 0)


@router.get("/userAgentImage/export", summary="[ZhsUserAgentImage]导出", include_in_schema=False)
def zhs_user_agent_image_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/userAgentImage/{item_id}", summary="[ZhsUserAgentImage]详情")
def zhs_user_agent_image_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_user_agent_image` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_user_agent_image_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/userAgentImage", summary="[ZhsUserAgentImage]新增")
def zhs_user_agent_image_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_user_agent_image` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_image_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/userAgentImage", summary="[ZhsUserAgentImage]修改")
def zhs_user_agent_image_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_user_agent_image` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_image_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/userAgentImage/{ids}", summary="[ZhsUserAgentImage]删除(支持批量)")
def zhs_user_agent_image_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_user_agent_image` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_agent_image_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsUserController - /zhs_user (表 zhs_user)
# ===========================================================================

@router.get("/zhs_user/list", summary="[ZhsUser]列表")
def zhs_user_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_user`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_user` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_user_list failed: %s", e)
        return _table_data([], 0)


@router.get("/zhs_user/export", summary="[ZhsUser]导出", include_in_schema=False)
def zhs_user_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/zhs_user/{item_id}", summary="[ZhsUser]详情")
def zhs_user_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_user` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_user_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/zhs_user", summary="[ZhsUser]新增")
def zhs_user_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_user` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/zhs_user", summary="[ZhsUser]修改")
def zhs_user_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_user` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/zhs_user/{ids}", summary="[ZhsUser]删除(支持批量)")
def zhs_user_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_user` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsUserVipController - /user_vip (表 zhs_user_vip)
# ===========================================================================

@router.get("/user_vip/list", summary="[ZhsUserVip]列表")
def zhs_user_vip_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_user_vip`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_user_vip` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_user_vip_list failed: %s", e)
        return _table_data([], 0)


@router.get("/user_vip/export", summary="[ZhsUserVip]导出", include_in_schema=False)
def zhs_user_vip_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/user_vip/{item_id}", summary="[ZhsUserVip]详情")
def zhs_user_vip_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_user_vip` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_user_vip_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/user_vip", summary="[ZhsUserVip]新增")
def zhs_user_vip_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_user_vip` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_vip_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/user_vip", summary="[ZhsUserVip]修改")
def zhs_user_vip_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_user_vip` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_vip_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/user_vip/{ids}", summary="[ZhsUserVip]删除(支持批量)")
def zhs_user_vip_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_user_vip` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_vip_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsVipLevelController - /vip_level (表 zhs_vip_level)
# ===========================================================================

@router.get("/vip_level/list", summary="[ZhsVipLevel]列表")
def zhs_vip_level_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_vip_level`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_vip_level` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_vip_level_list failed: %s", e)
        return _table_data([], 0)


@router.get("/vip_level/export", summary="[ZhsVipLevel]导出", include_in_schema=False)
def zhs_vip_level_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/vip_level/{item_id}", summary="[ZhsVipLevel]详情")
def zhs_vip_level_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_vip_level` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_vip_level_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/vip_level", summary="[ZhsVipLevel]新增")
def zhs_vip_level_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_vip_level` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_vip_level_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/vip_level", summary="[ZhsVipLevel]修改")
def zhs_vip_level_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_vip_level` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_vip_level_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/vip_level/{ids}", summary="[ZhsVipLevel]删除(支持批量)")
def zhs_vip_level_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_vip_level` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_vip_level_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsWithdrawalFlowController - /withdrawal_flow (表 zhs_withdrawal_flow)
# ===========================================================================

@router.get("/withdrawal_flow/list", summary="[ZhsWithdrawalFlow]列表")
def zhs_withdrawal_flow_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_withdrawal_flow`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_withdrawal_flow` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_withdrawal_flow_list failed: %s", e)
        return _table_data([], 0)


@router.get("/withdrawal_flow/export", summary="[ZhsWithdrawalFlow]导出", include_in_schema=False)
def zhs_withdrawal_flow_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/withdrawal_flow/{item_id}", summary="[ZhsWithdrawalFlow]详情")
def zhs_withdrawal_flow_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_withdrawal_flow` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_withdrawal_flow_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/withdrawal_flow", summary="[ZhsWithdrawalFlow]新增")
def zhs_withdrawal_flow_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_withdrawal_flow` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_withdrawal_flow_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/withdrawal_flow", summary="[ZhsWithdrawalFlow]修改")
def zhs_withdrawal_flow_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_withdrawal_flow` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_withdrawal_flow_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/withdrawal_flow/{ids}", summary="[ZhsWithdrawalFlow]删除(支持批量)")
def zhs_withdrawal_flow_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_withdrawal_flow` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_withdrawal_flow_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsCourseAuditController - /courseAudit (表 zhs_course_audit)
# ===========================================================================

@router.get("/courseAudit/list", summary="[ZhsCourseAudit]列表")
def zhs_course_audit_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_course_audit`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_course_audit` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_course_audit_list failed: %s", e)
        return _table_data([], 0)


@router.get("/courseAudit/export", summary="[ZhsCourseAudit]导出", include_in_schema=False)
def zhs_course_audit_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/courseAudit/{item_id}", summary="[ZhsCourseAudit]详情")
def zhs_course_audit_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_course_audit` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_course_audit_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/courseAudit", summary="[ZhsCourseAudit]新增")
def zhs_course_audit_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_course_audit` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_audit_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/courseAudit", summary="[ZhsCourseAudit]修改")
def zhs_course_audit_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_course_audit` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_audit_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/courseAudit/{ids}", summary="[ZhsCourseAudit]删除(支持批量)")
def zhs_course_audit_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_course_audit` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_audit_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsCoursePayController - /coursePay (表 zhs_course_pay)
# ===========================================================================

@router.get("/coursePay/list", summary="[ZhsCoursePay]列表")
def zhs_course_pay_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_course_pay`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_course_pay` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_course_pay_list failed: %s", e)
        return _table_data([], 0)


@router.get("/coursePay/export", summary="[ZhsCoursePay]导出", include_in_schema=False)
def zhs_course_pay_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/coursePay/{item_id}", summary="[ZhsCoursePay]详情")
def zhs_course_pay_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_course_pay` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_course_pay_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/coursePay", summary="[ZhsCoursePay]新增")
def zhs_course_pay_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_course_pay` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/coursePay", summary="[ZhsCoursePay]修改")
def zhs_course_pay_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_course_pay` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/coursePay/{ids}", summary="[ZhsCoursePay]删除(支持批量)")
def zhs_course_pay_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_course_pay` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsCoursePayLogController - /coursePayLog (表 zhs_course_pay_log)
# ===========================================================================

@router.get("/coursePayLog/list", summary="[ZhsCoursePayLog]列表")
def zhs_course_pay_log_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_course_pay_log`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_course_pay_log` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_course_pay_log_list failed: %s", e)
        return _table_data([], 0)


@router.get("/coursePayLog/export", summary="[ZhsCoursePayLog]导出", include_in_schema=False)
def zhs_course_pay_log_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/coursePayLog/{item_id}", summary="[ZhsCoursePayLog]详情")
def zhs_course_pay_log_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_course_pay_log` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_course_pay_log_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/coursePayLog", summary="[ZhsCoursePayLog]新增")
def zhs_course_pay_log_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_course_pay_log` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_log_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/coursePayLog", summary="[ZhsCoursePayLog]修改")
def zhs_course_pay_log_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_course_pay_log` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_log_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/coursePayLog/{ids}", summary="[ZhsCoursePayLog]删除(支持批量)")
def zhs_course_pay_log_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_course_pay_log` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_pay_log_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsCourseTempController - /courseTemp (表 zhs_course_temp)
# ===========================================================================

@router.get("/courseTemp/list", summary="[ZhsCourseTemp]列表")
def zhs_course_temp_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_course_temp`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_course_temp` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_course_temp_list failed: %s", e)
        return _table_data([], 0)


@router.get("/courseTemp/export", summary="[ZhsCourseTemp]导出", include_in_schema=False)
def zhs_course_temp_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/courseTemp/{item_id}", summary="[ZhsCourseTemp]详情")
def zhs_course_temp_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_course_temp` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_course_temp_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/courseTemp", summary="[ZhsCourseTemp]新增")
def zhs_course_temp_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_course_temp` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_temp_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/courseTemp", summary="[ZhsCourseTemp]修改")
def zhs_course_temp_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_course_temp` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_temp_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/courseTemp/{ids}", summary="[ZhsCourseTemp]删除(支持批量)")
def zhs_course_temp_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_course_temp` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_temp_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsCourseVideoTempController - /courseVideoTemp (表 zhs_course_video_temp)
# ===========================================================================

@router.get("/courseVideoTemp/list", summary="[ZhsCourseVideoTemp]列表")
def zhs_course_video_temp_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_course_video_temp`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_course_video_temp` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_course_video_temp_list failed: %s", e)
        return _table_data([], 0)


@router.get("/courseVideoTemp/export", summary="[ZhsCourseVideoTemp]导出", include_in_schema=False)
def zhs_course_video_temp_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/courseVideoTemp/{item_id}", summary="[ZhsCourseVideoTemp]详情")
def zhs_course_video_temp_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_course_video_temp` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_course_video_temp_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/courseVideoTemp", summary="[ZhsCourseVideoTemp]新增")
def zhs_course_video_temp_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_course_video_temp` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_video_temp_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/courseVideoTemp", summary="[ZhsCourseVideoTemp]修改")
def zhs_course_video_temp_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_course_video_temp` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_video_temp_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/courseVideoTemp/{ids}", summary="[ZhsCourseVideoTemp]删除(支持批量)")
def zhs_course_video_temp_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_course_video_temp` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_course_video_temp_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsIdentityController - /zhsIdentity (表 zhs_identity)
# ===========================================================================

@router.get("/zhsIdentity/list", summary="[ZhsIdentity]列表")
def zhs_identity_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_identity`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_identity` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_identity_list failed: %s", e)
        return _table_data([], 0)


@router.get("/zhsIdentity/export", summary="[ZhsIdentity]导出", include_in_schema=False)
def zhs_identity_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/zhsIdentity/{item_id}", summary="[ZhsIdentity]详情")
def zhs_identity_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_identity` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_identity_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/zhsIdentity", summary="[ZhsIdentity]新增")
def zhs_identity_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_identity` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_identity_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/zhsIdentity", summary="[ZhsIdentity]修改")
def zhs_identity_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_identity` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_identity_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/zhsIdentity/{ids}", summary="[ZhsIdentity]删除(支持批量)")
def zhs_identity_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_identity` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_identity_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsOrganizationController - /organization (表 zhs_organization)
# ===========================================================================

@router.get("/organization/list", summary="[ZhsOrganization]列表")
def zhs_organization_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_organization`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_organization` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_organization_list failed: %s", e)
        return _table_data([], 0)


@router.get("/organization/export", summary="[ZhsOrganization]导出", include_in_schema=False)
def zhs_organization_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/organization/{item_id}", summary="[ZhsOrganization]详情")
def zhs_organization_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_organization` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_organization_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/organization", summary="[ZhsOrganization]新增")
def zhs_organization_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_organization` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_organization_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/organization", summary="[ZhsOrganization]修改")
def zhs_organization_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_organization` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_organization_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/organization/{ids}", summary="[ZhsOrganization]删除(支持批量)")
def zhs_organization_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_organization` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_organization_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# ZhsUserSysLinkController - /userSysLink (表 zhs_user_sys_link)
# ===========================================================================

@router.get("/userSysLink/list", summary="[ZhsUserSysLink]列表")
def zhs_user_sys_link_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `zhs_user_sys_link`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `zhs_user_sys_link` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("zhs_user_sys_link_list failed: %s", e)
        return _table_data([], 0)


@router.get("/userSysLink/export", summary="[ZhsUserSysLink]导出", include_in_schema=False)
def zhs_user_sys_link_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/userSysLink/{item_id}", summary="[ZhsUserSysLink]详情")
def zhs_user_sys_link_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `zhs_user_sys_link` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("zhs_user_sys_link_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/userSysLink", summary="[ZhsUserSysLink]新增")
def zhs_user_sys_link_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `zhs_user_sys_link` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_sys_link_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/userSysLink", summary="[ZhsUserSysLink]修改")
def zhs_user_sys_link_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `zhs_user_sys_link` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_sys_link_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/userSysLink/{ids}", summary="[ZhsUserSysLink]删除(支持批量)")
def zhs_user_sys_link_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `zhs_user_sys_link` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("zhs_user_sys_link_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UsersController - /users (表 users)
# ===========================================================================

@router.get("/users/list", summary="[Users]列表")
def users_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `users`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `users` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("users_list failed: %s", e)
        return _table_data([], 0)


@router.get("/users/export", summary="[Users]导出", include_in_schema=False)
def users_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/users/{item_id}", summary="[Users]详情")
def users_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `users` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("users_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/users", summary="[Users]新增")
def users_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `users` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("users_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/users", summary="[Users]修改")
def users_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `users` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("users_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/users/{ids}", summary="[Users]删除(支持批量)")
def users_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `users` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("users_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserThirdPartyAccountsController - /auth_accounts (表 user_third_party_accounts)
# ===========================================================================

@router.get("/auth_accounts/list", summary="[UserThirdPartyAccounts]列表")
def user_third_party_accounts_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_third_party_accounts`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_third_party_accounts` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_third_party_accounts_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_accounts/export", summary="[UserThirdPartyAccounts]导出", include_in_schema=False)
def user_third_party_accounts_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_accounts/{item_id}", summary="[UserThirdPartyAccounts]详情")
def user_third_party_accounts_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_third_party_accounts` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_third_party_accounts_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_accounts", summary="[UserThirdPartyAccounts]新增")
def user_third_party_accounts_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_third_party_accounts` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_third_party_accounts_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_accounts", summary="[UserThirdPartyAccounts]修改")
def user_third_party_accounts_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_third_party_accounts` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_third_party_accounts_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_accounts/{ids}", summary="[UserThirdPartyAccounts]删除(支持批量)")
def user_third_party_accounts_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_third_party_accounts` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_third_party_accounts_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserAuthInfoController - /auth_info (表 user_auth_info)
# ===========================================================================

@router.get("/auth_info/list", summary="[UserAuthInfo]列表")
def user_auth_info_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_auth_info`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_auth_info` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_auth_info_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_info/export", summary="[UserAuthInfo]导出", include_in_schema=False)
def user_auth_info_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_info/{item_id}", summary="[UserAuthInfo]详情")
def user_auth_info_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_auth_info` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_auth_info_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_info", summary="[UserAuthInfo]新增")
def user_auth_info_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_auth_info` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_auth_info_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_info", summary="[UserAuthInfo]修改")
def user_auth_info_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_auth_info` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_auth_info_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_info/{ids}", summary="[UserAuthInfo]删除(支持批量)")
def user_auth_info_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_auth_info` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_auth_info_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserFundInfoController - /auth_find_info (表 user_fund_info)
# ===========================================================================

@router.get("/auth_find_info/list", summary="[UserFundInfo]列表")
def user_fund_info_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_fund_info`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_fund_info` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_fund_info_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_find_info/export", summary="[UserFundInfo]导出", include_in_schema=False)
def user_fund_info_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_find_info/{item_id}", summary="[UserFundInfo]详情")
def user_fund_info_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_fund_info` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_fund_info_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_find_info", summary="[UserFundInfo]新增")
def user_fund_info_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_fund_info` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_fund_info_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_find_info", summary="[UserFundInfo]修改")
def user_fund_info_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_fund_info` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_fund_info_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_find_info/{ids}", summary="[UserFundInfo]删除(支持批量)")
def user_fund_info_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_fund_info` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_fund_info_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserLoginLogsController - /login_logs (表 user_login_logs)
# ===========================================================================

@router.get("/login_logs/list", summary="[UserLoginLogs]列表")
def user_login_logs_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_login_logs`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_login_logs` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_login_logs_list failed: %s", e)
        return _table_data([], 0)


@router.get("/login_logs/export", summary="[UserLoginLogs]导出", include_in_schema=False)
def user_login_logs_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/login_logs/{item_id}", summary="[UserLoginLogs]详情")
def user_login_logs_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_login_logs` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_login_logs_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/login_logs", summary="[UserLoginLogs]新增")
def user_login_logs_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_login_logs` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_login_logs_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/login_logs", summary="[UserLoginLogs]修改")
def user_login_logs_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_login_logs` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_login_logs_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/login_logs/{ids}", summary="[UserLoginLogs]删除(支持批量)")
def user_login_logs_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_login_logs` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_login_logs_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserMarginController - /AuthuserMargin (表 user_margin)
# ===========================================================================

@router.get("/AuthuserMargin/list", summary="[UserMargin]列表")
def user_margin_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_margin`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_margin` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_margin_list failed: %s", e)
        return _table_data([], 0)


@router.get("/AuthuserMargin/export", summary="[UserMargin]导出", include_in_schema=False)
def user_margin_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/AuthuserMargin/{item_id}", summary="[UserMargin]详情")
def user_margin_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_margin` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_margin_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/AuthuserMargin", summary="[UserMargin]新增")
def user_margin_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_margin` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_margin_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/AuthuserMargin", summary="[UserMargin]修改")
def user_margin_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_margin` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_margin_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/AuthuserMargin/{ids}", summary="[UserMargin]删除(支持批量)")
def user_margin_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_margin` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_margin_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserTokensController - /auth_tokens (表 user_tokens)
# ===========================================================================

@router.get("/auth_tokens/list", summary="[UserTokens]列表")
def user_tokens_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_tokens`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_tokens` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_tokens_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_tokens/export", summary="[UserTokens]导出", include_in_schema=False)
def user_tokens_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_tokens/{item_id}", summary="[UserTokens]详情")
def user_tokens_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_tokens` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_tokens_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_tokens", summary="[UserTokens]新增")
def user_tokens_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_tokens` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_tokens_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_tokens", summary="[UserTokens]修改")
def user_tokens_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_tokens` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_tokens_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_tokens/{ids}", summary="[UserTokens]删除(支持批量)")
def user_tokens_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_tokens` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_tokens_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# UserVipController - /auth_user_vip (表 user_vip)
# ===========================================================================

@router.get("/auth_user_vip/list", summary="[UserVip]列表")
def user_vip_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `user_vip`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `user_vip` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("user_vip_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_user_vip/export", summary="[UserVip]导出", include_in_schema=False)
def user_vip_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_user_vip/{item_id}", summary="[UserVip]详情")
def user_vip_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `user_vip` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_vip_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_user_vip", summary="[UserVip]新增")
def user_vip_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `user_vip` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_vip_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_user_vip", summary="[UserVip]修改")
def user_vip_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `user_vip` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_vip_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_user_vip/{ids}", summary="[UserVip]删除(支持批量)")
def user_vip_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `user_vip` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_vip_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# VipLevelController - /auth_vip_level (表 vip_level)
# ===========================================================================

@router.get("/auth_vip_level/list", summary="[VipLevel]列表")
def vip_level_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `vip_level`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `vip_level` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("vip_level_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_vip_level/export", summary="[VipLevel]导出", include_in_schema=False)
def vip_level_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_vip_level/{item_id}", summary="[VipLevel]详情")
def vip_level_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `vip_level` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("vip_level_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_vip_level", summary="[VipLevel]新增")
def vip_level_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `vip_level` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("vip_level_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_vip_level", summary="[VipLevel]修改")
def vip_level_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `vip_level` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("vip_level_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_vip_level/{ids}", summary="[VipLevel]删除(支持批量)")
def vip_level_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `vip_level` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("vip_level_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# SmsTempController - /auth_sms_temp (表 sms_temp)
# ===========================================================================

@router.get("/auth_sms_temp/list", summary="[SmsTemp]列表")
def sms_temp_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `sms_temp`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `sms_temp` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("sms_temp_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_sms_temp/export", summary="[SmsTemp]导出", include_in_schema=False)
def sms_temp_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_sms_temp/{item_id}", summary="[SmsTemp]详情")
def sms_temp_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `sms_temp` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("sms_temp_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_sms_temp", summary="[SmsTemp]新增")
def sms_temp_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `sms_temp` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("sms_temp_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_sms_temp", summary="[SmsTemp]修改")
def sms_temp_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `sms_temp` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sms_temp_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_sms_temp/{ids}", summary="[SmsTemp]删除(支持批量)")
def sms_temp_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `sms_temp` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sms_temp_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# VerificationCodesController - /auth_veri_codes (表 verification_codes)
# ===========================================================================

@router.get("/auth_veri_codes/list", summary="[VerificationCodes]列表")
def verification_codes_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `verification_codes`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `verification_codes` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("verification_codes_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth_veri_codes/export", summary="[VerificationCodes]导出", include_in_schema=False)
def verification_codes_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth_veri_codes/{item_id}", summary="[VerificationCodes]详情")
def verification_codes_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `verification_codes` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("verification_codes_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth_veri_codes", summary="[VerificationCodes]新增")
def verification_codes_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `verification_codes` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("verification_codes_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth_veri_codes", summary="[VerificationCodes]修改")
def verification_codes_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `verification_codes` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("verification_codes_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth_veri_codes/{ids}", summary="[VerificationCodes]删除(支持批量)")
def verification_codes_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `verification_codes` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("verification_codes_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# FundController - /fund (表 fund)
# ===========================================================================

@router.get("/fund/list", summary="[Fund]列表")
def fund_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `fund`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `fund` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("fund_list failed: %s", e)
        return _table_data([], 0)


@router.get("/fund/export", summary="[Fund]导出", include_in_schema=False)
def fund_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/fund/{item_id}", summary="[Fund]详情")
def fund_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `fund` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("fund_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/fund", summary="[Fund]新增")
def fund_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `fund` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("fund_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/fund", summary="[Fund]修改")
def fund_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `fund` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("fund_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/fund/{ids}", summary="[Fund]删除(支持批量)")
def fund_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `fund` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("fund_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AuthIdentityController - /auth (表 auth_identity)
# ===========================================================================

@router.get("/auth/list", summary="[AuthIdentity]列表")
def auth_identity_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `auth_identity`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `auth_identity` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("auth_identity_list failed: %s", e)
        return _table_data([], 0)


@router.get("/auth/export", summary="[AuthIdentity]导出", include_in_schema=False)
def auth_identity_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/auth/{item_id}", summary="[AuthIdentity]详情")
def auth_identity_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `auth_identity` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("auth_identity_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/auth", summary="[AuthIdentity]新增")
def auth_identity_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `auth_identity` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("auth_identity_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/auth", summary="[AuthIdentity]修改")
def auth_identity_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `auth_identity` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("auth_identity_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/auth/{ids}", summary="[AuthIdentity]删除(支持批量)")
def auth_identity_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `auth_identity` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("auth_identity_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AiGcController - /ai_gc (表 ai_gc)
# ===========================================================================

@router.get("/ai_gc/list", summary="[AiGc]列表")
def ai_gc_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ai_gc`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ai_gc` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ai_gc_list failed: %s", e)
        return _table_data([], 0)


@router.get("/ai_gc/export", summary="[AiGc]导出", include_in_schema=False)
def ai_gc_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/ai_gc/{item_id}", summary="[AiGc]详情")
def ai_gc_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ai_gc` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ai_gc_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/ai_gc", summary="[AiGc]新增")
def ai_gc_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ai_gc` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ai_gc_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/ai_gc", summary="[AiGc]修改")
def ai_gc_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ai_gc` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_gc_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/ai_gc/{ids}", summary="[AiGc]删除(支持批量)")
def ai_gc_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ai_gc` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_gc_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# RankingController - /ranking (表 ranking)
# ===========================================================================

@router.get("/ranking/list", summary="[Ranking]列表")
def ranking_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ranking`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ranking` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ranking_list failed: %s", e)
        return _table_data([], 0)


@router.get("/ranking/export", summary="[Ranking]导出", include_in_schema=False)
def ranking_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/ranking/{item_id}", summary="[Ranking]详情")
def ranking_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ranking` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ranking_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/ranking", summary="[Ranking]新增")
def ranking_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ranking` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ranking_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/ranking", summary="[Ranking]修改")
def ranking_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ranking` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ranking_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/ranking/{ids}", summary="[Ranking]删除(支持批量)")
def ranking_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ranking` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ranking_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# SysJobController - /job (表 sys_job)
# ===========================================================================

@router.get("/job/list", summary="[SysJob]列表")
def sys_job_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `sys_job`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `sys_job` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("sys_job_list failed: %s", e)
        return _table_data([], 0)


@router.get("/job/export", summary="[SysJob]导出", include_in_schema=False)
def sys_job_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/job/{item_id}", summary="[SysJob]详情")
def sys_job_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `sys_job` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("sys_job_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/job", summary="[SysJob]新增")
def sys_job_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `sys_job` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/job", summary="[SysJob]修改")
def sys_job_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `sys_job` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/job/{ids}", summary="[SysJob]删除(支持批量)")
def sys_job_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `sys_job` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("sys_job_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# GoogleAuthenticationController - /google (表 google_auth)
# ===========================================================================

@router.get("/google/list", summary="[GoogleAuthentication]列表")
def google_authentication_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `google_auth`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `google_auth` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("google_authentication_list failed: %s", e)
        return _table_data([], 0)


@router.get("/google/export", summary="[GoogleAuthentication]导出", include_in_schema=False)
def google_authentication_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/google/{item_id}", summary="[GoogleAuthentication]详情")
def google_authentication_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `google_auth` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("google_authentication_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/google", summary="[GoogleAuthentication]新增")
def google_authentication_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `google_auth` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("google_authentication_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/google", summary="[GoogleAuthentication]修改")
def google_authentication_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `google_auth` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("google_authentication_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/google/{ids}", summary="[GoogleAuthentication]删除(支持批量)")
def google_authentication_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `google_auth` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("google_authentication_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AiNewsController - /news (表 ai_news)
# ===========================================================================

@router.get("/news/list", summary="[AiNews]列表")
def ai_news_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ai_news`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ai_news` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ai_news_list failed: %s", e)
        return _table_data([], 0)


@router.get("/news/export", summary="[AiNews]导出", include_in_schema=False)
def ai_news_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/news/{item_id}", summary="[AiNews]详情")
def ai_news_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ai_news` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ai_news_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/news", summary="[AiNews]新增")
def ai_news_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ai_news` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ai_news_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/news", summary="[AiNews]修改")
def ai_news_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ai_news` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_news_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/news/{ids}", summary="[AiNews]删除(支持批量)")
def ai_news_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ai_news` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_news_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AiContactController - /contact (表 ai_contact)
# ===========================================================================

@router.get("/contact/list", summary="[AiContact]列表")
def ai_contact_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ai_contact`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ai_contact` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ai_contact_list failed: %s", e)
        return _table_data([], 0)


@router.get("/contact/export", summary="[AiContact]导出", include_in_schema=False)
def ai_contact_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/contact/{item_id}", summary="[AiContact]详情")
def ai_contact_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ai_contact` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ai_contact_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/contact", summary="[AiContact]新增")
def ai_contact_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ai_contact` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ai_contact_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/contact", summary="[AiContact]修改")
def ai_contact_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ai_contact` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_contact_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/contact/{ids}", summary="[AiContact]删除(支持批量)")
def ai_contact_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ai_contact` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_contact_remove failed: %s", e)
        return _ajax(False, str(e))

# ===========================================================================
# AiAboutUsController - /us (表 ai_about_us)
# ===========================================================================

@router.get("/us/list", summary="[AiAboutUs]列表")
def ai_about_us_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `ai_about_us`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `ai_about_us` ORDER BY id DESC LIMIT :offset, :limit"), {"offset": offset, "limit": pageSize})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("ai_about_us_list failed: %s", e)
        return _table_data([], 0)


@router.get("/us/export", summary="[AiAboutUs]导出", include_in_schema=False)
def ai_about_us_export(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("/us/{item_id}", summary="[AiAboutUs]详情")
def ai_about_us_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `ai_about_us` WHERE id = :id"), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("ai_about_us_get failed: %s", e)
        return _ajax(False, str(e))


@router.post("/us", summary="[AiAboutUs]新增")
def ai_about_us_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {"now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{k}`")
            vals.append(f":{k}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `ai_about_us` ({', '.join(cols)}) VALUES ({', '.join(vals)})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("ai_about_us_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/us", summary="[AiAboutUs]修改")
def ai_about_us_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {"id": cid, "now": utcnow()}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{k}` = :{k}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `ai_about_us` SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_about_us_edit failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/us/{ids}", summary="[AiAboutUs]删除(支持批量)")
def ai_about_us_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `ai_about_us` WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("ai_about_us_remove failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 总计: 66 个 Controller / 396 个端点 (标准 CRUD 六件套)
# ===========================================================================
