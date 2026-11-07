# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 动态注册受信注册表(2026-11-07 立,trust-gated 单一入口)。

价值不在"能注册",而在**注册可管理且不可越权**。本模块把来源、声明、分级、
审批、审计串成一条 fail-closed 链路:

- 来源白名单(封闭): 仓库内受版本控制的 `apps/ai-service/config/mcp/servers/*.json`
  与用户显式配置目录 `~/.ihui/mcp-servers/*.json`。不接受请求体路径、不拉网络
  配置、不暴露任何"注册工具"给模型;加载只发生在启动与管理员 reload。
- 声明与命名空间: manifest 封闭 schema;`namespace` 是 server 身份;每个工具
  必须显式声明 `tier: read|write`;暴露名固定 `mcp__{namespace}__{tool}`。
- 冲突策略: 同名 namespace / 与既有工具同名 → **整台拒绝**,绝不覆盖、绝不部分注入。
- 分级真源: 本地声明为准;远端 `annotations` **只能升级不能降级**
  (`readOnlyHint=false` / `destructiveHint=true` 可把 read 升为 write)。
  远端 `tools/list` 出现未声明工具 → 整台拒绝(防工具面漂移/投毒)。
- 鉴权/审批: read 走既有权限层级;write 需 `role>=1` 且首次调用经既有审批面
  (`approval_persistence` 的 mcp_tool 授权 + agent 侧一次性授权交接)。
  直调 HTTP 无审批上下文 ⇒ `APPROVAL_REQUIRED`,按 fail-closed 处理。
- 审计: 谁、从哪个文件、注册了什么、何时;env/headers/token 只记键名与文件
  sha256,绝不记值。

与 `mcp_client.py`(运行期出站 server 管理)/ `mcp_stdio_bridge.py`(把 stdio
server 工具注入内部表)的分工:本模块是"从可信配置动态注册"的唯一入口,后两者
是被它调用的执行层。`mcp_server.py` 的固定工具表不在此改动范围内。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import stat
import subprocess
import time
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from app.services import mcp_server
from app.services.audit_service import audit_service
from app.services.mcp_client import MCPClientConfig, get_mcp_client_manager
from app.services.mcp_stdio_bridge import (
    StdioRegistrationError,
    _extract_text,
    add_stdio_server_tool,
    get_stdio_server_tiers,
    get_stdio_server_tools,
    is_stdio_server_registered,
    remove_stdio_server,
)

logger = logging.getLogger(__name__)

Tier = Literal["read", "write"]
Transport = Literal["stdio", "sse", "streamable-http"]

TIER_READ: Tier = "read"
TIER_WRITE: Tier = "write"

# 工具名暴露前缀:与仓内既有 `mcp__{server}__{tool}` 约定同形,namespace 即身份。
TOOL_PREFIX_FMT = "mcp__{namespace}__"
BRIDGE_NAME_FMT = "mcpreg_{namespace}"

# 审计动作名(集中常量,便于检索/断言)
AUDIT_LOADED = "mcp_registry.server_loaded"
AUDIT_UNLOADED = "mcp_registry.server_unloaded"
AUDIT_REJECTED = "mcp_registry.source_rejected"
AUDIT_DENIED = "mcp_registry.call_denied"
AUDIT_RELOADED = "mcp_registry.reloaded"

# 具名错误码(端点/用例按码断言,不靠文案)
ERR_NOT_TRUSTED = "REGISTRY_NOT_TRUSTED"
ERR_MANIFEST_INVALID = "MANIFEST_INVALID"
ERR_UNKNOWN_KEY = "UNKNOWN_KEY"
ERR_NAMESPACE_INVALID = "NAMESPACE_INVALID"
ERR_DUPLICATE_NAMESPACE = "DUPLICATE_NAMESPACE"
ERR_DUPLICATE_SERVER = "DUPLICATE_SERVER"
ERR_TOOL_CONFLICT = "TOOL_CONFLICT"
ERR_TIER_MISSING = "TIER_MISSING"
ERR_TIER_INVALID = "TIER_INVALID"
ERR_UNDECLARED_REMOTE_TOOL = "UNDECLARED_REMOTE_TOOL"
ERR_SECRET_IN_REPO_CONFIG = "SECRET_IN_REPO_CONFIG"
ERR_ENV_REF_MISSING = "ENV_REF_MISSING"
ERR_CONNECT_FAILED = "CONNECT_FAILED"
ERR_EMPTY_REMOTE = "EMPTY_REMOTE_TOOLS"
ERR_TRANSPORT_INVALID = "TRANSPORT_INVALID"
ERR_INTERNAL = "INTERNAL_ERROR"

# 保留命名空间:防冒充内部/系统能力
RESERVED_NAMESPACES = frozenset({"system", "internal", "core", "mcp", "admin"})

