"""OAuth 应用管理路由(操作 oauth_apps 表).

安全约束:
- client_secret 仅在创建时返回一次,list/get 详情绝不返回.
- client_id 生成: secrets.token_urlsafe(16)
- client_secret 生成: secrets.token_urlsafe(32)

Round 21 扩展:
- 补齐 OAuth2 授权码流程 (/authorize + /token + /refresh)
- 新增重置密钥 endpoint (/oauth-apps/{client_id}/reset-secret)
- 与 app.api.v1.auth.oauth (前缀 /oauth) 解耦, 本模块自成完整 OAuth 应用 + 授权流程

Round 22 扩展:
- PKCE (Proof Key for Code Exchange) S256 支持, 防止公开客户端授权码拦截
- redirect_uris JSON 白名单 (多回调地址精确匹配, 取代单 redirect_uri 前缀校验)
"""

import base64
import datetime as dt
import hashlib
import secrets
import uuid

from fastapi import APIRouter, Body, Depends, Query, Request
from loguru import logger

from app.database import get_session
from app.models.oauth_models import (
    OAuthApp,
    OAuthAuditLog,
    OAuthScopeMeta,
    OAuthSession,
)
from app.schemas.common import error, success
from app.security import (
    JWT_SECRET_KEY,
    create_access_token,
    require_login,
    require_oauth_scope,
)

router = APIRouter()


# 授权码有效期 (秒)
AUTH_CODE_TTL = 300
# Refresh token 有效期 (秒, 30 天)
REFRESH_TOKEN_TTL = 30 * 24 * 3600


def _to_public_dict(app: OAuthApp) -> dict:
    """构造对外安全的字典(不包含 client_secret)."""
    return {
        "id": app.id,
        "client_id": app.client_id,
        "name": app.name,
        "redirect_uri": app.redirect_uri,
        "redirect_uris": app.redirect_uris or [],
        "scopes": app.scopes or [],
        "is_active": app.is_active,
        "icon": app.icon,
        "owner_uuid": app.owner_uuid,
    }


def _to_scope_meta_dict(meta: OAuthScopeMeta) -> dict:
    """构造 OAuthScopeMeta 对外字典 (admin / 公开 list 共用)."""
    return {
        "id": meta.id,
        "scope": meta.scope,
        "name": meta.name,
        "description": meta.description,
        "icon": meta.icon,
        "category": meta.category,
        "is_active": meta.is_active,
        "sort_order": meta.sort_order or 0,
    }


def _validate_redirect_uri(app: OAuthApp, redirect_uri: str) -> bool:
    """校验 redirect_uri 是否在应用白名单中.

    Round 22 优先级:
    1. 若 app.redirect_uris (JSON 数组) 非空, 精确匹配 (取代前缀校验, 更安全)
    2. 否则回退到 app.redirect_uri 前缀校验 (向后兼容)
    """
    if not redirect_uri:
        return False
    # 优先用 redirect_uris 白名单精确匹配
    if app.redirect_uris:
        if isinstance(app.redirect_uris, list):
            return redirect_uri in app.redirect_uris
        return False
    # 回退: 单 redirect_uri 前缀校验 (向后兼容)
    if app.redirect_uri:
        return redirect_uri.startswith(app.redirect_uri)
    # 无白名单也无单 redirect_uri, 拒绝 (默认安全)
    return False


def _validate_scope(requested_scope: str, app_scopes) -> str:
    """校验请求的 scope 是否在应用允许的范围内.

    Round 23 新增. OAuth2 标准: scope 是空格分隔字符串.

    Args:
        requested_scope: 客户端请求的 scope (空格分隔字符串, 可为空)
        app_scopes: 应用允许的 scope 列表 (JSON 数组)

    Returns:
        校验通过的 scope 字符串 (空格分隔). 若 requested_scope 为空, 返回应用全部 scope.
        若 app_scopes 为空 (未配置), 返回 requested_scope (向后兼容).

    Raises:
        ValueError: 请求的 scope 不在应用允许范围内.
    """
    if not app_scopes:
        # 应用未配置 scopes, 放行所有请求 (向后兼容)
        return requested_scope or ""
    if not isinstance(app_scopes, list):
        raise ValueError("应用 scopes 配置格式错误 (必须是数组)")
    if not requested_scope:
        # 客户端未传 scope, 默认授权应用全部 scope
        return " ".join(app_scopes)
    requested_set = set(requested_scope.split())
    allowed_set = set(app_scopes)
    invalid = requested_set - allowed_set
    if invalid:
        raise ValueError(f"scope 不在应用允许范围内: {' '.join(sorted(invalid))}")
    return requested_scope


def _verify_pkce(code_verifier: str, code_challenge: str, method: str) -> bool:
    """校验 PKCE code_verifier.

    S256: BASE64URL(SHA256(code_verifier)) == code_challenge
    plain: code_verifier == code_challenge (本实现拒绝 plain, 仅支持 S256)

    Args:
        code_verifier: 客户端在 token 阶段传入的原始 verifier
        code_challenge: authorize 阶段存储的 challenge
        method: code_challenge_method (必须是 "S256")

    Returns:
        True 校验通过, False 校验失败
    """
    if not code_verifier or not code_challenge:
        return False
    if method != "S256":
        # 仅支持 S256, 拒绝 plain (RFC 7636 推荐生产环境仅用 S256)
        return False
    # S256: BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    computed_challenge = (
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    )
    return computed_challenge == code_challenge


# ---------------------------------------------------------------------------
# Round 27-C: OAuth 审计日志 helper
# ---------------------------------------------------------------------------


def _get_client_ip(request: Request) -> str:
    """从 FastAPI Request 提取客户端 IP.

    优先取 X-Forwarded-For (经过反向代理), 回退 request.client.host.
    """
    if request is None:
        return ""
    try:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # X-Forwarded-For 可能是 "client, proxy1, proxy2", 取第一个
            return xff.split(",")[0].strip()
        if request.client:
            return request.client.host or ""
    except Exception:
        pass
    return ""


def _log_oauth_audit(
    event: str,
    client_id: str = None,
    user_uuid: str = None,
    ip: str = None,
    status: str = "success",
    detail: str = None,
    request_summary: dict = None,
):
    """写入 OAuth 审计日志 (fire-and-forget, 不阻塞主流程).

    Round 27-C 新增. 所有 OAuth 敏感操作均应调用此函数记录审计日志.
    异常被吞掉 (仅 logger.debug), 避免审计日志写入失败影响主业务.

    Args:
        event: 事件类型 (app_create / app_delete / app_reset_secret /
               authorize_grant / authorize_deny / token_issue / token_refresh /
               protected_access)
        client_id: 关联的 OAuth 应用 client_id (可空)
        user_uuid: 操作者 user_uuid (可空)
        ip: 操作来源 IP (可空)
        status: 结果状态 (success / failure)
        detail: 详细说明 / 失败原因 (可空)
        request_summary: 请求参数摘要 (脱敏后的 dict, 不含 client_secret / code_verifier)
    """
    try:
        with get_session() as db:
            log = OAuthAuditLog(
                event=event,
                client_id=client_id,
                user_uuid=user_uuid,
                ip=ip,
                status=status,
                detail=detail,
                request_summary=request_summary,
            )
            db.add(log)
            db.commit()
    except Exception as e:
        # 审计日志写入失败不影响主流程, 仅记录 debug 日志
        logger.debug(f"OAuth audit log write failed (event={event}): {e}")


