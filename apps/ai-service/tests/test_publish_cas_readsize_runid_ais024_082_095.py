# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-024 / AIS-082 / AIS-095 三条一组:定时发布抢占 CAS、read_file 读侧上限、run_id 覆盖。

缺陷(现读):
  · AIS-024 `_poll_once` 的 `UPDATE ... WHERE task_id=$2` 不判 CAS:两个实例/两轮
    轮询同时捞到同一行都会各自 spawn,同一任务并发发布两次;抢占后进程被 kill
    留下的 running 行永远不再被捞(启动只捞 scheduled);
  · AIS-082 read_file 无大小上限:整文件进内存并全量写 `_FILE_BASE_CONTENT`
    (最多 256 份),GB 级文件直接 OOM;写侧 10MB 门形同虚设;
  · AIS-095 `cloud_run_store.start` 对客户端自选 run_id 直接覆盖:凭 run_id 就能
    顶掉他人运行记录(后续 PATCH/GET 按属主判 404,原记录已被抹掉)。

修法:
  · AIS-024 抢占改 `WHERE task_id=$2 AND status='scheduled'` 并解析 rowcount
    (`_command_tag_count`),没抢到就退位;每轮先按 `_RUNNING_LEASE_SEC` 回收悬挂
    running 行;
  · AIS-082 读前 `getsize`,超 `_READ_FILE_MAX_BYTES`(10MB,与写侧对齐)直接
    返回 FILE_TOO_LARGE,不进内存也不进 base 缓存;
  · AIS-095 同 run_id 异属主 raise ValueError,路由回 409;同属主重入保留。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import cloud_runs
from app.routers.cloud_runs import RunStartRequest, create_cloud_run
from app.services import mcp_server as mcp_module
from app.services.cloud_run_store import CloudRunStore
from app.services.publish.scheduler import (
    PublishScheduler,
    _command_tag_count,
    _RUNNING_LEASE_SEC,
)


# ---------------------------------------------------------------------------
# AIS-024:抢占 CAS + 悬挂 running 回收
# ---------------------------------------------------------------------------


class _FakeConn:
    """记录 SQL 的最小 asyncpg 替身:所有 DML 返回命令标签。"""

    def __init__(self, rows: list[dict[str, Any]], *, cas_result: str = "UPDATE 1") -> None:
        self.rows = rows
        self.cas_result = cas_result
        self.executed: list[str] = []
        self.closed = False

    async def execute(self, sql: str, *args: Any) -> str:
        self.executed.append(sql)
        if "AND status='scheduled'" in sql:
            return self.cas_result
        return "UPDATE 1"

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        self.executed.append(sql)
        return self.rows

    async def close(self) -> None:
        self.closed = True


def _sched_with(conn: _FakeConn) -> PublishScheduler:
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=conn)  # type: ignore[assignment]
    return sched


def _row(task_id: str = "t-1", user_id: str = "alice") -> dict[str, Any]:
    return {
        "task_id": task_id,
        "user_id": user_id,
        "title": "t",
        "format": "md",
        "content": {"title": "t", "body": "b", "format": "md"},
        "targets": ["weibo"],
    }


async def test_poll_cas_loss_releases_slot() -> None:
    """另一实例先抢走(命令标签 UPDATE 0):本实例不 spawn、槽位不泄漏。"""
    conn = _FakeConn([_row()], cas_result="UPDATE 0")
    sched = _sched_with(conn)
    spawned: list[Any] = []
    sched._spawn_task = lambda coro: spawned.append(coro)  # type: ignore[assignment]

    assert await sched._poll_once() is True

    assert spawned == []
    assert sched._user_running.get("alice", 0) == 0
    assert sched._reserved == set() and sched._task_users == {}
    assert any("AND status='scheduled'" in sql for sql in conn.executed)


async def test_poll_cas_win_spawns_once() -> None:
    """抢到(命令标签 UPDATE 1):spawn 一次,槽位由任务自身释放。"""
    conn = _FakeConn([_row()], cas_result="UPDATE 1")
    sched = _sched_with(conn)
    spawned: list[Any] = []
    sched._spawn_task = lambda coro: spawned.append(coro)  # type: ignore[assignment]

    assert await sched._poll_once() is True

    assert len(spawned) == 1
    assert sched._user_running.get("alice", 0) == 1
    for coro in spawned:
        coro.close()


