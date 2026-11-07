# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Z18 装车证明:外部手改(不经 apply_patch)经**声明式门控**进入增量入口。

覆盖四格(逐条对应本票任务):
① 启用可声明 + 可到期 + 缺值出声(默认档恒 off,绝不静默起轮询);
② 调度腿挂在既有常驻循环上,不新建 asyncio 任务(形状锁 §末例);
③ 尾批周期排空:盘上无新变更、无 apply_patch,仅到点 ⇒ 批照样下发;
④ 开档外部手改进增量入口 / 关档一个字节都不动且零出站(ai-service 内没有邮件腿,
   出站面 = 增量写通道与 emit,两者都按"没被调过"断言)。

零真实网络/数据库:增量入口 `index_changed_paths` 整体换成记录器(不连 8810/8811)。
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import sys
from datetime import date
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import file_watcher as fw  # noqa: E402
from app.services.agent_engine import AgentEngine  # noqa: E402

FUTURE = "2099-12-31"
PAST = "2020-01-01"


class _Clock:
    """注入钟:去抖窗由测试自己拨,不靠 sleep。"""

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

    async def interrupt(self, mode: str = "cancel") -> None:
        return None


async def _loop_factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
    return _FakeLoop()


@pytest.fixture
def engine(tmp_path, monkeypatch):
    """引擎 + 注入钟 + 默认档(三键全缺)。零真实网络/库:增量入口换成记录器。"""
    for key in ("ENGINE_FILE_WATCHER_ENABLED", fw.POLL_ENABLED_ENV, fw.POLL_UNTIL_ENV,
                "IHUI_INCREMENTAL_INDEX_WINDOW_S"):
        monkeypatch.delenv(key, raising=False)
    eng = AgentEngine(loop_factory=_loop_factory)
    eng._incremental_index_clock = _Clock()
    return eng, [], tmp_path


def _attach_entry(eng: AgentEngine, root: Path, calls: list, monkeypatch) -> str:
    """把增量入口换成记录器(生产同一构造链);返回链路档名供证据点名。

    现读事实:并发席在飞的工作树副本 `codebase_indexer.py` 有 SyntaxError ⇒ 上游
    链路结构上导不进来。此时按**同一枚桥、同一组入参**手工装配(window/clock 取
    引擎现值),档名回给用例挂在断言消息里,不哑报也不假绿。
    """
    key = str(root.resolve())

    async def _index_run(paths: tuple[str, ...]) -> str:
        calls.append((key, tuple(paths)))
        return "recorded"

    try:
        from app.services import codebase_incremental_index as cii

        async def _recorder(indexer: Any, repo_path: str, changed: Any, **kw: Any) -> str:
            return await _index_run(tuple(changed))

        monkeypatch.setattr(cii, "index_changed_paths", _recorder)
        return "real"
    except SyntaxError as e:  # 上游在飞打断 ⇒ 手工装同参数桥(增量三件判据零改动)
        from app.services.codebase_incremental_bridge import IncrementalIndexBridge

        eng._incremental_bridges[key] = IncrementalIndexBridge(
            eng._file_watcher_router_or_none(),
            [key],
            _index_run,
            window_s=eng._incremental_index_window_s,
            clock=eng._incremental_index_clock,
        )
        return f"seamed(上游 SyntaxError: {e})"


def _declare_on(monkeypatch: Any) -> None:
    monkeypatch.setenv("ENGINE_FILE_WATCHER_ENABLED", "1")
    monkeypatch.setenv(fw.POLL_ENABLED_ENV, "on")
    monkeypatch.setenv(fw.POLL_UNTIL_ENV, FUTURE)


def _repo(root: Path) -> Path:
    root.mkdir(exist_ok=True)
    (root / "a.py").write_text("v = 1\n", encoding="utf-8")
    return root