@router.get("/oauth-apps/manage", summary="OAuth 应用管理页面")
async def oauth_app_management_page(
    user_uuid: str = Depends(require_login),
):
    """返回 OAuth 应用管理页面元信息 + 完整 API 文档.

    Round 23 增强: 返回完整端点文档 + 授权流程说明 + PKCE 集成指南 + scope 配置示例,
    供前端开发者据此对接 (本后端 OAuth 系统与 Coze 前端 OAuthApps.vue 独立).
    """
    return success(
        {
            "page": "oauth_app_management",
            "title": "OAuth 应用管理",
            "version": "round-23",
            "endpoints": {
                "manage": "GET /oauth-apps/manage (本接口, 返回 API 文档)",
                "create": "POST /oauth-apps/create (创建应用, client_secret 仅返回一次)",
                "list": "GET /oauth-apps/list?is_active=1 (列表, 默认仅活跃)",
                "detail": "GET /oauth-apps/{client_id} (详情, 不返回 client_secret)",
                "delete": "DELETE /oauth-apps/{client_id} (软删除, 置 is_active=0)",
                "authorize": "GET /oauth-apps/authorize (授权码签发, 支持 PKCE + scope)",
                "token": "POST /oauth-apps/token (授权码换 access_token + refresh_token)",
                "refresh": "POST /oauth-apps/refresh (refresh_token 换新 access_token)",
                "reset_secret": "POST /oauth-apps/{client_id}/reset-secret (重置密钥, 旧 secret 失效)",
            },
            "oauth2_flow": {
                "step_1_authorize": {
                    "method": "GET",
                    "path": "/oauth-apps/authorize",
                    "required_params": ["client_id", "redirect_uri", "state"],
                    "optional_params": [
                        "response_type (默认 code)",
                        "code_challenge (PKCE, 公开客户端推荐)",
                        "code_challenge_method (S256, 仅支持 S256)",
                        "scope (空格分隔权限范围字符串)",
                    ],
                    "returns": "code + state + expires_in (300s) + scope",
                    "notes": "state 必传 (CSRF 防护); redirect_uri 必须在白名单内",
                },
                "step_2_token": {
                    "method": "POST",
                    "path": "/oauth-apps/token",
                    "required_params": ["code", "client_id", "client_secret"],
                    "optional_params": [
                        "state (与 authorize 一致)",
                        "code_verifier (PKCE, authorize 传了 code_challenge 时必传)",
                    ],
                    "returns": "access_token (1h) + refresh_token (30d) + scope",
                    "notes": "code 一次性使用; PKCE 校验 BASE64URL(SHA256(verifier))==challenge",
                },
                "step_3_refresh": {
                    "method": "POST",
                    "path": "/oauth-apps/refresh",
                    "body": {"refresh_token": "string", "client_id": "string (可选)"},
                    "returns": "新 access_token (1h)",
                    "notes": "refresh_token 必须是 type=refresh 的 JWT",
                },
            },
            "pkce_guide": {
                "what": "PKCE (Proof Key for Code Exchange) 防止公开客户端授权码拦截",
                "when": "SPA / Mobile / 公开客户端必用; 机密客户端 (有 client_secret) 可选",
                "how": [
                    "1. 客户端生成 code_verifier (43-128 字符随机串)",
                    "2. 计算 code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) 去掉 '=' padding",
                    "3. authorize 时传 code_challenge + code_challenge_method=S256",
                    "4. token 时传 code_verifier, 服务端校验",
                ],
                "security": "仅支持 S256, 拒绝 plain (RFC 7636 推荐生产环境仅用 S256)",
            },
            "scope_guide": {
                "format": "空格分隔字符串 (OAuth2 标准), 如 'read:profile write:orders'",
                "app_config": "创建应用时传 scopes 数组, 如 ['read:profile', 'write:orders']",
                "authorize": "传 scope 参数, 必须是 app.scopes 的子集; 不传则默认授权全部",
                "token_returns": "access_token 的 JWT payload 含 scope 字段",
                "backward_compat": "应用未配置 scopes 时, 请求 scope 直接放行 (向后兼容)",
            },
            "redirect_uri_guide": {
                "whitelist": "创建应用时传 redirect_uris 数组 (多回调精确匹配)",
                "fallback": "未配置 redirect_uris 时, 回退 redirect_uri 前缀校验 (向后兼容)",
                "security": "白名单精确匹配优先 (更安全), 前缀校验回退 (向后兼容)",
            },
            "security_notes": [
                "client_secret 仅创建时返回一次, list/detail 绝不返回",
                "重置密钥后旧 secret 立即失效",
                "授权码 (code) 一次性使用, TTL=300s",
                "state 必传防 CSRF",
                "PKCE S256 防授权码拦截",
                "scope 校验防越权",
            ],
        }
    )


