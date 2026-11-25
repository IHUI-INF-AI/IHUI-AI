# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ModelSyncService 纯函数单元测试(2026-07-31 立,F3 元数据增强配套)。

覆盖 _parse_price / _extract_display_name / _extract_pricing /
_extract_context_length / _classify_model / _apply_alias 等纯函数,
不依赖 DB / 网络 / asyncio。

F3 接口未实现时,_parse_price 测试正常运行,其他测试用 skipif 自动跳过;
F3 接口实现后(另一个 subagent 完成重构),所有测试自动启用,无需修改本文件。

v3 扩展(2026-07-31 立,深度优化 v3 配套):
- TestExtractDescription / TestExtractVendor / TestExtractMaxOutputTokens
- TestExtractSupportsToolCall / TestExtractSupportsVision
- TestExtractRateLimit / TestExtractReleaseDate / TestExtractDeprecationDate
- TestClassifyError(SyncErrorType 错误分类,_classify_http_error)
- TestProviderLock(provider 级别并发锁)
- TestHealthTracking(连续失败计数 + 永久禁用,_bump_failure + get_health)
- TestAnthropicAdapter / TestGeminiAdapter(provider 适配器)
- TestIncrementalSync(ETag/Last-Modified 增量同步)

v3 实现与任务清单假设的差异(已在测试中适配实际实现):
- 方法名 _classify_http_error(status_code)(非 _classify_error(httpx_error))
- 方法名 _bump_failure(provider_code)(非 _record_failure(provider_code, error_type))
- _fetch_upstream_models 返回 (models, skip_upsert) 元组(非纯 list)
- _extract_max_output_tokens 默认 0(保守:不假设默认值)
- _extract_supports_tool_call 默认 True(provider 支持 tools 则模型也支持)
- _extract_vendor 含 "/" 的 model_id 按前缀取 vendor(anthropic/claude-... → anthropic)
"""

from __future__ import annotations

import asyncio
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
# v3 接口存在性检测(2026-07-31 立,深度优化 v3 元数据/错误分类/并发锁/健康追踪配套)
# =============================================================================

_F3_DESCRIPTION_READY: bool = hasattr(ModelSyncService, "_extract_description")
_F3_VENDOR_READY: bool = hasattr(ModelSyncService, "_extract_vendor")
_F3_MAX_OUTPUT_TOKENS_READY: bool = hasattr(ModelSyncService, "_extract_max_output_tokens")
_F3_SUPPORTS_TOOL_CALL_READY: bool = hasattr(ModelSyncService, "_extract_supports_tool_call")
_F3_SUPPORTS_VISION_READY: bool = hasattr(ModelSyncService, "_extract_supports_vision")
_F3_RATE_LIMIT_READY: bool = hasattr(ModelSyncService, "_extract_rate_limit")
_F3_RELEASE_DATE_READY: bool = hasattr(ModelSyncService, "_extract_release_date")
_F3_DEPRECATION_DATE_READY: bool = hasattr(ModelSyncService, "_extract_deprecation_date")
# v3 实际方法名为 _classify_http_error(status_code)(非任务清单的 _classify_error)
_F3_CLASSIFY_ERROR_READY: bool = hasattr(ModelSyncService, "_classify_http_error")
_F3_PROVIDER_LOCK_READY: bool = hasattr(ModelSyncService, "_get_provider_lock")
# v3 实际方法为 _bump_failure + get_health(非 _record_failure/_record_success/_is_provider_disabled)
_F3_HEALTH_READY: bool = all(
    hasattr(ModelSyncService, m) for m in ("_bump_failure", "get_health")
)

# SyncErrorType 枚举(v3 错误分类配套;未实现时用字符串 fallback 避免参数化收集期 AttributeError)
try:
    from app.services.model_sync import SyncErrorType as _SyncErrorType  # type: ignore[assignment]
    _SYNC_ERROR_TYPE_READY: bool = True
except ImportError:
    _SyncErrorType = None  # type: ignore[assignment]
    _SYNC_ERROR_TYPE_READY = False

# Anthropic / Gemini 适配 + ETag 增量同步(通过 _fetch_upstream_models 源码关键字检测)
import inspect as _inspect

try:
    _FETCH_SRC: str = _inspect.getsource(ModelSyncService._fetch_upstream_models)
except (OSError, TypeError):
    _FETCH_SRC = ""

_F3_ANTHROPIC_ADAPTER_READY: bool = (
    "x-api-key" in _FETCH_SRC or "anthropic-version" in _FETCH_SRC
)
_F3_GEMINI_ADAPTER_READY: bool = "v1beta" in _FETCH_SRC
_F3_INCREMENTAL_SYNC_READY: bool = (
    hasattr(ModelSyncService, "_provider_etag")
    or "if-none-match" in _FETCH_SRC.lower()
    or "etag" in _FETCH_SRC.lower()
)

# SyncErrorType 常量(枚举存在时用真实枚举,否则用字符串 fallback 供参数化收集)
if _SYNC_ERROR_TYPE_READY:
    _SE_INVALID_KEY = _SyncErrorType.INVALID_KEY  # type: ignore[union-attr]
    _SE_FORBIDDEN = _SyncErrorType.FORBIDDEN  # type: ignore[union-attr]
    _SE_NOT_FOUND = _SyncErrorType.NOT_FOUND  # type: ignore[union-attr]
    _SE_RATE_LIMIT = _SyncErrorType.RATE_LIMIT  # type: ignore[union-attr]
    _SE_SERVER_ERROR = _SyncErrorType.SERVER_ERROR  # type: ignore[union-attr]
    _SE_NETWORK = _SyncErrorType.NETWORK  # type: ignore[union-attr]
    _SE_UNKNOWN = _SyncErrorType.UNKNOWN  # type: ignore[union-attr]
else:
    _SE_INVALID_KEY = "invalid_key"
    _SE_FORBIDDEN = "forbidden"
    _SE_NOT_FOUND = "not_found"
    _SE_RATE_LIMIT = "rate_limit"
    _SE_SERVER_ERROR = "server_error"
    _SE_NETWORK = "network"
    _SE_UNKNOWN = "unknown"

_skip_if_no_description = pytest.mark.skipif(
    not _F3_DESCRIPTION_READY, reason="等待 v3 实现 _extract_description"
)
_skip_if_no_vendor = pytest.mark.skipif(
    not _F3_VENDOR_READY, reason="等待 v3 实现 _extract_vendor"
)
_skip_if_no_max_output_tokens = pytest.mark.skipif(
    not _F3_MAX_OUTPUT_TOKENS_READY, reason="等待 v3 实现 _extract_max_output_tokens"
)
_skip_if_no_supports_tool_call = pytest.mark.skipif(
    not _F3_SUPPORTS_TOOL_CALL_READY, reason="等待 v3 实现 _extract_supports_tool_call"
)
_skip_if_no_supports_vision = pytest.mark.skipif(
    not _F3_SUPPORTS_VISION_READY, reason="等待 v3 实现 _extract_supports_vision"
)
_skip_if_no_rate_limit = pytest.mark.skipif(
    not _F3_RATE_LIMIT_READY, reason="等待 v3 实现 _extract_rate_limit"
)
_skip_if_no_release_date = pytest.mark.skipif(
    not _F3_RELEASE_DATE_READY, reason="等待 v3 实现 _extract_release_date"
)
_skip_if_no_deprecation_date = pytest.mark.skipif(
    not _F3_DEPRECATION_DATE_READY, reason="等待 v3 实现 _extract_deprecation_date"
)
_skip_if_no_classify_error = pytest.mark.skipif(
    not (_F3_CLASSIFY_ERROR_READY and _SYNC_ERROR_TYPE_READY),
    reason="等待 v3 实现 _classify_http_error + SyncErrorType",
)
_skip_if_no_provider_lock = pytest.mark.skipif(
    not _F3_PROVIDER_LOCK_READY, reason="等待 v3 实现 _get_provider_lock"
)
_skip_if_no_health = pytest.mark.skipif(
    not (_F3_HEALTH_READY and _SYNC_ERROR_TYPE_READY),
    reason="等待 v3 实现 _bump_failure/get_health + SyncErrorType",
)
_skip_if_no_anthropic_adapter = pytest.mark.skipif(
    not _F3_ANTHROPIC_ADAPTER_READY, reason="等待 v3 实现 Anthropic /v1/models 适配"
)
_skip_if_no_gemini_adapter = pytest.mark.skipif(
    not _F3_GEMINI_ADAPTER_READY, reason="等待 v3 实现 Gemini /v1beta/models 适配"
)
_skip_if_no_incremental_sync = pytest.mark.skipif(
    not _F3_INCREMENTAL_SYNC_READY, reason="等待 v3 实现 ETag/Last-Modified 增量同步"
)


# =============================================================================
# v4 接口存在性检测(2026-07-31 立,深度优化 v4 运维控制配套)
# =============================================================================

_F5_RESET_PROVIDER_READY: bool = hasattr(ModelSyncService, "reset_provider")
_F5_UPDATE_CONFIG_READY: bool = hasattr(ModelSyncService, "update_config")
_F5_AGGREGATED_STATS_READY: bool = hasattr(ModelSyncService, "get_aggregated_stats")
_F5_CLEANUP_OLD_LOGS_READY: bool = hasattr(ModelSyncService, "cleanup_old_logs")

_skip_if_no_reset_provider = pytest.mark.skipif(
    not _F5_RESET_PROVIDER_READY, reason="等待 F5 实现 reset_provider"
)
_skip_if_no_update_config = pytest.mark.skipif(
    not _F5_UPDATE_CONFIG_READY, reason="等待 F5 实现 update_config"
)
_skip_if_no_aggregated_stats = pytest.mark.skipif(
    not _F5_AGGREGATED_STATS_READY, reason="等待 F5 实现 get_aggregated_stats"
)
_skip_if_no_cleanup_old_logs = pytest.mark.skipif(
    not _F5_CLEANUP_OLD_LOGS_READY, reason="等待 F5 实现 cleanup_old_logs"
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
            # xAI:单位 1e-10 USD/token(12500 = $1.25/1M)。0.125 cents/1k 必须保留小数,
            # 取整会变 0 = 免费档
            (
                "xai",
                {"prompt_text_token_price": 12500, "completion_text_token_price": 25000},
                (0.125, 0.25),
            ),
            (
                "xai",
                {"prompt_text_token_price": 20000, "completion_text_token_price": 60000},
                (0.2, 0.6),
            ),
            # 图像/视频模型没有文本 token 价 -> (0, 0),不拿 image_price 冒充 token 价
            ("xai", {"image_price": 200000000}, (0.0, 0.0)),
            ("openai", {}, (0, 0)),
        ],
    )
    def test_extract_pricing(
        self, provider_code: str, model: dict, expected: tuple[float, float]
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
# 售价护栏(2026-11-23 立):已有成本定价的存量行,同步腿不得覆盖售价
# =============================================================================

# 利润系数与 apps/api/src/services/model-price-resolver.ts 的 PROFIT_FACTOR 同源(=3)。
# 同步腿不参与售价换算,这里仅用于钉住"受保护行售价 = 成本 × 系数"的口径。
_PRICE_PROFIT_FACTOR = 3


class _CaptureConn:
    """记录最近一次 execute 的 SQL 与参数(替代 asyncpg 连接的轻量桩)。"""

    def __init__(self) -> None:
        self.sql: str | None = None
        self.params: list[Any] = []

    async def execute(self, sql: str, *params: Any) -> None:
        self.sql = sql
        self.params = list(params)


@_skip_if_no_pricing
class TestExistingPriceGuard:
    """存量行售价护栏:成本双列均 >0 的行,同步 UPDATE 不得触碰售价列。

    背景:2026-11-23 生产事故,xAI 直连 4 行人工修正为 cost×3 后,被 ModelSyncService
    每轮同步用上游 USD 价(未乘汇率、未乘利润系数)覆盖回低值。同步职责是清单/元数据
    对齐,售价口径归定价管线与人工调价;已有成本定价的行必须受保护。
    """

    @pytest.mark.parametrize(
        "existing_cost,expected",
        [
            ((1.44, 4.32), True),
            ((0.90, 1.80), True),
            ((0, 0), False),
            ((None, None), False),
            ((1.44, None), False),
            ((None, 4.32), False),
            ((0.0, 4.32), False),
            (None, False),
        ],
    )
    def test_keep_existing_price_judgement(
        self,
        existing_cost: tuple[float | None, float | None] | None,
        expected: bool,
    ) -> None:
        """成本双列均 >0 才保留售价;任一为空/0 视为未定价,可写上游价。"""
        assert ModelSyncService._keep_existing_price(existing_cost) is expected

    def test_protected_row_update_omits_price_columns(self) -> None:
        """已有成本定价的行:UPDATE SET 不含 input/output_price_per_1k。"""
        service = ModelSyncService()
        conn = _CaptureConn()

        async def run() -> None:
            await service._update_model(
                conn,
                config_id=6,
                model_id="grok-4.5",
                ctx_len=131072,
                input_price=0.20,
                output_price=0.60,
                model_tags=["chat"],
                tags_column_exists=False,
                columns={},
                vendor="xai",
                max_output_tokens=0,
                supports_tool_call=True,
                supports_vision=False,
                description="",
                rate_limit_rpm=0,
                rate_limit_tpd=0,
                release_date="",
                deprecation_date="",
                metadata=None,
                existing_cost=(1.44, 4.32),
            )

        asyncio.run(run())
        assert conn.sql is not None
        assert "input_price_per_1k" not in conn.sql
        assert "output_price_per_1k" not in conn.sql
        # 上游 USD 价(0.20/0.60)不得进入受保护行的写参数
        assert 0.20 not in conn.params
        assert 0.60 not in conn.params

    def test_unpriced_row_update_omits_price_columns(self) -> None:
        """成本为空/0 的未定价行:UPDATE 同样不写售价列,留 0 交零价清扫链定价。

        上游价是 USD 口径(未乘汇率/利润系数),写进 CNY 分/千列会形成约 21.6 倍
        非零错价,而零价清扫链只认 ≤0 价、看不见这种错值。宁可留 0 被看见/被清扫,
        也不写错值。
        """
        service = ModelSyncService()
        conn = _CaptureConn()

        async def run() -> None:
            await service._update_model(
                conn,
                config_id=6,
                model_id="grok-imagine-image",
                ctx_len=32000,
                input_price=0.0,
                output_price=0.0,
                model_tags=["image"],
                tags_column_exists=False,
                columns={},
                vendor="xai",
                max_output_tokens=0,
                supports_tool_call=True,
                supports_vision=False,
                description="",
                rate_limit_rpm=0,
                rate_limit_tpd=0,
                release_date="",
                deprecation_date="",
                metadata=None,
                existing_cost=(0.0, 0.0),
            )

        asyncio.run(run())
        assert conn.sql is not None
        assert "input_price_per_1k" not in conn.sql
        assert "output_price_per_1k" not in conn.sql

    @pytest.mark.asyncio
    async def test_insert_model_omits_price_columns(self) -> None:
        """新行 INSERT 不写售价列:上游 USD 价不入库,留列默认 0 交清扫链定价。"""
        service = ModelSyncService()
        conn = _CaptureConn()

        await service._insert_model(
            conn,
            config_id=6,
            model_id="grok-4.9-new",
            display_name="grok-4.9-new",
            ctx_len=131072,
            input_price=0.20,
            output_price=0.60,
            model_tags=["chat"],
            tags_column_exists=False,
            columns={},
            vendor="xai",
            max_output_tokens=0,
            supports_tool_call=True,
            supports_vision=False,
            description="",
            rate_limit_rpm=0,
            rate_limit_tpd=0,
            release_date="",
            deprecation_date="",
            metadata=None,
            is_relay_public=True,
        )

        assert conn.sql is not None
        assert "input_price_per_1k" not in conn.sql
        assert "output_price_per_1k" not in conn.sql
        # 上游 USD 错值(0.20/0.60)不得进入 INSERT 参数
        assert 0.20 not in conn.params
        assert 0.60 not in conn.params
        assert conn.sql.strip().upper().startswith("INSERT")

    @pytest.mark.parametrize(
        "cost_in,cost_out,price_in,price_out",
        [
            # grok-4.3:成本 0.90/1.80 ⇒ 售价 2.70/5.40
            (0.90, 1.80, 2.70, 5.40),
            # grok-4.5/4.6/4.7:成本 1.44/4.32 ⇒ 售价 4.32/12.96
            (1.44, 4.32, 4.32, 12.96),
        ],
    )
    def test_protected_price_equals_cost_times_profit_factor(
        self,
        cost_in: float,
        cost_out: float,
        price_in: float,
        price_out: float,
    ) -> None:
        """钉住售价口径:受保护行售价必须 = 成本 × PROFIT_FACTOR(=3)。"""
        assert round(cost_in * _PRICE_PROFIT_FACTOR, 6) == round(price_in, 6)
        assert round(cost_out * _PRICE_PROFIT_FACTOR, 6) == round(price_out, 6)


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
            # 2026-10-29 xai imagine:生成式媒体档不得带 chat(否则混进对话选择器)。
            # 图像靠上游 image_price / pricing[].price_per_image 证据,视频靠 id 自述
            ("grok-imagine-video-1.5", {}, ["video"]),
            (
                "grok-imagine-image-2.0",
                {"pricing": [{"price_per_image": 400000000}]},
                ["image", "vision"],
            ),
            # 文本模型(有 prompt_text_token_price)仍按对话档
            ("grok-4.7", {"prompt_text_token_price": 20000}, ["chat"]),
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


# =============================================================================
# v3 元数据增强:_extract_description / _extract_vendor / _extract_max_output_tokens
# =============================================================================


@_skip_if_no_description
class TestExtractDescription:
    """测试 _extract_description:多 provider 格式统一为 description 字符串。

    支持的格式:
    - OpenRouter: model.description(顶层字符串)
    - NVIDIA NIM: model.metadata.description(嵌套字符串)
    - 无 description / 非字符串 / None / 空白:返回空字符串
    - 实现限制:截断到 1000 字符防 DB 溢出
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            ({"description": "GPT-4o is a multimodal model"}, "GPT-4o is a multimodal model"),
            ({"metadata": {"description": "Llama 3.3 70B Instruct"}}, "Llama 3.3 70B Instruct"),
            ({}, ""),
            ({"description": 123}, ""),
            ({"description": None}, ""),
            ({"description": ""}, ""),
            ({"description": "   "}, ""),
            ({"metadata": {}}, ""),
            ({"metadata": {"description": 456}}, ""),
        ],
    )
    def test_extract_description(self, model: dict, expected: str) -> None:
        """多字段 fallback -> description 字符串。"""
        result = ModelSyncService._extract_description(model)
        assert result == expected

    def test_extract_description_returns_str(self) -> None:
        """返回值必须是 str。"""
        result = ModelSyncService._extract_description({})
        assert isinstance(result, str)


