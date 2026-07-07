"""
代码库索引 — 对标 Cursor 的 Codebase Indexing。

提供:
- 文件树缓存 (快速 glob/list_dir)
- 模糊文件搜索 (fuzzy match, 类似 VS Code Quick Open)
- 符号索引 (函数/类/变量定义位置)
- 文件摘要 (简要描述每个文件用途)

不使用向量嵌入 (避免重型依赖), 而是:
- 文件名 + 路径模糊匹配
- 关键符号提取 (正则匹配)
- 文件大小/行数统计

索引存储在 .claude/codebase-index.json 中 (gitignored)。
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger


# 忽略的目录
_IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "dist", "build",
    ".vite", ".cache", "venv", ".venv", "env", ".env",
    "$RECYCLE.BIN", "System Volume Information", ".idea", ".vscode",
}

# 忽略的文件扩展名
_IGNORE_EXTS = {".pyc", ".pyo", ".class", ".o", ".so", ".dll", ".exe", ".bin"}

# 最大索引文件大小 (1MB)
_MAX_FILE_SIZE = 1024 * 1024

# 符号提取正则
_SYMBOL_PATTERNS = {
    "python": [
        re.compile(r"^(?:class|async\s+def|def)\s+(\w+)", re.MULTILINE),
        re.compile(r"^(\w+)\s*[:=]", re.MULTILINE),
    ],
    "javascript": [
        re.compile(r"(?:function|class|const|let|var)\s+(\w+)", re.MULTILINE),
    ],
    "typescript": [
        re.compile(r"(?:function|class|interface|type|enum|const|let|var)\s+(\w+)", re.MULTILINE),
        re.compile(r"(?:export\s+)?(?:default\s+)?(?:function|class)\s+(\w+)", re.MULTILINE),
    ],
    "vue": [
        re.compile(r"(?:defineComponent|defineAsyncComponent|defineProps|defineEmits)\s*\(", re.MULTILINE),
    ],
    "java": [
        re.compile(r"(?:public|private|protected|static)\s+(?:class|interface|void|int|String|boolean)\s+(\w+)", re.MULTILINE),
    ],
    "go": [
        re.compile(r"^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)", re.MULTILINE),
    ],
    "rust": [
        re.compile(r"(?:pub\s+)?(?:fn|struct|enum|trait|impl)\s+(\w+)", re.MULTILINE),
    ],
}


@dataclass
class FileIndex:
    """单个文件的索引。"""
    path: str
    name: str
    ext: str
    size: int
    lines: int
    modified: float
    symbols: list[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class CodebaseIndex:
    """代码库索引。"""
    workspace: str
    files: list[FileIndex] = field(default_factory=list)
    indexed_at: float = 0.0
    total_files: int = 0
    total_lines: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "workspace": self.workspace,
            "indexed_at": self.indexed_at,
            "total_files": self.total_files,
            "total_lines": self.total_lines,
            "files": [
                {
                    "path": f.path,
                    "name": f.name,
                    "ext": f.ext,
                    "size": f.size,
                    "lines": f.lines,
                    "modified": f.modified,
                    "symbols": f.symbols,
                    "summary": f.summary,
                }
                for f in self.files
            ],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CodebaseIndex:
        idx = cls(workspace=data["workspace"])
        idx.indexed_at = data.get("indexed_at", 0)
        idx.total_files = data.get("total_files", 0)
        idx.total_lines = data.get("total_lines", 0)
        for f_data in data.get("files", []):
            idx.files.append(FileIndex(**f_data))
        return idx


# ---------------------------------------------------------------------------
# 索引构建
# ---------------------------------------------------------------------------

def build_index(workspace_path: str) -> CodebaseIndex:
    """构建代码库索引。"""
    workspace = Path(workspace_path)
    index = CodebaseIndex(workspace=workspace_path, indexed_at=time.time())

    try:
        for root, dirs, files in os.walk(workspace):
            # 过滤忽略目录
            dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS and not d.startswith(".")]

            for filename in files:
                if filename.startswith("."):
                    continue
                ext = Path(filename).suffix
                if ext in _IGNORE_EXTS:
                    continue

                full_path = Path(root) / filename
                try:
                    stat = full_path.stat()
                    if stat.st_size > _MAX_FILE_SIZE:
                        continue
                except (PermissionError, OSError):
                    continue

                rel_path = str(full_path.relative_to(workspace)).replace("\\", "/")

                # 读取内容提取符号
                symbols: list[str] = []
                summary = ""
                lines = 0
                try:
                    content = full_path.read_text(encoding="utf-8", errors="replace")
                    lines = content.count("\n") + 1
                    symbols = _extract_symbols(content, ext)
                    summary = _extract_summary(content, ext)
                except Exception:
                    pass

                index.files.append(FileIndex(
                    path=rel_path,
                    name=filename,
                    ext=ext,
                    size=stat.st_size,
                    lines=lines,
                    modified=stat.st_mtime,
                    symbols=symbols,
                    summary=summary,
                ))
                index.total_lines += lines

        index.total_files = len(index.files)
    except Exception as e:
        logger.error(f"构建代码库索引失败: {e}")

    # 持久化
    _save_index(index)
    return index


def _extract_symbols(content: str, ext: str) -> list[str]:
    """从文件内容提取符号 (函数/类/变量名)。"""
    lang = _detect_language(ext)
    patterns = _SYMBOL_PATTERNS.get(lang, [])
    symbols: list[str] = []
    for pattern in patterns:
        matches = pattern.findall(content)
        symbols.extend(matches[:50])  # 每种模式最多 50 个
    return symbols[:100]  # 总计最多 100 个


def _extract_summary(content: str, ext: str) -> str:
    """提取文件摘要 (第一段注释或文档字符串)。"""
    lines = content.strip().split("\n")[:5]
    # 查找注释行
    comment_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            comment_lines.append(stripped.lstrip("#/*\t "))
        elif stripped.startswith('"""') or stripped.startswith("'''"):
            comment_lines.append(stripped.strip('"\''))
    return " ".join(comment_lines)[:200] if comment_lines else ""


