# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Checkpoint / Rewind 撤销能力测试。

覆盖:
- 服务层(AgentCheckpointManager):list_for_session / restore / save-roundtrip
- restore 到旧 checkpoint 后消息历史正确
- 无效 checkpoint(不存在/跨会话)报错
- save_checkpoint 可记录文件版本引用(file_snapshots)
- file_editor 文件快照 + 回滚(含版本限量)
- HTTP 路由:GET /api/checkpoints + POST /api/checkpoints/{id}/restore(404/400/200)
- restore 后会话运行时消息同步 + 文件回滚联动

测试用内存模式(redis_url=None),不依赖外部 Redis。
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import agent_runtime, checkpoint_rewind
from app.services import file_editor
from app.services.agent_checkpoint import (
    AgentCheckpointManager,
    CheckpointNotFoundError,
    CheckpointSessionMismatchError,
)

# =============================================================================
# 辅助
# =============================================================================


def _make_manager(**kwargs) -> AgentCheckpointManager:
    kwargs.setdefault("redis_url", None)
    return AgentCheckpointManager(**kwargs)


def _messages_v1() -> list[dict]:
    return [
        {"role": "system", "content": "sys", "timestamp": 1.0},
        {"role": "user", "content": "v1 question", "timestamp": 2.0},
    ]


def _messages_v2() -> list[dict]:
    return [
        {"role": "system", "content": "sys", "timestamp": 1.0},
        {"role": "user", "content": "v1 question", "timestamp": 2.0},
        {"role": "assistant", "content": "v2 answer", "timestamp": 3.0},
    ]


def _make_checkpoint_app() -> FastAPI:
    """独立 ASGI app(仅挂载 checkpoint_rewind 路由),避免改动 main.py。"""
    app = FastAPI()
    app.include_router(checkpoint_rewind.router, prefix="/api")
    return app


