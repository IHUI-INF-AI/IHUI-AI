# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目标完成度的独立校验轮(AGENTS.md §8 第 3 步的落地实现)。

§8 从建仓起就写着"独立评估校验(基于真实结果,**禁止模型自评 yes**)",但仓库里
只有 `self_evaluator.py` —— 那是**执行模型给自己打分**,恰好是 §8 禁止的那一种。
本模块补的是缺失的那一环,三条硬设计:

1. **机器能测的一律不交给模型判**。每条硬性指标预先声明"如何被证实",调用方把
   真实采集到的证据(命令退出码 / 文件状态 / 测试结果 / HTTP 响应)一并交上来。
   证据里带机器结论(`ok` 非 None)的条目由本模块**直接判**,judge 碰不到它 ——
   否则等于让被考核者改判考卷。
2. **剩下的语义项才另起一次独立模型请求**,与执行轮完全分离:不同 system prompt、
   不给它"我已完成"的权力(只能逐条 met/unmet + 引用证据 id),整体结论由代码
   按"全部 required 项 met"合成。judge 说 "achieved" 不算数,代码说不算才算。
3. **判定不可用时不得静默判完成**。模型调用失败 / 输出解析不出 / 证据没采到 /
   judge 模型与执行模型是同一个(独立性不成立) —— 四类都归 `undetermined`,
   并且明确写出原因。`undetermined` 在调用方语义里**必须按未完成处理**。

不碰数据库、不碰网络(除 judge),因此可离线单测,不违反 §5 测试隔离铁律。
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Final, Literal

logger = logging.getLogger(__name__)

VerdictStatus = Literal["achieved", "not_achieved", "undetermined"]
CriterionBasis = Literal["machine", "judge", "missing-evidence"]
EvidenceOutcome = Literal["met", "unmet", "unknown"]

#: 单条证据摘录上限(字符)。judge 上下文里塞全量输出会把"它看过的那段"变成
#: 随机窗口,不如给足定性信息 + 明确告知被截断。
MAX_EXCERPT_CHARS: Final[int] = 1200

#: judge 请求的固定前缀 —— 独立性判据之一(与执行轮的 system prompt 不同源)
JUDGE_SYSTEM_PROMPT: Final[str] = (
    "你是独立交付校验员,不是执行者本人,也不为执行者辩护。\n"
    "你的任务只有两件:① 逐条判定预先声明的硬性指标是否被**证据**支持;"
    "② 对无法由证据支持的条目判 unmet。\n"
    "规则:\n"
    "1. 不得因为执行者自称完成就判 met。\n"
    "2. 每条判定必须引用至少一个 evidence_id;引用不出来就是 unmet。\n"
    "3. 证据被标记 truncated 时,若截断部分可能影响结论,判 unmet 并说明。\n"
    "4. 只输出 JSON 数组,不要 markdown 包裹,形如:\n"
    '   [{"criterion_id":"...","verdict":"met|unmet","reason":"...","evidence_ids":["..."]}]\n'
    "5. 数组必须覆盖给你的每一条指标,不得增删 id。"
)


@dataclass(frozen=True)
class HardCriterion:
    """一条预先声明的硬性指标(声明必须先于执行,否则判定口径可被事后挪动)。"""

    id: str
    statement: str
    #: 证据采集方式(自由词表,用于人读与 UI 分组):command/file/test/http/manual…
    evidence_kind: str = "manual"
    #: required=False 的条目不计入整体结论(软性指标)
    required: bool = True


@dataclass(frozen=True)
class EvidenceRecord:
    """一条真实采集到的证据(由调用方在采集侧构造,本模块不猜、不补、不美化)。"""

    id: str
    criterion_id: str
    source: str
    #: 机器可判结论:True/False 直接定案;None = 这条只能靠语义判定
    outcome: bool | None = None
    excerpt: str = ""
    #: 采集失败(命令没跑成 / 文件读不到)时写原因,证据视同不存在
    unavailable_reason: str | None = None
    truncated: bool = False
    captured_at: float = 0.0


@dataclass(frozen=True)
class CriterionVerdict:
    criterion_id: str
    verdict: EvidenceOutcome
    basis: CriterionBasis
    reason: str
    evidence_ids: tuple[str, ...] = ()
    #: 机器结论与 judge 结论冲突时置 True(两说,必须人工看)
    contradicted: bool = False


