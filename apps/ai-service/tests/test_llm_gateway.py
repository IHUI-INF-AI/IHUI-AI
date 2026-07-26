"""LLMGateway.structured_completion() 单元测试(G2 字典化闭环 PoC)。

测试覆盖:
- 正常返回:LLM 返回符合 schema 的 JSON → 直接 dict 返回
- 字段校验:缺 required 字段 → 重试 → 最终 error
- 字段校验:额外字段(additionalProperties: False) → 重试 → 最终 error
- JSON 解析失败 → 重试 → 最终 error
- stub 模式 → 立即 error(stub 不可用)
- LLM 异常 → 重试 → 最终 error
- LLM 空内容 → 重试 → 最终 error
- 第一次失败第二次成功 → 返回第二次结果
- max_retries=0 单次调用失败 → 立即 error
- response_format 构造正确性(传给 complete 的参数)
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.llm_gateway import LLMGateway


# ── fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def gateway() -> LLMGateway:
    return LLMGateway()


@pytest.fixture
def sample_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
        },
        "required": ["name"],
        "additionalProperties": False,
    }


# ── helper ───────────────────────────────────────────────────────────────

def _make_complete_result(content: str, error: bool = False, stub: bool = False) -> dict[str, Any]:
    return {
        "content": content,
        "model": "gpt-4o",
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        "stub": stub,
        "error": error,
        "error_message": "test error" if error else "",
    }


# ── 正常路径 ──────────────────────────────────────────────────────────────

class TestStructuredCompletionSuccess:
    @pytest.mark.asyncio
    async def test_returns_parsed_dict_on_valid_json(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Alice", "age": 30})
        ))):
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert result == {"name": "Alice", "age": 30}

    @pytest.mark.asyncio
    async def test_missing_optional_field_ok(self, gateway, sample_schema):
        """age 是 optional,缺 age 但有 name 仍合法。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Bob"})
        ))):
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert result == {"name": "Bob"}

    @pytest.mark.asyncio
    async def test_strips_whitespace_around_content(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            f"  \n  {json.dumps({'name': 'Carol'})}  \n"
        ))):
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert result == {"name": "Carol"}


# ── 校验失败路径 ──────────────────────────────────────────────────────────

class TestStructuredCompletionValidation:
    @pytest.mark.asyncio
    async def test_missing_required_field_retries_then_errors(self, gateway, sample_schema):
        """缺 name → 第 1 次 fail → 重试 1 次 → 第 2 次仍 fail → error。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"age": 25})  # 缺 name
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        # max_retries=1,总调用次数 = 1+1 = 2
        assert mock_complete.call_count == 2
        assert result.get("error") is True
        assert "missing required fields" in result.get("error_message", "")
        assert "name" in result.get("error_message", "")

    @pytest.mark.asyncio
    async def test_extra_field_rejected_with_additionalProperties_false(self, gateway, sample_schema):
        """additionalProperties: False 时,extra field 应被拒。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Eve", "extra_key": "forbidden"})
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result.get("error") is True
        assert "unexpected fields" in result.get("error_message", "")
        assert "extra_key" in result.get("error_message", "")

    @pytest.mark.asyncio
    async def test_extra_field_allowed_without_additionalProperties_false(self, gateway):
        """schema 不声明 additionalProperties: False 时,extra field 应被接受。"""
        schema = {
            "type": "object",
            "properties": {"x": {"type": "string"}},
            "required": ["x"],
        }
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"x": "ok", "anything": "ok"})
        ))):
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=schema,
            )
        assert result == {"x": "ok", "anything": "ok"}

    @pytest.mark.asyncio
    async def test_invalid_json_retries_then_errors(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            "{ invalid json :::"
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result.get("error") is True
        assert "JSON 解析失败" in result.get("error_message", "")

    @pytest.mark.asyncio
    async def test_empty_content_retries_then_errors(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(""))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result.get("error") is True
        assert "空内容" in result.get("error_message", "")


# ── 重试机制 ──────────────────────────────────────────────────────────────

class TestStructuredCompletionRetry:
    @pytest.mark.asyncio
    async def test_first_fails_second_succeeds(self, gateway, sample_schema):
        """第 1 次缺 name 失败,第 2 次成功 → 返回第 2 次结果。"""
        responses = [
            _make_complete_result(json.dumps({"age": 1})),  # fail
            _make_complete_result(json.dumps({"name": "Dave"})),  # ok
        ]
        with patch.object(gateway, "complete", new=AsyncMock(side_effect=responses)) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result == {"name": "Dave"}

    @pytest.mark.asyncio
    async def test_max_retries_0_single_call(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"age": 1})
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
                max_retries=0,
            )
        # max_retries=0 → 1 次调用
        assert mock_complete.call_count == 1
        assert result.get("error") is True

    @pytest.mark.asyncio
    async def test_max_retries_3_four_calls(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"age": 1})
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
                max_retries=3,
            )
        # max_retries=3 → 4 次调用
        assert mock_complete.call_count == 4
        assert result.get("error") is True


