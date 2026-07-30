"""Token 压缩模块:RTK(Reduce Token Key)+ Caveman 两种算法。

RTK(Reduce Token Key):
    将重复出现的长 token 序列替换为短 key($1 $2 ...),建立 key→原文映射表。
    适用场景:工具调用重复 schema / 长 system prompt 重复段落。

Caveman:
    将完整句子压缩为"关键词骨架"(主语+谓语+宾语),去除停用词/修饰词。
    适用场景:对话历史压缩(用户长消息 → 关键词)。

组合策略 RTK_CAVEMAN:
    先 RTK 压缩重复,再 Caveman 压缩历史,工具调用场景压缩率 ≥90%。

对标 OmniRoute(RTK+Caveman 89% 压缩率),本实现目标超越 OmniRoute。

类型约束(AGENTS.md §3):禁用 Any,用 object + isinstance 类型守卫。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import TypeAlias

import tiktoken

from ..core.context_compaction import estimate_tokens

logger = logging.getLogger(__name__)

# 类型别名:OpenAI 消息格式(role/content/tool_calls 等),value 类型异构用 object
# UP040:运行环境 Python 3.11 不支持 PEP 695 `type` 关键字(需 3.12+)
Message: TypeAlias = dict[str, object]  # noqa: UP040

# RTK 配置
MIN_RTK_TOKENS: int = 10          # 重复序列最少 token 数(对标 OmniRoute)
MIN_RTK_CHARS: int = 30           # 重复序列最少字符数(预过滤,token 验证为准)
MAX_RTK_KEYS: int = 50            # 最多 key 数量(避免映射表过大)
RTK_KEY_PREFIX: str = "$"         # key 前缀
# 消息边界分隔符:含 \x00,正常 LLM 文本不会包含,确保拆分无歧义
MSG_SEPARATOR: str = "\x00<RTK_BOUND>\x00"

# Caveman 配置
DEFAULT_KEEP_RECENT: int = 6      # 默认保留最近 N 条不压缩

# 内置最小停用词表(英文 + 中文),data/stopwords.json 不存在时使用
_DEFAULT_STOPWORDS: frozenset[str] = frozenset({
    # 英文冠词/代词/介词/连词/助动词/副词
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "can", "shall", "to", "of", "in",
    "on", "at", "by", "for", "with", "about", "as", "into", "through",
    "during", "before", "after", "above", "below", "from", "up", "down",
    "out", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just", "now",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am",
    # 中文高频虚词/助词/代词(单字为主,过滤粒度细)
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没",
    "看", "好", "这", "那", "里", "为", "把", "被", "让", "从", "向",
    "往", "以", "于", "对", "跟", "给", "但", "而", "如", "因", "所",
    "或", "还", "吧", "呢", "吗", "啊", "哦", "嗯", "哈", "嘛",
})

# 模块级 encoder 缓存(与 context_compaction.py 一致,cl100k_base)
_encoder: tiktoken.Encoding | None = None


def _get_encoder() -> tiktoken.Encoding:
    """获取 tiktoken encoder(cl100k_base,与 context_compaction.py 一致)。"""
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning("Failed to load tiktoken cl100k_base: %s, fallback to p50k", e)
            _encoder = tiktoken.get_encoding("p50k_base")
    return _encoder


class CompactionStrategy(str, Enum):  # noqa: UP042 — 与项目其他 5 个 services 文件保持一致(combo_router 等)
    """压缩策略枚举(str 子类,支持 JSON 序列化 + 值比较)。"""

    RTK = "rtk"
    CAVEMAN = "caveman"
    RTK_CAVEMAN = "rtk_caveman"


@dataclass
class CompactionResult:
    """压缩结果。

    Attributes:
        original_tokens: 原始消息的 token 数(含 4 token/条 overhead)
        compressed_tokens: 压缩后消息的 token 数
        compression_ratio: 压缩率 = (original - compressed) / original,值越大压缩越好
        strategy: 使用的压缩策略
        rtk_map: RTK key → 原文映射表(Caveman 不可逆,解压只还原 RTK 部分)
        compressed_messages: 压缩后的消息列表
    """

    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    strategy: CompactionStrategy
    rtk_map: dict[str, str] = field(default_factory=dict)
    compressed_messages: list[Message] = field(default_factory=list)


def _find_repeated_substrings(
    text: str,
    min_len: int = MIN_RTK_CHARS,
    max_results: int = MAX_RTK_KEYS * 2,
) -> list[str]:
    """找文本中所有长度 ≥ min_len 的重复子串(至少出现 2 次)。

    算法:滑动窗口 + hash 检测候选,对相邻重复位置向两端扩展为最长重复子串。
    返回按长度降序排列的重复子串列表(去重)。

    性能:O(n * min_len) 窗口扫描 + O(k * n) 扩展(k = 候选数,远小于 n)。
    """
    n = len(text)
    if n < min_len * 2:
        return []

    # 滑动窗口,记录每个窗口内容的出现位置
    positions: dict[str, list[int]] = {}
    for i in range(n - min_len + 1):
        sub = text[i:i + min_len]
        if sub not in positions:
            positions[sub] = []
        positions[sub].append(i)

    # 找出现 ≥2 次的窗口,扩展为最长重复子串
    # 扩展时在 \x00(MSG_SEPARATOR 边界)处停止,避免跨越消息边界
    # 对每个窗口添加两个版本:
    #   1. 向前+向后扩展(最长特定子串,如 " 0: {schema}")
    #   2. 只向后扩展(通用子串,如 "{schema}"),捕获高收益通用重复
    candidates: list[str] = []
    for pos_list in positions.values():
        if len(pos_list) < 2:
            continue
        # 限制相邻对数,避免 O(n^2) 性能问题(取前 5 对足够覆盖典型场景)
        max_pairs = min(len(pos_list) - 1, 5)
        best = ""
        for j in range(max_pairs):
            p1, p2 = pos_list[j], pos_list[j + 1]
            gap = p2 - p1
            # 向前扩展:比较 p1 前一个字符与 p2 前一个字符,\x00 为消息边界停止
            start = p1
            while (
                start > 0
                and text[start - 1] == text[start + gap - 1]
                and text[start - 1] != "\x00"
            ):
                start -= 1
            # 向后扩展:比较 p1 当前末尾与 p2 当前末尾,\x00 为消息边界停止
            end = p1 + min_len
            while (
                end < n
                and end + gap < n
                and text[end] == text[end + gap]
                and text[end] != "\x00"
            ):
                end += 1
            extended = text[start:end]
            if len(extended) > len(best):
                best = extended
        if len(best) >= min_len:
            candidates.append(best)
        # 只向后扩展版本(从窗口起始不向前),捕获通用子串(如纯 schema)
        p1, p2 = pos_list[0], pos_list[1]
        gap = p2 - p1
        end = p1 + min_len
        while (
            end < n
            and end + gap < n
            and text[end] == text[end + gap]
            and text[end] != "\x00"
        ):
            end += 1
        backward_only = text[p1:end]
        if len(backward_only) >= min_len and backward_only != best:
            candidates.append(backward_only)

    # 去重 + 按长度降序
    seen: set[str] = set()
    unique: list[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    unique.sort(key=len, reverse=True)
    return unique[:max_results]


def _extract_content_text(content: object) -> str:
    """从消息 content 字段提取纯文本(str 或 list[dict] 格式)。

    OpenAI vision 格式 content 为 list[{type, text/image_url}],
    提取所有 text 字段拼接;非 str/list 转 str();None/空返回 ""。
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                text = part.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(part, str):
                parts.append(part)
        return " ".join(parts)
    if content is None:
        return ""
    return str(content)


