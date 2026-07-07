"""
Codebase 索引增量更新 — 对标 Cursor 的自动 re-index / Trae 的 git 变更触发。

在 codebase_index.py (粗粒度符号索引) 和 vector_index.py (语义向量索引) 之上,
提供增量更新能力:

1. 基于 mtime 的快速 diff (跳过未变更文件)
2. 基于 git status 的精准 diff (新增 / 修改 / 删除)
3. 增量更新 codebase-index.json (符号索引)
4. 增量更新 vector-index.json (语义索引) — 重新编码变更文件
5. 提供 routes.py 可调用的 /workspace/codebase/{incremental_update,search,status}

不依赖重型库 (不用 watchdog, 不用 watchfiles), 用 mtime + git 主动调用。
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger

from app.api.v1.workspace import codebase_index, vector_index


_IGNORE_DIRS = codebase_index._IGNORE_DIRS
_MAX_FILE_SIZE = codebase_index._MAX_FILE_SIZE


@dataclass
class IndexStatus:
    workspace: str
    symbol_index_age: float = 0.0  # 秒, -1 = 不存在
    semantic_index_age: float = 0.0
    symbol_files: int = 0
    semantic_chunks: int = 0
    semantic_backend: str = ""
    last_incremental_at: float = 0.0
    last_incremental_changes: int = 0


@dataclass
class DiffResult:
    added: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    deleted: list[str] = field(default_factory=list)

    def total(self) -> int:
        return len(self.added) + len(self.modified) + len(self.deleted)

    def to_dict(self) -> dict[str, Any]:
        return {
            "added": self.added,
            "modified": self.modified,
            "deleted": self.deleted,
            "total": self.total(),
        }


# ---------------------------------------------------------------------------
# 索引状态 (单例)
# ---------------------------------------------------------------------------

_last_change_stats: dict[str, dict[str, Any]] = {}


def _get_git_changes(workspace: Path) -> DiffResult | None:
    """用 git status --porcelain 找出变更文件。

    返回 None 表示非 git 仓库或 git 不可用, 调用方应回退到 mtime 方案。
    """
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=all"],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="replace",
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
        logger.debug(f"git status 不可用: {e}")
        return None
    if result.returncode != 0:
        return None
    diff = DiffResult()
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        # 格式: XY PATH  (X=staged, Y=unstaged, 中间空格或 → 视版本而定)
        if len(line) < 4:
            continue
        # git status --porcelain --untracked-files=all 输出中, 在 Windows 上
        # 第 1-2 字符是状态码, 第 3 字符是空格, 第 4 起是路径 (可能含引号)
        status = line[:2]
        raw_path = line[3:].strip()
        # 去除引号 (git 对含特殊字符的路径加引号)
        if raw_path.startswith('"') and raw_path.endswith('"'):
            raw_path = raw_path[1:-1].replace('\\"', '"')
        # 优先用 "git diff --name-only" 拿到真实变更
        # "M"/"A" 视为 modified, "??" 视为 added, "D" 视为 deleted, "R" 重命名按 modified 处理
        if "??" in status:
            diff.added.append(raw_path.replace("\\", "/"))
        elif "D" in status:
            diff.deleted.append(raw_path.replace("\\", "/"))
        else:
            diff.modified.append(raw_path.replace("\\", "/"))
    return diff


def _get_mtime_diff(workspace: Path) -> DiffResult:
    """基于 mtime 的变更检测 (与现有索引对比)。

    列出所有文件 mtime, 与 codebase-index.json 中存储的 mtime 对比。
    """
    diff = DiffResult()
    idx = codebase_index.load_index(str(workspace))
    if not idx:
        # 索引不存在, 全部视为新增
        for root, dirs, files in os.walk(workspace):
            dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS and not d.startswith(".")]
            for f in files:
                if f.startswith("."):
                    continue
                ext = Path(f).suffix
                if ext in codebase_index._IGNORE_EXTS:
                    continue
                try:
                    full = Path(root) / f
                    if full.stat().st_size > _MAX_FILE_SIZE:
                        continue
                    rel = str(full.relative_to(workspace)).replace("\\", "/")
                    diff.added.append(rel)
                except (PermissionError, OSError):
                    continue
        return diff
    cur: dict[str, float] = {}
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS and not d.startswith(".")]
        for f in files:
            if f.startswith("."):
                continue
            ext = Path(f).suffix
            if ext in codebase_index._IGNORE_EXTS:
                continue
            try:
                full = Path(root) / f
                if full.stat().st_size > _MAX_FILE_SIZE:
                    continue
                rel = str(full.relative_to(workspace)).replace("\\", "/")
                cur[rel] = full.stat().st_mtime
            except (PermissionError, OSError):
                continue
    old = {f.path: f.modified for f in idx.files}
    for path, mtime in cur.items():
        if path not in old:
            diff.added.append(path)
        elif old[path] < mtime - 0.5:  # 容忍 0.5s 浮点误差
            diff.modified.append(path)
    for path in old:
        if path not in cur:
            diff.deleted.append(path)
    return diff


def detect_changes(workspace_path: str) -> DiffResult:
    """智能检测工作区变更: 优先 git, 回退 mtime。"""
    workspace = Path(workspace_path).resolve()
    if not workspace.exists() or not workspace.is_dir():
        return DiffResult()
    diff = _get_git_changes(workspace)
    if diff is not None and diff.total() > 0:
        logger.info(f"增量更新: git 检测到 {diff.total()} 个变更文件")
        return diff
    if diff is not None:
        # git 可用但无变更, 直接返回空
        return diff
    diff = _get_mtime_diff(workspace)
    logger.info(f"增量更新: mtime 检测到 {diff.total()} 个变更文件")
    return diff


# ---------------------------------------------------------------------------
# 索引重建 (单文件级)
# ---------------------------------------------------------------------------

def _reindex_symbols(workspace_path: str, diff: DiffResult) -> int:
    """更新 codebase-index.json 中变更文件的符号条目。返回处理条数。"""
    idx = codebase_index.load_index(workspace_path)
    if not idx:
        # 无索引, 走全量
        codebase_index.build_index(workspace_path)
        return -1
    workspace = Path(workspace_path).resolve()
    by_path = {f.path: f for f in idx.files}
    changed = 0
    # 新增 / 修改
    for rel in diff.added + diff.modified:
        full = workspace / rel
        if not full.exists():
            continue
        try:
            content = full.read_text(encoding="utf-8", errors="replace")
            stat = full.stat()
            symbols = codebase_index._extract_symbols(content, full.suffix)
            summary = codebase_index._extract_summary(content, full.suffix)
            lines = content.count("\n") + 1
            new = codebase_index.FileIndex(
                path=rel,
                name=full.name,
                ext=full.suffix,
                size=stat.st_size,
                lines=lines,
                modified=stat.st_mtime,
                symbols=symbols,
                summary=summary,
            )
            by_path[rel] = new
            changed += 1
        except (PermissionError, OSError, UnicodeDecodeError) as e:
            logger.warning(f"增量更新跳过 {rel}: {e}")
    # 删除
    for rel in diff.deleted:
        if rel in by_path:
            del by_path[rel]
            changed += 1
    idx.files = list(by_path.values())
    idx.total_files = len(idx.files)
    idx.total_lines = sum(f.lines for f in idx.files)
    idx.indexed_at = time.time()
    codebase_index._save_index(idx)
    return changed


def _reindex_semantic(workspace_path: str, diff: DiffResult) -> int:
    """更新 vector-index.json 中变更文件的语义块。返回处理条数。"""
    idx = vector_index.load_semantic_index(workspace_path)
    if not idx:
        vector_index.build_semantic_index(workspace_path)
        return -1
    workspace = Path(workspace_path).resolve()
    cur_files = {ch.file for ch in idx.chunks}
    by_file: dict[str, list[vector_index.VectorChunk]] = {}
    for ch in idx.chunks:
        by_file.setdefault(ch.file, []).append(ch)
    changed = 0
    rels = set(diff.added + diff.modified + diff.deleted)
    for rel in rels:
        # 删除该文件所有块
        if rel in by_file:
            idx.chunks = [c for c in idx.chunks if c.file != rel]
            by_file.pop(rel, None)
            cur_files.discard(rel)
            changed += 1
    # 重新分块变更文件
    for rel in diff.added + diff.modified:
        full = workspace / rel
        if not full.exists() or full.suffix not in vector_index._CODE_EXTS:
            continue
        try:
            stat = full.stat()
            if stat.st_size > vector_index._MAX_FILE_SIZE:
                continue
            content = full.read_text(encoding="utf-8", errors="replace")
        except (PermissionError, OSError, UnicodeDecodeError):
            continue
        chunks = vector_index._split_into_chunks(content, rel)
        for ch in chunks:
            ch.vector = []  # 重建向量
        idx.chunks.extend(chunks)
        cur_files.add(rel)
        changed += 1
    # 重新嵌入 (用一致后端)
    if idx.backend == "st":
        vector_index._embed_with_st(idx)
    else:
        vector_index._embed_with_tfidf(idx)
    idx.indexed_at = time.time()
    idx.total_files = len({ch.file for ch in idx.chunks})
    vector_index._save_semantic_index(idx)
    return changed


# ---------------------------------------------------------------------------
# 公开 API
# ---------------------------------------------------------------------------

def incremental_update(workspace_path: str) -> dict[str, Any]:
    """增量更新两个索引。返回变更报告。"""
    diff = detect_changes(workspace_path)
    if diff.total() == 0:
        _last_change_stats[workspace_path] = {
            "at": time.time(),
            "changes": 0,
            "diff": diff.to_dict(),
        }
        return {
            "workspace": workspace_path,
            "diff": diff.to_dict(),
            "symbols_changed": 0,
            "semantic_changed": 0,
            "skipped": True,
        }
    sym_changed = _reindex_symbols(workspace_path, diff)
    sem_changed = _reindex_semantic(workspace_path, diff)
    _last_change_stats[workspace_path] = {
        "at": time.time(),
        "changes": diff.total(),
        "diff": diff.to_dict(),
    }
    return {
        "workspace": workspace_path,
        "diff": diff.to_dict(),
        "symbols_changed": sym_changed,
        "semantic_changed": sem_changed,
        "skipped": False,
    }


def get_status(workspace_path: str) -> IndexStatus:
    """获取两个索引的状态。"""
    workspace = Path(workspace_path).resolve()
    status = IndexStatus(workspace=workspace_path)
    sym = codebase_index.load_index(workspace_path)
    if sym:
        status.symbol_files = sym.total_files
        status.symbol_index_age = time.time() - sym.indexed_at
    else:
        status.symbol_index_age = -1.0
    sem = vector_index.load_semantic_index(workspace_path)
    if sem:
        status.semantic_chunks = len(sem.chunks)
        status.semantic_index_age = time.time() - sem.indexed_at
        status.semantic_backend = sem.backend
    else:
        status.semantic_index_age = -1.0
    last = _last_change_stats.get(workspace_path, {})
    status.last_incremental_at = last.get("at", 0.0)
    status.last_incremental_changes = last.get("changes", 0)
    return status


def search_codebase(
    workspace_path: str,
    query: str,
    mode: str = "fuzzy",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """统一检索入口。

    mode:
      - fuzzy   : 文件名/符号模糊匹配 (codebase_index.fuzzy_search_files)
      - symbols : 符号名搜索 (codebase_index.search_symbols)
      - semantic: 语义向量检索 (vector_index.search_semantic)
    """
    if mode == "semantic":
        sem = vector_index.get_or_build_semantic_index(workspace_path)
        return vector_index.search_semantic(sem, query, limit=limit)
    sym = codebase_index.get_or_build_index(workspace_path)
    if mode == "symbols":
        return codebase_index.search_symbols(sym, query, limit=limit)
    return codebase_index.fuzzy_search_files(sym, query, limit=limit)
