# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D179 会话/新对话 Issue 绑定流 —— MCP Issue 搜索端点(2026-09-30 用户拍板立项)。

把既有 mcp_client 通道(GitHub/Linear 等外部 MCP Server)的 Issue 搜索能力
提升为对外端点:入 provider + query,经该主体可见 Server 的搜索工具出规范化
条目 [{id, title, url, provider}](上限 20 条)。provider 未配置时返回空 items
+ configured:false,不报错炸掉。

身份纪律(AGENTS §5b):user_id 只从承载层 Depends(get_current_user_id) 进来,
MCP 调用沿用 call_external_tool 的按主体可见性(看不见的 server 与"没这台"
同模板),不新造第二份凭据逻辑。
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.jwt_auth import get_current_user_id
from app.services.mcp_client import get_mcp_client_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# 规范化条目截断上限(任务口径"如 20 条")
MAX_ITEMS = 20

# 目录一键注册的固定名(mcp_directory.to_client_config 的 name 形态);Linear 无
# 目录条目,只能按用户自注册名的子串现扫兜底。
_DIRECTORY_NAMES: dict[str, str] = {"github": "mcp:github"}

# 搜索工具名候选(各 server 版本常见命名,命中第一个即可)
_SEARCH_TOOL_CANDIDATES = ("search_issues", "searchissues", "search_issue")


class IssueSearchRequest(BaseModel):
    provider: Literal["github", "linear"]
    query: str = Field(min_length=1, max_length=500)


def _resolve_server(provider: str, user_id: str) -> str | None:
    """按 provider 挑一台该主体**可见**的已注册 Server;挑不到 = 未配置。"""
    manager = get_mcp_client_manager()
    candidates: list[str] = []
    exact = _DIRECTORY_NAMES.get(provider)
    if exact:
        candidates.append(exact)
    # 兜底:用户可能用自定义名注册(如 "my-github"),按子串现扫可见注册表
    for status in manager.list_registered(user_id):
        name = str(status.get("name") or "")
        if name and provider in name.lower() and name not in candidates:
            candidates.append(name)
    for name in candidates:
        client = manager.get_client(name)
        if client is not None and manager.is_visible(name, user_id):
            return name
    return None


def _pick_search_tool(tool_names: list[str]) -> str | None:
    lowered: dict[str, str] = {}
    for name in tool_names:
        lowered.setdefault(name.lower(), name)
    for candidate in _SEARCH_TOOL_CANDIDATES:
        if candidate in lowered:
            return lowered[candidate]
    # 兜底:名字同时含 search 与 issue 的第一个工具
    for lowered_name, original in lowered.items():
        if "search" in lowered_name and "issue" in lowered_name:
            return original
    return None


def _iter_payloads(result: Any) -> list[Any]:
    """从 MCP tools/call 结果里取候选数据载荷(content JSON 文本 / structuredContent / 裸数组)。"""
    payloads: list[Any] = []
    if isinstance(result, list):
        payloads.extend(result)
    elif isinstance(result, dict):
        structured = result.get("structuredContent")
        if structured is not None:
            payloads.append(structured)
        content = result.get("content")
        if isinstance(content, list):
            for frame in content:
                if isinstance(frame, dict) and isinstance(frame.get("text"), str):
                    try:
                        payloads.append(json.loads(frame["text"]))
                    except ValueError:
                        continue
        # 已是数组形态的直通(server 直出 / 测试替身)
        for key in ("items", "issues"):
            value = result.get(key)
            if isinstance(value, list):
                payloads.append({key: value})
    return payloads


def _normalize_item(raw: dict[str, Any], provider: str) -> dict[str, str] | None:
    """GitHub(items[].id/number/html_url)与 Linear(issues[].identifier/id/url)双形态归一。"""
    raw_id = raw.get("identifier")
    if raw_id is None:
        raw_id = raw.get("id")
    if raw_id is None:
        raw_id = raw.get("number")
    title = raw.get("title")
    url = raw.get("html_url")
    if not url:
        url = raw.get("url")
    if (raw_id is None or str(raw_id) == "") and not title:
        return None
    return {
        "id": str(raw_id) if raw_id is not None else "",
        "title": str(title) if title is not None else "",
        "url": str(url) if url is not None else "",
        "provider": provider,
    }


def _extract_items(result: Any, provider: str) -> list[dict[str, str]]:
    """跨 server 形态抽 issue 数组并归一,截断到 MAX_ITEMS。"""
    items: list[dict[str, str]] = []
    for payload in _iter_payloads(result):
        buckets: list[Any] = []
        if isinstance(payload, list):
            buckets = payload
        elif isinstance(payload, dict):
            for key in ("items", "issues"):
                value = payload.get(key)
                if isinstance(value, list):
                    buckets.extend(value)
        for raw in buckets:
            if not isinstance(raw, dict):
                continue
            item = _normalize_item(raw, provider)
            if item is not None:
                items.append(item)
            if len(items) >= MAX_ITEMS:
                return items
    return items


def _envelope(
    provider: str,
    server_name: str | None,
    configured: bool,
    error: str | None,
    items: list[dict[str, str]],
) -> dict[str, object]:
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "provider": provider,
            "serverName": server_name,
            "configured": configured,
            "error": error,
            "items": items,
        },
    }


@router.post("/agent/issues/search")
async def search_issues(
    req: IssueSearchRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, object]:
    """跨 MCP Server 搜 Issue。身份只取承载层 user_id,经 call_external_tool 按主体可见性。"""
    provider = req.provider
    server_name = _resolve_server(provider, user_id)
    if server_name is None:
        # 未配置:空 items + 标记,不报错炸掉(前端按 noIssues 空态渲染)
        return _envelope(provider, None, False, None, [])
    manager = get_mcp_client_manager()
    client = manager.get_client(server_name)
    tool_name: str | None = None
    if client is not None:
        try:
            tools = await client.list_tools()
            tool_name = _pick_search_tool([t.name for t in tools])
        except Exception as exc:  # noqa: BLE001 - 单台 server 工具枚举失败不炸端点
            logger.warning("枚举 %s 工具失败: %s", server_name, exc)
    if tool_name is None:
        return _envelope(provider, server_name, True, "未找到 Issue 搜索工具", [])
    result = await manager.call_external_tool(
        server_name, tool_name, {"query": req.query}, caller_user_id=user_id
    )
    if isinstance(result, dict) and result.get("ok") is False:
        return _envelope(provider, server_name, True, str(result.get("error") or "mcp 调用失败"), [])
    return _envelope(provider, server_name, True, None, _extract_items(result, provider))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
