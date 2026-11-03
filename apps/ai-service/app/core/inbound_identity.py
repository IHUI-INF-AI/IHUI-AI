# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""入站身份裁决的唯一出口(2026-11-01 安全强化立)。

存在的理由 —— 一类真实可利用的混淆代理(confused deputy)

`app/api/v1/{knowledge_fs,knowledge_write,external_import}.py` 三族端点把
`Header(alias="X-User-Id")` 的**字面值直接当调用者身份**,并在注释里声称该头
"经 internal_ticket 中间件注入、LLM 不可控"。那句话是错的:本进程没有任何中间件
注入 `x-user-id`,FastAPI 的 Header 参数读的就是客户端原样送来的请求头。而
`/api/v1/` 不在 `JWT_PUBLIC_PATHS` 里 ⇒ 任何**持合法 JWT 的用户**都能在同一枚请求上
再带一枚 `X-User-Id: <受害者 uuid>`,随后 `internal_service_headers()` 会以该 uuid
为 `sub` 签出内网票打到 apps/api —— 读走别人的代码库切片、把产物写成别人的归属。
即 AGENTS §5「鉴权面公开化必须显式列举 / 身份不得住客户端可整写字段」的同一禁令。

裁决次序(封闭,不做正则猜测)
1. 已验签的内网可信头 `X-IHUI-Principal`(HMAC,密钥未配置即 None ⇒ 拒绝):取其
   **签名载荷里的 sub**,不取随行的明文 `x-user-id`;
2. `JWTAuthMiddleware` 已验签注入的 `request.state.user_id`;
3. 皆无 ⇒ `None`(调用方必须 401,绝不回落成匿名或"人人相同"的默认主体)。

`x-user-id` 明文头在本出口**没有任何投票权**。中间件另有 `_bind_inbound_user_header`
把已验签主体写回该头,作为"仍在直接读 Header 的历史调用点"的兜底;两者读同一份判据,
不各写一份。
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from .jwt_auth import resolve_request_user_id

__all__ = ["resolve_inbound_actor", "inbound_actor_or_401"]


def resolve_inbound_actor(request: Request) -> str | None:
    """返回当前请求的**已验证**主体 id;解析不到即 None(不猜、不默认放开)。"""
    # 1) 内网可信头:只信签名载荷
    state_principal = getattr(request.state, "principal", None)
    principal = state_principal
    if principal is None:
        raw = request.headers.get("x-ihui-principal")
        if raw:
            # 延迟导入:capability_gate 依赖本包的 jwt_auth,顶层互引会成环
            from ..services.capability_gate import verify_principal_header

            principal = verify_principal_header(raw)
    if principal is not None:
        sub = getattr(principal, "sub", None)
        if isinstance(sub, str) and sub.strip():
            kind = getattr(principal, "kind", "")
            if kind in ("internal", "local-stdio", "jwt"):
                return sub.strip()
    # 2) JWT 中间件注入的已验签主体
    user_id = resolve_request_user_id(request)
    if user_id:
        return user_id
    # 3) 没有已验证主体
    return None


def inbound_actor_or_401(request: Request) -> tuple[str | None, dict[str, Any]]:
    """端点级窄化:拿到主体返回 `(id, {})`,否则返回 `(None, 401 响应体)`。

    返回体形状与各路由既有约定一致(`{"code":401,...}`),不新造第二套错误契约。
    """
    actor = resolve_inbound_actor(request)
    if actor:
        return actor, {}
    return None, {
        "code": 401,
        "message": "无法确定调用者身份:归属型能力必须由已验签凭据给出主体",
        "data": None,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
