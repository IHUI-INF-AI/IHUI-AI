# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代码库语义索引器。

用 tree-sitter AST 解析代码 → 按符号(函数/类/方法/接口)切片 → 生成 embedding → 写入 codebase_chunks 表。
AST 解析失败时降级为固定行数切片(100 行/片,50 行重叠)。

2026-09-07 升级(对标 Cursor Merkle 增量同步 + CodeBuddy 三层语义索引):
- Merkle 增量同步:文件内容 sha256 快照持久化,重索引时只对变更文件
  重新切片+embedding(未变文件零成本跳过),删除文件同步清除旧切片
  (DELETE /api/v1/codebase/repo/:repoId/files)。快照根 hash =
  sha256(sorted(path:hash)),与 Cursor Merkle Tree 思想一致。
- 三层语义索引:函数层(符号切片,原有)+ 模块层(每文件摘要切片
  symbol_type=module_summary)+ 架构层(每顶层目录摘要切片
  symbol_type=architecture_summary)。合成切片走同一 embedding 通道,
  语义搜索自然命中"这个模块是干什么的/整体架构是什么"类查询。

依赖:
- tree-sitter + tree-sitter-language-pack(可选,未安装时降级为正则切片)
- llm_gateway.embed()(已存在,生成 1536 维向量)

使用方式:
    from app.services.codebase_indexer import codebase_indexer
    result = await codebase_indexer.index_repository("/path/to/repo", repo_id="my-repo")
    result = await codebase_indexer.search("用户认证逻辑", repo_id="my-repo")
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, cast

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# ---- anydoc 文档提取引擎(可选依赖)----
# 文档格式(docx/doc/pdf/pptx/ppt/xls/xlsx/odt/ods/odp/rtf/epub)为二进制容器,
# 直接 read_text 会产生乱码切片;经 anydoc 抽取为 Markdown 后再入索引。
# 未安装 anydoc 时不映射这些扩展名,保持原有行为(完全跳过)。
try:
    import anydoc as _anydoc

    _ANYDOC_OK: bool = True
except ImportError:  # pragma: no cover - 依赖缺失环境
    _anydoc = None  # type: ignore[assignment]
    _ANYDOC_OK = False

# 需经 anydoc 抽取的文档扩展名
_DOC_EXTS: frozenset[str] = frozenset({
    ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls",
    ".odt", ".ods", ".odp", ".rtf", ".epub", ".pdf",
})

# 支持的文件扩展名 → 语言映射
_EXT_TO_LANG: dict[str, str] = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".vue": "vue",
    ".svelte": "svelte",
}

# Markdown 文档(纯文本,无需 anydoc)→ 以 "markdown" 语言走正则切片
_EXT_TO_LANG[".md"] = "markdown"
_EXT_TO_LANG[".markdown"] = "markdown"
# 二进制文档格式依赖 anydoc,仅在引擎可用时纳入索引收集
if _ANYDOC_OK:
    for _doc_ext in sorted(_DOC_EXTS):
        _EXT_TO_LANG[_doc_ext] = "markdown"


def _extract_document_markdown(path: Path) -> str:
    """anydoc 提取文档格式为 Markdown 文本(阻塞调用,异步上下文请经 asyncio.to_thread)。

    失败时抛异常,由调用方捕获并记入 result.errors(跳过该文件)。
    """
    if _anydoc is None:
        raise RuntimeError("anydoc 模块未安装, 无法索引文档格式")
    return _anydoc.to_markdown(str(path))

# 忽略目录
_IGNORED_DIRS: set[str] = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".turbo", ".cache", "coverage",
    ".mypy_cache", ".pytest_cache", ".ruff_cache", ".tox", "env",
    ".idea", ".vscode", "target", "eggs", ".eggs",
}

