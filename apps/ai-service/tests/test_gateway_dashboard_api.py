"""网关 Dashboard 后端 API 测试(P0-3,2026-07-30 立)。

测试覆盖:
- GET  /llm/providers/health — provider 健康状态 + summary 结构 + cooldown 字段
- GET  /llm/combos — 列出 combo 链(空 / 创建后可见 / 字段完整性)
- POST /llm/combos — 创建/更新 combo 链(priority/fusion+judge/更新/空 chain 拒绝)
- DELETE /llm/combos/{name} — 删除 combo 链(成功 / 不存在 404)
- POST /llm/anthropic/v1/messages (stream=true) — Anthropic SSE 流式格式
- POST /llm/gemini/v1beta/models/{model}:generateContent (stream=true) — Gemini SSE 流式
- POST /llm/gemini/v1beta/models/{model}:streamGenerateContent — Gemini 强制流式
- 错误处理(无效 JSON 400)
"""

from __future__ import annotations

import json

import pytest

from app.services.combo_router import combo_router


# =============================================================================
# 辅助 fixture:每个测试后恢复 combo_router 状态(避免测试间互相污染)
# =============================================================================


@pytest.fixture
def clean_combo_router():
    """测试前保存 combo_router._combos,测试后恢复。"""
    saved_combos = dict(combo_router._combos)
    yield
    combo_router._combos.clear()
    combo_router._combos.update(saved_combos)


# =============================================================================
# Mock llm_gateway fixture:隔离真实 LLM 调用,返回可预测的 stub 响应
# =============================================================================


