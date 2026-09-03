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

| 模式     | 何时用                                   | 工具集(给 LLM)          | 写/执行类工具                 | 只读工具(READONLY_TOOLS)     | 与 approval 审批流的交互                                  |
|----------|------------------------------------------|-------------------------|------------------------------|------------------------------|----------------------------------------------------------|
| default  | 常规任务,安全由审批流兜底(回归红线)      | 全量                    | 走现有高危审批流(可批准/拒绝) | 走现有高危审批流(本就放行)   | 完全不变:`_request_approval` 按现状触发                   |
| plan     | 只读探查/审计/计划阶段,严禁任何副作用    | 收窄为 传入 tools ∩ READONLY_TOOLS | 直接拦截:返回 error「permission_mode=plan:工具 X 不在只读白名单」,不执行、不进审批 | 正常执行                     | 审批流对白名单外工具彻底不触发(防御性再校验在入口拦截)    |
| auto     | 信任环境,只读工具免打扰,写工具仍受控    | 全量                    | 走现有高危审批流(不变)        | 免审批直接执行(跳过 `_request_approval`) | 只读工具跳过审批;其余维持 default 行为                   |

与 `/agent-plan` 端点族的关系:端点是「计划文档 + 确认门」流程(plan_mode.py 的
state machine:draft→approved→executing),强调用户确认后再执行;本 permission_mode=plan
是**循环层强制只读执行**,可独立使用、也可在端点生成计划阶段叠加,二者正交、互不依赖。

