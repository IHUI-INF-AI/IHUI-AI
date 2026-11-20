# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型侧交互式终端(2026-11-14 立,遵循统一工程规范)。

外部实现 的终端是**长寿命会话**:open 一次,后续 send/read/signal/close 都作用于同一
进程,而不是每条命令重启。IHUI 现有 `run_command`/`sandbox_session.exec` 都是
一次性执行;REPL、调试器、交互式脚手架这类需求只能"一条命令跑完",拿不到中间
提示与逐步输入。

本模块补最小闭环:
- `open_terminal`:启动一个长驻子进程(管道路径下为 stdin/stdout/stderr 管道 + 读线程);
- `send_terminal`:写入一行(可选追加换行);
- `read_terminal`:按 seq 增量读,支持有限等待(默认 1s)与字符上限;
- `signal_terminal`:interrupt/terminate/kill(Windows 用 CTRL_BREAK_EVENT);
- `close_terminal`:terminate → 2s 宽限 → kill,返回退出码;
- `list_terminals`:按调用者身份列出会话。

两种 stdio 后端(会话编排 / 所有权 / 上限 / 信号完全一致,只差"管道怎么连到子进程"):
- **默认 `pipes`**:三条匿名管道。边界(与外部实现的差异如实记录):面向 TTY 的程序
  (需要 isatty 才输出进度条/颜色的)会拿到 False → 降级块缓冲、无色。子进程环境走
  sandbox 严档白名单,不整份继承宿主环境。所有权按 (user_id, session_id) 判定,越权与
  不存在同形。
- **`pty`(env `IHUI_INTERACTIVE_PTY=1|true|yes|on`)**:POSIX 用标准库 `pty.openpty()` +
  setsid + `TIOCSCTTY` 造**真 tty** —— 子进程 `isatty()` 为真,npm/cargo/pytest-v 这类按
  tty 出进度/颜色的程序表现与其在自己终端里一致;stdout 与 stderr 由 tty 行规程合并为
  单一 `pty` 通道(这是真终端的物理事实,非本实现的缺陷)。子进程环境**仍同经
  `_strict_child_env`**,PTY 不放宽任何环境边界。**Windows 暂不接 ConPTY**:开启 PTY 时
  显式返回 `TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM`,**绝不静默回落管道冒充已 PTY**
  (§0.3「没判绝不写成判过」;真 PTY 的 Windows 后端要引原生 ConPTY ctypes 绑定,属独立的
  安全敏感面改造,须机主另拍)。

