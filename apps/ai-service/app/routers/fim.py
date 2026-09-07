# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌‌‌‍‍​‌‌​‌‌‌‌‍‍​‌‌‌‌‌‌​‍‍​‌‌‌‌‌‌‍‍‌​‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌⁠

"""FIM(Fill-in-the-Middle)代码补全端点(2026-09-07 立)。

对标 Cursor Tab(Supermaven)/Trae CUE 的后端能力缺口:
为浏览器 IDE(Monaco inline completions)与 CLI ghost-text 提供
低延迟单轮补全推断。

设计约束(补全场景 ≠ 对话场景):
- 无会话/无记忆/无流式:单次 POST,返回首补全,延迟优先
- 前缀截尾(6000 字符)+ 后缀截头(2000 字符),控制 token 上限
- max_tokens 默认 128(补全只需数行),temperature=0
- 模型默认 'auto':经 _resolve_auto_model 优先 zero_cost/LOCAL → cheap,
  补全流量天然适合本地小模型(qwen-coder 等)
- 鉴权沿用 llm 路由族约定(网关/代理层统一处理,路由内不做 JWT)

用法:
    POST /api/llm/fim
    {"prefix": "def add(a, b):\\n    ", "suffix": "\\n\\nprint(add(1,2))",
     "language": "python"}
    → {"code": 0, "message": "ok", "data": {"completion": "return a + b", ...}}
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

router = APIRouter()

# 上下文窗口约束:补全不需要(也不应该)看到全部文件
_PREFIX_TAIL_CHARS = 6_000
_SUFFIX_HEAD_CHARS = 2_000
_MAX_TOKENS_CAP = 512

_SYSTEM_PROMPT = (
    "You are a code completion engine (fill-in-the-middle). "
    "You are given the code BEFORE the cursor and AFTER the cursor. "
    "Output ONLY the code that belongs exactly at the <CURSOR> position. "
    "Rules:\n"
    "1. No explanations, no comments about what you did, no markdown fences.\n"
    "2. Continue the code naturally — complete the current line/statement/block.\n"
    "3. Usually 1-8 lines. Stop at a natural boundary.\n"
    "4. Do not repeat code that already exists before or after the cursor.\n"
    "5. Match the file's indentation and style."
)


class FIMRequest(BaseModel):
    """FIM 补全请求。"""

    prefix: str = Field(..., description="光标前代码")
    suffix: str = Field("", description="光标后代码(可为空=文件末尾)")
    language: str = Field("text", description="语言标识(ts/python/go/...)")
    model: Optional[str] = Field(None, description="模型,默认 auto(本地/零成本优先)")
    max_tokens: int = Field(128, ge=1, le=_MAX_TOKENS_CAP, description="补全上限 token")
    owner_uuid: Optional[str] = Field(None, description="用户 UUID(模型私有配置匹配)")


def _strip_fences(text: str) -> str:
    """剥离模型偶尔输出的 markdown 代码围栏(补全场景禁止围栏)。"""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_nl = stripped.find("\n")
        if first_nl != -1:
            stripped = stripped[first_nl + 1 :]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    return stripped.strip("\n")


def _build_user_prompt(prefix: str, suffix: str, language: str) -> str:
    prefix_tail = prefix[-_PREFIX_TAIL_CHARS:]
    suffix_head = suffix[:_SUFFIX_HEAD_CHARS]
    return (
        f"Language: {language}\n"
        "----- code before cursor -----\n"
        f"{prefix_tail}\n"
        "----- <CURSOR> -----\n"
        "----- code after cursor -----\n"
        f"{suffix_head}\n"
        "----- end -----\n"
        "Output the code for <CURSOR> only."
    )


@router.post("/llm/fim", response_model=None)
async def fim_complete(req: FIMRequest) -> dict[str, Any]:
    """单轮 FIM 代码补全(低延迟、无状态)。

    Returns:
        {code, message, data: {completion, model, latency_ms, stub}}
        空 prefix 返回空 completion(200,便于客户端短路)。
    """
    if not req.prefix:
        return {"code": 0, "message": "ok", "data": {"completion": "", "model": "", "latency_ms": 0, "stub": False}}

    started = time.perf_counter()
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(req.prefix, req.suffix, req.language)},
    ]
    try:
        result = await llm_gateway.complete(
            messages,
            req.model or "auto",
            owner_uuid=req.owner_uuid,
            max_tokens=req.max_tokens,
            temperature=0.0,
            stop=["\n\n\n", "----- code before cursor -----"],
        )
        raw = str(result.get("content") or "")
        completion = _strip_fences(raw)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "completion": completion,
                "model": result.get("model", ""),
                "latency_ms": latency_ms,
                "stub": bool(result.get("stub", False)),
            },
        }
    except Exception as e:  # noqa: BLE001 — 补全失败必须静默降级,绝不能打断打字流
        logger.warning("fim_complete failed: %s: %s", type(e).__name__, str(e)[:200])
        return {
            "code": 0,
            "message": "fim degraded",
            "data": {"completion": "", "model": "", "latency_ms": int((time.perf_counter() - started) * 1000), "stub": False},
        }
