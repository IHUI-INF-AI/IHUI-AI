# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""私有成对评测器 —— 把现成的 LLM 评审核编排成「保密 + 逐版本胜率 + 骤降哨兵」这把外部尺子。

复现来源(逆向-复现-超越,AGENTS.md §0.13):
    Hugging Face《PyBot: Scaling Swarms to Thousands of Agents》的 SmolTalkBench ——
    从对话集抽固定题、用一个评判模型判「本版回答是否优于参考」,按提交逐个统计胜率,
    靠胜率曲线的骤降在没有人工介入时就暴露坏合并(原文第 2000 次提交处 import 崩溃即此型)。

为什么不是再写一个评测框架:本仓的评审核 **已经现成** ——
    - ``app.services.best_of_n.BestOfNRunner`` —— N 个给定候选 + LLM rubric 打分 + 确定性兜底;
    - ``app.services.eval_service.EvalService`` —— 数据集 CRUD + 逐条 avg_score 对比;
    - ``LLMGateway.structured_completion`` —— 强制 JSON Schema 的结构化裁判出口。
本器**只编排、不重抄**(§0.6 单一真相源):裁判直接走 ``structured_completion``,
判分口径只有这里一份。要新增判分维就改本器,禁止在调用方或测试里再抄一套 rubric。

两个超越轴(对照原文与本仓既有件都没做的):
    1. **三态诚实**:成对裁判调用失败 / 解析不出 / 样本不足 ⇒ 落 ``unjudged`` / ``undetermined``,
       绝不写成 ``win``/``loss`` 凑一个数,也绝不在曲线里冒充「这一版没问题」。判不了就是没判
       (§0.3「没判绝不写成判过」、§0.10「失效方向要多要一次说明而不是多放一次」)。
    2. **位置随机化**:同一条题把 candidate/reference 交替摆放在 A/B 位(按 ``item_id`` 稳定可复现),
       消除 pairwise 裁判偏袒某一侧的系统性偏差;映射回 candidate/ref 口径后才计数,原始摆位记录留痕。
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)

WIN = "win"
LOSS = "loss"
TIE = "tie"
UNJUDGED = "unjudged"

# 成对结果的四态常量集合;任何"映射后"的 outcome 必须落在这里,否则按 unjudged 处理。
_OUTCOMES = frozenset({WIN, LOSS, TIE, UNJUDGED})

# 骤降哨兵默认阈(本仓经验值,非原文抄来 —— 原文只描述了骤降现象未给阈值;
# 在 auto-evolve 实跑里按现读基线再校,可调,见 CLI --min-delta / --min-judged)。
DEFAULT_MIN_JUDGED = 8
DEFAULT_REGRESSION_DELTA = 0.10
DEFAULT_WINDOW = 5


class StructuredGateway(Protocol):
    """本器需要的裁判出口(由 LLMGateway 提供;测试注入 fake,绝不连生产)。

    签名对齐 ``LLMGateway.structured_completion``,只声明用到的形参位。
    """

    async def structured_completion(
        self,
        messages: list[dict[str, str]],
        schema: dict[str, Any],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        schema_name: str = "structured_response",
        max_retries: int = 1,
    ) -> dict[str, Any]: ...


@dataclass
class EvalItem:
    """一条成对评测题:指令 + 待测版回答 + 参照回答。"""

    item_id: str
    instruction: str
    candidate: str
    reference: str


@dataclass
class PairwiseResult:
    """一条题的裁决结果(候选视角)+ 自证字段。"""

    item_id: str
    outcome: str  # WIN/LOSS/TIE/UNJUDGED,恒 ∈ _OUTCOMES
    swapped: bool  # 本条是否把 reference 摆在 A 位
    reason: str = ""
    error: str = ""  # 为何未判定(outcome=UNJUDGED 时非空)
    judge_model: str = ""
    finished_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_JUDGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "winner": {"type": "string", "enum": ["A", "B", "tie"]},
        "reason": {"type": "string"},
    },
    "required": ["winner", "reason"],
    "additionalProperties": False,
}


