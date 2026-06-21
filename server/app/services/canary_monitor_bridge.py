"""Canary 监听器联动 (建议 5 联动方案) - app/services/canary_monitor_bridge.py.

设计:
  - 周期性检查 cached_expiration_monitor.is_running 状态
  - 持续 N 次为 False (默认 4 次 × 30s = 2 分钟) 触发 canary 紧急回滚
  - 联动 CanaryStageController.mark_failure -> 走标准 auto_rollback 路径
  - 阈值可通过环境变量 ZHS_CANARY_MONITOR_FAIL_THRESHOLD 调整

为什么是这种设计:
  - 不依赖 Prometheus 抓指标 (进程内直接读, 避免跨进程 / 抓取延迟)
  - 不在 monitor.stop() 中直接 mark_failure (正常关闭是合法行为, 不能误回滚)
  - 用连续 N 次检测失败来排除瞬时抖动 (30s 间隔 × 4 = 2min)
  - 与 ZHSMonitorDown 告警对齐 (Prometheus for 2m), 两边独立触发, 不会因告警路由失败而漏回滚

用法 (main.py lifespan):
    from app.services.canary_monitor_bridge import start_canary_monitor_bridge, stop_canary_monitor_bridge
    # 在 monitor_manager.start_all_monitors() 之后调用
    await start_canary_monitor_bridge()
"""

from __future__ import annotations

import asyncio
import os
import time

from loguru import logger

# 避免循环 import: 延迟到首次检测时再 import canary 控制器
_canary_controller = None
_bridge_task: asyncio.Task | None = None
_stopping = False

# 阈值
DEFAULT_CHECK_INTERVAL = 30  # 秒
DEFAULT_FAIL_THRESHOLD = 4  # 连续 4 次 (×30s = 2min) 失败才触发
DEFAULT_ENABLED = True


def _get_canary_controller():
    """延迟加载 canary 控制器, 避免循环 import."""
    global _canary_controller
    if _canary_controller is None:
        try:
            from app.canary_stages import CanaryStageController

            _canary_controller = CanaryStageController()
            logger.info("canary_monitor_bridge: 已加载 CanaryStageController")
        except Exception as e:
            logger.warning(f"canary_monitor_bridge: 加载 CanaryStageController 失败: {e}")
            _canary_controller = False  # 标记失败, 不再重试
    return _canary_controller if _canary_controller is not False else None


def _get_monitor():
    """延迟加载 cached_expiration_monitor 单例."""
    try:
        from app.services.monitor_startup import monitor_manager

        return monitor_manager.cached_monitor
    except Exception as e:
        logger.debug(f"canary_monitor_bridge: 加载 monitor_manager 失败: {e}")
        return None


def _check_monitor_and_maybe_rollback(bridge_state: dict) -> None:
    """单次检测: 读 monitor.is_running, 连续失败累计 N 次则 mark_failure."""
    monitor = _get_monitor()
    running = bool(monitor and monitor.is_running)
    bridge_state["last_check_ts"] = time.time()

    if running:
        # 健康, 重置失败计数
        if bridge_state["fail_streak"] > 0:
            logger.info(f"canary_monitor_bridge: 监听器恢复运行, 重置 fail_streak={bridge_state['fail_streak']}")
        bridge_state["fail_streak"] = 0
        return

    # 监听器当前不在跑
    bridge_state["fail_streak"] += 1
    bridge_state["last_down_ts"] = time.time()
    threshold = bridge_state["fail_threshold"]
    streak = bridge_state["fail_streak"]

    if streak < threshold:
        logger.warning(f"canary_monitor_bridge: 监听器掉线 {streak}/{threshold} 次, 未达阈值, 暂不触发回滚")
        return

    # 达阈值 -> 触发 canary mark_failure (走标准 auto_rollback 路径)
    if bridge_state.get("triggered"):
        # 已触发过, 避免反复 mark
        return

    controller = _get_canary_controller()
    if controller is None:
        logger.error("canary_monitor_bridge: 监听器掉线已达阈值, 但 canary 控制器不可用, 跳过回滚")
        bridge_state["triggered"] = True  # 避免反复尝试
        return

    try:
        tenant = bridge_state.get("tenant_id", "default")
        reason = (
            f"[tenant={tenant}] cached_expiration_monitor 持续掉线 {streak} 次 "
            f"(检查间隔 {bridge_state['check_interval']}s), "
            f"agent_buy / agent_settlement 自动过期可能失效"
        )
        logger.critical(f"canary_monitor_bridge: 触发 canary mark_failure -> auto_rollback, reason={reason}")
        ev = controller.mark_failure(reason=reason, tenant_id=tenant)
        logger.critical(
            f"canary_monitor_bridge: mark_failure 完成, event_type={ev.event_type}, "
            f"{ev.from_stage} -> {ev.to_stage}, tenant={tenant}"
        )
        bridge_state["triggered"] = True
        bridge_state["last_trigger_ts"] = time.time()
    except TypeError:
        # controller 旧版本 mark_failure 不接受 tenant_id, 降级到无参
        try:
            ev = controller.mark_failure(reason=reason)
            bridge_state["triggered"] = True
        except Exception as e:
            logger.error(f"canary_monitor_bridge: mark_failure 异常: {e}")
    except Exception as e:
        logger.error(f"canary_monitor_bridge: mark_failure 异常: {e}")


