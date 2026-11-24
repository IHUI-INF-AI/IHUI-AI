# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A 发现端点:`.well-known/agent.json`(Agent Card)。

「Agent 全面开放工程」O11 落地(2026-09-20):别的 agent 框架(LangGraph /
LiteLLM / a2a-sdk 客户端)按 A2A §8.3 从固定 URL 抓取本项目的 Agent Card,
据此决定"能不能调、调什么、怎么带凭据"。

- **无鉴权**:发现文档的目的就是被陌生 agent 读到;卡片内容全部是
  「能力/契约」级信息(skills、模式、安全方案名),不含内网主机、端口、密钥
  —— 对外 URL 由请求 Host 或配置白名单域名推导(见 `agent_card.resolve_public_base_url`)。
- **两个路径同时提供**:A2A 0.2.x 用 `/.well-known/agent.json`,0.3.0 起标准路径
  改为 `/.well-known/agent-card.json`(LiteLLM 的 card resolver 两者都试)。
  任务要求 agent.json,故它以 `agent.json` 为主、`agent-card.json` 为别名,同一份内容。
- **JWT 中间件放行**:本服务的全局 `JWTAuthMiddleware` 按
  `settings.jwt_public_paths` 精确匹配路径。这两个路径**必须**登记进该白名单,
  否则生产环境(配置了 JWT_SECRET)匿名抓取会拿到 401 —— 该白名单在
  `app/core/config.py`,不在本任务可改文件清单内,已在交付报告里给出待插入的确切代码。
"""

from __future__ import annotations

import logging
from typing import Any, Final

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services.agent_card import PublicBaseUrlError, build_agent_card, resolve_public_base_url

logger = logging.getLogger(__name__)

router = APIRouter()

# 发现端点路径(A2A §8.3):主路径 + 当前标准别名
AGENT_CARD_PATH: Final = "/.well-known/agent.json"
AGENT_CARD_ALIAS_PATH: Final = "/.well-known/agent-card.json"

# 需要登记进 settings.jwt_public_paths 的路径(发现用途 = 匿名可读)
JWT_PUBLIC_PATHS: Final[tuple[str, ...]] = (AGENT_CARD_PATH, AGENT_CARD_ALIAS_PATH)

# 卡片可由 CDN/客户端短缓存;内容随能力清单变化,60s 是"改清单后最坏可见延迟"上限
CACHE_CONTROL: Final = "public, max-age=60"


@router.get(
    AGENT_CARD_PATH,
    summary="A2A Agent Card(发现文档)",
    tags=["a2a"],
)
@router.get(
    AGENT_CARD_ALIAS_PATH,
    summary="A2A Agent Card(0.3.0 标准路径别名)",
    tags=["a2a"],
    include_in_schema=False,
)
async def read_agent_card(request: Request) -> JSONResponse:
    """返回本项目对外的 A2A Agent Card。

    Host 既非回环也不在白名单、且未配置任何公网域名时 → 403 拒答
    (绝不把请求头里的内网 host:port 回显成"官方入口 URL")。
    """
    headers: dict[str, str] = dict(request.headers.items())
    try:
        base_url = resolve_public_base_url(headers, url_scheme=request.url.scheme)
    except PublicBaseUrlError as e:
        body: dict[str, Any] = {
            "code": 403,
            "message": f"无法安全推导对外基址:{e}",
        }
        return JSONResponse(body, status_code=403)
    return JSONResponse(build_agent_card(base_url), headers={"Cache-Control": CACHE_CONTROL})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
