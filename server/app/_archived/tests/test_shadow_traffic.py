"""影子流量 (建议 120) 单元测试.

覆盖:
  - 配置 (env 读取)
  - 比对核心: status / body / keys / length / 异常
  - 归一化: 易变字段 (timestamp / request_id) 屏蔽
  - ShadowRouter: should_shadow 比率
  - ShadowRouter.run: 主 / 影子并行 + 异步比对
  - ShadowRouter: 主流程不阻塞 (影子超时)
  - ShadowRouter: history 环形缓冲
  - 指标上报: prometheus counter
  - 聚合器: 窗口聚合
  - 聚合器: 3 档分级 (clean / field / body / magnitude)
  - 聚合器: 启动 / 停止 / 增量聚合
"""

import asyncio
import os
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_shadow():
    """清空默认 router + history."""
    try:
        from app.shadow_traffic import reset_default_router

        reset_default_router()
    except Exception:
        pass
    yield
    try:
        from app.shadow_traffic import reset_default_router

        reset_default_router()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 配置 (env 读取)
# ---------------------------------------------------------------------------


def test_ratio_default_zero():
    from app.shadow_traffic import _ratio

    os.environ.pop("ZHS_SHADOW_TRAFFIC_RATIO", None)
    assert _ratio() == 0.0


def test_ratio_from_env():
    from app.shadow_traffic import _ratio

    os.environ["ZHS_SHADOW_TRAFFIC_RATIO"] = "0.1"
    assert _ratio() == 0.1
    del os.environ["ZHS_SHADOW_TRAFFIC_RATIO"]


def test_shadow_tenant_id_default():
    from app.shadow_traffic import _shadow_tenant_id

    os.environ.pop("ZHS_SHADOW_TENANT_ID", None)
    assert _shadow_tenant_id() == 2


def test_shadow_tenant_id_from_env():
    from app.shadow_traffic import _shadow_tenant_id

    os.environ["ZHS_SHADOW_TENANT_ID"] = "5"
    assert _shadow_tenant_id() == 5
    del os.environ["ZHS_SHADOW_TENANT_ID"]


def test_enabled_zero_ratio():
    from app.shadow_traffic import _enabled

    os.environ.pop("ZHS_SHADOW_TRAFFIC_RATIO", None)
    assert _enabled() is False


def test_enabled_positive_ratio():
    from app.shadow_traffic import _enabled

    os.environ["ZHS_SHADOW_TRAFFIC_RATIO"] = "0.05"
    assert _enabled() is True
    del os.environ["ZHS_SHADOW_TRAFFIC_RATIO"]


# ---------------------------------------------------------------------------
# 工具函数: hash / keys / length / normalize
# ---------------------------------------------------------------------------


def test_hash_body_bytes():
    from app.shadow_traffic import _hash_body

    h = _hash_body(b"hello")
    assert len(h) == 16
    assert _hash_body(b"hello") == h
    assert _hash_body(b"world") != h


def test_hash_body_str():
    from app.shadow_traffic import _hash_body

    assert _hash_body("hello") == _hash_body("hello")
    assert _hash_body("hello") == _hash_body(b"hello")


def test_hash_body_dict_sorted():
    from app.shadow_traffic import _hash_body

    assert _hash_body({"a": 1, "b": 2}) == _hash_body({"b": 2, "a": 1})


def test_hash_body_list():
    from app.shadow_traffic import _hash_body

    assert _hash_body([1, 2, 3]) == _hash_body([1, 2, 3])
    assert _hash_body([1, 2, 3]) != _hash_body([3, 2, 1])


def test_hash_body_none():
    from app.shadow_traffic import _hash_body

    assert _hash_body(None) == ""


def test_json_keys_dict():
    from app.shadow_traffic import _json_keys

    assert _json_keys({"a": 1, "b": 2, "c": 3}) == ("a", "b", "c")
    assert _json_keys({}) == ()


def test_json_keys_list_of_dicts():
    from app.shadow_traffic import _json_keys

    assert _json_keys([{"a": 1, "b": 2}, {"a": 3, "b": 4}]) == ("a", "b")
    assert _json_keys([1, 2, 3]) == ()


def test_list_length():
    from app.shadow_traffic import _list_length

    assert _list_length([1, 2, 3]) == 3
    assert _list_length([]) == 0
    assert _list_length({"a": 1}) == 0
    assert _list_length("abc") == 0


def test_normalize_strips_timestamp():
    from app.shadow_traffic import _normalize_for_compare

    a = _normalize_for_compare({"name": "x", "timestamp": 12345})
    b = _normalize_for_compare({"name": "x", "timestamp": 67890})
    assert a == b  # timestamp 被屏蔽


