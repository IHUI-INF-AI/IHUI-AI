"""Bug-98: 数据库 schema 迁移灰度 (双写期 -> 读路径双读 -> 切流).

设计:
  - 阶段 (phase): 0=只写旧列, 1=双写 (旧+新), 2=双读 (优先新), 3=只新
  - 任意 phase 可回滚
  - 进度跟踪: dual_write_count, new_read_count, old_read_count
  - 覆盖率到 100% 时建议切到下一阶段
  - 切流前需双重确认: confirm_cutover

使用:
    from app.utils.schema_migration import migration_controller

    migration_controller.register(table="users", old_col="name", new_col="full_name")
    migration_controller.set_phase("users", 1)  # 启用双写
    migration_controller.maybe_cutover("users")  # 评估是否切到下一阶段
"""

import logging
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

PHASE_OLD_ONLY = 0
PHASE_DUAL_WRITE = 1
PHASE_DUAL_READ = 2
PHASE_NEW_ONLY = 3

PHASE_NAMES = {
    PHASE_OLD_ONLY: "old_only",
    PHASE_DUAL_WRITE: "dual_write",
    PHASE_DUAL_READ: "dual_read",
    PHASE_NEW_ONLY: "new_only",
}


@dataclass
class MigrationState:
    table: str
    old_col: str
    new_col: str
    phase: int = PHASE_OLD_ONLY
    confirmed_at: float = 0.0
    started_at: float = field(default_factory=time.time)
    dual_write_count: int = 0
    new_read_count: int = 0
    old_read_count: int = 0
    inconsistency_count: int = 0
    last_check_at: float = 0.0

    def to_dict(self) -> dict:
        total = self.new_read_count + self.old_read_count
        return {
            "table": self.table,
            "old_col": self.old_col,
            "new_col": self.new_col,
            "phase": self.phase,
            "phase_name": PHASE_NAMES[self.phase],
            "confirmed_at": round(self.confirmed_at, 3),
            "started_at": round(self.started_at, 3),
            "dual_write_count": self.dual_write_count,
            "new_read_count": self.new_read_count,
            "old_read_count": self.old_read_count,
            "new_read_ratio": round(self.new_read_count / total, 4) if total else 0.0,
            "inconsistency_count": self.inconsistency_count,
            "last_check_at": round(self.last_check_at, 3),
        }


class SchemaMigrationController:
    """Schema 迁移灰度控制器."""

    def __init__(self):
        self._lock = threading.RLock()
        self._migrations: dict[str, MigrationState] = {}
        self._read_ratio_threshold = 0.999  # 99.9% 走新列才建议切流
        self._inconsistency_tolerance = 0.001  # 不一致率上限

    def set_thresholds(self, read_ratio: float = 0.999, inconsistency_tolerance: float = 0.001) -> None:
        with self._lock:
            self._read_ratio_threshold = read_ratio
            self._inconsistency_tolerance = inconsistency_tolerance

    def register(self, table: str, old_col: str, new_col: str) -> None:
        with self._lock:
            if table not in self._migrations:
                self._migrations[table] = MigrationState(table=table, old_col=old_col, new_col=new_col)

    def unregister(self, table: str) -> None:
        with self._lock:
            self._migrations.pop(table, None)

    def set_phase(self, table: str, phase: int) -> bool:
        if phase not in PHASE_NAMES:
            return False
        with self._lock:
            m = self._migrations.get(table)
            if m is None:
                return False
            m.phase = phase
            m.confirmed_at = time.time() if phase == PHASE_NEW_ONLY else 0.0
            return True

    def get_phase(self, table: str) -> int:
        with self._lock:
            m = self._migrations.get(table)
            return m.phase if m else -1

    def record_dual_write(self, table: str) -> None:
        with self._lock:
            m = self._migrations.get(table)
            if m is not None:
                m.dual_write_count += 1

    def record_read(self, table: str, used_new: bool) -> None:
        with self._lock:
            m = self._migrations.get(table)
            if m is not None:
                if used_new:
                    m.new_read_count += 1
                else:
                    m.old_read_count += 1

    def record_inconsistency(self, table: str) -> None:
        with self._lock:
            m = self._migrations.get(table)
            if m is not None:
                m.inconsistency_count += 1

    def can_cutover(self, table: str) -> bool:
        """评估是否可以切到下一阶段."""
        with self._lock:
            m = self._migrations.get(table)
            if m is None:
                return False
            total = m.new_read_count + m.old_read_count
            if total < 100:
                return False  # 样本太少
            new_ratio = m.new_read_count / total
            if new_ratio < self._read_ratio_threshold:
                return False
            inc_rate = m.inconsistency_count / total
            if inc_rate > self._inconsistency_tolerance:
                return False
        return True

    def maybe_cutover(self, table: str, force: bool = False) -> bool:
        """评估并切流. 返回 True 表示切了."""
        with self._lock:
            m = self._migrations.get(table)
            if m is None:
                return False
            if not force and not self.can_cutover(table):
                return False
            if m.phase >= PHASE_NEW_ONLY:
                return False
            m.phase += 1
            m.confirmed_at = time.time() if m.phase == PHASE_NEW_ONLY else 0.0
            logger.info(f"schema_migration: {table} -> {PHASE_NAMES[m.phase]}")
            return True

    def rollback(self, table: str) -> bool:
        """回滚到上一阶段."""
        with self._lock:
            m = self._migrations.get(table)
            if m is None or m.phase <= PHASE_OLD_ONLY:
                return False
            m.phase -= 1
            m.confirmed_at = 0.0
            return True

    def confirm_cutover(self, table: str) -> bool:
        """双重确认切到 NEW_ONLY (phase 3). 需先 can_cutover."""
        if not self.can_cutover(table):
            return False
        with self._lock:
            m = self._migrations.get(table)
            if m is None or m.phase < PHASE_DUAL_READ:
                return False
            m.phase = PHASE_NEW_ONLY
            m.confirmed_at = time.time()
        return True

    def get_state(self, table: str) -> dict[str, str] | None:
        with self._lock:
            m = self._migrations.get(table)
            return m.to_dict() if m else None

    def list_all(self) -> list[dict[str, str]]:
        with self._lock:
            return [m.to_dict() for m in self._migrations.values()]

    def stats(self) -> dict:
        with self._lock:
            by_phase: dict[str, int] = {}
            for m in self._migrations.values():
                pn = PHASE_NAMES.get(m.phase, "unknown")
                by_phase[pn] = by_phase.get(pn, 0) + 1
            return {
                "tables": len(self._migrations),
                "by_phase": by_phase,
                "read_ratio_threshold": self._read_ratio_threshold,
                "inconsistency_tolerance": self._inconsistency_tolerance,
            }


# 全局单例
migration_controller = SchemaMigrationController()