@_skip_if_no_vendor
class TestExtractVendor:
    """测试 _extract_vendor:从 model_id 前缀 / metadata / 关键词推断 vendor。

    实现优先级:
    1. model.metadata.vendor(上游显式声明,lower())
    2. model_id 含 "/" → 取前缀作为 vendor(openai/gpt-4o → openai,
       anthropic/claude-... → anthropic,meta/llama-... → meta)
    3. model_id 关键词前缀匹配(vendor_prefixes 字典,startswith 判断)
    """

    @pytest.mark.parametrize(
        "model_id,expected",
        [
            # 含 provider 前缀 — 实现按 "/" 分割取前缀作为 vendor
            ("openai/gpt-4o", "openai"),
            ("anthropic/claude-3-5-sonnet", "anthropic"),
            ("google/gemini-1.5-flash", "google"),
            ("meta/llama-3.3-70b", "meta"),
            ("mistral/mistral-large", "mistral"),
            ("nvidia/llama-3.3-nemotron", "nvidia"),
            # 无前缀,从 model_id 关键词推断(startswith 匹配 vendor_prefixes)
            ("gpt-4o", "openai"),
            ("claude-3-5-sonnet", "anthropic"),
            ("llama-3.3-70b", "meta"),
            ("qwen2.5-7b", "alibaba"),
            ("gemini-1.5-flash", "google"),
            ("mistral-large", "mistral"),
            # 无法推断 → None(让 DB 存 NULL)
            ("unknown-model", None),
        ],
    )
    def test_extract_vendor_from_model_id(self, model_id: str, expected: str) -> None:
        """model_id 前缀 / 关键词 -> vendor。"""
        result = ModelSyncService._extract_vendor(model_id, {})
        assert result == expected

    def test_extract_vendor_from_metadata(self) -> None:
        """上游 metadata 显式提供 vendor 时优先用。"""
        result = ModelSyncService._extract_vendor(
            "test", {"metadata": {"vendor": "custom-vendor"}}
        )
        assert result == "custom-vendor"

    def test_extract_vendor_returns_str(self) -> None:
        """返回值必须是 str。"""
        result = ModelSyncService._extract_vendor("gpt-4o", {})
        assert isinstance(result, str)


