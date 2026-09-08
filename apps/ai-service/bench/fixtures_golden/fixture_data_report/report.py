"""数据报表模块(golden 参考实现:bug 已修复 + 从 data/format 转发)。"""

from data import generate_report as _generate_report
from format import format_currency  # noqa: F401
from common import format_currency as _fc  # noqa: F401  (refactor-report-common 的目标形态)


def generate_report(rows: list[dict]) -> str:
    """生成逐行报表并打印合计(转发到 data 模块)。"""
    return _generate_report(rows)


def count_rows(rows: list[dict]) -> int:
    """返回记录行数(转发到 data 模块)。"""
    return len(rows)


def avg_amount(rows: list[dict]) -> float:
    """计算平均金额,空列表安全返回 0.0。"""
    if not rows:
        return 0.0
    from data import avg_amount as _avg
    return _avg(rows)
