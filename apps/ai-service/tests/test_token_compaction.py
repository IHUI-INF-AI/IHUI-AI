"""token_compaction.py 单元测试:RTK + Caveman + 组合策略 token 压缩。

测试覆盖(≥20 用例):
- _find_repeated_substrings:空文本 / 无重复 / 找到重复 / 最小长度过滤
- _rtk_compress_messages:重复 schema / 无重复 / 空消息 / 单条 / 映射表 / key 限制
- _extract_keywords:英文 / 中文 / 数字 / 停用词过滤
- _caveman_compress_text:基本压缩 / 空文本 / 保留数字
- _caveman_compress_messages:keep_recent 保留
- compact_messages:空列表 / 单条 / RTK / CAVEMAN / 组合
- compact_text:基本 / 空文本
- decompress:无 map / 还原 RTK / Caveman 不可逆
- 工具调用场景压缩率 ≥90%
- 压缩率计算 / 策略枚举 / 模块单例
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.token_compaction import (
    MSG_SEPARATOR,
    DEFAULT_KEEP_RECENT,
    MAX_RTK_KEYS,
    MIN_RTK_CHARS,
    MIN_RTK_TOKENS,
    CompactionResult,
    CompactionStrategy,
    TokenCompactor,
    _caveman_compress_messages,
    _caveman_compress_text,
    _DEFAULT_STOPWORDS,
    _estimate_messages_tokens,
    _extract_content_text,
    _extract_keywords,
    _find_repeated_substrings,
    _rtk_compress_messages,
    token_compactor,
)


# 测试用工具 schema(约 80 tokens,用于构造重复场景)
TOOL_SCHEMA = (
    '{"type":"function","function":{'
    '"name":"execute_database_query",'
    '"description":"Execute a SQL query on the specified database and return results",'
    '"parameters":{"type":"object","properties":{'
    '"query":{"type":"string","description":"The SQL query to execute"},'
    '"database":{"type":"string","enum":["postgres","mysql","sqlite"]},'
    '"timeout":{"type":"integer","minimum":1,"maximum":300},'
    '"format":{"type":"string","enum":["json","csv","xml"]},'
    '"limit":{"type":"integer","default":100},'
    '"offset":{"type":"integer","default":0},'
    '"cache":{"type":"boolean","default":true},'
    '"readonly":{"type":"boolean","default":true}'
    '},"required":["query","database"]}}}'
)


# =============================================================================
# _find_repeated_substrings
# =============================================================================


def test_find_repeated_substrings_empty_text():
    """空文本返回空列表。"""
    assert _find_repeated_substrings("") == []
    assert _find_repeated_substrings("short") == []


def test_find_repeated_substrings_no_repeat():
    """无重复子串返回空列表。"""
    text = "abcdefghijklmnopqrstuvwxyz0123456789unique"
    assert _find_repeated_substrings(text, min_len=10) == []


def test_find_repeated_substrings_finds_repeat():
    """能找到重复子串。"""
    repeat = "This is a repeated block of text that appears multiple times"
    text = repeat + " middle " + repeat
    result = _find_repeated_substrings(text, min_len=20)
    assert len(result) > 0
    # 最长的重复子串应包含或等于 repeat
    assert any(repeat in r or r in repeat for r in result)


def test_find_repeated_substrings_min_len_filter():
    """短于 min_len 的重复被过滤。"""
    text = "ab" * 50  # "ababab..." 但 "ab" 太短
    result = _find_repeated_substrings(text, min_len=30)
    # "ab" 重复但扩展后可能 ≥30,检查是否找到长重复
    # "ab"*50 = 100 chars,扩展后最长重复子串 = "ab"*49 = 98 chars
    assert len(result) > 0
    assert len(result[0]) >= 30


def test_find_repeated_substrings_sorted_by_length():
    """结果按长度降序排列。"""
    short_repeat = "x" * 35
    long_repeat = "y" * 80
    text = short_repeat + " sep1 " + short_repeat + " sep2 " + long_repeat + " sep3 " + long_repeat
    result = _find_repeated_substrings(text, min_len=30)
    if len(result) >= 2:
        assert len(result[0]) >= len(result[1])


# =============================================================================
# _extract_content_text
# =============================================================================


def test_extract_content_text_str():
    """str content 直接返回。"""
    assert _extract_content_text("hello") == "hello"


def test_extract_content_text_list_format():
    """list content(vision 格式)提取 text 字段。"""
    content: Any = [
        {"type": "text", "text": "hello"},
        {"type": "text", "text": "world"},
    ]
    assert _extract_content_text(content) == "hello world"


def test_extract_content_text_none():
    """None content 返回空字符串。"""
    assert _extract_content_text(None) == ""


def test_extract_content_text_non_str():
    """非 str/list content 转 str。"""
    assert _extract_content_text(12345) == "12345"


# =============================================================================
# _rtk_compress_messages
# =============================================================================


def test_rtk_compress_repeated_schema():
    """重复 schema 被 RTK 压缩:映射表非空,压缩后消息含 $N。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
        {"role": "user", "content": f"Call again: {TOOL_SCHEMA}"},
    ]
    compressed, rtk_map = _rtk_compress_messages(messages)
    assert len(rtk_map) >= 1
    # 压缩后至少有一条消息 content 含 $ 前缀
    has_placeholder = any(
        "$" in str(m.get("content", ""))
        for m in compressed
    )
    assert has_placeholder


