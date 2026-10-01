# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令流式执行器 — 自研命令流执行。

用 asyncio.create_subprocess_exec 启动进程,异步逐行读取 stdout/stderr,
yield 事件流(stdout/stderr/exit/timeout),解决长命令超时问题。
提供 run_command_simple 同步包装器供不需要流式的调用方使用。
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import re
import shlex
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# 命令长度上限(防止超大输入打满 argv)
MAX_COMMAND_LENGTH = 2000

# 超时范围(秒):1s ~ 30min,超出 clamp
MIN_TIMEOUT = 1
MAX_TIMEOUT = 1800

# 超时后 SIGTERM 宽限期(SIGTERM → 等 5s → SIGKILL)
_GRACE_PERIOD = 5.0

# ===========================================================================
# 协议帧预算与超限三类结局分流 —— 全服务唯一实现(第三十三批)
# ===========================================================================
#
# 为什么本模块当宿主:它是本批 6 个受影响文件里唯一 **零 app 内部 import** 的
# 模块(只依赖 stdlib),因此 mcp_client / container_runtime / agent_engine /
# lsp / mcp_server 任意一侧 import 它都不可能构成循环,也不会把 httpx 之类的
# 重依赖拖进本来很轻的读取路径。宿主一经选定不得再挪 —— 第二份实现必然漂移,
# 而"两处算同一件事必漂移"是本仓记过最多次的失败型。
#
# 病灶(实测确认,不是假想):asyncio.StreamReader 的默认 limit = 65536,而它是
# "任意流的一行"的**通用护栏**,不是本协议的帧预算。readline() 在缓冲超 limit
# 仍找不到 \n 时抛 asyncio.LimitOverrunError;全仓 7 处协议读取点无一处理它
# (grep "LimitOverrunError|IncompleteReadError" apps/ai-service/app = 0 命中)。
# 后果有两种,而且都错:
#   1. mcp_client._stdio_read_loop 用 `except Exception` 兜住一切 → 走到 finally
#      里 _connected=False,并按 reconnect 配置 create_task(self._reconnect())。
#      对端只要**恒定**输出一条超 64KiB 的行(大工具结果、LSP 大响应),本进程就
#      无限重连;用户看到的是"这个 MCP 永远连不上",真因却是"结果太大" ——
#      归因被彻底指错,而且没有任何一行日志说出这个真因。
#   2. 不抛错的读取实现里,超限帧被当成空行/EOF 静默丢弃,而残余字节仍留在
#      StreamReader 内部缓冲区里(readuntil 的文档原话:"the data will be left in
#      the internal buffer, so it can be read again"),于是下一条帧从半行开始
#      解析 —— 症状写成"偶发 JSON 解析失败",同样极难归因。
#
# 帧预算取值的三条依据(不是拍脑袋):
#   - 下界:必须容得下真实合法帧。本仓 MCP 工具结果里的最大单产物是 5MB 图档
#     (mcp_server._MAX_IMAGE_BYTES),base64 按 4/3 膨胀后 ≈6.67MB,再加 JSON
#     字符串转义余量 → 单帧可到 ~7MB。默认的 64KiB 差了两个数量级。
#   - 上界:不得超过下游入口上限。apps/api/src/server.ts 的全局
#     bodyLimit = 1048576*10(10MiB),一帧若大过它,在本端收下后转发进 api 必
#     413 —— 那只是把失败点后移,并换个更难归因的形态。
#   - 取值:8MiB 是 10MiB 之下最近的 2 的幂,给 6.67MB 留约 19% 余量。内存代价
#     有界:StreamReader 在缓冲超 2×limit(=16MiB)时暂停 transport,即"每连接
#     峰值 16MiB",不是无界增长。
PROTOCOL_FRAME_LIMIT_BYTES: int = 8 * 1024 * 1024

# 残余回收时的分块大小。太小会把一次超限变成上万次 await(与 asyncio 内部
# socket 读块同量级即可)。
_FRAME_DRAIN_CHUNK_BYTES: int = 64 * 1024

# 残余回收的硬上限:对端持续吐一条不带 \n 的巨流时不得无限 drain。
# 超上限即如实判"失步"(见 ProtocolFrameRead.resynced),而不是假装对齐了。
_FRAME_DRAIN_HARD_CAP_BYTES: int = 64 * 1024 * 1024

# read_protocol_frame 的三类结局(稳定标识:调用方分流、测试断言、日志字段
# 都认这三个值,不得改成裸字符串散落各处)。
FRAME_READ_LINE: str = "line"
FRAME_READ_TOO_LARGE: str = "frame_too_large"
FRAME_READ_EOF: str = "eof"


