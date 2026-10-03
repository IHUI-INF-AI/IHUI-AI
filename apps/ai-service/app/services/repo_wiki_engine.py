# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D9(2026-09-19 立):Repo Wiki 自动 wiki 化 + 增量同步 + 常驻注入 引擎。

设计目标(对标 Cursor/Qoder 的项目理解层):
- 自动 wiki 化:扫描工作区根 README.md/根级 *.md/docs/*.md(≤30 文件),
  对每个文件用 LLM 生成一段「项目百科」摘要,汇总成整份 wiki 文本注入 system prompt。
- 增量同步:对每个文件算 sha256,与缓存(内存 dict + 磁盘 .ihui-agent/wiki-cache/<ns>.json)
  比对,仅对新增/变更文件调 LLM 重新摘要;未变更文件复用旧摘要,零重复开销。
- 常驻注入:ensure_wiki 被 routers/llm.py 在主聊天系统消息组装时调用,
  **但需调用方显式传 wikiContext=true**(2026-10-03 起默认不注入),workspace_path
  存在才注入 [repo-wiki] 项目百科(自动生成,增量同步)。
- 全链路静默降级:任何异常/LLM 失败/无文件一律返回 None 或降级文本,绝不阻塞主聊天。

数据出域纪律(2026-10-03 合规整改,勿绕过):
- 本引擎会把**工作区文件正文切前 4000 字送外部 LLM**,属出域路径。
- 两道闸:(1) 调用方显式 opt-in(routers/llm.py 已改为 `is True` 硬判);
  (2) 本模块 _is_sensitive_path 永久排除 agent 内部指令文件(AGENTS.md/CLAUDE.md 等)
  —— 后者不可通过改 _ROOT_FIXED 绕过,根级 *.md 通配扫描同样被拦。
- 新增扫描目标前请先确认该文件不含密钥位置/内部拓扑/人员信息。

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
#
# 2026-10-03 数据出域合规整改:AGENTS.md / CLAUDE.md 从扫描集**永久移除**。
# 原因为何:这两个文件在业界惯例里承载的是「给 agent 的内部指令」,典型内容含内部
# 架构拓扑、密钥位置、部署方式、内部人员信息。把它们切前 4000 字发给外部模型
# 服务商,是本仓风险最高的一条出域路径(与 2026-09 智谱 ZCode「未经知情上传用户
# 仓库数据」同型)。此处移除后即使 wiki 注入被显式开启,这两个文件也不会外发。
_ROOT_FIXED = ("README.md",)

# 敏感文件黑名单(大小写不敏感,匹配根级固定名与 *.md 扫描结果)。
# 同样出于 2026-10-03 合规整改:即便未来有人把 AGENTS.md/CLAUDE.md 加回
# _ROOT_FIXED,黑名单也会在 _discover_files 出口处拦一道 —— 判据只此一份,
# 避免"改一处漏一处"。
_SENSITIVE_FILENAMES = frozenset(
    {
        "agents.md",
        "claude.md",
        ".cursorrules",
        ".windsurfrules",
        ".clinerules",
        "gemini.md",
        ".aiderrules",
        "copilot-instructions.md",
    }
)

# 目录黑名单:命中则整目录跳过(仅对当前扫描层级生效,docs/ 下同理)。
_SENSITIVE_DIRNAMES = frozenset({".git", ".github", ".ihui-agent", ".env", "secrets"})

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
def _is_sensitive_path(path: str, workspace_path: str) -> bool:
    """该路径是否命中敏感文件/目录黑名单(大小写不敏感)。

    2026-10-03 合规整改:这是本仓**唯一**一份「哪些文件不许外发」的判据,
    在 _discover_files 的三个收集点与最终出口各拦一道。之所以要设最终出口兜底,
    是因为根级 `*.md` 通配扫描会绕过 _ROOT_FIXED 常量直接把 AGENTS.md 捞进来 ——
    只改常量不够(这正是本条判据不复用 _ROOT_FIXED 的原因)。

    fail-closed:路径为 None / 类型异常 / 越界时一律判为敏感(宁可漏扫不可出域)。
    注意整个函数体都在 try 内 —— os.path.basename 对 None 会直接抛 TypeError,
    若把它放在 try 外面,"fail-closed"就只在部分分支成立(2026-10-03 自测实测到
    该漏洞:单测传 None 时抛错而非返回 True,等于异常向上冒到主链路热路径)。
    """
    try:
        name = os.path.basename(path)
        if name.lower() in _SENSITIVE_FILENAMES:
            return True
        root = os.path.abspath(workspace_path)
        rel_parts = os.path.abspath(path)[len(root) :].strip(os.sep).split(os.sep)
    except (TypeError, ValueError, AttributeError, OSError):
        return True  # 路径异常 ⇒ 宁可漏扫不出域(fail-closed)
    return any(part.lower() in _SENSITIVE_DIRNAMES for part in rel_parts[:-1] if part)


def _discover_files(workspace_path: str) -> list[str]:
    """返回工作区待 wiki 化的 markdown 文件绝对路径(≤_MAX_WIKI_FILES,去重排序)。

    2026-10-03 合规整改:所有候选在收集口与最终出口都过 _is_sensitive_path,
    命中敏感黑名单(AGENTS.md / CLAUDE.md 等 agent 内部指令文件)的**一律排除**,
    不会作为 wiki 摘要的输入送 LLM。
    """
    candidates: set[str] = set()
    root = workspace_path
    for name in _ROOT_FIXED:
        p = os.path.join(root, name)
        if os.path.isfile(p) and not _is_sensitive_path(p, root):
            candidates.add(os.path.abspath(p))
    # 根级 *.md
    try:
        for entry in os.listdir(root):
            full = os.path.join(root, entry)
            if (
                os.path.isfile(full)
                and entry.lower().endswith(".md")
                and not entry.startswith(".")
                and not _is_sensitive_path(full, root)
            ):
                candidates.add(os.path.abspath(full))
    except OSError:
        pass
    # docs/*.md(仅顶层,非递归,避免把依赖/构建产物卷进来)
    docs_dir = os.path.join(root, "docs")
    if os.path.isdir(docs_dir):
        try:
            for entry in os.listdir(docs_dir):
                full = os.path.join(docs_dir, entry)
                if (
                    os.path.isfile(full)
                    and entry.lower().endswith(".md")
                    and not _is_sensitive_path(full, docs_dir)
                ):
                    candidates.add(os.path.abspath(full))
        except OSError:
            pass
    # 最终出口兜底:再过一次判据,任何漏网的敏感文件在此被拦下
    ordered = sorted(p for p in candidates if not _is_sensitive_path(p, root))
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