# ---------------------------------------------------------------------------
# ①门控三态:可声明 / 可到期 / 缺值 = 未判定(不默认开,也不冒充"已关")
# ---------------------------------------------------------------------------
def test_gate_states_are_declared_not_defaulted() -> None:
    today = date(2026, 11, 6)
    missing = fw.resolve_watch_poll_gate({}, today=today)
    assert missing.state == fw.POLL_STATE_UNJUDGED and not missing.drives()
    assert fw.POLL_ENABLED_ENV in (missing.reason or ""), missing.reason

    off = fw.resolve_watch_poll_gate({fw.POLL_ENABLED_ENV: "off"}, today=today)
    assert off.state == fw.POLL_STATE_OFF and not off.drives()

    no_expiry = fw.resolve_watch_poll_gate({fw.POLL_ENABLED_ENV: "on"}, today=today)
    assert no_expiry.state == fw.POLL_STATE_UNJUDGED
    assert fw.POLL_UNTIL_ENV in (no_expiry.reason or ""), no_expiry.reason

    bad = fw.resolve_watch_poll_gate(
        {fw.POLL_ENABLED_ENV: "1", fw.POLL_UNTIL_ENV: "next-wednesday"}, today=today
    )
    assert bad.state == fw.POLL_STATE_UNJUDGED

    expired = fw.resolve_watch_poll_gate(
        {fw.POLL_ENABLED_ENV: "on", fw.POLL_UNTIL_ENV: PAST}, today=today
    )
    assert expired.state == fw.POLL_STATE_OFF and "已到期" in (expired.reason or "")

    on = fw.resolve_watch_poll_gate(
        {fw.POLL_ENABLED_ENV: "true", fw.POLL_UNTIL_ENV: FUTURE}, today=today
    )
    assert on.state == fw.POLL_STATE_ON and on.drives()


@pytest.mark.asyncio
async def test_missing_declaration_moves_no_byte_and_speaks_once(engine, caplog) -> None:
    """缺值(= 生产默认档)⇒ 未判定出声并点名缺哪个键;零装配、零出站、零任务、零写入。"""
    eng, calls, tmp = engine
    root = _repo(tmp / "repo")
    (root / "hand.py").write_text("h = 1\n", encoding="utf-8")
    tasks_before = len(asyncio.all_tasks())

    with caplog.at_level(logging.WARNING, logger="app.services.agent_engine"):
        for _ in range(3):
            report = eng.drive_file_watch_once(str(root))
            await eng.drive_file_watch_and_drain(str(root))

    assert report["state"] == fw.POLL_STATE_UNJUDGED, report
    assert eng._file_watch_receivers == {}, "未判定档不得装配扫描器"
    assert eng._file_watcher_router is None, "未判定档不得新建路由器"
    assert eng._incremental_bridges == {}, "未判定档不得建消费桥"
    assert calls == [], f"关档不得有出站(增量写通道被调):{calls}"
    assert len(asyncio.all_tasks()) == tasks_before, "本腿不得自起任务"
    assert (root / "hand.py").read_text(encoding="utf-8") == "h = 1\n"
    warnings = [r.getMessage() for r in caplog.records]
    assert any(fw.POLL_ENABLED_ENV in m and "未判定" in m for m in warnings), warnings
    assert len(warnings) == 1, f"未判定只出声一次,不每轮刷屏:{warnings}"


@pytest.mark.asyncio
async def test_explicit_off_moves_no_byte_and_stays_silent(engine, monkeypatch, caplog):
    eng, calls, tmp = engine
    root = _repo(tmp / "repo")
    (root / "hand.py").write_text("h = 1\n", encoding="utf-8")
    monkeypatch.setenv(fw.POLL_ENABLED_ENV, "off")
    monkeypatch.setenv(fw.POLL_UNTIL_ENV, FUTURE)

    with caplog.at_level(logging.WARNING, logger="app.services.agent_engine"):
        report = eng.drive_file_watch_once(str(root))
        await eng.drive_file_watch_and_drain(str(root))

    assert report["state"] == fw.POLL_STATE_OFF, report
    assert eng._file_watch_receivers == {} and eng._incremental_bridges == {}
    assert calls == [] and [r.getMessage() for r in caplog.records] == []
    assert (root / "hand.py").read_text(encoding="utf-8") == "h = 1\n"


