# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨项目并行看板:把会话集合聚合成 active/queued/failed/done 的纯函数。"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

from app.services.sandbox.models import SandboxSession, SandboxStatus

__all__ = [
    "STATUS_BUCKET",
    "BoardCounts",
    "Bucket",
    "ProjectBoard",
    "BoardSnapshot",
    "build_board",
]

Bucket = Literal["active", "queued", "failed", "done"]

# 穷举 7 个状态:新增枚举值忘了登记会被测试直接判红,而不是静默落进错误桶
STATUS_BUCKET: Final[dict[SandboxStatus, Bucket]] = {
    SandboxStatus.QUEUED: "queued",
    SandboxStatus.STARTING: "active",
    SandboxStatus.RUNNING: "active",
    SandboxStatus.FINISHED: "done",
    SandboxStatus.REAPED: "done",
    SandboxStatus.FAILED: "failed",
    SandboxStatus.TIMEOUT: "failed",
}


@dataclass(frozen=True)
class BoardCounts:
    active: int
    queued: int
    failed: int
    done: int
    total: int

    @classmethod
    def of(cls, sessions: Sequence[SandboxSession]) -> BoardCounts:
        buckets: dict[Bucket, int] = {"active": 0, "queued": 0, "failed": 0, "done": 0}
        for session in sessions:
            buckets[STATUS_BUCKET[session.status]] += 1
        return cls(
            active=buckets["active"],
            queued=buckets["queued"],
            failed=buckets["failed"],
            done=buckets["done"],
            total=len(sessions),
        )

    @property
    def is_consistent(self) -> bool:
        return self.active + self.queued + self.failed + self.done == self.total


@dataclass(frozen=True)
class ProjectBoard:
    project_id: str
    counts: BoardCounts
    sessions: tuple[SandboxSession, ...]


@dataclass(frozen=True)
class BoardSnapshot:
    totals: BoardCounts
    projects: tuple[ProjectBoard, ...]

    def project(self, project_id: str) -> ProjectBoard | None:
        for item in self.projects:
            if item.project_id == project_id:
                return item
        return None


def build_board(sessions: Sequence[SandboxSession]) -> BoardSnapshot:
    """纯聚合,不改动入参;同一输入必得同一输出(看板要能进快照/对账)。"""
    grouped: dict[str, list[SandboxSession]] = {}
    for session in sessions:
        grouped.setdefault(session.project_id, []).append(session)
    projects = tuple(
        ProjectBoard(
            project_id=project_id,
            counts=BoardCounts.of(grouped[project_id]),
            sessions=tuple(
                sorted(grouped[project_id], key=lambda s: (s.queued_at, s.session_id))
            ),
        )
        for project_id in sorted(grouped)
    )
    return BoardSnapshot(
        totals=BoardCounts.of(sessions),
        projects=projects,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
