"""Tools routes (file upload, list, categories)."""

from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel

from app.schemas.common import success
from app.security import require_login

router = APIRouter()


class ToolCategory(BaseModel):
    key: str
    name: str
    icon: str
    count: int


class ToolItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    hot: bool = False
    usage: int = 0
    url: str | None = None


# 工具元数据 (合并历史项目所有 AI 能力)
TOOL_CATEGORIES = [
    {"key": "all", "name": "全部工具", "icon": "✦"},
    {"key": "chat", "name": "智能对话", "icon": "💬"},
    {"key": "image", "name": "图像生成", "icon": "🎨"},
    {"key": "video", "name": "视频生成", "icon": "🎬"},
    {"key": "audio", "name": "语音合成", "icon": "🔊"},
    {"key": "code", "name": "代码助手", "icon": "⌨"},
    {"key": "text", "name": "文本创作", "icon": "📝"},
    {"key": "translate", "name": "翻译", "icon": "🌐"},
    {"key": "agent", "name": "智能体", "icon": "🤖"},
    {"key": "stock", "name": "股票分析", "icon": "📈"},
    {"key": "course", "name": "课程学习", "icon": "🎓"},
]

TOOLS: list[dict[str, Any]] = [
    {
        "id": "t1",
        "name": "通用对话",
        "description": "基于大语言模型的智能对话",
        "category": "chat",
        "icon": "💬",
        "hot": True,
        "usage": 12500,
        "url": "/ai/qwen",
    },
    {
        "id": "t2",
        "name": "角色扮演",
        "description": "多种角色互动对话",
        "category": "chat",
        "icon": "🎭",
        "usage": 8200,
        "url": "/chat",
    },
    {
        "id": "t3",
        "name": "深度求索",
        "description": "DeepSeek 推理对话",
        "category": "chat",
        "icon": "🧠",
        "hot": True,
        "usage": 9500,
        "url": "/ai/deepseek",
    },
    {
        "id": "t4",
        "name": "通义千问",
        "description": "阿里通义千问对话",
        "category": "chat",
        "icon": "✨",
        "usage": 7400,
        "url": "/ai/qwen",
    },
    {
        "id": "t5",
        "name": "智谱清言",
        "description": "智谱 GLM 对话",
        "category": "chat",
        "icon": "⚡",
        "usage": 6300,
        "url": "/ai/zhipu",
    },
    {
        "id": "t6",
        "name": "豆包视觉",
        "description": "字节豆包视觉理解",
        "category": "chat",
        "icon": "👁",
        "usage": 4800,
        "url": "/ai/doubao",
    },
    {
        "id": "i1",
        "name": "Stable Diffusion",
        "description": "文生图扩散模型",
        "category": "image",
        "icon": "🎨",
        "hot": True,
        "usage": 15300,
        "url": "/ai/sd",
    },
    {
        "id": "i2",
        "name": "Midjourney",
        "description": "高质量艺术图像生成",
        "category": "image",
        "icon": "🖼",
        "usage": 9800,
        "url": "/ai/midjourney",
    },
    {
        "id": "i3",
        "name": "通义万相",
        "description": "阿里通义图像生成",
        "category": "image",
        "icon": "✨",
        "usage": 7100,
        "url": "/ai/wanxiang",
    },
    {
        "id": "i4",
        "name": "可灵图像",
        "description": "快手可灵图像生成",
        "category": "image",
        "icon": "📷",
        "usage": 6500,
        "url": "/ai/kling",
    },
    {
        "id": "i5",
        "name": "图生图编辑",
        "description": "图像编辑背景移除",
        "category": "image",
        "icon": "✂",
        "usage": 4200,
        "url": "/ai/qwen-image-edit",
    },
    {
        "id": "v1",
        "name": "Sora 视频",
        "description": "OpenAI 文生视频模型",
        "category": "video",
        "icon": "🎬",
        "hot": True,
        "usage": 11200,
        "url": "/ai/sora",
    },
    {
        "id": "v2",
        "name": "可灵视频",
        "description": "快手视频生成",
        "category": "video",
        "icon": "📹",
        "usage": 6400,
        "url": "/ai/kling-video",
    },
    {
        "id": "v3",
        "name": "通义视频",
        "description": "阿里通义视频生成",
        "category": "video",
        "icon": "🎞",
        "usage": 5300,
        "url": "/ai/wan-video",
    },
    {
        "id": "v4",
        "name": "腾讯混元视频",
        "description": "腾讯混元文生视频",
        "category": "video",
        "icon": "🌊",
        "usage": 4900,
        "url": "/ai/hunyuan-video",
    },
    {
        "id": "a1",
        "name": "语音克隆",
        "description": "基于样本的语音复刻",
        "category": "audio",
        "icon": "🔊",
        "usage": 4500,
        "url": "/ai/tts/clone",
    },
    {
        "id": "a2",
        "name": "语音转写",
        "description": "音频转文字",
        "category": "audio",
        "icon": "📝",
        "usage": 5800,
        "url": "/ai/asr",
    },
    {
        "id": "a3",
        "name": "实时语音对话",
        "description": "Qwen-Omni 实时语音",
        "category": "audio",
        "icon": "🎙",
        "hot": True,
        "usage": 7200,
        "url": "/ai/qwen-omni",
    },
    {
        "id": "a4",
        "name": "声纹识别",
        "description": "声纹注册与识别",
        "category": "audio",
        "icon": "🔐",
        "usage": 3100,
        "url": "/ai/voiceprint",
    },
    {
        "id": "c1",
        "name": "代码补全",
        "description": "智能代码建议",
        "category": "code",
        "icon": "⌨",
        "hot": True,
        "usage": 13700,
        "url": "/ai/code/complete",
    },
    {
        "id": "c2",
        "name": "Bug 修复",
        "description": "代码错误自动修复",
        "category": "code",
        "icon": "🛠",
        "usage": 6900,
        "url": "/ai/code/fix",
    },
    {
        "id": "c3",
        "name": "单元测试生成",
        "description": "自动生成测试用例",
        "category": "code",
        "icon": "✅",
        "usage": 3700,
        "url": "/ai/code/test",
    },
    {
        "id": "x1",
        "name": "文案写作",
        "description": "营销文案自动生成",
        "category": "text",
        "icon": "✍",
        "usage": 8800,
        "url": "/ai/text/copywriting",
    },
    {
        "id": "x2",
        "name": "小红书爆款",
        "description": "社交平台爆款标题",
        "category": "text",
        "icon": "📱",
        "hot": True,
        "usage": 10100,
        "url": "/ai/text/xiaohongshu",
    },
    {
        "id": "x3",
        "name": "剧本生成",
        "description": "短剧/长剧剧本",
        "category": "text",
        "icon": "🎭",
        "usage": 4200,
        "url": "/ai/text/script",
    },
    {
        "id": "x4",
        "name": "PPT 大纲",
        "description": "PPT 大纲与内容生成",
        "category": "text",
        "icon": "📊",
        "usage": 5600,
        "url": "/ai/text/ppt",
    },
    {
        "id": "l1",
        "name": "多语翻译",
        "description": "100+ 语种互译",
        "category": "translate",
        "icon": "🌐",
        "usage": 7400,
        "url": "/ai/translate",
    },
    {
        "id": "l2",
        "name": "文档翻译",
        "description": "PDF/Word 整篇翻译",
        "category": "translate",
        "icon": "📄",
        "usage": 4900,
        "url": "/ai/translate/doc",
    },
    {
        "id": "g1",
        "name": "智能体市场",
        "description": "调用社区智能体",
        "category": "agent",
        "icon": "🤖",
        "hot": True,
        "usage": 9200,
        "url": "/agents",
    },
    {
        "id": "g2",
        "name": "工作流编排",
        "description": "可视化流程自动化",
        "category": "agent",
        "icon": "⚡",
        "usage": 5300,
        "url": "/workflows",
    },
    {
        "id": "g3",
        "name": "MCP 工具",
        "description": "模型上下文协议工具",
        "category": "agent",
        "icon": "🔌",
        "usage": 3800,
        "url": "/mcp",
    },
    {
        "id": "s1",
        "name": "股票分析",
        "description": "智能选股与诊断",
        "category": "stock",
        "icon": "📈",
        "hot": True,
        "usage": 8400,
        "url": "/stock/analyse",
    },
    {
        "id": "s2",
        "name": "持仓诊断",
        "description": "个人持仓 AI 诊断",
        "category": "stock",
        "icon": "💼",
        "usage": 4100,
        "url": "/stock/portfolio",
    },
    {
        "id": "k1",
        "name": "在线课程",
        "description": "AI 教学课程库",
        "category": "course",
        "icon": "🎓",
        "usage": 6700,
        "url": "/courses",
    },
    {
        "id": "k2",
        "name": "企业培训",
        "description": "B 端企业培训方案",
        "category": "course",
        "icon": "🏢",
        "usage": 2800,
        "url": "/courses/enterprise",
    },
]