@dataclass(frozen=True)
class ProtocolFrameRead:
    """一次协议帧读取的结局(三类必须互斥且都被显式区分)。

    属性:
        kind: FRAME_READ_LINE / FRAME_READ_TOO_LARGE / FRAME_READ_EOF 三选一。
        data: 仅 kind=FRAME_READ_LINE 时非空,是含行尾 \\n 的整帧字节。
        dropped_bytes: kind=FRAME_READ_TOO_LARGE 时本帧被丢弃的字节数。
            0 只出现在"长度已不可恢复"的那一支(见 read_protocol_frame 的
            ValueError 分支),**不得**据此判断"什么都没丢"。
            非零值必须由调用方计入计数并写日志 —— 静默变短等于伪造完整性。
        resynced: kind=FRAME_READ_TOO_LARGE 时是否已把该帧残余读到行尾、下一帧
            可以从干净边界开始解析。False 表示"残余未能安全退回缓冲区",
            此时**不得**继续按下一条帧解析(那会把半行当新帧),调用方应按真实
            断连处理,但日志里写的原因必须是"超限失步",不是"对端关闭"。
    """

    kind: str
    data: bytes = b""
    dropped_bytes: int = 0
    resynced: bool = True


async def _drain_frame_remainder(stream: Any) -> tuple[int, bool]:
    """把"已确认超限"那一帧的残余读到行尾,返回 (丢弃字节数, 是否已对齐)。

    为什么不能一路 ``await stream.read(n)`` 读到了事:``read(n)`` 的语义是
    "从缓冲区前缀取至多 n 字节",取回的块**可能跨过本行行尾** —— 行尾之后的
    字节属于下一帧,一旦被读走又没有公开的"退回"API,就等于吃掉下一帧的开头
    (比原来的粘连更难查)。asyncio 没有 unread/peek,所以这里在能拿到
    ``_buffer``(bytearray)时把跨过的那段**前置写回**;拿不到时(非标准
    StreamReader 实现、或上游改了内部结构)**绝不猜**:如实返回
    resynced=False,由调用方按真实断连处理并留日志,而不是假装已经对齐。

    这里刻意用 getattr 而不是直接写 stream._buffer:一是 mypy 严格档下
    asyncio.StreamReader 的私有属性不在 typeshed 里(直接点它会报 attribute
    error,而报错的代价是有人去放宽判据或写 type: ignore);二是它本身就表达
    "这是一个 duck-typing 的兜底路径,拿不到要降级" 的语义。
    """
    dropped = 0
    while True:
        chunk = await stream.read(_FRAME_DRAIN_CHUNK_BYTES)
        if not chunk:
            # 对端在行尾之前就关了:残余随 EOF 一起没了,下一帧无从粘连。
            return dropped, True
        dropped += len(chunk)
        nl = chunk.find(b"\n")
        if nl >= 0:
            tail = chunk[nl + 1:]
            if tail:
                buf = getattr(stream, "_buffer", None)
                if isinstance(buf, bytearray):
                    # chunk 是从缓冲区前缀取走的,此刻缓冲区里剩的是 chunk
                    # 之后的内容 ⇒ 把 tail 前置回去即还原原始字节序。
                    buf[:0] = tail
                    dropped -= len(tail)
                else:
                    # 没有可写回的缓冲区:tail 已被我们吞掉,下一帧必缺头。
                    # 如实报失步,交给调用方断连(它会看到 resynced=False)。
                    return dropped, False
            return dropped, True
        if dropped >= _FRAME_DRAIN_HARD_CAP_BYTES:
            # 一条不带 \n 的巨流:不再无限 drain,如实判失步。
            return dropped, False


