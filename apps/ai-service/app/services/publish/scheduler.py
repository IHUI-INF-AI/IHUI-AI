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
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from app.core.config import settings
from app.core.logging import get_logger
from .base_adapter import BasePlatformAdapter, PublishContent, PublishResult, get_adapter
from .content_parser import enrich_content
from .credentials_crypto import decrypt
from . import notifications

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
        self._poll_task: Optional[asyncio.Task] = None
        self._running: dict[str, asyncio.Task] = {}  # task_id -> asyncio.Task
        self._user_running: dict[str, int] = {}  # user_id -> 正在执行的任务数
        self._history: list[dict[str, Any]] = []  # 内存 LRU 历史
        self._started = False
        # 持有 spawn 出的 task 引用,避免 CPython GC 回收未完成的 task
        self._pending_tasks: set[asyncio.Task] = set()

    def _spawn_task(self, coro) -> asyncio.Task:
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
            return await asyncpg.connect(dsn=dsn)
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

        # 清理
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
        except Exception:
            pass

        started = datetime.now(timezone.utc)
        try:
            result = await adapter.publish(content, credentials, platform_config)
        except Exception as e:
            result = PublishResult(
                success=False, platform=platform,
                error_message=f"{type(e).__name__}: {e}",
            )
        elapsed = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        result.duration_ms = elapsed

        # 写历史
        await self._write_history(task_id, user_id, result)

        # 进度通知
        try:
            await notifications.notify_progress(
                task_id, user_id, platform,
                "success" if result.success else "failed",
                result.error_message or "",
            )
        except Exception:
            pass

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
