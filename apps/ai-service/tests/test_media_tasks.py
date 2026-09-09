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

import json
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


def _make_app(scope: tuple[str, bool] = ("u-admin", True)) -> FastAPI:
    """测试用裸 FastAPI(无 JWT 中间件)。

    默认注入 admin 身份(现有用例行为不变:admin 尊重显式 user_uuid 传参);
    需要模拟普通用户时传 scope=("u-plain", False)。
    """
    app = FastAPI()
    app.include_router(mt_router.router, prefix="/api")
    app.dependency_overrides[mt_router._user_scope] = lambda: scope
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


async def test_rest_media_task_detail_live_probe_kind_mapping(monkeypatch):
    """详情:在途 image 任务实时探测成片 → 按 kind 落 image_url 并回写 succeeded。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(
            return_value={
                "task_id": "t-img", "kind": "image", "provider": "token6688",
                "status": "processing", "result": {},
            }
        ),
    )

    class _Cfg:
        api_key = "sk-test"
        api_base = "https://k.token6688.com"

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    class _Inst:
        async def get_task_status(self, tid):
            assert tid == "t-img"
            return {"status": "completed", "video_url": "https://cdn/1.png"}

    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider",
        lambda api_key, api_base: _Inst(),
    )
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/tasks/t-img")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["result"]["image_url"] == "https://cdn/1.png"
    assert "video_url" not in body["result"]
    upd.assert_awaited_once()
    args, kwargs = upd.call_args
    assert args[0] == "t-img"
    assert kwargs.get("status") == "succeeded"
    assert kwargs["result"]["image_url"] == "https://cdn/1.png"


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


async def test_rest_media_task_cancel_terminal_409(monkeypatch):
    """取消守卫(2026-09-09 收尾):已终态任务 → 409,不翻转状态、不调取消。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-done", "provider": "token6688", "status": "succeeded"}),
    )
    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-done/cancel")
    assert resp.status_code == 409
    assert "已终态" in resp.json()["detail"]
    upd.assert_not_awaited()


async def test_rest_media_task_cancel_pending_ok(monkeypatch):
    """取消守卫(2026-09-09 收尾):pending 在途任务仍可正常取消置 cancelled。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-p", "provider": "token6688", "status": "pending"}),
    )
    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-p/cancel")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    upd.assert_awaited_once()
    args, kwargs = upd.call_args
    assert args[0] == "t-p"
    assert kwargs.get("status") == "cancelled"


async def test_rest_media_task_list_non_admin_forced_filter(monkeypatch):
    """P0 越权修复(2026-09-09):非 admin 强制按 JWT 用户过滤,客户端传参被忽略。"""
    q = AsyncMock(return_value={"items": [], "total": 0})
    monkeypatch.setattr("app.routers.media_tasks.query_media_tasks", q)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 不传 user_uuid / 冒传他人 user_uuid → 都强制为自身
        await ac.get("/api/media/tasks")
        resp = await ac.get("/api/media/tasks", params={"user_uuid": "someone-else"})
    assert resp.status_code == 200
    assert q.call_args_list[0].kwargs.get("user_uuid") == "u-plain"
    assert q.call_args_list[1].kwargs.get("user_uuid") == "u-plain"


async def test_rest_media_task_detail_other_user_404(monkeypatch):
    """P0 越权修复(2026-09-09):非 admin 查看他人任务 → 404(不泄露存在性)。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-x", "user_uuid": "someone-else", "status": "succeeded"}),
    )
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/tasks/t-x")
    assert resp.status_code == 404


