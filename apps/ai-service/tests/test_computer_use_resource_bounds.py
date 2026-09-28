# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""computer-use 会话表的三条资源边界(G-258 后续票,2026-09-27)。

病灶(上一票改完按用户隔离之后如实登记的三格):
  ① 进程退出没有任何收口 —— `_close_page` 除本模块 `POST /close` 外全仓零调用点,
     旧 docstring 那句"由 main.py lifespan 统一收口"是假出路;改前漏一只、改后按
     活跃用户数漏 N 只。
  ② 表没有并发上界 —— 活跃用户数 = Chromium 进程数,且此前无人计量。
  ③ 表没有空闲回收 —— 唯一收缩路径是用户自己点 close。

本文件按**内存会话表 + 替身对象**判行为,一条真 Chromium 都不起,一个生产连接都不发
(AGENTS §5 测试隔离铁律)。三条反向锁:
  · 数值出处对账:1800s / 8 只必须仍等于被引用那两行原文的字面值 —— 出处漂了本文件
    必须红(注释写了出处而依据已失效,比没写出处更糟);
  · 唯一关闭路径:退出收口必须走 `_close_page`,不得另写一套;
  · main.py 挂点:`close_all_sessions()` 必须出现在 lifespan 的 **yield 之后**
    (装在 yield 之前 = 每次开机就清表、退出时照样漏)。

两条变异对照(判据有牙的证明):
  ① 摘掉 `close_all_sessions` 的逐只 try ⇒ `test_close_all_sessions_isolates_failure_and_keeps_others` 红;
  ② 把回收判据从"空闲超阈"改成"一律回收" ⇒ `test_reclaim_keeps_active_session` 红。
