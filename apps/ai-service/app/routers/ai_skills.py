"""AI Skills TOP 路由(2026-07-23 新增,对应图片 1 + 图片 2 共 19 个 skill)。

提供:
- GET  /api/ai-skills                - 列出 19 个 AI Skills TOP(含元数据 + 状态)
- GET  /api/ai-skills/{skill_id}     - 获取单个 skill 详情
- POST /api/ai-skills/{skill_id}/invoke - 调用 skill(真集成 3 个可调,其余 16 个返回引导)

3 个真集成(基于现有 llm_gateway,无新装依赖):
- nuwa-skill        : 风格改写(content/style)
- hugshu-design     : HTML/原型生成(requirements)
- guizang-ppt-skill : PPT 大纲生成(topic)
- auto-redbook-skills: 小红书风格文案(topic)

16 个元数据占位:available=False,invoke 时返回引导 + GitHub 链接,
不阻塞 UI 列表展示,用户可见可点击,引导用户了解每个 skill 详情。
"""
import json
import re
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.llm_gateway import llm_gateway
from app.services.skills import skill_registry

router = APIRouter(prefix="/ai-skills", tags=["ai-skills"])


# ===== Pydantic 模型 =====

class SkillMeta(BaseModel):
    """AI Skill 元数据(前端 SkillLibrary 弹窗 ai-skills tab 用)。"""

    id: str
    name: str
    description: str
    icon: str
    category: str
    tags: list[str] = []
    source: str  # 'ai-top' | 'auto' | 'builtin'
    sourceUrl: str = ""
    available: bool
    promptTemplate: str = ""  # 暴露给前端,真集成 skill 用于客户端预览


class InvokeRequest(BaseModel):
    """调用入参,变量对应 skill prompt_template 的 {key}。"""

    variables: dict[str, Any] = Field(default_factory=dict)
    model: Optional[str] = None
    ownerUuid: Optional[str] = None


class InvokeResponse(BaseModel):
    """调用结果。真集成 skill 返回 ok=True + content;占位 skill 返回 ok=False + guidance。"""

    skillId: str
    ok: bool
    available: bool
    content: str = ""  # 真集成 skill 的输出(改写后文本 / HTML / PPT 大纲 JSON)
    contentType: str = "text"  # text | html | json
    guidance: str = ""  # 占位 skill 的引导文本
    sourceUrl: str = ""
    error: Optional[str] = None
    duration_ms: int = 0
    model: str = ""  # 实际使用的 LLM 模型


# ===== 内部工具 =====

def _serialize_skill(s) -> SkillMeta:
    """把 Skill dataclass 序列化为 API 响应模型。"""
    return SkillMeta(
        id=s.name,
        name=s.name,
        description=s.description,
        icon=s.icon,
        category=s.category,
        tags=list(s.tags),
        source=s.source,
        sourceUrl=s.source_url,
        available=s.available,
        promptTemplate=s.prompt_template,
    )


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    """从 LLM 输出中提取 JSON 数组(guizang-ppt-skill 用)。"""
    # 兼容 ```json ... ``` 包裹与裸 JSON
    m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return []
    try:
        obj = json.loads(m.group(0))
        if isinstance(obj, list):
            return [x for x in obj if isinstance(x, dict)]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


# ===== 路由 =====

@router.get("", response_model=list[SkillMeta])
async def list_ai_skills() -> list[SkillMeta]:
    """列出 19 个 AI Skills TOP(供 SkillLibrary 弹窗 ai-skills tab 用)。"""
    return [_serialize_skill(s) for s in skill_registry.list_ai_top()]


@router.get("/{skill_id}", response_model=SkillMeta)
async def get_ai_skill(skill_id: str) -> SkillMeta:
    """获取单个 AI Skill 详情(404 表示不在 ai-top 列表中)。"""
    skill = skill_registry.get(skill_id)
    if not skill or skill.category != "ai-top":
        raise HTTPException(status_code=404, detail=f"ai-skill not found: {skill_id}")
    return _serialize_skill(skill)