对照程序:WB/Trae 的 harness 用原生 `pty.node`/`conpty.node`(:lydell/node-pty),deepseek-tui
用管道。本实现取"CI 真能跑通 + 零第三方依赖"的那一档(标准库 pty + 原生 ConPTY 留待专章)。
"""

from __future__ import annotations

import contextlib
import importlib
import os
import signal as _signal
import subprocess
import threading
import time
import uuid
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Final

from .sandbox import _strict_child_env

MAX_SESSIONS: Final = 16
MAX_BUFFER_LINES: Final = 2000

# Windows 专属进程组常量:typeshed 按宿主平台裁剪 —— `signal.CTRL_BREAK_EVENT` 与
# `subprocess.CREATE_NEW_PROCESS_GROUP` 只存在于 Windows 的 stub 里,Linux runner 上
# 直接取属性会被 mypy 判 attr-defined(CI 实测两处)。运行期它们只在
# `os.name == "nt"` 分支里参与调用,所以这里用 getattr 兜底取值:非 Windows 上即便
# 取到兜底值也永不传入 Popen/send_signal(那条分支走不到),而静态检查不再依赖宿主平台。
_WIN_CREATE_NEW_PROCESS_GROUP: Final[int] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
_WIN_CTRL_BREAK_EVENT: Final[int] = getattr(_signal, "CTRL_BREAK_EVENT", 0)
MAX_READ_CHARS: Final = 32_000
CLOSE_GRACE_S: Final = 2.0

# PTY 后端开关(读时机敏感:每次 open_terminal 现读 env,便于测试 monkeypatch)。
PTY_REQUEST_ENV: Final = "IHUI_INTERACTIVE_PTY"
_PTY_TRUTHY: Final[frozenset[str]] = frozenset({"1", "true", "yes", "on"})
#: PTY 读循环每次最多吐多少字节(行切分在 _pump_pty 里做,这里只控单次 read 上界)。
_PTY_READ_CHUNK: Final = 65_536


def _pty_requested(env: Mapping[str, str] | None = None) -> bool:
    """本次是否要求 PTY 后端。**每次现读** env(不在导入期定格),便于运行期开关与测试。"""
    source = os.environ if env is None else env
    return (source.get(PTY_REQUEST_ENV, "") or "").strip().lower() in _PTY_TRUTHY


def _pty_supported_on_host() -> bool:
    """当前宿主是否有 PTY 后端实现。Windows 走 ConPTY(未接)→ False;fail-closed,
    不靠"看起来能 import"骗过判定。"""
    return os.name != "nt"


@dataclass
class TerminalSession:
    terminal_id: str
    owner_user_id: str | None
    owner_session_id: str | None
    command: str
    cwd: str
    proc: subprocess.Popen[str]
    created_ts: float
    # 写侧统一出口:管道路径 = proc.stdin;PTY 路径 = master 的写 fdopen。send_terminal
    # 永不直接碰 `session.proc.stdin`(PTY 模式下它是 None),只走这个,两条后端同形。
    write_io: Any = None
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    seq: int = 0
    chunks: deque[dict[str, Any]] = field(
        default_factory=lambda: deque(maxlen=MAX_BUFFER_LINES), repr=False
    )
    pumps: list[threading.Thread] = field(default_factory=list, repr=False)
    # PTY 专属:master 的读 fd(关闭时显式 close);管道路径为 None。
    pty_read_fd: int | None = None
    #: 真 tty(PTY)还是匿名管道 —— 进 to_dict 给消费方/前端标会话类型。
    backend: str = "pipes"

    def running(self) -> bool:
        return self.proc.poll() is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "terminal_id": self.terminal_id,
            "command": self.command,
            "cwd": self.cwd,
            "pid": self.proc.pid,
            "running": self.running(),
            "exit_code": self.proc.poll(),
            "next_seq": self.seq,
            "created_ts": self.created_ts,
            "backend": self.backend,
        }


_sessions: dict[str, TerminalSession] = {}
_registry_lock = threading.RLock()


def reset_terminals() -> None:
    """测试用:关闭并清空全部终端。"""
    with _registry_lock:
        sessions = list(_sessions.values())
        _sessions.clear()
    for session in sessions:
        _force_stop(session)
        _close_io(session)


def _force_stop(session: TerminalSession) -> None:
    try:
        if session.proc.poll() is None:
            session.proc.kill()
    except OSError:
        pass


def _close_io(session: TerminalSession) -> None:
    """释放会话持有的额外 IO(PTY 的 master 读写 fd);管道路径靠 proc 回收,无需此处。"""
    if session.pty_read_fd is not None:
        with contextlib.suppress(OSError):
            os.close(session.pty_read_fd)
        session.pty_read_fd = None
    write_io = session.write_io
    if write_io is not None and write_io is not session.proc.stdin:
        with contextlib.suppress(OSError, ValueError):
            write_io.close()


def _owned(
    session: TerminalSession, user_id: str | None, session_id: str | None
) -> bool:
    return (
        session.owner_user_id == (user_id or None)
        and session.owner_session_id == (session_id or None)
    )


def _push(session: TerminalSession, tag: str, text: str) -> None:
    """把一个文本片段作为一条 chunk 入缓冲(seq 单调 +1)。PTY/管道共用同一入队口径。"""
    with session.lock:
        session.seq += 1
        session.chunks.append({"seq": session.seq, "stream": tag, "text": text})


def _pump(session: TerminalSession, stream: Any, tag: str) -> None:
    """管道路径:逐行读一条 stream 入缓冲。readline 到 EOF('')自然收敛。"""
    try:
        for line in iter(stream.readline, ""):
            _push(session, tag, line)
    except (OSError, ValueError):
        pass
    finally:
        try:
            stream.close()
        except OSError:
            pass


def _pump_pty(session: TerminalSession, fd: int, tag: str) -> None:
    """PTY 路径:master 读原始字节,按 \\n 切成行入队(与管道口径一致,消费方无需分叉)。

    子进程退出后,master 的 os.read 在 POSIX 返回 EOF(b"")或抛 EIO —— 两种都判收尾。
    行缓冲的尾巴(若退出前最后一行无 \\n)也吐出,不丢尾。本线程不负责关 fd ——
    fd 由 `_close_io`/close_terminal 统一直close,避免 read 线程与 close 抢关。
    """
    buffered = ""
    try:
        while True:
            try:
                data = os.read(fd, _PTY_READ_CHUNK)
            except OSError:
                break  # EOF / EIO:子进程已退,读端失效
            if not data:
                break
            buffered += data.decode("utf-8", errors="replace")
            while "\n" in buffered:
                line, buffered = buffered.split("\n", 1)
                _push(session, tag, f"{line}\n")
    finally:
        if buffered:
            _push(session, tag, buffered)


def _prune_for_new_session() -> None:
    """注册表有界:满了先清已结束的;仍满则拒绝(不悄悄杀活会话)。"""
    while len(_sessions) >= MAX_SESSIONS:
        closed = [s for s in _sessions.values() if not s.running()]
        if not closed:
            break
        for session in closed:
            _close_io(session)
            _sessions.pop(session.terminal_id, None)


def _spawn_pipe(command: str, cwd: str, env_extra: dict[str, str] | None) -> subprocess.Popen[str]:
    """默认后端:三条匿名管道(逐字节沿用改前实现)。"""
    flags = 0
    extra_kwargs: dict[str, Any] = {}
    if os.name == "nt":
        flags = _WIN_CREATE_NEW_PROCESS_GROUP
    else:
        extra_kwargs["start_new_session"] = True
    return subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        env=_strict_child_env(env_extra),
        creationflags=flags,
        **extra_kwargs,
    )


def _make_ctty_setter() -> Any:
    """返回一个子进程 preexec_fn:把 slave(fd 0)设为该会话的**控制终端**并 setsid,
    使前台进程组信号(SIGINT/SIGTTOU 等)与 tty 语义生效。fcntl/termios 用 importlib 取
    (Windows 无此模块 → 返回 None 不进入 PTY 分支 anyway);失败不致命(isatty 已成立)。"""
    fcntl = importlib.import_module("fcntl")
    termios = importlib.import_module("termios")
    tiocsctty = getattr(termios, "TIOCSCTTY", None)

    def _preexec() -> None:
        # `os.setsid`/`fcntl`/`termios` 只在 POSIX 存在;类型检查按宿主(可能是 Windows)
        # 分析,直接用 `os.setsid` 会被判 attr-defined,故经 getattr 取(取不到 = None,
        # 而本函数只在 `_pty_supported_on_host()` 为真时才会跑到,Windows 分支进不来)。
        setsid = getattr(os, "setsid", None)
        if callable(setsid):
            with contextlib.suppress(Exception):
                setsid()
        if tiocsctty is not None:
            with contextlib.suppress(Exception):
                fcntl.ioctl(0, tiocsctty, 0)

    return _preexec


def _spawn_pty(
    command: str, cwd: str, env_extra: dict[str, str] | None
) -> tuple[subprocess.Popen[str], int, Any]:
    """PTY 后端(POSIX):master/slave 开伪终端,slave 作子进程 std* 并设控制终端。

    返回 `(proc, master_read_fd, master_write_io)`。master 的**读**与**写**各用独立 fd
    (写侧 dup 后 fdopen),不让两个缓冲共用一个裸 fd —— 共用会在读循环触发
    `OSError: [Errno 9] Bad file descriptor`(实测踩点)。调用方负责这三者的生命周期:
    本函数内若任一步失败,逐个回滚已开 fd,不外泄 fd / 子进程。
    """
    pty_mod = importlib.import_module("pty")
    master_fd, slave_fd = pty_mod.openpty()
    try:
        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=_strict_child_env(env_extra),
            start_new_session=True,
            preexec_fn=_make_ctty_setter(),
            close_fds=True,
        )
    except OSError:
        os.close(master_fd)
        os.close(slave_fd)
        raise
    # 父进程不需要 slave(子进程已 dup2 到 0/1/2),关掉它,否则 master 不会在子退时 EOF。
    os.close(slave_fd)
    try:
        write_fd = os.dup(master_fd)
        master_write_io = os.fdopen(write_fd, "w", encoding="utf-8", errors="replace")
        master_read_fd = os.dup(master_fd)
    except OSError:
        os.close(master_fd)
        with contextlib.suppress(OSError):
            proc.kill()
        raise
    os.close(master_fd)
    return proc, master_read_fd, master_write_io


def _open_pty_session(
    *, command: str, cwd: str, user_id: str | None, session_id: str | None,
    env_extra: dict[str, str] | None,
) -> dict[str, Any]:
    """PTY 后端开会话(仅限 POSIX)。满额/起不来 → 结构化错误,不抛。"""
    _prune_for_new_session()
    if len(_sessions) >= MAX_SESSIONS:
        return {
            "ok": False,
            "errorCode": "TERMINAL_LIMIT",
            "error": f"终端会话已达上限({MAX_SESSIONS}),请先 close 不再使用的会话",
        }
    try:
        proc, read_fd, write_io = _spawn_pty(command, cwd, env_extra)
    except OSError as e:
        return {"ok": False, "errorCode": "TERMINAL_SPAWN_FAILED", "error": f"PTY 启动失败: {e}"}
    session = TerminalSession(
        terminal_id=f"term_{uuid.uuid4().hex[:12]}",
        owner_user_id=user_id or None,
        owner_session_id=session_id or None,
        command=command,
        cwd=cwd,
        proc=proc,
        created_ts=time.time(),
        write_io=write_io,
        pty_read_fd=read_fd,
        backend="pty",
    )
    _sessions[session.terminal_id] = session
    thread = threading.Thread(target=_pump_pty, args=(session, read_fd, "pty"), daemon=True)
    thread.start()
    session.pumps.append(thread)
    return {"ok": True, "terminal": session.to_dict()}


def open_terminal(
    *,
    command: str,
    cwd: str,
    user_id: str | None,
    session_id: str | None,
    env_extra: dict[str, str] | None = None,
) -> dict[str, Any]:
    """启动长驻子进程;返回 terminal_id 与初始元数据(含 `backend`:"pipes"|"pty")。"""
    if not command.strip():
        return {"ok": False, "errorCode": "TERMINAL_INVALID_COMMAND", "error": "command 为空"}
    # PTY 是显式 opt-in:请求了但当前宿主没实现(Windows 未接 ConPTY)→ fail-closed 硬拒,
    # 不静默回落管道冒充已 PTY(否则消费方以为拿到真 tty,实则块缓冲)。
    if _pty_requested() and not _pty_supported_on_host():
        return {
            "ok": False,
            "errorCode": "TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM",
            "error": (
                f"已要求 PTY({PTY_REQUEST_ENV}),但平台 {os.name} 暂未接 ConPTY;会话未创建。"
                "置空该环境变量以使用管道路径,或等 Windows ConPTY 后端落地。"
            ),
        }
    with _registry_lock:
        if _pty_requested() and _pty_supported_on_host():
            return _open_pty_session(
                command=command, cwd=cwd, user_id=user_id,
                session_id=session_id, env_extra=env_extra,
            )
        _prune_for_new_session()
        if len(_sessions) >= MAX_SESSIONS:
            return {
                "ok": False,
                "errorCode": "TERMINAL_LIMIT",
                "error": f"终端会话已达上限({MAX_SESSIONS}),请先 close 不再使用的会话",
            }
        try:
            proc = _spawn_pipe(command, cwd, env_extra)
        except OSError as e:
            return {
                "ok": False,
                "errorCode": "TERMINAL_SPAWN_FAILED",
                "error": f"启动失败: {e}",
            }
        session = TerminalSession(
            terminal_id=f"term_{uuid.uuid4().hex[:12]}",
            owner_user_id=user_id or None,
            owner_session_id=session_id or None,
            command=command,
            cwd=cwd,
            proc=proc,
            created_ts=time.time(),
            write_io=proc.stdin,
            backend="pipes",
        )
        _sessions[session.terminal_id] = session
    assert proc.stdout is not None and proc.stderr is not None
    for stream, tag in ((proc.stdout, "stdout"), (proc.stderr, "stderr")):
        thread = threading.Thread(target=_pump, args=(session, stream, tag), daemon=True)
        thread.start()
        session.pumps.append(thread)
    return {"ok": True, "terminal": session.to_dict()}


def send_terminal(
    terminal_id: str,
    text: str,
    *,
    user_id: str | None,
    session_id: str | None,
    enter: bool = True,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    if not session.running():
        return {
            "ok": False, "errorCode": "TERMINAL_EXITED",
            "error": f"终端已退出(exit_code={session.proc.poll()})",
            "terminal": session.to_dict(),
        }
    payload = text if not enter else f"{text}\n"
    sink = session.write_io
    if sink is None:  # 理论不可达:两种后端 open 时都设了 write_io;防御性返回而非裸 AttributeError
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": "无可用写入端",
            "terminal": session.to_dict(),
        }
    try:
        sink.write(payload)
        sink.flush()
    except (BrokenPipeError, OSError, ValueError) as e:
        return {
            "ok": False, "errorCode": "TERMINAL_WRITE_FAILED",
            "error": f"写入失败: {e}",
            "terminal": session.to_dict(),
        }
    return {"ok": True, "terminal_id": terminal_id, "bytes_written": len(payload)}


def read_terminal(
    terminal_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    since_seq: int = 0,
    wait_s: float = 1.0,
    max_chars: int = 8000,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    deadline = time.monotonic() + max(0.0, min(wait_s, 10.0))
    while True:
        with session.lock:
            pending = [c for c in session.chunks if c["seq"] > int(since_seq)]
            running = session.running()
            next_seq = session.seq
        # 进程已退出不等于读线程已把管道/PTY 尾部吐完:等 pump 全部结束后再收尾,
        # 否则最后一次 read 可能丢掉退出前的最后几行(模型通常读到 running=false 就停)。
        drained = not any(t.is_alive() for t in session.pumps)
        if pending or (not running and drained) or time.monotonic() >= deadline:
            break
        time.sleep(0.05)

    out: list[dict[str, Any]] = []
    used = 0
    for chunk in pending:
        text = str(chunk["text"])
        remain = max(0, max_chars - used)
        if remain <= 0:
            break
        if len(text) > remain:
            text = text[:remain]
        out.append({"seq": chunk["seq"], "stream": chunk["stream"], "text": text})
        used += len(text)
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "chunks": out,
        "next_seq": next_seq,
        "running": running,
        "exit_code": session.proc.poll(),
        "truncated": used >= max_chars and len(pending) > len(out),
    }


def signal_terminal(
    terminal_id: str,
    *,
    signal_name: str,
    user_id: str | None,
    session_id: str | None,
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    proc = session.proc
    if proc.poll() is not None:
        return {
            "ok": True, "terminal_id": terminal_id,
            "running": False, "exit_code": proc.poll(),
        }
    try:
        if signal_name == "interrupt":
            if os.name == "nt":
                proc.send_signal(_WIN_CTRL_BREAK_EVENT)
            else:
                proc.send_signal(_signal.SIGINT)
        elif signal_name == "terminate":
            proc.terminate()
        elif signal_name == "kill":
            proc.kill()
        else:
            return {
                "ok": False, "errorCode": "TERMINAL_INVALID_SIGNAL",
                "error": f"signal 必须是 interrupt/terminate/kill,实得 {signal_name!r}",
            }
    except (OSError, ValueError) as e:
        if signal_name == "interrupt":
            # Windows 非控制台程序可能不接收 CTRL_BREAK;退化为 terminate。
            try:
                proc.terminate()
            except OSError:
                return {
                    "ok": False, "errorCode": "TERMINAL_SIGNAL_FAILED",
                    "error": f"发送信号失败: {e}",
                }
        else:
            return {
                "ok": False, "errorCode": "TERMINAL_SIGNAL_FAILED",
                "error": f"发送信号失败: {e}",
            }
    return {
        "ok": True, "terminal_id": terminal_id, "signal": signal_name,
        "running": proc.poll() is None,
    }


def close_terminal(
    terminal_id: str, *, user_id: str | None, session_id: str | None
) -> dict[str, Any]:
    session = _sessions.get(terminal_id)
    if session is None or not _owned(session, user_id, session_id):
        return {
            "ok": False, "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        }
    proc = session.proc
    if proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=CLOSE_GRACE_S)
        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.wait(timeout=CLOSE_GRACE_S)
            except subprocess.TimeoutExpired:
                pass
        except OSError:
            pass
    with _registry_lock:
        _sessions.pop(terminal_id, None)
    _close_io(session)  # 从注册表摘除后再关 IO:关 slave/写端以驱动 master 读线程收敛
    return {
        "ok": True,
        "terminal_id": terminal_id,
        "closed": True,
        "exit_code": proc.poll(),
    }


def list_terminals(
    *, user_id: str | None, session_id: str | None
) -> dict[str, Any]:
    if not user_id and not session_id:
        return {"ok": True, "terminals": [], "total": 0}
    items = [
        s for s in _sessions.values() if _owned(s, user_id, session_id)
    ]
    items.sort(key=lambda s: s.created_ts, reverse=True)
    return {
        "ok": True,
        "terminals": [s.to_dict() for s in items],
        "total": len(items),
    }


def default_shell() -> str:
    """跨平台默认 shell:Windows 用 COMSPEC,其他用 $SHELL 或 /bin/sh。"""
    if os.name == "nt":
        return os.environ.get("COMSPEC", "cmd.exe")
    return os.environ.get("SHELL", "/bin/sh")


# 暴露给镜像测试的形状锁/判据出口(§22c:测试 import 真实判定,不复制常量)。
__test__ = {
    "pty_requested": _pty_requested,
    "pty_supported_on_host": _pty_supported_on_host,
    "PTY_REQUEST_ENV": PTY_REQUEST_ENV,
    "PTY_TRUTHY": _PTY_TRUTHY,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
