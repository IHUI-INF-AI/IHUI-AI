# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""云端沙箱领域模型与状态机(D14)。"""
from __future__ import annotations

from enum import Enum
from typing import Final

from pydantic import BaseModel, ConfigDict, Field, field_validator

__all__ = [
    "ACTIVE_STATUSES",
    "ALLOWED_TRANSITIONS",
    "TERMINAL_STATUSES",
    "IllegalTransitionError",
    "SandboxSession",
    "SandboxSpec",
    "SandboxStatus",
    "assert_transition",
]


class SandboxStatus(str, Enum):
    """会话生命周期状态;迁移表是唯一权威,非法迁移一律显式拒绝。"""

    QUEUED = "queued"
    STARTING = "starting"
    RUNNING = "running"
    FINISHED = "finished"
    FAILED = "failed"
    TIMEOUT = "timeout"
    REAPED = "reaped"


ALLOWED_TRANSITIONS: Final[dict[SandboxStatus, frozenset[SandboxStatus]]] = {
    SandboxStatus.QUEUED: frozenset({SandboxStatus.STARTING}),
    SandboxStatus.STARTING: frozenset({SandboxStatus.RUNNING, SandboxStatus.FAILED}),
    SandboxStatus.RUNNING: frozenset(
        {SandboxStatus.FINISHED, SandboxStatus.FAILED, SandboxStatus.TIMEOUT}
    ),
    # TIMEOUT 刻意不是终态:容器可能还在跑,槽位必须等回收才释放
    SandboxStatus.TIMEOUT: frozenset({SandboxStatus.REAPED}),
    SandboxStatus.FINISHED: frozenset(),
    SandboxStatus.FAILED: frozenset(),
    SandboxStatus.REAPED: frozenset(),
}

ACTIVE_STATUSES: Final[frozenset[SandboxStatus]] = frozenset(
    {SandboxStatus.STARTING, SandboxStatus.RUNNING}
)
TERMINAL_STATUSES: Final[frozenset[SandboxStatus]] = frozenset(
    {SandboxStatus.FINISHED, SandboxStatus.FAILED, SandboxStatus.REAPED}
)


class IllegalTransitionError(RuntimeError):
    def __init__(self, source: SandboxStatus, target: SandboxStatus) -> None:
        super().__init__(f"非法状态迁移: {source.value} → {target.value}")
        self.source = source
        self.target = target


def assert_transition(source: SandboxStatus, target: SandboxStatus) -> None:
    permitted = ALLOWED_TRANSITIONS.get(source)
    if permitted is None or target not in permitted:
        raise IllegalTransitionError(source, target)


class SandboxSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    image: str
    project_id: str
    command: tuple[str, ...]
    timeout_seconds: float = Field(default=120.0, gt=0, le=7200)
    memory_mb: int = Field(default=512, gt=0, le=262_144)
    cpu_quota: float = Field(default=1.0, gt=0, le=16)
    allow_network: bool = False
    env: dict[str, str] = Field(default_factory=dict)

    @field_validator("image")
    @classmethod
    def _normalize_image(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped or any(ch.isspace() for ch in stripped):
            raise ValueError("image 必须是单个非空、不含空白的引用")
        return stripped

    @field_validator("command")
    @classmethod
    def _normalize_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value or not value[0].strip():
            raise ValueError("command 首项必须是可执行程序")
        return value

    @field_validator("env")
    @classmethod
    def _normalize_env(cls, value: dict[str, str]) -> dict[str, str]:
        for key in value:
            if "=" in key:
                raise ValueError("env 键不得含 '='")
        return value


class SandboxSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    spec: SandboxSpec
    status: SandboxStatus = SandboxStatus.QUEUED
    attempt: int = Field(default=1, ge=1)
    queued_at: float
    started_at: float | None = None
    finished_at: float | None = None
    container_id: str | None = None
    exit_code: int | None = None
    error: str | None = None

    @property
    def project_id(self) -> str:
        return self.spec.project_id

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE_STATUSES

    @property
    def deadline_at(self) -> float | None:
        if self.started_at is None or not self.is_active:
            return None
        return self.started_at + self.spec.timeout_seconds

    def transition(
        self,
        target: SandboxStatus,
        *,
        now: float,
        exit_code: int | None = None,
        error: str | None = None,
    ) -> None:
        assert_transition(self.status, target)
        self.status = target
        if target is SandboxStatus.STARTING:
            self.started_at = now
        if target in TERMINAL_STATUSES:
            self.finished_at = now
        if exit_code is not None:
            self.exit_code = exit_code
        if error is not None:
            self.error = error

    def retry(self, *, session_id: str, now: float) -> SandboxSession:
        """REAPED 是终态,重试只能换一枚新会话 —— 状态机不允许走回头路。"""
        if self.status is not SandboxStatus.REAPED:
            raise IllegalTransitionError(self.status, SandboxStatus.QUEUED)
        return SandboxSession(
            session_id=session_id,
            spec=self.spec,
            attempt=self.attempt + 1,
            queued_at=now,
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
