"""audit_service.py 单元测试(2026-07-23)。

覆盖:
- AuditEntry 构造 + to_dict 序列化(默认时间戳 / 显式时间戳保留)
- log_agent_action / log_llm_call / log_tool_execution 写入路径
- log_tool_execution result 截断(500 字符)+ duration 取整 2 位
- log_llm_call latency 取整 2 位 + stub 字段 + agent_id 固定 llm_gateway
- get_recent 查询(默认最新在前 / agent_id+action 过滤 / limit / 空缓冲)
- extract_trace_id(W3C traceparent 解析,含 None/空/畸形)
- 缓冲区超限丢弃最旧 10%(monkeypatch 调小 _max_buffer)
- 模块级单例 audit_service

隔离:AuditService._buffer 为类级共享列表,autouse fixture 每个测试前后清空。
本模块当前仅内存缓冲(生产 DB 路径未启用),无需连真实 DB。
"""
from __future__ import annotations

import pytest

from app.services.audit_service import AuditEntry, AuditService, audit_service


@pytest.fixture(autouse=True)
def _clear_audit_buffer():
    """AuditService._buffer 是类级共享列表,每个测试前后清空避免跨测试污染。"""
    AuditService._buffer.clear()
    yield
    AuditService._buffer.clear()


# =============================================================================
# AuditEntry
# =============================================================================


def test_audit_entry_default_timestamp():
    """AuditEntry 默认生成 ISO8601 UTC 时间戳,to_dict 含全部 6 字段。"""
    e = AuditEntry(action="act", details={"k": 1}, trace_id="t1", agent_id="a1", user_id="u1")
    assert e.action == "act"
    assert e.details == {"k": 1}
    assert e.trace_id == "t1"
    assert e.agent_id == "a1"
    assert e.user_id == "u1"
    assert isinstance(e.timestamp, str) and e.timestamp != ""
    d = e.to_dict()
    assert d == {
        "action": "act",
        "details": {"k": 1},
        "trace_id": "t1",
        "agent_id": "a1",
        "user_id": "u1",
        "timestamp": e.timestamp,
    }


def test_audit_entry_custom_timestamp_preserved():
    """显式传入 timestamp 时原样保留(不被 now() 覆盖)。"""
    custom = "2026-01-01T00:00:00+00:00"
    e = AuditEntry(action="act", details={}, timestamp=custom)
    assert e.timestamp == custom


# =============================================================================
# log_agent_action / log_llm_call / log_tool_execution
# =============================================================================


def test_log_agent_action_appends_entry():
    """log_agent_action 写入 entry,action/agent/trace/user/details 全部落地。"""
    s = AuditService()
    s.log_agent_action(
        agent_id="agent-1", action="tool_call",
        details={"tool": "grep"}, trace_id="t1", user_id="u1",
    )
    rec = s.get_recent(limit=1)[0]
    assert rec["action"] == "tool_call"
    assert rec["agent_id"] == "agent-1"
    assert rec["trace_id"] == "t1"
    assert rec["user_id"] == "u1"
    assert rec["details"] == {"tool": "grep"}


def test_log_llm_call_builds_correct_details():
    """log_llm_call:latency 取整 2 位,agent_id 固定 llm_gateway,action=llm_call。"""
    s = AuditService()
    s.log_llm_call(
        model="gpt-4", prompt_tokens=100, completion_tokens=50,
        latency_ms=123.456, stub=True, trace_id="t1",
    )
    rec = s.get_recent(limit=1)[0]
    assert rec["action"] == "llm_call"
    assert rec["agent_id"] == "llm_gateway"
    assert rec["trace_id"] == "t1"
    det = rec["details"]
    assert det["model"] == "gpt-4"
    assert det["prompt_tokens"] == 100
    assert det["completion_tokens"] == 50
    assert abs(det["latency_ms"] - 123.46) < 0.01  # round(123.456, 2)
    assert det["stub"] is True