模式生效事件:每当工具被跳过/免审批时,通过现有 hook_engine 发 `permission.mode`
事件(payload 含 mode/tool/decision),复用既有事件发射模式;该事件类型不影响
routers/agents.py 的固定 SSE 订阅列表(它只订阅 tool.before/after 等)。
"""

import asyncio
import json
import logging
import os
import random
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Callable, Optional, cast

from .agent_checkpoint import (
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    get_agent_checkpoint_manager,
)

if TYPE_CHECKING:
    from .memory_service import MemoryService

from .hook_engine import HookEngine, hook_engine
from .llm_budget_governor import (
    BudgetExceededError,
    llm_budget_governor,
)
from .plan_mode import READONLY_TOOLS, is_readonly_tool

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
    names = {t.strip() for t in extra.split(",") if t.strip()}
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
#   approval_id -> (asyncio.Event, decision|None)
# 决策值:"approve" / "reject"。等待方超时/完成后由 _request_approval 清理条目(防内存泄漏)。
_approval_registry: dict[str, tuple[asyncio.Event, Optional[str]]] = {}


def resolve_approval_response(approval_id: str, decision: str) -> bool:
    """写入审批决策并唤醒等待中的工具执行协程(由审批响应端点调用)。

    Args:
        approval_id: 审批请求 id
        decision: "approve" 或 "reject"(其他值视为 reject)

    Returns:
        True=决策已写入且协程被唤醒;False=approval_id 不存在(已超时清理或从未发起)
    """
    entry = _approval_registry.get(approval_id)
    if entry is None:
        return False
    ev, _ = entry
    _approval_registry[approval_id] = (ev, decision)
    try:
        ev.set()
    except Exception:
        pass
    return True


@dataclass
class ToolDefinition:
    """工具定义。"""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema
    executor: Callable[..., Any]  # async (args: dict) -> dict


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
    error: Optional[str] = None
    duration_ms: float = 0.0
    # L5-2 错误恢复:瞬时失败自动重试次数记录(2026-08-12 立)
    retry_count: int = 0
    # L5-8 错误恢复:失败的错误分类(timeout/connection/http_5xx/http_4xx/unknown,
    # 2026-08-12 立,供前端展示与可观测;成功为 None)
    error_type: Optional[str] = None


@dataclass
class LoopIteration:
    """单轮迭代记录。"""

    iteration: int
    reasoning: str = ""  # LLM 的思考(assistant message content),run() 内回填
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_ms: float = 0.0


@dataclass
class AgentLoopResult:
    """Agent 循环结果。"""

    success: bool
    final_response: str  # LLM 最终回复(无 tool_calls 的那一轮)
    iterations: list[LoopIteration]
    total_duration_ms: float
    total_tokens_used: int  # 估算
    stop_reason: str  # completed / max_iterations / error / no_tools / paused / cancelled / budget_exceeded
    error: Optional[str] = None
    # Wave 9:暂停/取消/失败时保存的 checkpoint_id(便于后续 resume),正常完成时为 None
    checkpoint_id: Optional[str] = None
    # 1-6 token 治理:预算治理摘要(主循环接入 budget governor 后填充;budget off 时为 None)
    budget: Optional[dict[str, Any]] = None
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
        session_id: Optional[str] = None,
        checkpoint_manager: Optional[AgentCheckpointManager] = None,
        # L1-1 记忆闭环接入(2026-07-25 立,对标 Hermes Agent 默认在线记忆)
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
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
        approval_enabled: Optional[bool] = None,
        approval_timeout: Optional[float] = None,
        # 权限三模式(2026-09-02 立,对标 Claude Code permission modes):
        # default=与现状完全一致(回归红线);plan=循环层强制只读;auto=只读工具免审批。
        # 默认 None 时取自 env AGENT_PERMISSION_MODE,再回退 "default";构造参数优先于 env。
        permission_mode: Optional[str] = None,
        # 1-6 token 治理:LLM 预算硬约束接入主循环(2026-09-02 立)。
        # budget_enabled:总开关,默认 None 时取 env AGENT_BUDGET_ENABLED(默认 off);
        #   构造参数优先于 env。on 时每轮 check_budget 硬停止 + record_usage 记录。
        # budget_pillar:check_budget/record_usage 使用的预算支柱(默认 terminal,见
        #   _agent_budget_pillar_from_env 注释;值须 ∈ _VALID_PILLARS)。
        # budget_max_token_estimate:无精确 usage 时每轮 check 的粗估 token 上限。
        budget_enabled: Optional[bool] = None,
        budget_pillar: Optional[str] = None,
        budget_max_token_estimate: Optional[int] = None,
        # 1-7 团队接力(P3-3,2026-09-03 立):把上一轮团队聚合摘要注入主导 agent 上下文。
        # team_relay_enabled:总开关,默认 None 时取 env AGENT_TEAM_RELAY_ENABLED(默认 off);
        #   构造参数优先于 env;off 时默认路径与现状逐零差异。
        # team_context:显式传入的团队上一轮摘要(结构化 dict 或纯文本 str),二者传递其一即可,
        #   与 agent_comm.AgentBlackboard 作为共享接力载体二选一,避免强耦合。
        team_relay_enabled: bool | None = None,
        team_context: Any | None = None,
        team_blackboard: Any | None = None,
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
            permission_mode: 权限三模式 "default"(默认,与现状一致) / "plan"(循环层
                强制只读) / "auto"(只读工具免审批)。None 时取 env AGENT_PERMISSION_MODE,
                再回退 "default";非法值 raise ValueError。
            team_relay_enabled: 团队接力总开关(默认 None 取 env AGENT_TEAM_RELAY_ENABLED,
                默认 off,与现状逐零差异)。on 时主导 agent 进入循环前注入团队上一轮摘要。
            team_context: 团队上一轮聚合上下文(结构化 dict 或纯文本 str),显式传递;
                None 时可经 team_blackboard 读取,二者选一(与 AgentBlackboard 弱耦合)。
            team_blackboard: 共享黑板(agent_comm.AgentBlackboard 实例);传 team_context
                则此参数可省略。loop 每轮从黑板默认 key(TEAM_RELAY_BLACKBOARD_KEY)读取摘要。
        """
        self._llm_complete = llm_complete_fn
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

        # 权限三模式(2026-09-02 立,对标 Claude Code permission modes)。
        # 优先级:构造参数 > env AGENT_PERMISSION_MODE > "default";非法值 raise ValueError。
        _resolved_mode = (
            permission_mode
            if permission_mode is not None
            else os.environ.get("AGENT_PERMISSION_MODE", "default")
        )
        if _resolved_mode not in ("default", "plan", "auto"):
            raise ValueError(
                f"非法 permission_mode: {_resolved_mode!r},"
                " 取值必须为 'default' / 'plan' / 'auto'"
            )
        self._permission_mode: str = _resolved_mode

        # plan 模式:循环入口强制收窄工具集为「传入 tools ∩ READONLY_TOOLS」,
        # LLM schema 也仅暴露只读工具(双保险:既收窄可见工具,又在执行入口做防御性再校验)。
        if self._permission_mode == "plan":
            self._tools = {
                name: td for name, td in self._tools.items() if name in READONLY_TOOLS
            }

        # 1-6 token 治理:预算硬约束开关/支柱/粗估 token(2026-09-02 立)。
        # 优先级:构造参数 > env;默认 off(向后兼容,避免 Phase 1 未验收线上突变)。
        self._budget_enabled: bool = (
            _agent_budget_enabled_from_env() if budget_enabled is None else bool(budget_enabled)
        )
        self._budget_pillar: str = (
            _agent_budget_pillar_from_env() if budget_pillar is None else (budget_pillar or "terminal")
        )
        self._budget_max_token_estimate: int = (
            _agent_budget_max_token_estimate_from_env()
            if budget_max_token_estimate is None
            else max(0, int(budget_max_token_estimate))
        )

        # Wave 9 checkpoint 配置
        self.enable_checkpoint = enable_checkpoint
        self._session_id: Optional[str] = session_id
        self._checkpoint_manager: AgentCheckpointManager = (
            checkpoint_manager
            if checkpoint_manager is not None
            else get_agent_checkpoint_manager()
        )

        # L1-1 记忆闭环配置(对标 Hermes Agent 默认在线记忆)
        self._user_id: Optional[str] = user_id
        self._conversation_id: Optional[str] = conversation_id
        # enable_memory 仅在 user_id 存在时才真正生效
        self._enable_memory: bool = bool(enable_memory and user_id)
        self._memory_svc: Optional["MemoryService"] = memory_svc

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

        # 运行时状态(每次 run() 开始时重置)
        self._messages: Optional[list[dict[str, Any]]] = None
        self._current_iteration: int = 0
        self._tool_state: dict[str, Any] = {}
        self._pause_requested: bool = False
        self._cancel_requested: bool = False
        # 1-7 团队接力:本次 run 的注入元信息(供可观测;未启用/无接力为 None)
        self._team_relay_info: dict[str, Any] | None = None

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
        # 1-7 团队接力:每次 run 重置注入元信息(避免跨 run 残留)
        self._team_relay_info = None

    async def _save_checkpoint_safe(
        self,
        iteration: int,
        messages: list[dict[str, Any]],
        status: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        """安全保存 checkpoint(失败只 log warning,不阻塞 loop)。返回 checkpoint_id 或 None。"""
        if not self.enable_checkpoint:
            return None
        try:
            session_id = self._ensure_session_id()
            return await self._checkpoint_manager.save_checkpoint(
                session_id=session_id,
                iteration=iteration,
                messages=messages,
                tool_state=self._tool_state,
                status=status,
                metadata=metadata,
            )
        except Exception as e:
            logger.warning("Agent 循环 checkpoint 保存失败(iter=%d status=%s): %s", iteration, status, e)
            return None

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
        # Hook 引擎: session.start
        try:
            await hook_engine.emit("session.start", {
                "session_id": self._session_id or "",
                "user_id": self._user_id or "",
                "conversation_id": self._conversation_id or "",
                "max_iterations": self.max_iterations,
            })
        except Exception:
            logger.warning("hook_engine.emit(session.start) 失败(降级,不阻塞)")
        self._ensure_session_id()
        self._messages = messages
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
        result = await self._run_loop(
            messages=messages,
            start_iteration=1,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(timezone.utc),
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
        # Hook 引擎: session.end
        try:
            await hook_engine.emit("session.end", {
                "session_id": self._session_id or "",
                "user_id": self._user_id or "",
                "success": result.success,
                "stop_reason": result.stop_reason,
                "total_iterations": len(result.iterations),
                "total_duration_ms": result.total_duration_ms,
            })
        except Exception:
            logger.warning("hook_engine.emit(session.end) 失败(降级,不阻塞)")
        # L5-12(2026-08-12):执行次数指标埋点(按 stop_reason)
        try:
            from ..middleware.agent_metrics import agent_loop_runs_total
            agent_loop_runs_total.labels(result.stop_reason).inc()
        except Exception:
            pass
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
        except Exception:
            pass
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
        except Exception as e:
            logger.warning("Skill 自进化评估启动失败(降级,不阻塞): %s", e)

    async def _llm_call_with_retry(
        self, messages: list[dict[str, Any]], tools_schema: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """LLM 调用带指数退避重试(错误恢复,2026-08-12 立)。

        网络抖动/5xx/超时等瞬时故障自动重试,指数退避 + 抖动避免同时失败风暴;
        重试耗尽后抛原始异常,由上层走 checkpoint(failed) 失败链路。
        asyncio.CancelledError 不重试(用户取消必须立即生效)。
        """
        last_exc: Optional[BaseException] = None
        for attempt in range(self.llm_retry_max + 1):
            try:
                return cast(dict[str, Any], await self._llm_complete(messages, tools_schema))
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
                backoff = self.llm_retry_backoff * (2**attempt) * (
                    0.5 + random.random() * 0.5
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

        for i in range(start_iteration, self.max_iterations + 1):
            # Wave 9:检查暂停/取消标志(在 LLM 调用前)
            if self._cancel_requested:
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status="cancelled",
                )
                return AgentLoopResult(
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
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
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
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
                        success=False,
                        final_response="",
                        iterations=iterations,
                        total_duration_ms=(
                            (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
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

            iter_start = datetime.now(timezone.utc)
            iteration = LoopIteration(iteration=i, start_time=iter_start.isoformat())

            try:
                # Hook 引擎: tool.before
                try:
                    await hook_engine.emit("tool.before", {
                        "session_id": self._session_id or "",
                        "iteration": i,
                        "messages_count": len(messages),
                        "tools_count": len(tools_schema) if tools_schema else 0,
                    })
                except Exception:
                    logger.warning("hook_engine.emit(tool.before) 失败(降级,不阻塞)")
                # 1. 调 LLM(带 tools,带指数退避重试)
                llm_response = await self._llm_call_with_retry(messages, tools_schema)

                content = llm_response.get("content", "")
                tool_calls_raw = llm_response.get("tool_calls")

                iteration.reasoning = content

                # 估算 token(粗略)
                total_tokens += len(content) // 4 + 50

                # 1-6 token 治理:记录本轮 LLM 用量(失败降级不阻塞)
                if self._budget_enabled:
                    await self._record_budget_usage_safe(
                        content=content,
                        usage=llm_response.get("usage"),
                        model=llm_response.get("model", ""),
                    )

                # 2. 无 tool_calls → 循环完成
                if not tool_calls_raw:
                    iteration.end_time = datetime.now(timezone.utc).isoformat()
                    iteration.duration_ms = (
                        (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                    )
                    iterations.append(iteration)

                    # Hook 引擎: message.receive
                    try:
                        await hook_engine.emit("message.receive", {
                            "session_id": self._session_id or "",
                            "iteration": i,
                            "content_length": len(content),
                            "stop_reason": "completed",
                        })
                    except Exception:
                        logger.warning("hook_engine.emit(message.receive) 失败(降级,不阻塞)")

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
                        success=True,
                        final_response=content,
                        iterations=iterations,
                        total_duration_ms=(
                            (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                        ),
                        total_tokens_used=total_tokens,
                        stop_reason="completed",
                    )

                # 3. 解析 tool_calls
                tool_calls: list[ToolCall] = []
                for tc_raw in tool_calls_raw:
                    tc = ToolCall(
                        # 2026-08-01 P1 修复:LLM 未返回 id 时用 uuid 生成唯一 ID,
                        # 原 f"call_{len(tool_calls)}" 会导致跨迭代 ID 碰撞(每次迭代都从 call_0 开始),
                        # OpenAI/Anthropic API 要求 tool_call_id 在会话内全局唯一,碰撞会 400 或错配结果。
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
                # Hook 引擎: tool.after
                try:
                    await hook_engine.emit("tool.after", {
                        "session_id": self._session_id or "",
                        "iteration": i,
                        "tool_calls_count": len(tool_calls),
                        "tool_results_count": len(tool_results),
                        "duration_ms": iteration.duration_ms,
                        # L5-8(2026-08-12):带每个工具结果明细,供前端展示
                        # 重试次数/错误分类(此前只有计数,用户侧看不到自动重试)
                        "tool_results": [
                            {
                                "name": tr.name,
                                "status": "error" if tr.error else "ok",
                                "error": tr.error,
                                "error_type": tr.error_type,
                                "retry_count": tr.retry_count,
                                "duration_ms": round(tr.duration_ms, 2),
                            }
                            for tr in tool_results
                        ],
                    })
                except Exception:
                    logger.warning("hook_engine.emit(tool.after) 失败(降级,不阻塞)")
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

                iteration.end_time = datetime.now(timezone.utc).isoformat()
                iteration.duration_ms = (
                    (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                logger.info(
                    "Agent 循环第 %d 轮:执行 %d 个工具,耗时 %.0fms",
                    i,
                    len(tool_calls),
                    iteration.duration_ms,
                )

                # Wave 9:每轮 iteration 结束后 checkpoint(status=running)
                await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="running",
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
                # Hook 引擎: error
                try:
                    await hook_engine.emit("error", {
                        "session_id": self._session_id or "",
                        "iteration": i,
                        "error": str(e),
                        "error_type": error_type,
                    })
                except Exception:
                    pass  # 异常中 emit 失败不记录日志(避免日志级联)
                iteration.end_time = datetime.now(timezone.utc).isoformat()
                iteration.duration_ms = (
                    (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                # Wave 9:异常时保存 checkpoint(status=failed),便于后续 resume
                # L5-1:metadata 带 error_type,供元学习失败聚类(2026-08-12 立)
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="failed",
                    metadata={"error": str(e), "error_type": error_type},
                )

                return AgentLoopResult(
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="error",
                    error=str(e),
                    checkpoint_id=checkpoint_id,
                )

        # 达到 max_iterations
        return AgentLoopResult(
            success=False,
            final_response="",
            iterations=iterations,
            total_duration_ms=(
                (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
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
        checkpoint: Optional[AgentLoopCheckpoint] = await self._checkpoint_manager.load_checkpoint(
            checkpoint_id
        )
        if checkpoint is None:
            raise ValueError(f"checkpoint {checkpoint_id} 不存在或已过期")

        if checkpoint.status == "completed":
            # 已完成的 checkpoint 无需续跑
            return AgentLoopResult(
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
            logger.warning("checkpoint %s 状态为 cancelled,仍允许续跑(用户显式 resume)", checkpoint_id)

        # 恢复状态
        self._session_id = checkpoint.session_id
        # 深拷贝消息历史,避免污染 checkpoint 存储中的引用
        messages = json.loads(json.dumps(checkpoint.messages, ensure_ascii=False))
        self._messages = messages
        self._tool_state = json.loads(json.dumps(checkpoint.tool_state, ensure_ascii=False))
        self._reset_run_state()

        start_iteration = checkpoint.iteration + 1
        if start_iteration > self.max_iterations:
            return AgentLoopResult(
                success=False,
                final_response="",
                iterations=[],
                total_duration_ms=0.0,
                total_tokens_used=0,
                stop_reason="max_iterations",
                error=f"checkpoint iteration {checkpoint.iteration} 已达 max_iterations {self.max_iterations}",
                checkpoint_id=checkpoint_id,
            )

        logger.info(
            "Agent 循环从 checkpoint %s 恢复,session=%s,从 iteration %d 续跑",
            checkpoint_id,
            checkpoint.session_id,
            start_iteration,
        )

        return await self._run_loop(
            messages=messages,
            start_iteration=start_iteration,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(timezone.utc),
        )

    async def pause(self) -> Optional[str]:
        """暂停当前 loop。

        若 loop 正在运行:设置 _pause_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=paused),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        self._pause_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="paused",
            )
        return None

    async def cancel(self) -> Optional[str]:
        """取消当前 loop。

        若 loop 正在运行:设置 _cancel_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=cancelled),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        self._cancel_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="cancelled",
            )
        return None

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
        """
        if name in _DEFAULT_HIGH_RISK_TOOLS:
            return True
        if any(name.startswith(p) for p in _HIGH_RISK_PREFIXES):
            return True
        return False

    def _is_high_risk_tool_instance(self, name: str) -> bool:
        """实例级高危判定(含 env 追加的自定义集合)。"""
        return self._is_high_risk_tool(name) or name in self._extra_high_risk_tools

    async def _request_approval(self, tc: ToolCall) -> Optional[str]:
        """发起审批请求并等待用户决策(阻塞等待,超时后放弃)。

        Returns:
            None = 用户已批准,工具可继续执行;
            "user_rejected" = 用户拒绝(工具不执行);
            "approval_timeout" = 等待超时(默认 60s,工具不执行)。
        """
        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
        ev = asyncio.Event()
        _approval_registry[approval_id] = (ev, None)
        try:
            # 参数预览:截断 200 字符(完整 args 不回传 SSE,避免敏感信息全量下发)
            try:
                args_preview = json.dumps(tc.args, ensure_ascii=False)[:200]
            except Exception:
                args_preview = str(tc.args)[:200]
            # 通过 hook_engine 发 tool.approval 事件(订阅者 = SSE 转发 + 前端弹窗)。
            # emit 内部有 _broadcast 向 SSE 订阅者推送;失败降级不抛(但审批继续等待,
            # 若事件完全无法送达,工具会在超时后以 approval_timeout 返回,安全兜底)。
            try:
                await hook_engine.emit("tool.approval", {
                    "approval_id": approval_id,
                    "tool_name": tc.name,
                    "tool_call_id": tc.id,
                    "args_preview": args_preview,
                    "danger_level": "high",
                    "session_id": self._session_id or "",
                })
            except Exception as e:
                logger.warning("hook_engine.emit(tool.approval) 失败(继续等待审批): %s", e)
            # 等待用户决策(批准/拒绝/超时)
            try:
                await asyncio.wait_for(ev.wait(), timeout=self._approval_timeout)
            except asyncio.TimeoutError:
                return "approval_timeout"
            _, decision = _approval_registry.get(approval_id, (None, None))
            if decision == "approve":
                return None
            return "user_rejected"
        finally:
            # 防内存泄漏:无论批准/拒绝/超时,清理注册表条目
            _approval_registry.pop(approval_id, None)

    async def _emit_permission_mode_event(self, tool_name: str, decision: str) -> None:
        """模式生效时发 `permission.mode` 事件(复用 hook_engine.emit 现有发射模式)。

        触发时机(工具被跳过/免审批):
        - plan 模式拦截白名单外工具 → decision="plan_blocked"
        - auto 模式只读工具免审批直接执行 → decision="auto_skip_approval"

        payload 含 mode/tool/decision/session_id。失败仅 warning 降级,绝不阻塞主链路。

        Args:
            tool_name: 触发事件时涉及的工具名
            decision: 决策标签(plan_blocked / auto_skip_approval)
        """
        try:
            await hook_engine.emit("permission.mode", {
                "mode": self._permission_mode,
                "tool": tool_name,
                "decision": decision,
                "session_id": self._session_id or "",
            })
        except Exception:
            logger.warning("hook_engine.emit(permission.mode) 失败(降级,不阻塞)")

    async def _execute_tools(self, tool_calls: list[ToolCall]) -> list[ToolResult]:
        """执行工具调用(并行或串行)。"""
        if self.parallel_tool_calls and len(tool_calls) > 1:
            # 并行执行
            # 2026-08-01 P1 修复:return_exceptions=True 防止单个工具异常崩溃整个 gather,
            # CancelledError(BaseException)不被 _execute_single 的 except Exception 捕获。
            tasks = [self._execute_single(tc) for tc in tool_calls]
            gathered_raw = await asyncio.gather(*tasks, return_exceptions=True)
            results: list[ToolResult] = []
            for tc, item in zip(tool_calls, gathered_raw):
                if isinstance(item, BaseException):
                    logger.error("工具 %s 未捕获异常: %s", tc.name, item)
                    results.append(ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        result=None,
                        error=f"工具未捕获异常: {item}",
                        duration_ms=0,
                    ))
                else:
                    results.append(item)
            return results
        else:
            # 串行执行(2026-08-01 P1 修复:变量名改为 serial_results,避免与并行分支的 results 重定义)
            serial_results: list[ToolResult] = []
            for tc in tool_calls:
                result = await self._execute_single(tc)
                serial_results.append(result)
            return serial_results

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
        """
        start = time.time()

        # plan 模式:白名单外工具防御性拦截(不执行、不进审批流、直接 error 回填)。
        # 构造期已将工具集收窄为「传入 tools ∩ READONLY_TOOLS」,此处为双保险再校验。
        if self._permission_mode == "plan" and not is_readonly_tool(tc.name):
            msg = f"permission_mode=plan:工具 {tc.name} 不在只读白名单"
            logger.info("plan 模式拦截工具 %s(不在只读白名单), session=%s", tc.name, self._session_id or "")
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
        # auto 模式:只读白名单工具免审批直接执行(跳过 _request_approval)。
        needs_approval = self._approval_enabled and self._is_high_risk_tool_instance(tc.name)
        if self._permission_mode == "auto" and is_readonly_tool(tc.name):
            if needs_approval:
                logger.info(
                    "auto 模式:只读工具 %s 免审批直接执行, session=%s",
                    tc.name,
                    self._session_id or "",
                )
                # 模式生效事件:工具免审批(auto_skip_approval)
                await self._emit_permission_mode_event(tc.name, "auto_skip_approval")
            needs_approval = False

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

        tool = self._tools.get(tc.name)
        if not tool:
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=f"工具 {tc.name} 不存在",
                duration_ms=0,
                error_type="unknown",
            )

        retry_count = 0
        while True:
            try:
                result = await asyncio.wait_for(
                    tool.executor(tc.args),
                    timeout=self.tool_timeout,
                )
                return ToolResult(
                    tool_call_id=tc.id,
                    name=tc.name,
                    result=result,
                    duration_ms=(time.time() - start) * 1000,
                    retry_count=retry_count,
                )
            except asyncio.TimeoutError:
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

    def _build_tools_schema(self) -> list[dict[str, Any]]:
        """构建 tools schema(给 LLM 的 function calling 格式)。"""
        return [
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
