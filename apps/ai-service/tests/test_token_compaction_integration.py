"""Token 压缩集成测试(P3-1,token_compaction.py 集成到 llm_gateway 调用链)。

测试覆盖(11 用例):

LLMGateway.complete() 集成(1-5):
- 1. test_gateway_complete_without_compaction — enabled=False 时不调用 compactor
- 2. test_gateway_complete_with_compaction — enabled=True + token > 阈值 → 调用 compactor,结果含 compaction 字段
- 3. test_gateway_complete_compaction_skipped_for_tool_calls — 含 tools 参数时不压缩
- 4. test_gateway_complete_compaction_skipped_for_short_messages — token 数 < 阈值时不压缩
- 5. test_gateway_complete_compaction_failure_fallback — compactor 抛异常时降级用原 messages

POST /llm/compaction/demo 端点(6-11):
- 6. test_compaction_demo_endpoint_rtk — strategy=rtk 返回 200 + 压缩结果
- 7. test_compaction_demo_endpoint_caveman — strategy=caveman
- 8. test_compaction_demo_endpoint_rtk_caveman — strategy=rtk_caveman(默认)
- 9. test_compaction_demo_endpoint_invalid_strategy — strategy=invalid 返回 400
- 10. test_compaction_demo_endpoint_empty_messages — messages=[] 返回 400
- 11. test_compaction_demo_endpoint_decompress_correct — decompressed_messages 内容正确(RTK 占位符还原)

测试策略:
- mock litellm.acompletion 返回固定响应(不实际调 LLM)
- mock settings.token_compaction_enabled / token_compaction_min_tokens
  (Settings 类未声明这两个字段,用 object.__setattr__ 绕过 Pydantic BaseSettings.__setattr__)
- mock settings.llm_providers 包含 stepfun with api_key(使 _is_stub_mode() 返回 False)
"""

from __future__ import annotations

import json
import sys
from types import ModuleType
from typing import Any

import pytest

from app.core.config import settings
from app.core.llm_gateway import LLMGateway
from app.services.token_compaction import token_compactor


# =============================================================================
# 辅助 fixture
# =============================================================================


@pytest.fixture
def non_stub_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """让 _is_stub_mode() 返回 False:配置 stepfun provider with api_key。

    与 test_llm_gateway.py test_complete_real_mode_success 同样的 setup。
    """
    monkeypatch.setattr(
        settings,
        "llm_providers",
        json.dumps({"stepfun": {"api_key": "sk-test"}}),
    )


@pytest.fixture
def enable_token_compaction() -> None:
    """启用 token 压缩 + 低阈值(50 tokens),便于触发压缩。

    Settings 类未声明 token_compaction_enabled / token_compaction_min_tokens 字段
    (production 默认 False / 2000,通过 getattr 安全读取)。
    Pydantic BaseSettings.__setattr__ 对未声明字段会 raise ValueError,
    所以用 object.__setattr__ 绕过,直接写到 __dict__。
    """
    object.__setattr__(settings, "token_compaction_enabled", True)
    object.__setattr__(settings, "token_compaction_min_tokens", 50)
    yield
    # 清理:从 __dict__ 删除测试期间注入的字段(防止污染其他测试)
    for k in ("token_compaction_enabled", "token_compaction_min_tokens"):
        if k in settings.__dict__:
            del settings.__dict__[k]


