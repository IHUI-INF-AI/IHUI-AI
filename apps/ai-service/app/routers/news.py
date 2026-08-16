"""L4 资讯板块自动刷新 admin 路由(2026-08-12 立)。

根因:marketing 首页 page-7 magazine 板块的 news_articles 表数据全是
2026-07-17 的 seed 数据,无"每天自动更新"机制,用户刷新后看到 25 天
前的旧数据。本任务为"每天最新"最小可用版本:

- POST /api/admin/news/refresh-daily — 调 LLM (stepfun/step-router-v1) 生成
  5-8 条 AI 行业今日新闻,直接写入 news_articles 表(状态 draft,
  admin 后续手动审稿发布;MVP 阶段不强制审核)
- GET  /api/admin/news/status     — 返回最近刷新时间 + 已生成条数
- POST /api/admin/news/publish-recent — 把最近一次刷新的 draft 批量发布

设计取舍:
1. 不爬真实新闻源(避免外网依赖 + 版权风险),改用 LLM 基于训练知识
   生成"今日 AI 行业重点关注"摘要,符合用户"每天最新资讯"诉求
2. 数据 status=0(draft),is_published=false,需要 admin 手动调 publish-recent
   发布。MVP 阶段可由前端按 createdAt desc 拉所有数据,不受 status 影响
3. 不重复生成(同主题去重):LLM 收到 prompt 含"已存在标题列表",让 LLM
   自动避让;不依赖 embedding 等复杂去重
4. 用 admin 路径保护(本任务先无鉴权,后续 P1 加 jwt_auth 中间件,
   当前与 meta_learning / health 端点保持一致风格)

后续 P1(下轮):加 cron 自动调度(每天 0 点 UTC+8)+ admin UI 按钮
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.db_pool import get_shared_pool
from app.core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/news", tags=["news-refresh"])

# 默认时区(与 self_media_scheduler 一致)
_CN_TZ = timezone(timedelta(hours=8))

# 12 个分类白名单(必须与 web TAB_CATEGORY_MAP 完全匹配,
# 否则前端 tab 过滤会找不到数据)
_ALLOWED_CATEGORIES = {
    "AI 模型发布",
    "AI 学术前沿",
    "AI 产业动态",
    "AI 安全与治理",
    "科技前沿",
    "教育创新",
    "金融科技",
    "医疗健康",
    "机器人产业",
    "AI 艺术",
    "创业投资",
    "政策法规",
}

# LLM prompt 模板:让模型返回结构化 JSON 数组
# 1) 严格 JSON,无 markdown 代码块
# 2) 每个对象 4 字段:title (≤ 30 字) / summary (≤ 100 字) /
#    categoryName (从 _ALLOWED_CATEGORIES 选 1 个) / content (≤ 300 字,markdown)
# 3) 收到"已存在标题"列表时主动避让重复
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


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    """从 LLM 输出中提取 JSON 数组。

    LLM 偶尔会包 ```json ... ``` 代码块或在前面加推理/思考过程,
    用多级回退策略剥掉外层 fence 拿到纯 JSON 字符串。
    """
    from typing import cast

    # 1) 尝试直接 parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return cast(list[dict[str, Any]], result)
    except json.JSONDecodeError:
        pass
    # 2) 找 ```json ... ``` 代码块
    fence = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fence:
        try:
            return cast(list[dict[str, Any]], json.loads(fence.group(1)))
        except json.JSONDecodeError:
            pass
    # 3) 找第一个 [{ 到最后一个 ] — 真正的 JSON 数组起始(跳过 [Advisor 等推理前缀)
    for m in re.finditer(r"\[\s*\{", text):
        obj_start = m.start()
        bracket_end = text.rfind("]")
        if bracket_end > obj_start:
            try:
                return cast(list[dict[str, Any]], json.loads(text[obj_start : bracket_end + 1]))
            except json.JSONDecodeError:
                pass
    # 4) 兜底:第一个 [ 到最后一个 ]
    bracket_start = text.find("[")
    bracket_end = text.rfind("]")
    if bracket_start != -1 and bracket_end > bracket_start:
        try:
            return cast(list[dict[str, Any]], json.loads(text[bracket_start : bracket_end + 1]))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"无法从 LLM 输出提取 JSON 数组: {text[:200]}")


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """返回最近一次 refresh-daily 触发的统计。

    计算"最近 24h 新生成的 draft"条数 + "今天已发布"条数,供 admin
    看板显示"今日已生成 X 条 / 已发布 Y 条"。
    """
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        # 24h 内 created 的 draft(LLM 刚生成但未发布)
        draft_count = await conn.fetchval(
            """
            SELECT count(*) FROM news_articles
            WHERE status = 0
              AND created_at > now() - interval '24 hours'
            """
        )
        # 24h 内 published
        published_count = await conn.fetchval(
            """
            SELECT count(*) FROM news_articles
            WHERE status = 1
              AND published_at > now() - interval '24 hours'
            """
        )
        # 最近一次生成时间
        last_generated = await conn.fetchval(
            """
            SELECT max(created_at) FROM news_articles
            WHERE created_at > now() - interval '7 days'
            """
        )
    return {
        "lastGeneratedAt": last_generated.isoformat() if last_generated else None,
        "draftLast24h": draft_count,
        "publishedLast24h": published_count,
        "allowedCategories": sorted(_ALLOWED_CATEGORIES),
        "defaultModel": settings.litellm_model,
    }


@router.post("/refresh-daily")
async def refresh_daily(count: int = 6) -> dict[str, Any]:
    """调 LLM 生成今日新闻,直接写入 news_articles 表(status=0 draft)。

    Args:
        count: 生成条数(默认 6,范围 1-12,超出截断到 12 防 LLM 失控)

    Returns:
        包含 generated/inserted/skipped/ids/model 的报告
    """
    if count < 1 or count > 12:
        raise HTTPException(status_code=400, detail="count 必须在 1-12 之间")

    today = datetime.now(_CN_TZ).strftime("%Y-%m-%d")
    pool = await get_shared_pool()

    # 1) 查最近 7 天已存在的标题,作为去重上下文喂给 LLM
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

        # 查 categoryId 映射(把 LLM 返回的 categoryName 转成 UUID)
        cat_rows = await conn.fetch(
            "SELECT id, name FROM news_categories WHERE status = 1"
        )
        cat_map = {r["name"]: r["id"] for r in cat_rows}

    if not cat_map:
        raise HTTPException(status_code=500, detail="news_categories 表为空")

    # 2) 调 LLM 生成
    prompt = _PROMPT_TEMPLATE.format(
        today=today,
        count=count,
        categories=", ".join(sorted(_ALLOWED_CATEGORIES)),
        existing_titles=("\n  - " + "\n  - ".join(title_list[:30])) if title_list else "  (无)",
    )
    messages = [{"role": "user", "content": prompt}]

    # 用 step-3.5-flash 而非 step-router-v1(router 模型超时 30s,flash 模型 10s 内返回)
    model = "stepfun/step-3.5-flash"
    logger.info("[news-refresh] 调用 LLM 生成 %d 条今日资讯, model=%s", count, model)
    try:
        result = await llm_gateway.complete(messages, model=model, temperature=0.9)
    except Exception as e:
        logger.exception("[news-refresh] LLM 调用失败")
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e!s}") from e

    if result.get("stub"):
        raise HTTPException(
            status_code=503,
            detail="LLM 处于 stub 模式(无 API key),无法生成实际内容",
        )

    raw_text = result.get("content", "")
    try:
        items = _extract_json_array(raw_text)
    except ValueError as e:
        logger.error("[news-refresh] LLM 输出无法解析: %s", raw_text[:500])
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e!s}") from e

    # 3) 校验 + 写库
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
                # 兜底:未识别的 category 落到"AI 产业动态"避免数据孤岛
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
        "[news-refresh] 生成 %d, 写入 %d, 跳过 %d",
        len(items),
        len(inserted_ids),
        len(skipped),
    )
    return {
        "generated": len(items),
        "inserted": len(inserted_ids),
        "skipped": len(skipped),
        "ids": inserted_ids,
        "model": result.get("model", model),
        "stub": result.get("stub", False),
        "tokens": result.get("usage", {}).get("total_tokens"),
        "executedAt": now.isoformat(),
    }


@router.post("/publish-recent")
async def publish_recent(hours: int = 24) -> dict[str, Any]:
    """把最近 N 小时内 status=0 (draft) 的 article 批量发布。

    Args:
        hours: 时间窗口(默认 24h,范围 1-168)
    """
    if hours < 1 or hours > 168:
        raise HTTPException(status_code=400, detail="hours 必须在 1-168 之间")
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
              AND created_at > now() - ($2 || ' hours')::interval
            RETURNING (SELECT count(*) FROM news_articles
                       WHERE status = 1
                         AND published_at > now() - ($2 || ' hours')::interval)
            """,
            datetime.now(_CN_TZ),
            str(hours),
        )
    return {"published": affected or 0, "windowHours": hours}


@router.post("/trigger-refresh")
async def trigger_refresh() -> dict[str, Any]:
    """手动触发调度器立即执行每日刷新(不影响下次定时触发)。

    由 news_scheduler 接管 refresh-daily + publish-recent 的完整流程,
    避免重复实现 LLM 调用 + JSON 解析 + 数据库写入逻辑。
    返回调度器执行结果或当前状态。
    """
    from app.services.news_scheduler import news_scheduler

    return await news_scheduler.trigger_refresh()


@router.get("/scheduler-status")
async def scheduler_status() -> dict[str, Any]:
    """返回调度器当前状态(运行中 / 上次执行日期 / 历史记录)。"""
    from app.services.news_scheduler import news_scheduler

    return {
        **news_scheduler.get_status(),
        "history": news_scheduler.list_history(limit=5),
    }
