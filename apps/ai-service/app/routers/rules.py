"""Rules 路由 — CRUD + 测试 + 匹配应用。

端点:
  - GET    /rules              列出全部规则
  - POST   /rules              创建规则
  - GET    /rules/:id          获取单个规则
  - PATCH  /rules/:id          更新规则(部分字段)
  - DELETE /rules/:id          删除规则
  - POST   /rules/:id/test     测试规则是否匹配某消息
  - POST   /rules/match        匹配消息,返回应用规则 + prompt 后缀

注册到 main.py:app.include_router(rules.router, prefix="/api", tags=["rules"])
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.rules_engine import rules_engine

router = APIRouter()


class RuleCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    content: str = Field(..., min_length=1)
    scope: str = Field("global")
    agentId: Optional[str] = None
    priority: int = Field(50, ge=0, le=100)
    enabled: bool = True
    matchType: str = Field("always")
    matchPattern: Optional[str] = None


class RuleUpdateBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    scope: Optional[str] = None
    agentId: Optional[str] = None
    priority: Optional[int] = Field(None, ge=0, le=100)
    enabled: Optional[bool] = None
    matchType: Optional[str] = None
    matchPattern: Optional[str] = None


class RuleTestBody(BaseModel):
    message: str = Field(..., min_length=1)


class RuleMatchBody(BaseModel):
    message: str = Field(..., min_length=1)
    scope: Optional[str] = None


@router.get("/rules")
async def list_rules() -> dict[str, Any]:
    """列出全部规则(按 priority DESC 排序)。"""
    rules = rules_engine.list()
    return {
        "code": 0,
        "message": "success",
        "data": {
            "rules": [r.to_dict() for r in rules],
            "total": len(rules),
        },
    }


@router.post("/rules")
async def create_rule(body: RuleCreateBody) -> dict[str, Any]:
    """创建规则。"""
    rule = rules_engine.create(body.model_dump())
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.get("/rules/{rule_id}")
async def get_rule(rule_id: str) -> dict[str, Any]:
    """获取单个规则。"""
    rule = rules_engine.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: str, body: RuleUpdateBody) -> dict[str, Any]:
    """更新规则(部分字段)。"""
    data = body.model_dump(exclude_none=True)
    rule = rules_engine.update(rule_id, data)
    if not rule:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str) -> dict[str, Any]:
    """删除规则。"""
    deleted = rules_engine.delete(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    return {"code": 0, "message": "success", "data": {"id": rule_id, "deleted": True}}


@router.post("/rules/{rule_id}/test")
async def test_rule(rule_id: str, body: RuleTestBody) -> dict[str, Any]:
    """测试规则是否匹配某消息。"""
    result = rules_engine.test(rule_id, body.message)
    return {"code": 0, "message": "success", "data": result}


@router.post("/rules/match")
async def match_rules(body: RuleMatchBody) -> dict[str, Any]:
    """匹配消息,返回应用规则 + prompt 后缀(供 agent loop 调用)。"""
    result = rules_engine.apply(body.message, body.scope)
    return {"code": 0, "message": "success", "data": result}


__all__ = ["router"]