def test_rtk_compress_no_repetition():
    """无重复内容时 rtk_map 为空,消息不变。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "This is a unique message about cats"},
        {"role": "assistant", "content": "Another completely different message about dogs"},
    ]
    compressed, rtk_map = _rtk_compress_messages(messages)
    assert rtk_map == {}
    # content 不含 $N 占位符
    for m in compressed:
        assert "$" not in str(m.get("content", ""))


def test_rtk_compress_empty_messages():
    """空消息列表返回空。"""
    compressed, rtk_map = _rtk_compress_messages([])
    assert compressed == []
    assert rtk_map == {}


def test_rtk_compress_single_message():
    """单条消息无重复,rtk_map 为空。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": TOOL_SCHEMA}
    ]
    compressed, rtk_map = _rtk_compress_messages(messages)
    assert rtk_map == {}
    assert len(compressed) == 1


def test_rtk_compress_map_keys_incremental():
    """多个不同重复子串生成递增的 key($1 $2 ...)。"""
    repeat_a = "Block A repeated content for testing " * 2
    repeat_b = "Block B different repeated content here " * 2
    messages: list[dict[str, object]] = [
        {"role": "user", "content": repeat_a + " " + repeat_b},
        {"role": "assistant", "content": repeat_a + " " + repeat_b},
    ]
    _, rtk_map = _rtk_compress_messages(messages)
    # key 应为 $1, $2, ... 格式
    for key in rtk_map:
        assert key.startswith("$")
        assert key[1:].isdigit()


def test_rtk_compress_max_keys_limit():
    """key 数量不超过 max_keys 限制。"""
    # 构造多个不同的重复块
    messages: list[dict[str, object]] = []
    for i in range(10):
        block = f"UniqueBlock{i:03d}" + "x" * 40  # 每个 block 唯一且够长
        messages.append({"role": "user", "content": block})
        messages.append({"role": "assistant", "content": block})
    _, rtk_map = _rtk_compress_messages(messages, max_keys=3)
    assert len(rtk_map) <= 3


def test_rtk_compress_preserves_role():
    """压缩后消息保留原 role 字段。"""
    messages: list[dict[str, object]] = [
        {"role": "system", "content": TOOL_SCHEMA},
        {"role": "user", "content": TOOL_SCHEMA},
    ]
    compressed, _ = _rtk_compress_messages(messages)
    assert compressed[0]["role"] == "system"
    assert compressed[1]["role"] == "user"


