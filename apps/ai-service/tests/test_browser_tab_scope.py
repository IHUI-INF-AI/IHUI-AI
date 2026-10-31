# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器动作的 tab 级作用域(gap#3,2026-10-31)。

对照口径:Trae T2§3.2 把浏览器动作约束在 `Scope{sessionId, browserOwner,
strictBrowserOwner, tabId}` 上。本仓此前的现状(主席一手现读):
`browser_hub._same_owner` 只到 **user 级**,`create_session` 那条 10s URL 幂等窗也只管
"同 URL 别串属主",动作面(navigate / 鼠标键盘 / type / screenshot / execute_js)没有
"点名的这一枚 tab 是否已登记、登记作用域是否就是调用方"的判定。

本文件钉住新加的这一格,并逐条留**正向对照**:

  · 拒的方向恒是"多要一次定向说明"(具名拒因),不是"多放一次";
  · 越权用例断言**副作用没发生**(一条 CDP 指令都没发出去),而不是只看返回码;
  · 不静默回退:`tab_id` 缺位、tab 只在 `_sessions` 里而没登记 ⇒ 一律拒,
    绝不"退到用户级取最近一枚"。

隔离纪律:不连生产库(PG 8810 / Redis 8811)——这条链路本来就不碰它们;Playwright 对象
全部替身(`_run_sync` 就地执行、`_build_session` 打桩),不起真 Chromium。
防重放(jti 一次性消费)**刻意未接**,原因见服务模块同名区块头注,以及本文件末条形状锁。
"""

from __future__ import annotations

import concurrent.futures
from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import browser_hub as br
from app.services import browser_hub as bh
from app.services.browser_hub import (
    TAB_SCOPE_MISSING,
    TAB_SCOPE_OWNER_MISMATCH,
    TAB_SCOPE_SESSION_MISMATCH,
    TAB_SCOPE_UNKNOWN,
    TAB_SCOPE_UNVERIFIED_CALLER,
    BrowserHub,
    BrowserSession,
    BrowserTabScope,
    BrowserTabScopeError,
)

ALICE = "u-alice"
BOB = "u-bob"


# ---------------------------------------------------------------------------
# 替身:CDP / Context / Page 与"就地执行"的 _run_sync
# ---------------------------------------------------------------------------


class SpyCdp:
    """只记录 send 的 CDP 替身 —— 越权用例断言的就是它一条也没收到。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def send(self, method: str, params: dict[str, Any] | None = None) -> None:
        self.calls.append((method, params or {}))

    def detach(self) -> None:
        pass

    @property
    def sent_count(self) -> int:
        return len(self.calls)


class SpyContext:
    def __init__(self) -> None:
        self.cdp = SpyCdp()
        self.closed = False

    def new_cdp_session(self, _page: Any) -> SpyCdp:
        return self.cdp

    def close(self) -> None:
        self.closed = True

    def cookies(self, _urls: list[str] | None = None) -> list[dict[str, str]]:
        return []


class SpyPage:
    def __init__(self, url: str = "https://example.com/") -> None:
        self.url = url
        self.viewport_size: dict[str, int] = {"width": 1280, "height": 720}

    def title(self) -> str:
        return "示例页"


class InlineExecutor:
    """替代 ThreadPoolExecutor:submit 同步执行,返回已完成 Future。"""

    def submit(self, fn: Any, /, *args: Any, **kwargs: Any) -> concurrent.futures.Future:
        fut: concurrent.futures.Future = concurrent.futures.Future()
        try:
            fut.set_result(fn(*args, **kwargs))
        except BaseException as e:  # noqa: BLE001 - 测试替身需原样透传
            fut.set_exception(e)
        return fut


class SpySession:
    """给 create/recreate 路径用的轻量会话替身(只实现被 hub 调到的那几件事)。"""

    def __init__(self, session_id: str, owner_user_id: str | None) -> None:
        self.session_id = session_id
        self.owner_user_id = owner_user_id
        self.closed = False
        self._user_agent = "spy-ua"

    async def get_current_url(self) -> str:
        return "https://example.com/"

    @property
    def viewport(self) -> dict[str, int]:
        return {"width": 1280, "height": 720}

    async def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def _direct_run_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    """BrowserSession._run_sync 就地执行(与 test_browser_hub.py 同形的测试替身)。"""

    async def _direct(self: BrowserSession, func: Any) -> Any:
        return func()

    monkeypatch.setattr(BrowserSession, "_run_sync", _direct)


