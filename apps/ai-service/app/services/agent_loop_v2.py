# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent 工具调用循环 v2(2026-07-22 立,完整 ReAct 循环,替代 agent_loop.py 半成品)。

相比 agent_loop.py(第一轮就 break):
- 完整 ReAct 循环(Reason → Act → Observe → 重复直到完成)
- 工具调用解析(LLM 返回 tool_calls → 执行 → 结果回填 → 继续)
- 最大迭代数限制(防无限循环)
- 并行工具调用(同一轮多个 tool_calls 并行执行)
- 工具执行超时 + 错误处理
- 完整 trace(每轮 reasoning/action/observation)
- 提前终止条件(LLM 返回无 tool_calls / 用户中断 / max_iterations)
- 2026-07-22 Wave 9: checkpoint + 断点续跑(每轮 iteration 后保存,
  异常/暂停/取消时保存,可从 checkpoint_id 恢复继续执行)

权限三模式(2026-09-02 立,对标 Claude Code 的 permission modes):
通过构造参数 `permission_mode`(默认取自 env `AGENT_PERMISSION_MODE`,再回退
"default")切换,取值 default / plan / auto,非法值 raise ValueError。

各模式说明:

- default(常规任务,安全由审批流兜底,回归红线):
  工具集=全量;写/执行类工具走现有高危审批流(可批准/拒绝);
  只读工具也走现有高危审批流(本就放行);
  与 approval 审批流的交互完全不变:`_request_approval` 按现状触发。
- plan(只读探查/审计/计划阶段,严禁任何副作用):
  工具集收窄为「传入 tools ∩ READONLY_TOOLS」;
  写/执行类工具直接拦截:返回 error「permission_mode=plan:工具 X
  不在只读白名单」,不执行、不进审批;
  只读工具正常执行;
  审批流对白名单外工具彻底不触发(防御性再校验在入口拦截)。
- auto(信任环境,只读工具免打扰,写工具仍受控):
  工具集=全量;写/执行类工具走现有高危审批流(不变);
  只读工具(READONLY_TOOLS)免审批直接执行(跳过 `_request_approval`);
  与 approval 审批流的交互:只读工具跳过审批;其余维持 default 行为。

与 `/agent-plan` 端点族的关系:端点是「计划文档 + 确认门」流程(plan_mode.py 的
state machine:draft→approved→executing),强调用户确认后再执行;本 permission_mode=plan
是**循环层强制只读执行**,可独立使用、也可在端点生成计划阶段叠加,二者正交、互不依赖。

模式生效事件:每当工具被跳过/免审批时,通过现有 hook_engine 发 `permission.mode`
事件(payload 含 mode/tool/decision),复用既有事件发射模式;该事件类型不影响
routers/agents.py 的固定 SSE 订阅列表(它只订阅 tool.before/after 等)。
"""

import asyncio
import contextlib
import inspect
import json
import logging
import os
import random
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional, cast

from ..core.permission_mode import (
    PermissionModeId as _PermissionModeId,
)
from ..core.permission_mode import (
    is_readonly_permission_mode as _is_readonly_mode,
)
from ..core.permission_mode import (
    normalize_permission_mode as _normalize_permission_mode,
)
from ..core.permission_mode import (
    permission_mode_error as _permission_mode_error,
)
from ..core.permission_mode import (
    skips_approval_permission_mode as _skips_approval_mode,
)
from ..core.usage_cache import normalize_usage
from .agent_checkpoint import (
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    get_agent_checkpoint_manager,
)
from .agent_deliverables import DeliverablesCollector, save_deliverables
from .engine_tool_bridge import capability_equivalent as _capability_equivalent

if TYPE_CHECKING:
    from .compaction_canary import CompactionDecision
    from .memory_service import MemoryService

from ..core.current_time_reminder import CurrentTimeReminderState as _CurrentTimeReminderState
from ..core.environment_context import EnvironmentStateTracker as _EnvironmentStateTracker
from ..core.mcp_tool_approval import (
    ToolAnnotations as _McpToolAnnotations,
)
from ..core.mcp_tool_approval import (
    requires_mcp_tool_approval as _requires_mcp_tool_approval,
)

# A25(2026-09-26):服务端限流指示优先于本地退避曲线的唯一裁决层
from ..core.retry_after import hint_from_error, resolve_retry_delay_s
from .guarded_tool_pipeline import (
    ERROR_INJECTION_BLOCKED,
    ERROR_SCAN_BLOCKED,
    GuardedToolPipeline,
)
from .hook_engine import hook_engine
from .llm_budget_governor import (
    BudgetExceededError,
    llm_budget_governor,
)
from .plan_mode import READONLY_TOOLS, is_readonly_tool
from .security_config import get_security_config

logger = logging.getLogger(__name__)

# L4 自进化:持有 fire-and-forget evaluate_and_record task 引用,
# 防止 CPython GC 在 task 完成前回收(与 agent_loop.py 的 _pending_tasks 同模式)
_pending_meta_eval_tasks: set[asyncio.Task[Any]] = set()

# W1(2026-09):完成后出口闭环(GraphRAG / consolidate / Skill 自进化)的
# fire-and-forget task 引用集合,同样防 GC 提前回收(与上面同模式)。
_pending_closure_tasks: set[asyncio.Task[Any]] = set()

# L5-2 错误恢复:工具瞬时失败自动重试的错误分类(2026-08-12 立)。
# 只重试网络/超时类瞬时故障(重试语义安全);http_4xx 业务错误与 unknown 不重试。
_TOOL_RETRYABLE_ERRORS: frozenset[str] = frozenset(
    {"timeout", "connection", "http_5xx"}
)

# 可观测录制:step 入参/结果摘要的截断上限(2026-09-03 立)
_STEP_SUMMARY_LIMIT = 800


class _LoopInterrupted(Exception):
    """P0-B(2026-09-18):循环内 abort 信号(LLM 调用/工具执行期间被取消或暂停)。

    由 _wait_interruptible 在检测到 _cancel_requested/_pause_requested 后抛出,
    _run_loop 捕获并走「补 tool 结果 → 落 checkpoint → 返回 cancelled/paused」
    优雅中断链路(与既有轮次边界中断的返回结构一致)。
    """

    def __init__(self, reason: str):
        self.reason = reason  # "cancelled" | "paused"
        super().__init__(f"用户{ '取消' if reason == 'cancelled' else '暂停' }(循环内中断)")


def _summarize_step(value: Any) -> str:
    """把工具入参/结果转紧凑摘要文本(供 step 录制;超长截断)。"""
    try:
        text = json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        text = str(value)
    return f"{text[: _STEP_SUMMARY_LIMIT]}…" if len(text) > _STEP_SUMMARY_LIMIT else text


# =====================================================================
# P0-3 安全三件套接入主链路(2026-09-12 立,对标 Codex 安全栈)。
# guarded_pipeline 作为工具执行默认包装层:每次工具执行前先跑
# prompt 注入探测 + 危险入参扫描(均 fail-closed),命中即拦截——
# 不进审批流、不执行,直接以结构化错误回填给 LLM。
# 配置单一事实源 security_config(env 默认 + 设置页 /agent/security-config 热更)。
# =====================================================================


class _ScanPass:
    """入参扫描禁用时的占位结果(永不拦截)。"""

    dangerous = False
    findings: tuple[Any, ...] = ()


def _no_prompt_guard(text: str, **_kw: Any) -> dict[str, Any]:
    """提示注入探测禁用时的占位实现(永不拦截)。

    pipeline 构造器对 None 依赖会回退到默认实现,无法经 None 关停,
    故用占位函数显式禁用(契约与 prompt_guard.act 同构:含 blocked 键)。
    """
    return {
        "action": "pass",
        "blocked": False,
        "output": text,
        "risk_level": "none",
        "hits": [],
    }


def _no_input_scanner(args: Any, **_kw: Any) -> _ScanPass:
    """入参扫描禁用时的占位实现(永不拦截)。"""
    return _ScanPass()


# =====================================================================
# 工具调用审批流(2026-08-30 立,对标 Codex 三档审批 + Claude Code Auto mode)。
# 高危工具(写文件/执行命令/删除/写库等)在执行前先请求用户审批:
#   发起 tool.approval hook 事件 → 前端弹窗 → 用户批准/拒绝 → 决策回填工具结果,
#   拒绝/超时的工具不执行,结果以 error 返回给 LLM(LLM 感知决策)。
# =====================================================================

# 默认高危工具集合(可经 env TOOL_APPROVAL_HIGH_RISK_TOOLS 追加,逗号分隔)
_DEFAULT_HIGH_RISK_TOOLS: frozenset[str] = frozenset({
    # 写文件类
    "write_file",
    "file_edit",
    "file_batch_edit",
    "edit_file",
    "create_file",
    "delete_file",
    # 1-2(2026-09-08):冲突按块落盘解决(写文件类)
    "resolve_conflict",
    # 命令类
    "run_command",
    "computer_mouse_click",
    "computer_key_type",
    "computer_screenshot",
    # 浏览器交互类
    "browser_click_element",
    "browser_type_text",
    # 删除/写库类(git_operations 含 rm / db_query 写操作由用户按参数预览自决)
    "git_operations",
    "db_query",
})

# 前缀高危:computer_* 系列(电脑控制)整体视为高危
_HIGH_RISK_PREFIXES: tuple[str, ...] = ("computer_",)


def _matches_high_risk_name(name: str) -> bool:
    """按既有高危名单(默认集 + 前缀族)判一个名字。

    单独成函数是为了让"名字本身"与"名字所代表的能力"用**同一把尺**
    —— 高危名单只有这一份真相,任何一侧要改都只改 `_DEFAULT_HIGH_RISK_TOOLS`。
    """
    if name in _DEFAULT_HIGH_RISK_TOOLS:
        return True
    return any(name.startswith(prefix) for prefix in _HIGH_RISK_PREFIXES)

# 审批默认超时(秒,可经 env TOOL_APPROVAL_TIMEOUT 覆盖)
_DEFAULT_APPROVAL_TIMEOUT = 60.0

# 审批默认开关:默认开启(安全功能),env TOOL_APPROVAL_ENABLED=false 关闭
def _approval_enabled_from_env() -> bool:
    return os.environ.get("TOOL_APPROVAL_ENABLED", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def _approval_timeout_from_env() -> float:
    try:
        return max(0.0, float(os.environ.get("TOOL_APPROVAL_TIMEOUT", "")))
    except ValueError:
        return _DEFAULT_APPROVAL_TIMEOUT


def _high_risk_tools_from_env() -> frozenset[str]:
    """env TOOL_APPROVAL_HIGH_RISK_TOOLS 追加自定义高危工具(逗号分隔)。"""
    extra = os.environ.get("TOOL_APPROVAL_HIGH_RISK_TOOLS", "")
    return frozenset(extra.split(",")) if extra else frozenset()


# ---------------------------------------------------------------------------
# 1-6 token 治理:LLM 预算治理器接入主循环(2026-09-02 立)
# ---------------------------------------------------------------------------


def _agent_budget_enabled_from_env() -> bool:
    """Agent 主循环预算硬约束总开关(env AGENT_BUDGET_ENABLED)。

    默认 off:Phase 1 剩余项未验收,避免线上突变;设为 on/1/true/yes 时完全生效。
    """
    return os.environ.get("AGENT_BUDGET_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _rollout_budget_limit_from_env() -> int:
    """批 40 接线:会话树加权 token 预算(env AGENT_ROLLOUT_BUDGET_TOKENS)。

    >0 时启用 RolloutBudget 记账 + 阈值提醒投递(默认 off,零行为变化);
    提醒阈值默认 (10000, 2000)(剩余 token 两档)。
    """
    try:
        return int(os.environ.get("AGENT_ROLLOUT_BUDGET_TOKENS", "0") or 0)
    except ValueError:
        return 0


def _token_budget_thresholds_from_env() -> tuple[int, ...] | None:
    """批58(接线):token 预算显式阈值(env AGENT_TOKEN_BUDGET_THRESHOLDS)。

    对标 codex config TokenBudgetConfig.reminder_threshold_tokens + resolve
    语义:逗号分隔正整数列表(如 "12000,4000")视为显式设置,validate 通过后
    覆盖 RolloutBudget 默认阈值 (10000, 2000);未配置/非法值返回 None →
    走现状默认阈值,与接线前逐字节等价。解析/校验失败降级 None 并告警。
    """
    raw = os.environ.get("AGENT_TOKEN_BUDGET_THRESHOLDS", "").strip()
    if not raw:
        return None
    try:
        from app.core.token_budget_config import TokenBudgetConfig

        parts = [p.strip() for p in raw.split(",") if p.strip()]
        values = [int(p) for p in parts]
        if not values:
            return None
        if any(v <= 0 for v in values):
            return None
        # 经 TokenBudgetConfig.validate 走 codex 同款校验(threshold 必须为正;
        # 模板字段以占位符满足非空校验,不产生实际模板)。
        TokenBudgetConfig(
            reminder_threshold_tokens=max(values),
            reminder_message_template="remaining {remaining} tokens",
        ).validate()
        return tuple(sorted(values, reverse=True))
    except Exception as e:  # noqa: BLE001 - 非法配置降级为默认阈值
        logger.warning("AGENT_TOKEN_BUDGET_THRESHOLDS 非法(降级默认阈值): %s", e)
        return None


def _agent_budget_pillar_from_env() -> str:
    """Agent 主循环预算支柱(env AGENT_BUDGET_PILLAR)。

    默认 "terminal":agent 主循环语义上属于 terminal 执行支柱(governor 文档
    Terminal: suggest/diagnose),复用现有 pillar 不新增,避免改动 _VALID_PILLARS
    及其测试。如需独立核算可经 env 切换(值须 ∈ _VALID_PILLARS)。
    """
    return os.environ.get("AGENT_BUDGET_PILLAR", "terminal").strip().lower() or "terminal"


def _agent_budget_max_token_estimate_from_env() -> int:
    """每轮 check 的粗估 token 上限(env AGENT_BUDGET_MAX_TOKEN_ESTIMATE)。

    无精确 usage 数据时作为 check_budget 的 estimated_tokens 入参;默认 4000。
    """
    try:
        return max(0, int(os.environ.get("AGENT_BUDGET_MAX_TOKEN_ESTIMATE", "4000")))
    except ValueError:
        return 4000


# ---------------------------------------------------------------------------
# 1-7 团队接力(Team Relay)开关:P3-3 Agent Teams 聚合摘要回传主循环(2026-09-03 立)
# ---------------------------------------------------------------------------

# AgentBlackboard 上承载"团队上一轮聚合摘要"的默认 key(写入方/读取方约定一致即可)
TEAM_RELAY_BLACKBOARD_KEY = "team.relay.summary"

# 注入 system prompt 的接力摘要正文最大长度(超长截断,防上下文膨胀)
TEAM_RELAY_SUMMARY_MAX = 4000


def _team_relay_enabled_from_env() -> bool:
    """团队接力总开关(env AGENT_TEAM_RELAY_ENABLED)。

    默认 off:默认路径与现状逐零差异(隔离 P3-3 演进,避免线上突变);
    设为 on/1/true/yes 时,主导 agent 每轮进入前若存在上一轮团队聚合摘要则注入。
    """
    return os.environ.get("AGENT_TEAM_RELAY_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _normalize_team_relay_context(context: Any) -> tuple[str, dict[str, Any]]:
    """把显式/黑板传入的团队上下文规范为 (summary_text, meta)。

    接受两种形态:
    - 纯文本 str:仅作为摘要正文,无附加元信息
    - 结构化 dict:取 summary_context 为正文,附带 objective/strategy/round_index/
      round_count/contributors/succeeded/failed 等元信息(缺失均忽略)
    """
    if isinstance(context, str):
        return context, {}
    if isinstance(context, dict):
        summary = str(context.get("summary_context", "") or "")
        meta = {
            k: context[k]
            for k in (
                "objective", "strategy", "round_index", "round_count",
                "contributors", "succeeded", "failed",
            )
            if k in context
        }
        return summary, meta
    return "", {}


# 审批响应注册表(模块级,供 SSE 端点写入决策后唤醒等待协程):
#   approval_id -> _ApprovalEntry(event, decision, owner_user_id)
# 决策值:"approve" / "reject"。等待方超时/完成后由 _request_approval 清理条目(防内存泄漏)。
#
# O19 端点级属主鉴权(2026-09-21 立):条目必须带属主,否则"知道 approval_id"就等于
# "能替别人批准高危工具"。owner_user_id 由 _request_approval 从 self._user_id 登记
# (路由层 → 执行路径 → loop 构造参数,全链路显式传递,不读全局、不猜)。
# None = 创建时就没有可证明的 principal(非 HTTP 上下文,如引擎未带 userId 的线程、
# 直接以库方式调用 AgentLoopV2 的测试),此类条目**不允许**被 HTTP 审批端点解析掉
# (HTTP 侧永远传真实 principal,与 None 不等 ⇒ 403),但引擎 JSON-RPC 通道在自身
# principal 同为 None 时仍可结算(见 agent_engine._handle_approval_respond 的信任边界注释)。
@dataclass
class _ApprovalEntry:
    """审批条目:唤醒事件 + 已写入的决策 + 属主(D84 补作用域与原因)。"""

    event: asyncio.Event
    decision: str | None = None
    owner_user_id: str | None = None
    # D84(2026-09-23):用户选择的作用域("once"|"session"|"always")。
    # None = 旧客户端未携带(兼容路径),结算侧按历史行为处理(批准即授 session)。
    scope: str | None = None
    # D84:用户随决策附带的原因(拒绝理由为主,可选;仅进审计/决策提示,不参与判定)。
    reason: str | None = None


# 兼容形态:历史/测试直接写入的二元组 (event, decision)。读取时一次性升级为
# _ApprovalEntry(owner=None),不要求所有写入方同步改造(见 _as_entry)。
_ApprovalRecord = _ApprovalEntry | tuple[asyncio.Event, str | None]

_approval_registry: dict[str, _ApprovalRecord] = {}


def _as_entry(approval_id: str) -> _ApprovalEntry | None:
    """取注册表条目并归一为 _ApprovalEntry(二元组就地升级,保证后续写入生效在同一对象上)。"""
    record = _approval_registry.get(approval_id)
    if record is None:
        return None
    if isinstance(record, _ApprovalEntry):
        return record
    event, decision = record
    entry = _ApprovalEntry(event=event, decision=decision, owner_user_id=None)
    _approval_registry[approval_id] = entry
    return entry


# 批 53(2026-09-20):审批 persist 持久键旁路登记(approval_id → cache_key)。
# _request_approval 造 approval_id 时顺手填,供引擎侧 approval.respond 携带 persist 字段时
# 按 id 取回 key 落盘 always/session 级授权(批 52 仅写 session);finally 清理防内存泄漏。
# 与 _approval_registry 同期登记/清理:两者都仅在人工弹窗等待窗口内存在。
_approval_persist_keys: dict[str, str] = {}


def grant_scope_for_approval(scope: str | None) -> str | None:
    """D84:把用户选择的审批作用域映射为持久层落盘档位(纯函数,供测试缝合)。

    Args:
        scope: "once" | "session" | "always";None = 旧客户端未携带。

    Returns:
        "session" | "always" = 应落盘的档位;None = 不落任何授权(once 或非法值)。

    映射规则:
    - once → None(最小特权:仅本次执行,绝不落盘;旧版无条件授 session 已收窄);
    - session → "session"(同键本会话免弹窗,服务重启/过期即失效);
    - always → "always"(同键跨会话免弹窗,approval_grants.db 持久行);
    - None(旧客户端兼容路径)→ "session"(保持批 52 历史行为,批准即授会话级);
    - 非法值(路由层已校验,防御性兜底)→ None,绝不放大授权。
    """
    if scope == "always":
        return "always"
    if scope == "session" or scope is None:
        return "session"
    return None


def grant_tool_approval_persist(approval_id: str, scope: str) -> bool:
    """按 approval_id 取回已登记的 cache_key 并落盘指定 scope 授权(批 53 persist 通道)。

    引擎侧 approval.respond(decision=approve, persist=...) 在决策落地后调用本函数,
    将授权升级/落盘到 always 或 session 级(对标 codex PERSIST_SESSION / PERSIST_ALWAYS)。

    Args:
        approval_id: 审批请求 id(由 _request_approval 生成并登记到 _approval_persist_keys);
        scope: "session" | "always"(由引擎侧决策层校验后传入,本函数不再做合法性校验)。

    Returns:
        True=已取回 key 并落盘成功(幂等 INSERT OR IGNORE);
        False=approval_id 不存在(已超时清理或从未发起),或持久层异常(fail-safe 不阻断主链路)。

    注:持久层异常按失败处理(返回 False),绝不影响主链路审批结果(工具已批准执行)。
    """
    key = _approval_persist_keys.get(approval_id)
    if key is None:
        return False
    try:
        from . import approval_persistence as _ap

        _ap.grant(scope, key, "mcp_tool")
    except Exception:
        return False
    return True


class ApprovalOutcome(str, Enum):
    """审批决策回填的三态结论(供路由层区分 403 与 404)。"""

    APPLIED = "applied"
    NOT_FOUND = "not_found"
    FORBIDDEN = "forbidden"


def resolve_approval_for_requester(
    approval_id: str,
    decision: str,
    requester_user_id: str | None,
    scope: str | None = None,
    reason: str | None = None,
) -> ApprovalOutcome:
    """带属主校验的审批决策回填(三态版,供 HTTP 路由与引擎通道共用)。

    Args:
        approval_id: 审批请求 id
        decision: "approve" 或 "reject"(其他值由调用方归一后再传入)
        requester_user_id: 调用方能证明的 principal。None 表示"无可证明身份",
            只能结算同样无属主的条目(非 HTTP 上下文创建的历史行为)。
        scope: D84 作用域("once"|"session"|"always");None=旧客户端未携带。
            合法性由调用方(路由层 zod/pydantic)校验,此处仅透传。
        reason: 用户附带原因(可选,拒绝理由为主)。

    Returns:
        APPLIED   = 属主匹配,决策已写入且协程被唤醒;
        NOT_FOUND = approval_id 不存在(已超时清理或从未发起);
        FORBIDDEN = id 存在但属主与请求者不符(跨用户决策尝试)。

    判定只有一种:**精确相等**(含 None==None)。不区分"部分匹配"/前缀匹配,
    也不因属主缺失而放行 —— 缺失属主的条目对带身份的请求者一律 FORBIDDEN。
    """
    entry = _as_entry(approval_id)
    if entry is None:
        return ApprovalOutcome.NOT_FOUND
    if entry.owner_user_id != requester_user_id:
        logger.warning(
            "[security] 审批决策被拒:approval_id=%s 请求者=%s 属主=%s",
            approval_id,
            requester_user_id,
            entry.owner_user_id,
        )
        return ApprovalOutcome.FORBIDDEN
    entry.decision = decision
    entry.scope = scope
    entry.reason = reason
    with contextlib.suppress(Exception):
        entry.event.set()
    return ApprovalOutcome.APPLIED


def resolve_approval_response(
    approval_id: str,
    decision: str,
    requester_user_id: str | None = None,
) -> bool:
    """写入审批决策并唤醒等待中的工具执行协程(由审批响应端点/引擎通道调用)。

    Args:
        approval_id: 审批请求 id
        decision: "approve" 或 "reject"(其他值视为 reject)
        requester_user_id: 调用方 principal;缺省 None 保持"仅无属主条目可结算"的
            历史语义(直接以库方式驱动循环的测试/脚本),对带属主的条目返回 False。

    Returns:
        True=决策已写入且协程被唤醒;False=id 不存在 **或** 属主不符。
        需要区分这两类时改用 resolve_approval_for_requester()。
    """
    return (
        resolve_approval_for_requester(approval_id, decision, requester_user_id)
        is ApprovalOutcome.APPLIED
    )


# 批 52(2026-09-20):工具审批持久键 + 撤销口(对标 codex-rs PERSIST_SESSION /
# PERSIST_ALWAYS 的审批决策持久层,落盘实现见 approval_persistence.py)。
def _tool_approval_cache_key(tool_name: str, args: dict[str, Any]) -> str:
    """工具审批持久键:tool_name + 参数稳定摘要(排序键 json,截断 256)。

    同 tool_name + 同参数 → 同键;参数乱序不影响键(排序键归一)。作
    approval_persistence 的 cache_key,使「批准一次后同键免弹窗」可跨调用生效。
    连接符用不可打印单元分隔符 \\x1f,避免 token 内出现空格/引号造成歧义。
    """
    try:
        payload = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        payload = str(args)
    if len(payload) > 256:
        payload = payload[:256]
    return f"{tool_name}\x1f{payload}"


def revoke_tool_approval(tool_name: str, args: dict[str, Any]) -> None:
    """撤销某工具+参数的持久授权(两 scope 全撤;失败静默)。

    对齐 codex revoke:用户可在前端主动撤销此前持久批准的授权,撤销后同键
    再次调用恢复人工弹窗。审批持久层异常不影响主链路(静默降级)。
    """
    try:
        from . import approval_persistence as _ap
        _ap.revoke(_tool_approval_cache_key(tool_name, args), "mcp_tool")
    except Exception:
        pass


@dataclass
class ToolDefinition:
    """工具定义。"""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema
    executor: Callable[..., Any]  # async (args: dict) -> dict
    # 批 39 接线:外部 MCP 工具注解(对标 MCP 工具审批判定)。
    # None = 内部工具/注解未知 → 审批门维持既有高危清单语义,零行为变化;
    # 非 None = 外部 MCP 工具 → auto 模式免审批判定改用 Codex 保守语义
    # (requires_mcp_tool_approval:未知注解按最坏情况需批,绝不因元数据缺失放行)。
    mcp_annotations: dict[str, Any] | None = None


@dataclass
class ToolCall:
    """单次工具调用。"""

    id: str
    name: str
    args: dict[str, Any]


@dataclass
class ToolResult:
    """工具执行结果。"""

    tool_call_id: str
    name: str
    result: Any
    error: str | None = None
    duration_ms: float = 0.0
    # L5-2 错误恢复:瞬时失败自动重试次数记录(2026-08-12 立)
    retry_count: int = 0
    # L5-8 错误恢复:失败的错误分类(timeout/connection/http_5xx/http_4xx/unknown,
    # 2026-08-12 立,供前端展示与可观测;成功为 None)
    error_type: str | None = None


@dataclass
class LoopIteration:
    """单轮迭代记录。"""

    iteration: int
    reasoning: str = ""  # LLM 的思考(assistant message content),run() 内回填
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    start_time: str | None = None
    end_time: str | None = None
    duration_ms: float = 0.0


def derive_step_evidence(
    tool_name: str,
    args: dict[str, Any],
    result: Any,
    *,
    checkpoint_id: str | None = None,
) -> dict[str, Any]:
    """1-5 事件流层:从工具调用推导可解释性证据 diff / test / rollback。

    契约(tests/test_derive_step_evidence.py):
    - edit_file:diff={tool,path,before=oldText,after=newText};有 checkpoint_id 时
      附带 rollback={kind:checkpoint,checkpoint_id,path,available:True}。
    - write_file:diff={tool,path=file_path,before:"",after=content};同样支持
      checkpoint rollback(无 checkpoint_id 时 rollback=None)。
    - run_command:result(dict)含 exitCode/passed/failed 时推导 test 证据
      {command,exit_code,passed,failed}。
    - 其余工具:三项均为 None。
    推导过程异常时返回全 None(调用方跳过该次事件明细,不阻塞主链路)。
    """
    diff: dict[str, Any] | None = None
    test: dict[str, Any] | None = None
    rollback: dict[str, Any] | None = None
    try:
        safe_args = args if isinstance(args, dict) else {}
        if tool_name in ("edit_file", "file_edit"):
            # 1-2(2026-09-08):参数名双兼容——MCP 真名 file_edit 用
            # file_path/old_string/new_string;旧契约 edit_file 用 path/oldText/newText。
            # 此前只认 edit_file 旧参数,真实编辑工具的 diff/rollback 证据永远推不出来。
            diff = {
                "tool": tool_name,
                "path": safe_args.get("path") or safe_args.get("file_path") or "",
                "before": safe_args.get("oldText") or safe_args.get("old_string") or "",
                "after": safe_args.get("newText") or safe_args.get("new_string") or "",
            }
        elif tool_name == "write_file":
            # 1-2:write_file 实际参数名是 path(mcp_server._tool_write_file),
            # 此前只取 file_path 导致 path 恒为空。双名兼容。
            diff = {
                "tool": "write_file",
                "path": safe_args.get("path") or safe_args.get("file_path") or "",
                "before": "",
                "after": safe_args.get("content", ""),
            }
        elif tool_name == "run_command" and isinstance(result, dict):
            # 2-3(2026-09-11):exitCode/exit_code 双键名兼容——mcp_server 的
            # _tool_run_command 实际返回蛇形 exit_code,此前只认驼峰 exitCode,
            # 纯命令执行(无 passed/failed)时 test 证据永远推不出来。
            if (
                "exitCode" in result
                or "exit_code" in result
                or "passed" in result
                or "failed" in result
            ):
                test = {
                    "command": safe_args.get("command", ""),
                    "exit_code": (
                        result["exitCode"] if "exitCode" in result else result.get("exit_code")
                    ),
                    "passed": result.get("passed"),
                    "failed": result.get("failed"),
                }
        if diff is not None and checkpoint_id:
            rollback = {
                "kind": "checkpoint",
                "checkpoint_id": checkpoint_id,
                "path": diff["path"],
                "available": True,
            }
    except Exception:
        return {"diff": None, "test": None, "rollback": None}
    return {"diff": diff, "test": test, "rollback": rollback}


def _derive_step_decision(tr: ToolResult) -> tuple[str, str]:
    """从工具执行结果推导该步的 decision/reason(1-1 全可解释,2026-09-08 立)。

    覆盖「结果上可见」的决策路径;auto 免审批等不可见路径由
    ``self._decision_hints`` 提示(见 _maybe_record_step)。
    """
    if tr.error_type == "permission_denied":
        return "plan_blocked", "plan 模式:工具不在只读白名单,未执行"
    if tr.error_type == ERROR_INJECTION_BLOCKED:
        return "security_blocked", "提示注入探测拦截,未执行"
    if tr.error_type == ERROR_SCAN_BLOCKED:
        return "security_blocked", "危险入参扫描拦截,未执行"
    if tr.error_type == "user_rejected":
        return "rejected_by_user", "用户在审批门拒绝,未执行"
    if tr.error_type == "approval_timeout":
        return "approval_timeout", "审批等待超时,未执行"
    if tr.error_type == "unknown" and tr.error and "不存在" in tr.error:
        return "tool_missing", "工具未注册,未执行"
    if tr.error:
        reason = f"执行失败({tr.error_type or 'unknown'}):{str(tr.error)[:200]}"
        return "execute_tool_failed", reason
    if tr.retry_count > 0:
        return "execute_tool_retried", f"瞬时失败自动重试 {tr.retry_count} 次后成功"
    return "execute_tool", ""


# ---------------------------------------------------------------------------
# 2-3 验证自愈集成(2026-09-12 立):run_command 出现失败 pytest 信号时,
# agent loop 内联触发 self_healing 引擎(默认 off,见 _maybe_self_heal)。
# ---------------------------------------------------------------------------

# 自愈触发单 run 次数上限(env AGENT_SELF_HEAL_MAX_PER_RUN,默认 1:
# LLM 补丁无效时避免同一失败反复 heal 烧 token)
_SELF_HEAL_DEFAULT_MAX_PER_RUN = 1


def _self_heal_enabled_from_env() -> bool:
    """2-3 自愈集成总开关(env AGENT_SELF_HEALING_ENABLED,与 routers/self_healing.py 同源)。

    默认 off:agent loop 行为与现状逐零差异;设为 on/1/true/yes 时,
    _run_loop 检测到失败的 pytest 类 run_command 即触发 heal。
    """
    return os.environ.get("AGENT_SELF_HEALING_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _self_heal_max_per_run_from_env() -> int:
    """单次 run 内 heal 触发次数上限(env AGENT_SELF_HEAL_MAX_PER_RUN,默认 1)。"""
    try:
        return max(
            1, int(os.environ.get("AGENT_SELF_HEAL_MAX_PER_RUN", _SELF_HEAL_DEFAULT_MAX_PER_RUN))
        )
    except ValueError:
        return _SELF_HEAL_DEFAULT_MAX_PER_RUN


def _extract_pytest_target(command: str) -> str | None:
    """从 pytest 命令行提取目标路径(nodeid / 文件 / 目录)。

    取 "pytest" 后第一个不以 "-" 开头的 token;找不到返回 None。
    覆盖 "pytest tests/x.py" 与 "python -m pytest tests/x.py::test_a" 两种形态。
    """
    tokens = (command or "").split()
    if "pytest" not in tokens:
        return None
    for tok in tokens[tokens.index("pytest") + 1 :]:
        if tok.startswith("-"):
            continue
        return tok
    return None


def _detect_failed_test_signal(
    tool_calls: list[ToolCall], tool_results: list[ToolResult]
) -> dict[str, Any] | None:
    """2-3:从本轮工具结果检测失败的 pytest 类 run_command(heal 触发依据)。

    命中条件:run_command 无 error + 命令含 pytest + test 证据 failed>0
    (或 failed 缺失但 exit_code 非零)。返回
    {"command","exit_code","failed","target"} 或 None。
    """
    for tc, tr in zip(tool_calls, tool_results, strict=False):
        if tr.error or (tr.name or tc.name) != "run_command":
            continue
        args = tc.args if isinstance(tc.args, dict) else {}
        command = str(args.get("command", ""))
        target = _extract_pytest_target(command)
        if target is None:
            continue
        evidence = derive_step_evidence("run_command", args, tr.result)
        test = evidence.get("test") if isinstance(evidence, dict) else None
        if not isinstance(test, dict):
            continue
        failed = test.get("failed")
        exit_code = test.get("exit_code")
        failed_hit = isinstance(failed, int) and failed > 0
        exit_hit = failed is None and isinstance(exit_code, int) and exit_code != 0
        if failed_hit or exit_hit:
            return {
                "command": command,
                "exit_code": exit_code,
                "failed": failed,
                "target": target,
            }
    return None


def _detect_extended_signal(
    tool_calls: list[ToolCall], tool_results: list[ToolResult]
) -> dict[str, Any] | None:
    """V3 #56(2026-09-26 立):pytest 专用检测未命中时的四类信号兜底。

    信号源从 pytest-only 扩到四类:测试框架/类型检查/构建/lint。判定委托
    self_healing.classify_run_command_signal(纯离线分类器,判据见该函数);
    只有 actionable 的信号才返回(环境性失败如网络超时修不了,不触发 heal)。

    为什么不走 _detect_failed_test_signal:该函数在命令识别层就卡死 pytest-only
    (_extract_pytest_target 只认 "pytest" token),且被既有契约测试钉住
    (test_detect_signal_not_pytest_command 断言 pnpm test 返回 None),
    改它会破 pytest 既有语义;兜底适配器保持两条路径互不干扰。
    """
    from .self_healing import classify_run_command_signal

    for tc, tr in zip(tool_calls, tool_results, strict=False):
        if tr.error or (tr.name or tc.name) != "run_command":
            continue
        args = tc.args if isinstance(tc.args, dict) else {}
        command = str(args.get("command", ""))
        result = tr.result if isinstance(tr.result, dict) else {}
        sig = classify_run_command_signal(command, result)
        if sig is None or not sig.actionable:
            continue
        # target 兜底为 ".":_validate_path_in_workspace 会把相对路径解析到
        # 工作区根(heal 的文件边界);具体补丁文件路径由 apply_patch_descriptor
        # 的白名单校验二次把关,这里不需要精确文件目标。
        return {
            "command": command,
            "exit_code": sig.exit_code,
            "failed": None,
            "target": ".",
            "category": sig.category,
            "error_digest": sig.error_digest,
        }
    return None


# V3 #56:四类扩展信号的 heal 任务描述(喂 LLM 的任务目标,中文明确验收标准 =
# 原命令退出码归零,而非 pytest 通过)。
_SELF_HEAL_CATEGORY_TASK_DESC = {
    "type_check": "修复类型检查错误并让验证命令通过(exit=0)",
    "build": "修复构建失败并让构建命令成功(exit=0)",
    "lint": "修复 lint 错误并让 lint 命令通过(exit=0)",
    "test_framework": "修复失败测试并让测试命令通过(exit=0)",
}


class AgentEventStream:
    """1-5 事件流协作层:收敛全部 hook_engine.emit 调用点(2026-09-08 立)。

    拆层动机:此前 run/_run_loop/_request_approval 等 9 处 emit 各自带
    try/except + logger.warning 样板;现统一到本层,语义保持一致:
    - fail-open:emit 失败仅 warning 降级,绝不阻塞主链路;
    - error 事件沿用静默 suppress(异常路径避免日志级联);
    - tool.after 的 evidence 推导失败同样跳过该次事件(与拆层前一致)。
    """

    def __init__(self) -> None:
        # 可靠性:可选 trace_id(2026-09-18 立)。经 bind_trace 注入后,emit 对未携带
        # trace_id 键的 payload 自动注入,统一关联事件链路;None 时行为与现状逐零差异。
        self._trace_id: str | None = None

    def bind_trace(self, trace_id: str | None) -> None:
        """绑定(或解绑)trace_id:此后 emit 对无 trace_id 键的 payload 自动注入。"""
        self._trace_id = trace_id

    async def emit(
        self, event: str, payload: dict[str, Any], *, silent: bool = False
    ) -> None:
        """发射任意事件;失败降级不抛(silent=True 时连 warning 也不记)。"""
        # 可靠性:已绑定 trace_id 且 payload 未显式携带时注入(不覆盖显式传入值;
        # 拷贝注入,不改调用方原 dict)。
        if self._trace_id and "trace_id" not in payload:
            payload = {**payload, "trace_id": self._trace_id}
        try:
            await hook_engine.emit(event, payload)
        except Exception as e:
            if not silent:
                logger.warning(
                    "hook_engine.emit(%s) 失败(降级,不阻塞): %s", event, e
                )

    async def session_start(
        self,
        *,
        session_id: str,
        user_id: str,
        conversation_id: str,
        max_iterations: int,
    ) -> None:
        await self.emit("session.start", {
            "session_id": session_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "max_iterations": max_iterations,
        })

    async def session_end(
        self,
        *,
        session_id: str,
        user_id: str,
        success: bool,
        stop_reason: str,
        total_iterations: int,
        total_duration_ms: float,
        deliverables: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "session_id": session_id,
            "user_id": user_id,
            "success": success,
            "stop_reason": stop_reason,
            "total_iterations": total_iterations,
            "total_duration_ms": total_duration_ms,
        }
        # D27(2026-09)任务完成交付清单:可选字段,仅成功结束且构建成功时携带
        # (None 时 wire payload 不含该键,老前端零影响)。
        if deliverables is not None:
            payload["deliverables"] = deliverables
        await self.emit("session.end", payload)

    async def message_send(
        self,
        *,
        session_id: str,
        iteration: int,
        messages_count: int,
    ) -> None:
        """message.send:本轮 LLM 请求即将发出(前端 message_send 命名事件源)。"""
        await self.emit("message.send", {
            "session_id": session_id,
            "iteration": iteration,
            "messages_count": messages_count,
        })

    async def tool_before(
        self,
        *,
        session_id: str,
        iteration: int,
        messages_count: int,
        tools_count: int,
    ) -> None:
        await self.emit("tool.before", {
            "session_id": session_id,
            "iteration": iteration,
            "messages_count": messages_count,
            "tools_count": tools_count,
        })

    async def message_receive(
        self, *, session_id: str, iteration: int, content_length: int
    ) -> None:
        await self.emit("message.receive", {
            "session_id": session_id,
            "iteration": iteration,
            "content_length": content_length,
            "stop_reason": "completed",
        })

    async def tool_after(
        self,
        *,
        session_id: str,
        iteration: int,
        tool_calls: list[ToolCall],
        tool_results: list[ToolResult],
        duration_ms: float | None,
        checkpoint_id: str | None = None,
    ) -> None:
        """tool.after 事件 + 每工具结果明细(evidence 逐个推导,失败跳过整次事件)。"""
        try:
            payload_tools: list[dict[str, Any]] = []
            for tc, tr in zip(tool_calls, tool_results, strict=False):
                evidence = derive_step_evidence(
                    tr.name or tc.name,
                    dict(tc.args or {}),
                    {"error": tr.error} if tr.error else tr.result,
                    checkpoint_id=checkpoint_id,
                )
                payload_tools.append({
                    "name": tr.name,
                    "id": tr.tool_call_id,
                    "input": tc.args,
                    "status": "error" if tr.error else "ok",
                    "error": tr.error,
                    "error_type": tr.error_type,
                    "retry_count": tr.retry_count,
                    "duration_ms": round(tr.duration_ms, 2),
                    **evidence,
                })
            payload: dict[str, Any] = {
                "session_id": session_id,
                "iteration": iteration,
                "tool_calls_count": len(tool_calls),
                "tool_results_count": len(tool_results),
                "duration_ms": duration_ms,
                "tool_results": payload_tools,
            }
        except Exception as e:
            logger.warning("tool.after 明细构建失败(降级,不阻塞): %s", e)
            return
        await self.emit("tool.after", payload)

    async def loop_error(
        self, *, session_id: str, iteration: int, error: str, error_type: str
    ) -> None:
        # 异常路径静默 suppress:emit 失败不记录日志,避免日志级联(拆层前语义)
        await self.emit("error", {
            "session_id": session_id,
            "iteration": iteration,
            "error": error,
            "error_type": error_type,
        }, silent=True)

    async def tool_approval(
        self,
        *,
        approval_id: str,
        tool_name: str,
        tool_call_id: str,
        args_preview: str,
        session_id: str,
    ) -> None:
        await self.emit("tool.approval", {
            "approval_id": approval_id,
            "tool_name": tool_name,
            "tool_call_id": tool_call_id,
            "args_preview": args_preview,
            "danger_level": "high",
            "session_id": session_id,
        })

    async def permission_mode(
        self, *, mode: str, tool_name: str, decision: str, session_id: str
    ) -> None:
        await self.emit("permission.mode", {
            "mode": mode,
            "tool": tool_name,
            "decision": decision,
            "session_id": session_id,
        })

    async def emit_thinking_delta(
        self, run_id: str, content: str, *, iteration: int, is_final: bool = True
    ) -> None:
        """P0-5(2026-09-13):thinking 透出(workbench /agents/tasks/stream)。

        P0-B(2026-09-18)扩展增量语义:
        - is_final=True(默认,与既有行为逐零差异):阻塞式路径,LLM 全量
          reasoning 一次性发射;调用方仅在 reasoning 非空时发射。
        - is_final=False:流式路径,llm_complete_fn 经 on_chunk 回调逐 chunk
          发射增量,前端按增量拼接;结束后由调用方补发 is_final=True 结束帧
          (content 传增量末值,前端若做替换语义也不会丢内容)。
        run_id 此处即 workbench session_id(SSE 消费方关联键)。
        """
        await self.emit("thinking.delta", {
            "run_id": run_id,
            "content": content,
            "iteration": iteration,
            "is_final": is_final,
        })

    async def emit_plan_step(
        self,
        run_id: str,
        step_index: int,
        tool_name: str,
        status: str,
        *,
        decision: str | None = None,
        reason: str | None = None,
    ) -> None:
        """P0-5(2026-09-13):plan 步骤事件(workbench 工具步骤时间线)。

        status: started/completed/blocked;blocked 不在本层发射(拦截/审批路径
        由 tool.after/error 事件承载)。run_id 此处即 workbench session_id。
        """
        await self.emit("plan.step", {
            "run_id": run_id,
            "step_index": step_index,
            "tool_name": tool_name,
            "status": status,
            "decision": decision,
            "reason": reason,
        })


# ---------------------------------------------------------------------------
# 1-8 上下文超限压缩(2026-09-07 立):接近 token 上限时自动压缩旧消息,
# 避免 loop 因上下文膨胀被硬停。复用 core/context_compaction 确定性压缩;
# LLM 语义压缩为可选路径(默认 off),失败自动降级确定性。
# ---------------------------------------------------------------------------

# 压缩触发占用率(默认 0.85 = 85%):上下文占用超过 context_limit * 该比例即压缩
DEFAULT_COMPACTION_TRIGGER_RATIO = 0.85
# 压缩后目标占用率(0.6 = 60%)
DEFAULT_COMPACTION_TARGET_RATIO = 0.6
# 尾部保留的 non-system 消息数(按 tool_calls 配对组对齐,可能整组多保留)
DEFAULT_COMPACTION_KEEP_RECENT = 6


def _compaction_enabled_from_env() -> bool:
    """上下文压缩总开关(env AGENT_COMPACTION_ENABLED)。

    默认 off:与现状逐零差异,避免线上突变;设为 on/1/true/yes 时启用自动压缩。
    """
    return os.environ.get("AGENT_COMPACTION_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _compaction_llm_enabled_from_env() -> bool:
    """LLM 语义压缩路径开关(env AGENT_COMPACTION_LLM_ENABLED)。

    默认 off:优先确定性压缩(无额外 LLM 调用、零额外延迟/成本);
    设为 on/1/true/yes 时走 compact_with_llm 语义压缩,失败自动降级确定性。
    """
    return os.environ.get("AGENT_COMPACTION_LLM_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _compaction_context_limit_from_env() -> int:
    """压缩用的上下文窗口上限(tokens,env AGENT_COMPACTION_CONTEXT_LIMIT)。

    默认 0(未配置 = 不压缩);生产按模型实际上下文窗口设置(如 128000)。
    """
    try:
        return max(0, int(os.environ.get("AGENT_COMPACTION_CONTEXT_LIMIT", "0")))
    except ValueError:
        return 0


def _build_reasoning_effort_pin_from_env() -> Any | None:
    """构造推理努力档位钉扎(批58十九,对标 codex state/session.rs ReasoningEffortPin)。

    两道门都满足才启用(任一不满足 → None,采样参数与现状逐零差异):
    ① ``AGENT_REASONING_EFFORT_PIN_ENABLED`` 为真;
    ② ``AGENT_REASONING_EFFORT_PIN_MODELS`` 配置了非空模型白名单(逗号分隔)。
    """
    if os.environ.get(
        "AGENT_REASONING_EFFORT_PIN_ENABLED", "false"
    ).strip().lower() not in ("on", "1", "true", "yes"):
        return None
    raw_models = os.environ.get("AGENT_REASONING_EFFORT_PIN_MODELS", "")
    models = frozenset(part.strip() for part in raw_models.split(",") if part.strip())
    if not models:
        return None
    from app.core.reasoning_effort_pin import ReasoningEffortPin

    return ReasoningEffortPin(override_enabled=True, allowed_models=models)


def _compaction_retention_budget_enabled_from_env() -> bool:
    """保留区逐组预算精修开关(env AGENT_COMPACTION_RETENTION_BUDGET_ENABLED)。

    默认 off:压缩产物保留区原样(与现状逐零差异);on/1/true/yes 时按 token 预算
    从新到旧逐组纳入保留区、超长 agent 消息截断(对标 codex compact_remote_v2)。
    """
    return os.environ.get(
        "AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _compaction_retention_budget_tokens_from_env() -> int:
    """保留区 token 预算(env AGENT_COMPACTION_RETENTION_BUDGET_TOKENS)。

    未配置 → codex RETAINED_MESSAGE_TOKEN_BUDGET 默认值;非法/负值同样回退默认。
    """
    from app.core.compaction_retention import RETAINED_MESSAGE_TOKEN_BUDGET

    try:
        value = int(
            os.environ.get(
                "AGENT_COMPACTION_RETENTION_BUDGET_TOKENS",
                str(RETAINED_MESSAGE_TOKEN_BUDGET),
            )
        )
    except ValueError:
        return RETAINED_MESSAGE_TOKEN_BUDGET
    return value if value > 0 else RETAINED_MESSAGE_TOKEN_BUDGET


def _compaction_retention_image_budget_from_env() -> bool:
    """图片是否计入保留区预算(env AGENT_COMPACTION_RETENTION_IMAGE_BUDGET)。

    默认 off = codex RetainedImageBudget::Disabled(图片不计入保留判定)。
    """
    return os.environ.get(
        "AGENT_COMPACTION_RETENTION_IMAGE_BUDGET", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _compaction_retention_max_agent_tokens_from_env() -> int:
    """单条 agent 消息 token 上限(env AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS)。

    未配置 → codex MAX_RETAINED_AGENT_MESSAGE_TOKENS(10000);0 或负值 → 不截断。
    """
    from app.core.compaction_retention import MAX_RETAINED_AGENT_MESSAGE_TOKENS

    try:
        value = int(
            os.environ.get(
                "AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS",
                str(MAX_RETAINED_AGENT_MESSAGE_TOKENS),
            )
        )
    except ValueError:
        return MAX_RETAINED_AGENT_MESSAGE_TOKENS
    return value if value >= 0 else MAX_RETAINED_AGENT_MESSAGE_TOKENS


def _auto_compact_window_enabled_from_env() -> bool:
    """自动压缩窗口账本开关(env AGENT_AUTO_COMPACT_WINDOW_ENABLED)。

    对标 codex state/auto_compact_window.rs。默认 off:不持有 AutoCompactWindow
    实例,usage 记账/prefill 观测/压缩推进与现状逐零差异。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_AUTO_COMPACT_WINDOW_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _build_auto_compact_window_from_env() -> Any | None:
    """按 env 构造 AutoCompactWindow 实例;开关关闭或构造异常时为 None(零行为变化)。"""
    if not _auto_compact_window_enabled_from_env():
        return None
    try:
        from app.core.auto_compact_window import AutoCompactWindow

        return AutoCompactWindow()
    except Exception as e:  # noqa: BLE001 - 模块缺失降级为不启用
        logger.warning("auto_compact_window 构造失败(降级不启用): %s", e)
        return None