# 每个切片最大字符数(防 embedding 输入过长)
MAX_CHUNK_CHARS = 8000
# 固定行数切片参数(降级模式)
FIXED_CHUNK_LINES = 100
FIXED_CHUNK_OVERLAP = 50
# 单文件最大切片数(防超大文件拖慢索引)
MAX_CHUNKS_PER_FILE = 200
# 单次索引最大文件数(防仓库过大)
MAX_FILES_PER_INDEX = 5000
# embedding 批量大小(单次 API 调用)
EMBEDDING_BATCH_SIZE = 20
# 三层语义索引:文件含符号切片 ≥ 该阈值才生成模块层摘要切片(少文件无收益)
MODULE_SUMMARY_MIN_CHUNKS = 4
# 架构摘要:每个顶层目录一个合成切片;目录下文件数 ≥ 该阈值才生成
ARCH_SUMMARY_MIN_FILES = 3
# Merkle 快照目录(每 repo_id 一个 JSON;env CODEBASE_INDEX_CACHE_DIR 可覆盖)
_MERKLE_SNAPSHOT_DIR = Path(
    os.environ.get("CODEBASE_INDEX_CACHE_DIR", str(Path.home() / ".ihui" / "codebase-index"))
)


def _file_content_hash(content: str) -> str:
    """文件内容 sha256(Merkle 叶子节点 hash)。"""
    return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()


def _merkle_root(file_hashes: dict[str, str]) -> str:
    """Merkle 根 hash = sha256(sorted("path:hash"))(与 Cursor Merkle Tree 思想一致)。
    任一文件增删改都会改变根 hash,重索引时可 O(1) 判断整仓是否变更。"""
    joined = "\n".join(f"{p}:{h}" for p, h in sorted(file_hashes.items()))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


@dataclass
class CodeChunk:
    """代码切片。"""

    file_path: str
    line_start: int
    line_end: int
    content: str
    language: Optional[str] = None
    symbol_name: Optional[str] = None
    symbol_type: Optional[str] = None
    embedding: Optional[list[float]] = None


@dataclass
class IndexResult:
    """索引结果。"""

    repo_id: str
    files_scanned: int = 0
    files_indexed: int = 0
    chunks_created: int = 0
    chunks_vectorized: int = 0
    errors: list[str] = field(default_factory=list)
    # 2026-09-07 Merkle 增量同步统计
    files_unchanged: int = 0  # 内容未变被跳过的文件数(零 embedding 成本)
    files_deleted: int = 0  # 已删除并同步清除切片的文件数
    merkle_root: str = ""  # 本轮快照根 hash(可跨轮比较 O(1) 判断整仓变更)


