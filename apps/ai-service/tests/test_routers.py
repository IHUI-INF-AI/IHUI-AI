"""routers HTTP 端点测试:6 个路由模块全覆盖。

测试覆盖:
- health: GET /health
- root: GET /
- llm: POST /api/llm/complete + POST /api/llm/complete/stream
- tools: POST /api/tools/search-codebase + /search-web + /analyze-code
- mcp: GET /api/mcp/tools + POST /api/mcp/tools/call + GET /api/mcp/resources
       + GET /api/mcp/resources/{uri} + GET /api/mcp/prompts + POST /api/mcp/prompts/invoke
       + GET /api/mcp/skills + GET /api/mcp/skills/{name} + GET /api/mcp/slash-commands
       + POST /api/mcp/slash-commands
- agents: POST /api/agents/execute + GET /api/agents/running + GET /api/agents/sessions
          + GET /api/agents/sessions/{id}/messages + DELETE /api/agents/sessions/{id}
          + GET /api/agents/{task_id}/status + POST /api/agents/{task_id}/cancel
- a2a: POST /api/a2a/agents/register + GET /api/a2a/agents + POST /api/a2a/tasks
        + GET /api/a2a/tasks/{id}/status + GET /api/a2a/tasks/{id}/result
"""

from __future__ import annotations

import json

import pytest

from app.services.memory import memory_store


# =============================================================================
# 强制内存模式(避免测试环境 Redis 连接超时)
# =============================================================================


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 使用内存模式。"""
    memory_store._use_redis = False
    memory_store._redis = None
    yield
    memory_store._use_redis = False
    memory_store._redis = None


# =============================================================================
# health + root
# =============================================================================


async def test_health_endpoint(client):
    """GET /health 返回 200 + ok 状态。"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "ihui-ai-service"


async def test_root_endpoint(client):
    """GET / 返回服务基本信息。"""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "ihui-ai-service"
    assert data["version"] == "0.0.0"
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"


# =============================================================================
# llm 路由
# =============================================================================


async def test_llm_complete_endpoint(client):
    """POST /api/llm/complete 返回 LLM 响应(stub 模式)。"""
    resp = await client.post(
        "/api/llm/complete",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["stub"] is True
    assert "hello" in data["content"]
    assert "model" in data
    assert "usage" in data


async def test_llm_complete_with_model(client):
    """POST /api/llm/complete 透传 model 参数。"""
    resp = await client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "test"}],
            "model": "gpt-4",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["model"] == "gpt-4"


async def test_llm_complete_stream_endpoint(client):
    """POST /api/llm/complete/stream 返回 SSE 流(原生 token 级 + event 字段)。"""
    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "hello world"}]},
    )
    assert resp.status_code == 200
    # SSE 响应应为 text/event-stream
    assert "text/event-stream" in resp.headers.get("content-type", "")
    # 应有 Cache-Control: no-cache
    assert "no-cache" in resp.headers.get("cache-control", "")
    # 响应内容应包含 event: 和 data: 行(SSE event 字段)
    text = resp.text
    assert "event:" in text
    assert "data:" in text
    # 应包含 chunk 和 done 事件类型
    assert "event: chunk" in text
    assert "event: done" in text


async def test_llm_complete_stream_empty_messages(client):
    """POST /api/llm/complete/stream 空消息列表也能返回流(stub 模式)。"""
    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": []},
    )
    assert resp.status_code == 200


async def test_llm_complete_stream_has_x_accel_buffering_header(client):
    """POST /api/llm/complete/stream 响应包含 X-Accel-Buffering: no 头(禁用 Nginx 缓冲)。"""
    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "test"}]},
    )
    assert resp.headers.get("x-accel-buffering") == "no"


async def test_llm_complete_stream_chunk_content_concatenated(client):
    """POST /api/llm/complete/stream chunk 事件拼接后包含 stub 响应。"""
    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "你好"}]},
    )
    text = resp.text
    # stub 模式下 chunk 拼接应包含 [stub] 和用户消息
    assert "[stub]" in text
    assert "你好" in text


