"""子进程资源监控(P1-3,对齐 CLI 端 worker-entry heartbeat RSS 自报)。

三层防御(对齐研究报告):
1. 应用层软限制:executor 内部自检(本模块提供监控协程)
2. 父进程监控层:psutil 轮询 RSS/CPU,超限 terminate
3. OS 硬上限:预留给子进程执行器(当前 executor 为同进程 asyncio Task,本层未启用)

psutil 可选:未安装时降级为仅超时控制(不监控 RSS/CPU)。
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import psutil

    _PSUTIL_AVAILABLE = True
except ImportError:
    psutil = None  # type: ignore
    _PSUTIL_AVAILABLE = False


@dataclass
class ResourceViolation:
    """资源违规记录。"""

    resource: str  # "memory" | "cpu_seconds"
    limit: float
    actual: float


@dataclass
class ResourceMonitor:
    """异步轮询子进程 RSS / CPU,超限 terminate(第二层软监控)。

    仅当 psutil 可用时生效。无 psutil 时 start() 立即返回,stop() 返回空。

    kill_on_violation=False 时只记录违规不 kill 进程(用于 ai-service 同 event loop executor
    场景:监控 os.getpid() 但不能杀自己,由调用方检查 terminated/violations 后 cancel executor)。
    """

    pid: int
    memory_mb: Optional[float] = None
    cpu_seconds: Optional[float] = None
    poll_interval_s: float = 2.0
    kill_on_violation: bool = True
    _task: Optional[asyncio.Task] = None
    _violations: list[ResourceViolation] = field(default_factory=list)
    _terminated: bool = False

    async def start(self) -> None:
        """启动监控协程(无 psutil 时直接返回)。"""
        if not _PSUTIL_AVAILABLE:
            logger.debug("psutil 未安装,资源监控降级为仅超时控制")
            return
        if self.memory_mb is None and self.cpu_seconds is None:
            return  # 无限制配置,不启动
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> list[ResourceViolation]:
        """停止监控,返回违规记录。"""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        return self._violations

    @property
    def terminated(self) -> bool:
        """是否因资源超限被 terminate。"""
        return self._terminated

    async def _loop(self) -> None:
        """监控主循环(每 poll_interval_s 检查一次)。"""
        try:
            proc = psutil.Process(self.pid)
        except psutil.NoSuchProcess:
            return

        while True:
            try:
                # 进程树列表(合并两次 children 调用为一次,避免性能开销与竞态)
                children = proc.children(recursive=True)

                # 计算进程树总 RSS(含子进程)
                try:
                    rss = proc.memory_info().rss
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue  # 跳过本轮,不终止循环
                for child in children:
                    try:
                        rss += child.memory_info().rss
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                # 计算进程树总 CPU 时间
                cpu_times = proc.cpu_times()
                cpu_total = cpu_times.user + cpu_times.system
                for child in children:  # 复用同一份 children 列表
                    try:
                        ct = child.cpu_times()
                        cpu_total += ct.user + ct.system
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                # 检查内存超限
                if self.memory_mb is not None:
                    rss_mb = rss / 1024 / 1024
                    if rss_mb > self.memory_mb:
                        self._violations.append(
                            ResourceViolation(
                                resource="memory",
                                limit=self.memory_mb,
                                actual=rss_mb,
                            )
                        )
                        if self.kill_on_violation:
                            await self._terminate_tree(proc)
                        else:
                            # 只标记违规不 kill(调用方检查后自行 cancel executor)
                            self._terminated = True
                        return

                # 检查 CPU 时间超限
                if self.cpu_seconds is not None and cpu_total > self.cpu_seconds:
                    self._violations.append(
                        ResourceViolation(
                            resource="cpu_seconds",
                            limit=self.cpu_seconds,
                            actual=cpu_total,
                        )
                    )
                    if self.kill_on_violation:
                        await self._terminate_tree(proc)
                    else:
                        self._terminated = True
                    return

            except psutil.NoSuchProcess:
                return
            except Exception as e:  # noqa: BLE001
                logger.warning("资源监控异常: %s", e)
                return

            await asyncio.sleep(self.poll_interval_s)

    async def _terminate_tree(self, proc: "psutil.Process") -> None:
        """杀整个进程树(子进程的子进程也要杀)。"""
        self._terminated = True
        try:
            for child in proc.children(recursive=True):
                try:
                    child.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass


def is_psutil_available() -> bool:
    """检查 psutil 是否可用。"""
    return _PSUTIL_AVAILABLE
