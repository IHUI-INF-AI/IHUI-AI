# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理能力边界:工具白名单 + 是否可再派发(默认最小权限,2026-11-07 立)。

为什么要独立于 `subagent_spawn_policy`:
  那个模块解决的是"**调用方给了名单**时怎么与父线程名单取并集",语义是"省略
  名单 = 沿用父级默认权限"。它回答不了"这个子代理**能拿哪些工具**"和"它**能
  不能再派子代理**"——这两件事没有任何声明面,派发方只能靠约定。
  本模块补上声明面与统一校验入口,并采用更严的一档(与 `subagent_spawn_policy`
  文档里"本仓按更严的一档落地"同一取向):

  ① **默认最小权限**:没有显式声明的子代理 → 白名单为空(一个工具都不授权)、
     ``can_be_sub_agent=False``;不存在"没声明就继承父级"的隐含提权。
  ② **白名单是硬边界**:请求的工具不在白名单 → 拒绝(code=``tool_not_whitelisted``),
     不降级、不部分放行。
  ③ **再派发是显式开关**:``can_be_sub_agent=False`` 的子代理发起任何子代理派发
     → 拒绝(code=``spawn_forbidden``)。
  ④ **拒绝必留痕**:每次拒绝都写既有审计面(`audit_log`)与既有编排事件总线
     (`orchestration_hub`,`subagent.*` 族的新子类型),回执带失败原因;留痕面
     故障只告警,不回滚拒绝(拒绝是纯函数判定的)。

声明来源优先级(后者仅在前者未声明时兜底):
  ``显式声明(registry)`` > ``AgentDefinition 自带 tools/metadata`` > ``默认拒绝``。
  AgentDefinition 的 ``tools`` 本来就是这个 agent 声明过的工具面,复用它不会把
  既有的 agent 一夜之间收窄成"零工具";而注册表里查不到的 agent 一律按默认拒绝。
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

logger = logging.getLogger(__name__)

CapabilitySource = Literal["declared", "agent_definition", "default_deny"]

# 拒绝原因码(封闭集)。读侧遇到未知值一律按拒绝处理(fail-closed)。
DENIAL_CODES: tuple[str, ...] = (
    "tool_not_whitelisted",  # 请求的工具不在白名单
    "spawn_forbidden",       # 子代理未被授权再派发
    "invalid_tool_request",  # 工具请求形态非法(不是字符串数组)
)

# 事件子类型:复用既有 `subagent.*` 族(D121:禁新开 SSE 帧族)。
TEAM_CAPABILITY_EVENT_TYPE = "subagent.capability_denied"
# 审计动作名(落 `audit_log` 的操作级审计面)。
TEAM_CAPABILITY_AUDIT_ACTION = "subagent.capability_denied"


class CapabilityDeclarationError(ValueError):
    """能力声明非法(名单不是字符串数组 / 开关不是布尔)。不猜、不修正。"""

    def __init__(self, field: str, detail: str = "") -> None:
        self.field = field
        self.detail = detail
        super().__init__(detail or field)


# =============================================================================
# 声明模型
# =============================================================================


@dataclass(frozen=True)
class SubagentCapability:
    """一个子代理的能力边界声明。

    字段默认值即"最小权限":空白名单 + 不可再派发。这不是"暂未配置",而是
    **没有声明时的确定语义**——任何提权都必须落在一次显式声明上。
    """

    allowed_tools: tuple[str, ...] = ()
    can_be_sub_agent: bool = False

    @classmethod
    def from_dict(cls, raw: Any) -> SubagentCapability:
        if not isinstance(raw, dict):
            raise CapabilityDeclarationError("capability", "能力声明必须是对象")
        raw_tools = raw.get("allowed_tools", raw.get("allowedTools"))
        tools: tuple[str, ...] = ()
        if raw_tools is not None:
            if not isinstance(raw_tools, list):
                raise CapabilityDeclarationError("allowed_tools", "必须是字符串数组")
            names: list[str] = []
            for item in raw_tools:
                if not isinstance(item, str) or not item.strip():
                    raise CapabilityDeclarationError("allowed_tools", "元素必须是非空字符串")
                names.append(item.strip())
            tools = tuple(dict.fromkeys(names))
        raw_spawn = raw.get("can_be_sub_agent", raw.get("canBeSubAgent", False))
        if not isinstance(raw_spawn, bool):
            raise CapabilityDeclarationError("can_be_sub_agent", "必须是布尔值")
        return cls(allowed_tools=tools, can_be_sub_agent=raw_spawn)

    def to_dict(self) -> dict[str, Any]:
        return {
            "allowed_tools": list(self.allowed_tools),
            "can_be_sub_agent": self.can_be_sub_agent,
        }


