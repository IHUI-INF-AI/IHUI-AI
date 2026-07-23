"""ai_skills.py 单元测试 — AI Skills TOP 路由(19 个 skill)。

测试覆盖:
- 数据模型:SkillMeta / InvokeRequest / InvokeResponse / ApiEnvelope
- 内部工具:_ok / _serialize_skill / _extract_json_array / _pad_ppt_slides
- hashtag 工具:_extract_hashtags / _topical_hashtags / _ensure_hashtags
- 路由端点:list / get / invoke(占位 skill / 真集成 skill / 错误路径)
- 隔离:mock skill_registry + llm_gateway + screenshot_service,不调真实 LLM
"""
from __future__ import annotations

import json
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.routers import ai_skills
from app.routers.ai_skills import (
    ApiEnvelope,
    InvokeRequest,
    InvokeResponse,
    SkillMeta,
    _ensure_hashtags,
    _extract_hashtags,
    _extract_json_array,
    _ok,
    _pad_ppt_slides,
    _serialize_skill,
    _topical_hashtags,
    _try_screenshot_html,
)
from app.services.skills import Skill


# =============================================================================
# 辅助
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(ai_skills.router)
    return app


def _make_skill(
    name="test-skill",
    category="ai-top",
    available=True,
    prompt_template="hello {name}",
    source_url="https://github.com/x/y",
):
    return Skill(
        name=name,
        description=f"desc for {name}",
        prompt_template=prompt_template,
        icon="sparkles",
        category=category,
        tags=["t1", "t2"],
        source="ai-top",
        source_url=source_url,
        available=available,
    )


# =============================================================================
# 数据模型
# =============================================================================


def test_ok_envelope_format():
    """_ok 返回 {code:0, message:'ok', data:...}。"""
    result = _ok({"k": "v"})
    assert result == {"code": 0, "message": "ok", "data": {"k": "v"}}


def test_invoke_request_defaults():
    """InvokeRequest 默认 variables={}, model/ownerUuid=None。"""
    req = InvokeRequest()
    assert req.variables == {}
    assert req.model is None
    assert req.ownerUuid is None


def test_invoke_response_optional_fields_default_none():
    """InvokeResponse 增强字段(before/after/hashtags/slide_count)默认 None。"""
    r = InvokeResponse(skillId="x", ok=True, available=True)
    assert r.before is None
    assert r.after is None
    assert r.hashtags is None
    assert r.slide_count is None
    assert r.contentType == "text"


def test_skill_meta_serialization():
    """SkillMeta 字段映射正确。"""
    m = SkillMeta(
        id="s1",
        name="s1",
        description="d",
        icon="i",
        category="ai-top",
        tags=["a"],
        source="ai-top",
        sourceUrl="https://x",
        available=True,
        promptTemplate="tmpl",
    )
    assert m.id == "s1"
    assert m.available is True


# =============================================================================
# _serialize_skill
# =============================================================================


def test_serialize_skill_maps_all_fields():
    """_serialize_skill 把 Skill dataclass → SkillMeta(注意 id=name=name)。"""
    s = _make_skill(name="nuwa", prompt_template="rewrite {content}")
    m = _serialize_skill(s)
    assert m.id == "nuwa"
    assert m.name == "nuwa"
    assert m.description == "desc for nuwa"
    assert m.icon == "sparkles"
    assert m.category == "ai-top"
    assert m.tags == ["t1", "t2"]
    assert m.source == "ai-top"
    assert m.sourceUrl == "https://github.com/x/y"
    assert m.available is True
    assert m.promptTemplate == "rewrite {content}"


# =============================================================================
# _extract_json_array
# =============================================================================


def test_extract_json_array_from_code_fence():
    """从 ```json ... ``` 包裹中提取 JSON 数组。"""
    text = '```json\n[{"slide": 1, "title": "a"}]\n```'
    result = _extract_json_array(text)
    assert len(result) == 1
    assert result[0]["slide"] == 1


def test_extract_json_array_from_plain():
    """裸 JSON 数组也能提取。"""
    text = '[{"x": 1}, {"y": 2}]'
    result = _extract_json_array(text)
    assert len(result) == 2


