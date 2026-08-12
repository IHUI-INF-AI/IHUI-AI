"""资讯板块每日自动刷新调度器(轻量 asyncio 实现,无外部依赖)。

设计要点:
1. 每天定时(默认 8:00 UTC+8)执行 refresh-daily + publish-recent,确保
   marketing 首页 page-7 杂志板块每天显示最新 AI 行业新闻。
2. 通过环境变量 NEWS_CRON_ENABLED 控制开关(默认 false,避免消耗 LLM tokens)。
3. 可通过 POST /api/admin/news/trigger-refresh 手动触发(不影响下次定时触发)。
4. 历史记录在内存中保留最近 30 条(LRU)。
5. 启动时延迟 60s(避免与 schema_check / DB 连接初始化争抢资源)。
6. 每 60s 轮询一次当前时间,匹配 hour:minute 后触发,同一日内不重复触发。
"""
from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Coroutine
from datetime import datetime, timezone, timedelta
from typing import Any

from app.core.db_pool import get_shared_pool
from app.core.llm_gateway import llm_gateway
from app.core.config import settings

logger = logging.getLogger(__name__)

# 默认时区:东八区(用户主要时区)
_CN_TZ = timezone(timedelta(hours=8))

# 历史记录上限(内存 LRU,超过自动 pop 最旧的一条)
_HISTORY_LIMIT = 30

# 12 个分类白名单(与 news.py _ALLOWED_CATEGORIES 一致)
_ALLOWED_CATEGORIES = {
    "AI 模型发布", "AI 学术前沿", "AI 产业动态",
    "AI 安全与治理", "科技前沿", "教育创新",
    "金融科技", "医疗健康", "机器人产业",
    "AI 艺术", "创业投资", "政策法规",
}

# LLM prompt 模板(与 news.py _PROMPT_TEMPLATE 一致)
_PROMPT_TEMPLATE = """你是 IHUI AI 平台的资讯编辑,基于你截至 {today} 的训练知识,生成 {count} 条 AI 行业"今天值得关注的重点资讯"。

要求:
1. 严格返回 JSON 数组,无 markdown 代码块,无任何前缀说明
2. 每条 4 字段:
   - title: 20-30 字,简洁有力,点出核心信息
   - summary: 50-100 字,一句话说清"为什么值得关注"
   - categoryName: 必须从以下 12 个分类中选 1 个,严格匹配字符串:
     {categories}
   - content: 200-300 字,markdown 格式(用 ## / - 等),背景 + 影响 + 趋势
3. 覆盖 4-6 个不同分类,避免全堆在 1 个分类
4. 去重:以下标题已存在,严禁重复: {existing_titles}
5. 主题真实可信,引用已发生的标志性事件(GPT-5/Claude 4/欧盟 AI Act/Sora/Atlas/AlphaFold 3 等级别)
6. 即使你对"今天"的具体事件不确定,也要基于近期行业趋势生成合理的"重点关注"主题

输出格式(直接打印,禁止任何额外文字):
[
  {{"title": "...", "summary": "...", "categoryName": "AI 模型发布", "content": "## ..."}},
  ...
]
"""


class HistoryEntry:
    """单次执行的历史记录。"""

    def __init__(
        self,
        triggered_at: str,
        status: str,
        duration_ms: int,
        error: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.triggered_at = triggered_at
        self.status = status  # "success" | "failed" | "running"
        self.duration_ms = duration_ms
        self.error = error
        self.extra = extra or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "triggered_at": self.triggered_at,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "extra": self.extra,
        }