@_skip_if_no_max_output_tokens
class TestExtractMaxOutputTokens:
    """测试 _extract_max_output_tokens:多字段 fallback 链。

    实现优先级:
    1. model.max_output_tokens(OpenAI 风格,int > 0)
    2. model.top_provider.max_completion_tokens(OpenRouter,int > 0)
    3. model.metadata.max_output_tokens(NVIDIA,int > 0)
    4. 默认 0(保守:不假设默认值)

    无效值(0 / 负数 / 非整数 / 缺失)fall through 到默认 0。
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            ({"max_output_tokens": 4096}, 4096),
            ({"top_provider": {"max_completion_tokens": 8192}}, 8192),
            ({"metadata": {"max_output_tokens": 16384}}, 16384),
            ({}, 0),  # 默认值 0(保守:不假设默认值)
            ({"max_output_tokens": 0}, 0),  # 0 视为无效,fall through 到默认 0
            ({"max_output_tokens": -1}, 0),  # 负数视为无效,fall through 到默认 0
            ({"max_output_tokens": "4096"}, 0),  # 非整数 fall through 到默认 0
            ({"top_provider": {}}, 0),  # 空 dict fall through 到默认 0
        ],
    )
    def test_extract_max_output_tokens(self, model: dict, expected: int) -> None:
        """多字段 fallback -> max_output_tokens 整数。"""
        result = ModelSyncService._extract_max_output_tokens(model)
        assert result == expected

    def test_extract_max_output_tokens_returns_int(self) -> None:
        """返回值必须是 int(非 bool)。"""
        result = ModelSyncService._extract_max_output_tokens({})
        assert isinstance(result, int)
        assert not isinstance(result, bool)

    def test_extract_max_output_tokens_default_is_0(self) -> None:
        """无任何 max_output_tokens 字段时返回默认 0(保守:不假设默认值)。"""
        assert ModelSyncService._extract_max_output_tokens({}) == 0


# =============================================================================
# v3 能力标签:_extract_supports_tool_call / _extract_supports_vision
# =============================================================================


@_skip_if_no_supports_tool_call
class TestExtractSupportsToolCall:
    """测试 _extract_supports_tool_call:综合判断模型是否支持工具调用。

    实现优先级:
    1. provider_caps.get_provider_cap(provider_code).supports_tools(provider 级别)
       — 若 supports_tools=False 直接返回 False
    2. model.metadata.supports_tool_calling(OpenRouter 显式声明,bool)
    3. model_id 含 tool/function/react 关键字 -> True
    4. 默认:返回 True(provider 支持 tools 则模型也支持,除非显式声明不支持)
    """

    @pytest.mark.parametrize(
        "provider_code,model_id,model,expected",
        [
            # model_id 关键词
            ("openrouter", "tool-calling-model", {}, True),
            ("openrouter", "function-call-model", {}, True),
            # metadata 显式声明
            ("openrouter", "test-model", {"metadata": {"supports_tool_calling": True}}, True),
            ("openrouter", "test-model", {"metadata": {"supports_tool_calling": False}}, False),
            # provider_caps(NVIDIA NIM 默认支持 tools)
            ("nvidia_nim", "test-model", {}, True),
            # 无显式信号时,默认 True(provider 支持 tools 则模型也支持)
            ("unknown_provider", "unknown-model", {}, True),
            ("openrouter", "gpt-4o", {}, True),
        ],
    )
    def test_extract_supports_tool_call(
        self, provider_code: str, model_id: str, model: dict, expected: bool
    ) -> None:
        """综合判断 -> bool。"""
        result = ModelSyncService._extract_supports_tool_call(provider_code, model_id, model)
        assert result == expected

    def test_extract_supports_tool_call_returns_bool(self) -> None:
        """返回值必须是 bool。"""
        result = ModelSyncService._extract_supports_tool_call("unknown", "test", {})
        assert isinstance(result, bool)


@_skip_if_no_supports_vision
class TestExtractSupportsVision:
    """测试 _extract_supports_vision:综合判断模型是否支持视觉输入。

    实现优先级:
    1. provider_caps.get_provider_cap(provider_code).supports_vision(provider 级别)
       — 若 supports_vision=True 直接返回 True
    2. model.metadata.supports_vision(上游显式声明,bool)
    3. model_id 含 vision/vl/image/multimodal 关键字 -> True
    4. 默认:返回 False
    """

    @pytest.mark.parametrize(
        "provider_code,model_id,model,expected",
        [
            # model_id 关键词
            ("openrouter", "gpt-4o-vision", {}, True),
            ("openrouter", "llama-vl", {}, True),
            ("openrouter", "image-model", {}, True),
            ("openrouter", "multimodal-model", {}, True),
            # metadata 显式声明
            ("openrouter", "test-model", {"metadata": {"supports_vision": True}}, True),
            ("openrouter", "test-model", {"metadata": {"supports_vision": False}}, False),
            # 无任何信号 -> 默认 False
            ("unknown_provider", "unknown-model", {}, False),
            ("openrouter", "gpt-4o", {}, False),
        ],
    )
    def test_extract_supports_vision(
        self, provider_code: str, model_id: str, model: dict, expected: bool
    ) -> None:
        """综合判断 -> bool。"""
        result = ModelSyncService._extract_supports_vision(provider_code, model_id, model)
        assert result == expected

    def test_extract_supports_vision_returns_bool(self) -> None:
        """返回值必须是 bool。"""
        result = ModelSyncService._extract_supports_vision("unknown", "test", {})
        assert isinstance(result, bool)


# =============================================================================
# v3 限流与日期:_extract_rate_limit / _extract_release_date / _extract_deprecation_date
# =============================================================================


@_skip_if_no_rate_limit
class TestExtractRateLimit:
    """测试 _extract_rate_limit:从 model.top_provider.rate_limit 提取 RPM/TPD。

    返回 (requests_per_minute, tokens_per_day),缺省 (0, 0)。
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            (
                {"top_provider": {"rate_limit": {"requests_per_minute": 60, "tokens_per_day": 1000000}}},
                (60, 1000000),
            ),
            ({}, (0, 0)),
            ({"top_provider": {"rate_limit": {"requests_per_minute": 30}}}, (30, 0)),
            ({"top_provider": {"rate_limit": {}}}, (0, 0)),
            ({"top_provider": {}}, (0, 0)),
        ],
    )
    def test_extract_rate_limit(self, model: dict, expected: tuple) -> None:
        """top_provider.rate_limit -> (rpm, tpd)。"""
        result = ModelSyncService._extract_rate_limit(model)
        assert result == expected

    def test_extract_rate_limit_returns_tuple_of_int(self) -> None:
        """返回值必须是 tuple[int, int]。"""
        result = ModelSyncService._extract_rate_limit({})
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert all(isinstance(v, int) and not isinstance(v, bool) for v in result)


