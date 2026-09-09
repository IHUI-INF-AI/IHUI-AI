# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""网页抓取工具 HTTP 薄接口(ai-service,内网)。

- POST /api/web-tools/call  前端"网页工具"页(web /web-tools)直调三个只读工具:
  fetch_readable / map_site / extract_web。
  crawl_site(递归爬取,重操作)维持 _ADMIN_ONLY_TOOLS 定位,刻意不在 HTTP 层开放。

安全与健壮性:
- 工具白名单硬编码,形参逐项收敛(不透传任意 arguments dict)。
- 工具内部自带 SSRF 校验(拒内网/回环/云元数据),此层不重复实现。
- 每工具独立超时(asyncio.wait_for),超时/异常统一 HTTPException,不裸抛堆栈。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

# 工具白名单 → 各自超时(秒)。map_site 单页抓取快;extract_web 含 LLM 通道给足 90s。
_ALLOWED_TOOLS: dict[str, float] = {
    "fetch_readable": 60.0,
    "map_site": 60.0,
    "extract_web": 90.0,
}


class WebToolCallRequest(BaseModel):
    """网页工具调用请求(形参收敛,未列出的参数一律丢弃)。"""

    tool: str = Field(..., min_length=1, max_length=32, description="工具名:fetch_readable | map_site | extract_web")
    url: str = Field(..., min_length=1, max_length=2048, description="目标网页 URL(http/https)")
    max_chars: int | None = Field(default=None, ge=500, le=50000, description="正文/抽取上下文最大字符数")
    include_links: bool | None = Field(default=None, description="fetch_readable:正文是否保留链接")
    max_links: int | None = Field(default=None, ge=1, le=1000, description="map_site:最多返回链接数")
    same_domain_only: bool | None = Field(default=None, description="map_site:是否仅同域链接")
    fields: dict[str, str] | None = Field(default=None, description="extract_web 字段 schema(字段名→类型描述)")


@router.post("/web-tools/call")
async def web_tools_call(req: WebToolCallRequest) -> dict[str, Any]:
    """调用一个只读网页抓取工具,返回结构化结果(含工具自身的 ok/error 语义)。"""
    timeout = _ALLOWED_TOOLS.get(req.tool)
    if timeout is None:
        raise HTTPException(
            status_code=400,
            detail="不支持的工具 '{}':仅 fetch_readable / map_site / extract_web(crawl_site 为管理员工具,不在 HTTP 层开放)".format(req.tool),
        )
    if req.tool == "extract_web" and not req.fields:
        raise HTTPException(status_code=400, detail="extract_web 需要 fields 字段 schema(JSON 对象,字段名→类型)")

    from ..tools import web_crawl_tools as wc

    arguments: dict[str, Any] = {"url": req.url}
    if req.max_chars is not None:
        arguments["max_chars"] = req.max_chars
    if req.tool == "fetch_readable" and req.include_links is not None:
        arguments["include_links"] = req.include_links
    if req.tool == "map_site":
        if req.max_links is not None:
            arguments["max_links"] = req.max_links
        if req.same_domain_only is not None:
            arguments["same_domain_only"] = req.same_domain_only
    if req.tool == "extract_web":
        arguments["fields"] = req.fields

    try:
        fn = getattr(wc, req.tool)
        result = await asyncio.wait_for(fn(arguments), timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="工具执行超时({}s):可降低 max_chars/链接数后重试".format(int(timeout)),
        ) from None
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - 工具层异常统一收敛为 500
        logger.warning("web-tools/call %s %s 失败: %s", req.tool, req.url, e)
        raise HTTPException(status_code=500, detail="网页工具执行异常: {}".format(e)) from e

    return {"ok": True, "tool": req.tool, "result": result}
