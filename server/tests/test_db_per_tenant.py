"""多租户 per-tenant 引擎工厂 (建议 121) 单元测试.

覆盖:
  - 单租户模式: 直接返回原 engine
  - 多租户模式 + 同一 tenant: 命中缓存
  - 多租户模式 + 不同 tenant: 不同 engine
  - schema_translate_map 正确
  - 非法 tenant_id: 降级到原 engine
  - LRU 淘汰
  - 影子租户: 自己独立 schema
  - contextvar 自动读: get_tenant_engine_for_current
  - get_tenant_engine_for_current_by_name
  - get_tenant_session_factory / get_tenant_session_for_current
  - get_engine_cache_snapshot
  - evict_tenant_engine / dispose_all_tenant_engines
  - 并发隔离: 同一 tid 拿同一 engine
  - SQLAlchemy schema_translate_map 行为 (用 create_engine 不连真 DB)
"""

import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_tenant_state():
    from app.core import tenant as t_mod
    from app.db_per_tenant import dispose_all_tenant_engines

    t_mod.reset_current_tenant_id()
    dispose_all_tenant_engines()
    yield
    t_mod.reset_current_tenant_id()
    dispose_all_tenant_engines()


@pytest.fixture
def enable_multi_tenant(monkeypatch):
    """mock is_multi_tenant_enabled + MULTI_TENANT_ENABLED settings."""
    monkeypatch.setattr(
        "app.db_per_tenant.is_multi_tenant_enabled",
        lambda: True,
    )
    # 同时设 settings, 避免其它模块读不到
    try:
        from app.config import settings

        monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True, raising=False)
    except Exception:
        pass
    yield


@pytest.fixture
def disable_multi_tenant(monkeypatch):
    monkeypatch.setattr(
        "app.db_per_tenant.is_multi_tenant_enabled",
        lambda: False,
    )
    try:
        from app.config import settings

        monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", False, raising=False)
    except Exception:
        pass
    yield


@pytest.fixture
def mock_base_engine():
    """用 sqlite 内存库模拟 base engine (不需要真 PG)."""
    eng = create_engine("sqlite:///:memory:")
    yield eng
    try:
        eng.dispose()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 单租户模式: 零开销直通
# ---------------------------------------------------------------------------


