# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""advisor(G-11):指定另一个模型就某个子问题作答,带会话级次数预算。

对标(Trae/Qoder 的 advisor 型能力)之外的两条本仓纪律,不靠"约定"而靠代码:

1. **预算按 (属主, 会话) 计数** —— 超出即具名 ``ADVISOR_BUDGET_EXHAUSTED``,
   绝不静默降级成"少算一次"或"换个说辞再答"。``consume`` 先判后记:被拒的那次不计数,
   且 ``asyncio.Lock`` 覆盖"判-记"这一段 ⇒ 并发下不会超发(恰好放行 limit 次)。
2. **模型名 fail-closed** —— 调用方指定了模型就只认那一个:``_skip_fallback=True`` 关掉
   网关的 FallbackRouter / ComboRouter 自动改道;上游报错、或返回的模型名与请求不一致,
   一律 ``ADVISOR_MODEL_UNAVAILABLE``。回落会让"问 A 模型"拿到 B 模型的答案且调用方
   无从察觉 —— 这正是本能力最贵的一种失效。

身份只认承载层注入的 ``__user_id`` / ``__session_id``(模型不可控,自报即越权):
handler 层先经 ``agent_comm`` 的单源校验器判过再把结果传进来,本模块不自行认身份。

隐私:prompt 原文不进日志、不进错误体 —— 错误只回长度(``prompt_chars``);
本模块也不读、不回显任何密钥。
"""

from __future__ import annotations

import asyncio
from typing import Any

from ..core.llm_gateway import llm_gateway

# 一次咨询的默认次数上限;硬上界(与工具 schema 的 maximum 同源,不写第二份数字)
ADVISOR_MAX_USES_DEFAULT = 3
ADVISOR_MAX_USES_CAP = 10
# prompt 字符上限(超限即拒,不截断:截断会让模型答非所问且调用方不知道被改了)
ADVISOR_PROMPT_MAX_CHARS = 8000

# 预算键 = (属主, 会话):跨会话不共享,同一会话内跨轮共享
BudgetKey = tuple[str, str]


class AdvisorBudget:
    """进程内 (属主, 会话) 维度的咨询次数预算。

    取舍:计数住在进程内存,不是计费账本 —— 它防的是"一次会话内把子问题问爆",
    跨进程一致需要外部存储,那会让本能力依赖 DB 才可用(与本仓"取不到就不判定"
    相比,这里宁可选一个能被单测钉死的窄语义)。
    """

    def __init__(self) -> None:
        self._used: dict[BudgetKey, int] = {}
        self._lock = asyncio.Lock()

    async def consume(self, key: BudgetKey, limit: int) -> tuple[bool, int, int]:
        """先判后记:超限不记。返回 ``(allowed, used, remaining)``。"""
        async with self._lock:
            used = self._used.get(key, 0)
            if used >= limit:
                return False, used, 0
            used += 1
            self._used[key] = used
            return True, used, max(0, limit - used)


# 进程内唯一预算(测试可整枚替换;不提供第二份写入入口)
advisor_budget = AdvisorBudget()


def _limit_of(max_uses: object) -> int:
    """把调用方的 max_uses 收进 [1, ADVISOR_MAX_USES_CAP];非整数一律取默认。"""
    if isinstance(max_uses, bool) or not isinstance(max_uses, int):
        return ADVISOR_MAX_USES_DEFAULT
    return max(1, min(max_uses, ADVISOR_MAX_USES_CAP))


async def consult(
    *,
    principal: str,
    session_id: str,
    prompt: str,
    model: str | None = None,
    max_uses: int | None = None,
) -> dict[str, Any]:
    """就一个子问题向 ``model`` 咨询一次。

    返回形状:成功 ``{ok: True, content, model, used, remaining, stub, limit}``;
    失败 ``{ok: False, errorCode, error, ...}``,错误码只取下列具名值:
    ``ADVISOR_PROMPT_EMPTY`` / ``ADVISOR_PROMPT_TOO_LONG`` /
    ``ADVISOR_IDENTITY_REQUIRED`` / ``ADVISOR_BUDGET_EXHAUSTED`` /
    ``ADVISOR_MODEL_UNAVAILABLE``。

    预算语义:一次"真的发出了请求"的咨询计 1 次(含上游最后报错的那次 —— 请求已经
    发出去了);被预算拒绝的那次不计次。
    """
    text = prompt if isinstance(prompt, str) else ""
    prompt_chars = len(text)
    if not text.strip():
        return {
            "ok": False,
            "errorCode": "ADVISOR_PROMPT_EMPTY",
            "error": "prompt 不能为空",
            "prompt_chars": 0,
        }
    if prompt_chars > ADVISOR_PROMPT_MAX_CHARS:
        return {
            "ok": False,
            "errorCode": "ADVISOR_PROMPT_TOO_LONG",
            "error": f"prompt 超长({prompt_chars} 字符 > 上限 {ADVISOR_PROMPT_MAX_CHARS})",
            "prompt_chars": prompt_chars,
            "maxChars": ADVISOR_PROMPT_MAX_CHARS,
        }
    principal_id = str(principal or "").strip()
    session = str(session_id or "").strip()
    if not principal_id or not session:
        # 承载层没给身份就不该走到这里:仍给具名码,绝不猜一个"公共预算桶"
        return {
            "ok": False,
            "errorCode": "ADVISOR_IDENTITY_REQUIRED",
            "error": "缺少承载层注入的属主/会话标识",
        }

    requested = (model or "").strip() or None
    limit = _limit_of(max_uses)
    key: BudgetKey = (principal_id, session)
    allowed, used, remaining = await advisor_budget.consume(key, limit)
    if not allowed:
        return {
            "ok": False,
            "errorCode": "ADVISOR_BUDGET_EXHAUSTED",
            "error": f"本次会话的咨询次数已用尽(上限 {limit})",
            "model": requested,
            "used": used,
            "remaining": 0,
            "limit": limit,
        }

    messages = [{"role": "user", "content": text}]
    try:
        # 指定了模型就关掉网关自动改道:失败必须由调用方看见,不能悄悄换个模型答
        result = await llm_gateway.complete(
            messages, model=requested, _skip_fallback=bool(requested)
        )
    except Exception as exc:  # noqa: BLE001 - 上游异常同样必须具名失败,不得回落
        return {
            "ok": False,
            "errorCode": "ADVISOR_MODEL_UNAVAILABLE",
            "error": "咨询模型调用异常(未回落到默认模型)",
            "model": requested,
            "exceptionType": type(exc).__name__,
            "used": used,
            "remaining": remaining,
            "limit": limit,
        }
    if result.get("error"):
        return {
            "ok": False,
            "errorCode": "ADVISOR_MODEL_UNAVAILABLE",
            "error": "指定的咨询模型不可用(未回落到默认模型)",
            "model": requested,
            # 网关已脱敏的枚举码(LLM_ERROR / MODEL_NOT_CONFIGURED / ...);不回显上游原文
            "reason": str(result.get("errorCode") or "LLM_ERROR"),
            "used": used,
            "remaining": remaining,
            "limit": limit,
        }

    served = str(result.get("model") or requested or "")
    if requested and served and served != requested:
        # 防御性:即使网关某天改道却没报错,也不把别人的答案冒充成指定模型的答案
        return {
            "ok": False,
            "errorCode": "ADVISOR_MODEL_UNAVAILABLE",
            "error": "网关把请求改道到其他模型,按 fail-closed 拒绝采用该答案",
            "model": requested,
            "fallbackModel": served,
            "used": used,
            "remaining": remaining,
            "limit": limit,
        }

    content = result.get("content")
    return {
        "ok": True,
        "content": content if isinstance(content, str) else "",
        "model": served,
        "used": used,
        "remaining": remaining,
        "limit": limit,
        # stub=True 表示网关没配 key、给的是模拟响应 —— 如实透出,不冒充真答案
        "stub": bool(result.get("stub")),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
