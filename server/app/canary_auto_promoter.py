"""CanaryAutoPromoter 自动推进控制器 (建议 140) - app/canary_auto_promoter.py.

设计:
  - 监听 canary controller + v2 错误率 (从 Prometheus / 应用报告)
  - 满足条件 (错误率 < 阈值 持续 N 分钟) 自动调 controller.promote
  - 状态: idle / monitoring / promoting / paused / dry_run
  - 暂停条件: 错误率 > 阈值 / cooldown 未到 / 已是 STAGE_4 (full release)

集成:
  - CanaryStageController (建议 128)
  - CanaryShadowLink (建议 129)
  - Prometheus metrics (建议 123/134)
  - alertmanager (建议 136, 告警 / 抑制)

用法:
    from app.canary_auto_promoter import CanaryAutoPromoter
    from app.canary_stages import CanaryStageController
    from app.canary_metrics import CANARY_ERRORS, CANARY_DECISIONS

    promoter = CanaryAutoPromoter(
        controller=canary,
        error_threshold=0.05,       # 5% 错误率上限
        min_stable_minutes=10,      # 持续 10 分钟稳定才推进
        check_interval_seconds=60,  # 每分钟检查一次
        dry_run=True,               # 默认 dry_run (建议 140 初始谨慎)
    )

    # 业务: 启动后台线程
    promoter.start()

    # 业务: 应用层报告每次调用结果
    promoter.record_outcome(success=True, version="v2")
    promoter.record_outcome(success=False, version="v2")

    # 手动检查一次 (测试用)
    result = promoter.check_and_promote()
    if result["promoted"]:
        print(f"自动 promote: {result['from']} → {result['to']}")

    # 暂停/恢复
    promoter.pause()
    promoter.resume()
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class PromoterConfig:
    """CanaryAutoPromoter 配置."""

    error_threshold: float = 0.05  # 错误率上限
    min_stable_minutes: float = 10.0  # 持续稳定时间
    check_interval_seconds: float = 60.0  # 检查间隔
    dry_run: bool = True  # True 时只打日志不真调 promote
    min_traffic_count: int = 100  # 最小流量阈值 (避免样本太少误判)
    max_consecutive_promotions: int = 3  # 单次会话最多自动推进次数
    cooldown_extra_seconds: float = 0.0  # 推进后再多等 N 秒 (可与 stage.cooldown 叠加)


@dataclass
class OverrideState:
    """人工 override 状态 (建议 149)."""

    paused: bool = False
    pause_reason: str = ""
    pause_actor: str = ""
    pause_until_ts: float = 0.0  # 0 = 永久 (直到 resume)
    override_log: list = field(
        default_factory=list
    )  # [{"ts": float, "action": str, "actor": str, "reason": str, "detail": str}]

    def is_paused_active(self) -> bool:
        """override 当前是否生效 (考虑 until_ts)."""
        if not self.paused:
            return False
        if self.pause_until_ts == 0.0:
            return True
        return time.time() < self.pause_until_ts


@dataclass
class PromoterState:
    """内部状态."""

    status: str = "idle"  # idle / monitoring / promoting / paused / dry_run
    promoted_count: int = 0
    last_check_ts: float = 0.0
    last_promote_ts: float = 0.0
    stable_since_ts: float = 0.0
    consecutive_failures: int = 0
    last_decision: str = ""
    override: OverrideState = field(default_factory=OverrideState)


class CanaryAutoPromoter:
    """Canary 自动推进控制器 (建议 140).

    触发逻辑 (check_and_promote 一次):
      1. 如果 controller 已是 STAGE_4 (100%) → 不推进
      2. 如果最近 stable_minutes_minutes 内错误率 > error_threshold → 不推进
      3. 如果流量 < min_traffic_count → 不推进 (样本太少)
      4. 如果 cooldown 未结束 → 不推进
      5. 否则 → 调 controller.promote (dry_run 时只打日志)
    """

    def __init__(self, controller, config: PromoterConfig | None = None):
        self._controller = controller
        self._config = config or PromoterConfig()
        self._state = PromoterState()
        self._lock = threading.Lock()
        # 滑动窗口记录 (timestamp, success) 用于错误率计算
        self._outcomes: deque = deque(maxlen=10000)
        # 后台线程
        self._bg_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        # 强制暂停 flag
        self._paused = False
        # 持久化日志: 每次决策落盘
        self._decision_log: list[dict] = []

    # ---------- 配置 ----------
    @property
    def config(self) -> PromoterConfig:
        return self._config

    @property
    def state(self) -> PromoterState:
        return self._state

    # ---------- 应用层报告 ----------
    def record_outcome(self, success: bool, version: str = "v2") -> None:
        """应用层报告一次调用结果 (成功/失败)."""
        with self._lock:
            self._outcomes.append((time.time(), success, version))

    def get_recent_error_rate(self, window_seconds: float = 600.0) -> float:
        """拿最近 N 秒内错误率 (默认 10 分钟窗口)."""
        cutoff = time.time() - window_seconds
        with self._lock:
            relevant = [s for (t, s, v) in self._outcomes if t >= cutoff]
        if not relevant:
            return 0.0
        errors = sum(1 for s in relevant if not s)
        return errors / len(relevant)

    def get_recent_traffic_count(self, window_seconds: float = 600.0) -> int:
        cutoff = time.time() - window_seconds
        with self._lock:
            return sum(1 for (t, s, v) in self._outcomes if t >= cutoff)

    def get_stable_minutes(self, error_threshold: float | None = None) -> float:
        """拿当前错误率 < threshold 的连续稳定时长 (分钟).

        算法: 取一个合理大窗口 (>= 24h) 内的所有 outcomes, 反向遍历找最近一次
        错误率 >= threshold 的时间点, stable_minutes = now - last_unstable_ts.
        若全无错误, stable_start = 最早一个 outcome 时间, 此时长 >= min_stable_minutes.
        """
        threshold = error_threshold if error_threshold is not None else self._config.error_threshold
        now = time.time()
        with self._lock:
            if not self._outcomes:
                return 0.0
            # 窗口下限: 至少 24h, 避免小 min_stable_minutes (测试场景) 窗口过窄
            window = max(self._config.min_stable_minutes * 60 * 4, 24 * 3600.0)
            cutoff = now - window
            items = [(t, s) for (t, s, v) in self._outcomes if t >= cutoff]
        if not items:
            return 0.0
        # 找到最近一次 "错误率 >= threshold" 的位置, 之前的连续时长
        stable_start = items[0][0]  # 最早
        for i in range(len(items) - 1, -1, -1):
            t_now, _s_now = items[i]
            # 在这个点之前 [t_now - window_back, t_now] 的错误率
            window_back = 60.0  # 1 分钟窗口
            window_start = t_now - window_back
            sub = [(t, s) for (t, s) in items if window_start <= t <= t_now]
            if not sub:
                continue
            errs = sum(1 for (_, s) in sub if not s)
            rate = errs / len(sub)
            if rate >= threshold:
                # 找到不稳定的点, stable_start = 此时刻之后
                stable_start = t_now
                break
        # 稳定时长 = now - stable_start
        stable_minutes = (now - stable_start) / 60.0
        return max(0.0, stable_minutes)

    # ---------- 核心: 检查 + 推进 ----------
    def check_and_promote(self, force: bool = False) -> dict:
        """单次检查: 满足条件则 promote.

        Args:
            force: True 时跳过部分条件 (仅供测试)

        Returns:
            {
                "promoted": bool,
                "from": str | None,
                "to": str | None,
                "reason": str,
                "error_rate": float,
                "traffic_count": int,
                "stable_minutes": float,
                "dry_run": bool,
            }
        """
        with self._lock:
            # 7.0 override 短路 (建议 149): 人工暂停时不推进
            if self._state.override.is_paused_active():
                return {
                    "promoted": False,
                    "from": None,
                    "to": None,
                    "reason": "override_active",
                    "error_rate": 0.0,
                    "traffic_count": 0,
                    "stable_minutes": 0.0,
                    "dry_run": self._config.dry_run,
                }
            if self._paused:
                return {
                    "promoted": False,
                    "from": None,
                    "to": None,
                    "reason": "paused",
                    "error_rate": 0.0,
                    "traffic_count": 0,
                    "stable_minutes": 0.0,
                    "dry_run": self._config.dry_run,
                }
        # 拿当前 stage
        cur_stage = self._controller.current_stage()
        cur_value = cur_stage.value
        # 1. 已是 STAGE_4 → 不推进
        if cur_value == "100%":
            self._state.status = "monitoring"
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": "已 100% 全量, 不再推进",
                "error_rate": self.get_recent_error_rate(),
                "traffic_count": self.get_recent_traffic_count(),
                "stable_minutes": 0.0,
                "dry_run": self._config.dry_run,
            }
        # 2. 拿指标
        error_rate = self.get_recent_error_rate()
        traffic_count = self.get_recent_traffic_count()
        stable_minutes = self.get_stable_minutes()
        # 3. 流量阈值
        if traffic_count < self._config.min_traffic_count and not force:
            self._state.status = "monitoring"
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": f"流量不足: {traffic_count} < {self._config.min_traffic_count}",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": self._config.dry_run,
            }
        # 4. 错误率检查
        if error_rate >= self._config.error_threshold and not force:
            self._state.status = "monitoring"
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": f"错误率过高: {error_rate:.2%} >= {self._config.error_threshold:.2%}",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": self._config.dry_run,
            }
        # 5. 稳定时长检查
        if stable_minutes < self._config.min_stable_minutes and not force:
            self._state.status = "monitoring"
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": f"稳定时长不足: {stable_minutes:.1f}min < {self._config.min_stable_minutes}min",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": self._config.dry_run,
            }
        # 6. 推进次数限制
        if self._state.promoted_count >= self._config.max_consecutive_promotions and not force:
            self._state.status = "monitoring"
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": f"本会话已达最大推进次数 {self._config.max_consecutive_promotions}",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": self._config.dry_run,
            }
        # 7. cooldown 检查 (CanaryStageController 内置)
        # 注: promote() 自己会抛 StageCooldownError, 我们直接调并捕获
        # 8. 实际 promote
        if self._config.dry_run:
            # dry-run: 不真调, 只记录
            log_msg = (
                f"[CanaryAutoPromoter DRY-RUN] would promote "
                f"from={cur_value} error_rate={error_rate:.2%} "
                f"traffic={traffic_count} stable={stable_minutes:.1f}min"
            )
            logging.getLogger(__name__).info(log_msg)
            self._record_decision(
                {
                    "action": "promote_dry_run",
                    "from": cur_value,
                    "to": "(next)",
                    "error_rate": error_rate,
                    "traffic_count": traffic_count,
                    "stable_minutes": stable_minutes,
                }
            )
            return {
                "promoted": False,  # dry-run 不算真推进
                "from": cur_value,
                "to": None,
                "reason": "dry_run 模式, 未真调 promote",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": True,
            }
        try:
            ev = self._controller.promote(actor="auto-promoter", reason="满足稳定条件, 自动推进")
        except Exception as e:
            self._state.consecutive_failures += 1
            return {
                "promoted": False,
                "from": cur_value,
                "to": None,
                "reason": f"promote 失败: {e}",
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
                "dry_run": False,
            }
        # 真推进
        self._state.promoted_count += 1
        self._state.last_promote_ts = time.time()
        self._state.consecutive_failures = 0
        self._state.status = "promoting"
        log_msg = (
            f"[CanaryAutoPromoter] AUTO PROMOTED "
            f"from={ev.from_stage} to={ev.to_stage} "
            f"error_rate={error_rate:.2%} traffic={traffic_count} "
            f"stable={stable_minutes:.1f}min"
        )
        logging.getLogger(__name__).warning(log_msg)  # warning 级别方便检索
        self._record_decision(
            {
                "action": "promote",
                "from": ev.from_stage,
                "to": ev.to_stage,
                "error_rate": error_rate,
                "traffic_count": traffic_count,
                "stable_minutes": stable_minutes,
            }
        )
        return {
            "promoted": True,
            "from": ev.from_stage,
            "to": ev.to_stage,
            "reason": "满足稳定条件, 自动推进",
            "error_rate": error_rate,
            "traffic_count": traffic_count,
            "stable_minutes": stable_minutes,
            "dry_run": False,
        }

    # ---------- 后台线程 ----------
    def start(self) -> None:
        """启动后台检查线程."""
        if self._bg_thread is not None and self._bg_thread.is_alive():
            return  # 已在跑
        self._stop_event.clear()
        self._bg_thread = threading.Thread(target=self._run_loop, daemon=True, name="canary-auto-promoter")
        self._bg_thread.start()
        logging.getLogger(__name__).info(
            f"[CanaryAutoPromoter] 后台线程已启动, 间隔={self._config.check_interval_seconds}s, dry_run={self._config.dry_run}"
        )

    def stop(self, timeout: float = 5.0) -> None:
        """停止后台检查线程."""
        self._stop_event.set()
        if self._bg_thread is not None:
            self._bg_thread.join(timeout=timeout)
            self._bg_thread = None
        logging.getLogger(__name__).info("[CanaryAutoPromoter] 后台线程已停止")

    def _run_loop(self) -> None:
        """后台循环."""
        self._state.status = "monitoring"
        while not self._stop_event.is_set():
            try:
                result = self.check_and_promote()
                self._state.last_check_ts = time.time()
                if result["promoted"]:
                    self._state.last_decision = f"promoted: {result['from']} → {result['to']}"
                else:
                    self._state.last_decision = f"skip: {result['reason']}"
            except Exception as e:
                logging.getLogger(__name__).error(f"[CanaryAutoPromoter] loop error: {e}")
            # 等待下一次
            self._stop_event.wait(timeout=self._config.check_interval_seconds)
        self._state.status = "idle"

    # ---------- 暂停/恢复 ----------
    def pause(self) -> None:
        with self._lock:
            self._paused = True
            self._state.status = "paused"
        logging.getLogger(__name__).warning("[CanaryAutoPromoter] 已暂停")

    def resume(self) -> None:
        with self._lock:
            self._paused = False
            self._state.status = "monitoring"
        logging.getLogger(__name__).info("[CanaryAutoPromoter] 已恢复")

    def is_paused(self) -> bool:
        return self._paused

    # ---------- 人工 override (建议 149) ----------
    def pause_override(self, actor: str, reason: str, until_ts: float = 0.0) -> dict:
        """人工暂停自动推进 (覆盖 normal pause).

        Args:
            actor: 操作者 (admin 用户名 / 系统标识)
            reason: 暂停原因 (审计必填)
            until_ts: 自动恢复时间戳, 0 = 永久 (直到 resume_override)

        Returns:
            {paused, actor, reason, until_ts, paused_at}
        """
        paused_at = time.time()
        with self._lock:
            self._state.override.paused = True
            self._state.override.pause_reason = reason
            self._state.override.pause_actor = actor
            self._state.override.pause_until_ts = until_ts
            self._state.override.override_log.append(
                {
                    "ts": paused_at,
                    "action": "pause",
                    "actor": actor,
                    "reason": reason,
                    "detail": f"until_ts={until_ts}",
                }
            )
            # 限制日志大小
            if len(self._state.override.override_log) > 100:
                self._state.override.override_log = self._state.override.override_log[-50:]
            self._state.status = "paused"
        logging.getLogger(__name__).warning(
            f"[CanaryAutoPromoter] override PAUSE actor={actor} reason={reason} until_ts={until_ts}"
        )
        # 建议 151: 写审计库
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="override",
                action="pause",
                actor=actor,
                reason=reason,
                detail={"until_ts": until_ts, "paused_at": paused_at},
                ts=paused_at,
            )
        except Exception:
            pass
        return {
            "paused": True,
            "actor": actor,
            "reason": reason,
            "until_ts": until_ts,
            "paused_at": paused_at,
        }

    def resume_override(self, actor: str, reason: str = "") -> dict:
        """解除人工 override 暂停."""
        resumed_at = time.time()
        with self._lock:
            was_paused = self._state.override.paused
            self._state.override.paused = False
            self._state.override.pause_reason = ""
            self._state.override.pause_actor = ""
            self._state.override.pause_until_ts = 0.0
            self._state.override.override_log.append(
                {
                    "ts": resumed_at,
                    "action": "resume",
                    "actor": actor,
                    "reason": reason,
                    "detail": "was_paused=" + str(was_paused),
                }
            )
            if len(self._state.override.override_log) > 100:
                self._state.override.override_log = self._state.override.override_log[-50:]
            if not self._paused:
                self._state.status = "monitoring"
        logging.getLogger(__name__).warning(
            f"[CanaryAutoPromoter] override RESUME actor={actor} reason={reason} was_paused={was_paused}"
        )
        # 建议 151: 写审计库
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="override",
                action="resume",
                actor=actor,
                reason=reason,
                detail={"was_paused": was_paused, "resumed_at": resumed_at},
                ts=resumed_at,
            )
        except Exception:
            pass
        return {
            "paused": False,
            "actor": actor,
            "reason": reason,
            "resumed_at": resumed_at,
            "was_paused": was_paused,
        }

    def force_promote(self, actor: str, reason: str) -> dict:
        """强制推进 1 步 (忽略所有检查 + override 暂停).

        Returns:
            {promoted, from, to, event, reason}
        """
        action_ts = time.time()
        with self._lock:
            # override 暂停时也允许 force, 但记录到日志
            override_was_paused = self._state.override.is_paused_active()
            cur = self._controller.current_stage()
            cur_value = cur.value
            if cur_value == "100%":
                # 写审计 (失败)
                try:
                    from app.canary_audit_store import get_default_audit_store

                    get_default_audit_store().append(
                        source="override",
                        action="force_promote_failed",
                        actor=actor,
                        from_stage=cur_value,
                        to_stage=None,
                        reason="已 100% 全量",
                        ts=action_ts,
                    )
                except Exception:
                    pass
                return {
                    "promoted": False,
                    "from": cur_value,
                    "to": None,
                    "reason": "已 100% 全量, 无法再推进",
                }
            try:
                ev = self._controller.promote(actor=actor, reason=reason or "人工强制推进")
            except Exception as e:
                self._state.override.override_log.append(
                    {
                        "ts": action_ts,
                        "action": "force_promote_failed",
                        "actor": actor,
                        "reason": reason,
                        "detail": str(e),
                    }
                )
                # 写审计 (失败)
                try:
                    from app.canary_audit_store import get_default_audit_store

                    get_default_audit_store().append(
                        source="override",
                        action="force_promote_failed",
                        actor=actor,
                        from_stage=cur_value,
                        to_stage=None,
                        reason=str(e),
                        ts=action_ts,
                    )
                except Exception:
                    pass
                return {
                    "promoted": False,
                    "from": cur_value,
                    "to": None,
                    "reason": f"force_promote 失败: {e}",
                }
            self._state.override.override_log.append(
                {
                    "ts": action_ts,
                    "action": "force_promote",
                    "actor": actor,
                    "reason": reason,
                    "detail": f"{ev.from_stage} → {ev.to_stage} (override_was_paused={override_was_paused})",
                }
            )
            if len(self._state.override.override_log) > 100:
                self._state.override.override_log = self._state.override.override_log[-50:]
            self._state.status = "promoting"
        logging.getLogger(__name__).warning(
            f"[CanaryAutoPromoter] FORCE PROMOTE actor={actor} "
            f"from={ev.from_stage} to={ev.to_stage} reason={reason}"
        )
        # 写审计 (成功)
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="override",
                action="force_promote",
                actor=actor,
                from_stage=ev.from_stage,
                to_stage=ev.to_stage,
                reason=reason or "人工强制推进",
                detail={"override_was_paused": override_was_paused},
                ts=action_ts,
            )
        except Exception:
            pass
        return {
            "promoted": True,
            "from": ev.from_stage,
            "to": ev.to_stage,
            "event": {
                "ts": ev.ts,
                "from_stage": ev.from_stage,
                "to_stage": ev.to_stage,
                "actor": ev.actor,
                "reason": ev.reason,
                "event_type": ev.event_type,
            },
            "reason": reason,
        }

    def force_rollback(self, actor: str, reason: str) -> dict:
        """紧急回滚 (调 controller.rollback, 不受 cooldown 约束)."""
        action_ts = time.time()
        with self._lock:
            cur = self._controller.current_stage()
            cur_value = cur.value
            if cur_value == "0%":
                # 写审计 (失败)
                try:
                    from app.canary_audit_store import get_default_audit_store

                    get_default_audit_store().append(
                        source="override",
                        action="force_rollback_failed",
                        actor=actor,
                        from_stage=cur_value,
                        to_stage=None,
                        reason="已在最低阶段",
                        ts=action_ts,
                    )
                except Exception:
                    pass
                return {
                    "rolled_back": False,
                    "from": cur_value,
                    "to": None,
                    "reason": "已在最低阶段, 无需回滚",
                }
            try:
                ev = self._controller.rollback(actor=actor, reason=reason or "人工紧急回滚")
            except Exception as e:
                self._state.override.override_log.append(
                    {
                        "ts": action_ts,
                        "action": "force_rollback_failed",
                        "actor": actor,
                        "reason": reason,
                        "detail": str(e),
                    }
                )
                # 写审计 (失败)
                try:
                    from app.canary_audit_store import get_default_audit_store

                    get_default_audit_store().append(
                        source="override",
                        action="force_rollback_failed",
                        actor=actor,
                        from_stage=cur_value,
                        to_stage=None,
                        reason=str(e),
                        ts=action_ts,
                    )
                except Exception:
                    pass
                return {
                    "rolled_back": False,
                    "from": cur_value,
                    "to": None,
                    "reason": f"force_rollback 失败: {e}",
                }
            self._state.override.override_log.append(
                {
                    "ts": action_ts,
                    "action": "force_rollback",
                    "actor": actor,
                    "reason": reason,
                    "detail": f"{ev.from_stage} → {ev.to_stage}",
                }
            )
            if len(self._state.override.override_log) > 100:
                self._state.override.override_log = self._state.override.override_log[-50:]
            self._state.status = "monitoring"
        logging.getLogger(__name__).warning(
            f"[CanaryAutoPromoter] FORCE ROLLBACK actor={actor} "
            f"from={ev.from_stage} to={ev.to_stage} reason={reason}"
        )
        # 写审计 (成功)
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="override",
                action="force_rollback",
                actor=actor,
                from_stage=ev.from_stage,
                to_stage=ev.to_stage,
                reason=reason or "人工紧急回滚",
                ts=action_ts,
            )
        except Exception:
            pass
        return {
            "rolled_back": True,
            "from": ev.from_stage,
            "to": ev.to_stage,
            "event": {
                "ts": ev.ts,
                "from_stage": ev.from_stage,
                "to_stage": ev.to_stage,
                "actor": ev.actor,
                "reason": ev.reason,
                "event_type": ev.event_type,
            },
            "reason": reason,
        }

    def get_override_status(self) -> dict:
        """拿 override 状态 + 日志."""
        with self._lock:
            ov = self._state.override
            return {
                "paused": ov.paused,
                "is_paused_active": ov.is_paused_active(),
                "pause_reason": ov.pause_reason,
                "pause_actor": ov.pause_actor,
                "pause_until_ts": ov.pause_until_ts,
                "pause_until_in_seconds": (ov.pause_until_ts - time.time()) if ov.pause_until_ts > 0 else 0.0,
                "override_log": list(ov.override_log),
            }

    # ---------- 决策日志 ----------
    def _record_decision(self, decision: dict) -> None:
        with self._lock:
            decision["ts"] = time.time()
            self._decision_log.append(decision)
            # 限制大小
            if len(self._decision_log) > 100:
                self._decision_log = self._decision_log[-50:]
        # 建议 151: 写审计库 (失败隔离)
        try:
            from app.canary_audit_store import get_default_audit_store

            get_default_audit_store().append(
                source="promoter",
                action=decision.get("action", "decision"),
                actor="auto-promoter",
                from_stage=decision.get("from"),
                to_stage=decision.get("to"),
                reason=decision.get("reason")
                or (decision.get("error_rate")
                and f"err={decision.get('error_rate'):.2%}")
                or "",
                detail={
                    "error_rate": decision.get("error_rate"),
                    "traffic_count": decision.get("traffic_count"),
                    "stable_minutes": decision.get("stable_minutes"),
                },
                ts=decision["ts"],
            )
        except Exception:
            pass

    def get_decision_log(self) -> list[dict]:
        with self._lock:
            return list(self._decision_log)

    # ---------- 状态摘要 ----------
    def get_status(self) -> dict:
        with self._lock:
            return {
                "status": self._state.status,
                "promoted_count": self._state.promoted_count,
                "last_check_ts": self._state.last_check_ts,
                "last_promote_ts": self._state.last_promote_ts,
                "consecutive_failures": self._state.consecutive_failures,
                "last_decision": self._state.last_decision,
                "paused": self._paused,
                "override": {
                    "paused": self._state.override.paused,
                    "is_paused_active": self._state.override.is_paused_active(),
                    "pause_actor": self._state.override.pause_actor,
                    "pause_reason": self._state.override.pause_reason,
                },
                "config": {
                    "error_threshold": self._config.error_threshold,
                    "min_stable_minutes": self._config.min_stable_minutes,
                    "check_interval_seconds": self._config.check_interval_seconds,
                    "dry_run": self._config.dry_run,
                    "min_traffic_count": self._config.min_traffic_count,
                },
            }


# ---------------------------------------------------------------------------
# 全局默认实例 (供 API 端点使用, 建议 149)
# ---------------------------------------------------------------------------

_DEFAULT_PROMOTER: CanaryAutoPromoter | None = None
_PROMOTER_LOCK = threading.Lock()


def get_default_promoter(controller=None, config: PromoterConfig | None = None) -> CanaryAutoPromoter:
    """获取/创建默认 promoter. controller 第一次调用时必传."""
    global _DEFAULT_PROMOTER
    with _PROMOTER_LOCK:
        if _DEFAULT_PROMOTER is None:
            if controller is None:
                # 尝试导入默认 controller
                from app.canary_stages import get_default_controller

                controller = get_default_controller()
            _DEFAULT_PROMOTER = CanaryAutoPromoter(controller=controller, config=config)
        return _DEFAULT_PROMOTER


def reset_default_promoter() -> None:
    """测试用: 重置默认 promoter."""
    global _DEFAULT_PROMOTER
    with _PROMOTER_LOCK:
        _DEFAULT_PROMOTER = None


def set_default_promoter(promoter: CanaryAutoPromoter) -> None:
    """测试用: 注入自定义 promoter."""
    global _DEFAULT_PROMOTER
    with _PROMOTER_LOCK:
        _DEFAULT_PROMOTER = promoter
