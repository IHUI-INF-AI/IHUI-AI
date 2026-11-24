# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51 判据 3/4:幂等键与断点续跑。

三条必须被机器钉住的事实:
1. **幂等键构成** = sha256(task_type ⊕ 规范化 arguments):键序无关、类型敏感、参数敏感。
2. **重复提交不重复执行**:同一逻辑任务第二次提交命中**同一条记录**,executor 调用次数不翻倍。
3. **断点续跑不重跑已完成部分**:中断后恢复,已完成单元不再被执行;终产物与一次跑完等价。

测试隔离(AGENTS §5):不连生产库/Redis;LLM 与 HTTP 走 executor 既有的传输层注入缝
(`llm_call` / `http_get`),判据与聚合逻辑一行都不在测试里复制。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from app.services import task_executors as te
from app.services.background_tasks import (
    BackgroundTaskManager,
    TaskState,
    background_task_manager,
    compute_idempotency_key,
)


def _uid() -> str:
    return uuid.uuid4().hex[:10]


async def _wait_terminal(
    manager: BackgroundTaskManager, task_id: str, timeout: float = 20.0
) -> dict[str, Any]:
    terminal = {"succeeded", "failed", "timeout", "cancelled"}
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    status: dict[str, Any] = {}
    while loop.time() < deadline:
        got = await manager.get_status(task_id)
        assert got is not None, f"任务丢失: {task_id}"
        status = got
        if status["state"] in terminal:
            return status
        await asyncio.sleep(0.02)
    raise AssertionError(f"任务未在 {timeout}s 内进入终态: {task_id} ({status.get('state')})")


# ---------------------------------------------------------------------------
# 1. 幂等键构成
# ---------------------------------------------------------------------------


def test_idempotency_key_is_order_insensitive_type_sensitive_and_arg_sensitive() -> None:
    """键的构成规则被钉成三条断言 —— 不是"看着像哈希"就算数。"""
    args_a = {"root": "/x", "max_files": 10}
    args_b = {"max_files": 10, "root": "/x"}
    assert compute_idempotency_key("code_index", args_a) == compute_idempotency_key("code_index", args_b)
    # 同参数、不同类型 ⇒ 必须是不同任务
    assert compute_idempotency_key("code_index", args_a) != compute_idempotency_key("patrol", args_a)
    # 同类型、参数值不同 ⇒ 必须是不同任务
    assert compute_idempotency_key("code_index", args_a) != compute_idempotency_key(
        "code_index", {**args_a, "max_files": 11}
    )
    # 嵌套结构也要参与(否则"只有一层不同"会被当成同一逻辑任务)
    assert compute_idempotency_key("batch_llm", {"items": [1, 2]}) != compute_idempotency_key(
        "batch_llm", {"items": [2, 1]}
    )
    assert len(compute_idempotency_key("echo", {})) == 32


async def test_typed_submit_derives_key_from_type_and_arguments() -> None:
    """不显式给键时,由 task_type + arguments 自动派生同一个键。"""
    key = f"auto-{_uid()}"
    args = {"urls": [f"https://example.com/{key}"], "concurrency": 1}
    calls: list[str] = []

    async def fake_get(url: str, _t: float) -> tuple[int, str]:
        calls.append(url)
        return 200, "<title>t</title>"

    first = await background_task_manager.submit_typed(
        "web_batch", args, name="派生键", user_id=None, notify_on_done=False,
        idempotency_key=None, http_get=fake_get,
    )
    second = await background_task_manager.submit_typed(
        "web_batch", args, name="派生键", user_id=None, notify_on_done=False,
        idempotency_key=None, http_get=fake_get,
    )
    assert first["ok"] and second["ok"]
    assert first["task_id"] == second["task_id"]
    assert second["deduplicated"] is True
    derived = compute_idempotency_key("web_batch", args)
    assert first["idempotency_key"] == derived
    await _wait_terminal(background_task_manager, first["task_id"])
    assert len(calls) == 1, "同一派生键的两次提交只能发一次请求"


# ---------------------------------------------------------------------------
# 2. 重复提交不重复执行
# ---------------------------------------------------------------------------


