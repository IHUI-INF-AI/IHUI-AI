"""ModelSyncService 纯函数单元测试(2026-07-31 立,F3 元数据增强配套)。

覆盖 _parse_price / _extract_display_name / _extract_pricing /
_extract_context_length / _classify_model / _apply_alias 等纯函数,
不依赖 DB / 网络 / asyncio。

F3 接口未实现时,_parse_price 测试正常运行,其他测试用 skipif 自动跳过;
F3 接口实现后(另一个 subagent 完成重构),所有测试自动启用,无需修改本文件。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.model_sync import ModelSyncService


# =============================================================================
# F3 接口存在性检测(用于 skipif 智能跳过)
# =============================================================================

_F3_DISPLAY_NAME_READY: bool = hasattr(ModelSyncService, "_extract_display_name")
_F3_PRICING_READY: bool = hasattr(ModelSyncService, "_extract_pricing")
_F3_CONTEXT_LENGTH_READY: bool = hasattr(ModelSyncService, "_extract_context_length")
_F3_CLASSIFY_READY: bool = hasattr(ModelSyncService, "_classify_model")
_F3_ALIAS_READY: bool = hasattr(ModelSyncService, "_apply_alias")

_skip_if_no_display_name = pytest.mark.skipif(
    not _F3_DISPLAY_NAME_READY, reason="等待 F3 实现 _extract_display_name"
)
_skip_if_no_pricing = pytest.mark.skipif(
    not _F3_PRICING_READY, reason="等待 F3 实现 _extract_pricing"
)
_skip_if_no_context_length = pytest.mark.skipif(
    not _F3_CONTEXT_LENGTH_READY, reason="等待 F3 实现 _extract_context_length"
)
_skip_if_no_classify = pytest.mark.skipif(
    not _F3_CLASSIFY_READY, reason="等待 F3 实现 _classify_model"
)
_skip_if_no_alias = pytest.mark.skipif(
    not _F3_ALIAS_READY, reason="等待 F3 实现 _apply_alias"
)


# =============================================================================
# _parse_price(原方法,已存在)— $/token -> cents/1k tokens
# =============================================================================


class TestParsePrice:
    """测试 _parse_price:上游 pricing 字段($/token)-> cents/1k tokens 整数。

    转换公式:$/token x 1000 tokens x 100 cents/$ = cents/1k tokens。
    小于 1 cent 的价格通过 int() 截断为 0(整数存储限制)。
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            # OpenRouter 典型 $/token 字符串
            ("0.00000025", 0),
            ("0.0000005", 0),
            ("0.0001", 10),
            ("0.0002", 20),
            ("0.001", 100),
            ("0.01", 1000),
            ("0", 0),
            # 数值类型(部分 provider 返回 float 而非 str)
            (0.0001, 10),
            (0.00000025, 0),
            (0, 0),
            # 异常输入 -> 0(TypeError / ValueError 兜底)
            (None, 0),
            ("", 0),
            ("not-a-number", 0),
            ([], 0),
            ({}, 0),
        ],
    )
    def test_parse_price(self, raw: Any, expected: int) -> None:
        """$/token 输入 -> cents/1k tokens 整数输出。"""
        result = ModelSyncService._parse_price(raw)
        assert result == expected

    def test_parse_price_return_type_is_int(self) -> None:
        """返回值必须是 int(非 float / str)。"""
        result = ModelSyncService._parse_price("0.0001")
        assert isinstance(result, int)
        assert not isinstance(result, bool)

# =============================================================================
# _extract_display_name(F3 待实现)
# =============================================================================