@_skip_if_no_release_date
class TestExtractReleaseDate:
    """测试 _extract_release_date:从多字段提取发布日期(ISO 字符串)。

    实现优先级:
    1. model.created(OpenRouter/OpenAI,Unix 时间戳 int 或 ISO 字符串)
    2. model.metadata.release_date(自定义)
    3. 无 -> 空字符串
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            ({"metadata": {"release_date": "2024-10-22"}}, "2024-10-22"),
            ({"created": "2024-10-22"}, "2024-10-22"),
            ({}, ""),
            ({"metadata": {"release_date": None}}, ""),
            ({"created": None}, ""),
        ],
    )
    def test_extract_release_date(self, model: dict, expected: str) -> None:
        """多字段 fallback -> release_date 字符串。"""
        result = ModelSyncService._extract_release_date(model)
        assert result == expected

    def test_extract_release_date_returns_str(self) -> None:
        """返回值必须是 str。"""
        result = ModelSyncService._extract_release_date({})
        assert isinstance(result, str)


@_skip_if_no_deprecation_date
class TestExtractDeprecationDate:
    """测试 _extract_deprecation_date:从多字段提取弃用日期(ISO 字符串)。

    实现优先级:
    1. model.deprecation_date(顶层,OpenAI 兼容)
    2. model.metadata.deprecation_date(嵌套)
    3. 无 -> 空字符串
    """

    @pytest.mark.parametrize(
        "model,expected",
        [
            ({"deprecation_date": "2025-12-31"}, "2025-12-31"),
            ({"metadata": {"deprecation_date": "2025-12-31"}}, "2025-12-31"),
            ({}, ""),
            ({"deprecation_date": None}, ""),
            ({"metadata": {"deprecation_date": None}}, ""),
        ],
    )
    def test_extract_deprecation_date(self, model: dict, expected: str) -> None:
        """多字段 fallback -> deprecation_date 字符串。"""
        result = ModelSyncService._extract_deprecation_date(model)
        assert result == expected

    def test_extract_deprecation_date_returns_str(self) -> None:
        """返回值必须是 str。"""
        result = ModelSyncService._extract_deprecation_date({})
        assert isinstance(result, str)


# =============================================================================
# v3 错误分类:_classify_http_error + SyncErrorType
# =============================================================================


@_skip_if_no_classify_error
class TestClassifyError:
    """测试 _classify_http_error:根据 HTTP 状态码返回 SyncErrorType 分类。

    v3 实现说明:
    - 方法名 _classify_http_error(status_code)(非任务清单的 _classify_error(httpx_error))
    - 签名 (status_code: int) -> str,返回 SyncErrorType.value 字符串
    - 仅分类 HTTP 状态码,不分类 httpx 异常
      (timeout/network 在 _sync_single_provider 内直接 isinstance 判断)
    - SyncErrorType 是 str Enum,故 result == SyncErrorType.XXX 为 True

    分类规则:
    - 401 -> INVALID_KEY
    - 403 -> FORBIDDEN
    - 404 -> NOT_FOUND
    - 429 -> RATE_LIMIT
    - 5xx (500-599) -> SERVER_ERROR
    - 其他 -> UNKNOWN
    """

    @pytest.mark.parametrize(
        "status_code,expected",
        [
            (401, _SE_INVALID_KEY),
            (403, _SE_FORBIDDEN),
            (404, _SE_NOT_FOUND),
            (429, _SE_RATE_LIMIT),
            (500, _SE_SERVER_ERROR),
            (502, _SE_SERVER_ERROR),
            (503, _SE_SERVER_ERROR),
            (504, _SE_SERVER_ERROR),
            (599, _SE_SERVER_ERROR),  # 5xx 上界
            (400, _SE_UNKNOWN),
            (418, _SE_UNKNOWN),  # 未知状态码
        ],
    )
    def test_classify_http_status(self, status_code: int, expected) -> None:
        """HTTP 状态码 -> SyncErrorType。"""
        result = ModelSyncService._classify_http_error(status_code)
        assert result == expected

    def test_classify_http_error_returns_str(self) -> None:
        """返回值必须是 str(SyncErrorType.value)。"""
        result = ModelSyncService._classify_http_error(401)
        assert isinstance(result, str)

    def test_classify_http_error_returns_value_string(self) -> None:
        """返回值应为 SyncErrorType.value(纯字符串),与枚举成员相等(str Enum 特性)。"""
        result = ModelSyncService._classify_http_error(404)
        assert result == _SE_NOT_FOUND
        assert result == "not_found"  # .value


# =============================================================================
# v3 并发锁:_get_provider_lock(provider 级别串行化)
# =============================================================================


@_skip_if_no_provider_lock
class TestProviderLock:
    """测试 _get_provider_lock:Provider 级别并发锁。

    用途:v3 并发同步时,同一 provider 的同步串行化(避免重复请求 / 状态竞争),
    不同 provider 之间并发(提升吞吐)。每 provider_code 对应一个独立 asyncio.Lock。
    """

    def test_get_provider_lock_returns_same_instance(self) -> None:
        """同一 provider 多次获取返回同一 Lock 实例。"""
        service = ModelSyncService()
        lock1 = service._get_provider_lock("openrouter")
        lock2 = service._get_provider_lock("openrouter")
        assert lock1 is lock2

    def test_get_provider_lock_different_providers(self) -> None:
        """不同 provider 返回不同 Lock 实例。"""
        service = ModelSyncService()
        lock1 = service._get_provider_lock("openrouter")
        lock2 = service._get_provider_lock("nvidia_nim")
        assert lock1 is not lock2

    def test_get_provider_lock_is_asyncio_lock(self) -> None:
        """返回值必须是 asyncio.Lock 实例。"""
        service = ModelSyncService()
        lock = service._get_provider_lock("test")
        assert isinstance(lock, asyncio.Lock)


# =============================================================================
# v3 健康追踪:连续失败计数 + 永久禁用状态查询
# =============================================================================


@_skip_if_no_health
class TestHealthTracking:
    """测试健康追踪:连续失败计数 + 永久禁用状态查询。

    v3 实现说明:
    - _bump_failure(provider_code):仅递增 _provider_failure_counter,不处理永久禁用
    - get_health():返回 {failure_counters, permanently_disabled, failure_threshold}
    - 永久禁用逻辑在 _sync_single_provider(基于 error_type 判断),非独立方法
    - 未实现 _record_success / _is_provider_disabled
      (失败计数清零由成功同步流程在 _sync_single_provider 内重置)
    """

    def test_initial_health_is_clean(self) -> None:
        """新实例的健康状态应为空。"""
        service = ModelSyncService()
        health = service.get_health()
        assert health["failure_counters"] == {}
        assert health["permanently_disabled"] == []

    def test_get_health_returns_required_keys(self) -> None:
        """get_health 应返回 failure_counters / permanently_disabled / failure_threshold。"""
        service = ModelSyncService()
        health = service.get_health()
        assert "failure_counters" in health
        assert "permanently_disabled" in health
        assert "failure_threshold" in health

    def test_bump_failure_increments_counter(self) -> None:
        """_bump_failure 应递增失败计数。"""
        service = ModelSyncService()
        service._bump_failure("openrouter")
        assert service.get_health()["failure_counters"]["openrouter"] == 1
        service._bump_failure("openrouter")
        assert service.get_health()["failure_counters"]["openrouter"] == 2

    def test_bump_failure_independent_per_provider(self) -> None:
        """不同 provider 的失败计数应独立。"""
        service = ModelSyncService()
        service._bump_failure("openrouter")
        service._bump_failure("nvidia_nim")
        service._bump_failure("nvidia_nim")
        counters = service.get_health()["failure_counters"]
        assert counters["openrouter"] == 1
        assert counters["nvidia_nim"] == 2

    def test_permanently_disabled_reflected_in_health(self) -> None:
        """_permanently_disabled_providers 集合应在 get_health 中反映。"""
        service = ModelSyncService()
        service._permanently_disabled_providers.add("openrouter")
        health = service.get_health()
        assert "openrouter" in health["permanently_disabled"]


class TestLocalFilesystemErrorIsNotProviderFault:
    """本地基础设施自伤(FileNotFoundError/OSError)不得判成厂商 unhealthy。

    2026-11-16 生产事故:venv 被误删 ⇒ httpx 构造 AsyncClient 找不到 SSL CA,
    8 家厂商在建连前就抛 FileNotFoundError,落进 UNKNOWN 分支被计入失败,
    故障消退后 health 仍锁死 0、告警常亮。本类钉死修复后的触发面:
    本地文件错误属预期态静默跳过,不计失败、不永久禁用、health 保持 1。
    """

    @pytest.mark.parametrize("exc", [
        FileNotFoundError(2, "No such file or directory", "/ssl/ca.pem"),
        OSError(2, "No such file or directory"),
    ])
    def test_local_fs_error_skipped_not_unhealthy(self, exc: Exception) -> None:
        """本地文件错误 ⇒ skipped=True、无失败计数、不永久禁用。

        刻意用 asyncio.run 同步驱动:本仓测试环境装 anyio 而非 pytest-asyncio,
        @pytest.mark.asyncio 在本机未注册(既有环境事实),同步驱动才能让回归锁
        在任何环境真正 await 到逻辑,不依赖插件。
        """
        from unittest.mock import patch

        service = ModelSyncService()
        sem = asyncio.Semaphore(2)

        async def run() -> Any:
            with patch.object(service, "_fetch_upstream_models", new=_AsyncRaise(exc)):
                return await service._sync_single_provider(
                    sem, "agnes", "https://example.invalid/v1", "sk-test"
                )

        result = asyncio.run(run())
        assert result.skipped is True, "本地文件错误应走静默跳过"
        assert result.success is False
        health = service.get_health()
        assert health["failure_counters"].get("agnes", 0) == 0, "本地错误不得计入失败"
        assert "agnes" not in health["permanently_disabled"], "本地错误不得永久禁用"

    def test_real_network_error_still_counts_as_failure(self) -> None:
        """反向牙:真网络错误仍计入失败,不得被上面的静默逻辑误伤。"""
        from unittest.mock import patch

        import httpx

        service = ModelSyncService()
        sem = asyncio.Semaphore(2)
        net_err = httpx.ConnectError("connection refused")

        async def run() -> Any:
            with patch.object(service, "_fetch_upstream_models", new=_AsyncRaise(net_err)):
                return await service._sync_single_provider(
                    sem, "openrouter", "https://example.invalid/v1", "sk-test"
                )

        result = asyncio.run(run())
        # 精确边界:本修复只让"本地文件错误"走 skipped。真网络错误不得被误判为
        # 静默跳过(否则会吞掉真故障告警);其失败计数沿用既有重试/埋点逻辑。
        assert result.skipped is False, "真网络错误不得走静默跳过路径"
        assert "OSError" not in (result.error or "") and "FileNotFoundError" not in (result.error or "")


class _AsyncRaise:
    """可调用对象:await 时抛出给定异常(替代 AsyncMock 的轻量桩)。"""

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    async def __call__(self, *args: Any, **kwargs: Any) -> Any:
        raise self._exc


# =============================================================================
# v3 Provider 适配器:Anthropic / Gemini(测试 _fetch_upstream_models 的 provider 分支)
# =============================================================================


@_skip_if_no_anthropic_adapter
class TestAnthropicAdapter:
    """测试 Anthropic /v1/models 适配。

    Anthropic API 特点:
    - 端点:{base_url}/v1/models
    - Header:x-api-key + anthropic-version: 2023-06-01(非标准 Bearer)
    - 响应:{"data": [{"id": "claude-3-5-sonnet-20241022", "display_name": "...", "created_at": "..."}]}
    - _fetch_upstream_models 返回 (models, skip_upsert) 元组
    """

    @pytest.mark.asyncio
    async def test_anthropic_endpoint_and_headers(self) -> None:
        """验证调用 {base_url}/v1/models 且 header 含 x-api-key + anthropic-version。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={"data": []})
        mock_resp.headers = {}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            await service._fetch_upstream_models(
                "anthropic", "https://api.anthropic.com", "sk-ant-test"
            )
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            url = call_args.args[0] if call_args.args else call_args.kwargs.get("url", "")
            headers = call_args.kwargs.get("headers", {})
            assert "v1/models" in url
            assert headers.get("x-api-key") == "sk-ant-test"
            assert "anthropic-version" in headers

    @pytest.mark.asyncio
    async def test_anthropic_response_parsing(self) -> None:
        """验证 Anthropic 风格响应解析为模型列表(返回 (models, skip) 元组)。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={
            "data": [
                {
                    "id": "claude-3-5-sonnet-20241022",
                    "display_name": "Claude 3.5 Sonnet",
                    "created_at": "2024-10-22",
                }
            ]
        })
        mock_resp.headers = {}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
            models, skip = await service._fetch_upstream_models(
                "anthropic", "https://api.anthropic.com", "sk-ant-test"
            )
        assert len(models) == 1
        assert models[0]["id"] == "claude-3-5-sonnet-20241022"
        assert skip is False


@_skip_if_no_gemini_adapter
class TestGeminiAdapter:
    """测试 Google Gemini /v1beta/models 适配。

    Gemini API 特点:
    - 端点:{base_url}/v1beta/models,凭据走 x-goog-api-key 头(2026-11-01 起;
      原先拼在 ?key= 查询串里 ⇒ 同一枚平台密钥会随 URL 进日志/中间层访问日志)
    - 响应:{"models": [{"name": "models/gemini-1.5-flash", "displayName": "...",
              "inputTokenLimit": 1048576, "outputTokenLimit": 8192,
              "supportedGenerationMethods": ["generateContent", "countTokens"]}]}
    - 解析后: [{"id": "gemini-1.5-flash"(剥离 models/ 前缀), "context_length": 1048576, ...}]
    - _fetch_upstream_models 返回 (models, skip_upsert) 元组
    """

    @pytest.mark.asyncio
    async def test_gemini_endpoint(self) -> None:
        """验证调用 {base_url}/v1beta/models,且凭据只在头里、不在 URL 里。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={"models": []})
        mock_resp.headers = {}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            await service._fetch_upstream_models(
                "google_gemini", "https://generativelanguage.googleapis.com", "AIza-test"
            )
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            url = call_args.args[0] if call_args.args else call_args.kwargs.get("url", "")
            sent_headers = call_args.kwargs.get("headers") or {}
            assert "v1beta/models" in url
            assert "key=" not in url, f"URL 仍带凭据:{url}"
            assert sent_headers.get("x-goog-api-key") == "AIza-test", "鉴权必须仍在"

    @pytest.mark.asyncio
    async def test_gemini_response_parsing(self) -> None:
        """验证 Gemini 风格响应解析(剥离 models/ 前缀,返回 (models, skip) 元组)。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={
            "models": [
                {
                    "name": "models/gemini-1.5-flash",
                    "displayName": "Gemini 1.5 Flash",
                    "inputTokenLimit": 1048576,
                    "outputTokenLimit": 8192,
                    "supportedGenerationMethods": ["generateContent", "countTokens"],
                }
            ]
        })
        mock_resp.headers = {}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
            models, skip = await service._fetch_upstream_models(
                "google_gemini", "https://generativelanguage.googleapis.com", "AIza-test"
            )
        assert len(models) == 1
        # id 应剥离 "models/" 前缀
        assert models[0]["id"] == "gemini-1.5-flash"
        assert skip is False


# =============================================================================
# v3 增量同步:ETag / Last-Modified(304 Not Modified 跳过 upsert)
# =============================================================================


@_skip_if_no_incremental_sync
class TestIncrementalSync:
    """测试 ETag / Last-Modified 增量同步。

    机制:
    - 首次成功同步后,缓存上游返回的 ETag / Last-Modified header
      (存入 _provider_etag / _provider_last_modified 字典)
    - 下次请求携带 If-None-Match / If-Modified-Since header
    - 上游返回 304 -> 返回 ([], True)(跳过 upsert)
    - _fetch_upstream_models 返回 (models, skip_upsert) 元组
    """

    @pytest.mark.asyncio
    async def test_etag_stored_after_success(self) -> None:
        """成功响应含 ETag 时应缓存到 _provider_etag。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={"data": []})
        mock_resp.headers = {"ETag": '"abc123"'}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
            await service._fetch_upstream_models(
                "openrouter", "https://openrouter.ai/api/v1", "sk-or-test"
            )
        # ETag 应被缓存到 _provider_etag[provider_code]
        assert service._provider_etag.get("openrouter") == '"abc123"'

    @pytest.mark.asyncio
    async def test_304_skips_upsert(self) -> None:
        """304 Not Modified 响应应返回 ([], True)(跳过 upsert)。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        # 模拟已缓存 ETag(触发 If-None-Match 请求)
        service._provider_etag["openrouter"] = '"abc123"'

        mock_resp = MagicMock()
        mock_resp.status_code = 304
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={})
        mock_resp.headers = {}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
            models, skip = await service._fetch_upstream_models(
                "openrouter", "https://openrouter.ai/api/v1", "sk-or-test"
            )
        # 304 应返回空列表 + skip=True
        assert models == []
        assert skip is True

    @pytest.mark.asyncio
    async def test_last_modified_stored_after_success(self) -> None:
        """成功响应含 Last-Modified 时应缓存到 _provider_last_modified。"""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = ModelSyncService()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value={"data": []})
        mock_resp.headers = {"Last-Modified": "Wed, 22 Oct 2024 10:00:00 GMT"}
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
            await service._fetch_upstream_models(
                "openrouter", "https://openrouter.ai/api/v1", "sk-or-test"
            )
        # Last-Modified 应被缓存到 _provider_last_modified[provider_code]
        assert service._provider_last_modified.get("openrouter") == "Wed, 22 Oct 2024 10:00:00 GMT"


# =============================================================================
# v4 运维控制:reset_provider(重置 provider 失败计数 + 移除禁用 + 清缓存)
# =============================================================================


@_skip_if_no_reset_provider
class TestResetProvider:
    """F5.1 reset_provider() 单元测试。

    用途:重置 provider 失败计数 + 从永久禁用列表移除 + 清除 ETag/Last-Modified 缓存。
    返回:{"provider_code": "xxx", "reset": True, "previous_failures": N, "was_disabled": bool}
    """

    def test_reset_provider_clears_failure_counter(self) -> None:
        """重置后失败计数归零。"""
        svc = ModelSyncService()
        svc._provider_failure_counter["test_provider"] = 5
        result = svc.reset_provider("test_provider")
        assert result["provider_code"] == "test_provider"
        assert result["reset"] is True
        assert result["previous_failures"] == 5
        # 实现用 pop() 删除 key(等价于归零),用 get 兼容两种行为
        assert svc._provider_failure_counter.get("test_provider", 0) == 0

    def test_reset_provider_removes_from_disabled(self) -> None:
        """重置后从永久禁用列表移除。"""
        svc = ModelSyncService()
        svc._permanently_disabled_providers.add("test_provider")
        svc._provider_failure_counter["test_provider"] = 3
        result = svc.reset_provider("test_provider")
        assert result["was_disabled"] is True
        assert "test_provider" not in svc._permanently_disabled_providers

    def test_reset_provider_was_not_disabled(self) -> None:
        """重置未禁用的 provider,was_disabled=False。"""
        svc = ModelSyncService()
        result = svc.reset_provider("never_disabled")
        assert result["was_disabled"] is False
        assert result["previous_failures"] == 0
        assert result["reset"] is True

    def test_reset_provider_clears_etag_cache(self) -> None:
        """重置后清除 ETag/Last-Modified 缓存。"""
        svc = ModelSyncService()
        svc._provider_etag["test_provider"] = "etag123"
        svc._provider_last_modified["test_provider"] = "Mon, 01 Jan 2026 00:00:00 GMT"
        svc.reset_provider("test_provider")
        assert "test_provider" not in svc._provider_etag
        assert "test_provider" not in svc._provider_last_modified

    def test_reset_provider_idempotent(self) -> None:
        """多次重置同一 provider 不报错。"""
        svc = ModelSyncService()
        svc.reset_provider("test_provider")
        result = svc.reset_provider("test_provider")
        assert result["reset"] is True
        assert result["previous_failures"] == 0


# =============================================================================
# 上游模型目录请求的通用 mock(用于空 key 不带 Authorization 等断言)
# =============================================================================




class _MockResp:
    """模拟上游 /v1/models 响应。"""

    status_code = 200

    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload
        self.headers: dict[str, str] = {}

    def json(self) -> dict[str, Any]:
        return self._payload

    def raise_for_status(self) -> None:
        return None


class _MockAsyncClient:
    """捕获请求 URL/headers 的通用 mock AsyncClient(async context manager)。"""

    def __init__(self, payload: dict[str, Any], capture: dict[str, Any]) -> None:
        self._payload = payload
        self._capture = capture

    async def __aenter__(self) -> _MockAsyncClient:
        return self

    async def __aexit__(self, *args: Any) -> bool:
        return False

    async def get(self, url: str, headers: dict[str, str] | None = None) -> _MockResp:
        urls = self._capture.setdefault("urls", [])
        urls.append(url)
        self._capture["url"] = url
        # headers 保留首次调用(skills/models 免鉴权校验用)
        if "headers" not in self._capture:
            self._capture["headers"] = headers or {}
        return _MockResp(self._payload)


# =============================================================================
# v4 运维控制:update_config(运行时更新同步间隔 + 并发限流)
# =============================================================================


@_skip_if_no_update_config
class TestUpdateConfig:
    """F5.2 update_config() 单元测试。

    用途:运行时更新同步间隔 + 并发限流。
    参数:interval_s / concurrency 都可选,但至少传一个(都不传 raise ValueError)。
    校验:interval_s 必须 > 0 且 <= 86400;concurrency 必须 > 0 且 <= 20。
    返回:{"interval_s": N, "concurrency": N, "applied": True}
    """

    def test_update_interval_only(self) -> None:
        """只更新 interval_s。"""
        svc = ModelSyncService()
        result = svc.update_config(interval_s=3600)
        assert result["applied"] is True
        assert result["interval_s"] == 3600

    def test_update_concurrency_only(self) -> None:
        """只更新 concurrency。"""
        svc = ModelSyncService()
        result = svc.update_config(concurrency=10)
        assert result["applied"] is True
        assert result["concurrency"] == 10

    def test_update_both(self) -> None:
        """同时更新 interval_s 和 concurrency。"""
        svc = ModelSyncService()
        result = svc.update_config(interval_s=7200, concurrency=8)
        assert result["applied"] is True
        assert result["interval_s"] == 7200
        assert result["concurrency"] == 8

    def test_update_no_params_raises(self) -> None:
        """不传任何参数应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config()

    def test_update_invalid_interval_zero(self) -> None:
        """interval_s=0 应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config(interval_s=0)

    def test_update_invalid_interval_negative(self) -> None:
        """interval_s 负数应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config(interval_s=-1)

    def test_update_invalid_interval_too_large(self) -> None:
        """interval_s > 86400 应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config(interval_s=86401)

    def test_update_invalid_concurrency_zero(self) -> None:
        """concurrency=0 应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config(concurrency=0)

    def test_update_invalid_concurrency_too_large(self) -> None:
        """concurrency > 20 应 raise ValueError。"""
        svc = ModelSyncService()
        with pytest.raises(ValueError):
            svc.update_config(concurrency=21)

    def test_update_persists_to_runtime_fields(self) -> None:
        """配置更新应写入 _runtime_interval_s / _runtime_concurrency。"""
        svc = ModelSyncService()
        svc.update_config(interval_s=1800, concurrency=3)
        assert svc._runtime_interval_s == 1800
        assert svc._runtime_concurrency == 3