async def test_rest_media_task_cancel_other_user_404(monkeypatch):
    """P0 越权修复(2026-09-09):非 admin 取消他人任务 → 404,不触发取消/置位。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-o", "user_uuid": "someone-else", "status": "processing"}),
    )
    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-o/cancel")
    assert resp.status_code == 404
    upd.assert_not_awaited()


async def test_rest_media_tasks_cancel_batch_user_scoped(monkeypatch):
    """P0 越权修复(2026-09-09):批量取消非 admin 强制携带自身 user_uuid。"""
    svc = AsyncMock(return_value={"requested": 0, "cancelled": 0, "remote_failed": []})
    monkeypatch.setattr("app.routers.media_tasks.cancel_media_tasks", svc)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/cancel", json={"kind": "video"})
    assert resp.status_code == 200
    assert svc.call_args.kwargs.get("user_uuid") == "u-plain"


async def test_rest_media_task_clear_non_admin_scoped(monkeypatch):
    """P0 越权修复(2026-09-09):批量清理非 admin 强制按自身过滤。"""
    svc = AsyncMock(return_value={"deleted": 0, "kept_in_flight": 0})
    monkeypatch.setattr("app.routers.media_tasks.clear_media_tasks", svc)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/media/tasks", params={"status": "succeeded"})
    assert resp.status_code == 200
    assert svc.call_args.kwargs.get("user_uuid") == "u-plain"


# ---------------------------------------------------------------------------
# 删除/清理(2026-09-09 F1):单条删除 + 批量清理(只删终态,在途保留)
# ---------------------------------------------------------------------------


async def test_delete_media_task_empty_id():
    """删除:task_id 空 → False(不碰 DB)。"""
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as mock_conn:
        ok = await mt.delete_media_task("")
    assert ok is False
    mock_conn.assert_not_called()


async def test_delete_media_task_ok():
    """删除:命中行返回 True。"""
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value={"id": 7})
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.delete_media_task("t-del")
    assert ok is True
    sql = mock_conn.fetchrow.call_args.args[0]
    assert "DELETE FROM media_tasks" in sql and "task_id=$1" in sql
    assert mock_conn.fetchrow.call_args.args[1] == "t-del"


async def test_delete_media_task_missing():
    """删除:无命中行返回 False。"""
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.delete_media_task("t-none")
    assert ok is False


async def test_clear_media_tasks_only_final():
    """清理:只删终态行,在途行统计保留。"""
    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(side_effect=[2, 5])  # kept_in_flight=2, deleted=5
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.clear_media_tasks(kind="video", status="succeeded,failed")
    assert result == {"deleted": 5, "kept_in_flight": 2}
    del_sql = mock_conn.fetchval.call_args_list[1].args[0]
    assert "DELETE FROM media_tasks" in del_sql
    # 删除条件排除在途:status <> ALL(...)
    assert "status <> ALL" in del_sql
    # 过滤条件透传:kind=ANY + status=ANY
    assert "kind = ANY($1)" in del_sql
    assert "status = ANY($2)" in del_sql
    assert mock_conn.fetchval.call_args_list[1].args[1] == ["video"]
    assert mock_conn.fetchval.call_args_list[1].args[2] == ["succeeded", "failed"]


async def test_clear_media_tasks_before_filter():
    """清理:before 时间截点进 WHERE,无过滤条件时也强制限定终态。"""
    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(side_effect=[0, 3])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.clear_media_tasks(before="2026-09-01T00:00:00Z")
    assert result == {"deleted": 3, "kept_in_flight": 0}
    del_sql = mock_conn.fetchval.call_args_list[1].args[0]
    assert "created_at < $1" in del_sql
    assert "status <> ALL($2)" in del_sql
    assert "WHERE" in del_sql


async def test_rest_media_task_delete(monkeypatch):
    """REST 单条删除:命中 200,未命中 404(删除前先做归属校验,须 mock get)。"""
    app = _make_app()
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-x", "user_uuid": "u-admin", "status": "succeeded"}),
    )
    monkeypatch.setattr(
        "app.routers.media_tasks.delete_media_task",
        AsyncMock(return_value=True),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/media/tasks/t-x")
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True
    monkeypatch.setattr(
        "app.routers.media_tasks.delete_media_task",
        AsyncMock(return_value=False),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/media/tasks/t-x")
    assert resp.status_code == 404


async def test_rest_media_task_clear(monkeypatch):
    """REST 批量清理:参数透传,返回 deleted/kept_in_flight。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.clear_media_tasks",
        AsyncMock(return_value={"deleted": 3, "kept_in_flight": 1}),
    )
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete(
            "/api/media/tasks",
            params={"kind": "video,image", "status": "failed", "before": "2026-09-01T00:00:00Z"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["deleted"] == 3
    assert body["data"]["kept_in_flight"] == 1


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
    """未知 action(如 foo)→ BAD_PARAMS(delete 已合法化,E4)。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: object())
    out = await mcp_server._tool_token6688_voice_clone({"action": "foo"})
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


async def test_voice_clone_delete_missing_voice_id(monkeypatch):
    """action=delete 缺 voice_id → MISSING_PARAMS。"""
    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: object())
    out = await mcp_server._tool_token6688_voice_clone({"action": "delete"})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_voice_clone_delete_ok(monkeypatch):
    """action=delete:远端删除成功 → ok=True + hint。"""
    called = {}

    class _Inst:
        async def delete_voice(self, voice_id):
            called["voice_id"] = voice_id
            return {"ok": True, "status": "deleted", "raw": {}}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_token6688_voice_clone({"action": "delete", "voice_id": "v-del"})
    assert called.get("voice_id") == "v-del"
    assert out["ok"] is True
    assert out["action"] == "delete"
    assert out["status"] == "deleted"
    assert "已删除" in out["hint"]


async def test_voice_clone_delete_failed(monkeypatch):
    """action=delete:远端删除失败(端点不支持)→ ok=False + status=unsupported 如实返回。"""

    class _Inst:
        async def delete_voice(self, voice_id):
            return {"ok": False, "status": "unsupported", "error": "删除端点均不可用(官方未收录)"}

    monkeypatch.setattr("app.services.video_generation._instantiate", lambda p: _Inst() if p == "token6688" else None)
    out = await mcp_server._tool_token6688_voice_clone({"action": "delete", "voice_id": "v-del"})
    assert out["ok"] is False
    assert out["status"] == "unsupported"
    assert "删除失败" in out["hint"]
    assert out["error"]


# ---------------------------------------------------------------------------
# E1 统一媒体回调 handle_media_callback(2026-09-09)
# ---------------------------------------------------------------------------


async def test_callback_missing_task_id():
    """快照缺 task_id → ok=False,不碰 DB。"""
    with patch("app.services.media_tasks.get_db_conn", new_callable=AsyncMock) as mock_conn:
        out = await mt.handle_media_callback({"state": "success"})
    assert out["ok"] is False
    assert "task_id" in out["error"]
    mock_conn.assert_not_called()


async def test_callback_non_final_ignored():
    """中间态快照(processing)→ matched=0 + ignored=non-final,不落库。"""
    mock_conn = AsyncMock()
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        out = await mt.handle_media_callback(
            {"task_id": "t-1", "state": "processing", "is_final": False}
        )
    assert out["ok"] is True
    assert out["matched"] == 0
    assert out["ignored"] == "non-final"
    mock_conn.fetch.assert_not_called()


async def test_callback_success_writes_succeeded():
    """终态成功带 output_url → 在途行回写 succeeded,kind 字段映射正确。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 1, "kind": "video"}])
    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        out = await mt.handle_media_callback(
            {
                "task_id": "t-v1", "state": "success", "is_final": True,
                "output_url": "https://cdn/x.mp4",
            }
        )
    assert out["ok"] is True
    assert out["matched"] == 1
    assert updated[0]["tid"] == "t-v1"
    assert updated[0]["status"] == "succeeded"
    assert updated[0]["result"]["video_url"] == "https://cdn/x.mp4"
    assert updated[0]["result"]["via"] == "callback"
    # 在途过滤条件
    sql, *params = mock_conn.fetch.call_args.args
    assert "status = ANY($2)" in sql
    assert "t-v1" in params


