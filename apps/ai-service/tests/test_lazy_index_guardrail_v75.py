# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #75 后半:懒索引护栏复评的回归(阈值重定档 + 超限不得静默)。

票面前半把两条检索通道的枚举层换成 ripgrep 并留了 `enum_degraded`;后半要求
"对 10 万文件级 monorepo 复评 `_LAZY_INDEX_MAX_FILES=2000`"。复评交付的是三件事,
本文件按这三件分四组钉住,判据一律用**构造面**(自建小树 + 现传的 limits),
不锚定仓库瞬时状态(今天真仓有多少文件,明天就不成立):

 A 组 阈值是**派生**的不是字面量 —— 三条成本轴各算各的,取最小值,且能说出谁 binding
 B 组 有界探测的语义:精确值 vs 下界必须在类型上分开;两条通道同形
 C 组 超限/异常**不得静默**:每一种"没有语义结果"都必须有 reason
 D 组 工具面:降级标记必须回到 LLM 读得到的响应体里(不是只在日志里)

两条写法纪律沿用 `test_file_search_ripgrep_v75.py`:
 - 判据一律调生产出口(`mcp_server.evaluate_lazy_index_guard` 等),测试不抄副本(§22c)。
 - 全程零网络、零生产库:索引与重搜两个出口都被 AsyncMock 替身挡住。
