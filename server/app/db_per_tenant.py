"""多租户 per-tenant 引擎工厂 (建议 121).

设计:
  - 给定基础 engine + tenant_id, 返回带 schema_translate_map 的 engine
    - SQLAlchemy 自动把所有 ORM 查询的 `Table("admin_user", metadata)` 重写为
      `Table("admin_user", metadata, schema="tenant_X")` → PG 自动拼 `tenant_X.admin_user`
    - 业务代码 100% 不变, ORM 自动注入 schema
  - 引擎缓存: 同一个 (base_engine + tenant_id) 复用 engine + 连接池
  - 与 contextvar 集成: get_tenant_engine_for_current() 自动从 ContextVar 读 tid
  - 单租户模式: 直接返回原 engine, 零开销
  - 影子流量: 影子租户 (默认 2) 也有自己 schema
  - 优雅降级: 缓存失效 / 引擎创建失败 → 返回原 engine + 警告日志

性能:
  - LRU 缓存上限 ZHS_TENANT_ENGINE_CACHE_SIZE (默认 32)
  - schema 切换走 SQLAlchemy execution_options, 不增加 DB 往返
  - 连接池复用: 同一 tenant 多个请求共享 pool

用法:
    from app.db_per_tenant import get_tenant_engine_for_current

    @app.get("/api/v1/user/list")
    def list_users():
        engine = get_tenant_engine_for_current("ai")  # 自动从 ContextVar 读 tid
        with Session(bind=engine) as s:
            users = s.execute(text("SELECT * FROM admin_user LIMIT 10")).all()
        return users

    # FastAPI Depends 注入
    def get_db():
        engine = get_tenant_engine_for_current("ai")
        db = Session(bind=engine)
        try:
            yield db
        finally:
            db.close()
"""

from __future__ import annotations

import contextlib
import os
import threading
import time

from loguru import logger as _loguru_logger
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

# 复用已有 contextvar + 校验
from app.core.tenant import (
    _DEFAULT_TENANT_ID,
    get_current_tenant_id,
    get_tenant_schema_name,
    is_multi_tenant_enabled,
)

# ---------------------------------------------------------------------------
# 缓存: (base_engine_id, tenant_id) -> Engine
# ---------------------------------------------------------------------------

_TENANT_ENGINES: dict[tuple[int, int], Engine] = {}  # (base_engine_id, tid) -> engine
_TENANT_ENGINES_MAX = 32
_TENANT_ENGINES_LOCK = threading.RLock()

# engine 统计
_ENGINE_STATS: dict[tuple[int, int], dict] = {}  # (base_engine_id, tid) -> {created_at, last_used_at, use_count}


def _cache_size() -> int:
    try:
        return int(os.getenv("ZHS_TENANT_ENGINE_CACHE_SIZE", "32"))
    except Exception:
        return 32


def _evict_lru() -> None:
    """LRU 淘汰: 删 use_count 最少的 (base, tid)."""
    if len(_TENANT_ENGINES) <= _cache_size():
        return
    # 排序: use_count 升序, 取前 N 个淘汰
    items = sorted(
        _ENGINE_STATS.items(),
        key=lambda x: (x[1].get("use_count", 0), x[1].get("last_used_at", 0)),
    )
    evict_n = len(_TENANT_ENGINES) - _cache_size()
    for k, _ in items[:evict_n]:
        eng = _TENANT_ENGINES.pop(k, None)
        _ENGINE_STATS.pop(k, None)
        if eng is not None:
            with contextlib.suppress(Exception):
                eng.dispose()


# ---------------------------------------------------------------------------
# 核心: 创建 tenant engine
# ---------------------------------------------------------------------------


def _get_pool_config(base_engine: Engine) -> tuple[int, int, int]:
    """从 settings 读取池配置 (避免访问 SQLAlchemy pool 私有属性).

    根据 base_engine 匹配 ENGINES 字典, 返回对应的 (pool_size, max_overflow, pool_recycle)。
    """
    from app.config import settings
    from app.database import ENGINES

    if base_engine is ENGINES.get("center"):
        return settings.DB2_POOL_SIZE, settings.DB2_MAX_OVERFLOW, settings.DB2_POOL_RECYCLE
    if base_engine is ENGINES.get("course"):
        return settings.DB3_POOL_SIZE, settings.DB3_MAX_OVERFLOW, settings.DB3_POOL_RECYCLE
    # 默认 DB1 (ai)
    return settings.DB1_POOL_SIZE, settings.DB1_MAX_OVERFLOW, settings.DB1_POOL_RECYCLE


