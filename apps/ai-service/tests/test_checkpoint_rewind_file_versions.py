# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件历史预览接线取证(2026-11-02 立)。

`file_editor.list_file_versions` 自落地起零调用方:写入腿 `_FILE_VERSION_STORE`
(snapshot_file / rollback_file)一直在产,用户看得见"能回滚",却看不见"这个文件
有几个版本可回滚"。本票把它接到 `routers/checkpoint_rewind.py` 的 GET 读出口。

钉住四件事:
① 接上后确实被调到(间谍断言路由真的经 `file_editor.list_file_versions`,不在端点里
   另抄一份遍历 `_FILE_VERSION_STORE` 的判据);
② 返回的是版本清单(元数据,不含文件内容);
③ 越权:属主 A 取不到属主 B 会话的文件版本,且**没有副作用**(版本存储逐条不变、
   磁盘字节不变),正向对照(本人取得到)同批留证;
④ 只读:GET 前后版本存储与磁盘完全一致。

隔离:纯内存(不连 Redis/PG),agent_runtime 会话表逐例清空。
"""

from __future__ import annotations

import copy
import os
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import agent_runtime, checkpoint_rewind
from app.services import file_editor

# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _file_editor_memory_mode(monkeypatch):
    """强制 file_editor 走纯内存模式(本文件契约:不依赖外部 Redis)。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setattr(file_editor, "_redis_available", False)
    monkeypatch.setattr(file_editor, "_redis_client_instance", None)
    yield
    file_editor._redis_available = None
    file_editor._redis_client_instance = None


@pytest.fixture(autouse=True)
def _reset_state():
    agent_runtime._sessions.clear()
    file_editor._reset_file_version_store()
    yield
    agent_runtime._sessions.clear()
    file_editor._reset_file_version_store()


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(file_editor, "_workspace_roots", lambda: [str(tmp_path)])
    return tmp_path


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(checkpoint_rewind.router, prefix="/api")
    return app


def _seed_session(session_id: str, owner: str) -> None:
    """在 agent_runtime 会话表里落一条带属主的会话(归属校验的输入)。"""
    agent_runtime._sessions[session_id] = agent_runtime.SessionState(
        id=session_id, status="completed", user_id=owner
    )


def _make_client(identity: tuple[str, bool], monkeypatch: pytest.MonkeyPatch) -> AsyncClient:
    """按给定身份 (user_id, is_admin) 起一个只挂 checkpoint_rewind 路由的 ASGI 客户端。

    身份注入沿用 tests/test_checkpoint_rewind.py 的既有做法(monkeypatch `_current_user`),
    端点侧取主体仍走它自己的 `get_current_user_id_sync` → `_authorize_session` 那一条出口,
    本文件不在路由里另加第二套判定。
    """
    monkeypatch.setattr(checkpoint_rewind, "_current_user", lambda request: identity)
    return AsyncClient(transport=ASGITransport(app=_make_app()), base_url="http://test")


# =============================================================================
# ①② 读出口接上真值
# =============================================================================


