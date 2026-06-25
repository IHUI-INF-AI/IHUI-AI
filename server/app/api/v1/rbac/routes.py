from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.security import hash_password
from app.services.database_service import (
    FileAccessService,
    PermissionService,
    RoleService,
    Session,
    UserService,
    get_db,
    init_default_roles_and_permissions,
)

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    email: str | None = None
    password: str | None = None
    display_name: str | None = None


class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: str | None = None


class PermissionCreate(BaseModel):
    name: str
    display_name: str
    resource: str
    action: str
    description: str | None = None


class FileAccessGrant(BaseModel):
    file_id: str
    user_id: str
    permission: str
    expires_in_hours: int | None = None


@router.post("/init")
async def initialize_rbac(db: Session = Depends(get_db)):
    init_default_roles_and_permissions(db)
    return {"success": True, "message": "RBAC initialized"}


@router.post("/user/create")
async def create_user(data: UserCreate, db: Session = Depends(get_db)):
    existing = UserService.get_by_username(db, data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    import uuid
    user_id = str(uuid.uuid4())

    hashed_password = None
    if data.password:
        hashed_password = hash_password(data.password)

    user = UserService.create(
        db, user_id, data.username, data.email, hashed_password, data.display_name
    )

    UserService.assign_role(db, user_id, "user")

    return {
        "success": True,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name
        }
    }


@router.get("/user/{user_id}")
async def get_user(user_id: str, db: Session = Depends(get_db)):
    user = UserService.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    roles = UserService.get_user_roles(db, user_id)
    permissions = UserService.get_user_permissions(db, user_id)

    return {
        "success": True,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "roles": [{"role_id": r.role_id, "name": r.name, "display_name": r.display_name} for r in roles],
            "permissions": [{"name": p.name, "resource": p.resource, "action": p.action} for p in permissions]
        }
    }


@router.post("/user/{user_id}/role/{role_id}")
async def assign_role(user_id: str, role_id: str, assigned_by: str | None = None, db: Session = Depends(get_db)):
    user = UserService.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = RoleService.get(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    UserService.assign_role(db, user_id, role_id, assigned_by)

    return {"success": True, "message": f"Role {role_id} assigned to user {user_id}"}


@router.get("/user/{user_id}/permissions")
async def get_user_permissions(user_id: str, db: Session = Depends(get_db)):
    permissions = UserService.get_user_permissions(db, user_id)

    return {
        "success": True,
        "permissions": [
            {
                "permission_id": p.permission_id,
                "name": p.name,
                "display_name": p.display_name,
                "resource": p.resource,
                "action": p.action
            }
            for p in permissions
        ]
    }


@router.get("/roles")
async def list_roles(db: Session = Depends(get_db)):
    roles = RoleService.get_all(db)

    return {
        "success": True,
        "roles": [
            {
                "role_id": r.role_id,
                "name": r.name,
                "display_name": r.display_name,
                "description": r.description,
                "is_system": r.is_system
            }
            for r in roles
        ]
    }


@router.post("/role/create")
async def create_role(data: RoleCreate, db: Session = Depends(get_db)):
    import uuid
    role_id = str(uuid.uuid4())

    role = RoleService.create(db, role_id, data.name, data.display_name, data.description)

    return {
        "success": True,
        "role": {
            "role_id": role.role_id,
            "name": role.name,
            "display_name": role.display_name
        }
    }


@router.get("/role/{role_id}/permissions")
async def get_role_permissions(role_id: str, db: Session = Depends(get_db)):
    permissions = RoleService.get_role_permissions(db, role_id)

    return {
        "success": True,
        "permissions": [
            {
                "permission_id": p.permission_id,
                "name": p.name,
                "display_name": p.display_name,
                "resource": p.resource,
                "action": p.action
            }
            for p in permissions
        ]
    }


@router.post("/role/{role_id}/permission/{permission_id}")
async def assign_permission(role_id: str, permission_id: str, db: Session = Depends(get_db)):
    role = RoleService.get(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    RoleService.assign_permission(db, role_id, permission_id)

    return {"success": True, "message": f"Permission {permission_id} assigned to role {role_id}"}


@router.get("/permissions")
async def list_permissions(db: Session = Depends(get_db)):
    permissions = PermissionService.get_all(db)

    return {
        "success": True,
        "permissions": [
            {
                "permission_id": p.permission_id,
                "name": p.name,
                "display_name": p.display_name,
                "resource": p.resource,
                "action": p.action
            }
            for p in permissions
        ]
    }


@router.post("/access/grant")
async def grant_file_access(data: FileAccessGrant, granted_by: str | None = None, db: Session = Depends(get_db)):
    expires_at = None
    if data.expires_in_hours:
        expires_at = utcnow() + timedelta(hours=data.expires_in_hours)

    access = FileAccessService.grant_access(
        db, data.file_id, data.user_id, data.permission, granted_by, expires_at
    )

    return {
        "success": True,
        "access": {
            "file_id": access.file_id,
            "user_id": access.user_id,
            "permission": access.permission,
            "expires_at": access.expires_at.isoformat() if access.expires_at else None
        }
    }


@router.get("/access/check")
async def check_file_access(
    file_id: str,
    user_id: str,
    permission: str,
    db: Session = Depends(get_db)
):
    has_access = FileAccessService.check_access(db, file_id, user_id, permission)

    user_permissions = UserService.get_user_permissions(db, user_id)
    perm_name = f"file:{permission}"
    has_role_permission = any(p.name == perm_name for p in user_permissions)

    return {
        "success": True,
        "has_access": has_access or has_role_permission,
        "direct_access": has_access,
        "role_access": has_role_permission
    }


@router.get("/access/file/{file_id}")
async def get_file_access_list(file_id: str, db: Session = Depends(get_db)):
    access_list = FileAccessService.get_file_access_list(db, file_id)

    return {
        "success": True,
        "access_list": [
            {
                "user_id": a.user_id,
                "permission": a.permission,
                "granted_by": a.granted_by,
                "granted_at": a.granted_at.isoformat(),
                "expires_at": a.expires_at.isoformat() if a.expires_at else None
            }
            for a in access_list
        ]
    }


@router.delete("/access/file/{file_id}/user/{user_id}")
async def revoke_file_access(file_id: str, user_id: str, db: Session = Depends(get_db)):
    revoked = FileAccessService.revoke_access(db, file_id, user_id)

    return {"success": revoked, "message": "Access revoked" if revoked else "No access found"}
