"""Persona contracts 路由(3 端点)。

提供 persona 列表 + 详情 + 契约查询,对齐 CLI 端 contracts.ts。
已注册到 main.py(prefix=/api, tags=["personas"])。
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from ..services.persona_registry import (
    PERSONAS_CONTRACTS,
    get_persona_contract,
    list_persona_names,
)

router = APIRouter()


@router.get("/personas")
async def list_personas() -> dict[str, Any]:
    """列出全部 persona(名 + 描述)。"""
    items = [
        {"name": name, "description": contract.input_schema.get("description", "")}
        for name, contract in PERSONAS_CONTRACTS.items()
    ]
    return {"personas": items, "count": len(items)}


@router.get("/personas/{name}")
async def get_persona(name: str) -> dict[str, Any]:
    """获取单个 persona 详情(input_schema + output_schema)。"""
    contract = get_persona_contract(name)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"persona 不存在: {name}")
    return {
        "name": name,
        "description": contract.input_schema.get("description", ""),
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
