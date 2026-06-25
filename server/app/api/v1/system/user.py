"""System user management routes (Admin admin)."""

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import (
    create_access_token,
    hash_password,
    require_login,
    verify_password,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_sys_user_id(user_uuid: str) -> int | None:
    """从 token 的 sub (格式 'sys:{user_id}') 提取 sys_user.user_id."""
    if user_uuid.startswith("sys:"):
        try:
            return int(user_uuid.split(":", 1)[1])
        except (ValueError, IndexError):
            return None
    # fallback: 按 user_uuid 字段查
    from app.models.sys_models import SysUser

    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
        return u.user_id if u else None


@router.post("/login", summary="Admin login")
def admin_login(username: str = Query(...), password: str = Query(...)):
    with get_session() as db:
        from app.models.sys_models import SysUser

        user = db.query(SysUser).filter(SysUser.user_name == username, SysUser.del_flag == "0").first()
        if not user or not verify_password(password, user.password or ""):
            return error("Invalid credentials", "401")
        token = create_access_token(subject=f"sys:{user.user_id}", extra_claims={"role": "admin"})
        return success({"access_token": token, "token_type": "Bearer"})


@router.get("/user/list", summary="List system users")
def list_sys_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.sys_models import SysUser

        q = db.query(SysUser).filter(SysUser.del_flag == "0")
        total = q.count()
        users = q.offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "userId": u.user_id,
                "userName": u.user_name,
                "nickName": u.nick_name,
                "phonenumber": u.phonenumber,
                "status": u.status,
            }
            for u in users
        ]
        return success(data, total=total)


# ---------------------------------------------------------------------------
# Excel export
# ---------------------------------------------------------------------------

_USER_EXPORT_COLUMNS = [
    {"header": "用户ID", "field": "user_id", "type": "int", "width": 10},
    {"header": "用户名", "field": "user_name", "type": "str", "width": 18},
    {"header": "昵称", "field": "nick_name", "type": "str", "width": 18},
    {"header": "邮箱", "field": "email", "type": "str", "width": 24},
    {"header": "手机号", "field": "phone", "type": "str", "width": 16},
    {"header": "状态", "field": "status", "type": "str", "width": 10},
    {"header": "部门ID", "field": "dept_id", "type": "int", "width": 10},
    {"header": "创建时间", "field": "create_time", "type": "date", "width": 22},
]


@router.get("/user/export", summary="导出用户列表到Excel")
def export_users(user_uuid: str = Depends(require_login)):
    from app.utils.excel_util import export_to_excel

    with get_session() as db:
        from app.models.sys_models import SysUser

        users = db.query(SysUser).filter(SysUser.del_flag == "0").all()
        data = [
            {
                "user_id": u.user_id,
                "user_name": u.user_name,
                "nick_name": u.nick_name,
                "email": u.email or "",
                "phone": u.phone or "",
                "status": "正常" if u.status == "0" else "停用",
                "dept_id": u.dept_id,
                "create_time": u.create_time,
            }
            for u in users
        ]
        buf = export_to_excel(data, _USER_EXPORT_COLUMNS, filename="用户数据.xlsx")
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=users.xlsx"},
        )


# ---------------------------------------------------------------------------
# 用户 CRUD (create / read / update / delete)
# 路径兼容 RuoYi 前端: POST/PUT/DELETE/GET /user
# ---------------------------------------------------------------------------


