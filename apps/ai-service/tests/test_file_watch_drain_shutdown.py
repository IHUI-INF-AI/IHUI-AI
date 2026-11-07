# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Z32 装车证明:关停前排空(drain-on-shutdown)+「没有 watchWorkspace 线程」的兜底腿。

① 关停路径(thread.close / delete / archive、fs.unwatch、进程退出出口)必须做**最后一次**
   同步排空:`task.cancel()` 把周期腿打断在它自己的定点等待上,尾批否则永远等不到那一亮;
   量不到批必须出声(window-open ⇒ carried、undetermined ⇒ unjudged),不许静默丢事件。
② 现读复核「没有该线程就没有周期」:fs/watch 是第二条既有 2s 循环、fork 原会把创建条件
   洗成 False ⇒ 两格兜底已接;默认档仍 off(与接线前逐字等价)。
零真实网络/数据库:增量入口 `index_changed_paths` 换成记录器(不连 8810/8811);去抖窗由
注入钟拨,全程零 sleep。
"""

from __future__ import annotations

import inspect
import logging
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import file_watcher as fw  # noqa: E402
from app.services import codebase_incremental_index as cii  # noqa: E402
from app.services.agent_engine import AgentEngine  # noqa: E402

OFF_KEYS = (
    "ENGINE_FILE_WATCHER_ENABLED",
    fw.POLL_ENABLED_ENV,
    fw.POLL_UNTIL_ENV,
    "IHUI_INCREMENTAL_INDEX_WINDOW_S",
)
Call = tuple[str, tuple[str, ...]]


class _Clock:
    """注入钟:去抖窗由测试自己拨,不靠 sleep(§0.3)。"""

    def __init__(self, now: float = 100.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, delta: float) -> float:
        self.now += delta
        return self.now


class _FakeLoop:
    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return None


async def _loop_factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
    return _FakeLoop()


async def _rpc(eng: AgentEngine, method: str, params: dict[str, Any], rid: int = 1) -> Any:
    response = await eng.handle_message(
        {"jsonrpc": "2.0", "id": rid, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


def _engine(tmp_path: Path, monkeypatch: Any, *, window: float, on: bool) -> Any:
    """真构造链(生产同一枚桥、同一组入参)+ 增量入口记录器 + 门控两档。"""
    for key in OFF_KEYS:
        monkeypatch.delenv(key, raising=False)
    eng = AgentEngine(loop_factory=_loop_factory)
    clock = _Clock()
    eng._incremental_index_clock = clock
    eng._incremental_index_window_s = window
    calls: list[Call] = []

    async def _recorder(indexer: Any, repo_path: str, changed: Any, **kw: Any) -> str:
        calls.append((repo_path, tuple(changed)))
        return "recorded"

    monkeypatch.setattr(cii, "index_changed_paths", _recorder)
    if on:
        monkeypatch.setenv("ENGINE_FILE_WATCHER_ENABLED", "1")
        monkeypatch.setenv(fw.POLL_ENABLED_ENV, "on")
        monkeypatch.setenv(fw.POLL_UNTIL_ENV, "2099-12-31")
    return eng, clock, calls


def _repo(root: Path) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    (root / "a.py").write_text("v = 1\n", encoding="utf-8")
    return root


async def _start(eng: AgentEngine, root: Path) -> str:
    started = await _rpc(eng, "thread.start", {"workspace": str(root), "watchWorkspace": True})
    return str(started["threadId"])


@pytest.mark.asyncio
async def test_thread_close_drains_tail_batch(tmp_path: Path, monkeypatch: Any) -> None:
    """①close 路径:周期腿跑不到最后一燃,关停序列必须把尾批真发出去。"""
    eng, clock, calls = _engine(tmp_path, monkeypatch, window=0.0, on=True)
    root = _repo(tmp_path / "repo")
    tid = await _start(eng, root)
    assert tid in eng._workspace_watchers, "watchWorkspace=true 必须起既有 2s 循环"
    await eng.drive_file_watch_and_drain(str(root))  # 订阅即基线
    hand = root / "hand.py"
    hand.write_text("h = 1\n", encoding="utf-8")
    assert calls == [], "排空之前不得有出站"
    closed = await _rpc(eng, "thread.close", {"threadId": tid})
    assert closed["closed"] is True
    assert len(calls) == 1, f"关停序列必须排空尾批:{calls}"
    assert hand.resolve() in {Path(p).resolve() for p in calls[0][1]}, calls
    assert eng._workspace_watchers == {}, "关循环必须摘干净(防僵尸任务泄漏)"
    assert clock.now == 100.0, "关停排空不得靠 sleep"


@pytest.mark.asyncio
async def test_close_with_open_window_voices_carried_and_keeps_batch(
    tmp_path: Path, monkeypatch: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """①窗未到点 ⇒ 不谎报「已下发」,但必须出声并保住这批(桥生命周期归引擎实例)。"""
    eng, clock, calls = _engine(tmp_path, monkeypatch, window=5.0, on=True)
    root = _repo(tmp_path / "repo")
    tid = await _start(eng, root)
    await eng.drive_file_watch_and_drain(str(root))
    hand = root / "hand.py"
    hand.write_text("h = 1\n", encoding="utf-8")
    assert (await eng.drive_file_watch_and_drain(str(root)))["drain"] == "window-open"
    assert calls == []
    with caplog.at_level(logging.WARNING, logger="app.services.agent_engine"):
        await _rpc(eng, "thread.close", {"threadId": tid})
    msgs = [r.getMessage() for r in caplog.records]
    assert any("关停前排空未落地" in m and "仍扣在桥内" in m for m in msgs), msgs
    assert calls == [], "窗未到点不得把 carried 冒充成已下发"
    clock.advance(6.0)  # 引擎还活着 ⇒ 下一次排空仍要把这批下发(证明不是丢)
    again = await eng.drive_file_watch_and_drain(str(root))
    assert again["drain"] == "batch", again
    assert len(calls) == 1 and hand.resolve() in {Path(p).resolve() for p in calls[0][1]}, calls


@pytest.mark.asyncio
async def test_default_off_close_moves_no_byte_and_speaks_nothing(
    tmp_path: Path, monkeypatch: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """①默认档(三键全缺)⇒ 关停腿零装配、零出站、零日志;盘上一个字节不动。"""
    eng, clock, calls = _engine(tmp_path, monkeypatch, window=0.0, on=False)
    root = _repo(tmp_path / "repo")
    tid = await _start(eng, root)
    hand = root / "hand.py"
    hand.write_text("h = 1\n", encoding="utf-8")
    with caplog.at_level(logging.WARNING, logger="app.services.agent_engine"):
        assert (await _rpc(eng, "thread.close", {"threadId": tid}))["closed"] is True
    assert eng._file_watch_receivers == {} and eng._incremental_bridges == {}
    assert calls == [] and eng._workspace_watchers == {}
    assert [r.getMessage() for r in caplog.records if "关停前排空" in r.getMessage()] == []
    assert hand.read_text(encoding="utf-8") == "h = 1\n"
    assert clock.now == 100.0


@pytest.mark.asyncio
async def test_shutdown_workspace_watchers_drains_every_live_loop(
    tmp_path: Path, monkeypatch: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """①b 进程退出的引擎侧出口:逐条循环关停并排空;运行时已被摘走 ⇒ 出声不猜路径。"""
    eng, _clock, calls = _engine(tmp_path, monkeypatch, window=0.0, on=True)
    root_a, root_b = _repo(tmp_path / "a"), _repo(tmp_path / "b")
    await _start(eng, root_a)
    tid_b = await _start(eng, root_b)
    for each in (root_a, root_b):
        await eng.drive_file_watch_and_drain(str(each))
    (root_a / "hand.py").write_text("h = 1\n", encoding="utf-8")
    (root_b / "hand.py").write_text("h = 2\n", encoding="utf-8")
    eng._threads.pop(tid_b, None)  # 循环在跑而运行时已没了 ⇒ 取不到 workspace
    with caplog.at_level(logging.WARNING, logger="app.services.agent_engine"):
        reports = await eng.shutdown_workspace_watchers()
    ra = str(root_a.resolve())
    assert len(reports) == 2, reports
    assert any(r.get("repo") == ra and r.get("drain") == "batch" for r in reports), reports
    assert any(r.get("threadId") == tid_b and r.get("measured") is False for r in reports)
    assert any("关停前排空未判定" in r.getMessage() for r in caplog.records)
    assert len(calls) == 1, f"摘掉运行时的循环不得猜 repo 根 ⇒ 只该排空一条:{calls}"
    assert eng._workspace_watchers == {}
    assert await eng.shutdown_workspace_watchers() == [], "退出腿必须幂等(空表零动作)"


@pytest.mark.asyncio
async def test_fs_watch_carrier_drains_without_watch_workspace_thread(
    tmp_path: Path, monkeypatch: Any
) -> None:
    """②兜底腿:一条 watchWorkspace 线程都没起,fs/watch 照样有节奏并在摘除时排空。"""
    eng, clock, calls = _engine(tmp_path, monkeypatch, window=0.0, on=True)
    root = _repo(tmp_path / "repo")
    watched = await _rpc(eng, "fs.watch", {"watchId": "w1", "path": str(root), "userId": "u1"})
    assert watched["path"] == str(root)
    assert eng._workspace_watchers == {}, "本例刻意不起任何 watchWorkspace 线程"
    assert eng._fs_watch_roots == {"w1": str(root)}
    await eng.drive_file_watch_and_drain(str(root))  # 基线
    hand = root / "hand.py"
    hand.write_text("h = 1\n", encoding="utf-8")
    assert (await _rpc(eng, "fs.unwatch", {"watchId": "w1"}))["stopped"] is True
    assert len(calls) == 1 and hand.resolve() in {Path(p).resolve() for p in calls[0][1]}, calls
    assert eng._fs_watchers == {} and eng._fs_watch_roots == {}
    assert clock.now == 100.0


@pytest.mark.asyncio
async def test_fork_keeps_the_resident_carrier(tmp_path: Path, monkeypatch: Any) -> None:
    """②现读复核出的缺口:fork 原不携带 watch_workspace ⇒ 线程级周期在分叉后凭空消失。"""
    eng, _clock, calls = _engine(tmp_path, monkeypatch, window=0.0, on=False)
    root = _repo(tmp_path / "repo")
    tid = await _start(eng, root)
    clone_id = str((await _rpc(eng, "thread.fork", {"threadId": tid}))["threadId"])
    assert eng._threads[clone_id].watch_workspace is True, "fork 不得把周期载体洗成 False"
    assert {tid, clone_id} <= set(eng._workspace_watchers), "两条线程都得有既有 2s 循环"
    assert calls == []
    await eng.shutdown_workspace_watchers()
    assert eng._workspace_watchers == {}


def test_shutdown_and_fallback_legs_start_no_task_and_never_sleep() -> None:
    """形状锁:兜底/关停腿不自起 daemon、不 sleep,且排在既有循环的空判 continue 之前。"""
    for name in (
        "drive_file_watch_once", "drive_file_watch_and_drain", "drain_file_watch_on_shutdown",
        "_stop_workspace_watcher_and_drain", "_stop_fs_watcher_and_drain",
        "shutdown_workspace_watchers",
    ):
        src = inspect.getsource(getattr(AgentEngine, name))
        for banned in ("create_task", "ensure_future", "asyncio.sleep", ".start()"):
            assert banned not in src, f"{name} 含 {banned} ⇒ 自起 daemon,违规"
    fs_src = inspect.getsource(AgentEngine._handle_fs_watch)
    assert "drive_file_watch_and_drain" in fs_src, "兜底腿必须复用既有 fs/watch 循环"
    after_scan = fs_src.split("prev = curr", 1)[1]
    assert "drive_file_watch_and_drain" in after_scan.split("if not (added", 1)[0], (
        "兜底排空必须排在「盘上无变更即 continue」之前,否则尾批永不排空"
    )
    assert "_stop_fs_watcher_and_drain" in inspect.getsource(AgentEngine._handle_fs_unwatch)
    for site in ("_handle_thread_close", "_handle_thread_delete", "_handle_thread_archive"):
        assert "_stop_workspace_watcher_and_drain" in inspect.getsource(
            getattr(AgentEngine, site)
        ), f"{site} 未接关停排空腿"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