async def test_callback_failed_writes_failed():
    """终态失败 → 在途行回写 failed + error 截断。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 1, "kind": "tts"}])
    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        out = await mt.handle_media_callback(
            {"task_id": "t-tts", "state": "failed", "is_final": True, "error": "配额不足"}
        )
    assert out["ok"] is True
    assert out["matched"] == 1
    assert updated[0]["status"] == "failed"
    assert updated[0]["result"]["error"] == "配额不足"
    assert updated[0]["result"]["via"] == "callback"


async def test_callback_success_no_url_falls_back_failed():
    """终态成功但无产物 URL(中间产物态)→ 按失败落库(不产生无产物 succeeded)。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 1, "kind": "music"}])
    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        out = await mt.handle_media_callback(
            {"task_id": "t-m", "state": "success", "is_final": True}
        )
    assert out["ok"] is True
    assert out["matched"] == 1
    assert updated[0]["status"] == "failed"
    assert "无产物" in updated[0]["result"]["error"] or "回调失败" in updated[0]["result"]["error"]


# ---------------------------------------------------------------------------
# E3 后台轮询 _poll_processing_batch(2026-09-09)
# ---------------------------------------------------------------------------


async def test_poll_no_inflight_rows():
    """无在途行 → 返回 0,不实例化 provider。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        n = await mt._poll_processing_batch()
    assert n == 0


async def test_poll_unconfigured_key(monkeypatch):
    """有在途行但 token6688 未配置 → 返回 0。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "kind": "video", "task_id": "t-v1"}]
    )

    class _Cfg:
        api_key = ""
        api_base = ""

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg() if name == "token6688" else None

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        n = await mt._poll_processing_batch()
    assert n == 0