"""

from __future__ import annotations

import math
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.services import mcp_server
from app.services.codebase_indexer import (
    EMBEDDING_BATCH_SIZE,
    MAX_FILES_PER_INDEX,
    _EXT_TO_LANG,
    _IGNORED_DIRS,
)
from app.services.rg_fallback_parity import (
    ENGINE_PYTHON_WALK,
    ENGINE_RIPGREP,
    SizeProbe,
    enumerate_code_files,
    probe_code_file_count,
)

#: 一次懒索引在该档下允许的**最大**文件数(batch 轴):ceil(n * 6.86/20) ≤ batch_budget。
#: 用它而不是手算常数,免得换算系数一改这里就悄悄测了个别的东西。
def _max_files_within_batch_budget(batch_budget: int, chunks_per_file: float = 6.86) -> int:
    n = 0
    while math.ceil((n + 1) * chunks_per_file / EMBEDDING_BATCH_SIZE) <= batch_budget:
        n += 1
    return n


def _probe(count: int, *, lower_bound: bool = False, limit: int = 1_000) -> SizeProbe:
    return SizeProbe(
        count=count,
        is_lower_bound=lower_bound,
        limit=limit,
        duration_s=0.123,
        engine=ENGINE_RIPGREP,
        degraded_reason=None,
    )


def _limits_with(**overrides: float) -> mcp_server.LazyIndexLimits:
    """按生产公式算 limits,但允许把某个系数调贵以触发指定分支。

    两个**预算**也必须随对象传进去:`evaluate_lazy_index_guard` 早先只读模块常量,
    于是"传个便宜的 limits 就能测超限"是假的 —— 判定仍旧拿全局的 300 次去比,
    用例绿的是构造对象而不是被测代码(§22c 那一型的镜像)。现已把预算收进
    `LazyIndexLimits`,这里默认沿用模块常量,overrides 才真正生效。
    """
    local = overrides.get("local_ms", mcp_server._LAZY_INDEX_LOCAL_MS_PER_FILE)
    enum = overrides.get("enum_ms", mcp_server._LAZY_INDEX_ENUM_WORST_MS_PER_FILE)
    chunks = overrides.get("chunks_per_file", mcp_server._LAZY_INDEX_CHUNKS_PER_FILE)
    budget_s = overrides.get("budget_s", mcp_server._LAZY_INDEX_LOCAL_BUDGET_SECONDS)
    batch_budget = int(overrides.get("batch_budget", mcp_server._LAZY_INDEX_EMBED_BATCH_BUDGET))
    batches_per_file = chunks / EMBEDDING_BATCH_SIZE
    return mcp_server.LazyIndexLimits(
        by_local_wall=int(budget_s * 1000 // (local + enum)),
        by_embedding_batches=int(batch_budget // batches_per_file),
        by_index_hard_cap=int(overrides.get("hard_cap", MAX_FILES_PER_INDEX)),
        per_file_ms=local + enum,
        embedding_batches_per_file=batches_per_file,
        local_budget_seconds=budget_s,
        embed_batch_budget=batch_budget,
    )


# ---------------------------------------------------------------------------
# A 组:阈值是三条轴的派生值
# ---------------------------------------------------------------------------


class TestThresholdIsDerived:
    def test_limit_is_min_of_three_axes(self) -> None:
        limits = mcp_server.lazy_index_file_limits(
            index_hard_cap=MAX_FILES_PER_INDEX, embedding_batch_size=EMBEDDING_BATCH_SIZE
        )
        assert limits.max_files == min(
            limits.by_local_wall, limits.by_embedding_batches, limits.by_index_hard_cap
        )

    def test_binding_axis_names_the_smallest_one(self) -> None:
        """binding 必须是**最小那个轴的名字**(阳性对照:三轴不同值,否则这条断言无牙)。"""
        limits = mcp_server.lazy_index_file_limits(
            index_hard_cap=MAX_FILES_PER_INDEX, embedding_batch_size=EMBEDDING_BATCH_SIZE
        )
        assert len({limits.by_local_wall, limits.by_embedding_batches, limits.by_index_hard_cap}) == 3
        axis_value = {
            "local_wall_budget": limits.by_local_wall,
            "embedding_batch_budget": limits.by_embedding_batches,
            "index_hard_cap(MAX_FILES_PER_INDEX)": limits.by_index_hard_cap,
        }[limits.binding_axis]
        assert axis_value == limits.max_files

    def test_index_hard_cap_flows_through_not_copied(self) -> None:
        """索引上限一变,懒索引天花板跟着变(抄字面量就会漂)。"""
        a = mcp_server.lazy_index_file_limits(index_hard_cap=5_000, embedding_batch_size=20)
        b = mcp_server.lazy_index_file_limits(index_hard_cap=500, embedding_batch_size=20)
        assert b.by_index_hard_cap == 500
        assert b.max_files < a.max_files
        assert b.binding_axis == "index_hard_cap(MAX_FILES_PER_INDEX)"

    def test_degenerate_inputs_rejected_not_silently_zero(self) -> None:
        with pytest.raises(ValueError):
            mcp_server.lazy_index_file_limits(index_hard_cap=0, embedding_batch_size=20)
        with pytest.raises(ValueError):
            mcp_server.lazy_index_file_limits(index_hard_cap=10, embedding_batch_size=0)

    def test_budget_is_a_share_of_the_handler_timeout(self) -> None:
        """墙钟预算锚在 `MCP_GLOBAL_TIMEOUT` 上,不是另一个孤立数字。"""
        assert mcp_server._LAZY_INDEX_LOCAL_BUDGET_SECONDS == pytest.approx(
            mcp_server.MCP_GLOBAL_TIMEOUT * mcp_server._LAZY_INDEX_HANDLER_BUDGET_SHARE
        )

    def test_every_cost_constant_is_a_positive_number(self) -> None:
        """四个换算系数必须都是正数。

        为什么钉这一条:任何一个被写成 0,派生阈值就会退化成 0 或"永不 binding" ——
        前者让懒索引永久停用,后者让它永久放行,而两者都**不会报错**。
        """
        for name in (
            "_LAZY_INDEX_LOCAL_MS_PER_FILE",
            "_LAZY_INDEX_ENUM_WORST_MS_PER_FILE",
            "_LAZY_INDEX_CHUNKS_PER_FILE",
            "_LAZY_INDEX_LOCAL_BUDGET_SECONDS",
        ):
            value = float(getattr(mcp_server, name))
            assert value > 0, f"{name}={value} 必须 > 0,否则护栏退化而无人喊"
        assert int(mcp_server._LAZY_INDEX_EMBED_BATCH_BUDGET) > 0

    def test_old_bare_literal_is_gone(self) -> None:
        """旧形态 `_LAZY_INDEX_MAX_FILES = 2000` 不得回来。

        它不是"数值不对",而是**形状不对**:一个孤立整数读不出它守的是什么,
        于是本票之前七年没人能回答"为什么是 2000"。现行阈值是派生值,
        名字也因此换成 `LazyIndexLimits.max_files`。
        """
        assert not hasattr(mcp_server, "_LAZY_INDEX_MAX_FILES")


# ---------------------------------------------------------------------------
# B 组:有界探测的语义(精确 / 下界 / 两通道同形)
# ---------------------------------------------------------------------------


@pytest.fixture()
def small_tree(tmp_path: Path) -> Path:
    root = tmp_path / "tree"
    for i in range(6):
        p = root / f"g{i // 2}" / f"f{i}.py"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"def f{i}():\n    return {i}\n", encoding="utf-8")
    return root


class TestBoundedProbe:
    def test_exact_below_limit(self, small_tree: Path) -> None:
        probe = probe_code_file_count(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), limit=100
        )
        assert probe.count == 6
        assert probe.is_lower_bound is False, "没撞上限却报下界 = 把精确值说虚"
        assert "6 个代码文件" in probe.describe()

    def test_lower_bound_when_saturated(self, small_tree: Path) -> None:
        probe = probe_code_file_count(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), limit=3
        )
        assert probe.count == 3
        assert probe.is_lower_bound is True, "撞上限必须说'至少',不得冒充精确值"
        assert "至少" in probe.describe()

    def test_two_channels_agree_on_the_probe_numbers(self, small_tree: Path) -> None:
        """票面前半的遗产:两条通道对探测**数字**必须同形(精确值/下界的判定也一样)。

        刻意只断言 `count` / `is_lower_bound` / 未截断时的集合相等,**不断言**"撞上限时
        两条通道保留同一批路径" —— 实测不成立(walk 留它到访顺序的前 N 个,rg 留它自己
        的前 N 个,6 文件 / limit 3 时两边交集为空)。这不是本票引入的,而是
        `max_files` 有界枚举的固有形状;所以 `SizeProbe` 只交出数字、不交出路径集。
        该边界已作为残余登记在交付报告里(它影响的是 `MAX_FILES_PER_INDEX` 截断后
        的 Merkle 快照稳定性,归 codebase_indexer 持有者)。
        """
        from app.services import rg_fallback_parity as rgp

        rg_paths, rg_prov = rgp.enumerate_with_rg(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), max_files=3
        )
        walk_paths, walk_prov = rgp.enumerate_with_walk(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), max_files=3
        )
        assert rg_prov.counted == walk_prov.counted == 3, "撞上限时两边计数不等 = 护栏读到的规模会随通道跳变"
        assert rg_prov.engine == ENGINE_RIPGREP and walk_prov.engine == ENGINE_PYTHON_WALK
        # 未截断时两通道必须**集合**相等(这才是 #75 前半立的对账)
        full_rg, _ = rgp.enumerate_with_rg(small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG))
        full_walk, _ = rgp.enumerate_with_walk(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
        )
        assert full_rg == full_walk == {"g0/f0.py", "g0/f1.py", "g1/f2.py", "g1/f3.py", "g2/f4.py", "g2/f5.py"}
        # 有界子集必须是全集的子集(不能凭空多出文件)
        assert rg_paths <= full_rg and walk_paths <= full_walk
        # SizeProbe 走的就是这份实现,数字两通道同形
        for limit, want_count, want_bound in ((100, 6, False), (3, 3, True)):
            probe = probe_code_file_count(
                small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), limit=limit
            )
            assert probe.count == want_count and probe.is_lower_bound is want_bound

    def test_limit_below_one_is_refused(self, small_tree: Path) -> None:
        """limit=0 会让 is_lower_bound 恒真 ⇒ "永远超限"的假判据,必须直接拒。"""
        with pytest.raises(ValueError):
            probe_code_file_count(
                small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), limit=0
            )

    def test_probe_equals_prefix_of_full_enumeration(self, small_tree: Path) -> None:
        """有界探测的集合必须是全量枚举的子集(否则"少看了"被读成"没有")。"""
        full, _ = enumerate_code_files(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), max_files=None
        )
        bounded, _ = enumerate_code_files(
            small_tree, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), max_files=3
        )
        assert set(bounded) <= set(full)
        assert len(bounded) == 3 and len(full) == 6


# ---------------------------------------------------------------------------
# C 组:护栏判定 —— 拒绝必须带 reason
# ---------------------------------------------------------------------------


class TestGuardVerdicts:
    def test_small_tree_is_allowed(self) -> None:
        limits = _limits_with()
        guard = mcp_server.evaluate_lazy_index_guard(_probe(20), limits)
        assert guard.allow is True
        assert guard.status == "searched"
        assert guard.reason is None

    def test_lower_bound_rejects_before_cost_axes(self) -> None:
        """≥ 索引硬上限 ⇒ 先拒(成本轴此刻算不出来,而"半份索引"更坏)。"""
        limits = _limits_with()
        guard = mcp_server.evaluate_lazy_index_guard(
            _probe(limits.max_files, lower_bound=True), limits
        )
        assert guard.allow is False
        assert guard.status == "skipped-over-limit"
        assert guard.files_is_lower_bound is True
        assert guard.reason and "上限" in guard.reason

    def test_empty_dir_is_its_own_status_not_an_over_limit(self) -> None:
        """真·空目录与"被拦下"必须分得开 —— 否则下一次没人敢信这个状态。"""
        guard = mcp_server.evaluate_lazy_index_guard(_probe(0), _limits_with())
        assert guard.allow is False
        assert guard.status == "skipped-no-code-files"
        assert guard.reason and "没有任何可索引的代码文件" in guard.reason

    def test_embedding_batch_axis_rejects_with_numbers(self) -> None:
        within = _max_files_within_batch_budget(20)
        assert mcp_server.evaluate_lazy_index_guard(_probe(within), _limits_with(batch_budget=20)).allow is True, (
            "正控没放行 ⇒ 换算判据在边界上就是错的(或 helper 与生产公式已漂)"
        )
        guard = mcp_server.evaluate_lazy_index_guard(
            _probe(within + 1), _limits_with(batch_budget=20)
        )
        assert guard.allow is False and guard.status == "skipped-over-limit"
        assert "embedding" in (guard.reason or "") and str(guard.predicted_embedding_batches) in (guard.reason or "")

    def test_local_wall_axis_rejects_when_it_is_the_binding_one(self) -> None:
        # 把 embedding 预算放到极大 ⇒ 唯一可能 binding 的是本地墙钟轴
        limits = _limits_with(batch_budget=10**9, budget_s=1.0)
        files = limits.by_local_wall + 1
        assert limits.binding_axis == "local_wall_budget"
        guard = mcp_server.evaluate_lazy_index_guard(_probe(files), limits)
        assert guard.allow is False and guard.status == "skipped-over-limit"
        assert "墙钟" in (guard.reason or "")

    def test_every_rejection_carries_a_reason(self) -> None:
        """性质测试:扫一遍文件数量程,**不存在**"allow=False 且 reason=None"。"""
        for limits in (_limits_with(), _limits_with(batch_budget=20), _limits_with(hard_cap=10)):
            for n in range(0, 60):
                for lb in (False, True):
                    guard = mcp_server.evaluate_lazy_index_guard(_probe(n, lower_bound=lb), limits)
                    if not guard.allow:
                        assert guard.reason, f"静默拒绝(n={n},lb={lb})—— 旧契约那一型"
                    assert guard.status != "empty-after-index"

    def test_prediction_math_matches_reported_numbers(self) -> None:
        limits = _limits_with()
        n = 42
        guard = mcp_server.evaluate_lazy_index_guard(_probe(n), limits)
        assert guard.predicted_local_seconds == pytest.approx(
            round(n * limits.per_file_ms / 1000.0, 3), abs=1e-3
        )
        assert guard.predicted_embedding_batches == math.ceil(n * limits.embedding_batches_per_file)


class TestLazyIndexAndResearchContract:
    """`_lazy_index_and_research` 的返回契约:结果 + 状态 + 理由。"""

    @staticmethod
    def _indexer(results: list[dict[str, Any]] | None = None) -> SimpleNamespace:
        idx = SimpleNamespace()
        idx.index_repository = AsyncMock(return_value=SimpleNamespace(errors=[]))
        idx.search = AsyncMock(return_value=results if results is not None else [])
        return idx

    @pytest.mark.asyncio
    async def test_nonexistent_dir_says_so(self) -> None:
        out = await mcp_server._lazy_index_and_research(self._indexer(), "q", "Z:/no/such/dir", 5)
        assert out.results == []
        assert out.status == "skipped-not-a-dir"
        assert out.reason, "路径不可读也要给理由 —— 旧实现这里 return [] 什么都不说"

    @pytest.mark.asyncio
    async def test_indexes_then_researches(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        (tmp_path / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        idx = self._indexer([{"filePath": "a.py", "score": 0.9}])
        out = await mcp_server._lazy_index_and_research(idx, "query", str(tmp_path), 5)
        assert out.results == [{"filePath": "a.py", "score": 0.9}]
        assert out.status == "searched"
        idx.index_repository.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cooldown_reports_seconds(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        (tmp_path / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        idx = self._indexer([{"filePath": "a.py"}])
        await mcp_server._lazy_index_and_research(idx, "q1", str(tmp_path), 5)
        second = await mcp_server._lazy_index_and_research(idx, "q2", str(tmp_path), 5)
        assert idx.index_repository.await_count == 1, "冷却期内又去索引了"
        assert second.status == "skipped-cooldown" and second.reason

    @pytest.mark.asyncio
    async def test_over_limit_is_explicit_and_indexes_nothing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """超限(结构轴):**不再**是静默 `[]` —— 状态 + 数字 + 出路都要有。"""
        for i in range(6):
            (tmp_path / f"f{i}.py").write_text("pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        # 硬上限设成 3 ⇒ 探测上限 4 ⇒ 真实 6 个文件必然撞下界(构造面,不靠仓库规模)
        monkeypatch.setattr(mcp_server, "lazy_index_file_limits", lambda **_kw: _limits_with(hard_cap=3))
        idx = self._indexer()
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out.results == []
        assert out.status == "skipped-over-limit"
        assert out.reason and out.guard is not None and out.guard.files_is_lower_bound is True
        idx.index_repository.assert_not_awaited()
        field = out.as_response_field()
        assert field["code_files_is_lower_bound"] is True
        assert field["max_files_allowed"] == 3
        assert field["binding_axis"] == "index_hard_cap(MAX_FILES_PER_INDEX)"

    @pytest.mark.asyncio
    async def test_cost_axis_rejection_names_its_own_number(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """成本轴超限与"仓库超过索引上限"必须是**两种可分辨的说法**。

        这一格是防"合并成一个 skipped-too-large"的回归:两种情况的处置动作完全不同
        (前者可以显式 index_codebase 分片建,后者连索引都装不下)。
        """
        for i in range(6):
            (tmp_path / f"c{i}.py").write_text("def x():\n    return 1\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        monkeypatch.setattr(mcp_server, "lazy_index_file_limits", lambda **_kw: _limits_with(batch_budget=1))
        idx = self._indexer()
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out.status == "skipped-over-limit"
        assert out.guard is not None and out.guard.files_is_lower_bound is False
        assert out.guard.files == 6, f"成本轴要用精确值,实得 {out.guard.files}"
        assert "embedding" in (out.reason or "")
        idx.index_repository.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_index_failure_is_not_disguised_as_no_match(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        idx = SimpleNamespace(
            index_repository=AsyncMock(side_effect=RuntimeError("embed down")),
            search=AsyncMock(return_value=[]),
        )
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out.status == "failed"
        assert out.reason and "embed down" in out.reason, "异常内容必须能追溯,不得咽下"
        assert out.status != "empty-after-index", "建索引失败 ≠ 索引里没有"

    @pytest.mark.asyncio
    async def test_empty_after_real_index_says_it_indexed(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        out = await mcp_server._lazy_index_and_research(self._indexer([]), "q", str(tmp_path), 5)
        assert out.status == "empty-after-index"
        assert out.results == []
        assert out.reason and "索引" in out.reason

    @pytest.mark.asyncio
    async def test_denominator_is_not_the_saturated_list_len(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """本票的核心那一格:护栏**不得**再读被 MAX_FILES_PER_INDEX 截断的计数。

        判据:把 `indexer._collect_code_files` 换成一个"恒返回 5000 项"的假出口,
        而真实目录只有 1 个文件 —— 旧实现会算出 5000 > 2000 而拒绝,新实现看的是
        真实规模 ⇒ 必须放行。这是一条**反向对照**:它红了不代表代码坏,
        代表有人把饱和分母又接回来了。
        """
        (tmp_path / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        idx = self._indexer([{"filePath": "a.py"}])
        idx._collect_code_files = lambda _root: [("x.py", "python")] * MAX_FILES_PER_INDEX  # type: ignore[method-assign]
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out.status == "searched", f"护栏又读了饱和分母:{out.status} / {out.reason}"
        idx.index_repository.assert_awaited_once()


# ---------------------------------------------------------------------------
# D 组:工具面 —— 降级标记要回到 LLM 读得到的地方
# ---------------------------------------------------------------------------


class TestToolSurfaceSurfacesTheReason:
    @pytest.mark.asyncio
    async def test_regex_fallback_carries_semantic_index_field(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """语义通道空 + 懒索引被护栏拦下 ⇒ 响应体必须带 status/reason。

        只打在日志里不算交付:模型读不到日志,而它正是那个会得出
        "这个仓库里没有答案"结论的消费者。
        """
        (tmp_path / "widget.py").write_text("def widget():\n    return 1\n", encoding="utf-8")
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        # batch 预算 0 ⇒ 任何仓库都算"超出这次该付的上游调用数"(纯构造档,不改生产常量)
        monkeypatch.setattr(mcp_server, "lazy_index_file_limits", lambda **_kw: _limits_with(batch_budget=0))
        fake = SimpleNamespace(
            search=AsyncMock(return_value=[]),
            index_repository=AsyncMock(),
        )
        with patch("app.services.codebase_indexer.codebase_indexer", fake):
            out = await mcp_server._tool_search_codebase(
                {"query": "widget", "path": str(tmp_path), "max_results": 5}
            )
        assert out["ok"] is True, "正则通道照常给答案"
        assert any("widget" in m["path"] for m in out["matches"]), out["matches"]
        assert fake.index_repository.await_count == 0, "超限却仍去索引 = 阈值没生效"
        field = out["semantic_index"]
        assert field["status"] == "skipped-over-limit"
        assert field["reason"] and field["code_files"] == 1

    @pytest.mark.asyncio
    async def test_semantic_hit_leaves_the_field_absent_when_no_lazy_run(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """语义通道**直接命中**时不该有懒索引记录(不得凭空造一格)。"""
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        fake = SimpleNamespace(search=AsyncMock(return_value=[{"filePath": "x.py", "score": 0.4}]))
        with patch("app.services.codebase_indexer.codebase_indexer", fake):
            out = await mcp_server._tool_search_codebase(
                {"query": "anything", "path": str(tmp_path), "max_results": 3}
            )
        assert out["use_semantic"] is True and out["total"] == 1
        assert out["semantic_index"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
