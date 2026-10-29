# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""init_agents_md —— D118「/init 式 AGENTS.md 生成器」(2026-10-23,G-232)。

票面落点①:扫描工作区(package.json scripts / 构建文件 / 目录结构 / README 与
既有约定文档)→ 产出**结构化 AGENTS.md 草稿文本**。

安全纪律(与 path_guard 单一权威源同源):
- 工具默认**只返回草稿、不落盘**——「生成后进人工编辑确认」归调用方(UI/编辑器),
  不存在静默写盘路径;
- 调用方显式传 output_path 时,写路径必须过双闸门:
  1) 白名单根:解析后必须落在被扫描的工作区根内(防 .. / symlink 逃逸);
  2) 敏感目录黑名单:复用 ``app.services.path_guard``(单一权威源,.git /
     node_modules / .venv / dist / build / __pycache__ / .next 等一律拒绝)。
- 只读取已登记的清单类文件(package.json / pyproject.toml / Makefile 目标行 /
  约定文档标题行),不遍历任意文件内容,不触碰 .env 等凭证面。

零依赖:纯 stdlib(pathlib/json/re/tomllib),不引入模板引擎或扫描框架。
返回形态与同族工具一致:{"tool","ok",...} / {"tool","ok":False,"errorCode","message"}。
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_TOOL_NAME = "init_agents_md"

# 目录结构展示时跳过的噪音目录(缓存/产物/依赖;与 path_guard 黑名单语义对齐但更宽,
# 仅影响"草稿里展示什么",不构成写防线——写防线见 _validate_output_path)。
_NOISE_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".venv",
        "venv",
        "dist",
        "build",
        "__pycache__",
        ".next",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".turbo",
        ".svelte-kit",
        ".output",
        "target",
    }
)

# 约定文档候选(按优先级;docs/ 目录单独处理)
_CONVENTION_DOC_FILES = (
    "AGENTS.md",
    "CLAUDE.md",
    "agent.md",
    "claude.md",
    "README.md",
    "CONTRIBUTING.md",
    "PROJECT_PLAN.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
)

# 规模上限:草稿是给人复核的,不是仓库全量索引
_MAX_COMMANDS = 24
_MAX_TREE_ENTRIES = 40
_MAX_TREE_SUBS = 12
_MAX_DOC_ENTRIES = 16
_MAX_DOCS_DIR_FILES = 10
_MAX_SUMMARY_LEN = 100
_MAX_FILE_READ_BYTES = 64 * 1024

# Makefile 目标行:行首标识符紧跟冒号(排除 .PHONY 等点开头与注释)
_MAKEFILE_TARGET_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(?:[^=]|$)")

# 溯源水印横幅行(本仓 .md 文件普遍以 "# © …/# Provenance-watermarked./# [IHUI-AI-PROVENANCE]:"
# 开头):摘要须跳过它们,取真正的第一个内容标题。
_BANNER_LINE_RE = re.compile(
    r"^#*\s*(?:©|\(c\)\s|Provenance-watermarked|\[IHUI-AI-PROVENANCE\])",
    re.IGNORECASE,
)


def _error(code: str, message: str) -> dict[str, Any]:
    """统一失败返回形态(同 report_tools)。"""
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


def _read_text(path: Path) -> str:
    """带体积上限的容错读取(清单/文档面)。"""
    try:
        return path.read_bytes()[:_MAX_FILE_READ_BYTES].decode("utf-8", errors="replace")
    except OSError:
        return ""


def _first_summary(text: str) -> str:
    """取文档首个内容标题/非空行,截断为一行摘要。

    跳过:HTML 注释块(含未闭合跨行)、溯源水印横幅行(见 _BANNER_LINE_RE)。
    """
    in_comment = False
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if in_comment:
            if "-->" in stripped:
                in_comment = False
            continue
        if stripped.startswith("<!--"):
            if "-->" not in stripped:
                in_comment = True
            continue
        if _BANNER_LINE_RE.match(stripped):
            continue
        if stripped.startswith("#"):
            stripped = stripped.lstrip("#").strip()
        if stripped:
            return stripped[:_MAX_SUMMARY_LEN]
    return ""