def test_extract_json_array_returns_empty_when_no_array():
    """无 JSON 数组 → 空列表。"""
    assert _extract_json_array("just text") == []


def test_extract_json_array_filters_non_dict_items():
    """数组中非 dict 元素被过滤。"""
    text = '[{"ok": 1}, "str", 42, null]'
    result = _extract_json_array(text)
    assert len(result) == 1
    assert result[0] == {"ok": 1}


def test_extract_json_array_invalid_json_returns_empty():
    """JSON 解析失败 → 空列表。"""
    text = "[not valid json"
    assert _extract_json_array(text) == []


def test_extract_json_array_with_surrounding_text():
    """LLM 输出 JSON 前后混入文字也能提取。"""
    text = 'Here is the plan:\n[{"a": 1}]\nDone.'
    result = _extract_json_array(text)
    assert len(result) == 1


# =============================================================================
# _pad_ppt_slides
# =============================================================================


def test_pad_ppt_slides_no_padding_when_already_5():
    """已有 ≥5 张时不补齐。"""
    slides = [{"slide": i, "title": f"t{i}"} for i in range(5)]
    result = _pad_ppt_slides(slides)
    assert len(result) == 5
    assert result == slides


def test_pad_ppt_slides_pads_to_5():
    """不足 5 张时补齐到 5。"""
    slides = [{"slide": 1, "title": "intro", "bullets": ["a"], "layout": "bullet"}]
    result = _pad_ppt_slides(slides)
    assert len(result) == 5
    # 模板复用了第一张的 keys
    for s in result:
        assert "title" in s
        assert "bullets" in s
        assert "layout" in s
    # 补齐的页应标 _auto_padded=True
    padded = [s for s in result if s.get("_auto_padded")]
    assert len(padded) == 4


def test_pad_ppt_slides_renumbers_slide_index():
    """补齐后 slide 序号从 1 重新编号。"""
    slides = [{"slide": 99, "title": "x"}]
    result = _pad_ppt_slides(slides)
    assert [s["slide"] for s in result] == [1, 2, 3, 4, 5]


def test_pad_ppt_slides_empty_input_uses_default_template():
    """空列表 → 用默认模板补齐到 5 张,标题用 filler_titles 顺序填充。"""
    result = _pad_ppt_slides([], topic="AI")
    assert len(result) == 5
    # 空 slides 时所有 5 张都用 filler_titles 顺序填充(覆盖 template.title)
    assert result[0]["title"] == "延伸思考"
    assert result[1]["title"] == "总结与展望"
    assert result[4]["title"] == "致谢"
    # bullets/layout 来自默认 template
    for s in result:
        assert "bullets" in s
        assert s["layout"] == "bullet"


def test_pad_ppt_slides_filler_titles_used():
    """补齐页用预定义 filler_titles。"""
    slides = [{"slide": 1, "title": "intro", "bullets": ["a"], "layout": "bullet"}]
    result = _pad_ppt_slides(slides)
    titles = [s["title"] for s in result]
    # 第一张保留,后 4 张用 filler
    assert titles[0] == "intro"
    assert "延伸思考" in titles
    assert "总结与展望" in titles


# =============================================================================
# _extract_hashtags
# =============================================================================


def test_extract_hashtags_chinese():
    """中文 hashtag 提取。"""
    text = "今天聊 #人工智能 和 #AI教育"
    tags = _extract_hashtags(text)
    assert "#人工智能" in tags
    assert "#AI教育" in tags


def test_extract_hashtags_english():
    """英文 hashtag 提取。"""
    text = "love #AI and #MachineLearning"
    tags = _extract_hashtags(text)
    assert "#AI" in tags
    assert "#MachineLearning" in tags


def test_extract_hashtags_dedup():
    """重复 hashtag 去重保序。"""
    text = "#AI is great, #AI rocks"
    tags = _extract_hashtags(text)
    assert tags == ["#AI"]


def test_extract_hashtags_empty():
    """无 hashtag → 空列表。"""
    assert _extract_hashtags("no tags here") == []