def _tool_call_trace_enabled_from_env() -> bool:
    """工具调用追踪开关(env AGENT_TOOL_CALL_TRACE_ENABLED)。

    对标 codex tools/call_trace.rs。默认 off:不发任何 trace 里程碑
    (与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_TOOL_CALL_TRACE_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _world_state_sections_enabled_from_env() -> bool:
    """世界状态片段开关(env AGENT_WORLD_STATE_SECTIONS_ENABLED)。

    对标 codex model.rs / context_window_guidance.rs / token_budget_context.rs。
    默认 off:不注入任何 developer 片段(与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_WORLD_STATE_SECTIONS_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _additional_context_enabled_from_env() -> bool:
    """附加上下文存储开关(env AGENT_ADDITIONAL_CONTEXT_ENABLED)。

    对标 codex state/additional_context.rs。默认 off:不持有存储实例、不注入任何
    片段(与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_ADDITIONAL_CONTEXT_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _context_fragments_enabled_from_env() -> bool:
    """上下文片段组装开关(env AGENT_CONTEXT_FRAGMENTS_ENABLED)。

    对标 codex context-fragments crate。默认 off:不注入任何 recap/answered_question
    片段(与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_CONTEXT_FRAGMENTS_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _session_prefix_enabled_from_env() -> bool:
    """Session 前缀片段开关(env AGENT_SESSION_PREFIX_ENABLED)。

    对标 codex session_prefix.rs / inter_agent_message.rs。默认 off:不注入任何
    inter-agent 完成片段(与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_SESSION_PREFIX_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _instructional_fragments_enabled_from_env() -> bool:
    """指令片段构造开关(env AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED)。

    对标 codex core/src/context/*_instructions.rs。默认 off:不注入任何指令片段
    (与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _startup_prewarm_enabled_from_env() -> bool:
    """会话启动预热开关(env AGENT_STARTUP_PREWARM_ENABLED)。

    对标 codex session_startup_prewarm.rs。默认 off:不发起预热、不兑现(与现状
    逐零差异,首回合零额外延迟)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_STARTUP_PREWARM_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _stream_events_enabled_from_env() -> bool:
    """流事件工具/回合项映射开关(env AGENT_STREAM_EVENTS_ENABLED)。

    对标 codex event_mapping.rs parse_turn_item。默认 off:不调用任何流事件归一化
    (与现状逐零差异)。on/1/true/yes 时启用。
    """
    return os.environ.get(
        "AGENT_STREAM_EVENTS_ENABLED", "false"
    ).strip().lower() in ("on", "1", "true", "yes")


def _build_additional_context_store_from_env() -> Any | None:
    """按 env 构造 AdditionalContextStore;开关关闭或构造异常时为 None(零行为变化)。"""
    if not _additional_context_enabled_from_env():
        return None
    try:
        from app.core.additional_context_store import AdditionalContextStore

        return AdditionalContextStore()
    except Exception as e:  # noqa: BLE001 - 模块缺失降级为不启用
        logger.warning("additional_context_store 构造失败(降级不启用): %s", e)
        return None


def _resolve_compaction_decision_for(session_id: str | None) -> "CompactionDecision":
    """1-3 灰度决策接入(2026-09-12 立):AGENT_COMPACTION_MODE + CANARY_PERCENT。

    延迟 import 规避模块加载顺序问题(纯函数无副作用);决策逻辑见
    services/compaction_canary.py(MODE 未设置时 legacy 行为,默认与现状逐零差异)。
    """
    from .compaction_canary import resolve_compaction_decision

    return resolve_compaction_decision(session_id)


@dataclass
class AgentLoopResult:
    """Agent 循环结果。"""

    success: bool
    final_response: str  # LLM 最终回复(无 tool_calls 的那一轮)
    iterations: list[LoopIteration]
    total_duration_ms: float
    total_tokens_used: int  # 估算
    # completed / max_iterations / error / no_tools / paused / cancelled / budget_exceeded
    stop_reason: str
    error: str | None = None
    # Wave 9:暂停/取消/失败时保存的 checkpoint_id(便于后续 resume),正常完成时为 None
    checkpoint_id: str | None = None
    # 1-6 token 治理:预算治理摘要(主循环接入 budget governor 后填充;budget off 时为 None)
    budget: dict[str, Any] | None = None
    # 1-8 上下文超限压缩(2026-09-07 立):主循环触发的压缩事件摘要列表
    # (每次含 original_tokens/compressed_tokens/removed_count/trigger;未触发为空列表)。
    compaction_events: list[dict[str, Any]] = field(default_factory=list)
    # 1-7 团队接力(P3-3,2026-09-03 立):启用且尝试注入时,记录团队上一轮聚合摘要
    # 的注入元信息(参与了哪些子 agent、轮次、摘要是否截断、是否注入成功);
    # 未启用 / 无接力上下文时保持 None(默认路径与现状逐零差异)。
    team_relay: dict[str, Any] | None = None


class AgentLoopV2:
    """完整 ReAct 工具调用循环。

    用法:
        loop = AgentLoopV2(
            llm_complete_fn=my_llm_call,  # async (messages, tools) -> {content, tool_calls}
            tools=[...],
            max_iterations=10,
        )
        result = await loop.run([
            {"role": "system", "content": "你是一个助手"},
            {"role": "user", "content": "帮我查一下天气"},
        ])
        logger.info("agent_loop_final_response", response=result.final_response)
    """

    def __init__(
        self,
        llm_complete_fn: Callable[..., Any],
        tools: list[ToolDefinition],
        max_iterations: int = 10,
        tool_timeout: float = 60.0,
        parallel_tool_calls: bool = True,
        enable_checkpoint: bool = True,
        session_id: str | None = None,
        checkpoint_manager: AgentCheckpointManager | None = None,
        # L1-1 记忆闭环接入(2026-07-25 立,对标 Hermes Agent 默认在线记忆)
        user_id: str | None = None,
        conversation_id: str | None = None,
        enable_memory: bool = True,
        memory_svc: Optional["MemoryService"] = None,
        # L5-1 错误恢复:LLM 调用指数退避重试(2026-08-12 立)
        llm_retry_max: int = 3,
        llm_retry_backoff: float = 1.5,
        # L5-2 错误恢复:工具瞬时失败自动重试(2026-08-12 立)
        tool_retry_max: int = 1,
        tool_retry_backoff: float = 0.5,
        # 工具调用审批流(2026-08-30 立):高危工具执行前请求用户审批。
        # 默认开启(env TOOL_APPROVAL_ENABLED=false 关闭),超时秒数经 env
        # TOOL_APPROVAL_TIMEOUT 覆盖。传 None 使用 env 解析结果。
        approval_enabled: bool | None = None,
        approval_timeout: float | None = None,
        # P3-工具级审批策略(2026-09-18 立,对标 Codex harness per-tool approval_policy):
        # {tool_name: "never"|"on-request"|"always"}。显式配置优先于模式隐含逻辑与
        # 高危清单:never 强制免审(高危清单也放行)、always 每次必审(auto 只读免审
        # 也被覆盖)、on-request = 现状。非法值构造期即 raise(与 permission_mode 同款)。
        approval_policies: dict[str, str] | None = None,
        time_provider: Callable[[], datetime] | None = None,
        # 批 39 接线:生命周期钩子运行时(批 30 移植,可选注入;None = 不启用,
        # 行为零变化)。接线点:PRE_TOOL_USE(pre_tool_use deny 即拒绝)与
        # USER_PROMPT_SUBMIT / STOP(additional_context 注入 / stop 联动)。
        hook_runtime: Any | None = None,
        # 权限三模式(2026-09-02 立,对标 Claude Code permission modes):
        # default=与现状完全一致(回归红线);plan=循环层强制只读;auto=只读工具免审批。
        # 默认 None 时取自 env AGENT_PERMISSION_MODE,再回退 "default";构造参数优先于 env。
        permission_mode: str | None = None,
        # 1-6 token 治理:LLM 预算硬约束接入主循环(2026-09-02 立)。
        # budget_enabled:总开关,默认 None 时取 env AGENT_BUDGET_ENABLED(默认 off);
        #   构造参数优先于 env。on 时每轮 check_budget 硬停止 + record_usage 记录。
        # budget_pillar:check_budget/record_usage 使用的预算支柱(默认 terminal,见
        #   _agent_budget_pillar_from_env 注释;值须 ∈ _VALID_PILLARS)。
        # budget_max_token_estimate:无精确 usage 时每轮 check 的粗估 token 上限。
        budget_enabled: bool | None = None,
        budget_pillar: str | None = None,
        budget_max_token_estimate: int | None = None,
        # 1-8 上下文超限压缩(2026-09-07 立):接近上下文窗口上限时自动压缩旧消息继续执行,
        # 替代旧的"超限即硬停"。compaction_enabled 默认 None→env AGENT_COMPACTION_ENABLED
        # (默认 off,与现状逐零差异);compaction_context_limit 默认 None→env
        # AGENT_COMPACTION_CONTEXT_LIMIT(默认 0=未配置不压缩);构造参数优先于 env。
        compaction_enabled: bool | None = None,
        compaction_context_limit: int | None = None,
        # 1-7 团队接力(P3-3,2026-09-03 立):把上一轮团队聚合摘要注入主导 agent 上下文。
        # team_relay_enabled:总开关,默认 None 时取 env AGENT_TEAM_RELAY_ENABLED(默认 off);
        #   构造参数优先于 env;off 时默认路径与现状逐零差异。
        # team_context:显式传入的团队上一轮摘要(结构化 dict 或纯文本 str),二者传递其一即可,
        #   与 agent_comm.AgentBlackboard 作为共享接力载体二选一,避免强耦合。
        team_relay_enabled: bool | None = None,
        team_context: Any | None = None,
        team_blackboard: Any | None = None,
        # 可观测录制(2026-09-03 立,对标 WorkBuddy/Codex 可复现审计):
        # recorder=AgentStepRecorder 实例(等价接口即可)可选注入。None 时本循环
        # 不接入录制,默认路径与现状逐零差异;注入后每次工具调用 append 一步。
        recorder: Any | None = None,
        # 2026-09-18 第二批(对标 Codex model_reasoning 配置面):生成参数透传面
        # {temperature/top_p/max_tokens/reasoning_effort/...},每次 LLM 调用经
        # **kwargs 透传 llm_complete_fn(承载层闭包再透传 llm_gateway→litellm)。
        # 空时调用签名与现状逐零差异(mock 友好)。
        model_params: dict[str, Any] | None = None,
        # 可靠性：可选 trace_id 统一关联事件、LLM 与工具调用；不传时兼容旧调用。
        trace_id: str | None = None,
        # 2026-09-18 第三批(Goals 对标):线程持久目标;非空时 run 入口注入 system。
        thread_goal: str | None = None,
    ):
        """
        Args:
            llm_complete_fn: async (messages: list, tools: list[dict]) -> dict
                            返回 {"content": str, "tool_calls": list[{"id","name","args"}] | None}
            tools: 工具定义列表
            max_iterations: 最大迭代轮数(防无限循环)
            tool_timeout: 单个工具执行超时(秒)
            parallel_tool_calls: 同一轮多个工具是否并行执行
            enable_checkpoint: 是否启用 checkpoint(每轮 iteration 后保存状态,
                               异常/暂停/取消时也保存,支持 resume_from_checkpoint)
            session_id: agent loop 会话 id(不传则首次 run 时自动生成 uuid4 hex),
                        同一 session_id 的 checkpoint 可通过 load_latest_by_session 查询
            checkpoint_manager: 自定义 checkpoint 管理器(不传则用全局单例)
            user_id: 跨会话记忆用户 id(传入后默认启用记忆 load/save 闭环,让 ReAct 主循环不再失忆)
            conversation_id: 会话 id(用于 session scope 记忆;不传则用 session_id)
            enable_memory: 是否启用记忆闭环(默认 True;传 False 则关闭 load/save,即使 user_id 已给)
            memory_svc: 可注入 MemoryService 实例(测试 mock 用);不传则 lazy import 全局单例
            llm_retry_max: LLM 调用失败最大重试次数(默认 3,0=不重试)
            llm_retry_backoff: 指数退避基数秒(默认 1.5,实际等待 = base * 2^attempt * 抖动)
            tool_retry_max: 工具瞬时失败(timeout/connection/http_5xx)自动重试次数(默认 1,0=不重试;
                             http_4xx 业务错误与 unknown 不重试)
            tool_retry_backoff: 工具重试固定退避秒(默认 0.5,实际等待 = base * attempt)
            permission_mode: 权限档(G-161 起取唯一真源规范值 default / acceptEdits /
                bypassPermissions / plan / manual;历史拼写 auto 与 kebab 别名自动归一)。
                None 时取 env AGENT_PERMISSION_MODE,再回退 "default"。
            team_relay_enabled: 团队接力总开关(默认 None 取 env AGENT_TEAM_RELAY_ENABLED,
                默认 off,与现状逐零差异)。on 时主导 agent 进入循环前注入团队上一轮摘要。
            team_context: 团队上一轮聚合上下文(结构化 dict 或纯文本 str),显式传递;
                None 时可经 team_blackboard 读取,二者选一(与 AgentBlackboard 弱耦合)。
            team_blackboard: 共享黑板(agent_comm.AgentBlackboard 实例);传 team_context
                则此参数可省略。loop 每轮从黑板默认 key(TEAM_RELAY_BLACKBOARD_KEY)读取摘要。
            recorder: AgentStepRecorder(或等价接口)实例,可选注入;None 时默认路径
                与现状逐零差异(不产生任何 step 记录)。注入后每次工具调用 append 一步。
        """
        self._llm_complete = llm_complete_fn
        # 2026-09-18 第二批:生成参数透传面(对标 Codex model_reasoning 配置面)。
        if model_params is not None and not isinstance(model_params, dict):
            raise ValueError("model_params 须为 dict")
        self._model_params: dict[str, Any] = dict(model_params or {})
        # 2026-09-18 第三批(Goals 对标):线程持久目标,run 入口注入 system 全程可见。
        self._thread_goal: str | None = thread_goal
        # P0-B(2026-09-18):检测 llm_complete_fn 是否支持 on_chunk 流式回调。
        # 支持(签名含 on_chunk 参数或 **kwargs)时,每轮 LLM 调用传入回调,
        # 逐 chunk 发射 thinking.delta(is_final=False),实现 token 级流式;
        # 不支持(agent_plan 等既有闭包/测试 mock)时不传,行为与现状逐零差异。
        self._llm_supports_on_chunk: bool = self._detect_on_chunk_support(
            llm_complete_fn
        )
        self._tools: dict[str, ToolDefinition] = {t.name: t for t in tools}
        self.max_iterations = max_iterations
        self.tool_timeout = tool_timeout
        self.parallel_tool_calls = parallel_tool_calls

        # L5-1 错误恢复:LLM 重试配置(2026-08-12 立)
        self.llm_retry_max = llm_retry_max
        self.llm_retry_backoff = llm_retry_backoff

        # L5-2 错误恢复:工具重试配置(2026-08-12 立)
        self.tool_retry_max = tool_retry_max
        self.tool_retry_backoff = tool_retry_backoff

        # 工具调用审批流配置(2026-08-30 立)
        self._approval_enabled: bool = (
            _approval_enabled_from_env() if approval_enabled is None else bool(approval_enabled)
        )
        self._approval_timeout: float = (
            _approval_timeout_from_env() if approval_timeout is None else float(approval_timeout)
        )
        # 自定义高危工具集合(env 追加;实例级只读组合)
        self._extra_high_risk_tools: frozenset[str] = _high_risk_tools_from_env()

        # 权限模式(G-161 归一到唯一真源,2026-09-22)。
        # 优先级:构造参数 > env AGENT_PERMISSION_MODE > "default"。
        # 历史上这里只认 default/plan/auto 三值,而前端发的是 acceptEdits /
        # accept-edits / bypassPermissions —— 全部落在 raise 分支,一次 500。
        # 现按 packages/types/src/permission-mode.ts 的注册表归一(别名 auto→
        # acceptEdits、read-only|plan-only→plan、accept-all→bypassPermissions),
        # 认不出的仍 fail-fast,不静默降级成 default。
        _resolved_raw = (
            permission_mode
            if permission_mode is not None
            else os.environ.get("AGENT_PERMISSION_MODE", "default")
        )
        _resolved_mode = _normalize_permission_mode(_resolved_raw)
        if _resolved_mode is None:
            raise ValueError(_permission_mode_error(_resolved_raw))
        self._permission_mode: _PermissionModeId = _resolved_mode

        # 工具级审批策略(构造期校验,非法值 fail-fast)
        _VALID_APPROVAL_POLICIES = ("never", "on-request", "always")
        self._approval_policies: dict[str, str] = {}
        if approval_policies:
            for _tool, _pol in approval_policies.items():
                if _pol not in _VALID_APPROVAL_POLICIES:
                    raise ValueError(
                        f"非法 approval_policy: 工具 {_tool!r} 值 {_pol!r},"
                        " 取值必须为 'never' / 'on-request' / 'always'"
                    )
            self._approval_policies = dict(approval_policies)

        # 批 39 接线:生命周期钩子运行时(可选注入;None = 不启用零行为变化)。
        self._hook_runtime = hook_runtime

        # 批 40 接线:当前时间提醒节流状态机(对标 codex session/time_reminder.rs;
        # 可选注入 time_provider,默认 None = 不启用零行为变化)。
        self._time_reminder_state = _CurrentTimeReminderState()
        self._time_provider = time_provider
        self._env_tracker = _EnvironmentStateTracker()
        # 批 57 接线:Responses 流重试决策状态机(延迟 import 避免循环;行为兼容,
        # 仅作决策来源统一化,现有 attempt>=llm_retry_max 的 break 仍主导主链路)。
        self._stream_retry_state: Any = None
        # 批 42:本回合内"用户批准后重执行"的工具调用 id 集合(回填 user_shell 片段)
        self._approved_command_call_ids: set[str] = set()
        # 批 40 接线:rollout_budget 记账 + 阈值提醒(批 26 移植模块首次接线;
        # env AGENT_ROLLOUT_BUDGET_TOKENS>0 启用,默认 off 零行为变化)。
        self._rollout_budget = None
        _rb_limit = _rollout_budget_limit_from_env()
        if _rb_limit > 0:
            try:
                from ..core.rollout_budget import RolloutBudget, RolloutBudgetConfig

                # 批58(接线):token_budget_config 显式阈值(对标 codex
                # features.token_budget.reminder_threshold_tokens)。未配置/非法
                # 时保持默认 (10000, 2000),与接线前逐字节等价。
                _tb_thresholds = _token_budget_thresholds_from_env()
                _rb = RolloutBudget()
                _rb.configure(
                    RolloutBudgetConfig(
                        limit_tokens=_rb_limit,
                        reminder_at_remaining_tokens=(
                            _tb_thresholds
                            if _tb_thresholds is not None
                            else (10000, 2000)
                        ),
                    )
                )
                self._rollout_budget = _rb
            except Exception as e:  # noqa: BLE001 - 配置失败降级为不启用
                logger.warning("rollout_budget 初始化失败(降级不启用): %s", e)

        # plan 模式:循环入口强制收窄工具集为「传入 tools ∩ READONLY_TOOLS」,
        # LLM schema 也仅暴露只读工具(双保险:既收窄可见工具,又在执行入口做防御性再校验)。
        if _is_readonly_mode(self._permission_mode):
            self._tools = {
                name: td for name, td in self._tools.items() if name in READONLY_TOOLS
            }

        # 1-6 token 治理:预算硬约束开关/支柱/粗估 token(2026-09-02 立)。
        # 优先级:构造参数 > env;默认 off(向后兼容,避免 Phase 1 未验收线上突变)。
        self._budget_enabled: bool = (
            _agent_budget_enabled_from_env() if budget_enabled is None else bool(budget_enabled)
        )
        self._budget_pillar: str = (
            _agent_budget_pillar_from_env()
            if budget_pillar is None
            else (budget_pillar or "terminal")
        )
        self._budget_max_token_estimate: int = (
            _agent_budget_max_token_estimate_from_env()
            if budget_max_token_estimate is None
            else max(0, int(budget_max_token_estimate))
        )

        # Wave 9 checkpoint 配置
        # 1-8 上下文超限压缩配置(2026-09-07 立)
        self._compaction_enabled: bool = (
            _compaction_enabled_from_env()
            if compaction_enabled is None
            else bool(compaction_enabled)
        )
        self._compaction_context_limit: int = (
            _compaction_context_limit_from_env()
            if compaction_context_limit is None
            else max(0, int(compaction_context_limit))
        )
        self._compaction_llm_enabled: bool = _compaction_llm_enabled_from_env()
        # 批58(十九):推理努力档位钉扎(对标 codex reasoning_effort.rs)——开关关闭或
        # 未配置模型白名单时为 None,采样请求参数与现状逐零差异(不注入覆盖)。
        self._reasoning_effort_pin: Any | None = _build_reasoning_effort_pin_from_env()
        # 批58(十三):保留区逐组预算精修(对标 codex compact_remote_v2)。默认 off
        # 与现状逐零差异;三参数与 codex RetainedImageBudget / 单条 agent 消息上限对齐。
        self._retention_budget_enabled: bool = _compaction_retention_budget_enabled_from_env()
        self._retention_budget_tokens: int = _compaction_retention_budget_tokens_from_env()
        self._retention_image_budget: bool = _compaction_retention_image_budget_from_env()
        self._retention_max_agent_tokens: int = _compaction_retention_max_agent_tokens_from_env()
        # 批58(接线):自动压缩窗口账本(对标 codex state/auto_compact_window.rs)。
        # 默认 off → None;usage 记账/prefill 观测/压缩推进与现状逐零差异。
        self._auto_compact_window: Any | None = _build_auto_compact_window_from_env()
        # 批58(接线):工具调用追踪(对标 codex tools/call_trace.rs)。
        # 默认 off:不发任何 trace 里程碑事件,与现状逐零差异。
        self._tool_call_trace_enabled: bool = _tool_call_trace_enabled_from_env()
        # 批58(接线):本轮已执行工具调用记录器(对标 codex executed_tool_calls.rs)。
        # 默认 off:不记录、不回灌,与现状逐零差异。on 时 per-turn 生命周期
        # (run 入口 reset,单轮内 accumulate,回灌条目经 request metadata 透传)。
        self._executed_tool_calls_enabled: bool = os.environ.get(
            "AGENT_EXECUTED_TOOL_CALLS_ENABLED", "false"
        ).strip().lower() in ("on", "1", "true", "yes")
        self._executed_tool_calls: Any | None = None
        if self._executed_tool_calls_enabled:
            try:
                from app.core.executed_tool_calls import ExecutedToolCalls

                self._executed_tool_calls = ExecutedToolCalls()
            except Exception as e:  # noqa: BLE001 - 模块缺失降级为不启用
                logger.warning("executed_tool_calls 构造失败(降级不启用): %s", e)
        # 批58(接线):世界状态片段(对标 codex model.rs 等)。默认 off 不注入片段。
        self._world_state_sections_enabled: bool = _world_state_sections_enabled_from_env()
        # 批58(接线):附加上下文存储(对标 codex state/additional_context.rs)。
        # 默认 off → 无实例、无片段;set_additional_context 在 off 时为空操作。
        self._additional_context_enabled: bool = _additional_context_enabled_from_env()
        self._additional_context_store: Any | None = _build_additional_context_store_from_env()
        self._additional_context_desired: dict[str, Any] = {}
        # 批58(接线):guardian 安全审查策略片段(对标 codex context/guardian_*.rs)。
        # 默认 off(env AGENT_GUARDIAN_POLICY 非空才启用);注入失败隔离不阻塞回合。
        self._guardian_policy_text: str = (
            os.environ.get("AGENT_GUARDIAN_POLICY", "").strip()
        )
        self._guardian_review_reminder: bool = os.environ.get(
            "AGENT_GUARDIAN_REVIEW_REMINDER", "false"
        ).strip().lower() in ("on", "1", "true", "yes")
        # 批58(接线):上下文片段组装(对标 codex context-fragments crate)。
        # 默认 off:不注入任何 recap/answered_question 片段,与现状逐零差异。
        self._context_fragments_enabled: bool = _context_fragments_enabled_from_env()
        # 批58(接线):Session 前缀片段(对标 codex session_prefix.rs)。
        # 默认 off:不注入任何 inter-agent 完成片段,与现状逐零差异。
        self._session_prefix_enabled: bool = _session_prefix_enabled_from_env()
        # 批58(接线):指令片段构造(对标 codex core/src/context/*_instructions.rs)。
        # 默认 off:不注入任何指令片段,与现状逐零差异。
        self._instructional_fragments_enabled: bool = _instructional_fragments_enabled_from_env()
        # 批58(接线):会话启动预热(对标 codex session_startup_prewarm.rs)。
        # 默认 off:不发起预热、不兑现,首回合零额外延迟,与现状逐零差异。
        self._startup_prewarm_enabled: bool = _startup_prewarm_enabled_from_env()
        self._startup_prewarm_timeout: float = 10.0
        self._startup_prewarm_handle: Any | None = None
        self._startup_prewarm_resolution: Any | None = None
        # 批58(接线):流事件回合项映射(对标 codex event_mapping.rs parse_turn_item)。
        # 默认 off:不调用任何流事件归一化,与现状逐零差异。
        self._stream_events_enabled: bool = _stream_events_enabled_from_env()
        self._last_stream_turn_item: Any | None = None
        # 1-3 灰度机制(2026-09-12 立):构造参数未显式给 compaction_enabled 时,
        # 生效开关由灰度决策(AGENT_COMPACTION_MODE/CANARY_PERCENT 按 session_id
        # 稳定哈希)决定;决策懒解析(session_id 可能在 run 时才生成,保证哈希稳定)。
        # 显式传参(含既有测试)路径与现状逐零差异。
        self._compaction_enabled_explicit: bool = compaction_enabled is not None
        self._compaction_decision: CompactionDecision | None = None
        # 1-3 压缩生产指标:本次 run 的压缩指标关联标识(每次 run 重置)
        self._compaction_run_id: str = ""
        # 本次 run 的压缩事件列表(写入 AgentLoopResult.compaction_events)
        self._compaction_events: list[dict[str, Any]] = []
        self.enable_checkpoint = enable_checkpoint
        self._session_id: str | None = session_id
        self._checkpoint_manager: AgentCheckpointManager = (
            checkpoint_manager
            if checkpoint_manager is not None
            else get_agent_checkpoint_manager()
        )

        # L1-1 记忆闭环配置(对标 Hermes Agent 默认在线记忆)
        self._user_id: str | None = user_id
        self._conversation_id: str | None = conversation_id
        # enable_memory 仅在 user_id 存在时才真正生效
        self._enable_memory: bool = bool(enable_memory and user_id)
        self._memory_svc: MemoryService | None = memory_svc

        # 1-7 团队接力配置(2026-09-03 立)。优先级:构造参数 > env AGENT_TEAM_RELAY_ENABLED
        # (默认 off,向后兼容:off 时默认路径与现状逐零差异)。team_context 显式传入优先,
        # 否则可经 team_blackboard(AgentBlackboard)从默认 key 读取,二者弱耦合。
        self._team_relay_enabled: bool = (
            _team_relay_enabled_from_env()
            if team_relay_enabled is None
            else bool(team_relay_enabled)
        )
        self._team_context: Any | None = team_context
        self._team_blackboard: Any | None = team_blackboard
        # 可观测录制(2026-09-03 立):默认 None 时零开销,不接入任何录制器
        # (默认路径与现状逐零差异)。
        self._step_recorder: Any | None = recorder

        # 1-5 事件流协作层(2026-09-08 立):run/_run_loop/审批等全部事件发射
        # 收敛到 AgentEventStream(fail-open 降级语义统一在层内)。
        self._events: AgentEventStream = AgentEventStream()

        # D27(2026-09)任务完成交付清单:本次 run 的聚合器(citations /
        # filesChanged / toolsSummary),每次 run 开始时在 _reset_run_state 重置。
        self._deliverables: DeliverablesCollector = DeliverablesCollector()

        # 运行时状态(每次 run() 开始时重置)
        self._messages: list[dict[str, Any]] | None = None
        self._current_iteration: int = 0
        self._tool_state: dict[str, Any] = {}
        self._pause_requested: bool = False
        self._cancel_requested: bool = False
        # 批 44(turn/steer 对标,2026-09-19):运行中用户转向输入队列。
        # steer(text) 由引擎层在回合 running 时调用;主循环每次 LLM 调用前消费,
        # 把 steer 文本追加进消息历史 → 同一回合继续推理(非排队新回合)。
        self._pending_steers: list[str] = []
        # 1-5:最新 checkpoint id(rollback 证据引用;每次 run 重置)
        self._last_checkpoint_id: str | None = None
        # 1-1 可解释性:工具级决策提示(1-1 立,2026-09-08)。
        # auto 模式免审批等「结果上不可见」的决策路径,由 _execute_single 写入
        # tool_call_id → (decision, reason),_maybe_record_step 消费后弹出。
        self._decision_hints: dict[str, tuple[str, str]] = {}
        # 1-7 团队接力:本次 run 的注入元信息(供可观测;未启用/无接力为 None)
        self._team_relay_info: dict[str, Any] | None = None
        # 1-2 自动回滚:本次 run 已捕获的文件快照引用(absolute path → snapshot dict)。
        # 写盘工具(file_edit/write_file/edit_file)首次执行前 snapshot(编辑前内容),
        # _save_checkpoint_safe 传入 checkpoint → restore(rollback_files=true)可真正回滚。
        self._run_file_snapshots: dict[str, dict[str, Any]] = {}
        # 2-3 自愈集成(2026-09-12):本次 run 已触发 heal 次数 + 已 heal 过的失败命令
        # (去重防烧 token;每次 run 重置,见 _reset_run_state)。
        self._self_heal_runs: int = 0
        self._self_heal_commands: set[str] = set()
        # 可靠性:可选 trace_id(2026-09-18 立)统一关联事件、LLM 与工具调用。
        # None = 未显式传入,每次 run 由 _reset_run_state 生成新 uuid(一次 run 一个
        # trace);显式传入则跨 run 固定不变,便于按业务 id 检索全链路。
        self._trace_id: str | None = trace_id
        # 记录是否构造期显式传入:决定 _reset_run_state 是否逐 run 重新生成
        self._trace_id_explicit: bool = trace_id is not None
        # 构造期即绑定到事件流:此后所有 emit 的 payload 自动注入该 trace_id
        self._events.bind_trace(self._trace_id)

    def _ensure_session_id(self) -> str:
        """获取或自动生成 session_id。"""
        if self._session_id is None:
            self._session_id = uuid.uuid4().hex
        return self._session_id

    def _reset_run_state(self) -> None:
        """每次 run/resume 开始前重置运行时状态。"""
        self._pause_requested = False
        self._cancel_requested = False
        self._current_iteration = 0
        # 批58(接线):executed_tool_calls per-turn 生命周期——新轮次清空
        # (对标 codex 对齐 per-turn 语义);off/None 零副作用,异常隔离。
        if self._executed_tool_calls is not None:
            try:
                self._executed_tool_calls.reset()
            except Exception as e:  # noqa: BLE001 - 重置失败降级跳过
                logger.debug("executed_tool_calls.reset 失败(降级跳过): %s", e)
        # 批 44:steer 队列跨 run 清空(running 时才可 steer,run 间不应残留)
        self._pending_steers = []
        # 1-5:rollback 证据引用的 checkpoint id 跨 run 不复用
        self._last_checkpoint_id = None
        # 1-8 上下文压缩:每次 run 重置事件列表(避免跨 run 残留)
        self._compaction_events = []
        # 1-3 压缩生产指标:每次 run 重置指标关联标识
        self._compaction_run_id = uuid.uuid4().hex
        # 1-7 团队接力:每次 run 重置注入元信息(避免跨 run 残留)
        self._team_relay_info = None
        # 2-3 自愈集成:每次 run 重置 heal 计数与命令去重集合
        self._self_heal_runs = 0
        self._self_heal_commands = set()
        # D27:每次 run 重置交付清单聚合器(避免跨 run 残留)
        self._deliverables = DeliverablesCollector()
        # 可靠性:每次 run 重置 trace_id(2026-09-18 立)——未显式传入时逐 run 生成
        # 新 uuid(一次 run 一个 trace);显式传入的保持不变。随后重新绑定到事件流,
        # 本次 run 的全部事件 payload 自动携带该 trace_id。
        if not self._trace_id_explicit:
            self._trace_id = uuid.uuid4().hex
        self._events.bind_trace(self._trace_id)

    @property
    def trace_id(self) -> str | None:
        """本次(或下次)run 的 trace_id 只读视图。

        显式传入时跨 run 恒定;未显式传入时,每次 run 开始(_reset_run_state)后
        为该 run 新生成的 uuid.hex,逐 run 变化。
        """
        return self._trace_id

    def _effective_compaction_settings(self) -> tuple[bool, bool]:
        """解析本次 run 生效的 (enabled, llm_enabled) 压缩配置。

        1-3 灰度机制(2026-09-12 立):
        - 构造参数显式传 compaction_enabled → 与现状逐零差异(测试/调用方直控);
        - 未显式传 → 灰度决策(AGENT_COMPACTION_MODE=off/ratio/full +
          AGENT_COMPACTION_CANARY_PERCENT 按 session_id 稳定哈希);
          决策首次解析后缓存(同 session 稳定,MODE 未设置时等价 legacy env)。
        """
        if self._compaction_enabled_explicit:
            return self._compaction_enabled, self._compaction_llm_enabled
        if self._compaction_decision is None:
            self._compaction_decision = _resolve_compaction_decision_for(
                self._ensure_session_id()
            )
        return bool(self._compaction_decision.enabled), bool(
            self._compaction_decision.llm_enabled
        )

    def _record_compaction_metric(self, info: dict[str, Any], duration_ms: float) -> None:
        """1-3 压缩生产指标上报(fail-open:失败仅 log,不影响主循环)。"""
        try:
            from app.services.compaction_metrics import record_compaction_event

            record_compaction_event(
                session_id=self._ensure_session_id(),
                info=info,
                source="agent_loop",
                run_id=self._compaction_run_id,
                duration_ms=duration_ms,
            )
        except Exception as e:  # noqa: BLE001 - 指标上报绝不影响主链路
            logger.debug("compaction 指标上报失败: %s", e)

    def _record_compaction_run_outcome(self, result: AgentLoopResult) -> None:
        """1-3 压缩生产指标:发生过压缩的 run 记录最终结果(压缩后任务是否继续成功)。

        H7「真实任务成功率下降 ≤2%」的 run 维度观测输入;无压缩事件的 run 不记录。
        """
        if not self._compaction_events:
            return
        try:
            from app.services.compaction_metrics import record_compaction_run_outcome

            record_compaction_run_outcome(
                run_id=self._compaction_run_id,
                session_id=self._ensure_session_id(),
                success=bool(result.success),
                event_count=len(self._compaction_events),
            )
        except Exception as e:  # noqa: BLE001 - 指标上报绝不影响主链路
            logger.debug("compaction run outcome 上报失败: %s", e)

    async def _maybe_compact_context(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """1-8 上下文超限压缩(2026-09-07 立):占用 ≥ context_limit*0.85 时压缩旧消息。

        确定性压缩复用 core/context_compaction.compress_messages_if_needed
        (system 保留+尾部 keep_recent 配对组对齐+结构化摘要),零 LLM 调用零额外成本;
        LLM 语义压缩(灰度 MODE=full 或 AGENT_COMPACTION_LLM_ENABLED=on)走
        compact_with_llm,失败自动降级确定性路径。
        压缩幂等防抖:压缩由占用率驱动,压缩后 usage 回落自然低于阈值,不会反复触发。
        未启用/limit<=0 时原样返回(与现状逐零差异)。
        1-3(2026-09-12):压缩事件同步上报生产指标(压缩比/耗时/trigger)。
        """
        enabled, llm_enabled = self._effective_compaction_settings()
        if not enabled or self._compaction_context_limit <= 0:
            return messages
        # 批 58 接线:new_context 工具请求开新窗时跳过摘要压缩(对标 codex
        # request_new_context_window 信号——模型主动放弃摘要,直接截断开新窗)。
        if getattr(self, "_new_context_window_requested", False):
            self._new_context_window_requested = False
            logger.info("new_context 请求生效:本轮跳过摘要压缩,直接截断开新窗")
            return messages
        started = time.perf_counter()
        try:
            if llm_enabled:
                from app.services.compact_with_llm import compact_with_llm

                compressed, info = await compact_with_llm(
                    messages,
                    self._compaction_context_limit,
                    self._llm_complete,
                    trigger_ratio=DEFAULT_COMPACTION_TRIGGER_RATIO,
                    target_ratio=DEFAULT_COMPACTION_TARGET_RATIO,
                    keep_recent=DEFAULT_COMPACTION_KEEP_RECENT,
                )
            else:
                from app.core.context_compaction import compress_messages_if_needed

                compressed, info = compress_messages_if_needed(
                    messages,
                    self._compaction_context_limit,
                    trigger_ratio=DEFAULT_COMPACTION_TRIGGER_RATIO,
                    target_ratio=DEFAULT_COMPACTION_TARGET_RATIO,
                    keep_recent=DEFAULT_COMPACTION_KEEP_RECENT,
                )
            duration_ms = (time.perf_counter() - started) * 1000
            if not info.get("compressed"):
                return messages
            # P1-②(2026-09-18):决策链保留 —— 在压缩产物上做后处理注入(不改压缩实现,
            # 跨端 parity 零影响):把被压缩 head 段每轮 assistant 推理蒸馏为结构化决策条目
            # (推理 + 动作 + 失败报错),追加进摘要消息。开关 AGENT_DECISION_CHAIN_ENABLED,
            # 关闭/失败/无可注入项 → 与现状逐零差异。同时自证"推理保留率"。
            compressed, chain_meta = self._inject_decision_chain(compressed, messages)
            if chain_meta.get("injected"):
                info["decision_chain"] = {
                    "entries": chain_meta.get("entries"),
                    "fresh": chain_meta.get("fresh"),
                    "carried": chain_meta.get("carried"),
                }
                info["reasoning_retention"] = chain_meta.get("reasoning_retention") or {}
            # 批58(十三):保留区逐组预算精修 —— 对标 codex compact_remote_v2 保留区语义
            # (从新到旧逐组纳入预算/图片预算开·关/单条 agent 消息 token 上限)。作用于
            # 压缩产物的保留区段,前缀(系统+摘要)原位不动。开关默认 off 与现状逐零差异。
            compressed, retention_meta = self._apply_retention_budget(compressed)
            if retention_meta.get("applied"):
                info["retention_budget"] = retention_meta
            # 批58(十九):压缩成功 → 档位钉扎退役为 Compacted(允许新窗重建请求基线)
            self._retire_effort_pin_on_compaction()
            # 批58(接线):压缩成功 → auto_compact_window 推进编号(对标 codex advance)。
            # 窗 id 轮换,新窗重新记账;失败隔离不影响压缩主链路(降级跳过)。
            if self._auto_compact_window is not None:
                try:
                    self._auto_compact_window.advance()
                except Exception as e:  # noqa: BLE001 - 推进失败隔离
                    logger.warning("auto_compact_window 推进失败(降级跳过): %s", e)
            self._compaction_events.append(
                {
                    "iteration": self._current_iteration,
                    "original_tokens": info.get("original_tokens"),
                    "compressed_tokens": info.get("compressed_tokens"),
                    "removed_count": info.get("removed_count"),
                    "trigger": "llm" if info.get("llm_summary") else "deterministic",
                    "decision_chain_entries": int(chain_meta.get("entries") or 0),
                    "retention_dropped_groups": int(
                        retention_meta.get("dropped_groups") or 0
                    ),
                }
            )
            # W9#5(2026-09-18):压缩发生即经 hook_engine 发 SSE 通知(此前压缩结果只进
            # AgentLoopResult 与 compaction_metrics,前端在 agent 通道全程无感知)。
            await self._events.emit(
                "compaction",
                {
                    "session_id": self._ensure_session_id(),
                    "iteration": self._current_iteration,
                    "original_tokens": info.get("original_tokens"),
                    "compressed_tokens": info.get("compressed_tokens"),
                    "removed_count": info.get("removed_count"),
                    "trigger": "llm" if info.get("llm_summary") else "deterministic",
                },
            )
            logger.warning(
                "[agent-loop] 上下文压缩触发: %s -> %s tokens(移除 %s 条, iter %s)",
                info.get("original_tokens"),
                info.get("compressed_tokens"),
                info.get("removed_count"),
                self._current_iteration,
            )
            # 1-3 压缩生产指标(Prometheus + 进程内报告通道)
            self._record_compaction_metric(info, duration_ms)
            # 批 40 接线:压缩后环境片段重置(对标 codex 压缩窗口语义——压缩产物
            # 可能不含早前 environment_context,重置 tracker 让下轮推理强制重注入,
            # 模型重新拿到 cwd/日期;失败隔离不影响压缩主链路)。
            try:
                self._env_tracker.reset()
            except Exception:  # noqa: BLE001 - 重置失败仅影响去重精度
                pass
            return compressed
        except Exception as e:
            # 压缩失败降级:原样返回继续执行(宁可硬停也不因压缩引入新故障)
            logger.warning("[agent-loop] 上下文压缩失败(降级原消息): %s", e)
            return messages

    def _apply_retention_budget(
        self, compressed: list[dict[str, Any]]
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """批58(十三):压缩保留区逐组预算精修(对标 codex compact_remote_v2)。

        codex 保留区语义:压缩后保留的历史消息按 token 预算**从新到旧逐组**纳入,
        整组不 fit 即淘汰该组及更旧;图片按 RetainedImageBudget 开关决定是否计入;
        单条 agent 消息超上限按 token 截断。

        接线面:作用于压缩产物的保留区段(摘要/系统前缀原位不动),纯确定性零 LLM。
        降级语义:开关关闭(AGENT_COMPACTION_RETENTION_BUDGET_ENABLED 默认 off)/
        无保留区/预算内无需淘汰/任何异常 → 原样返回,与未接入前逐零差异。
        保守护栏:预算极小会把保留区整体淘汰时不动产物(宁可保留也不清空活上下文)。
        """
        if not self._retention_budget_enabled:
            return compressed, {"enabled": False}
        try:
            from app.core.compaction_retention import truncate_retained_messages
            from app.core.context_compaction import SUMMARY_MARKER

            prefix_len = 0
            for msg in compressed:
                if not isinstance(msg, dict):
                    break
                content = msg.get("content")
                is_summary = isinstance(content, str) and content.startswith(SUMMARY_MARKER)
                if msg.get("role") == "system" or is_summary:
                    prefix_len += 1
                else:
                    break
            prefix, retained = compressed[:prefix_len], compressed[prefix_len:]
            if not retained:
                return compressed, {"enabled": True, "applied": False, "reason": "no_retained"}
            new_retained, stats = truncate_retained_messages(
                retained,
                max_tokens=self._retention_budget_tokens,
                image_budget=self._retention_image_budget,
                max_agent_message_tokens=self._retention_max_agent_tokens,
            )
            if not new_retained:
                # 保守护栏:预算过小导致保留区被整体淘汰 → 不动产物
                return compressed, {
                    "enabled": True,
                    "applied": False,
                    "reason": "budget_would_drop_all_retained",
                    "budget_tokens": self._retention_budget_tokens,
                }
            dropped_groups = int(stats.get("groups_total", 0)) - int(
                stats.get("groups_retained", 0)
            )
            meta: dict[str, Any] = {
                "enabled": True,
                "applied": True,
                "budget_tokens": self._retention_budget_tokens,
                "dropped_groups": dropped_groups,
                "groups_total": int(stats.get("groups_total", 0)),
                "groups_retained": int(stats.get("groups_retained", 0)),
                "truncated_messages": int(stats.get("truncated_messages", 0)),
                "estimated_tokens": int(stats.get("estimated_tokens", 0)),
            }
            if dropped_groups or meta["truncated_messages"]:
                logger.info(
                    "[agent-loop] 保留区预算精修:淘汰 %s/%s 组,截断 %s 条超长 agent 消息(预算 %s tokens)",
                    dropped_groups,
                    meta["groups_total"],
                    meta["truncated_messages"],
                    self._retention_budget_tokens,
                )
            return [*prefix, *new_retained], meta
        except Exception as e:  # noqa: BLE001 - 精修失败绝不阻塞压缩主链路
            logger.warning("[agent-loop] 保留区预算精修失败(降级原产物): %s", e)
            return compressed, {"enabled": True, "applied": False, "reason": "error"}

    def _resolve_effort_for_request(self, selected_effort: Any) -> str | None:
        """批58(十九):采样请求的推理努力档位解析(对标 codex reasoning_effort_for_request)。

        - 未启用钉扎(None)→ 返回 None(不注入覆盖,参数透传面零差异);
        - 模型名取 modelParams.model → env AGENT_MODEL_NAME → "default"(单模型场景);
        - 有效档位由 core.reasoning_effort_pin 的三道门判定(总开关/模型白名单/
          已知后端模式),未知档位不注入(注入项有界于已知模式);
        - 采样成功后钉扎粘滞:同窗内后续请求返回既有档位(封顶模型漂移)。
        """
        pin = getattr(self, "_reasoning_effort_pin", None)
        if pin is None:
            return None
        model = str(
            self._model_params.get("model")
            or os.environ.get("AGENT_MODEL_NAME")
            or "default"
        )
        selected = selected_effort if isinstance(selected_effort, str) else None
        # 先过"有效档位"三道门:门不满足(模型不在白名单/档位非法/无档位)时既不建立
        # 钉扎也不注入覆盖——避免把同一非法值重复写回参数面(与现有透传行为零差异)。
        if pin.effort_for_configuration_update(model, selected) is None:
            return None
        from app.core.reasoning_effort_pin import RequestEffortUsage

        resolved = pin.reasoning_effort_for_request(
            model, selected, RequestEffortUsage.SAMPLING
        )
        return resolved if isinstance(resolved, str) else None

    def _retire_effort_pin_on_compaction(self) -> None:
        """压缩成功 → 退役档位钉扎(对标 codex 压缩落账内联的 ReasoningEffortPin::Compacted)。

        未启用钉扎时为 no-op;异常隔离(退役失败不影响压缩主链路)。
        """
        pin = getattr(self, "_reasoning_effort_pin", None)
        if pin is None:
            return
        try:
            pin.retire_on_compaction()
        except Exception:  # noqa: BLE001 - 退役失败仅影响档位精度
            pass

    def _inject_decision_chain(
        self, compressed: list[dict[str, Any]], source_messages: list[dict[str, Any]]
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """P1-②(2026-09-18)决策链保留:把被压缩 head 段的推理蒸馏并注入摘要消息。

        纯确定性(零 LLM 调用 / 零额外网络 / 零额外延迟):扫描 head 段每个带工具调用的
        assistant 轮次 → 推理(截断)+ 动作(工具名 + 成败 + 失败报错片段)→ 结构化条目,
        追加进压缩产物的摘要消息末尾。跨多次压缩幂等(先剥离旧块再注入)且旧条目接续。

        降级语义:开关关闭(AGENT_DECISION_CHAIN_ENABLED=off)/ 无摘要消息 / 无 head /
        蒸馏与注入任何异常 → 原样返回,压缩产物与未接入前逐零差异(增强层绝不阻塞压缩)。
        """
        from .decision_chain import apply_decision_chain

        out, meta = apply_decision_chain(
            compressed, source_messages, keep_recent=DEFAULT_COMPACTION_KEEP_RECENT
        )
        if meta.get("injected"):
            retention = meta.get("reasoning_retention") or {}
            logger.info(
                "[agent-loop] 决策链注入 %s 条(新增 %s / 接续 %s),推理保留率 %s",
                meta.get("entries"),
                meta.get("fresh"),
                meta.get("carried"),
                retention.get("retention_ratio"),
            )
        elif meta.get("reason") not in ("", "disabled"):
            logger.debug("[agent-loop] 决策链未注入: %s", meta.get("reason"))
        return out, meta

    def _snapshot_before_write(self, tc: ToolCall) -> None:
        """1-2 自动回滚:写盘工具执行前捕获目标文件快照(尽力而为,失败仅 debug)。

        每文件仅首次写盘前快照(保留「本次 run 开始前」的原始内容,后续
        checkpoint 引用同一版本 → 回滚恢复到 run 起点而非中间态)。
        快照写入 file_editor 内存/Redis 版本库,引用存 self._run_file_snapshots。
        """
        if tc.name not in ("file_edit", "write_file", "edit_file"):
            return
        args = tc.args if isinstance(tc.args, dict) else {}
        path = args.get("file_path") or args.get("path") or ""
        if not isinstance(path, str) or not path:
            return
        try:
            from .file_editor import snapshot_file

            absolute = os.path.abspath(path)
            # 路径不在本 run 已快照集合时才拍(每文件首次)
            if absolute in self._run_file_snapshots:
                return
            snap = snapshot_file(self._ensure_session_id(), absolute)
            self._run_file_snapshots[absolute] = snap
        except Exception as e:  # noqa: BLE001 - 快照失败不阻塞工具执行
            logger.debug("1-2 文件快照失败(%s): %s", path, e)

    async def _save_checkpoint_safe(
        self,
        iteration: int,
        messages: list[dict[str, Any]],
        status: str,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """安全保存 checkpoint(失败只 log warning,不阻塞 loop)。返回 checkpoint_id 或 None。"""
        if not self.enable_checkpoint:
            return None
        try:
            session_id = self._ensure_session_id()
            # 1-2:传文件快照引用 → checkpoint metadata.file_versions 有真实内容,
            # restore(rollback_files=true) 可真正回滚本次 run 的文件修改。
            file_snapshots = list(self._run_file_snapshots.values()) or None
            ckpt_id = await self._checkpoint_manager.save_checkpoint(
                session_id=session_id,
                iteration=iteration,
                messages=messages,
                tool_state=self._tool_state,
                status=status,
                metadata=metadata,
                file_snapshots=file_snapshots,
                owner_user_id=self._user_id,
            )
            # 1-5:跟踪最新 checkpoint id(供 tool.after 事件与 step 录制的
            # rollback 证据引用;失败/None 时保留上一个)
            if ckpt_id:
                self._last_checkpoint_id = ckpt_id
            return ckpt_id
        except Exception as e:
            logger.warning(
                "Agent 循环 checkpoint 保存失败(iter=%d status=%s): %s",
                iteration,
                status,
                e,
            )
            return None

    async def _maybe_self_heal(
        self,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_calls: list[ToolCall],
        tool_results: list[ToolResult],
    ) -> None:
        """2-3 自愈集成(2026-09-12):本轮 run_command 出现失败 pytest 信号时触发 heal。

        门控:AGENT_SELF_HEALING_ENABLED(默认 off)+ 单 run 次数上限 +
        同命令去重;全链路 fail-open(任一环节失败仅 warning,不阻塞主循环)。
        护栏:patch_fn 落盘前对将被补丁的文件拍快照(pre-heal 内容),
        heal 未修复时按 version_id 回滚全部被补丁文件。
        结果:以 user 消息注入对话(所有 provider 契约安全),LLM 感知后继续。
        """
        if not _self_heal_enabled_from_env():
            return
        if self._self_heal_runs >= _self_heal_max_per_run_from_env():
            return
        signal = _detect_failed_test_signal(tool_calls, tool_results)
        if signal is None:
            # V3 #56(2026-09-26)信号源扩展:pytest 专用检测未命中时,走四类
            # 分类器兜底(测试框架/类型检查/构建/lint,actionable 才触发)。
            # 默认仍 off(AGENT_SELF_HEALING_ENABLED),放量待办见
            # self_healing.classify_run_command_signal 注释。
            signal = _detect_extended_signal(tool_calls, tool_results)
            if signal is None:
                return
        if signal["command"] in self._self_heal_commands:
            return
        self._self_heal_runs += 1
        self._self_heal_commands.add(signal["command"])
        session_id = self._ensure_session_id()

        # heal 安全 checkpoint(供人工 rewind;文件级回滚护栏走补丁前快照)
        checkpoint_id = await self._save_checkpoint_safe(
            iteration=iteration,
            messages=messages,
            status="running",
            metadata={
                "self_heal": True,
                "command": signal["command"],
                "failed": signal["failed"],
                "exit_code": signal["exit_code"],
            },
        )
        await self._events.emit("self_heal", {
            "session_id": session_id,
            "iteration": iteration,
            "phase": "started",
            "command": signal["command"],
            "failed": signal["failed"],
            "exit_code": signal["exit_code"],
            "checkpoint_id": checkpoint_id,
        })

        # 工作区白名单校验(与 MCP 同一套根,防 heal 目标越界)
        from .mcp_server import _validate_path_in_workspace

        ok, info = _validate_path_in_workspace(signal["target"])
        if not ok:
            logger.warning("[self_heal] 目标不在工作区白名单,跳过 heal: %s", info)
            return

        # 回滚护栏:补丁落盘前对目标文件拍快照(每文件首次,保留 pre-heal 内容)
        heal_snapshots: dict[str, str] = {}  # file_path -> version_id
        patch_events: list[dict[str, Any]] = []  # PostApplyPatch 事件收集(闭包同步,async 层发)

        def _patch_adapter(task: Any, result: Any) -> dict[str, Any] | None:
            """heal patch_fn 契约 (task, result):生成补丁 → 落盘前快照 → 应用。"""
            from .self_healing_llm import apply_patch_descriptor, llm_patch_fn

            failures = result.get("failures") if isinstance(result, dict) else None
            failure = failures[0] if failures else task
            # 2026-09-12 修复:显式注入真实工作区路径。否则 LLM 只看到 pytest 失败文本
            # 会编造容器式路径(实测 /app/src/*.py),补丁被工作区白名单拒绝 → 自愈
            # 永远落不了盘(applied=false)。
            ctx: Any = dict(result) if isinstance(result, dict) else {"result": result}
            ctx["task"] = task
            ctx["workspace_root"] = str(info)
            ctx["target_path"] = str(info)
            from .self_healing_llm import list_workspace_files

            ctx["workspace_files"] = list_workspace_files(str(info))
            # 失败测试的真实源码(断言)注入:否则 LLM 只看归因消息会猜错修复方向。
            # 与 routers/self_healing._patch_adapter 保持同一行为(同一函数、同一时机)。
            from .self_healing_llm import read_failure_sources

            ctx["failing_test_source"] = read_failure_sources(failure, ctx)
            patch = llm_patch_fn(failure, ctx)
            if patch is None:
                return None
            file_path = str(patch.get("file_path") or "")
            if file_path and file_path not in heal_snapshots:
                try:
                    from .file_editor import snapshot_file

                    snap = snapshot_file(session_id, file_path)
                    heal_snapshots[file_path] = str(snap["version_id"])
                except Exception as e:  # noqa: BLE001 - 快照失败不阻断补丁
                    logger.debug("[self_heal] 补丁前快照失败(%s): %s", file_path, e)
            applied, apply_info = apply_patch_descriptor(patch)
            patch = {**patch, "applied": applied}
            # PostApplyPatch hook(2026-09-18 立,对标 Codex harness 事件词汇):
            # 补丁应用结果先收集,由 _maybe_self_heal 的 async 层统一发 patch.applied
            # (本闭包为同步函数,不能 await;hook_engine 白名单已收录该事件)。
            patch_events.append(
                {
                    "session_id": self._session_id or "",
                    "file_path": patch.get("file_path"),
                    "applied": applied,
                    "apply_info": apply_info if isinstance(apply_info, dict) else str(apply_info),
                }
            )
            if not applied:
                patch["apply_error"] = apply_info
            return patch

        try:
            from starlette.concurrency import run_in_threadpool

            from .self_healing import heal
            from .self_healing_llm import (
                CommandReplayRunner,
                PytestSubprocessRunner,
                llm_gen_fn,
            )

            if signal.get("category"):
                # V3 #56:非 pytest 类信号(类型/构建/lint/非 pytest 测试框架)。
                # 验证语义 = 重放原命令、退出码归零判绿,不能用 PytestSubprocessRunner
                # (它只会重跑 pytest,对这些命令是错误判据);error_digest 直接
                # 进 task_desc,LLM 补丁拿到的就是错误摘要而非空转。
                category = str(signal["category"])
                digest = str(signal.get("error_digest") or "")
                task_desc = (
                    f"{_SELF_HEAL_CATEGORY_TASK_DESC.get(category, '修复命令失败并让验证命令通过(exit=0)')}"
                    f"。失败命令: {signal['command']}"
                    f"(exit_code={signal['exit_code']})。错误摘要:\n{digest}"
                )
                runner: Any = CommandReplayRunner(signal["command"], cwd=str(info))
            else:
                task_desc = (
                    f"修复失败测试并让 pytest 通过。失败命令: {signal['command']}"
                    f"(exit_code={signal['exit_code']}, failed={signal['failed']})"
                )
                runner = PytestSubprocessRunner(info)
            # heal 是同步函数(内部 LLM 桥自带事件循环),必须 threadpool 包装,
            # 避免在 agent loop 的事件循环内同 loop await 造成死锁。
            outcome = await run_in_threadpool(
                heal,
                task_desc,
                None,  # test_cases -> 由 gen_fn 生成
                gen_fn=llm_gen_fn,
                runner=runner,
                patch_fn=_patch_adapter,
            )
            outcome_dict = outcome.to_dict() if hasattr(outcome, "to_dict") else {}
        except Exception as e:  # noqa: BLE001 - heal 失败不阻塞主循环
            logger.warning("[self_heal] heal 执行失败(降级,不阻塞主循环): %s", e)
            outcome_dict = {"ok": False, "error": str(e)}

        # PostApplyPatch 事件统一发射(闭包内收集;失败降级不阻塞主循环)
        for _pe in patch_events:
            with contextlib.suppress(Exception):
                await self._events.emit("patch.applied", _pe)

        # 回滚护栏:heal 未修复时,把所有被补丁文件回滚到 pre-heal 快照
        rollback_results: list[dict[str, Any]] = []
        if outcome_dict.get("ok") is not True and heal_snapshots:
            try:
                from .file_editor import rollback_file

                for path, version_id in heal_snapshots.items():
                    try:
                        rollback_results.append(
                            rollback_file(session_id, path, version_id=version_id)
                        )
                    except Exception as e:  # noqa: BLE001 - 单文件回滚失败继续其余
                        rollback_results.append({"ok": False, "path": path, "message": str(e)})
            except Exception as e:  # noqa: BLE001 - 回滚层失败不阻塞主循环
                logger.warning("[self_heal] 回滚护栏执行失败: %s", e)
        rolled = sum(1 for r in rollback_results if r.get("ok"))

        await self._events.emit("self_heal", {
            "session_id": session_id,
            "iteration": iteration,
            "phase": "finished",
            "command": signal["command"],
            "ok": outcome_dict.get("ok"),
            "attempts": outcome_dict.get("attempts"),
            "rollbacks": rollback_results,
            "checkpoint_id": checkpoint_id,
        })

        if outcome_dict.get("ok") is True:
            # V3 #56:扩展信号的修复对象不是"测试",措辞按信号来源区分,
            # 避免给 LLM/用户"去改测试"的错误暗示。
            if signal.get("category"):
                fixed_noun = f"验证命令 {signal['command']} 已修复通过"
            else:
                fixed_noun = "失败测试已修复"
            summary = (
                f"[self-heal] 自动修复成功:{fixed_noun}"
                f"(attempts={outcome_dict.get('attempts')})。"
            )
        else:
            summary = (
                f"[self-heal] 自动修复未成功(attempts={outcome_dict.get('attempts')}),"
                f"已回滚 {rolled} 个补丁文件到自愈前内容;请继续用其他方式修复。"
            )
        messages.append({"role": "user", "content": summary})
        logger.info(
            "[self_heal] iter=%d heal 完成(ok=%s, attempts=%s, 回滚 %d 文件)",
            iteration,
            outcome_dict.get("ok"),
            outcome_dict.get("attempts"),
            rolled,
        )

    async def run(self, messages: list[dict[str, Any]]) -> AgentLoopResult:
        """执行完整 ReAct 循环。

        签名与 v2 初版保持一致(不破坏 11 个已有测试用例)。
        Wave 9 扩展:每轮 iteration 结束后自动 checkpoint(若 enable_checkpoint),
        异常/暂停/取消时也保存 checkpoint,便于 resume_from_checkpoint 续跑。

        L1-1 扩展(2026-07-25,对标 Hermes Agent 默认在线记忆):
        - 入口:自动加载用户跨会话记忆注入 system prompt(让 ReAct 主循环不再失忆)
        - 出口:成功完成后自动提取记忆写回 API(失败不阻塞,不覆盖 result)
        """
        self._reset_run_state()
        # Hook 引擎: session.start(1-5 起经事件流层发射,失败降级不阻塞)
        await self._events.session_start(
            session_id=self._session_id or "",
            user_id=self._user_id or "",
            conversation_id=self._conversation_id or "",
            max_iterations=self.max_iterations,
        )
        self._ensure_session_id()
        self._messages = messages
        # 批58(接线):会话启动预热(对标 codex session_startup_prewarm.rs)。
        # 后台发起预热任务;关闭时零动作、首回合零额外延迟,与现状逐零差异。
        await self._maybe_start_startup_prewarm()
        # L1-1 入口:注入跨会话记忆到 system prompt(失败不阻塞)
        await self._inject_memory_context(messages)
        # W1(2026-09):入口:注入用户画像 snippet(对标 v1 P0 注入,复用 v1 实现)
        await self._inject_user_profile(messages)
        # 1-7 团队接力(P3-3,2026-09-03 立):入口:注入团队上一轮聚合摘要。
        # 默认关闭;开启且存在接力上下文时才改动 system prompt,否则为 no-op(零差异)。
        await self._inject_team_relay_context(messages)
        # L4 自进化:注入 meta_lessons 避坑指南到 system prompt(失败降级,不阻塞)
        # build_system_prompt_snippet 是同步方法(读内存缓存),失败只 warning
        try:
            from .meta_learner import meta_learner
            lessons_snippet = meta_learner.build_system_prompt_snippet()
            if lessons_snippet:
                if (
                    messages
                    and isinstance(messages[0], dict)
                    and messages[0].get("role") == "system"
                ):
                    existing = messages[0].get("content", "")
                    messages[0]["content"] = (
                        f"{existing}\n\n{lessons_snippet}" if existing else lessons_snippet
                    )
                else:
                    messages.insert(0, {"role": "system", "content": lessons_snippet})
        except Exception as e:
            logger.warning(
                "meta_learner.build_system_prompt_snippet 失败(降级,不阻塞): %s", e
            )
        # L5-7 自进化:注入元认知反思发现到 system prompt(2026-08-12 立)。
        # 与 meta_learner lesson 同模式:同步方法读内存缓存,失败降级不阻塞。
        try:
            from .metacognition import metacognition
            meta_snippet = metacognition.build_system_prompt_snippet()
            if meta_snippet:
                if (
                    messages
                    and isinstance(messages[0], dict)
                    and messages[0].get("role") == "system"
                ):
                    existing = messages[0].get("content", "")
                    messages[0]["content"] = (
                        f"{existing}\n\n{meta_snippet}" if existing else meta_snippet
                    )
                else:
                    messages.insert(0, {"role": "system", "content": meta_snippet})
        except Exception as e:
            logger.warning(
                "metacognition.build_system_prompt_snippet 失败(降级,不阻塞): %s", e
            )
        # 2026-09-18 第三批(Goals 对标):线程持久目标注入 system,全程可见;失败降级。
        if self._thread_goal:
            try:
                goal_line = f"[线程目标] {self._thread_goal}"
                if (
                    messages
                    and isinstance(messages[0], dict)
                    and messages[0].get("role") == "system"
                ):
                    messages[0]["content"] = f"{messages[0].get('content', '')}\n\n{goal_line}"
                else:
                    messages.insert(0, {"role": "system", "content": goal_line})
            except Exception as e:
                logger.warning("线程目标注入失败(降级): %s", e)
        # 批58(接线):首回合前限时兑现启动预热(绝不无限阻塞,失败静默降级)。
        await self._resolve_startup_prewarm()
        result = await self._run_loop(
            messages=messages,
            start_iteration=1,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(UTC),
        )
        # 1-7 团队接力(2026-09-03 立):把本次 run 的接力注入元信息挂到产物,供上层读取。
        # 未启用 / 无接力上下文时 _team_relay_info 为 None,result.team_relay 保持 None(零差异)。
        if self._team_relay_info is not None:
            result.team_relay = dict(self._team_relay_info)
        # 1-6 token 治理:填充预算摘要(budget_exceeded 分支已在 return 内设置;
        # 此处为正常/其它停止原因补摘要,供未来 web 面板接数据)。失败降级不阻塞。
        if self._budget_enabled and result.budget is None:
            try:
                summary = await llm_budget_governor.get_usage_summary("today")
                pillar_budget = await llm_budget_governor.get_pillar_budget(self._budget_pillar)
                result.budget = {
                    "enabled": True,
                    "pillar": self._budget_pillar,
                    "usage_percent": summary["usage_percent"],
                    "today_tokens": summary["total_tokens"],
                    "pillar_usage_percent": pillar_budget["usage_percent"],
                    "degraded_model": pillar_budget.get("degraded_model"),
                    "stopped_at_iteration": None,
                }
            except Exception as e:
                logger.warning("budget 摘要获取失败(降级): %s", e)
                result.budget = {"enabled": True, "pillar": self._budget_pillar, "error": str(e)}
        # L1-1 出口:成功完成后保存记忆(失败不阻塞,不覆盖 result)
        if result.success:
            await self._persist_memory_insights(messages)
            # W1(2026-09):v1 特性闭环移植(对标 agent_loop.py L422-466 完成后出口)。
            # GraphRAG / memory consolidate / Skill 自进化评估,全部 fire-and-forget
            # + 失败 logger.warning 降级,绝不阻塞主链路 / 不覆盖已生成的 result。
            self._fire_post_success_closures(messages)
        # L4 自进化:后置自评 fire-and-forget(成功/失败都触发,不阻塞主链路)
        # paused/cancelled 状态不触发(用户主动操作,非真实失败,无可学习信号)
        if result.stop_reason in {"completed", "error", "max_iterations"}:
            try:
                from dataclasses import asdict

                from .meta_learner import meta_learner
                task_input_text = ""
                if messages and isinstance(messages[0], dict):
                    task_input_text = str(messages[0].get("content", ""))
                eval_task = asyncio.create_task(
                    meta_learner.evaluate_and_record(
                        task_result=asdict(result),
                        task_input=task_input_text,
                        skill_name="default",
                    )
                )
                _pending_meta_eval_tasks.add(eval_task)
                eval_task.add_done_callback(_pending_meta_eval_tasks.discard)
            except Exception as e:
                logger.warning(
                    "meta_learner.evaluate_and_record 启动失败(降级,不阻塞): %s", e
                )
        # D27(2026-09)任务完成交付清单:仅成功结束时构建并存储,经 session_end
        # 的可选 deliverables 字段下发;任何失败降级 warning,不阻塞、不覆盖 result。
        deliverables_payload: dict[str, Any] | None = None
        if result.success:
            try:
                deliverables_payload = self._deliverables.build(
                    str(result.final_response or "")[:500]
                )
                save_deliverables(self._session_id or "", deliverables_payload)
            except Exception as e:
                logger.warning("交付清单构建/存储失败(降级,不阻塞): %s", e)
                deliverables_payload = None
        # Hook 引擎: session.end(1-5 起经事件流层发射,失败降级不阻塞)
        await self._events.session_end(
            session_id=self._session_id or "",
            user_id=self._user_id or "",
            success=result.success,
            stop_reason=result.stop_reason,
            total_iterations=len(result.iterations),
            total_duration_ms=result.total_duration_ms,
            deliverables=deliverables_payload,
        )
        # L5-12(2026-08-12):执行次数指标埋点(按 stop_reason)
        try:
            from ..middleware.agent_metrics import agent_loop_runs_total
            agent_loop_runs_total.labels(result.stop_reason).inc()
        except Exception as exc:
            logger.debug("agent_loop_runs_total 指标埋点失败(不阻塞): %s", exc)
        # 1-3 压缩生产指标:发生过压缩的 run 记录最终结果(压缩后任务是否继续成功)
        self._record_compaction_run_outcome(result)
        return result

    # ------------------------------------------------------------------
    # L1-1 记忆闭环辅助(2026-07-25 立,对标 Hermes Agent 默认在线记忆)
    # ------------------------------------------------------------------

    def _resolve_memory_service(self) -> Optional["MemoryService"]:
        """lazy 解析 MemoryService 实例(避免顶层循环导入)。

        优先用注入的 memory_svc(测试 mock);否则 lazy import 全局单例。
        导入失败返回 None(记忆闭环静默降级,不阻塞主循环)。
        """
        if self._memory_svc is not None:
            return self._memory_svc
        try:
            from .memory_service import memory_service as _ms
            return _ms
        except ImportError as e:
            logger.warning("memory_service 导入失败,记忆闭环降级: %s", e)
            return None

    async def _inject_memory_context(self, messages: list[dict[str, Any]]) -> None:
        """入口:加载用户跨会话记忆注入 system prompt。

        策略:
        - 首条是 system 消息 → append 到 content(避免新增消息打乱 LLM 上下文顺序)
        - 否则 insert 新 system 消息到 messages[0]
        - load 失败 / 无记忆 / 记忆服务不可用 → 静默跳过,不阻塞主循环
        """
        if not self._enable_memory or not self._user_id:
            return
        svc = self._resolve_memory_service()
        if svc is None:
            return
        try:
            ctx = await svc.load_context_for_conversation(
                user_id=self._user_id,
                session_id=self._conversation_id or self._session_id,
            )
        except Exception as e:
            logger.warning("memory_load 失败(user=%s): %s", self._user_id, e)
            return
        if not ctx:
            return
        try:
            if messages and isinstance(messages[0], dict) and messages[0].get("role") == "system":
                existing = messages[0].get("content", "")
                messages[0]["content"] = f"{existing}\n\n{ctx}" if existing else ctx
            else:
                messages.insert(0, {"role": "system", "content": ctx})
        except Exception as e:
            logger.warning("memory_context 注入失败(user=%s): %s", self._user_id, e)

    async def _inject_user_profile(self, messages: list[dict[str, Any]]) -> None:
        """入口:用户画像注入(对标 v1 L237-273 的 P0 注入,与 _inject_memory_context 同源)。

        复用 v1 AgentExecutor 的 _resolve_user_id / _build_profile_snippet 实现,
        避免重复实现;失败降级不阻塞主循环。仅在记忆闭环启用(_enable_memory)时注入,
        与 v1 行为一致(user_id 缺失则 debug 跳过)。
        """
        if not self._enable_memory:
            return
        # user_id 优先用构造注入;否则复用 v1 的 session_id 复合前缀解析逻辑
        user_id = self._user_id or ""
        try:
            from .agent_loop import AgentExecutor

            resolved = AgentExecutor._resolve_user_id(
                self._session_id or "", {"user_id": self._user_id}
            )
            if resolved:
                user_id = resolved
        except Exception as exc:
            logger.debug("_resolve_user_id 回退失败,沿用原始 user_id(如有): %s", exc)
        if not user_id:
            return
        snippet = ""
        try:
            from .agent_loop import AgentExecutor

            snippet = AgentExecutor._build_profile_snippet(AgentExecutor(), user_id)
        except Exception as e:
            logger.warning(
                "user_profile.build_system_prompt_snippet 失败(降级,不阻塞): %s", e
            )
            return
        if not snippet:
            return
        try:
            if (
                messages
                and isinstance(messages[0], dict)
                and messages[0].get("role") == "system"
            ):
                existing = messages[0].get("content", "")
                messages[0]["content"] = f"{existing}\n\n{snippet}" if existing else snippet
            else:
                messages.insert(0, {"role": "system", "content": snippet})
        except Exception as e:
            logger.warning("user_profile snippet 注入失败(降级,不阻塞): %s", e)

    # ------------------------------------------------------------------
    # 1-7 团队接力辅助(P3-3,2026-09-03 立;对标 meta_learner/metacognition 注入模式)
    # 设计铁律:默认关闭;开启且存在接力上下文才改动 system prompt;任何异常静默降级,
    # 绝不阻塞主循环、不改动默认路径。结果写入 _team_relay_info 供可观测。
    # ------------------------------------------------------------------

    async def _resolve_team_relay_context(self) -> tuple[str, dict[str, Any]]:
        """解析团队上一轮接力上下文,返回 (summary_text, meta)。

        优先显式注入的 `team_context`(弱耦合,与黑板书任意一种即可):
        - 结构化 dict / 纯文本 str → 直接规范化
        - 否则若注入 `team_blackboard`(AgentBlackboard),从默认 key 读取(支持
          JSON 或纯文本 value)。无结果 → ("", {})。
        """
        if self._team_context is not None:
            return _normalize_team_relay_context(self._team_context)
        if self._team_blackboard is not None:
            try:
                entry = await self._team_blackboard.read(
                    TEAM_RELAY_BLACKBOARD_KEY, "agent_loop"
                )
            except Exception as e:
                raise RuntimeError(
                    f"team_blackboard 读取「{TEAM_RELAY_BLACKBOARD_KEY}」失败: {e}"
                ) from e
            if entry is None or not entry.value:
                return "", {}
            value = entry.value
            try:
                parsed = json.loads(value) if isinstance(value, str) else value
            except (ValueError, TypeError):
                return str(value or ""), {}
            if isinstance(parsed, dict):
                return _normalize_team_relay_context(parsed)
            return str(parsed or ""), {}
        return "", {}

    @staticmethod
    def _build_team_relay_block(summary: str, meta: dict[str, Any]) -> str:
        """把团队上一轮聚合摘要组装为结构化上下文块,追加到 system prompt。"""
        lines: list[str] = [
            "## 团队接力摘要 (Team Relay)",
            "以下为上一轮团队协作聚合结果,请据此继续决策:",
        ]
        if meta.get("objective"):
            lines.append(f"目标: {meta['objective']}")
        parts: list[str] = []
        if "round_index" in meta and "round_count" in meta:
            parts.append(
                f"round {int(meta['round_index']) + 1}/{int(meta['round_count'])}"
            )
        if "strategy" in meta:
            parts.append(f"策略 {meta['strategy']}")
        if "succeeded" in meta:
            parts.append(f"成功 {meta['succeeded']}")
        if "failed" in meta:
            parts.append(f"失败 {meta['failed']}")
        if parts:
            lines.append(" | ".join(parts))
        if meta.get("contributors"):
            names = meta["contributors"]
            if isinstance(names, list):
                names = ", ".join(str(n) for n in names)
            lines.append(f"参与 agent: {names}")
        lines.append("--- 聚合摘要内容 ---")
        lines.append(summary)
        return "\n".join(lines)

    async def _inject_team_relay_context(self, messages: list[dict[str, Any]]) -> None:
        """入口:把团队上一轮聚合摘要注入 system prompt(默认关闭,失败静默降级)。

        行为:
        - 总开关关闭(_team_relay_enabled=False)→ no-op,默认路径与现状逐零差异。
        - 开启但无接力上下文 → 记录 injected=False(空摘要,正常运行),不炸主循环。
        - 开启且有摘要 → 追加"团队接力摘要"段到首条 system 消息 content。
        - 任何异常 → logger.warning + 记录 error,injected=False,不阻塞主循环。
        注入元信息写入 self._team_relay_info,由 run() 回填到 result.team_relay。
        """
        info: dict[str, Any] = {"enabled": True, "injected": False}
        if not self._team_relay_enabled:
            # 未启用:直接返回,不写入 _team_relay_info(确保 result.team_relay 为 None)
            return
        try:
            summary, meta = await self._resolve_team_relay_context()
        except Exception as e:
            info["error"] = str(e)
            self._team_relay_info = info
            logger.warning("team_relay 上下文解析失败(降级,不阻塞): %s", e)
            return
        if not summary or not summary.strip():
            # 无接力摘要:正常运行(注入未发生),不炸主循环。
            self._team_relay_info = info
            return
        # 摘要截断(防上下文膨胀),并记录元信息
        truncated = len(summary) > TEAM_RELAY_SUMMARY_MAX
        body = summary[:TEAM_RELAY_SUMMARY_MAX]
        info.update({
            "round_index": meta.get("round_index"),
            "round_count": meta.get("round_count"),
            "strategy": meta.get("strategy"),
            "contributors": meta.get("contributors"),
            "summary_length": len(summary),
            "summary_truncated": truncated,
        })
        # 组装 + 写入统一守卫:block 构建或注入写失败均静默降级,绝不阻塞主循环。
        try:
            block = self._build_team_relay_block(body, meta)
            if (
                messages
                and isinstance(messages[0], dict)
                and messages[0].get("role") == "system"
            ):
                existing = messages[0].get("content", "")
                messages[0]["content"] = (
                    f"{existing}\n\n{block}" if existing else block
                )
            else:
                messages.insert(0, {"role": "system", "content": block})
            info["injected"] = True
        except Exception as e:
            info["error"] = str(e)
            logger.warning("team_relay 摘要注入失败(降级,不阻塞): %s", e)
        self._team_relay_info = info

    async def _persist_memory_insights(self, messages: list[dict[str, Any]]) -> None:
        """出口:从对话提取记忆写回 API(仅 run() 成功时调用)。

        失败不阻塞主循环(已 success 的 result 不被覆盖)。
        """
        if not self._enable_memory or not self._user_id:
            return
        svc = self._resolve_memory_service()
        if svc is None:
            return
        try:
            await svc.save_insights_from_conversation(
                user_id=self._user_id,
                messages=messages,
                session_id=self._conversation_id or self._session_id,
            )
            # D27(2026-09):记忆写回成功 → 交付清单记 memory citation。
            # save_insights_from_conversation 无 entry id 返回,url 按降级纪律为 None。
            self._deliverables.record_citation("memory", "对话记忆提炼", None)
        except Exception as e:
            logger.warning("memory_save 失败(user=%s): %s", self._user_id, e)

    # ------------------------------------------------------------------
    # W1(2026-09)完成后出口闭环辅助(对标 v1 L384-468,移植到 v2 完成路径)
    # 设计铁律:全部 fire-and-forget + 失败 logger.warning 降级,绝不阻塞主链路
    # ------------------------------------------------------------------

    def _fire_closure_task(self, coro: Any) -> None:
        """fire-and-forget 启动一个闭环协程(失败降级,不阻塞主链路)。

        复用 _pending_closure_tasks 持有 task 引用,防 CPython GC 在 task 完成前
        提前回收(与 _pending_meta_eval_tasks 同模式)。coro 创建/调度失败也仅 warning。
        """
        try:
            task = asyncio.create_task(coro)
            _pending_closure_tasks.add(task)
            task.add_done_callback(_pending_closure_tasks.discard)
        except Exception as e:
            logger.warning("闭环 task 启动失败(降级,不阻塞): %s", e)

    def _fire_post_success_closures(self, messages: list[dict[str, Any]]) -> None:
        """run() 成功后出口闭环(对标 v1 的 GraphRAG / consolidate / Skill 自进化评估)。

        仅在已解析到 user_id 时触发;全部 fire-and-forget,失败仅 logger.warning,
        绝不阻塞主链路 / 不覆盖已生成的 result。gating 与 v1 完全一致:
        auto_graph_extract_enabled 或 LLM stub 模式才抽取图谱;consolidate 同 gating。
        """
        if not self._user_id:
            return
        user_id = self._user_id
        session_id = self._conversation_id or self._session_id or ""

        # P0 GraphRAG 闭环:开关开启或 stub 模式抽取实体建图谱(与 v1 L427-446 同 gating)
        try:
            from ..core.config import settings
            from ..core.llm_gateway import LLMGateway

            if settings.auto_graph_extract_enabled or LLMGateway._is_stub_mode():
                from .knowledge_graph import knowledge_graph_service

                graph_text = "\n".join(
                    str(m.get("content", ""))
                    for m in messages[-8:]
                    if isinstance(m, dict) and m.get("role") in ("user", "assistant")
                )
                if graph_text.strip():
                    self._fire_closure_task(
                        knowledge_graph_service.extract(graph_text[-8000:], owner_uuid=user_id)
                    )
        except Exception as e:
            logger.warning("auto graph extract 启动失败(降级,不阻塞): %s", e)

        # P1-3 记忆提炼闭环:与 auto graph extract 同一 gating,episodic→semantic consolidate
        try:
            from ..core.config import settings
            from ..core.llm_gateway import LLMGateway

            if settings.auto_graph_extract_enabled or LLMGateway._is_stub_mode():
                svc = self._resolve_memory_service()
                if svc is not None:
                    self._fire_closure_task(
                        svc.consolidate(
                            user_id=user_id,
                            messages=messages[-8:],
                            session_id=session_id,
                        )
                    )
        except Exception as e:
            logger.warning("consolidate 启动失败(降级,不阻塞): %s", e)

        # L4 Skill 自进化评估(对标 v1 L384-401)
        try:
            from .skills import SkillEvolutionService, skill_registry

            evolution = SkillEvolutionService()
            goal = ""
            for m in messages:
                if isinstance(m, dict) and m.get("role") == "user":
                    goal = str(m.get("content", ""))
                    break
            final_content = ""
            if (
                messages
                and isinstance(messages[-1], dict)
                and messages[-1].get("role") == "assistant"
            ):
                final_content = str(messages[-1].get("content", ""))
            steps = [
                {
                    "iteration": i + 1,
                    "role": mm.get("role") if isinstance(mm, dict) else None,
                    "content": mm.get("content") if isinstance(mm, dict) else None,
                }
                for i, mm in enumerate(messages)
            ]
            self._fire_closure_task(
                evolution.evaluate({
                    "taskId": self._session_id or "",
                    "sessionId": session_id,
                    "goal": goal,
                    "steps": steps,
                    "finalResult": final_content,
                    "existingSkills": [s.name for s in skill_registry.list_skills()],
                })
            )
            # D27(2026-09):Skill 自进化评估已触发 → 交付清单记 skill citation。
            # source_url 由异步评估流程决定,此处拿不到,按契约回退 /skills。
            self._deliverables.record_citation(
                "skill", (goal[:60].strip() or "Skill 自进化评估"), "/skills"
            )
        except Exception as e:
            logger.warning("Skill 自进化评估启动失败(降级,不阻塞): %s", e)

    @staticmethod
    def _detect_on_chunk_support(fn: Callable[..., Any]) -> bool:
        """检测 llm_complete_fn 签名是否接受 on_chunk 关键字参数。

        判定:显式 on_chunk 参数或 **kwargs 收集参数任一命中即支持;
        签名不可内省(如 Mock 未设签名)按不支持处理(保守,回退非流式)。
        """
        try:
            sig = inspect.signature(fn)
        except (TypeError, ValueError):
            return False
        for p in sig.parameters.values():
            if p.kind is inspect.Parameter.VAR_KEYWORD:
                return True
            if p.name == "on_chunk":
                return True
        return False

    def _make_on_chunk(self, iteration: int) -> Callable[[str], Awaitable[None]]:
        """构造本轮 LLM 流式 chunk 回调(逐 chunk 发 thinking.delta 增量)。

        回调内部失败由 AgentEventStream.emit 降级吸收,不影响 LLM 流消费;
        发射增量帧 is_final=False,结束后 _run_loop 补发 is_final=True 结束帧。
        """
        session_id = self._session_id or ""

        async def _on_chunk(text: str) -> None:
            if not text:
                return
            await self._events.emit_thinking_delta(
                session_id, text, iteration=iteration, is_final=False
            )

        return _on_chunk

    async def _wait_interruptible(self, coro: Any) -> Any:
        """等待 coro 完成,期间周期轮询 cancel/pause 标志(0.25s 间隔)。

        P0-B(2026-09-18):此前 cancel/pause 只在轮次边界生效,长 LLM 调用与
        长工具执行(如 run_command 数分钟)期间无法中断。本包装将等待改为
        轮询循环:标志命中 → cancel 内部 task(等待其真实退出,防悬挂)→
        抛 _LoopInterrupted 交由 _run_loop 走优雅中断链路。
        正常完成则原样返回结果;coro 自身异常原样传播(重试链路不受影响)。
        """
        task = asyncio.ensure_future(coro)
        try:
            while True:
                done, _ = await asyncio.wait({task}, timeout=0.25)
                if done:
                    return task.result()
                if self._cancel_requested or self._pause_requested:
                    reason = "cancelled" if self._cancel_requested else "paused"
                    task.cancel()
                    with contextlib.suppress(BaseException):
                        await task  # 等 task 真正退出(其 finally 链清理资源)
                    raise _LoopInterrupted(reason)
        finally:
            # 外部取消路径(如 wait_for 超时取消本协程):内部 task 不可悬挂泄漏
            if not task.done():
                task.cancel()

    async def _llm_call_with_retry(
        self, messages: list[dict[str, Any]], tools_schema: list[dict[str, Any]],
        *, iteration: int = 0,
    ) -> dict[str, Any]:
        """LLM 调用带指数退避重试(错误恢复,2026-08-12 立)。

        网络抖动/5xx/超时等瞬时故障自动重试,指数退避 + 抖动避免同时失败风暴;
        重试耗尽后抛原始异常,由上层走 checkpoint(failed) 失败链路。
        asyncio.CancelledError 不重试(用户取消必须立即生效)。

        P0-B(2026-09-18):首试(且 llm_complete_fn 支持 on_chunk)时传入流式
        回调,逐 chunk 发 thinking.delta 增量,返回 dict 带内部标记 "_streamed":
        True;重试轮次退化为非流式(避免部分产出后重试导致前端增量重复拼接)。
        """
        last_exc: BaseException | None = None
        # 批 57:每轮 LLM 调用重置重试决策状态机(行为兼容;状态仅在本轮重试内累积)。
        self._stream_retry_state = None
        # 2026-09-18 第二批:生成参数透传(空 dict 时不加 kwargs,签名与现状逐零差异)
        extra_params: dict[str, Any] = self._model_params or {}
        # 批58(十九):推理努力档位钉扎(对标 codex reasoning_effort.rs——采样可建立
        # 钉扎,同一上下文窗内粘滞不变)。开关关闭/模型不在白名单/档位非法 → 不注入,
        # 与现状逐零差异;压缩成功由 _maybe_compact_context 退役为 Compacted。
        _pinned_effort = self._resolve_effort_for_request(
            extra_params.get("reasoning_effort")
        )
        if _pinned_effort is not None:
            extra_params = {**extra_params, "reasoning_effort": _pinned_effort}
        if self._executed_tool_calls is not None:
            # 批58(接线):executed_tool_calls 回灌(对标 codex
            # request_metadata.rs internal_chat_message_metadata_passthrough)。
            # 空条目不注入(与现状逐零差异);非空经保留键透传,消费侧按
            # build_request_metadata 形态解析。异常隔离不阻塞请求。
            try:
                from app.core.executed_tool_calls import build_request_metadata

                _etcb = self._executed_tool_calls.bound_for_prompt(64)
                _etcm = build_request_metadata(_etcb) if _etcb else None
                if _etcm is not None:
                    extra_params = {**extra_params, "executed_tool_calls_metadata": _etcm}
            except Exception as e:  # noqa: BLE001 - 回灌失败降级跳过
                logger.debug("executed_tool_calls 回灌失败(降级跳过): %s", e)
        for attempt in range(self.llm_retry_max + 1):
            try:
                on_chunk: Callable[[str], Awaitable[None]] | None = None
                if attempt == 0 and self._llm_supports_on_chunk:
                    on_chunk = self._make_on_chunk(iteration)
                if on_chunk is not None:
                    result = cast(
                        dict[str, Any],
                        await self._llm_complete(
                            messages, tools_schema, on_chunk=on_chunk, **extra_params
                        ),
                    )
                    result["_streamed"] = True  # 内部标记:本轮已流式发射增量
                    return result
                return cast(
                    dict[str, Any],
                    await self._llm_complete(messages, tools_schema, **extra_params),
                )
            except asyncio.CancelledError:
                raise
            except Exception as e:
                last_exc = e
                if attempt >= self.llm_retry_max:
                    break
                # L5-12(2026-08-12):LLM 重试指标埋点
                try:
                    from ..middleware.agent_metrics import agent_loop_llm_retries_total
                    agent_loop_llm_retries_total.labels(
                        self._classify_error(e)
                    ).inc()
                except Exception:
                    pass
                # A25 第 1 层:上游明示"不要再试"(x-should-retry: false)→ 立即放弃,
                # 原始异常照常上抛(等价一次耗尽,不做任何本地重试)。
                _retry_hint = hint_from_error(e)
                if _retry_hint is not None and not _retry_hint.should_retry:
                    break
                # 批 57 接线:Responses 流重试决策状态机统一化(行为兼容,仅作决策来源)。
                # 现有 attempt>=llm_retry_max 的 break 仍主导主链路;decide 仅补充
                # exhausted 前置判与 notify 文案,不改动退避数值。状态机统一化第一步。
                _notify_message: str | None = None
                try:
                    from ..core.responses_retry import (
                        ResponsesStreamRetryState,
                        decide_stream_retry,
                    )
                    _err_type = self._classify_error(e)
                    _state = (
                        self._stream_retry_state
                        if self._stream_retry_state is not None
                        else ResponsesStreamRetryState()
                    )
                    _state, _decision = decide_stream_retry(
                        _state,
                        max_retries=self.llm_retry_max,
                        is_connection_failed=_err_type == "connection",
                        unbounded_connection_retries_enabled=False,
                        session_is_internal=False,
                        provider_is_bedrock=False,
                        fallback_transport_available=False,
                        # A25:此前恒传 None(decide 的 server 优先位没有生产者)。
                        # 现在把 ProviderError 携带的服务端指示喂进去,状态机与
                        # 本地循环看到同一个数。
                        server_retry_delay=(
                            _retry_hint.retry_after_s if _retry_hint is not None else None
                        ),
                        websocket_transport=False,
                        debug_assertions=False,
                    )
                    self._stream_retry_state = _state
                    if _decision.action == "exhausted":
                        break
                    _notify_message = _decision.notify_message
                except Exception:
                    pass
                # A25 第 2/3 层:服务端 Retry-After 优先于本地指数退避(唯一裁决
                # resolve_retry_delay_s,含 [0,60s] 封顶);无指示时逐字节透传既有
                # 曲线(反向对照:random 消费与数值都不变)。
                _local_backoff = self.llm_retry_backoff * (2**attempt) * (
                    0.5 + random.random() * 0.5
                )
                _scheduled = resolve_retry_delay_s(_retry_hint, _local_backoff)
                if _scheduled is None:
                    break
                backoff = _scheduled
                # 2026-09-18 第二批(对标 Codex StreamError):重试/限流事件流出,
                # 客户端可实时感知"模型流断了正在重试",429 标注 rate_limited。
                with contextlib.suppress(Exception):
                    await self._events.emit(
                        "llm.retry",
                        {
                            "session_id": self._session_id,
                            "attempt": attempt + 1,
                            "max_attempts": self.llm_retry_max,
                            "error_type": self._classify_error(e),
                            "message": str(e)[:300],
                            "backoff_seconds": round(backoff, 2),
                            "rate_limited": "429" in str(e)
                            or "rate limit" in str(e).lower(),
                        },
                    )
                logger.warning(
                    "LLM 调用第 %d 次失败(%s: %s),%.1fs 后重试(共 %d 次)",
                    attempt + 1,
                    type(e).__name__,
                    e,
                    backoff,
                    self.llm_retry_max,
                )
                await asyncio.sleep(backoff)
        assert last_exc is not None
        raise last_exc

    @staticmethod
    def _classify_error(e: BaseException) -> str:
        """错误分类(错误恢复可观测性,2026-08-12 立)。

        返回: timeout / connection / http_5xx / http_4xx / cancelled / unknown。
        写入 checkpoint metadata + hook error 事件,供元学习失败聚类与排障使用。
        """
        if isinstance(e, asyncio.CancelledError):
            return "cancelled"
        name = type(e).__name__
        if isinstance(e, (asyncio.TimeoutError, TimeoutError)) or "Timeout" in name:
            return "timeout"
        if "ConnectionError" in name or "ConnectError" in name or "NetworkError" in name:
            return "connection"
        text = str(e)
        lowered = text.lower()
        if ("http" in lowered or "status" in lowered or "server error" in lowered) and (
            "5" in text[:12] or "5xx" in lowered
        ):
            return "http_5xx"
        if ("http" in lowered or "status" in lowered) and "4" in text[:12]:
            return "http_4xx"
        return "unknown"

    def _report_agent_error(self, iteration: int, error: str, error_type: str) -> None:
        """Agent 循环错误结构化上报(错误恢复可观测性,2026-08-12 立)。

        写 audit_service(内存缓冲),供审计查询与排障;失败降级不阻塞主流程。
        """
        try:
            from .audit_service import audit_service

            audit_service.log_agent_action(
                agent_id=self._session_id or "agent_loop",
                action="agent_error",
                details={
                    "iteration": iteration,
                    "error": error[:500],
                    "error_type": error_type,
                },
            )
        except Exception:
            logger.debug("audit_service.log_agent_action 失败(降级,不阻塞)")

    def _report_tool_error(
        self,
        tc: ToolCall,
        error: str,
        error_type: str,
        duration_ms: float,
    ) -> None:
        """工具执行失败结构化上报(错误恢复可观测性,2026-08-12 立)。

        与 log_agent_action 同级,写 audit_service;失败降级不阻塞。
        """
        try:
            from .audit_service import audit_service

            audit_service.log_tool_execution(
                tool_name=tc.name,
                args=tc.args,
                result=None,
                status=f"error:{error_type}",
                duration_ms=duration_ms,
            )
        except Exception:
            logger.debug("audit_service.log_tool_execution 失败(降级,不阻塞)")

    # ------------------------------------------------------------------
    # 1-6 token 治理:预算硬约束辅助(2026-09-02 立)
    # ------------------------------------------------------------------

    async def _check_budget_safe(self) -> tuple[bool, str, float, int]:
        """每轮 LLM 调用前的预算硬约束检查(安全版,永不阻塞主循环)。

        Returns:
            (是否硬停止, 原因, usage_percent, remaining_tokens)

        语义:
        - check_budget 抛 BudgetExceededError → 视为硬停止(allowed=False 同处理)。
        - check_budget 返回 allowed=False(已达 hard_stop)→ 硬停止,优雅中断循环。
        - 返回 allowed=True 但 degrade_to_model 非空 → 仅记日志提示,不中断(软降级)。
        - 任何其它异常 → 降级放行(不阻塞),记录 warning。
        """
        if not self._budget_enabled:
            return False, "", 0.0, 0
        try:
            budget_check = await llm_budget_governor.check_budget(
                self._budget_pillar,
                estimated_tokens=self._budget_max_token_estimate,
            )
        except BudgetExceededError as e:
            return (
                True,
                str(e),
                getattr(e, "usage_percent", 0.0),
                getattr(e, "remaining_tokens", 0),
            )
        except Exception as e:
            logger.warning("budget_governor.check_budget 调用失败(降级放行,不阻塞): %s", e)
            return False, "", 0.0, 0
        if not budget_check.allowed:
            return (
                True,
                budget_check.reason,
                budget_check.usage_percent,
                budget_check.remaining_tokens,
            )
        # 软降级:仅记录提示,不中断循环
        if budget_check.degrade_to_model:
            logger.info(
                "budget_governor 建议降级到 %s(pillar=%s, 用量 %.1f%%): %s",
                budget_check.degrade_to_model,
                self._budget_pillar,
                budget_check.usage_percent * 100,
                budget_check.reason,
            )
        return False, "", budget_check.usage_percent, budget_check.remaining_tokens

    async def _record_budget_usage_safe(
        self, content: str, usage: Any, model: str
    ) -> None:
        """记录本轮 LLM 用量到 budget governor(失败仅 log,绝不阻塞主循环)。

        token 数优先取自 llm_response 的 usage(input_tokens/output_tokens 或
        prompt_tokens/completion_tokens);无精确 usage 时按内容粗估(与 total_tokens
        估算同口径:len(content)//4 + 50),保证 budget on 时每轮都有计量。
        """
        if not self._budget_enabled:
            return
        input_tokens = 0
        output_tokens = 0
        if isinstance(usage, dict):
            input_tokens = int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
            output_tokens = int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
        # 无精确 usage 时按内容粗估
        if input_tokens <= 0 and output_tokens <= 0:
            input_tokens = max(0, len(content) // 4 + 50)
        try:
            await llm_budget_governor.record_usage(
                pillar=self._budget_pillar,
                model=model or "",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                action="agent_loop",
                request_id=self._session_id or "",
            )
        except Exception as e:
            logger.warning("budget_governor.record_usage 失败(降级,不阻塞): %s", e)

    async def _run_loop(
        self,
        messages: list[dict[str, Any]],
        start_iteration: int,
        prior_iterations: list[LoopIteration],
        prior_tokens: int,
        start_time: datetime,
    ) -> AgentLoopResult:
        """内部循环实现(run 与 resume_from_checkpoint 共享)。

        Args:
            messages: 消息历史(原地追加)
            start_iteration: 起始 iteration 编号(run=1, resume=checkpoint.iteration+1)
            prior_iterations: 之前已有的 iteration 记录(resume 时不恢复 trace,留空)
            prior_tokens: 之前已用的 token 估算
            start_time: 本次循环开始时间(用于 total_duration_ms)
        """
        iterations: list[LoopIteration] = list(prior_iterations)
        total_tokens = prior_tokens
        tools_schema = self._build_tools_schema()
        # 最近一次 checkpoint id(供 tool.after 的 rollback 证据引用;初始 None)
        checkpoint_id: str | None = None

        for i in range(start_iteration, self.max_iterations + 1):
            # Wave 9:检查暂停/取消标志(在 LLM 调用前)
            if self._cancel_requested:
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status="cancelled",
                )
                return AgentLoopResult(
                    compaction_events=self._compaction_events,
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(UTC) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="cancelled",
                    error=f"用户取消(iteration {i})",
                    checkpoint_id=checkpoint_id,
                )
            if self._pause_requested:
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status="paused",
                )
                return AgentLoopResult(
                    compaction_events=self._compaction_events,
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(UTC) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="paused",
                    error=f"用户暂停(iteration {i}),可凭 checkpoint_id 续跑",
                    checkpoint_id=checkpoint_id,
                )

            self._current_iteration = i

            # 1-6 token 治理:每轮 LLM 调用前预算硬约束检查(与暂停/取消检查并列)
            if self._budget_enabled:
                (
                    budget_stopped,
                    budget_reason,
                    budget_pct,
                    budget_rem,
                ) = await self._check_budget_safe()
                if budget_stopped:
                    # 优雅中断:保留已完成 iterations、不抛未捕获异常、落 checkpoint
                    checkpoint_id = await self._save_checkpoint_safe(
                        iteration=i - 1, messages=messages, status="budget_exceeded",
                    )
                    return AgentLoopResult(
                        compaction_events=self._compaction_events,
                        success=False,
                        final_response="",
                        iterations=iterations,
                        total_duration_ms=(
                            (datetime.now(UTC) - start_time).total_seconds() * 1000
                        ),
                        total_tokens_used=total_tokens,
                        stop_reason="budget_exceeded",
                        error=budget_reason,
                        checkpoint_id=checkpoint_id,
                        budget={
                            "enabled": True,
                            "pillar": self._budget_pillar,
                            "usage_percent": budget_pct,
                            "remaining_tokens": budget_rem,
                            "stopped_at_iteration": i,
                        },
                    )

            iter_start = datetime.now(UTC)
            iteration = LoopIteration(iteration=i, start_time=iter_start.isoformat())

            try:
                # Hook 引擎: tool.before(1-5 起经事件流层发射)
                await self._events.tool_before(
                    session_id=self._session_id or "",
                    iteration=i,
                    messages_count=len(messages),
                    tools_count=len(tools_schema) if tools_schema else 0,
                )
                # P1(2026-09-19):message.send 接线——LLM 调用前通知前端本轮
                # 请求已发出,消除 SSE 契约 message_send 无生产源的 parity 警告。
                await self._events.message_send(
                    session_id=self._session_id or "",
                    iteration=i,
                    messages_count=len(messages),
                )
                # 批 44:turn/steer 消费(对标 codex inject_if_running)——
                # 每次迭代 LLM 调用前把运行中注入的用户文本追加进历史,同一
                # 回合继续推理。可能触发立即再跑一轮 LLM(用户"补充指令"场景);
                # 多条 steer 按提交顺序全部追加。注入在压缩前,保证 steer 内容
                # 不会被本次压缩裁掉。
                drained_steers = self._drain_steers()
                for steer_text in drained_steers:
                    messages.append(
                        {
                            "role": "user",
                            "content": f"[steer] {steer_text}",
                        }
                    )
                # 批 53:历史健全化(对标 codex context_manager/normalize.rs)——
                # 压缩前先修历史:删孤儿 tool 回复 + 补缺位 tool 占位(中断/压缩/
                # 宿主注入后可能产生残缺历史,残缺 assistant(tool_calls)↔tool 配对
                # 会让部分 LLM API 400)。失败隔离不阻塞回合(健全化属防御性步骤)。
                try:
                    from app.core.history_normalization import normalize_history

                    _norm = normalize_history(messages)
                    if _norm.get("orphans_removed") or _norm.get("placeholders_added"):
                        logger.info(
                            "历史健全化生效: orphans_removed=%s, placeholders_added=%s, session=%s",
                            _norm.get("orphans_removed"),
                            _norm.get("placeholders_added"),
                            self._session_id or "",
                        )
                except Exception as e:  # noqa: BLE001 - 健全化失败不阻塞主链路
                    logger.warning("history_normalization 异常(降级跳过): %s", e)
                # 1. 调 LLM(带 tools,带指数退避重试);调用前按占用率自动压缩上下文(1-8)
                messages = await self._maybe_compact_context(messages)
                # 批 40 接线:当前时间提醒(对标 codex maybe_record_current_time_reminder)。
                # 每次推理前按节流状态机判定;投递则把 developer 片段追加进历史。
                # time_provider 未注入 = 功能关闭,零行为变化;时钟失败降级注入
                # 不可用片段(同窗口去重),绝不抛错阻塞回合。
                if self._time_provider is not None:
                    try:
                        _reminder = self._time_reminder_state.take_reminder(
                            window_id=f"{self._session_id or ''}:{id(messages)}",
                            turn_id=f"{self._session_id or ''}:iter{i}",
                            time_provider=self._time_provider,
                        )
                        if _reminder is not None:
                            messages.append(_reminder)
                    except Exception as e:  # noqa: BLE001 - 提醒失败隔离,不阻塞主链路
                        logger.warning("current_time_reminder 投递异常(降级跳过): %s", e)
                # 批 40 接线:环境上下文片段(对标 codex world_state/environment.rs)。
                # cwd/当前日期注入 user 片段,变化才注入(EnvironmentStateTracker
                # 逐字节比较);环境采集失败隔离,不阻塞回合。未启用 time_provider
                # 的旧构造路径同样零行为变化(与时间提醒共用启用开关)。
                if self._time_provider is not None:
                    try:
                        from ..core.environment_context import format_local_date

                        _env_frag = self._env_tracker.maybe_fragment(
                            cwd=os.getcwd(),
                            current_date=format_local_date(),
                        )
                        if _env_frag is not None:
                            messages.append(_env_frag)
                    except Exception as e:  # noqa: BLE001 - 环境采集失败隔离
                        logger.warning("environment_context 注入异常(降级跳过): %s", e)
                # 批58(接线):世界状态片段 + 附加上下文注入(同 environment_context 拼接点)。
                # 二者各自内部已做开关判定与异常隔离,关闭时零片段、零差异。
                self._inject_world_state_sections(messages)
                self._inject_additional_context(messages)
                self._inject_guardian_context(messages)
                # 批58(接线):上下文片段 / Session 前缀 / 指令片段 注入(同 developer
                # 片段拼接区)。三者各自内部已做开关判定与异常隔离,关闭时零片段、零差异。
                self._inject_context_fragments(messages)
                self._inject_session_prefix(messages)
                self._inject_instructional_fragments(messages)
                # P0-B(2026-09-18):_wait_interruptible 包裹——长 LLM 调用期间命中
                # cancel/pause 标志也能立即中断(抛 _LoopInterrupted 走优雅中断链路);
                # iteration=i 透传使流式 thinking 增量帧携带轮次号。
                # P0-①(2026-09-18):llm_t0/llm_duration_ms 计量单次 LLM 调用耗时,
                # 供 type=llm 步骤录制(区别于整轮 iteration 耗时)。
                llm_t0 = time.monotonic()
                llm_response = await self._wait_interruptible(
                    self._llm_call_with_retry(messages, tools_schema, iteration=i)
                )
                llm_duration_ms = (time.monotonic() - llm_t0) * 1000

                content = llm_response.get("content", "")
                tool_calls_raw = llm_response.get("tool_calls")
                # 批58(接线):流事件回合项映射(对标 codex event_mapping.rs parse_turn_item)。
                # 开关关闭时零产出(与现状逐零差异);开启时把本轮 LLM 响应归一化为回合项,
                # 仅作内部观测,不回灌模型、不改动 messages/事件流。
                self._record_stream_turn_item(llm_response)
                # 内部标记取出后即消费,不随响应 dict 外泄(检查点/事件零差异)
                streamed = bool(llm_response.pop("_streamed", False))

                iteration.reasoning = content

                # P0-B(2026-09-18):流式路径逐 chunk 已发 is_final=False 增量
                # (_make_on_chunk),此处补发 is_final=True 结束帧(content 置空,
                # 前端按增量拼接语义不会重复);非流式/重试降级路径维持整段
                # 一次性发射(与既有行为一致)。
                if content and not streamed:
                    await self._events.emit_thinking_delta(
                        self._session_id or "", content, iteration=i
                    )
                elif streamed:
                    await self._events.emit_thinking_delta(
                        self._session_id or "", "", iteration=i
                    )

                # 估算 token(粗略)
                total_tokens += len(content) // 4 + 50

                # 1-6 token 治理:记录本轮 LLM 用量(失败降级不阻塞)
                if self._budget_enabled:
                    await self._record_budget_usage_safe(
                        content=content,
                        usage=llm_response.get("usage"),
                        model=llm_response.get("model", ""),
                    )
                # 批 40 接线:rollout_budget 记账 + 阈值提醒投递(对标 codex
                # maybe_record_current_time_reminder 的兄弟链路 record_rollout_budget)。
                # 用 usage 归一化记账;剩余量跌破阈值时把 <rollout_budget> developer
                # 片段追加进历史(同窗口同级别只投一次,由 pending_reminder 状态机管)。
                if self._rollout_budget is not None:
                    try:
                        from ..core.rollout_budget import (
                            build_rollout_budget_fragment,
                            normalize_rollout_usage,
                        )

                        _usage = normalize_rollout_usage(llm_response.get("usage") or {})
                        if _usage:
                            self._rollout_budget.record_usage(_usage)
                        _budget_reminder = self._rollout_budget.pending_reminder(
                            thread_id=self._session_id or "",
                            window_id=self._session_id or "",
                        )
                        if _budget_reminder is not None:
                            messages.append(
                                build_rollout_budget_fragment(
                                    _budget_reminder.remaining_tokens
                                )
                            )
                            self._rollout_budget.mark_reminder_delivered(
                                thread_id=self._session_id or "",
                                window_id=self._session_id or "",
                                reminder=_budget_reminder,
                            )
                    except Exception as e:  # noqa: BLE001 - 预算提醒失败隔离
                        logger.warning("rollout_budget 记账/提醒失败(降级跳过): %s", e)
                # 批58(接线):auto_compact_window prefill 观测(对标 codex
                # ensure_server_observed_prefill_from_usage)。即便 rollout_budget 未启用,
                # 只要本开关开启就从本轮 usage 取 input_tokens 喂账本(首次样本恒优先)。
                # 失败隔离,不阻塞回合。
                self._observe_auto_compact_prefill(llm_response.get("usage") or {})

                # P0-①(2026-09-18):主循环 LLM 调用录为 type=llm 步骤——
                # 主链路 token/成本此前只入 budget governor(内存口径),recorder/
                # cost_ledger 只见工具步,LLM 维度永远空账;录制含归一化 usage
                # (prompt/completion/cached/cache_creation),使 sync_from_recorder
                # 后账本能按缓存三段计价。无 recorder 时零差异。
                self._maybe_record_llm_step(
                    iteration=i,
                    llm_response=llm_response,
                    duration_ms=llm_duration_ms,
                    messages_count=len(messages),
                    tools_count=len(tools_schema) if tools_schema else 0,
                )

                # 2. 无 tool_calls → 循环完成
                if not tool_calls_raw:
                    iteration.end_time = datetime.now(UTC).isoformat()
                    iteration.duration_ms = (
                        (datetime.now(UTC) - iter_start).total_seconds() * 1000
                    )
                    iterations.append(iteration)

                    # Hook 引擎: message.receive(1-5 起经事件流层发射)
                    await self._events.message_receive(
                        session_id=self._session_id or "",
                        iteration=i,
                        content_length=len(content),
                    )

                    # L5-12(2026-08-12):提前返回路径也保存 checkpoint(status=completed)
                    # 此前简单任务(无工具调用)直接 return 不落 checkpoint → workbench
                    # sessions/tool-calls/errors 可视化全空;补齐使每个完成任务可追溯
                    try:
                        await self._save_checkpoint_safe(
                            iteration=i, messages=messages, status="completed",
                        )
                    except Exception:
                        logger.warning("简单任务 checkpoint 保存失败(降级,不阻塞)")

                    return AgentLoopResult(
                        compaction_events=self._compaction_events,
                        success=True,
                        final_response=content,
                        iterations=iterations,
                        total_duration_ms=(
                            (datetime.now(UTC) - start_time).total_seconds() * 1000
                        ),
                        total_tokens_used=total_tokens,
                        stop_reason="completed",
                    )

                # 3. 解析 tool_calls
                tool_calls: list[ToolCall] = []
                for tc_raw in tool_calls_raw:
                    tc = ToolCall(
                        # 2026-08-01 P1 修复:LLM 未返回 id 时用 uuid 生成唯一 ID,
                        # 原 f"call_{len(tool_calls)}" 会导致跨迭代 ID 碰撞
                        # (每次迭代都从 call_0 开始),OpenAI/Anthropic API 要求
                        # tool_call_id 在会话内全局唯一,碰撞会 400 或错配结果。
                        id=tc_raw.get("id") or f"call_{uuid.uuid4().hex[:8]}",
                        name=tc_raw.get("name", ""),
                        args=tc_raw.get("args", {}),
                    )
                    tool_calls.append(tc)
                iteration.tool_calls = tool_calls

                # 4. 把 assistant message(含 tool_calls)加入 messages
                messages.append(
                    {
                        "role": "assistant",
                        "content": content,
                        "tool_calls": [
                            {"id": tc.id, "name": tc.name, "args": tc.args} for tc in tool_calls
                        ],
                    }
                )

                # 5. 执行工具
                tool_results = await self._execute_tools(tool_calls)
                # Hook 引擎: tool.after(1-5 起经事件流层发射:逐工具明细含
                # input/diff/test/rollback 可解释性证据,evidence 推导失败跳过整次事件)
                await self._events.tool_after(
                    session_id=self._session_id or "",
                    iteration=i,
                    tool_calls=tool_calls,
                    tool_results=tool_results,
                    duration_ms=iteration.duration_ms,
                    checkpoint_id=checkpoint_id,
                )
                iteration.tool_results = tool_results

                # 6. 把工具结果加入 messages
                for tr in tool_results:
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tr.tool_call_id,
                            "name": tr.name,
                            "content": json.dumps(
                                tr.result if not tr.error else {"error": tr.error},
                                ensure_ascii=False,
                            ),
                        }
                    )
                # 批 42 接线:user_shell_command 片段(对标 context/user_shell_command.rs)——
                # 用户批准后重执行的 run_command,其结构化结果以 <user_shell_command>
                # user 片段回填(与普通 tool 消息并列;带批准语义上下文,失败安全)。
                if self._approved_command_call_ids:
                    _tc_args_map = {t.id: t.args for t in tool_calls}
                    for tr in tool_results:
                        if (
                            tr.name != "run_command"
                            or tr.error
                            or not isinstance(tr.result, dict)
                            or tr.tool_call_id not in self._approved_command_call_ids
                        ):
                            continue
                        _cmd = str((_tc_args_map.get(tr.tool_call_id) or {}).get("command", ""))
                        if not _cmd:
                            continue
                        try:
                            from ..core.user_shell_command import build_user_shell_command_fragment

                            messages.append(build_user_shell_command_fragment(_cmd, tr.result))
                        except Exception as e:  # noqa: BLE001 - 片段失败隔离,不阻塞主链路
                            logger.warning("user_shell_command 片段构造失败(跳过): %s", e)
                    self._approved_command_call_ids.clear()

                # 批 40 接线:工具输出 boundary 记账(对标 note_recorded_items——
                # AfterUserOrToolOutput 模式下,下次推理允许时间提醒投递)
                if self._time_provider is not None:
                    self._time_reminder_state.pending_user_or_tool_output_boundary = True

                # 7. 2-3 自愈集成(2026-09-12):本轮出现失败 pytest 信号时触发
                #    heal(默认 off,fail-open;结果以 user 消息注入,LLM 感知后继续)
                await self._maybe_self_heal(i, messages, tool_calls, tool_results)

                iteration.end_time = datetime.now(UTC).isoformat()
                iteration.duration_ms = (
                    (datetime.now(UTC) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                logger.info(
                    "Agent 循环第 %d 轮:执行 %d 个工具,耗时 %.0fms",
                    i,
                    len(tool_calls),
                    iteration.duration_ms,
                )

                # Wave 9:每轮 iteration 结束后 checkpoint(status=running);
                # 捕获返回 id 供下一轮 tool.after 的 rollback 证据引用
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="running",
                )

            except _LoopInterrupted as e:
                # P0-B(2026-09-18):循环内中断——长 LLM 调用/工具执行期间命中
                # cancel/pause 标志(_wait_interruptible 抛出)。与轮次边界中断
                # (循环头检查)同构:落对应状态 checkpoint,返回 cancelled/paused
                # 结果;区别仅在触发时机(边界 vs 循环体内),返回结构逐字段一致。
                reason = e.reason
                logger.info(
                    "Agent 循环第 %d 轮循环内中断(%s),session=%s",
                    i, reason, self._session_id or "",
                )
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status=reason,
                )
                return AgentLoopResult(
                    compaction_events=self._compaction_events,
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(UTC) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason=reason,
                    error=(
                        f"用户取消(iteration {i},循环内中断)"
                        if reason == "cancelled"
                        else f"用户暂停(iteration {i},循环内中断),可凭 checkpoint_id 续跑"
                    ),
                    checkpoint_id=checkpoint_id,
                )
            except Exception as e:
                error_type = self._classify_error(e)
                logger.error("Agent 循环第 %d 轮异常[%s]: %s", i, error_type, e)
                # L5-12(2026-08-12):错误指标埋点(按 error_type 六分类)
                try:
                    from ..middleware.agent_metrics import agent_loop_errors_total
                    agent_loop_errors_total.labels(error_type).inc()
                except Exception:
                    pass
                # L5-3 错误恢复:结构化上报审计服务(2026-08-12 立)
                self._report_agent_error(i, str(e), error_type)
                # Hook 引擎: error(1-5 起经事件流层发射;异常路径静默降级,
                # emit 失败不记录日志,避免日志级联)
                await self._events.loop_error(
                    session_id=self._session_id or "",
                    iteration=i,
                    error=str(e),
                    error_type=error_type,
                )
                iteration.end_time = datetime.now(UTC).isoformat()
                iteration.duration_ms = (
                    (datetime.now(UTC) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                # Wave 9:异常时保存 checkpoint(status=failed),便于后续 resume
                # L5-1:metadata 带 error_type,供元学习失败聚类(2026-08-12 立)
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="failed",
                    metadata={"error": str(e), "error_type": error_type},
                )

                return AgentLoopResult(
                    compaction_events=self._compaction_events,
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(UTC) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="error",
                    error=str(e),
                    checkpoint_id=checkpoint_id,
                )

        # 达到 max_iterations
        return AgentLoopResult(
            compaction_events=self._compaction_events,
            success=False,
            final_response="",
            iterations=iterations,
            total_duration_ms=(
                (datetime.now(UTC) - start_time).total_seconds() * 1000
            ),
            total_tokens_used=total_tokens,
            stop_reason="max_iterations",
            error=f"达到最大迭代数 {self.max_iterations}",
        )

    async def resume_from_checkpoint(self, checkpoint_id: str) -> AgentLoopResult:
        """从 checkpoint 恢复并继续执行下一轮 iteration。

        Args:
            checkpoint_id: checkpoint id(由 pause/cancel/异常时返回,或通过
                          checkpoint_manager.list_checkpoints 查询)

        Returns:
            AgentLoopResult:从 checkpoint.iteration+1 继续执行的循环结果

        Raises:
            ValueError: checkpoint 不存在或已过期
        """
        checkpoint: AgentLoopCheckpoint | None = await self._checkpoint_manager.load_checkpoint(
            checkpoint_id
        )
        if checkpoint is None:
            raise ValueError(f"checkpoint {checkpoint_id} 不存在或已过期")

        # W9#6(2026-09-18):恢复过渡事件(与 pausing/cancelling 对称)
        await self._events.emit(
            "agent.status",
            {"session_id": self._ensure_session_id(), "status": "resuming"},
        )

        if checkpoint.status == "completed":
            # 已完成的 checkpoint 无需续跑
            return AgentLoopResult(
                compaction_events=self._compaction_events,
                success=True,
                final_response="",
                iterations=[],
                total_duration_ms=0.0,
                total_tokens_used=0,
                stop_reason="completed",
                error="checkpoint 已 completed,无需续跑",
                checkpoint_id=checkpoint_id,
            )

        if checkpoint.status == "cancelled":
            logger.warning(
                "checkpoint %s 状态为 cancelled,仍允许续跑(用户显式 resume)",
                checkpoint_id,
            )

        # 恢复状态
        self._session_id = checkpoint.session_id
        # 深拷贝消息历史,避免污染 checkpoint 存储中的引用
        messages = json.loads(json.dumps(checkpoint.messages, ensure_ascii=False))
        self._messages = messages
        self._tool_state = json.loads(json.dumps(checkpoint.tool_state, ensure_ascii=False))
        self._reset_run_state()

        # 批 40 接线:TurnAborted 中断指导(对标 codex context/turn_aborted.rs)。
        # 被取消/暂停后显式 resume 时,把持久化中断片段追加进历史尾部——LLM 感知
        # 「用户故意中断了上一轮,后台进程可能仍在跑,被中止的命令可能已部分执行」,
        # 避免续跑时静默假设上一轮工具全部成功/全部未执行。completed 无需续跑不注入;
        # 运行时异常隔离(注入失败只降级)。
        if checkpoint.status in ("cancelled", "paused"):
            try:
                from ..core.current_time_reminder import build_turn_aborted_fragment

                _fragment = build_turn_aborted_fragment(checkpoint.status)
                messages.append(_fragment)
                # boundary 记账:该片段即用户轮次边界(节流状态机语义)
                self._time_reminder_state.note_recorded_items(messages[-1:])
            except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞续跑
                logger.warning("turn_aborted 指导注入失败(降级续跑): %s", e)

        start_iteration = checkpoint.iteration + 1
        if start_iteration > self.max_iterations:
            return AgentLoopResult(
                compaction_events=self._compaction_events,
                success=False,
                final_response="",
                iterations=[],
                total_duration_ms=0.0,
                total_tokens_used=0,
                stop_reason="max_iterations",
                error=(
                    f"checkpoint iteration {checkpoint.iteration} "
                    f"已达 max_iterations {self.max_iterations}"
                ),
                checkpoint_id=checkpoint_id,
            )

        logger.info(
            "Agent 循环从 checkpoint %s 恢复,session=%s,从 iteration %d 续跑",
            checkpoint_id,
            checkpoint.session_id,
            start_iteration,
        )

        resume_result = await self._run_loop(
            messages=messages,
            start_iteration=start_iteration,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(UTC),
        )
        # 1-3 压缩生产指标:续跑 run 同样记录压缩后任务结果
        self._record_compaction_run_outcome(resume_result)
        return resume_result

    async def pause(self) -> str | None:
        """暂停当前 loop。

        若 loop 正在运行:设置 _pause_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=paused),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        # W9#6(2026-09-18):过渡事件先行 —— 前端在 done 落定前即可呈现"正在暂停"
        await self._events.emit(
            "agent.status",
            {"session_id": self._ensure_session_id(), "status": "pausing"},
        )
        self._pause_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="paused",
            )
        return None

    async def cancel(self) -> str | None:
        """取消当前 loop。

        若 loop 正在运行:设置 _cancel_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=cancelled),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        # W9#6(2026-09-18):过渡事件先行 —— 前端在 done 落定前即可呈现"正在取消"
        await self._events.emit(
            "agent.status",
            {"session_id": self._ensure_session_id(), "status": "cancelling"},
        )
        self._cancel_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="cancelled",
            )
        return None

    # ------------------------------------------------------------------
    # 批 44:turn/steer 运行中转向(2026-09-19,对标 codex TurnSteerParams /
    # steer_turn / inject_if_running)—— 有活跃回合时把用户输入注入当前回合。
    # ------------------------------------------------------------------

    def steer(self, text: str) -> bool:
        """运行中转向:把用户文本注入当前活跃回合。

        语义对标 codex:仅当回合**正在运行**时接受,追加进 _pending_steers;
        主循环在下一次 LLM 调用前消费(迭代边界),追加 user 消息后继续同一
        回合推理——与 thread.enqueue(回合结束后才消化)的本质区别就在这里。

        Returns:
            True = 已接受注入;False = 无活跃回合(caller 应降级为起新回合,
            对应 codex SteerSubmission::NotSubmitted)。
        """
        if self._messages is None:
            return False  # run() 未启动 → 无活跃回合
        self._pending_steers.append(text)
        return True

    def _drain_steers(self) -> list[str]:
        """取出全部待注入的 steer 文本(主循环 LLM 调用前调用)。"""
        if not self._pending_steers:
            return []
        drained = list(self._pending_steers)
        self._pending_steers.clear()
        return drained

    def take_leftover_steers(self) -> list[str]:
        """run 结束后回收未被消费的 steer(竞态兜底)。

        steer 提交时回合还在 running 但主循环已进入最终 LLM 调用,注入窗口
        已关闭——引擎层回收后转 thread.enqueue 语义(下一回合消化),不丢消息。
        """
        return self._drain_steers()

    # ------------------------------------------------------------------
    # 工具调用审批流(2026-08-30 立,对标 Codex 三档审批 + Claude Auto mode)
    # ------------------------------------------------------------------

    @staticmethod
    def _is_high_risk_tool(name: str) -> bool:
        """判断工具是否高危(执行前需用户审批)。

        高危集合(默认,可经 env TOOL_APPROVAL_HIGH_RISK_TOOLS 追加):
        - 写文件类:write_file / file_edit / file_batch_edit / edit_file / create_file / delete_file
        - 命令类:run_command / computer_*(电脑控制前缀)
        - 浏览器交互类:browser_click_element / browser_type_text
        - 删除/写库类:git_operations(含 rm 参数) / db_query(写操作) —— 参数细节由用户按预览自决
        其余(read_file / search / 知识查询)默认放行。

        V3 #47(2026-09-26):引擎内核(AgentEngine/Codex 移植)自带的 14 个内置名不在注册表里,
        于是名字判据对它们全盲 —— 实测改前 `unified_exec`(起 shell)、`run_code`(跑 python 子进程)、
        `apply_patch`(写工作区文件)三条都判 False,即**永不进审批门**,而同一能力经
        `run_command` / `file_edit` 进 A/B 内核时要审批。现按桥表回查"该能力的注册表拥有者",
        用同一把尺再判一次;名单仍只有 `_DEFAULT_HIGH_RISK_TOOLS` 那一份。
        """
        if _matches_high_risk_name(name):
            return True
        equivalent = _capability_equivalent(name)
        return equivalent is not None and _matches_high_risk_name(equivalent)

    def _is_high_risk_tool_instance(self, name: str) -> bool:
        """实例级高危判定(含 env 追加的自定义集合)。"""
        return self._is_high_risk_tool(name) or name in self._extra_high_risk_tools

    async def _request_approval(self, tc: ToolCall) -> str | None:
        """发起审批请求并等待用户决策(阻塞等待,超时后放弃)。

        Returns:
            None = 用户已批准,工具可继续执行;
            "user_rejected" = 用户拒绝(工具不执行);
            "approval_timeout" = 等待超时(默认 60s,工具不执行)。

        批 52 接线:入口先查审批持久层(approval_persistence.check)。命中
        session/always 授权则免弹窗直接放行(对标 codex PERSIST_SESSION /
        PERSIST_ALWAYS);用户批准后落盘 session 级授权(下次同键免弹窗)。
        持久层异常按未命中处理(fail-closed:继续走人工弹窗,绝不静默放行)。
        """
        # 批 52:先查持久层;命中则免弹窗直接放行。key 同时用于批准后落盘。
        key = _tool_approval_cache_key(tc.name, tc.args)
        try:
            from . import approval_persistence as _ap
            _persist_hit = _ap.check(key, "mcp_tool")
        except Exception:
            _persist_hit = None  # fail-closed:持久层异常 = 继续人工弹窗
        if _persist_hit in ("always", "session"):
            self._decision_hints[tc.id] = (
                "approval_persist_hit",
                f"持久授权命中: {_persist_hit}",
            )
            return None

        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
        ev = asyncio.Event()
        # O19:登记属主。self._user_id 由构造参数注入(路由层/引擎线程显式传入),
        # 为 None 时该审批只能被同样无可证明身份的通道(引擎无 userId 线程)结算,
        # HTTP 审批端点会返回 403 —— 这是 fail-closed,不是漏判。
        _approval_registry[approval_id] = _ApprovalEntry(
            event=ev, decision=None, owner_user_id=self._user_id
        )
        # 批 53:登记 persist 旁路键(供引擎侧 approval.respond 携带 persist 时取回落盘)
        _approval_persist_keys[approval_id] = key
        try:
            # 参数预览:截断 200 字符(完整 args 不回传 SSE,避免敏感信息全量下发)
            try:
                args_preview = json.dumps(tc.args, ensure_ascii=False)[:200]
            except Exception:
                args_preview = str(tc.args)[:200]
            # 通过事件流层发 tool.approval 事件(订阅者 = SSE 转发 + 前端弹窗)。
            # emit 内部有 _broadcast 向 SSE 订阅者推送;失败降级不抛(但审批继续等待,
            # 若事件完全无法送达,工具会在超时后以 approval_timeout 返回,安全兜底)。
            await self._events.tool_approval(
                approval_id=approval_id,
                tool_name=tc.name,
                tool_call_id=tc.id,
                args_preview=args_preview,
                session_id=self._session_id or "",
            )
            # 等待用户决策(批准/拒绝/超时)
            try:
                await asyncio.wait_for(ev.wait(), timeout=self._approval_timeout)
            except TimeoutError:
                return "approval_timeout"
            settled = _as_entry(approval_id)
            decision = settled.decision if settled is not None else None
            if decision == "approve":
                # D84(2026-09-23):按用户选择的作用域落盘授权(映射见 grant_scope_for_approval):
                # once 不落盘(最小特权)/ session 本会话 / always 跨会话 / None 保持批 52 兼容。
                # 授权键是 (工具+参数归一) 精确匹配,任何作用域都不放大到全局。
                _scope = grant_scope_for_approval(settled.scope if settled is not None else None)
                if _scope is not None:
                    try:
                        from . import approval_persistence as _ap
                        _ap.grant(_scope, key, "mcp_tool")
                    except Exception:
                        pass  # grant 失败静默(不阻断已批准的执行);持久层异常不影响返回 None
                return None
            if decision == "reject":
                # D84:拒绝原因进决策提示(供 timeline/审计侧消费;缺省不写 key)。
                _reason = settled.reason if settled is not None else None
                if _reason:
                    self._decision_hints[tc.id] = ("rejected_by_user", _reason)
            return "user_rejected"
        finally:
            # 防内存泄漏:无论批准/拒绝/超时,清理注册表条目
            _approval_registry.pop(approval_id, None)
            # 批 53:同步清理 persist 旁路键(与 _approval_registry 同期生命周期)
            _approval_persist_keys.pop(approval_id, None)

    async def _emit_permission_mode_event(self, tool_name: str, decision: str) -> None:
        """模式生效时经事件流层发 `permission.mode` 事件(1-5 拆层后统一入口)。

        触发时机(工具被跳过/免审批):
        - plan 模式拦截白名单外工具 → decision="plan_blocked"
        - auto 模式只读工具免审批直接执行 → decision="auto_skip_approval"

        payload 含 mode/tool/decision/session_id。失败仅 warning 降级,绝不阻塞主链路。

        Args:
            tool_name: 触发事件时涉及的工具名
            decision: 决策标签(plan_blocked / auto_skip_approval)
        """
        # 1-5 起经事件流层发射(失败降级不阻塞,语义同层内统一)
        await self._events.permission_mode(
            mode=self._permission_mode,
            tool_name=tool_name,
            decision=decision,
            session_id=self._session_id or "",
        )

    async def _pre_guard_check(self, tc: ToolCall) -> ToolResult | None:
        """P0-3:guarded_pipeline 前置守卫(prompt 注入探测 + 危险入参扫描)。

        - 两开关(prompt_guard_enabled / input_scan_enabled)均关闭时零开销直通;
        - 配置每次实时读取(get_security_config),设置页热更立即生效;
        - 安全阶段 fail-closed:探测/扫描自身异常一律按拦截处理;
        - 拦截 → ToolResult(error_type=injection_blocked / scan_blocked),
          不进审批流、不执行,LLM 收到结构化错误可自行调整。
        """
        cfg = get_security_config()
        if not (cfg.prompt_guard_enabled or cfg.input_scan_enabled):
            return None
        pipeline_kwargs: dict[str, Any] = {
            # 两阶段共用 scan_enabled 门;各自再经占位依赖实现独立开关
            "scan_enabled": True,
            "guard_enabled": False,   # budget 治理由 loop 1-6 独立链路承担,不在此重复
            "record_enabled": False,  # 步骤录制由 _maybe_record_step 统一(含决策提示),防双写
        }
        if not cfg.prompt_guard_enabled:
            pipeline_kwargs["prompt_guard"] = _no_prompt_guard
        if not cfg.input_scan_enabled:
            pipeline_kwargs["input_scanner"] = _no_input_scanner
        pipeline = GuardedToolPipeline(**pipeline_kwargs)
        try:
            pr = await pipeline.run(
                tc.name,
                tc.args,
                fn=lambda _a: None,  # 仅跑前置守卫;真实执行在 _execute_single 原有链路
                run_id=f"agent-loop:{self._session_id or 'anon'}:{tc.id}",
                session_id=self._session_id,
                prompt_source="mcp",
                prompt_policy=cfg.prompt_guard_policy,
                scan_source="mcp",
                scan_policy="flag",
                block_on_scan=True,
            )
        except Exception as e:  # fail-closed:管线自身异常按拦截处理
            msg = f"安全前置守卫异常,已拦截: {e}"
            logger.warning("工具 %s 前置守卫异常(fail-closed): %s, session=%s",
                           tc.name, e, self._session_id or "")
            self._report_tool_error(tc, msg, ERROR_INJECTION_BLOCKED, 0.0)
            self._decision_hints[tc.id] = ("security_blocked", msg)
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result={"blocked": True, "reason": msg},
                error=msg,
                duration_ms=0,
                error_type=ERROR_INJECTION_BLOCKED,
            )
        if pr.ok:
            return None
        err = pr.errors[0] if pr.errors else None
        err_type = err.error_type if err is not None else ERROR_INJECTION_BLOCKED
        msg = err.message if err is not None else "安全前置守卫拦截"
        scan_hits = pr.scan.get("hits") if isinstance(pr.scan, dict) else None
        if scan_hits:
            msg = f"{msg}: {scan_hits}"
        logger.info(
            "工具 %s 被安全前置守卫拦截[%s]: %s, session=%s",
            tc.name, err_type, msg, self._session_id or "",
        )
        self._report_tool_error(tc, msg, err_type, 0.0)
        self._decision_hints[tc.id] = ("security_blocked", msg)
        return ToolResult(
            tool_call_id=tc.id,
            name=tc.name,
            result={"blocked": True, "reason": msg, "scan": pr.scan},
            error=msg,
            duration_ms=0,
            error_type=err_type,
        )

    async def _resolve_exec_policy_approval(
        self,
        tc: ToolCall,
        tool: ToolDefinition,
        result: Any,
        start: float,
        retry_count: int,
        *,
        gate_approved: bool = False,
    ) -> ToolResult | None:
        """P0-3:run_command 的 EXEC_POLICY_NEEDS_APPROVAL → 真实审批弹窗。

        mcp_server 在 exec_policy 命中 PROMPT 规则时返回结构化"待审批"结果而
        不执行;此处把该结果升级为真实审批流(tool.approval 事件 → 前端弹窗):
        - 批准 → 经 mcp_server.approve_exec_command 登记一次性放行,原样重执行
          (放行仅跳过 PROMPT 分支;DENY 硬拦截/危险命令硬门/黑白名单不受影响);
        - 拒绝/超时 → 不执行,与审批门同语义回填 user_rejected / approval_timeout;
        - audit/off 模式或审批门关闭 → 返回 None 维持旧行为(结构化文本回给 LLM);
        - gate_approved=True(本 tc 已过审批门)→ 跳过二次弹窗,直接登记放行。
        """
        if not (
            isinstance(result, dict)
            and result.get("errorCode") == "EXEC_POLICY_NEEDS_APPROVAL"
        ):
            return None
        cfg = get_security_config()
        if cfg.exec_policy_mode != "enforce" or not self._approval_enabled:
            return None
        if not gate_approved:
            logger.info(
                "命令命中 exec_policy PROMPT 规则,转真实用户审批: tool=%s, session=%s",
                tc.name,
                self._session_id or "",
            )
            denial = await self._request_approval(tc)
            if denial is not None:
                error_msg = (
                    "User rejected tool call"
                    if denial == "user_rejected"
                    else "Approval timeout"
                )
                logger.info(
                    "exec_policy 审批%s,命令不执行: tool=%s, session=%s",
                    "被拒绝" if denial == "user_rejected" else "超时",
                    tc.name,
                    self._session_id or "",
                )
                self._report_tool_error(
                    tc, error_msg, denial, (time.time() - start) * 1000
                )
                return ToolResult(
                    tool_call_id=tc.id,
                    name=tc.name,
                    result={"approved": False, "reason": denial},
                    error=error_msg,
                    duration_ms=(time.time() - start) * 1000,
                    error_type=denial,
                )
        # 用户已批准:登记一次性放行后原样重执行。
        approval_request = result.get("approval_request")
        command = ""
        if isinstance(approval_request, dict):
            command = str(approval_request.get("command") or "")
        if not command and isinstance(tc.args, dict):
            command = str(tc.args.get("command") or "")
        if command:
            try:
                from .mcp_server import approve_exec_command

                approve_exec_command(command)
            except Exception as e:  # 放行通道不可用 → 不重执行(绝不静默绕过策略)
                msg = f"exec_policy 审批放行登记失败,命令不执行: {e}"
                logger.warning("%s, session=%s", msg, self._session_id or "")
                self._report_tool_error(
                    tc, msg, "unknown", (time.time() - start) * 1000
                )
                return ToolResult(
                    tool_call_id=tc.id,
                    name=tc.name,
                    result={"approved": True, "executed": False},
                    error=msg,
                    duration_ms=(time.time() - start) * 1000,
                    error_type="unknown",
                )
        self._decision_hints[tc.id] = (
            "exec_policy_approved",
            "命令命中策略引擎 PROMPT 规则,经用户批准后执行",
        )
        # 批 42:记录本 tc 为"用户批准后执行的命令"(工具结果回填 user_shell 片段用)
        self._approved_command_call_ids.add(tc.id)
        try:
            new_result = await asyncio.wait_for(
                tool.executor(tc.args),
                timeout=self.tool_timeout,
            )
        except TimeoutError:
            error_msg = f"工具执行超时({self.tool_timeout}s)"
            self._report_tool_error(
                tc, error_msg, "timeout", (time.time() - start) * 1000
            )
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=error_msg,
                duration_ms=(time.time() - start) * 1000,
                retry_count=retry_count,
                error_type="timeout",
            )
        except Exception as e:
            error_type = self._classify_error(e)
            self._report_tool_error(
                tc, str(e), error_type, (time.time() - start) * 1000
            )
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=str(e),
                duration_ms=(time.time() - start) * 1000,
                retry_count=retry_count,
                error_type=error_type,
            )
        return ToolResult(
            tool_call_id=tc.id,
            name=tc.name,
            result=new_result,
            duration_ms=(time.time() - start) * 1000,
            retry_count=retry_count,
        )

    async def _execute_tools(self, tool_calls: list[ToolCall]) -> list[ToolResult]:
        """执行工具调用(并行或串行)。"""
        # 批58(接线):记录本轮模型尝试过的工具调用(对标 codex
        # executed_tool_calls.rs)。幂等(同 call_id 只记一次);off/None 零副作用;
        # 异常隔离不阻塞执行。回灌在下一次 LLM 请求的 metadata 里透出。
        if self._executed_tool_calls is not None:
            for _tc in tool_calls:
                try:
                    self._executed_tool_calls.record(_tc.id, _tc.name)
                except Exception as e:  # noqa: BLE001 - 记录失败降级跳过
                    logger.debug("executed_tool_calls.record 失败(降级跳过): %s", e)
        # P0-5(2026-09-13):plan.step 事件——本批每工具执行前发 started、录制后发
        # completed(成对);拦截/审批路径不发 blocked(由 tool.after/error 承载)。
        # decision/reason 取结果可见路径推导(_derive_step_decision),auto 免审批
        # 等不可见路径仍以录制器内的 hint 为准,此处尽力透出即可。
        for idx, tc in enumerate(tool_calls):
            await self._events.emit_plan_step(
                self._session_id or "", idx, tc.name, "started"
            )
        if self.parallel_tool_calls and len(tool_calls) > 1:
            # 并行执行
            # 2026-08-01 P1 修复:return_exceptions=True 防止单个工具异常崩溃整个 gather,
            # CancelledError(BaseException)不被 _execute_single 的 except Exception 捕获。
            tasks = [self._execute_single(tc) for tc in tool_calls]
            gathered_raw = await asyncio.gather(*tasks, return_exceptions=True)
            # P0-B(2026-09-18):循环内中断信号优先传播——gather(return_exceptions=True)
            # 会把 _LoopInterrupted 当普通异常吞掉转 ToolResult,导致并行工具批内
            # 用户取消/暂停失效;命中即整体上抛,交 _run_loop 走优雅中断链路。
            # 批 54(对标 codex parallel.rs):上抛前为批内异常项发 plan.step aborted
            # 事件;被取消工具的结构化中止回复由 _execute_single 的 CancelledError
            # 分支产出,历史成对性由批 53 normalize_history 兜底。
            for idx, (tc, item) in enumerate(zip(tool_calls, gathered_raw, strict=False)):
                if isinstance(item, _LoopInterrupted):
                    with contextlib.suppress(Exception):
                        await self._events.emit_plan_step(
                            self._session_id or "", idx, tc.name, "aborted",
                            reason="turn_interrupted",
                        )
                    raise item
            results: list[ToolResult] = []
            for idx, (tc, item) in enumerate(zip(tool_calls, gathered_raw, strict=False)):
                if isinstance(item, BaseException):
                    logger.error("工具 %s 未捕获异常: %s", tc.name, item)
                    tr = ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result=None,
                        error=f"工具未捕获异常: {item}",
                        duration_ms=0,
                    )
                    results.append(tr)
                    self._maybe_record_step(tc, tr)
                    self._record_deliverable_step(tc, tr)
                else:
                    results.append(item)
                    self._maybe_record_step(tc, item)
                    self._record_deliverable_step(tc, item)
                    tr = item
                decision, reason = _derive_step_decision(tr)
                await self._events.emit_plan_step(
                    self._session_id or "", idx, tc.name, "completed",
                    decision=decision, reason=reason,
                )
            return results
        else:
            # 串行执行(2026-08-01 P1 修复:变量名改为 serial_results,避免与并行分支的 results 重定义)
            serial_results: list[ToolResult] = []
            for idx, tc in enumerate(tool_calls):
                result = await self._execute_single(tc)
                serial_results.append(result)
                self._maybe_record_step(tc, result)
                self._record_deliverable_step(tc, result)
                decision, reason = _derive_step_decision(result)
                await self._events.emit_plan_step(
                    self._session_id or "", idx, tc.name, "completed",
                    decision=decision, reason=reason,
                )
            return serial_results

    @staticmethod
    def _tool_llm_usage_fields(result: Any) -> dict[str, Any]:
        """工具结果内嵌 LLM 用量 → step 顶层 tokens 字段(2026-09-09 立)。

        工具内部直接调 llm_gateway 时(如 extract_web 的 LLM 抽取通道),usage 随
        结果透出为 llm_usage/llm_model。此处映射为 tokens_in/tokens_out/tokens/model,
        使 cost_ledger.sync_from_recorder 与 tool_cost_accounting 聚合时真正入账。
        此前 llm_usage 只透出在 result_summary 里,聚合侧 tokens 永远为 0(假闭环)。
        P0-①(2026-09-18):改经 normalize_usage 统一归一化,透传厂商别名
        (cached_tokens/prompt_cache_hit_tokens 等)为 recorder 缓存字段。
        """
        if not isinstance(result, dict):
            return {}
        usage = result.get("llm_usage")
        if not isinstance(usage, dict):
            return {}
        normalized = normalize_usage(usage)
        tokens_in = int(normalized.get("prompt_tokens") or 0)
        tokens_out = int(normalized.get("completion_tokens") or 0)
        cached = int(normalized.get("cached_tokens") or 0)
        cache_write = int(normalized.get("cache_creation_tokens") or 0)
        if tokens_in <= 0 and tokens_out <= 0:
            return {}
        fields: dict[str, Any] = {
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "tokens": tokens_in + tokens_out,
        }
        if cached > 0:
            fields["cached_tokens"] = cached
        if cache_write > 0:
            fields["cache_creation_tokens"] = cache_write
        model = result.get("llm_model")
        if isinstance(model, str) and model:
            fields["model"] = model
        return fields

    def _maybe_record_llm_step(
        self,
        *,
        iteration: int,
        llm_response: dict[str, Any],
        duration_ms: float,
        messages_count: int,
        tools_count: int,
    ) -> None:
        """主循环 LLM 调用可观测录制(P0-①,2026-09-18 立):每轮 LLM 响应后 append 一步。

        recorder 未注入时立即返回(默认路径零差异);录制失败仅 log warning 降级,
        绝不阻塞主链路。usage 经 normalize_usage 归一化(Anthropic input_tokens/
        OpenAI prompt_tokens/DeepSeek prompt_cache_hit_tokens 等别名统一),
        tokens 全 0 时也保留该步(轮次与耗时仍有审计价值)。
        """
        rec = getattr(self, "_step_recorder", None)
        if rec is None:
            return
        run_id = getattr(rec, "run_id", None) or self._session_id or ""
        try:
            usage = normalize_usage(llm_response.get("usage"))
            tokens_in = int(usage.get("prompt_tokens") or 0)
            tokens_out = int(usage.get("completion_tokens") or 0)
            content = str(llm_response.get("content") or "")
            rec.append_step(
                run_id,
                {
                    "type": "llm",
                    "tool_name": "llm",
                    "model": str(llm_response.get("model") or ""),
                    "input_summary": (
                        f"iteration {iteration}, messages={messages_count}, "
                        f"tools={tools_count}"
                    ),
                    "result_summary": content[:200],
                    "status": "ok",
                    "duration_ms": round(float(duration_ms or 0.0), 2),
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "tokens": tokens_in + tokens_out,
                    "cached_tokens": int(usage.get("cached_tokens") or 0),
                    "cache_creation_tokens": int(
                        usage.get("cache_creation_tokens") or 0
                    ),
                },
            )
        except Exception as e:
            logger.warning("agent LLM step 录制失败(降级,不阻塞): %s", e)

    def _maybe_record_step(self, tc: ToolCall, tr: ToolResult) -> None:
        """工具调用可观测录制(2026-09-03 立):每次工具执行后 append 一步。

        recorder 未注入(getattr 取不到 self._step_recorder)时立即返回,默认路径
        零差异;录制失败仅 log warning 降级,绝不阻塞主链路。
        run_id 优先取 recorder 自带上下文(生产由调用方绑定 cloud run_id),
        否则回退 session_id 作为运行标识。
        """
        rec = getattr(self, "_step_recorder", None)
        # 1-1:先弹出决策提示(auto 免审批等不可见路径),无提示再从结果推导
        hint = self._decision_hints.pop(tc.id, None)
        if rec is None:
            return
        run_id = getattr(rec, "run_id", None) or self._session_id or ""
        try:
            decision, reason = hint if hint else _derive_step_decision(tr)
            # 1-5:推导可解释性证据(input/diff/test/rollback)一并落录制
            # (推导失败返回全 None,不阻塞录制)
            evidence = derive_step_evidence(
                tr.name or tc.name,
                dict(tc.args or {}),
                {"error": tr.error} if tr.error else tr.result,
                checkpoint_id=self._last_checkpoint_id,
            )
            rec.append_step(
                run_id,
                {
                    "type": "tool",
                    "tool_name": tr.name or tc.name,
                    "input_summary": _summarize_step(tc.args),
                    "result_summary": _summarize_step(
                        {"error": tr.error} if tr.error else tr.result
                    ),
                    "status": "error" if tr.error else "ok",
                    "duration_ms": round(float(tr.duration_ms or 0.0), 2),
                    **self._tool_llm_usage_fields(tr.result),
                    "input": tc.args,
                    "decision": decision,
                    "reason": reason,
                    **evidence,
                },
            )
        except Exception as e:
            logger.warning("agent step 录制失败(降级,不阻塞): %s", e)

    def _record_deliverable_step(self, tc: ToolCall, tr: ToolResult) -> None:
        """D27(2026-09)任务完成交付清单:每个工具执行后聚合一次(降级纪律)。

        与 _maybe_record_step 分离:录制器未注入时后者提前 return,而交付清单
        必须无条件聚合。diff 复用 derive_step_evidence(纯函数,重复推导开销
        可忽略);任何异常仅 warning,绝不阻塞工具执行主链路。
        """
        try:
            diff: dict[str, Any] | None = None
            if not tr.error:
                evidence = derive_step_evidence(
                    tr.name or tc.name, dict(tc.args or {}), tr.result
                )
                candidate = evidence.get("diff") if isinstance(evidence, dict) else None
                diff = candidate if isinstance(candidate, dict) else None
            self._deliverables.record_tool_call(tc.id, tc.name, dict(tc.args or {}), diff)
            self._record_deliverable_citation(tc.name, dict(tc.args or {}))
        except Exception as e:
            logger.warning("交付清单工具聚合失败(降级,不阻塞): %s", e)

    def _record_deliverable_citation(self, tool_name: str, args: dict[str, Any]) -> None:
        """D27:按工具名启发式映射 citation(wiki/memory/skill/mcp),拿不到就跳过。

        url 规则(跨端契约):wiki→/repo-wiki;memory→/memory/{entry_id};
        skill→source_url 否则 /skills;mcp→/mcp-projects。外部 MCP 工具以
        mcp_server.list_external_tools_injected() 名单判定(懒加载 + 失败降级,
        视为非 mcp 直接跳过)。
        """
        try:
            name = str(tool_name or "").strip().lower()
            if not name:
                return
            label = self._deliverable_citation_label(name, args)
            if "wiki" in name:
                self._deliverables.record_citation("wiki", label, "/repo-wiki")
            elif "memory" in name:
                entry_id = args.get("entry_id") or args.get("memory_id") or args.get("id")
                url = f"/memory/{entry_id}" if entry_id else None
                self._deliverables.record_citation("memory", label, url)
            elif "skill" in name:
                source_url = args.get("source_url") or args.get("sourceUrl")
                url = str(source_url) if source_url else "/skills"
                self._deliverables.record_citation("skill", label, url)
            else:
                from .mcp_server import list_external_tools_injected

                if name in list_external_tools_injected():
                    self._deliverables.record_citation("mcp", label, "/mcp-projects")
        except Exception as e:
            logger.warning("交付清单 citation 聚合失败(降级,不阻塞): %s", e)

    @staticmethod
    def _deliverable_citation_label(tool_name: str, args: dict[str, Any]) -> str:
        """从工具 args 提取人可读 label(常见键优先,兜底工具名,截断 80 字)。"""
        for key in (
            "title", "query", "question", "topic", "name",
            "skill", "path", "file_path", "url", "command",
        ):
            val = args.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()[:80]
        content = args.get("content") or args.get("text")
        if isinstance(content, str) and content.strip():
            return content.strip()[:80]
        return tool_name[:80] or "unknown"

    async def _execute_single(self, tc: ToolCall) -> ToolResult:
        """执行单个工具调用(含超时 + 错误处理 + L5-2 瞬时失败自动重试)。

        重试策略(2026-08-12 立):
        - 只重试瞬时错误(timeout/connection/http_5xx),重试语义安全(请求可能未达/响应丢失);
        - http_4xx 业务错误与 unknown 不重试(重试无意义且可能放大副作用);
        - 重试次数 tool_retry_max(默认 1),退避 tool_retry_backoff * attempt;
        - 非幂等工具由调用方自行权衡:默认仅 1 次且仅瞬时错误,风险可控。

        审批门(2026-08-30 立):高危工具在执行前先请求用户审批。
        - 审批只阻塞该工具自身;并行执行时非高危工具不受影响(各自独立等待)。
        - 拒绝 → error="User rejected tool call",error_type="user_rejected"
        - 超时 → error="Approval timeout",error_type="approval_timeout"
        - 结果 result={"approved": False} 回填给 LLM,LLM 感知"用户拒绝了该操作"。

        权限三模式(2026-09-02 立,对标 Claude Code permission modes):
        - plan 模式:入口强制收窄为只读白名单,白名单外工具直接拦截(error 回填),
          不执行、不进审批流(防御性再校验,理论上已被构造期收窄覆盖)。
        - auto 模式:只读白名单工具直接执行,跳过 _request_approval 审批门。
        - default 模式:本方法行为与现状完全一致(回归红线)。

        P0-3 安全三件套(2026-09-12 立,对标 Codex 安全栈):
        - guarded_pipeline 前置守卫:prompt 注入探测 + 危险入参扫描(fail-closed),
          拦截不进审批流、不执行(error_type=injection_blocked/scan_blocked)。
        - exec_policy PROMPT 档转真实审批:run_command 命中策略引擎 PROMPT 规则时,
          mcp_server 返回 EXEC_POLICY_NEEDS_APPROVAL 结构,此处升级为真实用户审批
          弹窗(enforce 模式);批准后经 mcp_server.approve_exec_command 一次性放行
          重执行,拒绝/超时不执行。
        """
        start = time.time()

        # plan 模式:白名单外工具防御性拦截(不执行、不进审批流、直接 error 回填)。
        # 构造期已将工具集收窄为「传入 tools ∩ READONLY_TOOLS」,此处为双保险再校验。
        if _is_readonly_mode(self._permission_mode) and not is_readonly_tool(tc.name):
            msg = f"permission_mode=plan:工具 {tc.name} 不在只读白名单"
            logger.info(
                "plan 模式拦截工具 %s(不在只读白名单), session=%s",
                tc.name,
                self._session_id or "",
            )
            # 错误结构化上报(与工具失败同链路,审计/元学习可见)
            self._report_tool_error(tc, msg, "permission_denied", 0.0)
            # 模式生效事件:工具被跳过(plan_blocked)
            await self._emit_permission_mode_event(tc.name, "plan_blocked")
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=msg,
                duration_ms=0,
                error_type="permission_denied",
            )

        # 审批门:高危工具执行前请求用户批准(审批等待不阻塞非高危工具)。
        # 免审批档(G-161 归一):acceptEdits(历史拼写 auto)只覆盖只读白名单工具;
        # bypassPermissions 覆盖全部高危工具(与 cli 端同名档语义一致),且必留审计事件。
        gate_approved = False  # P0-3:审批门已批准 → exec_policy PROMPT 不再二次弹窗
        needs_approval = self._approval_enabled and self._is_high_risk_tool_instance(tc.name)
        if _skips_approval_mode(self._permission_mode) and is_readonly_tool(tc.name):
            if needs_approval:
                logger.info(
                    "%s 档:只读工具 %s 免审批直接执行, session=%s",
                    self._permission_mode,
                    tc.name,
                    self._session_id or "",
                )
                # 模式生效事件:工具免审批(auto_skip_approval)
                await self._emit_permission_mode_event(tc.name, "auto_skip_approval")
                # 1-1:决策提示(执行成功与否都记录该步的免审批决策)
                self._decision_hints[tc.id] = (
                    "auto_skip_approval",
                    "auto 模式:只读工具免审批直接执行",
                )
            needs_approval = False
        elif self._permission_mode == "bypassPermissions" and needs_approval:
            # 免批可以是政策,但不能是静默的 —— warning 级 + 审计事件 + 决策提示三处留痕。
            logger.warning(
                "bypassPermissions 档:高危工具 %s 免审批直接执行, session=%s",
                tc.name,
                self._session_id or "",
            )
            await self._emit_permission_mode_event(tc.name, "bypass_skip_approval")
            self._decision_hints[tc.id] = (
                "bypass_skip_approval",
                "bypassPermissions 档:高危工具免审批直接执行",
            )
            needs_approval = False

        # 批 39 接线:外部 MCP 工具注解审批(acceptEdits 档专属判定,历史拼写 auto,对标 Codex
        # requires_mcp_tool_approval 保守语义)。仅当工具携带 mcp_annotations
        # 时生效——内部工具(注解恒 None)行为零变化;其余档不介入
        # (default 模式保持回归红线;bypassPermissions 已由上一分支全档免批,不再回插保守门)。
        # 判定为需批时不再走只读白名单免审,
        # 未知注解(destructive/open_world 缺失)按最坏情况需批。
        if (
            self._permission_mode == "acceptEdits"
            and needs_approval is False
            and not gate_approved
        ):
            _tool_def = self._tools.get(tc.name)
            _ann = getattr(_tool_def, "mcp_annotations", None) if _tool_def else None
            # 显式 is not None:空 dict 注解 = server 声明了注解对象但字段全未知,
            # 按保守语义同样需批(不能用 truthiness 跳过)。
            if _ann is not None:
                try:
                    _ta = _McpToolAnnotations(
                        read_only_hint=_ann.get("read_only_hint"),
                        destructive_hint=_ann.get("destructive_hint"),
                        open_world_hint=_ann.get("open_world_hint"),
                    )
                except Exception:
                    _ta = _McpToolAnnotations()  # 全未知 → 保守需批
                if _requires_mcp_tool_approval(_ta):
                    needs_approval = self._approval_enabled
                    if needs_approval:
                        self._decision_hints[tc.id] = (
                            "mcp_annotations_require_approval",
                            "auto 模式:MCP 工具注解按保守语义判定需人工审批",
                        )

        # 工具级审批策略覆盖(显式配置 > 模式隐含 > 高危清单,2026-09-18 立):
        # always 强制每次必审(auto 只读免审也被覆盖);never 强制免审(高危清单也放行);
        # on-request = 现状。覆盖决策记入 decision_hints(审计/元学习可见)。
        _policy = self._approval_policies.get(tc.name)
        if _policy == "always" and not needs_approval:
            needs_approval = True
            self._decision_hints[tc.id] = (
                "approval_policy_always",
                "工具级审批策略 always:该工具强制人工审批",
            )
        elif _policy == "never" and needs_approval:
            needs_approval = False
            self._decision_hints[tc.id] = (
                "approval_policy_never",
                "工具级审批策略 never:该工具免审批直接执行",
            )

        if needs_approval:
            denial = await self._request_approval(tc)
            if denial is not None:
                if denial == "user_rejected":
                    error_msg = "User rejected tool call"
                    error_type = "user_rejected"
                else:
                    error_msg = "Approval timeout"
                    error_type = "approval_timeout"
                logger.info(
                    "工具 %s 未执行(审批%s): approval denied=%s, session=%s",
                    tc.name,
                    "被拒绝" if denial == "user_rejected" else "超时",
                    denial,
                    self._session_id or "",
                )
                # 错误结构化上报(与工具失败同链路,审计/元学习可见)
                self._report_tool_error(
                    tc, error_msg, error_type, (time.time() - start) * 1000
                )
                return ToolResult(
                    tool_call_id=tc.id,
                    name=tc.name,
                    result={"approved": False, "reason": denial},
                    error=error_msg,
                    duration_ms=(time.time() - start) * 1000,
                    error_type=error_type,
                )
            # 审批门已批准(本 tc 一次会话内不再二次弹窗)
            gate_approved = True

        # 批 42 接线:内置 get_context_remaining(对标 codex tools/handlers/
        # get_context_remaining.rs)——模型可主动查询当前上下文窗口剩余 token,
        # 用于自主判断何时收敛/收尾。注册在 self._tools 之外的循环内置快捷路径:
        # 无需 executor、免审批(纯只读)、不经钩子。tokens_left 基于最近一次
        # LLM usage 记账的 rollout 剩余量(无记账/未启用时返回 None = 未知)。
        if tc.name == "get_context_remaining":
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result={"tokens_left": self._context_tokens_left()},
                duration_ms=(time.time() - start) * 1000,
            )

        tool = self._tools.get(tc.name)
        if self._tool_call_trace_enabled:
            # 批58(接线):trace 里程碑 received(对标 codex tools/call_trace.rs)。
            # 仅含标识符与工具名,绝不含参数或输出(红线);异常隔离不阻塞执行。
            try:
                from app.core.tool_call_trace import received as _trace_received

                _trace_received(
                    self._session_id or "",
                    tc.name,
                    tc.id,
                    source="direct",
                )
            except Exception as e:  # noqa: BLE001 - trace 失败降级跳过
                logger.debug("tool_call received trace 失败(降级跳过): %s", e)
        if not tool:
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=f"工具 {tc.name} 不存在",
                duration_ms=0,
                error_type="unknown",
            )

        # 批 39 接线:PRE_TOOL_USE 生命周期钩子(批 30 移植,可选注入)。
        # 任一钩子 decision=deny 即拒绝(denial_reason 带原因),不执行、
        # error_type=hook_denied;钩子未注册时 outcome 空 = 零行为变化;
        # 失败隔离/超时由 HookRuntime 内部处理,运行时异常降级放行不阻塞。
        if self._hook_runtime is not None:
            try:
                from ..core.hook_runtime import HookKind as _HookKind

                _hk_outcome = await self._hook_runtime.run(
                    _HookKind.PRE_TOOL_USE,
                    {"tool_name": tc.name, "tool_call_id": tc.id, "args": tc.args},
                )
                if _hk_outcome.denial_reason is not None:
                    return ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result={"blocked": True, "reason": _hk_outcome.denial_reason},
                        error=f"工具被 pre_tool_use 钩子拒绝: {_hk_outcome.denial_reason}",
                        duration_ms=(time.time() - start) * 1000,
                        error_type="hook_denied",
                    )
                # 批 57 接线:P1 用户可见缺口——消费 PRE_TOOL_USE 钩子注入的
                # 附加上下文(对标 Codex additionalContext / ContextualUserFragment),
                # 并入模型输入历史。非注入 / 列表为空 = 零行为变化;异常隔离,
                # 绝不阻塞工具执行主链路。消息形态对齐本文件 developer 片段。
                try:
                    if self._messages is not None:
                        for _ctx in getattr(_hk_outcome, "additional_contexts", None) or []:
                            _ctx_text = str(_ctx)[:4000]
                            if _ctx_text:
                                self._messages.append(
                                    {
                                        "role": "developer",
                                        "content": [{"type": "input_text", "text": _ctx_text}],
                                    }
                                )
                except Exception as e:  # noqa: BLE001 - 上下文注入失败隔离,不阻塞主链路
                    logger.warning("pre_tool_use 附加上下文注入异常(降级跳过): %s", e)
            except Exception as e:  # noqa: BLE001 - 钩子运行时异常隔离,不阻塞主链路
                logger.warning("pre_tool_use 钩子运行时异常(降级放行): %s", e)

        # P0-3(2026-09-12):guarded_pipeline 前置守卫——prompt 注入探测 +
        # 危险入参扫描(fail-closed),作为所有工具执行的默认包装层。
        # 拦截结果不进审批流、不执行,直接以结构化错误回填给 LLM。
        blocked = await self._pre_guard_check(tc)
        if blocked is not None:
            return blocked

        # 1-2 自动回滚:写盘工具执行前捕获文件快照(编辑前内容,每文件仅首次)。
        # 快照引用随 checkpoint 落库,restore(rollback_files=true)时经
        # file_editor.rollback_file 真正回滚——打通「单 run 文件级回滚」死代码。
        self._snapshot_before_write(tc)

        # P0-B(2026-09-18):终端流上下文注入——run_command 等工具执行期间经
        # mcp_server 的 _spawn_terminal_delta 发 terminal.delta 实时输出,事件
        # 按本 tc 归属(session/iteration/tool_call_id);finally 配对复位防跨工具
        # 泄漏。工具直调(无注入)不受影响,事件端按空 session 透传。
        terminal_ctx_token = None
        try:
            from .mcp_server import reset_terminal_stream_context, set_terminal_stream_context

            terminal_ctx_token = set_terminal_stream_context(
                session_id=self._session_id or "",
                run_id=self._session_id or "",
                iteration=self._current_iteration,
                tool_call_id=tc.id,
            )
        except Exception:
            logger.debug("终端流上下文注入失败(降级,terminal.delta 无归属): %s", tc.name)

        # P0-B(2026-09-18):_wait_interruptible 包裹工具执行——长工具(如
        # run_command 数分钟)期间命中 cancel/pause 标志立即中断;
        # _LoopInterrupted 不进重试链(显式 raise 直通 _run_loop 优雅中断)。
        retry_count = 0
        try:
            while True:
                try:
                    result = await asyncio.wait_for(
                        self._wait_interruptible(tool.executor(tc.args)),
                        timeout=self.tool_timeout,
                    )
                    # P0-3:exec_policy PROMPT 档转真实用户审批(命中时升级处理)。
                    tr_override = await self._resolve_exec_policy_approval(
                        tc, tool, result, start, retry_count, gate_approved=gate_approved
                    )
                    if tr_override is not None:
                        return tr_override
                    if self._tool_call_trace_enabled:
                        # 批58(接线):trace 里程碑 result_ready(仅标识符,无参数/输出)。
                        try:
                            from app.core.tool_call_trace import (
                                result_ready as _trace_result_ready,
                            )

                            _trace_result_ready(
                                self._session_id or "",
                                None,
                                tc.name,
                                tc.id,
                                source="direct",
                            )
                        except Exception as e:  # noqa: BLE001 - trace 失败降级跳过
                            logger.debug("tool_result_ready trace 失败(降级跳过): %s", e)
                    return ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result=result,
                        duration_ms=(time.time() - start) * 1000,
                        retry_count=retry_count,
                    )
                except _LoopInterrupted:
                    raise
                except asyncio.CancelledError:
                    # 批 54(对标 codex parallel.rs AbortedToolOutput):并行批内
                    # 回合中断会取消其余在途任务(见 _execute_tools 中断分支)。
                    # 被取消的工具不抛 CancelledError,而是产出结构化中止回复
                    # (含运行秒数),保证历史里每个 tool_call 都有回复且模型下轮
                    # 能看到"哪些工具被中止、跑了多久"。
                    secs = max(0.1, (time.time() - start))
                    abort_msg = f"[tool aborted] 工具被回合中断,已运行 {secs:.1f} 秒"
                    logger.info("工具 %s 被回合中断: %s", tc.name, abort_msg)
                    with contextlib.suppress(Exception):
                        await self._events.emit(
                            "tool.aborted",
                            {
                                "session_id": self._session_id,
                                "tool": tc.name,
                                "call_id": tc.id,
                                "ran_seconds": round(secs, 1),
                                "reason": "turn_interrupted",
                            },
                        )
                    return ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result=None,
                        error=abort_msg,
                        duration_ms=secs * 1000,
                        retry_count=retry_count,
                        error_type="aborted",
                    )
                except TimeoutError:
                    error_msg = f"工具执行超时({self.tool_timeout}s)"
                    error_type = "timeout"
                except Exception as e:
                    error_msg = str(e)
                    error_type = self._classify_error(e)

                if (
                    retry_count >= self.tool_retry_max
                    or error_type not in _TOOL_RETRYABLE_ERRORS
                ):
                    # L5-3 错误恢复:工具失败结构化上报(2026-08-12 立)
                    self._report_tool_error(
                        tc, error_msg, error_type, (time.time() - start) * 1000
                    )
                    return ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result=None,
                        error=error_msg,
                        duration_ms=(time.time() - start) * 1000,
                        retry_count=retry_count,
                        error_type=error_type,
                    )

                retry_count += 1
                # L5-12(2026-08-12):工具重试指标埋点
                try:
                    from ..middleware.agent_metrics import agent_loop_tool_retries_total
                    agent_loop_tool_retries_total.inc()
                except Exception:
                    pass
                backoff = self.tool_retry_backoff * retry_count
                # 2026-09-18 第三批:工具重试事件流出(客户端可感知瞬时失败正在重试)
                with contextlib.suppress(Exception):
                    await self._events.emit(
                        "tool.retry",
                        {
                            "session_id": self._session_id,
                            "tool": tc.name,
                            "attempt": retry_count,
                            "max_attempts": self.tool_retry_max,
                            "error_type": error_type,
                            "message": error_msg[:300],
                            "backoff_seconds": round(backoff, 2),
                        },
                    )
                logger.warning(
                    "工具 %s 执行失败[%s]: %s,%.1fs 后重试(%d/%d)",
                    tc.name,
                    error_type,
                    error_msg,
                    backoff,
                    retry_count,
                    self.tool_retry_max,
                )
                await asyncio.sleep(backoff)
        finally:
            if terminal_ctx_token is not None:
                with contextlib.suppress(Exception):
                    from .mcp_server import reset_terminal_stream_context

                    reset_terminal_stream_context(terminal_ctx_token)

    def _build_tools_schema(self) -> list[dict[str, Any]]:
        """构建 tools schema(给 LLM 的 function calling 格式)。"""
        schemas = [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in self._tools.values()
        ]
        # 批 42 接线:暴露 get_context_remaining(对标 codex get_context_remaining_spec.rs)。
        # 零参工具,模型可主动查询上下文窗口剩余 token 以自主决定收敛时机。
        schemas.append(
            {
                "type": "function",
                "function": {
                    "name": "get_context_remaining",
                    "description": (
                        "Get the remaining tokens in the current context window."
                    ),
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        )
        return schemas

    def _context_tokens_left(self) -> int | None:
        """get_context_remaining 后端:rollout 剩余量,未知时 None。"""
        try:
            if self._rollout_budget is not None:
                return self._rollout_budget.tokens_left()
        except Exception:  # noqa: BLE001 - 查询失败降级为未知
            pass
        return None

    def set_additional_context(self, key: str, value: str, kind: str) -> None:
        """批58(接线):生产侧写入附加上下文(对标 codex state/additional_context.rs)。

        开关关闭(无存储实例)时为空操作。kind ∈ {"Untrusted","Application"}:
        Untrusted → 后续每轮注入渲染为 user 角色 + ``<external_{key}>`` 标记;
        Application → developer 角色、无标记。同值重复写入由 merge 自然去重
        (不重复产出片段)。非法 kind 仅告警并忽略,不抛异常阻断调用方。
        """
        if self._additional_context_store is None:
            return
        if kind not in ("Untrusted", "Application"):
            logger.warning("set_additional_context 非法 kind=%r,已忽略(%s)", kind, key)
            return
        from app.core.additional_context_store import AdditionalContextEntry

        self._additional_context_desired[key] = AdditionalContextEntry(kind=kind, value=value)

    def _inject_world_state_sections(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):世界状态片段注入(对标 codex model.rs / context_window_guidance.rs
        / token_budget_context.rs)。开关关闭时直接返回(与现状逐零差异)。

        注入 developer 片段:剩余 token 预算(始终,取 rollout_budget.tokens_left();
        未知为 None);上下文窗元数据 ``<context_window>``(仅当 auto_compact_window
        实例存在时,用真实窗 id,不得伪造)。窗 id 缺失时仅注入上述静态片段,绝不报错。
        """
        if not self._world_state_sections_enabled:
            return
        try:
            from app.core.world_state_sections import (
                TokenBudgetRemainingContext,
                build_context_window_fragment,
            )

            # 剩余 token 片段(始终注入,developer 角色)
            messages.append(
                TokenBudgetRemainingContext(tokens_left=self._context_tokens_left()).render()
            )
            # 上下文窗元数据片段(依赖 auto_compact_window 真实窗 id,缺失则跳过)
            _acw = getattr(self, "_auto_compact_window", None)
            if _acw is not None:
                _ids = _acw.ids
                messages.append(
                    build_context_window_fragment(
                        agent_name=self._session_id or "ihui-agent",
                        first_window_id=_ids.first_window_id,
                        previous_window_id=_ids.previous_window_id,
                        window_id=_ids.window_id,
                        thread_hint=None,
                    )
                )
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.warning("world_state_sections 注入异常(降级跳过): %s", e)

    def _inject_additional_context(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):附加上下文注入(对标 codex state/additional_context.rs)。

        开关关闭或无存储实例时直接返回(零片段)。每轮把生产侧期望的完整映射经
        merge 取「值变化」片段(Untrusted→user + ``<external_{key}>``;Application→
        developer 无标记)追加;空映射不产生任何片段;同值重复 merge 不重复产出。
        """
        _store = getattr(self, "_additional_context_store", None)
        if _store is None:
            return
        try:
            _fragments = _store.merge(self._additional_context_desired)
            for _f in _fragments:
                messages.append(_f)
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.warning("additional_context 注入异常(降级跳过): %s", e)

    def _inject_guardian_context(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):guardian 安全审查上下文片段(对标 codex context/guardian_*.rs)。

        开关 off(env AGENT_GUARDIAN_POLICY 为空且 reminder 未开)直接返回,与现状
        逐零差异。on 时追加:guardian_policy 片段(env 提供策略文本,developer 角色);
        followup_review_reminder 片段(独立开关)。注入失败隔离不阻塞回合。
        """
        if not self._guardian_policy_text and not self._guardian_review_reminder:
            return
        try:
            from app.core.guardian_context import (
                build_guardian_followup_review_reminder_fragment,
                build_guardian_policy_fragment,
            )

            if self._guardian_policy_text:
                _pf = build_guardian_policy_fragment(self._guardian_policy_text)
                if _pf is not None:
                    messages.append(_pf)
            if self._guardian_review_reminder:
                _rf = build_guardian_followup_review_reminder_fragment()
                if _rf is not None:
                    messages.append(_rf)
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.warning("guardian_context 注入异常(降级跳过): %s", e)

    def _observe_auto_compact_prefill(self, usage: dict[str, Any]) -> None:
        """批58(接线):auto_compact_window prefill 观测(对标 codex
        ensure_server_observed_prefill_from_usage)。把本轮服务端归一的 input_tokens
        喂给账本(首次样本恒优先)。开关关闭/无实例时不操作;观测失败隔离,不阻塞。
        """
        _acw = getattr(self, "_auto_compact_window", None)
        if _acw is None:
            return
        try:
            from ..core.rollout_budget import normalize_rollout_usage

            _acw_usage = normalize_rollout_usage(usage or {})
            if _acw_usage:
                _acw.ensure_server_observed_prefill_from_usage(
                    int(_acw_usage.get("input_tokens", 0))
                )
        except Exception as e:  # noqa: BLE001 - 观测失败隔离
            logger.warning("auto_compact_window prefill 观测失败(降级跳过): %s", e)

    # ------------------------------------------------------------------
    # 批58(接线):上下文片段 / Session 前缀 / 指令片段 / 启动预热 / 流事件映射
    # ------------------------------------------------------------------
    def _derive_recap_history(self, messages: list[dict[str, Any]]) -> str:
        """从消息列表提取可读历史文本(供 context_fragments.build_recap_prompt 使用)。

        仅取 role/content 文本;content 为字符串直接拼接,为列表则取 input_text/
        output_text/text 片段。失败返回空串(降级为零历史,模块侧自行兜底)。
        """
        try:
            parts: list[str] = []
            for _m in messages or []:
                if not isinstance(_m, dict):
                    continue
                _role = _m.get("role", "")
                _content = _m.get("content", "")
                if isinstance(_content, str):
                    _text = _content
                elif isinstance(_content, list):
                    _text = "".join(
                        str(_c.get("text", "") or "")
                        for _c in _content
                        if isinstance(_c, dict)
                        and _c.get("type") in ("input_text", "output_text", "text")
                    )
                else:
                    _text = ""
                if _text:
                    parts.append(f"{_role}: {_text}")
            return "\n".join(parts)
        except Exception:  # noqa: BLE001 - 历史提取失败降级
            return ""

    def _inject_context_fragments(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):上下文片段组装注入(对标 codex context-fragments crate)。

        开关关闭时直接返回(零片段、与现状逐零差异)。开启时用本轮对话历史经
        build_recap_prompt 生成有界补课提示词,作为 developer 片段追加;注入失败
        隔离,不阻塞回合。
        """
        if not self._context_fragments_enabled:
            return
        try:
            from app.core.context_fragments import build_recap_prompt

            _history = self._derive_recap_history(messages)
            _recap = build_recap_prompt(_history)
            if _recap:
                messages.append({"role": "developer", "content": _recap})
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.debug("context_fragments 注入异常(降级跳过): %s", e)

    def _inject_session_prefix(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):Session 前缀片段注入(对标 codex session_prefix.rs)。

        开关关闭时直接返回(零片段、与现状逐零差异)。开启时经
        build_inter_agent_completion_fragment 产出 inter-agent 完成片段并追加;
        返回空 dict 时不追加;注入失败隔离,不阻塞回合。
        """
        if not self._session_prefix_enabled:
            return
        try:
            from app.core.session_prefix import build_inter_agent_completion_fragment

            _task = self._session_id or "ihui-agent"
            _frag = build_inter_agent_completion_fragment(
                task_name=_task, sender=_task, status="completed", message=None
            )
            if _frag:
                messages.append(_frag)
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.debug("session_prefix 注入异常(降级跳过): %s", e)

    def _inject_instructional_fragments(self, messages: list[dict[str, Any]]) -> None:
        """批58(接线):指令片段构造注入(对标 codex core/src/context/*_instructions.rs)。

        开关关闭时直接返回(零片段、与现状逐零差异)。开启时注入一组参数无关、低风险的
        指令片段(apps/plugins/environments/user_verification);逐条失败不影响其余片段;
        返回空则不追加;整体异常隔离,不阻塞回合。
        """
        if not self._instructional_fragments_enabled:
            return
        try:
            from app.core.instructional_fragments import (
                build_apps_instructions_fragment,
                build_available_plugins_instructions_fragment,
                build_environments_instructions_fragment,
                build_user_verification_notice_fragment,
            )

            for _builder in (
                build_apps_instructions_fragment,
                build_available_plugins_instructions_fragment,
                build_environments_instructions_fragment,
                build_user_verification_notice_fragment,
            ):
                _frag = _builder()
                if _frag:
                    messages.append(_frag)
        except Exception as e:  # noqa: BLE001 - 注入失败隔离,不阻塞回合
            logger.debug("instructional_fragments 注入异常(降级跳过): %s", e)

    async def _prewarm_factory(self) -> None:
        """最佳努力的网关连接预热占位(对标 codex 预热体)。

        默认空操作:真实预热体由调用方注入的实现扩展(本仓 LLM 网关连接已随首次
        请求自然建立)。本方法仅用于驱动 startup_prewarm 的机械(发起→限时兑现),
        不引入外部依赖、不调用模型。
        """
        await asyncio.sleep(0)

    async def _maybe_start_startup_prewarm(self) -> None:
        """批58(接线):后台发起会话启动预热(对标 codex session_startup_prewarm.rs)。

        仅开关开启且尚未发起时调用;在运行事件循环内创建后台 task。发起失败静默降级,
        不阻塞主链路。关闭时零动作,与现状逐零差异。
        """
        if not self._startup_prewarm_enabled or self._startup_prewarm_handle is not None:
            return
        try:
            from app.core.startup_prewarm import start_startup_prewarm

            self._startup_prewarm_handle = start_startup_prewarm(
                self._prewarm_factory, timeout=self._startup_prewarm_timeout
            )
        except Exception as e:  # noqa: BLE001 - 预热发起失败静默降级
            logger.debug("startup_prewarm 发起失败(降级跳过): %s", e)
            self._startup_prewarm_handle = None

    async def _resolve_startup_prewarm(self) -> None:
        """批58(接线):首回合前限时兑现预热(对标 codex resolve 语义)。

        无句柄时直接返回(零延迟)。有句柄时 await 其 resolve(),并加外层 wait_for 保险,
        确保绝不无限阻塞;兑现结果(status/耗时)存入 _startup_prewarm_resolution 供观测;
        任何失败静默降级,不阻塞主链路。
        """
        _handle = self._startup_prewarm_handle
        if _handle is None:
            return
        try:
            # 外层保险:即使 handle.resolve 内部超时逻辑异常,也绝不无限阻塞首回合
            self._startup_prewarm_resolution = await asyncio.wait_for(
                _handle.resolve(), timeout=self._startup_prewarm_timeout + 1.0
            )
        except Exception as e:  # noqa: BLE001 - 兑现失败静默降级
            logger.debug("startup_prewarm 兑现失败(降级跳过): %s", e)
            self._startup_prewarm_resolution = None

    def _record_stream_turn_item(self, llm_response: dict[str, Any]) -> None:
        """批58(接线):流事件回合项映射(对标 codex event_mapping.rs parse_turn_item)。

        开关关闭时直接返回(零产出、与现状逐零差异)。开启时把本轮 LLM 响应构造为
        ResponseItem 并归一化为回合项,仅作内部观测(存 _last_stream_turn_item),
        不回灌模型、不改动 messages/事件流。异常隔离,不阻塞回合。
        """
        if not self._stream_events_enabled:
            return
        try:
            from app.core.stream_events import parse_turn_item

            _content = llm_response.get("content", "") or ""
            if not isinstance(_content, str):
                _content = ""
            _item = {
                "type": "message",
                "role": "assistant",
                "id": llm_response.get("id"),
                "content": [{"type": "output_text", "text": _content}],
            }
            self._last_stream_turn_item = parse_turn_item(_item)
        except Exception as e:  # noqa: BLE001 - 映射失败隔离,不阻塞回合
            logger.debug("stream_events 回合项映射失败(降级跳过): %s", e)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
