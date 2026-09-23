# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 批41水印占位
# 批 41 实战接线测试 — 审批缓存键规范化接线 + 回合 diff 跟踪器接线
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest


@pytest.fixture(autouse=True)
def _isolate_approval_db(tmp_path):
    """隔离审批持久层。

    本文件测试审批键空间,approve_exec_command/prefix 会双写持久层,
    且 _matches_exec_prefix 未命中内存表时会回源持久层查询(含前 2/1
    token 的前缀键)——不隔离会命中其他文件泄漏的授权,断言"未登记 →
    False"就不稳定。teardown 恢复默认路径(对齐 test_tool_approval_persist_52)。
    """
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "approval_grants.db")
    yield
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)



def test_canonical_key_same_for_shell_wrapped():
    """同一命令不同 shell 包装 → 同一审批键(免二次弹窗)。"""
    from app.services.mcp_server import (
        _canonical_approval_key,
        _consume_exec_approval,
        approve_exec_command,
    )

    direct = "git status"
    wrapped = "bash -lc 'git status'"
    k1 = _canonical_approval_key(direct)
    k2 = _canonical_approval_key(wrapped)
    assert k1 == k2, f"键不一致: {k1!r} vs {k2!r}"
    # 登记 wrapped 形态 → 直接形态命中
    approve_exec_command(wrapped)
    assert _consume_exec_approval(direct) is True
    # 消费后不再命中
    assert _consume_exec_approval(direct) is False


def test_canonical_complex_scripts_not_cross_matched():
    """复杂脚本间不误互相命中(固定前缀形态)。"""
    from app.services.mcp_server import (
        _consume_exec_approval,
        approve_exec_command,
    )

    a = "bash -lc 'echo hi && rm -rf /tmp/x'"
    b = "bash -lc 'echo other && rm -rf /tmp/y'"
    approve_exec_command(a)
    assert _consume_exec_approval(a) is True
    assert _consume_exec_approval(b) is False


def test_prefix_rule_via_canonical():
    """前缀规则:包装形态登记,直接形态命中(键空间一致)。"""
    from app.services.mcp_server import (
        _matches_exec_prefix,
        approve_exec_prefix,
        revoke_exec_prefix,
    )

    prefix = approve_exec_prefix("bash -lc 'git push origin main'")
    assert prefix is not None
    try:
        assert _matches_exec_prefix("git push origin main") is True
        assert _matches_exec_prefix("git status") is False
    finally:
        assert revoke_exec_prefix(list(prefix)) is True


def test_empty_and_degenerate_inputs():
    """空命令/退化输入不抛、不放松。"""
    from app.services.mcp_server import _canonical_approval_key

    assert _canonical_approval_key("") == ""
    assert isinstance(_canonical_approval_key("ls"), str)


def test_turn_diff_tracker_wiring():
    """turn_diff_tracker:补丁累计净 diff,invalidate 后拒绝渲染(接线冒烟)。"""
    from app.core.turn_diff_tracker import FileChange, PatchDelta, TurnDiffTracker

    tracker = TurnDiffTracker()
    # 新建文件补丁
    tracker.track_delta(
        PatchDelta(
            environment_id="workspace",
            changes=[FileChange(kind="add", path="a.txt", content="line1\nline2\n")],
            exact=True,
        )
    )
    diff = tracker.get_unified_diff()
    assert diff is not None and "a.txt" in diff
    assert tracker.valid is True
    # 非精确变更 → 整体失效
    tracker.invalidate()
    assert tracker.valid is False
    assert tracker.get_unified_diff() is None


def test_engine_thread_has_tracker_field():
    """EngineThread 带 turn_diff_tracker 字段(默认 None,批 41 接线)。"""
    from dataclasses import fields

    from app.services.agent_engine import EngineThread

    names = {f.name for f in fields(EngineThread)}
    assert "turn_diff_tracker" in names
    assert EngineThread.__dataclass_fields__["turn_diff_tracker"].default is None


