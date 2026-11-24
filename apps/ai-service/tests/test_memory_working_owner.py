# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""working memory 的属主绑定(2026-09-28 收口第三层):服务层判据本体的正反成对用例。

与同目录另两票的分工(三条各判一段,免得同一件事在三处各写一遍判据):
  * `test_memory_authz.py` —— 端点面「缺身份必 401 / 跨用户必折叠成空桶」(原现状钉桩改判);
  * 本文件 —— **服务层判据本体**:`add_working(owner=…)` 是否真的把属主写进桶里的条目、
    `entry_visible_to` 的四格真值表、`get_working` 的过滤、可见性短路与逐条过滤
    **是否同一条判据**、快照/回滚、以及回填出口在 service 上的幂等;
  * `test_backfill_working_owner.py` —— 回填器(纯计划 + CLI 端到端 + 权威三态)。

为什么"短路=少发一次查询"这一格必须有测试:实现里 `working_has_visible_entries` 与
`get_working` 各读一次桶,若两处对"可见"的定义漂开,漂移的表现**不是报错**,而是
"某些桶永远读不到 / 某些别人的条目又漏出来"——本文件用一张矩阵把两者的返回值逐格
对齐(`test_visibility_shortcut_and_filter_agree_on_every_shape`),这是本票唯一能让
"一处判据"这件事被机器看守的方式。

测试隔离(AGENTS §5):working 层是进程内内存,全程不建连接池;额外用
`_forbid_production_db` 把 asyncpg 建池打成异常,连"顺手碰一下"都不允许。
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

from app.services.memory_service import MemoryService, working_entry_owner

pytestmark = pytest.mark.real_jwt

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
BACKFILL_SCRIPT = AI_SERVICE_ROOT / "scripts" / "backfill_working_owner.py"

