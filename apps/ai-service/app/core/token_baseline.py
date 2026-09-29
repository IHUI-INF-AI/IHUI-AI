# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话累计 prompt token 的「按来源增量基线」唯一实现(2026-09-29 G-821 立)。

账本每条记录携带的是**整段请求的 prompt tokens**(上下文全量),不是本轮新增;
逐条相加会让同一会话第 N 轮把前 N-1 轮的上下文重复计入 ⇒ 累计值按轮次平方级虚高。
聚合读面(cost_ledger.aggregate / llm_usage_service.get_user_stats)必须共用本模块,
不得在两处各抄一遍基线算法。

语义(与写面/预算门控无关,只事后审计):
- 同一 (来源链, session) 内,第 N 条增量 = max(0, 本条 prompt − 该链上一条的 prompt);
- prompt 下降(压缩)⇒ 基线**下移**到新值,历史累计不回扣 ——
  否则压缩后再涨回来的那一段会被整段重复计入;
- session 为空 ⇒ 无从判定同链,每条自成一链(不扣减,等同旧行为)。
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

__all__ = ["PromptTokenSample", "incremental_prompt_tokens"]


@dataclass(frozen=True)
class PromptTokenSample:
    """一条待增量化的读面输入:所属来源链 + 会话 + 该次请求的 prompt tokens。"""

    source: str
    session_id: str
    prompt_tokens: int


def _chain_key(index: int, sample: PromptTokenSample) -> tuple[str, str, int]:
    """空 session 退化为「每条自成一链」:无链可归属时不得凭空扣减。"""
    if not sample.session_id:
        return ("", sample.source, index)
    return (sample.session_id, sample.source, 0)


def incremental_prompt_tokens(samples: Iterable[PromptTokenSample]) -> list[int]:
    """按链持基线,返回与输入同序的每条 prompt 增量(唯一算法,勿在别处重写)。"""
    baseline: dict[tuple[str, str, int], int] = {}
    increments: list[int] = []
    for index, sample in enumerate(samples):
        prompt = max(0, int(sample.prompt_tokens))
        key = _chain_key(index, sample)
        increments.append(max(0, prompt - baseline.get(key, 0)))
        baseline[key] = prompt
    return increments
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
