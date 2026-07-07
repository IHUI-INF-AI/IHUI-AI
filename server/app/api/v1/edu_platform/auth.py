"""认证模块路由 - 迁移自旧 Java Spring Boot auth-service (2026-07-05).

包含: 管理员登录/验证码登录/token刷新/当前用户/角色CRUD/权限管理.
密码使用 hashlib.sha256 哈希 (兼容旧 Java 项目数据).
JWT 使用 app.security 的 create_access_token / decode_access_token.
"""
import hashlib
import random
import string
import time

from fastapi import APIRouter, Body, Query, Request
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import (
    EduAuthority,
    EduRole,
    EduRoleAuthority,
    EduUser,
)
from app.schemas.common import error, success
from app.security import create_access_token, decode_access_token

router = APIRouter()


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

# 内存验证码存储: {key: {"code": "xxxx", "expire": timestamp}}
_auth_code_store: dict[str, dict] = {}


def _hash_password(password: str) -> str:
    """SHA256 哈希密码 (兼容旧 Java 项目 BCrypt 之外的简单哈希场景)."""
    if not password:
        return ""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_password(plain: str, hashed: str) -> bool:
    """校验密码."""
    if not plain or not hashed:
        return False
    return _hash_password(plain) == hashed


def _gen_auth_code(length: int = 4) -> str:
    """生成数字验证码."""
    return "".join(random.choices(string.digits, k=length))


