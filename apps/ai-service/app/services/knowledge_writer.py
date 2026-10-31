# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""知识卡片 agent 写面(2026-10-31,goal-b43,对标 Qoder Repo Wiki 写工具族)。

对标(goal-b43 Qoder context-plugin 取证):Qoder 的 qoder-context 插件经 MCP 暴露
write_wiki / edit_wiki / delete_wiki / write_knowledge / edit_knowledge /
delete_knowledge / link_knowledge / unlink_knowledge 八枚写工具(PostToolUse hook
matcher 逐字印证),知识条目之间带 link/unlink 关系边。

本仓对位物:**knowledge_cards 表(2026-09-10 已有全写 HTTP 面)+ 本模块的 agent 出口**。
写入判据单一真相源住 apps/api routes/knowledge-card.ts(归属/仅本人/来源标注)——
本模块是它的 ai-service 客户端,**零复制写入判据**(§0.6):

- write_card      → POST /(内部通道 X-Internal-Secret + body.userId 显式归属;
                    api 侧把 source 标为 'agent' —— 与 Qoder PostToolUse
                    knowledge-edit-record 的「编辑留痕」同语义,由 api 侧审计承担)
- update/delete   → PATCH·DELETE /:id(Bearer 用户 JWT,「仅本人」裁决在 api 侧;
                    ai-service 不自解 JWT 主体,§5 身份不从客户端可整写面反推)
- link/unlink     → 读改写 context.links(jsonb;零迁移):{"cardId","relation"}
                    —— 同一卡片的 context 由 GET 读出、合并后 PATCH 写回,
                    中间被他人并发改写时以 PATCH 时点为准(最后写赢,api 侧语义)。

三态诚实(§0.3):secret/身份缺失 ⇒ skipped_missing_identity;卡片不存在 ⇒
card_missing;api 不可用 ⇒ upstream_unavailable;零命中形态不冒充写入成功。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_CARD_KINDS = ("experience", "fact", "practice", "pitfall")
_LINK_RELATION_RE = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")
_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")
_USER_ID_RE = re.compile(r"^[a-zA-Z0-9-]{1,128}$")


def _identity_problem(
    user_id: str | None, secret: str | None, needs_bearer: bool, api_token: str | None
) -> str | None:
    """身份前置判定;返回 None = 可发起,返回字符串 = 三态 detail。"""
    if not user_id or not _USER_ID_RE.fullmatch(user_id):
        return "user_id 未注入:知识写面必须归属到人"
    if needs_bearer:
        if not api_token:
            return "api_token(Bearer)未注入:更新/删除/链接走「仅本人」通道,ai-service 不代解身份"
    elif not secret:
        return "AI_CALLBACK_SECRET 未配置:内部写通道不可用"
    return None