def test_extract_hashtags_mixed():
    """中英混合 hashtag。"""
    text = "#AI #生活 #ML"
    tags = _extract_hashtags(text)
    assert tags == ["#AI", "#生活", "#ML"]


# =============================================================================
# _topical_hashtags
# =============================================================================


def test_topical_hashtags_topic_provided():
    """有 topic → 第一条 #<topic>(去空格)。"""
    tags = _topical_hashtags("AI 教育", count=3)
    assert tags[0] == "#AI教育"
    assert len(tags) == 3


def test_topical_hashtags_empty_topic():
    """空 topic → 第一条 #生活。"""
    tags = _topical_hashtags("", count=2)
    assert tags[0] == "#生活"


def test_topical_hashtags_count_limit():
    """count 限制返回数量。"""
    tags = _topical_hashtags("x", count=2)
    assert len(tags) == 2


# =============================================================================
# _ensure_hashtags
# =============================================================================


def test_ensure_hashtags_no_change_when_already_3():
    """已有 ≥3 个 hashtag → 原文不变。"""
    text = "hello #a #b #c world"
    updated, tags = _ensure_hashtags(text, "topic")
    assert updated == text
    assert len(tags) >= 3


def test_ensure_hashtags_pads_to_3():
    """不足 3 个 → 补到 3 个并追加到文末。"""
    text = "hello #only_one"
    updated, tags = _ensure_hashtags(text, "AI")
    assert len(tags) >= 3
    assert updated != text  # 文本被修改


def test_ensure_hashtags_appends_separator_correctly():
    """原文末尾无换行 → 用 \\n\\n 分隔追加。"""
    text = "no newline end"
    updated, _ = _ensure_hashtags(text, "AI")
    assert "\n\n" in updated


def test_ensure_hashtags_no_double_separator_when_trailing_newline():
    """原文末尾已有 \\n → 不再加 \\n\\n。"""
    text = "has newline\n"
    updated, _ = _ensure_hashtags(text, "AI")
    assert not updated.startswith(text + "\n\n")


# =============================================================================
# _try_screenshot_html
# =============================================================================


def test_try_screenshot_returns_none_when_service_missing(monkeypatch):
    """screenshot_service 模块不存在 → 返回 None。"""
    import sys

    # 模拟 import 失败:让 from-import 时找不到 screenshot_service
    monkeypatch.setitem(sys.modules, "app.services.screenshot_service", None)
    # 同时移除 app.services 上的 screenshot_service 属性(若已加载)
    import app.services as _services_pkg

    monkeypatch.delattr(_services_pkg, "screenshot_service", raising=False)
    assert _try_screenshot_html("<html></html>") is None


def test_try_screenshot_returns_none_when_func_missing(monkeypatch):
    """screenshot_service 无 screenshot_html_to_base64 函数 → None。"""
    fake_module = MagicMock()
    fake_module.screenshot_html_to_base64 = None
    import app.services as _services_pkg

    monkeypatch.setattr(_services_pkg, "screenshot_service", fake_module)
    assert _try_screenshot_html("<html></html>") is None


def test_try_screenshot_wraps_plain_base64(monkeypatch):
    """返回纯 base64 字符串 → 包装为 data URL。"""
    fake_module = MagicMock()
    fake_module.screenshot_html_to_base64 = MagicMock(return_value="abc123==")
    import app.services as _services_pkg

    monkeypatch.setattr(_services_pkg, "screenshot_service", fake_module)
    result = _try_screenshot_html("<html></html>")
    assert result == "data:image/png;base64,abc123=="


def test_try_screenshot_passes_through_data_url(monkeypatch):
    """返回值已是 data URL → 直接透传。"""
    fake_module = MagicMock()
    fake_module.screenshot_html_to_base64 = MagicMock(
        return_value="data:image/png;base64,xyz"
    )
    import app.services as _services_pkg

    monkeypatch.setattr(_services_pkg, "screenshot_service", fake_module)
    result = _try_screenshot_html("<html></html>")
    assert result == "data:image/png;base64,xyz"