@router.post("/user", summary="创建用户")
def create_user(
    userName: str = Body(...),
    password: str = Body(...),
    nickName: str = Body(...),
    email: str = Body(None),
    phone: str = Body(None),
    sex: str = Body("0"),
    dept_id: int = Body(None),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    with get_session() as db:
        try:
            if (
                db.query(SysUser)
                .filter(SysUser.user_name == userName, SysUser.del_flag != "2")
                .first()
            ):
                return error(f"账号 {userName} 已存在", "500")
            import uuid as _uuid
            u = SysUser(
                user_name=userName,
                nick_name=nickName,
                password=hash_password(password),
                email=email,
                phone=phone,
                sex=sex or "0",
                dept_id=dept_id,
                user_uuid=str(_uuid.uuid4()),
                status="0",
                del_flag="0",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            return success({"userId": u.user_id, "userName": u.user_name})
        except Exception as e:
            logger.error(f"create user error: {e}")
            db.rollback()
            return error(f"创建失败: {e}", "500")


@router.get("/user/{user_id}", summary="获取单个用户")
def get_user(
    user_id: int,
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
        if not u:
            return error("用户不存在", "404")
        return success(
            {
                "userId": u.user_id,
                "userName": u.user_name,
                "nickName": u.nick_name,
                "email": u.email or "",
                "phone": u.phone or "",
                "sex": u.sex or "0",
                "deptId": u.dept_id,
                "status": u.status or "0",
            }
        )


@router.put("/user/{user_id}", summary="更新用户")
def update_user(
    user_id: int,
    nickName: str = Body(None),
    email: str = Body(None),
    phone: str = Body(None),
    sex: str = Body(None),
    dept_id: int = Body(None),
    status: str = Body(None),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    with get_session() as db:
        try:
            u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
            if not u:
                return error("用户不存在", "404")
            if nickName is not None:
                u.nick_name = nickName
            if email is not None:
                u.email = email
            if phone is not None:
                u.phone = phone
            if sex is not None:
                u.sex = sex
            if dept_id is not None:
                u.dept_id = dept_id
            if status is not None:
                u.status = status
            db.commit()
            return success({"userId": user_id})
        except Exception as e:
            logger.error(f"update user error: {e}")
            db.rollback()
            return error(f"更新失败: {e}", "500")


@router.delete("/user/{user_id}", summary="删除用户 (软删除)")
def delete_user(
    user_id: int,
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    with get_session() as db:
        try:
            u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
            if not u:
                return error("用户不存在", "404")
            u.del_flag = "2"
            db.commit()
            return success({"userId": user_id})
        except Exception as e:
            logger.error(f"delete user error: {e}")
            db.rollback()
            return error(f"删除失败: {e}", "500")


@router.get("/user/authRole/{user_id}", summary="获取用户及角色信息")
def get_user_auth_role(
    user_id: int,
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    with get_session() as db:
        u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
        if not u:
            return error("用户不存在", "404")
        roles = (
            db.query(SysRole.role_id, SysRole.role_name, SysRole.role_key)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .filter(SysUserRole.user_id == user_id)
            .all()
        )
        return success(
            {
                "user": {
                    "userId": u.user_id,
                    "userName": u.user_name,
                    "nickName": u.nick_name,
                },
                "roles": [
                    {"roleId": r[0], "roleName": r[1], "roleKey": r[2]} for r in roles
                ],
            }
        )


@router.get("/user/deptTree", summary="部门树 (兼容)")
def get_dept_tree_for_user(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysDept

    with get_session() as db:
        depts = (
            db.query(SysDept)
            .filter(SysDept.del_flag == "0", SysDept.status == "0")
            .order_by(SysDept.dept_id)
            .all()
        )
        nodes = [
            {"id": d.dept_id, "label": d.dept_name, "parentId": d.parent_id}
            for d in depts
        ]
        node_dict = {n["id"]: {**n, "children": []} for n in nodes}
        tree = []
        for n in nodes:
            if n["parentId"] == 0 or n["parentId"] not in node_dict:
                tree.append(node_dict[n["id"]])
            else:
                node_dict[n["parentId"]]["children"].append(node_dict[n["id"]])
        return success(tree)


# ---------------------------------------------------------------------------
# 1. PUT /resetPwd - 管理员重置密码
# ---------------------------------------------------------------------------


@router.put("/resetPwd", summary="管理员重置用户密码")
def reset_user_pwd(
    user_id: int = Query(..., description="目标用户 ID"),
    new_password: str = Query(..., description="新密码"),
    user_uuid: str = Depends(require_login),
):
    """管理员无需旧密码即可重置指定用户的登录密码."""
    from app.models.sys_models import SysUser

    if len(new_password) < 5:
        return error("密码长度不能少于5个字符", "400")

    with get_session() as db:
        try:
            user = db.query(SysUser).filter(SysUser.user_id == user_id, SysUser.del_flag == "0").first()
            if not user:
                return error("用户不存在", "404")
            user.password = hash_password(new_password)
            db.commit()
            return success({"user_id": user_id, "msg": "密码重置成功"})
        except Exception as e:
            logger.error(f"resetPwd error: {e}")
            return error("密码重置失败", "500")


# ---------------------------------------------------------------------------
# 2. PUT /changeStatus - 启用/禁用用户
# ---------------------------------------------------------------------------


@router.put("/changeStatus", summary="启用 / 禁用用户")
def change_user_status(
    user_id: int = Query(..., description="目标用户 ID"),
    status: str = Query(..., description="0=正常 1=停用"),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    if status not in ("0", "1"):
        return error("status 只能为 0(正常) 或 1(停用)", "400")

    with get_session() as db:
        try:
            user = db.query(SysUser).filter(SysUser.user_id == user_id, SysUser.del_flag == "0").first()
            if not user:
                return error("用户不存在", "404")
            user.status = status
            db.commit()
            return success({"user_id": user_id, "status": status})
        except Exception as e:
            logger.error(f"changeStatus error: {e}")
            return error("状态更新失败", "500")


# ---------------------------------------------------------------------------
# 3. GET /getInfo - 从 token 动态获取真实用户信息(角色 + 权限)
# ---------------------------------------------------------------------------


@router.get("/getInfo", summary="获取当前登录用户信息(含角色与权限)")
def get_login_user_info(user_uuid: str = Depends(require_login)):
    """替代前端 mock,从数据库实时查询当前用户的角色和权限."""

    from app.models.sys_models import (
        SysDept,
        SysMenu,
        SysRole,
        SysRoleMenu,
        SysUser,
        SysUserRole,
    )

    sys_user_id = _get_sys_user_id(user_uuid)

    with get_session() as db:
        # 查 admin_user
        if sys_user_id:
            user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
        else:
            user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
        if not user:
            return error("用户不存在", "404")

        # 角色列表
        roles = (
            db.query(SysRole)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .filter(SysUserRole.user_id == user.user_id)
            .all()
        )
        role_keys = [r.role_key for r in roles] or ["default"]
        role_names = [r.role_name for r in roles]

        # 权限集合 (通过 admin_role_menu -> admin_menu.perms)
        perm_rows = (
            db.query(SysMenu.perms)
            .join(SysRoleMenu, SysMenu.menu_id == SysRoleMenu.menu_id)
            .join(SysUserRole, SysRoleMenu.role_id == SysUserRole.role_id)
            .filter(
                SysUserRole.user_id == user.user_id,
                SysMenu.status == "0",
                SysMenu.perms.isnot(None),
                SysMenu.perms != "",
            )
            .distinct()
            .all()
        )
        permissions = list({p[0] for p in perm_rows})

        # 部门
        dept_name = ""
        if user.dept_id:
            dept = db.query(SysDept).filter(SysDept.dept_id == user.dept_id).first()
            if dept:
                dept_name = dept.dept_name

        return success(
            {
                "user_id": user.user_id,
                "user_name": user.user_name,
                "nick_name": user.nick_name,
                "email": user.email or "",
                "phone": user.phone or "",
                "sex": user.sex or "0",
                "avatar": user.avatar or "",
                "status": user.status,
                "dept_id": user.dept_id,
                "dept_name": dept_name,
                "roles": role_keys,
                "role_names": role_names,
                "permissions": permissions,
            }
        )


@router.get("/user/getInfo", summary="获取当前登录用户信息 (别名)")
async def get_login_user_info_alias(user_uuid: str = Depends(require_login)):
    """前端调用 /system/user/getInfo 的别名,复用 /getInfo 逻辑."""
    return await get_login_user_info(user_uuid)


# ---------------------------------------------------------------------------
# 4. GET /user/profile - 个人信息
# ---------------------------------------------------------------------------


@router.get("/user/profile", summary="获取个人详细资料")
def get_user_profile(user_uuid: str = Depends(require_login)):
    from sqlalchemy import text

    from app.models.sys_models import SysRole, SysUser, SysUserRole

    sys_user_id = _get_sys_user_id(user_uuid)

    with get_session() as db:
        if sys_user_id:
            user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
        else:
            user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
        if not user:
            return error("用户不存在", "404")

        # 角色
        roles = (
            db.query(SysRole.role_name, SysRole.role_key)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .filter(SysUserRole.user_id == user.user_id)
            .all()
        )

        # 岗位
        post_rows = db.execute(
            text(
                "SELECT p.post_code, p.post_name FROM admin_post p "
                "INNER JOIN admin_user_post up ON p.post_id = up.post_id "
                "WHERE up.user_id = :uid"
            ),
            {"uid": user.user_id},
        ).fetchall()

        return success(
            {
                "user_id": user.user_id,
                "user_name": user.user_name,
                "nick_name": user.nick_name,
                "email": user.email or "",
                "phone": user.phone or "",
                "sex": user.sex or "0",
                "avatar": user.avatar or "",
                "dept_id": user.dept_id,
                "remark": user.remark or "",
                "roles": [{"role_name": r.role_name, "role_key": r.role_key} for r in roles],
                "posts": [{"post_code": p[0], "post_name": p[1]} for p in post_rows],
            }
        )


# ---------------------------------------------------------------------------
# 5. PUT /user/profile - 修改个人信息
# ---------------------------------------------------------------------------


@router.put("/user/profile", summary="修改个人信息")
def update_user_profile(
    nick_name: str = Body(None),
    email: str = Body(None),
    phone: str = Body(None),
    sex: str = Body(None, description="0=男 1=女 2=未知"),
    remark: str = Body(None),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser

    sys_user_id = _get_sys_user_id(user_uuid)

    with get_session() as db:
        try:
            if sys_user_id:
                user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
            else:
                user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
            if not user:
                return error("用户不存在", "404")

            if nick_name is not None:
                user.nick_name = nick_name
            if email is not None:
                user.email = email
            if phone is not None:
                user.phone = phone
            if sex is not None:
                user.sex = sex
            if remark is not None:
                user.remark = remark

            db.commit()
            return success({"user_id": user.user_id, "msg": "修改成功"})
        except Exception as e:
            logger.error(f"update profile error: {e}")
            return error("修改失败", "500")


# ---------------------------------------------------------------------------
# 6. PUT /user/profile/updatePwd - 修改个人密码
# ---------------------------------------------------------------------------


@router.put("/user/profile/updatePwd", summary="修改个人密码")
def update_own_password(
    old_password: str = Body(...),
    new_password: str = Body(...),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser
    from app.utils.password_strength import password_is_obviously_weak

    if len(new_password) < 5:
        return error("密码长度不能少于5个字符", "400")

    sys_user_id = _get_sys_user_id(user_uuid)

    with get_session() as db:
        try:
            if sys_user_id:
                user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
            else:
                user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
            if not user:
                return error("用户不存在", "404")

            if not user.password or not verify_password(old_password, user.password):
                return error("旧密码错误", "400")

            # --- Bug-23-续: 弱密码模糊匹配 (含用户名/手机/邮箱片段) ---
            is_weak, reasons = password_is_obviously_weak(
                new_password,
                username=getattr(user, "user_name", None),
                phone=getattr(user, "phonenumber", None),
                email=getattr(user, "email", None),
            )
            if is_weak:
                return error("; ".join(reasons), "400")
            # --- end Bug-23-续 ---

            user.password = hash_password(new_password)
            db.commit()
            return success({"msg": "密码修改成功"})
        except Exception as e:
            logger.error(f"updatePwd error: {e}")
            return error("密码修改失败", "500")


# ---------------------------------------------------------------------------
# 7. POST /user/profile/avatar - 头像上传
# ---------------------------------------------------------------------------


@router.post("/user/profile/avatar", summary="上传头像")
async def upload_avatar(
    file: UploadFile = File(...),
    user_uuid: str = Depends(require_login),
):
    from app.models.sys_models import SysUser
    from app.utils.minio_util import upload_file

    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        return error("只允许 JPEG/PNG/GIF/WebP 格式图片", "400")

    file_data = await file.read()
    if len(file_data) > 5 * 1024 * 1024:
        return error("文件大小不能超过 5MB", "400")

    try:
        avatar_url = upload_file(
            file_data=file_data,
            file_name=file.filename or "avatar.jpg",
            content_type=file.content_type,
        )
    except Exception as e:
        logger.error(f"Avatar upload error: {e}")
        return error("头像上传失败", "500")

    sys_user_id = _get_sys_user_id(user_uuid)

    import asyncio

    def _save_avatar():
        try:
            with get_session() as db:
                if sys_user_id:
                    user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
                else:
                    user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
                if not user:
                    return None
                user.avatar = avatar_url
                return True
        except Exception as e:
            logger.error(f"Avatar save error: {e}")
            return False

    result = await asyncio.to_thread(_save_avatar)
    if result is None:
        return error("用户不存在", "404")
    if result is False:
        return error("头像保存失败", "500")
    return success({"imgUrl": avatar_url})


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------


@router.get("/role/list", summary="List roles")
def list_roles(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.sys_models import SysRole

        roles = db.query(SysRole).filter(SysRole.del_flag == "0").all()
        data = [{"role_id": r.role_id, "role_name": r.role_name, "role_key": r.role_key} for r in roles]
        return success(data)


@router.get("/menu/list", summary="List menus")
def list_menus(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.sys_models import SysMenu

        menus = db.query(SysMenu).order_by(SysMenu.order_num).limit(500).all()
        data = [
            {
                "menu_id": m.menu_id,
                "menu_name": m.menu_name,
                "parent_id": m.parent_id,
                "perms": m.perms,
                "menu_type": m.menu_type,
                "icon": m.icon,
            }
            for m in menus
        ]
        return success(data)


@router.get("/menu/getRouters", summary="获取路由菜单树 (Admin 兼容)")
def get_routers(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysMenu

    with get_session() as db:
        menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
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
            if node["parentId"] == 0:
                tree.append(node)
            elif node["parentId"] in menu_dict:
                menu_dict[node["parentId"]]["children"].append(node)
        return success(tree)


@router.get("/menu/treeselect", summary="菜单树选择")
def menu_treeselect(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysMenu

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


@router.get("/dept/list", summary="部门列表")
def list_depts(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysDept

    with get_session() as db:
        items = db.query(SysDept).filter(SysDept.del_flag == "0").all()
        return success(
            [
                {
                    "dept_id": d.dept_id,
                    "dept_name": d.dept_name,
                    "parent_id": d.parent_id,
                    "leader": d.leader,
                    "order_num": d.order_num,
                    "status": d.status,
                }
                for d in items
            ]
        )


@router.get("/post/list", summary="岗位列表")
def list_posts(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysPost

    with get_session() as db:
        items = db.query(SysPost).limit(500).all()
        return success(
            [
                {
                    "post_id": p.post_id,
                    "post_code": p.post_code,
                    "post_name": p.post_name,
                    "post_sort": p.post_sort,
                    "status": p.status,
                }
                for p in items
            ]
        )


@router.get("/dict/type/list", summary="字典类型列表")
def list_dict_types(user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysDictType

    with get_session() as db:
        items = db.query(SysDictType).limit(500).all()
        return success(
            [
                {"dict_id": t.dict_id, "dict_name": t.dict_name, "dict_type": t.dict_type, "status": t.status}
                for t in items
            ]
        )


@router.get("/dict/data/list", summary="字典数据列表")
def list_dict_data(dict_type: str = Query(...), user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysDictData

    with get_session() as db:
        items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
        return success(
            [
                {
                    "dict_code": d.dict_code,
                    "dict_label": d.dict_label,
                    "dict_value": d.dict_value,
                    "dict_type": d.dict_type,
                    "status": d.status,
                }
                for d in items
            ]
        )


@router.get("/dict/data/type/{dict_type}", summary="按字典类型获取数据")
def get_dict_data_by_type(dict_type: str, user_uuid: str = Depends(require_login)):
    from app.models.sys_models import SysDictData

    with get_session() as db:
        items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
        return success(
            [
                {
                    "dict_code": d.dict_code,
                    "dict_label": d.dict_label,
                    "dict_value": d.dict_value,
                    "dict_type": d.dict_type,
                    "status": d.status,
                }
                for d in items
            ]
        )


@router.get("/config/list", summary="List system configs")
def list_configs(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.sys_models import SysConfig

        configs = db.query(SysConfig).limit(500).all()
        data = [
            {
                "config_key": c.config_key,
                "config_value": c.config_value,
                "config_name": c.config_name,
            }
            for c in configs
        ]
        return success(data)


@router.get("/dict/{dict_type}", summary="Get dictionary data")
def get_dict(dict_type: str):
    with get_session() as db:
        from app.models.sys_models import SysDictData

        items = (
            db.query(SysDictData)
            .filter(SysDictData.dict_type == dict_type, SysDictData.status == "0")
            .order_by(SysDictData.dict_sort)
            .all()
        )
        data = [{"dict_label": d.dict_label, "dict_value": d.dict_value} for d in items]
        return success(data)
