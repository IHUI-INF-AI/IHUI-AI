# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱生命周期：暂停、文件系统快照、克隆、原地回滚、密钥不进执行环境。

不连生产库。执行器用注入替身，不派生子进程。
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import sandbox_lifecycle as lifecycle_router
from app.services.sandbox import SandboxResult
from app.services.sandbox_lifecycle import (
    SESSION_ACTIONS,
    SandboxLifecycleError,
    SandboxLifecycleStore,
    default_state_root,
    dispatch_sandbox_session,
    set_store,
)


def _store(tmp_path: Path) -> SandboxLifecycleStore:
    return SandboxLifecycleStore(tmp_path / "state")


def test_snapshot_rollback_keeps_sandbox_id_and_restores_files(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = store.create(files={"note.txt": "v1"})
    snap = store.snapshot(created.sandbox_id)
    store.write_file(created.sandbox_id, "note.txt", "v2")
    restored = store.rollback(created.sandbox_id, snap.snapshot_id)
    assert restored.sandbox_id == created.sandbox_id
    assert restored.state == "running"
    assert store.read_file(created.sandbox_id, "note.txt") == "v1"


def test_delete_snapshot_does_not_touch_workspace_or_sibling(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = store.create(files={"note.txt": "v1"})
    first = store.snapshot(created.sandbox_id)
    store.write_file(created.sandbox_id, "note.txt", "v2")
    second = store.snapshot(created.sandbox_id)
    store.delete_snapshot(first.snapshot_id)
    assert store.read_file(created.sandbox_id, "note.txt") == "v2"
    store.rollback(created.sandbox_id, second.snapshot_id)
    assert store.read_file(created.sandbox_id, "note.txt") == "v2"


def test_clone_is_isolated_and_all_or_nothing(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = store.create(files={"note.txt": "v1"})
    clones = store.clone(created.sandbox_id, 2)
    assert len(clones) == 2
    assert {item.sandbox_id for item in clones}.isdisjoint({created.sandbox_id})
    assert all(item.parent_id == created.sandbox_id for item in clones)
    store.write_file(created.sandbox_id, "note.txt", "v2")
    for item in clones:
        assert store.read_file(item.sandbox_id, "note.txt") == "v1"

    calls = {"n": 0}
    real_copy = store._copy_tree

    def fail_second(src: Path, dest: Path) -> None:
        calls["n"] += 1
        if calls["n"] == 2:
            raise OSError("disk full")
        real_copy(src, dest)

    store._copy_tree = fail_second  # type: ignore[method-assign]
    before = set(store._sandboxes)
    with pytest.raises(SandboxLifecycleError) as failed:
        store.clone(created.sandbox_id, 2)
    assert failed.value.code == "clone_failed"
    assert set(store._sandboxes) == before


def test_cannot_rollback_another_sandboxes_snapshot(tmp_path: Path) -> None:
    store = _store(tmp_path)
    first = store.create(files={"note.txt": "a"})
    second = store.create(files={"note.txt": "b"})
    snap = store.snapshot(first.sandbox_id)
    with pytest.raises(SandboxLifecycleError) as caught:
        store.rollback(second.sandbox_id, snap.snapshot_id)
    assert caught.value.code == "snapshot_wrong_sandbox"
    assert store.read_file(second.sandbox_id, "note.txt") == "b"


def test_reload_keeps_snapshot_and_rollback(tmp_path: Path) -> None:
    root = tmp_path / "state"
    first = SandboxLifecycleStore(root)
    created = first.create(files={"note.txt": "v1"})
    snap = first.snapshot(created.sandbox_id)
    first.write_file(created.sandbox_id, "note.txt", "v2")
    second = SandboxLifecycleStore(root)
    second.rollback(created.sandbox_id, snap.snapshot_id)
    assert second.read_file(created.sandbox_id, "note.txt") == "v1"


def test_idle_timeout_pauses_and_minus_one_never_does(tmp_path: Path) -> None:
    store = _store(tmp_path)
    idle = store.create(timeout_s=5)
    store._sandboxes[idle.sandbox_id].last_active = 0
    assert store.reap_idle(now=10) == [idle.sandbox_id]
    assert store.get(idle.sandbox_id).state == "paused"

    forever = store.create(timeout_s=-1)
    store._sandboxes[forever.sandbox_id].last_active = 0
    assert store.reap_idle(now=10**12) == []
    assert store.get(forever.sandbox_id).state == "running"


def test_pause_resume_rejects_wrong_state_and_paused_can_clone(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = store.create(files={"note.txt": "v1"})
    store.pause(created.sandbox_id)
    cloned = store.clone(created.sandbox_id, 1)
    assert cloned[0].state == "running"
    assert store.read_file(cloned[0].sandbox_id, "note.txt") == "v1"
    with pytest.raises(SandboxLifecycleError) as paused_again:
        store.pause(created.sandbox_id)
    assert paused_again.value.status == 409
    resumed = store.resume(created.sandbox_id)
    assert resumed.state == "running"
    with pytest.raises(SandboxLifecycleError):
        store.resume(created.sandbox_id)


def test_path_escape_and_symlink_are_rejected(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = store.create()
    with pytest.raises(SandboxLifecycleError) as escaped:
        store.write_file(created.sandbox_id, "../manifest.json", "x")
    assert escaped.value.code == "bad_request"
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")
    link = store._workspace(created.sandbox_id) / "leak.txt"
    try:
        os.symlink(outside, link)
    except OSError:
        pytest.skip("当前进程不能创建符号链接")
    with pytest.raises(SandboxLifecycleError) as linked:
        store.snapshot(created.sandbox_id)
    assert linked.value.code == "symlink_rejected"
    assert list((tmp_path / "state" / "snapshots").iterdir()) == []


def test_exec_resumes_paused_sandbox_and_drops_secret_env(tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    async def executor(
        command: str,
        workdir: str,
        env: dict[str, str],
        timeout: int,
    ) -> SandboxResult:
        captured["command"] = command
        captured["workdir"] = workdir
        captured["env"] = dict(env)
        captured["timeout"] = timeout
        return SandboxResult(0, "ok", "", 1.0, "fake", False)

    store = SandboxLifecycleStore(tmp_path / "state", executor=executor)
    created = store.create()
    store.pause(created.sandbox_id)
    result, dropped = asyncio.run(
        store.exec(
            created.sandbox_id,
            "echo hi",
            env={"NAME": "ada", "API_TOKEN": "sek", "DATABASE_URL": "postgres://local"},
        )
    )
    assert result.stdout == "ok"
    assert store.get(created.sandbox_id).state == "running"
    assert captured["command"] == "echo hi"
    env = captured["env"]
    assert isinstance(env, dict)
    assert env["NAME"] == "ada"
    assert "API_TOKEN" not in env
    assert "DATABASE_URL" not in env
    assert "API_TOKEN" in dropped
    assert str(captured["workdir"]).endswith("workspace")


def test_state_root_outside_workspace_is_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    granted = tmp_path / "granted"
    granted.mkdir()
    outside = tmp_path / "outside"
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(granted))
    monkeypatch.setenv("IHUI_SANDBOX_LIFECYCLE_ROOT", str(outside))
    with pytest.raises(SandboxLifecycleError) as caught:
        default_state_root()
    assert caught.value.code == "bad_request"
    monkeypatch.setenv("IHUI_SANDBOX_LIFECYCLE_ROOT", str(granted / "sandboxes"))
    assert default_state_root() == granted / "sandboxes"


def test_session_tool_roundtrip_and_rejects_unknown_action(tmp_path: Path) -> None:
    store = _store(tmp_path)
    set_store(store)
    try:
        created = asyncio.run(
            dispatch_sandbox_session({"action": "create", "files": {"note.txt": "v1"}})
        )
        assert created["ok"] is True
        sandbox_id = created["sandbox_id"]
        snap = asyncio.run(
            dispatch_sandbox_session({"action": "snapshot", "sandbox_id": sandbox_id})
        )
        assert snap["ok"] is True
        asyncio.run(
            dispatch_sandbox_session(
                {
                    "action": "write_file",
                    "sandbox_id": sandbox_id,
                    "path": "note.txt",
                    "content": "v2",
                }
            )
        )
        rolled = asyncio.run(
            dispatch_sandbox_session(
                {
                    "action": "rollback",
                    "sandbox_id": sandbox_id,
                    "snapshot_id": snap["snapshot_id"],
                }
            )
        )
        assert rolled["sandbox_id"] == sandbox_id
        read = asyncio.run(
            dispatch_sandbox_session(
                {"action": "read_file", "sandbox_id": sandbox_id, "path": "note.txt"}
            )
        )
        assert read["content"] == "v1"
        unknown = asyncio.run(dispatch_sandbox_session({"action": "format-disk"}))
        assert unknown["ok"] is False
        assert unknown["error"] == "bad_request"
        assert store.read_file(sandbox_id, "note.txt") == "v1"
    finally:
        set_store(None)


def test_corrupt_manifest_is_not_treated_as_empty(tmp_path: Path) -> None:
    root = tmp_path / "state"
    root.mkdir()
    (root / "manifest.json").write_text("{", encoding="utf-8")
    with pytest.raises(SandboxLifecycleError) as caught:
        SandboxLifecycleStore(root)
    assert caught.value.code == "manifest_unreadable"


def test_http_admin_roundtrip_and_rejects_network_field(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = _store(tmp_path)
    set_store(store)
    app = FastAPI()
    app.include_router(lifecycle_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "lifecycle-user"
    monkeypatch.setattr(lifecycle_router, "resolve_request_role_id", lambda request: 1)
    try:
        client = TestClient(app)
        denied = client.post("/api/sandbox/instances", json={"allow_network": True})
        assert denied.status_code == 422
        assert store._sandboxes == {}

        created = client.post("/api/sandbox/instances", json={"files": {"note.txt": "v1"}})
        assert created.status_code == 200
        sandbox_id = created.json()["data"]["sandbox_id"]
        assert created.json()["data"]["network"] == "deny"
        snap = client.post(f"/api/sandbox/instances/{sandbox_id}/snapshots")
        assert snap.status_code == 200
        snapshot_id = snap.json()["data"]["snapshot_id"]
        wrote = client.post(
            f"/api/sandbox/instances/{sandbox_id}/files",
            json={"path": "note.txt", "content": "v2"},
        )
        assert wrote.status_code == 200
        rolled = client.post(
            f"/api/sandbox/instances/{sandbox_id}/rollback",
            json={"snapshot_id": snapshot_id},
        )
        assert rolled.status_code == 200
        assert rolled.json()["data"]["sandbox_id"] == sandbox_id
        read = client.get(
            f"/api/sandbox/instances/{sandbox_id}/files",
            params={"path": "note.txt"},
        )
        assert read.status_code == 200
        assert read.json()["data"]["content"] == "v1"
        listed = client.get(f"/api/sandbox/instances/{sandbox_id}/snapshots")
        assert listed.status_code == 200
        assert listed.json()["data"]["snapshots"][0]["snapshot_id"] == snapshot_id
        removed = client.delete(
            f"/api/sandbox/instances/{sandbox_id}/snapshots/{snapshot_id}"
        )
        assert removed.status_code == 200
        gone = client.get(f"/api/sandbox/instances/{sandbox_id}/snapshots")
        assert gone.json()["data"]["snapshots"] == []
        assert store.read_file(sandbox_id, "note.txt") == "v1"
    finally:
        set_store(None)


def test_http_non_admin_does_not_create(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    store = _store(tmp_path)
    set_store(store)
    monkeypatch.setattr(lifecycle_router, "resolve_request_role_id", lambda request: 0)
    app = FastAPI()
    app.include_router(lifecycle_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "lifecycle-user"
    try:
        client = TestClient(app)
        res = client.post("/api/sandbox/instances", json={})
        assert res.status_code == 403
        assert store._sandboxes == {}
    finally:
        set_store(None)


def test_tool_schema_matches_session_actions() -> None:
    from app.services.mcp_server import _ADMIN_ONLY_TOOLS, _TOOL_HANDLERS, _TOOLS

    tool = next(item for item in _TOOLS if item.name == "sandbox_session")
    assert tuple(tool.input_schema["properties"]["action"]["enum"]) == SESSION_ACTIONS
    assert "sandbox_session" in _TOOL_HANDLERS
    assert "sandbox_session" in _ADMIN_ONLY_TOOLS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
