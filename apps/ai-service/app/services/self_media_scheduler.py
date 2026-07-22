"""自媒体定时任务调度器(轻量 asyncio 实现,无外部依赖)。

设计要点:
1. 内置任务注册表,每个任务声明 id/name/category/cron 默认值/dry_run/enabled。
2. 通过环境变量初始化默认配置,运行时可通过 set_task_enabled/set_task_config 动态修改。
3. 历史记录在内存中保留最近 30 条(LRU),供前端自动化页面查看。
4. 支持手动 trigger_task 立即执行(不影响下次定时触发)。
5. 启动时延迟 60s(避免与 schema_check / DB 连接初始化争抢资源)。
6. 每 60s 轮询一次当前时间,匹配 hour:minute 后触发,同一日内不重复触发。
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Literal, TypedDict

logger = logging.getLogger(__name__)

# 默认时区:东八区(用户主要时区)
_CN_TZ = timezone(timedelta(hours=8))

# 历史记录上限(内存 LRU,超过自动 pop 最旧的一条)
_HISTORY_LIMIT = 30


class TaskConfig(TypedDict, total=False):
    """单个任务的运行时配置(可被 set_task_config 修改)。"""

    hour: int
    minute: int
    dry_run: bool
    enabled: bool
    # 可选:任务专属参数(如 wechat_daily 的 title 模板)
    title_template: str


class TaskDef(TypedDict):
    """任务静态定义(注册时声明,运行时只读)。"""

    id: str
    name: str
    description: str
    category: Literal["wechat", "koubo"]
    default_hour: int
    default_minute: int


class HistoryEntry(TypedDict):
    """单次执行的历史记录。"""

    task_id: str
    triggered_at: str  # ISO8601 UTC
    status: Literal["success", "failed", "running"]
    duration_ms: int
    error: str | None
    extra: dict[str, Any]


# ===== 任务注册表(内置 2 个任务)=====
TASK_DEFS: list[TaskDef] = [
    {
        "id": "koubo_daily",
        "name": "每日口播稿生成",
        "description": "每天定时生成 8 篇抖音口播稿 + 双门禁验证(默认 dry-run,不自动推送草稿箱)",
        "category": "koubo",
        "default_hour": 8,
        "default_minute": 0,
    },
    {
        "id": "wechat_daily",
        "name": "每日公众号文章生成",
        "description": "每天定时用 LLM 生成公众号文章 md(需要配置 title 模板,否则跳过)",
        "category": "wechat",
        "default_hour": 8,
        "default_minute": 30,
    },
]


class SelfMediaScheduler:
    """自媒体定时任务调度器(单例)。"""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._last_run_date: dict[str, str] = {}  # task_id -> YYYY-MM-DD,防同日重复触发
        self._configs: dict[str, TaskConfig] = {}  # task_id -> 运行时配置
        self._history: list[HistoryEntry] = []  # 全局历史(LRU)
        self._running_tasks: set[str] = set()  # 正在执行的 task_id 集合
        # 持有 create_task 引用,防止 CPython GC 回收未完成的 task
        self._pending_tasks: set[asyncio.Task] = set()
        self._init_configs()

    def _spawn_task(self, coro) -> asyncio.Task:
        """创建 task 并持有引用,完成后自动从集合移除。"""
        task = asyncio.create_task(coro)
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)
        return task

    def _init_configs(self) -> None:
        """从环境变量初始化任务配置。"""
        global_enabled = os.environ.get("SELF_MEDIA_CRON_ENABLED", "false").lower() == "true"
        default_hour = _safe_int(os.environ.get("SELF_MEDIA_CRON_HOUR"), 8)
        default_minute = _safe_int(os.environ.get("SELF_MEDIA_CRON_MINUTE"), 0)
        wechat_title_tpl = os.environ.get("SELF_MEDIA_CRON_WECHAT_TITLE", "")

        for tdef in TASK_DEFS:
            cfg: TaskConfig = {
                "hour": default_hour if tdef["id"] == "koubo_daily" else (default_hour if tdef["id"] == "wechat_daily" else tdef["default_hour"]),
                "minute": default_minute if tdef["id"] == "koubo_daily" else (default_minute + 30 if tdef["id"] == "wechat_daily" and default_minute + 30 < 60 else tdef["default_minute"]),
                "dry_run": True,  # 定时任务默认 dry-run,真推由人工触发
                "enabled": global_enabled,
            }
            if tdef["id"] == "wechat_daily" and wechat_title_tpl:
                cfg["title_template"] = wechat_title_tpl
            self._configs[tdef["id"]] = cfg

    # ===== 启停 =====

    def start(self) -> None:
        """启动调度循环(无论任何 task 是否 enabled,loop 都跑,内部按 enabled 判断)。"""
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._loop())
        enabled_count = sum(1 for c in self._configs.values() if c.get("enabled"))
        logger.info(
            "[self_media_scheduler] loop started, %d/%d tasks enabled",
            enabled_count,
            len(self._configs),
        )

    async def stop(self) -> None:
        """停止调度循环。"""
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    # ===== 主循环 =====

    async def _loop(self) -> None:
        """主循环:启动延迟 60s,然后每 60s 轮询一次。"""
        await asyncio.sleep(60)
        while True:
            try:
                now = datetime.now(_CN_TZ)
                for tdef in TASK_DEFS:
                    cfg = self._configs.get(tdef["id"], {})
                    if not cfg.get("enabled"):
                        continue
                    hour = cfg.get("hour", tdef["default_hour"])
                    minute = cfg.get("minute", tdef["default_minute"])
                    if (now.hour, now.minute) == (hour, minute):
                        today = now.strftime("%Y-%m-%d")
                        if self._last_run_date.get(tdef["id"]) != today:
                            self._last_run_date[tdef["id"]] = today
                            # 异步触发,不阻塞 loop
                            self._spawn_task(self._run_task_safe(tdef["id"]))
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(
                    "[self_media_scheduler] loop error: %s: %s", type(e).__name__, e
                )
            await asyncio.sleep(60)

    async def _run_task_safe(self, task_id: str) -> None:
        """安全执行任务(异常只记录,不向上抛)。"""
        try:
            await self._run_task(task_id)
        except Exception as e:
            logger.warning(
                "[self_media_scheduler] task %s unexpected error: %s: %s",
                task_id,
                type(e).__name__,
                e,
            )

    async def _run_task(self, task_id: str) -> None:
        """实际执行单个任务。"""
        if task_id in self._running_tasks:
            logger.info("[self_media_scheduler] task %s already running, skip", task_id)
            return
        self._running_tasks.add(task_id)
        cfg = self._configs.get(task_id, {})
        started_at = datetime.now(timezone.utc)
        entry: HistoryEntry = {
            "task_id": task_id,
            "triggered_at": started_at.isoformat(),
            "status": "running",
            "duration_ms": 0,
            "error": None,
            "extra": {},
        }
        self._append_history(entry)

        try:
            extra: dict[str, Any] = {}
            if task_id == "koubo_daily":
                extra = await self._run_koubo(cfg.get("dry_run", True))
            elif task_id == "wechat_daily":
                title_tpl = cfg.get("title_template", "")
                if not title_tpl:
                    raise RuntimeError(
                        "wechat_daily 未配置 title_template(SKIP): "
                        "请通过 POST /automation/tasks/wechat_daily/config 设置 title_template"
                    )
                extra = await self._run_wechat(title_tpl, cfg.get("dry_run", True))
            else:
                raise ValueError(f"unknown task: {task_id}")

            entry["status"] = "success"
            entry["extra"] = extra
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"
            logger.warning(
                "[self_media_scheduler] task %s failed: %s", task_id, entry["error"]
            )
        finally:
            elapsed = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
            entry["duration_ms"] = elapsed
            self._running_tasks.discard(task_id)

    async def _run_koubo(self, dry_run: bool) -> dict[str, Any]:
        """执行口播稿生成。"""
        from app.services.koubo_workflow import koubo_workflow_service

        now = datetime.now(_CN_TZ)
        date_mmdd = now.strftime("%m%d")
        final_state = await koubo_workflow_service.run(
            date=date_mmdd,
            topic="",
            model=None,
            owner_uuid=None,
            dry_run=dry_run,
        )
        return {
            "date": date_mmdd,
            "status": final_state.get("status"),
            "articles_count": len(final_state.get("articles", [])),
            "output_path": final_state.get("output_path"),
            "error": final_state.get("error"),
        }

    async def _run_wechat(self, title_template: str, dry_run: bool) -> dict[str, Any]:
        """执行公众号文章生成。"""
        from app.routers.self_media import _generate_md_with_llm, _safe_filename
        from pathlib import Path

        now = datetime.now(_CN_TZ)
        date_mmdd = now.strftime("%m%d")
        title = title_template.replace("{date}", date_mmdd)
        ok, md_content, err_msg = await _generate_md_with_llm(
            title=title,
            digest="",
            topic="",
            model=None,
            owner_uuid=None,
        )
        if not ok or not md_content:
            raise RuntimeError(f"LLM 生成失败: {err_msg}")
        articles_dir = Path(__file__).resolve().parent.parent / "skills" / "content_engine" / "articles"
        articles_dir.mkdir(parents=True, exist_ok=True)
        md_path = articles_dir / f"{_safe_filename(title)}.md"
        md_path.write_text(md_content, encoding="utf-8")
        return {
            "title": title,
            "md_path": str(md_path),
            "md_length": len(md_content),
            "dry_run": dry_run,
        }

    def _append_history(self, entry: HistoryEntry) -> None:
        """追加历史记录,超过上限自动 pop 最旧。"""
        self._history.append(entry)
        while len(self._history) > _HISTORY_LIMIT:
            self._history.pop(0)

    # ===== 公开 API(供 router 调用)=====

    def list_tasks(self) -> list[dict[str, Any]]:
        """列出所有任务(含运行时配置 + 最后执行信息)。"""
        result: list[dict[str, Any]] = []
        for tdef in TASK_DEFS:
            cfg = self._configs.get(tdef["id"], {})
            # 找出该任务最近一次历史
            last_entry: HistoryEntry | None = None
            for h in reversed(self._history):
                if h["task_id"] == tdef["id"]:
                    last_entry = h
                    break
            result.append({
                "id": tdef["id"],
                "name": tdef["name"],
                "description": tdef["description"],
                "category": tdef["category"],
                "default_hour": tdef["default_hour"],
                "default_minute": tdef["default_minute"],
                "config": {
                    "hour": cfg.get("hour", tdef["default_hour"]),
                    "minute": cfg.get("minute", tdef["default_minute"]),
                    "dry_run": cfg.get("dry_run", True),
                    "enabled": cfg.get("enabled", False),
                    "title_template": cfg.get("title_template", ""),
                },
                "running": tdef["id"] in self._running_tasks,
                "last_run": last_entry,
            })
        return result

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """获取单个任务详情。"""
        for t in self.list_tasks():
            if t["id"] == task_id:
                return t
        return None

    def set_task_enabled(self, task_id: str, enabled: bool) -> bool:
        """启用/禁用任务,返回是否成功。"""
        if task_id not in self._configs:
            return False
        self._configs[task_id]["enabled"] = enabled
        logger.info(
            "[self_media_scheduler] task %s %s", task_id, "enabled" if enabled else "disabled"
        )
        return True

    def set_task_config(self, task_id: str, **kwargs: Any) -> bool:
        """修改任务配置,返回是否成功。支持的 key: hour/minute/dry_run/title_template。"""
        if task_id not in self._configs:
            return False
        cfg = self._configs[task_id]
        for k in ("hour", "minute", "dry_run", "title_template"):
            if k in kwargs and kwargs[k] is not None:
                if k == "hour" and not (0 <= int(kwargs[k]) <= 23):
                    return False
                if k == "minute" and not (0 <= int(kwargs[k]) <= 59):
                    return False
                cfg[k] = kwargs[k]  # type: ignore[literal-required]
        # enabled 单独走 set_task_enabled
        if "enabled" in kwargs and kwargs["enabled"] is not None:
            cfg["enabled"] = bool(kwargs["enabled"])
        return True

    def list_history(self, task_id: str | None = None, limit: int = 30) -> list[HistoryEntry]:
        """列出历史记录(可选按 task_id 过滤)。"""
        items = self._history
        if task_id:
            items = [h for h in items if h["task_id"] == task_id]
        # 倒序(最新在前),限制条数
        return list(reversed(items))[:max(1, min(limit, _HISTORY_LIMIT))]

    async def trigger_task(self, task_id: str) -> dict[str, Any]:
        """立即触发任务(不影响下次定时触发)。返回触发结果。"""
        if task_id not in self._configs:
            return {"ok": False, "error": f"task not found: {task_id}"}
        if task_id in self._running_tasks:
            return {"ok": False, "error": f"task already running: {task_id}"}
        # 异步触发,立即返回
        self._spawn_task(self._run_task_safe(task_id))
        return {"ok": True, "message": f"task {task_id} triggered"}


def _safe_int(s: str | None, default: int) -> int:
    try:
        return int(s) if s is not None else default
    except (ValueError, TypeError):
        return default


self_media_scheduler = SelfMediaScheduler()
