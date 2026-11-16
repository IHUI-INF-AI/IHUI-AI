# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 子代理级联中断 — Round 10（遵循统一工程规范）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


import pytest

from app.core.subagent_cascade import (
    INTERRUPT_REASONS,
    CascadeSkip,
    DescendantInfo,
    cascade_interrupt_descendants,
)


class FakeWorld:
    """可编程的后代世界：每轮发现结果由脚本决定，中断会真的把 active 置 False。"""

    def __init__(self, rounds: list[list[DescendantInfo]]):
        self._rounds = rounds
        self._discover_calls = 0
        self._state: dict[str, bool] = {}
        self.interrupted: list[str] = []
        self.fail_ids: set[str] = set()
        self.raise_on_interrupt: set[str] = set()

    async def list_descendants(self):
        idx = min(self._discover_calls, len(self._rounds) - 1)
        self._discover_calls += 1
        snapshot = self._rounds[idx]
        # 叠加已中断状态
        return [
            DescendantInfo(id=d.id, active=self._state.get(d.id, d.active))
            for d in snapshot
        ]

    async def interrupt_one(self, did: str) -> bool:
        if did in self.raise_on_interrupt:
            raise RuntimeError(f"boom-{did}")
        if did in self.fail_ids:
            return False
        self.interrupted.append(did)
        self._state[did] = False
        return True


# ---------- 一、两个不级联的例外 ----------


@pytest.mark.asyncio
async def test_descendant_cleanup_does_not_cascade():
    """reason=descendant-cleanup ⇒ 不级联（防递归风暴）。"""
    w = FakeWorld([[]])
    rep = await cascade_interrupt_descendants(
        reason="descendant-cleanup",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.attempted is False
    assert rep.skip_reason is CascadeSkip.NON_CASCADING_REASON
    assert rep.converged is True
    assert w.interrupted == []


@pytest.mark.asyncio
async def test_follower_role_does_not_cascade():
    """role=follower ⇒ 不级联（旁路观察者不拥有子代理）。"""
    w = FakeWorld([[DescendantInfo("a")]])
    rep = await cascade_interrupt_descendants(
        reason="user",
        role="follower",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.attempted is False
    assert rep.skip_reason is CascadeSkip.FOLLOWER_ROLE
    assert w.interrupted == []


# ---------- 二、基础级联 ----------


@pytest.mark.asyncio
async def test_single_round_interrupts_all_active():
    w = FakeWorld([[DescendantInfo("a"), DescendantInfo("b")]])
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.attempted is True
    assert set(rep.interrupted) == {"a", "b"}
    assert rep.converged is True
    assert sorted(w.interrupted) == ["a", "b"]


@pytest.mark.asyncio
async def test_inactive_descendants_are_skipped():
    """已经不活跃的后代不再尝试中断（省一次 RPC）。"""
    w = FakeWorld([[DescendantInfo("a", active=False), DescendantInfo("b", active=True)]])
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.interrupted == ("b",)
    assert w.interrupted == ["b"]


# ---------- 三、两阶段语义（本轮最核心的对位）----------


@pytest.mark.asyncio
async def test_second_round_catches_newly_spawned_descendants():
    """**核心对位**：第一轮中断期间父级又派生了 c ⇒ 第二轮必须补抓。

    对侧的「discoverDescendantSnapshot 再问一次」就是为这个场景存在的。
    """
    w = FakeWorld(
        [
            [DescendantInfo("a")],                 # 第一轮发现：只有 a
            [DescendantInfo("a"), DescendantInfo("c")],  # 重新发现：多出 c
            [DescendantInfo("a"), DescendantInfo("c")],  # 终态复查
        ]
    )
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert "a" in rep.interrupted
    assert "c" in rep.interrupted, "第二轮必须补上重新发现的后代"
    assert rep.rounds_run == 2
    assert rep.converged is True
    assert sorted(w.interrupted) == ["a", "c"]


@pytest.mark.asyncio
async def test_already_interrupted_not_retried():
    """已中断的后代不得在第二轮被重复尝试（幂等）。"""
    w = FakeWorld(
        [
            [DescendantInfo("a")],
            [DescendantInfo("a")],
            [DescendantInfo("a")],
        ]
    )
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert w.interrupted == ["a"], "a 只应被中断一次"
    attempts_for_a = [t for t in rep.attempts if t.descendant_id == "a"]
    assert len(attempts_for_a) == 1


# ---------- 四、失败与部分成功 ----------


@pytest.mark.asyncio
async def test_interrupt_exception_is_recorded_not_swallowed():
    """单个中断抛错 ⇒ 记进 attempts，其余继续（不整批放弃）。"""
    w = FakeWorld([[DescendantInfo("a"), DescendantInfo("b")]])
    w.raise_on_interrupt = {"a"}
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.interrupted == ("b",)
    failed = [t for t in rep.attempts if not t.succeeded]
    assert len(failed) == 1
    assert failed[0].descendant_id == "a"
    assert "boom-a" in (failed[0].error or "")


@pytest.mark.asyncio
async def test_interrupt_returning_false_is_recorded():
    w = FakeWorld([[DescendantInfo("a")]])
    w.fail_ids = {"a"}
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.interrupted == ()
    assert any(not t.succeeded for t in rep.attempts)


@pytest.mark.asyncio
async def test_discover_failure_stops_and_reports_unconverged():
    """发现失败 ⇒ 停止并判未收敛，绝不猜「已清空」。"""

    async def boom():
        raise RuntimeError("discovery down")

    w = FakeWorld([[]])
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=boom,
        interrupt_one=w.interrupt_one,
    )
    assert rep.attempted is True
    assert rep.converged is False
    assert any("发现后代失败" in n for n in rep.notes)


# ---------- 五、收敛上限（本仓超越轴三）----------


@pytest.mark.asyncio
async def test_round_limit_yields_unconverged_not_fake_clean():
    """持续派生 ⇒ 达上限判未收敛，不得假装干净。"""
    # 每轮都发现一个新的、永不清空
    rounds = [
        [DescendantInfo(f"d{i}")] for i in range(10)
    ]
    w = FakeWorld(rounds)
    # 让 interrupt 永远失败，模拟「中断不动」
    w.fail_ids = {f"d{i}" for i in range(10)}
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
        max_rounds=2,
    )
    assert rep.rounds_run == 2
    assert rep.converged is False
    assert CascadeSkip.ROUND_LIMIT_REACHED.value in rep.notes


