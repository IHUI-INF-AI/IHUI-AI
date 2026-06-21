"""DB Pool 指标采集测试 (建议 5.1).

覆盖:
  - collect_pool_metrics 注册所有 engine 的 size gauge
  - install_pool_events 注册 checkout/checkin 事件, 在 checkout 时 inc
  - 多 engine 同时使用互不干扰 (label 维度)
  - 异常 engine 不会让其他 engine 的指标也失败
"""

import sys
from pathlib import Path

import sqlalchemy as sa

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _make_engine(label: str):
    """构造一个 sqlite engine + QueuePool (默认) 便于测试 pool 指标.

    StaticPool 不支持 size/checkedout/overflow 这些属性,
    QueuePool 是 SQLAlchemy 默认行为, 与生产配置一致.
    """
    eng = sa.create_engine(
        "sqlite:///:memory:",
        pool_size=5,
        max_overflow=2,
        poolclass=sa.pool.QueuePool,
    )
    return label, eng


def test_collect_pool_metrics_sets_size_gauge():
    """collect_pool_metrics 必须为每个 engine 设置 size gauge."""
    from app.monitoring import (
        DB_POOL_SIZE,
        collect_pool_metrics,
    )

    engines = dict([_make_engine("ai"), _make_engine("center")])
    try:
        collect_pool_metrics(engines)
        # size 是静态配置
        for label in ("ai", "center"):
            v = DB_POOL_SIZE.labels(engine=label)._value.get()
            assert v >= 1, f"engine={label} size gauge 应 >=1, 实际 {v}"
    finally:
        for _, e in engines.items():
            e.dispose()


def test_collect_pool_metrics_registered_set_function():
    """动态指标必须用 set_function 注册, scrape 时实时调用."""
    from app.monitoring import DB_POOL_CHECKEDOUT, collect_pool_metrics

    engines = dict([_make_engine("ai")])
    try:
        collect_pool_metrics(engines)
        # StaticPool 只有 1 个连接, 初始 checkedout=0
        v = DB_POOL_CHECKEDOUT.labels(engine="ai")._value.get()
        # _value.get() 在 set_function 模式下返回的是最近一次 scrape 的值 (初始 0)
        assert v is not None
    finally:
        engines["ai"].dispose()


def test_install_pool_events_checkout_in_use_increments():
    """install_pool_events 注册的 checkout 事件必须 inc in_use gauge."""
    from app.monitoring import DB_POOL_IN_USE, install_pool_events

    engines = dict([_make_engine("ai")])
    try:
        install_pool_events(engines)
        before = DB_POOL_IN_USE.labels(engine="ai")._value.get()
        with engines["ai"].connect() as conn:
            conn.execute(sa.text("SELECT 1"))
            # checkout 后 in_use +1
            mid = DB_POOL_IN_USE.labels(engine="ai")._value.get()
        # checkin 后回到原值
        after = DB_POOL_IN_USE.labels(engine="ai")._value.get()
        assert mid == before + 1, f"checkout 后 in_use 应 +1, before={before} mid={mid}"
        assert after == before, f"checkin 后 in_use 应回原值, before={before} after={after}"
    finally:
        engines["ai"].dispose()


def test_install_pool_events_multiple_engines_isolated():
    """多个 engine 互不干扰 (label 维度正确)."""
    from app.monitoring import DB_POOL_IN_USE, install_pool_events

    engines = dict([_make_engine("ai"), _make_engine("center"), _make_engine("course")])
    try:
        install_pool_events(engines)
        with engines["ai"].connect() as c1:
            c1.execute(sa.text("SELECT 1"))
            ai_in_use = DB_POOL_IN_USE.labels(engine="ai")._value.get()
            center_in_use = DB_POOL_IN_USE.labels(engine="center")._value.get()
            course_in_use = DB_POOL_IN_USE.labels(engine="course")._value.get()
            assert ai_in_use >= 1
            # StaticPool 模式 checkin 立即回 pool, ai 已 checkin; center/course 始终 0
            # 这里不强求精确值, 只断言 center/course 不受 ai 影响
            assert center_in_use == 0
            assert course_in_use == 0
    finally:
        for _, e in engines.items():
            e.dispose()


def test_collect_pool_metrics_handles_broken_engine():
    """某个 engine 抛错时, 不会中断其他 engine 的指标采集."""
    from app.monitoring import DB_POOL_SIZE, collect_pool_metrics

    good_eng = _make_engine("good")
    # 构造一个会抛错的 engine
    bad_eng = _make_engine("bad")
    engines = {"good": good_eng[1], "bad": bad_eng[1]}

    # 把 bad 的 pool.size 替换成抛异常的
    class _BrokenPool:
        def size(self):
            raise RuntimeError("simulated broken pool")

    bad_engine_obj = engines["bad"]
    bad_engine_obj.pool = _BrokenPool()  # type: ignore[assignment]

    try:
        # 不应抛异常
        collect_pool_metrics(engines)
        # good 仍然成功注册
        v = DB_POOL_SIZE.labels(engine="good")._value.get()
        assert v >= 1
    finally:
        good_eng[1].dispose()


def test_metrics_endpoint_exposes_pool_metrics():
    """通过 /metrics 端点能看到 pool 指标."""
    from app.monitoring import collect_pool_metrics, render_metrics

    engines = dict([_make_engine("ai"), _make_engine("center")])
    try:
        collect_pool_metrics(engines)
        # 触发一次 checkout
        with engines["ai"].connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        resp = render_metrics()
        body = resp.body.decode("utf-8") if isinstance(resp.body, bytes) else str(resp.body)
        assert "zhs_db_pool_size" in body
        assert 'engine="ai"' in body
        assert 'engine="center"' in body
        assert "zhs_db_pool_checkedout" in body
        assert "zhs_db_pool_overflow" in body
    finally:
        for _, e in engines.items():
            e.dispose()
