# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道 · 存储后端工厂（环境变量驱动 + 诚实降级链）。

后端由环境变量 ``SAG2_STORE_BACKEND`` 决定（默认 ``memory``），可选
``postgres-tsvector``。本模块不改 config.py、不 import 任何第三方 DB 驱动：
PG 后端所需的 ``runner(sql, params)`` 由调用方注入，全部 SQL 与参数绑定都在
只读的 ``pg_store.py`` 内完成，这里只负责「选后端 + 构造 + 失败显式降级」。

降级纪律（与项目 pgvector → memory/file 链一致，绝不把降级伪装成成功）：

* 选 PG 但 runner 未提供 / 构造抛错 / ``ensure_schema()`` 失败 ⇒ 丢弃 PG
  对象，返回 ``LexicalIndex``（或注入的 mirror），并在返回对象上附着可自证的
  降级属性，同时由 ``build_store_with_status()`` 返回 status_dict；
* 运行时 DB 故障由 ``PgTsVectorStore`` 自己回退内存镜像（保留对象、置
  degraded），本工厂不介入，``resolve_store_status()`` 统一读得出；
* 任何降级都带 ``degraded=True`` 与非空 ``reason``，绝不静默吞异常。
"""

from __future__ import annotations

import os
from typing import Any, Final

from .index import LexicalIndex
from .pg_store import PgTsVectorStore, SqlRunner

__all__ = [
    "BACKEND_MEMORY",
    "BACKEND_POSTGRES",
    "ENV_STORE_BACKEND",
    "build_store",
    "build_store_with_status",
    "resolve_store_status",
]

ENV_STORE_BACKEND: Final = "SAG2_STORE_BACKEND"
BACKEND_MEMORY: Final = "memory"
BACKEND_POSTGRES: Final = "postgres-tsvector"

# 工厂在返回对象上留下的自证属性（用 getattr/setattr 读写，避免改动
# LexicalIndex / PgTsVectorStore 的类型定义）。
_ATTR_REQUESTED: Final = "_sag2_requested_backend"
_ATTR_EFFECTIVE: Final = "_sag2_effective_backend"
_ATTR_DEGRADED: Final = "_sag2_factory_degraded"
_ATTR_REASON: Final = "_sag2_factory_reason"

# 与 service.status() / pg_store.status() 对齐的状态字典形状。
StoreStatus = dict[str, Any]


def _status(
    requested: str,
    effective: str,
    degraded: bool,
    reason: str,
) -> StoreStatus:
    """构造统一的降级自证字典（``backend`` 为 effective 的别名，便于直读）。"""
    return {
        "backend": effective,
        "requested_backend": requested,
        "effective_backend": effective,
        "degraded": bool(degraded),
        "reason": reason,
        "degrade_reason": reason,
    }


def _attach(
    store: object,
    requested: str,
    effective: str,
    degraded: bool,
    reason: str,
) -> None:
    """在返回对象上留下可自证的降级信息（build_store 单独返回时也能查）。"""
    setattr(store, _ATTR_REQUESTED, requested)
    setattr(store, _ATTR_EFFECTIVE, effective)
    setattr(store, _ATTR_DEGRADED, bool(degraded))
    setattr(store, _ATTR_REASON, reason)


def resolve_store_status(store: object) -> StoreStatus:
    """统一读取降级态：兼容工厂构造期降级（附着属性）与 PG 运行期降级（自带字段）。

    未经工厂的对象按自身类型推断 requested/effective；经过工厂降级回退的
    ``LexicalIndex`` 也带着工厂附着的 requested/degraded/reason，读得出来。
    """
    requested = getattr(store, _ATTR_REQUESTED, None)
    effective = getattr(store, _ATTR_EFFECTIVE, None)
    factory_degraded = bool(getattr(store, _ATTR_DEGRADED, False))
    factory_reason = str(getattr(store, _ATTR_REASON, "") or "")
    runtime_degraded = bool(getattr(store, "degraded", False))
    runtime_reason = str(getattr(store, "degrade_reason", "") or "")

    degraded = factory_degraded or runtime_degraded
    reason = factory_reason or runtime_reason
    is_pg = isinstance(store, PgTsVectorStore)
    if requested is None:
        requested = BACKEND_POSTGRES if is_pg else BACKEND_MEMORY
    if effective is None:
        effective = BACKEND_POSTGRES if is_pg else BACKEND_MEMORY
    return _status(str(requested), str(effective), degraded, reason)


def _memory_store(mirror: LexicalIndex | None) -> LexicalIndex:
    return mirror if mirror is not None else LexicalIndex()


def _degrade(
    mirror: LexicalIndex | None,
    requested: str,
    reason: str,
) -> tuple[LexicalIndex, StoreStatus]:
    """显式降级：返回纯内存 LexicalIndex + 带 degraded=True 的状态，绝不伪装成功。"""
    store = _memory_store(mirror)
    status = _status(requested, BACKEND_MEMORY, True, reason)
    _attach(store, requested, BACKEND_MEMORY, True, reason)
    return store, status


def build_store_with_status(
    backend: str | None = None,
    *,
    runner: SqlRunner | None = None,
    mirror: LexicalIndex | None = None,
) -> tuple[LexicalIndex | PgTsVectorStore, StoreStatus]:
    """按 ``backend``（None 时读 ``SAG2_STORE_BACKEND``）构造存储并返回 (store, status)。

    显式 ``backend`` 参数优先于环境变量，便于测试与调用方注入。未知后端、
    runner 缺失、构造异常、``ensure_schema()`` 失败一律显式降级，绝不抛给调用方。
    """
    raw = backend if backend is not None else os.environ.get(ENV_STORE_BACKEND, "")
    requested = (raw or "").strip() or BACKEND_MEMORY

    if requested == BACKEND_MEMORY:
        store = _memory_store(mirror)
        status = _status(BACKEND_MEMORY, BACKEND_MEMORY, False, "")
        _attach(store, BACKEND_MEMORY, BACKEND_MEMORY, False, "")
        return store, status

    if requested != BACKEND_POSTGRES:
        return _degrade(
            mirror,
            requested,
            f"未知后端 {requested!r}；显式降级回 {BACKEND_MEMORY}",
        )

    if runner is None:
        return _degrade(
            mirror,
            requested,
            f"请求后端 {BACKEND_POSTGRES} 但未提供 runner；显式降级回 {BACKEND_MEMORY}",
        )

    # 构造失败必须降级，不得静默（与 pg_store 的诚实降级同一纪律）。
    try:
        candidate = PgTsVectorStore(runner, mirror=mirror, ensure_schema=False)
    except Exception as exc:
        return _degrade(
            mirror,
            requested,
            f"{BACKEND_POSTGRES} 构造失败({type(exc).__name__}): {exc}；"
            f"显式降级回 {BACKEND_MEMORY}",
        )

    # ensure_schema 失败（含 runner 抛错 / 返回畸形）⇒ 丢弃 PG 对象，回纯内存。
    try:
        schema_ok = candidate.ensure_schema()
    except Exception as exc:
        return _degrade(
            mirror,
            requested,
            f"{BACKEND_POSTGRES} ensure_schema() 抛错({type(exc).__name__}): {exc}；"
            f"显式降级回 {BACKEND_MEMORY}",
        )
    if not schema_ok:
        detail = candidate.degrade_reason or "DDL 未全部确认"
        return _degrade(
            mirror,
            requested,
            f"{BACKEND_POSTGRES} ensure_schema() 失败（{detail}）；"
            f"显式降级回 {BACKEND_MEMORY}",
        )

    status = _status(
        requested,
        BACKEND_POSTGRES,
        candidate.degraded,
        candidate.degrade_reason,
    )
    _attach(
        candidate,
        requested,
        BACKEND_POSTGRES,
        candidate.degraded,
        candidate.degrade_reason,
    )
    return candidate, status


def build_store(
    backend: str | None = None,
    *,
    runner: SqlRunner | None = None,
    mirror: LexicalIndex | None = None,
) -> LexicalIndex | PgTsVectorStore:
    """构造存储后端；降级信息留在返回对象上（用 ``resolve_store_status`` 读）。"""
    store, _ = build_store_with_status(backend, runner=runner, mirror=mirror)
    return store

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
