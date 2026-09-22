# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""生产 ⇄ 开发 数据库全表自动同步调度器(2026-09-22 立)。

背景
----
管理端扫描到的发布平台账号曾写进开发库,生产库看不到(API 寻址错端所致)。
用户要求:① **所有表**都要同步;② 自动化必须跑在**我们自己的程序里**,
不再依赖外部调度器。

设计
----
- **真源单一化**:生产库是唯一真源。
  - `sync`   开发 → 生产 单向增量回灌(只 upsert / insert,**永不删生产数据**)
  - `mirror` 生产 → 开发 全表收敛(先自动 `sync` 保住开发增量,再以生产覆盖本地)
  - `drift`  只读差异体检(不写任何一端)
- 同步实现全在 `scripts/db/db_sync.py`(全表枚举 + 按物理能力三级策略 + 噪音护栏
  + 类型漂移检测 + FK 拓扑序 + 业务唯一键 upsert + ssh 隧道自愈)。本调度器**只负责
  "何时跑"**:用 `sys.executable` 起子进程执行该脚本,读回 `--json` 摘要落内存历史。
- **子进程用 `asyncio.to_thread` 承载**,不用 `asyncio.create_subprocess_exec`:
  Windows + uvicorn(`--reload`)下事件循环是 SelectorEventLoop,asyncio 子进程会抛
  `NotImplementedError`(与 `browser_render.py` / `cookie_refresh_daemon` 同一个坑)。
- **安全闸**:同步配置(`.ihui-agent/db-sync.local.json`,含生产 DSN)是 gitignored
  的本机文件,生产部署不含它 —— 调度器探到配置缺失即静默待机(生产库本身即真源,
  无需自同步),绝不会在缺配置时误连。

配置(环境变量)
--------------
- `DB_SYNC_ENABLED=true|false`   总开关,默认 **false**(不显式开启则完全不挂任务)
- `DB_SYNC_MODE=sync|mirror`     间隔任务的同步方向,默认 `sync`
- `DB_SYNC_INTERVAL_MINUTES=120` 间隔任务周期(分钟),默认 120
- `DB_SYNC_STARTUP_DELAY=120`    启动后延迟秒数(避开启动期争抢),默认 120
- `DB_SYNC_RUN_ON_START=true`    启动延迟到点后立即跑一轮,默认 true
- `DB_SYNC_TIMEOUT=1800`         单次子进程超时(秒,sync/drift),默认 1800
- `DB_SYNC_MIRROR_TIMEOUT=7200`  mirror 的单次子进程超时(秒),默认 7200
- `DB_SYNC_MIRROR_AT=04:00`      每日 mirror 时刻(东八区);置空则关闭每日镜像
- `DB_SYNC_SCRIPT=<path>`        覆盖脚本路径(默认 `<repo>/scripts/db/db_sync.py`)
- `DB_SYNC_CONFIG=<path>`        覆盖配置路径(默认 `<repo>/.ihui-agent/db-sync.local.json`)

端点
----
- `GET  /api/db-sync/status`   只读状态(开关 / 作业 / 历史 / 依赖文件是否存在)
- `POST /api/db-sync/trigger`  手动触发一轮(仅 admin,后台执行,立即返回)
- `GET  /api/db-sync/drift`    排入一轮只读差异体检(后台执行,结果看 /status)
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, HTTPException, Request

from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/db-sync", tags=["db-sync"])

# apps/ai-service/app/services/db_sync_scheduler.py → parents[4] = 仓库根
_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_SCRIPT = _ROOT / "scripts" / "db" / "db_sync.py"
_DEFAULT_CONFIG = _ROOT / ".ihui-agent" / "db-sync.local.json"

# 与 scripts/db/db_sync.py 的 JSON_PREFIX 保持一致(跨进程契约)
_JSON_PREFIX = "__IHUI_DB_SYNC_JSON__"
# 东八区(用户主时区),每日镜像时刻按此解释
_CN_TZ = timezone(timedelta(hours=8))
_HISTORY_LIMIT = 40
_TAIL_CHARS = 6000
_TICK_SECONDS = 60
# 一轮失败后的重试间隔(分钟):失败不能等满整周期,否则一次网络抖动就白等 2 小时
_RETRY_MINUTES = 10


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(float(raw.strip()))
    except ValueError:
        logger.warning("[db_sync] %s=%r 不是数字,回落默认 %s", name, raw, default)
        return default


def _env_str(name: str, default: str = "") -> str:
    raw = os.environ.get(name)
    return default if raw is None else raw.strip()


