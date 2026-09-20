# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine 编程编排层 — create_agent()(P2-④,2026-09-18 立)。

定位:把 ai-service 的 JSON-RPC 编排引擎(P2-③)封装成**应用内可编程的通用 agent
编排层** —— 对标 Codex SDK(TS/Python 编程编排),但模型无关:同一套 API 背后可路由
到任意 provider(MCP 超级工具池 / 19 家模型路由 / 成本账本)。

与 SDK 其余模块的区别:其他模块是"调云 API 的 client",本模块是"在你应用里跑 agent" ——
宿主自带工具(host_tools)由本进程执行后回传,审批(on_approval)由本进程裁决,
事件(thread/event)在编排循环里逐帧可见。

协议对接(与 ``services/agent_engine.py`` 的 handler 表一一对应)::

    POST {base_url}/api/engine/rpc   单发 JSON-RPC 2.0;流式方法返回 text/event-stream

通知(server → client):
    thread/event       {threadId, event, payload}
    tool/execute       {requestId, threadId, name, arguments, timeoutMs}
    approval/request   {requestId, threadId, toolName, argsPreview, timeoutMs}

用法::

    from ihui_ai import create_agent

    agent = create_agent({"token": jwt, "model": "gpt-5"})
    agent.register_tool("read_file", lambda ctx: open(ctx.arguments["path"]).read())
    result = agent.run("把 README 里的错别字改掉", on_event=lambda e: print(e.name))
    agent.close()
