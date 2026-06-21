"""视频预读 / 断点续存 / HLS 自适应码率 -- 对应 Java general-program 的

Java 端用 JavaCV 拉帧编码 MP4 字节流, Python 端使用 ffmpeg CLI 实现等价行为.

端点:
- POST /api/video/preload                  预读指定时间段视频 (mp4 字节)
- POST /api/video/breakpoint/load          从断点位置加载
- POST /api/video/breakpoint/update        上报断点
- POST /api/video/hls/transcode            触发 HLS 多码率切片 (1080p/720p/480p)
- GET  /api/video/hls/manifest/{videoId}   取 master.m3u8 文本 (含 .ts 预签名 URL)
- GET  /api/video/hls/playlist/{vid}/{b}    取单档 m3u8 文本

实现:
- 默认使用 ffmpeg CLI (PATH 中需有 ffmpeg)
"""

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.metrics_business import (
    BIZ_LATENCY,
    BIZ_REQUEST_TOTAL,
    HLS_BITRATE_TOTAL,
    HLS_SEGMENTS_TOTAL,
    HLS_TRANSCODE_SECONDS,
    record_cache,
)
from app.utils.redis_util import get_redis
from app.utils.response import fail, success
from app.utils.storage import get_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["Video: Preload & Breakpoint"])

# 视频存储根目录 (Java 端: /data/videos/ 写死)
VIDEO_ROOT = getattr(settings, "VIDEO_ROOT", "/data/videos")

# Redis TTL
PRELOAD_TTL = 300  # 5 分钟
BREAKPOINT_TTL = 60 * 60 * 24 * 30  # 30 天

# 存储里的 key 前缀
_STORAGE_PREFIX = "video-slices"


def _storage_key(video_id: str, start_sec: int) -> str:
    return f"{_STORAGE_PREFIX}/{video_id}/{int(start_sec)}.mp4"


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------


class PreloadReq(BaseModel):
    videoId: str  # noqa: 5
    videoPath: str | None = None  # noqa: 5
    startSeconds: float  # noqa: 5
    preloadSeconds: float = 10.0  # noqa: 5


class PreloadData(BaseModel):
    videoId: str  # noqa: 5
    actualStartSeconds: float  # noqa: 5
    actualEndSeconds: float  # noqa: 5
    streamData: str  # base64  # noqa: 5
    streamFormat: str = "mp4"  # noqa: 5
    duration: float
    size: int


class BreakpointReq(BaseModel):
    videoId: str  # noqa: 5
    breakpointSeconds: float  # noqa: 5
    preloadSeconds: float = 10.0  # noqa: 5


class BreakpointUpdateReq(BaseModel):
    videoId: str  # noqa: 5
    userId: str  # noqa: 5
    currentSeconds: float  # noqa: 5
    currentOffset: int = 0  # noqa: 5


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------


def _resolve_video_path(video_id: str, hint: str | None = None) -> str:
    """根据 videoId 解析实际路径. 生产可换成查 DB / 媒体服务."""
    if hint and os.path.isabs(hint) and os.path.exists(hint):
        return hint
    # 默认: VIDEO_ROOT/{videoId}.mp4
    p1 = os.path.join(VIDEO_ROOT, f"{video_id}.mp4")
    if os.path.exists(p1):
        return p1
    # 退而求其次
    return p1


