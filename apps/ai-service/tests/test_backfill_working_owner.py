# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""working 属主回填器的判据用例(2026-09-28;纯计划 + 临时目录端到端 + 权威三态)。

三条不可让的验收,各自对应一组用例:
  1. **幂等**:同一份数据跑两次,第二次必须"计划补 0 条、且不写盘、不新增快照"——
     不是"跑两次结果一样"(那在"每次都整份重写"的实现下也成立),而是第二次
     **一个字节都不该再动**;
  2. **推不出 owner 的一份都不硬塞**:权威侧查不到行(no_evidence)与查到多个 user_id
     (ambiguous)两种情况都必须**保持无主并各自计数**,断言直接打在生产出来的文件上,
     不是只打计划对象(计划对、写盘错是这一族唯一真正会伤到数据的形态);
  3. **快照 + 回滚**:写盘前必落快照,`--rollback` 整份还原到与原状**逐字同形**;
     还原本身也先留现场(反悔的反悔仍可追)。

测试隔离(AGENTS §5):全程 **不连任何数据库**。权威侧用注入的 `MappingAuthority`
或 `--authority-json` 离线映射 —— 这正是"回填脚本要能在临时目录上演练"的落点,
也是本票能进 CI 的前提(真库路径由 `open_db_authority` 独自承担,本文件一条都不碰)。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest

from app.services.memory_service import MemoryService

pytestmark = pytest.mark.real_jwt

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
BACKFILL_SCRIPT = AI_SERVICE_ROOT / "scripts" / "backfill_working_owner.py"


