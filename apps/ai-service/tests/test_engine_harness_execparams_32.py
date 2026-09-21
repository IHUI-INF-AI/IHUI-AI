# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core exec 参数与输出捕获测试 — 第三十二批(对标 Codex exec.rs 纯算法)
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio

import pytest

from app.core.exec_params import (
    DEFAULT_EXEC_COMMAND_TIMEOUT_MS,
    DEFAULT_OUTPUT_BYTES_CAP,
    EXEC_OUTPUT_MAX_BYTES,
    IO_DRAIN_TIMEOUT_MS,
    CancellationToken,
    ExecCapturePolicy,
    ExecExpiration,
    ExecExpirationOutcome,
    ExecParams,
    StreamOutput,
    aggregate_output,
    append_capped,
    cancel_when_either,
)

# ---------- 常量 ----------

def test_constants():
    assert DEFAULT_EXEC_COMMAND_TIMEOUT_MS == 10_000
    assert IO_DRAIN_TIMEOUT_MS == 2_000
    assert DEFAULT_OUTPUT_BYTES_CAP == 1024 * 1024
    assert EXEC_OUTPUT_MAX_BYTES == DEFAULT_OUTPUT_BYTES_CAP


# ---------- ExecCapturePolicy ----------

def test_shell_tool_cap_and_expiration():
    p = ExecCapturePolicy.SHELL_TOOL
    assert p.retained_bytes_cap() == EXEC_OUTPUT_MAX_BYTES
    assert p.uses_expiration() is True

def test_full_buffer_no_cap_no_expiration():
    p = ExecCapturePolicy.FULL_BUFFER
    assert p.retained_bytes_cap() is None
    assert p.uses_expiration() is False

def test_full_buffer_with_expiration():
    p = ExecCapturePolicy.FULL_BUFFER_WITH_EXPIRATION
    assert p.retained_bytes_cap() is None
    assert p.uses_expiration() is True

def test_sensitive_full_buffer():
    p = ExecCapturePolicy.SENSITIVE_FULL_BUFFER
    assert p.retained_bytes_cap() is None
    assert p.uses_expiration() is True

def test_io_drain_timeout_constant():
    assert ExecCapturePolicy.SHELL_TOOL.io_drain_timeout_ms() == IO_DRAIN_TIMEOUT_MS


# ---------- CancellationToken ----------

def test_token_cancel_and_flag():
    tok = CancellationToken()
    assert tok.is_cancelled is False
    tok.cancel()
    assert tok.is_cancelled is True

@pytest.mark.asyncio
async def test_token_await_cancelled():
    tok = CancellationToken()
    tok.cancel()
    await asyncio.wait_for(tok.cancelled(), timeout=1)
    assert tok.is_cancelled

@pytest.mark.asyncio
async def test_child_token_propagates_from_parent():
    parent = CancellationToken()
    child = parent.child_token()
    assert child.is_cancelled is False
    parent.cancel()
    await asyncio.sleep(0.05)
    assert child.is_cancelled is True

def test_child_token_inherits_already_cancelled_parent():
    parent = CancellationToken()
    parent.cancel()
    child = parent.child_token()
    assert child.is_cancelled is True

@pytest.mark.asyncio
async def test_cancel_when_either_second_triggers():
    a, b = CancellationToken(), CancellationToken()
    combined = cancel_when_either(a, b)
    assert combined.is_cancelled is False
    b.cancel()
    await asyncio.sleep(0.05)
    assert combined.is_cancelled is True

def test_cancel_when_either_pre_cancelled_short_circuit():
    a, b = CancellationToken(), CancellationToken()
    b.cancel()
    combined = cancel_when_either(a, b)
    assert combined.is_cancelled is True


# ---------- ExecExpiration ----------

def test_expiration_timeout_ms_variants():
    assert ExecExpiration.timeout(5000).timeout_only_ms() == 5000
    assert ExecExpiration.default_timeout().timeout_only_ms() == DEFAULT_EXEC_COMMAND_TIMEOUT_MS
    assert ExecExpiration.from_cancellation(CancellationToken()).timeout_only_ms() is None
    assert (
        ExecExpiration.timeout_or_cancellation(1234, CancellationToken()).timeout_only_ms() == 1234
    )