async def read_protocol_frame(stream: Any) -> ProtocolFrameRead:
    """读一帧,把"正常行 / 帧超限 / EOF"三类结局显式分开。

    取代裸 ``await stream.readline()``:裸调用把第二、三类压成同一个形态(要么
    抛异常、要么回空 bytes),而这两种结局的处置动作完全不同 —— 超限应当**留在
    连接上**继续读下一帧,EOF 才是连接结束。

    为什么这里走 ``readuntil(b"\\n")`` 而不是 readline()(实测 3.12
    asyncio/streams.py 读到的一手事实):readline() 内部就是 readuntil,但它把
    LimitOverrunError **换了个皮**再抛,而且换皮前已经动过缓冲区 ——
        找到行尾 ⇒ ``del buffer[:consumed + 1]``;找不到 ⇒ ``buffer.clear()``
    也就是说"在 readline() 外面 catch 超限"这件事**从外面根本判不准**残留还在
    不在缓冲区里:直接 catch ValueError 会把"整块缓冲区被清空"那一支当成已对齐,
    下一条帧照样粘连,而账面全绿。readuntil 的文档承诺才是可依赖的那句
    ("the data will be left in the internal buffer, so it can be read again"),
    所以本函数按 readuntil 捕 LimitOverrunError,残余回收交给 _drain_frame_remainder。
    只实现 readline() 的流对象(测试替身、第三方包装)走兼容支,那支上 ValueError
    按"超限且长度不可恢复"处理 —— 生产路径到不了,生产用的是 StreamReader。
    """
    use_readuntil = callable(getattr(stream, "readuntil", None))
    try:
        line = await stream.readuntil(b"\n") if use_readuntil else await stream.readline()
    except asyncio.LimitOverrunError:
        dropped, resynced = await _drain_frame_remainder(stream)
        return ProtocolFrameRead(
            kind=FRAME_READ_TOO_LARGE, dropped_bytes=dropped, resynced=resynced
        )
    except asyncio.IncompleteReadError as exc:
        # 与 readline() 同形:EOF 时把不带行尾的尾巴当**最后一帧**交出去。
        # 容器/命令输出经常没有收尾换行(printf 'x'、进程被 kill 在半行),
        # 把它当残帧丢掉就是对既有行为的一次回归。
        partial = exc.partial if isinstance(exc.partial, bytes) else b""
        if partial:
            return ProtocolFrameRead(kind=FRAME_READ_LINE, data=partial)
        return ProtocolFrameRead(kind=FRAME_READ_EOF)
    except ValueError:
        if use_readuntil:
            raise  # 与超限无关的 ValueError(如分隔符为空),不冒充分流结论
        return ProtocolFrameRead(
            kind=FRAME_READ_TOO_LARGE,
            dropped_bytes=0,  # readline() 抛错前已丢掉长度,如实记"不可恢复"
            resynced=False,
        )
    if not line:
        return ProtocolFrameRead(kind=FRAME_READ_EOF)
    return ProtocolFrameRead(kind=FRAME_READ_LINE, data=line)


# 危险命令黑名单(匹配即拒绝)
_DANGEROUS_PATTERNS: list[tuple[str, str]] = [
    (r"rm\s+-rf?\s+/(?:\s|$|/.*)", "rm -rf / (删除根目录)"),
    (r"rm\s+-rf?\s+~(?:\s|$)", "rm -rf ~ (删除家目录)"),
    (r"rm\s+-rf?\s+\$HOME(?:\s|$)", "rm -rf $HOME (删除家目录)"),
    (r"\bmkfs\b", "mkfs (格式化文件系统)"),
    (r"\bdd\b.*\bof=/dev/", "dd of=/dev/ (写入块设备)"),
    (r":\s*\(\)\s*\{\s*:\|.*?\}\s*;", ":(){:|:&};: (fork bomb)"),
    (r">\s*/dev/sd", "> /dev/sda (覆写磁盘)"),
    (r"\bshutdown\b", "shutdown (关机)"),
    (r"\breboot\b", "reboot (重启)"),
    (r"\bhalt\b", "halt (停机)"),
    (r"\bpoweroff\b", "poweroff (关机)"),
    (r"\bformat\b\s+[A-Za-z]:", "format (格式化磁盘)"),
    (r"\bdel\s+/[fsq]+", "del /f /s /q (强制删除)"),
    (r"\brd\s+/[sq]+", "rd /s /q (递归删除目录)"),
    (r"\bchmod\s+-R\s+777\s+/(?:\s|$)", "chmod -R 777 / (全盘权限开放)"),
]


def validate_command(command: str) -> tuple[bool, str]:
    """命令安全校验:长度 + 黑名单。

    Returns:
        (True, "") 或 (False, reason)
    """
    if not command or not command.strip():
        return False, "命令为空"
    if len(command) > MAX_COMMAND_LENGTH:
        return False, f"命令长度超限({len(command)} > {MAX_COMMAND_LENGTH})"
    for pattern, desc in _DANGEROUS_PATTERNS:
        if re.search(pattern, command):
            return False, f"危险命令被拦截: {desc}"
    return True, ""