def _real_session(session_id: str, owner_user_id: str | None) -> BrowserSession:
    """真 BrowserSession + 全替身 Playwright 对象:动作会落到 SpyCdp 上。"""
    context = SpyContext()
    return BrowserSession(
        session_id,
        context,  # type: ignore[arg-type]
        SpyPage(),  # type: ignore[arg-type]
        InlineExecutor(),  # type: ignore[arg-type]
        None,
        owner_user_id=owner_user_id,
    )


def _hub_with(
    *tabs: tuple[str, str | None, str | None],
) -> BrowserHub:
    """造一个只带登记表的 hub:`tabs` = (tab_id, 属主, 会话态) 三元组。"""
    h = BrowserHub()
    for tab_id, owner, chat in tabs:
        h._sessions[tab_id] = _real_session(tab_id, owner)
        h._register_tab(tab_id, owner, chat)
    return h


def _scope(
    tab_id: str | None,
    owner: str | None,
    chat: str | None = None,
    *,
    strict: bool = True,
) -> BrowserTabScope:
    return BrowserTabScope(
        tab_id=tab_id, owner_user_id=owner, chat_session_id=chat, strict_browser_owner=strict
    )


async def _type_into(h: BrowserHub, scope: BrowserTabScope, text: str) -> None:
    """动作腿的形状:先过作用域判定,拿不到 session 就一步也走不下去。"""
    session = h.require_tab(scope)
    await session.type_text(text)


# ---------------------------------------------------------------------------
# 1. 缺位与未登记:具名拒因,且不回退
# ---------------------------------------------------------------------------


def test_missing_tab_id_is_named_and_never_resolves_to_user_level() -> None:
    """没点名 tab ⇒ `missing_tab_scope`;绝不"取该用户最近一枚 tab"。"""
    h = _hub_with(("tab-a", ALICE, None))
    for blank in (None, "", "   "):
        with pytest.raises(BrowserTabScopeError) as exc:
            h.require_tab(_scope(blank, ALICE))
        assert exc.value.code == TAB_SCOPE_MISSING
        assert exc.value.tab_id is None
    # alice 名下确实有一枚可用 tab —— 缺 tab_id 时不得被隐式挑中
    assert h.list_sessions(ALICE) == ["tab-a"]


def test_tab_only_in_sessions_but_not_registered_is_denied() -> None:
    """回退到 user 级 = 绕过边界:只在 `_sessions` 里(旁路写入/残留)一律判"不存在"。"""
    h = BrowserHub()
    h._sessions["ghost"] = _real_session("ghost", ALICE)
    with pytest.raises(BrowserTabScopeError) as exc:
        h.require_tab(_scope("ghost", ALICE))
    assert exc.value.code == TAB_SCOPE_UNKNOWN
    assert h.tab_registration("ghost") is None


async def test_close_tab_unregisters() -> None:
    """登记与存续同生命周期:关闭出口必须摘账;被拒的关闭不得摘账。"""
    h = _hub_with(("tab-a", ALICE, None), ("tab-b", BOB, None))
    assert h.tab_registration("tab-a") is not None

    with pytest.raises(BrowserTabScopeError):
        await h.close_tab(_scope("tab-a", BOB))
    assert h.tab_registration("tab-a") is not None, "越权关闭不得把别人的 tab 摘账"

    assert await h.close_tab(_scope("tab-a", ALICE)) is True
    assert h.tab_registration("tab-a") is None
    assert "tab-a" not in h._sessions
    assert h.tab_registration("tab-b") is not None


# ---------------------------------------------------------------------------
# 2. 越权:副作用没发生 + 正向对照
# ---------------------------------------------------------------------------


