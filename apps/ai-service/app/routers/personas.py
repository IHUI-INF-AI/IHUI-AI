# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Persona contracts 路由(3 端点)。

提供 persona 列表 + 详情 + 契约查询,对齐 CLI 端 contracts.ts。
已注册到 main.py(prefix=/api, tags=["personas"])。
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from ..services.persona_registry import (
    get_persona_contract,
    list_persona_names,
    persona_catalog,
)

router = APIRouter()


def _catalog_response() -> dict[str, Any]:
    """``/personas`` 与 ``/llm/personas`` 的同一响应体(单一投影出口)。"""
    items = persona_catalog()
    return {"personas": items, "count": len(items)}


@router.get("/personas")
async def list_personas() -> dict[str, Any]:
    """列出全部 persona(名 + 描述 + 工具白名单摘要)。

    D01(2026-10-25):``tools`` 供对话内 Agent 选择器展示"各自工具白名单摘要";
    唯一数据面仍是 ``PERSONAS_CONTRACTS``,此处只做投影。
    """
    return _catalog_response()


@router.get("/llm/personas")
async def list_personas_for_composer() -> dict[str, Any]:
    """D01:对话内 Agent 选择器数据源。

    单独给一条 ``/llm/*`` 路径,是为了复用 web 既有的 ``/api/llm/:path*`` 反代
    (next rewrites → ai-service),不必为选择器新增网关或反代规则;
    内容与 ``/personas`` 完全同源同形(``_catalog_response``)。
    """
    return _catalog_response()


@router.get("/personas/{name}")
async def get_persona(name: str) -> dict[str, Any]:
    """获取单个 persona 详情(input_schema + output_schema)。"""
    contract = get_persona_contract(name)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"persona 不存在: {name}")
    return {
        "name": name,
        "description": contract.input_schema.get("description", ""),
        "tools": list(contract.tools),
        "input_schema": contract.input_schema,
        "output_schema": contract.output_schema,
    }


@router.get("/personas/{name}/contract")
async def get_persona_contract_endpoint(name: str) -> dict[str, Any]:
    """获取 persona 输入/输出契约。"""
    contract = get_persona_contract(name)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"persona 不存在: {name}")
    return {
        "name": name,
        "input_schema": contract.input_schema,
        "output_schema": contract.output_schema,
    }


__all__ = ["router", "list_persona_names"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