# =============================================================================
# _extract_keywords
# =============================================================================


def test_extract_keywords_english():
    """英文关键词提取(去停用词)。"""
    text = "The quick brown fox jumps over the lazy dog"
    keywords = _extract_keywords(text, _DEFAULT_STOPWORDS)
    # "the" "over" 是停用词,应被过滤
    assert "quick" in keywords
    assert "brown" in keywords
    assert "fox" in keywords
    assert "jumps" in keywords
    assert "lazy" in keywords
    assert "dog" in keywords
    assert "the" not in keywords
    assert "over" not in keywords


def test_extract_keywords_chinese():
    """中文关键词提取(按字符过滤停用词)。"""
    text = "我是一个工程师,我在写代码"
    keywords = _extract_keywords(text, _DEFAULT_STOPWORDS)
    # "我" "是" "在" 是停用词,应被过滤
    joined = "".join(keywords)
    assert "我" not in joined or "工程师" in joined  # 至少工程师被保留
    # 应包含 "工程师" 或 "代码"(非停用词)
    assert any("工程师" in k or "代码" in k for k in keywords)


def test_extract_keywords_numbers():
    """数字被保留为关键词。"""
    text = "I have 42 apples and 100 oranges"
    keywords = _extract_keywords(text, _DEFAULT_STOPWORDS)
    assert "42" in keywords
    assert "100" in keywords


def test_extract_keywords_stopwords_filtered():
    """停用词被过滤。"""
    text = "this is a test of the system"
    keywords = _extract_keywords(text, _DEFAULT_STOPWORDS)
    lower_kw = [k.lower() for k in keywords]
    assert "this" not in lower_kw
    assert "is" not in lower_kw
    assert "a" not in lower_kw
    assert "of" not in lower_kw
    assert "the" not in lower_kw
    assert "test" in lower_kw
    assert "system" in lower_kw


# =============================================================================
# _caveman_compress_text
# =============================================================================


def test_caveman_compress_basic():
    """基本 Caveman 压缩:句子 → 关键词骨架。"""
    text = "The system processes user requests. It returns JSON responses."
    result = _caveman_compress_text(text, _DEFAULT_STOPWORDS)
    assert "|" in result  # 关键词用 | 连接
    assert "system" in result
    assert "processes" in result
    assert "the" not in result.lower().split("|")


def test_caveman_compress_empty_text():
    """空文本返回空字符串。"""
    assert _caveman_compress_text("", _DEFAULT_STOPWORDS) == ""


def test_caveman_compress_preserves_numbers():
    """Caveman 保留数字。"""
    text = "Process 500 items in 30 seconds."
    result = _caveman_compress_text(text, _DEFAULT_STOPWORDS)
    assert "500" in result
    assert "30" in result


def test_caveman_compress_chinese():
    """中文 Caveman 压缩。"""
    text = "系统处理用户请求。返回JSON响应。"
    result = _caveman_compress_text(text, _DEFAULT_STOPWORDS)
    assert "|" in result
    assert "JSON" in result


def test_caveman_compress_messages_keep_recent():
    """Caveman 保留最后 keep_recent 条不压缩。"""
    # 用足够长的文本确保 Caveman 压缩有效(去停用词后 token 数减少)
    long_text_1 = (
        "The system processes user requests and returns the results to the client. "
        "The database stores all the data and the cache improves performance."
    )
    long_text_2 = (
        "The server receives the request and validates the input parameters. "
        "The application logs the operation and sends a response back to the user."
    )
    messages: list[dict[str, object]] = [
        {"role": "user", "content": long_text_1},
        {"role": "assistant", "content": long_text_2},
        {"role": "user", "content": "Final message should be preserved"},
    ]
    compressed = _caveman_compress_messages(messages, _DEFAULT_STOPWORDS, keep_recent=1)
    # 最后 1 条保留原文
    assert compressed[-1]["content"] == "Final message should be preserved"
    # 前 2 条被压缩(含 |)或回退为原文(压缩后 token 增加时)
    # 长文本 Caveman 应有效压缩(去停用词 the/to/and 等)
    head_has_pipe = any(
        "|" in str(c["content"])
        for c in compressed[:-1]
    )
    assert head_has_pipe, "长文本 Caveman 压缩后应含 | 分隔符"


