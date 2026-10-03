# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""带 TTL 的 JSON 落盘 + 五个模块的保留期接入测试(2026-10-03 数据出域合规整改)。

覆盖三层:
  1. 共享工具 ttl_json_store:过期判定(env 解析 / 时间戳解析 / mtime 兜底 /
     fail-closed)、原子写、环形上限、存量清理回写;
  2. 各模块接入:过期条目在**加载时**被清掉(存量清理),并从磁盘消失;
  3. 回归护栏:vector_memory 的属主 fail-closed 隔离与 browser_trace 的属主三态
     不因接入 TTL 而被破坏。

所有时间戳都是构造出来的假数据,不写真实用户内容。
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

from app.services import ttl_json_store as tjs
from app.services import vector_memory as vm_mod
from app.services.agent_longterm_memory import AgentLongTermMemory
from app.services.agent_step_recorder import AgentStepRecorder
from app.services.audit_log import AuditLogStore
from app.services.browser_trace import BrowserTraceStore
from app.services.vector_memory import VectorMemoryStore


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    """纯内存模式:禁 Redis L2 + 关 pgvector(零 DB 触达,与 test_vector_memory_user_scope_59 同款)。

    不关掉 pgvector 的话,``search()`` 会优先走 PG 检索,拿到**别的用例**写进去的条目 ——
    属主隔离断言就会变成跨用例的假阳性/假阴性(实测踩过:e1 的查询命中了另一用例的 'mine')。
    """
    monkeypatch.setattr(vm_mod, "_redis_checked", True)
    monkeypatch.setattr(vm_mod, "_redis_client", None)
    monkeypatch.setenv("IHUI_PGVECTOR_DISABLE", "1")

# =============================================================================
# 通用工具
# =============================================================================


