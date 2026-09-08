"""文本工具模块(golden 参考实现:reverse 已修复 + truncate/title_case/归一化)。"""


def normalize_whitespace(text: str) -> str:
    """压缩多余空白为单个空格并去首尾。"""
    return " ".join(text.split())


def _normalize_words(text: str) -> list[str]:
    """按空白切分并过滤空片段。"""
    return [p for p in text.split() if p]


def word_count(text: str) -> int:
    """统计词数(按空白切分)。"""
    return len(_normalize_words(text))


def to_uppercase(text: str) -> str:
    """转为大写。"""
    return text.upper()


def slugify(text: str) -> str:
    """slug 化:小写、空格转连字符、去除空片段。"""
    lowered = normalize_whitespace(text).lower()
    return "-".join(_normalize_words(lowered))


def reverse(text: str) -> str:
    """字符串反转。"""
    return text[::-1]


def truncate(text: str, limit: int) -> str:
    """截断:超长时返回前 limit 个字符加省略号。"""
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def title_case(text: str) -> str:
    """每个单词首字母大写、其余小写。"""
    return " ".join(w.capitalize() for w in _normalize_words(text))
