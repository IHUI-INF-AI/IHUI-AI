"""操作日志 / 登录信息审计路由."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc

from app.database import get_session
from app.models.sys_models import SysLoginInfo, SysOperLog
from app.schemas.common import error, success
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter()


@router.get("/operlog/list", summary="操作日志列表")
def list_oper_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str = Query(None),
    oper_name: str = Query(None),
    business_type: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(SysOperLog)
        if title:
            q = q.filter(SysOperLog.title.like(f"%{title}%"))
        if oper_name:
            q = q.filter(SysOperLog.oper_name.like(f"%{oper_name}%"))
        if business_type is not None:
            q = q.filter(SysOperLog.business_type == business_type)
        total = q.count()
        items = q.order_by(desc(SysOperLog.oper_id)).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "oper_id": o.oper_id,
                "title": o.title,
                "business_type": o.business_type,
                "method": o.method,
                "request_method": o.request_method,
                "oper_name": o.oper_name,
                "oper_url": o.oper_url,
                "oper_ip": o.oper_ip,
                "status": o.status,
                "error_msg": o.error_msg,
                "oper_time": o.oper_time.isoformat() if o.oper_time else None,
            }
            for o in items
        ]
        return success(data, total=total)


@router.post("/operlog/create", summary="写入一条操作日志(内部调用)")
def create_oper_log(
    title: str = Query(...),
    business_type: int = Query(0, description="0 其它 1 新增 2 修改 3 删除 4 查询"),
    method: str = Query(""),
    request_method: str = Query(""),
    oper_url: str = Query(""),
    oper_name: str = Query("system"),
    oper_ip: str = Query("127.0.0.1"),
    status: int = Query(0, description="0 成功 1 失败"),
    error_msg: str = Query(""),
):
    with get_session() as db:
        try:
            log = SysOperLog(
                title=title,
                business_type=business_type,
                method=method,
                request_method=request_method,
                oper_url=oper_url,
                oper_name=oper_name,
                oper_ip=oper_ip,
                status=status,
                error_msg=error_msg,
                oper_time=utcnow(),
            )
            db.add(log)
            db.commit()
            return success({"oper_id": log.oper_id})
        except Exception as e:
            return error(str(e))


@router.post("/operlog/clean", summary="清理 N 天前的操作日志")
def clean_oper_log(days: int = Query(90, description="保留天数")):
    with get_session() as db:
        from datetime import timedelta

        cutoff = utcnow() - timedelta(days=days)
        deleted = db.query(SysOperLog).filter(SysOperLog.oper_time < cutoff).delete()
        db.commit()
        return success({"deleted": deleted})


# ---------------------------------------------------------------------------
# 登录日志
# ---------------------------------------------------------------------------


@router.get("/logininfor/list", summary="登录日志列表")
def list_login_info(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_name: str = Query(None),
    status: str = Query(None, description="0 成功 1 失败"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(SysLoginInfo)
        if user_name:
            q = q.filter(SysLoginInfo.user_name.like(f"%{user_name}%"))
        if status is not None:
            q = q.filter(SysLoginInfo.status == status)
        total = q.count()
        items = q.order_by(desc(SysLoginInfo.info_id)).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "info_id": i.info_id,
                "user_name": i.user_name,
                "ipaddr": i.ipaddr,
                "login_location": i.login_location,
                "browser": i.browser,
                "os": i.os,
                "status": i.status,
                "msg": i.msg,
                "login_time": i.login_time.isoformat() if i.login_time else None,
            }
            for i in items
        ]
        return success(data, total=total)


@router.post("/logininfor/create", summary="记录一条登录日志")
def create_login_info(
    user_name: str = Query(...),
    ipaddr: str = Query(""),
    login_location: str = Query(""),
    browser: str = Query(""),
    os: str = Query(""),
    status: str = Query("0"),
    msg: str = Query(""),
):
    with get_session() as db:
        try:
            info = SysLoginInfo(
                user_name=user_name,
                ipaddr=ipaddr,
                login_location=login_location,
                browser=browser,
                os=os,
                status=status,
                msg=msg,
                login_time=utcnow(),
            )
            db.add(info)
            db.commit()
            return success({"info_id": info.info_id})
        except Exception as e:
            return error(str(e))


@router.post("/logininfor/clean", summary="清理登录日志")
def clean_login_info(days: int = Query(90)):
    with get_session() as db:
        from datetime import timedelta

        cutoff = utcnow() - timedelta(days=days)
        deleted = db.query(SysLoginInfo).filter(SysLoginInfo.login_time < cutoff).delete()
        db.commit()
        return success({"deleted": deleted})


# ---------------------------------------------------------------------------
# Excel export
# ---------------------------------------------------------------------------

_OPERLOG_COLUMNS = [
    {"header": "日志ID", "field": "oper_id", "type": "int", "width": 10},
    {"header": "系统模块", "field": "title", "type": "str", "width": 20},
    {"header": "业务类型", "field": "business_type", "type": "str", "width": 12},
    {"header": "请求方式", "field": "request_method", "type": "str", "width": 12},
    {"header": "操作人员", "field": "oper_name", "type": "str", "width": 16},
    {"header": "操作URL", "field": "oper_url", "type": "str", "width": 30},
    {"header": "操作IP", "field": "oper_ip", "type": "str", "width": 16},
    {"header": "操作状态", "field": "status", "type": "str", "width": 12},
    {"header": "错误消息", "field": "error_msg", "type": "str", "width": 30},
    {"header": "操作时间", "field": "oper_time", "type": "date", "width": 22},
]

_BIZ_TYPE_MAP = {0: "其它", 1: "新增", 2: "修改", 3: "删除", 4: "查询", 5: "导出"}

_LOGININFO_COLUMNS = [
    {"header": "日志ID", "field": "info_id", "type": "int", "width": 10},
    {"header": "用户名", "field": "user_name", "type": "str", "width": 18},
    {"header": "登录IP", "field": "ipaddr", "type": "str", "width": 16},
    {"header": "登录地点", "field": "login_location", "type": "str", "width": 20},
    {"header": "浏览器", "field": "browser", "type": "str", "width": 16},
    {"header": "操作系统", "field": "os", "type": "str", "width": 16},
    {"header": "登录状态", "field": "status", "type": "str", "width": 12},
    {"header": "消息", "field": "msg", "type": "str", "width": 24},
    {"header": "登录时间", "field": "login_time", "type": "date", "width": 22},
]


@router.get("/operlog/export", summary="导出操作日志到Excel")
def export_oper_logs(
    title: str = Query(None),
    oper_name: str = Query(None),
    business_type: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    from app.utils.excel_util import export_to_excel

    with get_session() as db:
        q = db.query(SysOperLog)
        if title:
            q = q.filter(SysOperLog.title.like(f"%{title}%"))
        if oper_name:
            q = q.filter(SysOperLog.oper_name.like(f"%{oper_name}%"))
        if business_type is not None:
            q = q.filter(SysOperLog.business_type == business_type)
        items = q.order_by(desc(SysOperLog.oper_id)).all()
        data = [
            {
                "oper_id": o.oper_id,
                "title": o.title,
                "business_type": _BIZ_TYPE_MAP.get(o.business_type, "其它"),
                "request_method": o.request_method,
                "oper_name": o.oper_name,
                "oper_url": o.oper_url,
                "oper_ip": o.oper_ip,
                "status": "成功" if o.status == 0 else "失败",
                "error_msg": o.error_msg or "",
                "oper_time": o.oper_time,
            }
            for o in items
        ]
        buf = export_to_excel(data, _OPERLOG_COLUMNS, filename="操作日志.xlsx")
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=operlog.xlsx"},
        )


@router.get("/logininfor/export", summary="导出登录日志到Excel")
def export_login_info(
    user_name: str = Query(None),
    status: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    from app.utils.excel_util import export_to_excel

    with get_session() as db:
        q = db.query(SysLoginInfo)
        if user_name:
            q = q.filter(SysLoginInfo.user_name.like(f"%{user_name}%"))
        if status is not None:
            q = q.filter(SysLoginInfo.status == status)
        items = q.order_by(desc(SysLoginInfo.info_id)).all()
        data = [
            {
                "info_id": i.info_id,
                "user_name": i.user_name,
                "ipaddr": i.ipaddr,
                "login_location": i.login_location,
                "browser": i.browser,
                "os": i.os,
                "status": "成功" if i.status == "0" else "失败",
                "msg": i.msg or "",
                "login_time": i.login_time,
            }
            for i in items
        ]
        buf = export_to_excel(data, _LOGININFO_COLUMNS, filename="登录日志.xlsx")
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=logininfor.xlsx"},
        )