async def test_duplicate_submit_while_running_never_reexecutes() -> None:
    """第一次还在跑时第二次提交 ⇒ 命中同一记录、同一 task_id、调用次数不翻倍。"""
    key = f"dup-{_uid()}"
    state = {"calls": 0}

    async def fake_llm(messages: list[dict[str, Any]], _m: str | None) -> dict[str, Any]:
        state["calls"] += 1
        await asyncio.sleep(0.4)
        return {"content": str(messages[0]["content"])}

    items = ["x1", "x2", "x3"]
    first = await background_task_manager.submit_typed(
        "batch_llm", {"items": items, "concurrency": 1},
        name="去重", user_id=None, notify_on_done=False, idempotency_key=key,
        timeout_s=60, llm_call=fake_llm,
    )
    assert first["ok"] is True and first["deduplicated"] is False
    await asyncio.sleep(0.1)  # 保证第一次确实在跑
    second = await background_task_manager.submit_typed(
        "batch_llm", {"items": items, "concurrency": 1},
        name="去重", user_id=None, notify_on_done=False, idempotency_key=key,
        timeout_s=60, llm_call=fake_llm,
    )
    assert second["deduplicated"] is True, "同一逻辑任务必须命中既有记录,而不是再起一次"
    assert second["task_id"] == first["task_id"]
    assert second["state"] in {TaskState.RUNNING.value, TaskState.PENDING.value}
    status = await _wait_terminal(background_task_manager, first["task_id"])
    assert status["state"] == TaskState.SUCCEEDED.value
    assert status["attempt_count"] == 1
    assert state["calls"] == 3, f"executor 被重复执行了:{state['calls']} 次调用(应为 3)"
    assert len(await background_task_manager.list_tasks(limit=500)) >= 1


async def test_completed_task_resubmit_returns_original_record() -> None:
    """已成功的任务再提交 ⇒ 直接回原结果,不再跑(幂等的另一半)。"""
    key = f"done-{_uid()}"
    calls: list[str] = []

    async def fake_get(url: str, _t: float) -> tuple[int, str]:
        calls.append(url)
        return 200, "<title>ok</title>"

    args = {"urls": [f"https://example.com/{key}"]}
    ack = await background_task_manager.submit_typed(
        "web_batch", args, name="已完成", user_id=None, notify_on_done=False,
        idempotency_key=key, http_get=fake_get,
    )
    await _wait_terminal(background_task_manager, ack["task_id"])
    again = await background_task_manager.submit_typed(
        "web_batch", args, name="已完成", user_id=None, notify_on_done=False,
        idempotency_key=key, http_get=fake_get,
    )
    assert again["deduplicated"] is True
    assert again["dedup_reason"] == "状态 succeeded"
    assert again["resumed"] is False
    assert calls == [f"https://example.com/{key}"]
    hit = background_task_manager.find_by_idempotency_key(key)
    assert hit is not None and hit["task_id"] == ack["task_id"]
    assert background_task_manager.find_by_idempotency_key("no-such-key") is None


# ---------------------------------------------------------------------------
# 3. 断点续跑
# ---------------------------------------------------------------------------


async def _drive_batch(
    store: te.CheckpointStore,
    key: str,
    *,
    items: list[str],
    abort_after: int | None,
    log: list[int],
) -> dict[str, Any]:
    """跑一轮 batch_llm(经真实分派出口),记录每个 item 的**实际执行次数**。"""
    cancel_event = asyncio.Event()
    state = {"inflight": 0, "peak": 0}

    async def fake_llm(messages: list[dict[str, Any]], _m: str | None) -> dict[str, Any]:
        prompt = str(messages[0]["content"])
        idx = int(prompt.split(":")[1])
        log[idx] = log.get(idx, 0) + 1
        state["inflight"] += 1
        state["peak"] = max(state["peak"], state["inflight"])
        try:
            await asyncio.sleep(0.02)
        finally:
            state["inflight"] -= 1
        if abort_after is not None and idx == abort_after - 1:
            # 并发=1 ⇒ 第 abort_after 项跑完即置取消信号,后续项不得再被调用
            cancel_event.set()
        return {"content": f"out::{idx}"}

    return await te.execute_task(
        "batch_llm",
        {"items": items, "concurrency": 1, "prompt_template": "item:{item}"},
        store=store,
        checkpoint_key=key,
        task_id=f"resume-{_uid()}",
        cancel_event=cancel_event,
        llm_call=fake_llm,
    )


async def test_interrupted_task_resumes_without_rerunning_completed_units() -> None:
    """中断 → 恢复:已完成单元一次都不重跑,总数与单元数相等。"""
    store = te.CheckpointStore()
    key = f"resume-{_uid()}"
    items = ["0", "1", "2", "3"]
    log: dict[int, int] = {}

    first = await _drive_batch(store, key, items=items, abort_after=2, log=log)
    assert first["checkpoint_completed_units"] == 2, "中断前应已落 2 个单元的 checkpoint"
    assert first["succeeded"] == 2
    assert log == {0: 1, 1: 1}, f"第一轮的调用面应为 {log}"

    resumed_log: dict[int, int] = dict(log)
    second = await _drive_batch(store, key, items=items, abort_after=None, log=resumed_log)
    assert second["executed"] is True
    assert second["checkpoint_completed_units"] == 4
    assert resumed_log[0] == 1 and resumed_log[1] == 1, (
        f"已完成单元被重跑了:{resumed_log}"
    )
    assert resumed_log[2] == 1 and resumed_log[3] == 1


