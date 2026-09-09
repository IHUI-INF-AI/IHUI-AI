# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""能力市场清单自动生成(P2-8 供给侧)。

从平台自研 MCP server 注册表(mcp_server._TOOLS / _TOOL_HANDLERS /
_ADMIN_ONLY_TOOLS / _RESOURCES / _PROMPTS)生成结构化 CapabilityManifest,
供"能力市场"入口浏览 / 检索 / 一键启用。

设计要点:
- 单一数据源:平台能力 = 自研 MCP server 暴露的全部 tool / resource / prompt。
- 结构化:名称 / 描述 / 分类 / 输入 schema 摘要 / 健康状态 / 权限分级。
- 缓存 + 失效策略:基于注册表签名(工具名 + 外部注入名)变化自动失效 +
  可选 TTL + 显式 invalidate_capability_cache()(外部工具热挂载后调用)。
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass, field
from typing import Any, cast

from . import mcp_server

# 清单缓存 TTL 秒(env 可覆盖,默认 30s)
_CAPABILITY_MANIFEST_TTL = float(os.environ.get("CAPABILITY_MANIFEST_TTL", "30"))

# 依赖外部网络的工具(健康状态标记为 degraded,提示需要网络)
_NETWORK_TOOLS: frozenset[str] = frozenset(
    {
        "web_search",
        "search_web",
        "fetch_url",
        "fetch_readable",
        "map_site",
        "crawl_site",
        "extract_web",
        "screenshot_url",
        "image_generation",
        "image_edit",
        "video_generation",
        "music_generation",
        "voice_tts",
        "token6688_voice_clone",
        "review_pr",
    }
)

@dataclass
class CapabilityParam:
    """能力输入参数摘要(来自 tool.input_schema)。"""

    name: str
    type: str
    required: bool
    description: str


@dataclass
class CapabilityInfo:
    """单个平台能力(工具 / 资源 / 提示词)的结构化描述。"""

    id: str
    name: str
    kind: str  # tool | resource | prompt
    description: str
    category: str
    permission: str  # admin | all
    requires_network: bool
    health: str  # healthy | degraded | unhealthy
    source: str = "builtin"
    params: list[CapabilityParam] = field(default_factory=list)


# 分类规则:(关键字, 分类)。顺序匹配,首个命中生效。
_CATEGORY_RULES: list[tuple[str, str]] = [
    ("browser_", "browser"),
    ("computer_", "computer"),
    ("git_", "system"),
    ("db_", "system"),
    ("run_command", "system"),
    ("knowledge", "knowledge"),
    ("context_recall", "knowledge"),
    ("summarize_artifacts", "knowledge"),
    ("search_codebase", "code"),
    ("index_codebase", "code"),
    ("analyze_code", "code"),
    ("generate_test", "code"),
    ("file_search", "code"),
    ("read_file", "file"),
    ("write_file", "file"),
    ("file_edit", "file"),
    ("list_files", "file"),
    ("web_search", "web"),
    ("search_web", "web"),
    ("fetch_url", "web"),
    ("fetch_readable", "web"),
    ("map_site", "web"),
    ("crawl_site", "web"),
    ("extract_web", "web"),
    ("image_generation", "media"),
    ("image_edit", "media"),
    ("video_generation", "media"),
    ("music_generation", "media"),
    ("voice_tts", "media"),
    ("token6688_voice_clone", "media"),
    ("vision_analyze", "media"),
    ("audio_transcription", "media"),
    ("token6688_balance", "media"),
    ("token6688_model_info", "media"),
    ("token6688_cancel_task", "media"),
    ("token6688_upload_file", "media"),
    ("screenshot_url", "media"),
    ("generate_chart", "media"),
    ("parse_document", "media"),
    ("dispatch_subagent", "agent"),
    ("configure_automation_task", "agent"),
    ("schedule_task", "agent"),
    ("run_in_background", "agent"),
    ("bg_task_status", "agent"),
    ("proactive_suggestion", "agent"),
    ("get_tool_schema", "infrastructure"),
]


def _categorize(name: str, description: str) -> str:
    """按名称关键字归类;未命中按描述关键词兜底,再兜底到 other。"""
    for key, cat in _CATEGORY_RULES:
        if name.startswith(key) or name == key:
            return cat
    desc_lower = (description or "").lower()
    if any(k in desc_lower for k in ("代码", "code", "符号", "symbol")):
        return "code"
    if any(k in desc_lower for k in ("文件", "file", "目录")):
        return "file"
    if any(k in desc_lower for k in ("网页", "web", "搜索", "search", "fetch")):
        return "web"
    if any(k in desc_lower for k in ("图像", "image", "视频", "video", "图表", "chart")):
        return "media"
    if any(k in desc_lower for k in ("知识", "knowledge", "记忆", "memory")):
        return "knowledge"
    if any(k in desc_lower for k in ("命令", "command", "git", "数据库", "database")):
        return "system"
    return "other"