def test_try_screenshot_swallows_exception(monkeypatch):
    """func 抛异常 → 返回 None。"""
    fake_module = MagicMock()
    fake_module.screenshot_html_to_base64 = MagicMock(
        side_effect=RuntimeError("boom")
    )
    import app.services as _services_pkg

    monkeypatch.setattr(_services_pkg, "screenshot_service", fake_module)
    assert _try_screenshot_html("<html></html>") is None


# =============================================================================
# 端点:list
# =============================================================================


async def test_list_ai_skills_returns_envelope(monkeypatch):
    """GET /ai-skills:返回 _ok 信封 + 序列化的 skill 列表。"""
    s1 = _make_skill(name="s1")
    s2 = _make_skill(name="s2")
    fake_registry = MagicMock()
    fake_registry.list_ai_top = MagicMock(return_value=[s1, s2])
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/ai-skills")

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert len(data["data"]) == 2
    assert data["data"][0]["id"] == "s1"


# =============================================================================
# 端点:get
# =============================================================================


async def test_get_ai_skill_404_when_not_found(monkeypatch):
    """GET /ai-skills/{id}:skill 不存在 → 404。"""
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=None)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/ai-skills/nope")
    assert resp.status_code == 404


async def test_get_ai_skill_404_when_not_ai_top_category(monkeypatch):
    """GET /ai-skills/{id}:skill 存在但 category != ai-top → 404。"""
    s = _make_skill(name="x", category="code")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/ai-skills/x")
    assert resp.status_code == 404


async def test_get_ai_skill_returns_meta(monkeypatch):
    """GET /ai-skills/{id}:成功返回 SkillMeta。"""
    s = _make_skill(name="nuwa", available=True)
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/ai-skills/nuwa")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == "nuwa"
    assert data["available"] is True


# =============================================================================
# 端点:invoke(占位 skill)
# =============================================================================


async def test_invoke_skill_404_when_not_found(monkeypatch):
    """invoke:skill 不存在 → 404。"""
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=None)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/ai-skills/nope/invoke", json={})
    assert resp.status_code == 404


async def test_invoke_placeholder_skill_returns_guidance(monkeypatch):
    """invoke 占位 skill:返回 ok=False + guidance + sourceUrl。"""
    s = _make_skill(
        name="future-skill",
        available=False,
        source_url="https://github.com/x/future",
    )
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/ai-skills/future-skill/invoke", json=InvokeRequest().model_dump())

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ok"] is False
    assert data["available"] is False
    assert "GitHub" in data["guidance"]
    assert data["sourceUrl"] == "https://github.com/x/future"
    assert data["duration_ms"] >= 0


# =============================================================================
# 端点:invoke(真集成 skill)
# =============================================================================


async def test_invoke_real_skill_missing_variables_returns_400(monkeypatch):
    """真集成 skill:模板含变量但 variables 空 → 400。"""
    s = _make_skill(
        name="nuwa-skill",
        available=True,
        prompt_template="rewrite {content} in {style} style",
    )
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/ai-skills/nuwa-skill/invoke", json={"variables": {}})

    assert resp.status_code == 400
    assert "missing variables" in resp.json()["detail"]


async def test_invoke_real_skill_llm_failure_returns_error(monkeypatch):
    """真集成 skill:llm_gateway.complete 抛异常 → 返回 ok=False + error。"""
    s = _make_skill(name="nuwa-skill", available=True, prompt_template="hello {content}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(side_effect=RuntimeError("llm down"))
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/nuwa-skill/invoke",
            json={"variables": {"content": "hi"}},
        )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ok"] is False
    assert "LLM 调用失败" in data["error"]


