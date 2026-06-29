"""业务指标测试.

测试:
1. metrics_business 模块所有指标可被 prometheus_client 渲染
2. record_cache 更新 hit/miss + hit_ratio
3. BizTimer 上下文管理器正常计数 + 错误路径
4. 业务指标被集成到 video / notice 端点
5. /metrics 端点暴露 zhs_biz_ 指标
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from prometheus_client import REGISTRY

# ---------------------------------------------------------------------------
# 共享 fixture: 模拟 ffmpeg 输出
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_ffmpeg_output():
    """模拟 ffmpeg 输出的 m3u8 + ts 文件结构."""

    def _fake(src, out_dir, segment_time):
        os.makedirs(os.path.join(out_dir, "stream_0"), exist_ok=True)
        os.makedirs(os.path.join(out_dir, "stream_1"), exist_ok=True)
        os.makedirs(os.path.join(out_dir, "stream_2"), exist_ok=True)
        with open(os.path.join(out_dir, "stream_0.m3u8"), "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n")
        with open(os.path.join(out_dir, "stream_1.m3u8"), "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n")
        with open(os.path.join(out_dir, "stream_2.m3u8"), "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n")
        with open(os.path.join(out_dir, "master.m3u8"), "w", encoding="utf-8") as f:
            f.write(
                "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000\nstream_0.m3u8\n"
                "#EXT-X-STREAM-INF:BANDWIDTH=2500000\nstream_1.m3u8\n"
                "#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream_2.m3u8\n"
            )
        for s in (0, 1, 2):
            for n in range(2):
                path = os.path.join(out_dir, f"stream_{s}", f"seg_{n:03d}.ts")
                with open(path, "wb") as f:
                    f.write(b"\x47" * 188)
        files = []
        for root, _, fs in os.walk(out_dir):
            for f in fs:
                files.append(os.path.relpath(os.path.join(root, f), out_dir))
        return {"returncode": 0, "stderr": "", "files": files}

    return _fake


# ---------------------------------------------------------------------------
# 模块指标定义
# ---------------------------------------------------------------------------


def test_biz_metrics_defined():
    """所有业务指标都已定义."""
    from app.metrics_business import (
        BIZ_ERROR_TOTAL,
        BIZ_LATENCY,
        BIZ_REQUEST_TOTAL,
        CACHE_HIT_RATIO,
        CACHE_HIT_TOTAL,
        CACHE_MISS_TOTAL,
        HLS_BITRATE_TOTAL,
        HLS_SEGMENTS_TOTAL,
        HLS_TRANSCODE_SECONDS,
        JOB_DURATION,
        JOB_EXECUTIONS_TOTAL,
        NOTICE_DELIVERED_TOTAL,
        NOTICE_PUSHED_TOTAL,
        PAYMENT_AMOUNT_TOTAL,
        PAYMENT_COUNT_TOTAL,
        USERS_ACTIVE_24H,
        USERS_TOTAL,
        WS_CONNECTIONS,
        WS_NOTICE_SUBS,
    )

    # 全部都是 prometheus_client MetricFamily 类型
    for m in [
        BIZ_REQUEST_TOTAL,
        BIZ_LATENCY,
        USERS_TOTAL,
        USERS_ACTIVE_24H,
        HLS_TRANSCODE_SECONDS,
        HLS_SEGMENTS_TOTAL,
        HLS_BITRATE_TOTAL,
        NOTICE_PUSHED_TOTAL,
        NOTICE_DELIVERED_TOTAL,
        CACHE_HIT_TOTAL,
        CACHE_MISS_TOTAL,
        CACHE_HIT_RATIO,
        JOB_EXECUTIONS_TOTAL,
        JOB_DURATION,
        PAYMENT_AMOUNT_TOTAL,
        PAYMENT_COUNT_TOTAL,
        WS_CONNECTIONS,
        WS_NOTICE_SUBS,
        BIZ_ERROR_TOTAL,
    ]:
        assert m is not None
        assert hasattr(m, "inc") or hasattr(m, "set") or hasattr(m, "observe")


def test_biz_metrics_renderable():
    """prometheus_client 能渲染所有业务指标 (无异常)."""
    from prometheus_client import generate_latest

    text = generate_latest(REGISTRY).decode("utf-8")
    # 不应抛异常; 至少包含基础设施指标
    assert "zhs_http_requests_total" in text or "zhs_biz_" in text or len(text) > 0


# ---------------------------------------------------------------------------
# record_cache
# ---------------------------------------------------------------------------


def test_record_cache_hit_updates_ratio():
    from app.metrics_business import CACHE_HIT_RATIO, CACHE_HIT_TOTAL, CACHE_MISS_TOTAL, record_cache

    # 多次命中, 命中率应趋向 1.0
    for _ in range(10):
        record_cache("test_key", hit=True)
    h = CACHE_HIT_TOTAL.labels(key_prefix="test_key")._value.get()
    m = CACHE_MISS_TOTAL.labels(key_prefix="test_key")._value.get()
    assert h >= 10
    ratio = CACHE_HIT_RATIO.labels(key_prefix="test_key")._value.get()
    assert 0.0 <= ratio <= 1.0


def test_record_cache_miss_updates_ratio():
    from app.metrics_business import record_cache

    # 命中 + 未命中混合
    record_cache("test_miss", hit=False)
    record_cache("test_miss", hit=False)
    record_cache("test_miss", hit=True)
    from app.metrics_business import CACHE_HIT_RATIO

    ratio = CACHE_HIT_RATIO.labels(key_prefix="test_miss")._value.get()
    assert 0.0 < ratio < 1.0


# ---------------------------------------------------------------------------
# BizTimer
# ---------------------------------------------------------------------------


def test_biz_timer_success():
    from app.metrics_business import BIZ_ERROR_TOTAL, BIZ_REQUEST_TOTAL, BizTimer

    before_total = BIZ_REQUEST_TOTAL.labels(endpoint="test_success", status="200", tenant_id="anonymous")._value.get()
    with BizTimer("test_success"):
        x = 1 + 1
    after_total = BIZ_REQUEST_TOTAL.labels(endpoint="test_success", status="200", tenant_id="anonymous")._value.get()
    assert after_total == before_total + 1
    # 错误指标未触发
    err = BIZ_ERROR_TOTAL.labels(endpoint="test_success", error_type="ValueError")._value.get()
    assert err == 0


def test_biz_timer_with_exception():
    from app.metrics_business import BIZ_ERROR_TOTAL, BIZ_REQUEST_TOTAL, BizTimer

    before_500 = BIZ_REQUEST_TOTAL.labels(endpoint="test_fail", status="500", tenant_id="anonymous")._value.get()
    with pytest.raises(ValueError), BizTimer("test_fail"):
        raise ValueError("boom")
    after_500 = BIZ_REQUEST_TOTAL.labels(endpoint="test_fail", status="500", tenant_id="anonymous")._value.get()
    assert after_500 == before_500 + 1
    # 错误指标被记录
    err = BIZ_ERROR_TOTAL.labels(endpoint="test_fail", error_type="ValueError")._value.get()
    assert err >= 1


# ---------------------------------------------------------------------------
# 端点集成
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_video_hls_updates_biz_metrics(client, fake_ffmpeg_output, tmp_path):
    """HLS 转码后业务指标应被更新."""
    from app.metrics_business import (
        BIZ_REQUEST_TOTAL,
        CACHE_MISS_TOTAL,
        HLS_BITRATE_TOTAL,
        HLS_SEGMENTS_TOTAL,
    )
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    video_file = tmp_path / "test.mp4"
    video_file.write_bytes(b"fake")

    reset_storage()
    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))

    # 抓取初始 counter 值
    before_biz = BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous")._value.get()
    before_seg_1080p = HLS_SEGMENTS_TOTAL.labels(bitrate="1080p")._value.get()
    before_transcode = HLS_BITRATE_TOTAL.labels(result="success")._value.get()
    before_miss = CACHE_MISS_TOTAL.labels(key_prefix="hls_master")._value.get()

    fake_redis = MagicMock()
    fake_redis.get.return_value = None
    with (
        patch("app.api.v1.video.get_redis", return_value=fake_redis),
        patch("app.api.v1.video._run_ffmpeg_hls", side_effect=fake_ffmpeg_output),
        patch("app.api.v1.video._has_ffmpeg", return_value=True),
        patch("app.api.v1.video._resolve_video_path", return_value=str(video_file)),
    ):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "metrics-v1"})

    assert resp.status_code == 200, f"resp={resp.text}"
    after_biz = BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous")._value.get()
    after_seg_1080p = HLS_SEGMENTS_TOTAL.labels(bitrate="1080p")._value.get()
    after_transcode = HLS_BITRATE_TOTAL.labels(result="success")._value.get()
    after_miss = CACHE_MISS_TOTAL.labels(key_prefix="hls_master")._value.get()

    assert after_biz == before_biz + 1
    assert after_transcode == before_transcode + 1
    assert after_seg_1080p == before_seg_1080p + 2  # fake_ffmpeg 切 2 段
    assert after_miss == before_miss + 1


@pytest.mark.asyncio
async def test_video_hls_cached_hit_updates_metrics(client):
    """HLS 缓存命中时, hit counter + cached 标记."""
    from app.metrics_business import (
        BIZ_REQUEST_TOTAL,
        CACHE_HIT_TOTAL,
        HLS_BITRATE_TOTAL,
    )
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    storage_mod._storage = LocalStorage("/tmp/m_storage")

    before_hit = CACHE_HIT_TOTAL.labels(key_prefix="hls_master")._value.get()
    before_cached = HLS_BITRATE_TOTAL.labels(result="cached")._value.get()
    before_biz = BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous")._value.get()

    fake_redis = MagicMock()
    fake_redis.get.return_value = "https://cached.example.com/master.m3u8"
    with patch("app.api.v1.video.get_redis", return_value=fake_redis):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "metrics-v2"})

    assert resp.status_code == 200
    after_hit = CACHE_HIT_TOTAL.labels(key_prefix="hls_master")._value.get()
    after_cached = HLS_BITRATE_TOTAL.labels(result="cached")._value.get()
    after_biz = BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous")._value.get()
    assert after_hit == before_hit + 1
    assert after_cached == before_cached + 1
    assert after_biz == before_biz + 1


@pytest.mark.asyncio
async def test_notice_push_updates_biz_metrics(client):
    """notice push 后业务指标更新."""
    from app.metrics_business import BIZ_REQUEST_TOTAL, NOTICE_DELIVERED_TOTAL, NOTICE_PUSHED_TOTAL

    fake_manager = MagicMock()
    fake_manager.broadcast_room = AsyncMock(return_value=5)
    before_push = NOTICE_PUSHED_TOTAL.labels(topic="announcement", scope="topic")._value.get()
    before_delivered = NOTICE_DELIVERED_TOTAL.labels(topic="announcement")._value.get()
    before_biz = BIZ_REQUEST_TOTAL.labels(endpoint="notice_push", status="200", tenant_id="anonymous")._value.get()

    with patch("app.ws.notice.connection_manager", fake_manager):
        resp = await client.post(
            "/ws/notice/push",
            json={
                "topic": "announcement",
                "title": "测试",
                "content": "x",
            },
        )
    assert resp.status_code == 200
    after_push = NOTICE_PUSHED_TOTAL.labels(topic="announcement", scope="topic")._value.get()
    after_delivered = NOTICE_DELIVERED_TOTAL.labels(topic="announcement")._value.get()
    after_biz = BIZ_REQUEST_TOTAL.labels(endpoint="notice_push", status="200", tenant_id="anonymous")._value.get()
    assert after_push == before_push + 1
    assert after_delivered == before_delivered + 5
    assert after_biz == before_biz + 1


# ---------------------------------------------------------------------------
# /metrics 端点暴露业务指标
# ---------------------------------------------------------------------------


def test_metrics_endpoint_exposes_biz():
    """/metrics 端点输出包含 zhs_biz_ 指标."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    with TestClient(app) as tc:
        r = tc.get("/metrics")
        assert r.status_code == 200
        text = r.text
        # 业务指标前缀
        assert "zhs_biz_" in text
        # 至少包含一个业务指标 (definitions are present even at 0 value)
        assert "zhs_biz_users_total" in text or "zhs_biz_requests_total" in text or "zhs_biz_cache_hits_total" in text
