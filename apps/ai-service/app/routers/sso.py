# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO 路由(企业级补齐最小可用版,2026-09-06 立)。

挂载方式(main.py):app.include_router(sso.router, prefix="/api", tags=["sso"])
端点:
  GET  /api/sso/providers          → 已启用 provider 列表(name + configured 状态)
  GET  /api/sso/{provider}/authorize → 302 跳转 IdP(未配置/未知 provider → 501/404)
  GET  /api/sso/callback             → OIDC 标准回调(code/state query)
  POST /api/sso/callback             → 手工提交 {provider, code}(测试/CLI 场景)

SSO-P2 已实现(2026-09-20):exchange_code 成功后执行 JIT provisioning ——
subject → 本库 sso_identities 首登即建号(app/services/sso_identity_store.py
的 find_or_create_identity),并以与 apps/api 共享的 JWT_SECRET 签发 HS256
access token(claims 严格对齐 app/core/jwt_auth.py 的验证规则,aud=ihui-ai-users)。
JWT_SECRET 未配置(开发环境)时降级为仅回传身份。未配置真实 IdP 时明确 501。
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.sso import (
    SSOConfigError,
    SSOProvider,
    UserIdentity,
    build_provider,
    new_state,
    parse_callback_params,
)
from app.services.sso_identity_store import find_or_create_identity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sso", tags=["sso"])


def _find_provider(name: str) -> SSOProvider:
    try:
        return build_provider(name)
    except SSOConfigError as e:
        # 未知 provider → 404;已知但未配置(如 oidc 缺 issuer/client_id)→ 501
        msg = str(e)
        status = 501 if msg.startswith("OIDC provider 未启用") else 404
        raise HTTPException(status_code=status, detail=msg) from e


@router.get("/providers")
async def list_providers() -> dict[str, Any]:
    """列出启用的 SSO provider 及其配置完整性。"""
    from app.core.sso import list_enabled_providers

    items = []
    for p in list_enabled_providers():
        items.append({
            "name": p.name,
            # OIDCSSOProvider 暴露 configured;mock 恒为可配置
            "configured": bool(getattr(p, "configured", True)),
        })
    return {"code": 0, "message": "ok", "data": {"providers": items}}


@router.get("/{provider}/authorize")
async def authorize(provider: str) -> RedirectResponse:
    """跳转到 IdP 授权页(CSRF state 生成后随 query 传出,存储留 P2)。"""
    p = _find_provider(provider)
    state = new_state()
    try:
        url = p.authorize_url(state=state)
    except SSOConfigError as e:
        raise HTTPException(status_code=501, detail=str(e)) from e
    return RedirectResponse(url=url, status_code=302)


class CallbackRequest(BaseModel):
    provider: str = "mock"
    code: str = ""


# 签发的 access token 有效期(秒);aud 硬编码对齐 jwt_auth._verify_token 的
# audience 参数(与 apps/api packages/auth AUDIENCE 一致,防跨服务 token 误用)
TOKEN_TTL_SECONDS = 3600
JWT_AUDIENCE = "ihui-ai-users"


def _provision_and_sign(identity: UserIdentity) -> dict[str, Any]:
    """JIT 建号 + 签发 access token(同步 sqlite 调用,异步路由内直接调用)。

    claims 严格对齐 app/core/jwt_auth.py 的验证规则(_verify_token /
    verify_access_token):HS256 签名;iss=settings.jwt_issuer;
    aud='ihui-ai-users';type='access'(缺省/非 access 均被拒);
    sub/userId 均写本地 user_uuid(中间件优先读 sub,兼容读 userId);
    phone/roleId/familyId 对齐 apps/api issueTokenPair 的 payload 形状。
    """
    ident = find_or_create_identity(
        identity.provider, identity.subject, identity.email, identity.name
    )
    user_uuid = str(ident["user_uuid"])
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": user_uuid,
        "userId": user_uuid,
        "phone": "",
        "familyId": user_uuid,
        "roleId": 0,
        "type": "access",
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
        "jti": uuid.uuid4().hex,
        "iss": settings.jwt_issuer,
        "aud": JWT_AUDIENCE,
    }
    token = pyjwt.encode(claims, settings.jwt_secret, algorithm="HS256")
    return {
        "user": {"id": user_uuid, "created": bool(ident["created"])},
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": TOKEN_TTL_SECONDS,
        "provisioned": True,
    }


async def _do_exchange(provider_name: str, code: str) -> dict[str, Any]:
    p = _find_provider(provider_name)
    try:
        identity = await p.exchange_code(code)
    except SSOConfigError as e:
        raise HTTPException(status_code=501, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"IdP 交互失败: {e}") from e
    data: dict[str, Any] = {
        "subject": identity.subject,
        "email": identity.email,
        "name": identity.name,
        "provider": identity.provider,
    }
    if not settings.jwt_secret:
        # 未配置 JWT_SECRET(开发环境,对齐 jwt_auth 的跳过判定):不建号不签发,
        # 仅回传身份 —— 与生产 fail-closed 的语义区分开,绝不 500。
        data["provisioned"] = False
        data["message"] = "JWT_SECRET 未配置，仅回传身份（未建号/未签发）"
        return {"code": 0, "message": "ok", "data": data}
    try:
        # SSO-P2: JIT provisioning(首登建号)+ 与 apps/api 共享密钥的 HS256 签发。
        # find_or_create_identity 为同步 sqlite 调用,项目惯例允许在 async 路由直调
        # (参照 approval_persistence);任何失败降级为仅回传身份,不让回调 500。
        data.update(_provision_and_sign(identity))
    except Exception as e:  # noqa: BLE001 - JIT/签发失败必须降级,不阻塞登录回调
        logger.warning("sso JIT provisioning/签发失败(降级仅回传身份): %s", e)
        data["provisioned"] = False
        data["message"] = "JIT 建号/JWT 签发失败，仅回传身份"
    return {"code": 0, "message": "ok", "data": data}


@router.get("/callback")
async def callback_get(request: Request) -> dict[str, Any]:
    """OIDC 标准回调(query: code/state/provider)。"""
    q = dict(request.query_params)
    provider = str(q.get("provider") or "oidc")
    try:
        code, _state = parse_callback_params(q)
    except SSOConfigError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return await _do_exchange(provider, code)


@router.post("/callback")
async def callback_post(req: CallbackRequest) -> dict[str, Any]:
    """手工回调(测试/CLI):body {provider, code}。"""
    if not req.code:
        raise HTTPException(status_code=400, detail="缺少 code")
    return await _do_exchange(req.provider, req.code)
