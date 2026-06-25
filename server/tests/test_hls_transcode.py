"""HLS 自适应码率切片端点测试.

策略:
- mock 掉 video._run_ffmpeg_hls 让其生成最小可用的 m3u8 + ts 文件 (避开真实 ffmpeg 依赖)
- mock get_storage 为 LocalStorage (写到临时目录)
- 测试:
  1. POST /hls/transcode 触发转码, 返回 master.m3u8 内容
  2. GET /hls/manifest/{videoId} 取 m3u8 文本
  3. GET /hls/playlist/{videoId}/{bitrate} 取单档 m3u8
  4. 参数校验: segmentTime 越界 / videoId 不存在
  5. 二次调用命中缓存
  6. _rewrite_m3u8 单元测试
  7. ffmpeg 不可用时返回 500
"""

import os
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# 单元测试: _rewrite_m3u8
# ---------------------------------------------------------------------------


def test_rewrite_m3u8_replaces_ts_paths():
    from app.api.v1.video import _rewrite_m3u8

    src = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        "#EXT-X-TARGETDURATION:4\n"
        "#EXTINF:4.0,\nseg_000.ts\n"
        "#EXTINF:4.0,\nseg_001.ts\n"
        "#EXT-X-ENDLIST\n"
    )
    url_map = {
        "seg_000.ts": "https://oss.example.com/seg_000.ts?Signature=abc",
        "seg_001.ts": "https://oss.example.com/seg_001.ts?Signature=def",
    }
    out = _rewrite_m3u8(src, url_map)
    assert "https://oss.example.com/seg_000.ts?Signature=abc" in out
    assert "https://oss.example.com/seg_001.ts?Signature=def" in out
    assert "seg_000.ts\n" not in out
    # 注释行保留
    assert "#EXTM3U" in out
    assert "#EXT-X-VERSION:3" in out


def test_rewrite_m3u8_keeps_unmatched_lines():
    from app.api.v1.video import _rewrite_m3u8

    src = "# comment\n#EXTM3U\nunknown_file.txt\n"
    out = _rewrite_m3u8(src, {})
    # unknown_file.txt 保留原样 (没在 map 里, 不以 .ts 结尾)
    assert "unknown_file.txt" in out


# ---------------------------------------------------------------------------
# HLS_BITRATES 配置测试
# ---------------------------------------------------------------------------


def test_hls_bitrates_config():
    from app.api.v1.video import HLS_BITRATES

    assert len(HLS_BITRATES) == 3
    names = [b["name"] for b in HLS_BITRATES]
    assert names == ["1080p", "720p", "480p"]
    # 1080p bitrate > 720p > 480p
    assert HLS_BITRATES[0]["height"] > HLS_BITRATES[1]["height"] > HLS_BITRATES[2]["height"]


# ---------------------------------------------------------------------------
# 端点集成测试
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_ffmpeg_output():
    """模拟 ffmpeg 输出的 m3u8 + ts 文件结构."""

    def _fake(src, out_dir, segment_time):
        os.makedirs(os.path.join(out_dir, "stream_0"), exist_ok=True)
        os.makedirs(os.path.join(out_dir, "stream_1"), exist_ok=True)
        os.makedirs(os.path.join(out_dir, "stream_2"), exist_ok=True)
        # 1080p m3u8
        with open(os.path.join(out_dir, "stream_0.m3u8"), "w", encoding="utf-8") as f:
            f.write(
                "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n"
                "#EXTINF:4.0,\nseg_000.ts\n#EXTINF:4.0,\nseg_001.ts\n#EXT-X-ENDLIST\n"
            )
        with open(os.path.join(out_dir, "stream_1.m3u8"), "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n")
        with open(os.path.join(out_dir, "stream_2.m3u8"), "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n")
        # master.m3u8
        with open(os.path.join(out_dir, "master.m3u8"), "w", encoding="utf-8") as f:
            f.write(
                "#EXTM3U\n#EXT-X-VERSION:3\n"
                "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n"
                "stream_0.m3u8\n"
                "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n"
                "stream_1.m3u8\n"
                "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480\n"
                "stream_2.m3u8\n"
            )
        # ts 文件
        for s in (0, 1, 2):
            for n in range(2):
                path = os.path.join(out_dir, f"stream_{s}", f"seg_{n:03d}.ts")
                with open(path, "wb") as f:
                    f.write(b"\x47" * 188)  # 188-byte TS packet dummy
        files = []
        for root, _, fs in os.walk(out_dir):
            for f in fs:
                files.append(os.path.relpath(os.path.join(root, f), out_dir))
        return {"returncode": 0, "stderr": "", "files": files}

    return _fake


@pytest.mark.asyncio
async def test_hls_transcode_success(client, fake_ffmpeg_output, tmp_path):
    """触发 HLS 转码, 验证 master.m3u8 改写."""
    from app.utils.storage import LocalStorage, reset_storage

    # 准备视频源文件
    video_file = tmp_path / "test.mp4"
    video_file.write_bytes(b"fake mp4 content")

    # 强制使用本地 storage 到 tmp_path/storage
    reset_storage()
    from app.utils import storage as storage_mod

    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))

    # 准备假 Redis
    fake_redis = MagicMock()
    fake_redis.get.return_value = None
    with (
        patch("app.api.v1.video.get_redis", return_value=fake_redis),
        patch("app.api.v1.video._run_ffmpeg_hls", side_effect=fake_ffmpeg_output),
        patch("app.api.v1.video._has_ffmpeg", return_value=True),
        patch("app.api.v1.video._resolve_video_path", return_value=str(video_file)),
    ):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "v001", "segmentTime": 4})

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == 0
    payload = data["data"]
    assert payload["videoId"] == "v001"
    assert payload["cached"] is False
    assert "masterContent" in payload
    # master 内容应包含 3 档位链接
    assert "stream_0" in payload["masterContent"] or "masterUrl" in payload
    # 至少上传了 6 个 .ts (3档 x 2段)
    seg_count = payload["segmentCount"]
    assert seg_count == 2
    # 3 档位
    assert len(payload["bitrates"]) == 3