def _position_seed(item_id: str) -> int:
    """按 item_id 稳定派生一个非负整数(跨进程/跨运行一致,不受 PYTHONHASHSEED 影响)。

    用内置 ``hash()`` 会被随机盐打断可复现性;这里用 sha256 摘要取模,保证同题恒同摆位。
    """
    digest = hashlib.sha256(item_id.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def is_swapped(item_id: str) -> bool:
    """决定本条是否把 reference 摆在 A 位(stable, 50/50)。"""
    return _position_seed(item_id) % 2 == 0


def build_judge_prompt(item: EvalItem, *, swapped: bool) -> list[dict[str, str]]:
    """构造裁判消息(本仓判分口径的唯一出处,禁止在别处复制 rubric 文字)。

    swapped=True 时 A=reference、B=candidate,否则反之;A/B 与 candidate/ref 的映射在
    ``pairwise_verdict`` 里还原,保证无论摆位如何,统计都是"候选 vs 参照"口径。
    """
    cand, ref = (item.reference, item.candidate) if swapped else (item.candidate, item.reference)
    system = (
        "你是一名严格、克制的对话质量评审员。给定同一个问题的两个候选回答 A 与 B,"
        "按下列标准判断哪个更好:① 是否真正解决了用户的问题;② 事实是否准确、有无编造;"
        "③ 是否自然体贴、符合『像知识渊博的朋友』的语气;④ 有无冗余或跑题。"
        "只依据回答本身判断,不要偏向更长或先出现的一方。"
        "若两者同样好或同样差,判 tie。"
        '只输出 JSON:{"winner":"A"|"B"|"tie","reason":"一句话中文理由"}。'
    )
    user = (
        f"# 问题\n{item.instruction}\n\n"
        f"# 回答 A\n{cand}\n\n"
        f"# 回答 B\n{ref}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def pairwise_verdict(
    judge_raw: dict[str, Any],
    *,
    item_id: str,
    swapped: bool,
    judge_model: str = "",
) -> PairwiseResult:
    """把裁判原始返回映射成候选视角的 PairwiseResult(纯函数,可单测)。

    任一环节判不下去 ⇒ ``UNJUDGED`` 并写明原因,**绝不**默认成 win/loss/tie:
    - 返回带 error / 缺字段 / winner 不在 {A,B,tie} ⇒ unjudged;
    - 映射规则:swapped 时 winner==A 指 reference 胜出 ⇒ candidate 是 LOSS,反之亦然;
      tie 与摆位无关。
    """
    if not isinstance(judge_raw, dict) or judge_raw.get("error"):
        err = str(judge_raw.get("error_message", "裁判调用失败")) if isinstance(judge_raw, dict) else "裁判返回非对象"
        return PairwiseResult(item_id=item_id, outcome=UNJUDGED, swapped=swapped, error=err, judge_model=judge_model)

    winner = judge_raw.get("winner")
    if not isinstance(winner, str) or winner.lower() not in {"a", "b", "tie"}:
        return PairwiseResult(item_id=item_id, outcome=UNJUDGED, swapped=swapped, error=f"裁判 winner 字段无法映射: {winner!r}", judge_model=judge_model)

    key = winner.lower()
    if key == "tie":
        outcome = TIE
    else:
        cand_side = "a" if not swapped else "b"  # 候选被摆在哪个字母位
        outcome = WIN if key == cand_side else LOSS

    reason = judge_raw.get("reason")
    return PairwiseResult(
        item_id=item_id,
        outcome=outcome if outcome in _OUTCOMES else UNJUDGED,
        swapped=swapped,
        reason=str(reason) if isinstance(reason, str) else "",
        judge_model=judge_model,
    )


async def judge_pair(
    gateway: StructuredGateway,
    item: EvalItem,
    *,
    judge_model: str | None = None,
    owner_uuid: str | None = None,
) -> PairwiseResult:
    """对一条题调裁判,拿 A/B 裁决再映射回候选视角。"""
    swapped = is_swapped(item.item_id)
    messages = build_judge_prompt(item, swapped=swapped)
    raw = await gateway.structured_completion(
        messages,
        _JUDGE_SCHEMA,
        judge_model,
        owner_uuid=owner_uuid,
        schema_name="pairwise_verdict",
    )
    return pairwise_verdict(raw, item_id=item.item_id, swapped=swapped, judge_model=judge_model or "")


@dataclass
class WinRate:
    """一批成对结果的胜率汇总。

    ``basis`` 只含 win+loss:tie 与 unjudged **不进分母**(同题打平不算改进证据;
    判不了的题不得被悄悄算成"通过"或"失败",也不得膨胀分母稀释胜率)。
    全 tie / 全 unjudged ⇒ basis=0 ⇒ win_rate=None ⇒ 由 ``trend_verdict`` 落 unjudged。
    """

    n: int
    win: int
    loss: int
    tie: int
    unjudged: int
    win_rate: float | None

    @property
    def basis(self) -> int:
        return self.win + self.loss

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "basis": self.basis}


def rollup_wins(results: Sequence[PairwiseResult]) -> WinRate:
    """汇总一批裁决为胜率。空集与判不动都安全返回(None 分母不除零)。"""
    win = sum(1 for r in results if r.outcome == WIN)
    loss = sum(1 for r in results if r.outcome == LOSS)
    tie = sum(1 for r in results if r.outcome == TIE)
    unjudged = sum(1 for r in results if r.outcome == UNJUDGED)
    basis = win + loss
    rate = round(win / basis, 4) if basis else None
    return WinRate(n=len(results), win=win, loss=loss, tie=tie, unjudged=unjudged, win_rate=rate)


