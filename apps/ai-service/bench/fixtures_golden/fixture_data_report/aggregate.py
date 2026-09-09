"""聚合模块(golden 参考实现:format_currency 改为从 common 导入)。"""

from common import format_currency


def summarize(rows: list[dict]) -> str:
    """对金额求和并以货币格式返回。"""
    total = 0.0
    for r in rows:
        total += r["amount"]
    return format_currency(total)
