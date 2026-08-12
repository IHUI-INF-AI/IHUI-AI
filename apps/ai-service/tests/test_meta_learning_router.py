"""meta_learning 路由测试:/api/admin/meta-learner/agent-failures 聚合端点。

覆盖(2026-08-12 立):
- agent_error 事件按 error_type 聚合
- 工具失败(status=error:*)与成功(status=ok)区分
- failed checkpoint 计数(元学习失败案例来源)
- 空数据返回零值结构
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.routers.meta_learning import get_agent_failures


class _FakeCP:
    def __init__(self, status: str):
        self.status = status


@pytest.mark.asyncio
async def test_agent_failures_aggregates(monkeypatch):
    """agent_error 分类聚合 + 工具失败过滤 + failed checkpoint 计数。"""
    fake_audit = MagicMock()
    fake_audit.get_recent.side_effect = [
        # action="agent_error"
        [
            {
                "action": "agent_error",
                "details": {"error_type": "timeout", "error": "LLM 超时"},
                "timestamp": "t1",
            },
            {
                "action": "agent_error",
                "details": {"error_type": "http_5xx", "error": "503"},
                "timestamp": "t2",
            },
        ],
        # action="tool_execution"
        [
            {
                "action": "tool_execution",
                "details": {"status": "error:connection", "tool_name": "web"},
                "timestamp": "t3",
            },
            {
                "action": "tool_execution",
                "details": {"status": "ok", "tool_name": "calc"},
                "timestamp": "t4",
            },
        ],
    ]
    monkeypatch.setattr(
        "app.services.audit_service.audit_service", fake_audit
    )

    class _FakeManager:
        async def list_checkpoints(self):
            return [
                _FakeCP("failed"),
                _FakeCP("failed"),
                _FakeCP("completed"),
            ]

    monkeypatch.setattr(
        "app.services.agent_checkpoint.get_agent_checkpoint_manager",
        lambda: _FakeManager(),
    )

    result = await get_agent_failures(limit=10)

    assert result["agentErrors"]["total"] == 2
    assert result["agentErrors"]["byType"] == {
        "timeout": 1,
        "http_5xx": 1,
    }
    assert result["toolFailures"]["total"] == 1  # 只有 error:connection,ok 被过滤
    assert result["toolFailures"]["byType"] == {"connection": 1}
    assert result["failedCheckpoints"] == 2  # completed 不计数
    assert len(result["recent"]) == 2
    assert result["recent"][0]["kind"] == "agent_error"


@pytest.mark.asyncio
async def test_agent_failures_empty_data(monkeypatch):
    """空数据返回零值结构,不报错。"""
    fake_audit = MagicMock()
    fake_audit.get_recent.return_value = []
    monkeypatch.setattr(
        "app.services.audit_service.audit_service", fake_audit
    )

    class _EmptyManager:
        async def list_checkpoints(self):
            return []

    monkeypatch.setattr(
        "app.services.agent_checkpoint.get_agent_checkpoint_manager",
        lambda: _EmptyManager(),
    )

    result = await get_agent_failures()

    assert result["agentErrors"]["total"] == 0
    assert result["agentErrors"]["byType"] == {}
    assert result["toolFailures"]["total"] == 0
    assert result["failedCheckpoints"] == 0
    assert result["recent"] == []
