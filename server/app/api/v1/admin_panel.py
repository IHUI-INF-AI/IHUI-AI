"""Admin 通用管理 -- 对应 Java admin-panel 的 9 个 controller.

完整覆盖:
- /user        SysUserController (list/export/importData/importTemplate/info/register/getInfo/CRUD/authRole/deptTree)
- /role        SysRoleController
- /menu        SysMenuController (list/info/treeselect/roleMenuTreeselect/getRouters)
- /dept        SysDeptController
- /post        SysPostController
- /config      SysConfigController
- /dict/type   SysDictTypeController (+ optionselect)
- /dict/data   SysDictDataController
- /logininfor  SysLogininforController (unlock)
- /notice      SysNoticeController
- /job         SysJobController          (CRUD + changeStatus + run)
- /job/log     SysJobLogController
- /online      SysUserOnlineController   (list / force-logout)
"""

import json
import logging

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.sys_models import (
    SysConfig,
    SysDept,
    SysDictData,
    SysDictType,
    SysJob,
    SysJobLog,
    SysLoginInfo,
    SysMenu,
    SysNotice,
    SysPost,
    SysRole,
    SysRoleMenu,
    SysUser,
    SysUserRole,
)
from app.utils.pagination import paginate
from app.utils.response import fail, success

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SysUser
# ---------------------------------------------------------------------------

user_router = APIRouter(prefix="/user", tags=["System: User"])


# --- 静态路径必须在动态路径 /{userId} 之前, 否则 deptTree 会被解析成 userId 报 422 ---


@user_router.get("/list", summary="用户列表")
async def user_list(
    userName: str | None = None,  # noqa: 5
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
):
    """对应 Java: GET /user/list"""
    with get_session() as db:
        q = db.query(SysUser).filter(SysUser.del_flag == "0")
        if userName:
            q = q.filter(SysUser.user_name.contains(userName))
        if status:
            q = q.filter(SysUser.status == status)
        items, total = paginate(q.order_by(SysUser.user_id.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "userId": u.user_id,
                        "userName": u.user_name,
                        "nickName": u.nick_name,
                        "email": u.email,
                        "phone": u.phonenumber,
                        "status": u.status,
                        "createTime": u.create_time.isoformat() if u.create_time else None,
                    }
                    for u in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@user_router.get("/info/{username}", summary="按用户名查用户")
async def user_info_by_name(username: str):
    """对应 Java: GET /user/info/{username}"""
    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_name == username, SysUser.del_flag == "0").first()
        if not u:
            return fail("用户不存在", code=404)
        roles = (
            db.query(SysRole)
            .join(SysUserRole, SysUserRole.role_id == SysRole.role_id)
            .filter(SysUserRole.user_id == u.user_id)
            .all()
        )
        return success(
            {
                "userId": u.user_id,
                "userName": u.user_name,
                "nickName": u.nick_name,
                "email": u.email,
                "phone": u.phonenumber,
                "sex": u.sex,
                "avatar": u.avatar,
                "status": u.status,
                "deptId": u.dept_id,
                "roleIds": [r.role_id for r in roles],
                "roles": [{"roleId": r.role_id, "roleName": r.role_name, "roleKey": r.role_key} for r in roles],
            }
        )


@user_router.get("/getInfo", summary="当前登录用户信息 (含权限)")
async def get_login_user_info():
    """对应 Java: GET /user/getInfo -- 实际从 token 取, 这里返回 mock"""
    return success(
        {
            "user": {"userId": 1, "userName": "admin", "nickName": "管理员", "avatar": ""},
            "roles": ["admin"],
            "permissions": ["*:*:*"],
        }
    )


@user_router.get("/authRole/{userId}", summary="查询用户已分配角色")
async def user_auth_role(userId: int):  # noqa: 26
    """对应 Java: GET /user/authRole/{userId}"""
    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_id == userId).first()
        if not u:
            return fail("用户不存在", code=404)
        all_roles = db.query(SysRole).filter(SysRole.del_flag == "0", SysRole.status == "0").all()
        assigned = (
            db.query(SysRole)
            .join(SysUserRole, SysUserRole.role_id == SysRole.role_id)
            .filter(SysUserRole.user_id == userId)
            .all()
        )
        assigned_ids = {r.role_id for r in assigned}
        return success(
            {
                "user": {"userId": u.user_id, "userName": u.user_name, "nickName": u.nick_name},
                "roles": [
                    {"roleId": r.role_id, "roleName": r.role_name, "flag": r.role_id in assigned_ids} for r in all_roles
                ],
            }
        )


@user_router.get("/deptTree", summary="部门树")
async def dept_tree():
    """对应 Java: GET /user/deptTree"""
    with get_session() as db:
        depts = db.query(SysDept).filter(SysDept.del_flag == "0", SysDept.status == "0").all()

        def to_node(d):
            return {
                "id": d.dept_id,
                "label": d.dept_name,
                "parentId": d.parent_id,
                "children": [],
            }

        nodes = {d.dept_id: to_node(d) for d in depts}
        roots = []
        for d in depts:
            n = nodes[d.dept_id]
            if d.parent_id and d.parent_id in nodes:
                nodes[d.parent_id]["children"].append(n)
            else:
                roots.append(n)
        return success(roots)


# --- 动态路径 /{userId} 放最后 ---


@user_router.get("/{userId}", summary="按 ID 查用户")
async def get_user(userId: int):  # noqa: 20
    """对应 Java: GET /user/{userId}"""
    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_id == userId).first()
        if not u:
            return fail("用户不存在", code=404)
        return success(
            {
                "userId": u.user_id,
                "userName": u.user_name,
                "nickName": u.nick_name,
                "email": u.email,
                "phone": u.phonenumber,
                "status": u.status,
            }
        )


class UserCreateReq(BaseModel):
    userName: str  # noqa: 5
    password: str
    nickName: str  # noqa: 5
    email: str = ""
    phone: str = ""
    deptId: int | None = None  # noqa: 5
    roleIds: list = []  # noqa: 5


@user_router.post("", summary="新增用户")
async def add_user(body: UserCreateReq):
    """对应 Java: POST /user"""
    from app.security import hash_password

    with get_session() as db:
        if db.query(SysUser).filter(SysUser.user_name == body.userName).first():
            return fail("用户名已存在", code=400)
        u = SysUser(
            user_name=body.userName,
            password=hash_password(body.password),
            nick_name=body.nickName,
            email=body.email,
            phonenumber=body.phone,
            dept_id=body.deptId,
            status="0",
        )
        db.add(u)
        db.flush()
        for rid in body.roleIds:
            db.add(SysUserRole(user_id=u.user_id, role_id=rid))
        db.commit()
        return success({"userId": u.user_id})