_USER_A = "owner-a-working-test"
_USER_B = "owner-b-working-test"
_SID = "s-working-owner"


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("working 属主用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture
def service() -> MemoryService:
    """独立实例(gateway 喂一个空对象:working 层不调它,真用到就该响)。"""
    return MemoryService(gateway=object())  # type: ignore[arg-type]


def _load_backfill_module() -> Any:
    assert BACKFILL_SCRIPT.is_file(), f"回填器不在位:{BACKFILL_SCRIPT}"
    spec = importlib.util.spec_from_file_location("backfill_working_owner_under_test", BACKFILL_SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# 写侧:owner 必须落在**桶里的条目**上,不是只落在返回值上
# ---------------------------------------------------------------------------


async def test_add_working_stamps_owner_on_the_stored_entry(service: MemoryService) -> None:
    """判据:从桶里(snapshot)读出的条目带 userId。

    为什么不能只断"返回值带 userId":旧实现正是"返回值带着、桶里那份靠一次锁外补写",
    而 `get_working` 读的是桶里那份 —— 断返回值等于判错了对象。
    """
    await service.add_working(_SID, "user", "hello", owner=_USER_A)
    snapshot = await service.snapshot_working()
    entries = snapshot[_SID]
    assert working_entry_owner(entries[0]) == _USER_A


async def test_add_working_without_owner_leaves_the_key_absent(service: MemoryService) -> None:
    """无 owner ⇒ **不写 userId 键**,而不是写 None。

    把 None 落成值等于把"推不出 owner"伪装成"owner 已知",回填侧的三态判据
    (`no_evidence` vs `unique`)当场被污染。
    """
    msg = await service.add_working("legacy-s", "user", "hi")
    assert "userId" not in msg
    assert "userId" not in (await service.snapshot_working())["legacy-s"][0]
    assert working_entry_owner((await service.snapshot_working())["legacy-s"][0]) is None


async def test_save_working_carries_the_resolved_owner_into_the_bucket(service: MemoryService) -> None:
    """统一入口 `save(layer='working')` 也必须落 owner(端点用它,owner 来自令牌主体)。"""
    msg = await service.save(_USER_A, "内容", "working", session_id=_SID)
    assert msg["userId"] == _USER_A  # 既有契约(test_memory_service::test_save_working)不得回归
    assert working_entry_owner((await service.snapshot_working())[_SID][0]) == _USER_A


async def test_owner_is_written_atomically_no_ownerless_window(service: MemoryService) -> None:
    """写侧的并发窗口判据:任何一次快照都不得看到"已入桶但无属主"的新条目。

    旧实现是 `msg = await add_working(...)` 之后在**锁外**补 `msg["userId"] = user_id`
    —— 一次 await 的让出点足以让并发快照撞进无主窗口,而读侧对无主条目的定义是
    "维持改动前行为",于是收紧在自家写入路径上被静默绕过。现在 owner 在同一个临界区里
    烘进条目,这条用例就是那个改动的装车证明。
    """
    observed_unowned: list[str] = []

    async def writer() -> None:
        for i in range(20):
            await service.save(_USER_A, f"c{i}", "working", session_id="race-session")

    async def poller() -> None:
        for _ in range(200):
            for entry in (await service.snapshot_working()).get("race-session", []):
                if working_entry_owner(entry) is None:
                    observed_unowned.append(str(entry.get("id")))
            await asyncio.sleep(0)

    await asyncio.gather(writer(), poller())
    assert observed_unowned == [], (
        f"读到 {len(observed_unowned)} 次「已入桶但无属主」的条目 ⇒ 锁外后置改写回来了"
    )


# ---------------------------------------------------------------------------
# 读侧判据真值表(四格,成对)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("entry_owner", "requester", "expected"),
    [
        (None, None, True),  # 内部/降级调用:恒可见(改动前行为)
        (None, _USER_A, True),  # 无主存量条目:回退档,**不是授权结论**
        (_USER_A, _USER_A, True),  # 有主且匹配:可见
        (_USER_B, _USER_A, False),  # 有主且不匹配:不可见(fail-closed)
        ("", _USER_A, True),  # 空串属主按"无主"判(见 working_entry_owner)
    ],
)
def test_entry_visible_to_truth_table(
    entry_owner: str | None, requester: str | None, expected: bool
) -> None:
    assert MemoryService.entry_visible_to(entry_owner, requester) is expected


async def test_get_working_hides_other_owners_entries(service: MemoryService) -> None:
    await service.add_working(_SID, "user", "A 的", owner=_USER_A)
    await asyncio.sleep(0.02)
    await service.add_working(_SID, "user", "B 的", owner=_USER_B)
    assert [m["content"] for m in await service.get_working(_SID, requester=_USER_A)] == ["A 的"]
    assert [m["content"] for m in await service.get_working(_SID, requester=_USER_B)] == ["B 的"]


async def test_get_working_returns_identical_list_without_requester(service: MemoryService) -> None:
    """不喂主体 ⇒ 与引入该参数之前**逐字相同**(含 limit 的尾部切片语义)。"""
    service.WORKING_LRU_LIMIT = 10
    for i in range(6):
        await service.add_working(_SID, "user", f"m{i}")
        await asyncio.sleep(0.02)
    all_items = await service.get_working(_SID)
    assert [m["content"] for m in all_items] == ["m0", "m1", "m2", "m3", "m4", "m5"]
    assert [m["content"] for m in await service.get_working(_SID, 2)] == ["m4", "m5"]
    assert [m["content"] for m in await service.get_working(_SID, 99)] == [
        m["content"] for m in all_items
    ]


async def test_visibility_shortcut_and_filter_agree_on_every_shape(service: MemoryService) -> None:
    """短路判据与逐条过滤**必须同判** —— 一张矩阵逐格对账,不允许"两个实现各说各话"。

    判据:`working_has_visible_entries(sid, r)` 为真 ⇔ `get_working(sid, requester=r)`
    非空。漂开时的表现不是报错,而是"端点回空桶、服务层其实读得到"(或反过来白读一次
    别人的桶),所以这一格只能由这条测试钉住。
    """
    await service.add_working("pure-a", "user", "a1", owner=_USER_A)
    await service.add_working("pure-b", "user", "b1", owner=_USER_B)
    await service.add_working("unowned", "user", "u1")
    await service.add_working("mixed", "user", "a2", owner=_USER_A)
    await asyncio.sleep(0.02)
    await service.add_working("mixed", "user", "u2")
    for sid in ("pure-a", "pure-b", "unowned", "mixed", "absent"):
        for requester in (None, _USER_A, _USER_B):
            visible = await service.working_has_visible_entries(sid, requester)
            items = await service.get_working(sid, requester=requester)
            assert visible == bool(items), f"{sid} × {requester}: 短路={visible} 但过滤给了 {len(items)} 条"


async def test_partially_owned_bucket_still_exposes_unowned_entries(service: MemoryService) -> None:
    """部分有主的桶里,无主条目**照旧可读**(回退档)—— 如实登记,不当成已收紧。

    这是 `entry_visible_to` 分支 2 的必然推论:判据在条目上,不在桶上。把它测出来是为了
    让"还剩多少没收紧"可量:这些无主条目要等回填票按权威列补上属主才会进入匹配档,
    在此之前该端点对它们维持改动前的行为(不是"已安全")。
    """
    await service.add_working("partial", "user", "A 的", owner=_USER_A)
    await asyncio.sleep(0.02)
    await service.add_working("partial", "user", "无主的存量")
    contents = [m["content"] for m in await service.get_working("partial", requester=_USER_B)]
    assert contents == ["无主的存量"]


def test_owner_rule_is_a_single_implementation_across_service_and_backfill() -> None:
    """回填器不得再抄一份「什么算有属主」—— 判据对象必须是**同一个函数对象**。

    两处各写一遍必然漂移(本仓最高频的失效型),而这里的漂移后果具体:回填写进去的
    形态读侧判不出 = 回填白跑;或读侧把已回填的条目又当无主补一遍 = 幂等性是纸上的。
    """
    backfill = _load_backfill_module()
    assert backfill.working_entry_owner is working_entry_owner, (
        "backfill_working_owner 不再复用 MemoryService.working_entry_owner ⇒ 出现第二份判据"
    )


async def test_working_entry_owner_rejects_non_string_values() -> None:
    """脏数据(把 userId 写成数字/None)按"无主"判,绝不把脏值当身份比对。"""
    assert working_entry_owner({"userId": 123}) is None
    assert working_entry_owner({"userId": ""}) is None
    assert working_entry_owner({}) is None
    assert working_entry_owner({"userId": "u-1"}) == "u-1"


# ---------------------------------------------------------------------------
# 回填出口 + 快照/回滚(服务侧)
# ---------------------------------------------------------------------------


async def test_service_backfill_stamps_only_unowned_and_is_idempotent(service: MemoryService) -> None:
    """`(补上, 冲突保留, 无桶)` 三元组:第二轮补 0、冲突仍是那 1 条。

    刻意不把"已与目标同值"计进三元组 —— 那个数由**计划层**的 `entries_already_owned`
    报(报告里点名它才有意义);服务侧只报"我改了什么 / 我拒绝改什么",两层的计数口径
    不同是设计,不是漏。少这条说明,下一个人会把它当 bug「修统一」。
    """
    await service.add_working("s1", "user", "one")
    await asyncio.sleep(0.02)  # msg_id 是 `{session}:{timestamp}`,同微秒写会互相覆盖(见 add_working 注)
    await service.add_working("s1", "user", "two", owner=_USER_A)
    first = await service.backfill_working_owner({"s1": "derived-owner"})
    assert first == (1, 1, 0), f"首轮应为「补 1 / 冲突保留 1 / 无桶 0」,实得 {first}"
    second = await service.backfill_working_owner({"s1": "derived-owner"})
    assert second == (0, 1, 0), f"第二轮必须零改动(幂等),实得 {second}"
    entries = (await service.snapshot_working())["s1"]
    assert [working_entry_owner(e) for e in entries] == ["derived-owner", _USER_A]


async def test_service_backfill_refuses_to_create_missing_bucket(service: MemoryService) -> None:
    """桶不存在 ⇒ 不凭空造桶(那等于替一个已经没有会话的 id 复活数据)。"""
    stamped, conflicted, missing = await service.backfill_working_owner({"ghost": "u"})
    assert (stamped, conflicted, missing) == (0, 0, 1)
    assert "ghost" not in (await service.snapshot_working())


async def test_snapshot_and_restore_roundtrip_is_lossless(service: MemoryService) -> None:
    """回滚出口:快照 → 回填 → 还原 ⇒ 桶**逐字**回到原样。"""
    await service.add_working("s1", "user", "one", owner=_USER_A)
    await service.add_working("s2", "user", "two")
    before = await service.snapshot_working()
    frozen = await service.snapshot_working()
    await service.backfill_working_owner({"s1": "other", "s2": "derived"})
    changed = await service.snapshot_working()
    assert changed != before, "回填没改动任何东西 ⇒ 这条用例是空的"
    await service.restore_working(frozen)
    assert await service.snapshot_working() == before


async def test_restore_rejects_malformed_snapshot(service: MemoryService) -> None:
    """半份/畸形快照必须**拒绝还原**,而不是把桶清成残缺状态。"""
    await service.add_working("s1", "user", "one", owner=_USER_A)
    with pytest.raises((TypeError, AttributeError)):
        await service.restore_working({"s1": ["不是字典"]})  # type: ignore[list-item]
    assert (await service.snapshot_working())["s1"][0]["content"] == "one"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