def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _ffmpeg_trim(src: str, start: float, dur: float, fmt: str = "mp4") -> bytes:
    """调用 ffmpeg 切出 [start, start+dur] 段, 返回原始字节.

    等价 Java JavaCV 的 FrameToStreamEncoder.encode().
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-ss",
        str(start),
        "-i",
        src,
        "-t",
        str(dur),
        "-c",
        "copy",
        "-f",
        fmt,
        "pipe:1",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=30, check=False)
        if proc.returncode != 0:
            # -c copy 失败时 (非关键帧起始) 改用转码
            cmd2 = [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-ss",
                str(start),
                "-i",
                src,
                "-t",
                str(dur),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                "-f",
                fmt,
                "pipe:1",
            ]
            proc = subprocess.run(cmd2, capture_output=True, timeout=60, check=False)
        return proc.stdout
    except Exception as e:
        logger.error(f"ffmpeg 切片失败: {e}")
        return b""


async def _ffmpeg_trim_async(src: str, start: float, dur: float, fmt: str = "mp4") -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ffmpeg_trim, src, start, dur, fmt)


# ---------------------------------------------------------------------------
# 1. 视频预读
# ---------------------------------------------------------------------------


@router.post("/preload", summary="预读视频指定时间段")
async def preload_video(req: PreloadReq):
    """对应 Java: POST /api/video/preload

    请求体: { "videoId": "xxx", "videoPath": "可选", "startSeconds": 60, "preloadSeconds": 10 }
    返回: { videoId, actualStartSeconds, actualEndSeconds, streamData (base64), streamFormat, duration, size }
    """
    if req.preloadSeconds <= 0 or req.preloadSeconds > 300:
        return fail("preloadSeconds 必须在 (0, 300]", code=400)
    if req.startSeconds < 0:
        return fail("startSeconds 必须 >= 0", code=400)

    video_path = _resolve_video_path(req.videoId, req.videoPath)
    if not os.path.exists(video_path):
        return fail(f"视频不存在: {video_path}", code=404)

    # 缓存命中 (Redis 存的是预签名 URL)
    r = get_redis()
    cache_key = f"zhs:video:preload:{req.videoId}:{int(req.startSeconds)}"
    cached_url = None
    try:
        cached_url = r.get(cache_key)
    except Exception:
        logger.warning("Unexpected error in line 173")
        pass
    if cached_url:
        return success(
            {
                "videoId": req.videoId,
                "actualStartSeconds": req.startSeconds,
                "actualEndSeconds": req.startSeconds + req.preloadSeconds,
                "streamUrl": cached_url,
                "streamFormat": "mp4",
                "duration": req.preloadSeconds,
                "fromCache": True,
            }
        )

    # ffmpeg 切片
    if not _has_ffmpeg():
        return fail("ffmpeg 不可用, 请安装并加入 PATH", code=500)
    stream = await _ffmpeg_trim_async(video_path, req.startSeconds, req.preloadSeconds)
    if not stream:
        return fail("ffmpeg 切片失败", code=500)

    # 上传到对象存储, 返回预签名 URL
    storage = get_storage()
    skey = _storage_key(req.videoId, int(req.startSeconds))
    if not storage.upload_bytes(skey, stream):
        return fail("上传到对象存储失败", code=500)
    presigned = storage.presigned_url(skey, expires=PRELOAD_TTL)
    if not presigned:
        return fail("生成预签名 URL 失败", code=500)

    # 缓存预签名 URL (不缓存二进制)
    try:
        r.setex(cache_key, PRELOAD_TTL, presigned)
    except Exception:
        logger.warning("Unexpected error in line 205")
        pass

    return success(
        {
            "videoId": req.videoId,
            "actualStartSeconds": req.startSeconds,
            "actualEndSeconds": req.startSeconds + req.preloadSeconds,
            "streamUrl": presigned,
            "streamFormat": "mp4",
            "duration": req.preloadSeconds,
            "size": len(stream),
            "fromCache": False,
        }
    )


# ---------------------------------------------------------------------------
# 2. 断点加载
# ---------------------------------------------------------------------------


@router.post("/breakpoint/load", summary="从断点位置加载视频")
async def load_from_breakpoint(req: BreakpointReq):
    """对应 Java: POST /api/video/breakpoint/load"""
    if req.breakpointSeconds < 0:
        return fail("breakpointSeconds 必须 >= 0", code=400)
    if req.preloadSeconds <= 0 or req.preloadSeconds > 300:
        return fail("preloadSeconds 必须在 (0, 300]", code=400)

    video_path = _resolve_video_path(req.videoId)
    if not os.path.exists(video_path):
        return fail("视频不存在", code=404)
    if not _has_ffmpeg():
        return fail("ffmpeg 不可用", code=500)

    stream = await _ffmpeg_trim_async(video_path, req.breakpointSeconds, req.preloadSeconds)
    if not stream:
        return fail("加载失败", code=500)

    # 上传 + 预签名 URL (从断点位置切, 不写 Redis 缓存, 每次实时)
    storage = get_storage()
    skey = f"{_STORAGE_PREFIX}/{req.videoId}/breakpoint_{int(req.breakpointSeconds)}.mp4"
    if not storage.upload_bytes(skey, stream):
        return fail("上传到对象存储失败", code=500)
    presigned = storage.presigned_url(skey, expires=PRELOAD_TTL)
    if not presigned:
        return fail("生成预签名 URL 失败", code=500)

    return success(
        {
            "videoId": req.videoId,
            "actualStartSeconds": req.breakpointSeconds,
            "actualEndSeconds": req.breakpointSeconds + req.preloadSeconds,
            "streamUrl": presigned,
            "streamFormat": "mp4",
            "duration": req.preloadSeconds,
            "size": len(stream),
        }
    )


# ---------------------------------------------------------------------------
# 3. 断点更新
# ---------------------------------------------------------------------------


@router.post("/breakpoint/update", summary="上报当前播放位置")
async def update_breakpoint(req: BreakpointUpdateReq):
    """对应 Java: POST /api/video/breakpoint/update -- 存 Redis"""
    r = get_redis()
    key = f"zhs:video:breakpoint:{req.userId}:{req.videoId}"
    try:
        r.setex(key, BREAKPOINT_TTL, f"{req.currentSeconds}|{req.currentOffset}")
    except Exception as e:
        return fail(f"保存失败: {e}", code=500)
    return success({"saved": True, "key": key})


@router.get("/breakpoint/get", summary="查询断点")
async def get_breakpoint(userId: str, videoId: str):  # noqa: 39
    """配套查询: GET /api/video/breakpoint/get?userId=&videoId="""
    r = get_redis()
    key = f"zhs:video:breakpoint:{userId}:{videoId}"
    val = r.get(key)
    if not val:
        return success({"breakpointSeconds": 0, "currentOffset": 0})
    if isinstance(val, bytes):
        val = val.decode("utf-8")
    parts = val.split("|")
    return success(
        {
            "breakpointSeconds": float(parts[0]) if parts else 0,
            "currentOffset": int(parts[1]) if len(parts) > 1 else 0,
        }
    )


# ---------------------------------------------------------------------------
# 4. HLS 自适应码率 (HTTP Live Streaming, 多码率 master playlist)
# ---------------------------------------------------------------------------

# 预置 3 档位 -- 对应 Java general-program HlsConfig
HLS_BITRATES = [
    {"name": "1080p", "height": 1080, "bitrate": "5000k", "maxrate": "5500k", "bufsize": "10000k"},
    {"name": "720p", "height": 720, "bitrate": "2500k", "maxrate": "2750k", "bufsize": "5000k"},
    {"name": "480p", "height": 480, "bitrate": "1000k", "maxrate": "1100k", "bufsize": "2000k"},
]

HLS_SEGMENT_TIME = 4  # 单 .ts 时长
HLS_CACHE_TTL = 60 * 60  # master.m3u8 缓存 1 小时
HLS_TS_EXPIRE = 60 * 60 * 24  # .ts 切片 OSS 签名 24 小时


class HlsTranscodeReq(BaseModel):
    videoId: str  # noqa: 5
    videoPath: str | None = None  # noqa: 5
    segmentTime: int = HLS_SEGMENT_TIME  # 切片秒数  # noqa: 5


class HlsTranscodeData(BaseModel):
    videoId: str  # noqa: 5
    masterUrl: str  # master.m3u8 完整文本的 URL (前端 hls.js 直接加载)  # noqa: 5
    masterContent: str  # master.m3u8 文本  # noqa: 5
    bitrates: list[dict]  # 档位列表
    duration: float
    segmentCount: int  # noqa: 5
    cached: bool


def _run_ffmpeg_hls(src: str, out_dir: str, segment_time: int) -> dict:
    """调 ffmpeg 多码率转码, 输出到 out_dir.

    返回: {"returncode": int, "stderr": str, "files": [...生成的文件名...]}
    """
    os.makedirs(out_dir, exist_ok=True)
    # 构建 ffmpeg 命令
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", src]
    n = len(HLS_BITRATES)
    for i, br in enumerate(HLS_BITRATES):
        cmd += [
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            f"-c:v:{i}",
            "h264",
            f"-filter:v:{i}",
            f"scale=-2:{br['height']}",
            f"-b:v:{i}",
            br["bitrate"],
            f"-maxrate:v:{i}",
            br["maxrate"],
            f"-bufsize:v:{i}",
            br["bufsize"],
            f"-c:a:{i}",
            "aac",
            f"-ac:{i}",
            "2",
            f"-ar:{i}",
            "48000",
        ]
    cmd += [
        "-f",
        "hls",
        "-hls_time",
        str(segment_time),
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        os.path.join(out_dir, "stream_%v", "seg_%03d.ts"),
        "-master_pl_name",
        "master.m3u8",
        "-var_stream_map",
        " ".join(f"v:{i},a:{i}" for i in range(n)),
        os.path.join(out_dir, "stream_%v.m3u8"),
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=600, check=False)
    files = []
    for root, _, fs in os.walk(out_dir):
        for f in fs:
            files.append(os.path.relpath(os.path.join(root, f), out_dir))
    return {"returncode": proc.returncode, "stderr": proc.stderr.decode("utf-8", "ignore"), "files": files}


def _rewrite_m3u8(content: str, ts_url_map: dict) -> str:
    """把 m3u8 内容里所有 .ts 文件名替换为预签名 URL.

    ts_url_map: {"seg_000.ts": "https://oss.../seg_000.ts?Signature=..."}
    """
    out = []
    for line in content.splitlines():
        s = line.strip()
        if s and not s.startswith("#") and (s.endswith(".ts") or s in ts_url_map):
            out.append(ts_url_map.get(s, s))
        else:
            out.append(line)
    return "\n".join(out) + "\n"


@router.post("/hls/transcode", summary="HLS 多码率转码 (生成 master.m3u8 + .ts)")
async def transcode_hls(req: HlsTranscodeReq):
    """对应 Java: POST /api/video/hls/transcode

    流程:
    1. 跑 ffmpeg 生成 3 档位 (1080p/720p/480p) .ts 切片 + master.m3u8
    2. 所有 .ts 上传 storage
    3. 改写 m3u8 把 .ts 路径替换成预签名 URL
    4. 改写后的 m3u8 上传 storage, 缓存到 Redis
    """
    if req.segmentTime < 1 or req.segmentTime > 30:
        return fail("segmentTime 必须在 [1, 30]", code=400)
    import time as _t

    _t0 = _t.perf_counter()

    # 缓存命中优先 (避免重复跑 ffmpeg)
    r = get_redis()
    cache_key = f"zhs:video:hls:{req.videoId}"
    cached = None
    try:
        cached = r.get(cache_key)
    except Exception:
        logger.warning("Unexpected error in line 400")
        pass
    if cached:
        record_cache("hls_master", hit=True)
        HLS_BITRATE_TOTAL.labels(result="cached").inc()
        BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous").inc()
        BIZ_LATENCY.labels(endpoint="hls_transcode").observe(_t.perf_counter() - _t0)
        return success(
            {
                "videoId": req.videoId,
                "masterUrl": cached,
                "masterContent": r.get(cache_key + ":content") or "",
                "bitrates": HLS_BITRATES,
                "duration": 0,
                "segmentCount": 0,
                "cached": True,
            }
        )
    record_cache("hls_master", hit=False)

    video_path = _resolve_video_path(req.videoId, req.videoPath)
    if not os.path.exists(video_path):
        return fail(f"视频不存在: {video_path}", code=404)
    if not _has_ffmpeg():
        return fail("ffmpeg 不可用, 请安装并加入 PATH", code=500)

    # 跑 ffmpeg
    loop = asyncio.get_event_loop()
    with tempfile.TemporaryDirectory(prefix="hls_") as tmp:
        result = await loop.run_in_executor(None, _run_ffmpeg_hls, video_path, tmp, req.segmentTime)
        if result["returncode"] != 0:
            logger.error(f"ffmpeg HLS 转码失败: {result['stderr'][:500]}")
            return fail(f"ffmpeg 转码失败: {result['stderr'][:200]}", code=500)

        # 收集 .ts 和 m3u8
        ts_files = sorted([f for f in result["files"] if f.endswith(".ts")])
        m3u8_files = [f for f in result["files"] if f.endswith(".m3u8")]
        if "master.m3u8" not in m3u8_files:
            return fail("master.m3u8 未生成", code=500)

        # 上传所有 .ts 到 storage
        storage = get_storage()
        hls_prefix = f"video-hls/{req.videoId}"
        ts_url_map: dict = {}
        for rel in ts_files:
            abs_path = os.path.join(tmp, rel)
            key = f"{hls_prefix}/{rel.replace(os.sep, '/')}"
            with open(abs_path, "rb") as f:
                data = f.read()
            if not storage.upload_bytes(key, data):
                return fail(f"上传 .ts 失败: {rel}", code=500)
            ts_url_map[os.path.basename(rel)] = (
                storage.presigned_url(key, expires=HLS_TS_EXPIRE) or f"/static/storage/{key}"
            )

        # 改写各档位 m3u8 (替换 .ts 路径)
        rewritten_playlists: dict = {}
        for rel in m3u8_files:
            abs_path = os.path.join(tmp, rel)
            with open(abs_path, encoding="utf-8") as f:
                content = f.read()
            new_content = _rewrite_m3u8(content, ts_url_map)
            rewritten_playlists[rel] = new_content
            # 上传改写后的 m3u8
            key = f"{hls_prefix}/{rel}"
            storage.upload_bytes(key, new_content.encode("utf-8"))

        master_content = rewritten_playlists.get("master.m3u8", "")
        # master.m3u8 里的子 m3u8 路径也要替换为预签名 URL
        playlist_url_map = {}
        for rel in m3u8_files:
            if rel == "master.m3u8":
                continue
            key = f"{hls_prefix}/{rel}"
            playlist_url_map[rel] = storage.presigned_url(key, expires=HLS_TS_EXPIRE) or f"/static/storage/{key}"
        master_content = _rewrite_m3u8(master_content, playlist_url_map)
        # 上传最终 master.m3u8
        storage.upload_bytes(f"{hls_prefix}/master.m3u8", master_content.encode("utf-8"))
        master_url = (
            storage.presigned_url(f"{hls_prefix}/master.m3u8", expires=HLS_TS_EXPIRE)
            or f"/static/storage/{hls_prefix}/master.m3u8"
        )

        # 缓存
        try:
            r.setex(cache_key, HLS_CACHE_TTL, master_url)
            r.setex(cache_key + ":content", HLS_CACHE_TTL, master_content)
        except Exception:
            logger.warning("Unexpected error in line 479")
            pass

        # 业务指标
        HLS_TRANSCODE_SECONDS.labels(video_id=req.videoId).observe(_t.perf_counter() - _t0)
        HLS_BITRATE_TOTAL.labels(result="success").inc()
        per_bitrate_count = len(ts_files) // len(HLS_BITRATES) if HLS_BITRATES else 0
        for br in HLS_BITRATES:
            HLS_SEGMENTS_TOTAL.labels(bitrate=br["name"]).inc(per_bitrate_count)
        BIZ_REQUEST_TOTAL.labels(endpoint="hls_transcode", status="200", tenant_id="anonymous").inc()
        BIZ_LATENCY.labels(endpoint="hls_transcode").observe(_t.perf_counter() - _t0)

        return success(
            {
                "videoId": req.videoId,
                "masterUrl": master_url,
                "masterContent": master_content,
                "bitrates": HLS_BITRATES,
                "duration": 0,
                "segmentCount": len(ts_files) // len(HLS_BITRATES),
                "cached": False,
            }
        )


@router.get("/hls/manifest/{videoId}", summary="取 HLS master.m3u8 文本 (含 .ts 预签名 URL)")
async def get_hls_manifest(videoId: str):  # noqa: 28
    """GET /api/video/hls/manifest/{videoId} -- 纯文本, 前端 hls.js 直接加载."""
    r = get_redis()
    cache_key = f"zhs:video:hls:{videoId}"
    content = None
    try:
        content = r.get(cache_key + ":content")
    except Exception:
        logger.warning("Unexpected error in line 510")
        pass
    if not content:
        from fastapi import Response

        return Response(status_code=404, content="#EXTM3U\n# master not ready\n")
    from fastapi import Response

    return Response(content=content, media_type="application/vnd.apple.mpegurl")


@router.get("/hls/playlist/{videoId}/{bitrate}", summary="取单档 m3u8 文本")
async def get_hls_playlist(videoId: str, bitrate: str):  # noqa: 28
    """GET /api/video/hls/playlist/{videoId}/{1080p|720p|480p}"""
    from fastapi import Response

    storage = get_storage()
    key = f"video-hls/{videoId}/stream_{bitrate}.m3u8"
    if not storage.exists(key):
        return Response(status_code=404, content="#EXTM3U\n# not found\n")
    # 本地存储时直接读文件
    if hasattr(storage, "base"):
        try:
            text = (storage.base / key).read_text(encoding="utf-8")
            return Response(content=text, media_type="application/vnd.apple.mpegurl")
        except Exception:
            logger.warning("Unexpected error in line 532")
            pass
    return Response(status_code=404, content="#EXTM3U\n# not readable\n")