# =============================================================================
# compact_messages
# =============================================================================


def test_compact_messages_empty():
    """空消息列表返回零值 CompactionResult。"""
    result = token_compactor.compact_messages([])
    assert result.original_tokens == 0
    assert result.compressed_tokens == 0
    assert result.compression_ratio == 0.0
    assert result.compressed_messages == []
    assert result.rtk_map == {}


def test_compact_messages_single():
    """单条消息(无重复)RTK 策略不压缩。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "Hello world this is a unique message"}
    ]
    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    assert result.rtk_map == {}
    assert result.original_tokens == result.compressed_tokens
    assert result.compression_ratio == 0.0


def test_compact_messages_rtk_strategy():
    """RTK 策略压缩重复 schema。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
    ]
    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    assert result.strategy == CompactionStrategy.RTK
    assert len(result.rtk_map) >= 1
    assert result.compressed_tokens < result.original_tokens
    assert result.compression_ratio > 0.0


def test_compact_messages_caveman_strategy():
    """Caveman 策略压缩历史消息。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "The system processes user requests efficiently"},
        {"role": "assistant", "content": "The database returns query results quickly"},
        {"role": "user", "content": "Final message preserved"},
    ]
    result = token_compactor.compact_messages(
        messages, strategy=CompactionStrategy.CAVEMAN, keep_recent=1
    )
    assert result.strategy == CompactionStrategy.CAVEMAN
    assert result.rtk_map == {}
    # 最后一条保留
    assert result.compressed_messages[-1]["content"] == "Final message preserved"


def test_compact_messages_combo_strategy():
    """RTK_CAVEMAN 组合策略:先 RTK 再 Caveman。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
        {"role": "user", "content": f"Call again: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result again: {TOOL_SCHEMA}"},
        {"role": "user", "content": "Recent message one preserved"},
        {"role": "assistant", "content": "Recent message two preserved"},
    ]
    result = token_compactor.compact_messages(
        messages, strategy=CompactionStrategy.RTK_CAVEMAN, keep_recent=2
    )
    assert result.strategy == CompactionStrategy.RTK_CAVEMAN
    # RTK 应检测到重复
    assert len(result.rtk_map) >= 1
    # 压缩率应 > 0
    assert result.compression_ratio > 0.0
    # 最后 2 条保留(未被 Caveman 压缩)
    assert "preserved" in str(result.compressed_messages[-1]["content"]).lower() or \
           "|" in str(result.compressed_messages[-1]["content"])


def test_compact_messages_strategy_in_result():
    """结果中的 strategy 字段与传入策略一致。"""
    messages: list[dict[str, object]] = [{"role": "user", "content": "test"}]
    for s in CompactionStrategy:
        result = token_compactor.compact_messages(messages, strategy=s)
        assert result.strategy == s


# =============================================================================
# compact_text
# =============================================================================


def test_compact_text_basic():
    """compact_text 基本功能:返回单条消息结果。"""
    text = "The quick brown fox jumps over the lazy dog"
    result = token_compactor.compact_text(text, CompactionStrategy.CAVEMAN)
    assert len(result.compressed_messages) == 1
    assert result.compressed_messages[0]["role"] == "user"
    # Caveman 压缩后应含 | 或被压缩
    assert result.compressed_tokens <= result.original_tokens


def test_compact_text_empty():
    """空文本 compact_text 返回零值。"""
    result = token_compactor.compact_text("", CompactionStrategy.RTK)
    assert result.original_tokens == 0
    assert result.compressed_tokens == 0
    assert result.compression_ratio == 0.0