@pytest.fixture
def mock_llm_gateway(monkeypatch):
    """mock llm_gateway.complete + astream,避免测试因无 API key 失败。

    - complete:返回 {"content": "Hello from mock LLM", "model": <model>, "usage": {...}}
    - astream:yield chunk + done 事件
    """
    from app.routers import llm as llm_router

    async def fake_complete(messages, model=None, owner_uuid=None, **kwargs):
        return {
            "content": "Hello from mock LLM",
            "model": model or "mock-model",
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            },
        }

    async def fake_astream(messages, model=None, owner_uuid=None, **kwargs):
        yield {"type": "chunk", "content": "Hello"}
        yield {"type": "chunk", "content": " from"}
        yield {"type": "chunk", "content": " mock"}
        yield {
            "type": "done",
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            },
        }

    monkeypatch.setattr(llm_router.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


# =============================================================================
# GET /llm/providers/health
# =============================================================================


async def test_providers_health_returns_structure(client):
    """GET /llm/providers/health 返回 providers 列表 + summary。"""
    resp = await client.get("/api/llm/providers/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert "summary" in data
    assert isinstance(data["providers"], list)


async def test_providers_health_summary_fields(client):
    """summary 含 total/configured/local/not_configured 四个字段。"""
    resp = await client.get("/api/llm/providers/health")
    data = resp.json()
    summary = data["summary"]
    assert "total" in summary
    assert "configured" in summary
    assert "local" in summary
    assert "not_configured" in summary
    assert summary["total"] == len(data["providers"])
    assert summary["total"] == summary["configured"] + summary["local"] + summary["not_configured"]


async def test_providers_health_has_cooldown_fields(client):
    """每个 provider 含 is_in_cooldown + consecutive_failures 字段。"""
    resp = await client.get("/api/llm/providers/health")
    data = resp.json()
    for p in data["providers"]:
        assert "is_in_cooldown" in p
        assert "consecutive_failures" in p
        assert isinstance(p["is_in_cooldown"], bool)
        assert isinstance(p["consecutive_failures"], int)


async def test_providers_health_provider_fields(client):
    """每个 provider 含 provider_code/display_name/status/category/default_models 字段。"""
    resp = await client.get("/api/llm/providers/health")
    data = resp.json()
    assert len(data["providers"]) > 0
    p = data["providers"][0]
    assert "provider_code" in p
    assert "display_name" in p
    assert "status" in p
    assert "category" in p
    assert "default_models" in p
    assert "default_base_url" in p
    assert "free_quota" in p


async def test_providers_health_local_providers_exist(client):
    """测试环境无 API key,local provider(ollama 等)status 应为 'local'。"""
    resp = await client.get("/api/llm/providers/health")
    data = resp.json()
    local_providers = [p for p in data["providers"] if p["status"] == "local"]
    assert len(local_providers) > 0
    local_codes = {p["provider_code"] for p in local_providers}
    assert "ollama" in local_codes


# =============================================================================
# GET /llm/combos
# =============================================================================


async def test_list_combos_returns_structure(client, clean_combo_router):
    """GET /llm/combos 返回 combos 列表。"""
    resp = await client.get("/api/llm/combos")
    assert resp.status_code == 200
    data = resp.json()
    assert "combos" in data
    assert isinstance(data["combos"], list)


async def test_list_combos_after_create(client, clean_combo_router):
    """创建 combo 后 GET /llm/combos 能看到。"""
    await client.post("/api/llm/combos", json={
        "name": "test-list-combo",
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })
    resp = await client.get("/api/llm/combos")
    data = resp.json()
    names = [c["name"] for c in data["combos"]]
    assert "test-list-combo" in names


async def test_list_combos_has_correct_fields(client, clean_combo_router):
    """combo 条目含 name/strategy/chain/judge/description 字段。"""
    await client.post("/api/llm/combos", json={
        "name": "test-fields-combo",
        "strategy": "priority",
        "chain": ["model-a"],
        "description": "test desc",
    })
    resp = await client.get("/api/llm/combos")
    data = resp.json()
    combo = next(c for c in data["combos"] if c["name"] == "test-fields-combo")
    assert combo["strategy"] == "priority"
    assert combo["chain"] == ["model-a"]
    assert combo["judge"] is None
    assert combo["description"] == "test desc"


# =============================================================================
# POST /llm/combos
# =============================================================================


async def test_create_combo_success(client, clean_combo_router):
    """POST /llm/combos 创建 combo 成功。"""
    resp = await client.post("/api/llm/combos", json={
        "name": "test-create-combo",
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["combo"]["name"] == "test-create-combo"
    assert data["combo"]["strategy"] == "priority"
    assert data["combo"]["chain"] == ["kimi-k2", "glm-4-flash"]


async def test_create_combo_with_judge(client, clean_combo_router):
    """POST /llm/combos 创建 fusion combo 带 judge。"""
    resp = await client.post("/api/llm/combos", json={
        "name": "test-fusion-combo",
        "strategy": "fusion",
        "chain": ["gpt-4o", "claude-3.5-sonnet"],
        "judge": "gpt-4o-mini",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["combo"]["judge"] == "gpt-4o-mini"
    assert data["combo"]["strategy"] == "fusion"


async def test_update_combo(client, clean_combo_router):
    """POST /llm/combos 更新已存在的 combo(同名覆盖)。"""
    await client.post("/api/llm/combos", json={
        "name": "test-update-combo",
        "strategy": "priority",
        "chain": ["model-a"],
    })
    resp = await client.post("/api/llm/combos", json={
        "name": "test-update-combo",
        "strategy": "cheapest",
        "chain": ["model-b", "model-c"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["combo"]["strategy"] == "cheapest"
    assert data["combo"]["chain"] == ["model-b", "model-c"]


async def test_create_combo_empty_chain_rejected(client, clean_combo_router):
    """POST /llm/combos 空 chain 返回 400。"""
    resp = await client.post("/api/llm/combos", json={
        "name": "test-empty-chain",
        "strategy": "priority",
        "chain": [],
    })
    assert resp.status_code == 400
    data = resp.json()
    assert data["ok"] is False


# =============================================================================
# DELETE /llm/combos/{name}
# =============================================================================


async def test_delete_combo_success(client, clean_combo_router):
    """DELETE /llm/combos/{name} 删除已存在的 combo。"""
    await client.post("/api/llm/combos", json={
        "name": "test-delete-combo",
        "strategy": "priority",
        "chain": ["model-a"],
    })
    resp = await client.delete("/api/llm/combos/test-delete-combo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["name"] == "test-delete-combo"
    # 验证已删除
    resp2 = await client.get("/api/llm/combos")
    names = [c["name"] for c in resp2.json()["combos"]]
    assert "test-delete-combo" not in names


async def test_delete_combo_not_found(client, clean_combo_router):
    """DELETE 不存在的 combo 返回 404。"""
    resp = await client.delete("/api/llm/combos/nonexistent-combo-xxx")
    assert resp.status_code == 404
    data = resp.json()
    assert data["ok"] is False


# =============================================================================
# Anthropic Messages:非流式 + 流式
# =============================================================================


async def test_anthropic_non_streaming(client, mock_llm_gateway):
    """POST /llm/anthropic/v1/messages 非流式返回 Anthropic Messages 格式。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hello"}],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "message"
    assert data["role"] == "assistant"
    assert "content" in data


async def test_anthropic_streaming_returns_sse(client, mock_llm_gateway):
    """POST /llm/anthropic/v1/messages stream=true 返回 SSE。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hello"}],
        "stream": True,
    })
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    text = resp.text
    assert "event:" in text
    assert "data:" in text


async def test_anthropic_streaming_has_message_start(client, mock_llm_gateway):
    """Anthropic SSE 含 event: message_start 事件。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hi"}],
        "stream": True,
    })
    text = resp.text
    assert "event: message_start" in text
    assert "message_start" in text


async def test_anthropic_streaming_has_content_block_delta(client, mock_llm_gateway):
    """Anthropic SSE 含 event: content_block_delta 事件(text_delta)。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hello world"}],
        "stream": True,
    })
    text = resp.text
    assert "event: content_block_delta" in text
    assert "text_delta" in text


async def test_anthropic_streaming_has_message_stop(client, mock_llm_gateway):
    """Anthropic SSE 含 event: message_stop 事件。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hi"}],
        "stream": True,
    })
    text = resp.text
    assert "event: message_stop" in text


async def test_anthropic_streaming_has_block_start_and_stop(client, mock_llm_gateway):
    """Anthropic SSE 含 content_block_start + content_block_stop 事件。"""
    resp = await client.post("/api/llm/anthropic/v1/messages", json={
        "model": "claude-3.5-sonnet",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hi"}],
        "stream": True,
    })
    text = resp.text
    assert "event: content_block_start" in text
    assert "event: content_block_stop" in text


# =============================================================================
# Gemini generateContent:非流式 + 流式 + streamGenerateContent
# =============================================================================


async def test_gemini_non_streaming(client, mock_llm_gateway):
    """POST :generateContent 非流式返回 Gemini 格式。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:generateContent",
        json={
            "contents": [{"role": "user", "parts": [{"text": "hello"}]}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "candidates" in data


async def test_gemini_streaming_returns_sse(client, mock_llm_gateway):
    """POST :generateContent stream=true 返回 SSE。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:generateContent",
        json={
            "contents": [{"role": "user", "parts": [{"text": "hello"}]}],
            "stream": True,
        },
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    text = resp.text
    assert "data:" in text


async def test_gemini_streaming_has_candidates_with_text(client, mock_llm_gateway):
    """Gemini SSE 含 candidates + content.parts[text]。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:generateContent",
        json={
            "contents": [{"role": "user", "parts": [{"text": "hello world"}]}],
            "stream": True,
        },
    )
    text = resp.text
    found_candidates = False
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                payload = json.loads(line[6:])
                if "candidates" in payload:
                    parts = payload["candidates"][0]["content"]["parts"]
                    assert any("text" in p for p in parts)
                    found_candidates = True
                    break
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
    assert found_candidates, "No candidates with text found in Gemini SSE stream"


async def test_gemini_streaming_has_finish_reason(client, mock_llm_gateway):
    """Gemini SSE 最后一个 chunk 含 finishReason=STOP + usageMetadata。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:generateContent",
        json={
            "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
            "stream": True,
        },
    )
    text = resp.text
    assert "STOP" in text
    assert "usageMetadata" in text


async def test_gemini_stream_generate_content_route(client, mock_llm_gateway):
    """POST :streamGenerateContent 强制流式返回 SSE(无需 stream=true)。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:streamGenerateContent",
        json={
            "contents": [{"role": "user", "parts": [{"text": "hello"}]}],
        },
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    text = resp.text
    assert "data:" in text
    assert "candidates" in text


# =============================================================================
# 错误处理
# =============================================================================


async def test_anthropic_invalid_json_returns_400(client):
    """POST /llm/anthropic/v1/messages 无效 JSON 返回 400。"""
    resp = await client.post(
        "/api/llm/anthropic/v1/messages",
        content="invalid json {{{",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 400
    data = resp.json()
    assert data["type"] == "error"


async def test_gemini_invalid_json_returns_400(client):
    """POST :generateContent 无效 JSON 返回 400。"""
    resp = await client.post(
        "/api/llm/gemini/v1beta/models/gemini-1.5-pro:generateContent",
        content="invalid json {{{",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
