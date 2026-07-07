"""AI 动态/资讯聚合 API 端点.

提供:
  - GET /ai-feed/sources         数据源列表(动态 Tab 渲染)
  - GET /ai-feed/items           资讯条目分页列表(支持 source/category/trend/keyword 筛选)
  - GET /ai-feed/items/{item_id} 条目详情
  - GET /ai-feed/trend/{item_id} 趋势图表数据(7/14 天曲线)
  - GET /ai-feed/stats           数据源采集统计(管理用)
  - POST /ai-feed/fetch          手动触发采集(管理员)
  - POST /ai-feed/trend          手动触发趋势计算(管理员)
  - POST /ai-feed/llm            手动触发 LLM 分类摘要(管理员)
  - POST /ai-feed/translate      手动触发标题翻译(管理员)
  - PUT /ai-feed/sources/{id}    更新数据源配置(启用/停用/排序, 管理员)

响应格式统一用 success()/error(), 公开读无需鉴权, 管理操作需 require_role("admin").
"""
import logging

from fastapi import APIRouter, Depends, Query

from app.schemas.common import error, success
from app.security import require_role

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sources", summary="数据源列表")
async def list_sources(enabled_only: bool = Query(True, description="仅返回启用的源")):
    """获取数据源列表, 前端用于渲染动态 Tab."""
    try:
        from app.services.ai_feed_service import list_sources

        data = list_sources(enabled_only=enabled_only)
        return success(data)
    except Exception as e:
        logger.error(f"ai_feed list_sources error: {e}", exc_info=True)
        return error(f"获取数据源失败: {e}")


@router.get("/items", summary="资讯条目列表")
async def list_items(
    source: str | None = Query(None, description="数据源 code 筛选"),
    category: str | None = Query(None, description="LLM 分类筛选: hotspot/account/source/creation/analysis/retrieval/tool"),
    trend: str | None = Query(None, description="趋势筛选: rising/stable/cooling/new"),
    keyword: str | None = Query(None, description="标题关键词搜索"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """分页查询资讯条目, 支持多维度筛选."""
    try:
        from app.services.ai_feed_service import list_feed_items

        data = list_feed_items(
            source_code=source,
            category=category,
            trend_tag=trend,
            keyword=keyword,
            page=page,
            limit=limit,
        )
        return success(data["items"], total=data["total"])
    except Exception as e:
        logger.error(f"ai_feed list_items error: {e}", exc_info=True)
        return error(f"获取资讯列表失败: {e}")


@router.get("/items/{item_id}", summary="条目详情")
async def get_item(item_id: int):
    """获取单条资讯详情."""
    try:
        from app.database import get_session
        from app.models.ai_feed_models import AiFeedHotItem, AiFeedSource
        from app.services.ai_feed_service import _item_to_dict

        with get_session() as db:
            item = db.query(AiFeedHotItem).filter(AiFeedHotItem.id == item_id).first()
            if not item:
                return error("条目不存在", code="404001")
            source_map = {s.source_code: s for s in db.query(AiFeedSource).all()}
            return success(_item_to_dict(item, source_map))
    except Exception as e:
        logger.error(f"ai_feed get_item error: {e}", exc_info=True)
        return error(f"获取详情失败: {e}")


@router.get("/trend/{item_id}", summary="趋势图表数据")
async def get_trend(
    item_id: int,
    window: int = Query(14, ge=1, le=30, description="趋势窗口天数"),
):
    """获取某条目的趋势图表数据(排名/热度曲线 + 7/14 天趋势信号)."""
    try:
        from app.services.ai_feed_service import get_trend_chart

        data = get_trend_chart(item_id, window=window)
        if not data:
            return error("条目不存在", code="404001")
        return success(data)
    except Exception as e:
        logger.error(f"ai_feed get_trend error: {e}", exc_info=True)
        return error(f"获取趋势数据失败: {e}")


@router.get("/stats", summary="数据源采集统计")
async def get_stats():
    """获取各数据源的采集状态与条目数(管理/调试用)."""
    try:
        from app.services.ai_feed_service import get_source_stats

        data = get_source_stats()
        return success(data)
    except Exception as e:
        logger.error(f"ai_feed get_stats error: {e}", exc_info=True)
        return error(f"获取统计失败: {e}")


@router.get("/topics", summary="跨源热点聚合")
async def list_topics(
    hours: int = Query(48, ge=1, le=168, description="聚合时间窗口(小时)"),
    min_sources: int = Query(2, ge=2, le=10, description="最少覆盖源数"),
    limit: int = Query(20, ge=1, le=50, description="返回话题数"),
):
    """跨源热点聚合: 同一话题在多个平台的传播分析(差异化功能).

    返回话题组列表, 每组包含: 覆盖源数/总热度/最佳排名/聚合趋势/子条目列表.
    """
    try:
        from app.services.ai_feed_service import get_cross_source_topics

        data = get_cross_source_topics(hours=hours, min_sources=min_sources, limit=limit)
        return success(data, total=len(data))
    except Exception as e:
        logger.error(f"ai_feed list_topics error: {e}", exc_info=True)
        return error(f"获取话题聚合失败: {e}")


@router.get("/notifications", summary="趋势爆发通知(轮询)")
async def list_notifications(
    hours: int = Query(24, ge=1, le=168, description="查询时间窗口(小时)"),
    min_growth: float = Query(15.0, ge=0, le=1000, description="最小增长率(%)"),
    limit: int = Query(10, ge=1, le=50, description="返回条目数"),
):
    """趋势爆发通知: 返回近期 rising 且增长率 >= min_growth 的条目.

    前端每 60 秒轮询此端点, 有新条目时通过 ElNotification 推送.
    替代 socket.io 的轻量实时推送方案.
    """
    try:
        from app.services.ai_feed_service import get_trend_notifications

        data = get_trend_notifications(hours=hours, min_growth=min_growth, limit=limit)
        return success(data, total=len(data))
    except Exception as e:
        logger.error(f"ai_feed list_notifications error: {e}", exc_info=True)
        return error(f"获取通知失败: {e}")


@router.get("/image-proxy", summary="图片代理(防盗链)")
async def image_proxy(
    url: str = Query(..., description="原始图片 URL"),
):
    """图片代理: 绕过 Referer 防盗链, 返回图片二进制流.

    用于前端 <img> 标签的 src, 避免 403 Forbidden.
    """
    import httpx
    from fastapi import Response

    if not url.startswith(("http://", "https://")):
        return error("无效的图片 URL")

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": url.split("/")[0] + "//" + url.split("/")[2] if "/" in url else "",
                },
            )
            if resp.status_code != 200:
                return error(f"图片获取失败: HTTP {resp.status_code}")

            content_type = resp.headers.get("content-type", "image/jpeg")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    except Exception as e:
        logger.error(f"ai_feed image_proxy error: {e}", exc_info=True)
        return error(f"图片代理失败: {e}")


