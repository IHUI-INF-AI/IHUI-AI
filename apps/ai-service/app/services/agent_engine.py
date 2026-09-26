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
import difflib
import hashlib
import itertools
import json
import logging
import os
import shlex
import shutil
import sys
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, cast

from app.core.command_safety import dangerous_command_match as _dangerous_command_match
from app.core.image_preparation import (
    detail_limits as _image_detail_limits,
)
from app.core.image_preparation import (
    load_data_url_for_prompt as _load_data_url_for_prompt,
)
from app.core.agents_md_state import AgentsMdState  # 批58:AGENTS.md 状态机(对标 codex agents_md.rs)
from app.core.retained_context import RetainedContext, RetainedUserMessage  # 批58:宿主事实账本(对标 codex retained_context.rs)
from app.core.output_cleaning import strip_ansi as _strip_ansi
from app.core.sandbox_policy import PROTECTED_METADATA_PATH_NAMES as _PROTECTED_METADATA_PATH_NAMES
# 批58 接线:5 个已写但零生产引用的模块(假覆盖 → 真接线)。
# 各模块仅纯函数/数据结构,导入无副作用;运行行为仍由各自 env 开关门控。
from app.core.git_workspaces_metadata import (
    collect_git_workspaces,
    workspaces_to_metadata_value,
)
from app.core.thread_originator import (
    effective_originator_value,
    originator_from_service_name,
)
from app.core.installation_id import INSTALLATION_ID_FILENAME
from app.core.permission_mode import normalize_permission_mode
from app.core.permission_mode import permission_mode_error
from app.core.queue_items import build_queue_items
from app.core.turn_metadata import (
    CodexResponsesMetadata,
    CodexResponsesRequestKind,
)
from app.core.feature_flags import FeatureRegistry, FeatureSpec

from .engine_tool_bridge import capability_equivalent, execution_mode
from .session_store import ItemBase, SessionStore

logger = logging.getLogger(__name__)


def _make_sandbox_mode_tagger() -> Any:
    """批57:sandbox_mode 标签工厂(对标 Codex sandbox_tags.rs 诊断面)。

    返回闭包:传入 cwd 返回 policy_tag 字符串;任何异常返回 None(降级不填)。
    标签仅供诊断/观测,绝不用于授权判定(codex 红线)。
    """

    def _tag(cwd: str) -> str:
        from app.core.sandbox_policy import SandboxPolicy
        from app.core.sandbox_tags import SandboxTags

        policy = SandboxPolicy.new_read_only_policy()
        return SandboxTags.from_policy(policy, cwd).policy

    return _tag

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


def _require_permission_mode(raw: object) -> str:
    """客户端传入的 permissionMode → 规范标识(G-161 唯一真源)。

    省略/空 → "default";认不出 → JSON-RPC -32602 并列出合法取值。
    不在这里静默兜底成 default:那等于把"你要的权限档"和"实际生效的权限档"
    分开发,正是本次要根治的静默失效。
    """
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return "default"
    normalized = normalize_permission_mode(raw)
    if normalized is None:
        raise JsonRpcError(INVALID_PARAMS, permission_mode_error(raw))
    return normalized

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
        user_id / role_id / conversation_id / session_id / thread_id / enable_checkpoint。
        (role_id:V3 #47 第二格,承载层须把它喂给 AgentLoopV2 的 user_role,否则引擎自带
        的 admin 专属能力又会回到"不经角色矩阵"那一格。)
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


def _apply_sandbox(proc: Any) -> dict[str, Any]:
    """子进程 OS 级沙箱统一入口(第八批,对标 execpolicy 内核层;失败静默降级)。"""
    try:
        from app.core.proc_sandbox import apply_job_sandbox

        return apply_job_sandbox(proc)
    except Exception as e:  # noqa: BLE001 - 沙箱绝不阻塞主流程
        return {"active": False, "reason": f"沙箱模块异常: {e}"}


# 危险环境变量前缀(对标 Codex process-hardening:剥离 LD_PRELOAD/DYLD_* 等
# 注入型变量,防子进程被环境劫持;Windows 生产为 no-op 但跨平台语义正确)
_DANGEROUS_ENV_PREFIXES = ("LD_PRELOAD", "LD_AUDIT", "DYLD_")


def _sanitized_child_env() -> dict[str, str]:
    """子进程环境消毒:剔除注入型危险变量(第十一批,对标 process-hardening)。

    第二十六批升级:再剥离 exec_env.NON_INHERITABLE_ENV_VARS(管理凭据/
    身份令牌类,如 IHUI_ADMIN_PASSWORD),模型可达子进程绝不继承。
    """
    from app.core.exec_env import scrub_non_inheritable_env_vars

    env = dict(os.environ)
    for key in [
        k
        for k in env
        if any(k.upper().startswith(p) for p in _DANGEROUS_ENV_PREFIXES)
    ]:
        env.pop(key, None)
    return scrub_non_inheritable_env_vars(env)
# 工作区文件监视(2026-09-18 第七批,对标 Codex file-watcher)
_WATCH_INTERVAL = 2.0
_WATCH_MAX_ENTRIES = 2000
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


# ---------------------------------------------------------------------------
# 批58 接线 env 开关(默认 off,与现状逐字节等价)
# ---------------------------------------------------------------------------


