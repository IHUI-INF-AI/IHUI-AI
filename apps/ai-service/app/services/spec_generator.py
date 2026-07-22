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

import datetime
import difflib
import hashlib
import json
import logging
import os
import re
import subprocess
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
    """ 参数列表(body / query / params 类型引用,降级为空) """
    params: list[str] = field(default_factory=list)
    """ 响应类型(schema 引用,降级为空) """
    response_type: Optional[str] = None


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
        """提取 API endpoint(Fastify / FastAPI / Express / Go net/http)。

        深化提取(2026-07-22):
        - Fastify:解析 schema.body / schema.query / schema.params / schema.response 引用
        - FastAPI:解析 Pydantic model 引用(Body / Query / Path 参数)
        - 降级:Zod / Pydantic 解析失败时仅保留路由表(params / response_type 为空)
        """
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

        for framework, pattern in patterns:
            for m in pattern.finditer(content):
                method = (m.group(1).upper() if m.lastindex and m.lastindex >= 1 else "GET")
                path = m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)
                line = content.count("\n", 0, m.start()) + 1

                params: list[str] = []
                response_type: Optional[str] = None
                try:
                    if framework in ("FASTIFY", "EXPRESS"):
                        params, response_type = self._extract_fastify_schema(content, m.end())
                    elif framework == "FASTAPI":
                        params, response_type = self._extract_fastapi_params(content, m.end())
                except Exception as e:
                    logger.debug("schema 提取降级 %s L%d: %s", rel_path, line, e)

                endpoints.append(ExtractedEndpoint(
                    method=method if method.isalpha() else "GET",
                    path=path,
                    file_path=rel_path,
                    line=line,
                    params=params,
                    response_type=response_type,
                ))
        return endpoints

    def _extract_fastify_schema(self, content: str, start: int) -> tuple[list[str], Optional[str]]:
        """从 Fastify 路由调用的 options 参数中提取 Zod schema 引用。

        匹配 `schema: { body: X, query: Y, params: Z, response: { 200: R } }` 结构。
        降级:schema 块不存在或解析失败时返回 ([], None)。
        """
        params: list[str] = []
        response_type: Optional[str] = None

        # 在 endpoint match 后 2000 字符窗口内查找 schema: { ... } 块
        window = content[start:start + 2000]
        schema_match = re.search(r"schema\s*:\s*\{", window)
        if not schema_match:
            return params, response_type

        # 提取 schema 块内容(平衡花括号匹配)
        block_start = schema_match.end()
        depth = 1
        block_end = block_start
        for i in range(block_start, min(len(window), block_start + 1500)):
            if window[i] == "{":
                depth += 1
            elif window[i] == "}":
                depth -= 1
                if depth == 0:
                    block_end = i
                    break
        schema_body = window[block_start:block_end]

        # 提取 body / query / params 引用
        for key in ("body", "querystring", "query", "params"):
            pm = re.search(rf"\b{key}\s*:\s*([A-Za-z_]\w*)", schema_body)
            if pm:
                label = "query" if key in ("querystring", "query") else key
                entry = f"{label}: {pm.group(1)}"
                if entry not in params:
                    params.append(entry)

        # 提取 response 引用(形如 response: { 200: SomeSchema })
        resp_match = re.search(r"response\s*:\s*\{[^}]*?\b\d{3}\b\s*:\s*([A-Za-z_]\w*)", schema_body)
        if resp_match:
            response_type = resp_match.group(1)

        return params, response_type

    def _extract_fastapi_params(self, content: str, start: int) -> tuple[list[str], Optional[str]]:
        """从 FastAPI 路由装饰器后的函数签名中提取 Pydantic model 引用。

        匹配 `async def handler(param: ModelType = Body(...), ...)` 结构。
        降级:函数签名不存在或解析失败时返回 ([], None)。
        """
        params: list[str] = []
        response_type: Optional[str] = None

        # 在装饰器后 800 字符窗口内查找 async def / def 函数定义
        window = content[start:start + 800]
        func_match = re.search(r"(?:async\s+)?def\s+\w+\s*\(([^)]*)\)", window)
        if not func_match:
            return params, response_type

        params_str = func_match.group(1)

        # 提取带类型标注的参数(排除基础类型:str / int / float / bool / Optional 等)
        basic_types = {"str", "int", "float", "bool", "bytes", "None", "Any", "Optional",
                       "List", "Dict", "Union", "True", "False"}
        for pm in re.finditer(r"(\w+)\s*:\s*([A-Za-z_]\w*(?:\[[^\]]*\])?)", params_str):
            param_name = pm.group(1)
            param_type = pm.group(2)
            base_type = re.split(r"[\[\[]", param_type)[0]
            if base_type not in basic_types:
                params.append(f"{param_name}: {param_type}")

        # 查找返回类型标注(-> ModelType)
        return_match = re.search(r"\)\s*->\s*([A-Za-z_]\w*(?:\[[^\]]*\])?)", window[func_match.end():])
        if return_match:
            rt = return_match.group(1)
            base_rt = re.split(r"[\[\[]", rt)[0]
            if base_rt not in basic_types:
                response_type = rt

        return params, response_type

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
    # 持久化 / 模板变量 / diff(2026-07-22 深化)
    # ------------------------------------------------------------------

    def _compute_scope_hash(self, scope: dict[str, Any]) -> str:
        """根据 scope 字典计算稳定哈希(MD5 前 12 位,用于文件名)。

        与 spec-service.ts computeScopeHash 对齐:sort_keys + compact 分隔符(无空格)。
        """
        scope_str = json.dumps(scope, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return hashlib.md5(scope_str.encode("utf-8")).hexdigest()[:12]

    def _persist_spec(self, workspace_path: str, scope: dict[str, Any], spec_md: str) -> bool:
        """将 spec 写入 .trae-cn/specs/<hash>.md + history/<timestamp>-<hash>.md。

        降级:文件写入失败时仅返回 False,不阻塞 spec 生成。
        """
        try:
            root = Path(workspace_path).resolve()
            scope_hash = self._compute_scope_hash(scope)
            specs_dir = root / ".trae-cn" / "specs"
            history_dir = specs_dir / "history"
            specs_dir.mkdir(parents=True, exist_ok=True)
            history_dir.mkdir(parents=True, exist_ok=True)

            # 写入最新版本(覆盖)
            latest_path = specs_dir / f"{scope_hash}.md"
            latest_path.write_text(spec_md, encoding="utf-8")

            # 写入历史版本(带时间戳,不覆盖)
            timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            history_path = history_dir / f"{timestamp}-{scope_hash}.md"
            history_path.write_text(spec_md, encoding="utf-8")
            return True
        except Exception as e:
            logger.warning("spec 持久化失败(降级仅返回 markdown): %s", e)
            return False

    def _get_template_variables(self, workspace_path: str) -> dict[str, str]:
        """收集模板变量(author / date / version / project),每项独立降级。"""
        root = Path(workspace_path).resolve()

        # author:git config user.name,降级 "Unknown"
        author = "Unknown"
        try:
            result = subprocess.run(
                ["git", "config", "user.name"],
                cwd=str(root) if root.exists() else None,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                author = result.stdout.strip()
        except Exception:
            pass

        # date:当前日期 YYYY-MM-DD
        date_str = datetime.date.today().strftime("%Y-%m-%d")

        # version + project:从 package.json 读取,降级 "1.0.0" / "project"
        version = "1.0.0"
        project = root.name if root.exists() else "project"
        try:
            pkg_path = root / "package.json"
            if pkg_path.is_file():
                pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
                if isinstance(pkg.get("version"), str):
                    version = pkg["version"]
                if isinstance(pkg.get("name"), str):
                    project = pkg["name"]
        except Exception:
            pass

        return {
            "author": author,
            "date": date_str,
            "version": version,
            "project": project,
        }

    def _apply_template_variables(self, spec_md: str, variables: dict[str, str]) -> str:
        """替换 spec 中的模板变量 {{author}} / {{date}} / {{version}} / {{project}}。"""
        result = spec_md
        for key, val in variables.items():
            result = result.replace("{{" + key + "}}", val)
        return result

    def _build_frontmatter(self, variables: dict[str, str], scope: dict[str, Any]) -> str:
        """生成 YAML frontmatter(author / date / version / project / scope)。"""
        scope_desc = self._describe_scope(scope, Path("."))
        lines = [
            "---",
            f"author: {variables.get('author', 'Unknown')}",
            f"date: {variables.get('date', '')}",
            f"version: {variables.get('version', '1.0.0')}",
            f"project: {variables.get('project', 'project')}",
            f"scope: {scope_desc}",
            "---",
            "",
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 公开 API:历史 / 加载 / diff / 变量(供 ai-service router 调用)
    # ------------------------------------------------------------------

    def get_history(self, workspace_path: str, scope: dict[str, Any]) -> list[dict[str, Any]]:
        """返回指定 scope 的历史版本列表。

        Returns:
            [{ timestamp, filePath, summary }],按时间倒序。
        """
        root = Path(workspace_path).resolve()
        scope_hash = self._compute_scope_hash(scope)
        history_dir = root / ".trae-cn" / "specs" / "history"
        if not history_dir.is_dir():
            return []

        entries: list[dict[str, Any]] = []
        for f in sorted(history_dir.iterdir(), reverse=True):
            name = f.name
            # 文件名格式:<timestamp>-<scopehash>.md
            if not name.endswith(f"-{scope_hash}.md"):
                continue
            timestamp_part = name[: -(len(scope_hash) + 4)]  # 去掉 -<hash>.md
            try:
                content = f.read_text(encoding="utf-8", errors="replace")
                summary = self._summarize_spec(content)
            except Exception:
                content = ""
                summary = ""
            entries.append({
                "timestamp": timestamp_part,
                "filePath": str(f.relative_to(root)).replace("\\", "/"),
                "summary": summary,
            })
        return entries

    def _summarize_spec(self, content: str) -> str:
        """提取 spec 内容摘要(首个非空标题行,截断 80 字符)。"""
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped[:80]
            if stripped and not stripped.startswith("---") and not stripped.startswith(">"):
                return stripped[:80]
        return ""

    def load_spec(
        self, workspace_path: str, scope: dict[str, Any], version: str = "latest"
    ) -> dict[str, Any]:
        """加载已持久化的 spec。

        Args:
            version: "latest" 取最新版本,否则按时间戳匹配历史文件。
        Returns:
            { spec, filePath },文件不存在时 spec 为空字符串。
        """
        root = Path(workspace_path).resolve()
        scope_hash = self._compute_scope_hash(scope)

        if version == "latest":
            target = root / ".trae-cn" / "specs" / f"{scope_hash}.md"
        else:
            history_dir = root / ".trae-cn" / "specs" / "history"
            target = history_dir / f"{version}-{scope_hash}.md"

        if not target.is_file():
            return {"spec": "", "filePath": ""}

        try:
            content = target.read_text(encoding="utf-8")
            return {
                "spec": content,
                "filePath": str(target.relative_to(root)).replace("\\", "/"),
            }
        except Exception as e:
            logger.warning("spec 加载失败: %s", e)
            return {"spec": "", "filePath": ""}

    async def generate_diff(
        self, workspace_path: str, scope: dict[str, Any]
    ) -> dict[str, Any]:
        """生成新 spec 与上次持久化版本的 unified diff。

        使用 Python difflib.unified_diff 生成标准 unified diff 格式。
        Returns:
            { oldSpec, newSpec, diff, addedLines, removedLines, changedFiles }
        """
        # 1. 读取旧 spec(在 generate 覆盖之前)
        old_data = self.load_spec(workspace_path, scope, "latest")
        old_spec = old_data["spec"]

        # 2. 生成新 spec(generate 内部会持久化,覆盖旧文件)
        new_result = await self.generate(workspace_path, scope)
        new_spec = new_result.spec

        # 3. difflib unified_diff
        old_lines = old_spec.splitlines(keepends=True)
        new_lines = new_spec.splitlines(keepends=True)
        diff_lines = list(difflib.unified_diff(
            old_lines, new_lines,
            fromfile="old-spec.md", tofile="new-spec.md",
        ))
        diff_text = "".join(diff_lines)

        added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
        changed_files = [f"{self._compute_scope_hash(scope)}.md"] if old_spec != new_spec else []

        return {
            "oldSpec": old_spec,
            "newSpec": new_spec,
            "diff": diff_text,
            "addedLines": added,
            "removedLines": removed,
            "changedFiles": changed_files,
        }

    def get_variables(self, workspace_path: str) -> dict[str, str]:
        """返回当前可用的模板变量列表 + 值。"""
        return self._get_template_variables(workspace_path)

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
            api_lines.append("| 方法 | 路径 | 参数 | 响应类型 | 文件 | 行号 |")
            api_lines.append("| --- | --- | --- | --- | --- | --- |")
            for ep in endpoints:
                params_str = ", ".join(ep.params) if ep.params else "-"
                resp_str = ep.response_type or "-"
                api_lines.append(
                    f"| `{ep.method}` | `{ep.path}` | {params_str} | {resp_str} | `{ep.file_path}` | L{ep.line} |"
                )
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

        # 模板变量替换 + frontmatter(2026-07-22 深化)
        variables = self._get_template_variables(workspace_path)
        spec_md = self._apply_template_variables(spec_md, variables)
        frontmatter = self._build_frontmatter(variables, scope)
        spec_md = frontmatter + spec_md

        # 持久化(降级:写入失败不阻塞返回 markdown)
        self._persist_spec(workspace_path, scope, spec_md)

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
