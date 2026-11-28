# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布指标采集(publish metrics)。

对已完成发布的内容采集互动指标(阅读/点赞/评论/转发/收藏),
按快照写入 publish_metrics 表,供监测端点查询趋势。

已实现平台(2026-11-28 扩面):
- 知乎: 文章页 API(voteup_count/comment_count)+ v4 stats(read_count/share_count)
- B 站: 公开 API https://api.bilibili.com/x/web-interface/view?aid=/bvid=
  stat.view / stat.like / stat.reply / stat.share
- 微博: 账号登录态下同源请求 ajax/statuses/show(attitudes/comments/reposts)
其余平台暂记 0 并在 payload.source 注明 unsupported。

建表:模块首次使用时执行 CREATE TABLE IF NOT EXISTS(与 publish.py 建表模式一致)。
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.db import get_db_conn
from app.core.logging import get_logger
from app.services.publish.anti_risk.account_identity import resolve_account_id

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
        await conn.close()  # 2026-10-03 修复:原句漏 await,close 协程从未执行(连接泄漏)


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
    elif platform == "bilibili":
        try:
            await _collect_bilibili(content_id, metrics)
        except Exception as e:
            logger.exception("[metrics] bilibili collect failed content_id=%s", content_id)
            metrics["source"]["error"] = f"{type(e).__name__}: {e}"
    elif platform == "weibo":
        try:
            await _collect_weibo(task_id, content_id, credentials, metrics, db_account_id)
        except Exception as e:
            logger.exception("[metrics] weibo collect failed content_id=%s", content_id)
            metrics["source"]["error"] = f"{type(e).__name__}: {e}"
    elif platform in ("douyin", "baijiahao", "xiaohongshu"):
        try:
            await _collect_creator_dom(
                platform, task_id, content_id, credentials, metrics, db_account_id
            )
        except Exception as e:
            logger.exception("[metrics] %s collect failed content_id=%s", platform, content_id)
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


async def _collect_bilibili(content_id: str, metrics: dict[str, Any]) -> None:
    """B 站公开 API:无需登录,按 aid 或 bvid 取 stat。"""
    param = "bvid" if str(content_id).upper().startswith("BV") else "aid"
    url = f"https://api.bilibili.com/x/web-interface/view?{param}={content_id}"
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131 Safari/537.36",
                "Referer": "https://www.bilibili.com/",
            },
        )
    payload = resp.json()
    if payload.get("code") != 0 or not payload.get("data"):
        metrics["source"]["error"] = f"bilibili code={payload.get('code')} msg={payload.get('message')}"
        return
    stat = payload["data"].get("stat") or {}
    metrics["views"] = int(stat.get("view") or 0)
    metrics["likes"] = int(stat.get("like") or 0)
    metrics["comments"] = int(stat.get("reply") or 0)
    metrics["shares"] = int(stat.get("share") or 0)
    metrics["source"].update(
        views="stat.view", likes="stat.like", comments="stat.reply", shares="stat.share"
    )


async def _collect_weibo(
    task_id: str,
    content_id: str,
    credentials: dict[str, Any],
    metrics: dict[str, Any],
    db_account_id: int | str | None = None,
) -> None:
    """微博:用账号登录态在同源页内请求 ajax/statuses/show,取点赞/评论/转发。"""
    if not _HAS_PLAYWRIGHT:
        metrics["source"]["error"] = "Playwright not installed"
        return

    from app.services.publish.anti_risk import create_stealth_browser_context
    from app.services.publish.anti_risk.browser_factory import close_stealth_context

    async with async_playwright() as p:
        browser, context = await create_stealth_browser_context(
            account_id=_account_id(credentials, db_account_id),
            platform="weibo",
            playwright_instance=p,
            headless=True,
        )
        try:
            await context.add_cookies(_all_cookies(credentials))
            resp = await context.request.get(
                f"https://weibo.com/ajax/statuses/show?id={content_id}",
                headers={"accept": "application/json", "referer": "https://weibo.com/"},
                timeout=30000,
            )
            status = resp.status
            try:
                j = await resp.json()
            except Exception:
                j = None
            logger.info("[metrics][weibo] ajax status=%s", status)
            data = j.get("data") if isinstance(j, dict) and isinstance(j.get("data"), dict) else j
            if isinstance(data, dict) and data:
                metrics["likes"] = int(data.get("attitudes_count") or 0)
                metrics["comments"] = int(data.get("comments_count") or 0)
                metrics["shares"] = int(data.get("reposts_count") or 0)
                views = data.get("reads_count") or data.get("read_count") or 0
                metrics["views"] = int(views or 0)
                metrics["source"].update(
                    likes="attitudes_count",
                    comments="comments_count",
                    shares="reposts_count",
                )
                if views:
                    metrics["source"]["views"] = "reads_count"
            else:
                metrics["source"]["error"] = f"weibo ajax empty/status={status}"
        finally:
            await close_stealth_context(browser, context)


