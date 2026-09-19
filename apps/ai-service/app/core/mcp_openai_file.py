# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 2026-09-19 第三十一批,对标 Codex mcp_openai_file.rs/connectors.rs
"""OpenAI 文件参数重写 + 连接器暴露纯规则(Codex Rust 移植,纯算法版)。

对标源:
- codex-rs/core/src/mcp_openai_file.rs:把 MCP 工具参数里声明的「文件输入字段」
  从本地路径重写为 OpenAI 文件存储返回的 download_url/file_id 载荷。
- codex-rs/core/src/connectors.rs:连接器(Connector)注册/暴露/审批的纯规则。

移植判定(本批任务要求):
- mcp_openai_file.rs:真正的服务端上传(`upload_openai_file`)、鉴权
  (`CodexAuth::uses_codex_backend`)、沙箱文件系统(`get_metadata`/`read_file_stream`)
  与 Session/StepContext 强耦合 —— 这些「服务端 API 调用层」不可移植,本模块把
  它们抽象为一个可注入的 `Uploader` 回调,只移植以下纯算法:
    * 声明字段遍历与参数重写(字符串 / 数组两种形状)
    * 文件名推断(basename 兜底到末非空路径段,再兜底 "file")
    * 文件大小上限检查(常量 OPENAI_FILE_UPLOAD_LIMIT_BYTES)
    * 可选字段(mime_type / file_name)按需纳入载荷
- connectors.rs:与 McpManager / EnvironmentManager / AuthManager / 插件系统强耦合的
  IO 与发现逻辑不可移植;以下「纯规则」可移植并合并进本文件(已在头部注明):
    * tool_suggest 连接器 id 计算(加载插件 id + 声明发现项 - 禁用项)
    * synthetic_link 元数据过滤(剔除合成入口工具)
    * 按 server_name + connector_id 聚合可见连接器(AppInfo)
    * 审批复核人(approvals_reviewer)的回退链解析
    * 可见连接器缓存键与 TTL 缓存

重叠说明:我侧 app/services/mcp_server.py 已有 `_tool_token6688_upload_file`
(本地路径读取 + ≤50MB 上限 + basename 文件名),属同一概念的既有实现;本模块
不复刻上传/读取 IO,只复用「大小上限 + basename 文件名」思路并抽象成可测纯函数,
不改动那些既有文件。

本模块零第三方依赖、零 app 内依赖,便于 mypy 与单测。
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Optional, Protocol, runtime_checkable


# ---------------------------------------------------------------------------
# 常量(对标 codex_api / codex_connectors 模块级常量)
# ---------------------------------------------------------------------------

# 对标 codex_api::OPENAI_FILE_UPLOAD_LIMIT_BYTES(OpenAI Files API 单文件上限 512 MiB)。
OPENAI_FILE_UPLOAD_LIMIT_BYTES: int = 512 * 1024 * 1024

# 对标 codex_connectors::CONNECTORS_CACHE_TTL(可见连接器缓存 TTL,5 分钟)。
CONNECTORS_CACHE_TTL_SECONDS: int = 300

# 对标 codex_mcp::CODEX_APPS_MCP_SERVER_NAME。
CODEX_APPS_MCP_SERVER_NAME: str = "codex-apps"

# 对标 codex_mcp::MCP_TOOL_CODEX_APPS_META_KEY(工具 meta 中承载 codex-apps 元数据的键)。
MCP_TOOL_CODEX_APPS_META_KEY: str = "codex_apps"


# ===========================================================================
# 第一部分:mcp_openai_file.rs 纯算法移植
# ===========================================================================


@dataclass
class UploadedFile:
    """对标 Rust `upload_openai_file` 成功返回的已上传文件描述。"""

    download_url: str
    file_id: str
    mime_type: Optional[str] = None
    file_name: Optional[str] = None


@runtime_checkable
class Uploader(Protocol):
    """上传本地文件到 OpenAI 文件存储的回调(服务端 API 调用层的抽象边界)。

    对标 Rust `build_uploaded_argument_value` 内部的 `upload_openai_file` 调用,
    及其前置的鉴权 / 沙箱 / 文件系统读取。移植时把这部分强耦合逻辑外置,
    测试可注入伪实现,生产侧再接真实 HTTP 客户端。
    """

    async def __call__(
        self, field_name: str, index: Optional[int], file_path: str
    ) -> UploadedFile:
        """上传单个文件,返回其远端描述。

        Args:
            field_name: 声明的文件输入字段名(用于错误上下文)。
            index: 数组形状下的下标;标量时为 None。
            file_path: 待上传的本地文件路径。

        Returns:
            上传成功后的 `UploadedFile`。
        """
        ...


def _split_path_segments(file_path: str) -> list[str]:
    """跨平台路径分段(同时按 `/` 与 `\\` 切分),供文件名兜底推断使用。

    对标 Rust `PathConvention::path_segments` 的跨平台语义:
    末非空段即文件名候选。
    """
    return [seg for seg in file_path.replace("\\", "/").split("/")]


def infer_upload_file_name(
    file_path: str,
    split_path_segments: Optional[Callable[[str], list[str]]] = None,
) -> str:
    """从文件路径推断上传文件名(纯算法,对标 Rust basename 兜底逻辑)。

    跨平台实现:直接按分隔符取「末非空段」作为文件名候选(base),与 Rust 的
    `PathUri::basename` 语义一致(不使用 `os.path.basename`,避免 Windows 把
    `:` 误判为盘符分隔符)。可注入自定义分段函数以模拟不同路径约定。

    规则:
    1. 分段后取末非空段;
    2. 都没有 → 兜底 "file"。

    Args:
        file_path: 本地文件路径。
        split_path_segments: 可选的自定义分段函数(默认跨平台分段)。

    Returns:
        推断出的文件名字符串。
    """
    if split_path_segments is not None:
        segs = [s for s in split_path_segments(file_path) if s]
    else:
        segs = [s for s in _split_path_segments(file_path) if s]
    if segs:
        return segs[-1]
    return "file"


def check_file_size_limit(
    size: int,
    limit_bytes: int = OPENAI_FILE_UPLOAD_LIMIT_BYTES,
) -> Optional[str]:
    """检查文件是否超过上传上限(纯算法,对标 Rust 大小判定)。

    Args:
        size: 文件字节数。
        limit_bytes: 上限字节数(默认 OPENAI_FILE_UPLOAD_LIMIT_BYTES)。

    Returns:
        超限时返回可读错误字符串;未超限返回 None。
    """
    if size > limit_bytes:
        return (
            f"file is too large: {size} bytes exceeds the limit of "
            f"{limit_bytes} bytes"
        )
    return None


def should_include_optional_field(optional_fields: list[str], field_name: str) -> bool:
    """判断某可选字段是否声明需要纳入载荷(纯算法)。"""
    return field_name in optional_fields


def build_uploaded_payload(
    uploaded: UploadedFile,
    optional_fields: list[str],
) -> dict[str, Any]:
    """根据声明的可选字段构造重写后的参数载荷(纯算法)。

    对标 Rust `build_uploaded_argument_value` 末尾的 payload 组装:
    - download_url / file_id 始终包含;
    - mime_type 仅在「声明需要」且上传结果确实携带时纳入;
    - file_name 仅在「声明需要」时纳入(上传结果恒有 file_name)。

    Args:
        uploaded: 上传结果描述。
        optional_fields: 该字段声明的可选子字段列表。

    Returns:
        重写后的参数载荷 dict。
    """
    payload: dict[str, Any] = {
        "download_url": uploaded.download_url,
        "file_id": uploaded.file_id,
    }
    if should_include_optional_field(optional_fields, "mime_type"):
        if uploaded.mime_type is not None:
            payload["mime_type"] = uploaded.mime_type
    if should_include_optional_field(optional_fields, "file_name"):
        payload["file_name"] = uploaded.file_name
    return payload


async def rewrite_argument_value_for_openai_files(
    value: Any,
    field_name: str,
    optional_fields: list[str],
    uploader: Uploader,
) -> Optional[Any]:
    """重写单个参数值中的文件引用(纯编排,对标同名 Rust 函数)。

    支持两种形状:
    - 字符串:单个本地路径 → 上传 → 载荷;
    - 数组:每个元素须为字符串路径 → 逐个上传 → 载荷数组;
    其它形状返回 None(保持不变)。

    Args:
        value: 原始参数值(字符串或数组)。
        field_name: 字段名(错误上下文)。
        optional_fields: 该字段声明的可选子字段。
        uploader: 上传回调。

    Returns:
        重写后的载荷或载荷数组;无法重写返回 None。
    """
    if isinstance(value, str):
        uploaded = await uploader(field_name, None, value)
        return build_uploaded_payload(uploaded, optional_fields)
    if isinstance(value, list):
        rewritten: list[Any] = []
        for index, item in enumerate(value):
            if not isinstance(item, str):
                return None
            uploaded = await uploader(field_name, index, item)
            rewritten.append(build_uploaded_payload(uploaded, optional_fields))
        return rewritten
    return None


async def rewrite_mcp_tool_arguments_for_openai_files(
    arguments: Optional[dict[str, Any]],
    openai_file_input_fields: Optional[dict[str, list[str]]],
    uploader: Uploader,
) -> Optional[dict[str, Any]]:
    """重写 MCP 工具参数中的文件输入字段(纯编排,对标同名 Rust 函数)。

    对标 Rust 顶层入口:遍历 `openai_file_input_fields` 声明,把对应字段的
    本地路径重写为远端文件载荷;若一个字段都没变化则原样返回,保持引用语义。

    Args:
        arguments: 工具原始参数字典(可为 None)。
        openai_file_input_fields: 字段名 → 可选子字段列表 的声明映射(可为 None)。
        uploader: 上传回调。

    Returns:
        重写后的参数字典;未声明时原样返回 arguments;arguments 为 None 返回 None。
    """
    if openai_file_input_fields is None:
        return arguments
    if arguments is None:
        return None
    if not isinstance(arguments, dict):
        return arguments

    rewritten: dict[str, Any] = dict(arguments)
    changed = False
    for field_name, optional_fields in openai_file_input_fields.items():
        if field_name not in arguments:
            continue
        value = arguments[field_name]
        uploaded = await rewrite_argument_value_for_openai_files(
            value, field_name, optional_fields, uploader
        )
        if uploaded is None:
            continue
        rewritten[field_name] = uploaded
        changed = True

    if not changed:
        return arguments
    return rewritten


# ===========================================================================
# 第二部分:connectors.rs 纯规则移植(合并进本文件,已在模块头注明)
# ===========================================================================


class ToolSuggestDiscoverableType(str, Enum):
    """对标 codex_config::types::ToolSuggestDiscoverableType(仅取 Connector 判定所需)。"""

    CONNECTOR = "connector"


@dataclass(frozen=True)
class ToolSuggestDiscoverable:
    """对标 config.tool_suggest.discoverables 中的单项(纯数据)。"""

    kind: str  # ToolSuggestDiscoverableType 的字符串值
    id: str


@dataclass(frozen=True)
class DisabledTool:
    """对标 config.tool_suggest.disabled_tools 中的单项(纯数据)。"""

    kind: str
    id: str


def compute_tool_suggest_connector_ids(
    discoverables: list[ToolSuggestDiscoverable],
    disabled_tools: list[DisabledTool],
    loaded_plugin_app_connector_ids: list[str],
) -> set[str]:
    """计算 tool_suggest 应暴露的连接器 id 集合(纯规则)。

    对标 Rust `tool_suggest_connector_ids`:
    1. 起始于已加载插件声明的连接器 id;
    2. 并入 config.tool_suggest.discoverables 中 kind==Connector 的 id;
    3. 剔除 config.tool_suggest.disabled_tools 中 kind==Connector 的 id。

    Args:
        discoverables: 配置中声明的可发现项。
        disabled_tools: 配置中禁用的工具。
        loaded_plugin_app_connector_ids: 已加载插件声明的连接器 id。

    Returns:
        最终应暴露的连接器 id 集合。
    """
    connector_ids: set[str] = set(loaded_plugin_app_connector_ids)
    connector_ids.update(
        d.id
        for d in discoverables
        if d.kind == ToolSuggestDiscoverableType.CONNECTOR.value
    )
    disabled_connector_ids = {
        d.id
        for d in disabled_tools
        if d.kind == ToolSuggestDiscoverableType.CONNECTOR.value
    }
    connector_ids.difference_update(disabled_connector_ids)
    return connector_ids


@dataclass
class McpToolInfo:
    """对标 codex_mcp::ToolInfo 中和暴露规则相关的字段(纯数据)。"""

    server_name: str
    connector_id: Optional[str] = None
    connector_name: Optional[str] = None
    namespace_description: Optional[str] = None
    plugin_display_names: list[str] = field(default_factory=list)
    meta: Optional[dict[str, Any]] = None


@dataclass
class AppInfo:
    """对标 codex_connectors::AppInfo(可见连接器记录,纯数据)。"""

    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    plugin_display_names: list[str] = field(default_factory=list)


def is_synthetic_link_tool(tool: McpToolInfo) -> bool:
    """判断工具是否为合成入口链接(纯规则,对标 Rust synthetic_link 过滤)。

    规则:工具 meta 中 `MCP_TOOL_CODEX_APPS_META_KEY` 子对象的 `synthetic_link`
    为 true 时视为合成链接(应被剔除,它只是入口而非真实连接器工具)。
    """
    meta = tool.meta
    if not isinstance(meta, dict):
        return False
    apps_meta = meta.get(MCP_TOOL_CODEX_APPS_META_KEY)
    if not isinstance(apps_meta, dict):
        return False
    return apps_meta.get("synthetic_link") is True


def filter_non_synthetic_tools(tools: list[McpToolInfo]) -> list[McpToolInfo]:
    """剔除合成入口链接工具(纯规则,对标 Rust accessible_connectors_for_app_list)。"""
    return [t for t in tools if not is_synthetic_link_tool(t)]


def collect_accessible_connectors(
    tools: list[McpToolInfo],
    server_name: str = CODEX_APPS_MCP_SERVER_NAME,
) -> list[AppInfo]:
    """按 server_name + connector_id 聚合可见连接器(纯规则)。

    对标 Rust `collect_accessible_connectors_from_mcp_tools`:
    - 仅纳入 `server_name == CODEX_APPS_MCP_SERVER_NAME` 且 `connector_id` 非空的工;
    - 按 connector_id 分组,聚合 name / description(首见)/
      plugin_display_names(去重合并)。

    Args:
        tools: 候选 MCP 工具列表。
        server_name: 目标 server 名(默认 codex-apps)。

    Returns:
        聚合后的 AppInfo 列表(按首次出现顺序)。
    """
    order: list[str] = []
    by_id: dict[str, AppInfo] = {}

    for tool in tools:
        if tool.server_name != server_name:
            continue
        connector_id = tool.connector_id
        if not connector_id:
            continue
        if connector_id not in by_id:
            order.append(connector_id)
            by_id[connector_id] = AppInfo(
                id=connector_id,
                name=tool.connector_name,
                description=tool.namespace_description,
                plugin_display_names=list(tool.plugin_display_names),
            )
        else:
            existing = by_id[connector_id]
            for pname in tool.plugin_display_names:
                if pname not in existing.plugin_display_names:
                    existing.plugin_display_names.append(pname)

    return [by_id[cid] for cid in order]


def accessible_connectors_for_app_list(
    tools: list[McpToolInfo],
    server_name: str = CODEX_APPS_MCP_SERVER_NAME,
) -> list[AppInfo]:
    """先剔除合成链接,再聚合可见连接器(对标 Rust 同名入口)。"""
    return collect_accessible_connectors(filter_non_synthetic_tools(tools), server_name)


@dataclass
class PluginSourceContext:
    """对标 codex_mcp::ToolPluginContext(纯查询,不持连接)。"""

    _map: dict[str, list[str]] = field(default_factory=dict)

    def plugin_display_names_for_connector_id(self, connector_id: str) -> list[str]:
        return list(self._map.get(connector_id, []))


def with_app_plugin_sources(
    connectors: list[AppInfo],
    plugin_context: PluginSourceContext,
) -> list[AppInfo]:
    """用插件来源信息回填每个连接器的 plugin_display_names(纯规则)。

    对标 Rust `with_app_plugin_sources`:就地覆盖每个 AppInfo 的
    plugin_display_names 为插件上下文提供的值。
    """
    for connector in connectors:
        connector.plugin_display_names = plugin_context.plugin_display_names_for_connector_id(
            connector.id
        )
    return connectors


class ApprovalsReviewer(str, Enum):
    """审批复核人档位(对标 codex_config::types::ApprovalsReviewer)。

    档位:UNSPECIFIED(未指定) / NEVER(永不) / ALWAYS(总是) / AUTO_REVIEW(自动复核)。
    """

    UNSPECIFIED = "unspecified"
    NEVER = "never"
    ALWAYS = "always"
    AUTO_REVIEW = "auto_review"


# 严格度(数值越大越严格),仅用于"上限"比较;UNSPECIFIED 在 can_set 中特判为放行。
_APPROVALS_REVIEWER_RANK: dict[ApprovalsReviewer, int] = {
    ApprovalsReviewer.NEVER: 0,
    ApprovalsReviewer.ALWAYS: 1,
    ApprovalsReviewer.AUTO_REVIEW: 2,
}


@dataclass
class Requirements:
    """对标 codex_config::ConfigLayerStack::requirements(仅取审批判定所需)。"""

    auto_review_models: frozenset[str] = field(default_factory=frozenset)
    # 配置施加的审批档位「上限」(默认 UNSPECIFIED = 不限制,任何档位均可设置)。
    approvals_reviewer: ApprovalsReviewer = ApprovalsReviewer.UNSPECIFIED

    def auto_review_required_for_model(self, model: Optional[str]) -> bool:
        return model is not None and model in self.auto_review_models

    def can_set(self, reviewer: ApprovalsReviewer) -> bool:
        """配置上限是否允许设置给定档位的审批复核人。

        UNSPECIFIED(未指定)视为无约束,一律放行;否则仅允许设置严格度不超过
        该上限的档位(对标 Rust ApprovalsReviewer::can_set 的约束语义)。
        """
        if self.approvals_reviewer == ApprovalsReviewer.UNSPECIFIED:
            return True
        return (
            _APPROVALS_REVIEWER_RANK[reviewer]
            <= _APPROVALS_REVIEWER_RANK[self.approvals_reviewer]
        )


@dataclass
class _LinkConfig:
    approvals_reviewer: Optional[ApprovalsReviewer] = None


@dataclass
class _AppConfig:
    approvals_reviewer: Optional[ApprovalsReviewer] = None
    links: Optional[dict[str, _LinkConfig]] = None


@dataclass
class _AppsConfig:
    apps: dict[str, _AppConfig] = field(default_factory=dict)
    default: Optional[_AppConfig] = None


def resolve_approvals_reviewer(
    requirements: Requirements,
    default_reviewer: ApprovalsReviewer,
    model: Optional[str],
    apps_config: Optional[_AppsConfig],
    server_name: str,
    connector_id: Optional[str],
    link_id: Optional[str],
) -> ApprovalsReviewer:
    """解析最终审批复核人(纯规则,对标 Rust mcp_approvals_reviewer_from_layers)。

    回退链:
    1. 若 model 命中「强制自动复核」模型 → AUTO_REVIEW;
    2. 否则若 server 是 codex-apps,从 apps 配置按
       link → app → default 顺序取 app 级审批档位;
    3. 若取到的档位被配置约束 can_set 允许 → 用之;
    4. 否则回退到 default_reviewer。

    Args:
        requirements: 配置约束(含强制自动复核模型与审批档位上限)。
        default_reviewer: 默认审批档位。
        model: 当前模型名。
        apps_config: 解析后的 apps 配置(可为 None)。
        server_name: MCP server 名。
        connector_id: 连接器 id(可为 None)。
        link_id: 链接 id(可为 None)。

    Returns:
        最终生效的审批复核人档位。
    """
    if requirements.auto_review_required_for_model(model):
        return ApprovalsReviewer.AUTO_REVIEW

    app_reviewer: Optional[ApprovalsReviewer] = None
    if server_name == CODEX_APPS_MCP_SERVER_NAME and apps_config is not None:
        app = apps_config.apps.get(connector_id) if connector_id else None
        link_reviewer: Optional[ApprovalsReviewer] = None
        if (
            link_id is not None
            and app is not None
            and app.links is not None
        ):
            link = app.links.get(link_id)
            if link is not None:
                link_reviewer = link.approvals_reviewer
        if link_reviewer is not None:
            app_reviewer = link_reviewer
        elif app is not None and app.approvals_reviewer is not None:
            app_reviewer = app.approvals_reviewer
        elif apps_config.default is not None:
            app_reviewer = apps_config.default.approvals_reviewer

    if app_reviewer is not None and requirements.can_set(app_reviewer):
        return app_reviewer

    return default_reviewer


# ---------------------------------------------------------------------------
# 可见连接器缓存(对标 Rust ACCESSIBLE_CONNECTORS_CACHE 全局静态 + TTL)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AccessibleConnectorsCacheKey:
    """缓存键(对标 Rust AccessibleConnectorsCacheKey)。"""

    chatgpt_base_url: str
    account_id: Optional[str] = None
    chatgpt_user_id: Optional[str] = None
    is_workspace_account: bool = False


@dataclass
class _CachedEntry:
    key: AccessibleConnectorsCacheKey
    expires_at: float
    connectors: list[AppInfo]


class AccessibleConnectorsCache:
    """进程内可见连接器 TTL 缓存(对标 Rust 全局静态 + CONNECTORS_CACHE_TTL)。

    为便于单测与避免全局可变状态,实现为可实例化的类;`now` 由调用方注入,
    默认取 `time.time()`。仅在未过期且键相等时命中。
    """

    def __init__(self, ttl_seconds: int = CONNECTORS_CACHE_TTL_SECONDS) -> None:
        self._ttl_seconds = ttl_seconds
        self._entry: Optional[_CachedEntry] = None

    def read(
        self, key: AccessibleConnectorsCacheKey, now: Optional[float] = None
    ) -> Optional[list[AppInfo]]:
        now = time.time() if now is None else now
        entry = self._entry
        if entry is None:
            return None
        if now >= entry.expires_at:
            self._entry = None
            return None
        if entry.key != key:
            return None
        # 返回副本,避免外部修改污染缓存。
        return [AppInfo(**vars(c)) for c in entry.connectors]

    def write(
        self,
        key: AccessibleConnectorsCacheKey,
        connectors: list[AppInfo],
        now: Optional[float] = None,
    ) -> None:
        now = time.time() if now is None else now
        self._entry = _CachedEntry(
            key=key,
            expires_at=now + self._ttl_seconds,
            connectors=[AppInfo(**vars(c)) for c in connectors],
        )


def build_accessible_connectors_cache_key(
    chatgpt_base_url: str,
    auth: Optional[dict[str, Any]] = None,
) -> AccessibleConnectorsCacheKey:
    """从配置 + 鉴权构造缓存键(纯规则,对标 Rust accessible_connectors_cache_key)。

    Args:
        chatgpt_base_url: 配置中的 ChatGPT base url。
        auth: 鉴权信息字典,可含 account_id / chatgpt_user_id /
            is_workspace_account 字段(缺省视为 None / False)。

    Returns:
        缓存键实例。
    """
    auth = auth or {}
    return AccessibleConnectorsCacheKey(
        chatgpt_base_url=chatgpt_base_url,
        account_id=auth.get("account_id"),
        chatgpt_user_id=auth.get("chatgpt_user_id"),
        is_workspace_account=bool(auth.get("is_workspace_account", False)),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
