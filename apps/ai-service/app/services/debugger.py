"""DAP(Debug Adapter Protocol)session 管理 + AI 工具桥接。

设计:
- AI Agent 可调用 debug 工具实现"自主调试"(读 stack → 分析变量 → 改 breakpoint → continue)
- 支持多语言:node(js-debug-adapter)/ python(debugpy)/ web(browser DAP)
- session 生命周期:launch/attach → set_breakpoints → continue → step → get_stack/variables → disconnect
- 超时自动清理(30 分钟无活动)
- DAP 协议:JSON-RPC over stdio,Content-Length header framing(与 LSP 相同的传输层)

协议参考: https://microsoft.github.io/debug-adapter-protocol/
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_SESSION_TIMEOUT = 30 * 60  # 30 分钟
DAP_REQUEST_TIMEOUT = 10.0  # 单请求 10s 超时
DAP_INIT_TIMEOUT = 15.0  # initialize 握手 15s


# ==================== DAP 协议编解码 ====================


def encode_dap_message(message: dict[str, Any]) -> bytes:
    """编码 DAP 消息为 Content-Length header + JSON body 的字节流。"""
    body = json.dumps(message).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    return header + body


class DapProtocolReader:
    """从 asyncio.StreamReader 解析 DAP 消息(Content-Length framing)。

    DAP 传输层与 LSP 相同:每条消息前有 ``Content-Length: N\\r\\n\\r\\n`` header,
    后跟 N 字节的 JSON body。本类负责缓冲 + 解析这一帧格式。
    """

    def __init__(self, reader: asyncio.StreamReader) -> None:
        self._reader = reader
        self._buffer = b""

    async def read_message(self) -> Optional[dict[str, Any]]:
        """读取下一条 DAP 消息;流关闭(EOF)返回 None。"""
        while True:
            msg = self._try_parse()
            if msg is not None:
                return msg
            chunk = await self._reader.read(4096)
            if not chunk:
                return None  # EOF
            self._buffer += chunk

    def _try_parse(self) -> Optional[dict[str, Any]]:
        header_end = self._buffer.find(b"\r\n\r\n")
        if header_end == -1:
            return None
        header = self._buffer[:header_end].decode("ascii", errors="replace")
        content_length: Optional[int] = None
        for line in header.split("\r\n"):
            if line.lower().startswith("content-length:"):
                try:
                    content_length = int(line.split(":", 1)[1].strip())
                except ValueError:
                    pass
        if content_length is None:
            # 无效 header,跳过这一段
            self._buffer = self._buffer[header_end + 4 :]
            return None
        body_start = header_end + 4
        if len(self._buffer) - body_start < content_length:
            return None  # body 尚不完整
        body = self._buffer[body_start : body_start + content_length]
        self._buffer = self._buffer[body_start + content_length :]
        try:
            return json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning("DAP 消息 JSON 解析失败: %s", e)
            return None


# ==================== DapClient — 单 adapter 协议客户端 ====================


EventHandler = Callable[[dict[str, Any]], None]


class DapClient:
    """单个 debug adapter 子进程的异步 DAP 客户端。

    职责:
    - 管理 DAP seq 计数器 + pending 请求 Future 映射
    - 后台 read loop 解析消息,分发 response/event
    - 提供 send_request / on_event 高层 API
    - 优雅关闭(disconnect + kill)
    """

    def __init__(self, process: Any) -> None:
        self._process = process
        self._seq = 0
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._event_handlers: dict[str, list[EventHandler]] = {}
        self._reader = DapProtocolReader(process.stdout)
        self._read_task: Optional[asyncio.Task[None]] = None
        self._terminated = asyncio.Event()

    @property
    def terminated(self) -> bool:
        return self._terminated.is_set()

    async def start(self) -> None:
        """启动 read loop + initialize 握手。"""
        self._read_task = asyncio.create_task(self._read_loop())
        await self._do_initialize()

    async def _read_loop(self) -> None:
        try:
            while True:
                msg = await self._reader.read_message()
                if msg is None:
                    break
                self._handle_message(msg)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("DAP read loop 异常: %s", e)
        finally:
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(RuntimeError("debug adapter 已关闭"))
            self._pending.clear()
            self._terminated.set()

    def _handle_message(self, msg: dict[str, Any]) -> None:
        msg_type = msg.get("type")
        if msg_type == "response":
            req_seq = msg.get("request_seq")
            fut = self._pending.pop(req_seq, None)  # type: ignore[arg-type]
            if fut and not fut.done():
                if msg.get("success"):
                    fut.set_result(msg.get("body"))
                else:
                    fut.set_exception(
                        RuntimeError(msg.get("message", "DAP 请求失败"))
                    )
        elif msg_type == "event":
            event_name = msg.get("event", "")
            for h in self._event_handlers.get(event_name, []):
                try:
                    h(msg.get("body") or {})
                except Exception:
                    logger.exception("DAP event handler 异常(event=%s)", event_name)

    async def send_request(
        self,
        command: str,
        arguments: Optional[dict[str, Any]] = None,
        timeout: float = DAP_REQUEST_TIMEOUT,
    ) -> Any:
        """发送 DAP 请求并等待响应,返回 response body。超时/失败抛 RuntimeError。"""
        if self._terminated.is_set():
            raise RuntimeError("debug adapter 已关闭")
        self._seq += 1
        seq = self._seq
        msg: dict[str, Any] = {"seq": seq, "type": "request", "command": command}
        if arguments:
            msg["arguments"] = arguments
        data = encode_dap_message(msg)
        stdin = self._process.stdin
        if stdin is None:
            raise RuntimeError("debug adapter stdin 不可用")
        stdin.write(data)
        await stdin.drain()
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[Any] = loop.create_future()
        self._pending[seq] = fut
        try:
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            self._pending.pop(seq, None)
            raise RuntimeError(f"DAP 请求 {command} 超时({timeout}s)")

    def on_event(self, event: str, handler: EventHandler) -> None:
        """注册 DAP event 处理器(stopped/breakpoint/output/terminated 等)。"""
        self._event_handlers.setdefault(event, []).append(handler)

    async def _do_initialize(self) -> None:
        await self.send_request(
            "initialize",
            {
                "clientID": "ihui-ai",
                "clientName": "IHUI AI",
                "adapterID": "generic",
                "locale": "en-US",
                "linesStartAt1": True,
                "columnsStartAt1": True,
                "pathFormat": "path",
                "supportsVariableType": True,
                "supportsRunInTerminalRequest": False,
            },
            timeout=DAP_INIT_TIMEOUT,
        )

    async def disconnect(self) -> None:
        """发送 disconnect 请求 + 终止子进程。"""
        try:
            await self.send_request(
                "disconnect",
                {"terminateDebuggee": True},
                timeout=3.0,
            )
        except Exception:
            pass
        if self._read_task and not self._read_task.done():
            self._read_task.cancel()
        try:
            self._process.kill()
        except ProcessLookupError:
            pass
        except Exception:
            pass


# ==================== DebugSession ====================


@dataclass
class DebugSession:
    """单个 debug session 的运行时状态。"""

    session_id: str
    language: str  # 'node' | 'python' | 'web'
    process: Optional[Any] = None  # asyncio.subprocess.Process
    status: str = "initializing"  # initializing/running/stopped/terminated
    breakpoints: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    last_activity: float = field(default_factory=time.time)
    started_at: float = field(default_factory=time.time)
    initialized: asyncio.Event = field(default_factory=asyncio.Event)
    client: Optional[DapClient] = None
    current_thread_id: Optional[int] = None
    # stopped 事件等待器:continue/step 等待下次 stopped
    _stopped_waiter: Optional[asyncio.Future[dict[str, Any]]] = None

    def touch(self) -> None:
        self.last_activity = time.time()

    def to_info(self) -> dict[str, Any]:
        """转为 DebugSessionInfo 摘要(列表展示用)。"""
        return {
            "sessionId": self.session_id,
            "language": self.language,
            "status": self.status,
            "startedAt": self.started_at,
            "lastActivityAt": self.last_activity,
        }


# ==================== Adapter 命令检测 ====================


def get_adapter_command(language: str) -> tuple[list[str], Optional[str]]:
    """返回 debug adapter 的启动命令 + 适配器 ID。

    返回 (command_args, adapter_id)。adapter_id 为 None 表示不可用。
    """
    if language == "node":
        return (["js-debug-adapter"], "pwa-node")
    if language == "python":
        return (["python", "-m", "debugpy", "--adapter"], "debugpy")
    if language == "web":
        return (["js-debug-adapter"], "pwa-chrome")
    return ([], None)


def check_adapter_available(language: str) -> tuple[bool, str]:
    """检测 debug adapter 是否可用(快速检测,不实际启动)。

    返回 (available, message)。
    """
    cmd_args, adapter_id = get_adapter_command(language)
    if not adapter_id:
        return False, f"不支持的语言: {language}"
    # 不实际执行,仅返回命令信息;真正检测在 spawn 时进行
    return True, " ".join(cmd_args)


# ==================== DebugSessionManager ====================


class DebugSessionManager:
    """多 debug session 管理器。

    可被 mcp_server 调用为 AI 工具,实现"自主调试"能力。
    session 生命周期:launch/attach → set_breakpoints → continue → step → disconnect。
    """

    def __init__(self, session_timeout: int = DEFAULT_SESSION_TIMEOUT) -> None:
        self._sessions: dict[str, DebugSession] = {}
        self._timeout = session_timeout
        self._lock = asyncio.Lock()

    # ---- 内部:创建 adapter 子进程 ----

    async def _spawn_adapter(
        self, language: str, cwd: Optional[str] = None
    ) -> Any:
        """启动 debug adapter 子进程,返回 asyncio.subprocess.Process。"""
        cmd_args, _ = get_adapter_command(language)
        if not cmd_args:
            raise RuntimeError(f"不支持的语言: {language}")
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )
        except FileNotFoundError as e:
            raise RuntimeError(
                f"debug adapter 启动失败(可能未安装): {' '.join(cmd_args)} — {e}"
            ) from e
        return proc

    def _create_client(self, process: Any) -> DapClient:
        """创建 DapClient(单独方法,便于测试 mock)。"""
        return DapClient(process)

    def _setup_event_handlers(self, session: DebugSession) -> None:
        """为 session 注册 DAP event 处理器。"""
        client = session.client
        if client is None:
            return

        def on_stopped(body: dict[str, Any]) -> None:
            session.status = "stopped"
            session.current_thread_id = body.get("threadId")
            if session._stopped_waiter and not session._stopped_waiter.done():
                session._stopped_waiter.set_result(body)
            session.touch()

        def on_terminated(body: dict[str, Any]) -> None:
            session.status = "terminated"

        def on_continued(body: dict[str, Any]) -> None:
            session.status = "running"
            session.touch()

        client.on_event("stopped", on_stopped)
        client.on_event("terminated", on_terminated)
        client.on_event("continued", on_continued)

    def _new_stopped_waiter(self, session: DebugSession) -> asyncio.Future[dict[str, Any]]:
        """创建新的 stopped 事件等待器(continue/step 前调用)。"""
        loop = asyncio.get_event_loop()
        session._stopped_waiter = loop.create_future()
        return session._stopped_waiter

    # ---- 公共 API ----

    async def launch(
        self,
        language: str,
        command: str,
        args: Optional[list[str]] = None,
        cwd: Optional[str] = None,
        env: Optional[dict[str, str]] = None,
        stop_on_entry: bool = False,
    ) -> str:
        """启动 debug adapter + launch 请求,返回 session_id。"""
        async with self._lock:
            session_id = str(uuid.uuid4())
            session = DebugSession(session_id=session_id, language=language)
            self._sessions[session_id] = session

        try:
            proc = await self._spawn_adapter(language, cwd)
            session.process = proc
            client = self._create_client(proc)
            session.client = client
            await client.start()

            # 发送 launch 请求(adapter-specific args)
            _, adapter_id = get_adapter_command(language)
            launch_args: dict[str, Any] = {
                "program": command,
                "args": args or [],
                "cwd": cwd,
                "env": env or {},
                "stopOnEntry": stop_on_entry,
            }
            # js-debug-adapter 需要 type 字段
            if language == "node":
                launch_args["type"] = "pwa-node"
                launch_args["name"] = "IHUI Launch"
            elif language == "python":
                launch_args["type"] = "python"
                launch_args["name"] = "IHUI Launch"
            elif language == "web":
                launch_args["type"] = "pwa-chrome"
                launch_args["url"] = command
                launch_args.pop("program", None)

            self._setup_event_handlers(session)
            await client.send_request("launch", launch_args)
            session.status = "running"
            session.initialized.set()
            session.touch()
            return session_id
        except Exception as e:
            session.status = "terminated"
            if session.client:
                await session.client.disconnect()
            async with self._lock:
                self._sessions.pop(session_id, None)
            raise

    async def attach(
        self, language: str, port: int, host: str = "localhost"
    ) -> str:
        """attach 到已运行的 debug adapter(远程调试)。"""
        async with self._lock:
            session_id = str(uuid.uuid4())
            session = DebugSession(session_id=session_id, language=language)
            self._sessions[session_id] = session

        try:
            proc = await self._spawn_adapter(language)
            session.process = proc
            client = self._create_client(proc)
            session.client = client
            await client.start()

            attach_args: dict[str, Any] = {
                "port": port,
                "host": host,
            }
            if language == "node":
                attach_args["type"] = "pwa-node"
                attach_args["name"] = "IHUI Attach"
            elif language == "python":
                attach_args["type"] = "python"
                attach_args["name"] = "IHUI Attach"
            elif language == "web":
                attach_args["type"] = "pwa-chrome"
                attach_args["url"] = f"http://{host}:{port}"
                attach_args["port"] = port

            self._setup_event_handlers(session)
            await client.send_request("attach", attach_args)
            session.status = "running"
            session.initialized.set()
            session.touch()
            return session_id
        except Exception as e:
            session.status = "terminated"
            if session.client:
                await session.client.disconnect()
            async with self._lock:
                self._sessions.pop(session_id, None)
            raise

    async def set_breakpoints(
        self, session_id: str, file: str, lines: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """设置 breakpoints,返回已验证的 breakpoint 列表。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        session.touch()
        bp_args: list[dict[str, Any]] = []
        for ln in lines:
            bp: dict[str, Any] = {"line": ln["line"]}
            if "condition" in ln and ln["condition"]:
                bp["condition"] = ln["condition"]
            if "hitCondition" in ln and ln["hitCondition"]:
                bp["hitCondition"] = ln["hitCondition"]
            bp_args.append(bp)
        body = await session.client.send_request(
            "setBreakpoints",
            {
                "source": {"path": file},
                "breakpoints": bp_args,
                "lines": [ln["line"] for ln in lines],
                "sourceModified": False,
            },
        )
        verified = (body or {}).get("breakpoints", []) if body else []
        session.breakpoints[file] = verified
        session.touch()
        return verified

    async def continue_execution(self, session_id: str) -> dict[str, Any]:
        """continue,等待 stopped 事件,返回 {reason, threadId, ...}。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        if session.current_thread_id is None:
            raise RuntimeError("无当前线程(需先 stopped 才能 continue)")
        thread_id = session.current_thread_id
        waiter = self._new_stopped_waiter(session)
        await session.client.send_request("continue", {"threadId": thread_id})
        session.status = "running"
        session.touch()
        try:
            stopped_body = await asyncio.wait_for(waiter, timeout=300.0)
            return stopped_body
        except asyncio.TimeoutError:
            # 程序可能正常结束(terminated)或长时间运行
            if session.status == "terminated":
                return {"reason": "terminated", "threadId": thread_id}
            return {"reason": "timeout", "threadId": thread_id}

    async def step(
        self, session_id: str, step_type: str = "next"
    ) -> dict[str, Any]:
        """单步执行(next/stepIn/stepOut)。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        if session.current_thread_id is None:
            raise RuntimeError("无当前线程(需先 stopped 才能 step)")
        valid = {"next", "stepIn", "stepOut", "stepBack"}
        if step_type not in valid:
            raise RuntimeError(f"无效 stepType: {step_type},应为 {valid}")
        thread_id = session.current_thread_id
        waiter = self._new_stopped_waiter(session)
        await session.client.send_request(step_type, {"threadId": thread_id})
        session.touch()
        try:
            stopped_body = await asyncio.wait_for(waiter, timeout=60.0)
            return stopped_body
        except asyncio.TimeoutError:
            if session.status == "terminated":
                return {"reason": "terminated", "threadId": thread_id}
            return {"reason": "timeout", "threadId": thread_id}

    async def get_stack_trace(self, session_id: str) -> list[dict[str, Any]]:
        """获取调用栈(当前线程)。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        if session.current_thread_id is None:
            raise RuntimeError("无当前线程(需先 stopped 才能获取 stack trace)")
        body = await session.client.send_request(
            "stackTrace",
            {
                "threadId": session.current_thread_id,
                "startFrame": 0,
                "levels": 20,
            },
        )
        session.touch()
        return (body or {}).get("stackFrames", []) if body else []

    async def get_variables(
        self,
        session_id: str,
        frame_id: int,
        scope: str = "local",
    ) -> list[dict[str, Any]]:
        """获取变量(scopes + variables,按 scope 名称过滤)。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        # 1. 获取所有 scopes
        scopes_body = await session.client.send_request(
            "scopes", {"frameId": frame_id}
        )
        scopes = (scopes_body or {}).get("scopes", []) if scopes_body else []
        # 2. 找到匹配的 scope(DAP scope name 可能是 "Locals"/"Globals"/"Closure")
        scope_lower = scope.lower()
        target_scope: Optional[dict[str, Any]] = None
        for s in scopes:
            name = str(s.get("name", "")).lower()
            if scope_lower in name or name in scope_lower:
                target_scope = s
                break
        if target_scope is None:
            # 无匹配 scope,返回所有 scopes 的变量
            results: list[dict[str, Any]] = []
            for s in scopes:
                var_ref = s.get("variablesReference", 0)
                if var_ref:
                    var_body = await session.client.send_request(
                        "variables", {"variablesReference": var_ref}
                    )
                    results.extend((var_body or {}).get("variables", []))
            session.touch()
            return results
        var_ref = target_scope.get("variablesReference", 0)
        if not var_ref:
            return []
        var_body = await session.client.send_request(
            "variables", {"variablesReference": var_ref}
        )
        session.touch()
        return (var_body or {}).get("variables", []) if var_body else []

    async def evaluate(
        self,
        session_id: str,
        expression: str,
        frame_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """表达式求值(repl 上下文)。"""
        session = self._get_session(session_id)
        if session.client is None:
            raise RuntimeError("session 未初始化")
        args: dict[str, Any] = {"expression": expression, "context": "repl"}
        if frame_id is not None:
            args["frameId"] = frame_id
        result = await session.client.send_request("evaluate", args)
        session.touch()
        return result or {}

    async def disconnect(self, session_id: str) -> bool:
        """关闭 session。"""
        async with self._lock:
            session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        if session.client:
            try:
                await session.client.disconnect()
            except Exception:
                pass
        session.status = "terminated"
        return True

    async def list_sessions(self) -> list[dict[str, Any]]:
        """列出所有 session 摘要。"""
        return [s.to_info() for s in self._sessions.values()]

    async def cleanup_expired(self) -> int:
        """清理超时 session(30 分钟无活动),返回清理数量。"""
        now = time.time()
        expired_ids: list[str] = []
        for sid, session in self._sessions.items():
            if now - session.last_activity > self._timeout:
                expired_ids.append(sid)
        for sid in expired_ids:
            await self.disconnect(sid)
        return len(expired_ids)

    # ---- 内部 ----

    def _get_session(self, session_id: str) -> DebugSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise RuntimeError(f"debug session 不存在: {session_id}")
        if session.status == "terminated":
            raise RuntimeError(f"debug session 已终止: {session_id}")
        return session


# ==================== 全局单例 ====================

_debug_manager: Optional[DebugSessionManager] = None


def get_debug_manager() -> DebugSessionManager:
    global _debug_manager
    if _debug_manager is None:
        _debug_manager = DebugSessionManager()
    return _debug_manager