async def test_llm_models_endpoint(client):
    """GET /api/llm/models 返回模型列表 + 默认模型 + stub_mode 标记。"""
    resp = await client.get("/api/llm/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert "default" in data
    assert "stub_mode" in data
    assert isinstance(data["models"], list)
    assert len(data["models"]) > 0
    # stub_mode 应为 True(测试环境无 API key)
    assert data["stub_mode"] is True


async def test_llm_complete_with_metadata(client):
    """POST /api/llm/complete 透传 metadata 到响应(stub 模式)。"""
    resp = await client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "test"}],
            "metadata": {"conversationId": "conv-123", "userId": "user-456"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["stub"] is True
    assert data["metadata"]["conversationId"] == "conv-123"
    assert data["metadata"]["userId"] == "user-456"


async def test_llm_complete_with_metadata_no_association(client):
    """POST /api/llm/complete metadata 无 conversationId 时不触发回调,无报错。"""
    resp = await client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "test"}],
            "metadata": {"foo": "bar"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["metadata"] == {"foo": "bar"}


async def test_llm_complete_with_callback_url(client):
    """POST /api/llm/complete 带 callback_url 不报错(stub 模式无关联键不回调)。"""
    resp = await client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "test"}],
            "callback_url": "http://example.com/callback",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["stub"] is True


# =============================================================================
# tools 路由
# =============================================================================