_COUNT_RE = r"([0-9]+(?:\.[0-9]+)?\s*(?:亿|万|w|k)?)"


def _parse_num(raw: str) -> int:
    m = re.search(r"([\d.]+)\s*(亿|万|w|k)?", raw or "", re.I)
    if not m:
        return 0
    unit = (m.group(2) or "").lower()
    return int(float(m.group(1)) * {"亿": 1_0000_0000, "万": 1_0000, "w": 1_0000, "k": 1_000}.get(unit, 1))


async def _load_task_title(task_id: str, platform: str) -> str:
    """任务标题:优先 publish_tasks,历史-only 的任务退回 payload.title。"""
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            """
            SELECT COALESCE(t.title, h.payload->>'title') AS title
            FROM publish_history h
            LEFT JOIN publish_tasks t ON t.task_id = h.task_id
            WHERE h.task_id = $1 AND h.platform = $2
            ORDER BY h.created_at DESC LIMIT 1
            """,
            task_id, platform,
        )
    finally:
        await conn.close()
    return str((row or {}).get("title") or "").strip()


_CREATOR_SOURCES: dict[str, dict[str, Any]] = {
    "douyin": {
        "urls": [
            "https://creator.douyin.com/creator-micro/content/manage",
        ],
        "labels": {"views": "播放", "likes": "点赞", "comments": "评论", "shares": "分享"},
    },
    "baijiahao": {
        "urls": [
            "https://baijiahao.baidu.com/builder/rc/home",
            "https://baijiahao.baidu.com/builder/rc/content",
        ],
        "labels": {
            "views": "阅读量",
            "likes": "点赞量",
            "comments": "评论量",
            "shares": "分享量",
        },
    },
    "xiaohongshu": {
        "urls": [
            "https://creator.xiaohongshu.com/new/note-manager",
            "https://creator.xiaohongshu.com/creator/home",
        ],
        "labels": {"views": "观看量", "likes": "点赞", "comments": "评论", "shares": "分享"},
    },
}


async def _collect_creator_dom(
    platform: str,
    task_id: str,
    content_id: str,
    credentials: dict[str, Any],
    metrics: dict[str, Any],
    db_account_id: int | str | None = None,
) -> None:
    """创作者后台 DOM 取数(抖音/百家号/小红书)。

    这三家没有公开阅读/播放 API,只能带账号网页登录态进创作者后台,
    用标题定位作品卡片,再解析卡片里的"播放/阅读/点赞/评论/分享"计数。
    """
    if not _HAS_PLAYWRIGHT:
        metrics["source"]["error"] = "Playwright not installed"
        return

    cfg = _CREATOR_SOURCES[platform]
    title = await _load_task_title(task_id, platform)
    if not title:
        metrics["source"]["error"] = "title not found in publish_history"
        return
    needle = title[:16]

    from app.services.publish.anti_risk import create_stealth_browser_context
    from app.services.publish.anti_risk.browser_factory import close_stealth_context

    async with async_playwright() as p:
        browser, context = await create_stealth_browser_context(
            account_id=resolve_account_id(platform, credentials, db_account_id),
            platform=platform,
            playwright_instance=p,
            headless=True,
        )
        try:
            await context.add_cookies(_all_cookies(credentials))
            page = await context.new_page()
            body = ""
            for url in cfg["urls"]:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(7000)
                body = await page.inner_text("body")
                if needle in body:
                    metrics["source"]["page"] = url
                    break
            if needle not in body:
                metrics["source"]["error"] = f"title not found in creator pages (last_url={page.url})"
                return
            idx = body.find(needle)
            window = body[idx: idx + 900]
            for field, label in cfg["labels"].items():
                m = re.search(rf"{label}\s*[：:|]?\s*{_COUNT_RE}", window)
                if m:
                    metrics[field] = _parse_num(m.group(1))
                    metrics["source"][field] = f"creator-dom:{label}"
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
            await conn.close()  # AIS-021: 原句漏 await,close 协程从未执行(连接泄漏)
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
            await conn.close()  # AIS-021: 原句漏 await,close 协程从未执行(连接泄漏)
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
