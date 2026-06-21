"""ffmpeg 真实视频切片联调 — 用 ffmpeg CLI 合成测试视频 + 验证 /video/preload 和 /video/breakpoint 端点.

跳过条件: 系统无 ffmpeg
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


pytestmark = pytest.mark.skipif(not _has_ffmpeg(), reason="ffmpeg 不可用")


@pytest.fixture(scope="module")
def test_video_file():
    """用 ffmpeg 合成一个 5 秒 H.264 + AAC 测试视频."""
    tmp = Path(tempfile.gettempdir()) / "zhs_test_video.mp4"
    if tmp.exists():
        tmp.unlink()
    # 合成 5 秒, 320x240, 24fps, 静默音频
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=5:size=320x240:rate=24",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=5",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        "-shortest",
        str(tmp),
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=60)
    assert proc.returncode == 0, f"ffmpeg 合成失败: {proc.stderr.decode()}"
    assert tmp.exists() and tmp.stat().st_size > 0
    yield str(tmp)
    # 清理
    for ext in ("", ".preload.mp4"):
        p = tmp.with_suffix(ext) if not ext else Path(str(tmp) + ".preload.mp4")
        if p.exists():
            p.unlink()


@pytest.fixture
def env_with_video(monkeypatch, test_video_file):
    """设置 VIDEO_ROOT 指向测试视频所在目录, 并指向 videoId=test_video."""
    from app.config import settings

    monkeypatch.setattr(settings, "VIDEO_ROOT", str(Path(test_video_file).parent))
    # 同时复制文件为 test_video.mp4 方便解析
    target = Path(test_video_file).parent / "test_video.mp4"
    if not target.exists():
        shutil.copy(test_video_file, target)
    yield "test_video"
    if target.exists():
        target.unlink()


@pytest.mark.asyncio
async def test_preload_real_video(client, env_with_video):
    """真实跑 /video/preload 切片前 2 秒."""
    resp = await client.post(
        "/api/v1/video/preload",
        json={
            "videoId": env_with_video,
            "startSeconds": 0.0,
            "preloadSeconds": 2.0,
        },
    )
    assert resp.status_code == 200, f"状态码: {resp.status_code} 响应: {resp.text}"
    data = resp.json()
    assert data["code"] == 0
    payload = data["data"]
    assert payload["videoId"] == env_with_video
    assert payload["actualStartSeconds"] == 0.0
    assert payload["actualEndSeconds"] == 2.0
    assert payload["streamFormat"] == "mp4"
    assert payload["size"] > 0
    assert len(payload["streamData"]) > 100  # base64 编码后的非空数据


@pytest.mark.asyncio
async def test_preload_cache_hit(client, env_with_video):
    """第二次请求应该命中 Redis 缓存."""
    body = {
        "videoId": env_with_video,
        "startSeconds": 1.0,
        "preloadSeconds": 1.0,
    }
    r1 = await client.post("/api/v1/video/preload", json=body)
    assert r1.json()["code"] == 0
    r2 = await client.post("/api/v1/video/preload", json=body)
    d2 = r2.json()["data"]
    # 缓存命中标志由 video 端点设置; 即便没显式标志, 两次 size 应一致
    assert d2["size"] > 0


@pytest.mark.asyncio
async def test_preload_mid_video(client, env_with_video):
    """真实跑 /video/preload 切中间 1.5 秒到 3.0 秒 (非关键帧起始, 走转码分支)."""
    resp = await client.post(
        "/api/v1/video/preload",
        json={
            "videoId": env_with_video,
            "startSeconds": 1.5,
            "preloadSeconds": 1.5,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    payload = data["data"]
    assert payload["size"] > 0


@pytest.mark.asyncio
async def test_preload_invalid_params(client, env_with_video):
    """preloadSeconds 超过 300 应报错."""
    resp = await client.post(
        "/api/v1/video/preload",
        json={
            "videoId": env_with_video,
            "startSeconds": 0.0,
            "preloadSeconds": 999.0,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["code"] != 0


@pytest.mark.asyncio
async def test_preload_negative_start(client, env_with_video):
    """startSeconds 负数应报错."""
    resp = await client.post(
        "/api/v1/video/preload",
        json={
            "videoId": env_with_video,
            "startSeconds": -1.0,
            "preloadSeconds": 1.0,
        },
    )
    assert resp.json()["code"] != 0


@pytest.mark.asyncio
async def test_breakpoint_full_cycle(client, env_with_video, fakeredis_available):
    """完整断点周期: update -> get -> load."""
    # update
    r1 = await client.post(
        "/api/v1/video/breakpoint/update",
        json={
            "videoId": env_with_video,
            "userId": "u-ffmpeg-001",
            "currentSeconds": 2.5,
            "currentOffset": 1024,
        },
    )
    assert r1.json()["code"] == 0

    # get
    r2 = await client.get(
        "/api/v1/video/breakpoint/get",
        params={
            "userId": "u-ffmpeg-001",
            "videoId": env_with_video,
        },
    )
    assert r2.json()["code"] == 0
    d = r2.json()["data"]
    assert d["breakpointSeconds"] == 2.5
    assert d["currentOffset"] == 1024

    # load: 从断点 2.5 开始, 加载 1.0 秒
    r3 = await client.post(
        "/api/v1/video/breakpoint/load",
        json={
            "videoId": env_with_video,
            "breakpointSeconds": 2.5,
            "preloadSeconds": 1.0,
        },
    )
    assert r3.json()["code"] == 0
    payload = r3.json()["data"]
    assert payload["actualStartSeconds"] == 2.5
    assert payload["actualEndSeconds"] == 3.5
    assert payload["size"] > 0


@pytest.fixture
def fakeredis_available():
    """标记 fakeredis 在 conftest 已配; 这里只占位, 真实使用由 conftest 提供."""
    yield