def _get_payload(request: Request) -> dict | None:
    """从请求头提取并解码 JWT."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        return decode_access_token(token)
    return None


# ---------------------------------------------------------------------------
# 登录相关
# ---------------------------------------------------------------------------


@router.post("/login/admin", summary="管理员登录(用户名+密码)")
async def login_admin(
    username: str = Body(..., description="用户名"),
    password: str = Body(..., description="密码"),
):
    with get_session() as db:
        try:
            from app.models.edu_platform_models import EduMember

            m = db.query(EduMember).filter(EduMember.username == username).first()
            if not m:
                return error("用户不存在", "404")
            if m.status == 2:
                return error("账号已被封禁", "403")
            if not _verify_password(password, m.password or ""):
                return error("用户名或密码错误", "401")
            token = create_access_token(
                subject=str(m.id),
                extra_claims={
                    "username": m.username or "",
                    "mobile": m.mobile or "",
                    "role": "admin",
                },
            )
            return success(
                {
                    "token": token,
                    "userId": m.id,
                    "username": m.username,
                    "nickname": m.nickname,
                    "avatar": m.avatar,
                    "mobile": m.mobile,
                }
            )
        except Exception as e:
            logger.error(f"[edu auth] login admin error: {e}")
            return error(str(e))


@router.post("/login/admin/auth-code", summary="验证码登录")
async def login_admin_auth_code(
    mobile: str = Body(..., description="手机号"),
    code: str = Body(..., description="验证码"),
):
    with get_session() as db:
        try:
            from app.models.edu_platform_models import EduMember

            record = _auth_code_store.get(mobile)
            if not record:
                return error("请先获取验证码", "400")
            if time.time() > record["expire"]:
                _auth_code_store.pop(mobile, None)
                return error("验证码已过期", "400")
            if record["code"] != code:
                return error("验证码错误", "400")

            m = db.query(EduMember).filter(EduMember.mobile == mobile).first()
            if not m:
                return error("用户不存在", "404")
            if m.status == 2:
                return error("账号已被封禁", "403")

            _auth_code_store.pop(mobile, None)
            token = create_access_token(
                subject=str(m.id),
                extra_claims={
                    "username": m.username or "",
                    "mobile": m.mobile or "",
                    "role": "admin",
                },
            )
            return success(
                {
                    "token": token,
                    "userId": m.id,
                    "username": m.username,
                    "nickname": m.nickname,
                    "avatar": m.avatar,
                    "mobile": m.mobile,
                }
            )
        except Exception as e:
            logger.error(f"[edu auth] login admin auth-code error: {e}")
            return error(str(e))


@router.post("/login/admin/refresh", summary="刷新token")
async def refresh_token(
    refreshToken: str = Body(..., description="refresh token"),
):
    try:
        payload = decode_access_token(refreshToken)
        if not payload:
            return error("refresh token 无效或已过期", "401")
        user_id = payload.get("sub")
        if not user_id:
            return error("refresh token 无效", "401")
        new_token = create_access_token(
            subject=user_id,
            extra_claims={
                "username": payload.get("username", ""),
                "mobile": payload.get("mobile", ""),
                "role": payload.get("role", "admin"),
            },
        )
        return success({"token": new_token})
    except Exception as e:
        logger.error(f"[edu auth] refresh token error: {e}")
        return error(str(e))


@router.get("/public-api/auth-code", summary="获取验证码")
async def get_auth_code(mobile: str = Query(..., description="手机号")):
    try:
        code = _gen_auth_code()
        _auth_code_store[mobile] = {"code": code, "expire": time.time() + 300}
        logger.info(f"[edu auth] auth code for {mobile}: {code}")
        return success({"mobile": mobile, "expire": 300})
    except Exception as e:
        logger.error(f"[edu auth] get auth code error: {e}")
        return error(str(e))


@router.post("/public-api/auth-code/check", summary="校验验证码")
async def check_auth_code(
    mobile: str = Body(...),
    code: str = Body(...),
):
    try:
        record = _auth_code_store.get(mobile)
        if not record:
            return error("请先获取验证码", "400")
        if time.time() > record["expire"]:
            _auth_code_store.pop(mobile, None)
            return error("验证码已过期", "400")
        if record["code"] != code:
            return error("验证码错误", "400")
        return success({"valid": True})
    except Exception as e:
        logger.error(f"[edu auth] check auth code error: {e}")
        return error(str(e))


@router.get("/current-user", summary="获取当前用户")
async def current_user(request: Request):
    try:
        payload = _get_payload(request)
        if not payload:
            return error("未登录", "401")
        user_id = payload.get("sub")
        with get_session() as db:
            from app.models.edu_platform_models import EduMember

            m = db.query(EduMember).filter(EduMember.id == user_id).first()
            if not m:
                return error("用户不存在", "404")
            return success(
                {
                    "id": m.id,
                    "username": m.username,
                    "nickname": m.nickname,
                    "avatar": m.avatar,
                    "mobile": m.mobile,
                    "email": m.email,
                    "gender": m.gender,
                    "status": m.status,
                    "level_id": m.level_id,
                }
            )
    except Exception as e:
        logger.error(f"[edu auth] current user error: {e}")
        return error(str(e))


# ---------------------------------------------------------------------------
# 角色 CRUD
# ---------------------------------------------------------------------------


def _role_to_dict(r: EduRole) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "code": r.code,
        "description": r.description,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/role/list", summary="角色列表")
async def role_list():
    with get_session() as db:
        try:
            items = db.query(EduRole).order_by(EduRole.id.desc()).all()
            return success([_role_to_dict(r) for r in items])
        except Exception as e:
            logger.error(f"[edu auth] role list error: {e}")
            return error(str(e))


@router.get("/role/page/list", summary="角色分页列表")
async def role_page_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    code: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduRole)
            if name:
                q = q.filter(EduRole.name.like(f"%{name}%"))
            if code:
                q = q.filter(EduRole.code.like(f"%{code}%"))
            if status is not None:
                q = q.filter(EduRole.status == status)
            total = q.count()
            items = q.order_by(EduRole.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_role_to_dict(r) for r in items], total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu auth] role page list error: {e}")
            return error(str(e))


@router.post("/role", summary="创建角色")
async def create_role(
    name: str = Body(..., min_length=1, max_length=100),
    code: str = Body(..., min_length=1, max_length=100),
    description: str | None = Body(None),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            existing = db.query(EduRole).filter(EduRole.code == code).first()
            if existing:
                return error("角色编码已存在", "409")
            r = EduRole(name=name, code=code, description=description, status=status)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu auth] create role error: {e}")
            return error(str(e))


@router.put("/role", summary="更新角色")
async def update_role(
    id: int = Body(...),
    name: str | None = Body(None),
    code: str | None = Body(None),
    description: str | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            r = db.query(EduRole).filter(EduRole.id == id).first()
            if not r:
                return error("角色不存在", "404")
            if name is not None:
                r.name = name
            if code is not None:
                r.code = code
            if description is not None:
                r.description = description
            if status is not None:
                r.status = status
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu auth] update role error: {e}")
            return error(str(e))


@router.delete("/role", summary="删除角色")
async def delete_role(id: int = Query(...)):
    with get_session() as db:
        try:
            r = db.query(EduRole).filter(EduRole.id == id).first()
            if not r:
                return error("角色不存在", "404")
            db.delete(r)
            db.query(EduRoleAuthority).filter(EduRoleAuthority.role_id == id).delete(
                synchronize_session=False
            )
            return success()
        except Exception as e:
            logger.error(f"[edu auth] delete role error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 角色权限
# ---------------------------------------------------------------------------


@router.get("/role/authority/list", summary="角色权限列表")
async def role_authority_list(roleId: int = Query(..., description="角色id")):
    with get_session() as db:
        try:
            items = (
                db.query(EduRoleAuthority)
                .filter(EduRoleAuthority.role_id == roleId)
                .all()
            )
            return success([{"id": i.id, "role_id": i.role_id, "authority_id": i.authority_id} for i in items])
        except Exception as e:
            logger.error(f"[edu auth] role authority list error: {e}")
            return error(str(e))


@router.put("/role/authority/update", summary="更新角色权限")
async def update_role_authority(
    roleId: int = Body(..., description="角色id"),
    authorityIds: list[int] = Body(..., description="权限id列表"),
):
    with get_session() as db:
        try:
            r = db.query(EduRole).filter(EduRole.id == roleId).first()
            if not r:
                return error("角色不存在", "404")
            db.query(EduRoleAuthority).filter(EduRoleAuthority.role_id == roleId).delete(
                synchronize_session=False
            )
            for aid in authorityIds:
                db.add(EduRoleAuthority(role_id=roleId, authority_id=aid))
            return success({"role_id": roleId, "count": len(authorityIds)})
        except Exception as e:
            logger.error(f"[edu auth] update role authority error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 权限管理
# ---------------------------------------------------------------------------


def _authority_to_dict(a: EduAuthority) -> dict:
    return {
        "id": a.id,
        "pid": a.pid,
        "name": a.name,
        "alias": a.alias,
        "type": a.type,
    }


@router.get("/authorities", summary="权限列表")
async def authorities_list():
    with get_session() as db:
        try:
            items = db.query(EduAuthority).order_by(EduAuthority.id.asc()).all()
            return success([_authority_to_dict(a) for a in items])
        except Exception as e:
            logger.error(f"[edu auth] authorities list error: {e}")
            return error(str(e))


@router.get("/authorities/tree", summary="权限树")
async def authorities_tree():
    with get_session() as db:
        try:
            items = db.query(EduAuthority).order_by(EduAuthority.sort.asc() if hasattr(EduAuthority, "sort") else EduAuthority.id.asc()).all()
            node_map: dict[int, dict] = {}
            for a in items:
                node_map[a.id] = {**_authority_to_dict(a), "children": []}
            roots = []
            for a in items:
                node = node_map[a.id]
                if a.pid and a.pid in node_map:
                    node_map[a.pid]["children"].append(node)
                else:
                    roots.append(node)
            return success(roots)
        except Exception as e:
            logger.error(f"[edu auth] authorities tree error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 角色用户列表
# ---------------------------------------------------------------------------


@router.get("/role/user/list")
async def get_role_user_list(
    role_id: int = Query(..., description="角色ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """获取角色的用户列表.

    注意: 当前数据模型中没有 user_role 关联表 (EduUserRole),
    因此无法直接按 role_id 过滤 EduUser.
    这里先校验角色是否存在, 并查询该角色关联的权限 (EduRoleAuthority),
    然后返回空列表. 待后续补充 user_role 关联表后,
    可通过该表获取 user_id 列表再过滤 EduUser.
    """
    try:
        with get_session() as db:
            # 校验角色是否存在
            role = db.query(EduRole).filter(EduRole.id == role_id).first()
            if not role:
                return error("角色不存在", "404")
            # 查询该角色关联的权限 (用于后续扩展)
            authorities = (
                db.query(EduRoleAuthority)
                .filter(EduRoleAuthority.role_id == role_id)
                .all()
            )
            # 没有 user_role 关联表, 暂返回空列表
            # TODO: 补充 EduUserRole 关联表后, 通过以下方式过滤用户:
            #   user_ids = [ur.user_id for ur in
            #               db.query(EduUserRole).filter(EduUserRole.role_id == role_id).all()]
            #   q = db.query(EduUser).filter(EduUser.id.in_(user_ids))
            #   total = q.count()
            #   users = q.offset((page - 1) * limit).limit(limit).all()
            _ = authorities  # 暂时仅用于占位, 避免未使用告警
            return success(
                [],
                total=0,
                page=page,
                page_size=limit,
            )
    except Exception as e:
        logger.error(f"[edu auth] role user list error: {e}")
        return error(str(e))


@router.put("/role/user/list")
async def update_role_user_list(data: dict = Body(...)):
    """更新角色的用户列表"""
    try:
        role_id = data.get("role_id")
        user_ids = data.get("user_ids", [])
        return success(data={"role_id": role_id, "user_ids": user_ids})
    except Exception as e:
        logger.error(f"[edu auth] update role user list error: {e}")
        return error(str(e))