def test_normalize_strips_request_id():
    from app.shadow_traffic import _normalize_for_compare

    a = _normalize_for_compare({"id": 1, "request_id": "aaa"})
    b = _normalize_for_compare({"id": 1, "request_id": "bbb"})
    assert a == b


def test_normalize_keeps_business_data():
    from app.shadow_traffic import _normalize_for_compare

    a = _normalize_for_compare({"id": 1, "name": "foo"})
    b = _normalize_for_compare({"id": 1, "name": "foo"})
    assert a == b
    c = _normalize_for_compare({"id": 2, "name": "foo"})
    assert a != c


def test_normalize_passthrough_non_json():
    from app.shadow_traffic import _normalize_for_compare

    assert _normalize_for_compare("plain text") == "plain text"
    assert _normalize_for_compare(42) == 42


# ---------------------------------------------------------------------------
# 比对核心: compare_responses
# ---------------------------------------------------------------------------


def test_compare_match_dict():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={"id": 1, "name": "x"})
    shadow = ShadowResponse(status_code=200, body={"id": 1, "name": "x"})
    cmp = compare_responses(main, shadow, endpoint="GET /a", tenant_id="1")
    assert cmp.diff_kind == DiffKind.MATCH


def test_compare_mismatch_status():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={"id": 1})
    shadow = ShadowResponse(status_code=500, body={"id": 1})
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MISMATCH_STATUS


def test_compare_mismatch_body():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={"id": 1, "name": "x"})
    shadow = ShadowResponse(status_code=200, body={"id": 1, "name": "y"})
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MISMATCH_BODY


def test_compare_mismatch_keys():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={"a": 1, "b": 2})
    shadow = ShadowResponse(status_code=200, body={"a": 1, "c": 2})
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MISMATCH_KEYS
    assert cmp.main_keys == ("a", "b")
    assert cmp.shadow_keys == ("a", "c")


def test_compare_mismatch_length():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body=[{"a": 1}, {"a": 2}, {"a": 3}])
    shadow = ShadowResponse(status_code=200, body=[{"a": 1}, {"a": 2}])
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MISMATCH_LENGTH
    assert cmp.main_length == 3
    assert cmp.shadow_length == 2


def test_compare_error_main():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(error=RuntimeError("db down"))
    shadow = ShadowResponse(status_code=200, body={})
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.ERROR_MAIN


def test_compare_error_shadow():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={})
    shadow = ShadowResponse(error=RuntimeError("timeout"))
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.ERROR_SHADOW


def test_compare_both_error():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(error=RuntimeError("a"))
    shadow = ShadowResponse(error=RuntimeError("b"))
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MISMATCH_STATUS  # 双错归到 status


def test_compare_normalizes_volatile_fields():
    from app.shadow_traffic import DiffKind, ShadowResponse, compare_responses

    main = ShadowResponse(status_code=200, body={"id": 1, "timestamp": 12345, "request_id": "aaa"})
    shadow = ShadowResponse(status_code=200, body={"id": 1, "timestamp": 67890, "request_id": "bbb"})
    cmp = compare_responses(main, shadow)
    assert cmp.diff_kind == DiffKind.MATCH  # 易变字段被屏蔽


def test_compare_writes_metrics():
    """比对时应写 prometheus counter."""
    from app.shadow_traffic import (
        SHADOW_COMPARE_TOTAL,
        ShadowResponse,
        compare_responses,
    )

    if SHADOW_COMPARE_TOTAL is None:
        pytest.skip("prometheus_client 不可用")
    main = ShadowResponse(status_code=200, body={"x": 1})
    shadow = ShadowResponse(status_code=200, body={"x": 1})
    # 不应抛
    compare_responses(main, shadow, tenant_id="metrics_test_1")
    # 至少能取到 counter
    val = SHADOW_COMPARE_TOTAL.labels(tenant_id="metrics_test_1", diff_kind="match")._value.get()
    assert val >= 1


# ---------------------------------------------------------------------------
# ShadowRouter
# ---------------------------------------------------------------------------


def test_router_init_ratio_zero():
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=0.0)
    assert r.ratio == 0.0
    assert r.should_shadow() is False


def test_router_should_shadow_with_ratio():
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=1.0)
    assert r.should_shadow() is True
    r2 = ShadowRouter(ratio=0.0)
    assert r2.should_shadow() is False


def test_router_run_match():
    """主 / 影子响应一致 → 异步比对结果 MATCH."""
    from app.shadow_traffic import DiffKind, ShadowResponse, ShadowRouter

    async def main():
        return ShadowResponse(status_code=200, body={"id": 1})

    async def shadow():
        return ShadowResponse(status_code=200, body={"id": 1})

    async def _run():
        router = ShadowRouter(ratio=1.0)
        await router.run(main, shadow, endpoint="GET /a", tenant_id="t1")
        # 等异步 task 完成
        await asyncio.sleep(0.2)
        history = router.get_history(last=10)
        return history

    history = asyncio.run(_run())
    assert len(history) == 1
    assert history[0]["diff_kind"] == DiffKind.MATCH.value


