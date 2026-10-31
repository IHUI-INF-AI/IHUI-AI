# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""知识卡片 agent 写面路由(挂载在 /api/v1/ai/knowledge-write 前缀;2026-10-31 立)。

对标 Qoder qoder-context 的 8 枚 wiki/knowledge 写工具(PostToolUse hook matcher
逐字印证),出口与身份纪律见 services/knowledge_writer.py 头注;写入判据单一真相源
住 apps/api routes/knowledge-card.ts,本路由零复制。

身份纪律:write 走内部通道(X-User-Id + AI_CALLBACK_SECRET);update/delete/link
走 Bearer(「仅本人」裁决在 api 侧,ai-service 不自解 JWT)。
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from ...core.inbound_identity import inbound_actor_or_401
from ...services.knowledge_writer import knowledge_writer

router = APIRouter()


class WriteCardRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    repoName: str = Field(..., min_length=1, max_length=200)
    kind: str = Field(default="experience")
    tags: list[str] = Field(default_factory=list)
    confidence: int = Field(default=100, ge=0, le=100)
    context: dict[str, Any] | None = None


class UpdateCardRequest(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    content: str | None = None
    tags: list[str] | None = None
    confidence: int | None = Field(default=None, ge=0, le=100)
    context: dict[str, Any] | None = None


class LinkRequest(BaseModel):
    relatedCardId: str
    relation: str = Field(..., min_length=1, max_length=64)
    unlink: bool = False


def _require_internal(request: Request) -> tuple[str | None, dict[str, Any]]:
    """内部通道身份窄化;不合格返回 (None, 401 响应)。

    2026-11-01 安全强化:主体只经 `resolve_inbound_actor`(已验签内网头 / 已验签 JWT)
    取得。原实现把 `Header(alias="X-User-Id")` 的字面值直接当身份,并注释称该头由
    internal_ticket 中间件注入 —— 本进程从无此注入,明文头即客户端可整写,于是任何
    登录用户都能带 `X-User-Id: <受害者 uuid>` 以他人归属写/改/删知识卡。
    """
    return inbound_actor_or_401(request)


def _bearer_token(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip() or None
    return None


@router.post("/cards")
async def write_card(
    req: WriteCardRequest,
    request: Request,
) -> dict[str, Any]:
    """创建知识卡片(内部通道;api 侧标 source='agent')。"""
    user_id, deny = _require_internal(request)
    if deny:
        return deny
    out = await knowledge_writer.write_card(
        title=req.title,
        content=req.content,
        repo_name=req.repoName,
        user_id=user_id,
        kind=req.kind,
        tags=req.tags,
        confidence=req.confidence,
        context=req.context,
    )
    code = 0 if out.get("status") == "ok" else 422
    return {"code": code, "message": out.get("status", ""), "data": out}


@router.patch("/cards/{card_id}")
async def update_card(
    card_id: str,
    req: UpdateCardRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """更新卡片(Bearer「仅本人」通道)。"""
    user_id, deny = _require_internal(request)
    if deny:
        return deny
    api_token = _bearer_token(authorization)
    out = await knowledge_writer.update_card(
        card_id,
        user_id=user_id,
        api_token=api_token,
        title=req.title,
        content=req.content,
        tags=req.tags,
        confidence=req.confidence,
        context=req.context,
    )
    code = 0 if out.get("status") == "ok" else 422
    return {"code": code, "message": out.get("status", ""), "data": out}


@router.delete("/cards/{card_id}")
async def delete_card(
    card_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """删除卡片(Bearer「仅本人」)。"""
    user_id, deny = _require_internal(request)
    if deny:
        return deny
    api_token = _bearer_token(authorization)
    out = await knowledge_writer.delete_card(card_id, user_id=user_id, api_token=api_token)
    code = 0 if out.get("status") == "ok" else 422
    return {"code": code, "message": out.get("status", ""), "data": out}


@router.post("/cards/{card_id}/links")
async def link_cards(
    card_id: str,
    req: LinkRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """链接/解除链接(Bearer;读改写 context.links)。"""
    user_id, deny = _require_internal(request)
    if deny:
        return deny
    api_token = _bearer_token(authorization)
    out = await knowledge_writer.link_cards(
        card_id,
        req.relatedCardId,
        req.relation,
        user_id=user_id,
        api_token=api_token,
        unlink=req.unlink,
    )
    code = 0 if out.get("status") == "ok" else 422
    return {"code": code, "message": out.get("status", ""), "data": out}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