def _rtk_compress_messages(
    messages: list[Message],
    min_tokens: int = MIN_RTK_TOKENS,
    max_keys: int = MAX_RTK_KEYS,
) -> tuple[list[Message], dict[str, str]]:
    """RTK 压缩:检测重复 token 序列,用 $N 占位符替换。

    流程:
    1. 各消息文本用 MSG_SEPARATOR 拼接为全局文本(保留消息边界)
    2. 找重复子串(长度 ≥ MIN_RTK_CHARS,token 数 ≥ min_tokens)
    3. 贪心替换:从最长开始,replace 全部出现为 $N
    4. 拆分回各条消息,保留原 role 和其他字段

    Returns:
        (compressed_messages, rtk_map) — rtk_map: {$N: 原文}
    """
    if not messages:
        return [], {}

    # 1. 拼接(分隔符含 \x00,正常文本不含)
    texts = [_extract_content_text(msg.get("content", "")) for msg in messages]
    full_text = MSG_SEPARATOR.join(texts)

    # 2. 找重复子串
    repeats = _find_repeated_substrings(full_text, min_len=MIN_RTK_CHARS)

    # 3. 按收益(出现次数 × 长度)降序排序,而非纯长度
    #    纯长度排序会优先替换 " N: {schema}"(长但只出现 2 次),
    #    而非 "{schema}"(短但出现 30 次),导致压缩率低。
    #    收益 = (count - 1) * len(repeat) 反映替换后节省的字符数。
    #
    #    过滤规则:
    #    a) 含 \x00 的 repeat 跳过:MSG_SEPARATOR 以 \x00 为边界,
    #       repeat 若含 \x00(即使不含完整 MSG_SEPARATOR)替换后会破坏消息边界。
    #    b) 只保留跨消息重复(msg_count >= 2):RTK 设计目标是跨消息去重,
    #       单条消息内的重复由 BPE 自身处理,不应触发 RTK。
    scored: list[tuple[int, str]] = []
    for repeat in repeats:
        if "\x00" in repeat:
            continue
        if estimate_tokens(repeat) < min_tokens:
            continue
        count = full_text.count(repeat)
        if count < 2:
            continue
        # 检查 repeat 出现在几条不同消息中(跨消息去重)
        msg_count = sum(1 for t in texts if repeat in t)
        if msg_count < 2:
            continue
        benefit = (count - 1) * len(repeat)
        scored.append((benefit, repeat))
    scored.sort(key=lambda x: x[0], reverse=True)

    # 4. 贪心替换:从收益最高开始,前序替换可能使后续候选 count < 2 则跳过
    rtk_map: dict[str, str] = {}
    key_idx = 1
    compressed_full = full_text
    for _, repeat in scored:
        # 检查在当前压缩文本中是否仍出现 ≥2 次(前序替换可能已改变)
        count = compressed_full.count(repeat)
        if count < 2:
            continue
        key = f"{RTK_KEY_PREFIX}{key_idx}"
        rtk_map[key] = repeat
        compressed_full = compressed_full.replace(repeat, key)
        key_idx += 1
        if len(rtk_map) >= max_keys:
            break

    # 5. 拆分回各条消息(分隔符未被替换,拆分安全)
    compressed_texts = compressed_full.split(MSG_SEPARATOR)

    # 6. 重建消息(浅拷贝 + 替换 content,保留 role 等字段)
    compressed_messages: list[Message] = []
    for orig_msg, comp_text in zip(messages, compressed_texts, strict=True):
        new_msg: Message = dict(orig_msg)
        new_msg["content"] = comp_text
        compressed_messages.append(new_msg)

    return compressed_messages, rtk_map