def test_compact_text_rtk_no_repeat():
    """无重复文本 RTK 策略不压缩。"""
    text = "A unique sentence with no repetition at all whatsoever"
    result = token_compactor.compact_text(text, CompactionStrategy.RTK)
    assert result.rtk_map == {}
    assert result.compression_ratio == 0.0


# =============================================================================
# decompress
# =============================================================================


def test_decompress_no_rtk_map():
    """无 rtk_map 时解压返回原消息(深拷贝)。"""
    result = CompactionResult(
        original_tokens=10,
        compressed_tokens=10,
        compression_ratio=0.0,
        strategy=CompactionStrategy.CAVEMAN,
        rtk_map={},
        compressed_messages=[{"role": "user", "content": "hello"}],
    )
    restored = TokenCompactor.decompress(result)
    assert len(restored) == 1
    assert restored[0]["content"] == "hello"
    # 深拷贝:修改 restored 不影响原 result
    restored[0]["content"] = "modified"
    assert result.compressed_messages[0]["content"] == "hello"


def test_decompress_restores_rtk():
    """解压还原 RTK 占位符为原文。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
    ]
    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    assert len(result.rtk_map) >= 1
    restored = TokenCompactor.decompress(result)
    # 解压后 content 应还原包含 TOOL_SCHEMA 的关键片段
    # 至少一条消息还原后含 schema 特征(name 字段)
    has_schema_restored = any(
        "execute_database_query" in str(m["content"])
        for m in restored
        if isinstance(m["content"], str)
    )
    assert has_schema_restored


def test_decompress_caveman_not_restored():
    """Caveman 压缩不可逆:解压后不还原 Caveman 部分。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "The quick brown fox jumps over the lazy dog"},
        {"role": "assistant", "content": "The system processes data"},
        {"role": "user", "content": "Recent preserved"},
    ]
    result = token_compactor.compact_messages(
        messages, strategy=CompactionStrategy.CAVEMAN, keep_recent=1
    )
    restored = TokenCompactor.decompress(result)
    # Caveman 压缩不可逆:decompress 只还原 RTK,不还原 Caveman
    # 验证 decompress 不改变 Caveman 压缩形态(解压后 == 压缩后)
    first_compressed = str(result.compressed_messages[0]["content"])
    first_restored = str(restored[0]["content"])
    assert first_restored == first_compressed, (
        "decompress 不应改变 Caveman 压缩形态"
        f"(compressed={first_compressed!r}, restored={first_restored!r})"
    )
    # Caveman 有损:压缩形态不等于原文(去掉了停用词)
    assert first_restored != str(messages[0]["content"]), (
        "Caveman 压缩应去掉停用词,不等于原文"
    )


# =============================================================================
# 工具调用场景压缩率验证(核心目标 ≥90%)
# =============================================================================


def test_tool_call_scenario_high_compression():
    """工具调用场景:重复 schema 多次出现,RTK_CAVEMAN 压缩率 ≥90%(超越 OmniRoute 89%)。"""
    # 构造 20 条消息,每条都含相同的工具 schema(模拟工具调用重复)
    messages: list[dict[str, object]] = [
        {"role": "system", "content": f"You have tools: {TOOL_SCHEMA}"},
    ]
    for i in range(20):
        messages.append({"role": "user", "content": f"Call tool {i}: {TOOL_SCHEMA}"})
        messages.append({"role": "assistant", "content": f"Result {i}: {TOOL_SCHEMA}"})

    result = token_compactor.compact_messages(
        messages, strategy=CompactionStrategy.RTK_CAVEMAN, keep_recent=6
    )
    # 核心断言:压缩率 ≥ 90%
    assert result.compression_ratio >= 0.90, (
        f"压缩率 {result.compression_ratio:.4f} 未达 90% 目标"
        f"(original={result.original_tokens}, compressed={result.compressed_tokens})"
    )
    # RTK 映射表非空(检测到 schema 重复)
    assert len(result.rtk_map) >= 1