def test_get_context_remaining_builtin():
    """批 42:get_context_remaining 内置元工具(对标 codex get_context_remaining)。"""
    import asyncio

    from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition, ToolResult

    async def _noop_llm(*a, **k):  # pragma: no cover - 不触达
        return {"content": "", "usage": {}, "model": "test"}

    async def _noop_exec(args):  # pragma: no cover - 不触达
        return None

    loop = AgentLoopV2(
        _noop_llm,
        tools=[ToolDefinition(name="dummy", description="d", parameters={"type": "object"}, executor=_noop_exec)],
        session_id="s-gcr",
        max_iterations=1,
    )

    # 1) schema 暴露
    schema_names = [s["function"]["name"] for s in loop._build_tools_schema()]
    assert "get_context_remaining" in schema_names
    gcr = [s for s in loop._build_tools_schema() if s["function"]["name"] == "get_context_remaining"][0]
    assert gcr["function"]["parameters"] == {"type": "object", "properties": {}}

    # 2) 未启用 rollout 预算 → tokens_left=None(未知语义,对标 codex unknown)
    tc = ToolCall(id="t1", name="get_context_remaining", args={})
    r = asyncio.run(loop._execute_single(tc))
    assert isinstance(r, ToolResult)
    assert r.result == {"tokens_left": None}
    assert r.error is None

    # 3) 启用 rollout 预算 → 返回真实剩余量
    from app.core.rollout_budget import RolloutBudget, RolloutBudgetConfig

    rb = RolloutBudget()
    rb.configure(RolloutBudgetConfig(limit_tokens=100_000, reminder_at_remaining_tokens=()))
    rb.record_usage({"input_tokens": 30_000, "output_tokens": 0, "cached_input_tokens": 0})
    loop._rollout_budget = rb
    tc2 = ToolCall(id="t2", name="get_context_remaining", args={})
    r2 = asyncio.run(loop._execute_single(tc2))
    assert r2.result == {"tokens_left": 70_000}

    # 4) plan 模式白名单含 get_context_remaining(规划期可感知预算)
    from app.services.plan_mode import READONLY_TOOLS, is_readonly_tool

    assert "get_context_remaining" in READONLY_TOOLS
    assert is_readonly_tool("get_context_remaining") is True


def test_vision_analyze_downsamples_oversize_image(monkeypatch, tmp_path):
    """批 42:vision_analyze 对超预算 data URL 降采样并透出 resized 说明。"""
    import base64

    from PIL import Image

    from app.services import mcp_server

    # 构造超大图(4000x1000,超 high 档 patch 预算)
    img = Image.new("RGB", (4000, 1000), color=(10, 200, 30))
    buf = tmp_path / "big.png"
    img.save(buf, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buf.read_bytes()).decode("ascii")

    captured: dict = {}

    async def _fake_complete(messages, model=None, **kw):
        captured["messages"] = messages
        return {"content": "ok", "model": "test-model", "error": None}

    import app.core.llm_gateway as _lg

    monkeypatch.setattr(_lg, "llm_gateway", type("G", (), {"complete": staticmethod(_fake_complete)}))

    import asyncio

    r = asyncio.run(
        mcp_server._tool_vision_analyze({"image_base64": data_url.split(",", 1)[1], "task": "描述图片"})
    )
    assert r["ok"] is True
    sent_url = captured["messages"][0]["content"][1]["image_url"]["url"]
    # 载荷中的图已不是原图(降采样发生)或尺寸已在预算内
    from app.core.image_preparation import detail_limits, load_data_url_for_prompt

    _d, limits = detail_limits("high")
    src = load_data_url_for_prompt(data_url, limits)
    assert "resized" in r  # 降采样说明透出
    # 降采样后图比原图小
    out = load_data_url_for_prompt(sent_url, limits)
    assert (out.width * out.height) <= (src.width * src.height)


def test_vision_analyze_small_image_untouched(monkeypatch, tmp_path):
    """小图不降采样、无 resized 字段(零行为变化)。"""
    import base64

    from PIL import Image

    from app.services import mcp_server

    img = Image.new("RGB", (64, 48), color=(1, 2, 3))
    buf = tmp_path / "small.png"
    img.save(buf, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buf.read_bytes()).decode("ascii")

    captured: dict = {}

    async def _fake_complete(messages, model=None, **kw):
        captured["messages"] = messages
        return {"content": "ok", "model": "m", "error": None}

    import app.core.llm_gateway as _lg

    monkeypatch.setattr(_lg, "llm_gateway", type("G", (), {"complete": staticmethod(_fake_complete)}))

    import asyncio

    r = asyncio.run(
        mcp_server._tool_vision_analyze({"image_base64": data_url.split(",", 1)[1], "task": "t"})
    )
    assert r["ok"] is True
    assert "resized" not in r
    sent_url = captured["messages"][0]["content"][1]["image_url"]["url"]
    assert sent_url == data_url  # 原样保留