@router.get("/list", summary="获取工具列表")
async def list_tools(
    category: str | None = Query(None, description="分类过滤"),
    keyword: str | None = Query(None, description="搜索关键词"),
    sort: str | None = Query("default", description="排序: default/name/hot"),
):
    """获取工具列表 (对接 Tools.vue 前端)"""
    items = list(TOOLS)
    # 分类过滤
    if category and category != "all":
        items = [t for t in items if t["category"] == category]
    # 关键词搜索
    if keyword and keyword.strip():
        kw = keyword.lower()
        items = [t for t in items if kw in t["name"].lower() or kw in t["description"].lower()]
    # 排序
    if sort == "name":
        items.sort(key=lambda t: t["name"])
    elif sort == "hot":
        items.sort(key=lambda t: t["usage"], reverse=True)
    return success({"items": items, "total": len(items)})


@router.get("/categories", summary="获取工具分类列表")
async def list_categories():
    """获取工具分类及每个分类的工具数量"""
    categories = []
    for c in TOOL_CATEGORIES:
        key = c["key"]
        count = len(TOOLS) if key == "all" else sum(1 for t in TOOLS if t["category"] == key)
        categories.append({**c, "count": count})
    return success({"items": categories, "total": len(categories)})


@router.post("/upload", summary="Upload file to MinIO")
async def upload_file(
    file: UploadFile = File(...),
    user_uuid: str = Depends(require_login),
):
    from app.utils.minio_util import upload_file as minio_upload

    content = await file.read()
    url = minio_upload(content, file.filename, file.content_type or "application/octet-stream")  # type: ignore[arg-type]
    return success({"url": url, "file_name": file.filename})
