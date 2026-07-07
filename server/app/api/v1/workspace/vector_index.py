"""
向量语义索引 — 对标 Trae 代码库语义检索 / Cursor Codebase Indexing。

在 codebase_index.py 的正则符号索引之上, 增加基于向量 embedding 的语义检索能力,
补齐 P0 缺口 "代码向量语义检索 (RAG)"。

双轨策略 (避免硬依赖, 部署即用):
- 优先使用 sentence-transformers 本地 embedding 模型 (真语义向量, 对标 Trae)
- 降级为 TF-IDF 稀疏向量 (纯 Python 零依赖, 仍优于纯正则符号匹配)

分块策略:
- 按函数/类语义块切分 (复用 codebase_index 符号提取正则)
- 过长块 (>120 行) 按固定窗口二次切分
- 过短文件整体作为一个块

存储: .claude/vector-index.json (gitignored)
检索: cosine similarity top-k
"""

from __future__ import annotations

import json
import math
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger

# ---------------------------------------------------------------------------
# embedding 后端探测 (双轨)
# ---------------------------------------------------------------------------

try:
    from sentence_transformers import SentenceTransformer  # type: ignore

    _HAS_ST = True
    _ST_MODEL: Any = None  # 延迟加载, 避免启动开销
    _ST_MODEL_NAME = "all-MiniLM-L6-v2"  # 轻量多语言模型 (~80MB)
except ImportError:
    _HAS_ST = False
    _ST_MODEL = None

# TF-IDF 降级相关
_IGNORE_TOKENS = {
    "the", "a", "an", "and", "or", "but", "if", "else", "for", "while",
    "return", "def", "class", "import", "from", "to", "in", "of", "on",
    "is", "not", "this", "self", "true", "false", "none", "null", "var",
    "let", "const", "function", "async", "await", "with", "as", "try",
    "except", "catch", "throw", "new", "public", "private", "void",
    "的", "了", "在", "是", "和", "与", "或", "若", "则", "为", "从", "到",
}


def _get_embed_backend() -> str:
    """返回当前 embedding 后端: 'st' | 'tfidf'。"""
    return "st" if _HAS_ST else "tfidf"


def _get_st_model() -> Any:
    """延迟加载 sentence-transformers 模型 (单例)。"""
    global _ST_MODEL
    if _ST_MODEL is None:
        try:
            _ST_MODEL = SentenceTransformer(_ST_MODEL_NAME)
            logger.info(f"向量索引: 已加载 sentence-transformers 模型 {_ST_MODEL_NAME}")
        except Exception as e:
            logger.warning(f"向量索引: sentence-transformers 加载失败, 降级 TF-IDF: {e}")
            return None
    return _ST_MODEL


# ---------------------------------------------------------------------------
# 分块
# ---------------------------------------------------------------------------