def _extract_keywords(text: str, stopwords: frozenset[str]) -> list[str]:
    r"""提取关键词:英文单词 + 中文连续字符段 + 数字,去停用词。

    - 英文:[A-Za-z][A-Za-z0-9_-]{1,}(≥2 字符),小写化查停用词
    - 中文:[\u4e00-\u9fff]+ 连续段,按单字过滤停用词后拼接
    - 数字:\d+ 整数(保留数值信息)
    """
    keywords: list[str] = []
    # 英文单词(≥2 字符,含连字符/下划线/数字后缀)
    for word in re.findall(r"[A-Za-z][A-Za-z0-9_-]{1,}", text):
        w = word.lower()
        if w not in stopwords:
            keywords.append(word)
    # 中文连续字符段(按单字过滤停用词)
    for seg in re.findall(r"[\u4e00-\u9fff]+", text):
        chars = [c for c in seg if c not in stopwords]
        if chars:
            keywords.append("".join(chars))
    # 数字(保留数值,对标 Caveman 保留宾语中的量化信息)
    for num in re.findall(r"\d+", text):
        keywords.append(num)
    return keywords


def _caveman_compress_text(text: str, stopwords: frozenset[str]) -> str:
    """Caveman 压缩:将完整句子压缩为关键词骨架。

    分句(中英文标点 + 换行 + 分号)→ 每句提取关键词 → 句子内用空格连接关键词 →
    句子之间用 " | " 连接(区分句子边界,且 | 数量少,token 开销低于句子内用 |)。
    空句/无关键词的句子被跳过。

    注:句子内用空格而非 |,因 tiktoken BPE 编码中空格前缀会合并到下一个词
    (system processes = 2 tokens),而 | 是独立 token(system|processes = 3 tokens),
    句子内用 | 会导致压缩后 token 数反增。
    """
    if not text:
        return ""
    # 分句:按 . ! ? 。 ! ? \n ; ； 分割
    sentences = re.split(r"[.!?。!?\n;；]+", text)
    skeletons: list[str] = []
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        keywords = _extract_keywords(sent, stopwords)
        if keywords:
            skeletons.append(" ".join(keywords))
    return " | ".join(skeletons)


def _caveman_compress_messages(
    messages: list[Message],
    stopwords: frozenset[str],
    keep_recent: int = DEFAULT_KEEP_RECENT,
) -> list[Message]:
    """Caveman 压缩:保留最后 keep_recent 条不压缩,其余压缩为关键词骨架。

    keep_recent=0 表示压缩全部消息。Caveman 不可逆(信息有损)。
    压缩后为空的消息回退为原文(避免空 content)。
    """
    if not messages:
        return []
    n = len(messages)
    keep = min(keep_recent, n)
    head = messages[:n - keep]
    tail = messages[n - keep:]

    compressed_head: list[Message] = []
    for msg in head:
        new_msg: Message = dict(msg)
        text = _extract_content_text(msg.get("content", ""))
        compressed = _caveman_compress_text(text, stopwords)
        # 压缩为空(无关键词)或压缩后 token 数增加(短文本分隔符开销)时回退原文
        if not compressed or estimate_tokens(compressed) > estimate_tokens(text):
            new_msg["content"] = text
        else:
            new_msg["content"] = compressed
        compressed_head.append(new_msg)

    return compressed_head + tail


