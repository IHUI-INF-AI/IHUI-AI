"""聚合模块(与 report.py 重复了 format_currency 逻辑,供重构任务使用)。"""


def format_currency(value: float) -> str:
    """重复实现:与 report.py 的 format_currency 完全一致(应提取到共享模块)。"""
    return f"¥{value:.2f}"


def summarize(rows: list[dict]) -> str:
    """对金额求和并以货币格式返回。"""
    total = 0.0
    for r in rows:
        total += r["amount"]
    return format_currency(total)