class KnowledgeWriter:
    """知识卡片 agent 写出口(单例 knowledge_writer)。"""

    def __init__(self) -> None:
        self._api_base_url = os.environ.get("API_SERVICE_URL", "http://localhost:8801").rstrip("/")

    def _internal_headers(self, user_id: str | None) -> dict[str, str]:
        secret = (os.environ.get("AI_CALLBACK_SECRET") or "").strip()
        # 调用序契约:身份闸(_identity_problem)先行,此处 user_id 已非 None;
        # 类型层无法表达「闸后必非空」,空值时塞空串让 api 侧 401 兜底(fail-closed)。
        return {"X-Internal-Secret": secret, "X-User-Id": user_id or ""}

    def _bearer_headers(self, api_token: str | None) -> dict[str, str]:
        return {"Authorization": f"Bearer {api_token}"}

    async def _request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any] | None = None,
    ) -> tuple[int, dict[str, Any] | None]:
        url = f"{self._api_base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(method, url, headers=headers, json=json_body)
        except httpx.HTTPError as e:
            logger.warning("knowledge_writer 请求失败 %s %s: %s", method, path, e)
            return 0, None
        if resp.status_code >= 400:
            return resp.status_code, None
        try:
            return resp.status_code, resp.json() or {}
        except ValueError:
            return resp.status_code, {}

    async def write_card(
        self,
        *,
        title: str,
        content: str,
        repo_name: str,
        user_id: str | None,
        kind: str = "experience",
        tags: list[str] | None = None,
        confidence: int = 100,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """创建知识卡片(内部通道;api 侧标 source='agent')。"""
        secret = (os.environ.get("AI_CALLBACK_SECRET") or "").strip()
        problem = _identity_problem(user_id, secret, needs_bearer=False, api_token=None)
        if problem:
            return {"status": "skipped_missing_identity", "detail": problem}
        if not title.strip() or not content.strip() or not repo_name.strip():
            return {"status": "invalid_input", "detail": "title/content/repo_name 皆必填"}
        if kind not in _CARD_KINDS:
            return {"status": "invalid_input", "detail": f"kind 只认 {list(_CARD_KINDS)}"}
        code, payload = await self._request(
            "POST",
            "/api/knowledge-cards",
            headers=self._internal_headers(user_id),
            json_body={
                "userId": user_id,
                "repoName": repo_name,
                "kind": kind,
                "title": title,
                "content": content,
                "tags": tags or [],
                "context": context,
                "confidence": confidence,
            },
        )
        if code == 0:
            return {"status": "upstream_unavailable", "detail": "api 不可用,卡片未写入"}
        if code >= 400:
            return {"status": "upstream_rejected", "detail": f"HTTP {code}", "http_status": code}
        data = (payload or {}).get("data") or {}
        return {"status": "ok", "card_id": data.get("id"), "source": "agent"}

    async def _read_card_context(
        self, card_id: str, api_token: str | None
    ) -> tuple[str | None, dict[str, Any]]:
        code, payload = await self._request(
            "GET", f"/api/knowledge-cards/{card_id}", headers=self._bearer_headers(api_token)
        )
        if code != 200:
            return (None if code == 404 else "upstream_unavailable"), {}
        data = (payload or {}).get("data") or {}
        ctx = data.get("context")
        return None, ctx if isinstance(ctx, dict) else {}

    async def update_card(
        self,
        card_id: str,
        *,
        user_id: str | None,
        api_token: str | None,
        title: str | None = None,
        content: str | None = None,
        tags: list[str] | None = None,
        confidence: int | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """更新卡片(Bearer「仅本人」通道;ai-service 不自解 JWT)。"""
        problem = _identity_problem(user_id, None, needs_bearer=True, api_token=api_token)
        if problem:
            return {"status": "skipped_missing_identity", "detail": problem}
        if not _UUID_RE.fullmatch(card_id or ""):
            return {"status": "invalid_input", "detail": "card_id 必须是 uuid"}
        body: dict[str, Any] = {}
        if title is not None:
            body["title"] = title
        if content is not None:
            body["content"] = content
        if tags is not None:
            body["tags"] = tags
        if confidence is not None:
            body["confidence"] = confidence
        if context is not None:
            body["context"] = context
        if not body:
            return {"status": "invalid_input", "detail": "无可更新字段"}
        code, _payload = await self._request(
            "PATCH", f"/api/knowledge-cards/{card_id}", headers=self._bearer_headers(api_token), json_body=body
        )
        if code == 0:
            return {"status": "upstream_unavailable", "detail": "api 不可用"}
        if code == 404:
            return {"status": "card_missing", "detail": f"卡片不存在: {card_id}"}
        if code >= 400:
            return {"status": "upstream_rejected", "detail": f"HTTP {code}", "http_status": code}
        return {"status": "ok", "card_id": card_id, "updated_fields": sorted(body)}

    async def delete_card(self, card_id: str, *, user_id: str | None, api_token: str | None) -> dict[str, Any]:
        """删除卡片(Bearer「仅本人」)。"""
        problem = _identity_problem(user_id, None, needs_bearer=True, api_token=api_token)
        if problem:
            return {"status": "skipped_missing_identity", "detail": problem}
        if not _UUID_RE.fullmatch(card_id or ""):
            return {"status": "invalid_input", "detail": "card_id 必须是 uuid"}
        code, _payload = await self._request(
            "DELETE", f"/api/knowledge-cards/{card_id}", headers=self._bearer_headers(api_token)
        )
        if code == 0:
            return {"status": "upstream_unavailable", "detail": "api 不可用"}
        if code == 404:
            return {"status": "card_missing", "detail": f"卡片不存在: {card_id}"}
        if code >= 400:
            return {"status": "upstream_rejected", "detail": f"HTTP {code}", "http_status": code}
        return {"status": "ok", "card_id": card_id, "deleted": True}

    async def link_cards(
        self, card_id: str, related_card_id: str, relation: str, *, user_id: str | None, api_token: str | None, unlink: bool = False
    ) -> dict[str, Any]:
        """链接/解除链接两张卡片(读改写 context.links;relation 稳定语义身份)。"""
        problem = _identity_problem(user_id, None, needs_bearer=True, api_token=api_token)
        if problem:
            return {"status": "skipped_missing_identity", "detail": problem}
        for cid in (card_id, related_card_id):
            if not _UUID_RE.fullmatch(cid or ""):
                return {"status": "invalid_input", "detail": f"卡片 id 必须 uuid: {cid!r}"}
        if not _LINK_RELATION_RE.fullmatch(relation or ""):
            return {"status": "invalid_input", "detail": "relation 只认 [a-zA-Z0-9_-] 1-64"}
        read_problem, ctx = await self._read_card_context(card_id, api_token)
        if read_problem:
            return {
                "status": "card_missing" if read_problem == "not_found" else "upstream_unavailable",
                "detail": f"读卡片 context 失败: {card_id}",
            }
        links = [x for x in (ctx.get("links") or []) if isinstance(x, dict)]
        if unlink:
            links = [x for x in links if x.get("cardId") != related_card_id or x.get("relation") != relation]
            action = "unlinked"
        else:
            entry = {"cardId": related_card_id, "relation": relation}
            if entry in links:
                return {"status": "ok", "card_id": card_id, "action": "already", "links": len(links)}
            links.append(entry)
            action = "linked"
        new_ctx = dict(ctx)
        new_ctx["links"] = links
        code, _payload = await self._request(
            "PATCH",
            f"/api/knowledge-cards/{card_id}",
            headers=self._bearer_headers(api_token),
            json_body={"context": new_ctx},
        )
        if code == 0:
            return {"status": "upstream_unavailable", "detail": "api 不可用"}
        if code == 404:
            return {"status": "card_missing", "detail": f"卡片不存在: {card_id}"}
        if code >= 400:
            return {"status": "upstream_rejected", "detail": f"HTTP {code}", "http_status": code}
        return {"status": "ok", "card_id": card_id, "action": action, "links": len(links)}


knowledge_writer = KnowledgeWriter()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
