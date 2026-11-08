# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""工具层安全护栏单元测试(W2 · Phase 0)。

覆盖:
- 0-2 call_tool 出口统一输出护栏(截断标记 / JSON 结构完整 / truncated 标志)
- 0-5 run_command 危险命令硬门(表驱动命中拦截 + echo 无害放行)
- 0-6 dispatch_subagent 治理(并发上限拒绝 / 嵌套深度拒绝)
"""

from __future__ import annotations

import asyncio

import pytest

from app.core.mcp_tool_approval import (
    CREDIT_APPROVAL_ERROR,
    apply_host_credit_facts,
    decide_credit_spend,
    gate_image_spend,
    quote_image_credits,
)
from app.services import mcp_server as mcp_server_mod
from app.services.mcp_server import (
    _match_destructive_command,
    _subagent_depth,
    _tool_dispatch_subagent,
    _tool_run_command,
    _truncate_tool_output,
)

# =============================================================================
# 0-2 call_tool 出口统一输出护栏
# =============================================================================


def test_truncate_tool_output_small_unchanged(monkeypatch):
    """未超预算:原样返回,不加 truncated 标志,结构完整。"""
    monkeypatch.setenv("TOOL_OUTPUT_MAX_TOKENS", "8000")
    result = {
        "ok": True,
        "status": "completed",
        "output": "短内容",
        "nested": {"a": "b"},
        "list": ["x", "y"],
    }
    out = _truncate_tool_output(dict(result))
    assert out == result
    assert "truncated" not in out


def test_truncate_tool_output_marker_and_structure(monkeypatch):
    """超预算:追加标记、置 truncated=True、保持 dict 结构与控制字段完整。"""
    # 将预算压到很小,确保触发截断
    monkeypatch.setenv("TOOL_OUTPUT_MAX_TOKENS", "50")
    result = {
        "ok": True,
        "status": "completed",  # 受保护控制字段,不应被截断
        "output": "A" * 2000,  # 约 500 token
        "nested": {"content": "B" * 2000},
        "items": ["C" * 1000, "D" * 1000],
    }
    out = _truncate_tool_output(result)
    assert out.get("truncated") is True
    # 控制字段完整保留
    assert out["ok"] is True
    assert out["status"] == "completed"
    # 截断标记已追加到被截断的字符串值上
    assert "…[已截断" in out["output"]
    assert "可用分页/范围参数获取更多" in out["output"]
    # dict 结构与非字符串字段保持
    assert "nested" in out and "items" in out and isinstance(out["items"], list)
    assert len(out["items"]) == 2


# =============================================================================
# 0-5 run_command 危险命令硬门
# =============================================================================


@pytest.mark.parametrize(
    "command,expected",
    [
        # Windows
        ("format c:", "win_format"),
        ("diskpart", "win_diskpart"),
        ("reg delete HKLM\\Software\\Foo /f", "win_reg_delete"),
        ("shutdown /s /t 0", "shutdown"),
        ("bcdedit /set {default} ..." , "win_bcdedit"),
        ("vssadmin delete shadows /all", "win_vssadmin_delete"),
        ("cipher /w:C", "win_cipher_w"),
        ("rd /s C:\\temp", "win_rd_s"),
        ("del /f /s /q C:\\*", "win_del_fsq"),
        ("Remove-Item C:\\ -Recurse -Force", "win_remove_item_root"),
        # Unix
        ("rm -rf /", "unix_rm_rf_root"),
        ("rm -rf /etc/passwd", "unix_rm_rf_root"),
        ("rm -rf ~", "unix_rm_rf_root"),
        ("sudo rm -rf /var", "unix_rm_rf_root"),
        ("mkfs.ext4 /dev/sda1", "unix_mkfs"),
        ("dd if=x of=/dev/sda", "unix_dd_dev"),
        ("chmod -R 777 /", "unix_chmod_777_root"),
        (":(){ :|:& };:", "unix_fork_bomb"),
    ],
)
def test_match_destructive_command_blocked(command, expected):
    """表驱动:破坏性命令被确定性识别,返回对应模式名。"""
    assert _match_destructive_command(command) == expected


@pytest.mark.parametrize(
    "command",
    [
        "echo hello",
        "ls -la /tmp",
        "git status",
        "python script.py",
        "cat file.txt",
        "npm run build",
    ],
)
def test_match_destructive_command_harmless(command):
    """无害命令不应被判定为破坏性。"""
    assert _match_destructive_command(command) is None


async def test_run_command_echo_allowed(monkeypatch):
    """无害命令(echo)在硬门下正常放行(mock subprocess 层,不真正起进程)。"""
    monkeypatch.setenv("DANGEROUS_COMMAND_BLOCKED", "true")
    # 让 echo 通过前缀白名单,且无危险模式(隔离 command_policy.json 依赖)
    monkeypatch.setattr(
        mcp_server_mod,
        "_load_command_policy",
        lambda: {"allowed_prefixes": ["echo"], "dangerous_patterns": []},
    )

    # mock 流式读取:把固定行写入 stdout_lines
    # P0-B(2026-09-18):_drain_stream 签名新增 on_line/batch_lines(terminal.delta
    # 实时输出回调),mock 需吞掉新 kwargs 保持兼容。
    async def _fake_drain(stream, lines, *args, **kwargs):
        lines.append("hello\n")

    monkeypatch.setattr(mcp_server_mod, "_drain_stream", _fake_drain)

    class _FakeProc:
        returncode = 0
        stdout = object()
        stderr = object()

        def kill(self):
            pass

        async def wait(self):
            return None

    async def _fake_create(*args, **kwargs):
        return _FakeProc()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake_create)

    result = await _tool_run_command({"command": "echo hello"})
    assert result["ok"] is True
    assert "hello" in result["stdout"]


async def test_run_command_dangerous_blocked(monkeypatch):
    """破坏性命令(shutdown)命中硬门:返回 dangerous_command_blocked + matched。"""
    monkeypatch.setenv("DANGEROUS_COMMAND_BLOCKED", "true")
    result = await _tool_run_command({"command": "shutdown /s /t 0"})
    assert result["ok"] is False
    assert result["error"] == "dangerous_command_blocked"
    assert result["matched"] == "shutdown"
    # 不应真正执行(无 stdout/stderr 产物)
    assert result.get("stdout", "") == ""


# =============================================================================
# 0-6 dispatch_subagent 治理
# =============================================================================


async def test_subagent_concurrency_exceeded(monkeypatch):
    """并发达上限时,新派发被拒绝(返回 CONCURRENCY_LIMIT_EXCEEDED)。"""
    sem = asyncio.Semaphore(1)
    await sem.acquire()  # 模拟已被占用 -> locked()
    try:
        monkeypatch.setattr(mcp_server_mod, "_SUBAGENT_SEMAPHORE", sem)
        result = await _tool_dispatch_subagent({"name": "a", "task": "b"})
        assert result["ok"] is False
        assert result["errorCode"] == "CONCURRENCY_LIMIT_EXCEEDED"
    finally:
        sem.release()


async def test_subagent_nesting_depth_exceeded(monkeypatch):
    """嵌套深度 > 上限(2)时,派发被拒绝(返回 NESTING_DEPTH_EXCEEDED)。"""
    token = _subagent_depth.set(2)
    try:
        result = await _tool_dispatch_subagent({"name": "a", "task": "b"})
        assert result["ok"] is False
        assert result["errorCode"] == "NESTING_DEPTH_EXCEEDED"
    finally:
        _subagent_depth.reset(token)


# =============================================================================
# W1(2026-09-18)terminal.delta 进程内直投(push)路径
# =============================================================================


async def test_terminal_delta_push_direct_injection(monkeypatch):
    """contextvar 注入 push 时:走直投,payload 契约与 SSE 帧一致,且不再经 hook_engine。

    这是 web 主聊天流实时回显终端输出的关键路径 —— 一旦回归成 hook_engine 广播,
    llm.py 的 generator 收不到帧,前端终端区块会退化为"执行完才一次性显示"。
    """
    emitted: list[tuple[str, dict]] = []

    async def _fake_emit(event: str, payload: dict) -> None:
        emitted.append((event, payload))

    from app.services.hook_engine import hook_engine

    monkeypatch.setattr(hook_engine, "emit", _fake_emit)

    frames: list[dict] = []
    token = mcp_server_mod.set_terminal_stream_context(
        session_id="sess-1",
        iteration=3,
        tool_call_id="toolu_abc",
        messageId="msg-1",
        push=frames.append,  # 同步 callable = asyncio.Queue.put_nowait 的替身
    )
    try:
        await mcp_server_mod._emit_terminal_delta("npm run build", "stdout", "compiling...")
    finally:
        mcp_server_mod.reset_terminal_stream_context(token)

    assert len(frames) == 1
    payload = frames[0]
    assert payload["type"] == "terminal_delta"
    assert payload["terminalId"] == "toolu_abc"
    assert payload["command"] == "npm run build"
    assert payload["stream"] == "stdout"
    assert payload["text"] == "compiling..."
    assert payload["iteration"] == 3
    assert payload["messageId"] == "msg-1"
    # 直投命中即返回,不得再广播(hook_engine 零调用 → agent 通道无重复帧)
    assert emitted == []


async def test_terminal_delta_without_push_broadcasts(monkeypatch):
    """无 push(agent_loop_v2 等订阅方)时:维持 hook_engine.emit 广播,agent 通道零回归。"""
    emitted: list[tuple[str, dict]] = []

    async def _fake_emit(event: str, payload: dict) -> None:
        emitted.append((event, payload))

    from app.services.hook_engine import hook_engine

    monkeypatch.setattr(hook_engine, "emit", _fake_emit)

    token = mcp_server_mod.set_terminal_stream_context(
        session_id="sess-2", iteration=1, tool_call_id="toolu_x"
    )
    try:
        await mcp_server_mod._emit_terminal_delta("echo hi", "stderr", "warn")
    finally:
        mcp_server_mod.reset_terminal_stream_context(token)

    assert len(emitted) == 1
    event, payload = emitted[0]
    assert event == "terminal.delta"
    assert payload["session_id"] == "sess-2"
    assert payload["run_id"] == "sess-2"
    assert payload["stream"] == "stderr"
    assert payload["text"] == "warn"


async def test_terminal_delta_empty_text_and_missing_cid(monkeypatch):
    """空 text 不发射;缺 tool_call_id 时 terminalId 回落空串且不塞空 messageId。"""
    frames: list[dict] = []
    token = mcp_server_mod.set_terminal_stream_context(push=frames.append)
    try:
        await mcp_server_mod._emit_terminal_delta("cmd", "stdout", "")
        assert frames == []
        await mcp_server_mod._emit_terminal_delta("cmd", "stdout", "x")
    finally:
        mcp_server_mod.reset_terminal_stream_context(token)

    assert len(frames) == 1
    assert frames[0]["terminalId"] == ""
    assert frames[0]["iteration"] is None
    assert "messageId" not in frames[0]


def test_quote_is_measured_from_pixels() -> None:
    assert quote_image_credits("1024x1024") == 10
    assert quote_image_credits("512x512") == 3
    assert quote_image_credits("not-a-size") is None
    assert quote_image_credits("0x1024") is None
    assert quote_image_credits(1024) is None


def test_below_line_allows_without_asking() -> None:
    disposition, reason = decide_credit_spend(
        quoted_credits=10, balance_credits=1000, approval=None
    )
    assert disposition == "allow"
    assert reason == "below-line"


def test_high_share_needs_a_person() -> None:
    disposition, reason = decide_credit_spend(
        quoted_credits=10, balance_credits=1, approval=None
    )
    assert disposition == "require-approval"
    assert reason == "needs-approval"


def test_denied_is_not_allow_and_unknown_word_is_unjudged() -> None:
    denied, denied_reason = decide_credit_spend(
        quoted_credits=10, balance_credits=1, approval="denied"
    )
    assert denied == "denied"
    assert denied_reason == "denied"
    unknown, unknown_reason = decide_credit_spend(
        quoted_credits=10, balance_credits=1, approval="yes"
    )
    assert unknown == "unjudged"
    assert unknown_reason == "approval-unrecognized"


def test_missing_quote_is_not_zero() -> None:
    disposition, reason = decide_credit_spend(
        quoted_credits=None, balance_credits=100, approval="granted"
    )
    assert disposition == "unjudged"
    assert reason == "quote-unmeasured"


def test_model_grant_cannot_overwrite_host() -> None:
    stamped = apply_host_credit_facts(
        {
            "prompt": "cat",
            "size": "1024x1024",
            "credit_approval": "granted",
            "__credit_approval": "granted",
            "__credit_balance": 99999,
        },
        balance=1,
        approval=None,
    )
    blocked = gate_image_spend(stamped)
    assert blocked is not None
    assert blocked["errorCode"] == CREDIT_APPROVAL_ERROR
    assert blocked["creditSpend"]["balanceCredits"] == 1
    assert blocked["creditSpend"]["disposition"] == "require-approval"


def test_host_grant_and_low_share_do_not_block() -> None:
    granted = apply_host_credit_facts(
        {"size": "1024x1024"}, balance=1, approval="granted"
    )
    cheap = apply_host_credit_facts(
        {"size": "1024x1024"}, balance=1000, approval=None
    )
    absent = apply_host_credit_facts(
        {"credit_approval": "granted"}, balance=None, approval=None
    )
    assert gate_image_spend(granted) is None
    assert gate_image_spend(cheap) is None
    assert gate_image_spend(absent) is None


def test_bad_balance_shape_blocks_instead_of_looking_absent() -> None:
    blocked = gate_image_spend({"__credit_balance": True, "size": "1024x1024"})
    assert blocked is not None
    assert blocked["creditSpend"]["reason"] == "balance-invalid"


@pytest.mark.asyncio
async def test_rejection_does_not_touch_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"chain": 0, "once": 0}

    def chain(_explicit: object) -> list[str]:
        calls["chain"] += 1
        return ["stub"]

    async def once(*_args: object, **_kwargs: object) -> dict[str, object]:
        calls["once"] += 1
        return {"tool": "image_generation", "ok": True}

    monkeypatch.setattr(mcp_server_mod, "_image_provider_chain", chain)
    monkeypatch.setattr(mcp_server_mod, "_image_generate_once", once)
    out = await mcp_server_mod._tool_image_generation(
        apply_host_credit_facts(
            {"prompt": "cat", "size": "1024x1024", "credit_approval": "granted"},
            balance=1,
            approval=None,
        )
    )
    assert out["ok"] is False
    assert out["errorCode"] == CREDIT_APPROVAL_ERROR
    assert calls == {"chain": 0, "once": 0}


@pytest.mark.asyncio
async def test_host_grant_reaches_provider_once(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"once": 0}

    monkeypatch.setattr(mcp_server_mod, "_image_provider_chain", lambda _explicit: ["stub"])

    async def once(*_args: object, **_kwargs: object) -> dict[str, object]:
        calls["once"] += 1
        return {"tool": "image_generation", "ok": True, "provider": "stub"}

    monkeypatch.setattr(mcp_server_mod, "_image_generate_once", once)
    out = await mcp_server_mod._tool_image_generation(
        apply_host_credit_facts(
            {"prompt": "cat", "size": "1024x1024"}, balance=1, approval="granted"
        )
    )
    assert out["ok"] is True
    assert calls["once"] == 1


@pytest.mark.asyncio
async def test_call_tool_overwrites_model_self_approval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"chain": 0}

    def chain(_explicit: object) -> list[str]:
        calls["chain"] += 1
        return ["stub"]

    monkeypatch.setattr(mcp_server_mod, "_image_provider_chain", chain)
    server = mcp_server_mod.MCPServer()
    out = await server.call_tool(
        "image_generation",
        {
            "prompt": "cat",
            "size": "1024x1024",
            "credit_approval": "granted",
            "__credit_balance": 99999,
            "__credit_approval": "granted",
        },
        credit_balance=1,
        credit_approval=None,
    )
    assert out["errorCode"] == CREDIT_APPROVAL_ERROR
    assert out["creditSpend"]["balanceCredits"] == 1
    assert calls["chain"] == 0


# =============================================================================
# AIS-116:image_edit 与 image_generation 同源计费,同一预算闸
# =============================================================================


@pytest.mark.asyncio
async def test_image_edit_requires_approval_before_upstream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"edits": 0}

    class _Provider:
        def __init__(self, **_kwargs: object) -> None:
            pass

        async def images_edits(self, *_args: object, **_kwargs: object) -> dict:
            calls["edits"] += 1
            return {"images": [{"url": "https://example.com/x.png"}]}

    from app.providers import token6688_provider as t68

    monkeypatch.setattr(t68, "Token6688Provider", _Provider)
    monkeypatch.setenv("TOKEN6688_API_KEY", "sk-test")
    out = await mcp_server_mod._tool_image_edit(
        apply_host_credit_facts(
            {"image": "https://example.com/in.png", "prompt": "改成猫", "size": "1024x1024"},
            balance=1,
            approval=None,
        )
    )
    assert out["ok"] is False
    assert out["errorCode"] == CREDIT_APPROVAL_ERROR
    assert out["tool"] == "image_edit"
    assert calls["edits"] == 0  # 拦在上游之前,一次付费调用都没发生


@pytest.mark.asyncio
async def test_image_edit_grant_reaches_provider_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"edits": 0}

    class _Provider:
        def __init__(self, **_kwargs: object) -> None:
            pass

        async def images_edits(self, *_args: object, **_kwargs: object) -> dict:
            calls["edits"] += 1
            return {"images": [{"url": "https://example.com/x.png"}], "model": "stub"}

    from app.providers import token6688_provider as t68

    monkeypatch.setattr(t68, "Token6688Provider", _Provider)
    monkeypatch.setenv("TOKEN6688_API_KEY", "sk-test")

    async def fake_bytes(_src: object) -> tuple[bytes, None]:
        return b"img", None

    monkeypatch.setattr(mcp_server_mod, "_resolve_image_source_bytes", fake_bytes)
    out = await mcp_server_mod._tool_image_edit(
        apply_host_credit_facts(
            {"image": "https://example.com/in.png", "prompt": "改成猫", "size": "1024x1024"},
            balance=1,
            approval="granted",
        )
    )
    assert out["ok"] is True
    assert calls["edits"] == 1