async def test_invoke_real_skill_llm_returns_error_field(monkeypatch):
    """真集成 skill:LLM 返回 error 字段 → ok=False。"""
    s = _make_skill(name="nuwa-skill", available=True, prompt_template="hello {content}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={"error": True, "error_message": "rate limited", "content": ""}
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/nuwa-skill/invoke",
            json={"variables": {"content": "hi"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is False
    assert data["error"] == "rate limited"


async def test_invoke_real_skill_llm_empty_content(monkeypatch):
    """真集成 skill:LLM 返回空 content → ok=False + error='LLM 返回空内容'。"""
    s = _make_skill(name="nuwa-skill", available=True, prompt_template="hi {content}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(return_value={"content": "   "})
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/nuwa-skill/invoke",
            json={"variables": {"content": "x"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is False
    assert data["error"] == "LLM 返回空内容"


async def test_invoke_nuwa_skill_returns_before_after(monkeypatch):
    """nuwa-skill:返回 before/after 字段。"""
    s = _make_skill(name="nuwa-skill", available=True, prompt_template="rewrite {content}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={"content": "rewritten!", "model": "gpt-4"}
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/nuwa-skill/invoke",
            json={"variables": {"content": "original"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is True
    assert data["before"] == "original"
    assert data["after"] == "rewritten!"
    assert data["content"] == "rewritten!"
    assert data["model"] == "gpt-4"


async def test_invoke_ppt_skill_pads_slides(monkeypatch):
    """guizang-ppt-skill:解析 JSON 并补齐到 ≥5 张,contentType=json。"""
    s = _make_skill(name="guizang-ppt-skill", available=True, prompt_template="gen {topic}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={
            "content": '```json\n[{"slide": 1, "title": "intro", "bullets": ["a"], "layout": "bullet"}]\n```',
            "model": "claude",
        }
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/guizang-ppt-skill/invoke",
            json={"variables": {"topic": "AI"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is True
    assert data["contentType"] == "json"
    assert data["slide_count"] == 5
    slides = json.loads(data["content"])
    assert len(slides) == 5


async def test_invoke_hugshu_design_html_content_type(monkeypatch):
    """hugshu-design:LLM 返回 HTML → contentType=html + screenshot_url。"""
    s = _make_skill(name="hugshu-design", available=True, prompt_template="design {requirements}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={
            "content": "<html><body><div>hi</div></body></html>",
            "model": "gpt-4",
        }
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)
    monkeypatch.setattr(ai_skills, "_try_screenshot_html", lambda x: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/hugshu-design/invoke",
            json={"variables": {"requirements": "login form"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is True
    assert data["contentType"] == "html"
    assert data["screenshot_url"] is None


async def test_invoke_redbook_skill_ensures_hashtags(monkeypatch):
    """auto-redbook-skills:返回 hashtags 列表。"""
    s = _make_skill(name="auto-redbook-skills", available=True, prompt_template="write {topic}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={
            "content": "今天聊 AI 教育的那些事 #AI #教育",
            "model": "gpt-4",
        }
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/auto-redbook-skills/invoke",
            json={"variables": {"topic": "AI 教育"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is True
    assert data["contentType"] == "text"
    assert data["hashtags"] is not None
    assert len(data["hashtags"]) >= 3


async def test_invoke_default_skill_returns_text(monkeypatch):
    """未匹配特殊后处理的真集成 skill → contentType=text。"""
    s = _make_skill(name="other-ai-skill", available=True, prompt_template="do {x}")
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    fake_gateway = MagicMock()
    fake_gateway.complete = AsyncMock(
        return_value={"content": "result text", "model": "m"}
    )
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)
    monkeypatch.setattr(ai_skills, "llm_gateway", fake_gateway)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/other-ai-skill/invoke",
            json={"variables": {"x": "y"}},
        )
    data = resp.json()["data"]
    assert data["ok"] is True
    assert data["contentType"] == "text"
    assert data["content"] == "result text"


async def test_invoke_skill_template_render_failure_returns_400(monkeypatch):
    """skill.render 抛异常 → 400。"""
    s = _make_skill(name="bad-skill", available=True, prompt_template="hi {x}")
    s.render = MagicMock(side_effect=RuntimeError("render boom"))
    fake_registry = MagicMock()
    fake_registry.get = MagicMock(return_value=s)
    monkeypatch.setattr(ai_skills, "skill_registry", fake_registry)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/ai-skills/bad-skill/invoke",
            json={"variables": {"x": "1"}},
        )
    assert resp.status_code == 400
    assert "template render failed" in resp.json()["detail"]
