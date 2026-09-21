# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D24 工具调用与终端输出独立持久化 —— llm.py 持久化构造函数单元测试。

测试覆盖(app.routers.llm,2026-09-19 立):
- _extract_terminal_output:output 直取 / stdout+stderr 拼接 / exit_code 与
  exitCode 兼容 / 非 dict 输入 / 非 int 退出码
- _build_terminal_task:completed/failed 状态 / output 超 8000 截断 /
  exitCode 与 output 缺省省略 / startedAt(UTC iso)/endedAt/durationMs
- _truncate_persist_value:限内原样返回(保持结构) / 超限退化为截断文本 /
  不可序列化对象限内返回原对象、超限按 str() 截断
- _build_persisted_tool_calls:status 三态推导(无 result → running /
  isError → error / 其余 → success) / 展示与审计字段透传 / args(2000) 与
  result(8000) 体积护栏 / 无效记录(id 与 toolName 均空)跳过
- _fire_callback:tool_calls_history / terminal_tasks_history 非空时附加到
  回调 body 的 toolCalls / terminalTasks;空历史(含构造后为空)不写字段,
  与"无工具调用"语义区分
"""

from __future__ import annotations

import pytest

from app.routers.llm import (
    _TOOL_ARGS_PERSIST_LIMIT,
    _TOOL_RESULT_PERSIST_LIMIT,
    _build_persisted_tool_calls,
    _build_terminal_task,
    _extract_terminal_output,
    _fire_callback,
    _truncate_persist_value,
)

# =============================================================================
# _extract_terminal_output
# =============================================================================


def test_extract_output_direct_output_key():
    """exec_result.output 为非空字符串时直接采用。"""
    out, ec = _extract_terminal_output({"output": "hello", "exit_code": 0})
    assert out == "hello"
    assert ec == 0


def test_extract_output_stdout_stderr_join():
    """无 output 时取 stdout + stderr 非空拼接(换行分隔),exitCode 驼峰兼容。"""
    out, ec = _extract_terminal_output({"stdout": "a", "stderr": "b", "exitCode": 2})
    assert out == "a\nb"
    assert ec == 2


def test_extract_output_empty_strings_fall_through():
    """stdout/stderr 均为空字符串时输出为空。"""
    out, ec = _extract_terminal_output({"stdout": "", "stderr": ""})
    assert out == ""
    assert ec is None


def test_extract_output_empty_dict():
    assert _extract_terminal_output({}) == ("", None)


def test_extract_output_non_dict():
    """非 dict 输入一律返回空(容错,不抛异常)。"""
    assert _extract_terminal_output(None) == ("", None)
    assert _extract_terminal_output("text") == ("", None)
    assert _extract_terminal_output(123) == ("", None)


def test_extract_output_non_int_exit_code_ignored():
    """exit_code 非 int(如字符串 "0")时忽略,不误传给 TerminalTask.exitCode。"""
    assert _extract_terminal_output({"output": "x", "exit_code": "0"})[1] is None


# =============================================================================
# _build_terminal_task
# =============================================================================


class TestBuildTerminalTask:
    def test_completed_with_output_and_exit_code(self):
        rec = _build_terminal_task("term-1", {"output": "done", "exit_code": 0}, True, 1000.0, "ls")
        assert rec["id"] == "term-1"
        assert rec["command"] == "ls"
        assert rec["status"] == "completed"
        assert rec["output"] == "done"
        assert rec["exitCode"] == 0
        # started_ts=1000.0 → 1970-01-01 UTC isoformat
        assert rec["startedAt"] == "1970-01-01T00:16:40+00:00"
        assert rec["endedAt"]
        assert isinstance(rec["durationMs"], int)

    def test_failed_without_output_omits_optional_keys(self):
        rec = _build_terminal_task("t2", {}, False, 1000.0, "")
        assert rec["status"] == "failed"
        assert "output" not in rec
        assert "exitCode" not in rec
        assert rec["command"] == ""

    def test_output_truncated_to_8000(self):
        rec = _build_terminal_task("t3", {"output": "x" * 9000}, True, 1000.0, "cmd")
        assert len(rec["output"]) == 8000

    def test_none_command_becomes_empty_string(self):
        rec = _build_terminal_task("t4", {"output": "o"}, True, 1000.0, None)
        assert rec["command"] == ""


# =============================================================================
# _truncate_persist_value
# =============================================================================


class TestTruncatePersistValue:
    def test_within_limit_returns_same_object(self):
        """限内原样返回(同一对象,保持 dict 结构供前端按结构渲染)。"""
        v = {"a": 1}
        assert _truncate_persist_value(v, 1000) is v

    def test_over_limit_returns_truncated_text(self):
        v = {"k": "x" * 300}
        out = _truncate_persist_value(v, 100)
        assert isinstance(out, str)
        # 序列化超限 → 保留前 limit 字符 + 明确标注
        assert out.startswith('{"k": "x')
        assert len(out.split("...[truncated ")[0]) == 100
        assert out.endswith(" chars]")

    def test_unserializable_within_limit_returns_original(self):
        """不可序列化对象在限内返回原对象(仅超限时才退化文本)。

        object() 的 str() 长度约 27 字符,limit 给 100 确保在限内。
        """
        obj = object()
        assert _truncate_persist_value(obj, 100) is obj

    def test_unserializable_over_limit_uses_str(self):
        class Big:
            def __str__(self) -> str:
                return "B" * 50

        assert _truncate_persist_value(Big(), 10) == "B" * 10 + "...[truncated 40 chars]"

    def test_exact_limit_keeps_value(self):
        """序列化后恰好等于 limit 不截断(边界:<= 判定,注意引号占 2 字符)。"""
        v = "x" * 8  # json.dumps 后为带引号的 10 字符
        assert _truncate_persist_value(v, 10) == v


# =============================================================================
# _build_persisted_tool_calls
# =============================================================================


def _rec(**kw):
    base: dict = {"toolCallId": "tc-1", "toolName": "run_command"}
    base.update(kw)
    return base


class TestBuildPersistedToolCalls:
    def test_empty_history(self):
        assert _build_persisted_tool_calls([]) == []

    def test_success_with_args_result_and_fields(self):
        out = _build_persisted_tool_calls(
            [_rec(args={"command": "ls"}, result="a.txt", iteration=1, durationMs=123.7)]
        )
        assert len(out) == 1
        it = out[0]
        assert it["id"] == "tc-1"
        assert it["toolName"] == "run_command"
        assert it["status"] == "success"
        assert "isError" not in it
        assert it["args"] == {"command": "ls"}
        assert it["result"] == "a.txt"
        assert it["iteration"] == 1
        assert it["durationMs"] == 123  # float → int

    def test_running_when_no_result(self):
        out = _build_persisted_tool_calls([_rec(args={"command": "ls"})])
        assert out[0]["status"] == "running"
        assert "result" not in out[0]

    def test_error_status_and_flag(self):
        out = _build_persisted_tool_calls([_rec(result="boom", isError=True)])
        it = out[0]
        assert it["status"] == "error"
        assert it["isError"] is True

    def test_skips_invalid_records(self):
        """非 dict / id 与 toolName 均空的记录跳过。"""
        out = _build_persisted_tool_calls(["not-dict", {}, {"toolCallId": "", "toolName": ""}])
        assert out == []

    def test_args_over_limit_truncated(self):
        out = _build_persisted_tool_calls([_rec(args={"cmd": "x" * 5000}, result="ok")])
        a = out[0]["args"]
        assert isinstance(a, str)
        assert a.startswith('{"cmd": "x')
        assert "[truncated" in a

    def test_result_over_limit_truncated(self):
        out = _build_persisted_tool_calls([_rec(result="y" * 20000)])
        r = out[0]["result"]
        assert isinstance(r, str)
        # json.dumps 后带双引号(20002 字符),截断文本以引号开头
        assert r.startswith('"yyy')
        assert f"...[truncated {20002 - _TOOL_RESULT_PERSIST_LIMIT} chars]" in r

    def test_optional_fields_passthrough(self):
        out = _build_persisted_tool_calls(
            [
                _rec(
                    serverSource="mcp",
                    serverId="s1",
                    serverName="n1",
                    repeated=2,
                    startedAt="t0",
                    endedAt="t1",
                    durationMs=-5,  # 负值丢弃
                )
            ]
        )
        it = out[0]
        assert it["serverSource"] == "mcp"
        assert it["serverId"] == "s1"
        assert it["serverName"] == "n1"
        assert it["repeated"] == 2
        assert it["startedAt"] == "t0"
        assert it["endedAt"] == "t1"
        assert "durationMs" not in it

    def test_empty_args_dict_dropped(self):
        out = _build_persisted_tool_calls([_rec(args={})])
        assert "args" not in out[0]

    def test_falsy_optional_fields_dropped(self):
        """iteration=0 / 空字符串字段不透传(与实现 `v != ""` 且 `is not None` 一致)。"""
        out = _build_persisted_tool_calls([_rec(iteration=0, serverName="")])
        it = out[0]
        # 0 满足 `v is not None and v != ""` → 透传(与 BaseToolCall.iteration?: number 语义相容)
        assert it["iteration"] == 0
        assert "serverName" not in it


# =============================================================================
# _fire_callback body 附加(D24 持久化通道)
# =============================================================================


class _FakeResp:
    def __init__(self) -> None:
        self.status_code = 200
        self.text = ""


class _FakeClient:
    """捕获 post 的 json body;按测试用例重置 captured。"""

    captured: list[dict] = []

    def __init__(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *args) -> None:
        return None

    async def post(self, url, json=None, headers=None):  # noqa: ANN001
        _FakeClient.captured.append(json)
        return _FakeResp()


@pytest.fixture(autouse=True)
def _cb_env(monkeypatch):
    """配置回调密钥 + 替换 httpx.AsyncClient,隔离真实网络。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-secret")
    monkeypatch.setattr("app.routers.llm.httpx.AsyncClient", _FakeClient)
    _FakeClient.captured = []


