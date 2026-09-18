# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine —— JSON-RPC 2.0 编排引擎(P2-③,2026-09-18 立)。

定位(对标 OpenAI Codex 的 app-server):
  Codex 开源 harness 的三层接入里,最锋利的是 app-server —— 让**任意应用**把 agent
  循环当引擎嵌入:持久会话、流式事件、中断、注入自有工具、审批转发。Codex 的引擎只对
  OpenAI 模型好用;本引擎把同一套协议能力建立在我们已经有的差异化之上:
  MCP 超级工具池 / 19 家 provider 模型路由 / 成本账本(含缓存三段计价)/ 决策链保留。

传输无关:
  本模块只处理 JSON-RPC 2.0 报文的进出(:meth:`AgentEngine.handle_message`),
  具体承载由 routers/engine.py 提供 —— HTTP 单发(`POST /api/engine/rpc`)与
  WebSocket 长连接(`WS /api/engine/ws`)。CLI / 桌面端 / 第三方应用 / 测试
  复用同一套引擎语义,不各自实现一遍。

方法集(method → 语义,均为 JSON-RPC params 对象):
  engine.initialize   能力握手(协议版本 + 能力表 + 差异化能力清单)
  engine.ping         存活探测
  thread.start        新建会话线程(模型 / 权限模式 / 工具白名单 / 工作区 / system)
  thread.prompt       执行一轮(过程事件经 thread/event 通知流式回传)
  thread.interrupt    中断在跑的轮次(cancel=取消 / pause=暂停并落 checkpoint)
  thread.resume       从 checkpoint 断点续跑
  thread.state        线程状态(状态机 + 迭代数 + checkpoint + 成本)
  thread.close        关闭线程(释放事件订阅与状态)
  thread.compact      手动压缩线程历史(确定性压缩,对标 Codex /compact)
  thread.export       导出线程为 JSONL(对标 Codex rollout 导出)
  thread.plan         读取线程当前计划(update_plan 工具写入)
  thread.enqueue      消息入队(轮中转向,本轮结束自动续跑,对标 Steer)
  thread.goal         设置/清除线程持久目标(注入 system,对标 Goals)
  thread.review       审查模式(派生审查子代理输出结构化结论,对标 review)
  tools.list          MCP 超级工具池 + 宿主注入工具的合并清单
  tools.register      注入宿主自有工具(执行回传客户端,经 tool/execute 往返)
  tools.search        工具目录模糊搜索(对标 tool_search,超量工具面延迟装载)
  tools.load          装载搜索到的工具进线程(对标 LoadableToolSpec materialize)
  tools.result        回传宿主工具执行结果(结算 tool/execute 请求)
  approval.respond    审批决策回填(与主循环 _approval_registry 打通)
  elicitation.respond 用户结构化提问回填(对标 elicitation;request_user_input 等待)
  cost.report         成本账本汇总(含缓存命中三段计价)
  models.list         模型路由 + 单价 + 缓存乘数清单

通知(server → client,不占请求 id):
  thread/event        {threadId, method, params}     agent 循环事件
  tool/execute        {requestId, threadId, name, arguments, timeoutMs}  宿主工具执行
  approval/request    {requestId, threadId, toolName, argsPreview, timeoutMs}

错误码:JSON-RPC 标准码(-32700/-32600/-32601/-32602/-32603)+ 应用码
(-32001 线程不存在 / -32002 线程忙 / -32003 等待超时 / -32004 未注册的宿主工具 /
-32005 宿主工具执行失败 / -32006 线程已关闭)。

多轮会话语义(确定性,不依赖 LLM):
  线程维护自己的对话历史。每次 prompt 传**消息副本**给主循环(主循环会就地改写
  system 消息做记忆/画像/团队接力注入),运行结束后只把 role ∈ {user, assistant, tool}
  的消息回写线程历史 —— 注入类 system 内容每次重新生成,不会跨轮累积膨胀。
  工具轨迹因此完整保留,中断/暂停的中途状态走 checkpoint(thread.resume)续跑。
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import itertools
import json
import logging
import os
import sys
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .session_store import SessionStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 协议常量
# ---------------------------------------------------------------------------

PROTOCOL_VERSION = "2026.09.18"
SERVER_NAME = "ihui-agent-engine"
SERVER_VERSION = "1.0.0"

# JSON-RPC 2.0 标准错误码
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
# 应用错误码(-32000 ~ -32099 为规范保留给实现自定义的区间)
THREAD_NOT_FOUND = -32001
THREAD_BUSY = -32002
WAIT_TIMEOUT = -32003
TOOL_NOT_FOUND = -32004
HOST_TOOL_FAILED = -32005
THREAD_CLOSED = -32006
BUDGET_EXHAUSTED = -32007

# 订阅的 agent 循环事件名(与 agent_loop_v2.AgentEventStream 的全部 emit 点一一对应)
AGENT_EVENTS: tuple[str, ...] = (
    "session.start",
    "session.end",
    "thinking.delta",
    "message.receive",
    "tool.before",
    "tool.after",
    "tool.approval",
    "permission.mode",
    "plan.step",
    "llm.retry",
    "self_heal",
    "error",
)

# 宿主工具回调默认超时(客户端执行完回传 approval.respond 式的 tool/result)
DEFAULT_HOST_TOOL_TIMEOUT_MS = 30_000
# 事件转发器轮询间隔(秒);只影响通知延迟上限,不影响主循环执行
EVENT_POLL_INTERVAL = 0.05
# 事件载荷里可作会话关联的键(thinking.delta / self_heal 用 run_id 承载 session)
_SESSION_KEYS = ("session_id", "run_id")
# 事件名 → 通知 method 的前缀映射(thread/event 统一封装,载荷含原始方法名)
_HIGH_RISK_PREVIEW_CHARS = 400

class OrderedEventQueue:
    """hook 总线订阅队列代理:额外记录全局入队序号,使跨事件名的到达顺序可复原。

    为什么需要:hook_engine 按事件名分队列广播,若逐个队列顺序读取,通知顺序会退化成
    "事件名声明顺序",而流式协议(thread/event)的顺序本身就是语义的一部分(先 think
    再 tool 再 message)。代理只暴露 hook_engine 用到的 full/put_nowait/get_nowait
    三个方法,故无需改动 hook_engine 本体。
    """

    __slots__ = ("_items", "_counter", "_maxsize")

    def __init__(self, counter: Any, maxsize: int = 500) -> None:
        self._items: list[tuple[int, Any]] = []
        self._counter = counter
        self._maxsize = maxsize

    def full(self) -> bool:
        return len(self._items) >= self._maxsize

    def put_nowait(self, item: Any) -> None:
        if self.full():
            self._items.pop(0)  # 慢消费者丢最旧(与 hook_engine 队列满语义一致)
        self._items.append((next(self._counter), item))

    def get_nowait(self) -> Any:
        if not self._items:
            raise asyncio.QueueEmpty
        return self._items.pop(0)

    def __len__(self) -> int:
        return len(self._items)


Emitter = Callable[[dict[str, Any]], Awaitable[None]]
"""通知发射器:由承载层提供(HTTP-SSE 写字节 / WS 发帧 / 测试收集列表)。"""

LoopFactory = Callable[[dict[str, Any], list[Any]], Awaitable[Any]]
"""主循环工厂:(spec, host_tools) → AgentLoopV2 实例(承载层注入,便于替换与测试)。

spec 键:model / permission_mode / max_iterations / tool_names / workspace /
        user_id / conversation_id / session_id / thread_id / enable_checkpoint。
host_tools 为引擎构造的宿主工具 ToolDefinition 列表(承载层需并入工具集)。
"""


class JsonRpcError(Exception):
    """带 JSON-RPC 错误码的业务异常(handle_message 会转成标准错误响应)。"""

    def __init__(self, code: int, message: str, data: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


async def _noop_emitter(_payload: dict[str, Any]) -> None:
    """默认发射器:承载层未提供时静默丢弃通知(测试/无订阅场景)。"""
    return None


def _error_response(
    req_id: Any, code: int, message: str, data: Any | None = None
) -> dict[str, Any]:
    """构造 JSON-RPC 2.0 错误响应(id 原样回显,未知时用 null)。"""
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": req_id if req_id is not None else None, "error": err}


def _ok_response(req_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


@dataclass
class HostToolSpec:
    """宿主(客户端)自有工具:执行发生在客户端进程,结果经 JSON-RPC 回传。"""

    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=lambda: {"type": "object"})
    timeout_ms: int = DEFAULT_HOST_TOOL_TIMEOUT_MS


# ---------------------------------------------------------------------------
# 第四批常量(2026-09-18,榨干 Codex harness 剩余可学面)
# ---------------------------------------------------------------------------
# unified_exec 会话并发上限(对标 Codex unified_exec process_manager)
_MAX_EXEC_SESSIONS = 8
# unified_exec 单会话输出缓冲上限(字符;保留 head+tail,中间截断标注)
_EXEC_BUFFER_HEAD = 4_000
_EXEC_BUFFER_TAIL = 16_000
# unified_exec 会话空闲回收(秒;超时且进程已退出才真正移除)
_EXEC_SESSION_TTL = 600.0
# elicitation 用户提问默认超时(ms)(对标 Codex elicitation)
_DEFAULT_ELICITATION_TIMEOUT_MS = 30_000
# auto-compact 默认触发阈值(估算 token;对标 Codex compact_token_budget)
_AUTOCOMPACT_DEFAULT_THRESHOLD = 60_000
# 角色模板(对标 Codex agent-roles / collaboration-mode-templates):
# spawn_subagent / thread.start 指定 role 后,模板指令追加进 system 全程可见。
_AGENT_ROLE_TEMPLATES: dict[str, str] = {
    "implementer": "你是资深实现工程师:优先写出可运行的最小改动,显式列出改动文件与理由。",
    "reviewer": "你是严格的代码审查者:逐条给出 blocker/major/minor 发现,不泛泛而谈。",
    "researcher": "你是研究分析者:多源交叉核对事实,输出带依据与置信度的结论。",
    "tester": "你是测试工程师:设计覆盖正常/边界/异常路径的用例并给出复现步骤。",
    "planner": "你是任务规划者:把目标拆解为可执行步骤,标注依赖顺序与验收标准。",
}

# ---------------------------------------------------------------------------
# run_code 常量(2026-09-18 第六批,对标 Codex code-mode/V8 cell):
# 模型写 Python 代码在常驻子进程中执行,tools.call(...) 桥接引擎工具,
# 全局状态跨调用持久(cell 语义);进程隔离 + 超时击杀 + 输出有界。
# ---------------------------------------------------------------------------
_MAX_CODE_SESSIONS = 4
_CODE_SESSION_TTL = 900.0
_CODE_OUTPUT_HEAD = 4_000
_CODE_OUTPUT_TAIL = 12_000
_CODE_DEFAULT_TIMEOUT_MS = 60_000
_CODE_MAX_TIMEOUT_MS = 300_000
# 单次 run 允许的嵌套工具调用上限(防失控,对标 CodeModeNestedToolCall 治理)
_CODE_MAX_NESTED_TOOL_CALLS = 50
# 常驻子进程引导脚本:stdin/stdout 走 JSON 行协议;用户 print 被重定向捕获,
# tools.call 经管道同步往返(子进程阻塞读 → 父进程结算)。
_CODE_BOOTSTRAP = r'''
import io
import json
import sys

_proto_out = sys.stdout


def _send(obj):
    _proto_out.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto_out.flush()


class _Tools:
    """引擎工具桥:代码内 tools.call(name, args) → 引擎结算 → 返回结果。"""

    def call(self, name, args=None):
        _send({"type": "toolCall", "name": name, "args": args if args is not None else {}})
        line = sys.__stdin__.readline()
        if not line:
            raise RuntimeError("code session 管道已关闭")
        resp = json.loads(line)
        if resp.get("ok"):
            return resp.get("result")
        raise RuntimeError("工具 {} 调用失败: {}".format(name, resp.get("error")))


def _fresh_globals():
    return {"__name__": "__code_cell__", "__builtins__": __builtins__, "tools": _Tools()}


GLOBALS = _fresh_globals()

while True:
    line = sys.stdin.readline()
    if not line:
        break
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
    except ValueError:
        _send({"type": "done", "ok": False, "error": "协议帧非法"})
        continue
    op = req.get("op")
    if op == "reset":
        GLOBALS = _fresh_globals()
    elif op != "run":
        _send({"type": "done", "ok": False, "error": "未知 op: {}".format(op)})
        continue
    out_cap, err_cap = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = out_cap, err_cap
    try:
        exec(compile(req.get("code") or "", "<code-cell>", "exec"), GLOBALS)
        ok, err = True, None
    except SystemExit as e:
        ok, err = True, None
        out_cap.write("[SystemExit: {}]".format(e))
    except BaseException as e:  # noqa: BLE001
        import traceback

        ok = False
        err = "".join(traceback.format_exception_only(type(e), e)).strip()
    sys.stdout, sys.stderr = sys.__stdout__, sys.__stderr__
    text = out_cap.getvalue()
    err_text = err_cap.getvalue()
    if err_text:
        text = text + "\n[stderr]\n" + err_text
    if len(text) > 20000:
        text = text[:4000] + "\n...[输出截断]...\n" + text[-12000:]
    _send({"type": "done", "ok": ok, "error": err, "output": text, "reset": op == "reset"})
'''


@dataclass
class EngineThread:
    """引擎线程 = 持久会话(对话历史 + 状态机 + 待回填请求)。"""

    thread_id: str
    session_id: str
    model: str | None
    permission_mode: str
    max_iterations: int
    tool_names: list[str] | None
    workspace: str | None
    user_id: str | None
    conversation_id: str | None
    messages: list[dict[str, Any]]
    # idle | running | closed
    status: str = "idle"
    loop: Any | None = None
    checkpoint_id: str | None = None
    last_result: dict[str, Any] | None = None
    prompts: int = 0
    host_tools: dict[str, HostToolSpec] = field(default_factory=dict)
    # requestId → Future(宿主工具执行回传 / 审批决策回传)
    pending: dict[str, asyncio.Future[Any]] = field(default_factory=dict)
    # 本轮承载连接的发射器(宿主工具/通知经它出站;多连接并存互不覆盖)
    emit: Emitter | None = None
    # 当前持久化轮次(session_store turn_id,用于结束后回写 AgentMessage/Error)
    current_turn_id: str | None = None
    # 工具级审批策略(2026-09-18 立,对标 Codex per-tool approval_policy;
    # "*" 为全局档,per-tool 显式值优先)
    approval_policies: dict[str, str] = field(default_factory=dict)
    # Turn Context 冻结(2026-09-18 立,对标 Codex harness TurnContext):每轮 prompt
    # 开始时快照本轮生效配置;thread.resume(checkpoint 续跑)强制用冻结副本,防
    # 「interrupt → 客户端改配置 → resume」状态串台。非 checkpoint 路径每轮刷新。
    frozen_context: dict[str, Any] | None = None
    # 生成参数 / 推理配置(2026-09-18 第二批,对标 Codex model_reasoning 配置面):
    # 随 frozen_context 冻结,resume 时同样还原,防轮间配置漂移。
    model_params: dict[str, Any] = field(default_factory=dict)
    reasoning: dict[str, Any] = field(default_factory=dict)
    # 负向工具过滤(对标 Codex per-app omit_tools_from):构造循环工具后剔除
    deny_tools: list[str] = field(default_factory=list)
    # 模型可见计划(update_plan 内置工具写入,对标 Codex PlanUpdate/plan tool)
    plan: list[dict[str, Any]] | None = None
    # 子代理嵌套深度(spawn_subagent 防递归失控,上限 _MAX_SUBAGENT_DEPTH)
    depth: int = 0
    # 消息队列(2026-09-18 第三批,对标 Codex Steer/ThreadQueueChanged):
    # 轮中入队的输入在本轮结束后自动依序续跑
    queue: list[dict[str, Any]] = field(default_factory=list)
    # 线程持久目标(2026-09-18 第三批,对标 Codex Goals):注入 system 全程可见
    goal: str | None = None
    # token 预算(2026-09-18 第三批,对标 Codex TokenBudget/RolloutBudget):
    # 跨回合累计 session_tokens_used,达到 token_budget 即拒起新轮
    token_budget: int | None = None
    session_tokens_used: int = 0
    # 自动压缩(2026-09-18 第四批,对标 Codex compact_token_budget):
    # 每轮结束后估算 token 超阈值即确定性压缩(发 context.compacted, trigger=auto)
    auto_compact: bool = False
    auto_compact_threshold: int = _AUTOCOMPACT_DEFAULT_THRESHOLD
    # 结构化终答(2026-09-18 第四批,对标 Codex output_schema):轮末校验 finalResponse
    output_schema: dict[str, Any] | None = None
    # 角色模板(2026-09-18 第四批,对标 Codex agent-roles):追加进 system
    role: str | None = None
    # shell 快照(2026-09-18 第四批,对标 Codex shell_snapshot):
    # unified_exec 最近一次会话 cwd,跨轮供模型感知工作目录漂移
    last_shell_cwd: str | None = None
    # Turn Timing(2026-09-18 第四批,对标 Codex turn_timing):最近一轮起止
    last_turn_timing: dict[str, Any] | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.updated_at = time.time()


_VALID_APPROVAL_POLICIES = ("never", "on-request", "always")


def _normalize_policy_dict(raw: Any) -> dict[str, str]:
    """校验 per-tool 审批策略 dict(值 ∈ never/on-request/always)。"""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise JsonRpcError(INVALID_PARAMS, "toolApprovalPolicies 须为 {tool: policy} 对象")
    out: dict[str, str] = {}
    for tool, pol in raw.items():
        if pol not in _VALID_APPROVAL_POLICIES:
            raise JsonRpcError(
                INVALID_PARAMS,
                f"非法 approval_policy: 工具 {tool!r} 值 {pol!r},"
                " 取值必须为 'never' / 'on-request' / 'always'",
            )
        out[str(tool)] = str(pol)
    return out


def _parse_policy_config(params: dict[str, Any]) -> dict[str, str]:
    """解析 thread.start/exec 的策略配置(2026-09-18 立,对标 Codex harness 结构化策略)。

    支持三种形态,可叠加(后者覆盖前者):
    - approvalPolicy: "never"|"on-request"|"always" → 全局档(作用于所有工具);
    - toolApprovalPolicies: {tool_name: policy} → per-tool 显式配置;
    - policyToml: TOML 文本 → 结构化解析(对标 Codex config.toml):
        [tools.<name>]
        approval_policy = "always"
      也接受顶层 approval_policy = "..."。tomllib 解析失败/字段非法 → INVALID_PARAMS。
    """
    policies: dict[str, str] = {}
    global_policy = params.get("approvalPolicy")
    if global_policy is not None:
        if global_policy not in _VALID_APPROVAL_POLICIES:
            raise JsonRpcError(
                INVALID_PARAMS,
                f"非法 approvalPolicy: {global_policy!r},取值必须为 {_VALID_APPROVAL_POLICIES}",
            )
        # 全局档:作用于所有工具(以 "*" 通配表示,per-tool 显式值可覆盖)
        policies["*"] = str(global_policy)
    policies.update(_normalize_policy_dict(params.get("toolApprovalPolicies")))

    policy_toml = params.get("policyToml")
    if isinstance(policy_toml, str) and policy_toml.strip():
        try:
            import tomllib

            doc = tomllib.loads(policy_toml)
        except Exception as e:
            raise JsonRpcError(INVALID_PARAMS, f"policyToml 解析失败: {e}") from e
        top = doc.get("approval_policy")
        if top is not None:
            if top not in _VALID_APPROVAL_POLICIES:
                raise JsonRpcError(INVALID_PARAMS, f"非法 approval_policy: {top!r}")
            policies["*"] = str(top)
        tools_section = doc.get("tools")
        if tools_section is not None:
            if not isinstance(tools_section, dict):
                raise JsonRpcError(INVALID_PARAMS, "policyToml 的 [tools] 段须为表")
            raw_map = {
                name: (cfg.get("approval_policy") if isinstance(cfg, dict) else cfg)
                for name, cfg in tools_section.items()
            }
            policies.update(_normalize_policy_dict(raw_map))
    return policies


def _resolve_approval_policy(policies: dict[str, str], tool_name: str) -> str | None:
    """查工具的生效审批策略:per-tool 显式 > "*" 全局档;无配置返回 None。"""
    pol = policies.get(tool_name)
    if pol is not None:
        return pol
    return policies.get("*")


# ---------------------------------------------------------------------------
# 生成参数 / 推理配置 / 负向工具过滤(2026-09-18 第二批,对标 Codex model_reasoning
# 与 per-app omit_tools_from 配置面):thread.start 可带 modelParams(白名单键 +
# camelCase 别名)/ reasoning {effort, summary} / denyTools。
# ---------------------------------------------------------------------------

_MODEL_PARAM_NUMERIC: tuple[str, ...] = (
    "temperature",
    "top_p",
    "presence_penalty",
    "frequency_penalty",
)
_MODEL_PARAM_INTEGRAL: tuple[str, ...] = ("max_tokens", "max_completion_tokens", "seed")
_MODEL_PARAM_ALIASES: dict[str, str] = {
    "maxTokens": "max_tokens",
    "maxCompletionTokens": "max_completion_tokens",
    "topP": "top_p",
    "presencePenalty": "presence_penalty",
    "frequencyPenalty": "frequency_penalty",
}
_VALID_MODEL_PARAM_KEYS: frozenset[str] = frozenset(
    {*_MODEL_PARAM_NUMERIC, *_MODEL_PARAM_INTEGRAL, "stop"}
)
_REASONING_EFFORTS: tuple[str, ...] = ("minimal", "low", "medium", "high")
_REASONING_SUMMARIES: tuple[str, ...] = ("auto", "concise", "detailed")
_VALID_PLAN_STATUSES: tuple[str, ...] = ("pending", "in_progress", "completed")

# view_image 工具(对标 Codex view_image):工作区内的图片读取
_IMAGE_MIME_TYPES: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}
_MAX_VIEW_IMAGE_BYTES = 8 * 1024 * 1024
# 引擎内置工具面(宿主同名工具可显式覆盖;denyTools / tools 白名单同样生效)
BUILTIN_ENGINE_TOOLS: tuple[str, ...] = (
    "update_plan",
    "spawn_subagent",
    "view_image",
    "request_permissions",
    "unified_exec",
    "request_user_input",
    "apply_patch",
    "run_code",
)
# 子代理嵌套深度上限(spawn_subagent 防递归失控)
_MAX_SUBAGENT_DEPTH = 2
# 单次 prompt 自动消化队列消息上限(Steer 防失控)
_MAX_QUEUE_DRAIN_PER_PROMPT = 5
# request_permissions 审批请求默认超时(ms)
_DEFAULT_PERMISSION_TIMEOUT_MS = 30_000
_VALID_PERMISSION_SCOPES: tuple[str, ...] = (
    "sandbox_full_access",
    "network",
    "elevated_exec",
    "workspace_write",
)


