# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""媒体任务统一持久化 + REST 管理 + 上传出口 + 音乐模型 env(2026-09-09)。

覆盖:
- media_tasks 服务层:persist/query/get/update(DB 异常不抛)
- call_tool 出口落库挂接(媒体工具落库、非媒体工具跳过)
- REST:列表/详情/取消/上传(参数校验)
- MCP 上传工具:缺参/文件不存在/SSRF
- TOKEN6688_MUSIC_MODEL env fallback
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.services import mcp_server
from app.services import media_tasks as mt
from app.routers import media_tasks as mt_router

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# 服务层:persist_media_task
# ---------------------------------------------------------------------------


async def test_persist_non_media_tool_skipped():
    """非媒体工具直接跳过,不碰 DB。"""
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as mock_conn:
        ok = await mt.persist_media_task("read_file", {"ok": True, "content": "x"}, user_uuid="u")
    assert ok is False
    mock_conn.assert_not_called()


async def test_persist_media_tool_without_artifact_skipped():
    """媒体工具但无 task_id/产物 URL → 跳过。"""
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as mock_conn:
        ok = await mt.persist_media_task("music_generation", {"ok": False, "error": "x"})
    assert ok is False
    mock_conn.assert_not_called()


async def test_persist_music_task_processing():
    """音乐提交:task_id 落库,status=processing。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 1}])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.persist_media_task(
            "music_generation",
            {"ok": True, "task_id": "t-music-1", "provider": "token6688", "audio_url": None},
            user_uuid="u1", chat_id="c1", prompt="一首歌",
        )
    assert ok is True
    sql, *params = mock_conn.fetch.call_args.args
    assert "INSERT INTO media_tasks" in sql
    assert "t-music-1" in params


async def test_persist_video_completed_succeeded():
    """视频完成:有 video_url → status=succeeded,产物进 result。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 1}])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.persist_media_task(
            "video_generation",
            {"ok": True, "task_id": "t-v", "provider": "token6688", "video_url": "https://x/v.mp4"},
        )
    assert ok is True
    sql, *params = mock_conn.fetch.call_args.args
    assert "succeeded" in params
    assert "https://x/v.mp4" in params[-1]


async def test_persist_duplicate_task_id_updates():
    """同 task_id 二次写入(对话内查询)→ 走 UPDATE 刷新。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])  # 无插入行
    mock_conn.execute = AsyncMock(return_value=None)
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.persist_media_task(
            "video_generation",
            {"ok": True, "task_id": "t-dup", "video_url": "https://x/v.mp4"},
        )
    assert ok is True
    assert "UPDATE media_tasks" in mock_conn.execute.call_args.args[0]


async def test_persist_db_error_not_raised():
    """DB 异常安全包裹:返回 False,不抛(不阻断对话)。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(side_effect=RuntimeError("db down"))
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.persist_media_task(
            "music_generation", {"ok": True, "task_id": "t-1"},
        )
    assert ok is False


# ---------------------------------------------------------------------------
# 服务层:query / get / update
# ---------------------------------------------------------------------------


