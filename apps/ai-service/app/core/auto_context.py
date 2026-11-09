# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D7(2026-09-19 立):主聊天自动语义检索注入(对标 Cursor @codebase 自动注入)。

普通对话(非工具调用触发)时,若代码库索引可用,首答前自动检索 top-k 代码块注入 system:
- 开关:请求字段 autoContext=false 可关(routers/llm.py 侧);IHUI_AUTO_CONTEXT_DISABLE=1 全局禁用。
- 防重复:同一会话同一 query 60s 内不重复注入(内存 LRU,进程内即可)。
- 安全:全链路 try/except 静默降级,检索失败绝不阻塞主聊天(调用方另有兜底)。
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 全局硬开关(env):部署侧可一键禁用自动注入
_ENV_DISABLE = "IHUI_AUTO_CONTEXT_DISABLE"

# 防重复窗口(秒):同一会话同一 query 在此窗口内不重复检索注入
_DEDUP_WINDOW_S = 60.0

# 防重复缓存上限(条目数):超出后淘汰最旧(简单 FIFO,进程内瞬时态)
_DEDUP_MAX_ENTRIES = 512

# 默认检索参数
_DEFAULT_TOP_K = 6
_MAX_BLOCK_CHARS = 16000
_MAX_CHUNK_CHARS = 2400

# (session_id, query_hash) -> 上次注入时间戳( monotonic)
_dedup_cache: dict[tuple[str, str], float] = {}