# =============================================================================
# v4 运维控制:get_aggregated_stats(查询最近 N 天聚合统计)
# =============================================================================


@_skip_if_no_aggregated_stats
class TestGetAggregatedStats:
    """F5.3 get_aggregated_stats() 单元测试。

    用途:查询最近 N 天的聚合统计(从 ai_model_sync_log 表)。
    参数:days 默认 7,最大 90(超出截断为 90)。
    行为:表不存在或查询失败时返回零值 dict(不抛异常)。
    """

    @pytest.mark.asyncio
    async def test_stats_returns_valid_structure(self) -> None:
        """返回 dict 结构正确(含所有必需字段 + 正确类型),不依赖 DB 数据状态。"""
        svc = ModelSyncService()
        result = await svc.get_aggregated_stats(days=7)
        assert result["days"] == 7
        assert isinstance(result["total_syncs"], int)
        assert isinstance(result["success_count"], int)
        assert isinstance(result["failure_count"], int)
        assert isinstance(result["success_rate"], (int, float))
        assert isinstance(result["avg_latency_ms"], int)
        assert isinstance(result["max_latency_ms"], int)
        assert isinstance(result["min_latency_ms"], int)
        assert isinstance(result["total_new_models"], int)
        assert isinstance(result["total_removed_models"], int)
        assert isinstance(result["by_provider"], list)

    @pytest.mark.asyncio
    async def test_stats_default_days(self) -> None:
        """默认 days=7。"""
        svc = ModelSyncService()
        result = await svc.get_aggregated_stats()
        assert result["days"] == 7

    @pytest.mark.asyncio
    async def test_stats_custom_days(self) -> None:
        """自定义 days=30。"""
        svc = ModelSyncService()
        result = await svc.get_aggregated_stats(days=30)
        assert result["days"] == 30

    @pytest.mark.asyncio
    async def test_stats_max_days_capped(self) -> None:
        """days > 90 应被截断为 90。"""
        svc = ModelSyncService()
        result = await svc.get_aggregated_stats(days=120)
        assert result["days"] == 90

    @pytest.mark.asyncio
    async def test_stats_returns_all_required_fields(self) -> None:
        """返回 dict 必须包含所有必需字段。"""
        svc = ModelSyncService()
        result = await svc.get_aggregated_stats(days=7)
        required_keys = {
            "days", "total_syncs", "success_count", "failure_count",
            "success_rate", "avg_latency_ms", "max_latency_ms", "min_latency_ms",
            "total_new_models", "total_removed_models", "by_provider",
        }
        assert required_keys.issubset(result.keys())