async def test_get_file_versions_returns_version_list(
    workspace, monkeypatch: pytest.MonkeyPatch
):
    target = workspace / "notes.txt"
    target.write_text("v1", encoding="utf-8")
    first = file_editor.snapshot_file("sess-a", str(target), checkpoint_id="ck1")
    target.write_text("v2", encoding="utf-8")
    second = file_editor.snapshot_file("sess-a", str(target))

    async with _make_client(("user-a", False), monkeypatch) as ac:
        resp = await ac.get(
            "/api/checkpoints/file-versions",
            params={"session_id": "sess-a", "path": str(target)},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["session_id"] == "sess-a"
    assert body["total"] == 2
    ids = [v["version_id"] for v in body["versions"]]
    assert ids == [first["version_id"], second["version_id"]]
    # 元数据清单,绝不把文件内容随列表一起发出去
    assert all("content" not in v for v in body["versions"])
    assert body["versions"][0]["checkpoint_id"] == "ck1"
    assert {v["path"] for v in body["versions"]} == {os.path.abspath(str(target))}


async def test_route_calls_the_service_outlet_once(
    workspace, monkeypatch: pytest.MonkeyPatch
):
    """① 接线证据:路由真的经 file_editor.list_file_versions 取数,不另抄判据。"""
    seen: list[tuple[str, str]] = []
    real = file_editor.list_file_versions

    def spy(session_id: str, file_path: str) -> list[dict[str, Any]]:
        seen.append((session_id, file_path))
        return real(session_id, file_path)

    monkeypatch.setattr(file_editor, "list_file_versions", spy)
    target = workspace / "x.txt"
    target.write_text("hello", encoding="utf-8")
    file_editor.snapshot_file("sess-spy", str(target))

    async with _make_client(("user-a", False), monkeypatch) as ac:
        resp = await ac.get(
            "/api/checkpoints/file-versions",
            params={"session_id": "sess-spy", "path": str(target)},
        )
    assert resp.status_code == 200, resp.text
    assert seen == [("sess-spy", str(target))], "必须且只问一次,入参就是会话+路径"


# =============================================================================
# ③ 越权:A 取不到 B 的文件版本,且无副作用
# =============================================================================


async def test_cross_owner_denied_and_side_effect_free(
    workspace, monkeypatch: pytest.MonkeyPatch
):
    target = workspace / "private.txt"
    target.write_text("secret-body", encoding="utf-8")
    file_editor.snapshot_file("sess-b", str(target))
    _seed_session("sess-b", "user-b")
    _seed_session("sess-a", "user-a")

    store_before = copy.deepcopy(dict(file_editor._FILE_VERSION_STORE))
    bytes_before = target.read_bytes()
    mtime_before = target.stat().st_mtime_ns

    async with _make_client(("user-a", False), monkeypatch) as ac:
        denied = await ac.get(
            "/api/checkpoints/file-versions",
            params={"session_id": "sess-b", "path": str(target)},
        )
        # 同一身份查自己的会话(正向对照:不是"全都取不到"造成的假绿)
        own = await ac.get(
            "/api/checkpoints/file-versions",
            params={"session_id": "sess-a", "path": str(target)},
        )

    assert denied.status_code == 403, denied.text
    assert "versions" not in denied.json(), "被拒的回答里不得带任何版本清单"
    assert own.status_code == 200
    assert own.json()["total"] == 0, "A 自己会话下没有版本(而不是把 B 的漏给他)"

    # 无副作用:版本存储逐条不变、磁盘字节与 mtime 不变、没多出新的 key
    assert dict(file_editor._FILE_VERSION_STORE) == store_before
    assert set(file_editor._FILE_VERSION_STORE) == set(store_before)
    assert target.read_bytes() == bytes_before
    assert target.stat().st_mtime_ns == mtime_before


async def test_admin_may_read_others_session(workspace, monkeypatch: pytest.MonkeyPatch):
    """管理员档与 _authorize_session 既有语义一致(不为消红另开一套判定)。"""
    target = workspace / "adm.txt"
    target.write_text("body", encoding="utf-8")
    file_editor.snapshot_file("sess-b", str(target))
    _seed_session("sess-b", "user-b")

    async with _make_client(("user-admin", True), monkeypatch) as ac:
        resp = await ac.get(
            "/api/checkpoints/file-versions",
            params={"session_id": "sess-b", "path": str(target)},
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1


# =============================================================================
# ④ 只读:GET 不改任何状态(可重复跑,两次同结果)
# =============================================================================


async def test_get_is_read_only_and_repeatable(
    workspace, monkeypatch: pytest.MonkeyPatch
):
    target = workspace / "ro.txt"
    target.write_text("one", encoding="utf-8")
    file_editor.snapshot_file("sess-ro", str(target))
    snapshot_before = copy.deepcopy(dict(file_editor._FILE_VERSION_STORE))

    async with _make_client(("user-a", False), monkeypatch) as ac:
        url = "/api/checkpoints/file-versions"
        params = {"session_id": "sess-ro", "path": str(target)}
        first = await ac.get(url, params=params)
        second = await ac.get(url, params=params)

    assert first.status_code == 200 and second.status_code == 200
    assert first.json() == second.json(), "同一请求两次必须同结果"
    assert dict(file_editor._FILE_VERSION_STORE) == snapshot_before
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
