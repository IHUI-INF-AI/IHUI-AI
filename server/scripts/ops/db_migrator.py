"""Phase 20 建议 1: 数据库迁移 zero-downtime - 灰度切换 + 自动回滚.

目的:
  - 大表迁移不停服
  - 4 阶段: SHADOW_WRITE -> DUAL_READ -> PRIMARY -> CUTOVER
  - 数据校验 (对比新旧)
  - 任意阶段可回滚
  - 完整审计

设计:
  TableMapping:
    old_table, new_table, column_map (old_col -> new_col)

  DataValidator:
    compare(old_row, new_row, column_map) -> Diff (status: match/mismatch/missing)

  MigrationState:
    当前阶段 / 进度 / 错误数 / 偏差数

  MigrationController:
    start(mapping) -> 进入 SHADOW_WRITE
    progress(validator) -> 推进到下一阶段 (需满足阈值)
    promote() / rollback()
    events / report
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


class MigrationPhase(str, Enum):
    PENDING = "pending"
    SHADOW_WRITE = "shadow_write"  # 阶段 1: 双写
    DUAL_READ = "dual_read"  # 阶段 2: 双写+双读+对比
    PRIMARY = "primary"  # 阶段 3: 新表为主
    CUTOVER = "cutover"  # 阶段 4: 完全切换
    ROLLED_BACK = "rolled_back"


class DiffStatus(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    MISSING = "missing"
    EXTRA = "extra"


@dataclass
class ColumnMapping:
    old_name: str
    new_name: str
    transform: str | None = None  # 简单 transform 描述 (lower/upper/cast)


@dataclass
class TableMapping:
    old_table: str
    new_table: str
    columns: list[ColumnMapping] = field(default_factory=list)
    key_columns: list[str] = field(default_factory=list)  # 用于行匹配

    def to_dict(self) -> dict:
        return {
            "old_table": self.old_table,
            "new_table": self.new_table,
            "columns": [{"old": c.old_name, "new": c.new_name, "transform": c.transform} for c in self.columns],
            "key_columns": list(self.key_columns),
        }


@dataclass
class RowDiff:
    key: Any
    status: DiffStatus
    mismatched_fields: list[str] = field(default_factory=list)
    old: dict | None = None
    new: dict | None = None

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "status": self.status.value,
            "mismatched_fields": self.mismatched_fields,
        }


@dataclass
class CutoverEvent:
    ts: float
    from_phase: str
    to_phase: str
    reason: str = ""
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "from_phase": self.from_phase,
            "to_phase": self.to_phase,
            "reason": self.reason,
            **self.details,
        }


# ---------------------------------------------------------------------------
# 2. DataValidator
# ---------------------------------------------------------------------------


class DataValidator:
    """数据对比器."""

    def __init__(self, mapping: TableMapping):
        self.mapping = mapping

    def _extract_mapped(self, row: dict, side: str) -> dict:
        out: dict = {}
        for col in self.mapping.columns:
            src = col.old_name if side == "old" else col.new_name
            if src in row:
                v = row[src]
                if col.transform == "lower" and isinstance(v, str):
                    v = v.lower()
                elif col.transform == "upper" and isinstance(v, str):
                    v = v.upper()
                elif col.transform == "int" and v is not None:
                    try:
                        v = int(v)
                    except (ValueError, TypeError):
                        pass
                out[col.old_name] = v
        return out

    def compare(self, old_rows: list[dict], new_rows: list[dict]) -> list[RowDiff]:
        old_by_key = {self._key(r): r for r in old_rows}
        new_by_key = {self._key(r): r for r in new_rows}
        keys = set(old_by_key) | set(new_by_key)
        diffs: list[RowDiff] = []
        for k in keys:
            if k not in old_by_key:
                diffs.append(RowDiff(key=k, status=DiffStatus.EXTRA, new=new_by_key[k]))
            elif k not in new_by_key:
                diffs.append(RowDiff(key=k, status=DiffStatus.MISSING, old=old_by_key[k]))
            else:
                o = self._extract_mapped(old_by_key[k], "old")
                n = self._extract_mapped(new_by_key[k], "new")
                mismatched = [f for f in o if f in n and o[f] != n[f]]
                if mismatched:
                    diffs.append(
                        RowDiff(
                            key=k,
                            status=DiffStatus.MISMATCH,
                            mismatched_fields=mismatched,
                            old=old_by_key[k],
                            new=new_by_key[k],
                        )
                    )
                else:
                    diffs.append(RowDiff(key=k, status=DiffStatus.MATCH))
        return diffs

    def _key(self, row: dict) -> Any:
        if not self.mapping.key_columns:
            return id(row)
        return tuple(row.get(c) for c in self.mapping.key_columns)


# ---------------------------------------------------------------------------
# 3. MigrationController
# ---------------------------------------------------------------------------


class MigrationController:
    """迁移控制器."""

    PHASE_ORDER = [
        MigrationPhase.PENDING,
        MigrationPhase.SHADOW_WRITE,
        MigrationPhase.DUAL_READ,
        MigrationPhase.PRIMARY,
        MigrationPhase.CUTOVER,
    ]

    def __init__(self, mapping: TableMapping, mismatch_threshold: float = 0.01, min_rows_validated: int = 100):
        self.mapping = mapping
        self.mismatch_threshold = mismatch_threshold
        self.min_rows_validated = min_rows_validated
        self.phase: MigrationPhase = MigrationPhase.PENDING
        self._events: list[CutoverEvent] = []
        self._stats: dict[str, int] = {
            "rows_compared": 0,
            "mismatches": 0,
            "missing": 0,
            "extra": 0,
            "matches": 0,
        }

    def start(self, now: float | None = None) -> CutoverEvent:
        t = now or time.time()
        if self.phase != MigrationPhase.PENDING:
            raise ValueError(f"already started: {self.phase}")
        ev = self._transition(
            t,
            MigrationPhase.PENDING,
            MigrationPhase.SHADOW_WRITE,
            reason="start migration",
            details={"table": self.mapping.old_table},
        )
        return ev

    def validate(self, old_rows: list[dict], new_rows: list[dict], now: float | None = None) -> dict:
        t = now or time.time()
        if self.phase == MigrationPhase.PENDING:
            raise ValueError("not started")
        if self.phase == MigrationPhase.ROLLED_BACK:
            raise ValueError("rolled back")
        validator = DataValidator(self.mapping)
        diffs = validator.compare(old_rows, new_rows)
        self._stats["rows_compared"] += len(diffs)
        for d in diffs:
            if d.status == DiffStatus.MATCH:
                self._stats["matches"] += 1
            elif d.status == DiffStatus.MISMATCH:
                self._stats["mismatches"] += 1
            elif d.status == DiffStatus.MISSING:
                self._stats["missing"] += 1
            elif d.status == DiffStatus.EXTRA:
                self._stats["extra"] += 1
        return {
            "diffs_count": len(diffs),
            "mismatches": self._stats["mismatches"],
            "mismatch_rate": self._mismatch_rate(),
        }

    def _mismatch_rate(self) -> float:
        n = self._stats["rows_compared"]
        if n == 0:
            return 0.0
        return self._stats["mismatches"] / n

    def can_promote(self) -> tuple[bool, str]:
        if self.phase == MigrationPhase.ROLLED_BACK:
            return False, "rolled back"
        if self.phase == MigrationPhase.CUTOVER:
            return False, "already cutover"
        if self._stats["rows_compared"] < self.min_rows_validated:
            return False, f"insufficient samples: {self._stats['rows_compared']} < {self.min_rows_validated}"
        if self._mismatch_rate() > self.mismatch_threshold:
            return False, f"mismatch rate too high: {self._mismatch_rate():.2%} > {self.mismatch_threshold:.2%}"
        return True, "ok"

    def promote(self, now: float | None = None) -> CutoverEvent:
        t = now or time.time()
        ok, reason = self.can_promote()
        if not ok:
            raise ValueError(f"cannot promote: {reason}")
        idx = self.PHASE_ORDER.index(self.phase)
        next_phase = self.PHASE_ORDER[idx + 1]
        return self._transition(
            t, self.phase, next_phase, reason="promote", details={"mismatch_rate": round(self._mismatch_rate(), 4)}
        )

    def rollback(self, reason: str = "manual", now: float | None = None) -> CutoverEvent:
        t = now or time.time()
        return self._transition(
            t, self.phase, MigrationPhase.ROLLED_BACK, reason=reason, details={"prev_phase": self.phase.value}
        )

    def _transition(
        self, ts: float, frm: MigrationPhase, to: MigrationPhase, reason: str = "", details: dict | None = None
    ) -> CutoverEvent:
        ev = CutoverEvent(
            ts=ts,
            from_phase=frm.value,
            to_phase=to.value,
            reason=reason,
            details=details or {},
        )
        self._events.append(ev)
        self.phase = to
        return ev

    def events(self, limit: int = 50) -> list[dict]:
        return [e.to_dict() for e in self._events[-limit:]]

    def stats(self) -> dict:
        return dict(self._stats)

    def report(self) -> str:
        s = self.stats()
        lines = ["# 数据库迁移报表", ""]
        lines.append(f"- 当前阶段: **{self.phase.value}**")
        lines.append(f"- 旧表: `{self.mapping.old_table}` -> 新表: `{self.mapping.new_table}`")
        lines.append("")
        lines.append("## 数据校验统计")
        lines.append("")
        lines.append(f"- 比较行数: **{s['rows_compared']}**")
        lines.append(f"- 完全一致: **{s['matches']}**")
        lines.append(f"- 字段不一致: **{s['mismatches']}**")
        lines.append(f"- 缺失行: **{s['missing']}**")
        lines.append(f"- 多余行: **{s['extra']}**")
        lines.append(f"- 不一致率: **{self._mismatch_rate()*100:.2f}%**")
        lines.append("")
        if self._events:
            lines.append("## 阶段切换")
            lines.append("")
            lines.append("| 时间 | 起始 -> 目标 | 原因 |")
            lines.append("| --- | --- | --- |")
            for e in self._events[-20:]:
                ts_iso = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(e.ts))
                lines.append(f"| {ts_iso} | {e.from_phase} -> {e.to_phase} | {e.reason} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def _demo() -> dict:
    mapping = TableMapping(
        old_table="users_legacy",
        new_table="users",
        columns=[
            ColumnMapping("uid", "id"),
            ColumnMapping("uname", "username", transform="lower"),
            ColumnMapping("uemail", "email", transform="lower"),
        ],
        key_columns=["id"],
    )
    controller = MigrationController(mapping, mismatch_threshold=0.1, min_rows_validated=10)
    out = {"phases": []}
    out["phases"].append({"step": "start", "event": controller.start().to_dict()})
    # 准备数据
    old_rows = [
        {"id": 1, "uname": "Alice", "uemail": "Alice@Example.com"},
        {"id": 2, "uname": "Bob", "uemail": "Bob@Example.com"},
        {"id": 3, "uname": "Charlie", "uemail": "Charlie@Example.com"},
    ]
    new_rows = [
        {"id": 1, "username": "alice", "email": "alice@example.com"},
        {"id": 2, "username": "bob", "email": "bob@example.com"},
        {"id": 3, "username": "charlie", "email": "charlie@example.com"},
    ]
    for _ in range(5):  # 累计 15 行
        controller.validate(old_rows, new_rows)
    out["phases"].append({"step": "validate_d1", "result": {"mismatch_rate": round(controller._mismatch_rate(), 4)}})
    out["phases"].append({"step": "promote_to_dual_read", "event": controller.promote().to_dict()})
    out["phases"].append({"step": "promote_to_primary", "event": controller.promote().to_dict()})
    out["phases"].append({"step": "promote_to_cutover", "event": controller.promote().to_dict()})
    out["stats"] = controller.stats()
    out["final_phase"] = controller.phase.value
    return out


def main(argv: list[str] | None = None, controller: MigrationController | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="数据库迁移 zero-downtime")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("demo")
    sub.add_parser("report")
    args = p.parse_args(argv)
    if args.cmd == "demo":
        out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "report":
        c = controller or MigrationController(TableMapping("a", "b"))
        print(c.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
