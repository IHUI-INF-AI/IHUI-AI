# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""超工慢路径判定端点(RP-42)——recorded 积压的"该不该动手"模型判断。

行为对照 DeepSeek dsh-superagent 两级过滤第二级(规则快筛后交模型判断)的设计;
本文件为自写实现。判定只是建议:是否开工的门在控制面(shared 引擎)按策略档位与
"人点名优先"语义裁决，本端点不授权、不开工、不持工单状态。

身份纪律(§5):user_id 从承载层 require_request_user_id 进来，不信任请求体;
每条待判文本必须点名请求者(requesters)才入判——资格不符整批拒(403)，
不静默过滤(失效方向=多要一次定向说明，§0.10)。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Sequence
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.default_model import default_chat_model
from app.core.jwt_auth import require_request_user_id
from app.core.llm_gateway import llm_gateway
from app.services.llm_budget_governor import llm_budget_governor

logger = logging.getLogger(__name__)

router = APIRouter()

# 判定超时默认 120s，可用 IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S 配置并夹在 30–600s：
# 原型据此给慢路径留足模型思考时间；下限 30s 防抖动，上限 600s 防单次调用长期占住
# 一个并发槽拖垮整轮。
_DEFAULT_JUDGE_TIMEOUT_S = 120.0
_TIMEOUT_MIN_S = 30.0
_TIMEOUT_MAX_S = 600.0
_BATCH_MAX = 20
_REASON_MAX = 200
_ITEM_TEXT_MAX = 4000
_WINDOW_MAX = 10
_COMPANION_MAX = 10
_TICKET_MAX = 5
# 单次判定输出 token 上限：批量 ≤20 条、每条一行 JSON（含规则逐条评估），1000 覆盖最坏情况；
# 上限的作用是防模型跑题输出长文把单次成本放大。
_MAX_OUTPUT_TOKENS = 1000
_BUDGET_PILLAR = "subagent"
_BUDGET_ACTION = "super_agent_slow_path"

_DECISIONS = ("accept", "ignore", "unavailable")
_TARGET_BASES = ("specified", "existing-standard", "undetermined")


def _judge_timeout_seconds() -> float:
    """环境变量配置超时，夹在 30–600s；非法值回落默认 120s。"""
    raw = os.getenv("IHUI_SUPER_AGENT_SLOW_JUDGE_TIMEOUT_S")
    try:
        value = float(raw) if raw else _DEFAULT_JUDGE_TIMEOUT_S
    except ValueError:
        value = _DEFAULT_JUDGE_TIMEOUT_S
    return min(_TIMEOUT_MAX_S, max(_TIMEOUT_MIN_S, value))


class ThreadMessage(BaseModel):
    actor_id: str = Field(max_length=200)
    from_bot: bool
    addressed: bool
    text: str = Field(max_length=_ITEM_TEXT_MAX)


