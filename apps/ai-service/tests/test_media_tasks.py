# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""媒体任务统一持久化 + REST 管理(供应商下线后的本地口径,2026-11-26)。

覆盖:
- media_tasks 服务层:persist/query/get/update(DB 异常不抛)
- call_tool 出口落库挂接(媒体工具落库、非媒体工具跳过)
- REST:列表/详情/取消/清理/统计;上传、回调、音乐生成入口明确不可用
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import media_tasks as mt_router
from app.services import mcp_server
from app.services import media_tasks as mt

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
            {"ok": True, "task_id": "t-music-1", "provider": "agnes", "audio_url": None},
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
            {"ok": True, "task_id": "t-v", "provider": "agnes", "video_url": "https://x/v.mp4"},
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


async def test_persist_ownerless_row_is_loudly_warned(caplog):
    """G-754②:无主体通道铸出的空属主行必须**喊出来**,但本步不改行为。

    读侧闸门原先把 `user_uuid=''` 的行对任何登录用户放开,其注释称这是"历史行为";而只要还有
    一条不带主体的通道在跑工具,这类行就在持续新增 —— 那行注释的前提已不成立。这里钉的是
    "从此不静默":有告警、仍照常落库、返回值不变。
    (G-754① 同日已把**读侧**收紧成"空属主仅 admin 可达",见
     `test_rest_media_task_ownerless_row_non_admin_closed_on_all_three_doors`;
     本例钉的是**写侧**仍照常落库并喊出 —— 铸行方拿不到主体属通道问题,归 G-753。)
    """
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 7}])
    with caplog.at_level("WARNING"), patch(
        "app.services.media_tasks.get_db_conn", return_value=mock_conn
    ):
        ok = await mt.persist_media_task(
            "music_generation",
            {"ok": True, "task_id": "t-anon-1", "provider": "agnes"},
            user_uuid="",
        )
    assert ok is True, "本步刻意不改行为:仍照常落库"
    joined = "\n".join(r.getMessage() for r in caplog.records)
    assert "无属主媒体任务行" in joined
    assert "t-anon-1" in joined


async def test_persist_with_owner_does_not_warn(caplog):
    """反向对照:告警不是"每次都喊" —— 带主体时这条线必须安静。

    缺了这一条,上一例等于"日志里永远出现该串",什么也没排除(本仓最高频的
    "把没判写成判过了"同型)。
    """
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 8}])
    with caplog.at_level("WARNING"), patch(
        "app.services.media_tasks.get_db_conn", return_value=mock_conn
    ):
        ok = await mt.persist_media_task(
            "music_generation",
            {"ok": True, "task_id": "t-owned-1", "provider": "agnes"},
            user_uuid="real-user",
        )
    assert ok is True
    assert "无属主媒体任务行" not in "\n".join(r.getMessage() for r in caplog.records)


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


