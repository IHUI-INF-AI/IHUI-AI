# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外层键封顶:项目百科缓存与团队任务板(2026-11-01 安全强化同族第 6 批)。

两处同一形态:**内层有上限,外层键没人管**。
- `repo_wiki_engine._WIKI_CACHE`:60s TTL 只在"重读同一个 ns"时才判 ⇒ 从没被再读的条目永生;
  ns 取工作区路径,值是整份项目百科文本。
- `mcp_server._TEAM_TASK_BOARD`:每队 ≤500 条任务,但**队数无上限**,而 team_id 由工具入参决定
  ⇒ 外层无界 × 内层封顶 = 可放大的内存面。
逐出次序按"最没用的先走"(空表 → 闲置超 24h → 插入序最旧),且**只在越限时动手** ——
越限之前行为一字不变,免得把在跑的团队任务当垃圾扫掉。
"""

from __future__ import annotations

import time

import pytest

from app.services import mcp_server, repo_wiki_engine as wiki


# ------------------------------------------------------------------ 项目百科缓存


@pytest.fixture(autouse=True)
def _clean():
    wiki._WIKI_CACHE.clear()
    mcp_server._TEAM_TASK_BOARD.clear()
    yield
    wiki._WIKI_CACHE.clear()
    mcp_server._TEAM_TASK_BOARD.clear()


def test_wiki_cache_under_cap_keeps_everything() -> None:
    """正向对照:没越上限时不得顺手逐出(封顶不是提前清理)。"""
    now = [1000.0]
    wiki._now = lambda: now[0]  # type: ignore[assignment]
    for i in range(3):
        wiki._remember_wiki(f"ns-{i}", {"ts": now[0], "text": "t", "files": {}})
    assert len(wiki._WIKI_CACHE) == 3
    assert wiki.wiki_cache_evictions == 0


def test_wiki_cache_sweeps_expired_on_write() -> None:
    """过期条目在写入时被扫掉,而不是等下一次"恰好重读同一 ns"。"""
    now = [1000.0]
    wiki._now = lambda: now[0]  # type: ignore[assignment]
    wiki._remember_wiki("old", {"ts": now[0], "text": "x", "files": {}})
    now[0] += wiki._WIKI_TTL_SECONDS + 10
    wiki._remember_wiki("new", {"ts": now[0], "text": "y", "files": {}})
    assert "old" not in wiki._WIKI_CACHE, "TTL 只在重读时判 = 从没再读的条目永生"
    assert wiki.wiki_cache_evictions >= 1


def test_wiki_cache_outer_key_cap_is_enforced(monkeypatch) -> None:
    monkeypatch.setattr(wiki, "_WIKI_CACHE_MAX_NAMESPACES", 4)
    now = [0.0]
    wiki._now = lambda: now[0]  # type: ignore[assignment]
    for i in range(30):
        now[0] = float(i) * 0.001  # 都在 TTL 内,只能靠键数封顶
        wiki._remember_wiki(f"ns-{i}", {"ts": now[0], "text": "t", "files": {}})
    assert len(wiki._WIKI_CACHE) <= 4


# ------------------------------------------------------------------ 团队任务板


def test_team_board_below_cap_does_not_evict() -> None:
    """正向对照:在跑的板子不能被"预防性清理"扫掉。"""
    for i in range(3):
        mcp_server._team_task_board(f"team-{i}")["t"] = {"title": "x"}
    mcp_server._prune_team_boards()
    assert len(mcp_server._TEAM_TASK_BOARD) == 3


def test_team_board_evicts_empty_and_idle_before_live(monkeypatch) -> None:
    monkeypatch.setattr(mcp_server, "_TEAM_BOARD_MAX_TEAMS", 3)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000+00:00", time.gmtime())
    old_iso = time.strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00",
        time.gmtime(time.time() - mcp_server._TEAM_BOARD_IDLE_SECONDS - 60),
    )
    mcp_server._TEAM_TASK_BOARD.clear()
    mcp_server._TEAM_TASK_BOARD["empty"] = {}
    mcp_server._TEAM_TASK_BOARD["idle"] = {"a": {"createdAt": old_iso, "updatedAt": old_iso}}
    mcp_server._TEAM_TASK_BOARD["live"] = {"a": {"createdAt": now_iso, "updatedAt": now_iso}}
    mcp_server._TEAM_TASK_BOARD["live2"] = {"a": {"createdAt": now_iso}}
    assert len(mcp_server._TEAM_TASK_BOARD) == 4

    mcp_server._prune_team_boards()

    assert "live" in mcp_server._TEAM_TASK_BOARD, "有新鲜条目的板子必须留下"
    assert "live2" in mcp_server._TEAM_TASK_BOARD
    assert "empty" not in mcp_server._TEAM_TASK_BOARD, "空表应最先被逐出"
    assert "idle" not in mcp_server._TEAM_TASK_BOARD, "闲置超 24h 的表应被逐出"
    assert mcp_server.team_board_evictions >= 1


def test_team_board_freshness_tolerates_z_suffix_and_junk() -> None:
    """时间解析失败不得抛,更不得因此把有内容的板子判成"最该逐出"。"""
    assert mcp_server._team_board_freshness({"t": {"updatedAt": "2026-01-01T00:00:00Z"}}) > 0
    assert mcp_server._team_board_freshness({"t": {"updatedAt": "不是时间"}}) == 0.0
    assert mcp_server._team_board_freshness({}) == 0.0


def test_team_board_entrypoint_actually_prunes(monkeypatch) -> None:
    """行为锁:必须经由**取表入口**触发逐出,而不是只有 `_prune_team_boards` 能扫。

    这条专门防"封顶写了但被同名旧定义遮蔽"那型(mypy 的 no-redef 抓到过一次:
    我在常量区加了带 prune 的定义,而文件里原有一份同名函数在后面把它覆盖了 ——
    只测 `_prune_team_boards` 的断言对那种遮蔽完全无感,照样绿)。
    """
    monkeypatch.setattr(mcp_server, "_TEAM_BOARD_MAX_TEAMS", 2)
    for i in range(6):
        mcp_server._team_task_board(f"team-{i}")
    assert len(mcp_server._TEAM_TASK_BOARD) <= 2, (
        "取表入口没走逐出 ⇒ 外层封顶形同虚设(或被同名旧定义遮蔽)"
    )


def test_team_add_still_enforces_inner_limit(monkeypatch) -> None:
    """内层 500 上限的既有语义未被本枚改动(封顶只在越限时动外层)。"""
    monkeypatch.setattr(mcp_server, "_TEAM_TASK_BOARD_LIMIT", 1)
    board = mcp_server._team_task_board("team-inner")
    assert board is mcp_server._TEAM_TASK_BOARD["team-inner"]
    board["one"] = {"title": "a"}
    out = mcp_server._team_task_add("team-inner", "second")
    assert out.get("errorCode") == "BOARD_FULL"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