def _parse_output_schema(raw: Any) -> dict[str, Any] | None:
    """解析 outputSchema(2026-09-18 第四批,对标 Codex output_schema)。

    须为 JSON Schema 子集:{"type": "object", "properties": {...},
    "required"?: [str]}。非法 → INVALID_PARAMS(构造期 fail-fast)。
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise JsonRpcError(INVALID_PARAMS, "outputSchema 须为 JSON Schema 对象")
    if raw.get("type") != "object" or not isinstance(raw.get("properties"), dict):
        raise JsonRpcError(
            INVALID_PARAMS, 'outputSchema 须为 {"type": "object", "properties": {...}} 形态'
        )
    required = raw.get("required")
    if required is not None and (
        not isinstance(required, list)
        or not all(isinstance(x, str) for x in required)
    ):
        raise JsonRpcError(INVALID_PARAMS, "outputSchema.required 须为字符串数组")
    return raw


def _validate_output_schema_payload(
    schema: dict[str, Any], text: str
) -> dict[str, Any]:
    """对最终答复做 outputSchema 宽松校验(零新增依赖,对标 Codex structured output)。

    finalResponse 须为合法 JSON 且满足:type=object / required 全在 /
    properties 声明的基本类型一致(string/number/boolean/array/object/null)。
    返回 {valid, errors}。
    """
    errors: list[str] = []
    parsed: Any = None
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError) as e:
        errors.append(f"finalResponse 不是合法 JSON: {e}")
        return {"valid": False, "errors": errors}
    if not isinstance(parsed, dict):
        errors.append("顶层须为 JSON object")
        return {"valid": False, "errors": errors}
    required = schema.get("required") or []
    for key in required:
        if key not in parsed:
            errors.append(f"缺少 required 字段: {key}")
    type_map: dict[str, tuple[type, ...]] = {
        "string": (str,),
        "number": (int, float),
        "boolean": (bool,),
        "array": (list,),
        "object": (dict,),
        "null": (type(None),),
    }
    for prop, spec in (schema.get("properties") or {}).items():
        if prop not in parsed or not isinstance(spec, dict):
            continue
        expected = spec.get("type")
        allowed = type_map.get(str(expected))
        if allowed and not isinstance(parsed[prop], allowed):
            errors.append(f"字段 {prop} 类型须为 {expected}")
    return {"valid": not errors, "errors": errors}


# ---------------------------------------------------------------------------
# apply_patch:unified diff 结构化补丁(2026-09-18 第五批,对标 Codex apply-patch)
# ---------------------------------------------------------------------------


def _parse_unified_patch(patch_text: str) -> list[dict[str, Any]]:
    """解析标准 unified diff(git diff 兼容)为文件段列表。

    支持:新增文件(--- /dev/null)/ 删除文件(+++ /dev/null)/ 多 hunk 更新
    (含上下文行 + 新增行 + 删除行)。返回 [{old_path, new_path, hunks: [
    {old_start, old_lines, lines: [(tag, text)]}]}];无合法文件段 → ValueError。
    """
    import re as _re

    lines = patch_text.splitlines()
    sections: list[dict[str, Any]] = []
    i = 0
    n = len(lines)
    header_re = _re.compile(r"^--- (?P<p>.+)$")
    new_re = _re.compile(r"^\+\+\+ (?P<p>.+)$")
    hunk_re = _re.compile(
        r"^@@ -(?P<os>\d+)(?:,(?P<ol>\d+))? \+(?P<ns>\d+)(?:,(?P<nl>\d+))? @@"
    )
    while i < n:
        line = lines[i]
        if line.startswith("diff --git") or line.startswith("index ") or line.startswith(
            ("new file mode", "deleted file mode", "old mode", "new mode", "similarity ")
        ):
            i += 1
            continue
        m = header_re.match(line)
        if m is None:
            i += 1
            continue
        old_path = m.group("p").strip()
        # 紧随其后必须是 +++ 行(允许中间空行/新文件标记)
        j = i + 1
        new_path: str | None = None
        while j < n and new_path is None:
            nm = new_re.match(lines[j])
            if nm is not None:
                new_path = nm.group("p").strip()
                j += 1
                break
            if lines[j].startswith(("new file mode", "deleted file mode", "index ")):
                j += 1
                continue
            break
        if new_path is None:
            i += 1
            continue
        hunks: list[dict[str, Any]] = []
        while j < n:
            hm = hunk_re.match(lines[j])
            if hm is None:
                break
            old_start = int(hm.group("os"))
            hunk_lines: list[tuple[str, str]] = []
            j += 1
            while j < n:
                raw = lines[j]
                if raw.startswith("\\"):  # "\ No newline at end of file"
                    j += 1
                    continue
                # 下一文件段的 "--- path" 后随 "+++ path" → hunk 结束(防吞成删除行)
                if raw.startswith("--- ") and j + 1 < n and lines[j + 1].startswith("+++ "):
                    break
                if raw.startswith((" ", "+", "-")):
                    hunk_lines.append((raw[0], raw[1:]))
                    j += 1
                    continue
                break
            hunks.append(
                {
                    "old_start": old_start,
                    "old_count": int(hm.group("ol") or 1),
                    "lines": hunk_lines,
                }
            )
        sections.append(
            {"old_path": old_path, "new_path": new_path, "hunks": hunks}
        )
        i = j
    if not sections:
        raise ValueError(
            "补丁中未找到合法的 unified diff 文件段(需要 --- / +++ / @@ 头)"
        )
    return sections


def _strip_diff_prefix(path: str) -> str:
    """去掉 diff 路径的 a/ b/ 前缀与首尾空白(/dev/null 原样保留)。"""
    p = path.strip()
    if p == "/dev/null":
        return p
    if p.startswith(("a/", "b/")):
        p = p[2:]
    return p.lstrip("/")


def _apply_hunks_to_content(
    content: str, hunks: list[dict[str, Any]], rel_path: str
) -> str:
    """把单个文件的 hunks 应用到文件内容(原子:任一 hunk 上下文失配即抛错)。

    上下文匹配:从 hunk 声明行号附近开始窗口搜索(± 25 行),精确匹配
    「上下文+删除行」序列;找不到 → ValueError(带失败 hunk 定位)。
    """
    src = content.split("\n")
    pos = 0  # 已消费的 src 行游标(0-based)
    out: list[str] = []
    for idx, hunk in enumerate(hunks):
        expect_old: list[str] = []
        expect_new: list[str] = []
        for tag, text in hunk["lines"]:
            if tag in (" ", "-"):
                expect_old.append(text)
            if tag in (" ", "+"):
                expect_new.append(text)
        # 窗口搜索:以声明行(夹取到文件范围)为中心 ± 25 行;失配再全文兜底扫描
        center = min(max(hunk["old_start"] - 1, pos), max(pos, len(src) - 1))
        found = -1
        for delta in range(0, 26):
            for cand in (center + delta, center - delta if delta else -1):
                if cand < pos or cand + len(expect_old) > len(src):
                    continue
                if src[cand : cand + len(expect_old)] == expect_old:
                    found = cand
                    break
            if found >= 0:
                break
        if found < 0:
            for cand in range(pos, len(src) - len(expect_old) + 1):
                if src[cand : cand + len(expect_old)] == expect_old:
                    found = cand
                    break
        if found < 0:
            raise ValueError(
                f"{rel_path}: hunk #{idx + 1}(声明行 {hunk['old_start']})上下文失配"
                ",补丁与文件内容不一致"
            )
        out.extend(src[pos:found])
        out.extend(expect_new)
        pos = found + len(expect_old)
    out.extend(src[pos:])
    return "\n".join(out)


def _parse_generation_config(params: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """解析 modelParams + reasoning(2026-09-18 第二批)。

    - modelParams:白名单键(accept camelCase 别名)→ 值类型校验,非法 → INVALID_PARAMS。
      值最终透传 llm_gateway → litellm(temperature/top_p/max_tokens/...)。
    - reasoning: {effort, summary};effort 注入 model_params["reasoning_effort"]
      (litellm 通道命名),summary 随 spec 保留(供应商差异面,不强转)。
    返回 (model_params, reasoning)。
    """
    raw = params.get("modelParams")
    model_params: dict[str, Any] = {}
    if raw is not None:
        if not isinstance(raw, dict):
            raise JsonRpcError(INVALID_PARAMS, "modelParams 须为对象")
        for key, value in raw.items():
            key = _MODEL_PARAM_ALIASES.get(str(key), str(key))
            if key not in _VALID_MODEL_PARAM_KEYS:
                raise JsonRpcError(
                    INVALID_PARAMS,
                    f"modelParams 不支持键: {key}(允许: {sorted(_VALID_MODEL_PARAM_KEYS)})",
                )
            if key in _MODEL_PARAM_NUMERIC:
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise JsonRpcError(INVALID_PARAMS, f"modelParams.{key} 须为数值")
            elif key in _MODEL_PARAM_INTEGRAL:
                if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                    raise JsonRpcError(INVALID_PARAMS, f"modelParams.{key} 须为正整数")
            elif not (
                isinstance(value, str)
                or (isinstance(value, list) and all(isinstance(v, str) for v in value))
            ):
                raise JsonRpcError(INVALID_PARAMS, "modelParams.stop 须为字符串或字符串数组")
            model_params[key] = value
    raw_reasoning = params.get("reasoning")
    reasoning: dict[str, Any] = {}
    if raw_reasoning is not None:
        if not isinstance(raw_reasoning, dict):
            raise JsonRpcError(INVALID_PARAMS, "reasoning 须为对象")
        effort = raw_reasoning.get("effort")
        if effort is not None:
            if effort not in _REASONING_EFFORTS:
                raise JsonRpcError(
                    INVALID_PARAMS, f"reasoning.effort 非法: {effort!r}(取值 {_REASONING_EFFORTS})"
                )
            reasoning["effort"] = str(effort)
            model_params.setdefault("reasoning_effort", str(effort))
        summary = raw_reasoning.get("summary")
        if summary is not None:
            if summary not in _REASONING_SUMMARIES:
                raise JsonRpcError(
                    INVALID_PARAMS,
                    f"reasoning.summary 非法: {summary!r}(取值 {_REASONING_SUMMARIES})",
                )
            reasoning["summary"] = str(summary)
    return model_params, reasoning


def _parse_deny_tools(params: dict[str, Any]) -> list[str]:
    """解析 denyTools(对标 Codex per-app omit_tools_from 的负向过滤)。"""
    deny = params.get("denyTools")
    if deny is None:
        return []
    if not isinstance(deny, list) or not all(isinstance(x, str) and x for x in deny):
        raise JsonRpcError(INVALID_PARAMS, "denyTools 须为非空字符串数组")
    return list(dict.fromkeys(deny))


def _spec(thread: EngineThread) -> dict[str, Any]:
    """把线程配置转成主循环工厂的 spec(承载层据此构造 AgentLoopV2)。

    Turn Context 冻结:frozen_context 存在时以冻结快照为准(resume 场景防串台)。
    """
    ctx = thread.frozen_context or {}
    return {
        "thread_id": thread.thread_id,
        "session_id": thread.session_id,
        "model": ctx.get("model", thread.model),
        "permission_mode": ctx.get("permission_mode", thread.permission_mode),
        "max_iterations": ctx.get("max_iterations", thread.max_iterations),
        "tool_names": ctx.get("tool_names", thread.tool_names),
        "workspace": ctx.get("workspace", thread.workspace),
        "user_id": thread.user_id,
        "conversation_id": thread.conversation_id,
        "approval_policies": ctx.get("approval_policies"),
        "model_params": ctx.get("model_params") or {},
        "reasoning": ctx.get("reasoning") or {},
        "deny_tools": ctx.get("deny_tools") or [],
        "goal": thread.goal,
        "enable_checkpoint": True,
    }


def _coerce_input_text(value: Any) -> str:
    """把 prompt 入参归一为文本(string / {text} / [{role,content}] / [str] 均兼容)。"""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("text", "content", "prompt"):
            inner = value.get(key)
            if isinstance(inner, str):
                return inner
        raise JsonRpcError(INVALID_PARAMS, "input 对象需含 text/content/prompt 字段")
    if isinstance(value, list):
        chunks: list[str] = []
        for item in value:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                inner = item.get("text") or item.get("content")
                if isinstance(inner, str):
                    chunks.append(inner)
            else:
                raise JsonRpcError(INVALID_PARAMS, "input 数组元素须为 string 或对象")
        return "\n".join(chunks)
    raise JsonRpcError(INVALID_PARAMS, "input 须为 string / 对象 / 数组")


class AgentEngine:
    """JSON-RPC 2.0 编排引擎(传输无关;线程级并发隔离)。

    用法(承载层):
        engine = AgentEngine(loop_factory=my_factory)
        resp = await engine.handle_message(raw_json, emit)   # emit 推送通知

    设计约束:
    - 引擎不直接依赖 FastAPI / WS / SSE —— 承载层决定传输;
    - 主循环是唯一执行内核(AgentLoopV2),引擎只做协议、会话、事件与回填;
    - 事件经 hook_engine 订阅获得(不侵入主循环实现),按会话标识过滤后转发;
    - 所有等待(宿主工具/审批)都有超时,超时降级为错误返回,绝不悬挂线程。
    """

    def __init__(
        self,
        loop_factory: LoopFactory,
        *,
        tool_lister: Callable[[], Awaitable[list[dict[str, Any]]]] | None = None,
        cost_report: Callable[[dict[str, Any] | None], dict[str, Any]] | None = None,
        model_lister: Callable[[], list[dict[str, Any]]] | None = None,
        hook_bus: Any | None = None,
        host_tool_timeout_ms: int = DEFAULT_HOST_TOOL_TIMEOUT_MS,
        store: SessionStore | None = None,
        locked_system_prompt: str | None = None,
    ) -> None:
        self._loop_factory = loop_factory
        self._tool_lister = tool_lister
        self._cost_report = cost_report
        self._model_lister = model_lister
        self._injected_bus = hook_bus
        self._host_tool_timeout_ms = int(host_tool_timeout_ms)
        self._threads: dict[str, EngineThread] = {}
        # 服务端 system prompt 锁定(2026-09-18 立,对标 Codex harness server-delivered
        # prompts):非空时 thread.start 的客户端 systemPrompt 被忽略,强制用服务端值
        # (多租户合规:防客户端覆盖安全提示);回退 env AGENT_ENGINE_LOCKED_SYSTEM_PROMPT。
        self._locked_system_prompt: str | None = (
            locked_system_prompt
            if locked_system_prompt is not None
            else (os.getenv("AGENT_ENGINE_LOCKED_SYSTEM_PROMPT") or None)
        )
        # 会话持久化(session_store 单例/注入;None=未初始化,False=不可用哨兵)
        self._store: SessionStore | None | bool = store
        # request_permissions 工具的待决请求(requestId → Future;approval.respond 结算)
        self._permission_requests: dict[str, asyncio.Future[Any]] = {}
        # elicitation 中轮提问的待决请求(2026-09-18 第四批,对标 Codex elicitation)
        self._elicitation_requests: dict[str, asyncio.Future[Any]] = {}
        # unified_exec 持久 shell 会话(2026-09-18 第四批,对标 Codex unified_exec)
        self._exec_sessions: dict[str, dict[str, Any]] = {}
        # run_code 常驻代码会话(2026-09-18 第六批,对标 Codex code-mode cell)
        self._code_sessions: dict[str, dict[str, Any]] = {}
        self._handlers: dict[str, Callable[[dict[str, Any], Emitter], Any]] = {
            "engine.initialize": self._handle_initialize,
            "engine.ping": self._handle_ping,
            "thread.start": self._handle_thread_start,
            "thread.prompt": self._handle_thread_prompt,
            "thread.interrupt": self._handle_thread_interrupt,
            "thread.resume": self._handle_thread_resume,
            "thread.state": self._handle_thread_state,
            "thread.close": self._handle_thread_close,
            "thread.compact": self._handle_thread_compact,
            "thread.export": self._handle_thread_export,
            "thread.plan": self._handle_thread_plan,
            "thread.enqueue": self._handle_thread_enqueue,
            "thread.goal": self._handle_thread_goal,
            "thread.review": self._handle_thread_review,
            "agent.exec": self._handle_agent_exec,
            "tools.list": self._handle_tools_list,
            "tools.register": self._handle_tools_register,
            "tools.search": self._handle_tools_search,
            "tools.load": self._handle_tools_load,
            "tools.result": self._handle_tools_result,
            "approval.respond": self._handle_approval_respond,
            "elicitation.respond": self._handle_elicitation_respond,
            "cost.report": self._handle_cost_report,
            "models.list": self._handle_models_list,
        }

    # ------------------------------------------------------------------
    # 报文入口
    # ------------------------------------------------------------------

    async def handle_message(
        self, raw: str | bytes | dict[str, Any], emit: Emitter | None = None
    ) -> dict[str, Any] | None:
        """处理一条 JSON-RPC 2.0 报文;返回响应 dict,通知类(无 id)返回 None。

        异常语义:任何 handler 异常都被收敛成 JSON-RPC 错误响应,绝不向上抛
        (承载层因此不需要 try;parse/params 级错误亦按标准码返回)。
        """
        emit_fn: Emitter = emit or _noop_emitter
        try:
            msg = json.loads(raw) if isinstance(raw, str | bytes) else raw
        except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
            return _error_response(None, PARSE_ERROR, "JSON 解析失败")
        if not isinstance(msg, dict):
            return _error_response(None, INVALID_REQUEST, "报文须为 JSON 对象")
        req_id = msg.get("id")
        if msg.get("jsonrpc") != "2.0":
            return _error_response(req_id, INVALID_REQUEST, "缺少 jsonrpc=2.0")
        method = msg.get("method")
        if not isinstance(method, str) or not method:
            return _error_response(req_id, INVALID_REQUEST, "缺少 method")
        params = msg.get("params", {})
        if params is None:
            params = {}
        if not isinstance(params, dict):
            return _error_response(req_id, INVALID_PARAMS, "params 须为对象")
        handler = self._handlers.get(method)
        if handler is None:
            return _error_response(
                req_id, METHOD_NOT_FOUND, f"未知方法: {method}",
                {"supported": sorted(self._handlers)},
            )
        is_notification = "id" not in msg
        try:
            result = await handler(params, emit_fn)
        except JsonRpcError as e:
            if is_notification:
                logger.warning("[engine] 通知 %s 处理失败: %s", method, e.message)
                return None
            return _error_response(req_id, e.code, e.message, e.data)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001 - 协议层兜底:任何内部异常都转错误响应
            logger.exception("[engine] 方法 %s 内部异常", method)
            if is_notification:
                return None
            return _error_response(req_id, INTERNAL_ERROR, f"{type(e).__name__}: {e}")
        if is_notification:
            return None
        return _ok_response(req_id, result)

    # ------------------------------------------------------------------
    # 线程查找/参数校验
    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # 会话持久化(2026-09-18 立,对照 Codex harness Thread/Rollout 能力):
    # engine 线程此前纯内存态,进程重启丢全部活跃会话。现接线 SessionStore:
    # thread.start 落库 / prompt 每轮落 Turn+User/Agent/Error Item /
    # _require_thread 未命中时按需从库恢复。全部失败降级为 log,不打断对话主链路。
    # ------------------------------------------------------------------

    def _persistence_store(self) -> SessionStore | None:
        """惰性获取 SessionStore(默认复用 routers.sessions 的进程级单例)。

        环境变量 AGENT_ENGINE_PERSIST=off 可整体关闭;初始化失败记哨兵不再重试。
        """
        if self._store is False:
            return None
        if self._store is not None:
            # 已初始化(注入实例/单例;含测试替身,鸭子类型直接用)
            return self._store  # type: ignore[return-value]
        if str(os.getenv("AGENT_ENGINE_PERSIST", "on")).lower() in ("0", "off", "false"):
            self._store = False
            return None
        try:
            from app.routers.sessions import get_session_store

            self._store = get_session_store()
        except Exception as e:
            logger.warning("[engine] SessionStore 不可用,线程不持久化: %s", e)
            self._store = False
        return self._store if isinstance(self._store, SessionStore) else None

    def _persist_thread_created(self, thread: EngineThread) -> None:
        """thread.start 落库(metadata 保存线程配置,供重启恢复还原)。"""
        store = self._persistence_store()
        if store is None:
            return
        try:
            if store.get_thread(thread.thread_id) is not None:
                return  # 恢复后重复 start 等场景,已有记录
            store.create_thread(
                title=f"engine {thread.thread_id}",
                thread_id=thread.thread_id,
                metadata={
                    "sessionId": thread.session_id,
                    "model": thread.model,
                    "permissionMode": thread.permission_mode,
                    "maxIterations": thread.max_iterations,
                    "toolNames": thread.tool_names,
                    "workspace": thread.workspace,
                    "userId": thread.user_id,
                    "conversationId": thread.conversation_id,
                    "approvalPolicies": thread.approval_policies or None,
                    "modelParams": thread.model_params or None,
                    "reasoning": thread.reasoning or None,
                    "denyTools": thread.deny_tools or None,
                    "tokenBudget": thread.token_budget,
                    "goal": thread.goal,
                    "outputSchema": thread.output_schema,
                    "autoCompact": thread.auto_compact,
                    "autoCompactThreshold": thread.auto_compact_threshold,
                    "role": thread.role,
                    "systemPromptSource": (
                        "server-locked" if self._locked_system_prompt else "client-or-default"
                    ),
                    "systemPrompt": (
                        thread.messages[0].get("content", "")
                        if thread.messages and thread.messages[0].get("role") == "system"
                        else ""
                    ),
                },
            )
        except Exception as e:
            logger.warning("[engine] thread.created 持久化失败 %s: %s", thread.thread_id, e)

    def _persist_turn_start(self, thread: EngineThread, user_text: str) -> str | None:
        """prompt 开轮:Turn + UserMessageItem。返回 turn_id(失败 None)。"""
        store = self._persistence_store()
        if store is None:
            return None
        try:
            turn = store.start_turn(thread.thread_id, metadata={"model": thread.model})
            from .session_store import UserMessageItem

            store.append_item(
                turn.turn_id, UserMessageItem(content=user_text), thread_id=thread.thread_id
            )
            thread.current_turn_id = turn.turn_id
            return turn.turn_id
        except Exception as e:
            logger.warning("[engine] turn.start 持久化失败 %s: %s", thread.thread_id, e)
            return None

    def _persist_turn_end(
        self, thread: EngineThread, turn_id: str | None, payload: dict[str, Any]
    ) -> None:
        """prompt 结束:AgentMessageItem(+ErrorItem)并关 Turn。"""
        if not turn_id:
            return
        store = self._persistence_store()
        if store is None:
            return
        try:
            from .session_store import AgentMessageItem, ErrorItem

            response = str(payload.get("finalResponse", "") or "")
            if response:
                store.append_item(
                    turn_id,
                    AgentMessageItem(content=response, model=thread.model),
                    thread_id=thread.thread_id,
                )
            error = payload.get("error")
            if error:
                store.append_item(
                    turn_id,
                    ErrorItem(message=str(error), code=str(payload.get("stopReason", "") or "LLM_ERROR")),
                    thread_id=thread.thread_id,
                )
            store.end_turn(turn_id, status="completed" if payload.get("success") else "failed")
            thread.current_turn_id = None
        except Exception as e:
            logger.warning("[engine] turn.end 持久化失败 %s: %s", thread.thread_id, e)

    def _persist_turn_error(self, thread: EngineThread, turn_id: str | None, exc: Exception) -> None:
        """prompt 异常:ErrorItem + failed Turn(降级,不遮蔽原异常)。"""
        if not turn_id:
            return
        store = self._persistence_store()
        if store is None:
            return
        try:
            from .session_store import ErrorItem

            store.append_item(
                turn_id, ErrorItem(message=str(exc), code="ENGINE_ERROR"), thread_id=thread.thread_id
            )
            store.end_turn(turn_id, status="failed", error=str(exc))
            thread.current_turn_id = None
        except Exception as e:
            logger.warning("[engine] turn.error 持久化失败 %s: %s", thread.thread_id, e)

    def _try_restore_thread(self, thread_id: str) -> EngineThread | None:
        """进程重启后按需从 SessionStore 恢复线程(历史消息 + 配置元数据)。

        运行时态(loop/checkpoint/pending/emit)本就属进程内,恢复为 idle 可续发 prompt。
        """
        store = self._persistence_store()
        if store is None:
            return None
        try:
            t = store.get_thread(thread_id)
            if t is None or t.archived:
                return None
            md = dict(t.metadata or {})
            from .session_store import LLMMessage

            messages: list[dict[str, Any]] = [
                {
                    "role": "system",
                    "content": str(md.get("systemPrompt") or "You are a helpful agent."),
                }
            ]
            for m in store.resume(thread_id):
                if isinstance(m, LLMMessage):
                    messages.append({"role": m.role, "content": m.content})
            thread = EngineThread(
                thread_id=thread_id,
                session_id=str(md.get("sessionId") or thread_id),
                model=md.get("model") if isinstance(md.get("model"), str) else None,
                permission_mode=str(md.get("permissionMode") or "default"),
                max_iterations=int(md.get("maxIterations") or 8),
                tool_names=list(md["toolNames"]) if isinstance(md.get("toolNames"), list) else None,
                workspace=md.get("workspace") if isinstance(md.get("workspace"), str) else None,
                user_id=md.get("userId") if isinstance(md.get("userId"), str) else None,
                conversation_id=md.get("conversationId")
                if isinstance(md.get("conversationId"), str)
                else None,
                messages=messages,
            )
            # 第二批配置面还原(失败降级为缺省,不影响对话续跑)
            if isinstance(md.get("modelParams"), dict):
                thread.model_params = dict(md["modelParams"])
            if isinstance(md.get("reasoning"), dict):
                thread.reasoning = dict(md["reasoning"])
            if isinstance(md.get("denyTools"), list):
                thread.deny_tools = [str(x) for x in md["denyTools"] if isinstance(x, str)]
            if isinstance(md.get("tokenBudget"), int) and md["tokenBudget"] > 0:
                thread.token_budget = int(md["tokenBudget"])
            if isinstance(md.get("goal"), str) and md["goal"].strip():
                thread.goal = md["goal"].strip()
            # 第四批配置还原(失败降级为缺省,不影响对话续跑)
            if isinstance(md.get("outputSchema"), dict):
                thread.output_schema = dict(md["outputSchema"])
            if md.get("autoCompact") is True:
                thread.auto_compact = True
            if (
                isinstance(md.get("autoCompactThreshold"), int)
                and md["autoCompactThreshold"] > 0
            ):
                thread.auto_compact_threshold = int(md["autoCompactThreshold"])
            if md.get("role") in _AGENT_ROLE_TEMPLATES:
                thread.role = str(md["role"])
            self._threads[thread_id] = thread
            logger.info(
                "[engine] thread restored from store %s (items=%s)", thread_id, t.item_count
            )
            return thread
        except Exception as e:
            logger.warning("[engine] thread restore 失败 %s: %s", thread_id, e)
            return None

    def _require_thread(self, params: dict[str, Any]) -> EngineThread:
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        thread = self._threads.get(thread_id)
        if thread is None:
            # 进程重启后内存无此线程 → 按需从 SessionStore 恢复(降级失败仍报不存在)
            thread = self._try_restore_thread(thread_id)
        if thread is None:
            raise JsonRpcError(THREAD_NOT_FOUND, f"线程不存在: {thread_id}")
        if thread.status == "closed":
            raise JsonRpcError(THREAD_CLOSED, f"线程已关闭: {thread_id}")
        return thread

    # ------------------------------------------------------------------
    # engine.*
    # ------------------------------------------------------------------

    async def _handle_initialize(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """能力握手:声明协议版本与全部能力(客户端据此决定可用方法集)。"""
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "capabilities": {
                "streaming": True,
                "interrupt": True,
                "pauseResume": True,
                "checkpoint": True,
                "hostTools": True,
                "approval": True,
                "planTool": True,
                "subagent": True,
                "viewImage": True,
                "manualCompaction": True,
                "export": True,
                "messageQueue": True,
                "goals": True,
                "review": True,
                "tokenBudget": True,
                "toolSearch": True,
                "elicitation": True,
                "unifiedExec": True,
                "outputSchema": True,
                "autoCompact": True,
                "agentRoles": True,
                "turnTiming": True,
                "applyPatch": True,
                "codeMode": True,
                "mcp": self._tool_lister is not None,
                "costLedger": self._cost_report is not None,
                "modelRouting": self._model_lister is not None,
                "decisionChain": True,
            },
            "methods": sorted(self._handlers),
            "notifications": ["thread/event", "tool/execute", "approval/request"],
            "differentiators": [
                "19 家 provider 模型路由(models.list)",
                "MCP 超级工具池(tools.list)",
                "成本账本 + prompt 缓存三段计价(cost.report)",
                "压缩时决策链保留(thread.state.compactionEvents)",
            ],
        }

    async def _handle_ping(self, params: dict[str, Any], emit: Emitter) -> dict[str, Any]:
        return {"pong": True, "time": time.time(), "threads": len(self._threads)}

    # ------------------------------------------------------------------
    # thread.*
    # ------------------------------------------------------------------

    async def _handle_thread_start(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        thread_id = f"thr_{uuid.uuid4().hex[:12]}"
        # 服务端 prompt 锁定(2026-09-18 立):锁定值存在时忽略客户端 systemPrompt
        # (多租户合规:防客户端覆盖安全提示),来源标注入持久化 metadata。
        if self._locked_system_prompt:
            system_prompt: str | None = self._locked_system_prompt
            system_source = "server-locked"
        elif isinstance(params.get("systemPrompt"), str) and params.get("systemPrompt"):
            system_prompt = str(params["systemPrompt"])
            system_source = "client"
        else:
            system_prompt = None
            system_source = "default"
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt or "You are a helpful agent."}
        ]
        tool_names = params.get("tools")
        approval_policies = _parse_policy_config(params)
        model_params, reasoning = _parse_generation_config(params)
        deny_tools = _parse_deny_tools(params)
        # token 预算(2026-09-18 第三批,对标 TokenBudget):正整数或省略
        token_budget = params.get("tokenBudget")
        if token_budget is not None:
            if isinstance(token_budget, bool) or not isinstance(token_budget, int) or token_budget <= 0:
                raise JsonRpcError(INVALID_PARAMS, "tokenBudget 须为正整数")
        goal = params.get("goal")
        if goal is not None and not (isinstance(goal, str) and goal.strip()):
            raise JsonRpcError(INVALID_PARAMS, "goal 须为非空字符串或 null")
        # 第四批(2026-09-18):outputSchema / autoCompact / role
        output_schema = _parse_output_schema(params.get("outputSchema"))
        auto_compact = bool(params.get("autoCompact"))
        try:
            auto_compact_threshold = int(
                params.get("autoCompactThreshold") or _AUTOCOMPACT_DEFAULT_THRESHOLD
            )
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "autoCompactThreshold 须为整数") from e
        if auto_compact_threshold <= 0:
            raise JsonRpcError(INVALID_PARAMS, "autoCompactThreshold 须为正整数")
        role = params.get("role")
        if role is not None and role not in _AGENT_ROLE_TEMPLATES:
            raise JsonRpcError(
                INVALID_PARAMS,
                f"role 须为内置角色之一: {sorted(_AGENT_ROLE_TEMPLATES)}",
            )
        # 角色模板追加进 system(对标 Codex agent-roles 全程可见语义)
        if role is not None:
            messages[0]["content"] = (
                f"{messages[0]['content']}\n\n[角色模板] {_AGENT_ROLE_TEMPLATES[role]}"
            )
        thread = EngineThread(
            thread_id=thread_id,
            session_id=str(params.get("sessionId") or thread_id),
            model=params.get("model") if isinstance(params.get("model"), str) else None,
            permission_mode=str(params.get("permissionMode") or "default"),
            max_iterations=int(params.get("maxIterations") or 8),
            tool_names=list(tool_names) if isinstance(tool_names, list) else None,
            workspace=params.get("workspace")
            if isinstance(params.get("workspace"), str)
            else None,
            user_id=params.get("userId") if isinstance(params.get("userId"), str) else None,
            conversation_id=params.get("conversationId")
            if isinstance(params.get("conversationId"), str)
            else None,
            approval_policies=approval_policies,
            model_params=model_params,
            reasoning=reasoning,
            deny_tools=deny_tools,
            token_budget=token_budget,
            goal=goal.strip() if isinstance(goal, str) else None,
            auto_compact=auto_compact,
            auto_compact_threshold=auto_compact_threshold,
            output_schema=output_schema,
            role=role,
            messages=messages,
        )
        self._threads[thread_id] = thread
        # Turn Context 冻结:首份快照(此后每轮 prompt 刷新,resume 用冻结副本)
        thread.frozen_context = self._freeze_context(thread)
        self._persist_thread_created(thread)
        logger.info("[engine] thread.start %s (model=%s)", thread_id, thread.model)
        return {
            "threadId": thread_id,
            "sessionId": thread.session_id,
            "model": thread.model,
            "permissionMode": thread.permission_mode,
            "maxIterations": thread.max_iterations,
            "approvalPolicies": thread.approval_policies,
            "modelParams": thread.model_params,
            "reasoning": thread.reasoning,
            "denyTools": thread.deny_tools,
            "tokenBudget": thread.token_budget,
            "goal": thread.goal,
            "outputSchema": thread.output_schema,
            "autoCompact": thread.auto_compact,
            "role": thread.role,
            "systemPromptSource": system_source,
            "status": thread.status,
        }

    def _freeze_context(self, thread: EngineThread) -> dict[str, Any]:
        """快照本轮生效配置(Turn Context 冻结,对标 Codex TurnContext)。"""
        return {
            "model": thread.model,
            "permission_mode": thread.permission_mode,
            "max_iterations": thread.max_iterations,
            "tool_names": list(thread.tool_names) if thread.tool_names else None,
            "workspace": thread.workspace,
            "approval_policies": dict(thread.approval_policies) or None,
            "model_params": dict(thread.model_params) or None,
            "reasoning": dict(thread.reasoning) or None,
            "deny_tools": list(thread.deny_tools) or None,
        }

    async def _handle_agent_exec(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """一次性非交互执行(2026-09-18 立,对标 Codex `codex exec` headless 模式)。

        params 与 thread.start/prompt 同构(input/model/permissionMode/tools/
        approvalPolicy/toolApprovalPolicies/policyToml/systemPrompt/...)。
        内部建临时线程执行单轮,返回结构化结果后线程出内存(跑完即弃);
        过程事件经 emit 正常流出;持久化记录保留(审计),后续 threadId 仍可恢复。
        """
        input_text = params.get("input")
        if input_text is None or (isinstance(input_text, str) and not input_text.strip()):
            raise JsonRpcError(INVALID_PARAMS, "agent.exec 需要非空 input")
        started = await self._handle_thread_start(params, emit)
        tid = started["threadId"]
        started_at = time.time()
        try:
            result = await self._handle_thread_prompt(params | {"threadId": tid}, emit)
        finally:
            # 跑完即弃(成功/异常都出内存;库中记录保留,按 threadId 仍可恢复续查)。
            # 清理对齐 _handle_thread_close:取消未决 future(此线程无 in-flight loop)。
            thread = self._threads.pop(tid, None)
            if thread is not None:
                for future in thread.pending.values():
                    if not future.done():
                        future.cancel()
                thread.pending.clear()
                thread.status = "closed"
                thread.touch()
        return {
            **result,
            "threadId": tid,
            "headless": True,
            "execDurationMs": round((time.time() - started_at) * 1000, 2),
        }

    async def _handle_thread_prompt(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """执行一轮:过程事件经 thread/event 通知回传,结束时返回结构化结果。

        2026-09-18 第三批(Steer/ThreadQueueChanged 对标):本轮结束后若队列
        非空则依序自动续跑(单次 prompt 最多消化 5 条,防失控);轮中入队的
        消息由 thread.enqueue 接住。
        """
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        text = _coerce_input_text(params.get("input"))
        result = await self._run_prompt_turn(thread, text, emit)
        drained = 0
        while (
            thread.queue
            and result.get("success")
            and drained < _MAX_QUEUE_DRAIN_PER_PROMPT
        ):
            nxt = thread.queue.pop(0)
            drained += 1
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    emit,
                    "thread.queue",
                    {"queued": len(thread.queue), "action": "drained"},
                )
            result = await self._run_prompt_turn(
                thread, str(nxt.get("input") or ""), emit
            )
        return result

    async def _run_prompt_turn(
        self, thread: EngineThread, text: str, emit: Emitter
    ) -> dict[str, Any]:
        """单轮执行(预算硬停 → 环境快照 → 跑 → 用量累计 → turn.diff)。"""
        # token 预算硬停(2026-09-18 第三批,对标 TokenBudget/RolloutBudget):
        # 跨回合累计用量达到预算即拒起新轮(进行中的轮不打断,由循环层 budget 治理)。
        if thread.token_budget is not None and thread.session_tokens_used >= thread.token_budget:
            raise JsonRpcError(
                BUDGET_EXHAUSTED,
                f"token 预算已耗尽(已用 {thread.session_tokens_used} / 预算 {thread.token_budget})",
            )
        # Turn Timing(2026-09-18 第四批,对标 Codex turn_timing)
        turn_started_at = time.time()
        thread.last_turn_timing = {"startedAt": turn_started_at}
        before_files = await self._workspace_dirty_files(thread)
        thread.messages.append({"role": "user", "content": text})
        # Turn Context 冻结:非 checkpoint 路径每轮刷新快照(客户端在轮间改配置,
        # 新一轮用新值;轮内 interrupt→resume 走 _handle_thread_resume 的冻结副本)
        thread.frozen_context = self._freeze_context(thread)
        # 环境快照事件(2026-09-18 第二批,对标 Codex EnvironmentSnapshot/环境上下文):
        # 客户端每轮可感知 cwd/workspace/生成参数,排查"模型看到了什么环境"不再靠猜。
        with contextlib.suppress(Exception):
            await emit(
                {
                    "jsonrpc": "2.0",
                    "method": "thread/event",
                    "params": {
                        "threadId": thread.thread_id,
                        "event": "environment_context",
                        "payload": {
                            "session_id": thread.session_id,
                            "cwd": os.getcwd(),
                            "workspace": thread.workspace,
                            "model": thread.model,
                            "modelParams": thread.frozen_context.get("model_params"),
                            "timestamp": time.time(),
                        },
                    },
                }
            )
        turn_id = self._persist_turn_start(thread, text)
        try:
            result = await self._run_thread(thread, emit)
        except Exception as e:
            self._persist_turn_error(thread, turn_id, e)
            raise
        self._persist_turn_end(thread, turn_id, result)
        # Turn Timing 补完(endedAt + durationMs;随返回体 turnTiming 下发)
        turn_ended_at = time.time()
        thread.last_turn_timing = {
            "startedAt": turn_started_at,
            "endedAt": turn_ended_at,
            "durationMs": round((turn_ended_at - turn_started_at) * 1000, 2),
        }
        # payload 在 _run_thread 内构建(那时只有 startedAt),此处回填完整计时
        if isinstance(result, dict):
            result["turnTiming"] = thread.last_turn_timing
        # 跨回合 token 用量累计(预算硬停的数据源;取不到精确值时为 0,不阻塞)
        thread.session_tokens_used += int(
            (result or {}).get("totalTokensUsed") or 0
        )
        # TurnDiff(2026-09-18 第三批,对标 Codex TurnDiff):本回合相对回合前
        # 新增变脏的工作区文件(git 工作区才有;非 git/无变化静默)。
        with contextlib.suppress(Exception):
            after_files = await self._workspace_dirty_files(thread)
            changed = sorted(after_files - before_files)
            if changed:
                await self._emit_engine_event(
                    thread,
                    emit,
                    "turn.diff",
                    {"files": changed[:50], "truncated": len(changed) > 50},
                )
        # auto-compact(2026-09-18 第四批,对标 Codex compact_token_budget
        # inline auto-compaction):估算 token 超阈值即确定性压缩,零 LLM 成本。
        if thread.auto_compact:
            with contextlib.suppress(Exception):
                from app.core.context_compaction import estimate_messages_tokens

                if (
                    estimate_messages_tokens(thread.messages)
                    >= thread.auto_compact_threshold
                ):
                    await self._compact_thread(
                        thread, keep_recent=8, emit=emit, trigger="auto"
                    )
        # outputSchema 结构化终答校验(2026-09-18 第四批,对标 Codex output_schema):
        # fail-open 观测语义——校验结果随返回体下发,违例另发事件,不硬拒答。
        if thread.output_schema is not None and isinstance(result, dict):
            validation = _validate_output_schema_payload(
                thread.output_schema, str(result.get("finalResponse") or "")
            )
            result["outputSchemaValidation"] = validation
            if not validation["valid"]:
                with contextlib.suppress(Exception):
                    await self._emit_engine_event(
                        thread, emit, "output_schema.violation", validation
                    )
        return result

    @staticmethod
    async def _workspace_dirty_files(thread: EngineThread) -> set[str]:
        """工作区 git 脏文件集合(非 git 目录/超时/任何失败 → 空集,静默降级)。"""
        if not thread.workspace:
            return set()
        try:
            proc = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                thread.workspace,
                "status",
                "--porcelain",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        except Exception:
            return set()
        if proc.returncode != 0:
            return set()
        files: set[str] = set()
        for line in out.decode("utf-8", errors="replace").splitlines():
            if len(line) > 3:
                files.add(line[3:].strip().strip('"'))
        return files

    async def _run_thread(
        self, thread: EngineThread, emit: Emitter, *, from_checkpoint: str | None = None
    ) -> dict[str, Any]:
        """构造主循环 → 跑一轮 → 归一结果(承接 prompt / resume 两条入口)。"""
        thread.status = "running"
        thread.emit = emit
        thread.touch()
        host_tools = self._build_host_tool_definitions(thread)
        # 引擎内置工具(update_plan/spawn_subagent/view_image,2026-09-18 第二批,
        # 对标 Codex plan/collab/view_image 工具面):宿主同名工具显式覆盖。
        host_tools = host_tools + self._builtin_tool_definitions(thread)
        # 先同步订阅再开跑:主循环可能在首个 await 之前就发事件(如 session.start),
        # 若订阅晚于执行,这些事件会永久丢失(队列尚不存在,放不进去)。
        queues = self._subscribe_events()
        forwarder = asyncio.ensure_future(self._forward_events(thread, emit, queues))
        started = time.perf_counter()
        try:
            loop = await self._loop_factory(_spec(thread), host_tools)
            thread.loop = loop
            if from_checkpoint:
                result = await loop.resume_from_checkpoint(from_checkpoint)
            else:
                # 传消息副本:主循环会就地改写 system 做记忆/画像/团队接力注入,
                # 副本隔离保证线程历史不被注入内容污染、跨轮不累积膨胀。
                working = [dict(m) for m in thread.messages]
                result = await loop.run(working)
                self._absorb_messages(thread, working)
            thread.checkpoint_id = getattr(result, "checkpoint_id", None)
            payload = self._result_payload(thread, result)
            thread.last_result = payload
            thread.prompts += 1
            # turn.usage 事件(2026-09-18 第二批,对标 Codex TokenCount):
            # 回合级用量经通知流出,客户端无需解析循环内部结构。
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread, emit, "turn.usage", dict(payload.get("usage") or {})
                )
            return payload
        finally:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
            # 结束前补扫事件队列(见 _drain_events):防尾部事件被转发任务取消吞掉
            with contextlib.suppress(Exception):
                await self._drain_events(thread, emit, queues)
            thread.status = "idle"
            thread.loop = None
            thread.emit = None
            thread.touch()
            forwarder.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await forwarder
            logger.info(
                "[engine] thread.prompt %s 完成 status=%s duration=%sms",
                thread.thread_id,
                thread.status,
                elapsed_ms,
            )

    def _absorb_messages(
        self, thread: EngineThread, working: list[dict[str, Any]]
    ) -> None:
        """把本轮真实对话消息回写线程历史(丢弃注入型 system,只留 user/assistant/tool)。

        注入型 system(记忆/画像/meta 教训/团队接力)每轮重新生成,若一并回写会
        跨轮累积成上下文膨胀;线程自有的首条 system 以引擎侧副本为准。
        """
        head = thread.messages[0] if thread.messages else {
            "role": "system",
            "content": "You are a helpful agent.",
        }
        canonical_system = {"role": "system", "content": head.get("content", "")}
        kept: list[dict[str, Any]] = []
        for msg in working:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role")
            if role in ("user", "assistant", "tool"):
                kept.append(msg)
        thread.messages = [canonical_system, *kept]

    def _result_payload(self, thread: EngineThread, result: Any) -> dict[str, Any]:
        """归一 AgentLoopResult → JSON-RPC 结果(字段稳定,客户端可直接消费)。"""
        iterations = getattr(result, "iterations", []) or []
        compaction = getattr(result, "compaction_events", []) or []
        return {
            "threadId": thread.thread_id,
            "success": bool(getattr(result, "success", False)),
            "stopReason": str(getattr(result, "stop_reason", "")),
            "finalResponse": str(getattr(result, "final_response", "") or ""),
            "iterations": len(iterations),
            "totalDurationMs": round(
                float(getattr(result, "total_duration_ms", 0.0) or 0.0), 2
            ),
            "totalTokensUsed": int(getattr(result, "total_tokens_used", 0) or 0),
            "usage": self._turn_usage(result),
            "checkpointId": getattr(result, "checkpoint_id", None),
            "error": getattr(result, "error", None),
            "budget": getattr(result, "budget", None),
            "compactionEvents": compaction,
            "turnTiming": thread.last_turn_timing,
        }

    @staticmethod
    def _turn_usage(result: Any) -> dict[str, Any]:
        """回合 token 用量(2026-09-18 第二批,对标 Codex TokenCount 事件)。

        总量取自 AgentLoopResult.total_tokens_used;逐迭代分项(有精确 usage 时)
        尽力透出,无则只回总量+迭代数(不伪造分项)。
        """
        iterations = getattr(result, "iterations", []) or []
        per_iteration: list[dict[str, Any]] = []
        for it in iterations:
            usage = getattr(it, "usage", None)
            if isinstance(usage, dict) and usage:
                per_iteration.append(
                    {
                        k: usage[k]
                        for k in (
                            "input_tokens",
                            "output_tokens",
                            "cached_tokens",
                            "total_tokens",
                        )
                        if k in usage
                    }
                )
        out: dict[str, Any] = {
            "totalTokens": int(getattr(result, "total_tokens_used", 0) or 0),
            "iterations": len(iterations),
        }
        if per_iteration:
            out["perIteration"] = per_iteration
        return out

    async def _handle_thread_interrupt(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """中断在跑的轮次:cancel=取消 / pause=暂停并落 checkpoint。

        P0-B 起主循环在 LLM 调用与工具执行期间也响应标志(0.25s 粒度),
        因此长调用期间的中断同样即时生效。
        """
        thread = self._require_thread(params)
        mode = str(params.get("mode") or "cancel")
        if mode not in ("cancel", "pause"):
            raise JsonRpcError(INVALID_PARAMS, "mode 须为 cancel 或 pause")
        loop = thread.loop
        if loop is None or thread.status != "running":
            return {
                "threadId": thread.thread_id,
                "interrupted": False,
                "mode": mode,
                "status": thread.status,
                "reason": "no_active_run",
            }
        checkpoint_id = (
            await loop.cancel() if mode == "cancel" else await loop.pause()
        )
        thread.checkpoint_id = checkpoint_id or thread.checkpoint_id
        return {
            "threadId": thread.thread_id,
            "interrupted": True,
            "mode": mode,
            "status": thread.status,
            "checkpointId": thread.checkpoint_id,
        }

    async def _handle_thread_resume(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        checkpoint_id = params.get("checkpointId") or thread.checkpoint_id
        if not isinstance(checkpoint_id, str) or not checkpoint_id:
            raise JsonRpcError(
                INVALID_PARAMS, "缺少 checkpointId(且线程无最近 checkpoint)"
            )
        # Turn Context 冻结(2026-09-18 立):checkpoint 续跑强制用冻结副本——
        # interrupt 之后客户端改配置(model/permissionMode/tools)不生效,防串台;
        # 无冻结快照(老线程/恢复线程)则按当前配置,行为与旧版一致。
        if thread.frozen_context:
            ctx = thread.frozen_context
            thread.model = ctx.get("model", thread.model)
            thread.permission_mode = ctx.get("permission_mode", thread.permission_mode)
            thread.max_iterations = int(ctx.get("max_iterations") or thread.max_iterations)
            thread.tool_names = ctx.get("tool_names", thread.tool_names)
            thread.workspace = ctx.get("workspace", thread.workspace)
            thread.approval_policies = dict(ctx.get("approval_policies") or {})
            # 第二批配置面同样冻结还原(生成参数/推理配置/负向过滤)
            thread.model_params = dict(ctx.get("model_params") or {})
            thread.reasoning = dict(ctx.get("reasoning") or {})
            thread.deny_tools = list(ctx.get("deny_tools") or [])
        try:
            return await self._run_thread(thread, emit, from_checkpoint=checkpoint_id)
        except ValueError as e:
            raise JsonRpcError(THREAD_NOT_FOUND, f"checkpoint 不存在或已过期: {e}") from e

    async def _handle_thread_state(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        thread = self._require_thread(params)
        return {
            "threadId": thread.thread_id,
            "sessionId": thread.session_id,
            "status": thread.status,
            "model": thread.model,
            "permissionMode": thread.permission_mode,
            "maxIterations": thread.max_iterations,
            "messages": len(thread.messages),
            "prompts": thread.prompts,
            "checkpointId": thread.checkpoint_id,
            "hostTools": sorted(thread.host_tools),
            "lastResult": thread.last_result,
            # 2026-09-18 第三批:队列/目标/预算可观测
            "queued": len(thread.queue),
            "goal": thread.goal,
            "tokenBudget": thread.token_budget,
            "sessionTokensUsed": thread.session_tokens_used,
            "autoCompact": thread.auto_compact,
            "role": thread.role,
            "lastShellCwd": thread.last_shell_cwd,
            "turnTiming": thread.last_turn_timing,
            "execSessions": len(self._exec_sessions),
            "cost": self._thread_cost(thread),
        }

    async def _handle_thread_close(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        thread = self._require_thread(params)
        if thread.status == "running":
            loop = thread.loop
            if loop is not None:
                with contextlib.suppress(Exception):
                    await loop.cancel()
        for future in thread.pending.values():
            if not future.done():
                future.cancel()
        thread.pending.clear()
        thread.status = "closed"
        thread.touch()
        return {"threadId": thread.thread_id, "status": thread.status, "closed": True}

    # ------------------------------------------------------------------
    # tools.*
    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # thread.compact / thread.export / thread.plan(2026-09-18 第二批)
    # ------------------------------------------------------------------

    async def _handle_thread_compact(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """手动压缩线程历史(2026-09-18 第二批,对标 Codex /compact + ContextCompacted)。

        复用主循环同款确定性压缩(core/context_compaction,零 LLM 额外成本);
        对话过短则原样返回 compressed=False。
        """
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        try:
            keep_recent = int(params.get("keepRecent") or 8)
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "keepRecent 须为整数") from e
        keep_recent = max(2, min(keep_recent, 50))
        return await self._compact_thread(
            thread, keep_recent=keep_recent, emit=emit, trigger="manual"
        )

    async def _compact_thread(
        self,
        thread: EngineThread,
        keep_recent: int,
        emit: Emitter,
        trigger: str,
    ) -> dict[str, Any]:
        """确定性压缩核心(manual/auto 共用,对标 Codex CompactionTrigger 语义)。"""
        messages = thread.messages
        before = len(messages)
        from app.core.context_compaction import (
            compress_messages_if_needed,
            estimate_messages_tokens,
        )

        # 以压缩器自身的 token 估算值为 limit → 占用率恒 1.0,必过触发线(强制压缩)
        est_tokens = max(1, estimate_messages_tokens(messages))
        compressed, info = compress_messages_if_needed(
            messages,
            est_tokens,
            trigger_ratio=0.85,
            target_ratio=0.6,
            keep_recent=keep_recent,
        )
        result: dict[str, Any] = {
            "threadId": thread.thread_id,
            "compressed": bool(info.get("compressed")),
            "beforeMessages": before,
            "afterMessages": len(compressed),
            "originalTokens": info.get("original_tokens"),
            "compressedTokens": info.get("compressed_tokens"),
            "removedCount": info.get("removed_count"),
            "trigger": trigger,
        }
        if info.get("compressed"):
            thread.messages = list(compressed)
            thread.touch()
            self._persist_compaction_boundary(thread, info)
            await self._emit_engine_event(
                thread,
                emit,
                "context.compacted",
                {
                    "compressed": True,
                    "beforeMessages": before,
                    "afterMessages": len(compressed),
                    "removedCount": info.get("removed_count"),
                    "trigger": trigger,
                },
            )
        return result

    def _persist_compaction_boundary(self, thread: EngineThread, info: dict[str, Any]) -> None:
        """压缩边界落库(resume 回放语义对齐循环内压缩;失败降级不影响内存态)。"""
        store = self._persistence_store()
        if store is None:
            return
        try:
            from .session_store import CompactionBoundaryItem

            store.compact(
                thread.thread_id,
                CompactionBoundaryItem(
                    summary=str(info.get("summary") or "manual compact via thread.compact"),
                    tokens_before=int(info.get("original_tokens") or 0),
                    tokens_after=int(info.get("compressed_tokens") or 0),
                ),
            )
        except Exception as e:
            logger.warning("[engine] 压缩边界落库失败 %s: %s", thread.thread_id, e)

    async def _handle_thread_export(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """导出线程为 JSONL(2026-09-18 第二批,对标 Codex rollout 导出)。

        优先 SessionStore items(pydantic 全量 dump,含 seq/时间戳/类型),
        无库或为空时回退线程内存消息;path 给出时落盘(utf-8),始终返回 lines
        便于传输层直接消费。
        """
        thread = self._require_thread(params)
        lines: list[str] = []
        store = self._persistence_store()
        if store is not None:
            try:
                for item in store.list_items(thread.thread_id):
                    lines.append(
                        json.dumps(item.model_dump(mode="json"), ensure_ascii=False)
                    )
            except Exception as e:
                logger.warning("[engine] thread.export 库导出失败(回退内存消息): %s", e)
                lines = []
        if not lines:
            for m in thread.messages:
                lines.append(
                    json.dumps({"type": "message", **m}, ensure_ascii=False, default=str)
                )
        path = params.get("path")
        written: str | None = None
        if isinstance(path, str) and path.strip():
            target = Path(path.strip())
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("\n".join(lines) + "\n", encoding="utf-8")
            written = str(target)
        return {
            "threadId": thread.thread_id,
            "format": "jsonl",
            "count": len(lines),
            "path": written,
            "lines": lines,
        }

    async def _handle_thread_plan(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """读取线程当前计划(update_plan 内置工具写入;对标 Codex PlanUpdate 查询面)。"""
        thread = self._require_thread(params)
        return {"threadId": thread.thread_id, "plan": thread.plan}

    async def _handle_thread_enqueue(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """消息入队(2026-09-18 第三批,对标 Codex Steer/ThreadQueueChanged)。

        轮中入队:本轮结束后自动依序续跑;空闲入队:立即返回,下次 prompt 前的
        续跑同样消化。与直接 thread.prompt 的区别是绝不与在跑轮次并发冲突。
        """
        thread = self._require_thread(params)
        text = _coerce_input_text(params.get("input"))
        thread.queue.append({"input": text, "enqueuedAt": time.time()})
        thread.touch()
        await self._emit_engine_event(
            thread,
            emit,
            "thread.queue",
            {"queued": len(thread.queue), "action": "enqueued"},
        )
        return {
            "threadId": thread.thread_id,
            "queued": len(thread.queue),
            "mode": "steer" if thread.status == "running" else "idle",
        }

    async def _handle_thread_goal(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """设置/清除线程持久目标(2026-09-18 第三批,对标 Codex Goals)。

        goal 非空 → 设置并经 system 注入后续每轮;goal=null → 清除。
        发 thread.goal 事件(ThreadGoalUpdated 对标)。
        """
        thread = self._require_thread(params)
        goal = params.get("goal")
        if goal is not None and not (isinstance(goal, str) and goal.strip()):
            raise JsonRpcError(INVALID_PARAMS, "goal 须为非空字符串或 null(清除)")
        thread.goal = goal.strip() if isinstance(goal, str) else None
        thread.touch()
        await self._emit_engine_event(
            thread, emit, "thread.goal", {"goal": thread.goal}
        )
        return {"threadId": thread.thread_id, "goal": thread.goal}

    async def _handle_thread_review(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """审查模式(2026-09-18 第三批,对标 Codex review / Guardian)。

        派生一次性审查子代理,携带线程近期对话记录(+可选 focus)输出结构化
        审查结论;审查线程跑完即弃(store 留痕)。
        """
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        focus = params.get("focus")
        if focus is not None and not (isinstance(focus, str) and focus.strip()):
            raise JsonRpcError(INVALID_PARAMS, "focus 须为非空字符串")
        transcript = [
            m
            for m in thread.messages
            if isinstance(m, dict) and m.get("role") in ("user", "assistant", "tool")
        ][-40:]
        prompt = (
            "你是严格的任务审查者。审查以下线程对话记录,输出结构化结论:\n"
            "1) verdict: approve / revise\n"
            "2) findings: 问题列表(每条含 severity: blocker/major/minor 与说明)\n"
            "3) suggestions: 改进建议\n"
            + (f"审查重点: {str(focus).strip()}\n" if focus else "")
            + "\n对话记录(JSONL,最后 40 条):\n"
            + "\n".join(
                json.dumps(m, ensure_ascii=False, default=str) for m in transcript
            )
        )
        sub_params: dict[str, Any] = {
            "input": prompt,
            "permissionMode": thread.permission_mode,
            "maxIterations": 2,
        }
        if thread.model:
            sub_params["model"] = thread.model
        started = await self._handle_thread_start(sub_params, _noop_emitter)
        sub = self._threads.get(started["threadId"])
        if sub is not None:
            sub.depth = thread.depth + 1
        try:
            result = await self._handle_thread_prompt(
                {**sub_params, "threadId": started["threadId"]}, _noop_emitter
            )
        finally:
            with contextlib.suppress(Exception):
                obj = self._threads.pop(started["threadId"], None)
                if obj is not None:
                    obj.status = "closed"
        return {
            "reviewThreadId": started["threadId"],
            "verdict": result.get("finalResponse"),
            "success": result.get("success"),
            "usage": result.get("usage"),
        }

    async def _emit_engine_event(
        self,
        thread: EngineThread,
        emit: Emitter | None,
        event: str,
        payload: dict[str, Any],
    ) -> None:
        """引擎侧事件的统一出站格式(与 _drain_events 的 thread/event 封装一致)。

        引擎自产事件(environment_context / turn.usage / plan.update /
        context.compacted)不经 hook 总线,直接走承载层通知,格式与循环事件
        完全同构,客户端一套解析逻辑即可。
        """
        await (emit or _noop_emitter)(
            {
                "jsonrpc": "2.0",
                "method": "thread/event",
                "params": {
                    "threadId": thread.thread_id,
                    "event": event,
                    "payload": {"session_id": thread.session_id, **payload},
                },
            }
        )

    # ------------------------------------------------------------------
    # 引擎内置工具(2026-09-18 第二批,对标 Codex plan/collab/view_image 工具面)
    # ------------------------------------------------------------------

    def _builtin_tool_definitions(self, thread: EngineThread) -> list[Any]:
        """构造引擎内置工具定义(宿主同名覆盖 / denyTools / tools 白名单生效)。"""
        from .agent_loop_v2 import ToolDefinition

        whitelist = thread.tool_names
        host_names = set(thread.host_tools)
        builders = {
            "update_plan": self._update_plan_tool,
            "spawn_subagent": self._spawn_subagent_tool,
            "view_image": self._view_image_tool,
            "request_permissions": self._request_permissions_tool,
            "unified_exec": self._unified_exec_tool,
            "request_user_input": self._request_user_input_tool,
            "apply_patch": self._apply_patch_tool,
            "run_code": self._run_code_tool,
        }
        definitions: list[Any] = []
        for name in BUILTIN_ENGINE_TOOLS:
            if name in host_names or name in thread.deny_tools:
                continue
            if whitelist is not None and name not in whitelist:
                continue
            definitions.append(builders[name](thread))
        return definitions

    def _update_plan_tool(self, thread: EngineThread) -> Any:
        """update_plan:模型可见执行计划(对标 Codex plan tool / PlanUpdate 事件)。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "plan": {
                    "type": "array",
                    "description": "完整计划步骤列表(全量覆盖写入)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "step": {"type": "string"},
                            "status": {
                                "type": "string",
                                "enum": list(_VALID_PLAN_STATUSES),
                            },
                        },
                        "required": ["step"],
                    },
                },
                "explanation": {"type": "string", "description": "一句话说明计划变更原因"},
            },
            "required": ["plan"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            plan_raw = args.get("plan")
            if not isinstance(plan_raw, list) or not plan_raw:
                raise JsonRpcError(INVALID_PARAMS, "update_plan 需要 plan 数组")
            plan: list[dict[str, Any]] = []
            for idx, item in enumerate(plan_raw):
                if not isinstance(item, dict) or not str(item.get("step") or "").strip():
                    raise JsonRpcError(INVALID_PARAMS, f"plan[{idx}] 须为含 step 的对象")
                status = str(item.get("status") or "pending")
                if status not in _VALID_PLAN_STATUSES:
                    raise JsonRpcError(
                        INVALID_PARAMS, f"plan[{idx}].status 非法: {status!r}"
                    )
                plan.append({"step": str(item["step"]).strip(), "status": status})
            thread.plan = plan
            thread.touch()
            await self._emit_engine_event(
                thread,
                thread.emit,
                "plan.update",
                {"plan": plan, "explanation": args.get("explanation")},
            )
            return {"plan": plan, "saved": True}

        return ToolDefinition(
            name="update_plan",
            description=(
                "维护当前任务的可见执行计划:开始多步任务前先列出全部步骤,"
                "推进时更新对应步骤状态(pending/in_progress/completed)。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _spawn_subagent_tool(self, thread: EngineThread) -> Any:
        """spawn_subagent:派生一次性子代理(对标 Codex collab 多代理工具面)。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "子代理要独立完成的任务"},
                "model": {"type": "string", "description": "可选,子代理模型(默认继承)"},
                "role": {
                    "type": "string",
                    "description": f"可选,子代理角色模板({sorted(_AGENT_ROLE_TEMPLATES)}),模板指令注入 system",
                    "enum": sorted(_AGENT_ROLE_TEMPLATES),
                },
                "maxIterations": {
                    "type": "integer",
                    "description": "可选,子代理最大迭代(默认 6,上限 12)",
                },
            },
            "required": ["prompt"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            prompt = args.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                return {"error": "spawn_subagent 需要非空 prompt"}
            if thread.depth >= _MAX_SUBAGENT_DEPTH:
                return {
                    "error": f"子代理嵌套深度已达上限({_MAX_SUBAGENT_DEPTH}),拒绝继续派生"
                }
            role = args.get("role")
            if role is not None and role not in _AGENT_ROLE_TEMPLATES:
                return {
                    "error": f"role 非法: {role!r},须为 {sorted(_AGENT_ROLE_TEMPLATES)} 之一"
                }
            sub_params: dict[str, Any] = {
                "input": prompt.strip(),
                "permissionMode": thread.permission_mode,
                "maxIterations": max(1, min(int(args.get("maxIterations") or 6), 12)),
            }
            if role is not None:
                sub_params["role"] = role
            model = args.get("model")
            if isinstance(model, str) and model.strip():
                sub_params["model"] = model.strip()
            elif thread.model:
                sub_params["model"] = thread.model
            # 一次性子线程:headless 语义跑完即弃内存(store 留痕);事件经 noop
            # 发射器静默,不污染父线程事件流,结果结构化回传。
            started = await self._handle_thread_start(sub_params, _noop_emitter)
            sub_thread = self._threads.get(started["threadId"])
            if sub_thread is not None:
                sub_thread.depth = thread.depth + 1
            result = await self._handle_thread_prompt(
                {**sub_params, "threadId": started["threadId"]}, _noop_emitter
            )
            with contextlib.suppress(Exception):
                thread_obj = self._threads.pop(started["threadId"], None)
                if thread_obj is not None:
                    thread_obj.status = "closed"
            return {
                "threadId": started["threadId"],
                "role": role,
                "success": result.get("success"),
                "response": result.get("finalResponse"),
                "iterations": result.get("iterations"),
                "usage": result.get("usage"),
            }

        return ToolDefinition(
            name="spawn_subagent",
            description=(
                "派生一个一次性子代理独立完成任务并返回其最终答复"
                "(适合需要隔离上下文的子任务);可用 role 指定内置角色模板"
                "(implementer/reviewer/researcher/tester/planner);嵌套深度有上限。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _view_image_tool(self, thread: EngineThread) -> Any:
        """view_image:工作区内图片读取(对标 Codex view_image;越界路径拒绝)。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "图片路径(相对工作区或绝对路径,须落在工作区内)",
                },
            },
            "required": ["path"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            raw = args.get("path")
            if not isinstance(raw, str) or not raw.strip():
                return {"error": "view_image 需要非空 path"}
            base = Path(thread.workspace).resolve() if thread.workspace else Path.cwd().resolve()
            target = Path(raw)
            if not target.is_absolute():
                target = base / target
            try:
                target = target.resolve()
                target.relative_to(base)
            except (OSError, ValueError):
                return {"error": "path 越出工作区,拒绝读取"}
            if not target.is_file():
                return {"error": f"文件不存在: {raw}"}
            mime = _IMAGE_MIME_TYPES.get(target.suffix.lower())
            if mime is None:
                return {"error": f"不支持的图片类型: {target.suffix or '(无后缀)'}"}
            size = target.stat().st_size
            if size > _MAX_VIEW_IMAGE_BYTES:
                return {"error": f"图片超过大小上限({_MAX_VIEW_IMAGE_BYTES} 字节)"}
            try:
                data = base64.b64encode(target.read_bytes()).decode("ascii")
            except OSError as e:
                return {"error": f"图片读取失败: {e}"}
            return {
                "path": str(target),
                "mimeType": mime,
                "sizeBytes": size,
                "dataUrl": f"data:{mime};base64,{data}",
                "note": "图像经 dataUrl 内嵌返回;纯文本 LLM 通道下模型不可直接看见,客户端可据此渲染",
            }

        return ToolDefinition(
            name="view_image",
            description=(
                "读取工作区内的图片文件,返回 base64 dataUrl 供客户端渲染"
                "(png/jpg/jpeg/gif/webp/bmp);越出工作区的路径会被拒绝。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _apply_patch_tool(self, thread: EngineThread) -> Any:
        """apply_patch:unified diff 结构化补丁(2026-09-18 第五批,对标 Codex
        apply-patch/V4A):多文件原子应用,任一 hunk 失配整包拒绝。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "patch": {
                    "type": "string",
                    "description": "标准 unified diff 文本(git diff 格式:--- / +++ / @@);"
                    "支持新增文件(--- /dev/null)、删除文件(+++ /dev/null)、多 hunk 更新",
                },
            },
            "required": ["patch"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            patch_text = args.get("patch")
            if not isinstance(patch_text, str) or not patch_text.strip():
                return {"error": "apply_patch 需要非空 patch(unified diff 文本)"}
            base = (
                Path(thread.workspace).resolve()
                if thread.workspace
                else Path.cwd().resolve()
            )
            try:
                sections = _parse_unified_patch(patch_text)
            except ValueError as e:
                return {"error": str(e)}
            # 第一遍:纯内存计算全部目标内容(原子性:任何失败即整包拒绝)
            plan: list[tuple[str, str, str | None]] = []  # (rel, action, new_content|None)
            for section in sections:
                old_rel = _strip_diff_prefix(section["old_path"])
                new_rel = _strip_diff_prefix(section["new_path"])
                target_rel = new_rel if new_rel != "/dev/null" else old_rel
                if target_rel == "/dev/null" or not target_rel:
                    return {"error": f"补丁段路径非法: {section['old_path']} → {section['new_path']}"}
                target = (base / target_rel).resolve()
                try:
                    target.relative_to(base)
                except (OSError, ValueError):
                    return {"error": f"路径越出工作区,拒绝应用: {target_rel}"}
                created = section["old_path"].strip() == "/dev/null"
                deleted = section["new_path"].strip() == "/dev/null"
                if created:
                    new_content = "\n".join(
                        text for tag, text in section["hunks"][0]["lines"] if tag == "+"
                    )
                    if target.exists():
                        return {"error": f"新增文件已存在: {target_rel}"}
                    plan.append((target_rel, "created", new_content))
                    continue
                if not target.is_file():
                    return {"error": f"目标文件不存在: {target_rel}"}
                try:
                    content = target.read_text(encoding="utf-8")
                except OSError as e:
                    return {"error": f"文件读取失败 {target_rel}: {e}"}
                if deleted:
                    plan.append((target_rel, "deleted", None))
                    continue
                try:
                    new_content = _apply_hunks_to_content(
                        content, section["hunks"], target_rel
                    )
                except ValueError as e:
                    return {"error": str(e)}
                plan.append((target_rel, "updated", new_content))
            # 第二遍:全部通过后才落盘
            results: list[dict[str, Any]] = []
            for rel, action, target_content in plan:
                target = (base / rel).resolve()
                try:
                    if action == "deleted":
                        target.unlink()
                    else:
                        assert target_content is not None
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_text(target_content, encoding="utf-8")
                except OSError as e:
                    return {"error": f"落盘失败 {rel}({action}): {e}", "applied": False}
                results.append({"path": rel, "action": action})
            thread.touch()
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "patch.applied",
                    {"files": [r["path"] for r in results], "count": len(results)},
                )
            return {"applied": True, "files": results, "count": len(results)}

        return ToolDefinition(
            name="apply_patch",
            description=(
                "将标准 unified diff(git diff 格式)原子应用到工作区:支持新增/更新/"
                "删除文件与多 hunk;任一上下文失配整包拒绝并给出失败定位,"
                "绝不产生半应用状态。适合精确的结构化代码修改。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _prune_code_sessions(self) -> None:
        now = time.time()
        for sid in list(self._code_sessions):
            session = self._code_sessions[sid]
            if (
                session["proc"].returncode is not None
                and now - session["last_active"] > _CODE_SESSION_TTL
            ):
                self._code_sessions.pop(sid, None)

    async def _invoke_tool_by_name(
        self, thread: EngineThread, name: str, args: dict[str, Any]
    ) -> Any:
        """run_code 桥接的工具解析:宿主工具(含覆盖)+ 引擎内置,统一执行。"""
        for definition in self._build_host_tool_definitions(thread):
            if getattr(definition, "name", "") == name:
                return await definition.executor(args)
        for definition in self._builtin_tool_definitions(thread):
            if getattr(definition, "name", "") == name:
                return await definition.executor(args)
        raise LookupError(f"工具未注册或已禁用: {name}")

    def _run_code_tool(self, thread: EngineThread) -> Any:
        """run_code:code-mode 常驻代码会话(2026-09-18 第六批,对标 Codex
        code-mode/V8 cell):模型写 Python 代码,tools.call(name,args) 桥接
        引擎工具,全局状态跨调用持久;进程隔离 + 超时击杀 + 输出有界。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "要执行的 Python 代码(一个 cell);"
                    "调用引擎工具用 tools.call(工具名, 参数dict)",
                },
                "sessionId": {
                    "type": "string",
                    "description": "可选,续用已有代码会话(全局状态跨调用持久)",
                },
                "reset": {
                    "type": "boolean",
                    "description": "可选,重置指定会话的全局状态",
                },
                "timeoutMs": {
                    "type": "integer",
                    "description": "可选,单次执行超时(默认 60000ms,上限 300000)",
                },
            },
            "required": ["code"],
        }

        def _prune() -> None:
            now = time.time()
            for sid in list(self._code_sessions):
                session = self._code_sessions[sid]
                if (
                    session["proc"].returncode is not None
                    and now - session["last_active"] > _CODE_SESSION_TTL
                ):
                    self._code_sessions.pop(sid, None)

        async def _kill(session: dict[str, Any]) -> None:
            with contextlib.suppress(Exception):
                session["proc"].kill()
            self._code_sessions.pop(session["id"], None)

        async def _exec(args: dict[str, Any]) -> Any:
            code = args.get("code")
            if not isinstance(code, str) or not code.strip():
                return {"error": "run_code 需要非空 code"}
            reset = bool(args.get("reset"))
            session_id = args.get("sessionId")
            _prune()
            try:
                timeout_s = max(
                    1.0,
                    min(
                        int(args.get("timeoutMs") or _CODE_DEFAULT_TIMEOUT_MS),
                        _CODE_MAX_TIMEOUT_MS,
                    )
                    / 1000.0,
                )
            except (TypeError, ValueError):
                timeout_s = _CODE_DEFAULT_TIMEOUT_MS / 1000.0
            session: dict[str, Any] | None = None
            if isinstance(session_id, str) and session_id:
                session = self._code_sessions.get(session_id)
                if session is None:
                    return {"error": f"代码会话不存在或已回收: {session_id}"}
            elif reset:
                return {"error": "reset 需要同时提供 sessionId"}
            if session is None:
                if len(self._code_sessions) >= _MAX_CODE_SESSIONS:
                    return {
                        "error": f"代码会话数已达上限({_MAX_CODE_SESSIONS}),"
                        "请复用 sessionId 或等待空闲回收"
                    }
                new_id = f"cdx_{uuid.uuid4().hex[:12]}"
                try:
                    proc = await asyncio.create_subprocess_exec(
                        sys.executable,
                        "-I",
                        "-c",
                        _CODE_BOOTSTRAP,
                        stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.DEVNULL,
                        cwd=thread.workspace or os.getcwd(),
                    )
                except OSError as e:
                    return {"error": f"代码会话进程创建失败: {e}"}
                session = {
                    "id": new_id,
                    "proc": proc,
                    "created_at": time.time(),
                    "last_active": time.time(),
                    "lock": asyncio.Lock(),
                }
                self._code_sessions[new_id] = session
            assert session is not None
            async with session["lock"]:
                proc = session["proc"]
                session["last_active"] = time.time()
                if proc.stdin is None or proc.stdout is None:
                    await _kill(session)
                    return {"error": "代码会话管道不可用,请重建会话"}
                deadline = asyncio.get_running_loop().time() + timeout_s
                try:
                    proc.stdin.write(
                        (json.dumps({"op": "reset" if reset else "run", "code": code}, ensure_ascii=False) + "\n").encode("utf-8")
                    )
                    await proc.stdin.drain()
                except (OSError, RuntimeError) as e:
                    await _kill(session)
                    return {"error": f"代码会话写入失败(进程可能已退出): {e}"}
                nested = 0
                while True:
                    remaining = deadline - asyncio.get_running_loop().time()
                    if remaining <= 0:
                        await _kill(session)
                        return {
                            "error": f"代码执行超时({timeout_s:.0f}s),会话已终止;"
                            "长任务请拆分多次调用"
                        }
                    try:
                        raw = await asyncio.wait_for(
                            proc.stdout.readline(), timeout=remaining
                        )
                    except TimeoutError:
                        await _kill(session)
                        return {
                            "error": f"代码执行超时({timeout_s:.0f}s),会话已终止;"
                            "长任务请拆分多次调用"
                        }
                    if not raw:
                        await _kill(session)
                        return {"error": "代码会话进程已退出(可能是代码杀死了进程)"}
                    try:
                        frame = json.loads(raw.decode("utf-8", errors="replace"))
                    except ValueError:
                        continue  # 非协议行(理论不出现),跳过
                    if frame.get("type") == "toolCall":
                        nested += 1
                        if nested > _CODE_MAX_NESTED_TOOL_CALLS:
                            await _kill(session)
                            return {
                                "error": f"嵌套工具调用超过上限({_CODE_MAX_NESTED_TOOL_CALLS}),"
                                "会话已终止"
                            }
                        name = str(frame.get("name") or "")
                        call_args = (
                            frame.get("args") if isinstance(frame.get("args"), dict) else {}
                        )
                        try:
                            tool_result = await self._invoke_tool_by_name(
                                thread, name, call_args
                            )
                            reply = {"ok": True, "result": tool_result}
                        except LookupError as e:
                            reply = {"ok": False, "error": str(e)}
                        except Exception as e:  # noqa: BLE001 - 工具失败回传代码层自行处理
                            reply = {"ok": False, "error": f"{type(e).__name__}: {e}"}
                        try:
                            proc.stdin.write(
                                (json.dumps(reply, ensure_ascii=False, default=str) + "\n").encode("utf-8")
                            )
                            await proc.stdin.drain()
                        except (OSError, RuntimeError) as e:
                            await _kill(session)
                            return {"error": f"代码会话结算失败: {e}"}
                        continue
                    if frame.get("type") == "done":
                        session["last_active"] = time.time()
                        out: dict[str, Any] = {
                            "sessionId": session["id"],
                            "ok": bool(frame.get("ok")),
                            "output": str(frame.get("output") or "(无输出)"),
                        }
                        if frame.get("error"):
                            out["error"] = str(frame["error"])
                        if frame.get("reset"):
                            out["reset"] = True
                        return out

        return ToolDefinition(
            name="run_code",
            description=(
                "在常驻 Python 代码会话中执行一段代码(cell),适合多步数据变换、"
                "批量工具编排、需要中间状态的计算——比多次工具调用省往返。"
                "代码内用 tools.call('工具名', {参数}) 调用本线程全部可用工具"
                "(宿主工具与内置工具);print 输出会被捕获返回;全局变量跨调用持久"
                "(reset=true 清空)。注意:不要使用 input()/直接读 stdin。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _request_permissions_tool(self, thread: EngineThread) -> Any:
        """request_permissions:模型主动请求权限提升(对标 Codex RequestPermissionsTool)。

        经 approval/request 通知(kind=permissions)发往客户端,approval.respond
        结算(approve→granted / reject→denied / 超时→默认拒绝),结果结构化回模型。
        """
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "permissions": {
                    "type": "array",
                    "description": "请求的权限范围",
                    "items": {"type": "string", "enum": list(_VALID_PERMISSION_SCOPES)},
                },
                "reason": {"type": "string", "description": "为什么需要这些权限"},
                "timeoutMs": {
                    "type": "integer",
                    "description": "等待用户决策的超时(默认 30000ms)",
                },
            },
            "required": ["permissions", "reason"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            perms = args.get("permissions")
            reason = args.get("reason")
            if (
                not isinstance(perms, list)
                or not perms
                or not all(p in _VALID_PERMISSION_SCOPES for p in perms)
            ):
                return {
                    "granted": False,
                    "reason": f"permissions 须为非空且取值合法的数组(允许: {list(_VALID_PERMISSION_SCOPES)})",
                }
            if not isinstance(reason, str) or not reason.strip():
                return {"granted": False, "reason": "需要说明请求理由(reason)"}
            try:
                timeout_ms = int(args.get("timeoutMs") or _DEFAULT_PERMISSION_TIMEOUT_MS)
            except (TypeError, ValueError):
                timeout_ms = _DEFAULT_PERMISSION_TIMEOUT_MS
            timeout_ms = max(1000, min(timeout_ms, 120_000))
            request_id = f"req_{uuid.uuid4().hex[:12]}"
            future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
            self._permission_requests[request_id] = future
            try:
                await (thread.emit or _noop_emitter)(
                    {
                        "jsonrpc": "2.0",
                        "method": "approval/request",
                        "params": {
                            "requestId": request_id,
                            "threadId": thread.thread_id,
                            "kind": "permissions",
                            "permissions": list(perms),
                            "reason": reason.strip(),
                            "timeoutMs": timeout_ms,
                        },
                    }
                )
                decision = await asyncio.wait_for(future, timeout=timeout_ms / 1000.0)
                granted = str(decision) == "approve"
                return {
                    "granted": granted,
                    "permissions": list(perms) if granted else [],
                    "decision": str(decision),
                }
            except TimeoutError:
                return {"granted": False, "reason": "用户决策超时,默认拒绝"}
            finally:
                self._permission_requests.pop(request_id, None)

        return ToolDefinition(
            name="request_permissions",
            description=(
                "当现有权限不足以完成任务时,向用户请求提升权限"
                "(sandbox_full_access/network/elevated_exec/workspace_write);"
                "用户拒绝或超时将得到 granted=false,请改用现有权限完成任务。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _unified_exec_tool(self, thread: EngineThread) -> Any:
        """unified_exec:持久 shell 会话(2026-09-18 第四批,对标 Codex unified_exec)。

        首次调用新建持久进程会话(输出 head+tail 有界缓冲);后续按 sessionId
        续写 stdin 并只回传增量输出。会话上限/空闲 TTL/工具级审批策略照常生效。
        """
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的命令;已有 sessionId 时作为该会话 stdin 的新输入",
                },
                "sessionId": {
                    "type": "string",
                    "description": "可选,续用已存在的持久会话(首次调用勿传)",
                },
                "cwd": {
                    "type": "string",
                    "description": "可选,新建会话的工作目录(默认线程 workspace)",
                },
                "timeoutMs": {
                    "type": "integer",
                    "description": "可选,等待输出/退出的时长(默认 30000ms)",
                },
            },
            "required": ["command"],
        }

        def _append_output(session: dict[str, Any], chunk: str) -> None:
            buf = session["buffer"] + chunk
            if len(buf) > _EXEC_BUFFER_HEAD + _EXEC_BUFFER_TAIL:
                dropped = len(buf) - _EXEC_BUFFER_HEAD - _EXEC_BUFFER_TAIL
                buf = (
                    buf[:_EXEC_BUFFER_HEAD]
                    + f"\n...[中间截断 {dropped} 字符]...\n"
                    + buf[-_EXEC_BUFFER_TAIL:]
                )
            session["buffer"] = buf

        async def _reader(session: dict[str, Any]) -> None:
            proc = session["proc"]
            assert proc.stdout is not None
            while True:
                chunk = await proc.stdout.read(4096)
                if not chunk:
                    break
                _append_output(session, chunk.decode("utf-8", errors="replace"))

        def _prune_sessions() -> None:
            now = time.time()
            for sid in list(self._exec_sessions):
                session = self._exec_sessions[sid]
                proc = session["proc"]
                if (
                    proc.returncode is not None
                    and now - session["last_active"] > _EXEC_SESSION_TTL
                ):
                    self._exec_sessions.pop(sid, None)

        async def _wait_settled(
            session: dict[str, Any], before: int, timeout_s: float
        ) -> dict[str, Any]:
            """等待输出稳定(连续 300ms 无新增)或超时,回传增量。

            常驻 shell 会话无法从进程退出判断命令完成(对标 Codex interactive
            session 语义),以输出静默作为 settle 启发式;status 恒 running,
            由模型按输出内容自行判断命令是否结束。
            """
            deadline = time.time() + timeout_s
            quiet_since: float | None = None
            while time.time() < deadline:
                await asyncio.sleep(0.05)
                grown = len(session["buffer"]) > before
                if not grown and quiet_since is not None and time.time() - quiet_since >= 0.3:
                    break
                quiet_since = None if grown else (quiet_since or time.time())
            new_output = session["buffer"][before:]
            proc = session["proc"]
            return {
                "sessionId": session["id"],
                "status": "running" if proc.returncode is None else "completed",
                "exitCode": proc.returncode,
                "output": new_output or "(无新增输出)",
                "cwd": session["cwd"],
            }

        async def _exec(args: dict[str, Any]) -> Any:
            command = args.get("command")
            if not isinstance(command, str) or not command.strip():
                return {"error": "unified_exec 需要非空 command"}
            _prune_sessions()
            session_id = args.get("sessionId")
            try:
                timeout_s = max(1.0, min(int(args.get("timeoutMs") or 30_000), 120_000) / 1000.0)
            except (TypeError, ValueError):
                timeout_s = 30.0
            # 续用既有会话:写 stdin,只回传增量
            if isinstance(session_id, str) and session_id:
                existing = self._exec_sessions.get(session_id)
                if existing is None:
                    return {"error": f"会话不存在或已回收: {session_id}"}
                existing["last_active"] = time.time()
                proc_stdin = existing["proc"].stdin
                if proc_stdin is not None and proc_stdin.is_closing() is False:
                    before = len(existing["buffer"])
                    proc_stdin.write((command + "\n").encode("utf-8"))
                    with contextlib.suppress(Exception):
                        await proc_stdin.drain()
                    return await _wait_settled(existing, before, timeout_s)
                return {"error": f"会话 stdin 已关闭(进程退出): {session_id}"}
            # 新建常驻 shell 会话(命令经 stdin 逐条注入,对标 Codex unified_exec
            # interactive session;Windows 用 cmd /Q /K,POSIX 用 bash)
            if len(self._exec_sessions) >= _MAX_EXEC_SESSIONS:
                return {
                    "error": f"持久会话数已达上限({_MAX_EXEC_SESSIONS}),"
                    "请复用 sessionId 或等待空闲回收"
                }
            cwd = args.get("cwd")
            resolved_cwd = (
                cwd if isinstance(cwd, str) and cwd.strip() else thread.workspace
            ) or os.getcwd()
            new_id = f"shx_{uuid.uuid4().hex[:12]}"
            shell_argv = (
                ["cmd.exe", "/Q", "/K"]
                if os.name == "nt"
                else ["bash", "--noprofile", "--norc"]
            )
            try:
                proc = await asyncio.create_subprocess_exec(
                    *shell_argv,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    stdin=asyncio.subprocess.PIPE,
                    cwd=resolved_cwd,
                )
            except OSError as e:
                return {"error": f"进程创建失败: {e}"}
            new_session: dict[str, Any] = {
                "id": new_id,
                "proc": proc,
                "buffer": "",
                "cwd": resolved_cwd,
                "created_at": time.time(),
                "last_active": time.time(),
            }
            self._exec_sessions[new_id] = new_session
            new_session["reader"] = asyncio.create_task(_reader(new_session))
            thread.last_shell_cwd = resolved_cwd
            thread.touch()
            before = len(new_session["buffer"])
            if proc.stdin is not None:
                proc.stdin.write((command + "\n").encode("utf-8"))
                with contextlib.suppress(Exception):
                    await proc.stdin.drain()
            return await _wait_settled(new_session, before, timeout_s)

        return ToolDefinition(
            name="unified_exec",
            description=(
                "持久 shell 会话执行:首次调用启动常驻 shell 并注入命令"
                "(返回 sessionId + 截至当前的输出,输出静默即回传);"
                "后续传同一 sessionId 续写 stdin、只回传增量输出。"
                "适合交互式进程(REPL/dev server/多步安装);"
                "status 恒为 running 直到会话退出,请按输出自行判断命令完成。"
                "受线程工具审批策略约束;会话空闲超时自动回收。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    def _request_user_input_tool(self, thread: EngineThread) -> Any:
        """request_user_input:中轮向用户要结构化输入(2026-09-18 第四批,
        对标 Codex elicitation):elicitation/request 通知 + elicitation.respond
        结算,超时 fail-closed。"""
        from .agent_loop_v2 import ToolDefinition

        parameters = {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "要问用户的问题"},
                "schema": {
                    "type": "object",
                    "description": "可选,期望回答满足的 JSON Schema",
                },
                "timeoutMs": {
                    "type": "integer",
                    "description": "可选,等待用户回答的超时(默认 30000ms)",
                },
            },
            "required": ["question"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            question = args.get("question")
            if not isinstance(question, str) or not question.strip():
                return {"error": "request_user_input 需要非空 question"}
            schema = args.get("schema") if isinstance(args.get("schema"), dict) else None
            try:
                timeout_ms = int(
                    args.get("timeoutMs") or _DEFAULT_ELICITATION_TIMEOUT_MS
                )
            except (TypeError, ValueError):
                timeout_ms = _DEFAULT_ELICITATION_TIMEOUT_MS
            timeout_ms = max(1000, min(timeout_ms, 120_000))
            elicitation_id = f"eli_{uuid.uuid4().hex[:12]}"
            future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
            self._elicitation_requests[elicitation_id] = future
            try:
                await (thread.emit or _noop_emitter)(
                    {
                        "jsonrpc": "2.0",
                        "method": "elicitation/request",
                        "params": {
                            "elicitationId": elicitation_id,
                            "threadId": thread.thread_id,
                            "question": question.strip(),
                            "schema": schema,
                            "timeoutMs": timeout_ms,
                        },
                    }
                )
                value = await asyncio.wait_for(future, timeout=timeout_ms / 1000.0)
                return {"responded": True, "value": value}
            except TimeoutError:
                return {"responded": False, "reason": "用户回答超时,按未提供处理"}
            finally:
                self._elicitation_requests.pop(elicitation_id, None)

        return ToolDefinition(
            name="request_user_input",
            description=(
                "向用户请求结构化输入(选项确认/表单补全):经 elicitation/request "
                "通知发往客户端,用户回答经 elicitation.respond 回填;超时将得到 "
                "responded=false,请基于现有信息继续。"
            ),
            parameters=parameters,
            executor=_exec,
        )

    async def _handle_tools_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """合并清单:MCP 超级工具池(承载体注入)+ 本线程注入的宿主工具。"""
        thread_id = params.get("threadId")
        host_tools: list[dict[str, Any]] = []
        if isinstance(thread_id, str) and thread_id in self._threads:
            thread = self._threads[thread_id]
            host_tools = [
                {
                    "name": spec.name,
                    "description": spec.description,
                    "parameters": spec.parameters,
                    "source": "host",
                    "timeoutMs": spec.timeout_ms,
                }
                for spec in thread.host_tools.values()
            ]
        pool: list[dict[str, Any]] | None = None
        if self._tool_lister is not None:
            try:
                pool = await self._tool_lister()
            except Exception as e:  # noqa: BLE001 - 工具池查询失败降级为空
                logger.warning("[engine] 工具池查询失败(降级): %s", e)
                pool = None
        return {
            "hostTools": host_tools,
            "pool": pool,
            "poolAvailable": pool is not None,
            "total": len(host_tools) + (len(pool) if pool else 0),
        }

    async def _handle_tools_register(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """注入宿主自有工具:执行回传客户端(下一次 prompt 生效)。"""
        thread = self._require_thread(params)
        name = params.get("name")
        if not isinstance(name, str) or not name:
            raise JsonRpcError(INVALID_PARAMS, "缺少工具 name")
        description = params.get("description")
        parameters = params.get("parameters")
        if parameters is not None and not isinstance(parameters, dict):
            raise JsonRpcError(INVALID_PARAMS, "parameters 须为 JSON Schema 对象")
        timeout_ms = params.get("timeoutMs")
        try:
            resolved_timeout = int(timeout_ms) if timeout_ms is not None else (
                self._host_tool_timeout_ms
            )
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "timeoutMs 须为整数") from e
        if resolved_timeout <= 0:
            raise JsonRpcError(INVALID_PARAMS, "timeoutMs 须为正整数")
        thread.host_tools[name] = HostToolSpec(
            name=name,
            description=description if isinstance(description, str) else name,
            parameters=parameters if isinstance(parameters, dict) else {"type": "object"},
            timeout_ms=resolved_timeout,
        )
        thread.touch()
        return {
            "threadId": thread.thread_id,
            "name": name,
            "registered": True,
            "availableFrom": "next_prompt",
            "hostTools": sorted(thread.host_tools),
        }

    async def _tool_catalog(self, thread: EngineThread | None) -> list[dict[str, Any]]:
        """合并工具目录快照(2026-09-18 第四批,对标 Codex tool_search 目录面):
        内置工具 + 线程宿主工具 + MCP 超级工具池(承载体注入)。"""
        catalog: list[dict[str, Any]] = [
            {"name": name, "source": "builtin", "description": ""}
            for name in BUILTIN_ENGINE_TOOLS
        ]
        if thread is not None:
            catalog.extend(
                {
                    "name": spec.name,
                    "source": "host",
                    "description": spec.description,
                    "parameters": spec.parameters,
                    "timeoutMs": spec.timeout_ms,
                }
                for spec in thread.host_tools.values()
            )
        if self._tool_lister is not None:
            try:
                pool = await self._tool_lister()
                if isinstance(pool, list):
                    catalog.extend(
                        {
                            "name": str(t.get("name") or ""),
                            "source": "mcp",
                            "description": str(t.get("description") or ""),
                            "parameters": t.get("parameters")
                            if isinstance(t.get("parameters"), dict)
                            else {"type": "object"},
                        }
                        for t in pool
                        if isinstance(t, dict) and t.get("name")
                    )
            except Exception as e:  # noqa: BLE001 - 目录查询失败降级为部分结果
                logger.warning("[engine] tools 目录查询失败(降级): %s", e)
        return catalog

    async def _handle_tools_search(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """工具搜索(2026-09-18 第四批,对标 Codex tool_search/LoadableToolSpec):

        超量工具面下按 query 模糊匹配 name+description,返回可装载条目;
        客户端择要 tools.load 装载进线程,避免全量 schema 撑爆上下文。
        """
        thread: EngineThread | None = None
        thread_id = params.get("threadId")
        if isinstance(thread_id, str) and thread_id in self._threads:
            thread = self._threads[thread_id]
        query = str(params.get("query") or "").strip().lower()
        if not query:
            raise JsonRpcError(INVALID_PARAMS, "缺少 query")
        try:
            limit = max(1, min(int(params.get("limit") or 10), 50))
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "limit 须为整数") from e
        catalog = await self._tool_catalog(thread)
        results = [
            entry
            for entry in catalog
            if query in entry["name"].lower()
            or query in entry["description"].lower()
        ][:limit]
        thread.touch() if thread is not None else None
        return {
            "query": params.get("query"),
            "results": results,
            "total": len(results),
            "catalogSize": len(catalog),
        }

    async def _handle_tools_load(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """装载搜索到的工具进线程(2026-09-18 第四批,对标 LoadableToolSpec
        materialize 语义):描述/schema 可省略,缺省从目录快照回填。"""
        thread = self._require_thread(params)
        name = params.get("name")
        if not isinstance(name, str) or not name:
            raise JsonRpcError(INVALID_PARAMS, "缺少工具 name")
        if name in thread.host_tools:
            return {
                "threadId": thread.thread_id,
                "name": name,
                "loaded": True,
                "alreadyLoaded": True,
                "hostTools": sorted(thread.host_tools),
            }
        spec: dict[str, Any] | None = None
        for entry in await self._tool_catalog(thread):
            if entry["name"] == name and entry.get("parameters") is not None:
                spec = entry
                break
        if spec is None and name in BUILTIN_ENGINE_TOOLS:
            raise JsonRpcError(
                INVALID_PARAMS, f"{name} 为引擎内置工具,无需装载"
            )
        description = params.get("description")
        parameters = params.get("parameters")
        timeout_ms = params.get("timeoutMs")
        resolved_description = (
            description
            if isinstance(description, str) and description
            else (
                str(spec.get("description"))
                if spec and isinstance(spec.get("description"), str)
                else name
            )
        )
        resolved_parameters = (
            parameters
            if isinstance(parameters, dict)
            else (
                spec["parameters"]
                if spec and isinstance(spec.get("parameters"), dict)
                else {"type": "object"}
            )
        )
        try:
            resolved_timeout = (
                int(timeout_ms)
                if timeout_ms is not None
                else (
                    int(spec["timeoutMs"])
                    if spec and isinstance(spec.get("timeoutMs"), int)
                    else self._host_tool_timeout_ms
                )
            )
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "timeoutMs 须为整数") from e
        thread.host_tools[name] = HostToolSpec(
            name=name,
            description=resolved_description,
            parameters=resolved_parameters,
            timeout_ms=max(1, int(resolved_timeout)),
        )
        thread.touch()
        return {
            "threadId": thread.thread_id,
            "name": name,
            "loaded": True,
            "alreadyLoaded": False,
            "availableFrom": "next_prompt",
            "hostTools": sorted(thread.host_tools),
        }

    async def _handle_elicitation_respond(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """elicitation 决策回填(2026-09-18 第四批,对标 Codex elicitation):
        唤醒等待中的 request_user_input 工具执行。"""
        elicitation_id = params.get("elicitationId") or params.get("requestId")
        if not isinstance(elicitation_id, str) or not elicitation_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 elicitationId")
        future = self._elicitation_requests.get(elicitation_id)
        if future is None:
            return {"elicitationId": elicitation_id, "applied": False, "reason": "unknown"}
        if future.done():
            return {"elicitationId": elicitation_id, "applied": False, "reason": "already_settled"}
        future.set_result(params.get("value"))
        return {"elicitationId": elicitation_id, "applied": True}

    def _build_host_tool_definitions(self, thread: EngineThread) -> list[Any]:
        """把宿主工具规格转成主循环的 ToolDefinition(执行体回调客户端)。"""
        if not thread.host_tools:
            return []
        from .agent_loop_v2 import ToolDefinition

        definitions: list[Any] = []
        for name, spec in thread.host_tools.items():

            async def _execute(
                args: dict[str, Any], _name: str = name, _timeout: int = spec.timeout_ms
            ) -> Any:
                return await self._call_host_tool(thread, _name, args, _timeout)

            definitions.append(
                ToolDefinition(
                    name=name,
                    description=spec.description,
                    parameters=spec.parameters,
                    executor=_execute,
                )
            )
        return definitions

    async def _call_host_tool(
        self, thread: EngineThread, name: str, args: dict[str, Any], timeout_ms: int
    ) -> Any:
        """向客户端发起 tool/execute 往返,等待结果(超时降级为可重试错误)。"""
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        thread.pending[request_id] = future
        try:
            await (thread.emit or _noop_emitter)(
                {
                    "jsonrpc": "2.0",
                    "method": "tool/execute",
                    "params": {
                        "requestId": request_id,
                        "threadId": thread.thread_id,
                        "name": name,
                        "arguments": args,
                        "timeoutMs": timeout_ms,
                    },
                }
            )
            return await asyncio.wait_for(future, timeout=timeout_ms / 1000.0)
        except TimeoutError as e:
            raise JsonRpcError(
                WAIT_TIMEOUT,
                f"宿主工具 {name} 回传超时({timeout_ms}ms)",
            ) from e
        except JsonRpcError:
            raise
        except Exception as e:  # noqa: BLE001 - 客户端报错归一为宿主工具失败
            raise JsonRpcError(HOST_TOOL_FAILED, f"宿主工具 {name} 执行失败: {e}") from e
        finally:
            thread.pending.pop(request_id, None)

    async def _handle_tools_result(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """回传宿主工具执行结果(结算对应的 tool/execute 请求)。

        requestId → 线程查找:requestId 由引擎生成且全局唯一,故遍历线程
        pending 表定位即可(线程数有限,不做额外索引)。找不到(已超时清理 /
        线程已关闭)→ applied=False,客户端可安全忽略。
        """
        request_id = params.get("requestId")
        if not isinstance(request_id, str) or not request_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 requestId")
        target: EngineThread | None = None
        for thread in self._threads.values():
            if request_id in thread.pending:
                target = thread
                break
        if target is None:
            return {"requestId": request_id, "applied": False, "reason": "unknown_request"}
        future = target.pending.get(request_id)
        if future is None or future.done():
            return {"requestId": request_id, "applied": False, "reason": "already_settled"}
        error = params.get("error")
        if error:
            future.set_exception(JsonRpcError(HOST_TOOL_FAILED, str(error)))
        else:
            future.set_result(params.get("result"))
        return {"requestId": request_id, "applied": True, "threadId": target.thread_id}

    # ------------------------------------------------------------------
    # approval.*
    # ------------------------------------------------------------------

    async def _handle_approval_respond(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """审批决策回填(打通主循环 _approval_registry,唤醒等待中的工具执行)。

        审批 id 由主循环生成(与 threadId 无强绑定),故不要求 threadId;
        找不到/已超时 → ok=False(客户端可安全忽略)。
        """
        approval_id = params.get("approvalId") or params.get("requestId")
        if not isinstance(approval_id, str) or not approval_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 approvalId")
        decision = str(params.get("decision") or "").strip().lower()
        if decision not in ("approve", "reject", "allow", "deny"):
            raise JsonRpcError(
                INVALID_PARAMS, "decision 须为 approve/reject(或 allow/deny)"
            )
        normalized = "approve" if decision in ("approve", "allow") else "reject"
        from .agent_loop_v2 import resolve_approval_response

        applied = bool(resolve_approval_response(approval_id, normalized))
        # request_permissions 工具的待决请求同路结算(2026-09-18 第三批)
        perm_future = self._permission_requests.get(approval_id)
        if perm_future is not None and not perm_future.done():
            perm_future.set_result(normalized)
            applied = True
        return {
            "approvalId": approval_id,
            "decision": normalized,
            "applied": applied,
        }

    # ------------------------------------------------------------------
    # cost.* / models.*
    # ------------------------------------------------------------------

    def _thread_cost(self, thread: EngineThread) -> dict[str, Any]:
        if self._cost_report is None:
            return {}
        try:
            return self._cost_report({"session_id": thread.session_id})
        except Exception as e:  # noqa: BLE001 - 成本查询失败不影响线程状态查询
            logger.warning("[engine] 成本汇总失败(降级为空): %s", e)
            return {}

    async def _handle_cost_report(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        if self._cost_report is None:
            return {"available": False, "report": {}}
        filt: dict[str, Any] = {}
        for key in ("session_id", "run_id", "model", "tool_name", "user_id"):
            value = params.get(key)
            if isinstance(value, str) and value:
                filt[key] = value
        return {"available": True, "filter": filt, "report": self._cost_report(filt or None)}

    async def _handle_models_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        if self._model_lister is None:
            return {"available": False, "models": []}
        try:
            models = self._model_lister()
        except Exception as e:  # noqa: BLE001 - 模型清单失败降级为空
            logger.warning("[engine] 模型清单查询失败(降级为空): %s", e)
            models = []
        return {"available": True, "models": models, "total": len(models)}

    # ------------------------------------------------------------------
    # 事件转发
    # ------------------------------------------------------------------

    def _hook_bus(self) -> Any:
        """事件总线(hook_engine 单例;承载层可注入替身便于测试)。"""
        if self._injected_bus is not None:
            return self._injected_bus
        from .hook_engine import hook_engine

        return hook_engine

    def _subscribe_events(self) -> list[tuple[str, OrderedEventQueue]]:
        """同步订阅全部 agent 事件(必须在启动主循环之前调用,避免丢首帧事件)。"""
        bus = self._hook_bus()
        counter = itertools.count()
        queues: list[tuple[str, OrderedEventQueue]] = []
        for event in AGENT_EVENTS:
            try:
                # 经总线注册代理队列(带全局序号;总线广播只依赖 full/put_nowait/get_nowait)
                queue: Any = bus.subscribe(
                    event, queue_factory=lambda: OrderedEventQueue(counter)
                )
            except TypeError:
                # 总线实现不支持 queue_factory(如外部替换的 hook_bus):退化为原接口。
                # 事件仍能全部转发,只是跨事件名的到达顺序退化为声明顺序。
                try:
                    queue = bus.subscribe(event)
                except Exception as e:  # noqa: BLE001 - 订阅失败不影响 thread.prompt
                    logger.warning("[engine] 事件订阅失败 %s(降级): %s", event, e)
                    continue
            except Exception as e:  # noqa: BLE001 - 订阅失败不影响 thread.prompt
                logger.warning("[engine] 事件订阅失败 %s(降级): %s", event, e)
                continue
            queues.append((event, queue))
        return queues

    def _unsubscribe_events(self, queues: list[tuple[str, OrderedEventQueue]]) -> None:
        bus = self._hook_bus()
        for event, queue in queues:
            with contextlib.suppress(Exception):
                bus.unsubscribe(event, queue)

    async def _forward_events(
        self,
        thread: EngineThread,
        emit: Emitter,
        queues: list[tuple[str, OrderedEventQueue]],
    ) -> None:
        """把已订阅队列里属于本线程的事件转成 thread/event 通知。

        事件名集合固定(AGENT_EVENTS,与主循环全部 emit 点对齐);载荷里
        session_id 或 run_id(thinking.delta/self_heal 用 run_id 承载会话)命中
        本线程即转发。审批事件额外派发 approval/request 通知,客户端只需应答
        approval.respond 即可,无需解析事件细节。
        """
        try:
            while True:
                await self._drain_events(thread, emit, queues)
                await asyncio.sleep(EVENT_POLL_INTERVAL)
        except asyncio.CancelledError:
            raise
        finally:
            self._unsubscribe_events(queues)

    def _collect_pending(
        self, queues: list[tuple[str, OrderedEventQueue]]
    ) -> list[tuple[int, str, Any]]:
        """汇总全部队列的待发事件,按全局入队序号排序(恢复跨事件名的真实到达顺序)。"""
        batch: list[tuple[int, str, Any]] = []
        for event, queue in queues:
            while True:
                try:
                    seq, payload = queue.get_nowait()
                except (asyncio.QueueEmpty, IndexError):
                    break
                batch.append((seq, event, payload))
        batch.sort(key=lambda item: item[0])
        return batch

    async def _drain_events(
        self,
        thread: EngineThread,
        emit: Emitter,
        queues: list[tuple[str, OrderedEventQueue]],
    ) -> None:
        """把当前已入队的事件全部发射(转发循环与结束前补扫共用同一路径)。

        为何需要结束前补扫:事件由 hook 总线异步写入队列、转发任务按固定间隔轮询,
        主循环可能在最后一次轮询之后才发完事件;若结束时直接取消转发任务,尾部事件
        (往往是最有价值的最终 message / session.end)会永久丢失。
        """
        for _, event, payload in self._collect_pending(queues):
            if not self._belongs_to(thread, payload):
                continue
            await emit(
                {
                    "jsonrpc": "2.0",
                    "method": "thread/event",
                    "params": {
                        "threadId": thread.thread_id,
                        "event": event,
                        "payload": payload,
                    },
                }
            )
            if event == "tool.approval":
                await self._emit_approval_request(thread, payload, emit)

    @staticmethod
    def _belongs_to(thread: EngineThread, payload: Any) -> bool:
        """事件是否属于本线程(session_id / run_id 任一命中;两者皆无则丢弃)。"""
        if not isinstance(payload, dict):
            return False
        for key in _SESSION_KEYS:
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value == thread.session_id
        return False

    async def _emit_approval_request(
        self, thread: EngineThread, payload: dict[str, Any], emit: Emitter
    ) -> None:
        """把主循环的 tool.approval 事件转成标准审批通知(客户端只回 decision)。"""
        approval_id = payload.get("approval_id")
        if not isinstance(approval_id, str) or not approval_id:
            return
        preview = payload.get("args_preview")
        await emit(
            {
                "jsonrpc": "2.0",
                "method": "approval/request",
                "params": {
                    "requestId": approval_id,
                    "threadId": thread.thread_id,
                    "toolName": payload.get("tool_name"),
                    "toolCallId": payload.get("tool_call_id"),
                    "dangerLevel": payload.get("danger_level"),
                    "argsPreview": (
                        preview[:_HIGH_RISK_PREVIEW_CHARS]
                        if isinstance(preview, str)
                        else preview
                    ),
                },
            }
        )

    # ------------------------------------------------------------------
    # 状态自省(承载层/运维)
    # ------------------------------------------------------------------

    def thread_count(self) -> int:
        return len(self._threads)

    def thread_ids(self) -> list[str]:
        return sorted(self._threads)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
