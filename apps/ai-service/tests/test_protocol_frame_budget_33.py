# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-

"""第三十三批:协议级帧预算与超限三类结局分流 —— 回归锁。

病灶(实测确认):`apps/ai-service/app` 里 7 处 asyncio 协议读取的逐行读取
一律没有字节上限声明(asyncio.StreamReader 默认 limit=65536),而全仓对
LimitOverrunError / IncompleteReadError 的处理是 **0 处**。后果不是"报错",
而是**归因被彻底指错**:

  - mcp_client 的 stdio 读取循环用 `except Exception` 兜住一切 → finally 里
    _connected=False 并 create_task(self._reconnect())。对端只要**恒定**吐出
    一条超 64KiB 的行(大工具结果、LSP 大响应),本进程就无限重连。用户看到
    "这个 MCP 永远连不上",真因是"结果太大"。
  - 其余路径里超限帧被当成空行/结束静默丢掉,而残余字节仍留在 StreamReader
    缓冲区(readuntil 文档原话:"the data will be left in the internal buffer"),
    下一条帧从半行开始解析 → 症状写成"偶发 JSON 解析失败"。

本文件锁五件事(任务书要求的三条 + 两条本仓文化要求的锁):
  ① 超限帧 **不**增加 reconnect 次数(替身记下 _reconnect 被调那一刻)
  ② 超限之后 **仍**能读到下一条正常帧(含"残余跨过行尾时必须退回缓冲区")
  ③ 正常路径零回归(三类结局、真 EOF 仍重连、非协议采集只标注不炸循环)
  ④ 阳性对照:同一份夹具喂裸逐行读取必须抛 LimitOverrunError ——
     缺了它,①② 就成了"夹具没造出超限"的空证。
  ⑤ 源码锁(用 AST,不用文本 grep —— 解释本 bug 的注释里必然写着那个调用,
     按文本判会把散文判成违规,守门 131/70 都栽过这一型):
     唯一常量只有一处定义、spawn 点必须声明 limit、出口之外不得再有裸调用。

禁止连生产库:本文件不触碰 PostgreSQL(8810)/ Redis(8811),也不 import
db_pool —— 被测对象全是纯 asyncio 流与进程内对象。
"""

from __future__ import annotations

import ast
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.api.v1 import lsp as lsp_module
from app.services import command_streamer as cs
from app.services import mcp_server as mcp_server_module
from app.services.command_streamer import (
    FRAME_READ_EOF,
    FRAME_READ_LINE,
    FRAME_READ_TOO_LARGE,
    PROTOCOL_FRAME_LIMIT_BYTES,
    ProtocolFrameRead,
    read_protocol_frame,
)
from app.services.mcp_client import MCPClient, MCPClientConfig

# 刻意把测试里的 StreamReader 限流做小(64 字节),否则会造 8MiB 数据。
# 被测代码不读这个值 —— 超限判据来自 asyncio 自身的 limit,与预算常量解耦,
# 所以"小 limit 造超限"证明的是分流逻辑,不是某个数字。
TINY_LIMIT = 64
OVERSIZED_LINE = b"X" * 500 + b"\n"
GOOD_FRAME = b'{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n'


def _reader_with(*chunks: bytes, eof: bool = False) -> asyncio.StreamReader:
    """造一个真 asyncio.StreamReader(不是替身 —— 被测的就是它与 asyncio 的交互)。

    eof=True 用于喂给"读到尽头才返回"的采集循环(``_stderr_reader`` /
    ``_drain_stream`` / ``_read_stream``):不给 EOF 那些循环会永远等在
    readuntil 上,整个用例连同 worker 一起挂住(本文件第一版就踩过这一型,
    现象是 pytest 无输出挂 10 分钟而不是用例失败)。
    """
    reader = asyncio.StreamReader(limit=TINY_LIMIT)
    for c in chunks:
        reader.feed_data(c)
    if eof:
        reader.feed_eof()
    return reader