# ---------------------------------------------------------------------------
# 管理操作(需 admin 角色)
# ---------------------------------------------------------------------------
@router.post("/fetch", summary="手动触发采集(管理员)")
async def trigger_fetch(_admin=Depends(require_role("admin"))):
    """手动触发一次全量采集(异步执行)."""
    try:
        from app.services.ai_feed_service import fetch_all_sources, persist_items

        results = await fetch_all_sources()
        total = 0
        for source_code, items in results.items():
            total += persist_items(source_code, items)
        return success({"fetched_sources": len(results), "total_items": total})
    except Exception as e:
        logger.error(f"ai_feed trigger_fetch error: {e}", exc_info=True)
        return error(f"采集失败: {e}")


@router.post("/trend", summary="手动触发趋势计算(管理员)")
async def trigger_trend(_admin=Depends(require_role("admin"))):
    """手动触发趋势信号计算."""
    try:
        from app.services.ai_feed_service import compute_trend_signals

        count = compute_trend_signals()
        return success({"processed_items": count})
    except Exception as e:
        logger.error(f"ai_feed trigger_trend error: {e}", exc_info=True)
        return error(f"趋势计算失败: {e}")


@router.post("/llm", summary="手动触发LLM分类摘要(管理员)")
async def trigger_llm(
    limit: int = Query(100, ge=1, le=500),
    _admin=Depends(require_role("admin")),
):
    """手动触发 LLM 分类与摘要批处理."""
    try:
        from app.services.ai_feed_service import process_llm_batch

        count = await process_llm_batch(limit=limit)
        return success({"processed_items": count})
    except Exception as e:
        logger.error(f"ai_feed trigger_llm error: {e}", exc_info=True)
        return error(f"LLM 处理失败: {e}")


@router.post("/translate", summary="手动触发标题翻译(管理员)")
async def trigger_translate(
    limit: int = Query(50, ge=1, le=200),
    _admin=Depends(require_role("admin")),
):
    """手动触发多语言标题翻译(批量)."""
    try:
        from app.services.ai_feed_service import translate_titles_batch

        count = await translate_titles_batch(limit=limit)
        return success({"translated_items": count})
    except Exception as e:
        logger.error(f"ai_feed trigger_translate error: {e}", exc_info=True)
        return error(f"翻译失败: {e}")


@router.put("/sources/{source_id}", summary="更新数据源配置(管理员)")
async def update_source(
    source_id: int,
    body: dict,
    _admin=Depends(require_role("admin")),
):
    """更新数据源(启用/停用/排序/采集间隔等)."""
    try:
        from app.database import get_session
        from app.models.ai_feed_models import AiFeedSource

        allowed_fields = {"enabled", "sort_order", "fetch_interval_minutes", "source_name", "description", "category", "color", "icon"}
        with get_session() as db:
            src = db.query(AiFeedSource).filter(AiFeedSource.id == source_id).first()
            if not src:
                return error("数据源不存在", code="404001")
            for k, v in body.items():
                if k in allowed_fields:
                    setattr(src, k, v)
            db.commit()
            return success({"id": src.id, "updated": True})
    except Exception as e:
        logger.error(f"ai_feed update_source error: {e}", exc_info=True)
        return error(f"更新失败: {e}")
