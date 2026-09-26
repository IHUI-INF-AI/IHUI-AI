# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""守门 35(mypy)回退修复的回归钉:reranker llm_rerank_scores 缺 index 键显式收窄。

背景:llm.py:3387 / reranker.py:247 的 4 条 mypy 错误是"mypy 全库清零"后的回退。
reranker 侧的修法是显式 `raw_index is None → continue`,其语义必须与旧行为
(int(None) 抛 TypeError 被 except 吞掉 → continue)逐分支等价。

本文件纯单测:monkeypatch 掉 llm_gateway.structured_completion 与 env 开关,
不触 DB / 网络 / Redis(AGENTS §5 测试隔离铁律)。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import reranker


class _Candidate:
    """鸭子类型候选:llm_rerank_scores 只读 .content。"""

    def __init__(self, content: str) -> None:
        self.content = content


def _patch_gateway(monkeypatch: pytest.MonkeyPatch, result: dict[str, Any]) -> None:
    monkeypatch.setattr(reranker, "llm_rerank_enabled", lambda: True)

    async def _fake_completion(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return result

    monkeypatch.setattr(reranker.llm_gateway, "structured_completion", _fake_completion)


@pytest.mark.asyncio
async def test_missing_index_key_skipped_others_kept(monkeypatch: pytest.MonkeyPatch) -> None:
    """缺 index 键的条目被跳过(与旧 TypeError→continue 等价),其余条目正常产出。"""
    _patch_gateway(
        monkeypatch,
        {
            "scores": [
                {"index": 0, "score": 8.0, "reason": "ok"},
                {"score": 5.0},  # 缺 index:旧行为 int(None)→TypeError→continue,必须同样跳过
                {"index": None, "score": 7.0},  # index 显式 None:同上,跳过
                "not-a-dict",  # 非 dict:既有分支,跳过
                {"index": "1", "score": 3.5},  # 字符串数字下标:int("1")==1,正常路径不变
                {"index": 99, "score": 9.0},  # 越界下标:既有判据丢弃
                {"index": 1, "score": 15.0},  # 分数截断到 [0,10]:正常路径不变
            ]
        },
    )
    items = [_Candidate("a"), _Candidate("b")]

    out = await reranker.llm_rerank_scores("q", items)

    # (0, 8.0) 有效;("1"→1, 3.5) 有效;越界 99 丢弃;score=15 截断为 10;
    # 缺 index / None index / 非 dict 各跳过 —— 无任何异常抛出。
    assert out is not None
    assert (0, 8.0, "ok") in out
    assert (1, 3.5, "") in out
    assert (1, 10.0, "") in out
    assert len(out) == 3


@pytest.mark.asyncio
async def test_all_entries_missing_index_degrades_to_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """全部条目都缺 index → 与旧行为一致返回 None(调用方降级原排序),不抛异常。"""
    _patch_gateway(monkeypatch, {"scores": [{"score": 1.0}, {"score": 2.0}]})
    out = await reranker.llm_rerank_scores("q", [_Candidate("a")])
    assert out is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