def _params_from_schema(schema: dict[str, Any] | None) -> list[CapabilityParam]:
    """从 JSON schema 的 properties 提取参数摘要列表。"""
    if not isinstance(schema, dict):
        return []
    props = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    params: list[CapabilityParam] = []
    for pname, pdef in props.items():
        if not isinstance(pdef, dict):
            pdef = {}
        params.append(
            CapabilityParam(
                name=pname,
                type=str(pdef.get("type", "string")),
                required=pname in required,
                description=str(pdef.get("description", "")),
            )
        )
    return params


def _health_for(name: str, has_handler: bool) -> str:
    """计算健康状态:handler 缺失 → unhealthy;依赖外部网络 → degraded;否则 healthy。"""
    if not has_handler:
        return "unhealthy"
    if name in _NETWORK_TOOLS:
        return "degraded"
    return "healthy"


def _build_manifest() -> list[CapabilityInfo]:
    """从 mcp_server 注册表构建完整能力清单(纯函数,无缓存)。"""
    capabilities: list[CapabilityInfo] = []
    handlers = mcp_server._TOOL_HANDLERS
    admin_only = mcp_server._ADMIN_ONLY_TOOLS

    for tool in mcp_server._TOOLS:
        name = tool.name
        capabilities.append(
            CapabilityInfo(
                id=name,
                name=name,
                kind="tool",
                description=(tool.description or "").strip(),
                category=_categorize(name, tool.description),
                permission="admin" if name in admin_only else "all",
                requires_network=name in _NETWORK_TOOLS,
                health=_health_for(name, name in handlers),
                source="builtin",
                params=_params_from_schema(getattr(tool, "input_schema", None)),
            )
        )

    for res in mcp_server._RESOURCES:
        capabilities.append(
            CapabilityInfo(
                id=f"resource:{res.uri}",
                name=res.name,
                kind="resource",
                description=(res.description or "").strip(),
                category="knowledge",
                permission="all",
                requires_network=False,
                health="healthy",
                source="builtin",
            )
        )

    for prompt in mcp_server._PROMPTS:
        capabilities.append(
            CapabilityInfo(
                id=f"prompt:{prompt.name}",
                name=prompt.name,
                kind="prompt",
                description=(prompt.description or "").strip(),
                category="infrastructure",
                permission="all",
                requires_network=False,
                health="healthy",
                source="builtin",
            )
        )

    return capabilities


# ---------------------------------------------------------------------------
# 缓存层(注册表签名 + TTL + 显式失效)
# ---------------------------------------------------------------------------

_CACHE: dict[str, Any] = {"manifest": None, "signature": "", "at": 0.0}


def _registry_signature() -> str:
    """注册表签名:工具名集合 + 外部注入名集合哈希,任一变化即视为失效。"""
    names = [t.name for t in mcp_server._TOOLS]
    external = sorted(mcp_server.list_external_tools_injected())
    payload = json.dumps(
        {"tools": names, "external": external},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_manifest(force: bool = False) -> list[CapabilityInfo]:
    """返回能力清单(带缓存)。

    force=True 跳过缓存强制重建(测试 / 注册表变更后调用)。
    注册表签名变化或 TTL 过期时自动重建。
    """
    sig = _registry_signature()
    now = time.monotonic()
    if (
        not force
        and _CACHE["manifest"] is not None
        and _CACHE["signature"] == sig
        and (now - _CACHE["at"]) < _CAPABILITY_MANIFEST_TTL
    ):
        return cast(list[CapabilityInfo], _CACHE["manifest"])
    manifest = _build_manifest()
    _CACHE["manifest"] = manifest
    _CACHE["signature"] = sig
    _CACHE["at"] = now
    return manifest


def invalidate_capability_cache() -> None:
    """显式失效缓存(外部工具热挂载 / 卸载后调用)。"""
    _CACHE["manifest"] = None
    _CACHE["signature"] = ""
    _CACHE["at"] = 0.0


def list_categories() -> list[str]:
    """返回全部能力分类(排序去重)。"""
    return sorted({c.category for c in get_manifest()})


def capability_to_dict(c: CapabilityInfo) -> dict[str, Any]:
    """CapabilityInfo → 可序列化 dict(供 API 返回)。"""
    d = asdict(c)
    return d