def test_with_cancellation_timeout_becomes_composite():
    e = ExecExpiration.timeout(3000).with_cancellation(CancellationToken())
    assert e.kind == "timeout_or_cancellation" and e.timeout_ms == 3000

def test_with_cancellation_default_becomes_composite():
    e = ExecExpiration.default_timeout().with_cancellation(CancellationToken())
    assert e.kind == "timeout_or_cancellation"
    assert e.timeout_ms == DEFAULT_EXEC_COMMAND_TIMEOUT_MS

@pytest.mark.asyncio
async def test_wait_with_outcome_timeout():
    outcome = await asyncio.wait_for(ExecExpiration.timeout(50).wait_with_outcome(), timeout=2)
    assert outcome is ExecExpirationOutcome.TIMED_OUT

@pytest.mark.asyncio
async def test_wait_with_outcome_cancelled_bias():
    tok = CancellationToken()
    e = ExecExpiration.timeout_or_cancellation(60_000, tok)

    async def _cancel_soon():
        await asyncio.sleep(0.02)
        tok.cancel()

    asyncio.ensure_future(_cancel_soon())
    outcome = await asyncio.wait_for(e.wait_with_outcome(), timeout=2)
    assert outcome is ExecExpirationOutcome.CANCELLED

@pytest.mark.asyncio
async def test_default_timeout_wait_times_out():
    outcome = await asyncio.wait_for(
        ExecExpiration(kind="default_timeout", timeout_ms=30).wait_with_outcome(), timeout=2
    )
    assert outcome is ExecExpirationOutcome.TIMED_OUT


# ---------- ExecParams ----------

def test_exec_params_defaults():
    p = ExecParams(command=["bash", "-c", "ls"], cwd="/tmp")
    assert p.capture_policy is ExecCapturePolicy.SHELL_TOOL
    assert p.expiration.kind == "default_timeout"
    assert p.env == {} and p.network is None and p.justification is None


# ---------- append_capped / aggregate_output ----------

def test_append_capped_respects_limit():
    dst = bytearray(b"abc")
    append_capped(dst, b"defghi", 5)
    assert bytes(dst) == b"abcde"

def test_append_capped_full_dst_noop():
    dst = bytearray(b"abcdef")
    append_capped(dst, b"xyz", 6)
    assert bytes(dst) == b"abcdef"

def test_aggregate_no_cap_concatenates():
    out = aggregate_output(StreamOutput(b"out"), StreamOutput(b"err"), None)
    assert out.text == b"outerr" and out.truncated_after_lines is None

def test_aggregate_within_cap_concatenates():
    out = aggregate_output(StreamOutput(b"out"), StreamOutput(b"err"), 100)
    assert out.text == b"outerr"

def test_aggregate_over_cap_rebalance():
    stdout = StreamOutput(b"A" * 900)
    stderr = StreamOutput(b"B" * 900)
    out = aggregate_output(stdout, stderr, 1024)
    # stdout 预算 = 1024//3 = 341;stderr 配额 = 1024-341 = 683(未用满,剩余 0)
    assert len(out.text) == 1024
    assert out.text[:341] == b"A" * 341
    assert out.text[341:] == b"B" * 683

def test_aggregate_over_cap_stderr_short_rebalances_to_stdout():
    stdout = StreamOutput(b"A" * 900)
    stderr = StreamOutput(b"B" * 10)
    out = aggregate_output(stdout, stderr, 1024)
    # stdout 预算 341 + stderr 10 用 351;剩余 673 再平衡给 stdout,但受存量上限
    # min(673, 900-341)=559 → stdout_take=900;输出 = stdout 全量 + stderr 前缀 = 910
    assert len(out.text) == 910
    assert out.text[:900] == b"A" * 900
    assert out.text[900:] == b"B" * 10

def test_aggregate_preserves_originals():
    stdout = StreamOutput(b"A" * 900)
    stderr = StreamOutput(b"B" * 900)
    aggregate_output(stdout, stderr, 1024)
    assert len(stdout.text) == 900 and len(stderr.text) == 900