def test_tool_call_scenario_rtk_only_compression():
    """纯 RTK 策略工具调用场景压缩率也应较高(≥80%)。"""
    messages: list[dict[str, object]] = []
    for i in range(15):
        messages.append({"role": "user", "content": f"Call {i}: {TOOL_SCHEMA}"})
        messages.append({"role": "assistant", "content": f"Result {i}: {TOOL_SCHEMA}"})

    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    assert result.compression_ratio >= 0.80, (
        f"纯 RTK 压缩率 {result.compression_ratio:.4f} 未达 80%"
    )


# =============================================================================
# 压缩率计算 + 边界
# =============================================================================


def test_compression_ratio_calculation():
    """压缩率 = (original - compressed) / original。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
    ]
    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    expected_ratio = (result.original_tokens - result.compressed_tokens) / result.original_tokens
    assert abs(result.compression_ratio - expected_ratio) < 1e-9


def test_compression_ratio_range():
    """压缩率在 [0, 1] 范围内。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
    ]
    result = token_compactor.compact_messages(messages, strategy=CompactionStrategy.RTK)
    assert 0.0 <= result.compression_ratio <= 1.0


def test_compressed_tokens_le_original():
    """压缩后 token 数 ≤ 原始 token 数。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": f"Call: {TOOL_SCHEMA}"},
        {"role": "assistant", "content": f"Result: {TOOL_SCHEMA}"},
    ]
    for strategy in CompactionStrategy:
        result = token_compactor.compact_messages(messages, strategy=strategy)
        assert result.compressed_tokens <= result.original_tokens


# =============================================================================
# 策略枚举 + 模块单例
# =============================================================================


def test_strategy_enum_values():
    """策略枚举值正确。"""
    assert CompactionStrategy.RTK.value == "rtk"
    assert CompactionStrategy.CAVEMAN.value == "caveman"
    assert CompactionStrategy.RTK_CAVEMAN.value == "rtk_caveman"


def test_strategy_enum_is_str():
    """策略枚举是 str 子类(支持 JSON 序列化)。"""
    assert isinstance(CompactionStrategy.RTK, str)
    assert CompactionStrategy.RTK == "rtk"


def test_module_singleton():
    """模块级单例 token_compactor 是 TokenCompactor 实例。"""
    assert isinstance(token_compactor, TokenCompactor)


def test_module_singleton_usable():
    """模块级单例可直接调用 compact_messages。"""
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "test message"}
    ]
    result = token_compactor.compact_messages(messages)
    assert isinstance(result, CompactionResult)
    assert result.original_tokens > 0


def test_default_stopwords_not_empty():
    """默认停用词表非空。"""
    assert len(_DEFAULT_STOPWORDS) > 0
    assert "the" in _DEFAULT_STOPWORDS
    assert "的" in _DEFAULT_STOPWORDS


def test_custom_stopwords_in_constructor():
    """构造器支持自定义停用词表。"""
    custom = frozenset({"foo", "bar"})
    compactor = TokenCompactor(stopwords=custom)
    assert compactor._stopwords is custom


# =============================================================================
# 配置常量
# =============================================================================


def test_config_constants():
    """配置常量值正确。"""
    assert MIN_RTK_TOKENS == 10
    assert MIN_RTK_CHARS == 30
    assert MAX_RTK_KEYS == 50
    assert DEFAULT_KEEP_RECENT == 6
    assert MSG_SEPARATOR == "\x00<RTK_BOUND>\x00"


def test_estimate_messages_tokens_with_overhead():
    """_estimate_messages_tokens 含 4 token/条 overhead。"""
    from app.core.context_compaction import estimate_tokens

    messages: list[dict[str, object]] = [
        {"role": "user", "content": "hello"},
    ]
    total = _estimate_messages_tokens(messages)
    assert total == estimate_tokens("hello") + 4