async def test_poll_success_finalizes(monkeypatch):
    """探测到 completed + 产物 URL → 回写 succeeded(via=poller)。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "kind": "video", "task_id": "t-v1"}]
    )

    class _Cfg:
        api_key = "sk-test"
        api_base = "https://k.token6688.com"

    class _Inst:
        async def get_task_status(self, tid):
            assert tid == "t-v1"
            return {"status": "completed", "video_url": "https://cdn/v.mp4"}

    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider",
        lambda api_key, api_base: _Inst(),
    )
    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        n = await mt._poll_processing_batch()
    assert n == 1
    assert updated[0]["tid"] == "t-v1"
    assert updated[0]["status"] == "succeeded"
    assert updated[0]["result"]["video_url"] == "https://cdn/v.mp4"
    assert updated[0]["result"]["via"] == "poller"


async def test_poll_completed_no_url_waits(monkeypatch):
    """终态但尚无产物 URL(stage=downloading)→ 不落库,等下轮。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "kind": "video", "task_id": "t-v1"}]
    )

    class _Cfg:
        api_key = "sk-test"
        api_base = ""

    class _Inst:
        async def get_task_status(self, tid):
            return {"status": "completed"}

    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider",
        lambda api_key, api_base: _Inst(),
    )
    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        n = await mt._poll_processing_batch()
    assert n == 0
    assert updated == []


