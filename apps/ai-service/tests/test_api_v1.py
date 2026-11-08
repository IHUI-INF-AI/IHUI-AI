# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    """强制 memory_store 内存模式 + 清理状态(避免测试间污染)。

    2026-08-22 修复:VectorMemoryStore 重构后内部存储字段由 _store 改为
    _entries/_vectors(见 app/services/vector_memory.py)。旧 _store 引用 → AttributeError。
    """
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


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
        """注册新 agent(用例自己摘掉,不污染共享注册表)。"""
        from app.services.agent_orchestrator import agent_orchestrator

        try:
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
        finally:
            # 2026-10-26:xdist 同 worker 的后续用例同读这份进程内单例,
            # 残留一档会让 dispatch_subagent 广告面与注册表集合不等(实测 -n auto 三连红)。
            agent_orchestrator.registry.remove("test_custom_agent")

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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ===== AIS P1 G1 authz fixtures (merged to keep tracked test-file count stable) =====
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-P1 G1(越权/鉴权面)回归夹具。

覆盖报告条目:
- AIS-032   对话 identity 由 JWT 主体决定,复合 session_id 冒用 → 403
- AIS-033   RAG 向量/关键词两路都按 user_id 裁剪
- AIS-034   知识图谱 owner 只取认证主体,忽略 X-Owner-Uuid
- AIS-038   Hook update 不能把 action 改成 script(路由 + 引擎双闸)
- AIS-039   预算配置/支柱重置仅管理员
- AIS-050   token6688 本地路径分支走 workspace + 敏感文件判据
- AIS-051   token6688 上传/克隆 + browser_selfcheck 进 admin 档
- AIS-073   发布凭证查询必须绑定 user_id
- AIS-074   recap 读取 thread 前先过属主校验

每条都做"旧路径被拒 + 正常路径不被误挡"的双断言(引擎侧无法构造时以结构断言代替)。
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL, require_request_user_id
from app.services import mcp_server
from app.services.conversation import SessionOwnershipError
from app.services.hook_engine import HookEngine


def _req(user_id: str = "alice", role_id: int = 0):
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id, role_id=role_id))


def _async_client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ---------------------------------------------------------------------------
# AIS-032
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais032_composite_session_of_other_user_rejected():
    from app.services.conversation import conversation_service

    with pytest.raises(SessionOwnershipError):
        await conversation_service.chat(
            "hi", session_id="victim:sess-1", user_id="attacker"
        )


@pytest.mark.asyncio
async def test_ais032_memory_scope_is_subject_namespaced():
    # 旧的攻击面:attacker 传 "victim:sess" ⇒ 读写 victim 的 memory key。
    assert memory_store.scope_user_id("victim:sess", "attacker") == "attacker"
    # 自己的复合键不重复加前缀(保持既有 key 连续)。
    assert memory_store.scope_user_id("alice:sess", "alice") is None
    # 非复合键按主体命名空间隔离。
    assert memory_store.scope_user_id("sess", "alice") == "alice"
    # dev/旧调用无主体时保持原语义。
    assert memory_store.scope_user_id("sess", None) is None


@pytest.mark.asyncio
async def test_ais032_route_403_and_identity_from_request(monkeypatch):
    from app.api.v1 import chat as chat_mod

    captured: dict = {}

    async def _fake_chat(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(
            session_id=kwargs["session_id"],
            user_input=kwargs["user_input"],
            intent=SimpleNamespace(
                intent="chat", confidence=1.0, entities={}, reasoning="",
                needs_tool=False, suggested_tools=[],
            ),
            tool_calls=[], final_response="ok", model="stub", iterations=0,
            duration_ms=0.0, stub=True, trace=[],
        )

    async def _principal(_request):
        return "attacker"

    monkeypatch.setattr(chat_mod, "require_request_user_id", _principal)
    monkeypatch.setattr(chat_mod.conversation_service, "chat", _fake_chat)

    app = FastAPI()
    app.include_router(chat_mod.router, prefix="/api")
    async with _async_client(app) as c:
        ok = await c.post("/api/chat", json={"message": "hi", "session_id": "s1"})
        assert ok.status_code == 200
        assert captured["user_id"] == "attacker"

        async def _reject(**_kw):
            raise SessionOwnershipError("不属于当前用户")

        monkeypatch.setattr(chat_mod.conversation_service, "chat", _reject)
        bad = await c.post(
            "/api/chat", json={"message": "hi", "session_id": "victim:s1"}
        )
        assert bad.status_code == 403


@pytest.mark.asyncio
async def test_ais032_dev_bypass_keeps_legacy_behaviour(monkeypatch):
    from app.api.v1 import chat as chat_mod

    async def _principal(_request):
        return DEV_ANONYMOUS_PRINCIPAL

    seen: dict = {}

    async def _fake_chat(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(
            session_id=kwargs["session_id"], user_input=kwargs["user_input"],
            intent=SimpleNamespace(intent="chat", confidence=1.0, entities={},
                                   reasoning="", needs_tool=False, suggested_tools=[]),
            tool_calls=[], final_response="ok", model="stub", iterations=0,
            duration_ms=0.0, stub=True, trace=[],
        )

    monkeypatch.setattr(chat_mod, "require_request_user_id", _principal)
    monkeypatch.setattr(chat_mod.conversation_service, "chat", _fake_chat)
    app = FastAPI()
    app.include_router(chat_mod.router, prefix="/api")
    async with _async_client(app) as c:
        r = await c.post("/api/chat", json={"message": "hi", "session_id": "e2e-1"})
    assert r.status_code == 200
    assert seen["user_id"] is None


# ---------------------------------------------------------------------------
# AIS-033
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais033_vector_and_keyword_paths_pass_user_id(monkeypatch):
    from app.services import rag as rag_mod

    seen: dict = {}

    async def _embed(q):
        return [0.1, 0.2]

    async def _search(**kwargs):
        seen["search"] = kwargs
        return []

    async def _list_sessions(**kwargs):
        seen["list"] = kwargs
        return []

    async def _get(sid, **kwargs):
        seen["get"] = (sid, kwargs)
        return []

    monkeypatch.setattr(rag_mod.vector_memory, "embed", _embed)
    monkeypatch.setattr(rag_mod.vector_memory, "search", _search)
    monkeypatch.setattr(memory_store, "list_sessions", _list_sessions)
    monkeypatch.setattr(memory_store, "get", _get)

    await rag_mod.rag_service._vector_retrieve("q", top_k=5, user_id="alice")
    await rag_mod.rag_service._keyword_fallback(
        "q", top_k=5, session_id="s1", user_id="alice"
    )

    assert seen["search"]["user_id"] == "alice"
    sid, kwargs = seen["get"]
    assert sid == "s1"
    assert kwargs["user_id"] == "alice"


@pytest.mark.asyncio
async def test_ais033_route_rejects_foreign_session_and_passes_subject(monkeypatch):
    from app.api.v1 import rag as rag_mod

    seen: dict = {}

    async def _principal(_request):
        return "attacker"

    async def _query(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(
            answer="a", sources=[], question=kwargs["question"],
            duration_ms=0.0, stub=True, recall_stats={},
        )

    monkeypatch.setattr(rag_mod, "require_request_user_id", _principal)
    monkeypatch.setattr(rag_mod.rag_service, "query", _query)

    app = FastAPI()
    app.include_router(rag_mod.router, prefix="/api")
    async with _async_client(app) as c:
        bad = await c.post(
            "/api/rag", json={"query": "q", "session_id": "victim:s"}
        )
        assert bad.status_code == 403
        ok = await c.post("/api/rag", json={"query": "q", "session_id": "s"})
        assert ok.status_code == 200
    assert seen["user_id"] == "attacker"


# ---------------------------------------------------------------------------
# AIS-034
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais034_owner_comes_from_subject_not_header(monkeypatch):
    from app.api.v1 import knowledge_graph as kg_mod

    owners: list[str] = []

    async def _get_graph(owner):
        owners.append(owner)
        return {"entities": [], "relations": []}

    async def _clear(owner):
        owners.append(owner)

    monkeypatch.setattr(kg_mod.graph_store, "get_graph", _get_graph)
    monkeypatch.setattr(kg_mod.graph_store, "clear", _clear)
    monkeypatch.setattr(kg_mod.graph_store, "persistence_status", lambda: "memory")

    async def _principal():
        return "alice"

    app = FastAPI()
    app.include_router(kg_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = _principal
    async with _async_client(app) as c:
        r = await c.get("/api/data", headers={"X-Owner-Uuid": "bob"})
        assert r.status_code == 200
        assert r.json()["data"]["owner_uuid"] == "alice"
        d = await c.delete("/api/data", headers={"X-Owner-Uuid": "bob"})
        assert d.status_code == 200
        assert d.json()["data"]["owner_uuid"] == "alice"
    assert owners == ["alice", "alice", "alice"]


@pytest.mark.asyncio
async def test_ais034_unauthenticated_still_401_even_with_owner_header(monkeypatch):
    from app.api.v1 import knowledge_graph as kg_mod
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_dev_no_auth", False)
    app = FastAPI()
    app.include_router(kg_mod.router, prefix="/api")
    async with _async_client(app) as c:
        r = await c.get("/api/data", headers={"X-Owner-Uuid": "bob"})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# AIS-038
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais038_router_blocks_non_admin_script_update(monkeypatch):
    from app.routers import hooks as hooks_mod

    engine = MagicMock()
    engine.get_hook.return_value = {"id": "h1", "owner_id": "alice", "action": {"type": "log"}}
    engine.update_hook.return_value = {"id": "h1"}
    monkeypatch.setattr(hooks_mod, "hook_engine", engine)
    monkeypatch.setattr(hooks_mod, "_action_allowed", lambda _t: True)

    body = hooks_mod.UpdateHookRequest(
        action=hooks_mod.HookActionModel(
            type="script", config=hooks_mod.HookActionConfigModel(command="whoami")
        )
    )
    with pytest.raises(HTTPException) as exc:
        await hooks_mod.update_hook(_req(role_id=0), "h1", body, user_id="alice")
    assert exc.value.status_code == 403
    engine.update_hook.assert_not_called()

    await hooks_mod.update_hook(_req(role_id=1), "h1", body, user_id="alice")
    assert engine.update_hook.call_args.kwargs["allow_script"] is True


def test_ais038_engine_second_gate_denies_script_transition():
    eng = HookEngine.__new__(HookEngine)
    eng._hooks = {
        "h1": {
            "id": "h1", "name": "n", "event": "tool.before", "condition": None,
            "action": {"type": "log", "config": {}}, "enabled": True,
            "owner_id": "alice", "createdAt": "x", "updatedAt": "x",
        }
    }
    eng._schedule_persist_hooks = lambda: None
    assert eng.update_hook(
        "h1", {"action": {"type": "script", "config": {"command": "x"}}},
        owner_id="alice", allow_script=False,
    ) is None
    assert eng._hooks["h1"]["action"]["type"] == "log"

    updated = eng.update_hook(
        "h1", {"action": {"type": "script", "config": {"command": "x"}}},
        owner_id="alice", allow_script=True,
    )
    assert updated is not None and updated["action"]["type"] == "script"


# ---------------------------------------------------------------------------
# AIS-039
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais039_budget_config_requires_admin(monkeypatch):
    from app.routers import orchestration as orch_mod

    async def _update(cfg):
        return SimpleNamespace(**cfg)

    monkeypatch.setattr(
        orch_mod.llm_budget_governor, "update_config", _update
    )
    with pytest.raises(HTTPException) as exc:
        await orch_mod.update_budget_config(
            orch_mod.BudgetConfigUpdateBody(daily_token_limit=10),
            _req(role_id=0), user_id="alice",
        )
    assert exc.value.status_code == 403

    resp = await orch_mod.update_budget_config(
        orch_mod.BudgetConfigUpdateBody(daily_token_limit=10),
        _req(role_id=1), user_id="alice",
    )
    assert resp["code"] == 0


@pytest.mark.asyncio
async def test_ais039_pillar_reset_requires_admin(monkeypatch):
    from app.routers import orchestration as orch_mod

    async def _reset(pillar):
        return True

    monkeypatch.setattr(orch_mod.llm_budget_governor, "reset_degradation", _reset)
    with pytest.raises(HTTPException) as exc:
        await orch_mod.reset_pillar_degradation("rag", _req(role_id=0), user_id="alice")
    assert exc.value.status_code == 403
    ok = await orch_mod.reset_pillar_degradation("rag", _req(role_id=1), user_id="alice")
    assert ok["data"] == {"success": True}


# ---------------------------------------------------------------------------
# AIS-050 / AIS-051
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais050_local_audio_path_outside_workspace_rejected(tmp_path, monkeypatch):
    outside = tmp_path / "secret.wav"
    outside.write_bytes(b"RIFF....")
    data, _name, err, err_code = mcp_server._audio_source_from_args({"path": str(outside)})
    assert data == b"" and err and err_code == "PATH_NOT_ALLOWED"
    # 越界文案统一到 main 详细版:必须点明"不在工作区白名单"且带上被拒路径本身。
    assert "不在工作区白名单" in err and str(outside) in err


@pytest.mark.asyncio
async def test_ais050_local_audio_path_inside_workspace_still_works(tmp_path, monkeypatch):
    ref = tmp_path / "ref.wav"
    ref.write_bytes(b"RIFF....")
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path)])
    data, name, err, err_code = mcp_server._audio_source_from_args({"path": str(ref)})
    assert err is None and err_code is None
    assert data == b"RIFF...." and name == "ref.wav"


@pytest.mark.asyncio
async def test_ais050_sensitive_file_blocked_even_inside_workspace(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("OPENAI_API_KEY=sk-secret")
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path)])
    data, _name, err, err_code = mcp_server._audio_source_from_args({"path": str(env)})
    assert data == b"" and err and err_code == "SENSITIVE_FILE_BLOCKED"
    assert "敏感" in err and str(env) in err


@pytest.mark.asyncio
async def test_ais050_upload_file_blocks_outside_path_before_network(tmp_path):
    outside = tmp_path / "x.bin"
    outside.write_bytes(b"x")
    out = await mcp_server._tool_token6688_upload_file({"path": str(outside)})
    assert out["ok"] is False and out["errorCode"] == "PATH_NOT_ALLOWED"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool",
    [
        "token6688_upload_file",
        "token6688_voice_clone",
        "browser_selfcheck_screenshot",
        "browser_selfcheck",
    ],
)
async def test_ais051_role0_cannot_reach_recursive_admin_tools(tool):
    out = await mcp_server.mcp_server.call_tool(tool, {}, user_role=0, user_id="alice")
    assert out["ok"] is False and "admin" in out["error"]


# ---------------------------------------------------------------------------
# AIS-073
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ais073_credentials_query_binds_user_id():
    from app.services.publish.scheduler import PublishScheduler

    sched = PublishScheduler()
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=None)
    conn.close = AsyncMock()
    sched._get_conn = AsyncMock(return_value=conn)

    assert await sched._load_credentials(1, "x", "alice") is None
    sql, *args = conn.fetchrow.await_args.args
    assert "user_id" in sql
    assert args == [1, "x", "alice"]

    # 无主体时直接 fail-closed,不触库。
    sched._get_conn.reset_mock()
    assert await sched._load_credentials(1, "x", None) is None
    sched._get_conn.assert_not_awaited()


# ---------------------------------------------------------------------------
# AIS-074 在 test_recap_handoff.py 内追加(复用其 FakeStore 夹具)
# ---------------------------------------------------------------------------
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