def _agents_md_state_enabled_from_env() -> bool:
    """AGENTS.md 状态机增量注入开关(对标 codex context/world_state/agents_md.rs)。

    默认 off:保留原纯字符串拼接注入(逐字节不变);设为 on/1/true/yes 时启用
    AgentsMdState 状态机,内容变更发 REPLACEMENT、文件删除发 REMOVAL 通知。
    """
    return os.environ.get("IHUI_AGENTS_MD_STATE_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _turn_token_usage_enabled_from_env() -> bool:
    """turn token 直方图开关(对标 codex state/turn_token_usage.rs)。

    默认 off:不产生任何新事件(逐字节等价);设为 on/1/true/yes 时按模型分组
    聚合本轮用量并发出 turn_token_usage 指标事件。
    """
    return os.environ.get("IHUI_TURN_TOKEN_USAGE_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_git_metadata_enabled_from_env() -> bool:
    """git workspaces 元数据采集开关(模块1,对标 codex turn_metadata.rs git enrichment)。

    默认 off:不采集 git 信息(逐字节等价);设为 on/1/true/yes 时于 turn telemetry
    组装处采集 repo_root → {remote_urls 脱敏 / head hash / has_changes} 附加事件。
    """
    return os.environ.get("ENGINE_GIT_METADATA_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_thread_originator_enabled_from_env() -> bool:
    """线程来源 originator 解析开关(模块2,对标 codex thread_manager.rs)。

    默认 off:线程不持有 originator(逐字节等价);设为 on/1/true/yes 时于线程
    创建/恢复处经 effective_originator_value 解析并归一挂到 thread。
    """
    return os.environ.get("ENGINE_THREAD_ORIGINATOR_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_installation_id_enabled_from_env() -> bool:
    """安装实例 ID 纳入 telemetry 开关(模块3,read-only 不写文件)。

    默认 off:不读取/不附加安装实例 ID(逐字节等价);设为 on/1/true/yes 时于
    turn telemetry 处读取既有 installation_id 文件(若存在且合法)附加事件。
    约束:绝不调用写文件的 resolve_installation_id,只读不创建。
    """
    return os.environ.get("ENGINE_INSTALLATION_ID_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_turn_metadata_enabled_from_env() -> bool:
    """Codex 会话元数据键与请求元数据构建开关(模块4,对标 responses_metadata.rs)。

    默认 off:不构建 Codex 元数据(逐字节等价);设为 on/1/true/yes 时于 turn
    telemetry 处经 CodexResponsesMetadata 构建 client_metadata 投影附加事件。
    """
    return os.environ.get("ENGINE_TURN_METADATA_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_message_history_enabled_from_env() -> bool:
    """批58 接线(对标 codex message_history.rs):宿主历史账本追加。

    默认 off:不落任何历史文件(逐字节等价);设为 on/1/true/yes 且配置了
    IHUI_MESSAGE_HISTORY_PATH 时,于 turn.start 落盘处追加(多进程安全)用户指令。
    """
    return os.environ.get("ENGINE_MESSAGE_HISTORY_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_rollout_archive_enabled_from_env() -> bool:
    """批58 接线(对标 codex rollout 压缩 worker):导出后冷文件归档。

    默认 off:导出后不压缩(逐字节等价);设为 on/1/true/yes 时对同一目录下的
    冷导出 *.jsonl 做 gzip 归档(原子写 + 保留 mtime,单文件失败不抛出)。
    """
    return os.environ.get("ENGINE_ROLLOUT_ARCHIVE_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_rollout_truncation_enabled_from_env() -> bool:
    """批58 接线(对标 codex rollout truncation):导出按 turn_id 截断。

    默认 off:导出全量(逐字节等价);设为 on/1/true/yes 且入参带
    truncateAfterTurnId 时,只导出该 turn 及其之前的内容。
    """
    return os.environ.get("ENGINE_ROLLOUT_TRUNCATION_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_file_watcher_enabled_from_env() -> bool:
    """批58 接线(对标 codex file_watcher.rs):文件变更事件路由。

    默认 off:不持有路由器、不分发任何事件(逐字节等价);设为 on/1/true/yes 时
    引擎持有 FileWatcherRouter,补丁落盘后把变更路径分发给命中订阅方。
    仅启用纯路由层(订阅/分发),不启动轮询任务,不引入后台生命周期。
    """
    return os.environ.get("ENGINE_FILE_WATCHER_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _engine_feature_flags_enabled_from_env() -> bool:
    """集中式特性开关注册表开关(模块5,对标 codex features crate)。

    默认 off:引擎不咨询注册表,各特性判定走现有直读 env 路径(逐字节等价);
    设为 on/1/true/yes 时于 initialize 处经注册表解析生效集并暴露给客户端。
    """
    return os.environ.get("ENGINE_FEATURE_FLAGS_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


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
    # 回合标记(2026-09-19 批 43 接线,对标 codex thread/revert):user 消息索引
    # → turn_id 映射,thread.revert 据此精确裁剪内存消息(持久层同步截断)
    turn_markers: dict[int, str] = field(default_factory=dict)
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
    # 线程元数据(2026-09-20 批 47,对标 codex ThreadMetadataPatch):自由 KV,
    # thread/metadata patch 更新;store 持久化同字段(merge=False 整写)
    metadata: dict[str, Any] = field(default_factory=dict)
    # 下轮一次性配置(2026-09-20 批 48,对标 codex turn/settings/update):turn.settings
    # 写入,下一轮 _run_prompt_turn 在 frozen_context 刷新后 merge 进去并清空(一次性
    # 消费);实现"下轮生效、不拒绝 running"。键空间与 frozen_context 一致。
    pending_turn_settings: dict[str, Any] | None = None
    # token 预算(2026-09-18 第三批,对标 Codex TokenBudget/RolloutBudget):
    # 跨回合累计 session_tokens_used,达到 token_budget 即拒起新轮
    token_budget: int | None = None
    session_tokens_used: int = 0
    # AGENTS.md 模型可见状态机(2026-09-20 批58,对标 codex agents_md.rs):
    # 按 thread 持有,内容变更/删除经 maybe_fragment 增量通知,避免重复注入。
    agents_md_state: AgentsMdState = field(default_factory=AgentsMdState)
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
    # shell 环境快照路径(2026-09-20 批 55 接线,对标 Codex shell_snapshot.rs
    # 复用语义):thread.start 后台预热捕获,unified_exec 新建 POSIX 会话时
    # source 注入 + 环境合并;None=尚未就绪/捕获失败(静默降级不阻塞)。
    shell_snapshot_path: str | None = None
    shell_snapshot_task: Any | None = None
    # Turn Timing(2026-09-18 第四批,对标 Codex turn_timing):最近一轮起止
    last_turn_timing: dict[str, Any] | None = None
    # 工作区文件监视(2026-09-18 第七批,对标 Codex file-watcher):
    # 开启后扫描工作区变更并经 workspace.changed 事件推送(去抖聚合)
    watch_workspace: bool = False
    # 回合净 diff 跟踪器(2026-09-19 第四十一批接线,对标 Codex TurnDiffTracker):
    # 补丁提交时累计净变更,inexact 即整体失效;turn.diff 优先取净 diff
    turn_diff_tracker: Any = None
    # 批58(接线):retained context 宿主事实账本(对标 codex retained_context.rs)。
    # 默认 None(off,零行为变化);IHUI_RETAINED_CONTEXT_ENABLED=1 时每轮记录
    # 已投递用户指令,压缩不过期它们,指令边界回滚才清除。
    retained_context: RetainedContext | None = None
    # 批58(接线):线程来源(originator)解析结果(对标 codex thread_manager.rs)。
    # 默认 None(off,零行为变化);ENGINE_THREAD_ORIGINATOR_ENABLED=on 时于线程
    # 创建/恢复处经 effective_originator_value 解析并归一挂到线程。
    originator: str | None = None
    # 角色 id(2026-09-26 V3 #47 第二格):JWT payload 的 roleId,由承载层在**已验证身份**
    # 处写入(routers/engine.py::_bind_principal 与 _persist/_restore 的 metadata 同字段),
    # 客户端自述值一律被覆盖 —— 否则"谎报 role=1"就是新的提权面。
    # 默认 0 = fail-closed:取不到角色一律按普通用户处理,与 mcp_server 角色矩阵同档。
    # 它经 _spec(thread) 落到 AgentLoopV2(user_role=…),使"谁有权执行 admin 专属能力"
    # 在 A/B/C 三条执行内核里给出同一个答案。
    role_id: int = 0
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


# 批58(十五):工具审批策略 → codex AskForApproval 档位映射(对标 exec_policy.rs)。
# ihui 值域 never/on-request/always;未配置等价"按需询问"(ON_REQUEST)。
_APPROVAL_POLICY_TO_ASK: dict[str, str] = {
    "never": "never",
    "on-request": "on_request",
    "always": "unless_trusted",
}


def _unmatched_command_decision_meta(
    policies: dict[str, str], tool_name: str
) -> dict[str, Any]:
    """危险命令拦截回执的审批决策矩阵(对标 codex render_decision_for_unmatched_command)。

    接线面:命令已命中危险分类器硬门(拦截行为不变),本函数只把"拦截背后的策略
    语义"结构化进回执——
    - decision: allow/prompt/forbidden(危险命令恒非 allow);
    - approval_policy:生效策略档位;
    - policy_reason:策略层禁止提示时的 codex 原文(如 never 档的 PROMPT_CONFLICT_REASON)。

    任何异常/未知档位 → 返回空 dict(回执与接线前逐零差异),绝不放松拦截。
    """
    try:
        from app.core.exec_policy_decision import (
            AskForApproval,
            Decision,
            GranularApproval,
            SandboxKind,
            UnmatchedCommandContext,
            prompt_is_rejected_by_policy,
            render_decision_for_unmatched_command,
        )

        raw = _resolve_approval_policy(dict(policies or {}), tool_name) or ""
        policy = AskForApproval(
            _APPROVAL_POLICY_TO_ASK.get(str(raw).strip().lower(), "on_request")
        )
        decision = render_decision_for_unmatched_command(
            True,
            UnmatchedCommandContext(
                approval_policy=policy,
                granular=GranularApproval(),
                sandbox_kind=SandboxKind.RESTRICTED,
            ),
        )
        meta: dict[str, Any] = {
            "decision": Decision(decision).value,
            "approval_policy": policy.value,
        }
        if decision is Decision.FORBIDDEN:
            reason = prompt_is_rejected_by_policy(policy, True)
            if reason:
                meta["policy_reason"] = reason
        return meta
    except Exception:  # noqa: BLE001 - 决策面失败绝不影响拦截本体
        return {}


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
    "web_search",
    "new_context",
    "clock_sleep",
    "clock_curr_time",
    "send_message_to_user_async",
    "request_user_input_async",
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


def _is_v4a_patch(patch_text: str) -> bool:
    """判别 codex V4A 补丁格式(*** Begin Patch)。"""
    return "*** Begin Patch" in patch_text


def _preclean_patch_text(patch_text: str) -> tuple[str, list[str]]:
    """补丁文本宽松预处理(2026-09-18 第十四批:工程体验)。

    模型实际输出几乎不可能干净——常见:markdown 围栏(```/```diff/```patch/
    ~~~)、围栏前后的说明文字、"补丁如下:"之类前言、CRLF 混排、结尾缺
    End Patch。Codex 对 gpt-4.1 也有专门的 lenient 模式(PARSE_IN_STRICT_MODE=
    false),此处等价工程化:
    - 剥掉围栏行(仅去围栏标记行本身,不动内容)
    - 丢弃首个真实标记(Begin Patch / --- / diff --git)之前的散文行
    - 统一 CRLF→LF
    返回 (清洗后文本, notes),notes 记录做了哪些宽容处理(便于回执可观测)。
    """
    notes: list[str] = []
    raw_lines = patch_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    def _is_fence(line: str) -> bool:
        s = line.strip()
        return s.startswith("```") or s.startswith("~~~")

    cleaned: list[str] = []
    fence_seen = False
    for line in raw_lines:
        if _is_fence(line):
            fence_seen = True
            continue
        cleaned.append(line)
    if fence_seen:
        notes.append("已剥离 markdown 围栏")

    # 丢弃首个真实标记之前的散文/说明行
    start = 0
    for idx, line in enumerate(cleaned):
        s = line.strip()
        if s == "*** Begin Patch" or s.startswith("--- ") or s.startswith("diff --git"):
            start = idx
            break
    else:
        start = 0
    if start > 0:
        notes.append(f"已忽略补丁前的 {start} 行说明文字")
        cleaned = cleaned[start:]

    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    return "\n".join(cleaned), notes


def _parse_v4a_patch(
    patch_text: str, notes: list[str] | None = None
) -> list[dict[str, Any]]:
    """解析 codex V4A 补丁(*** Begin Patch 语法,2026-09-18 第九批)。

    语法(Lark 文法,取自 codex-rs apply-patch/src/parser.rs):
      hunk: Add File / Delete File / Update File(+可选 Move to)
      change: (@@ anchor)? (context ' ' | '+' | '-') 行;*** End of File 锚定 EOF
    输出与 _parse_unified_patch 同构的文件段列表(便于共用落盘通道):
      hunks[i]["lines"] 元素为 (tag, text),tag ∈ {' ', '+', '-'}。
    """
    # 宽松预处理(围栏/前言/CRLF)+ shell 包装(apply_patch <<'EOF' ... EOF)
    cleaned, clean_notes = _preclean_patch_text(patch_text)
    if notes is not None:
        notes.extend(clean_notes)
    raw_lines = cleaned.split("\n")
    if raw_lines and raw_lines[0].strip().startswith("apply_patch"):
        raw_lines.pop(0)
        if raw_lines and raw_lines[-1].strip() == "EOF":
            raw_lines.pop()
        if notes is not None:
            notes.append("已剥离 apply_patch shell 包装")

    start_idx: int | None = None
    for i, line in enumerate(raw_lines):
        if line.strip() == "*** Begin Patch":
            start_idx = i + 1
            break
    if start_idx is None:
        raise ValueError("V4A 补丁首段缺失 *** Begin Patch")

    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    chunk: dict[str, Any] | None = None
    seen_end = False
    for lineno, raw in enumerate(raw_lines[start_idx:], start=start_idx + 1):
        stripped = raw.strip()
        if stripped == "*** End Patch":
            seen_end = True
            break
        if raw == "":
            continue  # 真·空行(含补丁尾随换行)宽容跳过;内容空行须显式 ' ' 前缀
        if stripped.startswith("*** Add File: "):
            current = {
                "format": "v4a",
                "old_path": "/dev/null",
                "new_path": stripped[len("*** Add File: "):].strip(),
                "hunks": [{"lines": [(" ", "")]}],
                "add_lines": [],
                "_lineno": lineno,
            }
            sections.append(current)
            chunk = None
            continue
        if stripped.startswith("*** Delete File: "):
            current = {
                "format": "v4a",
                "old_path": stripped[len("*** Delete File: "):].strip(),
                "new_path": "/dev/null",
                "hunks": [],
                "_lineno": lineno,
            }
            sections.append(current)
            chunk = None
            continue
        if stripped.startswith("*** Update File: "):
            current = {
                "format": "v4a",
                "old_path": stripped[len("*** Update File: "):].strip(),
                "new_path": None,  # Move to 决定;缺省同 old_path
                "chunks": [],
                "_lineno": lineno,
            }
            sections.append(current)
            chunk = None
            continue
        if stripped.startswith("*** Move to: "):
            if current is None or "chunks" not in current:
                raise ValueError(f"第 {lineno} 行: *** Move to 必须跟随 Update File")
            current["new_path"] = stripped[len("*** Move to: "):].strip()
            continue
        if stripped == "*** End of File":
            if chunk is None:
                raise ValueError(f"第 {lineno} 行: *** End of File 必须位于 Update File 块内")
            chunk["eof"] = True
            continue
        if current is not None and "add_lines" in current:
            # Add File 段:所有内容行以 '+' 前缀
            if not stripped.startswith("+"):
                raise ValueError(
                    f"第 {lineno} 行: Add File 内容行须以 '+' 开头,得到: {raw!r}"
                )
            current["add_lines"].append(raw[1:])
            continue
        if current is not None and "chunks" in current:
            if stripped.startswith("@@"):
                chunk = {
                    "anchor": stripped[2:].strip() or None,
                    "lines": [],
                    "eof": False,
                }
                current["chunks"].append(chunk)
                continue
            if raw[:1] in ("+", "-", " "):
                # 内容行必须看原始行:上下文标记就是行首空格,strip 会吃掉
                if chunk is None:
                    chunk = {"anchor": None, "lines": [], "eof": False}
                    current["chunks"].append(chunk)
                chunk["lines"].append((raw[0], raw[1:]))
                continue
            if stripped == "":
                continue  # 空行宽容跳过
            raise ValueError(f"第 {lineno} 行: 无法识别的 V4A 行: {raw!r}")
        if stripped.startswith("***"):
            raise ValueError(f"第 {lineno} 行: 未知 V4A 标记: {stripped}")
        # Add File 段之前的散行 → 非法
        if current is None and stripped:
            raise ValueError(f"第 {lineno} 行: *** Begin Patch 后出现游离内容: {raw!r}")
    if not seen_end:
        # 未闭合 = 可能被截断,应用半截补丁会写坏文件:严格拒绝 + 可操作提示
        # (对标 Codex 对 End Patch 的强校验;此处额外给出修复指引,属体验优化)
        raise ValueError(
            "V4A 补丁缺失 *** End Patch 结束标记(可能输出被截断),未做任何修改;"
            "请重新生成完整补丁并确保以 '*** End Patch' 结尾"
        )
    # 校验 + 归一化
    normalized: list[dict[str, Any]] = []
    for sec in sections:
        if sec["old_path"] == "/dev/null":
            if not sec.get("add_lines"):
                raise ValueError(
                    f"第 {sec['_lineno']} 行: Add File 段至少需要一行 '+' 内容"
                )
            normalized.append(
                {
                    "old_path": "/dev/null",
                    "new_path": sec["new_path"],
                    "hunks": [{"lines": [("+", t) for t in sec["add_lines"]]}],
                }
            )
        elif sec["new_path"] == "/dev/null":
            normalized.append({"old_path": sec["old_path"], "new_path": "/dev/null", "hunks": []})
        else:
            if not sec.get("chunks"):
                raise ValueError(f"第 {sec['_lineno']} 行: Update File 段内容为空")
            normalized.append(
                {
                    "old_path": sec["old_path"],
                    "new_path": sec["new_path"] or sec["old_path"],
                    "hunks": sec["chunks"],
                }
            )
    return normalized


def _aggregate_unified_diff(
    diff_pairs: dict[str, tuple[str | None, str | None]],
) -> str:
    """按路径聚合 unified diff(对标 Codex TurnDiffTracker 的 unified_diff 输出)。

    diff_pairs: rel → (旧内容|None=新增, 新内容|None=删除)。
    """
    parts: list[str] = []
    for rel in sorted(diff_pairs):
        old, new = diff_pairs[rel]
        old_lines = (old or "").splitlines(keepends=True)
        new_lines = (new or "").splitlines(keepends=True)
        diff = "".join(
            difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile=f"a/{rel}",
                tofile=f"b/{rel}",
            )
        )
        if diff:
            parts.append(diff)
    return "\n".join(parts)


def _suggest_close(target: str, candidates: list[str], limit: int = 3) -> list[str]:
    """近似候选推荐(did-you-mean),用于「未知方法/未知工具」的可纠错回执。

    两级判定:
    1) 标准化后精确命中 —— 大小写、`_`↔`.`、前导 `/` 差异(thread_start /
       Thread.Start / /thread.start 都能命中 thread.start);
    2) difflib 模糊匹配取 Top-N(阈值 0.6,避免给出误导性推荐)。

    返回值不含 candidate 本身之外的任何猜测项:匹配不上即返回空列表,由调用方
    决定是否回退为全量清单。
    """
    import difflib as _dl

    def _norm(s: str) -> str:
        return s.strip().lower().replace("_", ".").lstrip("/")

    norm_t = _norm(target)
    if not norm_t:
        return []
    norm_map = {_norm(c): c for c in candidates}
    if norm_t in norm_map:
        return [norm_map[norm_t]]
    scored = sorted(
        ((_dl.SequenceMatcher(None, norm_t, _norm(c)).ratio(), c) for c in candidates),
        key=lambda x: (-x[0], x[1]),
    )
    return [c for ratio, c in scored[:limit] if ratio >= 0.6]


def _v4a_seek(
    lines: list[str], pattern: list[str], start: int, eof: bool
) -> int:
    """codex seek_sequence 等价:从 start 向前查找 pattern;eof=True 时锚定文件尾。"""
    n = len(pattern)
    if n == 0:
        return start
    if eof:
        if len(lines) >= n and lines[-n:] == pattern:
            return len(lines) - n
        return -1
    for i in range(start, len(lines) - n + 1):
        if lines[i : i + n] == pattern:
            return i
    return -1


class _PatchAlreadyApplied(Exception):
    """补丁内容已存在于文件中(幂等重复应用)。

    判定依据:期望的旧行序列在文件中不存在,而期望的新行序列已完整存在。
    此时不应报「上下文失配」让模型反复重试同一补丁,而应明确告知已应用。
    """


def _diagnose_patch_mismatch(
    lines: list[str],
    pattern: list[str],
    replacement: list[str] | None,
    rel: str,
    where: str,
) -> str:
    """补丁上下文失配时生成可自纠的诊断信息(体验优化)。

    除「未找到」外额外给出:文件总行数、最接近位置(行号 + 相似度)、
    首个差异行的期望/实际对照、以及常见成因提示(空白/缩进/已改动)。
    """
    import difflib as _dl

    head = f"{rel}: {where}:上下文失配,期望行序列未找到(文件共 {len(lines)} 行)"
    if not pattern:
        return head
    n = len(pattern)
    best_i = -1
    best_ratio = 0.0
    step = max(1, len(lines) // 400)  # 大文件采样,避免 O(n·m) 卡顿

    def _line_similarity(a: str, b: str) -> float:
        """单行字符级相似度(整行相等比较会让「差几个字符」的近失配恒为 0)。"""
        if a == b:
            return 1.0
        if not a or not b:
            return 0.0
        return _dl.SequenceMatcher(None, a, b).ratio()

    for i in range(0, max(1, len(lines) - n + 1), step):
        window = lines[i : i + n]
        # strict=False:文件尾部采样时 window 可能短于 pattern,保持 zip 截断语义(B905)
        ratio = sum(_line_similarity(p, w) for p, w in zip(pattern, window, strict=False)) / n
        if ratio > best_ratio:
            best_ratio, best_i = ratio, i
    detail = ""
    if best_i >= 0 and best_ratio >= 0.5:
        actual = lines[best_i : best_i + n]
        diff_line = ""
        for k in range(n):
            if k < len(actual) and actual[k] != pattern[k]:
                diff_line = (
                    f"\n  最接近处第 {best_i + k + 1} 行:"
                    f"\n    期望: {pattern[k]!r}"
                    f"\n    实际: {actual[k]!r}"
                )
                break
        detail = (
            f"\n  最接近位置:第 {best_i + 1} 行(相似度 {best_ratio:.2f})"
            + diff_line
        )
    causes: list[str] = []
    near = lines[best_i : best_i + n] if best_i >= 0 else []
    if near and any(
        p.strip() == a.strip() and p != a for p, a in zip(pattern, near, strict=False)
    ):
        causes.append("仅行首/行尾空白不同(缩进或尾随空格被裁剪/多出)")
    elif near and any(
        p.rstrip() == a.rstrip() for p, a in zip(pattern, near, strict=False)
    ):
        causes.append("缩进层级不一致")
    if replacement is not None and _v4a_seek(lines, replacement, 0, False) >= 0:
        causes.append("目标内容已在文件中(可能本次改动早已应用)")
    if not causes:
        causes.append("文件这部分内容已被上一轮改动或人工编辑修改")
    return (
        head
        + detail
        + "\n  期望内容:\n    "
        + "\n    ".join(repr(p) for p in pattern[:12])
        + "\n  可能原因: "
        + "、".join(causes[:3])
        + "\n  建议: read_file 重读该文件最新内容后重新生成补丁"
    )


def _read_source_preserving(path: Any) -> tuple[str, str, bool]:
    """读取源文件并保留换行风格与 BOM(Windows 仓库细节)。

    返回 (规范化为 \\n 的文本, 原换行符, 是否有 UTF-8 BOM)。写回时按
    原风格还原,避免给 CRLF 文件打补丁后整文件被悄悄改成 LF(或丢 BOM)。
    """
    raw = path.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    if bom:
        raw = raw[3:]
    text = raw.decode("utf-8", errors="replace")
    newline = "\r\n" if "\r\n" in text else "\n"
    return text.replace("\r\n", "\n"), newline, bom


def _write_text_preserving(path: Any, text: str, newline: str, bom: bool) -> None:
    """按原换行风格与 BOM 写回文件。"""
    payload = text.replace("\n", newline) if newline == "\r\n" else text
    data = payload.encode("utf-8")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def _apply_v4a_to_content(
    content: str, chunks: list[dict[str, Any]], rel: str
) -> str:
    """按 codex file_update.rs 语义把 V4A chunks 应用到文件内容。

    顺序扫描(line_index 只前进):@@ anchor 先定位,再匹配 old_lines
    (context + '-' 行);失配抛 ValueError 定位到 chunk 序号。
    """
    lines = content.split("\n")
    # 末尾换行产生的空元素与 diff 语义对齐,移除后由写回时补回
    trailing_newline = lines[-1] == "" if lines else False
    if trailing_newline:
        lines.pop()
    line_index = 0
    applied_count = 0
    already_count = 0
    for ci, chunk in enumerate(chunks, start=1):
        anchor = chunk.get("anchor")
        if anchor:
            found_anchor = _v4a_seek(lines, [anchor], line_index, False)
            if found_anchor < 0:
                # 锚点自身也可能因「已应用」而消失(锚点是被替换的旧行);
                # 此时不急着报错,交给后续 old/new 序列判定
                if _v4a_seek(lines, [anchor], 0, False) < 0:
                    raise ValueError(
                        _diagnose_patch_mismatch(
                            lines, [anchor], None, rel, f"第 {ci} 个代码块 @@ 锚点"
                        )
                    )
                line_index = 0
            else:
                line_index = found_anchor + 1
        old_lines = [t for tag, t in chunk["lines"] if tag in (" ", "-")]
        new_lines = [t for tag, t in chunk["lines"] if tag in (" ", "+")]
        if not old_lines:
            # 纯插入:扫描位之后插入(anchor 已让 line_index 越过锚点;
            # eof 标记则插到文件尾)
            insert_at = len(lines) if chunk.get("eof") else line_index
            lines[insert_at:insert_at] = new_lines
            line_index = insert_at + len(new_lines)
            continue
        pattern = list(old_lines)
        replacement = list(new_lines)
        found = _v4a_seek(lines, pattern, line_index, chunk.get("eof", False))
        if found < 0 and pattern and pattern[-1] == "":
            # codex 兼容:结尾空串是「被替换区终止换行」哨兵,重试剔除
            pattern.pop()
            if replacement and replacement[-1] == "":
                replacement.pop()
            found = _v4a_seek(lines, pattern, line_index, chunk.get("eof", False))
        if found < 0:
            # 幂等:旧序列不在、新序列却已完整存在 → 该代码块本次之前已应用
            if replacement and _v4a_seek(lines, replacement, 0, False) >= 0:
                already_count += 1
                hit = _v4a_seek(lines, replacement, 0, False)
                line_index = hit + len(replacement)
                continue
            raise ValueError(
                _diagnose_patch_mismatch(
                    lines,
                    pattern,
                    replacement,
                    rel,
                    f"第 {ci} 个代码块",
                )
            )
        lines[found : found + len(pattern)] = replacement
        line_index = found + len(replacement)
        applied_count += 1
    if applied_count == 0 and already_count > 0:
        raise _PatchAlreadyApplied(
            f"{rel}: 补丁内容已存在(幂等跳过,未重复修改)"
        )
    result = "\n".join(lines)
    if trailing_newline:
        result += "\n"
    return result


def _parse_unified_patch(
    patch_text: str, notes: list[str] | None = None
) -> list[dict[str, Any]]:
    """解析标准 unified diff(git diff 兼容)为文件段列表。

    支持:新增文件(--- /dev/null)/ 删除文件(+++ /dev/null)/ 多 hunk 更新
    (含上下文行 + 新增行 + 删除行)。返回 [{old_path, new_path, hunks: [
    {old_start, old_lines, lines: [(tag, text)]}]}];无合法文件段 → ValueError。

    第十四批起:先经 _preclean_patch_text 宽松预处理(围栏/前言/CRLF),
    notes 非空时由调用方回写宽容处理记录。
    """
    import re as _re

    cleaned, clean_notes = _preclean_patch_text(patch_text)
    if notes is not None:
        notes.extend(clean_notes)
    lines = cleaned.splitlines()
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


def _model_hash(model: str | None) -> str:
    """模型标识的稳定短哈希(对标 Codex CompactionCheckpoint 的 model_hash)。

    空模型名返回空串(表示"来源未知",判定时按兼容处理而非阻断)。
    """
    if not model:
        return ""
    return hashlib.sha1(model.strip().lower().encode("utf-8")).hexdigest()[:16]


def _compaction_compatible(summary_model: str | None, current_model: str | None) -> bool:
    """压缩摘要与当前模型是否兼容(第十八批,对标 Codex is_compatible_with)。

    - 任一侧缺失(旧数据没有 model 字段 / 当前模型未知)→ 视为兼容:保守
      处理,不因为信息缺失而阻断 resume;
    - 两侧都有:要求 hash 相等。摘要由前一个模型生成,换模型继续复用会把
      前模型的表述与隐含假设带进新模型的上下文(语义漂移)。
    """
    if not summary_model or not current_model:
        return True
    return _model_hash(summary_model) == _model_hash(current_model)


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
    applied_count = 0
    already_count = 0
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
            # 幂等:期望的旧序列不在,但期望的新序列已完整存在 → 该 hunk 已应用
            already_at = (
                _v4a_seek(src, expect_new, 0, False) if expect_new else -1
            )
            if already_at >= 0:
                already_count += 1
                out.extend(src[pos:already_at])
                out.extend(expect_new)
                pos = already_at + len(expect_new)
                continue
            raise ValueError(
                _diagnose_patch_mismatch(
                    src,
                    expect_old,
                    expect_new,
                    rel_path,
                    f"hunk #{idx + 1}(声明行 {hunk['old_start']})",
                )
            )
        out.extend(src[pos:found])
        out.extend(expect_new)
        pos = found + len(expect_old)
        applied_count += 1
    out.extend(src[pos:])
    if applied_count == 0 and already_count > 0:
        raise _PatchAlreadyApplied(
            f"{rel_path}: 补丁内容已存在(幂等跳过,未重复修改)"
        )
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


def _coerce_role_id(value: Any) -> int:
    """把请求/元数据里的角色字段归一为非负整数,**取不到即 0**(fail-closed)。

    之所以不 raise:`roleId` 从来不是客户端该填的字段 —— 承载层(routers/engine.py)
    在鉴权之后无条件覆盖它。走到"值不合型"只有两种可能(未鉴权通道 / 历史元数据),
    两者的正确处置都是按普通用户处理,而不是拒绝起线程(那会把没鉴权通道变成
    "拒绝服务"的新故障面)。真值由 call_tool 的角色矩阵与 loop 的 `_role_denied_name`
    各自再判一次,不靠这里放行。
    """
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value if value >= 0 else 0
    if isinstance(value, str) and value.strip().isdigit():
        return max(0, int(value.strip()))
    return 0


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
        # V3 #47 第二格:角色随身份一起过桥,承载层工厂据此喂 AgentLoopV2(user_role=…)
        "role_id": thread.role_id,
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
        # 2026-09-18 第七批(compact_remote 对标):LLM 摘要器,thread.compact
        # strategy="llm" 时用;async (text: str) -> str。未注入时 llm 策略报错。
        llm_summarizer: Callable[[str], Awaitable[str]] | None = None,
    ) -> None:
        self._loop_factory = loop_factory
        self._tool_lister = tool_lister
        self._cost_report = cost_report
        self._model_lister = model_lister
        self._injected_bus = hook_bus
        self._llm_summarizer = llm_summarizer
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
        # shell 环境快照缓存(2026-09-20 批 55 接线,对标 Codex
        # ShellSnapshotCache/environment_selection.rs):session_id → ShellSnapshotFile。
        # thread.start 后台预热,unified_exec 新建 POSIX 会话时消费;失败静默降级。
        self._shell_snapshots: dict[str, Any] = {}
        self._shell_snapshot_tasks: dict[str, asyncio.Task[None]] = {}
        # run_code 常驻代码会话(2026-09-18 第六批,对标 Codex code-mode cell)
        self._code_sessions: dict[str, dict[str, Any]] = {}
        # 工作区文件监视器(2026-09-18 第七批,对标 Codex file-watcher)
        self._workspace_watchers: dict[str, asyncio.Task[None]] = {}
        # 连接级文件监视订阅(2026-09-20 批 50,对标 codex fs/watch):
        # watchId → 扫描任务,与线程级 _workspace_watchers 互不相干
        self._fs_watchers: dict[str, asyncio.Task[None]] = {}
        # 批58 接线:文件变更事件路由器(纯路由层,惰性创建;off 时恒为 None)
        self._file_watcher_router: Any = None
        # 批58 接线:集中式特性开关注册表(模块5,对标 codex features crate)。
        # 注册已知特性(含本批各 env 开关);off 时引擎不咨询注册表,判定路径与
        # 现状逐字节一致;on 时经注册表解析生效集(见 _resolve_engine_features)。
        self._feature_registry: Any = self._build_feature_registry()
        # 安装实例 ID 读取目录(模块3,read-only;不写文件)。
        # 仅当配置 IHUI_INSTALLATION_ID_DIR 且文件存在时才纳入 telemetry;否则跳过。
        self._installation_id_dir: str | None = os.environ.get("IHUI_INSTALLATION_ID_DIR")
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
            "thread.list": self._handle_thread_list,
            "thread.archive": self._handle_thread_archive,
            "thread.fork": self._handle_thread_fork,
            "thread.revert": self._handle_thread_revert,
            "turn.steer": self._handle_turn_steer,
            "thread.name": self._handle_thread_name,
            "thread.delete": self._handle_thread_delete,
            "thread.queue.list": self._handle_thread_queue_list,
            "thread.queue.delete": self._handle_thread_queue_delete,
            "thread.queue.reorder": self._handle_thread_queue_reorder,
            "thread.search": self._handle_thread_search,
            "thread.items.list": self._handle_thread_items_list,
            "thread.turns.list": self._handle_thread_turns_list,
            "thread.read": self._handle_thread_read,
            "thread.metadata": self._handle_thread_metadata,
            "memory.status": self._handle_memory_status,
            "memory.reset": self._handle_memory_reset,
            "fs.watch": self._handle_fs_watch,
            "fs.unwatch": self._handle_fs_unwatch,
            "thread.settings": self._handle_thread_settings,
            "turn.settings": self._handle_turn_settings,
            "thread.loaded.list": self._handle_thread_loaded_list,
            "thread.unsubscribe": self._handle_thread_unsubscribe,
            "model.list": self._handle_models_list,
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
            # 可纠错回执(体验优化):先给最近似的方法名,再附全量清单兜底
            supported = sorted(self._handlers)
            suggestions = _suggest_close(method, supported)
            message = f"未知方法: {method}"
            if suggestions:
                message += f"。是否想调用: {' / '.join(suggestions)}"
            else:
                message += f"。可用方法: {', '.join(supported)}"
            return _error_response(
                req_id,
                METHOD_NOT_FOUND,
                message,
                {"supported": supported, "suggestions": suggestions},
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
                    # 角色与属主同字段族落库,使"重启恢复的线程"不静默降回 role 0
                    # (那是权限漂移;仍按 fail-closed 还原 —— 值不合型即 0)
                    "roleId": thread.role_id,
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
            turn = store.start_turn(
                thread.thread_id,
                metadata={
                    "model": thread.model,
                    # 批57(对标 Codex sandbox_tags.rs record_policy_metadata):
                    # turn 元数据持久化策略强度诊断标签——仅供诊断/观测,
                    # 绝不用于授权判定。引擎未接平台沙箱后端,标签按只读
                    # 策略面推导,语义与 codex detached 请求一致。
                    **(
                        {
                            "sandbox_mode": _sandbox_mode_tag(
                                thread.workspace or ""
                            )
                        }
                        if (_sandbox_mode_tag := _make_sandbox_mode_tagger()) is not None
                        else {}
                    ),
                },
            )
            from .session_store import UserMessageItem

            store.append_item(
                turn.turn_id, UserMessageItem(content=user_text), thread_id=thread.thread_id
            )
            # 批58:宿主历史账本追加(需同时开开关并配路径;失败仅告警)
            if _engine_message_history_enabled_from_env():
                hist_path = os.environ.get("IHUI_MESSAGE_HISTORY_PATH", "").strip()
                if hist_path:
                    try:
                        from app.core.message_history import append_history

                        append_history(
                            Path(hist_path), thread.session_id or thread.thread_id, user_text
                        )
                    except Exception as e:  # noqa: BLE001 - 账本失败不阻断持久化
                        logger.warning("[engine] message_history 追加失败(降级跳过): %s", e)
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
                permission_mode=_require_permission_mode(md.get("permissionMode")),
                max_iterations=int(md.get("maxIterations") or 8),
                tool_names=list(md["toolNames"]) if isinstance(md.get("toolNames"), list) else None,
                workspace=md.get("workspace") if isinstance(md.get("workspace"), str) else None,
                user_id=md.get("userId") if isinstance(md.get("userId"), str) else None,
                # 角色随属主一起从元数据还原;缺失/不合型 → 0(fail-closed,见 _coerce_role_id)
                role_id=_coerce_role_id(md.get("roleId")),
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
            # 批58(接线):线程来源 originator 恢复(模块2)。off → None;on →
            # 优先取持久化 metadata 中的 originator,否则按现来源默认。
            if _engine_thread_originator_enabled_from_env():
                try:
                    persisted = (
                        str(md["originator"])
                        if isinstance(md.get("originator"), str)
                        else None
                    )
                    svc = (
                        str(md["serviceName"])
                        if isinstance(md.get("serviceName"), str)
                        else None
                    )
                    thread.originator = effective_originator_value(
                        originator_from_service_name(svc) if svc else None,
                        None,
                        persisted,
                        None,
                        "ihui_engine",
                    )
                except Exception as e:  # noqa: BLE001 - 恢复失败降级不挂
                    logger.warning("thread originator 恢复失败(降级跳过): %s", e)
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
        resp: dict[str, Any] = {
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
                "threadLifecycle": True,
                "fileWatcher": True,
                "procSandbox": True,
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
        # 批58 接线:集中式特性开关注册表(模块5,对标 codex features crate)。
        # off 时不咨询注册表(判定路径与现状逐字节一致);on 时把解析生效集经
        # capabilities.featureFlags 暴露给客户端(仅 on 时新增该键)。
        if _engine_feature_flags_enabled_from_env():
            flags = self._resolve_engine_features()
            if flags:
                resp["capabilities"]["featureFlags"] = flags
        return resp

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
        # 文件监视(2026-09-18 第七批,对标 Codex file-watcher)
        watch_workspace = bool(params.get("watchWorkspace"))
        # 角色模板追加进 system(对标 Codex agent-roles 全程可见语义)
        if role is not None:
            messages[0]["content"] = (
                f"{messages[0]['content']}\n\n[角色模板] {_AGENT_ROLE_TEMPLATES[role]}"
            )
        # 项目文档注入(2026-09-19 第二十八批,对标 Codex agents_md.rs discovery):
        # 实际注入逻辑见 _inject_agents_md(批58 状态机增量注入开关);thread 构造后调用。
        _agents_workspace = params.get("workspace")
        thread = EngineThread(
            thread_id=thread_id,
            session_id=str(params.get("sessionId") or thread_id),
            model=params.get("model") if isinstance(params.get("model"), str) else None,
            permission_mode=_require_permission_mode(params.get("permissionMode")),
            max_iterations=int(params.get("maxIterations") or 8),
            tool_names=list(tool_names) if isinstance(tool_names, list) else None,
            workspace=params.get("workspace")
            if isinstance(params.get("workspace"), str)
            else None,
            # userId 已在承载层被绑定为已验证身份(routers/engine.py::_bind_principal)
            user_id=params.get("userId") if isinstance(params.get("userId"), str) else None,
            # roleId 同样在承载层被无条件覆盖为令牌里的 roleId(routers/engine.py::_bind_principal)
            # —— 客户端自述的 role 在这里结构上不可能是真值;取不到即 0(fail-closed)。
            role_id=_coerce_role_id(params.get("roleId")),
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
            watch_workspace=watch_workspace,
            messages=messages,
        )
        self._threads[thread_id] = thread
        # 批58(接线):线程来源 originator 解析(模块2,对标 codex thread_manager.rs)。
        # off → None(零行为变化);on → 经 effective_originator_value 解析并挂到 thread。
        if _engine_thread_originator_enabled_from_env():
            try:
                thread.originator = effective_originator_value(
                    str(params["serviceName"])
                    if isinstance(params.get("serviceName"), str)
                    else None,
                    str(params["originator"])
                    if isinstance(params.get("originator"), str)
                    else None,
                    None,
                    None,
                    "ihui_engine",
                )
            except Exception as e:  # noqa: BLE001 - 解析失败降级不挂
                logger.warning("thread originator 解析失败(降级跳过): %s", e)
        # 批58(接线):retained context 宿主事实账本(对标 codex retained_context.rs)。
        # off → None(零行为变化);on → 线程持有账本,每轮记录已投递用户指令。
        if os.environ.get("IHUI_RETAINED_CONTEXT_ENABLED", "false").strip().lower() in (
            "on", "1", "true", "yes",
        ):
            try:
                thread.retained_context = RetainedContext()
            except Exception as e:  # noqa: BLE001 - 构造失败降级不启用
                logger.warning("retained_context 构造失败(降级不启用): %s", e)
        # 项目文档注入(批58 状态机增量注入开关):开关 off 时与原纯字符串拼接逐字节等价。
        self._inject_agents_md(thread)
        # 固化起始请求的出站通道:workspace watcher 等引擎自产事件在无活动
        # prompt 时也有推送目标(prompt 轮内会被 _run_prompt_turn 刷新)。
        thread.emit = emit
        # Turn Context 冻结:首份快照(此后每轮 prompt 刷新,resume 用冻结副本)
        thread.frozen_context = self._freeze_context(thread)
        self._persist_thread_created(thread)
        if watch_workspace:
            self._start_workspace_watcher(thread)
        # shell 快照后台预热(2026-09-20 批 55 接线,对标 ShellSnapshotTask):
        # unified_exec 首次调用前捕获好用户登录环境;失败静默降级
        self._start_shell_snapshot_prewarm(thread)
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
            "watchWorkspace": thread.watch_workspace,
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
        # 批58(接线):retained context 记录(对标 codex retained_context.rs)。
        # 每轮把已投递用户指令存入宿主账本(模型不可见;压缩不过期,指令边界
        # 回滚才清除)。off/None/异常均零行为变化,不阻塞回合。
        if thread.retained_context is not None and text.strip():
            try:
                thread.retained_context.record_user_message(
                    RetainedUserMessage(
                        turn_id=thread.current_turn_id or str(uuid.uuid4().hex),
                        message_id=f"{thread.thread_id}:{int(turn_started_at * 1000)}",
                        text=text,
                        complete=True,
                    )
                )
            except Exception as e:  # noqa: BLE001 - 记录失败降级跳过
                logger.warning("retained_context 记录失败(降级跳过): %s", e)
        before_files = await self._workspace_dirty_files(thread)
        # 非 git 工作区兜底:回合前 mtime 快照(第十四批,对标 Codex 在无 git
        # 仓库下仍能给出回合变更清单;上限 2000 项,失败静默降级为空)
        before_snapshot: dict[str, float] = {}
        if thread.workspace:
            with contextlib.suppress(Exception):
                before_snapshot = self._scan_workspace(Path(thread.workspace))
        thread.messages.append({"role": "user", "content": text})
        # Turn Context 冻结:非 checkpoint 路径每轮刷新快照(客户端在轮间改配置,
        # 新一轮用新值;轮内 interrupt→resume 走 _handle_thread_resume 的冻结副本)
        thread.frozen_context = self._freeze_context(thread)
        # 下轮一次性配置(2026-09-20 批 48,对标 codex turn/settings/update):
        # pending_turn_settings 非空 → merge 进本轮冻结快照并清空(一次性消费,
        # 不进 agent_loop_v2;键空间与 frozen_context 一致,如 model/permission_mode)。
        if thread.pending_turn_settings:
            thread.frozen_context = {
                **thread.frozen_context,
                **thread.pending_turn_settings,
            }
            thread.pending_turn_settings = None
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
        if turn_id is not None:
            # 批 43:记录 user 消息索引 → turn_id 映射(thread.revert 裁剪依据)
            thread.turn_markers[len(thread.messages) - 1] = turn_id
        # TurnStarted(2026-09-18 第十批,对标 Codex TurnStarted 事件)
        with contextlib.suppress(Exception):
            await self._emit_engine_event(
                thread, emit, "turn.started", {"turnId": turn_id, "inputChars": len(text)}
            )
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
        # 第十批升级:补齐 Codex TurnDiffEvent{unified_diff} 的 diff 正文语义。
        with contextlib.suppress(Exception):
            after_files = await self._workspace_dirty_files(thread)
            after_status = await self._workspace_file_status(thread)
            changed = sorted(after_files - before_files)
            if changed:
                tracked = [f for f in changed if after_status.get(f) != "A"]
                added = [f for f in changed if after_status.get(f) == "A"]
                unified_diff = ""
                if thread.workspace and tracked:
                    proc = await asyncio.create_subprocess_exec(
                        "git",
                        "-C",
                        thread.workspace,
                        "diff",
                        "--",
                        *tracked[:50],
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    out, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
                    unified_diff = out.decode("utf-8", errors="replace")
                # 未跟踪新增文件:不用 git add -N(避免污染 index),difflib 合成
                if added and thread.workspace:
                    pairs: dict[str, tuple[str | None, str | None]] = {}
                    for rel in added[:50]:
                        try:
                            pairs[rel] = (
                                None,
                                (Path(thread.workspace) / rel).read_text(encoding="utf-8"),
                            )
                        except OSError:
                            continue
                    extra = _aggregate_unified_diff(pairs)
                    if extra:
                        unified_diff = (
                            unified_diff + ("\n" if unified_diff else "") + extra
                        )
                baseline_sha, baseline_source = await self._git_baseline(thread.workspace)
                # 批 41 接线:回合净 diff 优先取 tracker 累计值(跨多补丁净结果,
                # "中途新建又删除"不出现在 diff 中;inexact 已整体失效 → 回退 git 路径)
                _tracked_diff: str | None = None
                _tracker = thread.turn_diff_tracker
                if _tracker is not None and _tracker.valid():
                    with contextlib.suppress(Exception):
                        _tracked_diff = _tracker.get_unified_diff()
                await self._emit_engine_event(
                    thread,
                    emit,
                    "turn.diff",
                    {
                        "files": changed[:50],
                        "changes": [
                            {"path": p, "status": after_status.get(p, "M")}
                            for p in changed[:50]
                        ],
                        "truncated": len(changed) > 50,
                        "unifiedDiff": (_tracked_diff or unified_diff)[:32_000],
                        "baselineSha": baseline_sha,
                        "baselineSource": baseline_source,
                        "diffSource": "turn_tracker" if _tracked_diff else "git",
                    },
                )
            elif before_snapshot and thread.workspace:
                # 非 git 工作区:mtime 快照比对(新增/删除/修改),新增文件给
                # difflib 全文 diff;修改文件无基线内容,如实标注不伪造 diff
                after_snapshot = self._scan_workspace(Path(thread.workspace))
                added = sorted(set(after_snapshot) - set(before_snapshot))[:50]
                removed = sorted(set(before_snapshot) - set(after_snapshot))[:50]
                modified = sorted(
                    p
                    for p in set(after_snapshot) & set(before_snapshot)
                    if after_snapshot[p] != before_snapshot[p]
                )[:50]
                if added or removed or modified:
                    fb_pairs: dict[str, tuple[str | None, str | None]] = {}
                    for rel in added:
                        try:
                            fb_pairs[rel] = (
                                None,
                                (Path(thread.workspace) / rel).read_text(encoding="utf-8"),
                            )
                        except OSError:
                            continue
                    for rel in removed:
                        fb_pairs[rel] = ("", None)
                    parts = [_aggregate_unified_diff(fb_pairs)]
                    for rel in modified:
                        parts.append(
                            f"--- a/{rel}\n+++ b/{rel}\n"
                            "@@ 非 git 工作区:无基线内容,仅知文件已变更 @@"
                        )
                    changes = (
                        [{"path": p, "status": "A"} for p in added]
                        + [{"path": p, "status": "M"} for p in modified]
                        + [{"path": p, "status": "D"} for p in removed]
                    )
                    await self._emit_engine_event(
                        thread,
                        emit,
                        "turn.diff",
                        {
                            "files": added + modified + removed,
                            "changes": changes,
                            "truncated": False,
                            "unifiedDiff": "\n".join(p for p in parts if p)[:32_000],
                            "baselineSha": None,
                            "baselineSource": "mtime-snapshot",
                            "diffSource": "mtime-snapshot",
                        },
                    )
        # TurnComplete(2026-09-18 第十批,对标 Codex TurnComplete 事件)
        with contextlib.suppress(Exception):
            await self._emit_engine_event(
                thread,
                emit,
                "turn.complete",
                {
                    "turnId": turn_id,
                    "success": bool((result or {}).get("success")),
                    "durationMs": thread.last_turn_timing.get("durationMs"),
                    "totalTokensUsed": int((result or {}).get("totalTokensUsed") or 0),
                },
            )
        # Stop(第十二批,对标 Codex Stop 钩子):本轮代理工作结束
        await self._emit_hook(
            "agent.stop",
            {
                "threadId": thread.thread_id,
                "sessionId": thread.session_id,
                "turnId": turn_id,
                "success": bool((result or {}).get("success")),
                "durationMs": thread.last_turn_timing.get("durationMs"),
            },
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

    @staticmethod
    async def _workspace_file_status(thread: EngineThread) -> dict[str, str]:
        """工作区文件 git 状态映射 path → 'A'|'M'|'D'(2026-09-18 第十三条,
        对标 codex git-utils GitBaselineChangeStatus 的 git 风格状态标签)。

        解析 porcelain 的 XY 两列:'??'→新增(A)、'D'→删除(D)、其余→修改(M);
        非 git 目录/超时/失败 → 空字典静默降级。
        """
        if not thread.workspace:
            return {}
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
            return {}
        if proc.returncode != 0:
            return {}
        status_map: dict[str, str] = {}
        for line in out.decode("utf-8", errors="replace").splitlines():
            if len(line) <= 3:
                continue
            xy = line[:2]
            path = line[3:].strip().strip('"')
            if xy == "??":
                status_map[path] = "A"
            elif "D" in xy:
                status_map[path] = "D"
            else:
                status_map[path] = "M"
        return status_map

    @staticmethod
    async def _git_baseline(workspace: str | None) -> tuple[str | None, str]:
        """回合基线 commit(对标 codex git-utils merge_base_with_head)。

        优先取 HEAD 与上游分支的 merge-base(未推送改动也纳入 diff 范围),
        上游缺失或无 HEAD 时退化为 HEAD;任何失败返回 (None, 'none')。
        """
        if not workspace:
            return None, "none"
        for args, source in (
            (["merge-base", "HEAD", "@{upstream}"], "merge-base"),
            (["rev-parse", "HEAD"], "head"),
        ):
            try:
                proc = await asyncio.create_subprocess_exec(
                    "git",
                    "-C",
                    workspace,
                    *args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                out, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            except Exception:
                continue
            if proc.returncode == 0:
                sha = out.decode("utf-8", errors="replace").strip()
                if sha:
                    return sha[:40], source
        return None, "none"

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
            # turn_token_usage 直方图(批58,对标 codex state/turn_token_usage.rs):
            # 开关 on 时按模型分组聚合本轮用量并逐样本发指标事件;off 时不产生
            # 任何新事件(逐字节等价)。分桶数据取自逐迭代精确 usage,无精确
            # 分项时只用总量(不伪造分项,与 _turn_usage 同原则)。
            if _turn_token_usage_enabled_from_env():
                with contextlib.suppress(Exception):
                    from app.core.turn_token_usage import TurnTokenUsage

                    ledger = TurnTokenUsage()
                    for it in getattr(result, "iterations", []) or []:
                        # iterations 元素双形态:LoopIteration dataclass 或 dict
                        # (测试替身/历史序列化形态),统一取值。
                        if isinstance(it, dict):
                            usage = it.get("usage")
                            it_model = it.get("model")
                        else:
                            usage = getattr(it, "usage", None)
                            it_model = getattr(it, "model", None)
                        if not (isinstance(usage, dict) and usage):
                            continue
                        model = str(it_model or thread.model or "default")
                        ledger.record(
                            model,
                            telemetry={"model": model},
                            total_tokens=int(usage.get("total_tokens", 0) or 0),
                            input_tokens=int(usage.get("input_tokens", 0) or 0),
                            cached_input_tokens=int(
                                usage.get("cached_input_tokens", 0)
                                or usage.get("cached_tokens", 0)
                                or 0
                            ),
                            output_tokens=int(usage.get("output_tokens", 0) or 0),
                        )
                    # 无任何精确分项:仅总量一枚样本,挂 fallback telemetry。
                    fallback = (
                        {"model": thread.model or "default"} if thread.model else None
                    )
                    for sample in ledger.samples(fallback):
                        await self._emit_engine_event(
                            thread,
                            emit,
                            "turn_token_usage",
                            sample,
                        )
            # 批58 接线(模块1/3/4):turn 元数据/telemetry 组装增强。
            # off 时整体零行为(逐字节等价);on 时经各自 env 开关采集并附加事件;
            # 异常由各子方法隔离,主流程照常返回 payload。
            await self._enrich_turn_telemetry(thread, emit)
            return payload
        finally:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
            # 批 44 steer 竞态兜底:提交时回合在 running 但主循环已过最后注入点
            # (或异常中断),未被消费的 steer 回收转 thread.queue 语义——下一
            # 回合消化,不丢消息。loop 已置空前的最后取用点。
            with contextlib.suppress(Exception):
                _leftover = getattr(thread.loop, "take_leftover_steers", None)
                if _leftover is not None:
                    for _txt in _leftover():
                        thread.queue.append(
                            {"input": _txt, "enqueuedAt": time.time(), "via": "steer"}
                        )
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

    # ------------------------------------------------------------------
    # 批58 接线:5 个模块的 turn 元数据/telemetry 组装与特性注册表
    # (默认全部 off,与现状逐字节等价;on 时经各自 env 开关生效;异常隔离)
    # ------------------------------------------------------------------

    def _build_feature_registry(self) -> Any:
        """构建集中式特性注册表(模块5,对标 codex features crate)。

        注册本仓已知特性(含批58 各 env 开关),供 ENGINE_FEATURE_FLAGS_ENABLED
        开启时统一解析生效集;构造失败降级为 None(不阻塞引擎启动)。
        """
        try:
            reg = FeatureRegistry()
            reg.register(
                FeatureSpec(
                    key="agents_md_state",
                    stage="stable",
                    default=False,
                    description="AGENTS.md 状态机增量注入",
                )
            )
            reg.register(
                FeatureSpec(
                    key="turn_token_usage",
                    stage="stable",
                    default=False,
                    description="turn token 直方图",
                )
            )
            reg.register(
                FeatureSpec(
                    key="retained_context",
                    stage="stable",
                    default=False,
                    description="宿主事实账本",
                )
            )
            reg.register(
                FeatureSpec(
                    key="git_metadata",
                    stage="experimental",
                    default=False,
                    experimental_menu_name="Git 元数据",
                    experimental_menu_description="git workspaces 元数据采集",
                    description="git workspaces 元数据采集",
                )
            )
            reg.register(
                FeatureSpec(
                    key="thread_originator",
                    stage="stable",
                    default=False,
                    description="线程来源解析",
                )
            )
            reg.register(
                FeatureSpec(
                    key="installation_id",
                    stage="stable",
                    default=False,
                    description="安装实例 ID",
                )
            )
            reg.register(
                FeatureSpec(
                    key="turn_metadata",
                    stage="stable",
                    default=False,
                    description="Codex 会话元数据",
                )
            )
            return reg
        except Exception as e:  # noqa: BLE001 - 注册失败降级(off 路径不受限)
            logger.warning("特性注册表构建失败(降级为 None): %s", e)
            return None

    def _resolve_engine_features(
        self, overrides: dict[str, bool] | None = None
    ) -> dict[str, bool] | None:
        """经注册表解析生效集(模块5)。

        off(ENGINE_FEATURE_FLAGS_ENABLED 未开)直接返回 None,引擎沿用现有直读
        env 判定路径(逐字节一致);on 时返回解析生效集,任何未知/非法 env 均
        被捕获降级为 None(不阻塞握手)。
        """
        if not _engine_feature_flags_enabled_from_env():
            return None
        reg = self._feature_registry
        if reg is None:
            return None
        try:
            resolved = reg.resolve_features(overrides or {}, env=os.environ)
            return cast("dict[str, bool] | None", resolved)
        except Exception as e:  # noqa: BLE001 - 解析失败降级
            logger.warning("特性注册表解析失败(降级返回 None): %s", e)
            return None

    async def _enrich_turn_telemetry(
        self, thread: EngineThread, emit: Emitter | None
    ) -> None:
        """批58 接线(模块1/3/4):turn 元数据/telemetry 组装增强。

        仅当各自 env 开关 on 时分别采集并附加到 turn telemetry;off 时整体零
        行为(逐字节等价)。任一模块抛异常均被各自子方法隔离,主流程照常返回。
        """
        if _engine_git_metadata_enabled_from_env():
            await self._emit_git_metadata_event(thread, emit)
        if _engine_installation_id_enabled_from_env():
            await self._emit_installation_id_event(thread, emit)
        if _engine_turn_metadata_enabled_from_env():
            await self._emit_codex_metadata_event(thread, emit)

    async def _emit_git_metadata_event(
        self, thread: EngineThread, emit: Emitter | None
    ) -> None:
        """模块1:采集 git workspaces 元数据并附加 turn.git_metadata 事件。

        collect_git_workspaces 本身对 git 失败静默降级返回空;此处再包一层
        try/except 隔离非预期异常(logger.warning 降级跳过,绝不阻塞)。
        """
        try:
            cwd = thread.workspace or os.getcwd()
            snapshot = collect_git_workspaces(cwd)
            if not snapshot:
                return
            value = workspaces_to_metadata_value(snapshot)
            if value:
                await self._emit_engine_event(
                    thread, emit, "turn.git_metadata", {"workspaces": value}
                )
        except Exception as e:  # noqa: BLE001 - 采集失败降级跳过
            logger.warning("git 元数据采集失败(降级跳过): %s", e)

    async def _emit_installation_id_event(
        self, thread: EngineThread, emit: Emitter | None
    ) -> None:
        """模块3:读取既有 installation_id 文件(read-only)并附加 turn.installation_id 事件。

        约束:绝不调用写文件的 resolve_installation_id;仅当 IHUI_INSTALLATION_ID_DIR
        配置且文件存在且内容为合法 UUID 时才附加;任何失败均降级跳过。
        """
        try:
            base_dir = self._installation_id_dir
            if not base_dir:
                return
            path = Path(base_dir) / INSTALLATION_ID_FILENAME
            if not path.is_file():
                return
            raw = path.read_text(encoding="utf-8", errors="replace").strip()
            try:
                inst_id = str(uuid.UUID(raw))
            except (ValueError, AttributeError):
                return
            await self._emit_engine_event(
                thread, emit, "turn.installation_id", {"installationId": inst_id}
            )
        except Exception as e:  # noqa: BLE001 - 读取失败降级跳过
            logger.warning("installation_id 读取失败(降级跳过): %s", e)

    async def _emit_codex_metadata_event(
        self, thread: EngineThread, emit: Emitter | None
    ) -> None:
        """模块4:经 CodexResponsesMetadata 构建请求元数据(client_metadata 投影)并附加事件。

        installation_id 真实值由模块3 独立提供;此处仅构建会话元数据键与投影。
        任何失败均降级跳过,绝不阻塞主流程。
        """
        try:
            meta = CodexResponsesMetadata.new(
                installation_id="",
                session_id=thread.session_id,
                thread_id=thread.thread_id,
                window_id="",
            )
            meta.request_kind = CodexResponsesRequestKind("turn")
            client = meta.client_metadata()
            await self._emit_engine_event(
                thread, emit, "turn.codex_metadata", client
            )
        except Exception as e:  # noqa: BLE001 - 构建失败降级跳过
            logger.warning("Codex 会话元数据构建失败(降级跳过): %s", e)

    def _file_watcher_router_or_none(self) -> Any | None:
        """批58:取文件变更事件路由器;off 或构造失败返回 None(惰性,零副作用)。"""
        if not _engine_file_watcher_enabled_from_env():
            return None
        if self._file_watcher_router is None:
            try:
                from app.core.file_watcher import FileWatcherRouter

                self._file_watcher_router = FileWatcherRouter()
            except Exception as e:  # noqa: BLE001 - 构造失败降级不路由
                logger.warning("file_watcher 路由器构造失败(降级不路由): %s", e)
                return None
        return self._file_watcher_router

    def subscribe_file_changes(self, paths: list[str]) -> Any | None:
        """批58:订阅文件变更(off 返回 None;调用方需判空)。"""
        router = self._file_watcher_router_or_none()
        if router is None:
            return None
        try:
            return router.subscribe(paths)
        except Exception as e:  # noqa: BLE001 - 订阅失败降级返回 None
            logger.warning("file_watcher 订阅失败(降级返回 None): %s", e)
            return None

    def dispatch_file_change(self, paths: list[str]) -> int:
        """批58:把变更路径分发给命中订阅方;off 恒为 0,异常降级 0。"""
        router = self._file_watcher_router_or_none()
        if router is None or not paths:
            return 0
        try:
            from app.core.file_watcher import FileWatcherEvent

            return int(router.dispatch(FileWatcherEvent(paths=tuple(paths))))
        except Exception as e:  # noqa: BLE001 - 分发失败降级 0
            logger.warning("file_watcher 分发失败(降级返回 0): %s", e)
            return 0

    def reset_agents_md_state(self, thread: EngineThread) -> None:
        """重置 thread 的 AGENTS.md 状态机(压缩后强制重注入;批58,异常隔离)。"""
        with contextlib.suppress(Exception):
            thread.agents_md_state.reset()

    def retained_context_entries(self, thread: EngineThread) -> list[dict[str, Any]]:
        """读线程宿主事实账本的用户指令条目(批58,off/None 返回空;异常隔离)。

        对标 codex retained_context.rs:宿主持有的模型不可见事实,供委托审查
        与诊断;不经模型上下文暴露,仅服务端/管理面可读。
        """
        if thread.retained_context is None:
            return []
        try:
            return [
                {"message_id": e.value.message_id, "text": e.value.text}
                for e in thread.retained_context.user_messages
            ]
        except Exception:  # noqa: BLE001 - 读取失败降级为空
            return []

    def rollback_retained_context(
        self, thread: EngineThread, turn_ids: list[str]
    ) -> bool:
        """指令边界回滚:按原用户消息边界清除账本条目(批58,异常隔离)。

        对标 codex retained_context.rs::rollback —— 指令边界回滚(如 queue
        回退/线程分支)时清除其后的事实;压缩不过期它们。
        """
        if thread.retained_context is None:
            return False
        try:
            thread.retained_context.rollback(list(turn_ids), None)
            return True
        except Exception:  # noqa: BLE001 - 回滚失败降级
            return False

    def _inject_agents_md(self, thread: EngineThread) -> None:
        """项目文档 AGENTS.md 注入(2026-09-20 批58,对标 codex agents_md.rs)。

        双模式:
        - 开关 off(IHUI_AGENTS_MD_STATE_ENABLED 未开启,默认):沿用原纯字符串
          拼接,与接线前逐字节等价;但注入后同步记录 thread.agents_md_state
          快照,保证后续升级开关时状态连续。
        - 开关 on:AgentsMdState 状态机增量注入——首次有内容发普通片段,同内容
          不再注入,内容变更发 REPLACEMENT 通知,文件删除发 REMOVAL 通知;
          片段正文原样采用 agents_md_state 产出,不再自拼 [项目文档 AGENTS.md]。
        失败静默降级不阻塞开线程(与原实现同规格)。
        """
        workspace = thread.workspace
        if not (isinstance(workspace, str) and workspace.strip()):
            return
        try:
            from app.core.agents_md import load_project_instructions

            md = load_project_instructions(workspace)
            has_text = not md.is_empty()
            text = md.content if has_text else None
            if not _agents_md_state_enabled_from_env():
                # 关闭态:原逻辑逐字节等价(有内容才拼接)。
                if has_text:
                    thread.messages[0]["content"] = (
                        f"{thread.messages[0]['content']}\n\n"
                        f"[项目文档 AGENTS.md]\n{md.content}"
                    )
                    with contextlib.suppress(Exception):
                        # 记录快照保持状态连续(仅内存,不影响行为)。
                        thread.agents_md_state.maybe_fragment(workspace, md.content)
                return
            # 开启态:状态机决定本轮注入内容。
            from app.core.agents_md_state import (
                build_agents_md_fragment,
                build_agents_md_removal_fragment,
                build_agents_md_replacement_fragment,
            )

            frag = thread.agents_md_state.maybe_fragment(workspace, text)
            if frag is None:
                return
            rendered = frag["content"][0]["text"]
            thread.messages[0]["content"] = (
                f"{thread.messages[0]['content']}\n\n{rendered}"
            )
            # 增量语义已由状态机承载;构建函数仅在需要独立产出片段时使用,
            # 此处保留引用以防未来需要"片段化注入"(不参与运行时)。
            _ = (build_agents_md_fragment, build_agents_md_replacement_fragment,
                 build_agents_md_removal_fragment)
        except Exception as exc:  # noqa: BLE001 - 降级不阻塞开线程
            logger.warning("AGENTS.md 注入异常(降级跳过): %s", exc)

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
        # Interrupt(第十二批,对标 Codex Interrupt 钩子)
        await self._emit_hook(
            "agent.interrupt",
            {
                "threadId": thread.thread_id,
                "sessionId": thread.session_id,
                "mode": mode,
                "checkpointId": thread.checkpoint_id,
            },
        )
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
        # 第十八批(对标 Codex history::CompactionCheckpoint):换模型后旧压缩
        # 摘要不兼容 —— 摘要是前一个模型生成的文本,继续喂给新模型会引入语义
        # 漂移。默认只标记 + 发钩子事件;客户端可显式要求就地重压缩。
        mismatch = await self._compaction_model_mismatch(thread)
        if mismatch is not None:
            recompact = bool(params.get("recompactIfModelChanged"))
            await self._emit_hook(
                "compaction",
                {
                    "threadId": thread.thread_id,
                    "trigger": "resume_model_mismatch",
                    "summaryModel": mismatch["summaryModel"],
                    "currentModel": mismatch["currentModel"],
                    "action": "recompacted" if recompact else "flagged",
                },
            )
            if recompact:
                with contextlib.suppress(Exception):
                    await self._compact_thread(
                        thread,
                        keep_recent=int(params.get("keepRecent") or 20),
                        emit=emit,
                        trigger="resume_model_mismatch",
                    )
                mismatch = None  # 已用当前模型重压,兼容性恢复
            else:
                logger.warning(
                    "[engine] 压缩摘要与当前模型不兼容 thread=%s summary_model=%r current=%r"
                    "(可用 recompactIfModelChanged=true 触发重压缩)",
                    thread.thread_id,
                    mismatch["summaryModel"],
                    mismatch["currentModel"],
                )
        try:
            result = await self._run_thread(thread, emit, from_checkpoint=checkpoint_id)
        except ValueError as e:
            raise JsonRpcError(THREAD_NOT_FOUND, f"checkpoint 不存在或已过期: {e}") from e
        if mismatch is not None:
            result = {**result, "compactionModelMismatch": mismatch}
        return result

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
            # D33①(2026-09-26 立):排队消息的结构化数据面,与落库形状同源
            # (app/core/queue_items.py 是唯一真相源)。空队列给 [] 而非缺键 ——
            # 读取侧要能区分"确实没有排队消息"与"这版后端没有这个字段"。
            # queued 保留全量计数:queueItems 是体积护栏内的队首窗口,两者不互相替代。
            "queueItems": build_queue_items(thread.queue),
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
        # 关闭即摘除工作区监视器(第七批:防僵尸轮询任务泄漏)
        self._stop_workspace_watcher(thread.thread_id)
        # 清理 shell 快照(批 55:缓存+预热任务+落盘文件)
        self._drop_shell_snapshot(thread.session_id)
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
        2026-09-18 第七批:支持 remote compact 语义(strategy="llm_summary")——
        摘要由承载层/客户端经 LLM 生成后经 summary 参数注入,替代规则分层摘要
        (压缩器 custom_summary 通道,语义摘要优先级最高)。
        """
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        try:
            keep_recent = int(params.get("keepRecent") or 8)
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "keepRecent 须为整数") from e
        keep_recent = max(2, min(keep_recent, 50))
        strategy = params.get("strategy") or "deterministic"
        if strategy not in ("deterministic", "llm_summary"):
            raise JsonRpcError(
                INVALID_PARAMS, "strategy 须为 deterministic 或 llm_summary"
            )
        summary = params.get("summary")
        if strategy == "llm_summary" and not (
            isinstance(summary, str) and summary.strip()
        ):
            raise JsonRpcError(
                INVALID_PARAMS,
                "strategy=llm_summary 须提供非空 summary(LLM 摘要文本)",
            )
        custom_summary = summary.strip() if isinstance(summary, str) else ""
        return await self._compact_thread(
            thread,
            keep_recent=keep_recent,
            emit=emit,
            trigger="manual",
            custom_summary=custom_summary,
        )

    async def _compact_thread(
        self,
        thread: EngineThread,
        keep_recent: int,
        emit: Emitter,
        trigger: str,
        custom_summary: str = "",
    ) -> dict[str, Any]:
        """确定性压缩核心(manual/auto 共用,对标 Codex CompactionTrigger 语义)。

        custom_summary 非空 = remote compact(LLM 语义摘要)通道,优先级最高。
        """
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
            custom_summary=custom_summary,
        )
        # 压缩生命周期 hook(2026-09-18 第七批,对标 Codex PreCompactHook)
        with contextlib.suppress(Exception):
            await self._hook_bus().emit(
                "context.pre_compact",
                {
                    "threadId": thread.thread_id,
                    "sessionId": thread.session_id,
                    "trigger": trigger,
                    "beforeMessages": before,
                    "estimatedTokens": est_tokens,
                },
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
            "strategy": "llm_summary" if custom_summary else "deterministic",
        }
        if info.get("compressed"):
            thread.messages = list(compressed)
            thread.touch()
            self._persist_compaction_boundary(thread, info)
            # 压缩完成 hook(对标 Codex PostCompactHook;失败不阻塞主流程)
            with contextlib.suppress(Exception):
                await self._hook_bus().emit(
                    "context.post_compact",
                    {
                        "threadId": thread.thread_id,
                        "sessionId": thread.session_id,
                        "trigger": trigger,
                        "beforeMessages": before,
                        "afterMessages": len(compressed),
                        "removedCount": info.get("removed_count"),
                    },
                )
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
                    model=str(thread.model or ""),
                ),
            )
        except Exception as e:
            logger.warning("[engine] 压缩边界落库失败 %s: %s", thread.thread_id, e)

    def _latest_compaction_boundary(self, store: Any, thread_id: str) -> Any | None:
        """取该线程最近一条压缩边界(第十八批;无库/无边界返回 None)。"""
        try:
            latest: Any | None = None
            for item in store.list_items(thread_id):
                if getattr(item, "item_type", None) == "compaction_boundary":
                    latest = item
            return latest
        except Exception as e:  # noqa: BLE001 - 判定失败绝不阻断 resume
            logger.warning("[engine] 读取压缩边界失败 %s: %s", thread_id, e)
            return None

    async def _compaction_model_mismatch(self, thread: EngineThread) -> dict[str, Any] | None:
        """检测最近压缩摘要是否与当前线程模型不兼容;兼容返回 None。

        返回 {"summaryModel", "currentModel"}(都给原始模型名,便于展示)。
        无持久层 / 无压缩边界 / 兼容 → None。
        """
        store = self._persistence_store()
        if store is None:
            return None
        boundary = self._latest_compaction_boundary(store, thread.thread_id)
        if boundary is None:
            return None
        summary_model = str(getattr(boundary, "model", "") or "")
        if _compaction_compatible(summary_model, thread.model):
            return None
        return {"summaryModel": summary_model, "currentModel": str(thread.model or "")}

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
        # 批58:ENGINE_ROLLOUT_TRUNCATION_ENABLED on 时按 truncateAfterTurnId 截断导出
        if _engine_rollout_truncation_enabled_from_env():
            cut_at = params.get("truncateAfterTurnId")
            if isinstance(cut_at, str) and cut_at.strip():
                try:
                    from app.core.rollout_truncation import truncate_after_turn_id

                    records: list[dict[str, Any]] = []
                    for ln in lines:
                        with contextlib.suppress(json.JSONDecodeError):
                            records.append(json.loads(ln))
                    if records:
                        cut = truncate_after_turn_id(
                            records,
                            cut_at.strip(),
                            lambda r: r.get("turn_id") if isinstance(r, dict) else None,
                        )
                        lines = [
                            json.dumps(r, ensure_ascii=False, default=str) for r in cut
                        ]
                except Exception as e:  # noqa: BLE001 - 截断失败降级导出全量
                    logger.warning("[engine] 导出截断失败(降级导出全量): %s", e)
        path = params.get("path")
        written: str | None = None
        if isinstance(path, str) and path.strip():
            target = Path(path.strip())
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("\n".join(lines) + "\n", encoding="utf-8")
            written = str(target)
            # 批58:导出后对同目录冷导出做 gzip 归档(仅 on 时)
            if _engine_rollout_archive_enabled_from_env():
                try:
                    from app.core.rollout_archive import compress_cold_exports

                    compress_cold_exports(target.parent, marker_dir=target.parent)
                except Exception as e:  # noqa: BLE001 - 归档失败不阻断导出
                    logger.warning("[engine] 冷导出归档失败(降级跳过): %s", e)
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
        # 批 45:队列项带 id(对标 codex QueuedItem{id,input},供 queue.list/
        # delete/reorder 管理面按 id 操作)
        thread.queue.append(
            {
                "id": f"q_{uuid.uuid4().hex[:12]}",
                "input": text,
                "enqueuedAt": time.time(),
            }
        )
        thread.touch()
        await self._emit_engine_event(
            thread,
            emit,
            "thread.queue",
            {"queued": len(thread.queue), "action": "enqueued"},
        )
        return {
            "threadId": thread.thread_id,
            "id": thread.queue[-1]["id"],
            "queued": len(thread.queue),
            "mode": "steer" if thread.status == "running" else "idle",
        }

    async def _handle_turn_steer(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """运行中转向(2026-09-19 批 44,对标 codex turn/steer + TurnSteerParams)。

        running → thread.loop.steer(text) 真注入:主循环下一次 LLM 调用前把
        文本追加进消息历史,同一回合继续推理(非排队新回合)。
        非 running → submitted=false(no_active_turn),客户端降级 turn/start,
        对标 codex SteerSubmission::NotSubmitted。
        """
        thread = self._require_thread(params)
        text = _coerce_input_text(params.get("input"))
        expected_turn_id = params.get("expectedTurnId")
        loop = thread.loop
        accepted = (
            thread.status == "running"
            and loop is not None
            and callable(getattr(loop, "steer", None))
            and loop.steer(text)
        )
        thread.touch()
        if accepted:
            await self._emit_engine_event(
                thread,
                emit,
                "turn.steered",
                {"turnId": thread.current_turn_id, "inputChars": len(text)},
            )
        return {
            "threadId": thread.thread_id,
            "submitted": bool(accepted),
            "reason": None if accepted else "no_active_turn",
            "expectedTurnIdMatched": expected_turn_id is None
            or expected_turn_id == thread.current_turn_id,
        }

    async def _handle_thread_name(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程改名(2026-09-20 批 45,对标 codex thread/name/set +
        ThreadNameUpdatedNotification)。

        name 空白拒绝(对标 normalize_thread_name 返回 None 即 invalid_request);
        store 层写 title;内存线程同步;发 thread.name.updated 事件。
        无持久化时仅改内存并仍发事件(纯内存线程可改名)。
        """
        thread = self._require_thread(params)
        name = params.get("name")
        if not isinstance(name, str) or not name.strip():
            raise JsonRpcError(INVALID_PARAMS, "name 须为非空字符串")
        name = name.strip()
        store = self._persistence_store()
        updated = False
        if store is not None:
            updated = store.set_thread_name(thread.thread_id, name)
        thread.touch()
        await self._emit_engine_event(
            thread, emit, "thread.name.updated", {"name": name}
        )
        return {"threadId": thread.thread_id, "name": name, "persisted": updated}

    async def _handle_thread_delete(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """删除线程(2026-09-20 批 45,对标 codex thread/delete)。

        running 拒绝(THREAD_BUSY;codex 是 shutdown 等待后删,我方简化为
        忙时拒绝更安全);store 级联删除(items→turns→threads + fork 子线程);
        内存线程摘除(停 watcher/取消 pending);发 thread.deleted 事件。
        线程不存在也发 deleted 事件并返回 deleted=False(幂等,对标
        delete_threads 对 ThreadNotFound 静默)。
        """
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        runtime = self._threads.get(thread_id)
        if runtime is not None and runtime.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread_id}")
        store = self._persistence_store()
        deleted = False
        if store is not None:
            deleted = store.delete_thread(thread_id) > 0
        if runtime is not None:
            self._threads.pop(thread_id, None)
            self._stop_workspace_watcher(thread_id)
            self._drop_shell_snapshot(runtime.session_id)
            for future in runtime.pending.values():
                if not future.done():
                    future.cancel()
            runtime.pending.clear()
            runtime.status = "closed"
        with contextlib.suppress(Exception):
            if runtime is not None:
                await self._emit_engine_event(
                    runtime,
                    emit,
                    "thread.deleted",
                    {"deleted": deleted},
                )
            else:
                # 纯 store 线程(无内存运行时):直接构造报文出站
                emit_fn: Emitter = emit if emit is not None else _noop_emitter
                await emit_fn(
                    {
                        "jsonrpc": "2.0",
                        "method": "thread/event",
                        "params": {
                            "threadId": thread_id,
                            "event": "thread.deleted",
                            "payload": {"deleted": deleted},
                        },
                    }
                )
        return {"threadId": thread_id, "deleted": deleted}

    async def _handle_thread_queue_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """列队列(2026-09-20 批 45,对标 codex thread/queue/list 分页语义)。"""
        thread = self._require_thread(params)
        offset = max(0, int(params.get("offset") or 0))
        limit = max(1, int(params.get("limit") or 50))
        page = thread.queue[offset : offset + limit]
        return {
            "threadId": thread.thread_id,
            "items": [dict(q) for q in page],
            "total": len(thread.queue),
            "offset": offset,
            "limit": limit,
            "hasMore": offset + len(page) < len(thread.queue),
        }

    async def _handle_thread_queue_delete(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """删队列项(2026-09-20 批 45,对标 codex thread/queue/delete)。"""
        thread = self._require_thread(params)
        qid = params.get("queuedSubmissionId")
        if not isinstance(qid, str) or not qid:
            raise JsonRpcError(INVALID_PARAMS, "缺少 queuedSubmissionId")
        before = len(thread.queue)
        thread.queue = [q for q in thread.queue if q.get("id") != qid]
        deleted = len(thread.queue) < before
        if deleted:
            thread.touch()
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    emit,
                    "thread.queue",
                    {"queued": len(thread.queue), "action": "deleted"},
                )
        return {"threadId": thread.thread_id, "deleted": deleted}

    async def _handle_thread_queue_reorder(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """重排队列(2026-09-20 批 45,对标 codex thread/queue/reorder)。

        按传入 id 顺序重排;未列出的 id 保持相对顺序追加在尾部(稳定排序,
        对标 codex reorder 仅要求列出的项按给定顺序)。
        """
        thread = self._require_thread(params)
        ids = params.get("queuedSubmissionIds")
        if not isinstance(ids, list) or not all(isinstance(x, str) for x in ids):
            raise JsonRpcError(INVALID_PARAMS, "queuedSubmissionIds 须为字符串数组")
        rank: dict[str, int] = {}
        for idx, qid in enumerate(ids):
            rank.setdefault(qid, idx)
        thread.queue.sort(
            key=lambda q: (rank.get(q.get("id", ""), len(ids)),)
        )
        thread.touch()
        with contextlib.suppress(Exception):
            await self._emit_engine_event(
                thread,
                emit,
                "thread.queue",
                {"queued": len(thread.queue), "action": "reordered"},
            )
        return {
            "threadId": thread.thread_id,
            "queued": len(thread.queue),
            "order": [q.get("id") for q in thread.queue],
        }

    # ------------------------------------------------------------------
    # thread 只读查询面(批 46,对标 OpenAI codex app-server-protocol
    # thread/search、thread/items/list、thread/turns/list、thread/read)
    # ==================================================================
    # 设计要点:查询面**不**强制内存线程存在——内存没有但 SessionStore 有
    # 的线程也必须可查(进程重启后历史线程只读可回溯)。故直接走
    # _persistence_store() 而非 _require_thread();未启用持久化时按方法
    # 语义返回错误或空结果(查询面无需发 thread/event)。
    # ------------------------------------------------------------------

    async def _handle_thread_search(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """全文检索(对标 codex thread/search)。

        params: query(必填非空) / threadId(可选过滤) / limit(默认20)。
        未启用持久化 → INVALID_PARAMS("搜索需要持久化存储")。
        """
        query = params.get("query")
        if not isinstance(query, str) or not query.strip():
            raise JsonRpcError(INVALID_PARAMS, "query 须为非空字符串")
        store = self._persistence_store()
        if store is None:
            raise JsonRpcError(INVALID_PARAMS, "搜索需要持久化存储")
        thread_id = params.get("threadId")
        if thread_id is not None and not isinstance(thread_id, str):
            raise JsonRpcError(INVALID_PARAMS, "threadId 须为字符串")
        limit = params.get("limit", 20)
        if not isinstance(limit, int) or limit <= 0:
            limit = 20
        hits = store.full_text_search(query, thread_id=thread_id or None, limit=limit)
        return {
            "query": query,
            "hits": [
                {
                    "threadId": h.thread_id,
                    "itemType": h.item_type,
                    "seq": h.seq,
                    "snippet": h.snippet,
                    "score": h.score,
                }
                for h in hits
            ],
        }

    async def _handle_thread_items_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """列出线程 items(对标 codex thread/items/list)。

        params: threadId(必填) / afterSeq(可选,游标) / limit(默认100)。
        序列化与 thread.export 一致:body_payload() 展开 + type/seq +
        信封字段(全量 model_dump 的精简版);store 无此线程 → 空列表。
        未启用持久化 → INVALID_PARAMS。
        """
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        store = self._persistence_store()
        if store is None:
            raise JsonRpcError(INVALID_PARAMS, "items.list 需要持久化存储")
        after_seq = params.get("afterSeq")
        if after_seq is not None and not isinstance(after_seq, int):
            raise JsonRpcError(INVALID_PARAMS, "afterSeq 须为整数")
        limit = params.get("limit", 100)
        if not isinstance(limit, int) or limit <= 0:
            limit = 100
        items = store.list_items(thread_id, after_seq=after_seq)
        if limit < len(items):
            items = items[:limit]
        return {
            "threadId": thread_id,
            "items": [self._serialize_item(it) for it in items],
        }

    async def _handle_thread_turns_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """列出线程 turns(对标 codex thread/turns/list)。

        params: threadId(必填)。store 无此线程 → 空列表。
        未启用持久化 → INVALID_PARAMS。
        """
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        store = self._persistence_store()
        if store is None:
            raise JsonRpcError(INVALID_PARAMS, "turns.list 需要持久化存储")
        turns = store.list_turns(thread_id)
        return {
            "threadId": thread_id,
            "turns": [
                {
                    "turnId": t.turn_id,
                    "threadId": t.thread_id,
                    "turnSeq": t.turn_seq,
                    "status": t.status,
                    "startedAt": t.started_at,
                    "endedAt": t.ended_at,
                    "error": t.error,
                    "metadata": t.metadata,
                }
                for t in turns
            ],
        }

    async def _handle_thread_read(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """读取线程摘要(对标 codex thread/read)。

        params: threadId(必填)。返回 thread 元数据 camelCase 摘要 +
        首条 user 消息 preview;线程不存在 → THREAD_NOT_FOUND。
        未启用持久化 → INVALID_PARAMS。
        """
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        store = self._persistence_store()
        if store is None:
            raise JsonRpcError(INVALID_PARAMS, "read 需要持久化存储")
        thread = store.get_thread(thread_id)
        if thread is None:
            raise JsonRpcError(THREAD_NOT_FOUND, f"线程不存在: {thread_id}")
        preview: str | None = None
        try:
            from .session_store import UserMessageItem

            for it in store.list_items(thread_id):
                if isinstance(it, UserMessageItem) and it.content:
                    preview = it.content[:200]
                    break
        except Exception:  # noqa: BLE001 - preview 为可选增强,失败不影响主结果
            preview = None
        return {
            "threadId": thread.thread_id,
            "title": thread.title,
            "createdAt": thread.created_at,
            "updatedAt": thread.updated_at,
            "metadata": thread.metadata,
            "itemCount": thread.item_count,
            "lastSeq": thread.last_seq,
            "preview": preview,
        }

    async def _handle_thread_metadata(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程元数据 patch(2026-09-20 批 47,对标 codex thread/metadata/update
        + thread-store update_thread_metadata / ThreadMetadataPatch)。

        patch 值为 None 的键 = 删除该 metadata 键(codex ClearableField 语义);
        merge=False 整体替换。内存线程与 store 同步;store 未启用时仅改内存。
        发 thread.metadata.updated 事件。
        """
        thread = self._require_thread(params)
        patch = params.get("patch")
        if not isinstance(patch, dict):
            raise JsonRpcError(INVALID_PARAMS, "patch 须为对象")
        merge = params.get("merge", True)
        if merge:
            merged = dict(thread.metadata)
            for key, value in patch.items():
                if value is None:
                    merged.pop(key, None)
                elif isinstance(value, dict) and isinstance(merged.get(key), dict):
                    merged[key] = {**merged[key], **value}
                else:
                    merged[key] = value
            thread.metadata = merged
        else:
            thread.metadata = {k: v for k, v in patch.items() if v is not None}
        thread.touch()
        persisted = False
        store = self._persistence_store()
        if store is not None and callable(
            getattr(store, "update_thread_metadata", None)
        ):
            updated = store.update_thread_metadata(
                thread.thread_id, thread.metadata, merge=False
            )
            persisted = updated is not None
        await self._emit_engine_event(
            thread,
            emit,
            "thread.metadata.updated",
            {"metadata": thread.metadata},
        )
        return {
            "threadId": thread.thread_id,
            "metadata": thread.metadata,
            "persisted": persisted,
        }

    async def _handle_memory_status(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """记忆面状态查询(2026-09-20 批 49,对标 codex memory/status)。

        经 memory_facade 只读聚合 meta_learner lessons 状态;facade 异常
        已内部降级为 {"error": ...},不炸引擎。
        """
        from .memory_facade import memory_status

        return {"status": memory_status()}

    async def _handle_memory_reset(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """记忆面重置(2026-09-20 批 49,对标 codex memory/reset)。

        双确认语义:confirm 缺省 False → 只返回确认提示不动数据;显式
        confirm=true 才清空(facade 层同样兜底)。
        """
        from .memory_facade import memory_reset

        confirm = bool(params.get("confirm", False))
        return {"result": memory_reset(confirm=confirm)}

    async def _handle_thread_settings(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程配置热更(2026-09-20 批 48,对标 codex thread/settings/update)。

        running → THREAD_BUSY(配置冻结底座决定轮间热更语义:本轮用冻结副本,
        改了也不生效,故直接拒绝而非悄悄忽略)。校验类型后更新 EngineThread
        对应字段(model_params 合并,其余直接赋值);返回生效键 + 更新后快照,
        并发 thread.settings.updated。settings 缺失/非对象 → INVALID_PARAMS。
        """
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        settings = params.get("settings")
        if not isinstance(settings, dict):
            raise JsonRpcError(INVALID_PARAMS, "settings 须为对象")
        # 先统一校验,避免中途非法导致部分字段生效
        model = settings.get("model")
        if model is not None and (not isinstance(model, str) or not model):
            raise JsonRpcError(INVALID_PARAMS, "model 须为非空字符串")
        max_iterations = settings.get("maxIterations")
        if max_iterations is not None and (
            not isinstance(max_iterations, int)
            or isinstance(max_iterations, bool)
            or max_iterations <= 0
        ):
            raise JsonRpcError(INVALID_PARAMS, "maxIterations 须为正整数")
        token_budget = settings.get("tokenBudget")
        if token_budget is not None and (
            not isinstance(token_budget, int)
            or isinstance(token_budget, bool)
            or token_budget <= 0
        ):
            raise JsonRpcError(INVALID_PARAMS, "tokenBudget 须为正整数")
        auto_compact = settings.get("autoCompact")
        if auto_compact is not None and not isinstance(auto_compact, bool):
            raise JsonRpcError(INVALID_PARAMS, "autoCompact 须为布尔")
        auto_compact_threshold = settings.get("autoCompactThreshold")
        if auto_compact_threshold is not None and (
            not isinstance(auto_compact_threshold, int)
            or isinstance(auto_compact_threshold, bool)
            or auto_compact_threshold <= 0
        ):
            raise JsonRpcError(INVALID_PARAMS, "autoCompactThreshold 须为正整数")
        permission_mode_raw = settings.get("permissionMode")
        permission_mode = (
            None if permission_mode_raw is None else _require_permission_mode(permission_mode_raw)
        )
        model_params = settings.get("modelParams")
        if model_params is not None and not isinstance(model_params, dict):
            raise JsonRpcError(INVALID_PARAMS, "modelParams 须为对象")
        # 统一赋值(校验已全过)
        applied: list[str] = []
        if model is not None:
            thread.model = model
            applied.append("model")
        if max_iterations is not None:
            thread.max_iterations = max_iterations
            applied.append("maxIterations")
        if token_budget is not None:
            thread.token_budget = token_budget
            applied.append("tokenBudget")
        if auto_compact is not None:
            thread.auto_compact = auto_compact
            applied.append("autoCompact")
        if auto_compact_threshold is not None:
            thread.auto_compact_threshold = auto_compact_threshold
            applied.append("autoCompactThreshold")
        if permission_mode is not None:
            thread.permission_mode = permission_mode
            applied.append("permissionMode")
        if model_params is not None:
            thread.model_params = {**thread.model_params, **model_params}
            applied.append("modelParams")
        thread.touch()
        await self._emit_engine_event(
            thread,
            emit,
            "thread.settings.updated",
            {"settings": settings, "applied": applied},
        )
        return {
            "threadId": thread.thread_id,
            "applied": applied,
            "settings": {
                "model": thread.model,
                "maxIterations": thread.max_iterations,
                "tokenBudget": thread.token_budget,
                "autoCompact": thread.auto_compact,
                "autoCompactThreshold": thread.auto_compact_threshold,
                "permissionMode": thread.permission_mode,
                "modelParams": thread.model_params,
            },
        }

    async def _handle_turn_settings(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """下轮一次性配置(2026-09-20 批 48,对标 codex turn/settings/update)。

        与 thread.settings 不同:**不**拒绝 running——写入 thread.pending_turn_settings
        (含任意 frozen_context 键),下一轮 _run_prompt_turn 在 frozen_context 刷新后
        merge 进去并清空(一次性消费,语义 effectiveFrom="next_turn")。发
        turn.settings.updated。settings 缺失/非对象 → INVALID_PARAMS。
        """
        thread = self._require_thread(params)
        settings = params.get("settings")
        if not isinstance(settings, dict) or not settings:
            raise JsonRpcError(INVALID_PARAMS, "settings 须为非空对象")
        base = thread.pending_turn_settings or {}
        thread.pending_turn_settings = {**base, **settings}
        thread.touch()
        await self._emit_engine_event(
            thread,
            emit,
            "turn.settings.updated",
            {"settings": settings, "effectiveFrom": "next_turn"},
        )
        return {
            "threadId": thread.thread_id,
            "applied": sorted(settings.keys()),
            "effectiveFrom": "next_turn",
        }

    async def _handle_thread_loaded_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """内存活跃线程清单(2026-09-20 批 48,对标 codex thread/loaded/list)。

        仅列进程内 self._threads 的活跃线程(不依赖持久化 store);返回 threadId/
        status/prompts 摘要 + 总数。
        """
        threads = [
            {
                "threadId": t.thread_id,
                "status": t.status,
                "prompts": t.prompts,
            }
            for t in self._threads.values()
        ]
        return {"threads": threads, "total": len(threads)}

    async def _handle_thread_unsubscribe(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """断开当次承载连接的事件推送(2026-09-20 批 48,对标 codex thread/unsubscribe)。

        把 thread.emit 置 None(后续引擎自产事件不再经此连接出站);返回 unsubscribed
        并立刻用当次 emit 参数发 thread.unsubscribed(因 thread.emit 刚清,须用传入
        的 emit 而非 thread.emit)。线程须存在(_require_thread)。
        """
        thread = self._require_thread(params)
        thread.emit = None
        thread.touch()
        await self._emit_engine_event(
            thread, emit, "thread.unsubscribed", {"threadId": thread.thread_id}
        )
        return {"threadId": thread.thread_id, "unsubscribed": True}

    async def _handle_fs_watch(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """文件监视订阅(2026-09-20 批 50,对标 codex fs/watch + FsWatchParams)。

        watch_id 连接级标识(客户端自定义,重复注册幂等覆盖);path 须为存在
        的绝对目录;扫描式变更检测复用 _scan_workspace;变更经 fs.changed
        通知流出(对标 FsChangedNotification,带 watchId)。线程无关,纯连接级。
        """
        watch_id = params.get("watchId")
        path_raw = params.get("path")
        if not isinstance(watch_id, str) or not watch_id:
            raise JsonRpcError(INVALID_PARAMS, "watchId 须为非空字符串")
        if not isinstance(path_raw, str) or not path_raw:
            raise JsonRpcError(INVALID_PARAMS, "path 须为非空字符串")
        base = Path(path_raw)
        if not base.is_absolute() or not base.is_dir():
            raise JsonRpcError(INVALID_PARAMS, f"path 须为存在的绝对目录: {path_raw}")
        emit_fn: Emitter = emit if emit is not None else _noop_emitter

        old_task = self._fs_watchers.get(watch_id)
        if old_task is not None:
            old_task.cancel()

        async def _watch() -> None:
            prev = self._scan_workspace(base)
            while True:
                await asyncio.sleep(_WATCH_INTERVAL)
                try:
                    curr = self._scan_workspace(base)
                except Exception:  # noqa: BLE001 - 目录被删等,跳过本轮
                    continue
                added = sorted(set(curr) - set(prev))[:100]
                removed = sorted(set(prev) - set(curr))[:100]
                changed = sorted(
                    f for f in set(curr) & set(prev) if curr[f] != prev[f]
                )[:100]
                prev = curr
                if not (added or removed or changed):
                    continue
                with contextlib.suppress(Exception):
                    await emit_fn(
                        {
                            "jsonrpc": "2.0",
                            "method": "fs.changed",
                            "params": {
                                "watchId": watch_id,
                                "path": str(base),
                                "added": added,
                                "removed": removed,
                                "changed": changed,
                            },
                        }
                    )

        self._fs_watchers[watch_id] = asyncio.create_task(_watch())
        return {"watchId": watch_id, "path": str(base)}
    async def _handle_fs_unwatch(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """取消文件监视订阅(2026-09-20 批 50,对标 codex fs/unwatch)。幂等。"""
        watch_id = params.get("watchId")
        if not isinstance(watch_id, str) or not watch_id:
            raise JsonRpcError(INVALID_PARAMS, "watchId 须为非空字符串")
        task = self._fs_watchers.pop(watch_id, None)
        if task is not None:
            task.cancel()
        return {"watchId": watch_id, "stopped": task is not None}

    def _serialize_item(self, item: ItemBase) -> dict[str, Any]:
        """item → 可传输 dict(body_payload 展开 + type/seq + 信封)。

        与 thread.export 的 item.model_dump(mode="json") 一致(保留全部
        信封字段),另加显式 type/seq 便于客户端定位。
        """
        out: dict[str, Any] = {
            "seq": item.seq,
            "type": item.item_type,
            "threadId": item.thread_id,
            "turnId": item.turn_id,
            "parentSeq": item.parent_seq,
            "createdAt": item.created_at,
            "clientItemId": item.client_item_id,
        }
        out.update(item.body_payload())
        return out

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

    # ------------------------------------------------------------------
    # 线程生命周期扩展(2026-09-18 第七批,对标 Codex app-server thread 面)
    # ------------------------------------------------------------------

    async def _handle_thread_list(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程清单(对标 Codex thread/list):store 分页 + 内存运行态合并。"""
        try:
            limit = max(1, min(int(params.get("limit") or 20), 100))
            offset = max(0, int(params.get("offset") or 0))
        except (TypeError, ValueError) as e:
            raise JsonRpcError(INVALID_PARAMS, "limit/offset 须为整数") from e
        include_archived = bool(params.get("includeArchived"))
        store = self._persistence_store()
        if store is None:
            items = sorted(
                (
                    {
                        "threadId": t.thread_id,
                        "title": f"engine {t.thread_id}",
                        "archived": False,
                        "runtimeStatus": t.status,
                        "model": t.model,
                        "itemCount": len(t.messages),
                        "createdAt": t.created_at,
                        "updatedAt": t.updated_at,
                    }
                    for t in self._threads.values()
                ),
                key=lambda x: float(x["updatedAt"] or 0.0),
                reverse=True,
            )
            total = len(items)
            page = items[offset : offset + limit]
            return {
                "threads": page,
                "total": total,
                "limit": limit,
                "offset": offset,
                "hasMore": offset + len(page) < total,
            }
        page_obj = store.list_threads(
            limit=limit, offset=offset, include_archived=include_archived
        )
        items = []
        for t in page_obj.threads:
            runtime = self._threads.get(t.thread_id)
            md = t.metadata or {}
            items.append(
                {
                    "threadId": t.thread_id,
                    "title": t.title,
                    "archived": t.archived,
                    "itemCount": t.item_count,
                    "lastSeq": t.last_seq,
                    "createdAt": t.created_at,
                    "updatedAt": t.updated_at,
                    "runtimeStatus": runtime.status if runtime else "stored",
                    "model": runtime.model if runtime else md.get("model"),
                    "goal": runtime.goal if runtime else md.get("goal"),
                }
            )
        return {
            "threads": items,
            "total": page_obj.total,
            "limit": page_obj.limit,
            "offset": page_obj.offset,
            "hasMore": page_obj.has_more,
        }

    async def _handle_thread_archive(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """归档/恢复线程(对标 Codex thread/archive):store 标记 + 内存摘除。"""
        thread_id = params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 threadId")
        archived = bool(params.get("archived", True))
        store = self._persistence_store()
        if store is None:
            raise JsonRpcError(
                INVALID_PARAMS, "归档需要持久化存储(当前引擎未启用 SessionStore)"
            )
        updated = store.set_thread_archived(thread_id, archived)
        runtime = self._threads.pop(thread_id, None)
        if runtime is not None:
            self._stop_workspace_watcher(thread_id)
            if archived:
                self._drop_shell_snapshot(runtime.session_id)
                for future in runtime.pending.values():
                    if not future.done():
                        future.cancel()
                runtime.pending.clear()
                runtime.status = "closed"
        if not updated and runtime is None:
            raise JsonRpcError(THREAD_NOT_FOUND, f"线程不存在: {thread_id}")
        return {"threadId": thread_id, "archived": archived, "updated": updated}

    async def _handle_thread_fork(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程分叉(对标 Codex thread/fork):深拷贝消息 + 全部运行配置,
        新线程独立演进;源线程不受影响。"""
        from copy import deepcopy

        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        title = params.get("title")
        if title is not None and not (isinstance(title, str) and title.strip()):
            raise JsonRpcError(INVALID_PARAMS, "title 须为非空字符串或省略")
        new_id = f"thr_{uuid.uuid4().hex[:12]}"
        clone = EngineThread(
            thread_id=new_id,
            session_id=new_id,
            model=thread.model,
            permission_mode=thread.permission_mode,
            max_iterations=thread.max_iterations,
            tool_names=list(thread.tool_names) if thread.tool_names else None,
            workspace=thread.workspace,
            user_id=thread.user_id,
            # 分叉线程继承属主与角色(两者同源:都来自承载层已验证身份)
            role_id=thread.role_id,
            conversation_id=thread.conversation_id,
            messages=deepcopy(thread.messages),
            approval_policies=dict(thread.approval_policies),
            model_params=dict(thread.model_params),
            reasoning=dict(thread.reasoning),
            deny_tools=list(thread.deny_tools),
            token_budget=thread.token_budget,
            session_tokens_used=thread.session_tokens_used,
            goal=thread.goal,
            auto_compact=thread.auto_compact,
            auto_compact_threshold=thread.auto_compact_threshold,
            output_schema=deepcopy(thread.output_schema),
            role=thread.role,
            plan=deepcopy(thread.plan),
            turn_markers=dict(thread.turn_markers),
        )
        clone.host_tools = {
            name: HostToolSpec(
                name=spec.name,
                description=spec.description,
                parameters=deepcopy(spec.parameters),
                timeout_ms=spec.timeout_ms,
            )
            for name, spec in thread.host_tools.items()
        }
        clone.frozen_context = self._freeze_context(clone)
        self._threads[new_id] = clone
        self._persist_thread_created(clone)
        if clone.watch_workspace:
            self._start_workspace_watcher(clone)
        logger.info(
            "[engine] thread.fork %s <- %s (%d messages)",
            new_id,
            thread.thread_id,
            len(clone.messages),
        )
        return {
            "threadId": new_id,
            "forkedFrom": thread.thread_id,
            "title": (title or f"Fork of {thread.thread_id}").strip(),
            "messages": len(clone.messages),
            "status": clone.status,
        }

    async def _handle_thread_revert(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """线程回退(对标 Codex thread/revert + thread-store revert_thread):
        把持久历史截断到 beforeTurnId 之前(该 turn 及其后的 turns+items 删除),
        内存消息同步裁剪,并广播 thread.reverted 通知。线程在跑时拒绝。"""
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        before_turn_id = params.get("beforeTurnId")
        if not isinstance(before_turn_id, str) or not before_turn_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 beforeTurnId")
        store = self._persistence_store()
        deleted_turns = 0
        if store is not None:
            # 校验 turn 归属;store 不可用时退化为仅内存裁剪
            turn = store.get_turn(before_turn_id)
            if turn is None:
                raise JsonRpcError(INVALID_PARAMS, f"turn 不存在: {before_turn_id}")
            if turn.thread_id != thread.thread_id:
                raise JsonRpcError(INVALID_PARAMS, "turn 不属于该线程")
            cutoff_seq = turn.turn_seq
            # 截断前先反查:turn_markers 中 turn_seq >= cutoff 的 user 消息索引
            # (revert 后被删 turns 查不到了,必须先收集)
            doomed = [
                idx
                for idx, tid in thread.turn_markers.items()
                if (t := store.get_turn(tid)) is not None and t.turn_seq >= cutoff_seq
            ]
            deleted_turns = store.revert_thread(thread.thread_id, before_turn_id)
            # 内存消息裁剪:从最早的被删 turn 对应消息索引处整段截断——工具链
            # assistant/tool 消息都在该 user 消息之后,整段删除保证配对完整
            # (对标 codex 'reverts so it ends immediately before before_turn_id')
            if deleted_turns > 0 and doomed:
                cut = min(doomed)
                thread.messages = thread.messages[:cut]
                thread.turn_markers = {
                    i: t for i, t in thread.turn_markers.items() if i < cut
                }
        thread.touch()
        await self._emit_engine_event(
            thread, emit, "thread.reverted", {"deletedTurns": deleted_turns}
        )
        logger.info(
            "[engine] thread.revert %s before %s (deleted %d turns)",
            thread.thread_id,
            before_turn_id,
            deleted_turns,
        )
        return {
            "threadId": thread.thread_id,
            "deletedTurns": deleted_turns,
            "status": thread.status,
        }

    # ------------------------------------------------------------------
    # 工作区文件监视(2026-09-18 第七批,对标 Codex file-watcher)
    # ------------------------------------------------------------------

    @staticmethod
    def _scan_workspace(base: Path) -> dict[str, float]:
        """工作区文件 mtime 快照(相对路径;上限 2000 项;跳过 .git/依赖目录)。"""
        snapshot: dict[str, float] = {}
        count = 0
        skip_dirs = {"node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
        for root, dirs, files in os.walk(base):
            dirs[:] = [
                d for d in dirs if not d.startswith(".") and d not in skip_dirs
            ]
            for name in files:
                if name.startswith("."):
                    continue
                p = Path(root) / name
                try:
                    rel = str(p.relative_to(base)).replace("\\", "/")
                    snapshot[rel] = p.stat().st_mtime
                except OSError:
                    continue
                count += 1
                if count >= _WATCH_MAX_ENTRIES:
                    return snapshot
        return snapshot

    def _start_workspace_watcher(self, thread: EngineThread) -> None:
        if not thread.workspace or thread.thread_id in self._workspace_watchers:
            return
        base = Path(thread.workspace)

        async def _watch() -> None:
            prev = self._scan_workspace(base)
            while thread.status != "closed":
                await asyncio.sleep(_WATCH_INTERVAL)
                curr = self._scan_workspace(base)
                added = sorted(set(curr) - set(prev))[:100]
                removed = sorted(set(prev) - set(curr))[:100]
                changed = sorted(
                    f for f in set(curr) & set(prev) if curr[f] != prev[f]
                )[:100]
                prev = curr
                if not (added or removed or changed):
                    continue
                with contextlib.suppress(Exception):
                    await self._emit_engine_event(
                        thread,
                        thread.emit,
                        "workspace.changed",
                        {"added": added, "removed": removed, "changed": changed},
                    )

        self._workspace_watchers[thread.thread_id] = asyncio.create_task(_watch())

    def _stop_workspace_watcher(self, thread_id: str) -> None:
        task = self._workspace_watchers.pop(thread_id, None)
        if task is not None:
            task.cancel()

    # ------------------------------------------------------------------
    # shell 环境快照(2026-09-20 批 55 接线,对标 Codex shell_snapshot.rs +
    # environment_selection.rs 的 ShellSnapshotTask/ShellSnapshotCache)
    # ------------------------------------------------------------------

    _SNAPSHOT_DIRNAME = "shell-snapshots"

    def _shell_snapshot_dir(self, session_id: str) -> str:
        """快照存放目录(会话级,系统临时目录下;对标 SNAPSHOT_DIR 语义)。"""
        import tempfile

        return str(
            Path(tempfile.gettempdir()) / self._SNAPSHOT_DIRNAME / session_id
        )

    def _start_shell_snapshot_prewarm(self, thread: EngineThread) -> None:
        """thread.start 后台预热快照(对标 ShellSnapshotTask::schedule)。

        捕获用户 bash 登录环境(PATH/函数/别名/set -o),成功存入缓存并挂到
        线程;失败/超时静默降级(None),绝不阻塞开线程。非 POSIX 或 bash
        不可用时直接跳过(Windows cmd 会话无需快照)。
        """
        if os.name == "nt" or shutil.which("bash") is None:
            return
        session_id = thread.session_id
        if session_id in self._shell_snapshots or session_id in self._shell_snapshot_tasks:
            return
        workspace = thread.workspace or os.getcwd()
        snapshot_dir = self._shell_snapshot_dir(session_id)

        async def _prewarm() -> None:
            try:
                from app.core.shell_snapshot import capture_shell_snapshot

                try:
                    snap = await asyncio.to_thread(
                        capture_shell_snapshot,
                        "bash",
                        workspace,
                        snapshot_dir,
                        session_id,
                        dict(os.environ),
                    )
                except Exception:  # noqa: BLE001 — 预热永不阻塞主流程
                    return
                if snap is not None:
                    self._shell_snapshots[session_id] = snap
                    thread.shell_snapshot_path = snap.path
            finally:
                # 成败均自清(防异常路径泄漏任务表条目)
                self._shell_snapshot_tasks.pop(session_id, None)

        task = asyncio.create_task(_prewarm())
        self._shell_snapshot_tasks[session_id] = task

    def _take_shell_snapshot(self, thread: EngineThread) -> Any:
        """取出本线程就绪的快照(缓存命中或预热完成后迁移)。"""
        session_id = thread.session_id
        snap = self._shell_snapshots.get(session_id)
        if snap is not None:
            thread.shell_snapshot_path = getattr(snap, "path", None)
        return snap

    def _drop_shell_snapshot(self, session_id: str) -> None:
        """线程关闭时清理快照缓存/预热任务/落盘文件(对标 cleanup_stale_snapshots)。"""
        from app.core.shell_snapshot import cleanup_stale_snapshots

        task = self._shell_snapshot_tasks.pop(session_id, None)
        if task is not None and not task.done():
            task.cancel()
        self._shell_snapshots.pop(session_id, None)
        with contextlib.suppress(OSError, Exception):
            cleanup_stale_snapshots(Path(self._shell_snapshot_dir(session_id)), session_id)

    async def _emit_hook(self, event: str, context: dict[str, Any]) -> None:
        """钩子事件统一发射(对标 Codex hooks 分发;总线异常吞掉不影响主流程)。"""
        with contextlib.suppress(Exception):
            await self._hook_bus().emit(event, context)

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

    def _builtin_tool_builder(self, name: str) -> Callable[[EngineThread], Any]:
        """按内置名取它的构造函数 —— **命名约定即唯一真相**(V3 #47 第一格)。

        改前这里是一张把 14 个内置名**又抄了一遍**的 dict(内置名 -> 绑定方法),
        那份表才是 `_builtin_tool_definitions` 真正构造定义时用的键集,而
        `BUILTIN_ENGINE_TOOLS` 只是"名单"。两张表一旦分叉
        (加名字只改一处),表现不是报错而是"某个内置名永远构造不出来"或
        "名单里有、构造时 KeyError" —— 而守门 J8 读的是名单,看不见这张表。
        现由名单单向推导:新增内置名却没有对应 `_<name>_tool` 方法,直接 fail-fast
        并点名,而不是让它在运行时静默缺一件能力。
        """
        builder = getattr(self, f"_{name}_tool", None)
        if not callable(builder):
            raise RuntimeError(
                f"引擎内置工具 {name!r} 在 BUILTIN_ENGINE_TOOLS 里登记,却没有 "
                f"{type(self).__name__}._{name}_tool 构造函数 —— 名单与实现分叉"
            )
        cast: Callable[[EngineThread], Any] = builder
        return cast

    def _builtin_tool_definitions(self, thread: EngineThread) -> list[Any]:
        """构造引擎内置工具定义(宿主同名覆盖 / denyTools / tools 白名单生效)。"""

        whitelist = thread.tool_names
        host_names = set(thread.host_tools)
        definitions: list[Any] = []
        for name in BUILTIN_ENGINE_TOOLS:
            if name in host_names or name in thread.deny_tools:
                continue
            if whitelist is not None and name not in whitelist:
                continue
            definitions.append(self._builtin_tool_builder(name)(thread))
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
            # SubagentStart(第十二批,对标 Codex SubagentStart 钩子)
            await self._emit_hook(
                "subagent.start",
                {
                    "threadId": thread.thread_id,
                    "sessionId": thread.session_id,
                    "role": role,
                    "promptChars": len(sub_params["input"]),
                },
            )
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
            # SubagentStop(第十二批,对标 Codex SubagentStop 钩子)
            await self._emit_hook(
                "subagent.stop",
                {
                    "threadId": thread.thread_id,
                    "sessionId": thread.session_id,
                    "subThreadId": started["threadId"],
                    "role": role,
                    "success": result.get("success"),
                },
            )
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
            raw_data_url = f"data:{mime};base64,{data}"
            # 批 38 接线:经 image_preparation 按提示图像预算降采样
            # (对标 codex-rs load_data_url_for_prompt,high 档 2048px/2500 patch)。
            # 失败安全:任何准备失败一律回退原始 dataUrl,保持既有行为不变。
            data_url = raw_data_url
            prepared_note = ""
            try:
                _detail, _limits = _image_detail_limits("high")
                prepared = _load_data_url_for_prompt(raw_data_url, _limits)
                if (prepared.width, prepared.height) != (
                    prepared.source_width,
                    prepared.source_height,
                ):
                    data_url = prepared.into_data_url()
                    prepared_note = (
                        ";已按提示图像预算降采样 "
                        f"{prepared.source_width}x{prepared.source_height}"
                        f"->{prepared.width}x{prepared.height}"
                    )
                    # 批 58 接线:缩放事实以 developer 片段回灌历史(对标 codex
                    # image_resize_notice.rs——模型须知道看到的非原图,防误判细节)。
                    # tool output 来源;append 进 loop 消息流,异常静默降级。
                    try:
                        from app.core.image_preparation import (
                            ResizedImage,
                            build_image_resize_notice_fragment,
                        )
                        _frag = build_image_resize_notice_fragment(
                            [
                                ResizedImage(
                                    image_number=1,
                                    image_count=1,
                                    source_width=prepared.source_width,
                                    source_height=prepared.source_height,
                                    prepared_width=prepared.width,
                                    prepared_height=prepared.height,
                                )
                            ],
                            source="tool output",
                        )
                        _loop = thread.loop
                        if _frag is not None and _loop is not None:
                            _msgs = getattr(_loop, "_messages", None)
                            if isinstance(_msgs, list):
                                _msgs.append(_frag)
                    except Exception:
                        pass
            except Exception:
                prepared_note = ""
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "view_image.tool_call",
                    {"path": str(target), "mimeType": mime, "sizeBytes": size},
                )
            return {
                "path": str(target),
                "mimeType": mime,
                "sizeBytes": size,
                "dataUrl": data_url,
                "note": "图像经 dataUrl 内嵌返回;纯文本 LLM 通道下模型不可直接看见,客户端可据此渲染"
                + prepared_note,
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
                    "description": "补丁文本,自动识别两种格式:①codex V4A"
                    "(*** Begin Patch / *** Add|Update|Delete File / @@ 上下文 /"
                    " *** End Patch);②标准 unified diff(git diff 格式:"
                    "--- / +++ / @@)。支持新增/更新/删除/移动与多代码块,"
                    "任一上下文失配整包拒绝",
                },
            },
            "required": ["patch"],
        }

        async def _exec(args: dict[str, Any]) -> Any:
            patch_text = args.get("patch")
            if not isinstance(patch_text, str) or not patch_text.strip():
                return {"error": "apply_patch 需要非空 patch(V4A 或 unified diff 文本)"}
            base = (
                Path(thread.workspace).resolve()
                if thread.workspace
                else Path.cwd().resolve()
            )
            is_v4a = _is_v4a_patch(patch_text)
            notes: list[str] = []
            try:
                sections = (
                    _parse_v4a_patch(patch_text, notes)
                    if is_v4a
                    else _parse_unified_patch(patch_text, notes)
                )
            except ValueError as e:
                return {
                    "error": str(e),
                    "hint": (
                        "补丁未被应用(零修改)。建议:①重新 read_file 目标文件取最新内容;"
                        "②V4A 上下文行务必带行首空格(缩进原样);"
                        "③确认补丁以 *** End Patch 结尾"
                        if is_v4a
                        else "补丁未被应用(零修改)。建议:①用 git diff 生成标准 unified diff;"
                        "②确认含 --- / +++ / @@ 头;③上下文行保留行首空格"
                    ),
                }
            # 第一遍:纯内存计算全部目标内容(原子性:任何失败即整包拒绝)
            plan: list[tuple[str, str, str | None]] = []  # (rel, action, new_content|None)
            file_style: dict[str, tuple[str, bool]] = {}  # rel → (换行符, 是否 BOM)
            already_applied: list[str] = []  # 幂等命中、本次无需再改的文件
            diff_pairs: dict[str, tuple[str | None, str | None]] = {}
            planned_files: list[str] = []
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
                # 受保护元数据防提权(2026-09-19 第三十六批,对标 Codex WritableRoot
                # .is_path_writable):工作区内首段为 .git/.agents/.codex 的路径不可被
                # 补丁改写——.git/hooks 等可被用于提权,须走受保护审批而非静默写入。
                _first_component = PurePosixPath(
                    target_rel.replace("\\", "/")
                ).parts[0] if target_rel else ""
                if _first_component in _PROTECTED_METADATA_PATH_NAMES:
                    return {
                        "error": (
                            f"受保护路径不可被补丁修改: {target_rel}"
                            f"(首段 {_first_component} 属元数据目录,存在提权风险;"
                            "如确需修改请走受保护审批通道)"
                        ),
                        "protected": _first_component,
                    }
                # 批57(对标 Codex safety.rs assess_patch_safety):审批策略三态
                # 判定——never 恒放行;其余策略按路径是否全部落在可写根(含 move
                # 目标)与沙箱可用性决定自动应用/转审批/拒绝。异常隔离降级不阻塞。
                try:
                    from app.core.patch_safety import assess_patch_safety

                    # 2026-09-20 修复:assess_patch_safety 走 WritableRoot 组件级
                    # 前缀判定,必须传绝对路径——相对路径 relpath 对绝对根恒为
                    # ".."或跨盘 ValueError → 恒 reject "outside of the project",
                    # apply_patch 对非 never 策略整体不可用(批57接线后 21 用例
                    # 回归)。move 场景 old+new 双路径都进判定集并去重(原实现
                    # append new_rel 与 target_rel 重复,反而漏掉源路径)。
                    _batch_paths = [
                        str((base / _p).resolve())
                        for _p in dict.fromkeys(
                            p for p in (old_rel, new_rel) if p and p != "/dev/null"
                        )
                    ]
                    _verdict = assess_patch_safety(
                        approval_policy="on_request",
                        patch_paths=_batch_paths,
                        writable_roots=[str(base)],
                        cwd=str(base),
                        sandbox_available=True,
                    )
                    if _verdict.outcome == "reject":
                        return {"error": f"patch rejected: {_verdict.reason or 'outside project'}"}
                    if _verdict.outcome == "ask_user":
                        return {
                            "error": f"patch requires approval: {_verdict.reason or 'outside writable roots'}",
                            "requires_approval": True,
                        }
                except Exception as _ps_err:  # noqa: BLE001 — 判定失败降级放行
                    logger.debug("patch_safety 判定异常(降级放行): %s", _ps_err)
                created = section["old_path"].strip() == "/dev/null"
                deleted = section["new_path"].strip() == "/dev/null"
                if created:
                    new_content = "\n".join(
                        text for tag, text in section["hunks"][0]["lines"] if tag == "+"
                    )
                    if target.exists():
                        return {"error": f"新增文件已存在: {target_rel}"}
                    plan.append((target_rel, "created", new_content))
                    diff_pairs[target_rel] = (None, new_content)
                    planned_files.append(target_rel)
                    continue
                if not target.is_file() and old_rel == target_rel:
                    return {"error": f"目标文件不存在: {target_rel}"}
                source_rel = old_rel if old_rel != "/dev/null" else target_rel
                source = (base / source_rel).resolve()
                if not source.is_file():
                    return {"error": f"目标文件不存在: {source_rel}"}
                try:
                    # 保留原文件换行风格与 BOM:CRLF 仓库打补丁后不被悄悄改成 LF
                    content, src_newline, src_bom = _read_source_preserving(source)
                except OSError as e:
                    return {"error": f"文件读取失败 {source_rel}: {e}"}
                file_style[target_rel] = (src_newline, src_bom)
                if deleted:
                    plan.append((target_rel, "deleted", None))
                    diff_pairs[target_rel] = (content, None)
                    planned_files.append(target_rel)
                    continue
                try:
                    if is_v4a:
                        new_content = _apply_v4a_to_content(
                            content, section["hunks"], target_rel
                        )
                    else:
                        new_content = _apply_hunks_to_content(
                            content, section["hunks"], target_rel
                        )
                except _PatchAlreadyApplied as e:
                    # 幂等:内容已存在,记入结果但不落盘(不让模型反复重试同一补丁)
                    already_applied.append(target_rel)
                    notes.append(str(e))
                    continue
                except ValueError as e:
                    return {
                        "error": str(e),
                        "file": target_rel,
                        "hint": (
                            "上下文未命中(零修改)。请 read_file 该文件取最新内容后"
                            "重新生成补丁;注意上下文行保留行首空格与原始缩进"
                        ),
                    }
                # V4A Move to:新路径写新内容,旧路径删除(同一补丁内完成)
                if old_rel != target_rel and old_rel != "/dev/null":
                    old_target = (base / old_rel).resolve()
                    try:
                        old_target.relative_to(base)
                    except (OSError, ValueError):
                        return {"error": f"路径越出工作区,拒绝应用: {old_rel}"}
                    _old_first = PurePosixPath(old_rel.replace("\\", "/")).parts[0] if old_rel else ""
                    if _old_first in _PROTECTED_METADATA_PATH_NAMES:
                        return {
                            "error": (
                                f"受保护路径不可被补丁修改: {old_rel}"
                                f"(首段 {_old_first} 属元数据目录,存在提权风险)"
                            ),
                            "protected": _old_first,
                        }
                    diff_pairs[old_rel] = (content, None)
                    diff_pairs[target_rel] = (None, new_content)
                    planned_files.extend([target_rel, old_rel])
                    plan.append((target_rel, "updated", new_content))
                    plan.append((old_rel, "deleted", None))
                    continue
                diff_pairs[target_rel] = (content, new_content)
                planned_files.append(target_rel)
                plan.append((target_rel, "updated", new_content))
            # PatchApplyBegin(2026-09-18 第十批,对标 Codex PatchApplyBegin)
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "patch.apply.begin",
                    {"files": planned_files, "format": "v4a" if is_v4a else "unified"},
                )
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
                        style = file_style.get(rel)
                        if style is None:
                            target.write_text(target_content, encoding="utf-8")
                        else:
                            _write_text_preserving(
                                target, target_content, style[0], style[1]
                            )
                except OSError as e:
                    return {"error": f"落盘失败 {rel}({action}): {e}", "applied": False}
                # 无变更标记(体验优化:补丁合法但结果同原文,明确告知而非冒充改动)
                old_content, new_content_after = diff_pairs.get(rel, (None, target_content))
                results.append(
                    {
                        "path": rel,
                        "action": action,
                        "changed": action != "updated"
                        or old_content != new_content_after,
                    }
                )
            for rel in already_applied:
                results.append(
                    {"path": rel, "action": "unchanged", "changed": False}
                )
            changed_files = [r for r in results if r.get("changed")]
            # 批58:ENGINE_FILE_WATCHER_ENABLED on 时把本次变更路径分发给订阅方
            if _engine_file_watcher_enabled_from_env():
                self.dispatch_file_change(
                    [str((base / str(r.get("path", ""))).resolve()) for r in changed_files]
                )
            thread.touch()
            # 批 41 接线:补丁提交进回合净 diff 跟踪器(对标 Codex TurnDiffTracker;
            # tracker 初始化/记录失败降级跳过,不影响补丁主链路)。
            try:
                from ..core.turn_diff_tracker import FileChange, PatchDelta, TurnDiffTracker

                if thread.turn_diff_tracker is None:
                    thread.turn_diff_tracker = TurnDiffTracker()
                _fc: list[Any] = []
                for rel, (old, new) in diff_pairs.items():
                    if old is None:
                        _fc.append(
                            FileChange(kind="add", path=rel, content=new or "")
                        )
                    elif new is None:
                        _fc.append(
                            FileChange(kind="delete", path=rel, content=old)
                        )
                    else:
                        _fc.append(
                            FileChange(
                                kind="update",
                                path=rel,
                                content=new,
                                old_content=old,
                            )
                        )
                if _fc:
                    thread.turn_diff_tracker.track_delta(
                        PatchDelta(environment_id="workspace", changes=_fc, exact=True)
                    )
            except Exception as _td_err:  # noqa: BLE001 - 记录失败不影响补丁应用
                logger.warning("turn_diff_tracker 记录失败(降级跳过): %s", _td_err)
            # 聚合 unified diff(对标 Codex TurnDiffTracker 净变更语义)
            unified_diff = _aggregate_unified_diff(diff_pairs)
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "patch.apply.end",
                    {
                        "success": True,
                        "files": [r["path"] for r in results],
                        "unifiedDiff": unified_diff[:32_000],
                    },
                )
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "patch.applied",
                    {"files": [r["path"] for r in results], "count": len(results)},
                )
            return {
                "applied": True,
                "files": results,
                "count": len(results),
                "changedCount": len(changed_files),
                "noChange": not changed_files,
                "unifiedDiff": unified_diff[:32_000],
                "notes": notes,  # 宽松解析做了哪些容错(可观测,便于定位模型输出质量问题)
            }

        return ToolDefinition(
            name="apply_patch",
            description=(
                "将补丁原子应用到工作区,自动识别两种格式:codex V4A"
                "(*** Begin Patch)与标准 unified diff(git diff)。支持新增/更新/"
                "删除/移动文件与多代码块;任一上下文失配整包拒绝并给出失败定位,"
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
                        env=_sanitized_child_env(),
                    )
                    # OS 级沙箱(2026-09-18 第八批,对标 execpolicy 内核层):
                    # kill-on-close + 内存/进程数上限 + UI 限制;失败降级不阻塞
                    sandbox = _apply_sandbox(proc)
                except OSError as e:
                    return {"error": f"代码会话进程创建失败: {e}"}
                session = {
                    "id": new_id,
                    "proc": proc,
                    "sandbox": sandbox,
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

    def _web_search_tool(self, thread: EngineThread) -> Any:
        """web_search:引擎原生网页搜索(2026-09-18 第八批,对标 Codex
        web_search 内置工具):DuckDuckGo Lite 零 key 搜索,无需 MCP 装载。"""
        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> dict[str, Any]:
            query = str(args.get("query") or "").strip()
            if not query:
                return {"error": "缺少 query 参数"}
            try:
                max_results = max(1, min(int(args.get("maxResults") or 5), 10))
            except (TypeError, ValueError):
                max_results = 5
            raw_domains = args.get("allowedDomains")
            allowed_domains: list[str] = []
            if isinstance(raw_domains, list):
                allowed_domains = [
                    str(d).strip().lower().lstrip(".")
                    for d in raw_domains
                    if str(d).strip()
                ]
            # WebSearchBegin/End(2026-09-18 第十批,对标 Codex WebSearch 事件对)
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread, thread.emit, "web_search.begin", {"query": query}
                )
            try:
                from .mcp_server import _tool_web_search

                result = await _tool_web_search(
                    {"query": query, "max_results": max_results}
                )
            except Exception as e:  # noqa: BLE001 - 搜索失败降级为错误返回
                with contextlib.suppress(Exception):
                    await self._emit_engine_event(
                        thread,
                        thread.emit,
                        "web_search.end",
                        {"query": query, "success": False, "error": str(e)},
                    )
                return {"error": f"搜索失败: {e}", "results": []}
            results = result.get("results", [])
            if allowed_domains:

                def _domain_allowed(item: dict[str, Any]) -> bool:
                    url = str(item.get("url") or "").lower()
                    host = url.split("://", 1)[-1].split("/", 1)[0]
                    return any(
                        host == d or host.endswith("." + d) for d in allowed_domains
                    )

                results = [r for r in results if _domain_allowed(r)]
            with contextlib.suppress(Exception):
                await self._emit_engine_event(
                    thread,
                    thread.emit,
                    "web_search.end",
                    {
                        "query": query,
                        "success": True,
                        "resultCount": len(results),
                    },
                )
            return {
                "query": query,
                "results": results,
                "total": len(results),
                "message": result.get("message", ""),
            }

        parameters = {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词(支持中英文)",
                },
                "maxResults": {
                    "type": "integer",
                    "description": "返回结果条数(1-10,默认 5)",
                },
                "allowedDomains": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "可选:限定结果域名后缀白名单"
                    "(如 [\"python.org\"],子域名自动匹配)",
                },
            },
            "required": ["query"],
        }
        return ToolDefinition(
            name="web_search",
            description=(
                "网页搜索:按关键词检索公开网页并返回标题/摘要/链接列表"
                "(1-10 条)。适合查最新资讯、文档、事实核验;结果无网络时为空。"
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
        from app.core.shell_snapshot import snapshot_env_for_exec

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
            # ANSI 清洗(第十一批,对标 Codex ansi-escape):剥离颜色/控制序列,
            # 防止 cmd/PowerShell 输出污染模型上下文
            chunk = _strip_ansi(chunk)
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
            # 危险命令硬门(2026-09-19 第二十一批,对标 codex command_safety;
            # 批 58 补齐 stdin_approval 语义:续用 sessionId 写 stdin 的命令
            # 与新会话首条命令同门复查——在跑进程的沙箱不变,但命令本身
            # 必须逐条过分类器,防借持久会话绕过首条硬门):
            # 命中即拦截并回执分级说明,模型须向用户明确确认后才允许重试
            # (升级审批,不静默放行)
            try:
                _tokens = shlex.split(command)
            except ValueError:
                _tokens = command.split()
            _hit = _dangerous_command_match(_tokens)
            if _hit is not None:
                label = "强制删除(rm 系 force 旗标)" if _hit == "forced_rm" else "高危操作"
                # 批58(十五):把拦截背后的审批决策矩阵结构化进回执(对标 codex
                # exec_policy.rs render_decision_for_unmatched_command)。决策=
                # forbidden(never 档:策略层禁提示)时文案升级为"策略禁止",不再
                # 引导模型走用户确认;决策=prompt 时维持既有"先确认再重试"语义。
                _decision = _unmatched_command_decision_meta(
                    thread.approval_policies, "unified_exec"
                )
                _forbidden = _decision.get("decision") == "forbidden"
                if _forbidden:
                    _reason = _decision.get("policy_reason") or "策略禁止提示用户审批"
                    _msg = (
                        f"命令被安全分类器拦截:判定为{label}({_hit}),且当前审批策略"
                        f"(approval_policy=never)禁止向用户申请放行({_reason})。"
                        "该命令在本会话内不可执行;若确需执行,请先调整审批策略。"
                    )
                else:
                    _msg = (
                        f"命令被安全分类器拦截:判定为{label}({_hit})。"
                        "如确属用户明确要求的操作,请先向用户复述风险并获得确认,"
                        "再由用户在宿主审批后以等效但明确的方式执行。"
                    )
                return {
                    "error": _msg,
                    "safety": {"classification": _hit, **_decision},
                }
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
            # shell 环境快照注入(2026-09-20 批 55 接线,对标 Codex
            # shell_snapshot.rs 复用语义):POSIX 会话 source 快照脚本重建
            # 用户登录环境(profile 的 PATH/函数/别名/set -o),环境变量经
            # snapshot_env_for_exec 合并(凭据键默认不还原,防泄入子进程)。
            snap = self._take_shell_snapshot(thread) if os.name != "nt" else None
            exec_env = _sanitized_child_env()
            bootstrap_cmd: str | None = None
            if snap is not None and Path(snap.path).is_file():
                with contextlib.suppress(Exception):
                    exec_env = snapshot_env_for_exec(snap, exec_env)
                    bootstrap_cmd = f". {shlex.quote(snap.path)}"
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
                    env=exec_env,
                )
                # OS 级沙箱(第八批):交互 shell 同样收入 Job Object
                sandbox = _apply_sandbox(proc)
            except OSError as e:
                return {"error": f"进程创建失败: {e}"}
            new_session: dict[str, Any] = {
                "id": new_id,
                "proc": proc,
                "sandbox": sandbox,
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
                # 先 source 快照重建用户环境(批 55),再注入真实命令
                if bootstrap_cmd:
                    proc.stdin.write((bootstrap_cmd + "\n").encode("utf-8"))
                    with contextlib.suppress(Exception):
                        await proc.stdin.drain()
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

    def _new_context_tool(self, thread: EngineThread) -> Any:
        """new_context:模型主动放弃摘要直接开新上下文窗口(批58,对标 Codex
        tools/handlers/new_context_window.rs)。设置 loop 标志,压缩走不摘要截断分支。"""
        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> Any:
            thread.touch()
            loop = thread.loop
            if loop is not None:
                # 批58 接线:标记请求开新窗;_maybe_compact_context 见标志跳过摘要压缩
                with contextlib.suppress(Exception):
                    setattr(loop, "_new_context_window_requested", True)
            return {"status": "context_window_requested"}

        return ToolDefinition(
            name="new_context",
            description=(
                "Start a new context window. Does not clear, reset, or otherwise "
                "affect environment state."
            ),
            parameters={
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
            executor=_exec,
        )

    def _clock_sleep_tool(self, thread: EngineThread) -> Any:
        """clock_sleep:模型可调用等待(批58,对标 Codex tools/handlers/sleep.rs);
        新输入(steer/queue)提前唤醒,返回实际 wall-clock。"""
        import asyncio as _asyncio

        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> Any:
            duration_ms = args.get("duration_ms")
            if not isinstance(duration_ms, (int, float)) or isinstance(duration_ms, bool):
                return {"error": "duration_ms must be a number", "slept_ms": 0, "interrupted": False}
            if not (1 <= duration_ms <= 12 * 60 * 60 * 1000):
                return {
                    "error": f"duration_ms must be between 1 and {12 * 60 * 60 * 1000}",
                    "slept_ms": 0,
                    "interrupted": False,
                }
            loop = thread.loop
            wake_event: asyncio.Event | None = getattr(
                loop, "steer_wake_event", None
            ) if loop is not None else None
            started = time.monotonic()
            interrupted = False
            try:
                if wake_event is not None:
                    wake_task = _asyncio.ensure_future(wake_event.wait())
                    sleep_task = _asyncio.ensure_future(
                        _asyncio.sleep(duration_ms / 1000.0)
                    )
                    done, _pending = await _asyncio.wait(
                        {wake_task, sleep_task},
                        return_when=_asyncio.FIRST_COMPLETED,
                    )
                    interrupted = wake_task in done and wake_event.is_set()
                    for t in (wake_task, sleep_task):
                        if t not in done:
                            t.cancel()
                    with contextlib.suppress(Exception):
                        await _asyncio.wait(
                            [t for t in (wake_task, sleep_task) if not t.done()],
                            timeout=1,
                        )
                else:
                    await _asyncio.sleep(duration_ms / 1000.0)
            except asyncio.CancelledError:
                raise
            except Exception:
                pass
            slept_ms = round((time.monotonic() - started) * 1000)
            thread.touch()
            return {"slept_ms": slept_ms, "interrupted": interrupted}

        return ToolDefinition(
            name="clock_sleep",
            description=(
                "Pause execution for a specified duration. The sleep ends early when "
                "new input arrives for the active turn. Returns the elapsed "
                "wall-clock time."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "duration_ms": {
                        "type": "number",
                        "description": (
                            "How long to sleep in milliseconds. Must be between 1 "
                            f"and {12 * 60 * 60 * 1000}."
                        ),
                    }
                },
                "required": ["duration_ms"],
                "additionalProperties": False,
            },
            executor=_exec,
        )

    def _clock_curr_time_tool(self, thread: EngineThread) -> Any:
        """clock_curr_time:模型主动查询当前时间(批58,对标 Codex
        tools/handlers/current_time.rs);输出 "YYYY-MM-DD HH:MM:SS UTC"。"""
        from datetime import datetime, timezone as _tz

        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> Any:
            now = datetime.now(_tz.utc)
            thread.touch()
            return {
                "current_time": now.strftime("%Y-%m-%d %H:%M:%S") + " UTC",
                "timezone": "UTC",
            }

        return ToolDefinition(
            name="clock_curr_time",
            description="Return the current time in UTC.",
            parameters={
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
            executor=_exec,
        )

    def _send_message_to_user_async_tool(self, thread: EngineThread) -> Any:
        """send_message_to_user_async:长任务不打断轮次主动告知用户(批58,对标
        Codex tools/handlers/send_message_to_user_async.rs);立即返回 {"accepted": true},
        消息经 elicitation 通知通道投递,回复经 thread.enqueue 作为新用户消息到达。"""
        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> Any:
            message = args.get("message")
            if not isinstance(message, str) or not message.strip():
                return {"error": "message must not be empty"}
            thread.touch()
            try:
                await (thread.emit or _noop_emitter)(
                    {
                        "jsonrpc": "2.0",
                        "method": "user_message_async",
                        "params": {
                            "threadId": thread.thread_id,
                            "message": message.strip(),
                        },
                    }
                )
            except Exception:
                logger.warning(
                    "send_message_to_user_async 通知投递失败(降级,不阻塞轮次)"
                )
            return {"accepted": True}

        return ToolDefinition(
            name="send_message_to_user_async",
            description=(
                "Send a concise message that needs the user's attention during "
                "ongoing work. The tool returns immediately without ending the turn "
                "or waiting for a reply; any reply arrives asynchronously as a new "
                "user message. Use this tool to report a critical blocker or a "
                "finding that may change the task's direction, or to answer a user "
                "question or status request received while work is still in "
                "progress. Use clear formatting, such as bolding questions, to make "
                "requests easy to notice and answer."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The concise question or update to send to the user.",
                    }
                },
                "required": ["message"],
                "additionalProperties": False,
            },
            executor=_exec,
        )

    def _request_user_input_async_tool(self, thread: EngineThread) -> Any:
        """request_user_input_async:批量非阻塞提问(批58,对标 Codex
        tools/handlers/request_user_input_async.rs);立即返回,回答异步到达。"""
        from .agent_loop_v2 import ToolDefinition

        async def _exec(args: dict[str, Any]) -> Any:
            questions = args.get("questions")
            if not isinstance(questions, list) or not questions:
                return {"error": "questions must not be empty"}
            items: list[dict[str, Any]] = []
            seen_titles: set[str] = set()
            for q in questions:
                if not isinstance(q, dict):
                    return {"error": "each question must be an object"}
                title = str(q.get("title") or "").strip()
                if not title:
                    return {"error": "each question must have a non-empty title"}
                if title in seen_titles:
                    return {"error": "question titles must be unique"}
                seen_titles.add(title)
                options = q.get("options")
                entry: dict[str, Any] = {"title": title}
                if options is not None:
                    if not isinstance(options, list) or not options:
                        return {"error": "options must be a non-empty array when present"}
                    entry["options"] = [str(o) for o in options]
                items.append(entry)
            thread.touch()
            try:
                await (thread.emit or _noop_emitter)(
                    {
                        "jsonrpc": "2.0",
                        "method": "user_input_async",
                        "params": {"threadId": thread.thread_id, "questions": items},
                    }
                )
            except Exception:
                logger.warning("request_user_input_async 通知投递失败(降级)")
            return {"accepted": True, "questions": items}

        return ToolDefinition(
            name="request_user_input_async",
            description=(
                "Ask the user one or more self-contained questions without ending "
                "the turn; the tool returns immediately and answers arrive "
                "asynchronously as new user messages."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "array",
                        "minItems": 1,
                        "description": (
                            "One or more self-contained questions to present "
                            "together, in display order."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": (
                                        "The complete question shown to the user, "
                                        "including any context needed to answer it."
                                    ),
                                },
                                "options": {
                                    "type": "array",
                                    "minItems": 1,
                                    "items": {"type": "string"},
                                    "description": (
                                        "Suggested answers, in display order. Put "
                                        "the recommended answer first; the first "
                                        "option is preselected by default."
                                    ),
                                },
                            },
                            "required": ["title"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["questions"],
                "additionalProperties": False,
            },
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
        内置工具 + 线程宿主工具 + MCP 超级工具池(承载层注入)。

        V3 #47 第三格(2026-09-26):JSON-RPC 面**不再自己判断"这个名字是什么能力"** ——
        每个内置条目现读同一份 `ENGINE_TOOL_BRIDGE`,带上它在注册表里的归口名 `mapsTo`
        与处置结论 `executionMode`。此前 catalog 只发 `{"source": "builtin", "description": ""}`,
        等于对客户端宣称"这是引擎独有的一面",而 #47 的病根正是"同一能力在两条链上顶着
        不同名字、各自套上不同判定";把归口写进协议面,客户端与门禁看的才是同一份结论。
        """
        catalog: list[dict[str, Any]] = [
            {
                "name": name,
                "source": "builtin",
                "description": "",
                "mapsTo": capability_equivalent(name),
                "executionMode": execution_mode(name),
            }
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

        批 53:客户端可携 persist 字段选择审批持久层级 ——
        "session"(本次会话免弹窗) / "always"(永久免弹窗) / 不传或 None(沿用批 52
        默认 session 落盘,行为不变)。非法值 INVALID_PARAMS。
        """
        approval_id = params.get("approvalId") or params.get("requestId")
        if not isinstance(approval_id, str) or not approval_id:
            raise JsonRpcError(INVALID_PARAMS, "缺少 approvalId")
        decision = str(params.get("decision") or "").strip().lower()
        if decision not in ("approve", "reject", "allow", "deny"):
            raise JsonRpcError(
                INVALID_PARAMS, "decision 须为 approve/reject(或 allow/deny)"
            )
        # 批 53:可选 persist 层级(session|always|None),非法值 INVALID_PARAMS
        persist_raw = params.get("persist")
        if persist_raw is None:
            persist: str | None = None
        else:
            persist = str(persist_raw).strip().lower()
            if persist not in ("session", "always"):
                raise JsonRpcError(INVALID_PARAMS, "persist 须为 session/always")
        normalized = "approve" if decision in ("approve", "allow") else "reject"
        from .agent_loop_v2 import (
            grant_tool_approval_persist,
            resolve_approval_response,
        )

        # O19(2026-09-21)审批属主校验 —— 本通道的信任边界必须写清楚:
        # 这里**不在 HTTP 请求上下文**(JSON-RPC over MCP / engine WS),拿不到
        # request.state.user_id。引擎能自证的 principal 只有 threadId 所绑定线程的
        # EngineThread.user_id(线程创建时写入,后续审批条目的属主也正是同一个值 ——
        # 见 agent_loop_v2._request_approval 用 self._user_id 登记)。
        # 传 principal 的效果:① 盲猜 approval_id 解不掉他人审批;② A 线程解 B 用户
        # 的审批 → owner != principal → 不生效(applied=False)。
        # 不传 threadId 时 principal 退化为 None,此时只能结算同样无属主的条目
        # (非 HTTP 上下文创建的历史审批),不会因此开出新口子。
        # 敞口收口(2026-09-21 同日晚于本注释落地):thread.start 的 userId 曾由客户端
        # 自述,谎报即可解他人审批;现承载层 routers/engine.py::_bind_principal 把
        # **已验证身份**(HTTP request.state.user_id / WS 握手 token 的 sub)写回
        # params.userId,自述值在进入引擎前被丢弃。仅剩"未鉴权通道"(principal=None,
        # 如 dev 态)仍按自述值建线程 —— 那类通道本身无身份可谎报,信任级不变。
        # 测试:tests/test_engine_principal_binding_59.py
        thread_id = params.get("threadId")
        principal: str | None = None
        if isinstance(thread_id, str) and thread_id:
            bound_thread = self._threads.get(thread_id)
            if bound_thread is not None:
                principal = bound_thread.user_id
        applied = bool(
            resolve_approval_response(approval_id, normalized, principal)
        )
        # request_permissions 工具的待决请求同路结算(2026-09-18 第三批)
        perm_future = self._permission_requests.get(approval_id)
        if perm_future is not None and not perm_future.done():
            perm_future.set_result(normalized)
            applied = True
        # 批 53:批准且携带合法 persist → 升级落盘指定层级(always/session)
        persisted: str | None = None
        if applied and normalized == "approve" and persist is not None:
            if grant_tool_approval_persist(approval_id, persist):
                persisted = persist
        return {
            "approvalId": approval_id,
            "decision": normalized,
            "applied": applied,
            "persisted": persisted,
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