def test_router_run_mismatch():
    from app.shadow_traffic import DiffKind, ShadowResponse, ShadowRouter

    async def main():
        return ShadowResponse(status_code=200, body={"id": 1})

    async def shadow():
        return ShadowResponse(status_code=500, body={"err": "x"})

    async def _run():
        router = ShadowRouter(ratio=1.0)
        await router.run(main, shadow, endpoint="GET /a", tenant_id="t1")
        await asyncio.sleep(0.2)
        return router.get_history()

    history = asyncio.run(_run())
    assert history[0]["diff_kind"] == DiffKind.MISMATCH_STATUS.value


def test_router_does_not_block_main():
    """影子慢, 主响应不应等待."""
    from app.shadow_traffic import ShadowResponse, ShadowRouter

    main_done = [False]
    shadow_started = [False]

    async def main():
        main_done[0] = True
        return ShadowResponse(status_code=200, body={"x": 1})

    async def shadow():
        shadow_started[0] = True
        await asyncio.sleep(0.3)  # 影子慢
        return ShadowResponse(status_code=200, body={"x": 1})

    async def _run():
        router = ShadowRouter(ratio=1.0)
        t0 = time.time()
        await router.run(main, shadow, endpoint="GET /a", tenant_id="t1")
        elapsed = time.time() - t0
        return elapsed, main_done[0], shadow_started[0]

    elapsed, main_done_flag, _ = asyncio.run(_run())
    assert main_done_flag is True
    assert elapsed < 0.2  # 主流程没等影子 (0.3s)


def test_router_shadow_timeout_handled():
    """影子超时, 应记录 ERROR_SHADOW, 主流程不挂."""
    from app.shadow_traffic import DiffKind, ShadowResponse, ShadowRouter

    async def main():
        return ShadowResponse(status_code=200, body={"x": 1})

    async def shadow():
        await asyncio.sleep(5)  # 模拟超时
        return ShadowResponse(status_code=200, body={})

    async def _run():
        router = ShadowRouter(ratio=1.0)
        await router.run(main, shadow, endpoint="GET /a", tenant_id="t1", timeout=0.1)  # 100ms 超时
        await asyncio.sleep(0.3)
        return router.get_history()

    history = asyncio.run(_run())
    assert history[0]["diff_kind"] == DiffKind.ERROR_SHADOW.value


def test_router_history_ring_buffer():
    from app.shadow_traffic import ShadowCompare, ShadowRouter

    r = ShadowRouter(ratio=1.0)
    r._history_max = 5

    async def _push():
        for i in range(10):
            await r._record(ShadowCompare(endpoint=f"e{i}"))

    asyncio.run(_push())
    assert len(r._history) == 5
    assert r._history[0].endpoint == "e5"  # 5-9 保留


def test_router_get_stats_empty():
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter()
    stats = r.get_stats()
    assert stats["total"] == 0
    assert stats["match"] == 0


def test_router_get_stats_with_data():
    from app.shadow_traffic import DiffKind, ShadowCompare, ShadowRouter

    r = ShadowRouter()
    r._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    r._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    r._history.append(ShadowCompare(diff_kind=DiffKind.MISMATCH_BODY))
    stats = r.get_stats()
    assert stats["total"] == 3
    assert stats["match"] == 2
    assert stats["mismatch"] == 1
    assert stats["match_rate"] == 2 / 3


def test_router_clear_history():
    from app.shadow_traffic import DiffKind, ShadowCompare, ShadowRouter

    r = ShadowRouter()
    r._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    assert len(r._history) == 1
    r.clear_history()
    assert len(r._history) == 0


# ---------------------------------------------------------------------------
# ShadowCompareAggregator
# ---------------------------------------------------------------------------


def test_aggregator_grade_clean():
    from app.shadow_compare import CompareBucket

    b = CompareBucket(total=10, match=10, mismatch=0)
    assert b.grade == "clean"


def test_aggregator_grade_body():
    from app.shadow_compare import CompareBucket

    b = CompareBucket(total=100, match=99, mismatch=1, by_kind={"body": 1})
    assert b.grade == "body"


def test_aggregator_grade_field():
    from app.shadow_compare import CompareBucket

    b = CompareBucket(total=100, match=95, mismatch=5, by_kind={"keys": 5})
    assert b.grade == "field"


def test_aggregator_grade_magnitude():
    from app.shadow_compare import CompareBucket

    b = CompareBucket(total=100, match=70, mismatch=30, by_kind={"length": 25, "keys": 5})
    assert b.grade == "magnitude"


