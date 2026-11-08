# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·真实 LLM 判定 gateway 适配层（本仓自有实现）。

背景（P4 席位实证的不兼容）:
    ``judge.ModelJudge.score()`` 调用
    ``gateway.structured_completion(payload, model=...)`` 并期望返回
    ``{"scores": [{"key", "score"}]}``；而 ``app/core/llm_gateway.py`` 的真实签名是
    ``structured_completion(messages, schema, model=None, *, ...)`` —— 第二参是
    JSON Schema，返回值是「按 schema 解析后的 dict」或 ``{"error": True, ...}``。
    直接把 llm_gateway 单例塞给 ModelJudge 会 TypeError → 被降级自证路径吞掉
    → 永远 ``executed=False``。本模块把真实 gateway 包成 ModelJudge 期望的接口。

调用链::

    Sag2LexicalService.retrieve()
      → ModelJudge.score(question, candidates, evidence)
        → LlmGatewayJudgeAdapter.structured_completion(payload, model)   # 本模块
          → 组装 messages(criterion/question/evidence/candidates) + JSON Schema
          → await real.structured_completion(messages, schema, model=model)  # 真实签名
          → 严格归一 → {"scores": [{"key": str, "score": float}, ...]}
        → ModelJudge 读 scores → JudgeVerdict(executed=True / 诚实降级)

环境变量契约:
    SAG2_JUDGE_ENABLED : 1/true/yes/on（忽略大小写与空白）才开启；未设置或其它值
                         一律关闭。关闭时 ``resolve_sag2_gateway()`` 返回 None，
                         **不 import llm_gateway、不构造真实 gateway、不发起网络调用**。
    SAG2_JUDGE_MODEL   : 模型名常量住在 ``judge.JUDGE_MODEL_ENV``。由
                         ``judge.resolve_judge_from_settings`` 读取并写入
                         ``ModelJudge._model``，再经 ``score()`` 的 ``model=`` 透传到
                         本适配层，最终传给真实 gateway。本模块不重复解读该变量；
                         ``service._build_default_service()`` 在 attach 时按同一常量取值。

失败降级链（绝不伪造分数）:
    - 开关未开 / import 失败 / 单例为 None / 缺 structured_completion
        → ``resolve_sag2_gateway()`` 返回 None，模块级 ``last_resolve_reason`` 留可自证
          原因；service.py 保持 ``LexicalOnlyJudge``（诚实降级），status() 读得到原因。
    - 适配器调用期任何异常 / 返回畸形
        → 返回 ``{"scores": []}``，ModelJudge 走既有「空打分 ⇒ executed=False + reason」
          自证路径。只有 dict 且含合法 ``scores`` 才采信，顶层 list/字符串/None 等
          形态一律不猜语义、返回空，避免把畸形响应当成模型判定。
