# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""emit 触发集与 A/B 测试字典的归属对账(2026-09-27 G-258 B 组 · Hook 面)。

覆盖本票两处收口:

1. `POST /hooks/emit` → `hook_engine.emit(..., owner_id=…)`:旧实现把"该事件下所有
   enabled 的 Hook"逐个点火,不看归属 —— 任何已登录用户都能触发**别人的** webhook
   (带着别人的外部地址与凭据往外发)或**别人的** script(在别人机器上跑命令),
   副作用与执行证据落在受害者头上,响应还回 code=0。
2. A/B 测试那本字典(`_ab_tests`):`_hooks` 早就带 `owner_id`,而它没有 ⇒ 任何人
   可列 / 停 / 取别人的实验结果。现在登记点盖章创建者,读与停按主体过滤,
   **别人的条目与"不存在"同形**。

判据只有一份:归属比较一律走 `hook_engine._owned_by`,`_abtest_owner_from_raw` 只做
Redis 字段的形状归一(不是第二份判据)。最后一条用例把这件事钉成源码级反向锁 ——
"两处算同一件事必漂移"是本仓记过最多次的失败型。

隔离(测试隔离铁律,AGENTS §5):全部进程内对象 + monkeypatch。
`_offline_engine()` 把 `_ensure_redis` 整条堵死 —— 第一次调用它就会往
`settings.redis_url`(本机 = 生产 Redis 8811)发 PING,随后的 `_persist_*` 会**写键**;
那不是"读一下配置"。`_execute_hook` 与 `orchestration_hub` 同样被换成只记账的替身,
所以本文件不派生子进程、不发 HTTP、不写 LOG_FILE、不碰 PG(8810)/Redis(8811)。
"""

from __future__ import annotations

import asyncio
import inspect
import unittest.mock as mock
from types import SimpleNamespace
from typing import Any

import pytest

from app.routers import hooks as hooks_router
from app.services import hook_engine as hook_engine_module
from app.services import orchestration_hub as oh_module
from app.services.hook_engine import HookEngine, _owned_by

# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


def _offline_engine() -> HookEngine:
    """一个**永不触碰 Redis** 的引擎实例(见模块头"隔离")。"""
    eng = HookEngine()

    async def _no_redis() -> Any:
        return None

    eng._ensure_redis = _no_redis  # type: ignore[method-assign]
    eng._redis = None
    eng._use_redis = False
    eng._redis_probed = True
    eng._loaded = True  # 不让 _load_hooks 去 Redis 读别人的配置回来污染夹具
    eng._ab_tests = {}  # 显式建字典,避免依赖惰性初始化
    return eng


def _hook(hook_id: str, owner_id: str | None, *, event: str = "tool.before", enabled: bool = True) -> dict[str, Any]:
    return {
        "id": hook_id,
        "name": hook_id,
        "owner_id": owner_id,
        "event": event,
        "condition": None,
        "action": {"type": "log", "config": {"message": "noop"}},
        "enabled": enabled,
        "createdAt": "2026-09-27T00:00:00Z",
        "updatedAt": "2026-09-27T00:00:00Z",
    }


@pytest.fixture
def hub(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """替换进程内编排中枢单例,并记账(它自己会连 Redis / 发 HTTP 到各支柱)。"""
    calls: list[dict[str, Any]] = []

    class _FakeHub:
        async def emit(self, **kwargs: Any) -> str:
            calls.append(kwargs)
            return "ev-fake"

    monkeypatch.setattr(oh_module, "orchestration_hub", _FakeHub())
    return {"calls": calls}


@pytest.fixture
def spy(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """把 `_execute_hook` 换成只记录 hook_id 的替身 —— 断言"副作用没发生"的尺子。"""
    executed: list[str] = []

    async def _fake_execute(
        hook: dict[str, Any], event: str, context: dict[str, Any], replay: bool = False
    ) -> dict[str, Any]:
        executed.append(hook["id"])
        return {
            "id": f"hl-{hook['id']}",
            "hookId": hook["id"],
            "event": event,
            "triggeredAt": "2026-09-27T00:00:00Z",
            "success": True,
            "duration": 0,
        }

    # staticmethod 是必须的:直接设到类上会被当描述符绑定(self 会吃掉第一个实参,
    # 于是 hook 字典落到 `context` 位上、`hook["id"]` 变成 "HookEngine not subscriptable")
    monkeypatch.setattr(HookEngine, "_execute_hook", staticmethod(_fake_execute))
    return executed


def _two_owner_engine() -> HookEngine:
    eng = _offline_engine()
    eng._hooks = {
        "hk-alice": _hook("hk-alice", "alice"),
        "hk-bob": _hook("hk-bob", "bob"),
    }
    return eng


# ---------------------------------------------------------------------------
# 1. emit:触发集合按调用方主体收窄
# ---------------------------------------------------------------------------


async def test_emit_only_fires_the_callers_own_hooks(
    spy: list[str], hub: dict[str, Any]
) -> None:
    eng = _two_owner_engine()
    logs = await eng.emit("tool.before", {"tool": "x"}, owner_id="alice")
    await asyncio.sleep(0)  # 让 fire-and-forget 的持久化任务跑完(它已被堵在 Redis 之前)
    assert spy == ["hk-alice"], f"只该点火调用方自己的 Hook,实得 {spy}"
    assert [l["hookId"] for l in logs] == ["hk-alice"]


async def test_emit_foreign_principal_fires_nothing_at_all(
    spy: list[str], hub: dict[str, Any]
) -> None:
    """越权那侧必须量到"**一条都没执行**",只断言返回码会放过"先点了火再拒"。"""
    eng = _two_owner_engine()
    logs = await eng.emit("tool.before", {}, owner_id="mallory")
    await asyncio.sleep(0)
    assert logs == []
    assert spy == [], "别人的 Hook 一次都没被点火才是本判据的正文"


async def test_emit_legacy_and_internal_paths_are_unchanged(
    spy: list[str], hub: dict[str, Any]
) -> None:
    """正向对照 + 行为后果:不传 owner_id = 全量点火(与改动前逐字同形)。

    进程内调用方(`agent_loop_v2` / `agent_engine` / `llm_gateway` / `mcp_server`)都走
    这一档,它们以"系统总线"身份代发事件,手里没有一个可传下去的用户主体。
    代价如实登记:普通用户经 HTTP 口触发时,**系统级 Hook(owner_id=None)不再被点火**
    —— 与 `list_hooks` 对历史条目的既有约定同形(系统级仅管理员可见/可用)。
    """
    eng = _two_owner_engine()
    eng._hooks["hk-system"] = _hook("hk-system", None)

    # ① 不传主体(内部总线):全量
    await eng.emit("tool.before", {}, owner_id=None)
    await asyncio.sleep(0)
    assert sorted(spy) == ["hk-alice", "hk-bob", "hk-system"]

    # ② 普通主体:只有自己的,系统级不点火
    spy.clear()
    await eng.emit("tool.before", {}, owner_id="alice")
    await asyncio.sleep(0)
    assert spy == ["hk-alice"]


async def test_emit_owner_filter_does_not_widen_other_dimensions(
    spy: list[str], hub: dict[str, Any]
) -> None:
    """加归属过滤不得把 enabled / event 两维判据弄丢(收窄只允许少给,不许多给)。"""
    eng = _offline_engine()
    eng._hooks = {
        "hk-a-on": _hook("hk-a-on", "alice", event="tool.before"),
        "hk-a-off": _hook("hk-a-off", "alice", event="tool.before", enabled=False),
        "hk-a-other": _hook("hk-a-other", "alice", event="tool.after"),
    }
    await eng.emit("tool.before", {}, owner_id="alice")
    await asyncio.sleep(0)
    assert spy == ["hk-a-on"], f"实得 {spy}"


async def test_router_emit_event_scopes_by_token_principal(
    spy: list[str], hub: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """端到端:HTTP 口 → 引擎,越权不发生在任何一环。"""
    eng = _two_owner_engine()
    monkeypatch.setattr(hooks_router, "hook_engine", eng)

    req_alice = SimpleNamespace(state=SimpleNamespace(user_id="alice", role_id=0))
    out = await hooks_router.emit_event(
        req_alice, hooks_router.EmitRequest(event="tool.before"), user_id="alice"
    )
    await asyncio.sleep(0)
    assert out["code"] == 0
    assert out["data"]["triggered_count"] == 1
    assert spy == ["hk-alice"]

    # 管理员档:既有分级,None = 不按归属收窄
    spy.clear()
    req_root = SimpleNamespace(state=SimpleNamespace(user_id="root", role_id=1))
    await hooks_router.emit_event(
        req_root, hooks_router.EmitRequest(event="tool.before"), user_id="root"
    )
    await asyncio.sleep(0)
    assert sorted(spy) == ["hk-alice", "hk-bob"]


# ---------------------------------------------------------------------------
# 2. A/B 测试字典:登记盖章 + 读/停按主体过滤 + 同形拒绝
# ---------------------------------------------------------------------------

_AB_CFG = {"hook_a_id": "hk-alice", "hook_b_id": "hk-alice", "traffic_split": 0.5}


async def test_ab_registration_stamps_creator() -> None:
    eng = _offline_engine()
    created = await eng.create_ab_test(_AB_CFG, owner_id="alice")
    assert created["owner_id"] == "alice"
    # 落在存储里的那一份也带主(响应与存储不同形 = 过滤读的是另一本账)
    assert eng._ab_tests_store()[created["id"]]["owner_id"] == "alice"


async def test_ab_list_is_owner_scoped() -> None:
    eng = _offline_engine()
    await eng.create_ab_test(_AB_CFG, owner_id="alice")
    await eng.create_ab_test({**_AB_CFG, "hook_b_id": "hk-bob"}, owner_id="bob")
    assert {t["owner_id"] for t in await eng.list_ab_tests(owner_id="alice")} == {"alice"}
    assert {t["owner_id"] for t in await eng.list_ab_tests(owner_id="bob")} == {"bob"}
    assert len(await eng.list_ab_tests(owner_id=None)) == 2, "管理员档不得被收窄"


async def test_ab_legacy_entry_without_owner_is_system_level() -> None:
    """改造前已落库的条目(无 owner_id 字段)按既有约定 = 系统级:仅管理员可见。

    这条不是"顺手宽容":若不判成系统级而按"匹配任何人"处理,存量实验会继续人人可读。
    """
    eng = _offline_engine()
    legacy = {**_AB_CFG, "id": "ab-legacy", "status": "running", "owner_id": None}
    eng._ab_tests_store()["ab-legacy"] = legacy
    assert await eng.list_ab_tests(owner_id="alice") == []
    assert [t["id"] for t in await eng.list_ab_tests(owner_id=None)] == ["ab-legacy"]


async def test_ab_get_and_stop_are_not_existence_oracles() -> None:
    """别人的条目与"不存在"**同形**:同一返回类型、同一取值,不给可探测的差异。"""
    eng = _offline_engine()
    created = await eng.create_ab_test(_AB_CFG, owner_id="alice")

    foreign = await eng.get_ab_test(created["id"], owner_id="bob")
    missing = await eng.get_ab_test("ab-does-not-exist", owner_id="bob")
    assert foreign is None and missing is None
    assert foreign is missing  # 两种情况走的是同一条 return None(不是两个不同分支的值)

    stopped_by_stranger = await eng.stop_ab_test(created["id"], owner_id="bob")
    stopped_missing = await eng.stop_ab_test("ab-does-not-exist", owner_id="bob")
    assert stopped_by_stranger is None and stopped_missing is None
    # 副作用没发生:别人的实验既没被停,也没被写上 ended_at
    stored = eng._ab_tests_store()[created["id"]]
    assert stored["status"] == "running" and stored["ended_at"] == ""


async def test_ab_get_does_not_compute_foreign_stats() -> None:
    """归属判定必须早于取数:先算 stats 再判,等于把别人的样本量读出来了才决定给不给。"""
    eng = _offline_engine()
    created = await eng.create_ab_test(_AB_CFG, owner_id="alice")
    asked: list[str | None] = []
    original = HookEngine.get_stats

    def _spy_stats(self: HookEngine, hook_id: str | None = None) -> dict[str, Any]:
        asked.append(hook_id)
        return original(self, hook_id)

    with mock.patch.object(HookEngine, "get_stats", _spy_stats):
        got = await eng.get_ab_test(created["id"], owner_id="bob")
    assert got is None
    assert asked == [], f"被拒的这一次读了别人的统计:{asked}"
    # 正向对照:属主本人照常拿到 stats
    with mock.patch.object(HookEngine, "get_stats", _spy_stats):
        mine = await eng.get_ab_test(created["id"], owner_id="alice")
    assert mine is not None and "stats_a" in mine and "stats_b" in mine


async def test_ab_owner_can_still_read_and_stop() -> None:
    eng = _offline_engine()
    created = await eng.create_ab_test(_AB_CFG, owner_id="alice")
    mine = await eng.get_ab_test(created["id"], owner_id="alice")
    assert mine is not None and mine["status"] == "running"
    stopped = await eng.stop_ab_test(created["id"], owner_id="alice")
    assert stopped is not None and stopped["status"] == "stopped"
    assert eng._ab_tests_store()[created["id"]]["status"] == "stopped"


async def test_ab_router_endpoints_pass_the_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    eng = _offline_engine()
    created = await eng.create_ab_test(_AB_CFG, owner_id="alice")
    monkeypatch.setattr(hooks_router, "hook_engine", eng)
    bob = SimpleNamespace(state=SimpleNamespace(user_id="bob", role_id=0))

    listing = await hooks_router.list_ab_tests(bob, user_id="bob")
    assert listing["code"] == 0 and listing["data"] == []

    detail = await hooks_router.get_ab_test(bob, created["id"], user_id="bob")
    stopped = await hooks_router.stop_ab_test(bob, created["id"], user_id="bob")
    # 同形:两个响应逐字相同,且与"根本不存在这条"的响应也相同
    missing = await hooks_router.get_ab_test(bob, "ab-nope", user_id="bob")
    assert detail == stopped == {"code": 0, "message": "success", "data": None}
    assert missing == detail
    assert eng._ab_tests_store()[created["id"]]["status"] == "running"

    # 创建口:管理员建的实验也归他自己(要的是"谁建的谁负责",不是"管理员建=系统级")
    root = SimpleNamespace(state=SimpleNamespace(user_id="root", role_id=1))
    made = await hooks_router.create_ab_test(
        root,
        hooks_router.CreateAbTestBody(hook_a_id="a", hook_b_id="b"),
        user_id="root",
    )
    assert made["code"] == 0
    assert made["data"]["owner_id"] == "root"
    assert made["data"]["id"] in [t["id"] for t in await eng.list_ab_tests(owner_id="root")]


# ---------------------------------------------------------------------------
# 3. Redis 形状归一:`str(None)` 不得伪装成一个用户
# ---------------------------------------------------------------------------


def test_abtest_owner_field_round_trips_through_redis_shape() -> None:
    eng = _offline_engine()
    named = hook_engine_module._abtest_owner_from_raw({"owner_id": "alice"})
    none_token = hook_engine_module._abtest_owner_from_raw({"owner_id": "None"})
    empty = hook_engine_module._abtest_owner_from_raw({"owner_id": ""})
    absent = hook_engine_module._abtest_owner_from_raw({})
    assert named == "alice"
    assert none_token is None and empty is None and absent is None
    # 解析后的条目再过一次判据,行为与内存面同形(否则"哪个后端"会改变结论)
    parsed = eng._parse_ab_test({"id": "ab-1", "owner_id": "None"})
    assert parsed["owner_id"] is None
    assert _owned_by(parsed, "alice") is False


# ---------------------------------------------------------------------------
# 4. 反向锁:归属判据只许有一份实现
# ---------------------------------------------------------------------------


def test_owner_predicate_has_exactly_one_implementation() -> None:
    """`== owner_id` 只允许出现在 `_owned_by` 里;新增内联比较即红。

    取证用源码而不是"再造一个断言":判据被抄第二份的时候,两份都会各自通过测试,
    漂移只发生在其中一份被改的那天(AGENTS"两处算同一件事必须共用一份实现")。
    """
    src = inspect.getsource(hook_engine_module)
    lines = src.splitlines()
    predicate_lines = [i for i, ln in enumerate(lines, 1) if "== owner_id" in ln]
    assert predicate_lines, "判据本身不见了 —— 归属过滤对整族失效"

    fn = hook_engine_module._owned_by
    fn_lines, start = inspect.getsourcelines(fn)  # 返回 (行列表, 起始行号) —— 顺序别记反
    inside = set(range(start, start + len(fn_lines)))
    outside = [i for i in predicate_lines if i not in inside]
    assert not outside, f"第 {outside} 行内联比较了 owner_id,请改调 _owned_by"

    # 路由侧同理:不得自己写归属分档(唯一实现是 _owner_filter)
    router_src = inspect.getsource(hooks_router)
    router_body = "\n".join(
        ln for ln in router_src.splitlines() if not ln.lstrip().startswith("#")
    )
    assert "_is_admin(request)" in router_body  # 唯一实现在 _owner_filter 里
    assert router_body.count("if _is_admin(request)") == 1, "路由里出现了第二处归属分档"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