@pytest.mark.asyncio
async def test_final_recheck_failure_is_unconverged():
    """终态复查失败 ⇒ 判未收敛（信息不足不判绿）。"""
    calls = {"n": 0}

    async def flaky():
        calls["n"] += 1
        if calls["n"] >= 3:
            raise RuntimeError("recheck down")
        return [DescendantInfo("a")] if calls["n"] == 1 else []

    async def interrupt(_):
        return True

    rep = await cascade_interrupt_descendants(
        reason="user", list_descendants=flaky, interrupt_one=interrupt
    )
    assert rep.converged is False
    assert any("复查失败" in n for n in rep.notes)


# ---------- 六、reason 值域与未判定 ----------


@pytest.mark.asyncio
async def test_unknown_reason_is_not_run():
    """认不出的 reason ⇒ 不跑，且不写成已清空。"""
    w = FakeWorld([[]])
    rep = await cascade_interrupt_descendants(
        reason="bogus-reason",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
    )
    assert rep.attempted is False
    assert rep.converged is False
    assert any("未判定" in n for n in rep.notes)


def test_reason_domain_matches_codex():
    """reason 值域与对侧六档按行为规格。"""
    assert set(INTERRUPT_REASONS) == {
        "user-stop",
        "system",
        "user",
        "descendant-cleanup",
        "shutdown",
        "timeout",
    }


@pytest.mark.asyncio
async def test_all_valid_reasons_run():
    """六档合法 reason（除 descendant-cleanup）都能正常跑。"""
    for reason in INTERRUPT_REASONS:
        w = FakeWorld([[]])
        rep = await cascade_interrupt_descendants(
            reason=reason, list_descendants=w.list_descendants, interrupt_one=w.interrupt_one
        )
        if reason == "descendant-cleanup":
            assert rep.attempted is False
        else:
            assert rep.attempted is True, f"{reason} 应触发级联"


# ---------- 七、可解释性（本仓超越轴二）----------


@pytest.mark.asyncio
async def test_report_explains_each_attempt():
    w = FakeWorld([[DescendantInfo("a"), DescendantInfo("b")]])
    w.raise_on_interrupt = {"a"}
    rep = await cascade_interrupt_descendants(
        reason="user", list_descendants=w.list_descendants, interrupt_one=w.interrupt_one
    )
    text = rep.explain()
    assert "attempted=True" in text
    assert "converged=" in text
    assert "descendant=a" in text
    assert "descendant=b" in text
    assert "已中断" in text and "失败" in text


# ---------- 八、失败者不重试 但新派生者不漏 ----------


@pytest.mark.asyncio
async def test_failed_descendant_not_retried_and_new_one_still_caught():
    """关键平衡：失败者不占第二轮预算，但第二轮新派生的必须被抓到。

    若把失败者也重试，则第二轮唯一的「补抓」名额会被失败者吃掉，
    新派生的 c 就永远漏掉；若不把失败者记入已处理集，就会无限重试。
    本用例锁住这两者的边界。
    """
    w = FakeWorld(
        [
            [DescendantInfo("a")],                          # 第一轮：只有 a（会失败）
            [DescendantInfo("a"), DescendantInfo("c")],     # 重新发现：a 仍在 + 新增 c
            [DescendantInfo("a"), DescendantInfo("c")],     # 终态
        ]
    )
    w.fail_ids = {"a"}   # a 永远中断不了
    rep = await cascade_interrupt_descendants(
        reason="user",
        list_descendants=w.list_descendants,
        interrupt_one=w.interrupt_one,
        max_rounds=2,
    )
    assert rep.interrupted == ("c",), "第二轮必须补上 c"
    a_attempts = [t for t in rep.attempts if t.descendant_id == "a"]
    assert len(a_attempts) == 1, "失败者不得在第二轮被重试"
    # a 仍活跃 ⇒ 未收敛（诚实）
    assert rep.converged is False
    assert "a" in " ".join(rep.notes)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