async def test_foreign_owner_action_has_no_side_effect_with_positive_control() -> None:
    """bob 打 alice 的 tab ⇒ 一条 CDP 指令都没发出;alice 自己打 ⇒ 逐字符发出(正向对照)。"""
    alice_tab = _real_session("tab-alice", ALICE)
    h = BrowserHub()
    h._sessions["tab-alice"] = alice_tab
    h._register_tab("tab-alice", ALICE, None)
    cdp = alice_tab._context.cdp  # type: ignore[union-attr]

    with pytest.raises(BrowserTabScopeError) as exc:
        await _type_into(h, _scope("tab-alice", BOB), "evil")
    assert exc.value.code == TAB_SCOPE_OWNER_MISMATCH
    assert cdp.sent_count == 0, "越权动作必须停在判定之前,不得已经把字符发给浏览器"

    await _type_into(h, _scope("tab-alice", ALICE), "ok")
    assert cdp.sent_count == 2, "正向对照:同一条腿在属主本人手里必须真能跑通"


async def test_unstamped_tab_is_denied_for_logged_in_caller() -> None:
    """没盖章的 tab(系统级创建)对已登录调用方不可动作 —— 与 _same_owner 三态同口径。"""
    sys_tab = _real_session("tab-sys", None)
    h = BrowserHub()
    h._sessions["tab-sys"] = sys_tab
    h._register_tab("tab-sys", None, None)
    with pytest.raises(BrowserTabScopeError) as exc:
        await _type_into(h, _scope("tab-sys", ALICE), "x")
    assert exc.value.code == TAB_SCOPE_OWNER_MISMATCH
    assert sys_tab._context.cdp.sent_count == 0  # type: ignore[union-attr]


async def test_strict_mode_refuses_caller_without_principal() -> None:
    """严格档关掉 `_same_owner` 里"caller=None ⇒ 系统级放行"那一格。

    旧写法 `hub.get_session(id, None)` 命中这格 ⇒ 一张取不到主体的 token 就能 attach
    任何人的 tab(WS 那条腿实测走过)。动作面不再允许。
    """
    h = _hub_with(("tab-a", ALICE, None))
    with pytest.raises(BrowserTabScopeError) as exc:
        h.require_tab(_scope("tab-a", None))
    assert exc.value.code == TAB_SCOPE_UNVERIFIED_CALLER


def test_non_strict_still_requires_registration() -> None:
    """非严格档(内部系统级链路)回落 `_same_owner` 三态,但仍要求"已登记"。"""
    h = _hub_with(("tab-a", ALICE, None))
    assert h.require_tab(_scope("tab-a", None, strict=False)) is h._sessions["tab-a"]
    empty = BrowserHub()
    empty._sessions["loose"] = _real_session("loose", ALICE)
    with pytest.raises(BrowserTabScopeError) as exc:
        empty.require_tab(_scope("loose", None, strict=False))
    assert exc.value.code == TAB_SCOPE_UNKNOWN


def test_deny_codes_are_all_reachable() -> None:
    """封闭集里每一档都必须被行为用例命中过(否则就是死代码)。"""
    h = _hub_with(("tab-a", ALICE, None), ("tab-c", ALICE, "conv-1"))
    hits: set[str] = set()
    probes: list[BrowserTabScope] = [
        _scope("", ALICE),  # missing
        _scope("nope", ALICE),  # unknown
        _scope("tab-a", BOB),  # owner mismatch
        _scope("tab-a", None),  # unverified caller
        _scope("tab-c", ALICE, "conv-2"),  # session mismatch
    ]
    for probe in probes:
        try:
            h.require_tab(probe)
        except BrowserTabScopeError as exc:
            hits.add(exc.code)
    assert hits == set(bh.TAB_SCOPE_DENY_CODES), hits


def test_deny_code_outside_closed_set_is_refused() -> None:
    with pytest.raises(ValueError, match="未知的 tab 作用域拒因"):
        BrowserTabScopeError("tab_is_probably_fine")


# ---------------------------------------------------------------------------
# 3. 会话态维
# ---------------------------------------------------------------------------


