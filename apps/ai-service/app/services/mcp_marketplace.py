# (c) 2026 IHUI AI (Zhihui AI) / copyright owner: Li Chunchuan / https://aizhs.top
# Provenance-watermarked. Unauthorized commercial use can be traced (Apache-2.0).
# [IHUI-AI-PROVENANCE-NEW]: new file. MCP capability marketplace / supply-side dimension.

"""MCP capability marketplace -- reverse "flux consumer" into a supply-side market.

BENCHMARK GAP (no-copy new dimension): the rest of ihui consumes external MCP servers
as a *client*. This module turns ihui from a MCP client into an *supplier*: it opens up
the tools ihui itself exposes (see app/services/mcp_export.py) plus manually registered
external servers, indexes them so external agents can discover, verify, and paste an
install kit (mcpServers config / call examples / install steps).

Scope / constraints:
- PURE service layer: no new routes, does not touch agent_loop_v2 or step recorder.
- Reuses (does not rewrite) mcp_export.generate_client_config / compute_external_url for
  fabricating the paste-ready mcpServers snippet.
- Every marketplace function is deterministic and network-free (static verification), so
  unit tests stay hermetic.

Capability fields: {id, kind, name, description, tags, source_ref, manifest_ref, health,
listed, verified, added_at}. kind in {"mcp_tool", "mcp_server", "plugin", "skill"}.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, List

from app.services import mcp_export

# 能力类型白名单
KIND_MCP_TOOL = "mcp_tool"
KIND_MCP_SERVER = "mcp_server"
KIND_PLUGIN = "plugin"
KIND_SKILL = "skill"
VALID_KINDS: frozenset[str] = frozenset(
    {KIND_MCP_TOOL, KIND_MCP_SERVER, KIND_PLUGIN, KIND_SKILL}
)

# 可静态/连通验证的 kind(其余 kind 无标准可探测端点)
VERIFIABLE_KINDS: frozenset[str] = frozenset({KIND_MCP_TOOL, KIND_MCP_SERVER})

# ihui MCP Export 自带的对外工具(kind="mcp_tool",来源 mcp_export)。
# source_ref 形式: "mcp_export:{server_name}:{tool}"
IHUI_EXPORT_TOOLS: dict[str, dict[str, str]] = {
    "ihui.echo": {
        "description": "原样回显输入文本,用于连通/协议链路自检",
        "tags": "ihui,echo,selfcheck,readonly",
    },
    "ihui.now_utc": {
        "description": "返回当前 UTC 时间戳与 ISO 字符串(只读)",
        "tags": "ihui,time,utc,readonly",
    },
    "ihui.capabilities": {
        "description": "返回本 MCP 服务器实例的能力与工具清单(只读)",
        "tags": "ihui,metadata,capabilities,readonly",
    },
}


def utc_now_iso() -> str:
    """当前 UTC 时间(ISO 8601),作为 added_at 默认值。"""
    return datetime.now(tz=UTC).isoformat()


# =============================================================================
# 能力项
# =============================================================================

@dataclass
class Capability:
    """公开可索引的单项能力记录。"""

    id: str
    kind: str
    name: str
    description: str = ""
    tags: list[str] = field(default_factory=list)
    source_ref: str = ""
    manifest_ref: dict[str, Any] = field(default_factory=dict)
    health: str = "active"
    listed: bool = True
    verified: bool = False
    added_at: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.kind, str) or self.kind not in VALID_KINDS:
            raise ValueError(
                f"非法 kind: {self.kind!r}(支持 {sorted(VALID_KINDS)})"
            )
        if not self.id or not str(self.id).strip():
            raise ValueError("capability.id 不能为空")
        if not self.name or not str(self.name).strip():
            raise ValueError("capability.name 不能为空")

    def to_dict(self) -> dict[str, Any]:
        """可 JSON 序列化的字典视图。"""
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "description": self.description,
            "tags": list(self.tags),
            "source_ref": self.source_ref,
            "manifest_ref": dict(self.manifest_ref),
            "health": self.health,
            "listed": self.listed,
            "verified": self.verified,
            "added_at": self.added_at,
        }


def mcp_tool_capability(
    *,
    name: str,
    description: str = "",
    source_ref: str = "",
    tags: list[str] | None = None,
    listed: bool = True,
) -> Capability:
    """构造 kind="mcp_tool" 能力项(id 缺省用 name)。"""
    return Capability(
        id=name,
        kind=KIND_MCP_TOOL,
        name=name,
        description=description,
        tags=list(tags or []),
        source_ref=source_ref,
        listed=listed,
        added_at=utc_now_iso(),
    )


def mcp_server_capability(
    *,
    name: str,
    description: str = "",
    transport: str = mcp_export.TRANSPORT_STDIO,
    base_url: str | None = None,
    config: dict[str, Any] | None = None,
    source_ref: str = "",
    tags: list[str] | None = None,
    listed: bool = True,
    cap_id: str | None = None,
) -> Capability:
    """构造 kind="mcp_server" 能力项(手工登记外部/本机 MCP server)。

    manifest_ref 记录 transport / base_url / config,供 install kit 与 verify 使用。
    """
    if (transport or "").strip().lower() not in (
        mcp_export.TRANSPORT_STDIO,
        mcp_export.TRANSPORT_SSE,
        mcp_export.TRANSPORT_STREAMABLE_HTTP,
    ):
        raise ValueError(f"非法 transport: {transport!r}")
    manifest: dict[str, Any] = {
        "transport": (transport or mcp_export.TRANSPORT_STDIO).strip().lower(),
        "config": dict(config or {}),
    }
    if base_url:
        manifest["base_url"] = base_url
    return Capability(
        id=cap_id or name,
        kind=KIND_MCP_SERVER,
        name=name,
        description=description,
        tags=list(tags or []),
        source_ref=source_ref,
        manifest_ref=manifest,
        listed=listed,
        added_at=utc_now_iso(),
    )


# =============================================================================
# 注册表
# =============================================================================

class CapabilityRegistry:
    """内存能力注册表(进程内,幂等注册 + 全文/标签检索)。

    数据模型对齐 mcp_directory 的"只读目录"惯例,但本表可写(register/unregister),
    供 ihui 自身工具自动登记与外部 server 手工登记两类来源并存。
    """

    def __init__(self) -> None:
        self._items: dict[str, Capability] = {}
        self._tokens: dict[str, set[str]] = {}

    # ------------------------------------------------------------------
    # 写
    # ------------------------------------------------------------------

    def register(self, capability: Capability) -> Capability:
        """注册能力项(已有同 id 者覆盖更新,幂等)。返回落库对象。"""
        cap = capability
        _cap = self._items.get(cap.id)
        if _cap is not None and _cap.added_at:
            cap.added_at = (
                _cap.added_at  # 复注册保留首次加入时间(幂等语义)
                if not cap.added_at
                else cap.added_at
            )
        self._items[cap.id] = cap
        self._reindex(cap.id)
        return cap

    def unregister(self, capability_id: str) -> bool:
        """移除能力项;不存在返回 False。"""
        if capability_id in self._items:
            del self._items[capability_id]
            self._tokens.pop(capability_id, None)
            return True
        return False

    def _reindex(self, capability_id: str) -> None:
        cap = self._items[capability_id]
        text = " ".join(
            [
                cap.id,
                cap.name,
                cap.description,
                cap.source_ref,
                " ".join(cap.tags),
            ]
        ).lower()
        self._tokens[capability_id] = {w for w in text.split() if w}

    # ------------------------------------------------------------------
    # 读
    # ------------------------------------------------------------------

    def get(self, capability_id: str) -> Capability | None:
        return self._items.get(capability_id)

    def list_all(self) -> list[Capability]:
        """全部能力项(按 id 排序,确定性)。"""
        return [self._items[k] for k in sorted(self._items)]

    def counts(self) -> dict[str, Any]:
        """总览统计(总量/按 kind/按 listed/已 verified)。"""
        items = self.list_all()
        by_kind: dict[str, int] = {}
        for c in items:
            by_kind[c.kind] = by_kind.get(c.kind, 0) + 1
        return {
            "total": len(items),
            "by_kind": by_kind,
            "listed": sum(1 for c in items if c.listed),
            "unlisted": sum(1 for c in items if not c.listed),
            "verified": sum(1 for c in items if c.verified),
        }

    def search(self, q: str) -> List[Capability]:
        """关键词检索:id/name/description/source_ref/tags 子串匹配,多词取交集。

        空 q 返回空(与 list() 区分);大小写不敏感。
        """
        q = (q or "").strip()
        if not q:
            return []
        terms = [t.lower() for t in q.split()]
        out: list[Capability] = []
        for cid in sorted(self._items):
            text = " ".join(sorted(self._tokens[cid]))
            if all(t in text for t in terms):
                out.append(self._items[cid])
        return out

    def tag_filter(self, tags: list[str] | None) -> list[Capability]:
        """按标签筛选:必须具备全部给定标签(交集语义)。"""
        wanted = [t for t in (tags or []) if t]
        if not wanted:
            return self.list_all()
        out: list[Capability] = []
        for c in self.list_all():
            cap_tags = {t.lower() for t in c.tags}
            if all(t.lower() in cap_tags for t in wanted):
                out.append(c)
        return out


# =============================================================================
# 自动发现:把 mcp_export 暴露的工具登记为 mcp_tool 能力
# =============================================================================

def discover_ihui_export_tools() -> list[dict[str, Any]]:
    """返回 mcp_export 对外暴露工具的原始描述(供登记用,确定性)。"""
    out: list[dict[str, Any]] = []
    for name, meta in IHUI_EXPORT_TOOLS.items():
        out.append(
            {
                "capability": mcp_tool_capability(
                    name=name,
                    description=meta["description"],
                    source_ref=f"mcp_export:{mcp_export.SERVER_NAME}",
                    tags=[t for t in meta["tags"].split(",") if t],
                )
            }
        )
    return out


def register_ihui_export(registry: CapabilityRegistry) -> list[Capability]:
    """把 ihui 自身 MCP Export 工具自动登记进注册表。

    来源是 mcp_export(SERVER_NAME / 工具集),每个工具以 kind="mcp_tool" 登记。
    """
    registered: list[Capability] = []
    for entry in discover_ihui_export_tools():
        registered.append(registry.register(entry["capability"]))
    return registered


# =============================================================================
# 一键接入包生成
# =============================================================================

def _call_example_jsonrpc(name: str) -> str:
    return json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": {}},
        },
        ensure_ascii=False,
    )


def generate_install_kit(
    registry: CapabilityRegistry,
    capability_id: str,
    *,
    transport: str | None = None,
    base_url: str | None = None,
) -> dict[str, Any]:
    """生成可直接粘贴给其它 Agent 的接入体(install kit)。

    - kind="mcp_server": 用 generate_client_config 生成 mcpServers 片段 + 步骤。
    - kind="mcp_tool":   给针对该工具的 JSON-RPC tools/call 调用示例 + 来源。
    - 其余 kind:         无标准 MCP 接入体,仅给 source_ref 提示(标记 verifiable=False)。
    """
    cap = registry.get(capability_id)
    if cap is None:
        raise KeyError(f"能力不存在: {capability_id!r}")

    kit: dict[str, Any] = {
        "capability_id": cap.id,
        "name": cap.name,
        "kind": cap.kind,
        "source_ref": cap.source_ref,
        "install_steps": [],
    }

    if cap.kind == KIND_MCP_SERVER:
        t = (
            transport
            or (cap.manifest_ref or {}).get("transport")
            or mcp_export.TRANSPORT_STDIO
        )
        b = base_url or (cap.manifest_ref or {}).get("base_url")
        cfg = mcp_export.generate_client_config(t, base_url=b)
        kit["transport"] = t
        kit["config"] = cfg
        snippet = json.dumps(cfg, ensure_ascii=False, indent=2)
        kit["install_steps"] = [
            "将以下 mcpServers 片段粘贴进宿主(claude_desktop_config.json / mcp.json):",
            snippet,
        ]
    elif cap.kind == KIND_MCP_TOOL:
        kit["transport"] = (
            transport
            or (cap.manifest_ref or {}).get("transport")
            or mcp_export.TRANSPORT_STDIO
        )
        kit["call_example"] = _call_example_jsonrpc(cap.name)
        kit["install_steps"] = [
            f"工具 {cap.name} 由 ihui MCP Server 提供(source: {cap.source_ref or 'mcp_export'}),",
            "先接入 ihui-ai MCP Server(stdio 或 URL 传输),再以 tools/call 调用:",
            kit["call_example"],
        ]
    else:
        kit["verifiable"] = False
        kit["install_steps"] = [
            f"该能力类型({cap.kind})无标准 MCP 接入体,请按 source_ref 对接: "
            + (cap.source_ref or "(未提供)"),
        ]
    return kit


# =============================================================================
# 验证(连通自检 / 静态断言,默认离线路网零真实请求)
# =============================================================================

def _static_check(ok: bool, message: str) -> dict[str, Any]:
    return {"ok": ok, "message": message}


def _static_checks(cap: Capability) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = [
        _static_check(bool(cap.id and cap.id.strip()), "id 非空"),
        _static_check(bool(cap.name and cap.name.strip()), "name 非空"),
        _static_check(cap.kind in VERIFIABLE_KINDS, "kind 可验证"),
    ]
    if cap.kind == KIND_MCP_SERVER:
        t = (cap.manifest_ref or {}).get("transport")
        checks.append(
            _static_check(
                t in (mcp_export.TRANSPORT_STDIO, mcp_export.TRANSPORT_SSE,
                      mcp_export.TRANSPORT_STREAMABLE_HTTP),
                f"transport 有效({t!r})",
            )
        )
        if t in (mcp_export.TRANSPORT_SSE, mcp_export.TRANSPORT_STREAMABLE_HTTP):
            base = (cap.manifest_ref or {}).get("base_url")
            config = (cap.manifest_ref or {}).get("config") or {}
            checks.append(
                _static_check(
                    bool(base or (config or {}).get("host")),
                    "HTTP transport 需提供 base_url 或 config.host",
                )
            )
    elif cap.kind == KIND_MCP_TOOL:
        checks.append(_static_check(bool(cap.source_ref), "source_ref 非空"))
    return checks


def verify(
    registry: CapabilityRegistry,
    capability_id: str,
) -> dict[str, Any]:
    """对可验证 kind 做连通自检(回环/静态断言);不可验证项返回 verified=false+原因。

    纯服务层、确定性、不发真实网络请求(默认静态断言;回环探测由调用方按需扩展)。
    返回 dict 并原地更新能力项 verified 标记。
    """
    cap = registry.get(capability_id)
    if cap is None:
        raise KeyError(f"能力不存在: {capability_id!r}")

    if cap.kind not in VERIFIABLE_KINDS:
        cap.verified = False
        return {
            "capability_id": cap.id,
            "kind": cap.kind,
            "verified": False,
            "reason": f"kind={cap.kind} 无可验证标准端点,仅可静态登记",
            "checks": [],
        }

    checks = _static_checks(cap)
    ok = all(c["ok"] for c in checks)
    reason = None
    if not ok:
        reason = "; ".join(c["message"] for c in checks if not c["ok"])
    cap.verified = ok
    return {
        "capability_id": cap.id,
        "kind": cap.kind,
        "verified": ok,
        "reason": reason,
        "checks": checks,
    }


# =============================================================================
# 市场视图 + 单行宣告
# =============================================================================

def market_view(registry: CapabilityRegistry) -> dict[str, Any]:
    """供外部"浏览/接入"的汇总视图:counts + 可索清单 + 标签索引。

    每条能力附 verified/health/install_kit 引用。
    """
    items = registry.list_all()
    caps: list[dict[str, Any]] = []
    for c in items:
        caps.append(
            {
                "id": c.id,
                "kind": c.kind,
                "name": c.name,
                "description": c.description,
                "tags": list(c.tags),
                "listed": c.listed,
                "verified": c.verified,
                "health": c.health,
                "source_ref": c.source_ref,
                "install_kit_ref": {
                    "id": c.id,
                    "kit": f"generate_install_kit(capability_id={c.id!r})",
                },
            }
        )
    tag_index: dict[str, list[str]] = {}
    for c in items:
        for tag in c.tags:
            tag_index.setdefault(tag, [])
            if c.id not in tag_index[tag]:
                tag_index[tag].append(c.id)
    return {
        "counts": registry.counts(),
        "capabilities": caps,
        "tag_index": tag_index,
    }


def advertise(capability: Capability) -> str:
    """单行能力宣告,可拼进给外部 Agent 的介绍文本。

    含能力名 + kind + transport + url(若有),外加 verified 状态。
    """
    manifest = capability.manifest_ref if isinstance(
        capability.manifest_ref, dict
    ) else {}
    transport = manifest.get("transport")
    url = manifest.get("url")
    if not url:
        config = manifest.get("config") or {}
        if transport and (
            transport == mcp_export.TRANSPORT_SSE
            or transport == mcp_export.TRANSPORT_STREAMABLE_HTTP
        ):
            try:
                url = mcp_export.compute_external_url(config)
            except ValueError:
                url = None
    line = (
        f"[ihui-ai] capability={capability.name}"
        f" kind={capability.kind} id={capability.id}"
    )
    if transport:
        line += f" transport={transport}"
    if url:
        line += f" url={url}"
    if capability.verified:
        line += " verified=true"
    return line