# 用户配置目录默认值(与 CLI 的 `~/.ihui/mcp.json` 刻意分开:两套 schema 不混读)
USER_CONFIG_DIR_ENV = "IHUI_MCP_USER_DIR"
REPO_CONFIG_DIR_ENV = "IHUI_MCP_REPO_DIR"
USER_CONFIG_DIR_DEFAULT = Path.home() / ".ihui" / "mcp-servers"

MAX_MANIFEST_BYTES = 256 * 1024
MAX_TOOLS = 128
MAX_ARGS = 64
MAX_ARG_LEN = 4096

NAMESPACE_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
TOOL_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
ENV_REF_RE = re.compile(r"^\$\{([A-Z_][A-Z0-9_]*)\}$")
# 与 mcp_stdio_bridge._validate_server_config 同一份 shell 元字符禁令(二次防御)
SHELL_META = (";", "&", "|", "$", "`", "\n", "\r")

_INTERNAL_ARG_PREFIX = "__"

_APP_DIR = Path(__file__).resolve().parents[1]
_AI_SERVICE_DIR = _APP_DIR.parent
_REPO_ROOT = _AI_SERVICE_DIR.parents[1]
REPO_CONFIG_DIR_DEFAULT = _AI_SERVICE_DIR / "config" / "mcp" / "servers"


class McpRegistryError(RuntimeError):
    """注册表具名失败(来源不可信/声明非法/冲突/连接失败)。"""

    def __init__(self, code: str, message: str, *, path: str = ""):
        super().__init__(message)
        self.code = code
        self.message = message
        self.path = path


@dataclass(frozen=True)
class ToolDeclaration:
    """一个工具在本地 manifest 里的声明(分级真源)。"""

    name: str
    tier: Tier


@dataclass(frozen=True)
class ServerManifest:
    """通过信任与 schema 校验后的服务器清单(不可变)。"""

    namespace: str
    transport: Transport
    tools: tuple[ToolDeclaration, ...]
    source_kind: str  # repo | user
    source_path: str
    source_sha256: str
    command: str = ""
    args: tuple[str, ...] = ()
    env: tuple[tuple[str, str], ...] = ()
    url: str = ""
    description: str = ""

    def tool_tiers(self) -> dict[str, Tier]:
        return {t.name: t.tier for t in self.tools}

    def fingerprint(self) -> str:
        """内容指纹:文件 sha + 来源类型。文件内容变即视为变更,需重新激活。"""
        return f"{self.source_kind}:{self.source_sha256}"

    def env_dict(self) -> dict[str, str]:
        return dict(self.env)


@dataclass
class RegisteredServer:
    """当前生效的注册项(用于 reload 差量/状态/审计)。"""

    manifest: ServerManifest
    registered_tool_keys: list[str] = field(default_factory=list)
    tool_tiers: dict[str, str] = field(default_factory=dict)


TrackedChecker = Callable[[Path], bool]


