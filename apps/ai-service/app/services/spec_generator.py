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

2026-07-22 深化(对标 Copilot Workspace / Aider):
- Spec 驱动代码生成(apply / preview / confirm)
- Watch 自动同步(watchdog 监听 + webhook 通知)
- 评审工作流(draft → pending_review → approved / rejected)
- Spec → Task 拆分(LLM 智能拆分 + 章节降级)
- LLM 智能增强(功能意图 / 风险点 / 改进建议)
"""

import asyncio
import datetime
import difflib
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import threading
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

# LLM 模型 fallback 链(2026-07-22 深化,gpt-4o → gpt-4o-mini → 默认)
_LLM_MODEL_CHAIN: list[Optional[str]] = ["gpt-4o", "gpt-4o-mini", None]

# 活跃 watcher 状态(watch_id → { observer, scope, workspace_path, webhook_url, started_at })
# 模块级单例,跨请求共享(2026-07-22 watch 自动同步)
_active_watchers: dict[str, dict[str, Any]] = {}
_watchers_lock = threading.Lock()


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

        # 发射 spec.generated 事件
        try:
            from .orchestration_hub import orchestration_hub
            await orchestration_hub.emit(
                event_type="spec.generated",
                source_pillar="spec",
                payload={
                    "workspace": workspace_path,
                    "scope_type": scope.get("type", ""),
                    "file_count": len(files),
                    "spec_hash": self._compute_scope_hash(scope),
                },
                severity="info",
            )
        except Exception:
            pass

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

    # ------------------------------------------------------------------
    # 2026-07-22 深化:LLM 调用 + Spec 驱动代码生成 + Watch + 评审 + 拆分 + 增强
    # ------------------------------------------------------------------

    async def _call_llm(self, prompt: str, system: Optional[str] = None) -> tuple[str, bool]:
        """调用 LLM(gpt-4o → gpt-4o-mini → 默认模型 fallback 链)。

        Returns:
            (content, ok):ok=False 时 content 为错误信息。
        """
        try:
            from ..core.llm_gateway import llm_gateway
        except Exception as e:
            return f"llm_gateway 导入失败: {e}", False

        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        last_err = ""
        for model in _LLM_MODEL_CHAIN:
            try:
                result = await llm_gateway.complete(messages, model=model)
                if result.get("error"):
                    last_err = str(result.get("error_message", "LLM 调用失败"))
                    logger.debug("LLM 调用失败(model=%s): %s, 尝试下一个", model, last_err)
                    continue
                content = str(result.get("content", "") or "")
                if content:
                    return content, True
                last_err = "LLM 返回空内容"
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
                logger.debug("LLM 调用异常(model=%s): %s", model, last_err)
        return last_err, False

    def _parse_frontmatter(self, spec_md: str) -> tuple[dict[str, str], str, str]:
        """解析 spec markdown 的 YAML frontmatter。

        Returns:
            (fields, frontmatter_raw, body):frontmatter 不存在时 fields 为空 dict。
        """
        if not spec_md.startswith("---"):
            return {}, "", spec_md
        parts = spec_md.split("---", 2)
        if len(parts) < 3:
            return {}, "", spec_md
        fm_raw = parts[1]
        body = parts[2]
        fields: dict[str, str] = {}
        for line in fm_raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, _, val = line.partition(":")
                fields[key.strip()] = val.strip()
        return fields, f"---{fm_raw}---", body

    def _build_frontmatter_from_fields(
        self, fields: dict[str, str], scope: dict[str, Any]
    ) -> str:
        """从字段字典重建 frontmatter(保留字段顺序 + 补充默认值)。"""
        scope_desc = self._describe_scope(scope, Path("."))
        defaults = {
            "author": "Unknown",
            "date": datetime.date.today().strftime("%Y-%m-%d"),
            "version": "1.0.0",
            "project": "project",
            "scope": scope_desc,
            "status": "draft",
        }
        merged = {**defaults, **fields}
        lines = ["---"]
        for key in ("author", "date", "version", "project", "scope",
                     "status", "reviewer", "reviewed_at", "review_comment"):
            if key in merged:
                lines.append(f"{key}: {merged[key]}")
        lines.append("---")
        lines.append("")
        return "\n".join(lines)

    def _update_spec_frontmatter(
        self, workspace_path: str, scope: dict[str, Any], updates: dict[str, str]
    ) -> dict[str, Any]:
        """更新 spec 文件的 frontmatter 字段(就地修改 + 持久化)。

        Returns:
            { spec, filePath, status }:文件不存在时 spec 为空。
        """
        root = Path(workspace_path).resolve()
        scope_hash = self._compute_scope_hash(scope)
        target = root / ".trae-cn" / "specs" / f"{scope_hash}.md"
        if not target.is_file():
            return {"spec": "", "filePath": "", "status": ""}

        try:
            content = target.read_text(encoding="utf-8")
            fields, _, body = self._parse_frontmatter(content)
            fields.update(updates)
            new_fm = self._build_frontmatter_from_fields(fields, scope)
            new_content = new_fm + body
            target.write_text(new_content, encoding="utf-8")
            return {
                "spec": new_content,
                "filePath": str(target.relative_to(root)).replace("\\", "/"),
                "status": fields.get("status", ""),
            }
        except Exception as e:
            logger.warning("更新 spec frontmatter 失败: %s", e)
            return {"spec": "", "filePath": "", "status": ""}

    # ------------------------------------------------------------------
    # Spec 驱动代码生成(apply / preview / confirm)
    # ------------------------------------------------------------------

    def _extract_affected_files_from_spec(self, spec_md: str) -> list[str]:
        """从 spec markdown 中提取受影响文件路径(反引号包裹的相对路径)。"""
        files: list[str] = []
        seen: set[str] = set()
        # 匹配 ### `path/to/file` 或 | `path/to/file` |
        for m in re.finditer(r"`([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|php))`", spec_md):
            fpath = m.group(1)
            if fpath not in seen:
                seen.add(fpath)
                files.append(fpath)
        return files[:50]  # 限制数量

    async def apply_spec(
        self,
        workspace_path: str,
        scope: dict[str, Any],
        new_spec: str,
        old_spec: Optional[str] = None,
    ) -> dict[str, Any]:
        """根据 spec markdown 生成代码 patch(unified diff 格式)。

        流程:
        1. 解析 new_spec 的 sections(## API 契约 / ## 数据模型 等)
        2. 用 LLM 生成 unified diff 格式的 patch
        3. 解析 patch 得到 affectedFiles 列表
        4. 返回 { patch, affectedFiles, summary }

        LLM 不可用时返回 { patch: '', affectedFiles: [], summary: 'llm_unavailable', error: 'llm_unavailable' }。
        字段名用 camelCase(affectedFiles)以匹配 API 端 spec-service.ts 契约。
        """
        root = Path(workspace_path).resolve()
        if old_spec is None:
            old_data = self.load_spec(workspace_path, scope, "latest")
            old_spec = old_data["spec"]

        affected_files = self._extract_affected_files_from_spec(new_spec)

        prompt = (
            "对比以下新旧 spec,生成 unified diff 格式的代码 patch。\n\n"
            f"## 旧 spec\n{old_spec[:8000]}\n\n"
            f"## 新 spec\n{new_spec[:8000]}\n\n"
            f"## 受影响文件列表\n{chr(10).join(affected_files)}\n\n"
            "## 输出要求\n"
            "1. 输出标准 unified diff 格式(--- a/path / +++ b/path / @@ hunk)\n"
            "2. 每个 hunk 包含上下文行(以空格开头)\n"
            "3. 删除行以 - 开头,新增行以 + 开头\n"
            "4. 仅输出 diff,不要额外说明\n"
        )

        # LLM 调用:用 config.litellm_model(默认 stepfun/step-3.7-flash),30s 超时
        # LLM 不可用(导入失败/超时/异常/返回错误/空内容)统一返回 llm_unavailable,不抛异常
        try:
            from ..core.llm_gateway import llm_gateway
            from ..core.config import settings
        except Exception as e:
            return {
                "error": "llm_unavailable",
                "patch": "",
                "affectedFiles": [],
                "summary": f"llm_unavailable: {type(e).__name__}: {e}",
            }

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": "你是代码生成专家,根据 spec 生成 unified diff patch"},
            {"role": "user", "content": prompt},
        ]

        try:
            result = await asyncio.wait_for(
                llm_gateway.complete(messages, model=settings.litellm_model),
                timeout=30,
            )
        except asyncio.TimeoutError:
            return {
                "error": "llm_unavailable",
                "patch": "",
                "affectedFiles": [],
                "summary": "llm_unavailable: LLM 调用超时 (30s)",
            }
        except Exception as e:
            return {
                "error": "llm_unavailable",
                "patch": "",
                "affectedFiles": [],
                "summary": f"llm_unavailable: {type(e).__name__}: {e}",
            }

        if result.get("error"):
            return {
                "error": "llm_unavailable",
                "patch": "",
                "affectedFiles": [],
                "summary": f"llm_unavailable: {result.get('error_message', 'LLM 调用失败')}",
            }

        content = str(result.get("content", "") or "")
        if not content:
            return {
                "error": "llm_unavailable",
                "patch": "",
                "affectedFiles": [],
                "summary": "llm_unavailable: LLM 返回空内容",
            }

        # 生成摘要
        added = sum(1 for l in content.splitlines() if l.startswith("+") and not l.startswith("+++"))
        removed = sum(1 for l in content.splitlines() if l.startswith("-") and not l.startswith("---"))
        summary = f"LLM 生成 patch:+{added} 行 / -{removed} 行,影响 {len(affected_files)} 个文件"

        return {
            "patch": content,
            "affectedFiles": affected_files,
            "summary": summary,
        }

    def apply_patch_preview(
        self, workspace_path: str, patch: str, affected_files: list[str]
    ) -> dict[str, Any]:
        """预览 patch 应用效果(不写文件)。

        Returns:
            { files: [{ path, originalLines, patchedLines, status }] }
        """
        root = Path(workspace_path).resolve()
        files_result: list[dict[str, Any]] = []
        file_patches = self._parse_unified_diff(patch)

        for fpath in affected_files:
            abs_path = root / fpath
            original = ""
            if abs_path.is_file():
                try:
                    original = abs_path.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    pass
            patched = self._apply_patch_to_content(original, file_patches.get(fpath, []))
            files_result.append({
                "path": fpath,
                "originalLines": len(original.splitlines()),
                "patchedLines": len(patched.splitlines()),
                "status": "modified" if patched != original else "unchanged",
            })

        return {"files": files_result}

    def apply_patch_confirm(
        self, workspace_path: str, patch: str, affected_files: list[str]
    ) -> dict[str, Any]:
        """确认应用 patch(写入文件,备份原文件到 .trae-cn/specs/backups/)。

        Returns:
            { applied: [...], failed: [...], backupDir }
        """
        root = Path(workspace_path).resolve()
        timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = root / ".trae-cn" / "specs" / "backups" / timestamp
        backup_dir.mkdir(parents=True, exist_ok=True)

        file_patches = self._parse_unified_diff(patch)
        applied: list[str] = []
        failed: list[dict[str, str]] = []

        for fpath in affected_files:
            abs_path = root / fpath
            try:
                original = ""
                if abs_path.is_file():
                    original = abs_path.read_text(encoding="utf-8", errors="replace")
                    # 备份原文件
                    backup_path = backup_dir / fpath.replace("/", "_")
                    backup_path.parent.mkdir(parents=True, exist_ok=True)
                    backup_path.write_text(original, encoding="utf-8")

                patched = self._apply_patch_to_content(original, file_patches.get(fpath, []))
                if patched != original:
                    abs_path.parent.mkdir(parents=True, exist_ok=True)
                    abs_path.write_text(patched, encoding="utf-8")
                    applied.append(fpath)
                else:
                    applied.append(fpath)  # 无变化也算成功
            except Exception as e:
                failed.append({"path": fpath, "error": f"{type(e).__name__}: {e}"})

        # 发射 spec.patch_applied 事件
        try:
            from .orchestration_hub import orchestration_hub
            spec_hash = hashlib.md5(patch.encode("utf-8")).hexdigest()[:12]
            success = len(failed) == 0
            severity = "info" if success else "warning"
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(orchestration_hub.emit(
                    event_type="spec.patch_applied",
                    source_pillar="spec",
                    payload={
                        "spec_hash": spec_hash,
                        "files_patched": len(applied),
                        "success": success,
                    },
                    severity=severity,
                ))
            except RuntimeError:
                pass  # 无运行中的事件循环,跳过
        except Exception:
            pass
        return {
            "applied": applied,
            "failed": failed,
            "backupDir": str(backup_dir.relative_to(root)).replace("\\", "/"),
        }

    def _parse_unified_diff(self, patch: str) -> dict[str, list[tuple[int, str, str]]]:
        """解析 unified diff,按文件分组返回 hunk 列表。

        Returns:
            { file_path: [(line_num, action, content), ...] }
            action: '+' / '-' / ' '
        """
        result: dict[str, list[tuple[int, str, str]]] = {}
        current_file: Optional[str] = None
        current_line = 0
        hunks: list[tuple[int, str, str]] = []

        for line in patch.splitlines():
            if line.startswith("--- "):
                if current_file and hunks:
                    result[current_file] = hunks
                hunks = []
                current_file = None
                continue
            if line.startswith("+++ "):
                # +++ b/path/to/file → 提取 path
                path = line[4:].strip()
                if path.startswith("b/"):
                    path = path[2:]
                current_file = path
                continue
            if line.startswith("@@"):
                # @@ -1,3 +1,4 @@ → 提取新文件起始行号 +1
                m = re.search(r"\+(\d+)", line)
                if m:
                    current_line = int(m.group(1))
                continue
            if current_file is None:
                continue
            if line.startswith("+"):
                hunks.append((current_line, "+", line[1:]))
                current_line += 1
            elif line.startswith("-"):
                hunks.append((current_line, "-", line[1:]))
            elif line.startswith(" "):
                hunks.append((current_line, " ", line[1:]))
                current_line += 1

        if current_file and hunks:
            result[current_file] = hunks
        return result

    def _apply_patch_to_content(
        self, original: str, hunks: list[tuple[int, str, str]]
    ) -> str:
        """将 hunk 列表应用到原始内容(简化版:按行号重建)。"""
        if not hunks:
            return original
        original_lines = original.splitlines(keepends=True)
        result_lines: list[str] = []
        orig_idx = 0  # 0-based

        for line_num, action, content in hunks:
            target_idx = line_num - 1  # 转 0-based
            # 补齐到目标行
            while orig_idx < target_idx and orig_idx < len(original_lines):
                result_lines.append(original_lines[orig_idx])
                orig_idx += 1
            if action == "+":
                result_lines.append(content + "\n")
            elif action == "-":
                if orig_idx < len(original_lines):
                    orig_idx += 1  # 跳过删除行
            else:  # context
                if orig_idx < len(original_lines):
                    result_lines.append(original_lines[orig_idx])
                    orig_idx += 1

        # 补齐剩余行
        while orig_idx < len(original_lines):
            result_lines.append(original_lines[orig_idx])
            orig_idx += 1

        return "".join(result_lines)

    # ------------------------------------------------------------------
    # Watch 自动同步(watchdog 监听 + webhook 通知)
    # ------------------------------------------------------------------

    def start_watch(
        self,
        workspace_path: str,
        scope: dict[str, Any],
        webhook_url: Optional[str] = None,
    ) -> dict[str, Any]:
        """启动指定 scope 的文件监听(watchdog)。

        降级:watchdog 不可用时返回 { error: "watchdog_not_installed" }。
        """
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler
        except ImportError:
            return {"error": "watchdog_not_installed"}

        root = Path(workspace_path).resolve()
        scope_type = scope.get("type", "workspace")
        scope_path = scope.get("path")

        if scope_type == "file":
            watch_path = (root / scope_path).resolve() if scope_path else root
            watch_path = watch_path.parent if watch_path.is_file() else watch_path
        elif scope_type == "dir":
            watch_path = (root / scope_path).resolve() if scope_path else root
        else:
            watch_path = root

        if not watch_path.is_dir():
            return {"error": "watch_path_not_dir", "path": str(watch_path)}

        scope_hash = self._compute_scope_hash(scope)
        watch_id = scope_hash
        # 如已有 watcher,先停止
        self.stop_watch(watch_id)

        # 文件变更回调(防抖:5s 内多次变更只触发一次 regen)
        last_trigger = {"time": 0.0}
        debounce_seconds = 5.0

        class SpecRegenHandler(FileSystemEventHandler):
            def __init__(self_outer):
                super().__init__()
                self_outer._workspace = workspace_path
                self_outer._scope = scope
                self_outer._webhook = webhook_url
                self_outer._watch_id = watch_id

            def on_any_event(self_outer, event):
                if event.is_directory:
                    return
                now = time.time()
                if now - last_trigger["time"] < debounce_seconds:
                    return
                last_trigger["time"] = now
                # 在新线程中异步 regen(避免阻塞 watchdog 线程)
                threading.Thread(
                    target=self_outer._regen_and_notify,
                    daemon=True,
                ).start()

            def _regen_and_notify(self_outer):
                try:
                    # 运行 async generate_diff in new thread
                    loop = asyncio.new_event_loop()
                    try:
                        loop.run_until_complete(self_outer._do_regen())
                    finally:
                        loop.close()
                except Exception as e:
                    logger.warning("watch regen 失败: %s", e)

            async def _do_regen(self_outer):
                try:
                    diff_result = await spec_generator.generate_diff(
                        self_outer._workspace, self_outer._scope
                    )
                    if not diff_result.get("diff"):
                        return
                    if self_outer._webhook:
                        import httpx
                        async with httpx.AsyncClient(timeout=10) as client:
                            await client.post(
                                self_outer._webhook,
                                json={
                                    "event": "spec_changed",
                                    "watchId": self_outer._watch_id,
                                    "scope": self_outer._scope,
                                    "diff": diff_result["diff"][:4000],
                                    "addedLines": diff_result.get("addedLines", 0),
                                    "removedLines": diff_result.get("removedLines", 0),
                                },
                            )
                except Exception as e:
                    logger.warning("watch regen/webhook 失败: %s", e)

        observer = Observer()
        handler = SpecRegenHandler()
        observer.schedule(handler, str(watch_path), recursive=True)
        observer.start()

        with _watchers_lock:
            _active_watchers[watch_id] = {
                "observer": observer,
                "scope": scope,
                "workspacePath": workspace_path,
                "webhookUrl": webhook_url,
                "startedAt": datetime.datetime.now().isoformat(),
                "watchPath": str(watch_path),
            }

        return {
            "watchId": watch_id,
            "status": "started",
            "watchPath": str(watch_path),
            "webhookUrl": webhook_url,
        }

    def stop_watch(self, watch_id: str) -> dict[str, Any]:
        """停止指定 watcher。"""
        with _watchers_lock:
            entry = _active_watchers.pop(watch_id, None)
        if not entry:
            return {"watchId": watch_id, "status": "not_found"}
        try:
            observer = entry.get("observer")
            if observer:
                observer.stop()
                observer.join(timeout=3)
        except Exception as e:
            logger.warning("停止 watcher 失败: %s", e)
        return {"watchId": watch_id, "status": "stopped"}

    def get_watch_status(self) -> dict[str, Any]:
        """返回当前活跃的 watcher 列表。"""
        with _watchers_lock:
            watchers = []
            for wid, entry in _active_watchers.items():
                watchers.append({
                    "watchId": wid,
                    "scope": entry.get("scope"),
                    "workspacePath": entry.get("workspacePath"),
                    "webhookUrl": entry.get("webhookUrl"),
                    "startedAt": entry.get("startedAt"),
                    "watchPath": entry.get("watchPath"),
                })
        return {"watchers": watchers}

    # ------------------------------------------------------------------
    # 评审工作流(draft → pending_review → approved / rejected)
    # ------------------------------------------------------------------

    def submit_for_review(
        self, workspace_path: str, scope: dict[str, Any]
    ) -> dict[str, Any]:
        """提交 spec 进入评审(status: draft → pending_review)。"""
        current = self.load_spec(workspace_path, scope, "latest")
        if not current["spec"]:
            return {"error": "spec_not_found"}
        fields, _, _ = self._parse_frontmatter(current["spec"])
        if fields.get("status", "draft") not in ("draft", "rejected"):
            return {"error": "invalid_status", "currentStatus": fields.get("status", "draft")}
        return self._update_spec_frontmatter(workspace_path, scope, {"status": "pending_review"})

    def approve_spec(
        self, workspace_path: str, scope: dict[str, Any], reviewer: str
    ) -> dict[str, Any]:
        """审批通过 spec(status: pending_review → approved)。"""
        current = self.load_spec(workspace_path, scope, "latest")
        if not current["spec"]:
            return {"error": "spec_not_found"}
        fields, _, _ = self._parse_frontmatter(current["spec"])
        if fields.get("status") != "pending_review":
            return {"error": "invalid_status", "currentStatus": fields.get("status", "draft")}
        return self._update_spec_frontmatter(workspace_path, scope, {
            "status": "approved",
            "reviewer": reviewer,
            "reviewed_at": datetime.datetime.now().isoformat(),
        })

    def reject_spec(
        self, workspace_path: str, scope: dict[str, Any], reviewer: str, comment: str
    ) -> dict[str, Any]:
        """拒绝 spec(status: pending_review → rejected)。"""
        current = self.load_spec(workspace_path, scope, "latest")
        if not current["spec"]:
            return {"error": "spec_not_found"}
        fields, _, _ = self._parse_frontmatter(current["spec"])
        if fields.get("status") != "pending_review":
            return {"error": "invalid_status", "currentStatus": fields.get("status", "draft")}
        return self._update_spec_frontmatter(workspace_path, scope, {
            "status": "rejected",
            "reviewer": reviewer,
            "reviewed_at": datetime.datetime.now().isoformat(),
            "review_comment": comment.replace("\n", " ")[:500],
        })

    def get_pending_reviews(self, workspace_path: str) -> dict[str, Any]:
        """返回所有 pending_review 状态的 spec 列表。"""
        root = Path(workspace_path).resolve()
        specs_dir = root / ".trae-cn" / "specs"
        if not specs_dir.is_dir():
            return {"specs": []}

        pending: list[dict[str, Any]] = []
        for f in specs_dir.glob("*.md"):
            try:
                content = f.read_text(encoding="utf-8", errors="replace")
                fields, _, _ = self._parse_frontmatter(content)
                if fields.get("status") == "pending_review":
                    pending.append({
                        "specId": f.stem,
                        "scope": fields.get("scope", ""),
                        "summary": self._summarize_spec(content),
                        "filePath": str(f.relative_to(root)).replace("\\", "/"),
                        "reviewer": fields.get("reviewer", ""),
                        "submittedAt": fields.get("reviewed_at", ""),
                    })
            except Exception:
                continue
        return {"specs": pending}

    # ------------------------------------------------------------------
    # Spec → Task 拆分
    # ------------------------------------------------------------------

    async def split_tasks(
        self, workspace_path: str, scope: dict[str, Any]
    ) -> dict[str, Any]:
        """从 spec 章节自动拆分任务(LLM 智能分析 + 章节降级)。

        Returns:
            { tasks: [{ title, description, priority, estimated_complexity }] }
        """
        spec_data = self.load_spec(workspace_path, scope, "latest")
        spec_md = spec_data["spec"]
        if not spec_md:
            return {"error": "spec_not_found"}

        # 按章节拆分
        sections = self._split_spec_sections(spec_md)
        if not sections:
            return {"tasks": []}

        prompt = (
            "你是项目管理专家。从以下 spec 章节拆分任务,输出严格 JSON。\n\n"
            f"## Spec 内容\n{spec_md[:10000]}\n\n"
            "## 输出要求\n"
            "1. 每个章节拆分 1-3 个任务\n"
            "2. 任务格式:{ title, description, priority, estimated_complexity }\n"
            "3. priority:P0(紧急)/ P1(高)/ P2(中)/ P3(低)\n"
            "4. estimated_complexity:S(1h) / M(4h) / L(1d) / XL(3d+)\n"
            "5. 输出 JSON: {\"tasks\": [...]}\n"
            "6. 仅输出 JSON,不要 markdown 代码块\n"
        )

        content, ok = await self._call_llm(prompt, system="你是专业的技术项目经理。")
        if not ok:
            # 降级:按章节标题机械拆分
            tasks = self._mechanical_split(sections)
            return {"tasks": tasks, "fallback": True, "error": content}

        # 解析 LLM 返回的 JSON
        tasks = self._parse_tasks_json(content)
        if not tasks:
            tasks = self._mechanical_split(sections)
            return {"tasks": tasks, "fallback": True}
        return {"tasks": tasks}

    def _split_spec_sections(self, spec_md: str) -> list[tuple[str, str]]:
        """按 ## 标题拆分 spec 章节。"""
        sections: list[tuple[str, str]] = []
        current_title = ""
        current_lines: list[str] = []
        for line in spec_md.splitlines():
            if line.startswith("## "):
                if current_title:
                    sections.append((current_title, "\n".join(current_lines)))
                current_title = line[3:].strip()
                current_lines = [line]
            elif current_title:
                current_lines.append(line)
        if current_title:
            sections.append((current_title, "\n".join(current_lines)))
        return sections

    def _mechanical_split(self, sections: list[tuple[str, str]]) -> list[dict[str, Any]]:
        """降级:按章节标题机械拆分(无 LLM 智能分析)。"""
        tasks: list[dict[str, Any]] = []
        for idx, (title, _) in enumerate(sections):
            tasks.append({
                "title": f"实现 {title}",
                "description": f"根据 spec 中「{title}」章节的描述完成开发任务",
                "priority": "P2" if idx > 0 else "P1",
                "estimated_complexity": "M",
            })
        return tasks

    def _parse_tasks_json(self, content: str) -> list[dict[str, Any]]:
        """从 LLM 输出中解析任务 JSON(容忍 markdown 代码块包裹)。"""
        # 去除 markdown 代码块
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        try:
            data = json.loads(cleaned)
            tasks = data.get("tasks", [])
            if isinstance(tasks, list):
                return [
                    {
                        "title": str(t.get("title", "")),
                        "description": str(t.get("description", "")),
                        "priority": str(t.get("priority", "P2")),
                        "estimated_complexity": str(t.get("estimated_complexity", "M")),
                    }
                    for t in tasks
                    if isinstance(t, dict)
                ]
        except Exception:
            pass
        return []

    # ------------------------------------------------------------------
    # LLM 智能增强(功能意图 / 风险点 / 改进建议)
    # ------------------------------------------------------------------

    async def enhance_spec(
        self, workspace_path: str, scope: dict[str, Any]
    ) -> dict[str, Any]:
        """对已生成的 spec 添加 LLM 智能分析章节。

        新增章节:
        - 功能意图说明:LLM 分析代码推测设计意图
        - 潜在风险点:LLM 识别可能的 bug / 安全隐患 / 性能瓶颈
        - 改进建议:LLM 提出 3-5 条改进建议

        降级:LLM 调用失败时省略智能分析章节,返回 { error }。
        """
        spec_data = self.load_spec(workspace_path, scope, "latest")
        spec_md = spec_data["spec"]
        if not spec_md:
            return {"error": "spec_not_found"}

        prompt = (
            "你是资深架构师。分析以下 spec,生成智能分析章节。\n\n"
            f"## Spec 内容\n{spec_md[:12000]}\n\n"
            "## 输出要求\n"
            "生成 markdown 格式的智能分析章节,包含:\n\n"
            "## 智能分析\n\n"
            "### 功能意图说明\n"
            "(分析代码推测设计意图,2-3 段)\n\n"
            "### 潜在风险点\n"
            "(识别可能的 bug / 安全隐患 / 性能瓶颈,列出 3-5 条)\n\n"
            "### 改进建议\n"
            "(提出 3-5 条改进建议,每条含标题 + 说明)\n\n"
            "仅输出 markdown 内容,不要额外说明。\n"
        )

        content, ok = await self._call_llm(prompt, system="你是专业的软件架构师。")
        if not ok:
            return {"error": "llm_unavailable", "message": content}

        # 将智能分析章节追加到 spec 末尾(在 frontmatter 之后)
        fields, _, body = self._parse_frontmatter(spec_md)
        if "## 智能分析" in body:
            # 已有智能分析章节,替换
            body = re.sub(
                r"## 智能分析[\s\S]*$",
                content.strip() + "\n",
                body,
            )
        else:
            body = body.rstrip() + "\n\n" + content.strip() + "\n"

        new_fm = self._build_frontmatter_from_fields(fields, scope)
        new_content = new_fm + body

        # 持久化
        try:
            root = Path(workspace_path).resolve()
            scope_hash = self._compute_scope_hash(scope)
            target = root / ".trae-cn" / "specs" / f"{scope_hash}.md"
            target.write_text(new_content, encoding="utf-8")
        except Exception as e:
            logger.warning("增强 spec 持久化失败: %s", e)

        return {
            "spec": new_content,
            "enhancement": content,
            "filePath": spec_data["filePath"],
        }


spec_generator = SpecGenerator()


# ---------------------------------------------------------------------------
# 2026-07-22 深化:额外 API 路由(Spec 驱动代码生成 / Watch / 评审 / 拆分 / 增强)
# ---------------------------------------------------------------------------
# 路由定义在 spec_generator.py 内,避免修改 routers/spec.py。
# 需在 main.py 注册:app.include_router(extra_router, prefix="/api", tags=["spec-extra"])
# 或由 routers/spec.py 在未来版本中 include。

try:
    from fastapi import APIRouter  # noqa: E402
    from pydantic import BaseModel, Field  # noqa: E402

    _EXTRA_ROUTER_AVAILABLE = True
except ImportError:
    _EXTRA_ROUTER_AVAILABLE = False

if _EXTRA_ROUTER_AVAILABLE:
    extra_router = APIRouter()

    # /spec/apply 端点已移至 routers/spec.py(复用已注册的 spec.router,无需额外注册 extra_router)

    class SpecApplyPatchRequest(BaseModel):
        workspacePath: str = Field(...)
        patch: str = Field(...)
        affectedFiles: list[str] = Field(default_factory=list)

    @extra_router.post("/spec/apply/preview")
    async def spec_apply_preview(req: SpecApplyPatchRequest) -> dict[str, Any]:
        """预览 patch 应用效果(不写文件)。"""
        try:
            result = spec_generator.apply_patch_preview(
                req.workspacePath, req.patch, req.affectedFiles
            )
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"patch 预览失败: {e}", "data": None}

    @extra_router.post("/spec/apply/confirm")
    async def spec_apply_confirm(req: SpecApplyPatchRequest) -> dict[str, Any]:
        """确认应用 patch(写入文件,备份原文件)。"""
        try:
            result = spec_generator.apply_patch_confirm(
                req.workspacePath, req.patch, req.affectedFiles
            )
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"patch 应用失败: {e}", "data": None}

    class SpecWatchStartRequest(BaseModel):
        scope: dict = Field(default_factory=lambda: {"type": "workspace"})
        workspacePath: str = Field(...)
        webhookUrl: Optional[str] = Field(None)

    @extra_router.post("/spec/watch/start")
    async def spec_watch_start(req: SpecWatchStartRequest) -> dict[str, Any]:
        """启动文件监听(watchdog)。"""
        try:
            result = spec_generator.start_watch(
                req.workspacePath, req.scope, req.webhookUrl
            )
            if "error" in result:
                return {"code": 501, "message": result["error"], "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"watch 启动失败: {e}", "data": None}

    class SpecWatchStopRequest(BaseModel):
        watchId: str = Field(...)

    @extra_router.post("/spec/watch/stop")
    async def spec_watch_stop(req: SpecWatchStopRequest) -> dict[str, Any]:
        """停止文件监听。"""
        try:
            result = spec_generator.stop_watch(req.watchId)
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"watch 停止失败: {e}", "data": None}

    @extra_router.get("/spec/watch/status")
    async def spec_watch_status() -> dict[str, Any]:
        """返回当前活跃的 watcher 列表。"""
        try:
            result = spec_generator.get_watch_status()
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"watch 状态获取失败: {e}", "data": None}

    class SpecReviewRequest(BaseModel):
        scope: dict = Field(default_factory=lambda: {"type": "workspace"})
        workspacePath: str = Field(...)
        reviewer: Optional[str] = Field(None)
        comment: Optional[str] = Field(None)

    @extra_router.post("/spec/review/submit")
    async def spec_review_submit(req: SpecReviewRequest) -> dict[str, Any]:
        """提交 spec 进入评审(draft → pending_review)。"""
        try:
            result = spec_generator.submit_for_review(req.workspacePath, req.scope)
            if "error" in result:
                return {"code": 400, "message": result["error"], "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"提交评审失败: {e}", "data": None}

    @extra_router.post("/spec/review/approve")
    async def spec_review_approve(req: SpecReviewRequest) -> dict[str, Any]:
        """审批通过 spec(pending_review → approved)。"""
        try:
            result = spec_generator.approve_spec(
                req.workspacePath, req.scope, req.reviewer or "anonymous"
            )
            if "error" in result:
                return {"code": 400, "message": result["error"], "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"审批失败: {e}", "data": None}

    @extra_router.post("/spec/review/reject")
    async def spec_review_reject(req: SpecReviewRequest) -> dict[str, Any]:
        """拒绝 spec(pending_review → rejected)。"""
        try:
            result = spec_generator.reject_spec(
                req.workspacePath, req.scope, req.reviewer or "anonymous", req.comment or ""
            )
            if "error" in result:
                return {"code": 400, "message": result["error"], "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"拒绝失败: {e}", "data": None}

    class SpecReviewListRequest(BaseModel):
        workspacePath: str = Field(...)

    @extra_router.get("/spec/pending-reviews")
    async def spec_pending_reviews(workspacePath: str) -> dict[str, Any]:
        """返回所有 pending_review 状态的 spec 列表。"""
        try:
            result = spec_generator.get_pending_reviews(workspacePath)
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"获取待评审列表失败: {e}", "data": None}

    class SpecSplitTasksRequest(BaseModel):
        scope: dict = Field(default_factory=lambda: {"type": "workspace"})
        workspacePath: str = Field(...)

    @extra_router.post("/spec/split-tasks")
    async def spec_split_tasks(req: SpecSplitTasksRequest) -> dict[str, Any]:
        """从 spec 章节自动拆分任务。"""
        try:
            result = await spec_generator.split_tasks(req.workspacePath, req.scope)
            if "error" in result:
                return {"code": 400, "message": result["error"], "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"任务拆分失败: {e}", "data": None}

    class SpecEnhanceRequest(BaseModel):
        scope: dict = Field(default_factory=lambda: {"type": "workspace"})
        workspacePath: str = Field(...)

    @extra_router.post("/spec/enhance")
    async def spec_enhance(req: SpecEnhanceRequest) -> dict[str, Any]:
        """对已生成的 spec 添加 LLM 智能分析章节。"""
        try:
            result = await spec_generator.enhance_spec(req.workspacePath, req.scope)
            if "error" in result:
                return {"code": 503, "message": result.get("error", "error"), "data": result}
            return {"code": 0, "message": "success", "data": result}
        except Exception as e:
            return {"code": 1, "message": f"spec 增强失败: {e}", "data": None}