async def test_query_media_tasks():
    """列表查询:kind/status/user_uuid 过滤 + 倒序。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[
            {"id": 2, "kind": "video", "task_id": "t2", "result": '{"video_url":"https://x/v.mp4"}'}
        ]
    )
    mock_conn.fetchval = AsyncMock(return_value=1)
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        data = await mt.query_media_tasks(kind="video", status="processing", user_uuid="u1")
    assert data["total"] == 1
    assert data["items"][0]["task_id"] == "t2"
    assert data["items"][0]["result"]["video_url"] == "https://x/v.mp4"


async def test_get_media_task_none():
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        row = await mt.get_media_task("t-missing")
    assert row is None


async def test_update_media_task():
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value={"id": 1})
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.update_media_task("t-1", status="cancelled")
    assert ok is True
    assert "UPDATE media_tasks" in mock_conn.fetchrow.call_args.args[0]


# ---------------------------------------------------------------------------
# call_tool 出口落库挂接
# ---------------------------------------------------------------------------


async def test_call_tool_persists_media_task(monkeypatch):
    """媒体工具执行成功后调用 persist_media_task(user_id/session_id 透传)。"""

    async def _fake(arguments):  # noqa: ANN001
        return {"tool": "music_generation", "ok": True, "task_id": "t-1", "audio_url": None}

    monkeypatch.setitem(mcp_server._TOOL_HANDLERS, "music_generation", _fake)
    recorded: dict = {}

    async def _fake_persist(tool, result, *, user_uuid="", chat_id=""):
        recorded.update(tool=tool, result=result, user_uuid=user_uuid, chat_id=chat_id)
        return True

    monkeypatch.setattr("app.services.media_tasks.persist_media_task", _fake_persist)
    srv = mcp_server.MCPServer()
    out = await srv.call_tool(
        "music_generation", {"prompt": "x"}, user_id="u1", session_id="s1",
    )
    assert out["ok"] is True
    assert recorded.get("tool") == "music_generation"
    assert recorded["result"]["task_id"] == "t-1"
    assert recorded.get("user_uuid") == "u1"
    assert recorded.get("chat_id") == "s1"


async def test_call_tool_skips_non_media_tool(monkeypatch):
    """非媒体工具:统一落库出口调用 persist 入口,但内部按 tool 过滤跳过(DB 不被触碰)。"""

    async def _fake(arguments):  # noqa: ANN001
        return {"ok": True, "task_id": "x"}

    monkeypatch.setitem(mcp_server._TOOL_HANDLERS, "read_file", _fake)
    fake_persist = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.media_tasks.persist_media_task", fake_persist)
    srv = mcp_server.MCPServer()
    out = await srv.call_tool("read_file", {"path": "a.py"})
    assert out["ok"] is True
    # 新契约:call_tool 统一调用 persist(内部对非媒体工具返回 False 且不碰 DB),
    # 这里验证调用确实发生且工具名/结果透传正确,不影响主流程
    fake_persist.assert_awaited_once()
    assert fake_persist.call_args.args[0] == "read_file"


# ---------------------------------------------------------------------------
# REST 端点
# ---------------------------------------------------------------------------


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(mt_router.router, prefix="/api")
    return app


async def test_rest_media_task_list(monkeypatch):
    # router 顶层 `from ..services.media_tasks import query_media_tasks` 直接绑定函数,
    # 须 patch router 模块名而非 services 模块
    monkeypatch.setattr(
        "app.routers.media_tasks.query_media_tasks",
        AsyncMock(return_value={"items": [{"task_id": "t1", "kind": "video"}], "total": 1}),
    )
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/tasks", params={"kind": "video", "user_uuid": "u1"})
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1


async def test_rest_media_task_detail_404(monkeypatch):
    monkeypatch.setattr("app.routers.media_tasks.get_media_task", AsyncMock(return_value=None))
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/tasks/t-missing")
    assert resp.status_code == 404


async def test_rest_media_task_cancel_unconfigured(monkeypatch):
    """取消:token6688 未配置(conftest 清空)→ 如实返回未配置错误,本地置 cancelled。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-1", "provider": "token6688", "status": "processing"}),
    )
    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-1/cancel")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "token6688 未配置" in body["data"].get("error", "")
    upd.assert_awaited_once()