def _git_tracked(path: Path) -> bool:
    """仓库配置必须受版本控制(tracked);未跟踪/符号链接一律不可信。"""
    if path.is_symlink():
        return False
    try:
        rel = path.resolve().relative_to(_REPO_ROOT.resolve())
    except (OSError, ValueError):
        return False
    try:
        proc = subprocess.run(
            ["git", "-C", str(_REPO_ROOT), "ls-files", "--error-unmatch", rel.as_posix()],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as e:  # pragma: no cover - 环境缺 git
        logger.warning("[mcp_registry] git 版本控制检查不可用,按不可信拒绝: %s", e)
        return False
    return proc.returncode == 0


def _no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    """JSON 重复键拒绝(后值覆盖前值会藏匿配置,必须当场报错)。"""
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise McpRegistryError(ERR_MANIFEST_INVALID, f"JSON 重复键: {key}")
        out[key] = value
    return out


def _annotation_get(annotations: Any, key: str) -> Any:
    if isinstance(annotations, Mapping):
        return annotations.get(key)
    return getattr(annotations, key, None)


def _remote_marks_write(annotations: Any) -> bool:
    """远端 annotations 只能升级:readOnlyHint=false 或 destructiveHint=true ⇒ write。"""
    if annotations is None:
        return False
    if _annotation_get(annotations, "readOnlyHint") is False:
        return True
    return _annotation_get(annotations, "destructiveHint") is True


def _coerce_role(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _visible_args(args: Mapping[str, Any] | None) -> dict[str, Any]:
    return {k: v for k, v in (args or {}).items() if not str(k).startswith(_INTERNAL_ARG_PREFIX)}


def write_tool_approval_key(tool_name: str, args: dict[str, Any]) -> str:
    """写类工具的审批持久键(**与 agent_loop_v2._tool_approval_cache_key 同形**)。

    两处同形是硬约束:tool_name + 排序键 json 摘要(截断 256)。用例
    `test_mcp_registry_approval_key_parity` 直接比对两函数输出,漂移即红。
    """
    try:
        payload = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        payload = str(args)
    if len(payload) > 256:
        payload = payload[:256]
    return f"{tool_name}\x1f{payload}"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class McpRegistry:
    """动态注册表单例。所有状态只在本模块内,外部经公开方法读写。"""

    def __init__(
        self,
        *,
        repo_dir: Path | str | None = None,
        user_dir: Path | str | None = None,
        tracked_checker: TrackedChecker | None = None,
    ) -> None:
        self._repo_dir = Path(repo_dir) if repo_dir is not None else Path(
            os.environ.get(REPO_CONFIG_DIR_ENV) or REPO_CONFIG_DIR_DEFAULT
        )
        self._user_dir = Path(user_dir) if user_dir is not None else Path(
            os.environ.get(USER_CONFIG_DIR_ENV) or USER_CONFIG_DIR_DEFAULT
        )
        self._tracked = tracked_checker or _git_tracked
        self._servers: dict[str, RegisteredServer] = {}
        self._rejected: list[dict[str, Any]] = []
        self._last_reload_at: str | None = None
        self._lock = asyncio.Lock()
        # agent 侧"批准了一次(once)"的一次性交接:审批面本身不落盘 once,
        # 若不交接会出现"用户批了仍被 handler 拒"的假红;TTL + 用后即焚。
        self._one_shot: dict[str, float] = {}
        self._one_shot_ttl = 60.0

    # ---- 对外只读面 ----

    def status(self) -> dict[str, Any]:
        loaded: list[dict[str, Any]] = []
        for namespace, active in sorted(self._servers.items()):
            m = active.manifest
            loaded.append(
                {
                    "namespace": namespace,
                    "transport": m.transport,
                    "source": {
                        "kind": m.source_kind,
                        "path": m.source_path,
                        "sha256": m.source_sha256,
                    },
                    "envKeys": sorted(k for k, _ in m.env),
                    "tools": [
                        {
                            "name": tool.name,
                            "key": f"{TOOL_PREFIX_FMT.format(namespace=namespace)}{tool.name}",
                            "tier": active.tool_tiers.get(
                                f"{TOOL_PREFIX_FMT.format(namespace=namespace)}{tool.name}",
                                tool.tier,
                            ),
                        }
                        for tool in m.tools
                    ],
                }
            )
        return {
            "loaded": loaded,
            "rejected": list(self._rejected),
            "lastReloadAt": self._last_reload_at,
            "sources": {
                "repo": str(self._repo_dir),
                "user": str(self._user_dir),
            },
        }

    def is_write_tier_tool(self, tool_name: str) -> bool:
        """供 agent 审批面判定高危:动态注册的 write 工具必须进审批门。"""
        for active in self._servers.values():
            if active.tool_tiers.get(tool_name) == TIER_WRITE:
                return True
        return False

    def note_approved_write_call(self, tool_name: str, args: dict[str, Any]) -> None:
        """agent 侧批准后登记一次性授权(下发器在 agent_loop_v2 的 approve 分支)。"""
        key = write_tool_approval_key(tool_name, _visible_args(args))
        self._one_shot[key] = time.monotonic() + self._one_shot_ttl

    def reset_for_tests(self) -> None:
        """仅测试用:清一次性授权/拒绝清单,不改变已注册连接。"""
        self._one_shot.clear()
        self._rejected.clear()

    # ---- reload(唯一写入面) ----

    async def reload(self, actor: str = "system") -> dict[str, Any]:
        """重扫两份白名单来源并按差量激活;单文件失败只拒绝该文件,不影响其余。"""
        async with self._lock:
            candidates: dict[str, ServerManifest] = {}
            rejected: list[dict[str, Any]] = []
            for source_kind, path in self._iter_manifest_paths(actor, rejected):
                try:
                    manifest = self._load_manifest(source_kind, path)
                except McpRegistryError as e:
                    record = self._reject_record(source_kind, path, e.code, e.message)
                    rejected.append(record)
                    self._audit_rejected(actor, record)
                    continue
                except Exception as e:  # noqa: BLE001 - 解析异常一律按非法清单拒绝
                    record = self._reject_record(
                        source_kind, path, ERR_MANIFEST_INVALID, f"{type(e).__name__}: {e}"
                    )
                    rejected.append(record)
                    self._audit_rejected(actor, record)
                    continue
                if manifest.namespace in candidates:
                    first = candidates[manifest.namespace]
                    record = self._reject_record(
                        source_kind,
                        path,
                        ERR_DUPLICATE_NAMESPACE,
                        f"namespace '{manifest.namespace}' 已由 {first.source_path} 占用,拒绝覆盖",
                    )
                    rejected.append(record)
                    self._audit_rejected(actor, record)
                    continue
                candidates[manifest.namespace] = manifest

            # 卸载已消失/变更的注册项
            for namespace, active in list(self._servers.items()):
                next_manifest = candidates.get(namespace)
                if next_manifest is not None and (
                    next_manifest.fingerprint() == active.manifest.fingerprint()
                ):
                    continue
                await self._deactivate(active)
                self._servers.pop(namespace, None)
                self._audit_unloaded(actor, active.manifest, reason="removed_or_changed")

            # 激活新增/变更项
            for namespace, manifest in candidates.items():
                existing = self._servers.get(namespace)
                if (
                    existing is not None
                    and existing.manifest.fingerprint() == manifest.fingerprint()
                ):
                    continue
                try:
                    registered = await self._activate(manifest, actor)
                except McpRegistryError as e:
                    record = self._reject_record(
                        manifest.source_kind, Path(manifest.source_path), e.code, e.message
                    )
                    rejected.append(record)
                    self._audit_rejected(actor, record)
                    continue
                except Exception as e:  # noqa: BLE001 - 任何激活异常都不得半成品生效
                    record = self._reject_record(
                        manifest.source_kind,
                        Path(manifest.source_path),
                        ERR_INTERNAL,
                        f"{type(e).__name__}: {e}",
                    )
                    rejected.append(record)
                    self._audit_rejected(actor, record)
                    continue
                self._servers[namespace] = registered
                self._audit_loaded(actor, manifest, registered)

            self._rejected = rejected
            self._last_reload_at = _now_iso()
            self._audit_reloaded(actor, loaded=len(self._servers), rejected=len(rejected))
            return self.status()

    async def shutdown(self) -> None:
        async with self._lock:
            for active in list(self._servers.values()):
                await self._deactivate(active)
            self._servers.clear()
            self._one_shot.clear()

    # ---- 来源扫描与信任 ----

    def _iter_manifest_paths(
        self, actor: str, rejected: list[dict[str, Any]]
    ) -> Iterable[tuple[str, Path]]:
        for source_kind, root in (("repo", self._repo_dir), ("user", self._user_dir)):
            try:
                root_ok = root.exists() and root.is_dir()
            except OSError:
                root_ok = False
            if not root_ok:
                continue
            try:
                files = sorted(root.glob("*.json"))
            except OSError as e:
                record = self._reject_record(source_kind, root, ERR_NOT_TRUSTED, str(e))
                rejected.append(record)
                self._audit_rejected(actor, record)
                continue
            for path in files:
                yield source_kind, path

    def _load_manifest(self, source_kind: str, path: Path) -> ServerManifest:
        self._assert_trusted(source_kind, path)
        raw = path.read_bytes()
        if len(raw) > MAX_MANIFEST_BYTES:
            raise McpRegistryError(
                ERR_MANIFEST_INVALID, f"manifest 超过 {MAX_MANIFEST_BYTES} 字节", path=str(path)
            )
        sha = hashlib.sha256(raw).hexdigest()
        try:
            data = json.loads(raw.decode("utf-8"), object_pairs_hook=_no_duplicate_keys)
        except UnicodeDecodeError as e:
            raise McpRegistryError(ERR_MANIFEST_INVALID, f"非 UTF-8 文件: {e}", path=str(path)) from e
        except json.JSONDecodeError as e:
            raise McpRegistryError(
                ERR_MANIFEST_INVALID, f"JSON 解析失败: {e}", path=str(path)
            ) from e
        if not isinstance(data, dict):
            raise McpRegistryError(ERR_MANIFEST_INVALID, "顶层必须是 JSON 对象", path=str(path))
        return self._validate_manifest(data, source_kind, path, sha)

    def _assert_trusted(self, source_kind: str, path: Path) -> None:
        if path.is_symlink():
            raise McpRegistryError(
                ERR_NOT_TRUSTED, "拒绝符号链接配置(防 realpath 逃逸)", path=str(path)
            )
        if not path.is_file():
            raise McpRegistryError(ERR_NOT_TRUSTED, "配置必须是普通文件", path=str(path))
        st = path.stat()
        if not stat.S_ISREG(st.st_mode):
            raise McpRegistryError(ERR_NOT_TRUSTED, "配置必须是普通文件", path=str(path))
        if source_kind == "repo":
            if not self._tracked(path):
                raise McpRegistryError(
                    ERR_NOT_TRUSTED,
                    "仓库配置未被 git 跟踪(不是受版本控制的文件),拒绝加载",
                    path=str(path),
                )
            return
        # user:realpath 必须留在操作者显式声明的目录内;拒 world-writable(POSIX)
        try:
            root = self._user_dir.resolve(strict=True)
            real = path.resolve(strict=True)
        except OSError as e:
            raise McpRegistryError(ERR_NOT_TRUSTED, f"路径解析失败: {e}", path=str(path)) from e
        if not real.is_relative_to(root):
            raise McpRegistryError(
                ERR_NOT_TRUSTED, "用户配置路径越出显式配置目录", path=str(path)
            )
        if hasattr(os, "getuid") and (st.st_mode & 0o002):
            raise McpRegistryError(
                ERR_NOT_TRUSTED, "用户配置不得 world-writable", path=str(path)
            )

    # ---- 声明校验(封闭 schema,未知键即拒) ----

    def _validate_manifest(
        self, data: dict[str, Any], source_kind: str, path: Path, sha: str
    ) -> ServerManifest:
        allowed = {
            "schemaVersion",
            "namespace",
            "transport",
            "description",
            "command",
            "args",
            "env",
            "url",
            "tools",
        }
        unknown = sorted(set(data) - allowed)
        if unknown:
            raise McpRegistryError(
                ERR_UNKNOWN_KEY, f"未知配置键: {', '.join(unknown)}", path=str(path)
            )
        if data.get("schemaVersion") != 1:
            raise McpRegistryError(ERR_MANIFEST_INVALID, "schemaVersion 必须为 1", path=str(path))
        namespace = data.get("namespace")
        if not isinstance(namespace, str) or not NAMESPACE_RE.match(namespace):
            raise McpRegistryError(
                ERR_NAMESPACE_INVALID,
                f"namespace 非法(需 ^[a-z][a-z0-9_-]{{0,31}}$): {namespace!r}",
                path=str(path),
            )
        if namespace in RESERVED_NAMESPACES:
            raise McpRegistryError(
                ERR_NAMESPACE_INVALID, f"namespace '{namespace}' 为保留字", path=str(path)
            )
        transport = data.get("transport")
        if transport not in ("stdio", "sse", "streamable-http"):
            raise McpRegistryError(
                ERR_TRANSPORT_INVALID,
                f"transport 必须为 stdio|sse|streamable-http: {transport!r}",
                path=str(path),
            )
        description = data.get("description", "")
        if not isinstance(description, str) or len(description) > 200:
            raise McpRegistryError(
                ERR_MANIFEST_INVALID, "description 必须是 <=200 字符的字符串", path=str(path)
            )
        tools_raw = data.get("tools")
        if not isinstance(tools_raw, list) or not tools_raw or len(tools_raw) > MAX_TOOLS:
            raise McpRegistryError(
                ERR_TIER_MISSING,
                f"tools 必须显式声明(1..{MAX_TOOLS} 条),不允许空清单",
                path=str(path),
            )
        tools: list[ToolDeclaration] = []
        seen_names: set[str] = set()
        for item in tools_raw:
            if not isinstance(item, dict):
                raise McpRegistryError(ERR_MANIFEST_INVALID, "tools 每条必须是对象", path=str(path))
            unknown_tool = sorted(set(item) - {"name", "tier"})
            if unknown_tool:
                raise McpRegistryError(
                    ERR_UNKNOWN_KEY,
                    f"未知工具键: {', '.join(unknown_tool)}",
                    path=str(path),
                )
            name = item.get("name")
            tier = item.get("tier")
            if not isinstance(name, str) or not TOOL_NAME_RE.match(name):
                raise McpRegistryError(
                    ERR_MANIFEST_INVALID, f"工具名非法: {name!r}", path=str(path)
                )
            if tier not in ("read", "write"):
                raise McpRegistryError(
                    ERR_TIER_MISSING,
                    f"工具 '{name}' 缺 tier 或 tier 非法(必须 read|write): {tier!r}",
                    path=str(path),
                )
            if name in seen_names:
                raise McpRegistryError(ERR_MANIFEST_INVALID, f"工具重复声明: {name}", path=str(path))
            seen_names.add(name)
            tools.append(ToolDeclaration(name=name, tier=tier))
        if transport == "stdio":
            command = data.get("command")
            if not isinstance(command, str) or not command.strip():
                raise McpRegistryError(ERR_MANIFEST_INVALID, "stdio 必须提供 command", path=str(path))
            for ch in SHELL_META:
                if ch in command:
                    raise McpRegistryError(
                        ERR_MANIFEST_INVALID, f"command 含非法字符: {ch!r}", path=str(path)
                    )
            if "url" in data:
                raise McpRegistryError(
                    ERR_UNKNOWN_KEY, "stdio 配置不允许 url(传输方式冲突)", path=str(path)
                )
            args = data.get("args", [])
            if not isinstance(args, list) or len(args) > MAX_ARGS:
                raise McpRegistryError(
                    ERR_MANIFEST_INVALID, f"args 必须是 <= {MAX_ARGS} 项的数组", path=str(path)
                )
            for arg in args:
                if not isinstance(arg, str) or len(arg) > MAX_ARG_LEN:
                    raise McpRegistryError(
                        ERR_MANIFEST_INVALID, "args 每项必须是不超过 4096 字符的字符串", path=str(path)
                    )
            url = ""
        else:
            url_raw = data.get("url")
            if not isinstance(url_raw, str) or not url_raw:
                raise McpRegistryError(ERR_MANIFEST_INVALID, "远程传输必须提供 url", path=str(path))
            parsed = urlparse(url_raw)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise McpRegistryError(
                    ERR_MANIFEST_INVALID, f"url 必须是 http(s) 绝对地址: {url_raw!r}", path=str(path)
                )
            for key in ("command", "args", "env"):
                if key in data:
                    raise McpRegistryError(
                        ERR_UNKNOWN_KEY,
                        f"{transport} 配置不允许 {key}(会启动本地进程)",
                        path=str(path),
                    )
            command = ""
            args = []
            url = url_raw
        env_resolved = self._validate_env(data.get("env"), source_kind, path)
        return ServerManifest(
            namespace=namespace,
            transport=transport,
            tools=tuple(tools),
            source_kind=source_kind,
            source_path=str(path),
            source_sha256=sha,
            command=command,
            args=tuple(args),
            env=tuple(sorted(env_resolved.items())),
            url=url,
            description=description,
        )

    def _validate_env(
        self, raw: Any, source_kind: str, path: Path
    ) -> dict[str, str]:
        if raw is None:
            return {}
        if not isinstance(raw, dict):
            raise McpRegistryError(ERR_MANIFEST_INVALID, "env 必须是对象", path=str(path))
        resolved: dict[str, str] = {}
        for key, value in raw.items():
            if not isinstance(key, str) or not ENV_KEY_RE.match(key):
                raise McpRegistryError(ERR_MANIFEST_INVALID, f"env 键非法: {key!r}", path=str(path))
            if not isinstance(value, str):
                raise McpRegistryError(
                    ERR_MANIFEST_INVALID, f"env.{key} 必须是字符串", path=str(path)
                )
            ref = ENV_REF_RE.match(value)
            if source_kind == "repo":
                # 仓库受版本控制 ⇒ 不得出现字面量(哪怕不是密钥);只允许 ${ENV} 引用。
                if ref is None:
                    raise McpRegistryError(
                        ERR_SECRET_IN_REPO_CONFIG,
                        f"仓库配置的 env.{key} 只允许 ${{ENV}} 引用,禁止字面量值",
                        path=str(path),
                    )
                env_name = ref.group(1)
                if env_name not in os.environ:
                    raise McpRegistryError(
                        ERR_ENV_REF_MISSING, f"env 引用不存在: ${{{env_name}}}", path=str(path)
                    )
                resolved[key] = os.environ[env_name]
            elif ref is not None:
                env_name = ref.group(1)
                if env_name not in os.environ:
                    raise McpRegistryError(
                        ERR_ENV_REF_MISSING, f"env 引用不存在: ${{{env_name}}}", path=str(path)
                    )
                resolved[key] = os.environ[env_name]
            else:
                resolved[key] = value
        return resolved

    # ---- 激活 / 卸载 ----

    async def _activate(self, manifest: ServerManifest, actor: str) -> RegisteredServer:
        prefix = TOOL_PREFIX_FMT.format(namespace=manifest.namespace)
        # 冲突预检放在连接之前:能提前拒绝的就不拉起子进程/发起出站连接。
        existing = set(mcp_server.get_registered_tool_names())
        conflicts = [f"{prefix}{t.name}" for t in manifest.tools if f"{prefix}{t.name}" in existing]
        if conflicts:
            raise McpRegistryError(
                ERR_TOOL_CONFLICT,
                f"工具名与既有工具冲突,拒绝注册 namespace '{manifest.namespace}': "
                f"{', '.join(conflicts)}",
            )
        if manifest.transport == "stdio":
            return await self._activate_stdio(manifest, prefix)
        return await self._activate_remote(manifest, prefix)

    async def _activate_stdio(self, manifest: ServerManifest, prefix: str) -> RegisteredServer:
        bridge_name = BRIDGE_NAME_FMT.format(namespace=manifest.namespace)
        if is_stdio_server_registered(bridge_name):
            raise McpRegistryError(
                ERR_DUPLICATE_SERVER, f"stdio server 标识已被占用: {bridge_name}"
            )
        tiers = manifest.tool_tiers()

        def resolve_tier(remote_name: str, tool: Any) -> str:
            declared = tiers.get(remote_name)
            if declared is None:
                raise StdioRegistrationError(
                    ERR_UNDECLARED_REMOTE_TOOL,
                    f"远端出现未声明工具,整台拒绝: {remote_name}",
                )
            if declared == TIER_READ and _remote_marks_write(getattr(tool, "annotations", None)):
                return TIER_WRITE
            return declared

        try:
            await add_stdio_server_tool(
                bridge_name,
                manifest.command,
                list(manifest.args),
                manifest.env_dict(),
                manifest.description,
                tool_prefix=prefix,
                tier_resolver=resolve_tier,
                write_gate=self._make_write_gate(),
            )
        except StdioRegistrationError as e:
            raise McpRegistryError(e.code, e.message) from e
        except RuntimeError as e:
            raise McpRegistryError(ERR_CONNECT_FAILED, str(e)) from e
        keys = get_stdio_server_tools(bridge_name)
        tier_map = get_stdio_server_tiers(bridge_name)
        return RegisteredServer(
            manifest=manifest,
            registered_tool_keys=keys,
            tool_tiers={k: tier_map.get(k, TIER_READ) for k in keys},
        )

    async def _activate_remote(self, manifest: ServerManifest, prefix: str) -> RegisteredServer:
        manager = get_mcp_client_manager()
        client_name = BRIDGE_NAME_FMT.format(namespace=manifest.namespace)
        if manager.get_client(client_name) is not None:
            raise McpRegistryError(
                ERR_DUPLICATE_SERVER, f"外部 server 标识已被占用: {client_name}"
            )
        config = MCPClientConfig(
            name=client_name,
            transport=manifest.transport,
            url=manifest.url,
        )
        manager.register(config, owner_user_id="")
        client = manager.get_client(client_name)
        if client is None:  # pragma: no cover - register 成功后不应为空
            raise McpRegistryError(ERR_INTERNAL, "外部 server 注册后取不到客户端")
        registered_keys: list[str] = []
        tier_map: dict[str, str] = {}
        tiers = manifest.tool_tiers()
        try:
            await client.connect()
            remote_tools = await client.list_tools()
            if not remote_tools:
                raise McpRegistryError(
                    ERR_EMPTY_REMOTE, "远端 tools/list 为空,拒绝注册空能力 server"
                )
            for tool in remote_tools:
                remote_name = tool.name
                declared = tiers.get(remote_name)
                if declared is None:
                    raise McpRegistryError(
                        ERR_UNDECLARED_REMOTE_TOOL,
                        f"远端出现未声明工具,整台拒绝: {remote_name}",
                    )
                effective = (
                    TIER_WRITE
                    if declared == TIER_READ and _remote_marks_write(tool.annotations)
                    else declared
                )
                exposed = f"{prefix}{remote_name}"
                handler = self._make_remote_handler(client, remote_name, exposed, effective)
                ok = mcp_server.register_external_tool(
                    mcp_server.MCPTool(
                        name=exposed,
                        description=tool.description,
                        input_schema=tool.input_schema or {"type": "object", "properties": {}},
                    ),
                    handler,
                )
                if not ok:
                    raise McpRegistryError(
                        ERR_TOOL_CONFLICT, f"工具名与既有工具冲突: {exposed}"
                    )
                registered_keys.append(exposed)
                tier_map[exposed] = effective
            return RegisteredServer(
                manifest=manifest,
                registered_tool_keys=registered_keys,
                tool_tiers=tier_map,
            )
        except Exception:
            if registered_keys:
                mcp_server.unregister_external_tools(registered_keys)
            await manager.unregister_async(client_name)
            raise

    async def _deactivate(self, active: RegisteredServer) -> None:
        manifest = active.manifest
        if manifest.transport == "stdio":
            bridge_name = BRIDGE_NAME_FMT.format(namespace=manifest.namespace)
            tools = await remove_stdio_server(bridge_name)
            if tools:
                mcp_server.unregister_external_tools(tools)
            return
        manager = get_mcp_client_manager()
        await manager.unregister_async(BRIDGE_NAME_FMT.format(namespace=manifest.namespace))
        if active.registered_tool_keys:
            mcp_server.unregister_external_tools(active.registered_tool_keys)

    # ---- 写类工具闸门 ----

    def _make_write_gate(
        self,
    ) -> Callable[[str, dict[str, Any]], Awaitable[dict[str, Any] | None]]:
        async def gate(tool_key: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
            role = _coerce_role((arguments or {}).get("__user_role"))
            user_id = str((arguments or {}).get("__user_id") or "") or None
            visible = _visible_args(arguments)
            if role < 1:
                self._audit_denied(user_id, tool_key, "ROLE_DENIED")
                return {
                    "tool": tool_key,
                    "ok": False,
                    "error": f"写类工具 '{tool_key}' 需要 admin 权限(role >= 1),当前 role={role}",
                    "errorCode": "ROLE_DENIED",
                }
            key = write_tool_approval_key(tool_key, visible)
            if self._consume_one_shot(key):
                return None
            try:
                from . import approval_persistence as ap

                if ap.check(key, "mcp_tool"):
                    return None
            except Exception as e:  # noqa: BLE001 - 审批层异常按 fail-closed 处理
                logger.warning("[mcp_registry] 审批持久层不可用,按未批准拒绝: %s", e)
            self._audit_denied(user_id, tool_key, "APPROVAL_REQUIRED")
            return {
                "tool": tool_key,
                "ok": False,
                "error": (
                    f"写类工具 '{tool_key}' 首次调用需经既有审批面批准"
                    "(session/always 授权或 agent 侧一次性批准)"
                ),
                "errorCode": "APPROVAL_REQUIRED",
            }

        return gate

    def _consume_one_shot(self, key: str) -> bool:
        now = time.monotonic()
        expired = [k for k, until in self._one_shot.items() if until <= now]
        for k in expired:
            self._one_shot.pop(k, None)
        return self._one_shot.pop(key, None) is not None

    def _make_remote_handler(
        self, client: Any, remote_name: str, exposed: str, tier: str
    ) -> Callable[[dict[str, Any]], Any]:
        gate = self._make_write_gate() if tier == TIER_WRITE else None

        async def handler(arguments: dict[str, Any]) -> dict[str, Any]:
            if gate is not None:
                denial = await gate(exposed, arguments or {})
                if denial is not None:
                    return denial
            visible = _visible_args(arguments)
            try:
                result = await client.call_tool(remote_name, visible)
            except Exception as e:  # noqa: BLE001 - 外部调用失败按工具失败回传
                return {"tool": exposed, "ok": False, "error": str(e), "content": ""}
            if isinstance(result, dict):
                if result.get("ok") is False:
                    return {
                        "tool": exposed,
                        "ok": False,
                        "error": str(result.get("error") or "外部工具执行失败"),
                        "content": "",
                    }
                text = _extract_text(result.get("content"))
                if bool(result.get("isError")):
                    return {
                        "tool": exposed,
                        "ok": False,
                        "error": text or "外部工具执行失败",
                        "content": "",
                    }
                return {"tool": exposed, "ok": True, "content": text, "result": text}
            return {"tool": exposed, "ok": True, "content": str(result), "result": str(result)}

        return handler

    # ---- 审计(只记键名/哈希,不记值) ----

    def _reject_record(
        self, source_kind: str, path: Path, code: str, message: str
    ) -> dict[str, Any]:
        return {
            "source": source_kind,
            "path": str(path),
            "code": code,
            "message": message,
        }

    def _audit(self, action: str, actor: str, details: dict[str, Any]) -> None:
        try:
            audit_service.log_agent_action(
                agent_id="mcp_registry",
                action=action,
                details=details,
                user_id=actor if actor != "system" else None,
            )
        except Exception as e:  # noqa: BLE001 - 审计失败不得反噬注册主链路
            logger.warning("[mcp_registry] 审计落库失败(忽略): %s", e)

    def _audit_loaded(
        self, actor: str, manifest: ServerManifest, registered: RegisteredServer
    ) -> None:
        self._audit(
            AUDIT_LOADED,
            actor,
            {
                "actor": actor,
                "sourceKind": manifest.source_kind,
                "sourcePath": manifest.source_path,
                "fileSha256": manifest.source_sha256,
                "namespace": manifest.namespace,
                "transport": manifest.transport,
                "envKeys": sorted(k for k, _ in manifest.env),
                "tools": [
                    {
                        "name": tool.name,
                        "tier": registered.tool_tiers.get(
                            f"{TOOL_PREFIX_FMT.format(namespace=manifest.namespace)}{tool.name}",
                            tool.tier,
                        ),
                    }
                    for tool in manifest.tools
                ],
            },
        )

    def _audit_unloaded(self, actor: str, manifest: ServerManifest, *, reason: str) -> None:
        self._audit(
            AUDIT_UNLOADED,
            actor,
            {
                "actor": actor,
                "sourceKind": manifest.source_kind,
                "sourcePath": manifest.source_path,
                "fileSha256": manifest.source_sha256,
                "namespace": manifest.namespace,
                "reason": reason,
            },
        )

    def _audit_rejected(self, actor: str, record: dict[str, Any]) -> None:
        self._audit(
            AUDIT_REJECTED,
            actor,
            {
                "actor": actor,
                "sourceKind": record["source"],
                "sourcePath": record["path"],
                "code": record["code"],
                "message": record["message"],
            },
        )

    def _audit_denied(self, user_id: str | None, tool_key: str, code: str) -> None:
        self._audit(
            AUDIT_DENIED,
            user_id or "system",
            {"actor": user_id or "system", "tool": tool_key, "code": code},
        )

    def _audit_reloaded(self, actor: str, *, loaded: int, rejected: int) -> None:
        self._audit(
            AUDIT_RELOADED,
            actor,
            {
                "actor": actor,
                "loaded": loaded,
                "rejected": rejected,
                "sources": {"repo": str(self._repo_dir), "user": str(self._user_dir)},
            },
        )


_registry: McpRegistry | None = None


def get_mcp_registry() -> McpRegistry:
    """进程级单例(测试可自行构造 McpRegistry 隔离,不污染单例)。"""
    global _registry
    if _registry is None:
        _registry = McpRegistry()
    return _registry


def is_write_tier_tool(tool_name: str) -> bool:
    """agent 审批面的查询出口(供 agent_loop_v2 最小接线)。"""
    return get_mcp_registry().is_write_tier_tool(tool_name)


def note_approved_write_call(tool_name: str, args: dict[str, Any]) -> None:
    """agent 批准后交接一次性授权(供 agent_loop_v2 approve 分支调用)。"""
    get_mcp_registry().note_approved_write_call(tool_name, args)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