@dataclass(frozen=True)
class CompletionVerification:
    status: VerdictStatus
    criteria: tuple[CriterionVerdict, ...]
    #: 是否真的另起了一次独立模型请求(全机器可判时为 False,这是合法的)
    independent_request_made: bool
    judge_model: str | None
    #: status=undetermined 时给原因
    unavailable_reason: str | None
    #: judge 与执行者是同一模型等独立性缺陷(不影响结论,但必须可见)
    independence_warnings: tuple[str, ...] = ()
    raw_judge_output: str | None = None

    @property
    def unmet(self) -> tuple[CriterionVerdict, ...]:
        return tuple(c for c in self.criteria if c.verdict != "met")


@dataclass
class VerificationRequest:
    """一次校验请求:指标 + 证据 + (可选)执行者自述。"""

    criteria: Sequence[HardCriterion]
    evidence: Sequence[EvidenceRecord] = ()
    #: 执行者的自述(仅作对照展示,**不作为判定输入**)
    executor_claim: str = ""
    #: 执行轮用的模型;与 judge 同源时独立性不成立
    executor_model: str | None = None
    goal: str = ""
    extra: Mapping[str, object] = field(default_factory=dict)


#: judge 注入点:吃提示词,返回原始文本 + 实际使用的模型名。
#: 模型名必须回传,否则"judge 与执行者是否同一模型"这条独立性判据就没法算。
@dataclass(frozen=True)
class JudgeResponse:
    content: str
    model: str | None = None


JudgeCall = Callable[[list[dict[str, str]]], Awaitable[JudgeResponse]]


class JudgeUnavailable(RuntimeError):
    """独立请求本身不可用(网络/鉴权/超时)。"""


class JudgeOutputInvalid(RuntimeError):
    """独立请求回了东西,但不是可校验的结构。"""


def _clip(text: str) -> tuple[str, bool]:
    if len(text) <= MAX_EXCERPT_CHARS:
        return text, False
    return text[:MAX_EXCERPT_CHARS], True


def _render_evidence_block(
    criteria: Sequence[HardCriterion],
    evidence: Sequence[EvidenceRecord],
) -> str:
    """把证据按指标分组渲染进提示词(只渲染需要语义判定的条目,少给噪声)。"""
    lines: list[str] = []
    for crit in criteria:
        lines.append(f"### 指标 {crit.id}(required={crit.required},kind={crit.evidence_kind})")
        lines.append(f"声明: {crit.statement}")
        related = [e for e in evidence if e.criterion_id == crit.id]
        if not related:
            lines.append("- 证据: 无")
        for rec in related:
            if rec.unavailable_reason:
                lines.append(f"- 证据 {rec.id}(来源 {rec.source}): 采集失败 → {rec.unavailable_reason}")
                continue
            body, was_truncated = _clip(rec.excerpt)
            tail = " [truncated]" if (was_truncated or rec.truncated) else ""
            lines.append(f"- 证据 {rec.id}(来源 {rec.source}){tail}:\n{body}")
        lines.append("")
    return "\n".join(lines)


