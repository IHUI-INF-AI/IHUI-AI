# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布指标采集(publish metrics)。

对已完成发布的内容采集互动指标(阅读/点赞/评论/转发/收藏),
按快照写入 publish_metrics 表,供监测端点查询趋势。

目前实现知乎:
- 点赞: GET https://zhuanlan.zhihu.com/api/articles/<id> 的 voteup_count
- 评论: 同上 comment_count
- 阅读: 尝试 https://www.zhihu.com/api/v4/articles/<id>/stats;
        若该接口无阅读量或失败,记 0 并在 payload 注明来源缺失
- 转发/收藏: 同上接口或记 0

建表:模块首次使用时执行 CREATE TABLE IF NOT EXISTS(与 publish.py 建表模式一致)。
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.db import get_db_conn
from app.core.logging import get_logger

from .post_publish_verifier import _account_id, _all_cookies

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False


async def _ensure_metrics_table() -> None:
    conn = await get_db_conn()
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_metrics (
                id BIGSERIAL PRIMARY KEY,
                task_id TEXT,
                platform TEXT,
                content_id TEXT,
                views BIGINT DEFAULT 0,
                likes BIGINT DEFAULT 0,
                comments BIGINT DEFAULT 0,
                shares BIGINT DEFAULT 0,
                collected_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_publish_metrics_task_id ON publish_metrics(task_id)"
        )
    finally:
        await conn.close()