def _iso(days_ago: float) -> str:
    """构造 N 天前的 ISO8601 UTC 时间戳(假数据,仅用于判过期)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - days_ago * 86400))


# ---------------- resolve_retention_days:env 开关 ----------------


def test_resolve_retention_days_default_when_env_absent(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("SOME_TTL_ENV", raising=False)
    assert tjs.resolve_retention_days("SOME_TTL_ENV", 30) == 30


def test_resolve_retention_days_accepts_positive_int(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SOME_TTL_ENV", "7")
    assert tjs.resolve_retention_days("SOME_TTL_ENV", 30) == 7


@pytest.mark.parametrize("raw", ["30.0", "1e3", "30d", "abc", "", "   ", "-1", "1_000"])
def test_resolve_retention_days_rejects_non_positive_integer(
    raw: str, monkeypatch: pytest.MonkeyPatch
):
    """只吃纯正整数:写成 '30d' / '30.0' 时必须回落到默认并让人看见告警。

    刻意不"猜":运维手滑写了 ``RETENTION=30d`` 若被静默解析成 30,反而是假的安全感。
    """
    monkeypatch.setenv("SOME_TTL_ENV", raw)
    assert tjs.resolve_retention_days("SOME_TTL_ENV", 30) == 30


@pytest.mark.parametrize("raw", ["0", "off", "never", "false", "no", "OFF"])
def test_resolve_retention_days_disable_literals(raw: str, monkeypatch: pytest.MonkeyPatch):
    """显式关闭:返回 0(= 永不过期)。必须是写出来的,不能靠设个荒谬大数变相实现。"""
    monkeypatch.setenv("SOME_TTL_ENV", raw)
    assert tjs.resolve_retention_days("SOME_TTL_ENV", 30) == 0


# ---------------- parse_timestamp ----------------


def test_parse_timestamp_iso_with_z():
    assert tjs.parse_timestamp("2026-10-03T01:25:00Z") is not None


def test_parse_timestamp_iso_with_offset_and_naive():
    assert tjs.parse_timestamp("2026-10-03T01:25:00+08:00") is not None
    assert tjs.parse_timestamp("2026-10-03 01:25:00") is not None
    assert tjs.parse_timestamp("2026-10-03") is not None


def test_parse_timestamp_epoch_number():
    assert tjs.parse_timestamp(1_700_000_000) == pytest.approx(1_700_000_000.0)


@pytest.mark.parametrize(
    "raw", [None, "", "   ", "not-a-date", True, False, -5, 1e18, [], {}, "2026-13-45"]
)
def test_parse_timestamp_rejects_garbage(raw):
    """解析不出就是 None(让调用方回落 mtime / 判过期),绝不猜一个时间出来。"""
    assert tjs.parse_timestamp(raw) is None


# ---------------- 过期判定:记录内时间戳优先,mtime 兜底 ----------------


def test_is_expired_uses_record_timestamp_not_mtime():
    """记录内时间戳过期 ⇒ 判过期,哪怕文件 mtime 是现在。

    这是"逐条判过期"的核心:mtime 会被下一次写入刷新,只信 mtime 的话
    只要还有新记录在写,老记录就永远不过期。
    """
    fresh_file = time.time()
    assert tjs.is_expired(
        {"updated_at": _iso(40)}, retention_days=30, mtime=fresh_file
    ) is True
    assert (
        tjs.is_expired({"updated_at": _iso(5)}, retention_days=30, mtime=0.0) is False
    )  # mtime 极旧也不该误杀


def test_is_expired_falls_back_to_mtime_when_no_timestamp():
    """没有时间戳 ⇒ 用文件 mtime 给它一个有限期限(而不是永久保留)。"""
    old_mtime = time.time() - 40 * 86400
    assert tjs.is_expired({"content": "x"}, retention_days=30, mtime=old_mtime) is True
    assert (
        tjs.is_expired({"content": "x"}, retention_days=30, mtime=time.time()) is False
    )


def test_is_expired_fail_closed_when_undeterminable():
    """既无时间戳又无 mtime ⇒ 判过期。

    fail-closed 的方向是"证明不了新鲜就不留",不是"证明不了就无限期留着"。
    """
    assert tjs.is_expired({"content": "x"}, retention_days=30, mtime=None) is True


def test_is_expired_disabled_when_retention_zero():
    assert (
        tjs.is_expired({"updated_at": _iso(9999)}, retention_days=0, mtime=None) is False
    )


# ---------------- sweep_mapping / sweep_sequence ----------------


def test_sweep_mapping_drops_expired_keeps_fresh():
    data = {"old": {"updated_at": _iso(40)}, "new": {"updated_at": _iso(1)}}
    kept, dropped = tjs.sweep_mapping(data, retention_days=30)
    assert dropped == 1
    assert set(kept) == {"new"}


def test_sweep_mapping_does_not_mutate_input():
    data = {"old": {"updated_at": _iso(40)}, "new": {"updated_at": _iso(1)}}
    tjs.sweep_mapping(data, retention_days=30)
    assert set(data) == {"old", "new"}, "原 dict 不能被就地改(调用方还在用)"


def test_sweep_mapping_ring_cap_drops_oldest():
    data = {f"k{i}": {"updated_at": _iso(1)} for i in range(5)}
    kept, dropped = tjs.sweep_mapping(data, retention_days=30, max_items=2)
    assert dropped == 3
    assert list(kept) == ["k3", "k4"], "环形上限丢最旧(插入序末尾最新)"


def test_sweep_sequence_drops_expired_and_caps():
    data = [{"created_at": _iso(40)}, {"created_at": _iso(2)}, {"created_at": _iso(1)}]
    kept, dropped = tjs.sweep_sequence(data, retention_days=30, max_items=1)
    assert dropped == 2
    assert kept == [{"created_at": _iso(1)}]


def test_sweep_non_mapping_input_returns_empty():
    """结构不符按空处理,不做"尽力而为的部分解析"。"""
    assert tjs.sweep_sequence({"not": "a list"}, retention_days=30) == ([], 0)
    assert tjs.sweep_mapping(["not", "a", "dict"], retention_days=30) == ({}, 0)


# ---------------- 原子写 / fail-closed 读 ----------------


def test_write_json_atomic_creates_file_and_no_tmp_left(tmp_path: Path):
    target = tmp_path / "sub" / "out.json"
    assert tjs.write_json_atomic(target, {"a": 1}, indent=2) is True
    assert json.loads(target.read_text(encoding="utf-8")) == {"a": 1}
    assert list(target.parent.glob("*.tmp")) == [], "临时文件不能留在盘上"


def test_read_json_file_missing_returns_none(tmp_path: Path):
    assert tjs.read_json_file(tmp_path / "nope.json") is None


def test_read_json_file_corrupt_returns_none(tmp_path: Path):
    """损坏 JSON ⇒ None(fail-closed)。绝不能返回半截数据。"""
    p = tmp_path / "bad.json"
    p.write_text("{ not json", encoding="utf-8")
    assert tjs.read_json_file(p) is None


def test_read_json_file_structure_mismatch_treated_as_empty(tmp_path: Path):
    p = tmp_path / "wrong.json"
    p.write_text('["a list where object expected"]', encoding="utf-8")
    data, dropped = tjs.load_ttl_records(p, retention_days=30, shape="mapping")
    assert data == {}, "结构不符按空处理(而不是把 list 当 mapping 硬解)"


# ---------------- load_ttl_records:存量清理的核心 ----------------


def test_load_ttl_records_purges_stale_file_to_disk(tmp_path: Path):
    """存量清理:磁盘上躺了很久的旧文件,读一次就从内存**和磁盘**同时清掉。"""
    p = tmp_path / "stale.json"
    p.write_text(
        json.dumps(
            {
                "old1": {"updated_at": _iso(400), "content": "stale"},
                "old2": {"updated_at": _iso(300), "content": "stale"},
                "new": {"updated_at": _iso(2), "content": "fresh"},
            }
        ),
        encoding="utf-8",
    )
    data, dropped = tjs.load_ttl_records(p, retention_days=30, shape="mapping")
    assert dropped == 2
    assert set(data) == {"new"}
    # 关键:磁盘上也要没了 —— 否则每次启动重算一遍,且过期原文一直躺在盘上
    assert set(json.loads(p.read_text(encoding="utf-8"))) == {"new"}


def test_load_ttl_records_no_rewrite_when_nothing_dropped(tmp_path: Path):
    """没东西被丢时不回写(避免无意义的 IO 与 mtime 抖动)。"""
    p = tmp_path / "fresh.json"
    p.write_text(json.dumps({"a": {"updated_at": _iso(1)}}), encoding="utf-8")
    before = p.stat().st_mtime_ns
    data, dropped = tjs.load_ttl_records(p, retention_days=30, shape="mapping")
    assert dropped == 0
    assert p.stat().st_mtime_ns == before


def test_load_ttl_records_validate_drops_malformed(tmp_path: Path):
    p = tmp_path / "malformed.json"
    p.write_text(
        json.dumps({"ok": {"memory_id": "m1"}, "bad": {"no_id": True}}), encoding="utf-8"
    )
    data, dropped = tjs.load_ttl_records(
        p,
        retention_days=30,
        shape="mapping",
        validate=lambda e: isinstance(e, dict) and bool(e.get("memory_id")),
    )
    assert set(data) == {"ok"}
    assert dropped == 1, "结构不合法也触发回写(否则坏数据一直留在盘上)"


def test_load_ttl_records_missing_file_is_empty_not_error(tmp_path: Path):
    """首次运行没有存档是正常态,不是错误。"""
    data, dropped = tjs.load_ttl_records(tmp_path / "none.json", retention_days=30)
    assert data == {} and dropped == 0


# =============================================================================
# 各模块接入:存量清理
# =============================================================================


def test_agent_longterm_memory_purges_expired_on_load(tmp_path: Path):
    """过期 400 天的用户偏好在加载时被清掉,且磁盘上同步消失。"""
    p = tmp_path / "alm.json"
    p.write_text(
        json.dumps(
            {
                "m-old": {
                    "memory_id": "m-old",
                    "type": "user_preference",
                    "content": "示例:用户偏好用 Python",
                    "user_id": "u-1",
                    "created_at": _iso(400),
                    "updated_at": _iso(400),
                },
                "m-new": {
                    "memory_id": "m-new",
                    "type": "lesson_learned",
                    "content": "示例:提交前先跑测试",
                    "user_id": "u-1",
                    "created_at": _iso(1),
                    "updated_at": _iso(1),
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    st = AgentLongTermMemory(file_path=p)
    assert st.count("u-1") == 1, "过期条目不该在加载后可见"
    assert st.get("m-old") is None
    assert set(json.loads(p.read_text(encoding="utf-8"))) == {"m-new"}, "磁盘也要清掉"


def test_agent_longterm_memory_fresh_records_survive(tmp_path: Path):
    """未过期条目一条都不能少(TTL 不能误杀有价值的用户资产)。"""
    p = tmp_path / "alm.json"
    p.write_text(
        json.dumps(
            {
                f"m{i}": {
                    "memory_id": f"m{i}",
                    "type": "user_preference",
                    "content": f"示例偏好 {i}",
                    "user_id": "u-1",
                    "created_at": _iso(2),
                    "updated_at": _iso(2),
                }
                for i in range(5)
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    assert AgentLongTermMemory(file_path=p).count("u-1") == 5


def test_agent_longterm_memory_corrupt_file_still_empty(tmp_path: Path):
    """fail-closed:存档坏了按空处理,服务起得来(存量语义不得回退)。"""
    p = tmp_path / "alm.json"
    p.write_text("{invalid json", encoding="utf-8")
    assert AgentLongTermMemory(file_path=p).count() == 0


def test_agent_step_recorder_purges_expired_runs(tmp_path: Path):
    p = tmp_path / "steps.json"
    p.write_text(
        json.dumps(
            {
                "run-old": {"steps": [{"step_index": 0}], "updated_at": _iso(90)},
                "run-new": {"steps": [{"step_index": 0}], "updated_at": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    rec = AgentStepRecorder(file_path=p)
    assert rec.replay("run-old")["total"] == 0, "过期 run 不可回放"
    assert rec.replay("run-new")["total"] == 1
    assert set(json.loads(p.read_text(encoding="utf-8"))) == {"run-new"}


def test_agent_step_recorder_keeps_recent_runs(tmp_path: Path):
    p = tmp_path / "steps.json"
    p.write_text(
        json.dumps({f"r{i}": {"steps": [], "updated_at": _iso(3)} for i in range(4)}),
        encoding="utf-8",
    )
    rec = AgentStepRecorder(file_path=p)
    for i in range(4):
        assert rec.replay(f"r{i}")["total"] == 0  # 空 steps 的 run 仍应存在
    assert len(json.loads(p.read_text(encoding="utf-8"))) == 4


def test_audit_log_purges_expired_entries(tmp_path: Path):
    p = tmp_path / "audit_logs.json"
    p.write_text(
        json.dumps(
            [
                {"id": "a1", "action": "x", "actor": "u", "created_at": _iso(200)},
                {"id": "a2", "action": "y", "actor": "u", "created_at": _iso(3)},
            ]
        ),
        encoding="utf-8",
    )
    s = AuditLogStore(file_path=p)
    data = s.query()
    assert data["total"] == 1
    assert data["list"][0]["id"] == "a2"
    assert len(json.loads(p.read_text(encoding="utf-8"))) == 1


def test_audit_log_keeps_recent_entries(tmp_path: Path):
    p = tmp_path / "audit_logs.json"
    p.write_text(
        json.dumps(
            [{"id": f"a{i}", "action": "x", "actor": "u", "created_at": _iso(10)} for i in range(3)]
        ),
        encoding="utf-8",
    )
    assert AuditLogStore(file_path=p).query()["total"] == 3


def test_browser_trace_purges_expired_traces(tmp_path: Path):
    p = tmp_path / "traces.json"
    p.write_text(
        json.dumps(
            {
                "bt-old": {
                    "steps": [{"step_index": 0, "action": "navigate"}],
                    "owner_user_id": "u-1",
                    "updated_at": _iso(60),
                },
                "bt-new": {
                    "steps": [{"step_index": 0, "action": "navigate"}],
                    "owner_user_id": "u-1",
                    "updated_at": _iso(1),
                },
            }
        ),
        encoding="utf-8",
    )
    store = BrowserTraceStore(file_path=p, screenshot_dir=tmp_path / "shots")
    assert store.get_trace("bt-old", owner_user_id="u-1") is None, "过期 trace 不可读"
    assert store.get_trace("bt-new", owner_user_id="u-1") is not None
    assert set(json.loads(p.read_text(encoding="utf-8"))) == {"bt-new"}


def test_browser_trace_keeps_recent_traces(tmp_path: Path):
    p = tmp_path / "traces.json"
    p.write_text(
        json.dumps(
            {
                f"bt-{i}": {
                    "steps": [{"step_index": 0, "action": "navigate"}],
                    "owner_user_id": "u-1",
                    "updated_at": _iso(2),
                }
                for i in range(3)
            }
        ),
        encoding="utf-8",
    )
    store = BrowserTraceStore(file_path=p, screenshot_dir=tmp_path / "shots")
    items = store.list_traces(owner_user_id="u-1")
    assert len(items) == 3


# =============================================================================
# vector_memory:hydrate 存量清理 + 属主隔离不得被破坏
# =============================================================================


async def test_vector_memory_hydrate_purges_expired(tmp_path: Path):
    """走一遍 hydrate 就把过期条目从内存与磁盘同时清掉(存量清理)。"""
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {
                    "old": {"content": "示例:很旧的一条会话原文", "user_id": "u-1"},
                    "new": {"content": "示例:新的一条会话原文", "user_id": "u-1"},
                },
                "vectors": {"old": [0.1], "new": [0.2]},
                "stored_at": {"old": _iso(400), "new": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 1
    assert store.list_entry_ids() == ["new"]
    # 三个索引同步清理:entries 与 vectors 不能错位(否则向量与原文张冠李戴)
    on_disk = json.loads(p.read_text(encoding="utf-8"))
    assert set(on_disk["entries"]) == {"new"}
    assert set(on_disk["vectors"]) == {"new"}
    assert set(on_disk["stored_at"]) == {"new"}


async def test_vector_memory_hydrate_keeps_fresh(tmp_path: Path):
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {f"e{i}": {"content": f"示例 {i}"} for i in range(3)},
                "vectors": {f"e{i}": [0.1] for i in range(3)},
                "stored_at": {f"e{i}": _iso(1) for i in range(3)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 3


async def test_vector_memory_legacy_without_stored_at_survives_fresh_file(tmp_path: Path):
    """存量文件没有 stored_at(本次整改之前写的)⇒ 回落文件 mtime。

    刚写出来的新文件 mtime 是当下,所以不该被误杀 —— 否则上线即清空全量记忆。
    """
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {"entries": {"e1": {"content": "示例"}}, "vectors": {"e1": [0.1]}}
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 1


async def test_vector_memory_legacy_stale_file_purged_via_mtime(tmp_path: Path):
    """存量文件没有 stored_at 且 mtime 很久以前 ⇒ 按 mtime 判过期清掉。

    这就是"代码加了 TTL 之后磁盘旧文件仍然无期限"的兜底:老文件走一遍加载就到期。
    """
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {"entries": {"e1": {"content": "示例"}}, "vectors": {"e1": [0.1]}}
        ),
        encoding="utf-8",
    )
    stale = time.time() - 400 * 86400
    os.utime(p, (stale, stale))
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 0
    assert json.loads(p.read_text(encoding="utf-8"))["entries"] == {}


async def test_vector_memory_hydrate_still_returns_zero_on_corrupt(tmp_path: Path):
    """存量语义回归:损坏文件 hydrate 返回 0 且不抛(启动流程不能被存档带崩)。"""
    p = tmp_path / "vm.json"
    p.write_text("{ not valid json", encoding="utf-8")
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 0
    assert len(store) == 0


async def test_vector_memory_hydrate_already_hydrated_no_reload(tmp_path: Path):
    """存量语义回归:已 hydrate 的 store 再次调用不重复加载。"""
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {"e1": {"content": "示例"}},
                "vectors": {"e1": [0.1]},
                "stored_at": {"e1": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 1
    p.write_text(
        json.dumps(
            {
                "entries": {"e1": {"content": "示例"}, "e2": {"content": "示例2"}},
                "vectors": {"e1": [0.1], "e2": [0.2]},
                "stored_at": {"e1": _iso(1), "e2": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    assert await store.hydrate() == 1
    assert len(store) == 1


async def test_vector_memory_hydrate_consistency_filter_still_applies(tmp_path: Path):
    """存量语义回归:entries ∩ vectors 过滤仍生效(TTL 不能顺手把这条规则替换掉)。"""
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {"e1": {"c": 1}, "e2": {"c": 2}, "e3": {"c": 3}},
                "vectors": {"e1": [0.1], "e2": [0.2], "e4": [0.4]},
                "stored_at": {k: _iso(1) for k in ("e1", "e2", "e3", "e4")},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 2
    assert set(store.list_entry_ids()) == {"e1", "e2"}


async def test_vector_memory_hydrate_deletes_expired_from_pgvector(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """过期条目必须**同时**从 pgvector 镜像删掉。

    search() 优先走 pgvector,只清 JSON 的话过期原文照样能被检索出来 ——
    那等于 TTL 白设(删的只是本地索引,PG 里那份还在)。这条是"真删了"的判据。
    """
    from app.services import pgvector_store as pg_mod

    deleted: list[str] = []

    async def _fake_delete(source: str, namespace: str, chunk_id: str) -> None:
        deleted.append(chunk_id)

    monkeypatch.setattr(pg_mod, "delete_chunk", _fake_delete)

    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {"old": {"content": "示例:过期原文"}, "new": {"content": "示例"}},
                "vectors": {"old": [0.1], "new": [0.2]},
                "stored_at": {"old": _iso(400), "new": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 1
    assert deleted == ["old"], "过期的 pgvector 镜像必须一并删除"


async def test_vector_memory_hydrate_keeps_pgvector_for_fresh(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """未过期的条目不该被误删出 pgvector(TTL 不能变成"顺手清库")。"""
    from app.services import pgvector_store as pg_mod

    deleted: list[str] = []

    async def _fake_delete(source: str, namespace: str, chunk_id: str) -> None:
        deleted.append(chunk_id)

    monkeypatch.setattr(pg_mod, "delete_chunk", _fake_delete)

    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {"keep": {"content": "示例"}},
                "vectors": {"keep": [0.1]},
                "stored_at": {"keep": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    assert await store.hydrate() == 1
    assert deleted == []


async def test_vector_memory_stores_sidecar_timestamp_on_add(tmp_path: Path):
    """新写入必须盖 sidecar 时间戳,否则逐条判过期永远落回 mtime。"""
    store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
    await store.add_entry("e1", {"content": "示例"}, [0.1])
    assert "e1" in store._stored_at
    on_disk = json.loads((tmp_path / "vm.json").read_text(encoding="utf-8"))
    assert on_disk["stored_at"]["e1"].endswith("Z")


async def test_vector_memory_delete_clears_sidecar(tmp_path: Path):
    """删除要同步清 sidecar,否则留下孤儿时间戳(与 entries/vectors 错位)。"""
    store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
    await store.add_entry("e1", {"content": "示例"}, [0.1])
    await store.delete("e1")
    assert store._stored_at == {}
    assert store._entries == {} and store._vectors == {}


async def test_vector_memory_clear_clears_sidecar(tmp_path: Path):
    store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
    await store.add_entry("e1", {"content": "示例", "session_id": "s1"}, [0.1])
    await store.clear()
    assert store._stored_at == {}


async def test_vector_memory_owner_isolation_survives_ttl(tmp_path: Path):
    """护栏:_filter_by_user 的 fail-closed 属主隔离不能因接入 TTL 而被破坏。

    无 user_id 的条目属主未知,search(user_id=...) 时必须不可见(漏过滤即跨用户泄漏)。
    """
    store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
    await store.add_entry("mine", {"content": "示例"}, [1.0, 0.0], user_id="u-1")
    await store.add_entry("unknown-owner", {"content": "示例"}, [1.0, 0.0])

    mine = await store.search([1.0, 0.0], threshold=0.5, user_id="u-1")
    assert [eid for eid, _, _ in mine] == ["mine"]
    other = await store.search([1.0, 0.0], threshold=0.5, user_id="u-2")
    assert other == [], "别人的 user_id 必须看不到我的条目"


async def test_vector_memory_owner_isolation_survives_hydrate(tmp_path: Path):
    """护栏:hydrate 之后属主隔离仍在(存量条目无 user_id ⇒ fail-closed 不可见)。"""
    p = tmp_path / "vm.json"
    p.write_text(
        json.dumps(
            {
                "entries": {"e1": {"content": "示例"}},
                "vectors": {"e1": [1.0, 0.0]},
                "stored_at": {"e1": _iso(1)},
            }
        ),
        encoding="utf-8",
    )
    store = VectorMemoryStore(persist_path=str(p))
    await store.hydrate()
    assert await store.search([1.0, 0.0], threshold=0.5, user_id="u-1") == []


# =============================================================================
# browser_trace 属主三态不得被 TTL 改动破坏
# =============================================================================


def test_browser_trace_owner_three_state_survives_ttl(tmp_path: Path):
    """护栏:没盖章(无 owner)的历史记录对带身份的调用方**不可见**。

    这条与 TTL 无关,但两者都在 _load 里动手,必须一起验:TTL 清理不能把
    "未盖章 ⇒ 不可见" 变成 "未盖章 ⇒ 人人可见"。
    """
    p = tmp_path / "traces.json"
    p.write_text(
        json.dumps(
            {
                "bt-stamped": {
                    "steps": [{"step_index": 0, "action": "navigate"}],
                    "owner_user_id": "u-1",
                    "updated_at": _iso(1),
                },
                "bt-legacy-no-owner": {
                    "steps": [{"step_index": 0, "action": "navigate"}],
                    "updated_at": _iso(1),
                },
            }
        ),
        encoding="utf-8",
    )
    store = BrowserTraceStore(file_path=p, screenshot_dir=tmp_path / "shots")
    # 未盖章的记录仍然在盘上(TTL 没到期),但对带身份调用方不可见
    assert store.get_trace("bt-legacy-no-owner", owner_user_id="u-1") is None
    assert store.get_trace("bt-legacy-no-owner", owner_user_id=None) is not None
    # 已盖章的只有属主本人能读
    assert store.get_trace("bt-stamped", owner_user_id="u-2") is None
    assert store.get_trace("bt-stamped", owner_user_id="u-1") is not None


# =============================================================================
# 保留期常量:档位必须与设计一致
# =============================================================================


def test_retention_defaults_aligned_with_repo_tiers():
    """档位是合规承诺的一部分,被改动时应当显式失败,而不是悄悄漂移。

    依据 apps/api/src/services/data-archive-service.ts 的既有分档:
    用户可见会话 180 天 / 审计 90 天 / 仅排障用原文 30 天。
    """
    from app.services import agent_longterm_memory as alm
    from app.services import agent_step_recorder as asr
    from app.services import audit_log as al
    from app.services import browser_trace as bt
    from app.services import vector_memory as vm

    assert vm._DEFAULT_RETENTION_DAYS == 180  # 会话原文:同 relay_messages / IM 档
    assert alm._DEFAULT_RETENTION_DAYS == 180  # 提炼后的用户偏好:用户资产
    assert al._DEFAULT_RETENTION_DAYS == 90  # 审计:同 data-archive audit_logs 档
    assert asr._DEFAULT_RETENTION_DAYS == 30  # 工具入参/diff:同 llm_call_logs 档
    assert bt._DEFAULT_RETENTION_DAYS == 14  # 浏览器操作轨迹:最敏感,最短


def test_every_module_exposes_env_switch():
    """每个模块都要有独立的 env 开关,运维能按类调。"""
    from app.services import agent_longterm_memory as alm
    from app.services import agent_step_recorder as asr
    from app.services import audit_log as al
    from app.services import browser_trace as bt
    from app.services import vector_memory as vm

    for mod in (vm, alm, al, asr, bt):
        assert mod._RETENTION_ENV.endswith("_RETENTION_DAYS"), mod.__name__
    # 开关名互不相同(否则改一个会连带改掉别人)
    names = [mod._RETENTION_ENV for mod in (vm, alm, al, asr, bt)]
    assert len(set(names)) == 5


def test_env_switch_actually_takes_effect(monkeypatch: pytest.MonkeyPatch):
    """env 开关不是摆设:改它,保留期真的跟着变。"""
    from app.services import audit_log as al

    monkeypatch.setenv(al._RETENTION_ENV, "1")
    assert tjs.resolve_retention_days(al._RETENTION_ENV, al._DEFAULT_RETENTION_DAYS) == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
