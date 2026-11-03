# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""同仓索引租约层的行为钉(逆向复现超越,对齐 T9 §4.2-5 的 startSync/refreshLock/endSync)。

判的是四条会静默失效的方向:①同仓并发只许跑一轮;②并进去的那轮必须在响应上留名;
③等过窗口是"本轮未开工"而不是"没东西可索引"(§0.3);④跑完即摘 ⇒ 不存在拿到陈旧结果的通道。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.services import codebase_indexer as ci


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")
    (tmp_path / "snaps").mkdir()
    ci._INDEX_LEASES.clear()
    yield
    ci._INDEX_LEASES.clear()


def _repo(tmp_path):
    (tmp_path / "src").mkdir(exist_ok=True)
    (tmp_path / "src" / "a.ts").write_text("export const a = 1\n", encoding="utf-8")
    return tmp_path


def _fake_run(counter: list[int], delay: float) -> AsyncMock:
    async def _slow(*_a, **_kw):
        counter.append(1)
        await asyncio.sleep(delay)
        res = ci.IndexResult(repo_id="repo-x", files_scanned=7, files_indexed=5)
        res.merkle_root = "root-of-that-run"
        return res

    return AsyncMock(side_effect=_slow)


@pytest.mark.asyncio
async def test_two_concurrent_calls_on_same_repo_run_the_work_once(tmp_path):
    root = _repo(tmp_path)
    idx = ci.CodebaseIndexer()
    counter: list[int] = []
    idx._index_repository_unleased = _fake_run(counter, 0.05)

    first, second = await asyncio.gather(
        idx.index_repository(str(root), "repo-x"),
        idx.index_repository(str(root), "repo-x"),
    )
    assert len(counter) == 1, "同仓并发必须并到一轮,两轮就是两份真金白银的 embedding"
    states = {first.lock_state, second.lock_state}
    assert states == {ci.INDEX_LEASE_ACQUIRED, ci.INDEX_LEASE_COALESCED}
    assert second.files_indexed == first.files_indexed == 5
    assert any("并入了先起跑" in e for e in second.errors), "并进去的那轮要在响应上留名"


@pytest.mark.asyncio
async def test_lease_is_released_after_completion_so_next_run_actually_runs(tmp_path):
    root = _repo(tmp_path)
    idx = ci.CodebaseIndexer()
    counter: list[int] = []
    idx._index_repository_unleased = _fake_run(counter, 0.0)

    await idx.index_repository(str(root), "repo-x")
    assert ci._INDEX_LEASES == {}, "跑完必须摘牌,否则下一轮会被并进陈旧结果"
    await idx.index_repository(str(root), "repo-x")
    assert len(counter) == 2, " sequential 两次调用必须各跑一轮(本层不做结果缓存)"


@pytest.mark.asyncio
async def test_over_window_refuses_loudly_instead_of_reporting_zero_as_done(tmp_path, monkeypatch):
    root = _repo(tmp_path)
    idx = ci.CodebaseIndexer()
    counter: list[int] = []
    monkeypatch.setattr(ci, "_lease_wait_seconds", lambda: 0.01)
    idx._index_repository_unleased = _fake_run(counter, 0.3)

    holder = asyncio.create_task(idx.index_repository(str(root), "repo-x"))
    await asyncio.sleep(0.0)
    refused = await idx.index_repository(str(root), "repo-x")
    done = await holder

    assert refused.lock_state == ci.INDEX_LEASE_OVER_WINDOW
    assert refused.files_indexed == 0
    assert any("不得读成" in e for e in refused.errors), "取不到结果时必须点名「本轮未开工」"
    assert done.lock_state == ci.INDEX_LEASE_ACQUIRED
    assert len(counter) == 1, "被挡住的那轮结构上没动过工"


@pytest.mark.asyncio
async def test_different_repo_ids_do_not_share_one_lease(tmp_path):
    root = _repo(tmp_path)
    idx = ci.CodebaseIndexer()
    counter: list[int] = []
    idx._index_repository_unleased = _fake_run(counter, 0.05)

    await asyncio.gather(
        idx.index_repository(str(root), "repo-a"),
        idx.index_repository(str(root), "repo-b"),
    )
    assert len(counter) == 2, "不同仓互不合并,否则是在给别人的仓替工"


def test_lease_states_are_single_sourced():
    assert ci.INDEX_LEASE_STATES == (
        ci.INDEX_LEASE_ACQUIRED,
        ci.INDEX_LEASE_COALESCED,
        ci.INDEX_LEASE_OVER_WINDOW,
    )


@pytest.mark.asyncio
async def test_concurrent_snapshot_writes_never_produce_a_mixed_blob(tmp_path):
    """并发写快照落地必须是**某一次完整写**,不能是两轮互相咬出来的混合体。

    旧写法用固定的 `*.json.tmp` 名(同仓两轮同名),这一档就是它可能造成的后果:
    坏档在自证档之前还会被安静读成"上轮真相"。不靠改标准库,直接量结果形状。
    """
    idx = ci.CodebaseIndexer()
    contents = [{f"f{i}.ts": f"h{i}"} for i in range(8)]
    await asyncio.gather(*[asyncio.to_thread(idx._save_snapshot, "repo-x", tmp_path, c) for c in contents])

    read = idx._load_snapshot_read("repo-x", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_OK, f"并发写咬出了坏档:{read.detail}"
    assert read.files in contents, "落地内容必须是某一次完整写,不是两次写的拼接"
    assert list((tmp_path / "snaps").glob("*.tmp")) == [], "临时件不得残留"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