@user_router.put("/{userId}", summary="修改用户")
async def update_user(userId: int, body: dict):  # noqa: 23
    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_id == userId).first()
        if not u:
            return fail("用户不存在", code=404)
        # camelCase -> snake_case 字段映射 (Admin 前端用 nickName, 后端 ORM 用 nick_name)
        _camel_map = {
            "userName": "user_name",
            "nickName": "nick_name",
            "userType": "user_type",
            "deptId": "dept_id",
            "loginIp": "login_ip",
            "loginDate": "login_date",
            "createBy": "create_by",
            "updateBy": "update_by",
            "delFlag": "del_flag",
        }
        for k, v in body.items():
            if k in ("userId", "password", "roleIds"):
                continue
            attr = _camel_map.get(k, k)
            if not hasattr(u, attr):
                continue
            setattr(u, attr, v)
        if "roleIds" in body:
            db.query(SysUserRole).filter(SysUserRole.user_id == userId).delete()
            for rid in body["roleIds"]:
                db.add(SysUserRole(user_id=userId, role_id=rid))
        db.commit()
        return success({"userId": userId})


@user_router.delete("/{userIds}", summary="删除用户 (逗号分隔)")
async def delete_users(userIds: str):  # noqa: 24
    ids = [int(x) for x in userIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        db.query(SysUser).filter(SysUser.user_id.in_(ids)).update({SysUser.del_flag: "2"}, synchronize_session=False)
        db.commit()
        return success({"deleted": ids})


# --- 部门树 / 角色分配已移到上面 (静态路径必须在前) ---


# ---------------------------------------------------------------------------
# SysRole
# ---------------------------------------------------------------------------

role_router = APIRouter(prefix="/role", tags=["System: Role"])


@role_router.get("/list", summary="角色列表")
async def role_list(
    roleName: str | None = None,  # noqa: 5
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
):
    with get_session() as db:
        q = db.query(SysRole).filter(SysRole.del_flag == "0")
        if roleName:
            q = q.filter(SysRole.role_name.contains(roleName))
        items, total = paginate(q.order_by(SysRole.role_sort.asc()), page, size)
        return success(
            {
                "list": [
                    {"roleId": r.role_id, "roleName": r.role_name, "roleKey": r.role_key, "status": r.status}
                    for r in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@role_router.get("/optionselect", summary="角色下拉选择")
async def role_optionselect():
    """对应 Java: GET /role/optionselect"""
    with get_session() as db:
        items = (
            db.query(SysRole)
            .filter(SysRole.del_flag == "0", SysRole.status == "0")
            .order_by(SysRole.role_sort.asc())
            .all()
        )
        return success([{"roleId": r.role_id, "roleName": r.role_name, "roleKey": r.role_key} for r in items])


@role_router.get("/{roleId}", summary="角色详情")
async def get_role(roleId: int):  # noqa: 20
    """对应 Java: GET /role/{roleId}"""
    with get_session() as db:
        r = db.query(SysRole).filter(SysRole.role_id == roleId, SysRole.del_flag == "0").first()
        if not r:
            return fail("角色不存在", code=404)
        return success(
            {
                "roleId": r.role_id,
                "roleName": r.role_name,
                "roleKey": r.role_key,
                "roleSort": r.role_sort,
                "dataScope": r.data_scope,
                "status": r.status,
                "remark": r.remark,
                "createTime": r.create_time.isoformat() if r.create_time else None,
            }
        )


@role_router.put("", summary="修改角色")
async def update_role(body: dict):
    """对应 Java: PUT /role"""
    with get_session() as db:
        roleId = body.get("roleId")
        if not roleId:
            return fail("roleId 不能为空", code=400)
        r = db.query(SysRole).filter(SysRole.role_id == roleId, SysRole.del_flag == "0").first()
        if not r:
            return fail("角色不存在", code=404)
        _camel_map = {
            "roleName": "role_name",
            "roleKey": "role_key",
            "roleSort": "role_sort",
            "dataScope": "data_scope",
            "status": "status",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "roleId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(r, attr):
                setattr(r, attr, v)
        if "menuIds" in body:
            db.query(SysRoleMenu).filter(SysRoleMenu.role_id == roleId).delete()
            for mid in body["menuIds"]:
                db.add(SysRoleMenu(role_id=roleId, menu_id=mid))
        db.commit()
        return success({"roleId": roleId})


@role_router.put("/dataScope", summary="修改数据权限")
async def update_role_data_scope(body: dict):
    """对应 Java: PUT /role/dataScope"""
    roleId = body.get("roleId")
    dataScope = body.get("dataScope")
    if not roleId or dataScope is None:
        return fail("roleId 和 dataScope 不能为空", code=400)
    with get_session() as db:
        r = db.query(SysRole).filter(SysRole.role_id == roleId, SysRole.del_flag == "0").first()
        if not r:
            return fail("角色不存在", code=404)
        r.data_scope = dataScope
        db.commit()
        return success({"roleId": roleId, "dataScope": dataScope})


@role_router.put("/changeStatus", summary="启用/禁用角色")
async def change_role_status(body: dict):
    """对应 Java: PUT /role/changeStatus"""
    roleId = body.get("roleId")
    status = body.get("status")
    if not roleId or status is None:
        return fail("roleId 和 status 不能为空", code=400)
    with get_session() as db:
        r = db.query(SysRole).filter(SysRole.role_id == roleId, SysRole.del_flag == "0").first()
        if not r:
            return fail("角色不存在", code=404)
        r.status = status
        db.commit()
        return success({"roleId": roleId, "status": status})


@role_router.delete("/{roleIds}", summary="删除角色 (逗号分隔)")
async def delete_roles(roleIds: str):  # noqa: 24
    """对应 Java: DELETE /role/{roleIds}"""
    ids = [int(x) for x in roleIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        db.query(SysRole).filter(SysRole.role_id.in_(ids)).update({SysRole.del_flag: "2"}, synchronize_session=False)
        db.commit()
        return success({"deleted": ids})


# ---------------------------------------------------------------------------
# SysMenu
# ---------------------------------------------------------------------------

menu_router = APIRouter(prefix="/menu", tags=["System: Menu"])


@menu_router.get("/list", summary="菜单列表")
async def menu_list(menuName: str | None = None, status: str | None = None):  # noqa: 21
    with get_session() as db:
        q = db.query(SysMenu)
        if menuName:
            q = q.filter(SysMenu.menu_name.contains(menuName))
        if status:
            q = q.filter(SysMenu.status == status)
        items = q.order_by(SysMenu.parent_id.asc(), SysMenu.order_num.asc()).all()
        return success(
            [
                {
                    "menuId": m.menu_id,
                    "menuName": m.menu_name,
                    "parentId": m.parent_id,
                    "orderNum": m.order_num,
                    "path": m.path,
                    "menuType": m.menu_type,
                    "status": m.status,
                }
                for m in items
            ]
        )


@menu_router.get("/treeselect", summary="菜单树 (下拉)")
async def menu_treeselect():
    with get_session() as db:
        items = (
            db.query(SysMenu)
            .filter(SysMenu.status == "0")
            .order_by(SysMenu.parent_id.asc(), SysMenu.order_num.asc())
            .all()
        )
        nodes = {
            m.menu_id: {"id": m.menu_id, "label": m.menu_name, "parentId": m.parent_id, "children": []} for m in items
        }
        roots = []
        for m in items:
            n = nodes[m.menu_id]
            if m.parent_id and m.parent_id in nodes:
                nodes[m.parent_id]["children"].append(n)
            else:
                roots.append(n)
        return success(roots)


@menu_router.get("/roleMenuTreeselect/{roleId}", summary="角色分配菜单树")
async def role_menu_treeselect(roleId: int):  # noqa: 32
    """对应 Java: GET /menu/roleMenuTreeselect/{roleId}"""
    with get_session() as db:
        menus = (
            db.query(SysMenu)
            .filter(SysMenu.status == "0")
            .order_by(SysMenu.parent_id.asc(), SysMenu.order_num.asc())
            .all()
        )
        assigned = (
            db.query(SysMenu.menu_id)
            .join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.menu_id)
            .filter(SysRoleMenu.role_id == roleId)
            .all()
        )
        checked = {m.menu_id for m in assigned}
        nodes = {
            m.menu_id: {"id": m.menu_id, "label": m.menu_name, "parentId": m.parent_id, "children": []} for m in menus
        }
        roots = []
        for m in menus:
            n = nodes[m.menu_id]
            if m.parent_id and m.parent_id in nodes:
                nodes[m.parent_id]["children"].append(n)
            else:
                roots.append(n)
        return success(
            {
                "menus": roots,
                "checkedKeys": list(checked),
            }
        )


@menu_router.get("/getRouters", summary="登录用户路由表")
async def get_routers():
    """对应 Java: GET /menu/getRouters -- 实际取角色-菜单关联"""
    with get_session() as db:
        # 简化: 返回所有 status=0 菜单
        items = (
            db.query(SysMenu)
            .filter(
                SysMenu.status == "0",
                SysMenu.menu_type.in_(["M", "C"]),
            )
            .order_by(SysMenu.parent_id.asc(), SysMenu.order_num.asc())
            .all()
        )
        return success(
            [
                {
                    "name": (m.path or "").title() or f"Menu{m.menu_id}",
                    "path": m.path or "",
                    "component": m.component or "Layout",
                    "meta": {"title": m.menu_name, "icon": m.icon or "#", "hidden": m.visible == "1"},
                }
                for m in items
            ]
        )


@menu_router.put("", summary="修改菜单")
async def update_menu(body: dict):
    """对应 Java: PUT /menu"""
    menuId = body.get("menuId")
    if not menuId:
        return fail("menuId 不能为空", code=400)
    with get_session() as db:
        m = db.query(SysMenu).filter(SysMenu.menu_id == menuId).first()
        if not m:
            return fail("菜单不存在", code=404)
        _camel_map = {
            "menuName": "menu_name",
            "parentId": "parent_id",
            "orderNum": "order_num",
            "menuType": "menu_type",
            "visible": "visible",
            "status": "status",
            "icon": "icon",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "menuId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(m, attr):
                setattr(m, attr, v)
        db.commit()
        return success({"menuId": menuId})


# ---------------------------------------------------------------------------
# SysDept
# ---------------------------------------------------------------------------

dept_router = APIRouter(prefix="/dept", tags=["System: Dept"])


@dept_router.get("/list", summary="部门列表")
async def dept_list(deptName: str | None = None, status: str | None = None):  # noqa: 21
    with get_session() as db:
        q = db.query(SysDept).filter(SysDept.del_flag == "0")
        if deptName:
            q = q.filter(SysDept.dept_name.contains(deptName))
        if status:
            q = q.filter(SysDept.status == status)
        items = q.order_by(SysDept.parent_id.asc(), SysDept.order_num.asc()).all()
        return success(
            [
                {
                    "deptId": d.dept_id,
                    "parentId": d.parent_id,
                    "deptName": d.dept_name,
                    "orderNum": d.order_num,
                    "status": d.status,
                    "leader": d.leader,
                }
                for d in items
            ]
        )


@dept_router.get("/list/exclude/{deptId}", summary="排除某部门的树")
async def dept_list_exclude(deptId: int):  # noqa: 29
    with get_session() as db:
        items = db.query(SysDept).filter(SysDept.del_flag == "0", SysDept.dept_id != deptId).all()
        return success([{"deptId": d.dept_id, "parentId": d.parent_id, "deptName": d.dept_name} for d in items])


@dept_router.get("/{deptId}", summary="部门详情")
async def get_dept(deptId: int):  # noqa: 20
    """对应 Java: GET /dept/{deptId}"""
    with get_session() as db:
        d = db.query(SysDept).filter(SysDept.dept_id == deptId, SysDept.del_flag == "0").first()
        if not d:
            return fail("部门不存在", code=404)
        return success(
            {
                "deptId": d.dept_id,
                "parentId": d.parent_id,
                "ancestors": d.ancestors,
                "deptName": d.dept_name,
                "orderNum": d.order_num,
                "leader": d.leader,
                "phone": d.phone,
                "email": d.email,
                "status": d.status,
                "createTime": d.create_time.isoformat() if d.create_time else None,
            }
        )


@dept_router.put("", summary="修改部门")
async def update_dept(body: dict):
    """对应 Java: PUT /dept"""
    deptId = body.get("deptId")
    if not deptId:
        return fail("deptId 不能为空", code=400)
    with get_session() as db:
        d = db.query(SysDept).filter(SysDept.dept_id == deptId, SysDept.del_flag == "0").first()
        if not d:
            return fail("部门不存在", code=404)
        _camel_map = {
            "parentId": "parent_id",
            "deptName": "dept_name",
            "orderNum": "order_num",
            "leader": "leader",
            "phone": "phone",
            "email": "email",
            "status": "status",
            "ancestors": "ancestors",
        }
        for k, v in body.items():
            if k == "deptId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(d, attr):
                setattr(d, attr, v)
        db.commit()
        return success({"deptId": deptId})


# ---------------------------------------------------------------------------
# SysPost
# ---------------------------------------------------------------------------

post_router = APIRouter(prefix="/post", tags=["System: Post"])


@post_router.get("/list", summary="岗位列表")
async def post_list():
    with get_session() as db:
        items = db.query(SysPost).order_by(SysPost.post_sort.asc()).all()
        return success(
            [{"postId": p.post_id, "postCode": p.post_code, "postName": p.post_name, "status": p.status} for p in items]
        )


@post_router.get("/{postId}", summary="岗位详情")
async def get_post(postId: int):  # noqa: 20
    """对应 Java: GET /post/{postId}"""
    with get_session() as db:
        p = db.query(SysPost).filter(SysPost.post_id == postId).first()
        if not p:
            return fail("岗位不存在", code=404)
        return success(
            {
                "postId": p.post_id,
                "postCode": p.post_code,
                "postName": p.post_name,
                "postSort": p.post_sort,
                "status": p.status,
                "remark": p.remark,
                "createTime": p.create_time.isoformat() if p.create_time else None,
            }
        )


@post_router.put("", summary="修改岗位")
async def update_post(body: dict):
    """对应 Java: PUT /post"""
    postId = body.get("postId")
    if not postId:
        return fail("postId 不能为空", code=400)
    with get_session() as db:
        p = db.query(SysPost).filter(SysPost.post_id == postId).first()
        if not p:
            return fail("岗位不存在", code=404)
        _camel_map = {
            "postCode": "post_code",
            "postName": "post_name",
            "postSort": "post_sort",
            "status": "status",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "postId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(p, attr):
                setattr(p, attr, v)
        db.commit()
        return success({"postId": postId})


@post_router.delete("/{postIds}", summary="删除岗位 (逗号分隔)")
async def delete_posts(postIds: str):  # noqa: 24
    """对应 Java: DELETE /post/{postIds}"""
    ids = [int(x) for x in postIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        n = db.query(SysPost).filter(SysPost.post_id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": ids, "count": n})


# ---------------------------------------------------------------------------
# SysConfig
# ---------------------------------------------------------------------------

config_router = APIRouter(prefix="/config", tags=["System: Config"])


@config_router.get("/list", summary="参数列表")
async def config_list(
    configName: str | None = None,  # noqa: 5
    configKey: str | None = None,  # noqa: 5
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
):
    with get_session() as db:
        q = db.query(SysConfig)
        if configName:
            q = q.filter(SysConfig.config_name.contains(configName))
        if configKey:
            q = q.filter(SysConfig.config_key.contains(configKey))
        items, total = paginate(q, page, size)
        return success(
            {
                "list": [
                    {
                        "configId": c.config_id,
                        "configName": c.config_name,
                        "configKey": c.config_key,
                        "configValue": c.config_value,
                        "configType": c.config_type,
                    }
                    for c in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@config_router.get("/configKey/{configKey}", summary="按 key 取参数")
async def get_config_by_key(configKey: str):  # noqa: 29
    """对应 Java: GET /config/configKey/{configKey}"""
    with get_session() as db:
        c = db.query(SysConfig).filter(SysConfig.config_key == configKey).first()
        if not c:
            return fail("参数不存在", code=404)
        return success(
            {
                "configId": c.config_id,
                "configKey": c.config_key,
                "configValue": c.config_value,
            }
        )


@config_router.get("/{configId}", summary="配置详情")
async def get_config(configId: int):  # noqa: 22
    """对应 Java: GET /config/{configId}"""
    with get_session() as db:
        c = db.query(SysConfig).filter(SysConfig.config_id == configId).first()
        if not c:
            return fail("参数不存在", code=404)
        return success(
            {
                "configId": c.config_id,
                "configName": c.config_name,
                "configKey": c.config_key,
                "configValue": c.config_value,
                "configType": c.config_type,
                "remark": c.remark,
                "createTime": c.create_time.isoformat() if c.create_time else None,
            }
        )


@config_router.post("", summary="新增配置")
async def add_config(body: dict):
    """对应 Java: POST /config"""
    configName = body.get("configName")
    configKey = body.get("configKey")
    if not configName or not configKey:
        return fail("configName 和 configKey 不能为空", code=400)
    with get_session() as db:
        if db.query(SysConfig).filter(SysConfig.config_key == configKey).first():
            return fail("参数键名已存在", code=400)
        c = SysConfig(
            config_name=configName,
            config_key=configKey,
            config_value=body.get("configValue", ""),
            config_type=body.get("configType", "N"),
            remark=body.get("remark", ""),
        )
        db.add(c)
        db.commit()
        return success({"configId": c.config_id, "configKey": configKey})


@config_router.put("", summary="修改配置")
async def update_config(body: dict):
    """对应 Java: PUT /config"""
    configId = body.get("configId")
    if not configId:
        return fail("configId 不能为空", code=400)
    with get_session() as db:
        c = db.query(SysConfig).filter(SysConfig.config_id == configId).first()
        if not c:
            return fail("参数不存在", code=404)
        _camel_map = {
            "configName": "config_name",
            "configKey": "config_key",
            "configValue": "config_value",
            "configType": "config_type",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "configId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(c, attr):
                setattr(c, attr, v)
        db.commit()
        return success({"configId": configId})


@config_router.delete("/{configIds}", summary="删除配置 (逗号分隔)")
async def delete_configs(configIds: str):  # noqa: 26
    """对应 Java: DELETE /config/{configIds}"""
    ids = [int(x) for x in configIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        n = db.query(SysConfig).filter(SysConfig.config_id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": ids, "count": n})


# ---------------------------------------------------------------------------
# SysDictType / SysDictData
# ---------------------------------------------------------------------------

dict_type_router = APIRouter(prefix="/dict/type", tags=["System: Dict Type"])
dict_data_router = APIRouter(prefix="/dict/data", tags=["System: Dict Data"])


@dict_type_router.get("/list", summary="字典类型列表")
async def dict_type_list(dictName: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 26
    with get_session() as db:
        q = db.query(SysDictType)
        if dictName:
            q = q.filter(SysDictType.dict_name.contains(dictName))
        items, total = paginate(q.order_by(SysDictType.dict_id.asc()), page, size)
        return success(
            {
                "list": [
                    {"dictId": d.dict_id, "dictName": d.dict_name, "dictType": d.dict_type, "status": d.status}
                    for d in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@dict_type_router.get("/optionselect", summary="字典类型下拉")
async def dict_type_optionselect():
    with get_session() as db:
        items = db.query(SysDictType).filter(SysDictType.status == "0").all()
        return success([{"value": str(d.dict_type), "label": d.dict_name} for d in items])


@dict_type_router.get("/{dictId}", summary="字典类型详情")
async def get_dict_type(dictId: int):  # noqa: 25
    """对应 Java: GET /dict/type/{dictId}"""
    with get_session() as db:
        d = db.query(SysDictType).filter(SysDictType.dict_id == dictId).first()
        if not d:
            return fail("字典类型不存在", code=404)
        return success(
            {
                "dictId": d.dict_id,
                "dictName": d.dict_name,
                "dictType": d.dict_type,
                "status": d.status,
                "remark": d.remark,
                "createTime": d.create_time.isoformat() if d.create_time else None,
            }
        )


@dict_type_router.put("", summary="修改字典类型")
async def update_dict_type(body: dict):
    """对应 Java: PUT /dict/type"""
    dictId = body.get("dictId")
    if not dictId:
        return fail("dictId 不能为空", code=400)
    with get_session() as db:
        d = db.query(SysDictType).filter(SysDictType.dict_id == dictId).first()
        if not d:
            return fail("字典类型不存在", code=404)
        _camel_map = {"dictName": "dict_name", "dictType": "dict_type", "status": "status", "remark": "remark"}
        for k, v in body.items():
            if k == "dictId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(d, attr):
                setattr(d, attr, v)
        db.commit()
        return success({"dictId": dictId})


@dict_type_router.delete("/{dictIds}", summary="删除字典类型 (逗号分隔)")
async def delete_dict_types(dictIds: str):  # noqa: 29
    """对应 Java: DELETE /dict/type/{dictIds}"""
    ids = [int(x) for x in dictIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        n = db.query(SysDictType).filter(SysDictType.dict_id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": ids, "count": n})


@dict_data_router.get("/list", summary="字典数据列表")
async def dict_data_list(dictType: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 26
    with get_session() as db:
        q = db.query(SysDictData)
        if dictType:
            q = q.filter(SysDictData.dict_type == dictType)
        items, total = paginate(q.order_by(SysDictData.dict_sort.asc()), page, size)
        return success(
            {
                "list": [
                    {
                        "dictCode": d.dict_code,
                        "dictLabel": d.dict_label,
                        "dictValue": d.dict_value,
                        "dictType": d.dict_type,
                        "cssClass": d.css_class,
                        "listClass": d.list_class,
                        "isDefault": d.is_default,
                        "status": d.status,
                    }
                    for d in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@dict_data_router.get("/type/{dictType}", summary="按 type 取字典数据")
async def dict_data_by_type(dictType: str):  # noqa: 29
    """对应 Java: GET /dict/data/type/{dictType}"""
    with get_session() as db:
        items = (
            db.query(SysDictData)
            .filter(SysDictData.dict_type == dictType, SysDictData.status == "0")
            .order_by(SysDictData.dict_sort.asc())
            .all()
        )
        return success(
            [
                {
                    "value": d.dict_value,
                    "label": d.dict_label,
                    "cssClass": d.css_class,
                    "listClass": d.list_class,
                    "isDefault": d.is_default,
                }
                for d in items
            ]
        )


@dict_data_router.post("", summary="新增字典数据")
async def add_dict_data(body: dict):
    """对应 Java: POST /dict/data"""
    dictLabel = body.get("dictLabel")
    dictValue = body.get("dictValue")
    dictType = body.get("dictType")
    if not dictLabel or not dictValue or not dictType:
        return fail("dictLabel、dictValue、dictType 不能为空", code=400)
    with get_session() as db:
        d = SysDictData(
            dict_type=dictType,
            dict_label=dictLabel,
            dict_value=dictValue,
            dict_sort=body.get("dictSort", 0),
            css_class=body.get("cssClass", ""),
            list_class=body.get("listClass", ""),
            is_default=body.get("isDefault", "N"),
            status=body.get("status", "0"),
            remark=body.get("remark", ""),
        )
        db.add(d)
        db.commit()
        return success({"dictCode": d.dict_code})


@dict_data_router.get("/{dictCode}", summary="字典数据详情")
async def get_dict_data(dictCode: int):  # noqa: 25
    """对应 Java: GET /dict/data/{dictCode}"""
    with get_session() as db:
        d = db.query(SysDictData).filter(SysDictData.dict_code == dictCode).first()
        if not d:
            return fail("字典数据不存在", code=404)
        return success(
            {
                "dictCode": d.dict_code,
                "dictLabel": d.dict_label,
                "dictValue": d.dict_value,
                "dictType": d.dict_type,
                "cssClass": d.css_class,
                "listClass": d.list_class,
                "isDefault": d.is_default,
                "dictSort": d.dict_sort,
                "status": d.status,
                "remark": d.remark,
                "createTime": d.create_time.isoformat() if d.create_time else None,
            }
        )


@dict_data_router.put("", summary="修改字典数据")
async def update_dict_data(body: dict):
    """对应 Java: PUT /dict/data"""
    dictCode = body.get("dictCode")
    if not dictCode:
        return fail("dictCode 不能为空", code=400)
    with get_session() as db:
        d = db.query(SysDictData).filter(SysDictData.dict_code == dictCode).first()
        if not d:
            return fail("字典数据不存在", code=404)
        _camel_map = {
            "dictLabel": "dict_label",
            "dictValue": "dict_value",
            "dictType": "dict_type",
            "cssClass": "css_class",
            "listClass": "list_class",
            "isDefault": "is_default",
            "dictSort": "dict_sort",
            "status": "status",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "dictCode":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(d, attr):
                setattr(d, attr, v)
        db.commit()
        return success({"dictCode": dictCode})


@dict_data_router.delete("/{dictCodes}", summary="删除字典数据 (逗号分隔)")
async def delete_dict_data(dictCodes: str):  # noqa: 28
    """对应 Java: DELETE /dict/data/{dictCodes}"""
    ids = [int(x) for x in dictCodes.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        n = db.query(SysDictData).filter(SysDictData.dict_code.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": ids, "count": n})


# ---------------------------------------------------------------------------
# SysLoginInfo
# ---------------------------------------------------------------------------

logininfo_router = APIRouter(prefix="/logininfor", tags=["System: Login Info"])


@logininfo_router.get("/list", summary="登录日志")
async def logininfor_list(userName: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 27
    with get_session() as db:
        q = db.query(SysLoginInfo)
        if userName:
            q = q.filter(SysLoginInfo.user_name.contains(userName))
        items, total = paginate(q.order_by(SysLoginInfo.info_id.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "infoId": i.info_id,
                        "userName": i.user_name,
                        "ipaddr": i.ipaddr,
                        "browser": i.browser,
                        "os": i.os,
                        "status": i.status,
                        "msg": i.msg,
                        "loginTime": i.login_time.isoformat() if i.login_time else None,
                    }
                    for i in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@logininfo_router.delete("/clean", summary="清空登录日志")
async def clean_logininfor():
    with get_session() as db:
        n = db.query(SysLoginInfo).delete()
        db.commit()
        return success({"deleted": n})


@logininfo_router.put("/unlock/{userName}", summary="解锁用户")
async def unlock_user(userName: str):  # noqa: 23
    """对应 Java: PUT /logininfor/unlock/{userName} -- 清失败计数"""
    from app.utils.redis_util import get_redis

    r = get_redis()
    key = f"zhs:login:fail:{userName}"
    try:
        r.delete(key)
    except Exception:
        logger.debug("func")
        pass
    return success({"unlocked": userName})


# ---------------------------------------------------------------------------
# SysNotice
# ---------------------------------------------------------------------------

notice_router = APIRouter(prefix="/notice", tags=["System: Notice"])


@notice_router.get("/list", summary="通知公告列表")
async def notice_list(noticeTitle: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 23
    with get_session() as db:
        q = db.query(SysNotice)
        if noticeTitle:
            q = q.filter(SysNotice.notice_title.contains(noticeTitle))
        items, total = paginate(q.order_by(SysNotice.notice_id.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "noticeId": n.notice_id,
                        "noticeTitle": n.notice_title,
                        "noticeType": n.notice_type,
                        "status": n.status,
                        "createBy": n.create_by,
                        "createTime": n.create_time.isoformat() if n.create_time else None,
                    }
                    for n in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@notice_router.get("/{noticeId}", summary="公告详情")
async def get_notice(noticeId: int):  # noqa: 22
    """对应 Java: GET /notice/{noticeId}"""
    with get_session() as db:
        n = db.query(SysNotice).filter(SysNotice.notice_id == noticeId).first()
        if not n:
            return fail("公告不存在", code=404)
        return success(
            {
                "noticeId": n.notice_id,
                "noticeTitle": n.notice_title,
                "noticeType": n.notice_type,
                "noticeContent": n.notice_content,
                "status": n.status,
                "createBy": n.create_by,
                "createTime": n.create_time.isoformat() if n.create_time else None,
                "remark": n.remark,
            }
        )


@notice_router.post("", summary="新增公告")
async def add_notice(body: dict):
    """对应 Java: POST /notice"""
    noticeTitle = body.get("noticeTitle")
    noticeType = body.get("noticeType")
    if not noticeTitle or not noticeType:
        return fail("noticeTitle 和 noticeType 不能为空", code=400)
    with get_session() as db:
        n = SysNotice(
            notice_title=noticeTitle,
            notice_type=noticeType,
            notice_content=body.get("noticeContent", ""),
            status=body.get("status", "0"),
            create_by=body.get("createBy", ""),
            remark=body.get("remark", ""),
        )
        db.add(n)
        db.commit()
        return success({"noticeId": n.notice_id})


@notice_router.put("", summary="修改公告")
async def update_notice(body: dict):
    """对应 Java: PUT /notice"""
    noticeId = body.get("noticeId")
    if not noticeId:
        return fail("noticeId 不能为空", code=400)
    with get_session() as db:
        n = db.query(SysNotice).filter(SysNotice.notice_id == noticeId).first()
        if not n:
            return fail("公告不存在", code=404)
        _camel_map = {
            "noticeTitle": "notice_title",
            "noticeType": "notice_type",
            "noticeContent": "notice_content",
            "status": "status",
            "createBy": "create_by",
            "remark": "remark",
        }
        for k, v in body.items():
            if k == "noticeId":
                continue
            attr = _camel_map.get(k, k)
            if hasattr(n, attr):
                setattr(n, attr, v)
        db.commit()
        return success({"noticeId": noticeId})


@notice_router.delete("/{noticeIds}", summary="删除公告 (逗号分隔)")
async def delete_notices(noticeIds: str):  # noqa: 26
    """对应 Java: DELETE /notice/{noticeIds}"""
    ids = [int(x) for x in noticeIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)
    with get_session() as db:
        n = db.query(SysNotice).filter(SysNotice.notice_id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": ids, "count": n})


# ---------------------------------------------------------------------------
# SysJob / SysJobLog
# ---------------------------------------------------------------------------

job_router = APIRouter(prefix="/job", tags=["System: Job"])
job_log_router = APIRouter(prefix="/job/log", tags=["System: Job Log"])


# --- invoke_target -> callable 映射 (延迟导入避免循环) ---
_TASK_REGISTRY: dict[str, callable] = {}


def _build_task_registry() -> dict[str, callable]:
    """构建 invoke_target -> callable 映射."""
    if _TASK_REGISTRY:
        return _TASK_REGISTRY
    from app.services.heat_stats_service import aggregate_heat_stats
    from app.tasks.agent_sync import sync_agent_counters
    from app.tasks.expiration_monitor import expire_agents
    from app.tasks.heat_stats_task import aggregate_daily_heat, cleanup_old_heat

    _TASK_REGISTRY.update(
        {
            "aggregate_heat_stats": aggregate_heat_stats,
            "aggregate_daily_heat": aggregate_daily_heat,
            "cleanup_old_heat": cleanup_old_heat,
            "sync_agent_counters": sync_agent_counters,
            "expire_agents": expire_agents,
            "task_update_heat_stats": aggregate_heat_stats,
            "task_aggregate_daily_heat": aggregate_daily_heat,
            "task_cleanup_old_heat": cleanup_old_heat,
            "task_sync_agents": sync_agent_counters,
            "task_sync_agent_counters": sync_agent_counters,
            "task_expire_agents": expire_agents,
        }
    )
    return _TASK_REGISTRY


def _get_scheduler():
    """获取全局 APScheduler 实例."""
    from app.tasks.scheduler import scheduler

    return scheduler


def _sync_job_to_scheduler(db_job: SysJob) -> bool:
    """将 DB 中的任务同步到 APScheduler (add/update/pause)."""
    scheduler = _get_scheduler()
    job_id_str = str(db_job.job_id)
    status = db_job.status or "0"
    cron_expr = (db_job.cron_expression or "").strip()

    # 暂停状态: 只暂停已有 job
    if status == "1":
        existing = scheduler.get_job(job_id_str)
        if existing:
            existing.pause()
        return True

    if not cron_expr:
        return False

    registry = _build_task_registry()
    invoke_target = (db_job.invoke_target or "").strip()
    func = registry.get(invoke_target)

    if func is None:
        logger.warning(f"Job {db_job.job_id} invoke_target={invoke_target} not in registry, skip scheduler sync")
        return False

    # 解析 cron: 支持 6 段 (秒 分 时 日 月 周) 或 5 段 (分 时 日 月 周)
    parts = cron_expr.split()
    try:
        if len(parts) == 6:
            scheduler.add_job(
                func,
                "cron",
                second=parts[0],
                minute=parts[1],
                hour=parts[2],
                day=parts[3],
                month=parts[4],
                day_of_week=parts[5],
                id=job_id_str,
                replace_existing=True,
            )
        elif len(parts) == 5:
            scheduler.add_job(
                func,
                "cron",
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                id=job_id_str,
                replace_existing=True,
            )
        else:
            logger.warning(f"Job {db_job.job_id} invalid cron: {cron_expr}")
            return False

        # 若之前被暂停,恢复
        existing = scheduler.get_job(job_id_str)
        if existing and existing.next_run_time is None:
            existing.resume()
        return True
    except Exception as e:
        logger.error(f"Job {db_job.job_id} scheduler sync error: {e}")
        return False


async def _run_job_now(invoke_target: str) -> dict:
    """立即执行一次任务函数."""
    registry = _build_task_registry()
    func = registry.get(invoke_target.strip())
    if func is None:
        return {"ok": False, "error": f"invoke_target '{invoke_target}' not in registry"}
    try:
        import asyncio

        if asyncio.iscoroutinefunction(func):
            result = await func()
        else:
            result = func()
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@job_router.get("/list", summary="定时任务列表")
async def job_list(jobName: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 20
    with get_session() as db:
        q = db.query(SysJob)
        if jobName:
            q = q.filter(SysJob.job_name.contains(jobName))
        items, total = paginate(q, page, size)
        return success(
            {
                "list": [
                    {
                        "jobId": j.job_id,
                        "jobName": j.job_name,
                        "jobGroup": j.job_group,
                        "invokeTarget": j.invoke_target,
                        "cronExpression": j.cron_expression,
                        "misfirePolicy": j.misfire_policy,
                        "concurrent": j.concurrent,
                        "status": j.status,
                        "remark": j.remark,
                        "createTime": j.create_time.isoformat() if j.create_time else None,
                    }
                    for j in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@job_router.get("/{jobId}", summary="任务详情")
async def get_job(jobId: int):  # noqa: 19
    """对应 Java: GET /job/{jobId}"""
    with get_session() as db:
        j = db.query(SysJob).filter(SysJob.job_id == jobId).first()
        if not j:
            return fail("任务不存在", code=404)
        return success(
            {
                "jobId": j.job_id,
                "jobName": j.job_name,
                "jobGroup": j.job_group,
                "invokeTarget": j.invoke_target,
                "cronExpression": j.cron_expression,
                "misfirePolicy": j.misfire_policy,
                "concurrent": j.concurrent,
                "status": j.status,
                "remark": j.remark,
                "createBy": j.create_by,
                "createTime": j.create_time.isoformat() if j.create_time else None,
                "updateBy": j.update_by,
                "updateTime": j.update_time.isoformat() if j.update_time else None,
            }
        )


class JobCreateReq(BaseModel):
    jobName: str  # noqa: 5
    jobGroup: str = "DEFAULT"  # noqa: 5
    invokeTarget: str  # noqa: 5
    cronExpression: str  # noqa: 5
    misfirePolicy: str = "3"  # noqa: 5
    concurrent: str = "1"
    status: str = "0"
    remark: str = ""


@job_router.post("", summary="新增定时任务")
async def add_job(body: JobCreateReq):
    """对应 Java: POST /job -- 写 DB + 动态注册到 APScheduler."""
    with get_session() as db:
        job = SysJob(
            job_name=body.jobName,
            job_group=body.jobGroup,
            invoke_target=body.invokeTarget,
            cron_expression=body.cronExpression,
            misfire_policy=body.misfirePolicy,
            concurrent=body.concurrent,
            status=body.status,
            remark=body.remark,
            create_by="admin",
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # 同步到 APScheduler
        _sync_job_to_scheduler(job)

        return success({"jobId": job.job_id})


class JobUpdateReq(BaseModel):
    jobId: int  # noqa: 5
    jobName: str | None = None  # noqa: 5
    jobGroup: str | None = None  # noqa: 5
    invokeTarget: str | None = None  # noqa: 5
    cronExpression: str | None = None  # noqa: 5
    misfirePolicy: str | None = None  # noqa: 5
    concurrent: str | None = None
    status: str | None = None
    remark: str | None = None


@job_router.put("", summary="修改定时任务")
async def update_job(body: JobUpdateReq):
    """对应 Java: PUT /job -- 更新 DB + 重新调度 APScheduler."""
    with get_session() as db:
        job = db.query(SysJob).filter(SysJob.job_id == body.jobId).first()
        if not job:
            return fail("任务不存在", code=404)
        for field, attr in [
            ("jobName", "job_name"),
            ("jobGroup", "job_group"),
            ("invokeTarget", "invoke_target"),
            ("cronExpression", "cron_expression"),
            ("misfirePolicy", "misfire_policy"),
            ("concurrent", "concurrent"),
            ("status", "status"),
            ("remark", "remark"),
        ]:
            val = getattr(body, field, None)
            if val is not None:
                setattr(job, attr, val)
        job.update_by = "admin"
        db.commit()
        db.refresh(job)

        # 同步到 APScheduler
        _sync_job_to_scheduler(job)

        return success({"jobId": job.job_id})


class JobStatusReq(BaseModel):
    jobId: int  # noqa: 5
    status: str  # "0"=运行  "1"=暂停


@job_router.put("/changeStatus", summary="暂停/恢复任务")
async def change_job_status(body: JobStatusReq):
    """对应 Java: PUT /job/changeStatus"""
    with get_session() as db:
        job = db.query(SysJob).filter(SysJob.job_id == body.jobId).first()
        if not job:
            return fail("任务不存在", code=404)
        job.status = body.status
        db.commit()
        db.refresh(job)

        scheduler = _get_scheduler()
        job_id_str = str(job.job_id)
        ap_job = scheduler.get_job(job_id_str)

        if body.status == "1" and ap_job:
            ap_job.pause()
        elif body.status == "0":
            if ap_job:
                ap_job.resume()
            else:
                _sync_job_to_scheduler(job)

        return success({"jobId": job.job_id, "status": body.status})


class JobRunReq(BaseModel):
    jobId: int  # noqa: 5
    jobGroup: str = "DEFAULT"  # noqa: 5


@job_router.put("/run", summary="立即执行一次任务")
async def run_job_once(body: JobRunReq):
    """对应 Java: PUT /job/run -- 从 DB 取 invoke_target,立即调用一次."""
    with get_session() as db:
        job = db.query(SysJob).filter(SysJob.job_id == body.jobId).first()
        if not job:
            return fail("任务不存在", code=404)

        invoke_target = job.invoke_target or ""
        result = await _run_job_now(invoke_target)

        # 记录日志
        log = SysJobLog(
            job_name=job.job_name,
            job_group=job.job_group,
            invoke_target=invoke_target,
            status="1" if result.get("ok") else "0",
            error_message=result.get("error", ""),
            exception_info=result.get("error", ""),
        )
        db.add(log)
        db.commit()

        if result.get("ok"):
            return success({"jobId": job.job_id, "executed": True})
        else:
            return fail(f"执行失败: {result.get('error', 'unknown')}", code=500)


@job_router.delete("/{jobIds}", summary="删除定时任务 (逗号分隔)")
async def delete_jobs(jobIds: str):  # noqa: 23
    """对应 Java: DELETE /job/{jobIds}"""
    ids = [int(x) for x in jobIds.split(",") if x.isdigit()]
    if not ids:
        return fail("参数错误", code=400)

    scheduler = _get_scheduler()
    with get_session() as db:
        for jid in ids:
            ap_job = scheduler.get_job(str(jid))
            if ap_job:
                scheduler.remove_job(str(jid))
        deleted = db.query(SysJob).filter(SysJob.job_id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return success({"deleted": deleted, "jobIds": ids})


@job_log_router.get("/list", summary="任务执行日志")
async def job_log_list(jobName: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, le=100)):  # noqa: 24
    with get_session() as db:
        q = db.query(SysJobLog)
        if jobName:
            q = q.filter(SysJobLog.job_name.contains(jobName))
        items, total = paginate(q.order_by(SysJobLog.create_time.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "jobLogId": j.job_log_id,
                        "jobName": j.job_name,
                        "jobGroup": j.job_group,
                        "invokeTarget": j.invoke_target,
                        "status": j.status,
                        "exceptionInfo": j.exception_info,
                        "errorMessage": j.error_message,
                        "startTime": j.start_time.isoformat() if j.start_time else None,
                        "stopTime": j.stop_time.isoformat() if j.stop_time else None,
                        "createTime": j.create_time.isoformat() if j.create_time else None,
                    }
                    for j in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


@job_log_router.delete("/clean", summary="清空任务日志")
async def clean_job_log():
    """对应 Java: DELETE /job/log/clean"""
    with get_session() as db:
        n = db.query(SysJobLog).delete()
        db.commit()
        return success({"deleted": n})


# ---------------------------------------------------------------------------
# SysUserOnline -- 在线用户监控 (基于 Redis 会话)
# ---------------------------------------------------------------------------

online_router = APIRouter(prefix="/online", tags=["System: Online"])

# Redis key 前缀 -- 存储在线用户会话
# 登录时需写入: SET zhs:online:user:{tokenId} <json> EX {ttl}
_ONLINE_KEY_PREFIX = "zhs:online:user:"


@online_router.get("/list", summary="在线用户列表")
async def online_user_list(
    ipaddr: str | None = None,
    userName: str | None = None,  # noqa: 5
    page: int = Query(1, ge=1),
    size: int = Query(20, le=100),
):
    """对应 Java: GET /online/list -- 从 Redis SCAN 扫描所有在线会话.

    会话 JSON 结构:
      { tokenId, userId, userName, deptName, ipaddr, browser, os,
        loginTime, tokenExpire }
    """
    from app.utils.redis_util import get_redis

    try:
        r = get_redis()
        cursor = 0
        all_keys = []
        pattern = _ONLINE_KEY_PREFIX + "*"
        while True:
            cursor, keys = r.scan(cursor=cursor, match=pattern, count=200)
            all_keys.extend(keys)
            if cursor == 0:
                break
    except Exception as e:
        logger.warning(f"Redis scan online users failed: {e}")
        all_keys = []

    records = []
    for key in all_keys:
        try:
            raw = r.get(key)
            if not raw:
                continue
            info = json.loads(raw)
            if ipaddr and info.get("ipaddr", "") != ipaddr:
                continue
            if userName and userName not in (info.get("userName", "") or ""):
                continue
            records.append(info)
        except Exception:
            continue

    total = len(records)
    start = (page - 1) * size
    items = records[start : start + size]
    return success(
        {
            "list": items,
            "total": total,
            "page": page,
            "size": size,
        }
    )


@online_router.delete("/{tokenId}", summary="强制下线")
async def force_logout(tokenId: str):  # noqa: 24
    """对应 Java: DELETE /online/{tokenId} -- 删除 Redis 中的会话记录.

    会话删除后,该用户的后续请求因 JWT 无法在 Redis 中匹配而被拒绝.
    """
    from app.utils.redis_util import get_redis

    try:
        r = get_redis()
        key = _ONLINE_KEY_PREFIX + tokenId
        existed = r.delete(key)
        if existed:
            return success({"tokenId": tokenId, "forced": True})
        else:
            return fail("会话不存在或已过期", code=404)
    except Exception as e:
        logger.error(f"Force logout error: {e}")
        return fail(f"强制下线失败: {e}", code=500)


# ---------------------------------------------------------------------------
# 整合入口
# ---------------------------------------------------------------------------


def register_routers(parent):
    parent.include_router(user_router)
    parent.include_router(role_router)
    parent.include_router(menu_router)
    parent.include_router(dept_router)
    parent.include_router(post_router)
    parent.include_router(config_router)
    parent.include_router(dict_type_router)
    parent.include_router(dict_data_router)
    parent.include_router(logininfo_router)
    parent.include_router(notice_router)
    parent.include_router(job_router)
    parent.include_router(job_log_router)
    parent.include_router(online_router)
    try:
        from app.api.v1.admin.exam.routes import router as exam_router
        parent.include_router(exam_router)
    except Exception as exc:  # pragma: no cover - optional admin exam module
        raise ImportError("admin exam router is required for exam management pages") from exc