# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A Agent Card(发现文档)构建。

「Agent 全面开放工程」O11 落地(2026-09-20):让**别的** agent 框架按 A2A 规范
(Agent2Agent Protocol,§5.5 AgentCard / §8.3 发现)发现本项目。

设计三原则:
1. **不虚报**:`skills[]` 只收录「同时满足」以下条件的能力 ——
   ① 已登记在能力目录 `packages/types/generated/capabilities.json` 的 scope;
   ② 该 scope 下**至少一个工具真实注册**在 MCP 执行面(`mcp_server._TOOLS`);
   ③ `thirdPartyEligible=true` 且 `dataClass != "platform"`(与 capability_gate 对
      外部/机器凭据的放行口径一致 —— 门禁走不通的能力写进卡片即是虚报)。
   清单缺失/解析失败 → `skills=[]`(fail-closed),宁缺不假。
2. **不泄露**:卡片只出现「由请求 Host 推导的对外基址」或「配置的公网域名」,
   绝不输出内网主机/端口/密钥。Host 判定**复用** `mcp_export` 的白名单语义
   (`validate_request_host` + `allowed_request_hosts` + `request_host_of`),
   不另起一套。
3. **如实声明偏差**:本服务任务面是 IHUI 原生 REST(非 A2A 标准 JSON-RPC 报文),
   无流式 / 无 push 回调 / 无状态历史 —— 全部以 `false` 声明,并把真实路径清单
   写进 `capabilities.extensions[]`(required=true),而不是假装兼容。
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Final

from app import __version__ as APP_VERSION
from app.core.config import settings

from .capability_gate import CapabilityManifest, load_capability_manifest, manifest_file

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量(对外声明字段的唯一真相源)
# ---------------------------------------------------------------------------

# A2A 协议版本(卡片结构按此版本 §5.5 校验)
PROTOCOL_VERSION: Final = "0.3.0"
# 本 Agent 的 HTTP 入口:POST 建单端点(A2A 的 url 字段语义 = 任务入口)
TASKS_PATH: Final = "/api/a2a/tasks"
TASK_STATUS_PATH: Final = "/api/a2a/tasks/{taskId}/status"
TASK_RESULT_PATH: Final = "/api/a2a/tasks/{taskId}/result"
# 三种标准 transport(JSONRPC / GRPC / HTTP+JSON)中,本服务只提供"HTTP 传 JSON"
# 这一种形态;报文结构与标准 HTTP+JSON transcodding 的差异由 extensions[] 如实声明。
PREFERRED_TRANSPORT: Final = "HTTP+JSON"
# 原生 REST 任务面扩展(告知客户端真实路径与"必须轮询"约束)
NATIVE_TASK_API_EXTENSION_URI: Final = "urn:ihui:a2a:native-task-api:v1"
# 组织信息:固定为**公开站点**(不得出现内网主机)
PROVIDER_ORGANIZATION: Final = "IHUI AI (智汇AI)"
PROVIDER_URL: Final = "https://aizhs.top"

DEFAULT_INPUT_MODES: Final[tuple[str, ...]] = ("application/json",)
DEFAULT_OUTPUT_MODES: Final[tuple[str, ...]] = ("application/json",)

AGENT_DESCRIPTION: Final = (
    "IHUI AI 平台的 A2A 任务面:接收 JSON 任务(目标 + 输入),在服务端以 agent 循环"
    "执行并可跨服务派发到已注册 agent 的 endpoint,客户端轮询状态与结果。"
    "安全:全部任务端点要求凭据(IHUI JWT 或内网 X-IHUI-Principal),并按任务归属隔离"
    "(非管理员只能读自己创建的任务)。skills[] 逐项对应服务端已注册且对该调用方可放行"
    "的能力,未实现的能力不会出现在清单中。"
)

# 任务面能力 scope(A2A 任务端点自身所需 scope,与 skill 清单同源)
SCOPE_TASK_CALL: Final = "agents:call"
SCOPE_TASK_READ: Final = "agents:read"

# 安全方案名(securitySchemes 的键,security[] 按名引用)
SECURITY_SCHEME_BEARER: Final = "bearerAuth"
SECURITY_SCHEME_INTERNAL: Final = "ihuiInternalPrincipal"


class PublicBaseUrlError(RuntimeError):
    """无法从请求安全推导出对外基址:Host 非白名单且未配置任何公网域名。

    此时**不得**回落成请求头里的任意 Host(会变成内网主机/端口的放大器),
    调用方应直接 403 拒答。
    """

    def __init__(self, host: str) -> None:
        super().__init__(f"请求 Host {host!r} 非回环且不在白名单,且未配置公网域名可回落")
        self.host = host


# ---------------------------------------------------------------------------
# 真实可执行能力派生
# ---------------------------------------------------------------------------


