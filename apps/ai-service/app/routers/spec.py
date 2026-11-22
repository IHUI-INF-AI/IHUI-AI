# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Spec 路由(2026-07-22 新增)。

端点:
- POST /spec/generate   → 从代码 AST 反向生成 spec 文档(markdown)
- GET  /spec/templates  → 返回预置 spec 模板列表
- POST /spec/apply      → 根据 spec markdown 生成代码 patch(unified diff)

注册到 app.include_router(spec.router, prefix="/api", tags=["spec"]),
对外路径为 /api/spec/generate、/api/spec/templates、/api/spec/apply。
"""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.spec_generator import spec_generator
from ..services.workspace_roots import assert_workspace_root, is_inside_root

router = APIRouter()


class SpecScopeModel(BaseModel):
    """Spec 生成范围(契约与 packages/types SpecScope 一致)。"""

    type: str = Field("workspace", description="范围类型: file / dir / workspace")
    path: str | None = Field(None, description="目标路径(file/dir 相对工作区根;workspace 可省略)")


class SpecGenerateRequest(BaseModel):
    """Spec 生成请求(契约与 packages/types SpecGenerateInput 一致)。"""

    scope: SpecScopeModel = Field(default_factory=SpecScopeModel)
    workspacePath: str = Field(..., description="工作区根路径(绝对路径)")
    includeDependencies: bool = Field(True, description="是否包含依赖关系分析")
    languages: list[str] | None = Field(None, description="目标语言过滤(为空则全语言)")


class SpecApplyRequest(BaseModel):
    """Spec apply 请求(契约与 apps/api spec-service.ts SpecApplyResult 对齐)。

    根据 spec markdown 生成代码 patch 的 spec/apply 链路。
    """

    workspacePath: str = Field(..., description="工作区根路径(绝对路径)")
    scope: SpecScopeModel = Field(default_factory=SpecScopeModel)
    newSpec: str = Field(..., description="修改后的 spec markdown")
    oldSpec: str | None = Field(None, description="旧 spec(为空则从 .ihui-agent/specs/ 加载持久化版本)")


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


def _validate_request_paths(
    workspace_path: str, scope: SpecScopeModel
) -> tuple[str, dict[str, Any]]:
    """AIS-037:入口校验工作区白名单与 scope 越界,返回 (归一工作区根, scope dict)。

    - workspacePath 必须落在服务端 IHUI_WORKSPACE_ROOTS 白名单(assert_workspace_root,
      与 knowledge/lsp 端点同一单源判据);未登记/越界 → 400,env 未配置同样 400(fail-closed)。
    - scope.path 必须是**相对**路径且 resolve 后仍在该工作区内:spec_generator 的
      `_collect_files_report` 对绝对路径直接 `Path(scope_path)` 绕开根,`..` 回跳同理,
      不拦在入口就会跨工作区枚举/落盘。
    错误 detail 不回显服务端登记根(workspace_roots 约定:detail 会原样回吐给客户端)。
    """
    root = assert_workspace_root(workspace_path)
    data = scope.model_dump()
    raw = data.get("path")
    if raw:
        p = Path(str(raw))
        if p.is_absolute() or p.drive:
            raise HTTPException(status_code=400, detail="scope.path 必须是工作区内的相对路径")
        if not is_inside_root((Path(root) / p).resolve(), root):
            raise HTTPException(status_code=400, detail="scope.path 超出工作区范围")
    return root, data


@router.post("/spec/generate")
async def spec_generate(req: SpecGenerateRequest) -> dict[str, Any]:
    """从代码 AST 反向生成 spec 文档。

    返回格式与 ApiResponse 一致:`{ code, message, data }`。
    data 字段含 spec(markdown)/ sections / stats / durationMs。

    AIS-037:白名单/scope 校验放在 try **之外** —— 校验失败以 HTTPException 400 直抛,
    不被下面的 except Exception 吞成 code=1(与 knowledge 端点同形)。
    """
    workspace_path, scope = _validate_request_paths(req.workspacePath, req.scope)
    try:
        result = await spec_generator.generate(
            workspace_path=workspace_path,
            scope=scope,
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
    """根据 spec markdown 生成代码 patch(unified diff 格式)。

    调 spec_generator.apply_spec,LLM 不可用时 result 含 error='llm_unavailable',
    端点仍返回 code=0(不抛异常),由 API 端 spec-service.ts 检查 data.error 降级处理。

    响应 data 字段:{ patch, affectedFiles, summary, error? }

    AIS-037:同 spec_generate,白名单/scope 校验在 try 之外,失败 400 直抛。
    """
    workspace_path, scope = _validate_request_paths(req.workspacePath, req.scope)
    try:
        result = await spec_generator.apply_spec(
            workspace_path=workspace_path,
            scope=scope,
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