def parse_command(command: str) -> list[str]:
    """用 shlex 解析命令为 args 列表。

    使用 posix 模式正确处理引号(python -c "script" → ['python', '-c', 'script'])。
    Windows 路径含反斜杠时需用引号包裹或改用正斜杠(posix 模式下 \\ 是转义符)。
    解析失败(引号不匹配等)回退到简单 split。
    """
    try:
        return shlex.split(command)
    except ValueError as e:
        logger.warning("parse_command 失败(%s),回退 split", e)
        return command.split()


def _clamp_timeout(timeout: int) -> int:
    """clamp 到 [MIN_TIMEOUT, MAX_TIMEOUT]。"""
    if timeout < MIN_TIMEOUT:
        return MIN_TIMEOUT
    if timeout > MAX_TIMEOUT:
        return MAX_TIMEOUT
    return timeout


async def _read_stream(
    stream: asyncio.StreamReader | None, ev_type: str, queue: asyncio.Queue[dict[str, Any] | None]
) -> None:
    """逐行读取 stream,put 事件到 queue;结束时 put None 哨兵。stream 为 None 时直接 put 哨兵。

    第三十三批:命令输出不是协议帧,但同一条 readline() 的超限异常一样会炸掉
    本函数 —— 原实现 `except Exception` 后直接落到 finally 投哨兵,表现是
    "这条命令的输出突然少了",而少的**原因**没人知道。现在超限只标注截断、
    继续读下一行;真正结束连接的是 EOF。
    """
    if stream is None:
        await queue.put(None)
        return
    try:
        while True:
            frame = await read_protocol_frame(stream)
            if frame.kind == FRAME_READ_LINE:
                await queue.put({
                    "type": ev_type,
                    "content": frame.data.decode("utf-8", errors="replace").rstrip("\r\n"),
                    "timestamp": time.time(),
                })
                continue
            if frame.kind == FRAME_READ_TOO_LARGE:
                # 如实标注截断(本仓铁律:静默变短等于伪造完整性)。
                logger.warning(
                    "stream_command %s 单行超帧预算 %d 字节(实读 %d 字节),已丢弃该行",
                    ev_type, PROTOCOL_FRAME_LIMIT_BYTES, frame.dropped_bytes,
                )
                await queue.put({
                    "type": ev_type,
                    "content": f"[truncated: 单行超过 {PROTOCOL_FRAME_LIMIT_BYTES} 字节帧预算,"
                               f"已丢弃 {frame.dropped_bytes} 字节]",
                    "timestamp": time.time(),
                    "truncated": True,
                    "dropped_bytes": frame.dropped_bytes,
                })
                if not frame.resynced:
                    # 残余没能退回 → 后面的字节都不可信,不再冒充还能继续读。
                    logger.warning(
                        "stream_command %s 超限帧残余未能对齐行尾,停止读取该流", ev_type
                    )
                    break
                continue
            break  # EOF
    except Exception as e:
        logger.warning("stream_command reader(%s) 异常: %s", ev_type, e)
    finally:
        await queue.put(None)


async def _cleanup_proc(
    proc: asyncio.subprocess.Process,
    stdout_task: asyncio.Task[None],
    stderr_task: asyncio.Task[None],
    timed_out: bool,
) -> None:
    """清理 reader 任务 + 进程(超时 → SIGTERM → grace → SIGKILL)。"""
    for t in (stdout_task, stderr_task):
        if not t.done():
            t.cancel()
    for t in (stdout_task, stderr_task):
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await t
    if proc.returncode is None:
        if timed_out:
            with contextlib.suppress(ProcessLookupError, OSError):
                proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=_GRACE_PERIOD)
            except (TimeoutError, Exception):
                with contextlib.suppress(ProcessLookupError, OSError):
                    proc.kill()
                try:
                    await proc.wait()
                except Exception as e:
                    logger.warning("command_streamer._cleanup_proc 进程等待失败: %s", e, exc_info=True)
        else:
            try:
                await asyncio.wait_for(proc.wait(), timeout=_GRACE_PERIOD)
            except (TimeoutError, Exception):
                try:
                    proc.kill()
                    await proc.wait()
                except Exception as e:
                    logger.warning("command_streamer._cleanup_proc 进程清理失败: %s", e, exc_info=True)


