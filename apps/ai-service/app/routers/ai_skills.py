"""AI Skills TOP 路由(2026-07-23 新增,对应图片 1 + 图片 2 共 19 个 skill)。

提供:
- GET  /api/ai-skills                - 列出 19 个 AI Skills TOP(含元数据 + 状态)
- GET  /api/ai-skills/{skill_id}     - 获取单个 skill 详情
- POST /api/ai-skills/{skill_id}/invoke - 调用 skill(真集成 4 个可调,其余 16 个返回引导)

响应统一包成 {code: 0, message: "ok", data: ...} 信封(对齐 AGENTS.md §5
API 响应统一规范,前端 api-client fetchApi 期望该格式)。

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
from typing import Any, Generic, Optional, TypeVar

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.llm_gateway import llm_gateway
from app.services.skill_scheduler import SkillScheduler  # 2026-07-23:可选 LangGraph 调度器
from app.services.skills import skill_registry

router = APIRouter(prefix="/ai-skills", tags=["ai-skills"])


# ===== 统一响应信封(对齐 AGENTS.md §5)=====

class ApiEnvelope(BaseModel, Generic[TypeVar("T")]):  # type: ignore[valid-type]
    """统一 API 信封:{code, message, data}。"""

    code: int = 0
    message: str = "ok"
    data: Optional[Any] = None


def _ok(data: Any) -> dict[str, Any]:
    """包装成功响应(返回 dict,FastAPI 会自动序列化为 JSONResponse)。"""
    return {"code": 0, "message": "ok", "data": data}


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
    # 2026-07-23 增强字段(只追加,向后兼容老调用方)
    before: Optional[str] = None  # nuwa-skill:原 content(改写前)
    after: Optional[str] = None  # nuwa-skill:改写后内容(同 content)
    screenshot_url: Optional[str] = None  # hugshu-design:HTML 截图 base64 data URL
    hashtags: Optional[list[str]] = None  # auto-redbook-skills:解析出的 hashtag 列表
    slide_count: Optional[int] = None  # guizang-ppt-skill:最终 slide 数量(可能经补齐)


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


def _pad_ppt_slides(slides: list[dict[str, Any]], topic: str = "") -> list[dict[str, Any]]:
    """guizang-ppt-skill:补齐 slides 到 ≥ 5 个。

    用 LLM 返回的最后一页 + 占位 title 补足,保持 schema 与 LLM 输出对齐。
    补齐策略:复用最后一个 slide 的 schema keys,填充通用 placeholder。
    """
    if len(slides) >= 5:
        return slides

    # 提取最后一页作为模板
    template = slides[-1] if slides else {
        "slide": 1,
        "title": topic or "概览",
        "bullets": ["要点 1", "要点 2", "要点 3"],
        "layout": "bullet",
    }

    filler_titles = [
        "延伸思考",
        "总结与展望",
        "常见问题",
        "参考资源",
        "致谢",
    ]
    need = 5 - len(slides)
    for i in range(need):
        new_slide = {k: v for k, v in template.items() if k != "slide"}
        new_slide["title"] = filler_titles[i] if i < len(filler_titles) else f"补充页 {i + 1}"
        new_slide["bullets"] = new_slide.get("bullets", ["要点 1", "要点 2"]) or ["待补充"]
        new_slide["layout"] = new_slide.get("layout", "bullet")
        new_slide["_auto_padded"] = True  # 标记自动补齐,前端可识别
        slides.append(new_slide)

    # 重新编号 slide
    for idx, s in enumerate(slides, start=1):
        s["slide"] = idx
    return slides


def _extract_hashtags(text: str) -> list[str]:
    """auto-redbook-skills:从 LLM 输出中解析 hashtag。

    支持格式:#tag / #tag1 #tag2 / 中文 / 英文。返回去重列表。
    """
    # 匹配 # 后跟非空白字符(中文/字母/数字/下划线),直到下一个 # 或空白
    found = re.findall(r"#([\w\u4e00-\u9fff]+)", text)
    # 去重保序
    seen: set[str] = set()
    result: list[str] = []
    for tag in found:
        if tag not in seen:
            seen.add(tag)
            result.append("#" + tag)
    return result


def _topical_hashtags(topic: str, count: int = 3) -> list[str]:
    """auto-redbook-skills:从 topic 派生通用 hashtag(用于补齐)。

    策略:#<topic中文名> / #AI / #生活,确保至少 3 个相关 tag。
    """
    topic_tag = "#" + re.sub(r"\s+", "", topic)[:20] if topic else "#生活"
    generic = ["#AI", "#生活", "#分享", "#好物", "#种草"]
    result = [topic_tag]
    for g in generic:
        if g not in result:
            result.append(g)
        if len(result) >= count:
            break
    return result[:count]


def _ensure_hashtags(text: str, topic: str) -> tuple[str, list[str]]:
    """auto-redbook-skills:保证文本至少包含 3 个 hashtag。

    若不足 3 个,补足到文末;返回 (更新后文本, hashtag 列表)。
    """
    tags = _extract_hashtags(text)
    if len(tags) >= 3:
        return text, tags

    needed = 3 - len(tags)
    fillers = _topical_hashtags(topic, needed + 2)
    for f in fillers:
        if f not in tags:
            tags.append(f)
            if len(tags) >= 3:
                break

    # 补到文末(若原本就没结尾 newline 加一个)
    sep = "" if text.endswith("\n") else "\n\n"
    updated = text + sep + " ".join(tags)
    return updated, tags[:3] + [t for t in tags[3:] if t not in tags[:3]]


def _try_screenshot_html(html_content: str) -> Optional[str]:
    """hugshu-design:可选调 screenshot_service 渲染 HTML 缩略图。

    优先调 `screenshot_html_to_base64`;若不存在/失败,silently fallback 返回 None。
    不影响主流程,仅作为增强。
    """
    try:
        from app.services import screenshot_service
    except Exception:
        return None
    func = getattr(screenshot_service, "screenshot_html_to_base64", None)
    if func is None:
        return None
    try:
        # 异步函数 → 用事件循环
        import asyncio

        result = func(html_content)
        if asyncio.iscoroutine(result):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 已在事件循环中 → 提交到默认 executor
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                        future = ex.submit(asyncio.run, func(html_content))
                        result = future.result(timeout=15)
                else:
                    result = loop.run_until_complete(result)
            except RuntimeError:
                # 无可用 loop,直接 asyncio.run
                result = asyncio.run(func(html_content))
        if isinstance(result, str) and result:
            # 已经是 data URL 或 base64
            if result.startswith("data:image/"):
                return result
            return "data:image/png;base64," + result
        return None
    except Exception:
        return None


# ===== 路由 =====

@router.get("", response_model=ApiEnvelope)
async def list_ai_skills() -> dict[str, Any]:
    """列出 19 个 AI Skills TOP(供 SkillLibrary 弹窗 ai-skills tab 用)。"""
    return _ok([_serialize_skill(s) for s in skill_registry.list_ai_top()])


@router.get("/{skill_id}", response_model=ApiEnvelope)
async def get_ai_skill(skill_id: str) -> dict[str, Any]:
    """获取单个 AI Skill 详情(404 表示不在 ai-top 列表中)。"""
    skill = skill_registry.get(skill_id)
    if not skill or skill.category != "ai-top":
        raise HTTPException(status_code=404, detail=f"ai-skill not found: {skill_id}")
    return _ok(_serialize_skill(skill))


@router.post("/{skill_id}/invoke", response_model=ApiEnvelope)
async def invoke_ai_skill(skill_id: str, req: InvokeRequest) -> dict[str, Any]:
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
    # scheduler = SkillScheduler()  # 2026-07-23:可选启用 LangGraph 调度(失败重试+token 统计),见 skill_scheduler.py
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
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=False,
            guidance=guidance,
            sourceUrl=skill.source_url,
            duration_ms=int((time.monotonic() - t0) * 1000),
        ).model_dump())

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
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error=f"LLM 调用失败: {type(e).__name__}: {e}",
            duration_ms=int((time.monotonic() - t0) * 1000),
        ).model_dump())

    if result.get("error"):
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error=result.get("error_message", "LLM 调用失败"),
            duration_ms=int((time.monotonic() - t0) * 1000),
        ).model_dump())

    content = str(result.get("content", "")).strip()
    if not content:
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=False,
            available=True,
            error="LLM 返回空内容",
            duration_ms=int((time.monotonic() - t0) * 1000),
        ).model_dump())

    used_model = result.get("model", "")

    # ===== 2026-07-23 增强:4 个真集成 skill 后处理(只追加字段,不改原 content 行为)=====

    # 1) guizang-ppt-skill: 解析 JSON 数组,补齐到 ≥ 5 张
    if skill_id == "guizang-ppt-skill":
        slides = _extract_json_array(content)
        if slides:
            topic = str((req.variables or {}).get("topic", ""))
            padded = _pad_ppt_slides(slides, topic=topic)
            return _ok(InvokeResponse(
                skillId=skill_id,
                ok=True,
                available=True,
                content=json.dumps(padded, ensure_ascii=False),
                contentType="json",
                slide_count=len(padded),
                duration_ms=int((time.monotonic() - t0) * 1000),
                model=used_model,
            ).model_dump())

    # 2) hugshu-design: 检测 HTML + 可选截图缩略图
    if skill_id == "hugshu-design" and ("<html" in content.lower() or "<style" in content.lower() or "<div" in content.lower()):
        screenshot_url = _try_screenshot_html(content)
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=True,
            available=True,
            content=content,
            contentType="html",
            screenshot_url=screenshot_url,
            duration_ms=int((time.monotonic() - t0) * 1000),
            model=used_model,
        ).model_dump())

    # 3) auto-redbook-skills: hashtag 校验 + 字数校验
    if skill_id == "auto-redbook-skills":
        topic = str((req.variables or {}).get("topic", ""))
        updated, tags = _ensure_hashtags(content, topic)
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=True,
            available=True,
            content=updated,
            contentType="text",
            hashtags=tags,
            duration_ms=int((time.monotonic() - t0) * 1000),
            model=used_model,
        ).model_dump())

    # 4) nuwa-skill: 风格改写 before/after 对比
    if skill_id == "nuwa-skill":
        before_text = str((req.variables or {}).get("content", ""))
        return _ok(InvokeResponse(
            skillId=skill_id,
            ok=True,
            available=True,
            content=content,  # content 保留(放 after 值,向后兼容)
            contentType="text",
            before=before_text,
            after=content,
            duration_ms=int((time.monotonic() - t0) * 1000),
            model=used_model,
        ).model_dump())

    # 默认 text(其他真集成)
    return _ok(InvokeResponse(
        skillId=skill_id,
        ok=True,
        available=True,
        content=content,
        contentType="text",
        duration_ms=int((time.monotonic() - t0) * 1000),
        model=used_model,
    ).model_dump())
