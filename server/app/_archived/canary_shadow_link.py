"""Canary + Shadow 流量录制联动 (建议 130).

设计:
  - CanaryStageController 在低阶段 (1% / 10%) 自动启用 shadow 比对
  - 中阶段 (50%) 关闭 shadow (流量够大, 不再需要录制)
  - 高阶段 (100%) 关闭 shadow (全量)
  - 提供 link_shadow_to_canary() 联动函数
  - 联动策略可配置 (SHADOW_LINK_STAGES = {STAGE_1, STAGE_2})

用法:
    from app.canary_shadow_link import get_linked_router

    shadow = get_linked_router(canary_ctrl=ctrl, main_router=router1)
    # 现在 ctrl 在 1% / 10% 阶段时, shadow 自动开启
"""

from __future__ import annotations

import threading
from collections.abc import Iterable

from app.shadow_traffic import ShadowRouter

from app.canary_stages import CanaryStageController, Stage

# ---------------------------------------------------------------------------
# 联动策略
# ---------------------------------------------------------------------------

# 默认: 1% / 10% 阶段启用 shadow, 50%+ 关闭
DEFAULT_SHADOW_LINK_STAGES = frozenset({Stage.STAGE_1, Stage.STAGE_2})


class CanaryShadowLink:
    """Canary 阶段 ↔ Shadow 启用联动.

    状态:
      - 当前 canary 阶段
      - 当前 shadow 是否启用
      - 历史联动事件 (audit)
    """

    def __init__(
        self,
        canary: CanaryStageController,
        shadow: ShadowRouter | None = None,
        link_stages: Iterable[Stage] | None = None,
    ):
        self._lock = threading.RLock()
        self._canary = canary
        self._shadow = shadow or ShadowRouter(ratio=0.0)
        # 注: 用 is not None 判定, 避免空列表被当作 falsy 走默认
        if link_stages is not None:
            self._link_stages = frozenset(link_stages)
        else:
            self._link_stages = DEFAULT_SHADOW_LINK_STAGES
        self._events: list[dict] = []
        # 初始化
        self._sync_shadow_to_canary(actor="init", reason="link 初始化")

    # ---------- 状态查询 ----------
    @property
    def canary(self) -> CanaryStageController:
        return self._canary

    @property
    def shadow(self) -> ShadowRouter:
        return self._shadow

    def is_shadow_active(self) -> bool:
        """当前是否启用 shadow."""
        with self._lock:
            return self._shadow.ratio > 0

    def link_stages(self) -> frozenset:
        return self._link_stages

    def events(self) -> list[dict]:
        with self._lock:
            return list(self._events)

    def current_stage_ratio(self) -> float:
        return self._canary.current_ratio()

    # ---------- 联动触发 ----------
    def sync(self, actor: str = "system", reason: str = "") -> dict | None:
        """根据当前 canary 阶段调整 shadow.ratio.

        返回: {
            "previous_shadow_ratio": float,
            "new_shadow_ratio": float,
            "canary_stage": str,
            "shadow_active": bool,
            "actor": str,
            "reason": str,
        }
        """
        return self._sync_shadow_to_canary(actor=actor, reason=reason)

    def _sync_shadow_to_canary(self, actor: str, reason: str) -> dict:
        with self._lock:
            cur_stage = self._canary.current_stage()
            previous_ratio = self._shadow.ratio
            should_enable = cur_stage in self._link_stages
            # 计算新 ratio = canary 当前阶段比例 (v2 流量全打 shadow)
            # 简化: shadow.ratio = canary.current_ratio()
            new_ratio = self._canary.current_ratio() if should_enable else 0.0
            self._shadow.ratio = new_ratio
            ev = {
                "ts": __import__("time").time(),
                "canary_stage": cur_stage.value,
                "canary_ratio": self._canary.current_ratio(),
                "previous_shadow_ratio": previous_ratio,
                "new_shadow_ratio": new_ratio,
                "shadow_active": new_ratio > 0,
                "actor": actor,
                "reason": reason,
            }
            self._events.append(ev)
            # 限制 history 大小
            if len(self._events) > 200:
                self._events = self._events[-100:]
            return ev

    def attach(self) -> None:
        """挂接到 canary, 每次 promote/rollback 后自动 sync.

        注意: 当前 CanaryStageController 不提供事件回调, 此方法保留为
        未来 hook 设计. 当前用法是手动调 sync() 或在 promote 之后调.
        """
        pass


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_LINK: CanaryShadowLink | None = None
_LINK_LOCK = threading.Lock()


def get_linked_router(
    canary: CanaryStageController | None = None,
    shadow: ShadowRouter | None = None,
    link_stages: Iterable[Stage] | None = None,
) -> CanaryShadowLink:
    """拿全局联动 link (懒初始化)."""
    global _LINK
    with _LINK_LOCK:
        if _LINK is None:
            from app.canary_stages import get_default_controller

            canary = canary or get_default_controller()
            _LINK = CanaryShadowLink(
                canary=canary,
                shadow=shadow,
                link_stages=link_stages,
            )
        return _LINK


def reset_linked_router() -> None:
    """测试用."""
    global _LINK
    with _LINK_LOCK:
        _LINK = None
