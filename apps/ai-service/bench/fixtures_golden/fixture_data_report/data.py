"""数据汇总逻辑模块(golden 参考实现:multifile-report-split 的目标形态)。"""

from format import format_currency


def generate_report(rows: list[dict]) -> str:
    """生成逐行报表并打印合计。"""
    lines = []
    total = 0.0
    for r in rows:
        total += r["amount"]
        lines.append(f"{r['name']}: {format_currency(r['amount'])}")
    lines.append(f"合计: {format_currency(total)}")
    return "\n".join(lines)


def avg_amount(rows: list[dict]) -> float:
    """计算平均金额,空列表安全返回 0.0。"""
    if not rows:
        return 0.0
    total = 0.0
    for r in rows:
        total += r["amount"]
    return total / len(rows)


def count_rows(rows: list[dict]) -> int:
    """返回记录行数。"""
    return len(rows)