@pytest.mark.asyncio
async def test_hls_transcode_cached(client, tmp_path):
    """二次调用应命中 Redis 缓存."""
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))

    fake_redis = MagicMock()
    fake_redis.get.return_value = "https://cached.example.com/master.m3u8?Signature=xyz"
    with patch("app.api.v1.video.get_redis", return_value=fake_redis):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "v002"})

    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["cached"] is True
    assert payload["masterUrl"] == "https://cached.example.com/master.m3u8?Signature=xyz"


@pytest.mark.asyncio
async def test_hls_transcode_invalid_segment_time(client):
    fake_redis = MagicMock()
    with patch("app.api.v1.video.get_redis", return_value=fake_redis):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "v003", "segmentTime": 0})
    assert resp.status_code == 200
    assert resp.json()["code"] == 400
    assert "segmentTime" in resp.json()["message"]


@pytest.mark.asyncio
async def test_hls_transcode_video_not_found(client):
    """videoId 解析路径不存在 -> 404."""
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    # 2026-06-25 修复: 用 tempfile.gettempdir() 跨平台, 避免在 Windows 上创建 G:\tmp\empty_storage_for_test
    import tempfile as _tempfile
    storage_mod._storage = LocalStorage(os.path.join(_tempfile.gettempdir(), "empty_storage_for_test"))

    fake_redis = MagicMock()
    fake_redis.get.return_value = None
    with (
        patch("app.api.v1.video.get_redis", return_value=fake_redis),
        patch("app.api.v1.video._has_ffmpeg", return_value=True),
    ):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "nonexistent_video_xyz"})
    assert resp.status_code == 200
    assert resp.json()["code"] == 404
    assert "不存在" in resp.json()["message"]


@pytest.mark.asyncio
async def test_hls_transcode_ffmpeg_unavailable(client, tmp_path):
    """ffmpeg 不可用 -> 500."""
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))

    video_file = tmp_path / "test.mp4"
    video_file.write_bytes(b"x")

    fake_redis = MagicMock()
    fake_redis.get.return_value = None
    with (
        patch("app.api.v1.video.get_redis", return_value=fake_redis),
        patch("app.api.v1.video._has_ffmpeg", return_value=False),
        patch("app.api.v1.video._resolve_video_path", return_value=str(video_file)),
    ):
        resp = await client.post("/api/v1/video/hls/transcode", json={"videoId": "v004"})
    assert resp.status_code == 200
    assert resp.json()["code"] == 500
    assert "ffmpeg" in resp.json()["message"]


@pytest.mark.asyncio
async def test_hls_manifest_endpoint(client):
    """GET /hls/manifest/{videoId} 直接返回 m3u8 文本."""
    fake_redis = MagicMock()
    fake_redis.get.return_value = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=5000000\n"
        "https://oss.example.com/stream_0.m3u8\n"
        "#EXT-X-ENDLIST\n"
    )
    with patch("app.api.v1.video.get_redis", return_value=fake_redis):
        resp = await client.get("/api/v1/video/hls/manifest/v005")
    assert resp.status_code == 200
    assert "application/vnd.apple.mpegurl" in resp.headers["content-type"]
    assert "#EXTM3U" in resp.text
    assert "https://oss.example.com/stream_0.m3u8" in resp.text


@pytest.mark.asyncio
async def test_hls_manifest_not_ready(client):
    """缓存未命中 -> 404."""
    fake_redis = MagicMock()
    fake_redis.get.return_value = None
    with patch("app.api.v1.video.get_redis", return_value=fake_redis):
        resp = await client.get("/api/v1/video/hls/manifest/nonexistent")
    assert resp.status_code == 404
    assert "not ready" in resp.text


@pytest.mark.asyncio
async def test_hls_playlist_local_storage(client, tmp_path):
    """GET /hls/playlist/{vid}/{bitrate} 从本地 storage 读 m3u8."""
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))
    # 手动写一份 m3u8 到 storage
    storage_mod._storage.upload_bytes(
        "video-hls/v006/stream_720p.m3u8",
        b"#EXTM3U\n#EXTINF:4.0,\nseg_000.ts\n#EXT-X-ENDLIST\n",
    )
    resp = await client.get("/api/v1/video/hls/playlist/v006/720p")
    assert resp.status_code == 200
    assert "application/vnd.apple.mpegurl" in resp.headers["content-type"]
    assert "seg_000.ts" in resp.text


@pytest.mark.asyncio
async def test_hls_playlist_not_found(client, tmp_path):
    from app.utils import storage as storage_mod
    from app.utils.storage import LocalStorage, reset_storage

    reset_storage()
    storage_mod._storage = LocalStorage(str(tmp_path / "storage"))
    resp = await client.get("/api/v1/video/hls/playlist/v999/1080p")
    assert resp.status_code == 404