def _lsp_frame(payload: dict[str, Any]) -> bytes:
    raw = json.dumps(payload).encode("utf-8")
    return b"Content-Length: " + str(len(raw)).encode() + b"\r\n\r\n" + raw


# ---------------------------------------------------------------------------
# ④ 阳性对照 —— 先证明"这份夹具确实会超限",否则后面全是空证
# ---------------------------------------------------------------------------


async def test_bare_readline_actually_raises_on_this_fixture() -> None:
    """同一份数据喂裸逐行读取必须超限 —— 并且**实测记下 asyncio 换皮这件事**。

    这条断言的对象是 asyncio 而不是本项目代码,它同时钉两件事:
      1. 这份夹具确实造得出超限(否则 ①② 就成了空证,而两个都绿什么都证明不了);
      2. ``readline()`` 抛的是 **ValueError** 而不是 LimitOverrunError ——
         共享出口因此必须走 readuntil。哪天 asyncio 改了这个行为,本条会红,
         提示去复核 read_protocol_frame 的捕错口径,而不是让分流悄悄失效。
    """
    reader = _reader_with(OVERSIZED_LINE)
    with pytest.raises(ValueError):
        await reader.readline()

    fresh = _reader_with(OVERSIZED_LINE)
    with pytest.raises(asyncio.LimitOverrunError):
        await fresh.readuntil(b"\n")


# ---------------------------------------------------------------------------
# ③ 正常路径:三类结局各自正确
# ---------------------------------------------------------------------------


async def test_read_protocol_frame_classifies_three_outcomes() -> None:
    good = _reader_with(b"hello\n")
    frame = await read_protocol_frame(good)
    assert frame.kind == FRAME_READ_LINE
    assert frame.data == b"hello\n"
    assert frame.dropped_bytes == 0

    eof = asyncio.StreamReader(limit=TINY_LIMIT)
    eof.feed_eof()
    ended = await read_protocol_frame(eof)
    assert ended.kind == FRAME_READ_EOF

    # EOF 前最后一帧没有收尾换行:必须当"最后一帧"交出去,不得当残帧丢掉
    # (printf 'x' / 进程被 kill 在半行都是这一型,丢了就是回归)。
    partial = asyncio.StreamReader(limit=TINY_LIMIT)
    partial.feed_data(b"tail-without-newline")
    partial.feed_eof()
    tail = await read_protocol_frame(partial)
    assert tail.kind == FRAME_READ_LINE
    assert tail.data == b"tail-without-newline"


async def test_read_protocol_frame_reports_overflow_and_resyncs() -> None:
    reader = _reader_with(OVERSIZED_LINE, GOOD_FRAME)
    bad = await read_protocol_frame(reader)
    assert bad.kind == FRAME_READ_TOO_LARGE
    assert bad.resynced is True
    assert bad.dropped_bytes >= len(OVERSIZED_LINE) - 1

    # ② 超限之后仍能读到下一条正常帧(整帧完好,不是半行)
    nxt = await read_protocol_frame(reader)
    assert nxt.kind == FRAME_READ_LINE
    assert nxt.data == GOOD_FRAME


async def test_overflow_resync_pushes_back_bytes_beyond_line_end() -> None:
    """残余回收**不得吃掉下一帧的开头**。

    一次性喂"超限行 + 正常帧":一次分块读会把两帧一起取回,行尾之后的字节属于
    下一帧。必须在退回缓冲区后仍能被下一帧完整读到 —— 这是整块分流里最容易写
    错、且写错后表现成"偶发解析失败"的那一格。
    """
    reader = _reader_with(OVERSIZED_LINE + GOOD_FRAME)
    bad = await read_protocol_frame(reader)
    assert bad.kind == FRAME_READ_TOO_LARGE
    assert bad.resynced is True
    nxt = await read_protocol_frame(reader)
    assert nxt.kind == FRAME_READ_LINE
    assert nxt.data == GOOD_FRAME, "下一帧被残余回收吃掉了开头"