@pytest.fixture
async def ckpt_client(monkeypatch):
    """HTTP 客户端 + 注入固定身份与可控 manager(async generator fixture)。

    返回 dict:{"mgr": AgentCheckpointManager, "client": AsyncClient}。
    注意:pytest-asyncio 会在测试前先物化本 fixture,返回的即该 dict,
    测试里直接 `env = ckpt_client` 使用即可。
    """
    mgr = _make_manager()
    app = _make_checkpoint_app()
    # 注入身份(规避 JWT 中间件在测试环境未设置 request.state.user_id)
    monkeypatch.setattr(
        checkpoint_rewind, "_current_user", lambda request: ("test-user-001", False)
    )
    # 让路由使用测试自有的内存 manager
    monkeypatch.setattr(
        checkpoint_rewind, "get_agent_checkpoint_manager", lambda: mgr
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield {"mgr": mgr, "client": ac}


@pytest.fixture(autouse=True)
def _reset_state():
    agent_runtime._sessions.clear()
    file_editor._reset_file_version_store()
    yield
    agent_runtime._sessions.clear()
    file_editor._reset_file_version_store()


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """把 file_editor 工作区白名单指向临时目录。"""
    monkeypatch.setattr(file_editor, "_WORKSPACE_ROOTS", [str(tmp_path)])
    return tmp_path


# =============================================================================
# 服务层:list_for_session / restore / save-roundtrip
# =============================================================================


async def test_list_for_session_returns_meta():
    mgr = _make_manager()
    await mgr.save_checkpoint("s1", 1, _messages_v1(), {"tool": "a"}, "running")
    await mgr.save_checkpoint("s1", 2, _messages_v2(), {"tool": "b"}, "completed")
    await mgr.save_checkpoint("s2", 1, _messages_v1(), {}, "running")

    metas = await mgr.list_for_session("s1")
    assert len(metas) == 2
    assert [m.iteration for m in metas] == [1, 2]  # created_at 升序
    assert all(m.session_id == "s1" for m in metas)
    assert metas[1].message_count == len(_messages_v2())
    # s2 不影响 s1
    assert len(await mgr.list_for_session("s2")) == 1
    assert await mgr.list_for_session("no_such_session") == []


async def test_restore_roundtrip():
    mgr = _make_manager()
    cid = await mgr.save_checkpoint(
        "s1", 3, _messages_v2(), {"counter": 7}, "paused", metadata={"model": "m1"}
    )
    restored = await mgr.restore("s1", cid)
    assert restored["checkpoint_id"] == cid
    assert restored["session_id"] == "s1"
    assert restored["iteration"] == 3
    assert restored["status"] == "paused"
    assert restored["restored_message_count"] == len(_messages_v2())
    assert restored["messages"] == _messages_v2()
    assert restored["tool_state"] == {"counter": 7}
    assert restored["metadata"]["model"] == "m1"


async def test_restore_to_old_checkpoint_messages_correct():
    """恢复到旧 checkpoint 后消息历史为该 checkpoint 的快照。"""
    mgr = _make_manager()
    cid1 = await mgr.save_checkpoint("s1", 1, _messages_v1(), {"step": 1}, "running")
    await mgr.save_checkpoint("s1", 2, _messages_v2(), {"step": 2}, "running")

    restored = await mgr.restore("s1", cid1)
    assert restored["iteration"] == 1
    assert restored["restored_message_count"] == len(_messages_v1())
    assert restored["messages"] == _messages_v1()  # 回到 v1 历史
    assert restored["tool_state"] == {"step": 1}
    # 原始 checkpoint 未被破坏(深拷贝)
    cp = await mgr.load_checkpoint(cid1)
    assert cp is not None
    assert len(cp.messages) == len(_messages_v1())


async def test_restore_deep_copied_does_not_pollute():
    mgr = _make_manager()
    cid = await mgr.save_checkpoint("s1", 1, _messages_v1(), {}, "running")
    restored = await mgr.restore("s1", cid)
    restored["messages"].append({"role": "user", "content": "extra"})
    restored["messages"][0]["content"] = "hacked"
    # 再次恢复仍是干净快照
    restored2 = await mgr.restore("s1", cid)
    assert len(restored2["messages"]) == len(_messages_v1())
    assert restored2["messages"][0]["content"] == "sys"


# =============================================================================
# 服务层:无效 checkpoint 报错
# =============================================================================


async def test_restore_nonexistent_raises():
    mgr = _make_manager()
    with pytest.raises(CheckpointNotFoundError):
        await mgr.restore("s1", "nonexistent_id")


async def test_restore_cross_session_raises():
    mgr = _make_manager()
    cid = await mgr.save_checkpoint("s1", 1, _messages_v1(), {}, "running")
    with pytest.raises(CheckpointSessionMismatchError):
        await mgr.restore("s2", cid)


# =============================================================================
# 服务层:save_checkpoint 记录文件版本引用
# =============================================================================


async def test_save_checkpoint_records_file_snapshots():
    mgr = _make_manager()
    snap = [
        {"path": "/ws/a.py", "version_id": "v1"},
        {"path": "/ws/b.py", "version_id": "v2"},
    ]
    cid = await mgr.save_checkpoint(
        "s1", 1, _messages_v1(), {}, "running", file_snapshots=snap
    )
    restored = await mgr.restore("s1", cid)
    file_versions = restored["file_versions"]
    assert len(file_versions) == 2
    # 自动补齐 session_id 与 checkpoint_id
    for fv in file_versions:
        assert fv["session_id"] == "s1"
        assert fv["checkpoint_id"] == cid


async def test_save_checkpoint_without_file_snapshots():
    mgr = _make_manager()
    cid = await mgr.save_checkpoint("s1", 1, _messages_v1(), {}, "running")
    restored = await mgr.restore("s1", cid)
    assert restored["file_versions"] == []


# =============================================================================
# file_editor:文件快照 + 回滚
# =============================================================================


def test_file_snapshot_and_rollback(workspace):
    target = workspace / "demo.txt"
    target.write_text("line1\nline2\n", encoding="utf-8")
    session_id = "sess1"
    file_editor.snapshot_file(session_id, str(target))
    # 模拟编辑
    target.write_text("line1\nEDITED\n", encoding="utf-8")
    assert target.read_text(encoding="utf-8") == "line1\nEDITED\n"
    # 按 version_id 回滚到快照
    versions = file_editor.list_file_versions(session_id, str(target))
    assert len(versions) == 1
    result = file_editor.rollback_file(
        session_id, str(target), version_id=versions[0]["version_id"]
    )
    assert result["ok"] is True
    assert target.read_text(encoding="utf-8") == "line1\nline2\n"


def test_file_rollback_by_checkpoint_id(workspace):
    target = workspace / "a.py"
    target.write_text("v0", encoding="utf-8")
    file_editor.snapshot_file("sessX", str(target), checkpoint_id="ckpt-100")
    target.write_text("v1", encoding="utf-8")
    result = file_editor.rollback_file("sessX", str(target), checkpoint_id="ckpt-100")
    assert result["ok"] is True
    assert target.read_text(encoding="utf-8") == "v0"


def test_file_version_quota_keeps_last_20(workspace):
    target = workspace / "quota.txt"
    for i in range(25):
        target.write_text(f"content-{i}", encoding="utf-8")
        file_editor.snapshot_file("q1", str(target))
    versions = file_editor.list_file_versions("q1", str(target))
    assert len(versions) == 20  # 只保留最近 20 个
    # content 升序,最早的 5 个被丢弃 → 版本1 是 content-5
    r = file_editor.rollback_file("q1", str(target), version_id=versions[0]["version_id"])
    assert r["ok"] is True
    assert target.read_text(encoding="utf-8") == "content-5"


def test_file_rollback_no_versions(workspace):
    target = workspace / "novers.txt"
    target.write_text("x", encoding="utf-8")
    r = file_editor.rollback_file("sessN", str(target), version_id="v-absent")
    assert r["ok"] is False
    assert r["errorCode"] == "NO_FILE_VERSIONS"


def test_file_rollback_no_selector(workspace):
    target = workspace / "nosel.txt"
    target.write_text("x", encoding="utf-8")
    file_editor.snapshot_file("sessN", str(target))
    r = file_editor.rollback_file("sessN", str(target))
    assert r["ok"] is False
    assert r["errorCode"] == "VERSION_SELECTOR_REQUIRED"


def test_file_rollback_cross_session_isolated(workspace):
    target = workspace / "iso.txt"
    target.write_text("A-own", encoding="utf-8")
    file_editor.snapshot_file("userA", str(target))
    # 其他 session 无该文件版本
    r = file_editor.rollback_file("userB", str(target), version_id="x")
    assert r["errorCode"] == "NO_FILE_VERSIONS"


# =============================================================================
# 服务层:restore + file_editor 联动(供路由文件回滚)
# =============================================================================


async def test_restore_with_file_rollback(workspace):
    target = workspace / "linked.py"
    target.write_text("class A:\n    pass\n", encoding="utf-8")
    snap = file_editor.snapshot_file("sessLink", str(target))
    # 模拟编辑文件
    target.write_text("class A:\n    def broke(self): ...\n", encoding="utf-8")

    mgr = _make_manager()
    cid = await mgr.save_checkpoint(
        "sessLink",
        1,
        _messages_v1(),
        {},
        "running",
        file_snapshots=[{"path": str(target), "version_id": snap["version_id"]}],
    )
    restored = await mgr.restore("sessLink", cid)
    assert len(restored["file_versions"]) == 1
    # 按版本引用执行文件回滚
    changes = _rollback_files_for_test("sessLink", restored["file_versions"])
    assert changes == 1
    assert target.read_text(encoding="utf-8") == "class A:\n    pass\n"


def _rollback_files_for_test(session_id, file_versions):
    changes = 0
    for fv in file_versions:
        r = file_editor.rollback_file(
            session_id, fv["path"], version_id=fv["version_id"]
        )
        if r.get("ok"):
            changes += 1
    return changes


# =============================================================================
# HTTP 路由
# =============================================================================


async def test_http_list_checkpoints(ckpt_client):
    env = ckpt_client
    mgr = env["mgr"]
    ac = env["client"]
    await mgr.save_checkpoint("sess-http", 1, _messages_v1(), {}, "running")
    await mgr.save_checkpoint("sess-http", 2, _messages_v2(), {}, "completed")
    resp = await ac.get("/api/checkpoints", params={"session_id": "sess-http"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert [c["iteration"] for c in data["checkpoints"]] == [1, 2]
    assert "messages" not in data["checkpoints"][0]  # 不全量返回消息


async def test_http_restore_ok(ckpt_client):
    env = ckpt_client
    mgr = env["mgr"]
    ac = env["client"]
    cid1 = await mgr.save_checkpoint("sess-http", 1, _messages_v1(), {}, "running")
    await mgr.save_checkpoint("sess-http", 2, _messages_v2(), {}, "completed")
    resp = await ac.post(
        f"/api/checkpoints/{cid1}/restore",
        json={"sessionId": "sess-http", "rollbackFiles": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["restored_message_count"] == len(_messages_v1())
    assert data["iteration"] == 1
    assert data["file_changes"] == 0


async def test_http_restore_not_found_404(ckpt_client):
    env = ckpt_client
    ac = env["client"]
    resp = await ac.post(
        "/api/checkpoints/does-not-exist/restore",
        json={"sessionId": "sess-http"},
    )
    assert resp.status_code == 404


async def test_http_restore_cross_session_400(ckpt_client):
    env = ckpt_client
    mgr = env["mgr"]
    ac = env["client"]
    cid = await mgr.save_checkpoint("other-sess", 1, _messages_v1(), {}, "running")
    resp = await ac.post(
        f"/api/checkpoints/{cid}/restore",
        json={"sessionId": "sess-http"},
    )
    assert resp.status_code == 400


async def test_http_restore_missing_session_422(ckpt_client):
    env = ckpt_client
    ac = env["client"]
    resp = await ac.post("/api/checkpoints/whatever/restore", json={})
    assert resp.status_code == 422


async def test_http_restore_syncs_session_messages(ckpt_client):
    """restore 后 agent_runtime 会话的消息历史被同步为恢复后的历史。"""
    env = ckpt_client
    mgr = env["mgr"]
    ac = env["client"]
    cid1 = await mgr.save_checkpoint("sync-sess", 1, _messages_v1(), {}, "running")
    await mgr.save_checkpoint("sync-sess", 2, _messages_v2(), {}, "completed")
    # 先构造 agent_runtime 会话(模拟执行后已有 v2 历史)
    agent_runtime._sessions["sync-sess"] = agent_runtime.SessionState(
        id="sync-sess",
        status="completed",
        user_id="test-user-001",
        messages=[
            agent_runtime.SessionMessage(role=m["role"], content=m["content"])
            for m in _messages_v2()
        ],
    )
    resp = await ac.post(
        f"/api/checkpoints/{cid1}/restore",
        json={"sessionId": "sync-sess"},
    )
    assert resp.status_code == 200
    # 会话历史回退到 v1
    sess = agent_runtime._sessions["sync-sess"]
    assert len(sess.messages) == len(_messages_v1())


async def test_http_restore_with_file_rollback(ckpt_client, workspace):
    env = ckpt_client
    mgr = env["mgr"]
    ac = env["client"]
    target = workspace / "web.txt"
    target.write_text("old-line", encoding="utf-8")
    snap = file_editor.snapshot_file("file-sess", str(target))
    target.write_text("new-line-edited", encoding="utf-8")
    cid = await mgr.save_checkpoint(
        "file-sess",
        1,
        _messages_v1(),
        {},
        "running",
        file_snapshots=[{"path": str(target), "version_id": snap["version_id"]}],
    )
    resp = await ac.post(
        f"/api/checkpoints/{cid}/restore",
        json={"sessionId": "file-sess", "rollbackFiles": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["file_changes"] == 1
    assert target.read_text(encoding="utf-8") == "old-line"

    # rollbackFiles=false → 文件不改
    target.write_text("changed-again", encoding="utf-8")
    resp2 = await ac.post(
        f"/api/checkpoints/{cid}/restore",
        json={"sessionId": "file-sess", "rollbackFiles": False},
    )
    assert resp2.json()["file_changes"] == 0
    assert target.read_text(encoding="utf-8") == "changed-again"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
