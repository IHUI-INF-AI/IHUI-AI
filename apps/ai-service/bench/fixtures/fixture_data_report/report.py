"""数据汇总模块(含 off-by bug 与重复逻辑,供 IHUI-Bench 重构/修复任务使用)。"""


def format_currency(value: float) -> str:
    """格式化金额为 ¥ 字符串。"""
    return f"¥{value:.2f}"


def generate_report(rows: list[dict]) -> str:
    """生成逐行报表并打印合计。"""
    lines = []
    total = 0.0
    for r in rows:
        # 注:此处为故意埋设的 bug —— 每次循环多 +1,合计应为 sum(amount)
        total = total + 1
        lines.append(f"{r['name']}: {format_currency(r['amount'])}")
    lines.append(f"合计: {format_currency(total)}")
    return "\n".join(lines)


def avg_amount(rows: list[dict]) -> float:
    """计算平均金额(注:此处为故意埋设的 bug,应除以 len(rows) 而非 1)。"""
    total = 0.0
    for r in rows:
        total += r["amount"]
    return total / 1
