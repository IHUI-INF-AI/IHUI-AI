"""Spec 文档生成器(2026-07-22 新增,对标 Trae IDE Spec 模式)。

从代码 AST 反向生成规格文档(markdown),支持 TypeScript/Python/Go。

流程:
1. 复用 codebase_indexer 的 tree-sitter 加载 + 符号节点映射(AST 切片逻辑)
2. 遍历 AST 提取:类 / 函数 / 接口 / 类型 / 路由(API endpoint)/ schema(数据库表)
3. 解析 import 语句构建模块依赖关系
4. 生成 markdown 文档:概述 + 模块结构 + API 契约 + 数据模型 + 依赖关系

使用方式:
    from app.services.spec_generator import spec_generator
    result = await spec_generator.generate(workspace_path, scope)
"""

import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .codebase_indexer import (
    CodebaseIndexer,
    _EXT_TO_LANG,
    _IGNORED_DIRS,
)

logger = logging.getLogger(__name__)

# 单次 spec 生成最大文件数(防超大工作区拖慢)
MAX_SPEC_FILES = 800
# 单文件最大读取字符数(防超大文件)
MAX_FILE_CHARS = 200_000


@dataclass
class ExtractedSymbol:
    """提取的符号。"""

    name: str
    type: str  # function / class / interface / type / enum / method
    file_path: str
    line_start: int
    line_end: int
    language: str
    """ 符号前的修饰符注释(docstring / JSDoc,取首个非空行) """
    doc: Optional[str] = None


@dataclass
class ExtractedEndpoint:
    """提取的 API endpoint。"""

    method: str  # GET / POST / PUT / DELETE / PATCH
    path: str
    file_path: str
    line: int
    handler: Optional[str] = None


@dataclass
class ExtractedSchema:
    """提取的数据模型(数据库表)。"""

    name: str
    file_path: str
    line: int
    """ 字段名列表(尽量提取,提取不到为空) """
    fields: list[str] = field(default_factory=list)


@dataclass
class SpecResult:
    """Spec 生成结果。"""

    spec: str
    sections: list[dict[str, Any]]
    stats: dict[str, int]
    duration_ms: int