# =============================================================================
# v4 运维控制:cleanup_old_logs(清理 N 天前的同步日志)
# =============================================================================


@_skip_if_no_cleanup_old_logs
class TestCleanupOldLogs:
    """F5.4 cleanup_old_logs() 单元测试。

    用途:清理 N 天前的同步日志。
    参数:before_days 默认 30,最小 1。
    行为:表不存在时返回 deleted_count=0(不抛异常)。
    返回:{"deleted_count": N, "before_days": N}
    """

    @pytest.mark.asyncio
    async def test_cleanup_returns_zero_when_no_table(self) -> None:
        """表不存在时返回 deleted_count=0(不抛异常)。"""
        svc = ModelSyncService()
        result = await svc.cleanup_old_logs(before_days=30)
        assert result["deleted_count"] == 0
        assert result["before_days"] == 30

    @pytest.mark.asyncio
    async def test_cleanup_default_before_days(self) -> None:
        """默认 before_days=30。"""
        svc = ModelSyncService()
        result = await svc.cleanup_old_logs()
        assert result["before_days"] == 30

    @pytest.mark.asyncio
    async def test_cleanup_custom_before_days(self) -> None:
        """自定义 before_days=7。"""
        svc = ModelSyncService()
        result = await svc.cleanup_old_logs(before_days=7)
        assert result["before_days"] == 7

    @pytest.mark.asyncio
    async def test_cleanup_min_before_days(self) -> None:
        """before_days=1 应该正常工作(最小值)。"""
        svc = ModelSyncService()
        result = await svc.cleanup_old_logs(before_days=1)
        assert result["before_days"] == 1

    @pytest.mark.asyncio
    async def test_cleanup_returns_dict_structure(self) -> None:
        """返回 dict 必须包含 deleted_count 和 before_days。"""
        svc = ModelSyncService()
        result = await svc.cleanup_old_logs(before_days=14)
        assert "deleted_count" in result
        assert "before_days" in result
        assert isinstance(result["deleted_count"], int)
        assert isinstance(result["before_days"], int)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

