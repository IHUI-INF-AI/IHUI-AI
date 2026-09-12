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

最小可用边界:exchange_code 成功后仅返回身份 JSON,**不签发本服务 JWT**
(账号 provisioning / JIT 建号留 TODO P2)。未配置真实 IdP 时明确 501。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.core.sso import (
    SSOConfigError,
    SSOProvider,
    build_provider,
    new_state,
    parse_callback_params,
)

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


async def _do_exchange(provider_name: str, code: str) -> dict[str, Any]:
    p = _find_provider(provider_name)
    try:
        identity = await p.exchange_code(code)
    except SSOConfigError as e:
        raise HTTPException(status_code=501, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"IdP 交互失败: {e}") from e
    # TODO(SSO-P2): subject → 本库用户映射(JIT provisioning)+ 签发 JWT
    # (与 apps/api 共享 JWT_SECRET 的 issueTokenPair 链路)。当前仅回传身份。
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "subject": identity.subject,
            "email": identity.email,
            "name": identity.name,
            "provider": identity.provider,
        },
    }


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