async def test_rest_media_upload_missing_params():
    """上传:file 与 url 都缺 → 400。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/upload")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# MCP 上传工具
# ---------------------------------------------------------------------------


async def test_upload_file_missing_params():
    out = await mcp_server._tool_token6688_upload_file({})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_upload_file_path_not_found():
    out = await mcp_server._tool_token6688_upload_file({"path": "Z:/no/such/file.mp4"})
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_NOT_FOUND"


async def test_upload_file_ssrf_blocked():
    out = await mcp_server._tool_token6688_upload_file({"url": "http://127.0.0.1:8080/x.png"})
    assert out["ok"] is False
    assert out["errorCode"] == "SSRF_BLOCKED"


# ---------------------------------------------------------------------------
# TOKEN6688_MUSIC_MODEL env fallback
# ---------------------------------------------------------------------------


async def test_music_model_env_fallback(monkeypatch):
    """MUSIC_MODEL env 生效:generate_music 收到 env 指定 model。"""

    class _Inst:
        def __init__(self):
            self.kw = {}

        async def generate_music(self, prompt, **kw):
            self.kw = kw
            return {"task_id": "t-music-env"}

        async def get_task_status(self, tid):
            # 首次查询即返回完成态,快速跳出轮询循环
            return {"ok": True, "status": "completed", "video_url": "https://x/audio.mp3"}

    inst = _Inst()
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: inst if p == "token6688" else None)
    monkeypatch.setenv("TOKEN6688_MUSIC_MODEL", "custom-music")
    out = await mcp_server._tool_music_generation({"prompt": "测试", "mode": "song"})
    assert out["ok"] is True
    assert out["audio_url"] == "https://x/audio.mp3"
    assert inst.kw.get("model") == "custom-music"


async def test_music_model_arg_overrides_env(monkeypatch):
    """显式 model 参数优先于 env。"""

    class _Inst:
        def __init__(self):
            self.kw = {}

        async def generate_music(self, prompt, **kw):
            self.kw = kw
            return {"task_id": "t-music-arg"}

        async def get_task_status(self, tid):
            return {"ok": True, "status": "completed", "video_url": "https://x/a.mp3"}

    inst = _Inst()
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: inst if p == "token6688" else None)
    monkeypatch.setenv("TOKEN6688_MUSIC_MODEL", "env-model")
    out = await mcp_server._tool_music_generation(
        {"prompt": "测试", "mode": "song", "model": "arg-model"}
    )
    assert out["ok"] is True
    assert inst.kw.get("model") == "arg-model"


# ---------------------------------------------------------------------------
# voice_tts 深度增强(2026-09-09):超长文本异步 TTS + task_id 取件
# ---------------------------------------------------------------------------


async def test_voice_tts_text_too_long_over_5000():
    """text>5000 直接拒绝(TEXT_TOO_LONG)。"""
    out = await mcp_server._tool_voice_tts({"text": "长" * 5001})
    assert out["ok"] is False
    assert out["errorCode"] == "TEXT_TOO_LONG"


async def test_voice_tts_long_text_edge_rejected():
    """>2000 字符 + engine=edge:edge 不支持超长,拒绝并提示改 auto/token6688。"""
    out = await mcp_server._tool_voice_tts({"text": "长" * 2001, "engine": "edge"})
    assert out["ok"] is False
    assert out["errorCode"] == "TEXT_TOO_LONG"
    assert "edge" in out["error"]


async def test_voice_tts_long_text_auto_async_submit(monkeypatch):
    """>2000 字符自动切 token6688 异步 TTS:submitted=true + task_id,audio_url=None。"""

    class _Inst:
        async def tts_async(self, text, *, voice="alloy", speed=1.0, response_format="mp3", wait=True):
            self.text = text
            return {"task_id": "t-tts-long", "status": "submitted"}

    inst = _Inst()
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: inst if p == "token6688" else None)
    out = await mcp_server._tool_voice_tts({"text": "长" * 2001})
    assert out["ok"] is True
    assert out["submitted"] is True
    assert out["task_id"] == "t-tts-long"
    assert out["status"] == "submitted"
    assert out["audio_url"] is None
    assert out["text_chars"] == 2001
    assert len(inst.text) == 2001


async def test_voice_tts_long_text_unconfigured(monkeypatch):
    """>2000 字符但 token6688 未配置 → PROVIDER_NOT_CONFIGURED,提示可分段走 edge。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: None)
    out = await mcp_server._tool_voice_tts({"text": "长" * 2001})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"