class TestEnsureProviderConfig:
    """_ensure_provider_config(2026-09-08 修复:config 行缺失静默跳过)。"""

    class _FakeConn:
        def __init__(self, select_result, insert_result):
            self._select_result = select_result
            self._insert_result = insert_result
            self.select_calls = 0
            self.insert_calls = 0

        async def fetchrow(self, query, *args):
            if query.lstrip().upper().startswith("SELECT"):
                self.select_calls += 1
                return self._select_result
            self.insert_calls += 1
            return self._insert_result

    @pytest.mark.asyncio
    async def test_existing_config_returns_id_no_insert(self) -> None:
        conn = self._FakeConn({"id": 7}, {"id": 99})
        svc = ModelSyncService()
        got = await svc._ensure_provider_config(conn, "agnes")
        assert got == 7
        assert conn.insert_calls == 0

    @pytest.mark.asyncio
    async def test_missing_config_never_auto_inserts(self) -> None:
        """缺 config 行时不再自动插行(provider 由运维显式配置)。"""
        conn = self._FakeConn(None, {"id": 42})
        svc = ModelSyncService()
        got = await svc._ensure_provider_config(conn, "agnes")
        assert got is None
        assert conn.insert_calls == 0


# ---------------------------------------------------------------------------
# Fix A(2026-09-02):同批 / 跨大小写 model_id 唯一索引冲突防护
# ---------------------------------------------------------------------------


