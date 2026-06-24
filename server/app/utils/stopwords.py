"""停用词工具模块 (迁移自 ihui-ai-edu-search-service).

提供停用词加载、文本过滤与简单分词能力:
- load_stopwords(): 加载停用词集合 (模块级缓存, 仅加载一次)
- remove_stopwords(): 过滤文本中的停用词
- tokenize_with_stopwords(): 简单分词并过滤停用词
"""

import re
from pathlib import Path

from loguru import logger

# 停用词文件路径: app/resources/stopwords.txt
_STOPWORDS_FILE = Path(__file__).resolve().parent.parent / "resources" / "stopwords.txt"

# 模块级缓存: 加载一次后复用
_stopwords_cache: set[str] | None = None

# 简单分词正则: 匹配中文字符序列或英文/数字单词
_TOKEN_PATTERN = re.compile(r"[\u4e00-\u9fa5]+|[A-Za-z0-9]+")


def load_stopwords() -> set[str]:
    """加载停用词集合 (模块级缓存, 仅加载一次).

    Returns:
        停用词集合, 若文件加载失败则返回空集合.
    """
    global _stopwords_cache
    if _stopwords_cache is not None:
        return _stopwords_cache

    stopwords: set[str] = set()
    try:
        if not _STOPWORDS_FILE.exists():
            logger.warning(f"停用词文件不存在: {_STOPWORDS_FILE}")
            _stopwords_cache = stopwords
            return _stopwords_cache

        with _STOPWORDS_FILE.open("r", encoding="utf-8") as fh:
            for line in fh:
                word = line.strip()
                if not word:
                    continue
                # 跳过注释行 (以 // 开头)
                if word.startswith("//"):
                    continue
                stopwords.add(word)
        logger.info(f"停用词加载完成, 共 {len(stopwords)} 个")
    except Exception as e:
        logger.exception(f"停用词加载失败: {e}")
    finally:
        _stopwords_cache = stopwords
    return _stopwords_cache


def remove_stopwords(text: str) -> str:
    """过滤文本中的停用词 (按字符/词逐个剔除).

    Args:
        text: 原始文本.

    Returns:
        过滤停用词后的文本.
    """
    if not text:
        return ""
    stopwords = load_stopwords()
    if not stopwords:
        return text
    # 逐字符判断: 命中停用词的字符被剔除
    result = "".join(ch for ch in text if ch not in stopwords)
    return result


def tokenize_with_stopwords(text: str) -> list[str]:
    """简单分词并过滤停用词.

    分词策略: 中文按连续字符序列切分, 英文/数字按单词切分,
    然后剔除完全由停用词组成的 token.

    Args:
        text: 原始文本.

    Returns:
        过滤停用词后的 token 列表.
    """
    if not text:
        return []
    stopwords = load_stopwords()
    tokens: list[str] = []
    for match in _TOKEN_PATTERN.finditer(text):
        token = match.group()
        # 整体命中停用词则跳过
        if token in stopwords:
            continue
        # 剔除 token 内部包含的停用词字符 (如标点)
        if stopwords:
            cleaned = "".join(ch for ch in token if ch not in stopwords)
            if cleaned:
                tokens.append(cleaned)
        else:
            tokens.append(token)
    return tokens