async def test_rest_media_task_cancel_terminal_409(monkeypatch):
    """取消守卫(2026-09-09 收尾):已终态任务 → 409,不翻转状态、不调取消。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-done", "provider": "agnes", "status": "succeeded"}),
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
        AsyncMock(return_value={"task_id": "t-p", "provider": "agnes", "status": "pending"}),
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


async def test_owner_allows_unknown_owner_is_not_public():
    """G-754① 判据本身的语义钉死:空属主 = 属主**未知** ⇒ 非 admin 不可达、admin 可达。

    不调任何 I/O,只把"禁止把空属主读成'人人可见'"写成可判事实。带正向对照
    (自己的行必须放行、admin 必须可达)—— 只测收紧的那一侧,等于没测收紧的边界。
    """
    assert mt_router._owner_allows("", ("u-plain", False)) is False
    assert mt_router._owner_allows("someone-else", ("u-plain", False)) is False
    assert mt_router._owner_allows("u-plain", ("u-plain", False)) is True
    assert mt_router._owner_allows("", ("u-admin", True)) is True


async def test_rest_media_task_ownerless_row_non_admin_closed_on_all_three_doors(monkeypatch):
    """G-754①:按 task_id 直取的三侧门(详情/取消/删除)对空属主行一律 404,且**未发出后续查询**。

    只断状态码会放过"先改了再抛 404":这里除"必须读一次才知道属主"那次取行
    (`get_media_task`),任何写/删出口都不得被 awaited。
    """
    get = AsyncMock(return_value={
        "task_id": "t-orphan", "user_uuid": "", "status": "processing", "provider": "agnes",
    })
    upd = AsyncMock(return_value=True)
    dele = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.get_media_task", get)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    monkeypatch.setattr("app.routers.media_tasks.delete_media_task", dele)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        detail = await ac.get("/api/media/tasks/t-orphan")
        cancel = await ac.post("/api/media/tasks/t-orphan/cancel")
        delete = await ac.delete("/api/media/tasks/t-orphan")
    assert (detail.status_code, cancel.status_code, delete.status_code) == (404, 404, 404)
    assert "data" not in detail.json(), "详情不得把无主行内容回给非 admin"
    upd.assert_not_awaited()
    dele.assert_not_awaited()


async def test_rest_media_task_ownerless_gate_fires_before_terminal_409(monkeypatch):
    """归属闸排在状态闸之前:已终态的无主行也回 404,而不是带 status=… 的 409。

    409 的文案等于告诉调用者"这条 id 是真的"—— 存在性 oracle,与本仓"越权与不存在
    同码同形"那条口径同源(见 AGENTS §5"认证不等于授权")。
    """
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-orphan2", "user_uuid": "", "status": "succeeded"}),
    )
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-orphan2/cancel")
    assert resp.status_code == 404


async def test_rest_media_task_ownerless_row_still_reachable_by_admin(monkeypatch):
    """影响面·正向对照①:收紧的是"任意登录用户",不是将数据销毁。

    admin 仍可读/可删无主历史行 —— 否则本例只是在证明"门把功能改坏了"。
    **行为变更如实登记**:非 admin 此前按 task_id 能读到并取消/删除这类行,现一律 404;
    对普通用户的表现从"任务中心列表里本来就看不见(list/stats 等值过滤)但知道 id 就能开"
    变成"哪儿都打不开",不再有"侧门比正门宽"这种自相矛盾。
    """
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-orphan3", "user_uuid": "", "status": "succeeded"}),
    )
    monkeypatch.setattr("app.routers.media_tasks.delete_media_task", AsyncMock(return_value=True))
    app = _make_app()  # 默认 admin
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        detail = await ac.get("/api/media/tasks/t-orphan3")
        delete = await ac.delete("/api/media/tasks/t-orphan3")
    assert detail.status_code == 200
    assert detail.json()["data"]["task_id"] == "t-orphan3"
    assert delete.status_code == 200


async def test_rest_media_task_own_row_unchanged_after_narrowing(monkeypatch):
    """影响面·正向对照②:自己的行照旧(详情 200 + 取消真的置 cancelled)。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={
            "task_id": "t-mine", "user_uuid": "u-plain", "status": "processing", "provider": "other",
        }),
    )
    upd = AsyncMock(return_value=True)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        detail = await ac.get("/api/media/tasks/t-mine")
        cancel = await ac.post("/api/media/tasks/t-mine/cancel")
    assert detail.status_code == 200
    assert cancel.status_code == 200
    upd.assert_awaited()