"""

from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Iterator, Mapping, Optional

#: 引擎协议方法名(与 agent_engine.py 的 handler 表对齐;parity 守门脚本比对)。
ENGINE_METHODS: tuple[str, ...] = (
    "engine.initialize",
    "engine.ping",
    "thread.start",
    "thread.prompt",
    "thread.interrupt",
    "thread.resume",
    "thread.state",
    "thread.close",
    "thread.compact",
    "thread.export",
    "thread.plan",
    "thread.enqueue",
    "thread.goal",
    "thread.review",
    "thread.list",
    "thread.archive",
    "thread.fork",
    "thread.revert",
    "thread.name",
    "thread.delete",
    "thread.queue.list",
    "thread.queue.delete",
    "thread.queue.reorder",
    "thread.search",
    "thread.items.list",
    "thread.turns.list",
    "thread.read",
    "thread.metadata",
    "thread.settings",
    "thread.loaded.list",
    "thread.unsubscribe",
    "memory.status",
    "memory.reset",
    "fs.watch",
    "fs.unwatch",
    "model.list",
    "turn.steer",
    "turn.settings",
    "tools.search",
    "tools.load",
    "elicitation.respond",
    "agent.exec",
    "tools.list",
    "tools.register",
    "tools.result",
    "approval.respond",
    "cost.report",
    "models.list",
)

#: 引擎通知方法名(server → client)。
ENGINE_NOTIFICATIONS: tuple[str, ...] = ("thread/event", "tool/execute", "approval/request")

#: 自动升级为 SSE 的流式方法。
ENGINE_STREAMING_METHODS: tuple[str, ...] = ("thread.prompt", "thread.resume", "agent.exec")

#: 引擎错误码(与 agent_engine.py 常量一致)。
ENGINE_ERROR_CODES: dict[str, int] = {
    "parse_error": -32700,
    "invalid_request": -32600,
    "method_not_found": -32601,
    "invalid_params": -32602,
    "internal_error": -32603,
    "thread_not_found": -32001,
    "thread_busy": -32002,
    "wait_timeout": -32003,
    "tool_not_found": -32004,
    "host_tool_failed": -32005,
    "thread_closed": -32006,
    "budget_exhausted": -32007,
}

#: 默认引擎地址(ai-service)。
DEFAULT_BASE_URL = "http://localhost:8803"
#: 非流式 RPC 默认超时(秒)。流式请求不受此限制。
DEFAULT_TIMEOUT = 30.0
#: JSON-RPC 传输路径。
RPC_PATH = "/api/engine/rpc"

#: astream() 的流结束哨兵(与正常事件对象区分)。
_STREAM_END = object()

#: 事件回调签名:接收 :class:`AgentEngineEvent`。
EventCallback = Callable[["AgentEngineEvent"], None]
#: 宿主工具处理器签名:接收 :class:`AgentToolContext`,返回值经 tools.result 回传。
ToolHandler = Callable[["AgentToolContext"], Any]
#: 审批回调签名:接收 :class:`AgentApprovalRequest`,返回 ``"approve"`` / ``"reject"``。
ApprovalHandler = Callable[["AgentApprovalRequest"], str]


class AgentEngineError(Exception):
    """引擎侧错误(JSON-RPC 错误对象或传输层失败)。

    Attributes:
        code: JSON-RPC 错误码;传输层失败时为 HTTP 状态码的负数形式(如 -401)。
        data: 错误附加数据(引擎可选返回)。
    """

    def __init__(self, code: int, message: str, data: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data


@dataclass
class AgentEngineEvent:
    """一帧 agent 循环事件(thread/event 通知)。"""

    #: 事件名(tool.before / thinking.delta / message.receive / self_heal …)。
    name: str
    #: 事件载荷(含 session_id / tool / args / result 等)。
    payload: Mapping[str, Any]
    #: 所属线程 id。
    thread_id: str


@dataclass
class AgentToolContext:
    """宿主工具执行上下文(tool/execute 通知的载荷)。"""

    request_id: str
    thread_id: str
    #: 工具名。
    name: str
    #: 模型给出的参数(已解析为 dict)。
    arguments: Mapping[str, Any]
    #: 引擎侧等待上限(毫秒);超时后引擎按 wait_timeout 降级。
    timeout_ms: int = 0


@dataclass
class AgentApprovalRequest:
    """审批请求(approval/request 通知的载荷)。"""

    request_id: str
    thread_id: str
    tool_name: str = ""
    tool_call_id: str = ""
    danger_level: str = ""
    args_preview: Any = None
    timeout_ms: int = 0


@dataclass
class AgentConfig:
    """create_agent 配置(亦可用等价的 dict 传入)。

    Attributes:
        token: 访问令牌(JWT);引擎 HTTP 承载由 JWTAuthMiddleware 统一保护。
        base_url: ai-service 基础 URL,默认 ``http://localhost:8803``。
        model: 模型名(任意受支持 provider;不传用引擎默认)。
        system_prompt: 线程 system prompt。
        tool_names: 内置工具名子集(不传则用全部内置 + MCP 超级工具池)。
        host_tools: 宿主工具处理器(名字 → 可调用对象);首个 run 前自动注册。
        host_tool_specs: 宿主工具描述与入参 schema(注册时附带给模型)。
        max_iterations: 最大迭代数,默认 8。
        permission_mode: 权限模式(default / acceptEdits / plan / bypassPermissions)。
        session_id / user_id / conversation_id / workspace: 会话元信息。
        on_event: 全局事件回调(可被 run 的 on_event 覆盖)。
        on_approval: 审批回调;不提供时一律 reject(默认拒绝,安全兜底)。
        timeout: 非流式 RPC 超时(秒)。
        opener: 自定义 urlopen(测试/拦截用)。
    """

    token: str
    base_url: str = DEFAULT_BASE_URL
    model: str = ""
    system_prompt: str = ""
    tool_names: Optional[list[str]] = None
    host_tools: Mapping[str, ToolHandler] = field(default_factory=dict)
    host_tool_specs: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    max_iterations: int = 0
    permission_mode: str = ""
    session_id: str = ""
    user_id: str = ""
    conversation_id: str = ""
    workspace: str = ""
    on_event: Optional[EventCallback] = None
    on_approval: Optional[ApprovalHandler] = None
    timeout: float = DEFAULT_TIMEOUT
    opener: Optional[Callable[..., Any]] = None


def _parse_sse_line(line: str) -> Optional[dict[str, Any]]:
    """解析一行 SSE 文本为 JSON-RPC 帧(空行/心跳/``[DONE]`` 返回 None)。"""
    trimmed = line.strip()
    if not trimmed or trimmed.startswith(":"):
        return None
    if not trimmed.startswith("data:"):
        return None
    payload = trimmed[5:].strip()
    if not payload or payload == "[DONE]":
        return None
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _safe_arguments(raw: Any) -> dict[str, Any]:
    """把 tool/execute 的 arguments 归一为 dict(字符串按 JSON 解析,失败保留原文)。"""
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw}
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    if raw is None:
        return {}
    return {"value": raw}


class Agent:
    """可编程 agent 句柄(同步)。

    通过 ``create_agent(config)`` 创建,无需直接实例化。
    """

    def __init__(self, config: AgentConfig) -> None:
        if not config.token:
            raise AgentEngineError(ENGINE_ERROR_CODES["invalid_request"], "token is required")
        self._config = config
        self._base_url = config.base_url.rstrip("/")
        self._opener = config.opener or urllib.request.urlopen
        self._rpc_id = 0
        self._thread_id: Optional[str] = None
        self._session_id: Optional[str] = None
        self._last_result: Optional[dict[str, Any]] = None
        self._host_tools: dict[str, dict[str, Any]] = {}
        for name, handler in config.host_tools.items():
            self._host_tools[name] = {
                "handler": handler,
                "spec": dict(config.host_tool_specs.get(name, {})),
            }

    # ------------------------------------------------------------------
    # 属性
    # ------------------------------------------------------------------

    @property
    def thread_id(self) -> Optional[str]:
        """线程 id;start()/首个 run() 之前为 None。"""
        return self._thread_id

    @property
    def started(self) -> bool:
        """是否已启动线程。"""
        return self._thread_id is not None

    @property
    def last_result(self) -> Optional[dict[str, Any]]:
        """最近一轮结果(引擎归一化载荷)。"""
        return self._last_result

    # ------------------------------------------------------------------
    # 协议底层
    # ------------------------------------------------------------------

    def _next_id(self) -> int:
        self._rpc_id += 1
        return self._rpc_id

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

    def _post(self, body: Any, *, stream: bool) -> Any:
        """POST 一条 JSON-RPC 报文;stream=True 时返回可迭代的响应对象。

        流式请求不设 timeout(长连接语义),非流式按 ``config.timeout`` 截止。
        """
        request = urllib.request.Request(
            f"{self._base_url}{RPC_PATH}",
            data=json.dumps(body).encode("utf-8"),
            headers=self._headers(),
            method="POST",
        )
        try:
            if stream:
                return self._opener(request)
            return self._opener(request, timeout=self._config.timeout)
        except urllib.error.HTTPError as e:
            body_bytes = e.read() if hasattr(e, "read") else b""
            message = f"引擎返回 HTTP {e.code}"
            try:
                parsed = json.loads(body_bytes.decode("utf-8"))
                message = str(parsed.get("message") or parsed.get("error") or message)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
            raise AgentEngineError(-e.code, message) from e
        except urllib.error.URLError as e:
            raise AgentEngineError(0, f"引擎连接失败: {e.reason}") from e

    def _call(self, method: str, params: Optional[dict[str, Any]] = None) -> Any:
        """单发(非流式)JSON-RPC 调用:返回 result,错误抛 :class:`AgentEngineError`。"""
        response = self._post(
            {"jsonrpc": "2.0", "id": self._next_id(), "method": method, "params": params or {}},
            stream=False,
        )
        try:
            raw = response.read()
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()
        try:
            envelope = json.loads(raw.decode("utf-8")) if raw else {}
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise AgentEngineError(
                ENGINE_ERROR_CODES["internal_error"], f"响应不是合法 JSON: {e}"
            ) from e
        error = envelope.get("error")
        if error:
            raise AgentEngineError(
                int(error.get("code", ENGINE_ERROR_CODES["internal_error"])),
                str(error.get("message", "")),
                error.get("data"),
            )
        return envelope.get("result")

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def initialize(self) -> dict[str, Any]:
        """能力握手:返回协议版本、能力位、方法清单与差异化能力说明。"""
        return dict(self._call("engine.initialize") or {})

    def start(self) -> dict[str, Any]:
        """显式启动线程(首个 run 会自动调用)。"""
        if self._thread_id:
            return {
                "threadId": self._thread_id,
                "sessionId": self._session_id or "",
                "status": "idle",
            }
        params: dict[str, Any] = {}
        cfg = self._config
        if cfg.system_prompt:
            params["systemPrompt"] = cfg.system_prompt
        if cfg.model:
            params["model"] = cfg.model
        if cfg.tool_names:
            params["tools"] = list(cfg.tool_names)
        if cfg.max_iterations:
            params["maxIterations"] = cfg.max_iterations
        if cfg.permission_mode:
            params["permissionMode"] = cfg.permission_mode
        if cfg.session_id:
            params["sessionId"] = cfg.session_id
        if cfg.user_id:
            params["userId"] = cfg.user_id
        if cfg.conversation_id:
            params["conversationId"] = cfg.conversation_id
        if cfg.workspace:
            params["workspace"] = cfg.workspace

        started = dict(self._call("thread.start", params) or {})
        self._thread_id = str(started.get("threadId"))
        self._session_id = str(started.get("sessionId") or "")
        # 宿主工具在首轮前注册,模型第一轮即可见
        for name, entry in list(self._host_tools.items()):
            self.register_tool(name, entry["handler"], **entry["spec"])
        return started

    def close(self) -> None:
        """关闭线程(释放引擎侧订阅与状态)。幂等。"""
        if not self._thread_id:
            return
        thread_id = self._thread_id
        self._thread_id = None
        self._session_id = None
        try:
            self._call("thread.close", {"threadId": thread_id})
        except AgentEngineError:
            pass

    # ------------------------------------------------------------------
    # 执行
    # ------------------------------------------------------------------

    def run(self, input: Any, on_event: Optional[EventCallback] = None) -> dict[str, Any]:
        """跑一轮(自动确保线程已启动)。

        Args:
            input: 输入(string 直传;也支持 ``{text}`` / ``[{role, content}]`` 形态)。
            on_event: 本轮事件回调(覆盖构造期 on_event)。

        Returns:
            引擎归一化的一轮结果(threadId / success / finalResponse / iterations /
            totalDurationMs / totalTokensUsed / checkpointId / compactionEvents 等)。
        """
        self._start_and_consume(
            "thread.prompt", {"input": input}, on_event
        )
        assert self._last_result is not None
        return self._last_result

    def resume(
        self, checkpoint_id: str = "", on_event: Optional[EventCallback] = None
    ) -> dict[str, Any]:
        """从 checkpoint 断点续跑。"""
        params: dict[str, Any] = {}
        if checkpoint_id:
            params["checkpointId"] = checkpoint_id
        self._start_and_consume("thread.resume", params, on_event)
        assert self._last_result is not None
        return self._last_result

    def _start_and_consume(
        self, method: str, params: dict[str, Any], on_event: Optional[EventCallback]
    ) -> None:
        """启动线程(如需)→ 发流式方法并消费完事件流。"""
        self.start()
        for _ in self._run_stream(
            method, {"threadId": self._thread_id, **params}, on_event
        ):
            pass

    def stream(self, input: Any, on_event: Optional[EventCallback] = None) -> Iterator[AgentEngineEvent]:
        """跑一轮并逐帧产出事件(生成器耗尽后 :attr:`last_result` 可读)。

        本方法**立即**启动线程(非惰性):线程启动失败会在此处直接抛错,而不是等到
        首次迭代才暴露。
        """
        self.start()
        return self._run_stream(
            "thread.prompt", {"threadId": self._thread_id, "input": input}, on_event
        )

    def interrupt(self, mode: str = "cancel") -> dict[str, Any]:
        """中断当前轮次:``cancel``=取消 / ``pause``=暂停并落 checkpoint。"""
        return dict(self._call("thread.interrupt", {"threadId": self._thread_id, "mode": mode}) or {})

    def exec_once(
        self,
        input: Any,
        on_event: Optional[EventCallback] = None,
        **params: Any,
    ) -> dict[str, Any]:
        """一次性非交互执行(2026-09-18 立,对标 Codex ``codex exec`` headless):
        服务端临时线程跑单轮后即弃,返回结构化结果;过程事件经 ``on_event`` 流出。
        额外 kwargs(model/systemPrompt/permissionMode/...)透传引擎。"""
        for _ in self._run_stream("agent.exec", {"input": input, **params}, on_event):
            pass
        assert self._last_result is not None
        return self._last_result

    def state(self) -> dict[str, Any]:
        """线程状态(状态机 + 迭代数 + checkpoint + 成本)。"""
        return dict(self._call("thread.state", {"threadId": self._thread_id}) or {})

    def compact(self, keep_recent: Optional[int] = None) -> dict[str, Any]:
        """手动压缩线程历史(2026-09-18 第二批,对标 Codex /compact)。"""
        params: dict[str, Any] = {"threadId": self._thread_id}
        if keep_recent is not None:
            params["keepRecent"] = keep_recent
        return dict(self._call("thread.compact", params) or {})

    def export_thread(self, path: Optional[str] = None) -> dict[str, Any]:
        """导出线程为 JSONL(2026-09-18 第二批,对标 Codex rollout 导出)。"""
        params = {"threadId": self._thread_id}
        if path is not None:
            params["path"] = path
        return dict(self._call("thread.export", params) or {})

    def get_plan(self) -> dict[str, Any]:
        """读取线程当前计划(update_plan 内置工具写入)。"""
        return dict(self._call("thread.plan", {"threadId": self._thread_id}) or {})

    def enqueue(self, input: Any) -> dict[str, Any]:
        """消息入队(2026-09-18 第三批,对标 Codex Steer:轮中转向自动续跑)。"""
        return dict(self._call("thread.enqueue", {"threadId": self._thread_id, "input": input}) or {})

    def set_goal(self, goal: Optional[str]) -> dict[str, Any]:
        """设置/清除线程持久目标(2026-09-18 第三批,对标 Codex Goals;None 清除)。"""
        return dict(self._call("thread.goal", {"threadId": self._thread_id, "goal": goal}) or {})

    def review(self, focus: Optional[str] = None) -> dict[str, Any]:
        """审查模式(2026-09-18 第三批,对标 Codex review:派生审查子代理)。"""
        params: dict[str, Any] = {"threadId": self._thread_id}
        if focus is not None:
            params["focus"] = focus
        return dict(self._call("thread.review", params) or {})

    def list_threads(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        include_archived: bool = False,
    ) -> dict[str, Any]:
        """线程清单(2026-09-18 第七批,对标 Codex thread/list:分页+运行态合并)。"""
        params: dict[str, Any] = {"includeArchived": include_archived}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return dict(self._call("thread.list", params) or {})

    def archive_thread(self, thread_id: str, archived: bool = True) -> dict[str, Any]:
        """归档/恢复线程(2026-09-18 第七批,对标 Codex thread/archive)。"""
        return dict(
            self._call("thread.archive", {"threadId": thread_id, "archived": archived})
            or {}
        )

    def fork_thread(
        self, thread_id: Optional[str] = None, title: Optional[str] = None
    ) -> dict[str, Any]:
        """分叉线程(2026-09-18 第七批,对标 Codex thread/fork:深拷贝独立演进)。"""
        params: dict[str, Any] = {
            "threadId": thread_id or self._thread_id,
        }
        if title is not None:
            params["title"] = title
        return dict(self._call("thread.fork", params) or {})

    def search_tools(self, query: str, limit: Optional[int] = None) -> dict[str, Any]:
        """工具目录搜索(2026-09-18 第四批,对标 Codex tool_search 延迟装载)。"""
        params: dict[str, Any] = {"query": query}
        if self._thread_id:
            params["threadId"] = self._thread_id
        if limit is not None:
            params["limit"] = limit
        return dict(self._call("tools.search", params) or {})

    def load_tool(self, name: str) -> dict[str, Any]:
        """装载工具进线程(2026-09-18 第四批,对标 LoadableToolSpec materialize)。"""
        return dict(
            self._call("tools.load", {"threadId": self._thread_id, "name": name}) or {}
        )

    def respond_elicitation(self, elicitation_id: str, value: Any = None) -> dict[str, Any]:
        """用户结构化提问回填(2026-09-18 第四批,对标 Codex elicitation)。"""
        return dict(
            self._call(
                "elicitation.respond", {"elicitationId": elicitation_id, "value": value}
            )
            or {}
        )

    def _run_stream(
        self,
        method: str,
        params: dict[str, Any],
        on_event: Optional[EventCallback],
    ) -> Iterator[AgentEngineEvent]:
        """流式方法核心:逐帧消费 SSE,就地处理宿主工具与审批,收尾归一结果。"""
        request_id = self._next_id()
        response = self._post(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params},
            stream=True,
        )
        emit = on_event or self._config.on_event
        final: Optional[dict[str, Any]] = None
        try:
            for raw_line in response:
                line = raw_line.decode("utf-8", "replace") if isinstance(raw_line, bytes) else str(raw_line)
                frame = _parse_sse_line(line)
                if frame is None:
                    continue
                frame_method = frame.get("method")
                if frame_method == "thread/event":
                    event = self._to_event(frame)
                    if emit is not None:
                        emit(event)
                    yield event
                    continue
                if frame_method == "tool/execute":
                    self._handle_host_tool(frame.get("params") or {})
                    continue
                if frame_method == "approval/request":
                    self._handle_approval(frame.get("params") or {})
                    continue
                if frame.get("id") == request_id:
                    final = frame
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()

        if final is None:
            raise AgentEngineError(
                ENGINE_ERROR_CODES["internal_error"], "流式响应未包含方法响应帧"
            )
        error = final.get("error")
        if error:
            raise AgentEngineError(
                int(error.get("code", ENGINE_ERROR_CODES["internal_error"])),
                str(error.get("message", "")),
                error.get("data"),
            )
        result = dict(final.get("result") or {})
        self._last_result = result
        if result.get("threadId"):
            self._thread_id = str(result["threadId"])

    def _to_event(self, frame: Mapping[str, Any]) -> AgentEngineEvent:
        params = frame.get("params") or {}
        payload = params.get("payload") or {}
        return AgentEngineEvent(
            name=str(params.get("event") or ""),
            payload=payload if isinstance(payload, Mapping) else {"value": payload},
            thread_id=str(params.get("threadId") or self._thread_id or ""),
        )

    def _handle_host_tool(self, params: Mapping[str, Any]) -> None:
        """tool/execute → 本进程执行 handler → tools.result 回传。"""
        request_id = str(params.get("requestId") or "")
        name = str(params.get("name") or "")
        entry = self._host_tools.get(name)
        if entry is None:
            body: dict[str, Any] = {"requestId": request_id, "error": f"未注册的宿主工具: {name}"}
        else:
            try:
                result = entry["handler"](
                    AgentToolContext(
                        request_id=request_id,
                        thread_id=str(params.get("threadId") or self._thread_id or ""),
                        name=name,
                        arguments=_safe_arguments(params.get("arguments")),
                        timeout_ms=int(params.get("timeoutMs") or 0),
                    )
                )
                body = {"requestId": request_id, "result": result}
            except Exception as e:  # noqa: BLE001 - 宿主工具异常须回传而非中断编排
                body = {"requestId": request_id, "error": str(e)}
        try:
            self._call("tools.result", body)
        except AgentEngineError:
            pass

    def _handle_approval(self, params: Mapping[str, Any]) -> None:
        """approval/request → 宿主裁决 → approval.respond 回填。"""
        request = AgentApprovalRequest(
            request_id=str(params.get("requestId") or ""),
            thread_id=str(params.get("threadId") or self._thread_id or ""),
            tool_name=str(params.get("toolName") or ""),
            tool_call_id=str(params.get("toolCallId") or ""),
            danger_level=str(params.get("dangerLevel") or ""),
            args_preview=params.get("argsPreview"),
            timeout_ms=int(params.get("timeoutMs") or 0),
        )
        decision = "reject"  # 未配置回调 → 默认拒绝
        if self._config.on_approval is not None and request.request_id:
            try:
                decision = self._config.on_approval(request)
            except Exception:  # noqa: BLE001 - 审批回调异常一律按拒绝处理
                decision = "reject"
        if not request.request_id:
            return
        try:
            self._call(
                "approval.respond",
                {"approvalId": request.request_id, "decision": decision},
            )
        except AgentEngineError:
            pass

    # ------------------------------------------------------------------
    # 工具 / 差异化管理
    # ------------------------------------------------------------------

    def register_tool(
        self,
        name: str,
        handler: ToolHandler,
        description: str = "",
        parameters: Optional[Mapping[str, Any]] = None,
        timeout_ms: int = 0,
    ) -> None:
        """注入宿主工具(立即注册,下一轮生效)。"""
        self._host_tools[name] = {
            "handler": handler,
            "spec": {
                k: v
                for k, v in (
                    ("description", description),
                    ("parameters", parameters),
                    ("timeoutMs", timeout_ms),
                )
                if v
            },
        }
        if not self._thread_id:
            return  # 线程未启动:start() 时统一注册
        params: dict[str, Any] = {"threadId": self._thread_id, "name": name}
        if description:
            params["description"] = description
        if parameters:
            params["parameters"] = dict(parameters)
        if timeout_ms:
            params["timeoutMs"] = timeout_ms
        self._call("tools.register", params)

    def list_tools(self) -> dict[str, Any]:
        """合并工具清单(MCP 超级工具池 + 宿主工具)。"""
        return dict(self._call("tools.list", {"threadId": self._thread_id}) or {})

    def cost(self, filter: Optional[Mapping[str, Any]] = None) -> dict[str, Any]:
        """成本账本汇总(含 prompt 缓存三段计价)。"""
        params = {"filter": dict(filter)} if filter else {}
        return dict(self._call("cost.report", params) or {})

    def models(self) -> dict[str, Any]:
        """模型路由 + 单价 + 缓存乘数清单。"""
        return dict(self._call("models.list") or {})

    def respond_approval(self, request_id: str, decision: str = "reject") -> dict[str, Any]:
        """回填审批决策(宿主自行裁决路径)。"""
        return dict(
            self._call("approval.respond", {"approvalId": request_id, "decision": decision}) or {}
        )


class AsyncAgent:
    """可编程 agent 句柄(asyncio 版)。

    底层复用同步 :class:`Agent`:每个调用经 ``asyncio.to_thread`` 落到工作线程执行,
    因此宿主工具处理器与审批回调也在该线程上运行(与 asyncio 事件循环解耦)。
    ``astream()`` 在后台线程消费同步 SSE、经 :class:`asyncio.Queue` 回传事件帧。
    """

    def __init__(self, agent: Agent) -> None:
        self._agent = agent

    @property
    def thread_id(self) -> Optional[str]:
        """线程 id。"""
        return self._agent.thread_id

    @property
    def started(self) -> bool:
        """是否已启动线程。"""
        return self._agent.started

    @property
    def last_result(self) -> Optional[dict[str, Any]]:
        """最近一轮结果。"""
        return self._agent.last_result

    async def initialize(self) -> dict[str, Any]:
        """能力握手。"""
        return await asyncio.to_thread(self._agent.initialize)

    async def start(self) -> dict[str, Any]:
        """启动线程(首个 run 会自动调用)。"""
        return await asyncio.to_thread(self._agent.start)

    async def close(self) -> None:
        """关闭线程(幂等)。"""
        await asyncio.to_thread(self._agent.close)

    async def run(self, input: Any, on_event: Optional[EventCallback] = None) -> dict[str, Any]:
        """跑一轮(阻塞逻辑在工作线程执行)。"""
        return await asyncio.to_thread(self._agent.run, input, on_event)

    async def resume(
        self, checkpoint_id: str = "", on_event: Optional[EventCallback] = None
    ) -> dict[str, Any]:
        """从 checkpoint 续跑。"""
        return await asyncio.to_thread(self._agent.resume, checkpoint_id, on_event)

    async def interrupt(self, mode: str = "cancel") -> dict[str, Any]:
        """中断当前轮次。"""
        return await asyncio.to_thread(self._agent.interrupt, mode)

    async def state(self) -> dict[str, Any]:
        """线程状态。"""
        return await asyncio.to_thread(self._agent.state)

    async def compact(self, keep_recent: Optional[int] = None) -> dict[str, Any]:
        """手动压缩线程历史(2026-09-18 第二批)。"""
        return await asyncio.to_thread(self._agent.compact, keep_recent)

    async def export_thread(self, path: Optional[str] = None) -> dict[str, Any]:
        """导出线程为 JSONL(2026-09-18 第二批)。"""
        return await asyncio.to_thread(self._agent.export_thread, path)

    async def get_plan(self) -> dict[str, Any]:
        """读取线程当前计划(update_plan 内置工具写入)。"""
        return await asyncio.to_thread(self._agent.get_plan)

    async def enqueue(self, input: Any) -> dict[str, Any]:
        """消息入队(2026-09-18 第三批,对标 Codex Steer:轮中转向自动续跑)。"""
        return await asyncio.to_thread(self._agent.enqueue, input)

    async def set_goal(self, goal: Optional[str]) -> dict[str, Any]:
        """设置/清除线程持久目标(2026-09-18 第三批,对标 Codex Goals)。"""
        return await asyncio.to_thread(self._agent.set_goal, goal)

    async def review(self, focus: Optional[str] = None) -> dict[str, Any]:
        """审查模式(2026-09-18 第三批,对标 Codex review:派生审查子代理)。"""
        return await asyncio.to_thread(self._agent.review, focus)

    async def search_tools(self, query: str, limit: Optional[int] = None) -> dict[str, Any]:
        """工具目录搜索(2026-09-18 第四批,对标 Codex tool_search 延迟装载)。"""
        return await asyncio.to_thread(self._agent.search_tools, query, limit)

    async def load_tool(self, name: str) -> dict[str, Any]:
        """装载工具进线程(2026-09-18 第四批,对标 LoadableToolSpec materialize)。"""
        return await asyncio.to_thread(self._agent.load_tool, name)

    async def respond_elicitation(
        self, elicitation_id: str, value: Any = None
    ) -> dict[str, Any]:
        """用户结构化提问回填(2026-09-18 第四批,对标 Codex elicitation)。"""
        return await asyncio.to_thread(self._agent.respond_elicitation, elicitation_id, value)

    async def register_tool(
        self,
        name: str,
        handler: ToolHandler,
        description: str = "",
        parameters: Optional[Mapping[str, Any]] = None,
        timeout_ms: int = 0,
    ) -> None:
        """注入宿主工具(下一轮生效)。"""
        await asyncio.to_thread(
            self._agent.register_tool, name, handler, description, parameters, timeout_ms
        )

    async def list_tools(self) -> dict[str, Any]:
        """合并工具清单。"""
        return await asyncio.to_thread(self._agent.list_tools)

    async def cost(self, filter: Optional[Mapping[str, Any]] = None) -> dict[str, Any]:
        """成本账本汇总。"""
        return await asyncio.to_thread(self._agent.cost, filter)

    async def models(self) -> dict[str, Any]:
        """模型路由清单。"""
        return await asyncio.to_thread(self._agent.models)

    async def respond_approval(self, request_id: str, decision: str = "reject") -> dict[str, Any]:
        """回填审批决策。"""
        return await asyncio.to_thread(self._agent.respond_approval, request_id, decision)

    async def astream(
        self, input: Any, on_event: Optional[EventCallback] = None
    ) -> "AsyncIterator[AgentEngineEvent]":
        """跑一轮并以异步生成器逐帧产出事件。

        底层同步 SSE 消费在工作线程执行,事件经 :class:`asyncio.Queue` 回传到事件循环;
        本轮异常(含协议错误)会在异步生成器内重新抛出。
        """
        queue: "asyncio.Queue[Any]" = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _pump() -> None:
            try:
                for event in self._agent.stream(input, on_event):
                    loop.call_soon_threadsafe(queue.put_nowait, event)
            except BaseException as e:  # noqa: BLE001 - 异常经队列回传到事件循环
                loop.call_soon_threadsafe(queue.put_nowait, e)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, _STREAM_END)

        pump = loop.run_in_executor(None, _pump)
        try:
            while True:
                item = await queue.get()
                if item is _STREAM_END:
                    break
                if isinstance(item, BaseException):
                    raise item
                yield item
        finally:
            await pump


def _coerce_config(config: Mapping[str, Any] | AgentConfig) -> AgentConfig:
    """把 dict 配置归一为 :class:`AgentConfig`(未知键忽略)。"""
    if isinstance(config, AgentConfig):
        return config
    known = {f for f in AgentConfig.__dataclass_fields__}
    return AgentConfig(**{k: v for k, v in config.items() if k in known})


def create_agent(config: Mapping[str, Any] | AgentConfig) -> Agent:
    """创建一个模型无关的可编程 agent(编程编排层入口,同步版)。

    Args:
        config: :class:`AgentConfig` 或等价 dict(见该类字段说明)。

    Returns:
        :class:`Agent` 句柄。

    Raises:
        AgentEngineError: 缺少 token 时。
    """
    return Agent(_coerce_config(config))


def create_agent_async(config: Mapping[str, Any] | AgentConfig) -> AsyncAgent:
    """创建一个模型无关的可编程 agent(asyncio 版)。"""
    return AsyncAgent(Agent(_coerce_config(config)))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