class CodebaseIndexer:
    """代码库语义索引器。

    流程:
    1. 扫描仓库 → 收集代码文件
    2. 每个文件用 tree-sitter AST 切片(降级为固定行数切片)
    3. 批量调 llm_gateway.embed() 生成 1536 维向量
    4. 通过 API 端点 POST /api/v1/codebase/index 写入数据库
    """

    def __init__(self) -> None:
        self._tree_sitter_available = self._check_tree_sitter()
        self._api_base_url = os.environ.get(
            "API_SERVICE_URL", "http://localhost:8801"
        ).rstrip("/")

    def _internal_auth_headers(
        self,
        api_token: Optional[str],
        internal_user_id: Optional[str] = None,
    ) -> dict[str, str]:
        """构造写入口鉴权头(2026-09-07 立)。

        优先级:
        1. api_token(用户 JWT,Bearer 认证)——Web/会话链路显式传入时使用
        2. 内部服务通道(AI_CALLBACK_SECRET + X-User-Id)——MCP 工具/服务端
           触发索引时使用,与 api 侧 internal-service-token 中间件契约一致
        两者皆无 → 空 headers(写入会被 401 拒绝,调用方按错误降级处理)。
        """
        if api_token:
            return {"Authorization": f"Bearer {api_token}"}
        secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
        if (
            secret
            and internal_user_id
            and re.fullmatch(r"[a-zA-Z0-9-]{1,128}", internal_user_id)
        ):
            return {
                "x-internal-service-token": secret,
                "x-user-id": internal_user_id,
            }
        return {}

    def _check_tree_sitter(self) -> bool:
        """检查 tree-sitter 是否可用。"""
        try:
            import tree_sitter  # noqa: F401
            import tree_sitter_language_pack  # noqa: F401
            return True
        except ImportError:
            logger.info(
                "tree-sitter 未安装,代码切片将降级为正则模式。"
                "安装依赖:pip install tree-sitter tree-sitter-language-pack"
            )
            return False

    def _get_parser(self, language: str) -> Any:
        """获取 tree-sitter parser(语言不可用时返回 None)。"""
        if not self._tree_sitter_available:
            return None
        try:
            from tree_sitter import Language, Parser  # noqa: F401
            from tree_sitter_language_pack import get_language

            lang_map = {
                "typescript": "typescript",
                "tsx": "tsx",
                "javascript": "javascript",
                "jsx": "jsx",
                "python": "python",
                "go": "go",
                "rust": "rust",
                "java": "java",
                "c": "c",
                "cpp": "cpp",
                "csharp": "c_sharp",
                "ruby": "ruby",
                "php": "php",
            }
            ts_lang_name = lang_map.get(language)
            if not ts_lang_name:
                return None
            lang = get_language(ts_lang_name)
            parser = Parser()
            parser.language = lang
            return parser
        except Exception as e:
            logger.debug("获取 tree-sitter parser 失败(lang=%s): %s", language, e)
            return None

    # 符号节点类型 → (symbol_type, name_field)
    _SYMBOL_NODE_TYPES: dict[str, tuple[str, str]] = {
        # TypeScript / JavaScript
        "function_declaration": ("function", "name"),
        "function_signature": ("function", "name"),
        "method_definition": ("method", "name"),
        "class_declaration": ("class", "name"),
        "interface_declaration": ("interface", "name"),
        "type_alias_declaration": ("type", "name"),
        "enum_declaration": ("enum", "name"),
        "export_statement": ("module", "name"),
        # Python
        "function_definition": ("function", "name"),
        "class_definition": ("class", "name"),
        "decorated_definition": ("module", "name"),
        # Go
        "function_declaration": ("function", "name"),
        "method_declaration": ("method", "name"),
        "type_declaration": ("type", "name"),
        # Rust
        "function_item": ("function", "name"),
        "struct_item": ("class", "name"),
        "enum_item": ("enum", "name"),
        "trait_item": ("interface", "name"),
        "impl_item": ("method", "name"),
    }

    def _extract_symbol_name(self, node: Any, name_field: str) -> Optional[str]:
        """从 AST 节点提取符号名。"""
        child = node.child_by_field_name(name_field)
        if child and child.text:
            return cast(str, child.text.decode("utf-8", errors="replace"))
        return None

    def _chunk_by_ast(self, content: str, language: str) -> list[CodeChunk]:
        """用 tree-sitter AST 切片代码。"""
        parser = self._get_parser(language)
        if not parser:
            return self._chunk_by_regex(content, language)

        try:
            tree = parser.parse(content.encode("utf-8"))
        except Exception as e:
            logger.debug("AST 解析失败(lang=%s): %s, 降级正则", language, e)
            return self._chunk_by_regex(content, language)

        lines = content.splitlines()
        chunks: list[CodeChunk] = []

        def walk(node: Any) -> None:
            node_type = node.type
            if node_type in self._SYMBOL_NODE_TYPES:
                symbol_type, name_field = self._SYMBOL_NODE_TYPES[node_type]
                symbol_name = self._extract_symbol_name(node, name_field)
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                # 提取切片内容
                start_idx = node.start_byte
                end_idx = node.end_byte
                chunk_content = content[start_idx:end_idx]
                if len(chunk_content) > MAX_CHUNK_CHARS:
                    chunk_content = chunk_content[:MAX_CHUNK_CHARS]
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        file_path="",  # 由调用方填充
                        line_start=start_line,
                        line_end=end_line,
                        content=chunk_content,
                        language=language,
                        symbol_name=symbol_name,
                        symbol_type=symbol_type,
                    ))
                # 不再递归子节点(已捕获整个符号)
                return
            for child in node.children:
                walk(child)

        walk(tree.root_node)

        # 若 AST 未提取到任何符号,降级为正则
        if not chunks:
            return self._chunk_by_regex(content, language)

        return chunks[:MAX_CHUNKS_PER_FILE]

    # 正则符号模式(降级模式,按语言)
    _REGEX_PATTERNS: dict[str, list[tuple[str, "re.Pattern[str]", str]]] = {
        "python": [
            ("function", re.compile(r"^\s*(?:async\s+def|def)\s+(\w+)", re.MULTILINE), "def"),
            ("class", re.compile(r"^\s*class\s+(\w+)", re.MULTILINE), "class"),
        ],
        "typescript": [
            ("function", re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE), "function"),
            ("class", re.compile(r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", re.MULTILINE), "class"),
            ("interface", re.compile(r"^\s*(?:export\s+)?interface\s+(\w+)", re.MULTILINE), "interface"),
            ("type", re.compile(r"^\s*(?:export\s+)?type\s+(\w+)", re.MULTILINE), "type"),
        ],
        "javascript": [
            ("function", re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE), "function"),
            ("class", re.compile(r"^\s*(?:export\s+)?class\s+(\w+)", re.MULTILINE), "class"),
        ],
        "go": [
            ("function", re.compile(r"^\s*func\s+(\w+)", re.MULTILINE), "func"),
            ("method", re.compile(r"^\s*func\s+\([^)]+\)\s+(\w+)", re.MULTILINE), "func"),
            ("type", re.compile(r"^\s*type\s+(\w+)", re.MULTILINE), "type"),
        ],
        "rust": [
            ("function", re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)", re.MULTILINE), "fn"),
            ("class", re.compile(r"^\s*(?:pub\s+)?struct\s+(\w+)", re.MULTILINE), "struct"),
            ("interface", re.compile(r"^\s*(?:pub\s+)?trait\s+(\w+)", re.MULTILINE), "trait"),
            ("enum", re.compile(r"^\s*(?:pub\s+)?enum\s+(\w+)", re.MULTILINE), "enum"),
        ],
    }

    def _chunk_by_regex(self, content: str, language: str) -> list[CodeChunk]:
        """正则模式切片(降级方案)。

        先尝试按符号定义行切片(函数/类/接口),若无匹配则按固定行数切片。
        """
        lines = content.splitlines()
        chunks: list[CodeChunk] = []

        # 尝试符号级正则切片
        patterns = self._REGEX_PATTERNS.get(language, [])
        if patterns:
            symbol_starts: list[tuple[int, str, str]] = []  # (line_idx, symbol_name, symbol_type)
            for symbol_type, pattern, _ in patterns:
                for m in pattern.finditer(content):
                    sym_name = m.group(1)
                    line_idx = content.count("\n", 0, m.start())
                    symbol_starts.append((line_idx, sym_name, symbol_type))

            if symbol_starts:
                symbol_starts.sort(key=lambda x: x[0])
                for i, (start_idx, sym_name, sym_type) in enumerate(symbol_starts):
                    end_idx = (
                        symbol_starts[i + 1][0] - 1
                        if i + 1 < len(symbol_starts)
                        else len(lines) - 1
                    )
                    if end_idx < start_idx:
                        end_idx = start_idx
                    chunk_lines = lines[start_idx : end_idx + 1]
                    chunk_content = "\n".join(chunk_lines)
                    if len(chunk_content) > MAX_CHUNK_CHARS:
                        chunk_content = chunk_content[:MAX_CHUNK_CHARS]
                    if chunk_content.strip():
                        chunks.append(CodeChunk(
                            file_path="",
                            line_start=start_idx + 1,
                            line_end=end_idx + 1,
                            content=chunk_content,
                            language=language,
                            symbol_name=sym_name,
                            symbol_type=sym_type,
                        ))
                if chunks:
                    return chunks[:MAX_CHUNKS_PER_FILE]

        # 最终降级:固定行数切片(100 行/片,50 行重叠)
        total_lines = len(lines)
        if total_lines == 0:
            return []
        step = FIXED_CHUNK_LINES - FIXED_CHUNK_OVERLAP
        for start in range(0, total_lines, step):
            end = min(start + FIXED_CHUNK_LINES, total_lines)
            chunk_lines = lines[start:end]
            chunk_content = "\n".join(chunk_lines)
            if len(chunk_content) > MAX_CHUNK_CHARS:
                chunk_content = chunk_content[:MAX_CHUNK_CHARS]
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    file_path="",
                    line_start=start + 1,
                    line_end=end,
                    content=chunk_content,
                    language=language,
                    symbol_name=None,
                    symbol_type="fixed",
                ))
            if end >= total_lines:
                break
        return chunks[:MAX_CHUNKS_PER_FILE]

    def _collect_code_files(self, root: Path) -> list[tuple[Path, str]]:
        """扫描仓库,收集代码文件 → [(file_path, language), ...]。"""
        result: list[tuple[Path, str]] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRS]
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                lang = _EXT_TO_LANG.get(ext)
                if not lang:
                    continue
                result.append((Path(dirpath) / fname, lang))
                if len(result) >= MAX_FILES_PER_INDEX:
                    return result
        return result

    async def _generate_embeddings_batch(
        self, chunks: list[CodeChunk]
    ) -> int:
        """批量生成 embedding,返回成功向量化的数量。"""
        vectorized = 0
        for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
            batch = chunks[i : i + EMBEDDING_BATCH_SIZE]
            tasks = [
                llm_gateway.embed(c.content[:MAX_CHUNK_CHARS])
                for c in batch
            ]
            try:
                embeddings = await asyncio.gather(*tasks, return_exceptions=True)
                for j, emb in enumerate(embeddings):
                    if isinstance(emb, list) and len(emb) == 1536:
                        batch[j].embedding = emb
                        vectorized += 1
                    elif isinstance(emb, Exception):
                        logger.debug(
                            "embedding 生成失败(chunk %s): %s",
                            batch[j].file_path,
                            emb,
                        )
            except Exception as e:
                logger.warning("批量 embedding 失败: %s", e)
        return vectorized

    async def _write_to_api(
        self,
        repo_id: str,
        chunks: list[CodeChunk],
        api_token: Optional[str] = None,
        internal_user_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """通过 API 端点写入切片到数据库。"""
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/index"
        payload = {
            "repoId": repo_id,
            "chunks": [
                {
                    "filePath": c.file_path,
                    "lineStart": c.line_start,
                    "lineEnd": c.line_end,
                    "content": c.content,
                    "language": c.language,
                    "symbolName": c.symbol_name,
                    "symbolType": c.symbol_type,
                    "embedding": c.embedding,
                }
                for c in chunks
            ],
        }
        headers = self._internal_auth_headers(api_token)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"API 写入失败 HTTP {resp.status_code}: {resp.text[:200]}"
                )
            return cast(dict[str, Any], resp.json())

    async def _delete_files_from_api(
        self,
        repo_id: str,
        file_paths: list[str],
        api_token: Optional[str] = None,
        internal_user_id: Optional[str] = None,
    ) -> int:
        """批量删除已消失文件的旧切片(Merkle 增量同步,2026-09-07 立)。

        Returns:
            实际删除的切片数;端点不存在(旧版 api)时静默返回 0。
        """
        if not file_paths:
            return 0
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/repo/{repo_id}/files"
        headers = self._internal_auth_headers(api_token)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.request(
                    "DELETE", url, json={"filePaths": file_paths}, headers=headers
                )
                if resp.status_code >= 400:
                    logger.warning(
                        "删除幽灵文件切片失败 HTTP %d: %s", resp.status_code, resp.text[:200]
                    )
                    return 0
                data = resp.json()
                inner = data.get("data", data) if isinstance(data, dict) else {}
                return int(inner.get("deleted", 0))
        except Exception as e:
            logger.warning("删除幽灵文件切片异常: %s", e)
            return 0

    # ==========================================================================
    # Merkle 快照持久化(2026-09-07 立)
    # ==========================================================================

    def _snapshot_path(self, repo_id: str, root: Path) -> Path:
        """快照文件路径:repo_id + 仓库绝对路径共同决定(同 repo_id 不同路径互不污染)。"""
        path_key = hashlib.sha256(str(root).encode()).hexdigest()[:12]
        return _MERKLE_SNAPSHOT_DIR / f"{repo_id}-{path_key}.merkle.json"

    def _load_snapshot(self, repo_id: str, root: Path) -> dict[str, str]:
        """加载上轮文件 hash 快照;不存在/损坏时返回空 dict(触发全量索引)。"""
        path = self._snapshot_path(repo_id, root)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            files = raw.get("files", {})
            if isinstance(files, dict) and all(
                isinstance(k, str) and isinstance(v, str) for k, v in files.items()
            ):
                return cast(dict[str, str], files)
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.debug("加载 Merkle 快照失败(%s): %s", path, e)
        return {}

    def _save_snapshot(self, repo_id: str, root: Path, file_hashes: dict[str, str]) -> None:
        """持久化本轮快照(原子写:先写临时文件再 replace)。"""
        try:
            _MERKLE_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            path = self._snapshot_path(repo_id, root)
            tmp = path.with_suffix(".json.tmp")
            tmp.write_text(
                json.dumps(
                    {"merkleRoot": _merkle_root(file_hashes), "files": file_hashes},
                    ensure_ascii=False,
                    indent=0,
                ),
                encoding="utf-8",
            )
            tmp.replace(path)
        except Exception as e:
            # 快照写失败不影响本轮结果(下轮退化为全量索引)
            logger.debug("保存 Merkle 快照失败: %s", e)

    # ==========================================================================
    # 三层语义索引:模块层 + 架构层合成切片(2026-09-07 立,对标 CodeBuddy)
    # ==========================================================================

    def _build_module_summary_chunks(
        self, rel_path: str, language: str, symbol_chunks: list[CodeChunk]
    ) -> Optional[CodeChunk]:
        """模块层摘要切片:文件意图(头部 imports/常量)+ 符号清单。

        仅当文件符号切片数 ≥ MODULE_SUMMARY_MIN_CHUNKS 时生成
        (小文件其函数层切片已足够表达,摘要切片无检索收益)。
        """
        if len(symbol_chunks) < MODULE_SUMMARY_MIN_CHUNKS:
            return None
        symbols = [
            f"- {c.symbol_type}: {c.symbol_name} (L{c.line_start}-{c.line_end})"
            for c in symbol_chunks
            if c.symbol_name
        ]
        if not symbols:
            return None
        # 自包含语义摘要:符号清单 + 文件路径(利于 embedding 检索"模块是干什么的")
        content = (
            f"Module summary: {rel_path} ({language})\n"
            f"This module contains {len(symbols)} symbols:\n" + "\n".join(symbols)
        )
        if len(content) > MAX_CHUNK_CHARS:
            content = content[:MAX_CHUNK_CHARS]
        return CodeChunk(
            file_path=rel_path,
            line_start=1,
            line_end=max(c.line_end for c in symbol_chunks),
            content=content,
            language=language,
            symbol_name=Path(rel_path).name,
            symbol_type="module_summary",
        )

    def _build_architecture_summary_chunks(
        self, rel_paths: list[tuple[str, str, int]]
    ) -> list[CodeChunk]:
        """架构层摘要切片:每个含 ≥ARCH_SUMMARY_MIN_FILES 个源文件的目录一个合成切片。

        按文件实际父目录聚合(monorepo 下 apps/web 与 apps/api 是两个有意义
        的架构单元,按深度 1 聚合会把它们混成一团)。

        Args:
            rel_paths: [(rel_path, language, symbol_count), ...]
        Returns:
            架构摘要切片列表(symbol_type=architecture_summary)。
        """
        by_dir: dict[str, list[str]] = {}
        for rel_path, _lang, sym_count in rel_paths:
            directory = rel_path.rsplit("/", 1)[0] if "/" in rel_path else "(root)"
            by_dir.setdefault(directory, []).append(f"{rel_path} ({sym_count} symbols)")

        chunks: list[CodeChunk] = []
        for directory, files in sorted(by_dir.items()):
            if len(files) < ARCH_SUMMARY_MIN_FILES:
                continue
            content = (
                f"Architecture summary: directory '{directory}'\n"
                f"Contains {len(files)} indexed source files:\n"
                + "\n".join(files[:200])
            )
            if len(content) > MAX_CHUNK_CHARS:
                content = content[:MAX_CHUNK_CHARS]
            chunks.append(
                CodeChunk(
                    file_path=f"{directory}/",
                    line_start=1,
                    line_end=1,
                    content=content,
                    language=None,
                    symbol_name=directory,
                    symbol_type="architecture_summary",
                )
            )
        return chunks

    async def index_repository(
        self,
        repo_path: str,
        repo_id: Optional[str] = None,
        api_token: Optional[str] = None,
        incremental: bool = True,
        internal_user_id: Optional[str] = None,
    ) -> IndexResult:
        """索引整个仓库(Merkle 增量同步,2026-09-07 起)。

        流程:
        1. 扫描仓库 → 计算每个代码文件的内容 sha256(Merkle 叶子)
        2. 与上轮快照对比:未变文件零成本跳过(不切片/embedding/写入)
        3. 变更文件重新切片 + embedding + 写入(indexChunks 自带先删旧后插新)
        4. 已删除文件 → DELETE /repo/:repoId/files 清除幽灵切片
        5. 三层语义索引:函数层(符号切片)+ 模块层 + 架构层(合成摘要切片)
        6. 持久化本轮快照(原子写)

        Args:
            repo_path: 仓库根目录绝对路径。
            repo_id: 仓库标识(为空时用路径 hash)。
            api_token: API JWT token(写入时鉴权用)。
            incremental: 是否启用 Merkle 增量(False 时全量重索引)。

        Returns:
            IndexResult 统计信息。
        """
        root = Path(repo_path).resolve()
        if not root.exists() or not root.is_dir():
            return IndexResult(
                repo_id=repo_id or "",
                errors=[f"仓库路径不存在或不是目录: {repo_path}"],
            )

        if not repo_id:
            path_hash = hashlib.sha256(str(root).encode()).hexdigest()[:16]
            repo_id = f"local-{path_hash}"

        result = IndexResult(repo_id=repo_id)
        files = self._collect_code_files(root)
        result.files_scanned = len(files)

        # --- Merkle 增量:计算本轮文件 hash 并与快照对比 ---
        prev_snapshot = self._load_snapshot(repo_id, root) if incremental else {}
        new_hashes: dict[str, str] = {}
        changed: list[tuple[Path, str, str]] = []  # [(abs_path, rel_path, language)]
        for file_path, language in files:
            rel_path = str(file_path.relative_to(root)).replace("\\", "/")
            try:
                if file_path.suffix.lower() in _DOC_EXTS:
                    # 文档格式:扫描轮仅读原始字节算 hash,昂贵的 anydoc 抽取留给切片轮
                    content_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
                else:
                    content = file_path.read_text(encoding="utf-8", errors="replace")
                    if not content.strip():
                        continue
                    content_hash = _file_content_hash(content)
            except Exception as e:
                result.errors.append(f"{file_path}: {e}")
                continue
            new_hashes[rel_path] = content_hash
            if incremental and prev_snapshot.get(rel_path) == content_hash:
                result.files_unchanged += 1
                continue
            changed.append((file_path, rel_path, language))

        # 已删除文件:上轮快照有、本轮无 → 清除幽灵切片
        deleted_paths = [p for p in prev_snapshot if p not in new_hashes] if incremental else []
        if deleted_paths:
            result.files_deleted = await self._delete_files_from_api(
                repo_id, deleted_paths, api_token, internal_user_id
            )

        result.merkle_root = _merkle_root(new_hashes)

        # --- 变更文件切片(函数层)+ 三层合成切片(模块层/架构层) ---
        all_chunks: list[CodeChunk] = []
        layer_inputs: list[tuple[str, str, int]] = []  # (rel_path, language, symbol_count)
        for file_path, rel_path, language in changed:
            try:
                if file_path.suffix.lower() in _DOC_EXTS:
                    # 文档格式:经 anydoc 抽取 Markdown(线程池执行,避免阻塞事件循环);
                    # 失败则跳过该文件并记 error
                    content = await asyncio.to_thread(_extract_document_markdown, file_path)
                else:
                    content = file_path.read_text(encoding="utf-8", errors="replace")
                file_chunks = self._chunk_by_ast(content, language)
                for c in file_chunks:
                    c.file_path = rel_path
                all_chunks.extend(file_chunks)
                result.files_indexed += 1
                layer_inputs.append((rel_path, language, len(file_chunks)))
                module_chunk = self._build_module_summary_chunks(rel_path, language, file_chunks)
                if module_chunk:
                    all_chunks.append(module_chunk)
            except Exception as e:
                result.errors.append(f"{file_path}: {e}")

        # 架构层:对"全仓可见文件"生成(不只变更文件,保证架构切片始终最新)
        lang_by_rel = {
            str(f.relative_to(root)).replace("\\", "/"): l for f, l in files
        }
        symbol_count_by_rel = {r: s for r, _l, s in layer_inputs}
        all_visible: list[tuple[str, str, int]] = [
            (rel_path, lang_by_rel.get(rel_path, ""), symbol_count_by_rel.get(rel_path, 0))
            for rel_path in new_hashes
        ]
        arch_chunks = self._build_architecture_summary_chunks(all_visible)
        # 架构切片随变更批次写入(indexChunks 按 file_path 先删后插,幂等);
        # 零变更轮次跳过(内容必然与上轮一致,省 embedding 成本)
        if changed or deleted_paths or not incremental:
            all_chunks.extend(arch_chunks)

        result.chunks_created = len(all_chunks)
        if not all_chunks:
            self._save_snapshot(repo_id, root, new_hashes)
            return result

        # 批量生成 embedding
        result.chunks_vectorized = await self._generate_embeddings_batch(all_chunks)

        # 分批写入 API(每批 100 条)
        BATCH_WRITE = 100
        for i in range(0, len(all_chunks), BATCH_WRITE):
            batch = all_chunks[i : i + BATCH_WRITE]
            try:
                await self._write_to_api(repo_id, batch, api_token, internal_user_id)
            except Exception as e:
                result.errors.append(f"写入批次 {i}-{i + len(batch)} 失败: {e}")

        # 持久化快照(下轮增量对比基准)
        self._save_snapshot(repo_id, root, new_hashes)
        return result

    async def index_file(
        self,
        file_path: str,
        repo_id: str,
        language: Optional[str] = None,
        api_token: Optional[str] = None,
        internal_user_id: Optional[str] = None,
    ) -> IndexResult:
        """索引单个文件(增量更新)。

        Args:
            file_path: 文件绝对路径。
            repo_id: 仓库标识。
            language: 编程语言(为空时按扩展名推断)。
            api_token: API JWT token。
            internal_user_id: 内部用户 ID(写入向量化 chunk 时隔离归属)。
        """
        path = Path(file_path).resolve()
        if not path.exists() or not path.is_file():
            return IndexResult(
                repo_id=repo_id,
                errors=[f"文件不存在: {file_path}"],
            )

        if not language:
            ext = path.suffix.lower()
            language = _EXT_TO_LANG.get(ext, "unknown")

        result = IndexResult(repo_id=repo_id, files_scanned=1)
        try:
            if path.suffix.lower() in _DOC_EXTS:
                # 文档格式:经 anydoc 抽取 Markdown 后入索引
                content = await asyncio.to_thread(_extract_document_markdown, path)
            else:
                content = path.read_text(encoding="utf-8", errors="replace")
            if not content.strip():
                return result
            chunks = self._chunk_by_ast(content, language)
            for c in chunks:
                c.file_path = str(path.name)
            result.chunks_created = len(chunks)
            result.files_indexed = 1
            if chunks:
                result.chunks_vectorized = await self._generate_embeddings_batch(chunks)
                await self._write_to_api(repo_id, chunks, api_token, internal_user_id)
        except Exception as e:
            result.errors.append(f"{file_path}: {e}")
        return result

    async def search(
        self,
        query: str,
        repo_id: Optional[str] = None,
        language: Optional[str] = None,
        top_k: int = 10,
        api_token: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """语义搜索代码片段(委托给 API 端点)。

        Args:
            query: 自然语言查询(如"用户认证逻辑")。
            repo_id: 限定仓库(为空则全局搜索)。
            language: 限定语言(如 typescript/python)。
            top_k: 返回 top-K 结果。
            api_token: API JWT token。

        Returns:
            切片列表,每个含 file_path/line_start/line_end/content/symbol_name/symbol_type/score。
        """
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/search"
        payload: dict[str, Any] = {
            "query": query,
            "topK": top_k,
            # hybrid=向量+关键词 RRF 融合(服务端默认,显式声明契约,2026-09-07 立)
            "mode": "hybrid",
        }
        if repo_id:
            payload["repoId"] = repo_id
        if language:
            payload["language"] = language
        headers = self._internal_auth_headers(api_token)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code >= 400:
                    logger.warning(
                        "语义搜索 API 失败 HTTP %d: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    return []
                data = resp.json()
                # API 返回 { code, message, data: { chunks: [...] } }
                inner = data.get("data", data) if isinstance(data, dict) else {}
                return cast(list[dict[str, Any]], inner.get("chunks", []))
        except Exception as e:
            logger.warning("语义搜索失败: %s", e)
            return []


codebase_indexer = CodebaseIndexer()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