def test_chat_session_axis() -> None:
    """声明了会话态就必须对上登记值;登记缺失而调用方声明 ⇒ 不匹配(不当通过)。"""
    h = _hub_with(("tab-c1", ALICE, "conv-1"), ("tab-plain", ALICE, None))
    # 正向对照:同会话态
    assert h.require_tab(_scope("tab-c1", ALICE, "conv-1")) is h._sessions["tab-c1"]
    # 跨会话态
    with pytest.raises(BrowserTabScopeError) as exc:
        h.require_tab(_scope("tab-c1", ALICE, "conv-2"))
    assert exc.value.code == TAB_SCOPE_SESSION_MISMATCH
    # 未声明会话态的 HTTP 腿:该维不设限(tab/owner 两维照旧全判)
    assert h.require_tab(_scope("tab-c1", ALICE)) is h._sessions["tab-c1"]
    # 登记里没有会话态,而调用方声明了 ⇒ 拒(不回退)
    with pytest.raises(BrowserTabScopeError) as exc:
        h.require_tab(_scope("tab-plain", ALICE, "conv-1"))
    assert exc.value.code == TAB_SCOPE_SESSION_MISMATCH


def test_scope_text_normalisation_treats_blank_as_absent() -> None:
    """空串/纯空白 = 该维缺位,不得当成"匹配任何"。"""
    assert bh._scope_text("  ") is None
    assert bh._scope_text(None) is None
    assert bh._scope_text("  u-1 ") == "u-1"
    assert _scope("  ", "  ").normalized_tab_id is None
    assert _scope("  ", "  ").normalized_owner is None


# ---------------------------------------------------------------------------
# 4. 登记出口:create / recreate(幂等复用同样不得跨会话态串 tab)
# ---------------------------------------------------------------------------


async def test_create_session_registers_the_tab(monkeypatch: pytest.MonkeyPatch) -> None:
    h = BrowserHub()
    h._started = True
    h._browser = object()

    async def fake_build(self: BrowserHub, **kwargs: Any) -> SpySession:
        return SpySession(str(kwargs["session_id"]), kwargs.get("owner_user_id"))

    monkeypatch.setattr(BrowserHub, "_build_session", fake_build)
    session = await h.create_session(
        url=None, session_id="t1", owner_user_id=ALICE, chat_session_id="c1"
    )
    assert session.session_id == "t1"
    reg = h.tab_registration("t1")
    assert reg is not None and reg.owner_user_id == ALICE and reg.chat_session_id == "c1"


async def test_dedup_reuse_does_not_cross_chat_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """10s URL 幂等窗里,同属主也要**同会话态**才复用,否则 B 会话把 A 会话的 tab 接走。"""
    h = BrowserHub()
    h._started = True
    h._browser = object()
    built: list[str] = []

    async def fake_build(self: BrowserHub, **kwargs: Any) -> SpySession:
        built.append(str(kwargs["session_id"]))
        return SpySession(str(kwargs["session_id"]), kwargs.get("owner_user_id"))

    monkeypatch.setattr(BrowserHub, "_build_session", fake_build)
    first = await h.create_session(
        url="https://x.com/", session_id="t1", owner_user_id=ALICE, chat_session_id="c1"
    )
    # 正向对照:同属主 + 同会话态 ⇒ 复用同一枚
    reused = await h.create_session(
        url="https://x.com/", owner_user_id=ALICE, chat_session_id="c1"
    )
    assert reused is first
    # 同属主 + 另一会话态 ⇒ 另建(不复用)
    other = await h.create_session(
        url="https://x.com/", session_id="t2", owner_user_id=ALICE, chat_session_id="c2"
    )
    assert other is not first
    assert built == ["t1", "t2"]
    assert h.tab_registration("t2") is not None


async def test_recreate_session_inherits_registration() -> None:
    """风控墙重建换了 id,作用域章必须原样带过去(否则重建一次就把边界洗掉)。"""
    h = _hub_with(("tab-old", ALICE, "conv-9"))
    old = h._sessions["tab-old"]

    async def fake_build(**kwargs: Any) -> SpySession:
        return SpySession(str(kwargs["session_id"]), kwargs.get("owner_user_id"))

    h._build_session = fake_build  # type: ignore[method-assign]
    new = await h.recreate_session("tab-old", ALICE)
    assert new is not None
    assert new.session_id != "tab-old"
    assert h.tab_registration("tab-old") is None, "旧指针不得继续可动作"
    reg = h.tab_registration(new.session_id)
    assert reg is not None
    assert reg.owner_user_id == ALICE and reg.chat_session_id == "conv-9"
    # 正向对照:新 tab 立刻可按同一作用域动作
    assert h.require_tab(_scope(new.session_id, ALICE, "conv-9")) is new
    with pytest.raises(BrowserTabScopeError) as exc:
        h.require_tab(_scope("tab-old", ALICE))
    assert exc.value.code == TAB_SCOPE_UNKNOWN
    assert _context_of(old).closed is True, "旧 context 必须真关掉,否则每次风控墙重建漏一个"