def _load_backfill_module() -> Any:
    spec = importlib.util.spec_from_file_location("backfill_working_owner_tested", BACKFILL_SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


bf = _load_backfill_module()

_USER_A = "owner-a-backfill-test"
_USER_B = "owner-b-backfill-test"
_USER_C = "owner-c-backfill-test"


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """本文件一条用例都不允许碰库(权威侧一律注入假件,见模块 docstring)。"""

    async def _no_connect(*args: object, **kwargs: object) -> None:
        raise AssertionError("回填器用例不得连任何数据库(生产 PG 8810 禁连)")

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("回填器用例不得创建 asyncpg 连接池")

    monkeypatch.setattr("asyncpg.connect", _no_connect)
    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


def _entry(entry_id: str, owner: str | None = None) -> dict[str, Any]:
    msg: dict[str, Any] = {
        "id": entry_id,
        "layer": "working",
        "sessionId": "s",
        "role": "user",
        "content": f"c-{entry_id}",
        "metadata": {},
    }
    if owner:
        msg["userId"] = owner
    return msg


# ---------------------------------------------------------------------------
# 权威三态:classify_evidence
# ---------------------------------------------------------------------------


def test_classify_evidence_three_states_are_not_merged() -> None:
    """no_evidence 与 ambiguous 不得并成一桶(前者是"库里没记",后者是"数据自相矛盾")。"""
    none_ = bf.classify_evidence("s1", 0, None)
    amb = bf.classify_evidence("s2", 2, _USER_A)
    uniq = bf.classify_evidence("s3", 1, _USER_A)
    assert (none_.kind, amb.kind, uniq.kind) == ("no_evidence", "ambiguous", "unique")
    assert uniq.user_id == _USER_A
    assert amb.user_id is None, "歧义证据不得带出任何一个 user_id(带了就等于替人猜了一个)"
    # 有 sample 但 distinct=0、有 distinct 但 sample 空 ⇒ 都算推不出,不猜
    assert bf.classify_evidence("s4", 0, _USER_A).kind == "no_evidence"
    assert bf.classify_evidence("s5", 1, "").kind == "no_evidence"


async def test_mapping_authority_treats_duplicate_ids_as_unique() -> None:
    """同一 user 被写过 N 次仍是 unique;**不同** user 才叫 ambiguous。"""
    auth = bf.MappingAuthority({
        "dup": [_USER_A, _USER_A, _USER_A],
        "two": [_USER_A, _USER_B],
        "single": _USER_C,
    })
    got = await auth.evidence_for(["dup", "two", "single", "absent"])
    assert got["dup"].kind == "unique" and got["dup"].user_id == _USER_A
    assert got["two"].kind == "ambiguous"
    assert got["single"].kind == "unique" and got["single"].user_id == _USER_C
    assert got["absent"].kind == "no_evidence", "映射里没有这个键 ⇒ 无从对账,不是'没写入'"


# ---------------------------------------------------------------------------
# 纯计划层
# ---------------------------------------------------------------------------


def test_plan_backfill_stamps_only_what_authority_proves() -> None:
    buckets = {
        "provable": [_entry("1"), _entry("2")],
        "no-evidence": [_entry("3")],
        "ambiguous": [_entry("4")],
        "already-owned": [_entry("5", _USER_A)],
        "conflicting": [_entry("6", _USER_B)],
    }
    evidence = {
        "provable": bf.classify_evidence("provable", 1, _USER_A),
        "no-evidence": bf.classify_evidence("no-evidence", 0, None),
        "ambiguous": bf.classify_evidence("ambiguous", 2, _USER_A),
        "already-owned": bf.classify_evidence("already-owned", 1, _USER_A),
        "conflicting": bf.classify_evidence("conflicting", 1, _USER_A),
        "authority-only-no-bucket": bf.classify_evidence("authority-only-no-bucket", 1, _USER_A),
    }
    plan = bf.plan_backfill(buckets, evidence)
    assert plan.owners_to_write == {"provable": _USER_A}
    assert plan.entries_to_stamp == 2
    assert plan.entries_already_owned == 1
    assert plan.entries_conflicting == 1, "已有不同属主 ⇒ 不覆盖,只计冲突"
    assert plan.no_evidence_sessions == ["no-evidence"]
    assert plan.ambiguous_sessions == ["ambiguous"]
    assert plan.evidence_only_sessions == ["authority-only-no-bucket"], (
        "权威侧多出、桶里没有的 session 只报数 —— 给它写 owner 等于凭空造数据"
    )


def test_plan_on_post_apply_state_is_empty_idempotency_at_the_planning_layer() -> None:
    """计划层的幂等:第一轮之后把结果喂回第二轮 ⇒ 零计划。"""
    buckets = {"s": [_entry("1")]}
    evidence = {"s": bf.classify_evidence("s", 1, _USER_A)}
    first = bf.plan_backfill(buckets, evidence)
    assert first.entries_to_stamp == 1
    for sid, owner in first.owners_to_write.items():
        for msg in buckets[sid]:
            msg.setdefault("userId", owner)
    second = bf.plan_backfill(buckets, evidence)
    assert second.owners_to_write == {} and second.entries_to_stamp == 0
    assert second.entries_already_owned == 1


def test_plan_does_not_overwrite_a_different_owner() -> None:
    """冲突的一律保留原属主(权威列也可能因为一次错误的 episodic 写入而"看起来更权威")。"""
    buckets = {"s": [_entry("1", _USER_B), _entry("2")]}
    evidence = {"s": bf.classify_evidence("s", 1, _USER_A)}
    plan = bf.plan_backfill(buckets, evidence)
    assert plan.entries_conflicting == 1 and plan.entries_to_stamp == 1
    assert buckets["s"][0]["userId"] == _USER_B, "plan_backfill 必须是纯函数,不许就地改数据"


# ---------------------------------------------------------------------------
# 临时目录端到端:幂等 / 不硬塞 / 快照 / 回滚
# ---------------------------------------------------------------------------


@pytest.fixture
def working_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "wb"
    directory.mkdir()
    buckets = {
        "provable": [_entry("p1"), _entry("p2")],
        "no-evidence": [_entry("n1")],
        "ambiguous": [_entry("a1")],
        "conflicting": [_entry("c1", _USER_B)],
    }
    (directory / bf.BUCKETS_FILENAME).write_text(
        json.dumps(buckets, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return directory


def _read(directory: Path) -> dict[str, list[dict[str, Any]]]:
    return json.loads((directory / bf.BUCKETS_FILENAME).read_text(encoding="utf-8"))


def _authority() -> Any:
    return bf.MappingAuthority({"provable": _USER_A, "no-evidence": None, "ambiguous": [_USER_A, _USER_B], "conflicting": _USER_A})


async def _run(directory: Path, extra: list[str], authority: Any) -> int:
    args = bf.parse_args(["--working-dir", str(directory), *extra])
    return await bf.amain(args, authority=authority)


async def test_cli_dry_run_writes_nothing(working_dir: Path) -> None:
    before = (working_dir / bf.BUCKETS_FILENAME).read_bytes()
    rc = await _run(working_dir, [], _authority())
    assert rc == 0
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() == before, "dry-run 动了盘"
    assert not (working_dir / bf.SNAPSHOT_SUBDIR).exists(), "dry-run 不该产快照"


async def test_cli_apply_is_idempotent_and_never_stamps_unprovable(working_dir: Path) -> None:
    """第一轮写、第二轮**一个字节都不再动**;两种"推不出"的桶保持无主。"""
    original = _read(working_dir)
    assert await _run(working_dir, ["--apply", "--confirm", bf.CONFIRM_TOKEN], _authority()) == 0
    after_first = _read(working_dir)
    assert [e.get("userId") for e in after_first["provable"]] == [_USER_A, _USER_A]
    assert "userId" not in after_first["no-evidence"][0], (
        "权威侧查不到行也被塞了 owner ⇒ 回填把「不知道」伪装成「知道」"
    )
    assert "userId" not in after_first["ambiguous"][0], "多 user_id 的桶被硬塞了一个 ⇒ 猜的"
    assert after_first["conflicting"][0]["userId"] == _USER_B, "已有属主的条目被覆盖"
    assert list(original) == list(after_first), "桶集合被改动(只该改条目里的属主)"

    snapshot_dir = working_dir / bf.SNAPSHOT_SUBDIR
    snaps_after_first = sorted(snapshot_dir.glob("snapshot-*.json"))
    assert len(snaps_after_first) == 1, f"写盘前必须留且只留一份快照:{snaps_after_first}"
    bytes_after_first = (working_dir / bf.BUCKETS_FILENAME).read_bytes()

    assert await _run(working_dir, ["--apply", "--confirm", bf.CONFIRM_TOKEN], _authority()) == 0
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() == bytes_after_first, "第二轮又写了一次盘"
    assert sorted(snapshot_dir.glob("snapshot-*.json")) == snaps_after_first, (
        "第二轮无事可做却新增快照 ⇒ 命中 0 那条出口没生效(幂等只写在文案里)"
    )


async def test_cli_rollback_restores_original_bytes(working_dir: Path) -> None:
    original_bytes = (working_dir / bf.BUCKETS_FILENAME).read_bytes()
    assert await _run(working_dir, ["--apply", "--confirm", bf.CONFIRM_TOKEN], _authority()) == 0
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() != original_bytes
    snapshot = sorted((working_dir / bf.SNAPSHOT_SUBDIR).glob("snapshot-*.json"))[0]

    # 回滚也有 dry-run:不加 --apply 时不许动盘
    rc = await _run(working_dir, ["--rollback", str(snapshot)], _authority())
    assert rc == 0
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() != original_bytes, "回滚 dry-run 就还原了"

    assert await _run(
        working_dir, ["--rollback", str(snapshot), "--apply", "--confirm", bf.CONFIRM_TOKEN], _authority()
    ) == 0
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() == original_bytes, (
        "回滚后必须与最初**逐字**同形,而不是'语义差不多'"
    )


async def test_cli_apply_refused_without_confirm_token(working_dir: Path) -> None:
    before = (working_dir / bf.BUCKETS_FILENAME).read_bytes()
    args = bf.parse_args(["--working-dir", str(working_dir), "--apply"])
    rc = await bf.amain(args, authority=_authority())
    assert rc == 1, "缺 --confirm 必须拒绝写入并给非零码"
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() == before


async def test_cli_rejects_foreign_snapshot_on_rollback(working_dir: Path) -> None:
    """不是本工具产出的快照(缺标记)⇒ 拒绝还原,exit 2 无法判定。"""
    foreign = working_dir / "someone-else.json"
    foreign.write_text(json.dumps({"provable": [_entry("x", _USER_C)]}), encoding="utf-8")
    rc = await _run(working_dir, ["--rollback", str(foreign), "--apply", "--confirm", bf.CONFIRM_TOKEN], _authority())
    assert rc == 2
    assert all("userId" not in e for e in _read(working_dir)["provable"]), "被来历不明的快照覆盖了"


async def test_cli_missing_target_dir_is_undetermined_not_zero(tmp_path: Path) -> None:
    """目录不存在 / 导出件缺失 ⇒ exit 2「无法判定」,绝不把「什么都没扫到」当成功。"""
    rc = await _run(tmp_path / "nope", [], _authority())
    assert rc == 2
    empty = tmp_path / "empty"
    empty.mkdir()
    assert await _run(empty, [], _authority()) == 2


async def test_cli_unreadable_authority_is_undetermined_and_writes_nothing(
    working_dir: Path, tmp_path: Path
) -> None:
    """权威映射文件坏了 ⇒ 无法判定,且目标文件一字节不动。"""
    before = (working_dir / bf.BUCKETS_FILENAME).read_bytes()
    broken = tmp_path / "bad-auth.json"
    broken.write_text("{not json", encoding="utf-8")
    args = bf.parse_args(
        [
            "--working-dir",
            str(working_dir),
            "--authority-json",
            str(broken),
            "--apply",
            "--confirm",
            bf.CONFIRM_TOKEN,
        ]
    )
    assert await bf.amain(args) == 2
    assert (working_dir / bf.BUCKETS_FILENAME).read_bytes() == before


async def test_cli_refuses_service_target(working_dir: Path) -> None:
    """CLI 打活进程的内存是**幻影出口**:那个桶是本进程自己的空桶。"""
    args = bf.parse_args(["--target", "service"])
    assert await bf.amain(args, authority=_authority()) == 2


def test_parse_args_requires_working_dir() -> None:
    with pytest.raises(SystemExit):
        bf.parse_args([])


# ---------------------------------------------------------------------------
# 进程内出口:apply_to_service(真实 MemoryService)+ 回滚
# ---------------------------------------------------------------------------


async def test_apply_to_service_dry_run_then_apply_then_restore() -> None:
    svc = MemoryService(gateway=object())  # type: ignore[arg-type]
    await svc.add_working("provable", "user", "p")
    await svc.add_working("unprovable", "user", "u")
    authority = bf.MappingAuthority({"provable": _USER_A, "unprovable": None})

    plan, snapshot = await bf.apply_to_service(svc, authority, dry_run=True)
    assert plan.entries_to_stamp == 1
    assert await svc.snapshot_working() == snapshot, "dry-run 不该改任何东西"

    plan2, before = await bf.apply_to_service(svc, authority, dry_run=False)
    assert plan2.entries_to_stamp == 1
    owners = [e.get("userId") for e in (await svc.snapshot_working())["provable"]]
    assert owners == [_USER_A]
    owners_unprovable = [e.get("userId") for e in (await svc.snapshot_working())["unprovable"]]
    assert owners_unprovable == [None], "推不出 owner 的一份都不许塞"

    plan3, _ = await bf.apply_to_service(svc, authority, dry_run=False)
    assert plan3.owners_to_write == {} and plan3.entries_to_stamp == 0, "第二次必须零改动"

    await svc.restore_working(before)
    restored = await svc.snapshot_working()
    assert [e.get("userId") for e in restored["provable"]] == [None]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
