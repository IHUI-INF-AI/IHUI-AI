# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法多跳检索通道（本仓自有实现）。

取证来源：微信文章所述 SAG2 / 开源 SAG Wiki（MIT，v0.2.7）。
按 AGENTS.md §0.12「逆向-复现-超越」：**复现行为与设计，写自己的代码**，
不把对方源码原样粘进仓库；本包所有文件均为独立重写。

能力分层：
- ``text``       Unicode 切词 / 中英文切句 / 人名短语
- ``index``      零模型倒排索引 + BM25 + hash 增量 + citation 锚定
- ``judge``      可插拔证据判断 provider（诚实降级）
- ``retrieval``  查询时多跳主循环 + 扩展词 + interleave + trace
- ``diversity``  DPP 贪心正交化终排
- ``service``    门面 + 与既有 rag.py 的 RRF 三通道融合

超越对照的三条轴：贴本仓架构（Postgres/既有 RAG 降级链、零新依赖）、
补齐边界（显式状态与「未判定」自证）、更好测（纯函数 + 固定夹具）。
"""

from .diversity import diversify
from .index import LexicalIndex, ScoredChunk
from .judge import LexicalOnlyJudge, ModelJudge, resolve_judge
from .retrieval import (
    Sag2Options,
    Sag2Result,
    expansion_terms,
    interleave,
    resolve_terms,
    retrieve,
)
from .service import Sag2LexicalService, sag2_lexical_service
from .text import casefold_tokens, match_query, name_phrases, sentence_spans

__all__ = [
    "LexicalIndex",
    "ScoredChunk",
    "LexicalOnlyJudge",
    "ModelJudge",
    "resolve_judge",
    "Sag2Options",
    "Sag2Result",
    "Sag2LexicalService",
    "sag2_lexical_service",
    "retrieve",
    "expansion_terms",
    "resolve_terms",
    "interleave",
    "diversify",
    "casefold_tokens",
    "match_query",
    "name_phrases",
    "sentence_spans",
]