async def test_tools_search_codebase_endpoint(client):
    """POST /api/tools/search-codebase 返回搜索结果。"""
    resp = await client.post(
        "/api/tools/search-codebase",
        json={"query": "test", "path": "."},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tool"] == "search_codebase"
    assert "matches" in data


async def test_tools_search_web_endpoint(client):
    """POST /api/tools/search-web 返回搜索结果。"""
    resp = await client.post(
        "/api/tools/search-web",
        json={"query": "", "max_results": 3},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tool"] == "search_web"
    assert data["results"] == []


async def test_tools_analyze_code_endpoint(client):
    """POST /api/tools/analyze-code 返回分析结果。"""
    resp = await client.post(
        "/api/tools/analyze-code",
        json={"code": "x = 1\n# comment", "language": "python"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tool"] == "analyze_code"
    assert data["metrics"]["lines"] == 2
    assert data["metrics"]["comment_lines"] == 1


# =============================================================================
# mcp 路由
# =============================================================================


async def test_mcp_list_tools_endpoint(client):
    """GET /api/mcp/tools 返回 11 个工具。"""
    resp = await client.get("/api/mcp/tools")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 11
    assert len(data["tools"]) == 11


async def test_mcp_call_tool_endpoint(client):
    """POST /api/mcp/tools/call 调用工具。"""
    resp = await client.post(
        "/api/mcp/tools/call",
        json={"name": "analyze_code", "arguments": {"code": "x = 1"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tool"] == "analyze_code"


async def test_mcp_call_tool_unknown(client):
    """POST /api/mcp/tools/call 调用未知工具返回错误。"""
    resp = await client.post(
        "/api/mcp/tools/call",
        json={"name": "nonexistent_tool", "arguments": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "error" in data or "不存在" in str(data)


async def test_mcp_list_resources_endpoint(client):
    """GET /api/mcp/resources 返回 3 个资源。"""
    resp = await client.get("/api/mcp/resources")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3
    assert len(data["resources"]) == 3


async def test_mcp_read_resource_memory_endpoint(client):
    """GET /api/mcp/resources/memory://current 读取资源。"""
    resp = await client.get("/api/mcp/resources/memory://current")
    assert resp.status_code == 200
    data = resp.json()
    assert "uri" in data or "messages" in data or "ok" in data


async def test_mcp_list_prompts_endpoint(client):
    """GET /api/mcp/prompts 返回 3 个提示词。"""
    resp = await client.get("/api/mcp/prompts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3


async def test_mcp_invoke_prompt_endpoint(client):
    """POST /api/mcp/prompts/invoke 调用提示词。"""
    resp = await client.post(
        "/api/mcp/prompts/invoke",
        json={"name": "code_review", "arguments": {"code": "print('hello')"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data or "content" in data or "code_review" in str(data)


async def test_mcp_list_skills_endpoint(client):
    """GET /api/mcp/skills 返回 6 个 skill。"""
    resp = await client.get("/api/mcp/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 6
    assert len(data["skills"]) == 6


async def test_mcp_get_skill_endpoint(client):
    """GET /api/mcp/skills/{name} 返回 skill 详情。"""
    resp = await client.get("/api/mcp/skills/code-review")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "code-review"
    assert "description" in data
    assert "prompt_template" in data


async def test_mcp_get_skill_unknown(client):
    """GET /api/mcp/skills/{name} 未知 skill 返回 404。"""
    resp = await client.get("/api/mcp/skills/nonexistent_skill")
    assert resp.status_code == 404


async def test_mcp_list_slash_commands_endpoint(client):
    """GET /api/mcp/slash-commands 返回 12 个命令。"""
    resp = await client.get("/api/mcp/slash-commands")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 12


async def test_mcp_execute_slash_command_endpoint(client):
    """POST /api/mcp/slash-commands 执行命令。"""
    resp = await client.post(
        "/api/mcp/slash-commands",
        json={"command": "version", "args": [], "ctx": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["command"] == "version"
    assert "output" in data


# =============================================================================
# agents 路由
# =============================================================================


async def test_agents_execute_endpoint(client):
    """POST /api/agents/execute 执行 agent(stub 模式)。"""
    resp = await client.post(
        "/api/agents/execute",
        json={"goal": "测试任务"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "task_id" in data
    assert "session_id" in data
    assert "result" in data
    assert "steps" in data


async def test_agents_execute_with_session_id(client):
    """POST /api/agents/execute 透传 session_id。"""
    resp = await client.post(
        "/api/agents/execute",
        json={"goal": "测试", "session_id": "test-session-123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "test-session-123"


async def test_agents_running_endpoint(client):
    """GET /api/agents/running 列出运行中任务。"""
    # 先执行一个任务
    await client.post("/api/agents/execute", json={"goal": "test"})
    resp = await client.get("/api/agents/running")
    assert resp.status_code == 200
    data = resp.json()
    assert "tasks" in data
    assert len(data["tasks"]) >= 1


async def test_agents_sessions_endpoint(client):
    """GET /api/agents/sessions 列出会话。"""
    # 先执行一个任务创建会话
    await client.post("/api/agents/execute", json={"goal": "test"})
    resp = await client.get("/api/agents/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert "sessions" in data
    assert "count" in data
    assert data["count"] >= 1


async def test_agents_session_messages_endpoint(client):
    """GET /api/agents/sessions/{id}/messages 获取会话消息。"""
    # 先执行任务创建会话
    exec_resp = await client.post(
        "/api/agents/execute",
        json={"goal": "test", "session_id": "msg-test-session"},
    )
    session_id = exec_resp.json()["session_id"]

    resp = await client.get(f"/api/agents/sessions/{session_id}/messages")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert "messages" in data
    assert data["count"] >= 1  # 至少有用户消息


async def test_agents_clear_session_endpoint(client):
    """DELETE /api/agents/sessions/{id} 清除会话。"""
    await client.post(
        "/api/agents/execute",
        json={"goal": "test", "session_id": "clear-test-session"},
    )
    resp = await client.delete("/api/agents/sessions/clear-test-session")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cleared"] is True
    assert data["session_id"] == "clear-test-session"


async def test_agents_task_status_endpoint(client):
    """GET /api/agents/{task_id}/status 查询任务状态。"""
    exec_resp = await client.post("/api/agents/execute", json={"goal": "test"})
    task_id = exec_resp.json()["task_id"]

    resp = await client.get(f"/api/agents/{task_id}/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["task_id"] == task_id
    assert "status" in data


async def test_agents_task_status_not_found(client):
    """GET /api/agents/{task_id}/status 不存在返回 404。"""
    resp = await client.get("/api/agents/nonexistent-task-id/status")
    assert resp.status_code == 404


async def test_agents_cancel_task_endpoint(client):
    """POST /api/agents/{task_id}/cancel 取消任务。"""
    exec_resp = await client.post("/api/agents/execute", json={"goal": "test"})
    task_id = exec_resp.json()["task_id"]

    resp = await client.post(f"/api/agents/{task_id}/cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["task_id"] == task_id
    assert "canceled" in data


async def test_agents_cancel_task_not_found(client):
    """POST /api/agents/{task_id}/cancel 不存在返回 404。"""
    resp = await client.post("/api/agents/nonexistent-task-id/cancel")
    assert resp.status_code == 404


async def test_agents_execute_stream_endpoint(client):
    """POST /api/agents/execute/stream 返回 SSE 流(含 event 字段 + id 字段)。"""
    resp = await client.post(
        "/api/agents/execute/stream",
        json={"goal": "测试流式任务"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    assert "no-cache" in resp.headers.get("cache-control", "")
    text = resp.text
    # SSE event 字段(取自 payload type)
    assert "event:" in text
    # SSE id 字段(用于断线重连)
    assert "id:" in text
    # start 和 done 事件
    assert "event: start" in text
    assert "event: done" in text


async def test_agents_execute_stream_has_x_accel_buffering(client):
    """POST /api/agents/execute/stream 响应包含 X-Accel-Buffering: no 头。"""
    resp = await client.post(
        "/api/agents/execute/stream",
        json={"goal": "test"},
    )
    assert resp.headers.get("x-accel-buffering") == "no"


async def test_agents_execute_stream_with_last_event_id(client):
    """POST /api/agents/execute/stream 带 Last-Event-ID 时 start 事件含 resume_from。"""
    resp = await client.post(
        "/api/agents/execute/stream",
        json={"goal": "测试重连"},
        headers={"Last-Event-ID": "task-reconnect-5"},
    )
    assert resp.status_code == 200
    text = resp.text
    # start 事件应包含 resume_from 字段
    assert "resume_from" in text
    assert "task-reconnect-5" in text


async def test_agents_execute_stream_yields_plan_events(client):
    """POST /api/agents/execute/stream stub 模式产出 plan/status 事件。"""
    resp = await client.post(
        "/api/agents/execute/stream",
        json={"goal": "规划任务"},
    )
    text = resp.text
    # LangGraph stub 模式应产出 status 事件(planning/executing/completed)
    assert "event: status" in text or "event: plan" in text
    # 最终 done 事件
    assert "event: done" in text


# =============================================================================
# a2a 路由
# =============================================================================


async def test_a2a_register_agent_endpoint(client):
    """POST /api/a2a/agents/register 注册 agent。"""
    resp = await client.post(
        "/api/a2a/agents/register",
        json={
            "id": "test-agent-1",
            "name": "Test Agent",
            "description": "测试 agent",
            "capabilities": ["search", "analyze"],
            "endpoint": "http://localhost:8001",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-agent-1"
    assert data["name"] == "Test Agent"
    assert "search" in data["capabilities"]


async def test_a2a_list_agents_endpoint(client):
    """GET /api/a2a/agents 列出 agent。"""
    # 先注册一个 agent
    await client.post(
        "/api/a2a/agents/register",
        json={"id": "list-test-agent", "name": "List Test"},
    )
    resp = await client.get("/api/a2a/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert "agents" in data
    assert "count" in data
    assert data["count"] >= 1


async def test_a2a_send_task_endpoint(client):
    """POST /api/a2a/tasks 发送任务。"""
    # 先注册 agent
    await client.post(
        "/api/a2a/agents/register",
        json={"id": "task-test-agent", "name": "Task Test"},
    )

    resp = await client.post(
        "/api/a2a/tasks",
        json={
            "name": "测试任务",
            "description": "用于测试",
            "input": {"query": "hello"},
            "assigned_agent_id": "task-test-agent",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["name"] == "测试任务"


async def test_a2a_task_status_not_found(client):
    """GET /api/a2a/tasks/{id}/status 不存在返回 404。"""
    resp = await client.get("/api/a2a/tasks/nonexistent-task/status")
    assert resp.status_code == 404


async def test_a2a_task_result_not_found(client):
    """GET /api/a2a/tasks/{id}/result 不存在返回 404。"""
    resp = await client.get("/api/a2a/tasks/nonexistent-task/result")
    assert resp.status_code == 404