def parse_judge_output(raw: str, expected_ids: Sequence[str]) -> dict[str, CriterionVerdict]:
    """严格解析 judge 输出。

    四类情形一律判"无效"(抛 JudgeOutputInvalid),绝不部分采信:
    JSON 解不出 / 不是数组 / id 对不上(缺条或多条/编造 id) / verdict 非 met|unmet。
    理由:部分采信会让"漏掉的那几条"默认变成 met —— 那是 fail-open 的静默形态。
    """
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        loaded: object = json.loads(text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise JudgeOutputInvalid(f"输出不是合法 JSON: {exc}") from exc
    if not isinstance(loaded, list):
        raise JudgeOutputInvalid("输出不是 JSON 数组")

    expected = list(expected_ids)
    seen: dict[str, CriterionVerdict] = {}
    for item in loaded:
        if not isinstance(item, dict):
            raise JudgeOutputInvalid("数组元素不是对象")
        cid = item.get("criterion_id")
        verdict = item.get("verdict")
        reason = item.get("reason")
        ids = item.get("evidence_ids")
        if not isinstance(cid, str) or cid not in expected:
            raise JudgeOutputInvalid(f"出现未声明的 criterion_id: {cid!r}")
        if verdict not in ("met", "unmet"):
            raise JudgeOutputInvalid(f"{cid}: verdict 必须是 met|unmet,实得 {verdict!r}")
        if not isinstance(reason, str) or not reason.strip():
            raise JudgeOutputInvalid(f"{cid}: 缺 reason")
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise JudgeOutputInvalid(f"{cid}: evidence_ids 必须是字符串数组")
        if cid in seen:
            raise JudgeOutputInvalid(f"{cid}: 重复判定")
        seen[cid] = CriterionVerdict(
            criterion_id=cid,
            verdict="met" if verdict == "met" else "unmet",
            basis="judge",
            reason=reason.strip(),
            evidence_ids=tuple(str(i) for i in ids),
        )
    missing = [cid for cid in expected if cid not in seen]
    if missing:
        raise JudgeOutputInvalid(f"judge 漏判指标: {', '.join(missing)}")
    return seen


def machine_decide(
    criteria: Sequence[HardCriterion],
    evidence: Sequence[EvidenceRecord],
) -> dict[str, CriterionVerdict]:
    """可由机器结论直接定案的条目(不经过模型)。

    同一指标多条机器证据时取 AND —— 任何一条 False 即 unmet,
    比"看最后一条"或"看第一条"都少一个顺序依赖的坑。
    """
    decided: dict[str, CriterionVerdict] = {}
    for crit in criteria:
        machine_backed = [
            e
            for e in evidence
            if e.criterion_id == crit.id and e.outcome is not None and not e.unavailable_reason
        ]
        if not machine_backed:
            continue
        failed = [e for e in machine_backed if e.outcome is not True]
        verdict: EvidenceOutcome = "unmet" if failed else "met"
        ids = tuple(e.id for e in (failed or machine_backed))
        decided[crit.id] = CriterionVerdict(
            criterion_id=crit.id,
            verdict=verdict,
            basis="machine",
            reason=(
                f"机器证据 {len(machine_backed)} 条全部成立"
                if not failed
                else f"机器证据未成立: {', '.join(e.source for e in failed)}"
            ),
            evidence_ids=ids,
        )
    return decided


async def _default_judge_call(messages: list[dict[str, str]]) -> JudgeResponse:
    """默认 judge:经 llm_gateway 另起一次独立请求。

    延迟 import —— 本模块要能在无 AI 凭据/无网络的环境里被 import 与单测。
    """
    from ..core.llm_gateway import llm_gateway

    try:
        resp = await llm_gateway.complete(messages)
    except Exception as exc:  # noqa: BLE001 - 对外统一收敛成 JudgeUnavailable
        raise JudgeUnavailable(f"{type(exc).__name__}: {exc}") from exc
    if not isinstance(resp, dict):
        raise JudgeUnavailable(f"gateway 返回非对象: {type(resp).__name__}")
    # stub 模式(无凭据时网关自答 stub)不构成独立判定,必须当成不可用
    if resp.get("stub"):
        raise JudgeUnavailable("gateway 处于 stub 模式,未发生真实推理")
    content = resp.get("content")
    if not isinstance(content, str) or not content.strip():
        raise JudgeUnavailable("gateway 返回空 content")
    model = resp.get("model")
    return JudgeResponse(content=content, model=model if isinstance(model, str) else None)


def _usable_evidence(evidence: Sequence[EvidenceRecord], criterion_id: str) -> list[EvidenceRecord]:
    """该指标名下"真采到了东西"的证据条数(采集失败的不算东西)。"""
    return [
        e
        for e in evidence
        if e.criterion_id == criterion_id and not e.unavailable_reason and e.excerpt.strip()
    ]


async def verify_goal_completion(
    request: VerificationRequest,
    *,
    judge: JudgeCall | None = None,
) -> CompletionVerification:
    """跑一次独立校验轮。

    Args:
        request: 预先声明的硬性指标 + 真实证据 (+ 仅作对照的执行者自述)
        judge: 注入点,默认走 llm_gateway 的独立请求;单测传 fake 即可离线跑

    Returns:
        CompletionVerification —— status 为 undetermined 时调用方**必须**按未完成处理。
    """
    criteria = list(request.criteria)
    if not criteria:
        return CompletionVerification(
            status="undetermined",
            criteria=(),
            independent_request_made=False,
            judge_model=None,
            unavailable_reason="没有预先声明任何硬性指标,无从判定",
        )

    evidence = list(request.evidence)
    known_evidence_ids = {e.id for e in evidence}
    decided = machine_decide(criteria, evidence)

    # 一条必需指标若什么都没采到,不该把它送去做"语义判定" —— 那等于让模型对
    # 空卷打分。直接判 missing-evidence / unknown,整体结论落 undetermined。
    starved: list[HardCriterion] = []
    pending: list[HardCriterion] = []
    for crit in criteria:
        if crit.id in decided:
            continue
        if _usable_evidence(evidence, crit.id):
            pending.append(crit)
        else:
            starved.append(crit)

    warnings: list[str] = []
    judge_model: str | None = None
    raw_output: str | None = None
    request_made = False

    if pending:
        call: JudgeCall = judge if judge is not None else _default_judge_call
        request_made = True
        messages = [
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"目标: {request.goal or '(未提供)'}\n\n"
                    "以下指标只能凭语义判定,请逐条给出结论并引用证据 id。\n\n"
                    f"{_render_evidence_block(pending, evidence)}\n"
                    f"需要判定的指标 id(必须逐条覆盖): {', '.join(c.id for c in pending)}"
                ),
            },
        ]
        failure: str | None = None
        try:
            response = await call(messages)
        except (JudgeUnavailable, JudgeOutputInvalid) as exc:
            response, failure = None, str(exc)
        except Exception as exc:  # noqa: BLE001 - 注入点抛任何错都收敛为不可用
            response, failure = None, f"judge 调用异常 {type(exc).__name__}: {exc}"
        if response is None:
            verdicts = list(decided.values())
            verdicts.extend(
                CriterionVerdict(
                    criterion_id=c.id,
                    verdict="unknown",
                    basis="judge",
                    reason=f"独立请求不可用: {failure}",
                )
                for c in pending
            )
            verdicts.extend(
                CriterionVerdict(
                    criterion_id=c.id,
                    verdict="unknown",
                    basis="missing-evidence",
                    reason="没有为该指标采集到可用证据",
                )
                for c in starved
            )
            return CompletionVerification(
                status="undetermined",
                criteria=tuple(verdicts),
                independent_request_made=True,
                judge_model=None,
                unavailable_reason=failure,
                independence_warnings=tuple(warnings),
            )
        raw_output = response.content
        judge_model = response.model
        try:
            judged = parse_judge_output(raw_output, [c.id for c in pending])
        except JudgeOutputInvalid as exc:
            failure = f"独立请求输出不可校验: {exc}"
            verdicts = list(decided.values())
            verdicts.extend(
                CriterionVerdict(
                    criterion_id=c.id,
                    verdict="unknown",
                    basis="judge",
                    reason=failure,
                )
                for c in pending
            )
            verdicts.extend(
                CriterionVerdict(
                    criterion_id=c.id,
                    verdict="unknown",
                    basis="missing-evidence",
                    reason="没有为该指标采集到可用证据",
                )
                for c in starved
            )
            return CompletionVerification(
                status="undetermined",
                criteria=tuple(verdicts),
                independent_request_made=True,
                judge_model=judge_model,
                unavailable_reason=failure,
                independence_warnings=tuple(warnings),
                raw_judge_output=raw_output,
            )
        for cid, one in judged.items():
            fabricated = [e for e in one.evidence_ids if e not in known_evidence_ids]
            if fabricated:
                # 引用了不存在的证据 id = 凭空背书,直接降为 unmet 并点名
                decided[cid] = CriterionVerdict(
                    criterion_id=cid,
                    verdict="unmet",
                    basis="judge",
                    reason=f"judge 引用了不存在的证据 id: {', '.join(fabricated)}",
                    evidence_ids=one.evidence_ids,
                    contradicted=True,
                )
            elif one.verdict == "met" and not one.evidence_ids:
                decided[cid] = CriterionVerdict(
                    criterion_id=cid,
                    verdict="unmet",
                    basis="judge",
                    reason="judge 判 met 却没给出任何证据 id",
                    contradicted=True,
                )
            else:
                decided[cid] = one

    for crit in starved:
        decided[crit.id] = CriterionVerdict(
            criterion_id=crit.id,
            verdict="unknown",
            basis="missing-evidence",
            reason="没有为该指标采集到可用证据",
        )

    ordered = [decided[c.id] for c in criteria]
    if request.executor_model and judge_model and request.executor_model == judge_model:
        warnings.append(
            f"judge 与执行者为同一模型({judge_model}),独立性不成立,结论仅供参考"
        )

    pairs = list(zip(criteria, ordered, strict=True))
    if any(c.required and v.verdict == "unknown" for c, v in pairs):
        # 有必需项根本没判出来 → 既不能宣称完成,也不能断言未完成
        return CompletionVerification(
            status="undetermined",
            criteria=tuple(ordered),
            independent_request_made=request_made,
            judge_model=judge_model,
            unavailable_reason="存在无法判定的必需指标(证据缺失或判定不可用)",
            independence_warnings=tuple(warnings),
            raw_judge_output=raw_output,
        )
    unmet_required = any(c.required and v.verdict == "unmet" for c, v in pairs)
    status: VerdictStatus = "not_achieved" if unmet_required else "achieved"
    return CompletionVerification(
        status=status,
        criteria=tuple(ordered),
        independent_request_made=request_made,
        judge_model=judge_model,
        unavailable_reason=None,
        independence_warnings=tuple(warnings),
        raw_judge_output=raw_output,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