class TestFireCallbackPersistArrays:
    async def test_appends_tool_calls_and_terminal_tasks(self):
        await _fire_callback(
            "http://cb",
            {"content": "hi", "model": "m1", "usage": {"total_tokens": 5}, "stub": False},
            {"conversationId": "c1", "userId": "u1", "messageId": "msg-1"},
            tool_calls_history=[
                {"toolCallId": "tc-1", "toolName": "run_command", "args": {"command": "ls"}, "result": "a"}
            ],
            terminal_tasks_history=[{"id": "t1", "command": "ls", "status": "completed"}],
        )
        body = _FakeClient.captured[0]
        assert body["toolCalls"][0]["id"] == "tc-1"
        assert body["toolCalls"][0]["status"] == "success"
        assert body["terminalTasks"][0]["id"] == "t1"
        # 基础字段不受影响
        assert body["content"] == "hi"
        assert body["metadata"]["conversationId"] == "c1"

    async def test_no_history_omits_fields(self):
        """不传历史(非流式端点路径)不写 toolCalls/terminalTasks,向后兼容。"""
        await _fire_callback("http://cb", {"content": "hi"}, {"conversationId": "c1"})
        body = _FakeClient.captured[0]
        assert "toolCalls" not in body
        assert "terminalTasks" not in body

    async def test_empty_or_invalid_history_omits_fields(self):
        """空数组与全无效记录(构造后为空)都不写字段,与"无工具调用"语义一致。"""
        await _fire_callback(
            "http://cb",
            {"content": "hi"},
            None,
            tool_calls_history=["", None, {}],
            terminal_tasks_history=[],
        )
        body = _FakeClient.captured[0]
        assert "toolCalls" not in body
        assert "terminalTasks" not in body
        assert body["metadata"] == {}

    async def test_invalid_record_mixed_with_valid(self):
        """混合无效记录时只保留有效条目。"""
        await _fire_callback(
            "http://cb",
            {"content": "hi"},
            None,
            tool_calls_history=[
                {"toolName": "", "toolCallId": ""},
                {"toolCallId": "tc-2", "toolName": "read_file", "result": "ok"},
            ],
        )
        body = _FakeClient.captured[0]
        assert [c["id"] for c in body["toolCalls"]] == ["tc-2"]
        assert body["toolCalls"][0]["status"] == "success"
        # _TOOL_ARGS_PERSIST_LIMIT 常量健全性(防止常量被误删/改小)
        assert _TOOL_ARGS_PERSIST_LIMIT == 2000
        assert _TOOL_RESULT_PERSIST_LIMIT == 8000
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