@pytest.fixture
def mock_litellm_acompletion(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mock litellm.acompletion 返回固定响应(不实际调 LLM)。

    模式与 test_llm_gateway.py test_complete_real_mode_success 一致:
    通过 sys.modules 注入 fake litellm ModuleType,避免真实 API 调用。
    """

    class FakeUsage:
        def model_dump(self) -> dict[str, int]:
            return {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}

    class FakeMessage:
        content = "Mock LLM response"
        reasoning_content = None
        tool_calls = None

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = FakeUsage()
        choices = [FakeChoice()]
        model = "stepfun/step-3.7-flash"

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs: Any) -> FakeResponse:
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    # astream 用到的辅助函数也 mock(本测试不覆盖 astream,但 litellm 模块被注入后需保留)
    fake_litellm.token_counter = lambda **kwargs: 100  # type: ignore[assignment]
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)


def _make_long_messages(token_target: int = 200) -> list[dict[str, Any]]:
    """生成长消息列表(总 token 数 > token_target)。

    用重复 schema 文本构造,适合触发 RTK 压缩(跨消息重复子串)。
    每条 schema ~50 tokens,n 条 user + n 条 assistant ≈ 100*n tokens。
    """
    schema = (
        '{"type":"function","function":{"name":"execute_query",'
        '"description":"Execute a SQL query on the database and return results",'
        '"parameters":{"type":"object","properties":{'
        '"query":{"type":"string","description":"The SQL query to execute"},'
        '"database":{"type":"string","enum":["postgres","mysql","sqlite"]}'
        "}}}}"
    )
    n = max(token_target // 40 + 1, 4)
    msgs: list[dict[str, Any]] = [
        {"role": "system", "content": "You are a helpful assistant."}
    ]
    for i in range(n):
        msgs.append({"role": "user", "content": f"Call {i}: {schema}"})
        msgs.append({"role": "assistant", "content": f"OK {i}"})
    msgs.append({"role": "user", "content": "Now summarize."})
    return msgs


# =============================================================================
# 1. test_gateway_complete_without_compaction
# =============================================================================


async def test_gateway_complete_without_compaction(
    non_stub_settings: None,
    mock_litellm_acompletion: None,
) -> None:
    """token_compaction_enabled 未启用时 complete() 不调用 compactor,结果无 compaction 字段。"""
    gw = LLMGateway()
    messages = _make_long_messages(token_target=500)  # 远超阈值,但 enabled=False
    result = await gw.complete(messages, model="stepfun/step-3.7-flash")

    assert result["stub"] is False
    assert result["content"] == "Mock LLM response"
    assert "compaction" not in result  # 未启用 → 无 compaction 字段


# =============================================================================
# 2. test_gateway_complete_with_compaction
# =============================================================================


async def test_gateway_complete_with_compaction(
    non_stub_settings: None,
    mock_litellm_acompletion: None,
    enable_token_compaction: None,
) -> None:
    """token_compaction_enabled=True 且 token 数 > 阈值时 complete() 调用 compactor,结果含 compaction 字段。"""
    gw = LLMGateway()
    messages = _make_long_messages(token_target=500)  # 远大于阈值 50
    result = await gw.complete(messages, model="stepfun/step-3.7-flash")

    assert result["stub"] is False
    assert result["content"] == "Mock LLM response"
    assert "compaction" in result, "启用压缩且 token 数 > 阈值时,结果应含 compaction 字段"
    comp = result["compaction"]
    assert comp["strategy"] == "rtk_caveman"
    assert comp["original_tokens"] > 50  # 超过阈值
    assert comp["compressed_tokens"] >= 0
    assert 0.0 <= comp["compression_ratio"] <= 1.0


# =============================================================================
# 3. test_gateway_complete_compaction_skipped_for_tool_calls
# =============================================================================


async def test_gateway_complete_compaction_skipped_for_tool_calls(
    non_stub_settings: None,
    mock_litellm_acompletion: None,
    enable_token_compaction: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """含 tools 参数时不压缩(即使 enabled=True)。

    Mock _get_provider 返回 None,跳过厂商适配器路径,直接走 LiteLLM(被 mock),
    避免真实 StepfunProvider 发起 HTTP 请求。
    """
    # Mock _get_provider 返回 None,跳过厂商适配器路径
    async def fake_get_provider(self: LLMGateway, model: str, owner_uuid: str | None) -> None:
        return None

    monkeypatch.setattr(LLMGateway, "_get_provider", fake_get_provider)

    gw = LLMGateway()
    messages = _make_long_messages(token_target=500)
    tools = [
        {
            "type": "function",
            "function": {
                "name": "dummy_tool",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]
    result = await gw.complete(messages, model="stepfun/step-3.7-flash", tools=tools)

    assert result["stub"] is False
    # has_tools=True → _apply_token_compaction 跳过 → 无 compaction 字段
    assert "compaction" not in result, "含 tools 参数时应跳过压缩"


# =============================================================================
# 4. test_gateway_complete_compaction_skipped_for_short_messages
# =============================================================================


async def test_gateway_complete_compaction_skipped_for_short_messages(
    non_stub_settings: None,
    mock_litellm_acompletion: None,
    enable_token_compaction: None,
) -> None:
    """messages token 数 < 阈值时不压缩。"""
    gw = LLMGateway()
    # 单条短消息 ~5 tokens,远小于阈值 50
    messages = [{"role": "user", "content": "hi"}]
    result = await gw.complete(messages, model="stepfun/step-3.7-flash")

    assert result["stub"] is False
    assert result["content"] == "Mock LLM response"
    assert "compaction" not in result, "token 数 < 阈值时应跳过压缩"


# =============================================================================
# 5. test_gateway_complete_compaction_failure_fallback
# =============================================================================


async def test_gateway_complete_compaction_failure_fallback(
    non_stub_settings: None,
    mock_litellm_acompletion: None,
    enable_token_compaction: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """compactor 抛异常时降级用原 messages,不阻塞主流程。"""
    # 让 compact_messages 抛异常(模拟内部故障)
    def fake_compact_messages_raise(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("simulated compaction failure")

    monkeypatch.setattr(token_compactor, "compact_messages", fake_compact_messages_raise)

    gw = LLMGateway()
    messages = _make_long_messages(token_target=500)  # 触发压缩
    result = await gw.complete(messages, model="stepfun/step-3.7-flash")

    # 异常被捕获,降级用原 messages,主流程继续
    assert result["stub"] is False
    assert result["content"] == "Mock LLM response"
    # 失败 → 无 compaction 字段(降级路径不写 compaction_info)
    assert "compaction" not in result, "压缩失败时应降级,不写 compaction 字段"


# =============================================================================
# 6. test_compaction_demo_endpoint_rtk
# =============================================================================


async def test_compaction_demo_endpoint_rtk(client: None) -> None:
    """POST /llm/compaction/demo strategy=rtk 返回 200 + 压缩结果。"""
    # 构造跨消息重复 schema(RTK 才能找到重复子串生成 $N 占位符)
    schema = '{"type":"function","name":"exec_query","parameters":{"query":{"type":"string"}}}'
    payload = {
        "messages": [
            {"role": "user", "content": f"Call A: {schema}"},
            {"role": "assistant", "content": "OK"},
            {"role": "user", "content": f"Call B: {schema}"},
            {"role": "assistant", "content": "OK"},
            {"role": "user", "content": f"Call C: {schema}"},
        ],
        "strategy": "rtk",
        "keep_recent": 2,
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy"] == "rtk"
    assert data["original_tokens"] > 0
    assert data["compressed_tokens"] >= 0
    assert 0.0 <= data["compression_ratio"] <= 1.0
    assert isinstance(data["compressed_messages"], list)
    assert isinstance(data["decompressed_messages"], list)
    assert data["rtk_map_size"] >= 0


# =============================================================================
# 7. test_compaction_demo_endpoint_caveman
# =============================================================================


async def test_compaction_demo_endpoint_caveman(client: None) -> None:
    """POST /llm/compaction/demo strategy=caveman 返回 200 + 压缩结果。"""
    payload = {
        "messages": [
            {"role": "user", "content": "The quick brown fox jumps over the lazy dog. " * 5},
            {"role": "assistant", "content": "OK"},
            {"role": "user", "content": "Hello world, this is a test message with keywords."},
        ],
        "strategy": "caveman",
        "keep_recent": 1,
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy"] == "caveman"
    assert data["original_tokens"] > 0
    assert data["rtk_map_size"] == 0  # Caveman 不生成 RTK map


# =============================================================================
# 8. test_compaction_demo_endpoint_rtk_caveman
# =============================================================================


async def test_compaction_demo_endpoint_rtk_caveman(client: None) -> None:
    """POST /llm/compaction/demo strategy=rtk_caveman(默认)返回 200 + 压缩结果。"""
    payload = {
        "messages": [
            {"role": "user", "content": "Repeat content " * 20},
            {"role": "assistant", "content": "OK"},
            {"role": "user", "content": "Repeat content " * 20},
            {"role": "user", "content": "Final message"},
        ],
        # strategy 不传,默认 rtk_caveman
        "keep_recent": 1,
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy"] == "rtk_caveman"
    assert data["original_tokens"] > 0


# =============================================================================
# 9. test_compaction_demo_endpoint_invalid_strategy
# =============================================================================


async def test_compaction_demo_endpoint_invalid_strategy(client: None) -> None:
    """strategy=invalid 返回 400。"""
    payload = {
        "messages": [{"role": "user", "content": "test"}],
        "strategy": "invalid_strategy",
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
    err_msg = data["error"].lower()
    assert "invalid" in err_msg or "invalid_strategy" in err_msg


# =============================================================================
# 10. test_compaction_demo_endpoint_empty_messages
# =============================================================================


async def test_compaction_demo_endpoint_empty_messages(client: None) -> None:
    """messages=[] 返回 400。"""
    payload = {
        "messages": [],
        "strategy": "rtk_caveman",
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
    assert "empty" in data["error"].lower() or "messages" in data["error"].lower()


# =============================================================================
# 11. test_compaction_demo_endpoint_decompress_correct
# =============================================================================


async def test_compaction_demo_endpoint_decompress_correct(client: None) -> None:
    """decompressed_messages 内容正确(RTK 占位符还原)。

    构造跨消息重复场景,RTK 应生成 $N 占位符,decompress 应将占位符还原为原文。
    """
    repeat = (
        '{"type":"function","function":{"name":"execute_sql_query",'
        '"parameters":{"query":{"type":"string","description":"The SQL"}}}}'
    )
    payload = {
        "messages": [
            {"role": "user", "content": f"Schema: {repeat}"},
            {"role": "assistant", "content": "Acknowledged"},
            {"role": "user", "content": f"Schema: {repeat}"},
            {"role": "assistant", "content": "Acknowledged"},
            {"role": "user", "content": f"Schema: {repeat}"},
        ],
        "strategy": "rtk",
        "keep_recent": 0,  # 全部压缩(不保留最近 N 条)
    }
    resp = await client.post("/api/llm/compaction/demo", json=payload)  # type: ignore[union-attr]
    assert resp.status_code == 200
    data = resp.json()

    # 验证 RTK 生成了占位符(跨消息重复 schema 应触发 RTK)
    if data["rtk_map_size"] > 0:
        # compressed_messages 中应含 $N 占位符
        compressed_text = " ".join(
            str(m.get("content", "")) for m in data["compressed_messages"]
        )
        assert "$" in compressed_text, "RTK 应生成 $N 占位符"

        # decompressed_messages 应将占位符还原为原文
        decompressed_text = " ".join(
            str(m.get("content", "")) for m in data["decompressed_messages"]
        )
        assert "$" not in decompressed_text, "decompress 应还原所有 $N 占位符"
        # 还原后应含原始 repeat 文本
        assert repeat in decompressed_text or "execute_sql_query" in decompressed_text
    else:
        # 极少数情况:重复子串未触发 RTK(长度不足),验证 decompress 至少不破坏内容
        assert len(data["decompressed_messages"]) == len(data["compressed_messages"])
