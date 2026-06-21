"""Backfill 事件定义 (建议 148 拆分) - app/backfill_event.py.

从 backfill_broadcaster 拆出, 避免 broadcaster <-> persister 循环依赖.
"""

from __future__ import annotations

import enum
import json
import time
from dataclasses import asdict, dataclass, field


class BackfillEventType(enum.StrEnum):
    STARTED = "started"
    TENANT_PROGRESS = "tenant_progress"
    TENANT_DONE = "tenant_done"
    TABLE_DONE = "table_done"
    ERROR = "error"
    COMPLETE = "complete"
    HEARTBEAT = "heartbeat"


@dataclass
class BackfillEvent:
    event_type: BackfillEventType
    table: str
    tenant_id: int | None = None
    processed: int = 0
    total: int = 0
    percent: float = 0.0
    eta_seconds: float = 0.0
    error: str = ""
    timestamp: float = field(default_factory=time.time)

    def to_sse(self) -> str:
        d = asdict(self)
        d["event_type"] = self.event_type.value
        return f"event: {self.event_type.value}\ndata: {json.dumps(d, ensure_ascii=False)}\n\n"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["event_type"] = self.event_type.value
        return d
