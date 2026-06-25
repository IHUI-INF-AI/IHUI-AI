"""
智汇 AI 智能体相关 API
- /api/agent/zhsAgent/list  : 获取智能体列表(首页 AI 应用商店)
- /api/agent/zhsAgent/{id}  : 获取智能体详情
- /api/agent/categories     : 获取智能体分类

前端契约:
  src/api/payment.ts
    getAgentList({ categoryId?, page?, pageSize? })
    getAgentDetail(id)
    findMockAgentById(id)  ← 仅前端 mock 兜底用
    categories()

返回结构(统一 ApiResponse 格式):
  { code: 200, data: { list: [...], total: N, page: 1, pageSize: 20 }, message: 'ok' }
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])


# 内存中的演示数据(生产应改为 DB 查询)
_ZHS_AGENTS = [
    {
        "id": "w-1",
        "name": "AI写作助手",
        "title": "AI写作助手",
        "description": "智能写作助手,支持文案、报告、邮件等多种文体创作",
        "category": "writing",
        "categoryId": "cat-writing",
        "categoryName": "AI写作",
        "tags": ["写作", "文案", "AI"],
        "rating": 4.8,
        "usageCount": 12453,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=writing",
        "isOfficial": True,
        "isFree": True,
        "createdAt": "2025-01-10T08:00:00Z",
    },
    {
        "id": "w-2",
        "name": "AI翻译专家",
        "title": "AI翻译专家",
        "description": "支持 100+ 语言互译,保留原文风格与术语一致性",
        "category": "translate",
        "categoryId": "cat-translate",
        "categoryName": "AI翻译",
        "tags": ["翻译", "多语言"],
        "rating": 4.7,
        "usageCount": 8910,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=translate",
        "isOfficial": True,
        "isFree": True,
        "createdAt": "2025-01-10T08:00:00Z",
    },
    {
        "id": "s-1",
        "name": "AI智能客服",
        "title": "AI智能客服",
        "description": "7x24 智能客服,识别用户意图并给出准确答复",
        "category": "service",
        "categoryId": "cat-service",
        "categoryName": "AI客服",
        "tags": ["客服", "对话"],
        "rating": 4.9,
        "usageCount": 21043,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=service",
        "isOfficial": True,
        "isFree": False,
        "createdAt": "2025-02-01T08:00:00Z",
    },
    {
        "id": "i-1",
        "name": "AI绘画大师",
        "title": "AI绘画大师",
        "description": "输入文字描述生成高质量绘画作品,支持多种艺术风格",
        "category": "painter",
        "categoryId": "cat-painter",
        "categoryName": "AI绘画",
        "tags": ["绘画", "图像生成"],
        "rating": 4.9,
        "usageCount": 35678,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=painter",
        "isOfficial": True,
        "isFree": False,
        "createdAt": "2025-02-15T08:00:00Z",
    },
    {
        "id": "c-1",
        "name": "AI编程助手",
        "title": "AI编程助手",
        "description": "智能代码补全、Bug 定位、重构建议,支持 30+ 编程语言",
        "category": "coder",
        "categoryId": "cat-coder",
        "categoryName": "AI编程",
        "tags": ["编程", "代码"],
        "rating": 4.8,
        "usageCount": 18932,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=coder",
        "isOfficial": True,
        "isFree": True,
        "createdAt": "2025-03-01T08:00:00Z",
    },
    {
        "id": "p-1",
        "name": "AI办公专家",
        "title": "AI办公专家",
        "description": "PPT 生成、表格分析、文档摘要,一站式办公提效",
        "category": "ppt",
        "categoryId": "cat-ppt",
        "categoryName": "AI办公",
        "tags": ["办公", "PPT"],
        "rating": 4.6,
        "usageCount": 9821,
        "icon": "https://api.dicebear.com/7.x/bottts/svg?seed=ppt",
        "isOfficial": True,
        "isFree": False,
        "createdAt": "2025-03-15T08:00:00Z",
    },
]

_CATEGORIES = [
    {"id": "cat-writing", "name": "AI写作", "icon": "✍️", "count": 28, "sort": 1},
    {"id": "cat-translate", "name": "AI翻译", "icon": "🌐", "count": 12, "sort": 2},
    {"id": "cat-service", "name": "AI客服", "icon": "💬", "count": 16, "sort": 3},
    {"id": "cat-painter", "name": "AI绘画", "icon": "🎨", "count": 34, "sort": 4},
    {"id": "cat-coder", "name": "AI编程", "icon": "💻", "count": 22, "sort": 5},
    {"id": "cat-ppt", "name": "AI办公", "icon": "📊", "count": 18, "sort": 6},
]


def _ok(data: dict) -> dict:
    """统一返回 ApiResponse 格式"""
    return {"code": 200, "data": data, "message": "ok"}


@router.get("/zhsAgent/list", summary="智能体列表")
async def list_zhs_agents(
    categoryId: str | None = Query(None, description="分类 ID"),  # noqa: 5
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),  # noqa: 5
):
    """获取智汇智能体列表(支持按分类过滤 + 分页)"""
    items = _ZHS_AGENTS
    if categoryId:
        items = [a for a in items if a.get("categoryId") == categoryId]
    total = len(items)
    start = (page - 1) * pageSize
    end = start + pageSize
    return _ok({
        "list": items[start:end],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "timestamp": utcnow().isoformat() + "Z",
    })


@router.get("/zhsAgent/{agent_id}", summary="智能体详情")
async def get_zhs_agent(agent_id: str):
    """获取单个智汇智能体详情"""
    agent = next((a for a in _ZHS_AGENTS if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"智能体 {agent_id} 不存在")
    return _ok({**agent, "timestamp": utcnow().isoformat() + "Z"})


@router.get("/categories", summary="智能体分类")
async def list_categories():
    """获取全部分类"""
    return _ok({
        "list": _CATEGORIES,
        "total": len(_CATEGORIES),
    })