# ── stub 模式 + 异常 ──────────────────────────────────────────────────────

class TestStructuredCompletionStubAndErrors:
    @pytest.mark.asyncio
    async def test_stub_mode_returns_error_immediately(self, gateway, sample_schema):
        """stub 模式下 LLM 不可用,应立即 error(不重试)。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            "[stub] ...", stub=True
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        # stub 应被识别为不可用,直接 error
        assert result.get("error") is True

    @pytest.mark.asyncio
    async def test_llm_raises_exception_retries_then_errors(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(side_effect=RuntimeError("LLM down"))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result.get("error") is True
        assert "RuntimeError" in result.get("error_message", "")

    @pytest.mark.asyncio
    async def test_llm_returns_error_result(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            "", error=True
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        assert mock_complete.call_count == 2
        assert result.get("error") is True


# ── response_format 构造正确性 ───────────────────────────────────────────

class TestStructuredCompletionResponseFormat:
    @pytest.mark.asyncio
    async def test_passes_correct_response_format(self, gateway, sample_schema):
        """验证传给 complete() 的 response_format 结构正确。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Frank"})
        ))) as mock_complete:
            await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
                schema_name="my_custom_schema",
            )
        call_kwargs = mock_complete.call_args.kwargs
        rf = call_kwargs.get("response_format")
        assert rf is not None
        assert rf["type"] == "json_schema"
        assert rf["json_schema"]["name"] == "my_custom_schema"
        assert rf["json_schema"]["schema"] == sample_schema
        assert rf["json_schema"]["strict"] is True

    @pytest.mark.asyncio
    async def test_default_schema_name(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Gina"})
        ))) as mock_complete:
            await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        rf = mock_complete.call_args.kwargs["response_format"]
        assert rf["json_schema"]["name"] == "structured_response"

    @pytest.mark.asyncio
    async def test_passes_model_and_owner_uuid(self, gateway, sample_schema):
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Hank"})
        ))) as mock_complete:
            await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
                model="claude-3-5-sonnet",
                owner_uuid="user-123",
            )
        assert mock_complete.call_args.kwargs.get("model") == "claude-3-5-sonnet"
        assert mock_complete.call_args.kwargs.get("owner_uuid") == "user-123"


# ── 解析失败重试对比(G2 验证标准)────────────────────────────────────────

class TestParseFailureComparison:
    """G2 验证标准:解析失败重试对比(原 vs 新)"""

    @pytest.mark.asyncio
    async def test_strict_mode_catches_more_errors_than_loose(self, gateway, sample_schema):
        """strict 模式(structured_completion)相比宽松解析(markdown 剥离 + try/except),
        能多拦截 'extra fields' 和 'missing required fields' 两类错误。"""
        # extra field 场景
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Ivy", "rogue_field": "bad"})
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        # 旧 _parse_tasks_json 会接受任何 dict,不会拒绝 rogue_field
        # 新 structured_completion 拒收 → error
        assert result.get("error") is True
        assert "unexpected fields" in result.get("error_message", "")

    @pytest.mark.asyncio
    async def test_zero_parse_cost_path(self, gateway, sample_schema):
        """正常路径:无 markdown 剥离 / 无 JSON 修复 / 无 try/except,直接 json.loads 成功。"""
        with patch.object(gateway, "complete", new=AsyncMock(return_value=_make_complete_result(
            json.dumps({"name": "Jane"})
        ))) as mock_complete:
            result = await gateway.structured_completion(
                [{"role": "user", "content": "hi"}],
                schema=sample_schema,
            )
        # 直接返回 parsed,无 try/except 触发
        assert "error" not in result
        assert result == {"name": "Jane"}