def registered_tool_names() -> frozenset[str]:
    """真实注册在 MCP 执行面的工具名集合(skill 的"可执行"判据)。

    延迟 import:`mcp_server` 是 9k 行大模块,且 a2a 侧已经通过 agent_loop 传递依赖
    它,放在函数内既避免顶层环路,也让"清单缺失即无 skills"这条路径不付出导入成本。
    """
    from .mcp_server import _TOOLS

    return frozenset(tool.name for tool in _TOOLS)


def _scope_meta_index(path: Path) -> dict[str, dict[str, Any]]:
    """从能力清单原文按 scope 建索引(只取展示字段 domain/description)。

    `capability_gate.CapabilityManifest` 有意不保留 description/domain(门禁不需要),
    而 AgentSkill.description 是必填项且**必须**来自清单原文(不得自造文案),
    故此处单独读一次同一文件;任何读取失败一律返回空表(降级为不虚报)。
    """
    try:
        raw: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError) as e:
        logger.warning("[agent_card] 能力清单原文读取失败(%s): %s", path, type(e).__name__)
        return {}
    if not isinstance(raw, dict):
        return {}
    data: dict[str, Any] = dict(raw)
    entries = data.get("capabilities")
    if not isinstance(entries, list):
        return {}
    index: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        item: dict[str, str | Any] = dict(entry)
        scope = item.get("scope")
        if isinstance(scope, str) and scope:
            index.setdefault(scope, item)
    return index


def _is_advertisable(scope: str, data_class: str, third_party_eligible: bool) -> bool:
    """该 scope 是否允许写进对外发现文档(与 capability_gate 放行口径对齐)。"""
    if not third_party_eligible or data_class == "platform":
        return False
    # 通配/内部保留 scope 名一律不进卡片
    return "*" not in scope


def _skill_name(scope: str) -> str:
    """scope → 人类可读技能名(files:read → Files Read),纯字面派生不自造语义。"""
    return " ".join(part.replace("-", " ").title() for part in scope.split(":"))


def build_skills(
    manifest: CapabilityManifest | None = None,
    tool_names: frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    """派生 skills 清单:scope(能力目录)× 工具(真实注册)× 放行口径(第三方适配)。

    返回按 scope 排序,保证输出确定性(卡片可被逐字节比对/缓存)。
    """
    if manifest is None:
        manifest = load_capability_manifest()
    if manifest is None:
        logger.warning("[agent_card] 能力清单缺失,agent-card skills 降级为空(fail-closed)")
        return []
    if tool_names is None:
        tool_names = registered_tool_names()
    meta_index = _scope_meta_index(manifest_file())

    skills: list[dict[str, Any]] = []
    for scope in sorted(manifest.scope_meta):
        meta = manifest.scope_meta[scope]
        if not _is_advertisable(scope, meta.data_class, meta.third_party_eligible):
            continue
        # 该 scope 下**真实注册**的工具:由 toolScopeMap 反查再与 _TOOLS 求交,
        # 保证 skill 声称的工具在进程内确实可执行。
        tools = sorted(name for name, owner in manifest.tool_scope.items() if owner == scope and name in tool_names)
        if not tools:
            continue
        entry = meta_index.get(scope) or {}
        raw_desc = entry.get("description")
        description = raw_desc if isinstance(raw_desc, str) and raw_desc.strip() else f"{scope} 能力"
        domain = entry.get("domain")
        tags = [scope, domain if isinstance(domain, str) and domain else "general", meta.data_class, meta.risk, *tools]
        skills.append({"id": scope, "name": _skill_name(scope), "description": description, "tags": tags})
    return skills


# ---------------------------------------------------------------------------
# Agent Card
# ---------------------------------------------------------------------------


def security_schemes() -> dict[str, Any]:
    """如实声明两种凭据通道(与 capability_gate 实际接受的形态一一对应)。"""
    return {
        SECURITY_SCHEME_BEARER: {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": (
                "IHUI access token(HS256 JWT,由 apps/api 签发,与 ai-service 共享 "
                "JWT_SECRET)。放在 Authorization: Bearer <token>。"
            ),
        },
        SECURITY_SCHEME_INTERNAL: {
            "type": "apiKey",
            "in": "header",
            "name": "X-IHUI-Principal",
            "description": (
                "内网可信主体头:v1.<base64url(json)>.<HMAC-SHA256 hex>,仅服务间调用"
                "(apps/api → ai-service)可用;API key 不能直连本服务。"
            ),
        },
    }