@_skip_if_no_display_name
class TestExtractDisplayName:
    """测试 display_name 智能派生(F3 元数据增强)。

    - 优先用 raw_name(若上游提供 name 字段)
    - 否则从 model_id 派生:按 -/_// 分割后用空格连接、首字母大写、品牌词归一化
    - 注意:_extract_display_name 不剥离 provider 前缀(那是 _apply_alias 职责),
      调用方传入的是已剥离前缀的 aliased_id(见 model_sync.py 第 601 行)
    """

    @pytest.mark.parametrize(
        "model_id,raw_name,expected",
        [
            # 实现:按 -/_// 分割后用空格 join,所以 gpt-4o → "GPT 4o"(非 "GPT-4o")
            ("gpt-4o-mini", None, "GPT 4o Mini"),
            ("claude-3-5-sonnet", None, "Claude 3.5 Sonnet"),
            ("llama-3.3-70b-instruct", None, "Llama 3.3 70B Instruct"),
            ("gpt-4o", None, "GPT 4o"),
            ("step-router-v1", "Step Router v1", "Step Router v1"),
        ],
    )
    def test_extract_display_name(
        self, model_id: str, raw_name: str | None, expected: str
    ) -> None:
        """model_id + raw_name -> display_name。"""
        result = ModelSyncService._extract_display_name(model_id, raw_name)
        assert result == expected

    def test_extract_display_name_returns_str(self) -> None:
        """返回值必须是 str。"""
        result = ModelSyncService._extract_display_name("gpt-4o", None)
        assert isinstance(result, str)


# =============================================================================
# _extract_pricing(F3 待实现)
# =============================================================================


@_skip_if_no_pricing
class TestExtractPricing:
    """测试 pricing 提取:多 provider 格式统一为 (input_cents, output_cents) per 1k tokens。

    支持的 provider 格式:
    - OpenRouter:pricing.prompt / completion($/token 字符串)
    - Cloudflare:pricing.input / output(数值 $/token)
    - NVIDIA:metadata.input_cost_per_token / output_cost_per_token(数值)
    - 无 pricing:返回 (0, 0)
    """

    @pytest.mark.parametrize(
        "provider_code,model,expected",
        [
            (
                "openrouter",
                {"pricing": {"prompt": "0.00000025", "completion": "0.0000005"}},
                (0, 0),
            ),
            (
                "openrouter",
                {"pricing": {"prompt": "0.0001", "completion": "0.0002"}},
                (10, 20),
            ),
            (
                "cloudflare_workers_ai",
                {"pricing": {"input": 0.00000025, "output": 0.0000005}},
                (0, 0),
            ),
            (
                "nvidia_nim",
                {
                    "metadata": {
                        "input_cost_per_token": 0.0001,
                        "output_cost_per_token": 0.0002,
                    }
                },
                (10, 20),
            ),
            ("openai", {}, (0, 0)),
        ],
    )
    def test_extract_pricing(
        self, provider_code: str, model: dict, expected: tuple[int, int]
    ) -> None:
        """多 provider 格式 -> 统一 (input_cents, output_cents)。"""
        result = ModelSyncService._extract_pricing(provider_code, model)
        assert result == expected

    def test_extract_pricing_returns_tuple_of_int(self) -> None:
        """返回值必须是 tuple[int, int]。"""
        result = ModelSyncService._extract_pricing("openai", {})
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert all(isinstance(v, int) and not isinstance(v, bool) for v in result)

# =============================================================================
# _extract_context_length(F3 待实现)
# =============================================================================