async def _bridge_loop(bridge_state: dict) -> None:
    """主循环: 周期性检查 monitor 状态."""
    interval = bridge_state["check_interval"]
    logger.info(f"canary_monitor_bridge: 启动, 间隔 {interval}s, 阈值 {bridge_state['fail_threshold']} 次")
    while not _stopping:
        try:
            await asyncio.to_thread(_check_monitor_and_maybe_rollback, bridge_state)
        except Exception as e:
            logger.error(f"canary_monitor_bridge: 检测循环异常: {e}")
        await asyncio.sleep(interval)
    logger.info("canary_monitor_bridge: 已停止")


async def start_canary_monitor_bridge(
    check_interval: int = DEFAULT_CHECK_INTERVAL,
    fail_threshold: int = DEFAULT_FAIL_THRESHOLD,
    enabled: bool = DEFAULT_ENABLED,
    tenant_id: str = "default",
) -> None:
    """启动 canary 联动桥接.

    供 main.py lifespan 在 monitor_manager.start_all_monitors() 之后调用.
    tenant_id: 多租户场景下传入, 写进 mark_failure reason 便于 audit log 区分.
    """
    global _bridge_task, _stopping

    if not enabled or os.environ.get("ZHS_CANARY_MONITOR_BRIDGE_DISABLED", "0") == "1":
        logger.info("canary_monitor_bridge: 已禁用 (ZHS_CANARY_MONITOR_BRIDGE_DISABLED=1)")
        return

    if _bridge_task and not _bridge_task.done():
        logger.warning("canary_monitor_bridge: 已在运行, 跳过重复启动")
        return

    check_interval = int(float(os.environ.get("ZHS_CANARY_MONITOR_CHECK_INTERVAL", check_interval)))
    fail_threshold = int(os.environ.get("ZHS_CANARY_MONITOR_FAIL_THRESHOLD", fail_threshold))
    tenant_id = os.environ.get("ZHS_CANARY_MONITOR_TENANT_ID", tenant_id)

    bridge_state = {
        "check_interval": check_interval,
        "fail_threshold": fail_threshold,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
        "tenant_id": tenant_id,
    }
    _stopping = False
    _bridge_task = asyncio.create_task(_bridge_loop(bridge_state))
    logger.info(f"canary_monitor_bridge: 启动 tenant={tenant_id} interval={check_interval}s threshold={fail_threshold}")


async def stop_canary_monitor_bridge() -> None:
    """停止 canary 联动桥接."""
    global _bridge_task, _stopping
    _stopping = True
    if _bridge_task and not _bridge_task.done():
        _bridge_task.cancel()
        try:
            await _bridge_task
        except (asyncio.CancelledError, Exception):
            logger.warning("Caught unexpected exception")
    _bridge_task = None
    logger.info("canary_monitor_bridge: 停止完成")


def get_bridge_status() -> dict:
    """供 /api/v1/monitor/status 端点暴露状态."""
    if _bridge_task is None:
        return {"running": False}
    return {
        "running": not _bridge_task.done(),
        "stopping": _stopping,
    }
