"""文本工具模块(含 1 个 bug 与 1 个缺失测试,供 IHUI-Bench 任务使用)。"""


def word_count(text: str) -> int:
    """统计词数(按空白切分)。"""
    return len(text.split())


def to_uppercase(text: str) -> str:
    """转为大写。"""
    return text.upper()


def slugify(text: str) -> str:
    """slug 化:小写、空格转连字符、去除空片段。"""
    lowered = text.lower()
    parts = [p for p in lowered.split() if p]
    return "-".join(parts)


def reverse(text: str) -> str:
    """字符串反转(注:此处为故意埋设的 bug,步长应为 -1)。"""
    return text[::1]