@_skip_if_no_context_length
class TestExtractContextLength:
    """测试 context_length 提取:多字段 fallback 链。

    支持的字段优先级(按 provider 出现频率):
    - context_length(OpenAI / OpenRouter)
    - context_window(部分 provider)
    - top_provider.context_length(OpenRouter 嵌套)
    - max_input_tokens(Anthropic 风格)
    - metadata.max_input_tokens(NVIDIA 风格)
    - 默认值:32000
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            ({"context_length": 128000}, 128000),
            ({"context_window": 64000}, 64000),
            ({"top_provider": {"context_length": 131072}}, 131072),
            ({"max_input_tokens": 8192}, 8192),
            ({"metadata": {"max_input_tokens": 16384}}, 16384),
            ({}, 32000),
        ],
    )
    def test_extract_context_length(self, model: dict, expected: int) -> None:
        """多字段 fallback -> context_length 整数。"""
        result = ModelSyncService._extract_context_length(model)
        assert result == expected

    def test_extract_context_length_returns_int(self) -> None:
        """返回值必须是 int。"""
        result = ModelSyncService._extract_context_length({})
        assert isinstance(result, int)
        assert not isinstance(result, bool)

    def test_extract_context_length_default_is_32000(self) -> None:
        """无任何 context 字段时返回默认 32000。"""
        assert ModelSyncService._extract_context_length({}) == 32000


# =============================================================================
# _classify_model(F3 待实现)
# =============================================================================


@_skip_if_no_classify
class TestClassifyModel:
    """测试模型分类:基于 model_id 关键词推断能力标签 list[str]。

    实现按 vision -> tool -> reasoning -> fast -> embedding/chat 顺序追加标签:
    - vision: id 含 vision/vl/image/multimodal
    - reasoning: id 含 o1/o3/o4/reasoning/think/r1/qwq
    - fast: id 含 mini/flash/small/tiny/nano/8b/7b/3b/1b(小模型 = fast)
    - embedding: id 含 embed/embedding/e5/bge(embedding 模型不加 chat)
    - chat: 默认标签(所有非 embedding 模型)
    """

    @pytest.mark.parametrize(
        "model_id,raw_model,expected",
        [
            # 实现按 vision->tool->reasoning->fast->embedding/chat 顺序追加标签
            ("gpt-4o", {}, ["chat"]),
            ("gpt-4o-vision", {}, ["vision", "chat"]),
            ("claude-3-5-sonnet", {}, ["chat"]),
            ("o1-mini", {}, ["reasoning", "fast", "chat"]),
            ("llama-3.3-70b-instruct", {}, ["chat"]),
            # "small" 命中 fast 规则(小模型 = fast),embedding 模型不加 chat
            ("text-embedding-3-small", {}, ["fast", "embedding"]),
            ("gpt-4o-mini", {}, ["fast", "chat"]),
        ],
    )
    def test_classify_model(
        self, model_id: str, raw_model: dict, expected: list[str]
    ) -> None:
        """model_id 关键词 -> 能力标签 list。"""
        result = ModelSyncService._classify_model(model_id, raw_model)
        assert result == expected

    def test_classify_model_returns_list_of_str(self) -> None:
        """返回值必须是 list[str]。"""
        result = ModelSyncService._classify_model("gpt-4o", {})
        assert isinstance(result, list)
        assert all(isinstance(tag, str) for tag in result)

    def test_classify_model_embedding_excludes_chat(self) -> None:
        """embedding 模型不应同时标 chat(语义互斥)。"""
        result = ModelSyncService._classify_model("text-embedding-3-small", {})
        assert "embedding" in result
        assert "chat" not in result

# =============================================================================
# _apply_alias(F3 待实现)
# =============================================================================


@_skip_if_no_alias
class TestApplyAlias:
    """测试别名应用:剥离 provider 前缀 + 返回是否被剥离。

    规则:
    - openrouter provider:model_id 含 "/" -> 剥离前缀,返回 (stripped, True)
    - 其他 provider:不剥离,返回 (original, False)
    """

    @pytest.mark.parametrize(
        "model_id,provider_code,expected",
        [
            ("openai/gpt-4o", "openrouter", ("gpt-4o", True)),
            ("anthropic/claude-3-5-sonnet", "openrouter", ("claude-3-5-sonnet", True)),
            ("gpt-4o", "openai", ("gpt-4o", False)),
            ("step-router-v1", "stepfun", ("step-router-v1", False)),
        ],
    )
    def test_apply_alias(
        self, model_id: str, provider_code: str, expected: tuple[str, bool]
    ) -> None:
        """provider_code + model_id -> (resolved_id, is_alias_stripped)。"""
        result = ModelSyncService._apply_alias(model_id, provider_code)
        assert result == expected

    def test_apply_alias_returns_tuple(self) -> None:
        """返回值必须是 tuple[str, bool]。"""
        result = ModelSyncService._apply_alias("gpt-4o", "openai")
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], bool)