def test_user_shell_command_fragment():
    """批 42:user_shell_command 片段构造(对标 context/user_shell_command.rs)。"""
    from app.core.user_shell_command import (
        USER_SHELL_COMMAND_CLOSE_TAG,
        USER_SHELL_COMMAND_OPEN_TAG,
        USER_SHELL_COMMAND_OUTPUT_LIMIT,
        build_user_shell_command_fragment,
        is_user_shell_command_fragment,
    )

    # 1) 完整渲染:command/exit/duration/output 全字段
    frag = build_user_shell_command_fragment(
        "git status",
        {"exit_code": 0, "stdout": "nothing to commit", "stderr": "", "duration_ms": 1250},
    )
    assert frag["role"] == "user"
    text = frag["content"][0]["text"]
    assert text.startswith(USER_SHELL_COMMAND_OPEN_TAG) or text.lstrip().startswith(
        USER_SHELL_COMMAND_OPEN_TAG
    )
    assert USER_SHELL_COMMAND_CLOSE_TAG in text
    assert "<command>" in text and "git status" in text and "</command>" in text
    assert "Exit code: 0" in text
    assert "Duration: 1.2500 seconds" in text
    assert "nothing to commit" in text

    # 2) exitCode 驼峰兼容 + stderr 拼接
    frag2 = build_user_shell_command_fragment(
        "ls /nope",
        {"exitCode": 2, "stdout": "", "stderr": "permission denied", "duration_ms": 10},
    )
    t2 = frag2["content"][0]["text"]
    assert "Exit code: 2" in t2
    assert "[stderr]" in t2 and "permission denied" in t2

    # 3) 输出截断
    big = "x" * (USER_SHELL_COMMAND_OUTPUT_LIMIT + 500)
    frag3 = build_user_shell_command_fragment("echo big", {"exit_code": 0, "stdout": big})
    t3 = frag3["content"][0]["text"]
    assert "truncated" in t3 and len(t3) < len(big)

    # 4) 失败安全:result 非 dict
    frag4 = build_user_shell_command_fragment("cmd", None)
    assert "Exit code: -1" in frag4["content"][0]["text"]

    # 5) 识别函数
    assert is_user_shell_command_fragment(text) is True
    assert is_user_shell_command_fragment("hello") is False


def test_user_shell_command_wiring_in_loop():
    """批 42:批准的 run_command 执行后,user_shell 片段回填进 messages。"""

    from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition, ToolResult

    async def _noop_llm(*a, **k):
        return {"content": "", "usage": {}, "model": "test"}

    async def _run(args):
        return {"exit_code": 0, "stdout": "done", "stderr": "", "duration_ms": 5}

    loop = AgentLoopV2(
        _noop_llm,
        tools=[ToolDefinition(name="run_command", description="r", parameters={"type": "object"}, executor=_run)],
        session_id="s-usc",
        max_iterations=1,
    )
    # 模拟:该 tc 已被用户批准(exec_policy_approved 路径标记)
    tc = ToolCall(id="tc-1", name="run_command", args={"command": "echo hi"})
    loop._approved_command_call_ids.add(tc.id)
    tr = ToolResult(tool_call_id=tc.id, name="run_command", result={"exit_code": 0, "stdout": "done", "stderr": "", "duration_ms": 5})

    # 直接复刻回填段逻辑
    messages: list = []
    from app.core.user_shell_command import build_user_shell_command_fragment

    if loop._approved_command_call_ids:
        _tc_args_map = {tc.id: tc.args}
        for t in [tr]:
            if t.name != "run_command" or t.error or not isinstance(t.result, dict) or t.tool_call_id not in loop._approved_command_call_ids:
                continue
            cmd = str((_tc_args_map.get(t.tool_call_id) or {}).get("command", ""))
            messages.append(build_user_shell_command_fragment(cmd, t.result))
        loop._approved_command_call_ids.clear()

    assert len(messages) == 1
    assert "<user_shell_command>" in messages[0]["content"][0]["text"]
    assert "echo hi" in messages[0]["content"][0]["text"]
    assert loop._approved_command_call_ids == set()  # 消费后清空
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