# ---------------------------------------------------------------------------
# 5. 路由侧:具名拒因 → HTTP 形状(跨属主与"不存在"同形)
# ---------------------------------------------------------------------------


@pytest.fixture()
def seeded_router_hub(monkeypatch: pytest.MonkeyPatch) -> BrowserHub:
    h = _hub_with(("tab-alice", ALICE, None))
    monkeypatch.setattr(br, "hub", h)
    return h


def _context_of(session: BrowserSession) -> SpyContext:
    """取会话背后的 Playwright 替身 context(断言副作用/关闭用)。"""
    context: SpyContext = session._context  # type: ignore[assignment]
    return context


def _cdp_of(session: BrowserSession) -> SpyCdp:
    """取会话背后的 CDP 替身(断言副作用用)。"""
    return _context_of(session).cdp


async def test_router_foreign_action_is_404_same_shape_as_absent(
    seeded_router_hub: BrowserHub,
) -> None:
    body = br.NavigateRequest(url="https://evil.example/")
    with pytest.raises(HTTPException) as exc:
        await br.navigate("tab-alice", body, user_id=BOB)
    assert exc.value.status_code == 404
    assert exc.value.detail == "会话不存在: tab-alice", "不得比「不存在」多说一个字"
    assert _cdp_of(seeded_router_hub._sessions["tab-alice"]).calls == []
    # 正向对照:属主本人同一条端点通
    out = await br.navigate("tab-alice", body, user_id=ALICE)
    assert out["code"] == 0


async def test_router_missing_tab_scope_is_400_with_named_code(
    seeded_router_hub: BrowserHub,
) -> None:
    with pytest.raises(HTTPException) as exc:
        await br.go_back("", user_id=ALICE)
    assert exc.value.status_code == 400
    assert str(exc.value.detail).startswith(TAB_SCOPE_MISSING)
    assert _cdp_of(seeded_router_hub._sessions["tab-alice"]).calls == []


async def test_router_close_uses_the_same_scope(seeded_router_hub: BrowserHub) -> None:
    with pytest.raises(HTTPException) as exc:
        await br.close_session("tab-alice", user_id=BOB)
    assert exc.value.status_code == 404
    assert seeded_router_hub.tab_registration("tab-alice") is not None, "被拒的关闭不得摘账"
    out = await br.close_session("tab-alice", user_id=ALICE)
    assert out["code"] == 0
    assert seeded_router_hub.tab_registration("tab-alice") is None


# ---------------------------------------------------------------------------
# 6. 形状锁:防重放这一格必须是"如实未接",不许被读成已完成
# ---------------------------------------------------------------------------


def test_replay_guard_is_declared_not_wired() -> None:
    """jti 一次性消费在本腿**未接**,服务模块必须把这一格写成"未接 + 受阻原因"。

    判据单源 `consume(jti)` 只在 apps/api 的 TS 侧(internal-service-ticket.ts 的
    ReplayStore),ai-service 只有发票出口(app/core/internal_ticket.py)、没有验票/消费口,
    而这条腿的请求形状里也没有 jti(走用户 access JWT)。按 §0.6 不得在 Python 侧另抄
    第二份防重放判据 ⇒ 跨语言复用受阻,交主席裁。真接上时应连同本断言一起改。
    """
    src = Path(bh.__file__).read_text(encoding="utf-8")
    router_src = (Path(bh.__file__).parent.parent / "routers" / "browser_hub.py").read_text(
        encoding="utf-8"
    )
    assert "刻意没接的一格" in src
    assert "未接的一格" in router_src
    assert "consume(jti)" in src and "ReplayStore" in src
    assert "internal-service-ticket.ts" in src
    # 反向锁:本文件里不得出现"已经消费 jti"的实现出口(第三份防重放判据)
    assert "def consume_jti" not in src and "_consumed_jti" not in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