# 符号定义行正则 (函数/类/方法起点)
_BLOCK_START_PATTERNS = [
    re.compile(r"^\s*(?:async\s+def|def|class)\s+\w+", re.MULTILINE),  # Python
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+", re.MULTILINE),  # JS/TS
    re.compile(r"^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\(", re.MULTILINE),  # JS/TS 箭头
    re.compile(r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+", re.MULTILINE),  # JS/TS class
    re.compile(r"^\s*func\s+\w+", re.MULTILINE),  # Go
    re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+\w+", re.MULTILINE),  # Rust
    re.compile(r"^\s*(?:public|private|protected|static)\s+.*\s+\w+\s*\(", re.MULTILINE),  # Java
]

_MAX_CHUNK_LINES = 120
_MIN_CHUNK_LINES = 6


@dataclass
class VectorChunk:
    """语义块。"""
    file: str
    symbol: str = ""  # 所属符号名 (函数/类名)
    text: str = ""
    start_line: int = 0
    end_line: int = 0
    vector: list[float] = field(default_factory=list)


def _split_into_chunks(content: str, file_path: str) -> list[VectorChunk]:
    """将文件内容按语义块切分。"""
    lines = content.split("\n")
    if not lines:
        return []

    # 找到所有符号定义行号
    start_indices: list[int] = []
    for pattern in _BLOCK_START_PATTERNS:
        for m in pattern.finditer(content):
            line_no = content[: m.start()].count("\n")
            if line_no not in start_indices:
                start_indices.append(line_no)
    start_indices.sort()

    # 无符号定义 → 整文件作为一块 (若太大则按窗口切)
    if not start_indices:
        return _window_split(lines, file_path, 0, len(lines), "")

    chunks: list[VectorChunk] = []
    # 符号前的头部 (注释/导入) 单独成块 (若足够长)
    if start_indices[0] >= _MIN_CHUNK_LINES:
        chunks.extend(_window_split(lines, file_path, 0, start_indices[0], ""))

    # 每个符号区间作为一个块
    boundaries = start_indices + [len(lines)]
    for i in range(len(start_indices)):
        start = boundaries[i]
        end = boundaries[i + 1]
        # 提取符号名
        symbol = ""
        m = re.search(r"(?:def|class|function|func|fn)\s+(\w+)", lines[start])
        if m:
            symbol = m.group(1)
        chunks.extend(_window_split(lines, file_path, start, end, symbol))

    return [c for c in chunks if c.text.strip()]


def _window_split(lines: list[str], file_path: str, start: int, end: int, symbol: str) -> list[VectorChunk]:
    """将 [start, end) 行区间按窗口切分 (超过 _MAX_CHUNK_LINES)。"""
    span = end - start
    if span <= 0:
        return []
    if span <= _MAX_CHUNK_LINES:
        return [VectorChunk(
            file=file_path,
            symbol=symbol,
            text="\n".join(lines[start:end]),
            start_line=start + 1,
            end_line=end,
        )]
    # 按 _MAX_CHUNK_LINES 窗口切分, 重叠 10 行
    chunks: list[VectorChunk] = []
    step = _MAX_CHUNK_LINES - 10
    cur = start
    while cur < end:
        nxt = min(cur + _MAX_CHUNK_LINES, end)
        chunks.append(VectorChunk(
            file=file_path,
            symbol=symbol,
            text="\n".join(lines[cur:nxt]),
            start_line=cur + 1,
            end_line=nxt,
        ))
        cur += step
    return chunks


# ---------------------------------------------------------------------------
# TF-IDF embedding (降级方案, 纯 Python)
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[A-Za-z_]\w{1,}|[\u4e00-\u9fa5]{2,}")


def _tokenize(text: str) -> list[str]:
    """分词: 标识符 + 中文双字。"""
    tokens = _TOKEN_RE.findall(text.lower())
    # 标识符驼峰拆分: getUserById → get, user, by, id
    expanded: list[str] = []
    for t in tokens:
        if t.isascii() and any(c.isupper() for c in t):
            parts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)", t)
            expanded.extend(parts if parts else [t])
        else:
            expanded.append(t)
    return [t for t in expanded if t not in _IGNORE_TOKENS and len(t) > 1]


def _build_idf_map(chunks: list[VectorChunk]) -> dict[str, float]:
    """构建 IDF 映射。"""
    doc_freq: dict[str, int] = {}
    for ch in chunks:
        seen = set(_tokenize(ch.text))
        for tok in seen:
            doc_freq[tok] = doc_freq.get(tok, 0) + 1
    n = max(len(chunks), 1)
    return {tok: math.log((n + 1) / (df + 1)) + 1.0 for tok, df in doc_freq.items()}


def _tfidf_vector(text: str, idf_map: dict[str, float]) -> dict[str, float]:
    """生成 TF-IDF 稀疏向量 (dict 形式, 节省内存)。"""
    tokens = _tokenize(text)
    if not tokens:
        return {}
    tf: dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    total = len(tokens)
    return {t: (cnt / total) * idf_map.get(t, 1.0) for t, cnt in tf.items()}


def _sparse_cosine(v1: dict[str, float], v2: dict[str, float]) -> float:
    """稀疏向量的 cosine 相似度。"""
    if not v1 or not v2:
        return 0.0
    # 交换较小的做迭代
    if len(v1) > len(v2):
        v1, v2 = v2, v1
    dot = sum(v * v2.get(k, 0.0) for k, v in v1.items())
    n1 = math.sqrt(sum(v * v for v in v1.values()))
    n2 = math.sqrt(sum(v * v for v in v2.values()))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


# ---------------------------------------------------------------------------
# 语义索引
# ---------------------------------------------------------------------------