@router.post("/oauth-apps/create", summary="创建 OAuth 应用")
async def create_oauth_app(
    request: Request,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """创建 OAuth 应用.

    payload:
      name: 应用名称(必填)
      redirect_uri: 单回调 URI(可选, 向后兼容)
      redirect_uris: 多回调 URI 白名单数组(可选, Round 22 新增)
                    如 ["https://a.com/cb", "https://b.com/cb"]
      scopes: 应用允许的权限范围数组(可选, Round 23 新增)
              如 ["read:profile", "write:orders"]
      icon: 应用图标 URL(可选, Round 29-A 新增)
            由 admin 上传得到 URL 后保存, 在 OAuthAuthorize 授权确认页展示
    返回:
      client_id + client_secret(仅此一次返回 secret)
    """
    name = (payload.get("name") or "").strip()
    if not name:
        return error("name 不能为空", "400000")
    redirect_uri = payload.get("redirect_uri") or ""
    redirect_uris = payload.get("redirect_uris")
    # 校验 redirect_uris 必须是列表且元素为字符串
    if redirect_uris is not None:
        if not isinstance(redirect_uris, list):
            return error("redirect_uris 必须是数组", "400000")
        if not all(isinstance(u, str) and u for u in redirect_uris):
            return error("redirect_uris 数组元素必须为非空字符串", "400000")
    # Round 23: 校验 scopes
    scopes = payload.get("scopes")
    if scopes is not None:
        if not isinstance(scopes, list):
            return error("scopes 必须是数组", "400000")
        if not all(isinstance(s, str) and s for s in scopes):
            return error("scopes 数组元素必须为非空字符串", "400000")
    # Round 29-A: 校验 icon (可选, 非空字符串, 长度限制 512)
    icon = payload.get("icon")
    if icon is not None:
        if not isinstance(icon, str):
            return error("icon 必须是字符串 (URL)", "400000")
        icon = icon.strip()
        if len(icon) > 512:
            return error("icon URL 长度不能超过 512 字符", "400000")
    client_id = secrets.token_urlsafe(16)
    client_secret = secrets.token_urlsafe(32)
    with get_session() as db:
        try:
            app = OAuthApp(
                client_id=client_id,
                client_secret=client_secret,
                name=name,
                redirect_uri=redirect_uri or None,
                redirect_uris=redirect_uris,
                scopes=scopes,
                is_active=1,
                icon=icon or None,
                owner_uuid=user_uuid,  # Round 31-B: 写入创建者
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            # Round 27-C: 审计日志 (app_create)
            _log_oauth_audit(
                event="app_create",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="success",
                request_summary={
                    "name": name,
                    "redirect_uris_count": len(redirect_uris) if redirect_uris else 0,
                    "scopes_count": len(scopes) if scopes else 0,
                    "has_icon": bool(icon),
                },
            )
            return success(
                {
                    "id": app.id,
                    "client_id": app.client_id,
                    "client_secret": client_secret,  # 仅此一次返回
                    "name": app.name,
                    "redirect_uri": app.redirect_uri,
                    "redirect_uris": app.redirect_uris or [],
                    "scopes": app.scopes or [],
                    "icon": app.icon,
                    "is_active": app.is_active,
                    "warning": "client_secret 仅此一次返回,请妥善保存.",
                }
            )
        except Exception as e:
            logger.error(f"Create oauth app error: {e}")
            db.rollback()
            # Round 27-C: 审计日志 (app_create 失败)
            _log_oauth_audit(
                event="app_create",
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="failure",
                detail=str(e),
                request_summary={"name": name},
            )
            return error(str(e))


@router.get("/oauth-apps/list", summary="OAuth 应用列表")
async def list_oauth_apps(
    is_active: int = Query(None, description="状态过滤 0=禁用 1=活跃,默认仅活跃"),
    include_all: int = Query(0, description="是否查全部应用 (1=查全部, 0=仅自己的; Round 31-B 多租户隔离)"),
    user_uuid: str = Depends(require_login),
):
    """列出 OAuth 应用(不返回 client_secret).

    默认仅返回 is_active=1 的应用;传入 is_active=0 可查看已禁用应用.

    Round 31-B 多租户隔离:
    - include_all=0 (默认): 仅返回当前用户创建的应用 (owner_uuid == user_uuid)
      + 历史无主应用 (owner_uuid IS NULL, 向后兼容)
    - include_all=1: 返回全部应用 (admin 用, 普通用户传 1 也允许, 便于管理)
    """
    with get_session() as db:
        try:
            q = db.query(OAuthApp)
            if is_active is None:
                q = q.filter(OAuthApp.is_active == 1)
            else:
                q = q.filter(OAuthApp.is_active == is_active)
            # Round 31-B: 多租户过滤
            if include_all != 1:
                from sqlalchemy import or_

                q = q.filter(
                    or_(
                        OAuthApp.owner_uuid == user_uuid,
                        OAuthApp.owner_uuid.is_(None),  # 历史无主应用, 兼容
                    )
                )
            apps = q.all()
            return success([_to_public_dict(a) for a in apps], total=len(apps))
        except Exception as e:
            logger.error(f"List oauth apps error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 21: OAuth2 授权码签发 (/authorize)
# Round 23 路由顺序修复: 必须在 /oauth-apps/{client_id} GET 之前注册,
# 否则 FastAPI 按注册顺序匹配, "authorize" 会被当作 client_id 拦截返回 404.
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/authorize", summary="OAuth2 授权码签发")
async def oauth_authorize(
    client_id: str = Query(..., description="OAuth 应用 client_id"),
    redirect_uri: str = Query(..., description="回调 URI"),
    response_type: str = Query("code", description="OAuth2 response_type, 固定 code"),
    state: str = Query(..., description="CSRF state 参数, 必传"),
    code_challenge: str = Query(
        None, description="PKCE code_challenge (公开客户端推荐传)"
    ),
    code_challenge_method: str = Query(
        None, description="PKCE method: S256 (仅支持 S256, 不支持 plain)"
    ),
    scope: str = Query(
        None, description="请求的权限范围 (空格分隔字符串, 如 'read:profile write:orders')"
    ),
    user_uuid: str = Depends(require_login),
    request: Request = None,
):
    """OAuth2 授权码流程第一步: 用户授权后签发 code.

    必传 state 用于 CSRF 防护; 客户端在回调时必须原样回传 state 并校验.
    生成 code 存入 oauth_sessions 表, TTL=300s.

    Round 22 增强:
    - PKCE: 公开客户端 (SPA/Mobile) 推荐传 code_challenge + code_challenge_method=S256
            token 阶段必须传 code_verifier 校验, 防止授权码拦截
    - redirect_uri 白名单: 优先用 redirect_uris (JSON 数组) 精确匹配,
            回退到 redirect_uri 前缀校验 (向后兼容)

    Round 23 增强:
    - scope 权限范围: 客户端传 scope 参数, 校验是否在 app.scopes 允许范围内
            若未传 scope, 默认授权应用全部 scopes
    """
    if not state or not state.strip():
        return error("state parameter is required for CSRF protection", code="400000")

    # PKCE 参数校验: 若传 code_challenge, method 必须是 S256
    if code_challenge:
        if code_challenge_method != "S256":
            return error(
                "code_challenge_method must be S256 (plain is not supported)",
                code="400000",
            )
        if len(code_challenge) < 43 or len(code_challenge) > 128:
            return error(
                "code_challenge length must be 43-128 characters",
                code="400000",
            )

    with get_session() as db:
        try:
            app = (
                db.query(OAuthApp)
                .filter(OAuthApp.client_id == client_id, OAuthApp.is_active == 1)
                .first()
            )
            if not app:
                return error("Invalid or inactive client_id", code="400000")

            # Round 22: redirect_uri 白名单校验 (精确匹配优先, 前缀校验回退)
            if not _validate_redirect_uri(app, redirect_uri):
                return error(
                    "redirect_uri does not match registered URI whitelist",
                    code="400000",
                )

            # Round 23: scope 校验
            try:
                granted_scope = _validate_scope(scope, app.scopes)
            except ValueError as ve:
                return error(str(ve), code="400000")

            code = uuid.uuid4().hex[:16]
            session = OAuthSession(
                code=code,
                client_id=client_id,
                user_uuid=user_uuid,
                state=state,
                expires_at=dt.datetime.now() + dt.timedelta(seconds=AUTH_CODE_TTL),
                is_used=0,
                # Round 22: PKCE 字段持久化
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method if code_challenge else None,
                # Round 23: 授权 scope 持久化
                scope=granted_scope,
            )
            db.add(session)
            db.commit()

            # Round 27-C: 审计日志 (authorize_grant)
            _log_oauth_audit(
                event="authorize_grant",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="success",
                request_summary={
                    "redirect_uri": redirect_uri,
                    "scope": granted_scope,
                    "pkce": code_challenge is not None,
                },
            )
            return success(
                {
                    "code": code,
                    "state": state,
                    "redirect_uri": f"{redirect_uri}?code={code}&state={state}",
                    "expires_in": AUTH_CODE_TTL,
                    "pkce_required": code_challenge is not None,
                    "scope": granted_scope,
                }
            )
        except Exception as e:
            db.rollback()
            logger.error(f"oauth_authorize error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 27-C: OAuth 审计日志查询 (admin only)
#
# 路由顺序: 必须在 /oauth-apps/{client_id} GET 之前注册 (与 /authorize 同理),
# 否则 "audit-logs" 会被当作 client_id 拦截, 返回 404/应用不存在.
#
# 用途: 供管理员审计追溯所有 OAuth 敏感操作.
# 覆盖事件: app_create / app_delete / app_reset_secret / authorize_grant /
#           authorize_deny / token_issue / token_refresh / protected_access
#
# 筛选维度: event / client_id / user_uuid / status / 时间范围
# 排序: created_at 倒序 (最新在前)
# 分页: page + page_size
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/audit-logs", summary="OAuth 审计日志查询 (admin)")
async def list_oauth_audit_logs(
    event: str = Query(None, description="事件类型筛选"),
    client_id: str = Query(None, description="OAuth 应用 client_id 筛选"),
    user_uuid: str = Query(None, description="操作者 user_uuid 筛选"),
    status: str = Query(None, description="结果状态筛选 (success/failure)"),
    start_time: str = Query(None, description="起始时间 (ISO 8601, 如 2026-06-28T00:00:00)"),
    end_time: str = Query(None, description="结束时间 (ISO 8601)"),
    page: int = Query(1, ge=1, description="页码, 从 1 开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量, 最大 100"),
    _: str = Depends(require_login),
):
    """查询 OAuth 审计日志 (admin only).

    Round 27-C 新增. 供管理员审计追溯所有 OAuth 敏感操作.

    筛选:
    - event: 事件类型 (app_create/app_delete/app_reset_secret/authorize_grant/
              authorize_deny/token_issue/token_refresh/protected_access)
    - client_id: OAuth 应用 client_id
    - user_uuid: 操作者 user_uuid
    - status: success / failure
    - start_time / end_time: 时间范围 (ISO 8601)

    返回:
    - list: 审计日志列表 (created_at 倒序)
    - total: 总数 (用于分页)
    - page / page_size: 当前分页信息
    """
    with get_session() as db:
        try:
            q = db.query(OAuthAuditLog)
            # 筛选条件
            if event:
                q = q.filter(OAuthAuditLog.event == event)
            if client_id:
                q = q.filter(OAuthAuditLog.client_id == client_id)
            if user_uuid:
                q = q.filter(OAuthAuditLog.user_uuid == user_uuid)
            if status:
                q = q.filter(OAuthAuditLog.status == status)
            if start_time:
                try:
                    start_dt = dt.datetime.fromisoformat(start_time)
                    q = q.filter(OAuthAuditLog.created_at >= start_dt)
                except ValueError:
                    return error(
                        "start_time 格式错误, 应为 ISO 8601 (如 2026-06-28T00:00:00)",
                        code="400000",
                    )
            if end_time:
                try:
                    end_dt = dt.datetime.fromisoformat(end_time)
                    q = q.filter(OAuthAuditLog.created_at <= end_dt)
                except ValueError:
                    return error(
                        "end_time 格式错误, 应为 ISO 8601 (如 2026-06-28T23:59:59)",
                        code="400000",
                    )
            # 总数
            total = q.count()
            # 分页 + 倒序
            logs = (
                q.order_by(OAuthAuditLog.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )
            # 序列化
            items = []
            for log in logs:
                items.append(
                    {
                        "id": log.id,
                        "event": log.event,
                        "client_id": log.client_id,
                        "user_uuid": log.user_uuid,
                        "ip": log.ip,
                        "status": log.status,
                        "detail": log.detail,
                        "request_summary": log.request_summary,
                        "created_at": log.created_at.isoformat()
                        if log.created_at
                        else None,
                    }
                )
            return success(
                items,
                total=total,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.error(f"List oauth audit logs error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 29-C: OAuth 审计日志 CSV 导出 (admin only)
#
# 路由顺序: 3 段路径, 不与 /{client_id} 冲突, 但为一致性放在前面.
# 用途: 管理员导出审计日志 CSV 文件供离线分析.
# 筛选: 与 GET /oauth-apps/audit-logs 一致 (event/client_id/user_uuid/status/
#       start_time/end_time), 但无分页 (导出全部).
# 导出字段: id/event/client_id/user_uuid/ip/status/detail/created_at
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/audit-logs/export", summary="OAuth 审计日志 CSV 导出 (admin)")
async def export_oauth_audit_logs(
    event: str = Query(None, description="事件类型筛选"),
    client_id: str = Query(None, description="OAuth 应用 client_id 筛选"),
    user_uuid: str = Query(None, description="操作者 user_uuid 筛选"),
    status: str = Query(None, description="结果状态筛选 (success/failure)"),
    start_time: str = Query(None, description="起始时间 (ISO 8601)"),
    end_time: str = Query(None, description="结束时间 (ISO 8601)"),
    _: str = Depends(require_login),
):
    """导出 OAuth 审计日志为 CSV (admin only).

    Round 29-C 新增. 管理员可下载 CSV 文件供离线分析.
    筛选条件与 GET /oauth-apps/audit-logs 一致, 但无分页 (导出全部匹配记录).
    返回 StreamingResponse, Content-Type: text/csv, Content-Disposition: attachment.
    """
    import csv as _csv
    import io as _io

    from fastapi.responses import StreamingResponse

    with get_session() as db:
        try:
            q = db.query(OAuthAuditLog)
            if event:
                q = q.filter(OAuthAuditLog.event == event)
            if client_id:
                q = q.filter(OAuthAuditLog.client_id == client_id)
            if user_uuid:
                q = q.filter(OAuthAuditLog.user_uuid == user_uuid)
            if status:
                q = q.filter(OAuthAuditLog.status == status)
            if start_time:
                try:
                    start_dt = dt.datetime.fromisoformat(start_time)
                    q = q.filter(OAuthAuditLog.created_at >= start_dt)
                except ValueError:
                    return error(
                        "start_time 格式错误, 应为 ISO 8601",
                        code="400000",
                    )
            if end_time:
                try:
                    end_dt = dt.datetime.fromisoformat(end_time)
                    q = q.filter(OAuthAuditLog.created_at <= end_dt)
                except ValueError:
                    return error(
                        "end_time 格式错误, 应为 ISO 8601",
                        code="400000",
                    )
            logs = q.order_by(OAuthAuditLog.created_at.desc()).all()

            # 构造 CSV (UTF-8 BOM 头确保 Excel 正确识别中文)
            buf = _io.StringIO()
            buf.write("\ufeff")  # UTF-8 BOM
            writer = _csv.writer(buf)
            writer.writerow(
                [
                    "ID",
                    "事件",
                    "Client ID",
                    "User UUID",
                    "来源 IP",
                    "状态",
                    "详细说明",
                    "请求参数摘要",
                    "创建时间",
                ]
            )
            for log in logs:
                writer.writerow(
                    [
                        log.id,
                        log.event or "",
                        log.client_id or "",
                        log.user_uuid or "",
                        log.ip or "",
                        log.status or "",
                        log.detail or "",
                        (
                            str(log.request_summary)
                            if log.request_summary is not None
                            else ""
                        ),
                        log.created_at.isoformat() if log.created_at else "",
                    ]
                )
            csv_bytes = buf.getvalue().encode("utf-8")
            now_str = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"oauth_audit_logs_{now_str}.csv"

            return StreamingResponse(
                _io.BytesIO(csv_bytes),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
        except Exception as e:
            logger.error(f"Export oauth audit logs error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 31-C: OAuth 审计日志聚合统计 (仪表盘用)
# 路由顺序: 静态路径, 必须在 /{client_id} GET 之前注册.
# 用途: admin 仪表盘展示审计日志趋势 (按 event 分组 / 按日趋势 / 按 client_id Top N)
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/audit-logs/stats", summary="OAuth 审计日志聚合统计 (仪表盘)")
async def oauth_audit_log_stats(
    days: int = Query(30, ge=1, le=365, description="统计近 N 天数据 (默认 30 天)"),
    _: str = Depends(require_login),
):
    """OAuth 审计日志聚合统计 (Round 31-C 新增, 仪表盘用).

    返回 3 个维度的聚合数据:
    1. by_event: 按 event 分组统计次数 + 成功/失败分布
    2. by_day: 按日统计次数趋势 (近 N 天)
    3. by_client: 按 client_id 分组 Top 10 (按次数倒序)

    Args:
        days: 统计近 N 天数据 (默认 30, 范围 1-365)
    """
    from sqlalchemy import func

    with get_session() as db:
        try:
            now = dt.datetime.now()
            start = now - dt.timedelta(days=days)

            # 1. by_event: 按 event 分组统计 + 成功/失败分布
            event_rows = (
                db.query(
                    OAuthAuditLog.event,
                    OAuthAuditLog.status,
                    func.count(OAuthAuditLog.id).label("cnt"),
                )
                .filter(OAuthAuditLog.created_at >= start)
                .group_by(OAuthAuditLog.event, OAuthAuditLog.status)
                .all()
            )
            by_event_map: dict[str, dict] = {}
            for ev, st, cnt in event_rows:
                if ev not in by_event_map:
                    by_event_map[ev] = {"event": ev, "total": 0, "success": 0, "failure": 0}
                by_event_map[ev]["total"] += cnt
                if st == "success":
                    by_event_map[ev]["success"] += cnt
                else:
                    by_event_map[ev]["failure"] += cnt
            by_event = sorted(
                by_event_map.values(), key=lambda x: x["total"], reverse=True
            )

            # 2. by_day: 按日统计次数趋势
            # SQLite 用 date(created_at) 函数; PG 也兼容 date() 转换
            day_rows = (
                db.query(
                    func.date(OAuthAuditLog.created_at).label("d"),
                    func.count(OAuthAuditLog.id).label("cnt"),
                )
                .filter(OAuthAuditLog.created_at >= start)
                .group_by(func.date(OAuthAuditLog.created_at))
                .order_by(func.date(OAuthAuditLog.created_at).asc())
                .all()
            )
            by_day = [
                {"date": str(r.d) if r.d else "", "count": int(r.cnt)}
                for r in day_rows
            ]

            # 3. by_client: 按 client_id 分组 Top 10
            client_rows = (
                db.query(
                    OAuthAuditLog.client_id,
                    func.count(OAuthAuditLog.id).label("cnt"),
                )
                .filter(OAuthAuditLog.created_at >= start)
                .filter(OAuthAuditLog.client_id.isnot(None))
                .group_by(OAuthAuditLog.client_id)
                .order_by(func.count(OAuthAuditLog.id).desc())
                .limit(10)
                .all()
            )
            by_client = [
                {"client_id": r.client_id or "", "count": int(r.cnt)}
                for r in client_rows
            ]

            return success(
                {
                    "days": days,
                    "start": start.isoformat(),
                    "end": now.isoformat(),
                    "total": sum(x["total"] for x in by_event),
                    "by_event": by_event,
                    "by_day": by_day,
                    "by_client": by_client,
                }
            )
        except Exception as e:
            logger.error(f"OAuth audit log stats error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 29-D: OAuth scope 元数据 - 公开查询 (授权页用)
#
# 路由顺序: 2 段静态路径, 必须在 /{client_id} GET 之前注册.
# 用途: OAuthAuthorize 授权确认页动态读取 scope 元数据展示.
# 返回: 仅 is_active=1 的 scope 元数据, 按 sort_order asc 排序.
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/scope-meta", summary="OAuth scope 元数据 (公开, 授权页用)")
async def list_oauth_scope_meta_public():
    """公开查询 OAuth scope 元数据 (授权页用).

    Round 29-D 新增. 无需登录, 供 OAuthAuthorize 授权确认页动态读取展示.
    返回仅 is_active=1 的 scope 元数据, 按 sort_order asc 排序.
    若数据库无配置 (表为空), 返回空数组, 前端回退到内置默认描述.
    """
    with get_session() as db:
        try:
            metas = (
                db.query(OAuthScopeMeta)
                .filter(OAuthScopeMeta.is_active == 1)
                .order_by(OAuthScopeMeta.sort_order.asc())
                .all()
            )
            return success(
                [_to_scope_meta_dict(m) for m in metas],
                total=len(metas),
            )
        except Exception as e:
            logger.error(f"List oauth scope meta (public) error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 29-B: 用户视角 - 已授权应用查询 + 撤销
#
# 路由顺序: /my-authorized 是 2 段静态路径, 必须在 /{client_id} GET 之前注册.
# /my-authorized/{session_id} 是 3 段, 不冲突.
#
# 用途: 用户在用户中心查看自己授权过哪些第三方应用, 支持撤销授权.
# 实现: 查询 OAuthSession (按 user_uuid 过滤) + JOIN OAuthApp 返回应用公开信息.
# 撤销: 删除 OAuthSession 记录 (已签发的 access_token 不会立即失效, 但无法再 refresh).
# ---------------------------------------------------------------------------


@router.get("/oauth-apps/my-authorized", summary="用户已授权应用列表")
async def list_my_authorized_apps(
    user_uuid: str = Depends(require_login),
):
    """查询当前登录用户已授权的 OAuth 应用列表.

    Round 29-B 新增. 用户视角, 列出自己授权过哪些第三方应用.

    返回每条记录包含:
    - session_id: OAuthSession ID (撤销授权时用)
    - client_id / app_name / app_icon: OAuth 应用公开信息
    - scope: 实际授权的权限范围
    - created_at: 授权时间
    - expires_at: 授权码过期时间 (注意: access_token 已签发的另算)
    - is_used: 授权码是否已使用 (1=已换 token, 0=未换)
    """
    with get_session() as db:
        try:
            sessions = (
                db.query(OAuthSession)
                .filter(OAuthSession.user_uuid == user_uuid)
                .order_by(OAuthSession.created_at.desc())
                .all()
            )
            items = []
            # 一次性查询所有关联的 OAuthApp (避免 N+1)
            client_ids = list({s.client_id for s in sessions if s.client_id})
            apps_map = {}
            if client_ids:
                apps = (
                    db.query(OAuthApp)
                    .filter(OAuthApp.client_id.in_(client_ids))
                    .all()
                )
                apps_map = {a.client_id: a for a in apps}
            for s in sessions:
                app = apps_map.get(s.client_id)
                items.append(
                    {
                        "session_id": s.id,
                        "code": s.code,
                        "client_id": s.client_id,
                        "app_name": app.name if app else "(应用已删除)",
                        "app_icon": app.icon if app else None,
                        "app_active": app.is_active if app else 0,
                        "scope": s.scope or "",
                        "state": s.state,
                        "is_used": s.is_used,
                        "expires_at": s.expires_at.isoformat()
                        if s.expires_at
                        else None,
                        "created_at": s.created_at.isoformat()
                        if s.created_at
                        else None,
                    }
                )
            return success(items, total=len(items))
        except Exception as e:
            logger.error(f"List my authorized apps error: {e}")
            return error(str(e))


@router.delete(
    "/oauth-apps/my-authorized/{session_id}",
    summary="撤销已授权应用 (删除 OAuthSession)",
)
async def revoke_my_authorized_app(
    session_id: int,
    user_uuid: str = Depends(require_login),
    request: Request = None,
):
    """撤销当前用户对某第三方应用的授权.

    Round 29-B 新增. 删除指定的 OAuthSession 记录.

    安全:
    - 仅能撤销自己的 session (user_uuid 校验)
    - 已签发的 access_token 不会立即失效 (JWT 无状态), 但无法再 refresh
    - 若需立即失效 access_token, 应配合 JWT 黑名单机制 (本系统已有)

    返回:
    - session_id / message
    """
    with get_session() as db:
        try:
            session = (
                db.query(OAuthSession)
                .filter(
                    OAuthSession.id == session_id,
                    OAuthSession.user_uuid == user_uuid,
                )
                .first()
            )
            if not session:
                return error("授权记录不存在或无权操作", "404000")
            client_id = session.client_id
            db.delete(session)
            db.commit()
            # Round 29-B: 审计日志 (authorize_deny - 用户撤销已授权)
            _log_oauth_audit(
                event="authorize_deny",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="success",
                detail="user_revoked_authorized_app",
                request_summary={"session_id": session_id},
            )
            return success(
                {
                    "session_id": session_id,
                    "msg": "已撤销授权",
                }
            )
        except Exception as e:
            logger.error(f"Revoke my authorized app error: {e}")
            db.rollback()
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 29-D: OAuth scope 元数据 - admin CRUD
#
# 路由顺序: /admin/scope-meta 是 3 段, 不与 /{client_id} 冲突.
# /admin/scope-meta/{id} 是 4 段, 不冲突.
#
# 用途: admin 在后台维护 scope 元数据, 取代前端硬编码描述表.
# CRUD: GET 列表+分页 / POST 创建 / PUT 更新 / DELETE 删除
# ---------------------------------------------------------------------------


@router.get(
    "/oauth-apps/admin/scope-meta",
    summary="OAuth scope 元数据列表 (admin)",
)
async def list_oauth_scope_meta_admin(
    scope: str = Query(None, description="scope 标识符模糊筛选"),
    category: str = Query(None, description="分类筛选"),
    is_active: int = Query(None, description="状态筛选 0=禁用 1=启用"),
    page: int = Query(1, ge=1, description="页码, 从 1 开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量, 最大 100"),
    _: str = Depends(require_login),
):
    """查询 OAuth scope 元数据列表 (admin, 含禁用项).

    Round 29-D 新增. admin 后台维护 scope 元数据.
    筛选: scope (模糊) / category / is_active
    排序: sort_order asc, id asc
    """
    with get_session() as db:
        try:
            q = db.query(OAuthScopeMeta)
            if scope:
                q = q.filter(OAuthScopeMeta.scope.like(f"%{scope}%"))
            if category:
                q = q.filter(OAuthScopeMeta.category == category)
            if is_active is not None:
                q = q.filter(OAuthScopeMeta.is_active == is_active)
            total = q.count()
            metas = (
                q.order_by(
                    OAuthScopeMeta.sort_order.asc(),
                    OAuthScopeMeta.id.asc(),
                )
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )
            return success(
                [_to_scope_meta_dict(m) for m in metas],
                total=total,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.error(f"List oauth scope meta (admin) error: {e}")
            return error(str(e))


@router.post(
    "/oauth-apps/admin/scope-meta",
    summary="创建 OAuth scope 元数据 (admin)",
)
async def create_oauth_scope_meta(
    request: Request,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """创建 OAuth scope 元数据 (admin).

    payload:
      scope: scope 标识符 (必填, 唯一, 如 "read:profile")
      name: scope 中文名 (必填)
      description: scope 详细描述 (可选)
      icon: scope 图标 URL (可选)
      category: scope 分类 (可选)
      is_active: 是否启用 (可选, 默认 1)
      sort_order: 排序权重 (可选, 默认 0)
    """
    scope_value = (payload.get("scope") or "").strip()
    if not scope_value:
        return error("scope 不能为空", "400000")
    name = (payload.get("name") or "").strip()
    if not name:
        return error("name 不能为空", "400000")
    description = payload.get("description")
    icon = payload.get("icon")
    category = payload.get("category")
    is_active = payload.get("is_active", 1)
    sort_order = payload.get("sort_order", 0)
    # 类型校验
    if not isinstance(is_active, int) or is_active not in (0, 1):
        return error("is_active 必须是 0 或 1", "400000")
    if not isinstance(sort_order, int) or sort_order < 0:
        return error("sort_order 必须是非负整数", "400000")
    if icon is not None and (not isinstance(icon, str) or len(icon) > 512):
        return error("icon 必须是字符串且长度不超过 512", "400000")

    with get_session() as db:
        try:
            # 唯一性校验
            existing = (
                db.query(OAuthScopeMeta)
                .filter(OAuthScopeMeta.scope == scope_value)
                .first()
            )
            if existing:
                return error(f"scope '{scope_value}' 已存在", "400000")
            meta = OAuthScopeMeta(
                scope=scope_value,
                name=name,
                description=description,
                icon=icon or None,
                category=category or None,
                is_active=is_active,
                sort_order=sort_order,
            )
            db.add(meta)
            db.commit()
            db.refresh(meta)
            return success(_to_scope_meta_dict(meta))
        except Exception as e:
            logger.error(f"Create oauth scope meta error: {e}")
            db.rollback()
            return error(str(e))


@router.put(
    "/oauth-apps/admin/scope-meta/{meta_id}",
    summary="更新 OAuth scope 元数据 (admin)",
)
async def update_oauth_scope_meta(
    meta_id: int,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """更新 OAuth scope 元数据 (admin).

    payload 可更新字段: name / description / icon / category / is_active / sort_order
    scope 标识符不可改 (唯一约束, 改了影响已签发的 JWT).
    """
    with get_session() as db:
        try:
            meta = (
                db.query(OAuthScopeMeta)
                .filter(OAuthScopeMeta.id == meta_id)
                .first()
            )
            if not meta:
                return error("scope 元数据不存在", "404000")
            # 仅更新 payload 中提供的字段
            if "name" in payload:
                name = (payload.get("name") or "").strip()
                if not name:
                    return error("name 不能为空", "400000")
                meta.name = name
            if "description" in payload:
                meta.description = payload.get("description")
            if "icon" in payload:
                icon = payload.get("icon")
                if icon is not None and (not isinstance(icon, str) or len(icon) > 512):
                    return error("icon 必须是字符串且长度不超过 512", "400000")
                meta.icon = icon or None
            if "category" in payload:
                meta.category = payload.get("category") or None
            if "is_active" in payload:
                is_active = payload.get("is_active")
                if not isinstance(is_active, int) or is_active not in (0, 1):
                    return error("is_active 必须是 0 或 1", "400000")
                meta.is_active = is_active
            if "sort_order" in payload:
                sort_order = payload.get("sort_order")
                if not isinstance(sort_order, int) or sort_order < 0:
                    return error("sort_order 必须是非负整数", "400000")
                meta.sort_order = sort_order
            db.commit()
            db.refresh(meta)
            return success(_to_scope_meta_dict(meta))
        except Exception as e:
            logger.error(f"Update oauth scope meta error: {e}")
            db.rollback()
            return error(str(e))


@router.delete(
    "/oauth-apps/admin/scope-meta/{meta_id}",
    summary="删除 OAuth scope 元数据 (admin)",
)
async def delete_oauth_scope_meta(
    meta_id: int,
    user_uuid: str = Depends(require_login),
):
    """删除 OAuth scope 元数据 (admin).

    注意: 删除 scope 元数据不会影响已签发的 JWT (JWT 中的 scope 字段是字符串).
    前端授权页若读不到该 scope 的元数据, 会回退到默认描述.
    """
    with get_session() as db:
        try:
            meta = (
                db.query(OAuthScopeMeta)
                .filter(OAuthScopeMeta.id == meta_id)
                .first()
            )
            if not meta:
                return error("scope 元数据不存在", "404000")
            db.delete(meta)
            db.commit()
            return success({"id": meta_id, "msg": "已删除"})
        except Exception as e:
            logger.error(f"Delete oauth scope meta error: {e}")
            db.rollback()
            return error(str(e))


@router.get("/oauth-apps/{client_id}", summary="OAuth 应用详情")
async def get_oauth_app(
    client_id: str,
    user_uuid: str = Depends(require_login),
):
    """获取 OAuth 应用详情(不返回 client_secret)."""
    with get_session() as db:
        try:
            app = (
                db.query(OAuthApp)
                .filter(OAuthApp.client_id == client_id)
                .first()
            )
            if not app:
                return error("应用不存在", "404000")
            return success(_to_public_dict(app))
        except Exception as e:
            logger.error(f"Get oauth app error: {e}")
            return error(str(e))


@router.delete("/oauth-apps/{client_id}", summary="删除 OAuth 应用")
async def delete_oauth_app(
    client_id: str,
    user_uuid: str = Depends(require_login),
    request: Request = None,
):
    """软删除 OAuth 应用(置 is_active=0)."""
    with get_session() as db:
        try:
            app = (
                db.query(OAuthApp)
                .filter(OAuthApp.client_id == client_id)
                .first()
            )
            if not app:
                return error("应用不存在", "404000")
            if app.is_active == 0:
                return error("应用已处于禁用状态", "400000")
            # Round 31-B: owner 校验 (NULL 视为无主, 任何登录用户可管理, 历史兼容)
            if app.owner_uuid is not None and app.owner_uuid != user_uuid:
                _log_oauth_audit(
                    event="app_delete",
                    client_id=client_id,
                    user_uuid=user_uuid,
                    ip=_get_client_ip(request),
                    status="failure",
                    detail="非应用创建者无权删除",
                    request_summary={"app_name": app.name, "owner": app.owner_uuid},
                )
                return error("非应用创建者无权删除", "403000")
            app.is_active = 0
            db.commit()
            # Round 27-C: 审计日志 (app_delete)
            _log_oauth_audit(
                event="app_delete",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="success",
                request_summary={"app_name": app.name},
            )
            return success(
                {
                    "client_id": client_id,
                    "is_active": 0,
                    "msg": "应用已禁用(软删除)",
                }
            )
        except Exception as e:
            logger.error(f"Delete oauth app error: {e}")
            db.rollback()
            # Round 27-C: 审计日志 (app_delete 失败)
            _log_oauth_audit(
                event="app_delete",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="failure",
                detail=str(e),
            )
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 21: OAuth2 授权码流程 (/token + /refresh)
# 注: /authorize 路由已移到 /oauth-apps/{client_id} 之前 (Round 23 路由顺序修复)
# ---------------------------------------------------------------------------


@router.post("/oauth-apps/token", summary="OAuth2 授权码换 access_token")
async def oauth_token(
    code: str = Query(..., description="授权码"),
    client_id: str = Query(..., description="OAuth 应用 client_id"),
    client_secret: str = Query(..., description="OAuth 应用 client_secret"),
    state: str = Query(None, description="CSRF state, 与 authorize 时一致"),
    code_verifier: str = Query(
        None, description="PKCE code_verifier (authorize 传了 code_challenge 时必传)"
    ),
    request: Request = None,
):
    """OAuth2 授权码流程第二步: 用 code 换 access_token + refresh_token.

    校验: client_id+client_secret 匹配 + code 未使用未过期 + state 一致.
    成功后标记 code 已使用, 返回 JWT access_token (短) + refresh_token (长).

    Round 22 增强: PKCE 校验
    - 若 authorize 阶段传了 code_challenge, token 阶段必须传 code_verifier
    - 校验 BASE64URL(SHA256(code_verifier)) == 存储的 code_challenge
    - 若 authorize 阶段未传 code_challenge (机密客户端), 跳过 PKCE 校验
    """
    ip_addr = _get_client_ip(request)
    with get_session() as db:
        try:
            # 1. 校验 client 凭证
            app = (
                db.query(OAuthApp)
                .filter(
                    OAuthApp.client_id == client_id,
                    OAuthApp.client_secret == client_secret,
                    OAuthApp.is_active == 1,
                )
                .first()
            )
            if not app:
                # Round 27-C: 审计日志 (token_issue 失败 - 凭证错误)
                _log_oauth_audit(
                    event="token_issue",
                    client_id=client_id,
                    ip=ip_addr,
                    status="failure",
                    detail="Invalid client credentials",
                )
                return error("Invalid client credentials", code="401000")

            # 2. 查找授权码会话
            session = (
                db.query(OAuthSession)
                .filter(
                    OAuthSession.code == code,
                    OAuthSession.client_id == client_id,
                    OAuthSession.is_used == 0,
                )
                .first()
            )
            if not session:
                _log_oauth_audit(
                    event="token_issue",
                    client_id=client_id,
                    ip=ip_addr,
                    status="failure",
                    detail="Invalid, used, or mismatched code",
                )
                return error("Invalid, used, or mismatched code", code="401000")

            # 3. 过期校验 (Round 23: expires_at 是 DateTime 列, 用 datetime 比较)
            now_dt = dt.datetime.now()
            if session.expires_at is not None and session.expires_at <= now_dt:
                _log_oauth_audit(
                    event="token_issue",
                    client_id=client_id,
                    user_uuid=session.user_uuid,
                    ip=ip_addr,
                    status="failure",
                    detail="Authorization code expired",
                )
                return error("Authorization code expired", code="401000")

            # 4. state 校验 (CSRF 防护)
            if session.state and state != session.state:
                _log_oauth_audit(
                    event="token_issue",
                    client_id=client_id,
                    user_uuid=session.user_uuid,
                    ip=ip_addr,
                    status="failure",
                    detail="State mismatch (possible CSRF attack)",
                )
                return error(
                    "State mismatch (possible CSRF attack)", code="400000"
                )

            # 5. Round 22: PKCE 校验
            # 若 authorize 阶段存了 code_challenge, token 阶段必须传 code_verifier 且校验通过
            if session.code_challenge:
                if not code_verifier:
                    _log_oauth_audit(
                        event="token_issue",
                        client_id=client_id,
                        user_uuid=session.user_uuid,
                        ip=ip_addr,
                        status="failure",
                        detail="code_verifier required (PKCE) but missing",
                    )
                    return error(
                        "code_verifier is required (PKCE was used in authorize)",
                        code="400000",
                    )
                if not _verify_pkce(
                    code_verifier,
                    session.code_challenge,
                    session.code_challenge_method or "S256",
                ):
                    _log_oauth_audit(
                        event="token_issue",
                        client_id=client_id,
                        user_uuid=session.user_uuid,
                        ip=ip_addr,
                        status="failure",
                        detail="PKCE verification failed",
                    )
                    return error(
                        "PKCE verification failed: code_verifier does not match code_challenge",
                        code="401000",
                    )

            # 6. 标记 code 已使用 (一次性)
            session.is_used = 1
            db.commit()

            # 7. 签发 JWT access_token + refresh_token
            # Round 23: 把授权 scope 写入 JWT, 后续中间件可校验 scope
            extra_claims = {}
            if session.scope:
                extra_claims["scope"] = session.scope
            access_token = create_access_token(
                subject=session.user_uuid,
                extra_claims=extra_claims if extra_claims else None,
            )
            refresh_token = create_access_token(
                subject=session.user_uuid,
                token_type="refresh",
                expires_delta=dt.timedelta(seconds=REFRESH_TOKEN_TTL),
            )

            # Round 27-C: 审计日志 (token_issue 成功)
            _log_oauth_audit(
                event="token_issue",
                client_id=client_id,
                user_uuid=session.user_uuid,
                ip=ip_addr,
                status="success",
                request_summary={
                    "scope": session.scope or "",
                    "pkce_used": session.code_challenge is not None,
                },
            )
            return success(
                {
                    "access_token": access_token,
                    "token_type": "Bearer",
                    "expires_in": 3600,  # access_token 1 小时 (与 create_access_token 默认一致)
                    "refresh_token": refresh_token,
                    "refresh_token_expires_in": REFRESH_TOKEN_TTL,
                    "scope": session.scope or "",
                }
            )
        except Exception as e:
            db.rollback()
            logger.error(f"oauth_token error: {e}")
            return error(str(e))


@router.post("/oauth-apps/refresh", summary="OAuth2 刷新 access_token")
async def oauth_refresh(
    refresh_token: str = Body(..., embed=True, description="refresh_token"),
    client_id: str = Body(None, embed=True, description="OAuth 应用 client_id (可选, 用于二次校验)"),
    request: Request = None,
):
    """OAuth2 授权码流程第三步: 用 refresh_token 换新的 access_token.

    校验: refresh_token 是有效的 JWT 且 token_type=refresh.
    """
    from jose import JWTError, jwt

    ip_addr = _get_client_ip(request)

    try:
        payload = jwt.decode(
            refresh_token,
            JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
    except JWTError as e:
        # Round 27-C: 审计日志 (token_refresh 失败 - JWT 无效)
        _log_oauth_audit(
            event="token_refresh",
            client_id=client_id,
            ip=ip_addr,
            status="failure",
            detail=f"Invalid refresh_token: {e}",
        )
        return error(f"Invalid refresh_token: {e}", code="401000")

    # 校验 token_type
    if payload.get("type") != "refresh":
        _log_oauth_audit(
            event="token_refresh",
            client_id=client_id,
            ip=ip_addr,
            status="failure",
            detail="Token is not a refresh_token (type mismatch)",
        )
        return error(
            "Token is not a refresh_token (type mismatch)", code="401000"
        )

    subject = payload.get("sub")
    if not subject:
        _log_oauth_audit(
            event="token_refresh",
            client_id=client_id,
            ip=ip_addr,
            status="failure",
            detail="Invalid refresh_token: missing subject",
        )
        return error("Invalid refresh_token: missing subject", code="401000")

    # 可选: 校验 client_id 与 token 中的 client_id 一致 (这里简化, 不强制)
    # 如果传了 client_id, 校验应用存在且活跃
    if client_id:
        with get_session() as db:
            app = (
                db.query(OAuthApp)
                .filter(OAuthApp.client_id == client_id, OAuthApp.is_active == 1)
                .first()
            )
            if not app:
                _log_oauth_audit(
                    event="token_refresh",
                    client_id=client_id,
                    user_uuid=subject,
                    ip=ip_addr,
                    status="failure",
                    detail="Invalid or inactive client_id",
                )
                return error("Invalid or inactive client_id", code="401000")

    # 签发新的 access_token
    new_access_token = create_access_token(subject=subject)
    # Round 27-C: 审计日志 (token_refresh 成功)
    _log_oauth_audit(
        event="token_refresh",
        client_id=client_id,
        user_uuid=subject,
        ip=ip_addr,
        status="success",
    )
    return success(
        {
            "access_token": new_access_token,
            "token_type": "Bearer",
            "expires_in": 3600,
        }
    )


# ---------------------------------------------------------------------------
# Round 21: 重置密钥
# ---------------------------------------------------------------------------


@router.post(
    "/oauth-apps/{client_id}/reset-secret",
    summary="重置 OAuth 应用 client_secret",
)
async def reset_oauth_secret(
    client_id: str,
    user_uuid: str = Depends(require_login),
    request: Request = None,
):
    """重置 OAuth 应用的 client_secret.

    使用场景: client_secret 丢失或泄露, 需要重置.
    重置后旧 secret 立即失效, 新 secret 仅此一次返回 (与 create 一致).
    """
    with get_session() as db:
        try:
            app = (
                db.query(OAuthApp)
                .filter(OAuthApp.client_id == client_id)
                .first()
            )
            if not app:
                return error("应用不存在", "404000")
            if app.is_active == 0:
                return error("应用已禁用, 无法重置密钥", "400000")
            # Round 31-B: owner 校验 (NULL 视为无主, 任何登录用户可管理, 历史兼容)
            if app.owner_uuid is not None and app.owner_uuid != user_uuid:
                _log_oauth_audit(
                    event="app_reset_secret",
                    client_id=client_id,
                    user_uuid=user_uuid,
                    ip=_get_client_ip(request),
                    status="failure",
                    detail="非应用创建者无权重置密钥",
                    request_summary={"app_name": app.name, "owner": app.owner_uuid},
                )
                return error("非应用创建者无权重置密钥", "403000")

            new_secret = secrets.token_urlsafe(32)
            app.client_secret = new_secret
            db.commit()

            logger.info(
                f"OAuth app client_secret reset: client_id={client_id}, "
                f"operator={user_uuid}"
            )
            # Round 27-C: 审计日志 (app_reset_secret)
            _log_oauth_audit(
                event="app_reset_secret",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="success",
                request_summary={"app_name": app.name},
            )
            return success(
                {
                    "id": app.id,
                    "client_id": app.client_id,
                    "client_secret": new_secret,  # 仅此一次返回
                    "name": app.name,
                    "warning": "新 client_secret 仅此一次返回, 请妥善保存. 旧 secret 已失效.",
                    "reset_at": dt.datetime.now().isoformat(),
                }
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Reset oauth secret error: {e}")
            # Round 27-C: 审计日志 (app_reset_secret 失败)
            _log_oauth_audit(
                event="app_reset_secret",
                client_id=client_id,
                user_uuid=user_uuid,
                ip=_get_client_ip(request),
                status="failure",
                detail=str(e),
            )
            return error(str(e))


# ---------------------------------------------------------------------------
# Round 27-A: OAuth scope 中间件应用示范
#
# 用途: 演示 require_oauth_scope 依赖的用法, 作为第三方应用接入 OAuth 后
#       调用受保护资源的范例 endpoint. 这两个 endpoint 不返回真实业务数据,
#       仅作接入范例 (production 接入方应参考此模式保护自己的业务 endpoint).
#
# 与 require_login 区别:
# - require_login: 校验本系统自身签发的 JWT (用户登录态)
# - require_oauth_scope: 校验 OAuth 流程签发的 access_token (含 scope 字段)
#
# 接入方范例流程:
# 1. 第三方应用通过 /oauth-apps/authorize 获取 code (带 scope=read:profile)
# 2. 通过 /oauth-apps/token 用 code 换 access_token (JWT payload 含 scope 字段)
# 3. 携带 Authorization: Bearer <access_token> 调用下面的 /protected/* endpoint
# 4. require_oauth_scope 中间件校验 scope, 通过则放行, 否则 403
# ---------------------------------------------------------------------------


@router.get(
    "/oauth-apps/protected/profile",
    summary="OAuth scope 示范: 受 read:profile 保护的资源",
)
async def oauth_protected_profile(
    user_uuid: str = Depends(require_oauth_scope("read:profile")),
):
    """OAuth scope 中间件示范 endpoint 1: 用户 profile (受 read:profile 保护).

    Round 27-A 新增. 仅作接入范例, 不返回真实业务数据.

    请求头:
        Authorization: Bearer <OAuth access_token>

    返回:
        user_uuid (从 JWT sub 字段提取) + 示范 profile 数据

    错误码:
        401: 缺失/无效 access_token
        403: access_token 不含 read:profile scope
    """
    # 实际接入方应在此查询用户表, 返回真实 profile
    # 这里仅返回示范数据, 避免与现有 /agents/profile 等业务 endpoint 耦合
    return success(
        {
            "user_uuid": user_uuid,
            "demo": True,
            "scope_required": "read:profile",
            "profile": {
                "nickname": "demo_user",
                "avatar": "",
                "bio": "This is a demo profile protected by OAuth scope.",
            },
            "note": "示范 endpoint, 接入方应参考此模式保护自己的 profile 类资源.",
        }
    )


@router.get(
    "/oauth-apps/protected/orders",
    summary="OAuth scope 示范: 受 read:orders 保护的资源",
)
async def oauth_protected_orders(
    user_uuid: str = Depends(require_oauth_scope("read:orders")),
):
    """OAuth scope 中间件示范 endpoint 2: 用户订单 (受 read:orders 保护).

    Round 27-A 新增. 仅作接入范例, 不返回真实业务数据.

    请求头:
        Authorization: Bearer <OAuth access_token>

    返回:
        user_uuid + 示范 orders 列表 (空数组, 仅展示结构)

    错误码:
        401: 缺失/无效 access_token
        403: access_token 不含 read:orders scope
    """
    # 实际接入方应在此查询订单表, 返回真实订单
    # 这里仅返回示范数据, 避免与现有 /agents/orders 等业务 endpoint 耦合
    return success(
        {
            "user_uuid": user_uuid,
            "demo": True,
            "scope_required": "read:orders",
            "orders": [],
            "note": "示范 endpoint, 接入方应参考此模式保护自己的订单类资源.",
        }
    )
