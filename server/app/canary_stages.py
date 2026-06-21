"""Canary 阶段化门控 (建议 126) - app/canary_stages.py.

设计:
  - 4 阶段自动放量: 1% → 10% → 50% → 100%
  - 每阶段需手动 promote (运维确认)
  - 阶段间 cooldown (默认 5 分钟), 防止一锅端
  - 阶段失败自动回滚到上一阶段
  - 阶段状态持久化 (内存 + JSON 配置文件)
  - API 查询 / 提升 / 回滚

用法:
    from app.canary_stages import CanaryStageController, Stage, STAGES_DEFAULT

    ctrl = CanaryStageController()
    # 查询当前阶段
    current = ctrl.current_stage()
    # 提升到下一阶段 (需先经过 cooldown)
    ctrl.promote(reason="人工确认")
    # 紧急回滚
    ctrl.rollback(reason="v2 报错率升高")
    # 标记阶段失败 (自动回滚)
    ctrl.mark_failure("v2 5xx > 5%")
    # 拿当前阶段的 v2 比例
    ratio = ctrl.current_ratio()
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from enum import StrEnum

# ---------------------------------------------------------------------------
# 阶段定义
# ---------------------------------------------------------------------------


class Stage(StrEnum):
    """4 阶段放量."""

    STAGE_0 = "0%"  # 0%  (灰度未开始, 全部 v1)
    STAGE_1 = "1%"  # 1%
    STAGE_2 = "10%"  # 10%
    STAGE_3 = "50%"  # 50%
    STAGE_4 = "100%"  # 100% (全量)

    @property
    def ratio(self) -> float:
        return _STAGE_RATIO[self]


# 阶段 → v2 比例
_STAGE_RATIO = {
    Stage.STAGE_0: 0.0,
    Stage.STAGE_1: 0.01,
    Stage.STAGE_2: 0.10,
    Stage.STAGE_3: 0.50,
    Stage.STAGE_4: 1.0,
}

# 阶段顺序
STAGE_ORDER = [Stage.STAGE_0, Stage.STAGE_1, Stage.STAGE_2, Stage.STAGE_3, Stage.STAGE_4]


# ---------------------------------------------------------------------------
# 状态 / 事件
# ---------------------------------------------------------------------------


@dataclass
class StageEvent:
    """阶段变化事件."""

    ts: float
    from_stage: str | None
    to_stage: str
    actor: str
    reason: str
    event_type: str  # "promote" / "rollback" / "auto_rollback" / "init"


@dataclass
class CanaryState:
    """canary 控制器状态."""

    current_stage: str = Stage.STAGE_0.value
    last_change_ts: float = 0.0
    last_event: dict | None = None
    history: list[dict] = field(default_factory=list)
    failures_in_stage: int = 0
    total_traffic_in_stage: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> CanaryState:
        return cls(
            current_stage=d.get("current_stage", Stage.STAGE_0.value),
            last_change_ts=d.get("last_change_ts", 0.0),
            last_event=d.get("last_event"),
            history=list(d.get("history", [])),
            failures_in_stage=d.get("failures_in_stage", 0),
            total_traffic_in_stage=d.get("total_traffic_in_stage", 0),
        )


# ---------------------------------------------------------------------------
# Controller
# ---------------------------------------------------------------------------

DEFAULT_COOLDOWN_SECONDS = 5 * 60  # 5 分钟
DEFAULT_FAILURE_THRESHOLD = 5  # 阶段内连续失败 5 次自动回滚


class CanaryStageController:
    """Canary 阶段化门控 controller.

    状态可持久化到 JSON 文件 (供多进程 / 跨重启共享).
    """

    def __init__(
        self,
        state_file: str | None = None,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        clock: callable | None = None,
    ):
        self._lock = threading.RLock()
        self._state_file = state_file
        self._cooldown = cooldown_seconds
        self._failure_threshold = failure_threshold
        self._clock = clock or time.time
        # 加载或初始化状态
        if state_file and os.path.exists(state_file):
            try:
                with open(state_file, encoding="utf-8") as f:
                    self._state = CanaryState.from_dict(json.load(f))
            except Exception:
                self._state = CanaryState()
        else:
            self._state = CanaryState()

    # ---------- 状态查询 ----------
    def current_stage(self) -> Stage:
        with self._lock:
            return Stage(self._state.current_stage)

    def current_ratio(self) -> float:
        return self.current_stage().ratio

    def state(self) -> CanaryState:
        """返回状态副本 (浅拷贝)."""
        with self._lock:
            import copy

            return copy.copy(self._state)

    def is_in_cooldown(self) -> bool:
        with self._lock:
            if self._state.last_change_ts == 0.0:
                return False
            return (self._clock() - self._state.last_change_ts) < self._cooldown

    def cooldown_remaining(self) -> float:
        """返回 cooldown 剩余秒数."""
        with self._lock:
            if self._state.last_change_ts == 0.0:
                return 0.0
            remaining = self._cooldown - (self._clock() - self._state.last_change_ts)
            return max(0.0, remaining)

    def failures_count(self) -> int:
        with self._lock:
            return self._state.failures_in_stage

    # ---------- 操作 ----------
    def promote(self, actor: str = "system", reason: str = "") -> StageEvent:
        """提升到下一阶段 (受 cooldown 约束)."""
        with self._lock:
            cur = Stage(self._state.current_stage)
            idx = STAGE_ORDER.index(cur)
            if idx >= len(STAGE_ORDER) - 1:
                # 已在最高阶段
                return self._record_event(cur, cur, actor, reason or "已在最高阶段", "noop")
            if self.is_in_cooldown():
                # cooldown 中, 不允许 promote
                raise StageCooldownError(f"cooldown 中, 剩余 {self.cooldown_remaining():.0f}s")
            nxt = STAGE_ORDER[idx + 1]
            return self._set_stage(cur, nxt, actor, reason, "promote")

    def rollback(self, actor: str = "system", reason: str = "", auto: bool = False) -> StageEvent:
        """回滚到上一阶段 (不受 cooldown 约束)."""
        with self._lock:
            cur = Stage(self._state.current_stage)
            idx = STAGE_ORDER.index(cur)
            if idx <= 0:
                # 已在最低, noop
                return self._record_event(
                    cur, cur, actor, reason or "已在最低阶段", "noop" if not auto else "auto_rollback"
                )
            prev = STAGE_ORDER[idx - 1]
            event_type = "auto_rollback" if auto else "rollback"
            return self._set_stage(cur, prev, actor, reason, event_type)

    def mark_failure(self, reason: str = "") -> StageEvent:
        """标记一次失败. 达到阈值自动回滚到 STAGE_0 (紧急回滚)."""
        with self._lock:
            self._state.failures_in_stage += 1
            if self._state.failures_in_stage >= self._failure_threshold:
                # 紧急回滚: 直接到 STAGE_0, 不是上一阶段
                ev = self._set_stage(
                    Stage(self._state.current_stage),
                    Stage.STAGE_0,
                    actor="auto",
                    reason=f"连续 {self._state.failures_in_stage} 次失败, 紧急回滚: {reason}",
                    event_type="auto_rollback",
                )
                # 建议 136: auto_rollback 触发告警
                self._notify_auto_rollback(ev, reason)
                return ev
            # 未达阈值, 仅记录
            return self._record_event(
                Stage(self._state.current_stage),
                Stage(self._state.current_stage),
                actor="auto",
                reason=reason,
                event_type="failure",
            )

    def mark_traffic(self, count: int = 1) -> None:
        """记录阶段内流量 (用于审计)."""
        with self._lock:
            self._state.total_traffic_in_stage += count

    def reset(self, actor: str = "system", reason: str = "重置") -> StageEvent:
        """重置到 STAGE_0 (用于新灰度周期)."""
        with self._lock:
            return self._set_stage(Stage(self._state.current_stage), Stage.STAGE_0, actor, reason, "reset")

    # ---------- 内部 ----------
    def _set_stage(self, from_s: Stage, to_s: Stage, actor: str, reason: str, event_type: str) -> StageEvent:
        self._state.current_stage = to_s.value
        self._state.last_change_ts = self._clock()
        self._state.failures_in_stage = 0
        self._state.total_traffic_in_stage = 0
        return self._record_event(from_s, to_s, actor, reason, event_type)

    def _notify_auto_rollback(self, ev: StageEvent, reason: str) -> None:
        """建议 136: auto_rollback 自动发告警 (告警服务 + Prometheus 状态).

        三路并行通知, 失败不影响主流程:
          1. alert_service.push_alert (钉钉/微信/飞书/邮件) - 同步推, 失败隔离
          2. zhs_canary_rollback_active gauge (Prometheus 抓, alertmanager 触发规则)
          3. 结构化日志 (Loki 检索)

        设计权衡:
          - 同步推告警 (不是后台线程) 是为了:
            1. 测试可重入, 避免线程时序
            2. 紧急回滚场景, 告警需及时发出, 不被线程调度延迟
            3. push_alert 内部已有 4s timeout 防护
          - 失败 try/except 隔离, 不阻塞主流程
        """
        import logging

        # 1. 钉钉/微信/飞书/邮件 (best effort, 同步推 + 失败隔离)
        try:
            import asyncio

            from app.services.alert_service import push_alert

            title = f"[ZHS Canary] 紧急回滚: {ev.from_stage} → {ev.to_stage}"
            message = (
                f"**原因**: {reason}\n"
                f"**回滚前**: {ev.from_stage}\n"
                f"**回滚后**: {ev.to_stage}\n"
                f"**时间**: {__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}\n"
                f"**事件类型**: {ev.event_type}\n"
            )
            try:
                asyncio.run(push_alert(title, message, severity="critical"))
            except Exception as e:
                logging.getLogger(__name__).debug(f"canary alert push inner failed: {e}")
        except Exception as e:
            logging.getLogger(__name__).debug(f"canary auto_rollback notify skipped: {e}")

        # 2. Prometheus gauge (建议 136) - alertmanager 规则 ZHSRollbackActive 用
        try:
            from app.canary_metrics import CANARY_ROLLBACK_GAUGE

            if CANARY_ROLLBACK_GAUGE is not None:
                CANARY_ROLLBACK_GAUGE.set(1.0)
        except Exception:
            pass

        # 3. 结构化日志 (Loki 检索)
        logging.getLogger(__name__).warning(
            f"[canary auto_rollback] from={ev.from_stage} to={ev.to_stage} reason={reason}"
        )

    def _record_event(
        self, from_s: Stage | None, to_s: Stage, actor: str, reason: str, event_type: str
    ) -> StageEvent:
        ev = StageEvent(
            ts=self._clock(),
            from_stage=from_s.value if from_s else None,
            to_stage=to_s.value,
            actor=actor,
            reason=reason,
            event_type=event_type,
        )
        # 限制 history 大小
        if len(self._state.history) >= 100:
            self._state.history = self._state.history[-50:]
        self._state.history.append(asdict(ev))
        self._state.last_event = asdict(ev)
        self._persist()
        # 建议 151: 写审计库 (失败隔离)
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="controller",
                action=event_type,
                actor=actor,
                from_stage=ev.from_stage,
                to_stage=ev.to_stage,
                reason=reason,
            )
        except Exception:
            pass
        return ev

    def _persist(self) -> None:
        """持久化到 JSON 文件 (best effort)."""
        if not self._state_file:
            return
        try:
            os.makedirs(os.path.dirname(self._state_file) or ".", exist_ok=True)
            with open(self._state_file, "w", encoding="utf-8") as f:
                json.dump(self._state.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception:
            pass  # 持久化失败不阻塞流程


# ---------------------------------------------------------------------------
# 异常
# ---------------------------------------------------------------------------


class StageError(Exception):
    pass


class StageCooldownError(StageError):
    pass


# ---------------------------------------------------------------------------
# 全局默认实例 (供其他模块直接 import)
# ---------------------------------------------------------------------------

_DEFAULT_CTRL: CanaryStageController | None = None
_DEFAULT_LOCK = threading.Lock()


def get_default_controller(state_file: str | None = None) -> CanaryStageController:
    global _DEFAULT_CTRL
    with _DEFAULT_LOCK:
        if _DEFAULT_CTRL is None:
            _DEFAULT_CTRL = CanaryStageController(state_file=state_file)
        return _DEFAULT_CTRL


def reset_default_controller() -> None:
    """测试用: 重置全局默认 controller."""
    global _DEFAULT_CTRL
    with _DEFAULT_LOCK:
        _DEFAULT_CTRL = None