async def test_poll_failed_finalizes(monkeypatch):
    """探测到 failed → 回写 failed。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "kind": "music", "task_id": "t-m1"}]
    )

    class _Cfg:
        api_key = "sk-test"
        api_base = ""

    class _Inst:
        async def get_task_status(self, tid):
            return {"status": "failed", "error": "服务端超时"}

    updated: list[dict] = []

    async def _fake_update(tid, status=None, result=None):
        updated.append({"tid": tid, "status": status, "result": result})
        return True

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider",
        lambda api_key, api_base: _Inst(),
    )
    with (
        patch("app.services.media_tasks.get_db_conn", return_value=mock_conn),
        patch("app.services.media_tasks.update_media_task", new=_fake_update),
    ):
        n = await mt._poll_processing_batch()
    assert n == 1
    assert updated[0]["status"] == "failed"
    assert updated[0]["result"]["error"] == "服务端超时"
    assert updated[0]["result"]["via"] == "poller"


# ---------------------------------------------------------------------------
# E1 REST 回调端点 POST /api/media/tasks/callback(2026-09-09)
# ---------------------------------------------------------------------------


async def test_rest_callback_success(monkeypatch):
    """回调端点:配 secret + 合法签名 → 处理并返回 matched=1(fail-closed 后必须有签名)。"""
    import hashlib as _h
    import hmac as _hmac

    secret = "test-secret"
    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", secret)
    payload = {"task_id": "t-v1", "state": "success", "output_url": "https://x/v.mp4"}
    raw = json.dumps(payload).encode()
    sig = "sha256=" + _hmac.new(secret.encode(), raw, _h.sha256).hexdigest()
    monkeypatch.setattr(
        "app.routers.media_tasks.handle_media_callback",
        AsyncMock(return_value={"ok": True, "matched": 1}),
    )
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/callback",
            content=raw,
            headers={"X-TokenGo-Signature": sig, "Content-Type": "application/json"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["matched"] == 1


async def test_rest_callback_bad_json(monkeypatch):
    """回调端点:配 secret + 合法签名但非法 JSON 体 → 200 ok=False 不抛 500。"""
    import hashlib as _h
    import hmac as _hmac

    secret = "test-secret"
    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", secret)
    raw = b"not-json{{"
    sig = "sha256=" + _hmac.new(secret.encode(), raw, _h.sha256).hexdigest()
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/callback",
            content=raw,
            headers={
                "X-TokenGo-Signature": sig,
                "Content-Type": "application/json",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


async def test_rest_callback_signature_mismatch(monkeypatch):
    """回调端点:配置 secret 后签名不符 → 401。"""
    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", "sec")
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/callback",
            json={"task_id": "t-v1"},
            headers={"X-TokenGo-Signature": "sha256=deadbeef"},
        )
    assert resp.status_code == 401
    assert "签名" in resp.json()["detail"]


async def test_rest_callback_signature_ok(monkeypatch):
    """回调端点:配置 secret 且签名正确 → 200(验签通过)。"""
    import hashlib
    import hmac
    import json as _json

    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", "sec")
    monkeypatch.setattr(
        "app.routers.media_tasks.handle_media_callback",
        AsyncMock(return_value={"ok": True, "matched": 1}),
    )
    body = _json.dumps({"task_id": "t-v1", "state": "success"}).encode()
    sig = "sha256=" + hmac.new(b"sec", body, hashlib.sha256).hexdigest()
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/callback",
            content=body,
            headers={"Content-Type": "application/json", "X-TokenGo-Signature": sig},
        )
    assert resp.status_code == 200
    assert resp.json()["matched"] == 1


# ---------------------------------------------------------------------------
# F7 统计概览 media_task_stats(2026-09-09)
# ---------------------------------------------------------------------------


async def test_media_task_stats_aggregates():
    """统计:按 kind 聚合 总数/终态/在途,全局合计正确。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        side_effect=[
            [{"status": "processing", "n": 1}, {"status": "succeeded", "n": 2}],  # video
            [{"status": "failed", "n": 1}],  # music
            [],  # tts
            [{"status": "cancelled", "n": 3}, {"status": "succeeded", "n": 1}],  # image
        ]
    )
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        data = await mt.media_task_stats()
    assert data["total"] == 8
    assert data["inflight"] == 1
    assert data["succeeded"] == 3
    assert data["failed"] == 1
    assert data["cancelled"] == 3
    assert data["by_kind"]["video"] == {
        "total": 3, "succeeded": 2, "failed": 0, "cancelled": 0, "inflight": 1,
    }
    assert data["by_kind"]["image"]["cancelled"] == 3
    # 每个 kind 一次 GROUP BY 查询,共 4 次
    assert mock_conn.fetch.call_count == 4


async def test_media_task_stats_user_scoped():
    """统计:user_uuid 过滤进 WHERE。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        await mt.media_task_stats(user_uuid="u1")
    sql, *params = mock_conn.fetch.call_args.args
    assert "user_uuid=$1" in sql
    assert params[0] == "u1"


# ---------------------------------------------------------------------------
# F8 批量取消在途任务 cancel_media_tasks(2026-09-09)
# ---------------------------------------------------------------------------


async def test_cancel_media_tasks_no_inflight():
    """批量取消:无在途任务 → requested=0,不更新 DB。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.cancel_media_tasks()
    assert result == {"requested": 0, "cancelled": 0, "remote_failed": []}
    mock_conn.execute.assert_not_called()