def get_tenant_engine(base_engine: Engine, tenant_id: int) -> Engine:
    """获取 tenant 专属 engine (带 schema_translate_map).

    - 命中缓存 → 复用
    - 未命中 → 克隆 base_engine URL, 加 schema_translate_map
    - tenant_id=1 (默认) 且单租户模式 → 返回原 base_engine
    """
    if not is_multi_tenant_enabled():
        return base_engine

    # 校验
    try:
        schema = get_tenant_schema_name(tenant_id)
    except ValueError as e:
        with contextlib.suppress(Exception):
            _loguru_logger.warning(f"[db_per_tenant] 非法 tenant_id={tenant_id}: {e}")
        return base_engine

    base_key = id(base_engine)
    cache_key = (base_key, tenant_id)

    with _TENANT_ENGINES_LOCK:
        if cache_key in _TENANT_ENGINES:
            # 命中: 更新统计
            _ENGINE_STATS.setdefault(cache_key, {"created_at": time.time(), "use_count": 0, "last_used_at": 0})
            _ENGINE_STATS[cache_key]["use_count"] += 1
            _ENGINE_STATS[cache_key]["last_used_at"] = time.time()
            return _TENANT_ENGINES[cache_key]

    # 创建新 engine (锁外, 慢路径)
    try:
        # 复用 base_engine 的 URL, 共享 pool 设置
        # 注意: SQLite 用 SingletonThreadPool, 不接受 pool_size/max_overflow
        url_str = str(base_engine.url)
        kwargs: dict = {
            "echo": base_engine.echo,
            # 关键: schema_translate_map 让 ORM 自动注入 schema
            "execution_options": {
                "schema_translate_map": {None: schema, "public": schema},
            },
        }
        # 仅非 SQLite 加 pool 参数
        if not url_str.startswith("sqlite"):
            try:
                pool_size, max_overflow, pool_recycle = _get_pool_config(base_engine)
                kwargs.update(
                    {
                        "pool_size": pool_size,
                        "max_overflow": max_overflow,
                        "pool_recycle": pool_recycle,
                        "pool_pre_ping": True,
                    }
                )
            except Exception:
                pass
        new_engine = create_engine(base_engine.url, **kwargs)
    except Exception as e:
        with contextlib.suppress(Exception):
            _loguru_logger.warning(f"[db_per_tenant] 创建 tenant engine 失败: {e}")
        return base_engine

    with _TENANT_ENGINES_LOCK:
        # 二次检查: 别的线程可能已创建
        if cache_key in _TENANT_ENGINES:
            with contextlib.suppress(Exception):
                new_engine.dispose()
            _ENGINE_STATS.setdefault(cache_key, {"created_at": time.time(), "use_count": 0, "last_used_at": 0})
            _ENGINE_STATS[cache_key]["use_count"] += 1
            _ENGINE_STATS[cache_key]["last_used_at"] = time.time()
            return _TENANT_ENGINES[cache_key]
        _TENANT_ENGINES[cache_key] = new_engine
        _ENGINE_STATS[cache_key] = {
            "created_at": time.time(),
            "use_count": 1,
            "last_used_at": time.time(),
            "schema": schema,
        }
        # 触发 LRU 淘汰
        _evict_lru()
        return new_engine


# ---------------------------------------------------------------------------
# 便捷: 从 ContextVar 自动读 tid
# ---------------------------------------------------------------------------


def get_tenant_engine_for_current(base_engine: Engine) -> Engine:
    """从 ContextVar 自动读 tid, 给 base engine 套上 schema.

    用法:
        engine = get_tenant_engine_for_current(engine1)
    """
    tid = get_current_tenant_id()
    if tid is None:
        # 后台任务 / Alembic / 单元测试, 走默认 1 (public schema)
        tid = _DEFAULT_TENANT_ID
    return get_tenant_engine(base_engine, tid)


def get_tenant_engine_for_current_by_name(engine_name: str) -> Engine:
    """从 engine 名 (ai/center/course) 拿 engine, 然后套 schema.

    engine_name: 'ai' | 'center' | 'course'
    """
    from app.database import ENGINES  # 延迟导入, 避免循环

    if engine_name not in ENGINES:
        raise KeyError(f"未知 engine 名: {engine_name}, 可选: {list(ENGINES.keys())}")
    return get_tenant_engine_for_current(ENGINES[engine_name])


# ---------------------------------------------------------------------------
# SessionLocal 工厂
# ---------------------------------------------------------------------------

