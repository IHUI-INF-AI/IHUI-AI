# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""computer-use 的按用户隔离 + browser-trace 的属主过滤(G-258 B 组第二票,2026-09-27)。

病灶实测口径来自 ast 普查(`scripts/audit_principal_consumed.py`):`app/routers/computer_use.py`
13 个端点全部 `Depends(get_current_user_id)` 拿到身份却**一次都没用它**,而这个模块的
状态是**进程级单例** —— 六枚模块全局(`_playwright/_browser/_context/_page/
_last_snapshot/_recording_trace_id`)被全体用户共用同一只 headless Chromium 页面。
于是:`click`/`type` 是在别人的浏览器里替别人按键/输密码,`screenshot`/`snapshot` 是
看别人的页面,`close` 关掉的是全站唯一那只浏览器(跨用户 DoS),`/replay` 用别人的
trace 在别人页面上重放,`/trace*` 列/取/删的是所有人的操作流水(trace 里含每步
target/params 与失败截图)。

本文件按**内存会话表 + 替身页面**判行为,一条真 Chromium 都不起(那属端到端一票),
外加三条源码级反向锁:
  · 「六枚模块全局不得回来」(病灶本身就是它们);
  · 「归属谓词只许有一份」(必须与 browser_hub 是同一个函数对象);
  · 「13 个端点都要把身份喂进归属过滤」(尺子中列出的那 13 处)。