"""

from __future__ import annotations

import importlib
import json
import os
from typing import Any

from .judge import JUDGE_ENABLED_ENV

__all__ = [
    "LlmGatewayJudgeAdapter",
    "get_last_resolve_reason",
    "resolve_sag2_gateway",
]

DISABLED_REASON = (
    "SAG2_JUDGE_ENABLED 未开启;未构造真实 gateway(纯内存 + LexicalOnlyJudge)"
)
_TRUTHY_FLAGS = frozenset({"1", "true", "yes", "on"})

# 模块级、可自证的「最近一次 resolve 结论」。status() 经 get_last_resolve_reason() 读。
last_resolve_reason: str = DISABLED_REASON


def get_last_resolve_reason() -> str:
    """返回最近一次 resolve_sag2_gateway() 的降级原因；成功时为空串。"""
    return last_resolve_reason


def _env_enabled() -> bool:
    """读开关；与 judge._env_flag 口径一致（1/true/yes/on，忽略大小写与空白）。"""
    raw = os.environ.get(JUDGE_ENABLED_ENV)
    return raw is not None and raw.strip().lower() in _TRUTHY_FLAGS


def _import_gateway() -> Any:
    """惰性导入真实 gateway 单例；抽成函数便于测试替换、让异常被上层诚实捕获。"""
    module = importlib.import_module("app.core.llm_gateway")
    return getattr(module, "llm_gateway", None)


def resolve_sag2_gateway() -> Any | None:
    """取得真实 llm_gateway 单例；任何不确定都返回 None，绝不返回假装能用的 stub。

    - 未开启:只做 env 判断,不 import、不构造、不联网。
    - 开启但 import/单例异常:返回 None 并把原因写进 ``last_resolve_reason``。
    """
    global last_resolve_reason
    if not _env_enabled():
        last_resolve_reason = DISABLED_REASON
        return None
    try:
        gateway = _import_gateway()
    except Exception as exc:
        last_resolve_reason = (
            "SAG2_JUDGE_ENABLED 已开启但 llm_gateway 导入/初始化失败"
            f"({type(exc).__name__}: {exc});诚实降级为纯词法,不构造 stub"
        )
        return None
    if gateway is None:
        last_resolve_reason = (
            "SAG2_JUDGE_ENABLED 已开启但模块级单例 llm_gateway 为 None;"
            "诚实降级为纯词法,不构造 stub"
        )
        return None
    if not callable(getattr(gateway, "structured_completion", None)):
        last_resolve_reason = (
            "SAG2_JUDGE_ENABLED 已开启但取到的对象缺 structured_completion;"
            "诚实降级为纯词法,不构造 stub"
        )
        return None
    last_resolve_reason = ""
    return gateway


# JSON Schema：要求 LLM 返回 {"scores": [{"key": str, "score": number}]}。
# required / additionalProperties 与 llm_gateway 的 strict + required 校验对齐。
_SCORES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "score": {"type": "number"},
                },
                "required": ["key", "score"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["scores"],
    "additionalProperties": False,
}


def _build_messages(payload: dict[str, Any]) -> list[dict[str, str]]:
    """把 ModelJudge 的 payload 组装成 OpenAI messages，四项字段全部带进文本。"""
    criterion = str(payload.get("criterion", "") or "")
    body = json.dumps(
        {
            "criterion": criterion,
            "question": str(payload.get("question", "") or ""),
            "evidence": payload.get("evidence", []),
            "candidates": payload.get("candidates", []),
        },
        ensure_ascii=False,
        default=str,
    )
    system = (
        "You are an evidence judge for a lexical retrieval channel. "
        + criterion
        + " Score each candidate's necessity as evidence in [0,1]. "
        + "Return JSON matching the provided schema: scores=[{key,score}]."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": body},
    ]


def _coerce(raw: Any) -> Any:
    """把 gateway 返回值还原成可解析对象：dict/list/None/JSON 字符串/Pydantic 模型。"""
    if isinstance(raw, str):
        return json.loads(raw)
    if isinstance(raw, (dict, list)) or raw is None:
        return raw
    for name in ("model_dump", "dict"):
        fn = getattr(raw, name, None)
        if callable(fn):
            return fn()
    return None


def _extract_items(raw: Any) -> Any:
    """只认 dict 且带 scores 键；其余形态（含顶层 list）一律返回空列表。"""
    obj = _coerce(raw)
    if isinstance(obj, dict):
        if obj.get("error"):
            return []
        return obj.get("scores") or []
    return []


def _normalize(raw: Any) -> dict[str, Any]:
    """严格归一：只采信 key 存在、score 能转 float 且落在 [0,1] 的项。"""
    items = _extract_items(raw)
    if not isinstance(items, list):
        return {"scores": []}
    scores: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict) or "key" not in item or "score" not in item:
            continue
        try:
            value = float(item["score"])
        except (TypeError, ValueError):
            continue
        if not (0.0 <= value <= 1.0):
            continue
        scores.append({"key": str(item["key"]), "score": value})
    return {"scores": scores}


class LlmGatewayJudgeAdapter:
    """把真实 llm_gateway 适配成 ModelJudge 期望的 structured_completion(payload, model=...)。"""

    def __init__(self, gateway: Any) -> None:
        self._gateway = gateway

    async def structured_completion(
        self, payload: dict[str, Any], model: str | None = None
    ) -> dict[str, Any]:
        """组装 messages + JSON Schema 调真实 gateway，返回严格归一的 {"scores": [...]}。

        任何异常 / 畸形返回都收敛为 ``{"scores": []}``，由 ModelJudge 走既有诚实降级路径，
        绝不伪造分数、绝不把异常抛成「已判定」。
        """
        try:
            messages = _build_messages(payload)
            raw = await self._gateway.structured_completion(
                messages, _SCORES_SCHEMA, model=model
            )
            return _normalize(raw)
        except Exception:  # 降级必须响，绝不把异常或畸形当成模型判定
            return {"scores": []}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
