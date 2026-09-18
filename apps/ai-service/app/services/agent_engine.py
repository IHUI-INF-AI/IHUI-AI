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
  tools.list          MCP 超级工具池 + 宿主注入工具的合并清单
  tools.register      注入宿主自有工具(执行回传客户端,经 tool/execute 往返)
  tools.result        回传宿主工具执行结果(结算 tool/execute 请求)
  approval.respond    审批决策回填(与主循环 _approval_registry 打通)
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
import contextlib
import itertools
import json
import logging
import os
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
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
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.updated_at = time.time()


def _spec(thread: EngineThread) -> dict[str, Any]:
    """把线程配置转成主循环工厂的 spec(承载层据此构造 AgentLoopV2)。"""
    return {
        "thread_id": thread.thread_id,
        "session_id": thread.session_id,
        "model": thread.model,
        "permission_mode": thread.permission_mode,
        "max_iterations": thread.max_iterations,
        "tool_names": thread.tool_names,
        "workspace": thread.workspace,
        "user_id": thread.user_id,
        "conversation_id": thread.conversation_id,
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
    ) -> None:
        self._loop_factory = loop_factory
        self._tool_lister = tool_lister
        self._cost_report = cost_report
        self._model_lister = model_lister
        self._injected_bus = hook_bus
        self._host_tool_timeout_ms = int(host_tool_timeout_ms)
        self._threads: dict[str, EngineThread] = {}
        # 会话持久化(session_store 单例/注入;None=未初始化,False=不可用哨兵)
        self._store: SessionStore | None | bool = store
        self._handlers: dict[str, Callable[[dict[str, Any], Emitter], Any]] = {
            "engine.initialize": self._handle_initialize,
            "engine.ping": self._handle_ping,
            "thread.start": self._handle_thread_start,
            "thread.prompt": self._handle_thread_prompt,
            "thread.interrupt": self._handle_thread_interrupt,
            "thread.resume": self._handle_thread_resume,
            "thread.state": self._handle_thread_state,
            "thread.close": self._handle_thread_close,
            "tools.list": self._handle_tools_list,
            "tools.register": self._handle_tools_register,
            "tools.result": self._handle_tools_result,
            "approval.respond": self._handle_approval_respond,
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
        system_prompt = params.get("systemPrompt")
        messages: list[dict[str, Any]] = []
        if isinstance(system_prompt, str) and system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        else:
            messages.append({"role": "system", "content": "You are a helpful agent."})
        tool_names = params.get("tools")
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
            messages=messages,
        )
        self._threads[thread_id] = thread
        self._persist_thread_created(thread)
        logger.info("[engine] thread.start %s (model=%s)", thread_id, thread.model)
        return {
            "threadId": thread_id,
            "sessionId": thread.session_id,
            "model": thread.model,
            "permissionMode": thread.permission_mode,
            "maxIterations": thread.max_iterations,
            "status": thread.status,
        }

    async def _handle_thread_prompt(
        self, params: dict[str, Any], emit: Emitter
    ) -> dict[str, Any]:
        """执行一轮:过程事件经 thread/event 通知回传,结束时返回结构化结果。"""
        thread = self._require_thread(params)
        if thread.status == "running":
            raise JsonRpcError(THREAD_BUSY, f"线程正在执行中: {thread.thread_id}")
        text = _coerce_input_text(params.get("input"))
        thread.messages.append({"role": "user", "content": text})
        turn_id = self._persist_turn_start(thread, text)
        try:
            result = await self._run_thread(thread, emit)
        except Exception as e:
            self._persist_turn_error(thread, turn_id, e)
            raise
        self._persist_turn_end(thread, turn_id, result)
        return result

    async def _run_thread(
        self, thread: EngineThread, emit: Emitter, *, from_checkpoint: str | None = None
    ) -> dict[str, Any]:
        """构造主循环 → 跑一轮 → 归一结果(承接 prompt / resume 两条入口)。"""
        thread.status = "running"
        thread.emit = emit
        thread.touch()
        host_tools = self._build_host_tool_definitions(thread)
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
            "checkpointId": getattr(result, "checkpoint_id", None),
            "error": getattr(result, "error", None),
            "budget": getattr(result, "budget", None),
            "compactionEvents": compaction,
        }

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