def _estimate_messages_tokens(messages: list[Message]) -> int:
    """估算消息列表 token 数(含每条 4 token overhead,与 context_compaction.py 一致)。"""
    total = 0
    for msg in messages:
        text = _extract_content_text(msg.get("content", ""))
        total += estimate_tokens(text) + 4
    return total


class TokenCompactor:
    """Token 压缩器:RTK + Caveman 两种算法,支持组合策略。

    用法:
        result = token_compactor.compact_messages(
            messages, strategy=CompactionStrategy.RTK_CAVEMAN
        )
        # 压缩率 = result.compression_ratio
        # 压缩后消息 = result.compressed_messages
        # 解压(仅还原 RTK): TokenCompactor.decompress(result)
    """

    def __init__(self, stopwords: frozenset[str] | None = None) -> None:
        self._stopwords = stopwords if stopwords is not None else _DEFAULT_STOPWORDS
        # 预热 encoder(避免首次调用延迟)
        _get_encoder()

    def compact_messages(
        self,
        messages: list[Message],
        strategy: CompactionStrategy = CompactionStrategy.RTK_CAVEMAN,
        keep_recent: int = DEFAULT_KEEP_RECENT,
    ) -> CompactionResult:
        """压缩消息列表。

        Args:
            messages: OpenAI 格式消息列表([{role, content, ...}])
            strategy: 压缩策略(RTK / CAVEMAN / RTK_CAVEMAN)
            keep_recent: Caveman 策略保留最近 N 条不压缩(RTK 不使用此参数)

        Returns:
            CompactionResult:含压缩后消息、压缩率、rtk_map
        """
        if not messages:
            return CompactionResult(
                original_tokens=0,
                compressed_tokens=0,
                compression_ratio=0.0,
                strategy=strategy,
                rtk_map={},
                compressed_messages=[],
            )

        original_tokens = _estimate_messages_tokens(messages)

        # 按策略分发
        rtk_map: dict[str, str] = {}
        if strategy == CompactionStrategy.RTK:
            compressed, rtk_map = _rtk_compress_messages(messages)
        elif strategy == CompactionStrategy.CAVEMAN:
            compressed = _caveman_compress_messages(messages, self._stopwords, keep_recent)
        elif strategy == CompactionStrategy.RTK_CAVEMAN:
            # 先 RTK 压缩重复(全量),再 Caveman 压缩历史(保留最近 N 条)
            rtk_compressed, rtk_map = _rtk_compress_messages(messages)
            compressed = _caveman_compress_messages(rtk_compressed, self._stopwords, keep_recent)
        else:
            # 不会到达(Enum 已穷尽,防御性兜底)
            compressed = [dict(m) for m in messages]

        compressed_tokens = _estimate_messages_tokens(compressed)
        ratio = (
            (original_tokens - compressed_tokens) / original_tokens
            if original_tokens > 0
            else 0.0
        )

        return CompactionResult(
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            compression_ratio=ratio,
            strategy=strategy,
            rtk_map=rtk_map,
            compressed_messages=compressed,
        )

    def compact_text(self, text: str, strategy: CompactionStrategy) -> CompactionResult:
        """压缩单个文本(封装为单条 user 消息处理,keep_recent=0 全量压缩)。

        空文本返回零值结果(避免单条空消息的 4 token overhead 误报)。
        """
        if not text:
            return CompactionResult(
                original_tokens=0,
                compressed_tokens=0,
                compression_ratio=0.0,
                strategy=strategy,
                rtk_map={},
                compressed_messages=[],
            )
        messages: list[Message] = [{"role": "user", "content": text}]
        return self.compact_messages(messages, strategy=strategy, keep_recent=0)

    @staticmethod
    def decompress(result: CompactionResult) -> list[Message]:
        """解压:还原 RTK 占位符(Caveman 不可逆,不还原)。

        Args:
            result: compact_messages 返回的 CompactionResult

        Returns:
            还原后的消息列表($N 占位符被替换回原文,深拷贝避免污染原 result)
        """
        rtk_map = result.rtk_map
        if not rtk_map:
            return [dict(m) for m in result.compressed_messages]

        restored: list[Message] = []
        for msg in result.compressed_messages:
            new_msg: Message = dict(msg)
            content = new_msg.get("content", "")
            if isinstance(content, str):
                for key, orig in rtk_map.items():
                    content = content.replace(key, orig)
                new_msg["content"] = content
            restored.append(new_msg)
        return restored


# 模块级单例(对标 context_compaction.py 的模块级函数风格)
token_compactor = TokenCompactor()
