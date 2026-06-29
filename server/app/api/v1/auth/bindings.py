"""Third-party account bindings management routes.

Matches Java AuthorizationManagementController:
- GET /auth_management/get/{uuid} -> list all third-party bindings
- POST /auth_management/remove -> unbind by uuid + platform
"""

from fastapi import APIRouter, Body, Depends
from loguru import logger

from app.schemas.common import error, success
from app.security import require_login

router = APIRouter(prefix="/auth/bindings", tags=["Account Bindings"])


@router.get("/", summary="List all third-party bindings")
async def list_bindings(user_uuid: str = Depends(require_login)):
    """Get all third-party account bindings for the current user.

    Matches Java: AuthorizationManagementServlet.getList(uuid)
    """
    from app.database import SessionFactory2
    from app.models.user_models import UserThirdPartyAccount

    db = SessionFactory2()
    try:
        bindings = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.user_uuid == user_uuid,
            )
            .all()
        )
        result = [
            {
                "id": b.id,
                "platform": b.platform,
                "open_id": b.open_id,
                "union_id": b.union_id,
                "created_at": str(b.created_at) if b.created_at else None,
            }
            for b in bindings
        ]
        return success(result)
    finally:
        db.close()


@router.delete("/{binding_id}", summary="Unbind third-party account by ID")
async def unbind(binding_id: int, user_uuid: str = Depends(require_login)):
    """Remove a third-party account binding by ID."""
    from app.database import SessionFactory2
    from app.models.user_models import UserThirdPartyAccount

    db = SessionFactory2()
    try:
        binding = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.id == binding_id,
                UserThirdPartyAccount.user_uuid == user_uuid,
            )
            .first()
        )
        if not binding:
            return error("Binding not found", "404")
        db.delete(binding)
        db.commit()
        return success(msg="Unbound successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Unbind error: {e}")
        return error("Unbind failed", "500")
    finally:
        db.close()


@router.post("/remove", summary="Unbind third-party account by platform")
async def remove_by_platform(
    uuid: str = Body(..., embed=True, description="User UUID"),
    platform: str = Body(..., embed=True, description="Platform name (wechat, google, feishu)"),
):
    """Remove a third-party account binding by uuid + platform.

    Matches Java: AuthorizationManagementController.delAuth -> AuthorizationManagementServlet.delAuth(uuid, platform)
    SQL: DELETE FROM user_third_party_accounts WHERE user_uuid = #{uuid} AND platform = #{platform}
    """
    from app.database import SessionFactory2
    from app.models.user_models import UserThirdPartyAccount

    if not uuid:
        return error("不存在的授权!")
    if not platform:
        return error("未知的授权平台!")

    db = SessionFactory2()
    try:
        deleted = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.user_uuid == uuid,
                UserThirdPartyAccount.platform == platform,
            )
            .delete()
        )
        db.commit()
        # Return updated list (matches Java delAuth which calls getList after delete)
        bindings = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.user_uuid == uuid,
            )
            .all()
        )
        result = [
            {
                "id": b.id,
                "platform": b.platform,
                "open_id": b.open_id,
                "union_id": b.union_id,
                "created_at": str(b.created_at) if b.created_at else None,
            }
            for b in bindings
        ]
        return success(result, msg="解绑成功" if deleted else "未找到对应授权")
    except Exception as e:
        db.rollback()
        logger.error(f"Remove auth error: {e}")
        return error("解绑失败", "500")
    finally:
        db.close()