def build_agent_card(base_url: str) -> dict[str, Any]:
    """构建对外 Agent Card。

    Args:
        base_url: 对外基址(scheme://host[:port]),由 `resolve_public_base_url`
            从请求 Host 或配置白名单域名推导,不含内网信息。
    """
    root = base_url.rstrip("/")
    # 注:报文里的花括号刻意放在**非 f-string** 片段中,避免 {{}} 转义与真实花括号混淆
    native_api_description = (
        f"IHUI 原生 REST 任务面(报文非 A2A 标准 JSON-RPC/HTTP+JSON 转码):"
        f"POST {TASKS_PATH} 建单,请求体 "
        "{name, description, input, assigned_agent_id},响应任务对象 "
        "{id, name, agent_id, input, status, result, error, created_at, updated_at};"
        f"轮询 GET {TASK_STATUS_PATH};取结果 GET {TASK_RESULT_PATH}。"
        "任务按调用者(principal.sub)归属,非管理员读取他人任务返回 403。"
    )
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "name": settings.app_name,
        "description": AGENT_DESCRIPTION,
        "url": f"{root}{TASKS_PATH}",
        "preferredTransport": PREFERRED_TRANSPORT,
        "version": APP_VERSION,
        "provider": {"organization": PROVIDER_ORGANIZATION, "url": PROVIDER_URL},
        "capabilities": {
            # 无 SSE/WebSocket:客户端必须轮询 status(见 extensions 说明)
            "streaming": False,
            # 无服务端主动回调:不声明 pushNotificationConfig 端点
            "pushNotifications": False,
            # 任务只保留最新状态,不返回历史状态数组
            "stateTransitionHistory": False,
            "extensions": [
                {
                    "uri": NATIVE_TASK_API_EXTENSION_URI,
                    "required": True,
                    "description": native_api_description,
                }
            ],
        },
        "defaultInputModes": list(DEFAULT_INPUT_MODES),
        "defaultOutputModes": list(DEFAULT_OUTPUT_MODES),
        "skills": build_skills(),
        "securitySchemes": security_schemes(),
        # 数组元素之间是"或"关系:任一凭据通道通过即可
        "security": [{SECURITY_SCHEME_BEARER: []}, {SECURITY_SCHEME_INTERNAL: []}],
    }


# ---------------------------------------------------------------------------
# 对外基址推导(复用 mcp_export 的 Host 白名单语义)
# ---------------------------------------------------------------------------


def _forwarded_scheme(headers: Mapping[str, str]) -> str:
    """反代场景下的原始协议:取 X-Forwarded-Proto 首值,仅接受 http/https。"""
    raw = (headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return raw if raw in ("http", "https") else ""


# 可安全回显进 URL 的 Host 字符集(域名/IPv4/带方括号 IPv6 + 单一端口冒号)。
# 含 / ? 空格 等一律视为畸形,回落到"已校验的主机部分"(不带端口)。
_SAFE_HOST_RE: Final = re.compile(r"^[A-Za-z0-9._:\-\[\]]+$")


def _echo_host_with_port(headers: Mapping[str, str], validated_host: str) -> str:
    """校验通过后再决定是否回显原始 Host(带端口);畸形值只回显主机部分。

    取值与 `request_host_of` 同源(x-forwarded-host 优先,多级代理取首段),
    否则反代场景下 host 头是 localhost:8803,会把 forwarded host 的修正抵消掉。
    """
    # 延迟 import:mcp_export 依赖官方 mcp SDK,不应成为卡片构建的导入前提(同 resolve 函数)
    from .mcp_export import raw_forwarded_host

    raw = raw_forwarded_host(headers)
    return raw if raw and _SAFE_HOST_RE.match(raw) else validated_host


def resolve_public_base_url(headers: Mapping[str, str], url_scheme: str = "http") -> str:
    """从请求头推导**可对外公布**的基址,不泄露内网主机/端口。

    规则(与 mcp_export 入口 Host 闸同一套判定函数,不新写逻辑):
    - Host 通过 `validate_request_host`(回环或 `MCP_EXPORT_ALLOWED_HOSTS` 白名单)
      → 原样回显该 Host(回环仅出现在本地开发,值来自调用方自己;保留端口才能
      让本地客户端直接回访);scheme 优先 `X-Forwarded-Proto`,生产环境恒定 https;
    - Host 未通过 → 回落白名单首个公网域名(https),不 echo 伪造 Host;
    - 白名单也为空 → 抛 `PublicBaseUrlError`(拒绝猜测,由路由层 403)。
    """
    # 延迟 import:mcp_export 依赖官方 mcp SDK,不应成为卡片构建的导入前提
    from .mcp_export import allowed_request_hosts, request_host_of, validate_request_host

    allowed = allowed_request_hosts()
    host = request_host_of(headers)
    if validate_request_host(host, allowed):
        scheme = "https" if settings.node_env == "production" else (_forwarded_scheme(headers) or url_scheme)
        return f"{scheme}://{_echo_host_with_port(headers, host)}"
    if allowed:
        return f"https://{allowed[0]}"
    raise PublicBaseUrlError(host)


__all__ = [
    "NATIVE_TASK_API_EXTENSION_URI",
    "PROTOCOL_VERSION",
    "PublicBaseUrlError",
    "SCOPE_TASK_CALL",
    "SCOPE_TASK_READ",
    "TASKS_PATH",
    "build_agent_card",
    "build_skills",
    "registered_tool_names",
    "resolve_public_base_url",
    "security_schemes",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
