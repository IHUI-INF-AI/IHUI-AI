"""spec 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:monkeypatch 掉 `app.routers.spec.spec_generator` 单例,
直接调用端点函数,覆盖 generate / templates / apply 的成功与错误降级分支,
以及请求体校验。templates 为纯常量,无需 mock。
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.routers.spec import (
    SpecApplyRequest,
    SpecGenerateRequest,
    spec_apply,
    spec_generate,
    spec_templates,
)
from app.services.spec_generator import SpecResult


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


class _FakeGenerator:
    """可编程 fake spec_generator。"""

    def __init__(self) -> None:
        self.generate_result: SpecResult | None = None
        self.apply_result: dict | None = None
        self.generate_kwargs: dict | None = None
        self.apply_kwargs: dict | None = None

    async def generate(self, **kwargs):
        self.generate_kwargs = kwargs
        return self.generate_result

    async def apply_spec(self, **kwargs):
        self.apply_kwargs = kwargs
        return self.apply_result


@pytest.fixture
def generator(monkeypatch):
    fake = _FakeGenerator()
    monkeypatch.setattr("app.routers.spec.spec_generator", fake)
    return fake


def _req(**overrides) -> SpecGenerateRequest:
    base = {
        "workspacePath": "/work",
        "includeDependencies": True,
        "languages": ["python"],
    }
    base.update(overrides)
    return SpecGenerateRequest(**base)


def _apply_req(**overrides) -> SpecApplyRequest:
    base = {"workspacePath": "/work", "newSpec": "## spec"}
    base.update(overrides)
    return SpecApplyRequest(**base)


# ---------------------------------------------------------------------------
# GET /spec/templates
# ---------------------------------------------------------------------------


async def test_spec_templates_builtin():
    """预置模板:4 个,id 集合固定,section 字段存在。"""
    resp = await spec_templates()
    assert resp["code"] == 0
    templates = resp["data"]["templates"]
    assert {t["id"] for t in templates} == {
        "full",
        "api-only",
        "schema-only",
        "module-overview",
    }
    assert templates[0]["name"] == "完整规格"
    assert "API 契约" in templates[0]["sections"]


# ---------------------------------------------------------------------------
# POST /spec/generate
# ---------------------------------------------------------------------------


async def test_spec_generate_success(generator):
    generator.generate_result = SpecResult(
        spec="## spec md",
        sections=[{"title": "API 契约"}],
        stats={"files": 3},
        duration_ms=120,
    )
    resp = await spec_generate(_req())
    assert resp["code"] == 0
    assert resp["data"]["spec"] == "## spec md"
    assert resp["data"]["sections"] == [{"title": "API 契约"}]
    assert resp["data"]["stats"] == {"files": 3}
    assert resp["data"]["durationMs"] == 120
    # 参数透传
    kw = generator.generate_kwargs
    assert kw["workspace_path"] == "/work"
    assert kw["scope"] == {"type": "workspace", "path": None}
    assert kw["include_dependencies"] is True
    assert kw["languages"] == ["python"]


async def test_spec_generate_scope_file(generator):
    generator.generate_result = SpecResult("s", [], {}, 1)
    await spec_generate(_req(scope={"type": "file", "path": "a.py"}))
    assert generator.generate_kwargs["scope"] == {"type": "file", "path": "a.py"}


async def test_spec_generate_error(generator, monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("ast 解析失败")

    monkeypatch.setattr(generator, "generate", boom)
    resp = await spec_generate(_req())
    assert resp["code"] == 1
    assert "spec 生成失败" in resp["message"]
    assert "RuntimeError" in resp["message"]
    assert "ast 解析失败" in resp["message"]
    assert resp["data"] is None


def test_spec_generate_body_validation():
    with pytest.raises(ValidationError):
        SpecGenerateRequest()  # workspacePath 必填(无默认值)


# ---------------------------------------------------------------------------
# POST /spec/apply
# ---------------------------------------------------------------------------


async def test_spec_apply_success(generator):
    generator.apply_result = {
        "patch": "--- a/x.py\n+++ b/x.py",
        "affectedFiles": ["x.py"],
        "summary": "改了一处",
        "error": "llm_unavailable",  # LLM 不可用时仍 code=0,由 API 端降级
    }
    resp = await spec_apply(_apply_req(oldSpec="old"))
    assert resp["code"] == 0
    assert resp["data"] == generator.apply_result
    kw = generator.apply_kwargs
    assert kw["workspace_path"] == "/work"
    assert kw["new_spec"] == "## spec"
    assert kw["old_spec"] == "old"
    assert kw["scope"] == {"type": "workspace", "path": None}


async def test_spec_apply_error(generator, monkeypatch):
    async def boom(**kwargs):
        raise ValueError("diff 生成失败")

    monkeypatch.setattr(generator, "apply_spec", boom)
    resp = await spec_apply(_apply_req())
    assert resp["code"] == 1
    assert "spec apply 失败" in resp["message"]
    assert "diff 生成失败" in resp["message"]
    assert resp["data"] is None


def test_spec_apply_body_validation():
    with pytest.raises(ValidationError):
        SpecApplyRequest()  # workspacePath + newSpec 必填(无默认值)