@dataclass(frozen=True)
class ResolvedCapability:
    """解析后的生效能力(带来源,便于回答"这条权限从哪来")。"""

    agent: str
    allowed_tools: tuple[str, ...]
    can_be_sub_agent: bool
    source: CapabilitySource

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "allowed_tools": list(self.allowed_tools),
            "can_be_sub_agent": self.can_be_sub_agent,
            "source": self.source,
        }


DEFAULT_CAPABILITY = SubagentCapability()


# =============================================================================
# 声明表(进程内)
# =============================================================================


class SubagentCapabilityRegistry:
    """显式能力声明表。未声明的 agent 由 ``resolve`` 按默认最小权限处理。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._declared: dict[str, SubagentCapability] = {}

    def declare(self, agent: str, capability: SubagentCapability) -> ResolvedCapability:
        name = agent.strip()
        if not name:
            raise CapabilityDeclarationError("agent", "agent 名不能为空")
        with self._lock:
            self._declared[name] = capability
        return ResolvedCapability(
            agent=name,
            allowed_tools=capability.allowed_tools,
            can_be_sub_agent=capability.can_be_sub_agent,
            source="declared",
        )

    def remove(self, agent: str) -> bool:
        with self._lock:
            return self._declared.pop(agent, None) is not None

    def declared(self, agent: str) -> SubagentCapability | None:
        with self._lock:
            return self._declared.get(agent)

    def clear(self) -> None:
        """测试与热重载用:清空全部显式声明(不影响 AgentDefinition 兜底)。"""
        with self._lock:
            self._declared.clear()

    def snapshot(self) -> dict[str, dict[str, Any]]:
        with self._lock:
            return {name: cap.to_dict() for name, cap in sorted(self._declared.items())}


def resolve_capability(
    agent: str,
    *,
    registry: SubagentCapabilityRegistry | None = None,
    declared_tools: Sequence[str] | None = None,
    can_be_sub_agent: bool = False,
) -> ResolvedCapability:
    """解析生效能力:显式声明 > AgentDefinition 兜底 > 默认拒绝。"""
    table = registry or subagent_capabilities
    explicit = table.declared(agent)
    if explicit is not None:
        return ResolvedCapability(
            agent=agent,
            allowed_tools=explicit.allowed_tools,
            can_be_sub_agent=explicit.can_be_sub_agent,
            source="declared",
        )
    if declared_tools is not None:
        # AgentDefinition.tools 是 agent 自己声明过的工具面;metadata 里的
        # can_be_sub_agent 是再派发开关。二者都不是"调用方临时塞的名单"。
        return ResolvedCapability(
            agent=agent,
            allowed_tools=tuple(dict.fromkeys(str(t) for t in declared_tools if str(t))),
            can_be_sub_agent=can_be_sub_agent,
            source="agent_definition",
        )
    return ResolvedCapability(
        agent=agent,
        allowed_tools=DEFAULT_CAPABILITY.allowed_tools,
        can_be_sub_agent=DEFAULT_CAPABILITY.can_be_sub_agent,
        source="default_deny",
    )


# =============================================================================
# 判定与拒绝
# =============================================================================


class CapabilityDenied(RuntimeError):
    """越权请求。``code`` 来自 DENIAL_CODES 封闭集;``detail`` 供模型自纠。

    ``receipt`` 是留痕回执(audit_id / event_id / 失败原因),拒绝原因本身不因
    留痕成败而改变。
    """

    def __init__(self, code: str, agent: str, detail: str = "") -> None:
        self.code = code
        self.agent = agent
        self.detail = detail
        self.receipt: dict[str, Any] = {}
        super().__init__(f"{code}: {agent} {detail}".strip())

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "agent": self.agent,
            "detail": self.detail,
            "receipt": self.receipt,
        }


def evaluate_tool(capability: ResolvedCapability, tool: str) -> str:
    """返回拒绝原因码;空串 = 允许。纯函数,顺序确定。"""
    if not tool:
        return "invalid_tool_request"
    if tool not in capability.allowed_tools:
        return "tool_not_whitelisted"
    return ""


def evaluate_spawn(capability: ResolvedCapability) -> str:
    """返回拒绝原因码;空串 = 允许再派发。"""
    return "" if capability.can_be_sub_agent else "spawn_forbidden"


def evaluate_tool_request(
    capability: ResolvedCapability, requested: object
) -> tuple[list[str], str, str]:
    """批量判定一份工具请求(必须是字符串数组)。

    返回 (合法工具名列表, 首个拒绝码, 触发拒绝的工具名)。全通过时拒绝码为空串。
    """
    if not isinstance(requested, list):
        return [], "invalid_tool_request", f"<{type(requested).__name__}>"
    names: list[str] = []
    for item in requested:
        if not isinstance(item, str) or not item.strip():
            return names, "invalid_tool_request", f"<{type(item).__name__}>"
        code = evaluate_tool(capability, item.strip())
        if code:
            return names, code, item.strip()
        names.append(item.strip())
    return names, "", ""


# =============================================================================
# 留痕面
# =============================================================================

CapabilityEventSink = Callable[[str, dict[str, Any]], Awaitable[str]]
CapabilityAuditRecorder = Callable[[str, str, str, dict[str, Any] | None], str | None]


async def _emit_capability_event(event_type: str, payload: dict[str, Any]) -> str:
    """默认事件出口:既有编排事件总线(惰性 import,避免循环依赖)。"""
    from .orchestration_hub import orchestration_hub

    event_id: str = await orchestration_hub.emit(
        event_type=event_type,
        source_pillar="subagent",
        payload=payload,
    )
    return event_id


def _record_capability_audit(
    action: str, actor: str, target: str, detail: dict[str, Any] | None
) -> str | None:
    """默认审计出口:既有操作级审计面(`audit_log`),返回条目 id。"""
    from .audit_log import record as record_audit

    entry = record_audit(action=action, actor=actor, target=target, detail=detail)
    return entry.id


class SubagentCapabilityGuard:
    """统一校验入口。越权即拒绝 + 留痕;允许则返回可追溯回执。

    拒绝用异常表达(`CapabilityDenied`),调用方没有"拿到 None 继续派发"的路径;
    留痕失败只告警,但把 ``audit_error`` / ``event_error`` 放进回执与异常上下文,
    不假装"已经留痕"。
    """

    def __init__(
        self,
        registry: SubagentCapabilityRegistry | None = None,
        sink: CapabilityEventSink | None = None,
        recorder: CapabilityAuditRecorder | None = None,
    ) -> None:
        self._registry = registry or subagent_capabilities
        self._sink: CapabilityEventSink = sink or _emit_capability_event
        self._recorder: CapabilityAuditRecorder = recorder or _record_capability_audit

    @property
    def registry(self) -> SubagentCapabilityRegistry:
        return self._registry

    def resolve(
        self,
        agent: str,
        *,
        declared_tools: Sequence[str] | None = None,
        can_be_sub_agent: bool = False,
    ) -> ResolvedCapability:
        return resolve_capability(
            agent,
            registry=self._registry,
            declared_tools=declared_tools,
            can_be_sub_agent=can_be_sub_agent,
        )

    def check_tool(
        self,
        capability: ResolvedCapability,
        tool: str,
    ) -> dict[str, Any]:
        """纯判定(不写留痕);拒绝时抛 CapabilityDenied 供调用方转成明确的拒绝回执。"""
        code = evaluate_tool(capability, tool)
        if code:
            raise CapabilityDenied(code=code, agent=capability.agent, detail=f"tool={tool}")
        return {
            "allowed": True,
            "agent": capability.agent,
            "tool": tool,
            "source": capability.source,
        }

    def check_spawn(self, capability: ResolvedCapability) -> dict[str, Any]:
        code = evaluate_spawn(capability)
        if code:
            raise CapabilityDenied(
                code=code,
                agent=capability.agent,
                detail="can_be_sub_agent=false",
            )
        return {
            "allowed": True,
            "agent": capability.agent,
            "action": "spawn_subagent",
            "source": capability.source,
        }

    async def record_denial(
        self, denial: CapabilityDenied, *, action: str = ""
    ) -> dict[str, Any]:
        """把拒绝写进既有审计/追踪面;返回回执(含失败原因)。"""
        detail = {
            **denial.to_dict(),
            "action": action,
            "at": _now_iso(),
        }
        audit_id: str | None = None
        audit_error = ""
        try:
            audit_id = self._recorder(
                TEAM_CAPABILITY_AUDIT_ACTION, "subagent_capabilities", denial.agent, detail
            )
        except Exception as e:  # noqa: BLE001 - 留痕面故障不得吞掉拒绝
            audit_error = str(e)
            logger.warning("[subagent_capabilities] 审计写入失败(拒绝仍生效): %s", e)

        event_id: str | None = None
        event_error = ""
        try:
            event_id = await self._sink(
                TEAM_CAPABILITY_EVENT_TYPE,
                {
                    "team_id": "",
                    "round_id": "",
                    **detail,
                },
            )
        except Exception as e:  # noqa: BLE001
            event_error = str(e)
            logger.warning("[subagent_capabilities] 事件投递失败(拒绝仍生效): %s", e)

        return {
            "audit_id": audit_id,
            "audit_error": audit_error,
            "event_id": event_id,
            "event_error": event_error,
        }

    async def authorize_tool(
        self,
        agent: str,
        tool: str,
        *,
        declared_tools: Sequence[str] | None = None,
        can_be_sub_agent: bool = False,
    ) -> dict[str, Any]:
        """授权一个工具调用;拒绝时先留痕再抛 CapabilityDenied。"""
        capability = self.resolve(
            agent, declared_tools=declared_tools, can_be_sub_agent=can_be_sub_agent
        )
        try:
            receipt = self.check_tool(capability, tool)
        except CapabilityDenied as denial:
            denial.receipt = await self.record_denial(denial, action="tool")
            raise
        return receipt

    async def authorize_spawn(
        self,
        agent: str,
        *,
        declared_tools: Sequence[str] | None = None,
        can_be_sub_agent: bool = False,
    ) -> dict[str, Any]:
        """授权一次嵌套派发;拒绝时先留痕再抛 CapabilityDenied。"""
        capability = self.resolve(
            agent, declared_tools=declared_tools, can_be_sub_agent=can_be_sub_agent
        )
        try:
            return self.check_spawn(capability)
        except CapabilityDenied as denial:
            denial.receipt = await self.record_denial(denial, action="spawn_subagent")
            raise

    async def reject_spawn(
        self, agent: str, detail: str = "can_be_sub_agent=false"
    ) -> CapabilityDenied:
        """无判定、直接拒绝(调用方已确认越权时用);留痕后返回异常对象供 raise。"""
        denial = CapabilityDenied(code="spawn_forbidden", agent=agent, detail=detail)
        denial.receipt = await self.record_denial(denial, action="spawn_subagent")
        return denial


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# 模块级单例(团队编排与路由共用;测试可注入独立 registry/guard)
subagent_capabilities = SubagentCapabilityRegistry()
subagent_capability_guard = SubagentCapabilityGuard(subagent_capabilities)