async def stream_command(
    command: str,
    cwd: str | None = None,
    timeout: int = 300,
    env: dict[str, str] | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """流式执行命令,yield 事件流。

    事件类型:
        {type: "stdout"|"stderr", content: str, timestamp: float}
        {type: "exit", returncode: int, duration_ms: float, error?: str}
        {type: "timeout", message: str, duration_ms: float}

    Args:
        command: 要执行的命令(单条,exec 模式不经过 shell)
        cwd: 工作目录
        timeout: 超时秒数(clamp 到 1-1800)
        env: 额外环境变量(合并到 os.environ)
    """
    ok, reason = validate_command(command)
    if not ok:
        yield {"type": "exit", "returncode": -1, "duration_ms": 0.0, "error": reason}
        return

    timeout = _clamp_timeout(timeout)
    args = parse_command(command)
    if not args:
        yield {
            "type": "exit", "returncode": -1, "duration_ms": 0.0,
            "error": "命令解析后为空",
        }
        return

    full_env: dict[str, str] | None = None
    if env:
        full_env = {**os.environ, **env}

    start = time.monotonic()

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=full_env,
            # 第三十三批:显式声明帧预算。不传 limit 时 asyncio 用默认 65536,
            # 而 _read_stream 是按行读的 —— 一条 100KB 的单行输出(常见于
            # base64/JSON 一行打印)就会抛 LimitOverrunError。见模块顶部依据。
            limit=PROTOCOL_FRAME_LIMIT_BYTES,
        )
    except FileNotFoundError as e:
        yield {
            "type": "exit", "returncode": -1,
            "duration_ms": (time.monotonic() - start) * 1000,
            "error": f"command not found: {e}",
        }
        return
    except Exception as e:
        yield {
            "type": "exit", "returncode": -1,
            "duration_ms": (time.monotonic() - start) * 1000,
            "error": f"start failed: {e}",
        }
        return

    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    stdout_task = asyncio.create_task(_read_stream(proc.stdout, "stdout", queue))
    stderr_task = asyncio.create_task(_read_stream(proc.stderr, "stderr", queue))

    deadline = start + timeout
    timed_out = False
    sentinels = 2
    # G-998115(b76-08a):退出归因三态 —— 宿主 watchdog 回收写 watchdog_recycle(首因锁定);
    # 进程自行退出且无宿主归因 ⇒ unexpected(signal crash 与自行 exit 0 都算非预期)。
    termination_kind: str | None = None

    try:
        while sentinels > 0:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                if termination_kind is None:
                    termination_kind = "watchdog_recycle"
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=remaining)
            except TimeoutError:
                timed_out = True
                if termination_kind is None:
                    termination_kind = "watchdog_recycle"
                break
            if event is None:
                sentinels -= 1
                continue
            yield event
    finally:
        await _cleanup_proc(proc, stdout_task, stderr_task, timed_out)

    duration_ms = (time.monotonic() - start) * 1000
    if timed_out:
        yield {
            "type": "timeout",
            "message": f"命令超时({timeout}s),进程已终止",
            "duration_ms": duration_ms,
            "terminationKind": termination_kind or "unexpected",
        }
    else:
        yield {
            "type": "exit",
            "returncode": proc.returncode if proc.returncode is not None else -1,
            "duration_ms": duration_ms,
            # 归因不可被后续幂等回收改写:此处已落定,再来的 cleanup 不改这一位
            "terminationKind": termination_kind or "unexpected",
        }


async def run_command_simple(
    command: str,
    cwd: str | None = None,
    timeout: int = 60,
) -> dict[str, Any]:
    """同步包装器:收集所有输出,返回聚合结果。

    Returns:
        {ok, returncode, stdout, stderr, duration_ms, timed_out, error?}
    """
    stdout_parts: list[str] = []
    stderr_parts: list[str] = []
    returncode = -1
    duration_ms = 0.0
    error: str | None = None
    timed_out = False

    async for event in stream_command(command, cwd=cwd, timeout=timeout):
        etype = event.get("type")
        if etype == "stdout":
            stdout_parts.append(event.get("content", ""))
        elif etype == "stderr":
            stderr_parts.append(event.get("content", ""))
        elif etype == "exit":
            returncode = event.get("returncode", -1)
            duration_ms = event.get("duration_ms", 0.0)
            if "error" in event:
                error = event["error"]
        elif etype == "timeout":
            timed_out = True
            duration_ms = event.get("duration_ms", 0.0)

    return {
        "ok": returncode == 0 and not error and not timed_out,
        "returncode": returncode,
        "stdout": "\n".join(stdout_parts),
        "stderr": "\n".join(stderr_parts),
        "duration_ms": duration_ms,
        "timed_out": timed_out,
        "error": error,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