def _detect_language(ext: str) -> str:
    """根据扩展名检测语言。"""
    mapping = {
        ".py": "python",
        ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
        ".ts": "typescript", ".tsx": "typescript",
        ".vue": "vue",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
    }
    return mapping.get(ext, "")


# ---------------------------------------------------------------------------
# 搜索
# ---------------------------------------------------------------------------

def fuzzy_search_files(index: CodebaseIndex, query: str, limit: int = 20) -> list[dict[str, Any]]:
    """模糊搜索文件 (类似 VS Code Quick Open)。

    匹配文件名和路径中的字符序列, 按相关度排序。
    """
    query = query.lower().strip()
    if not query:
        return []

    results: list[tuple[int, FileIndex]] = []
    for f in index.files:
        score = _fuzzy_score(f.path.lower(), query)
        if score > 0:
            # 符号匹配额外加分
            for sym in f.symbols:
                if query in sym.lower():
                    score += 5
                    break
            results.append((score, f))

    # 按分数降序排序
    results.sort(key=lambda x: -x[0])
    return [
        {
            "path": f.path,
            "name": f.name,
            "score": score,
            "symbols": f.symbols[:5],
            "summary": f.summary,
        }
        for score, f in results[:limit]
    ]


def _fuzzy_score(text: str, query: str) -> int:
    """计算模糊匹配分数。"""
    if not query:
        return 0
    # 精确匹配
    if query in text:
        return 100 - text.index(query)
    # 顺序匹配 (字符按顺序出现)
    qi = 0
    score = 0
    last_match = -1
    for ti, tc in enumerate(text):
        if qi < len(query) and tc == query[qi]:
            # 连续匹配加分
            gap = ti - last_match if last_match >= 0 else 0
            score += 10 if gap <= 1 else 5
            last_match = ti
            qi += 1
    if qi == len(query):
        return score
    return 0


def search_symbols(index: CodebaseIndex, query: str, limit: int = 30) -> list[dict[str, Any]]:
    """搜索符号 (函数/类/变量定义)。"""
    query = query.lower()
    results: list[dict[str, Any]] = []
    for f in index.files:
        for sym in f.symbols:
            if query in sym.lower():
                results.append({
                    "name": sym,
                    "file": f.path,
                    "ext": f.ext,
                })
                if len(results) >= limit:
                    return results
    return results


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

def _get_index_path(workspace_path: str) -> Path:
    """获取索引文件路径。"""
    return Path(workspace_path) / ".claude" / "codebase-index.json"


def _save_index(index: CodebaseIndex) -> None:
    """保存索引到文件。"""
    index_path = _get_index_path(index.workspace)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        index_path.write_text(
            json.dumps(index.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"保存代码库索引失败: {e}")


def load_index(workspace_path: str) -> CodebaseIndex | None:
    """加载已有索引。"""
    index_path = _get_index_path(workspace_path)
    if not index_path.exists():
        return None
    try:
        return CodebaseIndex.from_dict(
            json.loads(index_path.read_text(encoding="utf-8"))
        )
    except Exception as e:
        logger.warning(f"加载代码库索引失败: {e}")
        return None


def get_or_build_index(workspace_path: str, max_age_seconds: int = 3600) -> CodebaseIndex:
    """获取或构建索引 (带缓存)。"""
    index = load_index(workspace_path)
    if index and (time.time() - index.indexed_at) < max_age_seconds:
        return index
    return build_index(workspace_path)
