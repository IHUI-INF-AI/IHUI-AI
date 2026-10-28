# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

行为样本接入点(2026-09-29 G-805 接线,读侧 = /rules/auto-generate):
  - 已接:POST /rules(create)、PATCH /rules/:id(update)、DELETE /rules/:id(delete)
    三处走唯一出口 `rules_engine.record_rule_action_behavior`,身份取令牌主体。
  - **刻意未接**三档,各有一条不复述的理由:
      · POST /rules/match(→ apply):该端点由 agent loop 每条消息调用,给它加端点级
        身份依赖会改变"内部服务间调用是否需要带用户令牌"这一对外语义,而加写更会把
        一次 Redis HSET+HLEN(+HKEYS/HDEL)挂到消息热路径上 —— 属台账记的待拍板项,
        不得由本票顺手定。
      · POST /rules/:id/test:对不存在的规则同样会回结构化结果,按现状判不出"这次
        试探到底落在了谁的哪条规则上",写进样本表就是把噪声喂给模式统计。
      · POST /rules/:id/learn-feedback:它的 accepted/rejected 信号由
        `record_learn_feedback` 自述"用于未来 _extract_patterns 的优化",那是读侧的
        加权改造,另计一票,不在本票的"把生产者接上"范围内。
  - 未接档的存量事实:_track_behavior 的 action 词表里 match/feedback/apply 三档
    至今仍无写入方,所以读侧的模式统计只看得到 create/update/delete。
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id
from ..services.rules_engine import record_rule_action_behavior, rules_engine

router = APIRouter()


class RuleCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = None
    content: str = Field(..., min_length=1)
    scope: str = Field("global")
    agentId: str | None = None
    priority: int = Field(50, ge=0, le=100)
    enabled: bool = True
    matchType: str = Field("always")
    matchPattern: str | None = None


