"""Spec 路由(2026-07-22 新增,对标 Trae IDE Spec 模式)。

端点:
- POST /spec/generate   → 从代码 AST 反向生成 spec 文档(markdown)
- GET  /spec/templates  → 返回预置 spec 模板列表
- POST /spec/apply      → 根据 spec markdown 生成代码 patch(unified diff,对标 Trae Work)

注册到 app.include_router(spec.router, prefix="/api", tags=["spec"]),
对外路径为 /api/spec/generate、/api/spec/templates、/api/spec/apply。
"""

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.spec_generator import spec_generator

router = APIRouter()


class SpecScopeModel(BaseModel):
    """Spec 生成范围(契约与 packages/types SpecScope 一致)。"""

    type: str = Field("workspace", description="范围类型: file / dir / workspace")
    path: Optional[str] = Field(None, description="目标路径(file/dir 相对工作区根;workspace 可省略)")


class SpecGenerateRequest(BaseModel):
    """Spec 生成请求(契约与 packages/types SpecGenerateInput 一致)。"""

    scope: SpecScopeModel = Field(default_factory=SpecScopeModel)
    workspacePath: str = Field(..., description="工作区根路径(绝对路径)")
    includeDependencies: bool = Field(True, description="是否包含依赖关系分析")
    languages: Optional[list[str]] = Field(None, description="目标语言过滤(为空则全语言)")


class SpecApplyRequest(BaseModel):
    """Spec apply 请求(契约与 apps/api spec-service.ts SpecApplyResult 对齐)。

    根据 spec markdown 生成代码 patch,对标 Trae Work 的 spec/apply 链路。
    """

    workspacePath: str = Field(..., description="工作区根路径(绝对路径)")
    scope: SpecScopeModel = Field(default_factory=SpecScopeModel)
    newSpec: str = Field(..., description="修改后的 spec markdown")
    oldSpec: Optional[str] = Field(None, description="旧 spec(为空则从 .trae-cn/specs/ 加载持久化版本)")


class SpecTemplateModel(BaseModel):
    """Spec 模板。"""

    id: str
    name: str
    description: str
    sections: list[str]


# 预置模板(与 packages/types SpecTemplate 语义一致)
_BUILTIN_TEMPLATES: list[SpecTemplateModel] = [
    SpecTemplateModel(
        id="full",
        name="完整规格",
        description="概述 + 模块结构 + API 契约 + 数据模型 + 依赖关系(默认)",
        sections=["概述", "模块结构", "API 契约", "数据模型", "依赖关系"],
    ),
    SpecTemplateModel(
        id="api-only",
        name="API 契约",
        description="仅提取 API endpoint,生成接口文档",
        sections=["概述", "API 契约"],
    ),
    SpecTemplateModel(
        id="schema-only",
        name="数据模型",
        description="仅提取数据库表 / schema,生成数据字典",
        sections=["概述", "数据模型"],
    ),
    SpecTemplateModel(
        id="module-overview",
        name="模块概览",
        description="仅模块结构与符号清单,快速了解代码组织",
        sections=["概述", "模块结构"],
    ),
]


@router.post("/spec/generate")
async def spec_generate(req: SpecGenerateRequest) -> dict[str, Any]:
    """从代码 AST 反向生成 spec 文档。

    返回格式与 ApiResponse 一致:`{ code, message, data }`。
    data 字段含 spec(markdown)/ sections / stats / durationMs。
    """
    try:
        result = await spec_generator.generate(
            workspace_path=req.workspacePath,
            scope=req.scope.model_dump(),
            include_dependencies=req.includeDependencies,
            languages=req.languages,
        )
        return {
            "code": 0,
            "message": "success",
            "data": {
                "spec": result.spec,
                "sections": result.sections,
                "stats": result.stats,
                "durationMs": result.duration_ms,
            },
        }
    except Exception as e:
        err_type = type(e).__name__
        return {
            "code": 1,
            "message": f"spec 生成失败: {err_type}: {str(e)[:200]}",
            "data": None,
        }


@router.get("/spec/templates")
async def spec_templates() -> dict[str, Any]:
    """返回预置 spec 模板列表。"""
    return {
        "code": 0,
        "message": "success",
        "data": {
            "templates": [t.model_dump() for t in _BUILTIN_TEMPLATES],
        },
    }


@router.post("/spec/apply")
async def spec_apply(req: SpecApplyRequest) -> dict[str, Any]:
    """根据 spec markdown 生成代码 patch(unified diff 格式,对标 Trae Work)。

    调 spec_generator.apply_spec,LLM 不可用时 result 含 error='llm_unavailable',
    端点仍返回 code=0(不抛异常),由 API 端 spec-service.ts 检查 data.error 降级处理。

    响应 data 字段:{ patch, affectedFiles, summary, error? }
    """
    try:
        result = await spec_generator.apply_spec(
            workspace_path=req.workspacePath,
            scope=req.scope.model_dump(),
            new_spec=req.newSpec,
            old_spec=req.oldSpec,
        )
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        return {
            "code": 1,
            "message": f"spec apply 失败: {type(e).__name__}: {str(e)[:200]}",
            "data": None,
        }
