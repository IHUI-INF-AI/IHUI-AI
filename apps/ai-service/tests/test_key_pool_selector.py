"""key_pool_selector.py 单元测试(P0-5c,中转站 Key 池选择器)。

测试覆盖:
- model_to_provider_code 前缀映射(10+ provider)
- select_key:mock DB 查询,加权随机,健康过滤,解密失败处理,空池
- mark_key_failed:状态转换(healthy/unknown → degraded → down)
- mark_key_healthy:状态恢复
- DB 异常降级(查询失败返回 None,不抛异常)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.key_pool_selector import KeyPoolSelector, SelectedKey


# =============================================================================
# 辅助:构造 mock asyncpg 连接池 + 行
# =============================================================================


def _make_row(
    row_id: str = "key-uuid-1",
    name: str = "test-key",
    api_key_enc: str = "sk-plaintext-key",
    priority: int = 0,
    weight: int = 1,
) -> dict[str, Any]:
    """构造模拟的 asyncpg Record(dict-like)。"""
    return {
        "id": row_id,
        "name": name,
        "api_key_enc": api_key_enc,
        "priority": priority,
        "weight": weight,
    }


def _make_mock_pool(rows: list[dict[str, Any]] | None = None) -> MagicMock:
    """构造 mock asyncpg.Pool,fetch 返回 rows,execute 返回行数。

    rows=None 时模拟空结果(无可用 key)。
    """
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=rows or [])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    # pool.acquire() 返回 async context manager
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


# =============================================================================
# model_to_provider_code:前缀映射
# =============================================================================


@pytest.mark.parametrize(
    "model,expected",
    [
        ("stepfun/step-3.7-flash", "stepfun"),
        ("agnes/gpt-4o", "agnes"),
        ("groq/llama-3.1-8b", "groq"),
        ("gemini/gemini-2.5-pro", "gemini"),
        ("openrouter/deepseek/deepseek-v4-pro", "openrouter"),
        ("claude-3.5-sonnet", "anthropic"),
        ("anthropic/claude-opus-4", "anthropic"),
        ("gpt-4o", "openai"),
        ("o1-preview", "openai"),
        ("o3-mini", "openai"),
        ("o4-mini", "openai"),
        ("cerebras/qwen3-235b", "cerebras"),
        ("mistral/mistral-large-latest", "mistral"),
        ("cohere/command-r-plus", "cohere"),
        ("huggingface/deepseek-v3", "huggingface"),
        ("nvidia/llama-3.1-nemotron-70b", "nvidia_nim"),
        ("cloudflare/llama-3.1-8b", "cloudflare_workers_ai"),
        ("unknown-model", "openai"),  # 未匹配默认 openai
    ],
)
def test_model_to_provider_code(model: str, expected: str) -> None:
    """model 前缀 → provider_code 映射覆盖 10+ provider + 默认值。"""
    assert KeyPoolSelector.model_to_provider_code(model) == expected


# =============================================================================
# select_key:基础功能
# =============================================================================


async def test_select_key_single_key() -> None:
    """单 key 直接返回(无需加权随机)。"""
    rows = [_make_row(row_id="uuid-1", name="key-1", api_key_enc="sk-test-1")]
    pool = _make_mock_pool(rows)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        # _decrypt_api_key 对非 JSON 字符串返回明文(strip 引号)
        result = await KeyPoolSelector.select_key("stepfun")

    assert result is not None
    assert result["api_key"] == "sk-test-1"
    assert result["key_pool_id"] == "uuid-1"
    assert result["key_name"] == "key-1"


async def test_select_key_empty_pool_returns_none() -> None:
    """无可用 key 时返回 None。"""
    pool = _make_mock_pool([])

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("stepfun")

    assert result is None


async def test_select_key_db_exception_returns_none() -> None:
    """DB 查询异常时返回 None(不抛异常,降级兜底)。"""
    conn = MagicMock()
    conn.fetch = AsyncMock(side_effect=Exception("connection refused"))
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("stepfun")

    assert result is None


# =============================================================================
# select_key:加权随机
# =============================================================================


async def test_select_key_weighted_random_picks_from_same_priority() -> None:
    """同 priority 多 key 时,加权随机选中的 key 在列表内。"""
    rows = [
        _make_row(row_id="uuid-1", name="key-1", api_key_enc="sk-1", priority=0, weight=3),
        _make_row(row_id="uuid-2", name="key-2", api_key_enc="sk-2", priority=0, weight=1),
    ]
    pool = _make_mock_pool(rows)

    valid_ids = {"uuid-1", "uuid-2"}
    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("openai")

    assert result is not None
    assert result["key_pool_id"] in valid_ids


async def test_select_key_priority_filter() -> None:
    """不同 priority 时,只选最小 priority 组(priority ASC 排序)。"""
    rows = [
        _make_row(row_id="high-prio", name="vip", api_key_enc="sk-vip", priority=0, weight=1),
        _make_row(row_id="low-prio", name="normal", api_key_enc="sk-normal", priority=5, weight=100),
    ]
    pool = _make_mock_pool(rows)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("openai")

    # priority=0 的 key 应被选中(priority 最小),即使 weight=1
    assert result is not None
    assert result["key_pool_id"] == "high-prio"


async def test_select_key_weight_zero_treated_as_one() -> None:
    """weight=0 的 key 视为 weight=1(防御异常配置,避免 random.choices 报错)。"""
    rows = [
        _make_row(row_id="zero-weight", name="zero", api_key_enc="sk-zero", priority=0, weight=0),
        _make_row(row_id="normal", name="normal", api_key_enc="sk-normal", priority=0, weight=0),
    ]
    pool = _make_mock_pool(rows)

    valid_ids = {"zero-weight", "normal"}
    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("openai")

    assert result is not None
    assert result["key_pool_id"] in valid_ids


# =============================================================================
# select_key:健康过滤(SQL 层面)
# =============================================================================


async def test_select_key_health_status_down_filtered_by_sql() -> None:
    """health_status='down' 的 key 在 SQL WHERE 条件过滤(不在 rows 中)。

    验证 select_key 不会收到 down 的 key(模拟 DB 已过滤)。
    """
    # DB 返回的 rows 只有 healthy 的 key(down 的已被 SQL 过滤)
    rows = [_make_row(row_id="healthy-key", name="ok", api_key_enc="sk-ok")]
    pool = _make_mock_pool(rows)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("openai")

    assert result is not None
    assert result["key_pool_id"] == "healthy-key"


# =============================================================================
# select_key:解密失败
# =============================================================================


async def test_select_key_decrypt_failure_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """api_key_enc 解密失败时返回 None。"""
    rows = [_make_row(api_key_enc="encrypted-bad-data")]
    pool = _make_mock_pool(rows)

    # mock _decrypt_api_key 返回 None(解密失败)
    monkeypatch.setattr(
        "app.core.llm_gateway._decrypt_api_key", lambda x: None
    )

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        result = await KeyPoolSelector.select_key("openai")

    assert result is None


# =============================================================================
# mark_key_failed:状态转换
# =============================================================================


async def test_mark_key_failed_calls_execute() -> None:
    """mark_key_failed 执行 UPDATE SQL(CASE 状态转换)。"""
    pool = _make_mock_pool([])

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        await KeyPoolSelector.mark_key_failed("uuid-1", "timeout error")

    # 验证 execute 被调用
    conn = pool.acquire.return_value.__aenter__.return_value
    conn.execute.assert_awaited_once()
    call = conn.execute.call_args
    # call.args = (sql, key_pool_id, error_message)
    assert call.args[1] == "uuid-1"
    assert call.args[2] == "timeout error"
    assert "health_status" in call.args[0]


async def test_mark_key_failed_truncates_long_error() -> None:
    """error_message 超长时截断到 500 字符(防 SQL 字段超限)。"""
    pool = _make_mock_pool([])
    long_error = "x" * 1000

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        await KeyPoolSelector.mark_key_failed("uuid-1", long_error)

    conn = pool.acquire.return_value.__aenter__.return_value
    call = conn.execute.call_args
    # 第三个参数是 error_message[:500]
    passed_error = call.args[2]
    assert len(passed_error) == 500


async def test_mark_key_failed_db_exception_no_raise() -> None:
    """mark_key_failed DB 异常时不抛(降级日志,不阻塞业务)。"""
    conn = MagicMock()
    conn.execute = AsyncMock(side_effect=Exception("db down"))
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        # 不应抛异常
        await KeyPoolSelector.mark_key_failed("uuid-1", "error")


# =============================================================================
# mark_key_healthy:状态恢复
# =============================================================================


async def test_mark_key_healthy_calls_execute() -> None:
    """mark_key_healthy 执行 UPDATE SQL(health_status='healthy')。"""
    pool = _make_mock_pool([])

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        await KeyPoolSelector.mark_key_healthy("uuid-1")

    conn = pool.acquire.return_value.__aenter__.return_value
    conn.execute.assert_awaited_once()
    call = conn.execute.call_args
    sql = call.args[0]
    assert "healthy" in sql
    assert call.args[1] == "uuid-1"


async def test_mark_key_healthy_db_exception_no_raise() -> None:
    """mark_key_healthy DB 异常时不抛(降级日志,不阻塞业务)。"""
    conn = MagicMock()
    conn.execute = AsyncMock(side_effect=Exception("db down"))
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.services.key_pool_selector.get_shared_pool", return_value=pool):
        # 不应抛异常
        await KeyPoolSelector.mark_key_healthy("uuid-1")


# =============================================================================
# SelectedKey TypedDict 结构
# =============================================================================


def test_selected_key_typeddict_fields() -> None:
    """SelectedKey TypedDict 含 api_key / key_pool_id / key_name 三个字段。"""
    key: SelectedKey = {
        "api_key": "sk-test",
        "key_pool_id": "uuid-1",
        "key_name": "test-key",
    }
    assert key["api_key"] == "sk-test"
    assert key["key_pool_id"] == "uuid-1"
    assert key["key_name"] == "test-key"
