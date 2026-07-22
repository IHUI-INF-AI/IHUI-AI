"""代码库语义索引器。

用 tree-sitter AST 解析代码 → 按符号(函数/类/方法/接口)切片 → 生成 embedding → 写入 codebase_chunks 表。
AST 解析失败时降级为固定行数切片(100 行/片,50 行重叠)。

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
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

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

    def _get_parser(self, language: str):
        """获取 tree-sitter parser(语言不可用时返回 None)。"""
        if not self._tree_sitter_available:
            return None
        try:
            from tree_sitter import Language, Parser
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

    def _extract_symbol_name(self, node, name_field: str) -> Optional[str]:
        """从 AST 节点提取符号名。"""
        child = node.child_by_field_name(name_field)
        if child and child.text:
            return child.text.decode("utf-8", errors="replace")
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

        def walk(node):
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
        headers = {}
        if api_token:
            headers["Authorization"] = f"Bearer {api_token}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"API 写入失败 HTTP {resp.status_code}: {resp.text[:200]}"
                )
            return resp.json()

    async def index_repository(
        self,
        repo_path: str,
        repo_id: Optional[str] = None,
        api_token: Optional[str] = None,
    ) -> IndexResult:
        """索引整个仓库。

        Args:
            repo_path: 仓库根目录绝对路径。
            repo_id: 仓库标识(为空时用路径 hash)。
            api_token: API JWT token(写入时鉴权用)。

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

        all_chunks: list[CodeChunk] = []
        for file_path, language in files:
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                if not content.strip():
                    continue
                rel_path = str(file_path.relative_to(root)).replace("\\", "/")
                file_chunks = self._chunk_by_ast(content, language)
                for c in file_chunks:
                    c.file_path = rel_path
                all_chunks.extend(file_chunks)
                result.files_indexed += 1
            except Exception as e:
                result.errors.append(f"{file_path}: {e}")

        result.chunks_created = len(all_chunks)
        if not all_chunks:
            return result

        # 批量生成 embedding
        result.chunks_vectorized = await self._generate_embeddings_batch(all_chunks)

        # 分批写入 API(每批 100 条)
        BATCH_WRITE = 100
        for i in range(0, len(all_chunks), BATCH_WRITE):
            batch = all_chunks[i : i + BATCH_WRITE]
            try:
                await self._write_to_api(repo_id, batch, api_token)
            except Exception as e:
                result.errors.append(f"写入批次 {i}-{i + len(batch)} 失败: {e}")

        return result

    async def index_file(
        self,
        file_path: str,
        repo_id: str,
        language: Optional[str] = None,
        api_token: Optional[str] = None,
    ) -> IndexResult:
        """索引单个文件(增量更新)。

        Args:
            file_path: 文件绝对路径。
            repo_id: 仓库标识。
            language: 编程语言(为空时按扩展名推断)。
            api_token: API JWT token。
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
                await self._write_to_api(repo_id, chunks, api_token)
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
        payload: dict[str, Any] = {"query": query, "topK": top_k}
        if repo_id:
            payload["repoId"] = repo_id
        if language:
            payload["language"] = language
        headers = {}
        if api_token:
            headers["Authorization"] = f"Bearer {api_token}"

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
                return inner.get("chunks", [])
        except Exception as e:
            logger.warning("语义搜索失败: %s", e)
            return []


codebase_indexer = CodebaseIndexer()
