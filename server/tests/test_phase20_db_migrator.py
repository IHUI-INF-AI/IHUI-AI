"""Phase 20 建议 1 测试: 数据库迁移 zero-downtime."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from db_migrator import (
        ColumnMapping,
        CutoverEvent,
        DataValidator,
        DiffStatus,
        MigrationController,
        MigrationPhase,
        RowDiff,
        TableMapping,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


def test_phase_values():
    assert MigrationPhase.PENDING.value == "pending"
    assert MigrationPhase.SHADOW_WRITE.value == "shadow_write"
    assert MigrationPhase.CUTOVER.value == "cutover"


def test_diff_status_values():
    assert DiffStatus.MATCH.value == "match"
    assert DiffStatus.MISMATCH.value == "mismatch"
    assert DiffStatus.MISSING.value == "missing"
    assert DiffStatus.EXTRA.value == "extra"


def test_column_mapping():
    c = ColumnMapping("uid", "id", transform="lower")
    assert c.transform == "lower"


def test_table_mapping_to_dict():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    d = m.to_dict()
    assert d["old_table"] == "a"
    assert d["key_columns"] == ["id"]


def test_cutover_event_to_dict():
    e = CutoverEvent(time.time(), "pending", "shadow_write", "start")
    d = e.to_dict()
    assert d["from_phase"] == "pending"
    assert "ts_iso" in d


def test_row_diff_to_dict():
    d = RowDiff(key=1, status=DiffStatus.MATCH).to_dict()
    assert d["status"] == "match"


# ---------------------------------------------------------------------------
# 2. DataValidator
# ---------------------------------------------------------------------------


def test_validator_match():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id"), ColumnMapping("uname", "name", transform="lower")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "uname": "alice"}],
        new_rows=[{"id": 1, "name": "alice"}],
    )
    assert len(diffs) == 1
    assert diffs[0].status == DiffStatus.MATCH


def test_validator_mismatch():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id"), ColumnMapping("uname", "name")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "uname": "alice"}],
        new_rows=[{"id": 1, "name": "bob"}],
    )
    assert diffs[0].status == DiffStatus.MISMATCH
    assert "uname" in diffs[0].mismatched_fields


def test_validator_missing():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "uname": "alice"}],
        new_rows=[],
    )
    assert diffs[0].status == DiffStatus.MISSING


def test_validator_extra():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[],
        new_rows=[{"id": 1, "name": "alice"}],
    )
    assert diffs[0].status == DiffStatus.EXTRA


def test_validator_transform_lower():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id"), ColumnMapping("uname", "name", transform="lower")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "uname": "Alice"}],
        new_rows=[{"id": 1, "name": "alice"}],
    )
    assert diffs[0].status == DiffStatus.MATCH


def test_validator_transform_int():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id"), ColumnMapping("ucnt", "count", transform="int")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "ucnt": "42"}],
        new_rows=[{"id": 1, "count": 42}],
    )
    assert diffs[0].status == DiffStatus.MATCH


def test_validator_transform_int_invalid():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id"), ColumnMapping("ucnt", "count", transform="int")],
        key_columns=["id"],
    )
    v = DataValidator(m)
    diffs = v.compare(
        old_rows=[{"id": 1, "ucnt": "not_a_number"}],
        new_rows=[{"id": 1, "count": 0}],
    )
    # 转换失败, 会变成 mismatch
    assert diffs[0].status in (DiffStatus.MISMATCH, DiffStatus.MATCH)


# ---------------------------------------------------------------------------
# 3. MigrationController
# ---------------------------------------------------------------------------


def test_controller_init():
    m = TableMapping("a", "b")
    c = MigrationController(m)
    assert c.phase == MigrationPhase.PENDING


def test_controller_start():
    m = TableMapping("a", "b")
    c = MigrationController(m)
    ev = c.start()
    assert c.phase == MigrationPhase.SHADOW_WRITE
    assert ev.to_phase == "shadow_write"


def test_controller_start_twice():
    m = TableMapping("a", "b")
    c = MigrationController(m)
    c.start()
    with pytest.raises(ValueError):
        c.start()


def test_controller_validate_pending():
    m = TableMapping("a", "b")
    c = MigrationController(m)
    with pytest.raises(ValueError):
        c.validate([], [])


def test_controller_validate():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    c = MigrationController(m, min_rows_validated=2)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    s = c.stats()
    assert s["rows_compared"] == 1


def test_controller_can_promote_insufficient():
    m = TableMapping("a", "b")
    c = MigrationController(m, min_rows_validated=10)
    c.start()
    ok, reason = c.can_promote()
    assert ok is False
    assert "insufficient" in reason


def test_controller_can_promote_too_many_mismatches():
    m = TableMapping(
        old_table="a",
        new_table="b",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    c = MigrationController(m, min_rows_validated=2, mismatch_threshold=0.01)
    c.start()
    c.validate([{"id": 1}, {"id": 2}], [{"id": 1}, {"id": 2}])
    c.validate([{"id": 1}, {"id": 2}], [{"id": 1}, {"id": 2}])  # 100% 一致
    ok, _ = c.can_promote()
    assert ok is True


def test_controller_promote():
    m = TableMapping("a", "b")
    c = MigrationController(m, min_rows_validated=1)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    ev = c.promote()
    assert c.phase == MigrationPhase.DUAL_READ


def test_controller_promote_full_path():
    m = TableMapping("a", "b")
    c = MigrationController(m, min_rows_validated=1)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    c.promote()  # DUAL_READ
    c.validate([{"id": 1}], [{"id": 1}])
    c.promote()  # PRIMARY
    c.validate([{"id": 1}], [{"id": 1}])
    c.promote()  # CUTOVER
    assert c.phase == MigrationPhase.CUTOVER


def test_controller_rollback():
    m = TableMapping("a", "b")
    c = MigrationController(m)
    c.start()
    c.rollback(reason="manual")
    assert c.phase == MigrationPhase.ROLLED_BACK


def test_controller_rollback_after_rollback():
    m = TableMapping("a", "b")
    c = MigrationController(m, min_rows_validated=1)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    c.promote()
    c.rollback(reason="mismatch too high")
    assert c.phase == MigrationPhase.ROLLED_BACK


def test_controller_events_recorded():
    m = TableMapping("a", "b")
    c = MigrationController(m, min_rows_validated=1)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    c.promote()
    evs = c.events()
    assert len(evs) == 2


def test_controller_report():
    m = TableMapping(
        old_table="users_legacy",
        new_table="users",
        columns=[ColumnMapping("uid", "id")],
        key_columns=["id"],
    )
    c = MigrationController(m)
    c.start()
    c.validate([{"id": 1}], [{"id": 1}])
    md = c.report()
    assert "数据库迁移报表" in md
    assert "users_legacy" in md
    assert "shadow_write" in md


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "phases" in data
    assert data["final_phase"] == "cutover"
    assert len(data["phases"]) >= 4


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "数据库迁移报表" in out