class NewsScheduler:
    """资讯板块每日自动刷新调度器(单例)。"""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._last_run_date: str | None = None  # YYYY-MM-DD,防同日重复触发
        self._history: list[HistoryEntry] = []  # 全局历史(LRU)
        self._running: bool = False
        # 持有 create_task 引用,防止 CPython GC 回收未完成的 task
        self._pending_tasks: set[asyncio.Task[None]] = set()

    # ===== 启停 =====

    def start(self) -> None:
        """启动调度循环(NEWS_CRON_ENABLED 控制开关,默认 false)。"""
        if self._task is not None:
            return
        enabled = (
            os.environ.get("NEWS_CRON_ENABLED", "false").lower() == "true"
            or getattr(settings, "news_cron_enabled", False)
        )
        if not enabled:
            logger.info("[news_scheduler] NEWS_CRON_ENABLED=false, 不启动调度循环")
            return
        self._task = asyncio.create_task(self._loop())
        logger.info("[news_scheduler] loop started, 每天 8:00(UTC+8) 自动刷新资讯")

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

    def _spawn_task(self, coro: Coroutine[Any, Any, Any]) -> asyncio.Task[None]:
        """创建 task 并持有引用,完成后自动从集合移除。"""
        task = asyncio.create_task(coro)
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)
        return task

    # ===== 主循环 =====

    async def _loop(self) -> None:
        """主循环:启动延迟 60s,然后每 60s 轮询一次。

        每天 8:00(UTC+8) 触发一次,同一日内不重复触发。
        """
        await asyncio.sleep(60)
        while True:
            try:
                now = datetime.now(_CN_TZ)
                # 每天 8:00 执行
                if (now.hour, now.minute) == (8, 0):
                    today = now.strftime("%Y-%m-%d")
                    if self._last_run_date != today:
                        self._last_run_date = today
                        self._spawn_task(self._run_daily_refresh())
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(
                    "[news_scheduler] loop error: %s: %s", type(e).__name__, e
                )
            await asyncio.sleep(60)

    async def _run_daily_refresh(self) -> None:
        """每日刷新:生成新闻 → 批量发布。"""
        if self._running:
            logger.info("[news_scheduler] 上次刷新仍在运行,跳过本次触发")
            return
        self._running = True
        started_at = datetime.now(timezone.utc)
        entry = HistoryEntry(
            triggered_at=started_at.isoformat(),
            status="running",
            duration_ms=0,
        )
        self._append_history(entry)

        try:
            # Step 1: 生成新闻
            logger.info("[news_scheduler] 开始每日资讯刷新(refresh-daily)...")
            gen_result = await self._refresh_daily(count=6)
            logger.info(
                "[news_scheduler] 生成完成: generated=%d, inserted=%d",
                gen_result.get("generated", 0),
                gen_result.get("inserted", 0),
            )

            # Step 2: 批量发布
            logger.info("[news_scheduler] 开始批量发布(publish-recent)...")
            pub_result = await self._publish_recent(hours=24)
            logger.info(
                "[news_scheduler] 发布完成: published=%d",
                pub_result.get("published", 0),
            )

            entry.status = "success"
            entry.extra = {
                "generated": gen_result.get("generated", 0),
                "inserted": gen_result.get("inserted", 0),
                "published": pub_result.get("published", 0),
                "model": gen_result.get("model", ""),
            }
        except Exception as e:
            entry.status = "failed"
            entry.error = f"{type(e).__name__}: {e}"
            logger.warning("[news_scheduler] 每日刷新失败: %s", entry.error)
        finally:
            elapsed = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
            entry.duration_ms = elapsed
            self._running = False

    # ===== 核心逻辑(与 news.py refresh_daily + publish_recent 一致)=====

    async def _refresh_daily(self, count: int = 6) -> dict[str, Any]:
        """调 LLM 生成今日新闻,直接写入 news_articles 表(status=0 draft)。

        Args:
            count: 生成条数(默认 6,范围 1-12)

        Returns:
            包含 generated/inserted/skipped/ids/model 的报告
        """
        count = max(1, min(count, 12))
        today = datetime.now(_CN_TZ).strftime("%Y-%m-%d")
        pool = await get_shared_pool()

        async with pool.acquire() as conn:
            existing_titles = await conn.fetch(
                """
                SELECT title FROM news_articles
                WHERE created_at > now() - interval '7 days'
                ORDER BY created_at DESC
                LIMIT 50
                """
            )
            title_list = [r["title"] for r in existing_titles]
            cat_rows = await conn.fetch(
                "SELECT id, name FROM news_categories WHERE status = 1"
            )
            cat_map = {r["name"]: r["id"] for r in cat_rows}

        if not cat_map:
            return {"generated": 0, "inserted": 0, "skipped": 0, "ids": [], "error": "news_categories 表为空"}

        prompt = _PROMPT_TEMPLATE.format(
            today=today,
            count=count,
            categories=", ".join(sorted(_ALLOWED_CATEGORIES)),
            existing_titles=("\n  - " + "\n  - ".join(title_list[:30])) if title_list else "  (无)",
        )
        messages = [{"role": "user", "content": prompt}]
        model = "stepfun/step-3.5-flash"

        try:
            result = await llm_gateway.complete(messages, model=model, temperature=0.9)
        except Exception as e:
            logger.exception("[news_scheduler] LLM 调用失败")
            return {"generated": 0, "inserted": 0, "skipped": 0, "ids": [], "error": f"LLM 调用失败: {e!s}"}

        if result.get("stub"):
            logger.warning("[news_scheduler] LLM 处于 stub 模式,跳过生成")
            return {"generated": 0, "inserted": 0, "skipped": 0, "ids": [], "stub": True}

        raw_text = result.get("content", "")
        try:
            items = self._extract_json_array(raw_text)
        except ValueError as e:
            logger.error("[news_scheduler] LLM 输出无法解析: %s", raw_text[:500])
            return {"generated": 0, "inserted": 0, "skipped": 0, "ids": [], "error": f"解析失败: {e!s}"}

        inserted_ids: list[str] = []
        skipped: list[dict[str, Any]] = []
        now = datetime.now(_CN_TZ)
        async with pool.acquire() as conn:
            for item in items:
                title = (item.get("title") or "").strip()[:200]
                summary = (item.get("summary") or "").strip()[:500]
                content = (item.get("content") or "").strip() or summary
                category_name = (item.get("categoryName") or "").strip()
                if not title or not content:
                    skipped.append({"reason": "empty title/content", "item": item})
                    continue
                if category_name not in _ALLOWED_CATEGORIES:
                    category_name = "AI 产业动态"
                category_id = cat_map.get(category_name)
                if not category_id:
                    category_id = cat_map.get("AI 产业动态")

                row = await conn.fetchrow(
                    """
                    INSERT INTO news_articles
                      (category_id, title, summary, content, author_name,
                       is_published, is_pinned, view_count, sort, status,
                       published_at, created_at, updated_at)
                    VALUES
                      ($1, $2, $3, $4, $5,
                       false, false, 0, 100, 0,
                       null, $6, $6)
                    RETURNING id
                    """,
                    category_id,
                    title,
                    summary,
                    content,
                    "IHUI AI 编辑",
                    now,
                )
                if row:
                    inserted_ids.append(str(row["id"]))

        logger.info(
            "[news_scheduler] 生成 %d, 写入 %d, 跳过 %d",
            len(items), len(inserted_ids), len(skipped),
        )
        return {
            "generated": len(items),
            "inserted": len(inserted_ids),
            "skipped": len(skipped),
            "ids": inserted_ids,
            "model": result.get("model", model),
            "stub": result.get("stub", False),
        }

    async def _publish_recent(self, hours: int = 24) -> dict[str, Any]:
        """把最近 N 小时内 status=0 (draft) 的 article 批量发布。"""
        if hours < 1 or hours > 168:
            return {"published": 0, "windowHours": hours, "error": "hours 必须在 1-168 之间"}
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            affected = await conn.fetchval(
                """
                UPDATE news_articles
                SET status = 1,
                    is_published = true,
                    published_at = $1,
                    updated_at = $1
                WHERE status = 0
                  AND created_at > now() - ($2::text || ' hours')::interval
                """,
                datetime.now(_CN_TZ),
                str(hours),
            )
        return {"published": affected or 0, "windowHours": hours}

    @staticmethod
    def _extract_json_array(text: str) -> list[dict[str, Any]]:
        """从 LLM 输出中提取 JSON 数组(与 news.py _extract_json_array 一致)."""
        import json
        import re

        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass
        fence = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
        if fence:
            try:
                return json.loads(fence.group(1))
            except json.JSONDecodeError:
                pass
        for m in re.finditer(r"\[\s*\{", text):
            obj_start = m.start()
            bracket_end = text.rfind("]")
            if bracket_end > obj_start:
                try:
                    return json.loads(text[obj_start : bracket_end + 1])
                except json.JSONDecodeError:
                    pass
        bracket_start = text.find("[")
        bracket_end = text.rfind("]")
        if bracket_start != -1 and bracket_end > bracket_start:
            try:
                return json.loads(text[bracket_start : bracket_end + 1])
            except json.JSONDecodeError:
                pass
        raise ValueError(f"无法从 LLM 输出提取 JSON 数组: {text[:200]}")

    # ===== 历史记录 =====

    def _append_history(self, entry: HistoryEntry) -> None:
        """追加历史记录,超过上限自动 pop 最旧。"""
        self._history.append(entry)
        while len(self._history) > _HISTORY_LIMIT:
            self._history.pop(0)

    def list_history(self, limit: int = 30) -> list[dict[str, Any]]:
        """列出历史记录(最新在前)。"""
        items = list(reversed(self._history))
        return [h.to_dict() for h in items[:max(1, min(limit, _HISTORY_LIMIT))]]

    def get_status(self) -> dict[str, Any]:
        """获取调度器状态。"""
        return {
            "running": self._running,
            "last_run_date": self._last_run_date,
            "enabled": (
                os.environ.get("NEWS_CRON_ENABLED", "false").lower() == "true"
                or getattr(settings, "news_cron_enabled", False)
            ),
            "schedule": "每天 8:00(UTC+8)",
            "history_count": len(self._history),
        }

    async def trigger_refresh(self) -> dict[str, Any]:
        """立即触发每日刷新(不影响下次定时触发)。返回触发结果。"""
        if self._running:
            return {"ok": False, "error": "刷新任务正在运行中"}
        self._spawn_task(self._run_daily_refresh())
        return {"ok": True, "message": "资讯刷新任务已触发"}


news_scheduler = NewsScheduler()