# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·文本层（本仓自有实现）。

取证自对照程序 SAG Wiki（MIT）的**行为与设计**：Unicode casefold/NFKD 切词、
中英文标点切句、大写人名短语识别、短语引用构造。本文件为独立重写，不含对方源码。

设计约束（超越轴「更好测」）：全部纯函数、零第三方依赖、无 I/O，
使 IDF / 扩展词 / 切句行为可用固定夹具逐值钉死。
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable

# 字母/数字连续段；[^\W_] 等价于 \p{L}\p{N}（不含下划线），跨语言可用。
_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)
# 英文句末标点、中文句末标点、换行；英文缩写 initials（J. R. Smith）不切开。
_SENTENCE_RE = re.compile(r"(?<!\b[A-Z])[.!?]\s+|[。！？]+\s*|\n+")
_GAP_RE = re.compile(r"[\s\-'’.]*")


def _is_cjk(ch: str) -> bool:
    """中日韩统一表意文字（含扩展 A 与兼容表意文字）。"""
    code = ord(ch)
    return (
        0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
    )


def casefold_tokens(text: str) -> list[str]:
    """NFKD + Unicode casefold 后切出词元，**含中文分词**。

    对照程序用 SQLite FTS5 默认 unicode61（CJK 按字切）配合应用层
    ``text::tokenize``；若直接照搬其 ``[\\p{L}\\p{N}]+`` 词表规则，
    中文整句会因为无空格被当成**一个**词元，检索直接失效。

    因此本仓实现显式处理 CJK：连续汉字段切成单字，并额外生成相邻
    bigram（"收购"/"购了"），拉丁/数字串保持整词。这是中文全文检索的
    常见做法，也是「补齐对照在中文语料上的边界」的一条具体超越。
    """
    if not text:
        return []
    folded = unicodedata.normalize("NFKD", text).casefold()
    tokens: list[str] = []
    latin: list[str] = []
    cjk: list[str] = []

    def flush_latin() -> None:
        if latin:
            tokens.append("".join(latin))
            latin.clear()

    def flush_cjk() -> None:
        if not cjk:
            return
        segment = "".join(cjk)
        tokens.extend(segment)
        tokens.extend(segment[i : i + 2] for i in range(len(segment) - 1))
        cjk.clear()

    for ch in folded:
        if not ch.isalnum():
            flush_latin()
            flush_cjk()
            continue
        if _is_cjk(ch):
            flush_latin()
            cjk.append(ch)
        else:
            flush_cjk()
            latin.append(ch)
    flush_latin()
    flush_cjk()
    return tokens


def token_set(text: str) -> set[str]:
    """去重词元集合（IDF/上下文统计用）。"""
    return set(casefold_tokens(text))


def split_sentences(text: str) -> list[str]:
    """按中英文句末标点与换行切句，保留英文大写 initials。

    句子边界是扩展词「上下文不跨句传播」的前提：中文资料里若把
    「台风登陆。救援开始」当一句，查询词上下文会串到无关词上。
    """
    if not text:
        return []
    parts = _SENTENCE_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def sentence_spans(text: str) -> list[tuple[int, int, str]]:
    """带原文字符区间的切句，供 citation 锚定使用。

    与 ``split_sentences`` 同一分隔符规则，但保留 ``(start, end, 文本)``，
    使索引可以记录每个块在原文件中的精确位置（对照程序用 byte range /
    line-column + 文件 hash 锚定引用，这里用字符区间达到同等可回溯性）。
    """
    if not text:
        return []
    spans: list[tuple[int, int, str]] = []
    start = 0
    for match in _SENTENCE_RE.finditer(text):
        end = match.start()
        if end > start:
            spans.append((start, end, text[start:end]))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text), text[start:]))
    return [(s, e, t.strip()) for s, e, t in spans if t.strip()]


def _is_capitalized(word: str) -> bool:
    """大写起始词或单字母大写缩写。"""
    if not word:
        return False
    return word[0].isupper() or (len(word) == 1 and word.isupper())


def name_phrases(sentence: str) -> list[tuple[int, int, str]]:
    """识别连续大写词/首字母缩写短语，返回 (start, end, 归一化短语)。

    对应对照的 ``name_phrase`` 词项类型：人名、机构名等整体作为一条扩展词，
    避免被拆成单字后失去检索意义。中文资料里该识别通常不命中，属正常。
    """
    tokens = [(m.start(), m.end(), m.group()) for m in _WORD_RE.finditer(sentence)]
    spans: list[tuple[int, int, str]] = []
    i = 0
    while i < len(tokens):
        if not _is_capitalized(tokens[i][2]):
            i += 1
            continue
        j = i + 1
        while j < len(tokens) and _is_capitalized(tokens[j][2]):
            gap = sentence[tokens[j - 1][1] : tokens[j][0]]
            if gap and not _GAP_RE.fullmatch(gap):
                break
            j += 1
        if j - i >= 2:
            start, end = tokens[i][0], tokens[j - 1][1]
            phrase = " ".join(casefold_tokens(sentence[start:end]))
            if phrase:
                spans.append((start, end, phrase))
        i = max(j, i + 1)
    return spans


def quote_term(term: str) -> str:
    """把词项包装成短语引用（查询表达式里避免被再切分）。"""
    cleaned = " ".join(term.split()).replace('"', "")
    return f'"{cleaned}"'


def match_query(query: str) -> list[str]:
    """把自然语言问题转成宽松 OR 词项列表（初轮召回保召回率）。

    对照程序初轮用宽松 OR 匹配、约 100 个候选，为后续证据判断留出空间；
    「只重排初轮结果」的硬边界是没进候选池的段落永远进不来，因此必须有扩展轮。

    中文边界：文档词表保留单字（供 IDF/扩展词统计），但**查询只用
    bigram 与拉丁/数字串**。「的/了/后/个」这类单字若进查询，会把几乎
    全库召回，既淹没 BM25 排序，又让扩展轮无新候选可找 —— 实测会把
    多跳循环压成单轮。单字仍可通过扩展词回到召回路径。
    """
    unique = dict.fromkeys(casefold_tokens(query))
    return [
        token
        for token in unique
        if len(token) > 1 or not _is_cjk(token[0])
    ]


def sentence_context(
    sentence: str, query_terms: set[str], idf: Callable[[str], float]
) -> float:
    """句子内原查询词的 IDF 上下文强度（同句同词只计一次）。"""
    seen: set[str] = set()
    total = 0.0
    for word in casefold_tokens(sentence):
        if word in seen or word not in query_terms:
            continue
        seen.add(word)
        total += idf(word)
    return total