async def test_list_and_stats_scope_params_still_exclude_ownerless_rows(monkeypatch):
    """没有第二道门:非 admin 的 list/stats 走**等值过滤**,空属主行结构上取不到。

    这一例钉"本次只关了三侧门,没把 list/stats 改成另一种语义"—— 等值参数若被改成
    含空属主,G-754 的收紧就从三条路由退回整端。
    """
    q = AsyncMock(return_value={"items": [], "total": 0})
    st = AsyncMock(return_value={"by_kind": {}, "total": 0})
    monkeypatch.setattr("app.routers.media_tasks.query_media_tasks", q)
    monkeypatch.setattr("app.routers.media_tasks.media_task_stats", st)
    app = _make_app(scope=("u-plain", False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        assert (await ac.get("/api/media/tasks")).status_code == 200
        assert (await ac.get("/api/media/tasks/stats")).status_code == 200
    assert q.await_args.kwargs.get("user_uuid") == "u-plain"
    assert st.await_args.kwargs.get("user_uuid") == "u-plain"


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


async def test_rest_media_upload_unavailable():
    """上传:供应商已下线,无论参数与否统一 503。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/upload")
    assert resp.status_code == 503
    assert "下线" in resp.json()["detail"]


async def test_rest_media_callback_route_removed():
    """回调路由已删除 → 404,不再接受上游回调。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/callback", json={"task_id": "t-v1"})
    assert resp.status_code in (404, 405)


async def test_music_generation_unavailable():
    out = await mcp_server._tool_music_generation({"prompt": "测试", "mode": "song"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_UNAVAILABLE"


# ---------------------------------------------------------------------------
# MCP 上传工具
# ---------------------------------------------------------------------------


async def test_poll_no_inflight_rows():
    """无在途行 → 返回 0。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        n = await mt._poll_processing_batch()
    assert n == 0


async def test_poll_with_inflight_rows_is_noop():
    """厂商轮询入口已下线:有在途行也只返回 0,不再向上游探测。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"task_id": "t-v1", "provider": "agnes"}])
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        n = await mt._poll_processing_batch()
    assert n == 0


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


async def test_update_media_task_only_if_in_flight_sql():
    """条件更新:SQL 带 AND status=ANY 守卫,task_id 与状态集合参数序正确。"""
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value={"id": 1})
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.update_media_task(
            "t-1", status="succeeded", result={"video_url": "u"}, only_if_in_flight=True,
        )
    assert ok is True
    sql, *params = mock_conn.fetchrow.call_args.args
    assert "AND status = ANY($4)" in sql
    # $1/$2=status/result,$3=task_id,$4=在途状态集合
    assert params[0] == "succeeded"
    assert params[2] == "t-1"
    assert params[3] == ["processing", "accepted", "submitted", "pending"]


async def test_update_media_task_only_if_in_flight_miss():
    """条件更新未命中(已终态/已取消)→ False,不抛。"""
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.update_media_task("t-done", status="failed", only_if_in_flight=True)
    assert ok is False


async def test_rest_media_task_cancel_race_409(monkeypatch):
    """取消竞态窗口:预检在途 → 写入前被并发落终态(条件更新未命中)→ 409。"""
    monkeypatch.setattr(
        "app.routers.media_tasks.get_media_task",
        AsyncMock(return_value={"task_id": "t-r", "provider": "agnes", "status": "processing"}),
    )
    upd = AsyncMock(return_value=False)
    monkeypatch.setattr("app.routers.media_tasks.update_media_task", upd)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/media/tasks/t-r/cancel")
    assert resp.status_code == 409
    assert "并发收尾" in resp.json()["detail"]
    args, kwargs = upd.call_args
    assert kwargs.get("only_if_in_flight") is True


async def test_persist_duplicate_update_guarded():
    """重复持久化冲突分支:UPDATE 带在途守卫,已终态任务不被回退重开。"""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])  # 插入未命中 → 走 UPDATE 分支
    with patch("app.services.media_tasks.get_db_conn", return_value=mock_conn):
        ok = await mt.persist_media_task(
            "video_generation",
            {"ok": True, "task_id": "t-dup", "video_url": "https://x/v.mp4"},
        )
    assert ok is True
    sql, *params = mock_conn.execute.call_args.args
    assert "AND status = ANY($6)" in sql
    assert params[4] == "t-dup"
    assert params[5] == ["processing", "accepted", "submitted", "pending"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