def _detect_package_manager(root: Path) -> str:
    if (root / "pnpm-lock.yaml").is_file() or (root / "pnpm-workspace.yaml").is_file():
        return "pnpm"
    if (root / "yarn.lock").is_file():
        return "yarn"
    return "npm"


def _detect_build_commands(root: Path) -> list[str]:
    """从构建清单探测可用的构建/开发/测试命令。"""
    cmds: list[str] = []

    def _add(cmd: str) -> None:
        if cmd not in cmds and len(cmds) < _MAX_COMMANDS:
            cmds.append(cmd)

    pkg = root / "package.json"
    if pkg.is_file():
        pm = _detect_package_manager(root)
        try:
            data = json.loads(_read_text(pkg) or "{}")
        except json.JSONDecodeError:
            data = {}
        scripts = data.get("scripts") if isinstance(data.get("scripts"), dict) else {}
        for key in ("dev", "build", "start", "test", "lint", "typecheck"):
            if key in scripts:
                _add(f"{pm} run {key}")
        for key in scripts:
            if key not in ("dev", "build", "start", "test", "lint", "typecheck"):
                _add(f"{pm} run {key}")

    pyproject = root / "pyproject.toml"
    if pyproject.is_file():
        text = _read_text(pyproject)
        try:
            import tomllib

            parsed = tomllib.loads(text)
        except Exception:  # noqa: BLE001 - tomllib 缺失/解析失败均降级为文本探测
            parsed = {}
        _tool = parsed.get("tool")
        tool = _tool if isinstance(_tool, dict) else {}
        if "poetry" in tool:
            _add("poetry install")
            _add("poetry run pytest")
        else:
            _add("pip install -e .")
        if "pytest" in tool or "[tool.pytest" in text:
            _add("pytest")
        if "ruff" in tool or (root / "ruff.toml").is_file():
            _add("ruff check .")
        if "mypy" in tool or (root / "mypy.ini").is_file():
            _add("mypy .")

    makefile = root / "Makefile"
    if makefile.is_file():
        for line in _read_text(makefile).splitlines():
            m = _MAKEFILE_TARGET_RE.match(line)
            if m:
                target = m.group(1)
                if target not in {".PHONY", "all", "default"}:
                    _add(f"make {target}")

    if (root / "Cargo.toml").is_file():
        _add("cargo build")
        _add("cargo test")
    if (root / "go.mod").is_file():
        _add("go build ./...")
        _add("go test ./...")
    if (root / "pom.xml").is_file():
        _add("mvn package")
    if (root / "build.gradle").is_file() or (root / "build.gradle.kts").is_file():
        _add("gradle build")
    if (root / "docker-compose.yml").is_file() or (root / "docker-compose.yaml").is_file():
        _add("docker compose up -d")
    if (root / "turbo.json").is_file():
        _add("turbo run build")
        _add("turbo run test")

    return cmds


def _visible_dirs(parent: Path) -> list[Path]:
    """列出可展示的普通子目录(跳过隐藏/噪音),按名排序。"""
    try:
        entries = sorted(
            (
                p
                for p in parent.iterdir()
                if p.is_dir() and not p.name.startswith(".") and p.name not in _NOISE_DIR_NAMES
            ),
            key=lambda p: p.name,
        )
    except OSError:
        return []
    return entries


def _scan_directory_structure(root: Path) -> list[str]:
    """顶层目录 + 常见容器目录(apps/packages/src 等)下探一层。"""
    lines: list[str] = [f"{root.name}/"]
    for d in _visible_dirs(root)[:_MAX_TREE_ENTRIES]:
        lines.append(f"{d.name}/")
        if d.name in {"apps", "packages", "src", "services", "libs", "lib"}:
            subs = _visible_dirs(d)
            for s in subs[:_MAX_TREE_SUBS]:
                lines.append(f"  {s.name}/")
            if len(subs) > _MAX_TREE_SUBS:
                lines.append(f"  ...(共 {len(subs)} 个)")
    return lines


