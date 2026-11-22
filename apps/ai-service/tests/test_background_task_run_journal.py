# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-244:后台任务 run 状态 append-only journal + "禁用而非伪装"正反例。

正例:状态变更按序落行(submit/start/terminal)、重启回放从行派生终态、
live↔replay 镜像一致、取消恰一条终态行(防双写)。
反例:journal 写不进 ⇒ 显式禁用并拒单(绝不退回内存态接单)、无终态行 ⇒
回放派生 failed(不伪装仍在跑)、畸形行点名(不静默吞)、append-only 前缀字节不变。

conftest 的 `_isolate_run_journal` 夹具已把 DEFAULT_RUN_JOURNAL_PATH 重定向到
每测试独立 tmp;用例里自建的 BackgroundTaskManager() 在夹具之后构造,读到的
即 tmp 路径。journal 不可写反例用目录占住路径(open 必失败,跨平台 OSError)。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.services.background_tasks import (
    BackgroundTaskManager,
    TaskRecord,
    TaskState,
)
from app.services.task_run_journal import (
    AppendOnlyRunJournal,
    derive_run_states,
)


async def _ok_coro() -> str:
    return "ok"


async def _boom_coro() -> str:
    raise ValueError("boom")


async def _wait_for(condition, timeout: float = 2.0) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if condition():
            return
        await asyncio.sleep(0.005)
    raise AssertionError("等待条件超时")


def _journal_path(tmp_path: Path) -> Path:
    return tmp_path / "background_task_runs.jsonl"


def _events(tmp_path: Path, task_id: str | None = None):
    events, malformed = AppendOnlyRunJournal(_journal_path(tmp_path)).read_events()
    assert malformed == []
    if task_id is None:
        return events
    return [e for e in events if e.task_id == task_id]


async def test_state_changes_append_journal_rows_in_order(tmp_path):
    """正例①:一次完整生命周期恰好落 submit/start/terminal 三行,seq 严格递增。"""
    mgr = BackgroundTaskManager()
    task_id = await mgr.submit(
        _ok_coro, name="j-order", user_id=None, notify_on_done=False
    )
    assert isinstance(task_id, str)
    await _wait_for(lambda: mgr._tasks[task_id].state is TaskState.SUCCEEDED)
    rows = _events(tmp_path, task_id)
    assert [e.kind for e in rows] == ["submit", "start", "terminal"]
    seqs = [e.seq for e in rows]
    assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
    assert rows[0].payload.get("name") == "j-order"
    assert rows[-1].state == "succeeded"


async def test_restart_replay_restores_terminal(tmp_path):
    """正例②:重启后新 manager 内存查无此任务,hydrate 从行派生恢复终态。"""
    mgr1 = BackgroundTaskManager()
    task_id = await mgr1.submit(
        _ok_coro, name="j-replay", user_id=None, notify_on_done=False
    )
    await _wait_for(lambda: mgr1._tasks[task_id].state is TaskState.SUCCEEDED)

    mgr2 = BackgroundTaskManager()
    assert await mgr2.get_status(task_id) is None  # 病根原样:内存注册表已丢
    stats = mgr2.hydrate_from_journal()
    assert stats == {"hydrated": 1, "interrupted": 0, "malformed": 0}
    status = await mgr2.get_status(task_id)
    assert status is not None
    assert status["task_id"] == task_id
    assert status["state"] == TaskState.SUCCEEDED.value


async def test_missing_terminal_row_derives_failed_not_running(tmp_path):
    """反例①(不伪装仍在跑):journal 只到 running 就断 ⇒ 回放派生 failed 并点名原因。"""
    j = AppendOnlyRunJournal(_journal_path(tmp_path))
    j.append(kind="submit", task_id="t-lost", attempt=0, state="pending",
             payload={"name": "x"})
    j.append(kind="start", task_id="t-lost", attempt=0, state="running")
    mgr = BackgroundTaskManager()
    stats = mgr.hydrate_from_journal()
    assert stats["hydrated"] == 1
    assert stats["interrupted"] == 1
    record = mgr._tasks["t-lost"]
    assert record.state is TaskState.FAILED
    assert "不伪装仍在跑" in (record.error or "")
    assert record._terminal_claimed is True


async def test_unwritable_journal_disables_service_not_fakes_memory(tmp_path):
    """反例②(禁用而非伪装):journal 写不进 ⇒ submit/submit_typed 显式拒单,内存零登记。"""
    blocked = tmp_path / "blocked"
    blocked.mkdir()  # 目录占住 journal 路径:open 必抛 OSError(跨平台)
    mgr = BackgroundTaskManager(journal=AppendOnlyRunJournal(blocked))

    result = await mgr.submit(
        _ok_coro, name="j-disabled", user_id=None, notify_on_done=False
    )
    assert isinstance(result, dict)
    assert result["error"] == "background_tasks_disabled"
    assert result["ok"] is False and result["executed"] is False
    assert mgr._disabled_reason is not None
    assert mgr._tasks == {}  # 不伪装"任务存在":内存里一条都没登记

    again = await mgr.submit(
        _ok_coro, name="j-disabled-2", user_id=None, notify_on_done=False
    )
    assert isinstance(again, dict) and again["error"] == "background_tasks_disabled"

    typed = await mgr.submit_typed("echo", {}, user_id=None)
    assert typed["error"] == "background_tasks_disabled"
    assert typed["executed"] is False