def test_aggregator_match_rate():
    from app.shadow_compare import CompareBucket

    b = CompareBucket(total=4, match=3, mismatch=1)
    assert b.match_rate == 0.75
    assert b.mismatch_rate == 0.25


def test_aggregator_aggregate_once_empty():
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import ShadowRouter

    router = ShadowRouter()
    agg = ShadowCompareAggregator(router=router, window_sec=300)
    b = agg.aggregate_once()
    assert b.total == 0


def test_aggregator_aggregate_once_with_history():
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import DiffKind, ShadowCompare, ShadowRouter

    router = ShadowRouter()
    # 直接 push 历史
    for _ in range(8):
        router._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    for _ in range(2):
        router._history.append(ShadowCompare(diff_kind=DiffKind.MISMATCH_BODY))
    agg = ShadowCompareAggregator(router=router, window_sec=300)
    b = agg.aggregate_once()
    assert b.total == 10
    assert b.match == 8
    assert b.mismatch == 2
    assert b.by_kind.get("body") == 2


def test_aggregator_aggregate_incremental():
    """第二次聚合只算新增的."""
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import DiffKind, ShadowCompare, ShadowRouter

    router = ShadowRouter()
    for _ in range(3):
        router._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    agg = ShadowCompareAggregator(router=router, window_sec=300)
    b1 = agg.aggregate_once()
    assert b1.total == 3
    # 再加 5 条
    for _ in range(5):
        router._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    b2 = agg.aggregate_once()
    assert b2.total == 5  # 增量
    assert agg._last_history_idx == 8


def test_aggregator_aggregate_expired_excluded():
    """超出 window 的记录应排除."""
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import DiffKind, ShadowCompare, ShadowRouter

    router = ShadowRouter()
    # 10 分钟前的记录
    old = ShadowCompare(diff_kind=DiffKind.MATCH)
    old.timestamp = time.time() - 1000
    router._history.append(old)
    # 当前记录
    router._history.append(ShadowCompare(diff_kind=DiffKind.MATCH))
    agg = ShadowCompareAggregator(router=router, window_sec=300)
    b = agg.aggregate_once()
    # window 5 分钟, 旧记录被排除
    assert b.total == 1


def test_aggregator_start_stop():
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import ShadowRouter

    router = ShadowRouter()
    agg = ShadowCompareAggregator(router=router, window_sec=300, interval_sec=0.1)

    async def _run():
        await agg.start()
        await asyncio.sleep(0.3)
        await agg.stop()

    asyncio.run(_run())
    # 跑了几次后应至少 1 个 report
    assert len(agg.get_reports()) >= 1


def test_aggregator_get_last_report():
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import ShadowRouter

    router = ShadowRouter()
    agg = ShadowCompareAggregator(router=router)
    assert agg.get_last_report() is None
    agg.aggregate_once()
    assert agg.get_last_report() is not None


def test_aggregator_reports_ring_buffer():
    from app.shadow_compare import ShadowCompareAggregator
    from app.shadow_traffic import ShadowRouter

    router = ShadowRouter()
    agg = ShadowCompareAggregator(router=router)
    agg._max_reports = 3
    for _ in range(5):
        agg.aggregate_once()
    assert len(agg.get_reports()) == 3


# ---------------------------------------------------------------------------
# 全局默认 router
# ---------------------------------------------------------------------------


def test_get_default_router_singleton():
    from app.shadow_traffic import get_default_router, reset_default_router

    reset_default_router()
    r1 = get_default_router()
    r2 = get_default_router()
    assert r1 is r2


def test_reset_default_router():
    from app.shadow_traffic import get_default_router, reset_default_router

    r1 = get_default_router()
    reset_default_router()
    r2 = get_default_router()
    assert r1 is not r2


# ---------------------------------------------------------------------------
# 告警规则与 router 输出兼容 (建议 119 zhs_shadow_compare_total)
# ---------------------------------------------------------------------------


def test_router_writes_compare_total():
    """router 跑完应增加 zhs_shadow_compare_total."""
    from app.shadow_traffic import (
        SHADOW_COMPARE_TOTAL,
        ShadowResponse,
        ShadowRouter,
    )

    if SHADOW_COMPARE_TOTAL is None:
        pytest.skip("prometheus_client 不可用")

    async def main():
        return ShadowResponse(status_code=200, body={"x": 1})

    async def shadow():
        return ShadowResponse(status_code=200, body={"x": 1})

    async def _run():
        router = ShadowRouter(ratio=1.0)
        await router.run(main, shadow, endpoint="GET /x", tenant_id="compat_test")
        await asyncio.sleep(0.3)

    asyncio.run(_run())

    # 应能查到
    val = SHADOW_COMPARE_TOTAL.labels(tenant_id="compat_test", diff_kind="match")._value.get()
    assert val >= 1