def _detect_convention_docs(root: Path) -> list[tuple[str, str]]:
    """既有约定文档:候选文件 + docs/ 目录内的 Markdown,附一行摘要。"""
    docs: list[tuple[str, str]] = []
    for name in _CONVENTION_DOC_FILES:
        p = root / name
        if p.is_file():
            docs.append((name, _first_summary(_read_text(p))))
    docs_dir = root / "docs"
    if docs_dir.is_dir():
        try:
            md_files = sorted(
                p.name for p in docs_dir.iterdir() if p.is_file() and p.suffix.lower() == ".md"
            )
        except OSError:
            md_files = []
        shown = md_files[:_MAX_DOCS_DIR_FILES]
        for fname in shown:
            docs.append((f"docs/{fname}", ""))
        if len(md_files) > len(shown):
            docs.append((f"docs/ ...(另有 {len(md_files) - len(shown)} 篇)", ""))
    return docs[:_MAX_DOC_ENTRIES]


def _detect_toolchain(root: Path) -> list[str]:
    """代码风格/质量工具链探测(供草稿的「既有约定」段引用)。"""
    notes: list[str] = []
    if any((root / name).exists() for name in ("eslint.config.mjs", "eslint.config.js", ".eslintrc", ".eslintrc.js", ".eslintrc.json")):
        notes.append("ESLint(JavaScript/TypeScript lint)")
    if any((root / name).exists() for name in (".prettierrc", ".prettierrc.json", ".prettierrc.js", "prettier.config.js")):
        notes.append("Prettier(格式化)")
    if (root / ".editorconfig").is_file():
        notes.append("EditorConfig(编辑器基础约定)")
    if (root / "tsconfig.json").is_file() or (root / "tsconfig.base.json").is_file():
        notes.append("TypeScript")
    pyproject_text = _read_text(root / "pyproject.toml") if (root / "pyproject.toml").is_file() else ""
    if "[tool.ruff]" in pyproject_text or (root / "ruff.toml").is_file():
        notes.append("Ruff(Python lint)")
    if "[tool.mypy]" in pyproject_text or (root / "mypy.ini").is_file():
        notes.append("mypy(Python 类型检查)")
    if (root / "pnpm-workspace.yaml").is_file():
        notes.append("pnpm workspace(monorepo)")
    if (root / "turbo.json").is_file():
        notes.append("Turborepo(monorepo 构建编排)")
    return notes


def _detect_project_identity(root: Path) -> tuple[str, str]:
    """项目名与一句话概述:package.json → pyproject.toml → 目录名。"""
    pkg = root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(_read_text(pkg) or "{}")
        except json.JSONDecodeError:
            data = {}
        name = str(data.get("name") or "").strip()
        desc = str(data.get("description") or "").strip()
        if name or desc:
            return (name or root.name, desc)
    pyproject = root / "pyproject.toml"
    if pyproject.is_file():
        try:
            import tomllib

            parsed = tomllib.loads(_read_text(pyproject))
            _proj = parsed.get("project")
            proj = _proj if isinstance(_proj, dict) else {}
            name = str(proj.get("name") or "").strip()
            desc = str(proj.get("description") or "").strip()
            if name or desc:
                return (name or root.name, desc)
        except Exception:  # noqa: BLE001
            pass
    return (root.name, "")


def _build_draft(
    *,
    project_name: str,
    description: str,
    package_manager: str,
    commands: list[str],
    tree_lines: list[str],
    docs: list[tuple[str, str]],
    toolchain: list[str],
) -> str:
    """把探测结果装配成结构化 AGENTS.md 草稿文本。"""
    out: list[str] = []
    out.append(f"# AGENTS.md — {project_name}")
    out.append("")
    out.append(
        "> ⚠️ 本草稿由 `init_agents_md`(D118 /init 式生成器)自动探测生成,"
        "**须经人工复核编辑后方可使用**;删除本行即视为已确认。"
    )
    out.append("")
    out.append("## 项目概述")
    out.append("")
    if description:
        out.append(f"- {description}")
    out.append(f"- 包管理器:{package_manager}")
    out.append("")

    out.append("## 构建与开发命令")
    out.append("")
    out.append("以下命令由工作区清单文件(package.json scripts / pyproject.toml / Makefile 等)探测:")
    out.append("")
    out.append("```bash")
    out.extend(commands if commands else ["(未探测到构建命令——请人工补充)"])
    out.append("```")
    out.append("")

    out.append("## 目录结构")
    out.append("")
    out.append("```")
    out.extend(tree_lines)
    out.append("```")
    out.append("")

    out.append("## 既有约定文档")
    out.append("")
    if docs:
        for path, summary in docs:
            out.append(f"- `{path}`" + (f" — {summary}" if summary else ""))
    else:
        out.append("- (未发现 README/CONTRIBUTING 等约定文档)")
    out.append("")

    out.append("## 工具链与风格")
    out.append("")
    if toolchain:
        out.extend(f"- {note}" for note in toolchain)
    else:
        out.append("- (未探测到 lint/format/type-check 配置)")
    out.append("")

    out.append("## 写盘与安全纪律")
    out.append("")
    out.append("- 生成器只返回草稿文本,不静默写盘;落盘一律经人工确认。")
    out.append("- 显式指定 output_path 时,路径必须位于工作区白名单根内,")
    out.append("  且不得落在敏感目录(.git / node_modules / .venv / dist / build /")
    out.append("  __pycache__ / .next)——判定源为 `app/services/path_guard.py`。")
    out.append("")
    return "\n".join(out)