async def test_resumed_result_equals_single_pass_result() -> None:
    """断点续跑的终产物必须与一次跑完**等价**(否则续跑只是看着能跑)。"""
    items = ["0", "1", "2", "3"]

    single_log: dict[int, int] = {}
    single = await _drive_batch(
        te.CheckpointStore(), f"single-{_uid()}", items=items, abort_after=None, log=single_log
    )

    store = te.CheckpointStore()
    key = f"split-{_uid()}"
    split_log: dict[int, int] = {}
    await _drive_batch(store, key, items=items, abort_after=2, log=split_log)
    await _drive_batch(store, key, items=items, abort_after=None, log=split_log)

    def outputs(result: dict[str, Any]) -> list[str]:
        return sorted(
            str(r.get("output")) for r in result["results"] if isinstance(r, dict) and r.get("output")
        )

    resumed = await _drive_batch(store, key, items=items, abort_after=None, log=split_log)
    assert outputs(single) == outputs(resumed)
    assert single_log == split_log, "两条路径的真实执行次数必须逐 item 相同"


async def test_failed_task_resubmit_same_key_reuses_record_and_bumps_attempt() -> None:
    """失败/超时后再提交同一键 ⇒ 命中同一记录、attempt_count+1、state 回到执行中。"""
    import sys

    key = f"retry-{_uid()}"
    args = {
        "command": [sys.executable, "-c", "import time; time.sleep(30)"],
        "timeout_s": 1,
    }
    first = await background_task_manager.submit_typed(
        "long_running_command", args, name="会超时", user_id=None,
        notify_on_done=False, idempotency_key=key, timeout_s=1,
    )
    status = await _wait_terminal(background_task_manager, first["task_id"])
    assert status["state"] == TaskState.TIMEOUT.value

    second = await background_task_manager.submit_typed(
        "long_running_command", args, name="会超时", user_id=None,
        notify_on_done=False, idempotency_key=key, timeout_s=1,
    )
    assert second["task_id"] == first["task_id"], "续跑必须复用同一条记录"
    assert second["resumed"] is True and second["deduplicated"] is True
    final = await _wait_terminal(background_task_manager, first["task_id"])
    assert final["attempt_count"] == 2


async def test_explicit_resume_api_only_accepts_resumable_states() -> None:
    """`resume()` 对成功态必须拒绝(避免把已完成任务再跑一遍)。"""
    import sys

    key = f"resume-api-{_uid()}"
    ack = await background_task_manager.submit_typed(
        "long_running_command",
        {"command": [sys.executable, "-c", "print('ok')"], "timeout_s": 30},
        name="成功", user_id=None, notify_on_done=False, idempotency_key=key,
    )
    await _wait_terminal(background_task_manager, ack["task_id"])
    refused = await background_task_manager.resume(ack["task_id"])
    assert refused["ok"] is False
    assert "不可续跑" in refused["error"]
    missing = await background_task_manager.resume("deadbeef" * 4)
    assert missing["ok"] is False and "任务不存在" in missing["error"]


def test_checkpoint_store_roundtrips_through_disk(tmp_path: Path) -> None:
    """持久化 checkpoint 必须能跨 store 实例读回(进程内中断恢复的同一套机制)。"""
    store = te.CheckpointStore(tmp_path)
    assert store.persistent is True
    cp = store.load("k-roundtrip")
    cp.mark_done("unit-1", artifact={"n": 1})
    cp.mark_done("unit-2", artifact={"n": 2})

    reopened = te.CheckpointStore(tmp_path).load("k-roundtrip")
    assert reopened.is_done("unit-1") and reopened.is_done("unit-2")
    assert reopened.payload["unit-1"] == {"n": 1}
    assert reopened.completed_units == 2

    # 内存态 store(未设目录)只活在本进程
    mem = te.CheckpointStore()
    mem.load("k-mem").mark_done("u")
    assert te.CheckpointStore().load("k-mem").is_done("u") is False


def test_persisted_checkpoint_file_is_json_and_keyed_by_digest(tmp_path: Path) -> None:
    store = te.CheckpointStore(tmp_path)
    cp = store.load("hello-key")
    cp.mark_done("a")
    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    body = json.loads(files[0].read_text(encoding="utf-8"))
    assert body["key"] == "hello-key"
    assert body["done"] == ["a"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