class RelatedTicket(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(max_length=300)
    scope: str = Field(max_length=2000)
    strength: str = Field(max_length=20)
    stage: str = Field(max_length=40)


class Companion(BaseModel):
    id: str = Field(max_length=200)
    text: str = Field(max_length=_ITEM_TEXT_MAX)


class JudgeItem(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=8000)
    observed_at: int = Field(ge=0)
    requesters: list[str] = Field(min_length=1, max_length=20)
    # 启用规则：模型必须逐条给出 matched 判定，一条都不能漏。
    enabled_rules: list[str] = Field(default_factory=list, max_length=50)
    # 上下文三件套（有界）：批内同伴、相关工单、同线程最近消息。
    companions: list[Companion] = Field(default_factory=list, max_length=_COMPANION_MAX)
    related_tickets: list[RelatedTicket] = Field(default_factory=list, max_length=_TICKET_MAX)
    thread_window: list[ThreadMessage] = Field(default_factory=list, max_length=_WINDOW_MAX)


class SlowPathJudgeRequest(BaseModel):
    items: list[JudgeItem] = Field(min_length=1, max_length=_BATCH_MAX)


def _field(item: JudgeItem | dict[str, object], name: str) -> object:
    """兼容 pydantic 实例与 dict 两形态(端点路径给模型对象;判据直测可喂 dict)。"""
    return getattr(item, name, None) if not isinstance(item, dict) else item.get(name)


def _render_context(it: JudgeItem | dict[str, object]) -> list[str]:
    """把有界上下文折成 prompt 行；无上下文不写空壳行。"""
    lines: list[str] = []
    comps: Any = _field(it, "companions") or []
    if comps:
        lines.append("  批内同伴: " + " | ".join(f"{_cfield(c, 'id')}={_cfield(c, 'text')}" for c in comps))
    tickets: Any = _field(it, "related_tickets") or []
    if tickets:
        lines.append(
            "  相关工单: "
            + " | ".join(
                f"{_cfield(t, 'id')}[{_cfield(t, 'stage')}/{_cfield(t, 'strength')}]={_cfield(t, 'title')}"
                for t in tickets
            )
        )
    window: Any = _field(it, "thread_window") or []
    if window:
        lines.append(
            "  线程窗口: "
            + " | ".join(
                f"{_cfield(m, 'actor_id')}{'🤖' if _cfield(m, 'from_bot') else ''}: {_cfield(m, 'text')}"
                for m in window
            )
        )
    return lines


def _cfield(item: object, name: str) -> object:
    return getattr(item, name, None) if not isinstance(item, dict) else item.get(name)


def build_judge_prompt(items: Sequence[JudgeItem | dict[str, object]], user_id: str) -> str:
    """批量判定提示词:恰等长 JSON 数组，逐条完整 Assessment + 置信度。"""
    lines = [
        "你是超级智能体的值守判员。以下是旁观到的消息，人未点名要求动手。",
        f"判员身份(user_id): {user_id}",
        "对每条给出完整评估：",
        "- decision: accept=明确的求助/缺陷/可直接推进的工作请求；ignore=寒暄、通知、"
        "与请求者无关或无需动手；unavailable=上下文不足或无法判断。",
        "- rule_assessments: 对该条 enabled_rules 里的每一条规则各给一项，"
        "matched 为是否命中，reason 不超过 40 字；不得遗漏、不得新增规则。",
        "- direction: implementation_requested(是否明确要求实现)、"
        "target_basis(specified=请求已写明目标/existing-standard=沿用既有规范/"
        "undetermined=目标未定)、requires_design_decision(是否需人先做设计决策)、evidence。",
        "- intent_evidence: 支撑 accept 的原文证据；没有就留空串。",
        "- title/scope: 若开工，建议的标题与范围；worktree_name 可空。",
        "- reason: 一句话总理由；confidence: 0 到 1 的小数，拿不准就低于 0.7。",
        "只输出一个 JSON 数组，长度必须恰为 "
        f"{len(items)}，元素按输入顺序形如 "
        '{"id":"…","decision":"accept|ignore|unavailable","confidence":0.85,'
        '"rule_assessments":[{"rule_id":"…","matched":true,"reason":"…"}],'
        '"direction":{"implementation_requested":true,"target_basis":"specified",'
        '"requires_design_decision":false,"evidence":"…"},'
        '"intent_evidence":"…","title":"…","scope":"…","worktree_name":null,"reason":"…"}，'
        "不要输出其它任何文字。",
        "输入消息:",
    ]
    for it in items:
        rq: Any = _field(it, "requesters") or []
        who = "、".join(str(r) for r in rq)
        rules: Any = _field(it, "enabled_rules") or []
        rule_text = "、".join(str(c) for c in rules) if rules else "(无启用规则)"
        lines.append(
            f"- id={_field(it, 'id')} 请求者 [{who}] 启用规则 [{rule_text}] 内容: {_field(it, 'text')}"
        )
        lines.extend(_render_context(it))
    return "\n".join(lines)


def parse_judge_response(text: str, ids: list[str]) -> list[dict[str, object]]:
    """解析并硬校验:JSON 数组、id 集合等值、完整 Assessment 的字段/类型/词表。

    只做结构校验；规则条目是否与 enabled_rules 一一对应、direction 是否已定、
    置信度阈值等语义门槛留给控制面 shared 引擎统一判——两处各判一次会漂移，
    且引擎还要按 gate 记账。不满足 ⇒ raise（调用方按形状非法回 502，交上层记 unjudged）。
    """
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"响应不是 JSON: {exc}") from exc
    if not isinstance(data, list) or len(data) != len(ids):
        raise ValueError("响应数组长度与输入不匹配")
    got_ids = [str(row.get("id", "")) for row in data if isinstance(row, dict)]
    if sorted(got_ids) != sorted(ids):
        raise ValueError("响应 id 集合与输入不匹配")
    rows: list[dict[str, object]] = []
    for row in data:
        decision = str(row.get("decision", ""))
        if decision not in _DECISIONS:
            raise ValueError(f"非法 decision: {decision!r}")
        confidence = row.get("confidence")
        # bool 是 int 子类，必须显式排除，否则 true 会被当成 1.0 蒙过关。
        if (
            isinstance(confidence, bool)
            or not isinstance(confidence, (int, float))
            or not (0.0 <= float(confidence) <= 1.0)
        ):
            raise ValueError(f"非法 confidence: {confidence!r}")
        rows.append(
            {
                "id": str(row["id"]),
                "decision": decision,
                "confidence": float(confidence),
                "rule_assessments": _parse_rule_assessments(row.get("rule_assessments")),
                "direction": _parse_direction(row.get("direction")),
                "intent_evidence": _parse_str(row, "intent_evidence", _ITEM_TEXT_MAX),
                "title": _parse_str(row, "title", 300),
                "scope": _parse_str(row, "scope", 2000),
                "worktree_name": _parse_optional_str(row.get("worktree_name"), 200),
                "reason": str(row.get("reason", ""))[:_REASON_MAX],
            }
        )
    return rows