越权用例一律断言**副作用没发生**(别人的 page 没被 close/click、别人的目录没落文件、
别人的 trace 步数没变),只断言错误码会放过"先改了再抛错"那种写法。
"""

from __future__ import annotations

import asyncio
import inspect
import json
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import computer_use as cu
from app.services import browser_hub as bh
from app.services import browser_trace as bt

AI_SERVICE = Path(__file__).resolve().parents[1]
COMPUTER_USE_SRC = (AI_SERVICE / "app" / "routers" / "computer_use.py").read_text(encoding="utf-8")

# 工单点名的 13 个端点(handler 名 = 尺子逐条列出的那 13 行)
THIRTEEN_ENDPOINTS = (
    "computer_use_open",
    "computer_use_snapshot",
    "computer_use_click",
    "computer_use_type",
    "computer_use_screenshot",
    "computer_use_extract_text",
    "computer_use_close",
    "computer_use_trace_start",
    "computer_use_trace_stop",
    "computer_use_trace_list",
    "computer_use_trace_detail",
    "computer_use_trace_delete",
    "computer_use_replay",
)


# ---------------------------------------------------------------------------
# 替身:页面 / Playwright 对象(全部不起真浏览器)
# ---------------------------------------------------------------------------


class FakePage:
    """可记录调用的假 Page:`_ensure_page` 见它非 None 且未关闭即复用,不 launch。"""

    def __init__(self, owner: str) -> None:
        self.owner = owner
        self.url = f"http://{owner}.test/"
        self.clicked: list[str] = []
        self.typed: list[str] = []
        self.closed = 0
        self.last_snapshot: list[dict[str, Any]] = []

    def is_closed(self) -> bool:
        return False

    async def close(self) -> None:
        self.closed += 1

    async def goto(self, url: str, timeout: int = 0, wait_until: str = "") -> None:
        self.url = url

    async def title(self) -> str:
        return f"{self.owner} page"

    async def click(self, selector: str) -> None:
        self.clicked.append(selector)

    async def mouse_click(self, x: int, y: int) -> None:  # pragma: no cover - 未用
        self.clicked.append(f"@{x},{y}")

    async def eval_on_selector_all(self, selector: str, script: str) -> list[dict[str, Any]]:
        return self.last_snapshot

    async def screenshot(self, full_page: bool = False, type: str = "png") -> bytes:
        return b"\x89PNG" + self.owner.encode()

    async def viewport_size(self) -> dict[str, int]:
        return {"width": 1280, "height": 800}

    async def evaluate(self, script: str) -> str:
        return f"body of {self.owner}"


class FakeLocator:
    def __init__(self, page: FakePage) -> None:
        self._page = page

    @property
    def first(self) -> FakeLocator:
        return self

    async def click(self) -> None:
        self._page.clicked.append("locator-click")

    async def fill(self, value: str) -> None:  # pragma: no cover - clear 分支
        pass

    async def type(self, text: str, delay: int = 0) -> None:
        self._page.typed.append(text)


class FakeMouse:
    def __init__(self, page: FakePage) -> None:
        self._page = page

    async def click(self, x: int, y: int) -> None:
        self._page.clicked.append(f"@{x},{y}")


class FakeKeyboard:
    def __init__(self, page: FakePage) -> None:
        self._page = page

    async def press(self, key: str) -> None:  # pragma: no cover - clear 分支
        pass

    async def type(self, text: str, delay: int = 0) -> None:
        self._page.typed.append(text)


# 让替身支持 `page.mouse` / `page.keyboard` / `page.locator`(`__slots__` 无关,普通类)
FakePage.mouse = FakeMouse  # type: ignore[attr-defined]
FakePage.keyboard = FakeKeyboard  # type: ignore[attr-defined]
FakePage.locator = lambda self, sel: FakeLocator(self)  # type: ignore[attr-defined]


class FakeClosable:
    """playwright/browser/context 三件的替身,只统计 close 次数。"""

    def __init__(self, tag: str) -> None:
        self.tag = tag
        self.closed = 0

    async def close(self) -> None:
        self.closed += 1


def _install(user_id: str, *, page: FakePage | None = None) -> cu._UserBrowser:
    """往会话表放一条该用户的会话(不起浏览器时 page=None,等价于"从没 open 过")。"""
    sess = cu._UserBrowser(user_id)
    sess.page = page
    if page is not None:
        sess.playwright = FakeClosable("playwright")
        sess.browser = FakeClosable("browser")
        sess.context = FakeClosable("context")
    cu._sessions[user_id] = sess
    return sess


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """每条用例一张空会话表 + 一个独立的 trace store(绝不写仓内 data/)。

    刻意不碰 `app.core.db_pool` 与 Redis:本文件判的全是进程内状态与临时目录,
    测试隔离铁律(AGENTS §5)要求这条链路上一个生产连接都不发起。
    """
    monkeypatch.setattr(cu, "_sessions", {})
    store = bt.BrowserTraceStore(
        file_path=tmp_path / "traces.json", screenshot_dir=tmp_path / "shots"
    )
    monkeypatch.setattr(cu, "browser_trace_store", store)
    monkeypatch.setattr(bt, "browser_trace_store", store)


def _client() -> tuple[TestClient, dict[str, str]]:
    """一个 app 两面身份:改 `who["id"]` 即切换调用人,避免起两个 app。"""
    who = {"id": "alice"}
    app = FastAPI()
    app.include_router(cu.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: who["id"]
    return TestClient(app), who


# ===========================================================================
# 1. 病灶本身:进程级单例不得回来
# ===========================================================================


def test_no_module_level_singleton_globals() -> None:
    """六枚模块全局必须全部消失 —— 病灶就是"模块级一份状态",不是"某处没过滤"。"""
    for gone in (
        "_playwright",
        "_browser",
        "_context",
        "_page",
        "_last_snapshot",
        "_recording_trace_id",
        "_lock",
    ):
        assert not hasattr(cu, gone), f"模块全局 {gone} 又回来了 ⇒ 回到进程级单例"
    assert isinstance(cu._sessions, dict)
    # `global` 语句是单例形态的指纹:会话状态住在对象里,函数不该再改写模块名
    assert "global _" not in COMPUTER_USE_SRC, "computer_use 里出现了 `global _xxx`"


def test_every_endpoint_injects_and_consumes_the_principal() -> None:
    """尺子点名的 13 处:每个 handler 都必须在函数体内**用到**身份参数。

    这条与 ast 尺子同判据但不同实现 —— 尺子判"签名有身份默认值而体内零引用",
    这里额外要求"体内引用的是喂给归属出口的那一类",防止"引用一次打个日志"糊弄尺子。
    """
    for name in THIRTEEN_ENDPOINTS:
        fn = getattr(cu, name)
        src = inspect.getsource(fn)
        assert "user_id: str = Depends(get_current_user_id)" in src, name
        # 去掉签名行后仍要引用 user_id(体内使用)
        body = src.split(") ->", 1)[-1]
        assert "user_id" in body, f"{name} 只在签名里出现 user_id ⇒ 认证不等于授权"


# ===========================================================================
# 2. 会话取用按 user_id 隔离(helper 层)
# ===========================================================================


def test_require_page_isolates_users() -> None:
    page = _install("alice", page=FakePage("alice")).page
    assert cu._require_page("alice") is page
    # bob 从没 open 过:他拿不到 alice 的那一只,而是 409(响应码逐字未变)
    with pytest.raises(HTTPException) as exc:
        cu._require_page("bob")
    assert exc.value.status_code == 409


def test_resolve_target_reads_the_callers_own_snapshot() -> None:
    """ref 的取值域必须是**调用人的**最近快照 —— 改前读的是全站共享那一份。"""
    alice = _install("alice", page=FakePage("alice"))
    bob = _install("bob", page=FakePage("bob"))
    alice.last_snapshot = [{"ref": 0, "x": 111, "y": 222}]
    bob.last_snapshot = [{"ref": 0, "x": 333, "y": 444}]

    assert cu._resolve_target(bob, ref=0, selector=None, x=None, y=None) == {
        "x": 333,
        "y": 444,
        "ref": 0,
    }
    # bob 没有 ref=9:404 的判据也是"他自己的"快照,不是 alice 的
    with pytest.raises(HTTPException) as exc:
        cu._resolve_target(bob, ref=9, selector=None, x=None, y=None)
    assert exc.value.status_code == 404
    # 只有一把空快照的人报"尚无快照",而不是拿到别人那份
    carol = _install("carol", page=FakePage("carol"))
    with pytest.raises(HTTPException) as exc2:
        cu._resolve_target(carol, ref=0, selector=None, x=None, y=None)
    assert exc2.value.status_code == 409


def test_close_page_only_closes_the_callers_browser() -> None:
    """`close` 的副作用必须精确到调用人名下(改前一次调用干掉全站唯一那只)。"""
    a = _install("alice", page=FakePage("alice"))
    b = _install("bob", page=FakePage("bob"))
    alice_objs = (a.page, a.playwright, a.browser, a.context)
    bob_objs = (b.page, b.playwright, b.browser, b.context)

    asyncio.run(cu._close_page("alice"))

    assert [o.closed for o in alice_objs] == [1, 1, 1, 1], "alice 自己那只要四件全关"
    assert [getattr(o, "closed", 0) for o in bob_objs] == [0, 0, 0, 0], "关到别人的了"
    # 半死态:关掉的人必须**不在表里**(留着会让后续 _ensure_page 面对已关闭对象)
    assert "alice" not in cu._sessions
    assert cu._sessions.get("bob") is b
    # 幂等:没会话的人 close 不炸也不影响别人
    asyncio.run(cu._close_page("nobody"))
    assert "bob" in cu._sessions


def test_take_snapshot_inner_is_scoped_to_the_user() -> None:
    pa = FakePage("alice")
    pa.last_snapshot = [{"tag": "button", "role": "", "name": "A", "x": 1, "y": 2,
                         "width": 10, "height": 10, "disabled": False, "checked": False}]
    _install("alice", page=pa)
    _install("bob", page=FakePage("bob"))

    items = asyncio.run(cu._take_snapshot_inner("alice"))
    assert [it["name"] for it in items] == ["A"]
    assert cu._sessions["alice"].last_snapshot == items
    # bob 没快照过 ⇒ 他的那一份是空的,不是复用 alice 的
    assert cu._sessions["bob"].last_snapshot == []
    with pytest.raises(HTTPException) as exc:
        asyncio.run(cu._take_snapshot_inner("carol"))
    assert exc.value.status_code == 409


# ===========================================================================
# 3. 路由级端到端:别人的资源读不到 / 改不动,且与"不存在"同形
# ===========================================================================


def _detail_template(body: dict[str, Any]) -> str:
    """把响应 detail 里被回显的那个 id 摘掉,只留模板本身。

    为什么要这一层:"逐字同形"判的是**同一条代码路径与同一份消息模板**,而模板里
    本来就要回显调用方自己给的 id —— 直接比两个不同 id 的响应永远不等,那条断言
    会红得毫无意义(而写成"只比状态码"又太松,放得开"别人的那条换个措辞")。
    """
    detail = str(body["detail"])
    for token in ("bt-bob", "bt-nope", "nope"):
        detail = detail.replace(token, "<id>")
    return detail


def test_route_click_and_screenshot_hit_only_ones_own_page() -> None:
    client, who = _client()
    pa = _install("alice", page=FakePage("alice")).page
    pb = _install("bob", page=FakePage("bob")).page
    assert pa is not None and pb is not None

    with client:
        who["id"] = "bob"
        # bob 用 selector 点击 ⇒ 只可能落在 bob 自己的页面上
        assert client.post("/api/computer-use/click", json={"selector": "#go"}).status_code == 200
        assert pb.clicked == ["#go"]
        assert pa.clicked == [], "alice 的页面被别人的请求点了"

        who["id"] = "alice"
        r = client.get("/api/computer-use/screenshot")
        assert r.status_code == 200
        # 截图内容(替身里编了 owner)证明取的是 alice 那只,不是 bob 那只
        assert "alice" in _b64decode_text(r.json()["screenshot"])
        assert "bob" not in _b64decode_text(r.json()["screenshot"])

        who["id"] = "dave"
        assert client.get("/api/computer-use/screenshot").status_code == 409
        assert client.post("/api/computer-use/extract-text").status_code == 409
        assert client.post("/api/computer-use/click", json={"selector": "#go"}).status_code == 409


def _b64decode_text(value: str) -> str:
    import base64

    return base64.b64decode(value).decode("utf-8", errors="replace")


def test_recording_state_is_per_user_and_ignores_others_traffic() -> None:
    """改前:A 一开录制,B 的每次操作都记进 A 的 trace,B 的 /trace/stop 还会停掉 A。"""
    client, who = _client()
    pa = _install("alice", page=FakePage("alice")).page
    pb = _install("bob", page=FakePage("bob")).page
    assert pa is not None and pb is not None
    store: bt.BrowserTraceStore = cu.browser_trace_store

    with client:
        who["id"] = "alice"
        started = client.post("/api/computer-use/trace/start", json={"trace_id": "bt-alice"})
        assert started.json()["status"] == "recording"

        # bob 在**自己没开录制**的情况下操作 ⇒ 一步都不该进 alice 的 trace
        who["id"] = "bob"
        assert client.post("/api/computer-use/click", json={"selector": "#x"}).status_code == 200
        assert client.post("/api/computer-use/trace/stop").json()["status"] == "idle", (
            "bob 的 stop 停掉了 alice 的录制 ⇒ 录制状态又是全局的了"
        )

        # alice 的 stop 才拿到她自己那一步
        who["id"] = "alice"
        assert client.post("/api/computer-use/click", json={"selector": "#y"}).status_code == 200
        stopped = client.post("/api/computer-use/trace/stop").json()
        assert stopped["status"] == "stopped" and stopped["step_count"] == 1

    trace = store.get_trace("bt-alice", owner_user_id="alice")
    assert trace is not None
    assert [s["target"]["selector"] for s in trace["steps"]] == ["#y"], "别人的步骤混进来了"
    assert store.get_trace("bt-alice", owner_user_id="bob") is None


def test_list_detail_delete_of_foreign_trace_are_indistinguishable_from_missing() -> None:
    client, who = _client()
    store: bt.BrowserTraceStore = cu.browser_trace_store
    store.append_step("bt-alice", {"action": "navigate"}, owner_user_id="alice")
    store.append_step("bt-bob", {"action": "navigate"}, owner_user_id="bob")

    with client:
        who["id"] = "alice"
        listed = client.get("/api/computer-use/trace").json()
        assert [it["trace_id"] for it in listed["traces"]] == ["bt-alice"]
        assert listed["count"] == 1, "count 与 traces 不同源过滤 ⇒ 还是能数出别人有多少条"

        foreign = client.get("/api/computer-use/trace/bt-bob")
        missing = client.get("/api/computer-use/trace/bt-nope")
        assert foreign.status_code == 404 == missing.status_code
        # 同一条取值路径、同一份消息模板(唯一差异是回显的 id 本身)
        assert _detail_template(foreign.json()) == _detail_template(missing.json())
        assert _detail_template(foreign.json()) == "trace 不存在: <id>"

        assert client.delete("/api/computer-use/trace/bt-bob").json() == {
            "ok": False,
            "trace_id": "bt-bob",
        }
        assert client.delete("/api/computer-use/trace/bt-nope").json() == {
            "ok": False,
            "trace_id": "bt-nope",
        }
        # 副作用没发生:别人的记录一条没少,自己的还在
        assert store.get_trace("bt-bob", owner_user_id="bob") is not None
        assert client.delete("/api/computer-use/trace/bt-alice").json()["ok"] is True
        assert store.get_trace("bt-alice", owner_user_id="alice") is None


def test_replay_refuses_foreign_trace_and_uses_own_browser() -> None:
    client, who = _client()
    store: bt.BrowserTraceStore = cu.browser_trace_store
    store.append_step("bt-bob", {"action": "navigate", "params": {"url": "http://x/"}},
                      owner_user_id="bob")
    _install("alice", page=FakePage("alice"))
    _install("bob", page=FakePage("bob"))

    with client:
        who["id"] = "alice"
        r = client.post("/api/computer-use/replay", json={"trace_id": "bt-bob"})
        assert r.status_code == 404
        missing = client.post("/api/computer-use/replay", json={"trace_id": "nope"})
        assert missing.status_code == 404
        assert _detail_template(r.json()) == _detail_template(missing.json()), (
            "回放的 404 一旦对两种情形说不同的话,这个端点就成了探测别人 trace_id 的预言机"
        )
        # 副作用没发生:bob 的页面没被驱动过(alice 也拿不到任何一步)
        assert cu._sessions["bob"].page.clicked == []


# ===========================================================================
# 4. browser_trace 的归属:创建即盖章、写面也过滤、历史无 owner 的记录不可见
# ===========================================================================


def test_append_stamps_owner_once_and_refuses_foreign_writes(tmp_path: Path) -> None:
    store = bt.BrowserTraceStore(file_path=tmp_path / "t.json", screenshot_dir=tmp_path / "s")
    store.append_step("bt-1", {"action": "navigate"}, owner_user_id="alice")
    raw = json.loads((tmp_path / "t.json").read_text(encoding="utf-8"))
    assert raw["bt-1"]["owner_user_id"] == "alice"

    # 第二次换人写 ⇒ 拒,且**一步都没写进去**(只断言抛错会放过"先改了再抛")
    with pytest.raises(ValueError):
        store.append_step("bt-1", {"action": "type", "params": {"text": "hunter2"}},
                          owner_user_id="bob")
    after = store.get_trace("bt-1", owner_user_id="alice")
    assert after is not None and len(after["steps"]) == 1
    assert [s["action"] for s in after["steps"]] == ["navigate"]
    # 属主不可被后续写入顶掉
    assert after.get("owner_user_id") == "alice"

    # 系统级(caller=None)照旧可续写自己的记录
    store.append_step("bt-1", {"action": "click"}, owner_user_id="alice")
    assert len(store.get_trace("bt-1", owner_user_id="alice")["steps"]) == 2


def test_store_reads_lists_deletes_are_owner_scoped(tmp_path: Path) -> None:
    store = bt.BrowserTraceStore(file_path=tmp_path / "t.json", screenshot_dir=tmp_path / "s")
    store.append_step("bt-a", {"action": "navigate"}, owner_user_id="alice")
    store.append_step("bt-b", {"action": "navigate"}, owner_user_id="bob")
    store.append_step("bt-none", {"action": "navigate"})  # 系统级创建:无属主

    assert [it["trace_id"] for it in store.list_traces(owner_user_id="alice")] == ["bt-a"]
    assert store.get_trace("bt-b", owner_user_id="alice") is None
    assert store.get_trace("bt-none", owner_user_id="alice") is None, (
        "未盖章记录对已登录调用方必须不可见 —— 否则一次内部创建就等于向全站开放"
    )
    # 系统级调用(不带身份)不设过滤:三种都还在
    assert sorted(it["trace_id"] for it in store.list_traces()) == ["bt-a", "bt-b", "bt-none"]
    assert store.delete_trace("bt-b", owner_user_id="alice") is False
    assert store.get_trace("bt-b", owner_user_id="bob") is not None
    assert store.delete_trace("bt-b", owner_user_id="bob") is True


def test_legacy_ownerless_json_is_invisible_but_not_destroyed(tmp_path: Path) -> None:
    """磁盘上**改前就存在**的记录没有 owner 字段 ⇒ 对已登录用户不可见,但文件不删。

    这是工单点名的那一格处置:不得把"没有 owner"读成"人人可见"。

    2026-10-03(TTL 整改):started_at 改成**相对当前时间**算的。本条断言的是
    "无 owner ⇒ 不可见且不被销毁",与保留期正交 —— 原先硬编码 "2026-01-01",
    在 browser_trace 的 14 天保留期下会被 TTL 当成过期项清掉,于是这条用例从
    "验证属主三态"悄悄变成"验证 TTL",属主那一格反而没了覆盖。写成相对值后
    两条判据互不干扰(另见 test_retention_ttl_store.py 里的过期清理用例)。
    """
    recent = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600))
    f = tmp_path / "legacy.json"
    f.write_text(
        json.dumps({"bt-old": {"steps": [{"step_index": 0, "action": "click"}],
                               "started_at": recent}}),
        encoding="utf-8",
    )
    store = bt.BrowserTraceStore(file_path=f, screenshot_dir=tmp_path / "s")
    assert store.get_trace("bt-old", owner_user_id="alice") is None
    assert store.list_traces(owner_user_id="alice") == []
    assert store.delete_trace("bt-old", owner_user_id="alice") is False
    assert store.get_trace("bt-old") is not None, "系统级内部调用仍可读(且文件未被破坏)"
    assert f.exists()


def test_record_owner_normalizes_junk_values() -> None:
    """JSON 往返常把值写成非 str;不归一 ⇒ `==` 永假的静默失守。"""
    assert bt._record_owner({"owner_user_id": "alice"}) == "alice"
    assert bt._record_owner({"owner_user_id": ""}) is None
    assert bt._record_owner({"owner_user_id": None}) is None
    assert bt._record_owner({}) is None
    assert bt._record_owner({"owner_user_id": 7}) is None
    assert bt._record_owner(None) is None


def test_attach_screenshot_refuses_foreign_trace_without_touching_disk(tmp_path: Path) -> None:
    store = bt.BrowserTraceStore(file_path=tmp_path / "t.json", screenshot_dir=tmp_path / "s")
    store.append_step("bt-b", {"action": "screenshot"}, owner_user_id="bob")

    ref = store.attach_screenshot("bt-b", 0, b"\x89PNG", owner_user_id="alice")
    assert ref is None
    assert not (tmp_path / "s" / "bt-b").exists(), "别人的目录里落了文件 = 副作用发生了"
    got = store.get_trace("bt-b", owner_user_id="bob")
    assert got is not None and got["steps"][0]["screenshot_ref"] is None

    # 同一入参换成属主自己 ⇒ 正常落盘并回填(正向对照,防止只是把功能改坏)
    assert store.attach_screenshot("bt-b", 0, b"\x89PNG", owner_user_id="bob") == (
        "browser_traces/bt-b/step_000.png"
    )
    got2 = store.get_trace("bt-b", owner_user_id="bob")
    assert got2 is not None and got2["steps"][0]["screenshot_ref"] == (
        "browser_traces/bt-b/step_000.png"
    )


def test_foreign_and_missing_share_one_return_shape() -> None:
    """谓词的"同形":不是 403、不是不同消息,而是同一个 None / 同一个 False。"""
    assert bt._same_owner is bh._same_owner, "归属谓词不得有第二份实现"
    assert bt._same_owner("bob", "alice") is False
    assert bt._same_owner(None, "alice") is False
    assert bt._same_owner("bob", None) is True


# ===========================================================================
# 5. 源码级形状锁:单一谓词 + 端点全部喂身份
# ===========================================================================


def test_ownership_predicate_has_a_single_implementation() -> None:
    """`_same_owner` 只许住在 browser_hub;browser_trace 必须 import 它而不是再抄一份。"""
    trace_src = (AI_SERVICE / "app" / "services" / "browser_trace.py").read_text(encoding="utf-8")
    hub_src = (AI_SERVICE / "app" / "services" / "browser_hub.py").read_text(encoding="utf-8")
    assert "from .browser_hub import _same_owner" in trace_src
    assert "def _same_owner" not in trace_src, "第二份归属谓词"
    assert hub_src.count("def _same_owner") == 1
    # 全仓不得出现第三种同形写法(在本族的两个文件里)
    assert "def owner_scoped_allows" not in trace_src
    for src in (COMPUTER_USE_SRC, trace_src):
        assert "def _owned_by" not in src


def test_trace_store_calls_from_router_all_pass_the_principal() -> None:
    """尺子那 13 处的落地形态:store 的每个读写口都带 owner,不给"顺手少传一个"留活路。

    计数是**判据输入**而不是装饰:7 = 1 次 attach + 4 次 get_trace(start/stop/detail/
    replay)+ 1 次 list + 1 次 delete。少一处就是有一个口又回到"不过滤"。
    """
    assert COMPUTER_USE_SRC.count("owner_user_id=user_id") == 7, COMPUTER_USE_SRC.count(
        "owner_user_id=user_id"
    )
    # 录制口的 owner 走会话对象(值仍来自令牌主体)
    assert "owner_user_id=sess.user_id" in COMPUTER_USE_SRC
    # 未过滤的旧调用形态一律不得残留(这些串在本模块任何位置都不该出现,包括注释:
    # 出现即说明有人把口子改回去了,或者在拿注释冒充代码)
    for stale in (
        "browser_trace_store.get_trace(trace_id)",
        "browser_trace_store.get_trace(body.trace_id)",
        "browser_trace_store.list_traces()",
        "browser_trace_store.delete_trace(trace_id)",
    ):
        assert stale not in COMPUTER_USE_SRC, f"残留未过滤的旧调用形态:{stale}"
    # 模块级录制状态/快照的旧写法不得回来
    assert "global " not in COMPUTER_USE_SRC, "又出现改写模块全局的语句 ⇒ 单例回潮"


def test_audit_ruler_reports_nothing_for_this_module() -> None:
    """尺子现读:本文件 13 处必须归零(不钉数字进文档,判据当场跑)。"""
    import subprocess
    import sys

    out = subprocess.run(
        [sys.executable, str(AI_SERVICE / "scripts" / "audit_principal_consumed.py"), "--json"],
        cwd=AI_SERVICE,
        capture_output=True,
        text=True,
        check=False,
    )
    assert out.returncode == 0, out.stderr
    data = json.loads(out.stdout)
    hits = [r for r in data["findings"] if r["file"].endswith("app/routers/computer_use.py")]
    assert hits == [], f"仍有端点拿到身份却没用:{[(h['func'], h['params']) for h in hits]}"
    assert data["scanned"] > 0, "尺子没扫到文件 ⇒ 空跑不算通过"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
