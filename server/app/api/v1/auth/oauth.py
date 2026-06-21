"""OAuth2 routes -- authorize, token exchange, and App management."""

import secrets

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.database import SessionFactory2
from app.schemas.common import error, success
from app.security import create_access_token, require_login

router = APIRouter(prefix="/oauth", tags=["OAuth"])


@router.get("/authorize", summary="OAuth authorize")
async def authorize(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query("code"),
    state: str = Query(None, description="CSRF state parameter"),
    user_uuid: str = Depends(require_login),
):
    """OAuth authorize. State 参数用于 CSRF 防护,客户端必须传并在回调时校验."""
    import time
    import uuid

    # state 必传校验 (CSRF 防护)
    if not state or not state.strip():
        return error("state parameter is required for CSRF protection", code=400)
    db = SessionFactory2()
    try:
        from app.models.oauth_models import OAuthApp, OAuthSession

        app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
        if not app:
            return error("Invalid client_id", code=400)
        code = uuid.uuid4().hex[:16]
        session = OAuthSession(
            code=code,
            client_id=client_id,
            user_uuid=user_uuid,
            state=state,
            expires_at=int(time.time()) + 300,
        )
        db.add(session)
        db.commit()
        return success({"code": code, "state": state, "redirect_uri": f"{redirect_uri}?code={code}&state={state}"})
    finally:
        db.close()


@router.post("/token", summary="Exchange code for token")
async def oauth_token(
    code: str = Query(...),
    client_id: str = Query(...),
    client_secret: str = Query(...),
    state: str = Query(None, description="CSRF state to verify against session"),
):
    db = SessionFactory2()
    try:
        from app.models.oauth_models import OAuthApp, OAuthSession

        app = (
            db.query(OAuthApp)
            .filter(
                OAuthApp.client_id == client_id,
                OAuthApp.client_secret == client_secret,
            )
            .first()
        )
        if not app:
            return error("Invalid client credentials", code=401)
        session = (
            db.query(OAuthSession)
            .filter(
                OAuthSession.code == code,
                not OAuthSession.is_used,
            )
            .first()
        )
        if not session:
            return error("Invalid or used code", code=401)
        # state 校验 (CSRF 防护)
        if session.state and state != session.state:
            return error("State mismatch (possible CSRF attack)", code=400)
        session.is_used = True
        db.commit()
        token = create_access_token(subject=session.user_uuid)
        return success({"access_token": token, "token_type": "Bearer"})
    finally:
        db.close()


# ---------------------------------------------------------------------------
# OAuth App management
# ---------------------------------------------------------------------------


class OAuthAppCreateBody(BaseModel):
    name: str
    redirect_uri: str | None = None


def _serialize_app(app) -> dict:
    return {
        "id": app.id,
        "client_id": app.client_id,
        "client_secret": app.client_secret,
        "name": app.name,
        "redirect_uri": app.redirect_uri,
        "is_active": app.is_active,
        "created_at": app.created_at.isoformat() if app.created_at else None,
    }


@router.post("/apps/create", summary="Create an OAuth application")
async def create_oauth_app(
    body: OAuthAppCreateBody,
    user_uuid: str = Depends(require_login),
):
    """Register a new OAuth application and return client credentials."""
    from app.models.oauth_models import OAuthApp

    db = SessionFactory2()
    try:
        client_id = "zhs_" + secrets.token_hex(16)
        client_secret = secrets.token_hex(32)
        app = OAuthApp(
            client_id=client_id,
            client_secret=client_secret,
            name=body.name,
            redirect_uri=body.redirect_uri,
            is_active=1,
        )
        db.add(app)
        db.commit()
        db.refresh(app)
        return success(_serialize_app(app))
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


@router.get("/apps/list", summary="List OAuth applications")
async def list_oauth_apps(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """List all OAuth applications with pagination."""
    from app.models.oauth_models import OAuthApp

    db = SessionFactory2()
    try:
        total = db.query(OAuthApp).count()
        items = db.query(OAuthApp).order_by(OAuthApp.id.desc()).offset((page - 1) * limit).limit(limit).all()
        return success([_serialize_app(a) for a in items], total=total)
    finally:
        db.close()


@router.get("/apps/{client_id}", summary="Get OAuth application by client_id")
async def get_oauth_app(
    client_id: str,
    user_uuid: str = Depends(require_login),
):
    """Retrieve a single OAuth application by its client_id."""
    from app.models.oauth_models import OAuthApp

    db = SessionFactory2()
    try:
        app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
        if not app:
            return error("OAuth app not found", "404")
        return success(_serialize_app(app))
    finally:
        db.close()


@router.delete("/apps/{client_id}", summary="Delete OAuth application")
async def delete_oauth_app(
    client_id: str,
    user_uuid: str = Depends(require_login),
):
    """Delete an OAuth application by its client_id."""
    from app.models.oauth_models import OAuthApp

    db = SessionFactory2()
    try:
        app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
        if not app:
            return error("OAuth app not found", "404")
        db.delete(app)
        db.commit()
        return success({"deleted": client_id})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# OAuth Users
# ---------------------------------------------------------------------------


@router.get("/users/list", summary="OAuth 用户列表")
async def list_oauth_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    provider: str = Query(None, description="按 provider 过滤"),
    user_uuid: str = Depends(require_login),
):
    from app.models.oauth_models import OAuthUser

    db = SessionFactory2()
    try:
        q = db.query(OAuthUser)
        if provider:
            q = q.filter(OAuthUser.provider == provider)
        total = q.count()
        items = q.order_by(OAuthUser.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": u.id,
                "user_uuid": u.user_uuid,
                "provider": u.provider,
                "provider_user_id": u.provider_user_id,
                "expires_at": u.expires_at.isoformat() if u.expires_at else None,
            }
            for u in items
        ]
        return success(data, total=total)
    finally:
        db.close()


@router.get("/users/{user_id}", summary="OAuth 用户详情")
async def get_oauth_user(
    user_id: int,
    user_uuid: str = Depends(require_login),
):
    from app.models.oauth_models import OAuthUser

    db = SessionFactory2()
    try:
        u = db.query(OAuthUser).filter(OAuthUser.id == user_id).first()
        if not u:
            return error("OAuth user not found", "404")
        data = {
            "id": u.id,
            "user_uuid": u.user_uuid,
            "provider": u.provider,
            "provider_user_id": u.provider_user_id,
            "access_token": u.access_token,
            "refresh_token": u.refresh_token,
            "expires_at": u.expires_at.isoformat() if u.expires_at else None,
        }
        return success(data)
    finally:
        db.close()