async def test_resume_appends_resume_row_with_next_attempt(tmp_path):
    """正例③:resume 先落 attempt+1 的 resume 行,再改内存代次。"""
    mgr = BackgroundTaskManager()
    record = TaskRecord(
        task_id="t-r", name="r", user_id=None,
        task_type="echo", state=TaskState.FAILED, attempt_count=1,
        idempotency_key="k-r", checkpoint_key="k-r",
    )
    record._terminal_claimed = True
    mgr._tasks["t-r"] = record

    ack = await mgr.resume("t-r")
    assert ack["ok"] is True and ack["resumed"] is True
    rows = [e for e in _events(tmp_path, "t-r") if e.kind == "resume"]
    assert len(rows) == 1
    assert rows[0].attempt == 2
    assert record.attempt_count == 2
    await _wait_for(lambda: record.state in (TaskState.SUCCEEDED, TaskState.FAILED))


async def test_malformed_rows_are_named_not_swallowed(tmp_path):
    """反例③:畸形行(非 JSON / 词表越界)计数点名,合法行照常回放。"""
    good = json.dumps(
        {"seq": 2, "ts": "2026-10-26T00:00:00+00:00", "task_id": "t-ok",
         "attempt": 0, "kind": "submit", "state": "pending",
         "error": None, "payload": {"name": "ok"}},
        ensure_ascii=False,
    )
    _journal_path(tmp_path).write_text(
        "this is not json\n" + good + '\n{"seq":3,"ts":"x","task_id":"t","attempt":0,'
        '"kind":"bogus_kind","state":"pending","error":null,"payload":{}}\n',
        encoding="utf-8",
    )
    mgr = BackgroundTaskManager()
    stats = mgr.hydrate_from_journal()
    assert stats["malformed"] == 2
    assert stats["hydrated"] == 1  # 只有合法行进回放
    assert mgr._tasks["t-ok"].state is TaskState.FAILED  # submit 无终态行 ⇒ 派生 failed


async def test_journal_is_append_only_prefix_unchanged(tmp_path):
    """正例④:后续写入只追加 —— 已有前缀字节逐字不变(永不重写/截断)。"""
    mgr = BackgroundTaskManager()
    t1 = await mgr.submit(_ok_coro, name="first", user_id=None, notify_on_done=False)
    assert isinstance(t1, str)
    await _wait_for(lambda: mgr._tasks[t1].state is TaskState.SUCCEEDED)
    prefix = _journal_path(tmp_path).read_bytes()

    t2 = await mgr.submit(_ok_coro, name="second", user_id=None, notify_on_done=False)
    assert isinstance(t2, str)
    await _wait_for(lambda: mgr._tasks[t2].state is TaskState.SUCCEEDED)
    after = _journal_path(tmp_path).read_bytes()
    assert after.startswith(prefix)
    assert len(after) > len(prefix)


async def test_replay_mirror_matches_live_state(tmp_path):
    """正例⑤(同一 reducer):回放派生态与 live 记录逐字段镜像(状态/错误一致)。"""
    mgr = BackgroundTaskManager()
    ok_id = await mgr.submit(_ok_coro, name="m-ok", user_id=None, notify_on_done=False)
    assert isinstance(ok_id, str)
    await _wait_for(lambda: mgr._tasks[ok_id].state is TaskState.SUCCEEDED)
    fail_id = await mgr.submit(
        _boom_coro, name="m-fail", user_id=None, notify_on_done=False
    )
    assert isinstance(fail_id, str)
    await _wait_for(lambda: mgr._tasks[fail_id].state is TaskState.FAILED)

    views = derive_run_states(_events(tmp_path))
    for tid in (ok_id, fail_id):
        live = mgr._tasks[tid]
        assert views[tid].state == live.state.value
        assert views[tid].error == live.error

    mgr2 = BackgroundTaskManager()
    mgr2.hydrate_from_journal()
    status = await mgr2.get_status(fail_id)
    assert status is not None
    assert status["error"] == mgr._tasks[fail_id].error


async def test_cancel_writes_exactly_one_terminal_row(tmp_path):
    """正例⑥:cancel() 与 _run 的 CancelledError 兜底共用终态名额 ⇒ 终态行恰一条(防双写)。"""
    mgr = BackgroundTaskManager()
    task_id = await mgr.submit(
        lambda: asyncio.sleep(30), name="j-cancel", user_id=None, notify_on_done=False
    )
    assert isinstance(task_id, str)
    await _wait_for(lambda: mgr._tasks[task_id].state is TaskState.RUNNING)
    result = await mgr.cancel(task_id)
    assert result["ok"] is True
    await _wait_for(lambda: task_id not in mgr._handles)

    rows = [e for e in _events(tmp_path, task_id) if e.kind == "terminal"]
    assert len(rows) == 1
    assert rows[0].state == TaskState.CANCELLED.value
    assert rows[0].error == "任务被取消"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
