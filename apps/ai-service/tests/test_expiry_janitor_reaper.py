# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""过期清扫守护的用例(2026-10-15 立)。

隔离纪律(AGENTS §5 测试隔离铁律):用例只喂**假 manager**,既不开 PG(8810)也不开
Redis(8811);涉及默认装载点那一例把两个真 accessor monkeypatch 成桩,证明装载点找的
就是这两个自带回收出口的 manager,而不是靠名字推断。
"""

from __future__ import annotations

import pytest

from app.services import expiry_janitor as janitor


class DebugStub:
    def __init__(self, cleaned: int = 0, *, boom: bool = False) -> None:
        self.calls = 0
        self._cleaned = cleaned
        self._boom = boom

    async def cleanup_expired(self) -> int:
        self.calls += 1
        if self._boom:
            raise RuntimeError("boom")
        return self._cleaned


class CheckpointStub(DebugStub):
    pass


@pytest.fixture(autouse=True)
def _reset_latch():
    janitor.stop()
    yield
    janitor.stop()


async def test_两家都被敲_数量原样交回() -> None:
    dbg, ckpt = DebugStub(cleaned=3), CheckpointStub(cleaned=1)
    out = await janitor.sweep_once([dbg, ckpt])
    assert (dbg.calls, ckpt.calls) == (1, 1)
    assert out == {"DebugStub": 3, "CheckpointStub": 1}


async def test_一家抛异常不拖死其余_失败留痕为_1() -> None:
    bad, good = DebugStub(boom=True), CheckpointStub(cleaned=2)
    out = await janitor.sweep_once([bad, good])
    assert good.calls == 1, "坏的一家不得把后续家一起带走"
    assert out == {"DebugStub": -1, "CheckpointStub": 2}


async def test_默认装载点就是那两个在册manager_不碰真连接(monkeypatch) -> None:
    import app.services.agent_checkpoint as ckpt_mod
    import app.services.debugger as dbg_mod

    dbg, ckpt = DebugStub(), CheckpointStub()
    monkeypatch.setattr(dbg_mod, "get_debug_manager", lambda: dbg)
    monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", lambda: ckpt)

    targets = janitor.default_sweepables()
    assert len(targets) == 2
    out = await janitor.sweep_once(targets)
    assert (dbg.calls, ckpt.calls) == (1, 1)
    assert set(out.values()) == {0, 0}


def test_关档时ensure_started是no_op(monkeypatch) -> None:
    monkeypatch.setenv("EXPIRY_JANITOR_ENABLED", "0")
    assert janitor.ensure_started() is None


async def test_装载是幂等闩_重复进入lifespan只起一个任务(monkeypatch) -> None:
    monkeypatch.setenv("EXPIRY_JANITOR_ENABLED", "1")
    monkeypatch.setenv("EXPIRY_JANITOR_INTERVAL_SECONDS", "3600")
    first = janitor.ensure_started()
    second = janitor.ensure_started()
    assert first is not None and first is second, "重复装载不得再起第二个循环"
    assert not first.done()
    janitor.stop()
    third = janitor.ensure_started()
    assert third is not None and third is not first, "stop() 后闩必须复位,否则重启后守护再也不跑"
    third.cancel()


def test_数值档读不出数或非法时回落并夹到下限(monkeypatch) -> None:
    monkeypatch.setenv("EXPIRY_JANITOR_INTERVAL_SECONDS", "abc")
    assert janitor.interval_seconds_from_env() == janitor.DEFAULT_INTERVAL_SECONDS
    monkeypatch.setenv("EXPIRY_JANITOR_INTERVAL_SECONDS", "-5")
    assert janitor.interval_seconds_from_env() == janitor.DEFAULT_INTERVAL_SECONDS
    monkeypatch.setenv("EXPIRY_JANITOR_INTERVAL_SECONDS", "1")
    assert janitor.interval_seconds_from_env() == janitor.MIN_INTERVAL_SECONDS
    monkeypatch.setenv("EXPIRY_JANITOR_INTERVAL_SECONDS", "120")
    assert janitor.interval_seconds_from_env() == 120.0
    monkeypatch.delenv("EXPIRY_JANITOR_INTERVAL_SECONDS")
    assert janitor.interval_seconds_from_env() == janitor.DEFAULT_INTERVAL_SECONDS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
