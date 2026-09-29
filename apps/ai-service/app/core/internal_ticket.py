# -*- coding: utf-8 -*-
"""内部服务短期票 —— 发票侧唯一出口(2026-09-27,PROJECT_PLAN 第五十二批·⑤)。

修的是哪一格
------------
``apps/api/src/plugins/internal-service-token.ts`` 原先把 ``X-Internal-Service-Token``
与常驻密钥 ``AI_CALLBACK_SECRET`` 比对。第三十八批只修了**计时维**;票面剩下的那一半
——**密钥常驻、无 TTL、无轮转 ⇒ 泄露一次即可无限重放**——由本模块 + 验票侧同批收口。

为什么不另起一套签名体系
------------------------
签名复用两侧**已经共享**的那把 ``JWT_SECRET``(ai-service 的 ``app/core/jwt_auth.py``
本来就是靠它验 apps/api 签的用户 token),算法 HS256 也与 ``packages/auth/src/jwt.ts``
同档。新增的只有 claim 形状,没有第三把密钥、第三套 HMAC。

跨用途为什么必须拒
------------------
用户 access/refresh token 与内部票**同一把密钥、同一个 issuer**。所以内部票带两道
用户 token 不可能带的标记:``aud=ihui-internal-service``(用户 token 是 ``ihui-ai-users``)
与 ``type=internal-service-ticket``。验票侧两道都判,少一道就是一枚用户 token 被当内部凭据用。

双侧发布顺序(本模块的设计前提,也是票面点名的硬风险)
------------------------------------------------------
发票方与验票方不可能同一瞬间上线。处置是**让发票方的改动变成纯加法**:
兼容窗口内**两把头一起带** —— 旧 ``x-internal-service-token`` 照发(老验票方继续可用),
新 ``x-internal-service-ticket`` 同时发(新验票方立刻能用)。
于是"谁先上线"不再是正确性问题:先上验票方 → 它收到的是旧头,按 ``dual`` 放过;
先上发票方 → 旧头还在,验票方按原逻辑通过。**唯一的破坏性动作**是把验票方翻到 ``ticket`` 档,
而那是一个显式配置变更,判据写在 ``apps/api/src/plugins/internal-service-token.ts`` 末尾。

拿不到 ``jwt_secret`` 时:**只发旧头、不发票**,并打一条 warning。
不静默降级成"票为空字符串"——那会让验票方读到一枚坏票而把整条通道判死。
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from collections.abc import Mapping
from typing import Any

import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# 头名两侧必须逐字相同(验票侧:apps/api/src/plugins/internal-service-ticket.ts)
INTERNAL_TICKET_HEADER = "x-internal-service-ticket"
INTERNAL_TOKEN_HEADER = "x-internal-service-token"
USER_ID_HEADER = "x-user-id"

# claim 形状(与验票侧同值;改一边必须同批改另一边)
INTERNAL_TICKET_AUDIENCE = "ihui-internal-service"
INTERNAL_TICKET_TYPE = "internal-service-ticket"
INTERNAL_TICKET_ALGORITHM = "HS256"

# 用途封闭集。刻意不做成自由字符串:"任何用途"的票等于没有用途绑定。
# 与验票侧 INTERNAL_TICKET_SCOPES 逐项对应,新增一项必须两边同笔。
INTERNAL_TICKET_SCOPES: frozenset[str] = frozenset(
    {
        "ai-callback",  # LLM 回调写入
        "codebase-index",  # 索引服务读写 chunks
        "im-bridge",  # IM 桥接代发
        "mcp-edu",  # MCP 教育管理接口
        "api-tools",  # api_tools_bridge 通用工具面
        "memory",  # /api/memory
        "self-evolution",  # clawdbot 自进化回写
        "registry-sync",  # 注册表漂移检测
    }
)

DEFAULT_TICKET_TTL_SECONDS = 60
MAX_TICKET_TTL_SECONDS = 300


def ticket_ttl_seconds(raw: float | None = None) -> int:
    """把 TTL 归一到 [1, 300] 秒。

    封顶是**发票侧的自我约束**;验票侧还有一道独立封顶(``too_long_lived``),
    两道都在,是因为只要有一边写错就会把"短期票"变成"另一种常驻密钥"。
    """
    if raw is None or raw != raw or raw == float("inf"):  # None / NaN / inf → 默认档
        return DEFAULT_TICKET_TTL_SECONDS
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_TICKET_TTL_SECONDS
    if value <= 0:
        return DEFAULT_TICKET_TTL_SECONDS
    return min(value, MAX_TICKET_TTL_SECONDS)


def jwt_secret_for_ticket() -> str:
    """内部票用的密钥 = 两侧共享的 ``JWT_SECRET``。为空即"本能力未启用"。"""
    secret = str(getattr(settings, "jwt_secret", "") or "").strip()
    if secret:
        return secret
    env_val = str(os.environ.get("JWT_SECRET", "") or "").strip()
    return env_val


def mint_internal_service_ticket(
    user_id: Any,
    scope: str,
    *,
    ttl_seconds: float | None = None,
    now: float | None = None,
    jti: str | None = None,
) -> str | None:
    """签一枚内部服务短期票;``jwt_secret`` 未配置时返回 ``None``(调用方回落旧头)。

    ``user_id`` 为空 → ``None``:票必须绑定主体,否则它比旧密钥更弱
    (旧通道至少还有 X-User-Id 在别处声明主体)。
    """
    uid = str(user_id or "").strip()
    if not uid:
        return None
    if scope not in INTERNAL_TICKET_SCOPES:
        raise ValueError(
            f"未知的内部票用途 {scope!r};封闭集见 INTERNAL_TICKET_SCOPES(新增须两侧同笔)"
        )
    secret = jwt_secret_for_ticket()
    if not secret:
        logger.warning(
            "[internal-ticket] JWT_SECRET 未配置,无法签内部票 —— 本次只带常驻密钥头"
            "(兼容窗口内可用,但这条调用仍落在'泄露即永久可用'的那一档)"
        )
        return None
    issued_at = int(now if now is not None else time.time())
    ttl = ticket_ttl_seconds(ttl_seconds)
    payload: dict[str, Any] = {
        "sub": uid,
        "aud": INTERNAL_TICKET_AUDIENCE,
        "type": INTERNAL_TICKET_TYPE,
        "scope": scope,
        "jti": jti or uuid.uuid4().hex,
        "iat": issued_at,
        "exp": issued_at + ttl,
    }
    try:
        token: Any = jwt.encode(payload, secret, algorithm=INTERNAL_TICKET_ALGORITHM)
    except Exception:  # 签名失败一律不发,而不是发一枚半坏的票
        logger.exception("[internal-ticket] 签发失败,回落常驻密钥头")
        return None
    return token if isinstance(token, str) else token.decode("utf-8")


def internal_service_headers(
    user_id: Any,
    scope: str,
    *,
    legacy_token: str = "",
    extra: Mapping[str, str] | None = None,
    ttl_seconds: float | None = None,
) -> dict[str, str]:
    """构造出站内部服务鉴权头(小写,与既有兄弟模块一致)。

    兼容窗口里**两把头一起带**;``legacy_token`` 由各调用点按自己原有的密钥解析
    传进来(那把钥匙怎么取是另一件事,本模块不改它的语义)。
    """
    headers: dict[str, str] = dict(extra or {})
    if legacy_token:
        headers[INTERNAL_TOKEN_HEADER] = legacy_token
    ticket = mint_internal_service_ticket(user_id, scope, ttl_seconds=ttl_seconds)
    if ticket:
        headers[INTERNAL_TICKET_HEADER] = ticket
    if user_id:
        headers[USER_ID_HEADER] = str(user_id)
    return headers


__all__ = [
    "DEFAULT_TICKET_TTL_SECONDS",
    "INTERNAL_TICKET_ALGORITHM",
    "INTERNAL_TICKET_AUDIENCE",
    "INTERNAL_TICKET_HEADER",
    "INTERNAL_TICKET_SCOPES",
    "INTERNAL_TICKET_TYPE",
    "INTERNAL_TOKEN_HEADER",
    "MAX_TICKET_TTL_SECONDS",
    "USER_ID_HEADER",
    "internal_service_headers",
    "jwt_secret_for_ticket",
    "mint_internal_service_ticket",
    "ticket_ttl_seconds",
]