async def test_overflow_without_buffer_access_is_declared_not_guessed() -> None:
    """拿不到退回通道时**必须**如实报失步,而不是假装已经对齐。"""

    class _NoBufferStream:
        def __init__(self) -> None:
            self._pending = OVERSIZED_LINE + GOOD_FRAME

        async def readline(self) -> bytes:
            raise asyncio.LimitOverrunError(
                "Separator is not found, and chunk exceed the limit", 0
            )

        async def read(self, n: int) -> bytes:
            out, self._pending = self._pending[:n], self._pending[n:]
            return out

    # 前提:这个替身确实没有 _buffer / readuntil(否则测的就不是这两支)
    assert not hasattr(_NoBufferStream(), "_buffer")
    bad = await read_protocol_frame(_NoBufferStream())  # type: ignore[arg-type]
    assert bad.kind == FRAME_READ_TOO_LARGE
    assert bad.resynced is False


async def test_readline_only_stream_mapping_value_error_to_overflow() -> None:
    """只实现 readline() 的流:asyncio 换皮抛的 ValueError 必须仍算"超限"。

    不接这一支的话,任何 readline 型替身/包装流上的超限会照旧冒到调用方的
    `except Exception` —— 那正是本票立项那一型的起点。长度记 0 而不是编一个数,
    因为 readline() 抛错前已经把缓冲区动过,真实长度无从恢复(见字段文档)。
    """

    class _ReadlineOnlyStream:
        async def readline(self) -> bytes:
            raise ValueError("Separator is found, but chunk is longer than limit")

    assert not hasattr(_ReadlineOnlyStream(), "readuntil")
    bad = await read_protocol_frame(_ReadlineOnlyStream())  # type: ignore[arg-type]
    assert bad.kind == FRAME_READ_TOO_LARGE
    assert bad.dropped_bytes == 0
    assert bad.resynced is False


# ---------------------------------------------------------------------------
# ① ② MCP stdio:超限帧不得被当成连接死亡
# ---------------------------------------------------------------------------


def _client() -> MCPClient:
    return MCPClient(
        MCPClientConfig(
            name="oversize-probe",
            transport="stdio",
            command="noop",
            reconnect=True,  # 关键:重连是开着的,旧代码才会无限重连
            timeout=1.0,
        )
    )


def _spy_reconnect(client: MCPClient) -> list[int]:
    """把 _reconnect 换成"被调用即记账"的替身。

    create_task() 只建任务不执行,所以要**在取协程对象的那一刻**记账,
    不能等 await —— 否则测的是任务调度而不是"有没有决定重连"。
    """
    calls: list[int] = []

    def _spy() -> Any:
        calls.append(1)

        async def _noop() -> None:
            return None

        return _noop()

    client._reconnect = _spy  # type: ignore[method-assign]
    return calls


async def test_oversized_frame_does_not_trigger_reconnect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """① 超限帧不增加 reconnect 计数 + ② 之后仍能读到正常帧。"""
    client = _client()
    reader = _reader_with(OVERSIZED_LINE, GOOD_FRAME)
    client._reader = reader
    client._connected = True

    reconnects = _spy_reconnect(client)
    handled: list[str] = []

    def _handle(raw: str) -> None:
        handled.append(raw)
        client._connected = False  # 读到正常帧就收工:不喂 EOF,别走结束分支

    monkeypatch.setattr(client, "_handle_message", _handle)

    await asyncio.wait_for(client._stdio_read_loop(), timeout=5)

    assert reconnects == [], "超限帧被当成连接死亡并触发了重连(本票病灶)"
    assert client.dropped_frames() == 1
    assert handled == [GOOD_FRAME.decode().strip()], "超限后没能读到下一条正常帧"


