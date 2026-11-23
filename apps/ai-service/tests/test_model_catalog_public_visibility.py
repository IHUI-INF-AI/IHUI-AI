# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公共模型目录可见性回归锁(2026-11-23)。

背景:新用户在没有个人号池、admin 也没有公开号池的情况下,仍能在
`/llm/models` 看到 WorkBuddy 等私有模型 —— 根因是 build_model_catalog
的 SQL 带了 `OR 'workbuddy' = ANY(m.tags)` 后门,且没有排除 owner 名下的
个人配置。本测钉住两条:① 后门不得回来;② 公共目录只认全局配置
(owner_uuid IS NULL) + 显式 is_relay_public=true。
"""

from __future__ import annotations

from typing import Any

import pytest


class _FakeAcquire:
    def __init__(self, conn: "_FakeConn") -> None:
        self._conn = conn

    async def __aenter__(self) -> "_FakeConn":
        return self._conn

    async def __aexit__(self, *_exc: Any) -> bool:
        return False


class _FakePool:
    def __init__(self, conn: "_FakeConn") -> None:
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)


class _FakeConn:
    def __init__(
        self,
        captured: list[str],
        rows: list[dict[str, Any]] | None = None,
    ) -> None:
        self._captured = captured
        self._rows = rows or []

    async def fetch(self, sql: str) -> list[dict[str, Any]]:
        self._captured.append(sql)
        return self._rows


@pytest.mark.asyncio
async def test_public_catalog_requires_global_config_and_explicit_public(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import db_pool
    from app.routers import llm

    captured: list[str] = []
    conn = _FakeConn(captured)

    async def _fake_get_shared_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(db_pool, "get_shared_pool", _fake_get_shared_pool)
    monkeypatch.setattr(llm, "_load_default_models", lambda: [])

    models = await llm.build_model_catalog()

    assert models == []
    assert len(captured) == 1
    sql = " ".join(captured[0].split())

    # ① WorkBuddy tag 后门不得复活
    assert "'workbuddy' = ANY" not in sql
    # ② 全局配置才能进公共目录
    assert "c.owner_uuid IS NULL" in sql
    # ③ 仍必须是显式公开
    assert "m.is_relay_public = true" in sql
    # ④ 积分倍率必须直接取 DB,不能在 Python 侧二次推断
    assert "m.points_multiplier" in sql


@pytest.mark.asyncio
async def test_catalog_passes_through_db_points_multiplier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import db_pool
    from app.routers import llm

    captured: list[str] = []
    conn = _FakeConn(
        captured,
        rows=[
            {
                "model_id": "deepseek-v4-pro",
                "display_name": "DeepSeek V4 Pro",
                "context_length": 128000,
                "provider_code": "openrouter",
                "release_date": None,
                "tags": ["chat"],
                "points_multiplier": "3.00",
                "metadata": None,
            }
        ],
    )

    async def _fake_get_shared_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(db_pool, "get_shared_pool", _fake_get_shared_pool)
    monkeypatch.setattr(llm, "_load_default_models", lambda: [])

    models = await llm.build_model_catalog()

    assert len(models) == 1
    assert models[0]["points_multiplier"] == 3.0
    # 静态兜底才允许推断,DB 行不得被 Python 的 infer 覆盖
    assert models[0]["id"] == "openrouter/deepseek-v4-pro"


def test_infer_points_multiplier_avoids_cost_false_positives() -> None:
    """2026-11-23:轻量后缀先于父型号;thinking 不再等于旗舰;gemini 含 mini 子串不得误判。"""
    from app.services.free_provider_registry import infer_points_multiplier

    assert infer_points_multiplier("deepseek-v4.1-flash") == 1.0
    assert infer_points_multiplier("deepseek-ocr") == 1.0
    assert infer_points_multiplier("gpt-5-image-mini") == 1.0
    assert infer_points_multiplier("gpt-5.6-luna") == 1.0
    assert infer_points_multiplier("hunyuan-2.0-thinking") == 1.0
    assert infer_points_multiplier("thinkingmachines/inkling") == 3.0
    assert infer_points_multiplier("thinkingmachines/inkling-small") == 1.0
    assert infer_points_multiplier("qwen3-235b-a22b-thinking-2507") == 3.0
    assert infer_points_multiplier("sao10k/l3-8b-lunaris-v1") == 1.0
    assert infer_points_multiplier("claude-opus-5-5") == 30.0
    assert infer_points_multiplier("gpt-5.5") == 30.0
    assert infer_points_multiplier("gpt-5.4") == 10.0
    assert infer_points_multiplier("gpt-5-image") == 10.0
    assert infer_points_multiplier("gemini-2.5-pro") == 10.0
    assert infer_points_multiplier("gemini-2.5-flash") == 1.0


@pytest.mark.asyncio
async def test_db_row_overrides_static_entry_on_shared_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """同身份 DB 行优先:静态条目只补 DB 缺失的非价格字段,倍率取 DB 覆盖值。

    回归 2026-11-23 分叉:静态条目先占去重集时,同 id 的 DB 行被整条跳过,DB 倍率
    随之丢失、条目回落免费关键词档。合并后 DB 基底字段覆盖静态,静态 caps 保留。
    """
    from app.core import db_pool
    from app.routers import llm

    static = [
        {
            "id": "openrouter/deepseek-v4-pro",
            "name": "静态展示名",
            "provider": "openrouter",
            "context_length": 4096,
            "caps": {"supports_tools": True},
        }
    ]
    conn = _FakeConn(
        [],
        rows=[
            {
                "model_id": "deepseek-v4-pro",
                "display_name": "DeepSeek V4 Pro",
                "context_length": 128000,
                "provider_code": "openrouter",
                "release_date": None,
                "tags": ["chat"],
                "points_multiplier": "3.00",
                "metadata": None,
            }
        ],
    )

    async def _fake_get_shared_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(db_pool, "get_shared_pool", _fake_get_shared_pool)
    monkeypatch.setattr(llm, "_load_default_models", lambda: static)

    models = await llm.build_model_catalog()

    assert len(models) == 1
    entry = models[0]
    assert entry["id"] == "openrouter/deepseek-v4-pro"
    # 倍率取 DB 覆盖值,不被静态条目或关键词推断顶替
    assert entry["points_multiplier"] == 3.0
    # DB 基底字段覆盖静态;静态 caps 等非价格声明保留
    assert entry["name"] == "DeepSeek V4 Pro"
    assert entry["context_length"] == 128000
    assert entry["caps"] == {"supports_tools": True}


@pytest.mark.asyncio
async def test_static_entry_without_db_row_keeps_no_db_multiplier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """只有静态条目、无 DB 行:build 层不臆造 DB 倍率,推断兜底只留给后段。"""
    from app.core import db_pool
    from app.routers import llm
    from app.services.free_provider_registry import infer_points_multiplier

    static = [
        {
            "id": "pollinations/openai-fast",
            "name": "OpenAI Fast",
            "provider": "pollinations",
            "context_length": 128000,
        }
    ]
    conn = _FakeConn([], rows=[])

    async def _fake_get_shared_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(db_pool, "get_shared_pool", _fake_get_shared_pool)
    monkeypatch.setattr(llm, "_load_default_models", lambda: static)

    models = await llm.build_model_catalog()

    assert len(models) == 1
    # 无 DB 值时 build 层不写倍率字段;后段 list_models 才允许关键词推断兜底
    assert "points_multiplier" not in models[0]
    # 兜底推断仅在此刻生效:pollinations 命中免费档 = 0.0
    assert infer_points_multiplier("pollinations/openai-fast") == 0.0


@pytest.mark.asyncio
async def test_pollinations_bare_name_merges_and_keeps_db_multiplier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """真实形态回归:DB 裸名 openai-fast(provider=pollinations,倍率 1.00)与静态
    pollinations/openai-fast 对齐合并,目录倍率 = DB 1.00,不得回落免费档 0。
    """
    from app.core import db_pool
    from app.routers import llm

    static = [
        {
            "id": "pollinations/openai-fast",
            "name": "OpenAI Fast",
            "provider": "pollinations",
            "context_length": 128000,
            "caps": {"supports_stream_usage": True, "supports_tools": True},
        }
    ]
    conn = _FakeConn(
        [],
        rows=[
            {
                "model_id": "openai-fast",
                "display_name": "OpenAI Fast (Pollinations 永久免费)",
                "context_length": 128000,
                "provider_code": "pollinations",
                "release_date": None,
                "tags": ["chat"],
                "points_multiplier": "1.00",
                "metadata": None,
            }
        ],
    )

    async def _fake_get_shared_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(db_pool, "get_shared_pool", _fake_get_shared_pool)
    monkeypatch.setattr(llm, "_load_default_models", lambda: static)

    models = await llm.build_model_catalog()

    assert len(models) == 1
    entry = models[0]
    assert entry["id"] == "pollinations/openai-fast"
    # 回归钉死:期望 DB 1.00,不是免费推断档 0
    assert entry["points_multiplier"] == 1.0
    assert entry["provider"] == "pollinations"
    # 不得另留裸名重复条目
    assert not any(m["id"] == "openai-fast" for m in models)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