class TestUpsertLowerIdDedup:
    """唯一索引建在 (config_id, LOWER(model_id)) 上的两条防护路径。

    故障现场:openrouter/siliconflow 清单里两条记录别名归一后只差大小写,
    首条 INSERT 后第二条仍走 INSERT → 23505 重复键 → 整个 provider 事务回滚。
    """

    class _FakeTx:
        async def __aenter__(self) -> None:
            return None

        async def __aexit__(self, *args: Any) -> bool:
            return False

    class _FakeConn:
        def __init__(self, existing_rows: list[dict[str, Any]]) -> None:
            self._existing = existing_rows
            self.executed: list[tuple[str, tuple[Any, ...]]] = []

        def transaction(self) -> TestUpsertLowerIdDedup._FakeTx:
            return TestUpsertLowerIdDedup._FakeTx()

        async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
            return self._existing

        async def execute(self, query: str, *args: Any) -> None:
            self.executed.append((query, args))

    class _FakeAcquire:
        def __init__(self, conn: TestUpsertLowerIdDedup._FakeConn) -> None:
            self._conn = conn

        async def __aenter__(self) -> TestUpsertLowerIdDedup._FakeConn:
            return self._conn

        async def __aexit__(self, *args: Any) -> bool:
            return False

    class _FakePool:
        def __init__(self, conn: TestUpsertLowerIdDedup._FakeConn) -> None:
            self._conn = conn

        def acquire(self) -> TestUpsertLowerIdDedup._FakeAcquire:
            return TestUpsertLowerIdDedup._FakeAcquire(self._conn)

    @staticmethod
    async def _run(
        monkeypatch: pytest.MonkeyPatch,
        existing_rows: list[dict[str, Any]],
        upstream_models: list[dict[str, Any]],
    ) -> tuple[Any, TestUpsertLowerIdDedup._FakeConn]:
        """跑一次 _upsert_models_to_db(全程零真实 DB 连接)。"""
        import app.services.model_sync as ms

        conn = TestUpsertLowerIdDedup._FakeConn(existing_rows)

        async def _fake_get_shared_pool() -> TestUpsertLowerIdDedup._FakePool:
            return TestUpsertLowerIdDedup._FakePool(conn)

        async def _cfg(self: Any, _conn: Any, _code: str) -> int:
            return 22

        async def _tags(self: Any, _conn: Any) -> bool:
            return False

        async def _cols(self: Any, _conn: Any, names: list[str]) -> dict[str, bool]:
            return dict.fromkeys(names, False)

        monkeypatch.setattr(ms, "get_shared_pool", _fake_get_shared_pool)
        monkeypatch.setattr(ModelSyncService, "_ensure_provider_config", _cfg)
        monkeypatch.setattr(ModelSyncService, "_check_tags_column_exists", _tags)
        monkeypatch.setattr(ModelSyncService, "_check_columns_exists", _cols)
        svc = ModelSyncService()
        result = await svc._upsert_models_to_db("siliconflow", upstream_models)
        return result, conn

    @staticmethod
    def _inserts(conn: TestUpsertLowerIdDedup._FakeConn) -> list[tuple[Any, ...]]:
        return [c for c in conn.executed if c[0].lstrip().upper().startswith("INSERT")]

    @staticmethod
    def _updates(conn: TestUpsertLowerIdDedup._FakeConn) -> list[tuple[Any, ...]]:
        return [c for c in conn.executed if c[0].lstrip().upper().startswith("UPDATE")]

    @pytest.mark.asyncio
    async def test_same_batch_case_collision_inserts_once(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """防护①:同批两条只差大小写 → 只 INSERT 一次(DB 空)。"""
        upstream = [
            {"id": "pro/moonshotai/Kimi-K2.6"},
            {"id": "pro/moonshotai/kimi-k2.6"},
        ]
        (new_count, removed_count, _pn, _pr, _tags), conn = await self._run(
            monkeypatch, [], upstream
        )
        assert len(self._inserts(conn)) == 1, "同批 lower 冲突必须只落一条 INSERT"
        assert new_count == 1
        assert removed_count == 0

    @pytest.mark.asyncio
    async def test_db_row_with_different_case_goes_update_not_insert(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """防护②:DB 已有大小写不同的旧行 → 走 UPDATE(用库里真实写法),不 INSERT。"""
        upstream = [{"id": "ztest/model"}]
        existing = [{"model_id": "ZTest/Model", "is_relay_public": True}]
        (new_count, removed_count, _pn, _pr, _tags), conn = await self._run(
            monkeypatch, existing, upstream
        )
        assert self._inserts(conn) == [], "大小写不同的旧行不得再 INSERT"
        updates = self._updates(conn)
        assert len(updates) == 1
        assert updates[0][1][1] == "ZTest/Model", "UPDATE 必须命中库里已有的写法"
        # 同一模型不得被误判为"上游已下架"而置 is_relay_public = false
        assert not any("is_relay_public = false" in sql for sql, _ in conn.executed)
        assert new_count == 0
        assert removed_count == 0


# =============================================================================
# 2026-10-26 占位 key = 未配置:未配凭据厂商不进人告警(机主定案)
# 根因:ai_model_config 里 sk-placeholder-… 变体绕过精确匹配的 _PLACEHOLDER_KEYS,
# github_models/cloudflare_workers_ai 被拉进同步连败 3 次 ⇒ 永久禁用 + health=0 ⇒
# LlmProviderUnhealthy 长期 firing。判据收敛在选取层,不在告警侧打补丁。
# =============================================================================


class _FakeProviderCfg:
    def __init__(self, api_key: str = "", api_base: str | None = None) -> None:
        self.api_key = api_key
        self.api_base = api_base


class _FakeSettings:
    def __init__(self, mapping: dict[str, _FakeProviderCfg]) -> None:
        self._mapping = mapping

    def get_provider_config(self, name: str) -> _FakeProviderCfg:
        return self._mapping.get(name, _FakeProviderCfg())


class TestPlaceholderKeySilence:
    """_is_placeholder_key 判据 + 选取层静音(不进同步/不带占位 key 出网)。"""

    def test_is_placeholder_key_matrix(self) -> None:
        from app.services.model_sync import _is_placeholder_key

        # 视为未配置:空 / 白名单占位符 / 含 placeholder 字样(大小写不敏感)
        assert _is_placeholder_key("")
        assert _is_placeholder_key("<your-xxx-api-key>")
        assert _is_placeholder_key("sk-placeholder-key-2026")
        assert _is_placeholder_key("SK-PLACEHOLDER-ABC")
        # 视为已配置:真实 key 形状不得误杀
        assert not _is_placeholder_key("sk-abc123def456")
        assert not _is_placeholder_key("nvapi-realkey")

    def test_registry_huggingface_keyless_flag(self) -> None:
        """huggingface 目录端点免鉴权(router /v1/models 无 key 200 实测)⇒ 必须标 keyless。"""
        from app.services.free_provider_registry import free_provider_registry

        provider = free_provider_registry.get_by_code("huggingface")
        assert provider is not None
        assert provider.keyless_model_list is True
        assert provider.default_base_url == "https://router.huggingface.co"

    @pytest.mark.asyncio
    async def test_selection_drops_placeholder_key_providers(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """占位 key 的 github_models/cloudflare_workers_ai 不进同步;huggingface 以空 key 放行。"""
        import app.services.model_sync as ms_mod

        fake = _FakeSettings({
            "github": _FakeProviderCfg(api_key="sk-placeholder-key-2026"),
            "cloudflare": _FakeProviderCfg(api_key="sk-placeholder-key-2026"),
        })
        monkeypatch.setattr(ms_mod, "settings", fake)

        async def _no_db_key(self: ModelSyncService, code: str) -> str | None:
            return None

        monkeypatch.setattr(ModelSyncService, "_db_api_key_for", _no_db_key)
        svc = ModelSyncService()
        result = await svc._get_configured_providers()
        codes = {c for c, _b, _k in result}
        assert "github_models" not in codes
        assert "cloudflare_workers_ai" not in codes
        # keyless 放行且**不带占位 key 出网**(Bearer sk-placeholder-… 可能被判 401)
        hf = [t for t in result if t[0] == "huggingface"]
        assert hf, "huggingface 应因 keyless_model_list 进同步清单"
        assert hf[0][1] == "https://router.huggingface.co"
        assert hf[0][2] == ""

    @pytest.mark.asyncio
    async def test_selection_real_key_still_included(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """真实 key 的厂商照常入选,且 key 原样带出(判据不得反向误杀)。"""
        import app.services.model_sync as ms_mod

        fake = _FakeSettings({
            "github": _FakeProviderCfg(api_key="ghu_real_token_123"),
        })
        monkeypatch.setattr(ms_mod, "settings", fake)

        async def _no_db_key(self: ModelSyncService, code: str) -> str | None:
            return None

        monkeypatch.setattr(ModelSyncService, "_db_api_key_for", _no_db_key)
        svc = ModelSyncService()
        result = await svc._get_configured_providers()
        gh = [t for t in result if t[0] == "github_models"]
        assert gh and gh[0][2] == "ghu_real_token_123"

    def test_single_provider_sync_rejects_placeholder_key(self) -> None:
        """单厂同步入口同判据:占位 key 直接 ValueError,不发请求。"""
        import inspect

        src = inspect.getsource(ModelSyncService.sync_single_provider)
        assert "_is_placeholder_key" in src

    @pytest.mark.asyncio
    async def test_empty_key_sends_no_authorization_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """空 key 的免鉴权目录请求不得带 Authorization。

        2026-10-26 生产实测:huggingface 换 router 域、占位 key 判未配置后以空 key 出网,
        但默认分支仍无条件拼 `Bearer {api_key}` ⇒ httpx 抛
        LocalProtocolError: Illegal header value b'Bearer ',本该免鉴权 200 的目录
        成了失败,反手把 health 又打成 0。故此处钉住"无 key ⇒ 无该 header"。
        """
        import app.services.model_sync as ms_mod

        capture: dict[str, Any] = {}
        monkeypatch.setattr(
            ms_mod.httpx,
            "AsyncClient",
            lambda timeout=None, proxy=None: _MockAsyncClient({"data": []}, capture),
        )
        svc = ModelSyncService()
        await svc._fetch_upstream_models("huggingface", "https://router.huggingface.co", "")
        assert capture.get("url", "").endswith("/v1/models")
        assert "Authorization" not in (capture.get("headers") or {})