def test_log_tool_execution_truncates_long_result():
    """log_tool_execution:result str 截断到 500 字符,duration 取整 2 位。"""
    s = AuditService()
    long_result = "x" * 1000
    s.log_tool_execution(
        tool_name="bash", args={"cmd": "ls"}, result=long_result,
        status="ok", duration_ms=12.3456, trace_id="t9",
    )
    rec = s.get_recent(limit=1)[0]
    assert rec["action"] == "tool_execution"
    assert rec["agent_id"] == "tool_executor"
    det = rec["details"]
    assert det["tool_name"] == "bash"
    assert det["args"] == {"cmd": "ls"}
    assert det["status"] == "ok"
    assert abs(det["duration_ms"] - 12.35) < 0.01  # round(12.3456, 2)
    assert len(det["result"]) == 500
    assert det["result"] == "x" * 500


def test_log_tool_execution_short_result_not_truncated():
    """短 result 不截断,原样 str() 转换。"""
    s = AuditService()
    s.log_tool_execution(
        tool_name="t", args={}, result={"key": "val"}, status="ok", duration_ms=1.0,
    )
    rec = s.get_recent(limit=1)[0]
    assert rec["details"]["result"] == str({"key": "val"})


# =============================================================================
# get_recent
# =============================================================================


def test_get_recent_returns_newest_first():
    """get_recent 默认按最新在前返回,默认 limit=100。"""
    s = AuditService()
    s.log_agent_action(agent_id="a", action="act1", details={"i": 1})
    s.log_agent_action(agent_id="a", action="act2", details={"i": 2})
    rec = s.get_recent()
    assert len(rec) == 2
    assert rec[0]["details"]["i"] == 2  # newest first
    assert rec[1]["details"]["i"] == 1


def test_get_recent_filter_by_agent_and_action():
    """get_recent 支持 agent_id / action 过滤,可组合。"""
    s = AuditService()
    s.log_agent_action(agent_id="a1", action="act1", details={})
    s.log_agent_action(agent_id="a2", action="act2", details={})
    s.log_agent_action(agent_id="a1", action="act2", details={})
    assert len(s.get_recent(agent_id="a1")) == 2
    assert len(s.get_recent(action="act2")) == 2
    assert len(s.get_recent(agent_id="a1", action="act2")) == 1


def test_get_recent_limit_applied():
    """limit 截断返回条数,返回最新 limit 条。"""
    s = AuditService()
    for i in range(10):
        s.log_agent_action(agent_id="a", action="act", details={"i": i})
    rec = s.get_recent(limit=3)
    assert len(rec) == 3
    assert rec[0]["details"]["i"] == 9  # newest
    assert rec[2]["details"]["i"] == 7


def test_get_recent_empty_buffer():
    """空缓冲区返回空列表(含过滤场景)。"""
    s = AuditService()
    assert s.get_recent() == []
    assert s.get_recent(limit=5, agent_id="x", action="y") == []


# =============================================================================
# extract_trace_id
# =============================================================================


def test_extract_trace_id_valid_w3c():
    """标准 W3C traceparent 头解析出 32 hex trace_id(parts[1])。"""
    s = AuditService()
    header = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
    assert s.extract_trace_id(header) == "0af7651916cd43dd8448eb211c80319c"


def test_extract_trace_id_none_and_empty():
    """None / 空字符串返回 None。"""
    s = AuditService()
    assert s.extract_trace_id(None) is None
    assert s.extract_trace_id("") is None


def test_extract_trace_id_malformed():
    """仅 1 段返回 None;2 段返回第 2 段(不校验 hex 格式)。"""
    s = AuditService()
    assert s.extract_trace_id("abc") is None  # 1 段
    assert s.extract_trace_id("00") is None  # 1 段
    assert s.extract_trace_id("v-trace") == "trace"  # 2 段,不校验 hex


# =============================================================================
# 缓冲区超限丢弃 + 单例
# =============================================================================


def test_buffer_overflow_drops_oldest_10_percent(monkeypatch):
    """_buffer 超 _max_buffer 时丢弃最旧 10%(monkeypatch 调小阈值验证)。"""
    monkeypatch.setattr(AuditService, "_max_buffer", 10)
    s = AuditService()
    for i in range(11):
        s.log_agent_action(agent_id="a", action="act", details={"i": i})
    # 11 > 10 → drop 10//10=1 → 10 条,i=0 被丢弃
    assert len(s._buffer) == 10
    assert s._buffer[0].details["i"] == 1
    assert s._buffer[-1].details["i"] == 10


def test_singleton_instance():
    """模块级 audit_service 是 AuditService 实例,共享类级 _buffer。"""
    assert isinstance(audit_service, AuditService)
    assert audit_service._buffer is AuditService._buffer