class SpecGenerator:
    """Spec 文档生成器。

    复用 CodebaseIndexer 的 tree-sitter parser 加载 + 符号节点类型映射,
    在其基础上增加 endpoint / schema / 依赖关系的语义提取。
    """

    def __init__(self) -> None:
        # 复用 codebase_indexer 单例(共享 tree-sitter 可用性检测 + parser 缓存)
        self._indexer = CodebaseIndexer()

    # ------------------------------------------------------------------
    # 文件收集
    # ------------------------------------------------------------------

    def _collect_files(self, root: Path, scope: dict[str, Any]) -> list[tuple[Path, str]]:
        """按 scope 收集代码文件。

        scope.type:
          - file:   单文件(scope.path 必填)
          - dir:    目录递归(scope.path 必填)
          - workspace: 全工作区递归(scope.path 可省略)
        """
        scope_type = scope.get("type", "workspace")
        scope_path = scope.get("path")

        if scope_type == "file":
            if not scope_path:
                return []
            target = (root / scope_path).resolve() if not Path(scope_path).is_absolute() else Path(scope_path)
            if not target.is_file():
                return []
            ext = target.suffix.lower()
            lang = _EXT_TO_LANG.get(ext)
            return [(target, lang)] if lang else []

        if scope_type == "dir":
            if not scope_path:
                return []
            base = (root / scope_path).resolve() if not Path(scope_path).is_absolute() else Path(scope_path)
            if not base.is_dir():
                return []
            return self._walk_dir(base)

        # workspace
        base = root if not scope_path else (
            (root / scope_path).resolve() if not Path(scope_path).is_absolute() else Path(scope_path)
        )
        if not base.is_dir():
            return []
        return self._walk_dir(base)

    def _walk_dir(self, base: Path) -> list[tuple[Path, str]]:
        """递归收集代码文件(复用 codebase_indexer 的忽略目录策略)。"""
        result: list[tuple[Path, str]] = []
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRS]
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                lang = _EXT_TO_LANG.get(ext)
                if not lang:
                    continue
                result.append((Path(dirpath) / fname, lang))
                if len(result) >= MAX_SPEC_FILES:
                    return result
        return result

    # ------------------------------------------------------------------
    # AST 符号提取(复用 codebase_indexer 的 _SYMBOL_NODE_TYPES)
    # ------------------------------------------------------------------

    def _extract_symbols(self, content: str, language: str, rel_path: str) -> list[ExtractedSymbol]:
        """用 tree-sitter AST 提取符号(降级为正则)。"""
        parser = self._indexer._get_parser(language)
        symbols: list[ExtractedSymbol] = []

        if parser:
            try:
                tree = parser.parse(content.encode("utf-8"))
                symbols = self._walk_ast(tree.root_node, content, language, rel_path)
            except Exception as e:
                logger.debug("spec AST 解析失败(lang=%s): %s, 降级正则", language, e)

        if not symbols:
            symbols = self._extract_symbols_regex(content, language, rel_path)
        return symbols

    def _walk_ast(self, node, content: str, language: str, rel_path: str) -> list[ExtractedSymbol]:
        """遍历 AST 提取符号(复用 codebase_indexer._SYMBOL_NODE_TYPES 映射)。"""
        symbols: list[ExtractedSymbol] = []
        symbol_node_types = self._indexer._SYMBOL_NODE_TYPES

        def walk(n):
            node_type = n.type
            if node_type in symbol_node_types:
                symbol_type, name_field = symbol_node_types[node_type]
                name = self._indexer._extract_symbol_name(n, name_field)
                if name:
                    start_line = n.start_point[0] + 1
                    end_line = n.end_point[0] + 1
                    doc = self._extract_doc(n, content)
                    symbols.append(ExtractedSymbol(
                        name=name,
                        type=symbol_type,
                        file_path=rel_path,
                        line_start=start_line,
                        line_end=end_line,
                        language=language,
                        doc=doc,
                    ))
                return
            for child in n.children:
                walk(child)

        walk(node)
        return symbols

    def _extract_doc(self, node, content: str) -> Optional[str]:
        """提取符号前的文档注释(JSDoc / docstring 首行)。"""
        try:
            prev = node.prev_sibling
            if prev and prev.type in ("comment", "string"):
                text = prev.text.decode("utf-8", errors="replace") if prev.text else ""
                # 取首个非空、非装饰符行
                for line in text.splitlines():
                    stripped = line.strip().lstrip("/*#*").strip()
                    if stripped and not stripped.startswith("@"):
                        return stripped[:120]
        except Exception:
            pass
        return None

    def _extract_symbols_regex(
        self, content: str, language: str, rel_path: str
    ) -> list[ExtractedSymbol]:
        """正则降级提取符号(复用 codebase_indexer._REGEX_PATTERNS)。"""
        symbols: list[ExtractedSymbol] = []
        patterns = self._indexer._REGEX_PATTERNS.get(language, [])
        for symbol_type, pattern, _ in patterns:
            for m in pattern.finditer(content):
                sym_name = m.group(1)
                line_idx = content.count("\n", 0, m.start()) + 1
                symbols.append(ExtractedSymbol(
                    name=sym_name,
                    type=symbol_type,
                    file_path=rel_path,
                    line_start=line_idx,
                    line_end=line_idx,
                    language=language,
                ))
        return symbols

    # ------------------------------------------------------------------
    # Endpoint / Schema / 依赖 提取(语义正则)
    # ------------------------------------------------------------------

    def _extract_endpoints(self, content: str, rel_path: str, language: str) -> list[ExtractedEndpoint]:
        """提取 API endpoint(Fastify / FastAPI / Express / Go net/http)。"""
        endpoints: list[ExtractedEndpoint] = []
        patterns: list[tuple[str, "re.Pattern[str]"]] = []

        if language in ("typescript", "tsx", "javascript", "jsx"):
            # Fastify: server.post('/path', ...) / server.get(...)
            patterns.append(("FASTIFY", re.compile(
                r"\b(?:server|app|fastify)\.(get|post|put|delete|patch|head|options)\s*\(\s*['\"`]([^'\"`]+)['\"`]",
                re.IGNORECASE,
            )))
            # Express: app.get / router.get
            patterns.append(("EXPRESS", re.compile(
                r"\b(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['\"`]([^'\"`]+)['\"`]",
                re.IGNORECASE,
            )))
        elif language == "python":
            # FastAPI: @router.get("/path") / @app.post("/path")
            patterns.append(("FASTAPI", re.compile(
                r"@(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]",
                re.IGNORECASE,
            )))
        elif language == "go":
            # net/http: http.HandleFunc("/path", ...) / mux.HandleFunc
            patterns.append(("GO", re.compile(
                r"\b(?:http|mux|r)\.(?:HandleFunc|Get|Post|Put|Delete|Patch)\s*\(\s*['\"`]([^'\"`]+)['\"`]",
            )))

        for _, pattern in patterns:
            for m in pattern.finditer(content):
                method = (m.group(1).upper() if m.lastindex and m.lastindex >= 1 else "GET")
                path = m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)
                line = content.count("\n", 0, m.start()) + 1
                endpoints.append(ExtractedEndpoint(
                    method=method if method.isalpha() else "GET",
                    path=path,
                    file_path=rel_path,
                    line=line,
                ))
        return endpoints

    def _extract_schemas(self, content: str, rel_path: str, language: str) -> list[ExtractedSchema]:
        """提取数据模型(Drizzle pgTable / SQLAlchemy / Prisma)。"""
        schemas: list[ExtractedSchema] = []

        if language in ("typescript", "tsx", "javascript", "jsx"):
            # Drizzle: export const users = pgTable('users', { ... })
            for m in re.finditer(
                r"(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['\"`]([^'\"`]+)['\"`]",
                content,
            ):
                line = content.count("\n", 0, m.start()) + 1
                fields = self._extract_drizzle_fields(content, m.end())
                schemas.append(ExtractedSchema(
                    name=m.group(2),
                    file_path=rel_path,
                    line=line,
                    fields=fields,
                ))
        elif language == "python":
            # SQLAlchemy: __tablename__ = 'users'
            for m in re.finditer(r"__tablename__\s*=\s*['\"]([^'\"]+)['\"]", content):
                line = content.count("\n", 0, m.start()) + 1
                schemas.append(ExtractedSchema(
                    name=m.group(1),
                    file_path=rel_path,
                    line=line,
                ))
        elif language == "go":
            # GORM: type User struct { ... }
            for m in re.finditer(r"type\s+(\w+)\s+struct\s*\{", content):
                line = content.count("\n", 0, m.start()) + 1
                schemas.append(ExtractedSchema(
                    name=m.group(1),
                    file_path=rel_path,
                    line=line,
                ))
        return schemas

    def _extract_drizzle_fields(self, content: str, start: int) -> list[str]:
        """从 Drizzle pgTable 第二参数对象提取字段名(粗匹配)。"""
        fields: list[str] = []
        # 找到第二个参数对象的起始 {
        depth = 0
        obj_start = -1
        for i in range(start, min(len(content), start + 4000)):
            ch = content[i]
            if ch == "{":
                if depth == 0:
                    obj_start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and obj_start >= 0:
                    obj_body = content[obj_start:i]
                    # 字段名:形如 `name: xxx(` 或 `name:`
                    for fm in re.finditer(r"(\w+)\s*:", obj_body):
                        fields.append(fm.group(1))
                    break
        return fields[:30]  # 限制字段数

    def _extract_imports(self, content: str, rel_path: str, language: str) -> list[str]:
        """提取 import 语句(用于依赖关系图)。"""
        imports: list[str] = []
        if language in ("typescript", "tsx", "javascript", "jsx"):
            for m in re.finditer(
                r"""import\s+.*?from\s+['"]([^'"]+)['"]""",
                content,
            ):
                imports.append(m.group(1))
        elif language == "python":
            for m in re.finditer(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", content, re.MULTILINE):
                imports.append(m.group(1) or m.group(2) or "")
        elif language == "go":
            for m in re.finditer(r'^\s*import\s+"([^"]+)"', content, re.MULTILINE):
                imports.append(m.group(1))
        return [i for i in imports if i]

    # ------------------------------------------------------------------
    # Markdown 生成
    # ------------------------------------------------------------------

    def _build_sections(
        self,
        workspace_name: str,
        scope_desc: str,
        symbols: list[ExtractedSymbol],
        endpoints: list[ExtractedEndpoint],
        schemas: list[ExtractedSchema],
        file_count: int,
        imports_map: dict[str, list[str]],
    ) -> list[dict[str, Any]]:
        """构建结构化章节。"""
        sections: list[dict[str, Any]] = []

        # 1. 概述
        overview_lines = [
            f"# {workspace_name} 规格文档",
            "",
            f"> 由 IHUI-AI Spec 模式自动生成 · 范围: {scope_desc}",
            "",
            f"- 扫描文件数: **{file_count}**",
            f"- 提取符号数: **{len(symbols)}**",
            f"- API endpoint 数: **{len(endpoints)}**",
            f"- 数据模型数: **{len(schemas)}**",
        ]
        sections.append({
            "title": "概述",
            "content": "\n".join(overview_lines),
            "level": 1,
        })

        # 2. 模块结构(按文件分组符号)
        module_lines = ["## 模块结构", ""]
        by_file: dict[str, list[ExtractedSymbol]] = {}
        for sym in symbols:
            by_file.setdefault(sym.file_path, []).append(sym)
        for fpath in sorted(by_file.keys()):
            syms = by_file[fpath]
            module_lines.append(f"### `{fpath}`")
            module_lines.append("")
            for sym in syms[:50]:  # 单文件最多列 50 个符号
                doc_suffix = f" — {sym.doc}" if sym.doc else ""
                module_lines.append(
                    f"- `{sym.type}` **{sym.name}** (L{sym.line_start}-{sym.line_end}){doc_suffix}"
                )
            if len(syms) > 50:
                module_lines.append(f"- ... 还有 {len(syms) - 50} 个符号")
            module_lines.append("")
        if not by_file:
            module_lines.append("_未提取到符号_")
            module_lines.append("")
        sections.append({"title": "模块结构", "content": "\n".join(module_lines), "level": 2})

        # 3. API 契约
        api_lines = ["## API 契约", ""]
        if endpoints:
            api_lines.append("| 方法 | 路径 | 文件 | 行号 |")
            api_lines.append("| --- | --- | --- | --- |")
            for ep in endpoints:
                api_lines.append(f"| `{ep.method}` | `{ep.path}` | `{ep.file_path}` | L{ep.line} |")
        else:
            api_lines.append("_未识别到 API endpoint_")
        api_lines.append("")
        sections.append({"title": "API 契约", "content": "\n".join(api_lines), "level": 2})

        # 4. 数据模型
        schema_lines = ["## 数据模型", ""]
        if schemas:
            for sch in schemas:
                fields_str = ", ".join(sch.fields[:10]) if sch.fields else "(字段未提取)"
                extra = f" ... +{len(sch.fields) - 10}" if len(sch.fields) > 10 else ""
                schema_lines.append(f"- **{sch.name}** (`{sch.file_path}` L{sch.line}): {fields_str}{extra}")
        else:
            schema_lines.append("_未识别到数据模型_")
        schema_lines.append("")
        sections.append({"title": "数据模型", "content": "\n".join(schema_lines), "level": 2})

        # 5. 依赖关系
        dep_lines = ["## 依赖关系", ""]
        if imports_map:
            for fpath in sorted(imports_map.keys())[:30]:
                imps = imports_map[fpath]
                if not imps:
                    continue
                dep_lines.append(f"### `{fpath}`")
                dep_lines.append("")
                for imp in imps[:15]:
                    dep_lines.append(f"- `{imp}`")
                if len(imps) > 15:
                    dep_lines.append(f"- ... 还有 {len(imps) - 15} 个依赖")
                dep_lines.append("")
        else:
            dep_lines.append("_未提取到依赖关系_")
            dep_lines.append("")
        sections.append({"title": "依赖关系", "content": "\n".join(dep_lines), "level": 2})

        return sections

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------

    async def generate(
        self,
        workspace_path: str,
        scope: dict[str, Any],
        include_dependencies: bool = True,
        languages: Optional[list[str]] = None,
    ) -> SpecResult:
        """生成 Spec 文档。

        Args:
            workspace_path: 工作区根目录绝对路径。
            scope: {"type": "file"|"dir"|"workspace", "path": "..."}
            include_dependencies: 是否包含依赖关系分析。
            languages: 目标语言过滤(为空则全语言)。

        Returns:
            SpecResult(spec markdown + sections + stats + duration_ms)。
        """
        start_ts = time.time()
        root = Path(workspace_path).resolve()
        workspace_name = root.name if root.exists() else "workspace"

        if not root.exists() or not root.is_dir():
            return SpecResult(
                spec=f"# 错误\n\n工作区路径不存在: {workspace_path}",
                sections=[{"title": "错误", "content": f"工作区路径不存在: {workspace_path}", "level": 1}],
                stats={"files": 0, "symbols": 0, "endpoints": 0, "schemas": 0},
                duration_ms=int((time.time() - start_ts) * 1000),
            )

        files = self._collect_files(root, scope)
        if languages:
            lang_set = set(languages)
            files = [(f, l) for f, l in files if l in lang_set]

        scope_desc = self._describe_scope(scope, root)

        all_symbols: list[ExtractedSymbol] = []
        all_endpoints: list[ExtractedEndpoint] = []
        all_schemas: list[ExtractedSchema] = []
        imports_map: dict[str, list[str]] = {}

        for file_path, language in files:
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                if len(content) > MAX_FILE_CHARS:
                    content = content[:MAX_FILE_CHARS]
                if not content.strip():
                    continue
                try:
                    rel_path = str(file_path.relative_to(root)).replace("\\", "/")
                except ValueError:
                    rel_path = file_path.name

                syms = self._extract_symbols(content, language, rel_path)
                all_symbols.extend(syms)

                all_endpoints.extend(self._extract_endpoints(content, rel_path, language))
                all_schemas.extend(self._extract_schemas(content, rel_path, language))

                if include_dependencies:
                    imps = self._extract_imports(content, rel_path, language)
                    if imps:
                        imports_map[rel_path] = imps
            except Exception as e:
                logger.debug("spec 提取失败 %s: %s", file_path, e)

        sections = self._build_sections(
            workspace_name,
            scope_desc,
            all_symbols,
            all_endpoints,
            all_schemas,
            len(files),
            imports_map,
        )

        spec_md = "\n".join(s["content"] for s in sections)
        duration_ms = int((time.time() - start_ts) * 1000)

        return SpecResult(
            spec=spec_md,
            sections=sections,
            stats={
                "files": len(files),
                "symbols": len(all_symbols),
                "endpoints": len(all_endpoints),
                "schemas": len(all_schemas),
            },
            duration_ms=duration_ms,
        )

    def _describe_scope(self, scope: dict[str, Any], root: Path) -> str:
        """生成 scope 的人类可读描述。"""
        scope_type = scope.get("type", "workspace")
        scope_path = scope.get("path")
        if scope_type == "file":
            return f"单文件 {scope_path or '(未指定)'}"
        if scope_type == "dir":
            return f"目录 {scope_path or '(未指定)'}"
        return f"全工作区 {root.name}" + (f"({scope_path})" if scope_path else "")


spec_generator = SpecGenerator()