async def _ensure_style_check_table() -> None:
    conn = await get_db_conn()
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS publish_style_check (
                id BIGSERIAL PRIMARY KEY,
                task_id TEXT,
                platform TEXT,
                content_id TEXT,
                passed BOOLEAN,
                issues JSONB,
                content_length INTEGER DEFAULT 0,
                images_total INTEGER DEFAULT 0,
                images_loaded INTEGER DEFAULT 0,
                checked_at TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    finally:
        conn.close()


async def collect_metrics(
    task_id: str,
    platform: str,
    content_id: str,
    credentials: dict[str, Any],
    db_account_id: int | str | None = None,
) -> dict[str, Any]:
    """采集某任务某平台内容的互动指标并写入快照。

    Returns:
        {
            "task_id", "platform", "content_id",
            "views", "likes", "comments", "shares", "collected_at",
            "source": {...}  # 各字段来源/缺失说明
        }
    """
    metrics: dict[str, Any] = {
        "task_id": task_id,
        "platform": platform,
        "content_id": content_id,
        "views": 0,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "collected_at": datetime.now(UTC).isoformat(),
        "source": {},
    }

    if platform == "zhihu":
        try:
            await _collect_zhihu(task_id, content_id, credentials, metrics, db_account_id)
        except Exception as e:
            logger.exception("[metrics] zhihu collect failed content_id=%s", content_id)
            metrics["source"]["error"] = f"{type(e).__name__}: {e}"
    else:
        metrics["source"]["note"] = f"unsupported platform: {platform}"

    # 写入快照
    try:
        await _ensure_metrics_table()
        conn = await get_db_conn()
        try:
            await conn.execute(
                """
                INSERT INTO publish_metrics
                (task_id, platform, content_id, views, likes, comments, shares, collected_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                """,
                task_id, platform, content_id,
                int(metrics["views"]), int(metrics["likes"]),
                int(metrics["comments"]), int(metrics["shares"]),
            )
        finally:
            await conn.close()
    except Exception as e:
        logger.warning("[metrics] insert snapshot failed: %s: %s", type(e).__name__, e)

    return metrics


async def _collect_zhihu(
    task_id: str,
    content_id: str,
    credentials: dict[str, Any],
    metrics: dict[str, Any],
    db_account_id: int | str | None = None,
) -> None:
    if not _HAS_PLAYWRIGHT:
        metrics["source"]["error"] = "Playwright not installed"
        return

    from app.services.publish.anti_risk import create_stealth_browser_context
    from app.services.publish.anti_risk.browser_factory import close_stealth_context

    xsrf = credentials.get("_xsrf", "").strip()
    async with async_playwright() as p:
        browser, context = await create_stealth_browser_context(
            account_id=_account_id(credentials, db_account_id),
            platform="zhihu",
            playwright_instance=p,
            headless=True,
        )
        try:
            await context.add_cookies(_all_cookies(credentials))
            page = await context.new_page()
            # 建立同源登录态
            await page.goto("https://zhuanlan.zhihu.com/write", wait_until="networkidle", timeout=60000)

            # 文章元数据(voteup/comment 等)
            art = await page.evaluate(
                """async ({url, xsrf}) => {
                    try {
                        const resp = await fetch(url, {
                            method: 'GET',
                            headers: {'x-xsrftoken': xsrf},
                            credentials: 'same-origin',
                        });
                        const text = await resp.text();
                        let json = null;
                        try { json = JSON.parse(text); } catch (e) {}
                        return {status: resp.status, json};
                    } catch (e) {
                        return {status: 0, json: null, error: String(e)};
                    }
                }""",
                {
                    "url": f"https://zhuanlan.zhihu.com/api/articles/{content_id}",
                    "xsrf": xsrf,
                },
            )
            logger.info("[metrics][zhihu] articles status=%s", art.get("status"))
            j = art.get("json") or {}
            if isinstance(j, dict):
                metrics["likes"] = int(j.get("voteup_count") or j.get("like_count") or 0)
                metrics["comments"] = int(j.get("comment_count") or 0)
                metrics["source"]["likes"] = "articles.voteup_count"
                metrics["source"]["comments"] = "articles.comment_count"

            # 阅读量 / 转发 / 收藏:尝试 v4 stats
            stats = await page.evaluate(
                """async (url) => {
                    try {
                        const resp = await fetch(url, {method: 'GET', credentials: 'same-origin'});
                        const text = await resp.text();
                        let json = null;
                        try { json = JSON.parse(text); } catch (e) {}
                        return {status: resp.status, json};
                    } catch (e) {
                        return {status: 0, json: null, error: String(e)};
                    }
                }""",
                {"url": f"https://www.zhihu.com/api/v4/articles/{content_id}/stats"},
            )
            logger.info("[metrics][zhihu] v4 stats status=%s", stats.get("status"))
            sj = stats.get("json") or {}
            if isinstance(sj, dict):
                # v4 stats 常见结构: { "read_count": ..., "voteup_count": ..., ... }
                views = sj.get("read_count") or sj.get("view_count") or sj.get("views") or 0
                metrics["views"] = int(views)
                metrics["shares"] = int(
                    sj.get("share_count") or sj.get("shares") or 0
                )
                metrics["source"]["views"] = "v4/stats.read_count"
                metrics["source"]["shares"] = "v4/stats.share_count"
            else:
                metrics["source"]["views"] = "missing(v4 stats 无数据,记0)"
        finally:
            await close_stealth_context(browser, context)


async def latest_metrics(task_id: str, platform: str | None = None) -> dict[str, Any] | None:
    """读取某任务最新一条指标快照(供监测端点)。"""
    try:
        await _ensure_metrics_table()
        conn = await get_db_conn()
        try:
            if platform:
                row = await conn.fetchrow(
                    "SELECT views, likes, comments, shares, collected_at "
                    "FROM publish_metrics WHERE task_id=$1 AND platform=$2 "
                    "ORDER BY collected_at DESC LIMIT 1",
                    task_id, platform,
                )
            else:
                row = await conn.fetchrow(
                    "SELECT views, likes, comments, shares, collected_at "
                    "FROM publish_metrics WHERE task_id=$1 "
                    "ORDER BY collected_at DESC LIMIT 1",
                    task_id,
                )
        finally:
            await conn.close()
        if not row:
            return None
        return {
            "views": row["views"],
            "likes": row["likes"],
            "comments": row["comments"],
            "shares": row["shares"],
            "collected_at": row["collected_at"].isoformat() if row["collected_at"] else None,
        }
    except Exception as e:
        logger.warning("[metrics] latest_metrics failed: %s: %s", type(e).__name__, e)
        return None


async def persist_style_check(
    task_id: str,
    platform: str,
    content_id: str,
    result: dict[str, Any],
) -> None:
    """持久化一次核验结果到 publish_style_check。"""
    try:
        await _ensure_style_check_table()
        conn = await get_db_conn()
        try:
            await conn.execute(
                """
                INSERT INTO publish_style_check
                (task_id, platform, content_id, passed, issues, content_length,
                 images_total, images_loaded, checked_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
                """,
                task_id, platform, content_id,
                bool(result.get("passed")),
                __import__("json").dumps(result.get("issues") or [], ensure_ascii=False),
                int(result.get("content_length") or 0),
                int(result.get("images_total") or 0),
                int(result.get("images_loaded") or 0),
            )
        finally:
            conn.close()
    except Exception as e:
        logger.warning("[metrics] persist_style_check failed: %s: %s", type(e).__name__, e)


async def latest_style_check(task_id: str, platform: str | None = None) -> dict[str, Any] | None:
    """读取某任务最近一次核验结果。"""
    try:
        await _ensure_style_check_table()
        conn = await get_db_conn()
        try:
            if platform:
                row = await conn.fetchrow(
                    "SELECT passed, issues, content_length, images_total, images_loaded, "
                    "checked_at, platform, content_id "
                    "FROM publish_style_check WHERE task_id=$1 AND platform=$2 "
                    "ORDER BY checked_at DESC LIMIT 1",
                    task_id, platform,
                )
            else:
                row = await conn.fetchrow(
                    "SELECT passed, issues, content_length, images_total, images_loaded, "
                    "checked_at, platform, content_id "
                    "FROM publish_style_check WHERE task_id=$1 "
                    "ORDER BY checked_at DESC LIMIT 1",
                    task_id,
                )
        finally:
            conn.close()
        if not row:
            return None
        return {
            "passed": row["passed"],
            "issues": row["issues"],
            "content_length": row["content_length"],
            "images_total": row["images_total"],
            "images_loaded": row["images_loaded"],
            "checked_at": row["checked_at"].isoformat() if row["checked_at"] else None,
            "platform": row["platform"],
            "content_id": row["content_id"],
        }
    except Exception as e:
        logger.warning("[metrics] latest_style_check failed: %s: %s", type(e).__name__, e)
        return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