@dataclass
class SyncRun:
    """一轮同步的执行记录。"""

    mode: str
    trigger: str  # schedule | startup | manual | admin | drift-endpoint
    started_at: str
    finished_at: str = ""
    duration_ms: int = 0
    exit_code: int | None = None
    ok: bool = False
    timed_out: bool = False
    summary: dict[str, Any] = field(default_factory=dict)
    tail: str = ""
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "trigger": self.trigger,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "exit_code": self.exit_code,
            "ok": self.ok,
            "timed_out": self.timed_out,
            "summary": self.summary,
            "tail": self.tail,
            "error": self.error,
        }


class DbSyncScheduler:
    """DB 全表同步调度器(模块级单例 db_sync_scheduler)。

    由 `main.py` 的 lifespan 显式 `start()` / `stop()`;未开启 `DB_SYNC_ENABLED`
    时 `start()` 直接返回,不创建任何任务。
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._history: list[SyncRun] = []
        self._last_interval_run: datetime | None = None
        self._next_interval_due: datetime | None = None
        self._last_mirror_date: str | None = None
        self._running_mode: str | None = None
        self._run_count = 0
        self._skip_reason = ""

    # ------------------------------------------------------------------
    # 配置读取(每次读环境变量,便于运行期改 .env 后重启即生效)
    # ------------------------------------------------------------------
    @property
    def enabled(self) -> bool:
        return _env_bool("DB_SYNC_ENABLED", False)

    @property
    def mode(self) -> str:
        m = _env_str("DB_SYNC_MODE", "sync").lower()
        return m if m in ("sync", "mirror") else "sync"

    @property
    def interval_minutes(self) -> int:
        return max(_env_int("DB_SYNC_INTERVAL_MINUTES", 120), 1)

    @property
    def startup_delay(self) -> int:
        return max(_env_int("DB_SYNC_STARTUP_DELAY", 120), 0)

    @property
    def timeout_seconds(self) -> int:
        """sync / drift 的单次子进程超时(秒)。"""
        return max(_env_int("DB_SYNC_TIMEOUT", 1800), 60)

    @property
    def mirror_timeout_seconds(self) -> int:
        """mirror 的单次子进程超时(秒)。

        mirror 要先把本地增量回灌、再把 588 张共有表整表 COPY 到本地(含 88 万行级的
        ai_feed_snapshot),量级远大于 sync;沿用 30 分钟会让它每夜都在中途被超时杀掉,
        变成"看似配了、实际永远跑不完"的假功能。
        """
        return max(_env_int("DB_SYNC_MIRROR_TIMEOUT", 7200), 60)

    def timeout_for(self, mode: str) -> int:
        """按模式取超时:mirror 用独立(更长)的档位。"""
        return self.mirror_timeout_seconds if mode == "mirror" else self.timeout_seconds

    @property
    def mirror_at(self) -> str:
        return _env_str("DB_SYNC_MIRROR_AT", "04:00")

    @property
    def script_path(self) -> Path:
        raw = _env_str("DB_SYNC_SCRIPT")
        return Path(raw).expanduser() if raw else _DEFAULT_SCRIPT

    @property
    def config_path(self) -> Path:
        raw = _env_str("DB_SYNC_CONFIG")
        return Path(raw).expanduser() if raw else _DEFAULT_CONFIG

    @property
    def is_running(self) -> bool:
        """是否有某一轮正在执行。"""
        return self._lock.locked()

    @property
    def running_mode(self) -> str | None:
        """正在执行的那一轮的模式;空闲时为 None。"""
        return self._running_mode

    def preflight(self) -> str:
        """返回不可运行的原因;空串表示可以跑。"""
        if not self.script_path.exists():
            return f"同步脚本不存在: {self.script_path}"
        if not self.config_path.exists():
            return f"同步配置不存在(本机未接生产): {self.config_path}"
        if self.config_path.stat().st_size == 0:
            return f"同步配置为空: {self.config_path}"
        return ""

    @property
    def state_path(self) -> Path:
        """调度水位落盘位置(记 last_interval_run / last_mirror_date)。

        必须落盘:开发机 ai-service 重启频繁,若水位只在内存,每次重启都把
        "距上次同步多久"清零 —— 间隔任务会被重启风暴饿死,永远等不到 120 分钟。
        """
        raw = _env_str("DB_SYNC_STATE")
        return Path(raw).expanduser() if raw else self.config_path.parent / "db-sync.state.json"

    def _load_state(self) -> None:
        """读取调度水位(文件缺失/损坏时静默忽略,不拦调度)。"""
        p = self.state_path
        if not p.exists():
            logger.info("[db_sync] 无调度水位文件(首次运行): %s", p)
            return
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001 — 状态损坏不应拦住调度
            logger.warning("[db_sync] 状态文件不可读(忽略): %s: %s", p, exc)
            return
        for key, attr in (
            ("last_interval_run", "_last_interval_run"),
            ("next_interval_due", "_next_interval_due"),
        ):
            raw = data.get(key)
            if isinstance(raw, str) and raw:
                with contextlib.suppress(ValueError):
                    setattr(self, attr, datetime.fromisoformat(raw))
        raw_mirror = data.get("last_mirror_date")
        if isinstance(raw_mirror, str) and raw_mirror:
            self._last_mirror_date = raw_mirror
        logger.info(
            "[db_sync] 读取调度水位: 上次间隔任务 %s, 下次到期 %s, 上次每日镜像 %s",
            self._last_interval_run.isoformat(timespec="seconds")
            if self._last_interval_run
            else "(无)",
            self._next_interval_due.isoformat(timespec="seconds")
            if self._next_interval_due
            else "(立即)",
            self._last_mirror_date or "(无)",
        )

    def _save_state(self) -> None:
        """原子落盘调度水位(失败只告警,不影响同步本身)。"""
        p = self.state_path

        def _iso(v: datetime | None) -> str | None:
            return v.isoformat(timespec="seconds") if v else None

        payload = {
            "last_interval_run": _iso(self._last_interval_run),
            "next_interval_due": _iso(self._next_interval_due),
            "last_mirror_date": self._last_mirror_date,
            "mode": self.mode,
            "updated_at": datetime.now(_CN_TZ).isoformat(timespec="seconds"),
        }
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            tmp = p.with_name(p.name + ".tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, p)  # 原子替换,避免半截文件
        except Exception as exc:  # noqa: BLE001 — 落盘失败只告警
            logger.warning("[db_sync] 调度水位落盘失败(忽略): %s", exc)

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------
    def start(self) -> None:
        """显式启动调度循环(lifespan 调用)。未开启开关时静默返回。"""
        if not self.enabled:
            self._skip_reason = "DB_SYNC_ENABLED 未开启"
            logger.info("[db_sync] 未启用(DB_SYNC_ENABLED=false),调度器不挂载")
            return
        reason = self.preflight()
        if reason:
            self._skip_reason = reason
            logger.info("[db_sync] 已开启但依赖缺失,静默待机: %s", reason)
            return
        if self._task is not None and not self._task.done():
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.warning("[db_sync] 无运行事件循环,跳过启动")
            return
        self._skip_reason = ""
        self._load_state()
        self._task = loop.create_task(self._loop(), name="db-sync-scheduler")
        logger.info(
            "[db_sync] 调度器已启动: mode=%s 间隔=%s 分钟 每日镜像=%s",
            self.mode, self.interval_minutes, self.mirror_at or "(关闭)",
        )

    async def stop(self) -> None:
        """停止调度循环(不打断已在运行的子进程,等它跑完)。"""
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._task = None
        logger.info("[db_sync] 调度器已停止")

    async def _loop(self) -> None:
        """主循环:每 60s 一拍,判断间隔任务与每日镜像任务是否到点。"""
        delay = self.startup_delay
        if delay:
            logger.info("[db_sync] 启动延迟 %ss 后开始调度", delay)
            await asyncio.sleep(delay)
        if not _env_bool("DB_SYNC_RUN_ON_START", True):
            # 显式要求"启动不补跑":把到期时刻推到整周期之后
            self._next_interval_due = datetime.now(_CN_TZ) + timedelta(
                minutes=self.interval_minutes
            )
            self._save_state()

        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("[db_sync] 调度拍异常(忽略,下一拍继续)")
            await asyncio.sleep(_TICK_SECONDS)

    async def _tick(self) -> None:
        now = datetime.now(_CN_TZ)
        # 1) 间隔任务(默认 2 小时:开发 → 生产 增量回灌)
        if self._next_interval_due is None or now >= self._next_interval_due:
            self._last_interval_run = now
            self._save_state()  # 先落"已开跑",重启也不会立刻重跑同一轮
            run = await self.run_once(self.mode, trigger="schedule")
            # 失败缩短到 _RETRY_MINUTES 再试,成功才等满整周期
            wait = self.interval_minutes if run.ok else min(_RETRY_MINUTES, self.interval_minutes)
            self._next_interval_due = datetime.now(_CN_TZ) + timedelta(minutes=wait)
            self._save_state()
            return
        # 2) 每日镜像(默认 04:00:生产 → 开发 全表收敛)
        if self._mirror_due(now):
            self._last_mirror_date = now.strftime("%Y-%m-%d")
            self._save_state()
            await self.run_once("mirror", trigger="schedule")

    def _mirror_due(self, now: datetime) -> bool:
        at = self.mirror_at
        if not at:
            return False
        try:
            hh, mm = (int(x) for x in at.split(":", 1))
        except ValueError:
            logger.warning("[db_sync] DB_SYNC_MIRROR_AT=%r 格式非法(应为 HH:MM),跳过", at)
            return False
        today = now.strftime("%Y-%m-%d")
        if self._last_mirror_date == today:
            return False
        return (now.hour, now.minute) >= (hh, mm)

    # ------------------------------------------------------------------
    # 执行
    # ------------------------------------------------------------------
    async def run_once(
        self, mode: str, trigger: str = "manual", extra_args: list[str] | None = None
    ) -> SyncRun:
        """跑一轮同步。已在跑时直接返回当前运行的快照,不排队堆积。"""
        started = datetime.now(_CN_TZ)
        run = SyncRun(
            mode=mode, trigger=trigger, started_at=started.isoformat(timespec="seconds")
        )
        if not self.enabled:
            run.error = "DB_SYNC_ENABLED 未开启"
            self._append(run)
            return run
        reason = self.preflight()
        if reason:
            run.error = reason
            self._append(run)
            return run
        if self._lock.locked():
            run.error = f"上一轮({self._running_mode})仍在执行,本次跳过"
            self._append(run)
            return run

        argv = [sys.executable, str(self.script_path), mode, "--json"]
        argv += extra_args or []
        if mode == "sync":
            argv.append("--apply")
        elif mode == "mirror":
            argv.append("--yes")
        elif mode == "drift":
            argv.append("--fail")
        timeout = self.timeout_for(mode)

        async with self._lock:
            self._running_mode = mode
            self._run_count += 1
            logger.info("[db_sync] 开始第 %s 轮: mode=%s trigger=%s", self._run_count, mode, trigger)
            t0 = asyncio.get_running_loop().time()
            try:
                code, out, err, timed_out = await asyncio.to_thread(
                    self._exec, argv, timeout
                )
                run.exit_code = code
                run.timed_out = timed_out
                run.summary = self._parse_summary(out)
                run.tail = (self._parse_lines(out) or out or err)[-_TAIL_CHARS:]
                if timed_out:
                    run.error = f"子进程超时({timeout}s)被终止"
                elif err.strip():
                    run.error = err.strip()[-2000:]
                run.ok = (code == 0) and not timed_out
            except Exception as exc:  # noqa: BLE001 — 调度器绝不把异常抛给 lifespan
                run.error = f"{type(exc).__name__}: {exc}"
                logger.exception("[db_sync] 第 %s 轮执行异常", self._run_count)
            finally:
                self._running_mode = None
            run.finished_at = datetime.now(_CN_TZ).isoformat(timespec="seconds")
            run.duration_ms = int((asyncio.get_running_loop().time() - t0) * 1000)
            self._append(run)
        if run.ok:
            logger.info(
                "[db_sync] 第 %s 轮完成: mode=%s 耗时=%sms", self._run_count, mode, run.duration_ms
            )
        else:
            logger.warning(
                "[db_sync] 第 %s 轮未成功: mode=%s exit=%s 超时=%s 错误=%s",
                self._run_count, mode, run.exit_code, run.timed_out, run.error[:300],
            )
        return run

    def _exec(self, argv: list[str], timeout: int) -> tuple[int, str, str, bool]:
        """同步执行子进程(跑在线程池里)。Windows 下强制不弹窗。"""
        creationflags = 0
        if os.name == "nt":
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            proc = subprocess.run(  # noqa: S603 — argv 全由本模块常量 + 白名单 mode 拼成
                argv,
                cwd=str(_ROOT),
                capture_output=True,
                timeout=timeout,
                creationflags=creationflags,
            )
        except subprocess.TimeoutExpired as exc:
            out = (exc.stdout or b"").decode("utf-8", "replace")
            err = (exc.stderr or b"").decode("utf-8", "replace")
            return -1, out, err, True
        return (
            proc.returncode,
            proc.stdout.decode("utf-8", "replace"),
            proc.stderr.decode("utf-8", "replace"),
            False,
        )

    @staticmethod
    def _parse_lines(stdout: str) -> str:
        """从 stdout 里剥出人读报告(去掉机器摘要那一行)。"""
        keep = [ln for ln in stdout.splitlines() if not ln.startswith(_JSON_PREFIX)]
        return "\n".join(keep).strip()

    @staticmethod
    def _parse_summary(stdout: str) -> dict[str, Any]:
        """从 stdout 里取出机器可读摘要(带前缀那一行的 JSON 对象)。"""
        for ln in reversed(stdout.splitlines()):
            if ln.startswith(_JSON_PREFIX):
                with contextlib.suppress(json.JSONDecodeError):
                    data = json.loads(ln[len(_JSON_PREFIX):])
                    if isinstance(data, dict):
                        return cast("dict[str, Any]", data)
        return {}

    def _append(self, run: SyncRun) -> None:
        self._history.append(run)
        if len(self._history) > _HISTORY_LIMIT:
            del self._history[: len(self._history) - _HISTORY_LIMIT]

    # ------------------------------------------------------------------
    # 状态
    # ------------------------------------------------------------------
    def get_status(self) -> dict[str, Any]:
        last = self._history[-1].to_dict() if self._history else None
        return {
            "enabled": self.enabled,
            "mode": self.mode,
            "interval_minutes": self.interval_minutes,
            "startup_delay_seconds": self.startup_delay,
            "timeout_seconds": self.timeout_seconds,
            "mirror_timeout_seconds": self.mirror_timeout_seconds,
            "mirror_at": self.mirror_at or None,
            "script_path": str(self.script_path),
            "script_exists": self.script_path.exists(),
            "config_path": str(self.config_path),
            "config_exists": self.config_path.exists(),
            "idle_reason": self._skip_reason or None,
            "running": self._lock.locked(),
            "running_mode": self._running_mode,
            "run_count": self._run_count,
            "last_interval_run_at": (
                self._last_interval_run.isoformat(timespec="seconds")
                if self._last_interval_run
                else None
            ),
            "next_interval_due_at": (
                self._next_interval_due.isoformat(timespec="seconds")
                if self._next_interval_due
                else None
            ),
            "state_path": str(self.state_path),
            "last_mirror_date": self._last_mirror_date,
            "last": last,
            "history": [r.to_dict() for r in self._history[-10:]],
        }


# 模块级单例
db_sync_scheduler = DbSyncScheduler()


# =============================================================================
# API 端点
# =============================================================================
def _require_login(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return str(uid)


def _require_admin(request: Request) -> None:
    """写生产库属高影响操作:仅限 admin(roleId>=1),与 AGENTS.md §5 一致。"""
    role_id = getattr(request.state, "role_id", 0) or 0
    if int(role_id) < 1:
        raise HTTPException(status_code=403, detail="数据库同步仅限管理员操作")


@router.get("/status")
async def get_status(request: Request) -> dict[str, Any]:
    """查询调度器状态与最近若干轮结果(只读)。"""
    _require_login(request)
    return {"code": 0, "message": "ok", "data": db_sync_scheduler.get_status()}


@router.post("/trigger")
async def trigger_sync(request: Request, mode: str = "") -> dict[str, Any]:
    """手动触发一轮同步(后台执行,立即返回)。mode 省略时用 DB_SYNC_MODE。"""
    _require_login(request)
    _require_admin(request)
    picked = (mode or db_sync_scheduler.mode).strip().lower()
    if picked not in ("sync", "mirror", "drift"):
        raise HTTPException(status_code=400, detail="mode 只能是 sync / mirror / drift")
    if db_sync_scheduler.is_running:
        return {
            "code": 0,
            "message": "已有一轮在执行,本次未重复触发",
            "data": {"triggered": False, "running_mode": db_sync_scheduler.running_mode},
        }
    asyncio.get_running_loop().create_task(
        db_sync_scheduler.run_once(picked, trigger="admin"),
        name=f"db-sync-manual-{picked}",
    )
    return {
        "code": 0,
        "message": f"已触发 {picked},后台执行中",
        "data": {"triggered": True, "mode": picked},
    }


@router.get("/drift")
async def trigger_drift(request: Request) -> dict[str, Any]:
    """排入一轮只读差异体检(后台执行;结果见 /status 的 history)。"""
    _require_login(request)
    _require_admin(request)
    if db_sync_scheduler.is_running:
        return {
            "code": 0,
            "message": "已有一轮在执行,本次未重复触发",
            "data": {"triggered": False, "running_mode": db_sync_scheduler.running_mode},
        }
    asyncio.get_running_loop().create_task(
        db_sync_scheduler.run_once("drift", trigger="drift-endpoint"),
        name="db-sync-drift",
    )
    return {"code": 0, "message": "已排入差异体检,后台执行中", "data": {"triggered": True}}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