"""

from __future__ import annotations

import logging
import re
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import computer_use as cu

AI_SERVICE = Path(__file__).resolve().parents[1]
MAIN_SRC = (AI_SERVICE / "app" / "main.py").read_text(encoding="utf-8")

# 数值出处的原文行(不是本文件的转述):漂了就要重新取证,不许让注释替假账背书
PROVENANCE_IDLE = (AI_SERVICE / "app" / "routers" / "agent_runtime.py", "_SESSION_TTL_SEC")
PROVENANCE_CAP = (AI_SERVICE / "app" / "services" / "agent_engine.py", "_MAX_EXEC_SESSIONS")

LOGGER_NAME = "app.routers.computer_use"


# ---------------------------------------------------------------------------
# 替身:全部不起真浏览器,只记录"有没有被关过"
# ---------------------------------------------------------------------------


class FakePage:
    def __init__(self, owner: str) -> None:
        self.owner = owner
        self.url = f"http://{owner}.test/"
        self.closed = 0
        self.raise_on_close = False

    def is_closed(self) -> bool:
        return False

    async def close(self) -> None:
        if self.raise_on_close:
            raise RuntimeError(f"page of {self.owner} 拒关")
        self.closed += 1

    async def goto(self, url: str, timeout: int = 0, wait_until: str = "") -> None:
        self.url = url

    async def title(self) -> str:
        return f"{self.owner} page"


class FakeClosable:
    """playwright/browser/context 三件的替身,只统计 close 次数。"""

    def __init__(self, tag: str) -> None:
        self.tag = tag
        self.closed = 0

    async def close(self) -> None:
        self.closed += 1


class _StubLock:
    """替身锁。mode="raise":`_close_page` 取锁即抛;mode="held":看起来正被别人持有。"""

    def __init__(self, mode: str) -> None:
        self.mode = mode

    def locked(self) -> bool:
        return self.mode == "held"

    async def __aenter__(self) -> Any:
        if self.mode == "raise":
            raise RuntimeError("这把锁拿不到(模拟 Playwright 侧挂死)")
        raise AssertionError("空闲回收不得去等一把被占的锁")

    async def __aexit__(self, *exc: Any) -> None:
        return None


def _install(user_id: str, *, live: bool = True, idle_seconds: float = 0.0) -> cu._UserBrowser:
    """放一条该用户的会话进表;`live=False` 是"只 /trace/start 过、从没 open"的裸条目。"""
    sess = cu._UserBrowser(user_id)
    if live:
        sess.page = FakePage(user_id)
        sess.playwright = FakeClosable("playwright")
        sess.browser = FakeClosable("browser")
        sess.context = FakeClosable("context")
    sess.last_access = time.monotonic() - idle_seconds
    cu._sessions[user_id] = sess
    return sess


def _refs(sess: cu._UserBrowser) -> dict[str, Any]:
    """在关闭之前把替身对象抓在手里:`_close_page` 会把会话上的字段清成 None。"""
    return {
        "page": sess.page,
        "playwright": sess.playwright,
        "browser": sess.browser,
        "context": sess.context,
    }


def _closed_count(refs: dict[str, Any], key: str) -> int:
    obj = refs[key]
    return 0 if obj is None else int(obj.closed)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    """每条用例一张空会话表。本票判的全是进程内状态:不碰 db_pool、不碰 Redis、不落 data/。"""
    monkeypatch.setattr(cu, "_sessions", {})


@pytest.fixture
def launch_spy(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """把 `_start_browser` 换成替身:记录谁真的起了浏览器,一次 launch 都不发。"""
    started: list[str] = []

    async def _fake_start(sess: cu._UserBrowser) -> FakePage:
        started.append(sess.user_id)
        page = FakePage(sess.user_id)
        sess.page = page
        sess.playwright = FakeClosable("playwright")
        sess.browser = FakeClosable("browser")
        sess.context = FakeClosable("context")
        return page

    monkeypatch.setattr(cu, "_start_browser", _fake_start)
    return started


# ===========================================================================
# 0. 数值出处对账(注释引了出处,就得让机器盯着那两行原文)
# ===========================================================================


def test_bounds_match_their_cited_sources() -> None:
    """1800s 与 8 都必须仍等于被引用文件里那一行的字面值。"""
    pairs = (
        (PROVENANCE_IDLE, cu._IDLE_TTL_SECONDS),
        (PROVENANCE_CAP, cu._MAX_LIVE_BROWSERS),
    )
    for (path, name), value in pairs:
        src = path.read_text(encoding="utf-8")
        found = re.search(rf"^{name}\s*[:=][^0-9]*([0-9]+(?:\.[0-9]+)?)", src, re.M)
        assert found, (
            f"出处 {path.name}::{name} 已不在 ⇒ computer_use 的 {value} 失去依据,必须重新取证"
        )
        assert float(found.group(1)) == float(value), (
            f"{path.name}::{name}={found.group(1)} 与 computer_use 的 {value} 不等 ⇒ 有一边是抄来的"
        )


# ===========================================================================
# 1. 退出收口:逐个关 + 异常隔离 + 不吞异常
# ===========================================================================


async def test_close_all_sessions_closes_every_user_browser() -> None:
    alice, bob = _install("alice"), _install("bob")
    _install("carol", live=False)
    a_refs, b_refs = _refs(alice), _refs(bob)

    result = await cu.close_all_sessions()

    assert result == {"closed": 3, "failed": 0}
    for user_id, refs in (("alice", a_refs), ("bob", b_refs)):
        for key in ("page", "playwright", "browser", "context"):
            assert _closed_count(refs, key) == 1, f"{user_id} 的 {key} 没被关"
    # 表必须清空(裸条目也一并摘掉)—— 不留"退出之后表里还有人"的半死态
    assert cu._sessions == {}
    assert alice.page is None and alice.browser is None


async def test_close_all_sessions_isolates_failure_and_keeps_others(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """某一只关不掉必须继续关其余的,并且喊出来(§5e 失败必须响,禁止 except: pass)。

    变异对照①:摘掉这一格 try ⇒ 第一只抛错就断循环,alice/bob 的 closed 恒为 0 ⇒ 本用例红。
    """
    boom = _install("mallory")
    boom.lock = _StubLock("raise")  # _close_page 在 `async with sess.lock` 处抛出
    alice, bob = _install("alice"), _install("bob")
    a_refs, b_refs = _refs(alice), _refs(bob)

    with caplog.at_level(logging.ERROR, logger=LOGGER_NAME):
        result = await cu.close_all_sessions()

    assert result == {"closed": 2, "failed": 1}
    assert _closed_count(a_refs, "page") == 1 and _closed_count(b_refs, "page") == 1, (
        "一只失败不得让其余逃过收口"
    )
    assert cu._sessions.get("mallory") is boom, "关不掉的条目不能被假装已经关了"
    joined = "\n".join(r.getMessage() for r in caplog.records)
    assert "mallory" in joined and "退出收口" in joined, f"失败没有点名是哪一只: {joined!r}"


async def test_close_all_sessions_survives_component_raising(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """另一型"关不掉":页面对象自己抛。`_close_page` 按组件隔离 ⇒ 其余组件仍关、条目仍摘。"""
    sick = _install("alice")
    assert sick.page is not None
    sick.page.raise_on_close = True
    sick_refs = _refs(sick)
    bob = _install("bob")
    b_refs = _refs(bob)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        result = await cu.close_all_sessions()

    assert result == {"closed": 2, "failed": 0}
    for key in ("playwright", "browser", "context"):
        assert _closed_count(sick_refs, key) == 1, f"页面抛错后 {key} 就不关了 ⇒ 泄漏还在"
    assert _closed_count(b_refs, "page") == 1
    assert cu._sessions == {}, "组件抛错不能把条目留在表里(那才是真正会漏进程的那一型)"
    assert any("关闭浏览器组件失败" in r.getMessage() for r in caplog.records)


async def test_close_all_sessions_goes_through_the_single_close_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """退出收口不得自带第二套关闭实现 —— 必须逐用户走 `_close_page`。"""
    _install("alice")
    _install("bob")
    seen: list[str] = []

    async def _spy(user_id: str) -> None:
        seen.append(user_id)

    monkeypatch.setattr(cu, "_close_page", _spy)
    await cu.close_all_sessions()
    assert sorted(seen) == ["alice", "bob"]


async def test_close_all_sessions_on_empty_table_is_a_noop() -> None:
    assert await cu.close_all_sessions() == {"closed": 0, "failed": 0}


# ===========================================================================
# 2. 空闲回收:只收陈旧者;挂点是惰性的;忙者与启动中一律不收
# ===========================================================================


async def test_reclaim_keeps_active_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """回收判据是"空闲超阈",不是"表里有就收"。

    变异对照②:把判据改成一律回收 ⇒ fresh 的那只也会 closed=1、bob 被摘出表 ⇒ 本用例红。
    """
    stale = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    fresh = _install("bob", idle_seconds=1.0)
    stale_refs, fresh_refs = _refs(stale), _refs(fresh)
    monkeypatch.setattr(cu, "_MAX_LIVE_BROWSERS", 99)

    reclaimed = await cu._reclaim_idle_browsers()

    assert reclaimed == 1
    assert _closed_count(stale_refs, "page") == 1 and "alice" not in cu._sessions
    assert _closed_count(fresh_refs, "page") == 0, "用户正在用的那只浏览器不能被空闲判据拿走"
    assert "bob" in cu._sessions


async def test_reclaim_skips_session_whose_lock_is_held() -> None:
    """正在跑操作的会话按定义不空闲;回收也不得去等那把锁(否则持锁者自己卡住)。"""
    busy = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    busy.lock = _StubLock("held")

    reclaimed = await cu._reclaim_idle_browsers()

    assert reclaimed == 0, "锁被占的会话不得进回收清单(等一把别人手里的锁 = 自锁)"
    assert "alice" in cu._sessions


async def test_reclaim_skips_session_that_is_starting() -> None:
    starting = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    starting.starting = True

    assert await cu._reclaim_idle_browsers() == 0
    assert "alice" in cu._sessions


async def test_reclaim_touches_last_access_on_use() -> None:
    """经 `_require_session` 的一次操作必须续上 last_access —— 否则活跃用户会被自己踢掉。"""
    sess = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    before = sess.last_access

    cu._require_session("alice")

    assert sess.last_access > before
    assert await cu._reclaim_idle_browsers() == 0


async def test_reclaim_is_wired_before_a_new_browser(launch_spy: list[str]) -> None:
    """挂点证明:回收不是"函数存在而无人调",而是新浏览器起来之前真跑过一次。"""
    stale = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    stale_refs = _refs(stale)

    await cu._ensure_page("zoe")

    assert launch_spy == ["zoe"]
    assert _closed_count(stale_refs, "page") == 1, "回收没挂进新建路径 ⇒ 只是把数字写进了注释"
    assert "alice" not in cu._sessions and "zoe" in cu._sessions


async def test_open_endpoint_also_pays_the_idle_reclaim(launch_spy: list[str]) -> None:
    """同一件事从 HTTP 面再走一遍(端点那一侧才是用户看得见的)。"""
    stale = _install("alice", idle_seconds=cu._IDLE_TTL_SECONDS + 1)
    stale_refs = _refs(stale)
    app = FastAPI()
    app.include_router(cu.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "zoe"

    r = TestClient(app).post("/api/computer-use/open", json={"url": "http://example.com/"})

    assert r.status_code == 200, r.text
    assert _closed_count(stale_refs, "page") == 1 and launch_spy == ["zoe"]


# ===========================================================================
# 3. 并发上界:占满即拒(不踢别人);裸条目不占名额;失败要还占位
# ===========================================================================


async def test_cap_blocks_the_next_browser_without_touching_others(
    launch_spy: list[str],
) -> None:
    """满了就 503,并断言**副作用没发生**:没人被替关、launch 一次都没发生。"""
    live = [_install(f"user{i}") for i in range(cu._MAX_LIVE_BROWSERS)]

    with pytest.raises(HTTPException) as exc:
        await cu._ensure_page("zoe")

    assert exc.value.status_code == 503
    assert str(cu._MAX_LIVE_BROWSERS) in str(exc.value.detail)
    assert launch_spy == [], "上界挡住的那次必须根本没起浏览器,而不是起了之后再想办法收拾"
    for sess in live:
        assert sess.page.closed == 0, "为腾名额去关别人的浏览器 = 跨用户 DoS,上一票刚修掉它"
    assert cu._sessions["zoe"].starting is False, "被拒绝的请求不能留下占位"


async def test_cap_leaves_room_for_the_last_slot(launch_spy: list[str]) -> None:
    """正向对照:上一条挡住,这一条必须恰好放进来(否则上界是张死表)。"""
    for i in range(cu._MAX_LIVE_BROWSERS - 1):
        _install(f"user{i}")

    await cu._ensure_page("zoe")

    assert launch_spy == ["zoe"]
    assert cu._live_browser_count() == cu._MAX_LIVE_BROWSERS


async def test_bare_trace_entries_do_not_consume_browser_slots(
    launch_spy: list[str],
) -> None:
    """上界数的是**浏览器**而不是条目数:/trace/start 建的裸条目不得挤占名额。"""
    for i in range(cu._MAX_LIVE_BROWSERS):
        _install(f"user{i}", live=False)

    await cu._ensure_page("zoe")

    assert launch_spy == ["zoe"]


async def test_starting_session_counts_toward_the_cap(launch_spy: list[str]) -> None:
    """占位(starting)也算一个名额 —— 否则两个并发首开能一起通过计数、把上界顶穿。"""
    for i in range(cu._MAX_LIVE_BROWSERS - 1):
        _install(f"user{i}")
    pending = _install("pending", live=False)
    pending.starting = True

    with pytest.raises(HTTPException) as exc:
        await cu._ensure_page("zoe")

    assert exc.value.status_code == 503
    assert launch_spy == []


async def test_failed_launch_releases_its_slot(
    launch_spy: list[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """启动失败必须把占位还回去 —— 否则一次 Playwright 报错永久吃掉一个名额。"""
    boom = _install("alice", live=False)

    async def _explode(sess: cu._UserBrowser) -> Any:
        launch_spy.append(sess.user_id)
        raise RuntimeError("Chromium 起不来")

    monkeypatch.setattr(cu, "_start_browser", _explode)
    with pytest.raises(RuntimeError):
        await cu._ensure_page(boom.user_id)

    assert boom.starting is False
    assert cu._live_browser_count() == 0


# ===========================================================================
# 4. main.py 挂点(静态判据:必须在 lifespan 的 yield 之后)
# ===========================================================================


def test_main_lifespan_shuts_computer_use_after_yield() -> None:
    """收口写在 yield **之前**等于每次开机清表、退出时照样漏 —— 所以判据是位置不是存在。"""
    fn = re.search(r"^async def lifespan\(.*?\n(?=\S)", MAIN_SRC, re.M | re.S)
    assert fn, "main.py 里找不到 lifespan ⇒ 本判据的前提变了,得重新取证"
    body = fn.group(0)
    yields = [m.start() for m in re.finditer(r"^[ \t]+yield[ \t]*$", body, re.M)]
    assert len(yields) == 1, f"lifespan 的 yield 形态变了({len(yields)} 处)⇒ 挂点判据不再成立"
    calls = [m.start() for m in re.finditer(r"await close_all_sessions\(\)", body)]
    assert calls, "computer_use 的退出收口没接进 lifespan ⇒ 假出路回来了"
    assert all(pos > yields[0] for pos in calls), "close_all_sessions 出现在 yield 之前"
    assert "from app.routers.computer_use import close_all_sessions" in body