def _is_globally_disabled() -> bool:
    """IHUI_AUTO_CONTEXT_DISABLE=1(或 true/yes)时全局禁用。"""
    raw = os.environ.get(_ENV_DISABLE, "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _should_skip_dedup(session_id: str | None, query: str) -> bool:
    """60s 内同一会话同一 query 返回 True(跳过注入)。副作用:命中时刷新不必要——保持幂等。"""
    if not session_id:
        return False  # 无会话 id 无法判重,放行(每条消息独立)
    key = (session_id, hashlib.sha256(query.encode("utf-8")).hexdigest()[:32])
    now = time.monotonic()
    last = _dedup_cache.get(key)
    if last is not None and (now - last) < _DEDUP_WINDOW_S:
        return True
    # 淘汰最旧(简单 FIFO,避免无限增长)
    while len(_dedup_cache) >= _DEDUP_MAX_ENTRIES:
        _dedup_cache.pop(next(iter(_dedup_cache)), None)
    _dedup_cache[key] = now
    return False


def _normalize_chunk(raw: dict[str, Any]) -> dict[str, Any] | None:
    """归一化索引切片:统一 camelCase/snake_case 字段,剔除空片段。"""
    file_path = raw.get("file_path") or raw.get("filePath") or raw.get("path")
    content = raw.get("content") or raw.get("snippet") or ""
    if not file_path or not str(content).strip():
        return None
    line_start = raw.get("line_start") or raw.get("lineStart")
    line_end = raw.get("line_end") or raw.get("lineEnd")
    score = raw.get("score")
    snippet = str(content).strip()
    if len(snippet) > _MAX_CHUNK_CHARS:
        snippet = snippet[:_MAX_CHUNK_CHARS] + "\n…(截断)"
    return {
        "file_path": str(file_path),
        "line_start": int(line_start) if isinstance(line_start, (int, float)) else None,
        "line_end": int(line_end) if isinstance(line_end, (int, float)) else None,
        "content": snippet,
        "score": float(score) if isinstance(score, (int, float)) else None,
        "retrieval_leg": str(raw.get("retrieval_leg") or "semantic"),
    }


def _local_catalog_hits(workspace_path: str, query: str, top_k: int) -> list[dict[str, Any]]:
    """本地目录腿:按文件/符号名从**快照内的目录**取片段(零远端)。

    只在调用方给了 `workspace_path` 时启用。目录缺席/旧档 ⇒ 返回空列表并记日志,
    由语义腿兜底;这里绝不去建索引、不去联网(自动注入路径不允许有写入副作用)。
    """
    from ..services.codebase_index_status import resolve_repo_id
    from ..services.codebase_indexer import codebase_indexer
    from ..services.codebase_symbol_catalog import search_local_catalog

    root = Path(workspace_path).resolve()
    repo_id = resolve_repo_id(root, codebase_indexer)
    catalog = codebase_indexer.load_catalog(repo_id, root)
    if catalog is None:
        logger.info("auto_context local leg skipped: 目录缺席(repo_id=%s)", repo_id)
        return []
    return search_local_catalog(root, catalog, query, top_k=top_k)


async def auto_retrieve(
    query: str,
    workspace_path: str | None = None,
    session_id: str | None = None,
    top_k: int = _DEFAULT_TOP_K,
) -> list[dict[str, Any]]:
    """主聊天自动语义检索:返回注入用代码块列表(异常/禁用/防重复时返回空列表)。

    Args:
        query: 用户最后一条消息文本(调用方负责提取)。
        workspace_path: 工作区路径。给了就**并行**跑本地目录腿(文件/符号级,零远端),
            并与远端语义腿合并;不给则只跑语义腿(行为与旧版一致)。
        session_id: 会话 id(60s 防重复键的一部分;为空则不判重)。
        top_k: 每条腿的检索条数上限(合并后最多 2×top_k)。

    Returns:
        归一化 chunk 列表:[{file_path, line_start, line_end, content, score, retrieval_leg}]。
        `retrieval_leg` = `semantic` | `local-catalog`(消费方可据此区分命中来源)。
    """
    if _is_globally_disabled():
        return []
    query = (query or "").strip()
    if len(query) < 4:
        return []  # 过短查询(问候/单字)不做检索注入
    if _should_skip_dedup(session_id, query):
        return []
    raw_chunks: list[dict[str, Any]] = []
    local_raw: list[dict[str, Any]] = []
    try:
        from ..services.codebase_indexer import codebase_indexer

        if workspace_path:
            semantic_result: Any
            local_result: Any
            semantic_result, local_result = await asyncio.gather(
                codebase_indexer.search(query, top_k=top_k),
                asyncio.to_thread(_local_catalog_hits, workspace_path, query, top_k),
                return_exceptions=True,
            )
            if isinstance(semantic_result, BaseException):
                logger.warning("auto_context semantic leg failed: %s", semantic_result)
            else:
                raw_chunks = list(semantic_result or [])
            if isinstance(local_result, BaseException):
                logger.warning("auto_context local leg failed: %s", local_result)
            else:
                local_raw = list(local_result or [])
        else:
            raw_chunks = await codebase_indexer.search(query, top_k=top_k)
    except Exception as e:  # 检索失败静默降级,绝不阻塞主聊天
        logger.warning("auto_context retrieve failed: %s", e)
        return []
    normalized: list[dict[str, Any]] = []
    used_chars = 0
    seen: set[tuple[str, int | None]] = set()
    for raw in [*(raw_chunks or []), *local_raw]:
        if not isinstance(raw, dict):
            continue
        chunk = _normalize_chunk(raw)
        if chunk is None:
            continue
        key = (str(chunk["file_path"]), chunk["line_start"])
        if key in seen:
            continue
        seen.add(key)
        used_chars += len(chunk["content"])
        normalized.append(chunk)
        if used_chars >= _MAX_BLOCK_CHARS or len(normalized) >= top_k * 2:
            break
    return normalized


def format_auto_context_block(chunks: list[dict[str, Any]]) -> str | None:
    """把检索结果格式化为 system 注入块(引用时标注 文件:行号)。空结果返回 None。"""
    if not chunks:
        return None
    parts: list[str] = []
    used = 0
    for c in chunks:
        loc = c["file_path"]
        if c.get("line_start") is not None:
            loc += f":{c['line_start']}"
            if c.get("line_end") is not None and c["line_end"] != c["line_start"]:
                loc += f"-{c['line_end']}"
        segment = f"[{loc}]\n{c['content']}"
        if used + len(segment) > _MAX_BLOCK_CHARS:
            break
        parts.append(segment)
        used += len(segment)
    if not parts:
        return None
    header = (
        "[auto-context] 代码库语义检索(自动注入;引用以下内容时标注 文件:行号,非用户主动附上):"
    )
    return header + "\n\n" + "\n\n---\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