@router.post("/{skill_id}/invoke", response_model=InvokeResponse)
async def invoke_ai_skill(skill_id: str, req: InvokeRequest) -> InvokeResponse:
    """调用 AI Skill。

    行为:
    - available=True 真集成:调 llm_gateway 执行 skill.prompt_template,返回 LLM 输出
    - available=False 占位:返回引导文本 + GitHub 链接(ok=False)

    真集成 3(+1) 个:
    - nuwa-skill:        调风格改写 prompt,期望变量 {style, content}
    - hugshu-design:     调 HTML 生成 prompt,期望变量 {requirements}
    - guizang-ppt-skill: 调 PPT 大纲 prompt,期望变量 {topic},输出解析为 JSON 数组
    - auto-redbook-skills: 调小红书文案 prompt,期望变量 {topic}
    """
    t0 = time.monotonic()
    skill = skill_registry.get(skill_id)
    if not skill or skill.category != "ai-top":
        raise HTTPException(status_code=404, detail=f"ai-skill not found: {skill_id}")

    if not skill.available:
        # 占位 skill:返回引导,不调 LLM
        guidance = (
            f"[{skill.name}] {skill.description}\n\n"
            f"该 skill 当前为元数据占位,完整功能将在后续版本上线。\n"
            f"GitHub: {skill.source_url}\n\n"
            f"现阶段您可:\n"
            f"1. 访问 GitHub 查看项目详情与安装方式\n"
            f"2. 或使用本项目其他已上线 skill(如 nuwa-skill 风格改写 / hugshu-design HTML 生成 / guizang-ppt-skill PPT 大纲)"
        )
        return InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=False,
            guidance=guidance,
            sourceUrl=skill.source_url,
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    # 真集成 skill:调 llm_gateway 渲染 prompt_template
    try:
        rendered = skill.render(req.variables or {})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"template render failed: {e}")

    if not req.variables and "{" in skill.prompt_template:
        # 模板含变量但用户没传,返回 400 提示所需变量
        missing = re.findall(r"\{(\w+)\}", skill.prompt_template)
        unique = sorted(set(missing))
        raise HTTPException(
            status_code=400,
            detail=f"missing variables: {unique}",
        )

    try:
        result = await llm_gateway.complete(
            [{"role": "user", "content": rendered}],
            model=req.model,
            owner_uuid=req.ownerUuid,
            temperature=0.7,
            max_tokens=2000,
        )
    except Exception as e:
        return InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error=f"LLM 调用失败: {type(e).__name__}: {e}",
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    if result.get("error"):
        return InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error=result.get("error_message", "LLM 调用失败"),
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    content = str(result.get("content", "")).strip()
    if not content:
        return InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error="LLM 返回空内容",
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    used_model = result.get("model", "")

    # guizang-ppt-skill: 解析 JSON 数组,便于前端渲染
    if skill_id == "guizang-ppt-skill":
        slides = _extract_json_array(content)
        if slides:
            return InvokeResponse(
                skillId=skill_id,
                ok=True,
                available=True,
                content=json.dumps(slides, ensure_ascii=False),
                contentType="json",
                duration_ms=int((time.monotonic() - t0) * 1000),
                model=used_model,
            )

    # hugshu-design: 检测是否包含 <html 或 <style,标记为 html
    if skill_id == "hugshu-design" and ("<html" in content.lower() or "<style" in content.lower() or "<div" in content.lower()):
        return InvokeResponse(
            skillId=skill_id,
            ok=True,
            available=True,
            content=content,
            contentType="html",
            duration_ms=int((time.monotonic() - t0) * 1000),
            model=used_model,
        )

    # 默认 text(改写 / 文案)
    return InvokeResponse(
        skillId=skill_id,
        ok=True,
        available=True,
        content=content,
        contentType="text",
        duration_ms=int((time.monotonic() - t0) * 1000),
        model=used_model,
    )