async def test_poll_reclaims_stale_running_rows() -> None:
    """每轮先按租约回收悬挂 running 行,否则崩溃实例的任务永远不再发布。"""
    conn = _FakeConn([_row()], cas_result="UPDATE 1")
    sched = _sched_with(conn)
    sched._spawn_task = lambda coro: coro.close()  # type: ignore[assignment]

    assert _RUNNING_LEASE_SEC > 0
    await sched._poll_once()

    reclaim = [sql for sql in conn.executed if "status = 'running'" in sql or "status='running'" in sql]
    assert any("INTERVAL" in sql for sql in reclaim)


def test_command_tag_count_parses_rowcount() -> None:
    """CAS 命中判定只能靠命令标签行数(UPDATE 0 也是"成功执行")。"""
    assert _command_tag_count("UPDATE 1") == 1
    assert _command_tag_count("UPDATE 0") == 0
    assert _command_tag_count("DELETE 3") == 3
    assert _command_tag_count(None) == 0
    assert _command_tag_count("garbage") == 0


# ---------------------------------------------------------------------------
# AIS-082:read_file 读侧大小门
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _tmp_path_is_workspace_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> None:
    """工作区白名单登记 tmp_path(AIS-080 起 search/read 入口都过白名单)。"""
    real = mcp_module._get_workspace_roots
    monkeypatch.setattr(
        mcp_module, "_get_workspace_roots", lambda: [str(tmp_path.resolve()), *real()]
    )


async def test_read_file_rejects_oversized_file(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """超过读侧上限:拒读并给 FILE_TOO_LARGE,不返回内容、不登记 base。"""
    monkeypatch.setattr(mcp_module, "_READ_FILE_MAX_BYTES", 8)
    big = tmp_path / "big.txt"
    big.write_text("0123456789", encoding="utf-8")  # 10 字节 > 8
    mcp_module._FILE_BASE_CONTENT.pop(str(big.resolve()), None)

    out = await mcp_module._tool_read_file({"path": str(big)})

    assert out["ok"] is False
    assert out["errorCode"] == "FILE_TOO_LARGE"
    assert out["content"] == "" and out["size"] == 10
    assert str(big.resolve()) not in mcp_module._FILE_BASE_CONTENT


async def test_read_file_still_reads_small_file(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """上限内的文件读取行为不变(含 base 快照登记)。"""
    monkeypatch.setattr(mcp_module, "_READ_FILE_MAX_BYTES", 8)
    small = tmp_path / "small.txt"
    small.write_text("abc", encoding="utf-8")

    out = await mcp_module._tool_read_file({"path": str(small)})

    assert out["ok"] is True and out["content"] == "abc"


# ---------------------------------------------------------------------------
# AIS-095:cloud run_id 覆盖
# ---------------------------------------------------------------------------


def _store(tmp_path: Any) -> CloudRunStore:
    return CloudRunStore(file_path=tmp_path / "cloud_runs.json")


def test_store_rejects_cross_owner_run_id_reuse(tmp_path: Any) -> None:
    """异属主复用 run_id:ValueError;原记录原样保留。"""
    store = _store(tmp_path)
    store.start("alice-task", run_id="r-1", user_id="alice")

    with pytest.raises(ValueError):
        store.start("bob-task", run_id="r-1", user_id="bob")

    kept = store.get("r-1", user_id="alice")
    assert kept is not None and kept.task == "alice-task"


def test_store_allows_same_owner_run_id(tmp_path: Any) -> None:
    """同属主重入(CLI 重试)不拦,覆盖自身记录是既有语义。"""
    store = _store(tmp_path)
    store.start("first", run_id="r-1", user_id="alice")
    run = store.start("second", run_id="r-1", user_id="alice")

    assert run.task == "second"


async def test_endpoint_returns_409_for_cross_owner_run_id(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """路由层:异属主 run_id → 409(不再是 200 静默覆盖)。"""
    store = _store(tmp_path)
    store.start("alice-task", run_id="r-1", user_id="alice")
    monkeypatch.setattr(cloud_runs, "cloud_run_store", store)

    with pytest.raises(HTTPException) as exc:
        await create_cloud_run(RunStartRequest(task="bob-task", run_id="r-1"), user_id="bob")

    assert exc.value.status_code == 409
    assert store.get("r-1", user_id="alice").task == "alice-task"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