async def test_normal_frames_reconnect_on_real_eof(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③ 零回归:对端真的关闭时,重连语义必须照旧生效。

    这条是 ① 的反向对照 —— 把超限分支写错成"一律不重连"同样会被它抓住。
    """
    client = _client()
    reader = _reader_with(GOOD_FRAME)
    reader.feed_eof()
    client._reader = reader
    client._connected = True

    reconnects = _spy_reconnect(client)
    handled: list[str] = []
    monkeypatch.setattr(client, "_handle_message", lambda raw: handled.append(raw))

    await asyncio.wait_for(client._stdio_read_loop(), timeout=5)

    assert handled == [GOOD_FRAME.decode().strip()]
    assert client.dropped_frames() == 0
    assert reconnects == [1], "真 EOF 不再重连 = 改了不该改的行为"


# ---------------------------------------------------------------------------
# ③ 非协议采集路径:超限不炸循环 + 如实标注截断
# ---------------------------------------------------------------------------


async def test_stderr_reader_survives_oversized_line() -> None:
    """mcp_client 的 stderr 采集:旧实现 `except Exception: pass` 会静默停掉
    整个采集 —— 之后该子进程的所有诊断输出消失得无声无息。

    判据是"流已被读到尽头":新实现把超限行和其后那行都消费掉了;旧实现在第一
    行就抛异常返回,缓冲区里还压着 500+11 字节。
    """
    client = _client()
    reader = _reader_with(OVERSIZED_LINE, b"still-alive\n", eof=True)
    await asyncio.wait_for(client._stderr_reader(reader), timeout=5)
    follow = await read_protocol_frame(reader)
    assert follow.kind == FRAME_READ_EOF, "stderr 采集在超限行上就停了,残余仍在缓冲区"


async def test_mcp_server_drain_stream_marks_truncation_and_continues() -> None:
    reader = _reader_with(OVERSIZED_LINE, b"second line\n", eof=True)
    lines: list[str] = []
    await asyncio.wait_for(
        mcp_server_module._drain_stream(reader, lines, max_output=10_000), timeout=5
    )
    joined = "\n".join(lines)
    assert "帧预算" in joined, "超限没有留下任何截断说明(静默变短)"
    assert "second line" in joined, "超限后停止读取了后续输出"
    assert "X" * 500 not in joined


async def test_command_streamer_read_stream_emits_truncation_event() -> None:
    reader = _reader_with(OVERSIZED_LINE, b"after\n", eof=True)
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    await asyncio.wait_for(cs._read_stream(reader, "stdout", queue), timeout=5)
    got: list[dict[str, Any]] = []
    while not queue.empty():
        item = queue.get_nowait()
        if item is not None:
            got.append(item)
    assert any(e.get("truncated") for e in got), "超限未标注截断事件"
    assert any(e.get("content") == "after" for e in got), "超限后续事件丢失"


# ---------------------------------------------------------------------------
# ③ LSP:体超预算时连接必须保持可用(不是"服务器掉了")
# ---------------------------------------------------------------------------


async def test_lsp_body_over_budget_skips_and_keeps_reading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(lsp_module, "PROTOCOL_FRAME_LIMIT_BYTES", 100)
    client = lsp_module.LspClient(str(Path.cwd()))
    good = _lsp_frame({"jsonrpc": "2.0", "id": 7, "result": {"ok": 1}})
    reader = asyncio.StreamReader(limit=4096)
    reader.feed_data(b"Content-Length: 200\r\n\r\n" + b"y" * 200 + good)
    reader.feed_eof()
    client.proc = SimpleNamespace(stdout=reader)  # type: ignore[assignment]

    fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    client._responses[7] = fut

    await asyncio.wait_for(client._read_loop(), timeout=5)

    assert client._dropped_frames == 1, "超预算响应体没有留计数"
    assert await fut == {"ok": 1}, "跳过超预算帧后没能继续解析下一帧"


# ---------------------------------------------------------------------------
# ⑤ 源码锁:一处定义、spawn 声明、出口之外不得再有裸调用
# ---------------------------------------------------------------------------

_SERVICES = Path(cs.__file__).resolve().parent
_APP = _SERVICES.parent
_HOST = _SERVICES / "command_streamer.py"
_SOURCES: dict[str, Path] = {
    "command_streamer": _HOST,
    "mcp_client": _SERVICES / "mcp_client.py",
    "container_runtime": _SERVICES / "container_runtime.py",
    "agent_engine": _SERVICES / "agent_engine.py",
    "mcp_server": _SERVICES / "mcp_server.py",
    "lsp": _APP / "api" / "v1" / "lsp.py",
}


def _readline_calls(path: Path) -> list[tuple[int, str]]:
    """AST 里真正的 ``X.readline()`` 调用点(行号 + 被调对象的源码片段)。

    为什么不用文本 grep:解释本 bug 的注释与 docstring 必然要写那个调用,按文本
    判会把散文判成违规(守门 131"门把解释自己的散文判成了违规"、守门 70 的 URL
    假注释态同一型)。AST 只看代码位,注释与 docstring 天然不进。
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "readline"
        ):
            found.append((node.lineno, ast.unparse(node.func.value)))
    return found


