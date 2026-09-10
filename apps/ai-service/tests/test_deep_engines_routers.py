# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""深度引擎 HTTP 路由测试(patch / sandbox_exec / sessions 三 router 接线)。

策略:每个 router 挂到独立 FastAPI app(不依赖 app.main 全量启动),
fastapi TestClient 驱动;鉴权依赖 get_current_user_id 用 dependency_overrides
注入固定身份;sessions 存储用 tmp_path 注入私有 sqlite 库,互不串扰。

覆盖:
- patch:preview 不落盘 / apply 事务性 / 越界路径拒绝 / 畸形补丁 / 语法校验回滚 / root 非法 400
- sandbox_exec:真实沙箱执行 echo / 非法策略 400 / 路径越权 403 / 空 argv 403 /
  未知后端 400 / backends 探测矩阵
- sessions:Thread/Turn/Item CRUD、状态机 409、幂等去重 409、resume 悬挂修复、
  fork、rollback、compact、FTS 搜索、404 路径
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import patch as patch_router
from app.routers import sandbox_exec as sandbox_router
from app.routers import sessions as sessions_router
from app.services.session_store import SessionStore

# =============================================================================
# fixtures
# =============================================================================


def _make_app(router: Any) -> FastAPI:
    """独立 app:仅挂载目标 router(带 /api 前缀)+ 固定身份覆盖。"""
    app = FastAPI()
    app.include_router(router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "test-user-001"
    return app


@pytest.fixture()
def patch_client(tmp_path: Path) -> Iterator[tuple[TestClient, Path]]:
    """patch router 客户端 + 临时 workspace root。"""
    client = TestClient(_make_app(patch_router))
    yield client, tmp_path


@pytest.fixture()
def sandbox_client() -> Iterator[TestClient]:
    """sandbox_exec router 客户端(真实执行走当前平台默认后端)。"""
    yield TestClient(_make_app(sandbox_router))


@pytest.fixture()
def sessions_client(tmp_path: Path) -> Iterator[tuple[TestClient, SessionStore]]:
    """sessions router 客户端 + tmp_path 注入的私有 SessionStore。"""
    store = SessionStore(tmp_path / "test_sessions.db")
    app = _make_app(sessions_router)
    app.dependency_overrides[sessions_router.get_session_store] = lambda: store
    yield TestClient(app), store
    store.close()


# =============================================================================
# patch router
# =============================================================================


def _update_patch(path: str, old: str, new: str) -> str:
    return (
        "*** Begin Patch\n"
        f"*** Update File: {path}\n"
        "@@\n"
        f"-{old}\n"
        f"+{new}\n"
        "*** End Patch\n"
    )


def test_patch_preview_does_not_write(patch_client: tuple[TestClient, Path]) -> None:
    client, root = patch_client
    (root / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    res = client.post(
        "/api/patch/preview",
        json={"patch": _update_patch("a.txt", "line1", "LINE1"), "root": str(root)},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["ok"] is True
    assert data["dry_run"] is True
    assert data["files"][0]["hunks"][0]["strategy"] == "exact"
    # 预览不落盘
    assert (root / "a.txt").read_text(encoding="utf-8") == "line1\nline2\n"


def test_patch_apply_updates_file(patch_client: tuple[TestClient, Path]) -> None:
    client, root = patch_client
    (root / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    res = client.post(
        "/api/patch/apply",
        json={"patch": _update_patch("a.txt", "line1", "LINE1"), "root": str(root)},
    )
    assert res.status_code == 200
    assert res.json()["data"]["ok"] is True
    assert (root / "a.txt").read_text(encoding="utf-8") == "LINE1\nline2\n"


def test_patch_apply_add_and_delete(patch_client: tuple[TestClient, Path]) -> None:
    client, root = patch_client
    (root / "gone.txt").write_text("bye\n", encoding="utf-8")
    patch = (
        "*** Begin Patch\n"
        "*** Add File: new/hello.txt\n"
        "+hello world\n"
        "*** Delete File: gone.txt\n"
        "*** End Patch\n"
    )
    res = client.post("/api/patch/apply", json={"patch": patch, "root": str(root)})
    assert res.status_code == 200
    assert res.json()["data"]["ok"] is True
    assert (root / "new" / "hello.txt").read_text(encoding="utf-8") == "hello world\n"
    assert not (root / "gone.txt").exists()


def test_patch_apply_rejects_escape_path(patch_client: tuple[TestClient, Path]) -> None:
    client, root = patch_client
    patch = _update_patch("../escape.txt", "x", "y")
    res = client.post("/api/patch/apply", json={"patch": patch, "root": str(root)})
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["ok"] is False
    assert "非法路径" in body["data"]["error"]
    assert not (root.parent / "escape.txt").exists()


def test_patch_apply_syntax_error_rolls_back_all(
    patch_client: tuple[TestClient, Path]
) -> None:
    """多文件事务性:bad.py 语法校验失败 → good.txt 也不得落盘。"""
    client, root = patch_client
    (root / "good.txt").write_text("keep\n", encoding="utf-8")
    patch = (
        "*** Begin Patch\n"
        "*** Update File: good.txt\n"
        "@@\n"
        "-keep\n"
        "+changed\n"
        "*** Add File: bad.py\n"
        "+def broken(\n"
        "*** End Patch\n"
    )
    res = client.post("/api/patch/apply", json={"patch": patch, "root": str(root)})
    data = res.json()["data"]
    assert data["ok"] is False
    assert "语法" in data["error"]
    assert (root / "good.txt").read_text(encoding="utf-8") == "keep\n"
    assert not (root / "bad.py").exists()


def test_patch_malformed_patch_returns_error(
    patch_client: tuple[TestClient, Path]
) -> None:
    client, root = patch_client
    res = client.post(
        "/api/patch/preview",
        json={"patch": "not a patch at all", "root": str(root)},
    )
    data = res.json()["data"]
    assert data["ok"] is False
    assert "Begin Patch" in data["error"]


def test_patch_rejects_nonexistent_root(patch_client: tuple[TestClient, Path]) -> None:
    client, root = patch_client
    res = client.post(
        "/api/patch/apply",
        json={"patch": _update_patch("a.txt", "x", "y"), "root": str(root / "nope")},
    )
    assert res.status_code == 400


def test_patch_rejects_relative_root(patch_client: tuple[TestClient, Path]) -> None:
    client, _root = patch_client
    res = client.post(
        "/api/patch/apply",
        json={"patch": _update_patch("a.txt", "x", "y"), "root": "relative/dir"},
    )
    assert res.status_code == 400


# =============================================================================
# sandbox_exec router
# =============================================================================


def _hello_argv() -> list[str]:
    return [sys.executable, "-c", "print('hello-sandbox')"]


def test_sandbox_run_success(sandbox_client: TestClient) -> None:
    res = sandbox_client.post(
        "/api/sandbox/run",
        json={"cmd": _hello_argv(), "policy": {"restrict_token": False}},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["returncode"] == 0
    assert data["ok"] is True
    assert "hello-sandbox" in data["stdout"]
    assert data["backend"] in {"win_job", "linux_bwrap", "mac_seatbelt"}


def test_sandbox_run_policy_error_400(sandbox_client: TestClient) -> None:
    res = sandbox_client.post(
        "/api/sandbox/run",
        json={"cmd": _hello_argv(), "policy": {"timeout_s": 0}},
    )
    assert res.status_code == 400
    assert "策略非法" in res.json()["detail"]


def test_sandbox_run_unknown_policy_field_400(sandbox_client: TestClient) -> None:
    res = sandbox_client.post(
        "/api/sandbox/run",
        json={"cmd": _hello_argv(), "policy": {"bogus_field": True}},
    )
    assert res.status_code == 400


def test_sandbox_run_path_violation_403(
    sandbox_client: TestClient, tmp_path: Path
) -> None:
    """readable 白名单外的路径 token → 启动前拒绝(403)。"""
    allowed = (tmp_path / "allowed").as_posix()
    secret = (tmp_path / "secret" / "data.txt").as_posix()
    res = sandbox_client.post(
        "/api/sandbox/run",
        json={
            "cmd": [sys.executable, "-c", "pass", secret],
            "policy": {"readable_paths": [allowed], "restrict_token": False},
        },
    )
    assert res.status_code == 403
    assert "越权" in res.json()["detail"]


def test_sandbox_run_empty_argv_403(sandbox_client: TestClient) -> None:
    res = sandbox_client.post("/api/sandbox/run", json={"cmd": []})
    assert res.status_code == 403


def test_sandbox_run_unknown_backend_400(sandbox_client: TestClient) -> None:
    res = sandbox_client.post(
        "/api/sandbox/run",
        json={"cmd": _hello_argv(), "backend": "plan9_box"},
    )
    assert res.status_code == 400
    assert "未知沙箱后端" in res.json()["detail"]


def test_sandbox_backends_matrix(sandbox_client: TestClient) -> None:
    res = sandbox_client.get("/api/sandbox/backends")
    assert res.status_code == 200
    data = res.json()["data"]
    names = {b["backend"] for b in data["backends"]}
    assert names == {"win_job", "linux_bwrap", "mac_seatbelt"}
    assert data["platform_default"] in names
    defaults = [b for b in data["backends"] if b["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["available"] is True


# =============================================================================
# sessions router
# =============================================================================


def _new_thread(client: TestClient, title: str = "t") -> str:
    res = client.post("/api/sessions/threads", json={"title": title})
    assert res.status_code == 200
    return str(res.json()["data"]["thread_id"])


def _new_turn(client: TestClient, thread_id: str) -> str:
    res = client.post(f"/api/sessions/threads/{thread_id}/turns", json={})
    assert res.status_code == 200
    return str(res.json()["data"]["turn_id"])


def _append(client: TestClient, turn_id: str, item: dict[str, Any]) -> Any:
    return client.post(f"/api/sessions/turns/{turn_id}/items", json={"item": item})


def test_sessions_thread_crud(sessions_client: tuple[TestClient, SessionStore]) -> None:
    client, _store = sessions_client
    tid = _new_thread(client, "hello")
    res = client.get(f"/api/sessions/threads/{tid}")
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["title"] == "hello"
    assert body["item_count"] == 0
    # 列表分页
    res = client.get("/api/sessions/threads", params={"limit": 10})
    assert res.json()["data"]["total"] == 1


def test_sessions_get_thread_404(sessions_client: tuple[TestClient, SessionStore]) -> None:
    client, _store = sessions_client
    assert client.get("/api/sessions/threads/nonexistent").status_code == 404


def test_sessions_turn_lifecycle(sessions_client: tuple[TestClient, SessionStore]) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    res = client.get(f"/api/sessions/turns/{turn_id}")
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "running"
    # 正常结束
    res = client.post(f"/api/sessions/turns/{turn_id}/end", json={"status": "completed"})
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "completed"
    # 二次结束 → 非法迁移 409
    res = client.post(f"/api/sessions/turns/{turn_id}/end", json={"status": "failed"})
    assert res.status_code == 409


def test_sessions_start_turn_missing_thread_404(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    res = client.post("/api/sessions/threads/nope/turns", json={})
    assert res.status_code == 404


def test_sessions_end_turn_404(sessions_client: tuple[TestClient, SessionStore]) -> None:
    client, _store = sessions_client
    res = client.post("/api/sessions/turns/nope/end", json={"status": "completed"})
    assert res.status_code == 404


def test_sessions_append_and_list_items(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    res = _append(client, turn_id, {"item_type": "user_message", "content": "你好"})
    assert res.status_code == 200
    assert res.json()["data"]["seq"] == 1
    res = _append(client, turn_id, {"item_type": "agent_message", "content": "hi"})
    assert res.json()["data"]["seq"] == 2
    # 列表 + 类型过滤
    res = client.get(f"/api/sessions/threads/{tid}/items")
    assert res.json()["data"]["total"] == 2
    res = client.get(
        f"/api/sessions/threads/{tid}/items", params={"kind": "user_message"}
    )
    items = res.json()["data"]["items"]
    assert len(items) == 1 and items[0]["content"] == "你好"


def test_sessions_append_invalid_item_400(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    res = _append(client, turn_id, {"item_type": "telepathy", "content": "x"})
    assert res.status_code == 400


def test_sessions_append_duplicate_client_id_409(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    item = {"item_type": "user_message", "content": "a", "client_item_id": "c-1"}
    assert _append(client, turn_id, item).status_code == 200
    res = _append(client, turn_id, {**item, "content": "b"})
    assert res.status_code == 409
    assert "client_item_id" in res.json()["detail"]


def test_sessions_append_to_missing_turn_404(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    res = _append(client, "nope", {"item_type": "user_message", "content": "x"})
    assert res.status_code == 404


def test_sessions_resume_repairs_dangling_tool_call(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    _append(client, turn_id, {"item_type": "user_message", "content": "run it"})
    _append(
        client,
        turn_id,
        {"item_type": "tool_call", "call_id": "call-1", "tool": "shell",
         "arguments": {"cmd": "ls"}},
    )
    # 没有对应 tool_result → resume 应补 synthetic interrupted
    res = client.post(f"/api/sessions/threads/{tid}/resume")
    assert res.status_code == 200
    messages = res.json()["data"]["messages"]
    roles = [m["role"] for m in messages]
    assert "user" in roles and "assistant" in roles
    assert messages[-1]["role"] == "tool"
    assert "interrupted" in messages[-1]["content"]
    assert messages[-1]["tool_call_id"] == "call-1"


def test_sessions_resume_missing_thread_404(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    assert client.post("/api/sessions/threads/nope/resume").status_code == 404


def test_sessions_fork_copies_prefix(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client, "origin")
    turn_id = _new_turn(client, tid)
    _append(client, turn_id, {"item_type": "user_message", "content": "first"})
    seq1 = _append(client, turn_id, {"item_type": "agent_message", "content": "second"}).json()["data"]["seq"]
    _append(client, turn_id, {"item_type": "user_message", "content": "third"})
    # 在 seq1 处 fork → 新 thread 只有前 2 条
    res = client.post(
        f"/api/sessions/threads/{tid}/fork",
        json={"at_response_id": seq1, "title": "branch"},
    )
    assert res.status_code == 200
    new_tid = res.json()["data"]["thread_id"]
    assert new_tid != tid
    res = client.get(f"/api/sessions/threads/{new_tid}/items")
    assert res.json()["data"]["total"] == 2


def test_sessions_fork_bad_seq_400(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    res = client.post(f"/api/sessions/threads/{tid}/fork", json={"at_response_id": 999})
    assert res.status_code == 400


def test_sessions_fork_missing_thread_404(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    res = client.post("/api/sessions/threads/nope/fork", json={"at_response_id": 1})
    assert res.status_code == 404


def test_sessions_rollback_truncates_history(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    t1 = _new_turn(client, tid)
    _append(client, t1, {"item_type": "user_message", "content": "keep"})
    client.post(f"/api/sessions/turns/{t1}/end", json={"status": "completed"})
    t2 = _new_turn(client, tid)
    _append(client, t2, {"item_type": "user_message", "content": "drop"})
    res = client.post(
        f"/api/sessions/threads/{tid}/rollback",
        json={"to_turn_id": t1, "reason": "test"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["to_seq"] == 1
    # rollback 后 resume 只回放截断上界之前内容
    messages = client.post(f"/api/sessions/threads/{tid}/resume").json()["data"]["messages"]
    contents = [m.get("content", "") for m in messages]
    assert "keep" in contents and "drop" not in contents


def test_sessions_rollback_turn_mismatch_400(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid_a = _new_thread(client, "a")
    tid_b = _new_thread(client, "b")
    turn_b = _new_turn(client, tid_b)
    res = client.post(
        f"/api/sessions/threads/{tid_a}/rollback", json={"to_turn_id": turn_b}
    )
    assert res.status_code == 400


def test_sessions_rollback_missing_turn_404(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    res = client.post(
        f"/api/sessions/threads/{tid}/rollback", json={"to_turn_id": "nope"}
    )
    assert res.status_code == 404


def test_sessions_compact_then_resume_summary(
    sessions_client: tuple[TestClient, SessionStore]
) -> None:
    client, _store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    _append(client, turn_id, {"item_type": "user_message", "content": "old talk"})
    res = client.post(
        f"/api/sessions/threads/{tid}/compact",
        json={"summary": "此前讨论了旧话题", "tokens_before": 100, "tokens_after": 10},
    )
    assert res.status_code == 200
    assert res.json()["data"]["item_type"] == "compaction_boundary"
    # compact 后 resume:摘要在前,边界前的原始条目不再回放
    messages = client.post(f"/api/sessions/threads/{tid}/resume").json()["data"]["messages"]
    assert messages[0]["role"] == "system"
    assert "此前讨论了旧话题" in messages[0]["content"]
    assert all("old talk" not in m.get("content", "") for m in messages)


def test_sessions_search_fts(sessions_client: tuple[TestClient, SessionStore]) -> None:
    client, store = sessions_client
    tid = _new_thread(client)
    turn_id = _new_turn(client, tid)
    _append(client, turn_id, {"item_type": "user_message", "content": "blue kettle recipe"})
    res = client.get("/api/sessions/search", params={"q": "kettle"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["fts_enabled"] == store.fts_enabled
    assert data["total"] >= 1
    hit = data["hits"][0]
    assert hit["thread_id"] == tid
    assert hit["item_type"] == "user_message"
    # 空命中路径
    assert client.get("/api/sessions/search", params={"q": "zzz-nothing"}).json()["data"]["total"] == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
