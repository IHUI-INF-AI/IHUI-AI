"""多平台发布调度器(单例)。

职责:
1. 接收发布任务(submit_task),异步并发执行多平台发布
2. 每 60s 轮询 DB,执行 scheduled_at 到期的定时任务
3. 同用户最多 3 个并发任务(超出排队)
4. 不自动重试(由用户手动 /tasks/{id}/retry)
5. 完成后写入 publish_history 表 + 推送通知

DB 表(自动建):
- publish_tasks:  任务主表(id, user_id, content, targets, status, scheduled_at, ...)
- publish_history: 单平台执行历史(task_id, platform, success, url, error, duration_ms)
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
from datetime import datetime, timezone
from typing import Any, Coroutine, Optional

import asyncpg

from app.core.config import settings
from app.core.db import get_db_conn
from app.core.logging import get_logger
from .base_adapter import BasePlatformAdapter, PublishContent, PublishResult, get_adapter
from .content_parser import enrich_content, enrich_content_for_platform
from .credentials_crypto import decrypt
from .image_uploader import process_external_images
from .platform_rules import truncate_to_platform, validate_content
from . import notifications
# Anti-Risk 反风控(2026-07-31 强化):发布前冷却检查 + 风险评分检查,
# 发布后审计日志 + 失败关键词检测 + 自动冷却
from .anti_risk import (
    AuditLogger,
    CooldownManager,
    RiskScorer,
    RiskScore,
    cooldown_duration_for_error,
    # 深度强化层(2026-08-01 新增)
    CookieHealthMonitor,
    ContentDeduplicator,
    CaptchaSolver,
    get_deduplicator,
    get_monitor,
    get_solver,
)

logger = get_logger(__name__)

# 同用户最大并发任务数
_MAX_CONCURRENT_PER_USER = 3
# 调度器轮询间隔(秒)
_POLL_INTERVAL_SEC = 60
# 历史保留上限(内存 LRU)
_HISTORY_LIMIT = 200


class PublishScheduler:
    """多平台发布调度器(单例)。"""

    def __init__(self) -> None:
        self._poll_task: Optional[asyncio.Task[None]] = None
        self._running: dict[str, asyncio.Task[None]] = {}  # task_id -> asyncio.Task
        self._user_running: dict[str, int] = {}  # user_id -> 正在执行的任务数
        self._history: list[dict[str, Any]] = []  # 内存 LRU 历史
        self._started = False
        # 持有 spawn 出的 task 引用,避免 CPython GC 回收未完成的 task
        self._pending_tasks: set[asyncio.Task[None]] = set()

    def _spawn_task(self, coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        """创建 task 并持有引用,完成后自动从集合移除。"""
        task = asyncio.create_task(coro)
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)
        return task

    # ===== 启停 =====

    def start(self) -> None:
        """启动调度器(轮询定时任务)。"""
        if self._started:
            return
        self._started = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info("[publish.scheduler] started, poll interval=%ds", _POLL_INTERVAL_SEC)

    async def stop(self) -> None:
        """停止调度器。"""
        self._started = False
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        # 等待所有运行中任务完成(最多 30s)
        if self._running:
            logger.info(
                "[publish.scheduler] waiting %d running tasks to finish",
                len(self._running),
            )
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._running.values(), return_exceptions=True),
                    timeout=30,
                )
            except asyncio.TimeoutError:
                for t in self._running.values():
                    t.cancel()
        self._running.clear()
        self._user_running.clear()

    # ===== DB 连接 =====

    async def _get_conn(self) -> Optional[asyncpg.Connection]:
        dsn = getattr(settings, "database_url", None)
        if not dsn:
            return None
        try:
            return await get_db_conn()
        except Exception as e:
            logger.warning("[publish.scheduler] db connect failed: %s: %s", type(e).__name__, e)
            return None

    async def _ensure_tables(self, conn: asyncpg.Connection) -> None:
        """确保调度器所需表存在(idempotent)。"""
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_tasks (
                id BIGSERIAL PRIMARY KEY,
                task_id VARCHAR(64) UNIQUE NOT NULL,
                user_id VARCHAR(64),
                title VARCHAR(500) NOT NULL,
                format VARCHAR(32) NOT NULL,
                content JSONB NOT NULL,
                targets JSONB NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                scheduled_at TIMESTAMPTZ,
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                results JSONB,
                error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_history (
                id BIGSERIAL PRIMARY KEY,
                task_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64),
                platform VARCHAR(32) NOT NULL,
                success BOOLEAN NOT NULL,
                published_url TEXT,
                platform_content_id VARCHAR(255),
                error_message TEXT,
                duration_ms INTEGER DEFAULT 0,
                payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_tasks_user_id ON publish_tasks(user_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_tasks_scheduled_at ON publish_tasks(scheduled_at) "
            "WHERE status = 'scheduled'"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_history_task_id ON publish_history(task_id)"
        )

    # ===== 轮询循环 =====

    async def _poll_loop(self) -> None:
        """主轮询循环:每 60s 检查 scheduled_at 到期的任务。"""
        # 启动延迟 30s,避免与 schema_check/DB 初始化争抢
        await asyncio.sleep(30)
        while self._started:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("[publish.scheduler] poll error: %s: %s", type(e).__name__, e)
            await asyncio.sleep(_POLL_INTERVAL_SEC)

    async def _poll_once(self) -> None:
        """单次轮询:捞起到期任务并提交执行。"""
        conn = await self._get_conn()
        if conn is None:
            return
        try:
            await self._ensure_tables(conn)
            now = datetime.now(timezone.utc)
            rows = await conn.fetch(
                """
                SELECT task_id, user_id, title, format, content, targets
                FROM publish_tasks
                WHERE status = 'scheduled' AND scheduled_at <= $1
                ORDER BY scheduled_at ASC
                LIMIT 20
                """,
                now,
            )
            for r in rows:
                task_id = r["task_id"]
                if task_id in self._running:
                    continue
                user_id = r["user_id"] or ""
                if self._user_running.get(user_id, 0) >= _MAX_CONCURRENT_PER_USER:
                    continue
                content = PublishContent(
                    format=r["format"],
                    title=r["title"],
                    text=r["content"].get("text") if isinstance(r["content"], dict) else None,
                    file_path=r["content"].get("file_path") if isinstance(r["content"], dict) else None,
                    cover_path=r["content"].get("cover_path") if isinstance(r["content"], dict) else None,
                    html=r["content"].get("html") if isinstance(r["content"], dict) else None,
                    images=r["content"].get("images", []) if isinstance(r["content"], dict) else [],
                    extra=r["content"].get("extra", {}) if isinstance(r["content"], dict) else {},
                )
                targets = r["targets"] if isinstance(r["targets"], list) else []
                # 标记为 running
                await conn.execute(
                    "UPDATE publish_tasks SET status='running', started_at=$1, updated_at=$1 WHERE task_id=$2",
                    now,
                    task_id,
                )
                self._spawn_task(self._run_task(task_id, user_id, content, targets))
        finally:
            await conn.close()

    # ===== 提交任务 =====

    async def submit_task(
        self,
        task_id: str,
        user_id: Optional[str],
        content: PublishContent,
        targets: list[dict[str, Any]],  # [{'platform': 'wordpress', 'account_id': 123, 'config': {...}}]
        scheduled_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """提交发布任务。

        scheduled_at 为空 → 立即执行
        scheduled_at 非空 → 写入 DB,等待调度器轮询触发
        """
        # 持久化到 DB
        conn = await self._get_conn()
        if conn is not None:
            try:
                await self._ensure_tables(conn)
                content_dict = {
                    "text": content.text,
                    "file_path": content.file_path,
                    "cover_path": content.cover_path,
                    "html": content.html,
                    "images": content.images,
                    "extra": content.extra,
                }
                status = "scheduled" if scheduled_at else "pending"
                await conn.execute(
                    """
                    INSERT INTO publish_tasks (task_id, user_id, title, format, content, targets, status, scheduled_at)
                    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
                    ON CONFLICT (task_id) DO UPDATE SET updated_at=NOW()
                    """,
                    task_id,
                    user_id,
                    content.title,
                    content.format,
                    json.dumps(content_dict, ensure_ascii=False),
                    json.dumps(targets, ensure_ascii=False),
                    status,
                    scheduled_at,
                )
            except Exception as e:
                logger.warning("[publish.scheduler] db persist failed: %s: %s", type(e).__name__, e)
            finally:
                await conn.close()

        if scheduled_at:
            return {"ok": True, "task_id": task_id, "status": "scheduled", "scheduled_at": scheduled_at.isoformat()}

        # 立即执行
        self._spawn_task(self._run_task(task_id, user_id, content, targets))
        return {"ok": True, "task_id": task_id, "status": "running"}

    # ===== 执行任务 =====

    async def _run_task(
        self,
        task_id: str,
        user_id: Optional[str],
        content: PublishContent,
        targets: list[dict[str, Any]],
    ) -> None:
        """执行单个发布任务(并发多平台)。"""
        user_key = user_id or "_anonymous"
        self._user_running[user_key] = self._user_running.get(user_key, 0) + 1
        self._running[task_id] = asyncio.current_task()  # type: ignore[assignment]

        try:
            # 解析内容为 HTML(若未解析)
            try:
                enrich_content(content)
            except Exception as e:
                logger.warning("[publish.scheduler] content parse failed: %s: %s", type(e).__name__, e)

            results: list[PublishResult] = []
            # 并发执行(每平台一个 task)
            coros = [self._run_single_platform(task_id, user_id, content, t) for t in targets]
            if coros:
                results = await asyncio.gather(*coros, return_exceptions=False)

            # 汇总
            success_count = sum(1 for r in results if r.success)
            total = len(results)
            if total == 0:
                status = "failed"
                summary = "无目标平台"
            elif success_count == total:
                status = "success"
                summary = f"全部 {total} 个平台发布成功"
            elif success_count > 0:
                status = "partial"
                summary = f"{success_count}/{total} 个平台发布成功"
            else:
                status = "failed"
                summary = f"全部 {total} 个平台发布失败"

            results_payload = [
                {
                    "platform": r.platform,
                    "success": r.success,
                    "published_url": r.published_url,
                    "platform_content_id": r.platform_content_id,
                    "error_message": r.error_message,
                    "duration_ms": r.duration_ms,
                }
                for r in results
            ]

            # 更新 DB
            await self._finish_task_db(task_id, status, results_payload, summary)

            # 推送通知
            try:
                await notifications.notify_publish_complete(
                    task_id=task_id,
                    user_id=user_id,
                    status=status,
                    summary=summary,
                    payload={"results": results_payload},
                )
            except Exception as e:
                logger.warning("[publish.scheduler] notify failed: %s: %s", type(e).__name__, e)

            # 内存历史
            self._append_history({
                "task_id": task_id,
                "user_id": user_id,
                "status": status,
                "summary": summary,
                "success_count": success_count,
                "total": total,
                "results": results_payload,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.exception("[publish.scheduler] task crashed: %s", task_id)
            await self._finish_task_db(task_id, "failed", [], f"crashed: {e}")
            raise
        finally:
            # 清理(无论成功/失败/崩溃都执行,防止计数器泄漏)
            self._user_running[user_key] = max(0, self._user_running.get(user_key, 1) - 1)
            self._running.pop(task_id, None)

    async def _run_single_platform(
        self,
        task_id: str,
        user_id: Optional[str],
        content: PublishContent,
        target: dict[str, Any],
    ) -> PublishResult:
        """执行单平台发布(含凭证解密、进度通知、历史写入)。"""
        platform = target.get("platform", "")
        account_id = target.get("account_id")
        platform_config = target.get("config", {})

        adapter = get_adapter(platform)
        if adapter is None:
            return PublishResult(
                success=False, platform=platform,
                error_message=f"adapter not found for platform: {platform}",
            )

        # 取凭证(从 publish_accounts 表解密)
        credentials = await self._load_credentials(account_id, platform)
        if credentials is None:
            return PublishResult(
                success=False, platform=platform,
                error_message=f"credentials not found for account_id={account_id}",
            )

        # 进度通知
        try:
            await notifications.notify_progress(task_id, user_id, platform, "start")
        except Exception as e:
            logger.warning("publish.scheduler 进度通知(start)失败: %s", e, exc_info=True)

        # ===== R8:发布前规则预检(字数/标签/敏感词)=====
        try:
            validation = validate_content(platform, content, platform_config)
            if not validation.valid:
                err_msg = "发布前预检失败: " + "; ".join(validation.errors)
                logger.warning("[publish.scheduler] %s validation failed: %s", platform, err_msg)
                result = PublishResult(
                    success=False, platform=platform,
                    error_message=err_msg,
                )
                await self._write_history(task_id, user_id, result)
                try:
                    await notifications.notify_progress(
                        task_id, user_id, platform, "failed", err_msg,
                    )
                except Exception as e:
                    logger.warning("publish.scheduler 进度通知(skip)失败: %s", e, exc_info=True)
                return result
            # 自动截断到平台限制(超长内容)
            content = truncate_to_platform(platform, content)
            if validation.warnings:
                logger.info(
                    "[publish.scheduler] %s validation warnings: %s",
                    platform, "; ".join(validation.warnings),
                )
        except Exception as e:
            logger.warning(
                "[publish.scheduler] %s validate_content error: %s: %s",
                platform, type(e).__name__, e,
            )

        # ===== R7 + R6:按平台做专属排版 + 图床替换(深拷贝避免污染其他平台)=====
        platform_content = copy.deepcopy(content)
        try:
            enrich_content_for_platform(platform_content, platform)
        except Exception as e:
            logger.warning(
                "[publish.scheduler] %s enrich_content_for_platform failed: %s: %s",
                platform, type(e).__name__, e,
            )
        try:
            if platform_content.html:
                platform_content.html = await process_external_images(
                    platform_content.html, platform, credentials,
                )
        except Exception as e:
            logger.warning(
                "[publish.scheduler] %s process_external_images failed: %s: %s",
                platform, type(e).__name__, e,
            )

        # ===== Anti-Risk:内容差异化(2026-08-01 深度强化)=====
        # 同内容多平台发布会被识别为机器操作,用 SimHash + 同义词改写做差异化
        account_id_str = str(account_id) if account_id is not None else ""
        if account_id_str:
            try:
                deduplicator = get_deduplicator()
                platform_content = deduplicator.diversify_for_platform(
                    platform_content, platform, account_id_str,
                )
            except Exception as e:
                logger.warning(
                    "[publish.scheduler] %s content diversify failed: %s: %s",
                    platform, type(e).__name__, e,
                )

        # ===== Anti-Risk:发布前冷却检查 + 风险评分检查(2026-07-31 强化)=====
        # 检查账号是否在冷却中(平台风控触发后自动冷却)
        # 检查账号风险评分(高频/高失败率/指纹变化等 → 强制冷却)
        risk_score: Optional[RiskScore] = None
        if account_id_str and platform:
            try:
                cooldown_mgr = CooldownManager.get_instance()
                in_cooldown, cooldown_state = cooldown_mgr.is_in_cooldown(
                    account_id_str, platform,
                )
                if in_cooldown and cooldown_state is not None:
                    remaining = cooldown_mgr.get_remaining_time(
                        account_id_str, platform,
                    )
                    err_msg = (
                        f"账号冷却中(原因: {cooldown_state.reason}),"
                        f"剩余 {remaining}s"
                    )
                    logger.warning(
                        "[publish.scheduler] %s account %s in cooldown: %s",
                        platform, account_id_str, cooldown_state.reason,
                    )
                    result = PublishResult(
                        success=False, platform=platform,
                        error_message=err_msg,
                    )
                    await self._write_history(task_id, user_id, result)
                    try:
                        await notifications.notify_progress(
                            task_id, user_id, platform, "failed", err_msg,
                        )
                    except Exception as e:
                        logger.warning(
                            "publish.scheduler 进度通知(cooldown)失败: %s",
                            e, exc_info=True,
                        )
                    return result

                scorer = RiskScorer.get_instance()
                safe, risk_score = scorer.is_account_safe_to_publish(
                    account_id_str, platform,
                )
                if not safe:
                    cooldown_mgr.enter_cooldown(
                        account_id_str, platform, 3600,
                        f"风险评分过高: {risk_score.score}",
                    )
                    err_msg = (
                        f"账号风险评分过高({risk_score.score}/100),"
                        f"已进入 1 小时冷却。"
                        f"风险因素: {'; '.join(risk_score.factors)}"
                    )
                    logger.warning(
                        "[publish.scheduler] %s account %s risk too high: %d",
                        platform, account_id_str, risk_score.score,
                    )
                    result = PublishResult(
                        success=False, platform=platform,
                        error_message=err_msg,
                    )
                    await self._write_history(task_id, user_id, result)
                    try:
                        await notifications.notify_progress(
                            task_id, user_id, platform, "failed", err_msg,
                        )
                    except Exception as e:
                        logger.warning(
                            "publish.scheduler 进度通知(risk)失败: %s",
                            e, exc_info=True,
                        )
                    return result
            except Exception as e:
                logger.warning(
                    "[publish.scheduler] %s anti_risk pre-check error: %s: %s",
                    platform, type(e).__name__, e,
                )

        # ===== Anti-Risk:Cookie 健康度检查(2026-08-01 深度强化)=====
        # 发布前检查 Cookie 是否过期/即将过期,避免发布时才发现失效
        if account_id_str and platform:
            try:
                cookie_monitor = get_monitor()
                cookie_health = await cookie_monitor.check_cookie_health(
                    account_id_str, platform, credentials,
                )
                if cookie_health.status in ("expired", "invalid"):
                    err_msg = "Cookie 已过期或无效,请重新登录"
                    logger.warning(
                        "[publish.scheduler] %s account %s cookie %s",
                        platform, account_id_str, cookie_health.status,
                    )
                    result = PublishResult(
                        success=False, platform=platform,
                        error_message=err_msg,
                    )
                    await self._write_history(task_id, user_id, result)
                    try:
                        await notifications.notify_progress(
                            task_id, user_id, platform, "failed", err_msg,
                        )
                    except Exception as e:
                        logger.warning(
                            "publish.scheduler 进度通知(cookie)失败: %s",
                            e, exc_info=True,
                        )
                    return result
                if cookie_health.status == "expiring_soon":
                    # 即将过期:记录但不阻塞(适配器发布时会自动续期)
                    logger.info(
                        "[publish.scheduler] %s account %s cookie 即将过期(剩余 %d 天)",
                        platform, account_id_str, cookie_health.days_until_expiry,
                    )
            except Exception as e:
                logger.warning(
                    "[publish.scheduler] %s cookie health check error: %s: %s",
                    platform, type(e).__name__, e,
                )

        started = datetime.now(timezone.utc)
        try:
            result = await adapter.publish(platform_content, credentials, platform_config)
        except Exception as e:
            result = PublishResult(
                success=False, platform=platform,
                error_message=f"{type(e).__name__}: {e}",
            )
        elapsed = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        result.duration_ms = elapsed

        # ===== Anti-Risk:验证码失败重试(2026-08-01 深度强化)=====
        # 发布失败且错误含验证码关键词时,记录验证码事件(供适配器后续处理)
        # 注意:scheduler 无 Page 访问权限,实际验证码解决需适配器集成 CaptchaSolver
        if not result.success and account_id_str:
            error_msg = result.error_message or ""
            captcha_keywords = ("验证", "captcha", "slider", "滑块", "人机")
            if any(kw in error_msg.lower() or kw in error_msg for kw in captcha_keywords):
                logger.info(
                    "[publish.scheduler] %s account %s 发布遇到验证码,记录事件",
                    platform, account_id_str,
                )
                try:
                    solver = get_solver()
                    # 记录验证码事件到风险评分(提高该账号风险等级)
                    scorer = RiskScorer.get_instance()
                    scorer.record_risk_event(
                        account_id_str, platform, "platform_risk_trigger",
                        {"error": error_msg, "captcha_detected": True},
                    )
                    # 若配置了第三方打码服务,记录可用性(适配器可读取此标志)
                    if solver._provider != "none":
                        logger.info(
                            "[publish.scheduler] %s 第三方打码服务已配置(%s),"
                            "适配器可集成 CaptchaSolver 自动处理",
                            platform, solver._provider,
                        )
                except Exception as e:
                    logger.warning(
                        "[publish.scheduler] %s captcha event record failed: %s",
                        platform, e,
                    )

        # ===== Anti-Risk:发布后审计 + 风险事件记录 + 失败关键词检测(2026-07-31 强化)=====
        # 成功:记录 publish_success 事件(风险评分衰减)
        # 失败:检查错误信息是否含风控关键词 → 自动冷却 + 记录 platform_risk_trigger
        #       非风控失败 → 记录 publish_failed + 累计连续失败次数(达 3 次自动冷却)
        if account_id_str and platform:
            try:
                audit = AuditLogger.get_instance()
                score_val = risk_score.score if risk_score is not None else 0
                audit.log_publish_attempt(
                    account_id_str, platform, result.success, score_val,
                    result.duration_ms,
                    {
                        "published_url": result.published_url,
                        "error_message": result.error_message,
                        "task_id": task_id,
                    },
                )

                scorer = RiskScorer.get_instance()
                cooldown_mgr = CooldownManager.get_instance()
                if result.success:
                    scorer.record_risk_event(
                        account_id_str, platform, "publish_success",
                        {"url": result.published_url},
                    )
                    cooldown_mgr.record_success(account_id_str, platform)
                else:
                    error_msg = result.error_message or ""
                    if RiskScorer.is_platform_risk_error(error_msg):
                        # 平台风控触发:按错误关键词严重度冷却
                        duration, reason = cooldown_duration_for_error(error_msg)
                        if duration > 0:
                            cooldown_mgr.enter_cooldown(
                                account_id_str, platform, duration, reason,
                            )
                            audit.log_cooldown_event(
                                account_id_str, platform, "enter",
                                reason, duration,
                            )
                        scorer.record_risk_event(
                            account_id_str, platform, "platform_risk_trigger",
                            {"error": error_msg},
                        )
                    else:
                        # 普通失败:记录 + 累计连续失败(达 3 次自动冷却 1h)
                        scorer.record_risk_event(
                            account_id_str, platform, "publish_failed",
                            {"error": error_msg},
                        )
                        cd_state = cooldown_mgr.record_failure(
                            account_id_str, platform,
                        )
                        if cd_state is not None:
                            audit.log_cooldown_event(
                                account_id_str, platform, "enter",
                                cd_state.reason, 3600,
                            )
            except Exception as e:
                logger.warning(
                    "[publish.scheduler] %s anti_risk post-check error: %s: %s",
                    platform, type(e).__name__, e,
                )

        # 写历史
        await self._write_history(task_id, user_id, result)

        # 进度通知
        try:
            await notifications.notify_progress(
                task_id, user_id, platform,
                "success" if result.success else "failed",
                result.error_message or "",
            )
        except Exception as e:
            logger.warning("publish.scheduler 进度通知(end)失败: %s", e, exc_info=True)

        return result

    async def _load_credentials(self, account_id: Optional[int], platform: str) -> Optional[dict[str, Any]]:
        """从 publish_accounts 表加载并解密凭证。"""
        if account_id is None:
            return None
        conn = await self._get_conn()
        if conn is None:
            return None
        try:
            row = await conn.fetchrow(
                "SELECT credentials_enc FROM publish_accounts WHERE id=$1 AND platform=$2",
                account_id,
                platform,
            )
            if not row:
                return None
            cipher = row["credentials_enc"]
            if not cipher:
                return None
            return decrypt(cipher)
        except Exception as e:
            logger.warning(
                "[publish.scheduler] load credentials failed: %s: %s", type(e).__name__, e
            )
            return None
        finally:
            await conn.close()

    async def _write_history(
        self, task_id: str, user_id: Optional[str], result: PublishResult
    ) -> None:
        """写入 publish_history 表。"""
        conn = await self._get_conn()
        if conn is None:
            return
        try:
            await self._ensure_tables(conn)
            await conn.execute(
                """
                INSERT INTO publish_history
                (task_id, user_id, platform, success, published_url, platform_content_id,
                 error_message, duration_ms, payload)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                """,
                task_id,
                user_id,
                result.platform,
                result.success,
                result.published_url,
                result.platform_content_id,
                result.error_message,
                result.duration_ms,
                json.dumps(result.payload or {}, ensure_ascii=False),
            )
        except Exception as e:
            logger.warning("[publish.scheduler] write history failed: %s: %s", type(e).__name__, e)
        finally:
            await conn.close()

    async def _finish_task_db(
        self, task_id: str, status: str, results: list[dict[str, Any]], summary: str
    ) -> None:
        """更新任务状态为已完成。"""
        conn = await self._get_conn()
        if conn is None:
            return
        try:
            await conn.execute(
                """
                UPDATE publish_tasks
                SET status=$1, results=$2::jsonb, finished_at=NOW(), updated_at=NOW(),
                    error=CASE WHEN $1='failed' THEN $3 ELSE error END
                WHERE task_id=$4
                """,
                status,
                json.dumps(results, ensure_ascii=False),
                summary,
                task_id,
            )
        except Exception as e:
            logger.warning("[publish.scheduler] finish task db failed: %s: %s", type(e).__name__, e)
        finally:
            await conn.close()

    def _append_history(self, entry: dict[str, Any]) -> None:
        """追加内存历史(LRU)。"""
        self._history.append(entry)
        while len(self._history) > _HISTORY_LIMIT:
            self._history.pop(0)

    # ===== 公开 API =====

    def list_running(self) -> list[str]:
        """列出正在执行的 task_id。"""
        return list(self._running.keys())

    def list_history(self, limit: int = 50) -> list[dict[str, Any]]:
        """列出最近 N 条历史(内存,倒序)。"""
        return list(reversed(self._history))[:max(1, min(limit, _HISTORY_LIMIT))]

    async def cancel_task(self, task_id: str) -> bool:
        """取消任务(只能取消正在执行的)。"""
        task = self._running.get(task_id)
        if task is None:
            return False
        task.cancel()
        return True

    async def retry_platforms(
        self, task_id: str, platforms: Optional[list[str]] = None
    ) -> dict[str, Any]:
        """重试失败的平台。

        platforms 为空 → 重试该任务所有失败平台
        platforms 非空 → 仅重试指定平台
        """
        conn = await self._get_conn()
        if conn is None:
            return {"ok": False, "error": "db unavailable"}
        try:
            row = await conn.fetchrow(
                "SELECT user_id, title, format, content, targets, results FROM publish_tasks WHERE task_id=$1",
                task_id,
            )
            if not row:
                return {"ok": False, "error": f"task not found: {task_id}"}
            results = row["results"] if isinstance(row["results"], list) else []
            failed_platforms = {
                r["platform"] for r in results if not r.get("success")
            }
            target_platforms = set(platforms) if platforms else failed_platforms
            new_targets = [
                t for t in (row["targets"] if isinstance(row["targets"], list) else [])
                if t.get("platform") in target_platforms
            ]
            if not new_targets:
                return {"ok": False, "error": "no targets to retry"}

            content = PublishContent(
                format=row["format"],
                title=row["title"],
                text=row["content"].get("text") if isinstance(row["content"], dict) else None,
                file_path=row["content"].get("file_path") if isinstance(row["content"], dict) else None,
                cover_path=row["content"].get("cover_path") if isinstance(row["content"], dict) else None,
                html=row["content"].get("html") if isinstance(row["content"], dict) else None,
                images=row["content"].get("images", []) if isinstance(row["content"], dict) else [],
            )
            retry_task_id = f"{task_id}-retry-{int(datetime.now(timezone.utc).timestamp())}"
            self._spawn_task(self._run_task(row["user_id"] or "", retry_task_id, content, new_targets))
            return {"ok": True, "retry_task_id": retry_task_id, "targets": len(new_targets)}
        except Exception as e:
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}
        finally:
            await conn.close()


# 单例
publish_scheduler = PublishScheduler()