_SESSION_MAKERS: dict[tuple[int, int], sessionmaker] = {}  # (base_engine_id, tid) -> sessionmaker
_SESSION_MAKERS_LOCK = threading.RLock()


def get_tenant_session_factory(base_engine: Engine, tenant_id: int) -> sessionmaker:
    """拿 tenant 专属 sessionmaker."""
    engine = get_tenant_engine(base_engine, tenant_id)
    cache_key = (id(base_engine), tenant_id)
    with _SESSION_MAKERS_LOCK:
        if cache_key in _SESSION_MAKERS:
            return _SESSION_MAKERS[cache_key]
    sm = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)
    with _SESSION_MAKERS_LOCK:
        _SESSION_MAKERS[cache_key] = sm
        return sm


def get_tenant_session_for_current(engine_name: str = "ai"):
    """FastAPI Depends: 从 ContextVar 自动读 tid, 返回 session.

    用法:
        @app.get("/api/v1/user/list")
        def list_users(db: Session = Depends(get_tenant_session_for_current)):
            ...
    """
    from app.core.tenant import _DEFAULT_TENANT_ID, get_current_tenant_id
    from app.database import ENGINES

    tid = get_current_tenant_id()
    if tid is None:
        tid = _DEFAULT_TENANT_ID
    sm = get_tenant_session_factory(ENGINES[engine_name], tid)
    db = sm()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        with contextlib.suppress(Exception):
            db.close()


# ---------------------------------------------------------------------------
# 健康检查 + 监控
# ---------------------------------------------------------------------------


def get_engine_cache_snapshot() -> dict:
    """快照: 监控 / 测试用."""
    now = time.time()
    with _TENANT_ENGINES_LOCK:
        engines = []
        for (base_id, tid), eng in _TENANT_ENGINES.items():
            stat = _ENGINE_STATS.get((base_id, tid), {})
            engines.append(
                {
                    "base_engine_id": base_id,
                    "tenant_id": tid,
                    "schema": stat.get("schema", f"tenant_{tid}"),
                    "created_at": stat.get("created_at", 0),
                    "use_count": stat.get("use_count", 0),
                    "last_used_at": stat.get("last_used_at", 0),
                    "idle_sec": round(now - stat.get("last_used_at", now), 1),
                    "url": str(eng.url).split("@")[-1],  # 隐藏密码
                }
            )
    return {
        "total": len(_TENANT_ENGINES),
        "max": _cache_size(),
        "engines": engines,
    }


def dispose_all_tenant_engines() -> int:
    """关闭所有缓存的 tenant engine (测试 / 优雅停机)."""
    n = 0
    with _TENANT_ENGINES_LOCK:
        for eng in _TENANT_ENGINES.values():
            try:
                eng.dispose()
                n += 1
            except Exception:
                pass
        _TENANT_ENGINES.clear()
        _ENGINE_STATS.clear()
    with _SESSION_MAKERS_LOCK:
        _SESSION_MAKERS.clear()
    return n


def evict_tenant_engine(tenant_id: int) -> int:
    """evict 某个 tenant_id 的所有 engine (schema 重建后)."""
    n = 0
    with _TENANT_ENGINES_LOCK:
        to_del = [k for k in _TENANT_ENGINES if k[1] == tenant_id]
        for k in to_del:
            eng = _TENANT_ENGINES.pop(k, None)
            _ENGINE_STATS.pop(k, None)
            if eng is not None:
                try:
                    eng.dispose()
                    n += 1
                except Exception:
                    pass
    with _SESSION_MAKERS_LOCK:
        sm_to_del = [k for k in _SESSION_MAKERS if k[1] == tenant_id]
        for k in sm_to_del:
            _SESSION_MAKERS.pop(k, None)
    return n


# ---------------------------------------------------------------------------
# 指标 (与建议 117/119 告警配套)
# ---------------------------------------------------------------------------

try:
    from prometheus_client import Counter, Gauge

    TENANT_ENGINE_HITS = Counter(
        "zhs_tenant_engine_cache_hits_total",
        "Tenant engine cache hits (建议 121)",
        ["event"],  # hit / miss / evict
    )

    TENANT_ENGINE_POOL_SIZE = Gauge(
        "zhs_tenant_engine_pool_size",
        "Tenant engine pool size (建议 121)",
        ["tenant_id"],
    )
except Exception:
    TENANT_ENGINE_HITS = None
    TENANT_ENGINE_POOL_SIZE = None
