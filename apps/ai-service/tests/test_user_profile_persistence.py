"""用户画像持久化层测试(L2-4,2026-07-25 立)。

覆盖 user_profile.py 新增的持久化层 + system prompt 注入:
- _parse_uuid:user_id → UUID 解析
- _get_pool:连接池懒初始化
- load_profile:从 DB 加载单用户画像到内存
- load_all_profiles:启动时全量 hydrate
- _persist_profile:UPSERT 单用户画像(写穿)
- delete_profile:从 DB 删除(用户注销 / GDPR)
- get_cached_profile:同步读内存
- build_system_prompt_snippet:同步构建 system prompt 片段
- _build_system_prompt_snippet_from_profile:静态方法,从画像生成 snippet
- 进程重启模拟:进程 A 构建 → 进程 B 启动 hydrate → 画像一致
- 单例 user_profile_builder
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from app.services.user_profile import (
    UserProfileBuilder,
    _parse_uuid,
    user_profile_builder,
)


# =============================================================================
# 辅助:AsyncMockContextManager(支持 async with pool.acquire())
# =============================================================================


class AsyncMockContextManager:
    """模拟 `async with pool.acquire() as conn:` 的上下文管理器。"""

    def __init__(self, conn: MagicMock) -> None:
        self._conn = conn

    async def __aenter__(self) -> MagicMock:
        return self._conn

    async def __aexit__(self, *args: object) -> None:
        pass


def _make_profile(
    user_id: str = "u1",
    entries: list[dict] | None = None,
    completeness: float = 0.6,
    total_memories: int = 10,
) -> dict:
    """构造 UserProfileAggregate 字典。"""
    return {
        "userId": user_id,
        "entries": entries or [
            {
                "userId": user_id,
                "dimension": "preference",
                "content": "用户偏好内容",
                "confidence": 0.8,
                "supportingMemoryIds": ["m1", "m2"],
                "updatedAt": "2026-07-25T00:00:00+00:00",
            }
        ],
        "totalMemories": total_memories,
        "completeness": completeness,
        "updatedAt": "2026-07-25T00:00:00+00:00",
    }


def _mock_pool_with_conn(conn: MagicMock) -> MagicMock:
    """构造 mock pool,其 acquire() 返回 AsyncMockContextManager(conn)。"""
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=AsyncMockContextManager(conn))
    return pool


# =============================================================================
# _parse_uuid:user_id → UUID 解析
# =============================================================================


class TestParseUuid:
    """_parse_uuid:user_id → UUID 解析。"""

    def test_valid_uuid(self):
        uid = "550e8400-e29b-41d4-a716-446655440000"
        result = _parse_uuid(uid)
        assert result is not None
        assert isinstance(result, UUID)
        assert str(result) == uid

    def test_empty_string_returns_none(self):
        assert _parse_uuid("") is None

    def test_none_returns_none(self):
        assert _parse_uuid(None) is None

    def test_invalid_string_returns_none(self):
        assert _parse_uuid("not-a-uuid") is None

    def test_partial_uuid_returns_none(self):
        assert _parse_uuid("550e8400-e29b-41d4") is None


# =============================================================================
# load_profile:从 DB 加载单用户画像
# =============================================================================


class TestLoadProfile:
    """load_profile:从 DB 加载单用户画像到内存。"""

    @pytest.mark.asyncio
    async def test_load_existing_profile(self, monkeypatch):
        """DB 返回画像 → JSON 解析并写入内存。"""
        builder = UserProfileBuilder()
        profile_data = _make_profile("550e8400-e29b-41d4-a716-446655440000")
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value={
            "profile": json.dumps(profile_data),
        })
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.load_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is not None
        assert result["userId"] == "550e8400-e29b-41d4-a716-446655440000"
        assert "550e8400-e29b-41d4-a716-446655440000" in builder._profiles

    @pytest.mark.asyncio
    async def test_load_nonexistent_returns_none(self, monkeypatch):
        """DB 无记录 → 返回 None,内存不变。"""
        builder = UserProfileBuilder()
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.load_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is None
        assert "550e8400-e29b-41d4-a716-446655440000" not in builder._profiles

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_none(self):
        """user_id 非合法 UUID → 返回 None(不查 DB)。"""
        builder = UserProfileBuilder()
        result = await builder.load_profile("not-a-uuid")
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_user_id_returns_none(self):
        """空 user_id → 返回 None。"""
        builder = UserProfileBuilder()
        result = await builder.load_profile("")
        assert result is None

    @pytest.mark.asyncio
    async def test_db_exception_returns_none(self, monkeypatch):
        """DB 异常 → 返回 None,不抛错。"""
        builder = UserProfileBuilder()
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(side_effect=RuntimeError("db down"))
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.load_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is None

    @pytest.mark.asyncio
    async def test_json_decode_error_returns_none(self, monkeypatch):
        """DB 返回非法 JSON → 返回 None,不抛错。"""
        builder = UserProfileBuilder()
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value={"profile": "not-a-json"})
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.load_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is None


# =============================================================================
# load_all_profiles:启动时全量 hydrate
# =============================================================================


class TestLoadAllProfiles:
    """load_all_profiles:启动时全量 hydrate。"""

    @pytest.mark.asyncio
    async def test_load_multiple_profiles(self, monkeypatch):
        """DB 返回多条 → 全部 hydrate 到内存。"""
        builder = UserProfileBuilder()
        rows = [
            {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "profile": json.dumps(_make_profile("550e8400-e29b-41d4-a716-446655440000")),
            },
            {
                "user_id": "660e8400-e29b-41d4-a716-446655440001",
                "profile": json.dumps(_make_profile("660e8400-e29b-41d4-a716-446655440001")),
            },
        ]
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=rows)
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        count = await builder.load_all_profiles()
        assert count == 2
        assert "550e8400-e29b-41d4-a716-446655440000" in builder._profiles
        assert "660e8400-e29b-41d4-a716-446655440001" in builder._profiles

    @pytest.mark.asyncio
    async def test_empty_db_returns_zero(self, monkeypatch):
        """DB 无记录 → 返回 0。"""
        builder = UserProfileBuilder()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[])
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        count = await builder.load_all_profiles()
        assert count == 0

    @pytest.mark.asyncio
    async def test_db_exception_returns_zero(self, monkeypatch):
        """DB 异常 → 返回 0,不抛错。"""
        builder = UserProfileBuilder()
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(side_effect=RuntimeError("db down"))
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        count = await builder.load_all_profiles()
        assert count == 0

    @pytest.mark.asyncio
    async def test_partial_json_error_skips_bad_row(self, monkeypatch):
        """部分行 JSON 解析失败 → 跳过该行,其他正常加载。"""
        builder = UserProfileBuilder()
        rows = [
            {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "profile": json.dumps(_make_profile("550e8400-e29b-41d4-a716-446655440000")),
            },
            {
                "user_id": "660e8400-e29b-41d4-a716-446655440001",
                "profile": "invalid-json",  # 这行 JSON 解析失败
            },
        ]
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=rows)
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        count = await builder.load_all_profiles()
        assert count == 1  # 仅成功的行计数
        assert "550e8400-e29b-41d4-a716-446655440000" in builder._profiles
        assert "660e8400-e29b-41d4-a716-446655440001" not in builder._profiles

    @pytest.mark.asyncio
    async def test_limit_passed_to_query(self, monkeypatch):
        """limit 参数传递到 SQL 查询。"""
        builder = UserProfileBuilder()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[])
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        await builder.load_all_profiles(limit=500)
        # 验证 fetch 调用时 limit 参数为 500
        call_args = mock_conn.fetch.call_args
        assert call_args.args[1] == 500


# =============================================================================
# _persist_profile:UPSERT 单用户画像
# =============================================================================


class TestPersistProfile:
    """_persist_profile:UPSERT 单用户画像(写穿)。"""

    @pytest.mark.asyncio
    async def test_persist_valid_profile(self, monkeypatch):
        """合法 user_id + 画像 → 执行 INSERT...ON CONFLICT。"""
        builder = UserProfileBuilder()
        profile = _make_profile("550e8400-e29b-41d4-a716-446655440000")
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="INSERT 0 1")
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        await builder._persist_profile("550e8400-e29b-41d4-a716-446655440000", profile)
        # 验证 execute 被调用
        mock_conn.execute.assert_awaited_once()
        # 验证 SQL 是 INSERT INTO agent_user_profile ... ON CONFLICT
        sql_arg = mock_conn.execute.call_args.args[0]
        assert "INSERT INTO agent_user_profile" in sql_arg
        assert "ON CONFLICT (user_id) DO UPDATE" in sql_arg

    @pytest.mark.asyncio
    async def test_persist_includes_system_prompt_snippet(self, monkeypatch):
        """持久化时同时保存 system_prompt_snippet。"""
        builder = UserProfileBuilder()
        profile = _make_profile("550e8400-e29b-41d4-a716-446655440000")
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="INSERT 0 1")
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        await builder._persist_profile("550e8400-e29b-41d4-a716-446655440000", profile)
        # execute 调用的参数:sql, user_uuid, completeness, total_memories, profile_json, snippet
        call_args = mock_conn.execute.call_args
        # 第 6 个参数(索引 5)是 snippet
        snippet_arg = call_args.args[5]
        assert "## 用户画像" in snippet_arg
        assert "偏好" in snippet_arg  # 来自 _make_profile 的 entries

    @pytest.mark.asyncio
    async def test_persist_empty_user_id_skips(self):
        """空 user_id → 跳过持久化(不调 DB)。"""
        builder = UserProfileBuilder()
        profile = _make_profile()
        # 不需要 mock,因为不会调 _get_pool
        await builder._persist_profile("", profile)  # 不抛错即通过

    @pytest.mark.asyncio
    async def test_persist_invalid_uuid_skips(self):
        """非法 user_id → 跳过持久化(不调 DB)。"""
        builder = UserProfileBuilder()
        profile = _make_profile()
        await builder._persist_profile("not-a-uuid", profile)  # 不抛错即通过

    @pytest.mark.asyncio
    async def test_persist_db_exception_silent(self, monkeypatch):
        """DB 异常 → 只 warning,不抛错。"""
        builder = UserProfileBuilder()
        profile = _make_profile("550e8400-e29b-41d4-a716-446655440000")
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(side_effect=RuntimeError("db down"))
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        # 不抛错即通过
        await builder._persist_profile("550e8400-e29b-41d4-a716-446655440000", profile)


# =============================================================================
# delete_profile:从 DB 删除
# =============================================================================


class TestDeleteProfile:
    """delete_profile:从 DB 删除用户画像。"""

    @pytest.mark.asyncio
    async def test_delete_existing_profile(self, monkeypatch):
        """合法 user_id + DB 删除成功 → 内存清除 + 返回 True。"""
        builder = UserProfileBuilder()
        builder._profiles["550e8400-e29b-41d4-a716-446655440000"] = _make_profile()
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="DELETE 1")
        mock_pool = _mock_pool_with_conn(mock_conn)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.delete_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is True
        assert "550e8400-e29b-41d4-a716-446655440000" not in builder._profiles
        # 验证 DELETE SQL 被调用
        sql_arg = mock_conn.execute.call_args.args[0]
        assert "DELETE FROM agent_user_profile WHERE user_id = $1" in sql_arg

    @pytest.mark.asyncio
    async def test_delete_invalid_uuid_only_clears_memory(self):
        """非法 user_id → 仅清内存,返回 True。"""
        builder = UserProfileBuilder()
        builder._profiles["not-a-uuid"] = _make_profile()
        result = await builder.delete_profile("not-a-uuid")
        assert result is True
        assert "not-a-uuid" not in builder._profiles

    @pytest.mark.asyncio
    async def test_delete_empty_user_id_returns_false(self):
        """空 user_id → 返回 False。"""
        builder = UserProfileBuilder()
        result = await builder.delete_profile("")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_db_exception_returns_false(self, monkeypatch):
        """DB 异常 → 内存已清但返回 False。"""
        builder = UserProfileBuilder()
        builder._profiles["550e8400-e29b-41d4-a716-446655440000"] = _make_profile()
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(side_effect=RuntimeError("db down"))
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        result = await builder.delete_profile("550e8400-e29b-41d4-a716-446655440000")
        assert result is False
        # 内存已清
        assert "550e8400-e29b-41d4-a716-446655440000" not in builder._profiles


# =============================================================================
# get_cached_profile:同步读内存
# =============================================================================


class TestGetCachedProfile:
    """get_cached_profile:同步读内存(不查 DB)。"""

    def test_returns_cached_profile(self):
        builder = UserProfileBuilder()
        profile = _make_profile("u1")
        builder._profiles["u1"] = profile
        result = builder.get_cached_profile("u1")
        assert result is profile

    def test_returns_none_when_not_cached(self):
        builder = UserProfileBuilder()
        result = builder.get_cached_profile("unknown")
        assert result is None

    def test_returns_none_for_empty_user_id(self):
        builder = UserProfileBuilder()
        result = builder.get_cached_profile("")
        assert result is None


# =============================================================================
# build_system_prompt_snippet:同步构建 system prompt 片段
# =============================================================================


class TestBuildSystemPromptSnippet:
    """build_system_prompt_snippet:同步构建 system prompt 片段。"""

    def test_returns_snippet_for_cached_profile(self):
        builder = UserProfileBuilder()
        builder._profiles["u1"] = _make_profile()
        snippet = builder.build_system_prompt_snippet("u1")
        assert "## 用户画像" in snippet
        assert "偏好" in snippet

    def test_returns_empty_for_uncached_profile(self):
        builder = UserProfileBuilder()
        snippet = builder.build_system_prompt_snippet("unknown")
        assert snippet == ""

    def test_returns_empty_for_empty_user_id(self):
        builder = UserProfileBuilder()
        snippet = builder.build_system_prompt_snippet("")
        assert snippet == ""


# =============================================================================
# _build_system_prompt_snippet_from_profile:静态方法
# =============================================================================


class TestBuildSnippetFromProfile:
    """_build_system_prompt_snippet_from_profile:静态方法。"""

    def test_empty_entries_returns_empty(self):
        # 直接构造 entries=[] 的 profile(绕过 _make_profile 的 or 兜底)
        profile = {
            "userId": "u1",
            "entries": [],
            "totalMemories": 0,
            "completeness": 0.0,
            "updatedAt": "2026-07-25T00:00:00+00:00",
        }
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert snippet == ""

    def test_single_entry(self):
        profile = _make_profile(entries=[{
            "dimension": "preference",
            "content": "用户偏好 Python",
            "confidence": 0.8,
        }])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert snippet.startswith("## 用户画像")
        assert "偏好" in snippet
        assert "用户偏好 Python" in snippet

    def test_all_5_dimensions(self):
        """5 个维度都有 → 全部注入。"""
        profile = _make_profile(entries=[
            {"dimension": "preference", "content": "偏好内容", "confidence": 0.8},
            {"dimension": "expertise", "content": "专业内容", "confidence": 0.7},
            {"dimension": "communication_style", "content": "沟通风格", "confidence": 0.6},
            {"dimension": "workflow", "content": "工作流", "confidence": 0.5},
            {"dimension": "domain", "content": "领域知识", "confidence": 0.4},
        ])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert "偏好" in snippet
        assert "专业能力" in snippet
        assert "沟通风格" in snippet
        assert "工作流" in snippet
        assert "领域知识" in snippet

    def test_low_confidence_filtered(self):
        """confidence < 0.3 的低置信度画像不注入。"""
        profile = _make_profile(entries=[
            {"dimension": "preference", "content": "高置信度", "confidence": 0.8},
            {"dimension": "expertise", "content": "低置信度", "confidence": 0.2},
        ])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert "高置信度" in snippet
        assert "低置信度" not in snippet

    def test_empty_content_skipped(self):
        """空内容跳过。"""
        profile = _make_profile(entries=[
            {"dimension": "preference", "content": "", "confidence": 0.8},
            {"dimension": "expertise", "content": "有内容", "confidence": 0.7},
        ])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert "有内容" in snippet
        # 空内容的那条不出现"偏好:"行(因为 content 为空被跳过)
        lines = [l for l in snippet.split("\n") if l.startswith("- 偏好:")]
        assert len(lines) == 0

    def test_long_content_truncated(self):
        """超过 150 字符的内容被截断。"""
        long_content = "a" * 200
        profile = _make_profile(entries=[
            {"dimension": "preference", "content": long_content, "confidence": 0.8},
        ])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        # 截断到 147 字符 + "..."
        assert "..." in snippet
        assert "a" * 148 not in snippet  # 147 个 a 不会出现连续 148 个

    def test_total_length_capped_at_800(self):
        """总长度限制 800 字符。"""
        # 构造超过 800 字符的画像
        entries = []
        for i in range(10):
            entries.append({
                "dimension": "preference",
                "content": f"偏好内容 {i} " + "x" * 100,
                "confidence": 0.8,
            })
        profile = _make_profile(entries=entries)
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert len(snippet) <= 800
        assert snippet.endswith("...")

    def test_unknown_dimension_uses_dim_name(self):
        """未知维度 → 用 dim 名作为标签。"""
        profile = _make_profile(entries=[
            {"dimension": "unknown_dim", "content": "内容", "confidence": 0.8},
        ])
        snippet = UserProfileBuilder._build_system_prompt_snippet_from_profile(profile)
        assert "unknown_dim" in snippet


# =============================================================================
# 进程重启模拟:进程 A 构建 → 进程 B 启动 hydrate → 画像一致
# =============================================================================


class TestRestartSimulation:
    """模拟进程重启:DB 状态 → load_all_profiles → 内存恢复。"""

    @pytest.mark.asyncio
    async def test_restart_restores_profile(self, monkeypatch):
        """模拟:进程 A 构建画像 → 进程 B 启动 hydrate → 画像一致。"""
        # 进程 A:构建画像(写穿 DB)
        builder_a = UserProfileBuilder()
        profile_data = _make_profile("550e8400-e29b-41d4-a716-446655440000")
        mock_conn_a = MagicMock()
        mock_conn_a.execute = AsyncMock(return_value="INSERT 0 1")
        mock_pool_a = _mock_pool_with_conn(mock_conn_a)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool_a),
        )
        await builder_a._persist_profile(
            "550e8400-e29b-41d4-a716-446655440000", profile_data
        )

        # 模拟 DB 中已有该画像
        rows = [{
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "profile": json.dumps(profile_data),
        }]
        mock_conn_b = MagicMock()
        mock_conn_b.fetch = AsyncMock(return_value=rows)
        mock_pool_b = _mock_pool_with_conn(mock_conn_b)
        monkeypatch.setattr(
            "app.services.user_profile._get_pool",
            AsyncMock(return_value=mock_pool_b),
        )

        # 进程 B:新 UserProfileBuilder 实例(模拟重启)
        builder_b = UserProfileBuilder()
        assert "550e8400-e29b-41d4-a716-446655440000" not in builder_b._profiles  # 启动前空
        count = await builder_b.load_all_profiles()
        assert count == 1
        # 启动后从 DB 恢复
        assert "550e8400-e29b-41d4-a716-446655440000" in builder_b._profiles
        restored = builder_b._profiles["550e8400-e29b-41d4-a716-446655440000"]
        assert restored["userId"] == "550e8400-e29b-41d4-a716-446655440000"
        assert restored["completeness"] == profile_data["completeness"]


# =============================================================================
# build_profile 集成:写穿 DB
# =============================================================================


class TestBuildProfileWriteThrough:
    """build_profile 完成后写穿 DB。"""

    @pytest.mark.asyncio
    async def test_build_profile_calls_persist(self, monkeypatch):
        """build_profile 成功 → 调用 _persist_profile。"""
        builder = UserProfileBuilder()
        # mock memory_client 返回记忆
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=[
            {"id": "m1", "text": "text1", "type": "preference"},
        ])
        # mock LLM 返回空(走降级路径)
        monkeypatch.setattr(
            "app.services.user_profile.UserProfileBuilder._llm_build_profile",
            AsyncMock(return_value=[]),
        )
        # mock _persist_profile 捕获调用
        persist_called = {"called": False, "user_id": None, "profile": None}

        async def fake_persist(uid: str, profile: dict) -> None:
            persist_called["called"] = True
            persist_called["user_id"] = uid
            persist_called["profile"] = profile

        monkeypatch.setattr(builder, "_persist_profile", fake_persist)

        result = await builder.build_profile("550e8400-e29b-41d4-a716-446655440000", client)
        assert persist_called["called"] is True
        assert persist_called["user_id"] == "550e8400-e29b-41d4-a716-446655440000"
        assert persist_called["profile"] is result

    @pytest.mark.asyncio
    async def test_update_profile_calls_persist(self, monkeypatch):
        """update_profile 成功 → 调用 _persist_profile。"""
        builder = UserProfileBuilder()
        # 预填内存画像(模拟已构建)
        builder._profiles["550e8400-e29b-41d4-a716-446655440000"] = _make_profile(
            "550e8400-e29b-41d4-a716-446655440000"
        )
        persist_called = {"called": False}

        async def fake_persist(uid: str, profile: dict) -> None:
            persist_called["called"] = True

        monkeypatch.setattr(builder, "_persist_profile", fake_persist)

        new_memory = {"id": "m_new", "text": "新偏好", "type": "preference"}
        await builder.update_profile(
            "550e8400-e29b-41d4-a716-446655440000", new_memory
        )
        assert persist_called["called"] is True


# =============================================================================
# 单例 user_profile_builder
# =============================================================================


class TestSingleton:
    """user_profile_builder 单例。"""

    def test_module_singleton_exists(self):
        assert user_profile_builder is not None
        assert isinstance(user_profile_builder, UserProfileBuilder)

    def test_singleton_identity(self):
        """重复 import 返回同一实例。"""
        from app.services.user_profile import user_profile_builder as up2
        assert user_profile_builder is up2
