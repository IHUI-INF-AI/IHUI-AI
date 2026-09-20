# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D9(2026-09-19 立):Repo Wiki 自动 wiki 化 + 增量同步 + 常驻注入 引擎。

设计目标(对标 Cursor/Qoder 的项目理解层):
- 自动 wiki 化:扫描工作区根 README.md/AGENTS.md/CLAUDE.md/docs/*.md(≤30 文件),
  对每个文件用 LLM 生成一段「项目百科」摘要,汇总成整份 wiki 文本注入 system prompt。
- 增量同步:对每个文件算 sha256,与缓存(内存 dict + 磁盘 .ihui-agent/wiki-cache/<ns>.json)
  比对,仅对新增/变更文件调 LLM 重新摘要;未变更文件复用旧摘要,零重复开销。
- 常驻注入:ensure_wiki 被 routers/llm.py 在每次主聊天系统消息组装时调用,
  workspace_path 存在即注入 [repo-wiki] 项目百科(自动生成,增量同步)。
- 全链路静默降级:任何异常/LLM 失败/无文件一律返回 None 或降级文本,绝不阻塞主聊天。

纪律:
- 不新增 pip 依赖,复用 llm_gateway 现有 LLM 调用链路(stub 模式自动降级)。
- 该函数被主聊天热路径调用,必须 0 阻塞风险:60s 内存 TTL 防抖 + 全 try/except。
"""

from __future__ import annotations

import hashlib
import json
import logging as _logging
import os
import time
from typing import Any

logger = _logging.getLogger("repo_wiki_engine")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
_WIKI_TTL_SECONDS = 60.0          # 同 namespace 60s 内直接返回缓存(防抖)
_MAX_WIKI_FILES = 30              # 单工作区最多 wiki 化的文件数
_MAX_TOTAL_CHARS = 12000          # 整份 wiki 文本上限(ensure_wiki 默认参数)
_PER_FILE_SUMMARY_CHARS = 600     # 单文件摘要上限(超过截断)
_FALLBACK_CHARS = 600             # LLM 失败降级取文件首 N 字符
_LLM_MAX_INPUT_CHARS = 4000       # 传给 LLM 摘要的文件内容上限

# 扫描模式:根级固定文件 + 根级 *.md + docs/*.md(非递归)
_ROOT_FIXED = ("README.md", "AGENTS.md", "CLAUDE.md")

# 模块级时钟函数(便于测试 monkeypatch)
_now = time.monotonic

# 内存缓存:namespace -> {"ts": float, "files": {rel: {"hash": str, "summary": str}}}
_WIKI_CACHE: dict[str, dict[str, Any]] = {}


def clear_wiki_cache() -> None:
    """清空内存缓存(测试用)。不影响磁盘缓存。"""
    _WIKI_CACHE.clear()


# ---------------------------------------------------------------------------
# 文件扫描与哈希
# ---------------------------------------------------------------------------
def _discover_files(workspace_path: str) -> list[str]:
    """返回工作区待 wiki 化的 markdown 文件绝对路径(≤_MAX_WIKI_FILES,去重排序)。"""
    candidates: set[str] = set()
    root = workspace_path
    for name in _ROOT_FIXED:
        p = os.path.join(root, name)
        if os.path.isfile(p):
            candidates.add(os.path.abspath(p))
    # 根级 *.md
    try:
        for entry in os.listdir(root):
            full = os.path.join(root, entry)
            if os.path.isfile(full) and entry.lower().endswith(".md") and not entry.startswith("."):
                candidates.add(os.path.abspath(full))
    except OSError:
        pass
    # docs/*.md(仅顶层,非递归,避免把依赖/构建产物卷进来)
    docs_dir = os.path.join(root, "docs")
    if os.path.isdir(docs_dir):
        try:
            for entry in os.listdir(docs_dir):
                full = os.path.join(docs_dir, entry)
                if os.path.isfile(full) and entry.lower().endswith(".md"):
                    candidates.add(os.path.abspath(full))
        except OSError:
            pass
    ordered = sorted(candidates)
    return ordered[:_MAX_WIKI_FILES]


def _sha256_file(path: str) -> str | None:
    """计算文件 sha256(读不到返回 None)。"""
    try:
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()
    except OSError:
        return None


def _rel_path(workspace_path: str, abs_path: str) -> str:
    try:
        rel = os.path.relpath(abs_path, workspace_path)
        return rel.replace(os.sep, "/")
    except ValueError:
        return os.path.basename(abs_path)


# ---------------------------------------------------------------------------
# 磁盘缓存(尽力而为,失败不影响主链路)
# ---------------------------------------------------------------------------
def _cache_dir(workspace_path: str) -> str:
    return os.path.join(workspace_path, ".ihui-agent", "wiki-cache")


def _cache_file(namespace: str, workspace_path: str) -> str:
    slug = hashlib.md5(namespace.encode("utf-8")).hexdigest()[:16]
    return os.path.join(_cache_dir(workspace_path), f"{slug}.json")


def _load_disk(namespace: str, workspace_path: str) -> dict[str, Any] | None:
    try:
        fp = _cache_file(namespace, workspace_path)
        with open(fp, encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("files"), dict):
            return data
    except (OSError, json.JSONDecodeError, ValueError):
        pass
    return None


def _save_disk(namespace: str, workspace_path: str, data: dict[str, Any]) -> None:
    try:
        fp = _cache_file(namespace, workspace_path)
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        with open(fp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False)
    except OSError:
        pass  # 静默降级


# ---------------------------------------------------------------------------
# LLM 摘要(惰性导入 llm_gateway;失败降级取文件首 N 字符)
# ---------------------------------------------------------------------------
async def _summarize_file(rel_path: str, content: str) -> str:
    """对单个文件生成 wiki 摘要;LLM 不可用/异常时降级取首 N 字符。"""
    snippet = content[:_LLM_MAX_INPUT_CHARS]
    try:
        from ..core.llm_gateway import llm_gateway

        # stub 模式(无 API key)直接降级,避免无效网络调用
        if llm_gateway._is_stub_mode():
            return content[:_FALLBACK_CHARS].strip()

        messages = [
            {
                "role": "system",
                "content": (
                    "你是项目百科摘要器。请用简洁中文列出该文件的核心要点,"
                    "不超过 300 字,聚焦其职责/对外接口/关键约束。只输出要点,不要解释。"
                ),
            },
            {
                "role": "user",
                "content": f"文件路径: {rel_path}\n\n文件内容:\n---\n{snippet}\n---",
            },
        ]
        result = await llm_gateway.complete(messages, model="auto")
        text = (result.get("content") or "").strip() if isinstance(result, dict) else ""
        if text:
            return text[:_PER_FILE_SUMMARY_CHARS]
    except Exception as exc:  # 静默降级,绝不抛出
        logger.warning("repo_wiki summarize failed (rel=%s): %s", rel_path, exc)
    return content[:_FALLBACK_CHARS].strip()


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------
async def ensure_wiki(
    workspace_path: str,
    namespace: str,
    max_chars: int = _MAX_TOTAL_CHARS,
) -> str | None:
    """生成/增量同步工作区的项目百科文本。

    Args:
        workspace_path: 工作区绝对路径(引擎从此读取 markdown 文件与磁盘缓存)。
        namespace: 缓存命名空间(通常用 workspace_path;增量与 TTL 按它隔离)。
        max_chars: 整份 wiki 文本上限,超过截断。

    Returns:
        项目百科文本(带 <!-- wiki-hash --> 标记),无源文件/被禁用/异常时返回 None。

    纪律:本函数被主聊天热路径调用,任何分支异常都必须静默返回 None,绝不抛错。
    """
    try:
        # 全局硬开关
        if os.environ.get("IHUI_WIKI_DISABLE") == "1":
            return None

        wp = (workspace_path or "").strip()
        if not wp or not os.path.isdir(wp):
            return None

        ns = namespace or wp

        # 60s 内存 TTL 防抖:命中直接返回上次文本
        cached = _WIKI_CACHE.get(ns)
        if cached is not None and (_now() - cached.get("ts", 0.0)) < _WIKI_TTL_SECONDS:
            return cached.get("text")

        files = _discover_files(wp)
        if not files:
            return None

        # 载入上一轮 hash/摘要映射(内存优先,否则磁盘)
        prev = cached.get("files") if cached else None
        if prev is None:
            disk = _load_disk(ns, wp)
            prev = disk.get("files") if disk else None
        if prev is None:
            prev = {}

        new_files: dict[str, dict[str, str]] = {}
        for abs_path in files:
            rel = _rel_path(wp, abs_path)
            file_hash = _sha256_file(abs_path)
            if file_hash is None:
                continue
            old = prev.get(rel)
            if old and old.get("hash") == file_hash and old.get("summary"):
                # 未变更:复用旧摘要(增量核心)
                new_files[rel] = {"hash": file_hash, "summary": old["summary"]}
                continue
            # 新增/变更:读取内容并(重)生成摘要
            try:
                with open(abs_path, encoding="utf-8", errors="replace") as fh:
                    content = fh.read()
            except OSError:
                continue
            summary = await _summarize_file(rel, content)
            new_files[rel] = {"hash": file_hash, "summary": summary}

        if not new_files:
            return None

        # 组装整份 wiki 文本(每段带 <!-- wiki-hash --> 标记)
        segments: list[str] = []
        for rel in sorted(new_files.keys()):
            info = new_files[rel]
            short = info["hash"][:12]
            segments.append(
                f"## {rel}\n<!-- wiki-hash:{rel}:{short} -->\n{info['summary']}"
            )
        wiki_text = "\n\n".join(segments)

        # 截断保护
        if max_chars and len(wiki_text) > max_chars:
            wiki_text = wiki_text[:max_chars] + "\n...(项目百科已截断)"

        # 写回内存 + 磁盘缓存
        _WIKI_CACHE[ns] = {"ts": _now(), "text": wiki_text, "files": new_files}
        _save_disk(ns, wp, {"files": new_files})

        return wiki_text
    except Exception as exc:  # 全链路静默降级,绝不阻塞主聊天
        logger.warning("repo_wiki ensure_wiki skipped: %s", exc)
        return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