@dataclass
class SemanticIndex:
    """语义向量索引。"""
    workspace: str
    backend: str = "tfidf"  # 'st' | 'tfidf'
    chunks: list[VectorChunk] = field(default_factory=list)
    idf_map: dict[str, float] = field(default_factory=dict)
    indexed_at: float = 0.0
    total_files: int = 0

    def to_dict(self) -> dict[str, Any]:
        # sentence-transformers 后端的稠密向量很大, 用列表存储; TF-IDF 用 dict
        return {
            "workspace": self.workspace,
            "backend": self.backend,
            "indexed_at": self.indexed_at,
            "total_files": self.total_files,
            "idf_map": self.idf_map if self.backend == "tfidf" else {},
            "chunks": [
                {
                    "file": c.file,
                    "symbol": c.symbol,
                    "text": c.text,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "vector": c.vector,  # ST: list[float]; TF-IDF: 存 dict 的 values 不够, 需键值
                }
                for c in self.chunks
            ],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SemanticIndex:
        idx = cls(workspace=data["workspace"], backend=data.get("backend", "tfidf"))
        idx.indexed_at = data.get("indexed_at", 0.0)
        idx.total_files = data.get("total_files", 0)
        idx.idf_map = data.get("idf_map", {})
        for c_data in data.get("chunks", []):
            idx.chunks.append(VectorChunk(
                file=c_data["file"],
                symbol=c_data.get("symbol", ""),
                text=c_data.get("text", ""),
                start_line=c_data.get("start_line", 0),
                end_line=c_data.get("end_line", 0),
                vector=c_data.get("vector", []),
            ))
        return idx


# ---------------------------------------------------------------------------
# 构建与检索
# ---------------------------------------------------------------------------

_IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "dist", "build",
    ".vite", ".cache", "venv", ".venv", "env", ".env",
    "$RECYCLE.BIN", "System Volume Information", ".idea", ".vscode",
}
_IGNORE_EXTS = {".pyc", ".pyo", ".class", ".o", ".so", ".dll", ".exe", ".bin", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".gz", ".tar"}
_CODE_EXTS = {".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".java", ".go", ".rs", ".jsx", ".html", ".css", ".scss", ".md", ".json", ".yaml", ".yml", ".sh", ".ps1"}
_MAX_FILE_SIZE = 512 * 1024  # 512KB


def build_semantic_index(workspace_path: str) -> SemanticIndex:
    """构建语义向量索引。"""
    workspace = Path(workspace_path)
    backend = _get_embed_backend()
    index = SemanticIndex(workspace=workspace_path, backend=backend, indexed_at=time.time())

    try:
        for root, dirs, files in __import__("os").walk(workspace):
            dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS and not d.startswith(".")]
            for filename in files:
                if filename.startswith("."):
                    continue
                ext = Path(filename).suffix
                if ext in _IGNORE_EXTS or ext not in _CODE_EXTS:
                    continue
                full_path = Path(root) / filename
                try:
                    stat = full_path.stat()
                    if stat.st_size > _MAX_FILE_SIZE:
                        continue
                    content = full_path.read_text(encoding="utf-8", errors="replace")
                except (PermissionError, OSError, UnicodeDecodeError):
                    continue

                rel_path = str(full_path.relative_to(workspace)).replace("\\", "/")
                chunks = _split_into_chunks(content, rel_path)
                index.chunks.extend(chunks)
                index.total_files += 1

        # 生成向量
        if backend == "st":
            _embed_with_st(index)
        else:
            _embed_with_tfidf(index)

    except Exception as e:
        logger.error(f"构建语义索引失败: {e}")

    _save_semantic_index(index)
    logger.info(f"语义索引构建完成: backend={backend}, chunks={len(index.chunks)}, files={index.total_files}")
    return index


def _embed_with_st(index: SemanticIndex) -> None:
    """用 sentence-transformers 生成稠密向量。"""
    model = _get_st_model()
    if model is None:
        # 加载失败, 降级 TF-IDF
        index.backend = "tfidf"
        _embed_with_tfidf(index)
        return
    texts = [c.text for c in index.chunks]
    # 批量编码 (batch_size 控制内存)
    batch_size = 64
    vectors: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        emb = model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
        vectors.extend([row.tolist() for row in emb])
    for ch, vec in zip(index.chunks, vectors):
        ch.vector = vec


def _embed_with_tfidf(index: SemanticIndex) -> None:
    """用 TF-IDF 生成稀疏向量 (存为 dict 序列化, 运行时用 dict)。"""
    index.idf_map = _build_idf_map(index.chunks)
    for ch in index.chunks:
        # vector 字段存 TF-IDF dict 的序列化形式 (list of [token, weight])
        # 但 VectorChunk.vector 是 list[float], 这里我们复用它存键值对的扁平化
        sparse = _tfidf_vector(ch.text, index.idf_map)
        # 存为交替 [token_idx, weight] 用 idf_map 索引, 节省空间
        # 简化: 运行时重新计算, 存储只存 text (检索时动态算 query 向量)
        ch.vector = []  # TF-IDF 模式下不存储 chunk 向量, 检索时动态计算