def _parse_str(row: dict[str, Any], key: str, limit: int) -> str:
    value = row.get(key, "")
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValueError(f"非法 {key}: {value!r}")
    return value[:limit]


def _parse_optional_str(value: object, limit: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"非法 worktree_name: {value!r}")
    return value[:limit]


def _parse_rule_assessments(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ValueError(f"非法 rule_assessments: {value!r}")
    out: list[dict[str, object]] = []
    for entry in value:
        if not isinstance(entry, dict):
            raise ValueError(f"非法 rule_assessment: {entry!r}")
        rule_id = entry.get("rule_id")
        matched = entry.get("matched")
        reason = entry.get("reason")
        if not isinstance(rule_id, str) or not isinstance(matched, bool) or not isinstance(reason, str):
            raise ValueError(f"非法 rule_assessment 字段: {entry!r}")
        out.append({"rule_id": rule_id, "matched": matched, "reason": reason[:_REASON_MAX]})
    return out


def _parse_direction(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"非法 direction: {value!r}")
    implemented = value.get("implementation_requested")
    basis = value.get("target_basis")
    needs_design = value.get("requires_design_decision")
    evidence = value.get("evidence", "")
    if not isinstance(implemented, bool) or not isinstance(needs_design, bool):
        raise ValueError(f"非法 direction 布尔字段: {value!r}")
    if basis not in _TARGET_BASES:
        raise ValueError(f"非法 target_basis: {basis!r}")
    if not isinstance(evidence, str):
        raise ValueError(f"非法 direction.evidence: {evidence!r}")
    return {
        "implementation_requested": implemented,
        "target_basis": basis,
        "requires_design_decision": needs_design,
        "evidence": evidence[:_ITEM_TEXT_MAX],
    }


@router.post("/super-agent/slow-path/judge")
async def slow_path_judge(
    req: SlowPathJudgeRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, object]:
    """对一批 recorded 消息跑模型判定。逐条 requesters 必须含判员身份，否则整批 403。"""
    for it in req.items:
        if user_id not in it.requesters:
            raise HTTPException(
                status_code=403,
                detail=f"item {it.id} 的请求者名单不含当前主体",
            )
    ids = [it.id for it in req.items]
    prompt = build_judge_prompt(req.items, user_id)
    # 复用既有支出预算：慢路径属 subagent 支柱。估 token 故意取偏大值
    # （prompt 字符数/2 + 输出上限），宁可在预算边缘少调一次，也不低估后打穿日额度。
    estimated_tokens = max(200, len(prompt) // 2) + _MAX_OUTPUT_TOKENS
    try:
        budget = await llm_budget_governor.check_budget(_BUDGET_PILLAR, estimated_tokens)
    except Exception as exc:  # noqa: BLE001 - 预算器内部降级不可用时按"判不了"处理
        logger.warning("slow-path judge budget check failed for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=503, detail="judge budget unavailable") from None
    if not budget.allowed:
        # fail-closed：预算硬停 ⇒ 不判、不开单；上层按 channel_error 记 unjudged。
        logger.warning("slow-path judge budget exceeded for user=%s: %s", user_id, budget.reason)
        raise HTTPException(status_code=429, detail=f"judge budget exceeded: {budget.reason}") from None
    model = budget.degrade_to_model or default_chat_model()
    try:
        result = await asyncio.wait_for(
            llm_gateway.complete(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                # 鉴权主体显式下传：llm_call_logs 只认这一个来源（§5 认证不等于授权）。
                billing_user_id=user_id,
                temperature=0.1,
                max_tokens=_MAX_OUTPUT_TOKENS,
            ),
            timeout=_judge_timeout_seconds(),
        )
    except TimeoutError:
        raise HTTPException(status_code=504, detail="judge timed out") from None
    except Exception as exc:  # noqa: BLE001 - 上游异常族不稳定,统一按失败兜底
        logger.warning("slow-path judge failed for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="judge generation failed") from None
    if result.get("stub"):
        # stub 是占位响应，不是判定结论；按不可用 fail-closed。
        raise HTTPException(status_code=503, detail="judge channel unavailable (stub)")
    if result.get("error"):
        logger.warning("slow-path judge gateway error for user=%s: %s", user_id, result["error"])
        raise HTTPException(status_code=502, detail="judge generation failed") from None
    model_used = str(result.get("model") or "")
    if not model_used:
        raise HTTPException(status_code=502, detail="judge missing model identity") from None
    text = str(result.get("content") or "")
    try:
        rows = parse_judge_response(text, ids)
    except ValueError as exc:
        # 形状不判 ⇒ 502 未判定(§0.3 取不到输入不记绿也不冒判过)。
        logger.warning("slow-path judge parse rejected for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail=f"judge response rejected: {exc}") from None
    usage = result.get("usage") or {}
    if isinstance(usage, dict):
        try:
            await llm_budget_governor.record_usage(
                pillar=_BUDGET_PILLAR,
                model=model_used,
                input_tokens=int(usage.get("prompt_tokens") or 0),
                output_tokens=int(usage.get("completion_tokens") or 0),
                action=_BUDGET_ACTION,
            )
        except Exception as exc:  # noqa: BLE001 - 记账失败不得反转已完成的判定
            logger.warning("slow-path judge record_usage failed for user=%s: %s", user_id, exc)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "model": model_used,
            "verdicts": {
                row["id"]: {
                    "decision": row["decision"],
                    "confidence": row["confidence"],
                    "rule_assessments": row["rule_assessments"],
                    "direction": row["direction"],
                    "intent_evidence": row["intent_evidence"],
                    "title": row["title"],
                    "scope": row["scope"],
                    "worktree_name": row["worktree_name"],
                    "reason": row["reason"],
                }
                for row in rows
            },
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