# ---------------------------------------------------------------------------
# ④开档:外部手改(全程不调 apply_patch、不调任何工具 executor)真进增量入口
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_external_hand_edit_reaches_incremental_entry(engine, monkeypatch) -> None:
    eng, calls, tmp = engine
    _declare_on(monkeypatch)
    eng._incremental_index_window_s = 0.0
    root = _repo(tmp / "repo")
    chain = _attach_entry(eng, root, calls, monkeypatch)

    first = await eng.drive_file_watch_and_drain(str(root))
    assert first["state"] == fw.POLL_STATE_ON and first["paths"] == 0, (first, chain)
    assert calls == [], "订阅即基线:首轮只建快照,不把已存在文件冒充变更"

    hand = root / "hand.py"  # 人手改文件
    hand.write_text("h = 1\n", encoding="utf-8")
    second = await eng.drive_file_watch_and_drain(str(root))

    assert second["paths"] >= 1 and second["delivered"] >= 1, (second, chain)
    assert second["drain"] == "batch", (second, chain)
    assert len(calls) == 1, (calls, chain)
    # Receiver 语义:被订阅的目录自身 mtime 随子项变化 ⇒ 根与子项同批(不隐瞒这一点)
    seen = {Path(p).resolve() for p in calls[0][1]}
    assert hand.resolve() in seen, (calls, chain)


@pytest.mark.asyncio
async def test_tail_batch_drains_on_next_periodic_drive(engine, monkeypatch) -> None:
    """Z11 §④-1 尾批格:开窗后盘上再无变更、再无 apply_patch,仅到点仍自燃成批。"""
    eng, calls, tmp = engine
    _declare_on(monkeypatch)
    eng._incremental_index_window_s = 5.0
    root = _repo(tmp / "repo")
    chain = _attach_entry(eng, root, calls, monkeypatch)
    await eng.drive_file_watch_and_drain(str(root))  # 建基线

    hand = root / "hand.py"
    hand.write_text("h = 1\n", encoding="utf-8")
    opened = await eng.drive_file_watch_and_drain(str(root))
    assert opened["drain"] == "window-open", (opened, chain)
    assert calls == [], "窗口未过不得下发"

    clock: _Clock = eng._incremental_index_clock  # type: ignore[assignment]
    clock.advance(6.0)  # 只有时间过窗:不写盘、不调 apply_patch、不再喂新事件
    flush = await eng.drive_file_watch_and_drain(str(root))

    assert flush["paths"] == 0, flush  # 本轮盘上确实无新变更
    assert flush["drain"] == "batch", flush
    assert len(calls) == 1, calls
    assert hand.resolve() in {Path(p).resolve() for p in calls[0][1]}, calls


# ---------------------------------------------------------------------------
# ②形状锁:调度腿复用既有常驻循环,本腿自己绝不自起 daemon
# ---------------------------------------------------------------------------
def test_leg_is_wired_on_existing_resident_loop() -> None:
    loop_src = inspect.getsource(AgentEngine._start_workspace_watcher)
    assert "drive_file_watch_and_drain" in loop_src, "调度腿必须挂在已在跑的循环上"
    after_scan = loop_src.split("prev = curr", 1)[1]
    assert "drive_file_watch_and_drain" in after_scan.split("if not (added", 1)[0], (
        "周期排空必须排在「盘上无变更即 continue」之前,否则尾批永不排空"
    )
    for name in ("drive_file_watch_once", "drive_file_watch_and_drain"):
        src = inspect.getsource(getattr(AgentEngine, name))
        for banned in ("create_task", "ensure_future", "asyncio.sleep", ".start()"):
            assert banned not in src, f"{name} 含 {banned} ⇒ 本腿自起 daemon,违规"
    assert "async def start" in inspect.getsource(fw), "Receiver 原形未被改动"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
