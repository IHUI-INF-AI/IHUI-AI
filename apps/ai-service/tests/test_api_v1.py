"""Integration tests for /api/v1/ai/* endpoints(2026-07-20 新增业务流)。

测试覆盖:
- POST /api/v1/ai/chat — 对话端点
- POST /api/v1/ai/agent/invoke — 单 agent 调用
- POST /api/v1/ai/agent/pipeline — pipeline 编排
- POST /api/v1/ai/agent/parallel — 并行编排
- GET  /api/v1/ai/agent/list — agent 列表
- POST /api/v1/ai/agent/register — 注册 agent
- POST /api/v1/ai/rag — RAG 查询
- POST /api/v1/ai/rag/documents — 添加文档

测试环境无 LLM API key,所有调用走 stub 模式。
"""

from __future__ import annotations

import pytest

from app.services.memory import memory_store
from app.services.vector_memory import vector_memory


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 内存模式 + 清理状态(避免测试间污染)。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._store.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._store.clear()


# =============================================================================
# /api/v1/ai/chat
# =============================================================================


class TestChatEndpoint:
    @pytest.mark.asyncio
    async def test_chat_basic(self, client):
        """基础 chat 调用。"""
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "你好"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "ok"
        assert "data" in data
        assert "final_response" in data["data"]
        assert "intent" in data["data"]
        assert "trace" in data["data"]

    @pytest.mark.asyncio
    async def test_chat_with_session_id(self, client):
        """带 session_id。"""
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "继续上次的对话", "session_id": "test-session-1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["session_id"] == "test-session-1"

    @pytest.mark.asyncio
    async def test_chat_with_allowed_tools(self, client):
        """指定 allowed_tools。"""
        resp = await client.post(
            "/api/v1/ai/chat",
            json={
                "message": "查找代码",
                "allowed_tools": ["search_codebase"],
                "max_iterations": 1,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["iterations"] >= 1

    @pytest.mark.asyncio
    async def test_chat_validation(self, client):
        """缺少 message 字段应返回 422。"""
        resp = await client.post("/api/v1/ai/chat", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_max_iterations_validation(self, client):
        """max_iterations 超出范围(>10)应返回 422。"""
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "x", "max_iterations": 100},
        )
        assert resp.status_code == 422


# =============================================================================
# /api/v1/ai/agent/*  (单 agent + pipeline + parallel)
# =============================================================================


class TestAgentInvokeEndpoint:
    @pytest.mark.asyncio
    async def test_invoke_existing_agent(self, client):
        """调用已注册 agent。"""
        resp = await client.post(
            "/api/v1/ai/agent/invoke",
            json={"agent": "researcher", "message": "调研 AI 行业"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["agent_name"] == "researcher"
        assert data["data"]["status"] == "completed"
        assert "output" in data["data"]

    @pytest.mark.asyncio
    async def test_invoke_nonexistent_agent(self, client):
        """调用不存在的 agent 返回 code=1。"""
        resp = await client.post(
            "/api/v1/ai/agent/invoke",
            json={"agent": "nonexistent_xyz", "message": "x"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] != 0
        assert data["data"]["status"] == "failed"

    @pytest.mark.asyncio
    async def test_invoke_with_session_id(self, client):
        """带 session_id。"""
        resp = await client.post(
            "/api/v1/ai/agent/invoke",
            json={
                "agent": "coder",
                "message": "实现 hello world",
                "session_id": "agent-test-1",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["status"] == "completed"


class TestAgentPipelineEndpoint:
    @pytest.mark.asyncio
    async def test_pipeline_basic(self, client):
        """基础 pipeline 调用。"""
        resp = await client.post(
            "/api/v1/ai/agent/pipeline",
            json={
                "steps": [
                    {"agent": "researcher", "input_template": "{input}"},
                    {"agent": "coder", "input_template": "基于:{prev_output}"},
                ],
                "initial_input": "研究 Python 异步",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert len(data["data"]["steps"]) == 2
        assert data["data"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_pipeline_missing_steps(self, client):
        """缺少 steps 字段 → 422。"""
        resp = await client.post(
            "/api/v1/ai/agent/pipeline",
            json={"initial_input": "x"},
        )
        assert resp.status_code == 422


class TestAgentParallelEndpoint:
    @pytest.mark.asyncio
    async def test_parallel_basic(self, client):
        """并行调用 2 个 agent。"""
        resp = await client.post(
            "/api/v1/ai/agent/parallel",
            json={
                "items": [
                    {"agent": "researcher", "input": "调研主题 A"},
                    {"agent": "coder", "input": "实现主题 B"},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]["steps"]) == 2


class TestAgentListEndpoint:
    @pytest.mark.asyncio
    async def test_list_default_agents(self, client):
        """列出默认 5 个 agent。"""
        resp = await client.get("/api/v1/ai/agent/list")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["count"] >= 5
        names = {a["name"] for a in data["data"]["agents"]}
        for n in ("researcher", "coder", "reviewer", "architect", "debugger"):
            assert n in names


class TestAgentRegisterEndpoint:
    @pytest.mark.asyncio
    async def test_register_new_agent(self, client):
        """注册新 agent。"""
        resp = await client.post(
            "/api/v1/ai/agent/register",
            json={
                "name": "test_custom_agent",
                "description": "测试 agent",
                "system_prompt": "你是测试 agent",
                "tools": ["read_file"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["name"] == "test_custom_agent"
        # 验证能列出来
        list_resp = await client.get("/api/v1/ai/agent/list")
        names = {a["name"] for a in list_resp.json()["data"]["agents"]}
        assert "test_custom_agent" in names

    @pytest.mark.asyncio
    async def test_register_empty_name_rejected(self, client):
        """空 name 被拒(应 400 或 422)。"""
        resp = await client.post(
            "/api/v1/ai/agent/register",
            json={"name": "", "system_prompt": "x"},
        )
        # 422 = pydantic 校验,400 = 业务校验
        assert resp.status_code in (400, 422)


# =============================================================================
# /api/v1/ai/rag/*
# =============================================================================


class TestRAGEndpoint:
    @pytest.mark.asyncio
    async def test_rag_query_empty(self, client):
        """RAG 查询(空知识库)。"""
        resp = await client.post(
            "/api/v1/ai/rag",
            json={"query": "Python 是什么?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        # 空知识库时 source_count = 0,answer 含降级提示
        assert data["data"]["source_count"] == 0

    @pytest.mark.asyncio
    async def test_rag_add_and_query(self, client):
        """添加文档 + 查询。"""
        # 1. 添加文档
        add_resp = await client.post(
            "/api/v1/ai/rag/documents",
            json={
                "session_id": "rag-test-1",
                "content": "LangGraph 是用于构建多步骤 LLM 应用的框架,支持状态机。",
                "role": "system",
            },
        )
        assert add_resp.status_code == 200
        assert add_resp.json()["code"] == 0

        # 2. 查询
        query_resp = await client.post(
            "/api/v1/ai/rag",
            json={"query": "LangGraph 是什么?", "top_k": 3},
        )
        assert query_resp.status_code == 200
        data = query_resp.json()
        assert data["code"] == 0
        # 关键词 fallback 应能命中
        assert data["data"]["answer"]

    @pytest.mark.asyncio
    async def test_rag_with_score_threshold(self, client):
        """score_threshold 参数生效。"""
        resp = await client.post(
            "/api/v1/ai/rag",
            json={"query": "test", "score_threshold": 0.9},
        )
        assert resp.status_code == 200
        # 高阈值下应过滤掉大部分源
        data = resp.json()
        assert all(s["score"] >= 0.9 for s in data["data"]["sources"])

    @pytest.mark.asyncio
    async def test_rag_validation_missing_query(self, client):
        """缺 query → 422。"""
        resp = await client.post("/api/v1/ai/rag", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_rag_documents_validation(self, client):
        """缺 session_id → 422。"""
        resp = await client.post(
            "/api/v1/ai/rag/documents",
            json={"content": "x"},
        )
        assert resp.status_code == 422


# =============================================================================
# End-to-end: chat → agent → rag 串联
# =============================================================================


class TestEndToEndFlow:
    @pytest.mark.asyncio
    async def test_full_flow(self, client):
        """完整流程:rag 添加文档 → chat 查询 → agent 调用 → 验证。"""
        # 1. 添加 RAG 文档
        await client.post(
            "/api/v1/ai/rag/documents",
            json={
                "session_id": "e2e-1",
                "content": "FastAPI 是高性能 Python web 框架,基于类型提示。",
                "role": "system",
            },
        )
        # 2. chat 调用
        chat_resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "调研 FastAPI 框架", "session_id": "e2e-1"},
        )
        assert chat_resp.json()["code"] == 0
        # 3. agent invoke
        agent_resp = await client.post(
            "/api/v1/ai/agent/invoke",
            json={"agent": "researcher", "message": "写一个 FastAPI hello world", "session_id": "e2e-1"},
        )
        assert agent_resp.json()["code"] == 0
        # 4. RAG 查询
        rag_resp = await client.post(
            "/api/v1/ai/rag",
            json={"query": "FastAPI 是什么?", "session_id": "e2e-1"},
        )
        assert rag_resp.json()["code"] == 0