def test_frame_budget_has_exactly_one_definition() -> None:
    """常量只许定义一处 —— 第二份真相是本仓记过最多次的失败型。"""
    defs = [
        name
        for name, p in _SOURCES.items()
        if "PROTOCOL_FRAME_LIMIT_BYTES: int =" in p.read_text(encoding="utf-8")
    ]
    assert defs == ["command_streamer"], f"帧预算出现第二处定义: {defs}"
    assert PROTOCOL_FRAME_LIMIT_BYTES == 8 * 1024 * 1024


def test_oversized_frame_budget_underneath_the_ingress_cap() -> None:
    """预算必须落在"合法最大帧"与"下游入口上限"之间(取值依据的机器版)。

    下界:本仓最大单产物 5MB 图档经 base64(4/3)膨胀后约 6.67MB。
    上界:apps/api 全局 bodyLimit 是 10MiB,大过它一帧在本端收下后转发必 413,
          只是把失败点后移并换个更难归因的形态。
    """
    largest_legitimate_frame = int(5 * 1024 * 1024 * 4 / 3)
    api_ingress_cap = 10 * 1024 * 1024
    assert largest_legitimate_frame < PROTOCOL_FRAME_LIMIT_BYTES < api_ingress_cap, (
        "帧预算必须落在 [合法最大帧, 下游入口上限] 之间:"
        f"合法帧约 {largest_legitimate_frame} B,api 全局 bodyLimit {api_ingress_cap} B"
    )


def test_every_spawn_site_declares_the_frame_budget() -> None:
    """派生子进程并在本票射程内的文件必须显式传 limit。

    只在读取侧分流而不声明预算 = 默认 64KiB 仍会把合法帧判成超限,那时本票
    做的事就只是"把误判换了个地方报"。
    """
    for name, path in _SOURCES.items():
        src = path.read_text(encoding="utf-8")
        if "create_subprocess_exec" in src:
            assert "limit=PROTOCOL_FRAME_LIMIT_BYTES" in src, (
                f"{name} 派生子进程却没声明帧预算"
            )


def test_no_bare_readline_left_outside_the_helper() -> None:
    """除 stdin(同步、不在本票范围)与唯一出口内部,不得再有裸调用。"""
    for name, path in _SOURCES.items():
        for lineno, receiver in _readline_calls(path):
            if name == "command_streamer":
                assert receiver == "stream", (
                    f"{name}:{lineno} 唯一出口之外出现裸 readline(接收者 {receiver})"
                )
                continue
            assert "stdin" in receiver, (
                f"{name}:{lineno} 又写了裸 readline()(接收者 {receiver})"
                " —— 本票病灶复发"
            )


def test_frame_read_outcome_labels_are_stable() -> None:
    """三个结局标识是稳定契约(分流、日志字段、测试都认它),不得漂成裸串。"""
    assert (FRAME_READ_LINE, FRAME_READ_TOO_LARGE, FRAME_READ_EOF) == (
        "line",
        "frame_too_large",
        "eof",
    )
    assert ProtocolFrameRead(FRAME_READ_EOF).resynced is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
