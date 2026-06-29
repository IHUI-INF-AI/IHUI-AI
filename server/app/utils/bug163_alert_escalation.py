"""Bug-163: 告警升级.

接收方未 ack, 时间窗口内升级到更高级别 (email -> sms -> phone).
"""

import contextlib
import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


class Channel(enum.StrEnum):
    LOG = "LOG"
    EMAIL = "EMAIL"
    SMS = "SMS"
    PHONE = "PHONE"
    ONCALL = "ONCALL"


@dataclass
class EscalationStep:
    channel: Channel
    after_sec: int
    template: str = ""


@dataclass
class EscalationPolicy:
    name: str
    steps: list[EscalationStep] = field(default_factory=list)


@dataclass
class ActiveAlert:
    id: str
    severity: str
    labels: dict[str, str]
    first_ts: float
    last_escalated_step: int = -1
    acked: bool = False


class EscalationEngine:
    """告警升级引擎: 按时间窗内逐步升级, ack 后停止."""

    def __init__(
        self, policy: EscalationPolicy | None = None, send: Callable[[Channel, str, str], None] | None = None
    ):
        self.policy = policy or EscalationPolicy(
            name="default",
            steps=[
                EscalationStep(Channel.EMAIL, 0),
                EscalationStep(Channel.SMS, 300),
                EscalationStep(Channel.PHONE, 900),
            ],
        )
        self._send = send
        self._lock = threading.Lock()
        self._alerts: dict[str, ActiveAlert] = {}

    def fire(self, alert_id: str, severity: str, labels: dict[str, str]) -> ActiveAlert:
        with self._lock:
            a = self._alerts.get(alert_id)
            if a is None:
                a = ActiveAlert(id=alert_id, severity=severity, labels=labels, first_ts=time.time())
                self._alerts[alert_id] = a
            return a

    def ack(self, alert_id: str) -> bool:
        with self._lock:
            a = self._alerts.get(alert_id)
            if not a:
                return False
            a.acked = True
            return True

    def tick(self) -> list[tuple]:
        """扫描应升级的告警, 返回触发的 (channel, alert_id, template) 列表."""
        out: list[tuple] = []
        now = time.time()
        with self._lock:
            for a in list(self._alerts.values()):
                if a.acked:
                    continue
                elapsed = now - a.first_ts
                for i, step in enumerate(self.policy.steps):
                    if i <= a.last_escalated_step:
                        continue
                    if elapsed >= step.after_sec:
                        a.last_escalated_step = i
                        out.append((step.channel, a.id, step.template or a.severity))
                        if self._send:
                            with contextlib.suppress(Exception):
                                self._send(step.channel, a.id, step.template or a.severity)  # intentionally ignored
        return out

    def active(self) -> list[ActiveAlert]:
        with self._lock:
            return list(self._alerts.values())

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "active": len(self._alerts),
                "acked": sum(1 for a in self._alerts.values() if a.acked),
            }