async def test_voice_tts_task_id_pickup_completed(monkeypatch):
    """task_id 查询模式:completed 且带 audio_url → 取件成功。"""

    class _Inst:
        async def get_task_status(self, tid):
            assert tid == "t-tts-1"
            return {"ok": True, "status": "completed", "audio_url": "https://x/speech.mp3"}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_voice_tts({"task_id": "t-tts-1"})
    assert out["ok"] is True
    assert out["status"] == "completed"
    assert out["audio_url"] == "https://x/speech.mp3"


async def test_voice_tts_task_id_processing(monkeypatch):
    """task_id 查询模式:处理中 → submitted=true + 提示稍后取件。"""

    class _Inst:
        async def get_task_status(self, tid):
            return {"ok": True, "status": "processing"}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_voice_tts({"task_id": "t-tts-1"})
    assert out["ok"] is True
    assert out["submitted"] is True
    assert out["audio_url"] is None


async def test_voice_tts_task_id_failed(monkeypatch):
    """task_id 查询模式:任务失败 → ok=False + TASK_FAILED。"""

    class _Inst:
        async def get_task_status(self, tid):
            return {"failed": True, "status": "failed", "error": "生成失败"}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_voice_tts({"task_id": "t-tts-1"})
    assert out["ok"] is False
    assert out["errorCode"] == "TASK_FAILED"


async def test_voice_tts_task_id_unconfigured(monkeypatch):
    """task_id 查询模式:token6688 未配置 → PROVIDER_NOT_CONFIGURED。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: None)
    out = await mcp_server._tool_voice_tts({"task_id": "t-tts-1"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"


# ---------------------------------------------------------------------------
# token6688_voice_clone 声纹克隆工具(2026-09-09)
# ---------------------------------------------------------------------------


async def test_voice_clone_bad_action(monkeypatch):
    """未知 action → BAD_PARAMS。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: object())
    out = await mcp_server._tool_token6688_voice_clone({"action": "delete"})
    assert out["ok"] is False
    assert out["errorCode"] == "BAD_PARAMS"


async def test_voice_clone_unconfigured(monkeypatch):
    """token6688 未配置 → PROVIDER_NOT_CONFIGURED。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: None)
    out = await mcp_server._tool_token6688_voice_clone({})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"


async def test_voice_clone_list(monkeypatch):
    """action=list:返回声纹列表 + hint。"""

    class _Inst:
        async def list_voices(self):
            return [{"voice_id": "v1", "name": "我的声音"}]

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_token6688_voice_clone({"action": "list"})
    assert out["ok"] is True
    assert out["action"] == "list"
    assert out["count"] == 1
    assert out["voices"][0]["voice_id"] == "v1"


async def test_voice_clone_get_missing_voice_id(monkeypatch):
    """action=get 缺 voice_id → MISSING_PARAMS。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: object())
    out = await mcp_server._tool_token6688_voice_clone({"action": "get"})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_voice_clone_upload_conflict(monkeypatch):
    """action=upload 同时传 path+url → BAD_PARAMS(三选一)。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: object())
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "path": "a.wav", "url": "http://x/a.wav"}
    )
    assert out["ok"] is False
    assert out["errorCode"] == "BAD_PARAMS"


async def test_voice_clone_upload_data_uri(monkeypatch):
    """action=upload 走 data_uri:上传成功返回 voice_id。"""
    import base64 as _b64

    wav = b"\x00RIFF\x00\x00\x00\x00WAVEfake"

    class _Inst:
        async def upload_voice(self, audio, filename):
            assert audio == wav
            assert filename.endswith(".wav")
            return {"voice": {"id": "v-cloned"}}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    uri = "data:audio/wav;base64," + _b64.b64encode(wav).decode()
    out = await mcp_server._tool_token6688_voice_clone({"action": "upload", "data_uri": uri})
    assert out["ok"] is True
    assert out["voice_id"] == "v-cloned"