def _validate_output_path(root: Path, output_path: str) -> tuple[bool, str]:
    """写路径双闸门:工作区白名单根 ⊕ path_guard 敏感目录黑名单。

    Returns:
        (True, resolved_path) 或 (False, error_message)
    """
    from ..services.path_guard import find_sensitive_segment, sensitive_error_message

    p = Path(output_path).expanduser()
    if not p.is_absolute():
        p = root / p
    # resolve(strict=False):解析 symlink 与 .. ,不要求目标已存在
    resolved = p.resolve(strict=False)
    try:
        resolved.relative_to(root)
    except ValueError:
        return False, f"output_path 不在工作区白名单根({root})内: {output_path}"
    seg = find_sensitive_segment(resolved)
    if seg is not None:
        return False, sensitive_error_message(resolved)
    return True, str(resolved)


async def init_agents_md(arguments: dict[str, Any]) -> dict[str, Any]:
    """扫描工作区并生成 AGENTS.md 草稿(默认不落盘)。

    Args:
        arguments: {"workspace_root": str(必填), "output_path": str(可选,
            显式传入才写盘,且必须过白名单+敏感目录双闸门)}

    Returns:
        成功: {"tool","ok":True,"draft","workspace_root","written_path",
               "detected":{...计数},"message"}
        失败: {"tool","ok":False,"errorCode","message"}
    """
    workspace = str(arguments.get("workspace_root") or "").strip()
    if not workspace:
        return _error("INVALID_ARGUMENT", "workspace_root 不能为空")
    root = Path(workspace).expanduser()
    if not root.is_absolute():
        root = (Path.cwd() / root).resolve(strict=False)
    else:
        root = root.resolve(strict=False)
    if not root.is_dir():
        return _error("WORKSPACE_NOT_FOUND", f"工作区目录不存在: {workspace}")

    project_name, description = _detect_project_identity(root)
    package_manager = _detect_package_manager(root)
    commands = _detect_build_commands(root)
    tree_lines = _scan_directory_structure(root)
    docs = _detect_convention_docs(root)
    toolchain = _detect_toolchain(root)

    draft = _build_draft(
        project_name=project_name,
        description=description,
        package_manager=package_manager,
        commands=commands,
        tree_lines=tree_lines,
        docs=docs,
        toolchain=toolchain,
    )

    output_path = str(arguments.get("output_path") or "").strip()
    written: str | None = None
    if output_path:
        ok, info = _validate_output_path(root, output_path)
        if not ok:
            return _error("OUTPUT_PATH_REJECTED", info)
        target = Path(info)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(draft, encoding="utf-8")
            written = info
        except OSError as exc:
            return _error("WRITE_FAILED", f"草稿写盘失败: {exc}")

    message = "AGENTS.md 草稿已生成(未落盘,待人工确认后由调用方写盘)"
    if written:
        message = f"AGENTS.md 草稿已生成并写入: {written}(仍建议人工复核)"
    return {
        "tool": _TOOL_NAME,
        "ok": True,
        "draft": draft,
        "workspace_root": str(root),
        "written_path": written,
        "detected": {
            "commands": len(commands),
            "tree_entries": len(tree_lines),
            "convention_docs": len(docs),
            "toolchain_notes": len(toolchain),
        },
        "message": message,
    }


__all__ = ["init_agents_md"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
