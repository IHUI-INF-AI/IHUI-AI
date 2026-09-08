"""格式化模块(golden 参考实现:multifile-report-split 的目标形态)。"""


def format_currency(value: float) -> str:
    """格式化金额为 ¥ 字符串。"""
    return f"¥{value:.2f}"