class RuleUpdateBody(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    scope: str | None = None
    agentId: str | None = None
    priority: int | None = Field(None, ge=0, le=100)
    enabled: bool | None = None
    matchType: str | None = None
    matchPattern: str | None = None


class RuleTestBody(BaseModel):
    message: str = Field(..., min_length=1)


class RuleMatchBody(BaseModel):
    message: str = Field(..., min_length=1)
    scope: str | None = None


class ResolveConflictsBody(BaseModel):
    conflicts: list[dict[str, Any]] = Field(..., description="detect_conflicts 输出的冲突列表")


class PredictEffectBody(BaseModel):
    dry_run_message: str = Field("", description="模拟消息")


class LearnFeedbackBody(BaseModel):
    feedback: str = Field(...)
    accepted: bool = Field(...)


@router.get("/rules")
async def list_rules() -> dict[str, Any]:
    """列出全部规则(按 priority DESC 排序)。"""
    rules = rules_engine.list_rules()
    return {
        "code": 0,
        "message": "success",
        "data": {
            "rules": [r.to_dict() for r in rules],
            "total": len(rules),
        },
    }


@router.post("/rules")
async def create_rule(
    body: RuleCreateBody,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """创建规则,并把这次动作计入该用户的行为样本(G-805 接线)。

    身份 = **令牌主体**,与 `/rules/auto-generate` 用同一份出口
    (`require_request_user_id`),不新造第二套身份判定。此前本文件除 auto-generate
    外的端点一个身份都没有,于是行为样本的生产侧无处可写 —— `_record_audit` 的 `user`
    形参自述"router 层可传入实际用户",而 router 从未传过(现值恒为默认 "system")。
    """
    rule = rules_engine.create(body.model_dump())
    if rule:
        await record_rule_action_behavior(
            principal, "create", rule.id, {"scope": rule.scope}
        )
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.post("/rules/auto-generate")
async def auto_generate_rules(
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """基于行为模式自动生成规则草稿(不自动创建,返回草稿供用户确认)。

    身份来源 = **令牌主体**(2026-09-25 安全收口,认证 ≠ 授权)。此前该端点把 user_id
    当请求体字段收并原样喂给引擎,全文件零处与 request.state.user_id 比对 ⇒ 任何已登录
    用户填别人的 UUID 就能读他人行为模式并生成规则草稿。现请求体**不再有身份键**
    (`AutoGenerateBody` 已删 —— 留一个"可传但忽略"的 user_id 在本仓判为没修),
    归属只由 `require_request_user_id`(`app/core/jwt_auth.py`,与 /api/memory 同一份
    出口,不新造第二套身份判定)解析:
      - 生产态无身份 → 401(该判定在依赖里完成,**先于**本函数的 try 块,故不会被
        `except Exception` 吞成 {"code":500} —— 401 结论必须是 401);
      - 客户端在 body 里塞谁的 id 都不参与决定(无模型消费该字段)。
    引擎返回形状不变 [{pattern, draft_rule:{name,description,content,scope}, confidence}]。
    """
    try:
        data = await rules_engine.auto_generate_rules(principal)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/rules/resolve-conflicts")
async def resolve_conflicts(body: ResolveConflictsBody) -> dict[str, Any]:
    """LLM 仲裁冲突规则,失败降级为按 created_at 时间戳保留较新规则。"""
    try:
        data = await rules_engine._auto_resolve_conflicts(body.conflicts)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/rules/knowledge-graph")
async def build_knowledge_graph(scope: str | None = None) -> dict[str, Any]:
    """构建规则知识图谱(基于 embedding cosine 相似度)。"""
    try:
        data = await rules_engine._build_knowledge_graph(scope)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/rules/{rule_id}")
async def get_rule(rule_id: str) -> dict[str, Any]:
    """获取单个规则。"""
    rule = rules_engine.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    body: RuleUpdateBody,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """更新规则(部分字段)+ 行为样本(同 create,身份取令牌主体)。"""
    data = body.model_dump(exclude_none=True)
    rule = rules_engine.update(rule_id, data)
    if not rule:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    await record_rule_action_behavior(
        principal, "update", rule.id, {"scope": rule.scope}
    )
    return {"code": 0, "message": "success", "data": rule.to_dict()}


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """删除规则 + 行为样本(同 create,身份取令牌主体)。

    details 刻意不带 scope:规则此时已从存储里消失,现读它的 scope 要么多发一次查询、
    要么用删除前缓存的旧值造出第二份真相 —— 读侧 `_extract_patterns_statistical`
    对缺失 scope 归一到 "global",与删除动作的语义无冲突,所以留空。
    """
    deleted = rules_engine.delete(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"规则不存在: {rule_id}")
    await record_rule_action_behavior(principal, "delete", rule_id)
    return {"code": 0, "message": "success", "data": {"id": rule_id, "deleted": True}}


@router.post("/rules/{rule_id}/test")
async def test_rule(rule_id: str, body: RuleTestBody) -> dict[str, Any]:
    """测试规则是否匹配某消息。"""
    result = rules_engine.test(rule_id, body.message)
    return {"code": 0, "message": "success", "data": result}


@router.post("/rules/{rule_id}/predict-effect")
async def predict_effect(rule_id: str, body: PredictEffectBody) -> dict[str, Any]:
    """预测规则应用效果(LLM 预测,失败降级为历史统计)。"""
    try:
        data = await rules_engine.predict_effect(rule_id, body.dry_run_message)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/rules/{rule_id}/learn-feedback")
async def learn_feedback(rule_id: str, body: LearnFeedbackBody) -> dict[str, Any]:
    """记录用户对自动生成规则的反馈(accepted=True 采纳 / False 拒绝)。"""
    try:
        ok = await rules_engine.record_learn_feedback(rule_id, body.feedback, body.accepted)
        return {"code": 0, "message": "success", "data": {"ok": ok}}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/rules/match")
async def match_rules(body: RuleMatchBody) -> dict[str, Any]:
    """匹配消息,返回应用规则 + prompt 后缀(供 agent loop 调用)。"""
    result = rules_engine.apply(body.message, body.scope)
    return {"code": 0, "message": "success", "data": result}


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
