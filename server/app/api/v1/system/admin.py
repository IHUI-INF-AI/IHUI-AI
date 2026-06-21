"""Admin 后台管理 6 模块 CRUD 统一路由.

覆盖: role / menu / dept / post / config / dict
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_session
from app.models.sys_models import (
    SysConfig,
    SysDept,
    SysDictData,
    SysDictType,
    SysMenu,
    SysPost,
    SysRole,
)
from app.schemas.common import error, success
from app.security import require_login, require_role

router = APIRouter()


# ---------------------------------------------------------------------------
# 通用 CRUD 辅助
# ---------------------------------------------------------------------------


def _paginate(db: Session, model: type, page: int, limit: int, **filters):
    q = db.query(model)
    for k, v in filters.items():
        if v is not None and hasattr(model, k):
            # 支持模糊匹配 (传入 key 以 "_like" 结尾时用 like,否则精确匹配)
            if k.endswith("_like") and isinstance(v, str):
                real_k = k[:-5]
                if hasattr(model, real_k):
                    q = q.filter(getattr(model, real_k).like(f"%{v}%"))
            else:
                q = q.filter(getattr(model, k) == v)
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total


def _serialize(obj) -> dict:
    """把 ORM 对象转成 dict."""
    out = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        out[col.name] = val
    return out


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------


@router.get("/role/list", summary="角色列表")
async def list_roles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role_name: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysRole, page, limit, role_name_like=role_name)
        return success([_serialize(r) for r in items], total=total)


@router.post("/role/create", summary="创建角色")
async def create_role(
    role_name: str = Query(...),
    role_key: str = Query(...),
    role_sort: int = Query(0),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        r = SysRole(
            role_name=role_name,
            role_key=role_key,
            role_sort=role_sort,
            status="0",
            del_flag="0",
        )
        db.add(r)
        db.commit()
        return success({"role_id": r.role_id, "role_name": role_name})


@router.post("/role/update", summary="更新角色")
async def update_role(
    role_id: int = Query(...),
    role_name: str = Query(None),
    role_sort: int = Query(None),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        r = db.query(SysRole).filter(SysRole.role_id == role_id).first()
        if not r:
            return error("角色不存在")
        if role_name is not None:
            r.role_name = role_name
        if role_sort is not None:
            r.role_sort = role_sort
        db.commit()
        return success({"role_id": role_id})


@router.post("/role/delete", summary="删除角色")
async def delete_role(role_id: int = Query(...), user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        r = db.query(SysRole).filter(SysRole.role_id == role_id).first()
        if not r:
            return error("角色不存在")
        r.del_flag = "2"
        db.commit()
        return success({"role_id": role_id, "deleted": True})


# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------


@router.get("/menu/list", summary="菜单列表")
async def list_menus(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    menu_name: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysMenu, page, limit)
        if menu_name:
            items = [m for m in items if m.menu_name and menu_name in m.menu_name]
        return success([_serialize(m) for m in items], total=total)


@router.get("/menu/getRouters", summary="获取路由菜单树 (Admin 兼容)")
async def get_routers(user_uuid: str = Depends(require_login)):
    """返回前端路由所需的菜单树结构.Admin 前端调用 /system/menu/getRouters."""
    with get_session() as db:
        menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
        # 构建树结构
        menu_dict = {}
        for m in menus:
            menu_dict[m.menu_id] = {
                "menuId": m.menu_id,
                "menuName": m.menu_name,
                "parentId": m.parent_id,
                "path": m.path or "",
                "icon": m.icon or "#",
                "menuType": m.menu_type or "M",
                "visible": m.visible or "0",
                "status": m.status or "0",
                "perms": m.perms or "",
                "children": [],
            }
        tree = []
        for _mid, node in menu_dict.items():
            parent_id = node["parentId"]
            if parent_id == 0:
                tree.append(node)
            elif parent_id in menu_dict:
                menu_dict[parent_id]["children"].append(node)
        return success(tree)


@router.get("/menu/treeselect", summary="菜单树选择 (Admin 兼容)")
async def menu_treeselect(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
        menu_dict = {}
        for m in menus:
            menu_dict[m.menu_id] = {"id": m.menu_id, "label": m.menu_name, "children": []}
        tree = []
        for m in menus:
            if m.parent_id == 0:
                tree.append(menu_dict[m.menu_id])
            elif m.parent_id in menu_dict:
                menu_dict[m.parent_id]["children"].append(menu_dict[m.menu_id])
        return success(tree)


@router.get("/menu/roleMenuTreeselect/{role_id}", summary="角色菜单树")
async def role_menu_treeselect(role_id: int, user_uuid: str = Depends(require_login)):
    with get_session() as db:
        menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
        menu_dict = {}
        for m in menus:
            menu_dict[m.menu_id] = {"id": m.menu_id, "label": m.menu_name, "children": []}
        tree = []
        for m in menus:
            if m.parent_id == 0:
                tree.append(menu_dict[m.menu_id])
            elif m.parent_id in menu_dict:
                menu_dict[m.parent_id]["children"].append(menu_dict[m.menu_id])
        from app.models.sys_models import SysRoleMenu

        checked = db.query(SysRoleMenu.menu_id).filter(SysRoleMenu.role_id == role_id).all()
        return success({"menus": tree, "checkedKeys": [r[0] for r in checked]})


@router.post("/menu/create", summary="创建菜单")
async def create_menu(
    menu_name: str = Query(...),
    parent_id: int = Query(0),
    path: str = Query(""),
    icon: str = Query("#"),
    menu_type: str = Query("M"),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        m = SysMenu(
            menu_name=menu_name,
            parent_id=parent_id,
            path=path,
            icon=icon,
            menu_type=menu_type,
            status="0",
            visible="0",
        )
        db.add(m)
        db.commit()
        return success({"menu_id": m.menu_id, "menu_name": menu_name})


@router.post("/menu/delete", summary="删除菜单")
async def delete_menu(menu_id: int = Query(...), user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        m = db.query(SysMenu).filter(SysMenu.menu_id == menu_id).first()
        if not m:
            return error("菜单不存在")
        db.delete(m)
        db.commit()
        return success({"menu_id": menu_id, "deleted": True})


# ---------------------------------------------------------------------------
# Dept
# ---------------------------------------------------------------------------


@router.get("/dept/list", summary="部门列表")
async def list_depts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    dept_name: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysDept, page, limit)
        if dept_name:
            items = [d for d in items if d.dept_name and dept_name in d.dept_name]
        return success([_serialize(d) for d in items], total=total)


@router.post("/dept/create", summary="创建部门")
async def create_dept(
    dept_name: str = Query(...),
    parent_id: int = Query(0),
    leader: str = Query(""),
    order_num: int = Query(0),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        d = SysDept(
            dept_name=dept_name,
            parent_id=parent_id,
            leader=leader,
            order_num=order_num,
            status="0",
            del_flag="0",
        )
        db.add(d)
        db.commit()
        return success({"dept_id": d.dept_id, "dept_name": dept_name})


@router.post("/dept/delete", summary="删除部门")
async def delete_dept(dept_id: int = Query(...), user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        d = db.query(SysDept).filter(SysDept.dept_id == dept_id).first()
        if not d:
            return error("部门不存在")
        d.del_flag = "2"
        db.commit()
        return success({"dept_id": dept_id, "deleted": True})


# ---------------------------------------------------------------------------
# Post
# ---------------------------------------------------------------------------


@router.get("/post/list", summary="岗位列表")
async def list_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysPost, page, limit)
        return success([_serialize(p) for p in items], total=total)


@router.post("/post/create", summary="创建岗位")
async def create_post(
    post_code: str = Query(...),
    post_name: str = Query(...),
    post_sort: int = Query(0),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        p = SysPost(post_code=post_code, post_name=post_name, post_sort=post_sort, status="0")
        db.add(p)
        db.commit()
        return success({"post_id": p.post_id, "post_name": post_name})


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@router.get("/config/list", summary="参数配置列表")
async def list_configs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    config_key: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysConfig, page, limit)
        if config_key:
            items = [c for c in items if c.config_key and config_key in c.config_key]
        return success([_serialize(c) for c in items], total=total)


@router.get("/config/key/{config_key}", summary="按 key 查配置")
async def get_config_by_key(config_key: str, user_uuid: str = Depends(require_login)):
    with get_session() as db:
        c = db.query(SysConfig).filter(SysConfig.config_key == config_key).first()
        if not c:
            return error("配置不存在", "404")
        return success(_serialize(c))


@router.post("/config/create", summary="新增配置")
async def create_config(
    config_name: str = Query(...),
    config_key: str = Query(...),
    config_value: str = Query(""),
    config_type: str = Query("N"),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        c = SysConfig(
            config_name=config_name,
            config_key=config_key,
            config_value=config_value,
            config_type=config_type,
        )
        db.add(c)
        db.commit()
        return success({"config_id": c.config_id, "config_key": config_key})


@router.post("/config/update", summary="更新配置值")
async def update_config(
    config_id: int = Query(...),
    config_value: str = Query(...),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        c = db.query(SysConfig).filter(SysConfig.config_id == config_id).first()
        if not c:
            return error("配置不存在")
        c.config_value = config_value
        db.commit()
        return success({"config_id": config_id, "config_value": config_value})


# ---------------------------------------------------------------------------
# Dict
# ---------------------------------------------------------------------------


@router.get("/dict/type/list", summary="字典类型列表")
async def list_dict_types(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysDictType, page, limit)
        return success([_serialize(t) for t in items], total=total)


@router.post("/dict/type/create", summary="新增字典类型")
async def create_dict_type(
    dict_name: str = Query(...),
    dict_type: str = Query(..., description="字典编码,如 sys_user_sex"),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        t = SysDictType(dict_name=dict_name, dict_type=dict_type, status="0")
        db.add(t)
        db.commit()
        return success({"dict_id": t.dict_id, "dict_type": dict_type})


@router.get("/dict/data/list", summary="字典数据列表")
async def list_dict_data(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    dict_type: str = Query(..., description="字典编码"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        items, total = _paginate(db, SysDictData, page, limit, dict_type=dict_type)
        return success([_serialize(d) for d in items], total=total)


@router.get("/dict/data/type/{dict_type}", summary="按字典类型获取数据 (Admin 兼容)")
async def get_dict_data_by_type(dict_type: str, user_uuid: str = Depends(require_login)):
    """前端 /system/dict/data/type/{dict_type} 调用此端点."""
    with get_session() as db:
        items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
        return success([_serialize(d) for d in items])


@router.post("/dict/data/create", summary="新增字典数据")
async def create_dict_data(
    dict_type: str = Query(...),
    dict_label: str = Query(...),
    dict_value: str = Query(...),
    dict_sort: int = Query(0),
    user_uuid: str = Depends(require_role("admin")),
):
    with get_session() as db:
        d = SysDictData(
            dict_type=dict_type,
            dict_label=dict_label,
            dict_value=dict_value,
            dict_sort=dict_sort,
            status="0",
        )
        db.add(d)
        db.commit()
        return success({"dict_code": d.dict_code, "dict_label": dict_label})


# ---------------------------------------------------------------------------
# Excel export endpoints
# ---------------------------------------------------------------------------

_ROLE_COLUMNS = [
    {"header": "角色ID", "field": "role_id", "type": "int", "width": 10},
    {"header": "角色名称", "field": "role_name", "type": "str", "width": 20},
    {"header": "权限字符", "field": "role_key", "type": "str", "width": 20},
    {"header": "显示顺序", "field": "role_sort", "type": "int", "width": 12},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
    {"header": "创建时间", "field": "create_time", "type": "date", "width": 22},
]

_MENU_COLUMNS = [
    {"header": "菜单ID", "field": "menu_id", "type": "int", "width": 10},
    {"header": "菜单名称", "field": "menu_name", "type": "str", "width": 20},
    {"header": "父菜单ID", "field": "parent_id", "type": "int", "width": 12},
    {"header": "路由路径", "field": "path", "type": "str", "width": 24},
    {"header": "权限标识", "field": "perms", "type": "str", "width": 24},
    {"header": "菜单类型", "field": "menu_type", "type": "str", "width": 12},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
]

_DEPT_COLUMNS = [
    {"header": "部门ID", "field": "dept_id", "type": "int", "width": 10},
    {"header": "部门名称", "field": "dept_name", "type": "str", "width": 20},
    {"header": "父部门ID", "field": "parent_id", "type": "int", "width": 12},
    {"header": "负责人", "field": "leader", "type": "str", "width": 16},
    {"header": "排序", "field": "order_num", "type": "int", "width": 10},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
]

_POST_COLUMNS = [
    {"header": "岗位ID", "field": "post_id", "type": "int", "width": 10},
    {"header": "岗位编码", "field": "post_code", "type": "str", "width": 20},
    {"header": "岗位名称", "field": "post_name", "type": "str", "width": 20},
    {"header": "排序", "field": "post_sort", "type": "int", "width": 10},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
]

_CONFIG_COLUMNS = [
    {"header": "参数ID", "field": "config_id", "type": "int", "width": 10},
    {"header": "参数名称", "field": "config_name", "type": "str", "width": 24},
    {"header": "参数键名", "field": "config_key", "type": "str", "width": 24},
    {"header": "参数键值", "field": "config_value", "type": "str", "width": 24},
    {"header": "系统内置", "field": "config_type", "type": "str", "width": 12},
]

_DICT_TYPE_COLUMNS = [
    {"header": "字典ID", "field": "dict_id", "type": "int", "width": 10},
    {"header": "字典名称", "field": "dict_name", "type": "str", "width": 24},
    {"header": "字典类型", "field": "dict_type", "type": "str", "width": 24},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
]


def _export_helper(db: Session, model, columns: list, filename: str, filters: dict | None = None):
    """Generic export: query all rows (with optional filters), serialize, return StreamingResponse."""
    from app.utils.excel_util import export_to_excel

    q = db.query(model)
    if filters:
        for k, v in filters.items():
            if v is not None and hasattr(model, k):
                q = q.filter(getattr(model, k).like(f"%{v}%") if isinstance(v, str) else getattr(model, k) == v)
    items = q.all()
    data = []
    for obj in items:
        row = {}
        for col_def in columns:
            field = col_def["field"]
            val = getattr(obj, field, None)
            if isinstance(val, datetime):
                pass  # export_to_excel handles datetime formatting
            row[field] = val
        data.append(row)
    buf = export_to_excel(data, columns, filename=filename)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/role/export", summary="导出角色列表到Excel")
async def export_roles(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysRole, _ROLE_COLUMNS, "角色数据.xlsx")


@router.get("/menu/export", summary="导出菜单列表到Excel")
async def export_menus(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysMenu, _MENU_COLUMNS, "菜单数据.xlsx")


@router.get("/dept/export", summary="导出部门列表到Excel")
async def export_depts(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysDept, _DEPT_COLUMNS, "部门数据.xlsx")


@router.get("/post/export", summary="导出岗位列表到Excel")
async def export_posts(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysPost, _POST_COLUMNS, "岗位数据.xlsx")


@router.get("/config/export", summary="导出参数配置到Excel")
async def export_configs(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysConfig, _CONFIG_COLUMNS, "参数配置.xlsx")


@router.get("/dict/type/export", summary="导出字典类型到Excel")
async def export_dict_types(user_uuid: str = Depends(require_role("admin"))):
    with get_session() as db:
        return _export_helper(db, SysDictType, _DICT_TYPE_COLUMNS, "字典类型.xlsx")
