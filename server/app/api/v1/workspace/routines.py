"""
Routines — 定时任务调度系统。

对标:
- Claude Code 的 Routines (定时任务)
- 传统 cron 调度器

设计要点:
- RoutineManager 管理所有定时任务, 持久化到 ~/.ihui/routines.json
- 调度器为 asyncio 后台任务, 每 60 秒检查一次 cron 表达式是否匹配
- 匹配时通过 BackgroundAgentManager 启动一个后台 agent 执行 prompt
- cron 解析仅使用标准库 datetime + calendar, 无额外依赖

事件协议:
- 触发时调用 BackgroundAgentManager.start_background_agent(), 返回 agent_id
- last_result 记录最近一次触发的 agent_id 与状态摘要
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# 存储目录
# ---------------------------------------------------------------------------

_STORE_ROOT = Path.home() / ".ihui"
_ROUTINES_FILE = _STORE_ROOT / "routines.json"


def _ensure_dirs() -> None:
    """确保存储目录存在。"""
    _STORE_ROOT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# RoutineConfig — 定时任务配置
# ---------------------------------------------------------------------------


@dataclass
class RoutineConfig:
    """定时任务配置。

    Attributes:
        id: 唯一标识 (UUID)
        name: 用户可读名称
        prompt: 定时执行的 agent prompt
        cron_expression: 5 字段 cron 表达式 (分 时 日 月 周)
        workspace_path: 工作区绝对路径
        model_id: 模型 code
        enabled: 是否启用
        created_at: 创建时间 (Unix timestamp)
        last_run: 上次执行时间 (Unix timestamp, None 表示从未执行)
        last_result: 上次执行结果摘要
        next_run: 下次预计执行时间 (Unix timestamp)
    """

    id: str
    name: str
    prompt: str
    cron_expression: str
    workspace_path: str
    model_id: str = "default"
    enabled: bool = True
    created_at: float = field(default_factory=time.time)
    last_run: float | None = None
    last_result: str | None = None
    next_run: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 持久化的 dict。"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RoutineConfig:
        """从 dict 反序列化 (容忍缺失字段)。"""
        return cls(
            id=data["id"],
            name=data["name"],
            prompt=data["prompt"],
            cron_expression=data["cron_expression"],
            workspace_path=data["workspace_path"],
            model_id=data.get("model_id", "default"),
            enabled=data.get("enabled", True),
            created_at=data.get("created_at", time.time()),
            last_run=data.get("last_run"),
            last_result=data.get("last_result"),
            next_run=data.get("next_run"),
        )


# ---------------------------------------------------------------------------
# cron 表达式解析 (仅使用标准库 datetime)
# ---------------------------------------------------------------------------

# 各字段的取值范围: (min, max)
_FIELD_RANGES = {
    "minute": (0, 59),
    "hour": (0, 23),
    "day": (1, 31),
    "month": (1, 12),
    "weekday": (0, 6),  # 0=Sunday, 6=Saturday
}


def _parse_field(expr: str, min_val: int, max_val: int) -> set[int]:
    """解析单个 cron 字段为允许的值集合。

    支持:
    - ``*``        — 全部值
    - ``*/n``      — 从最小值起每 n 步
    - ``n``        — 单个值
    - ``a-b``      — 区间
    - ``a-b/n``    — 区间内每 n 步
    - ``a,b,c``    — 列表 (可混合上述语法)
    """
    result: set[int] = set()
    for part in expr.split(","):
        part = part.strip()
        if not part:
            continue

        # 步进 step
        step = 1
        base = part
        if "/" in part:
            base, step_str = part.split("/", 1)
            step = int(step_str)
            if step <= 0:
                raise ValueError(f"步进值必须为正整数: {step_str!r}")

        # 区间 / 通配 / 单值
        if base == "*":
            lo, hi = min_val, max_val
        elif "-" in base:
            lo_str, hi_str = base.split("-", 1)
            lo, hi = int(lo_str), int(hi_str)
        else:
            lo = hi = int(base)

        # 校验范围
        if lo < min_val or hi > max_val or lo > hi:
            raise ValueError(
                f"字段值超出范围 [{min_val},{max_val}] 或区间非法: {part!r}"
            )

        for v in range(lo, hi + 1, step):
            result.add(v)

    return result


def parse_cron(expr: str, from_ts: float | None = None) -> float:
    """解析 cron 表达式, 返回下一次匹配的 Unix timestamp。

    Args:
        expr: 5 字段 cron 表达式 (minute hour day month weekday)
        from_ts: 参考时间戳 (从此时间之后寻找下一次匹配), 默认为当前时间

    Returns:
        下一次匹配时间的 Unix timestamp (本地时间)

    Raises:
        ValueError: 表达式格式非法或 366 天内无匹配
    """
    fields = expr.split()
    if len(fields) != 5:
        raise ValueError(
            f"cron 表达式必须是 5 个字段 (minute hour day month weekday): {expr!r}"
        )

    minutes = _parse_field(fields[0], *_FIELD_RANGES["minute"])
    hours = _parse_field(fields[1], *_FIELD_RANGES["hour"])
    days = _parse_field(fields[2], *_FIELD_RANGES["day"])
    months = _parse_field(fields[3], *_FIELD_RANGES["month"])
    weekdays = _parse_field(fields[4], *_FIELD_RANGES["weekday"])

    # 参考时间 (本地时间)
    if from_ts is not None:
        base = datetime.fromtimestamp(from_ts)
    else:
        base = datetime.now()

    # 从下一分钟开始检查 (秒、微秒归零, 避免重复触发当前分钟)
    candidate = base.replace(second=0, microsecond=0) + timedelta(minutes=1)

    # 最多搜索 366 天 (考虑 2 月 29 日)
    limit = candidate + timedelta(days=366)

    while candidate <= limit:
        # Python weekday(): 0=Monday..6=Sunday
        # cron weekday:     0=Sunday..6=Saturday
        cron_wd = (candidate.weekday() + 1) % 7

        if (
            candidate.minute in minutes
            and candidate.hour in hours
            and candidate.day in days
            and candidate.month in months
            and cron_wd in weekdays
        ):
            return candidate.timestamp()

        # 优化: 如果月份不匹配, 直接跳到下个月 1 号 0 点
        if candidate.month not in months:
            if candidate.month == 12:
                candidate = candidate.replace(year=candidate.year + 1, month=1, day=1, hour=0, minute=0)
            else:
                candidate = candidate.replace(month=candidate.month + 1, day=1, hour=0, minute=0)
            continue

        # 优化: 如果日期或星期不匹配, 跳到下一天 0 点
        if candidate.day not in days and cron_wd not in weekdays:
            candidate += timedelta(days=1)
            candidate = candidate.replace(hour=0, minute=0)
            continue

        # 优化: 如果小时不匹配, 跳到下一小时
        if candidate.hour not in hours:
            candidate += timedelta(hours=1)
            candidate = candidate.replace(minute=0)
            continue

        # 分钟不匹配, 前进一分钟
        candidate += timedelta(minutes=1)

    raise ValueError(f"366 天内未找到匹配的执行时间: {expr!r}")


def validate_cron(expr: str) -> bool:
    """校验 cron 表达式是否合法。

    Returns:
        True 表示合法
    """
    try:
        parse_cron(expr)
        return True
    except (ValueError, Exception):
        return False


# ---------------------------------------------------------------------------
# RoutineManager — 定时任务管理器 (单例)
# ---------------------------------------------------------------------------


class RoutineManager:
    """管理所有定时任务 (Routines)。

    内存态:
        _routines: routine_id -> RoutineConfig
    磁盘态:
        ~/.ihui/routines.json — 所有 routine 配置 + 运行状态

    调度器:
        后台 asyncio.Task, 每 60 秒检查一次, 匹配时通过
        BackgroundAgentManager 启动后台 agent 执行 prompt。

    线程安全: 仅在 asyncio 事件循环中使用 (FastAPI 单线程异步模型)。
    """

    # 调度器检查间隔 (秒)
    _CHECK_INTERVAL = 60

    def __init__(self) -> None:
        self._routines: dict[str, RoutineConfig] = {}
        self._scheduler_task: asyncio.Task[Any] | None = None
        self._running = False
        _ensure_dirs()
        self._load()

    # ------------------------------------------------------------------
    # 持久化
    # ------------------------------------------------------------------

    def _load(self) -> None:
        """从磁盘加载已保存的 routines。"""
        if not _ROUTINES_FILE.exists():
            return
        try:
            data = json.loads(_ROUTINES_FILE.read_text(encoding="utf-8"))
            routines = data.get("routines", []) if isinstance(data, dict) else data
            for item in routines:
                try:
                    cfg = RoutineConfig.from_dict(item)
                    self._routines[cfg.id] = cfg
                except Exception as e:
                    logger.warning(f"加载 routine 失败, 跳过: {e}")
            logger.info(f"已加载 {len(self._routines)} 个定时任务")
        except Exception as e:
            logger.warning(f"加载 routines.json 失败: {e}")

    def _save(self) -> None:
        """持久化所有 routines 到磁盘。"""
        _ensure_dirs()
        try:
            data = {
                "routines": [cfg.to_dict() for cfg in self._routines.values()],
                "updated_at": time.time(),
            }
            _ROUTINES_FILE.write_text(
                json.dumps(data, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning(f"保存 routines.json 失败: {e}")

    # ------------------------------------------------------------------
    # 增删改查
    # ------------------------------------------------------------------

    def add_routine(
        self,
        name: str,
        prompt: str,
        cron_expression: str,
        workspace_path: str,
        model_id: str = "default",
        enabled: bool = True,
    ) -> RoutineConfig:
        """添加定时任务。

        Args:
            name: 用户可读名称
            prompt: 定时执行的 agent prompt
            cron_expression: 5 字段 cron 表达式
            workspace_path: 工作区绝对路径
            model_id: 模型 code
            enabled: 是否启用

        Returns:
            创建的 RoutineConfig

        Raises:
            ValueError: cron 表达式非法
        """
        # 校验 cron
        next_run = parse_cron(cron_expression)

        cfg = RoutineConfig(
            id=str(uuid.uuid4()),
            name=name,
            prompt=prompt,
            cron_expression=cron_expression,
            workspace_path=workspace_path,
            model_id=model_id,
            enabled=enabled,
            created_at=time.time(),
            next_run=next_run,
        )
        self._routines[cfg.id] = cfg
        self._save()
        logger.info(
            f"已添加定时任务: id={cfg.id}, name={name}, cron={cron_expression}"
        )
        return cfg

    def remove_routine(self, routine_id: str) -> bool:
        """删除定时任务。

        Returns:
            是否删除成功
        """
        if routine_id not in self._routines:
            return False
        name = self._routines[routine_id].name
        del self._routines[routine_id]
        self._save()
        logger.info(f"已删除定时任务: id={routine_id}, name={name}")
        return True

    def get_routine(self, routine_id: str) -> RoutineConfig | None:
        """获取定时任务详情。"""
        return self._routines.get(routine_id)

    def list_routines(self, workspace_path: str | None = None) -> list[RoutineConfig]:
        """列出所有定时任务。

        Args:
            workspace_path: 可选, 按工作区过滤

        Returns:
            RoutineConfig 列表 (按创建时间倒序)
        """
        routines = list(self._routines.values())
        if workspace_path:
            routines = [r for r in routines if r.workspace_path == workspace_path]
        routines.sort(key=lambda r: r.created_at, reverse=True)
        return routines

    def update_routine(
        self,
        routine_id: str,
        *,
        name: str | None = None,
        prompt: str | None = None,
        cron_expression: str | None = None,
        model_id: str | None = None,
        enabled: bool | None = None,
    ) -> RoutineConfig | None:
        """更新定时任务配置。

        仅更新非 None 的字段。若 cron_expression 变更则重新计算 next_run。

        Returns:
            更新后的 RoutineConfig, 或 None (不存在)
        """
        cfg = self._routines.get(routine_id)
        if cfg is None:
            return None

        if name is not None:
            cfg.name = name
        if prompt is not None:
            cfg.prompt = prompt
        if model_id is not None:
            cfg.model_id = model_id
        if enabled is not None:
            cfg.enabled = enabled
        if cron_expression is not None:
            # 校验新 cron 并重新计算下次执行时间
            cfg.cron_expression = cron_expression
            cfg.next_run = parse_cron(cron_expression)

        self._save()
        logger.info(f"已更新定时任务: id={routine_id}, name={cfg.name}")
        return cfg

    def enable_routine(self, routine_id: str) -> bool:
        """启用定时任务。"""
        cfg = self._routines.get(routine_id)
        if cfg is None:
            return False
        cfg.enabled = True
        cfg.next_run = parse_cron(cfg.cron_expression)
        self._save()
        logger.info(f"已启用定时任务: id={routine_id}, name={cfg.name}")
        return True

    def disable_routine(self, routine_id: str) -> bool:
        """禁用定时任务。"""
        cfg = self._routines.get(routine_id)
        if cfg is None:
            return False
        cfg.enabled = False
        cfg.next_run = None
        self._save()
        logger.info(f"已禁用定时任务: id={routine_id}, name={cfg.name}")
        return True

    # ------------------------------------------------------------------
    # 触发执行
    # ------------------------------------------------------------------

    def trigger_routine(self, routine_id: str) -> dict[str, Any] | None:
        """手动触发定时任务 (立即执行一次, 不影响调度周期)。

        通过 BackgroundAgentManager 启动后台 agent 执行 prompt。

        Returns:
            {"agent_id": str, "routine_id": str, "triggered_at": float}
            或 None (routine 不存在)
        """
        cfg = self._routines.get(routine_id)
        if cfg is None:
            return None

        try:
            from app.api.v1.workspace.background_agents import (
                get_background_agent_manager,
            )

            manager = get_background_agent_manager()
            agent_id = manager.start_background_agent(
                prompt=cfg.prompt,
                workspace_path=cfg.workspace_path,
                model_id=cfg.model_id,
            )
        except Exception as e:
            logger.error(f"触发定时任务失败: id={routine_id}, error={e}")
            cfg.last_run = time.time()
            cfg.last_result = f"触发失败: {e}"
            self._save()
            return {
                "routine_id": routine_id,
                "error": str(e),
                "triggered_at": cfg.last_run,
            }

        now = time.time()
        cfg.last_run = now
        cfg.last_result = f"已触发, agent_id={agent_id}"
        # 重新计算下次执行时间 (调度器触发时也会更新)
        try:
            cfg.next_run = parse_cron(cfg.cron_expression, now)
        except Exception:
            pass
        self._save()

        logger.info(
            f"定时任务已手动触发: id={routine_id}, name={cfg.name}, agent_id={agent_id}"
        )
        return {
            "agent_id": agent_id,
            "routine_id": routine_id,
            "triggered_at": now,
        }

    # ------------------------------------------------------------------
    # 调度器
    # ------------------------------------------------------------------

    async def start_scheduler(self) -> None:
        """启动后台调度器 (asyncio 定时检查)。

        幂等: 若已运行则不重复启动。
        """
        if self._running:
            return
        self._running = True
        self._scheduler_task = asyncio.create_task(
            self._scheduler_loop(), name="routines-scheduler"
        )
        logger.info("Routines 调度器已启动 (检查间隔 60s)")

    async def stop_scheduler(self) -> None:
        """停止后台调度器。"""
        self._running = False
        if self._scheduler_task and not self._scheduler_task.done():
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        self._scheduler_task = None
        logger.info("Routines 调度器已停止")

    async def _scheduler_loop(self) -> None:
        """调度器主循环: 每 60 秒检查一次所有 enabled routine。"""
        while self._running:
            try:
                now = time.time()
                for cfg in list(self._routines.values()):
                    if not cfg.enabled:
                        continue
                    # next_run 为空时重新计算
                    if cfg.next_run is None:
                        try:
                            cfg.next_run = parse_cron(cfg.cron_expression, now)
                        except Exception as e:
                            logger.warning(
                                f"routine {cfg.id} cron 解析失败: {e}, 已禁用"
                            )
                            cfg.enabled = False
                            continue
                    # 到达触发时间
                    if now >= cfg.next_run:
                        logger.info(
                            f"定时任务到期触发: id={cfg.id}, name={cfg.name}"
                        )
                        self.trigger_routine(cfg.id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Routines 调度器异常: {e}")

            # 等待下一次检查
            await asyncio.sleep(self._CHECK_INTERVAL)

    # ------------------------------------------------------------------
    # 辅助: 查询下次执行时间 (供 API 使用)
    # ------------------------------------------------------------------

    def refresh_next_run(self, routine_id: str) -> float | None:
        """重新计算并返回指定 routine 的下次执行时间。"""
        cfg = self._routines.get(routine_id)
        if cfg is None:
            return None
        try:
            cfg.next_run = parse_cron(cfg.cron_expression)
            self._save()
            return cfg.next_run
        except Exception:
            return None


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_manager: RoutineManager | None = None


def get_routine_manager() -> RoutineManager:
    """获取全局 RoutineManager 单例。"""
    global _manager
    if _manager is None:
        _manager = RoutineManager()
    return _manager