async def test_cancel_media_tasks_all_inflight(monkeypatch):
    """批量取消:不传 task_ids → 全部在途置 cancelled;未配置 key 跳过远端。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[
            {"id": 1, "task_id": "t-v1", "provider": "token6688"},
            {"id": 2, "task_id": "t-m1", "provider": "token6688"},
        ]
    )
    mock_conn.execute = AsyncMock(return_value=None)

    class _Cfg:
        api_key = ""
        api_base = ""

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.cancel_media_tasks()
    assert result["requested"] == 2
    assert result["cancelled"] == 2
    assert result["remote_failed"] == []
    sql, params = mock_conn.execute.call_args.args
    assert "status='cancelled'" in sql
    assert "task_id = ANY($1)" in sql
    assert params == ["t-v1", "t-m1"]


async def test_cancel_media_tasks_task_ids_and_kind(monkeypatch):
    """批量取消:task_ids + kind 过滤进 WHERE;空串 task_id 被剔除。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "task_id": "t-v1", "provider": "token6688"}]
    )
    mock_conn.execute = AsyncMock(return_value=None)

    class _Cfg:
        api_key = ""
        api_base = ""

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.cancel_media_tasks(task_ids=["t-v1", "  "], kind="video,image")
    assert result["requested"] == 1
    sql, *params = mock_conn.fetch.call_args.args
    # 在途状态集合 + task_ids + kind 三个占位
    assert "task_id = ANY($2)" in sql
    assert "kind = ANY($3)" in sql
    assert params[0] == ["processing", "accepted", "submitted", "pending"]
    assert params[1] == ["t-v1"]
    assert params[2] == ["video", "image"]


async def test_cancel_media_tasks_remote_failure(monkeypatch):
    """批量取消:远端取消抛错 → 记 remote_failed,本地仍置 cancelled。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[{"id": 1, "task_id": "t-v1", "provider": "token6688"}]
    )
    mock_conn.execute = AsyncMock(return_value=None)

    class _Cfg:
        api_key = "sk-test"
        api_base = "https://k.token6688.com"

    class _Inst:
        async def cancel_task(self, tid):  # noqa: ANN001
            raise RuntimeError("boom")

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider",
        lambda api_key, api_base: _Inst(),
    )
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        result = await mt.cancel_media_tasks()
    assert result["cancelled"] == 1
    assert len(result["remote_failed"]) == 1
    assert result["remote_failed"][0]["task_id"] == "t-v1"
    assert "boom" in result["remote_failed"][0]["error"]


async def test_rest_media_tasks_stats(monkeypatch):
    """REST 统计:F7,GET /api/media/tasks/stats 返回聚合 + user_uuid 透传。"""
    called: dict = {}

    async def _fake(user_uuid=None):
        called["user_uuid"] = user_uuid
        return {
            "total": 8, "inflight": 1, "succeeded": 3, "failed": 1, "cancelled": 3,
            "by_kind": {"video": {"total": 3}},
        }

    monkeypatch.setattr("app.routers.media_tasks.media_task_stats", _fake)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/tasks/stats", params={"user_uuid": "u1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["data"]["inflight"] == 1
    assert called.get("user_uuid") == "u1"


async def test_rest_media_tasks_cancel_batch(monkeypatch):
    """REST 批量取消:F8,POST /api/media/tasks/cancel 透传 task_ids/kind。"""
    called: dict = {}

    async def _fake(task_ids=None, kind=None, user_uuid=None):
        called.update(task_ids=task_ids, kind=kind)
        return {"requested": 2, "cancelled": 2, "remote_failed": []}

    monkeypatch.setattr("app.routers.media_tasks.cancel_media_tasks", _fake)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/cancel",
            json={"task_ids": ["t-v1", "t-m1"], "kind": "video"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["cancelled"] == 2
    assert called.get("task_ids") == ["t-v1", "t-m1"]
    assert called.get("kind") == "video"


async def test_rest_media_tasks_cancel_batch_empty(monkeypatch):
    """REST 批量取消:无 body → task_ids/kind 均 None(取消全部在途)。"""
    called: dict = {}

    async def _fake(task_ids=None, kind=None, user_uuid=None):
        called.update(task_ids=task_ids, kind=kind)
        return {"requested": 0, "cancelled": 0, "remote_failed": []}

    monkeypatch.setattr("app.routers.media_tasks.cancel_media_tasks", _fake)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/cancel")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert called.get("task_ids") is None
    assert called.get("kind") is None


async def test_rest_media_tasks_callback_fail_closed(monkeypatch):
    """REST 回调端点:密钥未配置时 fail-closed 503,不再跳过验签继续处理(2026-09-09 P0)。"""
    monkeypatch.delenv("TOKEN6688_CALLBACK_SECRET", raising=False)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/media/tasks/callback",
            json={"task_id": "t1", "state": "success"},
        )
    assert resp.status_code == 503
