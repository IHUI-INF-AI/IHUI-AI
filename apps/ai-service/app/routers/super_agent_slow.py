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
from collections.abc import Sequence
from typing import Any

import litellm
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.jwt_auth import require_request_user_id

logger = logging.getLogger(__name__)

router = APIRouter()

_JUDGE_TIMEOUT_S = 90.0
_BATCH_MAX = 20
_REASON_MAX = 200

_VERDICTS = ("act", "ignore", "unclear")


class JudgeItem(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=8000)
    observed_at: int = Field(ge=0)
    requesters: list[str] = Field(min_length=1, max_length=20)


class SlowPathJudgeRequest(BaseModel):
    items: list[JudgeItem] = Field(min_length=1, max_length=_BATCH_MAX)


def _field(item: "JudgeItem | dict[str, object]", name: str) -> object:
    """兼容 pydantic 实例与 dict 两形态(端点路径给模型对象;判据直测可喂 dict)。"""
    return getattr(item, name, None) if not isinstance(item, dict) else item.get(name)


def build_judge_prompt(items: "Sequence[JudgeItem | dict[str, object]]", user_id: str) -> str:
    """批量判定提示词:要求恰等长 JSON 数组，逐条三值 + 简短理由。"""
    lines = [
        "你是超级智能体的值守判员。以下是旁观到的消息，人未点名要求动手。",
        f"判员身份(user_id): {user_id}",
        "对每条只回答:该不该现在为它开工(act=明确的求助/缺陷报告/可直接推进的工作请求;"
        "ignore=寒暄、通知、与请求者无关或无需动手;"
        "unclear=拿不准)，并给不超过 40 字的中文理由。",
        "只输出一个 JSON 数组，长度必须恰为 "
        f"{len(items)}，元素按输入顺序形如 "
        '{"id":"…","verdict":"act|ignore|unclear","reason":"…"}，'
        "不要输出其它任何文字。",
        "输入消息:",
    ]
    for it in items:
        rq: Any = _field(it, "requesters") or []
        who = "、".join(str(r) for r in rq)
        lines.append(
            f"- id={_field(it, 'id')} 请求者 [{who}] 内容: {_field(it, 'text')}"
        )
    return "\n".join(lines)


def parse_judge_response(text: str, ids: list[str]) -> list[dict[str, str]]:
    """解析并硬校验:JSON 数组、id 集合等值、verdict 词表、理由截断。不满足 ⇒ raise。"""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"响应不是 JSON: {exc}") from exc
    if not isinstance(data, list) or len(data) != len(ids):
        raise ValueError("响应数组长度与输入不匹配")
    got_ids = [str(row.get("id", "")) for row in data if isinstance(row, dict)]
    if sorted(got_ids) != sorted(ids):
        raise ValueError("响应 id 集合与输入不匹配")
    rows: list[dict[str, str]] = []
    for row in data:
        verdict = str(row.get("verdict", ""))
        if verdict not in _VERDICTS:
            raise ValueError(f"非法 verdict: {verdict!r}")
        reason = str(row.get("reason", ""))[:_REASON_MAX]
        rows.append({"id": str(row["id"]), "verdict": verdict, "reason": reason})
    return rows


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
    try:
        resp = await asyncio.wait_for(
            litellm.acompletion(
                model=settings.litellm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            ),
            timeout=_JUDGE_TIMEOUT_S,
        )
    except TimeoutError:
        raise HTTPException(status_code=504, detail="judge timed out") from None
    except Exception as exc:  # noqa: BLE001 - litellm 异常族不稳定,统一按上游失败兜底
        logger.warning("slow-path judge failed for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="judge generation failed") from None
    text = str(resp.choices[0].message.content or "")
    try:
        rows = parse_judge_response(text, ids)
    except ValueError as exc:
        # 形状不判 ⇒ 502 未判定(§0.3 取不到输入不记绿也不冒判过)。
        logger.warning("slow-path judge parse rejected for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail=f"judge response rejected: {exc}") from None
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "verdicts": {row["id"]: {"verdict": row["verdict"], "reason": row["reason"]} for row in rows}
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
