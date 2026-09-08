"""共享格式化模块(golden 参考实现:提取重复的 format_currency)。"""


def format_currency(value: float) -> str:
    """格式化金额为 ¥ 字符串。"""
    return f"¥{value:.2f}"