@dataclass
class TrendPoint:
    """趋势账里的一次评测留痕:版本 + 时刻 + 该版胜率(直接复用 WinRate 计数)。

    刻意把 WinRate 原样嵌进来,而非再抽一套精简字段 —— `detect_regression` 吃的就是
    `WinRate`,若这里另立口径,还原时要重算 basis,又多一处可能不同步的真相源(§0.6)。
    """

    version: str
    at: str
    rate: WinRate

    def to_dict(self) -> dict[str, Any]:
        return {"version": self.version, "at": self.at, **self.rate.to_dict()}

    @classmethod
    def from_dict(cls, obj: dict[str, Any]) -> TrendPoint:
        rate = WinRate(
            n=int(obj.get("n", 0)),
            win=int(obj.get("win", 0)),
            loss=int(obj.get("loss", 0)),
            tie=int(obj.get("tie", 0)),
            unjudged=int(obj.get("unjudged", 0)),
            win_rate=obj.get("win_rate"),
        )
        return cls(version=str(obj["version"]), at=str(obj["at"]), rate=rate)


def append_ledger(path: Path, point: TrendPoint) -> None:
    """逐行 jsonl 追加(不覆盖、不重排);调用方负责路径在批准落点内。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(point.to_dict(), ensure_ascii=False, sort_keys=True) + "\n")


def load_ledger(path: Path) -> list[TrendPoint]:
    """读趋势账,忽略空行与坏行(坏行降级丢弃,不因一行崩读废整条曲线)。"""
    if not path.exists():
        return []
    points: list[TrendPoint] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if not isinstance(obj, dict):
                raise TypeError("trend row not a mapping")
            points.append(TrendPoint.from_dict(obj))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.warning("跳过趋势账坏行(形状不符): %.80s", line)
    return points


@dataclass
class TrendVerdict:
    """骤降哨兵的三态结论 —— 判不了与判过是两件事,必须分得开。"""

    verdict: str  # ok / regression / unjudged
    current: float | None
    baseline: float | None
    dropped: float | None
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def detect_regression(
    current: WinRate,
    history: Sequence[WinRate],
    *,
    min_judged: int = DEFAULT_MIN_JUDGED,
    min_delta: float = DEFAULT_REGRESSION_DELTA,
    window: int = DEFAULT_WINDOW,
) -> TrendVerdict:
    """对照「近期历史胜率均值」判本版是否骤降,严格三态。

    - current 自身未判出(basis==0 ⇒ win_rate None)⇒ unjudged(本版判不动,绝不冒"没问题");
    - 历史里可判点数不足 window 或任一均值取不到 ⇒ unjudged(没有足够基线不得报"骤降"也不得报"达标");
    - baseline - current >= min_delta ⇒ regression(图 2 那条 2000 提交处掉下去的线);
    - 否则 ok。

    样本门槛用 ``WinRate.basis``(win+loss,tie/unjudged 不进分母)按 ``min_judged`` 过滤:
    判得动的题太少的历史点/当版点不作为基线,免得小样本噪声把哨兵打翻。
    """
    usable_history = [h for h in history if h.win_rate is not None and h.basis >= min_judged]
    if current.win_rate is None or current.basis < min_judged:
        return TrendVerdict(
            "unjudged",
            current.win_rate,
            None,
            None,
            f"本版可判数不足(current.basis={current.basis}<{min_judged} 或全 tie/unjudged)",
        )
    if len(usable_history) < window:
        return TrendVerdict(
            "unjudged",
            current.win_rate,
            None,
            None,
            f"基线样本不足(可判历史点 {len(usable_history)}<{window})",
        )
    recent = usable_history[-window:]
    rates = [h.win_rate for h in recent if h.win_rate is not None]
    baseline = round(sum(rates) / len(rates), 4)
    dropped = round(baseline - current.win_rate, 4)
    if dropped >= min_delta:
        return TrendVerdict("regression", current.win_rate, baseline, dropped, f"较近 {window} 点均值下降 {dropped:.4f} ≥ {min_delta}")
    return TrendVerdict("ok", current.win_rate, baseline, dropped, "胜率未低于基线阈值")


__test__ = {
    "pairwise_verdict": pairwise_verdict,
    "rollup_wins": rollup_wins,
    "detect_regression": detect_regression,
    "is_swapped": is_swapped,
    "WIN": WIN,
    "LOSS": LOSS,
    "TIE": TIE,
    "UNJUDGED": UNJUDGED,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
