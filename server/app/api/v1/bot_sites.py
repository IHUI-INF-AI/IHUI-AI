"""AI 世界工具站点 API (迁移自 Java AiBotSitesController).

GET /bot/sites/kind 返回按 section/sub_section 分组的站点列表,
供前端 AI 世界页面 (AiWorld.vue) 渲染左侧分类菜单与卡片网格.

原始 Java 实现: AiBotSitesServletImpl.getKind()
  1. 先按 section, sub_section 分组得到全部 (section, sub_section) 组合
  2. 对每个 (section, sub_section) 查询对应站点列表
  3. 返回 List<AiBotSitesVO>, 每条含 section + subSection + aiBotSites[]
"""

from collections import OrderedDict

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.dependencies import get_ai_db_session
from app.models.java_missing_models import AiBotSites
from app.schemas.common import success

router = APIRouter(tags=["AI 世界站点"])


@router.get("/api-kou/bot/sites/kind", summary="AI 世界站点分类列表")
async def get_sites_by_kind(
    pageNum: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(12, ge=1, le=200, description="每页数量(每个 section/sub_section 组合的站点数)"),
    section: str | None = Query(None, description="一级分类筛选"),
    subSection: str | None = Query(None, description="二级分类筛选"),
    type: int | None = Query(None, description="类型筛选(预留)"),
    db: Session = Depends(get_ai_db_session),
):
    """按 section/sub_section 分组返回站点列表.

    返回结构与 Java 一致:
        [
          { "section": "AI图像工具", "subSection": "常用|背景移除",
            "subSections": null, "aiBotSites": [...] },
          ...
        ]
    """
    try:
        # 1. 获取所有 (section, sub_section) 组合
        q = db.query(distinct(AiBotSites.section), AiBotSites.sub_section)
        q = q.filter(AiBotSites.section.isnot(None))
        if section:
            q = q.filter(AiBotSites.section == section)
        if subSection:
            q = q.filter(AiBotSites.sub_section == subSection)
        combos = q.all()
        if not combos:
            return success(data=[])

        # 2. 整理父子层级: 按 section 分组, 同一 section 下可能有多个 sub_section
        grouped: "OrderedDict[str, list[str]]" = OrderedDict()
        for sec, sub in combos:
            if sec not in grouped:
                grouped[sec] = []
            sub_val = sub or ""
            if sub_val not in grouped[sec]:
                grouped[sec].append(sub_val)

        # 3. 对每个 (section, sub_section) 查询站点列表并组装结果
        result = []
        for sec, sub_list in grouped.items():
            for sub_val in sub_list:
                site_q = db.query(AiBotSites).filter(AiBotSites.section == sec)
                if sub_val:
                    site_q = site_q.filter(AiBotSites.sub_section == sub_val)
                # type 筛选预留 (当前表无 type 列)
                # 分页: 每个组合限制 pageSize 条
                sites = (
                    site_q.order_by(AiBotSites.id.asc())
                    .offset((pageNum - 1) * pageSize)
                    .limit(pageSize)
                    .all()
                )
                result.append({
                    "section": sec,
                    "subSection": sub_val or None,
                    "subSections": None,
                    "aiBotSites": [s.to_dict() for s in sites],
                })

        return success(data=result)
    except Exception as e:
        logger.error(f"[bot_sites] /bot/sites/kind 查询失败: {e}")
        return {"code": "500000", "msg": str(e), "data": []}
