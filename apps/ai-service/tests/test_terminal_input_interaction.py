# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」)的行为回归。

覆盖三件"没有测试就会静默坏掉"的事:
1. 提示探测的正反例 —— 假阳的代价不是"多一帧",是**凭空多等**;假阴的代价是用户看不见"它在等什么"。
2. 代答的归属判定 —— 越权用例必须断言**副作用没发生**(future 没被结算 ⇒ stdin 一个字节都没写),
   只看返回值会把"先喂了再拒绝"放过。
3. 真进程收到键入 —— 用真解释器跑一次 stdin.readline(),断言它的输出里出现提交值;
   再断言"不像在等人"的命令**立刻拿到 EOF**(否则 `cat` 会从马上结束变成挂到超时,那是回归不是功能)。

本机不需要 PG/Redis:全部是进程内 + 子进程,ASGI 与数据库都不参与。
"""

from __future__ import annotations

import asyncio
import contextlib
import sys
import time

import pytest

from app.services import mcp_server as ms


def _fake_activity(line: str, *, idle_s: float = 5.0) -> dict[str, object]:
    return {"ts": time.monotonic() - idle_s, "last_line": line, "last_prompt": None}


# ---------------------------------------------------------------------------
# 1. 探测:正反成对
# ---------------------------------------------------------------------------


def test_prompt_detector_hits_real_prompts() -> None:
    for text in (
        "请输入名称:",
        "Continue? [y/N]",
        "Password:",
        "name: ",
        ">>> ",
    ):
        assert ms.looks_like_input_prompt(text) is not None, text


def test_prompt_detector_ignores_ordinary_output() -> None:
    # "pin" 藏在 mapping/passwordless 里、冒号出现在句中而非行尾 —— 都不算在等人。
    for text in (
        "total 12",
        "a mapping of values",
        "passwordless login enabled for host",
        "Error: file not found /a/b/c",
        "x" * 400,  # 超长的行不是提示符
        "",
    ):
        assert ms.looks_like_input_prompt(text) is None, text


def test_flag_default_is_on_and_env_can_turn_it_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 用户拍的是**默认开**;开关只关"代答"这一维,不改命令执行口径。
    monkeypatch.delenv("IHUI_TERMINAL_INTERACTION", raising=False)
    assert ms.terminal_interaction_enabled() is True
    monkeypatch.setenv("IHUI_TERMINAL_INTERACTION", "0")
    assert ms.terminal_interaction_enabled() is False


# ---------------------------------------------------------------------------
# 2. 归属判定:越权不得产生任何副作用
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_settle_requires_owner_and_session_and_leaves_future_untouched() -> None:
    loop = asyncio.get_running_loop()
    future: asyncio.Future[str] = loop.create_future()
    ms._terminal_input_pending["term-A"] = {
        "future": future,
        "user_id": "user-A",
        "session_id": "sess-A",
        "command": "whoami",
        "prompt_tail": "Password:",
        "registered_at": time.monotonic(),
    }
    try:
        # 别人的 terminalId:同形拒绝,而且 **future 必须还没被结算**
        r = ms.settle_terminal_input("sess-A", "term-A", "hunter2", "user-B")
        assert r["settled"] is False
        assert future.done() is False
        # 会话对不上(小概率撞号):同样不结算
        r2 = ms.settle_terminal_input("sess-B", "term-A", "hunter2", "user-A")
        assert r2["settled"] is False
        assert future.done() is False
        # 不存在的 id:与上面同形(调用方无法据此枚举谁的 terminalId 是真的)
        assert r == ms.settle_terminal_input("sess-A", "term-nope", "x", "user-A")
        # 属主本人:结算,且长度按封顶截断
        r3 = ms.settle_terminal_input("sess-A", "term-A", "y" * (ms.TERMINAL_INTERACTION_MAX_INPUT_CHARS + 500), "user-A")
        assert r3["settled"] is True
        assert future.done() is True
        assert len(str(future.result())) == ms.TERMINAL_INTERACTION_MAX_INPUT_CHARS
    finally:
        ms._terminal_input_pending.pop("term-A", None)


@pytest.mark.asyncio
async def test_no_push_channel_means_no_wait_at_all() -> None:
    # 帧送不出去(宿主没注入 push)就不该开始等 —— 否则等于凭空挂 300 秒。
    token = ms.set_terminal_stream_context(session_id="s", tool_call_id="t1", user_id="u1")
    try:
        text, timed_out = await ms._await_terminal_input(
            "t1", "whoami", "Password:", {"session_id": "s", "user_id": "u1"}
        )
        assert (text, timed_out) == (None, False)
        assert ms.terminal_input_waiter_count() == 0
    finally:
        ms.reset_terminal_stream_context(token)


# ---------------------------------------------------------------------------
# 3/4. 真进程:键入真的到达 stdin;不像等人时立刻给 EOF
# ---------------------------------------------------------------------------


async def _spawn(stdin_pipe: bool) -> asyncio.subprocess.Process:
    return await asyncio.create_subprocess_exec(
        sys.executable,
        "-c",
        "import sys\n"
        "sys.stdout.write('name: ')\n"
        "sys.stdout.flush()\n"
        "line = sys.stdin.readline()\n"
        "sys.stdout.write('GOT<' + line.rstrip() + '>')\n"
        "sys.stdout.flush()\n",
        stdin=asyncio.subprocess.PIPE if stdin_pipe else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )


@pytest.mark.asyncio
async def test_watcher_feeds_typed_line_into_real_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ms, "TERMINAL_INTERACTION_QUIET_S", 0.3, raising=False)
    monkeypatch.setattr(ms, "TERMINAL_INTERACTION_WAIT_TIMEOUT_S", 10, raising=False)

    frames: list[dict[str, object]] = []
    token = ms.set_terminal_stream_context(
        session_id="sess-1",
        tool_call_id="term-1",
        user_id="user-1",
        push=frames.append,
    )
    proc = await _spawn(stdin_pipe=True)
    activity = {"ts": time.monotonic(), "last_line": "", "last_prompt": None}
    state: dict[str, object] = {"interactionCount": 0, "inputWaitTimedOut": False, "waiting": False, "eofSent": False}
    watcher = asyncio.ensure_future(
        ms._watch_terminal_input(
            proc,
            activity,
            state,
            "term-1",
            {"session_id": "sess-1", "user_id": "user-1"},
            "python x.py",
        )
    )
    try:
        # 等观察器发帧(它读的是真 stdout 的尾行,所以要等进程真的打印出 "name: ")
        out_chunks: list[bytes] = []
        deadline = time.monotonic() + 8
        while not any(f.get("type") == "terminal_interaction" for f in frames) and time.monotonic() < deadline:
            assert proc.stdout is not None
            with contextlib.suppress(asyncio.TimeoutError):
                out_chunks.append(await asyncio.wait_for(proc.stdout.read(4096), timeout=0.3))
            # 把读到的行喂给观察器的"最近输出"(生产里由 _note_line 干这件事)
            text = b"".join(out_chunks).decode(errors="replace")
            activity["last_line"] = text.split("\n")[-1]
            activity["ts"] = time.monotonic() - 1.0
            await asyncio.sleep(0.05)
        interaction = [f for f in frames if f.get("type") == "terminal_interaction"]
        assert interaction, frames
        assert interaction[0]["promptTail"]
        assert interaction[0]["inputMode"] == "line"
        # 上行出口的路径里带 {session_id} ⇒ 帧必须自带会话 id,否则前端只能猜,
        # 而猜错的形态是"点了发送什么都没发生且不报错"。
        assert interaction[0]["sessionId"] == "sess-1"
        assert "text" not in interaction[0]  # 交互帧没有 text 字段:分流靠 type,不靠"有没有 text"

        # 属主键入 —— 真进程必须收到这一行
        assert ms.settle_terminal_input("sess-1", "term-1", "zhihui", "user-1")["settled"] is True
        rest = await asyncio.wait_for(proc.stdout.read(4096), timeout=8)
        out_chunks.append(rest)
        joined = b"".join(out_chunks).decode(errors="replace")
        assert "GOT<zhihui>" in joined, joined
        await asyncio.wait_for(proc.wait(), timeout=8)
        # 计数不得静默(验收②)
        for _ in range(40):
            if state["interactionCount"]:
                break
            await asyncio.sleep(0.05)
        assert state["interactionCount"] == 1
    finally:
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await watcher
        if proc.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
        ms.reset_terminal_stream_context(token)
        assert ms.terminal_input_waiter_count() == 0  # 待决条目必删,不留还能被写的把手


@pytest.mark.asyncio
async def test_quiet_command_without_prompt_gets_eof_immediately(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`cat` 型命令不该因为"我们开了代答"就从马上结束变成挂到超时。"""
    monkeypatch.setattr(ms, "TERMINAL_INTERACTION_QUIET_S", 0.2, raising=False)
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        "-c",
        "import sys\n"
        "sys.stdout.write('done-no-input')\n"
        "sys.stdout.flush()\n"
        "sys.stdin.read()\n",  # 读 stdin:拿到 EOF 就结束
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    activity = {"ts": time.monotonic(), "last_line": "", "last_prompt": None}
    state: dict[str, object] = {"interactionCount": 0, "inputWaitTimedOut": False, "waiting": False, "eofSent": False}
    frames: list[dict[str, object]] = []
    token = ms.set_terminal_stream_context(
        session_id="s2", tool_call_id="t2", user_id="u2", push=frames.append
    )
    watcher = asyncio.ensure_future(
        ms._watch_terminal_input(proc, activity, state, "t2", {"session_id": "s2", "user_id": "u2"}, "cat")
    )
    try:
        assert proc.stdout is not None
        data = await asyncio.wait_for(proc.stdout.read(4096), timeout=8)
        assert b"done-no-input" in data
        await asyncio.wait_for(proc.wait(), timeout=8)  # 没 EOF 就会挂在这里
        assert state["eofSent"] is True
        assert not [f for f in frames if f.get("type") == "terminal_interaction"]
    finally:
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await watcher
        ms.reset_terminal_stream_context(token)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
