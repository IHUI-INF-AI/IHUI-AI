# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​​​​‍‍​‌‌‌​​‌‌‍‍​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍⁠

"""模型侧交互式终端(2026-11-14 立,对标 DSH dsh-terminal / dsh-tool-terminal)。

DSH 的终端是**长寿命会话**:open 一次,后续 send/read/signal/close 都作用于同一
进程,而不是每条命令重启。IHUI 现有 `run_command`/`sandbox_session.exec` 都是
一次性执行;REPL、调试器、交互式脚手架这类需求只能"一条命令跑完",拿不到中间
提示与逐步输入。

本模块补最小闭环:
- `open_terminal`:启动一个长驻子进程(stdin/stdout/stderr 管道 + 读线程);
- `send_terminal`:写入一行(可选追加换行);
- `read_terminal`:按 seq 增量读,支持有限等待(默认 1s)与字符上限;
- `signal_terminal`:interrupt/terminate/kill(Windows 用 CTRL_BREAK_EVENT);
- `close_terminal`:terminate → 2s 宽限 → kill,返回退出码;
- `list_terminals`:按调用者身份列出会话。

边界(与 DSH 的差异如实记录):这里用管道而不是 PTY,面向 TTY 的程序(需要
isatty 才输出进度条/颜色的)可能降级为块缓冲;子进程环境走 sandbox 严档白名单,
不整份继承宿主环境。所有权按 (user_id, session_id) 判定,越权与不存在同形。
"""

from __future__ import annotations

import os
import signal as _signal
import subprocess
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Final

from .sandbox import _strict_child_env

MAX_SESSIONS: Final = 16
MAX_BUFFER_LINES: Final = 2000
MAX_READ_CHARS: Final = 32_000
CLOSE_GRACE_S: Final = 2.0


@dataclass
class TerminalSession:
    terminal_id: str
    owner_user_id: str | None
    owner_session_id: str | None
    command: str
    cwd: str
    proc: subprocess.Popen[str]
    created_ts: float
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)
    seq: int = 0
    chunks: deque[dict[str, Any]] = field(
        default_factory=lambda: deque(maxlen=MAX_BUFFER_LINES), repr=False
    )
    pumps: list[threading.Thread] = field(default_factory=list, repr=False)

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


def _force_stop(session: TerminalSession) -> None:
    try:
        if session.proc.poll() is None:
            session.proc.kill()
    except OSError:
        pass


def _owned(
    session: TerminalSession, user_id: str | None, session_id: str | None
) -> bool:
    return (
        session.owner_user_id == (user_id or None)
        and session.owner_session_id == (session_id or None)
    )


def _pump(session: TerminalSession, stream: Any, tag: str) -> None:
    try:
        for line in iter(stream.readline, ""):
            with session.lock:
                session.seq += 1
                session.chunks.append({"seq": session.seq, "stream": tag, "text": line})
    except (OSError, ValueError):
        pass
    finally:
        try:
            stream.close()
        except OSError:
            pass


def _prune_for_new_session() -> None:
    """注册表有界:满了先清已结束的;仍满则拒绝(不悄悄杀活会话)。"""
    while len(_sessions) >= MAX_SESSIONS:
        closed = [s for s in _sessions.values() if not s.running()]
        if not closed:
            break
        for session in closed:
            _sessions.pop(session.terminal_id, None)


def open_terminal(
    *,
    command: str,
    cwd: str,
    user_id: str | None,
    session_id: str | None,
    env_extra: dict[str, str] | None = None,
) -> dict[str, Any]:
    """启动长驻子进程;返回 terminal_id 与初始元数据。"""
    if not command.strip():
        return {"ok": False, "errorCode": "TERMINAL_INVALID_COMMAND", "error": "command 为空"}
    with _registry_lock:
        _prune_for_new_session()
        if len(_sessions) >= MAX_SESSIONS:
            return {
                "ok": False,
                "errorCode": "TERMINAL_LIMIT",
                "error": f"终端会话已达上限({MAX_SESSIONS}),请先 close 不再使用的会话",
            }
        flags = 0
        extra_kwargs: dict[str, Any] = {}
        if os.name == "nt":
            flags = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            extra_kwargs["start_new_session"] = True
        try:
            proc = subprocess.Popen(
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
    try:
        assert session.proc.stdin is not None
        session.proc.stdin.write(payload)
        session.proc.stdin.flush()
    except (BrokenPipeError, OSError) as e:
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
        # 进程已退出不等于读线程已把管道尾部吐完:等 pump 全部结束后再收尾,
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
                proc.send_signal(_signal.CTRL_BREAK_EVENT)
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