def search_semantic(index: SemanticIndex, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """语义检索: 返回 top-k 相关块。"""
    if not index.chunks:
        return []

    if index.backend == "st":
        return _search_st(index, query, limit)
    return _search_tfidf(index, query, limit)


def _search_st(index: SemanticIndex, query: str, limit: int) -> list[dict[str, Any]]:
    """sentence-transformers 检索 (稠密向量 cosine)。"""
    model = _get_st_model()
    if model is None or not index.chunks or not index.chunks[0].vector:
        return []
    q_vec = model.encode([query], convert_to_numpy=True, show_progress_bar=False)[0].tolist()

    scored: list[tuple[float, VectorChunk]] = []
    for ch in index.chunks:
        score = _dense_cosine(q_vec, ch.vector)
        scored.append((score, ch))
    scored.sort(key=lambda x: -x[0])

    results: list[dict[str, Any]] = []
    seen_files: set[str] = set()
    for score, ch in scored:
        if score <= 0.05:
            continue
        results.append({
            "file": ch.file,
            "symbol": ch.symbol,
            "score": round(score, 4),
            "start_line": ch.start_line,
            "end_line": ch.end_line,
            "preview": ch.text[:300],
        })
        seen_files.add(ch.file)
        if len(results) >= limit:
            break
    return results


def _search_tfidf(index: SemanticIndex, query: str, limit: int) -> list[dict[str, Any]]:
    """TF-IDF 检索 (稀疏向量 cosine, 动态计算)。"""
    q_vec = _tfidf_vector(query, index.idf_map)
    if not q_vec:
        return []

    scored: list[tuple[float, VectorChunk]] = []
    for ch in index.chunks:
        ch_vec = _tfidf_vector(ch.text, index.idf_map)
        score = _sparse_cosine(q_vec, ch_vec)
        scored.append((score, ch))
    scored.sort(key=lambda x: -x[0])

    results: list[dict[str, Any]] = []
    for score, ch in scored:
        if score <= 0.01:
            continue
        results.append({
            "file": ch.file,
            "symbol": ch.symbol,
            "score": round(score, 4),
            "start_line": ch.start_line,
            "end_line": ch.end_line,
            "preview": ch.text[:300],
        })
        if len(results) >= limit:
            break
    return results


def _dense_cosine(v1: list[float], v2: list[float]) -> float:
    """稠密向量 cosine 相似度。"""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

def _get_semantic_index_path(workspace_path: str) -> Path:
    return Path(workspace_path) / ".claude" / "vector-index.json"


def _save_semantic_index(index: SemanticIndex) -> None:
    path = _get_semantic_index_path(index.workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        # ST 稠密向量文件较大, 仍持久化以避免重复编码
        path.write_text(
            json.dumps(index.to_dict(), ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"保存语义索引失败: {e}")


def load_semantic_index(workspace_path: str) -> SemanticIndex | None:
    path = _get_semantic_index_path(workspace_path)
    if not path.exists():
        return None
    try:
        return SemanticIndex.from_dict(json.loads(path.read_text(encoding="utf-8")))
    except Exception as e:
        logger.warning(f"加载语义索引失败: {e}")
        return None


def get_or_build_semantic_index(workspace_path: str, max_age_seconds: int = 7200) -> SemanticIndex:
    """获取或构建语义索引 (带缓存, 默认 2 小时)。"""
    idx = load_semantic_index(workspace_path)
    # 后端不一致 (如装了 sentence-transformers 后重建) 或过期 → 重建
    current_backend = _get_embed_backend()
    if idx and idx.backend == current_backend and (time.time() - idx.indexed_at) < max_age_seconds:
        return idx
    return build_semantic_index(workspace_path)


async def semantic_search(workspace_path: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """语义检索入口 (供 agent_loop 的 codebase_search 工具调用)。

    带缓存的索引获取 + 同步检索 (TF-IDF 快; ST 首次编码慢但已持久化)。
    """
    idx = get_or_build_semantic_index(workspace_path)
    return search_semantic(idx, query, limit)
