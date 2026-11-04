# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到批次执行标记(marker):部署环据此判断「是否有批次正在跑」(2026-11-04 立)。

为什么需要这个文件
------------------
2026-11-04 实测:08:05 主窗口批次跑到 08:06:58(第 6 个号刚打完「错峰延迟 29s
后签到」),08:06:59 部署环重启 IHUI-AI-SERVICE,进程被优雅关闭 ⇒ 本轮总结行
没打出、剩余账号当天不再有人管(调度器没有「本轮跑到第几个」的持久账本)。
修法不是「让部署永不重启」,而是**让部署等这一批跑完**,且等待有上限 —— 判据
必须有一份部署侧读得到的「批次正在执行」信号。

为什么用文件而不是查 DB
-----------------------
部署脚本不读 .env、不连库(与 verify-deploy-facts.ps1 同一条纪律);状态文件
是最小耦合面。而 checkin_records 只能事后看「哪个号已落记录」,判不出「正在
错峰等待中的那一批」—— 错峰等待期恰恰最容易被重启切断(实测 29s 延迟)。

写/删语义与硬杀残留
-------------------
- 批次进入 `_run_batch` 时写;结束(含异常中止)在 finally 里删。
- 进程被硬杀(SIGKILL / Stop-Process -Force)时 finally 不执行,marker 会留在
  盘上。所以部署侧**不能**把「文件存在」等同「批次在跑」:必须同时看心跳时间
  戳(每 20s 刷一次),超过 180s 没刷新就判过期(硬杀残留),照常部署并告警。
  否则一次硬杀会永久阻塞部署循环。
- 心跳 20s / 过期 180s 的依据:20s 足够小(部署侧 10s 轮询内能看到变化),也
  足够大(单次原子写盘 <1ms,不构成可疑抖动);180s = 9 次心跳缺失,足以排除
  GC 停顿 / 磁盘抖动造成的误判,又远小于部署环最小部署间隔 30 分钟,不会让
  一次硬杀把部署拖过一整个节拍。

失败语义
--------
marker 写不出来只记 WARN,绝不阻断批次本身(签到是业务主线,状态文件是
可观测性增强)。此时部署侧读不到状态 ⇒ 按 fail-closed 处理(视为「可能在执行」
等待到上限),理由见 deploy/win/lib/checkin-batch-gate.ps1 头注。

只在调度器真正启用时写
----------------------
由调用方 `_run_batch` 用 `_cron_enabled()` 门控:代码缺省 false(单测/裸跑),
这样测试与本地裸跑不会在工作树里落状态文件。cron 关闭时调度器不会起批,
该口径不会漏掉真实批次。
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

MARKER_ENV = "CHECKIN_BATCH_MARKER_PATH"
HEARTBEAT_ENV = "CHECKIN_BATCH_MARKER_HEARTBEAT_SECONDS"
SCHEMA = "ihui.checkin-batch.v1"
DEFAULT_HEARTBEAT_SECONDS = 20.0
# 部署侧的过期阈值(deploy/win/lib/checkin-batch-gate.ps1 的 -StaleSeconds 必须
# 与这里同值;跨语言没法共享常量,故两边都写明依据,改一处必须改两处)。
STALE_AFTER_SECONDS = 180.0


def default_marker_path() -> Path:
    """marker 默认路径:`<仓库根>/deploy/run/checkin-batch.json`。

    仓库根由本文件位置推导(`parents[4]`)而不是写死盘符 —— 本仓从 G: 迁到 D:
    时写死绝对路径的脚本集体失效过一次(见 deploy/win/ihui-root-common.ps1 头注)。
    prod 服务工作目录是 `<根>\\apps\\ai-service`(run-ai.ps1 里 Set-Location),故本
    文件的 parents[4] 与部署脚本 Resolve-IhuiProjectRoot 解析出的 `$Root` 是同一
    个目录;两边都落到 `<根>\\deploy\\run\\checkin-batch.json`。
    `CHECKIN_BATCH_MARKER_PATH` 可显式覆盖(单测 / 换根时用)。
    """
    override = os.environ.get(MARKER_ENV, "").strip()
    if override:
        return Path(override).expanduser()
    return Path(__file__).resolve().parents[4] / "deploy" / "run" / "checkin-batch.json"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    """先写同目录临时文件再 os.replace:读侧永不会看到半截 JSON。

    部署侧是每 10s 独立读一次,读到半截 JSON 会被判成 unknown(fail-closed),
    虽不致命但会把一次正常心跳误当成「读不到」;原子替换从根上消掉这个窗口。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


class CheckinBatchMarker:
    """一个批次的执行标记:`start()` 写盘并起心跳,`stop()` 停心跳并删文件。"""

    def __init__(
        self,
        batch: str,
        *,
        path: Path | None = None,
        heartbeat_seconds: float | None = None,
    ) -> None:
        self.batch = batch
        self.path = path or default_marker_path()
        raw = heartbeat_seconds
        if raw is None:
            try:
                raw = float(os.environ.get(HEARTBEAT_ENV, DEFAULT_HEARTBEAT_SECONDS))
            except ValueError:
                raw = DEFAULT_HEARTBEAT_SECONDS
        # 下限 1s:配置成 0/负数会把心跳打成交互式忙等。
        self.heartbeat_seconds = max(1.0, float(raw))
        self.pid = os.getpid()
        self.started_at = _now_iso()
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._stopped = False

    def _payload(self) -> dict[str, Any]:
        return {
            "schema": SCHEMA,
            "pid": self.pid,
            "batch": self.batch,
            "startedAt": self.started_at,
            "heartbeatAt": _now_iso(),
            "host": socket.gethostname(),
        }

    def write(self) -> bool:
        """写/刷新 marker。失败只告警,返回 False(绝不抛给批次)。"""
        try:
            _atomic_write(self.path, self._payload())
            return True
        except Exception as e:
            logger.warning("[checkin_batch_marker] 写批次标记失败(不阻断批次): %s", e)
            return False

    def beat(self) -> bool:
        if self._stopped:
            return False
        return self.write()

    def clear(self) -> bool:
        try:
            self.path.unlink(missing_ok=True)
            return True
        except Exception as e:
            # 删不掉不算致命:部署侧靠心跳过期兜底(180s 后判 stale)。
            logger.warning(
                "[checkin_batch_marker] 删除批次标记失败(部署侧将按心跳过期处理): %s", e
            )
            return False

    async def _heartbeat_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self.heartbeat_seconds)
            except asyncio.CancelledError:
                raise
            self.beat()

    async def start(self) -> bool:
        ok = self.write()
        self._stopped = False
        self._heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(), name=f"checkin-batch-marker:{self.batch}"
        )
        return ok

    async def stop(self) -> None:
        """停心跳并删 marker。任何异常都不许冒到批次的 finally。

        顺序刻意是「先置位 _stopped → 同步删文件 → 再 cancel 心跳」:
        服务优雅关闭时批次 finally 里的 await 仍可能被二次取消,若把删除放在
        await 之后,文件就会留在盘上;先同步删掉,最坏也只是心跳任务被取消,
        不会留下一个假「批次仍在跑」的 marker。
        """
        self._stopped = True
        self.clear()
        task = self._heartbeat_task
        self._heartbeat_task = None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.warning("[checkin_batch_marker] 心跳任务收尾异常: %s", e)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