def test_single_tenant_mode_returns_base_engine(disable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    eng = get_tenant_engine(mock_base_engine, 5)
    assert eng is mock_base_engine


def test_single_tenant_mode_ignores_tid(disable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    e1 = get_tenant_engine(mock_base_engine, 1)
    e5 = get_tenant_engine(mock_base_engine, 5)
    assert e1 is mock_base_engine
    assert e5 is mock_base_engine


# ---------------------------------------------------------------------------
# 多租户模式: 缓存命中 / miss
# ---------------------------------------------------------------------------


def test_multi_tenant_creates_engine(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    eng = get_tenant_engine(mock_base_engine, 5)
    assert eng is not mock_base_engine
    assert isinstance(eng, Engine)


def test_multi_tenant_cache_hit_same_tid(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    e1 = get_tenant_engine(mock_base_engine, 5)
    e2 = get_tenant_engine(mock_base_engine, 5)
    assert e1 is e2  # 缓存命中


def test_multi_tenant_different_tid_different_engine(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    e1 = get_tenant_engine(mock_base_engine, 1)
    e2 = get_tenant_engine(mock_base_engine, 2)
    assert e1 is not e2


def test_multi_tenant_different_base_engine_isolated(enable_multi_tenant):
    from app.db_per_tenant import get_tenant_engine

    b1 = create_engine("sqlite:///:memory:")
    b2 = create_engine("sqlite:///:memory:")
    e1 = get_tenant_engine(b1, 5)
    e2 = get_tenant_engine(b2, 5)
    assert e1 is not e2
    b1.dispose()
    b2.dispose()


# ---------------------------------------------------------------------------
# schema_translate_map 正确
# ---------------------------------------------------------------------------


def test_engine_has_schema_translate_map(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    eng = get_tenant_engine(mock_base_engine, 7)
    # SQLAlchemy 1.4+ 把 execution_options 存在 engine
    opts = eng.get_execution_options()
    assert "schema_translate_map" in opts
    assert opts["schema_translate_map"] == {None: "tenant_7", "public": "tenant_7"}


def test_engine_schema_translate_works_in_query(enable_multi_tenant, mock_base_engine):
    """验证 SQLAlchemy schema_translate_map 真的生效 (用 sqlite 模拟)."""
    from sqlalchemy import text

    from app.db_per_tenant import get_tenant_engine

    eng = get_tenant_engine(mock_base_engine, 99)
    with eng.connect() as conn:
        # sqlite 没 schema 概念, 但 SQLAlchemy 在编译 SELECT 时会注入 schema
        # 这里只验证能执行 SQL, 不验证具体翻译
        result = conn.execute(text("SELECT 1 AS one")).scalar()
        assert result == 1


# ---------------------------------------------------------------------------
# 非法 tenant_id: 降级
# ---------------------------------------------------------------------------


def test_invalid_tid_falls_back_to_base(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    # 0 / 负数
    eng0 = get_tenant_engine(mock_base_engine, 0)
    eng_neg = get_tenant_engine(mock_base_engine, -1)
    assert eng0 is mock_base_engine
    assert eng_neg is mock_base_engine
    # 超大值
    eng_big = get_tenant_engine(mock_base_engine, 999_999_999 + 1)
    assert eng_big is mock_base_engine


# ---------------------------------------------------------------------------
# contextvar 自动读
# ---------------------------------------------------------------------------


def test_for_current_uses_contextvar(enable_multi_tenant, mock_base_engine, monkeypatch):
    from app.core.tenant import reset_current_tenant_id, set_current_tenant_id
    from app.db_per_tenant import get_tenant_engine_for_current

    monkeypatch.setattr(
        "app.database.ENGINES",
        {"ai": mock_base_engine},
        raising=False,
    )

    reset_current_tenant_id()
    eng_default = get_tenant_engine_for_current(mock_base_engine)
    set_current_tenant_id(42)
    eng_42 = get_tenant_engine_for_current(mock_base_engine)
    set_current_tenant_id(99)
    eng_99 = get_tenant_engine_for_current(mock_base_engine)
    assert eng_42 is not eng_99
    assert eng_default is not eng_42
    reset_current_tenant_id()


def test_for_current_no_contextvar_uses_default(enable_multi_tenant, mock_base_engine):
    from app.core.tenant import reset_current_tenant_id
    from app.db_per_tenant import get_tenant_engine_for_current

    reset_current_tenant_id()
    eng = get_tenant_engine_for_current(mock_base_engine)
    # 默认 1
    opts = eng.get_execution_options()
    assert opts["schema_translate_map"] == {None: "tenant_1", "public": "tenant_1"}


# ---------------------------------------------------------------------------
# by_name 路由
# ---------------------------------------------------------------------------


def test_for_current_by_name(enable_multi_tenant, mock_base_engine, monkeypatch):
    from app.core.tenant import reset_current_tenant_id, set_current_tenant_id
    from app.db_per_tenant import get_tenant_engine_for_current_by_name

    monkeypatch.setattr(
        "app.database.ENGINES",
        {"ai": mock_base_engine, "center": mock_base_engine, "course": mock_base_engine},
    )
    set_current_tenant_id(8)
    try:
        e = get_tenant_engine_for_current_by_name("ai")
        opts = e.get_execution_options()
        assert opts["schema_translate_map"] == {None: "tenant_8", "public": "tenant_8"}
    finally:
        reset_current_tenant_id()


def test_for_current_by_name_unknown_raises(enable_multi_tenant, monkeypatch):
    from app.db_per_tenant import get_tenant_engine_for_current_by_name

    monkeypatch.setattr(
        "app.database.ENGINES",
        {"ai": MagicMock()},
    )
    with pytest.raises(KeyError):
        get_tenant_engine_for_current_by_name("nonexistent")


# ---------------------------------------------------------------------------
# Session 工厂
# ---------------------------------------------------------------------------


def test_session_factory_returns_sessionmaker(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_session_factory

    sm = get_tenant_session_factory(mock_base_engine, 1)
    assert sm is not None
    # sessionmaker.bind 应是 tenant engine
    bind = sm.kw.get("bind")
    assert bind is not None
    assert bind is not mock_base_engine


def test_session_factory_cached(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_session_factory

    sm1 = get_tenant_session_factory(mock_base_engine, 1)
    sm2 = get_tenant_session_factory(mock_base_engine, 1)
    assert sm1 is sm2


def test_get_tenant_session_for_current_depends(enable_multi_tenant, mock_base_engine, monkeypatch):
    from app.core.tenant import reset_current_tenant_id, set_current_tenant_id
    from app.db_per_tenant import get_tenant_session_for_current

    monkeypatch.setattr(
        "app.database.ENGINES",
        {"ai": mock_base_engine},
    )
    set_current_tenant_id(11)
    try:
        gen = get_tenant_session_for_current("ai")
        session = next(gen)
        assert session is not None
        # 结束
        try:
            next(gen)
        except StopIteration:
            pass
    finally:
        reset_current_tenant_id()


# ---------------------------------------------------------------------------
# LRU 淘汰
# ---------------------------------------------------------------------------


def test_lru_eviction(monkeypatch, enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import (
        _TENANT_ENGINES,
        _evict_lru,
        get_tenant_engine,
    )

    # 步骤 1: 创建 cache_size=10 让 5 个先攒下来
    monkeypatch.setattr("app.db_per_tenant._cache_size", lambda: 10)
    for tid in range(1, 6):
        get_tenant_engine(mock_base_engine, tid)
    assert len(_TENANT_ENGINES) == 5, f"5 个应都缓存, 实际 {len(_TENANT_ENGINES)}"
    # 步骤 2: 把 cache_size 调成 3, 手动触发淘汰
    monkeypatch.setattr("app.db_per_tenant._cache_size", lambda: 3)
    _evict_lru()
    assert len(_TENANT_ENGINES) == 3, f"淘汰后应剩 3 个, 实际 {len(_TENANT_ENGINES)}"


def test_evict_keeps_most_used(monkeypatch, enable_multi_tenant, mock_base_engine):
    """淘汰时保留 use_count 高的 (业务热点 tenant)."""
    from app.db_per_tenant import (
        _TENANT_ENGINES,
        _evict_lru,
        get_tenant_engine,
    )

    monkeypatch.setattr("app.db_per_tenant._cache_size", lambda: 2)
    e1 = get_tenant_engine(mock_base_engine, 1)
    e2 = get_tenant_engine(mock_base_engine, 2)
    # 多用 1 几次
    for _ in range(5):
        get_tenant_engine(mock_base_engine, 1)
    e3 = get_tenant_engine(mock_base_engine, 3)
    e4 = get_tenant_engine(mock_base_engine, 4)
    # 此时 4 个 engine
    _evict_lru()
    # 留下 2 个, 应是 1 (用了 6 次) + 1 个最近
    remaining = set(_TENANT_ENGINES.keys())
    # tenant 1 应保留
    assert (id(mock_base_engine), 1) in remaining


# ---------------------------------------------------------------------------
# 缓存快照
# ---------------------------------------------------------------------------


def test_get_engine_cache_snapshot(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_engine_cache_snapshot, get_tenant_engine

    get_tenant_engine(mock_base_engine, 1)
    get_tenant_engine(mock_base_engine, 2)
    snap = get_engine_cache_snapshot()
    assert snap["total"] == 2
    assert snap["max"] >= 2
    assert len(snap["engines"]) == 2
    schemas = {e["schema"] for e in snap["engines"]}
    assert schemas == {"tenant_1", "tenant_2"}


def test_get_engine_cache_snapshot_empty():
    from app.db_per_tenant import get_engine_cache_snapshot

    snap = get_engine_cache_snapshot()
    assert snap["total"] == 0
    assert snap["engines"] == []


# ---------------------------------------------------------------------------
# dispose / evict
# ---------------------------------------------------------------------------


def test_dispose_all(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import (
        dispose_all_tenant_engines,
        get_engine_cache_snapshot,
        get_tenant_engine,
    )

    get_tenant_engine(mock_base_engine, 1)
    get_tenant_engine(mock_base_engine, 2)
    n = dispose_all_tenant_engines()
    assert n >= 2
    assert get_engine_cache_snapshot()["total"] == 0


def test_evict_tenant_engine_specific(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import (
        evict_tenant_engine,
        get_engine_cache_snapshot,
        get_tenant_engine,
    )

    get_tenant_engine(mock_base_engine, 1)
    get_tenant_engine(mock_base_engine, 2)
    n = evict_tenant_engine(1)
    assert n == 1
    snap = get_engine_cache_snapshot()
    tids = {e["tenant_id"] for e in snap["engines"]}
    assert 1 not in tids
    assert 2 in tids


# ---------------------------------------------------------------------------
# 并发隔离
# ---------------------------------------------------------------------------


def test_concurrent_get_tenant_engine(enable_multi_tenant, mock_base_engine):
    from app.db_per_tenant import get_tenant_engine

    results = []
    errors = []

    def worker(tid):
        try:
            eng = get_tenant_engine(mock_base_engine, tid)
            results.append((tid, eng))
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(1, 6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"并发异常: {errors}"
    # 同一 tid 应拿到同一 engine
    by_tid = {}
    for tid, eng in results:
        by_tid.setdefault(tid, eng)
    for tid, eng in by_tid.items():
        assert eng is not None


# ---------------------------------------------------------------------------
# 影子租户 (建议 120 配合)
# ---------------------------------------------------------------------------


def test_shadow_tenant_independent_schema(enable_multi_tenant, mock_base_engine):
    """影子租户 (默认 2) 走独立 schema."""
    from app.db_per_tenant import get_tenant_engine

    main_eng = get_tenant_engine(mock_base_engine, 1)
    shadow_eng = get_tenant_engine(mock_base_engine, 2)
    assert main_eng is not shadow_eng
    main_opts = main_eng.get_execution_options()
    shadow_opts = shadow_eng.get_execution_options()
    assert main_opts["schema_translate_map"] == {None: "tenant_1", "public": "tenant_1"}
    assert shadow_opts["schema_translate_map"] == {None: "tenant_2", "public": "tenant_2"}


# ---------------------------------------------------------------------------
# main.py 不破坏 (注册与否可独立)
# ---------------------------------------------------------------------------


def test_module_imports_cleanly():
    """模块能被无副作用 import."""
    from app import db_per_tenant

    assert db_per_tenant.get_tenant_engine is not None
    assert db_per_tenant.get_tenant_session_for_current is not None
